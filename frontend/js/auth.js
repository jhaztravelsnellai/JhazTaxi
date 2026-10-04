/**
 * JhazTaxi - Authentication & Role-Based Route Guards
 */

// Landing Page Guard: Open to all visitors (No customer login required)
function checkLandingAuth() {
    const user = getCurrentUser();
    // Only redirect if a driver is logged in and visits home
    if (user && user.role === 'driver') {
        window.location.replace('/driver/dashboard.html');
        return false;
    }
    return true;
}

// Protected Route Guard: Requires authentication for internal portals
function requireAuth() {
    const path = window.location.pathname.toLowerCase();
    // Public pages never require authentication
    if (path.endsWith('booking.html') || path.endsWith('index.html') || path === '/' || path.endsWith('contact.html') || path.endsWith('vehicles.html') || path.endsWith('about.html')) {
        return true;
    }

    const token = getAuthToken();
    const user = getCurrentUser();

    if (!token || !user) {
        window.location.replace(`/login.html?next=${encodeURIComponent(window.location.pathname + window.location.search)}`);
        return false;
    }
    return true;
}

// Protected Route Guard: For Customer Portal (/user/*)
function requireCustomer() {
    if (!requireAuth()) return;
    const user = getCurrentUser();
    if (user.role === 'driver') {
        window.location.replace('/driver/dashboard.html');
    }
}

// Protected Route Guard: For Driver Portal (/driver/*)
function requireDriver() {
    const token = getAuthToken();
    const user = getCurrentUser();
    if (!token || !user) {
        window.location.replace(`/driver/login.html?next=${encodeURIComponent(window.location.pathname + window.location.search)}`);
        return false;
    }
    if (user.role !== 'driver' && user.role !== 'admin' && !user.is_staff) {
        showToast('Driver access required. Please sign in with a driver account.', 'warning');
        setTimeout(() => {
            window.location.replace('/driver/login.html');
        }, 800);
        return false;
    }
    return true;
}

// Protected Route Guard: For Admin Portal (/admin/*)
function requireAdmin() {
    const token = getAuthToken();
    const user = getCurrentUser();
    if (!token || !user || (user.role !== 'admin' && !user.is_staff)) {
        window.location.replace(`/admin/login.html?next=${encodeURIComponent(window.location.pathname + window.location.search)}`);
    }
}

// Handle Customer Login
async function handleCustomerLogin(event) {
    event.preventDefault();
    const form = event.target;
    const email = form.email.value.trim();
    const password = form.password.value;
    const submitBtn = document.getElementById('btn-customer-signin') || form.querySelector('button[type="submit"]');

    if (!email || !password) {
        showToast('Please fill in both email/mobile and password.', 'warning');
        return;
    }

    const originalBtnText = submitBtn.innerHTML;
    submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Logging in...';
    submitBtn.disabled = true;

    const res = await fetchWithAuth(`${CONFIG.API_BASE_URL}/auth/login/`, {
        method: 'POST',
        body: JSON.stringify({ email, password })
    });

    submitBtn.innerHTML = originalBtnText;
    submitBtn.disabled = false;

    if (res.ok && res.data.success) {
        setAuthSession(res.data.token, res.data.user);
        const role = res.data.user.role;
        showToast(`Login successful! Welcome ${res.data.user.first_name || res.data.user.username}.`, 'success');

        const params = new URLSearchParams(window.location.search);
        let nextUrl = params.get('next');

        if (!nextUrl || nextUrl === '/login.html') {
            if (role === 'admin') {
                nextUrl = '/admin/dashboard.html';
            } else if (role === 'driver') {
                nextUrl = '/driver/dashboard.html';
            } else {
                nextUrl = '/index.html';
            }
        } else if (role === 'driver' && !nextUrl.includes('/driver/')) {
            nextUrl = '/driver/dashboard.html';
        }

        setTimeout(() => {
            window.location.href = nextUrl;
        }, 700);
    } else {
        const errorMsg = res.data.errors ? Object.values(res.data.errors).flat().join(', ') : (res.data.message || 'Login failed.');
        showToast(errorMsg, 'error');
    }
}

// Handle Driver Partner Login
async function handleDriverLogin(event) {
    event.preventDefault();
    const form = event.target;
    const email = form.email.value.trim();
    const password = form.password.value;
    const submitBtn = document.getElementById('btn-driver-signin') || form.querySelector('button[type="submit"]');

    if (!email || !password) {
        showToast('Please enter your mobile number or driver email and password.', 'warning');
        return;
    }

    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Authenticating Driver...';
    }

    const res = await fetchWithAuth(`${CONFIG.API_BASE_URL}/auth/driver-login/`, {
        method: 'POST',
        body: JSON.stringify({ email, password })
    });

    if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="bi bi-box-arrow-in-right me-1"></i> Access Driver Dashboard';
    }

    if (res.ok && res.data.success) {
        setAuthSession(res.data.token, res.data.user);
        showToast(`Welcome back, Driver ${res.data.user.first_name || res.data.user.username}!`, 'success');
        setTimeout(() => {
            window.location.href = '/driver/dashboard.html';
        }, 700);
    } else {
        const errorMsg = res.data.errors ? Object.values(res.data.errors).flat().join(', ') : (res.data.message || 'Driver authentication failed.');
        showToast(errorMsg, 'error');
    }
}

// Handle Customer Registration
async function handleCustomerRegister(event) {
    event.preventDefault();
    const form = event.target;
    const fullName = form.full_name.value.trim();
    const email = form.email.value.trim();
    const phone = form.phone.value.trim();
    const password = form.password.value;
    const confirmPassword = form.confirm_password.value;
    const submitBtn = document.getElementById('btn-customer-register') || form.querySelector('button[type="submit"]');

    if (!fullName) {
        showToast('Full name is required.', 'error');
        return;
    }
    if (!phone) {
        showToast('Mobile phone number is required.', 'error');
        return;
    }
    if (!email) {
        showToast('Email address is required.', 'error');
        return;
    }
    if (password !== confirmPassword) {
        showToast('Passwords do not match. Please verify.', 'error');
        return;
    }

    const originalBtnText = submitBtn.innerHTML;
    submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Creating customer account...';
    submitBtn.disabled = true;

    const res = await fetchWithAuth(`${CONFIG.API_BASE_URL}/auth/register/`, {
        method: 'POST',
        body: JSON.stringify({
            full_name: fullName,
            email: email,
            phone_number: phone,
            password: password,
            confirm_password: confirmPassword,
            role: 'customer'
        })
    });

    submitBtn.innerHTML = originalBtnText;
    submitBtn.disabled = false;

    if (res.ok && res.data.success) {
        setAuthSession(res.data.token, res.data.user);
        showToast('Registration successful! Welcome to JhazTaxi.', 'success');
        setTimeout(() => {
            window.location.href = '/index.html';
        }, 800);
    } else {
        const errorMsg = res.data.errors ? Object.values(res.data.errors).flat().join(', ') : (res.data.message || 'Registration failed.');
        showToast(errorMsg, 'error');
    }
}

// Handle Driver Partner Registration
async function handleDriverRegister(event) {
    event.preventDefault();
    const form = event.target;
    const submitBtn = document.getElementById('btn-submit-driver-reg') || form.querySelector('button[type="submit"]');

    const name = form.name.value.trim();
    const phone = form.phone.value.trim();
    const email = form.email ? form.email.value.trim() : '';
    const licenseNumber = form.license_number.value.trim();
    const vehicleNumber = form.vehicle_number.value.trim();
    const vehicleType = form.vehicle_type ? form.vehicle_type.value : 'Sedan';
    const address = form.address ? form.address.value.trim() : '';
    const password = form.password.value;
    const confirmPassword = form.confirm_password.value;
    const profileImg = form.profile_image ? form.profile_image.files[0] : null;
    const carImg = form.car_image ? form.car_image.files[0] : null;

    if (!name) {
        showToast('Driver full name is required.', 'error');
        return;
    }
    if (!phone) {
        showToast('Driver mobile phone number is required.', 'error');
        return;
    }
    if (!licenseNumber) {
        showToast('Driving license number is required.', 'error');
        return;
    }
    if (!vehicleNumber) {
        showToast('Vehicle registration plate number is compulsory.', 'error');
        return;
    }
    if (!profileImg) {
        showToast('Driver profile picture is compulsory. Please select a photo.', 'error');
        return;
    }
    if (!carImg) {
        showToast('Car picture is compulsory. Please select a photo of your cab.', 'error');
        return;
    }
    if (password !== confirmPassword) {
        showToast('Passwords do not match. Please verify.', 'error');
        return;
    }

    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Uploading Photos & Registering...';
    }

    const formData = new FormData();
    formData.append('name', name);
    formData.append('phone', phone);
    if (email) formData.append('email', email);
    formData.append('license_number', licenseNumber);
    formData.append('vehicle_number', vehicleNumber);
    formData.append('vehicle_type', vehicleType);
    if (address) formData.append('address', address);
    formData.append('password', password);
    formData.append('confirm_password', confirmPassword);
    formData.append('profile_image', profileImg);
    formData.append('car_image', carImg);

    try {
        const res = await fetchWithAuth(`${CONFIG.API_BASE_URL}/auth/driver-register/`, {
            method: 'POST',
            body: formData
        });

        if (res.ok && res.data.success) {
            setAuthSession(res.data.token, res.data.user);
            showToast('Driver registered successfully! Welcome to JhazTaxi Fleet.', 'success');
            setTimeout(() => {
                window.location.href = '/driver/dashboard.html';
            }, 800);
        } else {
            let errorMsg = 'Driver registration failed.';
            if (res.data && res.data.errors) {
                errorMsg = Object.entries(res.data.errors)
                    .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`)
                    .join(' | ');
            } else if (res.data && res.data.message) {
                errorMsg = res.data.message;
            }
            showToast(errorMsg, 'error');
        }
    } catch (err) {
        console.error(err);
        showToast('Network error occurred while registering driver partner.', 'error');
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i class="bi bi-check-circle-fill me-1"></i> Register as Driver Partner';
        }
    }
}

// Handle Admin Login
async function handleAdminLogin(event) {
    event.preventDefault();
    const form = event.target;
    const email = form.email.value.trim();
    const password = form.password.value;
    const submitBtn = form.querySelector('button[type="submit"]');

    const originalBtnText = submitBtn.innerHTML;
    submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Authenticating...';
    submitBtn.disabled = true;

    const res = await fetchWithAuth(`${CONFIG.API_BASE_URL}/auth/admin-login/`, {
        method: 'POST',
        body: JSON.stringify({ email, password })
    });

    submitBtn.innerHTML = originalBtnText;
    submitBtn.disabled = false;

    if (res.ok && res.data.success) {
        setAuthSession(res.data.token, res.data.user);
        showToast('Administrator verified! Loading portal...', 'success');
        setTimeout(() => {
            window.location.href = '/admin/dashboard.html';
        }, 700);
    } else {
        const errorMsg = res.data.errors ? Object.values(res.data.errors).flat().join(', ') : (res.data.message || 'Unauthorized admin access.');
        showToast(errorMsg, 'error');
    }
}
