const { onRequest } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');
const express = require('express');
const fs = require('fs');
const path = require('path');
const https = require('https');

if (!admin.apps.length) {
    admin.initializeApp();
}
const db = admin.firestore();
const app = express();

const isSocialBot = (userAgent) => {
    if (!userAgent) return false;
    const bots = [
        'facebookexternalhit',
        'WhatsApp',
        'Twitterbot',
        'LinkedInBot',
        'Slackbot',
        'TelegramBot',
        'Discordbot',
        'SkypeUriPreview'
    ];
    return bots.some(bot => userAgent.toLowerCase().includes(bot.toLowerCase()));
};

const isSearchBot = (userAgent) => {
    if (!userAgent) return false;
    const bots = [
        'googlebot',
        'googlebot-image',
        'bingbot',
        'yandexbot',
        'duckduckbot',
        'slurp',
        'baiduspider'
    ];
    return bots.some(bot => userAgent.toLowerCase().includes(bot.toLowerCase()));
};

// Escape HTML attribute characters to prevent broken HTML
const escapeHtmlAttr = (str) => {
    if (str === null || str === undefined) return '';
    return str.toString()
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
};

// Helper to fetch remote binary image safely
const fetchRemoteImage = async (url) => {
    if (typeof fetch === 'function') {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Upstream image fetch failed with status: ${response.status}`);
        }
        const contentType = response.headers.get('content-type') || 'image/jpeg';
        const buffer = Buffer.from(await response.arrayBuffer());
        return { buffer, contentType };
    }
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            if (res.statusCode < 200 || res.statusCode >= 300) {
                return reject(new Error(`Upstream image fetch failed with status: ${res.statusCode}`));
            }
            const contentType = res.headers['content-type'] || 'image/jpeg';
            const chunks = [];
            res.on('data', chunk => chunks.push(chunk));
            res.on('end', () => resolve({ buffer: Buffer.concat(chunks), contentType }));
        }).on('error', reject);
    });
};

/**
 * 1. PROXY DE IMÁGENES EN DOMINIO PROPIO
 * Endpoint: /img-coches/:slug or /img-coches/:carId/:imageIndex
 * Serves the 3rd exterior image (index 2) by default, or fallback to exterior[0] / carData.image
 * Supports both GET and HEAD requests with Content-Length and optimal CDN headers.
 */
const handleImageProxy = async (req, res) => {
    try {
        let carId = req.params.carId || req.params.slug;
        let requestedIndex = req.params.imageIndex !== undefined ? parseInt(req.params.imageIndex, 10) : undefined;

        if (!carId) {
            return res.status(400).send('Identificador de vehículo no proporcionado');
        }

        // Clean slug if it contains extensions or suffixes
        if (carId.endsWith('-principal.jpg') || carId.endsWith('-principal.png') || carId.endsWith('-principal.webp')) {
            carId = carId.replace(/-principal\.(jpg|jpeg|png|webp)$/i, '');
        } else if (/\.(jpg|jpeg|png|webp)$/i.test(carId)) {
            carId = carId.replace(/\.(jpg|jpeg|png|webp)$/i, '');
        }

        // Decode in case of URI encoding
        carId = decodeURIComponent(carId);

        const doc = await db.collection('anuncios').doc(carId).get();
        if (!doc.exists) {
            return res.status(404).send('Vehículo no encontrado');
        }

        const carData = doc.data();
        const ext = (carData.galleryExterior || []).filter(Boolean);

        let storageUrl = null;

        // If specific index was requested
        if (requestedIndex !== undefined && !isNaN(requestedIndex) && ext[requestedIndex]) {
            storageUrl = ext[requestedIndex];
        }

        // Default SEO logic: Prioritize 3rd exterior image (index 2), then fallback to exterior[0], then carData.image
        if (!storageUrl) {
            if (ext.length >= 3 && ext[2]) {
                storageUrl = ext[2];
            } else if (ext.length > 0 && ext[0]) {
                storageUrl = ext[0];
            } else if (carData.image) {
                storageUrl = carData.image;
            }
        }

        if (!storageUrl) {
            return res.status(404).send('Imagen no disponible para este vehículo');
        }

        const { buffer, contentType } = await fetchRemoteImage(storageUrl);

        res.set({
            'Content-Type': contentType,
            'Content-Length': buffer.length,
            'Cache-Control': 'public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400',
            'Access-Control-Allow-Origin': '*',
            'X-Robots-Tag': 'index, max-image-preview:large'
        });

        if (req.method === 'HEAD') {
            return res.status(200).end();
        }

        return res.status(200).send(buffer);

    } catch (error) {
        console.error('Error in /img-coches proxy:', error);
        return res.status(502).send('Error al procesar la imagen solicitada');
    }
};

app.get(['/img-coches/:slug', '/img-coches/:carId/:imageIndex'], handleImageProxy);
app.head(['/img-coches/:slug', '/img-coches/:carId/:imageIndex'], handleImageProxy);

/**
 * Helper to build the SEO Gallery HTML
 * Requirement 3: 3rd photo (or fallback) is placed FIRST in DOM with high priority
 * All secondary images are lazy and wrapped with data-nosnippet
 */
const generateSeoGalleryHtml = (carData, carName, carId) => {
    const exterior = (carData.galleryExterior || []).filter(Boolean);
    const interior = (carData.galleryInterior || []).filter(Boolean);
    const safeCarName = escapeHtmlAttr(carName);
    const proxyImageUrl = `https://autosjveloce.com/img-coches/${encodeURIComponent(carId)}-principal.jpg`;
    let html = '';

    if (exterior.length === 0 && interior.length === 0) {
        return '';
    }

    // === BLOCK A: Exterior - 3ª foto destacada (o fallback) primero en DOM ===
    if (exterior.length >= 3) {
        html += `
        <div class="gallery-block block-a">
            <div class="col-right-main">
                <div class="gallery-item main-img">
                    <img src="${proxyImageUrl}" 
                         fetchpriority="high" 
                         loading="eager" 
                         decoding="sync" 
                         width="1200" 
                         height="900" 
                         itemprop="primaryImageOfPage" 
                         alt="${safeCarName} de segunda mano en Jaén - Autos JVeloce">
                </div>
            </div>
            <div class="col-left-stacked" data-nosnippet>
                <div class="gallery-item"><img src="${escapeHtmlAttr(exterior[0])}" alt="${safeCarName} - Vista frontal" loading="lazy" decoding="async"></div>
                <div class="gallery-item"><img src="${escapeHtmlAttr(exterior[1])}" alt="${safeCarName} - Vista 3/4 frontal" loading="lazy" decoding="async"></div>
            </div>
        </div>`;
    } else if (exterior.length > 0) {
        html += `
        <div class="gallery-block block-a">
            <div class="col-right-main">
                <div class="gallery-item main-img">
                    <img src="${proxyImageUrl}" 
                         fetchpriority="high" 
                         loading="eager" 
                         decoding="sync" 
                         width="1200" 
                         height="900" 
                         itemprop="primaryImageOfPage" 
                         alt="${safeCarName} de segunda mano en Jaén - Autos JVeloce">
                </div>
            </div>`;
        if (exterior.length > 1) {
            html += `
            <div class="col-left-stacked" data-nosnippet>
                <div class="gallery-item"><img src="${escapeHtmlAttr(exterior[1])}" alt="${safeCarName} - Vista secundaria" loading="lazy" decoding="async"></div>
            </div>`;
        }
        html += `
        </div>`;
    }

    // === BLOCK B: Exterior - 2 horizontal (photos 4 and 5) ===
    if (exterior.length >= 4) {
        const photo4 = exterior[3] ? `<div class="gallery-item"><img src="${escapeHtmlAttr(exterior[3])}" alt="${safeCarName} - Vista 3/4 trasera" loading="lazy" decoding="async"></div>` : '';
        const photo5 = exterior[4] ? `<div class="gallery-item"><img src="${escapeHtmlAttr(exterior[4])}" alt="${safeCarName} - Vista trasera" loading="lazy" decoding="async"></div>` : '';
        html += `
        <div class="gallery-block block-b" data-nosnippet>
            ${photo4}
            ${photo5}
        </div>`;
    }

    // === BLOCK C: Interior - First 3 photos in horizontal ===
    if (interior.length >= 1) {
        const interiorViews = ['Salpicadero', 'Asientos delanteros', 'Consola central'];
        html += `
        <div class="gallery-block block-c" data-nosnippet>`;
        interior.slice(0, 3).forEach((img, i) => {
            const viewName = interiorViews[i] || `Interior ${i + 1}`;
            html += `
            <div class="gallery-item"><img src="${escapeHtmlAttr(img)}" alt="${safeCarName} - ${escapeHtmlAttr(viewName)}" loading="lazy" decoding="async"></div>`;
        });
        html += `
        </div>`;
    }

    // === BLOCK D: Interior - Remaining photos (4-9) in 3-column grid ===
    if (interior.length > 3) {
        const detailViews = ['Asientos traseros', 'Maletero', 'Volante', 'Panel de control', 'Detalles', 'Acabados'];
        html += `
        <div class="gallery-block block-d" data-nosnippet>`;
        interior.slice(3).forEach((img, i) => {
            const viewName = detailViews[i] || `Detalle ${i + 1}`;
            html += `
            <div class="gallery-item"><img src="${escapeHtmlAttr(img)}" alt="${safeCarName} - ${escapeHtmlAttr(viewName)}" loading="lazy" decoding="async"></div>`;
        });
        html += `
        </div>`;
    }

    return html;
};

/**
 * Structured Data generator (Schema.org / JSON-LD)
 * Requirement 4: Pure numeric price (e.g. "5499"), standard UN/CEFACT code N12 for CV,
 * and clean proxy image object as primaryImageOfPage and image.
 */
const generateSeoJsonLd = (carData, carName, carId) => {
    const proxyImageUrl = `https://autosjveloce.com/img-coches/${encodeURIComponent(carId)}-principal.jpg`;

    // Clean numeric price without dots or symbols
    let rawPrice = carData.price ? carData.price.toString().replace(/[^\d]/g, '') : undefined;
    let numericKm = carData.km ? carData.km.toString().replace(/[^\d]/g, '') : undefined;
    let numericCv = carData.cv ? carData.cv.toString().replace(/[^\d]/g, '') : undefined;

    const imageObject = {
        "@type": "ImageObject",
        "url": proxyImageUrl,
        "contentUrl": proxyImageUrl,
        "caption": `${carName} en venta en Autos JVeloce Jaén`,
        "width": 1200,
        "height": 900
    };

    const schema = {
        "@context": "https://schema.org/",
        "@type": "Car",
        "name": carName,
        "brand": {
            "@type": "Brand",
            "name": carData.brand || "JVeloce"
        },
        "model": carData.model || "",
        "vehicleModelDate": carData.year ? carData.year.toString() : undefined,
        "mileageFromOdometer": numericKm ? {
            "@type": "QuantitativeValue",
            "value": numericKm,
            "unitCode": "KMT"
        } : undefined,
        "fuelType": carData.fuel || undefined,
        "vehicleTransmission": carData.transmission === 'Auto' ? 'Automático' : carData.transmission,
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
        "description": `${carName} de ocasión en Jaén. ${carData.fuel || ''} ${carData.km || ''} ${carData.cv ? carData.cv + ' CV' : ''}`.trim(),
        "offers": rawPrice ? {
            "@type": "Offer",
            "price": rawPrice,
            "priceCurrency": "EUR",
            "availability": "https://schema.org/InStock",
            "url": `https://autosjveloce.com/Coches/detalle.html?id=${encodeURIComponent(carId)}`,
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
        "url": `https://autosjveloce.com/Coches/detalle.html?id=${encodeURIComponent(carId)}`
    };

    Object.keys(schema).forEach(key => {
        if (schema[key] === undefined) delete schema[key];
    });

    return JSON.stringify(schema, null, 2);
};

// Helper to load HTML shell locally or remotely
const loadHtmlShell = async (carId) => {
    const candidatePaths = [
        path.resolve(__dirname, '../Coches/detalle-app.html'),
        path.resolve(__dirname, 'detalle-app.html'),
        path.resolve(process.cwd(), 'Coches/detalle-app.html')
    ];
    for (const p of candidatePaths) {
        if (fs.existsSync(p)) {
            try {
                return fs.readFileSync(p, 'utf8');
            } catch (e) {}
        }
    }

    const targetUrl = `https://jveloce-cf602.web.app/Coches/detalle-app.html?id=${carId || ''}`;
    return new Promise((resolve, reject) => {
        https.get(targetUrl, (res) => {
            if (res.statusCode < 200 || res.statusCode >= 300) {
                return reject(new Error('Status ' + res.statusCode));
            }
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve(data));
        }).on('error', err => reject(err));
    });
};

/**
 * 2. SSR ENDPOINT: /Coches/detalle.html
 * Fully completes SSR in Head and Body (fixes Soft 404, replaces all "Cargando..." and "--")
 */
app.get('/Coches/detalle.html', async (req, res) => {
    const userAgent = req.headers['user-agent'] || '';
    const carId = req.query.id;

    const social = isSocialBot(userAgent);
    const search = isSearchBot(userAgent);

    if (!carId) {
        // No carId provided -> redirect to inventory
        return res.redirect(301, '/index.html#inventory');
    }

    // 1. Social bots get lightweight raw HTML with proxy image
    if (social) {
        try {
            const doc = await db.collection('anuncios').doc(carId).get();
            if (!doc.exists) {
                return res.status(404).send('Vehículo no encontrado');
            }

            const carData = doc.data();
            const carName = `${carData.brand} ${carData.model} ${carData.year || ''}`.trim();
            const cleanProxyUrl = `https://autosjveloce.com/img-coches/${encodeURIComponent(carId)}-principal.jpg`;

            let rawPrice = carData.price ? carData.price.toString().replace(/[^\d]/g, '') : '';
            let formattedPrice = rawPrice ? rawPrice.replace(/\B(?=(\d{3})+(?!\d))/g, '.') : '';
            let priceStr = formattedPrice ? `${formattedPrice}€` : 'N/D€';

            let description = `${priceStr}`;
            if (carData.fuel && carData.fuel !== 'N/D') description += ` | ${carData.fuel}`;
            if (carData.km && carData.km !== 'N/D') description += ` | ${carData.km}`;
            description += ` - Descubre este increíble ${carName} en Autos JVeloce Jaén.`;

            const rawHtml = `<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <title>${escapeHtmlAttr(carName)} | Autos JVeloce Jaén</title>
    <meta name="description" content="${escapeHtmlAttr(description)}">
    <!-- Open Graph (Facebook, WhatsApp) -->
    <meta property="og:title" content="${escapeHtmlAttr(carName)} | Autos JVeloce">
    <meta property="og:description" content="${escapeHtmlAttr(description)}">
    <meta property="og:image" content="${cleanProxyUrl}">
    <meta property="og:image:alt" content="${escapeHtmlAttr(carName)} - Foto principal de la galería">
    <meta property="og:image:width" content="1200">
    <meta property="og:image:height" content="900">
    <meta property="og:url" content="https://autosjveloce.com/Coches/detalle.html?id=${encodeURIComponent(carId)}">
    <meta property="og:type" content="article">
    <!-- Twitter Card -->
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${escapeHtmlAttr(carName)} | Autos JVeloce">
    <meta name="twitter:description" content="${escapeHtmlAttr(description)}">
    <meta name="twitter:image" content="${cleanProxyUrl}">
    <!-- Explicit icon tags for messenger apps -->
    <link rel="icon" href="https://autosjveloce.com/assets/icons/favicon.png" sizes="48x48">
    <link rel="apple-touch-icon" href="https://autosjveloce.com/assets/icons/favicon.png">
</head>
<body>
    <h1>${escapeHtmlAttr(carName)}</h1>
    <p>${escapeHtmlAttr(description)}</p>
    <img src="${cleanProxyUrl}" alt="${escapeHtmlAttr(carName)} - Foto principal de la galería">
    <script>window.location.replace("/Coches/detalle-app.html?id=${encodeURIComponent(carId)}");</script>
</body>
</html>`;

            res.set('Cache-Control', 'private, no-cache, no-store, must-revalidate');
            return res.status(200).send(rawHtml);

        } catch (error) {
            console.error("Error fetching car for social bot:", error);
            return res.status(500).send('Error interno del servidor');
        }
    }

    // 2. Humans and Search bots get full HTML framework with SSR injection
    try {
        let html = await loadHtmlShell(carId);

        const doc = await db.collection('anuncios').doc(carId).get();
        if (!doc.exists) {
            console.log(`Car ID ${carId} not found, returning 404`);
            res.set('Cache-Control', 'private, no-cache, no-store, must-revalidate');
            return res.status(404).send(html);
        }

        const carData = doc.data();
        const carBrand = carData.brand || 'Vehículo';
        const carModelYear = `${carData.model || ''} ${carData.year || ''}`.trim();
        const carName = `${carBrand} ${carModelYear}`.trim();

        let rawPrice = carData.price ? carData.price.toString().replace(/[^\d]/g, '') : '';
        let formattedPrice = rawPrice ? rawPrice.replace(/\B(?=(\d{3})+(?!\d))/g, '.') : '';
        let priceStr = formattedPrice ? `${formattedPrice}€` : '';

        let description = priceStr;
        if (carData.fuel && carData.fuel !== 'N/D') description += ` | ${carData.fuel}`;
        if (carData.km && carData.km !== 'N/D') description += ` | ${carData.km}`;
        description += ` - Descubre este increíble ${carName} en Autos JVeloce Jaén.`;

        const cleanProxyUrl = `https://autosjveloce.com/img-coches/${encodeURIComponent(carId)}-principal.jpg`;
        const heroImgSrc = carData.image || cleanProxyUrl;
        const jsonLdString = generateSeoJsonLd(carData, carName, carId);
        const seoGalleryHtml = generateSeoGalleryHtml(carData, carName, carId);

        const injectedHeadTags = `
    <!-- SSR Injected SEO Tags & Structured Data for Google Indexing -->
    <meta name="robots" content="index, follow, max-image-preview:large">
    <link rel="preload" as="image" href="${cleanProxyUrl}" fetchpriority="high">
    <title>${escapeHtmlAttr(carName)} | Autos JVeloce Jaén</title>
    <link rel="canonical" id="canonical-url" href="https://autosjveloce.com/Coches/detalle.html?id=${encodeURIComponent(carId)}">
    <link rel="icon" href="/favicon.ico" sizes="any">
    <link rel="icon" type="image/png" sizes="48x48" href="/assets/icons/favicon.png">
    <link rel="apple-touch-icon" href="/assets/icons/favicon.png">
    <meta name="description" content="${escapeHtmlAttr(description)}">
    <meta property="og:title" content="${escapeHtmlAttr(carName)} | Autos JVeloce Jaén">
    <meta property="og:description" content="${escapeHtmlAttr(description)}">
    <meta property="og:image" content="${cleanProxyUrl}">
    <meta property="og:image:alt" content="${escapeHtmlAttr(carName)} - Foto principal de la galería">
    <meta property="og:url" content="https://autosjveloce.com/Coches/detalle.html?id=${encodeURIComponent(carId)}">
    <meta property="og:type" content="article">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${escapeHtmlAttr(carName)} | Autos JVeloce Jaén">
    <meta name="twitter:description" content="${escapeHtmlAttr(description)}">
    <meta name="twitter:image" content="${cleanProxyUrl}">
    <script type="application/ld+json">
${jsonLdString}
    </script>`;

        // 1. Inject Head Tags - replace inline SEO script block
        const scriptStart = html.indexOf('<!-- SEO Tags to be dynamically injected for Googlebot -->');
        const scriptEnd = html.indexOf('</script>', scriptStart);
        if (scriptStart !== -1 && scriptEnd !== -1) {
            html = html.substring(0, scriptStart) + injectedHeadTags + html.substring(scriptEnd + 9);
        }

        // 2. Body SSR: Hero Loader (Hide and eliminate any "Cargando..." placeholder)
        html = html.replace(/<div[^>]*id=["']heroLoader["'][^>]*>/i,
            `<div id="heroLoader" class="hero-loader hidden" style="display:none;">`);
        html = html.replace(/<span[^>]*id=["']loaderText["'][^>]*>[\s\S]*?<\/span>/i,
            `<span class="loader-text" id="loaderText"></span>`);

        // 3. Body SSR: Hero Image (decorative cutout PNG, data-nosnippet and role="presentation")
        html = html.replace(/<div\s+class=["']hero-visual["'][^>]*>/i,
            `<div class="hero-visual" data-nosnippet>`);
        html = html.replace(/<img[^>]*id=["']heroCarImg["'][^>]*>/i,
            `<img id="heroCarImg" src="${escapeHtmlAttr(heroImgSrc)}" alt="" role="presentation" class="hero-car-img" style="display:block;" loading="lazy">`);

        // 4. Body SSR: Hero Price (formatted price, remove "Cargando...")
        html = html.replace(/<div[^>]*id=["']heroPrice["'][^>]*>[\s\S]*?<\/div>/i,
            `<div class="hero-price-tag" id="heroPrice"><span class="price-currency">€</span><span class="price-val">${escapeHtmlAttr(formattedPrice)}</span></div>`);

        // 5. Body SSR: Vehicle Title (Single H1 with real brand and model)
        html = html.replace(/<span[^>]*id=["']carBrand["'][^>]*>[\s\S]*?<\/span>/i,
            `<span id="carBrand">${escapeHtmlAttr(carBrand)}</span>`);

        html = html.replace(/<span[^>]*id=["']carModel["'][^>]*>[\s\S]*?<\/span>/i,
            `<span class="text-gold" id="carModel">${escapeHtmlAttr(carModelYear)}</span>`);

        // 6. Body SSR: Car Description (real description, remove placeholder)
        let fullDescriptionHtml = '';
        if (carData.description && carData.description.trim() !== '') {
            fullDescriptionHtml = escapeHtmlAttr(carData.description).replace(/\n/g, '<br>');
        } else {
            fullDescriptionHtml = `${escapeHtmlAttr(carName)} de ocasión en Jaén. ${escapeHtmlAttr(carData.fuel || '')} ${escapeHtmlAttr(carData.km || '')} ${carData.cv ? escapeHtmlAttr(carData.cv) + ' CV' : ''}`.trim();
        }
        html = html.replace(/<p[^>]*id=["']carDescription["'][^>]*>[\s\S]*?<\/p>/i,
            `<p id="carDescription">${fullDescriptionHtml}</p>`);

        // 7. Body SSR: Specifications (replace "--" with real values)
        html = html.replace(/<span[^>]*id=["']specKm["'][^>]*>[\s\S]*?<\/span>/i,
            `<span id="specKm">${escapeHtmlAttr(carData.km || 'N/D')}</span>`);

        html = html.replace(/<span[^>]*id=["']specFuel["'][^>]*>[\s\S]*?<\/span>/i,
            `<span id="specFuel">${escapeHtmlAttr(carData.fuel || 'N/D')}</span>`);

        html = html.replace(/<span[^>]*id=["']specCV["'][^>]*>[\s\S]*?<\/span>/i,
            `<span id="specCV">${carData.cv ? `${escapeHtmlAttr(carData.cv)} CV` : 'N/D'}</span>`);

        html = html.replace(/<span[^>]*id=["']specTransmission["'][^>]*>[\s\S]*?<\/span>/i,
            `<span id="specTransmission">${carData.transmission === 'Auto' ? 'Automático' : escapeHtmlAttr(carData.transmission || 'N/D')}</span>`);

        // 8. Body SSR: Gallery Title (change H1 to H2 to guarantee single H1 on page)
        html = html.replace(/<h[12][^>]*id=["']galleryTitle["'][^>]*>[\s\S]*?<\/h[12]>/i,
            `<h2 id="galleryTitle" class="car-title" style="text-align: center;"><span class="text-gold">Galería de fotos del ${escapeHtmlAttr(carName)}</span></h2>`);

        // 9. Clean any inline script that might reference "Cargando..."
        html = html.replace(/loaderTextEl\.textContent\s*=\s*`Cargando[^`]*`;?/gi, '');
        html = html.replace(/loaderTextEl\.textContent\s*=\s*['"]Cargando[^'"]*['"];?/gi, '');

        // 10. Inject Pre-rendered Full SEO Gallery into #galleryContainer
        const galleryMarker = /(<div[^>]*id=["']galleryContainer["'][^>]*>)([\s\S]*?)(<\/div>)/i;
        if (galleryMarker.test(html)) {
            html = html.replace(galleryMarker, `$1${seoGalleryHtml}$3`);
        }

        res.set('Cache-Control', 'private, no-cache, no-store, must-revalidate');
        return res.status(200).send(html);

    } catch (error) {
        console.error("Failed to render SSR for detalle.html:", error);
        return res.status(500).send('Error interno del servidor al procesar la solicitud');
    }
});

/**
 * 6. SITEMAP DE IMÁGENES (/sitemap.xml)
 * Genera el XML oficial con namespace http://www.google.com/schemas/sitemap-image/1.1
 * Incluye ÚNICAMENTE UNA etiqueta <image:image> por vehículo apuntando al proxy de dominio propio.
 */
app.get('/sitemap.xml', async (req, res) => {
    try {
        const BASE_URL = 'https://autosjveloce.com';
        const snapshot = await db.collection('anuncios').orderBy('order').get();
        const vehicles = [];
        snapshot.forEach(doc => {
            vehicles.push({ id: doc.id, ...doc.data() });
        });

        const escapeXml = (unsafe) => {
            if (!unsafe) return '';
            return unsafe.toString()
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&apos;');
        };

        const getCurrentDate = () => {
            return new Date().toISOString().split('T')[0];
        };

        let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
    <!-- Página principal -->
    <url>
        <loc>${BASE_URL}/</loc>
        <lastmod>${getCurrentDate()}</lastmod>
        <changefreq>weekly</changefreq>
        <priority>1.0</priority>
    </url>

    <!-- Página de reseñas -->
    <url>
        <loc>${BASE_URL}/resenas.html</loc>
        <lastmod>${getCurrentDate()}</lastmod>
        <changefreq>monthly</changefreq>
        <priority>0.7</priority>
    </url>
`;

        vehicles.forEach(vehicle => {
            const carName = `${vehicle.brand} ${vehicle.model} ${vehicle.year || ''}`.trim();
            const proxyImageUrl = `${BASE_URL}/img-coches/${encodeURIComponent(vehicle.id)}-principal.jpg`;
            const imageTitle = `${carName} - Autos JVeloce Jaén`;
            const imageCaption = `Foto exterior principal del ${vehicle.brand} ${vehicle.model} (${vehicle.year || ''}) de ocasión en Jaén`;

            const canonicalPageUrl = `${BASE_URL}/Coches/detalle.html?id=${encodeURIComponent(vehicle.id)}`;
            xml += `    <url>
        <loc>${escapeXml(canonicalPageUrl)}</loc>
        <lastmod>${getCurrentDate()}</lastmod>
        <changefreq>weekly</changefreq>
        <priority>0.8</priority>
        <image:image>
            <image:loc>${escapeXml(proxyImageUrl)}</image:loc>
            <image:title>${escapeXml(imageTitle)}</image:title>
            <image:caption>${escapeXml(imageCaption)}</image:caption>
        </image:image>
    </url>
`;
        });

        xml += `</urlset>`;

        res.header('Content-Type', 'application/xml');
        res.header('Cache-Control', 'public, max-age=3600, s-maxage=3600');
        return res.status(200).send(xml);

    } catch (error) {
        console.error('Error generating dynamic sitemap:', error);
        return res.status(500).send('Error interno al generar el sitemap');
    }
});

// Export the Express app as a Firebase Cloud Function (2nd Gen)
exports.renderSocialTags = onRequest({ region: 'us-central1', maxInstances: 10 }, app);
