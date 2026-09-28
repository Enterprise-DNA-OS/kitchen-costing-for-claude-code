# add

Read help, then add the entity using only operator-supplied facts. Relationships accept an unambiguous name or UUID. All costs and quantities must use the documented base units.

```bash
node scripts/kitchen.mjs add suppliers '{"name":"Example supplier","address":"Operator supplied address"}' --json
```

Examples use fictional names. Read current records first. Never execute a sample write against real data unchanged. Report missing records and ambiguity. Never send messages or supplier orders.
