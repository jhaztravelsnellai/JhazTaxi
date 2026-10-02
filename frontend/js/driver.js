/**
 * JhazTaxi - Driver Portal Logic
 * Manages Driver Available Pool, Expressing Interest (Driver Request),
 * and Managing Assigned Trips.
 */

let currentDriver = null;

document.addEventListener('DOMContentLoaded', () => {
    initDriverDashboard();
});

async function initDriverDashboard() {
    loadDriverProfileHeader();
    await refreshDriverDashboard();

    // Auto-refresh every 20 seconds for real-time ride pool
    setInterval(() => {
        loadAvailablePool(true);
    }, 20000);
}

async function loadDriverProfileHeader() {
    const user = getCurrentUser();
    if (!user) return;

    const nameEl = document.getElementById('header-driver-name');
    const navNameEl = document.getElementById('driver-nav-name');
    const phoneEl = document.getElementById('header-driver-phone');
    const emailEl = document.getElementById('header-driver-email');
    const licenseEl = document.getElementById('header-driver-license');
    const vehicleEl = document.getElementById('header-driver-vehicle');
    const plateEl = document.getElementById('header-driver-plate');
    const driverImgEl = document.getElementById('header-driver-img');
    const carImgEl = document.getElementById('header-car-img');
    const carNameEl = document.getElementById('header-car-name');
    const statusEl = document.getElementById('header-driver-status');

    if (nameEl) nameEl.textContent = user.first_name ? `${user.first_name} ${user.last_name || ''}` : user.username;
    if (navNameEl) navNameEl.textContent = user.first_name || user.username;
    if (phoneEl) phoneEl.textContent = user.phone_number || '+91 Active';
    if (emailEl) emailEl.textContent = user.email || 'No email provided';

    // Fetch full driver profile record including compulsory photos & vehicle info
    try {
        const res = await fetchWithAuth(`${CONFIG.API_BASE_URL}/driver/profile/`);
        if (res.ok && res.data.driver) {
            const d = res.data.driver;
            currentDriver = d;

            if (nameEl && d.name) nameEl.textContent = d.name;
            if (phoneEl && d.phone) phoneEl.textContent = d.phone;
            if (emailEl) emailEl.textContent = d.email ? d.email : 'Optional (Not added)';
            if (licenseEl && d.license_number) licenseEl.textContent = d.license_number;
            if (vehicleEl) vehicleEl.textContent = d.vehicle_name || d.vehicle_type || 'Registered Vehicle';
            if (plateEl && d.vehicle_number) plateEl.textContent = d.vehicle_number;
            if (carNameEl) carNameEl.textContent = d.vehicle_name || (d.vehicle_number ? `Plate: ${d.vehicle_number}` : 'Taxi Cab');

            if (driverImgEl && (d.display_profile_photo || d.profile_photo)) {
                driverImgEl.src = d.display_profile_photo || d.profile_photo;
            }
            if (carImgEl && (d.display_car_photo || d.car_photo)) {
                carImgEl.src = d.display_car_photo || d.car_photo;
            }
            if (statusEl && d.status) {
                const isAvail = d.status === 'available';
                statusEl.className = `badge ${isAvail ? 'bg-success' : (d.status === 'on_trip' ? 'bg-primary' : 'bg-secondary')}`;
                statusEl.innerHTML = `<i class="bi bi-circle-fill me-1" style="font-size: 0.6rem;"></i> ${d.status.toUpperCase()}`;
            }
        }
    } catch (err) {
        console.warn('Could not load detailed driver profile:', err);
    }
}

async function refreshDriverDashboard() {
    await Promise.all([
        loadAvailablePool(),
        loadMyAssignedRides(),
        loadMyRequests()
    ]);
}

// 1. Load Available Bookings Pool
async function loadAvailablePool(isSilent = false) {
    const container = document.getElementById('pool-cards-container');
    const emptyState = document.getElementById('pool-empty-state');

    const res = await fetchWithAuth(`${CONFIG.API_BASE_URL}/driver/available-bookings/`);
    if (res.ok && res.data.bookings) {
        const bookings = res.data.bookings;
        const availableCount = bookings.length;

        // Update badges & stats
        const statEl = document.getElementById('stat-available-count');
        const badgeEl = document.getElementById('badge-pool-count');
        if (statEl) statEl.textContent = availableCount;
        if (badgeEl) badgeEl.textContent = availableCount;

        if (availableCount === 0) {
            container.innerHTML = '';
            emptyState.classList.remove('d-none');
            return;
        }

        emptyState.classList.add('d-none');
        container.innerHTML = bookings.map(b => {
            const isWhatsApp = b.customer_notes && b.customer_notes.includes('WhatsApp');
            const phone = b.customer_phone || '';
            const phoneFormatted = phone.replace(/[^0-9+]/g, '');

            let actionHtml = '';
            if (b.my_request_status === 'pending') {
                actionHtml = `
                    <div class="alert alert-warning py-2 px-3 mb-0 d-flex align-items-center gap-2 small fw-bold">
                        <i class="bi bi-hourglass-split fs-5"></i>
                        <div>
                            <div>Request Submitted</div>
                            <small class="text-muted fw-normal">Waiting for Admin review & assignment</small>
                        </div>
                    </div>
                `;
            } else if (b.my_request_status === 'rejected') {
                actionHtml = `
                    <div class="alert alert-secondary py-2 px-3 mb-0 d-flex align-items-center gap-2 small">
                        <i class="bi bi-x-circle text-danger fs-5"></i>
                        <div>Request was declined by Admin for this ride.</div>
                    </div>
                `;
            } else {
                actionHtml = `
                    <button class="btn btn-success fw-bold py-2 px-3 shadow-sm w-100" onclick="openRequestModal('${b.booking_id}', '${b.pickup_address}', '${b.drop_address}')">
                        <i class="bi bi-check-circle-fill me-1"></i> I Can Take This Booking
                    </button>
                `;
            }

            let poolPayBadge = `<span class="badge bg-success text-white" style="font-size: 0.7rem;"><i class="bi bi-cash-stack me-1"></i> Cash on Delivery</span>`;
            if (b.payment_method === 'gpay') {
                poolPayBadge = `<span class="badge bg-primary text-white" style="font-size: 0.7rem;"><i class="bi bi-google me-1"></i> GPay</span>`;
            } else if (b.payment_method === 'upi') {
                poolPayBadge = `<span class="badge bg-info text-dark" style="font-size: 0.7rem;"><i class="bi bi-qr-code-scan me-1"></i> UPI</span>`;
            }

            return `
                <div class="col-md-6 col-lg-4">
                    <div class="card border-0 shadow-sm rounded-4 h-100 bg-white d-flex flex-column">
                        <div class="card-header bg-dark text-light border-0 py-3 rounded-top-4 d-flex justify-content-between align-items-center">
                            <div>
                                <span class="badge bg-warning text-dark fw-bold me-1">${b.vehicle_details?.vehicle_type || 'Vehicle'}</span>
                                <code class="text-warning fw-bold">${b.booking_id}</code>
                            </div>
                            <div class="text-end">
                                <span class="fs-5 fw-bold text-white">₹${b.total_fare}</span>
                                <div class="mt-1">${poolPayBadge}</div>
                            </div>
                        </div>
                        <div class="card-body p-3 d-flex flex-column flex-grow-1">
                            ${isWhatsApp ? `
                                <div class="badge bg-success-subtle text-success border border-success-subtle mb-2 align-self-start">
                                    <i class="bi bi-whatsapp me-1"></i> WhatsApp Booking
                                </div>
                            ` : ''}

                            <!-- Customer Info -->
                            <div class="d-flex justify-content-between align-items-center pb-2 mb-2 border-bottom">
                                <div>
                                    <span class="text-muted small d-block">Customer</span>
                                    <strong>${b.customer_name || 'Passenger'}</strong>
                                </div>
                                ${phone ? `
                                    <div class="d-flex gap-1">
                                        <a href="tel:${phoneFormatted}" class="btn btn-outline-primary btn-sm py-1 px-2" title="Call Customer">
                                            <i class="bi bi-telephone-fill"></i>
                                        </a>
                                        <a href="https://wa.me/${phoneFormatted.replace('+', '')}" target="_blank" class="btn btn-outline-success btn-sm py-1 px-2" title="WhatsApp Customer">
                                            <i class="bi bi-whatsapp"></i>
                                        </a>
                                    </div>
                                ` : ''}
                            </div>

                            <!-- Route -->
                            <div class="mb-3">
                                <div class="d-flex align-items-start gap-2 mb-2">
                                    <i class="bi bi-geo-alt-fill text-success fs-5"></i>
                                    <div>
                                        <small class="text-muted d-block" style="font-size: 0.75rem;">PICKUP</small>
                                        <span class="small fw-semibold">${b.pickup_address}</span>
                                    </div>
                                </div>
                                <div class="d-flex align-items-start gap-2">
                                    <i class="bi bi-pin-map-fill text-danger fs-5"></i>
                                    <div>
                                        <small class="text-muted d-block" style="font-size: 0.75rem;">DROP</small>
                                        <span class="small fw-semibold">${b.drop_address}</span>
                                    </div>
                                </div>
                            </div>

                            <!-- Ride Details -->
                            <div class="row g-2 text-center bg-light rounded-3 p-2 mb-3 small text-muted">
                                <div class="col-4 border-end">
                                    <i class="bi bi-calendar3 d-block text-warning mb-1"></i>
                                    <span class="fw-bold text-dark">${b.pickup_date}</span>
                                </div>
                                <div class="col-4 border-end">
                                    <i class="bi bi-clock d-block text-warning mb-1"></i>
                                    <span class="fw-bold text-dark">${b.pickup_time ? b.pickup_time.substring(0, 5) : '12:00'}</span>
                                </div>
                                <div class="col-4">
                                    <i class="bi bi-speedometer2 d-block text-warning mb-1"></i>
                                    <span class="fw-bold text-dark">${b.distance_km} km</span>
                                </div>
                            </div>

                            ${b.customer_notes ? `
                                <div class="small text-muted bg-light p-2 rounded mb-3">
                                    <i class="bi bi-chat-left-text me-1 text-secondary"></i> "${b.customer_notes}"
                                </div>
                            ` : ''}

                            <div class="d-flex justify-content-between align-items-center small text-muted mb-2">
                                <span><i class="bi bi-people me-1"></i> ${b.driver_requests_count} driver(s) requested</span>
                                <span class="badge bg-light text-dark border">Available</span>
                            </div>

                            <!-- Action Button -->
                            <div class="mt-auto pt-2">
                                ${actionHtml}
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }
}

// 2. Open Request Modal
function openRequestModal(bookingId, pickup, drop) {
    document.getElementById('req-modal-booking-id').value = bookingId;
    document.getElementById('req-modal-title').textContent = `Request Booking: ${bookingId}`;
    document.getElementById('req-modal-note').value = '';

    const modal = new bootstrap.Modal(document.getElementById('requestBookingModal'));
    modal.show();
}

// 3. Submit Driver Request ("I Can Take This Booking")
async function submitDriverBookingRequest(event) {
    event.preventDefault();
    const bookingId = document.getElementById('req-modal-booking-id').value;
    const note = document.getElementById('req-modal-note').value.trim();
    const btn = document.getElementById('btn-confirm-req');

    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>Submitting...';

    const res = await fetchWithAuth(`${CONFIG.API_BASE_URL}/driver/bookings/${bookingId}/request/`, {
        method: 'POST',
        body: JSON.stringify({ note: note })
    });

    btn.disabled = false;
    btn.innerHTML = '<i class="bi bi-send-fill me-1"></i> Submit Request to Admin';

    if (res.ok && res.data.success) {
        const modal = bootstrap.Modal.getInstance(document.getElementById('requestBookingModal'));
        if (modal) modal.hide();

        showToast(res.data.message || 'Request submitted successfully to Admin!', 'success');
        refreshDriverDashboard();
    } else {
        const err = res.data.errors ? Object.values(res.data.errors).flat().join(', ') : (res.data.message || 'Failed to submit request.');
        showToast(err, 'error');
    }
}

// 4. Load My Assigned Rides
async function loadMyAssignedRides() {
    const container = document.getElementById('assigned-cards-container');
    const emptyState = document.getElementById('assigned-empty-state');

    const res = await fetchWithAuth(`${CONFIG.API_BASE_URL}/driver/my-assigned-bookings/`);
    if (res.ok && res.data.bookings) {
        const bookings = res.data.bookings;
        const activeAssigned = bookings.filter(b => b.status !== 'trip_completed' && b.status !== 'cancelled');
        const completed = bookings.filter(b => b.status === 'trip_completed');

        // Update counts
        const statAssigned = document.getElementById('stat-assigned-count');
        const badgeAssigned = document.getElementById('badge-assigned-count');
        const statCompleted = document.getElementById('stat-completed-count');

        if (statAssigned) statAssigned.textContent = activeAssigned.length;
        if (badgeAssigned) badgeAssigned.textContent = activeAssigned.length;
        if (statCompleted) statCompleted.textContent = completed.length;

        if (bookings.length === 0) {
            container.innerHTML = '';
            emptyState.classList.remove('d-none');
            return;
        }

        emptyState.classList.add('d-none');
        container.innerHTML = bookings.map(b => {
            const phone = b.customer_phone || '';
            const phoneFormatted = phone.replace(/[^0-9+]/g, '');

            let controlsHtml = '';
            let statusBadge = '';

            if (b.status === 'driver_assigned') {
                statusBadge = '<span class="badge bg-primary">Assigned to You</span>';
                controlsHtml = `
                    <button class="btn btn-primary fw-bold py-2 w-100 shadow-sm" onclick="updateTripStatus('${b.booking_id}', 'driver_arriving')">
                        <i class="bi bi-geo-alt-fill me-1"></i> I Have Arrived at Pickup
                    </button>
                `;
            } else if (b.status === 'driver_arriving') {
                statusBadge = '<span class="badge bg-warning text-dark">Driver Arriving</span>';
                controlsHtml = `
                    <button class="btn btn-warning fw-bold text-dark py-2 w-100 shadow-sm" onclick="updateTripStatus('${b.booking_id}', 'trip_started')">
                        <i class="bi bi-play-fill me-1"></i> Start Trip (Passenger Picked Up)
                    </button>
            } else if (b.status === 'trip_started') {
                statusBadge = '<span class="badge bg-info text-dark">Trip in Progress</span>';
                let collectBtnText = `Complete Trip & Collect ₹${b.total_fare} (Cash on Delivery)`;
                let collectBtnClass = 'btn-success';
                let collectIcon = 'bi-cash-coin';

                if (b.payment_method === 'gpay') {
                    collectBtnText = `Verify ₹${b.total_fare} GPay & Complete Trip`;
                    collectBtnClass = 'btn-primary';
                    collectIcon = 'bi-google';
                } else if (b.payment_method === 'upi') {
                    collectBtnText = `Verify ₹${b.total_fare} UPI & Complete Trip`;
                    collectBtnClass = 'btn-info text-dark';
                    collectIcon = 'bi-qr-code-scan';
                }

                let showQRBtn = '';
                if (b.payment_method === 'gpay' || b.payment_method === 'upi') {
                    showQRBtn = `
                        <button class="btn btn-outline-primary fw-bold py-2 w-100 shadow-sm mb-2" onclick="openDriverGPayQRModal('${b.booking_id}', ${b.total_fare}, '${(b.customer_name || 'Passenger').replace(/'/g, "\\'")}')">
                            <i class="bi bi-qr-code-scan me-1"></i> 📱 Show Customer GPay Scanner
                        </button>
                    `;
                }

                controlsHtml = `
                    ${showQRBtn}
                    <button class="btn ${collectBtnClass} fw-bold py-2 w-100 shadow-sm" onclick="confirmCompleteTripPayment('${b.booking_id}', '${b.payment_method}', ${b.total_fare})">
                        <i class="bi ${collectIcon} me-1"></i> ${collectBtnText}
                    </button>
                `;
            } else if (b.status === 'trip_completed') {
                statusBadge = '<span class="badge bg-success">Trip Completed</span>';
                controlsHtml = `
                    <div class="alert alert-success py-2 text-center mb-0 small fw-bold">
                        <i class="bi bi-check-all me-1"></i> Ride Completed & Payment Paid
                    </div>
                `;
            } else {
                statusBadge = `<span class="badge bg-secondary text-capitalize">${b.status}</span>`;
            }

            let assignedPayBadge = `<span class="badge bg-success-subtle text-success border border-success"><i class="bi bi-cash-stack me-1"></i> Cash on Delivery</span>`;
            if (b.payment_method === 'gpay') {
                assignedPayBadge = `<span class="badge bg-primary-subtle text-primary border border-primary"><i class="bi bi-google me-1"></i> Google Pay (GPay)</span>`;
            } else if (b.payment_method === 'upi') {
                assignedPayBadge = `<span class="badge bg-info-subtle text-info-emphasis border border-info"><i class="bi bi-qr-code-scan me-1"></i> UPI / PhonePe</span>`;
            }

            return `
                <div class="col-md-6 col-lg-4">
                    <div class="card border-0 shadow-sm rounded-4 h-100 bg-white border-top border-4 border-success d-flex flex-column">
                        <div class="card-header bg-white border-0 pt-3 pb-0 d-flex justify-content-between align-items-center">
                            <div>
                                <code class="fw-bold fs-6">${b.booking_id}</code>
                                <div class="mt-1">${statusBadge}</div>
                            </div>
                            <div class="text-end">
                                <span class="fs-4 fw-bold text-success">₹${b.total_fare}</span>
                                <div class="mt-1">${assignedPayBadge}</div>
                            </div>
                        </div>
                        <div class="card-body p-3 d-flex flex-column flex-grow-1">
                            <!-- Customer Details -->
                            <div class="bg-light rounded-3 p-3 mb-3">
                                <div class="d-flex justify-content-between align-items-center">
                                    <div>
                                        <small class="text-muted d-block">Passenger Contact</small>
                                        <h6 class="fw-bold mb-0">${b.customer_name || 'Passenger'}</h6>
                                        <small class="text-muted">${phone || 'No phone'}</small>
                                    </div>
                                    ${phone ? `
                                        <div class="d-flex gap-2">
                                            <a href="tel:${phoneFormatted}" class="btn btn-primary btn-sm rounded-circle p-2" title="Call">
                                                <i class="bi bi-telephone-fill"></i>
                                            </a>
                                            <a href="https://wa.me/${phoneFormatted.replace('+', '')}" target="_blank" class="btn btn-success btn-sm rounded-circle p-2" title="WhatsApp">
                                                <i class="bi bi-whatsapp"></i>
                                            </a>
                                        </div>
                                    ` : ''}
                                </div>
                            </div>

                            <!-- Route -->
                            <div class="mb-3">
                                <div class="d-flex align-items-start gap-2 mb-2">
                                    <i class="bi bi-geo-alt-fill text-success fs-5"></i>
                                    <div>
                                        <small class="text-muted d-block" style="font-size: 0.75rem;">PICKUP LOCATION</small>
                                        <span class="small fw-bold">${b.pickup_address}</span>
                                    </div>
                                </div>
                                <div class="d-flex align-items-start gap-2">
                                    <i class="bi bi-pin-map-fill text-danger fs-5"></i>
                                    <div>
                                        <small class="text-muted d-block" style="font-size: 0.75rem;">DROP DESTINATION</small>
                                        <span class="small fw-bold">${b.drop_address}</span>
                                    </div>
                                </div>
                            </div>

                            <div class="d-flex justify-content-between small text-muted bg-light p-2 rounded mb-3">
                                <span><i class="bi bi-calendar3 me-1"></i>${b.pickup_date} at ${b.pickup_time ? b.pickup_time.substring(0, 5) : '12:00'}</span>
                                <span><i class="bi bi-speedometer me-1"></i>${b.distance_km} km</span>
                            </div>

                            <div class="mt-auto pt-2">
                                ${controlsHtml}
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }
}

// 4b. Confirm Trip Payment and Complete (Handles Cash on Delivery, GPay, UPI)
async function confirmCompleteTripPayment(bookingId, paymentMethod, fare) {
    let confirmPrompt = `🔔 Complete Trip ${bookingId} & Confirm Payment?\n\n`;
    if (paymentMethod === 'gpay') {
        confirmPrompt += `Have you confirmed the ₹${fare} Google Pay (GPay) payment on your mobile?`;
    } else if (paymentMethod === 'upi') {
        confirmPrompt += `Have you confirmed the ₹${fare} UPI / PhonePe transfer on your mobile?`;
    } else {
        confirmPrompt += `Have you collected ₹${fare} in Cash from the passenger (Cash on Delivery)?`;
    }

    if (!confirm(confirmPrompt)) return;

    const res = await fetchWithAuth(`${CONFIG.API_BASE_URL}/driver/bookings/${bookingId}/trip-status/`, {
        method: 'POST',
        body: JSON.stringify({ status: 'trip_completed' })
    });

    if (res.ok && res.data.success) {
        showToast(res.data.message || `Trip completed & ₹${fare} payment recorded!`, 'success');
        refreshDriverDashboard();
    } else {
        showToast(res.data.message || 'Failed to complete trip', 'error');
    }
}

// 5. Update Trip Lifecycle Status (driver_arriving -> trip_started -> trip_completed)
async function updateTripStatus(bookingId, newStatus) {
    if (!confirm(`Are you sure you want to change status to: ${newStatus.replace('_', ' ')}?`)) return;

    const res = await fetchWithAuth(`${CONFIG.API_BASE_URL}/driver/bookings/${bookingId}/trip-status/`, {
        method: 'POST',
        body: JSON.stringify({ status: newStatus })
    });

    if (res.ok && res.data.success) {
        showToast(res.data.message || 'Status updated!', 'success');
        refreshDriverDashboard();
    } else {
        showToast(res.data.message || 'Failed to update trip status', 'error');
    }
}

// 6. Load My Submitted Requests
async function loadMyRequests() {
    const tbody = document.getElementById('driver-requests-tbody');
    const res = await fetchWithAuth(`${CONFIG.API_BASE_URL}/driver/my-requests/`);

    if (res.ok && res.data.requests) {
        const requests = res.data.requests;
        const pendingRequests = requests.filter(r => r.status === 'pending');

        const statRequests = document.getElementById('stat-requests-count');
        const badgeRequests = document.getElementById('badge-requests-count');
        if (statRequests) statRequests.textContent = pendingRequests.length;
        if (badgeRequests) badgeRequests.textContent = pendingRequests.length;

        if (requests.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="text-center py-4 text-muted">You have not submitted any booking requests yet.</td></tr>';
            return;
        }

        tbody.innerHTML = requests.map(r => {
            const b = r.booking_details || {};
            let statusBadge = '';
            if (r.status === 'pending') {
                statusBadge = '<span class="badge bg-warning text-dark"><i class="bi bi-clock-history me-1"></i>Pending Admin Approval</span>';
            } else if (r.status === 'approved') {
                statusBadge = '<span class="badge bg-success"><i class="bi bi-check-circle-fill me-1"></i>Approved & Assigned</span>';
            } else if (r.status === 'rejected') {
                statusBadge = '<span class="badge bg-danger"><i class="bi bi-x-circle me-1"></i>Rejected</span>';
            } else {
                statusBadge = `<span class="badge bg-secondary">${r.status}</span>`;
            }

            return `
                <tr>
                    <td><code class="fw-bold">${b.booking_id || r.booking}</code></td>
                    <td>
                        <small class="fw-bold">${b.pickup_address || '--'}</small><br>
                        <small class="text-muted">&rarr; ${b.drop_address || '--'}</small>
                    </td>
                    <td><small>${b.pickup_date || ''} ${b.pickup_time ? b.pickup_time.substring(0, 5) : ''}</small></td>
                    <td><strong class="text-dark">₹${b.total_fare || '--'}</strong></td>
                    <td><small class="text-muted">${r.driver_note || '<em>None</em>'}</small></td>
                    <td><small class="text-muted">${new Date(r.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</small></td>
                    <td>${statusBadge}</td>
                </tr>
            `;
        }).join('');
    }
}

// 5. Driver GPay Scanner Modal (Shows Admin's Official GPay QR to Customer in Vehicle)
async function openDriverGPayQRModal(bookingId, fare, customerName) {
    let modalEl = document.getElementById('driverGPayModal');
    if (!modalEl) {
        modalEl = document.createElement('div');
        modalEl.id = 'driverGPayModal';
        modalEl.className = 'modal fade';
        modalEl.tabIndex = -1;
        modalEl.innerHTML = `
            <div class="modal-dialog modal-dialog-centered">
                <div class="modal-content border-0 shadow-lg rounded-4 overflow-hidden">
                    <div class="modal-header bg-dark text-white border-0 py-3">
                        <div class="d-flex align-items-center gap-2">
                            <span class="badge bg-warning text-dark"><i class="bi bi-google"></i> GPay</span>
                            <h5 class="modal-title fw-bold mb-0">Collect Trip Payment</h5>
                        </div>
                        <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body p-4 text-center" id="driver-gpay-modal-body">
                        <div class="py-4">
                            <span class="spinner-border text-warning"></span>
                            <p class="text-muted mt-2">Loading official GPay scanner...</p>
                        </div>
                    </div>
                    <div class="modal-footer border-0 bg-light justify-content-between">
                        <span class="text-muted small"><i class="bi bi-shield-check text-success me-1"></i> Admin Authorized Scanner</span>
                        <button type="button" class="btn btn-dark fw-bold btn-sm px-3" data-bs-dismiss="modal">Close</button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modalEl);
    }

    const modal = new bootstrap.Modal(modalEl);
    modal.show();

    const bodyEl = document.getElementById('driver-gpay-modal-body');
    try {
        const res = await fetch(`${CONFIG.API_BASE_URL}/payment-settings/`);
        const data = await res.json();
        if (data.success && data.setting) {
            const s = data.setting;
            bodyEl.innerHTML = `
                <div class="mb-3">
                    <span class="badge bg-warning-subtle text-dark border border-warning px-3 py-1 mb-2">Trip ${bookingId}</span>
                    <h3 class="fw-bold text-success mb-1">₹${fare}</h3>
                    <p class="text-muted small mb-0">Passenger: <strong>${customerName}</strong></p>
                </div>
                <div class="p-3 bg-light rounded-4 border d-inline-block shadow-sm mb-3">
                    <img src="${s.qr_image_url || '/assets/icons/favicon.svg'}" alt="Official GPay QR" class="img-fluid rounded-3" style="max-height: 250px; background: white; padding: 10px;">
                </div>
                <div class="mb-2">
                    <span class="text-muted small">Payee:</span> <strong class="text-dark">${s.payee_name || 'JhazTaxi Travels'}</strong>
                </div>
                <div class="mb-3">
                    <span class="text-muted small">UPI ID:</span> <code class="fw-bold text-primary fs-6">${s.upi_id || 'jhaztaxi@upi'}</code>
                </div>
                <div class="alert alert-light border small text-muted py-2 mb-0">
                    <i class="bi bi-phone me-1 text-primary"></i> ${s.instructions || 'Show this QR scanner to passenger. Ask them to scan using GPay, PhonePe, or Paytm.'}
                </div>
            `;
        } else {
            bodyEl.innerHTML = `<div class="alert alert-warning">Unable to load GPay scanner.</div>`;
        }
    } catch (e) {
        bodyEl.innerHTML = `<div class="alert alert-danger">Error connecting to server.</div>`;
    }
}

