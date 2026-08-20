/* ============================================================
   COSMIC MONKEY — main.js

   Performance note: Vimeo iframes use data-src and are loaded
   lazily by initLazyIframes() at the bottom of this file.
   ============================================================ */
   Starfield canvas + Lenis smooth scroll + GSAP flythrough
   ============================================================ */

/* ---------------------------------------------------------------
   0. PROPORTIONAL SCALE-TO-FIT
   Locks the design to a 1440px canvas and zooms it to fit the
   viewport. Runs before Lenis/GSAP so layout is settled when
   ScrollTrigger calculates pin positions.

   Constraints:
     - min scale 0.65  → below this, mobile layout takes over
     - max scale 1.35  → beyond this, canvas centers with margins
     - below 900px viewport → zoom disabled, mobile CSS handles it
   --------------------------------------------------------------- */
(function initScale() {
  const DESIGN_W  = 1440;
  const MIN_SCALE = 0.65;
  const MAX_SCALE = 1.35;
  const MOBILE_BP = 900;

  const root = document.getElementById('scale-root');
  if (!root) return;

  let rafTimer;

  function applyScale() {
    const vw = window.innerWidth;

    if (vw < MOBILE_BP) {
      // Hand off to mobile/tablet CSS — clear any inline overrides
      root.style.width      = '';
      root.style.zoom       = '';
      root.style.marginLeft = '';
      return;
    }

    const raw   = vw / DESIGN_W;
    const scale = Math.min(Math.max(raw, MIN_SCALE), MAX_SCALE);

    root.style.width = DESIGN_W + 'px';
    root.style.zoom  = scale;

    // Ultrawide: center the canvas with equal side margins
    root.style.marginLeft = raw > MAX_SCALE
      ? ((vw - DESIGN_W * MAX_SCALE) / 2) + 'px'
      : '';
  }

  // Debounced resize — also refreshes ScrollTrigger after layout settles
  window.addEventListener('resize', function () {
    cancelAnimationFrame(rafTimer);
    rafTimer = requestAnimationFrame(function () {
      applyScale();
      if (typeof ScrollTrigger !== 'undefined') ScrollTrigger.refresh();
    });
  });

  // Apply immediately so layout is correct before GSAP/Lenis init
  applyScale();
})();

/* ---------------------------------------------------------------
   1. LENIS SMOOTH SCROLL
   --------------------------------------------------------------- */
const lenis = new Lenis({
  duration: 1.3,
  easing: t => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
  smoothWheel: true,
  wheelMultiplier: 0.9,
});

gsap.registerPlugin(ScrollTrigger);

// Wire Lenis → GSAP ticker so ScrollTrigger sees smooth positions
gsap.ticker.add(time => lenis.raf(time * 1000));
gsap.ticker.lagSmoothing(0);
lenis.on('scroll', ScrollTrigger.update);

/* ---------------------------------------------------------------
   2. SPLASH SPACE DUST
   Soft glowing particles concentrated around the logo,
   slowly drifting outward in loose orbits. Fades in with the logo.
   --------------------------------------------------------------- */
(function initDust() {
  const dc  = document.getElementById('dust-canvas');
  const dctx = dc.getContext('2d');
  let DW, DH, cx, cy;

  function resizeDust() {
    DW = dc.width  = dc.offsetWidth;
    DH = dc.height = dc.offsetHeight;
    cx = DW / 2;
    cy = DH / 2;
  }
  resizeDust();
  window.addEventListener('resize', resizeDust);

  // Palette — mirrors the holographic gradient
  const COLORS = [
    [180, 200, 240],  // periwinkle blue
    [220, 180, 240],  // lavender
    [240, 190, 210],  // rose pink
    [240, 230, 200],  // warm cream
    [160, 200, 240],  // sky blue
    [200, 160, 255],  // violet
  ];

  // Build two particle tiers: fine dust + larger soft glows
  const DUST = Array.from({ length: 260 }, (_, i) => {
    const isFine = i < 200;
    const angle  = Math.random() * Math.PI * 2;
    // Concentrate near logo: exponential distribution of radii
    const spread = isFine ? 0.42 : 0.28;
    const radius = Math.pow(Math.random(), 1.6) * (isFine ? 0.38 : 0.22);
    const col    = COLORS[Math.floor(Math.random() * COLORS.length)];
    return {
      angle,
      radius,            // normalised 0–1 of half-viewport width
      speed:  (Math.random() * 0.0002 + 0.00005) * (Math.random() < 0.5 ? 1 : -1),
      drift:  (Math.random() - 0.5) * 0.00008,   // gentle radial drift
      size:   isFine
                ? 0.6 + Math.random() * 1.2
                : 3   + Math.random() * 7,
      opacity: isFine
                ? 0.25 + Math.random() * 0.55
                : 0.04 + Math.random() * 0.12,
      col,
      twinkle: Math.random() * Math.PI * 2,
      twinkleSpeed: 0.0008 + Math.random() * 0.0015,
      isFine,
    };
  });

  let startTime = null;
  const FADE_DURATION = 3200; // ms — matches logo fade-in

  function drawDust(ts) {
    if (!startTime) startTime = ts;
    const elapsed  = ts - startTime;
    const globalOp = Math.min(1, elapsed / FADE_DURATION); // fade whole system in

    dctx.clearRect(0, 0, DW, DH);

    const refR = Math.min(DW, DH) * 0.5; // reference radius

    for (const p of DUST) {
      // Orbital motion
      p.angle  += p.speed;
      p.radius += p.drift;
      // Keep dust from drifting too far or collapsing inward
      if (p.radius > (p.isFine ? 0.44 : 0.30)) p.drift *= -1;
      if (p.radius < 0.01) p.drift = Math.abs(p.drift);

      const x  = cx + Math.cos(p.angle) * p.radius * refR;
      const y  = cy + Math.sin(p.angle) * p.radius * refR * 0.55; // flatten to ellipse
      const tw = 0.75 + 0.25 * Math.sin(ts * p.twinkleSpeed + p.twinkle);
      const op = p.opacity * tw * globalOp;

      const [r, g, b] = p.col;

      if (p.isFine) {
        // Crisp tiny dot
        dctx.beginPath();
        dctx.arc(x, y, p.size, 0, Math.PI * 2);
        dctx.fillStyle = `rgba(${r},${g},${b},${op.toFixed(3)})`;
        dctx.fill();
      } else {
        // Soft radial glow blob
        const grd = dctx.createRadialGradient(x, y, 0, x, y, p.size);
        grd.addColorStop(0, `rgba(${r},${g},${b},${op.toFixed(3)})`);
        grd.addColorStop(1, `rgba(${r},${g},${b},0)`);
        dctx.beginPath();
        dctx.arc(x, y, p.size, 0, Math.PI * 2);
        dctx.fillStyle = grd;
        dctx.fill();
      }
    }

    if (globalOp < 1 || true) requestAnimationFrame(drawDust);
  }

  requestAnimationFrame(drawDust);

  // Logo starts at 50% size and grows to full size before any scrolling
  const logoEl = document.querySelector('.splash-logo');
  if (logoEl) {
    gsap.set(logoEl, { y: 28, scale: 0.5, opacity: 0 });
    gsap.to(logoEl, {
      opacity: 1,
      y: 0,
      scale: 1,
      duration: 2.8,
      ease: 'power3.out',
      delay: 0.7,
    });
  }
})();

/* ---------------------------------------------------------------
   3. STARFIELD CANVAS
   Three depth layers at different parallax speeds.
   Stars drift upward as user scrolls (forward-motion illusion).
   --------------------------------------------------------------- */
const canvas = document.getElementById('starfield-canvas');
const ctx    = canvas.getContext('2d');
let W, H;

function resizeCanvas() {
  W = canvas.width  = window.innerWidth;
  H = canvas.height = window.innerHeight;
}
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

// Build star pool — halved on mobile to cut canvas CPU
const isMobile = window.innerWidth <= 768;
const LAYERS = [
  { count: isMobile ?  90 : 220, r: 0.7,  opacity: 0.50, parallax: 0.04 },
  { count: isMobile ?  45 : 110, r: 1.1,  opacity: 0.72, parallax: 0.10 },
  { count: isMobile ?  20 :  55, r: 1.7,  opacity: 0.95, parallax: 0.22 },
];

const stars = LAYERS.flatMap(layer =>
  Array.from({ length: layer.count }, () => ({
    nx: Math.random(),                              // 0–1 normalized x
    ny: Math.random(),                              // 0–1 normalized y
    r:  layer.r + Math.random() * 0.5,
    o:  layer.opacity * (0.6 + Math.random() * 0.4),
    parallax: layer.parallax,
    twinkleOffset: Math.random() * Math.PI * 2,
  }))
);

let scrollY = 0;
lenis.on('scroll', e => { scrollY = e.scroll; });

function drawStars(ts) {
  ctx.clearRect(0, 0, W, H);

  for (const s of stars) {
    // Parallax: near stars drift up faster, giving depth
    const drift  = (scrollY * s.parallax) % H;
    const y      = ((s.ny * H) - drift + H * 4) % H;
    const x      = s.nx * W;
    const twinkle = 0.8 + 0.2 * Math.sin(ts * 0.0012 + s.twinkleOffset);

    ctx.beginPath();
    ctx.arc(x, y, s.r, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255,255,255,${(s.o * twinkle).toFixed(3)})`;
    ctx.fill();
  }
}

// Occasional bright "sparkle" stars
const sparkles = Array.from({ length: 8 }, () => ({
  nx: Math.random(), ny: Math.random(), phase: Math.random() * Math.PI * 2,
}));

function drawSparkles(ts) {
  for (const sp of sparkles) {
    const intensity = 0.5 + 0.5 * Math.sin(ts * 0.0008 + sp.phase);
    if (intensity < 0.6) continue;
    const x = sp.nx * W;
    const y = sp.ny * H;
    const size = 2.5 * intensity;

    // 4-point star shape
    ctx.save();
    ctx.translate(x, y);
    ctx.strokeStyle = `rgba(200, 210, 255, ${(intensity * 0.9).toFixed(2)})`;
    ctx.lineWidth = 0.5;
    for (let a = 0; a < 4; a++) {
      ctx.beginPath();
      ctx.moveTo(0, 0);
      const ang = (a * Math.PI) / 2;
      ctx.lineTo(Math.cos(ang) * size, Math.sin(ang) * size);
      ctx.stroke();
    }
    ctx.restore();
  }
}

function rafLoop(ts) {
  drawStars(ts);
  drawSparkles(ts);
  requestAnimationFrame(rafLoop);
}
requestAnimationFrame(rafLoop);

/* ---------------------------------------------------------------
   3. NEBULA PARALLAX
   Each nebula layer drifts at a different rate on scroll.
   --------------------------------------------------------------- */
const nebulaConfigs = [
  { el: '.nebula-blue',        rate: 0.08 },
  { el: '.nebula-purple',      rate: 0.14 },
  { el: '.nebula-orange',      rate: 0.20 },
];

nebulaConfigs.forEach(({ el, rate }) => {
  const node = document.querySelector(el);
  if (!node) return;
  ScrollTrigger.create({
    start: 0,
    end: 'max',
    onUpdate: self => {
      const y = self.scroll() * rate * -1;
      gsap.set(node, { y, force3D: true });
    },
  });
});

/* ---------------------------------------------------------------
   4. FLYTHROUGH SCROLL ANIMATIONS
   Each .waypoint section is 150vh tall; its .scene is sticky at top.
   GSAP scrubs the scene through: approach → hold → exit.

   Timeline percentages across the 150vh scroll range:
     0–33% : approach  (distant → in-focus)
     33–67% : hold      (fully visible)
     67–100% : exit     (fly past)
   --------------------------------------------------------------- */

// Splash exits as you scroll away from it
gsap.to('#splash .scene', {
  scale:   1.14,
  opacity: 0,
  filter:  'blur(5px)',
  ease:    'none',
  scrollTrigger: {
    trigger: '#splash',
    start:   'top top',
    end:     'bottom top',
    scrub:   1.2,
  },
});

// Sections 2–6: approach + hold + exit
const waypoints = ['#whats', '#creative', '#about', '#tv-film', '#branded', '#vertical', '#contact'];

waypoints.forEach(id => {
  const section = document.querySelector(id);
  if (!section) return;
  const scene   = section.querySelector('.scene');
  const propImg = section.querySelector('.prop-img');

  // Main scene flythrough
  const tl = gsap.timeline({
    scrollTrigger: {
      trigger: section,
      start:   'top bottom',   // begin when section enters viewport bottom
      end:     'bottom top',   // finish when section leaves viewport top
      scrub:   1.2,
    },
    defaults: { ease: 'none' },
  });

  tl
    // Approach: distant → in-focus (first ~40% of scroll travel)
    .fromTo(scene,
      { scale: 0.62, opacity: 0, filter: 'blur(8px)' },
      { scale: 1,    opacity: 1, filter: 'blur(0px)', duration: 0.42 }
    )
    // Hold: stay sharp (middle ~20%)
    .to(scene,
      { scale: 1, opacity: 1, filter: 'blur(0px)', duration: 0.18 }
    )
    // Exit: fly past (final ~40%)
    .to(scene,
      { scale: 1.12, opacity: 0, filter: 'blur(4px)', duration: 0.40 }
    );

  // Prop images arrive slightly ahead of the text (they're the focal point)
  if (propImg) {
    gsap.fromTo(propImg,
      { scale: 0.5, y: 50, opacity: 0 },
      {
        scale: 1, y: 0, opacity: 1, ease: 'none',
        scrollTrigger: {
          trigger: section,
          start:   'top 85%',
          end:     'center 45%',
          scrub:   1,
        },
      }
    );
  }
});

/* ---------------------------------------------------------------
   5. NAV LOGO VISIBILITY
   Hidden during splash; fades in once splash leaves viewport.
   --------------------------------------------------------------- */
const navLogo = document.getElementById('nav-logo');

ScrollTrigger.create({
  trigger: '#splash',
  start:   'bottom 90%',    // just as splash exits top
  onEnter:       () => navLogo.classList.add('visible'),
  onLeaveBack:   () => navLogo.classList.remove('visible'),
});


/* ---------------------------------------------------------------
   6. BIO CARDS ENTRANCE STAGGER
   Individual cards pop in with a small stagger as About enters.
   --------------------------------------------------------------- */
const bioCards = document.querySelectorAll('.bio-card');
if (bioCards.length) {
  gsap.fromTo(bioCards,
    { opacity: 0, y: 30, scale: 0.88 },
    {
      opacity: 1, y: 0, scale: 1,
      stagger: 0.15,
      ease: 'power2.out',
      scrollTrigger: {
        trigger: '#about',
        start:   'top 60%',
        end:     'top 20%',
        scrub:   false,
        toggleActions: 'play none none reverse',
      },
    }
  );
}

/* ---------------------------------------------------------------
   7. LAZY-LOAD VIMEO IFRAMES
   All iframes use data-src so they don't connect to Vimeo on
   page load. IntersectionObserver promotes data-src → src when
   the section is 400px from entering the viewport.
   --------------------------------------------------------------- */
(function initLazyIframes() {
  const iframes = document.querySelectorAll('iframe[data-src]');
  if (!iframes.length) return;

  const observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (!entry.isIntersecting) return;
      const iframe = entry.target;
      iframe.src = iframe.dataset.src;
      observer.unobserve(iframe);
    });
  }, { rootMargin: '400px' });

  iframes.forEach(function (iframe) { observer.observe(iframe); });
})();

/* ---------------------------------------------------------------
   8. MOBILE BIO TAP INTERACTION
   Tapping an oval opens a shared detail panel below with that
   person's bio. Tapping the same oval again collapses it.
   Only active on mobile (≤768px).
   --------------------------------------------------------------- */
(function initMobileBios() {
  if (window.innerWidth > 768) return;

  const cards  = document.querySelectorAll('.bio-card');
  const detail = document.getElementById('bio-detail');
  if (!detail || !cards.length) return;

  cards.forEach(card => {
    card.addEventListener('click', () => {
      const already = card.classList.contains('bio-active');

      // Collapse any open panel first
      cards.forEach(c => c.classList.remove('bio-active'));
      detail.classList.remove('bio-open');

      if (already) {
        // Second tap on same card: just collapse
        setTimeout(() => { detail.innerHTML = ''; }, 400);
        return;
      }

      // Populate and open
      const name  = card.querySelector('.bio-name')?.textContent  || '';
      const role  = card.querySelector('.bio-title')?.textContent || '';
      const body  = card.querySelector('.bio-body')?.textContent  || '';

      detail.innerHTML = `
        <p class="bio-detail-name">${name}</p>
        <p class="bio-detail-role">${role}</p>
        <p class="bio-detail-body">${body}</p>
      `;

      card.classList.add('bio-active');
      // rAF ensures max-height transition fires after display
      requestAnimationFrame(() => detail.classList.add('bio-open'));
    });
  });
})();
