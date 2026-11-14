import { Chess } from '/vendor/chess/chess.js';

const audienceData = window.MusalingoAudience || {
    languageCodes: { English: 'en', Spanish: 'es', French: 'fr', Japanese: 'ja', Hindi: 'hi' },
    languageNames: {},
    translations: {},
    hints: {},
    catalogGroups: []
};

/* ============================================================
   Musalingo — lesson.js (v3)
   Features:
     • 10 language question types
     • Multi-move chess sequences
     • King hiding on non-king-relevant puzzles
     • Exit confirmation when lesson is in progress
     • AI/Offline source badge with error codes
     • Clean fallback messaging
   ============================================================ */

const savedTheme = JSON.parse(localStorage.getItem('MusalingoSettings') || '{}');
document.body.classList.toggle('dark-mode', savedTheme.theme === 'dark');

// ---------- URL PARAMS ----------
const urlParams = new URLSearchParams(window.location.search);
const courseId = urlParams.get('courseId');
const lessonId = urlParams.get('lessonId');
const isReview = urlParams.get('review') === '1';
const practiceMode = urlParams.get('practiceMode') || 'mixed';
const level = Number(urlParams.get('level')) || 1;
if (isReview) document.body.classList.add('practice-mode');

// ---------- SAFE AUDIO WRAPPER ----------
function playSound(name, arg) {
    try {
        if (typeof window.SFX !== 'undefined' && typeof window.SFX[name] === 'function') {
            if (arg !== undefined) window.SFX[name](arg);
            else window.SFX[name]();
        }
    } catch (e) {
        console.warn(`[lesson.js] Sound failed: ${name}`, e);
    }
}

// ---------- SOURCE BADGE HELPERS ----------
const SOURCE_BADGES = {
    ai: { label: 'AI-generated', color: '#278a44', icon: '✨' },
    fallback: { label: 'Offline questions', color: '#b45309', icon: '📴' },
    mixed: { label: 'AI + offline', color: '#7c3aed', icon: '🔀' },
    'built-in': { label: 'Built-in', color: '#2563eb', icon: '📚' },
    review: { label: 'Review', color: '#0ea5e9', icon: '🎯' }
};

const ERROR_CODES = {
    E10: 'No Gemini API keys configured on the server',
    E11: 'Gemini API returned 401 (key invalid or revoked)',
    E12: 'Gemini API returned 403 (key forbidden or quota exceeded)',
    E20: 'Rate limited — too many requests, try again in a minute',
    E21: 'Daily quota exhausted on all API keys',
    E30: 'Gemini model not found on this API version',
    E40: 'Gemini request timed out',
    E50: 'All Gemini attempts failed (unknown reason)',
    E60: 'Network error talking to Gemini',
    E70: 'Empty response from Gemini (safety filter or malformed JSON)',
    E99: 'Unexpected error'
};

function errorLabel(code) {
    return `${code} — ${ERROR_CODES[code] || 'Unknown error'}`;
}

function extractErrorCode(message) {
    if (!message) return 'E99';
    const text = String(message).toLowerCase();
    if (text.includes('no gemini') || text.includes('no gemini api keys')) return 'E10';
    if (text.includes('unauthorized') || text.includes('http 401')) return 'E11';
    if (text.includes('forbidden') || text.includes('http 403')) return 'E12';
    if (text.includes('rate limited (daily)') || text.includes('daily quota')) return 'E21';
    if (text.includes('rate limited') || text.includes('http 429')) return 'E20';
    if (text.includes('model not found') || text.includes('http 404')) return 'E30';
    if (text.includes('timeout') || text.includes('abort')) return 'E40';
    if (text.includes('empty')) return 'E70';
    if (text.includes('network') || text.includes('fetch')) return 'E60';
    return 'E50';
}

function setSourceBadge(element, source, errorMessage) {
    if (!element) return;
    const badge = SOURCE_BADGES[source] || SOURCE_BADGES.fallback;
    let label = badge.label;
    if (source === 'fallback' && errorMessage) {
        const code = extractErrorCode(errorMessage);
        label = `Offline questions (${code})`;
        element.title = errorLabel(code);
    } else if (source === 'fallback') {
        element.title = 'AI unavailable — using local questions';
    } else {
        element.title = `${badge.label} — source: ${source}`;
    }
    element.textContent = `${badge.icon} ${label}`;
    element.style.color = badge.color;
    element.style.fontWeight = '700';
    element.style.fontSize = '0.85rem';
    element.style.marginLeft = '8px';
}

// ---------- FALLBACK QUESTIONS (questions.js) ----------
function buildFallbackQuestions(language, topic, count, audienceLanguage, unitIndex, practiceMode) {
    const bank = window.MusalingoQuestions;
    if (!bank || typeof bank.generateFallbackQuestions !== 'function') {
        throw new Error('Question bank did not load. Make sure lesson.html includes questions.js before lesson.js.');
    }
    return bank.generateFallbackQuestions(language, topic, count, audienceLanguage, { unitIndex, practiceMode, localizeMeaning: localizeEnglishMeaning });
}

// ---------- FETCH AI QUESTIONS ----------
async function fetchAIQuestions(topic, language, count = 10, level = 1, learningProfile = null, unitIndex = null, audienceLanguage = 'English', practiceMode = '') {
    let errorMessage = null;
    try {
        const res = await fetch('/api/generate-questions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                topic, language, audienceLanguage, count, level, unitIndex,
                noNonsense: savedTheme.noNonsense === true,
                reason: learningProfile?.reason || 'curiosity',
                goal: learningProfile?.goal || 'confidence',
                experience: learningProfile?.experience || 'new',
                practiceMode
            })
        });

        const sourceHeader = res.headers.get('X-Musal-Question-Source') || 'unknown';

        if (!res.ok) {
            errorMessage = `HTTP ${res.status}`;
            console.warn('⚠️ AI failed, using FALLBACK questions. Status:', res.status);
            return {
                questions: buildFallbackQuestions(language, topic, count, audienceLanguage, unitIndex, practiceMode),
                source: 'fallback',
                error: errorMessage
            };
        }

        const data = await res.json();
        if (Array.isArray(data) && data.length) {
            // Server-built fallback only knows English meanings. For language courses, the client bank
            // (questions.js) covers every language and translates meanings for the learner's own language.
            if (sourceHeader === 'fallback' && !/^(chess|math|music)$/i.test(String(language).trim())) {
                try {
                    return { questions: buildFallbackQuestions(language, topic, count, audienceLanguage, unitIndex, practiceMode), source: 'fallback', error: null };
                } catch (bankError) {
                    console.warn('Client question bank unavailable, using server fallback:', bankError);
                }
            }
            return { questions: data, source: sourceHeader === 'ai' ? 'ai' : sourceHeader, error: null };
        }
        if (Array.isArray(data?.questions) && data.questions.length) {
            return { questions: data.questions, source: data.source || sourceHeader, error: null };
        }

        errorMessage = 'Empty response';
        return {
            questions: buildFallbackQuestions(language, topic, count, audienceLanguage, unitIndex, practiceMode),
            source: 'fallback',
            error: errorMessage
        };
    } catch (error) {
        errorMessage = error?.message || 'Unknown network error';
        console.warn('AI fetch failed:', error);
        return {
            questions: buildFallbackQuestions(language, topic, count, audienceLanguage, unitIndex, practiceMode),
            source: 'fallback',
            error: errorMessage
        };
    }
}

/* ============ PROFILE ============ */
function createDefaultProfile() {
    return { email: '', name: 'Guest learner', streak: 0, diamonds: 100, hearts: 5, lastActiveDate: null, lastLessonDate: null, streakStatus: 'inactive', selectedCourse: null, courses: [], inventory: [], streakFreezes: 0, streakFreezeDates: [] };
}
function loadProfile() {
    const s = localStorage.getItem('MusalingoProfile');
    if (!s) return createDefaultProfile();
    try {
        const p = JSON.parse(s);
        if (!p) return createDefaultProfile();
        p.courses = Array.isArray(p.courses) ? p.courses : [];
        p.inventory = Array.isArray(p.inventory) ? p.inventory : [];
        const d = Number(p.diamonds); p.diamonds = Number.isFinite(d) ? Math.max(0, Math.floor(d)) : 100;
        const h = Number(p.hearts); p.hearts = Number.isFinite(h) ? Math.max(0, Math.floor(h)) : 5;
        return p;
    } catch { return createDefaultProfile(); }
}
function saveProfile(p) { localStorage.setItem('MusalingoProfile', JSON.stringify(p)); }

const HEART_CAP = 5;
const HEART_REFILL_INTERVAL = 30 * 60 * 1000;
const profile = loadProfile();

function updateHeartRefill(now = Date.now()) {
    const prevH = profile.hearts, prevR = profile.heartRefillAt;
    const hearts = Number(profile.hearts);
    profile.hearts = Number.isFinite(hearts) ? Math.max(0, Math.min(HEART_CAP, Math.floor(hearts))) : HEART_CAP;
    const refillAt = Number(profile.heartRefillAt);
    if (profile.hearts >= HEART_CAP) { profile.hearts = HEART_CAP; delete profile.heartRefillAt; }
    else if (!Number.isFinite(refillAt) || refillAt <= 0) profile.heartRefillAt = now + HEART_REFILL_INTERVAL;
    else if (now >= refillAt) {
        const refilled = Math.floor((now - refillAt) / HEART_REFILL_INTERVAL) + 1;
        profile.hearts = Math.min(HEART_CAP, profile.hearts + refilled);
        if (profile.hearts === HEART_CAP) delete profile.heartRefillAt;
        else profile.heartRefillAt = refillAt + refilled * HEART_REFILL_INTERVAL;
    }
    return prevH !== profile.hearts || prevR !== profile.heartRefillAt;
}

const course = profile?.courses?.find((c) => c.id === courseId);
const lesson = course?.lessons?.find((l) => l.id === lessonId) || course?.lessons?.[0];

const lessonTitle = document.getElementById('lessonTitle');
const lessonSubtitle = document.getElementById('lessonSubtitle');
const promptText = document.getElementById('promptText');
const audioControls = document.getElementById('audioControls');
const normalVoiceBtn = document.getElementById('normalVoiceBtn');
const slowVoiceBtn = document.getElementById('slowVoiceBtn');
const options = document.getElementById('options');
const feedback = document.getElementById('feedback');
const chessActivity = document.getElementById('chessActivity');
const statusText = document.getElementById('statusText');
const exitBtn = document.getElementById('exitBtn');
const checkBtn = document.getElementById('checkBtn');
const nextBtn = document.getElementById('nextBtn');
const finishBtn = document.getElementById('finishBtn');
const hintBtn = document.getElementById('hintBtn');
const completionPanel = document.getElementById('completionPanel');
const completionAccuracy = document.getElementById('completionAccuracy');
const completionXp = document.getElementById('completionXp');
const heartGauge = document.getElementById('heartGauge');
const heartGaugeCount = document.getElementById('heartGaugeCount');
const promptHeading = document.getElementById('promptHeading');
const completionHeading = document.getElementById('completionHeading');
const accuracyLabel = document.getElementById('accuracyLabel');
const xpEarnedLabel = document.getElementById('xpEarnedLabel');
const backDashboardLink = document.getElementById('backDashboardLink');

// Inject source badge next to the subtitle
const sourceBadge = document.createElement('span');
sourceBadge.id = 'lessonSourceBadge';
sourceBadge.style.marginLeft = '8px';
sourceBadge.style.fontSize = '0.85rem';
sourceBadge.style.fontWeight = '700';
sourceBadge.textContent = '';
lessonSubtitle.appendChild(sourceBadge);

function renderHeartGauge() {
    if (!heartGauge || !heartGaugeCount) return;
    const heartsDisabled = savedTheme.noHearts || savedTheme.noGamification;
    const hearts = heartsDisabled ? HEART_CAP : Math.max(0, Math.min(HEART_CAP, profile.hearts));
    heartGaugeCount.textContent = heartsDisabled ? '∞' : String(hearts);
    heartGauge.setAttribute('aria-label', heartsDisabled ? lessonText('unlimitedHearts') : lessonText('heartsCount', { count: hearts }));
    heartGauge.title = heartsDisabled ? lessonText('heartsDisabled') : lessonText('heartsCount', { count: hearts });
}

function shuffle(arr) {
    const c = [...arr];
    for (let i = c.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1));[c[i], c[j]] = [c[j], c[i]]; }
    return c;
}

function normalizeLanguageName(language) {
    const value = String(language || '').trim();
    if (!value) return 'English';
    const map = { telugu: 'Telugu', japanese: 'Japanese', spanish: 'Spanish', french: 'French', german: 'German', italian: 'Italian', arabic: 'Arabic', hindi: 'Hindi', english: 'English', chinese: 'Chinese', korean: 'Korean', portuguese: 'Portuguese', russian: 'Russian', turkish: 'Turkish', music: 'Music', chess: 'Chess', math: 'Math' };
    return map[value.toLowerCase()] || value;
}

const LESSON_COPY = {
    English: {
        practicePrompt: 'Practice prompt', loadingLesson: 'Loading lesson…', generatingQuestions: 'Generating lesson questions…',
        askingAI: 'Asking the AI for fresh questions…', lessonNotFound: 'Lesson not found', missingLesson: 'This lesson is missing.',
        noLesson: 'No lesson available.', exit: 'Exit', hint: 'Hint', check: 'Check', next: 'Next', finish: 'Finish lesson',
        outOfHearts: 'Out of hearts', needHeart: 'You need at least one heart to start a lesson.',
        buyOrWait: 'Buy a heart with diamonds or wait 30 minutes for one to refill.',
        translateTarget: 'Translate into {language}:', translateAudience: 'Translate into {language}:',
        arrange: 'Arrange:', listen: 'What did you hear?', say: 'Say:', spell: 'Listen and spell:',
        typeWhatHeard: 'Type what you hear…',
        matchPairs: 'Match the pairs', startSpeaking: '🎤 Start speaking', cantSpeak: "I can't speak",
        listening: 'Listening…', chooseAnswer: 'Choose an answer first.', answerFirst: 'Answer first.',
        correct: 'Correct! Great job.', incorrect: 'Not quite — correct answer: {answer}', tryAgain: 'Try again',
        finishQuestions: 'Finish all questions first.', retryQuestions: 'Try the same questions again.',
        questionNumber: 'Question {current} of {total}', finishAll: 'You finished all the questions.',
        completeSaved: 'Lesson complete. Your learning progress has been saved.',
        resultsReady: 'Your lesson results are ready.', practiceLabel: 'Practice prompt',
        completeTitle: 'Lesson complete!', accuracy: 'Accuracy', xpEarned: 'XP earned', backDashboard: 'Back to dashboard',
        completeToEarn: 'Complete the lesson to earn rewards.', aiPractice: 'AI-generated practice',
        offlinePractice: 'Practice set (offline mode)', loadQuestionsError: 'Could not load questions. Check the server.',
        questionSkipped: 'Question skipped.', notMatch: 'Not a match. Try again.',
        normalVoice: 'Normal', slowVoice: 'Slow', heartsCount: 'Hearts: {count}', unlimitedHearts: 'Unlimited hearts', heartsDisabled: 'Hearts are disabled in settings',
        continueSpeaking: 'Are you sure you want to skip speaking questions for the rest of this lesson?',
        speechUnsupported: 'Speech recognition is not supported here.', takeYourTime: 'Take your time.',
        aiBadge: 'AI-generated', offlineBadge: 'Offline questions',
        exitConfirm: 'Are you sure you want to exit? Your current lesson progress will not be saved.',
        exitConfirmTitle: 'Exit lesson?',
        exitConfirmCancel: 'Keep learning',
        exitConfirmLeave: 'Exit anyway'
    },
    Spanish: {
        practicePrompt: 'Instrucciones', loadingLesson: 'Cargando lección…', generatingQuestions: 'Generando preguntas…',
        askingAI: 'Preparando preguntas para tu lección…', lessonNotFound: 'Lección no encontrada', missingLesson: 'No se encontró esta lección.',
        noLesson: 'No hay ninguna lección disponible.', exit: 'Salir', hint: 'Pista', check: 'Comprobar', next: 'Siguiente', finish: 'Terminar lección',
        outOfHearts: 'Te has quedado sin corazones', needHeart: 'Necesitas al menos un corazón para empezar una lección.',
        buyOrWait: 'Compra un corazón con diamantes o espera 30 minutos para que se recargue.',
        translateTarget: 'Traduce al {language}:', translateAudience: 'Traduce al {language}:',
        arrange: 'Ordena:', listen: '¿Qué has oído?', say: 'Di:', spell: 'Escucha y escribe:',
        typeWhatHeard: 'Escribe lo que oyes…',
        matchPairs: 'Une las parejas', startSpeaking: '🎤 Empezar a hablar', cantSpeak: 'No puedo hablar',
        listening: 'Escuchando…', chooseAnswer: 'Elige una respuesta primero.', answerFirst: 'Responde primero.',
        correct: '¡Correcto! ¡Muy bien!', incorrect: 'No exactamente. La respuesta correcta es: {answer}', tryAgain: 'Intentar de nuevo',
        finishQuestions: 'Responde todas las preguntas primero.', retryQuestions: 'Inténtalo de nuevo con las mismas preguntas.',
        questionNumber: 'Pregunta {current} de {total}', finishAll: 'Has terminado todas las preguntas.',
        completeSaved: 'Lección completada. Se ha guardado tu progreso.',
        resultsReady: 'Ya puedes ver los resultados de la lección.', practiceLabel: 'Instrucciones',
        completeTitle: '¡Lección completada!', accuracy: 'Precisión', xpEarned: 'XP ganados', backDashboard: 'Volver al panel',
        completeToEarn: 'Completa la lección para ganar recompensas.', aiPractice: 'Práctica generada por IA',
        offlinePractice: 'Práctica sin conexión', loadQuestionsError: 'No se pudieron cargar las preguntas. Comprueba el servidor.',
        questionSkipped: 'Pregunta omitida.', notMatch: 'No coincide. Inténtalo de nuevo.',
        normalVoice: 'Normal', slowVoice: 'Lento', heartsCount: 'Corazones: {count}', unlimitedHearts: 'Corazones ilimitados', heartsDisabled: 'Los corazones están desactivados en los ajustes',
        continueSpeaking: '¿Seguro que quieres saltarte las preguntas habladas durante el resto de esta lección?',
        speechUnsupported: 'El reconocimiento de voz no está disponible aquí.', takeYourTime: 'Tómate tu tiempo.',
        aiBadge: 'Generado por IA', offlineBadge: 'Preguntas sin conexión',
        exitConfirm: '¿Seguro que quieres salir? El progreso de esta lección no se guardará.',
        exitConfirmTitle: '¿Salir de la lección?',
        exitConfirmCancel: 'Seguir aprendiendo',
        exitConfirmLeave: 'Salir de todos modos'
    },
    French: {
        practicePrompt: 'Consigne', loadingLesson: 'Chargement de la leçon…', generatingQuestions: 'Génération des questions…',
        askingAI: 'Préparation des questions…', lessonNotFound: 'Leçon introuvable', missingLesson: 'Cette leçon est introuvable.',
        noLesson: 'Aucune leçon disponible.', exit: 'Quitter', hint: 'Indice', check: 'Vérifier', next: 'Suivant', finish: 'Terminer la leçon',
        outOfHearts: 'Plus de cœurs', needHeart: 'Il vous faut au moins un cœur pour commencer une leçon.',
        buyOrWait: 'Achetez un cœur avec des diamants ou attendez 30 minutes qu’il se recharge.',
        translateTarget: 'Traduisez en {language} :', translateAudience: 'Traduisez en {language} :',
        arrange: 'Remettez dans l’ordre :', listen: 'Qu’avez-vous entendu ?', say: 'Dites :', spell: 'Écoutez et écrivez :',
        typeWhatHeard: 'Saisissez ce que vous entendez…',
        matchPairs: 'Associez les éléments', startSpeaking: '🎤 Commencer à parler', cantSpeak: 'Je ne peux pas parler',
        listening: 'Écoute en cours…', chooseAnswer: 'Choisissez d’abord une réponse.', answerFirst: 'Répondez d’abord.',
        correct: 'Correct ! Bravo !', incorrect: 'Pas tout à fait. La bonne réponse est : {answer}', tryAgain: 'Réessayer',
        finishQuestions: 'Répondez d’abord à toutes les questions.', retryQuestions: 'Réessayez avec les mêmes questions.',
        questionNumber: 'Question {current} sur {total}', finishAll: 'Vous avez terminé toutes les questions.',
        completeSaved: 'Leçon terminée. Votre progression a été enregistrée.',
        resultsReady: 'Les résultats de votre leçon sont prêts.', practiceLabel: 'Consigne',
        completeTitle: 'Leçon terminée !', accuracy: 'Précision', xpEarned: 'XP gagnés', backDashboard: 'Retour au tableau de bord',
        completeToEarn: 'Terminez la leçon pour gagner des récompenses.', aiPractice: 'Exercices générés par l’IA',
        offlinePractice: 'Exercices hors ligne', loadQuestionsError: 'Impossible de charger les questions. Vérifiez le serveur.',
        questionSkipped: 'Question ignorée.', notMatch: 'Ce n’est pas une correspondance. Réessayez.',
        normalVoice: 'Normal', slowVoice: 'Lent', heartsCount: 'Cœurs : {count}', unlimitedHearts: 'Cœurs illimités', heartsDisabled: 'Les cœurs sont désactivés dans les paramètres',
        continueSpeaking: 'Voulez-vous vraiment ignorer les exercices oraux pour le reste de cette leçon ?',
        speechUnsupported: 'La reconnaissance vocale n’est pas disponible ici.', takeYourTime: 'Prenez votre temps.',
        aiBadge: 'Généré par IA', offlineBadge: 'Questions hors ligne',
        exitConfirm: 'Voulez-vous vraiment quitter ? Votre progression actuelle ne sera pas enregistrée.',
        exitConfirmTitle: 'Quitter la leçon ?',
        exitConfirmCancel: 'Continuer',
        exitConfirmLeave: 'Quitter quand même'
    },
    Japanese: {
        practicePrompt: '練習の指示', loadingLesson: 'レッスンを読み込み中…', generatingQuestions: '問題を作成中…',
        askingAI: 'レッスンの問題を準備しています…', lessonNotFound: 'レッスンが見つかりません', missingLesson: 'このレッスンは見つかりません。',
        noLesson: '利用できるレッスンはありません。', exit: '終了', hint: 'ヒント', check: '答え合わせ', next: '次へ', finish: 'レッスンを終了',
        outOfHearts: 'ハートがありません', needHeart: 'レッスンを始めるにはハートが1つ以上必要です。',
        buyOrWait: 'ダイヤでハートを購入するか、30分待つと回復します。',
        translateTarget: '{language}に翻訳してください：', translateAudience: '{language}に翻訳してください：',
        arrange: '正しい順に並べてください：', listen: '何と聞こえましたか？', say: '声に出してください：', spell: '聞いて書いてください：',
        typeWhatHeard: '聞こえた内容を入力…',
        matchPairs: '組み合わせてください', startSpeaking: '🎤 話し始める', cantSpeak: '話せません',
        listening: '聞き取り中…', chooseAnswer: '先に答えを選んでください。', answerFirst: '先に答えてください。',
        correct: '正解です！よくできました。', incorrect: '残念！正解は「{answer}」です。', tryAgain: 'もう一度',
        finishQuestions: '先にすべての問題に答えてください。', retryQuestions: '同じ問題でもう一度挑戦しましょう。',
        questionNumber: '{total}問中{current}問目', finishAll: 'すべての問題が終わりました。',
        completeSaved: 'レッスン完了。学習の進捗を保存しました。',
        resultsReady: 'レッスンの結果を確認できます。', practiceLabel: '練習の指示',
        completeTitle: 'レッスン完了！', accuracy: '正答率', xpEarned: '獲得XP', backDashboard: 'ダッシュボードに戻る',
        completeToEarn: 'レッスンを完了して報酬を獲得しましょう。', aiPractice: 'AIが作成した練習問題',
        offlinePractice: 'オフライン練習', loadQuestionsError: '問題を読み込めません。サーバーを確認してください。',
        questionSkipped: '問題をスキップしました。', notMatch: '一致しません。もう一度試してください。',
        normalVoice: '通常', slowVoice: 'ゆっくり', heartsCount: 'ハート：{count}', unlimitedHearts: 'ハート無制限', heartsDisabled: '設定でハートが無効になっています',
        continueSpeaking: 'このレッスンの残りのスピーキング問題をスキップしますか？',
        speechUnsupported: 'この環境では音声認識を利用できません。', takeYourTime: '落ち着いて考えてください。',
        aiBadge: 'AI生成', offlineBadge: 'オフライン問題',
        exitConfirm: '本当に終了しますか？このレッスンの進捗は保存されません。',
        exitConfirmTitle: 'レッスンを終了しますか？',
        exitConfirmCancel: '学習を続ける',
        exitConfirmLeave: '終了する'
    },
    Hindi: {
        practicePrompt: 'अभ्यास निर्देश', loadingLesson: 'पाठ लोड हो रहा है…', generatingQuestions: 'प्रश्न तैयार हो रहे हैं…',
        askingAI: 'पाठ के प्रश्न तैयार किए जा रहे हैं…', lessonNotFound: 'पाठ नहीं मिला', missingLesson: 'यह पाठ उपलब्ध नहीं है।',
        noLesson: 'कोई पाठ उपलब्ध नहीं है।', exit: 'बाहर जाएँ', hint: 'संकेत', check: 'जाँचें', next: 'अगला', finish: 'पाठ समाप्त करें',
        outOfHearts: 'दिल खत्म हो गए', needHeart: 'पाठ शुरू करने के लिए कम से कम एक दिल चाहिए।',
        buyOrWait: 'हीरे से दिल खरीदें या उसके वापस आने के लिए 30 मिनट प्रतीक्षा करें।',
        translateTarget: '{language} में अनुवाद करें:', translateAudience: '{language} में अनुवाद करें:',
        arrange: 'सही क्रम में लगाएँ:', listen: 'आपने क्या सुना?', say: 'बोलें:', spell: 'सुनें और लिखें:',
        typeWhatHeard: 'जो सुनाई दे उसे लिखें…',
        matchPairs: 'जोड़े मिलाएँ', startSpeaking: '🎤 बोलना शुरू करें', cantSpeak: 'मैं बोल नहीं सकता/सकती',
        listening: 'सुना जा रहा है…', chooseAnswer: 'पहले एक उत्तर चुनें।', answerFirst: 'पहले उत्तर दें।',
        correct: 'सही! बहुत बढ़िया।', incorrect: 'सही नहीं। सही उत्तर है: {answer}', tryAgain: 'फिर से कोशिश करें',
        finishQuestions: 'पहले सभी प्रश्नों के उत्तर दें।', retryQuestions: 'इन्हीं प्रश्नों को फिर से हल करें।',
        questionNumber: 'प्रश्न {current}/{total}', finishAll: 'आपने सभी प्रश्न पूरे कर लिए।',
        completeSaved: 'पाठ पूरा हुआ। आपकी प्रगति सहेज ली गई है।',
        resultsReady: 'आपके पाठ के नतीजे तैयार हैं।', practiceLabel: 'अभ्यास निर्देश',
        completeTitle: 'पाठ पूरा हुआ!', accuracy: 'सटीकता', xpEarned: 'XP मिले', backDashboard: 'डैशबोर्ड पर जाएँ',
        completeToEarn: 'इनाम पाने के लिए पाठ पूरा करें।', aiPractice: 'AI से तैयार अभ्यास',
        offlinePractice: 'ऑफ़लाइन अभ्यास', loadQuestionsError: 'प्रश्न लोड नहीं हुए। सर्वर जाँचें।',
        questionSkipped: 'प्रश्न छोड़ दिया गया।', notMatch: 'जोड़ा सही नहीं है। फिर कोशिश करें।',
        normalVoice: 'सामान्य', slowVoice: 'धीमा', heartsCount: 'दिल: {count}', unlimitedHearts: 'असीमित दिल', heartsDisabled: 'सेटिंग में दिल बंद हैं',
        continueSpeaking: 'क्या आप इस पाठ के बाकी बोलने वाले प्रश्न छोड़ना चाहते हैं?',
        speechUnsupported: 'यहाँ वाक् पहचान उपलब्ध नहीं है।', takeYourTime: 'आराम से सोचें।',
        aiBadge: 'AI जनित', offlineBadge: 'ऑफ़लाइन प्रश्न',
        exitConfirm: 'क्या आप वाकई बाहर जाना चाहते हैं? इस पाठ की प्रगति सहेजी नहीं जाएगी।',
        exitConfirmTitle: 'पाठ से बाहर जाएँ?',
        exitConfirmCancel: 'सीखना जारी रखें',
        exitConfirmLeave: 'फिर भी बाहर जाएँ'
    }
};

const audienceLanguage = normalizeLanguageName(course?.speakerLanguage || 'English');
const lessonCopy = LESSON_COPY[audienceLanguage] || LESSON_COPY.English;
document.documentElement.lang = audienceData.languageCodes[audienceLanguage] || 'en';

function lessonText(key, values = {}) {
    let text = lessonCopy[key] || LESSON_COPY.English[key] || key;
    for (const [name, value] of Object.entries(values)) {
        text = text.replaceAll(`{${name}}`, String(value));
    }
    return text;
}

promptHeading.textContent = lessonText('practicePrompt');
lessonSubtitle.textContent = lessonText('loadingLesson');
statusText.textContent = lessonText('completeToEarn');
exitBtn.textContent = lessonText('exit');
hintBtn.textContent = lessonText('hint');
checkBtn.textContent = lessonText('check');
nextBtn.textContent = lessonText('next');
finishBtn.textContent = lessonText('finish');
normalVoiceBtn.textContent = lessonText('normalVoice');
normalVoiceBtn.title = lessonText('normalVoice');
slowVoiceBtn.textContent = lessonText('slowVoice');
slowVoiceBtn.title = lessonText('slowVoice');
completionHeading.textContent = lessonText('completeTitle');
accuracyLabel.textContent = lessonText('accuracy');
xpEarnedLabel.textContent = lessonText('xpEarned');
backDashboardLink.textContent = lessonText('backDashboard');
renderHeartGauge();

// ═══════════════════════════════════════════════════════════
//  EXIT CONFIRMATION (NEW)
//  - Asks before leaving when there are unsaved changes
//  - Skipped if lesson is finished, no questions answered, or exit button already clicked
// ═══════════════════════════════════════════════════════════

let lessonInProgress = false;     // Set to true once the first question renders
let lessonFinished = false;        // Set to true when completion panel shows
let exitConfirmed = false;         // Prevents double prompts

function requestExitConfirmation() {
    if (lessonFinished || !lessonInProgress) return true;
    if (exitConfirmed) return true;
    const confirmed = window.confirm(lessonText('exitConfirm'));
    if (confirmed) exitConfirmed = true;
    return confirmed;
}

// Intercept all navigation triggers
window.addEventListener('beforeunload', (e) => {
    if (lessonFinished || !lessonInProgress || exitConfirmed) return;
    // Modern browsers ignore the custom message, but show a native prompt
    e.preventDefault();
    e.returnValue = '';
    return '';
});

// Intercept clicks on anchors/links that navigate away
document.addEventListener('click', (e) => {
    const anchor = e.target.closest('a[href]');
    if (!anchor) return;
    if (anchor.id === 'exitBtn' || anchor.id === 'backDashboardLink') return;
    const href = anchor.getAttribute('href') || '';
    if (!href || href.startsWith('#') || href.startsWith('javascript:')) return;
    if (!requestExitConfirmation()) {
        e.preventDefault();
        e.stopPropagation();
    }
}, true);

// Intercept finish button — no confirmation needed
document.addEventListener('click', (e) => {
    if (e.target.closest('#finishBtn')) exitConfirmed = true;
}, true);

// Wire the exit button specifically
if (exitBtn) {
    exitBtn.addEventListener('click', (e) => {
        if (lessonFinished) return;    // Let it navigate normally
        if (lessonInProgress) {
            e.preventDefault();
            if (requestExitConfirmation()) {
                window.location.href = exitBtn.getAttribute('href') || 'dashboard.html';
            }
        }
    });
}

if (backDashboardLink) {
    backDashboardLink.addEventListener('click', (e) => {
        if (lessonFinished) return;
        if (lessonInProgress) {
            e.preventDefault();
            if (requestExitConfirmation()) {
                window.location.href = backDashboardLink.getAttribute('href') || 'dashboard.html';
            }
        }
    });
}

// Expose to lesson logic
window.__musalingoLessonState = {
    setInProgress: () => { lessonInProgress = true; },
    setFinished: () => { lessonFinished = true; exitConfirmed = true; }
};

function getAudienceLanguageName(language) {
    const targetLanguage = normalizeLanguageName(language);
    return audienceData.languageNames[audienceLanguage]?.[targetLanguage] || targetLanguage;
}

function localizeEnglishMeaning(value) {
    const text = String(value ?? '').trim();
    const localized = audienceData.translations[audienceLanguage];
    if (!localized) return text;
    return localized[text.toLocaleLowerCase()] || text;
}

function hasNonLatinText(value) {
    const text = String(value ?? '');
    return /[\u0400-\u04FF\u0590-\u05FF\u0600-\u06FF\u0700-\u074F\u0780-\u07BF\u0900-\u097F\u0980-\u09FF\u0A00-\u0A7F\u0A80-\u0AFF\u0B00-\u0B7F\u0B80-\u0BFF\u0C00-\u0C7F\u0C80-\u0CFF\u0D00-\u0D7F\u0D80-\u0DFF\u0E00-\u0E7F\u0F00-\u0FFF\u3040-\u30FF\u3400-\u4DBF\u4E00-\u9FFF\uAC00-\uD7AF\u1100-\u11FF\u1E00-\u1EFF\u2C00-\u2C5F]/.test(text);
}

function usesNonLatinScript(language) {
    const value = normalizeLanguageName(language);
    if (hasNonLatinText(value)) return true;
    return /Japanese|Hindi|Arabic|Chinese|Korean|Thai|Russian|Hebrew|Persian|Urdu|Tamil|Telugu|Malayalam|Kannada|Bengali|Gujarati|Punjabi|Nepali|Marathi|Greek|Vietnamese|Burmese|Laotian|Georgian|Armenian|Yiddish|Uyghur|Kazakh|Ukrainian|Bulgarian|Mongolian|Tibetan|Sinhala|Oriya|Assamese|Pashto|Sindhi|Swahili|Amharic|Tigrinya|Malay|Filipino|Lao|Myanmar/i.test(value);
}

function escapeHtml(value) {
    return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

const COMMON_ENGLISH_TRANSLATIONS = {
    Japanese: { 'こんにちは': 'hello', 'ありがとう': 'thank you', '学校': 'school', '猫': 'cat', '水': 'water', '友達': 'friend', '本': 'book', '食べ物': 'food', '家': 'home', '朝': 'morning', '車': 'car', '音楽': 'music', '夜': 'night', '雨': 'rain', '元気': 'well' },
    Spanish: { hola: 'hello', adios: 'goodbye', libro: 'book', feliz: 'happy', gracias: 'thank you', 'por favor': 'please', amigo: 'friend', agua: 'water', mesa: 'table', casa: 'house', escuela: 'school', manzana: 'apple', correr: 'run', puerta: 'door', sol: 'sun' },
    French: { bonjour: 'hello', merci: 'thank you', livre: 'book', maison: 'house', ami: 'friend', eau: 'water', porte: 'door', soleil: 'sun', ecole: 'school', pomme: 'apple', voiture: 'car' },
    German: { hallo: 'hello', danke: 'thank you', buch: 'book', freund: 'friend', wasser: 'water', schule: 'school', haus: 'house', tafel: 'table', musik: 'music', apfel: 'apple', laufen: 'run', sonne: 'sun', tur: 'door' },
    Italian: { ciao: 'hello', grazie: 'thank you', libro: 'book', amico: 'friend', acqua: 'water', scuola: 'school', casa: 'house', mela: 'apple', musica: 'music', porta: 'door', sole: 'sun', corre: 'run' },
    Arabic: { 'مرحبا': 'hello', 'شكرا': 'thank you', 'كتاب': 'book', 'بيت': 'house', 'ماء': 'water', 'صديق': 'friend', 'مدرسة': 'school', 'نافذة': 'window', 'قمر': 'moon', 'تفاحة': 'apple', 'أحب': 'love', 'سماء': 'sky', 'باب': 'door', 'شمس': 'sun' },
    Hindi: { 'नमस्ते': 'hello', 'धन्यवाद': 'thank you', 'किताब': 'book', 'मित्र': 'friend', 'पानी': 'water', 'विद्यालय': 'school', 'घर': 'house', 'दरवाज़ा': 'door', 'सूरज': 'sun', 'सेब': 'apple', 'दोस्ती': 'friendship', 'आकाश': 'sky', 'चाँद': 'moon' },
    Korean: { '안녕하세요': 'hello', '고맙습니다': 'thank you', '책': 'book', '친구': 'friend', '물': 'water', '학교': 'school', '집': 'house', '문': 'door', '해': 'sun' },
    Telugu: { 'హలో': 'hello', 'ధన్యవాదాలు': 'thank you', 'పుస్తకం': 'book', 'స్నేహితుడు': 'friend', 'నీళ్ళు': 'water', 'పాఠశాల': 'school', 'ఇల్లు': 'house', 'తలుపు': 'door', 'సూర్యుడు': 'sun', 'యాపిల్': 'apple', 'పరుగు': 'run', 'ఆకాశం': 'sky', 'చంద్రుడు': 'moon' }
};

function formatDisplayText(value, language, pronunciationOverride, includePronunciation = false) {
    const text = String(value ?? '').trim();
    if (!text) return '';
    const normalizedLanguage = normalizeLanguageName(language);
    const romanization = String(pronunciationOverride || '').trim();
    if (includePronunciation && (usesNonLatinScript(normalizedLanguage) || hasNonLatinText(text)) && romanization) return text + ' (' + romanization + ')';
    return text;
}

function getChoiceDisplayLabel(value, question, language) {
    const rawValue = String(value ?? '').trim();
    if (!rawValue) return '';
    const normalizedLanguage = normalizeLanguageName(language);
    if (question) {
        const translationMap = question.translationMap || {};
        const translation = translationMap[rawValue] || translationMap[rawValue.toLowerCase()];
        if (translation) return localizeEnglishMeaning(translation);
    }
    const known = COMMON_ENGLISH_TRANSLATIONS[normalizedLanguage]?.[rawValue] || COMMON_ENGLISH_TRANSLATIONS[normalizedLanguage]?.[rawValue.toLowerCase()];
    if (known) return localizeEnglishMeaning(known);
    return rawValue;
}

function renderHeartGate() {
    lessonTitle.textContent = lessonText('outOfHearts');
    lessonSubtitle.textContent = lessonText('needHeart');
    promptText.textContent = lessonText('buyOrWait');
    audioControls.style.display = 'none';
    chessActivity.hidden = true;
    checkBtn.style.display = 'none';
    nextBtn.style.display = 'none';
    finishBtn.style.display = 'none';
    hintBtn.style.display = 'none';
    exitBtn.textContent = lessonText('backDashboard');
    statusText.textContent = `${profile.hearts}/${HEART_CAP} • ${profile.diamonds} 💎`;
    options.innerHTML = `
        <div class="heart-gate">
            <button class="btn" id="buyOneHeartBtn" type="button">Buy 1 heart — 10 diamonds</button>
            <button class="btn secondary" id="buyFiveHeartsBtn" type="button">Refill to 5 hearts — 50 diamonds</button>
            <p id="heartRefillMessage" role="status"></p>
            <button class="btn" id="continueLessonBtn" type="button" hidden>Continue to lesson</button>
        </div>`;
    const refillMessage = document.getElementById('heartRefillMessage');
    const continueButton = document.getElementById('continueLessonBtn');
    const buyHearts = (requestedAmount) => {
        if (updateHeartRefill()) saveProfile(profile);
        const amount = Math.min(requestedAmount, HEART_CAP - profile.hearts);
        const cost = amount * 10;
        if (amount <= 0) { window.location.reload(); return; }
        if (profile.diamonds < cost) { refillMessage.textContent = `${cost - profile.diamonds} 💎`; playSound('error'); return; }
        profile.diamonds -= cost;
        profile.hearts += amount;
        if (profile.hearts === HEART_CAP) delete profile.heartRefillAt;
        saveProfile(profile);
        playSound('gemEarned');
        window.location.reload();
    };
    document.getElementById('buyOneHeartBtn').addEventListener('click', () => buyHearts(1));
    document.getElementById('buyFiveHeartsBtn').addEventListener('click', () => buyHearts(HEART_CAP));
    continueButton.addEventListener('click', () => window.location.reload());
    const renderCountdown = () => {
        if (updateHeartRefill()) saveProfile(profile);
        renderHeartGauge();
        statusText.textContent = `${profile.hearts}/${HEART_CAP} • ${profile.diamonds} 💎`;
        if (profile.hearts > 0) { refillMessage.textContent = lessonText('needHeart'); continueButton.hidden = false; return; }
        const remainingSeconds = Math.max(0, Math.ceil((profile.heartRefillAt - Date.now()) / 1000));
        const m = Math.floor(remainingSeconds / 60);
        const s = String(remainingSeconds % 60).padStart(2, '0');
        refillMessage.textContent = `Next heart in ${m}:${s}`;
    };
    renderCountdown();
    window.setInterval(renderCountdown, 1000);
}

if (!course || !lesson) {
    lessonTitle.textContent = lessonText('lessonNotFound');
    lessonSubtitle.textContent = lessonText('missingLesson');
    promptText.textContent = lessonText('missingLesson');
    statusText.textContent = lessonText('noLesson');
    finishBtn.disabled = true;
} else {
    const heartsDisabled = savedTheme.noHearts || savedTheme.noGamification;
    if (!heartsDisabled && updateHeartRefill()) saveProfile(profile);
    if (!heartsDisabled && profile.hearts === 0) {
        renderHeartGate();
    } else {
        (async () => {
            let practice;
            promptText.textContent = lessonText('generatingQuestions');
            statusText.textContent = lessonText('askingAI');

            try {
                const selectedLanguage = course.id === 'japanese' ? 'Japanese' : course.name;
                let savedMistakeQuestions = [];
                if (isReview && practiceMode === 'mistakes') {
                    try {
                        const history = JSON.parse(localStorage.getItem('MusalingoPracticeData') || '{}');
                        savedMistakeQuestions = (Array.isArray(history.mistakes) ? history.mistakes : [])
                            .filter(item => item && item.courseId === course.id && item.question)
                            .map(item => item.question);
                    } catch (error) {
                        console.warn('[lesson] Could not load saved practice mistakes.', error);
                    }

                    if (!savedMistakeQuestions.length) {
                        lessonTitle.textContent = 'Mistake review';
                        lessonSubtitle.textContent = `${course.name} • Review session`;
                        promptText.textContent = 'No missed questions yet. Complete a regular lesson and any incorrect answers will appear here.';
                        statusText.textContent = 'No mistakes to review';
                        finishBtn.disabled = true;
                        exitBtn.href = 'practice.html';
                        backDashboardLink.href = 'practice.html';
                        backDashboardLink.textContent = 'Back to practice';
                        return;
                    }
                }

                let minQuestions = 8;
                let maxQuestions = 12;
                if (lesson.kind === 'test') { minQuestions = 15; maxQuestions = 20; }
                else if (lesson.kind === 'puzzle') { minQuestions = 5; maxQuestions = 8; }
                else if (lesson.kind === 'endgame') { minQuestions = 6; maxQuestions = 10; }
                else if (lesson.kind === 'practice') { minQuestions = 8; maxQuestions = 12; }
                const questionCount = Math.floor(Math.random() * (maxQuestions - minQuestions + 1)) + minQuestions;

                if (isReview && practiceMode === 'mistakes') {
                    practice = {
                        language: selectedLanguage,
                        title: lesson.title,
                        questions: savedMistakeQuestions,
                        source: 'review',
                        error: null
                    };
                } else {
                    const aiResult = await fetchAIQuestions(
                        lesson.title || course.name,
                        selectedLanguage,
                        questionCount,
                        level,
                        course.learningProfile,
                        lesson.unitIndex ?? null,
                        audienceLanguage,
                        isReview ? practiceMode : ''
                    );

                    if (!Array.isArray(aiResult.questions) || aiResult.questions.length === 0) throw new Error('No questions');
                    practice = {
                        language: selectedLanguage,
                        title: lesson.title,
                        questions: aiResult.questions,
                        source: aiResult.source,
                        error: aiResult.error
                    };
                    
                }
            } catch (err) {
                console.error('AI generation failed:', err);
                promptText.textContent = lessonText('loadQuestionsError');
                feedback.textContent = String(err.message || err);
                feedback.style.color = '#b91c1c';
                finishBtn.disabled = true;
                return;
            }

            lessonTitle.textContent = practice.title || lesson.title;

            const baseSubtitle = practice.source === 'ai'
                ? `${course.name} • ${lessonText('aiPractice')}`
                : practice.source === 'review'
                    ? `${course.name} • Saved lesson mistakes`
                    : practice.source === 'mixed'
                        ? `${course.name} • AI and offline practice`
                        : practice.source === 'built-in'
                            ? `${course.name} • Built-in practice`
                            : `${course.name} • ${lessonText('offlinePractice')}`;

            lessonSubtitle.textContent = baseSubtitle;
            setSourceBadge(sourceBadge, practice.source, practice.error);
            if (practice.error) {
                console.warn('[lesson] Fallback reason:', errorLabel(extractErrorCode(practice.error)));
            }

            if (isReview) {
                const practiceLabels = {
                    mistakes: 'Mistake review',
                    words: 'Word practice',
                    listening: 'Listening practice',
                    speaking: 'Speaking practice',
                    speed: 'Quick practice',
                    mixed: 'Mixed practice'
                };
                document.body.classList.add('practice-mode');
                lessonTitle.textContent = practiceLabels[practiceMode] || 'Quick practice';
                lessonSubtitle.textContent = practice.source === 'review'
                    ? `${course.name} • Saved lesson mistakes`
                    : practice.source === 'ai'
                        ? `${course.name} • AI-generated review`
                        : practice.source === 'mixed'
                            ? `${course.name} • AI and offline review`
                            : `${course.name} • Offline review`;
                if (practice.error) setSourceBadge(sourceBadge, practice.source, practice.error);
                exitBtn.href = 'practice.html';
                backDashboardLink.href = 'practice.html';
                backDashboardLink.textContent = 'Back to practice';
            }

            let questions = practice.questions.slice(0, practice.questions.length);
            const results = [];
            let currentIndex = 0;
            let selectedAnswer = null;
            let skipSpeakingQuestions = false;
            const skippedQuestionIndices = new Set();
            let questionPhrase = '';
            let questionSpeechLanguage = practice.language;
            let translationQuestionIndex = 0;
            let activeRecognition = null;
            let matchPairsState = null;
            let isFinished = false;
            let advanceTimer = null;

            const isChess = course.id === 'chess';
            const isMath = course.id === 'math';

            function answeredCount() {
                return results.filter((r) => typeof r === 'boolean').length + skippedQuestionIndices.size;
            }

            const MIN_PASS_ACCURACY = 0.5;
            const finishLabel = lessonText('finish');
            function allAnswered() { return questions.length > 0 && answeredCount() >= questions.length; }
            function currentAccuracy() {
                const attemptedCount = results.filter((result) => typeof result === 'boolean').length;
                return attemptedCount ? results.filter((result) => result === true).length / attemptedCount : 1;
            }
            function canEnableFinish() { return allAnswered() && currentAccuracy() >= MIN_PASS_ACCURACY; }
            function refreshFinishState() {
                if (!allAnswered()) { finishBtn.disabled = true; finishBtn.textContent = finishLabel; return; }
                finishBtn.disabled = false;
                if (canEnableFinish()) { finishBtn.textContent = finishLabel; return; }
                finishBtn.textContent = lessonText('tryAgain');
                const msg = `You scored ${Math.round(currentAccuracy() * 100)}%. You need at least ${Math.round(MIN_PASS_ACCURACY * 100)}% to complete this lesson.`;
                if (!String(feedback.textContent).includes('You need at least')) {
                    feedback.textContent = feedback.textContent ? `${feedback.textContent} — ${msg}` : msg;
                }
                feedback.style.color = '#b91c1c';
            }
            function lockLastQuestionAfterSkip() {
                options.querySelectorAll('button, input').forEach((el) => { el.disabled = true; });
                feedback.textContent = lessonText('questionSkipped');
                feedback.style.color = '#b91c1c';
                refreshFinishState();
            }

            function deductHeart() {
                if (savedTheme.noGamification || savedTheme.noHearts) return;
                updateHeartRefill();
                profile.hearts = Math.max(0, profile.hearts - 1);
                if (!profile.heartRefillAt) profile.heartRefillAt = Date.now() + HEART_REFILL_INTERVAL;
                saveProfile(profile);
                renderHeartGauge();
            }

            function recordAnswer(correct) {
                results[currentIndex] = correct;
                rememberPracticeAnswer(questions[currentIndex], correct);
                if (!correct) { deductHeart(); playSound('heartsLost'); }
            }

            function rememberPracticeAnswer(question, correct) {
                if (!question || !course) return;
                const signature = [
                    question.type || '',
                    question.phrase || question.prompt || question.question || '',
                    question.answer || ''
                ].join('|');
                const key = `${course.id}|${signature}`;
                try {
                    const history = JSON.parse(localStorage.getItem('MusalingoPracticeData') || '{}');
                    const mistakes = Array.isArray(history.mistakes) ? history.mistakes : [];
                    const remaining = mistakes.filter(item => item?.key !== key);
                    if (!correct) {
                        remaining.unshift({ key, courseId: course.id, lessonId: lesson.id, question });
                    }
                    localStorage.setItem('MusalingoPracticeData', JSON.stringify({
                        ...history,
                        mistakes: remaining.slice(0, 100)
                    }));
                } catch (error) {
                    console.error('[lesson] Could not save practice review progress.', error);
                }
            }

            function skipCurrentSpeakQuestion() {
                const recognition = activeRecognition;
                activeRecognition = null;
                if (recognition) { try { recognition.abort(); } catch (e) { } }
                skippedQuestionIndices.add(currentIndex);
                refreshFinishState();
                if (currentIndex === questions.length - 1) {
                    if (canEnableFinish()) finishBtn.click();
                    return;
                }
                currentIndex += 1;
                window.setTimeout(renderQuestion, 0);
            }

            function pronounceText(text, rate = 0.85, language = practice.language) {
                return window.SFX?.pronounce ? window.SFX.pronounce(text, { lang: language, rate: rate }) : false;
            }
            function pronounceQuestion(r) { if (window.SFX?.pronounce) window.SFX.pronounce(questionPhrase, { lang: questionSpeechLanguage, rate: r }); }

            function normalizeAnswerText(v) { return String(v ?? '').normalize('NFKC').trim().toLocaleLowerCase().replace(/\s+/g, ' '); }

            function matchesQuestionAnswer(q, value) {
                const actual = normalizeAnswerText(value);
                const native = q.type === 'spell' ? q.phrase : q.type === 'listen' ? (q.answer || q.phrase) : q.answer;
                const accepts = hasNonLatinText(native);
                const candidates = [native];
                if (accepts || q.type === 'translate-type') candidates.push(q.pronunciation);
                return candidates.some((candidate) => {
                    if (!candidate) return false;
                    const expected = normalizeAnswerText(candidate);
                    return expected === actual
                        || (q.type === 'translate-type'
                            && actual.length <= 200
                            && expected.length <= 200
                            && similarity(actual, expected) >= 0.7);
                });
            }

            function renderMultipleChoice(q) {
                const targetLanguage = normalizeLanguageName(practice.language || course.name || 'English');
                const translateFromEnglish = Boolean(q.phrase && !q.question && !isMath) && translationQuestionIndex++ % 2 === 1;
                const phraseLabel = q.phrase ? `<div><strong>${escapeHtml(formatDisplayText(q.phrase, targetLanguage, q.pronunciation, true))}</strong></div>` : '';
                const pronunciationLabel = q.pronunciation && !usesNonLatinScript(targetLanguage) ? `<div class="pronunciation">(${escapeHtml(q.pronunciation)})</div>` : '';
                const englishPrompt = getChoiceDisplayLabel(q.answer, q, targetLanguage);
                questionPhrase = q.phrase && !isMath ? q.phrase : q.question || englishPrompt;
                questionSpeechLanguage = q.phrase && !isMath ? targetLanguage : isMath ? 'English' : audienceLanguage;
                promptText.innerHTML = q.question ? `${escapeHtml(q.question)}${pronunciationLabel}`
                    : translateFromEnglish ? `${escapeHtml(lessonText('translateTarget', { language: getAudienceLanguageName(targetLanguage) }))} <strong>${escapeHtml(englishPrompt)}</strong>`
                        : `${escapeHtml(lessonText('translateAudience', { language: getAudienceLanguageName(audienceLanguage) }))} ${phraseLabel}${pronunciationLabel}`;
                const choices = shuffle([q.answer, ...(q.distractors || [])]);
                options.innerHTML = choices.map(c => {
                    const label = translateFromEnglish ? String(c) : getChoiceDisplayLabel(c, q, targetLanguage);
                    const speechLanguage = translateFromEnglish ? targetLanguage : 'English';
                    return `<button class="answer-btn" data-answer="${escapeHtml(c)}" data-speech-language="${escapeHtml(speechLanguage)}">${escapeHtml(label)}</button>`;
                }).join('');
                wireAnswerButtons();
                if (q.phrase && !isMath) window.setTimeout(() => pronounceText(q.phrase, 1, targetLanguage), 100);
            }

            function renderFillBlank(q) {
                const targetLanguage = normalizeLanguageName(practice.language || course.name || 'English');
                const sentence = String(q.sentence || '');
                questionPhrase = sentence.replace('___', String(q.answer || ''));
                questionSpeechLanguage = normalizeLanguageName(practice.language || course.name || 'English');
                const translation = q.translation
                    ? `<br><span class="translation">(${escapeHtml(q.translation)})</span>`
                    : '';
                promptText.innerHTML = `${escapeHtml(sentence).replace('___', '<span class="blank">___</span>')}${translation}`;
                const choices = shuffle([q.answer, ...(q.distractors || [])]);
                options.innerHTML = choices.map(option =>
                    `<button class="answer-btn" data-answer="${escapeHtml(option)}" data-speech-language="${escapeHtml(targetLanguage)}">${escapeHtml(option)}</button>`
                ).join('');
                wireAnswerButtons();
                window.setTimeout(() => pronounceText(questionPhrase, 0.9, targetLanguage), 200);
            }

            function wireAnswerButtons() {
                options.querySelectorAll('.answer-btn').forEach(btn => {
                    btn.addEventListener('click', () => {
                        options.querySelectorAll('.answer-btn').forEach(o => o.classList.remove('selected'));
                        btn.classList.add('selected');
                        selectedAnswer = btn.getAttribute('data-answer');
                        checkBtn.style.display = 'inline-block';
                        pronounceText(btn.textContent.trim(), 0.85, btn.dataset.speechLanguage || practice.language);
                    });
                });
            }

            function renderArrange(q) {
                const targetLanguage = normalizeLanguageName(practice.language || course.name || 'English');
                promptText.innerHTML = `${escapeHtml(lessonText('arrange'))} <em>${escapeHtml(q.translation || q.english || '')}</em>`;
                const words = shuffle(q.words);
                options.innerHTML = `
                    <div id="arrangeTarget" class="arrange-target"></div>
                    <div id="arrangePool" class="arrange-pool">
                        ${words.map(w => `<button class="arrange-word" data-word="${escapeHtml(w)}">${escapeHtml(formatDisplayText(w, targetLanguage, q.pronunciation || q.english, false))}</button>`).join('')}
                    </div>`;
                const target = document.getElementById('arrangeTarget');
                const pool = document.getElementById('arrangePool');
                pool.querySelectorAll('.arrange-word').forEach(b => { b.addEventListener('click', () => { target.appendChild(b); b.classList.add('in-target'); checkArrange(); }); });
                target.addEventListener('click', e => { if (e.target.classList.contains('arrange-word')) { pool.appendChild(e.target); e.target.classList.remove('in-target'); checkArrange(); } });
                function checkArrange() {
                    const placed = [...target.querySelectorAll('.arrange-word')].map(b => b.dataset.word);
                    selectedAnswer = placed.join(' ');
                    checkBtn.style.display = placed.length === q.words.length ? 'inline-block' : 'none';
                }
            }

            function renderListen(q) {
                const targetLanguage = normalizeLanguageName(practice.language || course.name || 'English');
                promptText.textContent = lessonText('listen');
                const choices = shuffle([q.answer, ...q.distractors]);
                options.innerHTML = choices.map(c => {
                    const romanization = q.pronunciationMap?.[c] || (c === q.answer ? q.pronunciation : '');
                    const romanizationLabel = hasNonLatinText(c) && romanization
                        ? `<span class="answer-pronunciation">${escapeHtml(romanization)}</span>`
                        : '';
                    return `<button class="answer-btn" data-answer="${escapeHtml(c)}" data-speech-language="${escapeHtml(targetLanguage)}"><span class="answer-choice">${escapeHtml(c)}</span>${romanizationLabel}</button>`;
                }).join('');
                wireAnswerButtons();
                window.setTimeout(() => pronounceText(q.phrase, 0.85), 300);
            }

            function renderSpeak(q) {
                const targetLanguage = normalizeLanguageName(practice.language || course.name || 'English');
                const phraseDisplay = formatDisplayText(q.phrase, targetLanguage, q.pronunciation || q.english, true);
                promptText.innerHTML = `${escapeHtml(lessonText('say'))} <strong>${escapeHtml(phraseDisplay)}</strong><br><small>${escapeHtml((q.translation || q.english) ? `(${q.translation || q.english})` : '')}</small>`;
                options.innerHTML = `
                    <div class="speak-wrap">
                        <button class="btn" id="speakBtn" type="button">${escapeHtml(lessonText('startSpeaking'))}</button>
                        <button class="btn secondary" id="cantSpeakBtn" type="button">${escapeHtml(lessonText('cantSpeak'))}</button>
                        <div id="speakResult" class="message"></div>
                    </div>`;
                const btn = document.getElementById('speakBtn');
                const cantSpeakBtn = document.getElementById('cantSpeakBtn');
                const speechResult = document.getElementById('speakResult');
                btn.addEventListener('click', () => {
                    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
                    if (!SR) { speechResult.textContent = lessonText('speechUnsupported'); speechResult.style.color = '#b91c1c'; return; }
                    if (activeRecognition) return;
                    let rec;
                    try { rec = new SR(); } catch (error) { speechResult.textContent = `Could not initialize microphone: ${error.message || error}`; speechResult.style.color = '#b91c1c'; return; }
                    rec.lang = { Japanese: 'ja-JP', Spanish: 'es-ES', French: 'fr-FR', Hindi: 'hi-IN', German: 'de-DE', Italian: 'it-IT', Arabic: 'ar-SA', Korean: 'ko-KR', Telugu: 'te-IN', English: 'en-US' }[targetLanguage] || 'en-US';
                    rec.interimResults = false; rec.maxAlternatives = 1;
                    speechResult.textContent = lessonText('listening'); speechResult.style.color = 'var(--accent-dark)';
                    btn.disabled = true; activeRecognition = rec;
                    rec.onresult = (e) => {
                        if (activeRecognition !== rec) return;
                        const said = e.results[0][0].transcript.toLowerCase().trim();
                        const rawTargets = [q.phrase, q.pronunciation || '', q.answer || ''];
                        const targets = [...new Set(rawTargets.map(t => String(t || '').toLowerCase().trim()).filter(Boolean))];
                        const correct = targets.some((target) => said.includes(target) || target.includes(said) || similarity(said, target) > 0.7);
                        recordAnswer(correct);
                        activeRecognition = null; btn.disabled = false; cantSpeakBtn.disabled = true;
                        speechResult.textContent = correct ? `✅ You said: "${said}"` : `❌ You said: "${said}" — expected "${targets.join(' / ')}"`;
                        speechResult.style.color = correct ? '#278a44' : '#b91c1c';
                        correct ? playSound('correct') : playSound('wrong');
                        nextBtn.style.display = currentIndex < questions.length - 1 ? 'inline-block' : 'none';
                        refreshFinishState();
                        if (currentIndex === questions.length - 1 && canEnableFinish()) finishBtn.click();
                    };
                    rec.onerror = (e) => {
                        if (activeRecognition !== rec) return;
                        activeRecognition = null;
                        const errors = { 'not-allowed': 'Microphone access is blocked.', 'service-not-allowed': 'Speech recognition is blocked.', 'audio-capture': 'No microphone was found.', 'no-speech': 'No speech was detected.', network: 'Speech recognition needs a network connection.', aborted: 'Listening stopped.' };
                        speechResult.textContent = errors[e.error] || `Microphone error: ${e.error}`;
                        speechResult.style.color = '#b91c1c';
                        btn.disabled = false;
                    };
                    rec.onend = () => { if (activeRecognition === rec) activeRecognition = null; btn.disabled = false; };
                    try { rec.start(); } catch (error) { activeRecognition = null; btn.disabled = false; speechResult.textContent = `Could not start microphone: ${error.message || error}`; speechResult.style.color = '#b91c1c'; }
                });
                cantSpeakBtn.addEventListener('click', () => {
                    if (!skipSpeakingQuestions) {
                        const confirmed = window.confirm(lessonText('continueSpeaking'));
                        if (!confirmed) return;
                        skipSpeakingQuestions = true;
                    }
                    skipCurrentSpeakQuestion();
                });
            }

            function similarity(a, b) {
                if (!a || !b) return 0;
                if (a === b) return 1;
                const m = a.length, n = b.length;
                const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
                for (let i = 0; i <= m; i++) dp[i][0] = i;
                for (let j = 0; j <= n; j++) dp[0][j] = j;
                for (let i = 1; i <= m; i++) {
                    for (let j = 1; j <= n; j++) {
                        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
                        dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
                    }
                }
                return 1 - dp[m][n] / Math.max(m, n);
            }

            function renderSpell(q) {
                promptText.textContent = lessonText('spell');
                options.innerHTML = `<input id="spellInput" class="spell-input" type="text" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="${escapeHtml(lessonText('typeWhatHeard'))}" />`;
                const input = document.getElementById('spellInput');
                window.setTimeout(() => pronounceText(q.phrase, 0.7), 300);
                input.addEventListener('input', () => {
                    selectedAnswer = input.value.trim();
                    checkBtn.style.display = selectedAnswer ? 'inline-block' : 'none';
                });
                input.focus();
            }

            function renderTranslateType(q) {
                const targetLanguage = normalizeLanguageName(practice.language || course.name || 'English');
                promptText.innerHTML =
                    `Translate into ${escapeHtml(targetLanguage)}:<br>` +
                    `<strong>${escapeHtml(q.english || '')}</strong>`;

                questionPhrase = q.english || '';
                questionSpeechLanguage = 'English';

                options.innerHTML = `<input id="translateInput" class="spell-input" type="text"
                    maxlength="200" autocomplete="off" autocapitalize="off" spellcheck="false"
                    placeholder="Type your answer in ${escapeHtml(targetLanguage)}…" />`;

                const input = document.getElementById('translateInput');
                input.addEventListener('input', () => {
                    selectedAnswer = input.value.trim();
                    checkBtn.style.display = selectedAnswer ? 'inline-block' : 'none';
                });
                input.focus();
                window.setTimeout(() => pronounceText(q.english, 0.9, 'English'), 200);
            }

            function renderMatchPairs(q) {
                const targetLanguage = normalizeLanguageName(practice.language || course.name || 'English');
                promptText.textContent = lessonText('matchPairs');
                const seenRight = new Set();
                const sanitizedPairs = [];
                for (const pair of q.pairs) {
                    if (!pair || pair.left == null || pair.right == null) continue;
                    const key = String(pair.right);
                    if (seenRight.has(key)) continue;
                    seenRight.add(key);
                    sanitizedPairs.push({ left: pair.left, right: pair.right });
                }
                if (sanitizedPairs.length < 2) {
                    promptText.textContent = 'This question could not be shown.';
                    options.innerHTML = `<div class="message" style="color:#b91c1c;">Skipping broken question…</div>`;
                    results[currentIndex] = false;
                    refreshFinishState();
                    nextBtn.style.display = currentIndex < questions.length - 1 ? 'inline-block' : 'none';
                    return;
                }
                matchPairsState = { selL: null, selR: null, matched: 0, total: sanitizedPairs.length, shakeTimer: null };
                const left = shuffle(sanitizedPairs.map(p => p.left));
                const right = shuffle(sanitizedPairs.map(p => p.right));
                const correctMap = new Map(sanitizedPairs.map(p => [p.left, p.right]));
                const state = matchPairsState;
                options.innerHTML = `
                    <div class="match-grid">
                        <div class="match-col" id="matchLeft">
                            ${left.map(w => `<button class="match-item" data-side="left" data-value="${escapeHtml(w)}">${escapeHtml(formatDisplayText(w, targetLanguage, q.pronunciation || q.english, false))}</button>`).join('')}
                        </div>
                        <div class="match-col" id="matchRight">
                            ${right.map(w => `<button class="match-item" data-side="right" data-value="${escapeHtml(w)}">${escapeHtml(formatDisplayText(w, targetLanguage, q.pronunciation || q.english, false))}</button>`).join('')}
                        </div>
                    </div>
                    <div class="message" id="matchMsg">Tap a left item, then its match on the right.</div>
                    <div style="margin-top:12px;">
                        <button class="btn secondary" id="matchSkipBtn" type="button" style="font-size:0.9rem;">Skip this question</button>
                    </div>`;
                document.getElementById('matchSkipBtn').addEventListener('click', () => {
                    if (state.shakeTimer) { clearTimeout(state.shakeTimer); state.shakeTimer = null; }
                    results[currentIndex] = false; playSound('heartsLost'); deductHeart();
                    refreshFinishState();
                    if (currentIndex === questions.length - 1) { lockLastQuestionAfterSkip(); return; }
                    currentIndex += 1; renderQuestion();
                });
                options.querySelectorAll('.match-item').forEach(btn => {
                    btn.addEventListener('click', () => {
                        if (btn.disabled) return;
                        if (state.shakeTimer) return;
                        const side = btn.dataset.side;
                        if (side === 'left') { if (state.selL) state.selL.classList.remove('selected'); state.selL = btn; btn.classList.add('selected'); }
                        else { if (state.selR) state.selR.classList.remove('selected'); state.selR = btn; btn.classList.add('selected'); }
                        if (state.selL && state.selR) {
                            const leftVal = state.selL.dataset.value;
                            const rightVal = state.selR.dataset.value;
                            const ok = correctMap.get(leftVal) === rightVal;
                            if (ok) {
                                state.selL.classList.add('matched'); state.selR.classList.add('matched');
                                state.selL.disabled = true; state.selR.disabled = true;
                                state.matched++; playSound('correct');
                                document.getElementById('matchMsg').textContent = `✓ Matched (${state.matched}/${state.total})`;
                                if (state.matched === state.total) {
                                    results[currentIndex] = true;
                                    promptText.innerHTML = '✅ All pairs matched!';
                                    document.getElementById('matchMsg').textContent = 'Great job!';
                                    nextBtn.style.display = currentIndex < questions.length - 1 ? 'inline-block' : 'none';
                                    refreshFinishState();
                                    if (currentIndex === questions.length - 1 && canEnableFinish()) finishBtn.click();
                                }
                            } else {
                                playSound('wrong'); deductHeart(); playSound('heartsLost');
                                const lBtn = state.selL, rBtn = state.selR;
                                lBtn.classList.add('shake'); rBtn.classList.add('shake');
                                state.shakeTimer = setTimeout(() => {
                                    try { lBtn.classList.remove('shake', 'selected'); rBtn.classList.remove('shake', 'selected'); } catch (e) { }
                                    state.selL = null; state.selR = null; state.shakeTimer = null;
                                }, 400);
                                document.getElementById('matchMsg').textContent = lessonText('notMatch');
                                return;
                            }
                            state.selL = null; state.selR = null;
                        }
                    });
                });
            }

            function renderSlider(q) {
                promptText.innerHTML = q.question;
                options.innerHTML = `
                    <div class="slider-wrap">
                        <input type="range" id="sliderInput" min="${q.min}" max="${q.max}" step="${q.step}" value="${q.min}" />
                        <div class="slider-value"><span id="sliderVal">${q.min}</span>${q.unit ? ' ' + q.unit : ''}</div>
                    </div>`;
                const input = document.getElementById('sliderInput');
                const val = document.getElementById('sliderVal');
                input.addEventListener('input', () => {
                    val.textContent = input.value;
                    selectedAnswer = Number(input.value);
                    checkBtn.style.display = 'inline-block';
                });
            }

            function renderGraph(q) {
                promptText.innerHTML = q.question;
                const size = 320, pad = 30;
                const range = Math.max(Math.abs(q.min), Math.abs(q.max));
                const scale = (size - pad * 2) / (range * 2);
                options.innerHTML = `
                    <div class="graph-wrap">
                        <svg id="graphSvg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
                            ${Array.from({ length: 9 }, (_, i) => {
                    const v = q.min + (q.max - q.min) * (i / 8);
                    const p = pad + ((v + range) / (2 * range)) * (size - pad * 2);
                    return `<line x1="${p}" y1="${pad}" x2="${p}" y2="${size - pad}" stroke="#e5e7eb" /><line x1="${pad}" y1="${p}" x2="${size - pad}" y2="${p}" stroke="#e5e7eb" />`;
                }).join('')}
                            <line x1="${pad}" y1="${size / 2}" x2="${size - pad}" y2="${size / 2}" stroke="#6b7280" stroke-width="2" />
                            <line x1="${size / 2}" y1="${pad}" x2="${size / 2}" y2="${size - pad}" stroke="#6b7280" stroke-width="2" />
                            <circle id="graphDot" cx="${size / 2}" cy="${size / 2}" r="10" fill="var(--accent)" opacity="0" />
                        </svg>
                        <div class="slider-value"><span id="graphVal">—</span>${q.unit ? ' ' + q.unit : ''}</div>
                    </div>`;
                const svg = document.getElementById('graphSvg');
                const dot = document.getElementById('graphDot');
                const val = document.getElementById('graphVal');
                svg.addEventListener('click', (e) => {
                    const rect = svg.getBoundingClientRect();
                    const x = e.clientX - rect.left, y = e.clientY - rect.top;
                    dot.setAttribute('cx', x); dot.setAttribute('cy', y); dot.setAttribute('opacity', '1');
                    const value = (x - size / 2) / scale;
                    const snapped = Math.round(value / q.step) * q.step;
                    selectedAnswer = snapped;
                    val.textContent = snapped.toFixed(q.step < 1 ? 1 : 0);
                    checkBtn.style.display = 'inline-block';
                });
            }

            // ═══════════════════════════════════════════════════════════
            //  CHESS RENDERER (single-move + multi-move + king hiding)
            // ═══════════════════════════════════════════════════════════
            function renderChessQuestion(q) {
                audioControls.style.display = 'none';
                options.innerHTML = '';
                feedback.textContent = '';

                const isMultiMove = Array.isArray(q.moves) && q.moves.length > 1;
                const isSingleMove = !isMultiMove && q.from && q.answer;

                if (!isMultiMove && !isSingleMove) {
                    promptText.textContent = 'This chess question could not be loaded.';
                    chessActivity.hidden = true;
                    results[currentIndex] = false;
                    refreshFinishState();
                    nextBtn.style.display = currentIndex < questions.length - 1 ? 'inline-block' : 'none';
                    return;
                }

                promptText.textContent = q.prompt || 'Tap the piece, then tap where it should move.';
                chessActivity.hidden = false;

                const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
                const board = {};
                const initialFen = String(q.fen || '').split(' ')[0] || '';
                let rank = 8, fileIdx = 0;
                for (const ch of initialFen) {
                    if (ch === '/') { rank -= 1; fileIdx = 0; continue; }
                    if (/\d/.test(ch)) { fileIdx += Number(ch); continue; }
                    if (fileIdx > 7) continue;
                    const square = `${files[fileIdx]}${rank}`;
                    const color = ch === ch.toUpperCase() ? 'w' : 'b';
                    board[square] = `${color}${ch.toUpperCase()}`;
                    fileIdx += 1;
                }

                chessActivity.innerHTML = `
                    <div class="chess-lesson-layout">
                        <div class="board-wrap">
                            <div class="board-container">
                                <div class="board-ranks" id="lessonBoardRanks"></div>
                                <div class="board" id="lessonBoard"></div>
                                <div class="board-files" id="lessonBoardFiles"></div>
                            </div>
                        </div>
                        <div>
                            <p class="board-copy" id="boardPrompt">${escapeHtml(q.prompt || '')}</p>
                            <p class="board-feedback" id="boardFeedback">
                                ${isMultiMove ? 'Play the sequence. Your moves and the replies will alternate.' : 'Tap the highlighted piece to see its legal squares.'}
                            </p>
                            ${isMultiMove ? `<p class="board-progress" id="boardProgress">Move 1 of ${q.moves.length}</p>` : ''}
                        </div>
                    </div>`;

                const ranksEl = document.getElementById('lessonBoardRanks');
                ranksEl.innerHTML = '';
                for (let r = 0; r < 8; r++) {
                    const d = document.createElement('div');
                    d.className = 'coord-text';
                    d.style.cssText = 'font-size:10px;font-weight:700;text-align:center;color:var(--muted,#8b8987);line-height:1;';
                    d.textContent = String(8 - r);
                    ranksEl.appendChild(d);
                }

                const filesEl = document.getElementById('lessonBoardFiles');
                filesEl.innerHTML = '';
                for (let c = 0; c < 8; c++) {
                    const d = document.createElement('div');
                    d.className = 'coord-text';
                    d.style.cssText = 'font-size:10px;font-weight:700;text-align:center;color:var(--muted,#8b8987);line-height:1;';
                    d.textContent = 'abcdefgh'[c];
                    filesEl.appendChild(d);
                }

                const boardEl = document.getElementById('lessonBoard');
                const bf = document.getElementById('boardFeedback');
                const progressEl = document.getElementById('boardProgress');

                const rootStyle = getComputedStyle(document.documentElement);
                const LIGHT = rootStyle.getPropertyValue('--light').trim() || '#ebecd0';
                const DARK = rootStyle.getPropertyValue('--dark').trim() || '#739552';

                let chess;
                try {
                    chess = new Chess(q.fen);
                } catch {
                    promptText.textContent = 'This chess position could not be loaded.';
                    chessActivity.hidden = true;
                    results[currentIndex] = false;
                    refreshFinishState();
                    nextBtn.style.display = currentIndex < questions.length - 1 ? 'inline-block' : 'none';
                    return;
                }

                let currentStep = 0;
                let selectedSquare = null;
                let locked = false;
                let timeoutIds = [];

                function scheduleTimeout(fn, ms) {
                    const id = setTimeout(fn, ms);
                    timeoutIds.push(id);
                    return id;
                }

                const firstFrom = isMultiMove ? q.moves[0].from : q.from;
                const legalFirstMoves = (() => {
                    if (isMultiMove && Array.isArray(q.legalFirstMoves)) return new Set(q.legalFirstMoves);
                    if (isSingleMove && Array.isArray(q.legalMoves)) return new Set(q.legalMoves);
                    try {
                        return new Set(chess.moves({ square: firstFrom, verbose: true }).map(m => m.to));
                    } catch { return new Set(); }
                })();

                const captureSquares = (() => {
                    if (isMultiMove) return new Set();
                    if (Array.isArray(q.captureSquares)) return new Set(q.captureSquares);
                    try {
                        return new Set(chess.moves({ square: q.from, verbose: true }).filter(m => m.captured).map(m => m.to));
                    } catch { return new Set(); }
                })();

                function renderSquare(sq) {
                    const fileIdx = files.indexOf(sq[0]);
                    const rankNum = parseInt(sq[1], 10);
                    const isLight = (fileIdx + rankNum) % 2 === 1;

                    const s = document.createElement('div');
                    s.className = 'square ' + (isLight ? 'light' : 'dark');
                    s.dataset.square = sq;
                    s.style.cssText = `position:relative;cursor:pointer;background:${isLight ? LIGHT : DARK};transition:box-shadow 0.12s ease, filter 0.12s ease;width:100%;height:100%;`;
                    s.setAttribute('role', 'button');
                    s.setAttribute('aria-label', `Square ${sq}`);

                    const piece = chess.get(sq);

                    // ── KING HIDING (NEW) ──
                    const kingsHidden = piece && piece.type === 'k' && q.hideKings;
                    if (kingsHidden) {
                        s.style.opacity = '0.15';
                        s.style.pointerEvents = 'none';
                    }

                    if (isMultiMove) {
                        if (currentStep < q.moves.length && q.moves[currentStep].color === 'white') {
                            const stepFrom = q.moves[currentStep].from;
                            if (sq === stepFrom) {
                                s.style.boxShadow = 'inset 0 0 0 3px #2b70c9';
                                s.title = 'Piece to move';
                            }
                        }
                    } else if (sq === q.from) {
                        s.style.boxShadow = 'inset 0 0 0 3px #2b70c9';
                        s.title = 'Piece to move';
                    }

                    const isStarTarget = q.targetStyle === 'star' && captureSquares.has(sq);

                    if (kingsHidden) {
                        // Skip piece rendering entirely — the square looks empty
                    } else if (isStarTarget) {
                        const star = document.createElement('span');
                        star.className = 'lesson-star-target';
                        star.textContent = '★';
                        s.appendChild(star);
                    } else if (piece && window.SVG_PIECES?.[`${piece.color}${piece.type.toUpperCase()}`]) {
                        const wrap = document.createElement('div');
                        wrap.className = 'piece';
                        wrap.style.cssText = 'position:absolute;inset:0;display:flex;justify-content:center;align-items:center;pointer-events:none;';
                        wrap.innerHTML = window.SVG_PIECES[`${piece.color}${piece.type.toUpperCase()}`];
                        const svg = wrap.querySelector('svg');
                        if (svg) { svg.style.width = '85%'; svg.style.height = '85%'; svg.style.display = 'block'; }
                        s.appendChild(wrap);
                    } else if (piece) {
                        const glyphs = { wK: '♔', wQ: '♕', wR: '♖', wB: '♗', wN: '♘', wP: '♙', bK: '♚', bQ: '♛', bR: '♜', bB: '♝', bN: '♞', bP: '♟' };
                        const fallback = document.createElement('span');
                        fallback.className = `lesson-piece-fallback ${piece.color === 'w' ? 'white-piece' : 'black-piece'}`;
                        fallback.textContent = glyphs[`${piece.color}${piece.type.toUpperCase()}`] || '?';
                        s.appendChild(fallback);
                    }

                    if (selectedSquare === sq) {
                        s.style.boxShadow = 'inset 0 0 0 4px #facc15';
                        s.style.filter = 'brightness(1.08)';
                    }

                    if (selectedSquare && !locked) {
                        const legal = (() => { try { return chess.moves({ square: selectedSquare, verbose: true }); } catch { return []; } })();
                        const dest = legal.find(m => m.to === sq);
                        if (dest) {
                            s.classList.add('legal');
                            if (dest.captured) s.classList.add('capture');
                        }
                    }

                    s.addEventListener('click', () => onSquareClick(sq));
                    return s;
                }

                function renderBoard() {
                    boardEl.innerHTML = '';
                    for (let r = 0; r < 8; r++) {
                        for (let c = 0; c < 8; c++) {
                            const sq = `${files[c]}${8 - r}`;
                            boardEl.appendChild(renderSquare(sq));
                        }
                    }
                }

                function onSquareClick(sq) {
                    if (locked) return;
                    if (isMultiMove && currentStep < q.moves.length && q.moves[currentStep].color === 'black') return;

                    // Kings are unclickable when hidden
                    const clickedPiece = chess.get(sq);
                    if (clickedPiece && clickedPiece.type === 'k' && q.hideKings) return;

                    const piece = clickedPiece;

                    if (!selectedSquare) {
                        const selectableSquare = isMultiMove ? q.moves[currentStep]?.from : q.from;
                        if (sq !== selectableSquare) {
                            playSound('click');
                            bf.textContent = isMultiMove
                                ? `Play from ${selectableSquare} — that's the piece for this step.`
                                : 'Tap the highlighted piece first.';
                            bf.style.color = '#b45309';
                            return;
                        }
                        if (!piece) {
                            playSound('click');
                            bf.textContent = 'No piece on that square.';
                            bf.style.color = '#b45309';
                            return;
                        }
                        selectedSquare = sq;
                        playSound('tap');
                        bf.textContent = isMultiMove
                            ? `Step ${currentStep + 1}: pick a destination.`
                            : `Selected ${sq}. The highlighted squares are legal moves.`;
                        bf.style.color = 'var(--muted)';
                        renderBoard();
                        return;
                    }

                    if (sq === selectedSquare) {
                        selectedSquare = null;
                        playSound('click');
                        bf.textContent = isMultiMove
                            ? `Step ${currentStep + 1}: pick a destination.`
                            : 'Tap the highlighted piece to see its legal squares.';
                        bf.style.color = 'var(--muted)';
                        renderBoard();
                        return;
                    }

                    const legal = (() => { try { return chess.moves({ square: selectedSquare, verbose: true }); } catch { return []; } })();
                    const legalMove = legal.find(m => m.to === sq);
                    if (!legalMove) {
                        playSound('click');
                        bf.textContent = 'That square is not a legal move. Choose a highlighted square.';
                        bf.style.color = '#b45309';
                        return;
                    }
                    if (!isMultiMove && q.type === 'capture' && !legalMove.captured) {
                        playSound('click');
                        bf.textContent = 'That move is legal but captures nothing. Choose a capture square.';
                        bf.style.color = '#b45309';
                        return;
                    }
                    handleMovePlayed(legalMove);
                }

                function handleMovePlayed(move) {
                    const to = move.to;
                    selectedSquare = null;

                    if (isMultiMove) {
                        chess.move(move);
                        playSound(move.captured ? 'capture' : 'move', move.captured || undefined);
                        currentStep += 1;

                        if (currentStep >= q.moves.length) { finishCorrect(); return; }

                        renderBoard();

                        if (q.moves[currentStep].color === 'white') {
                            if (progressEl) progressEl.textContent = `Move ${currentStep + 1} of ${q.moves.length}`;
                            bf.textContent = `Good. Now play from ${q.moves[currentStep].from}.`;
                            bf.style.color = 'var(--muted)';
                        } else {
                            if (progressEl) progressEl.textContent = `Opponent's reply…`;
                            bf.textContent = 'Opponent is replying…';
                            bf.style.color = 'var(--muted)';
                            const blackMove = q.moves[currentStep];
                            scheduleTimeout(() => {
                                if (locked) return;
                                try {
                                    chess.move({ from: blackMove.from, to: blackMove.to, promotion: blackMove.promo || 'q' });
                                    playSound('moveOpponent');
                                } catch (err) {
                                    bf.textContent = 'Sequence error. Skipping question.';
                                    bf.style.color = '#b91c1c';
                                    results[currentIndex] = false;
                                    refreshFinishState();
                                    nextBtn.style.display = currentIndex < questions.length - 1 ? 'inline-block' : 'none';
                                    return;
                                }
                                currentStep += 1;
                                renderBoard();
                                if (currentStep >= q.moves.length) { finishCorrect(); return; }
                                if (progressEl) progressEl.textContent = `Move ${currentStep + 1} of ${q.moves.length}`;
                                bf.textContent = `Good. Now play from ${q.moves[currentStep].from}.`;
                                bf.style.color = 'var(--muted)';
                            }, 600);
                        }
                        return;
                    }

                    const isCorrect = (() => {
                        if (q.type === 'capture') return captureSquares.has(to);
                        if (q.type === 'find-move') return legalFirstMoves.has(to);
                        if (q.type === 'mate-in-one') {
                            try {
                                const test = new Chess(chess.fen());
                                test.move(move);
                                return test.isCheckmate();
                            } catch { return false; }
                        }
                        return to === q.answer;
                    })();

                    if (isCorrect) {
                        chess.move(move);
                        renderBoard();
                        if (move.captured) { playSound('correct'); scheduleTimeout(() => playSound('capture', move.captured), 200); }
                        else { playSound('correct'); scheduleTimeout(() => playSound('move'), 200); }
                        finishCorrect();
                    } else {
                        locked = true;
                        const correctSquares = q.type === 'capture' ? captureSquares : legalFirstMoves;
                        correctSquares.forEach(sq => {
                            const cell = boardEl.querySelector(`[data-square="${sq}"]`);
                            if (cell) { cell.style.background = '#bbf7d0'; cell.style.boxShadow = 'inset 0 0 0 3px #22c55e'; }
                        });
                        const clickedCell = boardEl.querySelector(`[data-square="${to}"]`);
                        if (clickedCell) { clickedCell.style.background = '#fecaca'; clickedCell.style.boxShadow = 'inset 0 0 0 3px #ef4444'; }
                        playSound('wrong');
                        bf.textContent = q.type === 'capture'
                            ? 'Not quite — choose a highlighted capture square.'
                            : `Not quite — the answer is ${q.answer}.`;
                        bf.style.color = '#b91c1c';

                        recordAnswer(false);
                        nextBtn.style.display = currentIndex < questions.length - 1 ? 'inline-block' : 'none';
                        refreshFinishState();
                    }
                }

                function finishCorrect() {
                    locked = true;
                    bf.textContent = isMultiMove
                        ? `Excellent! You played the full sequence of ${q.moves.length} moves.`
                        : 'Correct!';
                    bf.style.color = '#278a44';
                    recordAnswer(true);
                    nextBtn.style.display = currentIndex < questions.length - 1 ? 'inline-block' : 'none';
                    refreshFinishState();
                    if (currentIndex === questions.length - 1 && canEnableFinish()) finishBtn.click();
                }

                if (typeof window.__chessLessonCleanup === 'function') {
                    try { window.__chessLessonCleanup(); } catch { }
                }
                window.__chessLessonCleanup = () => { timeoutIds.forEach(id => clearTimeout(id)); timeoutIds = []; };

                renderBoard();
                if (isMultiMove && progressEl) progressEl.textContent = `Move 1 of ${q.moves.length}`;
                requestAnimationFrame(() => window.fitBoards?.());
                scheduleTimeout(() => window.fitBoards?.(), 50);
                scheduleTimeout(() => window.fitBoards?.(), 250);
            }

            function renderQuestion() {
                if (activeRecognition) { try { activeRecognition.abort(); } catch (e) { } activeRecognition = null; }
                if (matchPairsState && matchPairsState.shakeTimer) { clearTimeout(matchPairsState.shakeTimer); matchPairsState = null; }

                // Mark lesson as in-progress for exit confirmation
                window.__musalingoLessonState?.setInProgress();

                const q = questions[currentIndex];
                questionPhrase = q.phrase || q.sentence || q.pronunciation || (isMath ? q.question : '');
                questionSpeechLanguage = q.phrase || q.sentence || q.pronunciation
                    ? practice.language
                    : isMath ? 'English' : audienceLanguage;
                feedback.textContent = '';
                feedback.style.color = 'var(--accent-dark)';
                statusText.textContent = lessonText('questionNumber', { current: currentIndex + 1, total: questions.length });
                selectedAnswer = null;
                audioControls.style.display = '';
                checkBtn.style.display = 'none';
                nextBtn.style.display = 'none';
                refreshFinishState();
                hintBtn.style.display = (isChess || isMath || q.type === 'fill-blank') ? 'inline-block' : 'none';

                if (isChess) return renderChessQuestion(q);

                if (q.type === 'speak' && skipSpeakingQuestions) { skipCurrentSpeakQuestion(); return; }

                switch (q.type) {
                    case 'fill-blank': return renderFillBlank(q);
                    case 'arrange': return renderArrange(q);
                    case 'listen': return renderListen(q);
                    case 'speak': return renderSpeak(q);
                    case 'spell': return renderSpell(q);
                    case 'translate-type': return renderTranslateType(q);
                    case 'match-pairs': return renderMatchPairs(q);
                    case 'slider': return renderSlider(q);
                    case 'graph': return renderGraph(q);
                    default: return renderMultipleChoice(q);
                }
            }

            normalVoiceBtn.addEventListener('click', () => pronounceQuestion(1));
            slowVoiceBtn.addEventListener('click', () => pronounceQuestion(0.5));

            hintBtn.addEventListener('click', () => {
                const q = questions[currentIndex];
                if (!q) return;
                feedback.textContent = '💡 ' + (q.hint || lessonText('takeYourTime'));
                feedback.style.color = 'var(--blue)';
            });

            checkBtn.addEventListener('click', () => {
                const q = questions[currentIndex];
                if (q.type === 'movement') return;
                if (selectedAnswer === null) { feedback.textContent = lessonText('chooseAnswer'); feedback.style.color = '#b91c1c'; return; }

                let isCorrect = false;
                if (q.type === 'spell' || q.type === 'listen' || q.type === 'translate-type') isCorrect = matchesQuestionAnswer(q, selectedAnswer);
                else if (q.type === 'slider' || q.type === 'graph') isCorrect = Math.abs(Number(selectedAnswer) - Number(q.answer)) < 0.001;
                else isCorrect = selectedAnswer === q.answer;

                const selectedButton = options.querySelector('.answer-btn.selected');
                if (selectedButton) { selectedButton.classList.remove('selected'); selectedButton.classList.add(isCorrect ? 'correct' : 'wrong'); }

                isCorrect ? playSound('correct') : playSound('wrong');
                options.querySelectorAll('.answer-btn').forEach(o => o.disabled = true);

                recordAnswer(isCorrect);
                feedback.textContent = isCorrect
                    ? lessonText('correct')
                    : lessonText('incorrect', { answer: q.answer || q.phrase });
                feedback.style.color = isCorrect ? 'var(--accent-dark)' : '#b91c1c';

                checkBtn.style.display = 'none';
                nextBtn.style.display = currentIndex < questions.length - 1 ? 'inline-block' : 'none';
                refreshFinishState();
                selectedAnswer = null;
                if (currentIndex === questions.length - 1 && canEnableFinish()) finishBtn.click();
            });

            nextBtn.addEventListener('click', () => {
                if (results[currentIndex] === undefined) { feedback.textContent = lessonText('answerFirst'); feedback.style.color = '#b91c1c'; return; }
                currentIndex += 1;
                if (currentIndex < questions.length) renderQuestion();
            });

            finishBtn.addEventListener('click', () => {
                if (isFinished) return;
                if (answeredCount() < questions.length) { feedback.textContent = lessonText('finishQuestions'); feedback.style.color = '#b91c1c'; return; }
                if (!canEnableFinish()) {
                    results.fill(null);
                    currentIndex = 0;
                    refreshFinishState();
                    renderQuestion();
                    feedback.textContent = lessonText('retryQuestions');
                    return;
                }
                isFinished = true;
                window.__musalingoLessonState?.setFinished();

                if (!isReview) {
                    lesson.completed = true;
                    const completedCount = course.lessons.filter(i => i.completed).length;
                    course.progress = Math.min(100, Math.round((completedCount / course.lessons.length) * 100));
                }

                const rewardXp = isReview ? 5 : 20;
                const today = new Date().toISOString().slice(0, 10);
                const attemptedCount = results.filter((result) => typeof result === 'boolean').length;
                const accuracy = attemptedCount
                    ? Math.round((results.filter((result) => result === true).length / attemptedCount) * 100)
                    : 100;

                if (!savedTheme.noGamification) profile.xp = (Number(profile.xp) || 0) + rewardXp;

                if (!isReview) {
                    if (!savedTheme.noGamification) { profile.diamonds += 20; playSound('gemEarned'); }
                    profile.practiceMinutes = (Number(profile.practiceMinutes) || 0) + 10;

                    if (!savedTheme.noStreaks && profile.streakStatus !== 'paused') {
                        if (!profile.lastLessonDate) { profile.streak = 1; }
                        else {
                            const lastLesson = new Date(profile.lastLessonDate);
                            const todayDate = new Date(today);
                            const gap = Math.round((todayDate - lastLesson) / 86400000);

                            if (gap === 1) { profile.streak += 1; }
                            else if (gap >= 2) {
                                const missedDays = gap - 1;
                                const freezesAvailable = Number(profile.streakFreezes) || 0;
                                if (freezesAvailable >= missedDays) {
                                    profile.streakFreezes = freezesAvailable - missedDays;
                                    profile.streakFreezeDates = Array.isArray(profile.streakFreezeDates) ? profile.streakFreezeDates : [];
                                    for (let i = 1; i <= missedDays; i++) {
                                        const missed = new Date(lastLesson);
                                        missed.setDate(missed.getDate() + i);
                                        const key = missed.toISOString().slice(0, 10);
                                        if (!profile.streakFreezeDates.includes(key)) profile.streakFreezeDates.push(key);
                                    }
                                    profile.streak += missedDays + 1;
                                } else { profile.streak = 1; }
                            }
                        }
                        profile.lastLessonDate = today;
                        profile.lastActiveDate = today;
                        profile.streakStatus = 'active';
                    }
                }

                profile.lessonDates = Array.isArray(profile.lessonDates) ? profile.lessonDates : [];
                if (!isReview && !profile.lessonDates.includes(today)) profile.lessonDates.push(today);

                if (profile.dailyQuestDate !== today) {
                    profile.dailyQuestDate = today;
                    profile.dailyQuestProgress = { lessons: 0, xp: 0, practice: 0, accuracy: 0, streak: 0 };
                }
                const qp = profile.dailyQuestProgress;
                qp.lessons = (qp.lessons || 0) + (isReview ? 0 : 1);
                qp.xp = (qp.xp || 0) + rewardXp;
                qp.practice = (qp.practice || 0) + 10;
                qp.accuracy = Math.max(qp.accuracy || 0, accuracy);
                qp.streak = Math.max(qp.streak || 0, profile.streak > 0 ? 1 : 0);

                saveProfile(profile);

                try {
                    const curriculum = window.MUSALINGO_CURRICULUM;
                    const sectionNo = Number(urlParams.get('section')) || 1;
                    if (!isReview && curriculum && course) {
                        const sectionIndex = sectionNo - 1;
                        const sectionLessons = course.lessons.filter(l => (l.sectionIndex ?? 0) === sectionIndex);
                        const allDone = sectionLessons.length > 0 && sectionLessons.every(l => l.completed);
                        const lastLesson = sectionLessons[sectionLessons.length - 1];
                        const isLastOfSection = lastLesson && lesson.id === lastLesson.id;
                        const sectionsForCourse = curriculum.sections?.[course.id];
                        const totalSections = Array.isArray(sectionsForCourse) ? sectionsForCourse.length : (curriculum.courses?.[course.id]?.totalSections || 7);

                        if (allDone && isLastOfSection && sectionNo < totalSections) {
                            const nextSectionUrl = `course.html?courseId=${encodeURIComponent(course.id)}&section=${sectionNo + 1}`;
                            advanceTimer = window.setTimeout(() => {
                                if (document.visibilityState === 'visible') window.location.href = nextSectionUrl;
                            }, 1200);
                        }
                    }
                } catch (err) { console.warn('Auto-advance failed:', err); }

                if (window.SFX?.cancelSpeech) window.SFX.cancelSpeech();
                playSound('complete');

                completionAccuracy.textContent = `${accuracy}%`;
                completionXp.textContent = `+${rewardXp}`;
                completionPanel.hidden = false;
                audioControls.style.display = 'none';
                exitBtn.style.display = 'none';
                hintBtn.style.display = 'none';
                options.innerHTML = '';
                chessActivity.hidden = true;
                promptText.textContent = lessonText('finishAll');
                feedback.textContent = '';
                nextBtn.style.display = 'none';
                finishBtn.style.display = 'none';
                statusText.textContent = savedTheme.noGamification ? lessonText('completeSaved') : lessonText('resultsReady');

                if (advanceTimer) {
                    const cancelAdvance = () => { if (advanceTimer) { window.clearTimeout(advanceTimer); advanceTimer = null; } };
                    completionPanel.addEventListener('click', cancelAdvance, { once: true });
                    completionPanel.addEventListener('touchstart', cancelAdvance, { once: true });
                }
            });

            window.addEventListener('pagehide', () => {
                if (activeRecognition) { try { activeRecognition.abort(); } catch (e) { } activeRecognition = null; }
                if (matchPairsState && matchPairsState.shakeTimer) { clearTimeout(matchPairsState.shakeTimer); matchPairsState = null; }
                if (window.SFX?.cancelSpeech) window.SFX.cancelSpeech();
                if (advanceTimer) { clearTimeout(advanceTimer); advanceTimer = null; }
                if (typeof window.__chessLessonCleanup === 'function') {
                    try { window.__chessLessonCleanup(); } catch { }
                }
            });

            renderQuestion();
        })();
    }
}