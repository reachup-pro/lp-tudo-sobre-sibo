// realtime.js — subscribe vendas_realtime + reconnect + visibilitychange
// Padrão de revalidação reaproveitado de script.js da LP (linhas 425-428)

import { sb } from '/dashboard-reset-intestinal/lib/supabase.js';

const CHANNEL_NAME = 'dashboard-vendas-realtime';
const TABLE = 'vendas_realtime';

export function subscribeVendas(onInsert, onUpdate, onConnect, onDisconnect) {
  const channel = sb.channel(CHANNEL_NAME)
    .on('postgres_changes',
      { event: 'INSERT', schema: 'public', table: TABLE },
      (payload) => { try { onInsert?.(payload.new); } catch (e) { console.error(e); } })
    .on('postgres_changes',
      { event: 'UPDATE', schema: 'public', table: TABLE },
      (payload) => { try { onUpdate?.(payload.new, payload.old); } catch (e) { console.error(e); } })
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') onConnect?.();
      else if (status === 'CLOSED' || status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') onDisconnect?.(status);
    });

  // Quando aba volta a foco, força reconnect (mesmo padrão do script.js:425-428 da LP)
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && channel.state !== 'joined') {
      channel.unsubscribe().then(() => channel.subscribe());
    }
  });

  // Network online/offline
  window.addEventListener('online', () => {
    if (channel.state !== 'joined') {
      channel.unsubscribe().then(() => channel.subscribe());
    }
  });
  window.addEventListener('offline', () => onDisconnect?.('offline'));

  return {
    unsubscribe: () => channel.unsubscribe(),
    state: () => channel.state,
    channel
  };
}

// Polling com pausa quando aba some, retomada com refresh forçado quando volta
export function startPolling(fn, intervalMs, label = 'poll', immediate = true) {
  let id = null;
  let lastRun = 0;

  const run = async () => {
    if (document.hidden) return;
    lastRun = Date.now();
    try { await fn(); } catch (e) { console.warn(`[${label}]`, e.message); }
  };

  const start = (runNow) => { if (!id) { if (runNow) run(); id = setInterval(run, intervalMs); } };
  const stop  = () => { if (id) { clearInterval(id); id = null; } };

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stop();
    else { run(); start(false); }   // refresh imediato + retoma intervalo
  });

  start(immediate);
  return { stop, runNow: run };
}
