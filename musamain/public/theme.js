(function applySavedTheme() {
    const root = document.documentElement;
    const systemTheme = window.matchMedia('(prefers-color-scheme: dark)');
    let themeSettings = {};

    function readSettings() {
        try {
            const settings = JSON.parse(localStorage.getItem('MusalingoSettings') || '{}');
            return settings && typeof settings === 'object' && !Array.isArray(settings) ? settings : {};
        } catch (error) {
            console.warn('[theme.js] Corrupted settings, using defaults.', error);
            return {};
        }
    }

    function darkenAccent(hex, amount) {
        if (!/^#[0-9a-f]{6}$/i.test(hex)) return '#bd78a0';
        const channels = [1, 3, 5].map(index =>
            Math.max(0, Math.min(255, Math.round(parseInt(hex.slice(index, index + 2), 16) * (1 - amount))))
        );
        return `#${channels.map(channel => channel.toString(16).padStart(2, '0')).join('')}`;
    }

    function applyTheme() {
        const darkMode = themeSettings.theme === 'dark'
            || (themeSettings.theme === 'system' && systemTheme.matches);
        const accent = /^#[0-9a-f]{6}$/i.test(themeSettings.accent || '') ? themeSettings.accent : '#EC96C7';
        const shadowColor = /^#[0-9a-f]{6}$/i.test(themeSettings.shadow || '')
            ? themeSettings.shadow
            : darkenAccent(accent, 0.2);

        root.style.setProperty('--accent', accent);
        root.style.setProperty('--accent-dark', darkenAccent(accent, 0.2));
        root.style.setProperty('--accent-shadow', shadowColor);
        root.style.setProperty('--accent-soft', 'color-mix(in srgb, var(--accent) 20%, white)');
        root.style.setProperty('--bg', darkMode ? '#111827' : '#f7f8fc');
        root.style.setProperty('--card', darkMode ? '#1f2937' : '#ffffff');
        root.style.setProperty('--panel', darkMode ? '#1f2937' : '#ffffff');
        root.style.setProperty('--panel-2', darkMode ? '#273449' : '#f3f6fb');
        root.style.setProperty('--text', darkMode ? '#e5e7eb' : '#1f2937');
        root.style.setProperty('--muted', darkMode ? '#aeb9ca' : '#6b7280');
        root.style.setProperty('--border', darkMode ? '#374151' : '#e5e7eb');
        root.style.colorScheme = darkMode ? 'dark' : 'light';

        if (document.body) {
            document.body.classList.toggle('dark-mode', darkMode);
            document.body.classList.toggle('light-mode', !darkMode);
            document.body.style.backgroundColor = darkMode ? '#111827' : '';
            document.body.style.backgroundImage = darkMode ? 'none' : '';
        }
    }

    themeSettings = readSettings();
    applyTheme();

    const handleSystemThemeChange = () => {
        if (themeSettings.theme === 'system') applyTheme();
    };
    if (systemTheme.addEventListener) systemTheme.addEventListener('change', handleSystemThemeChange);
    else systemTheme.addListener(handleSystemThemeChange);

    window.addEventListener('storage', event => {
        if (event.key === 'MusalingoSettings') {
            themeSettings = readSettings();
            applyTheme();
        }
    });
})();
