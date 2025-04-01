// API Base URL
const API_URL = 'https://mapper-backend-aagk.onrender.com/api';
const MAPTILER_API_KEY = 'eSJd56lRWAdu5w15yA6P';

// Initialize map and state
let map = null;
let selectedOrder = null;

// Toast setup
const toastEl = document.getElementById('toast');
const toastTitle = document.getElementById('toastTitle');
const toastBody = document.getElementById('toastBody');
const toast = new bootstrap.Toast(toastEl);

// Modal setup
const editProjectModal = new bootstrap.Modal(document.getElementById('editProjectModal'));

function showToast(title, body, isError = false) {
    toastTitle.textContent = title;
    toastBody.textContent = body;
    toastTitle.style.color = isError ? '#dc3545' : '#28a745';
    toast.show();
}

// Fetch orders
async function fetchOrders() {
    try {
        const response = await fetch(`${API_URL}/orders`);
        const orders = await response.json();
        if (!response.ok) throw new Error('Failed to fetch orders');
        updateOrderList(orders);
    } catch (err) {
        showToast('Error', err.message, true);
    }
}

// Update order list (displayed as projects in the UI)
function updateOrderList(orders) {
    const projectList = document.getElementById('projectList');
    projectList.innerHTML = '';
    orders.forEach(order => {
        const div = document.createElement('div');
        div.className = 'order-entry';
        div.innerHTML = `
            <div class="order-entry-content">
                <strong>${order.name}</strong>
            </div>
            <div class="order-entry-actions">
                <button class="btn btn-warning btn-sm edit-order-btn" data-id="${order._id}" data-name="${order.name}">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn btn-info btn-sm select-order-btn" data-id="${order._id}">
                    <i class="fas fa-eye"></i>
                </button>
                <button class="btn btn-danger btn-sm delete-order-btn" data-id="${order._id}">
                    <i class="fas fa-trash-alt"></i>
                </button>
            </div>
        `;
        projectList.appendChild(div);
    });

    // Add event listeners for edit, select, and delete buttons
    document.querySelectorAll('.edit-order-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const orderId = e.target.closest('.edit-order-btn').dataset.id;
            const orderName = e.target.closest('.edit-order-btn').dataset.name;
            openEditModal(orderId, orderName);
        });
    });

    document.querySelectorAll('.select-order-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const orderId = e.target.closest('.select-order-btn').dataset.id;
            await selectOrder(orderId);
        });
    });

    document.querySelectorAll('.delete-order-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const orderId = e.target.closest('.delete-order-btn').dataset.id;
            await deleteOrder(orderId);
        });
    });
}

// Open the edit modal
function openEditModal(orderId, orderName) {
    document.getElementById('editProjectName').value = orderName;
    document.getElementById('editProjectId').value = orderId;
    editProjectModal.show();
}

// Save the edited project name
document.getElementById('saveProjectNameBtn').addEventListener('click', async () => {
    const orderId = document.getElementById('editProjectId').value;
    const newName = document.getElementById('editProjectName').value.trim();

    if (!newName) {
        showToast('Error', 'Project name cannot be empty', true);
        return;
    }

    try {
        const response = await fetch(`${API_URL}/orders/${orderId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ name: newName })
        });
        const updatedOrder = await response.json();
        if (!response.ok) throw new Error('Failed to update project name');
        editProjectModal.hide();
        await fetchOrders();
        // If the edited order is the currently selected one, update selectedOrder and the UI
        if (selectedOrder && selectedOrder._id === orderId) {
            selectedOrder = updatedOrder;
            document.getElementById('currentProjectName').textContent = updatedOrder.name;
        }
        showToast('Success', 'Project name updated successfully');
    } catch (err) {
        showToast('Error', err.message, true);
    }
});

// Create order (displayed as project in the UI)
document.getElementById('projectForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('projectName').value;

    try {
        const response = await fetch(`${API_URL}/orders`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ name })
        });
        const order = await response.json();
        if (!response.ok) throw new Error('Failed to create order');
        document.getElementById('projectForm').reset();
        await fetchOrders();
        await selectOrder(order._id);
        showToast('Success', 'Project created successfully');
    } catch (err) {
        showToast('Error', err.message, true);
    }
});

// Delete order
async function deleteOrder(orderId) {
    try {
        const response = await fetch(`${API_URL}/orders/${orderId}`, {
            method: 'DELETE',
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Failed to delete order');
        if (selectedOrder && selectedOrder._id === orderId) {
            selectedOrder = null;
            document.getElementById('locationFormContainer').style.display = 'none';
            document.getElementById('locationListContainer').style.display = 'none';
            document.getElementById('mapContainer').style.display = 'none';
            document.getElementById('downloadBtn').style.display = 'none';
            document.getElementById('downloadJpegBtn').style.display = 'none'; // Hide the JPEG download button
            document.getElementById('currentProjectContainer').style.display = 'none';
            if (map) {
                map.remove();
                map = null;
            }
        }
        await fetchOrders();
        showToast('Success', 'Project deleted successfully');
    } catch (err) {
        showToast('Error', err.message, true);
    }
}

// Select order
async function selectOrder(orderId) {
    try {
        const response = await fetch(`${API_URL}/orders`);
        const orders = await response.json();
        if (!response.ok) throw new Error('Failed to fetch orders');
        selectedOrder = orders.find(order => order._id === orderId);
        document.getElementById('locationFormContainer').style.display = 'block';
        document.getElementById('locationListContainer').style.display = 'block';
        document.getElementById('mapContainer').style.display = 'flex';
        // Show the current project name
        document.getElementById('currentProjectContainer').style.display = 'block';
        document.getElementById('currentProjectName').textContent = selectedOrder.name;
        updateLog();
        if (map) {
            updateMap();
            setTimeout(() => map.invalidateSize(), 100);
        }
    } catch (err) {
        showToast('Error', err.message, true);
    }
}

// Geocode address
async function geocodeAddress(address) {
    const url = `https://api.maptiler.com/geocoding/${encodeURIComponent(address)}.json?key=${MAPTILER_API_KEY}`;
    try {
        document.getElementById('addSpinner').style.display = 'inline-block';
        document.getElementById('addBtnText').textContent = 'Adding...';
        const response = await fetch(url);
        const data = await response.json();
        if (data.features && data.features.length > 0) {
            const coords = data.features[0].geometry.coordinates;
            return {
                lat: Math.round(coords[1] * 1000000) / 1000000,
                lng: Math.round(coords[0] * 1000000) / 1000000
            };
        } else {
            throw new Error('We couldn’t get the geocode for this address');
        }
    } catch (error) {
        throw new Error('We couldn’t get the geocode for this address');
    } finally {
        document.getElementById('addSpinner').style.display = 'none';
        document.getElementById('addBtnText').textContent = 'Add Location';
    }
}

// Download map as JPEG
document.getElementById('downloadJpegBtn').addEventListener('click', async () => {
    if (!selectedOrder || selectedOrder.locations.length === 0) {
        showToast('Error', 'No locations to download!', true);
        return;
    }

    document.getElementById('downloadJpegSpinner').style.display = 'inline-block';

    try {
        await new Promise((resolve) => {
            map.whenReady(() => {
                setTimeout(resolve, 2000);
            });
        });

        // Hide the attribution text before capturing
        const attribution = document.querySelector('.leaflet-control-attribution');
        if (attribution) {
            attribution.style.display = 'none';
        }

        const canvas = await html2canvas(document.getElementById('map'), {
            useCORS: true,
            logging: true,
            scale: 2 // Increase resolution to 2x
        });
        const imgData = canvas.toDataURL('image/jpeg', 1.0); // Maximum quality
        const link = document.createElement('a');
        link.href = imgData;
        link.download = 'real_estate_map.jpeg';
        link.click();

        // Show the attribution text again
        if (attribution) {
            attribution.style.display = 'block';
        }

        showToast('Success', 'JPEG downloaded successfully');
    } catch (err) {
        showToast('Error', 'Failed to generate JPEG. Please try again.', true);
    } finally {
        document.getElementById('downloadJpegSpinner').style.display = 'none';
    }
});

// Add location
document.getElementById('locationForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const address = document.getElementById('address').value;
    const description = document.getElementById('description').value;

    try {
        const coords = await geocodeAddress(address);
        const response = await fetch(`${API_URL}/locations/${selectedOrder._id}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ address, description, lat: coords.lat, lng: coords.lng })
        });
        const updatedOrder = await response.json();
        if (!response.ok) throw new Error(updatedOrder.message || 'Failed to add location');
        selectedOrder = updatedOrder;
        updateLog();
        updateMap();
        document.getElementById('locationForm').reset();
        showToast('Success', 'Location added successfully');
    } catch (err) {
        showToast('Error', err.message, true);
    }
});

// Update log display
function updateLog() {
    const log = document.getElementById('log');
    log.innerHTML = '';
    if (!selectedOrder || !selectedOrder.locations) return;

    selectedOrder.locations.forEach((loc, index) => {
        const entry = document.createElement('div');
        entry.className = 'log-entry';
        entry.innerHTML = `
            <div class="log-entry-number">${index + 1}</div>
            <div class="log-entry-content">
                <strong>${loc.address}</strong><br>${loc.description}
            </div>
            <div class="log-entry-actions">
                <button class="btn btn-secondary btn-sm move-up-btn" data-index="${index}" ${index === 0 ? 'disabled' : ''}>
                    <i class="fas fa-arrow-up"></i>
                </button>
                <button class="btn btn-secondary btn-sm move-down-btn" data-index="${index}" ${index === selectedOrder.locations.length - 1 ? 'disabled' : ''}>
                    <i class="fas fa-arrow-down"></i>
                </button>
                <button class="btn btn-danger btn-sm delete-btn" data-id="${loc._id}">
                    <i class="fas fa-trash-alt"></i>
                </button>
            </div>
        `;
        log.appendChild(entry);
    });

    // Add event listeners for move up, move down, and delete buttons
    document.querySelectorAll('.move-up-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const index = parseInt(e.target.closest('.move-up-btn').dataset.index);
            await moveLocation(index, 'up');
        });
    });

    document.querySelectorAll('.move-down-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const index = parseInt(e.target.closest('.move-down-btn').dataset.index);
            await moveLocation(index, 'down');
        });
    });

    document.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const locationId = e.target.closest('.delete-btn').dataset.id;
            await deleteLocation(locationId);
        });
    });
}

// Move location (up or down)
async function moveLocation(index, direction) {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === selectedOrder.locations.length - 1) return;

    const newLocations = [...selectedOrder.locations];
    if (direction === 'up') {
        [newLocations[index], newLocations[index - 1]] = [newLocations[index - 1], newLocations[index]];
    } else {
        [newLocations[index], newLocations[index + 1]] = [newLocations[index + 1], newLocations[index]];
    }

    try {
        const response = await fetch(`${API_URL}/locations/${selectedOrder._id}/reorder`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ locations: newLocations.map(loc => loc._id) })
        });
        const updatedOrder = await response.json();
        if (!response.ok) throw new Error('Failed to reorder locations');
        selectedOrder = updatedOrder;
        updateLog();
        updateMap();
        showToast('Success', `Location moved ${direction}`);
    } catch (err) {
        showToast('Error', err.message, true);
    }
}

// Delete location
async function deleteLocation(locationId) {
    try {
        const response = await fetch(`${API_URL}/locations/${selectedOrder._id}/${locationId}`, {
            method: 'DELETE',
        });
        const updatedOrder = await response.json();
        if (!response.ok) throw new Error('Failed to delete location');
        selectedOrder = updatedOrder;
        updateLog();
        updateMap();
        showToast('Success', 'Location deleted successfully');
    } catch (err) {
        showToast('Error', err.message, true);
    }
}

// Update map
function updateMap() {
    if (!map || !selectedOrder || !selectedOrder.locations) return;

    map.eachLayer(layer => {
        if (layer instanceof L.Marker) map.removeLayer(layer);
    });

    selectedOrder.locations.forEach((loc, index) => {
        const marker = L.marker([loc.lat, loc.lng], {
            icon: L.divIcon({
                html: `<div>${index + 1}</div>`,
                className: 'marker-number',
                iconSize: [24, 24]
            })
        }).addTo(map);
        marker.bindPopup(`<b>${index + 1}. ${loc.address}</b><br>${loc.description}`);
    });

    if (selectedOrder.locations.length === 1) {
        map.setView([selectedOrder.locations[0].lat, selectedOrder.locations[0].lng], 12);
    } else if (selectedOrder.locations.length > 1) {
        const bounds = L.latLngBounds(selectedOrder.locations.map(loc => [loc.lat, loc.lng]));
        map.fitBounds(bounds, { padding: [50, 50] });
    }
}

// Generate map
document.getElementById('generateBtn').addEventListener('click', () => {
    if (!selectedOrder || selectedOrder.locations.length === 0) {
        showToast('Error', 'Please add at least one location!', true);
        return;
    }

    const mapDiv = document.getElementById('map');
    mapDiv.style.display = 'block';

    if (!map) {
        map = L.map('map', {
            zoomControl: false // Zoom controls already disabled
        });
        L.tileLayer(`https://api.maptiler.com/maps/streets/{z}/{x}/{y}@2x.png?key=${MAPTILER_API_KEY}`, {
            attribution: '© <a href="https://www.maptiler.com/copyright/">MapTiler</a> © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
            maxZoom: 19,
            tileSize: 512, // Required for retina tiles
            zoomOffset: -1, // Adjust zoom levels for retina tiles
            detectRetina: true // Enable retina detection
        }).addTo(map);
    }

    updateMap();
    setTimeout(() => map.invalidateSize(), 100);
    document.getElementById('downloadBtn').style.display = 'inline-block';
    document.getElementById('downloadJpegBtn').style.display = 'inline-block';
    showToast('Success', 'Map generated successfully');
});

// Download map as PDF
document.getElementById('downloadBtn').addEventListener('click', async () => {
    if (!selectedOrder || selectedOrder.locations.length === 0) {
        showToast('Error', 'No locations to download!', true);
        return;
    }

    document.getElementById('downloadSpinner').style.display = 'inline-block';

    try {
        await new Promise((resolve) => {
            map.whenReady(() => {
                setTimeout(resolve, 2000);
            });
        });

        // Hide the attribution text before capturing
        const attribution = document.querySelector('.leaflet-control-attribution');
        if (attribution) {
            attribution.style.display = 'none';
        }

        const canvas = await html2canvas(document.getElementById('map'), {
            useCORS: true,
            logging: true,
            scale: 2 // Increase resolution to 2x
        });
        const imgData = canvas.toDataURL('image/png');
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF('p', 'mm', 'a4');
        const pageWidth = 210; // A4 width in mm
        const pageHeight = 297; // A4 height in mm
        const imgWidth = pageWidth - 20; // 10mm margin on each side
        const imgHeight = (canvas.height * imgWidth) / canvas.width;
        const marginTop = (pageHeight - imgHeight) / 2; // Center vertically
        pdf.addImage(imgData, 'PNG', 10, marginTop > 0 ? marginTop : 10, imgWidth, imgHeight);
        pdf.save('real_estate_map.pdf');

        // Show the attribution text again
        if (attribution) {
            attribution.style.display = 'block';
        }

        showToast('Success', 'PDF downloaded successfully');
    } catch (err) {
        showToast('Error', 'Failed to generate PDF. Please try again.', true);
    } finally {
        document.getElementById('downloadSpinner').style.display = 'none';
    }
});

// Initialize the app (bypass auth for demo)
fetchOrders();