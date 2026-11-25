// First-party Field Card 01 measurement. Public reading and consent work without JavaScript.
const FIELD = '/field/01/';
const CAMPAIGN = 'the_soil_remembers';
const OFFER = '/?utm_source=solflare&utm_medium=benefits&utm_campaign=first_cycle_pilot#offer';
const DAY = 86400;
const RETENTION = 60 * DAY;
const IDLE = 1800;
const PDF_ASSET = '/edition-files/field-card-01.pdf';
const CREATIVE = /^(?:h[1-4]-b[1-4]-a[1-4]-c[1-4]|launch|field01|entry01|cover|fold|notebook|creator01|field01_launch)$/;
const MEDIA = {
  x: ['organic_social', 'organic'], telegram: ['community', 'owned_community', 'owned'],
  youtube: ['organic_video', 'organic_social', 'organic'], instagram: ['organic_social', 'organic', 'paid_social'],
  creator: ['creator', 'partner'], crm: ['email', 'push'], email: ['owned'], push: ['owned'],
  meta: ['paid_social'], solflare_wallet: ['partner_placement'], solflare_partner: ['partner_editorial', 'partner_placement'], dot: ['paid_display']
};
const BOT = /bot\b|bot[\/_-]|crawler|spider|preview|facebookexternalhit|whatsapp\/|headlesschrome|curl\/|wget\/|python-requests|python-urllib|potify-qa|google-inspectiontool/i;
const etDate = new Intl.DateTimeFormat('en-CA', {timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit'});
const dayOf = seconds => etDate.format(new Date(seconds * 1000));
const SENSITIVE_HEADERS = {
  'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff',
  'Vary': 'Cookie, DNT, Sec-GPC, Purpose, Sec-Purpose'
};
function response(body, type, status = 200, additional = {}) {
  return new Response(body, {status, headers: {...SENSITIVE_HEADERS, 'Content-Type': type, ...additional}});
}
function message(body, status, headers = {}) {
  return response(body, 'text/plain; charset=utf-8', status, headers);
}
function redirect(to, headers = {}) {
  return response(null, 'text/plain; charset=utf-8', 303, {Location: to, ...headers});
}
const escapeHtml = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[c]));
function single(params, key) {
  const values = params.getAll(key);
  return values.length === 1 ? values[0].toLowerCase() : '';
}
function isBenefits(params) {
  return single(params,'utm_source') === 'solflare' && single(params,'utm_medium') === 'benefits' && single(params,'utm_campaign') === 'first_cycle_pilot';
}
function attribution(params) {
  if (!['source','medium','campaign','content'].some(k => params.has('utm_'+k))) return ['direct','direct',''];
  const s = single(params,'utm_source'), m = single(params,'utm_medium'), c = single(params,'utm_content');
  if (single(params,'utm_campaign') !== CAMPAIGN || !Object.hasOwn(MEDIA,s) || !MEDIA[s].includes(m)) return ['unattributed','unattributed',''];
  return [s,m,CREATIVE.test(c) ? c : ''];
}
function cleanQuery(route, qa) {
  const p = new URLSearchParams();
  if (route[0] !== 'direct') {
    p.set('utm_source',route[0]); p.set('utm_medium',route[1]); p.set('utm_campaign',CAMPAIGN);
    if (route[2]) p.set('utm_content',route[2]);
  }
  if (qa) p.set('qa','1');
  return p.size ? '?' + p : '';
}
function isOwner(req, env) {
  const email = req.headers.get('oai-authenticated-user-email');
  return Boolean(env.FIELD_REPORT_OWNER_EMAIL && req.headers.get('oai-authenticated-user-id') &&
    email && email.trim().toLowerCase() === env.FIELD_REPORT_OWNER_EMAIL.trim().toLowerCase());
}
function traffic(req, url, env) {
  const privacy = req.headers.get('DNT') === '1' || req.headers.get('Sec-GPC') === '1';
  const purpose = ['Purpose','Sec-Purpose','X-Purpose'].map(h => req.headers.get(h) || '').join(' ');
  const ua = req.headers.get('User-Agent') || '';
  const qa = single(url.searchParams,'qa') === '1' || req.headers.get('X-Potify-Internal') === '1';
  const staff = isOwner(req,env);
  return {qa, privacy, excluded: privacy || (!qa && staff) || !ua || BOT.test(ua) || /pre(?:fetch|render)/i.test(purpose)};
}
function cookieName(qa) { return qa ? '__Secure-potify_field_qa' : '__Secure-potify_field'; }
function cookieFor(req, qa) {
  const entry = (req.headers.get('Cookie') || '').split(';').map(x => x.trim()).find(x => x.startsWith(cookieName(qa)+'='));
  const value = entry?.slice(cookieName(qa).length + 1) || '';
  return /^[a-f0-9]{64}$/.test(value) ? value : '';
}
function setCookie(qa, token, maxAge) {
  return cookieName(qa)+'='+token+'; Path='+FIELD+'; Max-Age='+maxAge+'; Secure; HttpOnly; SameSite=Lax';
}
function hex(buffer) {
  return [...new Uint8Array(buffer)].map(n => n.toString(16).padStart(2,'0')).join('');
}
async function digest(token) { return hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token))); }
function readOnlyPage(body, type, method, headers = {}) {
  return response(method === 'HEAD' ? null : body, type, 200, headers);
}
function fieldPath(path) {
  if ([FIELD,FIELD+'index',FIELD+'index.html'].includes(path)) return 'landing';
  if ([FIELD+'card',FIELD+'card/',FIELD+'card.html'].includes(path)) return 'html';
  if ([FIELD+'card.pdf',FIELD+'assets/Field_Card_01.pdf'].includes(path)) return 'pdf';
  if (path === FIELD+'community') return 'community';
  return '';
}
async function activeReader(db, token, qa, now) {
  if (!token) return null;
  const key = await digest(token);
  const row = await db.prepare('SELECT reader FROM field_readers WHERE reader=? AND qa=? AND expires>?').bind(key,+qa,now).first();
  return row?.reader || null;
}

const ACTIVE = 'reader=? AND seen>? AND started>?';
async function record(db, reader, qa, surface, now, route) {
  if (!reader) {
    if (!qa && surface !== 'community') {
      await db.prepare(`INSERT INTO field_private_daily(day_et,surface,responses) VALUES(?,?,1)
        ON CONFLICT(day_et,surface) DO UPDATE SET responses=responses+1`).bind(dayOf(now),surface).run();
    }
    return;
  }
  const live = [reader,now-IDLE,now-DAY];
  const statements = [];
  if (surface === 'landing') {
    // D1 executes the batch atomically. Concurrent tabs reuse the same current session.
    statements.push(db.prepare(`INSERT OR IGNORE INTO field_sessions(reader,started,seen,day_et,source,medium,creative)
      SELECT ?,?,?,?,?,?,? WHERE EXISTS (SELECT 1 FROM field_readers WHERE reader=? AND expires>?)
      AND NOT EXISTS (SELECT 1 FROM field_sessions WHERE ${ACTIVE})`)
      .bind(reader,now,now,dayOf(now),...route,reader,now,...live));
  }
  const update = {landing:'',html:', html_at=COALESCE(html_at,?)',pdf:', pdf_at=COALESCE(pdf_at,?)',
    community:', community_at=CASE WHEN html_at IS NOT NULL OR pdf_at IS NOT NULL THEN COALESCE(community_at,?) ELSE community_at END'}[surface];
  const extra = surface === 'landing' ? [] : [now];
  statements.push(db.prepare(`UPDATE field_sessions SET seen=MAX(seen,?)${update}
    WHERE reader=? AND started=(SELECT MAX(started) FROM field_sessions WHERE ${ACTIVE})
    AND EXISTS (SELECT 1 FROM field_readers WHERE reader=? AND expires>?)`)
    .bind(now,...extra,reader,...live,reader,now));
  await db.batch(statements);
}

function settings({mode, canForget, qa, route, notice}) {
  let words;
  if (mode === 'on') words = '<p class="measure-state">Optional measurement is on for this browser.</p>';
  else if (mode === 'unavailable') words = '<p class="measure-state">Measurement is temporarily unavailable. The field card still opens.</p>';
  else if (mode === 'excluded') words = '<p class="measure-state">Measurement is off for this visit.</p>';
  else words = '<p class="measure-state">Optional measurement is off.</p>';
  const action = FIELD+'privacy'+cleanQuery(route,qa);
  const button = (choice, label) => `<form method="post" action="${escapeHtml(action)}"><button type="submit" name="choice" value="${choice}">${label}</button></form>`;
  const info = '<p>If you allow measurement, POTIFY uses a first-party cookie to count visits, card deliveries and community-link opens by campaign source. Linked records expire after 60 days. Your field notes stay in your own copy. You can stop and erase this browser’s records here.</p>';
  if (mode === 'off') words += info + button('on','I’m 21 or older. Allow measurement');
  else if (mode === 'on') words += info;
  if (canForget) words += button('off','Stop and erase this browser’s records');
  if (qa) words += '<p>Test visit. This activity is excluded from campaign reports.</p>';
  return `<details id="reading-settings" class="settings"${notice?' open':''}><summary>Reading settings</summary><div class="measure-body">${words}<p>With measurement off, eligible page requests can contribute to anonymous totals.</p></div></details>`;
}
function fieldHtml(template, options) {
  let html = template;
  const query=cleanQuery(options.route,options.qa);
  if (query) {
    // A reader may choose measurement on the card. Carry only allowlisted attribution to the form.
    html=html.replace(/href="(\/field\/01\/(?:card(?:\.html)?)?)"/g,(_,path)=>'href="'+path+escapeHtml(query)+'"');
  }
  if (options.qa) html=html.replace(/href="(\/field\/01\/(?:assets\/Field_Card_01\.pdf|community))"/g,'href="$1?qa=1"');
  return html.replace('<!--READING_SETTINGS-->', settings(options));
}
async function privacy(req, url, db, flags, now) {
  const origin = req.headers.get('Origin'), site = req.headers.get('Sec-Fetch-Site');
  if (site === 'cross-site' || (origin ? origin !== url.origin : site !== 'same-origin')) return message('Use the reading settings on this site.',403);
  const strLength=Number(req.headers.get('Content-Length') || 0);
  if (!req.headers.get('Content-Type')?.startsWith('application/x-www-form-urlencoded') || strLength>128) return message('Invalid reading setting.',400);
  const reader=req.body?.getReader(); if (!reader) return message('Choose a reading setting.',400);
  const buffer = new Uint8Array(128); let length=0;
  while (true) {
    const {done,value} = await reader.read(); if (done) break;
    if (length+value.length>buffer.length) { await reader.cancel(); return message('Invalid reading setting.',400); }
    buffer.set(value,length); length+=value.length;
  }
  const params=new URLSearchParams(new TextDecoder().decode(buffer.subarray(0,length)));
  const choice=single(params,'choice');
  if (!['on','off'].includes(choice)) return message('Choose a reading setting.',400);
  const route=attribution(url.searchParams);
  const query=cleanQuery(route,flags.qa);
  const back=FIELD+query+(query?'&':'?')+'settings=1#reading-settings';
  const raw=cookieFor(req,flags.qa);
  if (choice==='off' && !raw) return redirect(back,{'Set-Cookie':setCookie(flags.qa,'',0)});
  if (choice==='on' && flags.excluded) return redirect(back);
  try {
    if (choice==='off') {
      const key=await digest(raw);
      await db.batch([db.prepare('DELETE FROM field_sessions WHERE reader=?').bind(key),db.prepare('DELETE FROM field_readers WHERE reader=? AND qa=?').bind(key,+flags.qa)]);
      return redirect(back,{'Set-Cookie':setCookie(flags.qa,'',0)});
    }
    if (await activeReader(db,raw,flags.qa,now)) return redirect(back);
    const token=hex(crypto.getRandomValues(new Uint8Array(32)));
    await db.prepare('INSERT INTO field_readers(reader,expires,qa) VALUES(?,?,?)').bind(await digest(token),now+RETENTION,+flags.qa).run();
    return redirect(back,{'Set-Cookie':setCookie(flags.qa,token,RETENTION)});
  } catch {
    return message('Your reading setting could not be saved. Return to the field note and retry.',503);
  }
}
function earliestDay(now) {
  const d=new Date(dayOf(now)+'T12:00:00Z'); d.setUTCDate(d.getUTCDate()-27); return d.toISOString().slice(0,10);
}
const METRICS=`COUNT(*) AS sessions,
  COALESCE(SUM(CASE WHEN html_at IS NOT NULL OR pdf_at IS NOT NULL THEN 1 ELSE 0 END),0) AS delivered,
  COUNT(pdf_at) AS pdf, COUNT(community_at) AS community`;
async function report(req,url,env,now) {
  if (!req.headers.get('oai-authenticated-user-id')) return redirect('/signin-with-chatgpt?return_to='+encodeURIComponent(url.pathname));
  if (!isOwner(req,env)) return message('This report is restricted to the POTIFY reporting account.',403);
  const first=earliestDay(now), last=dayOf(now);
  const where=`FROM field_sessions s JOIN field_readers r ON r.reader=s.reader
    WHERE r.qa=0 AND r.expires>? AND s.day_et BETWEEN ? AND ?`;
  let data;
  try {
    const db=env.DB;
    data=await db.batch([
      db.prepare(`SELECT COUNT(DISTINCT s.reader) AS browsers, ${METRICS} ${where}`).bind(now,first,last),
      db.prepare(`SELECT day_et,source,medium,creative, ${METRICS} ${where}
        GROUP BY day_et,source,medium,creative ORDER BY day_et DESC,source,medium,creative`).bind(now,first,last),
      db.prepare(`SELECT surface,SUM(responses) AS responses FROM field_private_daily
        WHERE day_et BETWEEN ? AND ? GROUP BY surface`).bind(first,last)
    ]);
  } catch { return message('The reporting database is unavailable. Try again shortly.',503); }
  const [summary,groups,privateResponses]=data.map(r => r.results);
  if (url.pathname.endsWith('.csv')) {
    const scorecard=url.pathname.endsWith('/measured_sessions.csv');
    const lines=scorecard
      ? [['session_start_date_et','source','medium','traffic_creative','experiment_id','variant_id','landing_session','field_card_delivered','community_outbound']]
      : [['date_et','source','medium','creative','landing_session','field_card_delivered','pdf_delivered_session','community_outbound']];
    for (const g of groups) {
      lines.push(scorecard ? [g.day_et,g.source,g.medium,g.creative,'','',g.sessions,g.delivered,g.community]
        : [g.day_et,g.source,g.medium,g.creative,g.sessions,g.delivered,g.pdf,g.community]);
    }
    // All text cells originate from the attribution allowlist or server dates.
    return readOnlyPage(lines.map(row=>row.join(',')).join('\r\n')+'\r\n','text/csv; charset=utf-8',req.method,{'Content-Disposition':scorecard?'attachment; filename="measured_sessions.csv"':'attachment; filename="POTIFY_Field_Conversions.csv"','X-Robots-Tag':'noindex, nofollow'});
  }
  const t=summary[0], rate=t.sessions ? (100*t.delivered/t.sessions).toFixed(1)+'%' : '—';
  const rows=groups.map(g => `<tr><td>${escapeHtml(g.day_et)}</td><td>${escapeHtml(g.source)} / ${escapeHtml(g.medium)}<br><small>${escapeHtml(g.creative)}</small></td><td>${g.sessions}</td><td>${g.delivered}</td><td>${g.pdf}</td><td>${g.community}</td></tr>`).join('');
  const priv=Object.fromEntries(privateResponses.map(r=>[r.surface,r.responses]));
  const html=`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Field Card 01 conversions · POTIFY</title><link rel="stylesheet" href="/field/01/assets/field.css"><style>main{max-width:60rem;margin:auto;padding:1.4rem}h1{font:clamp(2rem,6vw,3rem)/1.1 var(--serif)}.numbers{display:grid;grid-template-columns:repeat(auto-fit,minmax(9rem,1fr));gap:.8rem;margin:1rem 0}dt{font-size:.95rem}dd{margin:0;font:2rem var(--serif)}.numbers div{border-top:1px solid var(--line);padding:.5rem 0}.pan{overflow-x:auto}table{width:100%;border-collapse:collapse}th,td{text-align:left;padding:.45rem;border-bottom:1px solid var(--line);vertical-align:top}small{overflow-wrap:anywhere}</style></head><body><main><p>POTIFY · Private report</p><h1>Field Card 01 conversions</h1><p>${first} through ${last} · Eastern time. Today is still open.</p><dl class="numbers"><div><dt>Consenting browsers</dt><dd>${t.browsers}</dd></div><div><dt>Landing sessions</dt><dd>${t.sessions}</dd></div><div><dt>Card deliveries</dt><dd>${t.delivered}</dd></div><div><dt>Delivery rate</dt><dd>${rate}</dd></div><div><dt>Sessions with a PDF</dt><dd>${t.pdf}</dd></div><div><dt>Community-link opens after delivery</dt><dd>${t.community}</dd></div></dl><p>One conversion per consenting session when the server serves the HTML card or full PDF. Repeat opens count once. The source is the first campaign link in that session.</p><p><a href="/field/01/report.csv">Download daily results by source and creative (CSV)</a> · <a href="/field/01/measured_sessions.csv">Download for the campaign scorecard</a></p><h2>Campaign traffic</h2><div class="pan"><table><thead><tr><th>Date</th><th>Source / medium / creative</th><th>Landings</th><th>Delivered</th><th>PDF</th><th>Community</th></tr></thead><tbody>${rows || '<tr><td colspan="6">No measured sessions in this window.</td></tr>'}</tbody></table></div><h2>Anonymous requests</h2><p>Landing ${priv.landing||0} · HTML card ${priv.html||0} · PDF ${priv.pdf||0}. These are request totals. Repeat requests can add to them. They are excluded from the delivery rate.</p><p>Coverage begins with this release. Earlier traffic is unmeasured. Test traffic, identifiable automated requests and privacy signals are excluded. A server delivery does not establish a read, saved file, purchase or partner redemption.</p></main></body></html>`;
  return readOnlyPage(html,'text/html; charset=utf-8',req.method,{'X-Robots-Tag':'noindex, nofollow'});
}

export function createFieldWorker(templates, clock = () => Math.floor(Date.now()/1000)) {
  let pruneAfter=0;
  async function prune(db,now) {
    if (!db || now<pruneAfter) return;
    pruneAfter=now+3600;
    try {
      await db.batch([
        db.prepare('DELETE FROM field_readers WHERE expires<=?').bind(now),
        db.prepare('DELETE FROM field_private_daily WHERE day_et<?').bind(dayOf(now-RETENTION))
      ]);
    } catch { pruneAfter=0; console.warn("Field retention cleanup is temporarily unavailable."); }
  }
  return {
    async fetch(req,env,ctx) {
      const url=new URL(req.url);
      const path=url.pathname;
      if (path.startsWith('/premiere/buds/v1/') && ['GET','HEAD'].includes(req.method)) {
        const asset=await env.ASSETS.fetch(req);
        const headers=new Headers(asset.headers);
        headers.set('Access-Control-Allow-Origin','*');
        return new Response(asset.body,{status:asset.status,statusText:asset.statusText,headers});
      }
      if (path==='/assets/under-the-first-light.mp3') {
        return Response.redirect(new URL('/assets/the-soil-remembers-grow-room.mp3',url),307);
      }
      if (path==='/field/01') return redirect(FIELD+url.search);
      if (!path.startsWith(FIELD)) return env.ASSETS.fetch(req);
      if (path===FIELD+'report' || path===FIELD+'report.csv' || path===FIELD+'measured_sessions.csv') {
        if (!['GET','HEAD'].includes(req.method)) return message('Use GET.',405,{Allow:'GET, HEAD'});
        if (isOwner(req,env)) await prune(env.DB,clock());
        return report(req,url,env,clock());
      }
      const flags=traffic(req,url,env), now=clock(), db=env.DB;
      if (path===FIELD+'privacy') return req.method==='POST' ? privacy(req,url,db,flags,now) : message('Use the reading settings form.',405,{Allow:'POST'});
      const surface=fieldPath(path);
      if (!surface) return env.ASSETS.fetch(req);
      if (!['GET','HEAD'].includes(req.method)) return message('Use GET.',405,{Allow:'GET, HEAD'});
      if (isBenefits(url.searchParams)) return redirect(OFFER);
      const raw=cookieFor(req,flags.qa), route=attribution(url.searchParams);
      let reader=null, available=Boolean(db);
      if (raw && available && !flags.excluded) {
        try { reader=await activeReader(db,raw,flags.qa,now); } catch { available=false; }
      }
      let res;
      if (surface==='landing' || surface==='html') {
        const mode=flags.excluded?'excluded':!available?'unavailable':reader?'on':'off';
        const text=fieldHtml(surface==='landing'?templates.landing:templates.card,
          {mode,canForget:Boolean(raw),qa:flags.qa,route,notice:url.searchParams.get('settings')==='1'});
        res=readOnlyPage(text,'text/html; charset=utf-8',req.method);
      } else if (surface==='pdf') {
        const target=new URL(PDF_ASSET,url.origin);
        // Serve one complete PDF response, also when mobile readers request its first byte range.
        try {
          const asset=await env.ASSETS.fetch(new Request(target,{method:'GET'}));
          if (asset.status!==200 || !/^application\/pdf\b/i.test(asset.headers.get('Content-Type') || '')) throw new Error('Unavailable PDF');
          const bytes=await asset.arrayBuffer();
          if (bytes.byteLength<5 || new TextDecoder().decode(bytes.slice(0,5))!=='%PDF-') throw new Error('Invalid PDF');
          res=readOnlyPage(bytes,'application/pdf',req.method,{'Content-Length':String(bytes.byteLength),'Content-Disposition':'inline; filename="POTIFY_Field_Card_01.pdf"'});
        } catch { return message('The field-card PDF is temporarily unavailable.',503); }
      } else res=redirect('https://x.com/potify_project');
      if (req.method==='GET' && !flags.excluded && available) {
        // Telemetry outages must not block the reader's successful content response.
        try { await record(db,reader,flags.qa,surface,now,route); }
        catch { console.warn("A field measurement write was unavailable."); }
        if (ctx?.waitUntil) ctx.waitUntil(prune(db,now)); else await prune(db,now);
      }
      return res;
    }
  };
}
