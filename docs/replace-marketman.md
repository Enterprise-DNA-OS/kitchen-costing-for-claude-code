# Replace MarketMan with your kitchen records

## Check what you can export

MarketMan's [current support centre](https://mealticket.my.site.com/helpcenter/s/?language=en_US) is linked from its pricing page. Its public help pages did not expose a stable export column specification during this build on 28 September 2026. Obtain your actual items, suppliers and recipes exports from your account or support. Keep original files and account identity. Do not assume the fixture column names match your account.

The [vendor API documentation](https://api-doc.marketman.com/) describes inventory items, recipes, counts and sales records. This build does not call it or require credentials. A saved API response needs a reviewed conversion to the CSV mapping below. MarketMan prices API access separately on some plans. Do not buy access just to try the fictional demo.

## One command after mapping

Create a folder containing UTF-8 CSV files and mapping.json. Convert spreadsheet sheets to CSV if needed. Copy fixtures/mapping.json as an example, then replace every header, account key, site and unit choice with the actual export values.

```bash
npm run kitchen -- import marketman ./my-export --dry-run --json
npm run kitchen -- import marketman ./my-export --json
```

Each mapping file has entity, file, key, columns and optional defaults. The source identifies the account and stays unchanged on repeats. A key must identify one source record permanently, never a row position. Each heading maps to an accepted field from help, or to null to explicitly ignore it while preserving it in provenance. Unknown headings fail. Defaults supply reviewed constants such as site_id, not guessed facts.

Files run in order: sites, suppliers, items, recipes, recipe_lines, orders, invoices, stocktakes, movements and sales. Relationships accept unique names or UUIDs. Duplicate item names across kitchens require UUIDs in the mapped data. Supplier pack cost must be divided by reviewed pack size before mapping unit_cost. Costs and sale prices exclude tax. Quantities must already be in the item's kg, l or each base unit. Timestamp fields need ISO timestamps with a timezone. Do not invent a missing receipt temperature, batch or operator.

The preview executes the full import inside a rolled-back transaction. A real import commits all files together. Repeating identical source keys skips them. Changed contents or mappings stop for review. The importer never silently updates an old observation. The original row and fingerprint remain in import_records. Back up before a reviewed correction.

## What maps

Supplier identity and address, site currencies, item units and par, recipe portions and yield, draft orders, invoice records, counts, receipts, waste and recorded sales can map through the documented entity fields. Sales generate ingredient usage from the recipe at import time. Importing historical sales therefore requires the matching historical recipe version or a deliberately bounded starting period.

## What does not carry over automatically

Supplier messaging, mobile workflows, invoice images, payment connections, point-of-sale credentials, nested preparation recipes and historical recipe versions are not imported automatically. Flatten nested recipes into reviewed ingredient quantities. Transfer history needs paired transfer entries or a reviewed migration. Placed orders need their state reviewed after importing as drafts. Evidence paths do not copy attachments. Keep the old archive.

## Reconcile before switching

Compare counts of suppliers, items and recipe lines, base-unit costs, recipe costs and site currencies. Compare opening stock, receipts, waste, sales quantities and closing stock for one identical period. Check every missing or ambiguous value. Keep both systems available through a full stocktake and ordering cycle. A one-command import is not a promise that unknown exports need no preparation. Enterprise DNA maps, tests and reconciles the move as part of a custom installation.

Fixtures contain invented sample records with illustrative headings. They are useful for testing this importer's contract only.
