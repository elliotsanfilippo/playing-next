const base="http://127.0.0.1:9222";
const t=await(await fetch(base+"/json/new?about:blank",{method:"PUT"})).json();
const ws=new WebSocket(t.webSocketDebuggerUrl);
await new Promise((r,j)=>{ws.onopen=r;ws.onerror=j;setTimeout(()=>j(new Error("ws")),8000);});
let id=0;const p=new Map();
ws.onmessage=m=>{const g=JSON.parse(m.data);if(g.id&&p.has(g.id)){p.get(g.id)(g);p.delete(g.id);}};
const send=(m,q={})=>new Promise((res,rej)=>{const i=++id;const to=setTimeout(()=>rej(new Error("t")),30000);
 p.set(i,x=>{clearTimeout(to);res(x);});ws.send(JSON.stringify({id:i,method:m,params:q}));});
const ev=async e=>{const r=await send("Runtime.evaluate",{expression:e,awaitPromise:true,returnByValue:true});return r.result?.result?.value;};
const wait=ms=>new Promise(r=>setTimeout(r,ms));
await send("Page.enable");await send("Runtime.enable");
await send("Emulation.setDeviceMetricsOverride",{width:390,height:844,deviceScaleFactor:3,mobile:true});
await send("Page.navigate",{url:process.argv[2]});await wait(7000);
const out=await ev(`JSON.stringify([...document.images].map(i=>({
  src:i.currentSrc||i.src, natural:i.naturalWidth+'x'+i.naturalHeight,
  rendered:Math.round(i.getBoundingClientRect().width)+'x'+Math.round(i.getBoundingClientRect().height),
  loading:i.loading, hasDims:!!(i.getAttribute('width')||i.getAttribute('height')),
  srcset:!!i.srcset })))`);
console.log("\n──── IMAGES @ 390x844 dpr3 (iPhone-class) : "+process.argv[3]+" ────");
for(const i of JSON.parse(out||"[]")){
  const over = (()=>{const [nw]=i.natural.split('x').map(Number);const [rw]=i.rendered.split('x').map(Number);
    return rw>0? (nw/(rw*3)).toFixed(1)+"x css-px@3dpr" : "n/a";})();
  console.log("  natural "+i.natural.padEnd(11)+" rendered "+i.rendered.padEnd(9)+
    " loading="+String(i.loading).padEnd(6)+" dims="+(i.hasDims?"yes":"NO ")+" srcset="+(i.srcset?"yes":"no ")+
    "  oversize="+over);
  console.log("      "+i.src.replace(/^https?:\/\//,'').slice(0,100));
}
const vp=await ev(`JSON.stringify({backdrop:[...document.querySelectorAll('*')].filter(e=>{const s=getComputedStyle(e);return s.backdropFilter&&s.backdropFilter!=='none'}).length,
 blur:[...document.querySelectorAll('*')].filter(e=>{const s=getComputedStyle(e);return s.filter&&s.filter.includes('blur')}).length,
 fixed:[...document.querySelectorAll('*')].filter(e=>getComputedStyle(e).position==='fixed').length,
 anim:[...document.querySelectorAll('*')].filter(e=>{const s=getComputedStyle(e);return s.animationName&&s.animationName!=='none'}).length,
 svh:document.documentElement.innerHTML.includes('100vh')||document.documentElement.innerHTML.includes('dvh')})`);
console.log("\n  SAFARI-SENSITIVE CSS: "+vp);
ws.close();process.exit(0);
