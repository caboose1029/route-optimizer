const map = L.map('map').setView([30.11, -81.63], 12);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap contributors'
}).addTo(map);

// Load client markers
fetch("/data")
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

const optimizeControl = L.control({ position: 'topleft' });

optimizeControl.onAdd = function (map) {
    const div = L.DomUtil.create('div', 'leaflet-control optimize-control');
    const button = L.DomUtil.create('a', '', div);

    button.innerText = 'Optimize';
    button.href = '#';
    button.style.display = 'inline-block';
    button.style.cursor = 'pointer';
    button.style.padding = '6px 12px';
    button.style.background = '#4CAF50';
    button.style.color = 'white';
    button.style.fontWeight = 'bold';
    button.style.textAlign = 'center';
    button.style.textDecoration = 'none';
    button.style.borderRadius = '4px';
    button.style.whiteSpace = 'nowrap';

    L.DomEvent.disableClickPropagation(div);

    button.addEventListener('click', () => {
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

    return div;
};

optimizeControl.addTo(map);

