/* ============================================================
   Musalingo — PWA bootstrap
   - Registers the service worker
   - Handles the "Install app" prompt (beforeinstallprompt)
   - Shows a floating online/offline indicator in the corner
   Load once per page with: <script src="pwa.js" defer></script>
   ============================================================ */

(function bootstrapPWA() {
    // ---------- 1. SERVICE WORKER ----------
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('/sw.js')
                .then((reg) => console.log('[pwa] sw registered:', reg.scope))
                .catch((err) => console.warn('[pwa] sw registration failed:', err));
        });
    }

    // ---------- 2. INSTALL PROMPT ----------
    // Any element with id="installAppBtn" becomes the install trigger.
    let deferredPrompt = null;
    let installBtn = null;

    function findInstallBtn() {
        installBtn = document.getElementById('installAppBtn');
        return installBtn;
    }

    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt = e;
        const btn = findInstallBtn();
        if (btn) btn.hidden = false;
    });

    // Use event delegation so the button can appear at any time
    document.addEventListener('click', async (e) => {
        const btn = e.target.closest('#installAppBtn');
        if (!btn) return;
        if (!deferredPrompt) return;
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        console.log('[pwa] install outcome:', outcome);
        deferredPrompt = null;
        btn.hidden = true;
    });

    window.addEventListener('appinstalled', () => {
        console.log('[pwa] app installed');
        const btn = findInstallBtn();
        if (btn) btn.hidden = true;
    });

    // ---------- 3. ONLINE / OFFLINE INDICATOR ----------
    // Only rendered on pages that opt in via <body data-pwa-status="true">.
    // If not opted in, the indicator is skipped.
    function createStatusDot() {
        if (document.getElementById('pwaStatusDot')) return;

        const dot = document.createElement('div');
        dot.id = 'pwaStatusDot';
        dot.setAttribute('role', 'status');
        dot.setAttribute('aria-live', 'polite');
        dot.style.cssText = `
            position: fixed;
            bottom: 16px;
            right: 16px;
            width: 12px;
            height: 12px;
            border-radius: 50%;
            background: #22c55e;
            box-shadow: 0 0 0 4px rgba(34, 197, 94, 0.2);
            z-index: 9999;
            transition: background 0.3s ease, box-shadow 0.3s ease;
            pointer-events: none;
        `;
        document.body.appendChild(dot);

        const updateDot = () => {
            const online = navigator.onLine;
            dot.style.background = online ? '#22c55e' : '#ef4444';
            dot.style.boxShadow = online
                ? '0 0 0 4px rgba(34, 197, 94, 0.2)'
                : '0 0 0 4px rgba(239, 68, 68, 0.2)';
            dot.title = online ? 'Online' : 'Offline';
            dot.setAttribute('aria-label', online ? 'Online' : 'Offline');
        };

        window.addEventListener('online', updateDot);
        window.addEventListener('offline', updateDot);
        updateDot();
    }

    // Only render the dot if the page opts in
    if (document.body) {
        if (document.body.dataset.pwaStatus === 'true') {
            createStatusDot();
        }
    } else {
        document.addEventListener('DOMContentLoaded', () => {
            if (document.body.dataset.pwaStatus === 'true') {
                createStatusDot();
            }
        });
    }
})();