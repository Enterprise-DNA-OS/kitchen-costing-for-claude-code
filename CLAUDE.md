# Kitchen Costing for Claude Code

For restaurant owners and chefs reviewing ingredients, recipe margins, stock, purchasing and waste. Set your business name and logo in brand.json.

## Routes

- `/sites`: Review each kitchen, currency, country and timezone.
- `/suppliers`: Review supplier identity, address, contact and review date.
- `/items`: Read base units, supplier, pack conversions, par and current cost. Costs exclude tax.
- `/recipes`: Read recipe portions, selling price and target food cost percentage.
- `/recipe-lines`: Read net ingredient quantities and yield percentages for each batch.
- `/stock`: Read counted stock plus accepted movements minus snapshotted recipe consumption. Missing counts remain unknown.
- `/menu-costing`: Review food cost per portion, target percentage and contribution before labour and overhead. Recipes without ingredients have unknown cost.
- `/par-order`: Review shortages in purchase packs. Recount stale or missing stock before placing an order. Check open orders separately to avoid ordering twice.
- `/usage-gap`: Compare the latest two counts for each ingredient. Actual usage is opening plus accepted receipts and net transfers minus closing. Subtract recipe usage and waste to get unexplained usage. Each ingredient can have different count dates.
- `/price-watch`: Compare the current base-unit cost against the previous accepted receipt cost. A missing previous receipt means the change is unknown.
- `/orders`: Review draft and placed orders, accepted receipts and outstanding quantities. Held deliveries do not reduce what is owed.
- `/invoices`: Review unpaid and disputed invoices by site, currency and due date. This is a register, not a payment tool.
- `/counts`: Read observed quantities, timestamps and operators. Counts are in base units, not supplier packs.
- `/movements`: Read receipt, waste and paired transfer history, including held and rejected deliveries.
- `/sales`: Read recorded recipe sales. Ingredient usage and cost were snapshotted when each sale was logged.
- `/waste-review`: Review waste reason, operator, quantity and recorded cost by site.
- `/supplier-review`: Review supplier addresses, review dates and held or rejected receipts. Review dates are business policy.
- `/food-cost`: Read the last seven days of recorded sales and snapshotted theoretical cost per site. This is not actual accounting COGS or profit.
- `/attention`: Review stale counts, uncosted or over-target recipes, overdue orders and unsettled invoices. Seven days is the demo counting policy.
- `/compliance`: Read docs/compliance.md first. Review selected Australian receiving and supplier record checks. An alternative method reference still requires a person to review the evidence. Do not certify food or auto-release a held delivery.
- `/audit`: Read before and after records for writes. Administrators can alter this database, so the history is not tamper proof.
- `/help`: Read the complete CLI list and accepted fields before preparing a write.
- `/record`: Read one entity by case-insensitive name fragment or UUID prefix. List ambiguous matches and ask the operator to choose.
- `/add`: Read help, then add the entity using only operator-supplied facts. Relationships accept an unambiguous name or UUID. All costs and quantities must use the documented base units.
- `/update`: Read the current record, then update only supplied fields. Observations are append-only. Orders progress draft to placed to closed. Recording placed means a person already placed it outside this tool. Invoice status records external facts and never moves money.
- `/log`: Record a real count, receipt, waste event or sale with its observed timezone timestamp. Sales snapshot current recipe usage and costs. Backdated sales use the recipe definition at entry, so reconcile historical mappings first.
- `/transfer`: Read both item records and confirm they represent the same ingredient and base unit. Move counted stock between sites atomically. Different currencies are rejected. Never infer pack or unit conversions.
- `/weekly-review`: Run attention, menu-costing, usage-gap, par-order, food-cost and compliance. Write a Monday plan with kitchen, issue, evidence and owner. Do not sum different currencies or different count periods.
- `/draft-order`: Read a supplier and write an internal order proposal into drafts. Check freshness, units and open orders. A person reviews and sends it.
- `/draft-supplier`: Read a supplier and draft a price discussion from recorded costs into drafts. No sending.
- `/import`: Read docs/replace-marketman.md. Inspect a real export, write an explicit column map and stable source key, run the preview, reconcile and import the same folder.
- `/export`: Export every entity, consumption snapshot, audit record and import provenance as JSON and CSV into a new folder. Back up evidence files separately.
- `/customise`: Describe the field, rule or workflow change. Write a new migration without editing an applied migration, adjust the CLI, import mapping and tests, then migrate a disposable copy and run npm test. Preserve units, recipe history and ownership boundaries.
- `/new-view`: Add a read-only entry in views.json using existing database views or a new tested migration. Use brand.json and npm run view. Never add write controls or send anything.

## Operating rules

Every answer starts with scripts/kitchen.mjs and current database records. Read the matching .claude/commands file first. Use --json for calculations. Never invent measurements, invoices, prices, counts or sales. Ask the operator to resolve ambiguous names. Costs and selling prices exclude tax. Quantities are kg, l or each, never an unlabelled pack.

A count at a timestamp includes movements and sales through that timestamp. A sale uses the recipe definition at entry and stores its ingredient consumption. Backdated imports require reconciliation against historical recipes. Recipe changes affect future entries, not saved sales. Held receipts do not enter available stock. No command releases them. Correct factual mistakes with a reviewed migration preserving the original record and evidence, not a hidden edit.

Read docs/compliance.md before interpreting findings. The Australian checks are a limited receiving record review. Other jurisdictions require configured rules. A food safety supervisor decides food disposition. This tool does not certify safety.

Draft into drafts only. Never send, publish, place orders, transfer money or delete records. Marking an order placed or an invoice settled only records something a person did elsewhere. No sending or payment connector exists.

For real use start with a fresh DATA_DIR or empty DATABASE_URL and migrate without seed. Apply least-privilege access, backups and restore tests before sharing a database. Evidence references are not file backups. Keep private records and credentials out of source control. Read AGENTS.md for other runtimes. Run npm test after changes.
