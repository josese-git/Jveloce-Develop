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

// Export the Express app as a Firebase Cloud Function
exports.renderSocialTags = functions.https.onRequest(app);
