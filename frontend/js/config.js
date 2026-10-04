/**
 * JhazTaxi - Centralized Configuration
 * Switch easily between local development and production (e.g. Render).
 */
const isIndependentFrontend = (
    window.location.hostname !== 'localhost' &&
    window.location.hostname !== '127.0.0.1' &&
    window.location.hostname.includes('vercel.app')
);

const CONFIG = {
    // Backend API Base URL
    // Single-Origin on Render: uses relative '/api' for 100% zero-config single URL!
    // Vercel separate frontend: falls back to Render backend
    // Live Server (port 5500): falls back to local port 8000
    API_BASE_URL: localStorage.getItem('JHAZTAXI_API_URL') || (
        isIndependentFrontend
            ? 'https://jhaztaxi.onrender.com/api'
            : (window.location.port === '5500' ? 'http://127.0.0.1:8000/api' : '/api')
    ),

    // App Branding
    APP_NAME: 'Jhaz 1 Way Taxi',
    TAGLINE: 'Your Ride, Your Way.',
    CURRENCY_SYMBOL: '₹',

    // Map Defaults (Tirunelveli / Tamil Nadu coordinates)
    MAP_DEFAULT_CENTER: [8.7139, 77.7567],
    MAP_DEFAULT_ZOOM: 12,

    // Map Tile Configuration (OpenStreetMap France - 100% Free, NO API Key Needed, NEVER blocked on Render/Vercel)
    MAP_TILE_URL: 'https://{s}.tile.openstreetmap.fr/osmfr/{z}/{x}/{y}.png',
    MAP_TILE_SUBDOMAINS: ['a', 'b', 'c'],
    MAP_ATTRIBUTION: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, <a href="https://openstreetmap.fr">OSM France</a>',

    // Routing & Geocoding Services
    OSRM_ROUTING_URL: 'https://router.project-osrm.org/route/v1/driving/',
    PHOTON_SEARCH_URL: 'https://photon.komoot.io/api/',
    PHOTON_REVERSE_URL: 'https://photon.komoot.io/reverse',
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
