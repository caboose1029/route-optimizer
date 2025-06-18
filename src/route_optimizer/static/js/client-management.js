// Client Management JavaScript
let clients = [];
let selectedClient = null;
let autocomplete = null;
let currentGeocodedData = null;

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
    document.getElementById('cancel-client-btn').addEventListener('click', hideAddClientForm);
    
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
    // Reset geocoded data when user types manually
    if (currentGeocodedData) {
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
}

function showAddClientForm() {
    document.getElementById('add-client-form').classList.add('active');
    document.getElementById('client-name').focus();
    
    // Clear any selected client and show form preview
    selectedClient = null;
    document.querySelectorAll('.client-card').forEach(card => {
        card.classList.remove('selected');
    });
    
    updateLivePreview();
}

function hideAddClientForm() {
    document.getElementById('add-client-form').classList.remove('active');
    document.getElementById('client-form').reset();
    currentGeocodedData = null;
    hideGeocodingStatus();
    updateSaveButtonState();
    
    // Return to default detail view
    showDefaultDetailView();
}

function updateLivePreview() {
    const name = document.getElementById('client-name').value || 'New Client';
    const address = currentGeocodedData ? currentGeocodedData.address : 'Address not selected';
    const type = document.getElementById('client-type').value || 'N/A';
    const priority = document.getElementById('client-priority').value || 'N/A';
    
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
            <div class="status-indicator status-pending" style="margin-top: 1rem;">
                Preview - Not saved yet
            </div>
        </div>
    `;
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
        showGeocodingStatus('pending', 'Saving client...');
        
        const response = await fetch('/clients', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(formData)
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Failed to save client');
        }
        
        const newClient = await response.json();
        
        // Add to clients list and refresh display
        clients.push(newClient);
        renderClientList();
        
        // Hide form and show success
        hideAddClientForm();
        selectClient(newClient);
        
        showGeocodingStatus('success', 'Client saved successfully!');
        setTimeout(hideGeocodingStatus, 3000);
        
    } catch (error) {
        console.error('Error saving client:', error);
        showGeocodingStatus('error', `Error: ${error.message}`);
    }
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
    
    // Show client details
    showClientDetails(client);
}

function showClientDetails(client) {
    const detailEl = document.getElementById('client-detail');
    detailEl.innerHTML = `
        <div class="client-detail-content">
            <h2>${client.name}</h2>
            <p><strong>Address:</strong> ${client.address || 'N/A'}</p>
            <p><strong>Type:</strong> ${getClientTypeDisplay(client)}</p>
            <p><strong>Priority:</strong> N/A</p>
            <p><strong>Last Mowed:</strong> N/A days ago</p>
            <p><strong>Yard Size:</strong> N/A sq ft</p>
            <p><strong>Income/hr:</strong> $N/A</p>
            <p><strong>Coordinates:</strong> ${client.lat ? `${client.lat.toFixed(4)}, ${client.lon.toFixed(4)}` : 'N/A'}</p>
        </div>
    `;
}

function showDefaultDetailView() {
    const detailEl = document.getElementById('client-detail');
    detailEl.innerHTML = `
        <div class="client-detail-content">
            <p>Select a client to view details, or add a new client to get started.</p>
        </div>
    `;
}
