/* ============================================================
   Musalingo — quest-page.js
   Page logic for quest.html. Loaded AFTER quest.js and sounds.js.
   Does NOT redefine MUSALINGO_QUESTS — that's quest.js's job.
   ============================================================ */

(function () {
    'use strict';

    /* ---------- safe localStorage parse ---------- */
    function safeParse(key, fallback) {
        try {
            const raw = localStorage.getItem(key);
            if (!raw) return fallback;
            const parsed = JSON.parse(raw);
            return parsed && typeof parsed === 'object' ? parsed : fallback;
        } catch (err) {
            console.warn('[quest] Corrupted localStorage for ' + key + '; using defaults.', err);
            return fallback;
        }
    }

    const profile = safeParse('MusalingoProfile', { courses: [] });
    const settings = safeParse('MusalingoSettings', {});
    profile.inventory = Array.isArray(profile.inventory) ? profile.inventory : [];

    /* ---------- DOM ---------- */
    const subtitleEl = document.getElementById('questSubtitle');
    const listEl = document.getElementById('questList');
    const noteEl = document.getElementById('questNote');
    const rewardPanel = document.getElementById('rewardPanel');
    const rewardList = document.getElementById('rewardList');
    const ringEl = document.getElementById('questRing');
    const ringCountEl = document.getElementById('questRingCount');
    const progressTitleEl = document.getElementById('questProgressTitle');
    const progressTextEl = document.getElementById('questProgressText');
    const progressFillEl = document.getElementById('questProgressFill');
    const speechEl = document.getElementById('questSpeech');

    /* ---------- helpers ---------- */
    function escapeHtml(s) {
        return String(s ?? '').replace(/[&<>"']/g, c => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
        }[c]));
    }

    function clamp01(n) {
        return Math.max(0, Math.min(1, n));
    }

    function setSpeech(text) {
        if (speechEl) speechEl.textContent = text;
    }

    /* ---------- render ---------- */
    function renderQuests() {
        if (settings.noGamification) {
            subtitleEl.textContent = 'Quests are turned off in Remove Bloat settings.';
            noteEl.hidden = true;
            if (rewardPanel) rewardPanel.hidden = true;
            if (listEl) listEl.innerHTML =
                '<div class="note">Turn gamification back on to see daily quests.</div>';
            setSpeech('Quests are off right now.');
            return;
        }

        if (!window.MUSALINGO_QUESTS || typeof window.MUSALINGO_QUESTS.getDailyQuests !== 'function') {
            subtitleEl.textContent = 'Quest system failed to load. Reload the page.';
            setSpeech('Oops — try reloading.');
            return;
        }

        const quests = window.MUSALINGO_QUESTS.getDailyQuests(profile);
        const completedCount = quests.filter(q => q.isComplete).length;

        // grant rewards (quest.js handles persistence)
        window.MUSALINGO_QUESTS.grantDailyRewards(profile);

        // ---- list ----
        listEl.innerHTML = quests.map(quest => {
            const isComplete = quest.isComplete;
            const pct = quest.max > 0 ? Math.round(clamp01(quest.current / quest.max) * 100) : 0;
            const aria = `${quest.title}${isComplete ? ' completed' : ' not completed'}`;
            return `
                <article class="quest-card${isComplete ? ' completed' : ''}" role="status" aria-label="${escapeHtml(aria)}">
                    <div class="quest-icon" aria-hidden="true">${quest.icon}</div>
                    <div class="quest-copy">
                        <h2>${escapeHtml(quest.title)}</h2>
                        <p>${escapeHtml(quest.detail)}</p>
                        <div class="quest-mini-bar" aria-hidden="true">
                            <div class="quest-mini-fill" style="width:${pct}%"></div>
                        </div>
                        <div class="quest-mini-label">${Math.min(quest.current, quest.max)} / ${quest.max}</div>
                    </div>
                    <span class="tick" aria-hidden="true">✓</span>
                </article>
            `;
        }).join('');

        // ---- progress ring + bar ----
        const total = quests.length || 1;
        const pctDone = completedCount / total;
        ringEl.style.setProperty('--pct', String(pctDone * 100));
        ringCountEl.textContent = `${completedCount}/${total}`;
        progressFillEl.style.width = `${pctDone * 100}%`;

        if (completedCount === total) {
            progressTitleEl.textContent = 'All quests complete! 🎉';
            progressTextEl.textContent = 'Mega Chest unlocked — come back tomorrow for new quests.';
            setSpeech('You did it! Mega Chest unlocked! 🎉');
        } else if (completedCount === 0) {
            progressTitleEl.textContent = 'Let’s get started!';
            progressTextEl.textContent = 'Finish all three quests to unlock the Mega Chest.';
            setSpeech('Let’s crush today’s quests!');
        } else {
            progressTitleEl.textContent = 'Keep going!';
            progressTextEl.textContent = `${total - completedCount} quest${total - completedCount === 1 ? '' : 's'} left to unlock the Mega Chest.`;
            setSpeech('Nice progress — keep going!');
        }

        renderRewards();
    }

    function renderRewards() {
        const rewards = Array.isArray(profile.dailyQuestRewards) ? profile.dailyQuestRewards : [];
        if (!rewards.length) {
            rewardPanel.hidden = true;
            return;
        }
        rewardPanel.hidden = false;
        rewardList.innerHTML = rewards.map(reward => reward === 'mega-chest'
            ? '<div class="reward-card mega"><span class="chest-icon">👑</span><div><strong>Mega Chest</strong><span>+100 diamonds</span></div></div>'
            : '<div class="reward-card"><span class="chest-icon">🎁</span><div><strong>Quest Chest</strong><span>+25 diamonds</span></div></div>'
        ).join('');
    }

    /* ---------- boot ---------- */
    try {
        renderQuests();
    } catch (err) {
        console.error('[quest-page] render failed:', err);
        if (subtitleEl) subtitleEl.textContent = 'Could not load quests. Reload to try again.';
        setSpeech('Something went wrong.');
    }
})();