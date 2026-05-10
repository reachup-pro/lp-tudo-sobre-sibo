# Workflows n8n — Dashboard Karina (CONCLUÍDO 2026-05-10)

> Status: ✅ Todos os 3 workflows ativos e validados.

## Workflows ativos

| ID | Nome | Trigger | Status |
|---|---|---|---|
| `ds0sawunzJySaO8H` | `[Karina al Assal] Backfill Meta Ads 90d` | Webhook (manual) | ✅ ativo |
| `mkfrSNo0I7BbhwGs` | `[Karina al Assal] Meta Ads → Supabase (45min)` | Schedule cron 45min + webhook teste | ✅ ativo |
| `jjAteKFM2BjOe4ZD` | `[Karina al Assal] Health Check Dashboard` | Schedule `0 12 * * *` UTC (09:00 BRT) + webhook teste | ✅ ativo |

Todos com `errorWorkflow: q81AmR4fBS1IfWgN`.

## Webhooks de teste manual

```bash
# Backfill (re-popula 30d de insights — só se precisar reset)
curl -X POST https://n8n.reachup.pro/webhook/karina-backfill-meta-90d -d '{}'

# Cron (força sync imediato sem esperar 45min)
curl -X POST https://n8n.reachup.pro/webhook/karina-cron-meta-test -d '{}'

# Health Check (força post Discord agora)
curl -X POST https://n8n.reachup.pro/webhook/karina-health-test -d '{}'
```

## Dashboard

- URL: `https://lp.karinaalassal.com.br/dashboard-imersao/?k=2f61d7f63ac5cc6f5556c64edc7d4b8f`
- Token: `2f61d7f63ac5cc6f5556c64edc7d4b8f` (válido até 2026-07-09)
- Discord canal Karina: `1495200238074462259` (recebe Health Check diário 09:00 BRT)

## Bugs corrigidos nesta sessão (vale anotar)

1. **Backfill estava como `scheduleTrigger 2min`** (rodando 30×/h com erro). Trocado pra Webhook trigger (manual).
2. **Conexão `Upsert Ads → Get Insights 30d`** apontava pra node inexistente (era `Get Insights 90d`). Corrigido.
3. **Graph API "Service temporarily unavailable" em `last_90d`** — query muito pesada (3M+ rows). Trocado pra `last_30d` (cobre evento + dá pro cron 45min manter continuidade).
4. **`Normalize Insights` retornava `[{json: {insights: [...]}}]` mas precisava de N items pro Postgres node** — na verdade o queryReplacement esperava `$json.insights`, mantive single-item e blindei `findAction` contra NaN com `Number.isFinite`.
5. **`Post Discord` falhou com "Credentials not found"** — usei `httpHeaderAuth` errado, padrão certo é `nodeCredentialType: discordBotApi` + `credentials.discordBotApi.id`.

## IP interno do n8n (lição)

O CLAUDE.md em `_n8n-reach/` ainda cita `172.18.0.6:5678`, mas após Docker recreate isso virou Redis. **Sempre usar `https://n8n.reachup.pro/api/v1/...` via Caddy** (HTTPS, estável). Para descobrir IP atual: `docker network inspect n8n-setup_default`.
