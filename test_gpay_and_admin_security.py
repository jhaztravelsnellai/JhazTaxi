import io
import requests
from PIL import Image

API_BASE = "http://127.0.0.1:8000/api"

def run_tests():
    print("==================================================================")
    print("   Testing Admin Security & GPay Scanner Management Suite")
    print("==================================================================")

    # 1. Test Public / Anonymous access to Payment Settings
    r_public = requests.get(f"{API_BASE}/payment-settings/")
    assert r_public.status_code == 200, f"Expected 200, got {r_public.status_code}"
    p_data = r_public.json()
    assert p_data["success"] is True, "Expected success: True"
    assert "setting" in p_data, "Expected setting object"
    assert "upi_id" in p_data["setting"], "Expected upi_id in setting"
    assert "qr_image_url" in p_data["setting"], "Expected qr_image_url in setting"
    print(" [OK] 1. Public Payment Settings endpoint works and returns valid QR scanner URL.")

    # 2. Test Security: Anonymous user CANNOT modify Payment Settings
    r_unauth = requests.post(f"{API_BASE}/payment-settings/", data={"upi_id": "hacker@upi"})
    assert r_unauth.status_code == 403, f"Expected 403 Forbidden, got {r_unauth.status_code}"
    print(" [OK] 2. Security Check: Anonymous / Non-admin modification blocked with 403 Forbidden.")

    # 3. Test Admin Authentication & Login
    r_login = requests.post(f"{API_BASE}/auth/login/", json={
        "email": "admin@jhaztaxi.com",
        "password": "JhazTaxi@Admin2026#"
    })
    assert r_login.status_code == 200, f"Admin login failed: {r_login.text}"
    token = r_login.json()["token"]
    headers = {"Authorization": f"Token {token}"}
    print(" [OK] 3. Admin successfully authenticated with secure production credentials.")

    # 4. Test Admin Uploading a new GPay QR Scanner Image & Updating UPI details
    img = Image.new('RGB', (250, 250), color=(0, 120, 255))
    buf = io.BytesIO()
    img.save(buf, format='PNG')
    buf.seek(0)

    files = {"qr_image": ("official_gpay_scanner.png", buf, "image/png")}
    data = {
        "title": "Official JhazTaxi GPay Scanner",
        "upi_id": "jhaztaxi.official@okaxis",
        "payee_name": "JhazTaxi Corporate Accounts",
        "phone_number": "+91 94444 88888",
        "instructions": "Scan using Google Pay or any UPI app. Show payment confirmation to driver."
    }

    r_update = requests.post(f"{API_BASE}/payment-settings/", data=data, files=files, headers=headers)
    assert r_update.status_code == 200, f"Expected 200, got {r_update.text}"
    updated_setting = r_update.json()["setting"]
    assert updated_setting["upi_id"] == "jhaztaxi.official@okaxis"
    assert updated_setting["payee_name"] == "JhazTaxi Corporate Accounts"
    assert "payment_qr/official_gpay_scanner" in updated_setting["qr_image_url"]
    print(" [OK] 4. Admin uploaded new GPay Scanner image and updated UPI details successfully.")

    # 5. Verify the uploaded scanner image is directly accessible via HTTP GET
    scanner_url = updated_setting["qr_image_url"]
    r_img = requests.get(scanner_url)
    assert r_img.status_code == 200, f"Failed to fetch uploaded scanner image: {r_img.status_code}"
    assert len(r_img.content) > 0, "Uploaded scanner image was empty"
    print(f" [OK] 5. Uploaded GPay scanner image is live and accessible at: {scanner_url}")

    # 6. Verify Single-URL frontend routes & Admin Fares page
    routes = [
        "http://127.0.0.1:8000/admin/fares",
        "http://127.0.0.1:8000/admin/login",
        "http://127.0.0.1:8000/driver/dashboard",
        "http://127.0.0.1:8000/booking.html"
    ]
    for r in routes:
        res = requests.get(r)
        assert res.status_code == 200, f"Failed to load {r}: {res.status_code}"
    print(" [OK] 6. All Single-URL Admin, Driver, and Booking pages load successfully with HTTP 200.")

    print("\n==================================================================")
    print("   ALL ADMIN SECURITY & GPAY SCANNER TESTS PASSED PERFECTLY!")
    print("==================================================================")

if __name__ == '__main__':
    run_tests()
