import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  FileText, Film, MapPin, Calendar, Users, Wrench, Building2, Search, Plus, X,
  Check, Trash2, ChevronLeft, ChevronRight, ChevronDown, Upload, Camera, Link2, Image as ImageIcon, PenLine, Eraser, Undo2, Crosshair, ZoomIn, ZoomOut,
  Inbox, Sun, Sunrise, Sunset, CloudSun, Cloud, CloudRain, CloudSnow, CloudFog,
  CloudDrizzle, CloudLightning, Navigation, Phone, Mail, Volume2, Settings,
  MoonStar, SunMedium, Sparkles, Clock, ListChecks, Compass, Maximize2, CloudDownload, Home, Printer,
  ArrowLeft, ArrowRight, Copy, Send,
} from "lucide-react";
import { get as idbGet, set as idbSet, del as idbDel, keys as idbKeys, createStore as idbCreateStore } from "idb-keyval";

/* DP DECK — a private prep-and-shoot deck for one film. — Web V1. Scene number is the spine. Two PDFs are the backbone. */

/* ---- theme: Rams-calm. swap palette in place, re-render from App -- */
const DARK = {
  bg0:"#121317", bg1:"#191A1F", bg2:"#212329", bg3:"#292C34", panel:"#15161A",
  line:"#2A2D34", line2:"#383C45",
  t0:"#ECEDEF", t1:"#A6ABB4", t2:"#6B7079",
  accent:"#E0A33E", accentSoft:"#E0A33E26",
  ink:"#E0A33E", day:"#6FB0DE", night:"#7B82CF", dusk:"#C98AA0",
  ok:"#74B98C", warn:"#D8975A", danger:"#CE6B60",
  intC:"#C98F63", extC:"#6FB0DE", scrim:"#000000c2",
};
const LIGHT = {
  bg0:"#ECECE8", bg1:"#FBFBF9", bg2:"#FFFFFF", bg3:"#F2F2EE", panel:"#F4F4F0",
  line:"#E3E3DD", line2:"#D2D2C9",
  t0:"#1A1B1E", t1:"#54575E", t2:"#8B8F96",
  accent:"#BE7A1E", accentSoft:"#BE7A1E1f",
  ink:"#BE7A1E", day:"#3C82B8", night:"#5A61B2", dusk:"#B06A82",
  ok:"#3E9B62", warn:"#B0742E", danger:"#C05246",
  intC:"#A06A38", extC:"#3C82B8", scrim:"#3a3a36aa",
};
const c = { ...DARK };
const applyTheme = (mode) => Object.assign(c, mode === "light" ? LIGHT : DARK);

const UI = `-apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif`;
const MONO = `ui-monospace, "SF Mono", Menlo, monospace`;

/* ---- domain ------------------------------------------------------ */
const SLUGS = ["INT", "EXT", "INT/EXT"];
const DAYNIGHT = ["DAY", "NIGHT", "DUSK", "DAWN"];
const STATUS = [
  { k:"todo", label:"To prep", color:"#6B7079" },
  { k:"scouted", label:"Scouted", color:"#6FB0DE" },
  { k:"ready", label:"Ready", color:"#74B98C" },
  { k:"shot", label:"Shot", color:"#9aa0a8" },
];
const DEPTS = [ { k:"camera", label:"Camera" }, { k:"grip", label:"Grip" }, { k:"electric", label:"Electric" } ];

/* at-a-glance color coding for slug + time of day (the lighting-relevant flags) */
const slugColor=s=>s==="EXT"?c.extC:s==="INT/EXT"?"#C98AA0":c.intC;
const dnColor=d=>({DAY:"#E6B84C",NIGHT:c.night,DUSK:"#C98AA0",DAWN:"#79C0C7"}[d]||c.t2);
function Tag({label,color,big}){if(!label)return null;return <span style={{fontFamily:MONO,fontSize:big?12:10.5,fontWeight:700,letterSpacing:"0.04em",color,background:color+"22",border:`1px solid ${color}99`,borderRadius:6,padding:big?"3px 9px":"2px 7px",whiteSpace:"nowrap",lineHeight:1.3}}>{label}</span>;}

/* SUN MATH (SunCalc port, MIT) */
const PI=Math.PI, rad=PI/180, dayMs=864e5, J1970=2440588, J2000=2451545;
const toJulian=d=>d.valueOf()/dayMs-0.5+J1970;
const fromJulian=j=>new Date((j+0.5-J1970)*dayMs);
const toDays=d=>toJulian(d)-J2000;
const e0=rad*23.4397;
const ra=(l,b)=>Math.atan2(Math.sin(l)*Math.cos(e0)-Math.tan(b)*Math.sin(e0),Math.cos(l));
const dec=(l,b)=>Math.asin(Math.sin(b)*Math.cos(e0)+Math.cos(b)*Math.sin(e0)*Math.sin(l));
const azS=(H,phi,d)=>Math.atan2(Math.sin(H),Math.cos(H)*Math.sin(phi)-Math.tan(d)*Math.cos(phi));
const alt=(H,phi,d)=>Math.asin(Math.sin(phi)*Math.sin(d)+Math.cos(phi)*Math.cos(d)*Math.cos(H));
const sidereal=(D,lw)=>rad*(280.16+360.9856235*D)-lw;
const sma=D=>rad*(357.5291+0.98560028*D);
const ecl=M=>{const C=rad*(1.9148*Math.sin(M)+0.02*Math.sin(2*M)+0.0003*Math.sin(3*M));return M+C+rad*102.9372+PI;};
const sc=D=>{const M=sma(D),L=ecl(M);return {dec:dec(L,0),ra:ra(L,0)};};
function sunPos(date,lat,lng){const lw=rad*-lng,phi=rad*lat,D=toDays(date),s=sc(D),H=sidereal(D,lw)-s.ra;return {az:azS(H,phi,s.dec),alt:alt(H,phi,s.dec)};}
const J0=0.0009;
const aT=(Ht,lw,n)=>J0+(Ht+lw)/(2*PI)+n;
const stJ=(ds,M,L)=>J2000+ds+0.0053*Math.sin(M)-0.0069*Math.sin(2*L);
const hA=(h,phi,d)=>Math.acos((Math.sin(h)-Math.sin(phi)*Math.sin(d))/(Math.cos(phi)*Math.cos(d)));
const setJ=(h,lw,phi,d,n,M,L)=>stJ(aT(hA(h,phi,d),lw,n),M,L);
const ST=[[-0.833,"sunrise","sunset"],[-6,"dawn","dusk"],[6,"goldEnd","goldStart"]];
function sunTimes(date,lat,lng){
  const lw=rad*-lng,phi=rad*lat,D=toDays(date),n=Math.round(D-J0-lw/(2*PI)),ds=aT(0,lw,n),
    M=sma(ds),L=ecl(M),d=dec(L,0),Jn=stJ(ds,M,L);
  const r={noon:fromJulian(Jn)};
  for(const [a,ri,se] of ST){const h=a*rad,Js=setJ(h,lw,phi,d,n,M,L);r[ri]=fromJulian(Jn-(Js-Jn));r[se]=fromJulian(Js);}
  return r;
}
function tzOff(date,tz){try{const p=new Intl.DateTimeFormat("en-US",{timeZone:tz,hour12:false,year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",second:"2-digit"}).formatToParts(date).reduce((a,x)=>((a[x.type]=x.value),a),{});const u=Date.UTC(p.year,p.month-1,p.day,p.hour==="24"?0:p.hour,p.minute,p.second);return Math.round((u-date.getTime())/6e4);}catch{return 0;}}
function dayNoonUTC(ymd){const [y,m,d]=ymd.split("-").map(Number);return new Date(Date.UTC(y,m-1,d,12));}
function localToAbs(ymd,h,mn,tz){const [y,m,d]=ymd.split("-").map(Number);const off=tzOff(new Date(Date.UTC(y,m-1,d,12)),tz);return new Date(Date.UTC(y,m-1,d,h,mn)-off*6e4);}
function fmtT(date,tz){if(!date||isNaN(date))return "--:--";try{return new Intl.DateTimeFormat("en-GB",{timeZone:tz,hour:"2-digit",minute:"2-digit",hour12:false}).format(date);}catch{return "--:--";}}
function tMin(date,tz){if(!date||isNaN(date))return null;const s=fmtT(date,tz);if(s==="--:--")return null;const [h,m]=s.split(":").map(Number);return h*60+m;}
const CARD=["N","NNE","NE","ENE","E","ESE","SE","SSE","S","SSW","SW","WSW","W","WNW","NW","NNW"];
function azC(a){let d=(a*180/PI+180)%360;if(d<0)d+=360;return {deg:d,card:CARD[Math.round(d/22.5)%16]};}
function haversineKm(aLat,aLng,bLat,bLng){const R=6371,t=PI/180,dLa=(bLat-aLat)*t,dLo=(bLng-aLng)*t;const s=Math.sin(dLa/2)**2+Math.cos(aLat*t)*Math.cos(bLat*t)*Math.sin(dLo/2)**2;return 2*R*Math.asin(Math.sqrt(s));}

/* ---- weather (Open-Meteo, keyless) ------------------------------- */
function wxMeta(code){
  if(code===0)return {Icon:Sun,label:"Clear"};
  if(code<=2)return {Icon:CloudSun,label:"Partly cloudy"};
  if(code===3)return {Icon:Cloud,label:"Overcast"};
  if(code===45||code===48)return {Icon:CloudFog,label:"Fog"};
  if(code>=51&&code<=57)return {Icon:CloudDrizzle,label:"Drizzle"};
  if(code>=61&&code<=67)return {Icon:CloudRain,label:"Rain"};
  if(code>=71&&code<=77)return {Icon:CloudSnow,label:"Snow"};
  if(code>=80&&code<=82)return {Icon:CloudRain,label:"Showers"};
  if(code>=85&&code<=86)return {Icon:CloudSnow,label:"Snow showers"};
  if(code>=95)return {Icon:CloudLightning,label:"Storm"};
  return {Icon:Cloud,label:"—"};
}

/* STORAGE (IndexedDB via idb-keyval, in-memory fallback) + image cache */
/* Local-dev reimplementation of the claude.ai window.storage shim, on IndexedDB.
   Same async interface (get/set/del, plus list) and same keys: pb:project,
   pb:img:{id}, pb:sketch:{id}, pb:scriptink:{number}, pb:scriptpdf, pb:scriptpdfname.
   Values (objects, data-URL strings, base64) persist directly via structured clone.
   Falls back to an in-memory Map if IndexedDB is unavailable. */
const mem=new Map();
const idbStore=(()=>{try{return (typeof indexedDB!=="undefined")?idbCreateStore("dpdeck","kv"):null;}catch{return null;}})();
const HAS=!!idbStore;
const store={
  async get(k){try{if(idbStore){const v=await idbGet(k,idbStore);return v===undefined?null:v;}return mem.has(k)?mem.get(k):null;}catch{return mem.has(k)?mem.get(k):null;}},
  async set(k,v){try{if(idbStore){await idbSet(k,v,idbStore);return true;}mem.set(k,v);return true;}catch{mem.set(k,v);return false;}},
  async del(k){try{if(idbStore)await idbDel(k,idbStore);mem.delete(k);}catch{mem.delete(k);}},
  async list(){try{if(idbStore)return await idbKeys(idbStore);return [...mem.keys()];}catch{return [...mem.keys()];}},
};
const imgCache=new Map();
async function putImage(dataUrl){const id=uid();imgCache.set(id,dataUrl);await store.set("pb:img:"+id,dataUrl);return id;}

/* lossless full backup/restore (everything under pb:*) for never-lose-data + cross-device */
function downloadJSON(filename,obj){const blob=new Blob([JSON.stringify(obj)],{type:"application/json"});const u=URL.createObjectURL(blob);const a=document.createElement("a");a.href=u;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),1500);}
async function exportFullBackup(){
  // Selective: only what the project references. Excludes device-local secrets (pb:aikey,
  // pb:r2key) and orphaned images so backups/sync stay lean and never leak keys.
  const p=await store.get("pb:project")||{};
  const data={"pb:project":p};
  const imgIds=new Set();
  const addRefs=arr=>{for(const r of arr||[])if(typeof r==="string"&&!isImgUrl(r))imgIds.add(r);};
  for(const s of p.scenes||[])addRefs(s.refs);
  addRefs(p.look);
  for(const l of p.locations||[]){addRefs(l.images);addRefs(l.plans);if(l.imgId&&!isImgUrl(l.imgId))imgIds.add(l.imgId);}
  const sketchIds=new Set();
  for(const s of p.scenes||[])for(const id of s.sketches||[])sketchIds.add(id);
  for(const id of sketchIds){const sk=await store.get("pb:sketch:"+id);if(sk){data["pb:sketch:"+id]=sk;if(sk.bgImgId&&!isImgUrl(sk.bgImgId))imgIds.add(sk.bgImgId);}}
  for(const id of imgIds){const v=await store.get("pb:img:"+id);if(v)data["pb:img:"+id]=v;}
  for(const k of (await store.list())){if(String(k).startsWith("pb:scriptink:"))data[k]=await store.get(k);}
  const pdf=await store.get("pb:scriptpdf");if(pdf){data["pb:scriptpdf"]=pdf;const n=await store.get("pb:scriptpdfname");if(n)data["pb:scriptpdfname"]=n;}
  return {dpdeckBackup:1,ts:Date.now(),data};
}
async function importFullBackup(obj){if(!obj||obj.dpdeckBackup!==1||!obj.data)throw new Error("Not a DP Deck backup file.");for(const [k,v] of Object.entries(obj.data)){await store.set(k,v);if(String(k).startsWith("pb:img:"))imgCache.set(k.slice(7),v);}}

/* ---- utils ------------------------------------------------------- */
const uid=()=>Math.random().toString(36).slice(2,9)+Date.now().toString(36).slice(-3);
const isImgUrl=s=>typeof s==="string"&&/^https?:\/\//.test(s.trim());
const toUrlArr=x=>!x?[]:(Array.isArray(x)?x:[x]).map(u=>String(u).trim()).filter(isImgUrl);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const todayISO=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;};
const numKey=s=>(s||"").toUpperCase().replace(/\s+/g,"");
function cmpNum(a,b){return (a||"").localeCompare(b||"",undefined,{numeric:true,sensitivity:"base"});}

function downscale(file,max=1600,q=0.82){
  return new Promise((res,rej)=>{
    const r=new FileReader();
    r.onload=()=>{const img=new Image();img.onload=()=>{let w=img.width,h=img.height;if(w>h&&w>max){h=h*max/w;w=max;}else if(h>max){w=w*max/h;h=max;}const cv=document.createElement("canvas");cv.width=w;cv.height=h;cv.getContext("2d").drawImage(img,0,0,w,h);res(cv.toDataURL("image/jpeg",q));};img.onerror=rej;img.src=r.result;};
    r.onerror=rej;r.readAsDataURL(file);
  });
}

/* ---- minimal EXIF GPS reader (best effort, JPEG only) ------------ */
async function readExifGPS(file){
  try{
    const buf=await file.arrayBuffer();const dv=new DataView(buf);
    if(dv.getUint16(0)!==0xFFD8)return null;
    let off=2;const len=dv.byteLength;
    while(off<len){
      if(dv.getUint16(off)===0xFFE1){
        const exifStart=off+4;
        if(dv.getUint32(exifStart)!==0x45786966)return null;
        const tiff=exifStart+6;
        const little=dv.getUint16(tiff)===0x4949;
        const g16=(o)=>dv.getUint16(o,little),g32=(o)=>dv.getUint32(o,little);
        const ifd0=tiff+g32(tiff+4);
        const n0=g16(ifd0);let gpsIFD=0;
        for(let i=0;i<n0;i++){const ent=ifd0+2+i*12;if(g16(ent)===0x8825){gpsIFD=tiff+g32(ent+8);break;}}
        if(!gpsIFD)return null;
        const ng=g16(gpsIFD);const tags={};
        for(let i=0;i<ng;i++){const ent=gpsIFD+2+i*12;const tag=g16(ent);const cnt=g32(ent+4);const vo=ent+8;tags[tag]={cnt,vo};}
        const rat=(o)=>g32(o)/g32(o+4);
        const dms=(t)=>{const o=tiff+g32(t.vo);return rat(o)+rat(o+8)/60+rat(o+16)/3600;};
        const latRef=String.fromCharCode(dv.getUint8(tags[1]?.vo))||"N";
        const lngRef=String.fromCharCode(dv.getUint8(tags[3]?.vo))||"E";
        if(!tags[2]||!tags[4])return null;
        let lat=dms(tags[2]),lng=dms(tags[4]);
        if(latRef==="S")lat=-lat;if(lngRef==="W")lng=-lng;
        if(isFinite(lat)&&isFinite(lng))return {lat,lng};
        return null;
      }
      if((dv.getUint16(off)&0xFF00)!==0xFF00)break;
      off+=2+dv.getUint16(off+2);
    }
  }catch{}
  return null;
}

/* ---- pdf.js loader (from CDN, with graceful failure) ------------- */
let pdfjsP=null;
function loadPdfjs(){
  if(pdfjsP)return pdfjsP;
  pdfjsP=new Promise((res,rej)=>{
    if(window.pdfjsLib){res(window.pdfjsLib);return;}
    const s=document.createElement("script");
    s.src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
    s.onload=()=>{try{const lib=window.pdfjsLib;lib.GlobalWorkerOptions.workerSrc="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";res(lib);}catch(e){rej(e);}};
    s.onerror=()=>rej(new Error("pdfjs failed to load"));
    document.head.appendChild(s);
  });
  return pdfjsP;
}
async function pdfFromArrayBuffer(ab){const lib=await loadPdfjs();return lib.getDocument({data:ab}).promise;}
async function pdfPageText(doc,n){const page=await doc.getPage(n);const tc=await page.getTextContent();let last=0,out="";for(const it of tc.items){const y=it.transform[5];if(last&&Math.abs(y-last)>4)out+="\n";out+=it.str+(it.hasEOL?"\n":" ");last=y;}return out;}
async function pdfRenderPage(doc,n,scale=1.6){const page=await doc.getPage(n);const vp=page.getViewport({scale});const cv=document.createElement("canvas");cv.width=vp.width;cv.height=vp.height;await page.render({canvasContext:cv.getContext("2d"),viewport:vp}).promise;return {url:cv.toDataURL("image/jpeg",0.85),w:vp.width,h:vp.height};}

/* ---- speech ------------------------------------------------------ */
function say(t){try{const u=new SpeechSynthesisUtterance(t);u.rate=0.92;window.speechSynthesis.cancel();window.speechSynthesis.speak(u);}catch{}}

/* UI PRIMITIVES */
function Label({children,style}){return <div style={{fontFamily:UI,fontSize:10.5,letterSpacing:"0.085em",textTransform:"uppercase",color:c.t2,fontWeight:600,...style}}>{children}</div>;}
function Val({children,size=14,mono=true,style}){return <span style={{fontFamily:mono?MONO:UI,fontSize:size,color:c.t0,...style}}>{children}</span>;}
function Chip({children,color=c.t1,onClick,active,small}){
  return <span onClick={onClick} style={{fontFamily:MONO,fontSize:small?10.5:11,letterSpacing:"0.02em",padding:small?"2px 6px":"3px 8px",borderRadius:6,color:active?(color==="#fff"?c.t0:color):color,background:active?color+"22":"transparent",border:`1px solid ${active?color:c.line2}`,cursor:onClick?"pointer":"default",display:"inline-flex",alignItems:"center",gap:4,whiteSpace:"nowrap",userSelect:"none"}}>{children}</span>;
}
function Btn({children,onClick,kind="ghost",style,disabled,size}){
  const k={primary:{background:c.accent,color:"#17120a",border:"none"},ghost:{background:c.bg2,color:c.t0,border:`1px solid ${c.line2}`},quiet:{background:"transparent",color:c.t1,border:`1px solid ${c.line}`},danger:{background:"transparent",color:c.danger,border:`1px solid ${c.danger}55`}}[kind];
  return <button onClick={onClick} disabled={disabled} style={{fontFamily:UI,fontSize:size||13,fontWeight:650,padding:size===12?"7px 11px":"9px 14px",borderRadius:9,cursor:disabled?"default":"pointer",opacity:disabled?0.45:1,display:"inline-flex",alignItems:"center",justifyContent:"center",gap:7,minHeight:size===12?34:40,...k,...style}}>{children}</button>;
}
function IconBtn({icon:Icon,onClick,active,title,size=20,danger,dim,style}){
  return <button title={title} onClick={onClick} style={{width:40,height:40,borderRadius:9,display:"grid",placeItems:"center",cursor:"pointer",background:active?c.accentSoft:dim?"transparent":c.bg2,border:`1px solid ${active?c.accent:dim?"transparent":c.line2}`,color:danger?c.danger:active?c.accent:c.t1,flexShrink:0,...style}}><Icon size={size}/></button>;
}
const inputStyle=()=>({fontFamily:UI,fontSize:14,color:c.t0,background:c.bg2,border:`1px solid ${c.line2}`,borderRadius:9,padding:"10px 12px",outline:"none",width:"100%",minHeight:42,boxSizing:"border-box"});
function TextInput(p){const {style,...r}=p;return <input {...r} style={{...inputStyle(),...style}}/>;}
function TextArea(p){const {style,...r}=p;return <textarea {...r} style={{...inputStyle(),minHeight:74,resize:"vertical",lineHeight:1.45,...style}}/>;}
function Field({label,children,style}){return <label style={{display:"flex",flexDirection:"column",gap:5,...style}}><Label>{label}</Label>{children}</label>;}
function Segmented({value,onChange,options,color=c.accent}){
  return <div style={{display:"flex",flexWrap:"wrap",gap:6}}>{options.map(o=>{const v=o.k??o,l=o.label??o;const on=value===v;return <button key={v} onClick={()=>onChange(on?"":v)} style={{fontFamily:UI,fontSize:13,fontWeight:600,padding:"8px 12px",borderRadius:8,cursor:"pointer",minHeight:38,background:on?color+"22":c.bg2,border:`1px solid ${on?color:c.line2}`,color:on?(color===c.accent?c.accent:c.t0):c.t1}}>{l}</button>;})}</div>;
}
function Card({title,icon:Icon,children,action,style,pad=15}){
  return <div style={{background:c.bg1,border:`1px solid ${c.line}`,borderRadius:13,padding:pad,...style}}>
    {(title||action)&&<div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12,gap:10}}><div style={{display:"flex",alignItems:"center",gap:8}}>{Icon&&<Icon size={14} color={c.accent}/>}{title&&<Label>{title}</Label>}</div>{action}</div>}
    {children}
  </div>;
}
function Empty({icon:Icon,title,body,action}){
  return <div style={{textAlign:"center",padding:"48px 22px",border:`1px dashed ${c.line2}`,borderRadius:16}}>
    <div style={{width:50,height:50,borderRadius:14,background:c.bg2,display:"grid",placeItems:"center",margin:"0 auto 14px"}}><Icon size={23} color={c.accent}/></div>
    <div style={{fontFamily:UI,fontSize:17,fontWeight:700,color:c.t0,marginBottom:7}}>{title}</div>
    {body&&<p style={{fontFamily:UI,fontSize:13.5,color:c.t1,lineHeight:1.55,maxWidth:400,margin:"0 auto 16px"}}>{body}</p>}
    {action}
  </div>;
}
function Modal({open,onClose,title,children,footer,wide}){
  if(!open)return null;
  return <div onClick={onClose} style={{position:"fixed",inset:0,background:c.scrim,backdropFilter:"blur(3px)",zIndex:80,display:"flex",alignItems:"flex-start",justifyContent:"center",padding:"min(6vh,46px) 12px",overflowY:"auto"}}>
    <div onClick={e=>e.stopPropagation()} style={{background:c.bg1,border:`1px solid ${c.line2}`,borderRadius:16,width:"100%",maxWidth:wide?760:500,boxShadow:"0 24px 60px #000a"}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"15px 17px",borderBottom:`1px solid ${c.line}`}}><div style={{fontFamily:UI,fontSize:16,fontWeight:700,color:c.t0}}>{title}</div><IconBtn icon={X} onClick={onClose} size={18} dim/></div>
      <div style={{padding:17}}>{children}</div>
      {footer&&<div style={{padding:"13px 17px",borderTop:`1px solid ${c.line}`,display:"flex",justifyContent:"flex-end",gap:10,flexWrap:"wrap"}}>{footer}</div>}
    </div>
  </div>;
}
function StoredImg({id,style,onClick}){
  const url=isImgUrl(id);
  const [src,setSrc]=useState(url?id:(imgCache.get(id)||null));
  useEffect(()=>{let on=true;if(isImgUrl(id)){setSrc(id);return;}if(imgCache.has(id)){setSrc(imgCache.get(id));return;}store.get("pb:img:"+id).then(v=>{if(on&&v){imgCache.set(id,v);setSrc(v);}});return()=>{on=false;};},[id]);
  if(!src)return <div style={{...style,background:c.bg2,display:"grid",placeItems:"center"}}><ImageIcon size={16} color={c.t2}/></div>;
  return <img src={src} onClick={onClick} style={style} alt=""/>;
}

/* AI PARSING + SAFE MERGE (scene number is the durable key) */
const MODEL="claude-opus-4-8"; // in-artifact model for parsing + image filing

/* CLOUD BRIDGE (R2 worker) — Claude parses in chat + pushes JSON here; app pulls it */
const R2_BASE="https://files-worker.me-e51.workers.dev";
/* The Files Worker already does CORS + OPTIONS + authed read/write. The app sends the
   user's key (entered once per device in Settings, stored locally, never in the repo), so
   cloud pull/push works privately without making the film publicly readable. */
let R2_KEY="";
async function loadR2Key(){try{R2_KEY=(await store.get("pb:r2key"))||"";}catch{R2_KEY="";}}
function setR2Key(k){R2_KEY=(k||"").trim();return store.set("pb:r2key",R2_KEY);}
const r2Headers=()=>R2_KEY?{"X-API-Key":R2_KEY}:undefined;
const R2_KEYS={script:"dpdeck/script.json",schedule:"dpdeck/schedule.json",locations:"dpdeck/locations.json",crew:"dpdeck/crew.json",contacts:"dpdeck/contacts.json"};
const DECK_KEY="dpdeck/_deck.json"; // full lossless deck snapshot for cross-device sync
async function r2Read(name){
  const key=R2_KEYS[name];if(!key)return null;
  const res=await fetch(R2_BASE+"/read/"+key,{headers:r2Headers()});
  if(res.status===404)return null;
  if(res.status===401)throw new Error("cloud 401 (add your Files Worker key in Settings)");
  if(!res.ok)throw new Error("cloud "+res.status);
  const t=(await res.text()).trim();
  return t||null;
}
async function r2ReadRaw(key){const res=await fetch(R2_BASE+"/read/"+encodeURIComponent(key).replace(/%2F/g,"/"),{headers:r2Headers()});if(res.status===404)return null;if(!res.ok)throw new Error("cloud "+res.status);return await res.text();}
async function r2Write(key,text){const res=await fetch(R2_BASE+"/write/"+encodeURIComponent(key).replace(/%2F/g,"/"),{method:"PUT",headers:{...(r2Headers()||{}),"Content-Type":"application/json"},body:text});if(!res.ok)throw new Error("cloud write "+res.status);return true;}
async function pushDeckToCloud(){if(!R2_KEY)throw new Error("Add your Files Worker key in Settings first.");const b=await exportFullBackup();await r2Write(DECK_KEY,JSON.stringify(b));return JSON.stringify(b).length;}
async function pullDeckFromCloud(){if(!R2_KEY)throw new Error("Add your Files Worker key in Settings first.");const t=await r2ReadRaw(DECK_KEY);if(!t)throw new Error("No cloud deck yet. Push from another device first.");await importFullBackup(JSON.parse(t));return true;}
/* in-app AI: uses the user's OWN Anthropic key, stored locally (pb:aikey) on this device,
   called direct from the browser. No key in code, no server. Empty key = AI buttons stay off;
   the paste-JSON and Load Project paths never need it. */
let AI_KEY="";
async function loadAIKey(){try{AI_KEY=(await store.get("pb:aikey"))||"";}catch{AI_KEY="";}}
function setAIKey(k){AI_KEY=(k||"").trim();return store.set("pb:aikey",AI_KEY);}
const aiHeaders=()=>({"content-type":"application/json","x-api-key":AI_KEY,"anthropic-version":"2023-06-01","anthropic-dangerous-direct-browser-access":"true"});
async function callClaude(prompt,maxTokens=8000){
  if(!AI_KEY)throw new Error("Add your Anthropic API key in Settings to use the in-app AI.");
  const res=await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:aiHeaders(),body:JSON.stringify({model:MODEL,max_tokens:maxTokens,messages:[{role:"user",content:prompt}]})});
  if(!res.ok)throw new Error("AI request failed ("+res.status+")");
  const data=await res.json();
  return (data.content||[]).filter(b=>b.type==="text").map(b=>b.text).join("\n");
}
function extractJSON(raw){
  let s=(raw||"").replace(/```json/gi,"").replace(/```/g,"").trim();
  const a=s.indexOf("["),b=s.lastIndexOf("]");
  if(a<0||b<0)throw new Error("Could not read a scene list from the response.");
  return JSON.parse(s.slice(a,b+1));
}
function emptyScene(number,p={}){return {number:number||"",slug:p.slug||"",set:p.set||"",dayNight:p.dayNight||"",syn:p.syn||"",synEdited:false,storyIndex:p.storyIndex??9999,shootDay:"",shootDate:"",shootOrder:0,status:"todo",locationId:"",notes:"",pageStart:p.pageStart||0,pageEnd:p.pageEnd||0,refs:[],shots:[],gearTags:[],sketches:[],aiGear:[],scriptText:p.scriptText||""};}

async function parseScriptText(text,onProgress){
  const lines=text.split("\n");const chunks=[];let cur="";
  for(const ln of lines){if(cur.length+ln.length>45000){chunks.push(cur);cur="";}cur+=ln+"\n";}
  if(cur.trim())chunks.push(cur);
  const seen=new Map();let order=0;
  for(let i=0;i<chunks.length;i++){
    onProgress&&onProgress(i+1,chunks.length);
    const prompt=`Extract every scene from this screenplay text into a JSON array, one object per slugline. Keys EXACTLY:
"n" scene number as a string (e.g. "14A", "" if none), "slug" one of "INT","EXT","INT/EXT","", "set" the set/location from the slugline, "dn" one of "DAY","NIGHT","DUSK","DAWN","", "syn" one concise sentence of the action, "pg" the page number as an integer from the nearest preceding <<<PAGE n>>> marker (0 if no markers).
Return ONLY the JSON array, no prose, no code fences.

SCREENPLAY:
${chunks[i]}`;
    let arr=[];try{arr=extractJSON(await callClaude(prompt,8000));}catch(e){if(chunks.length===1)throw e;}
    for(const s of arr){const key=numKey(s.n)||("__"+order);if(!seen.has(key))seen.set(key,{number:s.n||"",slug:s.slug||"",set:s.set||"",dayNight:s.dn||"",syn:s.syn||"",pageStart:+s.pg||0,storyIndex:order++});}
  }
  if(!seen.size)throw new Error("No scenes found. Make sure the document has sluglines like INT. / EXT.");
  return [...seen.values()];
}
async function parseScheduleText(text){
  const prompt=`This is a film SHOOTING SCHEDULE. Extract the shoot days and the scenes on each, in order. Return ONLY a JSON array, one object per shoot day, in chronological order:
[{"day":"1","date":"YYYY-MM-DD or empty string","scenes":["12","13","47A"]}]
Use scene numbers exactly as written. Include a calendar date only if one is clearly present. Keep day labels as given.

SCHEDULE:
${text.slice(0,90000)}`;
  const arr=extractJSON(await callClaude(prompt,8000));
  if(!Array.isArray(arr)||!arr.length)throw new Error("No shoot days found in that schedule.");
  return arr;
}
const idxByNum=scenes=>{const m=new Map();for(const s of scenes)if(s.number)m.set(numKey(s.number),s);return m;};
function diffScript(existing,parsed){
  const ex=idxByNum(existing),seen=new Set(),added=[],changed=[],unchanged=[],revived=[];
  for(const p of parsed){const k=numKey(p.number);if(!k)continue;seen.add(k);const o=ex.get(k);
    if(!o)added.push(p);
    else if(o.status==="omitted")revived.push(p);
    else if((o.set||"")!==(p.set||"")||(o.dayNight||"")!==(p.dayNight||"")||(o.slug||"")!==(p.slug||""))changed.push(p);
    else unchanged.push(p);}
  const omitted=existing.filter(s=>s.number&&s.status!=="omitted"&&!seen.has(numKey(s.number)));
  return {added,changed,unchanged,revived,omitted};
}
function applyScript(existing,parsed){
  const ex=idxByNum(existing),seen=new Set(),out=[];
  for(const p of parsed){const k=numKey(p.number);if(k)seen.add(k);const o=k?ex.get(k):null;
    if(o)out.push({...o,slug:p.slug||o.slug,set:p.set||o.set,dayNight:p.dayNight||o.dayNight,storyIndex:p.storyIndex,pageStart:p.pageStart||o.pageStart,pageEnd:p.pageEnd||o.pageEnd,syn:o.synEdited?o.syn:(p.syn||o.syn),status:o.status==="omitted"?"todo":o.status});
    else out.push(emptyScene(p.number,p));}
  for(const s of existing){if(s.number&&!seen.has(numKey(s.number)))out.push({...s,status:"omitted"});}
  return out;
}
function attachRefs(scenes,parsed){
  const add=new Map();
  for(const p of parsed)if(p.imgs&&p.imgs.length)add.set(numKey(p.number),p.imgs);
  if(!add.size)return scenes;
  return scenes.map(s=>{const us=add.get(numKey(s.number));if(!us)return s;const refs=[...(s.refs||[])];for(const u of us)if(!refs.includes(u))refs.push(u);return {...s,refs};});
}
function assignPages(parsed,pageCount){
  const ord=[...parsed].filter(s=>s.pageStart>0).sort((a,b)=>a.storyIndex-b.storyIndex);
  for(let i=0;i<ord.length;i++){const cur=ord[i],nx=ord[i+1];let end=nx?Math.max(cur.pageStart,nx.pageStart):(pageCount||cur.pageStart);end=Math.min(end,cur.pageStart+5);cur.pageEnd=Math.max(cur.pageStart,end);}
  return parsed;
}
function applySchedule(existing,days){
  const asn=new Map();
  days.forEach(d=>(d.scenes||[]).forEach((num,i)=>asn.set(numKey(num),{day:String(d.day||""),order:i+1,date:d.date||""})));
  return existing.map(s=>{const a=asn.get(numKey(s.number));return a?{...s,shootDay:a.day,shootOrder:a.order,shootDate:a.date||s.shootDate||""}:{...s,shootDay:"",shootOrder:0};});
}
function diffSchedule(existing,days){
  const asn=new Map();days.forEach(d=>(d.scenes||[]).forEach(num=>asn.set(numKey(num),String(d.day||""))));
  const moved=[],added=[];
  for(const s of existing){const nd=asn.get(numKey(s.number));if(nd&&nd!==(s.shootDay||"")){(s.shootDay?moved:added).push({n:s.number,from:s.shootDay,to:nd});}}
  const exNums=new Set(existing.map(s=>numKey(s.number)));
  const orphan=[];days.forEach(d=>(d.scenes||[]).forEach(num=>{if(!exNums.has(numKey(num)))orphan.push(num);}));
  return {moved,added,orphan,days:days.length};
}
const uniq=a=>[...new Set((a||[]).filter(Boolean))];
function applyLocations(existing,incoming){
  const out=existing.map(x=>({...x}));
  const byName=new Map(out.map((l,i)=>[(l.name||"").trim().toLowerCase(),i]));
  let added=0,updated=0;
  for(const inc of incoming){
    const nm=(inc.name||"").trim();if(!nm)continue;
    const k=nm.toLowerCase();
    const v=f=>{const x=inc[f];return x==null?"":String(x).trim();};
    const f={address:v("address"),lat:v("lat"),lng:v("lng"),radius:v("radius"),notes:v("notes")};
    const imgs=toUrlArr(inc.img),plans=toUrlArr(inc.plans);
    const i=byName.get(k);
    if(i!=null){const old=out[i];out[i]={...old,name:nm,address:f.address||old.address||"",lat:f.lat||old.lat||"",lng:f.lng||old.lng||"",radius:f.radius||old.radius||"",notes:f.notes||old.notes||"",images:uniq([...(old.images||[]),...imgs]),plans:uniq([...(old.plans||[]),...plans]),imgId:old.imgId||imgs[0]||""};updated++;}
    else{out.push({id:uid(),name:nm,...f,images:uniq(imgs),plans:uniq(plans),imgId:imgs[0]||""});byName.set(k,out.length-1);added++;}
  }
  return {merged:out,added,updated};
}
function linkLocations(scenes,parsed,locations){
  if(!locations.length||!parsed.length)return scenes;
  const byName=new Map(locations.map(l=>[(l.name||"").trim().toLowerCase(),l.id]));
  const want=new Map();
  for(const p of parsed){const nm=((p.loc||p.set||"")+"").trim().toLowerCase();if(!nm)continue;const id=byName.get(nm);if(id)want.set(numKey(p.number),id);}
  if(!want.size)return scenes;
  return scenes.map(s=>{const id=want.get(numKey(s.number));return id&&s.locationId!==id?{...s,locationId:id}:s;});
}
/* Canonical location name from a slugline set, e.g. "HOSPITAL - MARTY'S ROOM" -> "Hospital",
   "MARTY/STELLA HOUSE - KITCHEN" -> "Marty & Stella's House". Used to auto-populate the
   Locations list on every script import so the places in the script become real locations. */
const LOC_SKIP=/^(VARIOUS|CONTINUOUS|MONTAGE|INTERCUT|SERIES OF SHOTS|TBD|BLACK|BLACKNESS|LATER|MOMENTS LATER|SAME)$/i;
function canonLocName(set){
  if(!set)return "";
  let b=String(set).replace(/[’‘`]/g,"'");
  b=b.replace(/^\s*(INT\.?\/EXT\.?|INT\.?|EXT\.?|I\/E\.?)\s+/i,"");
  b=b.split(/\s+[-–—]\s+/)[0].split(/[,(]/)[0];
  b=b.replace(/^[\s\-–—]+/,"").replace(/\s+/g," ").trim();
  if(!b||LOC_SKIP.test(b))return "";
  if(/marty/i.test(b)&&/stella/i.test(b))return "Marty & Stella's House";
  b=b.replace(/\bapt\b\.?/gi,"Apartment");
  let n=b.toLowerCase().replace(/\b([a-z])/g,m=>m.toUpperCase());
  n=n.replace(/'S\b/g,"'s").replace(/\.+$/,"").trim();
  return n;
}
/* For every non-omitted scene that has no location yet, derive its canonical location from the
   set, create the location if missing (matched by name), and link the scene to it. Idempotent:
   scenes already linked and manual links are left untouched; existing locations are reused. */
function deriveLocations(scenes,locations){
  const locs=(locations||[]).map(l=>({...l}));
  const byName=new Map(locs.map(l=>[(l.name||"").trim().toLowerCase(),l]));
  let added=0,linked=0;
  const outScenes=(scenes||[]).map(s=>{
    if(s.locationId||s.status==="omitted")return s;
    const name=((s.loc||"").trim())||canonLocName(s.set);
    if(!name)return s;
    let loc=byName.get(name.toLowerCase());
    if(!loc){loc={id:uid(),name,address:"",lat:"",lng:"",radius:"",notes:"",images:[],plans:[],imgId:""};locs.push(loc);byName.set(name.toLowerCase(),loc);added++;}
    linked++;
    return {...s,locationId:loc.id};
  });
  return {scenes:outScenes,locations:locs,added,linked};
}
function applyCrew(existing,incoming){
  const crew={camera:[...(existing.camera||[])],grip:[...(existing.grip||[])],electric:[...(existing.electric||[])]};
  const maps={camera:new Map(),grip:new Map(),electric:new Map()};
  for(const d of ["camera","grip","electric"])crew[d].forEach((m,i)=>maps[d].set((m.name||"").trim().toLowerCase(),i));
  let added=0,updated=0;
  for(const inc of incoming){
    const nm=(inc.name||"").trim();if(!nm)continue;
    let d=(inc.dept||"").trim().toLowerCase();
    if(!["camera","grip","electric"].includes(d)){const r=(inc.role||"").toLowerCase();d=/grip|dolly/.test(r)?"grip":/electric|gaffer|spark|lamp|board op/.test(r)?"electric":"camera";}
    const v=f=>{const x=inc[f];return x==null?"":String(x).trim();};
    const rec={role:v("role"),pron:v("pron"),phone:v("phone"),email:v("email")};
    const i=maps[d].get(nm.toLowerCase());
    if(i!=null){const old=crew[d][i];crew[d][i]={...old,name:nm,role:rec.role||old.role||"",pron:rec.pron||old.pron||"",phone:rec.phone||old.phone||"",email:rec.email||old.email||""};updated++;}
    else{crew[d].push({id:uid(),name:nm,...rec});maps[d].set(nm.toLowerCase(),crew[d].length-1);added++;}
  }
  return {merged:crew,added,updated};
}
function applyContacts(existing,incoming){
  const out=[...(existing||[])];
  const byName=new Map(out.map((ct,i)=>[(ct.name||"").trim().toLowerCase(),i]));
  let added=0,updated=0;
  for(const inc of incoming){
    const nm=(inc.name||"").trim();if(!nm)continue;
    const v=f=>{const x=inc[f];return x==null?"":String(x).trim();};
    const rec={role:v("role"),address:v("address"),lat:v("lat"),lng:v("lng"),phone:v("phone"),email:v("email")};
    const i=byName.get(nm.toLowerCase());
    if(i!=null){const old=out[i];out[i]={...old,name:nm,role:rec.role||old.role||"",address:rec.address||old.address||"",lat:rec.lat||old.lat||"",lng:rec.lng||old.lng||"",phone:rec.phone||old.phone||"",email:rec.email||old.email||""};updated++;}
    else{out.push({id:uid(),name:nm,...rec});byName.set(nm.toLowerCase(),out.length-1);added++;}
  }
  return {merged:out,added,updated};
}

/* Full-project file import: scenes (spine + shots + notes + gear + refs) + schedule.
   Merges by scene number, never omits, preserves work already in the deck. */
function applyProjectFile(p,inc){
  let scenes=p.scenes.map(s=>({...s,shots:[...(s.shots||[])],refs:[...(s.refs||[])],gearTags:[...(s.gearTags||[])]}));
  const byNum=new Map(scenes.map((s,i)=>[numKey(s.number),i]));
  let gear=[...(p.gear||[])];
  const gkey=(n,d)=>(n||"").toLowerCase()+"|"+d;
  const gmap=new Map(gear.map((g,i)=>[gkey(g.name,g.dept),i]));
  const ensureGear=(name,dept)=>{const k=gkey(name,dept);let i=gmap.get(k);if(i!=null)return gear[i].id;const g={id:uid(),name,dept};gear.push(g);gmap.set(k,gear.length-1);return g.id;};
  (inc.scenes||[]).forEach((isc,idx)=>{
    const number=String(isc.number??isc.n??"").trim();if(!number)return;
    const k=numKey(number);const slug=isc.slug||"",set=isc.set||"",dn=isc.dn||isc.dayNight||"",syn=isc.syn||"",pageStart=+(isc.pageStart||isc.pg||0)||0;
    let i=byNum.get(k);
    if(i==null){scenes.push(emptyScene(number,{slug,set,dayNight:dn,syn,storyIndex:isc.storyIndex??idx,pageStart,scriptText:isc.scriptText}));i=scenes.length-1;byNum.set(k,i);}
    else{const o=scenes[i];scenes[i]={...o,slug:slug||o.slug,set:set||o.set,dayNight:dn||o.dayNight,storyIndex:isc.storyIndex??o.storyIndex,pageStart:pageStart||o.pageStart,syn:o.synEdited?o.syn:(syn||o.syn),scriptText:isc.scriptText||o.scriptText,status:o.status==="omitted"?"todo":o.status};}
    const s=scenes[i];
    if(Array.isArray(isc.shots)&&isc.shots.length){const have=new Set(s.shots.map(x=>x.text));for(const t of isc.shots){if(t&&!have.has(t)){s.shots.push({id:uid(),text:String(t),done:false});have.add(t);}}}
    if(isc.notes&&!(s.notes||"").includes(isc.notes))s.notes=s.notes?(s.notes+"\n"+isc.notes):isc.notes;
    if(Array.isArray(isc.gear))for(const g of isc.gear){if(!g||!g.name)continue;const dept=["camera","grip","electric"].includes(g.dept)?g.dept:"camera";const id=ensureGear(g.name,dept);if(!s.gearTags.includes(id))s.gearTags.push(id);}
    if(Array.isArray(isc.refs)&&isc.refs.length){const have=new Set(s.refs);for(const r of isc.refs){if(r&&!have.has(r)){s.refs.push(r);have.add(r);}}}
  });
  let out={...p,meta:{...p.meta,...(inc.meta||{})},scenes,gear};
  if(Array.isArray(inc.days)&&inc.days.length)out.scenes=applySchedule(out.scenes,inc.days);
  if(Array.isArray(inc.locations)&&inc.locations.length)out.locations=applyLocations(out.locations,inc.locations).merged;
  if(Array.isArray(inc.scenes))out.scenes=linkLocations(out.scenes,inc.scenes,out.locations);
  if(Array.isArray(inc.crew)&&inc.crew.length)out.crew=applyCrew(out.crew,inc.crew).merged;
  if(Array.isArray(inc.contacts)&&inc.contacts.length)out.contacts=applyContacts(out.contacts,inc.contacts).merged;
  if(Array.isArray(inc.look)&&inc.look.length)out.look=uniq([...(out.look||[]),...inc.look]);
  const d=deriveLocations(out.scenes,out.locations||[]);out.scenes=d.scenes;out.locations=d.locations;
  return out;
}

/* ---- session script document (for page rendering) --------------- */
const scriptDoc={doc:null,pageCache:new Map(),name:""};
async function setScriptPDF(ab,name){
  let persist=null;try{persist=ab.slice(0);}catch{}
  scriptDoc.doc=await pdfFromArrayBuffer(ab);scriptDoc.pageCache.clear();scriptDoc.name=name||"script.pdf";
  // persist a copy if small enough to re-render next session
  try{if(persist){const b=new Uint8Array(persist);if(b.byteLength<4_500_000){let bin="";for(let i=0;i<b.length;i++)bin+=String.fromCharCode(b[i]);await store.set("pb:scriptpdf",btoa(bin));await store.set("pb:scriptpdfname",name||"");}else{await store.del("pb:scriptpdf");}}}catch{}
}
async function restoreScriptPDF(){
  try{const b64=await store.get("pb:scriptpdf");if(!b64)return false;const bin=atob(b64);const u=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)u[i]=bin.charCodeAt(i);scriptDoc.doc=await pdfFromArrayBuffer(u.buffer);scriptDoc.name=await store.get("pb:scriptpdfname")||"script.pdf";return true;}catch{return false;}
}
async function getScriptPageImage(n){
  if(!scriptDoc.doc||n<1||n>scriptDoc.doc.numPages)return null;
  if(scriptDoc.pageCache.has(n))return scriptDoc.pageCache.get(n);
  const r=await pdfRenderPage(scriptDoc.doc,n,1.7);scriptDoc.pageCache.set(n,r);return r;
}

/* ---- guess page ranges from text positions (fallback aid) -------- */
async function scriptPagesText(doc,onProgress){
  let text="";const N=doc.numPages;
  for(let i=1;i<=N;i++){onProgress&&onProgress(i,N);text+=`\n<<<PAGE ${i}>>>\n`+await pdfPageText(doc,i);}
  return text;
}

/* INK SURFACE — freehand only. Used for blocking + marking pages. — Strokes normalized 0..1 to a fixed-aspect board so thumb == full. */
const INK_COLORS=["#E0A33E","#6FB0DE","#74B98C","#CE6B60","#FFFFFF"];
function InkThumb({data,style}){
  const ref=useRef(null);
  useEffect(()=>{
    const cv=ref.current;if(!cv)return;const dpr=Math.min(devicePixelRatio||1,2);
    const W=cv.clientWidth,H=cv.clientHeight;cv.width=W*dpr;cv.height=H*dpr;const ctx=cv.getContext("2d");ctx.setTransform(dpr,0,0,dpr,0,0);
    ctx.clearRect(0,0,W,H);ctx.fillStyle="#101216";ctx.fillRect(0,0,W,H);
    const draw=(bg)=>{
      const ar=data?.aspect||(4/3);let bw=W,bh=W/ar;if(bh>H){bh=H;bw=H*ar;}const ox=(W-bw)/2,oy=(H-bh)/2;
      if(bg)ctx.drawImage(bg,ox,oy,bw,bh);
      for(const st of (data?.strokes||[])){ctx.strokeStyle=st.color;ctx.lineWidth=Math.max(0.7,(st.w||3)*(bw/600));ctx.lineCap="round";ctx.lineJoin="round";ctx.beginPath();st.pts.forEach((p,i)=>{const x=ox+p[0]*bw,y=oy+p[1]*bh;i?ctx.lineTo(x,y):ctx.moveTo(x,y);});ctx.stroke();}
    };
    if(data?.bgUrl){const im=new Image();im.onload=()=>draw(im);im.src=data.bgUrl;}else draw(null);
  },[data]);
  return <canvas ref={ref} style={{width:"100%",height:"100%",display:"block",...style}}/>;
}
function InkCanvas({initial,bgUrl,onClose,onSave,title}){
  const wrap=useRef(null),cvRef=useRef(null),bgRef=useRef(null);
  const [strokes,setStrokes]=useState(initial?.strokes||[]);
  const [color,setColor]=useState(INK_COLORS[0]),[w,setW]=useState(3),[tool,setTool]=useState("pen");
  const [view,setView]=useState({s:1,tx:0,ty:0});
  const draw=useRef(null),drag=useRef(null),aspect=useRef(initial?.aspect||4/3);
  useEffect(()=>{const u=bgUrl||initial?.bgUrl;if(u){const im=new Image();im.onload=()=>{bgRef.current=im;aspect.current=im.width/im.height;render();};im.src=u;}else{aspect.current=initial?.aspect||4/3;render();}},[bgUrl]);
  const box=()=>{const cv=cvRef.current;if(!cv)return{W:1,H:1,bw:1,bh:1,ox:0,oy:0};const dpr=Math.min(devicePixelRatio||1,2);const W=cv.width/dpr,H=cv.height/dpr;const ar=aspect.current;let bw=W*0.96,bh=bw/ar;if(bh>H*0.96){bh=H*0.96;bw=bh*ar;}return{W,H,bw,bh,ox:(W-bw)/2,oy:(H-bh)/2};};
  const n2s=(nx,ny)=>{const b=box();return{x:(b.ox+nx*b.bw)*view.s+view.tx,y:(b.oy+ny*b.bh)*view.s+view.ty};};
  const s2n=(sx,sy)=>{const b=box();return{x:((sx-view.tx)/view.s-b.ox)/b.bw,y:((sy-view.ty)/view.s-b.oy)/b.bh};};
  const ept=e=>{const r=cvRef.current.getBoundingClientRect();return{x:e.clientX-r.left,y:e.clientY-r.top};};
  const render=useCallback(()=>{
    const cv=cvRef.current;if(!cv)return;const ctx=cv.getContext("2d");const dpr=Math.min(devicePixelRatio||1,2);const b=box();
    ctx.clearRect(0,0,cv.width/dpr,cv.height/dpr);ctx.fillStyle=c.panel;ctx.fillRect(0,0,b.W,b.H);
    const tl=n2s(0,0),br=n2s(1,1);ctx.fillStyle="#0d0f13";ctx.fillRect(tl.x,tl.y,br.x-tl.x,br.y-tl.y);
    if(bgRef.current)ctx.drawImage(bgRef.current,tl.x,tl.y,br.x-tl.x,br.y-tl.y);
    const all=draw.current?[...strokes,draw.current]:strokes;
    for(const st of all){ctx.strokeStyle=st.color;ctx.lineWidth=st.w*view.s;ctx.lineCap="round";ctx.lineJoin="round";ctx.beginPath();st.pts.forEach((p,i)=>{const s=n2s(p[0],p[1]);i?ctx.lineTo(s.x,s.y):ctx.moveTo(s.x,s.y);});if(st.pts.length===1){const s=n2s(st.pts[0][0],st.pts[0][1]);ctx.arc(s.x,s.y,st.w*view.s/2,0,7);ctx.fillStyle=st.color;ctx.fill();}else ctx.stroke();}
  },[strokes,view]);
  const fit=useCallback(()=>{const cv=cvRef.current,wr=wrap.current;if(!cv||!wr)return;const r=wr.getBoundingClientRect();const dpr=Math.min(devicePixelRatio||1,2);cv.width=r.width*dpr;cv.height=r.height*dpr;cv.style.width=r.width+"px";cv.style.height=r.height+"px";cv.getContext("2d").setTransform(dpr,0,0,dpr,0,0);render();},[render]);
  useEffect(()=>{fit();addEventListener("resize",fit);return()=>removeEventListener("resize",fit);},[fit]);
  useEffect(()=>{render();},[render]);
  const erHit=(np)=>{const thr=0.02/view.s;setStrokes(ss=>{let ch=false;const o=ss.filter(st=>{const h=st.pts.some(p=>Math.hypot(p[0]-np.x,p[1]-np.y)<thr);if(h)ch=true;return !h;});return ch?o:ss;});};
  const down=e=>{e.preventDefault();cvRef.current.setPointerCapture?.(e.pointerId);const sp=ept(e),np=s2n(sp.x,sp.y);
    if(tool==="pan"){drag.current={sx:sp.x,sy:sp.y,otx:view.tx,oty:view.ty};return;}
    if(tool==="erase"){drag.current={er:true};erHit(np);return;}
    draw.current={color,w,pts:[[np.x,np.y]]};render();};
  const move=e=>{if(!draw.current&&!drag.current)return;const sp=ept(e),np=s2n(sp.x,sp.y);
    if(draw.current){draw.current.pts.push([np.x,np.y]);requestAnimationFrame(render);return;}
    if(drag.current?.er){erHit(np);return;}
    if(drag.current){setView(v=>({...v,tx:drag.current.otx+(sp.x-drag.current.sx),ty:drag.current.oty+(sp.y-drag.current.sy)}));}};
  const up=()=>{if(draw.current){const st=draw.current;draw.current=null;if(st.pts.length)setStrokes(s=>[...s,st]);else render();}drag.current=null;};
  const save=()=>{onSave({strokes,aspect:aspect.current,bgUrl:bgUrl||initial?.bgUrl||null});onClose();};
  return <div style={{position:"fixed",inset:0,background:c.bg0,zIndex:90,display:"flex",flexDirection:"column"}}>
    <div style={{display:"flex",alignItems:"center",gap:10,padding:"10px 12px",borderBottom:`1px solid ${c.line}`,background:c.bg1}}>
      <IconBtn icon={X} onClick={onClose} size={18} dim title="Close"/>
      <div style={{flex:1,fontFamily:UI,fontWeight:700,fontSize:15,color:c.t0}}>{title||"Sketch"}</div>
      <Btn kind="primary" size={12} onClick={save}><Check size={15}/>Done</Btn>
    </div>
    <div ref={wrap} style={{flex:1,position:"relative",overflow:"hidden",touchAction:"none"}}>
      <canvas ref={cvRef} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} style={{display:"block",touchAction:"none"}}/>
      <div style={{position:"absolute",right:12,bottom:12,display:"flex",flexDirection:"column",gap:8}}>
        <IconBtn icon={ZoomIn} onClick={()=>setView(v=>({...v,s:clamp(v.s*1.25,0.5,6)}))}/>
        <IconBtn icon={ZoomOut} onClick={()=>setView(v=>({...v,s:clamp(v.s*0.8,0.5,6)}))}/>
        <IconBtn icon={Crosshair} onClick={()=>setView({s:1,tx:0,ty:0})}/>
      </div>
    </div>
    <div style={{display:"flex",alignItems:"center",gap:10,padding:"10px 12px",borderTop:`1px solid ${c.line}`,background:c.bg1,flexWrap:"wrap"}}>
      <IconBtn icon={PenLine} active={tool==="pen"} onClick={()=>setTool("pen")} title="Draw"/>
      <IconBtn icon={Eraser} active={tool==="erase"} onClick={()=>setTool("erase")} title="Erase"/>
      <IconBtn icon={Maximize2} active={tool==="pan"} onClick={()=>setTool("pan")} title="Pan"/>
      <IconBtn icon={Undo2} onClick={()=>setStrokes(s=>s.slice(0,-1))} title="Undo"/>
      <div style={{width:1,height:26,background:c.line2,margin:"0 2px"}}/>
      {INK_COLORS.map(col=><button key={col} onClick={()=>{setColor(col);setTool("pen");}} style={{width:26,height:26,borderRadius:"50%",background:col,border:color===col?`2px solid ${c.t0}`:`2px solid ${c.line2}`,cursor:"pointer"}}/>)}
      <div style={{display:"flex",gap:6,marginLeft:4}}>{[2,3,5,8].map(x=><button key={x} onClick={()=>setW(x)} style={{width:34,height:30,borderRadius:7,background:w===x?c.bg3:c.bg2,border:`1px solid ${w===x?c.accent:c.line2}`,cursor:"pointer",display:"grid",placeItems:"center"}}><div style={{width:16,height:x,borderRadius:x,background:c.t0}}/></button>)}</div>
    </div>
  </div>;
}

/* SUN + WEATHER instruments */
function SunBar({lat,lng,tz,date,hm}){
  const data=useMemo(()=>{if(!date)return null;try{return sunTimes(dayNoonUTC(date),+lat,+lng);}catch{return null;}},[lat,lng,date]);
  if(!data)return null;
  const p={dawn:tMin(data.dawn,tz),sr:tMin(data.sunrise,tz),ge:tMin(data.goldEnd,tz),gs:tMin(data.goldStart,tz),ss:tMin(data.sunset,tz),dusk:tMin(data.dusk,tz)};
  if(p.sr==null||p.ss==null)return null;
  const cl=x=>clamp(x==null?0:x,0,1440),pct=v=>v/1440*100;
  const NI="#0c0e13",TW=c.night,DA="#37597a",GO=c.accent;
  const segs=[[0,cl(p.dawn??p.sr),NI],[cl(p.dawn??p.sr),cl(p.sr),TW],[cl(p.sr),cl(p.ge??p.sr),GO],[cl(p.ge??p.sr),cl(p.gs??p.ss),DA],[cl(p.gs??p.ss),cl(p.ss),GO],[cl(p.ss),cl(p.dusk??p.ss),TW],[cl(p.dusk??p.ss),1440,NI]];
  return <div>
    <div style={{position:"relative",height:22,borderRadius:6,overflow:"hidden",border:`1px solid ${c.line}`}}>
      {segs.map(([a,b,col],i)=><div key={i} style={{position:"absolute",left:pct(a)+"%",width:pct(Math.max(0,b-a))+"%",top:0,bottom:0,background:col}}/>)}
      {hm!=null&&<div style={{position:"absolute",left:`calc(${pct(cl(hm))}% - 1px)`,top:-2,bottom:-2,width:2,background:"#fff",boxShadow:"0 0 5px #000"}}/>}
    </div>
    <div style={{position:"relative",height:12,marginTop:3}}>
      <span style={{position:"absolute",left:pct(cl(p.sr))+"%",transform:"translateX(-50%)",fontFamily:MONO,fontSize:9.5,color:c.t2}}>{fmtT(data.sunrise,tz)}</span>
      <span style={{position:"absolute",left:pct(cl(p.ss))+"%",transform:"translateX(-50%)",fontFamily:MONO,fontSize:9.5,color:c.t2}}>{fmtT(data.sunset,tz)}</span>
    </div>
  </div>;
}
function SunCompass({lat,lng,tz,date,hm}){
  const cardOf=deg=>CARD[Math.round((((deg%360)+360)%360)/22.5)%16];
  const base=useMemo(()=>{try{const t=sunTimes(dayNoonUTC(date),+lat,+lng);const az=d=>d&&!isNaN(d)?azC(sunPos(d,+lat,+lng).az).deg:null;return {sr:az(t.sunrise),ss:az(t.sunset)};}catch{return null;}},[lat,lng,date]);
  const cur=useMemo(()=>{try{const p=sunPos(localToAbs(date,Math.floor(hm/60),hm%60,tz),+lat,+lng);return {az:azC(p.az).deg,alt:p.alt*180/PI};}catch{return null;}},[lat,lng,tz,date,hm]);
  if(!base)return null;
  const R=66,cx=78,cy=78,S=156;
  const pt=(deg,r)=>[cx+r*Math.sin(deg*rad),cy-r*Math.cos(deg*rad)];
  let arcD=null;
  if(base.sr!=null&&base.ss!=null){const span=(((base.ss-base.sr)%360)+360)%360;const [x1,y1]=pt(base.sr,R),[x2,y2]=pt(base.ss,R);arcD=`M ${x1.toFixed(1)} ${y1.toFixed(1)} A ${R} ${R} 0 ${span>180?1:0} 1 ${x2.toFixed(1)} ${y2.toFixed(1)}`;}
  const ray=(deg,col)=>{const [x,y]=pt(deg,R);return <line x1={cx} y1={cy} x2={x.toFixed(1)} y2={y.toFixed(1)} stroke={col} strokeWidth={1.4} strokeDasharray="3 3"/>;};
  const sunR=cur?(cur.alt>0?R*(1-Math.min(cur.alt,90)/90):R):0;
  const [sx,sy]=cur?pt(cur.az,sunR):[cx,cy];
  const card=(deg,t)=>{const [x,y]=pt(deg,R+11);return <text x={x.toFixed(1)} y={(y+3).toFixed(1)} textAnchor="middle" style={{fontFamily:MONO,fontSize:9,fill:c.t2}}>{t}</text>;};
  return <div style={{display:"flex",gap:16,alignItems:"center",flexWrap:"wrap"}}>
    <svg width={S} height={S} viewBox={`0 0 ${S} ${S}`} style={{flexShrink:0}}>
      <line x1={cx-R} y1={cy} x2={cx+R} y2={cy} stroke={c.line} strokeWidth={0.6}/>
      <line x1={cx} y1={cy-R} x2={cx} y2={cy+R} stroke={c.line} strokeWidth={0.6}/>
      <circle cx={cx} cy={cy} r={R} fill="none" stroke={c.line2} strokeWidth={1}/>
      {arcD&&<path d={arcD} fill="none" stroke={c.accent} strokeWidth={3} strokeLinecap="round" opacity={0.45}/>}
      {base.sr!=null&&ray(base.sr,c.accent)}
      {base.ss!=null&&ray(base.ss,c.night)}
      {cur&&cur.alt>0&&<line x1={cx} y1={cy} x2={sx.toFixed(1)} y2={sy.toFixed(1)} stroke={c.accent} strokeWidth={1}/>}
      {cur&&<circle cx={sx.toFixed(1)} cy={sy.toFixed(1)} r={cur.alt>0?6:4} fill={cur.alt>0?c.accent:"none"} stroke={c.accent} strokeWidth={cur.alt>0?0:1.4} opacity={cur.alt>0?1:0.5}/>}
      <circle cx={cx} cy={cy} r={2.5} fill={c.t2}/>
      {card(0,"N")}{card(90,"E")}{card(180,"S")}{card(270,"W")}
    </svg>
    <div style={{fontFamily:UI,fontSize:12,color:c.t1,lineHeight:1.8}}>
      <div><span style={{color:c.accent}}>●</span> Sunrise {base.sr!=null?`${Math.round(base.sr)}° ${cardOf(base.sr)}`:"—"}</div>
      <div><span style={{color:c.night}}>●</span> Sunset {base.ss!=null?`${Math.round(base.ss)}° ${cardOf(base.ss)}`:"—"}</div>
      {cur&&<div style={{color:c.t2,marginTop:5}}>Sun at scrub: {cur.alt>0?`${Math.round(cur.az)}° ${cardOf(cur.az)} · alt ${Math.round(cur.alt)}°`:"below horizon"}</div>}
    </div>
  </div>;
}
function SunPanel({lat,lng,tz,date}){
  const data=useMemo(()=>{if(!date)return null;try{return sunTimes(dayNoonUTC(date),+lat,+lng);}catch{return null;}},[lat,lng,date]);
  const [hm,setHm]=useState(15*60);
  const pos=useMemo(()=>{if(!date)return null;try{return sunPos(localToAbs(date,Math.floor(hm/60),hm%60,tz),+lat,+lng);}catch{return null;}},[lat,lng,tz,date,hm]);
  if(!date)return <div style={{color:c.t2,fontFamily:UI,fontSize:13}}>Set a shoot day to compute sun.</div>;
  if(!data)return null;
  const a=pos?azC(pos.az):null,al=pos?pos.alt*180/PI:0;
  const Cell=({ic,l,t})=><div style={{minWidth:58}}><div style={{display:"flex",alignItems:"center",gap:4,color:c.t2,marginBottom:2}}>{ic}<Label>{l}</Label></div><Val size={14}>{fmtT(t,tz)}</Val></div>;
  return <div style={{display:"flex",flexDirection:"column",gap:13}}>
    <SunBar lat={lat} lng={lng} tz={tz} date={date} hm={hm}/>
    <div style={{display:"flex",gap:16,flexWrap:"wrap"}}>
      <Cell ic={<Sunrise size={12} color={c.accent}/>} l="Sunrise" t={data.sunrise}/>
      <Cell ic={<Sun size={12} color={c.accent}/>} l="Gold AM" t={data.goldEnd}/>
      <Cell ic={<Sun size={12} color={c.accent}/>} l="Gold PM" t={data.goldStart}/>
      <Cell ic={<Sunset size={12} color={c.accent}/>} l="Sunset" t={data.sunset}/>
      <Cell ic={<Clock size={12} color={c.night}/>} l="Dusk" t={data.dusk}/>
    </div>
    <SunCompass lat={lat} lng={lng} tz={tz} date={date} hm={hm}/>
    <div style={{borderTop:`1px solid ${c.line}`,paddingTop:11}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8,gap:8,flexWrap:"wrap"}}>
        <Label>Sun at {String(Math.floor(hm/60)).padStart(2,"0")}:{String(hm%60).padStart(2,"0")}</Label>
        {a&&<Val size={13} style={{color:al<0?c.t2:c.accent}}>{al<0?"below horizon":`az ${Math.round(a.deg)}° ${a.card} · alt ${Math.round(al)}°`}</Val>}
      </div>
      <input type="range" min={0} max={1439} step={5} value={hm} onChange={e=>setHm(+e.target.value)} style={{width:"100%",accentColor:c.accent}}/>
    </div>
  </div>;
}
const wxCache=new Map();
function useWeather(lat,lng,date){
  const [st,setSt]=useState({s:"idle"});
  useEffect(()=>{let on=true;if(lat==null||lng==null||!date){setSt({s:"idle"});return;}
    const key=`${(+lat).toFixed(3)},${(+lng).toFixed(3)},${date}`;
    if(wxCache.has(key)){setSt(wxCache.get(key));return;}
    setSt({s:"load"});
    fetch(`https://api.open-meteo.com/v1/forecast?latitude=${+lat}&longitude=${+lng}&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_speed_10m_max&timezone=auto&forecast_days=16`).then(r=>r.json()).then(d=>{if(!on)return;const i=d?.daily?.time?d.daily.time.indexOf(date):-1;let r;if(i<0)r={s:"far"};else r={s:"ok",code:d.daily.weather_code[i],hi:d.daily.temperature_2m_max[i],lo:d.daily.temperature_2m_min[i],pr:d.daily.precipitation_probability_max[i],wind:d.daily.wind_speed_10m_max[i]};wxCache.set(key,r);setSt(r);}).catch(()=>{if(on)setSt({s:"err"});});
    return()=>{on=false;};},[lat,lng,date]);
  return st;
}
function WeatherInline({lat,lng,date}){
  const st=useWeather(lat,lng,date);
  if(st.s!=="ok"){const m={load:"…",far:"forecast soon",err:"—",idle:""}[st.s];return <span style={{fontFamily:MONO,fontSize:11,color:c.t2}}>{m}</span>;}
  const {Icon,label}=wxMeta(st.code);
  return <span style={{display:"inline-flex",alignItems:"center",gap:6}} title={label}><Icon size={15} color={c.accent}/><Val size={12}>{Math.round(st.hi)}°/{Math.round(st.lo)}°</Val>{st.pr>=40&&<Val size={12} style={{color:c.day}}>{st.pr}%</Val>}</span>;
}
function WeatherCard({lat,lng,tz,date}){
  const st=useWeather(lat,lng,date);
  return <Card title="Weather" icon={CloudSun}>
    {st.s==="load"&&<div style={{color:c.t2,fontFamily:UI,fontSize:13}}>Checking forecast…</div>}
    {st.s==="far"&&<div style={{color:c.t2,fontFamily:UI,fontSize:13}}>Forecast opens about 16 days out. {date} is still too far ahead.</div>}
    {st.s==="err"&&<div style={{color:c.t2,fontFamily:UI,fontSize:13}}>Couldn't reach the forecast.</div>}
    {st.s==="ok"&&(()=>{const {Icon,label}=wxMeta(st.code);return <div style={{display:"flex",alignItems:"center",gap:16}}><Icon size={38} color={c.accent} strokeWidth={1.4}/><div><div style={{fontFamily:UI,fontSize:16,fontWeight:700,color:c.t0}}>{label}</div><div style={{display:"flex",gap:15,marginTop:5,flexWrap:"wrap"}}><span><Label>Hi/Lo</Label><div><Val size={15}>{Math.round(st.hi)}° / {Math.round(st.lo)}°C</Val></div></span><span><Label>Rain</Label><div><Val size={15} style={{color:st.pr>=50?c.day:c.t0}}>{st.pr==null?"—":st.pr+"%"}</Val></div></span><span><Label>Wind</Label><div><Val size={15}>{Math.round(st.wind)} km/h</Val></div></span></div></div></div>;})()}
    <div style={{fontFamily:MONO,fontSize:10,color:c.t2,marginTop:10}}>Open-Meteo · refreshes each visit</div>
  </Card>;
}
function TravelChip({meta,lat,lng}){
  if(!meta.baseLat||!meta.baseLng)return null;
  const km=haversineKm(+meta.baseLat,+meta.baseLng,+lat,+lng);
  const min=Math.max(1,Math.round(km/(meta.avgKmh||28)*60));
  return <a href={`https://www.google.com/maps/dir/?api=1&origin=${meta.baseLat},${meta.baseLng}&destination=${lat},${lng}`} target="_blank" rel="noreferrer" style={{textDecoration:"none"}} title="Straight-line estimate, tap for live directions"><Chip color={c.ok}><Navigation size={11}/>{km<10?km.toFixed(1):Math.round(km)} km · ~{min} min</Chip></a>;
}
/* Fullscreen image viewer with a carousel: takes an ordered list of image ids/urls + a start
   index, so you can flip prev/next through a scene's references (arrows, keys, or swipe). */
function Lightbox({state,onClose}){
  const items=state&&state.items&&state.items.length?state.items:null;
  const [i,setI]=useState(0);
  const touch=useRef(null);
  useEffect(()=>{if(state)setI(clamp(state.i||0,0,(state.items?.length||1)-1));},[state]);
  useEffect(()=>{if(!items)return;const h=e=>{if(e.key==="Escape")onClose();else if(e.key==="ArrowRight"||e.key==="ArrowDown"){e.preventDefault();setI(x=>Math.min(x+1,items.length-1));}else if(e.key==="ArrowLeft"||e.key==="ArrowUp"){e.preventDefault();setI(x=>Math.max(x-1,0));}};window.addEventListener("keydown",h);return()=>window.removeEventListener("keydown",h);},[items,onClose]);
  if(!items)return null;
  const idx=clamp(i,0,items.length-1),id=items[idx],many=items.length>1;
  const go=(d,e)=>{e&&e.stopPropagation();setI(x=>clamp(x+d,0,items.length-1));};
  const nav={width:50,height:50,borderRadius:"50%",border:"none",background:"#0009",color:"#fff",cursor:"pointer",display:"grid",placeItems:"center"};
  const ts=e=>{touch.current=e.touches[0].clientX;};
  const te=e=>{if(touch.current==null)return;const dx=e.changedTouches[0].clientX-touch.current;touch.current=null;if(Math.abs(dx)>45)go(dx<0?1:-1);};
  return <div onClick={onClose} onTouchStart={ts} onTouchEnd={te} style={{position:"fixed",inset:0,background:"#000e",zIndex:95,display:"flex",alignItems:"center",justifyContent:"center",padding:"calc(16px + env(safe-area-inset-top)) 16px"}}>
    <div onClick={e=>e.stopPropagation()} style={{maxWidth:"100%",maxHeight:"100%",display:"flex",alignItems:"center",justifyContent:"center"}}>
      <StoredImg id={id} style={{maxWidth:"100%",maxHeight:"86vh",objectFit:"contain",borderRadius:8,display:"block"}}/>
    </div>
    <IconBtn icon={X} onClick={onClose} size={20} style={{position:"absolute",top:16,right:16}}/>
    {many&&<>
      <button onClick={e=>go(-1,e)} style={{...nav,position:"absolute",left:14,top:"50%",transform:"translateY(-50%)",opacity:idx===0?0.4:1}}><ChevronLeft size={26}/></button>
      <button onClick={e=>go(1,e)} style={{...nav,position:"absolute",right:14,top:"50%",transform:"translateY(-50%)",opacity:idx===items.length-1?0.4:1}}><ChevronRight size={26}/></button>
      <div style={{position:"absolute",bottom:18,left:"50%",transform:"translateX(-50%)",fontFamily:MONO,fontSize:12,color:"#fff",background:"#0009",borderRadius:20,padding:"5px 12px"}}>{idx+1} / {items.length}</div>
    </>}
  </div>;
}

/* ---- ink + sketch persistence ----------------------------------- */
async function loadSketch(id){const d=await store.get("pb:sketch:"+id);if(!d)return null;if(d.bgImgId&&!d.bgUrl)d.bgUrl=isImgUrl(d.bgImgId)?d.bgImgId:await store.get("pb:img:"+d.bgImgId);return d;}
async function saveSketch(id,data){await store.set("pb:sketch:"+id,{strokes:data.strokes,aspect:data.aspect,bgImgId:data.bgImgId||null});}
async function loadScriptInk(number){return (await store.get("pb:scriptink:"+number))||{};}
async function saveScriptInk(number,page,d){const all=(await store.get("pb:scriptink:"+number))||{};all[page]={strokes:d.strokes,aspect:d.aspect};await store.set("pb:scriptink:"+number,all);}

function useWide(bp=980){const [w,setW]=useState(typeof window!=="undefined"?window.innerWidth:1200);useEffect(()=>{const f=()=>setW(window.innerWidth);addEventListener("resize",f);return()=>removeEventListener("resize",f);},[]);return w>=bp;}
function useForm(init,open){const [f,setF]=useState(init||{});useEffect(()=>{setF(init||{});},[init,open]);return [f,(k,v)=>setF(p=>({...p,[k]:v})),setF];}

function SketchThumb({id,rev,onClick,style}){
  const [d,setD]=useState(null);
  useEffect(()=>{let on=true;loadSketch(id).then(x=>on&&setD(x));return()=>{on=false;};},[id,rev]);
  return <div onClick={onClick} style={{cursor:"pointer",borderRadius:9,overflow:"hidden",border:`1px solid ${c.line2}`,background:c.bg2,...style}}>{d?<InkThumb data={d}/>:null}</div>;
}

/* Render screenplay text in true script layout: classify each line by its leading indent
   (action / character cue / parenthetical / dialogue), drop watermark crumbs that bleed through
   the source PDF, and lay it out with column-fitting indents so it reads like the real pages on
   any screen. The source keeps real newlines + indentation; this reads that structure. */
function ScreenplayText({text,base,strong,dim,size=12.5}){
  base=base||c.t1;strong=strong||c.t0;dim=dim||c.t2;
  const lines=useMemo(()=>{
    const out=[];
    for(const ln of (text||"").split("\n")){
      const indent=(ln.match(/^ */)||[""])[0].length;
      const t=ln.trim();
      if(!t){out.push({type:"sp"});continue;}
      if(/^[A-Za-z]{1,2}$/.test(t))continue;                       // watermark crumbs (La, ur, Kl)
      const upper=t===t.toUpperCase();
      if(t.startsWith("(")&&/\)$/.test(t)){out.push({type:"paren",t});continue;}
      if(indent>=18){
        if(upper&&/^[-A-Z0-9 .,'’()\/&]+$/.test(t)&&t.length<=34){out.push({type:"cue",t});continue;}
        if(t.length<=3)continue;                                    // lowercase crumb at cue indent (ein)
        out.push({type:"dia",t});continue;
      }
      out.push({type:indent>=8?"dia":"act",t});
    }
    const o=[];for(const l of out){if(l.type==="sp"&&(!o.length||o[o.length-1].type==="sp"))continue;o.push(l);}
    while(o.length&&o[o.length-1].type==="sp")o.pop();
    while(o.length&&o[0].type==="sp")o.shift();
    return o;
  },[text]);
  if(!lines.length)return null;
  return <div style={{fontFamily:MONO,fontSize:size,lineHeight:1.5}}>
    {lines.map((l,i)=>{
      if(l.type==="sp")return <div key={i} style={{height:size*0.7}}/>;
      if(l.type==="cue")return <div key={i} style={{paddingLeft:"3.1em",color:strong,fontWeight:700}}>{l.t}</div>;
      if(l.type==="paren")return <div key={i} style={{paddingLeft:"2.4em",paddingRight:"1.4em",color:dim,fontStyle:"italic"}}>{l.t}</div>;
      if(l.type==="dia")return <div key={i} style={{paddingLeft:"1.6em",paddingRight:"1em",color:base}}>{l.t}</div>;
      return <div key={i} style={{color:base}}>{l.t}</div>;
    })}
  </div>;
}

/* ---- script pages for one scene --------------------------------- */
function ScriptPages({scene,bump,onMark}){
  const [pages,setPages]=useState(null);
  const ready=!!scriptDoc.doc;
  useEffect(()=>{let on=true;(async()=>{
    if(!scriptDoc.doc||!scene.pageStart){setPages([]);return;}
    const ink=await loadScriptInk(scene.number);const out=[];
    for(let n=scene.pageStart;n<=(scene.pageEnd||scene.pageStart);n++){try{const img=await getScriptPageImage(n);if(img)out.push({n,url:img.url,aspect:img.w/img.h,ink:ink[n]});}catch{}}
    if(on)setPages(out);
  })();return()=>{on=false;};},[scene.number,scene.pageStart,scene.pageEnd,ready,bump]);
  return <div style={{display:"flex",flexDirection:"column",gap:13}}>
    <div>
      <div style={{display:"flex",gap:7,alignItems:"center",marginBottom:7,flexWrap:"wrap"}}>
        {scene.slug&&<Chip color={scene.slug==="EXT"?c.extC:c.intC} active>{scene.slug}</Chip>}
        <Val mono={false} size={14} style={{fontWeight:700}}>{scene.set||"Untitled set"}</Val>
        {scene.dayNight&&<Chip color={["NIGHT","DUSK"].includes(scene.dayNight)?c.night:c.day} active small>{scene.dayNight}</Chip>}
      </div>
      {scene.syn&&<p style={{fontFamily:UI,fontSize:13.5,lineHeight:1.55,color:c.t1,margin:0}}>{scene.syn}</p>}
    </div>
    {scene.scriptText&&<div style={{borderTop:`1px solid ${c.line}`,paddingTop:11}}><Label style={{marginBottom:9}}>Script</Label><ScreenplayText text={scene.scriptText}/></div>}
    {pages===null&&ready&&scene.pageStart>0&&<div style={{color:c.t2,fontFamily:UI,fontSize:13}}>Rendering pages…</div>}
    {pages&&pages.map(p=>(
      <div key={p.n} onClick={()=>onMark(p.n,p.ink,p.url,p.aspect)} style={{position:"relative",borderRadius:10,overflow:"hidden",border:`1px solid ${c.line2}`,cursor:"pointer",aspectRatio:String(p.aspect||0.72)}}>
        <InkThumb data={{bgUrl:p.url,aspect:p.aspect,strokes:p.ink?.strokes||[]}}/>
        <div style={{position:"absolute",top:7,left:8,fontFamily:MONO,fontSize:10,color:"#fff",background:"#0008",padding:"2px 6px",borderRadius:5}}>p{p.n}</div>
        <div style={{position:"absolute",bottom:7,right:8,display:"flex",alignItems:"center",gap:4,fontFamily:UI,fontSize:11,color:"#fff",background:"#0008",padding:"3px 8px",borderRadius:6}}><PenLine size={12}/>{p.ink?.strokes?.length?"Marked":"Mark"}</div>
      </div>
    ))}
    {pages&&pages.length===0&&(scriptDoc.doc?
      <div style={{color:c.t2,fontFamily:UI,fontSize:12.5,lineHeight:1.5,border:`1px dashed ${c.line2}`,borderRadius:10,padding:14}}>This scene has no page mapping. Re-import the script and it will land on its pages.</div>:
      <div style={{color:c.t2,fontFamily:UI,fontSize:12.5,lineHeight:1.5,border:`1px dashed ${c.line2}`,borderRadius:10,padding:14}}>Drop the current script PDF in Import to read and mark the actual pages here.</div>)}
  </div>;
}

/* SCENE COCKPIT — everything for a scene, at a glance, no drilling */
function StatusPill({status,onCycle}){
  const s=STATUS.find(x=>x.k===status)||STATUS[0];
  return <button onClick={onCycle} title="Tap to advance" style={{display:"inline-flex",alignItems:"center",gap:6,padding:"5px 11px",borderRadius:8,background:s.color+"20",border:`1px solid ${s.color}`,cursor:"pointer",fontFamily:UI,fontSize:12.5,fontWeight:650,color:s.color}}><span style={{width:7,height:7,borderRadius:"50%",background:s.color}}/>{s.label}</button>;
}
function PanelShell({title,icon,action,children,wide}){
  return <div style={{display:"flex",flexDirection:"column",background:c.bg1,border:`1px solid ${c.line}`,borderRadius:13,overflow:"hidden",minHeight:0,...(wide?{height:"100%"}:{})}}>
    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"11px 14px",borderBottom:`1px solid ${c.line}`,flexShrink:0}}><div style={{display:"flex",alignItems:"center",gap:8}}>{icon}<Label>{title}</Label></div>{action}</div>
    <div style={{padding:14,overflowY:wide?"auto":"visible",flex:wide?1:"none",minHeight:0}}>{children}</div>
  </div>;
}
function SceneView({scene,scenes,meta,locations,gearList,wide,patchScene,openInk,openLightbox,addGear,goScene,neighbors,openInfo,onToast,onSendRef}){
  const [bump,setBump]=useState(0),[drag,setDrag]=useState(false),[pickBg,setPickBg]=useState(false),[sendImg,setSendImg]=useState(null);
  const fileRef=useRef(null),camRef=useRef(null);
  const loc=locations.find(l=>l.id===scene.locationId);
  const plans=loc?.plans||[];
  const cycle=()=>{const i=STATUS.findIndex(x=>x.k===scene.status);patchScene({status:STATUS[(i+1)%STATUS.length].k});};
  const addImages=async(files)=>{const ids=[];for(const f of files){if(!f.type.startsWith("image/"))continue;try{ids.push(await putImage(await downscale(f)));}catch{}}if(ids.length)patchScene({refs:[...scene.refs,...ids]});};
  const onDropRefs=async e=>{
    e.preventDefault();e.stopPropagation();setDrag(false);
    const dt=e.dataTransfer;
    const files=[...(dt.files||[])].filter(f=>f.type.startsWith("image/"));
    if(files.length){await addImages(files);return;}
    let url=(dt.getData("text/uri-list")||"").split("\n").find(l=>l&&!l.startsWith("#"))||"";
    if(!url){const html=dt.getData("text/html")||"";const m=html.match(/<img[^>]+src=["']([^"']+)["']/i);if(m)url=m[1];}
    if(!url){const t=(dt.getData("text/plain")||"").trim();if(isImgUrl(t))url=t;}
    url=(url||"").trim();
    if(isImgUrl(url)){patchScene({refs:[...scene.refs,url]});onToast&&onToast("Reference added from link");}
    else onToast&&onToast("Couldn't read that drop. Save the image, then drag the file in.");
  };
  const markPage=(n,ink,url,aspect)=>openInk({title:`Scene ${scene.number} · page ${n}`,bgUrl:url,initial:ink?{...ink,bgUrl:url}:{aspect},onSave:async d=>{await saveScriptInk(scene.number,n,d);setBump(b=>b+1);}});
  const newSketch=async(bg)=>{const bgUrl=bg?(isImgUrl(bg)?bg:await store.get("pb:img:"+bg)):null;const id=uid();openInk({title:`Blocking · Scene ${scene.number}`,bgUrl,initial:bgUrl?{bgUrl}:{aspect:4/3},onSave:async d=>{await saveSketch(id,{...d,bgImgId:bg||null});patchScene({sketches:[...scene.sketches,id]});}});};
  const editSketch=async id=>{const d=await loadSketch(id);openInk({title:`Blocking · Scene ${scene.number}`,bgUrl:d?.bgUrl||null,initial:d||{aspect:4/3},onSave:async nd=>{await saveSketch(id,{...nd,bgImgId:d?.bgImgId||null});setBump(b=>b+1);}});};
  const startSketch=()=>{(plans.length||scene.refs.length)?setPickBg(true):newSketch(null);};

  const InfoStrip=(
    <div style={{background:c.bg1,border:`1px solid ${c.line}`,borderRadius:13,padding:"12px 15px"}}>
      <div style={{display:"flex",alignItems:"center",gap:12,flexWrap:"wrap"}}>
        <div style={{display:"flex",alignItems:"baseline",gap:8}}><span style={{fontFamily:MONO,fontSize:25,fontWeight:700,color:c.accent,letterSpacing:"-0.5px"}}>{scene.number||"—"}</span>{scene.status==="omitted"&&<Chip color={c.t2}>not in current draft</Chip>}</div>
        {scene.slug&&<Tag label={scene.slug} color={slugColor(scene.slug)} big/>}
        {scene.dayNight&&<Tag label={scene.dayNight} color={dnColor(scene.dayNight)} big/>}
        <div style={{width:1,height:26,background:c.line2}}/>
        <StatusPill status={scene.status==="omitted"?"todo":scene.status} onCycle={cycle}/>
        {scene.storyDay&&<span><Label style={{display:"inline"}}>Story day </Label><Val size={13}>{scene.storyDay}</Val></span>}
        {scene.shootDay?<Chip color={c.accent} active><Calendar size={11}/>Day {scene.shootDay}{scene.shootOrder?` · #${scene.shootOrder}`:""}</Chip>:<Chip color={c.t2}>unscheduled</Chip>}
        {loc&&<Chip color={c.t1} onClick={()=>goScene&&goScene("__loc__"+loc.id)}><MapPin size={11}/>{loc.name}</Chip>}
        <div style={{flex:1}}/>
        <IconBtn icon={Settings} onClick={openInfo} dim title="Edit scene info"/>
        {neighbors&&<div style={{display:"flex",gap:6}}><IconBtn icon={ChevronLeft} onClick={()=>neighbors.prev&&goScene(neighbors.prev)} dim title="Previous scene"/><IconBtn icon={ChevronRight} onClick={()=>neighbors.next&&goScene(neighbors.next)} dim title="Next scene"/></div>}
      </div>
      {(loc||scene.shootDate)&&<div style={{marginTop:11,display:"grid",gridTemplateColumns:wide?"1fr 1fr":"1fr",gap:14}}>
        {loc&&loc.lat&&<div><div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}><Label>Daylight {scene.shootDate||""}</Label><WeatherInline lat={loc.lat} lng={loc.lng} date={scene.shootDate}/></div><SunBar lat={loc.lat} lng={loc.lng} tz={meta.tz} date={scene.shootDate||todayISO()}/></div>}
        {loc&&loc.lat&&<div style={{display:"flex",alignItems:"center",gap:10}}><TravelChip meta={meta} lat={loc.lat} lng={loc.lng}/>{loc.address&&<span style={{fontFamily:UI,fontSize:12,color:c.t2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{loc.address}</span>}</div>}
      </div>}
    </div>
  );

  const Script=<PanelShell wide={wide} title="Script" icon={<FileText size={14} color={c.accent}/>}>
    <ScriptPages scene={scene} bump={bump} onMark={markPage}/>
  </PanelShell>;

  const Reference=<PanelShell wide={wide} title={`Reference${scene.refs.length?` · ${scene.refs.length}`:""}`} icon={<ImageIcon size={14} color={c.accent}/>}
    action={<div style={{display:"flex",gap:6}}><IconBtn icon={Camera} size={17} onClick={()=>camRef.current.click()} dim title="Camera"/><IconBtn icon={Upload} size={17} onClick={()=>fileRef.current.click()} dim title="Add images"/></div>}>
    <input ref={fileRef} type="file" accept="image/*" multiple style={{display:"none"}} onChange={e=>{addImages([...e.target.files]);e.target.value="";}}/>
    <input ref={camRef} type="file" accept="image/*" capture="environment" style={{display:"none"}} onChange={e=>{addImages([...e.target.files]);e.target.value="";}}/>
    <div onPaste={e=>{const fs=[...e.clipboardData.files];if(fs.length)addImages(fs);}}
      onDragOver={e=>{e.preventDefault();e.stopPropagation();if(!drag)setDrag(true);}}
      onDragLeave={e=>{if(e.currentTarget===e.target)setDrag(false);}}
      onDrop={onDropRefs}
      style={drag?{outline:`2px dashed ${c.accent}`,outlineOffset:3,borderRadius:10}:undefined}>
      {scene.refs.length===0?
        <div style={{border:`1px dashed ${c.line2}`,borderRadius:10,padding:"22px 12px",textAlign:"center",color:c.t2,fontFamily:UI,fontSize:12.5,lineHeight:1.5}}>Drop, paste, or shoot reference. Frames, locations, lighting, anything.</div>:
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          {scene.refs.map((id,idx)=><div key={id} style={{position:"relative",borderRadius:10,overflow:"hidden",border:`1px solid ${c.line2}`,background:c.bg2}}>
            <StoredImg id={id} style={{width:"100%",height:"auto",display:"block",cursor:"zoom-in",minHeight:42}} onClick={()=>openLightbox(scene.refs,idx)}/>
            <div style={{position:"absolute",top:6,right:6,display:"flex",gap:6}}>
              {onSendRef&&<button onClick={()=>setSendImg(id)} title="Copy or move to another scene" style={{width:28,height:28,borderRadius:"50%",border:"none",background:"#000b",color:"#fff",cursor:"pointer",display:"grid",placeItems:"center"}}><Send size={14}/></button>}
              <button onClick={()=>patchScene({refs:scene.refs.filter(x=>x!==id)})} title="Remove" style={{width:28,height:28,borderRadius:"50%",border:"none",background:"#000b",color:"#fff",cursor:"pointer",display:"grid",placeItems:"center"}}><X size={14}/></button>
            </div>
          </div>)}
        </div>}
    </div>
  </PanelShell>;

  const Work=<PanelShell wide={wide} title="Notes · Shots · Gear · Blocking" icon={<PenLine size={14} color={c.accent}/>}>
    <div style={{display:"flex",flexDirection:"column",gap:18}}>
      <div>
        <Label style={{marginBottom:6}}>Notes</Label>
        <TextArea value={scene.notes} placeholder="Ideas, intent, references to the look…" onChange={e=>patchScene({notes:e.target.value})}/>
      </div>
      <ShotList scene={scene} patchScene={patchScene}/>
      <GearBlock scene={scene} gearList={gearList} addGear={addGear} patchScene={patchScene}/>
      <div>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}><Label>Blocking{scene.sketches.length?` · ${scene.sketches.length}`:""}</Label>
          <IconBtn icon={Plus} size={18} title="New blocking sketch" onClick={startSketch}/>
        </div>
        {scene.sketches.length===0?
          <div onClick={startSketch} style={{border:`1px dashed ${c.line2}`,borderRadius:10,padding:"20px 12px",textAlign:"center",color:c.t2,fontFamily:UI,fontSize:12.5,cursor:"pointer"}}>Tap to sketch blocking{plans.length?", blank or over a floor plan":scene.refs.length?", blank or over a reference":""}. Opens full screen, lands here as a thumbnail.</div>:
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(120px,1fr))",gap:9}}>
            {scene.sketches.map(id=><div key={id} style={{position:"relative"}}>
              <SketchThumb id={id} rev={bump} onClick={()=>editSketch(id)} style={{aspectRatio:"4/3"}}/>
              <button onClick={()=>patchScene({sketches:scene.sketches.filter(x=>x!==id)})} style={{position:"absolute",top:4,right:4,width:22,height:22,borderRadius:"50%",border:"none",background:"#000a",color:"#fff",cursor:"pointer",display:"grid",placeItems:"center"}}><X size={13}/></button>
            </div>)}
          </div>}
        <Modal open={pickBg} onClose={()=>setPickBg(false)} title="Sketch blocking over…">
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(116px,1fr))",gap:10}}>
            <button onClick={()=>{setPickBg(false);newSketch(null);}} style={{aspectRatio:"4/3",borderRadius:10,border:`1px dashed ${c.line2}`,background:c.bg2,color:c.t1,cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:6,fontFamily:UI,fontSize:12.5}}><PenLine size={20}/>Blank</button>
            {plans.map((v,i)=><button key={"p"+i} onClick={()=>{setPickBg(false);newSketch(v);}} style={{position:"relative",aspectRatio:"4/3",borderRadius:10,overflow:"hidden",border:`1px solid ${c.line2}`,cursor:"pointer",padding:0}}><StoredImg id={v} style={{width:"100%",height:"100%",objectFit:"cover"}}/><span style={{position:"absolute",left:5,bottom:5,fontFamily:MONO,fontSize:9.5,color:"#fff",background:"#000a",borderRadius:5,padding:"2px 6px"}}>Floor plan</span></button>)}
            {scene.refs.map((v,i)=><button key={"r"+i} onClick={()=>{setPickBg(false);newSketch(v);}} style={{position:"relative",aspectRatio:"4/3",borderRadius:10,overflow:"hidden",border:`1px solid ${c.line2}`,cursor:"pointer",padding:0}}><StoredImg id={v} style={{width:"100%",height:"100%",objectFit:"cover"}}/><span style={{position:"absolute",left:5,bottom:5,fontFamily:MONO,fontSize:9.5,color:"#fff",background:"#000a",borderRadius:5,padding:"2px 6px"}}>Reference</span></button>)}
          </div>
        </Modal>
      </div>
    </div>
  </PanelShell>;

  return <div style={{display:"flex",flexDirection:"column",gap:13,height:wide?"100%":"auto",minHeight:0}}>
    {InfoStrip}
    {wide?
      <div style={{display:"grid",gridTemplateColumns:"minmax(0,1.05fr) minmax(0,1fr) minmax(0,1.05fr)",gap:13,flex:1,minHeight:0}}>{Script}{Reference}{Work}</div>:
      <div style={{display:"flex",flexDirection:"column",gap:13}}>{Script}{Reference}{Work}</div>}
    {onSendRef&&<RefSendModal open={!!sendImg} fromNumber={scene.number} scenes={scenes||[]} onClose={()=>setSendImg(null)} onSend={(toN,mode)=>{onSendRef(scene.number,sendImg,toN,mode);setSendImg(null);onToast&&onToast(mode==="move"?`Moved to scene ${toN}`:`Copied to scene ${toN}`);}}/>}
  </div>;
}

/* ---- shot list (free text, checkable) --------------------------- */
function ShotList({scene,patchScene}){
  const [t,setT]=useState("");
  const addLines=()=>{const lines=t.split("\n").map(x=>x.trim()).filter(Boolean);if(!lines.length)return;patchScene({shots:[...scene.shots,...lines.map(text=>({id:uid(),text,done:false}))]});setT("");};
  const done=scene.shots.filter(s=>s.done).length;
  return <div>
    <Label style={{marginBottom:6}}>Shot list{scene.shots.length?` · ${done}/${scene.shots.length}`:""}</Label>
    {scene.shots.length>0&&<div style={{display:"flex",flexDirection:"column",gap:6,marginBottom:8}}>
      {scene.shots.map((s,i)=><div key={s.id} style={{display:"flex",alignItems:"center",gap:9,background:c.bg2,border:`1px solid ${c.line}`,borderRadius:8,padding:"7px 10px"}}>
        <span style={{fontFamily:MONO,fontSize:11,color:c.t2,minWidth:16,textAlign:"right"}}>{i+1}</span>
        <button onClick={()=>patchScene({shots:scene.shots.map(x=>x.id===s.id?{...x,done:!x.done}:x)})} style={{width:20,height:20,borderRadius:6,border:`1.5px solid ${s.done?c.ok:c.line2}`,background:s.done?c.ok:"transparent",cursor:"pointer",display:"grid",placeItems:"center",flexShrink:0}}>{s.done&&<Check size={13} color="#fff"/>}</button>
        <span style={{flex:1,fontFamily:UI,fontSize:13,color:s.done?c.t2:c.t0,textDecoration:s.done?"line-through":"none",whiteSpace:"pre-wrap"}}>{s.text}</span>
        <button onClick={()=>patchScene({shots:scene.shots.filter(x=>x.id!==s.id)})} style={{background:"none",border:"none",color:c.t2,cursor:"pointer",padding:2}}><X size={14}/></button>
      </div>)}
    </div>}
    <textarea value={t} onChange={e=>setT(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();addLines();}}} placeholder="Type a shot, hit Enter. One per line, or paste a whole list. Shift+Enter for a line break inside a shot." style={{...inputStyle(),minHeight:40,resize:"vertical",lineHeight:1.4}}/>
    <div style={{display:"flex",justifyContent:"flex-end",marginTop:6}}><Btn kind="ghost" size={12} onClick={addLines} disabled={!t.trim()}><Plus size={15}/>Add</Btn></div>
  </div>;
}
/* ---- gear on a scene (free text, 3 depts, AI suggest) ----------- */
function GearBlock({scene,gearList,addGear,patchScene}){
  const [t,setT]=useState(""),[dept,setDept]=useState("camera"),[busy,setBusy]=useState(false);
  const tagged=scene.gearTags.map(id=>gearList.find(g=>g.id===id)).filter(Boolean);
  const add=()=>{const v=t.trim();if(!v)return;addGear(v,dept);setT("");};
  const suggest=async()=>{setBusy(true);try{const prompt=`A film scene. Suggest specific camera, grip, and electric gear it may need, as a JSON array of {"text":"item","dept":"camera|grip|electric"}. Be concrete and brief, max 6 items. Scene: ${scene.slug} ${scene.set}, ${scene.dayNight}. ${scene.syn||""} ${scene.notes||""}. Return ONLY the JSON array.`;const arr=extractJSON(await callClaude(prompt,1200));const cur=scene.aiGear||[];const add2=arr.filter(a=>a.text&&!cur.some(x=>x.text.toLowerCase()===a.text.toLowerCase())).map(a=>({text:a.text,dept:DEPTS.some(d=>d.k===a.dept)?a.dept:"camera",dismissed:false}));patchScene({aiGear:[...cur,...add2]});}catch(e){}setBusy(false);};
  const promote=(s)=>{addGear(s.text,s.dept);patchScene({aiGear:scene.aiGear.map(x=>x===s?{...x,dismissed:true}:x)});};
  const live=(scene.aiGear||[]).filter(s=>!s.dismissed&&!tagged.some(g=>g.name.toLowerCase()===s.text.toLowerCase()));
  return <div>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}><Label>Gear</Label><button onClick={suggest} disabled={busy} style={{display:"inline-flex",alignItems:"center",gap:5,background:"none",border:"none",color:c.accent,fontFamily:UI,fontSize:11.5,fontWeight:650,cursor:"pointer"}}><Sparkles size={13}/>{busy?"Thinking…":"Suggest"}</button></div>
    {DEPTS.map(d=>{const items=tagged.filter(g=>g.dept===d.k);if(!items.length)return null;return <div key={d.k} style={{marginBottom:7}}><div style={{fontFamily:MONO,fontSize:10,color:c.t2,marginBottom:4}}>{d.label}</div><div style={{display:"flex",flexWrap:"wrap",gap:6}}>{items.map(g=><span key={g.id} style={{display:"inline-flex",alignItems:"center",gap:5,background:c.bg2,border:`1px solid ${c.line2}`,borderRadius:7,padding:"4px 8px",fontFamily:UI,fontSize:12.5,color:c.t0}}>{g.name}<X size={12} style={{cursor:"pointer",color:c.t2}} onClick={()=>patchScene({gearTags:scene.gearTags.filter(x=>x!==g.id)})}/></span>)}</div></div>;})}
    {live.length>0&&<div style={{margin:"4px 0 8px",border:`1px solid ${c.accent}33`,borderRadius:9,padding:9,background:c.accentSoft}}>
      <div style={{display:"flex",alignItems:"center",gap:5,marginBottom:6}}><Sparkles size={12} color={c.accent}/><Label style={{color:c.accent}}>Suggested — tap to add</Label></div>
      <div style={{display:"flex",flexWrap:"wrap",gap:6}}>{live.map((s,i)=><span key={i} style={{display:"inline-flex",alignItems:"center",gap:6,background:c.bg1,border:`1px solid ${c.line2}`,borderRadius:7,padding:"4px 6px 4px 9px",fontFamily:UI,fontSize:12.5,color:c.t1}}>{s.text}<span style={{fontFamily:MONO,fontSize:9,color:c.t2}}>{s.dept[0].toUpperCase()}</span><button onClick={()=>promote(s)} style={{border:"none",background:c.accent,color:"#17120a",borderRadius:5,width:18,height:18,display:"grid",placeItems:"center",cursor:"pointer"}}><Plus size={12}/></button><X size={12} style={{cursor:"pointer",color:c.t2}} onClick={()=>patchScene({aiGear:scene.aiGear.map(x=>x===s?{...x,dismissed:true}:x)})}/></span>)}</div>
    </div>}
    <div style={{display:"flex",gap:6,alignItems:"center"}}>
      <div style={{display:"flex",gap:3}}>{DEPTS.map(d=><button key={d.k} onClick={()=>setDept(d.k)} title={d.label} style={{width:30,height:38,borderRadius:7,border:`1px solid ${dept===d.k?c.accent:c.line2}`,background:dept===d.k?c.accentSoft:c.bg2,color:dept===d.k?c.accent:c.t2,fontFamily:MONO,fontSize:12,fontWeight:700,cursor:"pointer"}}>{d.label[0]}</button>)}</div>
      <TextInput value={t} placeholder="Add gear…" onChange={e=>setT(e.target.value)} onKeyDown={e=>e.key==="Enter"&&add()} style={{minHeight:38}}/>
      <IconBtn icon={Plus} onClick={add}/>
    </div>
  </div>;
}

/* AI filing + geolocation helpers (capture) */
function extractObj(raw){let s=(raw||"").replace(/```json/gi,"").replace(/```/g,"").trim();const a=s.indexOf("{"),b=s.lastIndexOf("}");if(a<0||b<0)throw new Error("No JSON object");return JSON.parse(s.slice(a,b+1));}
async function callClaudeVision(prompt,dataUrl,maxTokens=500){
  if(!AI_KEY)throw new Error("Add your Anthropic API key in Settings to use the in-app AI.");
  const m=(dataUrl||"").match(/^data:(.*?);base64,(.*)$/);const content=[{type:"text",text:prompt}];
  if(m)content.unshift({type:"image",source:{type:"base64",media_type:m[1],data:m[2]}});
  const res=await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:aiHeaders(),body:JSON.stringify({model:MODEL,max_tokens:maxTokens,messages:[{role:"user",content}]})});
  if(!res.ok)throw new Error("AI request failed");const d=await res.json();return (d.content||[]).filter(b=>b.type==="text").map(b=>b.text).join("\n");
}
function sceneDigest(scenes){return scenes.filter(s=>s.status!=="omitted").map(s=>`${s.number} | ${s.slug} ${s.set} | ${s.dayNight} | ${(s.syn||"").slice(0,90)}`).join("\n");}
async function fileGuess({kind,text,dataUrl},scenes){
  const list=sceneDigest(scenes).slice(0,9000);
  const ask=`You file production material to the right scene. Scenes (number | slug set | day/night | action):\n${list}\n\n${kind==="image"?"Look at the image and decide which scene it most likely supports (a reference frame, location, lighting, prop).":"Material:\n\""+(text||"").slice(0,1500)+"\"\nDecide which scene it most likely supports."}\nReturn ONLY JSON: {"n":"scene number or empty","confidence":0..1,"why":"max 8 words"}.`;
  const raw=kind==="image"?await callClaudeVision(ask,dataUrl,400):await callClaude(ask,400);
  const o=extractObj(raw);return {n:String(o.n||""),confidence:+o.confidence||0,why:o.why||""};
}
function whereAmI(){return new Promise((res,rej)=>{if(!navigator.geolocation)return rej(new Error("no geo"));navigator.geolocation.getCurrentPosition(p=>res({lat:p.coords.latitude,lng:p.coords.longitude}),e=>rej(e),{enableHighAccuracy:true,timeout:9000,maximumAge:60000});});}
function nearestLocation(locations,lat,lng){let best=null,bd=1e9;for(const l of locations){if(l.lat==null||l.lat==="")continue;const d=haversineKm(lat,lng,+l.lat,+l.lng);if(d<bd){bd=d;best=l;}}return best?{loc:best,km:bd}:null;}

/* LIBRARY — scene list under the active lens */
function cmpScene(a,b,lens){
  if(lens==="shoot"){const ad=a.shootDay||"",bd=b.shootDay||"";if(!!ad!==!!bd)return ad?-1:1;if(ad!==bd)return cmpNum(ad,bd);if((a.shootOrder||0)!==(b.shootOrder||0))return (a.shootOrder||999)-(b.shootOrder||999);return cmpNum(a.number,b.number);}
  return (a.storyIndex??9999)-(b.storyIndex??9999)||cmpNum(a.number,b.number);
}
function SceneRow({s,locName,onClick}){
  const st=STATUS.find(x=>x.k===s.status)||STATUS[0];
  return <button onClick={onClick} style={{width:"100%",textAlign:"left",display:"flex",alignItems:"center",gap:13,padding:"11px 13px",background:c.bg1,border:`1px solid ${c.line}`,borderRadius:11,cursor:"pointer"}}>
    <span style={{fontFamily:MONO,fontSize:16,fontWeight:700,color:s.status==="omitted"?c.t2:c.accent,minWidth:42}}>{s.number||"—"}</span>
    <span style={{width:8,height:8,borderRadius:"50%",background:st.color,flexShrink:0}} title={st.label}/>
    <span style={{flex:1,minWidth:0}}>
      <span style={{display:"flex",alignItems:"center",gap:7}}>
        {s.slug&&<Tag label={s.slug} color={slugColor(s.slug)}/>}
        <span style={{fontFamily:UI,fontSize:14,fontWeight:600,color:c.t0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{s.set||"Untitled"}</span>
        {s.dayNight&&<Tag label={s.dayNight} color={dnColor(s.dayNight)}/>}
      </span>
      <span style={{display:"flex",gap:9,marginTop:2,alignItems:"center"}}>
        {locName&&<span style={{fontFamily:UI,fontSize:11,color:c.t2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}><MapPin size={9} style={{verticalAlign:"-1px"}}/> {locName}</span>}
        {s.refs.length>0&&<span style={{fontFamily:MONO,fontSize:10,color:c.t2}}><ImageIcon size={10} style={{verticalAlign:"-1px"}}/> {s.refs.length}</span>}
        {s.sketches.length>0&&<span style={{fontFamily:MONO,fontSize:10,color:c.t2}}><PenLine size={10} style={{verticalAlign:"-1px"}}/> {s.sketches.length}</span>}
        {s.shots.length>0&&<span style={{fontFamily:MONO,fontSize:10,color:c.t2}}><ListChecks size={10} style={{verticalAlign:"-1px"}}/> {s.shots.filter(x=>x.done).length}/{s.shots.length}</span>}
      </span>
    </span>
    {s.shootDay?<span style={{fontFamily:MONO,fontSize:11,color:c.accent,background:c.accentSoft,border:`1px solid ${c.accent}55`,borderRadius:6,padding:"3px 7px"}}>D{s.shootDay}{s.shootOrder?`·${s.shootOrder}`:""}</span>:<span style={{fontFamily:MONO,fontSize:10,color:c.t2}}>—</span>}
  </button>;
}
function Library({project,lens,onOpen}){
  const [q,setQ]=useState(""),[group,setGroup]=useState(""),[showOmit,setShowOmit]=useState(false),[filt,setFilt]=useState([]);
  const locName=id=>project.locations.find(l=>l.id===id)?.name;
  let list=project.scenes.filter(s=>showOmit||s.status!=="omitted");
  if(q.trim()){const k=q.toLowerCase();list=list.filter(s=>(s.number+" "+s.set+" "+s.slug+" "+s.dayNight+" "+(s.syn||"")+" "+(s.notes||"")).toLowerCase().includes(k));}
  const fSlugs=filt.filter(x=>x==="INT"||x==="EXT"),fTimes=filt.filter(x=>x==="DAY"||x==="NIGHT");
  if(fSlugs.length)list=list.filter(s=>fSlugs.some(x=>(s.slug||"").includes(x)));
  if(fTimes.length)list=list.filter(s=>fTimes.includes(s.dayNight));
  const byDay=(a,b)=>{const aH=!!a.shootDay,bH=!!b.shootDay;if(aH!==bH)return aH?-1:1;const an=parseInt(a.shootDay,10),bn=parseInt(b.shootDay,10),aN=!isNaN(an),bN=!isNaN(bn);if(aN!==bN)return aN?-1:1;if(aN&&bN&&an!==bn)return an-bn;if(!aN&&a.shootDay!==b.shootDay)return String(a.shootDay).localeCompare(String(b.shootDay));return (a.shootOrder||999)-(b.shootOrder||999);};
  list=[...list].sort(group==="day"?byDay:(a,b)=>cmpScene(a,b,lens));
  let groups;
  if(group==="location")groups=groupBy(list,s=>locName(s.locationId)||"No location set");
  else if(group==="day")groups=groupBy(list,s=>!s.shootDay?"Unscheduled":(isNaN(parseInt(s.shootDay,10))?s.shootDay:`Day ${s.shootDay}${s.shootDate?" · "+s.shootDate:""}`));
  else if(group==="status")groups=groupBy(list,s=>(STATUS.find(x=>x.k===s.status)||STATUS[0]).label);
  else groups=[["",list]];
  const total=project.scenes.filter(s=>s.status!=="omitted").length;
  const omitN=project.scenes.filter(s=>s.status==="omitted").length;
  return <div>
    <div style={{display:"flex",gap:10,alignItems:"center",marginBottom:11,flexWrap:"wrap"}}>
      <div style={{position:"relative",flex:1,minWidth:200}}><Search size={16} color={c.t2} style={{position:"absolute",left:11,top:13}}/><TextInput value={q} placeholder={`Search ${total} scenes…`} onChange={e=>setQ(e.target.value)} style={{paddingLeft:34}}/></div>
    </div>
    <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:9,flexWrap:"wrap"}}>
      <Label>Group</Label>
      <Segmented value={group} onChange={setGroup} options={[{k:"",label:"Story order"},{k:"day",label:"Shoot day"},{k:"location",label:"Location"},{k:"status",label:"Status"}]}/>
      {omitN>0&&<button onClick={()=>setShowOmit(v=>!v)} style={{marginLeft:"auto",fontFamily:UI,fontSize:12,color:showOmit?c.accent:c.t2,background:"none",border:"none",cursor:"pointer"}}>{showOmit?"Hide":"Show"} {omitN} cut</button>}
    </div>
    <div style={{display:"flex",gap:7,alignItems:"center",marginBottom:14,flexWrap:"wrap"}}>
      <Label>Filter</Label>
      {["INT","EXT","DAY","NIGHT"].map(t=>{const on=filt.includes(t);const col=(t==="INT"||t==="EXT")?slugColor(t):dnColor(t);return <button key={t} onClick={()=>setFilt(f=>f.includes(t)?f.filter(x=>x!==t):[...f,t])} style={{fontFamily:MONO,fontSize:11,fontWeight:700,letterSpacing:"0.04em",padding:"6px 12px",borderRadius:7,cursor:"pointer",minHeight:34,color:on?"#17120a":col,background:on?col:col+"18",border:`1px solid ${col}${on?"":"66"}`}}>{t}</button>;})}
      {filt.length>0&&<span style={{fontFamily:MONO,fontSize:11,color:c.t2}}>{list.length} match</span>}
      {filt.length>0&&<button onClick={()=>setFilt([])} style={{fontFamily:UI,fontSize:12,color:c.t2,background:"none",border:"none",cursor:"pointer"}}>clear</button>}
    </div>
    {list.length===0?<Empty icon={Film} title="No scenes yet" body="Import the script in the Import tab and your scenes will appear here, ready to prep."/>:
      groups.map(([g,items])=><div key={g||"all"} style={{marginBottom:g?18:0}}>
        {g&&<div style={{display:"flex",alignItems:"center",gap:9,margin:"4px 2px 9px"}}><div style={{fontFamily:UI,fontSize:12.5,fontWeight:700,color:c.t1,letterSpacing:"0.02em"}}>{g}</div><div style={{flex:1,height:1,background:c.line}}/><div style={{fontFamily:MONO,fontSize:11,color:c.t2}}>{items.length}</div></div>}
        <div style={{display:"flex",flexDirection:"column",gap:7}}>{items.map(s=><SceneRow key={s.number||s.storyIndex} s={s} locName={locName(s.locationId)} onClick={()=>onOpen(s.number)}/>)}</div>
      </div>)}
  </div>;
}
function groupBy(arr,fn){const m=new Map();for(const x of arr){const k=fn(x);if(!m.has(k))m.set(k,[]);m.get(k).push(x);}return [...m.entries()];}

/* SCENE PICKER (used by capture filing) */
function ScenePicker({open,scenes,onPick,onClose,suggestN}){
  const [q,setQ]=useState("");
  const list=scenes.filter(s=>s.status!=="omitted").filter(s=>!q.trim()||(s.number+" "+s.set+" "+s.slug).toLowerCase().includes(q.toLowerCase())).sort((a,b)=>(a.storyIndex??0)-(b.storyIndex??0));
  return <Modal open={open} onClose={onClose} title="File to scene">
    <div style={{position:"relative",marginBottom:12}}><Search size={16} color={c.t2} style={{position:"absolute",left:11,top:13}}/><TextInput autoFocus value={q} placeholder="Search scenes…" onChange={e=>setQ(e.target.value)} style={{paddingLeft:34}}/></div>
    <div style={{maxHeight:"46vh",overflowY:"auto",display:"flex",flexDirection:"column",gap:6}}>
      {list.map(s=><button key={s.number||s.storyIndex} onClick={()=>onPick(s.number)} style={{display:"flex",alignItems:"center",gap:11,padding:"9px 11px",background:s.number===suggestN?c.accentSoft:c.bg2,border:`1px solid ${s.number===suggestN?c.accent:c.line}`,borderRadius:9,cursor:"pointer",textAlign:"left"}}>
        <span style={{fontFamily:MONO,fontSize:14,fontWeight:700,color:c.accent,minWidth:36}}>{s.number}</span>
        <span style={{flex:1,minWidth:0}}><span style={{fontFamily:UI,fontSize:13.5,color:c.t0,fontWeight:600}}>{s.set}</span><span style={{fontFamily:MONO,fontSize:10,color:c.t2,marginLeft:7}}>{s.slug} {s.dayNight}</span></span>
        {s.number===suggestN&&<Chip color={c.accent} small><Sparkles size={10}/>AI</Chip>}
      </button>)}
    </div>
  </Modal>;
}

/* Move or copy a reference image to another scene. Copy keeps it on both (same stored image,
   no duplication of bytes); Move takes it off the source. Built for quick taps on iPad. */
function RefSendModal({open,fromNumber,scenes,onClose,onSend}){
  const [mode,setMode]=useState("copy"),[q,setQ]=useState("");
  useEffect(()=>{if(open){setMode("copy");setQ("");}},[open]);
  const list=scenes.filter(s=>s.status!=="omitted"&&s.number!==fromNumber).filter(s=>!q.trim()||(s.number+" "+s.set+" "+(s.syn||"")+" "+s.slug).toLowerCase().includes(q.toLowerCase())).sort((a,b)=>(a.storyIndex??0)-(b.storyIndex??0));
  return <Modal open={open} onClose={onClose} title="Send reference to a scene">
    <div style={{maxWidth:260,marginBottom:10}}><Segmented value={mode} onChange={v=>setMode(v||"copy")} options={[{k:"copy",label:"Copy"},{k:"move",label:"Move"}]}/></div>
    <div style={{fontFamily:UI,fontSize:12,color:c.t2,marginBottom:12,lineHeight:1.45}}>{mode==="copy"?"Keeps it here and adds it to the scene you pick.":"Removes it from this scene and adds it to the scene you pick."}</div>
    <div style={{position:"relative",marginBottom:12}}><Search size={16} color={c.t2} style={{position:"absolute",left:11,top:13}}/><TextInput autoFocus value={q} placeholder="Search scenes…" onChange={e=>setQ(e.target.value)} style={{paddingLeft:34}}/></div>
    <div style={{maxHeight:"44vh",overflowY:"auto",display:"flex",flexDirection:"column",gap:6}}>
      {list.map(s=><button key={s.number||s.storyIndex} onClick={()=>onSend(s.number,mode)} style={{display:"flex",alignItems:"center",gap:11,padding:"11px 11px",background:c.bg2,border:`1px solid ${c.line}`,borderRadius:9,cursor:"pointer",textAlign:"left"}}>
        <span style={{fontFamily:MONO,fontSize:14,fontWeight:700,color:c.accent,minWidth:36}}>{s.number}</span>
        <span style={{flex:1,minWidth:0}}><span style={{fontFamily:UI,fontSize:13.5,color:c.t0,fontWeight:600}}>{s.set||"Untitled"}</span><span style={{fontFamily:MONO,fontSize:10,color:c.t2,marginLeft:7}}>{s.slug} {s.dayNight}</span></span>
        {mode==="copy"?<Copy size={15} color={c.t2}/>:<ArrowRight size={15} color={c.t2}/>}
      </button>)}
    </div>
  </Modal>;
}

/* CAPTURE / INBOX — one place everything falls into */
function Capture({project,setProject,onFiled,onToast}){
  const [note,setNote]=useState(""),[link,setLink]=useState(""),[picker,setPicker]=useState(null),[hereLoc,setHereLoc]=useState(null),[geoBusy,setGeoBusy]=useState(false);
  const fileRef=useRef(null),camRef=useRef(null);
  const inbox=project.inbox||[];
  const setInbox=fn=>setProject(p=>({...p,inbox:fn(p.inbox||[])}));

  const candidateScenes=()=>hereLoc?project.scenes.filter(s=>s.locationId===hereLoc.id):project.scenes;
  const fileNew=async(item,guessInput,candidates)=>{setInbox(x=>[item,...x]);
    try{const g=await fileGuess(guessInput,candidates);if(g.n&&g.confidence>=0.8){doFile(item,g.n,g);onToast(`Filed to ${g.n}`,()=>unfile(item,g.n));}else setInbox(x=>x.map(i=>i.id===item.id?{...i,suggest:g}:i));}
    catch{setInbox(x=>x.map(i=>i.id===item.id?{...i,suggest:{n:"",confidence:0,why:""}}:i));}
  };
  const addNote=text=>{if(!text)return;const item={id:uid(),ts:Date.now(),suggest:null,kind:"note",text,locId:hereLoc?.id||null};fileNew(item,{kind:"note",text},candidateScenes());};
  const addLink=url=>{if(!url)return;const item={id:uid(),ts:Date.now(),suggest:null,kind:"link",url,locId:hereLoc?.id||null};fileNew(item,{kind:"link",text:url},candidateScenes());};
  const addImages=async files=>{for(const f of files){if(!f.type?.startsWith("image/"))continue;let gps=null;try{gps=await readExifGPS(f);}catch{}let lid=hereLoc?.id||null;if(!lid&&gps){const n=nearestLocation(project.locations,gps.lat,gps.lng);if(n&&n.km<0.6)lid=n.loc.id;}const dataUrl=await downscale(f);const imgId=await putImage(dataUrl);const item={id:uid(),ts:Date.now(),suggest:null,kind:"image",imgId,locId:lid};const cand=lid?project.scenes.filter(s=>s.locationId===lid):candidateScenes();fileNew(item,{kind:"image",dataUrl},cand);}};
  useEffect(()=>{const h=e=>{const fs=[...(e.clipboardData?.files||[])].filter(f=>f.type.startsWith("image/"));if(fs.length){e.preventDefault();addImages(fs);}};window.addEventListener("paste",h);return()=>window.removeEventListener("paste",h);},[hereLoc,project]);

  const doFile=(item,n,g)=>{setProject(p=>{const scenes=p.scenes.map(s=>{if(s.number!==n)return s;if(item.kind==="image")return {...s,refs:[...s.refs,item.imgId]};if(item.kind==="note")return {...s,notes:(s.notes?s.notes+"\n":"")+item.text};if(item.kind==="link")return {...s,notes:(s.notes?s.notes+"\n":"")+item.url};return s;});return {...p,scenes,inbox:(p.inbox||[]).filter(i=>i.id!==item.id)};});onFiled&&onFiled(n);};
  const unfile=(item,n)=>{setProject(p=>{const scenes=p.scenes.map(s=>{if(s.number!==n)return s;if(item.kind==="image")return {...s,refs:s.refs.filter(x=>x!==item.imgId)};if(item.kind==="note")return {...s,notes:(s.notes||"").replace("\n"+item.text,"").replace(item.text,"")};if(item.kind==="link")return {...s,notes:(s.notes||"").replace("\n"+item.url,"").replace(item.url,"")};return s;});return {...p,scenes,inbox:[{...item,suggest:item.suggest},...(p.inbox||[])]};});};

  const here=async()=>{setGeoBusy(true);try{const {lat,lng}=await whereAmI();const n=nearestLocation(project.locations,lat,lng);if(n&&n.km<1.2){setHereLoc(n.loc);onToast(`At ${n.loc.name} · ${(n.km*1000).toFixed(0)} m`);}else if(n){setHereLoc(null);onToast(`Nearest is ${n.loc.name}, ${n.km.toFixed(1)} km away`);}else onToast("No locations set yet");}catch{onToast("Couldn't get location");}setGeoBusy(false);};

  return <div>
    <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:18}}>
      <div onPaste={e=>{const fs=[...e.clipboardData.files];if(fs.length)addImages(fs);}} onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();addImages([...e.dataTransfer.files]);}}
        style={{border:`1.5px dashed ${c.line2}`,borderRadius:13,padding:"20px 16px",textAlign:"center"}}>
        <Inbox size={24} color={c.accent} style={{marginBottom:8}}/>
        <div style={{fontFamily:UI,fontSize:14,fontWeight:650,color:c.t0,marginBottom:3}}>Drop or paste anything</div>
        <div style={{fontFamily:UI,fontSize:12.5,color:c.t2,marginBottom:13}}>Images get read and filed to the right scene. Unsure ones wait here for one tap.</div>
        <div style={{display:"flex",gap:8,justifyContent:"center",flexWrap:"wrap"}}>
          <Btn kind="ghost" size={12} onClick={()=>fileRef.current.click()}><Upload size={15}/>Images</Btn>
          <Btn kind="ghost" size={12} onClick={()=>camRef.current.click()}><Camera size={15}/>Camera</Btn>
          <Btn kind={hereLoc?"primary":"ghost"} size={12} onClick={here} disabled={geoBusy}><Crosshair size={15}/>{geoBusy?"Locating…":hereLoc?hereLoc.name:"I'm here"}</Btn>
        </div>
        <input ref={fileRef} type="file" accept="image/*" multiple style={{display:"none"}} onChange={e=>{addImages([...e.target.files]);e.target.value="";}}/>
        <input ref={camRef} type="file" accept="image/*" capture="environment" style={{display:"none"}} onChange={e=>{addImages([...e.target.files]);e.target.value="";}}/>
      </div>
      <div style={{display:"flex",gap:8}}><TextInput value={note} placeholder="Type or dictate a note…" onChange={e=>setNote(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&note.trim()){addNote(note.trim());setNote("");}}}/><IconBtn icon={Plus} onClick={()=>{if(note.trim()){addNote(note.trim());setNote("");}}}/></div>
      <div style={{display:"flex",gap:8}}><TextInput value={link} placeholder="Paste a link…" onChange={e=>setLink(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&link.trim()){addLink(link.trim());setLink("");}}}/><IconBtn icon={Link2} onClick={()=>{if(link.trim()){addLink(link.trim());setLink("");}}}/></div>
      {hereLoc&&<div style={{fontFamily:UI,fontSize:12,color:c.accent,display:"flex",alignItems:"center",gap:6}}><Crosshair size={13}/>Filing is biased to {hereLoc.name}. <span onClick={()=>setHereLoc(null)} style={{color:c.t2,cursor:"pointer",textDecoration:"underline"}}>clear</span></div>}
    </div>

    {inbox.length===0?<Empty icon={Check} title="Inbox clear" body="Everything you capture lands here first, then files itself to a scene. Nothing waiting."/>:
      <div style={{display:"flex",flexDirection:"column",gap:9}}>
        <Label style={{marginBottom:2}}>Waiting · {inbox.length}</Label>
        {inbox.map(it=><div key={it.id} style={{display:"flex",alignItems:"center",gap:12,background:c.bg1,border:`1px solid ${c.line}`,borderRadius:11,padding:10}}>
          {it.kind==="image"?<StoredImg id={it.imgId} style={{width:54,height:54,borderRadius:8,objectFit:"cover",flexShrink:0}}/>:<div style={{width:54,height:54,borderRadius:8,background:c.bg2,display:"grid",placeItems:"center",flexShrink:0}}>{it.kind==="link"?<Link2 size={20} color={c.t2}/>:<PenLine size={20} color={c.t2}/>}</div>}
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontFamily:UI,fontSize:13,color:c.t0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{it.kind==="image"?"Image":it.kind==="link"?it.url:it.text}</div>
            {it.suggest?(it.suggest.n?<div style={{marginTop:4,display:"flex",alignItems:"center",gap:7}}><Chip color={c.accent} small onClick={()=>doFile(it,it.suggest.n,it.suggest)} active><Sparkles size={10}/>Scene {it.suggest.n}</Chip><span style={{fontFamily:UI,fontSize:11,color:c.t2}}>{it.suggest.why}</span></div>:<div style={{marginTop:4,fontFamily:UI,fontSize:11,color:c.t2}}>No clear match — pick a scene</div>):<div style={{marginTop:4,fontFamily:UI,fontSize:11,color:c.t2}}>Reading…</div>}
          </div>
          <div style={{display:"flex",gap:6,flexShrink:0}}>
            {it.suggest?.n&&<IconBtn icon={Check} size={17} onClick={()=>{doFile(it,it.suggest.n,it.suggest);onToast(`Filed to ${it.suggest.n}`,()=>unfile(it,it.suggest.n));}} title="File to suggestion"/>}
            <IconBtn icon={Search} size={17} dim onClick={()=>setPicker(it)} title="Pick scene"/>
            <IconBtn icon={Trash2} size={17} dim danger onClick={()=>setInbox(x=>x.filter(i=>i.id!==it.id))} title="Discard"/>
          </div>
        </div>)}
      </div>}
    <ScenePicker open={!!picker} scenes={project.scenes} suggestN={picker?.suggest?.n} onClose={()=>setPicker(null)} onPick={n=>{doFile(picker,n);onToast(`Filed to ${n}`,()=>unfile(picker,n));setPicker(null);}}/>
  </div>;
}

/* DAYS / TODAY — the schedule as the working unit */
function dayLocation(scenes,locations){for(const s of scenes){const l=locations.find(x=>x.id===s.locationId);if(l&&l.lat!=null&&l.lat!=="")return l;}return null;}
function DayCard({day,date,scenes,project,onOpen,today}){
  const loc=dayLocation(scenes,project.locations);
  const gear=useMemo(()=>{const map={camera:new Set(),grip:new Set(),electric:new Set()};scenes.forEach(s=>s.gearTags.forEach(id=>{const g=project.gear.find(x=>x.id===id);if(g&&map[g.dept])map[g.dept].add(g.name);}));return map;},[scenes,project.gear]);
  const hasGear=DEPTS.some(d=>gear[d.k].size);
  return <div style={{background:c.bg1,border:`1px solid ${today?c.accent:c.line}`,borderRadius:14,overflow:"hidden"}}>
    <div style={{padding:"13px 15px",borderBottom:`1px solid ${c.line}`,display:"flex",alignItems:"center",gap:12,flexWrap:"wrap",background:today?c.accentSoft:"transparent"}}>
      <div style={{display:"flex",alignItems:"baseline",gap:9}}><span style={{fontFamily:UI,fontSize:11,fontWeight:700,color:c.t2,letterSpacing:"0.08em"}}>DAY</span><span style={{fontFamily:MONO,fontSize:22,fontWeight:700,color:c.accent}}>{day}</span></div>
      {today&&<Chip color={c.accent} active>TODAY</Chip>}
      {date&&<Val size={13} style={{color:c.t1}}>{new Date(date+"T12:00").toLocaleDateString(undefined,{weekday:"short",month:"short",day:"numeric"})}</Val>}
      <div style={{flex:1}}/>
      <span style={{fontFamily:MONO,fontSize:12,color:c.t2}}>{scenes.length} {scenes.length===1?"scene":"scenes"}</span>
    </div>
    {loc&&<div style={{padding:"11px 15px",borderBottom:`1px solid ${c.line}`,display:"grid",gridTemplateColumns:"1fr",gap:9}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,flexWrap:"wrap"}}><Chip color={c.t1}><MapPin size={11}/>{loc.name}</Chip><div style={{display:"flex",gap:12,alignItems:"center"}}><WeatherInline lat={loc.lat} lng={loc.lng} date={date}/><TravelChip meta={project.meta} lat={loc.lat} lng={loc.lng}/></div></div>
      {date&&<SunBar lat={loc.lat} lng={loc.lng} tz={project.meta.tz} date={date}/>}
    </div>}
    <div style={{padding:"10px 12px",display:"flex",flexDirection:"column",gap:6}}>
      {scenes.map(s=><button key={s.number} onClick={()=>onOpen(s.number)} style={{display:"flex",alignItems:"center",gap:11,padding:"8px 10px",background:c.bg2,border:`1px solid ${c.line}`,borderRadius:9,cursor:"pointer",textAlign:"left"}}>
        <span style={{fontFamily:MONO,fontSize:11,color:c.t2,minWidth:18}}>{s.shootOrder||"—"}</span>
        <span style={{fontFamily:MONO,fontSize:14,fontWeight:700,color:c.accent,minWidth:34}}>{s.number}</span>
        <span style={{flex:1,minWidth:0,fontFamily:UI,fontSize:13,color:c.t0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{s.slug} {s.set} <span style={{color:c.t2,fontFamily:MONO,fontSize:10}}>{s.dayNight}</span></span>
        {s.refs.length>0&&<span style={{fontFamily:MONO,fontSize:10,color:c.t2}}>{s.refs.length}<ImageIcon size={10} style={{verticalAlign:"-1px",marginLeft:2}}/></span>}
      </button>)}
    </div>
    {hasGear&&<div style={{padding:"0 15px 14px"}}><div style={{borderTop:`1px solid ${c.line}`,paddingTop:11}}><Label style={{marginBottom:7}}>Gear this day</Label>{DEPTS.map(d=>gear[d.k].size?<div key={d.k} style={{display:"flex",gap:7,marginBottom:5,alignItems:"flex-start"}}><span style={{fontFamily:MONO,fontSize:10,color:c.t2,minWidth:58,paddingTop:3}}>{d.label}</span><div style={{display:"flex",flexWrap:"wrap",gap:5}}>{[...gear[d.k]].map(n=><Chip key={n} small>{n}</Chip>)}</div></div>:null)}</div></div>}
  </div>;
}
function CalendarView({project,onOpen}){
  const byDate=useMemo(()=>{const m=new Map();for(const s of project.scenes){if(s.status==="omitted"||!s.shootDay||!s.shootDate)continue;if(!m.has(s.shootDate))m.set(s.shootDate,{day:s.shootDay,scenes:[]});m.get(s.shootDate).scenes.push(s);}return m;},[project.scenes]);
  const dates=[...byDate.keys()].sort();
  const [ym,setYm]=useState((dates[0]||todayISO()).slice(0,7));
  const [y,mo]=ym.split("-").map(Number);
  const firstDow=new Date(Date.UTC(y,mo-1,1)).getUTCDay();
  const dim=new Date(Date.UTC(y,mo,0)).getUTCDate();
  const cells=[];for(let i=0;i<firstDow;i++)cells.push(null);for(let d=1;d<=dim;d++)cells.push(d);
  const ti=todayISO();
  const monthName=new Date(Date.UTC(y,mo-1,1)).toLocaleDateString(undefined,{month:"long",year:"numeric",timeZone:"UTC"});
  const shift=n=>{let mm=mo-1+n,yy=y;while(mm<0){mm+=12;yy--;}while(mm>11){mm-=12;yy++;}setYm(`${yy}-${String(mm+1).padStart(2,"0")}`);};
  return <div>
    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
      <IconBtn icon={ChevronLeft} onClick={()=>shift(-1)} dim title="Previous month"/>
      <div style={{fontFamily:UI,fontSize:15,fontWeight:700,color:c.t0}}>{monthName}</div>
      <IconBtn icon={ChevronRight} onClick={()=>shift(1)} dim title="Next month"/>
    </div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:6}}>
      {["Su","Mo","Tu","We","Th","Fr","Sa"].map(d=><div key={d} style={{textAlign:"center",fontFamily:MONO,fontSize:10,color:c.t2,padding:"2px 0"}}>{d}</div>)}
      {cells.map((d,i)=>{
        if(!d)return <div key={"e"+i}/>;
        const key=`${ym}-${String(d).padStart(2,"0")}`;const sh=byDate.get(key);const today=key===ti;
        return <div key={key} onClick={()=>sh&&onOpen&&onOpen(sh.scenes[0].number)} style={{minHeight:62,borderRadius:9,border:`1px solid ${today?c.accent:c.line}`,background:sh?c.accentSoft:c.bg1,padding:"6px 7px",cursor:sh?"pointer":"default",display:"flex",flexDirection:"column",gap:2}}>
          <div style={{fontFamily:MONO,fontSize:11,color:today?c.accent:c.t2,fontWeight:today?700:400}}>{d}</div>
          {sh&&<><div style={{fontFamily:UI,fontSize:10.5,fontWeight:700,color:c.accent}}>Day {sh.day}</div><div style={{fontFamily:MONO,fontSize:9.5,color:c.t2}}>{sh.scenes.length} sc</div></>}
        </div>;
      })}
    </div>
  </div>;
}
function Days({project,onOpen}){
  const [mode,setMode]=useState("list");
  const present=project.scenes.filter(s=>s.status!=="omitted"&&s.shootDay);
  const days=groupBy([...present].sort((a,b)=>(a.shootOrder||0)-(b.shootOrder||0)),s=>s.shootDay).map(([day,scenes])=>({day,scenes,date:scenes.find(s=>s.shootDate)?.shootDate||""}));
  days.sort((a,b)=>cmpNum(a.day,b.day));
  const ti=todayISO();const todayIdx=days.findIndex(d=>d.date===ti);
  const ordered=todayIdx>=0?[days[todayIdx],...days.filter((_,i)=>i!==todayIdx)]:days;
  const unsched=project.scenes.filter(s=>s.status!=="omitted"&&!s.shootDay).length;
  if(!days.length)return <Empty icon={Calendar} title="No schedule yet" body="Drop the shooting schedule in Import, or feed Claude the call sheet. Your days build themselves, with sun, weather, and a gear rollup each."/>;
  return <div style={{display:"flex",flexDirection:"column",gap:14}}>
    <div style={{display:"flex",justifyContent:"flex-end"}}><div style={{width:200}}><Segmented value={mode} onChange={v=>setMode(v||"list")} options={[{k:"list",label:"List"},{k:"calendar",label:"Calendar"}]}/></div></div>
    {mode==="calendar"?<CalendarView project={project} onOpen={onOpen}/>:<>
      {todayIdx<0&&<div style={{fontFamily:UI,fontSize:12.5,color:c.t2,display:"flex",alignItems:"center",gap:7}}><Clock size={14}/>No shoot day falls on today ({ti}).</div>}
      {ordered.map(d=><DayCard key={d.day} {...d} project={project} onOpen={onOpen} today={d.date===ti&&!!ti}/>)}
      {unsched>0&&<div style={{fontFamily:UI,fontSize:12.5,color:c.t2,textAlign:"center"}}>{unsched} scene{unsched>1?"s":""} not yet on the schedule.</div>}
    </>}
  </div>;
}
function Dashboard({project,onOpen,onNav}){
  const ti=todayISO();
  const present=project.scenes.filter(s=>s.status!=="omitted"&&s.shootDay);
  const dayList=groupBy([...present].sort((a,b)=>(a.shootOrder||0)-(b.shootOrder||0)),s=>s.shootDay).map(([day,scenes])=>({day,scenes,date:scenes.find(s=>s.shootDate)?.shootDate||""}));
  dayList.sort((a,b)=>cmpNum(a.day,b.day));
  const today=dayList.find(d=>d.date===ti);
  const upcoming=dayList.filter(d=>d.date&&d.date>ti).slice(0,3);
  const crew=project.crew||{camera:[],grip:[],electric:[]};
  const crewCount=DEPTS.reduce((n,d)=>n+(crew[d.k]||[]).length,0);
  const Hero=({d,big})=>{const loc=dayLocation(d.scenes,project.locations);return <div style={{background:c.bg1,border:`1px solid ${big?c.accent:c.line}`,borderRadius:14,overflow:"hidden"}}>
    <div style={{padding:"13px 15px",borderBottom:`1px solid ${c.line}`,display:"flex",alignItems:"center",gap:11,flexWrap:"wrap",background:big?c.accentSoft:"transparent"}}>
      <span style={{fontFamily:UI,fontSize:11,fontWeight:700,color:c.t2}}>DAY</span><span style={{fontFamily:MONO,fontSize:big?24:18,fontWeight:700,color:c.accent}}>{d.day}</span>
      {big&&<Chip color={c.accent} active>TODAY</Chip>}
      {d.date&&<Val size={13} style={{color:c.t1}}>{new Date(d.date+"T12:00").toLocaleDateString(undefined,{weekday:"short",month:"short",day:"numeric"})}</Val>}
      <div style={{flex:1}}/>{loc&&<Chip color={c.t1}><MapPin size={11}/>{loc.name}</Chip>}
    </div>
    {big&&loc&&loc.lat&&<div style={{padding:"11px 15px",borderBottom:`1px solid ${c.line}`}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6,gap:10,flexWrap:"wrap"}}><WeatherInline lat={loc.lat} lng={loc.lng} date={d.date}/><TravelChip meta={project.meta} lat={loc.lat} lng={loc.lng}/></div><SunBar lat={loc.lat} lng={loc.lng} tz={project.meta.tz} date={d.date}/></div>}
    <div style={{padding:"10px 12px",display:"flex",flexWrap:"wrap",gap:6}}>{d.scenes.map(s=><button key={s.number} onClick={()=>onOpen(s.number)} style={{fontFamily:MONO,fontSize:13,fontWeight:700,color:c.accent,background:c.accentSoft,border:`1px solid ${c.accent}55`,borderRadius:7,padding:"5px 10px",cursor:"pointer"}}>{s.number}</button>)}</div>
  </div>;};
  return <div style={{display:"flex",flexDirection:"column",gap:16,maxWidth:980}}>
    {today?<Hero d={today} big/>:<div style={{background:c.bg1,border:`1px solid ${c.line}`,borderRadius:14,padding:"15px 16px",fontFamily:UI,fontSize:13.5,color:c.t1}}>No shoot scheduled today ({ti}).{upcoming[0]?` Next: Day ${upcoming[0].day}${upcoming[0].date?" on "+new Date(upcoming[0].date+"T12:00").toLocaleDateString(undefined,{weekday:"short",month:"short",day:"numeric"}):""}.`:""}</div>}
    {upcoming.length>0&&<div><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}><Label>Next up</Label><button onClick={()=>onNav("days")} style={{background:"none",border:"none",color:c.accent,fontFamily:UI,fontSize:12,cursor:"pointer"}}>Full schedule →</button></div><div style={{display:"flex",flexDirection:"column",gap:9}}>{upcoming.map(d=><Hero key={d.day} d={d}/>)}</div></div>}
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:13}}>
      <div style={{background:c.bg1,border:`1px solid ${c.line}`,borderRadius:13,padding:14}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}><Label>Crew</Label><button onClick={()=>onNav("crew")} style={{background:"none",border:"none",color:c.accent,fontFamily:UI,fontSize:12,cursor:"pointer"}}>Open →</button></div>
        {crewCount===0?<div style={{fontFamily:UI,fontSize:12.5,color:c.t2}}>None yet. Feed Claude the call sheet.</div>:DEPTS.map(d=>(crew[d.k]||[]).length?<div key={d.k} style={{display:"flex",gap:8,marginBottom:6,alignItems:"baseline"}}><span style={{fontFamily:MONO,fontSize:10,color:c.t2,minWidth:58}}>{d.label}</span><span style={{fontFamily:UI,fontSize:12.5,color:c.t1}}>{(crew[d.k]||[]).map(m=>m.name).join(", ")}</span></div>:null)}
      </div>
      <div style={{background:c.bg1,border:`1px solid ${c.line}`,borderRadius:13,padding:14}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}><Label>Key contacts</Label><button onClick={()=>onNav("contacts")} style={{background:"none",border:"none",color:c.accent,fontFamily:UI,fontSize:12,cursor:"pointer"}}>Open →</button></div>
        {(project.contacts||[]).length===0?<div style={{fontFamily:UI,fontSize:12.5,color:c.t2}}>None yet.</div>:project.contacts.slice(0,5).map(ct=><div key={ct.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:8,marginBottom:7}}><div style={{minWidth:0}}><div style={{fontFamily:UI,fontSize:13,color:c.t0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{ct.name}</div>{ct.role&&<div style={{fontFamily:UI,fontSize:11,color:c.t2}}>{ct.role}</div>}</div><div style={{display:"flex",gap:9,flexShrink:0}}>{ct.phone&&<a href={`tel:${ct.phone}`} style={{color:c.t1}}><Phone size={14}/></a>}{ct.email&&<a href={`mailto:${ct.email}`} style={{color:c.t1}}><Mail size={14}/></a>}</div></div>)}
      </div>
    </div>
  </div>;
}

/* LOCATIONS */
function nextDateForLoc(scenes,locId){const ds=scenes.filter(s=>s.locationId===locId&&s.shootDate).map(s=>s.shootDate).sort();const t=todayISO();return ds.find(d=>d>=t)||ds[0]||"";}
function LocationEditor({open,init,tz,date,onClose,onSave,onDelete}){
  const [f,set,setF]=useForm(init,open);
  const [dragF,setDragF]=useState("");
  // While the editor is open, swallow page-level drops so a near-miss outside the dashed zone
  // does not make the browser navigate to the image file (the old silent "nothing happened").
  useEffect(()=>{if(!open)return;const stop=e=>{e.preventDefault();};window.addEventListener("dragover",stop);window.addEventListener("drop",stop);return()=>{window.removeEventListener("dragover",stop);window.removeEventListener("drop",stop);};},[open]);
  const useHere=async()=>{try{const {lat,lng}=await whereAmI();setF(p=>({...p,lat:lat.toFixed(6),lng:lng.toFixed(6)}));}catch{}};
  const addToList=async(field,files)=>{const ids=[];let gps=null;for(const file of [...files]){if(!file.type.startsWith("image/"))continue;if(field==="images"&&!gps){try{gps=await readExifGPS(file);}catch{}}try{ids.push(await putImage(await downscale(file)));}catch{}}if(ids.length||gps)setF(p=>{const next={...p,[field]:[...(p[field]||[]),...ids]};if(field==="images"&&gps&&!String(p.lat||"").trim()&&!String(p.lng||"").trim()){next.lat=gps.lat.toFixed(6);next.lng=gps.lng.toFixed(6);}return next;});};
  const dropList=field=>async e=>{e.preventDefault();e.stopPropagation();const files=[...(e.dataTransfer.files||[])].filter(x=>x.type.startsWith("image/"));if(files.length)return addToList(field,files);let url=(e.dataTransfer.getData("text/uri-list")||"").split("\n").find(l=>l&&!l.startsWith("#"))||"";if(!url){const h=e.dataTransfer.getData("text/html")||"";const m=h.match(/<img[^>]+src=["']([^"']+)["']/i);if(m)url=m[1];}url=(url||"").trim();if(isImgUrl(url))setF(p=>({...p,[field]:[...(p[field]||[]),url]}));};
  const removeFrom=(field,v)=>setF(p=>({...p,[field]:(p[field]||[]).filter(x=>x!==v)}));
  const Strip=({field,label,hint})=><div style={{gridColumn:"1/3"}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}><Label>{label}{(f[field]||[]).length?` · ${f[field].length}`:""}</Label><label style={{cursor:"pointer"}}><Btn kind="ghost" size={12}><Upload size={14}/>Add</Btn><input type="file" accept="image/*" multiple style={{display:"none"}} onChange={e=>{addToList(field,e.target.files);e.target.value="";}}/></label></div>
    <div onDragOver={e=>{e.preventDefault();e.stopPropagation();if(dragF!==field)setDragF(field);}} onDragLeave={e=>{if(e.currentTarget===e.target)setDragF("");}} onDrop={e=>{setDragF("");dropList(field)(e);}} style={{border:`1.5px dashed ${dragF===field?c.accent:c.line2}`,background:dragF===field?c.accentSoft:"transparent",borderRadius:10,padding:13,minHeight:62}}>
      {(f[field]||[]).length===0?<div style={{fontFamily:UI,fontSize:12,color:dragF===field?c.accent:c.t2,textAlign:"center",padding:"10px 0"}}>{dragF===field?"Drop to add":hint}</div>:
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(72px,1fr))",gap:7}}>
          {(f[field]||[]).map(v=><div key={v} style={{position:"relative",aspectRatio:"1",borderRadius:8,overflow:"hidden",border:`1px solid ${c.line2}`}}><StoredImg id={v} style={{width:"100%",height:"100%",objectFit:"cover"}}/><button onClick={()=>removeFrom(field,v)} style={{position:"absolute",top:3,right:3,width:20,height:20,borderRadius:"50%",border:"none",background:"#000a",color:"#fff",cursor:"pointer",display:"grid",placeItems:"center"}}><X size={12}/></button></div>)}
        </div>}
    </div>
  </div>;
  return <Modal open={open} onClose={onClose} title={init?.id?"Edit location":"New location"} wide
    footer={<>{init?.id&&<Btn kind="danger" onClick={()=>{onDelete(init.id);onClose();}}><Trash2 size={15}/>Delete</Btn>}<Btn kind="ghost" onClick={onClose}>Cancel</Btn><Btn kind="primary" onClick={()=>{onSave(f);onClose();}} disabled={!f.name}>Save</Btn></>}>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:13}}>
      <Field label="Name" style={{gridColumn:"1/3"}}><TextInput value={f.name||""} onChange={e=>set("name",e.target.value)} placeholder="Bride's apartment"/></Field>
      <Field label="Address" style={{gridColumn:"1/3"}}><TextInput value={f.address||""} onChange={e=>set("address",e.target.value)} placeholder="Street, city"/></Field>
      <Field label="Latitude"><TextInput value={f.lat||""} onChange={e=>set("lat",e.target.value)} placeholder="52.231"/></Field>
      <Field label="Longitude"><TextInput value={f.lng||""} onChange={e=>set("lng",e.target.value)} placeholder="21.006"/></Field>
      <div style={{gridColumn:"1/3",display:"flex",gap:8,flexWrap:"wrap"}}>
        <Btn kind="ghost" size={12} onClick={useHere}><Crosshair size={14}/>Use my location</Btn>
        {f.address&&<a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(f.address)}`} target="_blank" rel="noreferrer" style={{textDecoration:"none"}}><Btn kind="ghost" size={12}><MapPin size={14}/>Find on Maps</Btn></a>}
        {f.lat&&<a href={`https://earth.google.com/web/search/${f.lat},${f.lng}`} target="_blank" rel="noreferrer" style={{textDecoration:"none"}}><Btn kind="ghost" size={12}><Compass size={14}/>Google Earth</Btn></a>}
      </div>
      <Field label="Filing radius (m)"><TextInput type="number" value={f.radius||""} onChange={e=>set("radius",e.target.value)} placeholder="150"/></Field>
      <div/>
      <Strip field="images" label="Photos" hint="Drop or add location photos. Drag straight from a website or your desktop."/>
      <Strip field="plans" label="Floor plans (art dept)" hint="Drop the floor plans the art department provides."/>
      <Field label="Notes" style={{gridColumn:"1/3"}}><TextArea value={f.notes||""} onChange={e=>set("notes",e.target.value)} placeholder="Access, parking, power, contacts…"/></Field>
    </div>
    {f.lat&&f.lng&&<div style={{marginTop:15,borderTop:`1px solid ${c.line}`,paddingTop:15,display:"flex",flexDirection:"column",gap:14}}>
      <div><Label style={{marginBottom:8}}>Sun · {date}</Label><SunPanel lat={f.lat} lng={f.lng} tz={tz} date={date}/></div>
      <WeatherCard lat={f.lat} lng={f.lng} tz={tz} date={date}/>
    </div>}
  </Modal>;
}
function Locations({project,setProject,onOpen,openLightbox,onToast}){
  const [ed,setEd]=useState(null);
  const [dropId,setDropId]=useState("");
  const save=l=>setProject(p=>({...p,locations:l.id?p.locations.map(x=>x.id===l.id?l:x):[...p.locations,{...l,id:uid(),images:l.images||[],plans:l.plans||[]}]}));
  const del=id=>setProject(p=>({...p,locations:p.locations.filter(x=>x.id!==id),scenes:p.scenes.map(s=>s.locationId===id?{...s,locationId:""}:s)}));
  const addImagesToLoc=async(locId,files)=>{const ids=[];let gps=null;for(const f of [...files]){if(!f.type.startsWith("image/"))continue;if(!gps){try{gps=await readExifGPS(f);}catch{}}try{ids.push(await putImage(await downscale(f)));}catch{}}if(!ids.length&&!gps)return;setProject(p=>({...p,locations:p.locations.map(l=>{if(l.id!==locId)return l;const next={...l,images:[...(l.images||[]),...ids],imgId:l.imgId||ids[0]||""};if(gps&&!String(l.lat||"").trim()&&!String(l.lng||"").trim()){next.lat=gps.lat.toFixed(6);next.lng=gps.lng.toFixed(6);}return next;})}));onToast&&onToast(ids.length?`${ids.length} photo${ids.length>1?"s":""} added to location`:"Location GPS set from photo");};
  return <div onDragOver={e=>{if([...(e.dataTransfer?.types||[])].includes("Files")){e.preventDefault();}}} onDrop={e=>{if([...(e.dataTransfer?.types||[])].includes("Files"))e.preventDefault();}}>
    <div style={{display:"flex",justifyContent:"flex-end",marginBottom:13}}><Btn kind="primary" size={12} onClick={()=>setEd({})}><Plus size={16}/>Location</Btn></div>
    {project.locations.length===0?<Empty icon={MapPin} title="No locations yet" body="Add the places you're shooting. Each gets sun direction, weather, travel time from base, a photo gallery, floor plans, and the scenes shot there." action={<Btn kind="primary" onClick={()=>setEd({})}><Plus size={16}/>Add location</Btn>}/>:
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(300px,1fr))",gap:13}}>
        {project.locations.map(l=>{
          const here=project.scenes.filter(s=>s.locationId===l.id&&s.status!=="omitted").sort((a,b)=>cmpNum(a.number,b.number));
          const date=nextDateForLoc(project.scenes,l.id)||todayISO();
          const hero=l.imgId||(l.images&&l.images[0])||"";
          const mapsHref=l.address?`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(l.address)}`:(l.lat?`https://www.google.com/maps/search/?api=1&query=${l.lat},${l.lng}`:null);
          const earthHref=l.lat?`https://earth.google.com/web/search/${l.lat},${l.lng}`:null;
          const gallery=(l.images&&l.images.length?l.images:(hero?[hero]:[]));
          return <div key={l.id}
            onDragOver={e=>{if([...(e.dataTransfer?.types||[])].includes("Files")){e.preventDefault();e.stopPropagation();if(dropId!==l.id)setDropId(l.id);}}}
            onDragLeave={e=>{if(e.currentTarget===e.target)setDropId("");}}
            onDrop={e=>{e.preventDefault();e.stopPropagation();setDropId("");const files=[...(e.dataTransfer.files||[])].filter(x=>x.type.startsWith("image/"));if(files.length)addImagesToLoc(l.id,files);}}
            style={{background:c.bg1,border:`1px solid ${dropId===l.id?c.accent:c.line}`,borderRadius:13,overflow:"hidden",outline:dropId===l.id?`2px dashed ${c.accent}`:"none",outlineOffset:-2}}>
            {hero?<StoredImg id={hero} style={{width:"100%",height:130,objectFit:"cover",display:"block",cursor:"zoom-in"}} onClick={()=>openLightbox&&openLightbox(gallery,Math.max(0,gallery.indexOf(hero)))}/>:<div style={{height:8}}/>}
            <div style={{padding:14}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8}}><div style={{minWidth:0}}><div style={{fontFamily:UI,fontSize:16,fontWeight:700,color:c.t0}}>{l.name}</div>{l.address&&<div style={{fontFamily:UI,fontSize:12,color:c.t2,marginTop:2}}>{l.address}</div>}</div><div style={{display:"flex",gap:6,flexShrink:0,alignItems:"center"}}>{earthHref&&<a href={earthHref} target="_blank" rel="noreferrer" title="Google Earth fly-around" style={{color:c.t2,display:"flex"}}><Compass size={16}/></a>}{mapsHref&&<a href={mapsHref} target="_blank" rel="noreferrer" title="Maps" style={{color:c.t2,display:"flex"}}><MapPin size={16}/></a>}<IconBtn icon={Settings} size={16} dim onClick={()=>setEd(l)}/></div></div>
              <div style={{display:"flex",gap:10,margin:"10px 0",alignItems:"center",flexWrap:"wrap"}}>{l.lat&&<TravelChip meta={project.meta} lat={l.lat} lng={l.lng}/>}{l.lat&&<WeatherInline lat={l.lat} lng={l.lng} date={date}/>}{l.images&&l.images.length>0&&<Chip color={c.t2}><ImageIcon size={11}/>{l.images.length}</Chip>}{l.plans&&l.plans.length>0&&<Chip color={c.t2}>{l.plans.length} plan{l.plans.length>1?"s":""}</Chip>}</div>
              {l.lat&&<SunBar lat={l.lat} lng={l.lng} tz={project.meta.tz} date={date}/>}
              <div style={{marginTop:11}}><Label style={{marginBottom:6}}>Scenes here{here.length?` · ${here.length}`:""}</Label>
                {here.length===0?<div style={{fontFamily:UI,fontSize:12,color:c.t2}}>No scenes linked yet.</div>:
                  <div style={{display:"flex",flexWrap:"wrap",gap:6}}>{here.map(s=><button key={s.number} onClick={()=>onOpen&&onOpen(s.number)} title={`${s.slug} ${s.set} ${s.dayNight}`} style={{fontFamily:MONO,fontSize:12,fontWeight:700,color:c.accent,background:c.accentSoft,border:`1px solid ${c.accent}55`,borderRadius:7,padding:"4px 9px",cursor:"pointer"}}>{s.number}</button>)}</div>}
              </div>
            </div>
          </div>;})}
      </div>}
    <LocationEditor open={!!ed} init={ed} tz={project.meta.tz} date={ed&&ed.id?(nextDateForLoc(project.scenes,ed.id)||todayISO()):todayISO()} onClose={()=>setEd(null)} onSave={save} onDelete={del}/>
  </div>;
}

/* CREW — Camera, Grip, Electric. Names you can hear. */
function CrewEditor({open,dept,init,onClose,onSave,onDelete}){
  const [f,set]=useForm(init,open);
  return <Modal open={open} onClose={onClose} title={init?.id?"Edit crew":`Add to ${DEPTS.find(d=>d.k===dept)?.label}`}
    footer={<>{init?.id&&<Btn kind="danger" onClick={()=>{onDelete(init.id);onClose();}}><Trash2 size={15}/>Remove</Btn>}<Btn kind="ghost" onClick={onClose}>Cancel</Btn><Btn kind="primary" disabled={!f.name} onClick={()=>{onSave(f);onClose();}}>Save</Btn></>}>
    <div style={{display:"flex",flexDirection:"column",gap:13}}>
      <Field label="Name"><TextInput value={f.name||""} onChange={e=>set("name",e.target.value)} placeholder="Marcin Studniarek"/></Field>
      <Field label="Role"><TextInput value={f.role||""} onChange={e=>set("role",e.target.value)} placeholder="1st AC"/></Field>
      <Field label="Pronunciation"><div style={{display:"flex",gap:8}}><TextInput value={f.pron||""} onChange={e=>set("pron",e.target.value)} placeholder="MAR-cheen stood-NYAR-ek"/><IconBtn icon={Volume2} onClick={()=>say(f.pron||f.name)} title="Hear it"/></div></Field>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:11}}><Field label="Phone"><TextInput value={f.phone||""} onChange={e=>set("phone",e.target.value)}/></Field><Field label="Email"><TextInput value={f.email||""} onChange={e=>set("email",e.target.value)}/></Field></div>
    </div>
  </Modal>;
}
function Crew({project,setProject}){
  const [ed,setEd]=useState(null);
  const crew=project.crew||{camera:[],grip:[],electric:[]};
  const save=(dept,m)=>setProject(p=>{const list=p.crew[dept]||[];return {...p,crew:{...p.crew,[dept]:m.id?list.map(x=>x.id===m.id?m:x):[...list,{...m,id:uid()}]}};});
  const del=(dept,id)=>setProject(p=>({...p,crew:{...p.crew,[dept]:(p.crew[dept]||[]).filter(x=>x.id!==id)}}));
  return <div style={{display:"flex",flexDirection:"column",gap:16}}>
    {DEPTS.map(d=><div key={d.k}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}><div style={{fontFamily:UI,fontSize:15,fontWeight:700,color:c.t0}}>{d.label}</div><IconBtn icon={Plus} size={18} onClick={()=>setEd({dept:d.k,m:{}})}/></div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(250px,1fr))",gap:10}}>
        {(crew[d.k]||[]).length===0&&<div style={{fontFamily:UI,fontSize:12.5,color:c.t2,border:`1px dashed ${c.line2}`,borderRadius:10,padding:14}}>No {d.label.toLowerCase()} crew yet.</div>}
        {(crew[d.k]||[]).map(m=><div key={m.id} style={{background:c.bg1,border:`1px solid ${c.line}`,borderRadius:11,padding:13}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}><div style={{minWidth:0}}><div style={{fontFamily:UI,fontSize:15,fontWeight:700,color:c.t0}}>{m.name}</div>{m.role&&<div style={{fontFamily:UI,fontSize:12,color:c.accent,marginTop:1}}>{m.role}</div>}</div><div style={{display:"flex",gap:4}}><IconBtn icon={Volume2} size={15} dim onClick={()=>say(m.pron||m.name)} title="Hear name"/><IconBtn icon={Settings} size={15} dim onClick={()=>setEd({dept:d.k,m})}/></div></div>
          {m.pron&&<div style={{fontFamily:MONO,fontSize:11,color:c.t2,marginTop:5}}>{m.pron}</div>}
          <div style={{display:"flex",gap:13,marginTop:9}}>{m.phone&&<a href={`tel:${m.phone}`} style={{color:c.t1,textDecoration:"none"}}><Phone size={14}/></a>}{m.email&&<a href={`mailto:${m.email}`} style={{color:c.t1,textDecoration:"none"}}><Mail size={14}/></a>}</div>
        </div>)}
      </div>
    </div>)}
    <CrewEditor open={!!ed} dept={ed?.dept} init={ed?.m} onClose={()=>setEd(null)} onSave={m=>save(ed.dept,m)} onDelete={id=>del(ed.dept,id)}/>
  </div>;
}

/* GEAR master list (free text, 3 depts) */
function Gear({project,setProject}){
  const [t,setT]=useState(""),[dept,setDept]=useState("camera");
  const gear=project.gear||[];
  const add=()=>{const v=t.trim();if(!v)return;if(gear.some(g=>g.name.toLowerCase()===v.toLowerCase()&&g.dept===dept)){setT("");return;}setProject(p=>({...p,gear:[...p.gear,{id:uid(),name:v,dept}]}));setT("");};
  const del=id=>setProject(p=>({...p,gear:p.gear.filter(g=>g.id!==id),scenes:p.scenes.map(s=>({...s,gearTags:s.gearTags.filter(x=>x!==id)}))}));
  const usage=id=>project.scenes.filter(s=>s.status!=="omitted"&&s.gearTags.includes(id)).length;
  return <div>
    <div style={{display:"flex",gap:8,marginBottom:16,alignItems:"center"}}>
      <div style={{display:"flex",gap:4}}>{DEPTS.map(d=><button key={d.k} onClick={()=>setDept(d.k)} style={{padding:"0 12px",height:42,borderRadius:8,border:`1px solid ${dept===d.k?c.accent:c.line2}`,background:dept===d.k?c.accentSoft:c.bg2,color:dept===d.k?c.accent:c.t2,fontFamily:UI,fontSize:13,fontWeight:650,cursor:"pointer"}}>{d.label}</button>)}</div>
      <TextInput value={t} placeholder="Add gear (free text)…" onChange={e=>setT(e.target.value)} onKeyDown={e=>e.key==="Enter"&&add()}/>
      <IconBtn icon={Plus} onClick={add}/>
    </div>
    {DEPTS.map(d=>{const items=gear.filter(g=>g.dept===d.k);return <div key={d.k} style={{marginBottom:16}}>
      <div style={{display:"flex",alignItems:"center",gap:9,marginBottom:9}}><div style={{fontFamily:UI,fontSize:13.5,fontWeight:700,color:c.t1}}>{d.label}</div><div style={{flex:1,height:1,background:c.line}}/><div style={{fontFamily:MONO,fontSize:11,color:c.t2}}>{items.length}</div></div>
      {items.length===0?<div style={{fontFamily:UI,fontSize:12,color:c.t2}}>Nothing yet.</div>:
        <div style={{display:"flex",flexWrap:"wrap",gap:8}}>{items.map(g=>{const u=usage(g.id);return <span key={g.id} style={{display:"inline-flex",alignItems:"center",gap:7,background:c.bg1,border:`1px solid ${c.line2}`,borderRadius:8,padding:"7px 10px"}}><span style={{fontFamily:UI,fontSize:13,color:c.t0}}>{g.name}</span>{u>0&&<span style={{fontFamily:MONO,fontSize:10,color:c.t2}} title={`on ${u} scenes`}>{u}</span>}<X size={13} style={{cursor:"pointer",color:c.t2}} onClick={()=>del(g.id)}/></span>;})}</div>}
    </div>;})}
  </div>;
}

/* CONTACTS */
function ContactEditor({open,init,onClose,onSave,onDelete}){
  const [f,set]=useForm(init,open);
  return <Modal open={open} onClose={onClose} title={init?.id?"Edit contact":"New contact"}
    footer={<>{init?.id&&<Btn kind="danger" onClick={()=>{onDelete(init.id);onClose();}}><Trash2 size={15}/>Delete</Btn>}<Btn kind="ghost" onClick={onClose}>Cancel</Btn><Btn kind="primary" disabled={!f.name} onClick={()=>{onSave(f);onClose();}}>Save</Btn></>}>
    <div style={{display:"flex",flexDirection:"column",gap:13}}>
      <Field label="Name"><TextInput value={f.name||""} onChange={e=>set("name",e.target.value)} placeholder="ATM System / WFDiF lab / rental"/></Field>
      <Field label="What they are"><TextInput value={f.role||""} onChange={e=>set("role",e.target.value)} placeholder="Camera rental, lab, production office…"/></Field>
      <Field label="Address"><TextInput value={f.address||""} onChange={e=>set("address",e.target.value)}/></Field>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:11}}><Field label="Latitude"><TextInput value={f.lat||""} onChange={e=>set("lat",e.target.value)}/></Field><Field label="Longitude"><TextInput value={f.lng||""} onChange={e=>set("lng",e.target.value)}/></Field></div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:11}}><Field label="Phone"><TextInput value={f.phone||""} onChange={e=>set("phone",e.target.value)}/></Field><Field label="Email"><TextInput value={f.email||""} onChange={e=>set("email",e.target.value)}/></Field></div>
    </div>
  </Modal>;
}
function Contacts({project,setProject}){
  const [ed,setEd]=useState(null);
  const save=ct=>setProject(p=>({...p,contacts:ct.id?p.contacts.map(x=>x.id===ct.id?ct:x):[...p.contacts,{...ct,id:uid()}]}));
  const del=id=>setProject(p=>({...p,contacts:p.contacts.filter(x=>x.id!==id)}));
  return <div>
    <div style={{display:"flex",justifyContent:"flex-end",marginBottom:13}}><Btn kind="primary" size={12} onClick={()=>setEd({})}><Plus size={16}/>Contact</Btn></div>
    {(project.contacts||[]).length===0?<Empty icon={Building2} title="No contacts yet" body="Production office, rental houses, the lab, vendors. Address, travel time from base, one tap to call." action={<Btn kind="primary" onClick={()=>setEd({})}><Plus size={16}/>Add contact</Btn>}/>:
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(270px,1fr))",gap:11}}>
        {project.contacts.map(ct=><div key={ct.id} style={{background:c.bg1,border:`1px solid ${c.line}`,borderRadius:12,padding:14}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}><div style={{minWidth:0}}><div style={{fontFamily:UI,fontSize:15,fontWeight:700,color:c.t0}}>{ct.name}</div>{ct.role&&<div style={{fontFamily:UI,fontSize:12,color:c.accent,marginTop:1}}>{ct.role}</div>}</div><IconBtn icon={Settings} size={15} dim onClick={()=>setEd(ct)}/></div>
          {ct.address&&<div style={{fontFamily:UI,fontSize:12,color:c.t2,marginTop:7}}>{ct.address}</div>}
          <div style={{display:"flex",gap:10,marginTop:10,alignItems:"center",flexWrap:"wrap"}}>
            {ct.lat&&<TravelChip meta={project.meta} lat={ct.lat} lng={ct.lng}/>}
            {ct.address&&<a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(ct.address)}`} target="_blank" rel="noreferrer" style={{color:c.t1}}><MapPin size={15}/></a>}
            {ct.phone&&<a href={`tel:${ct.phone}`} style={{color:c.t1}}><Phone size={15}/></a>}
            {ct.email&&<a href={`mailto:${ct.email}`} style={{color:c.t1}}><Mail size={15}/></a>}
          </div>
        </div>)}
      </div>}
    <ContactEditor open={!!ed} init={ed} onClose={()=>setEd(null)} onSave={save} onDelete={del}/>
  </div>;
}

/* TOAST */
function Toast({toast,onClose}){
  useEffect(()=>{if(!toast)return;const t=setTimeout(onClose,5200);return()=>clearTimeout(t);},[toast,onClose]);
  if(!toast)return null;
  return <div style={{position:"fixed",left:"50%",bottom:84,transform:"translateX(-50%)",zIndex:120,background:c.bg3,border:`1px solid ${c.line2}`,borderRadius:11,padding:"11px 15px",display:"flex",alignItems:"center",gap:14,boxShadow:"0 12px 32px #000a",maxWidth:"90vw"}}>
    <span style={{fontFamily:UI,fontSize:13.5,color:c.t0}}>{toast.msg}</span>
    {toast.action&&<button onClick={()=>{toast.action();onClose();}} style={{fontFamily:UI,fontSize:13,fontWeight:700,color:c.accent,background:"none",border:"none",cursor:"pointer"}}>Undo</button>}
    <button onClick={onClose} style={{background:"none",border:"none",color:c.t2,cursor:"pointer",padding:0,display:"grid"}}><X size={15}/></button>
  </div>;
}

/* SCENE INFO editor (slug, day/night, story day, location, pages) */
function SceneInfo({open,init,locations,onClose,onSave,onDelete}){
  const [f,set]=useForm(init,open);
  return <Modal open={open} onClose={onClose} title={init?.__new?"Add scene":`Scene ${init?.number||""}`}
    footer={<>{init&&!init.__new&&<Btn kind="danger" onClick={()=>{onDelete(init.number);onClose();}}><Trash2 size={15}/>Remove</Btn>}<Btn kind="ghost" onClick={onClose}>Cancel</Btn><Btn kind="primary" onClick={()=>{onSave(f);onClose();}}>Save</Btn></>}>
    <div style={{display:"flex",flexDirection:"column",gap:14}}>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:11}}>
        <Field label="Scene number"><TextInput value={f.number||""} onChange={e=>set("number",e.target.value)} placeholder="14A"/></Field>
        <Field label="Story day"><TextInput value={f.storyDay||""} onChange={e=>set("storyDay",e.target.value)} placeholder="D3"/></Field>
      </div>
      <Field label="Set / location name"><TextInput value={f.set||""} onChange={e=>set("set",e.target.value)} placeholder="BRIDE'S APARTMENT"/></Field>
      <Field label="Interior / Exterior"><Segmented value={f.slug||""} onChange={v=>set("slug",v)} options={SLUGS}/></Field>
      <Field label="Day / Night"><Segmented value={f.dayNight||""} onChange={v=>set("dayNight",v)} options={DAYNIGHT}/></Field>
      <Field label="Status"><Segmented value={f.status==="omitted"?"":f.status||"todo"} onChange={v=>set("status",v||"todo")} options={STATUS.map(s=>({k:s.k,label:s.label}))}/></Field>
      <Field label="Location"><div style={{display:"flex",flexWrap:"wrap",gap:6}}><button onClick={()=>set("locationId","")} style={{padding:"7px 11px",borderRadius:8,border:`1px solid ${!f.locationId?c.accent:c.line2}`,background:!f.locationId?c.accentSoft:c.bg2,color:!f.locationId?c.accent:c.t1,fontFamily:UI,fontSize:13,cursor:"pointer"}}>None</button>{locations.map(l=><button key={l.id} onClick={()=>set("locationId",l.id)} style={{padding:"7px 11px",borderRadius:8,border:`1px solid ${f.locationId===l.id?c.accent:c.line2}`,background:f.locationId===l.id?c.accentSoft:c.bg2,color:f.locationId===l.id?c.accent:c.t1,fontFamily:UI,fontSize:13,cursor:"pointer"}}>{l.name}</button>)}</div></Field>
      {scriptDoc.doc&&<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:11}}><Field label="First page"><TextInput type="number" value={f.pageStart||""} onChange={e=>set("pageStart",+e.target.value||0)}/></Field><Field label="Last page"><TextInput type="number" value={f.pageEnd||""} onChange={e=>set("pageEnd",+e.target.value||0)}/></Field></div>}
      <Field label="One-line"><TextArea value={f.syn||""} onChange={e=>{set("syn",e.target.value);set("synEdited",true);}} placeholder="What happens"/></Field>
    </div>
  </Modal>;
}

/* IMPORT — the two-PDF backbone. PDF or pasted text. Review, merge. */
function ImportPane({kind,project,setProject,onToast}){
  const [busy,setBusy]=useState(false),[prog,setProg]=useState(""),[err,setErr]=useState(""),[paste,setPaste]=useState(""),[review,setReview]=useState(null),[showPaste,setShowPaste]=useState(false),[jsonText,setJsonText]=useState(""),[showJSON,setShowJSON]=useState(false);
  const fileRef=useRef(null);
  const isScript=kind==="script";

  const runScript=async(text,doc)=>{
    setProg("Reading scenes…");
    const parsed=await parseScriptText(text,(i,n)=>setProg(`Reading scenes… part ${i} of ${n}`));
    if(doc)assignPages(parsed,doc.numPages);
    const diff=diffScript(project.scenes,parsed);
    setReview({kind:"script",parsed,diff});
  };
  const runSchedule=async(text)=>{
    setProg("Reading shoot days…");
    const days=await parseScheduleText(text);
    const diff=diffSchedule(project.scenes,days);
    setReview({kind:"schedule",days,diff});
  };
  const handleFile=async file=>{
    setErr("");setReview(null);setBusy(true);
    try{
      const ab=await file.arrayBuffer();
      setProg("Opening PDF…");
      if(isScript){await setScriptPDF(ab.slice(0),file.name);setProg("Extracting pages…");const text=await scriptPagesText(scriptDoc.doc,(i,n)=>setProg(`Extracting pages… ${i}/${n}`));await runScript(text,scriptDoc.doc);}
      else{const doc=await pdfFromArrayBuffer(ab);let text="";for(let i=1;i<=doc.numPages;i++)text+=await pdfPageText(doc,i)+"\n";await runSchedule(text);}
    }catch(e){setErr(pdfErr(e));}
    setBusy(false);setProg("");
  };
  const handlePaste=async()=>{
    if(!paste.trim())return;setErr("");setReview(null);setBusy(true);
    try{if(isScript)await runScript(paste);else await runSchedule(paste);}catch(e){setErr(e.message||"Couldn't read that.");}
    setBusy(false);setProg("");
  };
  const pdfErr=e=>{const m=(e&&e.message)||"";if(/pdfjs|load/i.test(m))return "Couldn't load the PDF reader (offline or blocked). Paste the text instead, below.";if(/AI request/i.test(m))return "The AI parser is unavailable here. Paste text and retry, or add scenes by hand.";return m||"Couldn't read that PDF. Try pasting the text.";};
  const pullCloud=async()=>{
    setErr("");setReview(null);setBusy(true);setProg("Checking cloud…");
    try{const t=await r2Read(kind);if(!t)setErr('Nothing in the cloud yet. In your Claude app, drop the '+kind+' in and say "load into DP Deck."');else loadJSON(t);}
    catch(e){setErr("Cloud read failed ("+(e.message||"?")+"). Check the worker's CORS and read access.");}
    setBusy(false);setProg("");
  };
  const apply=()=>{
    if(review.kind==="script"){setProject(p=>{let sc=attachRefs(applyScript(p.scenes,review.parsed),review.parsed);sc=linkLocations(sc,review.parsed,p.locations);const d=deriveLocations(sc,p.locations);return {...p,scenes:d.scenes,locations:d.locations};});onToast(`Script merged · ${review.diff.added.length} new, ${review.diff.omitted.length} cut`);}
    else{setProject(p=>({...p,scenes:applySchedule(p.scenes,review.days)}));onToast(`Schedule applied · ${review.diff.days} days`);}
    setReview(null);
  };
  const loadJSON=(src)=>{
    setErr("");setReview(null);
    try{
      const arr=JSON.parse(src??jsonText);
      if(!Array.isArray(arr)||!arr.length)throw new Error("Expected a non-empty JSON array.");
      if(isScript){
        const parsed=arr.map((s,i)=>({number:String(s.n??s.number??"").trim(),slug:s.slug||"",set:s.set||"",dayNight:s.dn||s.dayNight||"",syn:s.syn||"",pageStart:+(s.pg||s.pageStart||0)||0,imgs:toUrlArr(s.img??s.imgs),loc:(s.loc||"").trim(),storyIndex:i}));
        assignPages(parsed,parsed.reduce((m,p)=>Math.max(m,p.pageStart),0)+5);
        setReview({kind:"script",parsed,diff:diffScript(project.scenes,parsed)});
      }else{
        const days=arr.map(d=>({day:String(d.day??d.day_number??"").trim(),date:d.date||"",scenes:(d.scenes||d.sceneNumbers||[]).map(x=>String(x).trim())}));
        setReview({kind:"schedule",days,diff:diffSchedule(project.scenes,days)});
      }
    }catch(e){setErr("Couldn't read that JSON. "+(e.message||""));}
  };
  const promptText=isScript
    ? `Read the screenplay below and output ONLY a JSON array, no prose and no code fences. One object per scene heading, keys exactly: "n" scene number as a string, "slug" one of "INT"/"EXT"/"INT/EXT", "set" the location from the heading, "dn" one of "DAY"/"NIGHT"/"DUSK"/"DAWN", "syn" one short sentence of action, "pg" page number as an integer (0 if unknown). Keep scenes in script order.\n\nSCREENPLAY:\n`
    : `Read the shooting schedule below and output ONLY a JSON array, no prose and no code fences. One object per shoot day in order, keys exactly: "day" the label as a string, "date" as "YYYY-MM-DD" or "", "scenes" an array of scene-number strings in shooting order.\n\nSCHEDULE:\n`;
  const copyPrompt=async()=>{try{await navigator.clipboard.writeText(promptText);onToast("Prompt copied. Paste it above your PDF text in Claude.");}catch{setErr("Copy failed. Prompt:\n"+promptText);}};

  const D=review?.diff;
  return <div style={{background:c.bg1,border:`1px solid ${c.line}`,borderRadius:14,padding:17}}>
    <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:6}}>{isScript?<FileText size={18} color={c.accent}/>:<Calendar size={18} color={c.accent}/>}<div style={{fontFamily:UI,fontSize:16,fontWeight:700,color:c.t0}}>{isScript?"Script":"Schedule"}</div></div>
    <p style={{fontFamily:UI,fontSize:13,color:c.t1,lineHeight:1.55,margin:"0 0 14px"}}>{isScript?"Drop the latest screenplay PDF. Scenes map by number and keep every note, reference, mark, and sketch you've attached. Cut scenes are kept and flagged, not deleted.":"Drop the latest shooting schedule. Scenes attach to days by number. Your prep work never moves."}</p>

    <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:13,flexWrap:"wrap"}}>
      <Btn kind="primary" size={13} onClick={pullCloud} disabled={busy}><CloudDownload size={16}/>Pull from cloud</Btn>
      <span style={{fontFamily:UI,fontSize:11.5,color:c.t2,lineHeight:1.4,flex:1,minWidth:160}}>What you handed Claude in chat lands here. Or drop a PDF below.</span>
    </div>

    <div onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();const f=e.dataTransfer.files[0];if(f)handleFile(f);}}
      style={{border:`1.5px dashed ${c.line2}`,borderRadius:12,padding:"22px 16px",textAlign:"center",marginBottom:12}}>
      <Upload size={22} color={c.t2} style={{marginBottom:9}}/>
      <div style={{marginBottom:11,fontFamily:UI,fontSize:13,color:c.t1}}>{busy?prog||"Working…":"Drop a PDF here"}</div>
      <Btn kind="ghost" size={12} onClick={()=>fileRef.current.click()} disabled={busy}>Choose PDF</Btn>
      <input ref={fileRef} type="file" accept="application/pdf" style={{display:"none"}} onChange={e=>{const f=e.target.files[0];if(f)handleFile(f);e.target.value="";}}/>
      <div style={{marginTop:11,display:"flex",gap:16,justifyContent:"center",flexWrap:"wrap"}}><button onClick={()=>setShowPaste(s=>!s)} style={{background:"none",border:"none",color:c.t2,fontFamily:UI,fontSize:12,cursor:"pointer",textDecoration:"underline"}}>{showPaste?"Hide paste":"Paste text instead"}</button><button onClick={()=>setShowJSON(s=>!s)} style={{background:"none",border:"none",color:c.t2,fontFamily:UI,fontSize:12,cursor:"pointer",textDecoration:"underline"}}>{showJSON?"Hide JSON":"Paste parsed JSON"}</button></div>
    </div>
    {showPaste&&<div style={{marginBottom:12}}><TextArea value={paste} onChange={e=>setPaste(e.target.value)} placeholder={isScript?"Paste the screenplay text…":"Paste the schedule text…"} style={{minHeight:120,fontFamily:MONO,fontSize:12}}/><div style={{marginTop:8,display:"flex",justifyContent:"flex-end"}}><Btn kind="ghost" size={12} onClick={handlePaste} disabled={busy||!paste.trim()}>Read text</Btn></div></div>}
    {showJSON&&<div style={{marginBottom:12}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,marginBottom:6,flexWrap:"wrap"}}><span style={{fontFamily:UI,fontSize:12,color:c.t2,lineHeight:1.45,flex:1,minWidth:180}}>Parse the PDF in your Claude app, then paste the JSON it returns. The app applies it directly, no model call.</span><Btn kind="ghost" size={12} onClick={copyPrompt}><FileText size={14}/>Copy prompt</Btn></div>
      <TextArea value={jsonText} onChange={e=>setJsonText(e.target.value)} placeholder={isScript?'[{"n":"12","slug":"INT","set":"BRIDE APT","dn":"NIGHT","syn":"...","pg":4}]':'[{"day":"1","date":"2026-09-15","scenes":["12","13"]}]'} style={{minHeight:120,fontFamily:MONO,fontSize:12}}/>
      <div style={{marginTop:8,display:"flex",justifyContent:"flex-end"}}><Btn kind="primary" size={12} onClick={()=>loadJSON()} disabled={!jsonText.trim()}><Check size={15}/>Load JSON</Btn></div>
    </div>}
    {busy&&prog&&<div style={{fontFamily:UI,fontSize:12.5,color:c.accent,marginBottom:10}}>{prog}</div>}
    {err&&<div style={{fontFamily:UI,fontSize:13,color:c.danger,background:c.danger+"14",border:`1px solid ${c.danger}44`,borderRadius:9,padding:11,marginBottom:12,lineHeight:1.5}}>{err}</div>}

    {review&&<div style={{border:`1px solid ${c.accent}55`,borderRadius:12,padding:14,background:c.accentSoft}}>
      <div style={{fontFamily:UI,fontSize:14,fontWeight:700,color:c.t0,marginBottom:10}}>Review before applying</div>
      {review.kind==="script"?<div style={{display:"flex",flexWrap:"wrap",gap:8,marginBottom:12}}>
        <Stat n={review.parsed.length} label="scenes found"/>
        <Stat n={D.added.length} label="new" color={c.ok}/>
        <Stat n={D.changed.length} label="changed" color={c.day}/>
        <Stat n={D.revived.length} label="back" color={c.accent}/>
        <Stat n={D.omitted.length} label="cut (kept)" color={c.warn}/>
      </div>:<div style={{display:"flex",flexWrap:"wrap",gap:8,marginBottom:12}}>
        <Stat n={D.days} label="shoot days"/>
        <Stat n={D.added.length} label="newly scheduled" color={c.ok}/>
        <Stat n={D.moved.length} label="moved day" color={c.day}/>
        <Stat n={D.orphan.length} label="not in deck" color={c.warn}/>
      </div>}
      {review.kind==="script"&&D.omitted.length>0&&<div style={{fontFamily:UI,fontSize:11.5,color:c.t1,marginBottom:6}}>Cut, work preserved: {D.omitted.slice(0,12).map(s=>s.number).join(", ")}{D.omitted.length>12?"…":""}</div>}
      {review.kind==="schedule"&&D.orphan.length>0&&<div style={{fontFamily:UI,fontSize:11.5,color:c.warn,marginBottom:6}}>In schedule but not in script: {[...new Set(D.orphan)].slice(0,12).join(", ")} — import the matching script draft.</div>}
      <div style={{display:"flex",gap:9,marginTop:6}}><Btn kind="primary" size={12} onClick={apply}><Check size={15}/>Apply</Btn><Btn kind="ghost" size={12} onClick={()=>setReview(null)}>Discard</Btn></div>
    </div>}

    <div style={{marginTop:13,fontFamily:MONO,fontSize:10.5,color:c.t2}}>{isScript?(scriptDoc.name?`Loaded: ${scriptDoc.name} · ${scriptDoc.doc?.numPages||"?"}p · ${project.scenes.filter(s=>s.status!=="omitted").length} scenes`:`${project.scenes.length?project.scenes.length+" scenes (no PDF loaded this session)":"No script yet"}`):`${groupBy(project.scenes.filter(s=>s.shootDay),s=>s.shootDay).length} days scheduled`}</div>
  </div>;
}
function Stat({n,label,color}){return <div style={{background:c.bg1,border:`1px solid ${c.line2}`,borderRadius:9,padding:"7px 11px",minWidth:62}}><div style={{fontFamily:MONO,fontSize:19,fontWeight:700,color:color||c.t0}}>{n}</div><div style={{fontFamily:UI,fontSize:10.5,color:c.t2}}>{label}</div></div>;}
function LocationImportPane({project,setProject,onToast}){
  const [busy,setBusy]=useState(false),[err,setErr]=useState(""),[jsonText,setJsonText]=useState(""),[showJSON,setShowJSON]=useState(false),[review,setReview]=useState(null);
  const load=(src)=>{
    setErr("");setReview(null);
    try{
      const arr=JSON.parse(src??jsonText);
      if(!Array.isArray(arr)||!arr.length)throw new Error("Expected a non-empty JSON array.");
      const incoming=arr.map(l=>({name:(l.name||l.set||"").trim(),address:l.address||"",lat:l.lat??"",lng:l.lng??"",radius:l.radius??"",notes:l.notes||"",img:l.img,plans:l.plans})).filter(l=>l.name);
      if(!incoming.length)throw new Error("No named locations found.");
      setReview({incoming,res:applyLocations(project.locations,incoming)});
    }catch(e){setErr("Couldn't read that JSON. "+(e.message||""));}
  };
  const pullCloud=async()=>{
    setErr("");setReview(null);setBusy(true);
    try{const t=await r2Read("locations");if(!t)setErr('Nothing in the cloud yet. In your Claude app, list the locations and say "load into DP Deck."');else load(t);}
    catch(e){setErr("Cloud read failed ("+(e.message||"?")+"). Check the worker's CORS and read access.");}
    setBusy(false);
  };
  const apply=()=>{setProject(p=>({...p,locations:applyLocations(p.locations,review.incoming).merged}));onToast(`Locations merged · ${review.res.added} new, ${review.res.updated} updated`);setReview(null);setJsonText("");};
  const promptText=`List the production's locations and output ONLY a JSON array, no prose or code fences. One object per location, keys exactly: "name" the location name, "address" full address or "", "lat" decimal latitude or "", "lng" decimal longitude or "", "radius" geofence meters or "", "notes" any access or parking notes or "".`;
  const copyPrompt=async()=>{try{await navigator.clipboard.writeText(promptText);onToast("Prompt copied.");}catch{setErr("Copy failed.\n"+promptText);}};
  return <div style={{background:c.bg1,border:`1px solid ${c.line}`,borderRadius:14,padding:17}}>
    <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:6}}><MapPin size={18} color={c.accent}/><div style={{fontFamily:UI,fontSize:16,fontWeight:700,color:c.t0}}>Locations</div></div>
    <p style={{fontFamily:UI,fontSize:13,color:c.t1,lineHeight:1.55,margin:"0 0 14px"}}>Pull the location list you gave Claude. Matched by name: existing ones update, new ones are added, nothing is removed. Overview photos you add in the app stay put.</p>
    <div style={{display:"flex",alignItems:"center",gap:14,marginBottom:13,flexWrap:"wrap"}}>
      <Btn kind="primary" size={13} onClick={pullCloud} disabled={busy}><CloudDownload size={16}/>{busy?"Checking…":"Pull from cloud"}</Btn>
      <button onClick={()=>setShowJSON(s=>!s)} style={{background:"none",border:"none",color:c.t2,fontFamily:UI,fontSize:12,cursor:"pointer",textDecoration:"underline"}}>{showJSON?"Hide JSON":"Paste JSON"}</button>
      <button onClick={copyPrompt} style={{background:"none",border:"none",color:c.t2,fontFamily:UI,fontSize:12,cursor:"pointer",textDecoration:"underline"}}>Copy prompt</button>
    </div>
    {showJSON&&<div style={{marginBottom:12}}>
      <TextArea value={jsonText} onChange={e=>setJsonText(e.target.value)} placeholder='[{"name":"Bride Apartment","address":"…","lat":52.23,"lng":21.01,"notes":"…"}]' style={{minHeight:110,fontFamily:MONO,fontSize:12}}/>
      <div style={{marginTop:8,display:"flex",justifyContent:"flex-end"}}><Btn kind="ghost" size={12} onClick={()=>load()} disabled={!jsonText.trim()}><Check size={15}/>Load JSON</Btn></div>
    </div>}
    {err&&<div style={{fontFamily:UI,fontSize:13,color:c.danger,background:c.danger+"14",border:`1px solid ${c.danger}44`,borderRadius:9,padding:11,marginBottom:12,lineHeight:1.5,whiteSpace:"pre-wrap"}}>{err}</div>}
    {review&&<div style={{border:`1px solid ${c.accent}55`,borderRadius:12,padding:14,background:c.accentSoft}}>
      <div style={{fontFamily:UI,fontSize:14,fontWeight:700,color:c.t0,marginBottom:10}}>Review before applying</div>
      <div style={{display:"flex",flexWrap:"wrap",gap:8,marginBottom:12}}>
        <Stat n={review.incoming.length} label="in list"/>
        <Stat n={review.res.added} label="new" color={c.ok}/>
        <Stat n={review.res.updated} label="updated" color={c.day}/>
      </div>
      <div style={{display:"flex",gap:9}}><Btn kind="primary" size={12} onClick={apply}><Check size={15}/>Apply</Btn><Btn kind="ghost" size={12} onClick={()=>setReview(null)}>Discard</Btn></div>
    </div>}
    <div style={{marginTop:13,fontFamily:MONO,fontSize:10.5,color:c.t2}}>{project.locations.length} location{project.locations.length===1?"":"s"} saved</div>
  </div>;
}
function RosterImportPane({kind,project,setProject,onToast}){
  const isCrew=kind==="crew";
  const [busy,setBusy]=useState(false),[err,setErr]=useState(""),[jsonText,setJsonText]=useState(""),[showJSON,setShowJSON]=useState(false),[review,setReview]=useState(null);
  const compute=arr=>isCrew?applyCrew(project.crew||{camera:[],grip:[],electric:[]},arr):applyContacts(project.contacts||[],arr);
  const load=src=>{
    setErr("");setReview(null);
    try{
      const arr=JSON.parse(src??jsonText);
      if(!Array.isArray(arr)||!arr.length)throw new Error("Expected a non-empty JSON array.");
      const incoming=arr.filter(x=>x&&(x.name||"").trim());
      if(!incoming.length)throw new Error("No named people found.");
      setReview({incoming,res:compute(incoming)});
    }catch(e){setErr("Couldn't read that JSON. "+(e.message||""));}
  };
  const pullCloud=async()=>{
    setErr("");setReview(null);setBusy(true);
    try{const t=await r2Read(kind);if(!t)setErr('Nothing in the cloud yet. In your Claude app, hand over the call sheet and say "load into DP Deck."');else load(t);}
    catch(e){setErr("Cloud read failed ("+(e.message||"?")+"). Check the worker's CORS and read access.");}
    setBusy(false);
  };
  const apply=()=>{
    if(isCrew)setProject(p=>({...p,crew:applyCrew(p.crew||{camera:[],grip:[],electric:[]},review.incoming).merged}));
    else setProject(p=>({...p,contacts:applyContacts(p.contacts||[],review.incoming).merged}));
    onToast(`${isCrew?"Crew":"Contacts"} merged · ${review.res.added} new, ${review.res.updated} updated`);setReview(null);setJsonText("");
  };
  const promptText=isCrew
    ? `From the call sheet below, output ONLY a JSON array, no prose or code fences. One object per CAMERA, GRIP, or ELECTRIC crew member only (skip other departments). Keys exactly: "name", "role", "dept" one of "camera"/"grip"/"electric", "phone" or "", "email" or "", "pron" a phonetic spelling or "". Copy names and numbers exactly, never invent.`
    : `From the call sheet below, output ONLY a JSON array, no prose or code fences. One object per production contact or vendor (production office, AD, UPM, locations, lab, rental house, etc.). Keys exactly: "name", "role" what they are, "address" or "", "lat" or "", "lng" or "", "phone" or "", "email" or "". Copy names and numbers exactly, never invent.`;
  const copyPrompt=async()=>{try{await navigator.clipboard.writeText(promptText);onToast("Prompt copied.");}catch{setErr("Copy failed.\n"+promptText);}};
  return <div style={{background:c.bg1,border:`1px solid ${c.line}`,borderRadius:14,padding:17}}>
    <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:6}}>{isCrew?<Users size={18} color={c.accent}/>:<Building2 size={18} color={c.accent}/>}<div style={{fontFamily:UI,fontSize:16,fontWeight:700,color:c.t0}}>{isCrew?"Crew":"Contacts"}</div></div>
    <p style={{fontFamily:UI,fontSize:13,color:c.t1,lineHeight:1.55,margin:"0 0 14px"}}>{isCrew?"Pull camera, grip, and electric crew parsed from your call sheet. Matched by name: existing update, new added, none removed.":"Pull production contacts and vendors from your call sheet. Matched by name: existing update, new added, none removed."}</p>
    <div style={{display:"flex",alignItems:"center",gap:14,marginBottom:13,flexWrap:"wrap"}}>
      <Btn kind="primary" size={13} onClick={pullCloud} disabled={busy}><CloudDownload size={16}/>{busy?"Checking…":"Pull from cloud"}</Btn>
      <button onClick={()=>setShowJSON(s=>!s)} style={{background:"none",border:"none",color:c.t2,fontFamily:UI,fontSize:12,cursor:"pointer",textDecoration:"underline"}}>{showJSON?"Hide JSON":"Paste JSON"}</button>
      <button onClick={copyPrompt} style={{background:"none",border:"none",color:c.t2,fontFamily:UI,fontSize:12,cursor:"pointer",textDecoration:"underline"}}>Copy prompt</button>
    </div>
    {showJSON&&<div style={{marginBottom:12}}>
      <TextArea value={jsonText} onChange={e=>setJsonText(e.target.value)} placeholder={isCrew?'[{"name":"Alex Seidl","role":"1st AC","dept":"camera","phone":"…"}]':'[{"name":"ATM System","role":"Camera rental","phone":"…"}]'} style={{minHeight:110,fontFamily:MONO,fontSize:12}}/>
      <div style={{marginTop:8,display:"flex",justifyContent:"flex-end"}}><Btn kind="ghost" size={12} onClick={()=>load()} disabled={!jsonText.trim()}><Check size={15}/>Load JSON</Btn></div>
    </div>}
    {err&&<div style={{fontFamily:UI,fontSize:13,color:c.danger,background:c.danger+"14",border:`1px solid ${c.danger}44`,borderRadius:9,padding:11,marginBottom:12,lineHeight:1.5,whiteSpace:"pre-wrap"}}>{err}</div>}
    {review&&<div style={{border:`1px solid ${c.accent}55`,borderRadius:12,padding:14,background:c.accentSoft}}>
      <div style={{fontFamily:UI,fontSize:14,fontWeight:700,color:c.t0,marginBottom:10}}>Review before applying</div>
      <div style={{display:"flex",flexWrap:"wrap",gap:8,marginBottom:12}}>
        <Stat n={review.incoming.length} label={isCrew?"people":"contacts"}/>
        <Stat n={review.res.added} label="new" color={c.ok}/>
        <Stat n={review.res.updated} label="updated" color={c.day}/>
      </div>
      <div style={{display:"flex",gap:9}}><Btn kind="primary" size={12} onClick={apply}><Check size={15}/>Apply</Btn><Btn kind="ghost" size={12} onClick={()=>setReview(null)}>Discard</Btn></div>
    </div>}
  </div>;
}
function ProjectImportPane({project,setProject,onToast}){
  const [busy,setBusy]=useState(false),[err,setErr]=useState(""),[prog,setProg]=useState(""),[review,setReview]=useState(null),[data,setData]=useState(null);
  const fileRef=useRef(null);
  const load=async file=>{
    setErr("");setReview(null);setData(null);
    try{
      const inc=JSON.parse(await file.text());
      const scenes=inc.scenes||[];
      if(!Array.isArray(scenes)||!scenes.length)throw new Error("Expected a 'scenes' array.");
      setData(inc);
      setReview({scenes:scenes.length,shots:scenes.reduce((n,s)=>n+((s.shots||[]).length),0),gear:scenes.reduce((n,s)=>n+((s.gear||[]).length),0),refs:scenes.reduce((n,s)=>n+((s.refs||[]).length),0),days:(inc.days||[]).length,title:inc.meta?.title||""});
    }catch(e){setErr("Couldn't read that file. "+(e.message||""));}
  };
  const apply=async()=>{
    if(!data)return;setBusy(true);setErr("");
    try{
      const incScenes=(data.scenes||[]).map(s=>({...s,refs:[...(s.refs||[])]}));
      const total=incScenes.reduce((n,s)=>n+s.refs.filter(r=>typeof r==="string"&&/^data:/.test(r)).length,0);let done=0;
      for(const s of incScenes){const ids=[];for(const r of s.refs){if(typeof r!=="string")continue;if(/^data:/.test(r)){setProg(`Storing images ${++done}/${total}…`);ids.push(await putImage(r));}else ids.push(r);}s.refs=ids;}
      let look=[...(data.look||[])];
      for(let i=0;i<look.length;i++){if(typeof look[i]==="string"&&/^data:/.test(look[i])){setProg(`Storing look ${i+1}/${look.length}…`);look[i]=await putImage(look[i]);}}
      setProg("Merging…");
      setProject(p=>applyProjectFile(p,{...data,scenes:incScenes,look}));
      onToast(`Project loaded · ${review.scenes} scenes, ${review.shots} shots, ${review.refs} refs`);
      setReview(null);setData(null);
    }catch(e){setErr("Load failed. "+(e.message||""));}
    setBusy(false);setProg("");
  };
  return <div style={{background:c.bg1,border:`2px solid ${c.accent}55`,borderRadius:14,padding:17}}>
    <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:6}}><Upload size={18} color={c.accent}/><div style={{fontFamily:UI,fontSize:16,fontWeight:700,color:c.t0}}>Load project file</div></div>
    <p style={{fontFamily:UI,fontSize:13,color:c.t1,lineHeight:1.55,margin:"0 0 14px"}}>Load a full DP Deck project JSON: scenes with shot lists, notes, gear, and reference images, plus the schedule. Merges by scene number and keeps anything you've already added. This is the one-shot way to bring in a script and schedule parsed for you in chat.</p>
    <div style={{display:"flex",gap:10,alignItems:"center",flexWrap:"wrap"}}>
      <Btn kind="primary" size={13} onClick={()=>fileRef.current.click()} disabled={busy}><Upload size={16}/>Choose .json</Btn>
      {busy&&<span style={{fontFamily:UI,fontSize:12,color:c.accent}}>{prog||"Working…"}</span>}
      <input ref={fileRef} type="file" accept="application/json,.json" style={{display:"none"}} onChange={e=>{const f=e.target.files[0];if(f)load(f);e.target.value="";}}/>
    </div>
    {err&&<div style={{fontFamily:UI,fontSize:13,color:c.danger,background:c.danger+"14",border:`1px solid ${c.danger}44`,borderRadius:9,padding:11,marginTop:12,lineHeight:1.5,whiteSpace:"pre-wrap"}}>{err}</div>}
    {review&&<div style={{border:`1px solid ${c.accent}55`,borderRadius:12,padding:14,background:c.accentSoft,marginTop:12}}>
      <div style={{fontFamily:UI,fontSize:14,fontWeight:700,color:c.t0,marginBottom:10}}>Review before applying{review.title?` · ${review.title}`:""}</div>
      <div style={{display:"flex",flexWrap:"wrap",gap:8,marginBottom:12}}>
        <Stat n={review.scenes} label="scenes"/>
        <Stat n={review.shots} label="shots" color={c.ok}/>
        <Stat n={review.gear} label="gear" color={c.day}/>
        <Stat n={review.refs} label="references" color={c.accent}/>
        <Stat n={review.days} label="shoot days"/>
      </div>
      <div style={{display:"flex",gap:9}}><Btn kind="primary" size={12} onClick={apply} disabled={busy}><Check size={15}/>Apply</Btn><Btn kind="ghost" size={12} onClick={()=>{setReview(null);setData(null);}} disabled={busy}>Discard</Btn></div>
    </div>}
  </div>;
}
function Import({project,setProject,onToast}){
  return <div style={{display:"grid",gridTemplateColumns:"1fr",gap:14,maxWidth:1100,margin:"0 auto"}}>
    <ProjectImportPane project={project} setProject={setProject} onToast={onToast}/>
    <ImportPane kind="script" project={project} setProject={setProject} onToast={onToast}/>
    <ImportPane kind="schedule" project={project} setProject={setProject} onToast={onToast}/>
    <LocationImportPane project={project} setProject={setProject} onToast={onToast}/>
    <RosterImportPane kind="crew" project={project} setProject={setProject} onToast={onToast}/>
    <RosterImportPane kind="contacts" project={project} setProject={setProject} onToast={onToast}/>
  </div>;
}

/* SETTINGS */
function SettingsView({project,setProject,onToast,onThemeChange}){
  const m=project.meta;const set=(k,v)=>setProject(p=>({...p,meta:{...p.meta,[k]:v}}));
  const [wipe,setWipe]=useState(false);
  const [aikey,setAikey]=useState("");
  const [r2key,setR2k]=useState(""),[syncing,setSyncing]=useState("");
  useEffect(()=>{store.get("pb:aikey").then(k=>setAikey(k||""));store.get("pb:r2key").then(k=>setR2k(k||""));},[]);
  const useHere=async()=>{try{const {lat,lng}=await whereAmI();setProject(p=>({...p,meta:{...p.meta,baseLat:lat.toFixed(6),baseLng:lng.toFixed(6)}}));onToast("Base set to current location");}catch{onToast("Couldn't get location");}};
  return <div style={{maxWidth:640,margin:"0 auto",display:"flex",flexDirection:"column",gap:16}}>
    <Card title="Film" icon={Film}>
      <Field label="Title"><TextInput value={m.title} onChange={e=>set("title",e.target.value)}/></Field>
    </Card>
    <Card title="Base (for travel times)" icon={Navigation}>
      <Field label="Base name" style={{marginBottom:11}}><TextInput value={m.baseName||""} onChange={e=>set("baseName",e.target.value)} placeholder="Production office / hotel"/></Field>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:11,marginBottom:11}}><Field label="Latitude"><TextInput value={m.baseLat||""} onChange={e=>set("baseLat",e.target.value)}/></Field><Field label="Longitude"><TextInput value={m.baseLng||""} onChange={e=>set("baseLng",e.target.value)}/></Field></div>
      <div style={{display:"flex",gap:10,alignItems:"flex-end"}}><Field label="Avg speed (km/h)" style={{flex:1}}><TextInput type="number" value={m.avgKmh||""} onChange={e=>set("avgKmh",+e.target.value||28)}/></Field><Btn kind="ghost" size={12} onClick={useHere}><Crosshair size={14}/>Use my location</Btn></div>
    </Card>
    <Card title="Time & sun" icon={Sun}>
      <Field label="Timezone (IANA, for sun + call times)"><TextInput value={m.tz} onChange={e=>set("tz",e.target.value)} placeholder="Europe/Warsaw"/></Field>
    </Card>
    <Card title="Appearance" icon={c.bg0===DARK.bg0?MoonStar:SunMedium}>
      <Segmented value={m.theme||"dark"} onChange={v=>{const t=v||"dark";set("theme",t);onThemeChange(t);}} options={[{k:"dark",label:"Dark (set)"},{k:"light",label:"Light (day)"}]}/>
    </Card>
    <Card title="In-app AI (optional)" icon={Sparkles}>
      <div style={{fontFamily:UI,fontSize:12.5,color:c.t2,lineHeight:1.5,marginBottom:11}}>Paste your own Anthropic API key to turn on the in-app "parse PDF" and gear "Suggest" buttons. It is stored only on this device and sent straight to Anthropic from your browser, never to the repo or a server. Importing works fine without it (Paste JSON or Load project file).</div>
      <div style={{display:"flex",gap:8,alignItems:"center"}}>
        <TextInput type="password" value={aikey} placeholder="sk-ant-..." autoComplete="off" onChange={e=>setAikey(e.target.value)}/>
        <Btn kind="primary" size={12} onClick={async()=>{await setAIKey(aikey.trim());onToast(aikey.trim()?"AI key saved on this device":"AI key cleared");}}>Save</Btn>
      </div>
    </Card>
    <Card title="Cloud sync (optional)" icon={CloudDownload}>
      <div style={{fontFamily:UI,fontSize:12.5,color:c.t2,lineHeight:1.5,marginBottom:11}}>Sync the whole deck across devices through your R2 Files Worker. Enter the worker key (stored only on this device, never in the app code). Push from one device, Pull on another. The film stays private: the worker requires this key, nothing is made public.</div>
      <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:11}}>
        <TextInput type="password" value={r2key} placeholder="Files Worker X-API-Key" autoComplete="off" onChange={e=>setR2k(e.target.value)}/>
        <Btn kind="ghost" size={12} onClick={async()=>{await setR2Key(r2key.trim());onToast(r2key.trim()?"Cloud key saved on this device":"Cloud key cleared");}}>Save</Btn>
      </div>
      <div style={{display:"flex",gap:9,flexWrap:"wrap"}}>
        <Btn kind="ghost" size={12} disabled={!!syncing} onClick={async()=>{setSyncing("push");try{const n=await pushDeckToCloud();onToast(`Pushed deck to cloud (${(n/1048576).toFixed(1)} MB)`);}catch(e){onToast("Push failed: "+(e.message||""));}setSyncing("");}}><Upload size={15}/>{syncing==="push"?"Pushing…":"Push deck to cloud"}</Btn>
        <Btn kind="ghost" size={12} disabled={!!syncing} onClick={async()=>{setSyncing("pull");try{await pullDeckFromCloud();onToast("Pulled deck from cloud. Reloading…");setTimeout(()=>location.reload(),800);}catch(e){onToast("Pull failed: "+(e.message||""));setSyncing("");}}}><CloudDownload size={15}/>{syncing==="pull"?"Pulling…":"Pull deck from cloud"}</Btn>
      </div>
    </Card>
    <Card title="Data" icon={Settings}>
      <div style={{fontFamily:UI,fontSize:12.5,color:c.t2,lineHeight:1.5,marginBottom:12}}>{HAS?"Your deck is saved locally in this browser (IndexedDB), set to persistent so the browser will not evict it. Download a full backup to guard against loss and to move the whole deck to another device (restore it there).":"Heads up: persistent storage isn't available here, so this session won't be saved."}</div>
      <div style={{display:"flex",gap:9,flexWrap:"wrap",marginBottom:14}}>
        <Btn kind="ghost" size={12} onClick={async()=>{try{onToast("Building backup…");const b=await exportFullBackup();downloadJSON(`dpdeck-backup-${todayISO()}.json`,b);onToast("Backup downloaded");}catch(e){onToast("Backup failed: "+(e.message||""));}}}><CloudDownload size={15}/>Download full backup</Btn>
        <label style={{cursor:"pointer"}}><Btn kind="ghost" size={12}><Upload size={15}/>Restore backup</Btn><input type="file" accept="application/json,.json" style={{display:"none"}} onChange={async e=>{const f=e.target.files[0];e.target.value="";if(!f)return;try{await importFullBackup(JSON.parse(await f.text()));onToast("Backup restored. Reloading…");setTimeout(()=>location.reload(),700);}catch(err){onToast("Restore failed: "+(err.message||""));}}}/></label>
      </div>
      {!wipe?<Btn kind="danger" size={12} onClick={()=>setWipe(true)}><Trash2 size={15}/>Erase everything</Btn>:
        <div style={{display:"flex",gap:9,alignItems:"center"}}><span style={{fontFamily:UI,fontSize:13,color:c.danger}}>Erase all scenes, prep, and media?</span><Btn kind="danger" size={12} onClick={async()=>{for(const k of ["pb:project","pb:scriptpdf","pb:scriptpdfname"])await store.del(k);location.reload();}}>Yes, erase</Btn><Btn kind="ghost" size={12} onClick={()=>setWipe(false)}>Cancel</Btn></div>}
    </Card>
    <div style={{textAlign:"center",fontFamily:MONO,fontSize:10.5,color:c.t2,padding:"4px 0 12px"}}>DP DECK · prep + shoot · one film</div>
  </div>;
}

/* EXPORT — shareable PDF package (print to PDF) */
const SERIF="Georgia, 'Times New Roman', serif";
const PRINT_CSS=`
@media print{
  [data-noprint]{display:none !important;}
  html,body{background:#fff !important;}
  #print-doc{box-shadow:none !important;max-width:100% !important;padding:0 !important;margin:0 !important;}
  .pd-scene,.pd-loc,.pd-row{break-inside:avoid;}
  .pd-section{break-before:page;}
  img,canvas{break-inside:avoid;}
}
@page{margin:14mm;}
`;
function ExportSun({lat,lng,tz,date}){
  const t=useMemo(()=>{try{return sunTimes(dayNoonUTC(date),+lat,+lng);}catch{return null;}},[lat,lng,date]);
  if(!t)return null;
  return <>Sunrise {fmtT(t.sunrise,tz)} · Golden hr {fmtT(t.goldStart,tz)} · Sunset {fmtT(t.sunset,tz)}</>;
}
function ExportDoc({project}){
  const P={text:"#161616",muted:"#6a6a6a",line:"#dcdcdc",accent:"#8a5a00",soft:"#f5f2ec"};
  const m=project.meta||{};
  const scenes=[...project.scenes].filter(s=>s.status!=="omitted").sort((a,b)=>(a.storyIndex??9999)-(b.storyIndex??9999));
  const omitted=project.scenes.filter(s=>s.status==="omitted").length;
  const days=groupBy(project.scenes.filter(s=>s.status!=="omitted"&&s.shootDay),s=>s.shootDay).map(([day,sc])=>({day,date:sc.find(x=>x.shootDate)?.shootDate||"",nums:[...sc].sort((a,b)=>(a.shootOrder||0)-(b.shootOrder||0)).map(x=>x.number)}));
  days.sort((a,b)=>cmpNum(a.day,b.day));
  const loc=id=>project.locations.find(l=>l.id===id);
  const crew=project.crew||{camera:[],grip:[],electric:[]};
  const today=todayISO();
  const sec={fontFamily:SERIF,fontSize:20,fontWeight:700,color:P.text,borderBottom:`2px solid ${P.text}`,paddingBottom:6,margin:"0 0 14px"};
  const sub={fontFamily:UI,fontSize:10,letterSpacing:"0.08em",textTransform:"uppercase",color:P.muted,fontWeight:700};
  const imgRow=(arr,h)=>arr&&arr.length?<div style={{display:"flex",flexWrap:"wrap",gap:7,marginTop:8}}>{arr.map((v,i)=><StoredImg key={i} id={v} style={{height:h||150,maxWidth:"32%",objectFit:"cover",border:`1px solid ${P.line}`,borderRadius:4,background:P.soft}}/>)}</div>:null;
  const gearOf=s=>(s.gearTags||[]).map(id=>project.gear.find(g=>g.id===id)).filter(Boolean);
  return <div id="print-doc" style={{maxWidth:840,margin:"0 auto",background:"#fff",color:P.text,padding:"40px 44px",fontFamily:UI,boxShadow:"0 0 0 1px #00000010"}}>
    <div className="pd-cover" style={{marginBottom:30}}>
      <div style={{...sub,marginBottom:14}}>Cinematography package</div>
      <div style={{fontFamily:SERIF,fontSize:40,fontWeight:700,lineHeight:1.1,marginBottom:12}}>{m.title||"Untitled Film"}</div>
      <div style={{fontFamily:UI,fontSize:13,color:P.muted,lineHeight:1.8}}>
        {m.baseName?<div>Base: {m.baseName}</div>:null}
        <div>Scenes: {scenes.length}{omitted?` (plus ${omitted} omitted)`:""} · Shoot days: {days.length} · Locations: {project.locations.length}</div>
        <div>Generated {new Date().toLocaleDateString(undefined,{year:"numeric",month:"long",day:"numeric"})}</div>
      </div>
    </div>
    {days.length>0&&<div className="pd-section" style={{marginBottom:30}}>
      <div style={sec}>Schedule</div>
      <table style={{width:"100%",borderCollapse:"collapse"}}><tbody>
        {days.map(d=><tr key={d.day} className="pd-row" style={{borderBottom:`1px solid ${P.line}`}}>
          <td style={{padding:"7px 8px",fontWeight:700,whiteSpace:"nowrap",verticalAlign:"top",fontFamily:UI,fontSize:12.5}}>Day {d.day}</td>
          <td style={{padding:"7px 8px",color:P.muted,whiteSpace:"nowrap",verticalAlign:"top",fontFamily:UI,fontSize:12.5}}>{d.date?new Date(d.date+"T12:00").toLocaleDateString(undefined,{weekday:"short",month:"short",day:"numeric"}):"TBD"}</td>
          <td style={{padding:"7px 8px",fontFamily:MONO,fontSize:12}}>{d.nums.join(", ")}</td>
        </tr>)}
      </tbody></table>
    </div>}
    <div className="pd-section">
      <div style={sec}>Scenes</div>
      {scenes.map(s=>{const l=loc(s.locationId);return <div key={s.number} className="pd-scene" style={{marginBottom:22,paddingBottom:18,borderBottom:`1px solid ${P.line}`}}>
        <div style={{display:"flex",alignItems:"baseline",gap:10,flexWrap:"wrap"}}>
          <span style={{fontFamily:MONO,fontSize:20,fontWeight:700,color:P.accent}}>{s.number}</span>
          <span style={{fontFamily:UI,fontSize:14,fontWeight:700}}>{s.slug} {s.set}</span>
          {s.dayNight&&<span style={{fontFamily:MONO,fontSize:11,color:P.muted}}>{s.dayNight}</span>}
          <span style={{flex:1}}/>
          {(s.pageStart||s.pageEnd)?<span style={{fontFamily:MONO,fontSize:11,color:P.muted}}>pp. {s.pageStart||"?"}{s.pageEnd&&s.pageEnd!==s.pageStart?`-${s.pageEnd}`:""}</span>:null}
        </div>
        {l&&<div style={{fontFamily:UI,fontSize:12,color:P.muted,marginTop:3}}>Location: {l.name}</div>}
        {s.syn&&<div style={{fontFamily:SERIF,fontSize:13.5,lineHeight:1.5,marginTop:8}}>{s.syn}</div>}
        {s.scriptText&&<div style={{marginTop:8}}><span style={sub}>Script</span><div style={{marginTop:3}}><ScreenplayText text={s.scriptText} base={P.text} strong={P.text} dim={P.muted} size={10}/></div></div>}
        {s.notes&&<div style={{marginTop:8}}><span style={sub}>Notes</span><div style={{fontFamily:UI,fontSize:12.5,lineHeight:1.5,marginTop:3,whiteSpace:"pre-wrap"}}>{s.notes}</div></div>}
        {s.shots.length>0&&<div style={{marginTop:8}}><span style={sub}>Shot list</span><div style={{marginTop:4}}>{s.shots.map((sh,i)=><div key={sh.id} style={{fontFamily:UI,fontSize:12.5,lineHeight:1.55,display:"flex",gap:8}}><span style={{color:P.muted,fontFamily:MONO,fontSize:11,minWidth:34}}>{sh.done?"[x]":"[ ]"}</span><span>{i+1}. {sh.text}</span></div>)}</div></div>}
        {(()=>{const g=gearOf(s);return g.length?<div style={{marginTop:8}}><span style={sub}>Gear</span><div style={{marginTop:3}}>{DEPTS.map(d=>{const items=g.filter(x=>x.dept===d.k);return items.length?<div key={d.k} style={{fontFamily:UI,fontSize:12,lineHeight:1.55}}><b>{d.label}:</b> {items.map(x=>x.name).join(", ")}</div>:null;})}</div></div>:null;})()}
        {imgRow(s.refs,150)}
        {s.sketches.length>0&&<div style={{display:"flex",flexWrap:"wrap",gap:7,marginTop:8}}>{s.sketches.map(id=><SketchThumb key={id} id={id} style={{width:200,aspectRatio:"4/3",border:`1px solid ${P.line}`,borderRadius:4,background:P.soft}}/>)}</div>}
      </div>;})}
    </div>
    {project.locations.length>0&&<div className="pd-section">
      <div style={sec}>Locations</div>
      {project.locations.map(l=>{const date=nextDateForLoc(project.scenes,l.id)||today;const here=project.scenes.filter(s=>s.locationId===l.id&&s.status!=="omitted").sort((a,b)=>cmpNum(a.number,b.number)).map(s=>s.number);return <div key={l.id} className="pd-loc" style={{marginBottom:20,paddingBottom:16,borderBottom:`1px solid ${P.line}`}}>
        <div style={{fontFamily:SERIF,fontSize:17,fontWeight:700}}>{l.name}</div>
        {l.address&&<div style={{fontFamily:UI,fontSize:12.5,color:P.muted,marginTop:2}}>{l.address}</div>}
        <div style={{fontFamily:UI,fontSize:12,color:P.muted,marginTop:4,lineHeight:1.6}}>
          {l.lat?<div>{(+l.lat).toFixed(4)}, {(+l.lng).toFixed(4)} · <ExportSun lat={l.lat} lng={l.lng} tz={m.tz} date={date}/></div>:null}
          {here.length?<div>Scenes: <span style={{fontFamily:MONO}}>{here.join(", ")}</span></div>:null}
        </div>
        {l.notes&&<div style={{fontFamily:UI,fontSize:12.5,lineHeight:1.5,marginTop:6,whiteSpace:"pre-wrap"}}>{l.notes}</div>}
        {imgRow(l.images,160)}
        {l.plans&&l.plans.length>0&&<div><div style={{...sub,marginTop:10}}>Floor plans</div>{imgRow(l.plans,200)}</div>}
      </div>;})}
    </div>}
    {(DEPTS.some(d=>(crew[d.k]||[]).length)||(project.contacts||[]).length>0)&&<div className="pd-section">
      <div style={sec}>Crew &amp; contacts</div>
      {DEPTS.map(d=>(crew[d.k]||[]).length?<div key={d.k} style={{marginBottom:12}}>
        <div style={sub}>{d.label}</div>
        {(crew[d.k]||[]).map(p=><div key={p.id} style={{fontFamily:UI,fontSize:12.5,lineHeight:1.6,marginTop:2}}>{p.name}{p.role?`, ${p.role}`:""}{p.phone?` · ${p.phone}`:""}{p.email?` · ${p.email}`:""}</div>)}
      </div>:null)}
      {(project.contacts||[]).length>0&&<div style={{marginTop:8}}>
        <div style={sub}>Production &amp; vendors</div>
        {project.contacts.map(ct=><div key={ct.id} style={{fontFamily:UI,fontSize:12.5,lineHeight:1.6,marginTop:2}}>{ct.name}{ct.role?`, ${ct.role}`:""}{ct.phone?` · ${ct.phone}`:""}{ct.email?` · ${ct.email}`:""}</div>)}
      </div>}
    </div>}
  </div>;
}

/* GEAR PULL — specialty gear by department, with the scenes each is needed on */
function GearSheet({project,depts}){
  const P={text:"#161616",muted:"#6a6a6a",line:"#dcdcdc",accent:"#8a5a00"};
  const sec={fontFamily:SERIF,fontSize:18,fontWeight:700,color:P.text,borderBottom:`2px solid ${P.text}`,paddingBottom:5,margin:"0 0 10px"};
  const usedBy=id=>project.scenes.filter(s=>s.status!=="omitted"&&(s.gearTags||[]).includes(id)).sort((a,b)=>cmpNum(a.number,b.number)).map(s=>s.number);
  return <div id="print-doc" style={{maxWidth:840,margin:"0 auto",background:"#fff",color:P.text,padding:"40px 44px",fontFamily:UI,boxShadow:"0 0 0 1px #00000010"}}>
    <div style={{marginBottom:24}}>
      <div style={{fontFamily:UI,fontSize:10,letterSpacing:"0.08em",textTransform:"uppercase",color:P.muted,fontWeight:700,marginBottom:8}}>Specialty gear pull</div>
      <div style={{fontFamily:SERIF,fontSize:32,fontWeight:700,lineHeight:1.1}}>{project.meta.title||"Untitled Film"}</div>
      <div style={{fontFamily:UI,fontSize:12,color:P.muted,marginTop:4}}>{DEPTS.filter(d=>depts.includes(d.k)).map(d=>d.label).join(" + ")||"No department selected"} · Generated {new Date().toLocaleDateString(undefined,{year:"numeric",month:"long",day:"numeric"})}</div>
    </div>
    {DEPTS.filter(d=>depts.includes(d.k)).map(d=>{const items=project.gear.filter(g=>g.dept===d.k);return <div key={d.k} className="pd-section" style={{marginBottom:22}}>
      <div style={sec}>{d.label}</div>
      {items.length===0?<div style={{fontFamily:UI,fontSize:12.5,color:P.muted}}>None on this department.</div>:
        <table style={{width:"100%",borderCollapse:"collapse"}}><tbody>
          {items.map(g=>{const ns=usedBy(g.id);return <tr key={g.id} className="pd-row" style={{borderBottom:`1px solid ${P.line}`}}>
            <td style={{padding:"7px 8px",fontFamily:UI,fontSize:13.5,fontWeight:600,verticalAlign:"top",width:"38%"}}>{g.name}</td>
            <td style={{padding:"7px 8px",fontFamily:MONO,fontSize:11,color:P.muted,verticalAlign:"top"}}>{ns.length?`${ns.length} scene${ns.length>1?"s":""}: ${ns.join(", ")}`:"unassigned"}</td>
          </tr>;})}
        </tbody></table>}
    </div>;})}
  </div>;
}

/* QUICK JUMP — instant scene pull-up (Cmd/Ctrl+K or "/") for on-set lookups */
function QuickJump({open,scenes,onClose,onOpen}){
  const [q,setQ]=useState(""),[sel,setSel]=useState(0);
  useEffect(()=>{if(open){setQ("");setSel(0);}},[open]);
  if(!open)return null;
  const k=q.trim().toLowerCase();
  const list=scenes.filter(s=>s.status!=="omitted").filter(s=>!k||(s.number+" "+s.set+" "+(s.syn||"")+" "+s.slug+" "+s.dayNight).toLowerCase().includes(k)).slice(0,50);
  const go=s=>{if(s){onOpen(s.number);onClose();}};
  return <div onClick={onClose} style={{position:"fixed",inset:0,background:c.scrim,backdropFilter:"blur(3px)",zIndex:130,display:"flex",alignItems:"flex-start",justifyContent:"center",padding:"11vh 14px 14px"}}>
    <div onClick={e=>e.stopPropagation()} style={{width:"100%",maxWidth:560,background:c.bg1,border:`1px solid ${c.line2}`,borderRadius:14,boxShadow:"0 24px 60px #000a",overflow:"hidden"}}>
      <div style={{display:"flex",alignItems:"center",gap:10,padding:"12px 14px",borderBottom:`1px solid ${c.line}`}}>
        <Search size={18} color={c.t2}/>
        <input autoFocus value={q} onChange={e=>{setQ(e.target.value);setSel(0);}} onKeyDown={e=>{if(e.key==="ArrowDown"){e.preventDefault();setSel(s=>Math.min(s+1,list.length-1));}else if(e.key==="ArrowUp"){e.preventDefault();setSel(s=>Math.max(s-1,0));}else if(e.key==="Enter"){go(list[sel]);}else if(e.key==="Escape"){onClose();}}} placeholder="Jump to scene: number, set, or action…" style={{flex:1,background:"transparent",border:"none",outline:"none",color:c.t0,fontFamily:UI,fontSize:16}}/>
        <span style={{fontFamily:MONO,fontSize:10,color:c.t2,border:`1px solid ${c.line2}`,borderRadius:5,padding:"2px 5px"}}>esc</span>
      </div>
      <div style={{maxHeight:"54vh",overflowY:"auto"}}>
        {list.length===0?<div style={{padding:18,fontFamily:UI,fontSize:13,color:c.t2}}>No match.</div>:
        list.map((s,i)=><button key={s.number||s.storyIndex} onClick={()=>go(s)} onMouseEnter={()=>setSel(i)} style={{width:"100%",display:"flex",alignItems:"center",gap:12,padding:"10px 14px",background:i===sel?c.accentSoft:"transparent",border:"none",borderBottom:`1px solid ${c.line}`,cursor:"pointer",textAlign:"left"}}>
          <span style={{fontFamily:MONO,fontSize:15,fontWeight:700,color:c.accent,minWidth:42}}>{s.number}</span>
          <span style={{flex:1,minWidth:0}}><span style={{display:"block",fontFamily:UI,fontSize:13.5,color:c.t0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{s.slug} {s.set} <span style={{color:c.t2,fontFamily:MONO,fontSize:10}}>{s.dayNight}</span></span>{s.syn&&<span style={{fontFamily:UI,fontSize:11.5,color:c.t2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",display:"block"}}>{s.syn}</span>}</span>
          {s.shootDay&&<span style={{fontFamily:MONO,fontSize:10.5,color:c.accent,background:c.accentSoft,border:`1px solid ${c.accent}55`,borderRadius:6,padding:"3px 7px"}}>D{s.shootDay}</span>}
        </button>)}
      </div>
    </div>
  </div>;
}

/* LOOK — top-level references for the whole film (palette, lensing, light) */
function LookBoard({project,setProject,openLightbox,onToast}){
  const [drag,setDrag]=useState(false);const fileRef=useRef(null);
  const look=project.look||[];
  const setLook=fn=>setProject(p=>({...p,look:fn(p.look||[])}));
  const addImages=async files=>{const ids=[];for(const f of files){if(!f.type?.startsWith("image/"))continue;try{ids.push(await putImage(await downscale(f)));}catch{}}if(ids.length)setLook(l=>[...l,...ids]);};
  const onDrop=async e=>{e.preventDefault();e.stopPropagation();setDrag(false);const dt=e.dataTransfer;const files=[...(dt.files||[])].filter(f=>f.type.startsWith("image/"));if(files.length)return addImages(files);let url=(dt.getData("text/uri-list")||"").split("\n").find(l=>l&&!l.startsWith("#"))||"";if(!url){const h=dt.getData("text/html")||"";const m=h.match(/<img[^>]+src=["']([^"']+)["']/i);if(m)url=m[1];}url=(url||"").trim();if(isImgUrl(url)){setLook(l=>[...l,url]);onToast&&onToast("Reference added to the look");}else onToast&&onToast("Couldn't read that drop. Save the image, then drag the file in.");};
  return <div>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14,flexWrap:"wrap",gap:10}}>
      <span style={{fontFamily:UI,fontSize:13.5,color:c.t1,lineHeight:1.5,maxWidth:640}}>The look. Top-level visual references for the whole film: palette, lensing, light. These sit above any one scene. Drop images, paste a URL, or upload.</span>
      <Btn kind="primary" size={12} onClick={()=>fileRef.current.click()}><Upload size={15}/>Add</Btn>
      <input ref={fileRef} type="file" accept="image/*" multiple style={{display:"none"}} onChange={e=>{addImages([...e.target.files]);e.target.value="";}}/>
    </div>
    <div onPaste={e=>{const fs=[...e.clipboardData.files];if(fs.length)addImages(fs);}} onDragOver={e=>{e.preventDefault();e.stopPropagation();if(!drag)setDrag(true);}} onDragLeave={e=>{if(e.currentTarget===e.target)setDrag(false);}} onDrop={onDrop} style={drag?{outline:`2px dashed ${c.accent}`,outlineOffset:4,borderRadius:12}:undefined}>
      {look.length===0?<Empty icon={ImageIcon} title="No look references yet" body="Drop the images that define the film's visual language. They live at the top level, across every scene."/>:
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))",gap:12}}>
          {look.map((id,idx)=><div key={id} style={{position:"relative",aspectRatio:"4/3",borderRadius:12,overflow:"hidden",border:`1px solid ${c.line2}`}}>
            <StoredImg id={id} style={{width:"100%",height:"100%",objectFit:"cover",cursor:"zoom-in"}} onClick={()=>openLightbox(look,idx)}/>
            <button onClick={()=>setLook(l=>l.filter(x=>x!==id))} style={{position:"absolute",top:6,right:6,width:24,height:24,borderRadius:"50%",border:"none",background:"#000a",color:"#fff",cursor:"pointer",display:"grid",placeItems:"center"}}><X size={14}/></button>
          </div>)}
        </div>}
    </div>
  </div>;
}

/* APP */
const DEFAULT_PROJECT=()=>({meta:{title:"Untitled Film",baseName:"",baseLat:"",baseLng:"",avgKmh:28,tz:(Intl.DateTimeFormat().resolvedOptions().timeZone)||"UTC",theme:"dark"},scenes:[],locations:[],crew:{camera:[],grip:[],electric:[]},contacts:[],gear:[],inbox:[],look:[]});
const NAV=[
  {k:"home",label:"Home",icon:Home},
  {k:"days",label:"Schedule",icon:Calendar},
  {k:"scenes",label:"Scenes",icon:Film},
  {k:"look",label:"Look",icon:ImageIcon},
  {k:"capture",label:"Capture",icon:Inbox},
  {k:"locations",label:"Locations",icon:MapPin},
  {k:"crew",label:"Crew",icon:Users},
  {k:"gear",label:"Gear",icon:Wrench},
  {k:"contacts",label:"Contacts",icon:Building2},
  {k:"export",label:"Export PDF",icon:Printer},
  {k:"import",label:"Import",icon:Upload},
  {k:"settings",label:"Settings",icon:Settings},
];
const MOBILE_NAV=["home","scenes","days","locations"];

export default function App(){
  const [project,setProject]=useState(null);
  const [view,setView]=useState("scenes");
  const [activeScene,setActiveScene]=useState(null);
  const [lens,setLens]=useState("story");
  const [ink,setInk]=useState(null);
  const [light,setLight]=useState(null);
  const [toast,setToast]=useState(null);
  const [tb,setTb]=useState(0);
  const [info,setInfo]=useState(null);
  const [more,setMore]=useState(false);
  const [jump,setJump]=useState(false);
  const [exp,setExp]=useState({mode:"full",depts:["camera","grip","electric"]});
  const wide=useWide();
  const loaded=useRef(false);

  useEffect(()=>{(async()=>{
    try{if(navigator.storage&&navigator.storage.persist)await navigator.storage.persist();}catch{}
    loadAIKey();loadR2Key();
    let p=await store.get("pb:project");
    if(!p||typeof p!=="object"){p=DEFAULT_PROJECT();}
    p.meta={...DEFAULT_PROJECT().meta,...(p.meta||{})};p.scenes=(p.scenes||[]).map(s=>({...emptyScene(s.number),...s}));p.locations=(p.locations||[]).map(l=>({...l,images:l.images||[],plans:l.plans||[]}));p.crew={camera:[],grip:[],electric:[],...(p.crew||{})};p.contacts=p.contacts||[];p.gear=p.gear||[];p.inbox=p.inbox||[];p.look=p.look||[];
    applyTheme(p.meta.theme);setProject(p);
    setView(p.scenes.length?"home":"import");
    restoreScriptPDF().then(()=>setTb(b=>b+1));
    setTimeout(()=>{loaded.current=true;},60);
  })();},[]);

  useEffect(()=>{if(!loaded.current||!project)return;const t=setTimeout(()=>{store.set("pb:project",project);},600);return()=>clearTimeout(t);},[project]);

  useEffect(()=>{const h=e=>{const tag=((e.target&&e.target.tagName)||"").toLowerCase();const typing=tag==="input"||tag==="textarea"||(e.target&&e.target.isContentEditable);if(e.key==="k"&&(e.metaKey||e.ctrlKey)){e.preventDefault();setJump(j=>!j);}else if(e.key==="/"&&!typing){e.preventDefault();setJump(true);}};window.addEventListener("keydown",h);return()=>window.removeEventListener("keydown",h);},[]);

  const toastFn=useCallback((msg,action)=>setToast({msg,action,id:uid()}),[]);
  const patchScene=useCallback((number,patch)=>setProject(p=>({...p,scenes:p.scenes.map(s=>s.number===number?{...s,...patch}:s)})),[]);
  const tagGear=useCallback((number,name,dept)=>setProject(p=>{let g=p.gear.find(x=>x.name.toLowerCase()===name.toLowerCase()&&x.dept===dept),gear=p.gear;if(!g){g={id:uid(),name,dept};gear=[...p.gear,g];}return {...p,gear,scenes:p.scenes.map(s=>s.number===number?(s.gearTags.includes(g.id)?s:{...s,gearTags:[...s.gearTags,g.id]}):s)};}),[]);
  const openLightbox=useCallback((items,i=0)=>setLight({items:(Array.isArray(items)?items:[items]).filter(Boolean),i}),[]);
  const sendRefBetween=useCallback((fromN,imgId,toN,mode)=>setProject(p=>({...p,scenes:p.scenes.map(s=>{
    if(s.number===toN)return s.refs.includes(imgId)?s:{...s,refs:[...s.refs,imgId]};
    if(mode==="move"&&s.number===fromN)return {...s,refs:s.refs.filter(x=>x!==imgId)};
    return s;
  })})),[]);
  const themeChange=t=>{applyTheme(t);setTb(b=>b+1);};
  // Global back/forward across screens: a history stack of {view,activeScene} snapshots.
  const histRef=useRef({stack:[],idx:-1,nav:false});
  const [,forceHist]=useState(0);
  useEffect(()=>{
    if(!project)return;const h=histRef.current;
    if(h.nav){h.nav=false;forceHist(x=>x+1);return;}
    const loc={view,activeScene},cur=h.stack[h.idx];
    if(cur&&cur.view===loc.view&&cur.activeScene===loc.activeScene)return;
    h.stack=h.stack.slice(0,h.idx+1);h.stack.push(loc);if(h.stack.length>120)h.stack.shift();h.idx=h.stack.length-1;forceHist(x=>x+1);
  },[view,activeScene]);
  const goBack=()=>{const h=histRef.current;if(h.idx<=0)return;h.idx--;h.nav=true;const l=h.stack[h.idx];setActiveScene(l.activeScene);setView(l.view);};
  const goFwd=()=>{const h=histRef.current;if(h.idx>=h.stack.length-1)return;h.idx++;h.nav=true;const l=h.stack[h.idx];setActiveScene(l.activeScene);setView(l.view);};
  const canBack=histRef.current.idx>0,canFwd=histRef.current.idx<histRef.current.stack.length-1;

  if(!project)return <div style={{position:"fixed",inset:0,background:c.bg0,display:"grid",placeItems:"center"}}><div style={{fontFamily:MONO,color:c.accent,fontSize:13}}>Loading deck…</div></div>;

  const present=project.scenes.filter(s=>s.status!=="omitted").sort((a,b)=>cmpScene(a,b,lens));
  const openScene=key=>{if(typeof key==="string"&&key.startsWith("__loc__")){setView("locations");return;}setActiveScene(key);setView("scene");};
  const curScene=project.scenes.find(s=>s.number===activeScene);
  let neighbors=null;
  if(curScene){const i=present.findIndex(s=>s.number===curScene.number);neighbors={prev:i>0?present[i-1].number:null,next:i>=0&&i<present.length-1?present[i+1].number:null};}
  const saveInfo=f=>{const {__new,...d}=f;setProject(p=>{if(info.__new){if(!d.number)return p;return {...p,scenes:[...p.scenes,{...emptyScene(d.number,d),...d}]};}return {...p,scenes:p.scenes.map(s=>s.number===info.number?{...s,...d}:s)};});};
  const delScene=number=>{setProject(p=>({...p,scenes:p.scenes.filter(s=>s.number!==number)}));if(activeScene===number){setView("scenes");setActiveScene(null);}};

  const Nav=wide?(
    <div data-noprint style={{width:188,flexShrink:0,borderRight:`1px solid ${c.line}`,background:c.panel,display:"flex",flexDirection:"column",padding:"14px 12px",gap:3,height:"100vh",position:"sticky",top:0}}>
      <div style={{padding:"4px 10px 16px",display:"flex",alignItems:"center",gap:9}}><div style={{width:26,height:26,borderRadius:7,background:c.accent,display:"grid",placeItems:"center"}}><Film size={15} color="#17120a"/></div><div style={{fontFamily:UI,fontSize:14,fontWeight:800,letterSpacing:"0.04em",color:c.t0}}>DP DECK</div></div>
      {NAV.map(n=>{const on=view===n.k||(n.k==="scenes"&&view==="scene");return <button key={n.k} onClick={()=>{setView(n.k);setMore(false);}} style={{display:"flex",alignItems:"center",gap:11,padding:"10px 11px",borderRadius:9,border:"none",background:on?c.accentSoft:"transparent",color:on?c.accent:c.t1,cursor:"pointer",fontFamily:UI,fontSize:13.5,fontWeight:on?700:550,textAlign:"left"}}><n.icon size={18}/>{n.label}</button>;})}
      <div style={{flex:1}}/>
      <div style={{padding:"8px 11px",fontFamily:UI,fontSize:11.5,color:c.t2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{project.meta.title}</div>
    </div>
  ):null;

  const TopBar=(
    <div data-noprint style={{display:"flex",alignItems:"center",gap:10,padding:wide?"14px 22px":"11px 14px",borderBottom:`1px solid ${c.line}`,background:c.bg0,position:"sticky",top:0,zIndex:40}}>
      {!wide&&<div style={{display:"flex",alignItems:"center",gap:8}}><div style={{width:24,height:24,borderRadius:6,background:c.accent,display:"grid",placeItems:"center"}}><Film size={14} color="#17120a"/></div></div>}
      <div style={{display:"flex",gap:2}}>
        <IconBtn icon={ArrowLeft} onClick={goBack} dim title="Back to last screen" style={{opacity:canBack?1:0.3,width:wide?40:34}}/>
        <IconBtn icon={ArrowRight} onClick={goFwd} dim title="Forward" style={{opacity:canFwd?1:0.3,width:wide?40:34}}/>
      </div>
      <div style={{fontFamily:UI,fontSize:wide?18:15,fontWeight:800,color:c.t0,letterSpacing:"-0.2px"}}>{view==="scene"?(curScene?`Scene ${curScene.number}`:"Scene"):(TITLES[view]||project.meta.title)}</div>
      <div style={{flex:1}}/>
      <IconBtn icon={Search} onClick={()=>setJump(true)} title="Jump to scene ( / or Cmd-K )" dim/>
      {(view==="scenes"||view==="scene")&&<div style={{display:"flex",borderRadius:9,overflow:"hidden",border:`1px solid ${c.line2}`}}>
        {[{k:"story",l:"Story"},{k:"shoot",l:"Shooting"}].map(o=><button key={o.k} onClick={()=>setLens(o.k)} style={{padding:wide?"8px 14px":"7px 11px",border:"none",background:lens===o.k?c.accent:c.bg2,color:lens===o.k?"#17120a":c.t1,fontFamily:UI,fontSize:12.5,fontWeight:700,cursor:"pointer"}}>{o.l}</button>)}
      </div>}
      {wide&&<IconBtn icon={c.bg0===DARK.bg0?SunMedium:MoonStar} dim title="Theme" onClick={()=>{const t=(project.meta.theme==="light")?"dark":"light";setProject(p=>({...p,meta:{...p.meta,theme:t}}));themeChange(t);}}/>}
    </div>
  );

  return <div style={{minHeight:"100vh",background:c.bg0,color:c.t0,display:"flex",fontFamily:UI}}>
    <style>{PRINT_CSS}</style>
    {Nav}
    <div style={{flex:1,minWidth:0,display:"flex",flexDirection:"column",minHeight:"100vh"}}>
      {TopBar}
      <div style={{flex:1,padding:wide?"20px 22px":"15px 13px",paddingBottom:wide?40:90,overflowY:"auto",...(view==="scene"&&wide?{display:"flex",flexDirection:"column"}:{})}}>
        {view==="home"&&<Dashboard project={project} onOpen={openScene} onNav={setView}/>}
        {view==="scene"&&curScene&&<SceneView scene={curScene} scenes={project.scenes} meta={project.meta} locations={project.locations} gearList={project.gear} wide={wide} patchScene={patch=>patchScene(curScene.number,patch)} openInk={setInk} openLightbox={openLightbox} addGear={(name,dept)=>tagGear(curScene.number,name,dept)} goScene={openScene} neighbors={neighbors} openInfo={()=>setInfo(curScene)} onToast={toastFn} onSendRef={sendRefBetween}/>}
        {view==="scene"&&!curScene&&<Empty icon={Film} title="Scene not found" body="It may have been cut. Open the Scenes list." action={<Btn kind="primary" onClick={()=>setView("scenes")}>Scenes</Btn>}/>}
        {view==="scenes"&&<><div style={{display:"flex",justifyContent:"flex-end",marginBottom:12}}><Btn kind="ghost" size={12} onClick={()=>setInfo({__new:true,status:"todo"})}><Plus size={15}/>Add scene</Btn></div><Library project={project} lens={lens} onOpen={openScene}/></>}
        {view==="look"&&<LookBoard project={project} setProject={setProject} openLightbox={openLightbox} onToast={toastFn}/>}
        {view==="days"&&<Days project={project} onOpen={openScene}/>}
        {view==="capture"&&<Capture project={project} setProject={setProject} onFiled={()=>{}} onToast={toastFn}/>}
        {view==="locations"&&<Locations project={project} setProject={setProject} onOpen={openScene} openLightbox={openLightbox} onToast={toastFn}/>}
        {view==="crew"&&<Crew project={project} setProject={setProject}/>}
        {view==="gear"&&<Gear project={project} setProject={setProject}/>}
        {view==="contacts"&&<Contacts project={project} setProject={setProject}/>}
        {view==="export"&&<div>
          <div data-noprint style={{display:"flex",alignItems:"center",gap:12,marginBottom:12,flexWrap:"wrap"}}>
            <div style={{width:270}}><Segmented value={exp.mode} onChange={v=>setExp(e=>({...e,mode:v||"full"}))} options={[{k:"full",label:"Full package"},{k:"gear",label:"Gear pull"}]}/></div>
            {exp.mode==="gear"&&<div style={{display:"flex",gap:6}}>{DEPTS.map(d=>{const on=exp.depts.includes(d.k);return <button key={d.k} onClick={()=>setExp(e=>({...e,depts:on?e.depts.filter(x=>x!==d.k):[...e.depts,d.k]}))} style={{padding:"8px 12px",borderRadius:8,border:`1px solid ${on?c.accent:c.line2}`,background:on?c.accentSoft:c.bg2,color:on?c.accent:c.t1,fontFamily:UI,fontSize:13,fontWeight:650,cursor:"pointer"}}>{d.label}</button>;})}</div>}
            <Btn kind="primary" size={13} onClick={()=>window.print()}><Printer size={16}/>Print / Save as PDF</Btn>
          </div>
          <div data-noprint style={{fontFamily:UI,fontSize:12.5,color:c.t2,lineHeight:1.5,maxWidth:620,marginBottom:14}}>{exp.mode==="full"?"Full package: script, synopsis, notes, shot lists, gear, reference frames, blocking, plus locations and crew/contacts. Scroll through once so images load, then Print and Save as PDF.":"Gear pull: specialty gear by department, each with the scenes it is needed on. Toggle Camera / Grip / Electric above."}</div>
          {exp.mode==="full"?<ExportDoc project={project}/>:<GearSheet project={project} depts={exp.depts}/>}
        </div>}
        {view==="import"&&<Import project={project} setProject={setProject} onToast={toastFn}/>}
        {view==="settings"&&<SettingsView project={project} setProject={setProject} onToast={toastFn} onThemeChange={themeChange}/>}
      </div>
    </div>

    {!wide&&<div data-noprint style={{position:"fixed",left:0,right:0,bottom:0,zIndex:50,background:c.panel,borderTop:`1px solid ${c.line}`,display:"flex",alignItems:"center",justifyContent:"space-around",padding:"7px 6px 9px"}}>
      {MOBILE_NAV.map(k=>{const n=NAV.find(x=>x.k===k);const on=view===k||(k==="scenes"&&view==="scene");return <button key={k} onClick={()=>setView(k)} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:3,background:"none",border:"none",color:on?c.accent:c.t2,cursor:"pointer",flex:1}}><n.icon size={21}/><span style={{fontFamily:UI,fontSize:9.5,fontWeight:600}}>{n.label}</span></button>;})}
      <button onClick={()=>setMore(true)} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:3,background:"none",border:"none",color:c.t2,cursor:"pointer",flex:1}}><ChevronDown size={21} style={{transform:"rotate(180deg)"}}/><span style={{fontFamily:UI,fontSize:9.5,fontWeight:600}}>More</span></button>
    </div>}
    {more&&!wide&&<div data-noprint onClick={()=>setMore(false)} style={{position:"fixed",inset:0,background:c.scrim,zIndex:70,display:"flex",alignItems:"flex-end"}}><div onClick={e=>e.stopPropagation()} style={{background:c.bg1,borderTopLeftRadius:18,borderTopRightRadius:18,width:"100%",padding:"10px 12px 26px",borderTop:`1px solid ${c.line2}`}}>
      <div style={{width:38,height:4,borderRadius:2,background:c.line2,margin:"6px auto 14px"}}/>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:9}}>{NAV.filter(n=>!MOBILE_NAV.includes(n.k)).map(n=><button key={n.k} onClick={()=>{setView(n.k);setMore(false);}} style={{display:"flex",alignItems:"center",gap:11,padding:"14px 13px",borderRadius:11,border:`1px solid ${c.line}`,background:view===n.k?c.accentSoft:c.bg2,color:view===n.k?c.accent:c.t0,cursor:"pointer",fontFamily:UI,fontSize:14,fontWeight:600}}><n.icon size={19}/>{n.label}</button>)}</div>
      <button onClick={()=>{const t=(project.meta.theme==="light")?"dark":"light";setProject(p=>({...p,meta:{...p.meta,theme:t}}));themeChange(t);}} style={{marginTop:9,width:"100%",display:"flex",alignItems:"center",justifyContent:"center",gap:8,padding:"12px",borderRadius:11,border:`1px solid ${c.line}`,background:c.bg2,color:c.t1,cursor:"pointer",fontFamily:UI,fontSize:13.5}}>{c.bg0===DARK.bg0?<SunMedium size={17}/>:<MoonStar size={17}/>}Switch theme</button>
    </div></div>}

    <QuickJump open={jump} scenes={project.scenes} onClose={()=>setJump(false)} onOpen={openScene}/>
    {ink&&<InkCanvas title={ink.title} bgUrl={ink.bgUrl} initial={ink.initial} onClose={()=>setInk(null)} onSave={d=>{ink.onSave&&ink.onSave(d);}}/>}
    <Lightbox state={light} onClose={()=>setLight(null)}/>
    <SceneInfo open={!!info} init={info} locations={project.locations} onClose={()=>setInfo(null)} onSave={saveInfo} onDelete={delScene}/>
    <Toast toast={toast} onClose={()=>setToast(null)}/>
  </div>;
}
const TITLES={home:"Home",days:"Schedule",scenes:"Scenes",look:"Look",capture:"Capture",locations:"Locations",crew:"Crew",gear:"Gear",contacts:"Contacts",export:"Export PDF",import:"Import",settings:"Settings",scene:""};
