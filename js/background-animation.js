/**
 * Interactive Fog/Smoke Background
 * STEADY-STATE STRATIFIED VOLUMETRIC ENGINE (Mobile & Desktop)
 * - Desktop: 100% original behavior & aesthetics.
 * - Mobile: Stratified sector distribution + Sine-wave perpetual life cycle (Math.sin)
 *   Guarantees uniform, ordered studio fog that NEVER fades to black and runs at 60 FPS scroll.
 */

const canvas = document.createElement('canvas');
const ctx = canvas.getContext('2d', { alpha: false });
document.body.appendChild(canvas);

const isMobileDevice = () => window.matchMedia('(max-width: 768px), (hover: none) and (pointer: coarse)').matches;

const CONFIG = {
    get particleCount() {
        // 36 particles (divisible by 3 columns x 12 vertical strata) for perfectly ordered mobile symmetry
        return isMobileDevice() ? 36 : 100;
    },
    bgFill: '#000000',
    mouseRepelDist: 200,
    mouseRepelForce: 0.005
};

// --------------------------------------------------------
// 1. Desktop Original Smoke Sprite (256x256)
// --------------------------------------------------------
const spriteSize = 256;
const halfSprite = spriteSize / 2;
const smokeSprite = document.createElement('canvas');
smokeSprite.width = spriteSize;
smokeSprite.height = spriteSize;
const sCtx = smokeSprite.getContext('2d');

const grad = sCtx.createRadialGradient(halfSprite, halfSprite, 0, halfSprite, halfSprite, halfSprite * 0.82);
grad.addColorStop(0.0, 'rgba(225, 225, 225, 0.42)');
grad.addColorStop(0.25, 'rgba(220, 220, 220, 0.24)');
grad.addColorStop(0.52, 'rgba(215, 215, 215, 0.10)');
grad.addColorStop(0.78, 'rgba(210, 210, 210, 0.025)');
grad.addColorStop(1.0, 'rgba(210, 210, 210, 0)');

sCtx.fillStyle = grad;
sCtx.fillRect(0, 0, spriteSize, spriteSize);

// --------------------------------------------------------
// 2. Mobile Studio-Ordered Horizontal Wisp Variants (384x384)
// Subtle horizontal angles (-10deg to +10deg) match Desktop's sleek horizontal framing.
// Max semi-major axis = (128 * 0.82) * 1.60 = 167.9px < 192px canvas radius
// Guarantees >24px of pure 0.0 alpha border on all 4 sides (ZERO square edges).
// --------------------------------------------------------
const mobileCanvasSize = 384;
const halfMobileCanvas = mobileCanvasSize / 2;
const mobileAngles = [-0.18, -0.06, 0.06, 0.18];

const mobileCloudVariants = mobileAngles.map((angle) => {
    const vCanvas = document.createElement('canvas');
    vCanvas.width = mobileCanvasSize;
    vCanvas.height = mobileCanvasSize;
    const vCtx = vCanvas.getContext('2d');

    vCtx.save();
    vCtx.translate(halfMobileCanvas, halfMobileCanvas);
    vCtx.rotate(angle);
    vCtx.scale(1.60, 0.78);
    vCtx.drawImage(smokeSprite, -halfSprite, -halfSprite, spriteSize, spriteSize);
    vCtx.restore();

    return vCanvas;
});

let particles = [];
let mouse = { x: -9999, y: -9999 };
let scrollY = window.scrollY;
let scrollVel = 0;
let renderScale = 1;
let logicalWidth = window.innerWidth;
let logicalHeight = window.innerHeight;
let lastWidth = window.innerWidth;
let lastHeight = window.innerHeight;
let isMobile = isMobileDevice();

let isMobileScrolling = false;
let scrollStopTimer = null;

// Setup Main Canvas
canvas.id = 'bgCanvas';
canvas.style.position = 'fixed';
canvas.style.top = '0';
canvas.style.left = '0';
canvas.style.width = '100%';
canvas.style.height = '100%';
canvas.style.zIndex = '-1';
canvas.style.pointerEvents = 'none';
canvas.style.contain = 'strict';
canvas.style.transform = 'translateZ(0)';

function resize(force = false) {
    const currentWidth = window.innerWidth;
    const currentHeight = window.innerHeight;
    const wasMobile = isMobile;
    isMobile = isMobileDevice();

    // Ignore mobile browser URL bar height changes during vertical scroll
    if (!force && isMobile && currentWidth === lastWidth && Math.abs(currentHeight - lastHeight) < 180) {
        return;
    }

    lastWidth = currentWidth;
    lastHeight = currentHeight;
    logicalWidth = currentWidth;
    logicalHeight = currentHeight;

    renderScale = isMobile ? 0.30 : 1;
    canvas.width = Math.max(1, Math.round(logicalWidth * renderScale));
    canvas.height = Math.max(1, Math.round(logicalHeight * renderScale));
    ctx.setTransform(renderScale, 0, 0, renderScale, 0, 0);
    ctx.imageSmoothingEnabled = true;

    if (wasMobile !== isMobile) {
        init();
    } else if (!force && particles.length > 0) {
        renderFrame(0);
    }
}

window.addEventListener('resize', () => resize(false), { passive: true });
resize(true);

if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
    document.addEventListener('mousemove', (e) => {
        mouse.x = e.clientX;
        mouse.y = e.clientY;
    }, { passive: true });
}

document.addEventListener('scroll', () => {
    const newScroll = window.scrollY;
    const diff = newScroll - scrollY;
    scrollVel = Math.max(-22, Math.min(22, diff * 0.4));
    scrollY = newScroll;

    if (isMobile) {
        isMobileScrolling = true;
        if (scrollStopTimer) clearTimeout(scrollStopTimer);
        scrollStopTimer = setTimeout(() => {
            isMobileScrolling = false;
        }, 120);
    }
}, { passive: true });

class FogParticle {
    constructor(index = 0, total = 36) {
        this.index = index;
        this.total = total;
        this.variantIndex = index % mobileCloudVariants.length;
        this.reset(true);
    }

    /**
     * Computes an ordered, stratified position for mobile so smoke is evenly
     * distributed across 3 horizontal columns and balanced vertical bands (just like Desktop)
     */
    assignMobileStratifiedPosition() {
        const cols = 3;
        const col = this.index % cols;
        const colWidth = logicalWidth / cols;
        // Ordered column center + controlled organic jitter (prevents random clumping)
        this.x = (col + 0.15 + Math.random() * 0.70) * colWidth;

        // Stratified vertical bands matching Desktop's framing:
        // 42% Top Band (0% - 30% height), 42% Bottom Band (70% - 100% height), 16% Mid Veil (30% - 70% height)
        const bandIndex = Math.floor(this.index / cols); // 0 to 11
        if (bandIndex < 5) {
            // Top framing band (5 rows x 3 cols = 15 particles)
            const rowRatio = (bandIndex + Math.random() * 0.85) / 5;
            this.y = rowRatio * (logicalHeight * 0.32);
            this.vy = Math.random() * 0.14 + 0.04;
        } else if (bandIndex < 10) {
            // Bottom framing band (5 rows x 3 cols = 15 particles)
            const rowRatio = ((bandIndex - 5) + Math.random() * 0.85) / 5;
            this.y = logicalHeight - (rowRatio * (logicalHeight * 0.32));
            this.vy = -(Math.random() * 0.14 + 0.04);
        } else {
            // Subtle middle atmospheric veil (2 rows x 3 cols = 6 particles)
            const rowRatio = ((bandIndex - 10) + Math.random() * 0.85) / 2;
            this.y = logicalHeight * 0.30 + rowRatio * (logicalHeight * 0.40);
            this.vy = (Math.random() - 0.5) * 0.12;
        }

        // Gentle horizontal drift
        const dir = (this.index % 2 === 0) ? 1 : -1;
        this.vx = dir * (0.12 + Math.random() * 0.18);

        // Consistent volumetric size proportional to mobile width (avoids tiny dots or harsh blobs)
        const baseW = Math.min(logicalWidth, 430);
        this.size = baseW * (0.95 + (this.index % 3) * 0.18); // ~370px to ~520px

        // Peak opacity per cloud: uniform, silky atmospheric mist
        this.peakAlpha = (bandIndex >= 10) ? 0.24 : 0.36;
    }

    reset(startRandom = false) {
        if (isMobile) {
            this.assignMobileStratifiedPosition();

            // Sine-wave phase [0..1]:
            // On initial load (startRandom = true), stagger phases evenly across all 36 particles
            // so the smoke is in 100% steady-state equilibrium forever and NEVER fades out together.
            this.phase = startRandom
                ? ((this.index / this.total) + Math.random() * (1 / this.total)) % 1
                : 0.0;

            // Full breath cycle lasts ~14-20 seconds (at 60Hz equivalent dtFactor)
            this.phaseSpeed = 0.0009 + Math.random() * 0.0004;
            return;
        }

        // --- DESKTOP ORIGINAL LOGIC (100% UNCHANGED) ---
        this.x = Math.random() * logicalWidth;

        const zone = Math.random();
        if (zone < 0.45) {
            this.y = Math.random() * logicalHeight * 0.25;
            this.vy = Math.random() * 0.3 + 0.1;
        } else if (zone < 0.9) {
            this.y = logicalHeight - (Math.random() * logicalHeight * 0.25);
            this.vy = -Math.random() * 0.3 - 0.1;
        } else {
            this.y = Math.random() * logicalHeight;
            this.vy = (Math.random() - 0.5) * 0.2;
        }

        if (!startRandom) {
            this.y = (this.vy > 0) ? -100 : logicalHeight + 100;
        }

        this.vx = (Math.random() - 0.5) * 0.5;
        this.size = Math.random() * 400 + 200;
        this.life = Math.random() * 0.5 + 0.2;
        this.decay = Math.random() * 0.001 + 0.0005;
        this.angle = Math.random() * Math.PI * 2;
        this.angleVel = (Math.random() - 0.5) * 0.002;
        this.scaleX = 2 + Math.random();
        this.scaleY = 1 + Math.random();
    }

    update(dtFactor = 1) {
        if (dtFactor <= 0) return;

        if (isMobile) {
            this.x += this.vx * dtFactor;
            this.y += this.vy * dtFactor;
            this.y -= scrollVel * 0.06 * dtFactor;

            // Advance continuous sine-wave life cycle
            this.phase += this.phaseSpeed * dtFactor;

            // Bidirectional toroidal wrapping so scroll or drift NEVER pushes smoke off-screen
            const marginX = this.size * 0.35;
            if (this.x < -marginX) this.x += logicalWidth + marginX * 2;
            if (this.x > logicalWidth + marginX) this.x -= logicalWidth + marginX * 2;

            const marginY = this.size * 0.30;
            if (this.y < -marginY) this.y += logicalHeight + marginY * 2;
            if (this.y > logicalHeight + marginY) this.y -= logicalHeight + marginY * 2;

            // When a cloud completes its smooth sine fade-out (phase >= 1), respawn in its stratified sector at alpha 0
            if (this.phase >= 1) {
                this.reset(false);
            }
            return;
        }

        // --- DESKTOP ORIGINAL UPDATE ---
        this.x += this.vx * dtFactor;
        this.y += this.vy * dtFactor;
        this.angle += this.angleVel * dtFactor;
        this.y -= scrollVel * 0.1 * dtFactor;

        if (mouse.x > -1000) {
            const dx = this.x - mouse.x;
            const dy = this.y - mouse.y;
            const distSq = dx * dx + dy * dy;
            const maxDist = CONFIG.mouseRepelDist;

            if (distSq < maxDist * maxDist) {
                const dist = Math.sqrt(distSq);
                const angle = Math.atan2(dy, dx);
                const force = (maxDist - dist) / maxDist;
                const push = force * CONFIG.mouseRepelForce * 5 * dtFactor;

                this.vx += Math.cos(angle) * push;
                this.vy += Math.sin(angle) * push;
            }
        }

        this.vx *= Math.pow(0.99, dtFactor);
        this.life -= this.decay * dtFactor;

        if (this.life <= 0) this.reset(false);
    }

    draw() {
        if (isMobile) {
            // Smooth sine-wave envelope: 0.0 at birth -> 1.0 at mid-life -> 0.0 at end of cycle
            const sineEnvelope = Math.sin(Math.min(1, Math.max(0, this.phase)) * Math.PI);
            const alpha = sineEnvelope * this.peakAlpha;
            if (alpha <= 0.008) return;

            ctx.globalAlpha = alpha;
            const s = this.size;
            const sprite = mobileCloudVariants[this.variantIndex];
            ctx.drawImage(sprite, this.x - s / 2, this.y - s / 2, s, s);
            return;
        }

        // --- DESKTOP ORIGINAL DRAW ---
        if (this.life <= 0.01) return;

        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);
        ctx.scale(this.scaleX, this.scaleY);

        ctx.globalAlpha = this.life * 0.3;
        ctx.drawImage(smokeSprite, -this.size / 2, -this.size / 2, this.size, this.size);

        ctx.restore();
    }
}

function renderFrame(dtFactor = 1) {
    ctx.globalAlpha = 1;
    ctx.fillStyle = CONFIG.bgFill;
    ctx.fillRect(0, 0, logicalWidth, logicalHeight);

    for (let i = 0; i < particles.length; i++) {
        particles[i].update(dtFactor);
        particles[i].draw();
    }
}

function init() {
    particles = [];
    const count = CONFIG.particleCount;
    for (let i = 0; i < count; i++) {
        particles.push(new FogParticle(i, count));
    }
    renderFrame(1);
}

let lastFrameTime = performance.now();

function animate(now = performance.now()) {
    requestAnimationFrame(animate);

    if (document.hidden || isMobileScrolling) {
        lastFrameTime = now;
        return;
    }

    const elapsed = now - lastFrameTime;

    if (isMobile && elapsed < 40) {
        return;
    }

    const dtFactor = Math.min(elapsed / 16.667, 2.5);
    lastFrameTime = now;

    scrollVel *= Math.pow(0.9, dtFactor);
    renderFrame(dtFactor);
}

init();
animate();
