/* ============================================================
   Musalingo — sounds.js (v3)
   Centralized sound engine for the whole app.

   - Synthesized SFX via Web Audio API (no audio files needed)
   - Text-to-speech via the same-origin Google TTS proxy with Web Speech fallback
   - One shared AudioContext, unlocked on first user gesture
   - Respects localStorage "sound" setting

   Fixes vs v2:
     • Remote TTS timeout reduced 8s → 2.5s
     • Remote TTS disabled after 3 consecutive failures (session-only)
     • Timer cleared on audio.onplaying (fixes long-audio double-speak)
     • Unknown languages default to en-US (chess/math/music fixed)
     • Web Speech voices preloaded on init
     • Top-level try/catch installs no-op fallback if bootstrap fails

   Include on every page:
       <script src="sounds.js"></script>

   API (window.SFX):
       SFX.correct() / wrong() / complete()
       SFX.move() / tap() / moveOpponent() / captureOpponent(piece)
       SFX.capturePawn() / captureMinor() / captureRook() / captureQueen()
       SFX.capture(piece) / check() / win() / lose()
       SFX.error() / click() / heartsLost() / gemEarned()

       SFX.pronounce(text, { lang, rate })  -- speak text aloud
       SFX.cancelSpeech()
       SFX.unlock()

   Utility:
       SFX.isEnabled()                  -- true if user hasn't muted
       SFX.isRemoteTtsAvailable()       -- true if remote TTS is being used
       SFX.enableRemoteTts()            -- manually re-enable remote TTS
   ============================================================ */

(function bootstrapSounds() {
    'use strict';

    // ── Install no-op fallback FIRST so if anything throws, pages still work ──
    const FALLBACK_METHODS = [
        'correct', 'wrong', 'complete', 'move', 'tap', 'moveOpponent', 'captureOpponent',
        'capturePawn', 'captureMinor', 'captureRook', 'captureQueen', 'capture',
        'check', 'win', 'lose', 'error', 'click', 'heartsLost', 'gemEarned',
        'pronounce', 'cancelSpeech', 'unlock', 'isEnabled',
        'isRemoteTtsAvailable', 'enableRemoteTts'
    ];
    const makeFallback = () => {
        const fb = {};
        FALLBACK_METHODS.forEach(name => { fb[name] = () => false; });
        return fb;
    };

    try {
        /* ============ AUDIO CONTEXT ============ */

        let audioCtx = null;
        let unlockListenersAttached = false;

        function ctx() {
            if (!audioCtx) {
                try {
                    const Ctx = window.AudioContext || window.webkitAudioContext;
                    if (!Ctx) return null;
                    audioCtx = new Ctx();
                } catch (e) {
                    console.warn('[sounds] AudioContext unavailable:', e);
                    return null;
                }
            }
            return audioCtx;
        }

        function unlock() {
            const c = ctx();
            if (!c) return Promise.resolve(false);
            if (c.state === 'running') return Promise.resolve(true);
            if ('speechSynthesis' in window) {
                try { window.speechSynthesis.speak(new SpeechSynthesisUtterance('')); } catch (e) { /* ignore */ }
            }
            try {
                return c.resume().then(() => {
                    const ok = c.state === 'running';
                    if (!ok) attachUnlockListeners();
                    return ok;
                }).catch(() => {
                    attachUnlockListeners();
                    return false;
                });
            } catch (e) {
                attachUnlockListeners();
                return Promise.resolve(false);
            }
        }

        function attachUnlockListeners() {
            if (unlockListenersAttached) return;
            unlockListenersAttached = true;
            const handler = () => {
                unlockListenersAttached = false;
                unlock();
                document.removeEventListener('touchstart', handler);
                document.removeEventListener('click', handler);
                document.removeEventListener('keydown', handler);
            };
            document.addEventListener('touchstart', handler, { passive: true, once: true });
            document.addEventListener('click', handler, { passive: true, once: true });
            document.addEventListener('keydown', handler, { passive: true, once: true });
        }

        /* ============ MUTE CHECK ============ */

        function isEnabled() {
            try {
                const app = JSON.parse(localStorage.getItem('MusalingoAppSettings') || '{}');
                if (app && app.sound === false) return false;
                const main = JSON.parse(localStorage.getItem('MusalingoSettings') || '{}');
                if (main && main.sound === false) return false;
            } catch (e) { /* ignore */ }
            return true;
        }

        /* ============ SYNTH HELPERS ============ */

        function note(freq, duration, type, volume, delay, slideTo, lowPass) {
            const c = ctx();
            if (!c) return;
            try {
                const start = c.currentTime + (delay || 0);
                const osc = c.createOscillator();
                const gain = c.createGain();
                if (lowPass) {
                    const filter = c.createBiquadFilter();
                    filter.type = 'lowpass';
                    filter.frequency.setValueAtTime(lowPass, start);
                    osc.connect(filter);
                    filter.connect(gain);
                } else {
                    osc.connect(gain);
                }
                gain.connect(c.destination);
                osc.type = type || 'sine';
                osc.frequency.setValueAtTime(freq, start);
                if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), start + duration);
                gain.gain.setValueAtTime(0.0001, start);
                gain.gain.exponentialRampToValueAtTime(volume || 0.2, start + 0.01);
                gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
                osc.start(start);
                osc.stop(start + duration + 0.02);
            } catch (e) { /* silent */ }
        }

        function sequence(notes, gap) {
            notes.forEach((n, i) => {
                note(n.freq, n.dur, n.type || 'sine', n.vol != null ? n.vol : 0.22, i * (gap || 0.1));
            });
        }

        /* ============ SFX DEFINITIONS ============ */

        const SFX = {};

        SFX.isEnabled = isEnabled;
        SFX.unlock = unlock;

        SFX.correct = function () {
            if (!isEnabled()) return;
            note(523.25, 0.19, 'sine', 0.28, 0);
            note(659.25, 0.19, 'sine', 0.25, 0.13);
        };

        SFX.wrong = function () {
            if (!isEnabled()) return;
            note(622, 0.16, 'sawtooth', 0.12, 0, undefined, 1600);
            note(415, 0.68, 'sawtooth', 0.10, 0.12, undefined, 1600);
        };

        SFX.complete = function () {
            if (!isEnabled()) return;
            sequence([
                { freq: 523.25, dur: 0.18, vol: 0.22 },
                { freq: 659.25, dur: 0.18, vol: 0.22 },
                { freq: 783.99, dur: 0.18, vol: 0.22 },
                { freq: 1046.50, dur: 0.28, vol: 0.25 }
            ], 0.11);
        };

        SFX.move = function () {
            if (!isEnabled()) return;
            note(440, 0.05, 'triangle', 0.14, 0);
        };

        SFX.tap = function () {
            if (!isEnabled()) return;
            note(600, 0.03, 'sine', 0.08, 0);
        };

        SFX.moveOpponent = function () {
            if (!isEnabled()) return;
            note(311.13, 0.06, 'triangle', 0.12, 0);
        };

        SFX.captureOpponent = function (piece) {
            if (!isEnabled()) return;
            const p = String(piece || '').toUpperCase();
            let freq;
            if (p === 'P') freq = 220;
            else if (p === 'N' || p === 'B') freq = 293.66;
            else if (p === 'R') freq = 392;
            else if (p === 'Q') freq = 523.25;
            else freq = 293.66;
            note(freq, 0.09, 'triangle', 0.16, 0, freq * 0.85);
        };

        SFX.capturePawn = function () {
            if (!isEnabled()) return;
            note(330, 0.10, 'triangle', 0.20, 0);
        };

        SFX.captureMinor = function () {
            if (!isEnabled()) return;
            note(440, 0.11, 'triangle', 0.22, 0);
        };

        SFX.captureRook = function () {
            if (!isEnabled()) return;
            note(587.33, 0.12, 'triangle', 0.24, 0);
        };

        SFX.captureQueen = function () {
            if (!isEnabled()) return;
            note(783.99, 0.13, 'triangle', 0.26, 0);
        };

        SFX.capture = function (piece) {
            if (!isEnabled()) return;
            const p = String(piece || '').toUpperCase();
            if (p === 'P') return SFX.capturePawn();
            if (p === 'N' || p === 'B') return SFX.captureMinor();
            if (p === 'R') return SFX.captureRook();
            if (p === 'Q') return SFX.captureQueen();
            return SFX.captureMinor();
        };

        SFX.check = function () {
            if (!isEnabled()) return;
            note(880, 0.08, 'sine', 0.24, 0);
            note(660, 0.12, 'sine', 0.2, 0.1);
        };

        SFX.win = function () {
            if (!isEnabled()) return;
            sequence([
                { freq: 523.25, dur: 0.14, vol: 0.22 },
                { freq: 659.25, dur: 0.14, vol: 0.22 },
                { freq: 783.99, dur: 0.14, vol: 0.22 },
                { freq: 1046.50, dur: 0.35, vol: 0.26 }
            ], 0.1);
        };

        SFX.lose = function () {
            if (!isEnabled()) return;
            note(330, 0.25, 'sawtooth', 0.16, 0);
            note(220, 0.35, 'sawtooth', 0.16, 0.22);
        };

        SFX.error = function () {
            if (!isEnabled()) return;
            note(300, 0.2, 'sawtooth', 0.16, 0);
        };

        SFX.click = function () {
            if (!isEnabled()) return;
            note(600, 0.03, 'sine', 0.08, 0);
        };

        SFX.heartsLost = function () {
            if (!isEnabled()) return;
            note(440, 0.12, 'sine', 0.15, 0);
            note(330, 0.2, 'sine', 0.15, 0.12);
        };

        SFX.gemEarned = function () {
            if (!isEnabled()) return;
            note(1200, 0.08, 'sine', 0.16, 0);
            note(1600, 0.1, 'sine', 0.14, 0.06);
            note(2000, 0.15, 'sine', 0.12, 0.12);
        };

        /* ============ TEXT-TO-SPEECH ============ */

        const SPEECH_LANGUAGES = {
            english: ['en', 'en-US'], en: ['en', 'en-US'],
            spanish: ['es', 'es-ES'], es: ['es', 'es-ES'],
            french: ['fr', 'fr-FR'], fr: ['fr', 'fr-FR'],
            german: ['de', 'de-DE'], de: ['de', 'de-DE'],
            italian: ['it', 'it-IT'], it: ['it', 'it-IT'],
            'intermediate english': ['en', 'en-GB'],
            japanese: ['ja', 'ja-JP'], ja: ['ja', 'ja-JP'],
            hindi: ['hi', 'hi-IN'], hi: ['hi', 'hi-IN'],
            telugu: ['te', 'te-IN'], te: ['te', 'te-IN'],
            arabic: ['ar', 'ar-SA'], ar: ['ar', 'ar-SA'],
            korean: ['ko', 'ko-KR'], ko: ['ko', 'ko-KR'],
            chinese: ['zh-CN', 'zh-CN'], zh: ['zh-CN', 'zh-CN'], 'zh-tw': ['zh-TW', 'zh-TW'],
            'chinese-traditional': ['zh-TW', 'zh-TW'],
            portuguese: ['pt', 'pt-BR'], pt: ['pt', 'pt-BR'],
            russian: ['ru', 'ru-RU'], ru: ['ru', 'ru-RU'],
            turkish: ['tr', 'tr-TR'], tr: ['tr', 'tr-TR'],
            bengali: ['bn', 'bn-IN'], bangla: ['bn', 'bn-IN'], bn: ['bn', 'bn-IN'],
            gujarati: ['gu', 'gu-IN'], gu: ['gu', 'gu-IN'],
            kannada: ['kn', 'kn-IN'], kn: ['kn', 'kn-IN'],
            malayalam: ['ml', 'ml-IN'], ml: ['ml', 'ml-IN'],
            marathi: ['mr', 'mr-IN'], mr: ['mr', 'mr-IN'],
            nepali: ['ne', 'ne-NP'], ne: ['ne', 'ne-NP'],
            punjabi: ['pa', 'pa-IN'], pa: ['pa', 'pa-IN'],
            odia: ['or', 'or-IN'], oriya: ['or', 'or-IN'], or: ['or', 'or-IN'],
            assamese: ['as', 'as-IN'], as: ['as', 'as-IN'],
            latin: ['la', 'la'], la: ['la', 'la'],
            tamil: ['ta', 'ta-IN'], ta: ['ta', 'ta-IN'],
            urdu: ['ur', 'ur-PK'], ur: ['ur', 'ur-PK'],
            sinhala: ['si', 'si-LK'], si: ['si', 'si-LK'],
            thai: ['th', 'th-TH'], th: ['th', 'th-TH'],
            vietnamese: ['vi', 'vi-VN'], vi: ['vi', 'vi-VN'],
            indonesian: ['id', 'id-ID'], id: ['id', 'id-ID'],
            dutch: ['nl', 'nl-NL'], nl: ['nl', 'nl-NL'],
            polish: ['pl', 'pl-PL'], pl: ['pl', 'pl-PL'],
            ukrainian: ['uk', 'uk-UA'], uk: ['uk', 'uk-UA'],
            greek: ['el', 'el-GR'], el: ['el', 'el-GR'],
            hebrew: ['he', 'he-IL'], he: ['he', 'he-IL'],
            persian: ['fa', 'fa-IR'], farsi: ['fa', 'fa-IR'], fa: ['fa', 'fa-IR'],
            swahili: ['sw', 'sw-KE'], sw: ['sw', 'sw-KE'],
            filipino: ['tl', 'fil-PH'], tagalog: ['tl', 'fil-PH'], fil: ['tl', 'fil-PH'], tl: ['tl', 'fil-PH'],
            burmese: ['my', 'my-MM'], myanmar: ['my', 'my-MM'], my: ['my', 'my-MM'],
            // Skill paths speak in English
            chess: ['en', 'en-US'], math: ['en', 'en-US'], music: ['en', 'en-US']
        };

        function getSpeechLanguage(language) {
            const normalized = String(language || 'English').trim().toLowerCase().replace(/_/g, '-');
            const exact = SPEECH_LANGUAGES[normalized];
            const base = SPEECH_LANGUAGES[normalized.split('-')[0]];
            const config = exact || base;
            if (config) return { remote: config[0], locale: config[1] };
            // Unknown → English, never an invalid BCP-47 tag
            return { remote: null, locale: 'en-US' };
        }

        let currentAudio = null;
        let remoteSpeechTimer = null;

        // Remote TTS availability tracking (session-only)
        let remoteTtsFailures = 0;
        const MAX_REMOTE_FAILURES = 3;
        let remoteTtsDisabled = false;

        function isRemoteTtsAvailable() {
            return !remoteTtsDisabled && navigator.onLine !== false;
        }

        function enableRemoteTts() {
            remoteTtsDisabled = false;
            remoteTtsFailures = 0;
            console.info('[SFX] Remote TTS re-enabled');
        }

        function markRemoteTtsFailure() {
            remoteTtsFailures += 1;
            if (remoteTtsFailures >= MAX_REMOTE_FAILURES && !remoteTtsDisabled) {
                remoteTtsDisabled = true;
                console.warn('[SFX] Remote TTS disabled for this session after ' + MAX_REMOTE_FAILURES + ' failures; using Web Speech only.');
            }
        }

        function cancelSpeech() {
            if (remoteSpeechTimer) {
                clearTimeout(remoteSpeechTimer);
                remoteSpeechTimer = null;
            }
            try {
                if (currentAudio) { currentAudio.pause(); currentAudio = null; }
            } catch (e) { /* ignore */ }
            try {
                if ('speechSynthesis' in window) window.speechSynthesis.cancel();
            } catch (e) { /* ignore */ }
        }

        function speakLocal(text, lang, rate) {
            if (!('speechSynthesis' in window)) return false;
            try {
                window.speechSynthesis.cancel();
                window.speechSynthesis.resume();
                const u = new SpeechSynthesisUtterance(text);
                u.lang = lang;
                u.rate = rate;
                const voices = window.speechSynthesis.getVoices();
                const languageCode = lang.toLowerCase().split('-')[0];
                const matchingVoice = voices.find(v => v.lang.toLowerCase() === lang.toLowerCase())
                    || voices.find(v => v.lang.toLowerCase().split('-')[0] === languageCode);
                if (matchingVoice) u.voice = matchingVoice;
                window.speechSynthesis.speak(u);
                return true;
            } catch (e) {
                return false;
            }
        }

        function splitSpeechText(text, maxLength = 180) {
            const remaining = Array.from(text);
            const chunks = [];
            while (remaining.length > maxLength) {
                let splitAt = maxLength;
                for (let i = maxLength - 1; i >= Math.floor(maxLength * 0.6); i--) {
                    if (/[\s,，.!?。;；:：、]/u.test(remaining[i])) {
                        splitAt = i + 1;
                        break;
                    }
                }
                chunks.push(remaining.splice(0, splitAt).join('').trim());
                while (remaining[0] && /\s/u.test(remaining[0])) remaining.shift();
            }
            if (remaining.length) chunks.push(remaining.join('').trim());
            return chunks.filter(Boolean);
        }

        SFX.pronounce = function (text, opts) {
            const clean = String(text || '').trim();
            if (!clean) return false;
            if (!isEnabled()) return false;

            const options = opts || {};
            const { remote: remoteLang, locale: bcp47 } = getSpeechLanguage(options.lang);
            const rate = typeof options.rate === 'number' ? options.rate : 0.85;

            cancelSpeech();

            // Try remote TTS only if endpoint hasn't failed repeatedly
            if (remoteLang && isRemoteTtsAvailable()) {
                try {
                    const chunks = splitSpeechText(clean);

                    function playChunk(index) {
                        const audio = new Audio('/api/tts?lang=' + encodeURIComponent(remoteLang) + '&text=' + encodeURIComponent(chunks[index]));
                        audio.playbackRate = rate;
                        currentAudio = audio;
                        let fallbackStarted = false;

                        const cleanupTimer = () => {
                            if (remoteSpeechTimer) {
                                clearTimeout(remoteSpeechTimer);
                                remoteSpeechTimer = null;
                            }
                        };

                        const fallbackToLocal = () => {
                            if (fallbackStarted || currentAudio !== audio) return;
                            fallbackStarted = true;
                            cleanupTimer();
                            markRemoteTtsFailure();
                            try { audio.pause(); } catch (err) { /* ignore */ }
                            currentAudio = null;
                            audio.onerror = null;
                            audio.onplaying = null;
                            audio.onended = null;
                            speakLocal(clean, bcp47, rate);
                        };

                        audio.onerror = fallbackToLocal;
                        // Audio actually started playing — clear the pre-load timeout so long
                        // chunks don't get double-spoken by the local fallback.
                        audio.onplaying = cleanupTimer;
                        audio.onended = () => {
                            if (currentAudio !== audio) return;
                            cleanupTimer();
                            if (index + 1 < chunks.length) playChunk(index + 1);
                            else currentAudio = null;
                        };

                        // Only hang for 2.5s on load — enough for a small MP3, short enough
                        // to not block the UI if /api/tts doesn't exist.
                        remoteSpeechTimer = setTimeout(fallbackToLocal, 2500);

                        try {
                            const p = audio.play();
                            if (p && p.catch) p.catch(fallbackToLocal);
                        } catch (e) {
                            fallbackToLocal();
                        }
                    }
                    playChunk(0);
                    return true;
                } catch (e) {
                    // Fall through to local
                }
            }

            return speakLocal(clean, bcp47, rate);
        };

        SFX.cancelSpeech = cancelSpeech;
        SFX.isRemoteTtsAvailable = isRemoteTtsAvailable;
        SFX.enableRemoteTts = enableRemoteTts;

        /* ============ VOICE PRELOAD ============ */

        if ('speechSynthesis' in window) {
            try {
                // Chrome loads voices asynchronously; calling getVoices() here warms them up
                window.speechSynthesis.getVoices();
                if (window.speechSynthesis.addEventListener) {
                    window.speechSynthesis.addEventListener('voiceschanged', () => {
                        window.speechSynthesis.getVoices();
                    });
                }
            } catch (e) { /* ignore */ }
        }

        /* ============ AUTO-INSTALL ============ */

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', attachUnlockListeners, { once: true });
        } else {
            attachUnlockListeners();
        }

        window.addEventListener('pagehide', () => {
            cancelSpeech();
        });

        window.SFX = SFX;
    } catch (err) {
        console.error('[sounds] Bootstrap failed — installing no-op SFX fallback:', err);
        window.SFX = makeFallback();
    }
})();