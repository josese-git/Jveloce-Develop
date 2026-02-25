/**
 * Generate sitemap.xml with image data from Firebase
 * Run with: node generate-sitemap.js
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import { writeFileSync } from 'fs';

const firebaseConfig = {
    apiKey: "AIzaSyAKr2_t_-JjzeiO8G8vQUkitqgDXi49ih0",
    authDomain: "jveloce-cf602.firebaseapp.com",
    projectId: "jveloce-cf602",
    storageBucket: "jveloce-cf602.firebasestorage.app",
    messagingSenderId: "779415799900",
    appId: "1:779415799900:web:759f5e87559312550dfe99",
    measurementId: "G-YSCZ95T9LY"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const BASE_URL = 'https://autosjveloce.com';
const COLLECTION_NAME = 'anuncios';

async function generateSitemap() {
    console.log('🔄 Generando sitemap con imágenes...');

    try {
        // Fetch all vehicles from Firebase
        const querySnapshot = await getDocs(collection(db, COLLECTION_NAME));
        const vehicles = [];

        querySnapshot.forEach((doc) => {
            const data = doc.data();
            vehicles.push({
                id: doc.id,
                ...data
            });
        });

        console.log(`✅ Encontrados ${vehicles.length} vehículos`);

        // Generate XML
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

    <!-- Coches publicados -->
`;

        // Add each vehicle with its images
        vehicles.forEach(vehicle => {
            const carName = `${vehicle.brand} ${vehicle.model} ${vehicle.year || ''}`.trim();

            xml += `    <url>
        <loc>${BASE_URL}/Coches/detalle.html?id=${encodeURIComponent(vehicle.id)}</loc>
        <lastmod>${getCurrentDate()}</lastmod>
        <changefreq>weekly</changefreq>
        <priority>0.8</priority>
`;

            // Add main image
            if (vehicle.image) {
                xml += generateImageTag(vehicle.image, `${carName} - Imagen principal`);
            }

            // Add exterior gallery images
            if (vehicle.galleryExterior && Array.isArray(vehicle.galleryExterior)) {
                const exteriorViews = ['Vista frontal', 'Vista 3/4 frontal', 'Vista lateral', 'Vista 3/4 trasera', 'Vista trasera'];
                vehicle.galleryExterior.filter(img => img).forEach((img, index) => {
                    const caption = `${carName} - ${exteriorViews[index] || `Exterior ${index + 1}`}`;
                    xml += generateImageTag(img, caption);
                });
            }

            // Add interior gallery images
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

        // Write to sitemap file
        writeFileSync('sitemap.xml', xml, 'utf8');
        console.log('✅ Sitemap generado exitosamente: sitemap.xml');
        console.log(`📊 Total de URLs: ${vehicles.length + 2}`);

        // --- NEW: Inject static links into index.html for SEO ---
        console.log('🔄 Inyectando enlaces estáticos en index.html...');
        try {
            const fs = await import('fs');
            const indexPath = 'index.html';
            let indexHtml = fs.readFileSync(indexPath, 'utf8');

            let linksHtml = '\n';
            vehicles.forEach(vehicle => {
                const carName = `${vehicle.brand} ${vehicle.model} ${vehicle.year || ''}`.trim();
                const carUrl = `${BASE_URL}/Coches/detalle.html?id=${encodeURIComponent(vehicle.id)}`;
                linksHtml += `            <a href="${carUrl}">${escapeXml(carName)}</a>\n`;
            });
            linksHtml += '        ';

            // Regex to replace content between the injection markers
            const regex = /(<!-- SEO_LINKS_START -->)[\s\S]*?(<!-- SEO_LINKS_END -->)/;
            if (regex.test(indexHtml)) {
                indexHtml = indexHtml.replace(regex, `$1${linksHtml}$2`);
                fs.writeFileSync(indexPath, indexHtml, 'utf8');
                console.log('✅ Enlaces SEO inyectados exitosamente en index.html');
            } else {
                console.warn('⚠️ No se encontraron las marcas <!-- SEO_LINKS_START --> y <!-- SEO_LINKS_END --> en index.html');
            }
        } catch (htmlError) {
            console.error('❌ Error inyectando enlaces en index.html:', htmlError);
        }
        // --------------------------------------------------------

        // Count total images
        let totalImages = 0;
        vehicles.forEach(v => {
            if (v.image) totalImages++;
            if (v.galleryExterior) totalImages += v.galleryExterior.filter(img => img).length;
            if (v.galleryInterior) totalImages += v.galleryInterior.filter(img => img).length;
        });
        console.log(`🖼️  Total de imágenes: ${totalImages}`);

    } catch (error) {
        console.error('❌ Error generando sitemap:', error);
        process.exit(1);
    }

    process.exit(0);
}

function generateImageTag(imageUrl, caption) {
    // Escape XML special characters
    const escapedUrl = escapeXml(imageUrl);
    const escapedCaption = escapeXml(caption);

    return `        <image:image>
            <image:loc>${escapedUrl}</image:loc>
            <image:caption>${escapedCaption}</image:caption>
        </image:image>
`;
}

function escapeXml(unsafe) {
    return unsafe
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

function getCurrentDate() {
    const now = new Date();
    return now.toISOString().split('T')[0];
}

// Run the generator
generateSitemap();
