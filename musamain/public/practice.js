/* ============================================================
   Musalingo — practice.js
   Practice page: course-aware practice modes, a word bank built from
   your lesson words, and a talk-to-coach chat (voice + text).
   Needs: sounds.js (optional voice), audience.js + questions.js (optional,
   for translations), /api/chat on the server for the coach.
   ============================================================ */

(() => {
    'use strict';

    /* ============================================================
       SAFE PARSE
       ============================================================ */
    function safeParse(key, fallback) {
        try {
            const raw = localStorage.getItem(key);
            if (!raw) return fallback;
            const parsed = JSON.parse(raw);
            return parsed && typeof parsed === 'object' ? parsed : fallback;
        } catch (err) {
            console.warn(`[practice] Corrupted localStorage for ${key}; using defaults.`, err);
            return fallback;
        }
    }

    /* ============================================================
       CONFIG
       ============================================================ */
    const DAILY_GOAL = 20;
    const HEART_CAP = 5;
    const PRACTICE_KEY = 'MusalingoPracticeData';
    const $ = id => document.getElementById(id);

    let profile = readProfile();
    let practiceData = readPracticeData();
    let toastTimer;

    function readProfile() {
        const raw = safeParse('MusalingoProfile', {});
        return {
            ...raw,
            xp: finiteInt(raw.xp, 0),
            diamonds: finiteInt(raw.diamonds, 100),
            hearts: Math.min(HEART_CAP, finiteInt(raw.hearts, HEART_CAP)),
            streak: finiteInt(raw.streak, 0),
            activeCourseId: raw.activeCourseId || null,
            courses: Array.isArray(raw.courses) ? raw.courses.filter(c => c && typeof c === 'object') : [],
            dailyQuestProgress: raw.dailyQuestProgress && typeof raw.dailyQuestProgress === 'object'
                ? { ...raw.dailyQuestProgress }
                : { xp: 0, lessons: 0, practice: 0, accuracy: 0, streak: 0 }
        };
    }

    function finiteInt(value, fallback) {
        const number = Number(value);
        return Number.isFinite(number) ? Math.max(0, Math.floor(number)) : fallback;
    }

    function todayKey() {
        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    function isValidWord(item) {
        return item && typeof item === 'object' && typeof item.key === 'string' && typeof item.courseId === 'string'
            && typeof item.word === 'string' && item.word && typeof item.meaning === 'string' && item.meaning;
    }

    function readPracticeData() {
        const raw = safeParse(PRACTICE_KEY, {});
        return {
            mistakes: Array.isArray(raw.mistakes)
                ? raw.mistakes.filter(item => item && typeof item === 'object' && item.question).slice(0, 100)
                : [],
            words: Array.isArray(raw.words) ? raw.words.filter(isValidWord).slice(0, 1500) : []
        };
    }

    /* ============================================================
       ACTIVE COURSE
       ============================================================ */
    function getActiveCourse() {
        if (!Array.isArray(profile.courses) || profile.courses.length === 0) return null;
        if (profile.activeCourseId) {
            const match = profile.courses.find(c => c.id === profile.activeCourseId);
            if (match) return match;
        }
        return profile.courses[0];
    }

    const activeCourse = getActiveCourse();
    const courseId = activeCourse?.id || '';

    // Determine course type (language / chess / math / music)
    const COURSE_TYPE_MAP = {
        chess: 'chess',
        math: 'math',
        music: 'music'
    };
    const courseType = COURSE_TYPE_MAP[courseId] || 'language';

    // Course display info
    const COURSE_ICONS = {
        chess: '♟️', math: '➗', music: '🎵',
        japanese: '🇯🇵', spanish: '🇪🇸', french: '🇫🇷', german: '🇩🇪',
        italian: '🇮🇹', hindi: '🇮🇳', arabic: '🇸🇦', english: '🇬🇧',
        korean: '🇰🇷', telugu: '🇮🇳'
    };
    const COURSE_NAMES = {
        chess: 'Chess', math: 'Math', music: 'Music',
        japanese: 'Japanese', spanish: 'Spanish', french: 'French',
        german: 'German', italian: 'Italian', hindi: 'Hindi',
        arabic: 'Arabic', english: 'English', korean: 'Korean', telugu: 'Telugu'
    };
    const courseIcon = COURSE_ICONS[courseId] || '📚';
    const courseName = COURSE_NAMES[courseId] || (activeCourse?.name || 'Course');

    /* ============================================================
       COURSE-AWARE PRACTICE MODES
       ============================================================ */

    // Language: words, listening, speaking, speed, mixed
    const LANGUAGE_MODES = [
        { mode: 'words', icon: '📚', title: 'Words', desc: 'Build vocabulary with quick translation rounds.', color: '#a560e8', tag: null, progressLabel: 'Vocabulary review', progressValue: '5 min', progressPct: 42 },
        { mode: 'listening', icon: '🎧', title: 'Listening', desc: 'Listen closely and choose the phrase you hear.', color: '#1cb0f6', tag: null, progressLabel: 'Audio practice', progressValue: '5 rounds', progressPct: 35 },
        { mode: 'speaking', icon: '🎙️', title: 'Speaking', desc: 'Say it out loud and practice your pronunciation.', color: '#ff4b4b', tag: null, progressLabel: 'Speaking practice', progressValue: '5 rounds', progressPct: 20 },
        { mode: 'speed', icon: '⚡', title: 'Quick practice', desc: 'How many can you get right before the timer runs out?', color: '#58a700', tag: '60 seconds', progressLabel: 'Fast recall', progressValue: 'Timed', progressPct: 64 },
        { mode: 'mixed', icon: '🔄', title: 'Mixed review', desc: 'A little bit of everything, adapted to keep you learning.', color: '#ec75aa', tag: null, progressLabel: 'All skills', progressValue: '5 rounds', progressPct: 55 }
    ];

    // Chess: tactics, opening, endgame, mixed
    const CHESS_MODES = [
        { mode: 'tactics', icon: '♟️', title: 'Tactics', desc: 'Forks, pins, skewers — sharpen your tactical vision.', color: '#a560e8', tag: null, progressLabel: 'Puzzles', progressValue: '5 rounds', progressPct: 42 },
        { mode: 'opening', icon: '♘', title: 'Openings', desc: 'Practice the first moves and develop your pieces.', color: '#1cb0f6', tag: null, progressLabel: 'Opening drills', progressValue: '5 rounds', progressPct: 35 },
        { mode: 'endgame', icon: '♔', title: 'Endgames', desc: 'King + pawn, rook + king — master basic endings.', color: '#ff4b4b', tag: null, progressLabel: 'Endgame drills', progressValue: '5 rounds', progressPct: 20 },
        { mode: 'speed', icon: '⚡', title: 'Quick tactics', desc: 'Solve fast — how many tactics can you spot in 60s?', color: '#58a700', tag: '60 seconds', progressLabel: 'Fast tactics', progressValue: 'Timed', progressPct: 64 },
        { mode: 'mixed', icon: '🔄', title: 'Mixed review', desc: 'A blend of openings, tactics, and endgames.', color: '#ec75aa', tag: null, progressLabel: 'All skills', progressValue: '5 rounds', progressPct: 55 }
    ];

    // Math: addition, multiplication, division, fractions, mixed
    const MATH_MODES = [
        { mode: 'addition', icon: '➕', title: 'Addition', desc: 'Fast addition drills with numbers that fit your level.', color: '#a560e8', tag: null, progressLabel: 'Addition', progressValue: '5 rounds', progressPct: 42 },
        { mode: 'multiplication', icon: '✖️', title: 'Multiplication', desc: 'Times tables and multi-digit multiplication.', color: '#1cb0f6', tag: null, progressLabel: 'Multiplication', progressValue: '5 rounds', progressPct: 35 },
        { mode: 'division', icon: '➗', title: 'Division', desc: 'Division facts and long division.', color: '#ff4b4b', tag: null, progressLabel: 'Division', progressValue: '5 rounds', progressPct: 20 },
        { mode: 'speed', icon: '⚡', title: 'Quick math', desc: 'How many problems can you solve in 60s?', color: '#58a700', tag: '60 seconds', progressLabel: 'Fast math', progressValue: 'Timed', progressPct: 64 },
        { mode: 'mixed', icon: '🔄', title: 'Mixed review', desc: 'A blend of everything, adapted to your grade.', color: '#ec75aa', tag: null, progressLabel: 'All skills', progressValue: '5 rounds', progressPct: 55 }
    ];

    // Music: notes, intervals, chords, rhythm, mixed
    const MUSIC_MODES = [
        { mode: 'notes', icon: '🎵', title: 'Notes', desc: 'Identify pitches on the treble and bass clef.', color: '#a560e8', tag: null, progressLabel: 'Note names', progressValue: '5 rounds', progressPct: 42 },
        { mode: 'intervals', icon: '🎶', title: 'Intervals', desc: 'Practice hearing and naming musical intervals.', color: '#1cb0f6', tag: null, progressLabel: 'Intervals', progressValue: '5 rounds', progressPct: 35 },
        { mode: 'chords', icon: '🎼', title: 'Chords', desc: 'Major, minor, diminished, augmented.', color: '#ff4b4b', tag: null, progressLabel: 'Chord types', progressValue: '5 rounds', progressPct: 20 },
        { mode: 'speed', icon: '⚡', title: 'Quick ear training', desc: 'How fast can you identify notes and intervals?', color: '#58a700', tag: '60 seconds', progressLabel: 'Ear training', progressValue: 'Timed', progressPct: 64 },
        { mode: 'mixed', icon: '🔄', title: 'Mixed review', desc: 'Notes, intervals, chords, and rhythm together.', color: '#ec75aa', tag: null, progressLabel: 'All skills', progressValue: '5 rounds', progressPct: 55 }
    ];

    // Pick the mode set based on course type
    const PRACTICE_MODES =
        courseType === 'chess' ? CHESS_MODES :
            courseType === 'math' ? MATH_MODES :
                courseType === 'music' ? MUSIC_MODES :
                    LANGUAGE_MODES;

    // Hero content per course type
    const HERO_COPY = {
        language: { title: 'Make your tricky words stick', desc: 'Review words you missed and get a little closer to remembering them for good.', mascot: '🦉' },
        chess: { title: 'Sharpen your tactical eye', desc: 'Solve puzzles, master openings, and refine your endgame play.', mascot: '♞' },
        math: { title: 'Practice until it clicks', desc: 'Drill your facts, master operations, and build speed and confidence.', mascot: '🧮' },
        music: { title: 'Train your ear', desc: 'Identify notes, intervals, and chords with a few minutes of focused practice.', mascot: '🎵' }
    };

    /* ============================================================
       RENDER
       ============================================================ */

    function renderStats() {
        $('streakLink').textContent = profile.streak;
        $('diamondLink').textContent = profile.diamonds;
        $('heartLink').textContent = profile.hearts;
        $('xpValue').textContent = `${profile.xp} XP`;

        const dailyXp = profile.dailyQuestDate === todayKey()
            ? finiteInt(profile.dailyQuestProgress.xp, 0)
            : 0;
        $('goalXp').textContent = dailyXp;
        $('goalTarget').textContent = DAILY_GOAL;
        const progress = Math.min(100, (dailyXp / DAILY_GOAL) * 100);
        $('goalProgress').style.width = `${progress}%`;
        const goalBar = $('goalProgress').parentElement;
        goalBar.setAttribute('aria-valuemax', DAILY_GOAL);
        goalBar.setAttribute('aria-valuenow', Math.min(DAILY_GOAL, dailyXp));

        $('streakCopy').textContent = profile.streak
            ? `${profile.streak} day${profile.streak === 1 ? '' : 's'} in a row`
            : 'Start a new streak';
    }

    function renderCourseChip() {
        $('courseChipIcon').textContent = courseIcon;
        $('courseChipName').textContent = courseName;
    }

    function renderHero() {
        const copy = HERO_COPY[courseType] || HERO_COPY.language;
        $('reviewTitle').textContent = copy.title;
        $('heroDesc').textContent = copy.desc;
        $('heroMascot').textContent = copy.mascot;
    }

    function renderPracticeGrid() {
        const grid = $('practiceGrid');
        if (!activeCourse) {
            grid.innerHTML = '';
            $('noCourseState').style.display = 'block';
            return;
        }
        $('noCourseState').style.display = 'none';

        // Build grid: recommended mistakes card first, then modes
        const mistakesCount = practiceData.mistakes.filter(m => m.courseId === courseId).length;

        let html = '';

        // Recommended: mistakes (only for language; for others, show "practice" as recommended)
        if (courseType === 'language') {
            html += `
                <button class="practice-card" type="button" data-mode="mistakes" style="--card-color:#ff9600;">
                    <span class="card-tag">Recommended</span>
                    <span class="card-icon">🧠</span>
                    <strong>Review mistakes</strong>
                    <span class="card-description">Revisit questions you got wrong and turn them into wins.</span>
                    <span class="card-progress">
                        <span class="card-progress-line">
                            <span>Items to revisit</span>
                            <span>${mistakesCount}</span>
                        </span>
                        <span class="mini-track">
                            <span class="mini-fill" style="width:${Math.min(100, mistakesCount * 20)}%"></span>
                        </span>
                    </span>
                </button>
            `;
        }

        // Word bank (language courses) + talk to coach (every course)
        if (courseType === 'language') {
            const bank = getBankWords();
            const mastered = bank.filter(isMastered).length;
            html += `
                <button class="practice-card" type="button" data-mode="wordbank" style="--card-color:#00b8a9;">
                    <span class="card-tag">New</span>
                    <span class="card-icon">📖</span>
                    <strong>Word bank</strong>
                    <span class="card-description">Every word from your lessons with translations. Flashcards and quizzes included.</span>
                    <span class="card-progress">
                        <span class="card-progress-line">
                            <span>${bank.length} word${bank.length === 1 ? '' : 's'}</span>
                            <span>${mastered} mastered</span>
                        </span>
                        <span class="mini-track">
                            <span class="mini-fill" style="width:${bank.length ? Math.round((mastered / bank.length) * 100) : 0}%"></span>
                        </span>
                    </span>
                </button>
            `;
        }
        html += `
            <button class="practice-card" type="button" data-mode="coach" style="--card-color:#1cb0f6;">
                <span class="card-tag">AI</span>
                <span class="card-icon">🎙️</span>
                <strong>Talk to coach</strong>
                <span class="card-description">${courseType === 'language' ? 'Have a conversation and get gentle corrections, by voice or text.' : 'Ask your coach anything, by voice or text.'}</span>
                <span class="card-progress">
                    <span class="card-progress-line"><span>Voice and chat</span><span>Ready</span></span>
                    <span class="mini-track"><span class="mini-fill" style="width:100%"></span></span>
                </span>
            </button>
        `;

        // All modes
        html += PRACTICE_MODES.map(m => `
            <button class="practice-card" type="button" data-mode="${m.mode}" style="--card-color:${m.color};">
                ${m.tag ? `<span class="card-tag">${m.tag}</span>` : ''}
                <span class="card-icon">${m.icon}</span>
                <strong>${m.title}</strong>
                <span class="card-description">${m.desc}</span>
                <span class="card-progress">
                    <span class="card-progress-line">
                        <span>${m.progressLabel}</span>
                        <span>${m.progressValue}</span>
                    </span>
                    <span class="mini-track">
                        <span class="mini-fill" style="width:${m.progressPct}%"></span>
                    </span>
                </span>
            </button>
        `).join('');

        grid.innerHTML = html;

        // Bind click handlers
        grid.querySelectorAll('[data-mode]').forEach(btn => {
            btn.addEventListener('click', () => {
                const mode = btn.dataset.mode;
                if (mode === 'wordbank') return openWordBank(btn);
                if (mode === 'coach') return openCoach({ listen: false });
                startPractice(mode);
            });
        });
    }

    function renderSkills() {
        const container = $('skillsList');
        const skillSets = {
            language: [
                { emoji: '🗣️', name: 'Speaking', detail: 'Practice clear pronunciation' },
                { emoji: '🎧', name: 'Listening', detail: 'Train your ear to catch more' },
                { emoji: '📖', name: 'Vocabulary', detail: 'Recall useful words and phrases' }
            ],
            chess: [
                { emoji: '♟️', name: 'Tactics', detail: 'Forks, pins, skewers' },
                { emoji: '♘', name: 'Openings', detail: 'Develop your pieces' },
                { emoji: '♔', name: 'Endgames', detail: 'Master basic endings' }
            ],
            math: [
                { emoji: '➕', name: 'Addition', detail: 'Fast, accurate addition' },
                { emoji: '✖️', name: 'Multiplication', detail: 'Times tables and beyond' },
                { emoji: '➗', name: 'Division', detail: 'Division facts and long division' }
            ],
            music: [
                { emoji: '🎵', name: 'Notes', detail: 'Identify pitch and clef' },
                { emoji: '🎶', name: 'Intervals', detail: 'Hear and name intervals' },
                { emoji: '🎼', name: 'Chords', detail: 'Major, minor, and more' }
            ]
        };
        const skills = skillSets[courseType] || skillSets.language;
        container.innerHTML = skills.map(s => `
            <div class="skill-row">
                <span class="skill-emoji">${s.emoji}</span>
                <span>
                    <span class="skill-name">${s.name}</span>
                    <span class="skill-detail">${s.detail}</span>
                </span>
                <span class="skill-level">Ready</span>
            </div>
        `).join('');
    }

    /* ============================================================
       NAVIGATION — go to lesson.html with course-aware practiceMode
       ============================================================ */

    function startPractice(mode) {
        profile = readProfile();
        const course = getActiveCourse();
        if (!course) {
            window.location.href = 'catalog.html';
            return;
        }

        // Prevent "mistakes" for non-language if no mistakes exist
        if (mode === 'mistakes') {
            const hasMistakes = practiceData.mistakes.some(m => m.courseId === course.id);
            if (!hasMistakes) {
                showToast('No missed questions for this course yet. Complete a lesson first.');
                return;
            }
        }

        // Find a lesson to use as the "container" for the review
        const lessons = Array.isArray(course.lessons) ? course.lessons.filter(l => l && l.id) : [];
        let lesson = lessons.find(l => !l.completed) || lessons[0];
        if (!lesson) {
            window.location.href = `dashboard.html?courseId=${encodeURIComponent(course.id)}`;
            return;
        }

        const params = new URLSearchParams({
            courseId: course.id,
            lessonId: lesson.id,
            review: '1',
            practiceMode: mode
        });
        window.location.href = `lesson.html?${params.toString()}`;
    }

    /* ============================================================
       TOAST
       ============================================================ */
    function showToast(message) {
        const toast = $('toast');
        toast.textContent = message;
        toast.classList.add('show');
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => toast.classList.remove('show'), 3000);
    }

    /* ============================================================
       SHARED HELPERS (word bank + coach)
       ============================================================ */
    const MAX_WORDS = 1500;
    const LANGUAGE_CODES = {
        English: 'en-US', Spanish: 'es-ES', French: 'fr-FR', German: 'de-DE', Italian: 'it-IT',
        Japanese: 'ja-JP', Hindi: 'hi-IN', Arabic: 'ar-SA', Korean: 'ko-KR', Telugu: 'te-IN'
    };

    function resolveLanguage(name) {
        const raw = String(name || '').trim();
        const table = [
            [/hindi|हिंदी|हिन्दी/i, 'Hindi'], [/telugu|తెలుగు/i, 'Telugu'], [/korean|한국어/i, 'Korean'],
            [/japanese|日本語|nihongo/i, 'Japanese'], [/arabic|العربية/i, 'Arabic'], [/spanish|español|espanol/i, 'Spanish'],
            [/french|français|francais/i, 'French'], [/german|deutsch/i, 'German'], [/italian|italiano/i, 'Italian'],
            [/english/i, 'English']
        ];
        for (const [pattern, language] of table) if (pattern.test(raw)) return language;
        return raw || 'English';
    }

    const targetLanguage = courseType === 'language' ? resolveLanguage(activeCourse?.name || courseName) : 'English';
    const audienceLanguage = (() => {
        const resolved = resolveLanguage(activeCourse?.speakerLanguage || 'English');
        return LANGUAGE_CODES[resolved] ? resolved : 'English';
    })();

    function esc(value) {
        return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
    }

    function shuffleArray(items) {
        const copy = items.slice();
        for (let i = copy.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [copy[i], copy[j]] = [copy[j], copy[i]];
        }
        return copy;
    }

    function unique(items) {
        return [...new Set(items.filter(item => item !== '' && item != null))];
    }

    // Meanings are stored as the lesson gave them (usually English); show them in the learner's own language when known.
    function localizeMeaning(meaning) {
        const text = String(meaning ?? '').trim();
        const dictionary = window.MusalingoAudience?.translations?.[audienceLanguage];
        return dictionary?.[text.toLowerCase()] || text;
    }

    function speak(text, language, rate = 0.9) {
        const value = String(text || '').trim();
        if (!value) return;
        try {
            if (window.SFX && typeof window.SFX.pronounce === 'function') {
                window.SFX.pronounce(value, { lang: language, rate });
                return;
            }
        } catch (error) { /* fall back to the browser voice */ }
        try {
            if (!('speechSynthesis' in window)) return;
            window.speechSynthesis.cancel();
            const utterance = new SpeechSynthesisUtterance(value);
            utterance.lang = LANGUAGE_CODES[language] || 'en-US';
            utterance.rate = rate;
            window.speechSynthesis.speak(utterance);
        } catch (error) { /* no voice available */ }
    }

    // Merge-safe write: lesson.js stores mistakes in the same key, so never overwrite what we don't own.
    function updatePracticeStorage(mutator) {
        const raw = safeParse(PRACTICE_KEY, {});
        const next = mutator(raw) || raw;
        try {
            localStorage.setItem(PRACTICE_KEY, JSON.stringify(next));
        } catch (error) {
            console.warn('[practice] Could not save practice data.', error);
            return false;
        }
        practiceData = readPracticeData();
        return true;
    }

    function awardPracticeXp(amount) {
        try {
            const raw = safeParse('MusalingoProfile', {});
            if (!Object.keys(raw).length) return false;
            raw.xp = finiteInt(raw.xp, 0) + amount;
            if (raw.dailyQuestDate === todayKey()) {
                const progress = raw.dailyQuestProgress && typeof raw.dailyQuestProgress === 'object' ? raw.dailyQuestProgress : {};
                progress.xp = finiteInt(progress.xp, 0) + amount;
                progress.practice = finiteInt(progress.practice, 0) + 1;
                raw.dailyQuestProgress = progress;
            }
            localStorage.setItem('MusalingoProfile', JSON.stringify(raw));
            profile = readProfile();
            renderStats();
            return true;
        } catch (error) {
            console.warn('[practice] Could not award XP.', error);
            return false;
        }
    }

    /* ============================================================
       WORD BANK — every word seen in lessons, with translations
       ============================================================ */
    function isMastered(word) { return (Number(word.box) || 1) >= 4; }

    function getLessonWords() {
        return practiceData.words
            .filter(word => word.courseId === courseId && !word.starter)
            .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    }

    // Vocabulary the lessons draw on for this language. Shown until the learner's own words fill the bank.
    function getStarterWords() {
        if (courseType !== 'language') return [];
        const map = window.MusalingoQuestions?.englishTranslations?.[targetLanguage];
        if (!map || typeof map !== 'object') return [];
        return Object.entries(map).map(([word, meaning]) => ({
            key: `${courseId}|${word}`, courseId, word, meaning, pronunciation: '',
            seen: 0, correct: 0, wrong: 0, box: 1, starter: true
        }));
    }

    function getBankWords() {
        const mine = getLessonWords();
        const known = new Set(mine.map(word => word.key));
        const progressed = new Map(practiceData.words.filter(word => word.courseId === courseId).map(word => [word.key, word]));
        const starters = getStarterWords()
            .filter(word => !known.has(word.key))
            .map(word => progressed.get(word.key) || word);
        return [...mine, ...starters];
    }

    function pickDeck(words, size) {
        return shuffleArray(words)
            .sort((a, b) => (Number(a.box) || 1) - (Number(b.box) || 1) || (a.lastPracticed || 0) - (b.lastPracticed || 0))
            .slice(0, size);
    }

    function recordWordResult(entry, correct) {
        const nextBox = correct ? Math.min(4, (Number(entry.box) || 1) + 1) : 1;
        updatePracticeStorage(raw => {
            const words = Array.isArray(raw.words) ? raw.words.filter(word => word && typeof word === 'object') : [];
            let item = words.find(word => word.key === entry.key);
            if (!item) {
                item = {
                    key: entry.key, courseId: entry.courseId, word: entry.word, meaning: entry.meaning,
                    pronunciation: entry.pronunciation || '', seen: 0, correct: 0, wrong: 0, box: 1,
                    firstSeen: todayKey(), starter: Boolean(entry.starter)
                };
                words.unshift(item);
            }
            item.box = nextBox;
            if (correct) item.correct = finiteInt(item.correct, 0) + 1; else item.wrong = finiteInt(item.wrong, 0) + 1;
            item.lastPracticed = Date.now();
            item.updatedAt = Date.now();
            raw.words = words.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)).slice(0, MAX_WORDS);
            return raw;
        });
        entry.box = nextBox;
        if (correct) entry.correct = finiteInt(entry.correct, 0) + 1; else entry.wrong = finiteInt(entry.wrong, 0) + 1;
    }

    /* ----- flashcard session (pure state) ----- */
    function createFlashSession(words, size = 10) {
        const deck = pickDeck(words, size);
        return { deck, index: 0, flipped: false, known: 0, learning: 0, done: deck.length === 0, xpAwarded: false };
    }
    function flashFlip(session) { if (!session.done) session.flipped = !session.flipped; return session; }
    function flashAnswer(session, knewIt) {
        if (session.done || !session.flipped) return session;
        if (knewIt) session.known++; else session.learning++;
        session.index++;
        session.flipped = false;
        if (session.index >= session.deck.length) session.done = true;
        return session;
    }

    /* ----- quiz session (pure state) ----- */
    function buildQuizQuestions(words, pool, count = 10) {
        const meaningPool = unique(pool.map(word => localizeMeaning(word.meaning)));
        const wordPool = unique(pool.map(word => word.word));
        return pickDeck(words, count).map((entry, index) => {
            const toMeaning = index % 2 === 0;
            const correct = toMeaning ? localizeMeaning(entry.meaning) : entry.word;
            const distractors = shuffleArray((toMeaning ? meaningPool : wordPool).filter(value => value !== correct)).slice(0, 3);
            if (distractors.length < 3) return null;
            return {
                entry, toMeaning, correct,
                prompt: toMeaning ? entry.word : localizeMeaning(entry.meaning),
                options: shuffleArray([correct, ...distractors])
            };
        }).filter(Boolean);
    }
    function createQuizSession(questions) {
        return { questions, index: 0, score: 0, answered: null, done: questions.length === 0, xpAwarded: false };
    }
    function quizAnswer(session, option) {
        if (session.done || session.answered !== null) return session;
        session.answered = option;
        if (option === session.questions[session.index].correct) session.score++;
        return session;
    }
    function quizNext(session) {
        if (session.done || session.answered === null) return session;
        session.index++;
        session.answered = null;
        if (session.index >= session.questions.length) session.done = true;
        return session;
    }

    /* ----- word bank UI ----- */
    const wbState = { tab: 'flashcards', flash: null, quiz: null, filter: 'all', query: '', opener: null };

    function maybeAwardSessionXp(session) {
        if (session.xpAwarded) return;
        session.xpAwarded = true;
        if (awardPracticeXp(5)) showToast('+5 XP for practicing your words!');
    }

    function renderWordBankSummary() {
        const words = getBankWords();
        const mine = words.filter(word => !word.starter).length;
        const mastered = words.filter(isMastered).length;
        $('wbSummary').textContent = words.length
            ? `${words.length} word${words.length === 1 ? '' : 's'} · ${mine} from your lessons · ${mastered} mastered`
            : 'No words yet';
    }

    function renderWordBank() {
        renderWordBankSummary();
        document.querySelectorAll('[data-wb-tab]').forEach(tab => {
            const active = tab.dataset.wbTab === wbState.tab;
            tab.classList.toggle('active', active);
            tab.setAttribute('aria-selected', active ? 'true' : 'false');
        });
        const body = $('wbBody');
        const words = getBankWords();
        if (!words.length) {
            body.innerHTML = `<div class="wb-empty"><div class="wb-empty-icon">📖</div><h3>No words yet</h3>
                <p>Finish a lesson and every new word will show up here with its translation.</p>
                <a class="primary-btn" href="dashboard.html" style="text-decoration:none;">Go to lessons</a></div>`;
            return;
        }
        if (wbState.tab === 'flashcards') renderFlashcards(body, words);
        else if (wbState.tab === 'quiz') renderQuiz(body, words);
        else renderWordList(body, words);
    }

    function renderFlashcards(body, words) {
        if (!wbState.flash) wbState.flash = createFlashSession(words, 10);
        const session = wbState.flash;
        if (session.done) {
            maybeAwardSessionXp(session);
            body.innerHTML = `<div class="wb-result"><div class="wb-empty-icon">🎉</div><h3>Nice work!</h3>
                <p>${session.known} got it · ${session.learning} still learning</p>
                <div class="wb-row"><button class="secondary-btn" type="button" id="wbAgain">Practice again</button>
                <button class="secondary-btn blue" type="button" id="wbToQuiz">Take a quiz</button></div></div>`;
            $('wbAgain').addEventListener('click', () => { wbState.flash = null; renderWordBank(); });
            $('wbToQuiz').addEventListener('click', () => { wbState.tab = 'quiz'; wbState.quiz = null; renderWordBank(); });
            return;
        }
        const entry = session.deck[session.index];
        const pct = Math.round((session.index / session.deck.length) * 100);
        body.innerHTML = `
            <div class="wb-progress"><span>${session.index + 1} / ${session.deck.length}</span>
                <span class="mini-track"><span class="mini-fill" style="width:${pct}%"></span></span></div>
            <button type="button" class="flashcard${session.flipped ? ' flipped' : ''}" id="fcCard" aria-label="Flip card">
                <span class="fc-face fc-front"><span class="fc-word">${esc(entry.word)}</span>
                    ${entry.pronunciation ? `<span class="fc-sub">${esc(entry.pronunciation)}</span>` : ''}
                    <span class="fc-hint">Tap to see the meaning</span></span>
                <span class="fc-face fc-back"><span class="fc-word">${esc(localizeMeaning(entry.meaning))}</span>
                    <span class="fc-sub">${esc(entry.word)}</span></span>
            </button>
            <div class="wb-row"><button class="secondary-btn blue" type="button" id="fcSpeak">🔊 Listen</button></div>
            <div class="fc-actions">
                <button class="wb-btn again" type="button" id="fcAgain" ${session.flipped ? '' : 'disabled'}>✗ Still learning</button>
                <button class="wb-btn good" type="button" id="fcGood" ${session.flipped ? '' : 'disabled'}>✓ Got it</button>
            </div>`;
        $('fcCard').addEventListener('click', () => { flashFlip(session); renderWordBank(); });
        $('fcSpeak').addEventListener('click', () => speak(entry.word, targetLanguage, 0.85));
        const answer = (knewIt) => {
            if (!session.flipped) return;
            recordWordResult(entry, knewIt);
            flashAnswer(session, knewIt);
            renderWordBank();
        };
        $('fcAgain').addEventListener('click', () => answer(false));
        $('fcGood').addEventListener('click', () => answer(true));
    }

    function renderQuiz(body, words) {
        if (!wbState.quiz) wbState.quiz = createQuizSession(buildQuizQuestions(words, words, 10));
        const session = wbState.quiz;
        if (!session.questions.length) {
            body.innerHTML = `<div class="wb-empty"><div class="wb-empty-icon">🧩</div><h3>Not enough words for a quiz yet</h3>
                <p>You need at least 4 different words. Try the flashcards while your word bank grows.</p>
                <button class="secondary-btn" type="button" id="wbToCards">Flashcards</button></div>`;
            $('wbToCards').addEventListener('click', () => { wbState.tab = 'flashcards'; renderWordBank(); });
            return;
        }
        if (session.done) {
            maybeAwardSessionXp(session);
            const pct = Math.round((session.score / session.questions.length) * 100);
            body.innerHTML = `<div class="wb-result"><div class="wb-empty-icon">${pct >= 70 ? '🏆' : '💪'}</div>
                <h3>${session.score} / ${session.questions.length} correct</h3><p>${pct}% accuracy</p>
                <div class="wb-row"><button class="secondary-btn" type="button" id="wbAgain">Try again</button>
                <button class="secondary-btn blue" type="button" id="wbToCards">Flashcards</button></div></div>`;
            $('wbAgain').addEventListener('click', () => { wbState.quiz = null; renderWordBank(); });
            $('wbToCards').addEventListener('click', () => { wbState.tab = 'flashcards'; wbState.flash = null; renderWordBank(); });
            return;
        }
        const question = session.questions[session.index];
        const answered = session.answered !== null;
        const pct = Math.round((session.index / session.questions.length) * 100);
        body.innerHTML = `
            <div class="wb-progress"><span>${session.index + 1} / ${session.questions.length}</span>
                <span class="mini-track"><span class="mini-fill" style="width:${pct}%"></span></span></div>
            <div class="quiz-prompt"><span class="quiz-label">${question.toMeaning ? 'What does this mean?' : 'Which word matches?'}</span>
                <span class="quiz-word">${esc(question.prompt)}</span>
                ${question.toMeaning ? '<button type="button" class="icon-btn" id="quizSpeak" aria-label="Listen">🔊</button>' : ''}</div>
            <div class="quiz-options">${question.options.map(option => {
            let cls = 'quiz-option';
            if (answered && option === question.correct) cls += ' correct';
            else if (answered && option === session.answered) cls += ' wrong';
            return `<button type="button" class="${cls}" data-option="${esc(option)}" ${answered ? 'disabled' : ''}>${esc(option)}</button>`;
        }).join('')}</div>
            ${answered ? `<div class="quiz-feedback ${session.answered === question.correct ? 'ok' : 'bad'}">
                ${session.answered === question.correct ? '✓ Correct!' : `✗ Answer: ${esc(question.correct)}`}</div>
                <div class="wb-row"><button class="secondary-btn" type="button" id="quizNext">${session.index + 1 >= session.questions.length ? 'Finish' : 'Next'}</button></div>` : ''}`;
        $('quizSpeak')?.addEventListener('click', () => speak(question.entry.word, targetLanguage, 0.85));
        body.querySelectorAll('[data-option]').forEach(button => {
            button.addEventListener('click', () => {
                if (session.answered !== null) return;
                const option = button.dataset.option;
                quizAnswer(session, option);
                recordWordResult(question.entry, option === question.correct);
                if (question.toMeaning) speak(question.entry.word, targetLanguage, 0.85);
                renderWordBank();
            });
        });
        $('quizNext')?.addEventListener('click', () => { quizNext(session); renderWordBank(); });
    }

    function renderWordList(body, words) {
        const query = wbState.query.trim().toLowerCase();
        const filtered = words.filter(word => {
            if (wbState.filter === 'learning' && isMastered(word)) return false;
            if (wbState.filter === 'mastered' && !isMastered(word)) return false;
            if (wbState.filter === 'lessons' && word.starter) return false;
            if (!query) return true;
            return `${word.word} ${word.meaning} ${localizeMeaning(word.meaning)} ${word.pronunciation || ''}`.toLowerCase().includes(query);
        });
        const chip = (id, label) => `<button type="button" class="wb-chip${wbState.filter === id ? ' active' : ''}" data-filter="${id}">${label}</button>`;
        body.innerHTML = `
            <input type="search" class="wb-search" id="wbSearch" placeholder="Search words or meanings" value="${esc(wbState.query)}" aria-label="Search words">
            <div class="wb-chips">${chip('all', 'All')}${chip('lessons', 'From my lessons')}${chip('learning', 'Learning')}${chip('mastered', 'Mastered')}</div>
            <ul class="wb-list">${filtered.length ? filtered.map((word, index) => `
                <li class="wb-item">
                    <button type="button" class="icon-btn" data-speak="${index}" aria-label="Listen to ${esc(word.word)}">🔊</button>
                    <span class="wb-item-text"><strong>${esc(word.word)}</strong>
                        ${word.pronunciation ? `<span class="wb-pron">${esc(word.pronunciation)}</span>` : ''}
                        <span class="wb-meaning">${esc(localizeMeaning(word.meaning))}</span></span>
                    <span class="wb-item-stats" title="Right / wrong in practice">${isMastered(word) ? '⭐' : ''} ✓${finiteInt(word.correct, 0)} ✗${finiteInt(word.wrong, 0)}</span>
                </li>`).join('') : '<li class="wb-none">No words match.</li>'}</ul>`;
        body.querySelectorAll('[data-speak]').forEach(button => {
            button.addEventListener('click', () => speak(filtered[Number(button.dataset.speak)].word, targetLanguage, 0.85));
        });
        body.querySelectorAll('[data-filter]').forEach(button => {
            button.addEventListener('click', () => { wbState.filter = button.dataset.filter; renderWordBank(); });
        });
        const search = $('wbSearch');
        search.addEventListener('input', () => {
            wbState.query = search.value;
            const caret = search.selectionStart;
            renderWordBank();
            const again = $('wbSearch');
            if (again) { again.focus(); try { again.setSelectionRange(caret, caret); } catch (error) { /* ignore */ } }
        });
    }

    function openWordBank(opener) {
        if (!activeCourse || courseType !== 'language') return;
        wbState.opener = opener || document.activeElement;
        wbState.tab = 'flashcards';
        wbState.flash = null;
        wbState.quiz = null;
        wbState.query = '';
        wbState.filter = 'all';
        $('wordBankOverlay').hidden = false;
        document.body.classList.add('overlay-open');
        renderWordBank();
        $('wbClose').focus();
    }

    function closeWordBank() {
        $('wordBankOverlay').hidden = true;
        document.body.classList.remove('overlay-open');
        renderPracticeGrid();
        if (wbState.opener && typeof wbState.opener.focus === 'function') wbState.opener.focus();
    }

    function initWordBank() {
        $('wbClose').addEventListener('click', closeWordBank);
        $('wordBankOverlay').addEventListener('click', (event) => { if (event.target === $('wordBankOverlay')) closeWordBank(); });
        document.querySelectorAll('[data-wb-tab]').forEach(tab => {
            tab.addEventListener('click', () => {
                wbState.tab = tab.dataset.wbTab;
                if (wbState.tab === 'flashcards') wbState.flash = null;
                if (wbState.tab === 'quiz') wbState.quiz = null;
                renderWordBank();
            });
        });
        document.addEventListener('keydown', (event) => {
            if ($('wordBankOverlay').hidden) return;
            if (event.key === 'Escape') { closeWordBank(); return; }
            if (wbState.tab !== 'flashcards' || !wbState.flash || wbState.flash.done) return;
            if (event.target && /^(INPUT|TEXTAREA|SELECT)$/.test(event.target.tagName)) return;
            if (event.key === ' ' || event.key === 'Enter') { if (event.target.id === 'fcCard') return; event.preventDefault(); flashFlip(wbState.flash); renderWordBank(); }
            else if (event.key === 'ArrowLeft' && wbState.flash.flipped) $('fcAgain')?.click();
            else if (event.key === 'ArrowRight' && wbState.flash.flipped) $('fcGood')?.click();
        });
    }



    /* ============================================================
     TALK TO COACH — shared coach.js
     ============================================================ */
    const coachFactory = window.MusalingoCoach;
    if (!coachFactory || typeof coachFactory.createCoach !== 'function') {
        console.error('[practice] coach.js missing or failed to load; coach disabled.');
    }
    const coach = (coachFactory && typeof coachFactory.createCoach === 'function')
        ? coachFactory.createCoach({
            courseType,
            courseId,
            courseName,
            targetLanguage,
            audienceLanguage,
            getBankWords,
            getMistakes: () => practiceData.mistakes.filter(m => m.courseId === courseId),
            localizeMeaning,
            showToast,
            els: {
                chat: $('coachChat'),
                input: $('coachInput'),
                send: $('coachSend'),
                mic: $('coachMic'),
                orb: $('coachOrb'),
                orbIcon: $('coachOrbIcon'),
                orbLabel: $('coachOrbLabel'),
                status: $('coachStatus'),
                chips: $('coachChips'),
                close: $('coachClose'),
                voiceToggle: $('coachVoiceToggle'),
                speakSelect: $('coachSpeakLang'),
                panel: $('coachPanel')
            }
        })
        : {
            // Stub so the rest of the page keeps working when coach.js is missing.
            ask: () => console.warn('[practice] coach unavailable'),
            open: () => console.warn('[practice] coach unavailable'),
            close: () => { },
            clear: () => { },
            init: () => { },
            startListening: () => { },
            stopListening: () => { },
            buildPrompt: () => '',
            state: { history: [] }
        };

    function coachChips() {
        if (courseType === 'language') {
            return [
                { label: '👋 Say hello', text: 'Hello! Can we practice a simple conversation?' },
                { label: '📖 Quiz me on my words', text: 'Quiz me on my words, one word at a time.', includeWords: true },
                { label: '💡 Teach me a phrase', text: 'Teach me one useful phrase for beginners.' },
                { label: '✏️ Check my sentence', fill: 'Please check my sentence: ' }
            ];
        }
        if (courseType === 'chess') return [
            { label: '♟️ Explain a fork', text: 'Explain what a fork is in chess.' },
            { label: '♘ Opening tips', text: 'What are the most important opening principles?' }
        ];
        if (courseType === 'math') return [
            { label: '➗ Explain fractions', text: 'Explain fractions simply.' },
            { label: '🧮 Give me a problem', text: 'Give me one practice problem for my level.' }
        ];
        return [
            { label: '🎵 What is an interval?', text: 'What is a musical interval?' },
            { label: '🎼 Explain chords', text: 'Explain major and minor chords simply.' }
        ];
    }

    function initCoach() {
        const orbContainer = $('coachOrbWrap');
        if (!activeCourse) { orbContainer.hidden = true; return; }
        $('coachTitle').textContent = `🤖 ${courseType === 'language' ? targetLanguage + ' coach' : courseName + ' coach'}`;
        const greeting = courseType === 'language'
            ? `Hi! Let's practice ${targetLanguage}. Tap the mic and talk, or type a message.`
            : `Hi! Ask me anything about ${courseName.toLowerCase()}.`;
        coach.init(greeting, coachChips());

        // Clear-chat button (added in the panel header by practice.html; harmless if absent)
        const clearBtn = document.getElementById('coachClear');
        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                coach.clear();
                coach.init(greeting, coachChips());
            });
        }

        $('heroCoachBtn').addEventListener('click', () => coach.open({ listen: false }));
    }

    // Small, stable surface for tests and other pages.
    window.MusalingoPractice = {
        createFlashSession, flashFlip, flashAnswer, buildQuizQuestions, createQuizSession, quizAnswer, quizNext,
        buildCoachPrompt: (text, include) => coach.buildPrompt(text, include),
        getBankWords, localizeMeaning, resolveLanguage, openWordBank,
        openCoach: (opts) => coach.open(opts),
        askCoach: (text, opts) => coach.ask(text, opts),
        get state() { return { coachHistory: coach.state.history, targetLanguage, audienceLanguage }; }
    };

    /* ============================================================
       BOOT
       ============================================================ */

    initWordBank();
    initCoach();
    renderCourseChip();
    renderHero();
    renderPracticeGrid();
    renderSkills();
    renderStats();

    // Shuffle button
    $('shufflePractice').addEventListener('click', () => {
        if (!activeCourse) { window.location.href = 'catalog.html'; return; }
        const mode = PRACTICE_MODES[Math.floor(Math.random() * PRACTICE_MODES.length)].mode;
        startPractice(mode);
    });

    // Hero "Start a quick review"
    document.querySelector('.primary-btn[data-mode="mistakes"]')?.addEventListener('click', () => {
        if (courseType === 'language') {
            startPractice('mistakes');
        } else {
            // Non-language: use "mixed" instead
            startPractice('mixed');
        }
    });

    // Storage sync
    window.addEventListener('storage', (event) => {
        if (event.key === 'MusalingoProfile') {
            profile = readProfile();
            renderStats();
        }
        if (event.key === PRACTICE_KEY) {
            practiceData = readPracticeData();
            renderPracticeGrid();
            if (!$('wordBankOverlay').hidden) renderWordBankSummary();
        }
    });
})();