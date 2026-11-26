/* ============================================================
   Musalingo — friends.js
   Logic for friends.html. Loaded as <script type="module">.
   Requires: firebase.js, sounds.js (SFX) already loaded.
   ============================================================ */

let fb;
try {
    fb = await import('./firebase.js');
} catch (err) {
    console.error('[friends] firebase.js failed:', err);
    const el = document.getElementById('friendsList');
    if (el) el.innerHTML =
        '<div class="empty-state">Could not connect to the server. Reload to try again.</div>';
    throw err;
}

const {
    isGuestMode,
    loadLocalProfile,
    saveLocalProfile,
    sendFriendRequest,
    acceptFriendRequest,
    declineFriendRequest,
    removeFriend,
    loadFriendsProfiles,
    listenToIncomingRequests,
    listenToOutgoingRequests,
    listenToUserDocument
} = fb;

const profile = loadLocalProfile();
const myUid = profile.uid || '';
const isGuest = isGuestMode() || !myUid;

/* ---------- DOM ---------- */
const friendForm = document.getElementById('friendForm');
const emailInput = document.getElementById('friendEmail');
const addBtn = document.getElementById('addFriendBtn');
const messageEl = document.getElementById('friendMessage');
const signinNotice = document.getElementById('signinNotice');
const incomingPanel = document.getElementById('incomingPanel');
const outgoingPanel = document.getElementById('outgoingPanel');
const incomingList = document.getElementById('incomingList');
const outgoingList = document.getElementById('outgoingList');
const incomingCount = document.getElementById('incomingCount');
const friendsList = document.getElementById('friendsList');
const friendsCount = document.getElementById('friendsCount');
const refreshBtn = document.getElementById('refreshFriends');

/* ---------- helpers ---------- */
function showMessage(text, type = '') {
    messageEl.textContent = text;
    messageEl.className = 'message' + (type ? ' ' + type : '');
}

function initials(name, email) {
    const base = (name || email || 'F').trim();
    return base.slice(0, 2).toUpperCase();
}

function escapeHtml(s) {
    return String(s ?? '').replace(/[&<>"']/g, c => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
    }[c]));
}

function setFriendsBadge(n) {
    if (!friendsCount) return;
    if (n > 0) {
        friendsCount.hidden = false;
        friendsCount.textContent = n;
    } else {
        friendsCount.hidden = true;
    }
}

function setRowLoading(btn, loading, labelLoading = '…') {
    if (!btn) return;
    if (loading) {
        btn.dataset.prevText = btn.textContent;
        btn.textContent = labelLoading;
        btn.disabled = true;
    } else {
        btn.textContent = btn.dataset.prevText || btn.textContent;
        btn.disabled = false;
    }
}

/* ---------- guest state ---------- */
if (isGuest) {
    signinNotice.style.display = 'block';
    addBtn.disabled = true;
    emailInput.disabled = true;
    addBtn.textContent = 'Sign in to add friends';
}

/* ---------- FRIEND LIST ---------- */
async function renderFriends() {
    if (isGuest) {
        friendsList.innerHTML = '<div class="empty-state">Sign in to see your friends.</div>';
        setFriendsBadge(0);
        return;
    }
    friendsList.innerHTML = '<div class="empty-state">Loading…</div>';
    try {
        const friends = await loadFriendsProfiles(myUid);
        setFriendsBadge(friends.length);
        if (!friends.length) {
            friendsList.innerHTML =
                '<div class="empty-state">No friends yet. Send a request above!</div>';
            return;
        }
        friendsList.innerHTML = friends.map(f => `
            <div class="friend-row" data-uid="${escapeHtml(f.uid)}">
                <div class="friend-meta">
                    <div class="avatar">${initials(f.name, f.email)}</div>
                    <div>
                        <div class="friend-name">${escapeHtml(f.name || f.email)}</div>
                        <div class="friend-streak">🔥 ${Number(f.streak) || 0} day streak</div>
                    </div>
                </div>
                <div class="row-actions">
                    <button class="btn-mini btn-play" data-action="play" data-uid="${escapeHtml(f.uid)}">Play chess</button>
                    <button class="btn-mini btn-remove" data-action="remove" data-uid="${escapeHtml(f.uid)}">Remove</button>
                </div>
            </div>
        `).join('');
    } catch (e) {
        console.error('[friends] renderFriends:', e);
        friendsList.innerHTML = '<div class="empty-state">Could not load friends.</div>';
    }
}

/* ---------- INCOMING / OUTGOING ---------- */
function renderIncoming(items) {
    if (!items.length) {
        incomingPanel.style.display = 'none';
        return;
    }
    incomingPanel.style.display = 'block';
    incomingCount.textContent = items.length;
    incomingList.innerHTML = items.map(req => `
        <div class="friend-row" data-req="${escapeHtml(req.id)}">
            <div class="friend-meta">
                <div class="avatar">${initials(req.fromName, req.fromEmail)}</div>
                <div>
                    <div class="friend-name">${escapeHtml(req.fromName || req.fromEmail)}</div>
                    <div class="friend-streak">wants to be friends</div>
                </div>
            </div>
            <div class="row-actions">
                <button class="btn-mini btn-accept" data-action="accept" data-req="${escapeHtml(req.id)}" data-uid="${escapeHtml(req.fromUid)}">Accept</button>
                <button class="btn-mini btn-decline" data-action="decline" data-req="${escapeHtml(req.id)}">Decline</button>
            </div>
        </div>
    `).join('');
}

function renderOutgoing(items) {
    if (!items.length) {
        outgoingPanel.style.display = 'none';
        return;
    }
    outgoingPanel.style.display = 'block';
    outgoingList.innerHTML = items.map(req => `
        <div class="friend-row" data-req="${escapeHtml(req.id)}">
            <div class="friend-meta">
                <div class="avatar">${initials(req.toEmail, req.toEmail)}</div>
                <div>
                    <div class="friend-name">${escapeHtml(req.toEmail)}</div>
                    <div class="friend-streak">Request pending…</div>
                </div>
            </div>
            <div class="row-actions">
                <button class="btn-mini btn-remove" data-action="cancel" data-req="${escapeHtml(req.id)}">Cancel</button>
            </div>
        </div>
    `).join('');
}

/* ---------- FRIEND REQUEST FORM ---------- */
friendForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (isGuest) return;
    const email = emailInput.value.trim();
    if (!email) return;
    addBtn.disabled = true;
    showMessage('Sending…');
    try {
        const res = await sendFriendRequest({
            fromUid: myUid,
            fromEmail: profile.email,
            fromName: profile.name,
            toEmail: email
        });
        if (res.status === 'sent') {
            showMessage(`Request sent to ${res.targetName || email}.`, 'success');
            SFX.correct();
            emailInput.value = '';
        } else if (res.status === 'auto_accepted') {
            showMessage(`You and ${email} are now friends!`, 'success');
            SFX.correct();
            emailInput.value = '';
            renderFriends();
        } else if (res.status === 'already_friends') {
            showMessage('You are already friends.', 'error');
            SFX.error();
        } else if (res.status === 'already_pending') {
            showMessage('A request is already pending.', 'error');
            SFX.error();
        } else {
            showMessage(res.message || 'Could not send request.', 'error');
            SFX.error();
        }
    } catch (err) {
        console.error('[friends] sendFriendRequest:', err);
        showMessage(err.message || 'Network error.', 'error');
        SFX.error();
    } finally {
        addBtn.disabled = false;
    }
});

/* ---------- FRIEND LIST ACTIONS ---------- */
friendsList.addEventListener('click', async (e) => {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;
    const action = btn.dataset.action;
    if (action === 'play') {
        SFX.click();
        window.location.href = `matches.html?challenge=${encodeURIComponent(btn.dataset.uid)}`;
    } else if (action === 'remove') {
        if (!confirm('Remove this friend?')) return;
        setRowLoading(btn, true, 'Removing…');
        try {
            await removeFriend(myUid, btn.dataset.uid);
            SFX.click();
            renderFriends();
        } catch (err) {
            console.error('[friends] removeFriend:', err);
            showMessage('Could not remove friend.', 'error');
            setRowLoading(btn, false);
        }
    }
});

/* ---------- INCOMING ACTIONS ---------- */
incomingList.addEventListener('click', async (e) => {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;
    const action = btn.dataset.action;
    if (action === 'accept') {
        setRowLoading(btn, true, 'Accepting…');
        try {
            await acceptFriendRequest(btn.dataset.req, myUid, btn.dataset.uid);
            SFX.correct();
            renderFriends();
        } catch (err) {
            console.error('[friends] acceptFriendRequest:', err);
            showMessage('Could not accept request.', 'error');
            setRowLoading(btn, false);
        }
    } else if (action === 'decline') {
        setRowLoading(btn, true, 'Declining…');
        try {
            await declineFriendRequest(btn.dataset.req);
            SFX.wrong();
        } catch (err) {
            console.error('[friends] declineFriendRequest:', err);
            setRowLoading(btn, false);
        }
    }
});

/* ---------- OUTGOING ACTIONS ---------- */
outgoingList.addEventListener('click', async (e) => {
    const btn = e.target.closest('button[data-action="cancel"]');
    if (!btn) return;
    setRowLoading(btn, true, 'Cancelling…');
    try {
        await declineFriendRequest(btn.dataset.req);
        SFX.click();
    } catch (err) {
        console.error('[friends] cancel outgoing:', err);
        setRowLoading(btn, false);
    }
});

/* ---------- REFRESH BUTTON ---------- */
refreshBtn?.addEventListener('click', () => {
    if (isGuest) return;
    SFX.click();
    renderFriends();
});

/* ---------- LIVE LISTENERS ---------- */
let unsubIn = null, unsubOut = null, unsubMe = null;
if (!isGuest) {
    unsubIn = listenToIncomingRequests(myUid, renderIncoming);
    unsubOut = listenToOutgoingRequests(myUid, renderOutgoing);
    unsubMe = listenToUserDocument(myUid, (doc) => {
        if (doc) {
            const local = loadLocalProfile();
            const next = { ...local, friends: doc.friends || [] };
            saveLocalProfile(next);
        }
    });
}

renderFriends();

window.addEventListener('focus', () => { if (!isGuest) renderFriends(); });

window.addEventListener('pagehide', () => {
    try { unsubIn && unsubIn(); } catch { }
    try { unsubOut && unsubOut(); } catch { }
    try { unsubMe && unsubMe(); } catch { }
});