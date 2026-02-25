const functions = require('firebase-functions');
const admin = require('firebase-admin');
const express = require('express');
const fs = require('fs');
const path = require('path');

admin.initializeApp();
const db = admin.firestore();
const app = express();

const isBot = (userAgent) => {
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
    return bots.some(bot => userAgent.includes(bot));
};

app.get('/Coches/detalle.html', async (req, res) => {
    const userAgent = req.headers['user-agent'];
    const carId = req.query.id;

    // 1. If it's a normal human OR there is no car ID, send the normal HTML file
    if (!isBot(userAgent) || !carId) {
        console.log("Serving request format: Human visitor.", { userAgent, carId });
        try {
            const https = require('https');
            const targetUrl = `https://jveloce-cf602.web.app/Coches/detalle-app.html?id=${carId || ''}`;

            const html = await new Promise((resolve, reject) => {
                https.get(targetUrl, (res) => {
                    if (res.statusCode < 200 || res.statusCode >= 300) {
                        return reject(new Error('Status ' + res.statusCode));
                    }
                    let data = '';
                    res.on('data', chunk => data += chunk);
                    res.on('end', () => resolve(data));
                }).on('error', err => reject(err));
            });

            console.log("Successfully retrieved HTML shell via proxy.");
            res.set('Cache-Control', 'private, no-cache, no-store, must-revalidate');
            return res.status(200).send(html);
        } catch (error) {
            console.error("Failed to proxy HTML shell, falling back to JS redirect:", error);
            // Ultimate fallback if internal network fails
            return res.status(200).send(`<!DOCTYPE html><html><head><title>Autos JVeloce</title></head><body><script>window.location.href="/Coches/detalle-app.html?id=${carId || ''}";</script></body></html>`);
        }
    }

    // 2. It IS a bot and we HAVE a carId. Fetch from Firestore.
    try {
        const doc = await db.collection('anuncios').doc(carId).get();
        if (!doc.exists) {
            return res.status(404).send('Vehículo no encontrado');
        }

        const carData = doc.data();
        const carName = `${carData.brand} ${carData.model} ${carData.year || ''}`.trim();

        // Use the third exterior gallery image (large right image in UI) if available, fallback to main image
        let carImage = carData.image || 'https://autosjveloce.com/assets/logo%20con%20fondo.png';
        if (carData.galleryExterior && carData.galleryExterior[2]) {
            carImage = carData.galleryExterior[2];
        }
        let description = `${carData.price}€`;
        if (carData.fuel) description += ` | ${carData.fuel}`;
        if (carData.km) description += ` | ${carData.km}`;
        description += ` - Descubre este increíble ${carName} en Autos JVeloce Jaén.`;

        // 3. Return the exact Meta Tags the bot needs (No javascript required)
        const rawHtml = `<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <title>${carName} | Autos JVeloce Jaén</title>
    <meta name="description" content="${description}">
    
    <!-- Open Graph (Facebook, WhatsApp) -->
    <meta property="og:title" content="${carName} | Autos JVeloce">
    <meta property="og:description" content="${description}">
    <meta property="og:image" content="${carImage}">
    <meta property="og:image:width" content="1200">
    <meta property="og:image:height" content="630">
    <meta property="og:url" content="https://autosjveloce.com/Coches/detalle.html?id=${carId}">
    <meta property="og:type" content="article">
    
    <!-- Twitter Card -->
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${carName} | Autos JVeloce">
    <meta name="twitter:description" content="${description}">
    <meta name="twitter:image" content="${carImage}">
    
    <!-- Explicit icon tags for messenger apps -->
    <link rel="icon" href="https://autosjveloce.com/assets/icons/favicon.png" sizes="48x48">
    <link rel="apple-touch-icon" href="https://autosjveloce.com/assets/icons/favicon.png">
</head>
<body>
    <h1>${carName}</h1>
    <p>${description}</p>
    <img src="${carImage}" alt="${carName}">
    <script>
        // Just in case a real browser accidentally gets here, redirect them nicely
        window.location.replace("/Coches/detalle-app.html?id=${carId}");
    </script>
</body>
</html>`;

        res.set('Cache-Control', 'private, no-cache, no-store, must-revalidate');
        return res.status(200).send(rawHtml);

    } catch (error) {
        console.error("Error fetching car for bot:", error);
        return res.status(500).send('Error interno del servidor');
    }
});

// Export the Express app as a Firebase Cloud Function
exports.renderSocialTags = functions.https.onRequest(app);
