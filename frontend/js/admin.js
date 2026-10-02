/**
 * JhazTaxi - Administrator Management Controller
 */

// Helper to format currency
function adminCurrency(val) {
    return `${CONFIG.CURRENCY_SYMBOL}${parseFloat(val || 0).toFixed(2)}`;
}

// 1. Admin Dashboard Metrics & Chart.js Integration
async function loadAdminDashboard() {
    requireAdmin();

    const res = await fetchWithAuth(`${CONFIG.API_BASE_URL}/admin/dashboard-stats/`);
    if (!res.ok || !res.data.success) {
        showToast('Unable to load admin metrics.', 'error');
        return;
    }

    const s = res.data.stats;

    // Metric KPI values
    const mapFields = {
        'kpi-total-bookings': s.total_bookings,
        'kpi-today-bookings': s.today_bookings,
        'kpi-pending-bookings': s.pending_bookings,
        'kpi-confirmed-bookings': s.confirmed_bookings,
        'kpi-completed-trips': s.completed_trips,
        'kpi-cancelled-trips': s.cancelled_trips,
        'kpi-total-drivers': s.total_drivers,
        'kpi-available-drivers': s.available_drivers,
        'kpi-total-customers': s.total_customers,
        'kpi-total-revenue': adminCurrency(s.total_revenue),
    };

    for (const [id, val] of Object.entries(mapFields)) {
        const el = document.getElementById(id);
        if (el) el.textContent = val;
    }

    // Render Charts if Chart.js is present
    if (typeof Chart !== 'undefined' && s.charts) {
        renderAdminCharts(s.charts);
    }
}

function renderAdminCharts(chartsData) {
    // 1. Daily Bookings Trend Chart
    const dailyCanvas = document.getElementById('chart-daily-bookings');
    if (dailyCanvas) {
        new Chart(dailyCanvas, {
            type: 'bar',
            data: {
                labels: chartsData.daily_labels,
                datasets: [
                    {
                        label: 'Trips Placed',
                        data: chartsData.daily_counts,
                        backgroundColor: '#FFC107',
                        borderRadius: 6
                    },
                    {
                        label: 'Revenue (₹)',
                        data: chartsData.daily_revenue,
                        type: 'line',
                        borderColor: '#0F172A',
                        backgroundColor: 'transparent',
                        borderWidth: 2.5,
                        yAxisID: 'y1'
                    }
                ]
            },
            options: {
                responsive: true,
                scales: {
                    y: { beginAtZero: true, title: { display: true, text: 'Trips' } },
                    y1: { beginAtZero: true, position: 'right', grid: { drawOnChartArea: false }, title: { display: true, text: 'Revenue (₹)' } }
                }
            }
        });
    }

    // 2. Status Distribution Donut Chart
    const statusCanvas = document.getElementById('chart-status-distribution');
    if (statusCanvas) {
        const dist = chartsData.status_distribution;
        new Chart(statusCanvas, {
            type: 'doughnut',
            data: {
                labels: ['Completed', 'Confirmed/Assigned', 'Pending', 'Cancelled'],
                datasets: [{
                    data: [dist.completed, dist.confirmed, dist.pending, dist.cancelled],
                    backgroundColor: ['#10B981', '#3B82F6', '#F59E0B', '#EF4444']
                }]
            },
            options: {
                responsive: true,
                plugins: { legend: { position: 'bottom' } }
            }
        });
    }
}

// 2. Admin Bookings Controller
let activeAssignBookingId = null;

async function loadAdminBookings() {
    requireAdmin();

    const tbody = document.getElementById('admin-bookings-tbody');
    if (!tbody) return;

    const filterStatus = document.getElementById('filter-booking-status')?.value || 'all';
    const filterType = document.getElementById('filter-booking-type')?.value || '';
    const search = document.getElementById('filter-booking-search')?.value.trim() || '';

    tbody.innerHTML = `<tr><td colspan="10" class="text-center py-4"><span class="spinner-border spinner-yellow"></span></td></tr>`;

    let url = `${CONFIG.API_BASE_URL}/bookings/?status=${filterStatus}`;
    if (filterType) url += `&filter=${filterType}`;
    if (search) url += `&search=${encodeURIComponent(search)}`;

    const res = await fetchWithAuth(url);
    if (res.ok && res.data.bookings) {
        const bookings = res.data.bookings;
        if (bookings.length === 0) {
            tbody.innerHTML = `<tr><td colspan="10" class="text-center py-4 text-muted">No bookings match the selected criteria.</td></tr>`;
            return;
        }

        tbody.innerHTML = bookings.map(b => `
            <tr>
                <td class="fw-bold">${b.booking_id}</td>
                <td>
                    <strong>${b.customer_name || 'Customer'}</strong><br>
                    <small class="text-muted">${b.customer_phone || b.customer_email || ''}</small>
                </td>
                <td>
                    <div class="small fw-semibold text-truncate" style="max-width: 170px;" title="${b.pickup_address}"><i class="bi bi-circle-fill text-success me-1"></i>${b.pickup_address}</div>
                    <div class="small text-muted text-truncate" style="max-width: 170px;" title="${b.drop_address}"><i class="bi bi-square-fill text-danger me-1"></i>${b.drop_address}</div>
                </td>
                <td>${b.pickup_date}<br><small class="text-muted">${b.pickup_time}</small></td>
                <td>${b.distance_km} KM</td>
                <td><span class="badge bg-light text-dark border">${b.vehicle_details?.vehicle_type || 'Vehicle'}</span></td>
                <td>
                    ${b.driver_details ? `
                        <strong>${b.driver_details.name}</strong><br>
                        <small class="text-muted">${b.driver_details.phone}</small>
                    ` : `
                        <button class="btn btn-sm btn-yellow py-0 px-2 fw-bold" onclick="openAssignDriverModal('${b.booking_id}')">
                            <i class="bi bi-person-plus-fill me-1"></i> Assign
                        </button>
                    `}
                </td>
                <td class="fw-bold">${adminCurrency(b.total_fare)}</td>
                <td>${renderStatusBadge(b.status)}</td>
                <td>
                    <div class="dropdown">
                        <button class="btn btn-sm btn-light border dropdown-toggle" type="button" data-bs-toggle="dropdown">Actions</button>
                        <ul class="dropdown-menu dropdown-menu-end shadow">
                            <li><h6 class="dropdown-header">Manage Trip</h6></li>
                            <li><a class="dropdown-item" href="javascript:void(0)" onclick="openAssignDriverModal('${b.booking_id}')"><i class="bi bi-person-check me-2"></i>Assign/Reassign Driver</a></li>
                            <li><a class="dropdown-item" href="javascript:void(0)" onclick="quickUpdateStatus('${b.booking_id}', 'confirmed')"><i class="bi bi-check-circle me-2 text-primary"></i>Mark Confirmed</a></li>
                            <li><a class="dropdown-item" href="javascript:void(0)" onclick="quickUpdateStatus('${b.booking_id}', 'driver_arriving')"><i class="bi bi-geo me-2 text-info"></i>Driver Arriving</a></li>
                            <li><a class="dropdown-item" href="javascript:void(0)" onclick="quickUpdateStatus('${b.booking_id}', 'trip_started')"><i class="bi bi-car-front me-2 text-warning"></i>Trip Started</a></li>
                            <li><a class="dropdown-item" href="javascript:void(0)" onclick="quickUpdateStatus('${b.booking_id}', 'trip_completed')"><i class="bi bi-check2-all me-2 text-success"></i>Trip Completed</a></li>
                            <li><hr class="dropdown-divider"></li>
                            <li><a class="dropdown-item text-danger" href="javascript:void(0)" onclick="quickUpdateStatus('${b.booking_id}', 'cancelled')"><i class="bi bi-x-circle me-2"></i>Cancel Booking</a></li>
                            <li><a class="dropdown-item text-danger" href="javascript:void(0)" onclick="deleteBookingRecord('${b.booking_id}')"><i class="bi bi-trash me-2"></i>Delete</a></li>
                        </ul>
                    </div>
                </td>
            </tr>
        `).join('');
    } else {
        tbody.innerHTML = `<tr><td colspan="10" class="text-center py-4 text-danger">Failed to load bookings.</td></tr>`;
    }
}

// Open Driver Assignment Modal
async function openAssignDriverModal(bookingId) {
    activeAssignBookingId = bookingId;
    const modalEl = document.getElementById('assignDriverModal');
    const select = document.getElementById('assign-driver-select');
    if (!modalEl || !select) return;

    select.innerHTML = '<option value="">Loading available drivers...</option>';
    const modal = new bootstrap.Modal(modalEl);
    modal.show();

    const res = await fetchWithAuth(`${CONFIG.API_BASE_URL}/drivers/available/`);
    if (res.ok && res.data.drivers) {
        const drivers = res.data.drivers;
        if (drivers.length === 0) {
            select.innerHTML = '<option value="">No drivers are currently available (all are on trip or offline)</option>';
            return;
        }

        select.innerHTML = '<option value="">-- Choose an Available Driver --</option>' +
            drivers.map(d => `<option value="${d.id}">${d.name} (${d.phone}) - ${d.vehicle_type || 'Vehicle'} [${d.rating}★]</option>`).join('');
    }
}

// Confirm Driver Assignment
async function confirmDriverAssignment() {
    const select = document.getElementById('assign-driver-select');
    const driverId = select?.value;
    if (!driverId) {
        showToast('Please select a driver from the list.', 'warning');
        return;
    }

    const res = await fetchWithAuth(`${CONFIG.API_BASE_URL}/bookings/${activeAssignBookingId}/assign-driver/`, {
        method: 'POST',
        body: JSON.stringify({ driver_id: driverId })
    });

    if (res.ok && res.data.success) {
        showToast('Driver assigned successfully!', 'success');
        const modalEl = document.getElementById('assignDriverModal');
        const modal = bootstrap.Modal.getInstance(modalEl);
        if (modal) modal.hide();
        loadAdminBookings();
    } else {
        showToast(res.data.message || 'Driver assignment failed.', 'error');
    }
}

// Quick Status Update
async function quickUpdateStatus(bookingId, newStatus) {
    let reason = '';
    if (newStatus === 'cancelled') {
        reason = prompt('Reason for cancelling:', 'Administrative cancellation') || 'Cancelled by admin';
    }

    const res = await fetchWithAuth(`${CONFIG.API_BASE_URL}/bookings/${bookingId}/status/`, {
        method: 'POST',
        body: JSON.stringify({ status: newStatus, reason: reason })
    });

    if (res.ok && res.data.success) {
        showToast(`Trip status updated to ${newStatus.replace('_', ' ')}`, 'success');
        loadAdminBookings();
    } else {
        showToast(res.data.message || 'Failed to update status.', 'error');
    }
}

// Delete Booking
async function deleteBookingRecord(bookingId) {
    if (!confirm(`Are you sure you want to permanently delete booking ${bookingId}?`)) return;

    const res = await fetchWithAuth(`${CONFIG.API_BASE_URL}/bookings/${bookingId}/`, {
        method: 'DELETE'
    });

    if (res.ok && res.data.success) {
        showToast('Booking deleted.', 'info');
        loadAdminBookings();
    } else {
        showToast(res.data.message || 'Failed to delete booking.', 'error');
    }
}

// 3. Admin Drivers Management
async function loadAdminDrivers() {
    requireAdmin();

    const tbody = document.getElementById('admin-drivers-tbody');
    if (!tbody) return;

    tbody.innerHTML = `<tr><td colspan="8" class="text-center py-4"><span class="spinner-border spinner-yellow"></span></td></tr>`;

    const res = await fetchWithAuth(`${CONFIG.API_BASE_URL}/drivers/`);
    if (res.ok && res.data.drivers) {
        const drivers = res.data.drivers;
        if (drivers.length === 0) {
            tbody.innerHTML = `<tr><td colspan="8" class="text-center py-4 text-muted">No drivers registered. Click "+ Add Driver" to create one.</td></tr>`;
            return;
        }

        tbody.innerHTML = drivers.map(d => {
            const driverPhoto = d.display_profile_photo || d.profile_photo || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=100&q=80';
            const carPhoto = d.display_car_photo || d.car_photo || 'https://images.unsplash.com/photo-1550355291-bbee04a92027?auto=format&fit=crop&w=120&q=80';
            const vehiclePlate = d.vehicle_number || (d.vehicle_details ? d.vehicle_details.vehicle_number : 'N/A');
            const vehicleName = d.vehicle_name || (d.vehicle_details ? d.vehicle_details.name : 'Registered Car');
            
            return `
            <tr>
                <td>
                    <div class="d-flex align-items-center gap-2">
                        <img src="${driverPhoto}" class="rounded-circle border shadow-sm" width="46" height="46" style="object-fit: cover;" alt="${d.name}" onerror="this.src='https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=100&q=80'">
                        <div>
                            <strong class="d-block text-dark">${d.name}</strong>
                            <small class="text-muted">ID: #${d.id}</small>
                        </div>
                    </div>
                </td>
                <td>
                    <span class="fw-bold text-dark"><i class="bi bi-telephone-fill text-primary me-1"></i>${d.phone}</span>
                </td>
                <td>
                    ${d.email ? `<span class="small text-muted"><i class="bi bi-envelope me-1"></i>${d.email}</span>` : `<span class="badge bg-light text-muted border">None</span>`}
                </td>
                <td>
                    <div class="d-flex align-items-center gap-2">
                        <img src="${carPhoto}" class="rounded border shadow-sm" width="60" height="40" style="object-fit: cover;" alt="Car" onerror="this.src='https://images.unsplash.com/photo-1550355291-bbee04a92027?auto=format&fit=crop&w=120&q=80'">
                        <div>
                            <span class="badge bg-warning text-dark border fw-bold font-monospace">${vehiclePlate}</span>
                            <div class="small text-muted" style="font-size: 0.75rem;">${vehicleName}</div>
                        </div>
                    </div>
                </td>
                <td><code class="fw-bold">${d.license_number}</code></td>
                <td><i class="bi bi-star-fill text-warning me-1"></i>${d.rating}★ <small class="text-muted">(${d.total_ratings_count || 0})</small></td>
                <td><span class="driver-pill-${d.status}">${d.status.toUpperCase()}</span></td>
                <td>
                    <div class="btn-group btn-group-sm">
                        <button class="btn btn-outline-dark" onclick="toggleDriverStatus(${d.id}, '${d.status}')" title="Toggle Available/Offline">
                            <i class="bi bi-arrow-repeat"></i>
                        </button>
                        <button class="btn btn-outline-danger" onclick="deleteDriverRecord(${d.id})" title="Delete Driver">
                            <i class="bi bi-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
            `;
        }).join('');
    }
}

async function toggleDriverStatus(driverId, currentStatus) {
    const nextStatus = currentStatus === 'available' ? 'offline' : 'available';
    const res = await fetchWithAuth(`${CONFIG.API_BASE_URL}/drivers/${driverId}/status/`, {
        method: 'PATCH',
        body: JSON.stringify({ status: nextStatus })
    });

    if (res.ok) {
        showToast(`Driver status toggled to ${nextStatus}`, 'info');
        loadAdminDrivers();
    }
}

async function handleAddDriver(event) {
    event.preventDefault();
    const form = event.target;
    const saveBtn = document.getElementById('btn-save-driver') || form.querySelector('button[type="submit"]');

    const name = form.name.value.trim();
    const phone = form.phone.value.trim();
    const vehicleNumber = form.vehicle_number.value.trim();
    const licenseNumber = form.license_number.value.trim();
    const profileImg = form.profile_image ? form.profile_image.files[0] : null;
    const carImg = form.car_image ? form.car_image.files[0] : null;

    if (!phone) {
        showToast('Mobile phone number is required.', 'error');
        return;
    }
    if (!vehicleNumber) {
        showToast('Vehicle plate registration number is compulsory.', 'error');
        return;
    }
    if (!profileImg) {
        showToast('Driver profile picture is compulsory. Please select an image.', 'error');
        return;
    }
    if (!carImg) {
        showToast('Car picture is compulsory. Please select an image.', 'error');
        return;
    }

    if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>Registering Driver & Car...';
    }

    const formData = new FormData();
    formData.append('name', name);
    formData.append('phone', phone);
    if (form.email && form.email.value.trim()) {
        formData.append('email', form.email.value.trim());
    }
    formData.append('vehicle_number', vehicleNumber);
    formData.append('license_number', licenseNumber);
    if (form.vehicle_type && form.vehicle_type.value) {
        formData.append('vehicle_type', form.vehicle_type.value);
    }
    if (form.address && form.address.value.trim()) {
        formData.append('address', form.address.value.trim());
    }
    formData.append('profile_image', profileImg);
    formData.append('car_image', carImg);
    formData.append('status', 'available');

    try {
        const res = await fetchWithAuth(`${CONFIG.API_BASE_URL}/drivers/`, {
            method: 'POST',
            body: formData
        });

        if (res.ok && res.data.success) {
            showToast('Driver and vehicle registered successfully!', 'success');
            const modalEl = document.getElementById('addDriverModal');
            if (modalEl) {
                const modal = bootstrap.Modal.getInstance(modalEl);
                if (modal) modal.hide();
            }
            form.reset();
            const pPreview = document.getElementById('driver-photo-preview');
            if (pPreview) pPreview.classList.add('d-none');
            const cPreview = document.getElementById('driver-car-preview');
            if (cPreview) cPreview.classList.add('d-none');
            loadAdminDrivers();
        } else {
            let errMsg = 'Failed to register driver.';
            if (res.data && res.data.errors) {
                errMsg = Object.entries(res.data.errors)
                    .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`)
                    .join(' | ');
            } else if (res.data && res.data.message) {
                errMsg = res.data.message;
            }
            showToast(errMsg, 'error');
        }
    } catch (err) {
        console.error(err);
        showToast('Error occurred while registering driver.', 'error');
    } finally {
        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.innerHTML = '<i class="bi bi-check-circle-fill me-1"></i> Register Driver & Car';
        }
    }
}

async function deleteDriverRecord(driverId) {
    if (!confirm('Are you sure you want to delete this driver?')) return;
    const res = await fetchWithAuth(`${CONFIG.API_BASE_URL}/drivers/${driverId}/`, { method: 'DELETE' });
    if (res.ok) {
        showToast('Driver removed.', 'info');
        loadAdminDrivers();
    }
}

// 4. Admin Vehicles Management
async function loadAdminVehicles() {
    requireAdmin();

    const tbody = document.getElementById('admin-vehicles-tbody');
    if (!tbody) return;

    tbody.innerHTML = `<tr><td colspan="8" class="text-center py-4"><span class="spinner-border spinner-yellow"></span></td></tr>`;

    const res = await fetchWithAuth(`${CONFIG.API_BASE_URL}/vehicles/`);
    if (res.ok && res.data.vehicles) {
        const vehicles = res.data.vehicles;
        tbody.innerHTML = vehicles.map(v => {
            const fallback = 'https://images.unsplash.com/photo-1549399542-7e3f8b79c341?auto=format&fit=crop&w=150&q=80';
            const img = v.display_image || v.image_url || fallback;
            return `
            <tr>
                <td>
                    <img src="${img}" alt="${v.name}" class="rounded border shadow-sm" style="width: 55px; height: 38px; object-fit: cover;" onerror="this.src='${fallback}'">
                </td>
                <td><strong>${v.name}</strong></td>
                <td><span class="badge bg-warning text-dark">${v.vehicle_type}</span></td>
                <td><code>${v.vehicle_number}</code></td>
                <td>${v.capacity} Seats</td>
                <td>${adminCurrency(v.base_fare)}</td>
                <td>${adminCurrency(v.price_per_km)}/KM</td>
                <td>
                    <button class="btn btn-sm btn-outline-danger" onclick="deleteVehicleRecord(${v.id})">
                        <i class="bi bi-trash"></i>
                    </button>
                </td>
            </tr>
            `;
        }).join('');
    }
}

async function handleAddVehicle(event) {
    event.preventDefault();
    const form = event.target;
    const saveBtn = document.getElementById('btn-save-vehicle');
    if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>Uploading & Saving...';
    }

    const formData = new FormData();
    formData.append('name', form.name.value.trim());
    formData.append('vehicle_type', form.vehicle_type.value);
    formData.append('vehicle_number', form.vehicle_number.value.trim());
    formData.append('model', form.model.value.trim());
    formData.append('capacity', form.capacity.value);
    formData.append('base_fare', form.base_fare.value);
    formData.append('price_per_km', form.price_per_km.value);
    formData.append('status', 'available');

    if (form.description && form.description.value) {
        formData.append('description', form.description.value.trim());
    }

    // Check if image file uploaded
    if (form.image && form.image.files && form.image.files[0]) {
        formData.append('image', form.image.files[0]);
    } else if (form.image_url && form.image_url.value.trim()) {
        formData.append('image_url', form.image_url.value.trim());
    }

    // Authenticated API request with Token
    const token = getAuthToken();
    const headers = {};
    if (token) headers['Authorization'] = `Token ${token}`;

    try {
        const response = await fetch(`${CONFIG.API_BASE_URL}/vehicles/`, {
            method: 'POST',
            headers: headers,
            body: formData
        });
        const resData = await response.json();

        if (response.ok && resData.success) {
            showToast('Vehicle with photograph added successfully!', 'success');
            const modal = bootstrap.Modal.getInstance(document.getElementById('addVehicleModal'));
            if (modal) modal.hide();
            form.reset();
            const previewWrapper = document.getElementById('image-preview-wrapper');
            if (previewWrapper) previewWrapper.classList.add('d-none');
            loadAdminVehicles();
        } else {
            const err = resData.errors ? Object.values(resData.errors).flat().join(', ') : (resData.message || 'Failed to save vehicle');
            showToast(err, 'error');
        }
    } catch (e) {
        showToast('Network error while uploading vehicle.', 'error');
    } finally {
        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.innerHTML = 'Add Vehicle';
        }
    }
}

async function deleteVehicleRecord(vId) {
    if (!confirm('Are you sure you want to delete this vehicle?')) return;
    const res = await fetchWithAuth(`${CONFIG.API_BASE_URL}/vehicles/${vId}/`, { method: 'DELETE' });
    if (res.ok) {
        showToast('Vehicle deleted.', 'info');
        loadAdminVehicles();
    }
}

// 5. Admin Fare Settings
async function loadAdminFares() {
    requireAdmin();

    const container = document.getElementById('fares-cards-container');
    if (!container) return;

    const res = await fetchWithAuth(`${CONFIG.API_BASE_URL}/fare/`);
    if (res.ok && res.data.fares) {
        container.innerHTML = res.data.fares.map(f => `
            <div class="col-md-6 col-lg-3">
                <div class="card shadow-sm h-100 border-top border-4 border-warning">
                    <div class="card-body">
                        <h5 class="fw-bold mb-3 d-flex justify-content-between align-items-center">
                            <span>${f.vehicle_type}</span>
                            <span class="badge bg-light text-dark border">Active</span>
                        </h5>
                        <form onsubmit="handleUpdateFareSetting(event, '${f.vehicle_type}')">
                            <div class="mb-2">
                                <label class="small text-muted fw-bold">Base Fare (₹)</label>
                                <input type="number" step="0.5" class="form-control form-control-sm" name="base_fare" value="${f.base_fare}">
                            </div>
                            <div class="mb-2">
                                <label class="small text-muted fw-bold">Price per KM (₹)</label>
                                <input type="number" step="0.5" class="form-control form-control-sm" name="price_per_km" value="${f.price_per_km}">
                            </div>
                            <div class="mb-2">
                                <label class="small text-muted fw-bold">Minimum Fare (₹)</label>
                                <input type="number" step="0.5" class="form-control form-control-sm" name="min_fare" value="${f.min_fare}">
                            </div>
                            <div class="mb-3">
                                <label class="small text-muted fw-bold">Night Charge (%)</label>
                                <input type="number" step="1" class="form-control form-control-sm" name="night_charge_percent" value="${f.night_charge_percent}">
                            </div>
                            <button type="submit" class="btn btn-sm btn-yellow w-100 fw-bold">
                                <i class="bi bi-save me-1"></i> Update Pricing
                            </button>
                        </form>
                    </div>
                </div>
            </div>
        `).join('');
    }
}

async function handleUpdateFareSetting(event, vehicleType) {
    event.preventDefault();
    const form = event.target;
    const payload = {
        base_fare: parseFloat(form.base_fare.value),
        price_per_km: parseFloat(form.price_per_km.value),
        min_fare: parseFloat(form.min_fare.value),
        night_charge_percent: parseFloat(form.night_charge_percent.value),
    };

    const res = await fetchWithAuth(`${CONFIG.API_BASE_URL}/fare/${vehicleType}/`, {
        method: 'PUT',
        body: JSON.stringify(payload)
    });

    if (res.ok) {
        showToast(`Fare settings for ${vehicleType} updated! Future bookings will reflect this rate.`, 'success');
    } else {
        showToast(res.data.message || 'Failed to update fare.', 'error');
    }
}

// 6. Admin Customers Management
async function loadAdminCustomers() {
    requireAdmin();

    const tbody = document.getElementById('admin-customers-tbody');
    if (!tbody) return;

    tbody.innerHTML = `<tr><td colspan="7" class="text-center py-4"><span class="spinner-border spinner-yellow"></span></td></tr>`;

    const res = await fetchWithAuth(`${CONFIG.API_BASE_URL}/admin/customers/`);
    if (res.ok && res.data.customers) {
        tbody.innerHTML = res.data.customers.map(c => `
            <tr>
                <td><strong>${c.name}</strong></td>
                <td>${c.email}</td>
                <td>${c.phone}</td>
                <td>${c.total_bookings} Total</td>
                <td>${c.completed_trips} Completed</td>
                <td><span class="badge ${c.is_active ? 'bg-success' : 'bg-danger'}">${c.is_active ? 'Active' : 'Disabled'}</span></td>
                <td>
                    <button class="btn btn-sm ${c.is_active ? 'btn-outline-danger' : 'btn-outline-success'}" onclick="toggleCustomerAccount(${c.id})">
                        ${c.is_active ? 'Disable' : 'Enable'}
                    </button>
                </td>
            </tr>
        `).join('');
    }
}

async function toggleCustomerAccount(customerId) {
    const res = await fetchWithAuth(`${CONFIG.API_BASE_URL}/admin/customers/${customerId}/toggle-status/`, {
        method: 'PATCH'
    });

    if (res.ok) {
        showToast(res.data.message, 'info');
        loadAdminCustomers();
    }
}

// 7. Admin Live Map
let adminMap = null;
let adminMarkers = [];

async function initAdminLiveMap() {
    requireAdmin();

    const mapEl = document.getElementById('admin-live-map');
    if (!mapEl || typeof L === 'undefined') return;

    adminMap = L.map('admin-live-map').setView(CONFIG.MAP_DEFAULT_CENTER, 12);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap | JhazTaxi Dispatch'
    }).addTo(adminMap);

    await refreshAdminMapDrivers();
}

async function refreshAdminMapDrivers() {
    if (!adminMap) return;

    // Clear old markers
    adminMarkers.forEach(m => adminMap.removeLayer(m));
    adminMarkers = [];

    const res = await fetchWithAuth(`${CONFIG.API_BASE_URL}/drivers/locations/`);
    if (res.ok && res.data.drivers) {
        const drivers = res.data.drivers;
        drivers.forEach(d => {
            const color = d.status === 'available' ? '#10B981' : (d.status === 'on_trip' ? '#F59E0B' : '#6B7280');
            const iconHtml = `
                <div style="background: ${color}; width: 32px; height: 32px; border-radius: 50%; border: 3px solid #FFF; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 10px rgba(0,0,0,0.3);">
                    <i class="bi bi-taxi-front-fill" style="color: #FFF; font-size: 14px;"></i>
                </div>
            `;
            const icon = L.divIcon({ html: iconHtml, className: 'driver-marker', iconSize: [32, 32], iconAnchor: [16, 16] });
            const marker = L.marker([d.lat, d.lng], { icon }).addTo(adminMap);
            marker.bindPopup(`
                <strong>${d.name}</strong><br>
                <span>Status: <strong style="color:${color}">${d.status.toUpperCase()}</strong></span><br>
                <span>Vehicle: ${d.vehicle.name} (${d.vehicle.number})</span><br>
                <span>Rating: ${d.rating}★</span>
            `);
            adminMarkers.push(marker);
        });
    }
}

// 8. Admin Reports
async function loadAdminReports() {
    requireAdmin();

    const startDate = document.getElementById('report-start-date')?.value || '';
    const endDate = document.getElementById('report-end-date')?.value || '';

    let url = `${CONFIG.API_BASE_URL}/admin/reports/?`;
    if (startDate) url += `start_date=${startDate}&`;
    if (endDate) url += `end_date=${endDate}&`;

    const res = await fetchWithAuth(url);
    if (res.ok && res.data.report) {
        const r = res.data.report;

        const revEl = document.getElementById('rep-revenue');
        const avgEl = document.getElementById('rep-avg-fare');
        const distEl = document.getElementById('rep-distance');
        const compEl = document.getElementById('rep-completed');

        if (revEl) revEl.textContent = adminCurrency(r.total_revenue);
        if (avgEl) avgEl.textContent = adminCurrency(r.avg_trip_fare);
        if (distEl) distEl.textContent = `${r.total_distance_km} KM`;
        if (compEl) compEl.textContent = r.completed_trips;

        // Driver Performance table
        const dTable = document.getElementById('rep-driver-perf-tbody');
        if (dTable && r.driver_performance) {
            dTable.innerHTML = r.driver_performance.map(d => `
                <tr>
                    <td><strong>${d.name}</strong></td>
                    <td>${d.phone}</td>
                    <td>${d.vehicle}</td>
                    <td>${d.rating}★</td>
                    <td>${d.completed_trips}</td>
                    <td>${d.cancelled_trips}</td>
                    <td class="fw-bold">${adminCurrency(d.revenue_generated)}</td>
                </tr>
            `).join('');
        }

        // Popular Routes
        const rTable = document.getElementById('rep-popular-routes-tbody');
        if (rTable && r.popular_routes) {
            rTable.innerHTML = r.popular_routes.map((rt, idx) => `
                <tr>
                    <td>#${idx + 1}</td>
                    <td><i class="bi bi-geo-alt-fill text-success me-1"></i>${rt.pickup_address}</td>
                    <td><i class="bi bi-flag-fill text-danger me-1"></i>${rt.drop_address}</td>
                    <td class="fw-bold text-center">${rt.count} Rides</td>
                </tr>
            `).join('');
        }
    }
}


// ==============================================================================
// ADMIN DRIVER REQUEST MANAGEMENT & WHATSAPP BOOKING FLOW
// ==============================================================================

let currentRequestsData = [];
let activeRequestFilter = 'all';

async function loadAdminDriverRequests(statusFilter = null) {
    if (statusFilter) activeRequestFilter = statusFilter;
    const tbody = document.getElementById('admin-requests-tbody');
    if (!tbody) return;

    const res = await fetchWithAuth(`${CONFIG.API_BASE_URL}/admin/driver-requests/?status=${activeRequestFilter}`);
    if (res.ok && res.data.requests) {
        currentRequestsData = res.data.requests;
        renderAdminDriverRequests(currentRequestsData);

        // Update badge
        const pendingCount = currentRequestsData.filter(r => r.status === 'pending').length;
        const sidebarBadge = document.getElementById('sidebar-req-badge');
        if (sidebarBadge) sidebarBadge.textContent = pendingCount;
    } else {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center py-4 text-danger">Failed to load driver requests.</td></tr>';
    }
}

function filterRequestsByStatus(status) {
    activeRequestFilter = status;
    ['all', 'pending', 'approved', 'rejected'].forEach(s => {
        const btn = document.getElementById(`btn-filter-${s}`);
        if (btn) {
            if (s === status) btn.classList.add('active');
            else btn.classList.remove('active');
        }
    });
    loadAdminDriverRequests(status);
}

function handleSearchRequests(query) {
    const q = query.toLowerCase().trim();
    if (!q) {
        renderAdminDriverRequests(currentRequestsData);
        return;
    }
    const filtered = currentRequestsData.filter(r => {
        const b = r.booking_details || {};
        return (b.booking_id && b.booking_id.toLowerCase().includes(q)) ||
               (r.driver_name && r.driver_name.toLowerCase().includes(q)) ||
               (b.customer_name && b.customer_name.toLowerCase().includes(q)) ||
               (b.pickup_address && b.pickup_address.toLowerCase().includes(q)) ||
               (b.drop_address && b.drop_address.toLowerCase().includes(q));
    });
    renderAdminDriverRequests(filtered);
}

function renderAdminDriverRequests(requests) {
    const tbody = document.getElementById('admin-requests-tbody');
    if (!tbody) return;

    if (requests.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center py-4 text-muted">No driver requests found in this category.</td></tr>';
        return;
    }

    tbody.innerHTML = requests.map(r => {
        const b = r.booking_details || {};
        const custPhone = b.customer_phone || '';
        const drvPhone = r.driver_phone || '';

        let statusBadge = '';
        let actionButtons = '';

        if (r.status === 'pending') {
            statusBadge = '<span class="badge bg-warning text-dark"><i class="bi bi-clock-history me-1"></i>Pending Review</span>';
            actionButtons = `
                <div class="d-flex gap-1">
                    <button class="btn btn-success btn-sm fw-bold px-2 py-1" onclick="adminAssignDriverRequest(${r.id}, '${r.driver_name}', '${b.booking_id}')" title="Approve and assign booking to this driver">
                        <i class="bi bi-check-lg me-1"></i> Assign
                    </button>
                    <button class="btn btn-outline-danger btn-sm px-2 py-1" onclick="adminRejectDriverRequest(${r.id}, '${r.driver_name}', '${b.booking_id}')" title="Reject driver request">
                        <i class="bi bi-x-lg"></i>
                    </button>
                </div>
            `;
        } else if (r.status === 'approved') {
            statusBadge = '<span class="badge bg-success"><i class="bi bi-check2-circle me-1"></i>Assigned</span>';
            actionButtons = `<small class="text-muted"><i class="bi bi-check-all text-success me-1"></i>Officially Assigned</small>`;
        } else if (r.status === 'rejected') {
            statusBadge = '<span class="badge bg-danger">Rejected</span>';
            actionButtons = `<small class="text-muted">Declined</small>`;
        } else {
            statusBadge = `<span class="badge bg-secondary">${r.status}</span>`;
            actionButtons = `--`;
        }

        return `
            <tr>
                <td>
                    <code class="fw-bold text-dark fs-6">${b.booking_id || r.booking}</code><br>
                    <small class="text-success"><i class="bi bi-geo-alt-fill me-1"></i>${b.pickup_address || '--'}</small><br>
                    <small class="text-danger"><i class="bi bi-pin-map-fill me-1"></i>${b.drop_address || '--'}</small><br>
                    <span class="badge bg-light text-dark border mt-1">₹${b.total_fare || '--'} &bull; ${b.vehicle_details?.vehicle_type || 'Vehicle'}</span>
                </td>
                <td>
                    <strong>${b.customer_name || 'Passenger'}</strong><br>
                    <small class="text-muted">${custPhone}</small>
                    ${custPhone ? `
                        <div class="mt-1">
                            <a href="https://wa.me/${custPhone.replace(/[^0-9]/g, '')}" target="_blank" class="badge bg-success text-white text-decoration-none">
                                <i class="bi bi-whatsapp"></i> Chat
                            </a>
                        </div>
                    ` : ''}
                </td>
                <td>
                    <div class="d-flex align-items-center gap-2">
                        <img src="${r.driver_profile_photo || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=100&q=80'}" class="rounded-circle border shadow-sm" width="38" height="38" style="object-fit: cover;" alt="${r.driver_name}" onerror="this.src='https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=100&q=80'">
                        <div>
                            <strong>${r.driver_name}</strong>
                            <span class="badge bg-warning text-dark ms-1">${r.driver_rating || '5.0'}★</span><br>
                            <small class="text-muted"><i class="bi bi-telephone me-1"></i>${drvPhone}</small><br>
                            <span class="badge bg-warning text-dark border font-monospace mt-1" style="font-size: 0.7rem;">${r.driver_vehicle_number || 'No plate'}</span>
                            <small class="text-muted ms-1">${r.driver_vehicle_name || 'Car'}</small>
                        </div>
                    </div>
                </td>
                <td>
                    <small class="text-muted">${r.driver_note ? `"${r.driver_note}"` : '<em>No notes</em>'}</small>
                </td>
                <td>
                    <small class="text-muted">${new Date(r.created_at).toLocaleString([], {month: 'short', day: 'numeric', hour: '2-digit', minute:'2-digit'})}</small>
                </td>
                <td>${statusBadge}</td>
                <td>${actionButtons}</td>
            </tr>
        `;
    }).join('');
}

// Admin Assigns Driver to Booking
async function adminAssignDriverRequest(requestId, driverName, bookingId) {
    if (!confirm(`Confirm assignment: Officially assign booking ${bookingId} to Driver ${driverName}?`)) return;

    const res = await fetchWithAuth(`${CONFIG.API_BASE_URL}/admin/driver-requests/${requestId}/assign/`, {
        method: 'POST',
        body: JSON.stringify({ notes: `Approved and assigned by administrator for ${driverName}` })
    });

    if (res.ok && res.data.success) {
        showToast(res.data.message || `Booking ${bookingId} officially assigned to ${driverName}!`, 'success');
        loadAdminDriverRequests();
    } else {
        showToast(res.data.message || 'Failed to assign booking', 'error');
    }
}

// Admin Rejects Driver Request
async function adminRejectDriverRequest(requestId, driverName, bookingId) {
    if (!confirm(`Decline request from ${driverName} for booking ${bookingId}?`)) return;

    const res = await fetchWithAuth(`${CONFIG.API_BASE_URL}/admin/driver-requests/${requestId}/reject/`, {
        method: 'POST',
        body: JSON.stringify({ notes: 'Declined by admin' })
    });

    if (res.ok && res.data.success) {
        showToast(`Request from ${driverName} declined. Booking remains open.`, 'info');
        loadAdminDriverRequests();
    } else {
        showToast(res.data.message || 'Failed to reject request', 'error');
    }
}

// Open Publish Trip / WhatsApp Booking Modal
async function openPublishTripModal() {
    let modalEl = document.getElementById('publishTripModal') || document.getElementById('whatsappBookingModal');
    if (!modalEl) return;

    // Reset date to today
    const dateInput = modalEl.querySelector('input[name="pickup_date"]');
    if (dateInput) dateInput.value = new Date().toISOString().split('T')[0];

    // Load drivers into the driver select dropdown
    const driverSelect = modalEl.querySelector('select[name="driver_id"]');
    if (driverSelect) {
        try {
            const res = await fetchWithAuth(`${CONFIG.API_BASE_URL}/drivers/`);
            if (res.ok && res.data.drivers) {
                const drivers = res.data.drivers;
                const available = drivers.filter(d => d.status === 'available');
                const others = drivers.filter(d => d.status !== 'available');
                
                let optionsHtml = `<option value="">⚡ Broadcast to Available Drivers Pool (Open for Drivers to Request)</option>`;
                if (available.length > 0) {
                    optionsHtml += `<optgroup label="Available Drivers (Ready Now)">`;
                    available.forEach(d => {
                        optionsHtml += `<option value="${d.id}">🟢 ${d.name} (${d.phone}) - ${d.vehicle ? d.vehicle.model : 'Cab'} [${d.vehicle_number || ''}]</option>`;
                    });
                    optionsHtml += `</optgroup>`;
                }
                if (others.length > 0) {
                    optionsHtml += `<optgroup label="Other Drivers (Busy / Offline)">`;
                    others.forEach(d => {
                        optionsHtml += `<option value="${d.id}">⚪ ${d.name} (${d.phone}) - [${d.status.toUpperCase()}]</option>`;
                    });
                    optionsHtml += `</optgroup>`;
                }
                driverSelect.innerHTML = optionsHtml;
            }
        } catch (e) {
            console.error('Failed to load drivers for modal', e);
        }
    }

    const modal = new bootstrap.Modal(modalEl);
    modal.show();
}

// Handle Creating / Publishing Manual & WhatsApp Booking
async function handleCreateWhatsAppBooking(event) {
    event.preventDefault();
    const form = event.target;
    const saveBtn = form.querySelector('button[type="submit"]') || document.getElementById('btn-save-wa-booking');

    if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>Publishing...';
    }

    const payload = {
        customer_name: form.customer_name.value.trim(),
        customer_phone: form.customer_phone.value.trim(),
        pickup_address: form.pickup_address.value.trim(),
        drop_address: form.drop_address.value.trim(),
        vehicle_type: form.vehicle_type.value,
        distance_km: form.distance_km.value,
        total_fare: form.total_fare.value,
        payment_method: form.payment_method.value,
        driver_id: form.driver_id ? form.driver_id.value : null,
        pickup_date: form.pickup_date.value,
        pickup_time: form.pickup_time.value,
        customer_notes: form.customer_notes.value.trim()
    };

    const res = await fetchWithAuth(`${CONFIG.API_BASE_URL}/admin/bookings/publish-trip/`, {
        method: 'POST',
        body: JSON.stringify(payload)
    });

    if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.innerHTML = '<i class="bi bi-send-fill me-1"></i> Publish Trip Now';
    }

    if (res.ok && res.data.success) {
        showToast(res.data.message || 'Trip published successfully!', 'success');
        const modalEl = document.getElementById('publishTripModal') || document.getElementById('whatsappBookingModal');
        if (modalEl) {
            const modal = bootstrap.Modal.getInstance(modalEl);
            if (modal) modal.hide();
        }
        form.reset();

        // Refresh views
        if (typeof loadAdminDriverRequests === 'function') loadAdminDriverRequests();
        if (typeof loadAdminBookings === 'function') loadAdminBookings();
        if (typeof loadDashboardStats === 'function') loadDashboardStats();
    } else {
        const err = res.data.errors ? Object.values(res.data.errors).flat().join(', ') : (res.data.message || 'Failed to publish trip');
        showToast(err, 'error');
    }
}

// ==========================================
// 12. Admin Fare & GPay Scanner Management
// ==========================================

async function loadAdminFares() {
    requireAdmin();
    await Promise.all([
        loadAdminGPaySettings(),
        loadVehicleFares()
    ]);
}

async function loadAdminGPaySettings() {
    const res = await fetchWithAuth(`${CONFIG.API_BASE_URL}/payment-settings/`);
    if (!res.ok || !res.data.success) {
        showToast('Could not load GPay scanner settings.', 'warning');
        return;
    }
    const s = res.data.setting;

    const upiInput = document.getElementById('gpay_upi_id');
    const payeeInput = document.getElementById('gpay_payee_name');
    const phoneInput = document.getElementById('gpay_phone');
    const instructionsInput = document.getElementById('gpay_instructions');
    const activeSwitch = document.getElementById('gpay_is_active');
    const qrImg = document.getElementById('admin-gpay-qr-preview');
    const qrBadge = document.getElementById('admin-gpay-qr-badge');

    if (upiInput) upiInput.value = s.upi_id || '';
    if (payeeInput) payeeInput.value = s.payee_name || '';
    if (phoneInput) phoneInput.value = s.phone_number || '';
    if (instructionsInput) instructionsInput.value = s.instructions || '';
    if (activeSwitch) activeSwitch.checked = !!s.is_active;

    if (qrImg && s.qr_image_url) {
        qrImg.src = s.qr_image_url;
    }
    if (qrBadge) {
        qrBadge.textContent = s.qr_image ? 'Custom Scanner Uploaded' : 'Active Scanner (Live)';
        qrBadge.className = s.qr_image ? 'badge bg-success px-3 py-2' : 'badge bg-primary px-3 py-2';
    }
}

async function saveGPaySettings(e) {
    e.preventDefault();
    requireAdmin();

    const form = e.target;
    const submitBtn = document.getElementById('btn-save-gpay') || form.querySelector('button[type="submit"]');
    const fileInput = document.getElementById('gpay_qr_file');

    const formData = new FormData();
    formData.append('upi_id', document.getElementById('gpay_upi_id').value.trim());
    formData.append('payee_name', document.getElementById('gpay_payee_name').value.trim());
    formData.append('phone_number', document.getElementById('gpay_phone').value.trim());
    formData.append('instructions', document.getElementById('gpay_instructions').value.trim());
    formData.append('is_active', document.getElementById('gpay_is_active').checked);

    if (fileInput && fileInput.files && fileInput.files[0]) {
        formData.append('qr_image', fileInput.files[0]);
    }

    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Saving Scanner...';
    }

    const token = getAuthToken();
    try {
        const res = await fetch(`${CONFIG.API_BASE_URL}/payment-settings/`, {
            method: 'POST',
            headers: {
                'Authorization': `Token ${token}`
            },
            body: formData
        });
        const data = await res.json();

        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i class="bi bi-cloud-arrow-up-fill me-1"></i> Save & Publish GPay Scanner';
        }

        if (res.ok && data.success) {
            showToast('Official GPay Scanner & UPI details saved successfully!', 'success');
            if (data.setting && data.setting.qr_image_url) {
                const qrImg = document.getElementById('admin-gpay-qr-preview');
                if (qrImg) qrImg.src = data.setting.qr_image_url;
            }
            loadAdminGPaySettings();
        } else {
            const err = data.errors ? Object.values(data.errors).flat().join(', ') : (data.message || 'Failed to save GPay scanner');
            showToast(err, 'error');
        }
    } catch (err) {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i class="bi bi-cloud-arrow-up-fill me-1"></i> Save & Publish GPay Scanner';
        }
        showToast('Network error while saving GPay scanner.', 'error');
    }
}

async function loadVehicleFares() {
    const container = document.getElementById('fares-cards-container');
    if (!container) return;

    const res = await fetchWithAuth(`${CONFIG.API_BASE_URL}/fare/`);
    if (!res.ok || !res.data) {
        container.innerHTML = `<div class="col-12"><div class="alert alert-danger">Failed to load fare rules.</div></div>`;
        return;
    }

    const fares = (res.data && res.data.fares) ? res.data.fares : (Array.isArray(res.data) ? res.data : []);
    if (!fares.length) {
        container.innerHTML = `<div class="col-12 text-center text-muted py-4">No fare settings found.</div>`;
        return;
    }

    container.innerHTML = fares.map(f => `
        <div class="col-md-6 col-xl-3">
            <div class="card border-0 shadow-sm rounded-4 h-100 bg-white">
                <div class="card-header bg-dark text-white rounded-top-4 py-3 d-flex justify-content-between align-items-center">
                    <h6 class="mb-0 fw-bold">${f.vehicle_type} Class</h6>
                    <span class="badge ${f.is_active ? 'bg-success' : 'bg-secondary'}">${f.is_active ? 'Active' : 'Disabled'}</span>
                </div>
                <div class="card-body p-3">
                    <form onsubmit="saveVehicleFare('${f.vehicle_type}', event)">
                        <div class="mb-2">
                            <label class="form-label small fw-bold text-muted mb-1">Base Fare (₹)</label>
                            <input type="number" step="0.5" class="form-control form-control-sm" name="base_fare" value="${f.base_fare}" required>
                        </div>
                        <div class="mb-2">
                            <label class="form-label small fw-bold text-muted mb-1">Rate / Km (₹)</label>
                            <input type="number" step="0.5" class="form-control form-control-sm" name="price_per_km" value="${f.price_per_km}" required>
                        </div>
                        <div class="mb-2">
                            <label class="form-label small fw-bold text-muted mb-1">Min Fare (₹)</label>
                            <input type="number" step="0.5" class="form-control form-control-sm" name="min_fare" value="${f.min_fare || f.base_fare}" required>
                        </div>
                        <div class="mb-2">
                            <label class="form-label small fw-bold text-muted mb-1">Waiting Fee / Min (₹)</label>
                            <input type="number" step="0.5" class="form-control form-control-sm" name="waiting_charge_per_min" value="${f.waiting_charge_per_min || 2.0}">
                        </div>
                        <div class="mb-3">
                            <label class="form-label small fw-bold text-muted mb-1">Night Charge (%)</label>
                            <input type="number" step="1" class="form-control form-control-sm" name="night_charge_percent" value="${f.night_charge_percent || 20}">
                        </div>
                        <button type="submit" class="btn btn-warning btn-sm w-100 fw-bold">
                            <i class="bi bi-save me-1"></i> Update ${f.vehicle_type} Rates
                        </button>
                    </form>
                </div>
            </div>
        </div>
    `).join('');
}

async function saveVehicleFare(vType, e) {
    e.preventDefault();
    requireAdmin();
    const form = e.target;
    const btn = form.querySelector('button[type="submit"]');

    const payload = {
        base_fare: form.base_fare.value,
        price_per_km: form.price_per_km.value,
        min_fare: form.min_fare.value,
        waiting_charge_per_min: form.waiting_charge_per_min.value,
        night_charge_percent: form.night_charge_percent.value
    };

    if (btn) btn.disabled = true;
    const res = await fetchWithAuth(`${CONFIG.API_BASE_URL}/fare-settings/${vType}/`, {
        method: 'PUT',
        body: JSON.stringify(payload)
    });
    if (btn) btn.disabled = false;

    if (res.ok && res.data.success) {
        showToast(`${vType} fare rates updated successfully!`, 'success');
        loadVehicleFares();
    } else {
        showToast(res.data.message || `Failed to update ${vType} rates`, 'error');
    }
}


