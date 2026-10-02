/**
 * JhazTaxi - Centralized Configuration
 * Switch easily between local development and production (e.g. Render).
 */
const CONFIG = {
    // Backend API Base URL
    // Defaults to local Django server during development, or change to Render production URL
    API_BASE_URL: localStorage.getItem('JHAZTAXI_API_URL') || (
        (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
            ? 'http://127.0.0.1:8000/api'
            : 'https://jhaztaxi-backend.onrender.com/api'
    ),

    // App Branding
    APP_NAME: 'JhazTaxi',
    TAGLINE: 'Your Ride, Your Way.',
    CURRENCY_SYMBOL: '₹',

    // Map Defaults (Bengaluru / India coordinates default)
    MAP_DEFAULT_CENTER: [12.9716, 77.5946],
    MAP_DEFAULT_ZOOM: 12,

    // Routing Service (OSRM Public API with fallback calculation)
    OSRM_ROUTING_URL: 'https://router.project-osrm.org/route/v1/driving/',
    NOMINATIM_SEARCH_URL: 'https://nominatim.openstreetmap.org/search',
};

// Global helper to get stored auth token
function getAuthToken() {
    return localStorage.getItem('jhaztaxi_token');
}

// Global helper to get current logged in user
function getCurrentUser() {
    const userStr = localStorage.getItem('jhaztaxi_user');
    try {
        return userStr ? JSON.parse(userStr) : null;
    } catch (e) {
        return null;
    }
}

// Global helper to save session
function setAuthSession(token, user) {
    localStorage.setItem('jhaztaxi_token', token);
    localStorage.setItem('jhaztaxi_user', JSON.stringify(user));
}

// Global helper to clear session
function clearAuthSession() {
    localStorage.removeItem('jhaztaxi_token');
    localStorage.removeItem('jhaztaxi_user');
}

// Toast notification helper
function showToast(message, type = 'info') {
    let container = document.getElementById('jhaztaxi-toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'jhaztaxi-toast-container';
        container.className = 'toast-container position-fixed top-0 end-0 p-3';
        container.style.zIndex = '9999';
        document.body.appendChild(container);
    }

    const toastId = 'toast-' + Date.now();
    const bgClass = type === 'success' ? 'bg-success text-white' :
                    type === 'error' ? 'bg-danger text-white' :
                    type === 'warning' ? 'bg-warning text-dark' : 'bg-dark text-white';

    const toastHtml = `
        <div id="${toastId}" class="toast align-items-center ${bgClass} border-0 shadow-lg" role="alert" aria-live="assertive" aria-atomic="true">
            <div class="d-flex">
                <div class="toast-body d-flex align-items-center gap-2">
                    <i class="bi ${type === 'success' ? 'bi-check-circle-fill' : type === 'error' ? 'bi-exclamation-triangle-fill' : 'bi-info-circle-fill'}"></i>
                    <span>${message}</span>
                </div>
                <button type="button" class="btn-close ${type !== 'warning' ? 'btn-close-white' : ''} me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
            </div>
        </div>
    `;

    container.insertAdjacentHTML('beforeend', toastHtml);
    const toastEl = document.getElementById(toastId);
    if (window.bootstrap && window.bootstrap.Toast) {
        const toast = new bootstrap.Toast(toastEl, { delay: 4500 });
        toast.show();
        toastEl.addEventListener('hidden.bs.toast', () => toastEl.remove());
    } else {
        setTimeout(() => toastEl.remove(), 4500);
    }
}
