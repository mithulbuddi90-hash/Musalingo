/* ============================================================
   Musalingo — quest.js (Shared Quest Logic)
   Used by both dashboard.html and quest.html
   ============================================================ */

window.MUSALINGO_QUESTS = {
    // 1. Get today's date key (YYYY-MM-DD)
    getTodayKey: function () {
        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    },

    // 2. Get the user's progress for today
    getProgress: function (profile) {
        if (!profile) return { lessons: 0, xp: 0, practice: 0, accuracy: 0, streak: 0 };
        if (profile.dailyQuestDate !== this.getTodayKey()) {
            return { lessons: 0, xp: 0, practice: 0, accuracy: 0, streak: 0 };
        }
        return profile.dailyQuestProgress || { lessons: 0, xp: 0, practice: 0, accuracy: 0, streak: 0 };
    },

    // 3. The Master Pool of all quests
    getPool: function () {
        return [
            { id: 'lessons', icon: '🎯', title: 'Complete 1 lesson', detail: 'Finish one lesson today.', max: 1, type: 'lessons' },
            { id: 'lessons-2', icon: '📚', title: 'Complete 2 lessons', detail: 'Finish two lessons today.', max: 2, type: 'lessons' },
            { id: 'xp', icon: '⭐', title: 'Earn 20 XP', detail: 'Earn XP from today\'s lessons.', max: 20, type: 'xp' },
            { id: 'practice', icon: '⏱️', title: 'Practice for 10 minutes', detail: 'Build ten minutes of practice today.', max: 10, type: 'practice' },
            { id: 'accuracy', icon: '💯', title: 'Get 80% accuracy in a lesson', detail: 'Reach 80% accuracy today.', max: 80, type: 'accuracy' },
            { id: 'streak', icon: '🔥', title: 'Keep your learning streak', detail: 'Complete a lesson today.', max: 1, type: 'streak' },
            { id: 'xp-combo', icon: '⭐', title: 'Earn 20 combo XP', detail: 'Earn XP from today\'s lessons.', max: 20, type: 'xp' },
            { id: 'xp-50', icon: '⭐', title: 'Earn 50 XP', detail: 'Earn XP from today\'s lessons.', max: 50, type: 'xp' },
            { id: 'practice-15', icon: '⏱️', title: 'Practice for 15 minutes', detail: 'Build fifteen minutes of practice today.', max: 15, type: 'practice' }
        ];
    },

    // 4. Get the 3 quests selected for TODAY
    getDailyQuests: function (profile) {
        const pool = this.getPool();
        const progress = this.getProgress(profile);

        // Calculate which 3 quests to show based on the day
        const dayNumber = Math.floor(new Date(`${this.getTodayKey()}T00:00:00Z`).getTime() / 86400000);
        const start = dayNumber % pool.length;

        const selectedQuests = [
            pool[start],
            pool[(start + 2) % pool.length],
            pool[(start + 4) % pool.length]
        ];

        // Attach the current progress to each quest so the HTML can easily read it
        return selectedQuests.map(quest => {
            const currentVal = progress[quest.type] || 0;
            return {
                ...quest,
                current: currentVal,
                isComplete: currentVal >= quest.max
            };
        });
    },

    grantDailyRewards: function (profile) {
        if (!profile) return { rewards: [], changed: false };

        const today = this.getTodayKey();
        let changed = false;
        if (profile.dailyQuestRewardDate !== today) {
            profile.dailyQuestRewardDate = today;
            profile.dailyQuestRewards = [];
            changed = true;
        }

        const rewards = Array.isArray(profile.dailyQuestRewards) ? profile.dailyQuestRewards : [];
        const completedIds = this.getDailyQuests(profile)
            .filter(quest => quest.isComplete)
            .map(quest => quest.id);
        profile.inventory = Array.isArray(profile.inventory) ? profile.inventory : [];

        completedIds.forEach(questId => {
            if (rewards.includes(questId)) return;
            profile.inventory.push('quest-chest');
            profile.diamonds = (Number(profile.diamonds) || 0) + 25;
            rewards.push(questId);
            changed = true;
            window.SFX?.gemEarned();
        });

        if (completedIds.length === this.getDailyQuests(profile).length && !rewards.includes('mega-chest')) {
            profile.inventory.push('mega-quest-chest');
            profile.diamonds = (Number(profile.diamonds) || 0) + 100;
            rewards.push('mega-chest');
            changed = true;
            window.SFX?.win();
        }

        profile.dailyQuestRewards = rewards;
        if (changed) localStorage.setItem('MusalingoProfile', JSON.stringify(profile));
        return { rewards, changed };
    }
};