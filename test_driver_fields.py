import os
import requests
import io
from PIL import Image

BASE_URL = "http://127.0.0.1:8000/api"

# Helper to create a dummy image in memory
def make_dummy_image(color="blue", format="JPEG"):
    file_obj = io.BytesIO()
    image = Image.new("RGB", (100, 100), color=color)
    image.save(file_obj, format=format)
    file_obj.seek(0)
    return file_obj

def run_tests():
    print("=== Testing Driver Compulsory & Optional Fields ===")

    # 1. Login as Admin
    login_res = requests.post(f"{BASE_URL}/auth/login/", json={
        "email": "admin@jhaztaxi.com",
        "password": "admin123"
    })
    assert login_res.status_code == 200, f"Admin login failed: {login_res.text}"
    token = login_res.json()["token"]
    headers = {"Authorization": f"Token {token}"}
    print("1. Admin authenticated successfully.")

    # 2. Test missing phone (should fail)
    img_driver = make_dummy_image("red")
    img_car = make_dummy_image("green")
    res = requests.post(
        f"{BASE_URL}/drivers/",
        headers=headers,
        data={
            "name": "Test Missing Phone",
            "license_number": "DL-TEST-001",
            "vehicle_number": "TN-01-AB-1111",
        },
        files={
            "profile_image": ("driver.jpg", img_driver, "image/jpeg"),
            "car_image": ("car.jpg", img_car, "image/jpeg"),
        }
    )
    print(f"2. Missing phone status: {res.status_code}")
    assert res.status_code == 400, f"Expected 400 for missing phone, got {res.status_code}: {res.text}"
    assert "phone" in res.json().get("errors", {}), f"Expected phone error in {res.json()}"
    print("   -> Correctly rejected missing phone number.")

    # 3. Test missing vehicle_number (should fail)
    img_driver.seek(0)
    img_car.seek(0)
    res = requests.post(
        f"{BASE_URL}/drivers/",
        headers=headers,
        data={
            "name": "Test Missing Vehicle Number",
            "phone": "+91 99999 11111",
            "license_number": "DL-TEST-002",
        },
        files={
            "profile_image": ("driver.jpg", img_driver, "image/jpeg"),
            "car_image": ("car.jpg", img_car, "image/jpeg"),
        }
    )
    print(f"3. Missing vehicle_number status: {res.status_code}")
    assert res.status_code == 400, f"Expected 400 for missing vehicle_number, got {res.status_code}: {res.text}"
    assert "vehicle_number" in res.json().get("errors", {}), f"Expected vehicle_number error in {res.json()}"
    print("   -> Correctly rejected missing vehicle plate number.")

    # 4. Test missing driver picture (should fail)
    img_car.seek(0)
    res = requests.post(
        f"{BASE_URL}/drivers/",
        headers=headers,
        data={
            "name": "Test Missing Driver Pic",
            "phone": "+91 99999 22222",
            "license_number": "DL-TEST-003",
            "vehicle_number": "TN-01-AB-2222",
        },
        files={
            "car_image": ("car.jpg", img_car, "image/jpeg"),
        }
    )
    print(f"4. Missing driver picture status: {res.status_code}")
    assert res.status_code == 400, f"Expected 400 for missing profile_image, got {res.status_code}: {res.text}"
    assert "profile_image" in res.json().get("errors", {}), f"Expected profile_image error in {res.json()}"
    print("   -> Correctly rejected missing driver profile picture.")

    # 5. Test missing car picture (should fail)
    img_driver.seek(0)
    res = requests.post(
        f"{BASE_URL}/drivers/",
        headers=headers,
        data={
            "name": "Test Missing Car Pic",
            "phone": "+91 99999 33333",
            "license_number": "DL-TEST-004",
            "vehicle_number": "TN-01-AB-3333",
        },
        files={
            "profile_image": ("driver.jpg", img_driver, "image/jpeg"),
        }
    )
    print(f"5. Missing car picture status: {res.status_code}")
    assert res.status_code == 400, f"Expected 400 for missing car_image, got {res.status_code}: {res.text}"
    assert "car_image" in res.json().get("errors", {}), f"Expected car_image error in {res.json()}"
    print("   -> Correctly rejected missing car picture.")

    # 6. Test SUCCESSFUL driver creation WITHOUT email (email is optional)
    import time
    ts = int(time.time())
    img_driver = make_dummy_image("blue")
    img_car = make_dummy_image("yellow")
    test_phone = f"+91 98888 {ts % 100000:05d}"
    plate_num = f"TN-07-CK-{ts % 10000:04d}"
    license_num = f"DL-TN-2024-{ts % 10000:04d}"
    res = requests.post(
        f"{BASE_URL}/drivers/",
        headers=headers,
        data={
            "name": f"Karthik Subramanian {ts}",
            "phone": test_phone,
            "license_number": license_num,
            "vehicle_number": plate_num,
            "address": "12 Anna Salai, Chennai",
        },
        files={
            "profile_image": ("karthik_driver.jpg", img_driver, "image/jpeg"),
            "car_image": ("karthik_sedan.jpg", img_car, "image/jpeg"),
        }
    )
    print(f"6. Driver creation without email status: {res.status_code}")
    assert res.status_code == 201, f"Failed creating driver without email: {res.status_code} {res.text}"
    driver_data = res.json()["driver"]
    driver_id = driver_data["id"]
    print(f"   -> Driver created successfully without email! ID: {driver_id}")
    print(f"   -> Vehicle Number: {driver_data['vehicle_number']}")
    print(f"   -> Profile Photo URL: {driver_data['display_profile_photo']}")
    print(f"   -> Car Photo URL: {driver_data['display_car_photo']}")
    assert driver_data["display_profile_photo"], "display_profile_photo is empty"
    assert driver_data["display_car_photo"], "display_car_photo is empty"

    # Verify photos are accessible via GET
    p_url = driver_data["display_profile_photo"]
    c_url = driver_data["display_car_photo"]
    res_p = requests.get(p_url)
    res_c = requests.get(c_url)
    assert res_p.status_code == 200, f"Profile image URL not reachable: {res_p.status_code}"
    assert res_c.status_code == 200, f"Car image URL not reachable: {res_c.status_code}"
    print("   -> Uploaded driver picture and car picture are both publicly accessible via HTTP 200!")

    # 7. Test driver login with auto-created credentials and /driver/profile/ endpoint
    auto_email = f"driver_{test_phone.replace('+', '').replace(' ', '')}@jhaztaxi.com"
    d_login = requests.post(f"{BASE_URL}/auth/login/", json={
        "email": auto_email,
        "password": "driver123"
    })
    assert d_login.status_code == 200, f"Driver login failed: {d_login.text}"
    d_token = d_login.json()["token"]
    d_headers = {"Authorization": f"Token {d_token}"}
    print(f"7. Driver logged in successfully with auto-account ({auto_email}).")

    prof_res = requests.get(f"{BASE_URL}/driver/profile/", headers=d_headers)
    assert prof_res.status_code == 200, f"Failed fetching driver profile: {prof_res.text}"
    prof_data = prof_res.json()["driver"]
    assert "Karthik Subramanian" in prof_data["name"]
    assert prof_data["vehicle_number"] == plate_num
    assert prof_data["display_profile_photo"]
    assert prof_data["display_car_photo"]
    print(f"   -> Driver Profile API verified! Returning vehicle number {prof_data['vehicle_number']} and photo URLs.")

    # 8. Test SUCCESSFUL driver creation WITH email (email provided)
    img_driver2 = make_dummy_image("purple")
    img_car2 = make_dummy_image("orange")
    res8 = requests.post(
        f"{BASE_URL}/drivers/",
        headers=headers,
        data={
            "name": f"Suresh Raina {ts}",
            "phone": f"+91 97777 {ts % 100000:05d}",
            "email": f"suresh.raina.{ts}@jhaztaxi.com",
            "license_number": f"DL-TN-2024-SR{ts % 10000:04d}",
            "vehicle_number": f"TN-09-XY-{ts % 10000:04d}",
            "address": "45 T Nagar, Chennai",
        },
        files={
            "profile_image": ("suresh_driver.jpg", img_driver2, "image/jpeg"),
            "car_image": ("suresh_car.jpg", img_car2, "image/jpeg"),
        }
    )
    print(f"8. Driver creation with email status: {res8.status_code}")
    assert res8.status_code == 201, f"Failed creating driver with email: {res8.status_code} {res8.text}"
    d8_data = res8.json()["driver"]
    assert d8_data["email"] == f"suresh.raina.{ts}@jhaztaxi.com"
    print(f"   -> Driver with custom email created successfully! Email: {d8_data['email']}")

    print("\nALL VERIFICATION TESTS PASSED SUCCESSFULLY! [SUCCESS]")

if __name__ == "__main__":
    run_tests()
