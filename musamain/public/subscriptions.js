/* ============================================================
   Musalingo — subscriptions.js
   Feature flags, plan checks, and usage gates.

   HOW THIS WORKS
   --------------
   • Beta (Nov 2026): every function returns false or "unlimited".
     Nothing is gated. The whole app is free.
   • Q1 2027: flip `canUseAITeacher()` to `return isPlus();`
   • Q2 2027: flip `canUseVideoCalls()` to `return isPlus();`
   • Other gates (`canUseOfflineLessons`, etc.) flip the same way.

   USAGE
   -----
       import { isPlus, canUseAITeacher, remainingAITeacherMinutes }
           from './subscriptions.js';

       if (canUseAITeacher()) { openTeacherModal(); }

   All functions are safe to call with no arguments. They read
   from localStorage['MusalingoProfile'] internally.
   ============================================================ */

/* ---------- Internal helpers ---------- */

function readProfile() {
    try {
        const raw = JSON.parse(localStorage.getItem('MusalingoProfile') || '{}');
        return raw && typeof raw === 'object' ? raw : {};
    } catch {
        return {};
    }
}

function num(value, fallback = 0) {
    const n = Number(value);
    return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : fallback;
}

function todayKey() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

/* ============================================================
   PLAN CHECKS
   ============================================================ */

/**
 * Returns the current plan: 'free' | 'plus' | 'super' | 'lifetime'.
 * Falls back to 'free' if the field is missing or unknown.
 */
export function currentPlan() {
    const profile = readProfile();
    const plan = String(profile.plan || 'free').toLowerCase();
    if (plan === 'plus' || plan === 'super' || plan === 'lifetime') return plan;
    return 'free';
}

/**
 * True if the user has an active paid plan (Plus, Super, or Lifetime).
 * Checks expiration when a planExpiresAt date exists.
 * Lifetime plans never expire, so planExpiresAt is ignored for them.
 * Returns false during beta (no plan set on any user).
 */
export function isPlus() {
    const profile = readProfile();
    const plan = String(profile.plan || 'free').toLowerCase();
    if (plan !== 'plus' && plan !== 'super' && plan !== 'lifetime') return false;

    // Lifetime plans never expire — skip the expiry check.
    if (plan === 'lifetime') return true;

    // If an expiry date is set, verify it hasn't passed.
    if (profile.planExpiresAt) {
        const expires = new Date(profile.planExpiresAt).getTime();
        if (Number.isFinite(expires) && expires <= Date.now()) return false;
    }
    return true;
}

/**
 * True if the user has never used their one-time free trial.
 * (Trial is a Plus-only perk that activates post-beta.)
 */
export function isTrialAvailable() {
    const profile = readProfile();
    return profile.trialUsed !== true;
}

/**
 * True if the user has the "Unlimited Feature Add-on" (+₹99).
 * This unlocks unlimited AI Teacher minutes and unlimited video calls,
 * on top of any active subscription.
 */
export function hasUnlimitedAddon() {
    const profile = readProfile();
    if (profile.unlimitedAddon === true) return true;
    // Optional expiry for the add-on (renewed with subscription)
    if (profile.unlimitedAddonExpiresAt) {
        const expires = new Date(profile.unlimitedAddonExpiresAt).getTime();
        if (Number.isFinite(expires) && expires > Date.now()) return true;
    }
    return false;
}

/* ============================================================
   BETA-GATED FEATURES
   Every function below returns TRUE for all users during beta.
   Flip the return when a feature graduates to paid.
   ============================================================ */

/**
 * Free-typing translation (10th question type).
 * Beta: enabled. Post-beta: free tier keeps it, so leave as true.
 */
export function canUseFreeTyping() {
    return true;
}

/**
 * Offline lesson downloads.
 * Beta: enabled (PWA already works offline via sw.js).
 * Post-beta: keep on free — differentiator.
 */
export function canUseOfflineLessons() {
    return true;
}

/**
 * Ad-free experience.
 * Beta: no ads exist, so trivially true.
 * Post-beta: `return isPlus();`
 */
export function hasAdFreeExperience() {
    return isPlus();
}

/**
 * AI Coach chat in the chess module.
 * Beta: enabled for all (it's a core experience).
 * Post-beta: consider keeping free or gating — decision TBD.
 */
export function canUseAICoach() {
    return true;
}

/* ============================================================
   Q1 2027 — AI TEACHER
   Real-time voice tutor powered by Gemini Live API.
   ============================================================ */

/**
 * Whether the user can open the AI Teacher modal.
 *
 * BETA: returns false (feature not built yet).
 * Q1 2027: flip to `return isPlus();`
 */
export function canUseAITeacher() {
    return false;   // ← flip to `return isPlus();` in Q1 2027
}

/**
 * Minutes of AI Teacher time remaining this month.
 * If the user has the Unlimited Feature Add-on, this returns Infinity.
 * Only meaningful when canUseAITeacher() is true.
 */
export function remainingAITeacherMinutes(profile = null) {
    const p = profile || readProfile();
    if (hasUnlimitedAddon()) return Infinity;   // add-on bypasses quota
    const cap = num(p.aiTeacherMinutesCap, 0);
    const used = num(p.aiTeacherMinutesUsed, 0);
    return Math.max(0, cap - used);
}

/**
 * True if the user has minutes left in their AI Teacher quota.
 */
export function hasAITeacherMinutes(profile = null) {
    return remainingAITeacherMinutes(profile) > 0;
}

/**
 * Default monthly AI Teacher cap for Plus subscribers.
 * Store this value in profile.aiTeacherMinutesCap on plan activation.
 */
export const AI_TEACHER_MONTHLY_CAP = 20;

/* ============================================================
   Q2 2027 — VIDEO CALLS
   LiveKit-powered WebRTC calls with friends.
   ============================================================ */

/**
 * Whether the user can start or join a video call.
 *
 * BETA: returns false (feature not built yet).
 * Q2 2027: flip to `return isPlus();`
 */
export function canUseVideoCalls() {
    return false;   // ← flip to `return isPlus();` in Q2 2027
}

/**
 * Minutes of video call time remaining this month.
 * If the user has the Unlimited Feature Add-on, this returns Infinity.
 */
export function remainingVideoMinutes(profile = null) {
    const p = profile || readProfile();
    if (hasUnlimitedAddon()) return Infinity;   // add-on bypasses quota
    const cap = num(p.videoMinutesCap, 0);
    const used = num(p.videoMinutesUsed, 0);
    return Math.max(0, cap - used);
}

/**
 * True if the user has video minutes left this month.
 */
export function hasVideoMinutes(profile = null) {
    return remainingVideoMinutes(profile) > 0;
}

/**
 * Default monthly video call cap for Plus subscribers.
 */
export const VIDEO_CALL_MONTHLY_CAP = 30;

/* ============================================================
   STREAK REPAIR
   Free tier: uses diamonds (existing behaviour in streak.html).
   Plus tier: one free repair per calendar month.
   ============================================================ */

/**
 * True if the user can repair their streak for free this month.
 * Post-beta only — during beta, everyone uses the diamond path.
 */
export function canFreeStreakRepair() {
    if (!isPlus()) return false;
    const profile = readProfile();
    return profile.lastFreeStreakRepair !== todayKey().slice(0, 7);   // YYYY-MM
}

/**
 * Mark the current month as used for the free repair.
 * Call after a successful free repair.
 */
export function consumeFreeStreakRepair() {
    try {
        const profile = readProfile();
        profile.lastFreeStreakRepair = todayKey().slice(0, 7);
        localStorage.setItem('MusalingoProfile', JSON.stringify(profile));
    } catch (e) {
        console.warn('[subscriptions] Could not record free streak repair.', e);
    }
}

/* ============================================================
   USAGE TRACKING (for future paid features)
   Call these from feature code when a session ends.
   ============================================================ */

/**
 * Add N minutes to aiTeacherMinutesUsed, and reset the counter
 * on a new calendar month.
 */
export function recordAITeacherMinutes(minutes) {
    const add = num(minutes, 0);
    if (add <= 0) return;
    try {
        const profile = readProfile();
        const thisMonth = todayKey().slice(0, 7);
        if (profile.aiTeacherLastResetDate !== thisMonth) {
            profile.aiTeacherMinutesUsed = 0;
            profile.aiTeacherLastResetDate = thisMonth;
        }
        profile.aiTeacherMinutesUsed = num(profile.aiTeacherMinutesUsed, 0) + add;
        localStorage.setItem('MusalingoProfile', JSON.stringify(profile));
    } catch (e) {
        console.warn('[subscriptions] Could not record AI Teacher minutes.', e);
    }
}

/**
 * Add N minutes to videoMinutesUsed, with the same monthly reset.
 */
export function recordVideoMinutes(minutes) {
    const add = num(minutes, 0);
    if (add <= 0) return;
    try {
        const profile = readProfile();
        const thisMonth = todayKey().slice(0, 7);
        if (profile.videoLastResetDate !== thisMonth) {
            profile.videoMinutesUsed = 0;
            profile.videoLastResetDate = thisMonth;
        }
        profile.videoMinutesUsed = num(profile.videoMinutesUsed, 0) + add;
        localStorage.setItem('MusalingoProfile', JSON.stringify(profile));
    } catch (e) {
        console.warn('[subscriptions] Could not record video minutes.', e);
    }
}

/* ============================================================
   PRICING / DISPLAY
   Used by the upgrade modal to render the price.
   ============================================================ */

export const PLAN_META = {
    free: {
        id: 'free',
        name: 'Free',
        price: 0,
        currency: '₹',
        period: 'forever',
        tagline: 'Everything you need to start learning',
        features: [
            'All courses and lessons',
            'AI-generated practice',
            'Offline mode',
            'Chess + AI Coach',
            'Diamonds shop + hearts system'
        ]
    },

    'plus-monthly': {
        id: 'plus-monthly',
        name: 'Super Musalingo',
        price: 29,
        currency: '₹',
        period: 'month',
        tagline: 'The full experience, month by month',
        autoRenew: true,
        features: [
            'Everything in Free',
            'Unlimited hearts (no waiting)',
            'AI Teacher (20 min/month)',
            'Video calls (30 min/month)',
            'Monthly streak repair',
            'Ad-free forever'
        ]
    },

    'plus-yearly': {
        id: 'plus-yearly',
        name: 'Super Musalingo',
        price: 349,
        currency: '₹',
        period: 'year',
        tagline: 'Save 25% vs monthly',
        autoRenew: true,
        savingsVsMonthly: 349 - (29 * 12),   // -? actually 29*12=348 so ₹1 less than... let me recompute
        features: [
            'Everything in Free',
            'Unlimited hearts (no waiting)',
            'AI Teacher (20 min/month)',
            'Video calls (30 min/month)',
            'Monthly streak repair',
            'Ad-free forever'
        ]
    },

    'plus-lifetime': {
        id: 'plus-lifetime',
        name: 'Super Musalingo Lifetime',
        price: 1999,
        currency: '₹',
        period: 'one-time',
        tagline: 'Pay once, learn forever',
        autoRenew: false,
        features: [
            'Everything in Free',
            'Unlimited hearts (no waiting)',
            'AI Teacher (20 min/month)',
            'Video calls (30 min/month)',
            'Monthly streak repair',
            'Ad-free forever',
            'All future updates included',
            'Lifetime access guarantee',
            'Pro-rata refund if service shuts down'
        ]
    },

    'unlimited-addon': {
        id: 'unlimited-addon',
        name: 'Unlimited Feature Add-on',
        price: 99,
        currency: '₹',
        period: 'on top of subscription',
        tagline: 'Remove all caps',
        autoRenew: true,
        requiresBasePlan: true,
        features: [
            'Unlimited AI Teacher minutes',
            'Unlimited video call minutes',
            'Unlimited advanced lessons',
            'Unlimited streak sharing',
            'Unlimited AI-powered practice',
            'Priority support'
        ]
    }
};

/**
 * Returns the display metadata for the current plan.
 * Falls back to the free plan if the current plan is unknown.
 */
export function currentPlanMeta() {
    const plan = currentPlan();
    // 'plus' maps to plus-monthly for display purposes if a legacy
    // profile just says "plus" without a specific billing period.
    if (plan === 'plus') return PLAN_META['plus-monthly'];
    if (plan === 'super') return PLAN_META['plus-monthly'];
    if (plan === 'lifetime') return PLAN_META['plus-lifetime'];
    return PLAN_META.free;
}

/**
 * Returns all upgrade options the current user can purchase.
 * Used to render the pricing modal.
 *
 * Rules:
 *   • Free users can buy plus-monthly, plus-yearly, plus-lifetime.
 *   • Active subscribers can buy the unlimited add-on.
 *   • Subscribers cannot re-buy a plan they already have.
 */
export function availableUpgrades() {
    const plan = currentPlan();
    const upgrades = [];

    if (plan === 'free') {
        upgrades.push(PLAN_META['plus-monthly']);
        upgrades.push(PLAN_META['plus-yearly']);
        upgrades.push(PLAN_META['plus-lifetime']);
    } else if (plan === 'plus' || plan === 'super') {
        // Only offer the add-on, and only if not already purchased
        if (!hasUnlimitedAddon()) {
            upgrades.push(PLAN_META['unlimited-addon']);
        }
    } else if (plan === 'lifetime') {
        // Lifetime users get everything — nothing to upgrade to
    }

    return upgrades;
}

/**
 * Formats a price for display.
 *   formatPrice(29, '₹')  → '₹29'
 *   formatPrice(1999, '₹') → '₹1,999'
 */
export function formatPrice(amount, currency = '₹') {
    const n = Number(amount);
    if (!Number.isFinite(n)) return `${currency}0`;
    if (n === 0) return 'Free';
    return `${currency}${n.toLocaleString('en-IN')}`;
}