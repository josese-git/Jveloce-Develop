/**
 * Admin.js - Advanced Logic (Drag&Drop, Menus, Edit, Files)
 */
import store from './store.js';
import { storage, ref, uploadBytes, getDownloadURL } from './firebase-config.js';

let activeMenuId = null;
let isSortMode = false;
let draggedItem = null;
// Local cache of cars for drag & drop and editing
let currentCars = [];

document.addEventListener('DOMContentLoaded', () => {
    if (window.auth && !window.auth.isAuthenticated()) {
        window.location.href = 'login.html';
        return;
    }

    // Subscribe to store updates
    store.subscribe((cars) => {
        currentCars = cars;
        renderAdminInventory(cars);
    });

    setupDropZones();

    // Close menus when clicking outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.menu-trigger') && !e.target.closest('.card-menu')) {
            closeAllMenus();
        }
    });
});

// --- RENDER LOGIC ---
function renderAdminInventory(cars) {
    const list = document.getElementById('inventory-list');
    list.innerHTML = '';

    if (cars.length === 0) {
        list.innerHTML = '<p style="color:white;">Esperando datos...</p>';
        return;
    }

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
window.toggleMenu = function (id, event) {
    event.stopPropagation();
    const menu = document.getElementById(`menu-${id}`);
    const isVisible = menu.classList.contains('visible');
    closeAllMenus();
    if (!isVisible) {
        menu.classList.add('visible');
    }
};

function closeAllMenus() {
    document.querySelectorAll('.card-menu').forEach(m => m.classList.remove('visible'));
}

// --- MODAL & FORM LOGIC ---
window.openModal = function (mode = 'create', carId = null) {
    document.getElementById('carModal').style.display = 'flex';
    document.getElementById('carForm').reset();
    resetDropZones();

    if (mode === 'edit' && carId) {
        document.getElementById('modalTitle').innerText = 'Editar Vehículo';
        document.getElementById('editCarId').value = carId;

        // Populate Data from local cache
        const car = currentCars.find(c => c.id === carId);
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
            form.logoSize.value = car.logoSize || 100;
            form.logoMargin.value = car.logoMargin || '';

            // Populate Images (Hidden Inputs + Previews)
            if (car.image) updatePreviewFromUrl(car.image, 'mainPreview', 'finalImageSrc');
            if (car.logo) updatePreviewFromUrl(car.logo, 'logoPreview', 'finalLogoSrc');

            // Populate Gallery
            galleryFiles = car.gallery || [];
            renderGallery();
        }
    } else {
        document.getElementById('modalTitle').innerText = 'Nuevo Vehículo';
        document.getElementById('editCarId').value = '';
        galleryFiles = [];
        renderGallery();
    }
};

window.closeModal = function () {
    document.getElementById('carModal').style.display = 'none';
};

// Helper to convert Base64 to Blob
function dataURItoBlob(dataURI) {
    // Check if it's already a URL (http/https), if so return null (no upload needed)
    if (!dataURI || dataURI.startsWith('http')) return null;

    const byteString = atob(dataURI.split(',')[1]);
    const mimeString = dataURI.split(',')[0].split(':')[1].split(';')[0];
    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);
    for (let i = 0; i < byteString.length; i++) {
        ia[i] = byteString.charCodeAt(i);
    }
    return new Blob([ab], { type: mimeString });
}

// Helper to upload file to Storage
async function uploadImageToStorage(blob, brand, model, type, index = 0) {
    if (!blob) return null;
    const timestamp = Date.now();
    // Folder structure: anuncios/Kia/Sportage/timestamp_type.png
    // Sanitize brand/model
    const safeBrand = brand.replace(/\s+/g, '_');
    const safeModel = model.replace(/\s+/g, '_');

    // Construct Path
    // Type can be 'main', 'logo', 'gallery_0', 'gallery_1'...
    const filename = `${timestamp}_${type}.png`;
    const storageRef = ref(storage, `anuncios/${safeBrand}/${safeModel}/${filename}`);

    await uploadBytes(storageRef, blob);
    return await getDownloadURL(storageRef);
}

// Global scope
window.submitCarForm = async function () {
    const btn = document.querySelector('button[onclick="submitCarForm()"]');
    const originalText = btn.innerText;
    btn.innerText = "Subiendo imágenes...";
    btn.disabled = true;

    try {
        const form = document.getElementById('carForm');
        const formData = new FormData(form);

        // Validation
        const brand = formData.get('brand');
        const model = formData.get('model');
        if (!brand || !model) throw new Error("Marca y Modelo son obligatorios para subir imágenes.");

        // Get Current Base64 Values
        const mainImageBase64 = document.getElementById('finalImageSrc').value;
        const logoImageBase64 = document.getElementById('finalLogoSrc').value;

        // Process Uploads
        let mainImageUrl = mainImageBase64;
        let logoImageUrl = logoImageBase64;

        // 1. Upload Main Image
        const mainBlob = dataURItoBlob(mainImageBase64);
        if (mainBlob) {
            mainImageUrl = await uploadImageToStorage(mainBlob, brand, model, 'main');
        }

        // 2. Upload Logo
        const logoBlob = dataURItoBlob(logoImageBase64);
        if (logoBlob) {
            logoImageUrl = await uploadImageToStorage(logoBlob, brand, model, 'logo');
        }

        // 3. Upload Gallery
        // galleryFiles is an array of Base64 strings. We need to upload changed ones.
        // To keep it simple, if it's base64, upload it. If it's URL, keep it.
        const newGalleryUrls = [];
        for (let i = 0; i < galleryFiles.length; i++) {
            const fileBase64 = galleryFiles[i];
            const fileBlob = dataURItoBlob(fileBase64);
            if (fileBlob) {
                const url = await uploadImageToStorage(fileBlob, brand, model, `gallery_${i}`);
                newGalleryUrls.push(url);
            } else {
                newGalleryUrls.push(fileBase64); // Assume it's already a URL
            }
        }

        const carData = {
            brand: brand,
            model: model,
            year: formData.get('year'),
            fuel: formData.get('fuel'),
            transmission: formData.get('transmission'),
            price: formData.get('price'),
            km: formData.get('km'),
            image: mainImageUrl, // Saved as URL
            logo: logoImageUrl,  // Saved as URL
            logoSize: formData.get('logoSize') || 100,
            logoMargin: formData.get('logoMargin'),
            description: formData.get('description'),
            sold: formData.get('sold') === 'true',
            gallery: newGalleryUrls
        };

        const editId = document.getElementById('editCarId').value;

        // Logic for edit mode... (keeping existing, but images are now URLs)
        if (editId) {
            await store.updateCar(editId, carData);
        } else {
            await store.addCar(carData);
        }

        closeModal();
    } catch (error) {
        console.error("Error saving car:", error);
        alert("Error al guardar: " + error.message);
    } finally {
        btn.innerText = originalText;
        btn.disabled = false;
    }
};

window.deleteCar = async function (id) {
    if (confirm('¿Eliminar vehículo?')) {
        try {
            await store.deleteCar(id);
        } catch (error) {
            console.error("Error deleting car:", error);
            alert("Error al eliminar: " + error.message);
        }
    }
};

window.editCar = function (id) {
    openModal('edit', id);
};

// --- DRAG & DROP SORTING ---
window.toggleSortMode = function () {
    isSortMode = !isSortMode;
    renderAdminInventory(currentCars); // Re-render to add/remove draggable attributes
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
    e.dataTransfer.dropEffect = 'move';
}

function handleDrop(e) {
    if (!isSortMode) return;
    e.preventDefault();
    const targetItem = e.target.closest('.admin-card');

    if (targetItem && targetItem !== draggedItem) {
        const draggedId = draggedItem.dataset.id;
        const targetId = targetItem.dataset.id;

        const fromIndex = currentCars.findIndex(c => c.id === draggedId);
        const toIndex = currentCars.findIndex(c => c.id === targetId);

        if (fromIndex === -1 || toIndex === -1) {
            console.error("Indices not found for", draggedId, targetId);
            return;
        }

        // Modify local cache order
        const [movedCar] = currentCars.splice(fromIndex, 1);
        currentCars.splice(toIndex, 0, movedCar);

        // Optimistic UI Update
        renderAdminInventory(currentCars);

        // Persist to Firestore
        store.reorderCars(currentCars).catch(err => {
            console.error(err);
            alert('Error al guardar el nuevo orden: ' + err.message);
        });
    }
}

function handleDragEnd() {
    if (draggedItem) draggedItem.classList.remove('dragging');
    draggedItem = null;
}


// --- FILE HANDLING & EDITOR ---
let cropper = null;
let activeEditorType = null; // 'main' | 'logo' | 'gallery'
// We use a local array `galleryFiles` (Base64 strings)
let galleryFiles = [];

function setupDropZones() {
    ['main', 'logo', 'gallery'].forEach(type => {
        const zone = document.getElementById(`${type}DropZone`);
        const input = document.getElementById(`${type}ImageInput`) || document.getElementById(`${type}Input`);

        if (!zone || !input) return;

        zone.addEventListener('dragover', (e) => {
            e.preventDefault();
            zone.classList.add('dragover');
        });

        zone.addEventListener('dragleave', () => zone.classList.remove('dragover'));

        zone.addEventListener('drop', (e) => {
            e.preventDefault();
            zone.classList.remove('dragover');
            const files = e.dataTransfer.files;
            if (files.length > 0) handleEditorOpen(files[0], type);
        });

        input.addEventListener('change', (e) => {
            if (e.target.files.length > 0) handleEditorOpen(e.target.files[0], type);
        });
    });
}

function handleEditorOpen(file, type) {
    // ENFORCE BRAND/MODEL Check
    const brand = document.getElementById('carForm').brand.value;
    const model = document.getElementById('carForm').model.value;

    if (!brand || !model) {
        alert("⚠️ Por favor, introduce la Marca y el Modelo antes de subir imágenes.");
        return;
    }

    if (!file || !file.type.startsWith('image/')) return;

    // ... rest of function
    const reader = new FileReader();
    reader.onload = (e) => {
        const url = e.target.result;
        // Open Editor Modal
        const editorModal = document.getElementById('editorModal');
        const editorImage = document.getElementById('editorImage');

        editorImage.src = url;
        editorModal.style.display = 'flex';

        // Destroy prev instance if exists
        if (cropper) cropper.destroy();

        // Init Cropper
        cropper = new Cropper(editorImage, {
            viewMode: 2, // Restrict crop to image bounds
            autoCropArea: 0.9,
            responsive: true,
            background: false, // Dark background from CSS
        });
    };
    reader.readAsDataURL(file);
}

window.closeEditor = function () {
    document.getElementById('editorModal').style.display = 'none';
    if (cropper) cropper.destroy();
    cropper = null;
    document.getElementById('editorImage').src = '';
};

window.editorFlipX = function () {
    if (!cropper) return;
    const data = cropper.getData();
    cropper.scaleX(data.scaleX === -1 ? 1 : -1);
};

window.editorSave = function () {
    if (!cropper) return;

    // Get cropped canvas
    const canvas = cropper.getCroppedCanvas({
        maxWidth: 1200,
        maxHeight: 1200,
        // fillColor property removed to default to transparent (empty)
    });

    const base64 = canvas.toDataURL('image/png'); // PNG to preserve transparency

    if (activeEditorType === 'gallery') {
        addGalleryImage(base64);
    } else {
        // Main or Logo
        const hiddenInputId = activeEditorType === 'main' ? 'finalImageSrc' : 'finalLogoSrc';
        const previewId = activeEditorType === 'main' ? 'mainPreview' : 'logoPreview';

        document.getElementById(hiddenInputId).value = base64;
        const p = document.getElementById(previewId);
        p.src = base64;
        p.classList.add('active');
    }

    closeEditor();
};

// --- GALLERY LOGIC ---
function addGalleryImage(base64) {
    galleryFiles.push(base64);
    renderGallery();
}

window.removeGalleryImage = function (index) {
    galleryFiles.splice(index, 1);
    renderGallery();
};

function renderGallery() {
    const grid = document.getElementById('galleryGrid');
    grid.innerHTML = '';

    galleryFiles.forEach((src, index) => {
        const thumb = document.createElement('div');
        thumb.style.position = 'relative';
        thumb.style.aspectRatio = '16/9';
        thumb.style.borderRadius = '4px';
        thumb.style.overflow = 'hidden';
        thumb.style.border = '1px solid #333';

        thumb.innerHTML = `
            <img src="${src}" style="width:100%; height:100%; object-fit:cover;">
            <div onclick="removeGalleryImage(${index})" 
                 style="position:absolute; top:2px; right:2px; background:rgba(0,0,0,0.7); 
                 color:#ff5555; width:20px; height:20px; display:flex; align-items:center; 
                 justify-content:center; cursor:pointer; font-size:12px; border-radius:50%;">×</div>
        `;
        grid.appendChild(thumb);
    });
}

// Open editor from existing preview (Edit button)
// Open editor from existing preview (Edit button)
window.openEditorFromPreview = function (type) {
    console.log("openEditorFromPreview called with:", type);
    const hiddenInputId = type === 'main' ? 'finalImageSrc' : 'finalLogoSrc';
    const currentSrc = document.getElementById(hiddenInputId).value;

    console.log("Current Source:", currentSrc ? currentSrc.substring(0, 50) + "..." : "EMPTY");

    if (!currentSrc) {
        alert("No hay imagen seleccionada para editar.");
        return;
    }

    // Re-use logic: convert src to blob or just use url if it works
    // Cropper works with URLs so:
    activeEditorType = type;
    const editorModal = document.getElementById('editorModal');
    const editorImage = document.getElementById('editorImage');

    editorImage.src = currentSrc;
    editorModal.style.display = 'flex';

    if (cropper) cropper.destroy();

    try {
        cropper = new Cropper(editorImage, {
            viewMode: 2,
            autoCropArea: 0.9,
            responsive: true,
            background: false,
        });
    } catch (err) {
        console.error("Cropper init failed:", err);
    }
};

function resetDropZones() {
    document.querySelectorAll('.drop-zone-preview').forEach(el => {
        el.src = '';
        el.classList.remove('active');
    });
    document.querySelectorAll('.drop-zone').forEach(el => el.classList.remove('dragover'));
    document.getElementById('galleryGrid').innerHTML = '';
}

// Create global wrapper for the inline onchange event in HTML
window.updatePreviewFromUrl = function (url, previewId, hiddenInputId) {
    if (!url) return;
    document.getElementById(hiddenInputId).value = url;
    const p = document.getElementById(previewId);
    p.src = url;
    p.classList.add('active');
};

