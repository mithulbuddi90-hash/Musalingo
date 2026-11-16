/* ============================================================
   Musalingo — hearts.js
   Shared heart logic for lesson, shop, dashboard, streak.

   Fixes:
     • Bug: `0 || 5 === 5` made hearts = 0 read as full
     • Bug: deduct/refill inconsistency across pages
     • Adds centralized cap enforcement + timer

   Usage:
     <script src="hearts.js"></script>
     Hearts.get()           → current hearts (0-5, clamped)
     Hearts.getMax()        → 5
     Hearts.isOut()         → true if hearts === 0
     Hearts.isFull()        → true if hearts === max
     Hearts.canAfford(n)    → true if diamonds >= n * COST_PER_HEART
     Hearts.buy(n)          → deducts diamonds, adds n hearts
       → returns { ok, heartsAdded, diamondsSpent, message }
     Hearts.deduct(n)       → removes n hearts, starts refill timer
     Hearts.refill(now)     → auto-refill based on elapsed time
       → returns { changed, hearts, nextRefillAt }
     Hearts.sync()          → reload profile from localStorage
   ============================================================ */

window.Hearts = (() => {
    'use strict';

    const MAX = 5;
    const REFILL_INTERVAL_MS = 30 * 60 * 1000;   // 30 min per heart
    const COST_PER_HEART = 10;                    // diamonds per heart

    // ── SAFE READ ──
    function loadProfile() {
        try {
            const raw = localStorage.getItem('MusalingoProfile');
            if (!raw) return {};
            const p = JSON.parse(raw);
            return p && typeof p === 'object' ? p : {};
        } catch (err) {
            console.warn('[hearts] Could not read profile:', err);
            return {};
        }
    }

    function saveProfile(profile) {
        try {
            localStorage.setItem('MusalingoProfile', JSON.stringify(profile));
        } catch (err) {
            console.warn('[hearts] Could not save profile:', err);
        }
    }

    // FIX: use Number.isFinite, NOT `||`, so 0 reads as 0 not 5
    function clampHearts(value) {
        const n = Number(value);
        if (!Number.isFinite(n)) return MAX;
        return Math.max(0, Math.min(MAX, Math.floor(n)));
    }

    function clampDiamonds(value) {
        const n = Number(value);
        if (!Number.isFinite(n)) return 100;
        return Math.max(0, Math.floor(n));
    }

    // ── PUBLIC API ──

    function get() {
        const profile = loadProfile();
        return clampHearts(profile.hearts);
    }

    function getMax() {
        return MAX;
    }

    function isOut() {
        return get() === 0;
    }

    function isFull() {
        return get() >= MAX;
    }

    function getDiamonds() {
        const profile = loadProfile();
        return clampDiamonds(profile.diamonds);
    }

    function costFor(hearts = 1) {
        return Math.max(0, Math.floor(hearts)) * COST_PER_HEART;
    }

    function canAfford(hearts = 1) {
        const needed = costFor(hearts);
        return getDiamonds() >= needed;
    }

    // FIX: buying now works when hearts = 0
    function buy(heartsToBuy = 1) {
        const profile = loadProfile();
        profile.hearts = clampHearts(profile.hearts);
        profile.diamonds = clampDiamonds(profile.diamonds);

        const missing = MAX - profile.hearts;
        if (missing <= 0) {
            return {
                ok: false,
                heartsAdded: 0,
                diamondsSpent: 0,
                message: 'Your hearts are already full.'
            };
        }

        const toAdd = Math.min(Math.max(1, Math.floor(heartsToBuy)), missing);
        const cost = toAdd * COST_PER_HEART;

        if (profile.diamonds < cost) {
            const short = cost - profile.diamonds;
            return {
                ok: false,
                heartsAdded: 0,
                diamondsSpent: 0,
                message: `You need ${short} more 💎 to buy ${toAdd} heart${toAdd === 1 ? '' : 's'}.`
            };
        }

        profile.diamonds -= cost;
        profile.hearts += toAdd;

        if (profile.hearts >= MAX) {
            delete profile.heartRefillAt;
        } else if (!profile.heartRefillAt) {
            profile.heartRefillAt = Date.now() + REFILL_INTERVAL_MS;
        }

        saveProfile(profile);

        return {
            ok: true,
            heartsAdded: toAdd,
            diamondsSpent: cost,
            message: `Bought ${toAdd} heart${toAdd === 1 ? '' : 's'} for ${cost} 💎.`
        };
    }

    // Deduct hearts (for wrong answers in lessons)
    function deduct(count = 1) {
        const profile = loadProfile();
        profile.hearts = clampHearts(profile.hearts);

        if (profile.hearts <= 0) {
            return { changed: false, hearts: 0, outOfHearts: true };
        }

        const toRemove = Math.min(Math.max(1, Math.floor(count)), profile.hearts);
        profile.hearts -= toRemove;

        // Start refill timer on first heart lost
        if (!profile.heartRefillAt && profile.hearts < MAX) {
            profile.heartRefillAt = Date.now() + REFILL_INTERVAL_MS;
        }

        saveProfile(profile);

        return {
            changed: true,
            hearts: profile.hearts,
            outOfHearts: profile.hearts === 0
        };
    }

    // Auto-refill based on elapsed time
    function refill(now = Date.now()) {
        const profile = loadProfile();
        profile.hearts = clampHearts(profile.hearts);

        if (profile.hearts >= MAX) {
            delete profile.heartRefillAt;
            saveProfile(profile);
            return { changed: false, hearts: MAX, nextRefillAt: null };
        }

        const refillAt = Number(profile.heartRefillAt);
        if (!Number.isFinite(refillAt) || refillAt <= 0) {
            profile.heartRefillAt = now + REFILL_INTERVAL_MS;
            saveProfile(profile);
            return { changed: false, hearts: profile.hearts, nextRefillAt: profile.heartRefillAt };
        }

        if (now < refillAt) {
            return { changed: false, hearts: profile.hearts, nextRefillAt: refillAt };
        }

        // How many intervals elapsed?
        const elapsed = now - refillAt;
        const heartsToAdd = Math.floor(elapsed / REFILL_INTERVAL_MS) + 1;
        const newHearts = Math.min(MAX, profile.hearts + heartsToAdd);

        profile.hearts = newHearts;

        if (profile.hearts >= MAX) {
            delete profile.heartRefillAt;
        } else {
            profile.heartRefillAt = refillAt + heartsToAdd * REFILL_INTERVAL_MS;
        }

        saveProfile(profile);

        return {
            changed: true,
            hearts: profile.hearts,
            nextRefillAt: profile.heartRefillAt || null
        };
    }

    // Reload from localStorage (for storage event sync)
    function sync() {
        refill();
        return get();
    }

    function getRefillSecondsLeft(now = Date.now()) {
        const profile = loadProfile();
        if (clampHearts(profile.hearts) >= MAX) return 0;
        const refillAt = Number(profile.heartRefillAt);
        if (!Number.isFinite(refillAt) || refillAt <= 0) return 0;
        return Math.max(0, Math.ceil((refillAt - now) / 1000));
    }

    return {
        MAX,
        REFILL_INTERVAL_MS,
        COST_PER_HEART,
        get,
        getMax,
        isOut,
        isFull,
        getDiamonds,
        costFor,
        canAfford,
        buy,
        deduct,
        refill,
        sync,
        getRefillSecondsLeft
    };
})();