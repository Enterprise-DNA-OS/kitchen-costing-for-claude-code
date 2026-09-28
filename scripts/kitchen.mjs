#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {getDb,REPO_ROOT} from './lib/db.mjs';
import {parseCsv} from './lib/csv.mjs';
import {table} from './lib/format.mjs';
import {page,table as htmlTable,writeOut} from './lib/render.mjs';

// Fields are the only identifiers allowed into SQL. Relationships resolve before writes.
export const fields={
 sites:{name:'text',currency:'text',country:'text',timezone:'text'},
 suppliers:{name:'text',address:'text?',contact:'text?',review_due:'date?'},
 items:{site_id:'@sites',supplier_id:'@suppliers',name:'text',unit:'text',pack_size:'number',unit_cost:'number',par:'number',storage:'text',allergen_notes:'text?'},
 recipes:{site_id:'@sites',name:'text',portions:'number',sale_price:'number',target_pct:'number'},
 recipe_lines:{recipe_id:'@recipes',item_id:'@items',net_qty:'number',yield_pct:'number'},
 orders:{item_id:'@items',name:'text',packs:'number',pack_size:'number',unit_cost:'number',due_on:'date',state:'text'},
 invoices:{site_id:'@sites',supplier_id:'@suppliers',name:'text',issued_on:'date',due_on:'date',total:'number',status:'text',evidence_ref:'text?'},
 stocktakes:{item_id:'@items',quantity:'number',occurred_at:'timestamp',operator:'text'},
 movements:{item_id:'@items',order_id:'@orders?',kind:'text',quantity:'number',unit_cost:'number',occurred_at:'timestamp',operator:'text',batch:'text?',temperature_c:'number?',frozen_hard:'boolean?',method_ref:'text?',disposition:'text',reason:'text?',evidence_ref:'text?'},
 sales:{recipe_id:'@recipes',quantity:'number',unit_price:'number',occurred_at:'timestamp',reference:'text'}
};
export const reads={
 sites:'select * from sites order by name',suppliers:'select * from suppliers order by name',items:'select * from items order by name',recipes:'select * from recipes order by name',
 'recipe-lines':'select * from recipe_lines order by recipe_id,item_id',
 stock:'select site,item,unit,round(on_hand,3) as on_hand,par,last_count from v_stock order by site,item',
 'menu-costing':'select site,currency,dish,sale_price,cost_per_portion,food_cost_pct,target_pct,contribution from v_recipe_costs order by site,dish',
 'par-order':'select site,item,unit,round(on_hand,3) as on_hand,par,pack_size,packs_to_order,finding from v_par_order order by site,item',
 'usage-gap':'select site,item,unit,opening,incoming,closing,round(actual,3) as actual,round(theoretical,3) as theoretical,waste,round(unexplained,3) as unexplained,basis from v_usage order by site,item',
 'price-watch':'select * from v_price_watch order by site,item',
 orders:'select * from v_order_review order by site,due_on,name',
 invoices:'select * from v_invoice_review order by site,due_on',
 counts:'select * from stocktakes order by occurred_at desc',
 movements:'select * from movements order by occurred_at desc',
 sales:'select * from sales order by occurred_at desc',
 'waste-review':"select s.name as site,s.currency,i.name as item,i.unit,m.quantity,round(m.quantity*m.unit_cost,2) as value,m.reason,m.operator,m.occurred_at from movements m join items i on i.id=m.item_id join sites s on s.id=i.site_id where m.kind='waste' order by m.occurred_at desc",
 'supplier-review':"select p.id,p.name,p.address,p.review_due,count(m.id) as receipts,count(m.id) filter(where m.disposition<>'accepted') as held_or_rejected from suppliers p left join items i on i.supplier_id=p.id left join movements m on m.item_id=i.id and m.kind='receipt' group by p.id order by p.name",
 'food-cost':"select s.name as site,s.currency,round(sum(a.quantity*a.unit_price),2) as recorded_sales,round(sum((select sum(c.quantity*c.unit_cost) from consumption c where c.sale_id=a.id)),2) as theoretical_cost,round(100*sum((select sum(c.quantity*c.unit_cost) from consumption c where c.sale_id=a.id))/nullif(sum(a.quantity*a.unit_price),0),2) as theoretical_pct from sales a join recipes r on r.id=a.recipe_id join sites s on s.id=r.site_id where a.occurred_at>=now()-interval '7 days' and a.occurred_at<=now() group by s.id order by s.name",
 attention:'select site,kind,item,finding from v_attention order by site,kind,item',
 compliance:'select site,rule,item,batch,finding,method_ref from v_compliance order by site,rule,item',
 audit:'select * from audit_log order by created_at,id'
};
const snapshotTables=[...Object.keys(fields),'consumption','import_records','audit_log'];
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function entity(t){if(!Object.hasOwn(fields,t))throw Error(`Unknown entity ${t}`);return t;}
function arity(args,n){if(args.length!==n)throw Error(`Expected ${n} arguments, received ${args.length}`);}
function json(text){let value;try{value=JSON.parse(text);}catch{throw Error('Payload must be a JSON object');}if(!value||Array.isArray(value)||typeof value!=='object')throw Error('Payload must be a JSON object');return value;}
export async function resolve(db,t,query){
 entity(t);if(typeof query!=='string'||!query.trim())throw Error(`A name or id for ${t} is required`);
 const rows=await db.query(`select * from ${t} where id::text=$1`,[query]);if(rows.length)return rows[0];
 const column=fields[t].name?'name':t==='sales'?'reference':null;
 const found=await db.query(`select * from ${t} where starts_with(lower(id::text),lower($1))${column?` or strpos(lower(${column}),lower($1))>0`:''} order by id`,[query]);
 if(found.length===1)return found[0];if(!found.length)throw Error(`No match in ${t}: ${query}`);
 const error=Error(`Ambiguous ${t}: ${found.map(r=>`${r.id} ${r.name||r.reference||''}`).join('; ')}`);error.candidates=found;throw error;
}
async function validate(db,t,p){
 entity(t);if(!Object.keys(p).length)throw Error('No fields supplied');
 const out={};for(const [k,v] of Object.entries(p)){
  let type=fields[t][k];if(!type)throw Error(`Unknown field ${t}.${k}`);
  const nullable=type.endsWith('?');type=type.replace(/\?$/,'');if(v===null){if(!nullable)throw Error(`${k} cannot be null`);out[k]=null;continue;}
  if(type.startsWith('@')){out[k]=(await resolve(db,type.slice(1),v)).id;continue;}
  if(type==='number'&&(typeof v!=='number'||!Number.isFinite(v)))throw Error(`${k} must be a finite number`);
  if(type==='boolean'&&typeof v!=='boolean')throw Error(`${k} must be a boolean`);
  if(['text','date','timestamp'].includes(type)&&typeof v!=='string')throw Error(`${k} must be text`);
  if(type==='text'&&!v.trim()&&!nullable)throw Error(`${k} must not be empty`);
  if(type==='date'||type==='timestamp'){
   const d=v.slice(0,10);if(!/^\d{4}-\d{2}-\d{2}$/.test(d)||Number.isNaN(Date.parse(d))||new Date(d).toISOString().slice(0,10)!==d)throw Error(`${k} requires a real YYYY-MM-DD date`);
   if(type==='timestamp'&&(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/.test(v)||!Number.isFinite(Date.parse(v))||Date.parse(v)>Date.now()))throw Error(`${k} needs a timezone timestamp, not in the future`);
  }
  if(k==='timezone'){try{new Intl.DateTimeFormat('en',{timeZone:v});}catch{throw Error('Invalid timezone');}}
  out[k]=v;
 }return out;
}
async function insert(db,t,p){const keys=Object.keys(p);return (await db.query(`insert into ${t} (${keys.join(',')}) values (${keys.map((_,i)=>'$'+(i+1)).join(',')}) returning *`,Object.values(p)))[0];}
async function add(db,t,raw,{transfer=false}={}){
 const p=await validate(db,t,raw);
 if(t==='items'||t==='recipes'){if(!p.site_id)throw Error('site_id required');}
 if(t==='orders'&&p.state&&p.state!=='draft')throw Error('New orders start as draft');
 if(t==='movements'){
  if(!transfer&&!['receipt','waste'].includes(p.kind))throw Error('Use transfer for paired stock movements');
  const item=await resolve(db,'items',p.item_id||'');await db.query('select id from items where id=$1 for update',[item.id]);
  if(p.order_id){const o=await resolve(db,'orders',p.order_id);await db.query('select id from orders where id=$1 for update',[o.id]);if(o.item_id!==item.id||p.kind!=='receipt'||o.state!=='placed')throw Error('Receipt order must be placed and match the item');
   const [r]=await db.query('select outstanding_units from v_order_review where id=$1',[o.id]);if((p.disposition||'accepted')==='accepted'&&p.quantity>Number(r.outstanding_units))throw Error('Receipt exceeds outstanding order quantity');
  }
 }
 if(t==='sales'){
  const recipe=await resolve(db,'recipes',p.recipe_id||'');await db.query('select id from recipes where id=$1 for update',[recipe.id]);
  const lines=await db.query('select l.*,i.unit_cost from recipe_lines l join items i on i.id=l.item_id where l.recipe_id=$1',[recipe.id]);if(!lines.length)throw Error('Cannot log sales for a recipe without ingredients');
  const row=await insert(db,t,p);
  // Compute with database decimals and snapshot usage, so later recipe edits cannot rewrite history.
  await db.query(`insert into consumption(sale_id,item_id,quantity,unit_cost) select $1,l.item_id,l.net_qty/(l.yield_pct/100)/r.portions*$2,i.unit_cost from recipe_lines l join recipes r on r.id=l.recipe_id join items i on i.id=l.item_id where r.id=$3`,[row.id,p.quantity,recipe.id]);return row;
 }
 const row=await insert(db,t,p);
 if(t==='movements'&&p.kind==='receipt'&&(p.disposition||'accepted')==='accepted'){
  const latest=await db.query("select id from movements where item_id=$1 and kind='receipt' and disposition='accepted' order by occurred_at desc,created_at desc,id desc limit 1",[p.item_id]);
  if(latest[0].id===row.id)await db.query('update items set unit_cost=$1 where id=$2',[p.unit_cost,p.item_id]);
 }return row;
}
async function update(db,t,q,raw){
 if(!['suppliers','items','recipes','recipe_lines','orders','invoices'].includes(t))throw Error(`${t} records are append-only through this CLI`);
 const old=await resolve(db,t,q),p=await validate(db,t,raw);
 if(['items','recipes','recipe_lines'].includes(t)&&Object.keys(p).some(k=>['site_id','supplier_id','item_id','recipe_id','unit','pack_size'].includes(k)))throw Error('Relationships and stock units are immutable; use a reviewed migration');
 if(t==='orders'){
  if(Object.keys(p).some(k=>k!=='state'))throw Error('Order details are immutable; close and create a new draft');
  if(!((old.state==='draft'&&p.state==='placed')||(['draft','placed'].includes(old.state)&&p.state==='closed')))throw Error('Invalid order state transition');
 }
 if(t==='invoices'&&Object.keys(p).some(k=>!['status','evidence_ref'].includes(k)))throw Error('Invoice facts are immutable; status and evidence only');
 const keys=Object.keys(p);return (await db.query(`update ${t} set ${keys.map((k,i)=>`${k}=$${i+1}`).join(',')} where id=$${keys.length+1} returning *`,[...Object.values(p),old.id]))[0];
}
async function transfer(db,raw){
 const allowed=['from','to','quantity','occurred_at','operator','reason'];if(Object.keys(raw).some(k=>!allowed.includes(k)))throw Error('Unknown transfer field');
 const from=await resolve(db,'items',raw.from),to=await resolve(db,'items',raw.to);
 if(from.id===to.id||from.site_id===to.site_id||from.unit!==to.unit)throw Error('Transfer requires different sites and matching units');
 const sites=await db.query('select currency from sites where id=$1 or id=$2',[from.site_id,to.site_id]);if(new Set(sites.map(s=>s.currency)).size!==1)throw Error('Transfer currencies must match');
 const ids=[from.id,to.id].sort();for(const id of ids)await db.query('select id from items where id=$1 for update',[id]);
 const stock=(await db.query('select on_hand from v_stock where id=$1',[from.id]))[0];if(stock.on_hand===null||Number(stock.on_hand)<raw.quantity)throw Error('Insufficient counted stock for transfer');
 const key=randomUUID(),rows=[];for(const [item,kind] of [[from,'transfer-out'],[to,'transfer-in']]){
  const row=await add(db,'movements',{item_id:item.id,kind,quantity:raw.quantity,unit_cost:Number(from.unit_cost),occurred_at:raw.occurred_at,operator:raw.operator,reason:raw.reason||'Site transfer'},{transfer:true});
  await db.query('update movements set transfer_key=$1 where id=$2',[key,row.id]);rows.push({...row,transfer_key:key});
 }return rows;
}
function convert(v,type){if(v===''&&type.endsWith('?'))return null;if(type.replace('?','')==='number'){if(v.trim()===''||!Number.isFinite(Number(v)))throw Error('Import requires numeric values');return Number(v);}if(type.replace('?','')==='boolean'){if(!['true','false'].includes(v.toLowerCase()))throw Error('Import boolean must be true or false');return v.toLowerCase()==='true';}return v;}
async function importMarketman(db,folder){
 const mapping=json(fs.readFileSync(path.join(folder,'mapping.json'),'utf8'));
 if(typeof mapping.source!=='string'||!mapping.source.trim()||!Array.isArray(mapping.files)||!mapping.files.length)throw Error('mapping.json needs a stable source account and files');
 let inserted=0,skipped=0;const seen=new Set();
 for(const spec of mapping.files){
  entity(spec.entity);if(!spec.columns||typeof spec.columns!=='object'||Array.isArray(spec.columns)||!spec.key)throw Error('Each file needs columns and a stable key');
  if(path.basename(spec.file)!==spec.file)throw Error('Import filenames must be local basenames');
  const targets=Object.values(spec.columns).filter(Boolean);if(new Set(targets).size!==targets.length)throw Error('Duplicate mapped field');
  for(const key of targets)if(!fields[spec.entity][key])throw Error('Unknown mapped field '+key);
  const rows=parseCsv(fs.readFileSync(path.join(folder,spec.file),'utf8'));if(!rows.length)throw Error('No data rows in '+spec.file);
  for(const raw of rows){
   if(Object.keys(raw).some(k=>k!==spec.key&&!Object.hasOwn(spec.columns,k)))throw Error('Unmapped export column');
   if(Object.keys(spec.columns).some(k=>!Object.hasOwn(raw,k)))throw Error('Mapped column missing');
   if(typeof raw[spec.key]!=='string'||!raw[spec.key].trim())throw Error('Source key missing');
   const key=raw[spec.key],identity=spec.entity+'|'+key;if(seen.has(identity))throw Error('Duplicate source key '+key);seen.add(identity);
   const p={...(spec.defaults||{})};for(const [heading,field] of Object.entries(spec.columns)){if(field){if(Object.hasOwn(p,field))throw Error('Mapping overrides default '+field);p[field]=convert(raw[heading],fields[spec.entity][field]);}}
   const fingerprint=createHash('sha256').update(JSON.stringify({raw,p})).digest('hex');
   const old=(await db.query('select * from import_records where source=$1 and entity=$2 and source_key=$3',[mapping.source,spec.entity,key]))[0];
   if(old){if(old.fingerprint!==fingerprint)throw Error('Changed source record or mapping: '+key);skipped++;continue;}
   const record=await add(db,spec.entity,p);
   await insert(db,'import_records',{source:mapping.source,entity:spec.entity,source_key:key,record_id:record.id,fingerprint,raw_record:JSON.stringify(raw)});inserted++;
  }
 }return {inserted,skipped,source:mapping.source};
}
function csv(rows){if(!rows.length)return '';const keys=Object.keys(rows[0]),cell=v=>'"'+String(v===null?'':typeof v==='object'?JSON.stringify(v):v).replaceAll('"','""')+'"';return [keys,...rows.map(r=>keys.map(k=>r[k]))].map(r=>r.map(cell).join(',')).join('\r\n')+'\r\n';}
const briefColumns={
 'menu-costing':['site','currency','dish','cost_per_portion','food_cost_pct','target_pct'],
 'usage-gap':['site','item','unit','actual','theoretical','waste','unexplained'],
 'par-order':['site','item','unit','on_hand','packs_to_order','finding']
};
const labels={cost_per_portion:'portion cost',food_cost_pct:'food cost %',target_pct:'target %',packs_to_order:'packs',on_hand:'on hand'};
export function format(value,command){
 if(Array.isArray(value)){if(!value.length)return '(none)';return table(value,(briefColumns[command]||Object.keys(value[0])).map(key=>({key,label:labels[key]||key.replaceAll('_',' '),format:v=>v instanceof Date?v.toISOString():v===null?'unknown':typeof v==='object'?JSON.stringify(v):v})));}
 if(value&&typeof value==='object')return Object.entries(value).map(([k,v])=>`${k}\n${Array.isArray(v)?format(v,k):typeof v==='object'?JSON.stringify(v,null,2):v}`).join('\n\n');return String(value);
}
async function core(db,args){
 const [cmd,...rest]=args;
 if(Object.hasOwn(reads,cmd)){arity(rest,0);return db.query(reads[cmd]);}
 if(cmd==='help'){arity(rest,0);return {commands:[...Object.keys(reads),'record','add','update','log','transfer','weekly-review','draft-order','draft-supplier','import','export'],fields};}
 if(cmd==='record'){arity(rest,2);return resolve(db,rest[0],rest[1]);}
 if(cmd==='add'){arity(rest,2);return add(db,rest[0],json(rest[1]));}
 if(cmd==='update'){arity(rest,3);return update(db,rest[0],rest[1],json(rest[2]));}
 if(cmd==='log'){arity(rest,2);const types={count:'stocktakes',receive:'movements',waste:'movements',sale:'sales'};if(!types[rest[0]])throw Error('log count|receive|waste|sale JSON');const p=json(rest[1]);if(['receive','waste'].includes(rest[0]))p.kind=rest[0]==='receive'?'receipt':'waste';return add(db,types[rest[0]],p);}
 if(cmd==='transfer'){arity(rest,1);return transfer(db,json(rest[0]));}
 if(cmd==='weekly-review'){arity(rest,0);const out={};for(const k of ['attention','menu-costing','usage-gap','par-order','food-cost','compliance'])out[k]=await db.query(reads[k]);return out;}
 if(cmd==='import'){arity(rest,2);if(rest[0]!=='marketman')throw Error('Expected import marketman <folder>');return importMarketman(db,path.resolve(rest[1]));}
 if(cmd==='export'){
  arity(rest,1);const dir=path.resolve(rest[0]);if(fs.existsSync(dir))throw Error('Export directory must not exist');const records={};for(const t of snapshotTables)records[t]=await db.query(`select * from ${t} order by id`);
  fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,'snapshot.json'),JSON.stringify({version:1,exported_at:new Date().toISOString(),records},null,2)+'\n');for(const [t,rows] of Object.entries(records))fs.writeFileSync(path.join(dir,t+'.csv'),csv(rows));return {directory:dir,records:Object.fromEntries(Object.entries(records).map(([t,r])=>[t,r.length]))};
 }
 if(['draft-order','draft-supplier'].includes(cmd)){
  arity(rest,1);const p=await resolve(db,'suppliers',rest[0]);
  const rows=cmd==='draft-order'?await db.query('select * from v_par_order where id in (select id from items where supplier_id=$1)',[p.id]):await db.query('select * from v_price_watch where id in (select id from items where supplier_id=$1)',[p.id]);
  return {file:writeOut('drafts',cmd+'-'+p.id+'-'+randomUUID(),page({title:`DRAFT ${cmd==='draft-order'?'order proposal':'supplier price review'}: ${p.name}`,subtitle:'Internal draft. Check units, stock count freshness and prices before a person sends it.',sections:[{title:'Records to review',html:htmlTable(rows)}]}))};
 }
 throw Error('Unknown command '+cmd);
}
export async function execute(db,args){
 const jsonFlags=args.filter(x=>x==='--json').length;const dry=args.includes('--dry-run');args=args.filter(x=>!['--json','--dry-run'].includes(x));if(jsonFlags>1)throw Error('Duplicate --json');if(dry&&args[0]!=='import')throw Error('--dry-run is for import');
 // Reads spanning several queries also use one consistent snapshot.
 await db.exec('BEGIN ISOLATION LEVEL REPEATABLE READ');
 try{const result=await core(db,args);await db.exec(dry?'ROLLBACK':'COMMIT');return dry?{...result,dry_run:true}:result;}catch(error){await db.exec('ROLLBACK');throw error;}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
 let db;try{db=await getDb();const out=await execute(db,process.argv.slice(2));console.log(process.argv.includes('--json')?JSON.stringify(out,null,2):format(out,process.argv[2]));}
 catch(error){if(process.argv.includes('--json'))console.error(JSON.stringify({error:error.message,...(error.candidates?{candidates:error.candidates}:{})}));else console.error(error.message);process.exitCode=1;}finally{if(db)await db.close();}
}
