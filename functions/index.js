const functions = require('firebase-functions');
const admin = require('firebase-admin');
const express = require('express');
const fs = require('fs');
const path = require('path');

admin.initializeApp();
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
        'bingbot',
        'yandexbot',
        'duckduckbot',
        'slurp'
    ];
    return bots.some(bot => userAgent.toLowerCase().includes(bot.toLowerCase()));
};

app.get('/Coches/detalle.html', async (req, res) => {
    const userAgent = req.headers['user-agent'] || '';
    const carId = req.query.id;

    const social = isSocialBot(userAgent);
    const search = isSearchBot(userAgent);

    // 1. Social bots get lightweight raw HTML
    if (social && carId) {
        try {
            const doc = await db.collection('anuncios').doc(carId).get();
            if (!doc.exists) {
                return res.status(404).send('Vehículo no encontrado');
            }

            const carData = doc.data();
            const carName = `${carData.brand} ${carData.model} ${carData.year || ''}`.trim();

            let carImage = carData.image || 'https://autosjveloce.com/assets/logo%20con%20fondo.png';
            if (carData.galleryExterior && carData.galleryExterior[2]) {
                carImage = carData.galleryExterior[2];
            }

            const optimizedImage = `https://wsrv.nl/?url=${encodeURIComponent(carImage)}&w=800&h=420&fit=cover&output=jpeg`;

            let priceStr = 'N/D€';
            if (carData.price) {
                let numericPrice = carData.price.toString().replace(/[€\s]/g, '');
                numericPrice = numericPrice.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
                priceStr = `${numericPrice}€`;
            }

            let description = `${priceStr}`;
            if (carData.fuel && carData.fuel !== 'N/D') description += ` | ${carData.fuel}`;
            if (carData.km && carData.km !== 'N/D') description += ` | ${carData.km}`;
            description += ` - Descubre este increíble ${carName} en Autos JVeloce Jaén.`;

            const rawHtml = `<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <title>${carName} | Autos JVeloce Jaén</title>
    <meta name="description" content="${description}">
    <!-- Open Graph (Facebook, WhatsApp) -->
    <meta property="og:title" content="${carName} | Autos JVeloce">
    <meta property="og:description" content="${description}">
    <meta property="og:image" content="${optimizedImage}">
    <meta property="og:image:width" content="800">
    <meta property="og:image:height" content="420">
    <meta property="og:url" content="https://autosjveloce.com/Coches/detalle.html?id=${carId}">
    <meta property="og:type" content="article">
    <!-- Twitter Card -->
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${carName} | Autos JVeloce">
    <meta name="twitter:description" content="${description}">
    <meta name="twitter:image" content="${optimizedImage}">
    <!-- Explicit icon tags for messenger apps -->
    <link rel="icon" href="https://autosjveloce.com/assets/icons/favicon.png" sizes="48x48">
    <link rel="apple-touch-icon" href="https://autosjveloce.com/assets/icons/favicon.png">
</head>
<body>
    <h1>${carName}</h1>
    <p>${description}</p>
    <img src="${optimizedImage}" alt="${carName}">
    <script>window.location.replace("/Coches/detalle-app.html?id=${carId}");</script>
</body>
</html>`;

            res.set('Cache-Control', 'private, no-cache, no-store, must-revalidate');
            return res.status(200).send(rawHtml);

        } catch (error) {
            console.error("Error fetching car for social bot:", error);
            return res.status(500).send('Error interno del servidor');
        }
    }

    // 2. Humans and Search bots get the full HTML framework
    if (!social) {
        console.log(`Serving request format: ${search ? 'Search Bot' : 'Human visitor'}.`, { userAgent, carId });
        try {
            const https = require('https');
            const targetUrl = `https://jveloce-cf602.web.app/Coches/detalle-app.html?id=${carId || ''}`;

            let html = await new Promise((resolve, reject) => {
                https.get(targetUrl, (res) => {
                    if (res.statusCode < 200 || res.statusCode >= 300) {
                        return reject(new Error('Status ' + res.statusCode));
                    }
                    let data = '';
                    res.on('data', chunk => data += chunk);
                    res.on('end', () => resolve(data));
                }).on('error', err => reject(err));
            });

            // 3. For search bots, inject SEO tags into the HTML
            if (search && carId) {
                console.log("Search bot detected. SSR injecting tags.");
                try {
                    const doc = await db.collection('anuncios').doc(carId).get();
                    if (doc.exists) {
                        const carData = doc.data();
                        const carName = `${carData.brand} ${carData.model} ${carData.year || ''}`.trim();

                        let priceStr = 'N/D€';
                        if (carData.price) {
                            let numericPrice = carData.price.toString().replace(/[€\s]/g, '');
                            numericPrice = numericPrice.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
                            priceStr = `${numericPrice}€`;
                        }

                        let description = `${priceStr}`;
                        if (carData.fuel && carData.fuel !== 'N/D') description += ` | ${carData.fuel}`;
                        if (carData.km && carData.km !== 'N/D') description += ` | ${carData.km}`;
                        description += ` - Descubre este increíble ${carName} en Autos JVeloce Jaén.`;

                        let carImage = carData.image || 'https://autosjveloce.com/assets/logo%20con%20fondo.png';
                        if (carData.galleryExterior && carData.galleryExterior[2]) {
                            carImage = carData.galleryExterior[2];
                        }

                        const optimizedImage = `https://wsrv.nl/?url=${encodeURIComponent(carImage)}&w=800&h=420&fit=cover&output=jpeg`;

                        const injectedTags = `
    <!-- SSR Injected SEO Tags -->
    <title>${carName} | Autos JVeloce Jaén</title>
    <link rel="canonical" id="canonical-url" href="https://autosjveloce.com/Coches/detalle.html?id=${carId}">
    <meta name="description" content="${description}">
    <meta property="og:title" content="${carName} | Autos JVeloce Jaén">
    <meta property="og:description" content="${description}">
    <meta property="og:image" content="${optimizedImage}">
    <meta property="og:url" content="https://autosjveloce.com/Coches/detalle.html?id=${carId}">`;

                        const scriptStart = html.indexOf('<!-- SEO Tags to be dynamically injected for Googlebot -->');
                        const scriptEnd = html.indexOf('</script>', scriptStart);

                        if (scriptStart !== -1 && scriptEnd !== -1) {
                            html = html.substring(0, scriptStart) + injectedTags + html.substring(scriptEnd + 9);
                        }
                    }
                } catch (err) {
                    console.error("Error fetching car data for search bot SSR", err);
                }
            }

            console.log("Successfully retrieved HTML shell via proxy.");
            res.set('Cache-Control', 'private, no-cache, no-store, must-revalidate');
            return res.status(200).send(html);
        } catch (error) {
            console.error("Failed to proxy HTML shell, falling back to JS redirect:", error);
            return res.status(200).send(`<!DOCTYPE html><html><head><title>Autos JVeloce</title></head><body><script>window.location.href="/Coches/detalle-app.html?id=${carId || ''}";</script></body></html>`);
        }
    }
});

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

        const generateImageTag = (imageUrl, caption) => {
            return `        <image:image>
            <image:loc>${escapeXml(imageUrl)}</image:loc>
            <image:caption>${escapeXml(caption)}</image:caption>
        </image:image>
`;
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
            xml += `    <url>
        <loc>${BASE_URL}/Coches/detalle.html?id=${encodeURIComponent(vehicle.id)}</loc>
        <lastmod>${getCurrentDate()}</lastmod>
        <changefreq>weekly</changefreq>
        <priority>0.8</priority>
`;

            if (vehicle.image) {
                xml += generateImageTag(vehicle.image, `${carName} - Imagen principal`);
            }

            if (vehicle.galleryExterior && Array.isArray(vehicle.galleryExterior)) {
                const exteriorViews = ['Vista frontal', 'Vista 3/4 frontal', 'Vista lateral', 'Vista 3/4 trasera', 'Vista trasera'];
                vehicle.galleryExterior.filter(img => img).forEach((img, index) => {
                    const caption = `${carName} - ${exteriorViews[index] || `Exterior ${index + 1}`}`;
                    xml += generateImageTag(img, caption);
                });
            }

            if (vehicle.galleryInterior && Array.isArray(vehicle.galleryInterior)) {
                const interiorViews = ['Salpicadero', 'Asientos delanteros', 'Consola central', 'Asientos traseros', 'Maletero', 'Volante', 'Panel de control', 'Detalles', 'Acabados'];
                vehicle.galleryInterior.filter(img => img).forEach((img, index) => {
                    const caption = `${carName} - ${interiorViews[index] || `Interior ${index + 1}`}`;
                    xml += generateImageTag(img, caption);
                });
            }

            xml += `    </url>
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

// Export the Express app as a Firebase Cloud Function
exports.renderSocialTags = functions.https.onRequest(app);
