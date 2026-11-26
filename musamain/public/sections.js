/* ============================================================
   Musalingo — sections.js  (Duolingo-style section list)
   Reads the same profile data + curriculum as dashboard.js.

     - A section is COMPLETED when all its lessons are done
     - A section is UNLOCKED only when every section before it is completed
     - The first unlocked, incomplete section is ACTIVE
     - Everything else is LOCKED

   Buttons:
     - Start / Continue  -> dashboard.html?section=N   (the learning path)
     - Review            -> dashboard.html?section=N
     - Jump (locked)     -> lesson.html test (combine=1) covering the
                            section before it. Passing it is what skips ahead.
   ============================================================ */

(() => {
    // ---------- SETTINGS ----------
    function safeParse(key, fallback) {
        try {
            const value = JSON.parse(localStorage.getItem(key));
            return value && typeof value === 'object' ? value : fallback;
        } catch { return fallback; }
    }
    const settings = safeParse('MusalingoSettings', {});

    if (settings.theme === 'light') document.body.classList.add('light-mode');

    if (/^#[0-9a-f]{6}$/i.test(String(settings.accent || ''))) {
        document.documentElement.style.setProperty('--accent', settings.accent);
        document.documentElement.style.setProperty('--accent-dark', darken(settings.accent, 0.2));
        document.documentElement.style.setProperty('--accent-shadow', darken(settings.accent, 0.2));
    }

    function darken(hex, amount) {
        const c = hex.replace('#', '');
        const r = parseInt(c.slice(0, 2), 16);
        const g = parseInt(c.slice(2, 4), 16);
        const b = parseInt(c.slice(4, 6), 16);
        const adj = v => Math.max(0, Math.min(255, Math.round(v * (1 - amount))));
        return '#' +
            adj(r).toString(16).padStart(2, '0') +
            adj(g).toString(16).padStart(2, '0') +
            adj(b).toString(16).padStart(2, '0');
    }

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
            if (!p || typeof p !== 'object') return createDefaultProfile();
            p.courses = Array.isArray(p.courses) ? p.courses : [];
            p.inventory = Array.isArray(p.inventory) ? p.inventory : [];
            p.diamonds = Number.isFinite(Number(p.diamonds)) ? Number(p.diamonds) : 100;
            return p;
        } catch { return createDefaultProfile(); }
    }

    const profile = loadProfile();

    // ---------- URL PARAMS ----------
    const params = new URLSearchParams(window.location.search);
    const courseId = params.get('courseId') || profile.activeCourseId || profile.selectedCourse || 'japanese';

    // ---------- PAGE ELEMENTS ----------
    const listEl = document.getElementById('sectionList');
    const backLink = document.getElementById('backLink');
    if (!listEl) return;
    if (backLink) backLink.href = `dashboard.html?courseId=${encodeURIComponent(courseId)}`;
    const showMessage = (html) => { listEl.innerHTML = `<p style="color:var(--muted);">${html}</p>`; };

    // ---------- CURRICULUM ----------
    const curriculum = window.MUSALINGO_CURRICULUM;
    if (!curriculum || typeof curriculum.getCourseLessons !== 'function') {
        showMessage('Course data failed to load. Please refresh the page.');
        return;
    }
    if (!curriculum.courses || !curriculum.courses[courseId]) {
        showMessage('Course not found. <a href="catalog.html">Browse courses</a>');
        return;
    }

    const storedCourse = profile.courses.find(c => c && c.id === courseId);
    const storedLessons = Array.isArray(storedCourse?.lessons) ? storedCourse.lessons : [];
    const courseLessons = curriculum.getCourseLessons(courseId, storedLessons, storedCourse?.learningProfile?.experience);

    // Show exactly the sections this course has lessons for (Math grades have 3, not the 7 in the metadata)
    const allSectionMeta = curriculum.sections?.[courseId] || curriculum.defaultSections || [];
    const sectionCount = courseLessons.reduce((max, l) => Math.max(max, (l.sectionIndex ?? 0) + 1), 0) || allSectionMeta.length;
    let sectionMeta = Array.from({ length: sectionCount }, (_, idx) => (
        allSectionMeta[idx] || { sectionNo: idx + 1, label: `SECTION ${idx + 1}`, cat: '🐈' }
    ));
    if (courseId === 'math') {
        const experience = storedCourse?.learningProfile?.experience || '';
        const grade = /^grade-(\d+)$/.exec(experience);
        const prefix = grade ? `GRADE ${grade[1]}` : experience === 'fun-math' ? 'FUN MATH' : experience === 'adult-math' ? 'ADULT MATH' : 'GRADE 1';
        sectionMeta = sectionMeta.map((s, idx) => ({ ...s, label: `${prefix} · PART ${idx + 1}` }));
    }

    function getSectionStats(sectionIndex) {
        const inSection = courseLessons.filter(l => (l.sectionIndex ?? 0) === sectionIndex);
        const total = inSection.length;
        const done = inSection.filter(l => l.completed).length;
        const progress = total > 0 ? Math.round((done / total) * 100) : 0;
        const hasProgress = done > 0;
        const isComplete = total > 0 && done === total;
        return { total, done, progress, hasProgress, isComplete };
    }

    // Sections with no lessons are skipped (the dashboard skips them too), so they can never
    // block the sections after them. Links always use the real section index + 1.
    const entries = sectionMeta
        .map((meta, idx) => ({ meta, idx, sectionNo: idx + 1, stats: getSectionStats(idx) }))
        .filter(e => e.stats.total > 0);

    // ---------- UNLOCK RULES (Duolingo): only after every earlier section is complete ----------
    function isSectionUnlocked(pos) {
        for (let i = 0; i < pos; i++) {
            if (!entries[i].stats.isComplete) return false;
        }
        return true;
    }

    function pickActivePos() {
        for (let i = 0; i < entries.length; i++) {
            if (isSectionUnlocked(i) && !entries[i].stats.isComplete) return i;
        }
        return -1;
    }

    const activePos = pickActivePos();

    // ---------- JUMP TEST ----------
    // "Jump here?" = take the final test of the section BEFORE the target (combine=1).
    // This is the same test the dashboard's "Up next" card uses.
    function chessLevelOf(lessonId) {
        return String(lessonId).includes('c1') ? 1 : String(lessonId).includes('c2') ? 2 : 3;
    }

    function buildJumpUrl(pos) {
        if (pos <= 0) return null;
        const prevIdx = entries[pos - 1].idx;

        let prevLessons = [];
        try {
            prevLessons = curriculum.buildDisplayLessons?.(courseLessons, courseId, prevIdx)?.lessons || [];
        } catch { prevLessons = []; }
        if (!prevLessons.length) prevLessons = courseLessons.filter(l => (l.sectionIndex ?? 0) === prevIdx);
        prevLessons = prevLessons.filter(l => !l.isJump);
        if (!prevLessons.length) return null;

        const unitOf = l => l.displayUnitIndex ?? l.unitIndex ?? 0;
        const lastUnit = Math.max(...prevLessons.map(unitOf));
        const lastUnitLessons = prevLessons.filter(l => unitOf(l) === lastUnit);
        const test = [...lastUnitLessons].reverse().find(l => l.isTest) || lastUnitLessons[lastUnitLessons.length - 1];
        if (!test) return null;

        return `lesson.html?courseId=${encodeURIComponent(courseId)}` +
            `&lessonId=${encodeURIComponent(test.id)}` +
            `&section=${prevIdx + 1}` +
            `&unit=${lastUnit + 1}` +
            `${courseId === 'chess' ? `&level=${chessLevelOf(test.id)}` : ''}` +
            `&combine=1`;
    }

    // ---------- RENDER ----------
    if (!entries.length) {
        listEl.innerHTML = `<p style="color:var(--muted);">No sections yet for this course.</p>`;
        return;
    }

    listEl.innerHTML = entries.map(({ meta: s, sectionNo, stats }, pos) => {
        const label = s.label || `SECTION ${sectionNo}`;
        const cat = s.cat || '🐈';

        const isCompleted = stats.isComplete;
        const isActive = !isCompleted && pos === activePos;

        const sectionLink = `dashboard.html?courseId=${encodeURIComponent(courseId)}&section=${sectionNo}`;
        const jumpUrl = isCompleted || isActive ? null : buildJumpUrl(pos);

        const detailsAttr = ['chess', 'math', 'music'].includes(courseId)
            ? ''
            : `data-section="${sectionNo}"`;

        if (isCompleted) {
            return `
                <div class="section-card completed">
                    <div class="section-top">
                        <div class="section-info">
                            <div class="section-eyebrow" ${detailsAttr}>
                                ${label} <span class="dot">•</span> SEE DETAILS
                            </div>
                            <h2 class="section-title">Section ${sectionNo}</h2>
                            <div class="section-status">
                                <span class="check">✓</span>
                                <span>Completed!</span>
                            </div>
                        </div>
                        <a class="review-btn" href="${sectionLink}">Review</a>
                    </div>
                </div>
            `;
        }

        if (isActive) {
            return `
                <div class="section-card">
                    <div class="section-top">
                        <div class="section-info">
                            <div class="section-eyebrow" ${detailsAttr}>
                                ${label} <span class="dot">•</span> SEE DETAILS
                            </div>
                            <h2 class="section-title">Section ${sectionNo}</h2>

                            <div class="progress-line">
                                <div class="progress-track">
                                    <div class="progress-fill" style="width:${stats.progress}%"></div>
                                </div>
                                <span class="progress-pct">${stats.progress}%</span>
                                <span class="trophy-small">🏆</span>
                            </div>

                            <a class="continue-btn" href="${sectionLink}">
                                ${stats.hasProgress ? 'Continue' : 'Start'}
                            </a>
                        </div>

                        <div class="illustration">
                            ${s.speech ? `
                                <div class="speech-bubble">
                                    <div style="color:var(--muted);font-size:0.7rem;font-weight:600;margin-bottom:2px;">
                                        ${s.speech.romaji || ''}
                                    </div>
                                    ${s.speech.jp || ''}
                                </div>
                            ` : ''}
                            <div class="cat">${cat}</div>
                        </div>
                    </div>
                </div>
            `;
        }

        return `
            <div class="section-card locked">
                <div class="section-top">
                    <div class="section-info">
                        <div class="section-eyebrow" ${detailsAttr}>
                            ${label} <span class="dot">•</span> SEE DETAILS
                        </div>
                        <h2 class="section-title">Section ${sectionNo}</h2>
                        <div class="units-label">🔒 LOCKED</div>

                        ${jumpUrl ? `<a class="jump-btn" href="${jumpUrl}">Jump to Section ${sectionNo}</a>` : ''}
                    </div>

                    <div class="illustration">
                        ${s.speech ? `
                            <div class="speech-bubble" style="opacity:0.7;">
                                <div style="color:var(--muted);font-size:0.7rem;font-weight:600;margin-bottom:2px;">
                                    ${s.speech.romaji || ''}
                                </div>
                                ${s.speech.jp || ''}
                            </div>
                        ` : ''}
                        <div class="cat" style="opacity:0.6;">${cat}</div>
                    </div>
                </div>
            </div>
        `;
    }).join('');

    // ---------- SEE DETAILS → guidebook ----------
    document.querySelectorAll('.section-eyebrow[data-section]').forEach(el => {
        el.setAttribute('role', 'link');
        el.tabIndex = 0;
        const open = () => {
            window.location.href =
                `guidebook.html?courseId=${encodeURIComponent(courseId)}&section=${el.dataset.section}`;
        };
        el.addEventListener('click', open);
        el.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });
    });
})();