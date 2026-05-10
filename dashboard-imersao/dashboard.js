// dashboard.js — orchestrator do dashboard real-time Karina/SIBO
import { sb, rpc, from, SUPABASE_URL } from '/dashboard-imersao/lib/supabase.js';
import { brl, num, pct, ago, dateBRT, timeBRT, freshness, countdown, delta } from '/dashboard-imersao/lib/format.js';
import { makeTimelineChart, COLORS } from '/dashboard-imersao/lib/charts.js';
import { subscribeVendas, startPolling } from '/dashboard-imersao/lib/realtime.js';

const EVENTO_SLUG = 'tudo-sobre-sibo';

// State
const state = {
  evento: null,
  kpis: null,
  funil: null,
  topAds: [],
  topAudiences: [],
  orderbumps: [],
  distrib: null,
  health: null,
  feed: [],
  heatmap: [],
  charts: { timeline: null },
  lastUpdate: Date.now(),
  // Período selecionado pra métricas de mídia (KPIs ads, funil, top ads/audiences)
  // Hero (vagas/receita acumulada) e Distribuição por lote NÃO seguem o período
  periodo: { dias: 30, label: 'últimos 30 dias' },
  // Ordenação client-side das tabelas
  sort: {
    topAds:       { key: 'spend_brl', dir: 'desc' },
    topAudiences: { key: 'spend_brl', dir: 'desc' }
  }
};

function applySort(rows, key, dir) {
  if (!rows || !rows.length || !key) return rows;
  const m = dir === 'asc' ? 1 : -1;
  return [...rows].sort((a, b) => {
    const va = a[key], vb = b[key];
    // Strings — case-insensitive
    if (typeof va === 'string' || typeof vb === 'string') {
      const sa = (va ?? '').toString().toLowerCase();
      const sb = (vb ?? '').toString().toLowerCase();
      return sa < sb ? -1*m : sa > sb ? 1*m : 0;
    }
    // Números — null/undefined sempre no fim independente da direção
    const na = va == null ? Infinity*m : Number(va);
    const nb = vb == null ? Infinity*m : Number(vb);
    return na < nb ? -1*m : na > nb ? 1*m : 0;
  });
}

function setSortIndicator(table, key, dir) {
  table.querySelectorAll('th.tbl__sortable').forEach(th => {
    th.classList.remove('tbl__sort-active','tbl__sort-asc','tbl__sort-desc');
    if (th.dataset.sortKey === key) {
      th.classList.add('tbl__sort-active', dir === 'asc' ? 'tbl__sort-asc' : 'tbl__sort-desc');
    }
  });
}

function bindSortableTables() {
  document.querySelectorAll('table[data-table]').forEach(table => {
    const which = table.dataset.table;
    table.querySelectorAll('th.tbl__sortable').forEach(th => {
      th.addEventListener('click', () => {
        const key = th.dataset.sortKey;
        const cur = state.sort[which];
        const newDir = (cur.key === key && cur.dir === 'desc') ? 'asc' : 'desc';
        state.sort[which] = { key, dir: newDir };
        setSortIndicator(table, key, newDir);
        if (which === 'topAds')       renderTopAds();
        if (which === 'topAudiences') renderTopAudiences();
      });
    });
  });
}

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
// 2. RENDER
// =========================================================
function setText(sel, value) {
  const el = document.querySelector(sel);
  if (el) { el.textContent = value; el.classList.remove('skeleton'); }
}
function escapeHtml(s) {
  if (s == null) return '';
  return String(s)
    .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;').replaceAll("'", '&#39;');
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
  setText('[data-hero-vendas]', `${k.vendas_count || 0}/${k.meta_capacidade || 300}`);
  setText('[data-hero-receita]', brl(k.receita_total_brl, { cents: false }));

  setText('[data-lote-pill]',
    `Lote ${lote.lote_numero || '—'} · ${brl(lote.lote_preco, { cents: false })} · ${lote.lote_vagas_restantes ?? '—'} vagas`);

  const fill = document.querySelector('[data-lote-fill]');
  if (fill) {
    const pctVal = lote.lote_percent ?? 0;
    fill.style.width = `${Math.max(2, pctVal)}%`;
    fill.style.background = lote.lote_cor || 'var(--lote-1)';
  }
  setText('[data-lote-meta-vendas]', `${lote.lote_vendas ?? 0}/${lote.lote_capacidade ?? 0}`);
  setText('[data-lote-meta-pct]', lote.lote_percent != null ? `${Math.round(lote.lote_percent)}%` : '—');
}

function renderCountdown() {
  if (!state.kpis?.data_evento) return;
  const c = countdown(state.kpis.data_evento);
  if (c.ended) { setText('[data-countdown]', 'EVENTO INICIADO'); return; }
  setText('[data-countdown]',
    `${c.d}d ${String(c.h).padStart(2,'0')}h ${String(c.m).padStart(2,'0')}m ${String(c.s).padStart(2,'0')}s`);
}

function setMetaBadge(card, value, target, lessIsBetter = false) {
  if (!card) return;
  card.removeAttribute('data-meta-ok');
  card.removeAttribute('data-meta-warn');
  card.removeAttribute('data-meta-bad');
  if (value == null || target == null) return;
  if (lessIsBetter) {
    if (value <= target) card.setAttribute('data-meta-ok', '');
    else if (value <= target * 1.2) card.setAttribute('data-meta-warn', '');
    else card.setAttribute('data-meta-bad', '');
  } else {
    if (value >= target) card.setAttribute('data-meta-ok', '');
    else if (value >= target * 0.8) card.setAttribute('data-meta-warn', '');
    else card.setAttribute('data-meta-bad', '');
  }
}

function renderKPIs() {
  const k = state.kpis;
  if (!k) return;

  // ====== Receita Ads (com sub geral) ======
  setText('[data-kpi-receita-val]', brl(k.receita_ads_brl));
  const dEl = document.querySelector('[data-kpi-receita-delta]');
  if (dEl && k.receita_ads_ontem_brl !== undefined) {
    const d = delta(+k.receita_ads_hoje_brl || 0, +k.receita_ads_ontem_brl || 0);
    dEl.textContent = `${d} vs ontem`;
    const numD = parseFloat(d);
    dEl.removeAttribute('data-positive'); dEl.removeAttribute('data-negative'); dEl.removeAttribute('data-neutral');
    if (Number.isNaN(numD) || numD === 0) dEl.setAttribute('data-neutral', '');
    else if (numD > 0) dEl.setAttribute('data-positive', '');
    else dEl.setAttribute('data-negative', '');
  }
  setText('[data-kpi-receita-sub]',
    `geral ${brl(k.receita_total_brl, { cents: false })} (ingr ${brl(k.receita_ingressos_brl, { cents: false })} + bumps ${brl(k.orderbump_receita_brl, { cents: false })})`);

  // ====== Investimento ======
  setText('[data-kpi-spend-val]', brl(k.ads_spend_brl));
  setText('[data-kpi-spend-sub]',
    `${num(k.ads_impressions, { compact: true })} imp · CTR ${pct(k.ads_ctr)} · CPM ${brl(k.ads_cpm_brl)}`);

  // ====== Vendas Ads (com sub geral) ======
  setText('[data-kpi-vendas-val]', num(k.vendas_ads_count));
  const vDel = document.querySelector('[data-kpi-vendas-delta]');
  if (vDel) {
    const d = delta(+k.vendas_ads_hoje || 0, +k.vendas_ads_ontem || 0);
    vDel.textContent = `hoje ${k.vendas_ads_hoje} · ontem ${k.vendas_ads_ontem} (${d})`;
    const numD = parseFloat(d);
    vDel.removeAttribute('data-positive'); vDel.removeAttribute('data-negative'); vDel.removeAttribute('data-neutral');
    if (Number.isNaN(numD) || numD === 0) vDel.setAttribute('data-neutral', '');
    else if (numD > 0) vDel.setAttribute('data-positive', '');
    else vDel.setAttribute('data-negative', '');
  }
  setText('[data-kpi-vendas-sub]',
    `geral ${num(k.vendas_count)} (hoje ${k.vendas_hoje} · ontem ${k.vendas_ontem})`);

  // ====== CPA (calculado sobre vendas Ads) ======
  setText('[data-kpi-cpa-val]', k.cpa_ads_brl != null ? brl(k.cpa_ads_brl) : '—');
  setText('[data-kpi-cpa-sub]', k.meta_cpa ? `meta ≤ ${brl(k.meta_cpa, { cents: false })}` : '');
  setMetaBadge(document.querySelector('[data-kpi-cpa-card]'), k.cpa_ads_brl, k.meta_cpa, true);

  // ====== ROAS (calculado sobre receita Ads) ======
  setText('[data-kpi-roas-val]', k.roas_ads != null ? Number(k.roas_ads).toFixed(2) : '—');
  setText('[data-kpi-roas-sub]', k.meta_roas ? `meta ≥ ${k.meta_roas}` : '');
  setMetaBadge(document.querySelector('[data-kpi-roas-card]'), k.roas_ads, k.meta_roas, false);

  // ====== AOV Ads (com sub geral) ======
  setText('[data-kpi-aov-val]', k.aov_ads_brl != null ? brl(k.aov_ads_brl) : '—');
  setText('[data-kpi-aov-sub]',
    k.aov_brl != null ? `geral ${brl(k.aov_brl)} · attach bumps ${pct(k.orderbump_attach_pct || 0)}` : '');

  // ====== Badge fonte (utm | pixel_fallback | sem_dados) ======
  const fonteEl = document.querySelector('[data-fonte-ads-hoje]');
  if (fonteEl && k.fonte_ads_hoje) {
    const labels = { utm: 'UTM real', pixel_fallback: 'fallback gerenciador', sem_dados: 'sem dados hoje' };
    fonteEl.querySelector('em').textContent = labels[k.fonte_ads_hoje] || k.fonte_ads_hoje;
    fonteEl.setAttribute('data-fonte', k.fonte_ads_hoje);
    fonteEl.hidden = false;
  }
}

function renderTimeline(rows) {
  if (!rows || !rows.length) return;
  // rows = [{ data, vendas, receita_brl, spend_brl }] ordenado por data
  const TZ = 'America/Sao_Paulo';
  const fmtData = (s) => {
    const d = new Date(s + 'T12:00:00Z');
    return d.toLocaleDateString('pt-BR', { timeZone: TZ, day: '2-digit', month: '2-digit' });
  };
  const labels = rows.map(r => fmtData(r.data));
  const vendas = rows.map(r => Number(r.vendas) || 0);
  const spend  = rows.map(r => Number(r.spend_brl) || 0);

  // Calcular meta diária dinâmica
  const k = state.kpis || {};
  const metaCap = Number(k.meta_capacidade) || 300;
  const acumuladas = Number(k.vendas_count) || 0;
  const dataEvento = k.data_evento ? new Date(k.data_evento) : null;
  const hoje = new Date(new Date().toLocaleString('en-US', { timeZone: TZ }));
  hoje.setHours(0,0,0,0);
  let meta = null;
  let diasFaltam = 0;
  if (dataEvento) {
    const dEv = new Date(dataEvento.toLocaleString('en-US', { timeZone: TZ }));
    dEv.setHours(0,0,0,0);
    diasFaltam = Math.max(1, Math.ceil((dEv - hoje) / 86400000) + 1);
    const faltam = Math.max(0, metaCap - acumuladas);
    meta = Math.ceil(faltam / diasFaltam);
  }

  // Achar idx de hoje no array
  const hojeStr = hoje.toLocaleDateString('en-CA', { timeZone: TZ }); // YYYY-MM-DD
  const hojeIdx = rows.findIndex(r => r.data === hojeStr);

  if (state.charts.timeline) state.charts.timeline.destroy();
  const canvas = document.querySelector('[data-chart-timeline]');
  if (canvas) state.charts.timeline = makeTimelineChart(canvas, { labels, vendas, spend, meta, hojeIdx });

  // Sub-header com meta visível
  setText('[data-meta-data-evento]', dataEvento ? dataEvento.toLocaleDateString('pt-BR', { timeZone: TZ, day:'2-digit', month:'2-digit' }) : '—');
  if (meta != null) {
    setText('[data-meta-diaria]', String(meta));
    setText('[data-meta-faltam]', String(Math.max(0, metaCap - acumuladas)));
    setText('[data-meta-dias]', String(diasFaltam));
    const resumoEl = document.querySelector('[data-meta-resumo]');
    if (resumoEl) resumoEl.hidden = false;
  }
}

function renderHeatmap() {
  const data = state.heatmap || [];
  const gridEl  = document.querySelector('[data-heatmap-grid]');
  const hoursEl = document.querySelector('[data-heatmap-hours]');
  const daysEl  = document.querySelector('[data-heatmap-days]');
  const topEl   = document.querySelector('[data-heatmap-top]');
  if (!gridEl) return;

  // Headers: horas (00..23) e dias (D, S, T, Q, Q, S, S — ISO domingo→sábado)
  if (hoursEl && !hoursEl.children.length) {
    hoursEl.innerHTML = Array.from({length: 24}, (_, h) =>
      `<span>${String(h).padStart(2,'0')}</span>`
    ).join('');
  }
  const diasLabels = ['DOM','SEG','TER','QUA','QUI','SEX','SAB'];
  if (daysEl && !daysEl.children.length) {
    daysEl.innerHTML = diasLabels.map(d => `<span>${d}</span>`).join('');
  }

  // Map (dia, hora) → vendas
  const m = new Map();
  let max = 0;
  for (const r of data) {
    const key = `${r.dia_semana}-${r.hora}`;
    const v = Number(r.vendas) || 0;
    m.set(key, v);
    if (v > max) max = v;
  }

  // Renderiza 7×24 células
  const cells = [];
  let topV = 0, topD = 0, topH = 0;
  for (let d = 0; d < 7; d++) {
    for (let h = 0; h < 24; h++) {
      const v = m.get(`${d}-${h}`) || 0;
      const opacity = max > 0 ? Math.min(1, 0.08 + 0.92 * (v / max)) : 0.08;
      const titleTxt = v > 0
        ? `${diasLabels[d]} ${String(h).padStart(2,'0')}h: ${v} venda${v>1?'s':''}`
        : `${diasLabels[d]} ${String(h).padStart(2,'0')}h: sem vendas`;
      cells.push(`<div class="heatmap__cell" ${v>0?`data-vendas="${v}"`:''}
        style="background: rgba(184,164,216,${opacity.toFixed(3)});"
        title="${titleTxt}"></div>`);
      if (v > topV) { topV = v; topD = d; topH = h; }
    }
  }
  gridEl.innerHTML = cells.join('');

  if (topEl) {
    topEl.textContent = topV > 0
      ? `pico: ${diasLabels[topD]} ${String(topH).padStart(2,'0')}h (${topV} vendas)`
      : 'sem vendas no período';
  }
}

function renderDistribuicaoLotes() {
  if (!state.distrib?.por_preco) return;
  const map = new Map(state.distrib.por_preco.map(r => [Number(r.preco), Number(r.qtd)]));
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
    const pctV = Math.min(100, Math.round(vendidas / l.cap * 100));
    return `
      <div class="lote-card" style="--lote-color: ${l.cor}">
        <div class="lote-card__num">Lote ${l.num}</div>
        <div class="lote-card__preco">${brl(l.preco, { cents: false })}</div>
        <div class="lote-card__bar"><div class="lote-card__fill" style="width: ${Math.max(2, pctV)}%"></div></div>
        <div class="lote-card__meta">
          <span>${vendidas}/${l.cap}</span>
          <span>${pctV}%</span>
        </div>
      </div>`;
  }).join('');
}

function renderOrderbumps() {
  const tbody = document.querySelector('[data-orderbumps-body]');
  if (!tbody) return;
  if (!state.orderbumps?.length) {
    tbody.innerHTML = `<tr><td colspan="5" class="tbl-empty">Sem vendas de orderbump ainda</td></tr>`;
    return;
  }
  const totalReceita = state.orderbumps.reduce((s, o) => s + Number(o.receita_brl || 0), 0);
  tbody.innerHTML = state.orderbumps.map(o => `
    <tr>
      <td>${escapeHtml(o.orderbump_produto || '—')}</td>
      <td class="tbl__num">${num(o.qtd)}</td>
      <td class="tbl__num">${brl(o.receita_brl)}</td>
      <td class="tbl__num">${pct(o.attach_pct)}</td>
      <td class="tbl__num">${brl(o.ticket_medio_brl)}</td>
    </tr>
  `).join('') + `
    <tr style="font-weight:600;border-top:1px solid var(--lilac-soft-30)">
      <td>Total</td>
      <td class="tbl__num">${num(state.orderbumps.reduce((s,o)=>s+Number(o.qtd||0),0))}</td>
      <td class="tbl__num">${brl(totalReceita)}</td>
      <td class="tbl__num">—</td>
      <td class="tbl__num">—</td>
    </tr>
  `;
}

function renderTopAds() {
  const tbody = document.querySelector('[data-topads-body]');
  if (!tbody) return;
  if (!state.topAds.length) {
    tbody.innerHTML = `
      <tr><td colspan="9" class="tbl-empty">
        Aguardando dados Meta Ads
        <small>Workflow [Karina al Assal] Meta Ads → Supabase rodando a cada 45min</small>
      </td></tr>`;
    return;
  }
  const { key, dir } = state.sort.topAds;
  const sorted = applySort(state.topAds, key, dir);
  tbody.innerHTML = sorted.map(a => {
    const roasClass = a.roas == null ? '' : (a.roas >= 3 ? 'data-good' : (a.roas < 1 ? 'data-bad' : ''));
    const thumb = a.thumbnail_url
      ? `<img src="${a.thumbnail_url}" class="tbl__thumb" loading="lazy" alt="">`
      : `<div class="tbl__thumb"></div>`;
    const fonteEmoji = a.fonte_atribuicao === 'utm' ? '✓' : (a.fonte_atribuicao === 'pixel_fallback' ? '◇' : '·');
    const vendasEfetivo = a.vendas_efetivo ?? a.purchases_meta ?? 0;
    const receitaEfetiva = a.receita_efetiva_brl ?? a.purchase_value_meta_brl ?? 0;
    return `
      <tr>
        <td>${thumb}</td>
        <td>${escapeHtml(a.ad_name || '—')}<br><small style="color:var(--cream-3)">${escapeHtml(a.adset_name || '')}</small></td>
        <td class="tbl__num">${brl(a.spend_brl)}</td>
        <td class="tbl__num">${num(a.impressions, { compact: true })}</td>
        <td class="tbl__num">${pct(a.ctr)}</td>
        <td class="tbl__num" title="${a.fonte_atribuicao || 'sem dados'}">${fonteEmoji} ${num(vendasEfetivo)}<br><small style="color:var(--cream-3)">utm ${a.vendas_ads_atribuidas || 0} · pixel ${a.purchases_meta || 0}</small></td>
        <td class="tbl__num">${brl(receitaEfetiva)}</td>
        <td class="tbl__num tbl__roas" ${roasClass}>${a.roas == null ? '—' : Number(a.roas).toFixed(2)}</td>
        <td class="tbl__num">${a.cpa_brl == null ? '—' : brl(a.cpa_brl)}</td>
      </tr>`;
  }).join('');
}

function renderTopAudiences() {
  const tbody = document.querySelector('[data-topaudiences-body]');
  if (!tbody) return;
  if (!state.topAudiences.length) {
    tbody.innerHTML = `<tr><td colspan="8" class="tbl-empty">Aguardando dados Meta Ads</td></tr>`;
    return;
  }
  const { key, dir } = state.sort.topAudiences;
  const sorted = applySort(state.topAudiences, key, dir);
  tbody.innerHTML = sorted.map(a => {
    const roasClass = a.roas == null ? '' : (a.roas >= 3 ? 'data-good' : (a.roas < 1 ? 'data-bad' : ''));
    const fonteEmoji = a.fonte_atribuicao === 'utm' ? '✓' : (a.fonte_atribuicao === 'pixel_fallback' ? '◇' : '·');
    const vendasEfetivo = a.vendas_efetivo ?? a.purchases_meta ?? 0;
    return `
      <tr>
        <td>${escapeHtml(a.adset_name || '—')}<br><small style="color:var(--cream-3)">${escapeHtml(a.campaign_name || '')}</small></td>
        <td class="tbl__num">${brl(a.spend_brl)}</td>
        <td class="tbl__num">${num(a.impressions, { compact: true })}</td>
        <td class="tbl__num">${pct(a.ctr)}</td>
        <td class="tbl__num">${brl(a.cpm_brl)}</td>
        <td class="tbl__num" title="${a.fonte_atribuicao || 'sem dados'}">${fonteEmoji} ${num(vendasEfetivo)}<br><small style="color:var(--cream-3)">utm ${a.vendas_ads_atribuidas || 0} · pixel ${a.purchases_meta || 0}</small></td>
        <td class="tbl__num tbl__roas" ${roasClass}>${a.roas == null ? '—' : Number(a.roas).toFixed(2)}</td>
        <td class="tbl__num">${a.cpa_brl == null ? '—' : brl(a.cpa_brl)}</td>
      </tr>`;
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
  setBar('[data-funil-landing]', f.landing_views); setNum('[data-funil-landing]', f.landing_views); setPct('[data-funil-landing]', f.conv_clique_landing);
  setBar('[data-funil-vendas]', f.vendas);   setNum('[data-funil-vendas]', f.vendas);   setPct('[data-funil-vendas]', f.conv_landing_venda);

  // Métricas extras (CTR, CPM, CPC, conversão página)
  setText('[data-funil-ctr]', pct(f.ctr));
  setText('[data-funil-cpm]', brl(f.cpm_brl));
  setText('[data-funil-cpc]', brl(f.cpc_brl));
  setText('[data-funil-conv-pagina]', pct(f.conv_clique_venda));

  // Cascata
  const c = f.cascata || {};
  document.querySelector('[data-cascata-real]').textContent = `${c.REAL || 0} (${c.pct_REAL || 0}%)`;
  document.querySelector('[data-cascata-utm]').textContent  = `${c.UTM  || 0} (${c.pct_UTM  || 0}%)`;
  document.querySelector('[data-cascata-mgr]').textContent  = `${c.MGR  || 0} (${c.pct_MGR  || 0}%)`;
}

function renderFeed() {
  const container = document.querySelector('[data-feed]');
  if (!container) return;
  if (!state.feed.length) {
    container.innerHTML = `<div class="feed-empty">Aguardando primeira venda…</div>`;
    return;
  }
  container.innerHTML = state.feed.slice(0, 25).map(v => `
    <div class="feed__item">
      <span class="feed__nome">${escapeHtml(v.nome_publico || 'Anônimo')}${v.ddd ? `<small>(DDD ${v.ddd})</small>` : ''}</span>
      <span class="feed__produto" title="${escapeHtml(v.produto || '')}">${escapeHtml(v.produto_label || (v.produto === 'Tudo Sobre SIBO' ? 'Ingresso' : '—'))}</span>
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

// =========================================================
// 3. DATA FETCHERS
// =========================================================
async function loadKPIs() {
  state.kpis = await rpc('dashboard_kpis_realtime', {
    p_evento_slug: EVENTO_SLUG,
    p_dias: state.periodo.dias
  });
  state.lastUpdate = Date.now();
  renderHero(); renderKPIs(); renderHeader();
}
async function loadFunil() {
  state.funil = await rpc('dashboard_funil', {
    p_evento_slug: EVENTO_SLUG,
    p_dias: state.periodo.dias
  });
  renderFunil();
}
async function loadTopAds() {
  state.topAds = await rpc('dashboard_top_ads', {
    p_evento_slug: EVENTO_SLUG,
    p_dias: state.periodo.dias,
    p_limit: 10
  });
  renderTopAds();
}
async function loadTopAudiences() {
  state.topAudiences = await rpc('dashboard_top_audiences', {
    p_evento_slug: EVENTO_SLUG,
    p_dias: state.periodo.dias,
    p_limit: 10
  });
  renderTopAudiences();
}
async function loadOrderbumps() {
  state.orderbumps = await rpc('dashboard_orderbumps', { p_evento_slug: EVENTO_SLUG });
  renderOrderbumps();
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
  const rows = await rpc('dashboard_vendas_timeline_diaria', {
    p_evento_slug: EVENTO_SLUG,
    p_dias_passado: state.periodo.dias
  });
  renderTimeline(rows);
}
async function loadHeatmap() {
  state.heatmap = await rpc('dashboard_heatmap_horarios', {
    p_evento_slug: EVENTO_SLUG,
    p_dias: state.periodo.dias
  });
  renderHeatmap();
}
async function loadFeedInicial() {
  state.feed = await from('vendas_realtime', {
    select: 'id, nome_publico, ddd, transaction_value, attribution_source, created_at, status, produto, produto_label',
    order: 'created_at', asc: false, limit: 25
  });
  renderFeed();
}

// =========================================================
// 4. REALTIME
// =========================================================
function onNovaVenda(row) {
  if (!state.feed.find(v => v.id === row.id)) {
    state.feed.unshift(row);
    if (state.feed.length > 25) state.feed.pop();
    renderFeed();
  }
  loadKPIs().catch(() => {});
  loadDistribuicao().catch(() => {});
  loadOrderbumps().catch(() => {});
}
function onUpdateVenda(row) {
  const i = state.feed.findIndex(v => v.id === row.id);
  if (i !== -1) { state.feed[i] = row; renderFeed(); }
  loadKPIs().catch(() => {});
}
function setLiveStatus(connected) {
  const live = document.querySelector('[data-live]');
  if (!live) return;
  if (connected) live.removeAttribute('data-disconnected');
  else live.setAttribute('data-disconnected', '');
}

// =========================================================
// 4.5 SELETOR DE PERÍODO
// =========================================================
function setPeriodo(dias, label) {
  state.periodo = { dias: Number(dias), label: label || `últimos ${dias} dias` };
  setText('[data-periodo-resumo]', state.periodo.label);
  setText('[data-funil-periodo]', `${state.periodo.dias}d`);
  // Marcar chip ativo
  document.querySelectorAll('.periodo__chip').forEach(c => {
    const isActive = c.dataset.periodo === String(dias) && !c.classList.contains('periodo__chip--custom');
    c.classList.toggle('is-active', isActive);
    c.setAttribute('aria-selected', isActive ? 'true' : 'false');
  });
  // Re-carregar só o que depende do período
  Promise.allSettled([loadKPIs(), loadFunil(), loadTopAds(), loadTopAudiences(), loadTimeline(), loadHeatmap()]);
}

function bindPeriodoChips() {
  const customWrap = document.querySelector('[data-periodo-custom]');
  document.querySelectorAll('.periodo__chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const v = chip.dataset.periodo;
      if (v === 'custom') {
        if (customWrap) customWrap.hidden = !customWrap.hidden;
        document.querySelectorAll('.periodo__chip').forEach(c => c.classList.remove('is-active'));
        chip.classList.add('is-active');
        return;
      }
      if (customWrap) customWrap.hidden = true;
      const labels = { 1: 'hoje', 2: 'ontem + hoje', 7: 'últimos 7 dias', 30: 'últimos 30 dias',
                       90: 'últimos 90 dias', 365: 'desde o início' };
      setPeriodo(v, labels[v] || `últimos ${v} dias`);
    });
  });
  const apply = document.querySelector('[data-periodo-apply]');
  if (apply) {
    apply.addEventListener('click', () => {
      const de  = document.querySelector('[data-periodo-de]')?.value;
      const ate = document.querySelector('[data-periodo-ate]')?.value;
      if (!de || !ate) return;
      const d1 = new Date(de), d2 = new Date(ate);
      const diff = Math.max(1, Math.ceil((d2 - d1) / 86400000) + 1);
      // Backend aceita só p_dias contado para trás de hoje. Se data de início ≠ hoje-X, aproximamos
      // pelo diff em dias até hoje
      const ateAteHoje = Math.max(1, Math.ceil((Date.now() - d1.getTime()) / 86400000) + 1);
      setPeriodo(ateAteHoje, `${de} → ${ate} (${diff}d)`);
    });
  }
}

// =========================================================
// 5. BOOT
// =========================================================
async function boot() {
  if (!(await gate())) return;

  bindPeriodoChips();
  bindSortableTables();

  await Promise.allSettled([
    loadKPIs(),
    loadFunil(),
    loadTopAds(),
    loadTopAudiences(),
    loadOrderbumps(),
    loadDistribuicao(),
    loadHealth(),
    loadTimeline(),
    loadHeatmap(),
    loadFeedInicial()
  ]);

  subscribeVendas(
    onNovaVenda,
    onUpdateVenda,
    () => setLiveStatus(true),
    () => setLiveStatus(false)
  );

  startPolling(loadKPIs,         30_000, 'kpis');
  startPolling(loadHealth,       60_000, 'health');
  startPolling(loadTopAds,      300_000, 'topads');
  startPolling(loadTopAudiences,300_000, 'topaud');
  startPolling(loadOrderbumps,   60_000, 'orderbumps');
  startPolling(loadFunil,       300_000, 'funil');
  startPolling(loadTimeline,    300_000, 'timeline');
  startPolling(loadHeatmap,     300_000, 'heatmap');
  startPolling(loadDistribuicao, 60_000, 'distrib');

  setInterval(() => {
    setText('[data-clock]', timeBRT(new Date().toISOString()));
    setText('[data-updated]', `atualizado ${ago(state.lastUpdate)}`);
    renderCountdown();
  }, 1000);
}

document.addEventListener('DOMContentLoaded', boot);
