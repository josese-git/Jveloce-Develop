/**
 * App.js - Main Render Logic for Home Page
 */

document.addEventListener('DOMContentLoaded', () => {
    renderInventory();
});

function renderInventory() {
    const container = document.querySelector('.car-grid');
    if (!container) return;

    // Get cars from the store (this will load defaults if first time)
    const cars = window.store.getAllCars();
    container.innerHTML = ''; // Clear static content

    cars.forEach(car => {

        // Determine Logo Class (wide or normal)
        // If logoClass is defined in data use it, otherwise default logic could go here
        const logoClass = car.logoClass ? `brand-logo-floating ${car.logoClass}` : 'brand-logo-floating';

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
                <img src="${car.logo}" alt="${car.brand}" class="${logoClass}">
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

    // Re-init Tilt if using a library (vanilla-tilt.js), otherwise CSS handle hover
    // logic here if we add JS tilt later
}
