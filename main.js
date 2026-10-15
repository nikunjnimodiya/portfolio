/* ============================================================
   ONE continuous scrolling page.
   The frame animation is a FIXED background. Its frame is a pure
   function of how far down the page you are:
       progress = scrollY / (pageHeight - viewportHeight)   (0 -> 1)
       frame    = progress * (TOTAL_FRAMES - 1)
   Top of page = first frame, bottom of page = last frame.
   No autoplay, no separate "pages" - just scroll.
   ============================================================ */

document.documentElement.classList.add('js');

(function () {
  const SKIP_FRAMES = 10;                 // frames 0001-0010 are not used
  const TOTAL_FRAMES = 144 - SKIP_FRAMES; // 134 frames: frame_0011 -> frame_0144
  // Base URL where the frames are hosted. Change ONLY this line if you move
  // the frames to another host/CDN (no trailing slash).
  const FRAME_BASE_URL = 'https://nikunjnimodiya.github.io/portfolio/frames';
  const FRAME_PATH = (i) => `${FRAME_BASE_URL}/frame_${String(i + SKIP_FRAMES).padStart(4, '0')}.jpg`;

  const SMOOTHING = 0.25; // 0-1: higher = snappier, lower = silkier

  const canvas = document.getElementById('charCanvas');
  const stage = document.getElementById('stage');
  const ctx = canvas.getContext('2d');
  const loader = document.getElementById('loader');
  const loaderFill = document.getElementById('loaderFill');
  const loaderPercent = document.getElementById('loaderPercent');
  const railDots = Array.from(document.querySelectorAll('.rail-dot'));
  const sections = Array.from(document.querySelectorAll('.section'));

  const images = new Array(TOTAL_FRAMES);
  let loadedCount = 0;
  let currentFrame = -1;
  let ready = false;
  let rafId = null;
  let target = 0;   // where the scroll position says we should be (0-1)
  let shown = 0;    // eased value actually drawn (0-1)
  let lastW = 0, lastH = 0;

  /* ---------- Canvas ---------- */
  function resizeCanvas(force) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = stage.clientWidth, h = stage.clientHeight;
    // Mobile browsers fire resize while the address bar slides; ignore tiny height-only changes.
    if (!force && w === lastW && Math.abs(h - lastH) < 150) return;
    lastW = w; lastH = h;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    if (ready) drawFrame(currentFrame, true);
  }

  function drawFrame(index, force) {
    if (!force && index === currentFrame) return;
    const img = images[index];
    if (!img || !img.complete || img.naturalWidth === 0) return;
    const cw = canvas.width, ch = canvas.height;
    const iw = img.naturalWidth, ih = img.naturalHeight;
    const scale = Math.max(cw / iw, ch / ih); // "cover" fit
    const dw = iw * scale, dh = ih * scale;
    ctx.clearRect(0, 0, cw, ch);
    ctx.drawImage(img, (cw - dw) / 2, (ch - dh) / 2, dw, dh);
    currentFrame = index;
    window.__currentFrame = index; // exposed for debugging/QA
  }

  /* ---------- Scroll -> progress ---------- */
  function computeProgress() {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    return max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
  }

  function updateRail() {
    let activeId = sections[0].id;
    const probe = window.innerHeight * 0.45;
    sections.forEach((s) => { if (s.getBoundingClientRect().top <= probe) activeId = s.id; });
    if (target > 0.995) activeId = sections[sections.length - 1].id; // bottom of page
    railDots.forEach((d) => d.classList.toggle('active', d.dataset.goto === activeId));
  }

  function tick() {
    shown += (target - shown) * SMOOTHING;
    if (Math.abs(target - shown) < 0.0003) shown = target;
    drawFrame(Math.round(shown * (TOTAL_FRAMES - 1)), false);
    rafId = shown !== target ? requestAnimationFrame(tick) : null;
  }

  function onScroll() {
    if (!ready) return;
    target = computeProgress();
    updateRail();
    if (rafId === null) rafId = requestAnimationFrame(tick);
  }

  /* ---------- Preload ---------- */
  function preload() {
    for (let i = 1; i <= TOTAL_FRAMES; i++) {
      const img = new Image();
      img.decoding = 'async';
      img.onload = img.onerror = handleLoaded;
      img.src = FRAME_PATH(i);
      images[i - 1] = img;
    }
  }

  function handleLoaded() {
    loadedCount++;
    const pct = Math.round((loadedCount / TOTAL_FRAMES) * 100);
    loaderFill.style.width = pct + '%';
    loaderPercent.textContent = pct + '%';

    if (loadedCount === TOTAL_FRAMES) {
      ready = true;
      resizeCanvas(true);
      target = shown = computeProgress(); // start exactly where the page already is
      drawFrame(Math.round(shown * (TOTAL_FRAMES - 1)), true);
        updateRail();
      requestAnimationFrame(() => loader.classList.add('hidden'));
      window.addEventListener('scroll', onScroll, { passive: true });
    }
  }

  /* ---------- Navigation: [data-goto] scrolls smoothly to a section ---------- */
  document.addEventListener('click', (e) => {
    const trigger = e.target.closest('[data-goto]');
    if (!trigger) return;
    e.preventDefault();
    const el = document.getElementById(trigger.dataset.goto);
    if (el) {
      const top = trigger.dataset.goto === 'hero' ? 0 : el.getBoundingClientRect().top + window.scrollY;
      window.scrollTo({ top, behavior: 'smooth' });
    }
    const navLinks = document.getElementById('navLinks');
    if (navLinks) navLinks.classList.remove('open');
  });

  window.addEventListener('resize', () => {
    resizeCanvas(false);
    if (ready) onScroll();
  });

  /* ---------- Reveal-on-scroll (purely cosmetic, does not touch the animation) ---------- */
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } });
    }, { threshold: 0.08, rootMargin: '0px 0px -6% 0px' });
    document.querySelectorAll('.reveal').forEach((el) => io.observe(el));
  } else {
    document.querySelectorAll('.reveal').forEach((el) => el.classList.add('in'));
  }

  window.addEventListener('load', () => {
    resizeCanvas(true);
    preload();
  });
})();

/* ============================================================
   Mobile nav toggle
   ============================================================ */
(function () {
  const toggle = document.getElementById('navToggle');
  const links = document.getElementById('navLinks');
  if (!toggle || !links) return;
  toggle.addEventListener('click', () => links.classList.toggle('open'));
})();

/* Footer year */
document.getElementById('year').textContent = new Date().getFullYear();
