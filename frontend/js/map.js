/**
 * JhazTaxi - Leaflet & OpenStreetMap Routing Service
 * Provides full road routing, geocoding search, geolocation, and distance calculation.
 */

class JhazMapService {
    constructor(mapElementId, options = {}) {
        this.elementId = mapElementId;
        this.map = null;
        this.pickupMarker = null;
        this.dropMarker = null;
        this.routeLayer = null;
        this.driverMarkers = [];
        
        this.pickupCoords = null; // [lat, lng]
        this.dropCoords = null;   // [lat, lng]
        this.pickupAddress = '';
        this.dropAddress = '';

        this.onRouteCalculated = options.onRouteCalculated || null;
        this.init();
    }

    init() {
        const el = document.getElementById(this.elementId);
        if (!el || typeof L === 'undefined') return;

        // Initialize Leaflet Map
        this.map = L.map(this.elementId, {
            zoomControl: true,
            scrollWheelZoom: true
        }).setView(CONFIG.MAP_DEFAULT_CENTER, CONFIG.MAP_DEFAULT_ZOOM);

        // 100% Free OpenStreetMap France Tile Layer (Zero API key needed, never blocked)
        const tileUrl = (typeof CONFIG !== 'undefined' && CONFIG.MAP_TILE_URL) 
            ? CONFIG.MAP_TILE_URL 
            : 'https://{s}.tile.openstreetmap.fr/osmfr/{z}/{x}/{y}.png';
        const subdomains = (typeof CONFIG !== 'undefined' && CONFIG.MAP_TILE_SUBDOMAINS)
            ? CONFIG.MAP_TILE_SUBDOMAINS
            : ['a', 'b', 'c'];
        const attribution = (typeof CONFIG !== 'undefined' && CONFIG.MAP_ATTRIBUTION)
            ? CONFIG.MAP_ATTRIBUTION
            : '&copy; OpenStreetMap contributors, OSM France';

        const mainTileLayer = L.tileLayer(tileUrl, {
            subdomains: subdomains,
            maxZoom: 20,
            attribution: attribution
        }).addTo(this.map);

        // Click on map to place markers if not set
        this.map.on('click', (e) => this.handleMapClick(e));
    }

    // Custom Icon Generator
    createPinIcon(type = 'pickup') {
        const isPickup = type === 'pickup';
        const color = isPickup ? '#10B981' : '#EF4444';
        const iconHtml = `
            <div style="
                background: ${color};
                width: 34px;
                height: 34px;
                border-radius: 50% 50% 50% 0;
                transform: rotate(-45deg);
                display: flex;
                align-items: center;
                justify-content: center;
                border: 3px solid #FFFFFF;
                box-shadow: 0 4px 10px rgba(0,0,0,0.3);
            ">
                <i class="bi ${isPickup ? 'bi-geo-alt-fill' : 'bi-flag-fill'}" style="
                    transform: rotate(45deg);
                    color: #FFFFFF;
                    font-size: 15px;
                "></i>
            </div>
        `;

        return L.divIcon({
            className: 'custom-map-pin',
            html: iconHtml,
            iconSize: [34, 34],
            iconAnchor: [17, 34],
            popupAnchor: [0, -34]
        });
    }

    // Set Pickup Location
    setPickup(lat, lng, address = '') {
        this.pickupCoords = [lat, lng];
        this.pickupAddress = address;

        if (this.pickupMarker) {
            this.pickupMarker.setLatLng([lat, lng]);
        } else {
            this.pickupMarker = L.marker([lat, lng], {
                icon: this.createPinIcon('pickup'),
                draggable: true
            }).addTo(this.map);

            this.pickupMarker.on('dragend', async (e) => {
                const pos = e.target.getLatLng();
                this.pickupCoords = [pos.lat, pos.lng];
                const resolvedAddr = await this.reverseGeocode(pos.lat, pos.lng);
                this.pickupAddress = resolvedAddr;
                const input = document.getElementById('pickup-address');
                if (input) input.value = resolvedAddr;
                this.calculateRoute();
            });
        }

        this.pickupMarker.bindPopup(`<strong>Pickup:</strong><br>${address || 'Selected Location'}`).openPopup();
        this.checkAndCalculateRoute();
    }

    // Set Drop Location
    setDrop(lat, lng, address = '') {
        this.dropCoords = [lat, lng];
        this.dropAddress = address;

        if (this.dropMarker) {
            this.dropMarker.setLatLng([lat, lng]);
        } else {
            this.dropMarker = L.marker([lat, lng], {
                icon: this.createPinIcon('drop'),
                draggable: true
            }).addTo(this.map);

            this.dropMarker.on('dragend', async (e) => {
                const pos = e.target.getLatLng();
                this.dropCoords = [pos.lat, pos.lng];
                const resolvedAddr = await this.reverseGeocode(pos.lat, pos.lng);
                this.dropAddress = resolvedAddr;
                const input = document.getElementById('drop-address');
                if (input) input.value = resolvedAddr;
                this.calculateRoute();
            });
        }

        this.dropMarker.bindPopup(`<strong>Destination:</strong><br>${address || 'Selected Location'}`).openPopup();
        this.checkAndCalculateRoute();
    }

    checkAndCalculateRoute() {
        if (this.pickupCoords && this.dropCoords) {
            this.calculateRoute();
        } else if (this.pickupCoords) {
            this.map.setView(this.pickupCoords, 14);
        } else if (this.dropCoords) {
            this.map.setView(this.dropCoords, 14);
        }
    }

    // Real road route calculation using OSRM Routing Service
    async calculateRoute() {
        if (!this.pickupCoords || !this.dropCoords) return;

        const [lat1, lng1] = this.pickupCoords;
        const [lat2, lng2] = this.dropCoords;

        const url = `${CONFIG.OSRM_ROUTING_URL}${lng1},${lat1};${lng2},${lat2}?overview=full&geometries=geojson`;

        try {
            const res = await fetch(url);
            const data = await res.json();

            if (data.routes && data.routes.length > 0) {
                const route = data.routes[0];
                const distanceKm = +(route.distance / 1000).toFixed(2);
                const durationMins = Math.max(1, Math.round(route.duration / 60));

                this.renderRoutePolyline(route.geometry.coordinates);

                if (this.onRouteCalculated) {
                    this.onRouteCalculated({
                        distanceKm,
                        durationMins,
                        pickupCoords: this.pickupCoords,
                        dropCoords: this.dropCoords,
                        pickupAddress: this.pickupAddress,
                        dropAddress: this.dropAddress
                    });
                }
            } else {
                this.calculateFallbackDistance();
            }
        } catch (error) {
            console.warn('OSRM routing request failed or rate-limited; using high-accuracy road approximation:', error);
            this.calculateFallbackDistance();
        }
    }

    // High accuracy road distance fallback (Haversine * 1.35 road winding factor)
    calculateFallbackDistance() {
        const [lat1, lng1] = this.pickupCoords;
        const [lat2, lng2] = this.dropCoords;

        const R = 6371; // Earth radius in km
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLng = (lng2 - lng1) * Math.PI / 180;
        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLng / 2) * Math.sin(dLng / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        const straightLineKm = R * c;
        const roadDistanceKm = +(straightLineKm * 1.35).toFixed(2);
        const durationMins = Math.max(5, Math.round((roadDistanceKm / 30) * 60)); // Avg 30 km/h city speed

        // Draw direct line
        const coords = [
            [lng1, lat1],
            [lng2, lat2]
        ];
        this.renderRoutePolyline(coords);

        if (this.onRouteCalculated) {
            this.onRouteCalculated({
                distanceKm: roadDistanceKm,
                durationMins,
                pickupCoords: this.pickupCoords,
                dropCoords: this.dropCoords,
                pickupAddress: this.pickupAddress,
                dropAddress: this.dropAddress
            });
        }
    }

    renderRoutePolyline(geojsonCoordinates) {
        if (this.routeLayer) {
            this.map.removeLayer(this.routeLayer);
        }

        // Convert [lng, lat] to [lat, lng] for Leaflet
        const latLngs = geojsonCoordinates.map(coord => [coord[1], coord[0]]);

        this.routeLayer = L.polyline(latLngs, {
            color: '#121212',
            weight: 5,
            opacity: 0.9,
            lineJoin: 'round',
            dashArray: '1, 8'
        }).addTo(this.map);

        // Add a yellow glow layer underneath
        const glowLayer = L.polyline(latLngs, {
            color: '#FFC107',
            weight: 8,
            opacity: 0.8
        }).addTo(this.map);

        // Group into a layer group
        this.routeLayer = L.layerGroup([glowLayer, this.routeLayer]).addTo(this.map);

        // Zoom map to fit both markers
        const bounds = L.latLngBounds([this.pickupCoords, this.dropCoords]);
        this.map.fitBounds(bounds, { padding: [50, 50] });
    }

    // Geocode Search: Tirunelveli-first presets + Photon API with Tirunelveli location bias + Nominatim fallback
    async searchLocation(query) {
        if (!query || query.trim().length < 2) return [];

        const qLower = query.toLowerCase().trim();
        const results = [];

        // Instant Local Presets for Tirunelveli & South India
        const TIRUNELVELI_PRESETS = [
            { displayName: 'Tirunelveli Junction Railway Station (TEN), Tamil Nadu', lat: 8.7289, lng: 77.7088 },
            { displayName: 'New Bus Stand (Vaeinthankulam), Tirunelveli, Tamil Nadu', lat: 8.7061, lng: 77.7286 },
            { displayName: 'Palayamkottai, Tirunelveli, Tamil Nadu', lat: 8.7176, lng: 77.7479 },
            { displayName: 'Vannarpettai, Tirunelveli, Tamil Nadu', lat: 8.7275, lng: 77.7214 },
            { displayName: 'Thatchanallur, Tirunelveli, Tamil Nadu', lat: 8.7511, lng: 77.7161 },
            { displayName: 'Pettai, Tirunelveli, Tamil Nadu', lat: 8.7196, lng: 77.6713 },
            { displayName: 'Melapalayam, Tirunelveli, Tamil Nadu', lat: 8.7012, lng: 77.7314 },
            { displayName: 'High Ground, Palayamkottai, Tirunelveli', lat: 8.7118, lng: 77.7612 },
            { displayName: 'Gangaikondan SIPCOT, Tirunelveli', lat: 8.8542, lng: 77.7812 },
            { displayName: 'Madurai Airport (IXM), Tamil Nadu', lat: 9.8345, lng: 78.0934 },
            { displayName: 'Madurai Junction Railway Station, Tamil Nadu', lat: 9.9195, lng: 78.1193 },
            { displayName: 'Tuticorin (Thoothukudi) Airport (TCR), Tamil Nadu', lat: 8.7243, lng: 78.0261 },
            { displayName: 'Courtallam Main Falls, Tenkasi, Tamil Nadu', lat: 8.9304, lng: 77.2753 },
            { displayName: 'Tenkasi Junction, Tamil Nadu', lat: 8.9591, lng: 77.3087 },
            { displayName: 'Kanyakumari, Tamil Nadu', lat: 8.0883, lng: 77.5385 },
            { displayName: 'Trivandrum International Airport (TRV), Kerala', lat: 8.4821, lng: 76.9200 },
            { displayName: 'Chennai Central Railway Station, Tamil Nadu', lat: 13.0827, lng: 80.2707 },
            { displayName: 'Coimbatore Junction, Tamil Nadu', lat: 11.0016, lng: 76.9628 },
            { displayName: 'Bangalore Majestic / Kempegowda, Karnataka', lat: 12.9767, lng: 77.5713 }
        ];

        // Check local matches first
        TIRUNELVELI_PRESETS.forEach(item => {
            const dLower = item.displayName.toLowerCase();
            if (dLower.includes(qLower) || 
                (qLower.includes('nellai') && dLower.includes('tirunelveli')) ||
                (qLower.includes('junction') && dLower.includes('junction')) ||
                (qLower.includes('bus stand') && dLower.includes('bus stand'))) {
                results.push(item);
            }
        });

        // 1. Try Photon Geocoder with Tirunelveli Lat/Lng bias
        try {
            const photonUrl = `${(typeof CONFIG !== 'undefined' && CONFIG.PHOTON_SEARCH_URL) || 'https://photon.komoot.io/api/'}?q=${encodeURIComponent(query)}&lat=8.7139&lon=77.7567&limit=6`;
            const res = await fetch(photonUrl);
            if (res.ok) {
                const data = await res.json();
                if (data.features && data.features.length > 0) {
                    data.features.forEach(f => {
                        const p = f.properties || {};
                        const parts = [p.name, p.street, p.district || p.city, p.state, p.country].filter(Boolean);
                        const label = parts.length > 1 ? parts.join(', ') : (p.name || 'Location');
                        // Avoid duplicates
                        if (!results.some(r => r.displayName.toLowerCase() === label.toLowerCase())) {
                            results.push({
                                displayName: label,
                                lat: f.geometry.coordinates[1],
                                lng: f.geometry.coordinates[0]
                            });
                        }
                    });
                }
            }
        } catch (e) {
            console.warn('Photon geocoding error, falling back:', e);
        }

        if (results.length > 0) return results.slice(0, 6);

        // 2. Fallback to Nominatim OpenStreetMap
        try {
            const url = `${(typeof CONFIG !== 'undefined' && CONFIG.NOMINATIM_SEARCH_URL) || 'https://nominatim.openstreetmap.org/search'}?format=json&q=${encodeURIComponent(query)}&limit=5&addressdetails=1`;
            const res = await fetch(url, {
                headers: { 'Accept-Language': 'en' }
            });
            if (res.ok) {
                const data = await res.json();
                return data.map(item => ({
                    displayName: item.display_name,
                    lat: parseFloat(item.lat),
                    lng: parseFloat(item.lon)
                }));
            }
        } catch (e) {
            return [];
        }
        return [];
    }

    // Reverse Geocode: Uses Photon reverse as primary, Nominatim as fallback
    async reverseGeocode(lat, lng) {
        // 1. Try Photon Reverse
        try {
            const pUrl = `${(typeof CONFIG !== 'undefined' && CONFIG.PHOTON_REVERSE_URL) || 'https://photon.komoot.io/reverse'}?lat=${lat}&lon=${lng}`;
            const res = await fetch(pUrl);
            if (res.ok) {
                const data = await res.json();
                if (data.features && data.features.length > 0) {
                    const p = data.features[0].properties || {};
                    const parts = [p.name, p.street, p.district || p.city, p.state].filter(Boolean);
                    if (parts.length > 0) return parts.join(', ');
                }
            }
        } catch (e) {
            // Fall through
        }

        // 2. Try Nominatim Reverse
        try {
            const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`;
            const res = await fetch(url);
            if (res.ok) {
                const data = await res.json();
                if (data.display_name) return data.display_name;
            }
        } catch (e) {
            // Fall through
        }

        return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    }

    // Use HTML5 Browser Geolocation
    useCurrentLocation(type = 'pickup') {
        return new Promise((resolve, reject) => {
            if (!navigator.geolocation) {
                showToast('Geolocation is not supported by your browser.', 'error');
                reject('Not supported');
                return;
            }

            navigator.geolocation.getCurrentPosition(
                async (position) => {
                    const lat = position.coords.latitude;
                    const lng = position.coords.longitude;
                    const address = await this.reverseGeocode(lat, lng);

                    if (type === 'pickup') {
                        this.setPickup(lat, lng, address);
                    } else {
                        this.setDrop(lat, lng, address);
                    }
                    resolve({ lat, lng, address });
                },
                (error) => {
                    showToast('Unable to retrieve location. Please check browser permissions.', 'warning');
                    reject(error);
                },
                { enableHighAccuracy: true, timeout: 10000 }
            );
        });
    }

    handleMapClick(e) {
        const { lat, lng } = e.latlng;
        if (!this.pickupCoords) {
            this.reverseGeocode(lat, lng).then(addr => {
                this.setPickup(lat, lng, addr);
                const input = document.getElementById('pickup-address');
                if (input) input.value = addr;
            });
        } else if (!this.dropCoords) {
            this.reverseGeocode(lat, lng).then(addr => {
                this.setDrop(lat, lng, addr);
                const input = document.getElementById('drop-address');
                if (input) input.value = addr;
            });
        }
    }
}
