/* Reset Intestinal — interações do design "Ametista Clínico"
   Sem dependências externas. Respeita prefers-reduced-motion. */
(function () {
  'use strict';

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  /* ---------- 1. Parallax do cursor no hero (orbe reage ao mouse) ---------- */
  var hero = document.getElementById('hero');
  var scene = document.querySelector('[data-parallax-scene]');
  if (hero && scene && finePointer && !reduce) {
    var raf = null, tx = 0, ty = 0;
    hero.addEventListener('pointermove', function (e) {
      var r = hero.getBoundingClientRect();
      tx = (e.clientX - r.left) / r.width - 0.5;
      ty = (e.clientY - r.top) / r.height - 0.5;
      if (!raf) {
        raf = requestAnimationFrame(function () {
          scene.style.setProperty('--px', tx.toFixed(3));
          scene.style.setProperty('--py', ty.toFixed(3));
          raf = null;
        });
      }
    });
    hero.addEventListener('pointerleave', function () {
      scene.style.setProperty('--px', 0);
      scene.style.setProperty('--py', 0);
    });
  }

  /* ---------- 2. Scroll reveal (stagger) ---------- */
  var reveals = document.querySelectorAll('[data-reveal]');
  // índice para stagger nos chips
  var chipReveals = document.querySelectorAll('.symptoms__grid [data-reveal]');
  chipReveals.forEach(function (el, i) { el.style.setProperty('--i', i); });

  if ('IntersectionObserver' in window && !reduce) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-in');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
    reveals.forEach(function (el) { io.observe(el); });
  } else {
    reveals.forEach(function (el) { el.classList.add('is-in'); });
  }

  /* ---------- 3. CTA flutuante: aparece depois do hero ---------- */
  var floating = document.querySelector('[data-float]');
  if (floating && hero && 'IntersectionObserver' in window) {
    var fo = new IntersectionObserver(function (entries) {
      // visível quando o hero NÃO está mais na tela
      floating.classList.toggle('is-visible', !entries[0].isIntersecting);
    }, { threshold: 0, rootMargin: '-60% 0px 0px 0px' });
    fo.observe(hero);
  }

  /* ---------- 4. Chips: toggle no toque (mobile já mostra, aqui garante teclado/tap) ---------- */
  var chips = document.querySelectorAll('.chip');
  chips.forEach(function (chip) {
    chip.addEventListener('click', function () {
      if (finePointer) return; // no desktop o hover cuida
      chip.classList.toggle('is-active');
    });
  });

  /* ---------- 5. CTA magnético (sutil, só desktop) ---------- */
  if (finePointer && !reduce) {
    document.querySelectorAll('.cta').forEach(function (btn) {
      btn.addEventListener('pointermove', function (e) {
        var r = btn.getBoundingClientRect();
        var mx = (e.clientX - r.left) / r.width - 0.5;
        var my = (e.clientY - r.top) / r.height - 0.5;
        btn.style.transform = 'translate(' + (mx * 6).toFixed(1) + 'px,' + (my * 5 - 2).toFixed(1) + 'px)';
      });
      btn.addEventListener('pointerleave', function () { btn.style.transform = ''; });
    });
  }

  /* ---------- 6. Método: linha de progresso + passo ativo ---------- */
  var stepsFill = document.querySelector('[data-steps-fill]');
  var stepsWrap = document.querySelector('.steps');
  var stepEls = document.querySelectorAll('[data-step]');
  if (stepsFill && stepsWrap && stepEls.length && !reduce) {
    var stepsRaf = null;
    var updateSteps = function () {
      var rect = stepsWrap.getBoundingClientRect();
      var vh = window.innerHeight;
      var total = rect.height;
      var progressed = Math.min(Math.max(vh * 0.5 - rect.top, 0), total);
      stepsFill.style.height = (total ? (progressed / total) * 100 : 0) + '%';
      stepEls.forEach(function (el) {
        var r = el.getBoundingClientRect();
        el.classList.toggle('is-active', r.top < vh * 0.6 && r.bottom > vh * 0.3);
      });
      stepsRaf = null;
    };
    var onStepsScroll = function () {
      if (!stepsRaf) stepsRaf = requestAnimationFrame(updateSteps);
    };
    window.addEventListener('scroll', onStepsScroll, { passive: true });
    window.addEventListener('resize', onStepsScroll);
    updateSteps();
  }

  /* ---------- 7. FAQ accordion (acessível: aria-expanded) ---------- */
  document.querySelectorAll('.faq__item').forEach(function (item) {
    var btn = item.querySelector('.faq__q');
    if (!btn) return;
    btn.addEventListener('click', function () {
      var open = item.classList.toggle('is-open');
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  });

  /* ---------- 8. Tracking GTM: Lead em 50% de scroll ---------- */
  var leadFired = false;
  var onLeadScroll = function () {
    if (leadFired) return;
    var doc = document.documentElement;
    var ratio = (window.scrollY + window.innerHeight) / doc.scrollHeight;
    if (ratio >= 0.5) {
      leadFired = true;
      window.dataLayer = window.dataLayer || [];
      window.dataLayer.push({ event: 'lead_scroll_50' });
      window.removeEventListener('scroll', onLeadScroll);
    }
  };
  window.addEventListener('scroll', onLeadScroll, { passive: true });
})();
