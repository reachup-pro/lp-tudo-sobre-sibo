// background.js — fundo interativo (rede de partículas) · Reset Intestinal / Karina
// Canvas fixo atrás do conteúdo, reage ao cursor. Respeita prefers-reduced-motion,
// pausa quando a aba perde foco e usa menos partículas no mobile.
const LILAC = '184,164,216';
const ROUGE = '214,120,132';

(function () {
  const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const canvas = document.createElement('canvas');
  canvas.className = 'bg-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  document.body.prepend(canvas);
  const ctx = canvas.getContext('2d');

  let w = 0, h = 0, dpr = 1, particles = [], raf = null, running = true;
  const mouse = { x: -9999, y: -9999, active: false };
  const LINK = 130;        // distância p/ ligar duas partículas
  const MOUSE_LINK = 190;  // alcance de interação com o cursor

  const isMobile = () => window.innerWidth < 720;

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = document.documentElement.clientWidth;
    h = window.innerHeight;
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    initParticles();
  }

  function initParticles() {
    const cap = isMobile() ? 32 : 74;
    const count = Math.max(12, Math.min(cap, Math.round((w * h) / 20000)));
    particles = [];
    for (let i = 0; i < count; i++) {
      particles.push({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.22,
        vy: (Math.random() - 0.5) * 0.22,
        r: Math.random() * 1.5 + 0.6,
        accent: Math.random() < 0.12
      });
    }
  }

  function step() {
    ctx.clearRect(0, 0, w, h);

    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      if (mouse.active) {
        const dx = mouse.x - p.x, dy = mouse.y - p.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < MOUSE_LINK * MOUSE_LINK && d2 > 1) {
          const f = 0.018 / Math.sqrt(d2);
          p.vx += dx * f; p.vy += dy * f;
        }
      }
      p.x += p.vx; p.y += p.vy;
      p.vx *= 0.99; p.vy *= 0.99;
      if (p.x < -10) p.x = w + 10; else if (p.x > w + 10) p.x = -10;
      if (p.y < -10) p.y = h + 10; else if (p.y > h + 10) p.y = -10;

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${p.accent ? ROUGE : LILAC},${p.accent ? 0.55 : 0.38})`;
      ctx.fill();
    }

    for (let i = 0; i < particles.length; i++) {
      const a = particles[i];
      for (let j = i + 1; j < particles.length; j++) {
        const b = particles[j];
        const dx = a.x - b.x, dy = a.y - b.y;
        const d = Math.hypot(dx, dy);
        if (d < LINK) {
          ctx.strokeStyle = `rgba(${LILAC},${0.13 * (1 - d / LINK)})`;
          ctx.lineWidth = 0.6;
          ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
        }
      }
      if (mouse.active) {
        const dx = a.x - mouse.x, dy = a.y - mouse.y;
        const d = Math.hypot(dx, dy);
        if (d < MOUSE_LINK) {
          ctx.strokeStyle = `rgba(${LILAC},${0.24 * (1 - d / MOUSE_LINK)})`;
          ctx.lineWidth = 0.7;
          ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(mouse.x, mouse.y); ctx.stroke();
        }
      }
    }

    if (running) raf = requestAnimationFrame(step);
  }

  window.addEventListener('resize', resize, { passive: true });
  window.addEventListener('mousemove', (e) => { mouse.x = e.clientX; mouse.y = e.clientY; mouse.active = true; }, { passive: true });
  window.addEventListener('mouseout', () => { mouse.active = false; });
  window.addEventListener('touchmove', (e) => { const t = e.touches[0]; if (t) { mouse.x = t.clientX; mouse.y = t.clientY; mouse.active = true; } }, { passive: true });
  window.addEventListener('touchend', () => { mouse.active = false; });
  document.addEventListener('visibilitychange', () => {
    running = !document.hidden && !reduce;
    if (running) { if (!raf) raf = requestAnimationFrame(step); }
    else if (raf) { cancelAnimationFrame(raf); raf = null; }
  });

  resize();
  if (reduce) { running = false; step(); }   // um frame estático
  else raf = requestAnimationFrame(step);
})();
