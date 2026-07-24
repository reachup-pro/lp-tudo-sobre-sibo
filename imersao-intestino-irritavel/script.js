/* ================================================================
   Imersão Intestino Irritável na Prática (SII) · script.js
   Portado de Tudo Sobre SIBO (mesma mecânica comprovada).
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
     0. Parâmetros de URL — preservação obrigatória nos checkouts
     ========================================================
     O href dos CTAs é reescrito a cada polling do lote. Sem isto, a reescrita
     apagaria utm/src/sck e a venda chegaria na Hotmart sem origem.
     NÃO depende do GTM: a página guarda os params da entrada e re-decora
     sempre — no rewrite e de novo no clique (rede de segurança contra
     qualquer terceiro que mexa no href depois). Mesma convenção da tag do GTM
     (src = utm_source, sck = chave|valor|...), então os dois juntos são
     idempotentes. */
  const URL_PARAMS = (function () {
    const out = {};
    if (!window.URLSearchParams) return out;
    let search;
    try {
      search = new URLSearchParams(window.location.search);
    } catch (e) {
      return out;
    }
    const sckParts = [];
    search.forEach(function (value, key) {
      out[key] = value;
      const k = key.toLowerCase();
      if (k !== "src" && k !== "sck") {
        sckParts.push(key);
        sckParts.push(value);
      }
    });
    if (out.utm_source) out.src = out.utm_source;
    if (sckParts.length) out.sck = sckParts.join("|");
    return out;
  })();

  const URL_PARAM_KEYS = Object.keys(URL_PARAMS);

  /** Devolve a URL com os parâmetros da visita reaplicados. Idempotente:
   *  chamar de novo sobre uma URL já decorada não duplica nada. */
  function comParams(url) {
    if (!URL_PARAM_KEYS.length || !url) return url;
    const s = String(url);
    if (s.charAt(0) === "#" || s.indexOf("javascript:") === 0) return url;
    try {
      const u = new URL(s, window.location.origin);
      URL_PARAM_KEYS.forEach(function (k) {
        u.searchParams.set(k, URL_PARAMS[k]);
      });
      return u.toString();
    } catch (e) {
      return url;
    }
  }

  /** Última linha de defesa: re-decora o href no momento do clique, cobrindo
   *  qualquer reescrita feita depois do nosso rewrite (GTM, extensão, etc). */
  function setupCtaParamGuard() {
    if (!URL_PARAM_KEYS.length) return;
    const guard = function (ev) {
      const alvo = ev.target;
      const link = alvo && alvo.closest ? alvo.closest("a[data-cta]") : null;
      if (!link) return;
      const href = link.getAttribute("href");
      if (!href || href.charAt(0) === "#") return;
      link.setAttribute("href", comParams(href));
    };
    document.addEventListener("click", guard, true);
    document.addEventListener("auxclick", guard, true);
  }

  /* ========================================================
     1. Supabase lote
     ======================================================== */
  /* Endpoint do lote parametrizado pelo evento. Requer, no backend, uma linha
   * em `evento_lotes` com evento_slug='imersao-intestino-irritavel' (lotes
   * 27/47/67/97) e as vendas escopadas a este produto. A Edge Function `lote-sibo`
   * já aceita o parâmetro `evento`. Enquanto o evento não existe, ela responde
   * { erro } e a página mantém o fallback estático (R$27 / 50% / verde). */
  const LOTE_ENDPOINT =
    "https://viflrlxwvziimdbbcgtf.supabase.co/functions/v1/lote-sibo?evento=imersao-intestino-irritavel";
  const LOTE_REFRESH_MS = 30000;
  const LOTE_FALLBACK_COR = "#22c55e";

  /** Escassez: sobrescreve a cor da barra de progresso (NÃO a identidade do lote)
   *  quando o lote ativo está prestes a esgotar. Identidade do lote (número, preço,
   *  badge "atual" na tabela) permanece com a cor real do lote. */
  const SCARCITY_COR = "#ef4444";
  const SCARCITY_VAGAS_MAX = 5;
  const SCARCITY_PERCENT_MIN = 90;

  function emEscassez(realPercent, vagasRestantes) {
    return vagasRestantes <= SCARCITY_VAGAS_MAX || realPercent >= SCARCITY_PERCENT_MIN;
  }

  /** URLs Hotmart por lote — Hotmart não suporta URL única que detecta lote.
   *  Produto M106868374A ("Imersão Intestino Irritável Na Prática"), 1 offer por lote.
   *  Trocadas automaticamente nos a[data-cta] conforme o lote ativo que vem do
   *  Supabase (virada em 50 / 150 / 250 vendas acumuladas). Os hrefs estáticos do
   *  index.html apontam pro Lote 1 e servem de fallback se o fetch falhar.
   *  Lote 4 é o último: nunca vira "esgotado" na página (ver bloco data.esgotado). */
  const HOTMART_URLS = {
    1: "https://pay.hotmart.com/M106868374A?off=x99yf7zv&checkoutMode=10",
    2: "https://pay.hotmart.com/M106868374A?off=9wjoqicp&checkoutMode=10",
    3: "https://pay.hotmart.com/M106868374A?off=t1vseyll&checkoutMode=10",
    4: "https://pay.hotmart.com/M106868374A?off=4mix64vj&checkoutMode=10",
  };

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
      /* Evento não configurado / pausado no backend (sem linha ativa em
       * `evento_lotes`): a Edge Function responde 200 com { erro: "evento nao
       * encontrado" }. Nesse caso mantemos o fallback estático do HTML
       * (R$27 / 50% / verde), sem marcar erro visual.
       * Atenção: quando `esgotado` é true o payload legitimamente NÃO traz
       * `lote_preco` — esse caso precisa passar para aplicarLoteNaPagina(),
       * que é quem mantém a venda aberta no Lote 4. */
      if (!data || data.erro) {
        console.info("[lote] evento não configurado ainda; usando fallback estático.");
        return;
      }
      if (!data.esgotado && data.lote_preco == null) {
        console.info("[lote] payload sem lote ativo; usando fallback estático.");
        return;
      }
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
      /* Lote 4 = "sem limite". A RPC devolve esgotado:true quando as vendas passam
       * da capacidade nominal somada (50+100+100+100 = 350), mas a venda NÃO fecha:
       * este override mantém o checkout do Lote 4 ativo e trava a barra em 99% +
       * 10 vagas restantes (escassez máxima). NÃO renderiza "Esgotado". */
      const corLote4 = "#ef4444";
      const PERCENT_TRAVADO = 99;
      const VAGAS_RESTANTES_TRAVADO = 10;
      loteState.cor = corLote4;
      loteState.realPercent = PERCENT_TRAVADO;
      loteState.displayPercent = PERCENT_TRAVADO;
      loteState.showVagas = true;
      loteState.loteNumero = 4;
      loteState.esgotado = false;

      setText("[data-lote-percent-text]", PERCENT_TRAVADO + "%");
      setText(
        "[data-lote-vagas-restantes]",
        VAGAS_RESTANTES_TRAVADO + " vagas restantes"
      );
      setText("[data-lote-preco]", "R$97");

      document.querySelectorAll("[data-lote-percent-fill]").forEach((el) => {
        el.style.width = PERCENT_TRAVADO + "%";
        el.style.backgroundColor = corLote4;
      });

      document.querySelectorAll(".lote-big__bar").forEach((el) => {
        el.setAttribute("aria-valuenow", String(PERCENT_TRAVADO));
      });

      /* lowVendas=false: exibe "10 vagas restantes". scarcity=true: visual urgente. */
      document.querySelectorAll("[data-lote-bar]").forEach((el) => {
        el.dataset.lowVendas = "false";
        el.dataset.scarcity = "true";
      });
      document.querySelectorAll(".float-cta").forEach((el) => {
        el.dataset.scarcity = "true";
      });
      document.querySelectorAll(".lotes-table").forEach((el) => {
        el.dataset.lowVendas = "false";
      });

      pintarLoteCor(corLote4);
      atualizarLoteCells(4);
      aplicarUrlCTAs(4);
      return;
    }

    const cor = data.lote_cor || LOTE_FALLBACK_COR;
    const realPercent = Math.min(100, Math.round(Number(data.lote_percent) || 0));
    const displayPercent = Math.max(PISO_VISUAL, realPercent);
    const showVagas = realPercent > PISO_VISUAL;
    const vagasRestantes = Number(data.lote_vagas_restantes) || 0;
    const lotePreco = Number(data.lote_preco) || 0;
    const loteNumero = Number(data.lote_numero) || 1;
    const escassez = emEscassez(realPercent, vagasRestantes);
    const corEfetiva = escassez ? SCARCITY_COR : cor;

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
      el.style.backgroundColor = corEfetiva;
    });

    document.querySelectorAll(".lote-big__bar").forEach((el) => {
      el.setAttribute("aria-valuenow", String(displayPercent));
    });

    /* Marca containers para CSS ocultar vagas-restantes + separador adjacente */
    document.querySelectorAll("[data-lote-bar]").forEach((el) => {
      el.dataset.lowVendas = String(!showVagas);
      el.dataset.scarcity = String(escassez);
    });
    document.querySelectorAll(".float-cta").forEach((el) => {
      el.dataset.scarcity = String(escassez);
    });
    /* Tabela de lotes: oculta capacidade ("50 vagas"/"100 vagas") nos cards quando low */
    document.querySelectorAll(".lotes-table").forEach((el) => {
      el.dataset.lowVendas = String(!showVagas);
    });

    pintarLoteCor(corEfetiva);
    atualizarLoteCells(loteNumero);
    aplicarUrlCTAs(loteNumero);
  }

  /** Atualiza href de todos os a[data-cta] (hero, oferta, final, float) para
   *  apontar ao checkout Hotmart do lote ativo, SEMPRE preservando os
   *  parâmetros da visita. Defensiva: cai pro Lote 1 se inválido. */
  function aplicarUrlCTAs(loteNumero) {
    const num = Number(loteNumero) || 1;
    const url = comParams(HOTMART_URLS[num] || HOTMART_URLS[1]);
    document.querySelectorAll("a[data-cta]").forEach((el) => {
      el.href = url;
    });
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
    /* Decora os hrefs estáticos antes do primeiro fetch do lote e arma a
       proteção de clique — a página nunca fica sem os params. */
    document.querySelectorAll("a[data-cta]").forEach((el) => {
      const href = el.getAttribute("href");
      if (href && href.charAt(0) !== "#") el.href = comParams(href);
    });
    setupCtaParamGuard();

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
