/* Production performance measurement via CDP. Read-only. Real transfer sizes from network events. */
const base = "http://127.0.0.1:9222";
const URL_ = process.argv[2], LABEL = process.argv[3] || URL_, THROTTLE = process.argv[4] || "none";
const WAITMS = +(process.argv[5] || 0) || (THROTTLE === "slow" ? 16000 : THROTTLE === "fast4g" ? 11000 : 8000);
const WARM = process.argv[6] === "warm";

const t = await (await fetch(base + "/json/new?about:blank", { method: "PUT" })).json();
const ws = new WebSocket(t.webSocketDebuggerUrl);
await new Promise((r,j)=>{ws.onopen=r;ws.onerror=j;setTimeout(()=>j(new Error("ws")),8000);});
let id=0; const pending=new Map();
const reqs=new Map();   // requestId -> record
ws.onmessage=(m)=>{const g=JSON.parse(m.data);
  if(g.id&&pending.has(g.id)){pending.get(g.id)(g);pending.delete(g.id);return;}
  const p=g.params;
  if(g.method==="Network.requestWillBeSent"){
    reqs.set(p.requestId,{url:p.request.url,method:p.request.method,type:p.type||"",start:p.timestamp,
      init:p.initiator?.type,end:null,size:0,status:null,mime:"",fromCache:false,ttfb:null,proto:""});}
  else if(g.method==="Network.responseReceived"){const r=reqs.get(p.requestId); if(r){r.status=p.response.status;
      r.mime=p.response.mimeType; r.proto=p.response.protocol||"";
      r.fromCache=p.response.fromDiskCache||p.response.fromPrefetchCache||false;
      const tm=p.response.timing; if(tm) r.ttfb=Math.round(tm.receiveHeadersEnd);
      r.hdr=p.response.headers||{};}}
  else if(g.method==="Network.loadingFinished"){const r=reqs.get(p.requestId); if(r){r.end=p.timestamp; r.size=p.encodedDataLength||0;}}
  else if(g.method==="Network.loadingFailed"){const r=reqs.get(p.requestId); if(r){r.end=p.timestamp; r.failed=p.errorText;}}
};
const send=(m,params={})=>new Promise((res,rej)=>{const i=++id;
  const to=setTimeout(()=>rej(new Error("timeout "+m)),40000);
  pending.set(i,(x)=>{clearTimeout(to);res(x);});ws.send(JSON.stringify({id:i,method:m,params}));});
const ev=async(e)=>{const r=await send("Runtime.evaluate",{expression:e,awaitPromise:true,returnByValue:true});return r.result?.result?.value;};
const wait=(ms)=>new Promise(r=>setTimeout(r,ms));

await send("Page.enable"); await send("Network.enable"); await send("Runtime.enable");
if(!WARM){ await send("Network.clearBrowserCache"); await send("Network.setCacheDisabled",{cacheDisabled:true}); }
else { await send("Network.setCacheDisabled",{cacheDisabled:false}); }

const P={none:null,
  fast4g:{offline:false,latency:70,downloadThroughput:9000*1024/8,uploadThroughput:1500*1024/8},
  slow:{offline:false,latency:300,downloadThroughput:700*1024/8,uploadThroughput:200*1024/8}};
if(P[THROTTLE]) await send("Network.emulateNetworkConditions",P[THROTTLE]);

await send("Page.addScriptToEvaluateOnNewDocument",{source:`
  window.__v={lcp:0,cls:0,lt:0,ltms:0,lcpEl:''};
  new PerformanceObserver(l=>{for(const e of l.getEntries()){window.__v.lcp=e.startTime;
    window.__v.lcpEl=(e.element?e.element.tagName+(e.element.className?'.'+String(e.element.className).slice(0,60):''):e.url||'');}})
    .observe({type:'largest-contentful-paint',buffered:true});
  new PerformanceObserver(l=>{for(const e of l.getEntries())if(!e.hadRecentInput)window.__v.cls+=e.value;})
    .observe({type:'layout-shift',buffered:true});
  new PerformanceObserver(l=>{for(const e of l.getEntries()){window.__v.lt++;window.__v.ltms+=e.duration;}})
    .observe({type:'longtask',buffered:true});`});

if(WARM){ await send("Page.navigate",{url:URL_}); await wait(6000); reqs.clear(); }
const t0=Date.now();
await send("Page.navigate",{url:URL_});
await wait(WAITMS);

const nav=await ev(`(()=>{const n=performance.getEntriesByType('navigation')[0];if(!n)return null;
  return{ttfb:Math.round(n.responseStart),reqStart:Math.round(n.requestStart),domInt:Math.round(n.domInteractive),
   dcl:Math.round(n.domContentLoadedEventEnd),load:Math.round(n.loadEventEnd),transfer:n.transferSize,decoded:n.decodedBodySize};})()`);
const paint=await ev(`(()=>{const o={};for(const p of performance.getEntriesByType('paint'))o[p.name]=Math.round(p.startTime);return o;})()`);
const v=await ev(`({lcp:Math.round(window.__v.lcp),cls:+window.__v.cls.toFixed(4),lt:window.__v.lt,ltms:Math.round(window.__v.ltms),el:window.__v.lcpEl})`);

const list=[...reqs.values()].filter(r=>r.end);
const t00=Math.min(...list.map(r=>r.start));
for(const r of list){r.s=Math.round((r.start-t00)*1000);r.e=Math.round((r.end-t00)*1000);}
const total=list.reduce((s,r)=>s+r.size,0);

console.log("\n════════ "+LABEL+"   ["+THROTTLE+(WARM?", WARM":", COLD")+"] ════════");
console.log("  TTFB             "+nav.ttfb+" ms");
console.log("  FCP              "+(paint['first-contentful-paint']??'-')+" ms");
console.log("  LCP              "+v.lcp+" ms   <"+v.el+">");
console.log("  DOMContentLoaded "+nav.dcl+" ms");
console.log("  load             "+nav.load+" ms");
console.log("  CLS              "+v.cls);
console.log("  long tasks       "+v.lt+" ("+v.ltms+" ms main-thread blocked)");
console.log("  requests         "+list.length+"   total transfer "+(total/1024).toFixed(1)+" KB");

const cat=(r)=>{const m=r.mime||"";if(/javascript/.test(m))return"JS";if(/css/.test(m))return"CSS";
  if(/font/.test(m))return"FONT";if(/image|svg/.test(m))return"IMG";if(/html/.test(m))return"HTML";
  if(/json/.test(m))return"JSON/API";return m.split(";")[0]||"other";};
const g={};for(const r of list){const k=cat(r);g[k]=g[k]||{n:0,s:0};g[k].n++;g[k].s+=r.size;}
console.log("\n  BY TYPE");
for(const[k,x]of Object.entries(g).sort((a,b)=>b[1].s-a[1].s))
  console.log("    "+k.padEnd(10)+String(x.n).padStart(3)+" reqs "+(x.s/1024).toFixed(1).padStart(9)+" KB");

const host=(u)=>{try{return new URL(u).host}catch{return"?"}};
const own=host(URL_); const th={};
for(const r of list){const h=host(r.url); if(h===own)continue;
  th[h]=th[h]||{n:0,s:0,first:1e9,last:0}; th[h].n++; th[h].s+=r.size;
  th[h].first=Math.min(th[h].first,r.s); th[h].last=Math.max(th[h].last,r.e);}
if(Object.keys(th).length){console.log("\n  THIRD PARTY (real transfer)");
  for(const[h,x]of Object.entries(th).sort((a,b)=>b[1].s-a[1].s))
    console.log("    "+h.padEnd(36)+String(x.n).padStart(2)+" "+(x.s/1024).toFixed(1).padStart(8)+" KB  "+x.first+"→"+x.last+"ms");}

console.log("\n  WATERFALL (all, by start)");
for(const r of list.sort((a,b)=>a.s-b.s))
  console.log("    "+String(r.s).padStart(5)+"→"+String(r.e).padStart(5)+"ms "+String(r.e-r.s).padStart(5)+"ms "+
    (r.size/1024).toFixed(1).padStart(8)+"KB "+String(r.status??r.failed??"").padEnd(4)+" "+cat(r).padEnd(8)+
    " "+r.url.replace(/^https?:\/\//,"").slice(0,78));
ws.close(); process.exit(0);
