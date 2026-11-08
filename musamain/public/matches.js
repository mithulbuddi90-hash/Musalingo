/* ============================================================
   Musalingo — matches.js (Stockfish Integrated + Bug Fixes)
   ============================================================ */

import {
    createFriendChessGame,
    acceptFriendChessGame,
    abortFriendChessGame,
    pushChessMove,
    finishChessGame,
    offerChessDraw,
    clearChessDrawOffer,
    listenToChessGame,
    listenToMyChessInvites,
    loadFriendsProfiles,
    loadLocalProfile,
    loadFriendProfile,
    awardChessMatchReward
} from './firebase.js';

/* ============ BRIDGE FOR INLINE HANDLERS ============ */
const p = loadLocalProfile();
window.__musalingoUid = p.uid || '';
window.__musalingoEmail = p.email || '';
window.__musalingoPlayerName = p.name || 'Player';

window.MF = {
    createFriendChessGame, acceptFriendChessGame, abortFriendChessGame, pushChessMove,
    finishChessGame, offerChessDraw, clearChessDrawOffer, listenToChessGame,
    listenToMyChessInvites, loadFriendsProfiles, loadLocalProfile, loadFriendProfile
};

/* ============ SMALL HELPERS (were missing) ============ */
function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function createLocalGameRewardId() {
    if (window.crypto?.randomUUID) return `local:${window.crypto.randomUUID()}`;
    return `local:${Date.now()}:${Math.random().toString(36).slice(2)}`;
}

function getGamificationSettings() {
    try {
        return JSON.parse(localStorage.getItem('MusalingoSettings') || '{}') || {};
    } catch (error) {
        console.warn('[matches] Could not read gamification settings; using defaults.', error);
        return {};
    }
}

async function showMatchReward(outcome) {
    const rewardMessage = document.getElementById('resultReward');
    if (!rewardMessage) return;
    rewardMessage.textContent = '';
    rewardMessage.hidden = false;

    if (gameMode === '1v1') {
        rewardMessage.textContent = 'Same-device 1 vs 1 games do not award XP or streaks.';
        return;
    }

    const gameId = gameMode === 'friend' ? liveGameId : currentGameRewardId;
    if (!gameId) {
        rewardMessage.textContent = 'Match rewards could not be saved because this game has no ID.';
        console.error('[matches] Missing game ID; cannot award chess match rewards.');
        return;
    }

    const settings = getGamificationSettings();
    rewardMessage.textContent = 'Saving match rewards…';
    try {
        const result = await awardChessMatchReward({
            gameId,
            outcome,
            awardXp: settings.noGamification !== true,
            updateStreak: settings.noStreaks !== true
        });
        if (result.alreadyRewarded) {
            rewardMessage.textContent = 'Rewards for this match were already recorded.';
            return;
        }

        Object.assign(p, result.profile);
        const earned = result.xpEarned > 0 ? `+${result.xpEarned} XP` : 'XP disabled';
        const streak = !result.streakEnabled
            ? 'streaks disabled'
            : result.streakPaused
                ? 'streak paused'
                : result.streakAdvanced
                    ? `${result.streak}-day streak`
                    : `${result.streak}-day streak maintained`;
        rewardMessage.textContent = `${earned} · ${streak}`;
        if (result.xpEarned > 0) SFX.gemEarned();
    } catch (error) {
        console.error('[matches] Could not save chess match rewards.', error);
        rewardMessage.textContent = 'Could not save match rewards. Check your connection and try again later.';
    }
}

/* ============ STOCKFISH ENGINE ============ */
const stockfish = new Worker('/engine/stockfish-19-lite-single.js');
stockfish.postMessage('uci');
stockfish.postMessage('isready');

stockfish.onmessage = function (event) {
    const line = event.data;
    if (typeof line !== 'string') return;
    if (line.startsWith('bestmove')) {
        const bestMove = line.split(' ')[1]; // e.g., "e2e4" or "(none)"
        // Always hand it off — applyStockfishMove knows how to un-stick on "(none)".
        applyStockfishMove(bestMove);
    }
};

function askStockfish(fen, depth = 5) {
    stockfish.postMessage('position fen ' + fen);
    stockfish.postMessage('go depth ' + depth);
}

/* ============ ENGINE CONSTANTS ============ */
const PIECE_VALUE = { P: 100, N: 320, B: 330, R: 500, Q: 900, K: 20000 };
const PST = {
    P: [[0, 0, 0, 0, 0, 0, 0, 0], [50, 50, 50, 50, 50, 50, 50, 50], [10, 10, 20, 30, 30, 20, 10, 10], [5, 5, 10, 25, 25, 10, 5, 5], [0, 0, 0, 20, 20, 0, 0, 0], [5, -5, -10, 0, 0, -10, -5, 5], [5, 10, 10, -20, -20, 10, 10, 5], [0, 0, 0, 0, 0, 0, 0, 0]],
    N: [[-50, -40, -30, -30, -30, -30, -40, -50], [-40, -20, 0, 0, 0, 0, -20, -40], [-30, 0, 10, 15, 15, 10, 0, -30], [-30, 5, 15, 20, 20, 15, 5, -30], [-30, 0, 15, 20, 20, 15, 0, -30], [-30, 5, 10, 15, 15, 10, 5, -30], [-40, -20, 0, 5, 5, 0, -20, -40], [-50, -40, -30, -30, -30, -30, -40, -50]],
    B: [[-20, -10, -10, -10, -10, -10, -10, -20], [-10, 0, 0, 0, 0, 0, 0, -10], [-10, 0, 5, 10, 10, 5, 0, -10], [-10, 5, 5, 10, 10, 5, 5, -10], [-10, 0, 10, 10, 10, 10, 0, -10], [-10, 10, 10, 10, 10, 10, 10, -10], [-10, 5, 0, 0, 0, 0, 5, -10], [-20, -10, -10, -10, -10, -10, -10, -20]],
    R: [[0, 0, 0, 0, 0, 0, 0, 0], [5, 10, 10, 10, 10, 10, 10, 5], [-5, 0, 0, 0, 0, 0, 0, -5], [-5, 0, 0, 0, 0, 0, 0, -5], [-5, 0, 0, 0, 0, 0, 0, -5], [-5, 0, 0, 0, 0, 0, 0, -5], [-5, 0, 0, 0, 0, 0, 0, -5], [0, 0, 0, 5, 5, 0, 0, 0]],
    Q: [[-20, -10, -10, -5, -5, -10, -10, -20], [-10, 0, 0, 0, 0, 0, 0, -10], [-10, 0, 5, 5, 5, 5, 0, -10], [-5, 0, 5, 5, 5, 5, 0, -5], [0, 0, 5, 5, 5, 5, 0, -5], [-10, 5, 5, 5, 5, 5, 0, -10], [-10, 0, 5, 0, 0, 0, 0, -10], [-20, -10, -10, -5, -5, -10, -10, -20]],
    K: [[-30, -40, -40, -50, -50, -40, -40, -30], [-30, -40, -40, -50, -50, -40, -40, -30], [-30, -40, -40, -50, -50, -40, -40, -30], [-30, -40, -40, -50, -50, -40, -40, -30], [-20, -30, -30, -40, -40, -30, -30, -20], [-10, -20, -20, -20, -20, -20, -20, -10], [20, 20, 0, 0, 0, 0, 20, 20], [20, 30, 10, 0, 0, 10, 30, 20]]
};
const PST_K_END = [[-50, -40, -30, -20, -20, -30, -40, -50], [-30, -20, -10, 0, 0, -10, -20, -30], [-30, -10, 20, 30, 30, 20, -10, -30], [-30, -10, 30, 40, 40, 30, -10, -30], [-30, -10, 30, 40, 40, 30, -10, -30], [-30, -10, 20, 30, 30, 20, -10, -30], [-30, -30, 0, 0, 0, 0, -30, -30], [-50, -30, -30, -30, -30, -30, -30, -50]];

const start = [
    ["bR", "bN", "bB", "bQ", "bK", "bB", "bN", "bR"],
    ["bP", "bP", "bP", "bP", "bP", "bP", "bP", "bP"],
    [null, null, null, null, null, null, null, null],
    [null, null, null, null, null, null, null, null],
    [null, null, null, null, null, null, null, null],
    [null, null, null, null, null, null, null, null],
    ["wP", "wP", "wP", "wP", "wP", "wP", "wP", "wP"],
    ["wR", "wN", "wB", "wQ", "wK", "wB", "wN", "wR"]
];
const INITIAL_RIGHTS = { wK: true, wQ: true, bK: true, bQ: true };

/* ============ STATE ============ */
let boardState = cloneBoard(start);
let selected = null;
let history = [];
let lastMove = null;
let turn = "w";
let castlingRights = { ...INITIAL_RIGHTS };
let enPassant = null;
let gameOver = false;
let botThinking = false;
let gameMode = "bot";
let playerColor = "w";
let flipped = false;
let currentBot = "beginner";
let aiCoachMode = false;
let aiCoachLastMove = null;
let coachHighlights = [];
let gameMoves = [];
let lastSeenRemoteMoveCount = 0;
let halfmoveClock = 0;
let fullmoveNumber = 1;
let positionHistory = [];
let currentGameRewardId = '';

// Friend/live state
let liveGameId = null;
let myLiveColor = null;
let liveUnsub = null;
let invitesUnsub = null;
let drawOfferPending = false;

const BOT_CONFIGS = {
    beginner: { name: "Beginner", elo: "~800", depth: 1, randomness: 0.85, useRandom: true, usePST: false, useQuiescence: false, maxTimeMs: 0 },
    intermediate1: { name: "Intermediate 1", elo: "~1200", depth: 2, randomness: 0.30, useRandom: false, usePST: true, useQuiescence: false, maxTimeMs: 1500 },
    intermediate2: { name: "Intermediate 2", elo: "~1500", depth: 3, randomness: 0.10, useRandom: false, usePST: true, useQuiescence: true, maxTimeMs: 2500 },
    expert: { name: "Expert", elo: "~1800", depth: 4, randomness: 0.00, useRandom: false, usePST: true, useQuiescence: true, maxTimeMs: 4000 },
    advanced1: { name: "Advanced 1", elo: "~2200", depth: 5, randomness: 0.00, useRandom: false, usePST: true, useQuiescence: true, maxTimeMs: 6000 },
    advanced2: { name: "Advanced 2", elo: "~2600", depth: 6, randomness: 0.00, useRandom: false, usePST: true, useQuiescence: true, maxTimeMs: 9000 },
    stockfish: { name: "Stockfish", elo: "~3000", depth: 5, randomness: 0.00, useRandom: false, usePST: true, useQuiescence: true, maxTimeMs: 0 }
};

/* ============ CORE HELPERS ============ */
function cloneBoard(b) { return b.map(r => r.slice()); }
function other(c) { return c === "w" ? "b" : "w"; }
function inBounds(r, c) { return r >= 0 && r < 8 && c >= 0 && c < 8; }
function squareName(r, c) { return "abcdefgh"[c] + (8 - r); }
function sameMove(a, b) { return a && b && a.fr === b.fr && a.fc === b.fc && a.tr === b.tr && a.tc === b.tc; }

function setStatus(text, kind = "") {
    const el = document.getElementById("gameStatus");
    if (!el) return;
    el.textContent = text;
    el.className = "status" + (kind ? " " + kind : "");
}

function findKing(color, b) {
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) if (b[r][c] === color + "K") return { r, c };
    return null;
}

function squareAttacked(r, c, byColor, b) {
    const pr = r + (byColor === "w" ? 1 : -1);
    for (const dc of [-1, 1]) { const pc = c + dc; if (inBounds(pr, pc) && b[pr][pc] === byColor + "P") return true; }
    for (const [dr, dc] of [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]]) { const rr = r + dr, cc = c + dc; if (inBounds(rr, cc) && b[rr][cc] === byColor + "N") return true; }
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) { if (!dr && !dc) continue; const rr = r + dr, cc = c + dc; if (inBounds(rr, cc) && b[rr][cc] === byColor + "K") return true; }
    const lines = [[[1, 0], ["R", "Q"]], [[-1, 0], ["R", "Q"]], [[0, 1], ["R", "Q"]], [[0, -1], ["R", "Q"]], [[1, 1], ["B", "Q"]], [[1, -1], ["B", "Q"]], [[-1, 1], ["B", "Q"]], [[-1, -1], ["B", "Q"]]];
    for (const [[dr, dc], types] of lines) { let rr = r + dr, cc = c + dc; while (inBounds(rr, cc)) { const p = b[rr][cc]; if (p) { if (p[0] === byColor && types.includes(p[1])) return true; break; } rr += dr; cc += dc; } }
    return false;
}

function isInCheck(color, b) {
    const k = findKing(color, b);
    return !k || squareAttacked(k.r, k.c, other(color), b);
}

function pseudoMoves(fr, fc, color, b, castling, ep) {
    const p = b[fr][fc]; if (!p || p[0] !== color) return [];
    const t2 = p[1], moves = [];
    const add = (tr, tc, extra = {}) => {
        if (!inBounds(tr, tc)) return;
        const target = b[tr][tc];
        if (target && target[0] === color) return;
        if (target && target[1] === "K") return;
        moves.push({ fr, fc, tr, tc, piece: t2, captured: target ? target[1] : null, ...extra });
    };
    if (t2 === "P") {
        const d = color === "w" ? -1 : 1, sr = color === "w" ? 6 : 1, pr = color === "w" ? 0 : 7;
        const one = fr + d;
        if (inBounds(one, fc) && !b[one][fc]) {
            add(one, fc, { promotion: one === pr });
            const two = fr + 2 * d;
            if (fr === sr && !b[two][fc]) add(two, fc, { doublePawn: true });
        }
        for (const dc of [-1, 1]) {
            const tr = fr + d, tc = fc + dc;
            if (!inBounds(tr, tc)) continue;
            const target = b[tr][tc];
            if (target && target[0] !== color && target[1] !== "K") add(tr, tc, { promotion: tr === pr });
            if (ep && ep.r === tr && ep.c === tc) add(tr, tc, { enPassant: true, captured: "P" });
        }
    } else if (t2 === "N") {
        for (const [dr, dc] of [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]]) add(fr + dr, fc + dc);
    } else if (t2 === "B" || t2 === "R" || t2 === "Q") {
        const dirs = [];
        if (t2 === "B" || t2 === "Q") dirs.push([1, 1], [1, -1], [-1, 1], [-1, -1]);
        if (t2 === "R" || t2 === "Q") dirs.push([1, 0], [-1, 0], [0, 1], [0, -1]);
        for (const [dr, dc] of dirs) {
            let r = fr + dr, c = fc + dc;
            while (inBounds(r, c)) {
                if (b[r][c]) { if (b[r][c][0] !== color && b[r][c][1] !== "K") add(r, c); break; }
                add(r, c); r += dr; c += dc;
            }
        }
    } else if (t2 === "K") {
        for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) if (dr || dc) add(fr + dr, fc + dc);
        if (!isInCheck(color, b)) {
            const row = color === "w" ? 7 : 0;
            if (fr === row && fc === 4) {
                if (castling[color + "K"] && !b[row][5] && !b[row][6] && b[row][7] === color + "R" && !squareAttacked(row, 5, other(color), b) && !squareAttacked(row, 6, other(color), b)) add(row, 6, { castle: "K" });
                if (castling[color + "Q"] && !b[row][1] && !b[row][2] && !b[row][3] && b[row][0] === color + "R" && !squareAttacked(row, 3, other(color), b) && !squareAttacked(row, 2, other(color), b)) add(row, 2, { castle: "Q" });
            }
        }
    }
    return moves;
}

function applyMove(move, b, promoType) {
    const next = cloneBoard(b);
    const p = next[move.fr][move.fc];
    next[move.fr][move.fc] = null;
    if (move.enPassant) next[move.fr][move.tc] = null;
    next[move.tr][move.tc] = p;
    if (move.castle === "K") { next[move.tr][5] = next[move.tr][7]; next[move.tr][7] = null; }
    if (move.castle === "Q") { next[move.tr][3] = next[move.tr][0]; next[move.tr][0] = null; }
    if (move.promotion) next[move.tr][move.tc] = p[0] + (promoType || "Q");
    return next;
}

function legalMoves(fr, fc, color, b, castling, ep) {
    return pseudoMoves(fr, fc, color, b, castling, ep).filter(m => !isInCheck(color, applyMove(m, b)));
}

function allLegalMoves(color, b, castling, ep) {
    const out = [];
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) if (b[r][c]?.[0] === color) out.push(...legalMoves(r, c, color, b, castling, ep));
    return out;
}

function countMaterial(b) {
    let pc = 0, wQ = 0, bQ = 0;
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
        const p = b[r][c]; if (!p) continue;
        const t = p[1];
        if (t !== "K" && t !== "P") pc++;
        if (t === "Q") { if (p[0] === "w") wQ++; else bQ++; }
    }
    return { pc, wQ, bQ };
}
function isEndgame(b) {
    const { pc, wQ, bQ } = countMaterial(b);
    if (wQ === 0 && bQ === 0) return true;
    return pc <= 6;
}

/* ============ EVALUATION ============ */
function evaluateBoard(b, usePST = true) {
    let score = 0;
    const endgame = isEndgame(b);
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
        const p = b[r][c]; if (!p) continue;
        const type = p[1], color = p[0], sign = color === "w" ? 1 : -1;
        score += sign * PIECE_VALUE[type];
        if (usePST) {
            const rowFromWhite = color === "w" ? r : 7 - r;
            const col = color === "w" ? c : 7 - c;
            if (type === "K" && endgame) score += sign * PST_K_END[rowFromWhite][col] * 0.5;
            else if (PST[type]) score += sign * PST[type][rowFromWhite][col] * 0.3;
        }
    }
    let wB = 0, bB = 0;
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) { if (b[r][c] === "wB") wB++; if (b[r][c] === "bB") bB++; }
    if (wB >= 2) score += 30;
    if (bB >= 2) score -= 30;
    return score;
}

function orderMoves(moves, b) {
    return moves.map(m => {
        let s = 0;
        if (m.captured) s += PIECE_VALUE[m.captured] * 10 - PIECE_VALUE[m.piece];
        if (m.promotion) s += 800;
        if (m.castle) s += 50;
        return { ...m, orderScore: s };
    }).sort((a, b) => b.orderScore - a.orderScore);
}

/* ============ SEARCH ============ */
function quiescenceSearch(b, castling, ep, alpha, beta, color, depth) {
    if (depth > 4) return evaluateBoard(b) * (color === "w" ? 1 : -1);
    const standPat = evaluateBoard(b) * (color === "w" ? 1 : -1);
    if (standPat >= beta) return beta;
    if (alpha < standPat) alpha = standPat;
    const captures = allLegalMoves(color, b, castling, ep).filter(m => m.captured);
    for (const move of orderMoves(captures, b)) {
        const next = applyMove(move, b, "Q");
        const score = -quiescenceSearch(next, castling, null, -beta, -alpha, other(color), depth + 1);
        if (score >= beta) return beta;
        if (score > alpha) alpha = score;
    }
    return alpha;
}

function minimax(b, castling, ep, depth, alpha, beta, color, usePST, useQuiescence) {
    if (depth === 0) {
        if (useQuiescence) return quiescenceSearch(b, castling, ep, alpha, beta, color, 0);
        return evaluateBoard(b, usePST) * (color === "w" ? 1 : -1);
    }
    const moves = allLegalMoves(color, b, castling, ep);
    if (moves.length === 0) {
        if (isInCheck(color, b)) return -100000 + (10 - depth);
        return 0;
    }
    for (const move of orderMoves(moves, b)) {
        const next = applyMove(move, b, "Q");
        const score = -minimax(next, castling, null, depth - 1, -beta, -alpha, other(color), usePST, useQuiescence);
        if (score >= beta) return beta;
        if (score > alpha) alpha = score;
    }
    return alpha;
}

function minimaxTimed(b, castling, ep, depth, alpha, beta, color, usePST, useQuiescence, deadline) {
    if (Date.now() > deadline) return evaluateBoard(b, usePST) * (color === "w" ? 1 : -1);
    if (depth === 0) {
        if (useQuiescence) return quiescenceSearchTimed(b, castling, ep, alpha, beta, color, 0, deadline);
        return evaluateBoard(b, usePST) * (color === "w" ? 1 : -1);
    }
    const moves = allLegalMoves(color, b, castling, ep);
    if (moves.length === 0) {
        if (isInCheck(color, b)) return -100000 + (10 - depth);
        return 0;
    }
    for (const move of orderMoves(moves, b)) {
        if (Date.now() > deadline) return alpha;
        const next = applyMove(move, b, "Q");
        const score = -minimaxTimed(next, castling, null, depth - 1, -beta, -alpha, other(color), usePST, useQuiescence, deadline);
        if (score >= beta) return beta;
        if (score > alpha) alpha = score;
    }
    return alpha;
}

function quiescenceSearchTimed(b, castling, ep, alpha, beta, color, depth, deadline) {
    if (depth > 4) return evaluateBoard(b) * (color === "w" ? 1 : -1);
    if (Date.now() > deadline) return evaluateBoard(b) * (color === "w" ? 1 : -1);
    const standPat = evaluateBoard(b) * (color === "w" ? 1 : -1);
    if (standPat >= beta) return beta;
    if (alpha < standPat) alpha = standPat;
    const captures = allLegalMoves(color, b, castling, ep).filter(m => m.captured);
    for (const move of orderMoves(captures, b)) {
        if (Date.now() > deadline) break;
        const next = applyMove(move, b, "Q");
        const score = -quiescenceSearchTimed(next, castling, null, -beta, -alpha, other(color), depth + 1, deadline);
        if (score >= beta) return beta;
        if (score > alpha) alpha = score;
    }
    return alpha;
}

/* ============ STOCKFISH INTEGRATION ============ */
function applyStockfishMove(moveStr) {
    // "(none)" or any short/invalid string → unstick the board.
    if (gameOver || !moveStr || moveStr.length < 4 || moveStr === '(none)') {
        botThinking = false;
        updateStatus();
        return;
    }
    const from = moveStr.slice(0, 2);
    const to = moveStr.slice(2, 4);
    const promo = moveStr.length > 4 ? moveStr[4].toLowerCase() : 'q';

    const fr = 8 - parseInt(from[1]);
    const fc = "abcdefgh".indexOf(from[0]);
    const tr = 8 - parseInt(to[1]);
    const tc = "abcdefgh".indexOf(to[0]);

    if (fr < 0 || fr > 7 || fc < 0 || fc > 7 || tr < 0 || tr > 7 || tc < 0 || tc > 7) {
        console.warn('[matches] Stockfish returned an unparseable move:', moveStr);
        botThinking = false;
        updateStatus();
        return;
    }

    const moves = allLegalMoves(turn, boardState, castlingRights, enPassant);
    const move = moves.find(m => m.fr === fr && m.fc === fc && m.tr === tr && m.tc === tc);

    if (move) {
        const boardBefore = cloneBoard(boardState);
        const castlingBefore = { ...castlingRights };
        const epBefore = enPassant ? { ...enPassant } : null;
        const san = moveToSan(move, boardBefore, castlingBefore, epBefore, promo);

        makeMove(move, false, promo);
        botThinking = false;
        renderBoard();

        if (move.captured) SFX.captureOpponent(move.captured);
        else SFX.moveOpponent();

        if (aiCoachMode) {
            aiCoachLastMove = { move: { ...move }, boardBefore, san };
            highlightCoachSquares([{ r: move.fr, c: move.fc, color: "yellow" }, { r: move.tr, c: move.tc, color: "green" }]);
            setTimeout(() => clearCoachHighlights(), 2500);
            addChat("ai", "🧠 I played " + san + ". Ask me \"why did you play that?\" if curious.");
        }
    } else {
        console.warn('[matches] Stockfish returned an illegal move:', moveStr);
        botThinking = false;
        setStatus('Engine hiccup — your turn.', 'bad');
        updateStatus();
    }
}

/* ============ BOT MOVE ============ */
function chooseBotMove(moves, botKey) {
    if (botKey === 'stockfish') {
        const fen = serializeBoardToFen();
        askStockfish(fen, BOT_CONFIGS.stockfish.depth);
        return null;
    }

    const cfg = BOT_CONFIGS[botKey];
    if (!moves.length) return null;
    if (cfg.useRandom || cfg.depth === 0) {
        const captures = moves.filter(m => m.captured);
        if (captures.length > 0 && Math.random() < 0.7) return captures[Math.floor(Math.random() * captures.length)];
        return moves[Math.floor(Math.random() * moves.length)];
    }
    if (cfg.maxTimeMs > 0) return iterativeDeepening(moves, cfg);
    let bestMove = null, bestScore = -Infinity, alpha = -Infinity;
    for (const move of orderMoves(moves, boardState)) {
        const next = applyMove(move, boardState, "Q");
        const score = -minimax(next, castlingRights, null, cfg.depth - 1, -Infinity, -alpha, other(turn), cfg.usePST, cfg.useQuiescence);
        if (score > bestScore) { bestScore = score; bestMove = move; }
        if (score > alpha) alpha = score;
    }
    if (cfg.randomness > 0 && Math.random() < cfg.randomness) return moves[Math.floor(Math.random() * moves.length)];
    return bestMove || moves[0];
}

function iterativeDeepening(legalMoves, cfg) {
    const deadline = Date.now() + cfg.maxTimeMs;
    let bestMoveOverall = legalMoves[0];
    let bestScoreOverall = -Infinity;
    for (let depth = 2; depth <= cfg.depth; depth++) {
        let bestMoveThisDepth = null, bestScoreThisDepth = -Infinity, alpha = -Infinity;
        let aborted = false;
        const ordered = orderMoves(legalMoves, boardState);
        if (bestMoveOverall) {
            const idx = ordered.findIndex(m => sameMove(m, bestMoveOverall));
            if (idx > 0) { const [m] = ordered.splice(idx, 1); ordered.unshift(m); }
        }
        for (const move of ordered) {
            if (Date.now() > deadline) { aborted = true; break; }
            const next = applyMove(move, boardState, "Q");
            const score = -minimaxTimed(next, castlingRights, null, depth - 1, -Infinity, -alpha, other(turn), cfg.usePST, cfg.useQuiescence, deadline);
            if (Date.now() > deadline) { aborted = true; break; }
            if (score > bestScoreThisDepth) { bestScoreThisDepth = score; bestMoveThisDepth = move; }
            if (score > alpha) alpha = score;
        }
        if (!aborted && bestMoveThisDepth) { bestMoveOverall = bestMoveThisDepth; bestScoreOverall = bestScoreThisDepth; }
        if (aborted) break;
        if (bestScoreOverall >= 100000) break;
        if (Date.now() > deadline) break;
    }
    return bestMoveOverall;
}

/* ============ AI COACH ============ */
let aiKillers = null, aiHistory = null, aiNodesSearched = 0;

function initAIEngineTables() {
    if (aiKillers) return;
    aiKillers = [];
    for (let i = 0; i < 128; i++) aiKillers.push([null, null]);
    aiHistory = [];
    for (let c = 0; c < 2; c++) {
        aiHistory.push([]);
        for (let f = 0; f < 64; f++) aiHistory[c].push(new Array(64).fill(0));
    }
}

function chooseAICoachMove(legalMoves) {
    if (!legalMoves || !legalMoves.length) return null;
    initAIEngineTables();
    aiNodesSearched = 0;
    const TIME_BUDGET_MS = 1900;
    const deadline = Date.now() + TIME_BUDGET_MS;
    for (let i = 0; i < 128; i++) aiKillers[i] = [null, null];
    let bestMoveOverall = legalMoves[0];
    let bestScoreOverall = -Infinity;
    let previousScore = 0;
    const MAX_DEPTH = 20;
    for (let depth = 1; depth <= MAX_DEPTH; depth++) {
        let bestMoveThisDepth = null;
        let bestScoreThisDepth = -Infinity;
        let alpha = depth >= 3 ? previousScore - 40 : -Infinity;
        let beta = depth >= 3 ? previousScore + 40 : Infinity;
        const ordered = aiOrderMoves(legalMoves, 0, bestMoveOverall, turn);
        const currentTurn = turn;
        const currentCastling = { ...castlingRights };
        let aborted = false;
        let aspirationFail = 0;
        while (true) {
            let failHigh = false;
            bestMoveThisDepth = null;
            bestScoreThisDepth = -Infinity;
            let localAlpha = alpha;
            for (const move of ordered) {
                if (Date.now() > deadline) { aborted = true; break; }
                const next = applyMove(move, boardState, "Q");
                const score = -aiSearch(next, currentCastling, null, depth - 1, -beta, -localAlpha, other(currentTurn), deadline, true);
                if (Date.now() > deadline) { aborted = true; break; }
                if (score > bestScoreThisDepth) { bestScoreThisDepth = score; bestMoveThisDepth = move; }
                if (score > localAlpha) localAlpha = score;
                if (score >= beta) { failHigh = true; break; }
            }
            if (aborted) break;
            if (failHigh && aspirationFail < 3) { beta = beta + 200; aspirationFail++; continue; }
            if (bestScoreThisDepth <= alpha && aspirationFail < 3) { alpha = alpha - 200; aspirationFail++; continue; }
            break;
        }
        if (aborted) break;
        if (bestMoveThisDepth) { bestMoveOverall = bestMoveThisDepth; bestScoreOverall = bestScoreThisDepth; previousScore = bestScoreThisDepth; }
        if (bestScoreOverall >= 99000) break;
        if (bestScoreOverall <= -99000) break;
        const elapsed = Date.now() - (deadline - TIME_BUDGET_MS);
        if (elapsed > TIME_BUDGET_MS * 0.5) break;
    }
    return bestMoveOverall;
}

function aiOrderMoves(moves, ply, pvMove, color) {
    return moves.map(m => {
        let s = 0;
        if (pvMove && sameMove(m, pvMove)) s += 1000000;
        if (m.captured) s += PIECE_VALUE[m.captured] * 10 - PIECE_VALUE[m.piece] + 100000;
        if (m.promotion) s += 90000;
        if (m.castle) s += 500;
        if (!m.captured && !m.promotion && !m.castle && !m.enPassant && ply < 128) {
            s += aiHistory[color === "w" ? 0 : 1][m.fr * 8 + m.fc][m.tr * 8 + m.tc];
            if (aiKillers[ply]) {
                if (aiKillers[ply][0] && sameMove(m, aiKillers[ply][0])) s += 50000;
                else if (aiKillers[ply][1] && sameMove(m, aiKillers[ply][1])) s += 30000;
            }
        }
        return { move: m, score: s };
    }).sort((a, b) => b.score - a.score).map(x => x.move);
}

function aiSearch(b, castling, ep, depth, alpha, beta, color, deadline, allowNull) {
    aiNodesSearched++;
    if ((aiNodesSearched & 1023) === 0 && Date.now() > deadline) return alpha;
    const inCheck = isInCheck(color, b);
    if (inCheck) depth++;
    if (depth <= 0) return aiQuiescence(b, castling, ep, alpha, beta, color, 0, deadline);
    const moves = allLegalMoves(color, b, castling, ep);
    if (moves.length === 0) {
        if (inCheck) return -100000 + (20 - depth);
        return 0;
    }
    const ordered = aiOrderMoves(moves, depth, null, color);
    let legalIdx = 0;
    for (const move of ordered) {
        if (Date.now() > deadline) return alpha;
        const next = applyMove(move, b, "Q");
        const isTac = move.captured || move.promotion;
        const givesCheck = isInCheck(other(color), next);
        let score;
        if (depth >= 3 && legalIdx >= 4 && !isTac && !givesCheck && !inCheck) {
            const reduce = legalIdx >= 8 ? 2 : 1;
            score = -aiSearch(next, castling, null, depth - 1 - reduce, -alpha - 1, -alpha, other(color), deadline, true);
            if (score > alpha && score < beta) score = -aiSearch(next, castling, null, depth - 1, -beta, -alpha, other(color), deadline, true);
        } else {
            score = -aiSearch(next, castling, null, depth - 1, -beta, -alpha, other(color), deadline, true);
        }
        legalIdx++;
        if (score >= beta) return beta;
        if (score > alpha) alpha = score;
    }
    return alpha;
}

function aiQuiescence(b, castling, ep, alpha, beta, color, depth, deadline) {
    aiNodesSearched++;
    if ((aiNodesSearched & 511) === 0 && Date.now() > deadline) return alpha;
    if (depth > 4) return evaluateBoard(b) * (color === "w" ? 1 : -1);
    const standPat = evaluateBoard(b) * (color === "w" ? 1 : -1);
    if (standPat >= beta) return beta;
    if (standPat > alpha) alpha = standPat;
    const moves = allLegalMoves(color, b, castling, ep);
    const captures = moves.filter(m => m.captured || m.promotion);
    const ordered = orderMoves(captures, b);
    for (const move of ordered) {
        if (Date.now() > deadline) break;
        const next = applyMove(move, b, "Q");
        const score = -aiQuiescence(next, castling, null, -beta, -alpha, other(color), depth + 1, deadline);
        if (score >= beta) return beta;
        if (score > alpha) alpha = score;
    }
    return alpha;
}

/* ============ HIGHLIGHTS ============ */
function highlightCoachSquares(squares, color) {
    clearCoachHighlights();
    const boardEl = document.getElementById("board");
    if (!boardEl) return;
    const arr = Array.isArray(squares) ? squares : [squares];
    arr.forEach(sq => {
        if (!sq || sq.r < 0 || sq.c < 0) return;
        const idx = sq.r * 8 + sq.c;
        const cell = boardEl.children[idx];
        if (!cell) return;
        const col = sq.color || color || "blue";
        if (col === "green") cell.classList.add("highlight-green");
        else if (col === "yellow") cell.classList.add("highlight-yellow");
        else cell.classList.add("highlight");
        coachHighlights.push({ r: sq.r, c: sq.c, color: col });
    });
}

function clearCoachHighlights() {
    const boardEl = document.getElementById("board");
    if (!boardEl) return;
    [...boardEl.children].forEach(c => c.classList.remove("highlight", "highlight-yellow", "highlight-green"));
    coachHighlights = [];
}

function squareFromName(name) {
    if (!name || name.length < 2) return null;
    const c = "abcdefgh".indexOf(String(name[0]).toLowerCase());
    const r = 8 - parseInt(name[1]);
    if (c < 0 || r < 0 || r > 7) return null;
    return { r, c };
}

/* ============ MODE STARTERS ============ */
function hideAllPlaySubviews() {
    const ids = ['playMenu', 'botMenu', 'friendMenu', 'gameView'];
    ids.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = 'none';
    });
    document.querySelector('.orb-container')?.classList.add('game-active');
}

function backToPlayMenu() {
    if (liveUnsub) { try { liveUnsub(); } catch (e) { } liveUnsub = null; }
    if (invitesUnsub) { try { invitesUnsub(); } catch (e) { } invitesUnsub = null; }
    liveGameId = null;
    myLiveColor = null;
    gameMode = "bot";
    aiCoachMode = false;
    aiCoachLastMove = null;
    clearCoachHighlights();
    hideAllPlaySubviews();
    document.querySelector('.orb-container')?.classList.remove('game-active');
    const pm = document.getElementById("playMenu");
    pm.style.display = "block";
    pm.scrollTop = 0;
    const cbt = document.getElementById("clockBarTop");
    const cbb = document.getElementById("clockBarBottom");
    if (cbt) cbt.style.display = "none";
    if (cbb) cbb.style.display = "none";
    gameOver = true;
}
window.backToPlayMenu = backToPlayMenu;

function showBotMenu() {
    hideAllPlaySubviews();
    document.querySelector('.orb-container')?.classList.remove('game-active');
    document.getElementById("botMenu").style.display = "block";
}
window.showBotMenu = showBotMenu;

function setActionButtonsVisibility(mode) {
    const btnUndo = document.getElementById("btnUndo");
    const btnNew = document.getElementById("btnNew");
    const show = (mode === "local");
    if (btnUndo) btnUndo.style.display = show ? "" : "none";
    if (btnNew) btnNew.style.display = show ? "" : "none";
}

function startBotGame(botKey) {
    hideAllPlaySubviews();
    setActionButtonsVisibility("local");
    aiCoachMode = false;
    clearCoachHighlights();
    currentBot = botKey;
    const cfg = BOT_CONFIGS[botKey];
    gameMode = "bot";
    playerColor = "w";
    flipped = false;
    liveGameId = null;
    myLiveColor = null;
    document.getElementById("gameView").style.display = "flex";
    document.getElementById("gameModeBadge").style.display = "inline-block";
    document.getElementById("gameModeBadge").textContent = cfg.name;
    document.getElementById("playTitle").textContent = "Play vs " + cfg.name;
    document.getElementById("opponentControl").style.display = "block";
    document.getElementById("opponent").value = botKey;
    const cbt = document.getElementById("clockBarTop");
    const cbb = document.getElementById("clockBarBottom");
    if (cbt) cbt.style.display = "none";
    if (cbb) cbb.style.display = "none";
    newGame();
    for (let i = 0; i < 20; i++) setTimeout(fitBoards, i * 100);
}
window.startBotGame = startBotGame;

function start1v1() {
    hideAllPlaySubviews();
    setActionButtonsVisibility("local");
    aiCoachMode = false;
    clearCoachHighlights();
    gameMode = "1v1";
    playerColor = "both";
    flipped = false;
    liveGameId = null;
    myLiveColor = null;
    document.getElementById("gameView").style.display = "flex";
    document.getElementById("opponentControl").style.display = "none";
    document.getElementById("gameModeBadge").style.display = "inline-block";
    document.getElementById("gameModeBadge").textContent = "1v1";
    document.getElementById("playTitle").textContent = "1 vs 1";
    const cbt = document.getElementById("clockBarTop");
    const cbb = document.getElementById("clockBarBottom");
    if (cbt) cbt.style.display = "none";
    if (cbb) cbb.style.display = "none";
    newGame();
    for (let i = 0; i < 20; i++) setTimeout(fitBoards, i * 100);
}
window.start1v1 = start1v1;

function startAICoachGame() {
    hideAllPlaySubviews();
    setActionButtonsVisibility("local");
    initAIEngineTables();
    aiCoachMode = true;
    aiCoachLastMove = null;
    coachHighlights = [];
    currentBot = "aiCoach";
    gameMode = "bot";
    playerColor = "w";
    flipped = false;
    liveGameId = null;
    myLiveColor = null;
    clearCoachHighlights();
    document.getElementById("gameView").style.display = "flex";
    document.getElementById("gameModeBadge").style.display = "inline-block";
    document.getElementById("gameModeBadge").textContent = "🧠 AI Coach";
    document.getElementById("playTitle").textContent = "Play with AI Coach";
    document.getElementById("opponentControl").style.display = "none";
    const cbt = document.getElementById("clockBarTop");
    const cbb = document.getElementById("clockBarBottom");
    if (cbt) cbt.style.display = "none";
    if (cbb) cbb.style.display = "none";
    newGame();
    const chat = document.getElementById("chat");
    if (chat) {
        chat.innerHTML = "";
        addChat("ai", "🧠 Welcome! I'm your AI Coach — a master-level engine.\n\nTry asking me:\n• \"Why did you play that move?\"\n• \"What's the best move for me here?\"\n• \"Explain this position\"\n\nI can highlight squares on the board while explaining!");
    }
    for (let i = 0; i < 20; i++) setTimeout(fitBoards, i * 100);
}
window.startAICoachGame = startAICoachGame;

function setOpponent() {
    currentBot = document.getElementById("opponent").value;
}
window.setOpponent = setOpponent;

/* ============ BOARD RENDER ============ */
function renderBoard() {
    const el = document.getElementById("board");
    if (!el) return;
    el.innerHTML = "";
    const ranksEl = document.getElementById("boardRanks");
    if (ranksEl) {
        ranksEl.innerHTML = "";
        for (let r = 0; r < 8; r++) {
            const d = document.createElement("div");
            d.className = "coord-text";
            d.style.textAlign = "center";
            d.textContent = 8 - r;
            ranksEl.appendChild(d);
        }
    }
    const filesEl = document.getElementById("boardFiles");
    if (filesEl) {
        filesEl.innerHTML = "";
        for (let c = 0; c < 8; c++) {
            const d = document.createElement("div");
            d.className = "coord-text";
            d.textContent = "abcdefgh"[c];
            filesEl.appendChild(d);
        }
    }
    const legal = selected ? legalMoves(selected.r, selected.c, turn, boardState, castlingRights, enPassant) : [];
    const kingPos = isInCheck(turn, boardState) ? findKing(turn, boardState) : null;
    for (let dispR = 0; dispR < 8; dispR++) for (let dispC = 0; dispC < 8; dispC++) {
        const r = flipped ? 7 - dispR : dispR;
        const c = flipped ? 7 - dispC : dispC;
        const s = document.createElement("div");
        s.className = "square " + (((dispR + dispC) % 2) ? "dark" : "light");
        if (selected && selected.r === r && selected.c === c) s.classList.add("selected");
        if (lastMove && ((lastMove.fr === r && lastMove.fc === c) || (lastMove.tr === r && lastMove.tc === c))) s.classList.add("last-move");
        if (kingPos && kingPos.r === r && kingPos.c === c) s.classList.add("check");
        const lm = legal.find(m => m.tr === r && m.tc === c);
        if (lm) { s.classList.add("legal"); if (boardState[r][c] || lm.enPassant) s.classList.add("capture"); }
        const p = boardState[r][c];
        if (p) { const wrap = document.createElement("div"); wrap.className = "piece"; wrap.innerHTML = SVG_PIECES[p]; s.appendChild(wrap); }
        s.onclick = () => clickSquare(r, c);
        el.appendChild(s);
    }
    if (coachHighlights.length) {
        coachHighlights.forEach(ch => {
            const idx = ch.r * 8 + ch.c;
            const cell = el.children[idx];
            if (!cell) return;
            if (ch.color === "green") cell.classList.add("highlight-green");
            else if (ch.color === "yellow") cell.classList.add("highlight-yellow");
            else cell.classList.add("highlight");
        });
    }
    updateStatus();
    setTimeout(fitBoards, 20);
}

function canMoveColor(color) {
    if (gameMode === "1v1") return true;
    if (gameMode === "friend") return color === myLiveColor;
    return color === "w";
}

function clickSquare(r, c) {
    if (gameOver || botThinking) return;
    if (!canMoveColor(turn)) return;
    clearCoachHighlights();
    const p = boardState[r][c];
    if (selected) {
        const move = legalMoves(selected.r, selected.c, turn, boardState, castlingRights, enPassant).find(m => m.tr === r && m.tc === c);
        if (move) {
            if (move.promotion) {
                showPromotionDialog(turn, (pt) => { makeMove(move, true, pt); selected = null; renderBoard(); afterMove(); });
                selected = null; renderBoard(); return;
            }
            selected = null; makeMove(move, true); renderBoard(); afterMove(); return;
        }
        selected = null; renderBoard();
    }
    if (p && p[0] === turn) {
        selected = { r, c };
        renderBoard();
        SFX.tap();
    }
}

function afterMove() {
    if (gameOver) return;

    if (lastMove) {
        const lastEntry = gameMoves[gameMoves.length - 1];
        const moverColor = lastEntry?.turnBefore || 'w';

        let isMyMove;
        if (gameMode === '1v1') isMyMove = true;
        else if (gameMode === 'friend') isMyMove = moverColor === myLiveColor;
        else isMyMove = moverColor === 'w';

        if (lastMove.captured) {
            if (isMyMove) SFX.capture(lastMove.captured);
            else SFX.captureOpponent(lastMove.captured);
        } else {
            if (isMyMove) SFX.move();
            else SFX.moveOpponent();
        }
    }

    if (gameMode === "friend" && liveGameId && window.MF) {
        const last = gameMoves[gameMoves.length - 1];
        if (last) {
            window.MF.pushChessMove(liveGameId, {
                from: squareName(last.move.fr, last.move.fc),
                to: squareName(last.move.tr, last.move.tc),
                promo: last.move.promotion ? last.promo : null,
                san: last.san || "",
                fen: serializeBoardToFen(),
                turn: turn,
                by: myLiveColor
            }).catch(err => console.warn("pushChessMove failed", err));
        }
        updateLiveStatus();
        return;
    }
    if (gameMode === "bot" && turn === "b") scheduleBotMove();
}

function showPromotionDialog(color, callback) {
    const overlay = document.getElementById("promoOverlay");
    const piecesEl = document.getElementById("promoPieces");
    piecesEl.innerHTML = "";
    for (const t2 of ["Q", "R", "B", "N"]) {
        const b = document.createElement("button");
        b.innerHTML = SVG_PIECES[color + t2];
        b.onclick = () => { overlay.classList.remove("active"); callback(t2); };
        piecesEl.appendChild(b);
    }
    overlay.classList.add("active");
}

function updateCastlingRights(move, p, captured, cr) {
    if (p === "wK") { cr.wK = cr.wQ = false; }
    if (p === "bK") { cr.bK = cr.bQ = false; }
    if (p === "wR" && move.fr === 7 && move.fc === 0) cr.wQ = false;
    if (p === "wR" && move.fr === 7 && move.fc === 7) cr.wK = false;
    if (p === "bR" && move.fr === 0 && move.fc === 0) cr.bQ = false;
    if (p === "bR" && move.fr === 0 && move.fc === 7) cr.bK = false;
    if (captured === "wR" && move.tr === 7 && move.tc === 0) cr.wQ = false;
    if (captured === "wR" && move.tr === 7 && move.tc === 7) cr.wK = false;
    if (captured === "bR" && move.tr === 0 && move.tc === 0) cr.bQ = false;
    if (captured === "bR" && move.tr === 0 && move.tc === 7) cr.bK = false;
}

function positionKey(b, t, castling, ep) {
    let s = "";
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) s += b[r][c] || ".";
    s += "|" + t + "|" + (castling.wK ? "K" : "") + (castling.wQ ? "Q" : "") + (castling.bK ? "k" : "") + (castling.bQ ? "q" : "");
    s += "|" + (ep ? ep.r + "," + ep.c : "-");
    return s;
}

function insufficientMaterial(b) {
    const pieces = [];
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
        const p = b[r][c];
        if (p && p[1] !== "K") pieces.push(p);
    }
    if (pieces.length === 0) return true;
    if (pieces.length === 1 && (pieces[0][1] === "B" || pieces[0][1] === "N")) return true;
    return false;
}

function makeMove(move, record = true, promoType = "Q") {
    const p = boardState[move.fr][move.fc];
    const captured = move.enPassant ? boardState[move.fr][move.tc] : boardState[move.tr][move.tc];
    const preBoard = cloneBoard(boardState);
    const preCastling = { ...castlingRights };
    const preEp = enPassant ? { ...enPassant } : null;
    const preTurn = turn;
    if (record) history.push({ board: preBoard, turn: preTurn, castling: preCastling, enPassant: preEp, lastMove: lastMove ? { ...lastMove } : null, gameOver, halfmoveClock });
    updateCastlingRights(move, p, captured, castlingRights);
    boardState = applyMove(move, boardState, promoType);
    enPassant = move.doublePawn ? { r: (move.fr + move.tr) / 2, c: move.fc } : null;
    lastMove = { ...move };
    turn = other(turn);
    if (p[1] === "P" || captured) halfmoveClock = 0; else halfmoveClock++;
    if (turn === "w") fullmoveNumber++;
    positionHistory.push(positionKey(boardState, turn, castlingRights, enPassant));
    const san = moveToSan(move, preBoard, preCastling, preEp, promoType);
    gameMoves.push({
        move: { ...move },
        promo: promoType,
        boardBefore: preBoard,
        castlingBefore: preCastling,
        epBefore: preEp,
        turnBefore: preTurn,
        san
    });
    checkGameEnd();
}

function checkGameEnd() {
    if (halfmoveClock >= 100) {
        gameOver = true;
        setStatus("Draw — fifty-move rule.", "good");
        if (gameMode === "friend" && liveGameId && window.MF) {
            window.MF.finishChessGame(liveGameId, { result: "draw", reason: "fifty-move" });
        }
        showResultModal(false, "draw");
        return;
    }
    if (insufficientMaterial(boardState)) {
        gameOver = true;
        setStatus("Draw — insufficient material.", "good");
        if (gameMode === "friend" && liveGameId && window.MF) {
            window.MF.finishChessGame(liveGameId, { result: "draw", reason: "insufficient-material" });
        }
        showResultModal(false, "draw");
        return;
    }
    const key = positionKey(boardState, turn, castlingRights, enPassant);
    if (positionHistory.filter(k => k === key).length >= 3) {
        gameOver = true;
        setStatus("Draw — threefold repetition.", "good");
        if (gameMode === "friend" && liveGameId && window.MF) {
            window.MF.finishChessGame(liveGameId, { result: "draw", reason: "threefold" });
        }
        showResultModal(false, "draw");
        return;
    }
    const legal = allLegalMoves(turn, boardState, castlingRights, enPassant);
    if (!legal.length) {
        gameOver = true;
        if (isInCheck(turn, boardState)) {
            const winner = turn === "w" ? "Black" : "White";
            setStatus(`Checkmate — ${winner} wins!`, "good");
            if (gameMode === "friend" && liveGameId && window.MF) {
                window.MF.finishChessGame(liveGameId, {
                    result: turn === "w" ? "black" : "white",
                    reason: "checkmate"
                });
            }
            showResultModal(true, winner);
        } else {
            setStatus("Stalemate — draw.", "good");
            if (gameMode === "friend" && liveGameId && window.MF) {
                window.MF.finishChessGame(liveGameId, { result: "draw", reason: "stalemate" });
            }
            showResultModal(false, "draw");
        }
    } else if (isInCheck(turn, boardState)) {
        setStatus("Check!", "bad");
        SFX.check();
    }
}

function buildResultButtons() {
    let html = '';
    if (gameMoves.length > 0) html += `<button class="result-btn analyze" onclick="startGameAnalysis()">📊 Analyze Game</button>`;
    html += `<button class="result-btn play" onclick="newGame();closeResultModal()">Play Again</button>`;
    html += `<button class="result-btn close" onclick="closeResultModal();backToPlayMenu()">Close</button>`;
    return html;
}

function showResultModal(isCheckmate, winner) {
    document.getElementById("resultIcon").textContent = isCheckmate ? (winner === "White" ? "🏆" : "😔") : "🤝";
    document.getElementById("resultTitle").textContent = isCheckmate ? "Checkmate!" : (winner === "draw" ? "Draw" : "Stalemate");
    document.getElementById("resultSub").textContent = isCheckmate ? (winner === "White" ? "White wins!" : "Black wins!") : "Draw";
    document.getElementById("resultButtons").innerHTML = buildResultButtons();
    document.getElementById("resultModal").classList.add("active");
    const outcome = winner === 'draw'
        ? 'drawn'
        : gameMode === 'bot' && winner === 'White'
            ? 'won'
            : 'lost';
    showMatchReward(outcome);

    if (isCheckmate && gameMode !== "friend") {
        let humanWon = false;
        if (gameMode === "1v1") humanWon = true;
        else if (gameMode === "bot") humanWon = winner === "White";
        if (humanWon) SFX.win(); else SFX.lose();
    }
}

function closeResultModal() {
    document.getElementById("resultModal").classList.remove("active");
}
window.closeResultModal = closeResultModal;

function updateStatus() {
    if (gameOver) return;
    if (botThinking) setStatus("🤔 Thinking...", "thinking");
    else if (gameMode === "bot") {
        if (turn === "w") setStatus("Your turn", "");
        else setStatus("Bot's turn", "");
    } else if (gameMode === "1v1") {
        setStatus(turn === "w" ? "White to move" : "Black to move", "");
    } else if (gameMode === "friend") {
        updateLiveStatus();
    }
}

function scheduleBotMove() {
    if (gameOver) return;
    botThinking = true;
    updateStatus();
    if (aiCoachMode) setStatus("🧠 AI Coach is thinking...", "thinking");
    setTimeout(() => {
        const moves = allLegalMoves("b", boardState, castlingRights, enPassant);
        if (!moves.length) { botThinking = false; checkGameEnd(); return; }

        let mv;
        if (aiCoachMode) mv = chooseAICoachMove(moves);
        else if (currentBot === 'stockfish') {
            const fen = serializeBoardToFen();
            askStockfish(fen, BOT_CONFIGS.stockfish.depth);
            return;
        }
        else mv = chooseBotMove(moves, currentBot);

        if (!mv) { botThinking = false; return; }

        const boardBefore = cloneBoard(boardState);
        const castlingBefore = { ...castlingRights };
        const epBefore = enPassant ? { ...enPassant } : null;
        const san = moveToSan(mv, boardBefore, castlingBefore, epBefore, "Q");
        makeMove(mv, false, "Q");
        botThinking = false;
        renderBoard();

        if (mv.captured) SFX.captureOpponent(mv.captured);
        else SFX.moveOpponent();

        if (aiCoachMode) {
            aiCoachLastMove = { move: { ...mv }, boardBefore, san };
            highlightCoachSquares([{ r: mv.fr, c: mv.fc, color: "yellow" }, { r: mv.tr, c: mv.tc, color: "green" }]);
            setTimeout(() => clearCoachHighlights(), 2500);
            addChat("ai", "🧠 I played " + san + ". Ask me \"why did you play that?\" if curious.");
        }
    }, 200);
}

function undoMove() {
    if (botThinking) return;
    if (!history.length) return;
    if (gameMode === "friend") return;
    let popped = 0;
    let snapshot = history.pop(); popped++;
    if (gameMode === "bot" && snapshot.turn !== "w") {
        while (history.length && snapshot.turn !== "w") { snapshot = history.pop(); popped++; }
    }
    if (gameMode === "bot") {
        gameMoves.length = Math.max(0, gameMoves.length - popped * 2);
    } else {
        gameMoves.length = Math.max(0, gameMoves.length - popped);
    }
    boardState = cloneBoard(snapshot.board);
    turn = snapshot.turn;
    castlingRights = { ...snapshot.castling };
    enPassant = snapshot.enPassant ? { ...snapshot.enPassant } : null;
    lastMove = snapshot.lastMove ? { ...snapshot.lastMove } : null;
    halfmoveClock = snapshot.halfmoveClock || 0;
    gameOver = false;
    selected = null;
    document.getElementById("promoOverlay").classList.remove("active");
    document.getElementById("resultModal").classList.remove("active");
    positionHistory = [positionKey(boardState, turn, castlingRights, enPassant)];
    renderBoard();
}
window.undoMove = undoMove;

function newGame() {
    currentGameRewardId = gameMode === 'friend' ? (liveGameId || '') : createLocalGameRewardId();
    const rewardMessage = document.getElementById('resultReward');
    if (rewardMessage) {
        rewardMessage.hidden = true;
        rewardMessage.textContent = '';
    }
    boardState = cloneBoard(start);
    history = [];
    selected = null;
    lastMove = null;
    turn = "w";
    castlingRights = { ...INITIAL_RIGHTS };
    enPassant = null;
    gameOver = false;
    botThinking = false;
    gameMoves = [];
    aiCoachLastMove = null;
    halfmoveClock = 0;
    fullmoveNumber = 1;
    if (gameMode === "bot") playerColor = "w";
    if (gameMode !== "friend") { liveGameId = null; myLiveColor = null; }
    clearCoachHighlights();
    document.getElementById("promoOverlay").classList.remove("active");
    document.getElementById("resultModal").classList.remove("active");
    positionHistory = [positionKey(boardState, turn, castlingRights, enPassant)];
    // Reset Stockfish's internal position so stale bestmoves don't leak in.
    try { stockfish.postMessage('ucinewgame'); } catch (e) { /* worker may not be ready */ }
    renderBoard();
}
window.newGame = newGame;

function hintMove() {
    if (gameOver || botThinking) return;
    if (gameMode === "friend") return;
    const color = gameMode === "bot" ? "w" : turn;
    const moves = allLegalMoves(color, boardState, castlingRights, enPassant);
    if (!moves.length) return;
    let best = null, bestScore = -Infinity, alpha = -Infinity;
    for (const move of orderMoves(moves, boardState)) {
        const next = applyMove(move, boardState, "Q");
        const score = -minimax(next, castlingRights, null, 2, -Infinity, -alpha, other(color), true, true);
        if (score > bestScore) { bestScore = score; best = move; }
        if (score > alpha) alpha = score;
    }
    if (best) setStatus(`💡 Hint: ${squareName(best.fr, best.fc)} → ${squareName(best.tr, best.tc)}`, "good");
}
window.hintMove = hintMove;

function resignGame() {
    if (gameOver) return;
    if (gameMode === "friend" && liveGameId && window.MF) {
        if (!confirm("Resign this game?")) return;
        SFX.lose();
        const winner = myLiveColor === "w" ? "black" : "white";
        window.MF.finishChessGame(liveGameId, { result: winner, reason: "resignation" });
        return;
    }
    if (!confirm("Are you sure you want to resign?")) return;
    SFX.lose();
    gameOver = true;
    const winner = gameMode === "bot" ? "Black" : (turn === "w" ? "Black" : "White");
    setStatus(`You resigned. ${winner} wins.`, "bad");
    document.getElementById("resultIcon").textContent = "🏳️";
    document.getElementById("resultTitle").textContent = "You Resigned";
    document.getElementById("resultSub").textContent = winner + " wins by resignation";
    document.getElementById("resultButtons").innerHTML = buildResultButtons();
    document.getElementById("resultModal").classList.add("active");
    showMatchReward('lost');
}
window.resignGame = resignGame;

function offerDraw() {
    if (gameOver) return;
    if (gameMode === "friend" && liveGameId && window.MF) {
        window.MF.offerChessDraw(liveGameId, window.__musalingoUid);
        setStatus("Draw offered. Waiting for friend…", "thinking");
        return;
    }
    if (gameMode === "bot") {
        const eval_ = evaluateBoard(boardState) * (turn === "w" ? 1 : -1);
        const botWinning = turn === "b" ? eval_ > 120 : eval_ < -120;
        if (!botWinning && Math.random() < 0.75) {
            gameOver = true;
            document.getElementById("resultIcon").textContent = "🤝";
            document.getElementById("resultTitle").textContent = "Draw";
            document.getElementById("resultSub").textContent = "Bot accepted your draw offer";
            document.getElementById("resultButtons").innerHTML = buildResultButtons();
            document.getElementById("resultModal").classList.add("active");
            showMatchReward('drawn');
        } else {
            setStatus("Bot declined the draw.", "bad");
        }
        return;
    }
    if (gameMode === "1v1") {
        if (confirm("Offer draw to opponent (same device)?\n\nOpponent, accept the draw?")) {
            gameOver = true;
            document.getElementById("resultIcon").textContent = "🤝";
            document.getElementById("resultTitle").textContent = "Draw Agreed";
            document.getElementById("resultSub").textContent = "Both players agreed to a draw";
            document.getElementById("resultButtons").innerHTML = buildResultButtons();
            document.getElementById("resultModal").classList.add("active");
            showMatchReward('drawn');
        }
    }
}
window.offerDraw = offerDraw;

/* ============ SAN ============ */
function moveToSan(move, board, castling, ep, promo) {
    const piece = board[move.fr][move.fc];
    if (!piece) return "?";
    const type = piece[1], color = piece[0];
    let san = "";
    if (move.castle === "K") san = "O-O";
    else if (move.castle === "Q") san = "O-O-O";
    else {
        if (type !== "P") {
            san += type;
            let ambiguous = false, sameFile = false, sameRank = false;
            for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
                if (r === move.fr && c === move.fc) continue;
                if (board[r][c] === piece) {
                    const ms = legalMoves(r, c, color, board, castling, ep);
                    if (ms.some(m => m.tr === move.tr && m.tc === move.tc)) { ambiguous = true; if (c === move.fc) sameFile = true; if (r === move.fr) sameRank = true; }
                }
            }
            if (ambiguous) { if (!sameFile) san += "abcdefgh"[move.fc]; else if (!sameRank) san += (8 - move.fr); else san += "abcdefgh"[move.fc] + (8 - move.fr); }
        } else { if (move.captured || move.enPassant) san += "abcdefgh"[move.fc]; }
        if (move.captured || move.enPassant) san += "x";
        san += "abcdefgh"[move.tc] + (8 - move.tr);
        if (move.promotion) san += "=" + (promo || "Q");
    }
    const next = applyMove(move, board, promo || "Q");
    const opp = other(color);
    if (isInCheck(opp, next)) {
        const oppMoves = allLegalMoves(opp, next, castling, null);
        if (oppMoves.length === 0) san += "#";
        else san += "+";
    }
    return san;
}

function classifyMove(cpl) {
    if (cpl <= 5) return "best";
    if (cpl <= 20) return "great";
    if (cpl <= 50) return "good";
    if (cpl <= 100) return "inaccuracy";
    if (cpl <= 250) return "mistake";
    return "blunder";
}

/* ============ ANALYSIS ============ */
let analysisResult = null;

function startGameAnalysis() {
    if (gameMoves.length === 0) { alert("No moves to analyze."); return; }
    closeResultModal();
    document.getElementById("analysisModal").classList.add("active");
    document.getElementById("analysisProgress").style.display = "flex";
    const content = document.getElementById("analysisContent");
    content.classList.remove("visible");
    content.style.display = "none";
    document.getElementById("analysisProgressBar").style.width = "0%";
    document.getElementById("analysisProgressText").textContent = "Analyzing…";
    setTimeout(runAnalysis, 120);
}
window.startGameAnalysis = startGameAnalysis;

async function runAnalysis() {
    const total = gameMoves.length;
    const moves = [];
    const ws = { book: 0, brilliant: 0, best: 0, great: 0, good: 0, inaccuracy: 0, mistake: 0, blunder: 0, accuracy: 0 };
    const bs = { book: 0, brilliant: 0, best: 0, great: 0, good: 0, inaccuracy: 0, mistake: 0, blunder: 0, accuracy: 0 };
    for (let i = 0; i < total; i++) {
        const gm = gameMoves[i];
        const budget = i < 10 ? 700 : (i < 30 ? 650 : 550);
        let result;
        try { result = analyzePositionForReview(gm, budget); }
        catch (e) { result = { cpl: 0, bestMove: null, playedScore: 0, bestScore: 0, isBest: true, isOnlyMove: true, isMate: false }; }
        let classification = classifyMove(result.cpl);
        const san = gm.san || moveToSan(gm.move, gm.boardBefore, gm.castlingBefore, gm.epBefore, gm.promo);
        const bestSan = result.bestMove ? moveToSan(result.bestMove, gm.boardBefore, gm.castlingBefore, gm.epBefore, "Q") : "";
        moves.push({ index: i, san, bestSan, cpl: Math.round(result.cpl), classification, evalAfter: result.playedScore, turnBefore: gm.turnBefore || (i % 2 === 0 ? "w" : "b") });
        const stats = (gm.turnBefore || (i % 2 === 0 ? "w" : "b")) === "w" ? ws : bs;
        stats[classification]++;
        document.getElementById("analysisProgressBar").style.width = Math.round((i + 1) / total * 100) + "%";
        document.getElementById("analysisProgressText").textContent = `Analyzing move ${i + 1} of ${total}`;
        if (i % 3 === 0) await new Promise(r => setTimeout(r, 0));
    }
    const acc = (arr) => arr.length ? Math.round(arr.reduce((s, m) => { let a = 103.1668 * Math.exp(-0.04354 * m.cpl) - 3.1669; a = Math.max(0, Math.min(100, a)); return s + a; }, 0) / arr.length) : 100;
    ws.accuracy = acc(moves.filter(m => m.turnBefore === "w"));
    bs.accuracy = acc(moves.filter(m => m.turnBefore === "b"));
    analysisResult = { moves, whiteStats: ws, blackStats: bs };
    document.getElementById("analysisProgress").style.display = "none";
    const content = document.getElementById("analysisContent");
    content.style.display = "flex";
    content.classList.add("visible");
    renderAnalysisStats();
    renderAnalysisMoveList();
}

function analyzePositionForReview(gm, timeBudgetMs = 700) {
    const board = gm.boardBefore || boardState;
    const castling = gm.castlingBefore || castlingRights;
    const ep = gm.epBefore || null;
    const color = gm.turnBefore || "w";
    const moves = allLegalMoves(color, board, castling, ep);
    if (moves.length === 0) return { cpl: 0, bestMove: null, playedScore: 0, bestScore: 0, isBest: false, isOnlyMove: true, isMate: false };
    const deadline = Date.now() + timeBudgetMs;
    const playedNext = applyMove(gm.move, board, gm.promo || "Q");
    const oppColor = other(color);
    const playedScore = -minimaxTimed(playedNext, castling, null, 3, -Infinity, Infinity, oppColor, true, true, deadline);
    const scored = [{ move: gm.move, score: playedScore }];
    for (const move of orderMoves(moves, board)) {
        if (sameMove(move, gm.move)) continue;
        if (Date.now() > deadline) break;
        const next = applyMove(move, board, "Q");
        const score = -minimaxTimed(next, castling, null, 3, -Infinity, Infinity, oppColor, true, true, deadline);
        scored.push({ move, score });
    }
    scored.sort((a, b) => b.score - a.score);
    const best = scored[0];
    const played = scored.find(s => sameMove(s.move, gm.move)) || { move: gm.move, score: playedScore };
    let cpl = Math.max(0, best.score - played.score);
    const isBest = sameMove(best.move, gm.move) || cpl <= 30;
    if (isBest) cpl = 0;
    return { cpl, bestMove: best.move, playedScore: played.score, bestScore: best.score, isBest, isOnlyMove: moves.length === 1, isMate: false };
}

function renderAnalysisStats() {
    const el = document.getElementById("analysisPlayerStats");
    const ws = analysisResult.whiteStats, bs = analysisResult.blackStats;
    const info = [
        { key: "brilliant", icon: "!!", label: "Brilliant" }, { key: "book", icon: "📖", label: "Book" },
        { key: "best", icon: "★", label: "Best" }, { key: "great", icon: "!", label: "Great" },
        { key: "good", icon: "✓", label: "Good" }, { key: "inaccuracy", icon: "?!", label: "Inaccuracy" },
        { key: "mistake", icon: "?", label: "Mistake" }, { key: "blunder", icon: "??", label: "Blunder" }
    ];
    const row = (s) => info.map(x => `<span class="analysis-badge ${s[x.key] > 0 ? 'has-count' : ''}">${x.icon} ${s[x.key]} ${x.label}</span>`).join("");
    el.innerHTML = `<div class="analysis-player-row"><span>⚪ White</span><span class="analysis-accuracy">${ws.accuracy}%</span></div><div class="analysis-badge-row">${row(ws)}</div><div class="analysis-player-row" style="margin-top:8px;border-top:1px solid var(--border);padding-top:8px"><span>⚫ Black</span><span class="analysis-accuracy">${bs.accuracy}%</span></div><div class="analysis-badge-row">${row(bs)}</div>`;
}

function renderAnalysisMoveList() {
    const el = document.getElementById("analysisMoveList");
    const mv = analysisResult.moves;
    const icons = { book: "📖", brilliant: "!!", best: "★", great: "!", good: "✓", inaccuracy: "?!", mistake: "?", blunder: "??" };
    let html = `<div class="analysis-move-list-header"><div></div><div>White</div><div>Black</div></div>`;
    for (let i = 0; i < mv.length; i += 2) {
        const w = mv[i], b = mv[i + 1];
        html += `<div class="analysis-move-row"><div class="analysis-move-num">${Math.floor(i / 2) + 1}.</div>${cell(w)}${b ? cell(b) : '<div class="analysis-move-cell" style="opacity:.3">—</div>'}</div>`;
    }
    el.innerHTML = html;
    function cell(m) {
        return `<div class="analysis-move-cell ${m.classification}"><span class="analysis-move-icon">${icons[m.classification] || ""}</span><span class="analysis-move-san">${m.san}</span></div>`;
    }
}

function closeAnalysis() {
    document.getElementById("analysisModal").classList.remove("active");
}
window.closeAnalysis = closeAnalysis;

/* ============ VOICE / COACH CHAT ============ */
function addChat(who, text) {
    const chat = document.getElementById("chat");
    if (!chat) return;
    const m = document.createElement("div");
    m.className = "msg " + who;
    m.textContent = text;
    chat.appendChild(m);
    chat.scrollTop = chat.scrollHeight;
}

async function askCoach() {
    const inp = document.getElementById("textInput");
    if (!inp) return;
    const q = inp.value.trim();
    if (!q) return;

    addChat("user", q);
    inp.value = "";

    const chat = document.getElementById("chat");
    const pending = document.createElement("div");
    pending.className = "msg ai";
    pending.innerHTML = '<span class="thinking-spinner"></span>Thinking...';
    chat.appendChild(pending);
    chat.scrollTop = chat.scrollHeight;

    const lower = q.toLowerCase();
    if (/^(hi|hello|hey|good morning|good afternoon|good evening)[!.? ]*$/.test(lower)) {
        pending.textContent = 'Hi! Ask me about a chess position, move, or strategy.';
        return;
    }

    if (/best move|what should i|recommend|suggest/i.test(lower)) {
        const color = gameMode === "bot" ? "w" : turn;
        const moves = allLegalMoves(color, boardState, castlingRights, enPassant);
        if (moves.length) {
            const best = chooseAICoachMove(moves) || moves[0];
            setTimeout(() => {
                const reply = "🎯 I'd recommend " + squareName(best.fr, best.fc) + " → " + squareName(best.tr, best.tc) + ".";
                pending.textContent = reply;
                SFX.pronounce(reply, { lang: 'English', rate: 0.95 });
            }, 400);
            return;
        }
    }

    try {
        let boardString = "";
        for (let r = 0; r < 8; r++) {
            let empty = 0;
            for (let c = 0; c < 8; c++) {
                const p = boardState[r][c];
                if (!p) { empty++; }
                else {
                    if (empty > 0) { boardString += empty; empty = 0; }
                    boardString += p[0] === "w" ? p[1] : p[1].toLowerCase();
                }
            }
            if (empty > 0) boardString += empty;
            if (r < 7) boardString += "/";
        }

        const lastMoveStr = aiCoachLastMove ? `I just played ${aiCoachLastMove.san}.` : "We just started.";
        const fullPrompt = `You are a helpful chess coach inside a learning app. Keep answers short (1-3 sentences). 
Current board FEN: ${boardString}. Side to move: ${turn === "w" ? "White" : "Black"}. ${lastMoveStr}
User question: ${q}`;

        const res = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt: fullPrompt })
        });

        if (!res.ok) throw new Error('Network error');
        const data = await res.json();
        const reply = data.text || 'I could not generate a reply.';
        pending.textContent = reply;
        SFX.pronounce(reply, { lang: 'English', rate: 0.95 });
    } catch (err) {
        pending.textContent = '⚠️ AI is currently offline. Make sure your local server.js is running.';
    }
}
window.askCoach = askCoach;

function startVoice() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { addChat("ai", "Voice not supported."); return; }
    const rec = new SR();
    rec.lang = 'en-US';
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    const st = document.getElementById("voiceStatus");
    if (st) st.textContent = "Listening...";
    rec.onresult = (e) => {
        const inp = document.getElementById("textInput");
        if (inp) inp.value = e.results[0][0].transcript;
        askCoach();
    };
    rec.onerror = () => { if (st) st.textContent = "Ready"; };
    rec.onend = () => { if (st) st.textContent = "Ready"; };
    rec.start();
}
window.startVoice = startVoice;

let orbState = "idle", orbRecognition = null;

function orbClick() {
    if (orbState === "listening") { stopOrbListening(); return; }
    if (orbState === "thinking") return;
    startOrbListening();
}
window.orbClick = orbClick;

function startOrbListening() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { addChat("ai", "Voice not supported."); return; }
    if (orbRecognition) { try { orbRecognition.abort(); } catch (e) { } orbRecognition = null; }
    setOrbState("listening");
    orbRecognition = new SR();
    orbRecognition.lang = 'en-US';
    orbRecognition.interimResults = false;
    orbRecognition.onresult = (e) => {
        const tx = (e.results[0][0].transcript || "").trim();
        if (!tx) { setOrbState("idle"); return; }
        addChat("user", tx);
        setOrbState("thinking");
        askCoachWithText(tx).finally(() => setTimeout(() => { if (orbState === "thinking") setOrbState("idle"); }, 500));
    };
    orbRecognition.onerror = () => setOrbState("idle");
    orbRecognition.onend = () => { if (orbState === "listening") setOrbState("idle"); };
    try { orbRecognition.start(); } catch (e) { setOrbState("idle"); }
}

function stopOrbListening() {
    if (orbRecognition) { try { orbRecognition.abort(); } catch (e) { } orbRecognition = null; }
    if (orbState === "listening") setOrbState("idle");
}

function setOrbState(state) {
    orbState = state;
    const orb = document.getElementById("orb"), label = document.getElementById("orbLabel"), icon = document.getElementById("orbIcon");
    if (!orb) return;
    orb.classList.remove("listening", "thinking");
    if (state === "listening") { orb.classList.add("listening"); if (label) label.textContent = "Listening..."; if (icon) icon.textContent = "🎙️"; }
    else if (state === "thinking") { orb.classList.add("thinking"); if (label) label.textContent = "Thinking..."; if (icon) icon.textContent = "⏳"; }
    else { if (label) label.textContent = "Talk to Coach"; if (icon) icon.textContent = "🎙️"; }
}

async function askCoachWithText(q) {
    const inp = document.getElementById("textInput");
    if (inp) inp.value = q;
    await askCoach();
}

/* ============ FRIEND GAMES ============ */
const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

function serializeBoardToFen() {
    let fen = '';
    for (let r = 0; r < 8; r++) {
        let empty = 0;
        for (let c = 0; c < 8; c++) {
            const p = boardState[r][c];
            if (!p) { empty++; continue; }
            if (empty) { fen += empty; empty = 0; }
            fen += p[0] === 'w' ? p[1] : p[1].toLowerCase();
        }
        if (empty) fen += empty;
        if (r < 7) fen += '/';
    }
    fen += ' ' + turn + ' ';
    const cr = (castlingRights.wK ? 'K' : '') + (castlingRights.wQ ? 'Q' : '')
        + (castlingRights.bK ? 'k' : '') + (castlingRights.bQ ? 'q' : '');
    fen += cr || '-';
    fen += ' ' + (enPassant ? squareName(enPassant.r, enPassant.c) : '-');
    fen += ' ' + halfmoveClock + ' ' + fullmoveNumber;
    return fen;
}

function parseFen(fen) {
    const [placement, active, castling, ep, halfmove, fullmove] = String(fen).split(' ');
    const board = Array.from({ length: 8 }, () => Array(8).fill(null));
    let r = 0, c = 0;
    for (const ch of placement) {
        if (ch === '/') { r++; c = 0; continue; }
        if (/\d/.test(ch)) { c += Number(ch); continue; }
        const color = ch === ch.toUpperCase() ? 'w' : 'b';
        board[r][c] = color + ch.toUpperCase();
        c++;
    }
    const cr = {
        wK: castling.includes('K'),
        wQ: castling.includes('Q'),
        bK: castling.includes('k'),
        bQ: castling.includes('q')
    };
    const epSquare = ep && ep !== '-' ? squareFromName(ep) : null;
    return {
        board,
        turn: active,
        castling: cr,
        ep: epSquare,
        halfmoveClock: Number(halfmove) || 0,
        fullmoveNumber: Number(fullmove) || 1
    };
}

function showFriendMenu() {
    hideAllPlaySubviews();
    document.querySelector('.orb-container')?.classList.remove('game-active');
    document.getElementById("friendMenu").style.display = "block";

    const me = window.__musalingoUid;
    const friendList = document.getElementById("friendPickerList");
    const incomingEl = document.getElementById("incomingInvites");

    if (!me) {
        friendList.innerHTML = `<div class="play-mode-card disabled" style="grid-column: 1 / -1;">
            <div class="play-mode-icon">🔒</div>
            <div class="play-mode-title">Sign in required</div>
            <div class="play-mode-desc">Sign in to play with friends.</div>
            <a class="back-btn" href="signin.html" style="margin-top:12px;display:inline-block;">Sign in</a>
        </div>`;
        return;
    }

    if (!window.MF) {
        friendList.innerHTML = `<div class="play-mode-card disabled" style="grid-column: 1 / -1;">
            <div class="play-mode-title">Friend system loading…</div>
            <div class="play-mode-desc">Wait a moment and try again, or check the console for errors.</div>
        </div>`;
        return;
    }

    window.MF.loadFriendsProfiles(me).then(friends => {
        if (!friends.length) {
            friendList.innerHTML = `<div class="play-mode-card disabled" style="grid-column: 1 / -1;">
                <div class="play-mode-icon">👥</div>
                <div class="play-mode-title">No friends yet</div>
                <div class="play-mode-desc">Add friends from the Friends page first.</div>
                <a class="back-btn" href="friends.html" style="margin-top:12px;display:inline-block;">Go to Friends</a>
            </div>`;
            return;
        }

        const challengeUid = window.__challengeUid;
        friends.sort((a, b) => {
            if (a.uid === challengeUid) return -1;
            if (b.uid === challengeUid) return 1;
            return (b.streak || 0) - (a.streak || 0);
        });

        friendList.innerHTML = friends.map(f => `
            <div class="bot-card" style="--bot-color:#3b82f6" data-uid="${escapeHtml(f.uid)}">
                <div class="bot-card-top">
                    <div class="bot-icon">👤</div>
                    <span class="bot-elo">🔥 ${Number(f.streak) || 0}</span>
                </div>
                <div class="bot-title">${escapeHtml(f.name || f.email)}</div>
                <div class="bot-desc">${Number(f.streak) || 0}-day streak</div>
                <button class="bot-play-btn" data-invite="${escapeHtml(f.uid)}">Invite →</button>
            </div>
        `).join('');

        friendList.querySelectorAll('[data-invite]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                inviteFriendToChess(btn.dataset.invite);
            });
        });

        if (challengeUid && friends.some(f => f.uid === challengeUid)) {
            const friend = friends.find(f => f.uid === challengeUid);
            if (confirm(`Invite ${friend.name || friend.email} to a live chess game?`)) {
                inviteFriendToChess(challengeUid);
            }
            window.__challengeUid = null;
        }
    }).catch(err => {
        friendList.innerHTML = `<div class="play-mode-card disabled" style="grid-column: 1 / -1;">
            <div class="play-mode-title">Could not load friends</div>
            <div class="play-mode-desc">${escapeHtml(err.message || '')}</div>
        </div>`;
    });

    if (invitesUnsub) invitesUnsub();
    invitesUnsub = window.MF.listenToMyChessInvites(me, (invites) => {
        if (!invites.length) { incomingEl.innerHTML = ''; return; }
        incomingEl.innerHTML = invites.map(inv => {
            const opponent = inv.white.uid === me ? inv.black : inv.white;
            return `<div class="play-mode-card ai-coach" style="margin-bottom:10px;text-align:left;">
                <div class="play-mode-icon">♞</div>
                <div class="play-mode-title">${escapeHtml(opponent.name || opponent.email)} invited you</div>
                <div class="play-mode-desc">Live chess • accept or decline.</div>
                <div style="display:flex;gap:8px;margin-top:10px;">
                    <button class="bot-play-btn" data-accept="${inv.id}">Accept</button>
                    <button class="back-btn" data-decline="${inv.id}">Decline</button>
                </div>
            </div>`;
        }).join('');

        incomingEl.querySelectorAll('[data-accept]').forEach(b => {
            b.addEventListener('click', () => joinLiveGame(b.dataset.accept));
        });
        incomingEl.querySelectorAll('[data-decline]').forEach(b => {
            b.addEventListener('click', () => {
                window.MF.abortFriendChessGame(b.dataset.decline, me);
            });
        });
    });
}
window.showFriendMenu = showFriendMenu;

async function inviteFriendToChess(friendUid) {
    const me = window.__musalingoUid;
    if (!me || !friendUid) { alert('Could not invite.'); return; }

    let friend = null;
    try {
        friend = await window.MF.loadFriendProfile(friendUid);
    } catch (e) {
        console.warn('[matches] loadFriendProfile failed:', e);
    }
    if (!friend) { alert('Could not load that friend’s profile.'); return; }

    try {
        const gameId = await window.MF.createFriendChessGame({
            myUid: me,
            myEmail: window.__musalingoEmail || '',
            myName: window.__musalingoPlayerName || 'Player',
            friendUid: friend.uid,
            friendEmail: friend.email || '',
            friendName: friend.name || '',
            myColor: 'white',
            fen: START_FEN
        });
        liveGameId = gameId;
        myLiveColor = 'w';
        lastSeenRemoteMoveCount = 0;
        startLiveGameView();
        subscribeToLiveGame();
    } catch (err) {
        alert('Could not create game: ' + (err.message || err));
    }
}

function joinLiveGame(gameId) {
    const me = window.__musalingoUid;
    if (!me) return;
    window.MF.acceptFriendChessGame(gameId, me).then(() => {
        liveGameId = gameId;
        lastSeenRemoteMoveCount = 0;
        startLiveGameView();
        subscribeToLiveGame();
    });
}
window.joinLiveGame = joinLiveGame;

function startLiveGameView() {
    hideAllPlaySubviews();
    gameMode = 'friend';
    playerColor = myLiveColor === 'w' ? 'w' : 'b';
    flipped = myLiveColor === 'b';
    document.getElementById("gameView").style.display = "flex";
    document.getElementById("gameModeBadge").style.display = "inline-block";
    document.getElementById("gameModeBadge").textContent = '👫 Live';
    document.getElementById("playTitle").textContent = 'Play with a friend';
    document.getElementById("opponentControl").style.display = "none";
    document.getElementById("btnUndo").style.display = 'none';
    document.getElementById("btnNew").style.display = 'none';
    newGame();
    for (let i = 0; i < 10; i++) setTimeout(fitBoards, i * 100);
}

function subscribeToLiveGame() {
    if (liveUnsub) liveUnsub();
    liveUnsub = window.MF.listenToChessGame(liveGameId, (remote) => {
        if (!remote) return;
        applyRemoteGameState(remote);
    });
}

function applyRemoteGameState(remote) {
    if (remote.status === 'finished') {
        showLiveResult(remote);
        return;
    }

    const moves = remote.status === 'active' && Array.isArray(remote.moves) ? remote.moves : [];
    const hasUnseenMove = moves.length > lastSeenRemoteMoveCount;
    lastSeenRemoteMoveCount = Math.max(lastSeenRemoteMoveCount, moves.length);

    if (remote.status === 'active' && remote.fen && remote.fen !== serializeBoardToFen()) {
        const lastRemoteMove = moves[moves.length - 1];
        const lastMover = lastRemoteMove?.by;
        const myColorName = myLiveColor === 'w' ? 'white' : 'black';
        const wasMyMove = lastMover === myColorName;

        let capturedPiece = null;
        if (lastRemoteMove && lastRemoteMove.to) {
            const toSq = squareFromName(lastRemoteMove.to);
            if (toSq) capturedPiece = boardState[toSq.r][toSq.c]?.[1] || null;
        }

        const parsed = parseFen(remote.fen);
        boardState = parsed.board;
        turn = parsed.turn;
        castlingRights = parsed.castling;
        enPassant = parsed.ep;
        halfmoveClock = parsed.halfmoveClock;
        fullmoveNumber = parsed.fullmoveNumber;
        lastMove = null;

        // Keep local gameMoves in sync with the remote history so
        // post-game analysis reflects what actually happened.
        if (lastRemoteMove && hasUnseenMove) {
            const fromSq = squareFromName(lastRemoteMove.from);
            const toSq = squareFromName(lastRemoteMove.to);
            if (fromSq && toSq) {
                gameMoves.push({
                    move: {
                        fr: fromSq.r, fc: fromSq.c,
                        tr: toSq.r, tc: toSq.c,
                        piece: null,
                        captured: capturedPiece || null,
                        promotion: !!lastRemoteMove.promo
                    },
                    promo: (lastRemoteMove.promo || 'Q').toUpperCase(),
                    boardBefore: null,
                    castlingBefore: { ...castlingRights },
                    epBefore: null,
                    turnBefore: lastMover === 'white' ? 'w' : 'b',
                    san: lastRemoteMove.san || ''
                });
            }
        }

        renderBoard();
        updateLiveStatus();

        if (lastRemoteMove && !wasMyMove) {
            if (capturedPiece) SFX.captureOpponent(capturedPiece);
            else SFX.moveOpponent();
        }
    }

    if (remote.drawOfferFrom && remote.drawOfferFrom !== window.__musalingoUid && !window.__drawDialogShown) {
        window.__drawDialogShown = true;
        const accept = confirm('Your friend offered a draw. Accept?');
        if (accept) {
            window.MF.finishChessGame(liveGameId, { result: 'draw', reason: 'draw-agreed' });
            window.MF.clearChessDrawOffer(liveGameId);
        } else {
            window.MF.clearChessDrawOffer(liveGameId);
        }
        setTimeout(() => { window.__drawDialogShown = false; }, 3000);
    }
}

function updateLiveStatus() {
    if (gameMode !== 'friend') return;
    const myTurn = (myLiveColor === 'w' && turn === 'w') || (myLiveColor === 'b' && turn === 'b');
    if (gameOver) return;
    setStatus(myTurn ? 'Your turn' : "Friend's turn", myTurn ? '' : 'thinking');
}

function showLiveResult(remote) {
    if (gameOver) return;
    gameOver = true;
    const winner = remote.result;
    const iWon = (winner === 'white' && myLiveColor === 'w') || (winner === 'black' && myLiveColor === 'b');
    const isDraw = winner === 'draw';
    document.getElementById("resultIcon").textContent = isDraw ? '🤝' : (iWon ? '🏆' : '😔');
    document.getElementById("resultTitle").textContent = isDraw ? 'Draw' : (iWon ? 'You won!' : 'You lost');
    document.getElementById("resultSub").textContent =
        `${winner === 'white' ? 'White' : winner === 'black' ? 'Black' : 'Nobody'} • ${remote.resultReason || ''}`;
    document.getElementById("resultButtons").innerHTML = `
        <button class="result-btn play" onclick="backToPlayMenu();closeResultModal()">Back to menu</button>
    `;
    document.getElementById("resultModal").classList.add("active");
    showMatchReward(isDraw ? 'drawn' : iWon ? 'won' : 'lost');

    if (isDraw) { /* no sound */ }
    else if (iWon) SFX.win();
    else SFX.lose();
}

/* ============ BOOT ============ */
document.addEventListener('DOMContentLoaded', () => {
    positionHistory = [positionKey(boardState, turn, castlingRights, enPassant)];
    renderBoard();
    setTimeout(fitBoards, 300);
    setTimeout(fitBoards, 800);

    const params = new URLSearchParams(window.location.search);
    const challengeUid = params.get('challenge');
    if (challengeUid) {
        window.__challengeUid = challengeUid;
        setTimeout(() => showFriendMenu(), 100);
    }
    const gameId = params.get('game');
    if (gameId) {
        window.__joinGameId = gameId;
        setTimeout(() => joinLiveGame(gameId), 100);
    }
});
/* ============ GLOBAL HANDLERS FOR INLINE onclick ============ */
/* ES modules do not share scope with the HTML file.  Every function */
/* referenced from an onclick="..." attribute in matches.html must   */
/* be explicitly attached to window, or the click silently fails.    */
window.start1v1 = start1v1;
window.showBotMenu = showBotMenu;
window.startAICoachGame = startAICoachGame;
window.showFriendMenu = showFriendMenu;
window.startBotGame = startBotGame;
window.backToPlayMenu = backToPlayMenu;
window.newGame = newGame;
window.closeResultModal = closeResultModal;
window.startGameAnalysis = startGameAnalysis;
window.closeAnalysis = closeAnalysis;
window.askCoach = askCoach;
window.startVoice = startVoice;
window.orbClick = orbClick;
window.joinLiveGame = joinLiveGame;
window.undoMove = undoMove;
window.hintMove = hintMove;
window.resignGame = resignGame;
window.offerDraw = offerDraw;
window.setOpponent = setOpponent;
/* ============ EXTRA GLOBAL HANDLERS ============ */
window.toggleBoardFocus = function () {
    const layout = document.querySelector('.play-layout');
    const btn = document.getElementById('focusBtn');
    if (!layout) return;
    const hidden = layout.classList.toggle('panel-hidden');
    if (btn) btn.textContent = hidden ? '⛶ Show panel' : '⛶ Focus';
    // Layout animates over .18s; refit the board after it settles
    setTimeout(window.fitBoards, 50);
    setTimeout(window.fitBoards, 250);
};
