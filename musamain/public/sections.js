/* ============================================================
   Musalingo — sections.js
   Reads the same profile data + curriculum as course.js.
   Syncs status:

     - Section N is UNLOCKED if:
         • it is the one the user came from (?section=N), OR
         • every section before it is fully complete

     - Section N is COMPLETED when all its lessons are done
     - The first unlocked, incomplete section is ACTIVE
     - Everything else is LOCKED
   ============================================================ */

(() => {
    // ---------- SETTINGS ----------
    const settings = JSON.parse(localStorage.getItem('MusalingoSettings') || '{}');

    if (settings.theme === 'light') document.body.classList.add('light-mode');

    if (settings.accent) {
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
            if (!p) return createDefaultProfile();
            p.courses = Array.isArray(p.courses) ? p.courses : [];
            p.inventory = Array.isArray(p.inventory) ? p.inventory : [];
            p.diamonds = Number(p.diamonds) || 100;
            return p;
        } catch { return createDefaultProfile(); }
    }

    const profile = loadProfile();

    // ---------- URL PARAMS ----------
    const params = new URLSearchParams(window.location.search);
    const courseId = params.get('courseId') || 'japanese';
    const focusedSectionNo = Number(params.get('section')) || null;

    // ---------- CURRICULUM ----------
    const curriculum = window.MUSALINGO_CURRICULUM;
    const sectionMeta = curriculum.sections[courseId] || curriculum.defaultSections;

    const storedCourse = profile.courses.find(c => c.id === courseId);
    const storedLessons = Array.isArray(storedCourse?.lessons) ? storedCourse.lessons : [];
    const courseLessons = curriculum.getCourseLessons(courseId, storedLessons, storedCourse?.learningProfile?.experience);

    function getSectionStats(sectionIndex) {
        const inSection = courseLessons.filter(l => (l.sectionIndex ?? 0) === sectionIndex);
        const total = inSection.length;
        const done = inSection.filter(l => l.completed).length;
        const progress = total > 0 ? Math.round((done / total) * 100) : 0;
        const hasProgress = done > 0;
        const isComplete = total > 0 && done === total;

        const firstLesson = inSection[0];
        const nextLesson = inSection.find(l => !l.completed) || firstLesson;

        return { total, done, progress, hasProgress, isComplete, firstLesson, nextLesson };
    }

    // ---------- UNLOCK RULES ----------
    function isSectionUnlocked(idx) {
        if (focusedSectionNo !== null && (focusedSectionNo - 1) === idx) return true;

        for (let i = 0; i < idx; i++) {
            const prev = getSectionStats(i);
            if (!prev.isComplete) return false;
        }
        return true;
    }

    // ---------- ACTIVE SECTION ----------
    function pickActiveSectionIndex() {
        for (let i = 0; i < sectionMeta.length; i++) {
            if (!isSectionUnlocked(i)) continue;
            const stats = getSectionStats(i);
            if (!stats.isComplete) return i;
        }
        return -1;
    }

    const activeSectionIdx = pickActiveSectionIndex();

    // ---------- RENDER ----------
    const listEl = document.getElementById('sectionList');
    const backLink = document.getElementById('backLink');
    backLink.href = `course.html?courseId=${encodeURIComponent(courseId)}`;

    if (!sectionMeta.length) {
        listEl.innerHTML = `<p style="color:var(--muted);">No sections yet for this course.</p>`;
        return;
    }

    listEl.innerHTML = sectionMeta.map((s, idx) => {
        const stats = getSectionStats(idx);
        const sectionNo = s.sectionNo || (idx + 1);

        const unlocked = isSectionUnlocked(idx);
        const isCompleted = stats.isComplete;
        const isActive = unlocked && !isCompleted && idx === activeSectionIdx;
        const isLocked = !unlocked && !isCompleted;

        const sectionLink = `course.html?courseId=${encodeURIComponent(courseId)}&section=${sectionNo}`;
        const lessonLink = stats.nextLesson
            ? `lesson.html?courseId=${encodeURIComponent(courseId)}&lessonId=${encodeURIComponent(stats.nextLesson.id)}&section=${sectionNo}&unit=1`
            : sectionLink;

        const detailsAttr = ['chess', 'math', 'music'].includes(courseId)
            ? ''
            : `data-section="${sectionNo}"`;

        if (isCompleted) {
            return `
                <div class="section-card completed">
                    <div class="section-top">
                        <div class="section-info">
                            <div class="section-eyebrow" ${detailsAttr}>
                                ${s.label} <span class="dot">•</span> SEE DETAILS
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
                                ${s.label} <span class="dot">•</span> SEE DETAILS
                            </div>
                            <h2 class="section-title">Section ${sectionNo}</h2>

                            <div class="progress-line">
                                <div class="progress-track">
                                    <div class="progress-fill" style="width:${stats.progress}%"></div>
                                </div>
                                <span class="progress-pct">${stats.progress}%</span>
                                <span class="trophy-small">🏆</span>
                            </div>

                            <a class="continue-btn" href="${lessonLink}">
                                ${stats.hasProgress ? 'Continue' : 'Start'}
                            </a>
                        </div>

                        <div class="illustration">
                            ${s.speech ? `
                                <div class="speech-bubble">
                                    <div style="color:var(--muted);font-size:0.7rem;font-weight:600;margin-bottom:2px;">
                                        ${s.speech.romaji}
                                    </div>
                                    ${s.speech.jp}
                                </div>
                            ` : ''}
                            <div class="cat">${s.cat}</div>
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
                            ${s.label} <span class="dot">•</span> SEE DETAILS
                        </div>
                        <h2 class="section-title">Section ${sectionNo}</h2>
                        <div class="units-label">🔒 LOCKED</div>

                        <a class="jump-btn" href="${sectionLink}">
                            Jump to Section ${sectionNo}
                        </a>
                    </div>

                    <div class="illustration">
                        ${s.speech ? `
                            <div class="speech-bubble" style="opacity:0.7;">
                                <div style="color:var(--muted);font-size:0.7rem;font-weight:600;margin-bottom:2px;">
                                    ${s.speech.romaji}
                                </div>
                                ${s.speech.jp}
                            </div>
                        ` : ''}
                        <div class="cat" style="opacity:0.6;">${s.cat}</div>
                    </div>
                </div>
            </div>
        `;
    }).join('');

    // ---------- SEE DETAILS → guidebook ----------
    document.querySelectorAll('.section-eyebrow[data-section]').forEach(el => {
        el.addEventListener('click', () => {
            const no = el.dataset.section;
            window.location.href =
                `guidebook.html?courseId=${encodeURIComponent(courseId)}&section=${no}`;
        });
    });
})();