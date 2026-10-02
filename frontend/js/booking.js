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
        currentBookingState.selectedVehicleType = vType;
    }
}

// Load vehicles dynamically from backend
async function loadVehicles() {
    const container = document.getElementById('vehicles-selection-list');
    if (!container) return;

    container.innerHTML = '<div class="text-center py-4"><span class="spinner-border spinner-yellow"></span><p class="mt-2 text-muted">Loading available vehicles...</p></div>';

    const res = await fetchWithAuth(`${CONFIG.API_BASE_URL}/vehicles/`);
    if (res.ok && res.data.vehicles) {
        availableVehicles = res.data.vehicles.filter(v => v.status === 'available');
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

    // Default selection: Sedan or first vehicle
    let defaultVehicle = vehicles.find(v => v.vehicle_type.toLowerCase() === currentBookingState.selectedVehicleType.toLowerCase()) || vehicles[0];
    currentBookingState.selectedVehicleId = defaultVehicle.id;
    currentBookingState.selectedVehicleType = defaultVehicle.vehicle_type;

    let html = '';
    vehicles.forEach(v => {
        const isSelected = v.id === currentBookingState.selectedVehicleId;
        const fallbackImg = 'https://images.unsplash.com/photo-1549399542-7e3f8b79c341?auto=format&fit=crop&w=300&q=80';
        const imgUrl = v.image_url || fallbackImg;

        html += `
            <div class="vehicle-select-item ${isSelected ? 'selected' : ''}" id="v-card-${v.id}" onclick="selectVehicle(${v.id}, '${v.vehicle_type}')">
                <div class="d-flex align-items-center gap-3">
                    <img src="${imgUrl}" alt="${v.name}" class="vehicle-thumb" onerror="this.src='${fallbackImg}'">
                    <div>
                        <h6 class="mb-0 fw-bold">${v.name}</h6>
                        <small class="text-muted"><i class="bi bi-people-fill me-1"></i>${v.capacity} Seats &bull; <span class="badge bg-light text-dark">${v.vehicle_type}</span></small>
                    </div>
                </div>
                <div class="text-end">
                    <div class="fw-bold text-dark">₹${parseFloat(v.price_per_km).toFixed(0)}<small class="text-muted">/KM</small></div>
                    <small class="text-muted">Base: ₹${parseFloat(v.base_fare).toFixed(0)}</small>
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

    card.innerHTML = `
        <h5 class="fw-bold mb-3 d-flex align-items-center justify-content-between">
            <span>Fare Estimation</span>
            <span class="badge bg-warning text-dark">${est.vehicle_type}</span>
        </h5>
        
        <div class="d-flex justify-content-between py-2 border-bottom">
            <span class="text-muted">Distance (${est.distance_km} KM @ ₹${est.price_per_km}/KM)</span>
            <span class="fw-semibold">₹${est.distance_fare.toFixed(2)}</span>
        </div>
        <div class="d-flex justify-content-between py-2 border-bottom">
            <span class="text-muted">Base Ride Fare</span>
            <span class="fw-semibold">₹${est.base_fare.toFixed(2)}</span>
        </div>
        ${est.night_charge > 0 ? `
            <div class="d-flex justify-content-between py-2 border-bottom text-warning">
                <span><i class="bi bi-moon-stars-fill me-1"></i> Night Surcharge</span>
                <span class="fw-semibold">+₹${est.night_charge.toFixed(2)}</span>
            </div>
        ` : ''}
        ${est.additional_passenger_charge > 0 ? `
            <div class="d-flex justify-content-between py-2 border-bottom">
                <span class="text-muted">Extra Passengers Surcharge</span>
                <span class="fw-semibold">+₹${est.additional_passenger_charge.toFixed(2)}</span>
            </div>
        ` : ''}

        <div class="fare-total-highlight mt-3">
            <div class="d-flex justify-content-between align-items-center">
                <div>
                    <div class="small text-white-50">Total Estimated Fare</div>
                    <div class="total-price">₹${est.total_fare.toFixed(2)}</div>
                </div>
                <div class="text-end text-white-50 small">
                    <i class="bi bi-clock-history me-1"></i> ~${currentBookingState.durationMins} mins
                </div>
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
                    <input class="form-check-input ms-0 me-2" type="radio" name="payment_method" id="pay_gpay" value="gpay" onchange="currentBookingState.paymentMethod = 'gpay'; toggleGPayScannerBox(true)">
                    <label class="form-check-label fw-bold text-dark" for="pay_gpay">
                        <i class="bi bi-google me-1 text-primary fs-5 align-middle"></i> Google Pay (GPay)
                        <small class="d-block text-muted fw-normal">Official Admin GPay QR Scanner</small>
                    </label>
                </div>
                <div class="form-check p-3 border rounded-3 bg-light flex-grow-1">
                    <input class="form-check-input ms-0 me-2" type="radio" name="payment_method" id="pay_upi" value="upi" onchange="currentBookingState.paymentMethod = 'upi'; toggleGPayScannerBox(true)">
                    <label class="form-check-label fw-bold text-dark" for="pay_upi">
                        <i class="bi bi-qr-code-scan me-1 text-info fs-5 align-middle"></i> PhonePe / Paytm / UPI
                        <small class="d-block text-muted fw-normal">Official Admin UPI QR Scanner</small>
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

// Dynamic GPay Scanner display for customer
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
            <span class="ms-2 small text-muted">Fetching official GPay scanner...</span>
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
                        <span class="fw-bold text-dark"><i class="bi bi-google text-primary me-2"></i>Official JhazTaxi GPay Scanner</span>
                        <span class="badge bg-success-subtle text-success border border-success">Verified Business QR</span>
                    </div>
                    <div class="row align-items-center g-3">
                        <div class="col-sm-5 text-center">
                            <img src="${s.qr_image_url || '/assets/icons/favicon.svg'}" alt="Official GPay Scanner" class="img-fluid rounded-3 shadow-sm border p-1" style="max-height: 180px;">
                            <div class="small text-muted mt-1"><i class="bi bi-shield-check text-success"></i> Scan to Pay ₹${currentBookingState.estimatedFare || 'Fare'}</div>
                        </div>
                        <div class="col-sm-7">
                            <div class="mb-2">
                                <small class="text-muted d-block">Payee Name:</small>
                                <span class="fw-bold text-dark">${s.payee_name || 'JhazTaxi Travels'}</span>
                            </div>
                            <div class="mb-2">
                                <small class="text-muted d-block">UPI ID / VPA:</small>
                                <div class="d-flex align-items-center gap-2">
                                    <code class="fw-bold fs-6 text-primary">${s.upi_id || 'jhaztaxi@upi'}</code>
                                    <button type="button" class="btn btn-outline-secondary btn-sm py-0 px-2" onclick="navigator.clipboard.writeText('${s.upi_id}'); showToast('UPI ID copied!', 'info')">
                                        <i class="bi bi-clipboard"></i> Copy
                                    </button>
                                </div>
                            </div>
                            <div class="alert alert-light border small text-muted mb-0 py-2">
                                <i class="bi bi-info-circle me-1"></i> ${s.instructions || 'You can scan and pay now or pay the driver directly upon arrival.'}
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


// Submit Booking Order to Backend
async function submitBookingOrder() {
    const token = getAuthToken();
    if (!token) {
        showToast('Please login to complete your taxi booking.', 'warning');
        // Save state to sessionStorage to resume after login
        sessionStorage.setItem('pending_booking_state', JSON.stringify(currentBookingState));
        setTimeout(() => {
            window.location.href = `/login.html?next=${encodeURIComponent(window.location.pathname + window.location.search)}`;
        }, 1200);
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
        btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Confirming Ride with JhazTaxi...';
        btn.disabled = true;
    }

    const dateInput = document.getElementById('pickup-date');
    const timeInput = document.getElementById('pickup-time');
    const passInput = document.getElementById('passengers-count');
    const notesInput = document.getElementById('customer-notes');

    const payload = {
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
        showToast(res.data.message || 'Ride booked successfully!', 'success');
        const bookingId = res.data.booking.booking_id;
        setTimeout(() => {
            window.location.href = `/user/booking-details.html?id=${bookingId}`;
        }, 1000);
    } else {
        if (btn) {
            btn.innerHTML = '<i class="bi bi-check-circle-fill me-2"></i> Confirm Booking Now';
            btn.disabled = false;
        }
        showToast(res.data.message || 'Unable to place booking. Please check details.', 'error');
    }
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
