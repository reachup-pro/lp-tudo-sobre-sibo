// dashboard.js — orchestrator do dashboard real-time Karina/SIBO
import { sb, rpc, from, SUPABASE_URL } from '/dashboard-imersao/lib/supabase.js';
import { brl, num, pct, ago, dateBRT, timeBRT, dateOnly, freshness, countdown, delta } from '/dashboard-imersao/lib/format.js';
import { makeTimelineChart, makeLotesChart, COLORS } from '/dashboard-imersao/lib/charts.js';
import { subscribeVendas, startPolling } from '/dashboard-imersao/lib/realtime.js';

const EVENTO_SLUG = 'tudo-sobre-sibo';
const LOTE_ENDPOINT = `${SUPABASE_URL}/functions/v1/lote-sibo?evento=${EVENTO_SLUG}`;

// State
const state = {
  evento: null,                 // resposta de validate_token
  lote: null,                   // resposta do lote-sibo (Edge)
  kpis: null,
  funil: null,
  topAds: [],
  distrib: null,
  health: null,
  feed: [],                     // últimas 20 vendas
  charts: { timeline: null, lotes: null },
  lastUpdate: Date.now()
};

// =========================================================
// 1. GATE — valida token na URL
// =========================================================
async function gate() {
  const k = new URLSearchParams(location.search).get('k');
  if (!k) return redirectGate();
  try {
    const r = await rpc('dashboard_validate_token', { p_token: k });
    if (!r?.ok) return redirectGate();
    state.evento = r;
  } catch (e) {
    console.error('gate:', e);
    return redirectGate();
  }
  return true;
}
function redirectGate() {
  location.replace('/dashboard-imersao/acesso-restrito.html');
}

// =========================================================
// 2. RENDER — KPIs, hero, funil, distrib, top ads, feed
// =========================================================

function setText(sel, value) {
  const el = document.querySelector(sel);
  if (el) { el.textContent = value; el.classList.remove('skeleton'); }
}

function renderHeader() {
  setText('[data-evt-nome]', state.kpis?.produto_nome || 'Tudo Sobre SIBO');
  setText('[data-updated]', `atualizado ${ago(state.lastUpdate)}`);
  setText('[data-clock]', timeBRT(new Date().toISOString()));
}

function renderHero() {
  const k = state.kpis;
  if (!k) return;
  const lote = k.lote || {};
  const totalVendas = k.vendas_count || 0;
  const cap = k.meta_capacidade || 300;
  setText('[data-hero-vendas]', `${totalVendas}/${cap}`);
  setText('[data-hero-receita]', brl(k.vendas_total_brl, { cents: false }));

  // Pill lote
  setText('[data-lote-pill]', `Lote ${lote.lote_numero || '—'} · ${brl(lote.lote_preco, { cents: false })} · ${lote.lote_vagas_restantes ?? '—'} vagas`);

  // Barra
  const fill = document.querySelector('[data-lote-fill]');
  if (fill) {
    const pctVal = lote.lote_percent ?? 0;
    fill.style.width = `${Math.max(2, pctVal)}%`;
    fill.style.background = lote.lote_cor || 'var(--lote-1)';
  }
  setText('[data-lote-meta-vendas]', `${lote.lote_vendas ?? 0}/${lote.lote_capacidade ?? 0}`);
  setText('[data-lote-meta-pct]', `${pctVal(lote.lote_percent)}`);

  function pctVal(v) { return v != null ? `${v.toFixed?.(0) ?? v}%` : '—'; }
}

function renderCountdown() {
  if (!state.kpis?.data_evento) return;
  const c = countdown(state.kpis.data_evento);
  if (c.ended) {
    setText('[data-countdown]', 'EVENTO INICIADO');
    return;
  }
  setText('[data-countdown]', `${c.d}d ${String(c.h).padStart(2, '0')}h ${String(c.m).padStart(2, '0')}m ${String(c.s).padStart(2, '0')}s`);
}

function setKpiCard(label, valueEl, deltaEl, value, prevValue, formatter, options = {}) {
  if (valueEl) {
    valueEl.textContent = value === null || value === undefined ? '—' : formatter(value);
    valueEl.classList.remove('skeleton');
  }
  if (deltaEl && prevValue !== undefined) {
    const d = delta(value || 0, prevValue || 0);
    deltaEl.textContent = d;
    const numD = parseFloat(d);
    deltaEl.removeAttribute('data-positive');
    deltaEl.removeAttribute('data-negative');
    deltaEl.removeAttribute('data-neutral');
    if (Number.isNaN(numD) || numD === 0) deltaEl.setAttribute('data-neutral', '');
    else if (options.invertColors ? numD < 0 : numD > 0) deltaEl.setAttribute('data-positive', '');
    else deltaEl.setAttribute('data-negative', '');
  }
}

function renderKPIs() {
  const k = state.kpis;
  if (!k) return;

  setKpiCard('Receita',
    document.querySelector('[data-kpi-receita-val]'),
    null,
    k.vendas_total_brl, null, brl);

  setKpiCard('Vendas hoje',
    document.querySelector('[data-kpi-vendas-val]'),
    document.querySelector('[data-kpi-vendas-delta]'),
    k.vendas_hoje, k.vendas_ontem, num);

  // ROAS com meta visual
  const roasEl = document.querySelector('[data-kpi-roas-val]');
  const roasCard = document.querySelector('[data-kpi-roas-card]');
  if (roasEl) {
    roasEl.textContent = k.roas !== null && k.roas !== undefined ? k.roas.toFixed(2) : '—';
    roasEl.classList.remove('skeleton');
  }
  if (roasCard && k.meta_roas) {
    roasCard.removeAttribute('data-meta-ok');
    roasCard.removeAttribute('data-meta-warn');
    roasCard.removeAttribute('data-meta-bad');
    if (k.roas == null) {/* sem dado */ }
    else if (k.roas >= k.meta_roas) roasCard.setAttribute('data-meta-ok', '');
    else if (k.roas >= k.meta_roas * 0.8) roasCard.setAttribute('data-meta-warn', '');
    else roasCard.setAttribute('data-meta-bad', '');
  }
  setText('[data-kpi-roas-sub]', k.meta_roas ? `meta ≥ ${k.meta_roas}` : '');

  // CPA com meta visual
  const cpaEl = document.querySelector('[data-kpi-cpa-val]');
  const cpaCard = document.querySelector('[data-kpi-cpa-card]');
  if (cpaEl) {
    cpaEl.textContent = k.cpa_brl !== null && k.cpa_brl !== undefined ? brl(k.cpa_brl) : '—';
    cpaEl.classList.remove('skeleton');
  }
  if (cpaCard && k.meta_cpa) {
    cpaCard.removeAttribute('data-meta-ok');
    cpaCard.removeAttribute('data-meta-warn');
    cpaCard.removeAttribute('data-meta-bad');
    if (k.cpa_brl == null) {/* sem dado */ }
    else if (k.cpa_brl <= k.meta_cpa) cpaCard.setAttribute('data-meta-ok', '');
    else if (k.cpa_brl <= k.meta_cpa * 1.2) cpaCard.setAttribute('data-meta-warn', '');
    else cpaCard.setAttribute('data-meta-bad', '');
  }
  setText('[data-kpi-cpa-sub]', k.meta_cpa ? `meta ≤ ${brl(k.meta_cpa, { cents: false })}` : '');

  setText('[data-kpi-spend-val]', brl(k.ads_spend_brl, { cents: false }));
  setText('[data-kpi-spend-sub]', `${num(k.ads_impressions, { compact: true })} impressões · CTR ${pct(k.ads_ctr)}`);

  // Conversão: vendas_count / clicks
  const conv = k.ads_clicks > 0 ? (k.vendas_count / k.ads_clicks * 100) : null;
  setText('[data-kpi-conv-val]', conv !== null ? pct(conv) : '—');
  setText('[data-kpi-conv-sub]', k.ads_clicks ? `${num(k.ads_clicks, { compact: true })} cliques` : '—');
}

function renderTimeline(rows) {
  if (!rows || !rows.length) return;
  const labels = rows.map(r => dateBRT(r.hora));
  const vendas = rows.map(r => r.vendas);
  // Spend por hora (placeholder — com meta_ads vazio será 0)
  const spend = rows.map(() => 0);

  if (state.charts.timeline) state.charts.timeline.destroy();
  const canvas = document.querySelector('[data-chart-timeline]');
  if (canvas) state.charts.timeline = makeTimelineChart(canvas, { labels, vendas, spend });
}

function renderDistribuicaoLotes() {
  if (!state.distrib?.por_preco) return;
  const map = new Map(state.distrib.por_preco.map(r => [Number(r.preco), Number(r.qtd)]));
  // Lotes canônicos do plano
  const lotes = [
    { num: 1, preco: 27,  cap: 50,  cor: '#22c55e' },
    { num: 2, preco: 47,  cap: 100, cor: '#eab308' },
    { num: 3, preco: 97,  cap: 100, cor: '#f97316' },
    { num: 4, preco: 147, cap: 50,  cor: '#ef4444' }
  ];
  const container = document.querySelector('[data-lotes-grid]');
  if (!container) return;
  container.innerHTML = lotes.map(l => {
    const vendidas = map.get(l.preco) || 0;
    const pct = Math.min(100, Math.round(vendidas / l.cap * 100));
    return `
      <div class="lote-card" style="--lote-color: ${l.cor}">
        <div class="lote-card__num">Lote ${l.num}</div>
        <div class="lote-card__preco">${brl(l.preco, { cents: false })}</div>
        <div class="lote-card__bar"><div class="lote-card__fill" style="width: ${Math.max(2, pct)}%"></div></div>
        <div class="lote-card__meta">
          <span>${vendidas}/${l.cap}</span>
          <span>${pct}%</span>
        </div>
      </div>
    `;
  }).join('');
}

function renderTopAds() {
  const tbody = document.querySelector('[data-topads-body]');
  if (!tbody) return;
  if (!state.topAds.length) {
    tbody.innerHTML = `
      <tr><td colspan="9" class="tbl-empty">
        Nenhum dado Meta Ads ainda
        <small>Aguardando primeiro ciclo do workflow [Karina] Meta Ads → Supabase (45min)</small>
      </td></tr>`;
    return;
  }
  tbody.innerHTML = state.topAds.map(a => {
    const roasClass = a.roas == null ? '' : (a.roas >= 3 ? 'data-good' : (a.roas < 1 ? 'data-bad' : ''));
    const thumb = a.thumbnail_url
      ? `<img src="${a.thumbnail_url}" class="tbl__thumb" loading="lazy" alt="">`
      : `<div class="tbl__thumb"></div>`;
    return `
      <tr>
        <td>${thumb}</td>
        <td>${escapeHtml(a.ad_name || '—')}<br><small style="color:var(--cream-3)">${escapeHtml(a.adset_name || '')}</small></td>
        <td class="tbl__num">${brl(a.spend_brl)}</td>
        <td class="tbl__num">${num(a.impressions, { compact: true })}</td>
        <td class="tbl__num">${pct(a.ctr)}</td>
        <td class="tbl__num">${num(a.purchases_meta)}</td>
        <td class="tbl__num">${brl(a.purchase_value_meta_brl)}</td>
        <td class="tbl__num tbl__roas" ${roasClass}>${a.roas == null ? '—' : a.roas.toFixed(2)}</td>
        <td class="tbl__num">${a.cpa_brl == null ? '—' : brl(a.cpa_brl)}</td>
      </tr>
    `;
  }).join('');
}

function renderFunil() {
  if (!state.funil) return;
  const f = state.funil;
  const max = Math.max(f.impressoes || 1, 1);
  const setBar = (sel, val) => {
    const fillEl = document.querySelector(`${sel} .funil__bar-fill`);
    if (fillEl) fillEl.style.width = `${Math.min(100, (val / max) * 100)}%`;
  };
  const setNum = (sel, val) => {
    const el = document.querySelector(`${sel} .funil__num`);
    if (el) { el.textContent = num(val, { compact: true }); el.classList.remove('skeleton'); }
  };
  const setPct = (sel, val) => {
    const el = document.querySelector(`${sel} .funil__pct`);
    if (el) el.textContent = val != null ? pct(val) : '';
  };

  setBar('[data-funil-impr]', f.impressoes); setNum('[data-funil-impr]', f.impressoes);
  setBar('[data-funil-clicks]', f.cliques);  setNum('[data-funil-clicks]', f.cliques);  setPct('[data-funil-clicks]', f.ctr);
  setBar('[data-funil-vendas]', f.vendas);   setNum('[data-funil-vendas]', f.vendas);   setPct('[data-funil-vendas]', f.conv_clique_venda);

  // Cascata
  const c = f.cascata || {};
  const setBadge = (sel, n, p) => {
    const el = document.querySelector(sel);
    if (el) el.textContent = `${n} (${p}%)`;
  };
  setBadge('[data-cascata-real]', c.REAL || 0, c.pct_REAL || 0);
  setBadge('[data-cascata-utm]',  c.UTM  || 0, c.pct_UTM  || 0);
  setBadge('[data-cascata-mgr]',  c.MGR  || 0, c.pct_MGR  || 0);
}

function renderFeed() {
  const container = document.querySelector('[data-feed]');
  if (!container) return;
  if (!state.feed.length) {
    container.innerHTML = `<div class="feed-empty">Aguardando primeira venda…</div>`;
    return;
  }
  container.innerHTML = state.feed.slice(0, 20).map(v => `
    <div class="feed__item">
      <span class="feed__nome">${escapeHtml(v.nome_publico || 'Anônimo')}${v.ddd ? `<small>(DDD ${v.ddd})</small>` : ''}</span>
      <span class="badge" data-src="${v.attribution_source}">${v.attribution_source}</span>
      <span class="feed__valor">${brl(v.transaction_value, { cents: false })}</span>
      <span class="feed__time">${ago(v.created_at)}</span>
    </div>
  `).join('');
}

function renderHealth() {
  const h = state.health;
  if (!h) return;
  const meta = h.meta_ads_freshness_min;
  const vendas = h.vendas_freshness_min;
  setText('[data-health-meta]',   `Meta Ads: ${freshness(meta)}`);
  setText('[data-health-vendas]', `Vendas: ${freshness(vendas)}`);
  const metaEl = document.querySelector('[data-health-meta]');
  if (metaEl) {
    metaEl.classList.remove('dash-footer__ok','dash-footer__warn','dash-footer__bad');
    if (meta == null) metaEl.classList.add('dash-footer__warn');
    else if (meta < 70) metaEl.classList.add('dash-footer__ok');
    else if (meta < 120) metaEl.classList.add('dash-footer__warn');
    else metaEl.classList.add('dash-footer__bad');
  }
}

function escapeHtml(s) {
  if (s == null) return '';
  return String(s)
    .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;').replaceAll("'", '&#39;');
}

// =========================================================
// 3. DATA FETCHERS
// =========================================================
async function loadKPIs() {
  state.kpis = await rpc('dashboard_kpis_realtime', { p_evento_slug: EVENTO_SLUG });
  state.lastUpdate = Date.now();
  renderHero(); renderKPIs(); renderHeader();
}

async function loadFunil() {
  state.funil = await rpc('dashboard_funil', { p_evento_slug: EVENTO_SLUG, p_dias: 30 });
  renderFunil();
}

async function loadTopAds() {
  state.topAds = await rpc('dashboard_top_ads', { p_evento_slug: EVENTO_SLUG, p_dias: 7, p_limit: 10 });
  renderTopAds();
}

async function loadDistribuicao() {
  state.distrib = await rpc('dashboard_distribuicao_lotes', { p_evento_slug: EVENTO_SLUG });
  renderDistribuicaoLotes();
}

async function loadHealth() {
  state.health = await rpc('dashboard_health', { p_evento_slug: EVENTO_SLUG });
  renderHealth();
}

async function loadTimeline() {
  const rows = await rpc('dashboard_vendas_timeline', { p_evento_slug: EVENTO_SLUG, p_horas: 72 });
  renderTimeline(rows);
}

async function loadFeedInicial() {
  state.feed = await from('vendas_realtime', {
    select: 'id, nome_publico, ddd, transaction_value, attribution_source, created_at, status',
    eq: { produto: 'Tudo Sobre SIBO' },
    order: 'created_at', asc: false, limit: 20
  });
  renderFeed();
}

// =========================================================
// 4. REALTIME — recebe nova venda, atualiza feed e re-fetch KPIs
// =========================================================
function onNovaVenda(row) {
  // Insere no topo do feed (se não duplicado)
  if (!state.feed.find(v => v.id === row.id)) {
    state.feed.unshift(row);
    if (state.feed.length > 20) state.feed.pop();
    renderFeed();
  }
  // Refetch KPIs imediatamente (cheap)
  loadKPIs().catch(() => { });
  loadDistribuicao().catch(() => { });
}

function onUpdateVenda(row) {
  const i = state.feed.findIndex(v => v.id === row.id);
  if (i !== -1) {
    state.feed[i] = row;
    renderFeed();
  }
  loadKPIs().catch(() => { });
}

function setLiveStatus(connected) {
  const live = document.querySelector('[data-live]');
  if (!live) return;
  if (connected) live.removeAttribute('data-disconnected');
  else live.setAttribute('data-disconnected', '');
}

// =========================================================
// 5. BOOT
// =========================================================
async function boot() {
  if (!(await gate())) return;

  // Fetch inicial em paralelo
  await Promise.allSettled([
    loadKPIs(),
    loadFunil(),
    loadTopAds(),
    loadDistribuicao(),
    loadHealth(),
    loadTimeline(),
    loadFeedInicial()
  ]);

  // Realtime subscribe
  subscribeVendas(
    onNovaVenda,
    onUpdateVenda,
    () => setLiveStatus(true),
    () => setLiveStatus(false)
  );

  // Polling
  startPolling(loadKPIs,         30_000, 'kpis');     // 30s
  startPolling(loadHealth,       60_000, 'health');   // 60s
  startPolling(loadTopAds,      300_000, 'topads');   // 5 min
  startPolling(loadFunil,       300_000, 'funil');    // 5 min
  startPolling(loadTimeline,    300_000, 'timeline'); // 5 min
  startPolling(loadDistribuicao, 60_000, 'distrib');  // 60s

  // Clock + countdown 1s
  setInterval(() => {
    setText('[data-clock]', timeBRT(new Date().toISOString()));
    setText('[data-updated]', `atualizado ${ago(state.lastUpdate)}`);
    renderCountdown();
  }, 1000);
}

document.addEventListener('DOMContentLoaded', boot);
