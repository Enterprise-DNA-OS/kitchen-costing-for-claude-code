# update

Read the current record, then update only supplied fields. Observations are append-only. Orders progress draft to placed to closed. Recording placed means a person already placed it outside this tool. Invoice status records external facts and never moves money.

```bash
node scripts/kitchen.mjs update recipes "Salmon plate" '{"target_pct":32}' --json
```

Examples use fictional names. Read current records first. Never execute a sample write against real data unchanged. Report missing records and ambiguity. Never send messages or supplier orders.
