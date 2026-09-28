create table sites (id uuid primary key default gen_random_uuid(), created_at timestamptz not null default now(), updated_at timestamptz not null default now(), name text not null check(length(trim(name))>0), currency text not null default 'AUD' check(currency in ('AUD','NZD','USD','GBP')), country text not null default 'AU' check(country in ('AU','NZ','US','GB')), timezone text not null default 'Australia/Sydney');
create table suppliers (id uuid primary key default gen_random_uuid(), created_at timestamptz not null default now(), updated_at timestamptz not null default now(), name text not null check(length(trim(name))>0), address text, contact text, review_due date);
create table items (id uuid primary key default gen_random_uuid(), created_at timestamptz not null default now(), updated_at timestamptz not null default now(), site_id uuid not null references sites, supplier_id uuid not null references suppliers, name text not null check(length(trim(name))>0), unit text not null check(unit in ('kg','l','each')), pack_size numeric not null default 1 check(pack_size>0), unit_cost numeric not null check(unit_cost>=0), par numeric not null default 0 check(par>=0), storage text not null default 'ambient' check(storage in ('ambient','chilled','hot','frozen')), allergen_notes text, unique(site_id,name));
create table recipes (id uuid primary key default gen_random_uuid(), created_at timestamptz not null default now(), updated_at timestamptz not null default now(), site_id uuid not null references sites, name text not null check(length(trim(name))>0), portions numeric not null default 1 check(portions>0), sale_price numeric not null check(sale_price>0), target_pct numeric not null default 30 check(target_pct>0 and target_pct<=100), unique(site_id,name));
create table recipe_lines (id uuid primary key default gen_random_uuid(), created_at timestamptz not null default now(), updated_at timestamptz not null default now(), recipe_id uuid not null references recipes, item_id uuid not null references items, net_qty numeric not null check(net_qty>0), yield_pct numeric not null default 100 check(yield_pct>0 and yield_pct<=100), unique(recipe_id,item_id));
create table orders (id uuid primary key default gen_random_uuid(), created_at timestamptz not null default now(), updated_at timestamptz not null default now(), item_id uuid not null references items, name text not null check(length(trim(name))>0), packs numeric not null check(packs>0), pack_size numeric not null check(pack_size>0), unit_cost numeric not null check(unit_cost>=0), due_on date not null, state text not null default 'draft' check(state in ('draft','placed','closed')), unique(item_id,name));
create table invoices (id uuid primary key default gen_random_uuid(), created_at timestamptz not null default now(), updated_at timestamptz not null default now(), site_id uuid not null references sites, supplier_id uuid not null references suppliers, name text not null check(length(trim(name))>0), issued_on date not null, due_on date not null, total numeric not null check(total>=0), status text not null default 'unpaid' check(status in ('unpaid','settled','disputed')), evidence_ref text, check(due_on>=issued_on), unique(site_id,supplier_id,name));
create table stocktakes (id uuid primary key default gen_random_uuid(), created_at timestamptz not null default now(), updated_at timestamptz not null default now(), item_id uuid not null references items, quantity numeric not null check(quantity>=0), occurred_at timestamptz not null, operator text not null check(length(trim(operator))>0), unique(item_id,occurred_at));
create table movements (id uuid primary key default gen_random_uuid(), created_at timestamptz not null default now(), updated_at timestamptz not null default now(), item_id uuid not null references items, order_id uuid references orders, kind text not null check(kind in ('receipt','waste','transfer-in','transfer-out')), quantity numeric not null check(quantity>0), unit_cost numeric not null check(unit_cost>=0), occurred_at timestamptz not null, operator text not null check(length(trim(operator))>0), batch text, temperature_c numeric check(temperature_c between -100 and 200), frozen_hard boolean, method_ref text, disposition text not null default 'accepted' check(disposition in ('accepted','held','rejected')), reason text, evidence_ref text, transfer_key uuid, check(kind<>'waste' or nullif(trim(reason),'') is not null), check(kind<>'receipt' or nullif(trim(batch),'') is not null), check(kind='receipt' or disposition='accepted'));
create table sales (id uuid primary key default gen_random_uuid(), created_at timestamptz not null default now(), updated_at timestamptz not null default now(), recipe_id uuid not null references recipes, quantity numeric not null check(quantity>0), unit_price numeric not null check(unit_price>=0), occurred_at timestamptz not null, reference text not null unique check(length(trim(reference))>0));
create table consumption (id uuid primary key default gen_random_uuid(), created_at timestamptz not null default now(), updated_at timestamptz not null default now(), sale_id uuid not null references sales, item_id uuid not null references items, quantity numeric not null check(quantity>0), unit_cost numeric not null check(unit_cost>=0), unique(sale_id,item_id));
create table import_records (id uuid primary key default gen_random_uuid(), created_at timestamptz not null default now(), updated_at timestamptz not null default now(), source text not null, entity text not null, source_key text not null, record_id uuid not null, fingerprint text not null, raw_record jsonb not null, unique(source,entity,source_key));
create table audit_log (id uuid primary key default gen_random_uuid(), created_at timestamptz not null default now(), updated_at timestamptz not null default now(), entity text not null, record_id uuid not null, operation text not null, before_record jsonb, after_record jsonb);
create function touch_updated() returns trigger language plpgsql as $$ begin new.updated_at=now(); return new; end $$;
create function audit_change() returns trigger language plpgsql as $$ begin
 insert into audit_log(entity,record_id,operation,before_record,after_record) values(TG_TABLE_NAME,coalesce(new.id,old.id),TG_OP,case when TG_OP='INSERT' then null else to_jsonb(old) end,case when TG_OP='DELETE' then null else to_jsonb(new) end); return coalesce(new,old); end $$;
create function same_site() returns trigger language plpgsql as $$ begin
 if (select site_id from recipes where id=new.recipe_id)<>(select site_id from items where id=new.item_id) then raise exception 'Recipe and ingredient belong to different sites'; end if; return new; end $$;
create trigger recipe_line_site before insert or update on recipe_lines for each row execute function same_site();
create trigger sites_touch before update on sites for each row execute function touch_updated();
create trigger sites_audit after insert or update or delete on sites for each row execute function audit_change();
create trigger suppliers_touch before update on suppliers for each row execute function touch_updated();
create trigger suppliers_audit after insert or update or delete on suppliers for each row execute function audit_change();
create trigger items_touch before update on items for each row execute function touch_updated();
create trigger items_audit after insert or update or delete on items for each row execute function audit_change();
create trigger recipes_touch before update on recipes for each row execute function touch_updated();
create trigger recipes_audit after insert or update or delete on recipes for each row execute function audit_change();
create trigger recipe_lines_touch before update on recipe_lines for each row execute function touch_updated();
create trigger recipe_lines_audit after insert or update or delete on recipe_lines for each row execute function audit_change();
create trigger orders_touch before update on orders for each row execute function touch_updated();
create trigger orders_audit after insert or update or delete on orders for each row execute function audit_change();
create trigger invoices_touch before update on invoices for each row execute function touch_updated();
create trigger invoices_audit after insert or update or delete on invoices for each row execute function audit_change();
create trigger stocktakes_touch before update on stocktakes for each row execute function touch_updated();
create trigger stocktakes_audit after insert or update or delete on stocktakes for each row execute function audit_change();
create trigger movements_touch before update on movements for each row execute function touch_updated();
create trigger movements_audit after insert or update or delete on movements for each row execute function audit_change();
create trigger sales_touch before update on sales for each row execute function touch_updated();
create trigger sales_audit after insert or update or delete on sales for each row execute function audit_change();
create trigger consumption_touch before update on consumption for each row execute function touch_updated();
create trigger consumption_audit after insert or update or delete on consumption for each row execute function audit_change();
create trigger import_records_touch before update on import_records for each row execute function touch_updated();
create trigger audit_log_touch before update on audit_log for each row execute function touch_updated();

create view v_recipe_costs as
select r.id,r.site_id,s.name as site,s.currency,r.name as dish,r.portions,r.sale_price,r.target_pct,
 count(l.id) as ingredients,round(sum(l.net_qty/(l.yield_pct/100)*i.unit_cost)/r.portions,4) as cost_per_portion,
 round(100*sum(l.net_qty/(l.yield_pct/100)*i.unit_cost)/r.portions/r.sale_price,2) as food_cost_pct,
 round(r.sale_price-sum(l.net_qty/(l.yield_pct/100)*i.unit_cost)/r.portions,4) as contribution
from recipes r join sites s on s.id=r.site_id left join recipe_lines l on l.recipe_id=r.id left join items i on i.id=l.item_id group by r.id,s.id;
create view v_stock as
select i.id,i.site_id,s.name as site,s.currency,i.name as item,i.unit,i.pack_size,i.unit_cost,i.par,p.name as supplier,
 c.occurred_at as last_count,c.quantity as counted,
 case when c.id is null then null else c.quantity
 +coalesce((select sum(case when m.kind in ('receipt','transfer-in') then m.quantity else -m.quantity end) from movements m where m.item_id=i.id and m.disposition='accepted' and m.occurred_at>c.occurred_at and m.occurred_at<=now()),0)
 -coalesce((select sum(x.quantity) from consumption x join sales a on a.id=x.sale_id where x.item_id=i.id and a.occurred_at>c.occurred_at and a.occurred_at<=now()),0) end as on_hand
from items i join sites s on s.id=i.site_id join suppliers p on p.id=i.supplier_id
left join lateral(select * from stocktakes where item_id=i.id and occurred_at<=now() order by occurred_at desc limit 1)c on true;
create view v_par_order as
select *,case when on_hand is null then null else greatest(0,ceil((par-on_hand)/pack_size)) end as packs_to_order,
 case when last_count is null then 'Count missing' when last_count<now()-interval '7 days' then 'Count stale' else 'Review before ordering' end as finding
from v_stock where on_hand is null or on_hand<par or last_count<now()-interval '7 days';
create view v_usage as
with counts as(select c.*,lag(quantity) over(partition by item_id order by occurred_at) as opening,lag(occurred_at) over(partition by item_id order by occurred_at) as start_at,row_number() over(partition by item_id order by occurred_at desc) as n from stocktakes c where occurred_at<=now()),
periods as(select i.id,i.site_id,s.name as site,s.currency,i.name as item,i.unit,i.unit_cost,c.start_at,c.occurred_at as end_at,c.opening,c.quantity as closing,
 coalesce((select sum(case when m.kind in ('receipt','transfer-in') then m.quantity when m.kind='transfer-out' then -m.quantity else 0 end) from movements m where m.item_id=i.id and m.disposition='accepted' and m.occurred_at>c.start_at and m.occurred_at<=c.occurred_at),0) as incoming,
 coalesce((select sum(m.quantity) from movements m where m.item_id=i.id and m.kind='waste' and m.occurred_at>c.start_at and m.occurred_at<=c.occurred_at),0) as waste,
 coalesce((select sum(x.quantity) from consumption x join sales a on a.id=x.sale_id where x.item_id=i.id and a.occurred_at>c.start_at and a.occurred_at<=c.occurred_at),0) as theoretical
from items i join sites s on s.id=i.site_id left join counts c on c.item_id=i.id and c.n=1)
select *,opening+incoming-closing as actual,opening+incoming-closing-theoretical-waste as unexplained,
 round((opening+incoming-closing-theoretical-waste)*unit_cost,2) as unexplained_value,
 case when start_at is null then 'Need two counts' else 'Latest count interval; current-cost valuation' end as basis from periods;
create view v_price_watch as
select i.id,s.name as site,s.currency,i.name as item,i.unit,i.unit_cost as current_cost,
 m.unit_cost as previous_receipt_cost,round(100*(i.unit_cost-m.unit_cost)/nullif(m.unit_cost,0),2) as change_pct
from items i join sites s on s.id=i.site_id left join lateral(select unit_cost from movements where item_id=i.id and kind='receipt' and disposition='accepted' order by occurred_at desc,id desc offset 1 limit 1)m on true;
create view v_order_review as
select o.id,i.site_id,s.name as site,s.currency,o.name,i.name as item,o.due_on,o.state,o.packs*o.pack_size as ordered_units,
 coalesce(sum(m.quantity) filter(where m.disposition='accepted'),0) as received_units,
 o.packs*o.pack_size-coalesce(sum(m.quantity) filter(where m.disposition='accepted'),0) as outstanding_units
from orders o join items i on i.id=o.item_id join sites s on s.id=i.site_id left join movements m on m.order_id=o.id group by o.id,i.id,s.id;
create view v_invoice_review as
select a.id,a.site_id,s.name as site,s.currency,p.name as supplier,a.name,a.due_on,a.total,a.status,a.evidence_ref
from invoices a join sites s on s.id=a.site_id join suppliers p on p.id=a.supplier_id where a.status<>'settled';
create view v_compliance as
select m.id,i.site_id,s.name as site,'AU-RECEIVE'::text as rule,i.name as item,m.batch,
 case when m.disposition<>'accepted' then 'Held or rejected; review disposition'
 when i.storage='chilled' and (m.temperature_c is null or m.temperature_c>5) then 'Cold delivery needs temperature or reviewed alternative evidence'
 when i.storage='hot' and (m.temperature_c is null or m.temperature_c<60) then 'Hot delivery needs temperature or reviewed alternative evidence'
 when i.storage='frozen' and m.frozen_hard is distinct from true then 'Frozen condition not confirmed'
 else 'Review alternative method evidence' end as finding,m.method_ref
from movements m join items i on i.id=m.item_id join sites s on s.id=i.site_id where s.country='AU' and m.kind='receipt' and (m.disposition<>'accepted' or (i.storage='chilled' and (m.temperature_c is null or m.temperature_c>5)) or (i.storage='hot' and (m.temperature_c is null or m.temperature_c<60)) or (i.storage='frozen' and m.frozen_hard is distinct from true))
union all select i.id,i.site_id,s.name,'AU-SUPPLIER',i.name,null,'Supplier address missing',null from items i join suppliers p on p.id=i.supplier_id join sites s on s.id=i.site_id where s.country='AU' and nullif(trim(p.address),'') is null
union all select s.id,s.id,s.name,'SCOPE',s.name,null,'Local receiving rules need configuration outside Australia',null from sites s where s.country<>'AU';
create view v_attention as
select id,site_id,site,'Stock count'::text as kind,item,'Count missing or older than seven days'::text as finding from v_stock where last_count is null or last_count<now()-interval '7 days'
union all select id,site_id,site,'Recipe',dish,'No ingredients or food cost above target' from v_recipe_costs where ingredients=0 or food_cost_pct>target_pct
union all select id,site_id,site,'Order',name,'Overdue with units outstanding' from v_order_review where state='placed' and due_on<current_date and outstanding_units>0
union all select id,site_id,site,'Invoice',name,'Unsettled invoice overdue' from v_invoice_review where due_on<current_date;
