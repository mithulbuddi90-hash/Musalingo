import express from 'express';
import dotenv from 'dotenv';
import { Chess, validateFen } from 'chess.js';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import nodemailer from 'nodemailer';
import { initializeApp, cert, getApps } from 'firebase-admin/app';

dotenv.config({ path: resolve(dirname(fileURLToPath(import.meta.url)), '.env') });

// ============================================================
//  FIREBASE ADMIN
// ============================================================
let firebaseAdminApp = null;

function parsePrivateKey(raw) {
    if (!raw) return null;
    let key = String(raw).trim();
    if ((key.startsWith('"') && key.endsWith('"')) || (key.startsWith("'") && key.endsWith("'"))) {
        key = key.slice(1, -1);
    }
    key = key.replace(/\\r\\n/g, '\n').replace(/\\n/g, '\n').replace(/\\r/g, '');
    key = key.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
    if (!key.includes('-----BEGIN PRIVATE KEY-----')) return null;
    if (!key.includes('-----END PRIVATE KEY-----')) return null;
    if (!key.endsWith('\n')) key += '\n';
    return key;
}

const firebaseProjectId = process.env.VITE_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID;
const firebaseClientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const firebasePrivateKey = parsePrivateKey(process.env.FIREBASE_PRIVATE_KEY);

if (!firebaseProjectId || !firebaseClientEmail || !firebasePrivateKey) {
    console.log('⚠️ Firebase Admin SDK not configured:');
    if (!firebaseProjectId) console.log('   • FIREBASE_PROJECT_ID / VITE_FIREBASE_PROJECT_ID is missing');
    if (!firebaseClientEmail) console.log('   • FIREBASE_CLIENT_EMAIL is missing');
    if (!firebasePrivateKey) console.log('   • FIREBASE_PRIVATE_KEY is missing, malformed, or not a valid PEM');
    console.log('   (This is fine for local guest play — only server-side admin tasks need it)');
} else if (getApps().length > 0) {
    firebaseAdminApp = getApps()[0];
    console.log('✅ Firebase Admin SDK reused existing app instance.');
} else {
    try {
        firebaseAdminApp = initializeApp({
            credential: cert({
                projectId: firebaseProjectId,
                clientEmail: firebaseClientEmail,
                privateKey: firebasePrivateKey
            })
        });
        console.log('✅ Firebase Admin SDK initialized successfully.');
    } catch (error) {
        console.error('⚠️ Firebase Admin init failed:', error.message);
        if (error.message?.includes('private key')) {
            console.log('   Hint: your FIREBASE_PRIVATE_KEY is malformed.');
            console.log('   • Must include -----BEGIN PRIVATE KEY----- and -----END PRIVATE KEY-----');
            console.log('   • Must be wrapped in double quotes in .env');
            console.log('   • Use \\n (literal backslash-n) for line breaks, not real newlines');
            console.log('   • Regenerate from Firebase Console → Project settings → Service accounts');
        }
        console.log('   (This is okay — the app still works with client-side Firebase + localStorage)');
    }
}

const app = express();
app.use(express.json({ limit: '1mb' }));
app.disable('x-powered-by');

// ============================================================
//  SERVE STATIC FILES
// ============================================================
const __dirname = dirname(fileURLToPath(import.meta.url));

if (process.env.NODE_ENV === 'production' || process.env.TRUST_PROXY) {
    app.set('trust proxy', Number(process.env.TRUST_PROXY) || 1);
}

app.use((req, res, next) => {
    const p = req.path.toLowerCase();
    const blocked =
        p === '/.env' || p.startsWith('/.env.') ||
        p === '/server.js' || p === '/package.json' || p === '/package-lock.json' ||
        p.endsWith('.ps1') || p.endsWith('.log') || p === '/push-musalingo.ps1' ||
        p === '/.git' || p.startsWith('/.git/');
    if (blocked) return res.status(404).send('Not found');
    next();
});

app.use(express.static(resolve(__dirname, 'public')));
app.use('/vendor/chess', express.static(
    resolve(__dirname, 'node_modules/chess.js/dist/esm'),
    { index: false }
));

// ============================================================
//  RATE LIMITING
// ============================================================
const rateBuckets = new Map();

setInterval(() => {
    const now = Date.now();
    for (const bucket of rateBuckets.values()) {
        for (const [k, v] of bucket) if (now > v.reset) bucket.delete(k);
    }
}, 60 * 1000).unref();

function rateLimit({ windowMs, max, name }) {
    if (!rateBuckets.has(name)) rateBuckets.set(name, new Map());
    const hits = rateBuckets.get(name);
    return (req, res, next) => {
        const now = Date.now();
        let key = req.ip || 'unknown';
        if (key.startsWith('::ffff:')) key = key.slice(7);   // ← ADD
        let entry = hits.get(key);
        if (!entry || now > entry.reset) {
            entry = { count: 0, reset: now + windowMs };
            hits.set(key, entry);
        }
        entry.count++;
        if (entry.count > max) {
            res.set('Retry-After', String(Math.ceil((entry.reset - now) / 1000)));
            return res.status(429).json({ error: 'Too many requests. Please slow down.' });
        }
        next();
    };
}

app.use('/api/chat', rateLimit({ windowMs: 60 * 1000, max: 20, name: 'chat' }));
app.use('/api/generate-questions', rateLimit({ windowMs: 60 * 1000, max: 30, name: 'gen' }));
app.use('/api/send-form', rateLimit({ windowMs: 10 * 60 * 1000, max: 5, name: 'form' }));

// ============================================================
//  HEALTH / SELF-PING
// ============================================================
const SERVER_STARTED_AT = Date.now();

app.get('/api/health', (req, res) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.json({
        status: 'ok',
        uptime: Math.floor((Date.now() - SERVER_STARTED_AT) / 1000),
        geminiKeys: GEMINI_KEYS.length,
        models: GEMINI_MODELS,
        emailConfigured: Boolean(process.env.EMAIL_USER && process.env.EMAIL_PASS),
        firebaseConfigured: Boolean(firebaseAdminApp),
        timestamp: new Date().toISOString()
    });
});

// ============================================================
//  FIREBASE CONFIG
// ============================================================
app.get('/api/firebase-config', (req, res) => {
    const cfg = {
        apiKey: process.env.VITE_FIREBASE_API_KEY,
        authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
        projectId: process.env.VITE_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID,
        storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
        messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
        appId: process.env.VITE_FIREBASE_APP_ID,
        measurementId: process.env.VITE_FIREBASE_MEASUREMENT_ID
    };
    Object.keys(cfg).forEach(k => { if (!cfg[k]) delete cfg[k]; });
    if (!cfg.apiKey || !cfg.projectId || !cfg.appId) {
        console.error('[firebase-config] Missing VITE_FIREBASE_API_KEY / PROJECT_ID / APP_ID in .env');
        return res.status(503).json({ error: 'Firebase config not set on server' });
    }
    res.set('Cache-Control', 'public, max-age=300');
    res.json(cfg);
});

// ============================================================
//  HELPERS
// ============================================================
const SQUARES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].flatMap(f =>
    [1, 2, 3, 4, 5, 6, 7, 8].map(r => `${f}${r}`)
);
const escapeHtml = (v) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const pieceName = (p) => ({ p: 'Pawn', n: 'Knight', b: 'Bishop', r: 'Rook', q: 'Queen', k: 'King' }[p] || 'piece');

function isValidPuzzlePosition(game) {
    const fen = game.fen();
    if (!validateFen(fen).ok) return false;
    if (game.isCheck()) return false;
    const flipped = fen.replace(/\s(w|b)\s/, (_, side) => ` ${side === 'w' ? 'b' : 'w'} `);
    try {
        return !new Chess(flipped).isCheck();
    } catch {
        return false;
    }
}

// ============================================================
//  KING-HIDING LOGIC  ← NEW
// ============================================================
function shouldHideKings(topic, movingPiece) {
    const t = String(topic || '').toLowerCase();
    if (/check|mate|king/i.test(t)) return false;
    if (movingPiece === 'k') return false;
    return true;
}

// ============================================================
//  CHESS — SINGLE-MOVE GENERATORS (updated for hideKings)
// ============================================================
function genFindMove(topic = '') {
    const whiteKing = 'a1';
    const blackKing = 'h8';
    const pieceSquares = SQUARES.filter(square => square !== whiteKing && square !== blackKing);

    for (let attempt = 0; attempt < 500; attempt++) {
        const game = new Chess();
        const piece = pick(['n', 'b', 'r', 'q', 'k', 'p']);
        const square = piece === 'k' ? whiteKing : pick(pieceSquares);
        game.clear();
        game.put({ type: 'k', color: 'w' }, whiteKing);
        game.put({ type: 'k', color: 'b' }, blackKing);
        if (piece !== 'k' && !game.put({ type: piece, color: 'w' }, square)) continue;
        if (!isValidPuzzlePosition(game)) continue;

        const moves = game.moves({ square, verbose: true });
        if (moves.length < 2) continue;

        const answer = pick(moves).to;
        return {
            type: 'find-move',
            fen: game.fen(),
            from: square,
            answer,
            legalMoves: moves.map(move => move.to),
            hideKings: shouldHideKings(topic, piece),   // ← NEW
            prompt: `The ${pieceName(piece)} is highlighted. Tap a square where it can move.`,
            hint: `The ${pieceName(piece)} on ${square} has ${moves.length} legal moves.`
        };
    }
    return null;
}

function genCapture(topic = '') {
    const whiteKing = 'a1';
    const blackKing = 'h8';
    const whiteSquares = SQUARES.filter(square => square !== whiteKing && square !== blackKing);
    const blackPawnSquares = whiteSquares.filter(square => !['1', '8'].includes(square[1]));

    for (let attempt = 0; attempt < 500; attempt++) {
        const game = new Chess();
        const whiteSq = pick(whiteSquares);
        const blackSq = pick(blackPawnSquares.filter(square => square !== whiteSq));
        if (!blackSq) continue;

        game.clear();
        game.put({ type: 'k', color: 'w' }, whiteKing);
        game.put({ type: 'k', color: 'b' }, blackKing);
        if (!game.put({ type: pick(['r', 'b', 'n', 'q']), color: 'w' }, whiteSq)) continue;
        if (!game.put({ type: 'p', color: 'b' }, blackSq) || !isValidPuzzlePosition(game)) continue;

        const legalMoves = game.moves({ square: whiteSq, verbose: true });
        const captures = legalMoves.filter(move => move.captured);
        if (!captures.length) continue;

        const movingType = game.get(whiteSq).type;
        return {
            type: 'capture',
            fen: game.fen(),
            from: whiteSq,
            answer: captures[0].to,
            legalMoves: legalMoves.map(move => move.to),
            captureSquares: captures.map(move => move.to),
            hideKings: shouldHideKings(topic, movingType),   // ← NEW
            prompt: `The ${pieceName(movingType)} is highlighted. Tap the piece it can capture.`,
            hint: `Look along the lines the ${pieceName(movingType)} attacks.`
        };
    }
    return null;
}

function genMateInOne() {
    for (let i = 0; i < 3000; i++) {
        const game = new Chess();
        game.clear();
        const occupied = [];
        const place = (piece, color) => {
            const square = pick(SQUARES.filter(candidate => !occupied.includes(candidate)));
            if (!square || !game.put({ type: piece, color }, square)) return null;
            occupied.push(square);
            return square;
        };
        if (!place('k', 'w') || !place('k', 'b') || !place(pick(['q', 'r']), 'w') || !place(pick(['p', 'n']), 'b')) continue;
        if (!isValidPuzzlePosition(game)) continue;
        const moves = game.moves({ verbose: true });
        const mate = moves.find(m => {
            const g = new Chess(game.fen());
            g.move(m);
            return g.isCheckmate();
        });
        if (mate) {
            return {
                type: 'mate-in-one',
                fen: game.fen(),
                from: mate.from,
                answer: mate.to,
                hideKings: false,   // Mate-in-one always shows kings
                prompt: 'Find the move that delivers checkmate.',
                hint: 'The mating move puts the black king in check with no escape.'
            };
        }
    }
    return null;
}

// ============================================================
//  CHESS — MULTI-MOVE GENERATORS
// ============================================================
function genMoveSequence(steps = 2) {
    for (let attempt = 0; attempt < 800; attempt++) {
        const game = new Chess();
        game.clear();
        const occupied = [];
        const place = (piece, color, prefer = null) => {
            const candidates = prefer
                ? prefer.filter(sq => !occupied.includes(sq))
                : SQUARES.filter(sq => !occupied.includes(sq));
            const square = pick(candidates);
            if (!square || !game.put({ type: piece, color }, square)) return null;
            occupied.push(square);
            return square;
        };

        if (!place('k', 'w') || !place('k', 'b')) continue;
        if (!place('q', 'w')) continue;
        if (Math.random() > 0.5 && !place('p', 'b')) continue;
        if (!isValidPuzzlePosition(game)) continue;

        const moves = [];
        const startFen = game.fen();
        let ok = true;

        for (let s = 0; s < steps; s++) {
            const whiteMoves = game.moves({ verbose: true });
            if (!whiteMoves.length) { ok = false; break; }

            const scored = whiteMoves.map(m => {
                let score = Math.random();
                if (m.captured) score += 2;
                const g = new Chess(game.fen());
                try { g.move(m); if (g.isCheck()) score += 1.5; } catch { }
                return { move: m, score };
            }).sort((a, b) => b.score - a.score);

            const whiteMove = scored[0].move;
            moves.push({ from: whiteMove.from, to: whiteMove.to, promo: whiteMove.promotion || 'q', color: 'white' });
            game.move(whiteMove);

            if (s === steps - 1) break;

            const blackMoves = game.moves({ verbose: true });
            if (!blackMoves.length) { ok = false; break; }

            const blackMove = blackMoves[Math.floor(Math.random() * blackMoves.length)];
            moves.push({ from: blackMove.from, to: blackMove.to, promo: blackMove.promotion || 'q', color: 'black' });
            game.move(blackMove);
        }

        if (!ok || moves.length < 2) continue;

        const firstWhite = moves[0];
        const legalFirst = new Chess(startFen).moves({ verbose: true })
            .filter(m => m.from === firstWhite.from)
            .map(m => m.to);

        return {
            type: 'move-sequence',
            fen: startFen,
            moves,
            from: firstWhite.from,
            legalFirstMoves: legalFirst,
            hideKings: false,   // Multi-move always shows kings
            prompt: `Play ${steps} move${steps > 1 ? 's' : ''}. Choose any legal continuation.`,
            hint: `You have ${steps} move${steps > 1 ? 's' : ''}. Capture or check when you can.`
        };
    }
    return null;
}

function genMateInN(n = 2) {
    for (let attempt = 0; attempt < 2000; attempt++) {
        const game = new Chess();
        game.clear();
        const occupied = [];
        const place = (piece, color) => {
            const square = pick(SQUARES.filter(sq => !occupied.includes(sq)));
            if (!square || !game.put({ type: piece, color }, square)) return null;
            occupied.push(square);
            return square;
        };

        if (!place('k', 'w') || !place('k', 'b') || !place('q', 'w')) continue;
        if (Math.random() > 0.5 && !place('r', 'w')) continue;
        if (!isValidPuzzlePosition(game)) continue;

        const firstWhiteMoves = game.moves({ verbose: true });
        if (!firstWhiteMoves.length) continue;

        for (const firstMove of firstWhiteMoves) {
            const afterWhite = new Chess(game.fen());
            afterWhite.move(firstMove);

            if (afterWhite.isCheckmate()) continue;

            const blackReplies = afterWhite.moves({ verbose: true });
            if (!blackReplies.length) continue;

            let allMate = true;
            for (const blackReply of blackReplies) {
                const afterBlack = new Chess(afterWhite.fen());
                afterBlack.move(blackReply);

                const whiteNextMoves = afterBlack.moves({ verbose: true });
                const mateFound = whiteNextMoves.find(m => {
                    const g = new Chess(afterBlack.fen());
                    g.move(m);
                    return g.isCheckmate();
                });

                if (!mateFound) { allMate = false; break; }
            }

            if (allMate) {
                return {
                    type: `mate-in-${n}`,
                    fen: game.fen(),
                    moves: [{ from: firstMove.from, to: firstMove.to, promo: firstMove.promotion || 'q', color: 'white' }],
                    from: firstMove.from,
                    answer: firstMove.to,
                    legalMoves: firstWhiteMoves.map(m => m.to),
                    hideKings: false,   // Mate-in-N always shows kings
                    prompt: `Find the first move of a forced mate in ${n}.`,
                    hint: `There's a move that forces mate no matter what black plays.`
                };
            }
        }
    }
    return null;
}

// ============================================================
//  CHESS — DISPATCHERS (pass topic to generators)
// ============================================================
function chessQuestionType(topic) {
    const t = String(topic || '').toLowerCase();
    if (/mate in 2|mate in two|mate-in-2/.test(t)) return 'mate-in-2';
    if (/mate in 3|mate in three|mate-in-3/.test(t)) return 'mate-in-3';
    if (/checkmate|mate in one|mating/.test(t)) return 'mate-in-one';
    if (/sequence|combination|chain|multi.?move/.test(t)) return 'move-sequence';
    if (/fork|pin|skewer|discovered|tactic|attack|captur/.test(t)) return 'capture';
    return 'find-move';
}

function generateChessQuestions(count, level = 1, topic = '') {
    const type = chessQuestionType(topic);
    const out = [];
    let attempts = 0;
    const maxAttempts = count * 40;

    const tryGenerate = () => {
        switch (type) {
            case 'mate-in-2': return genMateInN(2);
            case 'mate-in-3': return genMateInN(3);
            case 'mate-in-one': return genMateInOne();
            case 'move-sequence': return genMoveSequence(2);
            case 'capture': return genCapture(topic);   // ← pass topic
            case 'find-move':
            default:
                return level >= 3 ? (pick([() => genFindMove(topic), () => genCapture(topic), genMateInOne])())   // ← pass topic
                    : level === 2 ? (pick([() => genFindMove(topic), () => genCapture(topic)])())   // ← pass topic
                        : genFindMove(topic);   // ← pass topic
        }
    };

    while (out.length < count && attempts < maxAttempts) {
        attempts++;
        const q = tryGenerate();
        if (q) out.push(q);
    }

    while (out.length < count && attempts < maxAttempts * 2) {
        attempts++;
        const q = pick([() => genFindMove(topic), () => genCapture(topic), genMateInOne])();   // ← pass topic
        if (q) out.push(q);
    }

    return out;
}

// ============================================================
//  CHESS — PROMPT + VALIDATOR
// ============================================================
function chessQuestionPrompt(topic, count, level) {
    const type = chessQuestionType(topic);
    const isMulti = type === 'mate-in-2' || type === 'mate-in-3' || type === 'move-sequence';

    const schema = isMulti
        ? `{"type":"${type}","fen":"valid FEN","moves":[{"from":"e2","to":"e4","color":"white"},{"from":"e7","to":"e5","color":"black"},{"from":"g1","to":"f3","color":"white"}],"prompt":"...","hint":"..."}`
        : `{"type":"${type}","fen":"valid FEN","from":"e2","answer":"e4","prompt":"...","hint":"..."}`;

    const task = type === 'mate-in-2'
        ? 'Create a position where white can force checkmate in exactly 2 moves.'
        : type === 'mate-in-3'
            ? 'Create a position where white can force checkmate in exactly 3 moves.'
            : type === 'move-sequence'
                ? 'Create a position with a 2-4 move sequence of legal white moves with legal black replies.'
                : type === 'mate-in-one'
                    ? 'Create a position where the selected piece has a legal move that checkmates.'
                    : type === 'capture'
                        ? 'Create a position where the selected piece has at least one legal capture of an opposing piece.'
                        : 'Create a position that teaches the legal movement of one selected chess piece.';

    return `Create exactly ${count} original chess lesson questions for the topic "${topic}" at difficulty level ${level} of 3.
${task}
Return only a JSON array. Each item must have this shape:
${schema}
Rules:
- Use a valid, playable FEN with both kings.
- ${isMulti ? 'The moves array must be a legal sequence. Colors alternate starting with white. Last move of a mate-in-N must deliver checkmate.' : 'The move must be legal for the given side to move.'}
- Keep positions simple, unambiguous, and appropriate for a chess learner.
- Do not include markdown, extra keys, or explanations outside the JSON array.`;
}

function normalizeChessQuestion(question, topic) {
    if (!question || typeof question !== 'object' || Array.isArray(question)) return null;
    const requiredType = chessQuestionType(topic);
    if (question.type !== requiredType) return null;
    if (typeof question.fen !== 'string' || !validateFen(question.fen).ok) return null;

    let game;
    try { game = new Chess(question.fen); } catch { return null; }

    if (Array.isArray(question.moves) && question.moves.length > 0) {
        const testGame = new Chess(game.fen());
        let lastMoveWasCheckmate = false;

        for (const step of question.moves) {
            if (!step || typeof step.from !== 'string' || typeof step.to !== 'string') return null;
            const from = String(step.from).toLowerCase();
            const to = String(step.to).toLowerCase();
            if (!/^[a-h][1-8]$/.test(from) || !/^[a-h][1-8]$/.test(to)) return null;

            const legal = testGame.moves({ verbose: true });
            const match = legal.find(m => m.from === from && m.to === to);
            if (!match) return null;

            try {
                testGame.move(match);
            } catch { return null; }

            if (testGame.isCheckmate()) {
                lastMoveWasCheckmate = true;
                break;
            }
        }

        if (requiredType.startsWith('mate-in') && !lastMoveWasCheckmate) return null;

        const firstWhite = question.moves.find(m => m.color !== 'black');
        if (!firstWhite) return null;
        const firstLegal = new Chess(game.fen()).moves({ verbose: true })
            .filter(m => m.from === firstWhite.from)
            .map(m => m.to);

        return {
            type: requiredType,
            fen: game.fen(),
            moves: question.moves.map(m => ({
                from: String(m.from).toLowerCase(),
                to: String(m.to).toLowerCase(),
                promo: (m.promo || 'q').toLowerCase(),
                color: m.color === 'black' ? 'black' : 'white'
            })),
            from: firstWhite.from,
            answer: firstWhite.to,
            legalMoves: firstLegal,
            hideKings: false,   // Multi-move always shows kings
            prompt: typeof question.prompt === 'string' && question.prompt.trim()
                ? question.prompt.trim().slice(0, 240)
                : `Play the sequence.`,
            hint: typeof question.hint === 'string' && question.hint.trim()
                ? question.hint.trim().slice(0, 240)
                : `This is a ${requiredType.replace('-', ' ')} puzzle.`
        };
    }

    const from = String(question.from || '').toLowerCase();
    const answer = String(question.answer || '').toLowerCase();
    if (!/^[a-h][1-8]$/.test(from) || !/^[a-h][1-8]$/.test(answer)) return null;
    const movingPiece = game.get(from);
    if (!movingPiece || movingPiece.color !== game.turn()) return null;

    const legalMoves = game.moves({ square: from, verbose: true });
    const answerMove = legalMoves.find(move => move.to === answer);
    if (!answerMove || (requiredType === 'capture' && !answerMove.captured)) return null;
    if (requiredType === 'mate-in-one') {
        const afterMove = new Chess(game.fen());
        afterMove.move({ from, to: answer });
        if (!afterMove.isCheckmate()) return null;
    }

    const piece = pieceName(movingPiece.type);
    const prompt = requiredType === 'mate-in-one'
        ? `Find the ${piece.toLowerCase()} move that delivers checkmate.`
        : requiredType === 'capture'
            ? `The ${piece.toLowerCase()} is highlighted. Choose a legal square where it can capture an opposing piece.`
            : `The ${piece.toLowerCase()} is highlighted. Choose any square where it can legally move.`;
    const hint = typeof question.hint === 'string' && question.hint.trim()
        ? question.hint.trim().slice(0, 240)
        : `The ${piece.toLowerCase()} on ${from} has ${legalMoves.length} legal moves.`;

    // ← NEW: hideKings for single-move questions
    const hideKings = shouldHideKings(topic, movingPiece.type);

    return {
        type: requiredType,
        fen: game.fen(),
        from,
        answer,
        legalMoves: legalMoves.map(move => move.to),
        ...(requiredType === 'capture'
            ? { captureSquares: legalMoves.filter(move => move.captured).map(move => move.to) }
            : {}),
        hideKings,   // ← NEW
        prompt,
        hint
    };
}

// ============================================================
//  MUSIC GENERATORS
// ============================================================
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const SEMITONE_INTERVAL_NAMES = [
    'Minor 2nd', 'Major 2nd', 'Minor 3rd', 'Major 3rd', 'Perfect 4th', 'Tritone',
    'Perfect 5th', 'Minor 6th', 'Major 6th', 'Minor 7th', 'Major 7th', 'Octave'
];

function genNoteNameQuestion() {
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
    const distractors = [...new Set(Object.values(clefNotes).flat().filter((note) => note !== answer))]
        .sort(() => Math.random() - 0.5)
        .slice(0, 3);
    return {
        type: 'multiple-choice',
        question: `In the ${clef} clef, which pitch is on the ${positionName} from the bottom?`,
        answer,
        distractors,
        hint: clef === 'treble' ? 'The bottom line of the treble staff is E4.' : 'The bottom line of the bass staff is G2.'
    };
}

function genIntervalQuestion() {
    const rootIdx = Math.floor(Math.random() * 12);
    const semitones = 1 + Math.floor(Math.random() * 12);
    const topPosition = rootIdx + semitones;
    const topIdx = topPosition % 12;
    const root = `${NOTE_NAMES[rootIdx]}4`;
    const top = `${NOTE_NAMES[topIdx]}${4 + Math.floor(topPosition / 12)}`;
    const answer = SEMITONE_INTERVAL_NAMES[semitones - 1];
    const distractors = SEMITONE_INTERVAL_NAMES.filter(n => n !== answer).sort(() => Math.random() - 0.5).slice(0, 3);
    return {
        type: 'multiple-choice',
        question: `What interval is ${root} to ${top}?`,
        answer: answer,
        distractors,
        hint: `Count the semitones between ${root} and ${top}.`
    };
}

function genChordQuestion() {
    const root = pick(NOTE_NAMES);
    const type = pick(['Major', 'Minor', 'Diminished', 'Augmented']);
    let chordNotes = [];
    const rootIdx = NOTE_NAMES.indexOf(root);
    if (type === 'Major') chordNotes = [root, NOTE_NAMES[(rootIdx + 4) % 12], NOTE_NAMES[(rootIdx + 7) % 12]];
    else if (type === 'Minor') chordNotes = [root, NOTE_NAMES[(rootIdx + 3) % 12], NOTE_NAMES[(rootIdx + 7) % 12]];
    else if (type === 'Diminished') chordNotes = [root, NOTE_NAMES[(rootIdx + 3) % 12], NOTE_NAMES[(rootIdx + 6) % 12]];
    else if (type === 'Augmented') chordNotes = [root, NOTE_NAMES[(rootIdx + 4) % 12], NOTE_NAMES[(rootIdx + 8) % 12]];
    const distractors = ['Major', 'Minor', 'Diminished', 'Augmented'].filter(t => t !== type);
    return {
        type: 'multiple-choice',
        question: `The notes ${chordNotes.join('–')} form what kind of chord?`,
        answer: `${root} ${type}`,
        distractors: distractors.map(t => `${root} ${t}`),
        hint: `Look at the distance between the root and the third.`
    };
}

function genKeySignatureQuestion() {
    const keys = {
        'C': '0 sharps/flats', 'G': '1 sharp', 'D': '2 sharps', 'A': '3 sharps', 'E': '4 sharps', 'B': '5 sharps', 'F#': '6 sharps', 'C#': '7 sharps',
        'F': '1 flat', 'Bb': '2 flats', 'Eb': '3 flats', 'Ab': '4 flats', 'Db': '5 flats', 'Gb': '6 flats', 'Cb': '7 flats'
    };
    const key = pick(Object.keys(keys));
    const answer = keys[key];
    const distractors = Object.values(keys).filter(d => d !== answer).sort(() => Math.random() - 0.5).slice(0, 3);
    return {
        type: 'multiple-choice',
        question: `How many sharps or flats are in the key of ${key} major?`,
        answer,
        distractors,
        hint: `Sharps follow F–C–G–D–A–E–B; flats go backwards.`
    };
}

function generateMusicQuestions(count, level = 1) {
    const gens = level === 1 ? [genNoteNameQuestion, genIntervalQuestion]
        : level === 2 ? [genNoteNameQuestion, genIntervalQuestion, genChordQuestion]
            : [genNoteNameQuestion, genIntervalQuestion, genChordQuestion, genKeySignatureQuestion];
    const out = [];
    let attempts = 0;
    while (out.length < count && attempts < count * 30) {
        attempts++;
        const q = pick(gens)();
        if (q) out.push(q);
    }
    return out;
}

// ============================================================
//  AI PROMPTS
// ============================================================
function languagePrompt(language, topic, count, noNonsense = false, reason = 'curiosity', goal = 'confidence') {
    const rawLanguage = String(language || '');
    const isNativeScript = /[\u0400-\u04FF\u0590-\u05FF\u0600-\u06FF\u0700-\u074F\u0780-\u07BF\u0900-\u097F\u0980-\u09FF\u0A00-\u0A7F\u0A80-\u0AFF\u0B00-\u0B7F\u0B80-\u0BFF\u0C00-\u0C7F\u0C80-\u0CFF\u0D00-\u0D7F\u0D80-\u0DFF\u0E00-\u0E7F\u0F00-\u0FFF\u3040-\u30FF\u3400-\u4DBF\u4E00-\u9FFF\uAC00-\uD7AF\u1100-\u11FF\u1E00-\u1EFF\u2C00-\u2C5F]/.test(rawLanguage)
        || /japanese|nihongo|日本語|hindi|हिंदी|हिन्दी|arabic|العربية|korean|한국어|chinese|中文|thai|ไทย|russian|русский|hebrew|עברית|persian|فارسی|urdu|اردو|tamil|தமிழ்|telugu|తెలుగు|malayalam|മലയാളം|kannada|ಕನ್ನಡ|bengali|বাংলা|gujarati|ગુજરાતી|punjabi|ਪੰਜਾਬੀ|marathi|मराठी|greek|ελληνικά|vietnamese|tiếng việt|lao|ລາວ|myanmar|မြန်မာ|javanese|bali|burmese|amharic|አማርኛ|tigrinya|ትግርኛ|swahili|kiswahili|nepali|नेपाली|assamese|অসমীয়া|oriya|ଓଡ଼ିଆ|sinhala|සිංහල|pashto|پښتو|sindhi|سنڌی/i.test(rawLanguage);

    const scriptRule = isNativeScript
        ? 'Use native script for the main word/phrase, answer, and distractors. Only use English values in the pronunciation field, never as the main answer choice.'
        : 'Use the target language for the main word/phrase and keep English pronunciation separate.';

    let topicFocus = topic;
    if (reason === 'travel') topicFocus = `travel, ordering food, directions, hotels, and ${topic}`;
    else if (reason === 'work') topicFocus = `business, emails, meetings, office small talk, and ${topic}`;
    else if (reason === 'school') topicFocus = `classroom, studying, exams, and ${topic}`;

    let typeFocus = '';
    if (goal === 'speed') typeFocus = 'Favor "listen" and "arrange" questions to build speed and recall.';
    else if (goal === 'vocabulary') typeFocus = 'Favor "multiple-choice" and "match-pairs" questions to build vocabulary.';
    else if (goal === 'confidence') typeFocus = 'Favor "speak" and "spell" questions to build confidence.';

    return `Generate exactly ${count} beginner ${language} exercises about "${topicFocus}".
Return ONLY a JSON array, no markdown. MIX these types (roughly 2 each):

1. {"type":"multiple-choice","phrase":"<word in ${language}>","pronunciation":"<English pronunciation>","answer":"<${language} word>","distractors":["<${language} word>","<${language} word>","<${language} word>"],"translationMap":{"<answer>":"<English meaning>","<distractor 1>":"<English meaning>","<distractor 2>":"<English meaning>","<distractor 3>":"<English meaning>"},"hint":"<short hint in ${language}>"}
2. {"type":"arrange","sentence":"<${language} sentence>","pronunciation":"<English pronunciation>","answer":"<correct ${language} sentence>","words":["<w1>","<w2>","<w3>"],"hint":"<short hint in ${language}>"}
3. {"type":"listen","phrase":"<word in ${language}>","pronunciation":"<English pronunciation>","answer":"<${language} word>","distractors":["<${language} word>","<${language} word>","<${language} word>"],"translationMap":{"<answer>":"<English meaning>","<distractor 1>":"<English meaning>","<distractor 2>":"<English meaning>","<distractor 3>":"<English meaning>"},"hint":"<short hint in ${language}>"}
4. {"type":"speak","phrase":"<${language} phrase 1-3 words>","pronunciation":"<English pronunciation>","english":"<${language} phrase>","hint":"<short hint in ${language}>"}
5. {"type":"spell","phrase":"<${language} single word>","pronunciation":"<English pronunciation>","english":"<${language} word>","hint":"<short hint in ${language}>"}
6. {"type":"match-pairs","pairs":[{"left":"<${language} word>","right":"<${language} word>","pronunciation":"<English pronunciation>"},{"left":"<w>","right":"<w>","pronunciation":"<English pronunciation>"},{"left":"<w>","right":"<w>","pronunciation":"<English pronunciation>"},{"left":"<w>","right":"<w>","pronunciation":"<English pronunciation>"}],"hint":"<short hint in ${language}>"}
7. {"type":"fill-blank","sentence":"<${language} sentence with exactly one ___ where a word is missing>","answer":"<the missing word>","distractors":["<wrong>","<wrong>","<wrong>"],"translation":"<English translation of the full sentence>","hint":"<short hint in ${language}>"}
8. {"type":"translate-type","english":"<short English sentence, 3-8 words>","answer":"<correct target-language sentence>","pronunciation":"<English pronunciation of the answer>","hint":"<short hint in target language>"}

Rules:
- ${scriptRule}
- ${typeFocus}
- ${noNonsense ? 'Use natural, realistic everyday situations and sensible sentences. Avoid absurd or nonsensical examples.' : ''}
- all options unique
- For multiple-choice and listen, translationMap must give a natural English meaning for the answer and every distractor. Keep answer and distractors in ${language}; do not put English words in those fields.
- For fill-blank: distractors must be grammatically incorrect in the sentence context — wrong person, tense, or conjugation — not synonyms.
- For translate-type: the English sentence must be natural and simple. The answer must be the correct, complete target-language translation. Pronunciation is the English phonetic reading of the answer.
- keep phrases short
- main word/phrase must stay in native script, pronunciation shown in English
- hint max 15 words, never gives the answer directly`;
}

function normalizeLanguageName(language) {
    const raw = String(language || '').trim();
    if (!raw) return 'Spanish';
    const map = {
        'intermediate english': 'English',
        japanese: 'Japanese', nihongo: 'Japanese', '日本語': 'Japanese',
        hindi: 'Hindi', 'हिंदी': 'Hindi', 'हिन्दी': 'Hindi',
        spanish: 'Spanish', español: 'Spanish', espanol: 'Spanish',
        french: 'French', français: 'French', francais: 'French',
        german: 'German', deutsch: 'German',
        italian: 'Italian', italiano: 'Italian',
        arabic: 'Arabic', العربية: 'Arabic',
        chinese: 'Chinese', 中文: 'Chinese', korean: 'Korean', 한국어: 'Korean',
        thai: 'Thai', ไทย: 'Thai', russian: 'Russian', русский: 'Russian',
        hebrew: 'Hebrew', עברית: 'Hebrew', persian: 'Persian', فارسی: 'Persian',
        urdu: 'Urdu', اردو: 'Urdu', tamil: 'Tamil', தமிழ்: 'Tamil', telugu: 'Telugu', తెలుగు: 'Telugu',
        malayalam: 'Malayalam', മലയാളം: 'Malayalam', kannada: 'Kannada', ಕನ್ನಡ: 'Kannada',
        bengali: 'Bengali', বাংলা: 'Bengali', gujarati: 'Gujarati', ગુજરાતી: 'Gujarati',
        punjabi: 'Punjabi', ਪੰਜਾਬੀ: 'Punjabi', marathi: 'Marathi', मराठी: 'Marathi',
        nepali: 'Nepali', नेपाली: 'Nepali', vietnamese: 'Vietnamese', 'tiếng việt': 'Vietnamese',
        lao: 'Lao', ລາວ: 'Lao', myanmar: 'Myanmar', မြန်မာ: 'Myanmar',
        swahili: 'Swahili', kiswahili: 'Swahili', amharic: 'Amharic', አማርኛ: 'Amharic',
        tigrinya: 'Tigrinya', 'ትግርኛ': 'Tigrinya', greek: 'Greek', ελληνικά: 'Greek',
        math: 'Math', chess: 'Chess', music: 'Music'
    };
    const lower = raw.toLowerCase();
    return map[lower] || map[raw] || raw;
}

function mathPrompt(topic, count, grade = 'grade-1') {
    const gradeLabel = /^grade-/.test(String(grade))
        ? String(grade).replace('grade-', 'Grade ')
        : (grade === 'fun-math' ? 'Fun Math' : grade === 'adult-math' ? 'Adult Math' : 'Grade 1');
    return `Generate exactly ${count} beginner Math exercises for a ${gradeLabel} student about "${topic}".
Return ONLY a JSON array, no markdown. MIX these types (roughly 2 each):

1. {"type":"multiple-choice","question":"<text>","answer":"<correct>","distractors":["<w>","<w>","<w>"],"hint":"<short hint>"}
2. {"type":"match-pairs","pairs":[{"left":"2+3","right":"5"},{"left":"4+4","right":"8"},{"left":"6-1","right":"5"},{"left":"3×2","right":"6"}],"hint":"<short hint>"}
3. {"type":"slider","question":"Solve: 2x + 3 = 11","answer":4,"min":0,"max":10,"step":1,"unit":"x","hint":"<short hint>"}
4. {"type":"graph","question":"What is the slope of y = 2x + 1?","answer":2,"min":-5,"max":5,"step":0.5,"unit":"slope","hint":"<short hint>"}

Rules:
- answers must be numbers for slider/graph, strings otherwise
- all pairs unique
- hint max 15 words`;
}

function musicPrompt(topic, count) {
    return `Generate exactly ${count} beginner Music exercises about "${topic}".
Return ONLY a JSON array, no markdown. MIX these types:

1. {"type":"multiple-choice","question":"In the key of G major, what is the V chord?","answer":"D major","distractors":["C major","A minor","E minor"],"hint":"The fifth scale degree in G is D."}
2. {"type":"multiple-choice","question":"Which composer wrote the Brandenburg Concertos?","answer":"J.S. Bach","distractors":["Mozart","Beethoven","Vivaldi"],"hint":"He was active in the Baroque period."}
3. {"type":"match-pairs","pairs":[{"left":"mf","right":"mezzo-forte"},{"left":"pp","right":"pianissimo"},{"left":"ff","right":"fortissimo"},{"left":"mp","right":"mezzo-piano"}],"hint":"These are dynamics."}

Rules:
- all options unique
- hint max 15 words`;
}

const englishTranslations = {
    Japanese: { 'こんにちは': 'hello', 'ありがとう': 'thank you', '学校': 'school', '猫': 'cat', '水': 'water', '友達': 'friend', '本': 'book', '食べ物': 'food', '家': 'home', '朝': 'morning', '車': 'car', '音楽': 'music', '夜': 'night', '雨': 'rain', '元気': 'well' },
    Spanish: { hola: 'hello', adios: 'goodbye', libro: 'book', feliz: 'happy', gracias: 'thank you', 'por favor': 'please', amigo: 'friend', agua: 'water', mesa: 'table', casa: 'house', escuela: 'school', manzana: 'apple', correr: 'run', puerta: 'door', sol: 'sun' },
    French: { bonjour: 'hello', merci: 'thank you', livre: 'book', maison: 'house', ami: 'friend', eau: 'water', porte: 'door', soleil: 'sun', ecole: 'school', pomme: 'apple', voiture: 'car' },
    German: { hallo: 'hello', danke: 'thank you', buch: 'book', freund: 'friend', wasser: 'water', schule: 'school', haus: 'house', tafel: 'table', musik: 'music', apfel: 'apple', laufen: 'run', sonne: 'sun', tur: 'door' },
    Italian: { ciao: 'hello', grazie: 'thank you', libro: 'book', amico: 'friend', acqua: 'water', scuola: 'school', casa: 'house', mela: 'apple', musica: 'music', porta: 'door', sole: 'sun', corre: 'run' },
    Arabic: { 'مرحبا': 'hello', 'شكرا': 'thank you', 'كتاب': 'book', 'بيت': 'house', 'ماء': 'water', 'صديق': 'friend', 'مدرسة': 'school', 'نافذة': 'window', 'قمر': 'moon', 'تفاحة': 'apple', 'أحب': 'love', 'سماء': 'sky', 'باب': 'door', 'شمس': 'sun' },
    Hindi: { 'नमस्ते': 'hello', 'धन्यवाद': 'thank you', 'किताब': 'book', 'मित्र': 'friend', 'पानी': 'water', 'विद्यालय': 'school', 'घर': 'house', 'दरवाज़ा': 'door', 'सूरज': 'sun', 'सेब': 'apple', 'दोस्ती': 'friendship', 'आकाश': 'sky', 'चाँद': 'moon' },
    Korean: { '안녕하세요': 'hello', '고맙습니다': 'thank you', '책': 'book', '친구': 'friend', '물': 'water', '학교': 'school', '집': 'house', '문': 'door', '해': 'sun' },
    Telugu: { 'నమస్కారం': 'hello', 'హలో': 'hello', 'ధన్యవాదాలు': 'thank you', 'పుస్తకం': 'book', 'స్నేహితుడు': 'friend', 'నీళ్ళు': 'water', 'పాఠశాల': 'school', 'ఇల్లు': 'house', 'తలుపు': 'door', 'సూర్యుడు': 'sun', 'యాపిల్': 'apple', 'పరుగు': 'run', 'ఆకాశం': 'sky', 'చంద్రుడు': 'moon' },
    English: { 'Hello': 'hello', 'Goodbye': 'goodbye', 'Book': 'book', 'Happy': 'happy', 'Thank you': 'thank you', 'Friend': 'friend', 'Water': 'water', 'House': 'house', 'Please': 'please', 'School': 'school' }
};

function generateFallbackQuestions(language, topic, count) {
    if (language === 'Chess') {
        const chessQuestions = generateChessQuestions(count, 1, topic);
        return chessQuestions.length ? chessQuestions : [{
            type: 'find-move',
            fen: '7k/8/8/8/4K3/8/8/8 w - - 0 1',
            from: 'e4',
            answer: 'e5',
            legalMoves: new Chess('7k/8/8/8/4K3/8/8/8 w - - 0 1').moves({ square: 'e4', verbose: true }).map(move => move.to),
            hideKings: false,
            prompt: 'The king is highlighted. Tap a square where it can move.',
            hint: 'The king moves one square in any direction.'
        }];
    }
    if (language === 'Music') {
        return generateMusicQuestions(count, 1);
    }
    if (language === 'Math') {
        const result = [];
        for (let i = 0; i < count; i++) {
            const base = i + 2;
            const other = i + 5;
            const answer = base + other;
            if (i % 3 === 0) result.push({ type: 'multiple-choice', question: `${base} + ${other} = ?`, answer: String(answer), distractors: [String(answer - 1), String(answer + 2), String(answer + 5)], hint: 'Add the numbers carefully.' });
            else if (i % 3 === 1) {
                const first = base + 1;
                const pairs = Array.from({ length: 4 }, (_, offset) => { const value = first + offset; return { left: `${value} + ${value}`, right: String(value * 2) }; });
                result.push({ type: 'match-pairs', pairs, hint: 'Solve each expression, then match equal values.' });
            } else result.push({ type: 'slider', question: `Set the answer: ${base} + ${other} = ?`, answer, min: 0, max: answer + 5, step: 1, hint: 'Add the numbers carefully.' });
        }
        return result;
    }

    const result = [];
    const languageSets = {
        Japanese: [['こんにちは', 'こんにちは', ['ありがとう', '学校', '猫'], 'konnichiwa'], ['ありがとう', 'ありがとう', ['水', '友達', '本'], 'arigatou'], ['学校', '学校', ['食べ物', '家', '朝'], 'gakkou'], ['友達', '友達', ['車', '音楽', '夜'], 'tomodachi'], ['本', '本', ['水', '雨', '元気'], 'hon']],
        Spanish: [['hola', 'hola', ['adios', 'libro', 'feliz'], 'hello'], ['gracias', 'gracias', ['por favor', 'amigo', 'agua'], 'thank you'], ['amigo', 'amigo', ['mesa', 'agua', 'casa'], 'friend'], ['escuela', 'escuela', ['manzana', 'feliz', 'correr'], 'school'], ['libro', 'libro', ['puerta', 'hola', 'sol'], 'book']],
        French: [['bonjour', 'bonjour', ['merci', 'livre', 'maison'], 'hello'], ['merci', 'merci', ['ami', 'eau', 'maison'], 'thank you'], ['ami', 'ami', ['livre', 'porte', 'soleil'], 'friend'], ['ecole', 'ecole', ['pomme', 'ami', 'voiture'], 'school'], ['livre', 'livre', ['porte', 'bonjour', 'maison'], 'book']],
        German: [['hallo', 'hallo', ['danke', 'buch', 'freund'], 'hello'], ['danke', 'danke', ['wasser', 'schule', 'haus'], 'thank you'], ['freund', 'freund', ['buch', 'tafel', 'musik'], 'friend'], ['schule', 'schule', ['apfel', 'laufen', 'sonne'], 'school'], ['buch', 'buch', ['tur', 'hallo', 'musik'], 'book']],
        Italian: [['ciao', 'ciao', ['grazie', 'libro', 'amico'], 'hello'], ['grazie', 'grazie', ['acqua', 'scuola', 'casa'], 'thank you'], ['amico', 'amico', ['mela', 'musica', 'porta'], 'friend'], ['scuola', 'scuola', ['mela', 'corre', 'sole'], 'school'], ['libro', 'libro', ['porta', 'ciao', 'sole'], 'book']],
        Arabic: [['مرحبا', 'مرحبا', ['شكرا', 'كتاب', 'بيت'], 'hello'], ['شكرا', 'شكرا', ['ماء', 'صديق', 'مدرسة'], 'thank you'], ['صديق', 'صديق', ['كتاب', 'نافذة', 'قمر'], 'friend'], ['مدرسة', 'مدرسة', ['تفاحة', 'أحب', 'سماء'], 'school'], ['كتاب', 'كتاب', ['باب', 'مرحبا', 'شمس'], 'book']],
        Hindi: [['नमस्ते', 'नमस्ते', ['धन्यवाद', 'किताब', 'मित्र'], 'namaste'], ['धन्यवाद', 'धन्यवाद', ['पानी', 'विद्यालय', 'घर'], 'dhanyavaad'], ['मित्र', 'मित्र', ['किताब', 'दरवाज़ा', 'सूरज'], 'mitra'], ['विद्यालय', 'विद्यालय', ['सेब', 'दोस्ती', 'आकाश'], 'vidyalaya'], ['किताब', 'किताब', ['दरवाज़ा', 'नमस्ते', 'चाँद'], 'kitab']],
        English: [['Hello', 'Hello', ['Goodbye', 'Book', 'Happy'], 'hello'], ['Thank you', 'Thank you', ['Friend', 'Water', 'House'], 'thank you'], ['Please', 'Please', ['Hello', 'School', 'Book'], 'please'], ['School', 'School', ['Happy', 'Friend', 'Goodbye'], 'school'], ['Book', 'Book', ['Water', 'Please', 'House'], 'book']],
        Korean: [['안녕하세요', '안녕하세요', ['고맙습니다', '책', '친구'], 'annyeonghaseyo'], ['고맙습니다', '고맙습니다', ['물', '학교', '집'], 'gomapseumnida'], ['친구', '친구', ['책', '문', '해'], 'chingu'], ['학교', '학교', ['집', '물', '안녕하세요'], 'hakgyo'], ['책', '책', ['문', '해', '고맙습니다'], 'chaek']],
        Telugu: [['నమస్కారం', 'నమస్కారం', ['ధన్యవాదాలు', 'పుస్తకం', 'స్నేహితుడు'], 'namaskaram'], ['ధన్యవాదాలు', 'ధన్యవాదాలు', ['నీళ్ళు', 'పాఠశాల', 'ఇల్లు'], 'dhanyavaadaalu'], ['స్నేహితుడు', 'స్నేహితుడు', ['పుస్తకం', 'తలుపు', 'సూర్యుడు'], 'snehitudu'], ['పాఠశాల', 'పాఠశాల', ['ఇల్లు', 'నీళ్ళు', 'నమస్కారం'], 'paathashaala'], ['పుస్తకం', 'పుస్తకం', ['తలుపు', 'సూర్యుడు', 'ధన్యవాదాలు'], 'pustakam']]
    };

    const vocabLanguage = languageSets[language] ? language : 'Spanish';
    if (vocabLanguage !== language) console.warn(`[fallback] No vocabulary for "${language}"; using Spanish instead.`);
    const selectedSet = languageSets[vocabLanguage];
    const translationMap = englishTranslations[vocabLanguage];

    for (let i = 0; i < count; i++) {
        const pair = selectedSet[i % selectedSet.length];
        const [phrase, answer, distractors, pronunciation] = pair;
        const type = i % 5;
        if (type === 0) result.push({ type: 'multiple-choice', phrase, pronunciation, answer, distractors, translationMap, hint: `Practice ${language || 'the language'} words.` });
        else if (type === 1) result.push({ type: 'listen', phrase, answer, distractors, translationMap, hint: `Listen carefully and choose the ${topic || 'practice'} word.` });
        else if (type === 2) result.push({ type: 'spell', phrase, english: pronunciation, hint: `Listen and spell a ${topic || 'practice'} word.` });
        else if (type === 3) result.push({ type: 'speak', phrase, english: pronunciation, hint: `Say the ${topic || 'practice'} word aloud.` });
        else {
            const pairs = Array.from({ length: 4 }, (_, offset) => { const entry = selectedSet[(i + offset) % selectedSet.length]; return { left: entry[0], right: entry[3] }; });
            result.push({ type: 'match-pairs', pairs, hint: `Match each ${topic || 'practice'} word to its pronunciation.` });
        }
    }
    return result;
}

function hasNonLatinText(value) {
    return /[\u0400-\u04FF\u0590-\u05FF\u0600-\u06FF\u0700-\u074F\u0780-\u07BF\u0900-\u097F\u0980-\u09FF\u0A00-\u0A7F\u0A80-\u0AFF\u0B00-\u0B7F\u0B80-\u0BFF\u0C00-\u0C7F\u0C80-\u0CFF\u0D00-\u0D7F\u0D80-\u0DFF\u0E00-\u0E7F\u0F00-\u0FFF\u3040-\u30FF\u3400-\u4DBF\u4E00-\u9FFF\uAC00-\uD7AF\u1100-\u11FF\u1E00-\u1EFF\u2C00-\u2C5F]/.test(String(value ?? ''));
}

const nativeWordBank = {
    Japanese: ['こんにちは', 'ありがとう', '学校', '友達', '本', '水', '猫', '家', '朝', '車', '音楽', '夜'],
    Hindi: ['नमस्ते', 'धन्यवाद', 'मित्र', 'विद्यालय', 'किताब', 'पानी', 'घर', 'सूरज', 'आकाश', 'दरवाज़ा', 'चाँद'],
    Arabic: ['مرحبا', 'شكرا', 'صديق', 'مدرسة', 'كتاب', 'ماء', 'بيت', 'شمس', 'سماء', 'نافذة', 'قمر'],
    Spanish: ['hola', 'gracias', 'amigo', 'escuela', 'libro', 'agua', 'casa', 'sol', 'puerta', 'feliz', 'adios'],
    French: ['bonjour', 'merci', 'ami', 'ecole', 'livre', 'maison', 'porte', 'soleil', 'eau', 'voiture', 'pomme'],
    German: ['hallo', 'danke', 'freund', 'schule', 'buch', 'wasser', 'haus', 'musik', 'apfel', 'sonne', 'tur'],
    Italian: ['ciao', 'grazie', 'amico', 'scuola', 'libro', 'acqua', 'casa', 'porta', 'sole', 'musica', 'mela'],
    Korean: ['안녕하세요', '고맙습니다', '친구', '학교', '책', '물', '집', '문', '해'],
    Telugu: ['నమస్కారం', 'ధన్యవాదాలు', 'స్నేహితుడు', 'పాఠశాల', 'పుస్తకం', 'నీళ్ళు', 'ఇల్లు', 'తలుపు', 'సూర్యుడు']
};

function sanitizeQuestionForLanguage(question, language) {
    if (!question || typeof question !== 'object') return question;
    const lang = normalizeLanguageName(language);
    const nativeWords = nativeWordBank[lang] || [];
    if (!nativeWords.length || lang === 'Math' || lang === 'Chess' || lang === 'Music') return question;

    if (question.type === 'multiple-choice' || question.type === 'listen') {
        const answer = typeof question.answer === 'string' ? question.answer.trim() : '';
        const distractors = Array.isArray(question.distractors) ? question.distractors.filter((x) => typeof x === 'string') : [];

        if (question.phrase && hasNonLatinText(question.phrase)) {
            const phraseValue = String(question.phrase).trim();
            const answerValue = typeof answer === 'string' ? String(answer).trim() : '';
            const nativeAnswer = hasNonLatinText(answerValue) ? answerValue : (phraseValue || answerValue || nativeWords[0] || '');
            const candidatePool = nativeWords.filter((word) => word !== nativeAnswer);
            const normalizedDistractors = [...new Set(distractors.map((word) => String(word).trim()).filter((text) => text && text !== nativeAnswer && hasNonLatinText(text)))].slice(0, 3);
            const safeDistractors = [...normalizedDistractors];
            while (safeDistractors.length < 3 && candidatePool.length) {
                const next = candidatePool.shift();
                if (next && next !== nativeAnswer && !safeDistractors.includes(next)) safeDistractors.push(next);
            }
            question.answer = nativeAnswer;
            question.distractors = safeDistractors.slice(0, 3);
        }

        const knownTranslations = englishTranslations[lang];
        if (knownTranslations) {
            const suppliedTranslations = question.translationMap && typeof question.translationMap === 'object' && !Array.isArray(question.translationMap) ? question.translationMap : {};
            const merged = { ...knownTranslations };
            for (const [key, value] of Object.entries(suppliedTranslations)) {
                if (typeof value !== 'string' || !value.trim()) continue;
                if (!(key in merged)) merged[key] = value;
            }
            question.translationMap = merged;
        }
    }

    return question;
}

function parseStructuredResponse(text) {
    if (!text) return [];
    let cleaned = String(text).trim();
    cleaned = cleaned.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/i, '').trim();
    try {
        const parsed = JSON.parse(cleaned);
        if (Array.isArray(parsed)) return parsed;
        if (Array.isArray(parsed.questions)) return parsed.questions;
        if (Array.isArray(parsed.items)) return parsed.items;
        return [];
    } catch { return []; }
}

// ============================================================
//  AI CALL — GEMINI
// ============================================================
const GEMINI_KEYS = (process.env.GEMINI_API_KEY || '').split(',').map(k => k.trim()).filter(Boolean);
const GEMINI_MODELS = (process.env.GEMINI_MODELS || process.env.GEMINI_MODEL || 'gemini-2.5-flash')
    .split(',')
    .map(m => m.trim())
    .filter(Boolean);

const keyCooldowns = {};
let currentKeyIndex = 0;
const COOLDOWN = {
    RATE_LIMIT_MINUTE: 60 * 1000,
    RATE_LIMIT_DAY: 24 * 60 * 60 * 1000,
    QUOTA_EXCEEDED: 60 * 1000,
    TRANSIENT: 5 * 1000
};

function getNextAvailableKey() {
    const now = Date.now();
    for (let i = 0; i < GEMINI_KEYS.length; i++) {
        const idx = (currentKeyIndex + i) % GEMINI_KEYS.length;
        if (!keyCooldowns[idx] || now > keyCooldowns[idx]) {
            currentKeyIndex = (idx + 1) % GEMINI_KEYS.length;
            return { key: GEMINI_KEYS[idx], index: idx };
        }
    }
    return null;
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function requestGemini(model, key, payload) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    try {
        const response = await fetch(
            `${process.env.GEMINI_PROXY_URL || 'https://generativelanguage.googleapis.com'}/v1beta/models/${model}:generateContent`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
                body: JSON.stringify(payload),
                signal: controller.signal
            }
        );
        return { status: response.status, ok: response.ok, body: await response.text() };
    } finally {
        clearTimeout(timer);
    }
}

async function callAI(prompt, language, topic, count) {
    if (!GEMINI_KEYS.length) {
        console.warn('No GEMINI_API_KEY found; using local fallback questions.');
        return { questions: generateFallbackQuestions(language, topic, count), source: 'fallback' };
    }

    let lastError = 'Unknown';

    for (const model of GEMINI_MODELS) {
        for (let attempt = 0; attempt < GEMINI_KEYS.length * 2; attempt++) {
            const keyEntry = getNextAvailableKey();
            if (!keyEntry) {
                console.warn('All Gemini keys are cooling down. Using fallback.');
                break;
            }

            const keyIdx = keyEntry.index;

            try {
                const r = await requestGemini(model, keyEntry.key, {
                    systemInstruction: { parts: [{ text: 'You generate structured quiz data. Always respond with a valid JSON array or JSON object with a questions/items array only, no prose, no markdown.' }] },
                    contents: [{ role: 'user', parts: [{ text: prompt }] }],
                    generationConfig: { temperature: 0.7, responseMimeType: 'application/json', maxOutputTokens: 8192 }
                });

                if (r.status === 200) {
                    let data;
                    try {
                        data = JSON.parse(r.body);
                    } catch {
                        lastError = 'Invalid JSON response from Gemini';
                        keyCooldowns[keyIdx] = Date.now() + COOLDOWN.TRANSIENT;
                        continue;
                    }
                    const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '[]';
                    const parsed = parseStructuredResponse(text);
                    if (parsed.length > 0) return { questions: parsed, source: 'ai' };
                    lastError = 'Empty JSON response from Gemini';
                    keyCooldowns[keyIdx] = Date.now() + COOLDOWN.TRANSIENT;
                    continue;
                }

                if (r.status === 400) { lastError = 'Bad request'; break; }
                if (r.status === 401) { keyCooldowns[keyIdx] = Date.now() + COOLDOWN.RATE_LIMIT_DAY; lastError = 'Unauthorized'; continue; }
                if (r.status === 403) { keyCooldowns[keyIdx] = Date.now() + COOLDOWN.QUOTA_EXCEEDED; lastError = 'Forbidden'; continue; }
                if (r.status === 404) { lastError = `Model not found: ${model}`; break; }

                if (r.status === 429) {
                    const isDailyQuota = /per.?day|daily|quota.*day/i.test(r.body);
                    const cooldownMs = isDailyQuota ? COOLDOWN.RATE_LIMIT_DAY : COOLDOWN.RATE_LIMIT_MINUTE;
                    keyCooldowns[keyIdx] = Date.now() + cooldownMs;
                    lastError = 'Rate limited';
                    continue;
                }

                if (r.status === 500 || r.status === 502 || r.status === 503) {
                    await sleep(COOLDOWN.TRANSIENT);
                    lastError = `Server error ${r.status} on ${model}`;
                    break;
                }

                lastError = `HTTP ${r.status}`;
                continue;
            } catch (error) {
                lastError = error.name === 'AbortError' ? 'Timeout' : error.message;
                continue;
            }
        }
    }

    console.warn(`All Gemini attempts failed (last: ${lastError}). Using local fallback.`);
    return { questions: generateFallbackQuestions(language, topic, count), source: 'fallback' };
}

// ============================================================
//  VALIDATORS
// ============================================================
function validateQuestion(q, language) {
    if (!q || typeof q !== 'object' || Array.isArray(q) || !q.type) return false;

    switch (q.type) {
        case 'multiple-choice':
        case 'listen': {
            const options = [q.answer, ...(Array.isArray(q.distractors) ? q.distractors : [])];
            const normalizedOptions = options.map((option) => typeof option === 'string' ? option.trim().toLocaleLowerCase() : '');
            const hasValidOptions = typeof q.answer === 'string'
                && q.answer.trim().length > 0
                && Array.isArray(q.distractors)
                && q.distractors.length === 3
                && q.distractors.every((option) => typeof option === 'string' && option.trim().length > 0)
                && new Set(normalizedOptions).size === 4
                && (q.type !== 'listen' || (typeof q.phrase === 'string' && q.phrase.trim().length > 0));
            if (!hasValidOptions) return false;
            if (['English', 'Math', 'Music', 'Chess'].includes(normalizeLanguageName(language))) return true;
            const translationMap = q.translationMap;
            return translationMap && typeof translationMap === 'object' && !Array.isArray(translationMap) && [q.answer, ...q.distractors].every((option) => {
                const translation = translationMap[option] || translationMap[option.toLowerCase()];
                return typeof translation === 'string' && translation.trim().length > 0;
            });
        }
        case 'arrange': return Array.isArray(q.words)
            && q.words.length >= 2
            && q.words.every((word) => typeof word === 'string' && word.trim().length > 0)
            && typeof q.answer === 'string'
            && q.answer.trim().length > 0
            && q.words.join(' ') === q.answer;
        case 'spell':
        case 'speak': return typeof q.phrase === 'string' && q.phrase.trim().length > 0;
        case 'match-pairs': return Array.isArray(q.pairs)
            && q.pairs.length >= 3
            && q.pairs.every((pair) => pair && typeof pair.left === 'string' && pair.left.trim() && typeof pair.right === 'string' && pair.right.trim())
            && new Set(q.pairs.map((pair) => pair.left.trim().toLocaleLowerCase())).size === q.pairs.length
            && new Set(q.pairs.map((pair) => pair.right.trim().toLocaleLowerCase())).size === q.pairs.length;
        case 'slider':
        case 'graph': return Number.isFinite(q.answer)
            && Number.isFinite(q.min)
            && Number.isFinite(q.max)
            && q.min < q.max
            && q.answer >= q.min
            && q.answer <= q.max
            && (q.step === undefined || (Number.isFinite(q.step) && q.step > 0));
        case 'fill-blank': {
            const choices = [q.answer, ...(Array.isArray(q.distractors) ? q.distractors : [])];
            return typeof q.sentence === 'string'
                && (q.sentence.match(/___/g) || []).length === 1
                && typeof q.answer === 'string'
                && q.answer.trim().length > 0
                && Array.isArray(q.distractors)
                && q.distractors.length === 3
                && q.distractors.every((option) => typeof option === 'string' && option.trim().length > 0)
                && new Set(choices.map((option) => option.trim().toLocaleLowerCase())).size === 4;
        }
        case 'translate-type': return typeof q.english === 'string'
            && q.english.trim().length > 0
            && typeof q.answer === 'string'
            && q.answer.trim().length > 0;
        case 'move-sequence':
        case 'mate-in-2':
        case 'mate-in-3':
            return Array.isArray(q.moves) && q.moves.length >= 2
                && typeof q.fen === 'string' && validateFen(q.fen).ok;
        default: return false;
    }
}

// ============================================================
//  ROUTE — generate lesson questions
// ============================================================
app.post('/api/generate-questions', async (req, res) => {
    const rawLanguage = req.body?.language || 'Spanish';
    const language = String(rawLanguage).trim().slice(0, 60) || 'Spanish';
    const topic = String(req.body?.topic || 'everyday words').trim().slice(0, 200) || 'everyday words';
    const count = Math.min(20, Math.max(1, Math.floor(Number(req.body?.count)) || 10));
    const level = Math.min(3, Math.max(1, Math.floor(Number(req.body?.level)) || 1));
    const noNonsense = req.body?.noNonsense === true;
    const reason = req.body?.reason || 'curiosity';
    const goal = req.body?.goal || 'confidence';
    const experience = req.body?.experience || 'new';

    try {
        const normalizedLanguage = normalizeLanguageName(language);

        if (normalizedLanguage === 'Chess') {
            const questions = [];
            const seen = new Set();
            let aiQuestionCount = 0;
            const appendValidatedQuestions = (candidates, isAi) => {
                for (const candidate of candidates) {
                    const question = normalizeChessQuestion(candidate, topic);
                    if (!question) continue;
                    const key = question.moves
                        ? `multi|${question.type}|${question.fen}|${JSON.stringify(question.moves)}`
                        : `${question.type}|${question.fen}|${question.from}|${question.answer}`;
                    if (seen.has(key)) continue;
                    seen.add(key);
                    questions.push(question);
                    if (isAi) aiQuestionCount++;
                    if (questions.length === count) break;
                }
            };

            if (GEMINI_KEYS.length) {
                const aiResult = await callAI(chessQuestionPrompt(topic, count, level), 'Chess', topic, count);
                appendValidatedQuestions(aiResult.source === 'ai' ? aiResult.questions : [], true);

                if (questions.length < count && aiResult.source === 'ai') {
                    const retryCount = count - questions.length;
                    const retry = await callAI(chessQuestionPrompt(topic, retryCount, level), 'Chess', topic, retryCount);
                    appendValidatedQuestions(retry.source === 'ai' ? retry.questions : [], true);
                }
            }

            const remaining = count - questions.length;
            if (remaining > 0) {
                appendValidatedQuestions(generateChessQuestions(remaining, level, topic), false);
            }
            if (questions.length < count) {
                appendValidatedQuestions(generateChessQuestions(count - questions.length, 1, topic), false);
            }

            const source = aiQuestionCount
                ? aiQuestionCount === questions.length ? 'ai' : 'mixed'
                : GEMINI_KEYS.length ? 'built-in' : 'fallback';
            res.set('X-Musal-Question-Source', source);
            return res.json(questions.slice(0, count));
        }

        if (normalizedLanguage === 'Music') {
            const theoryPattern = /\bnotes?\b|\bintervals?\b|\bchords?\b|\bkey signature\b|\bclefs?\b/i;
            if (theoryPattern.test(topic)) {
                res.set('X-Musal-Question-Source', 'built-in');
                return res.json(generateMusicQuestions(count, Number(level)));
            }
        }

        let prompt;
        if (normalizedLanguage === 'Math') prompt = mathPrompt(topic, count, experience);
        else if (normalizedLanguage === 'Music') prompt = musicPrompt(topic, count);
        else prompt = languagePrompt(normalizedLanguage, topic, count, noNonsense, reason, goal);

        const valid = [];
        const seen = new Set();
        let acceptedAiQuestion = false;
        let acceptedFallbackQuestion = false;
        const appendQuestions = (result) => {
            const questions = Array.isArray(result?.questions) ? result.questions : [];
            for (const rawQuestion of questions) {
                const question = sanitizeQuestionForLanguage(rawQuestion, normalizedLanguage);
                if (!validateQuestion(question, normalizedLanguage)) continue;
                const key = [
                    question.type,
                    question.question || question.phrase || question.sentence || question.english || '',
                    typeof question.answer === 'string' || typeof question.answer === 'number' ? question.answer : '',
                    Array.isArray(question.pairs) ? JSON.stringify(question.pairs) : ''
                ].join('|').trim().toLocaleLowerCase();
                if (seen.has(key) && (result.source !== 'fallback' || valid.length >= count)) continue;
                seen.add(key);
                valid.push(question);
                if (result.source === 'ai') acceptedAiQuestion = true;
                else acceptedFallbackQuestion = true;
                if (valid.length >= count) break;
            }
        };

        appendQuestions(await callAI(prompt, normalizedLanguage, topic, count));
        if (valid.length < count) appendQuestions(await callAI(prompt, normalizedLanguage, topic, count));
        if (valid.length < count) {
            appendQuestions({
                questions: generateFallbackQuestions(normalizedLanguage, topic, count - valid.length),
                source: 'fallback'
            });
        }

        const source = acceptedAiQuestion
            ? acceptedFallbackQuestion ? 'mixed' : 'ai'
            : 'fallback';

        res.set('X-Musal-Question-Source', source).json(valid.slice(0, count));
    } catch (e) {
        console.error('Generation error:', e);
        res.status(500).json({ error: String(e) });
    }
});

// ============================================================
//  ROUTE — chat proxy
// ============================================================
app.post('/api/chat', async (req, res) => {
    const prompt = String(req.body?.prompt || '').trim();
    if (!prompt) return res.status(400).json({ error: 'Missing prompt' });
    if (prompt.length > 4000) return res.status(400).json({ error: 'Prompt too long' });
    if (!GEMINI_KEYS.length) return res.status(503).json({ error: 'No Gemini keys configured on server' });

    let lastError = 'Unknown';

    for (const model of GEMINI_MODELS) {
        for (let attempt = 0; attempt < GEMINI_KEYS.length * 2; attempt++) {
            const keyEntry = getNextAvailableKey();
            if (!keyEntry) { lastError = 'All keys cooling down'; break; }

            const keyIdx = keyEntry.index;

            try {
                const r = await requestGemini(model, keyEntry.key, {
                    contents: [{ role: 'user', parts: [{ text: prompt }] }],
                    generationConfig: { temperature: 0.4, maxOutputTokens: 1500 }
                });

                if (r.ok) {
                    let data;
                    try {
                        data = JSON.parse(r.body);
                    } catch {
                        lastError = 'Invalid JSON response from Gemini';
                        continue;
                    }
                    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
                    if (text) return res.json({ text });
                    lastError = 'Empty reply from Gemini';
                    continue;
                }

                if (r.status === 429) {
                    const isDaily = /per.?day|daily|quota.*day/i.test(r.body);
                    keyCooldowns[keyIdx] = Date.now() + (isDaily ? COOLDOWN.RATE_LIMIT_DAY : COOLDOWN.RATE_LIMIT_MINUTE);
                    lastError = `Rate limited (${isDaily ? 'daily' : 'per-min'})`;
                    continue;
                }

                if (r.status === 401 || r.status === 403) {
                    keyCooldowns[keyIdx] = Date.now() + COOLDOWN.RATE_LIMIT_DAY;
                    lastError = `HTTP ${r.status} (key rejected)`;
                    continue;
                }

                if (r.status === 503) { await sleep(500); lastError = `503 on ${model}`; break; }

                lastError = `HTTP ${r.status}`;
                continue;
            } catch (e) {
                lastError = e.name === 'AbortError' ? 'Timeout' : e.message;
                continue;
            }
        }
    }

    res.status(503).json({ error: lastError });
});

// ============================================================
//  ROUTE — Send Form
// ============================================================
app.post('/api/send-form', async (req, res) => {
    const title = String(req.body?.title ?? '').trim().slice(0, 200);
    const type = String(req.body?.type ?? 'general').trim().slice(0, 50);
    const content = String(req.body?.content ?? '').trim().slice(0, 5000);

    if (!title || !content) return res.status(400).json({ error: 'Missing title or content' });

    const emailUser = process.env.EMAIL_USER;
    const emailPass = (process.env.EMAIL_PASS || '').replace(/\s+/g, '');
    const emailTo = process.env.EMAIL_TO || emailUser;

    if (!emailUser || !emailPass) {
        console.warn('[Email] EMAIL_USER or EMAIL_PASS not set in .env. Skipping email.');
        return res.json({ success: true, emailSent: false, message: 'Saved locally (Email not configured)' });
    }

    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: { user: emailUser, pass: emailPass }
    });

    const mailOptions = {
        from: `"Musalingo Forms" <${emailUser}>`,
        to: emailTo,
        subject: `Musalingo Form: [${type}] ${title}`,
        text: `You received a new form submission from Musalingo.\n\nTitle: ${title}\nType: ${type}\n\nContent:\n${content}`,
        html: `
            <h2>New Form Submission</h2>
            <p><strong>Title:</strong> ${escapeHtml(title)}</p>
            <p><strong>Type:</strong> ${escapeHtml(type)}</p>
            <p><strong>Content:</strong></p>
            <p style="white-space: pre-wrap; background: #f3f4f6; padding: 10px; border-radius: 8px;">${escapeHtml(content)}</p>
        `
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log(`[Email] Form sent: ${title}`);
        res.json({ success: true, emailSent: true, message: 'Email sent successfully' });
    } catch (error) {
        console.error('[Email] Failed to send:', error);
        res.status(500).json({ error: 'Failed to send email' });
    }
});

// ============================================================
//  SELF-PING
// ============================================================
const SELF_PING_ENABLED = process.env.ENABLE_SELF_PING === 'true' || process.env.NODE_ENV === 'production';
const SELF_PING_INTERVAL_MS = 10 * 60 * 1000;
const SELF_PING_URL = process.env.SELF_PING_URL || (process.env.RENDER_EXTERNAL_URL
    ? `${process.env.RENDER_EXTERNAL_URL}/api/health`
    : null);

let selfPingTimer = null;

function startSelfPing() {
    if (!SELF_PING_ENABLED) {
        console.log('⏸️  Self-ping disabled (ENABLE_SELF_PING not set, not in production)');
        return;
    }
    if (!SELF_PING_URL) {
        console.log('⚠️  Self-ping enabled but SELF_PING_URL not set');
        console.log('   Set SELF_PING_URL=https://your-service.onrender.com/api/health');
        return;
    }
    console.log(`🔄 Self-ping active → ${SELF_PING_URL} every ${SELF_PING_INTERVAL_MS / 60000} min`);
    selfPingTimer = setInterval(async () => {
        try {
            const r = await fetch(SELF_PING_URL, { method: 'GET', signal: AbortSignal.timeout(8000) });
            console.log(`[self-ping] ${r.status} at ${new Date().toISOString()}`);
        } catch (err) {
            console.warn(`[self-ping] failed: ${err.message}`);
        }
    }, SELF_PING_INTERVAL_MS);
    selfPingTimer.unref();
}

function stopSelfPing() {
    if (selfPingTimer) clearInterval(selfPingTimer);
}

// ============================================================
//  START
// ============================================================
const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Musalingo running → http://localhost:${PORT}/dashboard.html`);
    console.log(`🔑 Loaded ${GEMINI_KEYS.length} Gemini API key(s).`);
    if (GEMINI_MODELS.length) console.log(`🤖 Models: ${GEMINI_MODELS.join(' → ')}`);
    if (process.env.EMAIL_USER) console.log(`📧 Email configured for: ${process.env.EMAIL_USER}`);
    console.log(`🏥 Health endpoint: http://localhost:${PORT}/api/health`);
    startSelfPing();
});

process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down…');
    stopSelfPing();
    server.close(() => process.exit(0));
});
process.on('SIGINT', () => {
    console.log('SIGINT received, shutting down…');
    stopSelfPing();
    server.close(() => process.exit(0));
});

export default app;