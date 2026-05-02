/* ================================================================
   Tudo Sobre SIBO · script.js
   - Supabase lote (real-time, polling 30s, refresh on focus)
   - IntersectionObserver reveal
   - Counter animation (stat 70%)
   - Scroll-driven progress (algoritmo timeline)
   - Lote cells sync (oferta tabela)
   - Floating CTA: aparece após hero, esconde sobre footer
   ================================================================ */

(function () {
  "use strict";

  /* ========================================================
     1. Supabase lote
     ======================================================== */
  const LOTE_ENDPOINT =
    "https://viflrlxwvziimdbbcgtf.supabase.co/functions/v1/lote-sibo?evento=tudo-sobre-sibo";
  const LOTE_REFRESH_MS = 30000;
  const LOTE_FALLBACK_COR = "#22c55e";

  /** Piso visual da barra: enquanto vendas reais ≤ 50%, exibe 50% e oculta vagas restantes.
   *  Acima de 50%, exibe valor real e mostra vagas restantes. */
  const PISO_VISUAL = 50;

  /** Estado do último fetch — registro do valor real (auditoria) e do display calculado */
  const loteState = {
    cor: LOTE_FALLBACK_COR,
    realPercent: 0,
    displayPercent: PISO_VISUAL,
    showVagas: false,
    loteNumero: 1,
    esgotado: false,
  };

  async function carregarLote() {
    try {
      const res = await fetch(LOTE_ENDPOINT, { cache: "no-store" });
      if (!res.ok) throw new Error("http " + res.status);
      const data = await res.json();
      aplicarLoteNaPagina(data);
    } catch (e) {
      console.warn("[lote] falha ao buscar status:", e);
      document
        .querySelectorAll("[data-lote-bar]")
        .forEach((el) => el.classList.add("lote-erro"));
    }
  }

  function aplicarLoteNaPagina(data) {
    document
      .querySelectorAll("[data-lote-bar]")
      .forEach((el) => el.classList.remove("lote-erro"));

    if (data.esgotado) {
      const corEsgotado = "#ef4444";
      loteState.cor = corEsgotado;
      loteState.realPercent = 100;
      loteState.displayPercent = 100;
      loteState.showVagas = true;
      loteState.loteNumero = 4;
      loteState.esgotado = true;

      setText("[data-lote-percent-text]", "100%");
      setText("[data-lote-vagas-restantes]", "Esgotado");
      setText("[data-lote-preco]", "—");

      document.querySelectorAll("[data-lote-percent-fill]").forEach((el) => {
        el.style.width = "100%";
        el.style.backgroundColor = corEsgotado;
      });

      /* Esgotado nunca é low: mostra "Esgotado" no lugar das vagas */
      document.querySelectorAll("[data-lote-bar]").forEach((el) => {
        el.dataset.lowVendas = "false";
      });
      document.querySelectorAll(".lotes-table").forEach((el) => {
        el.dataset.lowVendas = "false";
      });

      pintarLoteCor(corEsgotado);
      atualizarLoteCells(4);
      return;
    }

    const cor = data.lote_cor || LOTE_FALLBACK_COR;
    const realPercent = Math.min(100, Math.round(Number(data.lote_percent) || 0));
    const displayPercent = Math.max(PISO_VISUAL, realPercent);
    const showVagas = realPercent > PISO_VISUAL;
    const vagasRestantes = Number(data.lote_vagas_restantes) || 0;
    const lotePreco = Number(data.lote_preco) || 0;
    const loteNumero = Number(data.lote_numero) || 1;

    loteState.cor = cor;
    loteState.realPercent = realPercent;
    loteState.displayPercent = displayPercent;
    loteState.showVagas = showVagas;
    loteState.loteNumero = loteNumero;
    loteState.esgotado = false;

    setText("[data-lote-percent-text]", displayPercent + "%");
    setText("[data-lote-preco]", "R$" + lotePreco);

    if (showVagas) {
      setText(
        "[data-lote-vagas-restantes]",
        vagasRestantes +
          " " +
          (vagasRestantes === 1 ? "vaga restante" : "vagas restantes")
      );
    } else {
      /* Limpa o texto para que screen-readers também não anunciem informação que não vai aparecer */
      setText("[data-lote-vagas-restantes]", "");
    }

    document.querySelectorAll("[data-lote-percent-fill]").forEach((el) => {
      el.style.width = displayPercent + "%";
      el.style.backgroundColor = cor;
    });

    document.querySelectorAll(".lote-big__bar").forEach((el) => {
      el.setAttribute("aria-valuenow", String(displayPercent));
    });

    /* Marca containers para CSS ocultar vagas-restantes + separador adjacente */
    document.querySelectorAll("[data-lote-bar]").forEach((el) => {
      el.dataset.lowVendas = String(!showVagas);
    });
    /* Tabela de lotes: oculta capacidade ("50 vagas"/"100 vagas") nos cards quando low */
    document.querySelectorAll(".lotes-table").forEach((el) => {
      el.dataset.lowVendas = String(!showVagas);
    });

    pintarLoteCor(cor);
    atualizarLoteCells(loteNumero);
  }

  function setText(selector, value) {
    document.querySelectorAll(selector).forEach((el) => (el.textContent = value));
  }

  function pintarLoteCor(cor) {
    document.querySelectorAll(".lote-progress__dot").forEach((el) => {
      el.style.background = cor;
      el.style.color = cor;
    });
    document.querySelectorAll(".lote-progress__head strong").forEach((el) => {
      el.style.color = cor;
    });
    document.querySelectorAll(".float-cta__metric strong").forEach((el) => {
      el.style.color = cor;
    });
    document.querySelectorAll(".lote-big__display strong").forEach((el) => {
      el.style.color = cor;
    });
    document.querySelectorAll("[data-lote-percent-fill]").forEach((el) => {
      el.style.backgroundColor = cor;
      el.style.color = cor;
    });
    /* CTA final pill */
    document.querySelectorAll(".cta-final__pill").forEach((el) => {
      el.style.color = cor;
      el.style.borderColor = hexToRgba(cor, 0.30);
      el.style.background = hexToRgba(cor, 0.08);
    });
  }

  /** Pinta a tabela de lotes da seção 8 marcando o lote ativo */
  function atualizarLoteCells(loteNumero) {
    document.querySelectorAll(".lote-cell").forEach((cell) => {
      const num = Number(cell.dataset.loteCell);
      const ativo = num === loteNumero;
      cell.classList.toggle("lote-cell--ativo", ativo);
      /* Esmaece os passados E os futuros */
      cell.style.opacity = ativo ? "1" : (num < loteNumero ? "0.25" : "0.4");

      let badge = cell.querySelector(".lote-cell__badge");
      if (ativo && !badge) {
        badge = document.createElement("span");
        badge.className = "lote-cell__badge";
        badge.textContent = "atual";
        cell.appendChild(badge);
      } else if (!ativo && badge) {
        badge.remove();
      }
    });
  }

  function hexToRgba(hex, alpha) {
    const m = /^#([0-9a-f]{6})$/i.exec(hex || "");
    if (!m) return hex;
    const num = parseInt(m[1], 16);
    return (
      "rgba(" +
      ((num >> 16) & 255) +
      "," +
      ((num >> 8) & 255) +
      "," +
      (num & 255) +
      "," +
      alpha +
      ")"
    );
  }

  /* ========================================================
     2. Reveal on scroll
     ======================================================== */
  function setupReveal() {
    if (!("IntersectionObserver" in window)) {
      document
        .querySelectorAll("[data-reveal]")
        .forEach((el) => el.classList.add("is-visible"));
      return;
    }

    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            obs.unobserve(entry.target);
          }
        });
      },
      {
        threshold: 0.12,
        rootMargin: "0px 0px -8% 0px",
      }
    );

    document.querySelectorAll("[data-reveal]").forEach((el) => obs.observe(el));
  }

  /* ========================================================
     3. Counter animation (stat 70%)
     ======================================================== */
  function setupCounters() {
    const counters = document.querySelectorAll("[data-counter]");
    if (!counters.length) return;

    /* Marcar como animado pra evitar duplo-disparo */
    const fired = new WeakSet();
    const fire = (el) => {
      if (fired.has(el)) return;
      fired.add(el);
      const target = Number(el.dataset.counterTo) || 0;
      animateCount(el, 0, target, 1400);
    };

    if (!("IntersectionObserver" in window)) {
      counters.forEach(fire);
      return;
    }

    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            fire(entry.target);
            obs.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15, rootMargin: "0px 0px -10% 0px" }
    );

    counters.forEach((el) => obs.observe(el));

    /* Fallback: se em 4s o counter ainda não disparou (ex: scroll suave que não atinge threshold), força */
    setTimeout(() => {
      counters.forEach((el) => {
        if (!fired.has(el)) {
          const rect = el.getBoundingClientRect();
          const inView = rect.top < window.innerHeight && rect.bottom > 0;
          if (inView) fire(el);
        }
      });
    }, 4000);
  }

  function animateCount(el, from, to, duration) {
    const start = performance.now();
    function frame(now) {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3); /* easeOutCubic */
      const value = Math.round(from + (to - from) * eased);
      el.textContent = String(value);
      if (t < 1) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  /* ========================================================
     4. Scroll-driven timeline (Algoritmo)
     ======================================================== */
  function setupAlgoritmoProgress() {
    const timeline = document.querySelector(".algoritmo__timeline");
    if (!timeline || !("IntersectionObserver" in window)) return;

    const linePath = timeline.querySelector(".algoritmo__line-path");
    if (!linePath) return;

    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            timeline.classList.add("is-progress");
            obs.unobserve(timeline);
          }
        });
      },
      { threshold: 0.3 }
    );

    obs.observe(timeline);
  }

  /* ========================================================
     5. Floating CTA — visível após hero, oculto sobre footer
     ======================================================== */
  function setupFloatCta() {
    const floatCta = document.querySelector(".float-cta");
    const heroProgress = document.querySelector(".hero .lote-progress");
    const footer = document.querySelector(".site-footer");
    if (!floatCta) return;

    if (heroProgress && "IntersectionObserver" in window) {
      const obsHero = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            const visible = !entry.isIntersecting;
            floatCta.dataset.visible = String(visible);
            floatCta.setAttribute("aria-hidden", String(!visible));
          });
        },
        { threshold: 0, rootMargin: "0px 0px 0px 0px" }
      );
      obsHero.observe(heroProgress);
    }

    if (footer && "IntersectionObserver" in window) {
      const obsFooter = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            floatCta.dataset.nearBottom = String(entry.isIntersecting);
          });
        },
        { threshold: 0, rootMargin: "0px 0px -40px 0px" }
      );
      obsFooter.observe(footer);
    }
  }

  /* ========================================================
     6. FAQ — single-expand mode (uma resposta aberta por vez)
     ======================================================== */
  function setupFAQ() {
    const items = document.querySelectorAll(".faq-item");
    items.forEach((item) => {
      item.addEventListener("toggle", () => {
        if (item.open) {
          items.forEach((other) => {
            if (other !== item) other.open = false;
          });
        }
      });
    });
  }

  /* ========================================================
     7. Lifecycle
     ======================================================== */
  document.addEventListener("DOMContentLoaded", () => {
    setupReveal();
    setupCounters();
    setupAlgoritmoProgress();
    setupFloatCta();
    setupFAQ();

    carregarLote();
    setInterval(carregarLote, LOTE_REFRESH_MS);
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) carregarLote();
    });
  });
})();
