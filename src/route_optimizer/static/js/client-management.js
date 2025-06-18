// Enhanced Client Management JavaScript with Edit Functionality
let clients = [];
let selectedClient = null;
let autocomplete = null;
let currentGeocodedData = null;
let isEditMode = false;
let editingClientId = null;

// Initialize when DOM is loaded
document.addEventListener("DOMContentLoaded", function() {
    initializeClientManagement();
});

function initializeClientManagement() {
    setupEventListeners();
    loadClients();
    
    // Initialize Google Places Autocomplete when Google Maps API is loaded
    if (typeof google !== 'undefined' && google.maps) {
        initializeAutocomplete();
    } else {
        // Wait for Google Maps API to load
        window.addEventListener('load', initializeAutocomplete);
    }
}

function setupEventListeners() {
    // Add client button
    document.getElementById('add-client-btn').addEventListener('click', showAddClientForm);
    
    // Cancel button
    document.getElementById('cancel-client-btn').addEventListener('click', hideClientForm);
    
    // Form submission
    document.getElementById('client-form').addEventListener('submit', handleFormSubmit);
    
    // Form field changes for live preview
    document.getElementById('client-name').addEventListener('input', updateLivePreview);
    document.getElementById('client-type').addEventListener('change', updateLivePreview);
    document.getElementById('client-priority').addEventListener('change', updateLivePreview);
}

function initializeAutocomplete() {
    const addressInput = document.getElementById('client-address');
    
    if (!addressInput || typeof google === 'undefined') {
        console.log('Google Places API not available or address input not found');
        return;
    }
    
    // Initialize Places Autocomplete
    autocomplete = new google.maps.places.Autocomplete(addressInput, {
        types: ['address'],
        componentRestrictions: { country: 'US' }, // Adjust as needed
        fields: ['formatted_address', 'geometry', 'address_components']
    });
    
    // Listen for place selection
    autocomplete.addListener('place_changed', handlePlaceSelection);
    
    // Also listen for manual input
    addressInput.addEventListener('input', handleAddressInput);
}

function handlePlaceSelection() {
    const place = autocomplete.getPlace();
    
    if (!place.geometry) {
        showGeocodingStatus('error', 'Please select a valid address from the dropdown');
        currentGeocodedData = null;
        updateSaveButtonState();
        return;
    }
    
    // Store geocoded data
    currentGeocodedData = {
        address: place.formatted_address,
        lat: place.geometry.location.lat(),
        lon: place.geometry.location.lng()
    };
    
    showGeocodingStatus('success', `✓ Address validated: ${place.formatted_address}`);
    updateSaveButtonState();
    updateLivePreview();
}

function handleAddressInput() {
    // Reset geocoded data when user types manually (unless in edit mode with existing data)
    if (currentGeocodedData && !isEditMode) {
        currentGeocodedData = null;
        showGeocodingStatus('pending', 'Please select an address from the dropdown');
        updateSaveButtonState();
    }
}

function showGeocodingStatus(type, message) {
    const statusEl = document.getElementById('geocoding-status');
    statusEl.className = `status-indicator status-${type}`;
    statusEl.textContent = message;
    statusEl.style.display = 'block';
}

function hideGeocodingStatus() {
    const statusEl = document.getElementById('geocoding-status');
    statusEl.style.display = 'none';
}

function updateSaveButtonState() {
    const saveBtn = document.getElementById('save-client-btn');
    const nameInput = document.getElementById('client-name');
    
    const isValid = nameInput.value.trim() && currentGeocodedData;
    saveBtn.disabled = !isValid;
    
    // Update button text based on mode
    saveBtn.textContent = isEditMode ? 'Update Client' : 'Save Client';
}

function showAddClientForm() {
    isEditMode = false;
    editingClientId = null;
    
    // Reset form
    document.getElementById('client-form').reset();
    currentGeocodedData = null;
    hideGeocodingStatus();
    
    // Update UI
    document.getElementById('add-client-form').classList.add('active');
    document.querySelector('#add-client-form h4').textContent = 'Add New Client';
    document.getElementById('client-name').focus();
    
    // Clear any selected client and show form preview
    selectedClient = null;
    document.querySelectorAll('.client-card').forEach(card => {
        card.classList.remove('selected');
    });
    
    updateSaveButtonState();
    updateLivePreview();
}

function showEditClientForm(client) {
    isEditMode = true;
    editingClientId = client.id;
    
    // Pre-populate form with client data
    document.getElementById('client-name').value = client.name;
    document.getElementById('client-address').value = client.address;
    
    // Set geocoded data from existing client
    if (client.lat && client.lon) {
        currentGeocodedData = {
            address: client.address,
            lat: client.lat,
            lon: client.lon
        };
        showGeocodingStatus('success', '✓ Address validated (existing client)');
    }
    
    // TODO: Set type and priority when these fields are added to ClientData model
    
    // Update UI
    document.getElementById('add-client-form').classList.add('active');
    document.querySelector('#add-client-form h4').textContent = 'Edit Client';
    document.getElementById('client-name').focus();
    
    updateSaveButtonState();
    updateLivePreview();
}

function hideClientForm() {
    document.getElementById('add-client-form').classList.remove('active');
    document.getElementById('client-form').reset();
    currentGeocodedData = null;
    isEditMode = false;
    editingClientId = null;
    hideGeocodingStatus();
    updateSaveButtonState();
    
    // Return to default or selected client view
    if (selectedClient) {
        showClientDetails(selectedClient);
    } else {
        showDefaultDetailView();
    }
}

function updateLivePreview() {
    updateLivePreviewWithMap();
}

async function handleFormSubmit(e) {
    e.preventDefault();
    
    if (!currentGeocodedData) {
        showGeocodingStatus('error', 'Please select a valid address');
        return;
    }
    
    const formData = {
        name: document.getElementById('client-name').value.trim(),
        address: currentGeocodedData.address
    };
    
    try {
        const statusText = isEditMode ? 'Updating client...' : 'Saving client...';
        showGeocodingStatus('pending', statusText);
        
        let response;
        if (isEditMode) {
            // Update existing client
            response = await fetch(`/clients/${editingClientId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(formData)
            });
        } else {
            // Create new client
            response = await fetch('/clients', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(formData)
            });
        }
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || `Failed to ${isEditMode ? 'update' : 'save'} client`);
        }
        
        const clientData = await response.json();
        
        if (isEditMode) {
            // Update existing client in list
            const clientIndex = clients.findIndex(c => c.id === editingClientId);
            if (clientIndex !== -1) {
                clients[clientIndex] = clientData;
            }
        } else {
            // Add new client to list
            clients.push(clientData);
        }
        
        // Refresh display
        renderClientList();
        
        // Hide form and show success
        hideClientForm();
        selectClient(clientData);
        
        const successText = isEditMode ? 'Client updated successfully!' : 'Client saved successfully!';
        showTemporaryMessage('success', successText);
        
    } catch (error) {
        console.error('Error saving client:', error);
        showGeocodingStatus('error', `Error: ${error.message}`);
    }
}

function showTemporaryMessage(type, message) {
    // Create temporary message element
    const messageEl = document.createElement('div');
    messageEl.className = `status-indicator status-${type}`;
    messageEl.textContent = message;
    messageEl.style.position = 'fixed';
    messageEl.style.top = '20px';
    messageEl.style.right = '20px';
    messageEl.style.zIndex = '1000';
    messageEl.style.maxWidth = '300px';
    
    document.body.appendChild(messageEl);
    
    // Remove after 3 seconds
    setTimeout(() => {
        document.body.removeChild(messageEl);
    }, 3000);
}

async function loadClients() {
    try {
        const response = await fetch('/data');
        clients = await response.json();
        renderClientList();
    } catch (error) {
        console.error('Error loading clients:', error);
    }
}

function renderClientList() {
    const listEl = document.getElementById('client-list');
    
    if (clients.length === 0) {
        listEl.innerHTML = '<p style="text-align: center; color: #666; padding: 2rem;">No clients yet. Add your first client!</p>';
        return;
    }
    
    listEl.innerHTML = clients.map(client => `
        <div class="client-card" data-client-id="${client.id}" onclick="selectClientById('${client.id}')">
            <strong>${client.name}</strong><br>
            ${client.address || ''}<br>
            <em style="color: #666;">${getClientTypeDisplay(client)}</em>
        </div>
    `).join('');
}

function getClientTypeDisplay(client) {
    // This function can be expanded based on your client data structure
    return 'Standard Service'; // Placeholder
}

function selectClientById(clientId) {
    const client = clients.find(c => c.id === clientId);
    if (client) {
        selectClient(client);
    }
}

function selectClient(client) {
    selectedClient = client;
    
    // Update visual selection
    document.querySelectorAll('.client-card').forEach(card => {
        card.classList.remove('selected');
    });
    
    const selectedCard = document.querySelector(`[data-client-id="${client.id}"]`);
    if (selectedCard) {
        selectedCard.classList.add('selected');
    }
    
    // Hide add form if visible
    document.getElementById('add-client-form').classList.remove('active');
    isEditMode = false;
    editingClientId = null;
    
    // Show client details
    showClientDetails(client);
}

function showClientDetails(client) {
    const detailEl = document.getElementById('client-detail');
    detailEl.innerHTML = `
        <div class="client-detail-content">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1rem;">
                <h2>${client.name}</h2>
                <div style="display: flex; gap: 8px;">
                    <button class="btn btn-primary" onclick="showEditClientForm(clients.find(c => c.id === '${client.id}'))" style="font-size: 12px; padding: 4px 8px;">
                        Edit
                    </button>
                    <button class="btn btn-secondary" onclick="confirmDeleteClient('${client.id}', '${client.name.replace(/'/g, "\\'")}')" style="font-size: 12px; padding: 4px 8px;">
                        Delete
                    </button>
                </div>
            </div>
            <p><strong>Address:</strong> ${client.address || 'N/A'}</p>
            <p><strong>Type:</strong> ${getClientTypeDisplay(client)}</p>
            <p><strong>Priority:</strong> N/A</p>
            <p><strong>Last Mowed:</strong> N/A days ago</p>
            <p><strong>Yard Size:</strong> N/A sq ft</p>
            <p><strong>Income/hr:</strong> $N/A</p>
            <p><strong>Coordinates:</strong> ${client.lat ? `${client.lat.toFixed(4)}, ${client.lon.toFixed(4)}` : 'N/A'}</p>
            
            ${client.lat && client.lon ? `
                <div style="margin-top: 1.5rem;">
                    <h4 style="margin-bottom: 0.5rem;">Location</h4>
                    <div id="client-mini-map" style="height: 200px; width: 100%; border: 1px solid #ddd; border-radius: 4px;"></div>
                </div>
            ` : `
                <div style="margin-top: 1.5rem;">
                    <h4 style="margin-bottom: 0.5rem;">Location</h4>
                    <div style="height: 200px; width: 100%; border: 1px solid #ddd; border-radius: 4px; display: flex; align-items: center; justify-content: center; background: #f5f5f5; color: #666;">
                        No location data available
                    </div>
                </div>
            `}
        </div>
    `;
    
    // Initialize mini-map if client has coordinates
    if (client.lat && client.lon) {
        setTimeout(() => initializeClientMiniMap(client), 100);
    }
}

function showDefaultDetailView() {
    const detailEl = document.getElementById('client-detail');
    detailEl.innerHTML = `
        <div class="client-detail-content">
            <p>Select a client to view details, or add a new client to get started.</p>
        </div>
    `;
}

// ============================================================================
// DELETE FUNCTIONALITY
// ============================================================================

function confirmDeleteClient(clientId, clientName) {
    // Create confirmation dialog
    const modal = document.createElement('div');
    modal.className = 'delete-confirmation-modal';
    modal.innerHTML = `
        <div class="modal-overlay" onclick="closeDeleteConfirmation()">
            <div class="modal-content" onclick="event.stopPropagation()">
                <h3>Delete Client</h3>
                <p>Are you sure you want to delete <strong>${clientName}</strong>?</p>
                <p style="color: #666; font-size: 14px;">This action cannot be undone.</p>
                <div class="modal-actions">
                    <button class="btn btn-secondary" onclick="closeDeleteConfirmation()">
                        Cancel
                    </button>
                    <button class="btn btn-danger" onclick="deleteClient('${clientId}')">
                        Delete Client
                    </button>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
}

function closeDeleteConfirmation() {
    const modal = document.querySelector('.delete-confirmation-modal');
    if (modal) {
        document.body.removeChild(modal);
    }
}

async function deleteClient(clientId) {
    try {
        // Show loading state
        const deleteBtn = document.querySelector('.btn-danger');
        const originalText = deleteBtn.textContent;
        deleteBtn.textContent = 'Deleting...';
        deleteBtn.disabled = true;
        
        const response = await fetch(`/clients/${clientId}`, {
            method: 'DELETE'
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Failed to delete client');
        }
        
        // Remove client from local array
        const clientIndex = clients.findIndex(c => c.id === clientId);
        const deletedClientName = clientIndex !== -1 ? clients[clientIndex].name : 'Client';
        
        if (clientIndex !== -1) {
            clients.splice(clientIndex, 1);
        }
        
        // Update UI
        renderClientList();
        showDefaultDetailView();
        
        // Clear selection
        selectedClient = null;
        
        // Close modal and show success message
        closeDeleteConfirmation();
        showTemporaryMessage('success', `${deletedClientName} deleted successfully`);
        
    } catch (error) {
        console.error('Error deleting client:', error);
        
        // Reset button state
        const deleteBtn = document.querySelector('.btn-danger');
        if (deleteBtn) {
            deleteBtn.textContent = 'Delete Client';
            deleteBtn.disabled = false;
        }
        
        showTemporaryMessage('error', `Error: ${error.message}`);
    }
}

// ============================================================================
// MINI-MAP FUNCTIONALITY
// ============================================================================

let clientMiniMap = null;

function initializeClientMiniMap(client) {
    if (!client.lat || !client.lon || typeof google === 'undefined') {
        console.log('Cannot initialize mini-map: missing coordinates or Google Maps API');
        return;
    }
    
    const mapElement = document.getElementById('client-mini-map');
    if (!mapElement) {
        console.log('Mini-map element not found');
        return;
    }
    
    try {
        // Create map centered on client location
        const clientLocation = { lat: client.lat, lng: client.lon };
        
        clientMiniMap = new google.maps.Map(mapElement, {
            zoom: 17, // High zoom level to show property detail
            center: clientLocation,
            mapTypeId: google.maps.MapTypeId.Map, // Satellite view shows property clearly
            disableDefaultUI: true, // Clean interface
            gestureHandling: 'cooperative', // Requires ctrl+scroll to zoom
            styles: [
                {
                    featureType: 'poi',
                    elementType: 'labels',
                    stylers: [{ visibility: 'off' }] // Hide point of interest labels for cleaner view
                }
            ]
        });
        
        // Add marker for the client
        const marker = new google.maps.Marker({
            position: clientLocation,
            map: clientMiniMap,
            title: `${client.name}\n${client.address}`,
            icon: {
                url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill="#4CAF50"/>
                        <circle cx="12" cy="9" r="3" fill="white"/>
                    </svg>
                `),
                scaledSize: new google.maps.Size(24, 24),
                anchor: new google.maps.Point(12, 24)
            }
        });
        
        // Add info window with client details
        const infoWindow = new google.maps.InfoWindow({
            content: `
                <div style="padding: 8px; max-width: 200px;">
                    <strong>${client.name}</strong><br>
                    <span style="color: #666; font-size: 12px;">${client.address}</span>
                </div>
            `
        });
        
        // Show info window on marker click
        marker.addListener('click', () => {
            infoWindow.open(clientMiniMap, marker);
        });
        
        // Add map controls for better interaction
        clientMiniMap.setOptions({
            zoomControl: true,
            mapTypeControl: true,
            mapTypeControlOptions: {
                style: google.maps.MapTypeControlStyle.HORIZONTAL_BAR,
                position: google.maps.ControlPosition.TOP_RIGHT,
                mapTypeIds: [
                    google.maps.MapTypeId.ROADMAP,
                    google.maps.MapTypeId.SATELLITE,
                    google.maps.MapTypeId.HYBRID
                ]
            }
        });
        
    } catch (error) {
        console.error('Error initializing mini-map:', error);
        // Show error state in map container
        mapElement.innerHTML = `
            <div style="height: 100%; display: flex; align-items: center; justify-content: center; background: #f5f5f5; color: #666;">
                Unable to load map
            </div>
        `;
    }
}

function updateLivePreviewWithMap() {
    const name = document.getElementById('client-name').value || (isEditMode ? 'Editing Client' : 'New Client');
    const address = currentGeocodedData ? currentGeocodedData.address : 'Address not selected';
    const type = document.getElementById('client-type').value || 'N/A';
    const priority = document.getElementById('client-priority').value || 'N/A';
    
    const statusText = isEditMode ? 'Preview changes - Not saved yet' : 'Preview - Not saved yet';
    
    const detailEl = document.getElementById('client-detail');
    detailEl.innerHTML = `
        <div class="client-detail-content">
            <h2>${name}</h2>
            <p><strong>Address:</strong> ${address}</p>
            <p><strong>Type:</strong> ${type}</p>
            <p><strong>Priority:</strong> ${priority}</p>
            <p><strong>Last Mowed:</strong> N/A days ago</p>
            <p><strong>Yard Size:</strong> N/A sq ft</p>
            <p><strong>Income/hr:</strong> $N/A</p>
            ${currentGeocodedData ? `<p><strong>Coordinates:</strong> ${currentGeocodedData.lat.toFixed(4)}, ${currentGeocodedData.lon.toFixed(4)}</p>` : ''}
            <div class="status-indicator status-pending" style="margin-top: 1rem;">
                ${statusText}
            </div>
            
            ${currentGeocodedData ? `
                <div style="margin-top: 1.5rem;">
                    <h4 style="margin-bottom: 0.5rem;">Location Preview</h4>
                    <div id="client-mini-map" style="height: 200px; width: 100%; border: 1px solid #ddd; border-radius: 4px;"></div>
                </div>
            ` : ''}
        </div>
    `;
    
    // Initialize preview map if we have coordinates
    if (currentGeocodedData) {
        setTimeout(() => initializePreviewMiniMap(), 100);
    }
}

function initializePreviewMiniMap() {
    if (!currentGeocodedData || typeof google === 'undefined') {
        return;
    }
    
    const mapElement = document.getElementById('client-mini-map');
    if (!mapElement) {
        return;
    }
    
    try {
        const location = { lat: currentGeocodedData.lat, lng: currentGeocodedData.lon };
        
        const previewMap = new google.maps.Map(mapElement, {
            zoom: 17,
            center: location,
            mapTypeId: google.maps.MapTypeId.SATELLITE,
            disableDefaultUI: true,
            gestureHandling: 'cooperative'
        });
        
        // Add preview marker
        new google.maps.Marker({
            position: location,
            map: previewMap,
            title: currentGeocodedData.address,
            icon: {
                url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill="#FF9800"/>
                        <circle cx="12" cy="9" r="3" fill="white"/>
                    </svg>
                `),
                scaledSize: new google.maps.Size(24, 24),
                anchor: new google.maps.Point(12, 24)
            }
        });
        
    } catch (error) {
        console.error('Error initializing preview map:', error);
    }
}
