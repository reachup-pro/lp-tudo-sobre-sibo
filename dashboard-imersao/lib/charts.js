// charts.js — factories Chart.js (line, bar, doughnut, sparkline)
// Identidade noir+lilás reaproveitada da LP

const C = {
  ink0: '#08060d',
  ink1: '#100b1a',
  ink2: '#1b1428',
  ink3: '#261c36',
  lilac1: '#b8a4d8',
  lilac2: '#9d86c1',
  lilacSoft30: 'rgba(184,164,216,0.30)',
  lilacSoft15: 'rgba(184,164,216,0.15)',
  lilacSoft08: 'rgba(184,164,216,0.08)',
  cream1: '#f0ebe0',
  cream2: '#b8b0a4',
  cream3: '#6f6a62',
  rouge: '#c9242f',
  lote1: '#22c55e',
  lote2: '#eab308',
  lote3: '#f97316',
  lote4: '#ef4444',
  fontBody: 'Geist, Inter, system-ui, sans-serif',
  fontMono: 'Geist Mono, JetBrains Mono, monospace'
};

// Defaults globais Chart.js
function applyDefaults() {
  if (!window.Chart) return;
  const Ch = window.Chart;
  Ch.defaults.color = C.cream2;
  Ch.defaults.font.family = C.fontBody;
  Ch.defaults.font.size = 11;
  Ch.defaults.borderColor = C.lilacSoft15;
  Ch.defaults.plugins.legend.labels.color = C.cream2;
  Ch.defaults.plugins.tooltip.backgroundColor = C.ink2;
  Ch.defaults.plugins.tooltip.titleColor = C.cream1;
  Ch.defaults.plugins.tooltip.bodyColor = C.cream1;
  Ch.defaults.plugins.tooltip.borderColor = C.lilacSoft30;
  Ch.defaults.plugins.tooltip.borderWidth = 1;
  Ch.defaults.plugins.tooltip.padding = 10;
  Ch.defaults.plugins.tooltip.cornerRadius = 8;
}
applyDefaults();

const baseGrid = { color: C.lilacSoft08, drawBorder: false };
const baseTicks = { color: C.cream3, font: { family: C.fontMono, size: 10 } };

// Timeline 72h: vendas (barra lilás) + investimento (linha rouge)
export function makeTimelineChart(canvas, { labels, vendas, spend }) {
  return new window.Chart(canvas, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          type: 'bar',
          label: 'Vendas',
          data: vendas,
          backgroundColor: C.lilac2,
          borderColor: C.lilac1,
          borderWidth: 1,
          borderRadius: 3,
          yAxisID: 'y'
        },
        {
          type: 'line',
          label: 'Investimento (R$)',
          data: spend,
          borderColor: C.rouge,
          backgroundColor: 'transparent',
          borderWidth: 1.5,
          tension: 0.25,
          pointRadius: 0,
          pointHoverRadius: 4,
          pointHoverBackgroundColor: C.rouge,
          yAxisID: 'y1'
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 400 },
      interaction: { mode: 'index', intersect: false },
      plugins: { legend: { display: true, position: 'top', align: 'end' } },
      scales: {
        x: {
          grid: baseGrid,
          ticks: { ...baseTicks, maxRotation: 0, autoSkip: true, maxTicksLimit: 8 }
        },
        y: {
          beginAtZero: true,
          grid: baseGrid,
          ticks: { ...baseTicks, precision: 0 },
          title: { display: true, text: 'Vendas', color: C.lilac1, font: { size: 10 } }
        },
        y1: {
          beginAtZero: true,
          position: 'right',
          grid: { display: false },
          ticks: { ...baseTicks, color: C.rouge, callback: v => 'R$' + v.toLocaleString('pt-BR') },
          title: { display: true, text: 'Spend', color: C.rouge, font: { size: 10 } }
        }
      }
    }
  });
}

// Sparkline mini (em KPI cards)
export function makeSparkline(canvas, data, color = C.lilac1) {
  return new window.Chart(canvas, {
    type: 'line',
    data: {
      labels: data.map((_, i) => i),
      datasets: [{
        data,
        borderColor: color,
        backgroundColor: 'rgba(184,164,216,0.08)',
        fill: true,
        borderWidth: 1.2,
        pointRadius: 0,
        tension: 0.3
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { enabled: false } },
      scales: { x: { display: false }, y: { display: false } },
      animation: { duration: 0 }
    }
  });
}

// Distribuição por lote (barras horizontais coloridas)
export function makeLotesChart(canvas, { labels, vendidas, capacidades, cores }) {
  return new window.Chart(canvas, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        { label: 'Vendidas',  data: vendidas,    backgroundColor: cores, borderRadius: 4, stack: 'a' },
        { label: 'Restantes', data: capacidades.map((c, i) => Math.max(0, c - vendidas[i])),
          backgroundColor: 'rgba(184,164,216,0.10)', borderRadius: 4, stack: 'a' }
      ]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: true, position: 'top', align: 'end' } },
      scales: {
        x: { stacked: true, grid: baseGrid, ticks: baseTicks, beginAtZero: true },
        y: { stacked: true, grid: { display: false }, ticks: { ...baseTicks, color: C.cream1 } }
      }
    }
  });
}

export const COLORS = C;
