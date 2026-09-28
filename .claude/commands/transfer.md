# transfer

Read both item records and confirm they represent the same ingredient and base unit. Move counted stock between sites atomically. Different currencies are rejected. Never infer pack or unit conversions.

```bash
node scripts/kitchen.mjs transfer '{"from":"SOURCE-ITEM-UUID","to":"DESTINATION-ITEM-UUID","quantity":2,"occurred_at":"2026-09-27T10:00:00+10:00","operator":"Your name"}' --json
```

Examples use fictional names. Read current records first. Never execute a sample write against real data unchanged. Report missing records and ambiguity. Never send messages or supplier orders.
