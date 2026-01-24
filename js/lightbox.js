/**
 * Gallery Lightbox with Dual-Mode Zoom
 * - Desktop: Click to Zoom, Mouse Move to Pan (Amazon style).
 * - Mobile: Tap to Zoom (2.5x), Pinch to Scale, Drag to Pan.
 */

document.addEventListener('DOMContentLoaded', () => {
    const lightbox = document.getElementById('lightbox');
    const lightboxImg = document.getElementById('lightbox-img');
    const closeBtn = document.querySelector('.lightbox-close');
    const galleryItems = document.querySelectorAll('.gallery-item img');

    // State
    let isZoomed = false;

    // Mobile State
    let scale = 1;
    let pointX = 0;
    let pointY = 0;
    let startX = 0;
    let startY = 0;
    let isDragging = false;

    // Open Lightbox
    galleryItems.forEach(img => {
        img.addEventListener('click', () => {
            lightbox.classList.add('active');
            lightboxImg.src = img.src;
            document.body.style.overflow = 'hidden';
            resetZoom();
        });
    });

    function closeLightbox() {
        lightbox.classList.remove('active');
        document.body.style.overflow = '';
        resetZoom();
    }

    closeBtn.addEventListener('click', closeLightbox);

    lightbox.addEventListener('click', (e) => {
        if (e.target === lightbox) closeLightbox();
    });

    // --- CORE LOGIC ---

    // 1. DESKTOP (Mouse)
    lightboxImg.addEventListener('click', (e) => {
        // Only trigger Desktop logic if not a touch event (simple heuristic)
        // We will preventDefault on touchstart/touchend to avoid click firing on mobile
        if (e.pointerType === 'mouse' || !('ontouchstart' in window)) {
            toggleDesktopZoom(e);
        }
    });

    lightboxImg.addEventListener('mousemove', (e) => {
        if (isZoomed && scale === 1) { // scale 1 means we are in "css transform-origin" mode
            moveImageDesktop(e);
        }
    });

    // 2. MOBILE (Touch)
    let initialDistance = 0;
    let initialScale = 1;
    let lastTap = 0;

    lightboxImg.addEventListener('touchstart', (e) => {
        if (e.touches.length === 1) {
            // Drag or Tap
            startX = e.touches[0].clientX - pointX;
            startY = e.touches[0].clientY - pointY;
            isDragging = true;
        } else if (e.touches.length === 2) {
            // Pinch Start
            isDragging = false;
            initialDistance = getDistance(e.touches);
            initialScale = scale;
        }
    }, { passive: false });

    lightboxImg.addEventListener('touchmove', (e) => {
        e.preventDefault(); // Prevent body scroll

        if (e.touches.length === 1 && isDragging && scale > 1) {
            // Drag (Only if zoomed in)
            pointX = e.touches[0].clientX - startX;
            pointY = e.touches[0].clientY - startY;
            updateTransform();
        } else if (e.touches.length === 2) {
            // Pinch
            const currentDistance = getDistance(e.touches);
            const distanceDiff = currentDistance / initialDistance;
            scale = initialScale * distanceDiff;
            scale = Math.max(1, Math.min(scale, 4)); // Clamp scale 1x to 4x
            updateTransform();
        }
    }, { passive: false });

    lightboxImg.addEventListener('touchend', (e) => {
        isDragging = false;

        // Double Tap / Tap Logic for Mobile
        if (e.changedTouches.length === 1 && e.touches.length === 0) {
            const currentTime = new Date().getTime();
            const tapLength = currentTime - lastTap;

            // If dragging occurred significantly, it's not a tap
            // (But we didn't track drag distance for tap check, assume short time = tap)
            if (tapLength < 300 && tapLength > 0) {
                // Double Tap (Optional, or just Single Tap as requested)
                // User asked: "pulsara una vez para hacer zoom por defecto 2.5"
            } else {
                // Single Tap detection (debounced if needed, but here instant)
                // If we want instant tap-to-zoom:
            }

            // Implementing "Tap to Toggle Zoom"
            // We use a simple logic: if NOT zoomed, zoom in. If zoomed, do nothing?
            // "pulsara una vez para hacer zoom por defecto 2.5"

            // NOTE: 'click' event fires after touchend. 
            // We'll handle Tap here to be responsive and prevent ghost clicks.
            // But we need to distinguish Tap from Drag.
            // If Scale didn't change and Position didn't change much:

            // Simplified: If duration is short, treat as tap.
        }
        lastTap = new Date().getTime();

        // Boundary Check (Snap back)
        if (scale < 1) {
            scale = 1;
            pointX = 0;
            pointY = 0;
            updateTransform();
        }
    });

    // Dedicated Tap Handler for Mobile (using Click with touch check is unreliable/slow)
    lightboxImg.addEventListener('click', (e) => {
        // If it was a touch action, we handle zoom toggle
        // "pulsara una vez para hacer zoom"

        // We need to differentiate dragging vs clicking.
        // If 'scale' is 1, regular click zooms to 2.5
        // If 'scale' > 1, regular click does nothing (or zooms out?)
        // User said: "pulsara una vez para hacer zoom por defecto 2.5 y que pellizcara... y arrastre"

        // Let's implement: Tap -> Toggle between 1x and 2.5x
        if (('ontouchstart' in window) && (e.pointerType !== 'mouse')) {
            if (scale === 1) {
                scale = 2.5;
                // Center zoom?
                pointX = 0;
                pointY = 0;
                updateTransform();
                isZoomed = true;
            } else {
                // Should tap allow zoom out? standard UX says yes.
                // But user didn't specify. Assuming toggle.
                // scale = 1;
                // pointX = 0;
                // pointY = 0;
                // updateTransform();
                // isZoomed = false;
            }
        }
    });

    // --- HELPER FUNCTIONS ---

    function resetZoom() {
        isZoomed = false;
        scale = 1;
        pointX = 0;
        pointY = 0;

        // Reset styles
        lightboxImg.classList.remove('zoomed');
        lightboxImg.style.transform = '';
        lightboxImg.style.transformOrigin = 'center center';
    }

    // Desktop logic
    function toggleDesktopZoom(e) {
        if (isZoomed) {
            resetZoom();
        } else {
            isZoomed = true;
            lightboxImg.classList.add('zoomed');
            moveImageDesktop(e);
        }
    }

    function moveImageDesktop(e) {
        const offsetX = e.clientX - (window.innerWidth - lightboxImg.offsetWidth) / 2;
        const offsetY = e.clientY - (window.innerHeight - lightboxImg.offsetHeight) / 2;
        const xPercent = (offsetX / lightboxImg.offsetWidth) * 100;
        const yPercent = (offsetY / lightboxImg.offsetHeight) * 100;
        lightboxImg.style.transformOrigin = `${xPercent}% ${yPercent}%`;
    }

    // Mobile Logic update
    function updateTransform() {
        lightboxImg.style.transform = `translate(${pointX}px, ${pointY}px) scale(${scale})`;
        // Disable the desktop class styles if we are using manual transform
        lightboxImg.classList.remove('zoomed');
    }

    function getDistance(touches) {
        return Math.hypot(
            touches[0].clientX - touches[1].clientX,
            touches[0].clientY - touches[1].clientY
        );
    }
});
