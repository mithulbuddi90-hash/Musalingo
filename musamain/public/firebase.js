/* ============================================================
   Musalingo — firebase.js (v4)

   Changes vs v3:
   - No hardcoded credentials. Config fetched from /api/firebase-config.
   - Loud guard if config is missing or incomplete.
   - loadLocalProfile() sanitizes all numeric fields (no NaN leaks).
   - upsertSignedInUserDocument() no longer double-writes localStorage.
   - loadFriendProfile(uid) added — fixes matches.js friend-invite bug.
   - loadFriendsProfiles() cache invalidated on friend add/remove.
   - createFriendChessGame() notifies BOTH players.
   - Live chess logic preserved verbatim otherwise.
   ============================================================ */

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js';
import {
    getAuth,
    onAuthStateChanged,
    signInWithPopup,
    GoogleAuthProvider,
    OAuthProvider,
    RecaptchaVerifier,
    signInWithPhoneNumber
} from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js';
import {
    getFirestore,
    doc,
    getDoc,
    setDoc,
    updateDoc,
    deleteDoc,
    collection,
    query,
    where,
    orderBy,
    limit,
    getDocs,
    addDoc,
    onSnapshot,
    runTransaction,
    serverTimestamp,
    arrayUnion,
    writeBatch
} from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js';

/* ============================================================
   FIREBASE CONFIG — fetched from backend at runtime.
   No keys in this file. server.js serves GET /api/firebase-config
   from process.env.VITE_FIREBASE_*.
   ============================================================ */

const configRes = await fetch('/api/firebase-config', { cache: 'no-store' });
if (!configRes.ok) {
    throw new Error(
        '[firebase] Could not load /api/firebase-config (HTTP ' +
        configRes.status + '). ' +
        'Make sure server.js is running and VITE_FIREBASE_* env vars are set.'
    );
}

let firebaseConfig;
try {
    firebaseConfig = await configRes.json();
} catch (e) {
    throw new Error('[firebase] /api/firebase-config returned invalid JSON.');
}

if (!firebaseConfig || !firebaseConfig.apiKey || !firebaseConfig.projectId) {
    throw new Error(
        '[firebase] /api/firebase-config returned incomplete config. ' +
        'Missing VITE_FIREBASE_API_KEY or VITE_FIREBASE_PROJECT_ID.'
    );
}

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export const MUSALINGO_KEYS = {
    guest: 'MusalingoGuest',
    loggedIn: 'MusalingoLoggedIn',
    user: 'MusalingoUser',
    uid: 'MusalingoUid',
    profile: 'MusalingoProfile'
};

export { app, auth, db };

/* ============================================================
   AUTH / PROFILE CORE
   ============================================================ */

export function normalizeEmail(value = '') {
    return String(value || '').trim().toLowerCase();
}

function safeNumber(v, fallback = 0) {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
}

function getLocalDateKey(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

export function isGuestMode() {
    const guestFlag = localStorage.getItem(MUSALINGO_KEYS.guest) === 'true';
    const loggedInFlag = localStorage.getItem(MUSALINGO_KEYS.loggedIn) === 'true';
    return guestFlag || (!loggedInFlag && !auth.currentUser);
}

export function setGuestMode() {
    localStorage.setItem(MUSALINGO_KEYS.guest, 'true');
    localStorage.setItem(MUSALINGO_KEYS.loggedIn, 'false');
    localStorage.removeItem(MUSALINGO_KEYS.user);
    localStorage.removeItem(MUSALINGO_KEYS.uid);
}

export function clearGuestMode() {
    localStorage.removeItem(MUSALINGO_KEYS.guest);
    localStorage.setItem(MUSALINGO_KEYS.loggedIn, 'true');
}

/* Sanitizes every field that consumers rely on being numeric. */
export function loadLocalProfile() {
    let raw = {};
    try {
        raw = JSON.parse(localStorage.getItem(MUSALINGO_KEYS.profile) || 'null') || {};
    } catch {
        raw = {};
    }

    return {
        ...raw,
        uid: localStorage.getItem(MUSALINGO_KEYS.uid) || raw.uid || '',
        email: normalizeEmail(raw.email || localStorage.getItem(MUSALINGO_KEYS.user) || ''),
        name: String(raw.name || 'Learner').slice(0, 40),
        streak: Math.max(0, Math.floor(safeNumber(raw.streak, 0))),
        diamonds: Math.max(0, Math.floor(safeNumber(raw.diamonds, 0))),
        hearts: Math.min(5, Math.max(0, Math.floor(safeNumber(raw.hearts, 5)))),
        xp: Math.max(0, Math.floor(safeNumber(raw.xp, 0))),
        streakFreezes: Math.min(3, Math.max(0, Math.floor(safeNumber(raw.streakFreezes, 0)))),
        practiceMinutes: Math.max(0, Math.floor(safeNumber(raw.practiceMinutes, 0))),
        friends: Array.isArray(raw.friends) ? raw.friends.filter(x => typeof x === 'string') : [],
        courses: Array.isArray(raw.courses) ? raw.courses : [],
        inventory: Array.isArray(raw.inventory) ? raw.inventory.filter(x => typeof x === 'string') : [],
        streakFreezeDates: Array.isArray(raw.streakFreezeDates) ? raw.streakFreezeDates.filter(x => typeof x === 'string') : [],
        lessonDates: Array.isArray(raw.lessonDates) ? raw.lessonDates.filter(x => typeof x === 'string') : []
    };
}

export function saveLocalProfile(profile) {
    const merged = {
        ...loadLocalProfile(),
        ...profile,
        friends: Array.isArray(profile?.friends) ? profile.friends : [],
        courses: Array.isArray(profile?.courses) ? profile.courses : [],
        inventory: Array.isArray(profile?.inventory) ? profile.inventory : [],
        streakFreezes: Math.min(3, Math.max(0, Math.floor(safeNumber(profile?.streakFreezes, 0)))),
        streakFreezeDates: Array.isArray(profile?.streakFreezeDates)
            ? profile.streakFreezeDates.filter((date) => typeof date === 'string')
            : []
    };
    localStorage.setItem(MUSALINGO_KEYS.profile, JSON.stringify(merged));
    if (merged.uid) localStorage.setItem(MUSALINGO_KEYS.uid, merged.uid);
    if (merged.email) localStorage.setItem(MUSALINGO_KEYS.user, merged.email);
    return merged;
}

function latestActivityDate(profile) {
    return [profile.lastLessonDate, profile.lastActiveDate]
        .filter((date) => typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date))
        .sort()
        .at(-1) || null;
}

function createChessRewardUpdate(profile, gameId, xpReward, awardXp, updateStreak, today) {
    const rewardedGames = Array.isArray(profile.chessRewardedGameIds)
        ? profile.chessRewardedGameIds.filter((id) => typeof id === 'string')
        : [];
    if (rewardedGames.includes(gameId)) return { alreadyRewarded: true, profile };

    const updated = { ...profile };
    updated.streakFreezes = Math.min(3, Math.max(0, Math.floor(Number(updated.streakFreezes) || 0)));
    updated.streakFreezeDates = Array.isArray(updated.streakFreezeDates)
        ? updated.streakFreezeDates.filter((date) => typeof date === 'string')
        : [];
    const streakWasPaused = updated.streakStatus === 'paused';
    const previousActivityDate = latestActivityDate(updated);
    let streakAdvanced = false;

    if (updateStreak && !streakWasPaused) {
        let streak = Math.max(0, Math.floor(Number(updated.streak) || 0));
        if (!previousActivityDate) {
            streak = 1;
            streakAdvanced = true;
        } else if (previousActivityDate < today) {
            const previousTime = Date.parse(`${previousActivityDate}T00:00:00Z`);
            const todayTime = Date.parse(`${today}T00:00:00Z`);
            const dayGap = Math.floor((todayTime - previousTime) / 86400000);
            if (dayGap === 1) {
                streak += 1;
                streakAdvanced = true;
            } else if (dayGap > 1) {
                const missedDays = dayGap - 1;
                const freezes = updated.streakFreezes;
                if (freezes >= missedDays) {
                    updated.streakFreezes = freezes - missedDays;
                    for (let offset = 1; offset <= missedDays; offset++) {
                        const missedDate = new Date(previousTime + offset * 86400000).toISOString().slice(0, 10);
                        if (!updated.streakFreezeDates.includes(missedDate)) updated.streakFreezeDates.push(missedDate);
                    }
                    streak += missedDays + 1;
                } else {
                    streak = 1;
                }
                streakAdvanced = true;
            }
        }

        updated.streak = streak;
        updated.lastLessonDate = today;
        updated.lastActiveDate = today;
        updated.streakStatus = 'active';
    }

    if (awardXp) {
        updated.xp = Math.max(0, Math.floor(Number(updated.xp) || 0)) + xpReward;
        if (updated.dailyQuestDate !== today) {
            updated.dailyQuestDate = today;
            updated.dailyQuestProgress = { lessons: 0, xp: 0, practice: 0, accuracy: 0, streak: 0 };
        } else {
            updated.dailyQuestProgress = updated.dailyQuestProgress && typeof updated.dailyQuestProgress === 'object'
                ? { ...updated.dailyQuestProgress }
                : { lessons: 0, xp: 0, practice: 0, accuracy: 0, streak: 0 };
        }
        updated.dailyQuestProgress.xp = Math.max(0, Math.floor(Number(updated.dailyQuestProgress.xp) || 0)) + xpReward;
        updated.dailyQuestProgress.streak = Math.max(
            Math.floor(Number(updated.dailyQuestProgress.streak) || 0),
            updated.streak > 0 ? 1 : 0
        );
    }

    updated.chessRewardedGameIds = [...rewardedGames, gameId].slice(-500);
    return {
        alreadyRewarded: false,
        profile: updated,
        xpEarned: awardXp ? xpReward : 0,
        streakAdvanced,
        streak: Math.max(0, Math.floor(Number(updated.streak) || 0)),
        streakPaused: streakWasPaused,
        streakEnabled: updateStreak
    };
}

export async function awardChessMatchReward({ gameId, outcome, awardXp = true, updateStreak = true }) {
    if (!gameId || !['won', 'drawn', 'lost'].includes(outcome)) {
        throw new Error('A match ID and valid chess result are required to award match rewards.');
    }

    const rewardId = String(gameId);
    const rewardXp = { won: 50, drawn: 40, lost: 30 }[outcome];
    const today = getLocalDateKey();
    const localProfile = loadLocalProfile();
    const currentUser = auth.currentUser;

    if (!currentUser || isGuestMode()) {
        const result = createChessRewardUpdate(localProfile, rewardId, rewardXp, awardXp, updateStreak, today);
        if (!result.alreadyRewarded) saveLocalProfile(result.profile);
        return result;
    }

    const profileRef = doc(db, 'users', currentUser.uid);
    const result = await runTransaction(db, async (transaction) => {
        const snapshot = await transaction.get(profileRef);
        const remoteProfile = snapshot.exists() ? snapshot.data() : {};
        const localDate = latestActivityDate(localProfile);
        const remoteDate = latestActivityDate(remoteProfile);
        const baseProfile = { ...localProfile, ...remoteProfile };

        if (localDate && (!remoteDate || localDate > remoteDate)) {
            baseProfile.streak = localProfile.streak;
            baseProfile.streakStatus = localProfile.streakStatus;
            baseProfile.lastLessonDate = localProfile.lastLessonDate;
            baseProfile.lastActiveDate = localProfile.lastActiveDate;
            baseProfile.streakFreezes = localProfile.streakFreezes;
            baseProfile.streakFreezeDates = localProfile.streakFreezeDates;
        } else if (localDate && remoteDate === localDate) {
            baseProfile.streak = Math.max(
                Math.floor(Number(localProfile.streak) || 0),
                Math.floor(Number(remoteProfile.streak) || 0)
            );
        }
        baseProfile.xp = Math.max(
            Math.floor(Number(localProfile.xp) || 0),
            Math.floor(Number(remoteProfile.xp) || 0)
        );
        baseProfile.lessonDates = [...new Set([
            ...(Array.isArray(remoteProfile.lessonDates) ? remoteProfile.lessonDates : []),
            ...(Array.isArray(localProfile.lessonDates) ? localProfile.lessonDates : [])
        ])];

        const update = createChessRewardUpdate(baseProfile, rewardId, rewardXp, awardXp, updateStreak, today);
        if (update.alreadyRewarded) return update;

        transaction.set(profileRef, {
            xp: update.profile.xp || 0,
            streak: update.profile.streak || 0,
            streakStatus: update.profile.streakStatus || 'inactive',
            lastLessonDate: update.profile.lastLessonDate || null,
            lastActiveDate: update.profile.lastActiveDate || null,
            streakFreezes: update.profile.streakFreezes || 0,
            streakFreezeDates: update.profile.streakFreezeDates || [],
            lessonDates: update.profile.lessonDates,
            dailyQuestDate: update.profile.dailyQuestDate || null,
            dailyQuestProgress: update.profile.dailyQuestProgress || null,
            chessRewardedGameIds: update.profile.chessRewardedGameIds,
            updatedAt: serverTimestamp()
        }, { merge: true });

        return update;
    });

    if (!result.alreadyRewarded) {
        saveLocalProfile(result.profile);
    } else {
        const snapshot = await getDoc(profileRef);
        if (snapshot.exists()) saveLocalProfile({ ...localProfile, ...snapshot.data() });
    }
    return result;
}

export function getCurrentSignedInUser() {
    const user = auth.currentUser;
    if (user) return user;
    const savedEmail = normalizeEmail(localStorage.getItem(MUSALINGO_KEYS.user));
    const savedUid = localStorage.getItem(MUSALINGO_KEYS.uid);
    return savedEmail ? { email: savedEmail, uid: savedUid || 'guest' } : null;
}

/* ============================================================
   USER DOCUMENT — merge remote + local without data loss
   ============================================================ */

export async function upsertSignedInUserDocument(uid, email, extraProfile = {}) {
    if (!uid || !email) return null;

    const localProfile = loadLocalProfile();

    let remote = null;
    try {
        const snap = await getDoc(doc(db, 'users', uid));
        if (snap.exists()) remote = snap.data();
    } catch (e) {
        console.warn('[firebase] could not read remote profile:', e);
    }

    const mergedFriends = [...new Set([
        ...(remote?.friends || []),
        ...(extraProfile.friends || []),
        ...(localProfile.friends || [])
    ])];

    const mergedCourses = (Array.isArray(extraProfile.courses) && extraProfile.courses.length > 0)
        ? extraProfile.courses
        : (remote?.courses || localProfile.courses || []);

    const mergedInventory = (Array.isArray(extraProfile.inventory) && extraProfile.inventory.length > 0)
        ? extraProfile.inventory
        : (remote?.inventory || localProfile.inventory || []);

    const profile = {
        ...localProfile,
        ...(remote || {}),
        ...extraProfile,
        uid,
        email: normalizeEmail(email),
        name: extraProfile.name || remote?.name || localProfile.name || 'Learner',
        streak: Math.max(0, Math.floor(safeNumber(
            extraProfile.streak ?? remote?.streak ?? localProfile.streak, 0
        ))),
        diamonds: Math.max(0, Math.floor(safeNumber(
            extraProfile.diamonds ?? remote?.diamonds ?? localProfile.diamonds, 0
        ))),
        hearts: Math.min(5, Math.max(0, Math.floor(safeNumber(
            extraProfile.hearts ?? remote?.hearts ?? localProfile.hearts, 5
        )))),
        friends: mergedFriends,
        courses: mergedCourses,
        inventory: mergedInventory,
        updatedAt: serverTimestamp()
    };

    await setDoc(doc(db, 'users', uid), profile, { merge: true });

    // Single write to localStorage. saveLocalProfile handles uid/email keys.
    saveLocalProfile(profile);
    localStorage.setItem(MUSALINGO_KEYS.loggedIn, 'true');
    localStorage.removeItem(MUSALINGO_KEYS.guest);

    return profile;
}

export async function loadUserDocument(uid) {
    if (!uid) return null;
    try {
        const snap = await getDoc(doc(db, 'users', uid));
        return snap.exists() ? snap.data() : null;
    } catch (e) {
        console.warn('[firebase] loadUserDocument failed:', e);
        return null;
    }
}

export async function findUserByEmail(email) {
    const cleanedEmail = normalizeEmail(email);
    if (!cleanedEmail) return null;
    try {
        const q = query(collection(db, 'users'), where('email', '==', cleanedEmail), limit(1));
        const snapshot = await getDocs(q);
        if (snapshot.empty) return null;
        return { uid: snapshot.docs[0].id, ...snapshot.docs[0].data() };
    } catch (e) {
        console.warn('[firebase] findUserByEmail failed:', e);
        return null;
    }
}

export async function findUserByUid(uid) {
    if (!uid) return null;
    try {
        const snap = await getDoc(doc(db, 'users', uid));
        return snap.exists() ? { uid, ...snap.data() } : null;
    } catch (e) {
        console.warn('[firebase] findUserByUid failed:', e);
        return null;
    }
}

export function listenToUserDocument(uid, callback) {
    if (!uid) return () => { };
    return onSnapshot(
        doc(db, 'users', uid),
        (snap) => callback(snap.exists() ? { uid, ...snap.data() } : null),
        (err) => console.warn('[firebase] listenToUserDocument error:', err)
    );
}

/* ============================================================
   AUTH PROVIDERS
   ============================================================ */

export function createGoogleProvider() {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    return provider;
}

export function createMicrosoftProvider() {
    return new OAuthProvider('microsoft.com');
}

export function createPhoneVerifier(containerId = 'recaptcha-container') {
    return new RecaptchaVerifier(auth, containerId, {
        size: 'normal',
        callback: () => { },
        'expired-callback': () => { }
    });
}

export function signInWithGooglePopup() {
    return signInWithPopup(auth, createGoogleProvider());
}

export function signInWithMicrosoftPopup() {
    return signInWithPopup(auth, createMicrosoftProvider());
}

export function startPhoneSignIn(phoneNumber, verifier) {
    return signInWithPhoneNumber(auth, phoneNumber, verifier);
}

export function listenForAuthChanges(callback) {
    return onAuthStateChanged(auth, callback);
}

/* ============================================================
   FRIENDS
   ============================================================ */

function invalidateFriendsCache(uid) {
    try {
        if (uid) localStorage.removeItem(`MusalingoFriendsCache_${uid}`);
    } catch { /* ignore */ }
}

export async function sendFriendRequest({ fromUid, fromEmail, fromName, toEmail }) {
    if (!fromUid) return { status: 'error', message: 'Sign in first.' };

    const target = await findUserByEmail(toEmail);
    if (!target || !target.uid) {
        return { status: 'error', message: 'No Musalingo account found for that email.' };
    }
    if (target.uid === fromUid) {
        return { status: 'error', message: 'You cannot add yourself.' };
    }

    const myDoc = await loadUserDocument(fromUid);
    if ((myDoc?.friends || []).includes(target.uid)) {
        return { status: 'already_friends' };
    }

    try {
        const pendingOut = await getDocs(query(
            collection(db, 'friendRequests'),
            where('fromUid', '==', fromUid),
            where('toUid', '==', target.uid),
            where('status', '==', 'pending')
        ));
        if (!pendingOut.empty) return { status: 'already_pending' };

        const pendingIn = await getDocs(query(
            collection(db, 'friendRequests'),
            where('fromUid', '==', target.uid),
            where('toUid', '==', fromUid),
            where('status', '==', 'pending')
        ));
        if (!pendingIn.empty) {
            await acceptFriendRequest(pendingIn.docs[0].id, fromUid, target.uid);
            return { status: 'auto_accepted' };
        }

        await addDoc(collection(db, 'friendRequests'), {
            fromUid,
            fromEmail: normalizeEmail(fromEmail),
            fromName: fromName || 'Learner',
            toUid: target.uid,
            toEmail: target.email || normalizeEmail(toEmail),
            status: 'pending',
            createdAt: serverTimestamp()
        });

        return { status: 'sent', targetName: target.name || toEmail };
    } catch (e) {
        console.warn('[firebase] sendFriendRequest failed:', e);
        return { status: 'error', message: e.message || 'Request failed.' };
    }
}

export async function acceptFriendRequest(requestId, accepterUid, requesterUid) {
    await updateDoc(doc(db, 'users', accepterUid), {
        friends: arrayUnion(requesterUid)
    });
    await updateDoc(doc(db, 'users', requesterUid), {
        friends: arrayUnion(accepterUid)
    });
    await updateDoc(doc(db, 'friendRequests', requestId), {
        status: 'accepted',
        acceptedAt: serverTimestamp()
    });
    invalidateFriendsCache(accepterUid);
    invalidateFriendsCache(requesterUid);
}

export async function declineFriendRequest(requestId) {
    await updateDoc(doc(db, 'friendRequests', requestId), {
        status: 'declined',
        declinedAt: serverTimestamp()
    });
}

export async function removeFriend(myUid, friendUid) {
    if (!myUid || !friendUid) return;

    const myDoc = await loadUserDocument(myUid);
    const friendDoc = await loadUserDocument(friendUid);
    const myFriends = (myDoc?.friends || []).filter((u) => u !== friendUid);
    const theirFriends = (friendDoc?.friends || []).filter((u) => u !== myUid);

    const batch = writeBatch(db);
    batch.update(doc(db, 'users', myUid), { friends: myFriends });
    batch.update(doc(db, 'users', friendUid), { friends: theirFriends });
    await batch.commit();

    invalidateFriendsCache(myUid);
    invalidateFriendsCache(friendUid);
}

export function listenToIncomingRequests(myUid, callback) {
    if (!myUid) return () => { };
    const q = query(
        collection(db, 'friendRequests'),
        where('toUid', '==', myUid),
        where('status', '==', 'pending')
    );
    return onSnapshot(
        q,
        (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
        (err) => console.warn('[firebase] listenToIncomingRequests error:', err)
    );
}

export function listenToOutgoingRequests(myUid, callback) {
    if (!myUid) return () => { };
    const q = query(
        collection(db, 'friendRequests'),
        where('fromUid', '==', myUid),
        where('status', '==', 'pending')
    );
    return onSnapshot(
        q,
        (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
        (err) => console.warn('[firebase] listenToOutgoingRequests error:', err)
    );
}

/* ---------- Friend profile helpers ---------- */

export async function loadFriendsProfiles(myUid) {
    if (!myUid) return [];

    const cacheKey = `MusalingoFriendsCache_${myUid}`;
    try {
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
            const { data, timestamp } = JSON.parse(cached);
            if (Date.now() - timestamp < 5 * 60 * 1000 && Array.isArray(data)) {
                return data;
            }
        }
    } catch { /* ignore */ }

    const me = await loadUserDocument(myUid);
    const friendUids = Array.isArray(me?.friends) ? me.friends : [];
    if (!friendUids.length) return [];

    const profiles = await Promise.all(friendUids.map(async (fuid) => {
        try {
            const snap = await getDoc(doc(db, 'users', fuid));
            return snap.exists() ? { uid: fuid, ...snap.data() } : null;
        } catch {
            return null;
        }
    }));

    const validProfiles = profiles.filter(Boolean);

    try {
        localStorage.setItem(cacheKey, JSON.stringify({
            data: validProfiles,
            timestamp: Date.now()
        }));
    } catch { /* ignore */ }

    return validProfiles;
}

/**
 * Fetches a single friend's full profile.
 * Use this from matches.js instead of reading profile.friends from
 * localStorage — that array is UIDs only.
 */
export async function loadFriendProfile(friendUid) {
    if (!friendUid) return null;
    try {
        const snap = await getDoc(doc(db, 'users', friendUid));
        return snap.exists() ? { uid: friendUid, ...snap.data() } : null;
    } catch (e) {
        console.warn('[firebase] loadFriendProfile failed:', e);
        return null;
    }
}

/* ============================================================
   LIVE CHESS (FRIEND GAMES)
   ============================================================ */

const CHESS_GAMES = 'chessGames';
const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

export async function createFriendChessGame({
    myUid, myEmail, myName,
    friendUid, friendEmail, friendName,
    myColor = 'white',
    fen = START_FEN
}) {
    if (!myUid || !friendUid) throw new Error('Missing uid');

    const me = {
        uid: myUid,
        email: normalizeEmail(myEmail || ''),
        name: myName || 'Player'
    };
    const them = {
        uid: friendUid,
        email: normalizeEmail(friendEmail || ''),
        name: friendName || 'Friend'
    };
    const white = myColor === 'white' ? me : them;
    const black = myColor === 'black' ? me : them;

    const ref = await addDoc(collection(db, CHESS_GAMES), {
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        status: 'pending',
        white,
        black,
        inviterUid: myUid,
        invitedFriendUid: friendUid,
        fen,
        turn: 'w',
        moves: [],
        result: null,
        resultReason: null,
        drawOfferFrom: null
    });

    // Notify BOTH players so either side can resume/reconnect.
    const batch = writeBatch(db);
    batch.update(doc(db, 'users', friendUid), { pendingChessGameId: ref.id });
    batch.update(doc(db, 'users', myUid), { pendingChessGameId: ref.id });
    await batch.commit();

    return ref.id;
}

export async function acceptFriendChessGame(gameId, myUid) {
    await updateDoc(doc(db, CHESS_GAMES, gameId), {
        status: 'active',
        updatedAt: serverTimestamp()
    });
    try {
        await updateDoc(doc(db, 'users', myUid), { pendingChessGameId: null });
    } catch { /* non-fatal */ }
}

export async function abortFriendChessGame(gameId, myUid) {
    const gameSnap = await getDoc(doc(db, CHESS_GAMES, gameId));
    const game = gameSnap.exists() ? gameSnap.data() : null;

    await updateDoc(doc(db, CHESS_GAMES, gameId), {
        status: 'aborted',
        updatedAt: serverTimestamp()
    });

    const batch = writeBatch(db);
    if (myUid) batch.update(doc(db, 'users', myUid), { pendingChessGameId: null });
    if (game?.white?.uid && game.white.uid !== myUid) {
        try { batch.update(doc(db, 'users', game.white.uid), { pendingChessGameId: null }); } catch { }
    }
    if (game?.black?.uid && game.black.uid !== myUid) {
        try { batch.update(doc(db, 'users', game.black.uid), { pendingChessGameId: null }); } catch { }
    }
    try { await batch.commit(); } catch { /* non-fatal */ }
}

export async function pushChessMove(gameId, { from, to, promo, san, fen, turn, by }) {
    await updateDoc(doc(db, CHESS_GAMES, gameId), {
        fen,
        turn,
        moves: arrayUnion({
            from,
            to,
            promo: promo || null,
            san: san || '',
            by: by || null,
            at: Date.now()
        }),
        updatedAt: serverTimestamp()
    });
}

export async function finishChessGame(gameId, { result, reason }) {
    const gameSnap = await getDoc(doc(db, CHESS_GAMES, gameId));
    if (!gameSnap.exists()) return;
    const game = gameSnap.data();

    await updateDoc(doc(db, CHESS_GAMES, gameId), {
        status: 'finished',
        result,
        resultReason: reason,
        updatedAt: serverTimestamp()
    });

    const batch = writeBatch(db);
    if (game.white?.uid) {
        batch.update(doc(db, 'users', game.white.uid), { pendingChessGameId: null });
    }
    if (game.black?.uid) {
        batch.update(doc(db, 'users', game.black.uid), { pendingChessGameId: null });
    }
    await batch.commit();
}

export async function offerChessDraw(gameId, fromUid) {
    await updateDoc(doc(db, CHESS_GAMES, gameId), {
        drawOfferFrom: fromUid,
        updatedAt: serverTimestamp()
    });
}

export async function clearChessDrawOffer(gameId) {
    await updateDoc(doc(db, CHESS_GAMES, gameId), {
        drawOfferFrom: null,
        updatedAt: serverTimestamp()
    });
}

export function listenToChessGame(gameId, callback) {
    if (!gameId) return () => { };
    return onSnapshot(
        doc(db, CHESS_GAMES, gameId),
        (snap) => callback(snap.exists() ? { id: snap.id, ...snap.data() } : null),
        (err) => console.warn('[firebase] listenToChessGame error:', err)
    );
}

export function listenToMyChessInvites(myUid, callback) {
    if (!myUid) return () => { };
    const q = query(
        collection(db, CHESS_GAMES),
        where('invitedFriendUid', '==', myUid),
        where('status', '==', 'pending')
    );
    return onSnapshot(
        q,
        (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
        (err) => console.warn('[firebase] listenToMyChessInvites error:', err)
    );
}

export async function loadMyRecentChessResults(myUid, max = 20) {
    if (!myUid) return [];
    try {
        const q = query(
            collection(db, CHESS_GAMES),
            where('status', '==', 'finished'),
            orderBy('updatedAt', 'desc'),
            limit(max)
        );
        const snap = await getDocs(q);
        return snap.docs
            .map((d) => ({ id: d.id, ...d.data() }))
            .filter((g) => g.white?.uid === myUid || g.black?.uid === myUid);
    } catch (e) {
        console.warn('[firebase] loadMyRecentChessResults failed:', e);
        return [];
    }
}

/* ============================================================
   LEARNING PROGRESS
   ============================================================ */

export async function saveLearningProgress(courseId, lessonId, payload = {}) {
    const user = auth.currentUser;

    // Guest path — local only.
    if (!user || isGuestMode()) {
        const profile = loadLocalProfile();
        const courseIndex = profile.courses.findIndex((course) => course.id === courseId);
        const courseData = courseIndex >= 0
            ? profile.courses[courseIndex]
            : { id: courseId, lessons: [] };

        if (!Array.isArray(courseData.lessons)) courseData.lessons = [];

        const lessonIndex = courseData.lessons.findIndex((lesson) => lesson.id === lessonId);
        const lessonEntry = { id: lessonId, ...payload, updatedAt: new Date().toISOString() };

        if (lessonIndex >= 0) {
            courseData.lessons[lessonIndex] = { ...courseData.lessons[lessonIndex], ...lessonEntry };
        } else {
            courseData.lessons.push(lessonEntry);
        }

        if (courseIndex >= 0) profile.courses[courseIndex] = courseData;
        else profile.courses.push(courseData);

        saveLocalProfile(profile);
        return profile;
    }

    // Signed-in path — merge with remote first.
    const existing = await loadUserDocument(user.uid);
    const profile = { ...(existing || loadLocalProfile()) };
    const courses = Array.isArray(profile.courses) ? profile.courses : [];
    const courseIndex = courses.findIndex((course) => course.id === courseId);
    const courseData = courseIndex >= 0 ? courses[courseIndex] : { id: courseId, lessons: [] };

    if (!Array.isArray(courseData.lessons)) courseData.lessons = [];

    const lessonIndex = courseData.lessons.findIndex((lesson) => lesson.id === lessonId);
    const lessonEntry = { id: lessonId, ...payload, updatedAt: new Date().toISOString() };

    if (lessonIndex >= 0) {
        courseData.lessons[lessonIndex] = { ...courseData.lessons[lessonIndex], ...lessonEntry };
    } else {
        courseData.lessons.push(lessonEntry);
    }

    if (courseIndex >= 0) courses[courseIndex] = courseData;
    else courses.push(courseData);

    profile.courses = courses;
    await updateDoc(doc(db, 'users', user.uid), {
        courses,
        updatedAt: serverTimestamp()
    });
    saveLocalProfile(profile);
    return profile;
}

export default app;