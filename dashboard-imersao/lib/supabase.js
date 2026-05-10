// supabase.js — init client + helpers de RPC
const SB_URL = 'https://viflrlxwvziimdbbcgtf.supabase.co';
const SB_KEY = 'sb_publishable_zEi5XvniJ8UWi4w2ozK1YA_f-GgrOl9';

// supabase-js carregado via CDN UMD em <script>, expõe window.supabase.createClient
export const sb = window.supabase.createClient(SB_URL, SB_KEY, {
  realtime: { params: { eventsPerSecond: 10 } },
  auth: { persistSession: false }
});

// Helper: chama RPC e levanta erro com contexto
export async function rpc(name, args = {}) {
  const { data, error } = await sb.rpc(name, args);
  if (error) {
    console.error(`[rpc:${name}]`, error);
    throw new Error(`RPC ${name}: ${error.message}`);
  }
  return data;
}

// Helper: query simples em tabela
export async function from(table, opts = {}) {
  let q = sb.from(table).select(opts.select || '*');
  if (opts.eq) Object.entries(opts.eq).forEach(([k, v]) => { q = q.eq(k, v); });
  if (opts.order) q = q.order(opts.order, { ascending: opts.asc ?? false });
  if (opts.limit) q = q.limit(opts.limit);
  const { data, error } = await q;
  if (error) throw new Error(`Query ${table}: ${error.message}`);
  return data;
}

export const SUPABASE_URL = SB_URL;
