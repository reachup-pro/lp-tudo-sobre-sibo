/* ================================================================
   SIBO Curso · LP Oferta Imersão
   Reveal on scroll + magnetic CTA
   ================================================================ */

(() => {
  'use strict';

  /* ---------- 0a. Defesa contra link fingerprinter (AC Diffuser) ----------
     O diffuser.js da ActiveCampaign injeta ZWSP/ZWNJ no ?text= de links wa.me
     pra fingerprint cross-domain. Isso vaza chars invisíveis pra mensagem do
     WhatsApp. Reescrevemos o href no instante da interação. */
  const CLEAN_WPP_HREF = 'https://wa.me/5511912779806?text=' + encodeURIComponent('Olá, gostaria de me inscrever no boleto/pix parcelado');
  document.querySelectorAll('a[data-wpp-clean]').forEach((a) => {
    const enforce = () => { if (a.getAttribute('href') !== CLEAN_WPP_HREF) a.setAttribute('href', CLEAN_WPP_HREF); };
    enforce();
    ['pointerdown', 'mousedown', 'touchstart', 'contextmenu', 'focus', 'mouseenter'].forEach((evt) => {
      a.addEventListener(evt, enforce, true);
    });
  });

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

  /* ---------- 12.5 Floating CTA — mostra após hero, esconde em oferta/cta-final ---------- */
  const floatCta = document.getElementById('floatCta');
  if (floatCta && 'IntersectionObserver' in window) {
    let pastHero = false;
    let inHideZone = false;

    const updateFab = () => {
      floatCta.classList.toggle('is-visible', pastHero && !inHideZone);
    };

    const heroEl = document.querySelector('.hero');
    if (heroEl) {
      const heroIO = new IntersectionObserver((entries) => {
        pastHero = !entries[0].isIntersecting;
        updateFab();
      }, { rootMargin: '-80px 0px 0px 0px', threshold: 0 });
      heroIO.observe(heroEl);
    }

    const hideZones = document.querySelectorAll('.oferta, .cta-final');
    if (hideZones.length) {
      const hideIO = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          entry.target._inView = entry.isIntersecting;
        });
        inHideZone = Array.from(hideZones).some((el) => el._inView);
        updateFab();
      }, { threshold: 0.15 });
      hideZones.forEach((el) => hideIO.observe(el));
    }
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


/* ================================================================
   Lista de espera (modal) — mesma captura/atribuição da /mastermind.
   Aciona o webhook n8n com origem 'lp-curso' → utm_tracking (Supabase).
   ================================================================ */
(function () {
  'use strict';

  var modal = document.getElementById('waitlist');
  var form = document.getElementById('waitlist-form');
  var success = document.getElementById('waitlist-success');
  if (!modal || !form || !success) return;

  document.querySelectorAll('[data-open-modal]').forEach(function (btn) {
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      if (typeof modal.showModal === 'function') modal.showModal();
      else modal.setAttribute('open', '');
      var title = document.getElementById('waitlist-title');
      if (title) title.focus({ preventScroll: true });
    });
  });

  modal.addEventListener('click', function (e) { if (e.target === modal) modal.close(); });
  modal.addEventListener('close', function () { form.hidden = false; success.hidden = true; });

  var tel = document.getElementById('telefone');
  tel.addEventListener('input', function () {
    var d = tel.value.replace(/\D/g, '').slice(0, 11);
    if (d.length > 6) tel.value = '(' + d.slice(0, 2) + ') ' + d.slice(2, 7) + '-' + d.slice(7);
    else if (d.length > 2) tel.value = '(' + d.slice(0, 2) + ') ' + d.slice(2);
    else if (d.length) tel.value = '(' + d;
  });

  var COPY = {
    padrao: {
      titulo: 'Pronto, você está na lista.',
      corpo: 'Quando a próxima turma abrir, eu te aviso por e-mail e WhatsApp antes da divulgação pública. ' +
             'Até lá, se quiser acompanhar como eu penso os casos, me segue no Instagram.'
    },
    'fora-saude': {
      titulo: 'Recebi seu cadastro.',
      corpo: 'O SIBO na Prática Clínica é uma formação para profissionais de saúde que já atendem, então o ' +
             'conteúdo é bem técnico. Se você chegou aqui procurando cuidar do seu próprio intestino, eu tenho ' +
             'material feito para paciente e te aviso quando abrir.'
    }
  };

  var WAITLIST_ENDPOINT = 'https://n8n.reachup.pro/webhook/mastermind-waitlist';
  var submitBtn = form.querySelector('[data-submit]');
  var submitLabel = form.querySelector('[data-submit-label]');
  var errorBox = document.getElementById('form-error');
  var enviando = false;

  function qp(name) {
    try { return new URLSearchParams(location.search).get(name) || ''; } catch (e) { return ''; }
  }
  function deviceType() {
    return /Mobi|Android|iPhone|iPad|iPod|Windows Phone/i.test(navigator.userAgent) ? 'mobile' : 'desktop';
  }
  function sessionId() {
    try {
      var k = 'wl_sid', v = localStorage.getItem(k);
      if (!v) { v = 's_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10); localStorage.setItem(k, v); }
      return v;
    } catch (e) { return 's_' + Date.now().toString(36); }
  }
  function cadastroUrl(nome, profissao) {
    try {
      var u = new URL(location.href);
      u.searchParams.set('lead_profissao', profissao);
      if (nome) u.searchParams.set('lead_nome', nome);
      return u.toString();
    } catch (e) { return location.href; }
  }

  function mostrarSucesso(profissao) {
    var t = COPY[profissao] || COPY.padrao;
    success.querySelector('[data-success-title]').textContent = t.titulo;
    success.querySelector('[data-success-body]').textContent = t.corpo;
    form.hidden = true; success.hidden = false; modal.scrollTop = 0;
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (enviando) return;
    if (!form.reportValidity()) return;

    var profissao = document.getElementById('profissao').value;
    var nome = document.getElementById('nome').value.trim();
    var payload = {
      nome: nome,
      email: document.getElementById('email').value.trim(),
      telefone: tel.value.trim(),
      profissao: profissao,
      origem: 'lp-curso',
      landing_url: cadastroUrl(nome, profissao),
      page_path: location.pathname,
      referrer: document.referrer || '',
      user_agent: navigator.userAgent,
      device_type: deviceType(),
      session_id: sessionId(),
      utm_source: qp('utm_source'),
      utm_medium: qp('utm_medium'),
      utm_campaign: qp('utm_campaign'),
      utm_term: qp('utm_term'),
      utm_content: qp('utm_content'),
      fbclid: qp('fbclid'),
      gclid: qp('gclid'),
      ctwa_clid: qp('ctwa_clid')
    };

    enviando = true;
    errorBox.hidden = true;
    submitBtn.disabled = true;
    submitLabel.textContent = 'Enviando...';

    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({ event: 'waitlist_submit', profissao: profissao, lp: 'curso' });

    fetch(WAITLIST_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        window.dataLayer.push({ event: 'waitlist_success', profissao: profissao, lp: 'curso' });
        mostrarSucesso(profissao);
      })
      .catch(function () { errorBox.hidden = false; })
      .then(function () {
        enviando = false;
        submitBtn.disabled = false;
        submitLabel.textContent = 'Entrar na lista de espera';
      });
  });
})();
