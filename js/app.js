/**
 * App.js - Main Render Logic for Home Page
 */

// Note: Ensure this is treated as a module in HTML
import store from './store.js';

document.addEventListener('DOMContentLoaded', () => {
    // Determine which page we are on and init appropriately
    // The main page uses index.html, which has this script
    // We subscribe to the store to get real-time updates
    store.subscribe((cars) => {
        renderInventory(cars);
    });
});

function renderInventory(cars) {
    const container = document.querySelector('.car-grid');
    if (!container) return;

    container.innerHTML = ''; // Clear content

    if (cars.length === 0) {
        container.innerHTML = '<p style="color:white;text-align:center;">Cargando vehículos...</p>';
        return;
    }

    cars.forEach(car => {

        // Determine Logo Class (wide or normal)
        // Determine Logo Class (wide or normal)
        const isWide = car.logoClass && car.logoClass.includes('wide');
        const logoClass = isWide ? `brand-logo-floating ${car.logoClass}` : 'brand-logo-floating';

        // Calculate Logo Size
        // standard: 80x80, wide: 200x100
        const baseW = isWide ? 200 : 80;
        const baseH = isWide ? 100 : 80;

        const scale = car.logoSize ? (parseFloat(car.logoSize) / 100) : 1;
        const style = `width: ${baseW * scale}px; height: ${baseH * scale}px;`;

        // Sold Overlay
        const soldOverlay = car.sold ? '<img src="assets/vendido.png" class="sold-overlay-img" alt="Vendido">' : '';

        const card = document.createElement('div');
        card.className = `car-card glass-panel ${car.sold ? 'sold' : ''}`;
        card.setAttribute('data-tilt', ''); // Tilt.js attribute

        card.innerHTML = `
            <div class="card-image-wrapper">
                ${soldOverlay}
                <img src="${car.image}" alt="${car.brand} ${car.model}" class="car-image">
            </div>

            <div class="card-details">
                <img src="${car.logo}" alt="${car.brand}" class="${logoClass}" style="${style}">
                <h3 class="car-model">${car.brand} ${car.model}</h3>
                <div class="car-specs">
                    <span>${car.year}</span>
                    <span>${car.fuel}</span>
                    <span>${car.transmission}</span>
                    ${car.km ? `<span>${car.km}</span>` : ''}
                </div>
            </div>
            <div class="card-glow"></div>
        `;

        container.appendChild(card);
    });
}
