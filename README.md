# JhazTaxi - Production-Style Full-Stack Taxi Booking Web Application

> **"Your Ride, Your Way."**  
> A complete, modern, professional taxi booking web application engineered with a **Django REST Framework** backend, a responsive **HTML5/CSS3/JavaScript (Leaflet.js + OpenStreetMap)** frontend, and **PostgreSQL** database architecture.

---

## 1. Project Overview

**JhazTaxi** is a full-featured urban taxi hailing platform that provides:
- Seamless customer booking with real road distance and travel time calculation.
- Automated dynamic fare computation driven strictly by database rules (Base Fare + Distance × Price/KM + Night Surcharge + Extra Passenger Surcharge).
- Comprehensive customer portal: live trip progress visual stepper, driver details, payment status, trip cancellation, and driver ratings/reviews.
- Powerful administration console: real-time fleet dispatch map, driver assignment, ride status transitions, vehicle fleet management, dynamic fare adjustments, and financial analytics.

---

## 2. Key Features

- **Decoupled Architecture**: Clean REST API communication between Frontend (Vercel-ready) and Backend (Render-ready). The frontend **never** connects directly to PostgreSQL.
- **Interactive Road Mapping**: Powered by Leaflet.js, OpenStreetMap tiles, and OSRM (Open Source Routing Machine) for real street navigation and accurate road distance (not straight-line).
- **Dynamic Fare Engine**: Backend-calculated pricing with support for vehicle tiers (Mini, Sedan, SUV, Premium), night charges (10 PM to 6 AM), and passenger capacities.
- **Unique Booking IDs**: Formatted automatically as `JHZ-000001`, `JHZ-000002`, etc.
- **Visual Status Timeline**: 5-step interactive progression (`Pending` &rarr; `Driver Assigned` &rarr; `Driver Arriving` &rarr; `Trip Started` &rarr; `Trip Completed`).
- **Driver Management**: Complete profiles (license number, status: `available`, `on_trip`, `offline`, coordinates, photo, aggregated 5-star rating).
- **Payment Architecture**: Cash on Ride and UPI payment tracking with hooks for Razorpay/Stripe integration.
- **Reports & Analytics**: Daily/monthly ride volumes, revenue charts, popular route analytics, and driver revenue contribution.

---

## 3. Technology Stack & Architecture

```
Frontend (HTML5 + CSS3 + Bootstrap 5 + Leaflet.js + Fetch API)
                     │
                     ▼ (REST API / JSON / Token Auth)
Backend (Python 3.11+ / Django 5.1 / Django REST Framework)
                     │
                     ▼ (SQL / ORM / dj-database-url)
Database (PostgreSQL on Render / Local SQLite for instant dev)
```

- **Frontend**: HTML5, Vanilla CSS3, Bootstrap 5, Leaflet.js, OpenStreetMap, OSRM API, Chart.js.
- **Backend**: Python 3.11/3.13, Django 5.1, Django REST Framework (DRF), `django-cors-headers`, `whitenoise`.
- **Database**: PostgreSQL (`psycopg2-binary` & `dj-database-url`), SQLite fallback for local development.
- **Production Server**: Gunicorn WSGI.

---

## 4. Folder Structure

```
JhazTaxi/
│
├── frontend/
│   ├── index.html                  # Public Landing Page (12 sections, Schema.org, OpenGraph)
│   ├── login.html                  # Customer Sign-in
│   ├── register.html               # Customer Registration
│   ├── booking.html                # Interactive Map & Ride Booking Page
│   ├── vehicles.html               # Fleet Showcase & Specs (ItemList Schema)
│   ├── about.html                  # Company Information (AboutPage Schema)
│   ├── contact.html                # 24/7 Helpline & Dispatch Inquiry (ContactPage Schema)
│   ├── robots.txt                  # Search Engine Directives & Sitemap declaration
│   ├── sitemap.xml                 # Canonical XML Sitemap for search engines
│   ├── site.webmanifest            # PWA Mobile Web App Manifest
│   ├── favicon.ico                 # Standard Favicon
│   │
│   ├── driver/                     # Driver Partner Portal
│   │   ├── login.html              # Driver Mobile/Email Sign-in
│   │   ├── register.html           # Driver Sign-up (Compulsory Photo & Car Upload)
│   │   └── dashboard.html          # Available Booking Pool & Request System (noindex)
│   │
│   ├── user/                       # Customer Portal (Protected, noindex)
│   │   ├── dashboard.html          # Rider Dashboard with Active Trips
│   │   ├── bookings.html           # Full Trip History with Filters
│   │   ├── booking-details.html    # Visual Timeline, Driver Card, Rating
│   │   ├── profile.html            # Profile Details & Edit Form
│   │   └── notifications.html      # Notifications Feed
│   │
│   ├── admin/                      # Operations & Admin Console
│   │   ├── login.html              # Secure Administrator Sign-in
│   │   ├── dashboard.html          # Operational KPIs & Chart.js Visuals
│   │   ├── bookings.html           # Dispatch Table & Driver Assignment
│   │   ├── drivers.html            # Driver Management & Status Toggles
│   │   ├── vehicles.html           # Vehicle Fleet Management
│   │   ├── customers.html          # Passenger Management & Account Toggles
│   │   ├── fares.html              # Dynamic Pricing Rules per Vehicle
│   │   ├── map.html                # Live Dispatch Map (Driver Positions)
│   │   ├── payments.html           # Financial Ledger
│   │   ├── reviews.html            # Customer Feedback & Ratings
│   │   └── reports.html            # Date-Filtered Revenue & Driver Reports
│   │
│   ├── css/
│   │   ├── style.css               # Global JhazTaxi Yellow & Dark Palette
│   │   ├── booking.css             # Map, Autocomplete, & Vehicle Cards
│   │   ├── dashboard.css           # Stepper, Status Pills, & Rating Picker
│   │   └── admin.css               # Sidebar, KPIs, & Admin Tables
│   │
│   ├── js/
│   │   ├── config.js               # Centralized API Base URL & Helpers
│   │   ├── main.js                 # Navbar Auth State & Network Utilities
│   │   ├── auth.js                 # Authentication & Route Guards
│   │   ├── map.js                  # Leaflet Map & Road Routing Engine
│   │   ├── booking.js              # Booking & Fare Engine Integration
│   │   ├── user.js                 # Customer Portal Controller
│   │   └── admin.js                # Admin Portal Controller
│   │
│   └── assets/
│       ├── icons/                  # SVG Icons & Favicon
│       ├── images/                 # Theme Assets
│       └── vehicles/               # Fleet Images
│
├── backend/
│   ├── manage.py
│   ├── config/                     # Settings, URLs, WSGI, ASGI
│   ├── users/                      # Custom User Model & Auth APIs
│   ├── vehicles/                   # Vehicle & Dynamic Fare Engine
│   ├── drivers/                    # Drivers & Live Coordinates
│   ├── bookings/                   # Bookings, Lifecycle & Analytics
│   ├── payments/                   # Payment Records & Ledger
│   ├── reviews/                    # 1-5 Star Ratings & Feedback
│   └── notifications/              # Alerts & Notification Logs
│
├── .env.example                    # Template Environment Variables
├── .gitignore                      # Git Ignore Configuration
├── requirements.txt                # Python Dependencies
├── build.sh                        # Render Build Script
├── render.yaml                     # Render Infrastructure Blueprint
├── vercel.json                     # Vercel Frontend Routing
└── README.md                       # Comprehensive Guide
```

---

## 5. Prerequisites

- **Python**: Version 3.10, 3.11, 3.12, or 3.13.
- **Git**: Installed for version control.
- **Web Browser**: Chrome, Edge, Safari, or Firefox with JavaScript enabled.
- **PostgreSQL** *(Optional for local dev, mandatory for Render)*: Version 14+.

---

## 6. Local Installation & Setup

### Step 1: Clone or Navigate to the Project

```bash
cd JhazTaxi
```

### Step 2: Create and Activate Virtual Environment

**On Windows (PowerShell):**
```powershell
python -m venv venv
.\venv\Scripts\Activate.ps1
```

**On macOS/Linux:**
```bash
python3 -m venv venv
source venv/bin/activate
```

### Step 3: Install Dependencies

```bash
pip install -r requirements.txt
```

---

## 7. Database Setup & Seeding

The application is pre-configured with **`dj-database-url`**:
- If `DATABASE_URL` is omitted in development, it defaults to a local **SQLite** database (`db.sqlite3`) for instant zero-configuration testing.
- If `DATABASE_URL` is supplied (e.g. `postgres://user:password@localhost:5432/jhaztaxi`), it automatically binds to **PostgreSQL**.

### Apply Database Migrations:

```bash
cd backend
python manage.py migrate
```

### Seed Development Data:

Populate verified drivers (**Kumar, Suresh, Arun, Mohammed**), vehicles (**Mini, Sedan, SUV, Premium**), dynamic pricing rules, demo customers, and demo admin:

```bash
python manage.py seed_data
```

This generates:
- **Admin Account**: `admin@jhaztaxi.com` / `admin123`
- **Demo Customer**: `customer@jhaztaxi.com` / `customer123`
- **4 Sample Vehicles**: Mini, Sedan, SUV, Premium
- **4 Sample Drivers**: Kumar (4.9★), Suresh (4.8★), Arun (4.95★), Mohammed (5.0★)
- **Sample Bookings**: Across `trip_completed`, `driver_assigned`, and `pending`

---

## 8. Running the Application Locally

### Run Backend Server:

From the `backend/` directory:

```bash
python manage.py runserver 127.0.0.1:8000
```

Verify backend health at: [http://127.0.0.1:8000/api/health/](http://127.0.0.1:8000/api/health/)

### Run Frontend:

Open the `frontend/` directory using any local web server:

**Option A: Python Simple HTTP Server (Recommended)**
Open a separate terminal window:
```bash
cd frontend
python -m http.server 5500
```
Open your browser at: [http://127.0.0.1:5500](http://127.0.0.1:5500)

**Option B: VS Code Live Server**
Right-click on `frontend/index.html` and select **"Open with Live Server"**.

---

## 9. End-to-End Booking Workflow Test

1. Open [http://127.0.0.1:5500/booking.html](http://127.0.0.1:5500/booking.html).
2. Enter a **Pickup Location** (e.g. `MG Road Metro Station`) or click the crosshair icon to use your current GPS location.
3. Enter a **Drop Destination** (e.g. `Kempegowda International Airport`).
4. The **Leaflet Map** draws the driving route line, calculating exact road distance (e.g. `34.5 KM`) and travel time.
5. Select a vehicle category (e.g. `Sedan`).
6. Observe the **Fare Breakdown** update live via the backend API:
   - Base Fare: ₹100.00
   - Distance Fare: ₹517.50 (34.5 KM × ₹15/KM)
   - Total Fare: ₹617.50
7. Click **"Confirm Booking Now"**. (If not logged in, you will be prompted to sign in with `customer@jhaztaxi.com` / `customer123`).
8. You will be redirected to the **Booking Details** page (`/user/booking-details.html?id=JHZ-00000X`).
9. Open another tab at [http://127.0.0.1:5500/admin/bookings.html](http://127.0.0.1:5500/admin/bookings.html) and sign in as `admin@jhaztaxi.com` / `admin123`.
10. Click **"Assign"** next to the pending ride and choose an available driver (e.g. `Kumar`).
11. Refresh the customer tab: the driver's name, phone, photo, rating, and vehicle plate number appear immediately!
12. Transition status from `Driver Arriving` &rarr; `Trip Started` &rarr; `Trip Completed`.
13. On the customer page, rate driver Kumar with 5 stars and submit feedback!

---

## 10. Configuring PostgreSQL (Local & Cloud)

### For Local PostgreSQL:

1. Install PostgreSQL and create a database:
   ```sql
   CREATE DATABASE jhaztaxi;
   CREATE USER jhaztaxi_user WITH PASSWORD 'password123';
   GRANT ALL PRIVILEGES ON DATABASE jhaztaxi TO jhaztaxi_user;
   ```
2. Create a `.env` file in the root directory:
   ```env
   DATABASE_URL=postgres://jhaztaxi_user:password123@localhost:5432/jhaztaxi
   DEBUG=True
   ```
3. Run migrations:
   ```bash
   python backend/manage.py migrate
   python backend/manage.py seed_data
   ```

### Verifying PostgreSQL Persistence:

Connect using `psql` to verify tables and rows are being saved:
```sql
psql -U jhaztaxi_user -d jhaztaxi
SELECT booking_id, pickup_address, drop_address, total_fare, status FROM bookings_booking;
```

---

## 11. GitHub Repository Setup

```bash
git init
git add .
git commit -m "Initial commit: JhazTaxi full-stack production application"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/JhazTaxi.git
git push -u origin main
```

*(The included `.gitignore` protects secrets, `.env`, virtual environment, and local databases).*

---

## 12. Deployment Guide

### A. Deploy Backend to Render

1. Log in to [Render.com](https://render.com).
2. Click **New +** &rarr; **PostgreSQL**.
   - Name: `jhaztaxi-db`
   - Database: `jhaztaxi`
   - User: `jhaztaxi_user`
   - Region: Choose closest (e.g., Singapore/Frankfurt/Oregon)
   - Click **Create Database**. Copy the **Internal Database URL**.
3. Click **New +** &rarr; **Web Service**.
   - Connect your GitHub repository `JhazTaxi`.
   - Environment: `Python 3`
   - Region: Same as database
   - Root Directory: Leave blank (repository root)
   - Build Command: `./build.sh`
   - Start Command: `gunicorn --chdir backend config.wsgi:application`
4. Add **Environment Variables** in Render Dashboard:
   - `DEBUG`: `False`
   - `SECRET_KEY`: *(Generate a secure 50-character string)*
   - `DATABASE_URL`: *(Paste the Internal Database URL from step 2)*
   - `ALLOWED_HOSTS`: `.onrender.com`
   - `FRONTEND_URL`: `https://YOUR-APP.vercel.app`
5. Click **Deploy Web Service**. Render executes `build.sh` (installs packages, runs `collectstatic`, applies migrations, and seeds sample data).

### B. Deploy Frontend to Vercel

1. Log in to [Vercel.com](https://vercel.com).
2. Click **Add New** &rarr; **Project** and import your `JhazTaxi` GitHub repository.
3. In **Project Settings**:
   - Framework Preset: **Other**
   - Root Directory: Click Edit and select `frontend`
4. Click **Deploy**. Vercel will deploy the static frontend instantly to `https://jhaztaxi.vercel.app`.

### C. Connect Vercel Frontend to Render Backend

1. In `frontend/js/config.js`, update `API_BASE_URL`:
   ```javascript
   API_BASE_URL: (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
       ? 'http://127.0.0.1:8000/api'
       : 'https://YOUR-RENDER-BACKEND.onrender.com/api',
   ```
2. Commit and push to GitHub:
   ```bash
   git add frontend/js/config.js
   git commit -m "Configure production backend URL for Render"
   git push origin main
   ```
3. Vercel automatically rebuilds and redeploys within seconds.

---

## 13. REST API Reference

| Endpoint | Method | Description | Auth Required |
|---|---|---|---|
| `/api/health/` | `GET` | Health check & database status | No |
| `/api/auth/register/` | `POST` | Customer registration | No |
| `/api/auth/login/` | `POST` | Customer login (Token generation) | No |
| `/api/auth/admin-login/` | `POST` | Admin authentication | Admin |
| `/api/auth/profile/` | `GET`, `PUT` | View/edit customer profile | Yes |
| `/api/vehicles/` | `GET`, `POST` | List or create vehicles | POST: Admin |
| `/api/fare/` | `GET` | Retrieve dynamic fare rules | No |
| `/api/fare/estimate/` | `POST` | Calculate road distance & fare | No |
| `/api/fare/<type>/` | `PUT` | Update fare rules for vehicle type | Admin |
| `/api/drivers/` | `GET`, `POST` | List or register drivers | POST: Admin |
| `/api/drivers/available/` | `GET` | List available drivers for dispatch | Admin |
| `/api/drivers/locations/` | `GET` | Coordinates for Leaflet Admin Map | Admin |
| `/api/drivers/<id>/status/` | `PATCH` | Toggle driver status (`available`/`offline`) | Admin |
| `/api/bookings/` | `GET`, `POST` | List bookings or place ride order | Yes |
| `/api/bookings/<id>/` | `GET`, `DELETE` | View booking details or remove | Yes |
| `/api/bookings/<id>/assign-driver/` | `POST` | Assign driver to booking | Admin |
| `/api/bookings/<id>/status/` | `POST` | Transition trip lifecycle | Admin |
| `/api/bookings/<id>/cancel/` | `POST` | Cancel booking | Customer/Admin |
| `/api/payments/` | `GET`, `POST` | View or record payments | Yes |
| `/api/reviews/` | `GET`, `POST` | List or submit driver 1-5★ review | Yes |
| `/api/notifications/` | `GET` | List customer alerts | Yes |
| `/api/admin/dashboard-stats/` | `GET` | 10 KPI metrics & chart data | Admin |
| `/api/admin/reports/` | `GET` | Revenue & driver performance analytics | Admin |

---

## 14. Search Engine Optimization (SEO) & Security Indexing

JhazTaxi is engineered from the ground up for maximum search visibility on Google/Bing while rigorously securing internal operations and portals:

1. **Directives & Crawl Control**:
   - `frontend/robots.txt`: Explicitly permits search crawlers on all public marketing and booking pages (`/index.html`, `/booking.html`, `/vehicles.html`, `/driver/register.html`, etc.) while completely disallowing `/admin/`, `/user/`, `/driver/dashboard.html`, and `/api/`.
   - `frontend/sitemap.xml`: Complete valid XML sitemap with canonical URLs, change frequencies, and priorities for all indexable endpoints.
   - PWA & Favicon support: `site.webmanifest`, SVG favicons, and root `favicon.ico`.

2. **On-Page SEO & Social Metadata**:
   - Unique, highly-relevant `<title>` and `<meta name="description">` tags on every public page.
   - `<link rel="canonical">` on all pages to prevent duplicate content penalties.
   - Open Graph (`og:title`, `og:description`, `og:image`, `og:type`) & Twitter Cards (`summary_large_image`) for rich social shares.
   - Proper single `<h1>` semantic heading hierarchy on all landing, booking, fleet, and driver registration pages.
   - Image `alt` tags on all fleet and customer testimonial media.

3. **Schema.org JSON-LD Structured Data**:
   - `index.html`: `TaxiService` schema (address, telephone, price range, geo coordinates, opening hours) + `FAQPage` rich snippets.
   - `booking.html`: `WebPage` + `BreadcrumbList` schema.
   - `vehicles.html`: `ItemList` with `Product` and `Offer` schema for fare tiers.
   - `about.html`: `AboutPage` schema.
   - `contact.html`: `ContactPage` with `ContactPoint` customer service phone and multi-lingual support schema.

4. **Security & Search Isolation**:
   - **Auth Gateways** (`login.html`, `register.html`, `driver/login.html`): Marked with `<meta name="robots" content="noindex, follow">` to protect forms from ranking dilution while letting spiders discover links.
   - **Internal Portals** (`admin/*.html`, `user/*.html`, `driver/dashboard.html`): Strictly protected with `<meta name="robots" content="noindex, nofollow">` to prevent any customer trip or administration data from ever leaking into search results.

---

## 15. Troubleshooting & FAQ

- **Issue: CORS error in browser console**  
  *Solution*: Ensure `django-cors-headers` is listed in `settings.py` `INSTALLED_APPS` and `MIDDLEWARE`. Check that your frontend URL is included in `FRONTEND_URL` in `.env`.
- **Issue: Map tiles not loading**  
  *Solution*: Verify internet connectivity. OpenStreetMap tiles are served over HTTPS directly from `https://{s}.tile.openstreetmap.org/`.
- **Issue: "Invalid email/username or password"**  
  *Solution*: Run `python backend/manage.py seed_data` to ensure sample users (`admin@jhaztaxi.com` / `admin123` and `customer@jhaztaxi.com` / `customer123`) are populated.

---

## 15. License

MIT License. Developed for **JhazTaxi**. Production-ready, clean, maintainable, and built for scalable urban mobility.
