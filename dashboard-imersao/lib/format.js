// format.js — helpers de formatação BRT, BRL, percent, abrev
const TZ = 'America/Sao_Paulo';

export const brl = (v, opts = {}) => {
  if (v === null || v === undefined || Number.isNaN(+v)) return '—';
  const n = +v;
  if (opts.compact && Math.abs(n) >= 1000) {
    return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact', maximumFractionDigits: 1 });
  }
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: opts.cents === false ? 0 : 2, maximumFractionDigits: opts.cents === false ? 0 : 2 });
};

export const num = (v, opts = {}) => {
  if (v === null || v === undefined) return '—';
  const n = +v;
  if (opts.compact && Math.abs(n) >= 1000) {
    return n.toLocaleString('pt-BR', { notation: 'compact', maximumFractionDigits: 1 });
  }
  return n.toLocaleString('pt-BR', { maximumFractionDigits: opts.decimals ?? 0 });
};

export const pct = (v, decimals = 1) => {
  if (v === null || v === undefined) return '—';
  return `${(+v).toLocaleString('pt-BR', { maximumFractionDigits: decimals, minimumFractionDigits: decimals })}%`;
};

// "há 3 min", "há 2h", "há 1d"
export const ago = (iso) => {
  if (!iso) return '—';
  const sec = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (sec < 60) return `há ${Math.floor(sec)}s`;
  if (sec < 3600) return `há ${Math.floor(sec / 60)} min`;
  if (sec < 86400) return `há ${Math.floor(sec / 3600)}h`;
  return `há ${Math.floor(sec / 86400)}d`;
};

// "10/05 14:32" — sempre BRT
export const dateBRT = (iso) => {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('pt-BR', {
    timeZone: TZ, day: '2-digit', month: '2-digit',
    hour: '2-digit', minute: '2-digit'
  }).replace(',', '');
};

// "14:32:18 BRT" — só hora
export const timeBRT = (iso) => {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('pt-BR', {
    timeZone: TZ, hour: '2-digit', minute: '2-digit', second: '2-digit'
  });
};

// "25/05" — só dia/mês
export const dateOnly = (iso) => {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('pt-BR', { timeZone: TZ, day: '2-digit', month: '2-digit' });
};

// Diff em minutos formatado: 47 → "47 min", 90 → "1h30", 1440 → "24h"
export const freshness = (mins) => {
  if (mins === null || mins === undefined) return '—';
  const m = Math.floor(+mins);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60), rem = m % 60;
  if (h < 24) return rem ? `${h}h${rem}` : `${h}h`;
  return `${Math.floor(h / 24)}d`;
};

// Contagem regressiva: { d, h, m, s, totalMs, ended }
export const countdown = (targetIso) => {
  const ms = new Date(targetIso).getTime() - Date.now();
  if (ms <= 0) return { d: 0, h: 0, m: 0, s: 0, totalMs: 0, ended: true };
  return {
    d: Math.floor(ms / 86400000),
    h: Math.floor((ms % 86400000) / 3600000),
    m: Math.floor((ms % 3600000) / 60000),
    s: Math.floor((ms % 60000) / 1000),
    totalMs: ms,
    ended: false
  };
};

// Delta percentual com sinal: hoje=10, ontem=8 → +25.0%
export const delta = (atual, anterior) => {
  if (!anterior || anterior === 0) return atual > 0 ? '+∞' : '0%';
  const d = ((atual - anterior) / anterior) * 100;
  const sign = d > 0 ? '+' : '';
  return `${sign}${d.toFixed(1)}%`;
};

export const TZ_BRT = TZ;
