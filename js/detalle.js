/**
 * Detalle.js - Dynamic Vehicle Detail Page
 * Loads vehicle data from Firebase based on URL parameter
 */

import { db } from './firebase-config.js';
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

const COLLECTION_NAME = 'anuncios';

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Get vehicle ID from URL
    const urlParams = new URLSearchParams(window.location.search);
    const vehicleId = urlParams.get('id');

    if (!vehicleId) {
        showError('No se especificó ningún vehículo');
        return;
    }

    try {
        // 2. Fetch vehicle data from Firebase
        const docRef = doc(db, COLLECTION_NAME, vehicleId);
        const docSnap = await getDoc(docRef);

        if (!docSnap.exists()) {
            showError('Vehículo no encontrado');
            return;
        }

        const car = docSnap.data();

        // 3. Inject data into HTML
        populateVehicleData(car);

        // Populate gallery with exterior and interior arrays separately
        populateGallery(car.galleryExterior || [], car.galleryInterior || []);

    } catch (error) {
        console.error('Error loading vehicle:', error);
        showError('Error al cargar el vehículo');
    }
});

/**
 * Populate vehicle data into HTML elements
 */
function populateVehicleData(car) {
    // Page Title
    document.title = `${car.brand} ${car.model} | Autos JVeloce`;

    // Hero Section
    const heroImg = document.getElementById('heroCarImg');
    const heroLoader = document.getElementById('heroLoader');

    if (heroImg && car.image) {
        heroImg.onload = () => {
            // Hide loader, show image
            if (heroLoader) heroLoader.classList.add('hidden');
            heroImg.style.display = 'block';
        };
        heroImg.src = car.image;
        heroImg.alt = `${car.brand} ${car.model}`;
    }

    // Price
    const priceEl = document.getElementById('heroPrice');
    if (priceEl) {
        // Format price with euro symbol
        const formattedPrice = formatPrice(car.price);
        priceEl.innerHTML = `<span class="text-gold">€</span><span class="text-gold">${formattedPrice}</span>`;
    }

    // Title (Brand + Model)
    const brandEl = document.getElementById('carBrand');
    const modelEl = document.getElementById('carModel');
    if (brandEl) brandEl.textContent = car.brand || '';
    if (modelEl) modelEl.textContent = car.model || '';

    // Description
    const descEl = document.getElementById('carDescription');
    if (descEl) {
        if (car.description && car.description.trim() !== '') {
            // Convert line breaks to <br> tags
            descEl.innerHTML = car.description.replace(/\n/g, '<br>');
        } else {
            descEl.innerHTML = `${car.brand} ${car.model} ${car.year}. Vehículo en excelente estado.<br>
                Para más información contactar con nosotros.`;
        }
    }

    // Specifications
    const specKm = document.getElementById('specKm');
    const specFuel = document.getElementById('specFuel');
    const specTransmission = document.getElementById('specTransmission');
    const specCV = document.getElementById('specCV');

    if (specKm) specKm.textContent = car.km || 'N/D';
    if (specFuel) specFuel.textContent = car.fuel || 'N/D';
    if (specTransmission) {
        const transmissionDisplay = car.transmission === 'Auto' ? 'Automático' : (car.transmission || 'N/D');
        specTransmission.textContent = transmissionDisplay;
    }
    if (specCV) specCV.textContent = car.cv ? `${car.cv} CV` : 'N/D';
}

/**
 * Format price for display
 */
function formatPrice(price) {
    if (!price) return '0';
    // Remove any existing currency symbols or spaces
    let numericPrice = price.toString().replace(/[€\s]/g, '');
    // Add thousand separators
    return numericPrice.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/**
 * Populate gallery with images using asymmetric layout
 * Structure: Block A (2+1), Block B (2), Block C (3 interior), Block D (up to 6 interior)
 */
function populateGallery(exteriorImages, interiorImages) {
    const container = document.getElementById('galleryContainer');
    if (!container) return;

    // Filter out null values
    const exterior = (exteriorImages || []).filter(img => img !== null);
    const interior = interiorImages || [];

    // If no gallery images, hide the gallery section
    if (exterior.length === 0 && interior.length === 0) {
        const galleryTitle = document.getElementById('galleryTitle');
        if (galleryTitle) galleryTitle.style.display = 'none';
        container.style.display = 'none';
        return;
    }

    // Clear existing content
    container.innerHTML = '';

    // === BLOCK A: Exterior - 2 stacked left + 1 large right ===
    if (exterior.length >= 3) {
        const blockA = document.createElement('div');
        blockA.className = 'gallery-block block-a';
        blockA.innerHTML = `
            <div class="col-left-stacked">
                <div class="gallery-item"><img src="${exterior[0]}" alt="Frontal"></div>
                <div class="gallery-item"><img src="${exterior[1]}" alt="3/4 Frontal"></div>
            </div>
            <div class="col-right-main">
                <div class="gallery-item main-img"><img src="${exterior[2]}" alt="Lateral"></div>
            </div>
        `;
        container.appendChild(blockA);
    } else if (exterior.length > 0) {
        // If less than 3, show in simple grid
        const blockA = document.createElement('div');
        blockA.className = 'gallery-block block-b';
        exterior.slice(0, Math.min(exterior.length, 2)).forEach((img, i) => {
            const item = document.createElement('div');
            item.className = 'gallery-item';
            item.innerHTML = `<img src="${img}" alt="Exterior ${i + 1}">`;
            blockA.appendChild(item);
        });
        container.appendChild(blockA);
    }

    // === BLOCK B: Exterior - 2 horizontal (photos 4 and 5) ===
    if (exterior.length >= 4) {
        const blockB = document.createElement('div');
        blockB.className = 'gallery-block block-b';
        const photo4 = exterior[3] ? `<div class="gallery-item"><img src="${exterior[3]}" alt="3/4 Trasero"></div>` : '';
        const photo5 = exterior[4] ? `<div class="gallery-item"><img src="${exterior[4]}" alt="Trasero"></div>` : '';
        blockB.innerHTML = photo4 + photo5;
        container.appendChild(blockB);
    }

    // === BLOCK C: Interior - First 3 photos in horizontal ===
    if (interior.length >= 1) {
        const blockC = document.createElement('div');
        blockC.className = 'gallery-block block-c';
        interior.slice(0, 3).forEach((img, i) => {
            const item = document.createElement('div');
            item.className = 'gallery-item';
            item.innerHTML = `<img src="${img}" alt="Interior ${i + 1}">`;
            blockC.appendChild(item);
        });
        container.appendChild(blockC);
    }

    // === BLOCK D: Interior - Remaining photos (4-9) in 3-column grid ===
    if (interior.length > 3) {
        const blockD = document.createElement('div');
        blockD.className = 'gallery-block block-d';
        interior.slice(3).forEach((img, i) => {
            const item = document.createElement('div');
            item.className = 'gallery-item';
            item.innerHTML = `<img src="${img}" alt="Detalle ${i + 1}">`;
            blockD.appendChild(item);
        });
        container.appendChild(blockD);
    }

    // Initialize lightbox for dynamically added images
    initLightbox();
}

/**
 * Initialize lightbox for gallery images
 */
function initLightbox() {
    const lightbox = document.getElementById('lightbox');
    const lightboxImg = document.getElementById('lightbox-img');
    const closeBtn = document.querySelector('.lightbox-close');
    const prevBtn = document.querySelector('.lightbox-prev');
    const nextBtn = document.querySelector('.lightbox-next');
    const counter = document.querySelector('.lightbox-counter');

    if (!lightbox || !lightboxImg) return;

    // Select all images from the gallery blocks
    const galleryItems = Array.from(document.querySelectorAll('.gallery-item img'));

    if (galleryItems.length === 0) return;

    let currentIndex = 0;
    let isZoomed = false;

    // Open Lightbox on image click
    galleryItems.forEach((img, index) => {
        img.style.cursor = 'pointer';
        img.addEventListener('click', () => {
            currentIndex = index;
            lightboxImg.src = img.src;
            lightbox.classList.add('active');
            document.body.style.overflow = 'hidden';
            updateCounter();
        });
    });

    function updateCounter() {
        if (counter) {
            counter.textContent = `${currentIndex + 1} de ${galleryItems.length}`;
        }
    }

    function closeLightbox() {
        lightbox.classList.remove('active');
        document.body.style.overflow = '';
        lightboxImg.classList.remove('zoomed');
        isZoomed = false;
    }

    function showNext() {
        currentIndex = (currentIndex + 1) % galleryItems.length;
        lightboxImg.src = galleryItems[currentIndex].src;
        lightboxImg.classList.remove('zoomed');
        isZoomed = false;
        updateCounter();
    }

    function showPrev() {
        currentIndex = (currentIndex - 1 + galleryItems.length) % galleryItems.length;
        lightboxImg.src = galleryItems[currentIndex].src;
        lightboxImg.classList.remove('zoomed');
        isZoomed = false;
        updateCounter();
    }

    // Event Listeners
    closeBtn.addEventListener('click', closeLightbox);

    if (prevBtn) prevBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        showPrev();
    });

    if (nextBtn) nextBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        showNext();
    });

    lightbox.addEventListener('click', (e) => {
        if (e.target === lightbox || e.target.classList.contains('lightbox-content')) {
            closeLightbox();
        }
    });

    // Click image to zoom
    lightboxImg.addEventListener('click', (e) => {
        e.stopPropagation();
        if (isZoomed) {
            lightboxImg.classList.remove('zoomed');
            isZoomed = false;
        } else {
            lightboxImg.classList.add('zoomed');
            isZoomed = true;
        }
    });

    // Keyboard Navigation
    document.addEventListener('keydown', (e) => {
        if (!lightbox.classList.contains('active')) return;
        if (e.key === 'Escape') closeLightbox();
        if (e.key === 'ArrowRight') showNext();
        if (e.key === 'ArrowLeft') showPrev();
    });
}

/**
 * Show error message
 */
function showError(message) {
    const heroData = document.querySelector('.hero-data');
    if (heroData) {
        heroData.innerHTML = `
            <div style="text-align: center; padding: 50px;">
                <h2 style="color: #ff5555;">⚠️ ${message}</h2>
                <p style="color: #888; margin-top: 20px;">
                    <a href="../index.html" style="color: var(--gold-primary);">Volver al inicio</a>
                </p>
            </div>
        `;
    }
}
