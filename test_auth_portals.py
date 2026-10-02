import requests
import io
import time
from PIL import Image

BASE_URL = "http://127.0.0.1:8000/api"
FE_URL = "http://127.0.0.1:5500"

def make_dummy_image(color="blue", format="JPEG"):
    file_obj = io.BytesIO()
    img = Image.new("RGB", (100, 100), color=color)
    img.save(file_obj, format=format)
    file_obj.seek(0)
    return file_obj

def run_tests():
    print("=== Testing Customer, Driver, and Admin Portals & Security ===")
    ts = int(time.time())

    # 1. Customer Registration Validation
    print("1. Testing Customer Registration validations...")
    # Test missing phone
    res_no_phone = requests.post(f"{BASE_URL}/auth/register/", json={
        "full_name": "Test Customer",
        "email": f"cust_{ts}@example.com",
        "password": "SecurePass123!",
        "confirm_password": "SecurePass123!"
    })
    assert res_no_phone.status_code == 400
    assert "phone_number" in res_no_phone.json().get("errors", {})
    print("   -> Correctly enforced Phone Number requirement for Customer.")

    # Test missing full_name
    res_no_name = requests.post(f"{BASE_URL}/auth/register/", json={
        "email": f"cust_{ts}@example.com",
        "phone_number": "+91 91234 56789",
        "password": "SecurePass123!",
        "confirm_password": "SecurePass123!"
    })
    assert res_no_name.status_code == 400
    assert "full_name" in res_no_name.json().get("errors", {})
    print("   -> Correctly enforced Full Name requirement for Customer.")

    # Successful Customer Registration (no profile photo required)
    cust_email = f"customer_{ts}@jhaztaxi.com"
    cust_phone = f"+91 91234 {ts % 100000:05d}"
    res1_ok = requests.post(f"{BASE_URL}/auth/register/", json={
        "full_name": f"Priya Sharma {ts}",
        "email": cust_email,
        "phone_number": cust_phone,
        "password": "customer123",
        "confirm_password": "customer123",
        "role": "customer"
    })
    assert res1_ok.status_code == 201, f"Failed customer register: {res1_ok.status_code} {res1_ok.text}"
    cust_data = res1_ok.json()
    assert cust_data["user"]["role"] == "customer"
    assert cust_data["token"]
    print("   -> Customer registered successfully without profile picture.")

    # 2. Driver Registration Validations (POST /api/auth/driver-register/)
    print("2. Testing Driver Registration validations (compulsory photos, plate, phone)...")
    img_drv = make_dummy_image("red")
    img_car = make_dummy_image("blue")

    # Missing driver photo
    res_no_photo = requests.post(
        f"{BASE_URL}/auth/driver-register/",
        data={
            "name": f"Driver Test {ts}",
            "phone": f"+91 98111 {ts % 100000:05d}",
            "license_number": f"DL-TEST-{ts % 10000:04d}",
            "vehicle_number": f"KA-01-XX-{ts % 10000:04d}",
            "password": "driver123",
            "confirm_password": "driver123",
        },
        files={"car_image": ("car.jpg", img_car, "image/jpeg")}
    )
    assert res_no_photo.status_code == 400
    assert "profile_image" in res_no_photo.json().get("errors", {})
    print("   -> Correctly rejected driver registration without driver profile photo.")

    # Missing car photo
    img_drv.seek(0)
    res_no_car = requests.post(
        f"{BASE_URL}/auth/driver-register/",
        data={
            "name": f"Driver Test {ts}",
            "phone": f"+91 98111 {ts % 100000:05d}",
            "license_number": f"DL-TEST-{ts % 10000:04d}",
            "vehicle_number": f"KA-01-XX-{ts % 10000:04d}",
            "password": "driver123",
            "confirm_password": "driver123",
        },
        files={"profile_image": ("driver.jpg", img_drv, "image/jpeg")}
    )
    assert res_no_car.status_code == 400
    assert "car_image" in res_no_car.json().get("errors", {})
    print("   -> Correctly rejected driver registration without car photo.")

    # Successful Driver Registration (with compulsory photos, plate, phone, and optional email left blank)
    img_drv.seek(0)
    img_car.seek(0)
    driver_phone = f"+91 98222 {ts % 100000:05d}"
    driver_plate = f"TN-02-ZZ-{ts % 10000:04d}"
    driver_lic = f"DL-TN-2024-{ts % 10000:04d}"
    res_drv_ok = requests.post(
        f"{BASE_URL}/auth/driver-register/",
        data={
            "name": f"Vignesh Driver {ts}",
            "phone": driver_phone,
            "license_number": driver_lic,
            "vehicle_number": driver_plate,
            "vehicle_type": "Sedan",
            "password": "driver123",
            "confirm_password": "driver123",
            # Email is optional, leaving blank
        },
        files={
            "profile_image": ("vignesh_drv.jpg", img_drv, "image/jpeg"),
            "car_image": ("vignesh_cab.jpg", img_car, "image/jpeg"),
        }
    )
    assert res_drv_ok.status_code == 201, f"Driver register failed: {res_drv_ok.status_code} {res_drv_ok.text}"
    drv_reg_data = res_drv_ok.json()
    assert drv_reg_data["user"]["role"] == "driver"
    assert drv_reg_data["driver"]["vehicle_number"] == driver_plate
    assert drv_reg_data["token"]
    print("   -> Driver registered successfully during sign-up with compulsory photos & vehicle plate! (Email optional)")

    # 3. Dedicated Driver Login (/api/auth/driver-login/)
    print("3. Testing Driver Login endpoint...")
    # Test login with phone number
    res_drv_login = requests.post(f"{BASE_URL}/auth/driver-login/", json={
        "email": driver_phone,
        "password": "driver123"
    })
    assert res_drv_login.status_code == 200, f"Driver login failed with phone: {res_drv_login.status_code} {res_drv_login.text}"
    assert res_drv_login.json()["user"]["role"] == "driver"
    print("   -> Driver successfully signed in using mobile number!")

    # Test Customer trying to login through Driver Portal (should be denied)
    res_cust_at_drv = requests.post(f"{BASE_URL}/auth/driver-login/", json={
        "email": cust_email,
        "password": "customer123"
    })
    assert res_cust_at_drv.status_code == 403, f"Expected 403 for customer at driver login, got {res_cust_at_drv.status_code}"
    print("   -> Protected: Customer attempting driver portal login is correctly denied with HTTP 403.")

    # 4. Admin Login (/api/auth/admin-login/)
    print("4. Testing Admin Login security...")
    res_adm_login = requests.post(f"{BASE_URL}/auth/admin-login/", json={
        "email": "admin@jhaztaxi.com",
        "password": "JhazTaxi@Admin2026#"
    })
    assert res_adm_login.status_code == 200
    assert res_adm_login.json()["user"]["role"] == "admin"
    print("   -> Admin successfully authenticated at internal admin-login.")

    # Non-admin user trying to access admin-login
    res_cust_at_adm = requests.post(f"{BASE_URL}/auth/admin-login/", json={
        "email": cust_email,
        "password": "customer123"
    })
    assert res_cust_at_adm.status_code == 403, f"Expected 403 for non-admin at admin-login, got {res_cust_at_adm.status_code}"
    print("   -> Protected: Non-admin user attempting admin login is correctly denied with HTTP 403.")

    # 5. Public Website Analysis & Admin Link Check
    print("5. Verifying Public Home Page (index.html) does NOT expose Admin...")
    idx_res = requests.get(f"{FE_URL}/index.html")
    assert idx_res.status_code == 200
    idx_html = idx_res.text
    assert "admin/login.html" not in idx_html, "Found admin/login.html link in public index.html!"
    assert "Admin Portal" not in idx_html, "Found 'Admin Portal' text in public index.html!"
    assert "Customer Login" in idx_html, "Customer Login not found in index.html"
    assert "Driver Portal" in idx_html or "Drive with Us" in idx_html, "Driver portal not found in index.html"
    print("   -> Verified: index.html has ZERO references to admin portal and prominently displays ONLY Customer and Driver portals.")

    # 6. Check All 5 Dedicated Auth Pages live on Frontend
    print("6. Verifying Frontend Dedicated Auth Pages...")
    pages = [
        ("/login.html", "Customer Sign In"),
        ("/register.html", "Create Passenger Account"),
        ("/driver/login.html", "Driver Partner Sign In"),
        ("/driver/register.html", "Driver Partner Registration"),
        ("/admin/login.html", "Administrator Login"),
    ]
    for path, expected_text in pages:
        r = requests.get(f"{FE_URL}{path}")
        assert r.status_code == 200, f"Page {path} returned {r.status_code}"
        assert expected_text in r.text, f"Page {path} missing expected text '{expected_text}'"
        print(f"   -> [200 OK] {path} is active and verified.")

    print("\nALL PORTAL SEPARATION & SECURITY TESTS PASSED! [SUCCESS]")

if __name__ == "__main__":
    run_tests()
