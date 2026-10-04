/**
 * JhazTaxi - Main UI & Network Utility Script
 */

document.addEventListener('DOMContentLoaded', () => {
    updateNavbarAuthState();
    setupFooterYear();
    renderFloatingContactWidget();
    loadHomepageVehicleRates();
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
                <li><a class="dropdown-item" href="/admin/bookings.html"><i class="bi bi-journal-text me-2"></i>Customer Bookings</a></li>
                <li><a class="dropdown-item" href="/admin/fares.html"><i class="bi bi-tag me-2"></i>Fares & QR</a></li>
                <li><a class="dropdown-item" href="/admin/payments.html"><i class="bi bi-credit-card me-2"></i>Payments</a></li>
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

// Dynamically synchronizes vehicle rates on homepage (both dropdown & categories showcase)
async function loadHomepageVehicleRates() {
    const categoriesContainer = document.getElementById('home-vehicle-categories-container');
    const heroSelect = document.getElementById('hero-vehicle-select');

    if (!categoriesContainer && !heroSelect) return;

    try {
        const res = await fetchWithAuth(`${CONFIG.API_BASE_URL}/vehicles/`);
        if (res.ok && res.data.vehicles) {
            const allowed = ['sedan', 'suv', 'innova crysta'];
            const vehicles = res.data.vehicles.filter(v => 
                v.status === 'available' && allowed.includes((v.vehicle_type || '').toLowerCase())
            );

            // Sort: Sedan -> SUV -> Innova Crysta
            const order = { 'sedan': 1, 'suv': 2, 'innova crysta': 3 };
            vehicles.sort((a, b) => (order[(a.vehicle_type || '').toLowerCase()] || 99) - (order[(b.vehicle_type || '').toLowerCase()] || 99));

            if (vehicles.length === 0) return;

            // 1. Update Hero Quick Booking Dropdown
            if (heroSelect) {
                const currentVal = heroSelect.value || 'Sedan';
                heroSelect.innerHTML = vehicles.map(v => {
                    const pricePerKm = parseFloat(v.price_per_km || 0).toFixed(0);
                    const isSelected = v.vehicle_type.toLowerCase() === currentVal.toLowerCase() ? 'selected' : '';
                    return `<option value="${v.vehicle_type}" ${isSelected}>${v.vehicle_type} (₹${pricePerKm}/KM)</option>`;
                }).join('');
            }

            // 2. Update Homepage Vehicle Categories Showcase
            if (categoriesContainer) {
                categoriesContainer.innerHTML = vehicles.map(v => {
                    const vt = (v.vehicle_type || '').toLowerCase();
                    let pillClass = 'bg-warning text-dark';
                    let subtitle = 'Up to 4 Passengers &bull; AC &bull; Large Boot';
                    let desc = v.description || 'Comfortable, air-conditioned sedan tailored for outstation one-way drops, airport runs, and city commutes.';
                    let img = v.image_url || '/assets/vehicles/sedan_dzire.jpg';

                    if (vt.includes('crysta')) {
                        pillClass = 'bg-dark text-warning';
                        subtitle = 'Up to 7 Passengers &bull; Captain Seats AC';
                        img = v.image_url || '/assets/vehicles/innova_crysta.jpg';
                    } else if (vt.includes('suv')) {
                        subtitle = 'Up to 6 Passengers &bull; Dual AC &bull; Spacious';
                        img = v.image_url || '/assets/vehicles/suv_ertiga.jpg';
                    }

                    const pricePerKm = parseFloat(v.price_per_km || 14).toFixed(0);
                    const minFare = (130 * parseFloat(pricePerKm) + 400).toFixed(0);

                    return `
                        <div class="col-lg-4 col-md-6">
                            <div class="vehicle-card h-100 shadow-sm border-0">
                                <div class="vehicle-img-wrapper" style="height: 200px;">
                                    <span class="vehicle-type-pill fs-6 px-3 py-1 ${pillClass}">${v.vehicle_type}</span>
                                    <img src="${img}" alt="${v.name}" onerror="this.src='/assets/vehicles/sedan_dzire.jpg'">
                                </div>
                                <div class="p-4 d-flex flex-column flex-grow-1 justify-content-between">
                                    <div>
                                        <h4 class="fw-bold mb-1">${v.name}</h4>
                                        <div class="text-muted mb-2"><i class="bi bi-people-fill me-1"></i> ${subtitle}</div>
                                        <p class="text-muted small">${desc}</p>
                                        <div class="d-flex flex-wrap gap-1 mb-2">
                                            <span class="badge bg-warning-subtle text-dark border border-warning" style="font-size: 0.72rem;">Min 130 KM Base</span>
                                            <span class="badge bg-light text-dark border" style="font-size: 0.72rem;">Driver Bata ₹400</span>
                                        </div>
                                    </div>
                                    <div class="border-top pt-3 d-flex justify-content-between align-items-center">
                                        <div>
                                            <strong class="text-dark fs-3">₹${pricePerKm}</strong><span class="text-muted">/KM</span>
                                            <div class="small text-muted" style="font-size: 0.75rem;">Min 130 KM: ₹${minFare}</div>
                                        </div>
                                        <a href="/booking.html?vehicle=${encodeURIComponent(v.vehicle_type)}" class="btn btn-yellow px-3 fw-bold">Book ${v.vehicle_type} &rarr;</a>
                                    </div>
                                </div>
                            </div>
                        </div>
                    `;
                }).join('');
            }
        }
    } catch (err) {
        console.warn('Error fetching homepage vehicle rates:', err);
    }
}
