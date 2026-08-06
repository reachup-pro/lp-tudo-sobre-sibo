/* ================================================================
   MASTERMIND MICROBIOTA — Página de vendas
   Hero (parallax + magnético) · barra fixa · console da ferramenta
   ================================================================ */

(function () {
  'use strict';

  /* ------------------------------------------------------------
     0. CHECKOUT
     Oferta Hotmart do Mastermind: R$ 3.997 à vista ou 12x de R$ 413,38.
     Os 7 [data-checkout] recebem esta URL já decorada com utm/src/sck
     da visita. Se a constante voltar a ficar vazia, todos ficam inertes
     e só registram a intenção no dataLayer.
     ------------------------------------------------------------ */
  var CHECKOUT_URL = 'https://pay.hotmart.com/J91776893M?off=fh5r3s03&checkoutMode=10';

  /* ------------------------------------------------------------
     1. Parâmetros de campanha preservados na própria página
     (utm/src/sck), sem depender do GTM.
     ------------------------------------------------------------ */
  var URL_PARAMS = (function () {
    var out = {};
    if (!window.URLSearchParams) return out;
    var search;
    try { search = new URLSearchParams(window.location.search); }
    catch (e) { return out; }
    var sckParts = [];
    search.forEach(function (value, key) {
      out[key] = value;
      var k = key.toLowerCase();
      if (k !== 'src' && k !== 'sck') { sckParts.push(key); sckParts.push(value); }
    });
    if (out.utm_source) out.src = out.utm_source;
    if (sckParts.length) out.sck = sckParts.join('|');
    return out;
  })();

  var URL_PARAM_KEYS = Object.keys(URL_PARAMS);

  /** Devolve a URL com os parâmetros da visita reaplicados. Idempotente. */
  function comParams(url) {
    if (!URL_PARAM_KEYS.length || !url) return url;
    var s = String(url);
    if (s.charAt(0) === '#' || s.indexOf('javascript:') === 0) return url;
    try {
      var u = new URL(s, window.location.origin);
      URL_PARAM_KEYS.forEach(function (k) { u.searchParams.set(k, URL_PARAMS[k]); });
      return u.toString();
    } catch (e) { return url; }
  }

  var checkoutLinks = document.querySelectorAll('[data-checkout]');

  checkoutLinks.forEach(function (a) {
    var origem = a.getAttribute('data-cta') || 'desconhecida';

    if (CHECKOUT_URL) {
      a.setAttribute('href', comParams(CHECKOUT_URL));
      a.setAttribute('rel', 'noopener');
      a.addEventListener('click', function () { track('checkout_click', { origem: origem }); });
      return;
    }

    // Sem oferta criada: o clique não leva a lugar nenhum, mas ainda
    // registra a intenção no dataLayer pra não perder o dado do teste.
    a.addEventListener('click', function (e) {
      e.preventDefault();
      track('checkout_indisponivel', { origem: origem });
    });
  });

  /* Última linha de defesa: re-decora o href no clique, cobrindo qualquer
     reescrita feita depois (GTM, extensão, fingerprinter). */
  if (URL_PARAM_KEYS.length) {
    var guard = function (ev) {
      var link = ev.target && ev.target.closest ? ev.target.closest('a[data-cta]') : null;
      if (!link) return;
      var href = link.getAttribute('href');
      if (!href || href.charAt(0) === '#') return;
      if (link.hasAttribute('data-wpp-clean')) return; // o wa.me tem defesa própria
      link.setAttribute('href', comParams(href));
    };
    document.addEventListener('click', guard, true);
    document.addEventListener('auxclick', guard, true);
  }

  /* ------------------------------------------------------------
     2. Defesa contra link fingerprinter (AC Diffuser)
     O diffuser.js da ActiveCampaign injeta ZWSP/ZWNJ no ?text= de
     links wa.me. Reescrevemos o href no instante da interação.
     ------------------------------------------------------------ */
  var WPP_HREF = 'https://wa.me/5511912779806?text=' +
    encodeURIComponent('Olá! Quero entrar no Mastermind Microbiota e gostaria de parcelar no boleto.');

  document.querySelectorAll('a[data-wpp-clean]').forEach(function (a) {
    var enforce = function () {
      if (a.getAttribute('href') !== WPP_HREF) a.setAttribute('href', WPP_HREF);
    };
    enforce();
    ['pointerdown', 'mousedown', 'touchstart', 'contextmenu', 'focus', 'mouseenter']
      .forEach(function (evt) { a.addEventListener(evt, enforce, true); });
    a.addEventListener('click', function () {
      track('boleto_click', { origem: a.getAttribute('data-cta') || 'desconhecida' });
    });
  });

  /* ------------------------------------------------------------
     3. Dev fallback: Netlify Image CDN → caminho direto
     ------------------------------------------------------------ */
  var isLocal = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname) ||
                location.protocol === 'file:';
  if (isLocal) {
    document.querySelectorAll('img').forEach(function (img) {
      var src = img.getAttribute('src');
      if (!src) return;
      var m = src.match(/\/\.netlify\/images\?(.+)$/);
      if (!m) return;
      try {
        var url = new URLSearchParams(m[1]).get('url');
        if (url) img.setAttribute('src', url);
      } catch (e) { /* mantém o src original */ }
    });
  }

  /* ------------------------------------------------------------
     4. AOS — nunca no hero
     ------------------------------------------------------------ */
  if (window.AOS) {
    AOS.init({
      duration: 700,
      easing: 'ease-out-cubic',
      once: true,
      offset: 80,
      disableMutationObserver: true
    });
  }

  var finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ------------------------------------------------------------
     5. Hero — parallax do cursor + CTA magnético (desktop only)
     Movimento pós-carregamento. Nada disso é animação de entrada.
     ------------------------------------------------------------ */
  var hero = document.querySelector('.hero');

  if (hero && finePointer && !reduceMotion) {
    var raf = 0;
    hero.addEventListener('mousemove', function (e) {
      if (raf) return;
      raf = requestAnimationFrame(function () {
        raf = 0;
        var r = hero.getBoundingClientRect();
        hero.style.setProperty('--mx', ((e.clientX - r.left) / r.width - .5).toFixed(3));
        hero.style.setProperty('--my', ((e.clientY - r.top) / r.height - .5).toFixed(3));
      });
    });
    hero.addEventListener('mouseleave', function () {
      hero.style.setProperty('--mx', 0);
      hero.style.setProperty('--my', 0);
    });

    var heroBtn = hero.querySelector('.hero__cta .btn');
    if (heroBtn) {
      heroBtn.addEventListener('mousemove', function (e) {
        var r = heroBtn.getBoundingClientRect();
        var dx = Math.max(-10, Math.min(10, (e.clientX - (r.left + r.width / 2)) * .22));
        var dy = Math.max(-6, Math.min(6, (e.clientY - (r.top + r.height / 2)) * .22));
        heroBtn.style.transform = 'translate3d(' + dx + 'px,' + dy + 'px,0)';
      });
      heroBtn.addEventListener('mouseleave', function () { heroBtn.style.transform = ''; });
    }
  }

  /* ------------------------------------------------------------
     6. Barra fixa — entra quando o hero sai da tela
     ------------------------------------------------------------ */
  var railbar = document.querySelector('[data-railbar]');

  if (railbar && hero && 'IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      railbar.classList.toggle('is-on', !entries[0].isIntersecting);
    }, { rootMargin: '-40% 0px 0px 0px' }).observe(hero);
  }

  /* ------------------------------------------------------------
     6b. Utilitários
     ------------------------------------------------------------ */

  /* Marca que o JS está vivo. O CSS usa isso pra só esconder o estado
     inicial das animações quando existe quem as dispare — sem JS, tudo
     aparece pronto em vez de invisível. */
  document.documentElement.classList.add('js-anim');

  /* Se o AOS não carregar (unpkg fora do ar), o CSS dele deixaria metade
     da página em opacity:0. Sem o objeto, os atributos saem. */
  if (!window.AOS) {
    document.querySelectorAll('[data-aos]').forEach(function (el) {
      el.removeAttribute('data-aos');
    });
  }

  function track(evento, dados) {
    window.dataLayer = window.dataLayer || [];
    var payload = { event: evento };
    if (dados) Object.keys(dados).forEach(function (k) { payload[k] = dados[k]; });
    window.dataLayer.push(payload);
  }

  /** Aplica .is-in uma única vez quando o elemento entra na viewport. */
  function whenSeen(el, cb, margem) {
    if (!el) return;
    if (!('IntersectionObserver' in window)) { cb(el); return; }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        cb(e.target);
        io.unobserve(e.target);
      });
    }, { rootMargin: margem || '0px 0px -12% 0px' });
    io.observe(el);
  }

  function marcar(el) { el.classList.add('is-in'); }

  /* ------------------------------------------------------------
     6c. Barra de progresso de scroll
     ------------------------------------------------------------ */
  var progress = document.querySelector('.progress');

  if (progress && !reduceMotion) {
    var pRaf = 0;
    var atualizarProgresso = function () {
      pRaf = 0;
      var max = document.documentElement.scrollHeight - window.innerHeight;
      var v = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
      progress.style.setProperty('--sp', v.toFixed(4));
    };
    window.addEventListener('scroll', function () {
      if (!pRaf) pRaf = requestAnimationFrame(atualizarProgresso);
    }, { passive: true });
    atualizarProgresso();
  }

  /* ------------------------------------------------------------
     7. SEÇÃO 3 · armadilhas que viram (flip de duas faces)
     No desktop o hover já vira; o clique fixa. No touch, é o clique.
     ------------------------------------------------------------ */
  document.querySelectorAll('[data-trap]').forEach(function (trap) {
    var verso = trap.querySelector('.trap__face--back');
    var frente = trap.querySelector('.trap__face');

    var sincronizar = function (aberto) {
      trap.setAttribute('aria-expanded', aberto ? 'true' : 'false');
      if (verso) verso.setAttribute('aria-hidden', aberto ? 'false' : 'true');
      if (frente) frente.setAttribute('aria-hidden', aberto ? 'true' : 'false');
    };

    sincronizar(false);

    trap.addEventListener('click', function () {
      var aberto = !trap.classList.contains('is-flipped');
      trap.classList.toggle('is-flipped', aberto);
      sincronizar(aberto);
      if (aberto) track('trap_flip', { trap: trap.getAttribute('data-trap') });
    });
  });

  /* ------------------------------------------------------------
     8. SEÇÃO 4 · trilho do mapa de decisão
     Só ≥1000px: sticky em coluna estreita deixa o número órfão.
     ------------------------------------------------------------ */
  var railMQ = window.matchMedia('(min-width: 1000px)');
  var rail = document.querySelector('.mapa__rail');
  var stages = document.querySelectorAll('.stage');
  var railItems = document.querySelectorAll('[data-rail]');
  var railIO = null;
  var railScrollOn = false;

  function ativarRail(n) {
    railItems.forEach(function (b) {
      b.classList.toggle('is-on', b.getAttribute('data-rail') === n);
    });
  }

  var rRaf = 0;
  function progressoRail() {
    rRaf = 0;
    var lista = document.querySelector('.mapa__stages');
    if (!lista || !rail) return;
    var r = lista.getBoundingClientRect();
    var bruto = (window.innerHeight * 0.5 - r.top) / r.height;
    rail.style.setProperty('--p', Math.min(1, Math.max(0, bruto)).toFixed(4));
  }

  function onRailScroll() {
    if (!rRaf) rRaf = requestAnimationFrame(progressoRail);
  }

  function ligarRail() {
    if (railIO || !stages.length) return;
    // A faixa central da tela decide qual estágio está ativo.
    railIO = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        var n = e.target.getAttribute('data-stage');
        ativarRail(n);
        track('mapa_stage', { estagio: Number(n) });
      });
    }, { rootMargin: '-45% 0px -45% 0px', threshold: 0 });
    stages.forEach(function (s) { railIO.observe(s); });

    if (!railScrollOn) {
      window.addEventListener('scroll', onRailScroll, { passive: true });
      railScrollOn = true;
    }
    progressoRail();
  }

  function desligarRail() {
    if (railIO) { railIO.disconnect(); railIO = null; }
    if (railScrollOn) {
      window.removeEventListener('scroll', onRailScroll);
      railScrollOn = false;
    }
  }

  if (rail && 'IntersectionObserver' in window) {
    if (railMQ.matches) ligarRail();
    var onRailMQ = function (e) { e.matches ? ligarRail() : desligarRail(); };
    if (railMQ.addEventListener) railMQ.addEventListener('change', onRailMQ);
    else if (railMQ.addListener) railMQ.addListener(onRailMQ);

    railItems.forEach(function (b) {
      b.addEventListener('click', function () {
        var alvo = document.getElementById('stage-' + b.getAttribute('data-rail'));
        if (alvo) alvo.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' });
      });
    });
  }

  /* ------------------------------------------------------------
     9. SEÇÃO 5 · barras do mini-laudo · SEÇÃO 7 · régua do retrato
        SEÇÃO 8 · onda do calendário
     ------------------------------------------------------------ */
  whenSeen(document.querySelector('[data-laudo]'), marcar);
  whenSeen(document.querySelector('.photo-frame'), marcar);
  whenSeen(document.querySelector('[data-cal]'), marcar, '0px 0px -8% 0px');

  /* ------------------------------------------------------------
     10. SEÇÃO 10 · carrossel de depoimentos (scroll-snap nativo)
     ------------------------------------------------------------ */
  var trilha = document.querySelector('[data-track]');

  if (trilha) {
    var cards = Array.prototype.slice.call(trilha.querySelectorAll('.depo__card'));
    var caixaDots = document.querySelector('[data-dots]');
    var btPrev = document.querySelector('[data-prev]');
    var btNext = document.querySelector('[data-next]');

    /** Card mais próximo da borda esquerda da trilha. */
    function indiceAtual() {
      var base = trilha.getBoundingClientRect().left;
      var alvo = 0, menor = Infinity;
      cards.forEach(function (c, i) {
        var d = Math.abs(c.getBoundingClientRect().left - base);
        if (d < menor) { menor = d; alvo = i; }
      });
      return alvo;
    }

    /* Navega por índice, não por deslocamento fixo: o card de destaque é
       mais largo que os outros, e dois scrollBy seguidos se atropelam
       enquanto o scroll suave ainda está rodando. */
    function irPara(i) {
      var alvo = Math.min(cards.length - 1, Math.max(0, i));
      cards[alvo].scrollIntoView({
        behavior: reduceMotion ? 'auto' : 'smooth',
        inline: 'start',
        block: 'nearest'
      });
    }

    var dots = cards.map(function (_, i) {
      var d = document.createElement('button');
      d.type = 'button';
      d.className = 'depo__dot' + (i === 0 ? ' is-on' : '');
      d.setAttribute('aria-label', 'Ir para o depoimento ' + (i + 1));
      d.addEventListener('click', function () { irPara(i); });
      if (caixaDots) caixaDots.appendChild(d);
      return d;
    });

    function marcarDot(i) {
      dots.forEach(function (d, j) {
        d.classList.toggle('is-on', i === j);
        d.setAttribute('aria-current', i === j ? 'true' : 'false');
      });
    }

    function limites() {
      if (!btPrev || !btNext) return;
      btPrev.disabled = trilha.scrollLeft <= 2;
      btNext.disabled = trilha.scrollLeft >= trilha.scrollWidth - trilha.clientWidth - 2;
    }

    if (btPrev) btPrev.addEventListener('click', function () { irPara(indiceAtual() - 1); });
    if (btNext) btNext.addEventListener('click', function () { irPara(indiceAtual() + 1); });

    var sRaf = 0;
    trilha.addEventListener('scroll', function () {
      if (sRaf) return;
      sRaf = requestAnimationFrame(function () {
        sRaf = 0;
        limites();
        marcarDot(indiceAtual());
      });
    }, { passive: true });

    marcarDot(0);
    limites();
    window.addEventListener('resize', limites, { passive: true });
  }

  /* ------------------------------------------------------------
     11. SEÇÃO 11 · alternador de pagamento + contador do preço
     ------------------------------------------------------------ */
  var pagOpts = document.querySelectorAll('[data-pay]');
  var pagBlocos = document.querySelectorAll('[data-price]');

  pagOpts.forEach(function (b) {
    b.addEventListener('click', function () {
      var modo = b.getAttribute('data-pay');
      pagOpts.forEach(function (o) {
        var on = o === b;
        o.classList.toggle('is-on', on);
        o.setAttribute('aria-selected', on ? 'true' : 'false');
      });
      pagBlocos.forEach(function (p) {
        p.hidden = p.getAttribute('data-price') !== modo;
      });
      track('preco_toggle', { modo: modo });
    });
  });

  // Teclado: setas navegam entre as duas abas, como manda o padrão de tablist
  document.querySelector('.pay') && document.querySelector('.pay').addEventListener('keydown', function (e) {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    var lista = Array.prototype.slice.call(pagOpts);
    var i = lista.indexOf(document.activeElement);
    if (i < 0) return;
    var prox = lista[(i + (e.key === 'ArrowRight' ? 1 : lista.length - 1)) % lista.length];
    prox.focus();
    prox.click();
  });

  var contador = document.querySelector('[data-count]');

  if (contador) {
    var alvoNum = parseInt(contador.getAttribute('data-count'), 10) || 0;
    var fmt = function (n) { return n.toLocaleString('pt-BR'); };

    whenSeen(contador.closest('.card') || contador, function () {
      if (reduceMotion) { contador.textContent = fmt(alvoNum); return; }
      var dur = 900, ini = null;
      var passoConta = function (t) {
        if (ini === null) ini = t;
        var k = Math.min(1, (t - ini) / dur);
        var eased = 1 - Math.pow(1 - k, 3);          // easeOutCubic
        contador.textContent = fmt(Math.round(alvoNum * eased));
        if (k < 1) requestAnimationFrame(passoConta);
        else contador.textContent = fmt(alvoNum);
      };
      requestAnimationFrame(passoConta);
    }, '0px 0px -20% 0px');
  }

  /* ------------------------------------------------------------
     12. SEÇÃO 14 · FAQ com abertura única
     ------------------------------------------------------------ */
  var faqs = document.querySelectorAll('.faq__item');
  var travaFaq = false;

  faqs.forEach(function (d, i) {
    d.addEventListener('toggle', function () {
      if (travaFaq) return;
      if (!d.open) return;
      travaFaq = true;
      faqs.forEach(function (o) { if (o !== d) o.open = false; });
      travaFaq = false;
      track('faq_open', { pergunta: i + 1 });
    });
  });

  /* ------------------------------------------------------------
     13. Console da ferramenta
     ------------------------------------------------------------ */
  var console_ = document.querySelector('[data-console]');
  if (!console_) return;

  /* ---- 7a. Etapas (tabs) ---- */
  var steps = console_.querySelectorAll('[data-step]');
  var panels = console_.querySelectorAll('[data-panel]');

  function abrirEtapa(n) {
    steps.forEach(function (b) {
      var on = b.getAttribute('data-step') === n;
      b.classList.toggle('is-on', on);
      b.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    panels.forEach(function (p) {
      p.hidden = p.getAttribute('data-panel') !== n;
    });
  }

  steps.forEach(function (b) {
    b.addEventListener('click', function () { abrirEtapa(b.getAttribute('data-step')); });
  });

  /* ---- 7b. Seletor de exame: o que roda hoje x o que está em expansão ---- */
  var SOON = {
    microbiota: {
      titulo: 'Microbiota',
      corpo: 'Ainda não roda. Está sendo treinada nas transcrições das aulas e em áudios meus ' +
             'comentando exames reais, e entra para a turma no primeiro encontro ao vivo.'
    },
    coprologico: {
      titulo: 'Coprológico funcional',
      corpo: 'Ainda não roda. Entra junto com a microbiota, no primeiro encontro ao vivo. ' +
             'Enquanto isso, o que a ferramenta já faz hoje é o teste respiratório.'
    }
  };

  var exams = console_.querySelectorAll('[data-exam]');
  var flowSibo = console_.querySelector('[data-flow="sibo"]');
  var flowSoon = console_.querySelector('[data-flow="soon"]');
  var soonTitle = console_.querySelector('[data-soon-title]');
  var soonBody = console_.querySelector('[data-soon-body]');

  function abrirExame(nome) {
    exams.forEach(function (b) {
      var on = b.getAttribute('data-exam') === nome;
      b.classList.toggle('is-on', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });

    var soon = SOON[nome];
    if (soon) {
      soonTitle.textContent = soon.titulo;
      soonBody.textContent = soon.corpo;
      flowSibo.hidden = true;
      flowSoon.hidden = false;
    } else {
      flowSoon.hidden = true;
      flowSibo.hidden = false;
    }
  }

  exams.forEach(function (b) {
    b.addEventListener('click', function () { abrirExame(b.getAttribute('data-exam')); });
  });

  var back = console_.querySelector('[data-back]');
  if (back) back.addEventListener('click', function () { abrirExame('sibo'); });

  /* ---- 7c. Citações: cada afirmação abre a aula de onde ela saiu ----
     É o argumento central da seção: ela mostra de onde tirou. */
  console_.querySelectorAll('[data-cite]').forEach(function (b) {
    var alvo = b.nextElementSibling;
    if (!alvo) return;
    b.addEventListener('click', function () {
      var aberto = b.getAttribute('aria-expanded') === 'true';
      b.setAttribute('aria-expanded', aberto ? 'false' : 'true');
      alvo.hidden = aberto;
      if (!aberto) {
        var tag = b.querySelector('.cite__tag');
        track('ferramenta_cite', { aula: tag ? tag.textContent.trim() : '' });
      }
    });
  });

  /* ---- 7d. Tabela editável: a leitura acompanha o que você corrige ----
     É o ponto da copy: ela devolve os valores ANTES de interpretar,
     porque dado clínico errado é pior que dado ausente. */
  var table = console_.querySelector('[data-table]');
  if (!table) return;

  var rows = table.querySelectorAll('tbody tr');
  var out = {};
  console_.querySelectorAll('[data-out]').forEach(function (el) {
    out[el.getAttribute('data-out')] = el;
  });

  var stamp = console_.querySelector('[data-stamp]');
  var stampText = console_.querySelector('[data-stamp-text]');
  var conferido = false;

  function num(input) {
    var v = parseFloat(String(input.value).replace(',', '.'));
    return isFinite(v) ? v : 0;
  }

  function recalcular() {
    var basalH2 = 0;
    var picoH2 = -Infinity, picoMin = 0, picoRow = null;
    var picoCh4 = -Infinity;

    rows.forEach(function (tr, i) {
      var minuto = parseInt(tr.querySelector('th').textContent, 10) || 0;
      var h2 = num(tr.querySelector('[data-h2]'));
      var ch4 = num(tr.querySelector('[data-ch4]'));

      if (i === 0) basalH2 = h2;
      if (h2 > picoH2) { picoH2 = h2; picoMin = minuto; picoRow = tr; }
      if (ch4 > picoCh4) picoCh4 = ch4;
    });

    rows.forEach(function (tr) { tr.classList.toggle('is-peak', tr === picoRow); });

    var delta = picoH2 - basalH2;

    out.pico.textContent = String(Math.round(picoH2 * 10) / 10);
    out['pico-min'].textContent = String(picoMin);
    out.delta.textContent = (delta >= 0 ? '+' : '') + (Math.round(delta * 10) / 10);
    out.basal.textContent = String(Math.round(basalH2 * 10) / 10);
    out.ch4.textContent = String(Math.round(picoCh4 * 10) / 10);

    // Cortes que ela usa nas aulas: subida de 20 ppm de H2 até os 90 min,
    // e 10 ppm de CH4 em qualquer ponto para falar de IMO.
    var h2ok = delta >= 20 && picoMin <= 90;
    var imo = picoCh4 >= 10;

    out.verdict.innerHTML =
      (h2ok
        ? 'Critério de H<sub>2</sub> atingido: subida de ' + Math.round(delta) + ' ppm até os ' + picoMin + ' min.'
        : 'Critério de H<sub>2</sub> não atingido com esses valores.') +
      ' ' +
      (imo
        ? 'CH<sub>4</sub> em ' + Math.round(picoCh4) + ' ppm: entra a conversa de IMO.'
        : 'CH<sub>4</sub> abaixo do corte de 10 ppm para IMO.');
  }

  table.addEventListener('input', function (e) {
    if (e.target.tagName !== 'INPUT') return;
    recalcular();
    if (!conferido) {
      conferido = true;
      stamp.classList.add('is-done');
      stampText.textContent = 'Conferido por você';
      track('ferramenta_edit');
    }
  });

  recalcular();
})();
