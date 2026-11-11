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
    let deferredPrompt = null;

    function isInstalled() {
        return window.matchMedia('(display-mode: standalone)').matches
            || navigator.standalone === true;
    }

    function setInstallButtonsVisible(visible) {
        document.querySelectorAll('#installAppBtn, [data-install-app]').forEach((button) => {
            button.hidden = !visible;
        });
    }

    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt = e;
        setInstallButtonsVisible(!isInstalled());
    });

    document.addEventListener('click', async (e) => {
        const target = e.target;
        const btn = target instanceof Element
            ? target.closest('#installAppBtn, [data-install-app]')
            : null;
        if (!btn) return;
        if (!deferredPrompt) return;
        const promptEvent = deferredPrompt;
        deferredPrompt = null;
        btn.disabled = true;
        try {
            await promptEvent.prompt();
            const { outcome } = await promptEvent.userChoice;
            console.log('[pwa] install outcome:', outcome);
        } catch (err) {
            console.warn('[pwa] install prompt failed:', err);
        } finally {
            setInstallButtonsVisible(false);
            btn.disabled = false;
        }
    });

    window.addEventListener('appinstalled', () => {
        console.log('[pwa] app installed');
        deferredPrompt = null;
        setInstallButtonsVisible(false);
    });

    if (isInstalled()) setInstallButtonsVisible(false);

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