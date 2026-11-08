/* ============================================================
   Musalingo — course.js (course node view)
   Fixed: Interview jump logic, double navigation, popover handling.
   ============================================================ */

const savedTheme = JSON.parse(localStorage.getItem('MusalingoSettings') || '{}');
if (savedTheme.theme !== 'light') {
    document.body.classList.toggle('dark-mode', savedTheme.theme === 'dark');
}

// ---------- PALETTE ----------
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

// ---------- PROFILE ----------
function createDefaultProfile() {
    return {
        email: '', name: 'Guest learner', streak: 0, diamonds: 100,
        lastActiveDate: null, lastLessonDate: null, streakStatus: 'inactive',
        selectedCourse: null, courses: [], inventory: []
    };
}
function loadProfile() {
    const s = localStorage.getItem('MusalingoProfile');
    if (!s) return createDefaultProfile();
    try {
        const p = JSON.parse(s);
        if (!p) return createDefaultProfile();
        p.courses = Array.isArray(p.courses) ? p.courses : [];
        p.inventory = Array.isArray(p.inventory) ? p.inventory : [];
        p.diamonds = Number(p.diamonds) || 100;
        return p;
    } catch { return createDefaultProfile(); }
}
function saveProfile(p) { localStorage.setItem('MusalingoProfile', JSON.stringify(p)); }

function escapeAttr(str) {
    return String(str ?? '')
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

// ---------- DOM ----------
const params = new URLSearchParams(window.location.search);
const courseId = params.get('courseId');
let sectionOverride = Number(params.get('section')) || null;
let urlUnitOverride = Number(params.get('unit')) || null;

// ---------- RESTORE JUMP STATE FROM SESSION ----------
if (!sectionOverride && !urlUnitOverride) {
    try {
        const raw = sessionStorage.getItem('MusalingoJumpState');
        if (raw) {
            const jump = JSON.parse(raw);
            const age = Date.now() - (jump.at || 0);
            const MAX_AGE = 30 * 60 * 1000; // 30 minutes
            if (jump.courseId === courseId && age < MAX_AGE) {
                if (jump.section) sectionOverride = jump.section;
                if (jump.unit) urlUnitOverride = jump.unit;
                console.log('[jump restore]', { sectionOverride, urlUnitOverride });
            }
        }
    } catch (e) { console.warn('jump restore failed:', e); }
}

const profile = loadProfile();
const course = profile.courses.find(c => c.id === courseId);
if (course) {
    course.lessons = Array.isArray(course.lessons) ? course.lessons : [];
    // Ensure the course has lessons from curriculum
    if (window.MUSALINGO_CURRICULUM) {
        course.lessons = window.MUSALINGO_CURRICULUM.getCourseLessons(
            course.id,
            course.lessons,
            course.learningProfile?.experience
        );
    }
    saveProfile(profile);
}

const sectionHeader = document.getElementById('sectionHeader');
const sectionHeaderLink = document.getElementById('sectionHeaderLink');
const sectionHeaderLabel = document.getElementById('sectionHeaderLabel');
const sectionHeaderTitle = document.getElementById('sectionHeaderTitle');
const guidebookBtn = document.getElementById('guidebookBtn');
const title = document.getElementById('courseTitle');
const subtitle = document.getElementById('courseSubtitle');
const level = document.getElementById('courseLevel');
const contentArea = document.getElementById('contentArea');

// ---------- GUARD ----------
if (!course) {
    title.textContent = 'Course not found';
    subtitle.textContent = 'Please pick a course from the catalog first.';
    level.textContent = 'Missing';
    contentArea.innerHTML = `
        <div class="empty-state">
            This course isn't in your dashboard yet.
            <a class="btn small" href="catalog.html" style="margin-left:8px;">Browse courses</a>
        </div>`;
} else {
    renderCourse();
}

// ---------- COLOR HELPERS ----------
function getCoursePalette(sectionNo, unitNo, courseIdOverride = courseId) {
    const baseNo = Number(sectionNo) || 1;
    const unitIndex = Number(unitNo) || 1;
    const coursePalette = {
        telugu: ['#f59e0b', '#22c55e', '#3b82f6', '#8b5cf6', '#ef4444', '#06b6d4', '#84cc16', '#f97316'],
        korean: ['#EC96C7', '#1cb0f6', '#8d6de7', '#ff9600', '#ff4b4b', '#00c2a8', '#58cc02', '#5b6cff'],
        japanese: ['#EC96C7', '#1cb0f6', '#8d6de7', '#ff9600', '#ff4b4b', '#00c2a8', '#58cc02', '#5b6cff'],
        spanish: ['#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ef4444', '#14b8a6', '#84cc16', '#ec4899'],
        french: ['#f97316', '#a855f7', '#06b6d4', '#22c55e', '#ef4444', '#f59e0b', '#6366f1', '#ec4899'],
        german: ['#10b981', '#0ea5e9', '#6366f1', '#f97316', '#ef4444', '#14b8a6', '#84cc16', '#ec4899'],
        italian: ['#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#06b6d4', '#84cc16', '#ec4899'],
        hindi: ['#f59e0b', '#22c55e', '#3b82f6', '#8b5cf6', '#ef4444', '#06b6d4', '#84cc16', '#f97316'],
        arabic: ['#0ea5e9', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#ef4444', '#22c55e', '#3b82f6'],
        chess: ['#EC96C7', '#1cb0f6', '#8d6de7', '#ff9600', '#ff4b4b', '#00c2a8', '#58cc02', '#5b6cff'],
        math: ['#ff9600', '#1cb0f6', '#8d6de7', '#58cc02', '#ff4b4b', '#00c2a8', '#5b6cff', '#EC96C7'],
        music: ['#8d6de7', '#1cb0f6', '#EC96C7', '#00c2a8', '#ff9600', '#58cc02', '#5b6cff', '#ff4b4b']
    };

    const genericPalette = Object.values(SECTION_PALETTE).map(c => c.main);
    const colors = coursePalette[courseIdOverride] || genericPalette;
    const main = colors[(unitIndex - 1) % colors.length] || SECTION_PALETTE[baseNo]?.main || DEFAULT_PALETTE.main;
    return { main, dark: shiftColor(main, -0.18) };
}

function applyHeaderColor(sectionNo, unitNo) {
    const palette = getCoursePalette(sectionNo, unitNo, course.id);
    const main = palette.main;
    const dark = palette.dark;

    document.documentElement.style.setProperty('--accent', main);
    document.documentElement.style.setProperty('--accent-dark', dark);
    document.documentElement.style.setProperty('--header-main', main);
    document.documentElement.style.setProperty('--header-dark', dark);

    sectionHeader.style.background = `linear-gradient(180deg, ${main}, ${dark})`;
    const shadow = /^#[0-9a-f]{6}$/i.test(savedTheme.shadow || '') ? savedTheme.shadow : dark;
    sectionHeader.style.boxShadow = `0 10px 24px rgba(0, 0, 0, 0.12), 0 4px 0 ${shadow}`;
}

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

function getUnitName(sectionIndex, unitIndex) {
    const sectionTopics = window.MUSALINGO_CURRICULUM
        .getCourseUnitTopics(course.id, course.learningProfile?.experience)?.[sectionIndex];
    return sectionTopics?.[unitIndex] || `Unit ${unitIndex + 1}`;
}

// ---------- RENDER ----------
function renderCourse() {
    title.textContent = course.name;
    subtitle.textContent = course.description;
    level.textContent = course.level || 'Course';

    const sectionIndex = (sectionOverride || 1) - 1;

    // --- APPLY INTERVIEW EXPERIENCE (Skip ahead) ---
    const experience = course.learningProfile?.experience || 'new';
    let jumpToUnit = 0;
    if (experience === 'some') jumpToUnit = 2;
    else if (experience === 'comfortable') jumpToUnit = 4;
    else if (experience === 'advanced') jumpToUnit = 6;

    if (jumpToUnit > 0) {
        let lessonsMarked = 0;
        for (const lesson of course.lessons) {
            const lessonUnit = lesson.displayUnitIndex ?? lesson.unitIndex ?? 0;
            if ((lesson.sectionIndex ?? 0) === sectionIndex && lessonUnit < jumpToUnit && !lesson.completed) {
                lesson.completed = true;
                lessonsMarked++;
            }
        }
        if (lessonsMarked > 0) {
            const profile = loadProfile();
            const idx = profile.courses.findIndex(c => c.id === course.id);
            if (idx >= 0) {
                profile.courses[idx] = course;
                saveProfile(profile);
            }
        }
    }

    const displaySet = window.MUSALINGO_CURRICULUM.buildDisplayLessons(
        course.lessons, course.id, sectionIndex
    );

    // De-duplicate tests per unit
    const seenTests = new Set();
    const lessons = displaySet.lessons
        .slice()
        .reverse()
        .filter(lesson => {
            if (!lesson.isTest) return true;
            const key = `${lesson.displayUnitIndex}`;
            if (seenTests.has(key)) return false;
            seenTests.add(key);
            return true;
        })
        .reverse();

    const totalUnits = displaySet.totalUnits;

    // ---------- MARK SKIPPED LESSONS (session-only) ----------
    const targetSectionIdx = sectionOverride ? sectionOverride - 1 : 0;
    const targetUnitIdx = urlUnitOverride ? urlUnitOverride - 1 : 0;

    const skipActive = targetSectionIdx > 0 || targetUnitIdx > 0;

    if (skipActive) {
        for (const l of lessons) {
            if (l.isJump) continue;
            if (l.completed) continue;

            const lSection = l.sectionIndex ?? 0;
            const lUnit = (l.displayUnitIndex != null) ? l.displayUnitIndex : (l.unitIndex ?? 0);

            const isBefore = lSection < targetSectionIdx || (lSection === targetSectionIdx && lUnit < targetUnitIdx);

            if (isBefore) l.skipped = true;
        }

        // Consumed — clear so it doesn't persist forever
        sessionStorage.removeItem('MusalingoJumpState');
    }

    // ---------- CURRENT UNIT ----------
    const unitIndices = [...new Set(lessons.map(l => l.displayUnitIndex))].sort((a, b) => a - b);

    let currentUnitIdx;
    for (const u of unitIndices) {
        const unitLessons = lessons.filter(l => l.displayUnitIndex === u && !l.isJump);
        if (unitLessons.some(l => !l.completed && !l.skipped)) {
            currentUnitIdx = u;
            break;
        }
    }

    const sectionComplete = currentUnitIdx === undefined;

    // ---------- HEADER ----------
    const headerUnitIdx = sectionComplete ? totalUnits - 1 : currentUnitIdx;
    const headerUnitNumber = headerUnitIdx + 1;
    sectionHeaderLabel.textContent = `SECTION ${sectionIndex + 1}, UNIT ${headerUnitNumber}`;
    sectionHeaderTitle.textContent = getUnitName(sectionIndex, headerUnitIdx);
    applyHeaderColor(sectionIndex + 1, headerUnitNumber);

    const sectionUrl = `sections.html?courseId=${encodeURIComponent(course.id)}&section=${sectionIndex + 1}`;
    sectionHeaderLink.href = sectionUrl;
    
    // FIXED: Only allow the <a> tag to handle navigation. 
    // Do NOT add sectionHeader.onclick.

    const hideGuidebook = ['chess', 'math', 'music'].includes(course.id);
    if (hideGuidebook) {
        guidebookBtn.style.display = 'none';
    } else {
        guidebookBtn.onclick = () => {
            window.location.href =
                `guidebook.html?courseId=${encodeURIComponent(course.id)}&section=${sectionIndex + 1}`;
        };
    }

    const topbar = document.querySelector('.topbar');
    if (topbar) topbar.style.display = 'none';

    const isChess = course.id === 'chess';

    // ---------- BUILD PATH ----------
    const pathItems = [];

    let startingLessonId = null;
    for (const l of lessons) {
        if (l.isJump) continue;
        if (l.completed) continue;
        if (l.skipped) continue;
        startingLessonId = l.id;
        break;
    }

    // Loop over units
    for (const unitIdx of unitIndices) {
        const unitLessons = lessons.filter(l => l.displayUnitIndex === unitIdx);
        const unitNumber = unitIdx + 1;
        const unitPalette = getCoursePalette(sectionIndex + 1, unitNumber, course.id);

        // Banner
        pathItems.push(`
            <div class="path-unit" id="unit-${unitNumber}" data-unit="${unitIdx}"
                 style="--unit-main:${unitPalette.main};--unit-dark:${unitPalette.dark};">
                <span class="unit-banner">Unit ${unitNumber}</span>
            </div>
        `);

        const unitHasProgress = unitLessons
            .filter(l => !l.isJump)
            .some(l => l.completed || l.skipped);

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
            if (isJump) {
                state = 'jump';
            } else if (isSkipped || lesson.completed) {
                state = 'completed';
            } else if (lesson.id === startingLessonId) {
                state = 'starting';
            } else {
                state = 'locked';
            }

            const icon = isJump
                ? '⏩'
                : isTest
                    ? '🏆'
                    : window.MUSALINGO_CURRICULUM.getLessonIcon(course.id, lesson, iInUnit);

            const nodeClasses = [
                'lesson-node',
                isJump ? 'jump-node' : '',
                isTest && !isJump ? 'trophy' : '',
                state === 'completed' ? 'done' : '',
                state === 'locked' ? 'locked' : '',
                state === 'starting' ? 'starting' : '',
                isSkipped ? 'skipped' : ''
            ].filter(Boolean).join(' ');

            let extra = '';
            if (isChess) {
                const chessLevel = lesson.id.includes('c1') ? 1
                    : lesson.id.includes('c2') ? 2
                        : 3;
                extra = `&level=${chessLevel}`;
            }
            extra += `&section=${sectionIndex + 1}&unit=${unitNumber}`;

            let lessonHref;
            if (isJump) {
                const prevUnitIdx = unitIdx - 1;
                const prevUnitLessons = lessons.filter(l => l.displayUnitIndex === prevUnitIdx);
                const prevTest = [...prevUnitLessons].reverse().find(l => l.isTest)
                    || prevUnitLessons[prevUnitLessons.length - 1];
                const jumpChessLevel = isChess
                    ? (prevTest.id.includes('c1') ? 1 : prevTest.id.includes('c2') ? 2 : 3)
                    : null;

                lessonHref =
                    `lesson.html?courseId=${encodeURIComponent(course.id)}` +
                    `&lessonId=${encodeURIComponent(prevTest.id)}` +
                    `&section=${sectionIndex + 1}` +
                    `&unit=${unitNumber}` +
                    `${isChess ? `&level=${jumpChessLevel}` : ''}` +
                    `&combine=1`;
            } else {
                lessonHref =
                    `lesson.html?courseId=${encodeURIComponent(course.id)}` +
                    `&lessonId=${encodeURIComponent(lesson.id)}` +
                    `${lesson.completed && !isSkipped ? '&review=1' : ''}` +
                    `${extra}`;
            }

            pathItems.push(`
                <div class="path-step side-${position}" data-unit="${unitIdx}"
                     style="--unit-main:${unitPalette.main};--unit-dark:${unitPalette.dark};">
                    <a class="${nodeClasses}"
                       data-state="${state}"
                       data-skipped="${isSkipped ? '1' : '0'}"
                       data-title="${escapeAttr(displayTitle)}"
                       data-href="${escapeAttr(lessonHref)}"
                       aria-label="${state === 'completed' ? 'Review' : state === 'starting' ? 'Start' : state === 'jump' ? 'Jump' : 'Locked'} ${escapeAttr(displayTitle)}"
                       href="${state === 'locked' ? '#' : escapeAttr(lessonHref)}">
                        ${icon}
                    </a>
                    <div class="lesson-copy">
                        <strong>${displayTitle}</strong>
                        <span>${lesson.description}</span>
                    </div>
                </div>
            `);

            // Chest
            if (!savedTheme.noGamification && !isTest && !isJump && (lesson.lessonInUnit + 1) % 3 === 0 && iInUnit < orderedLessons.length - 1) {
                pathItems.push(`
                    <div class="path-chest" data-unit="${unitIdx}" aria-label="Reward chest">
                        <span class="chest-icon" aria-hidden="true">🎁</span>
                        <span class="chest-label">Reward chest</span>
                    </div>
                `);
            }
        });
    }

    const pathContent = pathItems.join('');

    // ---------- UP NEXT ----------
    const nextSectionNumber = sectionIndex + 2;
    const hasNextSection = nextSectionNumber <= 7;
    const nextSectionUrl = `course.html?courseId=${encodeURIComponent(course.id)}&section=${nextSectionNumber}`;

    const sectionHasProgress = lessons.some(l => l.completed);

    const lastUnitIdx = unitIndices[unitIndices.length - 1];
    const lastUnitLessons = lessons.filter(l => l.displayUnitIndex === lastUnitIdx);
    const lastUnitTest = [...lastUnitLessons].reverse().find(l => l.isTest)
        || lastUnitLessons[lastUnitLessons.length - 1];

    const sectionTestChessLevel = isChess
        ? (lastUnitTest.id.includes('c1') ? 1 : lastUnitTest.id.includes('c2') ? 2 : 3)
        : null;
    const sectionTestUrl =
        `lesson.html?courseId=${encodeURIComponent(course.id)}` +
        `&lessonId=${encodeURIComponent(lastUnitTest.id)}` +
        `&section=${sectionIndex + 1}` +
        `&unit=${lastUnitIdx + 1}` +
        `${isChess ? `&level=${sectionTestChessLevel}` : ''}` +
        `&combine=1`;

    const panelPalette = getCoursePalette(sectionIndex + 1, 1, course.id);
    let nextUpMarkup;

    if (!sectionHasProgress) {
        const badge = hasNextSection ? 'UP NEXT' : 'REVIEW';
        const heading = hasNextSection
            ? `Section ${nextSectionNumber}`
            : `Section ${sectionIndex + 1} — Final Review`;

        nextUpMarkup = `
            <section class="next-up" aria-label="Start section"
                     style="--next-main:${panelPalette.main};--next-dark:${panelPalette.dark};">
                <span class="next-up-badge">${badge}</span>
                <h2>${heading}</h2>
                <a class="next-up-link jump" href="${sectionTestUrl}">JUMP</a>
            </section>
        `;
    } else if (hasNextSection) {
        nextUpMarkup = `
            <section class="next-up" aria-label="Next section"
                     style="--next-main:${panelPalette.main};--next-dark:${panelPalette.dark};">
                <span class="next-up-badge">UP NEXT</span>
                <h2>Section ${nextSectionNumber}</h2>
                <a class="next-up-link" href="${nextSectionUrl}">CONTINUE</a>
            </section>
        `;
    } else {
        nextUpMarkup = `
            <section class="next-up" aria-label="Course complete"
                     style="--next-main:${panelPalette.main};--next-dark:${panelPalette.dark};">
                <span class="next-up-badge">COURSE COMPLETE</span>
                <h2>All sections complete</h2>
                <a class="next-up-link" href="dashboard.html">BACK TO DASHBOARD</a>
            </section>
        `;
    }

    contentArea.innerHTML = `
        <div class="progress-track">
            <div class="progress-bar" style="width: ${course.progress || 0}%"></div>
        </div>
        <div class="course-path"><svg class="path-trail" aria-hidden="true"></svg>${pathContent}</div>
        ${nextUpMarkup}
    `;

    // ---------- DRAW TRAIL ----------
    const coursePath = document.querySelector('.course-path');
    const pathTrail = coursePath.querySelector('.path-trail');
    const drawPathTrail = () => {
        const bounds = coursePath.getBoundingClientRect();
        const points = [...coursePath.querySelectorAll('.lesson-node, .chest-icon')].map(node => {
            const nb = node.getBoundingClientRect();
            return {
                x: nb.left + nb.width / 2 - bounds.left,
                y: nb.top + nb.height / 2 - bounds.top
            };
        });
        if (points.length < 2) return;

        const pathData = points.reduce((path, point, index) => {
            if (index === 0) return `M ${point.x} ${point.y}`;
            const prev = points[index - 1];
            const controlY = (prev.y + point.y) / 2;
            return `${path} C ${prev.x} ${controlY}, ${point.x} ${controlY}, ${point.x} ${point.y}`;
        }, '');

        pathTrail.setAttribute('viewBox', `0 0 ${bounds.width} ${bounds.height}`);
        pathTrail.innerHTML = `
            <path d="${pathData}" fill="none" stroke="var(--card)" stroke-width="15" stroke-linecap="round" />
            <path d="${pathData}" fill="none" stroke="#d5d9df" stroke-width="8" stroke-linecap="round" />
        `;
    };
    requestAnimationFrame(drawPathTrail);
    window.addEventListener('resize', drawPathTrail);

    // ---------- HEADER SCROLL SYNC ----------
    const allSteps = [...document.querySelectorAll('.path-step')];
    const defaultHeaderUnit = sectionComplete ? totalUnits - 1 : currentUnitIdx;

    function setHeaderToUnit(unitIdx) {
        sectionHeaderLabel.textContent = `SECTION ${sectionIndex + 1}, UNIT ${unitIdx + 1}`;
        sectionHeaderTitle.textContent = getUnitName(sectionIndex, unitIdx);
        applyHeaderColor(sectionIndex + 1, unitIdx + 1);
    }

    setHeaderToUnit(defaultHeaderUnit);

    let userHasScrolled = false;

    const updateHeaderFromScroll = () => {
        if (!userHasScrolled) return;

        if (window.scrollY < 40) {
            setHeaderToUnit(defaultHeaderUnit);
            return;
        }

        const headerRect = sectionHeader.getBoundingClientRect();
        const probeY = headerRect.bottom + 40;

        let currentUnit = defaultHeaderUnit;
        let bestDistance = Infinity;

        for (const step of allSteps) {
            const r = step.getBoundingClientRect();
            if (r.top > probeY) continue;

            const distance = probeY - r.top;
            if (distance < bestDistance) {
                bestDistance = distance;
                currentUnit = Number(step.dataset.unit) || 0;
            }
        }

        setHeaderToUnit(currentUnit);
    };

    let ticking = false;
    window.addEventListener('scroll', () => {
        userHasScrolled = true;
        if (ticking) return;
        ticking = true;
        requestAnimationFrame(() => {
            updateHeaderFromScroll();
            ticking = false;
        });
    }, { passive: true });

    // ---------- NODE POPOVER (FIXED: Clean up old popover) ----------
    let popover = document.querySelector('.node-popover');
    if (!popover) {
        popover = document.createElement('div');
        popover.className = 'node-popover';
        popover.hidden = true;
        document.body.appendChild(popover);
    }

    function hidePopover() {
        popover.hidden = true;
    }

    function showPopover(nodeEl) {
        const state = nodeEl.dataset.state;
        const isSkipped = nodeEl.dataset.skipped === '1';
        const nodeTitle = nodeEl.dataset.title;
        const href = nodeEl.dataset.href;

        if (isSkipped) {
            popover.innerHTML = `
                <h3 class="node-popover-title">${nodeTitle}</h3>
                <a class="node-popover-btn practice" href="${href}">Practice +5 XP</a>
            `;
        } else if (state === 'locked') {
            popover.innerHTML = `
                <h3 class="node-popover-title">${nodeTitle}</h3>
                <p class="node-popover-message">Complete all levels above to unlock this!</p>
                <button class="node-popover-btn locked" disabled>Locked</button>
            `;
        } else if (state === 'jump') {
            popover.innerHTML = `
                <h3 class="node-popover-title">${nodeTitle}</h3>
                <p class="node-popover-message">Skip ahead — tested on everything so far.</p>
                <a class="node-popover-btn primary" href="${href}">Jump +20 XP</a>
            `;
        } else if (state === 'starting') {
            popover.innerHTML = `
                <h3 class="node-popover-title">${nodeTitle}</h3>
                <a class="node-popover-btn primary" href="${href}">Start +20 XP</a>
            `;
        } else {
            popover.innerHTML = `
                <h3 class="node-popover-title">${nodeTitle}</h3>
                <a class="node-popover-btn practice" href="${href}">Practice +5 XP</a>
            `;
        }

        const rect = nodeEl.getBoundingClientRect();
        popover.style.left = (rect.left + rect.width / 2) + 'px';
        popover.style.top = (rect.top - 14) + 'px';
        popover.hidden = false;
    }

    document.querySelectorAll('.lesson-node').forEach(nodeEl => {
        nodeEl.addEventListener('click', (event) => {
            event.preventDefault();
            showPopover(nodeEl);
        });
    });

    document.addEventListener('click', (event) => {
        if (!popover.contains(event.target) && !event.target.closest('.lesson-node')) {
            hidePopover();
        }
    });

    window.addEventListener('scroll', hidePopover, { passive: true });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') hidePopover();
    });
}