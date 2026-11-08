(function applyBloatSettings() {
    let settings = {};
    try {
        settings = JSON.parse(localStorage.getItem('MusalingoSettings') || '{}') || {};
    } catch (e) {
        console.warn('[bloat.js] Corrupted settings, using defaults.');
    }

    function hide(element) {
        if (!element) return;
        element.hidden = true;
        element.style.display = 'none';
    }

    if (settings.noGamification) {
        document.body.classList.add('no-gamification');
        hide(document.getElementById('diamondLink')?.closest('.stat-pill'));
        hide(document.getElementById('heartLink')?.closest('.stat-pill'));
        hide(document.getElementById('dailyQuestList')?.closest('.mini-card'));
        hide(document.getElementById('shopGrid'));
        hide(document.getElementById('diamondInfo')?.closest('.pill-row'));
        hide(document.getElementById('questList'));
        hide(document.getElementById('rewardPanel'));

        const shopSubtitle = document.getElementById('shopSubtitle');
        if (document.getElementById('shopGrid') && shopSubtitle) {
            shopSubtitle.textContent = 'Rewards are turned off in Remove Bloat settings.';
            const shopMessage = document.getElementById('shopMessage');
            if (shopMessage) shopMessage.textContent = 'The shop is disabled while gamification is turned off.';
        }
        const questSubtitle = document.getElementById('questSubtitle');
        if (questSubtitle) questSubtitle.textContent = 'Quests are turned off in Remove Bloat settings.';

        document.querySelectorAll('.nav-item, .nav a').forEach(link => {
            if (/^(shop|quests?)$/i.test(link.textContent.trim())) hide(link);
        });
        document.querySelectorAll('.path-chest').forEach(hide);
        const xpStat = document.getElementById('completionXp')?.closest('.completion-stat');
        hide(xpStat);
        const lessonStatus = document.getElementById('statusText');
        if (lessonStatus) lessonStatus.textContent = 'Complete the lesson to save your learning progress.';
        ['diamondValue', 'xpValue'].forEach(id => {
            hide(document.getElementById(id)?.closest('.stat'));
        });
    }

    if (settings.noHearts) {
        hide(document.getElementById('heartLink')?.closest('.stat-pill'));
    }

    if (settings.noStreaks) {
        document.body.classList.add('no-streaks');
        hide(document.getElementById('streakSection'));
        hide(document.getElementById('streakLink')?.closest('.stat-pill'));
        hide(document.getElementById('streakValue')?.closest('.stat'));
        document.querySelectorAll('.friend-streak').forEach(hide);
        document.querySelectorAll('.nav-item, .nav a').forEach(link => {
            if (/^streaks?$/i.test(link.textContent.trim())) hide(link);
        });
    }

    if (settings.noLeaderboards) {
        document.body.classList.add('no-leaderboards');
        document.querySelectorAll('.nav-item, .nav a').forEach(link => {
            if (/^leaderboards?$/i.test(link.textContent.trim())) hide(link);
        });
    }
})();
