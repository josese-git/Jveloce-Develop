

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

    // Set canonical URL to tell Google this page is unique
    const canonicalUrl = `https://autosjveloce.com/Coches/detalle.html?id=${vehicleId}`;
    const canonicalTag = document.getElementById('canonical-url');
    if (canonicalTag) {
        canonicalTag.setAttribute('href', canonicalUrl);
    }

    // Punto 1: Si la página ya viene pre-renderizada por el SSR con datos completos e imagen válida, omitir Firestore
    const heroCarImgEl = document.getElementById('heroCarImg');
    const galleryContainerEl = document.getElementById('galleryContainer');
    const heroSrc = heroCarImgEl ? (heroCarImgEl.getAttribute('src') || '') : '';
    const hasValidHeroImg = heroSrc.startsWith('http');
    const hasGalleryImages = galleryContainerEl && galleryContainerEl.querySelectorAll('.gallery-item img').length > 0;

    if (hasValidHeroImg && hasGalleryImages) {
        console.log('[SSR Hydration] Contenido pre-renderizado por SSR detectado. Omitiendo consulta a Firestore.');
        const heroLoader = document.getElementById('heroLoader');
        if (heroLoader) {
            heroLoader.classList.add('hidden');
            heroLoader.style.display = 'none';
        }
        if (heroCarImgEl) {
            heroCarImgEl.style.display = 'block';
            heroCarImgEl.style.opacity = '1';
        }
        initLightbox();
        return;
    }

    try {
        // 2. Fetch vehicle data from Firebase (fallback únicamente si no vino pre-renderizado por SSR)
        const docRef = doc(db, COLLECTION_NAME, vehicleId);
        const docSnap = await getDoc(docRef);

        if (!docSnap.exists()) {
            showError('Vehículo no encontrado');
            return;
        }

        const car = docSnap.data();

        // 3. Inject data into HTML
        populateVehicleData(car);

        // Populate gallery with exterior and interior arrays separately, passing car data for alt text
        populateGallery(car.galleryExterior || [], car.galleryInterior || [], car);

    } catch (error) {
        console.error('Error loading vehicle:', error);
        showError('Error al cargar el vehículo');
    }
});

/**
 * Populate vehicle data into HTML elements
 */
function populateVehicleData(car) {
    // Page Title - Dynamic for SEO
    const pageTitle = `${car.brand} ${car.model} ${car.year || ''} | Autos JVeloce`.trim();
    document.title = pageTitle;

    // Update Meta Tags for SEO and Social Sharing
    updateMetaTags(car);

    // Generate and inject JSON-LD Structured Data
    generateStructuredData(car);

    // Hero Section - Cargar imagen de presentación del Hero y ocultar loader garantizado
    const heroCarImg = document.getElementById('heroCarImg');
    const heroLoader = document.getElementById('heroLoader');
    const existingHeroSrc = heroCarImg ? (heroCarImg.getAttribute('src') || '') : '';

    const hideLoaderAndShowImg = () => {
        if (heroLoader) {
            heroLoader.classList.add('hidden');
            heroLoader.style.display = 'none';
        }
        if (heroCarImg) {
            heroCarImg.style.display = 'block';
            heroCarImg.style.opacity = '1';
        }
    };

    if (existingHeroSrc && existingHeroSrc.startsWith('http') && !existingHeroSrc.endsWith('.html')) {
        // La imagen ya viene pre-renderizada por el SSR
        hideLoaderAndShowImg();
    } else {
        const mainImageUrl = car.image || (car.galleryExterior && car.galleryExterior[0]) || '';

        if (heroCarImg && mainImageUrl) {
            heroCarImg.style.display = 'block'; // Visible antes de asignar src para que el navegador la descargue inmediatamente
            heroCarImg.alt = '';
            heroCarImg.setAttribute('role', 'presentation');
            heroCarImg.removeAttribute('loading'); // Jamás lazy en la imagen principal del Hero
            heroCarImg.onload = hideLoaderAndShowImg;
            heroCarImg.onerror = () => {
                // Si falla la URL principal, probar fallback a la primera foto de exterior
                if (car.galleryExterior && car.galleryExterior[0] && heroCarImg.src !== car.galleryExterior[0]) {
                    heroCarImg.src = car.galleryExterior[0];
                } else {
                    hideLoaderAndShowImg();
                }
            };
            heroCarImg.src = mainImageUrl;
            if (heroCarImg.complete && heroCarImg.naturalWidth > 0) {
                hideLoaderAndShowImg();
            }
            // Fallback de seguridad por si onload no dispara
            setTimeout(hideLoaderAndShowImg, 1200);
        } else {
            hideLoaderAndShowImg();
        }
    }

    // Price - Estructura limpia y sin solapamiento
    const priceEl = document.getElementById('heroPrice');
    if (priceEl) {
        // Format price with euro symbol
        const formattedPrice = formatPrice(car.price);
        priceEl.innerHTML = `<span class="text-gold">€${formattedPrice}</span>`;
    }

    // Title (Brand + Model)
    const brandEl = document.getElementById('carBrand');
    const modelEl = document.getElementById('carModel');
    if (brandEl) brandEl.textContent = car.brand || car.marca || '';
    if (modelEl) modelEl.textContent = car.model || car.modelo || '';

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
 * Update meta tags dynamically for SEO and social sharing
 */
function updateMetaTags(car) {
    // Si ya fueron inyectadas por SSR con la URL del proxy limpio, preservar meta tags de SSR
    const existingOgImage = document.querySelector('meta[property="og:image"]');
    if (existingOgImage && existingOgImage.getAttribute('content')?.includes('/img-coches/')) {
        return;
    }

    const carTitle = `${car.brand} ${car.model} ${car.year || ''}`.trim();

    let priceStr = 'N/D€';
    if (car.price) {
        let numericPrice = car.price.toString().replace(/[€\s]/g, '');
        numericPrice = numericPrice.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
        priceStr = `${numericPrice}€`;
    }

    let dynamicDesc = `${priceStr}`;
    if (car.fuel && car.fuel !== 'N/D') dynamicDesc += ` | ${car.fuel}`;
    if (car.km && car.km !== 'N/D') dynamicDesc += ` | ${car.km}`;
    dynamicDesc += ` - Descubre este increíble ${carTitle} en Autos JVeloce Jaén.`;

    const carDescription = dynamicDesc;

    // Update or create meta tags
    updateOrCreateMetaTag('property', 'og:title', carTitle);
    updateOrCreateMetaTag('property', 'og:description', carDescription);
    updateOrCreateMetaTag('name', 'description', carDescription);

    // Update og:image — prioritize galleryExterior[2] (same as server SSR)
    const featuredImg = (car.galleryExterior && car.galleryExterior[2])
        ? car.galleryExterior[2]
        : (car.galleryExterior && car.galleryExterior[0])
            ? car.galleryExterior[0]
            : car.image;
    if (featuredImg) {
        updateOrCreateMetaTag('property', 'og:image', featuredImg);
    }

    // Update og:url with current page URL
    updateOrCreateMetaTag('property', 'og:url', window.location.href);

    // Set og:type to article
    updateOrCreateMetaTag('property', 'og:type', 'article');
}

/**
 * Helper function to update or create meta tags
 */
function updateOrCreateMetaTag(attribute, attributeValue, content) {
    let metaTag = document.querySelector(`meta[${attribute}="${attributeValue}"]`);

    if (metaTag) {
        metaTag.setAttribute('content', content);
    } else {
        metaTag = document.createElement('meta');
        metaTag.setAttribute(attribute, attributeValue);
        metaTag.setAttribute('content', content);
        document.head.appendChild(metaTag);
    }
}

/**
 * Generate JSON-LD structured data for Google indexing
 */
function generateStructuredData(car) {
    // Si ya existe un script JSON-LD inyectado por el SSR en el <head>, NO sobrescribir ni inyectar duplicado
    const existingScript = document.querySelector('script[type="application/ld+json"]');
    if (existingScript) {
        return;
    }

    const urlParams = new URLSearchParams(window.location.search);
    const vehicleId = urlParams.get('id') || '';
    const cleanImageUrl = vehicleId ? `https://autosjveloce.com/img-coches/${encodeURIComponent(vehicleId)}-principal.jpg` : (car.image || '');

    const imageObject = {
        "@type": "ImageObject",
        "url": cleanImageUrl,
        "contentUrl": cleanImageUrl,
        "caption": `${car.brand} ${car.model} ${car.year || ''} en venta en Autos JVeloce Jaén`.trim(),
        "width": 1200,
        "height": 900
    };

    // Format numeric price without dots or symbols
    let cleanPrice = car.price ? car.price.toString().replace(/[^\d]/g, '') : undefined;
    let numericKm = car.km ? car.km.replace(/[^\d]/g, '') : undefined;
    let numericCv = car.cv ? car.cv.toString().replace(/[^\d]/g, '') : undefined;

    // Create structured data object
    const structuredData = {
        "@context": "https://schema.org/",
        "@type": "Car",
        "name": `${car.brand} ${car.model} ${car.year || ''}`.trim(),
        "brand": {
            "@type": "Brand",
            "name": car.brand
        },
        "model": car.model,
        "vehicleModelDate": car.year ? car.year.toString() : undefined,
        "mileageFromOdometer": numericKm ? {
            "@type": "QuantitativeValue",
            "value": numericKm,
            "unitCode": "KMT"
        } : undefined,
        "fuelType": car.fuel,
        "vehicleTransmission": car.transmission === 'Auto' ? 'Automático' : car.transmission,
        "vehicleEngine": numericCv ? {
            "@type": "EngineSpecification",
            "enginePower": {
                "@type": "QuantitativeValue",
                "value": numericCv,
                "unitCode": "N12",
                "unitText": "CV"
            }
        } : undefined,
        "image": imageObject,
        "primaryImageOfPage": imageObject,
        "description": car.description || `${car.brand} ${car.model} ${car.year || ''} en excelente estado.`,
        "offers": cleanPrice ? {
            "@type": "Offer",
            "price": cleanPrice,
            "priceCurrency": "EUR",
            "availability": "https://schema.org/InStock",
            "seller": {
                "@type": "AutoDealer",
                "name": "Autos JVeloce",
                "telephone": "+34603945181",
                "url": "https://autosjveloce.com",
                "address": {
                    "@type": "PostalAddress",
                    "addressLocality": "Jaén",
                    "addressRegion": "Andalucía",
                    "postalCode": "23001",
                    "addressCountry": "ES"
                }
            }
        } : undefined,
        "url": window.location.href
    };

    // Remove undefined values
    Object.keys(structuredData).forEach(key => {
        if (structuredData[key] === undefined) {
            delete structuredData[key];
        }
    });

    // Create and inject script tag
    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.textContent = JSON.stringify(structuredData, null, 2);
    document.head.appendChild(script);
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
function populateGallery(exteriorImages, interiorImages, car) {
    const container = document.getElementById('galleryContainer');
    if (!container) return;

    // Hidratación no destructiva: Si el SSR ya inyectó imágenes válidas, NO borrarlas ni recrearlas
    const existingImages = container.querySelectorAll('.gallery-item img');
    if (existingImages && existingImages.length > 0) {
        console.log('[SSR Hydration] Galería ya pre-renderizada por SSR. Conservando DOM y enlazando Lightbox.');
        initLightbox();
        return;
    }

    // Filter out null values
    const exterior = (exteriorImages || []).filter(img => img !== null);
    const interior = interiorImages || [];

    // Generate base alt text
    const carName = car ? `${car.brand} ${car.model} ${car.year || ''}`.trim() : 'Vehículo';

    // If no gallery images, hide the gallery section
    if (exterior.length === 0 && interior.length === 0) {
        const galleryTitle = document.getElementById('galleryTitle');
        if (galleryTitle) galleryTitle.style.display = 'none';
        container.style.display = 'none';
        return;
    }

    // Clear existing content completely
    container.innerHTML = '';

    const urlParams = new URLSearchParams(window.location.search);
    const vehicleId = urlParams.get('id') || '';
    const isLocalServer = (window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost') && window.location.port !== '5000';
    const directStorageImg = (exterior[2] || exterior[0] || car?.image || '');
    // En entorno cliente local usar directamente la URL de Firebase Storage para no depender de la Cloud Function /img-coches/
    const proxyImageUrl = isLocalServer ? directStorageImg : (vehicleId ? `https://autosjveloce.com/img-coches/${encodeURIComponent(vehicleId)}-principal.jpg` : directStorageImg);

    // === BLOCK A: Exterior - 2 stacked left + 1 large right (DOM: main first, CSS: ordered) ===
    if (exterior.length >= 3) {
        const blockA = document.createElement('div');
        blockA.className = 'gallery-block block-a';
        blockA.innerHTML = `
            <div class="col-right-main">
                <div class="gallery-item main-img">
                    <img src="${proxyImageUrl}" 
                         fetchpriority="high" 
                         loading="eager" 
                         decoding="sync" 
                         width="1200" 
                         height="900" 
                         itemprop="primaryImageOfPage" 
                         alt="${carName} de segunda mano en Jaén - Autos JVeloce">
                </div>
            </div>
            <div class="col-left-stacked" data-nosnippet>
                <div class="gallery-item"><img src="${exterior[0]}" alt="${carName} - Vista frontal" loading="lazy" decoding="async"></div>
                <div class="gallery-item"><img src="${exterior[1]}" alt="${carName} - Vista 3/4 frontal" loading="lazy" decoding="async"></div>
            </div>
        `;
        container.appendChild(blockA);
    } else if (exterior.length > 0) {
        // If less than 3, show in simple grid
        const blockA = document.createElement('div');
        blockA.className = 'gallery-block block-a';
        blockA.innerHTML = `
            <div class="col-right-main">
                <div class="gallery-item main-img">
                    <img src="${proxyImageUrl}" 
                         fetchpriority="high" 
                         loading="eager" 
                         decoding="sync" 
                         width="1200" 
                         height="900" 
                         itemprop="primaryImageOfPage" 
                         alt="${carName} de segunda mano en Jaén - Autos JVeloce">
                </div>
            </div>`;
        if (exterior.length > 1) {
            blockA.innerHTML += `
            <div class="col-left-stacked" data-nosnippet>
                <div class="gallery-item"><img src="${exterior[1]}" alt="${carName} - Vista secundaria" loading="lazy" decoding="async"></div>
            </div>`;
        }
        container.appendChild(blockA);
    }

    // === BLOCK B: Exterior - 2 horizontal (photos 4 and 5) ===
    if (exterior.length >= 4) {
        const blockB = document.createElement('div');
        blockB.className = 'gallery-block block-b';
        blockB.setAttribute('data-nosnippet', '');
        const photo4 = exterior[3] ? `<div class="gallery-item"><img src="${exterior[3]}" alt="${carName} - Vista 3/4 trasera" loading="lazy" decoding="async"></div>` : '';
        const photo5 = exterior[4] ? `<div class="gallery-item"><img src="${exterior[4]}" alt="${carName} - Vista trasera" loading="lazy" decoding="async"></div>` : '';
        blockB.innerHTML = photo4 + photo5;
        container.appendChild(blockB);
    }

    // === BLOCK C: Interior - First 3 photos in horizontal ===
    if (interior.length >= 1) {
        const blockC = document.createElement('div');
        blockC.className = 'gallery-block block-c';
        blockC.setAttribute('data-nosnippet', '');
        const interiorViews = ['Salpicadero', 'Asientos delanteros', 'Consola central'];
        interior.slice(0, 3).forEach((img, i) => {
            const item = document.createElement('div');
            item.className = 'gallery-item';
            const viewName = interiorViews[i] || `Interior ${i + 1}`;
            item.innerHTML = `<img src="${img}" alt="${carName} - ${viewName}" loading="lazy" decoding="async">`;
            blockC.appendChild(item);
        });
        container.appendChild(blockC);
    }

    // === BLOCK D: Interior - Remaining photos (4-9) in 3-column grid ===
    if (interior.length > 3) {
        const blockD = document.createElement('div');
        blockD.className = 'gallery-block block-d';
        blockD.setAttribute('data-nosnippet', '');
        const detailViews = ['Asientos traseros', 'Maletero', 'Volante', 'Panel de control', 'Detalles', 'Acabados'];
        interior.slice(3).forEach((img, i) => {
            const item = document.createElement('div');
            item.className = 'gallery-item';
            const viewName = detailViews[i] || `Detalle ${i + 1}`;
            item.innerHTML = `<img src="${img}" alt="${carName} - ${viewName}" loading="lazy" decoding="async">`;
            blockD.appendChild(item);
        });
        container.appendChild(blockD);
    }

    // Initialize lightbox for dynamically added images
    initLightbox();
}

/**
 * Initialize lightbox for gallery images (delegates to window.initLightbox from lightbox.js)
 */
function initLightbox() {
    if (window.initLightbox) {
        window.initLightbox();
    }
}

/**
 * Show error message
 */
function showError(message) {
    const heroData = document.querySelector('.hero-data');
    const heroVisual = document.querySelector('.hero-visual');
    const gallerySection = document.getElementById('gallery');

    if (heroVisual) {
        heroVisual.style.display = 'none';
    }
    if (gallerySection) {
        gallerySection.style.display = 'none';
    }

    if (heroData) {
        heroData.style.width = '100%';
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
