/**
 * Gallery Lightbox with Zoom & Pan
 * Supports Mouse and Touch events.
 */

document.addEventListener('DOMContentLoaded', () => {
    const lightbox = document.getElementById('lightbox');
    const lightboxImg = document.getElementById('lightbox-img');
    const closeBtn = document.querySelector('.lightbox-close');
    const galleryItems = document.querySelectorAll('.gallery-item img');

    let isZoomed = false;

    // 1. Open Lightbox
    galleryItems.forEach(img => {
        img.addEventListener('click', () => {
            lightbox.classList.add('active');
            lightboxImg.src = img.src;
            document.body.style.overflow = 'hidden'; // Prevent background scroll
            isZoomed = false;
            resetZoom();
        });
    });

    // 2. Close Lightbox
    function closeLightbox() {
        lightbox.classList.remove('active');
        document.body.style.overflow = '';
        isZoomed = false;
        resetZoom();
    }

    closeBtn.addEventListener('click', closeLightbox);

    // Close on background click (if not zooming)
    lightbox.addEventListener('click', (e) => {
        if (e.target === lightbox || e.target.closest('.lightbox-content') === null) {
            closeLightbox();
        }
    });

    // 3. Zoom Logic
    lightboxImg.addEventListener('click', (e) => {
        e.stopPropagation(); // Don't trigger background close
        toggleZoom(e);
    });

    function toggleZoom(e) {
        if (isZoomed) {
            resetZoom();
        } else {
            zoomIn(e);
        }
        isZoomed = !isZoomed;
    }

    function zoomIn(e) {
        lightboxImg.classList.add('zoomed');
        moveImage(e); // Center zoom on click
    }

    function resetZoom() {
        lightboxImg.classList.remove('zoomed');
        lightboxImg.style.transformOrigin = 'center center';
    }

    // 4. Pan Logic (Mouse)
    lightboxImg.addEventListener('mousemove', (e) => {
        if (isZoomed) {
            moveImage(e);
        }
    });

    // 5. Pan Logic (Touch)
    lightboxImg.addEventListener('touchmove', (e) => {
        if (isZoomed) {
            e.preventDefault(); // Prevent scroll
            const touch = e.touches[0];
            moveImage(touch);
        }
    }, { passive: false });


    function moveImage(e) {
        const rect = lightboxImg.getBoundingClientRect();

        // Calculate position relative to the image
        // (Note: we need the rect of the container or the image itself before scale)
        // A simpler approach for "magnifying glass" style:

        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        // We want the transform origin to be where the mouse is
        // But simply setting transform-origin moves the image around
        // Standard "Amazon" zoom usually uses background-position or strict layout
        // For transform: scale, changing origin works but requires offset calculation.

        // Simplified approach that works robustly:
        // When scaled, transform-origin dictates the "center" of the zoom.
        // We set transform-origin to the mouse position relative to the image element.

        // Since the image is usually centered in the viewport, we used clientX/Y relative to viewport
        // But we need percentage within the image.

        // Use the displayed width/height (which might be scaled, but we want the base rect)
        // Resetting transform temporarily to get true dimensions? No, too laggy.

        // Better:
        // Position percentage = (Mouse Pos inside Image) / (Image Width) * 100%

        const offsetX = e.clientX - (window.innerWidth - lightboxImg.offsetWidth) / 2;
        const offsetY = e.clientY - (window.innerHeight - lightboxImg.offsetHeight) / 2;

        const xPercent = (offsetX / lightboxImg.offsetWidth) * 100;
        const yPercent = (offsetY / lightboxImg.offsetHeight) * 100;

        lightboxImg.style.transformOrigin = `${xPercent}% ${yPercent}%`;
    }
});
