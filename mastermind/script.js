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

  // Webhook n8n que grava na Data Table mastermind_waitlist
  var WAITLIST_ENDPOINT = 'https://n8n.reachup.pro/webhook/mastermind-waitlist';

  var submitBtn = form.querySelector('[data-submit]');
  var submitLabel = form.querySelector('[data-submit-label]');
  var errorBox = document.getElementById('form-error');
  var enviando = false;

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
    var payload = {
      nome: document.getElementById('nome').value.trim(),
      email: document.getElementById('email').value.trim(),
      telefone: tel.value.trim(),
      profissao: profissao,
      origem: 'lp-mastermind'
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
