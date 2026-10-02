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

        // OpenStreetMap Tile Layer
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '© OpenStreetMap contributors | JhazTaxi'
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

    // Geocode Search via Nominatim OpenStreetMap
    async searchLocation(query) {
        if (!query || query.length < 3) return [];
        try {
            const url = `${CONFIG.NOMINATIM_SEARCH_URL}?format=json&q=${encodeURIComponent(query)}&limit=5&addressdetails=1`;
            const res = await fetch(url, {
                headers: { 'Accept-Language': 'en' }
            });
            const data = await res.json();
            return data.map(item => ({
                displayName: item.display_name,
                lat: parseFloat(item.lat),
                lng: parseFloat(item.lon)
            }));
        } catch (e) {
            return [];
        }
    }

    // Reverse Geocode
    async reverseGeocode(lat, lng) {
        try {
            const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`;
            const res = await fetch(url);
            const data = await res.json();
            return data.display_name || `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
        } catch (e) {
            return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
        }
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
