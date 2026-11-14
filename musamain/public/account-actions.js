function updateAccountActions() {
    const signedIn = localStorage.getItem('MusalingoLoggedIn') === 'true'
        && localStorage.getItem('MusalingoGuest') !== 'true';
    const signInButtons = document.querySelectorAll('[data-account-sign-in]');
    const signOutButtons = document.querySelectorAll('[data-account-sign-out]');
    const status = document.querySelector('[data-account-status]');

    signInButtons.forEach(button => { button.hidden = signedIn; });
    signOutButtons.forEach(button => { button.hidden = !signedIn; });

    if (status) {
        status.textContent = signedIn
            ? `Signed in as ${localStorage.getItem('MusalingoUser') || 'your account'}`
            : 'Using a local account on this device';
    }
}

document.querySelectorAll('[data-account-sign-out]').forEach(button => {
    button.addEventListener('click', async () => {
        if (!window.confirm(
            'Sign out of your account?\n\nYour progress will remain on this device and will stop syncing until you sign in again.'
        )) return;

        button.disabled = true;
        const message = document.querySelector('[data-account-message]');

        try {
            const [{ app, setGuestMode }, { getAuth, signOut }] = await Promise.all([
                import('./firebase.js'),
                import('https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js')
            ]);
            const auth = getAuth(app);
            if (auth.currentUser) await signOut(auth);
            setGuestMode();
            updateAccountActions();
            if (message) message.textContent = 'Signed out. Your progress remains saved on this device.';
        } catch (error) {
            if (message) message.textContent = `Could not sign out: ${error.message || 'Please try again.'}`;
            else console.error('[account] Could not sign out:', error);
        } finally {
            button.disabled = false;
        }
    });
});

updateAccountActions();
