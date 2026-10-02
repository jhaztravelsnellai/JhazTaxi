import requests
import json
from decimal import Decimal

API_BASE = "http://127.0.0.1:8000/api"

def run_tests():
    print("==================================================================")
    print("  Testing Manual Trip Publish, Driver Pool, & Payment (COD / GPay)")
    print("==================================================================")

    # 1. Admin Login
    adm_login = requests.post(f"{API_BASE}/auth/admin-login/", json={
        "username": "admin@jhaztaxi.com",
        "password": "admin123"
    })
    assert adm_login.status_code == 200, f"Admin login failed: {adm_login.text}"
    adm_token = adm_login.json()["token"]
    headers_adm = {"Authorization": f"Token {adm_token}", "Content-Type": "application/json"}
    print(" [OK] 1. Admin Authenticated successfully.")

    # 2. Driver Login
    drv_login = requests.post(f"{API_BASE}/auth/driver-login/", json={
        "email": "driver@jhaztaxi.com",
        "password": "driver123"
    })
    assert drv_login.status_code == 200, f"Driver login failed: {drv_login.text}"
    drv_token = drv_login.json()["token"]
    headers_drv = {"Authorization": f"Token {drv_token}", "Content-Type": "application/json"}
    
    test_driver = drv_login.json().get("driver", {})
    assert test_driver, "Driver profile not found in login response"
    print(f" [OK] 2. Driver Authenticated: ID {test_driver['id']} - {test_driver['name']} ({test_driver['phone']})")

    # 3. Test Manual Trip Publish (Broadcast to Pool with Cash on Delivery)
    cod_trip_payload = {
        "customer_name": "Suresh Raina (Manual Dispatch)",
        "customer_phone": "+91 99000 11223",
        "pickup_address": "Indiranagar 100ft Road, Bengaluru",
        "drop_address": "Koramangala Sony World Signal, Bengaluru",
        "vehicle_type": "Sedan",
        "distance_km": 8.5,
        "total_fare": 240,
        "payment_method": "cash",
        "pickup_date": "2026-10-02",
        "pickup_time": "16:30",
        "customer_notes": "Urgent manual trip from WhatsApp group. Cash on delivery."
    }
    r_pub_cod = requests.post(f"{API_BASE}/admin/bookings/publish-trip/", json=cod_trip_payload, headers=headers_adm)
    assert r_pub_cod.status_code == 201, f"Failed to publish COD trip: {r_pub_cod.text}"
    cod_booking = r_pub_cod.json()["booking"]
    print(f" [OK] 4. Admin Published Trip {cod_booking['booking_id']} to Pool (Status: {cod_booking['status']}, Pay: {cod_booking['payment_method']}).")

    # 4. Verify Driver can see it in Available Pool
    pool_res = requests.get(f"{API_BASE}/driver/available-bookings/", headers=headers_drv)
    assert pool_res.status_code == 200
    pool_ids = [b["booking_id"] for b in pool_res.json().get("bookings", [])]
    assert cod_booking["booking_id"] in pool_ids, f"Trip {cod_booking['booking_id']} not found in driver pool"
    print(f" [OK] 5. Driver sees Published Trip {cod_booking['booking_id']} in Available Rides Pool.")

    # 5. Test Manual Trip Publish with Direct Driver Assignment & GPay Payment
    gpay_trip_payload = {
        "customer_name": "Meera Krishnan (VIP Airport Direct)",
        "customer_phone": "+91 98777 66554",
        "pickup_address": "MG Road Brigade Towers, Bengaluru",
        "drop_address": "Kempegowda International Airport (BLR)",
        "vehicle_type": "SUV",
        "distance_km": 38.0,
        "total_fare": 950,
        "payment_method": "gpay",
        "driver_id": test_driver["id"],  # Direct Assignment
        "pickup_date": "2026-10-02",
        "pickup_time": "18:00",
        "customer_notes": "VIP client. GPay payment confirmed upon drop."
    }
    r_pub_gpay = requests.post(f"{API_BASE}/admin/bookings/publish-trip/", json=gpay_trip_payload, headers=headers_adm)
    assert r_pub_gpay.status_code == 201, f"Failed to publish GPay direct trip: {r_pub_gpay.text}"
    gpay_booking = r_pub_gpay.json()["booking"]
    assert gpay_booking["status"] == "driver_assigned", f"Expected driver_assigned, got {gpay_booking['status']}"
    drv_id = gpay_booking["driver"]["id"] if isinstance(gpay_booking["driver"], dict) else gpay_booking["driver"]
    assert drv_id == test_driver["id"]
    assert gpay_booking["payment_method"] == "gpay"
    print(f" [OK] 6. Admin Directly Assigned Trip {gpay_booking['booking_id']} to Driver {test_driver['name']} with GPay payment.")

    # 6. Verify Driver sees it under My Assigned Rides
    my_rides_res = requests.get(f"{API_BASE}/driver/my-assigned-bookings/", headers=headers_drv)
    assert my_rides_res.status_code == 200
    my_assigned_ids = [b["booking_id"] for b in my_rides_res.json().get("bookings", [])]
    assert gpay_booking["booking_id"] in my_assigned_ids, f"Trip {gpay_booking['booking_id']} not found in my assigned rides"
    print(f" [OK] 7. Driver sees Directly Assigned Ride {gpay_booking['booking_id']} with GPay payment badge.")

    # 7. Complete Trip & Verify Payment transitions to Paid
    for step_status in ["driver_arriving", "trip_started", "trip_completed"]:
        r_step = requests.post(f"{API_BASE}/driver/bookings/{gpay_booking['booking_id']}/trip-status/", 
                               json={"status": step_status}, headers=headers_drv)
        assert r_step.status_code == 200, f"Step {step_status} failed: {r_step.text}"
        print(f"   -> Trip {gpay_booking['booking_id']} status updated to: {step_status}")

    # Check that payment is recorded as completed
    detail_res = requests.get(f"{API_BASE}/bookings/{gpay_booking['booking_id']}/", headers=headers_adm)
    assert detail_res.status_code == 200
    final_booking = detail_res.json().get("booking") or detail_res.json()
    assert final_booking["status"] == "trip_completed"
    assert final_booking["payment_status"] == "paid"
    print(f" [OK] 8. Trip {gpay_booking['booking_id']} successfully completed and GPay payment marked as PAID.")

    print("\n==================================================================")
    print("  ALL MANUAL PUBLISH, DISPATCH, & PAYMENT TESTS PASSED (100%)")
    print("==================================================================")

if __name__ == "__main__":
    run_tests()
