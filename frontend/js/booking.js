/**
 * JhazTaxi - Booking Controller
 * Manages route selection, dynamic vehicle loading, backend fare calculation, and booking placement.
 */

let mapService = null;
let currentBookingState = {
    pickupAddress: '',
    pickupLat: null,
    pickupLng: null,
    dropAddress: '',
    dropLat: null,
    dropLng: null,
    distanceKm: 0,
    durationMins: 0,
    selectedVehicleId: null,
    selectedVehicleType: 'Sedan',
    pickupDate: '',
    pickupTime: '',
    passengers: 1,
    paymentMethod: 'cash',
    fareEstimate: null
};

let availableVehicles = [];

document.addEventListener('DOMContentLoaded', async () => {
    initBookingPage();
});

async function initBookingPage() {
    // Set default date & time
    const today = new Date().toISOString().split('T')[0];
    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    const dateInput = document.getElementById('pickup-date');
    const timeInput = document.getElementById('pickup-time');
    if (dateInput) dateInput.value = today;
    if (timeInput) timeInput.value = timeStr;

    currentBookingState.pickupDate = today;
    currentBookingState.pickupTime = timeStr;

    // Initialize Map
    if (document.getElementById('booking-map')) {
        mapService = new JhazMapService('booking-map', {
            onRouteCalculated: (routeData) => handleRouteCalculated(routeData)
        });
    }

    // Attach search event listeners with debounce
    setupLocationAutocomplete('pickup-address', 'pickup-suggestions', 'pickup');
    setupLocationAutocomplete('drop-address', 'drop-suggestions', 'drop');

    // Load Vehicles from API
    await loadVehicles();

    // Check for pre-filled query parameters (e.g. from homepage quick form)
    checkUrlBookingParams();
}

function checkUrlBookingParams() {
    const params = new URLSearchParams(window.location.search);
    const pickup = params.get('pickup');
    const drop = params.get('drop');
    const vType = params.get('vehicle');
    const name = params.get('name');
    const phone = params.get('phone');

    if (name) {
        const nameEl = document.getElementById('customer-name');
        if (nameEl) nameEl.value = name;
    }
    if (phone) {
        const phoneEl = document.getElementById('customer-phone');
        if (phoneEl) phoneEl.value = phone;
    }

    // If user is logged in, optionally pre-fill name and phone
    const currentUser = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
    if (currentUser) {
        const nameEl = document.getElementById('customer-name');
        const phoneEl = document.getElementById('customer-phone');
        if (nameEl && !nameEl.value) {
            nameEl.value = currentUser.first_name ? `${currentUser.first_name} ${currentUser.last_name || ''}`.trim() : currentUser.username;
        }
        if (phoneEl && !phoneEl.value && currentUser.phone_number) {
            phoneEl.value = currentUser.phone_number;
        }
    }

    if (pickup) {
        const input = document.getElementById('pickup-address');
        if (input) input.value = pickup;
        // Search and pick top match
        mapService.searchLocation(pickup).then(results => {
            if (results.length > 0) {
                mapService.setPickup(results[0].lat, results[0].lng, results[0].displayName);
            }
        });
    }

    if (drop) {
        const input = document.getElementById('drop-address');
        if (input) input.value = drop;
        mapService.searchLocation(drop).then(results => {
            if (results.length > 0) {
                mapService.setDrop(results[0].lat, results[0].lng, results[0].displayName);
            }
        });
    }

    if (vType) {
        const v = vType.toLowerCase();
        if (v.includes('crysta')) {
            currentBookingState.selectedVehicleType = 'Innova Crysta';
        } else if (v.includes('suv')) {
            currentBookingState.selectedVehicleType = 'SUV';
        } else {
            currentBookingState.selectedVehicleType = 'Sedan';
        }
    }
}

// Load vehicles dynamically from backend (Strictly Sedan, SUV & Innova Crysta)
async function loadVehicles() {
    const container = document.getElementById('vehicles-selection-list');
    if (!container) return;

    container.innerHTML = '<div class="text-center py-4"><span class="spinner-border spinner-yellow"></span><p class="mt-2 text-muted">Loading available vehicles...</p></div>';

    const res = await fetchWithAuth(`${CONFIG.API_BASE_URL}/vehicles/`);
    if (res.ok && res.data.vehicles) {
        // Strictly allow only Sedan, SUV, and Innova Crysta
        availableVehicles = res.data.vehicles.filter(v => 
            v.status === 'available' && ['sedan', 'suv', 'innova crysta'].includes((v.vehicle_type || '').toLowerCase())
        );
        renderVehicleCards(availableVehicles);
    } else {
        container.innerHTML = '<div class="alert alert-warning">Unable to load vehicles from server. Please ensure the backend is running.</div>';
    }
}

function renderVehicleCards(vehicles) {
    const container = document.getElementById('vehicles-selection-list');
    if (!container) return;

    if (vehicles.length === 0) {
        container.innerHTML = '<div class="text-muted p-3">No active vehicles found. Please contact administration.</div>';
        return;
    }

    // Default selection: currently selected or first vehicle
    let defaultVehicle = vehicles.find(v => v.vehicle_type.toLowerCase() === currentBookingState.selectedVehicleType.toLowerCase()) || vehicles[0];
    currentBookingState.selectedVehicleId = defaultVehicle.id;
    currentBookingState.selectedVehicleType = defaultVehicle.vehicle_type;

    let html = '';
    vehicles.forEach(v => {
        const isSelected = v.id === currentBookingState.selectedVehicleId;
        const vt = (v.vehicle_type || '').toLowerCase();
        
        let fallbackImg = 'https://images.unsplash.com/photo-1550355291-bbee04a92027?auto=format&fit=crop&w=300&q=80';
        let displayName = 'Sedan';
        let carSubtitle = 'Dzire / Etios (4+1 Seats AC)';

        if (vt.includes('crysta')) {
            fallbackImg = 'https://images.unsplash.com/photo-1549399542-7e3f8b79c341?auto=format&fit=crop&w=300&q=80';
            displayName = 'Innova Crysta';
            carSubtitle = 'Innova Crysta (7+1 Luxury AC)';
        } else if (vt.includes('suv')) {
            fallbackImg = 'https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?auto=format&fit=crop&w=300&q=80';
            displayName = 'SUV';
            carSubtitle = 'Innova / Ertiga (6+1 Seats AC)';
        }

        const imgUrl = v.image_url || fallbackImg;

        html += `
            <div class="vehicle-select-item ${isSelected ? 'selected' : ''}" id="v-card-${v.id}" onclick="selectVehicle(${v.id}, '${v.vehicle_type}')">
                <div class="d-flex align-items-center gap-3">
                    <img src="${imgUrl}" alt="${displayName}" class="vehicle-thumb" onerror="this.src='${fallbackImg}'">
                    <div>
                        <h6 class="mb-0 fw-bold fs-6">${displayName}</h6>
                        <small class="text-muted"><i class="bi bi-people-fill me-1"></i>${carSubtitle}</small>
                    </div>
                </div>
                <div class="text-end">
                    <div class="fw-bold text-dark fs-5">₹${parseFloat(v.price_per_km).toFixed(0)}<small class="text-muted fs-6">/KM</small></div>
                    <small class="text-muted">Min 130 KM Base</small>
                </div>
            </div>
        `;
    });

    container.innerHTML = html;
}

function selectVehicle(id, vehicleType) {
    currentBookingState.selectedVehicleId = id;
    currentBookingState.selectedVehicleType = vehicleType;

    // Highlight card
    document.querySelectorAll('.vehicle-select-item').forEach(el => el.classList.remove('selected'));
    const selectedEl = document.getElementById(`v-card-${id}`);
    if (selectedEl) selectedEl.classList.add('selected');

    // Recalculate fare if distance exists
    if (currentBookingState.distanceKm > 0) {
        requestFareCalculation();
    }
}

// When map routes are calculated
function handleRouteCalculated(routeData) {
    currentBookingState.distanceKm = routeData.distanceKm;
    currentBookingState.durationMins = routeData.durationMins;
    currentBookingState.pickupAddress = routeData.pickupAddress;
    currentBookingState.dropAddress = routeData.dropAddress;
    currentBookingState.pickupLat = routeData.pickupCoords[0];
    currentBookingState.pickupLng = routeData.pickupCoords[1];
    currentBookingState.dropLat = routeData.dropCoords[0];
    currentBookingState.dropLng = routeData.dropCoords[1];

    // Update map status banner
    const statusEl = document.getElementById('map-route-summary');
    if (statusEl) {
        statusEl.innerHTML = `
            <div>
                <strong><i class="bi bi-pin-map-fill me-1 text-warning"></i> Distance:</strong> ${routeData.distanceKm} KM &bull; 
                <strong><i class="bi bi-clock-fill me-1 text-warning"></i> Est. Duration:</strong> ${routeData.durationMins} mins
            </div>
        `;
    }

    requestFareCalculation();
}

// Fetch dynamic fare estimate from backend
async function requestFareCalculation() {
    if (!currentBookingState.distanceKm) return;

    const timeInput = document.getElementById('pickup-time');
    const passInput = document.getElementById('passengers-count');

    const pickupTime = timeInput ? timeInput.value : currentBookingState.pickupTime;
    const passengers = passInput ? parseInt(passInput.value) : currentBookingState.passengers;

    currentBookingState.pickupTime = pickupTime;
    currentBookingState.passengers = passengers;

    const res = await fetchWithAuth(`${CONFIG.API_BASE_URL}/fare/estimate/`, {
        method: 'POST',
        body: JSON.stringify({
            distance_km: currentBookingState.distanceKm,
            vehicle_type: currentBookingState.selectedVehicleType,
            pickup_time: pickupTime,
            passengers: passengers
        })
    });

    if (res.ok && res.data.estimate) {
        currentBookingState.fareEstimate = res.data.estimate;
        renderFareBreakdown(res.data.estimate);
    }
}

function renderFareBreakdown(est) {
    const card = document.getElementById('fare-breakdown-card');
    if (!card) return;

    const distNote = est.min_km_applied 
        ? `<span class="badge bg-warning-subtle text-dark border border-warning ms-1" style="font-size: 0.72rem;">Min ${est.min_km} KM Base</span>` 
        : '';

    card.innerHTML = `
        <h5 class="fw-bold mb-3 d-flex align-items-center justify-content-between">
            <span>Fare Estimation</span>
            <span class="badge bg-warning text-dark">${est.vehicle_type}</span>
        </h5>
        
        <!-- Base Distance Fare with Min 130 KM Rule -->
        <div class="d-flex justify-content-between align-items-center py-2 border-bottom">
            <div>
                <span class="text-dark fw-semibold">Distance (${est.distance_km} KM)</span> ${distNote}
                <div class="small text-muted">Billed: ${est.billable_km} KM @ ₹${est.price_per_km}/KM</div>
            </div>
            <span class="fw-bold fs-6">₹${est.distance_fare.toFixed(2)}</span>
        </div>

        <!-- Driver Bata (₹400) -->
        <div class="d-flex justify-content-between align-items-center py-2 border-bottom">
            <div>
                <span class="text-dark fw-semibold"><i class="bi bi-person-badge-fill text-success me-1"></i> Driver Bata</span>
                <div class="small text-muted">Standard one-way driver allowance</div>
            </div>
            <span class="fw-bold text-success fs-6">₹${parseFloat(est.driver_bata || 400).toFixed(2)}</span>
        </div>

        ${est.night_charge > 0 ? `
            <div class="d-flex justify-content-between py-2 border-bottom text-warning">
                <span><i class="bi bi-moon-stars-fill me-1"></i> Night Surcharge (10 PM - 6 AM)</span>
                <span class="fw-semibold">+₹${est.night_charge.toFixed(2)}</span>
            </div>
        ` : ''}
        ${est.additional_passenger_charge > 0 ? `
            <div class="d-flex justify-content-between py-2 border-bottom">
                <span class="text-muted">Extra Passengers Surcharge</span>
                <span class="fw-semibold">+₹${est.additional_passenger_charge.toFixed(2)}</span>
            </div>
        ` : ''}

        <!-- Total Fare Box -->
        <div class="fare-total-highlight mt-3">
            <div class="d-flex justify-content-between align-items-center">
                <div>
                    <div class="small text-white-50">Total Estimated Trip Fare</div>
                    <div class="total-price">₹${est.total_fare.toFixed(2)}</div>
                </div>
                <div class="text-end text-white-50 small">
                    <i class="bi bi-clock-history me-1"></i> ~${currentBookingState.durationMins} mins
                </div>
            </div>
        </div>

        <!-- Prominent Customer Notice: Toll, Parking, State Tax at actuals -->
        <div class="mt-3 p-3 rounded-3 bg-light border border-warning">
            <div class="d-flex align-items-center gap-2 mb-2">
                <i class="bi bi-shield-exclamation text-warning fs-5"></i>
                <strong class="text-dark small text-uppercase">Extra Charges Notice (Payable at Actuals)</strong>
            </div>
            <div class="row g-2 small text-muted">
                <div class="col-6"><i class="bi bi-signpost-split-fill text-primary me-1"></i> <strong>Toll:</strong> Fastag receipts</div>
                <div class="col-6"><i class="bi bi-p-square-fill text-primary me-1"></i> <strong>Parking:</strong> At actuals</div>
                <div class="col-6"><i class="bi bi-bank text-primary me-1"></i> <strong>State Tax:</strong> Interstate permit</div>
                <div class="col-6"><i class="bi bi-triangle-fill text-primary me-1"></i> <strong>Hill Charges:</strong> If applicable</div>
            </div>
        </div>

        <div class="mt-4">
            <label class="form-label fw-bold small text-uppercase">Payment Method</label>
            <div class="d-flex flex-column flex-sm-row gap-2">
                <div class="form-check p-3 border rounded-3 bg-light flex-grow-1">
                    <input class="form-check-input ms-0 me-2" type="radio" name="payment_method" id="pay_cash" value="cash" checked onchange="currentBookingState.paymentMethod = 'cash'; toggleGPayScannerBox(false)">
                    <label class="form-check-label fw-bold text-dark" for="pay_cash">
                        <i class="bi bi-cash-stack me-1 text-success fs-5 align-middle"></i> Cash on Delivery (COD)
                        <small class="d-block text-muted fw-normal">Pay cash directly to driver at destination</small>
                    </label>
                </div>
                <div class="form-check p-3 border rounded-3 bg-light flex-grow-1">
                    <input class="form-check-input ms-0 me-2" type="radio" name="payment_method" id="pay_upi" value="upi" onchange="currentBookingState.paymentMethod = 'upi'; toggleGPayScannerBox(true)">
                    <label class="form-check-label fw-bold text-dark" for="pay_upi">
                        <i class="bi bi-qr-code-scan me-1 text-primary fs-5 align-middle"></i> UPI / Google Pay / PhonePe
                        <small class="d-block text-muted fw-normal">Official Admin QR Scanner & Instant Payment</small>
                    </label>
                </div>
            </div>

            <!-- Dynamic Admin-Uploaded GPay Scanner Display -->
            <div id="booking-gpay-scanner-box" class="mt-3" style="display: none;"></div>
        </div>

        <button class="btn btn-yellow w-100 mt-4 py-3 fw-bold fs-5 shadow" id="btn-confirm-booking" onclick="submitBookingOrder()">
            <i class="bi bi-check-circle-fill me-2"></i> Confirm Booking Now
        </button>
    `;
}

// Dynamic GPay / UPI Scanner display for customer
async function toggleGPayScannerBox(show) {
    let box = document.getElementById('booking-gpay-scanner-box');
    if (!box) return;

    if (!show) {
        box.style.display = 'none';
        return;
    }

    box.style.display = 'block';
    box.innerHTML = `
        <div class="text-center py-3 bg-light rounded-3">
            <span class="spinner-border spinner-border-sm text-warning"></span>
            <span class="ms-2 small text-muted">Fetching official QR scanner...</span>
        </div>
    `;

    try {
        const res = await fetch(`${CONFIG.API_BASE_URL}/payment-settings/`);
        const data = await res.json();
        if (data.success && data.setting) {
            const s = data.setting;
            box.innerHTML = `
                <div class="border rounded-4 p-3 bg-white shadow-sm border-warning">
                    <div class="d-flex align-items-center justify-content-between mb-2 pb-2 border-bottom">
                        <span class="fw-bold text-dark"><i class="bi bi-qr-code-scan text-primary me-2"></i>Official Jhaz 1 Way Taxi QR Scanner (GPay / PhonePe / Paytm)</span>
                        <span class="badge bg-success-subtle text-success border border-success">Verified Business QR</span>
                    </div>
                    <div class="row align-items-center g-3">
                        <div class="col-sm-5 text-center">
                            <img src="${s.qr_image_url || '/assets/icons/favicon.svg'}" alt="Official QR Scanner" class="img-fluid rounded-3 shadow-sm border p-1" style="max-height: 180px;">
                            <div class="small text-muted mt-1"><i class="bi bi-shield-check text-success"></i> Scan to Pay ₹${currentBookingState.estimatedFare || 'Fare'}</div>
                        </div>
                        <div class="col-sm-7">
                            <div class="mb-2">
                                <small class="text-muted d-block">Payee Name:</small>
                                <span class="fw-bold text-dark">${s.payee_name || 'Jhaz 1 Way Taxi'}</span>
                            </div>
                            <div class="mb-2">
                                <small class="text-muted d-block">UPI ID / VPA:</small>
                                <div class="d-flex align-items-center gap-2">
                                    <code class="fw-bold fs-6 text-primary">${s.upi_id || '9043519772@upi'}</code>
                                    <button type="button" class="btn btn-outline-secondary btn-sm py-0 px-2" onclick="navigator.clipboard.writeText('${s.upi_id || '9043519772@upi'}'); showToast('UPI ID copied!', 'info')">
                                        <i class="bi bi-clipboard"></i> Copy
                                    </button>
                                </div>
                            </div>
                            <div class="alert alert-light border small text-muted mb-0 py-2">
                                <i class="bi bi-info-circle me-1"></i> ${s.instructions || 'Scan with Google Pay, PhonePe, Paytm, or any UPI app. You can also pay the driver directly upon arrival.'}
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }
    } catch (e) {
        box.style.display = 'none';
    }
}


// Submit Booking Order to Backend (Open to all customers - No login required)
async function submitBookingOrder() {
    const nameInput = document.getElementById('customer-name');
    const phoneInput = document.getElementById('customer-phone');
    const customerName = nameInput ? nameInput.value.trim() : '';
    const customerPhone = phoneInput ? phoneInput.value.trim() : '';

    if (!customerName) {
        showToast('Please enter your Name before booking.', 'warning');
        if (nameInput) nameInput.focus();
        return;
    }

    const cleanPhone = customerPhone.replace(/\D/g, '');
    if (!customerPhone || cleanPhone.length < 10) {
        showToast('Please enter a valid 10-digit mobile number.', 'warning');
        if (phoneInput) phoneInput.focus();
        return;
    }

    if (!currentBookingState.pickupAddress || !currentBookingState.dropAddress) {
        showToast('Please specify both pickup and destination locations.', 'error');
        return;
    }

    if (!currentBookingState.selectedVehicleId) {
        showToast('Please select a vehicle category.', 'error');
        return;
    }

    const btn = document.getElementById('btn-confirm-booking');
    if (btn) {
        btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Confirming Ride with Jhaz 1 Way Taxi...';
        btn.disabled = true;
    }

    const dateInput = document.getElementById('pickup-date');
    const timeInput = document.getElementById('pickup-time');
    const passInput = document.getElementById('passengers-count');
    const notesInput = document.getElementById('customer-notes');

    const payload = {
        customer_name: customerName,
        customer_phone: customerPhone,
        vehicle_id: currentBookingState.selectedVehicleId,
        pickup_address: currentBookingState.pickupAddress,
        pickup_lat: currentBookingState.pickupLat,
        pickup_lng: currentBookingState.pickupLng,
        drop_address: currentBookingState.dropAddress,
        drop_lat: currentBookingState.dropLat,
        drop_lng: currentBookingState.dropLng,
        pickup_date: dateInput ? dateInput.value : currentBookingState.pickupDate,
        pickup_time: timeInput ? timeInput.value : currentBookingState.pickupTime,
        passengers: passInput ? parseInt(passInput.value) : currentBookingState.passengers,
        distance_km: currentBookingState.distanceKm,
        duration_mins: currentBookingState.durationMins,
        payment_method: currentBookingState.paymentMethod,
        customer_notes: notesInput ? notesInput.value.trim() : ''
    };

    const res = await fetchWithAuth(`${CONFIG.API_BASE_URL}/bookings/`, {
        method: 'POST',
        body: JSON.stringify(payload)
    });

    if (res.ok && res.data.success) {
        const booking = res.data.booking;
        const whatsappUrl = res.data.whatsapp_url || generateWhatsAppBookingLink(booking, customerName, customerPhone);

        showToast('Booking placed successfully! Dispatch notified.', 'success');

        // Show comprehensive confirmation modal with tagline and direct WhatsApp button
        showBookingSuccessModal(booking, customerName, customerPhone, whatsappUrl);

        if (btn) {
            btn.innerHTML = '<i class="bi bi-check-circle-fill me-2"></i> Booking Placed Successfully!';
            btn.classList.remove('btn-yellow');
            btn.classList.add('btn-success');
            btn.disabled = false;
        }
    } else {
        if (btn) {
            btn.innerHTML = '<i class="bi bi-check-circle-fill me-2"></i> Confirm Booking Now';
            btn.disabled = false;
        }
        showToast(res.data.message || 'Unable to place booking. Please check details.', 'error');
    }
}

function generateWhatsAppBookingLink(booking, customerName, customerPhone) {
    const vType = booking.vehicle_details?.vehicle_type || 'Taxi';
    const vName = booking.vehicle_details?.name || '';
    const isMinApplied = (booking.billable_km && booking.billable_km > booking.distance_km) || (booking.distance_km < 130);
    const distText = isMinApplied
        ? `${booking.distance_km} KM (Min 130 KM Base applied)`
        : `${booking.distance_km} KM`;

    const text = 
        `🚕 *NEW BOOKING - JHAZ 1 WAY TAXI*\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `🆔 *Booking ID:* ${booking.booking_id}\n` +
        `👤 *Customer Name:* ${customerName}\n` +
        `📞 *Mobile Number:* ${customerPhone}\n` +
        `📍 *Pickup Location:* ${booking.pickup_address}\n` +
        `🏁 *Drop Destination:* ${booking.drop_address}\n` +
        `📅 *Date & Time:* ${booking.pickup_date} at ${booking.pickup_time}\n` +
        `🚗 *Vehicle Type:* ${vType} (${vName})\n` +
        `👥 *Passengers:* ${booking.passengers}\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `📊 *FARE BREAKDOWN:*\n` +
        `🛣️ *Distance:* ${distText}\n` +
        (booking.price_per_km ? `🏷️ *Rate:* ₹${booking.price_per_km}/KM\n` : '') +
        (booking.distance_fare ? `💵 *Distance Fare:* ₹${booking.distance_fare}\n` : '') +
        `👨‍✈️ *Driver Bata:* ₹${booking.driver_bata || 400}\n` +
        `💰 *Total Estimated Fare:* ₹${booking.total_fare}\n` +
        `💳 *Payment Mode:* ${(booking.payment_method || 'CASH').toUpperCase()}\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `⚠️ *Extra Charges Notice:*\n` +
        `• 🛣️ Toll Charges (Fastag) : At actuals\n` +
        `• 🅿️ Parking Charges : At actuals\n` +
        `• 🏛️ State Tax / Permit : At actuals (if interstate)\n` +
        (booking.customer_notes ? `📝 *Special Notes:* ${booking.customer_notes}\n` : '') +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `🚖 *Jhaz 1 Way Taxi*\n` +
        `Dispatch & WhatsApp: 9043519772`;

    return `https://api.whatsapp.com/send?phone=919043519772&text=${encodeURIComponent(text)}`;
}

function showBookingSuccessModal(booking, customerName, customerPhone, whatsappUrl) {
    let modalEl = document.getElementById('bookingSuccessModal');
    if (!modalEl) {
        modalEl = document.createElement('div');
        modalEl.className = 'modal fade';
        modalEl.id = 'bookingSuccessModal';
        modalEl.tabIndex = -1;
        modalEl.setAttribute('aria-hidden', 'true');
        modalEl.setAttribute('data-bs-backdrop', 'static');
        document.body.appendChild(modalEl);
    }

    const isMinApplied = (booking.billable_km && booking.billable_km > booking.distance_km) || (booking.distance_km < 130);

    modalEl.innerHTML = `
        <div class="modal-dialog modal-dialog-centered">
            <div class="modal-content rounded-4 border-0 shadow-lg overflow-hidden">
                <div class="bg-success p-4 text-center text-white position-relative">
                    <div class="rounded-circle bg-white text-success d-inline-flex align-items-center justify-content-center shadow mb-3" style="width: 70px; height: 70px;">
                        <i class="bi bi-check-lg display-5 fw-bold"></i>
                    </div>
                    <h3 class="fw-bold mb-1">Booking Confirmed!</h3>
                    <p class="mb-0 text-white-50">Booking Reference: <strong class="text-white text-uppercase tracking-wider">${booking.booking_id}</strong></p>
                </div>
                <div class="modal-body p-4">
                    <!-- Prominent Success Tagline requested by user -->
                    <div class="alert alert-success border-0 rounded-3 py-3 px-3 fw-bold text-center mb-3 shadow-sm" style="font-size: 1.05rem;">
                        <i class="bi bi-headset me-2 fs-5 text-success"></i> Successfully Booked! Our team will contact you shortly.
                    </div>

                    <div class="p-3 bg-light rounded-3 mb-3 border">
                        <div class="d-flex justify-content-between mb-2 pb-2 border-bottom">
                            <span class="text-muted small">Customer Name:</span>
                            <span class="fw-bold text-dark">${customerName}</span>
                        </div>
                        <div class="d-flex justify-content-between mb-2 pb-2 border-bottom">
                            <span class="text-muted small">Mobile Number:</span>
                            <span class="fw-bold text-dark">${customerPhone}</span>
                        </div>
                        <div class="mb-2 pb-2 border-bottom">
                            <span class="text-muted small d-block">Pickup Location:</span>
                            <strong class="text-success"><i class="bi bi-geo-alt-fill me-1"></i>${booking.pickup_address}</strong>
                        </div>
                        <div class="mb-2 pb-2 border-bottom">
                            <span class="text-muted small d-block">Drop Location:</span>
                            <strong class="text-danger"><i class="bi bi-flag-fill me-1"></i>${booking.drop_address}</strong>
                        </div>
                        <div class="d-flex justify-content-between mb-2 pb-2 border-bottom">
                            <span class="text-muted small">Pickup Schedule:</span>
                            <span class="fw-bold text-dark">${booking.pickup_date} at ${booking.pickup_time}</span>
                        </div>
                        <div class="d-flex justify-content-between mb-2 pb-2 border-bottom">
                            <span class="text-muted small">Vehicle:</span>
                            <span class="badge bg-warning text-dark">${booking.vehicle_details?.vehicle_type || 'Taxi'} (${booking.vehicle_details?.name || ''})</span>
                        </div>
                        <div class="d-flex justify-content-between mb-2 pb-2 border-bottom">
                            <span class="text-muted small">Distance &amp; Rate:</span>
                            <span class="fw-semibold text-dark">${booking.distance_km} KM ${isMinApplied ? '(Min 130 KM Base)' : ''}</span>
                        </div>
                        <div class="d-flex justify-content-between mb-2 pb-2 border-bottom">
                            <span class="text-muted small">Driver Bata:</span>
                            <span class="fw-semibold text-success">₹${booking.driver_bata || 400}</span>
                        </div>
                        <div class="d-flex justify-content-between align-items-center pt-1">
                            <span class="fw-bold text-dark fs-6">Total Estimated Fare:</span>
                            <span class="fs-4 fw-bold text-success">₹${booking.total_fare}</span>
                        </div>
                    </div>

                    <!-- Customer Extra Charges Reminder -->
                    <div class="alert alert-warning border-0 rounded-3 p-2 small mb-3 text-dark">
                        <i class="bi bi-info-circle-fill text-warning me-1"></i> <strong>Note:</strong> Toll charges (Fastag), Parking fees, and Interstate State Tax are extra at actuals.
                    </div>

                    <div class="d-grid gap-2">
                        <!-- Direct WhatsApp button -->
                        <a href="${whatsappUrl}" target="_blank" class="btn btn-success btn-lg fw-bold py-3 shadow d-flex align-items-center justify-content-center gap-2">
                            <i class="bi bi-whatsapp fs-4"></i> Chat on WhatsApp (Direct Confirmation)
                        </a>
                        <a href="tel:9043519772" class="btn btn-yellow fw-bold py-2 shadow-sm d-flex align-items-center justify-content-center gap-2">
                            <i class="bi bi-telephone-fill me-1"></i> Call Dispatch: 9043519772
                        </a>
                        <button type="button" class="btn btn-outline-secondary mt-1" data-bs-dismiss="modal" onclick="window.location.reload()">
                            Done • Book Another Ride
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;

    const bsModal = new bootstrap.Modal(modalEl);
    bsModal.show();
}

// Location autocomplete setup
function setupLocationAutocomplete(inputId, suggestionsId, type) {
    const input = document.getElementById(inputId);
    const list = document.getElementById(suggestionsId);
    if (!input || !list) return;

    let timeout = null;
    input.addEventListener('input', (e) => {
        clearTimeout(timeout);
        const query = e.target.value.trim();
        if (query.length < 3) {
            list.style.display = 'none';
            return;
        }

        timeout = setTimeout(async () => {
            const results = await mapService.searchLocation(query);
            if (results.length > 0) {
                list.innerHTML = results.map(item => `
                    <div class="suggestion-item" onclick="chooseSuggestedLocation('${type}', ${item.lat}, ${item.lng}, '${item.displayName.replace(/'/g, "\\'")}')">
                        <i class="bi bi-geo-alt-fill text-muted"></i>
                        <span>${item.displayName}</span>
                    </div>
                `).join('');
                list.style.display = 'block';
            } else {
                list.style.display = 'none';
            }
        }, 350);
    });

    // Close suggestion list on outer click
    document.addEventListener('click', (e) => {
        if (!input.contains(e.target) && !list.contains(e.target)) {
            list.style.display = 'none';
        }
    });
}

function chooseSuggestedLocation(type, lat, lng, displayName) {
    const inputId = type === 'pickup' ? 'pickup-address' : 'drop-address';
    const listId = type === 'pickup' ? 'pickup-suggestions' : 'drop-suggestions';

    const input = document.getElementById(inputId);
    const list = document.getElementById(listId);
    if (input) input.value = displayName;
    if (list) list.style.display = 'none';

    if (type === 'pickup') {
        mapService.setPickup(lat, lng, displayName);
    } else {
        mapService.setDrop(lat, lng, displayName);
    }
}

function triggerUseCurrentLocation(type = 'pickup') {
    const btn = document.getElementById(`btn-locate-${type}`);
    if (btn) btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span>';

    mapService.useCurrentLocation(type).then((res) => {
        const input = document.getElementById(`${type}-address`);
        if (input) input.value = res.address;
        showToast('Located current position successfully.', 'success');
    }).finally(() => {
        if (btn) btn.innerHTML = '<i class="bi bi-crosshair"></i>';
    });
}
