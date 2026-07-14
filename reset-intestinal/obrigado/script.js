/* Reset Intestinal — Obrigado · interações mínimas (demo de design)
   Reveal on-scroll (padrão da LP). Tracking (compra_confirmada / lead) entra
   na etapa de desenvolver. */
(function () {
  "use strict";

  /* ---------- Defesa contra link fingerprinter (AC Diffuser) ----------
     O diffuser.js da ActiveCampaign (carregado via GTM) injeta ZWSP/ZWNJ no
     ?text= dos links wa.me, sujando a mensagem de prefill do WhatsApp.
     Reescrevemos o href para a versão limpa no instante da interação. */
  var CLEAN_WPP_HREF = "https://wa.me/5511982055151?text=" +
    encodeURIComponent("Olá! Acabei de entrar no Reset Intestinal e quero agendar minha consulta de avaliação com a Dra. Karina.");
  document.querySelectorAll("a[data-wpp-clean]").forEach(function (a) {
    var enforce = function () {
      if (a.getAttribute("href") !== CLEAN_WPP_HREF) a.setAttribute("href", CLEAN_WPP_HREF);
    };
    enforce();
    ["pointerdown", "mousedown", "touchstart", "contextmenu", "focus", "mouseenter"].forEach(function (evt) {
      a.addEventListener(evt, enforce, true);
    });
  });

  /* Dev fallback: em localhost/file:, o endpoint /.netlify/images não existe.
     Reescreve para o caminho direto da imagem (só afeta preview local). */
  (function () {
    var isDev = location.protocol === "file:" ||
      /^(localhost|127\.0\.0\.1|0\.0\.0\.0)$/.test(location.hostname);
    if (!isDev) return;
    document.querySelectorAll('img[src*="/.netlify/images"]').forEach(function (img) {
      var m = img.getAttribute("src").match(/[?&]url=([^&]+)/);
      if (m) img.src = decodeURIComponent(m[1]);
    });
  })();

  /* ---------- Tracking (GTM dataLayer) ---------- */
  window.dataLayer = window.dataLayer || [];

  // Compra confirmada: comprador do Reset chegou na página de obrigado.
  (function () {
    var qp = new URLSearchParams(location.search);
    var payload = { event: "compra_confirmada", produto: "reset-intestinal", pagina: "obrigado" };
    var tx = qp.get("transaction") || qp.get("trans") || qp.get("hottok");
    if (tx) payload.transaction_id = tx;
    window.dataLayer.push(payload);
  })();

  // Clique nos CTAs: cta_click genérico + consulta_lead nos botões de agendamento.
  document.querySelectorAll("[data-cta]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      window.dataLayer.push({
        event: "cta_click",
        cta_location: btn.getAttribute("data-cta"),
        cta_text: (btn.textContent || "").trim().substring(0, 60),
        cta_url: btn.href || ""
      });
      if (btn.hasAttribute("data-agendar")) {
        window.dataLayer.push({ event: "consulta_lead", origem: "reset-obrigado", canal: "whatsapp" });
      }
    });
  });

  /* ---------- Reveal on-scroll ---------- */
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var els = document.querySelectorAll("[data-reveal]");

  if (reduce || !("IntersectionObserver" in window)) {
    els.forEach(function (el) { el.classList.add("is-in"); });
    return;
  }

  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (e.isIntersecting) {
        e.target.classList.add("is-in");
        io.unobserve(e.target);
      }
    });
  }, { threshold: 0.12, rootMargin: "0px 0px -8% 0px" });

  els.forEach(function (el) { io.observe(el); });
})();
