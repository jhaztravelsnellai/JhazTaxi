/**
 * JhazTaxi - Main UI & Network Utility Script
 */

document.addEventListener('DOMContentLoaded', () => {
    updateNavbarAuthState();
    setupFooterYear();
});

// Helper for authenticated API calls
async function fetchWithAuth(url, options = {}) {
    const token = getAuthToken();
    const headers = { ...(options.headers || {}) };

    if (!(options.body instanceof FormData) && !headers['Content-Type']) {
        headers['Content-Type'] = 'application/json';
    }

    if (token) {
        headers['Authorization'] = `Token ${token}`;
    }

    try {
        const response = await fetch(url, { ...options, headers });
        const data = await response.json().catch(() => ({}));

        if (response.status === 401) {
            // Token expired or invalid
            clearAuthSession();
            // Don't auto-redirect if already on public pages
            const path = window.location.pathname;
            if (path.includes('/user/') || path.includes('/admin/')) {
                window.location.href = path.includes('/admin/') ? '/admin/login.html' : '/login.html';
            }
        }

        return { ok: response.ok, status: response.status, data };
    } catch (err) {
        console.error('API Fetch Error:', err);
        return {
            ok: false,
            status: 0,
            data: { success: false, message: 'Unable to connect to JhazTaxi server. Ensure the backend is running.' }
        };
    }
}

// Dynamically updates navbar buttons based on login status
function updateNavbarAuthState() {
    const user = getCurrentUser();
    const token = getAuthToken();
    const navAuthContainer = document.getElementById('navbar-auth-section');

    if (!navAuthContainer) return;

    if (token && user) {
        let dashboardLink = '/user/dashboard.html';
        let roleLinks = `
            <li><a class="dropdown-item" href="/user/bookings.html"><i class="bi bi-calendar-check me-2"></i>My Bookings</a></li>
            <li><a class="dropdown-item" href="/user/profile.html"><i class="bi bi-person me-2"></i>My Profile</a></li>
            <li><a class="dropdown-item" href="/user/notifications.html"><i class="bi bi-bell me-2"></i>Notifications</a></li>
        `;

        if (user.role === 'admin' || user.is_staff) {
            dashboardLink = '/admin/dashboard.html';
            roleLinks = `
                <li><a class="dropdown-item" href="/admin/bookings.html"><i class="bi bi-journal-text me-2"></i>Bookings</a></li>
                <li><a class="dropdown-item" href="/admin/driver-requests.html"><i class="bi bi-send-check me-2"></i>Driver Requests</a></li>
                <li><a class="dropdown-item" href="/admin/drivers.html"><i class="bi bi-person-badge me-2"></i>Drivers</a></li>
                <li><a class="dropdown-item" href="/admin/reports.html"><i class="bi bi-graph-up me-2"></i>Reports</a></li>
            `;
        } else if (user.role === 'driver') {
            dashboardLink = '/driver/dashboard.html';
            roleLinks = `
                <li><a class="dropdown-item" href="/driver/dashboard.html"><i class="bi bi-car-front me-2"></i>Available Pool</a></li>
                <li><a class="dropdown-item" href="/driver/dashboard.html#assigned"><i class="bi bi-check-circle me-2"></i>My Assigned Rides</a></li>
                <li><a class="dropdown-item" href="/driver/dashboard.html#requests"><i class="bi bi-clock-history me-2"></i>My Requests</a></li>
            `;
        }

        navAuthContainer.innerHTML = `
            <div class="dropdown">
                <button class="btn btn-outline-yellow dropdown-toggle d-flex align-items-center gap-2" type="button" data-bs-toggle="dropdown" aria-expanded="false">
                    <i class="bi bi-person-circle"></i>
                    <span>${user.first_name || user.username}</span>
                    <span class="badge bg-warning text-dark text-capitalize ms-1">${user.role}</span>
                </button>
                <ul class="dropdown-menu dropdown-menu-end shadow">
                    <li><h6 class="dropdown-header">Signed in as <strong>${user.email}</strong></h6></li>
                    <li><a class="dropdown-item" href="${dashboardLink}"><i class="bi bi-speedometer2 me-2"></i>Dashboard</a></li>
                    ${roleLinks}
                    <li><hr class="dropdown-divider"></li>
                    <li><a class="dropdown-item text-danger" href="javascript:void(0)" onclick="handleGlobalLogout()"><i class="bi bi-box-arrow-right me-2"></i>Logout</a></li>
                </ul>
            </div>
        `;
    } else {
        navAuthContainer.innerHTML = `
            <a href="tel:9043519772" class="btn btn-outline-yellow btn-sm text-nowrap"><i class="bi bi-telephone-fill me-1"></i> 9043519772</a>
            <a href="https://wa.me/919043519772?text=Hello%20Jhaz%201%20Way%20Taxi%2C%20I%20want%20to%20book%20a%20cab." target="_blank" class="btn btn-success btn-sm text-nowrap fw-bold"><i class="bi bi-whatsapp me-1"></i> WhatsApp</a>
        `;
    }
}

// Global Logout function with role-aware destination
async function handleGlobalLogout() {
    const isDriverPage = window.location.pathname.includes('/driver/');
    const isAdminPage = window.location.pathname.includes('/admin/');
    const user = getCurrentUser();
    const isDriverUser = user && user.role === 'driver';
    const isAdminUser = user && (user.role === 'admin' || user.is_staff);

    try {
        await fetchWithAuth(`${CONFIG.API_BASE_URL}/auth/logout/`, { method: 'POST' });
    } catch (e) {
        // continue
    }
    clearAuthSession();
    showToast('You have been logged out successfully.', 'info');
    setTimeout(() => {
        if (isAdminPage || isAdminUser) {
            window.location.href = '/admin/login.html';
        } else if (isDriverPage || isDriverUser) {
            window.location.href = '/driver/login.html';
        } else {
            window.location.href = '/index.html';
        }
    }, 400);
}

function setupFooterYear() {
    const el = document.getElementById('current-year');
    if (el) el.textContent = new Date().getFullYear();
}

// Render 24/7 Floating WhatsApp & Call Buttons across the site
function renderFloatingContactWidget() {
    if (document.querySelector('.floating-contact-container')) return;

    const container = document.createElement('div');
    container.className = 'floating-contact-container';
    container.innerHTML = `
        <a href="https://wa.me/919043519772?text=Hello%20Jhaz%201%20Way%20Taxi%2C%20I%20want%20to%20book%20a%20cab." target="_blank" class="floating-btn floating-btn-whatsapp" title="Chat on WhatsApp (9043519772)" aria-label="WhatsApp 9043519772">
            <i class="bi bi-whatsapp"></i>
            <span class="floating-tooltip">WhatsApp: 9043519772</span>
        </a>
        <a href="tel:9043519772" class="floating-btn floating-btn-call" title="Call Dispatch (9043519772)" aria-label="Call 9043519772">
            <i class="bi bi-telephone-fill"></i>
            <span class="floating-tooltip">Call: 9043519772</span>
        </a>
    `;
    document.body.appendChild(container);
}

document.addEventListener('DOMContentLoaded', () => {
    renderFloatingContactWidget();
});
