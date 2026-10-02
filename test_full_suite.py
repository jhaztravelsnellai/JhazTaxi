import os
import sys
import io
import json
import random
import requests
from PIL import Image

API_BASE = "http://127.0.0.1:8000/api"
FRONTEND_BASE = "http://127.0.0.1:5500"

print("==================================================")
print("   JHAZTAXI FULL-STACK VERIFICATION SUITE")
print("==================================================")

passed = 0
failed = 0

def record_test(name, success, details=""):
    global passed, failed
    if success:
        passed += 1
        print(f"[PASS] {name} - {details}")
    else:
        failed += 1
        print(f"[FAIL] {name} - {details}")

# 1. Health Check
try:
    r = requests.get(f"{API_BASE}/health/", timeout=5)
    data = r.json()
    record_test("1. System Health & PostgreSQL", r.status_code == 200 and data.get("database") == "operational", str(data))
except Exception as e:
    record_test("1. System Health & PostgreSQL", False, str(e))

# 2. Vehicles API
try:
    r = requests.get(f"{API_BASE}/vehicles/", timeout=5)
    data = r.json()
    v_count = len(data.get("vehicles", []))
    record_test("2. Vehicles Catalog API", r.status_code == 200 and v_count > 0, f"Found {v_count} vehicles")
except Exception as e:
    record_test("2. Vehicles Catalog API", False, str(e))

# 3. Fare Estimation API
try:
    payload = {
        "pickup_lat": 12.9716,
        "pickup_lng": 77.5946,
        "drop_lat": 12.9352,
        "drop_lng": 77.6245,
        "vehicle_type": "Sedan"
    }
    r = requests.post(f"{API_BASE}/fare/estimate/", json=payload, timeout=5)
    data = r.json()
    est = data.get("estimate", {})
    record_test("3. Road Distance & Fare Calculation", r.status_code == 200 and data.get("success"),
                f"Distance: {est.get('distance_km')} km, Total Fare: Rs.{est.get('total_fare')}")
except Exception as e:
    record_test("3. Road Distance & Fare Calculation", False, str(e))

# 4. User Registration & Auth
cust_token = None
try:
    rand_num = random.randint(10000, 99999)
    email = f"rider{rand_num}@example.com"
    reg_payload = {
        "email": email,
        "username": f"rider{rand_num}",
        "first_name": "Rider",
        "last_name": "Test",
        "phone_number": f"+9198765{rand_num % 10000:04d}",
        "password": "JhazSecure2026!"
    }
    r = requests.post(f"{API_BASE}/auth/register/", json=reg_payload, timeout=5)
    data = r.json()
    cust_token = data.get("token")
    record_test("4. Customer Registration & Token Auth", r.status_code == 201 and cust_token is not None, f"Token: {cust_token[:10]}...")
except Exception as e:
    record_test("4. Customer Registration & Token Auth", False, str(e))

# 5. Admin Authentication
admin_token = None
try:
    admin_payload = {
        "email": "admin@jhaztaxi.com",
        "password": "admin123"
    }
    r = requests.post(f"{API_BASE}/auth/admin-login/", json=admin_payload, timeout=5)
    data = r.json()
    admin_token = data.get("token")
    record_test("5. Admin Login & Authorization", r.status_code == 200 and admin_token is not None, f"Admin: {data.get('user', {}).get('email')}")
except Exception as e:
    record_test("5. Admin Login & Authorization", False, str(e))

# 6. Booking Creation (Customer)
booking_id = None
try:
    b_payload = {
        "vehicle_type": "Sedan",
        "pickup_address": "MG Road, Bangalore",
        "drop_address": "Koramangala 4th Block, Bangalore",
        "pickup_lat": 12.9716,
        "pickup_lng": 77.5946,
        "drop_lat": 12.9352,
        "drop_lng": 77.6245,
        "distance_km": 6.8,
        "duration_mins": 25,
        "payment_method": "cash",
        "customer_notes": "Flight departure pickup"
    }
    headers = {"Authorization": f"Token {cust_token}"}
    r = requests.post(f"{API_BASE}/bookings/", json=b_payload, headers=headers, timeout=5)
    data = r.json()
    booking_id = data.get("booking", {}).get("booking_id")
    record_test("6. Ride Booking Creation", r.status_code == 201 and booking_id is not None, f"Booking ID: {booking_id}")
except Exception as e:
    record_test("6. Ride Booking Creation", False, str(e))

# 7. Admin Driver Assignment
driver_id = None
try:
    headers_adm = {"Authorization": f"Token {admin_token}"}
    r_drv = requests.get(f"{API_BASE}/drivers/available/", headers=headers_adm, timeout=5)
    d_list = r_drv.json().get("drivers", [])
    if not d_list:
        # Fallback: get all drivers and pick the first
        r_all_drv = requests.get(f"{API_BASE}/drivers/", headers=headers_adm, timeout=5)
        d_list = r_all_drv.json().get("drivers", [])

    if d_list:
        driver_id = d_list[0]["id"]
        assign_payload = {"driver_id": driver_id}
        r_assign = requests.post(f"{API_BASE}/bookings/{booking_id}/assign-driver/", json=assign_payload, headers=headers_adm, timeout=5)
        assign_data = r_assign.json()
        record_test("7. Admin Driver Assignment", r_assign.status_code == 200 and assign_data.get("success"),
                    f"Driver ID {driver_id} assigned to {booking_id}")
    else:
        record_test("7. Admin Driver Assignment", False, "No drivers found")
except Exception as e:
    record_test("7. Admin Driver Assignment", False, str(e))

# 8. Booking Status Transitions (trip_started -> trip_completed)
try:
    r_start = requests.post(f"{API_BASE}/bookings/{booking_id}/status/", json={"status": "trip_started"}, headers=headers_adm, timeout=5)
    r_done = requests.post(f"{API_BASE}/bookings/{booking_id}/status/", json={"status": "trip_completed"}, headers=headers_adm, timeout=5)
    record_test("8. Trip Lifecycle Flow (Started -> Completed)", r_done.status_code == 200 and r_done.json().get("booking", {}).get("status") == "trip_completed", "Status transitioned to trip_completed")
except Exception as e:
    record_test("8. Trip Lifecycle Flow", False, str(e))

# 9. Customer Rating & Review Submission
try:
    rev_payload = {
        "booking_id": booking_id,
        "rating": 5,
        "comment": "Punctual, super clean car, very polite driver!"
    }
    r_rev = requests.post(f"{API_BASE}/reviews/", json=rev_payload, headers=headers, timeout=5)
    rev_data = r_rev.json()
    record_test("9. Customer Review & Driver Rating Update", r_rev.status_code == 201 and rev_data.get("success"),
                f"Rating: 5 Stars recorded for booking {booking_id}")
except Exception as e:
    record_test("9. Customer Review & Driver Rating Update", False, str(e))

# 10. Admin Analytics & Reports API
try:
    r_rep = requests.get(f"{API_BASE}/admin/reports/", headers=headers_adm, timeout=5)
    rep_data = r_rep.json()
    record_test("10. Admin Reports & Financial Analytics", r_rep.status_code == 200 and "report" in rep_data,
                f"Total Revenue: Rs.{rep_data.get('report', {}).get('total_revenue')}")
except Exception as e:
    record_test("10. Admin Reports & Financial Analytics", False, str(e))

# 11. Admin Add Vehicle with Real Image Upload (Multipart)
uploaded_vehicle_id = None
try:
    img = Image.new('RGB', (400, 300), color=(255, 193, 7))
    img_byte_arr = io.BytesIO()
    img.save(img_byte_arr, format='PNG')
    img_byte_arr.seek(0)

    files = {
        'image': ('hyundai_verna.png', img_byte_arr, 'image/png')
    }
    v_num = f"KA-05-TX-{random.randint(1000, 9999)}"
    v_form_data = {
        'name': 'Hyundai Verna 1.5 Turbo',
        'vehicle_type': 'Sedan',
        'vehicle_number': v_num,
        'model': '2025',
        'capacity': '4',
        'base_fare': '110',
        'price_per_km': '16',
        'status': 'available',
        'description': 'Luxury sedan with plush leather seats and air conditioning'
    }

    r_veh = requests.post(f"{API_BASE}/vehicles/", data=v_form_data, files=files, headers=headers_adm, timeout=5)
    v_res = r_veh.json()
    new_veh = v_res.get("vehicle", {})
    uploaded_vehicle_id = new_veh.get("id")
    display_image_url = new_veh.get("display_image", "")

    # Verify image is reachable and returns HTTP 200
    r_img = requests.get(display_image_url, timeout=5)
    img_ok = r_img.status_code == 200 and len(r_img.content) > 0

    record_test("11. Admin Vehicle Creation with Image File Upload",
                r_veh.status_code == 201 and v_res.get("success") and img_ok,
                f"Created Vehicle ID: {uploaded_vehicle_id}, Image URL: {display_image_url} (HTTP {r_img.status_code}, {len(r_img.content)} bytes)")
except Exception as e:
    record_test("11. Admin Vehicle Creation with Image File Upload", False, str(e))

# 12. Frontend Pages Availability Check (HTTP 200)
try:
    frontend_pages = [
        "/",
        "/booking.html",
        "/about.html",
        "/contact.html",
        "/login.html",
        "/register.html",
        "/user/dashboard.html",
        "/user/bookings.html",
        "/user/profile.html",
        "/admin/dashboard.html",
        "/admin/vehicles.html",
        "/admin/drivers.html",
        "/admin/bookings.html",
        "/admin/map.html",
        "/admin/reports.html",
        "/admin/fares.html"
    ]
    all_pages_ok = True
    for p in frontend_pages:
        res = requests.get(f"{FRONTEND_BASE}{p}", timeout=3)
        if res.status_code != 200:
            all_pages_ok = False
            print(f"  [WARN] Page {p} returned {res.status_code}")
            break

    record_test("12. Frontend Pages Availability (16 pages)", all_pages_ok, "All customer & admin HTML pages live on port 5500")
except Exception as e:
    record_test("12. Frontend Pages Availability", False, str(e))

print("==================================================")
print(f"VERIFICATION SUMMARY: {passed} PASSED, {failed} FAILED")
print("==================================================")

if failed > 0:
    sys.exit(1)
else:
    sys.exit(0)
