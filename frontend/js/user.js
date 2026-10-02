/**
 * JhazTaxi - Customer Dashboard & Bookings Controller
 */

// Format currency
function formatCurrency(amount) {
    return `${CONFIG.CURRENCY_SYMBOL}${parseFloat(amount || 0).toFixed(2)}`;
}

// Format status badge HTML
function renderStatusBadge(status) {
    const statusMap = {
        'pending': { label: 'Pending', class: 'badge-pending', icon: 'bi-hourglass-split' },
        'confirmed': { label: 'Confirmed', class: 'badge-confirmed', icon: 'bi-check-circle' },
        'driver_assigned': { label: 'Driver Assigned', class: 'badge-driver_assigned', icon: 'bi-person-check' },
        'driver_arriving': { label: 'Driver Arriving', class: 'badge-driver_arriving', icon: 'bi-geo' },
        'trip_started': { label: 'Trip Started', class: 'badge-trip_started', icon: 'bi-car-front' },
        'trip_completed': { label: 'Trip Completed', class: 'badge-trip_completed', icon: 'bi-check2-all' },
        'cancelled': { label: 'Cancelled', class: 'badge-cancelled', icon: 'bi-x-circle' },
    };

    const s = statusMap[status] || { label: status, class: 'bg-secondary text-white', icon: 'bi-info-circle' };
    return `<span class="badge-status ${s.class}"><i class="bi ${s.icon}"></i> ${s.label}</span>`;
}

// 1. Load Customer Dashboard
async function loadCustomerDashboard() {
    requireAuth();

    const statsRes = await fetchWithAuth(`${CONFIG.API_BASE_URL}/user/dashboard-stats/`);
    if (!statsRes.ok || !statsRes.data.success) {
        showToast('Failed to load dashboard metrics.', 'error');
        return;
    }

    const stats = statsRes.data.stats;

    // Populate counters
    const totalEl = document.getElementById('dash-total-trips');
    const compEl = document.getElementById('dash-completed-trips');
    const cancEl = document.getElementById('dash-cancelled-trips');

    if (totalEl) totalEl.textContent = stats.total_trips;
    if (compEl) compEl.textContent = stats.completed_trips;
    if (cancEl) cancEl.textContent = stats.cancelled_trips;

    // Current Ride Alert Card
    const currentRideContainer = document.getElementById('dash-current-ride-container');
    if (currentRideContainer) {
        if (stats.current_ride) {
            const cr = stats.current_ride;
            currentRideContainer.innerHTML = `
                <div class="card border-warning shadow-sm mb-4">
                    <div class="card-header bg-warning text-dark fw-bold d-flex justify-content-between align-items-center">
                        <span><i class="bi bi-broadcast me-2 pulse-badge"></i> Active Ride in Progress (${cr.booking_id})</span>
                        ${renderStatusBadge(cr.status)}
                    </div>
                    <div class="card-body">
                        <div class="row align-items-center">
                            <div class="col-md-7">
                                <div class="mb-2"><strong>Pickup:</strong> ${cr.pickup_address}</div>
                                <div><strong>Drop:</strong> ${cr.drop_address}</div>
                                <div class="mt-2 text-muted small"><i class="bi bi-clock me-1"></i> Pickup Scheduled: ${cr.pickup_date} at ${cr.pickup_time}</div>
                            </div>
                            <div class="col-md-5 text-md-end mt-3 mt-md-0">
                                <div class="fw-bold fs-4 text-dark mb-2">${formatCurrency(cr.total_fare)}</div>
                                <a href="/user/booking-details.html?id=${cr.booking_id}" class="btn btn-yellow fw-bold">
                                    <i class="bi bi-eye-fill me-1"></i> Track Live Status
                                </a>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        } else {
            currentRideContainer.innerHTML = '';
        }
    }

    // Upcoming Ride Card
    const upcomingContainer = document.getElementById('dash-upcoming-ride-container');
    if (upcomingContainer) {
        if (stats.upcoming_ride) {
            const ur = stats.upcoming_ride;
            upcomingContainer.innerHTML = `
                <div class="card border-primary shadow-sm mb-4">
                    <div class="card-header bg-primary text-white fw-bold d-flex justify-content-between align-items-center">
                        <span><i class="bi bi-calendar-event me-2"></i> Next Upcoming Trip (${ur.booking_id})</span>
                        ${renderStatusBadge(ur.status)}
                    </div>
                    <div class="card-body">
                        <div class="row align-items-center">
                            <div class="col-md-7">
                                <div class="mb-1"><strong>Pickup:</strong> ${ur.pickup_address}</div>
                                <div class="mb-2"><strong>Drop:</strong> ${ur.drop_address}</div>
                                <span class="badge bg-light text-dark border"><i class="bi bi-car-front me-1"></i>${ur.vehicle_details?.name || 'Vehicle'}</span>
                            </div>
                            <div class="col-md-5 text-md-end mt-3 mt-md-0">
                                <a href="/user/booking-details.html?id=${ur.booking_id}" class="btn btn-outline-dark fw-bold">
                                    View Details
                                </a>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        } else {
            upcomingContainer.innerHTML = '';
        }
    }

    // Recent Bookings Table
    const recentTableBody = document.getElementById('dash-recent-bookings-tbody');
    if (recentTableBody) {
        if (stats.recent_bookings && stats.recent_bookings.length > 0) {
            recentTableBody.innerHTML = stats.recent_bookings.map(b => `
                <tr>
                    <td class="fw-bold text-dark"><a href="/user/booking-details.html?id=${b.booking_id}" class="text-decoration-none">${b.booking_id}</a></td>
                    <td>${b.pickup_date} <small class="text-muted">${b.pickup_time}</small></td>
                    <td>
                        <div class="text-truncate" style="max-width: 220px;" title="${b.pickup_address}">
                            <i class="bi bi-geo-alt-fill text-success me-1"></i>${b.pickup_address}
                        </div>
                        <div class="text-truncate" style="max-width: 220px;" title="${b.drop_address}">
                            <i class="bi bi-flag-fill text-danger me-1"></i>${b.drop_address}
                        </div>
                    </td>
                    <td>${b.vehicle_details?.vehicle_type || 'Sedan'}</td>
                    <td class="fw-bold">${formatCurrency(b.total_fare)}</td>
                    <td>${renderStatusBadge(b.status)}</td>
                    <td>
                        <a href="/user/booking-details.html?id=${b.booking_id}" class="btn btn-sm btn-outline-dark">
                            <i class="bi bi-eye"></i>
                        </a>
                    </td>
                </tr>
            `).join('');
        } else {
            recentTableBody.innerHTML = `<tr><td colspan="7" class="text-center py-4 text-muted">No rides booked yet. Ready for your first trip? <a href="/booking.html" class="fw-bold text-dark">Book a Ride</a></td></tr>`;
        }
    }
}

// 2. Load Customer Bookings List Page
async function loadCustomerBookings(filterStatus = 'all') {
    requireAuth();

    const tbody = document.getElementById('user-bookings-table-body');
    if (!tbody) return;

    tbody.innerHTML = `<tr><td colspan="8" class="text-center py-4"><span class="spinner-border spinner-yellow"></span></td></tr>`;

    let url = `${CONFIG.API_BASE_URL}/bookings/`;
    if (filterStatus !== 'all') {
        url += `?status=${filterStatus}`;
    }

    const res = await fetchWithAuth(url);
    if (res.ok && res.data.bookings) {
        const bookings = res.data.bookings;
        if (bookings.length === 0) {
            tbody.innerHTML = `<tr><td colspan="8" class="text-center py-4 text-muted">No bookings found in this category.</td></tr>`;
            return;
        }

        tbody.innerHTML = bookings.map(b => `
            <tr>
                <td class="fw-bold"><a href="/user/booking-details.html?id=${b.booking_id}" class="text-dark">${b.booking_id}</a></td>
                <td>${b.pickup_date}<br><small class="text-muted">${b.pickup_time}</small></td>
                <td>
                    <div class="small fw-semibold text-truncate" style="max-width: 200px;" title="${b.pickup_address}"><i class="bi bi-circle-fill text-success me-1" style="font-size: 8px;"></i>${b.pickup_address}</div>
                    <div class="small text-muted text-truncate" style="max-width: 200px;" title="${b.drop_address}"><i class="bi bi-square-fill text-danger me-1" style="font-size: 8px;"></i>${b.drop_address}</div>
                </td>
                <td>
                    <span class="badge bg-light text-dark border">${b.vehicle_details?.vehicle_type || 'Vehicle'}</span>
                </td>
                <td>
                    ${b.driver_details ? `<strong>${b.driver_details.name}</strong><br><small class="text-muted">${b.driver_details.phone}</small>` : '<span class="text-muted italic">Awaiting driver</span>'}
                </td>
                <td>${b.distance_km} KM</td>
                <td class="fw-bold">${formatCurrency(b.total_fare)}</td>
                <td>${renderStatusBadge(b.status)}</td>
                <td>
                    <a href="/user/booking-details.html?id=${b.booking_id}" class="btn btn-sm btn-yellow">
                        View
                    </a>
                </td>
            </tr>
        `).join('');
    } else {
        tbody.innerHTML = `<tr><td colspan="8" class="text-center py-4 text-danger">Failed to load bookings.</td></tr>`;
    }
}

// 3. Load Single Booking Details Page with Visual Timeline Stepper
async function loadBookingDetails() {
    requireAuth();

    const params = new URLSearchParams(window.location.search);
    const bookingId = params.get('id');

    if (!bookingId) {
        showToast('Invalid booking ID requested.', 'error');
        setTimeout(() => window.location.href = '/user/bookings.html', 1000);
        return;
    }

    const res = await fetchWithAuth(`${CONFIG.API_BASE_URL}/bookings/${bookingId}/`);
    if (!res.ok || !res.data.success) {
        showToast('Booking details could not be found.', 'error');
        return;
    }

    const b = res.data.booking;
    renderBookingDetailsView(b);
}

function renderBookingDetailsView(b) {
    // Basic Header
    const idEl = document.getElementById('details-booking-id');
    const badgeEl = document.getElementById('details-status-badge');
    if (idEl) idEl.textContent = b.booking_id;
    if (badgeEl) badgeEl.innerHTML = renderStatusBadge(b.status);

    // Visual Status Timeline Stepper
    renderTimelineStepper(b.status);

    // Trip Info
    const tripContainer = document.getElementById('details-trip-info');
    if (tripContainer) {
        tripContainer.innerHTML = `
            <div class="row g-3">
                <div class="col-md-6">
                    <label class="text-muted small fw-bold text-uppercase">Pickup Location</label>
                    <div class="fw-semibold"><i class="bi bi-geo-alt-fill text-success me-1"></i> ${b.pickup_address}</div>
                </div>
                <div class="col-md-6">
                    <label class="text-muted small fw-bold text-uppercase">Drop Location</label>
                    <div class="fw-semibold"><i class="bi bi-flag-fill text-danger me-1"></i> ${b.drop_address}</div>
                </div>
                <div class="col-md-4">
                    <label class="text-muted small fw-bold text-uppercase">Pickup Schedule</label>
                    <div>${b.pickup_date} at <strong>${b.pickup_time}</strong></div>
                </div>
                <div class="col-md-4">
                    <label class="text-muted small fw-bold text-uppercase">Road Distance</label>
                    <div><strong>${b.distance_km} KM</strong> (~${b.duration_mins} mins)</div>
                </div>
                <div class="col-md-4">
                    <label class="text-muted small fw-bold text-uppercase">Passengers</label>
                    <div>${b.passengers} Passenger(s)</div>
                </div>
            </div>
        `;
    }

    // Driver Card
    const driverContainer = document.getElementById('details-driver-container');
    if (driverContainer) {
        if (b.driver_details) {
            const d = b.driver_details;
            const photo = d.display_profile_photo || d.profile_photo || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=250&q=80';
            const carPhoto = d.display_car_photo || d.car_photo || b.vehicle_details?.image || b.vehicle_details?.image_url || 'https://images.unsplash.com/photo-1550355291-bbee04a92027?auto=format&fit=crop&w=250&q=80';
            driverContainer.innerHTML = `
                <div class="driver-assigned-card">
                    <div class="d-flex align-items-center justify-content-between flex-wrap gap-3">
                        <div class="d-flex align-items-center gap-3">
                            <img src="${photo}" alt="${d.name}" class="driver-photo border border-warning shadow-sm">
                            <div>
                                <span class="badge bg-warning text-dark mb-1 fw-bold">Assigned Driver</span>
                                <h5 class="mb-0 fw-bold text-white">${d.name}</h5>
                                <div class="small text-white-50"><i class="bi bi-star-fill text-warning me-1"></i>${d.rating}★ Rating &bull; ${d.total_ratings_count || 0} rides</div>
                                <div class="mt-1"><i class="bi bi-telephone-fill me-1 text-warning"></i> <strong>${d.phone}</strong></div>
                            </div>
                        </div>
                        <div class="text-end">
                            <img src="${carPhoto}" alt="Assigned Vehicle" class="rounded border border-secondary shadow-sm" style="width: 90px; height: 55px; object-fit: cover;">
                            <div class="small text-white-50 mt-1" style="font-size: 0.7rem;">VEHICLE PHOTO</div>
                        </div>
                    </div>
                    <hr class="border-secondary my-3">
                    <div class="row g-2 small">
                        <div class="col-6"><strong>Vehicle:</strong> ${d.vehicle_name || b.vehicle_details?.name || 'Taxi Cab'}</div>
                        <div class="col-6"><strong>Plate No:</strong> <span class="badge bg-warning text-dark font-monospace fw-bold">${d.vehicle_number || b.vehicle_details?.vehicle_number || 'N/A'}</span></div>
                        <div class="col-6"><strong>Category:</strong> ${d.vehicle_type || b.vehicle_details?.vehicle_type || 'Sedan'}</div>
                        <div class="col-6"><strong>Status:</strong> <span class="text-warning">${d.status.toUpperCase()}</span></div>
                    </div>
                </div>
            `;
        } else if (b.status === 'cancelled') {
            driverContainer.innerHTML = `
                <div class="alert alert-danger mb-0">
                    <i class="bi bi-x-circle-fill me-2"></i> This booking was cancelled.
                    ${b.cancellation_reason ? `<br><small class="text-muted">Reason: ${b.cancellation_reason}</small>` : ''}
                </div>
            `;
        } else {
            driverContainer.innerHTML = `
                <div class="card border p-4 text-center">
                    <div class="spinner-border spinner-yellow mx-auto mb-2"></div>
                    <h6 class="fw-bold">Finding the Nearest Driver</h6>
                    <p class="text-muted small mb-0">Our dispatch team is assigning an available driver for your trip.</p>
                </div>
            `;
        }
    }

    // Fare Card
    const fareContainer = document.getElementById('details-fare-breakdown');
    if (fareContainer) {
        fareContainer.innerHTML = `
            <div class="d-flex justify-content-between py-1 border-bottom">
                <span class="text-muted">Vehicle Type</span>
                <span class="fw-semibold">${b.vehicle_details?.vehicle_type || 'Vehicle'}</span>
            </div>
            <div class="d-flex justify-content-between py-1 border-bottom">
                <span class="text-muted">Base Fare</span>
                <span>${formatCurrency(b.base_fare)}</span>
            </div>
            <div class="d-flex justify-content-between py-1 border-bottom">
                <span class="text-muted">Distance Fare (${b.distance_km} KM @ ₹${b.price_per_km}/KM)</span>
                <span>${formatCurrency(b.distance_fare)}</span>
            </div>
            ${parseFloat(b.night_charge) > 0 ? `
                <div class="d-flex justify-content-between py-1 border-bottom text-warning">
                    <span>Night Surcharge</span>
                    <span>+${formatCurrency(b.night_charge)}</span>
                </div>
            ` : ''}
            ${parseFloat(b.additional_passenger_charge) > 0 ? `
                <div class="d-flex justify-content-between py-1 border-bottom">
                    <span>Extra Passenger Fee</span>
                    <span>+${formatCurrency(b.additional_passenger_charge)}</span>
                </div>
            ` : ''}
            <div class="d-flex justify-content-between py-2 mt-2 fw-bold fs-5 text-dark">
                <span>Total Amount</span>
                <span class="text-warning text-dark">${formatCurrency(b.total_fare)}</span>
            </div>
            <div class="d-flex justify-content-between mt-2 pt-2 border-top small">
                <span class="text-muted">Payment: <strong>${b.payment_method.toUpperCase()}</strong></span>
                <span class="badge ${b.payment_status === 'paid' ? 'bg-success' : 'bg-warning text-dark'}">${b.payment_status.toUpperCase()}</span>
            </div>
        `;
    }

    // Action Buttons (Cancel button or Review form)
    renderBookingActions(b);
}

// Render Visual Stepper
function renderTimelineStepper(currentStatus) {
    const stepperContainer = document.getElementById('booking-timeline-stepper');
    if (!stepperContainer) return;

    if (currentStatus === 'cancelled') {
        stepperContainer.innerHTML = `
            <div class="alert alert-danger text-center w-100 mb-0 py-3">
                <i class="bi bi-exclamation-octagon-fill fs-4 me-2"></i> This booking is <strong>CANCELLED</strong>.
            </div>
        `;
        return;
    }

    const steps = [
        { key: 'pending', label: 'Requested' },
        { key: 'driver_assigned', label: 'Driver Assigned' },
        { key: 'driver_arriving', label: 'Driver Arriving' },
        { key: 'trip_started', label: 'On Trip' },
        { key: 'trip_completed', label: 'Completed' }
    ];

    const statusOrder = ['pending', 'confirmed', 'driver_assigned', 'driver_arriving', 'trip_started', 'trip_completed'];
    const currentIndex = statusOrder.indexOf(currentStatus);

    stepperContainer.innerHTML = `
        <div class="timeline-stepper">
            ${steps.map((st, idx) => {
                const stepIdx = statusOrder.indexOf(st.key);
                let stateClass = '';
                let icon = 'bi-circle';

                if (currentIndex > stepIdx || currentStatus === 'trip_completed') {
                    stateClass = 'done';
                    icon = 'bi-check-lg';
                } else if (currentIndex === stepIdx || (st.key === 'pending' && currentStatus === 'confirmed')) {
                    stateClass = 'active';
                    icon = 'bi-record-fill';
                }

                return `
                    <div class="timeline-node ${stateClass}">
                        <div class="timeline-dot"><i class="bi ${icon}"></i></div>
                        <div class="timeline-label">${st.label}</div>
                    </div>
                `;
            }).join('')}
        </div>
    `;
}

// Render Actions (Cancel booking or Review form)
function renderBookingActions(b) {
    const actionsContainer = document.getElementById('details-actions-container');
    if (!actionsContainer) return;

    // Review Form if trip is completed
    if (b.status === 'trip_completed') {
        if (b.has_review) {
            actionsContainer.innerHTML = `
                <div class="card bg-light border-0 p-4 text-center">
                    <div class="text-warning fs-3 mb-2"><i class="bi bi-star-fill"></i><i class="bi bi-star-fill"></i><i class="bi bi-star-fill"></i><i class="bi bi-star-fill"></i><i class="bi bi-star-fill"></i></div>
                    <h6 class="fw-bold">Trip Reviewed!</h6>
                    <p class="text-muted small mb-0">Thank you for rating your JhazTaxi experience.</p>
                </div>
            `;
        } else {
            actionsContainer.innerHTML = `
                <div class="card border p-4 shadow-sm">
                    <h5 class="fw-bold mb-3"><i class="bi bi-star-fill text-warning me-2"></i>Rate Your Driver & Trip</h5>
                    <form onsubmit="handleReviewSubmit(event, '${b.booking_id}')">
                        <div class="mb-3">
                            <label class="form-label small fw-bold">Driver Rating</label>
                            <div class="rating-picker">
                                <input type="radio" id="star5" name="rating" value="5" required checked><label for="star5" title="5 stars"><i class="bi bi-star-fill"></i></label>
                                <input type="radio" id="star4" name="rating" value="4"><label for="star4" title="4 stars"><i class="bi bi-star-fill"></i></label>
                                <input type="radio" id="star3" name="rating" value="3"><label for="star3" title="3 stars"><i class="bi bi-star-fill"></i></label>
                                <input type="radio" id="star2" name="rating" value="2"><label for="star2" title="2 stars"><i class="bi bi-star-fill"></i></label>
                                <input type="radio" id="star1" name="rating" value="1"><label for="star1" title="1 star"><i class="bi bi-star-fill"></i></label>
                            </div>
                        </div>
                        <div class="mb-3">
                            <label class="form-label small fw-bold">Feedback / Experience Comment</label>
                            <textarea class="form-control" name="comment" rows="2" placeholder="Tell us how the ride was..." required></textarea>
                        </div>
                        <button type="submit" class="btn btn-yellow fw-bold">
                            <i class="bi bi-send-fill me-1"></i> Submit Review
                        </button>
                    </form>
                </div>
            `;
        }
        return;
    }

    // Cancel Button if still cancellable
    if (['pending', 'confirmed', 'driver_assigned', 'driver_arriving'].includes(b.status)) {
        actionsContainer.innerHTML = `
            <div class="d-flex justify-content-end">
                <button class="btn btn-outline-danger" onclick="promptCancelBooking('${b.booking_id}')">
                    <i class="bi bi-x-circle me-1"></i> Cancel Ride
                </button>
            </div>
        `;
    } else {
        actionsContainer.innerHTML = '';
    }
}

// Cancel Booking
async function promptCancelBooking(bookingId) {
    const reason = prompt('Please specify a reason for cancellation (optional):', 'Change of plans');
    if (reason === null) return; // User pressed cancel

    const res = await fetchWithAuth(`${CONFIG.API_BASE_URL}/bookings/${bookingId}/cancel/`, {
        method: 'POST',
        body: JSON.stringify({ reason: reason || 'Cancelled by customer' })
    });

    if (res.ok && res.data.success) {
        showToast('Ride has been cancelled.', 'info');
        loadBookingDetails();
    } else {
        showToast(res.data.message || 'Unable to cancel ride.', 'error');
    }
}

// Review Submission
async function handleReviewSubmit(event, bookingId) {
    event.preventDefault();
    const form = event.target;
    const rating = form.rating.value;
    const comment = form.comment.value.trim();
    const submitBtn = form.querySelector('button[type="submit"]');

    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Submitting...';

    const res = await fetchWithAuth(`${CONFIG.API_BASE_URL}/reviews/`, {
        method: 'POST',
        body: JSON.stringify({
            booking_id: bookingId,
            rating: parseInt(rating),
            comment: comment
        })
    });

    if (res.ok && res.data.success) {
        showToast('Review submitted successfully! Thank you.', 'success');
        loadBookingDetails();
    } else {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="bi bi-send-fill me-1"></i> Submit Review';
        showToast(res.data.message || 'Failed to submit review.', 'error');
    }
}

// 4. Load Customer Profile
async function loadCustomerProfile() {
    requireAuth();

    const res = await fetchWithAuth(`${CONFIG.API_BASE_URL}/auth/profile/`);
    if (res.ok && res.data.user) {
        const u = res.data.user;
        const form = document.getElementById('profile-form');
        if (form) {
            form.full_name.value = u.full_name || '';
            form.email.value = u.email || '';
            form.phone.value = u.phone_number || '';
            form.address.value = u.address || '';
        }
    }
}

// Handle Profile Update
async function handleProfileUpdate(event) {
    event.preventDefault();
    const form = event.target;
    const fullName = form.full_name.value.trim();
    const phone = form.phone.value.trim();
    const address = form.address.value.trim();
    const btn = form.querySelector('button[type="submit"]');

    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Saving...';

    const res = await fetchWithAuth(`${CONFIG.API_BASE_URL}/auth/profile/`, {
        method: 'PUT',
        body: JSON.stringify({
            full_name: fullName,
            phone_number: phone,
            address: address
        })
    });

    btn.disabled = false;
    btn.innerHTML = '<i class="bi bi-save me-1"></i> Update Profile';

    if (res.ok && res.data.success) {
        setAuthSession(getAuthToken(), res.data.user);
        showToast('Profile updated successfully!', 'success');
        updateNavbarAuthState();
    } else {
        showToast(res.data.message || 'Failed to update profile.', 'error');
    }
}

// 5. Load Customer Notifications
async function loadCustomerNotifications() {
    requireAuth();

    const container = document.getElementById('notifications-list');
    if (!container) return;

    container.innerHTML = '<div class="text-center py-4"><span class="spinner-border spinner-yellow"></span></div>';

    const res = await fetchWithAuth(`${CONFIG.API_BASE_URL}/notifications/`);
    if (res.ok && res.data.notifications) {
        const notifs = res.data.notifications;
        if (notifs.length === 0) {
            container.innerHTML = '<div class="card p-4 text-center text-muted">No notifications right now.</div>';
            return;
        }

        container.innerHTML = notifs.map(n => `
            <div class="card mb-3 border ${n.is_read ? 'bg-light' : 'border-warning shadow-sm'}">
                <div class="card-body">
                    <div class="d-flex justify-content-between align-items-center mb-1">
                        <h6 class="fw-bold mb-0 ${!n.is_read ? 'text-dark' : 'text-muted'}">${n.title}</h6>
                        <small class="text-muted">${new Date(n.created_at).toLocaleString()}</small>
                    </div>
                    <p class="mb-0 text-muted small">${n.message}</p>
                    ${n.booking_id_str ? `<a href="/user/booking-details.html?id=${n.booking_id_str}" class="btn btn-sm btn-link p-0 mt-2 text-warning text-dark fw-bold">View Ride ${n.booking_id_str} &rarr;</a>` : ''}
                </div>
            </div>
        `).join('');
    } else {
        container.innerHTML = '<div class="alert alert-danger">Failed to load notifications.</div>';
    }
}

async function markAllNotificationsRead() {
    const res = await fetchWithAuth(`${CONFIG.API_BASE_URL}/notifications/mark-read/`, { method: 'POST' });
    if (res.ok) {
        showToast('All notifications marked as read', 'info');
        loadCustomerNotifications();
    }
}
