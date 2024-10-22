document.addEventListener('DOMContentLoaded', () => {
    const loginBtn = document.getElementById('loginBtn');
    const getTokenBtn = document.getElementById('getTokenBtn');
    const tokenDisplay = document.getElementById('tokenDisplay');

    // Check if we have a token in the URL (after OAuth redirect)
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');

    if (token) {
        loginBtn.classList.add('d-none');
        getTokenBtn.classList.remove('d-none');
        // Store the token securely (in this example, we're using localStorage, but in a real app, consider more secure options)
        localStorage.setItem('mcToken', token);
    }

    loginBtn.addEventListener('click', () => {
        window.location.href = 'https://dashboard-test-0y61.onrender.com/login';
    });

    getTokenBtn.addEventListener('click', () => {
        const storedToken = localStorage.getItem('mcToken');
        if (storedToken) {
            tokenDisplay.textContent = `Token: ${storedToken}`;
        } else {
            tokenDisplay.textContent = 'No token found. Please login again.';
        }
    });
});
