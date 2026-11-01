/**
 * Search Module - Reusable search functionality for all pages
 * Uses window.store (exposed from store.js via app.js) to get vehicle data lazily
 */

// Base path detection for correct navigation
const isInSubfolder = window.location.pathname.includes('/Coches/');
const basePath = isInSubfolder ? '../' : '';

// Store vehicles data for search
let allCars = [];
let isSearchCarsLoading = false;

/**
 * Text normalizer for case-insensitive and accent-insensitive searching (tildes / diacritics)
 */
function normalizeText(text) {
    if (!text) return '';
    return text.toString()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();
}

/**
 * Pre-computes search index for all cars in memory to eliminate string concatenation
 * and normalization on every keystroke when typing on mobile.
 */
function prepareSearchIndex(cars) {
    if (!cars || !Array.isArray(cars)) return;
    cars.forEach(car => {
        if (!car._searchIndex) {
            car._searchIndex = normalizeText([
                car.brand || '',
                car.model || '',
                car.year || '',
                car.fuel || '',
                car.transmission || '',
                car.km || '',
                car.price || '',
                car.description || ''
            ].join(' '));
        }
    });
}

/**
 * Lazy load vehicles data from the store ONLY when search modal is opened or user searches
 * Avoids any Firestore connections on initial page load (Googlebot friendly)
 */
async function loadSearchCars() {
    if (allCars.length > 0) return allCars;
    if (isSearchCarsLoading) {
        while (isSearchCarsLoading) {
            await new Promise(r => setTimeout(r, 50));
        }
        return allCars;
    }

    isSearchCarsLoading = true;
    try {
        // Ensure window.store is available, dynamically importing store.js if needed
        if (!window.store) {
            try {
                const storePath = isInSubfolder ? '../js/store.js' : './js/store.js';
                const module = await import(storePath);
                window.store = module.default || module.store || window.store;
            } catch (e) {
                try {
                    const fallbackPath = isInSubfolder ? '../js/store.js' : './store.js';
                    const module = await import(fallbackPath);
                    window.store = module.default || module.store || window.store;
                } catch (e2) {
                    console.warn('[Search] Could not import store.js dynamically:', e2);
                }
            }
        }

        if (window.store && typeof window.store.ensureCarsLoaded === 'function') {
            const cars = await window.store.ensureCarsLoaded();
            if (cars && cars.length > 0) {
                allCars = cars;
                prepareSearchIndex(allCars);
            }
        } else if (window.store && typeof window.store.subscribe === 'function') {
            await new Promise((resolve) => {
                let resolved = false;
                window.store.subscribe((cars) => {
                    if (cars && cars.length > 0) {
                        allCars = cars;
                        prepareSearchIndex(allCars);
                        if (!resolved) {
                            resolved = true;
                            resolve(cars);
                        }
                    }
                });
                setTimeout(() => {
                    if (!resolved) {
                        resolved = true;
                        prepareSearchIndex(allCars);
                        resolve(allCars);
                    }
                }, 2500);
            });
        }
    } catch (err) {
        console.error('[Search] Error loading cars for search:', err);
    } finally {
        isSearchCarsLoading = false;
    }

    return allCars;
}

// DOM Elements
const searchModal = document.getElementById('searchModal');
const searchInput = document.getElementById('searchInput');
const searchResults = document.getElementById('searchResults');
const searchCloseBtn = document.getElementById('searchCloseBtn');
const desktopSearchIcon = document.querySelector('.nav-links .search-icon');
const mobileSearchBtn = document.querySelector('.mobile-search-btn');

// Open search modal
async function openSearch() {
    if (!searchModal) return;
    searchModal.classList.add('active');
    document.body.style.overflow = 'hidden';

    // Show loading state if vehicles haven't finished loading yet
    if (allCars.length === 0 && searchResults) {
        searchResults.innerHTML = '<p class="search-hint">Cargando vehículos...</p>';
    }

    setTimeout(() => {
        if (searchInput) searchInput.focus();
    }, 100);

    // Fetch vehicles in background / wait
    await loadSearchCars();

    if (searchResults && searchInput && !searchInput.value.trim()) {
        searchResults.innerHTML = '<p class="search-hint">Escribe para buscar por marca, modelo, año...</p>';
    } else if (searchInput && searchInput.value.trim()) {
        const query = searchInput.value;
        const results = filterCars(query);
        renderResults(results, query);
    }
}

// Close search modal
function closeSearch() {
    if (!searchModal) return;
    searchModal.classList.remove('active');
    document.body.style.overflow = '';
    if (searchInput) searchInput.value = '';
    if (searchResults) {
        searchResults.innerHTML = '<p class="search-hint">Escribe para buscar por marca, modelo, año...</p>';
    }
}

// Search filter function (case-insensitive & accent-insensitive)
function filterCars(query) {
    const rawSearch = normalizeText(query);
    if (!rawSearch) {
        return [];
    }

    // Split multi-word queries into individual terms (e.g. "bmw 320" -> ["bmw", "320"])
    const terms = rawSearch.split(/\s+/).filter(t => t.length > 0);

    return allCars.filter(car => {
        const searchableText = car._searchIndex || normalizeText([
            car.brand || '',
            car.model || '',
            car.year || '',
            car.fuel || '',
            car.transmission || '',
            car.km || '',
            car.price || '',
            car.description || ''
        ].join(' '));

        return terms.every(term => searchableText.includes(term));
    });
}

/**
 * Helper para enrutamiento de detalle de coche en búsqueda:
 * En local (Live Server u otros puertos != 5000) apunta a detalle-app.html
 * En producción (autosjveloce.com) y Firebase Emulator (:5000) apunta a detalle.html para SSR
 */
const getCarDetailUrl = (carId) => {
    const isLocalStaticServer = (window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost') && window.location.port !== '5000';
    const baseFile = isLocalStaticServer ? 'detalle-app.html' : 'detalle.html';
    return `${basePath}Coches/${baseFile}?id=${encodeURIComponent(carId)}`;
};

// Render search results
function renderResults(cars, query) {
    if (!searchResults) return;

    if (!query.trim()) {
        searchResults.innerHTML = '<p class="search-hint">Escribe para buscar por marca, modelo, año...</p>';
        return;
    }

    if (cars.length === 0) {
        searchResults.innerHTML = `
            <div class="search-no-results">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <circle cx="11" cy="11" r="8"></circle>
                    <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                    <line x1="8" y1="8" x2="14" y2="14"></line>
                    <line x1="14" y1="8" x2="8" y2="14"></line>
                </svg>
                <p>No se encontraron vehículos para "<strong>${query}</strong>"</p>
            </div>
        `;
        return;
    }

    // Adjust image paths based on current location
    searchResults.innerHTML = cars.map(car => {
        const imagePath = isInSubfolder ? `../${car.image}` : car.image;
        return `
            <div class="search-result-item" data-car-id="${car.id}">
                <img src="${imagePath}" alt="${car.brand} ${car.model}" class="search-result-img" loading="lazy" decoding="async">
                <div class="search-result-info">
                    <h4 class="search-result-title">${car.brand} ${car.model}</h4>
                    <div class="search-result-specs">
                        <span>${car.year}</span>
                        <span>${car.fuel}</span>
                        <span>${car.transmission}</span>
                        ${car.km ? `<span>${car.km}</span>` : ''}
                    </div>
                </div>
                <svg class="search-result-arrow" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="9 18 15 12 9 6"></polyline>
                </svg>
            </div>
        `;
    }).join('');

    // Add click handlers to results
    document.querySelectorAll('.search-result-item').forEach(item => {
        item.addEventListener('click', () => {
            const carId = item.getAttribute('data-car-id');
            closeSearch();
            // Navigate to detail page with correct path
            window.location.href = getCarDetailUrl(carId);
        });
    });
}

// Initialize event listeners
function initSearchListeners() {
    if (desktopSearchIcon) {
        desktopSearchIcon.addEventListener('click', (e) => {
            e.preventDefault();
            openSearch();
        });
    }

    if (mobileSearchBtn) {
        mobileSearchBtn.addEventListener('click', (e) => {
            e.preventDefault();
            openSearch();
        });
    }

    if (searchCloseBtn) {
        searchCloseBtn.addEventListener('click', closeSearch);
    }

    // Close on backdrop click
    if (searchModal) {
        searchModal.addEventListener('click', (e) => {
            if (e.target === searchModal) {
                closeSearch();
            }
        });
    }

    // Close on Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && searchModal && searchModal.classList.contains('active')) {
            closeSearch();
        }
    });

    // Search input handler with debounce and async loading if not ready
    let searchTimeout;
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(async () => {
                const query = e.target.value;
                if (!query.trim()) {
                    searchResults.innerHTML = '<p class="search-hint">Escribe para buscar por marca, modelo, año...</p>';
                    return;
                }

                if (allCars.length === 0) {
                    if (searchResults) {
                        searchResults.innerHTML = '<p class="search-hint">Buscando vehículos...</p>';
                    }
                    await loadSearchCars();
                }

                const results = filterCars(query);
                renderResults(results, query);
            }, 150);
        });
    }
}

// Initialize on DOM ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSearchListeners);
} else {
    initSearchListeners();
}

export { openSearch, closeSearch };
