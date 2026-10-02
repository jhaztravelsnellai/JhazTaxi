import os
import re
import json
import xml.etree.ElementTree as ET
import urllib.request
import urllib.parse
from html.parser import HTMLParser

BASE_URL = "http://127.0.0.1:5500"
FRONTEND_DIR = os.path.join(os.path.dirname(__file__), "frontend")

def fetch(path):
    url = f"{BASE_URL}{path}"
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 SEO-Auditor/1.0"})
    with urllib.request.urlopen(req) as resp:
        return resp.status, resp.read().decode('utf-8', errors='ignore')

def test_robots_txt():
    print("\n--- 1. Testing robots.txt ---")
    status, content = fetch("/robots.txt")
    assert status == 200, f"robots.txt status: {status}"
    assert "User-agent: *" in content, "Missing User-agent: *"
    assert "Disallow: /admin/" in content, "Missing Disallow: /admin/"
    assert "Disallow: /user/" in content, "Missing Disallow: /user/"
    assert "Disallow: /driver/dashboard.html" in content, "Missing Disallow: /driver/dashboard.html"
    assert "Sitemap: https://jhaztaxi.com/sitemap.xml" in content, "Missing Sitemap declaration"
    print(" [OK] robots.txt is valid, secure, and properly disallows private portals.")

def test_sitemap_xml():
    print("\n--- 2. Testing sitemap.xml ---")
    status, content = fetch("/sitemap.xml")
    assert status == 200, f"sitemap.xml status: {status}"
    
    root = ET.fromstring(content)
    # Namespace handling
    ns = {'ns': 'http://www.sitemaps.org/schemas/sitemap/0.9'}
    urls = [loc.text for loc in root.findall('ns:url/ns:loc', ns)]
    print(f" Found {len(urls)} sitemap entries:")
    assert len(urls) >= 7, f"Expected at least 7 URLs in sitemap, got {len(urls)}"
    
    for u in urls:
        path = urllib.parse.urlparse(u).path
        if not path or path == "/":
            path = "/index.html"
        st, body = fetch(path)
        assert st == 200, f"Sitemap URL {u} returned status {st}"
        print(f"   [OK] {u} -> 200 OK ({len(body)} bytes)")
    print(" [OK] All sitemap.xml URLs are fully responsive and return HTTP 200.")

def test_webmanifest_and_favicons():
    print("\n--- 3. Testing Webmanifest & Favicons ---")
    status, content = fetch("/site.webmanifest")
    assert status == 200, f"site.webmanifest status: {status}"
    manifest = json.loads(content)
    assert manifest.get("name") == "JhazTaxi - Premium Urban Taxi Booking"
    assert manifest.get("short_name") == "JhazTaxi"
    assert len(manifest.get("icons", [])) >= 2
    print(f"   [OK] Manifest valid: name='{manifest['name']}'")

    for fav in ["/assets/icons/favicon.svg", "/assets/favicon.svg", "/favicon.ico"]:
        st, _ = fetch(fav)
        assert st == 200, f"Favicon {fav} returned {st}"
        print(f"   [OK] {fav} -> 200 OK")
    print(" [OK] PWA Webmanifest and Favicons verified.")

class MetaCollector(HTMLParser):
    def __init__(self):
        super().__init__()
        self.title = ""
        self.in_title = False
        self.metas = []
        self.links = []
        self.scripts = []
        self.in_script = False
        self.script_type = ""
        self.current_script = ""
        self.h1_count = 0
        self.images_without_alt = []

    def handle_starttag(self, tag, attrs):
        attr_dict = dict(attrs)
        if tag == "title":
            self.in_title = True
        elif tag == "meta":
            self.metas.append(attr_dict)
        elif tag == "link":
            self.links.append(attr_dict)
        elif tag == "script":
            self.in_script = True
            self.script_type = attr_dict.get("type", "")
            self.current_script = ""
        elif tag == "h1":
            self.h1_count += 1
        elif tag == "img":
            if "alt" not in attr_dict or not attr_dict["alt"].strip():
                self.images_without_alt.append(attr_dict.get("src", "unknown"))

    def handle_endtag(self, tag):
        if tag == "title":
            self.in_title = False
        elif tag == "script":
            if self.in_script and self.script_type == "application/ld+json":
                self.scripts.append(self.current_script)
            self.in_script = False
            self.current_script = ""

    def handle_data(self, data):
        if self.in_title:
            self.title += data
        elif self.in_script:
            self.current_script += data

def test_public_pages_seo():
    print("\n--- 4. Testing Public Pages On-Page SEO & Structured Data ---")
    public_pages = [
        "/index.html",
        "/booking.html",
        "/vehicles.html",
        "/about.html",
        "/contact.html",
        "/driver/register.html"
    ]

    for p in public_pages:
        st, html = fetch(p)
        assert st == 200, f"{p} returned {st}"
        parser = MetaCollector()
        parser.feed(html)

        # 1. Title
        assert parser.title.strip(), f"{p}: Empty <title>"
        assert len(parser.title.strip()) >= 15, f"{p}: Title too short ({parser.title})"

        # 2. Meta description
        desc = next((m.get("content") for m in parser.metas if m.get("name", "").lower() == "description"), None)
        assert desc and len(desc) >= 30, f"{p}: Missing or short meta description: {desc}"

        # 3. Canonical
        canonical = next((l.get("href") for l in parser.links if l.get("rel") == "canonical"), None)
        assert canonical and canonical.startswith("https://jhaztaxi.com"), f"{p}: Invalid canonical link: {canonical}"

        # 4. OpenGraph tags
        og_title = next((m.get("content") for m in parser.metas if m.get("property") == "og:title"), None)
        og_desc = next((m.get("content") for m in parser.metas if m.get("property") == "og:description"), None)
        og_img = next((m.get("content") for m in parser.metas if m.get("property") == "og:image"), None)
        assert og_title, f"{p}: Missing og:title"
        assert og_desc, f"{p}: Missing og:description"
        assert og_img, f"{p}: Missing og:image"

        # 5. Twitter Card
        tw_card = next((m.get("content") for m in parser.metas if m.get("name") == "twitter:card"), None)
        assert tw_card == "summary_large_image", f"{p}: Missing twitter:card"

        # 6. Schema.org JSON-LD
        assert len(parser.scripts) >= 1, f"{p}: Missing Schema.org JSON-LD script"
        for s in parser.scripts:
            try:
                data = json.loads(s.strip())
                assert "@context" in data or "@graph" in data or "name" in data
            except Exception as e:
                raise AssertionError(f"{p}: Invalid JSON-LD: {e}")

        # 7. Heading hierarchy: exactly 1 h1
        assert parser.h1_count == 1, f"{p}: Expected 1 <h1> tag, got {parser.h1_count}"

        print(f"   [OK] {p} -> Title: '{parser.title.strip()[:35]}...' | h1: {parser.h1_count} | Schema: Yes | Canonical: {canonical}")

    print(" [OK] All public pages pass on-page SEO, Open Graph, and Structured Data audits.")

def test_auth_and_private_pages_indexing():
    print("\n--- 5. Testing Authentication & Private Pages Security Indexing Rules ---")
    
    # Auth login/signup pages -> noindex, follow
    auth_pages = [
        "/login.html",
        "/register.html",
        "/driver/login.html"
    ]
    for ap in auth_pages:
        st, html = fetch(ap)
        assert st == 200, f"{ap} returned {st}"
        parser = MetaCollector()
        parser.feed(html)
        robots = next((m.get("content") for m in parser.metas if m.get("name", "").lower() == "robots"), None)
        assert robots and "noindex" in robots and "follow" in robots, f"{ap} expected 'noindex, follow', got '{robots}'"
        print(f"   [OK] {ap} -> robots: '{robots}' (Protects auth forms from ranking dilution while crawling links)")

    # Private internal portals -> noindex, nofollow
    private_pages = [
        "/driver/dashboard.html",
        "/user/dashboard.html",
        "/user/bookings.html",
        "/user/booking-details.html",
        "/user/profile.html",
        "/user/notifications.html",
        "/admin/login.html",
        "/admin/dashboard.html",
        "/admin/bookings.html",
        "/admin/driver-requests.html",
        "/admin/drivers.html",
        "/admin/vehicles.html",
        "/admin/customers.html",
        "/admin/fares.html",
        "/admin/map.html",
        "/admin/payments.html",
        "/admin/reports.html",
        "/admin/reviews.html"
    ]
    for pp in private_pages:
        st, html = fetch(pp)
        assert st == 200, f"{pp} returned {st}"
        parser = MetaCollector()
        parser.feed(html)
        robots = next((m.get("content") for m in parser.metas if m.get("name", "").lower() == "robots"), None)
        assert robots and "noindex" in robots and "nofollow" in robots, f"{pp} expected 'noindex, nofollow', got '{robots}'"
        print(f"   [OK] {pp} -> robots: '{robots}' (Zero search exposure for private dashboard data)")

    print(" [OK] All private user, driver, and admin portals strictly protected with 'noindex, nofollow'.")

if __name__ == "__main__":
    print("==================================================")
    print("  JhazTaxi Comprehensive SEO & Security Audit")
    print("==================================================")
    test_robots_txt()
    test_sitemap_xml()
    test_webmanifest_and_favicons()
    test_public_pages_seo()
    test_auth_and_private_pages_indexing()
    print("\n==================================================")
    print("  ALL 5 SEO AUDIT SUITES PASSED (100% COMPLIANT) ")
    print("==================================================")
