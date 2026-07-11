(function () {
  'use strict';

  if (window.AOS) {
    AOS.init({
      duration: 700,
      easing: 'ease-out-cubic',
      once: true,
      offset: 80,
      disableMutationObserver: true
    });
  }

  var modal = document.getElementById('waitlist');
  var form = document.getElementById('waitlist-form');
  var success = document.getElementById('waitlist-success');
  if (!modal || !form || !success) return;

  document.querySelectorAll('[data-open-modal]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      if (typeof modal.showModal === 'function') modal.showModal();
      else modal.setAttribute('open', '');
      // Foca o titulo em vez do botao fechar, sem abrir o teclado no mobile
      var title = document.getElementById('waitlist-title');
      if (title) title.focus({ preventScroll: true });
    });
  });

  // Fechar ao clicar no backdrop
  modal.addEventListener('click', function (e) {
    if (e.target === modal) modal.close();
  });

  // Restaura o formulario quando o modal fecha
  modal.addEventListener('close', function () {
    form.hidden = false;
    success.hidden = true;
  });

  // Mascara simples de telefone brasileiro
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
      corpo: 'Quando a turma abrir, eu te aviso por e-mail e WhatsApp antes da divulgação pública. ' +
             'Até lá, se quiser acompanhar como eu penso os casos, me segue no Instagram.'
    },
    'fora-saude': {
      titulo: 'Recebi seu cadastro.',
      corpo: 'O Mastermind é uma formação para profissionais de saúde que já atendem, então o conteúdo ' +
             'é bem técnico. Se você chegou aqui procurando cuidar do seu próprio intestino, eu tenho ' +
             'material feito para paciente e te aviso quando abrir.'
    }
  };

  // Webhook n8n → grava na utm_tracking (Supabase) da Karina, atribuído por UTM
  var WAITLIST_ENDPOINT = 'https://n8n.reachup.pro/webhook/mastermind-waitlist';

  var submitBtn = form.querySelector('[data-submit]');
  var submitLabel = form.querySelector('[data-submit-label]');
  var errorBox = document.getElementById('form-error');
  var enviando = false;

  // ---- Captura de tracking (só no momento do cadastro, sem sessão persistida) ----
  function qp(name) {
    try { return new URLSearchParams(location.search).get(name) || ''; }
    catch (e) { return ''; }
  }

  function deviceType() {
    return /Mobi|Android|iPhone|iPad|iPod|Windows Phone/i.test(navigator.userAgent) ? 'mobile' : 'desktop';
  }

  // Um id leve pra este cadastro (não registramos utm_sessions; serve de rastro/dedupe)
  function sessionId() {
    try {
      var k = 'mm_sid', v = localStorage.getItem(k);
      if (!v) {
        v = 's_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
        localStorage.setItem(k, v);
      }
      return v;
    } catch (e) {
      return 's_' + Date.now().toString(36);
    }
  }

  // URL completa de cadastro: a página (que já qualifica o público) + UTMs + profissão/nome
  function cadastroUrl(nome, profissao) {
    try {
      var u = new URL(location.href);
      u.searchParams.set('lead_profissao', profissao);
      if (nome) u.searchParams.set('lead_nome', nome);
      return u.toString();
    } catch (e) {
      return location.href;
    }
  }

  function mostrarSucesso(profissao) {
    var texto = COPY[profissao] || COPY.padrao;
    success.querySelector('[data-success-title]').textContent = texto.titulo;
    success.querySelector('[data-success-body]').textContent = texto.corpo;
    form.hidden = true;
    success.hidden = false;
    modal.scrollTop = 0;
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (enviando) return;
    if (!form.reportValidity()) return;

    var profissao = document.getElementById('profissao').value;
    var nome = document.getElementById('nome').value.trim();
    var payload = {
      // dados do formulário
      nome: nome,
      email: document.getElementById('email').value.trim(),
      telefone: tel.value.trim(),
      profissao: profissao,
      origem: 'lp-mastermind',
      // tracking p/ atribuição (n8n deriva ad_id/adset_id/campaign_id/platform)
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

    // Sinaliza a conversão no dataLayer (GTM) sem bloquear o envio
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({ event: 'waitlist_submit', profissao: profissao });

    fetch(WAITLIST_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        window.dataLayer.push({ event: 'waitlist_success', profissao: profissao });
        mostrarSucesso(profissao);
      })
      .catch(function () {
        errorBox.hidden = false;
      })
      .then(function () {
        enviando = false;
        submitBtn.disabled = false;
        submitLabel.textContent = 'Entrar na lista';
      });
  });
})();
