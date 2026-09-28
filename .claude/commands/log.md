# log

Record a real count, receipt, waste event or sale with its observed timezone timestamp. Sales snapshot current recipe usage and costs. Backdated sales use the recipe definition at entry, so reconcile historical mappings first.

```bash
node scripts/kitchen.mjs log count '{"item_id":"Salmon","quantity":5,"occurred_at":"2026-09-27T10:00:00+10:00","operator":"Your name"}' --json
```

Examples use fictional names. Read current records first. Never execute a sample write against real data unchanged. Report missing records and ambiguity. Never send messages or supplier orders.
