import os
import sys
import io
import json
import random
import requests
from PIL import Image

API_BASE = "http://127.0.0.1:8000/api"
FRONTEND_BASE = "http://127.0.0.1:5500"

print("==================================================================")
print("   JHAZTAXI DRIVER-REQUEST & ADMIN-ASSIGNMENT VERIFICATION SUITE")
print("==================================================================")

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

# 1. Health & Database
try:
    r = requests.get(f"{API_BASE}/health/", timeout=5)
    data = r.json()
    record_test("1. System Health & PostgreSQL", r.status_code == 200 and data.get("database") == "operational", str(data))
except Exception as e:
    record_test("1. System Health & PostgreSQL", False, str(e))

# 2. Login Flow: Check that unauthenticated visitor receives auth guard in index.html
try:
    r_index = requests.get(f"{FRONTEND_BASE}/index.html", timeout=3)
    has_guard = "checkLandingAuth();" in r_index.text
    record_test("2. Protected Route / Login Flow Guard", r_index.status_code == 200 and has_guard, "index.html enforces checkLandingAuth() redirect to /login.html")
except Exception as e:
    record_test("2. Protected Route / Login Flow Guard", False, str(e))

# 3. User Authentication for all 3 Roles: Customer, Driver, Admin
cust_token = None
driver_token = None
admin_token = None

try:
    # Customer Login
    r_c = requests.post(f"{API_BASE}/auth/login/", json={"email": "customer@jhaztaxi.com", "password": "customer123"}, timeout=5)
    c_data = r_c.json()
    cust_token = c_data.get("token")
    c_role = c_data.get("user", {}).get("role")

    # Driver Login
    r_d = requests.post(f"{API_BASE}/auth/login/", json={"email": "driver@jhaztaxi.com", "password": "driver123"}, timeout=5)
    d_data = r_d.json()
    driver_token = d_data.get("token")
    d_role = d_data.get("user", {}).get("role")

    # Admin Login
    r_a = requests.post(f"{API_BASE}/auth/admin-login/", json={"email": "admin@jhaztaxi.com", "password": "admin123"}, timeout=5)
    a_data = r_a.json()
    admin_token = a_data.get("token")
    a_role = a_data.get("user", {}).get("role")

    all_auth_ok = (cust_token and c_role == "customer" and
                   driver_token and d_role == "driver" and
                   admin_token and a_role == "admin")
    record_test("3. Multi-Role Authentication (Customer, Driver, Admin)", all_auth_ok,
                f"Customer: {c_role}, Driver: {d_role}, Admin: {a_role}")
except Exception as e:
    record_test("3. Multi-Role Authentication", False, str(e))

# 4. WhatsApp / Manual Booking Creation by Admin
wa_booking_id = None
try:
    wa_payload = {
        "customer_name": "Arjun WhatsApp User",
        "customer_phone": "+91 99000 88888",
        "pickup_address": "Indiranagar 100ft Road, Bangalore",
        "drop_address": "Electronic City Phase 1, Bangalore",
        "vehicle_type": "Sedan",
        "distance_km": 22.5,
        "total_fare": 450.0,
        "payment_method": "cash",
        "customer_notes": "Customer requested ride over WhatsApp"
    }
    headers_adm = {"Authorization": f"Token {admin_token}"}
    r_wa = requests.post(f"{API_BASE}/admin/bookings/whatsapp-create/", json=wa_payload, headers=headers_adm, timeout=5)
    wa_res = r_wa.json()
    wa_booking_id = wa_res.get("booking", {}).get("booking_id")
    record_test("4. Admin WhatsApp Booking Creation", r_wa.status_code == 201 and wa_booking_id is not None,
                f"Created Booking ID: {wa_booking_id} (Status: {wa_res.get('booking', {}).get('status')})")
except Exception as e:
    record_test("4. Admin WhatsApp Booking Creation", False, str(e))

# 5. Driver Queries Available Booking Pool
try:
    headers_drv = {"Authorization": f"Token {driver_token}"}
    r_pool = requests.get(f"{API_BASE}/driver/available-bookings/", headers=headers_drv, timeout=5)
    pool_data = r_pool.json()
    pool_bookings = pool_data.get("bookings", [])
    found_wa_in_pool = any(b.get("booking_id") == wa_booking_id for b in pool_bookings)
    record_test("5. Driver Views Available Pool", r_pool.status_code == 200 and found_wa_in_pool,
                f"Found {len(pool_bookings)} available unassigned rides in pool including {wa_booking_id}")
except Exception as e:
    record_test("5. Driver Views Available Pool", False, str(e))

# 6. Driver Expresses Interest: "I Can Take This Booking"
driver_request_id = None
try:
    req_payload = {
        "note": "Nearby at Indiranagar Metro, ETA 4 mins with clean Sedan"
    }
    r_req = requests.post(f"{API_BASE}/driver/bookings/{wa_booking_id}/request/", json=req_payload, headers=headers_drv, timeout=5)
    req_res = r_req.json()
    driver_request_id = req_res.get("request", {}).get("id")
    req_status = req_res.get("request", {}).get("status")
    record_test("6. Driver Expresses Interest ('I Can Take This Booking')",
                r_req.status_code == 201 and req_status == "pending",
                f"Created Driver Request #{driver_request_id} with status: {req_status} (NOT directly assigned)")
except Exception as e:
    record_test("6. Driver Expresses Interest", False, str(e))

# 7. Duplicate Request Prevention
try:
    r_dup = requests.post(f"{API_BASE}/driver/bookings/{wa_booking_id}/request/", json={}, headers=headers_drv, timeout=5)
    dup_blocked = r_dup.status_code == 400 and "already" in r_dup.json().get("message", "").lower()
    record_test("7. Duplicate Driver Request Prevention", dup_blocked,
                f"Duplicate rejected with HTTP 400: '{r_dup.json().get('message')}'")
except Exception as e:
    record_test("7. Duplicate Driver Request Prevention", False, str(e))

# 8. Admin Reviews Driver Requests
try:
    r_admin_reqs = requests.get(f"{API_BASE}/admin/driver-requests/?status=pending", headers=headers_adm, timeout=5)
    admin_reqs_data = r_admin_reqs.json()
    req_list = admin_reqs_data.get("requests", [])
    found_in_admin = any(rq.get("id") == driver_request_id for rq in req_list)
    record_test("8. Admin Reviews Driver Requests", r_admin_reqs.status_code == 200 and found_in_admin,
                f"Admin retrieved {len(req_list)} pending requests including #{driver_request_id}")
except Exception as e:
    record_test("8. Admin Reviews Driver Requests", False, str(e))

# 9. Admin Assigns Booking to Requesting Driver
try:
    r_assign = requests.post(f"{API_BASE}/admin/driver-requests/{driver_request_id}/assign/",
                             json={"notes": "Approved by Admin for Kumar"}, headers=headers_adm, timeout=5)
    assign_res = r_assign.json()
    booking_status = assign_res.get("booking", {}).get("status")
    assigned_driver_id = assign_res.get("booking", {}).get("driver")
    record_test("9. Admin Manually Approves & Assigns Driver",
                r_assign.status_code == 200 and booking_status == "driver_assigned" and assigned_driver_id is not None,
                f"Booking {wa_booking_id} officially assigned! Status: {booking_status}")
except Exception as e:
    record_test("9. Admin Manually Approves & Assigns Driver", False, str(e))

# 10. Driver Sees Ride in "My Assigned Rides"
try:
    r_my_assigned = requests.get(f"{API_BASE}/driver/my-assigned-bookings/", headers=headers_drv, timeout=5)
    my_assigned_data = r_my_assigned.json()
    assigned_list = my_assigned_data.get("bookings", [])
    has_ride = any(b.get("booking_id") == wa_booking_id for b in assigned_list)
    record_test("10. Driver Assigned Rides Portal", r_my_assigned.status_code == 200 and has_ride,
                f"Ride {wa_booking_id} visible under Driver's assigned rides")
except Exception as e:
    record_test("10. Driver Assigned Rides Portal", False, str(e))

# 11. Driver Completes Ride Lifecycle
try:
    # Start Trip
    r_start = requests.post(f"{API_BASE}/driver/bookings/{wa_booking_id}/trip-status/",
                            json={"status": "trip_started"}, headers=headers_drv, timeout=5)
    # Complete Trip
    r_done = requests.post(f"{API_BASE}/driver/bookings/{wa_booking_id}/trip-status/",
                           json={"status": "trip_completed"}, headers=headers_drv, timeout=5)
    done_res = r_done.json()
    final_status = done_res.get("booking", {}).get("status")
    payment_status = done_res.get("booking", {}).get("payment_status")
    record_test("11. Driver Trip Lifecycle (Started -> Completed & Paid)",
                r_done.status_code == 200 and final_status == "trip_completed" and payment_status == "paid",
                f"Trip marked as: {final_status}, Payment: {payment_status}")
except Exception as e:
    record_test("11. Driver Trip Lifecycle", False, str(e))

# 12. Frontend Pages Availability (18 pages including Driver and Admin Driver-Requests)
try:
    pages = [
        "/",
        "/booking.html",
        "/login.html",
        "/register.html",
        "/driver/dashboard.html",
        "/admin/dashboard.html",
        "/admin/driver-requests.html",
        "/admin/bookings.html",
        "/admin/drivers.html",
        "/admin/vehicles.html",
        "/admin/customers.html",
        "/admin/fares.html",
        "/admin/map.html",
        "/admin/payments.html",
        "/admin/reviews.html",
        "/admin/reports.html",
        "/user/dashboard.html",
        "/user/bookings.html"
    ]
    all_pages_live = True
    for p in pages:
        res = requests.get(f"{FRONTEND_BASE}{p}", timeout=3)
        if res.status_code != 200:
            all_pages_live = False
            print(f"  [WARN] Page {p} returned HTTP {res.status_code}")
            break

    record_test("12. All 18 Full-Stack Web Portal Pages Live", all_pages_live, "All Customer, Driver, and Admin HTML interfaces respond with HTTP 200 OK")
except Exception as e:
    record_test("12. All 18 Full-Stack Web Portal Pages Live", False, str(e))

print("==================================================================")
print(f"WORKFLOW TEST SUMMARY: {passed} PASSED, {failed} FAILED")
print("==================================================================")

if failed > 0:
    sys.exit(1)
else:
    sys.exit(0)
