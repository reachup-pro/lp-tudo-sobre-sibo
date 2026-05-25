/* ================================================================
   SIBO Curso · LP Oferta Imersão
   Countdown 24h + reveal on scroll + magnetic CTA
   ================================================================ */

(() => {
  'use strict';

  /* ---------- 0. Dev fallback: Netlify Image CDN -> caminho direto ---------- */
  const isLocal = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname) || location.protocol === 'file:';
  if (isLocal) {
    document.querySelectorAll('img').forEach((img) => {
      const remap = (val) => {
        if (!val) return val;
        return val.split(',').map((part) => {
          const trimmed = part.trim();
          const m = trimmed.match(/\/\.netlify\/images\?([^"\s]+)/);
          if (!m) return trimmed;
          const qs = new URLSearchParams(m[1]);
          const url = qs.get('url');
          const descriptor = trimmed.split(/\s+/).slice(1).join(' ');
          return url ? (descriptor ? `${url} ${descriptor}` : url) : trimmed;
        }).join(', ');
      };
      const src = img.getAttribute('src');
      const srcset = img.getAttribute('srcset');
      if (src) img.setAttribute('src', remap(src));
      if (srcset) img.setAttribute('srcset', remap(srcset));
    });
  }

  /* ---------- 1. Countdown ----------
     Encerra em 31/05/2026 às 23h59. Ativa em 28/05/2026 00h00 (BRT).
     Antes da ativação: countdown oculto via classe `html.countdown-pre`
     (definida no inline script do head). Ticks do JS pulam quando inativo.
     Formato adaptativo:
       - Quando faltam >= 24h → mostra "Xd : YYh : ZZmin" (sem segundos)
       - Quando faltam  < 24h → mostra "YYh : ZZmin : SSs"
  */
  const END_ISO = '2026-05-31T23:59:59-03:00';
  const endTs = new Date(END_ISO).getTime();
  const countdownActive = document.documentElement.classList.contains('countdown-on');

  const nodes = {
    hours: document.querySelector('[data-cd="hours"]'),
    minutes: document.querySelector('[data-cd="minutes"]'),
    seconds: document.querySelector('[data-cd="seconds"]'),
  };
  const unitNodes = {
    hours: document.querySelector('[data-cd-unit="0"]'),
    minutes: document.querySelector('[data-cd-unit="1"]'),
    seconds: document.querySelector('[data-cd-unit="2"]'),
  };

  const pad = (n) => String(Math.max(0, n)).padStart(2, '0');

  function tickCountdown() {
    const now = Date.now();
    let diff = Math.max(0, endTs - now);

    const days = Math.floor(diff / 86_400_000);
    diff -= days * 86_400_000;
    const hours = Math.floor(diff / 3_600_000);
    diff -= hours * 3_600_000;
    const minutes = Math.floor(diff / 60_000);
    diff -= minutes * 60_000;
    const seconds = Math.floor(diff / 1000);

    if (days > 0) {
      if (nodes.hours) nodes.hours.textContent = days;
      if (nodes.minutes) nodes.minutes.textContent = pad(hours);
      if (nodes.seconds) nodes.seconds.textContent = pad(minutes);
      if (unitNodes.hours) unitNodes.hours.textContent = 'd';
      if (unitNodes.minutes) unitNodes.minutes.textContent = 'h';
      if (unitNodes.seconds) unitNodes.seconds.textContent = 'min';
    } else {
      if (nodes.hours) nodes.hours.textContent = pad(hours);
      if (nodes.minutes) nodes.minutes.textContent = pad(minutes);
      if (nodes.seconds) nodes.seconds.textContent = pad(seconds);
      if (unitNodes.hours) unitNodes.hours.textContent = 'h';
      if (unitNodes.minutes) unitNodes.minutes.textContent = 'min';
      if (unitNodes.seconds) unitNodes.seconds.textContent = 's';
    }
  }

  if (countdownActive) {
    tickCountdown();
    setInterval(tickCountdown, 1000);
  }

  /* ---------- 2. Reveal: CSS-only (sem JS). Animation dispara no load com stagger. ---------- */

  /* ---------- 3. Magnetic CTA (desktop only) ---------- */
  const magnetics = document.querySelectorAll('[data-magnetic]');
  const isFinePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  if (isFinePointer && magnetics.length) {
    magnetics.forEach((el) => {
      const strength = el.classList.contains('cta--mega-loud') ? 0.35 : 0.25;
      const max = el.classList.contains('cta--mega-loud') ? 16 : 12;

      el.addEventListener('mousemove', (e) => {
        const rect = el.getBoundingClientRect();
        const dx = e.clientX - (rect.left + rect.width / 2);
        const dy = e.clientY - (rect.top + rect.height / 2);
        const tx = Math.max(-max, Math.min(max, dx * strength));
        const ty = Math.max(-max, Math.min(max, dy * strength));
        el.style.transform = `translate3d(${tx}px, ${ty}px, 0)`;
      });

      el.addEventListener('mouseleave', () => {
        el.style.transform = '';
      });
    });
  }

  /* ---------- 4. Sticky countdown bar + countdown mirror ---------- */
  const stickyBar = document.getElementById('stickyBar');
  const sbNodes = {
    hours: document.querySelector('[data-sb="hours"]'),
    minutes: document.querySelector('[data-sb="minutes"]'),
    seconds: document.querySelector('[data-sb="seconds"]'),
  };
  const mirrorNodes = document.querySelectorAll('[data-cd-mirror="full"]');

  function tickSticky() {
    const now = Date.now();
    let diff = Math.max(0, endTs - now);
    const days = Math.floor(diff / 86_400_000);
    diff -= days * 86_400_000;
    const hours = Math.floor(diff / 3_600_000);
    diff -= hours * 3_600_000;
    const minutes = Math.floor(diff / 60_000);
    diff -= minutes * 60_000;
    const seconds = Math.floor(diff / 1000);

    if (days > 0) {
      // Sticky bar: troca os textos dos spans pra Xd YYh ZZmin
      const parent = sbNodes.hours && sbNodes.hours.parentElement;
      if (parent && !parent.dataset.daysMode) {
        parent.dataset.daysMode = '1';
        // Reescreve o conteúdo inteiro com unidades novas
        parent.innerHTML = '<span data-sb="hours">'+days+'</span>d <span data-sb="minutes">'+pad(hours)+'</span>h <span data-sb="seconds">'+pad(minutes)+'</span>min';
        sbNodes.hours = parent.querySelector('[data-sb="hours"]');
        sbNodes.minutes = parent.querySelector('[data-sb="minutes"]');
        sbNodes.seconds = parent.querySelector('[data-sb="seconds"]');
      } else {
        if (sbNodes.hours) sbNodes.hours.textContent = days;
        if (sbNodes.minutes) sbNodes.minutes.textContent = pad(hours);
        if (sbNodes.seconds) sbNodes.seconds.textContent = pad(minutes);
      }
      mirrorNodes.forEach((n) => {
        n.textContent = days + 'd ' + pad(hours) + 'h';
      });
    } else {
      const parent = sbNodes.hours && sbNodes.hours.parentElement;
      if (parent && parent.dataset.daysMode) {
        delete parent.dataset.daysMode;
        parent.innerHTML = '<span data-sb="hours">'+pad(hours)+'</span>h <span data-sb="minutes">'+pad(minutes)+'</span>min <span data-sb="seconds">'+pad(seconds)+'</span>s';
        sbNodes.hours = parent.querySelector('[data-sb="hours"]');
        sbNodes.minutes = parent.querySelector('[data-sb="minutes"]');
        sbNodes.seconds = parent.querySelector('[data-sb="seconds"]');
      } else {
        if (sbNodes.hours) sbNodes.hours.textContent = pad(hours);
        if (sbNodes.minutes) sbNodes.minutes.textContent = pad(minutes);
        if (sbNodes.seconds) sbNodes.seconds.textContent = pad(seconds);
      }
      mirrorNodes.forEach((n) => {
        n.textContent = pad(hours) + 'h ' + pad(minutes) + 'min';
      });
    }
  }
  if (countdownActive) {
    tickSticky();
    setInterval(tickSticky, 1000);
  }

  if (stickyBar) {
    const hero = document.querySelector('.hero');
    const showAt = hero ? hero.offsetHeight * 0.85 : 800;
    let lastVisible = false;
    const handleScroll = () => {
      const shouldShow = window.scrollY > showAt;
      if (shouldShow !== lastVisible) {
        stickyBar.classList.toggle('is-visible', shouldShow);
        stickyBar.setAttribute('aria-hidden', String(!shouldShow));
        if (shouldShow) stickyBar.removeAttribute('inert');
        else stickyBar.setAttribute('inert', '');
        lastVisible = shouldShow;
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
  }

  /* ---------- 5. Scroll progress bar ---------- */
  const progressBar = document.querySelector('.scroll-progress__bar');
  if (progressBar) {
    const updateProgress = () => {
      const docH = document.documentElement.scrollHeight - window.innerHeight;
      const pct = docH > 0 ? (window.scrollY / docH) * 100 : 0;
      progressBar.style.width = `${Math.min(100, pct)}%`;
    };
    window.addEventListener('scroll', updateProgress, { passive: true });
    updateProgress();
  }

  /* ---------- 6. Animated counters (entra na viewport → conta) ---------- */
  const counters = document.querySelectorAll('[data-counter]');
  if ('IntersectionObserver' in window && counters.length) {
    const counterIO = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const el = entry.target;
        const target = parseInt(el.dataset.counter, 10);
        const prefix = el.dataset.prefix || '';
        const suffix = el.dataset.suffix || '';
        const duration = 1600;
        const start = performance.now();
        const startVal = 0;
        function step(now) {
          const t = Math.min(1, (now - start) / duration);
          const eased = 1 - Math.pow(1 - t, 3);
          const value = Math.round(startVal + (target - startVal) * eased);
          el.textContent = `${prefix}${value.toLocaleString('pt-BR')}${suffix}`;
          if (t < 1) requestAnimationFrame(step);
        }
        requestAnimationFrame(step);
        counterIO.unobserve(el);
      });
    }, { threshold: 0.4 });
    counters.forEach((c) => counterIO.observe(c));
  }

  /* ---------- 7. Tilt 3D em cards (desktop only) ---------- */
  const tiltEls = document.querySelectorAll('[data-tilt]');
  if (isFinePointer && tiltEls.length) {
    tiltEls.forEach((el) => {
      const max = 4; // graus máximos
      el.addEventListener('mousemove', (e) => {
        const rect = el.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const dx = (e.clientX - cx) / (rect.width / 2);
        const dy = (e.clientY - cy) / (rect.height / 2);
        const rx = Math.max(-max, Math.min(max, -dy * max));
        const ry = Math.max(-max, Math.min(max, dx * max));
        el.style.transform = `perspective(1200px) rotateX(${rx}deg) rotateY(${ry}deg) translateZ(0)`;
      });
      el.addEventListener('mouseleave', () => {
        el.style.transform = '';
      });
    });
  }

  /* ---------- 8. Parallax 3D no mockup Gut AI ---------- */
  const parallaxEls = document.querySelectorAll('[data-parallax-3d]');
  if (isFinePointer && parallaxEls.length) {
    parallaxEls.forEach((wrap) => {
      const target = wrap.querySelector('.gutai__mockup') || wrap.firstElementChild;
      if (!target) return;
      wrap.addEventListener('mousemove', (e) => {
        const rect = wrap.getBoundingClientRect();
        const dx = (e.clientX - rect.left - rect.width / 2) / (rect.width / 2);
        const dy = (e.clientY - rect.top - rect.height / 2) / (rect.height / 2);
        target.style.transform = `perspective(1600px) rotateX(${-dy * 4}deg) rotateY(${dx * 6}deg) translateZ(0)`;
      });
      wrap.addEventListener('mouseleave', () => {
        target.style.transform = '';
      });
    });
  }

  /* ---------- 9. Accordion FAQ ---------- */
  const faqItems = document.querySelectorAll('.faq__item');
  faqItems.forEach((item) => {
    const btn = item.querySelector('.faq__q');
    if (!btn) return;
    btn.addEventListener('click', () => {
      const open = item.classList.toggle('is-open');
      btn.setAttribute('aria-expanded', open);
    });
  });

  /* ---------- 10. Depoimentos dots indicator (mobile scroll) ---------- */
  const depTrack = document.querySelector('.depoimentos__track');
  const depDotsWrap = document.getElementById('depDots');
  if (depTrack && depDotsWrap) {
    const cards = depTrack.querySelectorAll('.dep-card');
    cards.forEach(() => {
      const d = document.createElement('i');
      depDotsWrap.appendChild(d);
    });
    const updateDots = () => {
      const dots = depDotsWrap.querySelectorAll('i');
      const scrollX = depTrack.scrollLeft + depTrack.clientWidth / 2;
      let activeIdx = 0;
      let bestDist = Infinity;
      cards.forEach((card, i) => {
        const cardCenter = card.offsetLeft + card.offsetWidth / 2;
        const dist = Math.abs(cardCenter - scrollX);
        if (dist < bestDist) { bestDist = dist; activeIdx = i; }
      });
      dots.forEach((d, i) => d.classList.toggle('is-active', i === activeIdx));
    };
    depTrack.addEventListener('scroll', updateDots, { passive: true });
    updateDots();
  }

  /* ---------- 11. Drag horizontal nos depoimentos (desktop) ---------- */
  if (depTrack && isFinePointer) {
    let isDown = false, startX = 0, scrollStart = 0;
    depTrack.addEventListener('mousedown', (e) => {
      isDown = true;
      startX = e.pageX;
      scrollStart = depTrack.scrollLeft;
      depTrack.style.cursor = 'grabbing';
      e.preventDefault();
    });
    document.addEventListener('mouseup', () => { isDown = false; depTrack.style.cursor = ''; });
    document.addEventListener('mousemove', (e) => {
      if (!isDown) return;
      const dx = e.pageX - startX;
      depTrack.scrollLeft = scrollStart - dx;
    });
  }

  /* ---------- 12. Custom cursor (desktop only) ---------- */
  const cursor = document.getElementById('cursor');
  const cursorLabel = cursor && cursor.querySelector('.cursor__label');
  if (cursor && isFinePointer) {
    let mouseX = 0, mouseY = 0, rafId = null;
    const update = () => {
      cursor.style.transform = `translate3d(${mouseX}px, ${mouseY}px, 0)`;
      rafId = null;
    };
    document.addEventListener('mousemove', (e) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
      cursor.classList.add('is-active');
      if (!rafId) rafId = requestAnimationFrame(update);
    });
    document.addEventListener('mouseleave', () => cursor.classList.remove('is-active'));

    // Triggers contextuais
    const labels = {
      demo: 'Ver demo →',
      buy: 'Comprar →',
      explore: 'Explorar',
      grab: 'Arraste'
    };
    document.querySelectorAll('[data-cursor]').forEach((el) => {
      const key = el.dataset.cursor;
      el.addEventListener('mouseenter', () => {
        cursor.classList.add('cursor--has-label');
        if (cursorLabel) cursorLabel.textContent = labels[key] || '';
      });
      el.addEventListener('mouseleave', () => {
        cursor.classList.remove('cursor--has-label');
      });
    });
  }

  /* ---------- 13. Gut AI particles (canvas leve, lazy) ---------- */
  const particlesCanvas = document.getElementById('gutaiParticles');
  if (particlesCanvas && 'IntersectionObserver' in window) {
    const startParticles = () => {
      const ctx = particlesCanvas.getContext('2d');
      let w = particlesCanvas.width = particlesCanvas.offsetWidth;
      let h = particlesCanvas.height = particlesCanvas.offsetHeight;
      const count = window.innerWidth < 768 ? 30 : 60;
      const particles = Array.from({ length: count }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        r: Math.random() * 1.5 + 0.3,
        vx: (Math.random() - 0.5) * 0.18,
        vy: (Math.random() - 0.5) * 0.18,
        alpha: Math.random() * 0.5 + 0.2
      }));
      const resize = () => { w = particlesCanvas.width = particlesCanvas.offsetWidth; h = particlesCanvas.height = particlesCanvas.offsetHeight; };
      window.addEventListener('resize', resize);
      function frame() {
        ctx.clearRect(0, 0, w, h);
        particles.forEach((p) => {
          p.x += p.vx; p.y += p.vy;
          if (p.x < 0 || p.x > w) p.vx *= -1;
          if (p.y < 0 || p.y > h) p.vy *= -1;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(244, 237, 224, ${p.alpha})`;
          ctx.fill();
        });
        requestAnimationFrame(frame);
      }
      frame();
    };
    const sectionIO = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          startParticles();
          sectionIO.disconnect();
        }
      });
    }, { rootMargin: '200px' });
    sectionIO.observe(particlesCanvas);
  }
})();
