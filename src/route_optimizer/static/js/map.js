const map = L.map('map').setView([30.11, -81.63], 12);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap contributors'
}).addTo(map);

// Load client markers
fetch("/clients")
    .then(response => response.json())
    .then(clients => {
        clients.forEach(client => {
            const latlng = [client.lat, client.lon];
            L.marker(latlng)
                .addTo(map)
                .bindPopup(`<b>${client.name}</b><br>${client.address || ""}`);
        });
    })
    .catch(error => {
        console.error("Error loading clients:", error);
    });

// Button click to trigger route drawing
document.getElementById("optimize-btn").addEventListener("click", () => {
    fetch("/routes/geo")
        .then(res => res.json())
        .then(geometry => {
            const routeLine = L.polyline(geometry, {
                color: 'green',
                weight: 5,
                opacity: 0.9
            }).addTo(map);
            map.fitBounds(routeLine.getBounds());
        })
        .catch(error => {
            console.error("Error loading route:", error);
        });
});

