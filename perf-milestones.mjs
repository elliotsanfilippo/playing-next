/* Guest-journey milestone timing: shell → DJ identity → Taking Requests → search usable */
const base="http://127.0.0.1:9222", URL_=process.argv[2], THROTTLE=process.argv[3]||"none", WAIT=+(process.argv[4]||12000);
const t=await(await fetch(base+"/json/new?about:blank",{method:"PUT"})).json();
const ws=new WebSocket(t.webSocketDebuggerUrl);
await new Promise((r,j)=>{ws.onopen=r;ws.onerror=j;setTimeout(()=>j(new Error("ws")),8000);});
let id=0;const pending=new Map();
ws.onmessage=(m)=>{const g=JSON.parse(m.data);if(g.id&&pending.has(g.id)){pending.get(g.id)(g);pending.delete(g.id);}};
const send=(m,p={})=>new Promise((res,rej)=>{const i=++id;const to=setTimeout(()=>rej(new Error("t "+m)),40000);
  pending.set(i,x=>{clearTimeout(to);res(x);});ws.send(JSON.stringify({id:i,method:m,params:p}));});
const ev=async e=>{const r=await send("Runtime.evaluate",{expression:e,awaitPromise:true,returnByValue:true});return r.result?.result?.value;};
const wait=ms=>new Promise(r=>setTimeout(r,ms));
await send("Page.enable");await send("Network.enable");await send("Runtime.enable");
await send("Network.clearBrowserCache");await send("Network.setCacheDisabled",{cacheDisabled:true});
const P={none:null,fast4g:{offline:false,latency:70,downloadThroughput:9000*1024/8,uploadThroughput:1500*1024/8},
  slow:{offline:false,latency:300,downloadThroughput:700*1024/8,uploadThroughput:200*1024/8}};
if(P[THROTTLE])await send("Network.emulateNetworkConditions",P[THROTTLE]);

/* Milestone recorder installed pre-navigation: samples the DOM every animation-frame-ish tick. */
await send("Page.addScriptToEvaluateOnNewDocument",{source:`
  window.__m={};
  const mark=(k)=>{ if(window.__m[k]==null) window.__m[k]=Math.round(performance.now()); };
  const probe=()=>{
    const txt=document.body?document.body.innerText:'';
    if(document.body && document.body.children.length>0) mark('shellInDom');
    if(txt && txt.trim().length>0) mark('anyText');
    if(/REQUESTS FOR/i.test(txt)) mark('djIdentity');
    if(/Taking requests|Requests unavailable|Requests are closed|not accepting/i.test(txt)) mark('availabilityState');
    const inp=document.querySelector('input[type="text"],input[type="search"],input:not([type="hidden"])');
    if(inp) mark('searchInputInDom');
    if(inp && !inp.disabled && !inp.readOnly) mark('searchEnabled');
    if(document.querySelector('img[src*="dj-profile-images"],img[alt*="profile" i]')) mark('profileImgTag');
  };
  probe(); setInterval(probe,16);
  document.addEventListener('DOMContentLoaded',probe);
  new PerformanceObserver(l=>{for(const e of l.getEntries()) window.__m.lcp=Math.round(e.startTime);})
    .observe({type:'largest-contentful-paint',buffered:true});
  new PerformanceObserver(l=>{for(const e of l.getEntries()) window.__m.fcp=Math.round(e.startTime);})
    .observe({type:'paint',buffered:true});
`});
await send("Page.navigate",{url:URL_});
await wait(WAIT);
const m=await ev("JSON.stringify(window.__m)");
const hydrated=await ev(`(()=>{const i=document.querySelector('input:not([type=hidden])');return i? 'input present':'no input';})()`);
console.log("\n──── GUEST JOURNEY MILESTONES ["+THROTTLE+"] ────");
const o=JSON.parse(m||"{}");
const order=["shellInDom","anyText","fcp","djIdentity","availabilityState","searchInputInDom","searchEnabled","profileImgTag","lcp"];
const nice={shellInDom:"page shell in DOM",anyText:"first text in DOM",fcp:"First Contentful Paint",
  djIdentity:"DJ identity visible (REQUESTS FOR …)",availabilityState:"availability state visible",
  searchInputInDom:"search box in DOM",searchEnabled:"search box usable (enabled)",
  profileImgTag:"profile image element",lcp:"Largest Contentful Paint"};
for(const k of order) if(o[k]!=null) console.log("   "+String(o[k]+"ms").padStart(8)+"   "+nice[k]);
console.log("   final DOM check: "+hydrated);
ws.close();process.exit(0);
