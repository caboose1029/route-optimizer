// Professional Client Management JavaScript with Tailwind Integration
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
    
    autocomplete = new google.maps.places.Autocomplete(addressInput, {
        types: ['address'],
        componentRestrictions: { country: 'US' },
        fields: ['formatted_address', 'geometry', 'address_components']
    });
    
    autocomplete.addListener('place_changed', handlePlaceSelection);
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
    if (currentGeocodedData && !isEditMode) {
        currentGeocodedData = null;
        showGeocodingStatus('warning', 'Please select an address from the dropdown');
        updateSaveButtonState();
    }
}

function showGeocodingStatus(type, message) {
    const statusEl = document.getElementById('geocoding-status');
    
    // Map status types to Tailwind alert classes
    const statusClasses = {
        success: 'alert-success',
        error: 'alert-error', 
        warning: 'alert-warning',
        info: 'alert-info',
        pending: 'alert-info'
    };
    
    statusEl.className = `alert ${statusClasses[type] || statusClasses.info}`;
    statusEl.textContent = message;
    statusEl.classList.remove('hidden');
}

function hideGeocodingStatus() {
    const statusEl = document.getElementById('geocoding-status');
    statusEl.classList.add('hidden');
}

function updateSaveButtonState() {
    const saveBtn = document.getElementById('save-client-btn');
    const nameInput = document.getElementById('client-name');
    
    const isValid = nameInput.value.trim() && currentGeocodedData;
    saveBtn.disabled = !isValid;
    
    // Update button text and icon based on mode
    const icon = isEditMode ? 
        '<svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>' :
        '<svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>';
    
    saveBtn.innerHTML = icon + (isEditMode ? 'Update Client' : 'Save Client');
}

function showAddClientForm() {
    isEditMode = false;
    editingClientId = null;
    
    // Reset form
    document.getElementById('client-form').reset();
    currentGeocodedData = null;
    hideGeocodingStatus();
    
    // Update UI
    document.getElementById('add-client-form').classList.remove('hidden');
    document.getElementById('form-title').textContent = 'Add New Client';
    document.getElementById('client-name').focus();
    
    // Clear selection
    clearClientSelection();
    
    updateSaveButtonState();
    updateLivePreview();
}

function showEditClientForm(client) {
    isEditMode = true;
    editingClientId = client.id;
    
    // Pre-populate form
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
    
    // Update UI
    document.getElementById('add-client-form').classList.remove('hidden');
    document.getElementById('form-title').textContent = 'Edit Client';
    document.getElementById('client-name').focus();
    
    updateSaveButtonState();
    updateLivePreview();
}

function hideClientForm() {
    document.getElementById('add-client-form').classList.add('hidden');
    document.getElementById('client-form').reset();
    currentGeocodedData = null;
    isEditMode = false;
    editingClientId = null;
    hideGeocodingStatus();
    updateSaveButtonState();
    
    // Return to selected client or default view
    if (selectedClient) {
        showClientDetails(selectedClient);
    } else {
        showDefaultDetailView();
    }
}

function updateLivePreview() {
    const name = document.getElementById('client-name').value || (isEditMode ? 'Editing Client' : 'New Client');
    const address = currentGeocodedData ? currentGeocodedData.address : 'Address not selected';
    const type = document.getElementById('client-type').value || 'Standard Service';
    const priority = document.getElementById('client-priority').value || 'Normal';
    
    const statusText = isEditMode ? 'Preview changes - Not saved yet' : 'Preview - Not saved yet';
    
    const detailEl = document.getElementById('client-detail');
    detailEl.innerHTML = `
        <div class="flex flex-col h-full">
            <div class="client-detail-header">
                <div>
                    <h2 class="text-2xl font-semibold text-gray-900">${name}</h2>
                    <div class="mt-2">
                        <span class="status-indicator bg-orange-100 text-orange-800">Preview Mode</span>
                    </div>
                </div>
            </div>
            
            <div class="flex-1 space-y-6">
                <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <h3 class="section-title">Contact Information</h3>
                        <div class="space-y-3">
                            <div>
                                <span class="text-emphasis">Address:</span>
                                <p class="text-muted">${address}</p>
                            </div>
                            <div>
                                <span class="text-emphasis">Service Type:</span>
                                <p class="text-muted">${type}</p>
                            </div>
                            <div>
                                <span class="text-emphasis">Priority:</span>
                                <p class="text-muted">${priority}</p>
                            </div>
                        </div>
                    </div>
                    
                    <div>
                        <h3 class="section-title">Service Details</h3>
                        <div class="space-y-3">
                            <div>
                                <span class="text-emphasis">Last Service:</span>
                                <p class="text-muted">Not recorded</p>
                            </div>
                            <div>
                                <span class="text-emphasis">Yard Size:</span>
                                <p class="text-muted">Not specified</p>
                            </div>
                            <div>
                                <span class="text-emphasis">Rate:</span>
                                <p class="text-muted">Not set</p>
                            </div>
                        </div>
                    </div>
                </div>
                
                ${currentGeocodedData ? `
                <div>
                    <h3 class="section-title">Location</h3>
                    <div class="space-y-3">
                        <div>
                            <span class="text-emphasis">Coordinates:</span>
                            <p class="text-muted font-mono text-sm">${currentGeocodedData.lat.toFixed(6)}, ${currentGeocodedData.lon.toFixed(6)}</p>
                        </div>
                        <div id="client-mini-map" class="h-48 bg-gray-100 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center">
                            <p class="text-muted">Map preview will appear here</p>
                        </div>
                    </div>
                </div>
                ` : ''}
            </div>
            
            <div class="alert-warning mt-6">
                <strong>Preview Mode:</strong> ${statusText}
            </div>
        </div>
    `;
    
    // Initialize preview map if we have coordinates
    if (currentGeocodedData) {
        setTimeout(() => initializePreviewMiniMap(), 100);
    }
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
        showGeocodingStatus('info', statusText);
        
        // Disable form during save
        const saveBtn = document.getElementById('save-client-btn');
        const originalHTML = saveBtn.innerHTML;
        saveBtn.innerHTML = '<div class="loading-spinner mr-2"></div>Saving...';
        saveBtn.disabled = true;
        
        let response;
        if (isEditMode) {
            response = await fetch(`/clients/${editingClientId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });
        } else {
            response = await fetch('/clients', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });
        }
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || `Failed to ${isEditMode ? 'update' : 'save'} client`);
        }
        
        const clientData = await response.json();
        
        // Update local data
        if (isEditMode) {
            const clientIndex = clients.findIndex(c => c.id === editingClientId);
            if (clientIndex !== -1) {
                clients[clientIndex] = clientData;
            }
        } else {
            clients.push(clientData);
        }
        
        // Update UI
        renderClientList();
        hideClientForm();
        selectClient(clientData);
        
        // Show success notification
        const successText = isEditMode ? 'Client updated successfully!' : 'Client saved successfully!';
        showToast('success', successText);
        
    } catch (error) {
        console.error('Error saving client:', error);
        showGeocodingStatus('error', `Error: ${error.message}`);
        
        // Reset button
        const saveBtn = document.getElementById('save-client-btn');
        saveBtn.innerHTML = originalHTML;
        updateSaveButtonState();
    }
}

async function loadClients() {
    try {
        const response = await fetch('/data');
        clients = await response.json();
        renderClientList();
    } catch (error) {
        console.error('Error loading clients:', error);
        showToast('error', 'Failed to load clients');
    }
}

function renderClientList() {
    const listEl = document.getElementById('client-list');
    
    if (clients.length === 0) {
        listEl.innerHTML = `
            <div class="p-6 text-center">
                <svg class="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z"></path>
                </svg>
                <p class="text-muted">No clients yet</p>
                <p class="text-sm text-gray-400">Add your first client to get started</p>
            </div>
        `;
        return;
    }
    
    listEl.innerHTML = clients.map(client => `
        <div class="client-card-content border-b border-gray-100 last:border-b-0 ${selectedClient?.id === client.id ? 'bg-primary-50 border-primary-200' : 'hover:bg-gray-50'}" 
             data-client-id="${client.id}" 
             onclick="selectClientById('${client.id}')"
             style="cursor: pointer;">
            <div class="p-4">
                <div class="flex justify-between items-start">
                    <div class="flex-1 min-w-0">
                        <h4 class="font-medium text-gray-900 truncate">${client.name}</h4>
                        <p class="text-sm text-muted mt-1 line-clamp-2">${client.address || 'No address'}</p>
                        <div class="mt-2 flex items-center gap-2">
                            <span class="status-success">Standard Service</span>
                            ${client.lat && client.lon ? 
                                '<svg class="w-3 h-3 text-green-500" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"></path></svg>' : 
                                '<svg class="w-3 h-3 text-yellow-500" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"></path></svg>'
                            }
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `).join('');
}

function selectClientById(clientId) {
    const client = clients.find(c => c.id === clientId);
    if (client) {
        selectClient(client);
    }
}

function selectClient(client) {
    selectedClient = client;
    
    // Hide form if visible
    document.getElementById('add-client-form').classList.add('hidden');
    isEditMode = false;
    editingClientId = null;
    
    // Update visual selection and show details
    renderClientList(); // Re-render to update selection
    showClientDetails(client);
}

function clearClientSelection() {
    selectedClient = null;
    renderClientList();
}

function showClientDetails(client) {
    const detailEl = document.getElementById('client-detail');
    detailEl.innerHTML = `
        <div class="flex flex-col h-full">
            <div class="client-detail-header">
                <div>
                    <h2 class="text-2xl font-semibold text-gray-900">${client.name}</h2>
                    <div class="mt-2">
                        <span class="status-success">Active Client</span>
                    </div>
                </div>
                <div class="client-detail-actions">
                    <button class="btn-primary btn-sm" onclick="showEditClientForm(clients.find(c => c.id === '${client.id}'))">
                        <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
                        </svg>
                        Edit
                    </button>
                    <button class="btn-danger btn-sm" onclick="confirmDeleteClient('${client.id}', '${client.name.replace(/'/g, "\\'")}')">
                        <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                        </svg>
                        Delete
                    </button>
                </div>
            </div>
            
            <div class="flex-1 space-y-6">
                <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <h3 class="section-title">Contact Information</h3>
                        <div class="space-y-3">
                            <div>
                                <span class="text-emphasis">Address:</span>
                                <p class="text-muted">${client.address || 'Not provided'}</p>
                            </div>
                            <div>
                                <span class="text-emphasis">Service Type:</span>
                                <p class="text-muted">Standard Service</p>
                            </div>
                            <div>
                                <span class="text-emphasis">Priority:</span>
                                <p class="text-muted">Normal</p>
                            </div>
                        </div>
                    </div>
                    
                    <div>
                        <h3 class="section-title">Service Details</h3>
                        <div class="space-y-3">
                            <div>
                                <span class="text-emphasis">Last Service:</span>
                                <p class="text-muted">Not recorded</p>
                            </div>
                            <div>
                                <span class="text-emphasis">Yard Size:</span>
                                <p class="text-muted">Not specified</p>
                            </div>
                            <div>
                                <span class="text-emphasis">Rate:</span>
                                <p class="text-muted">Not set</p>
                            </div>
                        </div>
                    </div>
                </div>
                
                ${client.lat && client.lon ? `
                <div>
                    <h3 class="section-title">Location</h3>
                    <div class="space-y-3">
                        <div>
                            <span class="text-emphasis">Coordinates:</span>
                            <p class="text-muted font-mono text-sm">${client.lat.toFixed(6)}, ${client.lon.toFixed(6)}</p>
                        </div>
                        <div id="client-mini-map" class="h-48 bg-gray-100 rounded-lg border border-gray-300"></div>
                    </div>
                </div>
                ` : `
                <div>
                    <h3 class="section-title">Location</h3>
                    <div class="h-48 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center">
                        <div class="text-center">
                            <svg class="w-8 h-8 text-gray-400 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path>
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path>
                            </svg>
                            <p class="text-muted">No location data available</p>
                        </div>
                    </div>
                </div>
                `}
            </div>
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
        <div class="flex-1 flex items-center justify-center">
            <div class="text-center">
                <svg class="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z"></path>
                </svg>
                <h3 class="text-lg font-medium text-gray-900 mb-2">Select a Client</h3>
                <p class="text-muted max-w-sm">Choose a client from the list to view details and manage their information, or add a new client to get started.</p>
            </div>
        </div>
    `;
}

// ============================================================================
// DELETE FUNCTIONALITY
// ============================================================================

function confirmDeleteClient(clientId, clientName) {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
        <div class="modal" onclick="event.stopPropagation()">
            <div class="modal-header">
                <h3 class="modal-title">Delete Client</h3>
            </div>
            <div class="modal-body">
                <p class="mb-4">Are you sure you want to delete <strong>${clientName}</strong>?</p>
                <div class="alert-warning">
                    <strong>Warning:</strong> This action cannot be undone.
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn-secondary" onclick="closeDeleteConfirmation()">
                    Cancel
                </button>
                <button class="btn-danger" onclick="deleteClient('${clientId}')">
                    <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                    </svg>
                    Delete Client
                </button>
            </div>
        </div>
    `;
    
    // Close on overlay click
    modal.addEventListener('click', closeDeleteConfirmation);
    
    document.body.appendChild(modal);
}

function closeDeleteConfirmation() {
    const modal = document.querySelector('.modal-overlay');
    if (modal) {
        document.body.removeChild(modal);
    }
}

async function deleteClient(clientId) {
    try {
        const deleteBtn = document.querySelector('.btn-danger');
        const originalHTML = deleteBtn.innerHTML;
        deleteBtn.innerHTML = '<div class="loading-spinner mr-2"></div>Deleting...';
        deleteBtn.disabled = true;
        
        const response = await fetch(`/clients/${clientId}`, {
            method: 'DELETE'
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Failed to delete client');
        }
        
        // Remove from local data
        const clientIndex = clients.findIndex(c => c.id === clientId);
        const deletedClientName = clientIndex !== -1 ? clients[clientIndex].name : 'Client';
        
        if (clientIndex !== -1) {
            clients.splice(clientIndex, 1);
        }
        
        // Update UI
        renderClientList();
        showDefaultDetailView();
        selectedClient = null;
        
        // Close modal and show success
        closeDeleteConfirmation();
        showToast('success', `${deletedClientName} deleted successfully`);
        
    } catch (error) {
        console.error('Error deleting client:', error);
        
        // Reset button
        const deleteBtn = document.querySelector('.btn-danger');
        if (deleteBtn) {
            deleteBtn.innerHTML = originalHTML;
            deleteBtn.disabled = false;
        }
        
        showToast('error', `Error: ${error.message}`);
    }
}

// ============================================================================
// TOAST NOTIFICATIONS
// ============================================================================

function showToast(type, message) {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    
    const typeClasses = {
        success: 'alert-success',
        error: 'alert-error',
        warning: 'alert-warning',
        info: 'alert-info'
    };
    
    const icons = {
        success: '<svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"></path></svg>',
        error: '<svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414z" clip-rule="evenodd"></path></svg>',
        warning: '<svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"></path></svg>',
        info: '<svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd"></path></svg>'
    };
    
    toast.className = `${typeClasses[type]} flex items-center animate-slide-in min-w-72 max-w-sm shadow-lg`;
    toast.innerHTML = `
        <div class="flex items-center">
            <div class="flex-shrink-0 mr-3">
                ${icons[type]}
            </div>
            <div class="flex-1 min-w-0">
                <p class="text-sm font-medium">${message}</p>
            </div>
            <button class="ml-3 flex-shrink-0 text-gray-400 hover:text-gray-600" onclick="this.parentElement.parentElement.remove()">
                <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"></path>
                </svg>
            </button>
        </div>
    `;
    
    container.appendChild(toast);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
        if (toast.parentNode) {
            toast.classList.add('animate-fade-out');
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.remove();
                }
            }, 300);
        }
    }, 5000);
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
        const clientLocation = { lat: client.lat, lng: client.lon };
        
        clientMiniMap = new google.maps.Map(mapElement, {
            zoom: 17,
            center: clientLocation,
            mapTypeId: google.maps.MapTypeId.ROADMAP,
            disableDefaultUI: true,
            gestureHandling: 'cooperative',
            styles: [
                {
                    featureType: 'poi',
                    elementType: 'labels',
                    stylers: [{ visibility: 'off' }]
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
                        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill="#22c55e"/>
                        <circle cx="12" cy="9" r="3" fill="white"/>
                    </svg>
                `),
                scaledSize: new google.maps.Size(24, 24),
                anchor: new google.maps.Point(12, 24)
            }
        });
        
        // Add info window
        const infoWindow = new google.maps.InfoWindow({
            content: `
                <div class="p-2 max-w-48">
                    <div class="font-medium text-gray-900">${client.name}</div>
                    <div class="text-sm text-gray-600 mt-1">${client.address}</div>
                </div>
            `
        });
        
        marker.addListener('click', () => {
            infoWindow.open(clientMiniMap, marker);
        });
        
        // Add map controls
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
        mapElement.innerHTML = `
            <div class="h-full flex items-center justify-center bg-gray-50 text-gray-500">
                Unable to load map
            </div>
        `;
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
            mapTypeId: google.maps.MapTypeId.ROADMAP,
            disableDefaultUI: true,
            gestureHandling: 'cooperative'
        });
        
        // Add preview marker (orange for preview)
        new google.maps.Marker({
            position: location,
            map: previewMap,
            title: currentGeocodedData.address,
            icon: {
                url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill="#f97316"/>
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
