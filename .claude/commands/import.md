# import

Read docs/replace-marketman.md. Inspect a real export, write an explicit column map and stable source key, run the preview, reconcile and import the same folder.

```bash
node scripts/kitchen.mjs import marketman ./my-export --dry-run --json
```

Examples use fictional names. Read current records first. Never execute a sample write against real data unchanged. Report missing records and ambiguity. Never send messages or supplier orders.
