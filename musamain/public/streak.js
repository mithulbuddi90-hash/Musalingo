/* ============================================================
   Musalingo — streak-page.js
   Page logic for streak.html. Loaded AFTER sounds.js.
   ============================================================ */

(function () {
    'use strict';

    function safeParse(key, fallback) {
        try {
            const raw = localStorage.getItem(key);
            if (!raw) return fallback;
            const parsed = JSON.parse(raw);
            return parsed && typeof parsed === 'object' ? parsed : fallback;
        } catch (err) {
            console.warn('[streak] Corrupted localStorage for ' + key + '; using defaults.', err);
            return fallback;
        }
    }

    const profile = safeParse('MusalingoProfile', {});
    const settings = safeParse('MusalingoSettings', {});
    const rawFriendUids = Array.isArray(profile.friends) ? profile.friends : [];

    /* ---------- DOM ---------- */
    const streakSection = document.getElementById('streakSection');
    const streakInfo = document.getElementById('streakInfo');
    const currentStreak = document.getElementById('currentStreak');
    const freezeEl = document.getElementById('freezeCountDisplay');
    const pauseToggle = document.getElementById('pauseToggle');
    const calendarTitle = document.getElementById('calendarTitle');
    const calendarGrid = document.getElementById('calendarGrid');
    const speechEl = document.getElementById('streakSpeech');

    /* ---------- noStreaks ---------- */
    if (settings.noStreaks) {
        // Hide the whole streak content but keep the shell + back button
        const hero = document.querySelector('.streak-hero');
        const stats = document.querySelector('.streak-stats');
        const pause = document.querySelector('.streak-pause-card');
        const cal = document.querySelector('.streak-calendar-card');
        const friends = document.querySelector('.streak-friends-card');
        [hero, stats, pause, cal, friends].forEach(el => el && el.classList.add('hidden'));
        if (speechEl) speechEl.textContent = 'Streaks are turned off.';
        return;
    }

    /* ---------- data ---------- */
    const lessonDates = new Set([...(profile.lessonDates || []), profile.lastLessonDate].filter(Boolean));
    const freezeDates = new Set((profile.streakFreezeDates || []).filter(Boolean));
    const firstActivityDate = [...lessonDates].sort()[0] || null;
    let calendarMonth = new Date();

    /* ---------- helpers ---------- */
    function dateKey(year, month, day) {
        return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }

    function escapeHtml(s) {
        return String(s ?? '').replace(/[&<>"']/g, c => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
        }[c]));
    }

    function setSpeech(text) {
        if (speechEl) speechEl.textContent = text;
    }

    /* ---------- calendar ---------- */
    function renderCalendar() {
        const year = calendarMonth.getFullYear();
        const month = calendarMonth.getMonth();
        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const today = new Date();
        const todayKey = dateKey(today.getFullYear(), today.getMonth(), today.getDate());

        calendarTitle.textContent = calendarMonth.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
        calendarGrid.innerHTML = '';

        for (let i = 0; i < firstDay; i += 1) {
            const empty = document.createElement('span');
            empty.className = 'calendar-day empty';
            empty.setAttribute('aria-hidden', 'true');
            calendarGrid.appendChild(empty);
        }

        for (let day = 1; day <= daysInMonth; day += 1) {
            const key = dateKey(year, month, day);
            const el = document.createElement('span');
            el.className = 'calendar-day';
            el.textContent = day;
            el.setAttribute('aria-label', key);

            if (lessonDates.has(key)) {
                el.classList.add('active');
                el.setAttribute('aria-label', key + ', lesson completed');
            } else if (firstActivityDate && key >= firstActivityDate && key < todayKey) {
                if (freezeDates.has(key)) {
                    el.classList.add('frozen');
                    el.setAttribute('aria-label', key + ', streak freeze');
                } else {
                    el.classList.add('missed');
                    el.setAttribute('aria-label', key + ', lesson missed');
                }
            }
            if (key === todayKey) el.classList.add('today');
            calendarGrid.appendChild(el);
        }
    }

    /* ---------- UI ---------- */
    function updateUI() {
        const streak = Number(profile.streak) || 0;
        if (!streak) {
            streakInfo.textContent = 'No streak data yet';
            currentStreak.textContent = '0 days';
            setSpeech('Start a lesson to light your flame!');
        } else {
            streakInfo.textContent = 'Streak: ' + streak + ' day' + (streak === 1 ? '' : 's');
            currentStreak.textContent = streak + ' day' + (streak === 1 ? '' : 's');
            pauseToggle.checked = profile.streakStatus === 'paused';
            setSpeech(streak >= 7 ? 'Streak Society member! 🔥' : 'Keep the flame alive!');
        }

        const freezes = Math.min(3, Math.max(0, Math.floor(Number(profile.streakFreezes) || 0)));
        if (freezeEl) freezeEl.textContent = String(freezes);
    }

    /* ---------- friends ---------- */
    const isSignedIn = localStorage.getItem('MusalingoLoggedIn') === 'true'
        && localStorage.getItem('MusalingoGuest') !== 'true';
    const uid = localStorage.getItem('MusalingoUid') || '';

    async function renderFriendStreaks() {
        const container = document.getElementById('friendStreaks');
        if (!container) return;

        if (!isSignedIn || !uid || rawFriendUids.length === 0) {
            container.innerHTML = '<div class="friends-empty">No friends yet.<br><a class="add-friends-link" href="friends.html#friends">Add new friends</a></div>';
            return;
        }

        container.innerHTML = '<div class="friends-empty">Loading friend streaks…</div>';

        try {
            const fb = await import('./firebase.js');
            const profiles = await fb.loadFriendsProfiles(uid);
            if (!Array.isArray(profiles) || profiles.length === 0) {
                container.innerHTML = '<div class="friends-empty">No friends yet.<br><a class="add-friends-link" href="friends.html#friends">Add new friends</a></div>';
                return;
            }
            container.innerHTML = `
                <div class="friend-streak-list">
                    ${profiles.map(friend => {
                const name = String(friend.name || friend.email || 'Friend');
                const streak = Number(friend.streak) || 0;
                return `
                            <div class="friend-streak-row">
                                <span class="friend-streak-name">${escapeHtml(name)}</span>
                                <span class="friend-streak-value">${streak} day${streak === 1 ? '' : 's'}</span>
                            </div>
                        `;
            }).join('')}
                </div>
            `;
        } catch (err) {
            console.warn('[streak] Could not load friend profiles:', err);
            container.innerHTML = '<div class="friends-empty">Could not load friend streaks right now.</div>';
        }
    }

    /* ---------- events ---------- */
    pauseToggle.addEventListener('change', () => {
        profile.streakStatus = pauseToggle.checked ? 'paused' : 'active';
        try {
            localStorage.setItem('MusalingoProfile', JSON.stringify(profile));
        } catch (err) {
            console.warn('[streak] Could not save streak status:', err);
        }
        updateUI();
    });

    document.getElementById('previousMonth').addEventListener('click', () => {
        calendarMonth = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1);
        renderCalendar();
    });

    document.getElementById('nextMonth').addEventListener('click', () => {
        calendarMonth = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1);
        renderCalendar();
    });

    /* ---------- boot ---------- */
    try {
        updateUI();
        renderCalendar();
        renderFriendStreaks();
    } catch (err) {
        console.error('[streak-page] boot failed:', err);
    }
})();