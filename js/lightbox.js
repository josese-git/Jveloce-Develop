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

    // Tap detection state
    let tapStartTime = 0;
    let tapStartX = 0;
    let tapStartY = 0;

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
        // Only trigger Desktop logic if user is using a mouse (heuristically)
        // We use touchend for mobile taps now.
        if (e.pointerType === 'mouse' && !isDragging) {
            toggleDesktopZoom(e);
        }
    });

    lightboxImg.addEventListener('mousemove', (e) => {
        // Desktop Pan (only if not manually transformed by mobile logic)
        if (isZoomed && scale === 1) {
            moveImageDesktop(e);
        }
    });

    // 2. MOBILE (Touch)
    let initialDistance = 0;
    let initialScale = 1;

    lightboxImg.addEventListener('touchstart', (e) => {
        if (e.touches.length === 1) {
            // Drag Start
            // Records where the finger is relative to the current image position
            startX = e.touches[0].clientX - pointX;
            startY = e.touches[0].clientY - pointY;
            isDragging = true;

            // Tap Detection Start
            tapStartTime = new Date().getTime();
            tapStartX = e.touches[0].clientX;
            tapStartY = e.touches[0].clientY;

        } else if (e.touches.length === 2) {
            // Pinch Start
            isDragging = false;
            initialDistance = getDistance(e.touches);
            initialScale = scale;
        }
    }, { passive: false });

    lightboxImg.addEventListener('touchmove', (e) => {
        e.preventDefault(); // Prevent body scroll

        if (e.touches.length === 1 && isDragging) {
            // Drag logic
            // Calculate new position based on finger move
            const currentX = e.touches[0].clientX;
            const currentY = e.touches[0].clientY;

            // Only allow dragging if zoomed in
            if (scale > 1) {
                pointX = currentX - startX;
                pointY = currentY - startY;
                updateTransform();
            }

        } else if (e.touches.length === 2) {
            // Pinch logic
            const currentDistance = getDistance(e.touches);
            if (initialDistance > 0) {
                const distanceDiff = currentDistance / initialDistance;
                scale = initialScale * distanceDiff;
                scale = Math.max(1, Math.min(scale, 4)); // Clamp
                updateTransform();
            }
        }
    }, { passive: false });

    lightboxImg.addEventListener('touchend', (e) => {
        // Tap Detection
        if (e.changedTouches.length === 1 && e.touches.length === 0) {
            const currentTime = new Date().getTime();
            const tapDuration = currentTime - tapStartTime;

            const touch = e.changedTouches[0];
            const dist = Math.hypot(touch.clientX - tapStartX, touch.clientY - tapStartY);

            // If short duration and very little movement -> It's a TAP
            if (tapDuration < 300 && dist < 10) {
                handleMobileTap();
            }
        }

        isDragging = false;

        // Boundary / Snap Back
        if (scale < 1) {
            scale = 1;
            pointX = 0;
            pointY = 0;
            updateTransform();
        }
    });

    function handleMobileTap() {
        if (scale > 1.1) {
            // If zoomed in (approx), zoom out
            scale = 1;
            pointX = 0;
            pointY = 0;
            updateTransform();
            isZoomed = false;
        } else {
            // If not zoomed, zoom in to 2.5
            scale = 2.5;
            pointX = 0;
            pointY = 0; // Center zoom
            updateTransform();
            isZoomed = true;
        }
    }

    // --- HELPER FUNCTIONS ---

    function resetZoom() {
        isZoomed = false;
        scale = 1;
        pointX = 0;
        pointY = 0;

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

    function updateTransform() {
        lightboxImg.style.transform = `translate(${pointX}px, ${pointY}px) scale(${scale})`;
        lightboxImg.classList.remove('zoomed'); // Ensure manual transform takes precedence
    }

    function getDistance(touches) {
        return Math.hypot(
            touches[0].clientX - touches[1].clientX,
            touches[0].clientY - touches[1].clientY
        );
    }
});
