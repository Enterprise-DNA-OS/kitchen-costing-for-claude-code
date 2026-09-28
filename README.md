# Kitchen Costing for Claude Code

Recipe costs, ingredient stock, purchasing and waste in a database you own. Built by Enterprise DNA. MIT licence.

| Do it yourself | We customise it | We run it for you |
| --- | --- | --- |
| Free source. Follow the quick start. | Your recipes, supplier units, MarketMan mapping, reports, phone entry or different stack. | Installed, connected and operated through Omni by Enterprise DNA. One setup fee, then a retainer. |

[Talk to Sam](https://enterprisedna.co/omni/book?offer=replace-software&utm_campaign=marketman&utm_medium=readme) · [Instead of MarketMan](https://enterprisedna.co/omni/instead-of/marketman?utm_source=github&utm_medium=readme&utm_campaign=marketman)

Works with Claude Code, Codex, OpenCode or Cursor. Start with AGENTS.md and CLAUDE.md.

## Quick start

```bash
git clone https://github.com/Enterprise-DNA-OS/kitchen-costing-for-claude-code.git
cd kitchen-costing-for-claude-code
npm install
npm run demo
npm run kitchen -- weekly-review
npm run view
npm run docs
```

Node 20 or newer. PGlite runs locally without a database installation. DATABASE_URL selects Postgres. Both use the same migrations with no extensions. The demo has two fictional Australian kitchens, a salmon dish above target, unexplained ingredient usage, stale counts, an overdue order, a held delivery and an overdue supplier invoice. Seed is repeat-safe and does not overwrite existing records.

For real records choose a fresh DATA_DIR or empty database, run npm run migrate and do not seed. Add the sites and suppliers, then import mapped records. Source is free. Hosting, agent subscriptions, capture devices and operational support are separate.

## The weekly kitchen desk

- `/menu-costing`: Review food cost per portion, target percentage and contribution before labour and overhead. Recipes without ingredients have unknown cost.
- `/stock`: Read counted stock plus accepted movements minus snapshotted recipe consumption. Missing counts remain unknown.
- `/par-order`: Review shortages in purchase packs. Recount stale or missing stock before placing an order. Check open orders separately to avoid ordering twice.
- `/usage-gap`: Compare the latest two counts for each ingredient. Actual usage is opening plus accepted receipts and net transfers minus closing. Subtract recipe usage and waste to get unexplained usage. Each ingredient can have different count dates.
- `/price-watch`: Compare the current base-unit cost against the previous accepted receipt cost. A missing previous receipt means the change is unknown.
- `/orders`: Review draft and placed orders, accepted receipts and outstanding quantities. Held deliveries do not reduce what is owed.
- `/invoices`: Review unpaid and disputed invoices by site, currency and due date. This is a register, not a payment tool.
- `/waste-review`: Review waste reason, operator, quantity and recorded cost by site.
- `/supplier-review`: Review supplier addresses, review dates and held or rejected receipts. Review dates are business policy.
- `/food-cost`: Read the last seven days of recorded sales and snapshotted theoretical cost per site. This is not actual accounting COGS or profit.
- `/attention`: Review stale counts, uncosted or over-target recipes, overdue orders and unsettled invoices. Seven days is the demo counting policy.
- `/weekly-review`: Run attention, menu-costing, usage-gap, par-order, food-cost and compliance. Write a Monday plan with kitchen, issue, evidence and owner. Do not sum different currencies or different count periods.

The remaining commands read registers, record counts and sales, receive stock, transfer between sites, check receiving records, draft supplier documents and import or export your data. The complete routing list is in CLAUDE.md. Every CLI route accepts --json. Relationships support full UUIDs, UUID prefixes and case-insensitive name fragments. Ambiguous matches list candidates and exit 1.

## Quantity and costing contract

- Items use kg, l or each. Pack size is the number of those base units in one supplier pack. An order stores its pack size so later changes cannot rewrite the order quantity.
- Ingredient net quantity is for the recipe batch. Gross usage is net quantity divided by yield fraction. Divide batch cost by portions to get cost per portion. Prices and costs exclude tax. Contribution excludes labour, overhead and fees.
- Sales snapshot each ingredient quantity and cost at entry. Editing a recipe cannot change those saved facts. A backdated sale uses the recipe at entry, so historical imports need a recipe review first.
- Stock is the latest count plus accepted receipts and transfers, minus waste and recorded recipe usage after that count. Counts include activity through their own timestamp. A missing count is unknown. Missing sales mean estimated stock is overstated.
- Actual usage between the latest two counts is opening stock plus receipts and net transfers minus closing stock. Unexplained usage subtracts theoretical usage and recorded waste. Each ingredient has its own interval. The value uses current ingredient cost, not accounting inventory valuation.
- Par proposals round shortages up to whole packs. Check open orders before ordering. The seven-day stale-count threshold and food cost targets are business policies, not legislation.
- Invoice status and order status record external actions. No money moves and no order sends. Transfers require matching currencies and units, and the operator confirms ingredient equivalence.

## Documents and views

npm run docs renders recipe costing cards, stocktake sheets, draft purchase orders, waste registers and receiving registers as branded HTML. npm run view writes the weekly kitchen, stock and supplier views. Change business name, logo path and colours in brand.json. Draft supplier discussions and order proposals stay in drafts. A person checks and sends them.

The [compliance checks](docs/compliance.md) cover selected Australian receiving and supplier records. They do not approve food or replace a food safety plan. NZ kitchens need their applicable rules configured. Allergen notes are operator-entered, not certified declarations.

## Ten questions across your kitchen

MarketMan already reports on recipe costs and actual versus theoretical use. These are questions this build answers from your records today, not claims that MarketMan cannot answer them.

1. Which dishes are above our chosen food cost target? (`menu-costing`)
2. Which ingredients have usage left unexplained after recorded sales and waste? (`usage-gap`)
3. Which kitchen has an old stock count behind its order proposal? (`par-order`)
4. How many supplier packs cover the recorded shortage? (`par-order`)
5. Which accepted receipt changed an ingredient cost? (`price-watch`)
6. Which orders are overdue with stock still outstanding? (`orders`)
7. Which waste entries have a recorded reason and operator? (`waste-review`)
8. Which suppliers have held deliveries and missing address records? (`supplier-review + compliance`)
9. What portion of recorded sales went on the ingredients used? (`food-cost`)
10. What should each kitchen follow up this Monday? (`weekly-review`)

## Your first hour: ten things to ask for

1. Put our name and logo on the stocktake sheet.
2. Add our sites, currencies and timezones.
3. Map our supplier export headings.
4. Convert our supplier cases to kilograms or litres.
5. Add our food cost targets by dish.
6. Enter a counted opening position for every ingredient.
7. Add our recipe yields and portion sizes.
8. Add a report for held supplier deliveries.
9. Write our Monday review in our kitchen's words.
10. Draft our next supplier price discussion from the recorded changes.

Use /customise for migrations, changed rules and tests. Use /new-view for read-only reports.

## Switching from MarketMan

[The replacement guide](docs/replace-marketman.md) explains export verification, explicit column mapping, one-command import, rollback preview and reconciliation. No universal native MarketMan spreadsheet format was verified. Fixture headers are illustrative, not a claim about a genuine vendor export. Exact repeated imports skip. Changed source keys or mappings stop for review. Unknown columns fail until explicitly mapped or ignored. All source columns are preserved in provenance.

[Why no front end](docs/why-no-front-end.md) describes the workflow fit. This is a manager's costing and purchasing desk, with printable sheets. Live point-of-sale feeds, invoice scanning, mobile counting and supplier messaging need separately scoped connections or capture work. Keep the existing capture process until the replacement is tested end to end.

## Verification and operations

npm test uses a temporary database. It checks recipe yield maths, frozen sale usage, held receipts, partial receiving, cross-site constraints, paired transfers, import rollback, repeated imports, audit records, document escaping and real process exit codes. CI runs the same tests on Windows and Linux with PGlite and on Linux against disposable Postgres. TEST_DATABASE_URL must point to an empty disposable database, never a live one.

Export includes every entity plus consumption, audit and import history in JSON and CSV. It is an interchange snapshot, not an automatic restore tool. Keep database backups and test a restore separately. Referenced invoice or method files need their own backup. Shared access requires appropriate roles and permissions. Audit records can be changed by a database administrator and are not tamper proof.
