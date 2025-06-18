// const map = L.map('map').setView([30.11, -81.63], 12);

// L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
//     maxZoom: 19,
//     attribution: '© OpenStreetMap contributors'
// }).addTo(map);

// // Load client markers
// fetch("/data")
//     .then(response => response.json())
//     .then(clients => {
//         clients.forEach(client => {
//             const latlng = [client.lat, client.lon];
//             L.marker(latlng)
//                 .addTo(map)
//                 .bindPopup(`<b>${client.name}</b><br>${client.address || ""}`);
//         });
//     })
//     .catch(error => {
//         console.error("Error loading clients:", error);
//     });

// const optimizeControl = L.control({ position: 'topleft' });

// optimizeControl.onAdd = function (map) {
//     const div = L.DomUtil.create('div', 'leaflet-control optimize-control');
//     const button = L.DomUtil.create('a', '', div);

//     button.innerText = 'Optimize';
//     button.href = '#';
//     button.style.display = 'inline-block';
//     button.style.cursor = 'pointer';
//     button.style.padding = '6px 12px';
//     button.style.background = '#4CAF50';
//     button.style.color = 'white';
//     button.style.fontWeight = 'bold';
//     button.style.textAlign = 'center';
//     button.style.textDecoration = 'none';
//     button.style.borderRadius = '4px';
//     button.style.whiteSpace = 'nowrap';

//     L.DomEvent.disableClickPropagation(div);

//     button.addEventListener('click', () => {
//         fetch("/routes/geo")
//             .then(res => res.json())
//             .then(geometry => {
//                 const routeLine = L.polyline(geometry, {
//                     color: 'green',
//                     weight: 5,
//                     opacity: 0.9
//                 }).addTo(map);
//                 map.fitBounds(routeLine.getBounds());
//             })
//             .catch(error => {
//                 console.error("Error loading route:", error);
//             });
//     });

//     return div;
// };

// optimizeControl.addTo(map);

const map = L.map('map').setView([30.11, -81.63], 12);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap contributors'
}).addTo(map);

// Color palette for groups
const groupColors = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
    '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9',
    '#F8C471', '#82E0AA', '#F1948A', '#85C1E9', '#D7BDE2'
];

// Store group data globally
let currentGroups = [];

// Load individual client markers (default view)
function loadClientMarkers() {
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
}

// Load and visualize groups
function loadGroupVisualization() {
    fetch("/groups")
        .then(response => response.json())
        .then(data => {
            currentGroups = data.groups;
            visualizeGroups(currentGroups);
        })
        .catch(error => {
            console.error("Error loading groups:", error);
        });
}

// Visualize groups on map
function visualizeGroups(groups) {
    // Clear existing markers
    map.eachLayer(layer => {
        if (layer instanceof L.Marker || layer instanceof L.Circle) {
            map.removeLayer(layer);
        }
    });

    groups.forEach((group, index) => {
        const color = groupColors[index % groupColors.length];
        
        // Add circle around group center
        const groupCircle = L.circle(
            [group.center_point.lat, group.center_point.lon], 
            {
                color: color,
                fillColor: color,
                fillOpacity: 0.1,
                radius: 150  // Adjust based on your needs
            }
        ).addTo(map);

        // Add popup to group circle
        groupCircle.bindPopup(`
            <b>Group ${index + 1}</b><br>
            Road: ${group.road_name || 'Unknown'}<br>
            Clients: ${group.client_count}<br>
            Walking Distance: ${Math.round(group.walking_distance)}m
        `);

        // Add markers for each client in the group
        group.clients.forEach(client => {
            const marker = L.marker([client.lat, client.lon], {
                icon: L.divIcon({
                    className: 'group-marker',
                    html: `<div style="
                        background-color: ${color};
                        border: 2px solid white;
                        border-radius: 50%;
                        width: 20px;
                        height: 20px;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        color: white;
                        font-weight: bold;
                        font-size: 12px;
                        box-shadow: 0 2px 4px rgba(0,0,0,0.3);
                    ">${index + 1}</div>`,
                    iconSize: [20, 20],
                    iconAnchor: [10, 10]
                })
            }).addTo(map);

            marker.bindPopup(`
                <b>${client.name}</b><br>
                ${client.address}<br>
                <em>Group ${index + 1}: ${group.road_name || 'Unknown Road'}</em>
            `);
        });
    });

    // Fit map to show all groups
    if (groups.length > 0) {
        const allCoords = groups.flatMap(group => 
            group.clients.map(client => [client.lat, client.lon])
        );
        const bounds = L.latLngBounds(allCoords);
        map.fitBounds(bounds, { padding: [20, 20] });
    }
}

// Control buttons
const controlContainer = L.control({ position: 'topright' });

controlContainer.onAdd = function (map) {
    const div = L.DomUtil.create('div', 'leaflet-control custom-controls');
    
    div.innerHTML = `
        <div style="background: white; padding: 10px; border-radius: 5px; box-shadow: 0 2px 4px rgba(0,0,0,0.3);">
            <button id="show-clients" style="margin: 2px; padding: 8px 12px; background: #4CAF50; color: white; border: none; border-radius: 3px; cursor: pointer;">
                Show Clients
            </button>
            <button id="show-groups" style="margin: 2px; padding: 8px 12px; background: #2196F3; color: white; border: none; border-radius: 3px; cursor: pointer;">
                Show Groups
            </button>
            <button id="optimize-route" style="margin: 2px; padding: 8px 12px; background: #FF9800; color: white; border: none; border-radius: 3px; cursor: pointer;">
                Optimize Route
            </button>
        </div>
    `;

    L.DomEvent.disableClickPropagation(div);
    return div;
};

controlContainer.addTo(map);

// Button event listeners
document.addEventListener('click', function(e) {
    if (e.target.id === 'show-clients') {
        // Clear map and show individual clients
        map.eachLayer(layer => {
            if (layer instanceof L.Marker || layer instanceof L.Circle || layer instanceof L.Polyline) {
                map.removeLayer(layer);
            }
        });
        loadClientMarkers();
    }
    
    if (e.target.id === 'show-groups') {
        loadGroupVisualization();
    }
    
    if (e.target.id === 'optimize-route') {
        fetch("/routes/geo")
            .then(res => res.json())
            .then(geometry => {
                // Clear existing route lines
                map.eachLayer(layer => {
                    if (layer instanceof L.Polyline) {
                        map.removeLayer(layer);
                    }
                });
                
                if (geometry && geometry.length > 0) {
                    const routeLine = L.polyline(geometry, {
                        color: 'green',
                        weight: 5,
                        opacity: 0.9
                    }).addTo(map);
                    map.fitBounds(routeLine.getBounds());
                }
            })
            .catch(error => {
                console.error("Error loading route:", error);
            });
    }
});

// Load clients by default
loadClientMarkers();
