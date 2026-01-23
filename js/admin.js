/**
 * Admin.js - Advanced Logic (Drag&Drop, Menus, Edit, Files)
 */

let activeMenuId = null;
let isSortMode = false;
let draggedItem = null;

document.addEventListener('DOMContentLoaded', () => {
    if (window.auth && !window.auth.isAuthenticated()) {
        window.location.href = 'login.html';
        return;
    }
    renderAdminInventory();
    setupDropZones();

    // Close menus when clicking outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.menu-trigger') && !e.target.closest('.card-menu')) {
            closeAllMenus();
        }
    });
});

// --- RENDER LOGIC ---
function renderAdminInventory() {
    const list = document.getElementById('inventory-list');
    list.innerHTML = '';
    const cars = window.store.getAllCars();

    cars.forEach(car => {
        const item = document.createElement('div');
        item.className = 'admin-card';
        // Add drag attributes
        item.setAttribute('draggable', isSortMode);
        item.dataset.id = car.id;
        if (isSortMode) item.classList.add('sortable');

        // Status Badge
        const statusBadge = car.sold
            ? '<span class="status-badge sold">VENDIDO</span>'
            : '<span class="status-badge">EN VENTA</span>';

        item.innerHTML = `
            <img src="${car.image}" alt="Car">
            <div class="admin-card-info">
                <h4>${car.brand} ${car.model}</h4>
                <p>${car.year} • ${car.price}</p>
                ${statusBadge}
            </div>
            
            <!-- Overflow Menu -->
            <div class="menu-trigger" onclick="toggleMenu('${car.id}', event)">⋮</div>
            <div class="card-menu" id="menu-${car.id}">
                <div class="card-menu-item" onclick="editCar('${car.id}')">✏️ Editar</div>
                <div class="card-menu-item" onclick="toggleSortMode()">⇵ Ordenar</div>
                <div class="card-menu-item delete" onclick="deleteCar('${car.id}')">🗑 Eliminar</div>
            </div>
        `;

        // Drag Events
        item.addEventListener('dragstart', handleDragStart);
        item.addEventListener('dragover', handleDragOver);
        item.addEventListener('drop', handleDrop);
        item.addEventListener('dragend', handleDragEnd);

        list.appendChild(item);
    });
}

// --- MENU LOGIC ---
function toggleMenu(id, event) {
    event.stopPropagation();
    const menu = document.getElementById(`menu-${id}`);
    const isVisible = menu.classList.contains('visible');
    closeAllMenus();
    if (!isVisible) {
        menu.classList.add('visible');
    }
}

function closeAllMenus() {
    document.querySelectorAll('.card-menu').forEach(m => m.classList.remove('visible'));
}

// --- MODAL & FORM LOGIC ---
function openModal(mode = 'create', carId = null) {
    document.getElementById('carModal').style.display = 'flex';
    document.getElementById('carForm').reset();
    resetDropZones();

    if (mode === 'edit' && carId) {
        document.getElementById('modalTitle').innerText = 'Editar Vehículo';
        document.getElementById('editCarId').value = carId;

        // Populate Data
        const cars = window.store.getAllCars();
        const car = cars.find(c => c.id === carId);
        if (car) {
            const form = document.getElementById('carForm');
            form.brand.value = car.brand;
            form.model.value = car.model;
            form.year.value = car.year;
            form.price.value = car.price;
            form.km.value = car.km || '';
            form.fuel.value = car.fuel;
            form.transmission.value = car.transmission;
            form.description.value = car.description || '';
            form.sold.value = car.sold.toString();

            // Populate Images (Hidden Inputs + Previews)
            if (car.image) updatePreviewFromUrl(car.image, 'mainPreview', 'finalImageSrc');
            if (car.logo) updatePreviewFromUrl(car.logo, 'logoPreview', 'finalLogoSrc');
        }
    } else {
        document.getElementById('modalTitle').innerText = 'Nuevo Vehículo';
        document.getElementById('editCarId').value = '';
    }
}

function closeModal() {
    document.getElementById('carModal').style.display = 'none';
}

// Global scope
window.submitCarForm = function () {
    const form = document.getElementById('carForm');
    const formData = new FormData(form);

    const carData = {
        brand: formData.get('brand'),
        model: formData.get('model'),
        year: formData.get('year'),
        fuel: formData.get('fuel'),
        transmission: formData.get('transmission'),
        price: formData.get('price'),
        km: formData.get('km'),
        image: document.getElementById('finalImageSrc').value,
        logo: document.getElementById('finalLogoSrc').value,
        description: formData.get('description'),
        sold: formData.get('sold') === 'true'
    };

    const editId = document.getElementById('editCarId').value;

    // Defensive Logic: If editing and image fields are empty, keep original data
    if (editId) {
        const cars = window.store.getAllCars();
        const originalCar = cars.find(c => c.id === editId);
        if (originalCar) {
            if (!carData.image) carData.image = originalCar.image;
            if (!carData.logo) carData.logo = originalCar.logo;
        }
        window.store.updateCar(editId, carData);
    } else {
        window.store.addCar(carData);
    }

    closeModal();
    renderAdminInventory();
};

window.deleteCar = function (id) {
    if (confirm('¿Eliminar vehículo?')) {
        window.store.deleteCar(id);
        renderAdminInventory();
    }
};

window.editCar = function (id) {
    openModal('edit', id);
};

// --- DRAG & DROP SORTING ---
window.toggleSortMode = function () {
    isSortMode = !isSortMode;
    renderAdminInventory(); // Re-render to add/remove draggable attributes
};

function handleDragStart(e) {
    if (!isSortMode) return;
    draggedItem = this;
    this.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
}

function handleDragOver(e) {
    if (!isSortMode) return;
    e.preventDefault();
    const item = e.target.closest('.admin-card');
    if (item && item !== draggedItem) {
        // Simple swap logic visualization could go here
    }
}

function handleDrop(e) {
    if (!isSortMode) return;
    e.preventDefault();
    const targetItem = e.target.closest('.admin-card');

    if (targetItem && targetItem !== draggedItem) {
        const list = document.getElementById('inventory-list');
        // Swap DOM
        // Basic strategy: find indices and swap in store
        const allItems = Array.from(list.children);
        const fromIndex = allItems.indexOf(draggedItem);
        const toIndex = allItems.indexOf(targetItem);

        let cars = window.store.getAllCars();
        // Remove from old index
        const [movedCar] = cars.splice(fromIndex, 1);
        // Insert at new index
        cars.splice(toIndex, 0, movedCar);

        window.store.setCars(cars);
        renderAdminInventory();
    }
}

function handleDragEnd() {
    if (draggedItem) draggedItem.classList.remove('dragging');
    draggedItem = null;
}


// --- FILE HANDLING (Base64) ---
function setupDropZones() {
    ['main', 'logo'].forEach(type => {
        const zone = document.getElementById(`${type}DropZone`);
        const input = document.getElementById(`${type}ImageInput`);

        zone.addEventListener('dragover', (e) => {
            e.preventDefault();
            zone.classList.add('dragover');
        });

        zone.addEventListener('dragleave', () => zone.classList.remove('dragover'));

        zone.addEventListener('drop', (e) => {
            e.preventDefault();
            zone.classList.remove('dragover');
            handleFile(e.dataTransfer.files[0], type);
        });

        input.addEventListener('change', (e) => {
            handleFile(e.target.files[0], type);
        });
    });
}

function handleFile(file, type) {
    if (!file || !file.type.startsWith('image/')) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        const base64 = e.target.result;
        // Update hidden input
        const hiddenInput = type === 'main' ? 'finalImageSrc' : 'finalLogoSrc';
        document.getElementById(hiddenInput).value = base64;

        // Update Preview
        const previewId = type === 'main' ? 'mainPreview' : 'logoPreview';
        const previewEl = document.getElementById(previewId);
        previewEl.src = base64;
        previewEl.classList.add('active');
    };
    reader.readAsDataURL(file);
}

function resetDropZones() {
    document.querySelectorAll('.drop-zone-preview').forEach(el => {
        el.src = '';
        el.classList.remove('active');
    });
    document.querySelectorAll('.drop-zone').forEach(el => el.classList.remove('dragover'));
}

// Create global wrapper for the inline onchange event in HTML
window.updatePreviewFromUrl = function (url, previewId, hiddenInputId) {
    if (!url) return;
    document.getElementById(hiddenInputId).value = url;
    const p = document.getElementById(previewId);
    p.src = url;
    p.classList.add('active');
};
