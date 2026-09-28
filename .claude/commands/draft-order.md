# draft-order

Read a supplier and write an internal order proposal into drafts. Check freshness, units and open orders. A person reviews and sends it.

```bash
node scripts/kitchen.mjs draft-order "Coastal Produce" --json
```

Examples use fictional names. Read current records first. Never execute a sample write against real data unchanged. Report missing records and ambiguity. Never send messages or supplier orders.
