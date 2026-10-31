/**
 * App.js - Main Render Logic for Home Page
 * Dark Luxury Edition: 3D Coverflow Carousel, Custom Glassmorphic Filters & 9-by-9 Pagination
 */

import store from './store.js';

const CARS_PER_PAGE = 9;
let visibleCarsCount = 9;
let allVehicles = [];

const activeFilters = {
    brand: 'all',
    year: 'all',
    fuel: 'all',
    transmission: 'all'
};

const normalizeStr = (str) => (str || '').toString().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

/**
 * Check if vehicle is marked as sold across possible Firestore fields
 */
function isVehicleSold(car) {
    if (!car) return false;
    if (Boolean(car.sold || car.vendido || car.isSold)) return true;
    const str = `${car.status || ''} ${car.estado || ''} ${car.price || ''}`.toLowerCase();
    return str.includes('vendido');
}

/**
 * Filter matchers
 */
function matchBrand(car, filterBrand) {
    if (!filterBrand || filterBrand === 'all') return true;
    return normalizeStr(car.brand) === normalizeStr(filterBrand);
}

function matchYear(car, filterYear) {
    if (!filterYear || filterYear === 'all') return true;
    return String(car.year || '').trim() === String(filterYear).trim();
}

function matchFuel(car, filterFuel) {
    if (!filterFuel || filterFuel === 'all') return true;
    const f = normalizeStr(car.fuel);
    if (filterFuel === 'diesel') {
        return f.includes('diesel') || f.includes('gasoil');
    }
    if (filterFuel === 'gasolina') {
        return f.includes('gasolina');
    }
    if (filterFuel === 'hibrido') {
        return f.includes('hibrido') || f.includes('hev') || f.includes('phev') || f.includes('electrico') || f.includes('eco');
    }
    return true;
}

function matchTransmission(car, filterTransmission) {
    if (!filterTransmission || filterTransmission === 'all') return true;
    const t = normalizeStr(car.transmission);
    if (filterTransmission === 'manual') {
        return t.includes('manual');
    }
    if (filterTransmission === 'automatico') {
        return t.includes('automatico') || t.includes('auto');
    }
    return true;
}

/**
 * Helper para enrutamiento de detalle de coche:
 * En local (Live Server u otros puertos != 5000) apunta a Coches/detalle-app.html
 * En producción (autosjveloce.com) y Firebase Emulator (:5000) apunta a Coches/detalle.html para SSR
 */
const getCarDetailUrl = (carId) => {
    const isLocalStaticServer = (window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost') && window.location.port !== '5000';
    const baseFile = isLocalStaticServer ? 'Coches/detalle-app.html' : 'Coches/detalle.html';
    return `${baseFile}?id=${encodeURIComponent(carId)}`;
};

/**
 * Car Card Generator (Intact original styling & tilt interaction)
 */
function createCarCard(car) {
    const isWide = car.logoClass && car.logoClass.includes('wide');
    const logoClass = isWide ? `brand-logo-floating ${car.logoClass}` : 'brand-logo-floating';

    const baseW = isWide ? 200 : 80;
    const baseH = isWide ? 100 : 80;

    const scale = car.logoSize ? (parseFloat(car.logoSize) / 100) : 1;
    let style = `width: ${baseW * scale}px; height: ${baseH * scale}px;`;

    if (car.logoMargin !== undefined && car.logoMargin !== "" && car.logoMargin !== null) {
        style += ` margin-bottom: ${car.logoMargin}px;`;
    }

    const isSold = isVehicleSold(car);
    const soldOverlay = isSold ? '<img src="assets/vendido.png" class="sold-overlay-img" alt="Vendido">' : '';

    const card = document.createElement('div');
    card.className = `car-card glass-panel ${isSold ? 'sold' : ''}`;
    card.setAttribute('data-tilt', '');

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

    card.style.cursor = 'pointer';
    card.addEventListener('click', () => {
        window.location.href = getCarDetailUrl(car.id);
    });

    // 3D Tilt Effect on hover
    card.addEventListener('mousemove', (e) => {
        const rect = card.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;
        const rotateX = ((y - centerY) / centerY) * -10;
        const rotateY = ((x - centerX) / centerX) * 10;
        card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(1.02)`;
    });

    card.addEventListener('mouseleave', () => {
        card.style.transform = 'perspective(1000px) rotateX(0) rotateY(0) scale(1)';
    });

    return card;
}

/**
 * Filter and Render Inventory with 9-by-9 Pagination
 */
function applyFiltersAndRender(isLoadMore = false) {
    const container = document.querySelector('.car-grid');
    if (!container) return;

    const countBadge = document.getElementById('vehicleCountBadge');
    const resetBtn = document.getElementById('resetFiltersBtn');
    const loadMoreContainer = document.getElementById('loadMoreContainer');
    const showSoldToggle = document.getElementById('showSoldToggle');
    const showSold = showSoldToggle ? showSoldToggle.checked : false;

    // Check if initial stock is empty
    if (!allVehicles || allVehicles.length === 0) {
        if (countBadge) countBadge.textContent = '0 vehículos disponibles';
        if (resetBtn) resetBtn.style.display = 'none';
        if (loadMoreContainer) loadMoreContainer.style.display = 'none';

        container.innerHTML = `
            <div style="text-align: center; padding: 50px; grid-column: 1 / -1; width: 100%;">
                <h3 style="color: var(--gold-primary, #d4af37); font-family: 'Orbitron', sans-serif;">Inventario Actualizado</h3>
                <p style="color: #888; margin-top: 10px;">No hay vehículos disponibles en este momento.</p>
            </div>
        `;
        return;
    }

    // Filter vehicles
    const filteredCars = allVehicles.filter(car => {
        // Sold filter: if not checked, hide sold
        if (!showSold && isVehicleSold(car)) return false;

        return matchBrand(car, activeFilters.brand) &&
               matchYear(car, activeFilters.year) &&
               matchFuel(car, activeFilters.fuel) &&
               matchTransmission(car, activeFilters.transmission);
    });

    // Reset button display state
    const isFiltered = activeFilters.brand !== 'all' ||
                       activeFilters.year !== 'all' ||
                       activeFilters.fuel !== 'all' ||
                       activeFilters.transmission !== 'all' ||
                       showSold;

    if (resetBtn) {
        resetBtn.style.display = isFiltered ? 'inline-block' : 'none';
    }

    // Handle 0 results
    if (filteredCars.length === 0) {
        container.classList.remove('grid-single-item', 'grid-two-items');
        if (countBadge) countBadge.textContent = '0 vehículos disponibles';
        if (loadMoreContainer) loadMoreContainer.style.display = 'none';

        container.innerHTML = `
            <div class="glass-panel" style="text-align: center; padding: 45px 25px; grid-column: 1 / -1; width: 100%; border-radius: 18px; border: 1px solid rgba(212, 175, 55, 0.25);">
                <h3 style="color: var(--gold-primary, #d4af37); font-family: 'Orbitron', sans-serif; font-size: 1.2rem; margin-bottom: 12px; letter-spacing: 1px;">Sin resultados</h3>
                <p style="color: #b8b8b8; font-family: 'Rajdhani', sans-serif; font-size: 1.1rem; margin-bottom: 22px;">No hay vehículos en stock con esa combinación exacta de filtros.</p>
                <button type="button" class="glass-btn hero-btn-primary" id="emptyResetBtn" style="cursor: pointer; display: inline-flex;">Ver todos los vehículos</button>
            </div>
        `;
        const emptyResetBtn = document.getElementById('emptyResetBtn');
        if (emptyResetBtn) {
            emptyResetBtn.addEventListener('click', resetAllFilters);
        }
        return;
    }

    // Slice to visible count
    const carsToRender = filteredCars.slice(0, visibleCarsCount);

    // Apply single or two items grid modifier classes for centered display
    if (carsToRender.length === 1) {
        container.classList.add('grid-single-item');
        container.classList.remove('grid-two-items');
    } else if (carsToRender.length === 2) {
        container.classList.add('grid-two-items');
        container.classList.remove('grid-single-item');
    } else {
        container.classList.remove('grid-single-item', 'grid-two-items');
    }

    // Update Counter Badge
    if (countBadge) {
        if (filteredCars.length === 1) {
            countBadge.textContent = 'Mostrando 1 vehículo disponible';
        } else {
            countBadge.textContent = `Mostrando ${carsToRender.length} de ${filteredCars.length} vehículos disponibles`;
        }
    }

    // Render Cards
    if (isLoadMore) {
        const currentlyRendered = container.querySelectorAll('.car-card').length;
        const newSlice = filteredCars.slice(currentlyRendered, visibleCarsCount);
        newSlice.forEach(car => {
            const card = createCarCard(car);
            card.classList.add('fade-in-up');
            container.appendChild(card);
        });
    } else {
        container.innerHTML = '';
        carsToRender.forEach(car => {
            container.appendChild(createCarCard(car));
        });
    }

    // Load More Button visibility
    if (loadMoreContainer) {
        if (filteredCars.length > visibleCarsCount) {
            loadMoreContainer.style.display = 'flex';
        } else {
            loadMoreContainer.style.display = 'none';
        }
    }
}

/**
 * Reset all active filters
 */
function resetAllFilters() {
    activeFilters.brand = 'all';
    activeFilters.year = 'all';
    activeFilters.fuel = 'all';
    activeFilters.transmission = 'all';

    const showSoldToggle = document.getElementById('showSoldToggle');
    if (showSoldToggle) showSoldToggle.checked = false;

    // Reset dropdown trigger texts & active options
    const defaults = {
        brand: 'Todas las marcas',
        year: 'Todos los años',
        fuel: 'Todos',
        transmission: 'Todos'
    };

    document.querySelectorAll('.jv-dropdown').forEach(dropdown => {
        const filterType = dropdown.dataset.filter;
        const triggerText = dropdown.querySelector('.jv-selected-text');
        if (triggerText && defaults[filterType]) {
            triggerText.textContent = defaults[filterType];
        }
        dropdown.querySelectorAll('.jv-dropdown-option').forEach(opt => {
            opt.classList.toggle('active', opt.dataset.value === 'all');
        });
    });

    visibleCarsCount = CARS_PER_PAGE;
    applyFiltersAndRender();
}

/**
 * Populate dynamic Brand and Year menus from Firestore cars
 */
function populateDynamicFilterMenus() {
    if (!allVehicles || allVehicles.length === 0) return;

    // Unique Brands sorted alphabetically
    const brands = Array.from(new Set(
        allVehicles
            .map(car => (car.brand || '').trim())
            .filter(Boolean)
    )).sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));

    // Unique Years sorted descending (e.g. 2023, 2021, 2020...)
    const years = Array.from(new Set(
        allVehicles
            .map(car => (car.year || '').toString().trim())
            .filter(y => y && /^\d{4}$/.test(y))
    )).sort((a, b) => parseInt(b, 10) - parseInt(a, 10));

    // Brand Menu
    const brandMenu = document.getElementById('brandDropdownMenu');
    if (brandMenu) {
        brandMenu.innerHTML = `<li class="jv-dropdown-option ${activeFilters.brand === 'all' ? 'active' : ''}" data-value="all">Todas las marcas</li>`;
        brands.forEach(b => {
            const li = document.createElement('li');
            li.className = `jv-dropdown-option ${normalizeStr(activeFilters.brand) === normalizeStr(b) ? 'active' : ''}`;
            li.dataset.value = b;
            li.textContent = b;
            brandMenu.appendChild(li);
        });
    }

    // Year Menu
    const yearMenu = document.getElementById('yearDropdownMenu');
    if (yearMenu) {
        yearMenu.innerHTML = `<li class="jv-dropdown-option ${activeFilters.year === 'all' ? 'active' : ''}" data-value="all">Todos los años</li>`;
        years.forEach(y => {
            const li = document.createElement('li');
            li.className = `jv-dropdown-option ${String(activeFilters.year).trim() === y ? 'active' : ''}`;
            li.dataset.value = y;
            li.textContent = y;
            yearMenu.appendChild(li);
        });
    }
}

/**
 * Initialize Custom Dropdowns, Sold Switch, and Load More Button
 */
function initFilterControls() {
    // Dropdown toggles & option selects
    document.querySelectorAll('.jv-dropdown').forEach(dropdown => {
        const trigger = dropdown.querySelector('.jv-dropdown-trigger');
        const menu = dropdown.querySelector('.jv-dropdown-menu');
        const filterType = dropdown.dataset.filter;

        if (trigger) {
            trigger.addEventListener('click', (e) => {
                e.stopPropagation();
                const isOpen = dropdown.classList.contains('open');

                // Close all dropdowns
                document.querySelectorAll('.jv-dropdown.open').forEach(d => {
                    if (d !== dropdown) d.classList.remove('open');
                });

                dropdown.classList.toggle('open', !isOpen);
            });
        }

        if (menu) {
            menu.addEventListener('click', (e) => {
                const option = e.target.closest('.jv-dropdown-option');
                if (!option) return;

                const value = option.dataset.value;
                activeFilters[filterType] = value;

                // Update trigger text
                const selectedTextSpan = dropdown.querySelector('.jv-selected-text');
                if (selectedTextSpan) {
                    selectedTextSpan.textContent = option.textContent.trim();
                }

                // Update active state in menu
                menu.querySelectorAll('.jv-dropdown-option').forEach(opt => {
                    opt.classList.remove('active');
                });
                option.classList.add('active');

                // Close dropdown
                dropdown.classList.remove('open');

                // Reset page to 9 and render
                visibleCarsCount = CARS_PER_PAGE;
                applyFiltersAndRender();
            });
        }
    });

    // Close dropdowns when clicking outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.jv-dropdown')) {
            document.querySelectorAll('.jv-dropdown.open').forEach(d => {
                d.classList.remove('open');
            });
        }
    });

    // Sold toggle switch
    const showSoldToggle = document.getElementById('showSoldToggle');
    if (showSoldToggle) {
        showSoldToggle.addEventListener('change', () => {
            visibleCarsCount = CARS_PER_PAGE;
            applyFiltersAndRender();
        });
    }

    // Reset filters button
    const resetBtn = document.getElementById('resetFiltersBtn');
    if (resetBtn) {
        resetBtn.addEventListener('click', resetAllFilters);
    }

    // Load More button
    const loadMoreBtn = document.getElementById('loadMoreBtn');
    if (loadMoreBtn) {
        loadMoreBtn.addEventListener('click', () => {
            visibleCarsCount += CARS_PER_PAGE;
            applyFiltersAndRender(true);
        });
    }
}

/**
 * 3D Glassmorphic Coverflow Carousel for Trust Pillars
 */
function initPillarsCarousel() {
    const stage = document.getElementById('pillarsStage');
    const wrapper = document.getElementById('pillarsCarousel');
    if (!stage || !wrapper) return;

    const cards = Array.from(stage.querySelectorAll('.trust-pillar-card'));
    const dots = Array.from(document.querySelectorAll('#pillarsDots .pillar-dot'));
    const prevBtn = document.getElementById('pillarPrevBtn');
    const nextBtn = document.getElementById('pillarNextBtn');

    if (cards.length === 0) return;

    let activePillarIndex = 1; // Start on Kilómetros Certificados (center)
    let autoRotateTimer = null;

    function updatePillarsCarousel() {
        const total = cards.length;
        const prevIndex = (activePillarIndex - 1 + total) % total;
        const nextIndex = (activePillarIndex + 1) % total;

        cards.forEach((card, i) => {
            card.classList.remove('is-active', 'is-prev', 'is-next', 'is-hidden');

            if (i === activePillarIndex) {
                card.classList.add('is-active');
            } else if (i === prevIndex) {
                card.classList.add('is-prev');
            } else if (i === nextIndex) {
                card.classList.add('is-next');
            } else {
                card.classList.add('is-hidden');
            }
        });

        dots.forEach((dot, idx) => {
            dot.classList.toggle('active', idx === activePillarIndex);
        });
    }

    function goToNext() {
        activePillarIndex = (activePillarIndex + 1) % cards.length;
        updatePillarsCarousel();
    }

    function goToPrev() {
        activePillarIndex = (activePillarIndex - 1 + cards.length) % cards.length;
        updatePillarsCarousel();
    }

    function startAutoRotate() {
        stopAutoRotate();
        autoRotateTimer = setInterval(goToNext, 4800);
    }

    function stopAutoRotate() {
        if (autoRotateTimer) {
            clearInterval(autoRotateTimer);
            autoRotateTimer = null;
        }
    }

    // Card click: clicking blurred lateral cards rotates to them
    cards.forEach((card) => {
        card.addEventListener('click', () => {
            if (card.classList.contains('is-prev')) {
                goToPrev();
                startAutoRotate();
            } else if (card.classList.contains('is-next')) {
                goToNext();
                startAutoRotate();
            }
        });
    });

    // Arrow navigation
    if (prevBtn) {
        prevBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            goToPrev();
            startAutoRotate();
        });
    }

    if (nextBtn) {
        nextBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            goToNext();
            startAutoRotate();
        });
    }

    // Dot indicators
    dots.forEach((dot) => {
        dot.addEventListener('click', (e) => {
            e.stopPropagation();
            const targetIdx = parseInt(dot.dataset.index, 10);
            if (!isNaN(targetIdx)) {
                activePillarIndex = targetIdx;
                updatePillarsCarousel();
                startAutoRotate();
            }
        });
    });

    // Touch Swipe Support (Mobile)
    let touchStartX = 0;
    let touchEndX = 0;

    wrapper.addEventListener('touchstart', (e) => {
        touchStartX = e.changedTouches[0].screenX;
        stopAutoRotate();
    }, { passive: true });

    wrapper.addEventListener('touchend', (e) => {
        touchEndX = e.changedTouches[0].screenX;
        const diff = touchStartX - touchEndX;

        if (Math.abs(diff) > 42) {
            if (diff > 0) {
                goToNext(); // Swipe left -> next
            } else {
                goToPrev(); // Swipe right -> prev
            }
        }
        startAutoRotate();
    }, { passive: true });

    // Pause on mouse hover
    wrapper.addEventListener('mouseenter', stopAutoRotate);
    wrapper.addEventListener('mouseleave', startAutoRotate);

    // Initial render & timer start
    updatePillarsCarousel();
    startAutoRotate();
}

/**
 * Store Subscription & Startup
 */
function renderInventory(cars) {
    allVehicles = cars || [];
    populateDynamicFilterMenus();
    visibleCarsCount = CARS_PER_PAGE;
    applyFiltersAndRender();
}

function initApp() {
    initPillarsCarousel();
    initFilterControls();

    store.subscribe((cars) => {
        renderInventory(cars);
    });
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}

export { renderInventory, applyFiltersAndRender, resetAllFilters, initPillarsCarousel };
