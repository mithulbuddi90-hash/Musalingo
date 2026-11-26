/* ============================================================
   Musalingo — dashboard.js
   Dashboard + the old course view in one file:
     • continuous, scrollable learning path across every section
     • sticky pink section header that follows the scroll (colour + label)
     • guidebook button, section link, up-next / jump panels
     • tap-a-node popover ("Start +20 XP" / "Practice +5 XP")
     • experience skip + jump-state restore (from sections.html)
   ============================================================ */

const HEART_CAP = 5;

// ── FIX: safeParse wrapper ──
function safeParse(key, fallback) {
    try {
        const raw = localStorage.getItem(key);
        if (!raw) return fallback;
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === 'object' ? parsed : fallback;
    } catch (err) {
        console.warn(`[dashboard] Corrupted localStorage for ${key}; using defaults.`, err);
        return fallback;
    }
}

// ── FIX: settings declared at top, full defaults ──
const settings = safeParse('MusalingoSettings', {
    theme: 'light',
    noGamification: false,
    noHearts: false,
    noStreaks: false,
    noLeaderboards: false
});

if (settings.theme === 'dark') {
    document.body.classList.add('dark-mode');
}

// ── PROFILE ──
const defaultProfile = {
    streak: 0, diamonds: 100, hearts: 5, xp: 0, courses: [], activeCourseId: null,
    dailyQuestDate: null,
    dailyQuestProgress: { xp: 0, lessons: 0, practice: 0, accuracy: 0, streak: 0 }
};

const storedProfile = safeParse('MusalingoProfile', defaultProfile);
let profile = storedProfile && typeof storedProfile === 'object' && !Array.isArray(storedProfile)
    ? { ...defaultProfile, ...storedProfile }
    : { ...defaultProfile };

if (!Array.isArray(profile.courses)) profile.courses = [];
else profile.courses = profile.courses.filter(c => c && typeof c === 'object');

if (!profile.dailyQuestProgress || typeof profile.dailyQuestProgress !== 'object') {
    profile.dailyQuestProgress = { xp: 0, lessons: 0, practice: 0, accuracy: 0, streak: 0 };
}

// ── ACTIVE COURSE ──
const urlParams = new URLSearchParams(window.location.search);

// ── SECTION / UNIT OVERRIDES (read BEFORE the query string is stripped below) ──
let sectionOverride = Number(urlParams.get('section')) || null;
let urlUnitOverride = Number(urlParams.get('unit')) || null;

const requestedCourseId = urlParams.get('courseId');
let activeCourse = null;

if (requestedCourseId) {
    activeCourse = profile.courses.find(c => c.id === requestedCourseId);
    if (activeCourse) {
        profile.activeCourseId = requestedCourseId;
        try { localStorage.setItem('MusalingoProfile', JSON.stringify(profile)); } catch { }
        window.history.replaceState({}, document.title, window.location.pathname);
    }
}

if (!activeCourse && profile.activeCourseId) {
    activeCourse = profile.courses.find(c => c.id === profile.activeCourseId);
}

if (!activeCourse && profile.courses.length > 0) {
    activeCourse = profile.courses[0];
    profile.activeCourseId = activeCourse.id;
    try { localStorage.setItem('MusalingoProfile', JSON.stringify(profile)); } catch { }
}

// ── RESTORE JUMP STATE FROM SESSION (written by sections.html) ──
if (activeCourse && !sectionOverride && !urlUnitOverride) {
    try {
        const raw = sessionStorage.getItem('MusalingoJumpState');
        if (raw) {
            const jump = JSON.parse(raw);
            const age = Date.now() - (jump.at || 0);
            const MAX_AGE = 30 * 60 * 1000; // 30 minutes
            if (jump.courseId === activeCourse.id && age < MAX_AGE) {
                if (jump.section) sectionOverride = jump.section;
                if (jump.unit) urlUnitOverride = jump.unit;
            }
        }
    } catch (e) { console.warn('[dashboard] jump restore failed:', e); }
}

// ── HELPERS ──
function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, c => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
    }[c]));
}

function refreshActiveCourseLessons() {
    if (!activeCourse) return;
    const C = window.MUSALINGO_CURRICULUM;
    if (!C || typeof C.getCourseLessons !== 'function') return;
    try {
        activeCourse.lessons = Array.isArray(activeCourse.lessons) ? activeCourse.lessons : [];
        const fresh = C.getCourseLessons(
            activeCourse.id,
            activeCourse.lessons,
            activeCourse.learningProfile?.experience
        );
        activeCourse.lessons = fresh;
        const idx = profile.courses.findIndex(c => c.id === activeCourse.id);
        if (idx >= 0) {
            profile.courses[idx] = activeCourse;
            try { localStorage.setItem('MusalingoProfile', JSON.stringify(profile)); } catch { }
        }
    } catch (e) {
        console.warn('[dashboard] Could not refresh lessons:', e);
    }
}

// ── COURSE SWITCHER ──
const courseTrigger = document.getElementById('courseTrigger');
const courseDropdown = document.getElementById('courseDropdown');

function toggleCourseDropdown(e) {
    e.stopPropagation();
    const isOpen = courseDropdown.classList.contains('open');
    if (isOpen) {
        courseDropdown.classList.remove('open');
        courseTrigger.classList.remove('active');
    } else {
        renderCourseDropdown();
        courseDropdown.classList.add('open');
        courseTrigger.classList.add('active');
    }
}

function renderCourseDropdown() {
    const list = document.getElementById('dropdownCourseList');
    const iconDisplay = document.getElementById('currentCourseIcon');
    if (!list || !iconDisplay) return;

    if (!activeCourse) {
        iconDisplay.textContent = '❓';
        list.innerHTML = `<div style="padding:16px;color:var(--muted);font-size:0.9rem;text-align:center;">No courses added.</div>`;
        return;
    }

    const C = window.MUSALINGO_CURRICULUM;
    iconDisplay.textContent = (C?.courses?.[activeCourse.id]?.icon) || '📘';

    if (profile.courses.length === 0) {
        list.innerHTML = `<div style="padding:16px;color:var(--muted);font-size:0.9rem;text-align:center;">No courses added.</div>`;
        return;
    }

    list.innerHTML = profile.courses.map(c => {
        const isActive = activeCourse && c.id === activeCourse.id;
        const icon = (C?.courses?.[c.id]?.icon) || '📘';
        const name = String(c.name || c.id || 'Course');
        return `
            <div class="course-item ${isActive ? 'active' : ''}" data-course-id="${escapeHtml(c.id)}" role="button" tabindex="0">
                <div class="course-item-icon">${escapeHtml(icon)}</div>
                <div>${escapeHtml(name)}</div>
            </div>
        `;
    }).join('');

    // FIX: use event listeners, not inline onclick
    list.querySelectorAll('.course-item').forEach(item => {
        item.addEventListener('click', () => {
            const id = item.dataset.courseId;
            if (id) switchCourse(id);
        });
    });
}

function switchCourse(courseId) {
    profile.activeCourseId = courseId;
    try { localStorage.setItem('MusalingoProfile', JSON.stringify(profile)); } catch { }
    window.location.reload();
}

courseTrigger.addEventListener('click', toggleCourseDropdown);

document.addEventListener('click', (e) => {
    const wrap = document.querySelector('.course-switcher-wrap');
    if (wrap && !wrap.contains(e.target)) {
        courseDropdown.classList.remove('open');
        courseTrigger.classList.remove('active');
    }
});

// ── NAV ──
function updateSidebarNav() {
    const navItem = document.getElementById('dynamicNavItem');
    const navIcon = document.getElementById('dynamicNavIcon');
    const navText = document.getElementById('dynamicNavText');
    if (!navItem) return;

    if (!activeCourse) {
        navItem.style.display = 'none';
        return;
    }
    navItem.style.display = 'flex';

    if (activeCourse.id === 'chess') {
        navText.textContent = 'Matches';
        navIcon.textContent = '⚔️';
        navItem.href = 'matches.html';
        return;
    }

    const latinLanguages = ['spanish', 'french', 'german', 'italian', 'english', 'portuguese', 'dutch', 'latin', 'swahili'];
    const isLatin = latinLanguages.includes(activeCourse.id);

    if (isLatin) {
        navText.textContent = 'Sounds';
        navIcon.textContent = '🎧';
        navItem.href = 'coming-soon.html?feature=sounds';
    } else {
        navText.textContent = 'Letters';
        navIcon.textContent = '🔤';
        navItem.href = 'coming-soon.html?feature=letters';
    }
}

// ── STATS ──
function refreshHearts() {
    const hearts = Number(profile.hearts);
    profile.hearts = Number.isFinite(hearts) ? Math.max(0, Math.min(HEART_CAP, Math.floor(hearts))) : HEART_CAP;
}

function renderStats() {
    // FIX: use Hearts.refill() so elapsed timer refills work
    if (window.Hearts) {
        Hearts.refill();
        profile.hearts = Hearts.get();
    } else {
        refreshHearts();
    }

    document.getElementById('streakLink').textContent = profile.streak || 0;
    document.getElementById('diamondLink').textContent = profile.diamonds;
    document.getElementById('heartLink').textContent = profile.hearts;

    const heartPill = document.getElementById('heartPill');
    if (heartPill) {
        heartPill.classList.toggle('low', profile.hearts <= 1);
    }

    const streakPill = document.getElementById('streakPill');
    if (streakPill) {
        streakPill.classList.toggle('active', (profile.streak || 0) > 0);
    }
}

// ── NAV CLICKS ──
document.getElementById('streakPill').addEventListener('click', () => {
    if (typeof SFX !== 'undefined') SFX.click();
    window.location.href = 'streak.html';
});
document.getElementById('diamondPill').addEventListener('click', () => {
    if (typeof SFX !== 'undefined') SFX.click();
    window.location.href = 'shop.html';
});
document.getElementById('heartPill').addEventListener('click', () => {
    if (typeof SFX !== 'undefined') SFX.click();
    window.location.href = 'shop.html';
});

// ── QUESTS ──
function renderDashboardQuests() {
    const container = document.getElementById('dashboardQuestList');
    if (!container) return;

    if (!window.MUSALINGO_QUESTS) {
        container.innerHTML = '<div style="color:var(--muted);text-align:center;padding:10px;">Quest system loading...</div>';
        return;
    }

    if (!settings.noGamification) {
        try {
            window.MUSALINGO_QUESTS.grantDailyRewards(profile);
        } catch (err) {
            console.warn('[dashboard] grantDailyRewards failed:', err);
        }
        renderStats();
    }

    let quests;
    try {
        quests = window.MUSALINGO_QUESTS.getDailyQuests(profile);
    } catch (err) {
        console.warn('[dashboard] getDailyQuests failed:', err);
        container.innerHTML = '<div style="color:var(--muted);text-align:center;padding:10px;">Could not load quests.</div>';
        return;
    }

    container.innerHTML = quests.map(q => {
        let pct = (q.current / q.max) * 100;
        if (pct > 100) pct = 100;

        const displayText = q.isComplete ? '✓ Done' : `${Math.floor(q.current)}/${q.max}`;
        const titleText = q.isComplete ? `<s>${escapeHtml(q.title)}</s>` : escapeHtml(q.title);

        return `
            <div class="quest-row">
                <div class="quest-icon">${escapeHtml(q.icon || '🎯')}</div>
                <div class="quest-info">
                    <strong>${titleText}</strong>
                    <div class="quest-bar">
                        <div class="quest-fill" style="width: ${pct}%">
                            <span>${displayText}</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// ── PALETTE (shared with the old course view) ──
const PINK = { main: '#EC96C7', dark: '#C46AA1' };

const SECTION_PALETTE = {
    1: PINK,
    2: { main: '#1cb0f6', dark: '#1587bd' },
    3: { main: '#8d6de7', dark: '#6a4fbf' },
    4: { main: '#ff9600', dark: '#c97400' },
    5: { main: '#ff4b4b', dark: '#cc2f2f' },
    6: { main: '#00c2a8', dark: '#009282' },
    7: { main: '#58cc02', dark: '#3d8c01' },
    8: { main: '#5b6cff', dark: '#3e4bc7' }
};
const DEFAULT_PALETTE = PINK;
const MAX_SECTIONS = 7;
const GUIDEBOOK_HIDDEN_COURSES = ['chess', 'math', 'music'];

function shiftColor(hex, amount) {
    const c = hex.replace('#', '');
    const r = parseInt(c.slice(0, 2), 16);
    const g = parseInt(c.slice(2, 4), 16);
    const b = parseInt(c.slice(4, 6), 16);
    const adjust = v => Math.max(0, Math.min(255, Math.round(v * (1 + amount))));
    return '#' +
        adjust(r).toString(16).padStart(2, '0') +
        adjust(g).toString(16).padStart(2, '0') +
        adjust(b).toString(16).padStart(2, '0');
}

function getCoursePalette(sectionNo, unitNo, courseIdOverride = activeCourse && activeCourse.id) {
    // Prefer the palette that lives in course-curriculum.js so colours match everywhere.
    const shared = window.MUSALINGO_CURRICULUM?.getCoursePalette;
    if (typeof shared === 'function') {
        try { return shared(sectionNo, unitNo, courseIdOverride); }
        catch (err) { console.warn('[dashboard] getCoursePalette failed:', err); }
    }
    const main = SECTION_PALETTE[Number(sectionNo) || 1]?.main || DEFAULT_PALETTE.main;
    return { main, dark: shiftColor(main, -0.18) };
}

function getUnitName(sectionIndex, unitIndex) {
    const topics = window.MUSALINGO_CURRICULUM
        ?.getCourseUnitTopics?.(activeCourse.id, activeCourse.learningProfile?.experience)?.[sectionIndex];
    return topics?.[unitIndex] || `Unit ${unitIndex + 1}`;
}

// ── DOM REFS FOR THE STICKY HEADER ──
const sectionHeader = document.getElementById('sectionHeader');
const sectionHeaderLink = document.getElementById('sectionHeaderLink');
const sectionHeaderLabel = document.getElementById('sectionHeaderLabel');
const sectionHeaderTitle = document.getElementById('sectionHeaderTitle');
const guidebookBtn = document.getElementById('guidebookBtn');
const allSectionsBtn = document.getElementById('allSectionsBtn');
const progressTrack = document.getElementById('courseProgress');
const progressBar = document.getElementById('courseProgressBar');

// Colours the sticky header only. (Course view used to retint the whole page via
// --accent; here that would recolour the sidebar, FAB and nav while scrolling.)
function applyHeaderColor(sectionNo, unitNo) {
    const { main, dark } = getCoursePalette(sectionNo, unitNo, activeCourse.id);
    sectionHeader.style.setProperty('--header-main', main);
    sectionHeader.style.setProperty('--header-dark', dark);
    sectionHeader.style.background = `linear-gradient(180deg, ${main}, ${dark})`;
    const shadow = /^#[0-9a-f]{6}$/i.test(settings.shadow || '') ? settings.shadow : dark;
    sectionHeader.style.boxShadow = `0 10px 24px rgba(0, 0, 0, 0.12), 0 4px 0 ${shadow}`;
}

function sectionsUrlFor(sectionIndex) {
    return `sections.html?courseId=${encodeURIComponent(activeCourse.id)}&section=${sectionIndex + 1}`;
}

function guidebookUrlFor(sectionIndex) {
    return `guidebook.html?courseId=${encodeURIComponent(activeCourse.id)}&section=${sectionIndex + 1}`;
}

let headerSectionIdx = 0;
let headerKey = '';

function setHeaderToUnit(sectionIdx, unitIdx) {
    if (!activeCourse) return;
    const key = `${sectionIdx}:${unitIdx}`;
    if (key === headerKey) return;
    headerKey = key;
    headerSectionIdx = sectionIdx;

    sectionHeaderLabel.textContent = `SECTION ${sectionIdx + 1}, UNIT ${unitIdx + 1}`;
    sectionHeaderTitle.textContent = getUnitName(sectionIdx, unitIdx);
    sectionHeaderLink.href = sectionsUrlFor(sectionIdx);
    if (allSectionsBtn) allSectionsBtn.href = sectionsUrlFor(sectionIdx);
    applyHeaderColor(sectionIdx + 1, unitIdx + 1);
}

if (guidebookBtn) {
    guidebookBtn.addEventListener('click', () => {
        if (!activeCourse) return;
        if (typeof SFX !== 'undefined') SFX.click();
        window.location.href = guidebookUrlFor(headerSectionIdx);
    });
}

// ── PERSIST THE ACTIVE COURSE WITHOUT CLOBBERING OTHER WRITERS ──
function persistActiveCourse() {
    if (!activeCourse) return;
    const stored = safeParse('MusalingoProfile', null);
    if (!stored || !Array.isArray(stored.courses)) return;
    const idx = stored.courses.findIndex(c => c && c.id === activeCourse.id);
    if (idx < 0) return;
    stored.courses[idx] = activeCourse;
    try { localStorage.setItem('MusalingoProfile', JSON.stringify(stored)); } catch { }
}

// ── EXPERIENCE SKIP ──
// A learner who says they already know some of the language starts further into SECTION 1.
// Later sections always start from their first unit.
function applyExperienceSkip(courseObj, sectionIndex) {
    const jumpByExperience = { some: 2, comfortable: 4, advanced: 6 };
    const jumpToUnit = jumpByExperience[courseObj.learningProfile?.experience] || 0;
    if (jumpToUnit <= 0 || sectionIndex !== 0) return 0;

    let lessonsMarked = 0;
    for (const lesson of courseObj.lessons) {
        const lessonUnit = lesson.displayUnitIndex ?? lesson.unitIndex ?? 0;
        if ((lesson.sectionIndex ?? 0) === sectionIndex && lessonUnit < jumpToUnit && !lesson.completed) {
            lesson.completed = true;
            lessonsMarked++;
        }
    }
    if (lessonsMarked > 0) persistActiveCourse();
    return lessonsMarked;
}

// ── POPOVER MARKUP (titles/hrefs escaped: they come from saved data) ──
function popoverMarkup(state, isSkipped, nodeTitle, href) {
    const safeTitle = escapeHtml(nodeTitle);
    const safeHref = escapeHtml(href);
    const heading = `<h3 class="node-popover-title">${safeTitle}</h3>`;
    if (isSkipped) return `${heading}<a class="node-popover-btn practice" href="${safeHref}">Practice +5 XP</a>`;
    if (state === 'locked') return `${heading}<p class="node-popover-message">Complete all levels above to unlock this!</p><button class="node-popover-btn locked" disabled>Locked</button>`;
    if (state === 'jump') return `${heading}<p class="node-popover-message">Skip ahead — tested on everything so far.</p><a class="node-popover-btn primary" href="${safeHref}">Jump +20 XP</a>`;
    if (state === 'starting') return `${heading}<a class="node-popover-btn primary" href="${safeHref}">Start +20 XP</a>`;
    return `${heading}<a class="node-popover-btn practice" href="${safeHref}">Practice +5 XP</a>`;
}

function chessLevelOf(lessonId) {
    return String(lessonId).includes('c1') ? 1 : String(lessonId).includes('c2') ? 2 : 3;
}

// ── PATH STATE (shared by scroll sync, popover and trail) ──
let scrollMarkers = [];
let initialScrollDone = false;
let viewedSectionIdx = null;   // which section is currently drawn (null = pick automatically)
let pathPopover = null;
let popoverNode = null;
let pathInteractionsBound = false;

// ── PATH RENDERER ──
function renderDashboardPath() {
    const pathContainer = document.getElementById('dashboardPath');
    if (!pathContainer) return;
    const C = window.MUSALINGO_CURRICULUM;

    if (!activeCourse) {
        sectionHeader.hidden = true;
        progressTrack.hidden = true;
        pathContainer.innerHTML = `<div class="path-empty">Add a course to start learning!<br><br><a class="path-empty-btn" href="catalog.html">Browse Courses</a></div>`;
        return;
    }

    if (!C || typeof C.buildDisplayLessons !== 'function') {
        sectionHeader.hidden = true;
        progressTrack.hidden = true;
        pathContainer.innerHTML = `<div class="path-empty">Curriculum is loading. Reload the page.<br><br><a class="path-empty-btn" href="javascript:location.reload()">Reload</a></div>`;
        return;
    }

    activeCourse.lessons = Array.isArray(activeCourse.lessons) ? activeCourse.lessons : [];
    applyExperienceSkip(activeCourse, 0);

    const isChess = activeCourse.id === 'chess';

    // ---------- BUILD EVERY SECTION ----------
    const sections = [];
    for (let s = 0; s < MAX_SECTIONS; s++) {
        let displaySet;
        try { displaySet = C.buildDisplayLessons(activeCourse.lessons, activeCourse.id, s); }
        catch (err) { console.warn(`[dashboard] buildDisplayLessons failed for section ${s + 1}:`, err); continue; }
        if (!displaySet || !Array.isArray(displaySet.lessons) || displaySet.lessons.length === 0) continue;

        // De-duplicate tests per unit (shallow copies so session-only flags never leak into saved data)
        const seenTests = new Set();
        const lessons = displaySet.lessons
            .map(l => ({ ...l }))
            .reverse()
            .filter(lesson => {
                if (!lesson.isTest) return true;
                const key = `${lesson.displayUnitIndex}`;
                if (seenTests.has(key)) return false;
                seenTests.add(key);
                return true;
            })
            .reverse();

        const unitIndices = [...new Set(lessons.map(l => l.displayUnitIndex))].sort((a, b) => a - b);
        sections.push({ index: s, lessons, unitIndices, totalUnits: displaySet.totalUnits });
    }

    if (sections.length === 0) {
        sectionHeader.hidden = true;
        progressTrack.hidden = true;
        pathContainer.innerHTML = `<div class="path-empty">No lessons found for this course yet.</div>`;
        return;
    }

    // ---------- MARK SKIPPED LESSONS (session-only, from sections.html jump) ----------
    const targetSectionIdx = sectionOverride ? sectionOverride - 1 : 0;
    const targetUnitIdx = urlUnitOverride ? urlUnitOverride - 1 : 0;
    if (targetSectionIdx > 0 || targetUnitIdx > 0) {
        for (const sec of sections) {
            for (const l of sec.lessons) {
                if (l.isJump || l.completed) continue;
                const lUnit = (l.displayUnitIndex != null) ? l.displayUnitIndex : (l.unitIndex ?? 0);
                const isBefore = sec.index < targetSectionIdx ||
                    (sec.index === targetSectionIdx && lUnit < targetUnitIdx);
                if (isBefore) l.skipped = true;
            }
        }
        try { sessionStorage.removeItem('MusalingoJumpState'); } catch { /* storage unavailable */ }
    }

    // ---------- WHICH SECTION IS ON SCREEN (one at a time, like the old course view) ----------
    // 1) the section the learner navigated to, 2) ?section= / jump state, 3) first section with unfinished lessons
    let viewedPos = -1;
    if (viewedSectionIdx !== null) viewedPos = sections.findIndex(s => s.index === viewedSectionIdx);
    if (viewedPos < 0 && sectionOverride) viewedPos = sections.findIndex(s => s.index === sectionOverride - 1);
    if (viewedPos < 0) viewedPos = sections.findIndex(sec => sec.lessons.some(l => !l.isJump && !l.completed && !l.skipped));
    if (viewedPos < 0) viewedPos = sections.length - 1;
    viewedSectionIdx = sections[viewedPos].index;

    // ---------- "START HERE" LESSON (first unfinished lesson of the visible section) ----------
    const viewed = sections[viewedPos];
    let startingLesson = null;
    let startSectionIdx = viewed.index;
    let startUnitIdx = viewed.unitIndices[0] ?? 0;
    for (const l of viewed.lessons) {
        if (l.isJump || l.completed || l.skipped) continue;
        startingLesson = l;
        startUnitIdx = l.displayUnitIndex ?? 0;
        break;
    }
    if (!startingLesson) startUnitIdx = viewed.unitIndices[viewed.unitIndices.length - 1] ?? 0;

    // ---------- HEADER + PROGRESS ----------
    sectionHeader.hidden = false;
    guidebookBtn.hidden = GUIDEBOOK_HIDDEN_COURSES.includes(activeCourse.id);
    headerKey = '';
    setHeaderToUnit(startSectionIdx, startUnitIdx);

    progressTrack.hidden = false;
    progressBar.style.width = `${Math.max(0, Math.min(100, Number(activeCourse.progress) || 0))}%`;

    // ---------- BUILD PATH ----------
    const pathItems = [];

    [viewed].forEach((sec) => {
        const secPos = viewedPos;
        const sectionIndex = sec.index;
        const { lessons, unitIndices } = sec;

        if (secPos > 0) {
            pathItems.push(`
                <a class="prev-section" href="#" data-goto-section="${sections[secPos - 1].index}">\u2190 Back to Section ${sections[secPos - 1].index + 1}</a>
            `);
        }

        for (const unitIdx of unitIndices) {
            const unitLessons = lessons.filter(l => l.displayUnitIndex === unitIdx);
            const unitNumber = unitIdx + 1;
            const unitPalette = getCoursePalette(sectionIndex + 1, unitNumber, activeCourse.id);
            const anchor = unitIdx === unitIndices[0] ? ` id="section-${sectionIndex + 1}"` : '';

            pathItems.push(`
                <div class="path-unit"${anchor} data-unit="${unitIdx}" data-section="${sectionIndex}"
                     style="--unit-main:${unitPalette.main};--unit-dark:${unitPalette.dark};">
                    <span class="unit-banner">Unit ${unitNumber}</span>
                </div>
            `);

            const unitHasProgress = unitLessons.filter(l => !l.isJump).some(l => l.completed || l.skipped);
            const showJump = unitIdx > 0 && !unitHasProgress;

            const orderedLessons = [...unitLessons].sort((a, b) => {
                const ai = a.isJump ? -1 : (a.lessonInUnit ?? 0);
                const bi = b.isJump ? -1 : (b.lessonInUnit ?? 0);
                return ai - bi;
            });

            orderedLessons.forEach((lesson, iInUnit) => {
                const isJump = !!lesson.isJump;
                if (isJump && !showJump) return;

                const position = iInUnit % 2 === 0 ? 'left' : 'right';
                const isTest = !!lesson.isTest;
                const isSkipped = !!lesson.skipped;
                const displayTitle = lesson.title;

                let state;
                if (isJump) state = 'jump';
                else if (isSkipped || lesson.completed) state = 'completed';
                else if (lesson === startingLesson) state = 'starting';
                else state = 'locked';

                const icon = isJump
                    ? '⏩'
                    : isTest
                        ? '🏆'
                        : (C.getLessonIcon ? C.getLessonIcon(activeCourse.id, lesson, iInUnit) : '★');

                const nodeClasses = [
                    'lesson-node',
                    isJump ? 'jump-node' : '',
                    isTest && !isJump ? 'trophy' : '',
                    state === 'completed' ? 'done' : '',
                    state === 'locked' ? 'locked' : '',
                    state === 'starting' ? 'starting' : '',
                    isSkipped ? 'skipped' : ''
                ].filter(Boolean).join(' ');

                let lessonHref;
                if (isJump) {
                    const prevUnitLessons = lessons.filter(l => l.displayUnitIndex === unitIdx - 1);
                    const prevTest = [...prevUnitLessons].reverse().find(l => l.isTest)
                        || prevUnitLessons[prevUnitLessons.length - 1]
                        || lesson;
                    lessonHref =
                        `lesson.html?courseId=${encodeURIComponent(activeCourse.id)}` +
                        `&lessonId=${encodeURIComponent(prevTest.id)}` +
                        `&section=${sectionIndex + 1}` +
                        `&unit=${unitNumber}` +
                        `${isChess ? `&level=${chessLevelOf(prevTest.id)}` : ''}` +
                        `&combine=1`;
                } else {
                    lessonHref =
                        `lesson.html?courseId=${encodeURIComponent(activeCourse.id)}` +
                        `&lessonId=${encodeURIComponent(lesson.id)}` +
                        `${lesson.completed && !isSkipped ? '&review=1' : ''}` +
                        `${isChess ? `&level=${chessLevelOf(lesson.id)}` : ''}` +
                        `&section=${sectionIndex + 1}&unit=${unitNumber}`;
                }

                const verb = state === 'completed' ? 'Review' : state === 'starting' ? 'Start' : state === 'jump' ? 'Jump' : 'Locked';

                pathItems.push(`
                    <div class="path-step side-${position}" data-unit="${unitIdx}" data-section="${sectionIndex}"
                         style="--unit-main:${unitPalette.main};--unit-dark:${unitPalette.dark};">
                        <a class="${nodeClasses}"
                           data-state="${state}"
                           data-skipped="${isSkipped ? '1' : '0'}"
                           data-title="${escapeHtml(displayTitle)}"
                           data-href="${escapeHtml(lessonHref)}"
                           aria-label="${verb} ${escapeHtml(displayTitle)}"
                           href="${state === 'locked' ? '#' : escapeHtml(lessonHref)}">
                            ${icon}
                        </a>
                        <div class="lesson-copy">
                            <strong>${escapeHtml(displayTitle)}</strong>
                            ${lesson.description ? `<span>${escapeHtml(lesson.description)}</span>` : ''}
                        </div>
                    </div>
                `);

                // Reward chest
                if (!settings.noGamification && !isTest && !isJump &&
                    (lesson.lessonInUnit + 1) % 3 === 0 && iInUnit < orderedLessons.length - 1) {
                    pathItems.push(`
                        <div class="path-chest" data-unit="${unitIdx}" data-section="${sectionIndex}" aria-label="Reward chest">
                            <span class="chest-icon" aria-hidden="true">🎁</span>
                            <span class="chest-label">Reward chest</span>
                        </div>
                    `);
                }
            });
        }

        // ---------- UP NEXT (end of every section) ----------
        const hasNextSection = secPos < sections.length - 1;
        const nextSectionNumber = hasNextSection ? sections[secPos + 1].index + 1 : sectionIndex + 2;
        const sectionDone = lessons.every(l => l.isJump || l.completed || l.skipped);

        const lastUnitIdx = unitIndices[unitIndices.length - 1];
        const lastUnitLessons = lessons.filter(l => l.displayUnitIndex === lastUnitIdx);
        const lastUnitTest = [...lastUnitLessons].reverse().find(l => l.isTest)
            || lastUnitLessons[lastUnitLessons.length - 1];

        const sectionTestUrl = lastUnitTest
            ? `lesson.html?courseId=${encodeURIComponent(activeCourse.id)}` +
            `&lessonId=${encodeURIComponent(lastUnitTest.id)}` +
            `&section=${sectionIndex + 1}` +
            `&unit=${lastUnitIdx + 1}` +
            `${isChess ? `&level=${chessLevelOf(lastUnitTest.id)}` : ''}` +
            `&combine=1`
            : '#';

        const panelPalette = getCoursePalette(sectionIndex + 1, 1, activeCourse.id);
        const panelStyle = `--next-main:${panelPalette.main};--next-dark:${panelPalette.dark};`;

        // Duolingo rules: the next section opens only when this one is finished.
        // Until then the card offers JUMP (a test that skips ahead) and nothing else.
        if (hasNextSection && sectionDone) {
            pathItems.push(`
                <section class="next-up" aria-label="Next section" style="${panelStyle}">
                    <span class="next-up-badge">UP NEXT</span>
                    <h2>Section ${nextSectionNumber}</h2>
                    <a class="next-up-link" href="#" data-goto-section="${sections[secPos + 1].index}">CONTINUE</a>
                </section>
            `);
        } else if (hasNextSection) {
            pathItems.push(`
                <section class="next-up" aria-label="Jump to next section" style="${panelStyle}">
                    <span class="next-up-badge">UP NEXT</span>
                    <h2>Section ${nextSectionNumber}</h2>
                    <a class="next-up-link jump" href="${escapeHtml(sectionTestUrl)}">JUMP HERE?</a>
                </section>
            `);
        } else if (sectionDone) {
            pathItems.push(`
                <section class="next-up" aria-label="Course complete" style="${panelStyle}">
                    <span class="next-up-badge">COURSE COMPLETE</span>
                    <h2>All sections complete</h2>
                    <a class="next-up-link" href="#" data-scroll-top="1">BACK TO TOP</a>
                </section>
            `);
        }
    });

    pathContainer.innerHTML = `<svg class="path-trail" aria-hidden="true"></svg>${pathItems.join('')}`;
    scrollMarkers = [...pathContainer.querySelectorAll('[data-unit][data-section]')];

    bindPathInteractions(pathContainer);
    requestAnimationFrame(() => {
        drawPathTrail();
        if (!initialScrollDone) {
            initialScrollDone = true;
            scrollToStart(pathContainer, startingLesson, targetSectionIdx, targetUnitIdx);
        }
        updateHeaderFromScroll();
    });
}

// ── SWITCH SECTION IN PLACE (CONTINUE / "Back to Section") ──
function goToSection(sectionIdx) {
    hidePopover();
    viewedSectionIdx = sectionIdx;
    // a ?section=/?unit= jump only applies to the section it was meant for
    sectionOverride = null;
    urlUnitOverride = null;
    initialScrollDone = true;
    renderDashboardPath();
    window.scrollTo(0, 0);
    updateHeaderFromScroll();
}

// ── INITIAL SCROLL: jump target unit, otherwise the "start here" node ──
function scrollToStart(pathContainer, startingLesson, targetSectionIdx, targetUnitIdx) {
    let target = null;
    let block = 'center';
    // only an explicit ?unit= scrolls to that unit's banner; a plain ?section=N (Continue) lands on the current lesson
    if (urlUnitOverride) {
        target = pathContainer.querySelector(`.path-unit[data-section="${targetSectionIdx}"][data-unit="${targetUnitIdx}"]`);
        block = 'start';
    }
    if (!target && startingLesson) target = pathContainer.querySelector('.lesson-node.starting');
    if (!target) return;
    try { target.scrollIntoView({ block, behavior: 'instant' }); }
    catch { target.scrollIntoView(); }
}

// ── TRAIL (one curve per section so it never runs behind the up-next panel) ──
function drawPathTrail() {
    const pathContainer = document.getElementById('dashboardPath');
    const svg = pathContainer && pathContainer.querySelector('.path-trail');
    if (!svg) return;

    const bounds = pathContainer.getBoundingClientRect();
    const groups = new Map();
    pathContainer.querySelectorAll('.lesson-node, .chest-icon').forEach(node => {
        const holder = node.closest('[data-section]');
        const key = holder ? holder.dataset.section : '0';
        const nb = node.getBoundingClientRect();
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push({
            x: nb.left + nb.width / 2 - bounds.left,
            y: nb.top + nb.height / 2 - bounds.top
        });
    });

    let pathData = '';
    groups.forEach(points => {
        if (points.length < 2) return;
        pathData += points.reduce((path, point, index) => {
            if (index === 0) return `M ${point.x} ${point.y}`;
            const prev = points[index - 1];
            const controlY = (prev.y + point.y) / 2;
            return `${path} C ${prev.x} ${controlY}, ${point.x} ${controlY}, ${point.x} ${point.y}`;
        }, '') + ' ';
    });

    if (!pathData) { svg.innerHTML = ''; return; }
    svg.setAttribute('viewBox', `0 0 ${bounds.width} ${bounds.height}`);
    svg.innerHTML = `
        <path d="${pathData}" fill="none" stroke="var(--bg)" stroke-width="15" stroke-linecap="round" />
        <path d="${pathData}" fill="none" stroke="var(--border)" stroke-width="8" stroke-linecap="round" />
    `;
}

// ── HEADER FOLLOWS THE SCROLL ──
function updateHeaderFromScroll() {
    if (!activeCourse || !scrollMarkers.length || sectionHeader.hidden) return;

    const probeY = sectionHeader.getBoundingClientRect().bottom + 40;
    let current = scrollMarkers[0];
    for (const marker of scrollMarkers) {
        if (marker.getBoundingClientRect().top > probeY) break;
        current = marker;
    }
    setHeaderToUnit(Number(current.dataset.section) || 0, Number(current.dataset.unit) || 0);
}

// ── NODE POPOVER ("Start +20 XP" / "Practice +5 XP") ──
function ensurePopover() {
    if (pathPopover) return pathPopover;
    pathPopover = document.querySelector('.node-popover');
    if (!pathPopover) {
        pathPopover = document.createElement('div');
        pathPopover.className = 'node-popover';
        pathPopover.hidden = true;
        document.body.appendChild(pathPopover);
    }
    return pathPopover;
}

function hidePopover() {
    if (pathPopover) pathPopover.hidden = true;
    popoverNode = null;
}

function showPopover(nodeEl) {
    const popover = ensurePopover();
    popover.innerHTML = popoverMarkup(
        nodeEl.dataset.state,
        nodeEl.dataset.skipped === '1',
        nodeEl.dataset.title,
        nodeEl.dataset.href
    );
    popover.hidden = false;
    popover.classList.remove('below');
    popoverNode = nodeEl;

    const rect = nodeEl.getBoundingClientRect();
    const pw = popover.offsetWidth;
    const ph = popover.offsetHeight;
    const margin = 12;
    const statsH = (document.querySelector('.top-stats')?.offsetHeight) || 0;
    const centerX = rect.left + rect.width / 2;
    const left = Math.max(pw / 2 + margin, Math.min(window.innerWidth - pw / 2 - margin, centerX));

    const fitsAbove = rect.top - 14 - ph >= statsH + 8;
    popover.classList.toggle('below', !fitsAbove);
    popover.style.left = left + 'px';
    popover.style.top = (fitsAbove ? rect.top - 14 : rect.bottom + 14) + 'px';
    popover.style.setProperty('--arrow-x', (centerX - (left - pw / 2)) + 'px');
}

// ── ONE-TIME EVENT WIRING (delegated, so re-renders never stack listeners) ──
function bindPathInteractions(pathContainer) {
    if (pathInteractionsBound) return;
    pathInteractionsBound = true;
    ensurePopover();

    pathContainer.addEventListener('click', (event) => {
        const scrollTop = event.target.closest('[data-scroll-top]');
        if (scrollTop) {
            event.preventDefault();
            window.scrollTo({ top: 0, behavior: 'smooth' });
            return;
        }
        const gotoSection = event.target.closest('[data-goto-section]');
        if (gotoSection) {
            event.preventDefault();
            if (typeof SFX !== 'undefined') SFX.click();
            goToSection(Number(gotoSection.dataset.gotoSection));
            return;
        }

        const nodeEl = event.target.closest('.lesson-node');
        if (!nodeEl) return;
        event.preventDefault();
        if (typeof SFX !== 'undefined') SFX.click();
        if (popoverNode === nodeEl && !pathPopover.hidden) hidePopover();
        else showPopover(nodeEl);
    });

    document.addEventListener('click', (event) => {
        if (!pathPopover || pathPopover.hidden) return;
        if (!pathPopover.contains(event.target) && !event.target.closest('.lesson-node')) hidePopover();
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') hidePopover();
    });

    let ticking = false;
    window.addEventListener('scroll', () => {
        hidePopover();
        if (ticking) return;
        ticking = true;
        requestAnimationFrame(() => {
            updateHeaderFromScroll();
            ticking = false;
        });
    }, { passive: true });

    if (typeof ResizeObserver === 'function') {
        let trailFrame = 0;
        new ResizeObserver(() => {
            cancelAnimationFrame(trailFrame);
            trailFrame = requestAnimationFrame(() => { drawPathTrail(); hidePopover(); });
        }).observe(pathContainer);
    } else {
        window.addEventListener('resize', drawPathTrail);
    }
}

// ── KEEP THE STICKY HEADER BELOW THE TOP STATS BAR ──
function syncStatsHeight() {
    const bar = document.querySelector('.top-stats');
    if (bar) document.documentElement.style.setProperty('--stats-h', bar.offsetHeight + 'px');
}

// ── FRIEND INVITE BANNER (FIX: hidden by default, timeout) ──
async function initFriendInviteBanner() {
    const banner = document.getElementById('friendInviteBanner');
    if (!banner) return;
    banner.style.display = 'none';

    const uid = localStorage.getItem('MusalingoUid');
    const isGuest = localStorage.getItem('MusalingoGuest') === 'true';
    if (!uid || isGuest) return;

    try {
        const mod = await Promise.race([
            import('./firebase.js'),
            new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 8000))
        ]);
        if (typeof mod.listenToMyChessInvites !== 'function') return;
        mod.listenToMyChessInvites(uid, (invites) => {
            if (Array.isArray(invites) && invites.length > 0) {
                banner.style.display = 'block';
            } else {
                banner.style.display = 'none';
            }
        });
    } catch (err) {
        // Silent — banner stays hidden
    }
}

// ── "ALL SECTIONS" BUTTON (replaces the old "Open full course view") ──
function wireAllSectionsButton() {
    if (!allSectionsBtn) return;
    allSectionsBtn.href = activeCourse ? sectionsUrlFor(headerSectionIdx) : 'catalog.html';
}

// ── STORAGE SYNC ──
window.addEventListener('storage', (e) => {
    if (e.key === 'MusalingoProfile' && e.newValue) {
        try {
            const next = JSON.parse(e.newValue);
            if (next && typeof next === 'object') {
                profile = next;
                if (!Array.isArray(profile.courses)) profile.courses = [];
                if (!profile.dailyQuestProgress) {
                    profile.dailyQuestProgress = { xp: 0, lessons: 0, practice: 0, accuracy: 0, streak: 0 };
                }
                if (profile.activeCourseId) {
                    const match = profile.courses.find(c => c.id === profile.activeCourseId);
                    if (match) activeCourse = match;
                }
                renderStats();
                updateSidebarNav();
                renderDashboardQuests();
                renderDashboardPath();
                renderCourseDropdown();
                wireAllSectionsButton();
            }
        } catch (err) { /* ignore */ }
    }
});

// ── FAB ──
const fabBtn = document.getElementById('fabFormBtn');
if (fabBtn) {
    fabBtn.addEventListener('click', () => {
        if (typeof SFX !== 'undefined') SFX.click();
        window.location.href = 'forms.html';
    });
}

// ── BOOT ──
syncStatsHeight();
refreshActiveCourseLessons();
renderStats();
updateSidebarNav();
renderDashboardQuests();
renderDashboardPath();
renderCourseDropdown();
initFriendInviteBanner();
wireAllSectionsButton();

window.addEventListener('resize', syncStatsHeight);
if (typeof ResizeObserver === 'function') {
    const statsBar = document.querySelector('.top-stats');
    if (statsBar) new ResizeObserver(syncStatsHeight).observe(statsBar);
}

document.querySelectorAll('.nav-item, .course-trigger-btn').forEach(el => {
    el.addEventListener('click', () => { if (typeof SFX !== 'undefined') SFX.click(); });
});