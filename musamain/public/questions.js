(function bootstrapQuestions() {
'use strict';

const audienceData = globalThis.MusalingoAudience || {
    languageCodes: { English: 'en', Spanish: 'es', French: 'fr', Japanese: 'ja', Hindi: 'hi' },
    languageNames: {},
    translations: {},
    hints: {},
    catalogGroups: []
};

const ENGLISH_TRANSLATIONS = {
    English: { Hello: 'hello', Goodbye: 'goodbye', Book: 'book', Happy: 'happy', 'Thank you': 'thank you', Friend: 'friend', Water: 'water', House: 'house', Please: 'please', School: 'school' },
    Japanese: { 'こんにちは': 'hello', 'ありがとう': 'thank you', '学校': 'school', '猫': 'cat', '水': 'water', '友達': 'friend', '本': 'book', '食べ物': 'food', '家': 'home', '朝': 'morning', '車': 'car', '音楽': 'music', '夜': 'night', '雨': 'rain', '元気': 'well' },
    Spanish: { hola: 'hello', adios: 'goodbye', libro: 'book', feliz: 'happy', gracias: 'thank you', 'por favor': 'please', amigo: 'friend', agua: 'water', mesa: 'table', casa: 'house', escuela: 'school', manzana: 'apple', correr: 'run', puerta: 'door', sol: 'sun' },
    French: { bonjour: 'hello', merci: 'thank you', livre: 'book', maison: 'house', ami: 'friend', eau: 'water', porte: 'door', soleil: 'sun', ecole: 'school', pomme: 'apple', voiture: 'car' },
    German: { hallo: 'hello', danke: 'thank you', buch: 'book', freund: 'friend', wasser: 'water', schule: 'school', haus: 'house', tafel: 'table', musik: 'music', apfel: 'apple', laufen: 'run', sonne: 'sun', tur: 'door' },
    Italian: { ciao: 'hello', grazie: 'thank you', libro: 'book', amico: 'friend', acqua: 'water', scuola: 'school', casa: 'house', mela: 'apple', musica: 'music', porta: 'door', sole: 'sun', corre: 'run' },
    Arabic: { 'مرحبا': 'hello', 'شكرا': 'thank you', 'كتاب': 'book', 'بيت': 'house', 'ماء': 'water', 'صديق': 'friend', 'مدرسة': 'school', 'نافذة': 'window', 'قمر': 'moon', 'تفاحة': 'apple', 'أحب': 'love', 'سماء': 'sky', 'باب': 'door', 'شمس': 'sun' },
    Hindi: { 'नमस्ते': 'hello', 'धन्यवाद': 'thank you', 'किताब': 'book', 'मित्र': 'friend', 'पानी': 'water', 'विद्यालय': 'school', 'घर': 'house', 'दरवाज़ा': 'door', 'सूरज': 'sun', 'सेब': 'apple', 'दोस्ती': 'friendship', 'आकाश': 'sky', 'चाँद': 'moon' },
    Korean: { '안녕하세요': 'hello', '고맙습니다': 'thank you', '책': 'book', '친구': 'friend', '물': 'water', '학교': 'school', '집': 'house', '문': 'door', '해': 'sun' },
    Telugu: { 'నమస్కారం': 'hello', 'హలో': 'hello', 'ధన్యవాదాలు': 'thank you', 'పుస్తకం': 'book', 'స్నేహితుడు': 'friend', 'నీళ్ళు': 'water', 'పాఠశాల': 'school', 'ఇల్లు': 'house', 'తలుపు': 'door', 'సూర్యుడు': 'sun' }
};

const LANGUAGE_SAMPLES = {
    English: [
        ['Hello', 'Hello', ['Goodbye', 'Book', 'Happy'], 'hello'],
        ['Thank you', 'Thank you', ['Friend', 'Water', 'House'], 'thank you'],
        ['Please', 'Please', ['Hello', 'School', 'Book'], 'please'],
        ['School', 'School', ['Happy', 'Friend', 'Goodbye'], 'school'],
        ['Book', 'Book', ['Water', 'Please', 'House'], 'book']
    ],
    Japanese: [
        ['こんにちは', 'こんにちは', ['ありがとう', '学校', '猫'], 'konnichiwa'],
        ['ありがとう', 'ありがとう', ['水', '友達', '本'], 'arigatou'],
        ['学校', '学校', ['食べ物', '家', '朝'], 'gakkou'],
        ['友達', '友達', ['車', '音楽', '夜'], 'tomodachi'],
        ['本', '本', ['水', '雨', '元気'], 'hon']
    ],
    Spanish: [
        ['hola', 'hola', ['adios', 'libro', 'feliz'], 'hello'],
        ['gracias', 'gracias', ['por favor', 'amigo', 'agua'], 'thank you'],
        ['amigo', 'amigo', ['mesa', 'agua', 'casa'], 'friend'],
        ['escuela', 'escuela', ['manzana', 'feliz', 'correr'], 'school'],
        ['libro', 'libro', ['puerta', 'hola', 'sol'], 'book']
    ],
    French: [
        ['bonjour', 'bonjour', ['merci', 'livre', 'maison'], 'hello'],
        ['merci', 'merci', ['ami', 'eau', 'maison'], 'thank you'],
        ['ami', 'ami', ['livre', 'porte', 'soleil'], 'friend'],
        ['ecole', 'ecole', ['pomme', 'ami', 'voiture'], 'school'],
        ['livre', 'livre', ['porte', 'bonjour', 'maison'], 'book']
    ],
    German: [
        ['hallo', 'hallo', ['danke', 'buch', 'freund'], 'hello'],
        ['danke', 'danke', ['wasser', 'schule', 'haus'], 'thank you'],
        ['freund', 'freund', ['buch', 'tafel', 'musik'], 'friend'],
        ['schule', 'schule', ['apfel', 'laufen', 'sonne'], 'school'],
        ['buch', 'buch', ['tur', 'hallo', 'musik'], 'book']
    ],
    Italian: [
        ['ciao', 'ciao', ['grazie', 'libro', 'amico'], 'hello'],
        ['grazie', 'grazie', ['acqua', 'scuola', 'casa'], 'thank you'],
        ['amico', 'amico', ['mela', 'musica', 'porta'], 'friend'],
        ['scuola', 'scuola', ['mela', 'corre', 'sole'], 'school'],
        ['libro', 'libro', ['porta', 'ciao', 'sole'], 'book']
    ],
    Arabic: [
        ['مرحبا', 'مرحبا', ['شكرا', 'كتاب', 'بيت'], 'hello'],
        ['شكرا', 'شكرا', ['ماء', 'صديق', 'مدرسة'], 'thank you'],
        ['صديق', 'صديق', ['كتاب', 'نافذة', 'قمر'], 'friend'],
        ['مدرسة', 'مدرسة', ['تفاحة', 'أحب', 'سماء'], 'school'],
        ['كتاب', 'كتاب', ['باب', 'مرحبا', 'شمس'], 'book']
    ],
    Hindi: [
        ['नमस्ते', 'नमस्ते', ['धन्यवाद', 'किताब', 'मित्र'], 'namaste'],
        ['धन्यवाद', 'धन्यवाद', ['पानी', 'विद्यालय', 'घर'], 'dhanyavaad'],
        ['मित्र', 'मित्र', ['किताब', 'दरवाज़ा', 'सूरज'], 'mitra'],
        ['विद्यालय', 'विद्यालय', ['सेब', 'दोस्ती', 'आकाश'], 'vidyalaya'],
        ['किताब', 'किताब', ['दरवाज़ा', 'नमस्ते', 'चाँद'], 'kitab']
    ],
    Korean: [
        ['안녕하세요', '안녕하세요', ['고맙습니다', '책', '친구'], 'annyeonghaseyo'],
        ['고맙습니다', '고맙습니다', ['물', '학교', '집'], 'gomapseumnida'],
        ['친구', '친구', ['책', '문', '해'], 'chingu'],
        ['학교', '학교', ['집', '물', '안녕하세요'], 'hakgyo'],
        ['책', '책', ['문', '해', '고맙습니다'], 'chaek']
    ],
    Telugu: [
        ['నమస్కారం', 'నమస్కారం', ['ధన్యవాదాలు', 'పుస్తకం', 'స్నేహితుడు'], 'namaskaram'],
        ['ధన్యవాదాలు', 'ధన్యవాదాలు', ['నీళ్ళు', 'పాఠశాల', 'ఇల్లు'], 'dhanyavaadaalu'],
        ['స్నేహితుడు', 'స్నేహితుడు', ['పుస్తకం', 'తలుపు', 'సూర్యుడు'], 'snehitudu'],
        ['పాఠశాల', 'పాఠశాల', ['ఇల్లు', 'నీళ్ళు', 'నమస్కారం'], 'paathashaala'],
        ['పుస్తకం', 'పుస్తకం', ['తలుపు', 'సూర్యుడు', 'ధన్యవాదాలు'], 'pustakam']
    ]
};

const CHESS_SAMPLES = {
    'piece movement': [
        { fen: '7k/8/8/8/4K3/8/8/8 w - - 0 1', from: 'e4', answer: 'e5', legalMoves: ['d3', 'd4', 'd5', 'e3', 'e5', 'f3', 'f4', 'f5'], prompt: 'The king is highlighted. Tap a square where it can move.', hint: 'The king moves one square in any direction.' },
        { fen: 'k7/8/8/8/3Q4/8/8/7K w - - 0 1', from: 'd4', answer: 'd5', legalMoves: ['a1', 'a4', 'a7', 'b2', 'b4', 'b6', 'c3', 'c4', 'c5', 'd1', 'd2', 'd3', 'd5', 'd6', 'd7', 'd8', 'e3', 'e4', 'e5', 'f2', 'f4', 'f6', 'g1', 'g4', 'g7', 'h4', 'h8'], prompt: 'The queen is highlighted. Tap a square where it can move.', hint: 'The queen moves in straight and diagonal lines.' },
        { fen: '7k/8/8/8/8/8/8/K2R4 w - - 0 1', from: 'd1', answer: 'd2', legalMoves: ['b1', 'c1', 'e1', 'f1', 'g1', 'h1', 'd2', 'd3', 'd4', 'd5', 'd6', 'd7', 'd8'], prompt: 'The rook is highlighted. Tap a square where it can move.', hint: 'The rook moves along ranks and files.' },
        { fen: '7k/8/8/8/2B5/8/8/K7 w - - 0 1', from: 'c4', answer: 'd5', legalMoves: ['a2', 'a6', 'b3', 'b5', 'd3', 'd5', 'e2', 'e6', 'f1', 'f7', 'g8'], prompt: 'The bishop is highlighted. Tap a square where it can move.', hint: 'The bishop moves along diagonals.' },
        { fen: '7k/8/8/8/8/8/8/K5N1 w - - 0 1', from: 'g1', answer: 'f3', legalMoves: ['e2', 'f3', 'h3'], prompt: 'The knight is highlighted. Tap a square where it can move.', hint: 'A knight moves in an L-shape.' },
        { fen: '7k/8/8/8/8/8/4P3/K7 w - - 0 1', from: 'e2', answer: 'e3', legalMoves: ['e3', 'e4'], prompt: 'The pawn is highlighted. Tap a square where it can move.', hint: 'Pawns move forward and can move two squares on their first move.' }
    ],
    'capturing and attacking': [
        { type: 'capture', fen: '7k/3p4/8/8/3R4/8/8/K7 w - - 0 1', from: 'd4', answer: 'd7', legalMoves: ['d1', 'd2', 'd3', 'd5', 'd6', 'd7', 'a4', 'b4', 'c4', 'e4', 'f4', 'g4', 'h4'], captureSquares: ['d7'], prompt: 'Capture a star with the highlighted rook.', hint: 'The rook moves along ranks and files to capture.' },
        { type: 'capture', fen: '7k/8/4p3/8/3N4/8/8/K7 w - - 0 1', from: 'd4', answer: 'e6', legalMoves: ['b3', 'b5', 'c2', 'c6', 'e2', 'e6', 'f3', 'f5'], captureSquares: ['e6'], prompt: 'Capture a star with the highlighted knight.', hint: 'Knights capture in an L-shape.' },
        { type: 'capture', fen: '7k/5p2/8/8/2B5/8/8/K7 w - - 0 1', from: 'c4', answer: 'f7', legalMoves: ['a2', 'a6', 'b3', 'b5', 'd3', 'd5', 'e2', 'e6', 'f1', 'f7'], captureSquares: ['f7'], prompt: 'Capture a star with the highlighted bishop.', hint: 'The bishop captures along a diagonal.' }
    ],
    checkmate: [
        { fen: 'Q7/5K1k/8/5p2/8/8/8/8 w - - 0 1', from: 'a8', answer: 'h1', prompt: 'The queen is highlighted. Tap the square that delivers checkmate.', hint: 'Checkmate means the king is in check with no escape.' },
        { fen: '1n6/8/8/k1K5/8/5Q2/8/8 w - - 0 1', from: 'f3', answer: 'a3', prompt: 'The queen is highlighted. Tap the square that delivers checkmate.', hint: 'Queens can dominate the back rank.' },
        { fen: '4n3/8/8/8/4R3/1K6/8/k7 w - - 0 1', from: 'e4', answer: 'e1', prompt: 'The rook is highlighted. Tap the square that delivers checkmate.', hint: 'Rooks can mate along the back rank.' }
    ],
    opening: [
        { fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w - - 0 1', from: 'e2', answer: 'e4', prompt: 'The pawn is highlighted. Tap the opening move.', hint: "King's pawn opening." },
        { fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w - - 0 1', from: 'd2', answer: 'd4', prompt: 'The pawn is highlighted. Tap the opening move.', hint: "Queen's pawn opening." },
        { fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w - - 0 1', from: 'g1', answer: 'f3', prompt: 'The knight is highlighted. Tap the developing move.', hint: 'Knights develop before bishops.' }
    ],
    endgame: [
        { fen: '7k/8/8/8/8/8/4P3/4K3 w - - 0 1', from: 'e2', answer: 'e4', prompt: 'The pawn is highlighted. Push it toward the promotion square.', hint: 'Push the pawn and escort it with the king.' },
        { fen: '7k/8/8/8/8/8/8/3QK3 w - - 0 1', from: 'd1', answer: 'd8', prompt: 'The queen is highlighted. Tap the square that delivers checkmate.', hint: 'Look for a queen move that traps the king.' },
        { fen: '7k/8/8/8/8/8/3R4/7K w - - 0 1', from: 'd2', answer: 'd8', prompt: 'The rook is highlighted. Tap the square that delivers checkmate.', hint: 'Rooks can mate along the back rank.' }
    ]
};

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const INTERVAL_NAMES = ['Minor 2nd', 'Major 2nd', 'Minor 3rd', 'Major 3rd', 'Perfect 4th', 'Tritone', 'Perfect 5th', 'Minor 6th', 'Major 6th', 'Minor 7th', 'Major 7th', 'Octave'];

const pick = (items) => items[Math.floor(Math.random() * items.length)];
const shuffle = (items) => {
    const result = [...items];
    for (let i = result.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
};

function getHiddenKingSquares(fen, movingSquare) {
    const files = 'abcdefgh';
    const kingSquares = [];
    let rank = 8;
    let fileIndex = 0;
    for (const piece of String(fen || '').split(' ')[0]) {
        if (piece === '/') { rank--; fileIndex = 0; continue; }
        if (/\d/.test(piece)) { fileIndex += Number(piece); continue; }
        const square = `${files[fileIndex]}${rank}`;
        if (piece.toLowerCase() === 'k' && square !== movingSquare) kingSquares.push(square);
        fileIndex++;
    }
    return kingSquares;
}

function generateChessFallbackQuestions(count, topic, unitIndex) {
    const topicLower = String(topic || '').toLowerCase();
    const pool = Object.keys(CHESS_SAMPLES).find((key) => topicLower.includes(key));
    const samples = CHESS_SAMPLES[pool || 'piece movement'];
    const lessonNumber = Number(String(topic || '').match(/(\d+)\s*$/)?.[1]) || 0;
    const isCaptureLesson = /capturing and attacking/i.test(topicLower);
    const starTargetLesson = isCaptureLesson && lessonNumber > 0 && lessonNumber <= 3;
    const hideKings = Number.isInteger(unitIndex)
        && unitIndex >= 0
        && unitIndex < 3
        && !/king|checkmate|mate|opening|endgame/i.test(topicLower);

    return Array.from({ length: count }, (_, index) => {
        const sample = samples[(index + lessonNumber) % samples.length];
        const isCapture = sample.type === 'capture';
        return {
            type: sample.type || 'find-move',
            fen: sample.fen,
            from: sample.from,
            answer: sample.answer,
            legalMoves: sample.legalMoves,
            captureSquares: sample.captureSquares,
            hiddenPieces: hideKings ? getHiddenKingSquares(sample.fen, sample.from) : undefined,
            targetStyle: isCapture ? (starTargetLesson ? 'star' : 'piece') : undefined,
            prompt: isCapture && !starTargetLesson
                ? sample.prompt.replace('Capture a star', 'Capture the opponent piece')
                : sample.prompt,
            hint: sample.hint
        };
    });
}

function generateMusicQuestions(count, level = 1) {
    const questions = [];
    const questionTypes = level === 1 ? ['note', 'interval'] : level === 2 ? ['note', 'interval', 'chord'] : ['note', 'interval', 'chord', 'key'];
    while (questions.length < count) {
        const type = pick(questionTypes);
        if (type === 'note') {
            const clefNotes = {
                treble: ['E4', 'F4', 'G4', 'A4', 'B4', 'C5', 'D5', 'E5', 'F5'],
                bass: ['G2', 'A2', 'B2', 'C3', 'D3', 'E3', 'F3', 'G3', 'A3']
            };
            const clef = pick(Object.keys(clefNotes));
            const position = Math.floor(Math.random() * clefNotes[clef].length);
            const answer = clefNotes[clef][position];
            const positionName = position % 2 === 0
                ? `line ${Math.floor(position / 2) + 1}`
                : `space ${Math.ceil(position / 2)}`;
            const distractors = [...new Set(Object.values(clefNotes).flat().filter((note) => note !== answer))];
            questions.push({
                type: 'multiple-choice',
                question: `In the ${clef} clef, which pitch is on the ${positionName} from the bottom?`,
                answer,
                distractors: shuffle(distractors).slice(0, 3),
                hint: clef === 'treble' ? 'The bottom line of the treble staff is E4.' : 'The bottom line of the bass staff is G2.'
            });
        } else if (type === 'interval') {
            const rootIndex = Math.floor(Math.random() * NOTE_NAMES.length);
            const semitones = 1 + Math.floor(Math.random() * 12);
            const topPosition = rootIndex + semitones;
            const root = `${NOTE_NAMES[rootIndex]}4`;
            const top = `${NOTE_NAMES[topPosition % NOTE_NAMES.length]}${4 + Math.floor(topPosition / NOTE_NAMES.length)}`;
            const answer = INTERVAL_NAMES[semitones - 1];
            questions.push({
                type: 'multiple-choice',
                question: `What interval is ${root} to ${top}?`,
                answer,
                distractors: shuffle(INTERVAL_NAMES.filter((item) => item !== answer)).slice(0, 3),
                hint: `Count the semitones between ${root} and ${top}.`
            });
        } else if (type === 'chord') {
            const root = pick(NOTE_NAMES);
            const chordType = pick(['Major', 'Minor', 'Diminished', 'Augmented']);
            const rootIndex = NOTE_NAMES.indexOf(root);
            const third = chordType === 'Major' || chordType === 'Augmented' ? 4 : 3;
            const fifth = chordType === 'Diminished' ? 6 : chordType === 'Augmented' ? 8 : 7;
            const chordNotes = [root, NOTE_NAMES[(rootIndex + third) % 12], NOTE_NAMES[(rootIndex + fifth) % 12]];
            questions.push({
                type: 'multiple-choice',
                question: `The notes ${chordNotes.join('–')} form what kind of chord?`,
                answer: `${root} ${chordType}`,
                distractors: ['Major', 'Minor', 'Diminished', 'Augmented'].filter((item) => item !== chordType).map((item) => `${root} ${item}`),
                hint: 'Look at the distance between the root and the third.'
            });
        } else {
            const keys = { C: '0 sharps/flats', G: '1 sharp', D: '2 sharps', A: '3 sharps', E: '4 sharps', B: '5 sharps', 'F#': '6 sharps', 'C#': '7 sharps', F: '1 flat', Bb: '2 flats', Eb: '3 flats', Ab: '4 flats', Db: '5 flats', Gb: '6 flats', Cb: '7 flats' };
            const key = pick(Object.keys(keys));
            const answer = keys[key];
            questions.push({
                type: 'multiple-choice',
                question: `How many sharps or flats are in the key of ${key} major?`,
                answer,
                distractors: shuffle(Object.values(keys).filter((item) => item !== answer)).slice(0, 3),
                hint: 'Sharps follow F–C–G–D–A–E–B; flats go backwards.'
            });
        }
    }
    return questions;
}

function localizeMeaning(meaning, audienceLanguage, localize) {
    const text = String(meaning || '').trim();
    if (typeof localize === 'function') return localize(text);
    return audienceData.translations[audienceLanguage]?.[text.toLowerCase()] || text;
}

function resolveFallbackLanguage(language) {
    const raw = String(language || '').trim();
    if (/hindi|हिंदी|हिन्दी/i.test(raw)) return 'Hindi';
    if (/telugu|తెలుగు/i.test(raw)) return 'Telugu';
    if (/korean|한국어/i.test(raw)) return 'Korean';
    if (/japanese|日本語|nihongo/i.test(raw)) return 'Japanese';
    if (/arabic|العربية/i.test(raw)) return 'Arabic';
    if (/spanish|español|espanol/i.test(raw)) return 'Spanish';
    if (/french|français|francais/i.test(raw)) return 'French';
    if (/german|deutsch/i.test(raw)) return 'German';
    if (/italian|italiano/i.test(raw)) return 'Italian';
    if (/english/i.test(raw)) return 'English'; // also covers "Intermediate English"
    return raw;
}

function generateFallbackQuestions(language, topic, count = 10, audienceLanguage = 'English', options = {}) {
    const normalizedLanguage = String(language || 'Spanish').trim();
    const fallbackLanguage = resolveFallbackLanguage(normalizedLanguage);
    const fallbackTopic = String(topic || 'daily practice');
    const numberOfQuestions = Math.max(0, Math.floor(Number(count)) || 0);

    if (fallbackLanguage === 'Chess') {
        const generated = options.generateChessQuestions?.(numberOfQuestions, 1, fallbackTopic, options.unitIndex);
        return Array.isArray(generated) && generated.length
            ? generated
            : generateChessFallbackQuestions(numberOfQuestions, fallbackTopic, options.unitIndex);
    }
    if (fallbackLanguage === 'Music') {
        const generated = options.generateMusicQuestions?.(numberOfQuestions);
        return Array.isArray(generated) && generated.length ? generated : generateMusicQuestions(numberOfQuestions);
    }
    if (fallbackLanguage === 'Math') {
        return Array.from({ length: numberOfQuestions }, (_, index) => {
            const a = index + 2;
            const b = index + 3;
            const answer = a + b;
            if (index % 3 === 0) {
                return { type: 'multiple-choice', question: `${a} + ${b} = ?`, answer: String(answer), distractors: [String(answer - 1), String(answer + 2), String(answer + 5)], hint: 'Add the numbers carefully.' };
            }
            if (index % 3 === 1) {
                const first = a + 1;
                const pairs = Array.from({ length: 4 }, (_, offset) => {
                    const value = first + offset;
                    return { left: `${value} + ${value}`, right: String(value * 2) };
                });
                return { type: 'match-pairs', pairs, hint: 'Solve each expression, then match equal values.' };
            }
            return { type: 'slider', question: `Set the answer: ${a} + ${b} = ?`, answer, min: 0, max: answer + 5, step: 1, hint: 'Add the numbers carefully.' };
        });
    }

    const vocabLanguage = LANGUAGE_SAMPLES[fallbackLanguage] ? fallbackLanguage : 'Spanish';
    if (vocabLanguage !== fallbackLanguage) console.warn(`[Musalingo] No fallback vocabulary for "${fallbackLanguage}"; showing Spanish instead.`);
    const selectedSet = LANGUAGE_SAMPLES[vocabLanguage];
    const translations = ENGLISH_TRANSLATIONS[vocabLanguage];
    const practiceQuestionTypes = {
        words: ['multiple-choice', 'match-pairs'],
        listening: ['listen'],
        speaking: ['speak'],
        speed: ['multiple-choice', 'listen']
    };
    const questionTypes = practiceQuestionTypes[options.practiceMode] || [
        'multiple-choice', 'listen', 'spell', 'speak', 'match-pairs'
    ];
    const questions = Array.from({ length: numberOfQuestions }, (_, index) => {
        const sampleIndex = index % selectedSet.length;
        const [phrase, answer, distractors, pronunciation] = selectedSet[sampleIndex];
        const type = questionTypes[index % questionTypes.length];
        const translationMap = Object.fromEntries(
            [phrase, ...distractors].map((word) => [word, localizeMeaning(translations[word] || pronunciation, audienceLanguage, options.localizeMeaning)])
        );
        if (type === 'multiple-choice') return { type, phrase, pronunciation, answer, distractors, translationMap, hint: `Practice ${fallbackTopic} words.` };
        if (type === 'listen') {
            const listenDistractors = Array.from({ length: 3 }, (_, offset) =>
                selectedSet[(sampleIndex + offset + 1) % selectedSet.length][1]
            );
            const pronunciationMap = Object.fromEntries(
                selectedSet.map((entry) => [entry[1], entry[3]])
            );
            const listenTranslationMap = Object.fromEntries(
                [answer, ...listenDistractors].map((choice) => [
                    choice,
                    localizeMeaning(translations[choice] || pronunciationMap[choice], audienceLanguage, options.localizeMeaning)
                ])
            );
            return { type, phrase, answer, distractors: listenDistractors, pronunciationMap, translationMap: listenTranslationMap, hint: `Listen carefully and choose the ${fallbackTopic} word.` };
        }
        if (type === 'spell') return { type, phrase, pronunciation, english: pronunciation, translation: translationMap[phrase], hint: `Listen and spell a ${fallbackTopic} word.` };
        if (type === 'speak') return { type, phrase, pronunciation, english: pronunciation, translation: translationMap[phrase], hint: `Say the ${fallbackTopic} word aloud.` };
        const pairs = Array.from({ length: Math.min(4, selectedSet.length) }, (_, offset) => {
            const entry = selectedSet[(index + offset) % selectedSet.length];
            const meaning = translations[entry[0]] || entry[3];
            return { left: entry[0], right: localizeMeaning(meaning, audienceLanguage, options.localizeMeaning) };
        });
        return { type, pairs, hint: `Match each ${fallbackTopic} word to its meaning.` };
    });

    const hints = audienceData.hints[audienceLanguage];
    return questions.map((question) => {
        if (hints) question.hint = hints[question.type] || hints.default;
        return question;
    });
}

globalThis.MusalingoQuestions = {
    englishTranslations: ENGLISH_TRANSLATIONS,
    generateFallbackQuestions,
    generateMusicQuestions,
    resolveFallbackLanguage,
    supportedLanguages: Object.keys(LANGUAGE_SAMPLES)
};
})();