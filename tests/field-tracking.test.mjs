import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { createFieldWorker } from '../src/field-worker.mjs';

const origin='https://potify.example', field='/field/01/', pdf=field+'assets/Field_Card_01.pdf';
const fixtureRead=name=>readFileSync(new URL('../'+name,import.meta.url));
const templates={landing:fixtureRead('public/field/01/index.html').toString(),card:fixtureRead('public/field/01/card.html').toString()};
const bytes=fixtureRead('public/field/01/assets/Field_Card_01.pdf');
const x='?utm_source=x&utm_medium=organic_social&utm_campaign=the_soil_remembers&utm_content=fold';
const tg='?utm_source=telegram&utm_medium=owned_community&utm_campaign=the_soil_remembers&utm_content=notebook';
const privateReport=field+'report';
const owner={'oai-authenticated-user-id':'fixture-owner','oai-authenticated-user-email':'owner@fixture.example'};

function setup() {
  const sql=new DatabaseSync(':memory:'); sql.exec('PRAGMA foreign_keys=ON');
  sql.exec(fixtureRead('drizzle/0000_field_delivery.sql').toString());
  const prepare=(q,args=[])=>({
    bind(...values){return prepare(q,values);},
    async first(){return sql.prepare(q).get(...args);},
    async run(){return sql.prepare(q).run(...args);},
    batchRun(){return {results:sql.prepare(q).all(...args)};}
  });
  const db={prepare,async batch(statements){
    sql.exec('BEGIN');
    try {const result=statements.map(q=>q.batchRun());sql.exec('COMMIT');return result;}
    catch(err){sql.exec('ROLLBACK');throw err;}
  }};
  let now=Date.parse('2026-11-24T04:55:00Z')/1000;
  let badAsset=false;
  const app=createFieldWorker(templates,()=>now);
  const env={DB:db,FIELD_REPORT_OWNER_EMAIL:owner['oai-authenticated-user-email'],ASSETS:{async fetch(req){
    if(new URL(req.url).pathname==='/edition-files/field-card-01.pdf')return badAsset?new Response('wrong',{status:404}):new Response(bytes,{headers:{'Content-Type':'application/pdf'}});
    return new Response('known static route');
  }}};
  function fetchPath(path,opts={}) {
    const headers={'User-Agent':'Mozilla/5.0 iPhone',...(opts.headers||{})};
    return app.fetch(new Request(new URL(path,origin),{...opts,headers}),env);
  }
  async function choice(which,query='',cookie='',headers={}) {
    return fetchPath(field+'privacy'+query,{method:'POST',headers:{Origin:origin,'Content-Type':'application/x-www-form-urlencoded',Cookie:cookie,...headers},body:'choice='+which});
  }
  async function grant(query='') {
    const res=await choice('on',query);assert.equal(res.status,303);
    const set=res.headers.get('set-cookie');assert.match(set,/HttpOnly/);
    return set.split(';')[0];
  }
  const rows=q=>sql.prepare(q).all().map(r=>({...r}));
  return {env,rows,fetchPath,choice,grant,tick:seconds=>{now+=seconds;},bad:()=>{badAsset=true;}};
}

test('reader can open every format without consent; anonymous counts never create a browser or session',async()=>{
  const f=setup();
  for (const p of [field,field+'card.html',pdf]) {
    const r=await f.fetchPath(p);assert.equal(r.status,200);assert.equal(r.headers.get('Set-Cookie'),null);
  }
  assert.deepEqual(f.rows('SELECT * FROM field_readers'),[]);
  assert.deepEqual(f.rows('SELECT * FROM field_sessions'),[]);
  assert.equal(f.rows('SELECT SUM(responses) AS total FROM field_private_daily')[0].total,3);
});

test('first source and date survive reloads, concurrent tabs, PDF before HTML and multiple formats',async()=>{
  const f=setup(),cookie=await f.grant(x), opt={headers:{cookie}};
  await f.fetchPath(field+x,opt);
  await Promise.all([f.fetchPath(field+tg,opt),f.fetchPath(field,opt)]);
  await f.fetchPath(field+'community',opt);
  assert.equal(f.rows('SELECT community_at FROM field_sessions')[0].community_at,null);
  f.tick(420);
  const doc=await f.fetchPath(pdf,{headers:{cookie,Range:'bytes=0-100'}});
  assert.equal(doc.status,200);assert.deepEqual(Buffer.from(await doc.arrayBuffer()),bytes);
  await Promise.all([f.fetchPath(field+'card.html',opt),f.fetchPath(pdf,opt)]);
  await f.fetchPath(field+'community',opt);
  const entries=f.rows('SELECT * FROM field_sessions');assert.equal(entries.length,1);
  const row=entries[0];assert.equal(row.source,'x');assert.equal(row.creative,'fold');assert.equal(row.day_et,'2026-11-23');
  assert.ok(row.pdf_at && row.html_at && row.community_at);
  assert.equal(f.rows('SELECT reader FROM field_readers')[0].reader.length,64);
  assert.notEqual(f.rows('SELECT reader FROM field_readers')[0].reader,cookie.split('=')[1]);
  const csv=await f.fetchPath(privateReport+'.csv',{headers:owner});
  assert.equal(csv.status,200);assert.match(await csv.text(),/2026-11-23,x,organic_social,fold,1,1,1,1/);
  const exportResponse=await f.fetchPath(field+'measured_sessions.csv',{headers:owner});
  assert.equal(exportResponse.headers.get('Content-Disposition'),'attachment; filename="measured_sessions.csv"');
  const exportText=await exportResponse.text();
  assert.match(exportText,/^session_start_date_et,source,medium,traffic_creative,experiment_id,variant_id,landing_session,field_card_delivered,community_outbound/);
  assert.match(exportText,/2026-11-23,x,organic_social,fold,,,1,1,1/);
  const report=await f.fetchPath(privateReport,{headers:owner});assert.match(await report.text(),/100.0%/);
});

test('direct file, HEAD, wrong body, previews, privacy preferences and staff cannot inflate conversions',async()=>{
  const f=setup(),cookie=await f.grant();
  await f.fetchPath(pdf,{headers:{cookie}});assert.equal(f.rows('SELECT * FROM field_sessions').length,0);
  await f.fetchPath(field,{headers:{cookie}});
  for(const extra of [{DNT:'1'},{'Sec-GPC':'1'},{Purpose:'prefetch'},{'Sec-Purpose':'prefetch;prerender'},{'User-Agent':'TelegramBot/1'},owner]){
    await f.fetchPath(pdf,{headers:{cookie,...extra}});
  }
  await f.fetchPath(pdf,{method:'HEAD',headers:{cookie}});
  f.bad();assert.equal((await f.fetchPath(pdf,{headers:{cookie}})).status,503);
  const r=f.rows('SELECT * FROM field_sessions')[0];assert.equal(r.pdf_at,null);assert.equal(r.html_at,null);
  assert.equal((await f.choice('on','','',{DNT:'1'})).headers.get('set-cookie'),null);
  assert.equal((await f.choice('on','','',{Origin:'https://elsewhere.example'})).status,403);
});

test('session expiry requires a new landing; 24-hour hard stop and 60-day reader expiry hold',async()=>{
  const f=setup(),cookie=await f.grant(),opts={headers:{cookie}};await f.fetchPath(field+x,opts);
  f.tick(1800);await f.fetchPath(pdf,opts);assert.equal(f.rows('SELECT pdf_at FROM field_sessions')[0].pdf_at,null);
  await f.fetchPath(field+tg,opts);
  for(let i=0;i<86;i++){f.tick(1000);await f.fetchPath(field+'card',opts);}
  f.tick(400);await f.fetchPath(field,opts);
  let r=f.rows('SELECT * FROM field_sessions ORDER BY started');assert.equal(r.length,3);
  assert.equal(r[1].source,'telegram');assert.equal(r[2].source,'direct');
  f.tick(61*86400);await f.fetchPath(field,opts);
  assert.equal(f.rows('SELECT * FROM field_readers').length,0);assert.equal(f.rows('SELECT * FROM field_sessions').length,0);
});

test('test consent, source anonymization, benefit route and erasure remain isolated',async()=>{
  const f=setup(),cookie=await f.grant('?qa=1');
  const url=field+'?qa=1&utm_source=private_input&utm_medium=raw&utm_campaign=the_soil_remembers&utm_content=secret';
  const opt={headers:{cookie}};await f.fetchPath(url,opt);await f.fetchPath(pdf+'?qa=1',opt);
  const sessions=f.rows('SELECT source,creative,pdf_at FROM field_sessions');assert.equal(sessions[0].source,'unattributed');assert.equal(sessions[0].creative,'');assert.ok(sessions[0].pdf_at);
  const csv=await f.fetchPath(privateReport+'.csv',{headers:owner});assert.equal((await csv.text()).trim().split(/\r?\n/).length,1);
  assert.equal((await f.fetchPath(field+'?utm_source=solflare&utm_medium=benefits&utm_campaign=first_cycle_pilot',opt)).headers.get('Location'),'/?utm_source=solflare&utm_medium=benefits&utm_campaign=first_cycle_pilot#offer');
  const stop=await f.choice('off','?qa=1',cookie,{'Sec-GPC':'1'});assert.equal(stop.status,303);
  assert.match(stop.headers.get('Set-Cookie'),/Max-Age=0/);
  assert.equal(f.rows('SELECT * FROM field_readers').length,0);assert.equal(f.rows('SELECT * FROM field_sessions').length,0);
  assert.equal(f.rows('SELECT * FROM field_private_daily').length,0);
});

test('report and CSV are owner-only, and storage failure leaves the field card available',async()=>{
  const f=setup();
  for(const p of [privateReport,privateReport+'.csv',field+'measured_sessions.csv']){
    assert.match((await f.fetchPath(p)).headers.get('Location'),/^\/signin-with-chatgpt\?return_to=/);
    assert.equal((await f.fetchPath(p,{headers:{...owner,'oai-authenticated-user-email':'other@fixture.example'}})).status,403);
  }
  f.env.DB=undefined;
  assert.match(await (await f.fetchPath(field)).text(),/temporarily unavailable/);
  assert.equal((await f.fetchPath(pdf)).status,200);
  assert.equal((await f.fetchPath(privateReport,{headers:owner})).status,503);
  assert.equal((await f.choice('on')).status,503);
});

test('campaign links retain allowlisted attribution through a card visit before consent',async()=>{
  const f=setup();
  const tagged=(await (await f.fetchPath(field+x)).text());
  assert.ok(tagged.includes('href="/field/01/card.html?utm_source=x&amp;utm_medium=organic_social&amp;utm_campaign=the_soil_remembers&amp;utm_content=fold"'));
  const card=await (await f.fetchPath(field+'card.html'+x)).text();
  assert.ok(card.includes('action="/field/01/privacy?utm_source=x&amp;utm_medium=organic_social&amp;utm_campaign=the_soil_remembers&amp;utm_content=fold"'));
  const supplied=await (await f.fetchPath(field+'?utm_source=unknown&amp;utm_content=private-note')).text();
  assert.equal(supplied.includes('private-note'),false);
  const first=await f.grant(x);
  const second=await f.choice('on',x,first);assert.equal(second.headers.get('set-cookie'),null);
});
