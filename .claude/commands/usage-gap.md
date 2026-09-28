# usage-gap

Compare the latest two counts for each ingredient. Actual usage is opening plus accepted receipts and net transfers minus closing. Subtract recipe usage and waste to get unexplained usage. Each ingredient can have different count dates.

```bash
node scripts/kitchen.mjs usage-gap --json
```

Examples use fictional names. Read current records first. Never execute a sample write against real data unchanged. Report missing records and ambiguity. Never send messages or supplier orders.
