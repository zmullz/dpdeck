import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  FileText, Film, MapPin, Calendar, Users, Wrench, Building2, Search, Plus, X,
  Check, Trash2, ChevronLeft, ChevronRight, ChevronDown, Upload, Camera, Link2, Image as ImageIcon, PenLine, Eraser, Undo2, Crosshair, ZoomIn, ZoomOut,
  Inbox, Sun, Sunrise, Sunset, CloudSun, Cloud, CloudRain, CloudSnow, CloudFog,
  CloudDrizzle, CloudLightning, Navigation, Phone, Mail, Volume2, Settings,
  MoonStar, SunMedium, Sparkles, Clock, ListChecks, Compass, Maximize2, CloudDownload, Home, Printer,
  ArrowLeft, ArrowRight, Copy, Send, GripVertical, BookOpen, RefreshCw, CheckCircle2,
  Aperture, Minus, ChevronUp, RotateCw, Grid3x3, AlertTriangle,
} from "lucide-react";
import { get as idbGet, set as idbSet, del as idbDel, keys as idbKeys, createStore as idbCreateStore } from "idb-keyval";

/* DP DECK — a private prep-and-shoot deck for one film. — Web V1. Scene number is the spine. Two PDFs are the backbone. */

/* ---- theme: Rams-calm. swap palette in place, re-render from App -- */
const DARK = {
  bg0:"#121317", bg1:"#191A1F", bg2:"#212329", bg3:"#292C34", panel:"#15161A",
  line:"#2A2D34", line2:"#383C45",
  t0:"#ECEDEF", t1:"#A6ABB4", t2:"#6B7079",
  accent:"#E0A33E", accentSoft:"#E0A33E26", animation:"#17c4c4", animationSoft:"#17c4c422",
  ink:"#E0A33E", day:"#6FB0DE", night:"#7B82CF", dusk:"#C98AA0",
  ok:"#74B98C", warn:"#D8975A", danger:"#CE6B60",
  intC:"#C98F63", extC:"#6FB0DE", scrim:"#000000c2",
};
const LIGHT = {
  bg0:"#ECECE8", bg1:"#FBFBF9", bg2:"#FFFFFF", bg3:"#F2F2EE", panel:"#F4F4F0",
  line:"#E3E3DD", line2:"#D2D2C9",
  t0:"#1A1B1E", t1:"#54575E", t2:"#8B8F96",
  accent:"#BE7A1E", accentSoft:"#BE7A1E1f", animation:"#0e9b9b", animationSoft:"#0e9b9b1f",
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
const DEPTS = [ { k:"camera", label:"Camera", abbr:"C" }, { k:"grip", label:"Grip", abbr:"G" }, { k:"electric", label:"Electric", abbr:"E" }, { k:"sfx", label:"Special FX", abbr:"SFX" } ];

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
// Window when the sun is ABOVE `deg` (harsh high/midday sun — a DP usually avoids shooting here).
// null if the sun never reaches that altitude on this date/latitude.
function sunAboveWindow(date,lat,lng,deg){
  const lw=rad*-lng,phi=rad*lat,D=toDays(date),n=Math.round(D-J0-lw/(2*PI)),ds=aT(0,lw,n),M=sma(ds),L=ecl(M),d=dec(L,0),Jn=stJ(ds,M,L);
  const h=deg*rad,arg=(Math.sin(h)-Math.sin(phi)*Math.sin(d))/(Math.cos(phi)*Math.cos(d));
  if(arg>1||arg<-1||isNaN(arg))return null;
  const Js=setJ(h,lw,phi,d,n,M,L);if(isNaN(Js))return null;
  return {start:fromJulian(Jn-(Js-Jn)),end:fromJulian(Js)};
}
// Time-of-day anchors. The INTENT (a sun condition, pinned to the sun's height) is what gets stored
// on a scene; the actual clock window is DERIVED here from the scene's CURRENT shoot date + location,
// so it moves with the schedule (a scene pushed to a later day recomputes to that day's sun times) and
// is never a hardcoded clock time. Definitions match the app's own sun panel (Golden AM = sunrise to
// the 6-deg point, Golden PM = the 6-deg point to sunset, Blue = the civil-twilight edge, harsh = the
// sun-above-N-deg window from sunAboveWindow), so the readouts agree everywhere.
const TOD_ANCHORS=[
  {k:"golden-pm",label:"Golden hour (PM)"},
  {k:"golden-am",label:"Golden hour (AM)"},
  {k:"blue-pm",label:"Blue hour (PM)"},
  {k:"blue-am",label:"Blue hour (AM)"},
  {k:"sunset",label:"Sunset"},
  {k:"sunrise",label:"Sunrise"},
  {k:"daylight",label:"Any daylight"},
  {k:"under",label:"Avoid harsh sunlight"},
  {k:"under-am",label:"Avoid harsh sunlight: AM"},
  {k:"under-pm",label:"Avoid harsh sunlight: PM"},
];
const todAnchorLabel=k=>{const a=TOD_ANCHORS.find(x=>x.k===k);return a?a.label:"";};
// Returns null when there is no anchor (nothing to compute). Otherwise {ok, win, why?, extra?}:
// ok+win = the derived clock window for that date/location; !ok+why = an HONEST reason it cannot be
// computed yet (no GPS, not scheduled, sun never reaches that height) - never a fabricated time.
function solveTodWindow(anchor,deg,lat,lng,ymd,tz){
  if(!anchor)return null;
  if(lat==null||lat===""||lng==null||lng==="")return {ok:false,why:"add a location with GPS to compute times"};
  if(!ymd)return {ok:false,why:"not scheduled yet, times appear once it has a shoot day"};
  let t;try{t=sunTimes(dayNoonUTC(ymd),+lat,+lng);}catch{return {ok:false,why:"sun data unavailable"};}
  const F=d=>fmtT(d,tz),ok=d=>d&&!isNaN(d);
  const noSun={ok:false,why:"sun stays below this height all day on the shoot date"};
  switch(anchor){
    case "golden-am":return ok(t.sunrise)&&ok(t.goldEnd)?{ok:true,win:`${F(t.sunrise)}-${F(t.goldEnd)}`}:noSun;
    case "golden-pm":return ok(t.goldStart)&&ok(t.sunset)?{ok:true,win:`${F(t.goldStart)}-${F(t.sunset)}`}:noSun;
    case "blue-am":return ok(t.dawn)&&ok(t.sunrise)?{ok:true,win:`${F(t.dawn)}-${F(t.sunrise)}`}:noSun;
    case "blue-pm":return ok(t.sunset)&&ok(t.dusk)?{ok:true,win:`${F(t.sunset)}-${F(t.dusk)}`}:noSun;
    case "sunrise":return ok(t.sunrise)?{ok:true,win:F(t.sunrise)}:noSun;
    case "sunset":return ok(t.sunset)?{ok:true,win:F(t.sunset)}:noSun;
    case "daylight":return ok(t.sunrise)&&ok(t.sunset)?{ok:true,win:`${F(t.sunrise)}-${F(t.sunset)}`}:noSun;
    case "under": case "under-am": case "under-pm":{
      if(!ok(t.sunrise)||!ok(t.sunset))return noSun;
      let D=(deg===""||deg==null)?40:Number(deg);if(!isFinite(D))D=40;D=Math.max(0,Math.min(90,D));  // empty -> the 40deg default; an explicit value (incl 0) is honored; clamp to a real elevation
      const hw=sunAboveWindow(dayNoonUTC(ymd),+lat,+lng,D);
      const noon=ok(t.noon)?t.noon:null;
      if(anchor==="under-am"){  // morning soft window: sunrise up to when the sun first tops N deg
        if(hw&&ok(hw.start))return {ok:true,win:`${F(t.sunrise)}-${F(hw.start)}`,extra:`before harsh (sun tops ${D}° at ${F(hw.start)})`};
        return {ok:true,win:`${F(t.sunrise)}-${F(noon||t.sunset)}`,extra:`sun never tops ${D}° today`};
      }
      if(anchor==="under-pm"){  // afternoon soft window: after the sun drops back below N deg, to sunset
        if(hw&&ok(hw.end))return {ok:true,win:`${F(hw.end)}-${F(t.sunset)}`,extra:`after harsh (sun back below ${D}° at ${F(hw.end)})`};
        return {ok:true,win:`${F(noon||t.sunrise)}-${F(t.sunset)}`,extra:`sun never tops ${D}° today`};
      }
      if(!hw||!ok(hw.start)||!ok(hw.end))return {ok:true,win:`all day is soft (${F(t.sunrise)}-${F(t.sunset)})`,extra:`sun never tops ${D}°`};
      return {ok:true,win:`before ${F(hw.start)}, after ${F(hw.end)}`,extra:`harsh above ${D}°: ${F(hw.start)}-${F(hw.end)}`};
    }
  }
  return null;
}
// ShadeMap deep link: exact 3D shadows for this location at solar noon on the shoot date.
// URL format read from shademap.app's live bundle: /@lat,lng,Zz,MILLISt,0b,0p,0m (t = epoch ms).
function shadeMapUrl(lat,lng,ymd){
  if(!lat||!lng||!ymd)return null;
  try{const noon=sunTimes(dayNoonUTC(ymd),+lat,+lng).noon;const ms=(noon&&!isNaN(noon))?noon.getTime():dayNoonUTC(ymd).getTime();return `https://shademap.app/@${lat},${lng},16z,${ms}t,0b,0p,0m`;}catch{return null;}
}
function tzOff(date,tz){try{const p=new Intl.DateTimeFormat("en-US",{timeZone:tz,hour12:false,year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",second:"2-digit"}).formatToParts(date).reduce((a,x)=>((a[x.type]=x.value),a),{});const u=Date.UTC(p.year,p.month-1,p.day,p.hour==="24"?0:p.hour,p.minute,p.second);return Math.round((u-date.getTime())/6e4);}catch{return 0;}}
function dayNoonUTC(ymd){const [y,m,d]=ymd.split("-").map(Number);return new Date(Date.UTC(y,m-1,d,12));}
function localToAbs(ymd,h,mn,tz){const [y,m,d]=ymd.split("-").map(Number);const off=tzOff(new Date(Date.UTC(y,m-1,d,12)),tz);return new Date(Date.UTC(y,m-1,d,h,mn)-off*6e4);}
function fmtT(date,tz){if(!date||isNaN(date))return "--:--";try{return new Intl.DateTimeFormat("en-GB",{timeZone:tz,hour:"2-digit",minute:"2-digit",hour12:false}).format(date);}catch{return "--:--";}}
function tMin(date,tz){if(!date||isNaN(date))return null;const s=fmtT(date,tz);if(s==="--:--")return null;const [h,m]=s.split(":").map(Number);return ((h%24)*60)+m;} // h%24: WKWebView emits "24:00" at midnight
// minutes from local-midnight-of `ymd` (in tz) to `date`; stays monotonic across a tz day boundary
// (a location far in longitude from the project tz can have sunset land after local midnight) so the
// sun bar never collapses to a zero-width / backwards segment. For a same-tz day this equals tMin.
function tMinAbs(date,ymd,tz){if(!date||isNaN(date)||!ymd)return null;try{const mid=localToAbs(ymd,0,0,tz);return Math.round((date.getTime()-mid.getTime())/6e4);}catch{return tMin(date,tz);}}
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
/* Content-addressed images: identical image content reuses one id, so re-importing the project
   file (or adding the same frame twice) never creates duplicates. hashStr is a fast djb2 of the
   data-URL + its length; the contentHash->id map persists under pb:imghash:* so dedup survives
   reloads. */
const imgHashIndex=new Map(); let imgIndexBuilt=false;
function hashStr(s){let h=5381;for(let i=0;i<s.length;i++)h=(Math.imul(h,33)^s.charCodeAt(i))>>>0;return h.toString(36)+"-"+s.length;}
async function putImage(dataUrl){
  const hash=hashStr(dataUrl);
  let id=imgHashIndex.get(hash);
  if(!id){id=(await store.get("pb:imghash:"+hash))||null;if(id)imgHashIndex.set(hash,id);}
  if(id){if(!imgCache.has(id))imgCache.set(id,dataUrl);return id;}
  id=uid();imgCache.set(id,dataUrl);await store.set("pb:img:"+id,dataUrl);await store.set("pb:imghash:"+hash,id);imgHashIndex.set(hash,id);return id;
}
async function ensureImageHashIndex(){ // index existing images so imports dedup against them
  if(imgIndexBuilt)return;imgIndexBuilt=true;
  for(const k of (await store.list())){if(!String(k).startsWith("pb:img:"))continue;const data=await store.get(k);if(typeof data!=="string")continue;const h=hashStr(data);if(!imgHashIndex.has(h)){imgHashIndex.set(h,k.slice(7));await store.set("pb:imghash:"+h,k.slice(7));}}
}
/* One-time cleanup: collapse byte-identical images to one canonical id, rewrite every reference
   (scene refs, look, location images/plans/cover, sketch backgrounds), delete the duplicates. */
async function dedupeImages(){
  const byHash=new Map(),remap=new Map();
  for(const k of (await store.list())){if(!String(k).startsWith("pb:img:"))continue;const id=k.slice(7);const data=await store.get(k);if(typeof data!=="string")continue;const h=hashStr(data);const canon=byHash.get(h);if(canon)remap.set(id,canon);else byHash.set(h,id);}
  imgHashIndex.clear();for(const [h,id] of byHash){imgHashIndex.set(h,id);await store.set("pb:imghash:"+h,id);}
  imgIndexBuilt=true;
  if(!remap.size)return {removed:0};
  const fix=arr=>uniq((arr||[]).map(x=>remap.get(x)||x));
  const p=await store.get("pb:project");
  if(p){
    p.scenes=(p.scenes||[]).map(s=>({...s,refs:fix(s.refs)}));
    p.look=fix(p.look);
    p.locations=(p.locations||[]).map(l=>({...l,images:fix(l.images),plans:fix(l.plans),imgId:remap.get(l.imgId)||l.imgId}));
    await store.set("pb:project",p);await store.set("pb:base_snapshot",p);
  }
  for(const k of (await store.list())){if(String(k).startsWith("pb:sketch:")){const sk=await store.get(k);if(sk&&sk.bgImgId&&remap.get(sk.bgImgId)){sk.bgImgId=remap.get(sk.bgImgId);await store.set(k,sk);}}}
  for(const dupId of remap.keys()){await store.del("pb:img:"+dupId);imgCache.delete(dupId);}
  return {removed:remap.size};
}

/* lossless full backup/restore (everything under pb:*) for never-lose-data + cross-device */
function downloadJSON(filename,obj){const blob=new Blob([JSON.stringify(obj)],{type:"application/json"});const u=URL.createObjectURL(blob);const a=document.createElement("a");a.href=u;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),1500);}
async function exportFullBackup(){
  // Selective: only what the project references. Excludes device-local secrets (pb:aikey,
  // pb:r2key) and orphaned images so backups/sync stay lean and never leak keys.
  const p=await store.get("pb:project")||{};
  const data={"pb:project":p};
  const imgIds=new Set();
  const addRefs=arr=>{for(const r of arr||[])if(typeof r==="string"&&!isImgUrl(r)&&!isR2Ref(r))imgIds.add(r);};
  for(const s of p.scenes||[])addRefs(s.refs);
  addRefs(p.look);
  for(const l of p.locations||[]){addRefs(l.images);addRefs(l.plans);if(l.imgId&&!isImgUrl(l.imgId)&&!isR2Ref(l.imgId))imgIds.add(l.imgId);}
  const sketchIds=new Set();
  for(const s of p.scenes||[])for(const id of s.sketches||[])sketchIds.add(id);
  for(const id of sketchIds){const sk=await store.get("pb:sketch:"+id);if(sk){data["pb:sketch:"+id]=sk;if(sk.bgImgId&&!isImgUrl(sk.bgImgId)&&!isR2Ref(sk.bgImgId))imgIds.add(sk.bgImgId);}}
  for(const id of imgIds){const v=await store.get("pb:img:"+id);if(v)data["pb:img:"+id]=v;const f=await store.get("pb:imgfull:"+id);if(f)data["pb:imgfull:"+id]=f;}
  for(const k of (await store.list())){if(String(k).startsWith("pb:scriptink:"))data[k]=await store.get(k);}
  // Ground-truth document PDFs ride the deck so they sync across devices. (animation = a small r2: marker, the PDF bytes live on R2 — see ensureDoc.)
  for(const slot of ["script","schedule","animation"]){const d=await store.get("pb:doc:"+slot);if(d){data["pb:doc:"+slot]=d;const n=await store.get("pb:doc:"+slot+"name");if(n)data["pb:doc:"+slot+"name"]=n;}}
  const legacyPdf=await store.get("pb:scriptpdf");if(legacyPdf&&!data["pb:doc:script"]){data["pb:scriptpdf"]=legacyPdf;const n=await store.get("pb:scriptpdfname");if(n)data["pb:scriptpdfname"]=n;}
  return {dpdeckBackup:1,ts:Date.now(),data};
}
async function importFullBackup(obj){
  if(!obj||obj.dpdeckBackup!==1||!obj.data||!obj.data["pb:project"])throw new Error("Not a DP Deck backup file.");
  // Write everything except the project first, then the project LAST — so a mid-import failure
  // (e.g. storage quota) leaves the previous deck intact rather than half-overwritten.
  for(const [k,v] of Object.entries(obj.data)){if(k==="pb:project")continue;await store.set(k,v);if(String(k).startsWith("pb:img:"))imgCache.set(k.slice(7),v);}
  await store.set("pb:project",obj.data["pb:project"]);
  await store.set("pb:base_snapshot",obj.data["pb:project"]);   // keep the 3-way merge ancestor in lockstep (restore / backup / pull / merge)
}

/* ---- utils ------------------------------------------------------- */
const uid=()=>Math.random().toString(36).slice(2,9)+Date.now().toString(36).slice(-3);
const isImgUrl=s=>typeof s==="string"&&/^https?:\/\//.test(s.trim());
const toUrlArr=x=>!x?[]:(Array.isArray(x)?x:[x]).map(u=>String(u).trim()).filter(isImgUrl);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const todayISO=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;};
const numKey=s=>String(s??"").toUpperCase().replace(/\s+/g,"");
function cmpNum(a,b){return String(a??"").localeCompare(String(b??""),undefined,{numeric:true,sensitivity:"base"});} // String() so a numeric scene number / shootDay from an external deck never throws

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
async function pdfRenderPage(doc,n,scale=1.6,q=0.85){const page=await doc.getPage(n);const vp=page.getViewport({scale});const cv=document.createElement("canvas");cv.width=vp.width;cv.height=vp.height;await page.render({canvasContext:cv.getContext("2d"),viewport:vp}).promise;return {url:cv.toDataURL("image/jpeg",q),w:vp.width,h:vp.height};}

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
// Location photos can be stored as "r2:<key>" refs (thumbnail at <key>_t.jpg, full at <key>.jpg on
// R2) so the synced deck stays tiny no matter how many photos there are. The thumbnail is fetched
// authed once and cached as a data URL in IndexedDB (pb:imgcache:*, device-local, NOT in the deck)
// so it works offline after the first view.
const isR2Ref=s=>typeof s==="string"&&s.startsWith("r2:");
const r2ThumbMem=new Map();
async function r2ThumbDataURL(ref){
  if(!isR2Ref(ref))return null;
  if(r2ThumbMem.has(ref))return r2ThumbMem.get(ref);
  const key=ref.slice(3)+"_t.jpg";
  try{const cached=await store.get("pb:imgcache:"+key);if(cached){r2ThumbMem.set(ref,cached);return cached;}}catch{}
  try{
    const res=await fetch(R2_BASE+"/read/"+encodeURIComponent(key).replace(/%2F/g,"/"),{headers:r2Headers()});
    if(!res.ok)throw new Error("thumb "+res.status);
    const blob=await res.blob();
    const dataUrl=await new Promise((rs,rj)=>{const fr=new FileReader();fr.onload=()=>rs(fr.result);fr.onerror=rj;fr.readAsDataURL(blob);});
    r2ThumbMem.set(ref,dataUrl);try{await store.set("pb:imgcache:"+key,dataUrl);}catch{}
    return dataUrl;
  }catch{return null;}
}
// DURABLE IMAGE BACKUP (additive, never touches the deck): every referenced scene/location image blob
// (pb:img:<id>) is mirrored to R2 under dpdeck/imgblob/<id>. This is a pure safety copy - it cannot cause
// data loss, only recovery. If a device ever lacks a blob (wipe, rollback orphan, fresh device), StoredImg
// fetches it back from here automatically. Throttled; tracks what is already backed up in pb:imgbk.
const imgBackedUp=new Set(); let imgBkLoaded=false, imgBkBusy=false;
async function loadImgBackedUp(){if(imgBkLoaded)return;imgBkLoaded=true;try{const a=await store.get("pb:imgbk");if(Array.isArray(a))a.forEach(x=>imgBackedUp.add(x));}catch{}}
function referencedImgIds(p){const ids=new Set();const add=arr=>{for(const r of arr||[])if(typeof r==="string"&&!isImgUrl(r)&&!isR2Ref(r))ids.add(r);};for(const s of (p&&p.scenes)||[])add(s.refs);for(const l of (p&&p.locations)||[]){add(l.images);add(l.plans);if(l.imgId&&!isImgUrl(l.imgId)&&!isR2Ref(l.imgId))ids.add(l.imgId);}return ids;}
async function backupSceneImages(){
  if(!R2_KEY||imgBkBusy)return;imgBkBusy=true;
  try{
    await loadImgBackedUp();
    const p=await store.get("pb:project");if(!p)return;
    const todo=[...referencedImgIds(p)].filter(id=>!imgBackedUp.has(id));
    let n=0,changed=false;
    for(const id of todo){
      if(n>=24)break;                                          // cap per run; the rest ride the next cycle
      const v=await store.get("pb:img:"+id);
      if(typeof v!=="string"){imgBackedUp.add(id);continue;}    // nothing local to back up (already remote or absent)
      try{await r2Write("dpdeck/imgblob/"+id,v);imgBackedUp.add(id);changed=true;n++;}catch{break;}  // stop on error, retry next cycle
    }
    if(changed){try{await store.set("pb:imgbk",[...imgBackedUp]);}catch{}}
    if(todo.length>n)setTimeout(()=>backupSceneImages(),4000);  // more to do -> continue shortly
  }finally{imgBkBusy=false;}
}
async function fetchImgBackup(id){
  if(!R2_KEY)return null;
  try{const res=await fetch(R2_BASE+"/read/"+encodeURIComponent("dpdeck/imgblob/"+id).replace(/%2F/g,"/"),{headers:r2Headers()});if(!res.ok)return null;const t=await res.text();return /^data:/.test(t)?t:null;}catch{return null;}
}
function StoredImg({id,style,onClick}){
  const [src,setSrc]=useState(isImgUrl(id)?id:(isR2Ref(id)?null:(imgCache.get(id)||null)));
  useEffect(()=>{let on=true;
    if(isImgUrl(id)){setSrc(id);return;}
    if(isR2Ref(id)){setSrc(null);r2ThumbDataURL(id).then(d=>{if(on)setSrc(d);});return()=>{on=false;};}
    if(imgCache.has(id)){setSrc(imgCache.get(id));return;}
    setSrc(null); // clear stale image when the id changes in place before the new one resolves
    store.get("pb:img:"+id).then(v=>{
      if(on&&v){imgCache.set(id,v);setSrc(v);return;}
      // local blob missing -> recover it from the R2 backup and re-cache it locally
      if(on)fetchImgBackup(id).then(d=>{if(on&&d){imgCache.set(id,d);setSrc(d);try{store.set("pb:img:"+id,d);}catch{}}});
    });
    return()=>{on=false;};
  },[id]);
  // onClick rides the placeholder too, so a tap registers even before the image finishes loading
  if(!src)return <div onClick={onClick} style={{...style,background:c.bg2,display:"grid",placeItems:"center",cursor:onClick?"pointer":undefined}}><ImageIcon size={16} color={c.t2}/></div>;
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
// Cloud sync is HARD-DISABLED on a local dev host (localhost / 127.0.0.1 / ::1), even if a key is stored,
// so running `npm run dev` can never read, push, or merge against the production deck. Local IndexedDB and
// every feature still work; only the cloud round-trip is off. The live site (a real domain) is unaffected.
const DEV_HOST=(()=>{try{return /^(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])$/.test(location.hostname);}catch{return false;}})();
async function loadR2Key(){try{R2_KEY=DEV_HOST?"":((await store.get("pb:r2key"))||"");}catch{R2_KEY="";}}
function setR2Key(k){const v=(k||"").trim();R2_KEY=DEV_HOST?"":v;return store.set("pb:r2key",v);}
const r2Headers=()=>R2_KEY?{"X-API-Key":R2_KEY}:undefined;
const R2_KEYS={script:"dpdeck/script.json",schedule:"dpdeck/schedule.json",locations:"dpdeck/locations.json",crew:"dpdeck/crew.json",contacts:"dpdeck/contacts.json"};
const DECK_KEY="dpdeck/_deck.json"; // full lossless deck snapshot for cross-device sync
const DECK_META="dpdeck/_deckmeta.json"; // tiny {ts} so a device can check freshness without pulling the whole deck
async function remoteDeckMeta(){try{const t=await r2ReadRaw(DECK_META);return t?JSON.parse(t):null;}catch{return null;}}
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
/* Location photos use a hybrid store: a small thumbnail is embedded in the deck (works offline),
   and the full-resolution image lives as its own R2 object under pb:imgfull:{id}. The Lightbox
   fetches the full (authed) on demand and falls back to the embedded thumb offline. */
const fullUrlCache=new Map(); const FULL_CACHE_MAX=24;
async function fullImageURL(id){
  if(typeof id!=="string"||isImgUrl(id))return null;
  if(fullUrlCache.has(id))return fullUrlCache.get(id);
  let key=null;
  if(isR2Ref(id))key=id.slice(3)+".jpg";
  else{try{key=await store.get("pb:imgfull:"+id);}catch{}}
  if(!key){fullUrlCache.set(id,null);return null;}
  try{const res=await fetch(R2_BASE+"/read/"+encodeURIComponent(key).replace(/%2F/g,"/"),{headers:r2Headers()});if(!res.ok)throw new Error("full "+res.status);const u=URL.createObjectURL(await res.blob());
    // bound memory: revoke + drop the oldest blob URLs (Map keeps insertion order; the newest is what the Lightbox shows, so the evicted one is never the visible image)
    while(fullUrlCache.size>=FULL_CACHE_MAX){const k=fullUrlCache.keys().next().value;const old=fullUrlCache.get(k);if(typeof old==="string"&&old.startsWith("blob:"))URL.revokeObjectURL(old);fullUrlCache.delete(k);}
    fullUrlCache.set(id,u);return u;}catch{return null;}
}
/* ---- SAFE MERGE-ON-PUSH (3-way, additive-biased) ------------------------------
   A device NEVER blindly overwrites the cloud deck. Before pushing, if the cloud has
   changes this device hasn't seen, it re-pulls and MERGES against a stored ancestor
   (pb:base_snapshot = the project as of the last sync), so no edit on any device is lost:
   - additive fields (notes/shots/sketches/refs/gear/crew/contacts/look/plans/inbox) UNION;
   - the scene spine is the UNION of scene numbers (a stale 136-scene device can't drop 140);
   - scalar/bulk fields (status, slug, schedule, location links, images, days) resolve to
     whichever side changed vs the ancestor; a true both-changed tie is broken by per-scene
     `_mt` (newest wins). Location photos resolve to the changed/newer set (no r2-vs-embedded
     duplicates). Without an ancestor yet (a device's first sync on this version) it stays
     additive + prefers the newer remote for bulk fields, which still prevents data loss. */
const mtOf=x=>(x&&typeof x._mt==="number")?x._mt:0;
function mergeText(base,ours,theirs,om,tm){                   // notes: one-side-unchanged is clean; both-changed -> newest wins, keep the other if it has unique text (no silent loss, no line resurrection)
  const a=ours||"",b=theirs||"",bs=base||"";
  if(a===b)return a;
  if(a===bs)return b; if(b===bs)return a;
  const win=(tm>om)?b:a,lose=(tm>om)?a:b;
  if(!lose.trim()||win.indexOf(lose.trim())>=0)return win;
  return win+"\n(also edited on another device:)\n"+lose;
}
const jeq=(x,y)=>JSON.stringify(x===undefined?null:x)===JSON.stringify(y===undefined?null:y);
function pickField(base,ours,theirs,om,tm){                   // scalars: 3-way; newer _mt wins; exact tie -> deterministic by value
  if(jeq(ours,theirs))return ours;
  if(base!==undefined){if(jeq(ours,base))return theirs;if(jeq(theirs,base))return ours;}
  if(tm>om)return theirs;if(om>tm)return ours;
  return JSON.stringify(theirs)>JSON.stringify(ours)?theirs:ours;  // exact _mt tie: pick by value so the merge is symmetric (same winner regardless of which device pushes), no flip-flop on retries
}
function pickBulk(base,ours,theirs){                          // images/days/lookNotes: 3-way, no-base -> non-empty / newer remote
  if(jeq(ours,theirs))return ours;
  if(base!==undefined){if(jeq(ours,base))return theirs;if(jeq(theirs,base))return ours;}
  const empty=v=>v==null||(Array.isArray(v)&&!v.length)||v==="";
  if(empty(theirs)&&!empty(ours))return ours;
  if(empty(ours)&&!empty(theirs))return theirs;
  return theirs;                                              // both non-empty, no base: prefer the newer remote deck
}
// 3-way list merge honoring add + edit + DELETE. An item in the ancestor but gone from one side
// (and unchanged on the other) STAYS deleted; an item only one side has vs the ancestor was added and
// is kept; edit-vs-delete keeps the edit. No ancestor (base not an array) -> additive union (never drop).
// mergeItem(base,ours,theirs) merges an item present on both sides.
function merge3List(base,ours,theirs,keyFn,mergeItem){
  ours=ours||[];theirs=theirs||[];const hasBase=Array.isArray(base);
  const bm=new Map((base||[]).map(x=>[keyFn(x),x])),om=new Map(ours.map(x=>[keyFn(x),x])),tm=new Map(theirs.map(x=>[keyFn(x),x]));
  const out=[],seen=new Set(),order=[...ours.map(keyFn),...theirs.map(keyFn).filter(k=>!om.has(k))];
  for(const k of order){
    if(seen.has(k))continue;seen.add(k);
    const o=om.get(k),t=tm.get(k);
    if(o!==undefined&&t!==undefined)out.push(mergeItem?mergeItem(bm.get(k),o,t):o);
    else if(o!==undefined){if(!(hasBase&&bm.has(k)&&jeq(o,bm.get(k))))out.push(o);}   // theirs deleted: honor iff ours unchanged
    else if(t!==undefined){if(!(hasBase&&bm.has(k)&&jeq(t,bm.get(k))))out.push(t);}   // ours deleted: honor iff theirs unchanged
  }
  return out;
}
function mergeShot(b,o,t){const bb=b||{};return {...o,done:pickField(bb.done,o.done,t.done,0,0),text:pickField(bb.text,o.text,t.text,0,0)};} // per-field 3-way: the side that changed vs the ancestor wins (an unchanged side never overrides an edit, incl. a shortening or an uncheck)
const mergePerson=fields=>(b,o,t)=>{const r={...t,...o};for(const f of fields)r[f]=pickField((b||{})[f],o[f],t[f],0,0);return r;}; // field-3-way; prefer the changed side
function mergeScene(base,ours,theirs){
  const om=mtOf(ours),tm=mtOf(theirs),b=base||{},o={...ours};
  o.notes=mergeText(b.notes,ours.notes,theirs.notes,om,tm);
  o.shots=merge3List(base&&base.shots,ours.shots,theirs.shots,x=>x.id||x.text,mergeShot);
  o.refs=merge3List(base&&base.refs,ours.refs,theirs.refs,x=>x);
  o.sketches=merge3List(base&&base.sketches,ours.sketches,theirs.sketches,x=>x);
  o.gearTags=merge3List(base&&base.gearTags,ours.gearTags,theirs.gearTags,x=>x);
  o.aiGear=merge3List(base&&base.aiGear,ours.aiGear,theirs.aiGear,x=>x.text);
  for(const f of ["slug","set","dayNight","syn","synEdited","status","pageStart","pageEnd","eighths","locationId","noAutoLoc","shootDay","shootDate","shootOrder","storyIndex","scriptText","storyDay","tod","todSun","todDeg","animation"])
    o[f]=pickField(b[f],ours[f],theirs[f],om,tm);
  o._mt=Math.max(om,tm);
  return o;
}
function mergeLoc(base,ours,theirs){
  const om=mtOf(ours),tm=mtOf(theirs),b=base||{},o={...ours};
  o.images=merge3List(base&&base.images,ours.images,theirs.images,x=>x); // per-photo add/delete: concurrent adds both kept, deletes honored, no r2-vs-embedded dupes
  o.plans=merge3List(base&&base.plans,ours.plans,theirs.plans,x=>x);
  for(const f of ["name","address","lat","lng","notes","imgId","status","radius"])o[f]=pickField(b[f],ours[f],theirs[f],om,tm);
  o._mt=Math.max(om,tm);
  return o;
}
function mergeProjects(base,ours,theirs){
  base=base||{};ours=ours||{};theirs=theirs||{};
  const out={...ours};
  out.scenes=merge3List(base.scenes,ours.scenes,theirs.scenes,s=>numKey(s.number),mergeScene);
  out.locations=merge3List(base.locations,ours.locations,theirs.locations,l=>l.id,mergeLoc);
  const depts=new Set([...Object.keys(ours.crew||{}),...Object.keys(theirs.crew||{}),...Object.keys(base.crew||{})]);
  out.crew={};for(const d of depts)out.crew[d]=merge3List((base.crew||{})[d],(ours.crew||{})[d],(theirs.crew||{})[d],m=>m.id||(m.name||"").trim().toLowerCase(),mergePerson(["name","role","phone","email","pron","dept"]));
  out.contacts=merge3List(base.contacts,ours.contacts,theirs.contacts,c=>c.id||(c.name||"").trim().toLowerCase(),mergePerson(["name","role","dept","address","lat","lng","phone","email"]));
  out.gear=merge3List(base.gear,ours.gear,theirs.gear,g=>g.id||((g.name||"").toLowerCase()+"|"+g.dept));
  out.look=merge3List(base.look,ours.look,theirs.look,x=>x);
  out.inbox=merge3List(base.inbox,ours.inbox,theirs.inbox,x=>x.id||JSON.stringify(x));
  out.lookNotes=pickBulk(base.lookNotes,ours.lookNotes,theirs.lookNotes);
  out.days=pickBulk(base.days,ours.days,theirs.days);
  out.events=merge3List(base.events,ours.events,theirs.events,e=>e&&(e.id||JSON.stringify(e)));  // calendar events sync + cross-device add/edit/delete

  out.meta={...theirs.meta,...ours.meta};                    // device-local prefs (theme) stay; title/tz are identical
  // Integrity: a gearTag must never orphan. If concurrent gear-delete + scene-edit dropped a gear def
  // that a scene still references, re-attach it from any side so the gear NAME is never lost.
  const haveGear=new Set((out.gear||[]).map(g=>g&&g.id).filter(Boolean));
  const needGear=new Set();for(const s of out.scenes||[])for(const t of (s.gearTags||[]))if(t&&!haveGear.has(t))needGear.add(t);
  if(needGear.size){for(const id of needGear)for(const pool of [ours.gear,theirs.gear,base.gear]){const g=(pool||[]).find(x=>x&&x.id===id);if(g){out.gear=[...(out.gear||[]),g];haveGear.add(id);break;}}}
  return out;
}
function refImgIds(p){
  const ids=new Set();
  const add=arr=>{for(const r of arr||[])if(typeof r==="string"&&!isImgUrl(r)&&!isR2Ref(r))ids.add(r);};
  for(const s of p.scenes||[])add(s.refs);
  add(p.look);
  for(const l of p.locations||[]){add(l.images);add(l.plans);if(l.imgId&&!isImgUrl(l.imgId)&&!isR2Ref(l.imgId))ids.add(l.imgId);}
  return ids;
}
function mergeDecks(baseProj,ours,theirs){                   // merge full backups -> a clean SELECTIVE deck (no orphan blobs)
  const merged=mergeProjects(baseProj,ours.data["pb:project"],theirs.data["pb:project"]);
  const pool={...theirs.data,...ours.data};                  // union of every blob key (ours wins per key)
  const data={"pb:project":merged};
  const imgIds=refImgIds(merged),skIds=new Set();
  for(const s of merged.scenes||[])for(const id of s.sketches||[])skIds.add(id);
  for(const id of skIds){const sk=pool["pb:sketch:"+id];if(sk){data["pb:sketch:"+id]=sk;if(sk.bgImgId&&!isImgUrl(sk.bgImgId)&&!isR2Ref(sk.bgImgId))imgIds.add(sk.bgImgId);}}
  for(const id of imgIds){if(pool["pb:img:"+id]!==undefined)data["pb:img:"+id]=pool["pb:img:"+id];if(pool["pb:imgfull:"+id]!==undefined)data["pb:imgfull:"+id]=pool["pb:imgfull:"+id];}
  // Script ink: per-PAGE union, not whole-object LWW. Two devices that marked different pages of the same
  // scene both keep their pages; a page edited on both sides resolves by newer per-page _mt, else more strokes.
  const inkKeys=new Set();for(const src of [ours.data,theirs.data])for(const k of Object.keys(src))if(k.startsWith("pb:scriptink:"))inkKeys.add(k);
  for(const k of inkKeys){const o=ours.data[k],t=theirs.data[k];
    if(o&&t){const m={...t,...o};
      for(const pg of Object.keys(t)){if(o[pg]&&!jeq(o[pg],t[pg])){const om=(o[pg]||{})._mt||0,tm=(t[pg]||{})._mt||0,oc=((o[pg]||{}).strokes||[]).length,tc=((t[pg]||{}).strokes||[]).length;m[pg]=(tm>om||(tm===om&&tc>oc))?t[pg]:o[pg];}}
      data[k]=m;}
    else data[k]=o||t;}
  for(const slot of ["script","schedule","animation"]){if(pool["pb:doc:"+slot]!==undefined){data["pb:doc:"+slot]=pool["pb:doc:"+slot];if(pool["pb:doc:"+slot+"name"]!==undefined)data["pb:doc:"+slot+"name"]=pool["pb:doc:"+slot+"name"];}}
  return {dpdeckBackup:1,ts:Math.max(ours.ts||0,theirs.ts||0)+1,data};
}
let pushLock=Promise.resolve();                              // serialize ALL pushes (debounce / focus / hide / bootstrap) — no overlapping cloud writes
// Mass-deletion guard: a push that would drop a large share of scenes vs the last known cloud/base is
// HELD, not written, so a bad/stale/empty local deck can never silently wipe the cloud (the dev-key
// incident). Trips only on a real shrink (>40% AND >=5 scenes gone); scenes are normally never removed
// (cuts become "omitted", which stay in the array), so this is silent in normal use. Override via
// forcePushDeck() (Settings -> "Force push"), which sets forceNextPush for exactly one push.
let forceNextPush=false;
const SHRINK_GUARD_FRAC=0.6, SHRINK_GUARD_MIN=5;
const crewCount=p=>Object.values((p&&p.crew)||{}).reduce((n,a)=>n+(Array.isArray(a)?a.length:0),0); // total crew across all departments, for the shrink guard
async function forcePushDeck(){forceNextPush=true;try{const r=await pushDeckToCloud();await store.del("pb:sync_blocked");return r;}finally{forceNextPush=false;}}
function pushDeckToCloud(){const run=pushLock.then(()=>_pushDeckToCloud(0),()=>_pushDeckToCloud(0));pushLock=run.catch(()=>{});return run;}
async function _pushDeckToCloud(depth,carryBase,carryOurs){
  if(!R2_KEY)throw new Error("Add your Files Worker key in Settings first.");
  depth=depth||0;
  const base=(carryOurs!==undefined)?carryBase:((await store.get("pb:base_snapshot"))||null);  // TRUE common ancestor, held CONSTANT across CAS retries
  const ours=(carryOurs!==undefined)?carryOurs:await exportFullBackup();                         // our local edits, captured ONCE (never re-diffed against a prior merge)
  const meta=await remoteDeckMeta();
  const localSynced=(await store.get("pb:synced_ts"))||0,remoteTs=(meta&&meta.ts)||0;
  let merged=false,pushDeck=ours,theirsScenes=0,theirsLocs=0,theirsCrew=0;
  if(remoteTs>localSynced){                                  // cloud is ahead -> MUST merge; a throw here must NOT fall through to an overwrite
    const t=await r2ReadRaw(DECK_KEY);                        // (throws on a transient read error -> propagates; never plain-overwrites unseen edits)
    if(t){
      const theirs=JSON.parse(t);
      const tp=(theirs.data||{})["pb:project"]||{};
      theirsScenes=(tp.scenes||[]).length;theirsLocs=(tp.locations||[]).length;theirsCrew=crewCount(tp);
      const m=mergeDecks(base,ours,theirs);
      merged=true;
      if(jeq(m.data["pb:project"],theirs.data["pb:project"])){ // we contributed nothing -> adopt remote, no push (prevents sync ping-pong)
        await importFullBackup(m);
        await store.set("pb:synced_ts",theirs.ts||remoteTs);await store.set("pb:project_mtime",theirs.ts||remoteTs);
        return {len:0,merged,pushed:false};
      }
      pushDeck=m;                                             // do NOT adopt locally yet — only after the write commits (so base_snapshot can't poison a CAS retry)
    }
  }
  // Mass-deletion guard: never auto-write a deck that drops a large share of ANY major collection
  // (scenes / locations / crew) vs the last known cloud/base, and never push an empty deck once we had one.
  const P=(pushDeck.data||{})["pb:project"]||{};
  const newC={scenes:(P.scenes||[]).length,locations:(P.locations||[]).length,crew:crewCount(P)};
  const baseC={scenes:(base&&Array.isArray(base.scenes))?base.scenes.length:0,locations:(base&&Array.isArray(base.locations))?base.locations.length:0,crew:crewCount(base)};
  const priorC={scenes:Math.max(baseC.scenes,theirsScenes),locations:Math.max(baseC.locations,theirsLocs),crew:Math.max(baseC.crew,theirsCrew)};
  let blocked=null;
  if(!forceNextPush){
    if(newC.scenes===0&&(localSynced>0||priorC.scenes>0))blocked={kind:"scenes",prior:priorC.scenes,next:0};  // never push an empty deck once a real deck was ever synced
    else for(const k of ["scenes","locations","crew"]){
      if(priorC[k]>0&&newC[k]<priorC[k]*SHRINK_GUARD_FRAC&&(priorC[k]-newC[k])>=SHRINK_GUARD_MIN){blocked={kind:k,prior:priorC[k],next:newC[k]};break;}
    }
  }
  if(blocked){
    await store.set("pb:sync_blocked",{...blocked,at:Date.now()});
    const err=new Error("Cloud sync paused: this device has "+blocked.next+" "+blocked.kind+" but the cloud has "+blocked.prior+". Held to protect the cloud deck. Pull the cloud copy, or force-push in Settings if this is intended.");
    err.code="SYNC_SHRINK_GUARD";err.guard=blocked;
    throw err;
  }
  pushDeck.ts=Math.max(pushDeck.ts||Date.now(),localSynced+1,remoteTs+1);   // monotonic ts — immune to device clock skew
  const s=JSON.stringify(pushDeck);
  if(depth<3){const meta2=await remoteDeckMeta();if(meta2&&meta2.ts&&meta2.ts>Math.max(localSynced,remoteTs))return _pushDeckToCloud(depth+1,base,ours);}  // cloud advanced -> re-merge against the SAME ancestor + our ORIGINAL edits
  await r2Write(DECK_KEY,s);                                  // both writes awaited; a failure leaves us dirty -> retried next cycle
  await r2Write(DECK_META,JSON.stringify({ts:pushDeck.ts}));  // advance synced ONLY after BOTH deck + meta land
  if(merged)await importFullBackup(pushDeck);                 // adopt the merged deck locally now that it's committed
  await store.set("pb:synced_ts",pushDeck.ts);               // NOT pb:project_mtime: an edit made DURING this push keeps mtime>synced so it's pushed next cycle (not silently equalized)
  await store.set("pb:base_snapshot",pushDeck.data["pb:project"]);  // ancestor = EXACTLY what we pushed to the cloud (never a re-read of live pb:project, which a during-push edit can have advanced)
  try{await store.del("pb:sync_blocked");}catch{}               // a clean write clears any prior shrink-guard block
  try{await writeDailySnapshot(s,pushDeck.ts);}catch{}
  try{await writeShadow(pushDeck.data["pb:project"]);}catch{}    // per-device clobber-proof safety copy (project only)
  backupSceneImages();                                          // mirror any new referenced image blobs to R2 (fire-and-forget)
  return {len:s.length,merged,pushed:true};
}
async function pullDeckFromCloud(){
  if(!R2_KEY)throw new Error("Add your Files Worker key in Settings first.");
  const t=await r2ReadRaw(DECK_KEY);if(!t)throw new Error("No cloud deck yet. Push from another device first.");
  // Snapshot THIS device's current deck before a pull overwrites it, so a bad/rolled-back cloud pull is
  // always recoverable to what this device had a moment ago (the exact recovery missing in the incident).
  try{const cur=await store.get("pb:project");if(cur&&(cur.scenes||[]).length)await writeSnapshotNow("before-pull-"+Date.now(),"Before cloud pull "+new Date().toLocaleString());}catch{}
  const o=JSON.parse(t);await importFullBackup(o);
  await store.set("pb:synced_ts",o.ts||Date.now());await store.set("pb:project_mtime",o.ts||Date.now());
  await store.set("pb:base_snapshot",await store.get("pb:project"));
  return o.ts||0;
}
async function r2Delete(key){try{const res=await fetch(R2_BASE+"/delete/"+encodeURIComponent(key).replace(/%2F/g,"/"),{method:"DELETE",headers:r2Headers()});return res.ok;}catch{return false;}}
/* VERSION HISTORY — durable dated snapshots in R2 so a bad overwrite or accidental erase is
   recoverable to a point in time. One snapshot per calendar day (first push of the day), plus
   on-demand snapshots (e.g. before an erase). Index in dpdeck/_snapshots.json; kept to SNAP_KEEP. */
const SNAP_INDEX="dpdeck/_snapshots.json", SNAP_KEEP=40;
const snapKey=tag=>"dpdeck/history/deck-"+tag+".json";
async function readSnapshotIndex(){try{const t=await r2ReadRaw(SNAP_INDEX);return t?(JSON.parse(t).snaps||[]):[];}catch{return [];}}
async function pruneAndIndex(idx){idx.sort((a,b)=>(a.ts||0)-(b.ts||0));while(idx.length>SNAP_KEEP){const old=idx.shift();await r2Delete(snapKey(old.tag));}try{await r2Write(SNAP_INDEX,JSON.stringify({snaps:idx}));}catch{}}
async function writeDailySnapshot(serialized,ts){
  if(!R2_KEY)return;
  const day=new Date(ts).toISOString().slice(0,10);
  if((await store.get("pb:snap_day"))===day)return; // this device already wrote today's snapshot
  // Never let a same-day snapshot be replaced by a deck with FEWER scenes: the "one per day" check is
  // per-device, so a stale/partial device must not be able to destroy a good point-in-time snapshot
  // another device wrote earlier today. Belt-and-suspenders for recovery alongside the push-shrink guard.
  try{
    const incCount=(((JSON.parse(serialized).data||{})["pb:project"]||{}).scenes||[]).length;
    const exRaw=await r2ReadRaw(snapKey(day));
    if(exRaw){const exCount=(((JSON.parse(exRaw).data||{})["pb:project"]||{}).scenes||[]).length;
      if(exCount>incCount){await store.set("pb:snap_day",day);return;}}  // keep the bigger existing snapshot
  }catch{}
  await r2Write(snapKey(day),serialized);
  const idx=await readSnapshotIndex();
  if(!idx.some(s=>s.tag===day))idx.push({tag:day,ts,label:day});
  await pruneAndIndex(idx);
  await store.set("pb:snap_day",day);
}
async function writeSnapshotNow(tag,label){
  if(!R2_KEY)return false;
  const b=await exportFullBackup();await r2Write(snapKey(tag),JSON.stringify(b));
  const idx=await readSnapshotIndex();const i=idx.findIndex(s=>s.tag===tag);if(i>=0)idx[i]={tag,ts:b.ts,label:label||tag};else idx.push({tag,ts:b.ts,label:label||tag});
  await pruneAndIndex(idx);return true;
}
async function restoreSnapshot(tag){
  const t=await r2ReadRaw(snapKey(tag));if(!t)throw new Error("Snapshot not found.");
  await importFullBackup(JSON.parse(t));
  await store.set("pb:synced_ts",Date.now());await store.set("pb:project_mtime",Date.now());
  return true;
}
/* ---- REDUNDANCY: silent secondary save layers --------------------------------------------------
   Two automatic fail-safes that run ALONGSIDE the primary IndexedDB store + cloud deck + daily snapshots,
   so prep work (especially irreplaceable gear notes) is never lost to a single point of failure:
   (1) localStorage MIRROR of the project only (no media). Survives an IndexedDB wipe/corruption; adopted on
       load when it is newer than what IndexedDB holds.
   (2) per-device cloud SHADOW (dpdeck/shadow/<device>.json, project only). Each device writes its OWN key,
       never merged or overwritten by another device, so even a bad merge of the shared deck can't erase a
       device's last-known-good prep. Recoverable from Settings. */
const LS_MIRROR="pb:mirror";
function mirrorLocal(project){try{if(typeof localStorage==="undefined"||!project)return;localStorage.setItem(LS_MIRROR,JSON.stringify({project,mtime:Date.now()}));}catch{}}
function readMirror(){try{if(typeof localStorage==="undefined")return null;const t=localStorage.getItem(LS_MIRROR);return t?JSON.parse(t):null;}catch{return null;}}
async function deviceId(){
  let id=null;try{if(typeof localStorage!=="undefined")id=localStorage.getItem("pb:deviceid");}catch{}
  if(!id)id=await store.get("pb:deviceid");
  if(!id){id=uid()+uid();try{if(typeof localStorage!=="undefined")localStorage.setItem("pb:deviceid",id);}catch{}await store.set("pb:deviceid",id);}
  return id;
}
const SHADOW_INDEX="dpdeck/shadow/_index.json";
const shadowKey=id=>"dpdeck/shadow/"+id+".json";
async function writeShadow(project){
  if(!R2_KEY||!project)return;
  const id=await deviceId(),label=((typeof navigator!=="undefined"&&navigator.platform)||"device");
  await r2Write(shadowKey(id),JSON.stringify({device:id,label,ts:Date.now(),project}));   // project only, no media; per-device key = clobber-proof
  try{const t=await r2ReadRaw(SHADOW_INDEX);const idx=t?(JSON.parse(t).devices||[]):[];const i=idx.findIndex(d=>d.id===id);const e={id,label,ts:Date.now()};if(i>=0)idx[i]=e;else idx.push(e);await r2Write(SHADOW_INDEX,JSON.stringify({devices:idx}));}catch{}
}
async function readShadowIndex(){try{const t=await r2ReadRaw(SHADOW_INDEX);return t?(JSON.parse(t).devices||[]):[];}catch{return [];}}
async function readShadow(id){const t=await r2ReadRaw(shadowKey(id));return t?JSON.parse(t):null;}
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
function emptyScene(number,p={}){return {number:number||"",slug:p.slug||"",set:p.set||"",dayNight:p.dayNight||"",syn:p.syn||"",synEdited:false,storyIndex:p.storyIndex??9999,shootDay:"",shootDate:"",shootOrder:0,status:"todo",locationId:"",noAutoLoc:false,notes:"",tod:"",todSun:"",todDeg:"",pageStart:p.pageStart||0,pageEnd:p.pageEnd||0,eighths:p.eighths||0,refs:[],shots:[],gearTags:[],sketches:[],aiGear:[],scriptText:p.scriptText||"",animation:[]};}
/* Scene length in eighths of a page -> the film-standard "N M/8" label (19 -> "2 3/8", 3 -> "3/8"). */
const fmtEighths=e=>{e=+e||0;if(!e)return "";const w=Math.floor(e/8),f=e%8;return w?(f?`${w} ${f}/8`:`${w}`):`${f}/8`;};
const dayEighths=scenes=>scenes.reduce((n,s)=>n+(+s.eighths||0),0);

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
  // first day a scene appears wins its per-scene badge (a scene split across days still lists on each
  // day in the Days view, which reads days[] directly; the badge just shows the primary/first day).
  days.forEach(d=>(d.scenes||[]).forEach((num,i)=>{const k=numKey(num);if(!asn.has(k))asn.set(k,{day:String(d.day||""),order:i+1,date:d.date||""});}));
  return existing.map(s=>{const a=asn.get(numKey(s.number));return a?{...s,shootDay:a.day,shootOrder:a.order,shootDate:a.date||s.shootDate||""}:{...s,shootDay:"",shootOrder:0,shootDate:""};});  // unscheduled -> clear shootDate too, so sun/weather/time-of-day never compute off a stale day
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
  const out=(existing||[]).map(x=>({...x}));
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
  if(!locations?.length||!parsed.length)return scenes;
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
    if(s.locationId||s.status==="omitted"||s.noAutoLoc)return s;  // noAutoLoc: an intentional blank (link this scene by hand) is never auto-filled with a generic set-derived location
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
  const crew={},maps={};
  for(const dd of DEPTS){crew[dd.k]=[...(existing[dd.k]||[])];maps[dd.k]=new Map();crew[dd.k].forEach((m,i)=>maps[dd.k].set((m.name||"").trim().toLowerCase(),i));}
  let added=0,updated=0;
  for(const inc of incoming){
    const nm=(inc.name||"").trim();if(!nm)continue;
    let d=(inc.dept||"").trim().toLowerCase();
    if(!DEPTS.some(x=>x.k===d)){const r=(inc.role||"").toLowerCase();d=/grip|dolly/.test(r)?"grip":/electric|gaffer|spark|lamp|board op/.test(r)?"electric":/\b(sfx|fx|special effect|pyro|atmos|smoke|rain|wind|squib)\b/.test(r)?"sfx":"camera";}
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
    const k=numKey(number);const slug=isc.slug||"",set=isc.set||"",dn=isc.dn||isc.dayNight||"",syn=isc.syn||"",pageStart=+(isc.pageStart||isc.pg||0)||0,eighths=+(isc.eighths||0)||0;
    let i=byNum.get(k);
    if(i==null){scenes.push(emptyScene(number,{slug,set,dayNight:dn,syn,storyIndex:isc.storyIndex??idx,pageStart,eighths,scriptText:isc.scriptText}));i=scenes.length-1;byNum.set(k,i);}
    else{const o=scenes[i];scenes[i]={...o,slug:slug||o.slug,set:set||o.set,dayNight:dn||o.dayNight,storyIndex:isc.storyIndex??o.storyIndex,pageStart:pageStart||o.pageStart,eighths:eighths||o.eighths,syn:o.synEdited?o.syn:(syn||o.syn),scriptText:isc.scriptText||o.scriptText,status:o.status==="omitted"?"todo":o.status};}
    const s=scenes[i];
    if(Array.isArray(isc.shots)&&isc.shots.length){const have=new Set(s.shots.map(x=>x.text));for(const t of isc.shots){if(t&&!have.has(t)){s.shots.push({id:uid(),text:String(t),done:false});have.add(t);}}}
    if(isc.notes&&!(s.notes||"").includes(isc.notes))s.notes=s.notes?(s.notes+"\n"+isc.notes):isc.notes;
    if(Array.isArray(isc.gear))for(const g of isc.gear){if(!g||!g.name)continue;const dept=DEPTS.some(d=>d.k===g.dept)?g.dept:"camera";const id=ensureGear(g.name,dept);if(!s.gearTags.includes(id))s.gearTags.push(id);}
    if(Array.isArray(isc.refs)&&isc.refs.length){const have=new Set(s.refs);for(const r of isc.refs){if(r&&!have.has(r)){s.refs.push(r);have.add(r);}}}
  });
  let out={...p,meta:{...p.meta,...(inc.meta||{})},scenes,gear};
  if(Array.isArray(inc.days)&&inc.days.length){out.scenes=applySchedule(out.scenes,inc.days);out.days=inc.days;}  // persist the schedule (the Calendar reads project.days directly, so split scenes show on every day)
  if(Array.isArray(inc.locations)&&inc.locations.length)out.locations=applyLocations(out.locations,inc.locations).merged;
  if(Array.isArray(inc.scenes))out.scenes=linkLocations(out.scenes,inc.scenes,out.locations);
  if(Array.isArray(inc.crew)&&inc.crew.length)out.crew=applyCrew(out.crew,inc.crew).merged;
  if(Array.isArray(inc.contacts)&&inc.contacts.length)out.contacts=applyContacts(out.contacts,inc.contacts).merged;
  if(Array.isArray(inc.look)&&inc.look.length)out.look=uniq([...(out.look||[]),...inc.look]);
  const d=deriveLocations(out.scenes,out.locations||[]);out.scenes=d.scenes;out.locations=d.locations;
  return out;
}

/* ---- document store: ground-truth PDFs (script + schedule) ------- */
/* Both ride the deck (pb:doc:{slot} base64) so they sync across devices and never need a
   per-device import. The script slot also drives per-scene page rendering (scriptDoc alias). */
const docs={script:{doc:null,name:"",pageCache:new Map()},schedule:{doc:null,name:"",pageCache:new Map()},animation:{doc:null,name:"",pageCache:new Map()}};
const scriptDoc=docs.script;
const DOC_LABEL={script:"Script",schedule:"Schedule",animation:"Animation breakdown"};
// page in the breakdown PDF that each animation scene sits on (best-effort jump; PdfViewer clamps to the doc's real page count, so a replaced PDF safely falls back to a valid page)
const ANIM_PDF_PAGE={"2":1,"3":1,"3A":1,"15":1,"16":1,"17":1,"32A":1,"35":1,"36":2,"37":2,"43":2,"44":2,"45":2,"58":2,"59":2,"74":2,"75":2,"77":2,"79":2,"80":2,"113":2,"114":2,"115":3,"135":3};
function abToB64(ab){const b=new Uint8Array(ab);let bin="";const CH=0x8000;for(let i=0;i<b.length;i+=CH)bin+=String.fromCharCode.apply(null,b.subarray(i,i+CH));return btoa(bin);}
function b64ToU8(b64){if(typeof b64==="string"&&b64.startsWith("data:")){const c=b64.indexOf(",");if(c>=0)b64=b64.slice(c+1);}const bin=atob(b64);const u=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)u[i]=bin.charCodeAt(i);return u;}// tolerate a stray data:...;base64, prefix (a server-side doc embed) so pb:doc:* always decodes
async function saveDoc(slot,ab,name){
  // Persist bytes first so the document survives + syncs even if pdf.js parsing hiccups.
  try{await store.set("pb:doc:"+slot,abToB64(ab));await store.set("pb:doc:"+slot+"name",name||"");}catch{}
  docs[slot].name=name||DOC_LABEL[slot];
  try{docs[slot].doc=await pdfFromArrayBuffer(ab);docs[slot].pageCache.clear();}catch{}
}
const _docLoading={};                                          // in-flight ensureDoc(slot) promises -> concurrent callers (PdfViewer + Documents mount) share ONE fetch/parse, never double-download the R2 PDF
async function ensureDoc(slot){
  if(docs[slot].doc)return docs[slot].doc;
  if(_docLoading[slot])return _docLoading[slot];
  _docLoading[slot]=(async()=>{
  try{
    let b64=await store.get("pb:doc:"+slot);
    if(!b64&&slot==="script")b64=await store.get("pb:scriptpdf"); // legacy
    if(!b64)return null;
    let buf,pendingCache=null;
    if(typeof b64==="string"&&b64.startsWith("r2:")){           // doc bytes live on R2 (kept OUT of the synced deck — only this ~50-byte marker rides it); fetch once, then cache the bytes LOCALLY (pb:doccache:* is per-device, never synced) so it works offline + never re-downloads
      const ref=b64,cached=await store.get("pb:doccache:"+slot);
      if(cached&&cached.ref===ref&&cached.b64)buf=b64ToU8(cached.b64).buffer;
      else{
        const res=await fetch(R2_BASE+"/read/"+encodeURIComponent(ref.slice(3)).replace(/%2F/g,"/"),{headers:r2Headers()});
        if(!res.ok)return null;
        buf=await res.arrayBuffer();
        pendingCache={ref,b64:abToB64(buf)};                    // snapshot BEFORE pdf.js can detach buf; persisted only after a successful parse below
      }
    }else buf=b64ToU8(b64).buffer;
    docs[slot].doc=await pdfFromArrayBuffer(buf);
    if(pendingCache)try{await store.set("pb:doccache:"+slot,pendingCache);}catch{}
    docs[slot].name=(await store.get("pb:doc:"+slot+"name"))||(slot==="script"?(await store.get("pb:scriptpdfname")):"")||DOC_LABEL[slot];
    return docs[slot].doc;
  }catch{return null;}
  finally{delete _docLoading[slot];}
  })();
  return _docLoading[slot];
}
const setScriptPDF=(ab,name)=>saveDoc("script",ab,name);
const restoreScriptPDF=()=>ensureDoc("script").then(d=>!!d);
async function getDocPageImage(slot,n,hi){
  const d=docs[slot];if(!d.doc||n<1||n>d.doc.numPages)return null;
  const key=hi?n+":h":n;
  if(d.pageCache.has(key))return d.pageCache.get(key);
  let scale=1.7,q=0.85;
  if(hi){scale=4;q=0.9;try{const vp=(await d.doc.getPage(n)).getViewport({scale:1});scale=Math.min(5,Math.sqrt(15000000/Math.max(vp.width*vp.height,1)));}catch{}} // zoomed = render at high DPI so dense text stays crisp; area-cap keeps the canvas under mobile limits (~15M px). The viewer then displays it at width=px/dpr for a 1:1 (crisp) mapping.
  const r=await pdfRenderPage(d.doc,n,scale,q);
  if(d.pageCache.size>=16){const oldest=d.pageCache.keys().next().value;d.pageCache.delete(oldest);} // bound rendered-page cache (hi-res pages are larger)
  d.pageCache.set(key,r);return r;
}
async function getScriptPageImage(n){return getDocPageImage("script",n);}
/* Robust scene -> PDF page map: scan the ACTUAL script PDF text for each scene's heading
   ("<number> INT/EXT ...") and record the physical page it appears on. No page-offset math,
   no reliance on parsed pageStart — the scene is located in the PDF itself. Built once, cached. */
let _spi=null,_spiDoc=null,_spiBuilding=null;
async function scriptPageIndex(validNums){
  const doc=docs.script.doc; if(!doc)return null;
  if(_spi&&_spiDoc===doc)return _spi;
  if(_spiBuilding)return _spiBuilding;
  _spiBuilding=(async()=>{
    const map=new Map();
    const valid=validNums&&validNums.length?new Set(validNums.map(x=>String(x).toUpperCase())):null;
    for(let n=1;n<=doc.numPages;n++){
      let txt=""; try{txt=await pdfPageText(doc,n);}catch{}
      for(const ln of txt.split("\n")){
        // a heading line starts with the scene number and contains INT/EXT somewhere
        // (covers both "16 INT. ..." and "16 ELISHA'S NOTEBOOK - INT. ..." style headings)
        const m=ln.match(/^\s*(\d{1,3}[A-Za-z]?)\b/);
        if(!m||!/\b(?:INT|EXT|I\/E)\b/i.test(ln))continue;
        const num=m[1].toUpperCase();
        if(valid&&!valid.has(num))continue;
        if(!map.has(num))map.set(num,n);
      }
    }
    _spi=map;_spiDoc=doc;_spiBuilding=null;return map;
  })();
  return _spiBuilding;
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
function InkCanvas({initial,bgUrl,onClose,onSave,title,draftKey}){
  const wrap=useRef(null),cvRef=useRef(null),bgRef=useRef(null);
  const [strokes,setStrokes]=useState(initial?.strokes||[]);
  const [color,setColor]=useState(INK_COLORS[0]),[w,setW]=useState(3),[tool,setTool]=useState("pen");
  const [view,setView]=useState({s:1,tx:0,ty:0});
  const draw=useRef(null),drag=useRef(null),aspect=useRef(initial?.aspect||4/3);
  const dkey=draftKey?("pb:inkdraft:"+draftKey):null,dsave=useRef(null);
  // Recover strokes from a prior crash/close, but ONLY when the draft has MORE strokes than what we opened
  // with (restores added work, never resurrects an erase or overrides a version already saved with Done).
  useEffect(()=>{if(!dkey)return;let on=true;store.get(dkey).then(d=>{if(on&&d&&Array.isArray(d.strokes)&&d.strokes.length>(initial?.strokes?.length||0)){if(d.aspect)aspect.current=d.aspect;setStrokes(d.strokes);}});return()=>{on=false;};},[dkey]);
  // Continuously autosave in-progress strokes to a scratch draft so nothing is lost if the editor is closed or
  // the app is evicted before Done. Debounced while drawing; flushed immediately when the tab hides.
  useEffect(()=>{if(!dkey)return;clearTimeout(dsave.current);dsave.current=setTimeout(()=>{store.set(dkey,{strokes,aspect:aspect.current,_mt:Date.now()}).catch(()=>{});},500);return()=>clearTimeout(dsave.current);},[strokes,dkey]);
  useEffect(()=>{if(!dkey)return;const flush=()=>{if(document.visibilityState==="hidden"){clearTimeout(dsave.current);try{store.set(dkey,{strokes,aspect:aspect.current,_mt:Date.now()});}catch{}}};document.addEventListener("visibilitychange",flush);window.addEventListener("pagehide",flush);return()=>{document.removeEventListener("visibilitychange",flush);window.removeEventListener("pagehide",flush);};},[strokes,dkey]);
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
  const save=()=>{onSave({strokes,aspect:aspect.current,bgUrl:bgUrl||initial?.bgUrl||null});if(dkey)store.del(dkey).catch(()=>{});onClose();};
  return <div style={{position:"fixed",inset:0,background:c.bg0,zIndex:90,display:"flex",flexDirection:"column"}}>
    <div style={{display:"flex",alignItems:"center",gap:10,paddingTop:"max(env(safe-area-inset-top), 10px)",paddingBottom:10,paddingLeft:"max(env(safe-area-inset-left), 12px)",paddingRight:"max(env(safe-area-inset-right), 12px)",borderBottom:`1px solid ${c.line}`,background:c.bg1}}>
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
    <div style={{display:"flex",alignItems:"center",gap:10,paddingTop:10,paddingBottom:"max(env(safe-area-inset-bottom), 10px)",paddingLeft:"max(env(safe-area-inset-left), 12px)",paddingRight:"max(env(safe-area-inset-right), 12px)",borderTop:`1px solid ${c.line}`,background:c.bg1,flexWrap:"wrap"}}>
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

/* DIRECTOR'S VIEWFINDER: live framing for 4-perf 35mm open gate.
   The phone feed is the open-gate (1.33) "sensor"; aspect-ratio guides (1.66/1.78/1.85/2.0/2.39)
   OVERLAY the full open-gate frame as bright framelines + dimmed mattes and never hard-crop it.
   Focal length steps from the active phone lens's widest up to 300mm via DIGITAL zoom (iOS Safari
   has no hardware zoom and no ImageCapture). Snap saves the full open-gate still, guides burned in,
   to wherever the viewfinder was opened. The 0.5x ultra-wide on this gate is ~9mm (its 13mm spec is
   a full-frame STILLS equivalent: 13 * 24.89/36 = ~9mm), the main lens ~17mm, so the wide end depends
   on which phone lens is active. Calibration is a manual nudge because iOS exposes no true FOV. */
const VF_GATE_W=24.89, VF_GATE_H=18.66, VF_AR=VF_GATE_W/VF_GATE_H; // 4-perf 35mm full/open aperture (1.333)
const VF_FOCALS=[9,10,12,14,16,18,21,25,27,32,35,40,50,65,75,85,100,135,150,180,200,250,300];
const VF_RATIOS=[{k:"1.33",label:"Open Gate",r:VF_AR},{k:"1.66",label:"1.66",r:5/3},{k:"1.78",label:"16:9",r:16/9},{k:"1.85",label:"1.85",r:1.85},{k:"2.00",label:"2.0",r:2},{k:"2.39",label:"2.39",r:2.39}];
const VF_CAM_HFOV={ultra:108.3,wide:73.7,tele:26.3};                 // approx native horizontal FOV per phone lens
const vfHfov=f=>2*Math.atan(VF_GATE_W/(2*f))*180/Math.PI;
const vfFocalForHfov=d=>VF_GATE_W/(2*Math.tan(d*Math.PI/360));
const vfGuessLens=l=>{const s=(l||"").toLowerCase();if(/ultra|0\.5|0,5/.test(s))return"ultra";if(/tele|telephoto|3x|5x|2x/.test(s))return"tele";return"wide";};
const vfLensLabel={ultra:"0.5×",wide:"1×",tele:"tele"};
function vfRatioBox(W,H,r){const fr=W/H;if(r>=fr){const h=W/r;return{x:0,y:(H-h)/2,w:W,h};}const w=H*r;return{x:(W-w)/2,y:0,w,h:H};}
function vfTopBtn(on){return{background:on?"#ffffff22":"transparent",border:"none",color:on?"#ffd24d":"#fff",cursor:"pointer",display:"grid",placeItems:"center",width:34,height:34,borderRadius:8};}
function vfChip(on){return{flexShrink:0,padding:"6px 11px",borderRadius:16,border:`1px solid ${on?"#ffd24d":"#333"}`,background:on?"#ffd24d":"#161616",color:on?"#000":"#bbb",fontFamily:UI,fontSize:12.5,fontWeight:700,cursor:"pointer",whiteSpace:"nowrap"};}
function vfRound(){return{flexShrink:0,width:38,height:38,borderRadius:"50%",border:"1px solid #333",background:"#161616",color:"#fff",cursor:"pointer",display:"grid",placeItems:"center"};}
function Viewfinder({title,onCapture,onClose}){
  const videoRef=useRef(null),areaRef=useRef(null),streamRef=useRef(null),fileRef=useRef(null);
  const [started,setStarted]=useState(false),[err,setErr]=useState(""),[busy,setBusy]=useState(false);
  const [cams,setCams]=useState([]),[lens,setLens]=useState("wide"),[calib,setCalib]=useState(0),[showCal,setShowCal]=useState(false);
  const [focal,setFocal]=useState(35),[ratio,setRatio]=useState("1.85"),[grid,setGrid]=useState(false),[burn,setBurn]=useState(true);
  const [gate,setGate]=useState({w:0,h:0}),[saved,setSaved]=useState(0),[flash,setFlash]=useState(false),[switchErr,setSwitchErr]=useState("");
  const nativeHFOV=Math.max(20,(VF_CAM_HFOV[lens]||73.7)+calib);
  const fNative=vfFocalForHfov(nativeHFOV);
  // widest selectable = the lens's true native focal (rounded), then standard primes strictly wider than native.
  // This keeps the widest step honestly labeled (you can't digitally zoom wider than the lens).
  const fWide=Math.round(fNative);
  const focals=[fWide,...VF_FOCALS.filter(f=>f>fNative+0.5)];
  const zoom=Math.max(1,focal/fNative);
  const ratioObj=VF_RATIOS.find(x=>x.k===ratio)||VF_RATIOS[3];

  const stopStream=useCallback(()=>{const s=streamRef.current;if(s)s.getTracks().forEach(t=>{try{t.stop();}catch{}});streamRef.current=null;const v=videoRef.current;if(v)v.srcObject=null;},[]);
  const attach=useCallback(s=>{const old=streamRef.current;if(old&&old!==s)old.getTracks().forEach(t=>{try{t.stop();}catch{}});streamRef.current=s;const v=videoRef.current;if(v){v.srcObject=s;v.play().catch(()=>{});}},[]);
  const start=useCallback(async(deviceId)=>{
    setErr("");
    try{
      if(!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia)throw new Error("nogum");
      const video=deviceId?{deviceId:{exact:deviceId},width:{ideal:1920},height:{ideal:1440}}:{facingMode:{ideal:"environment"},width:{ideal:1920},height:{ideal:1440}};
      const s=await navigator.mediaDevices.getUserMedia({video,audio:false});
      attach(s);
      try{const devs=await navigator.mediaDevices.enumerateDevices();const vids=devs.filter(d=>d.kind==="videoinput");const rear=vids.filter(d=>!/front|face/i.test(d.label));setCams((rear.length?rear:vids).map(d=>({id:d.deviceId,label:d.label,lens:vfGuessLens(d.label)})));}catch{}
      const tr=s.getVideoTracks()[0];setLens(vfGuessLens(tr&&tr.label));
      setStarted(true);
    }catch(e){stopStream();setStarted(false);setErr(e&&e.name==="NotAllowedError"?"denied":(e&&e.message==="nogum"?"nogum":"fail"));}
  },[attach,stopStream]);
  // Switch phone lens WITHOUT tearing down the working stream first: acquire the new lens, swap only on
  // success (attach stops the old), and if iOS rejects the exact-deviceId request keep the live feed + warn.
  const switchTo=useCallback(async cm=>{
    try{
      const s=await navigator.mediaDevices.getUserMedia({video:{deviceId:{exact:cm.id},width:{ideal:1920},height:{ideal:1440}},audio:false});
      attach(s);setLens(cm.lens);setSwitchErr("");
    }catch(e){setSwitchErr("Couldn't switch to that lens on this device.");setTimeout(()=>setSwitchErr(""),2600);}
  },[attach]);

  useEffect(()=>()=>stopStream(),[stopStream]);
  // iOS freezes/mutes a live track when the app is backgrounded; stop it and require a re-tap on return.
  useEffect(()=>{const onVis=()=>{if(document.visibilityState==="hidden"){stopStream();setStarted(false);}};document.addEventListener("visibilitychange",onVis);return()=>document.removeEventListener("visibilitychange",onVis);},[stopStream]);
  // keep the focal within the active lens's achievable range (can't go wider than the phone lens)
  useEffect(()=>{if(focal<fNative-0.6&&focals.length)setFocal(focals[0]);},[lens,calib]);// eslint-disable-line
  // measure the open-gate box to fit the available area
  useEffect(()=>{const fit=()=>{const el=areaRef.current;if(!el)return;const W=el.clientWidth-8,H=el.clientHeight-8;if(W<=0||H<=0)return;const w=Math.min(W,H*VF_AR);setGate({w:Math.round(w),h:Math.round(w/VF_AR)});};fit();addEventListener("resize",fit);addEventListener("orientationchange",fit);const t=setTimeout(fit,350);return()=>{removeEventListener("resize",fit);removeEventListener("orientationchange",fit);clearTimeout(t);};},[started]);

  const stepFocal=d=>{const i=focals.indexOf(focal);const ni=clamp((i<0?0:i)+d,0,focals.length-1);setFocal(focals[ni]);};
  const drawGuides=(ctx,W,H)=>{
    const b=vfRatioBox(W,H,ratioObj.r);
    if(ratioObj.k!=="1.33"){ctx.fillStyle="rgba(0,0,0,0.5)";ctx.fillRect(0,0,W,b.y);ctx.fillRect(0,b.y+b.h,W,H-(b.y+b.h));}
    ctx.strokeStyle="rgba(255,255,255,0.92)";ctx.lineWidth=Math.max(1.5,W/640);ctx.strokeRect(b.x+1,b.y+1,b.w-2,b.h-2);
    const fs=Math.max(12,Math.round(W/42));ctx.fillStyle="rgba(255,210,77,0.96)";ctx.font=`700 ${fs}px ui-monospace,monospace`;ctx.textBaseline="bottom";
    ctx.fillText(`${focal}mm  ${ratioObj.k}  ${vfHfov(focal).toFixed(0)}°`,Math.round(W*0.03),H-Math.round(W*0.03));
  };
  const capture=async()=>{
    const v=videoRef.current;if(!v||!v.videoWidth){setErr("fail");return;}
    setBusy(true);
    try{
      const vw=v.videoWidth,vh=v.videoHeight;
      let cw,ch;if(vw/vh>VF_AR){ch=vh;cw=vh*VF_AR;}else{cw=vw;ch=vw/VF_AR;}   // center-crop the source to open-gate aspect
      cw/=zoom;ch/=zoom;const sx=(vw-cw)/2,sy=(vh-ch)/2;                       // then crop further for the digital zoom
      const outW=Math.min(1920,Math.round(cw)),outH=Math.round(outW/VF_AR);
      const cv=document.createElement("canvas");cv.width=outW;cv.height=outH;
      const ctx=cv.getContext("2d");ctx.drawImage(v,sx,sy,cw,ch,0,0,outW,outH);
      if(burn)drawGuides(ctx,outW,outH);
      const url=cv.toDataURL("image/jpeg",0.85);
      await onCapture(url);
      setSaved(n=>n+1);setFlash(true);setTimeout(()=>setFlash(false),170);
    }catch(e){setErr("fail");}
    setBusy(false);
  };
  const onFile=async f=>{if(!f)return;setBusy(true);try{const url=await downscale(f,1920,0.85);await onCapture(url);setSaved(n=>n+1);}catch{}setBusy(false);};

  const ob=vfRatioBox(gate.w||1,gate.h||1,ratioObj.r);
  return <div style={{position:"fixed",inset:0,background:"#000",zIndex:98,display:"flex",flexDirection:"column"}}>
    <div style={{display:"flex",alignItems:"center",gap:8,paddingTop:"max(env(safe-area-inset-top), 10px)",paddingBottom:10,paddingLeft:"max(env(safe-area-inset-left), 12px)",paddingRight:"max(env(safe-area-inset-right), 12px)",background:"#000",flexShrink:0}}>
      <button onClick={()=>{stopStream();onClose();}} title="Close" style={vfTopBtn(false)}><X size={19}/></button>
      <div style={{flex:1,minWidth:0,fontFamily:UI,fontWeight:700,fontSize:14,color:"#fff",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{title||"Viewfinder"}</div>
      {started&&<button onClick={()=>setBurn(b=>!b)} title="Burn guides into the saved photo" style={vfTopBtn(burn)}><Aperture size={17}/></button>}
      {started&&<button onClick={()=>setGrid(g=>!g)} title="Thirds grid" style={vfTopBtn(grid)}><Grid3x3 size={17}/></button>}
      {started&&<button onClick={()=>setShowCal(s=>!s)} title="Calibrate field of view" style={vfTopBtn(showCal)}><Settings size={17}/></button>}
    </div>
    <div ref={areaRef} style={{flex:1,position:"relative",display:"flex",alignItems:"center",justifyContent:"center",overflow:"hidden"}}>
      <div style={{position:"relative",width:gate.w||1,height:gate.h||1,overflow:"hidden",background:"#000",visibility:started&&gate.w>0?"visible":"hidden"}}>
        <video ref={videoRef} playsInline autoPlay muted style={{position:"absolute",left:"50%",top:"50%",width:"100%",height:"100%",objectFit:"cover",transform:`translate(-50%,-50%) scale(${zoom})`,transformOrigin:"center center"}}/>
        {started&&gate.w>0&&<svg width={gate.w} height={gate.h} style={{position:"absolute",inset:0,pointerEvents:"none"}}>
          <rect x="1" y="1" width={gate.w-2} height={gate.h-2} fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="1"/>
          {ratioObj.k!=="1.33"&&<>
            <rect x="0" y="0" width={gate.w} height={ob.y} fill="rgba(0,0,0,0.5)"/>
            <rect x="0" y={ob.y+ob.h} width={gate.w} height={gate.h-(ob.y+ob.h)} fill="rgba(0,0,0,0.5)"/>
          </>}
          <rect x={ob.x+0.75} y={ob.y+0.75} width={Math.max(0,ob.w-1.5)} height={Math.max(0,ob.h-1.5)} fill="none" stroke="rgba(255,255,255,0.92)" strokeWidth="1.5"/>
          <line x1={gate.w/2-9} y1={gate.h/2} x2={gate.w/2+9} y2={gate.h/2} stroke="rgba(255,255,255,0.7)" strokeWidth="1"/>
          <line x1={gate.w/2} y1={gate.h/2-9} x2={gate.w/2} y2={gate.h/2+9} stroke="rgba(255,255,255,0.7)" strokeWidth="1"/>
          {grid&&<g stroke="rgba(255,255,255,0.28)" strokeWidth="1">
            <line x1={ob.x+ob.w/3} y1={ob.y} x2={ob.x+ob.w/3} y2={ob.y+ob.h}/>
            <line x1={ob.x+2*ob.w/3} y1={ob.y} x2={ob.x+2*ob.w/3} y2={ob.y+ob.h}/>
            <line x1={ob.x} y1={ob.y+ob.h/3} x2={ob.x+ob.w} y2={ob.y+ob.h/3}/>
            <line x1={ob.x} y1={ob.y+2*ob.h/3} x2={ob.x+ob.w} y2={ob.y+2*ob.h/3}/>
          </g>}
        </svg>}
        {started&&gate.w>0&&<div style={{position:"absolute",left:8,bottom:6,fontFamily:MONO,fontSize:11,fontWeight:700,color:"#ffd24d",textShadow:"0 1px 3px #000",pointerEvents:"none"}}>{focal}mm · {ratioObj.k} · {vfHfov(focal).toFixed(0)}°</div>}
      </div>
      {flash&&<div style={{position:"absolute",inset:0,background:"#fff",opacity:0.5,pointerEvents:"none"}}/>}
      {started&&switchErr&&<div style={{position:"absolute",top:10,left:"50%",transform:"translateX(-50%)",background:"#000c",color:"#fff",fontFamily:UI,fontSize:12.5,padding:"7px 12px",borderRadius:8,maxWidth:"90%",textAlign:"center",pointerEvents:"none"}}>{switchErr}</div>}
      {!started&&<div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:15,padding:24,textAlign:"center"}}>
        {err==="denied"?<div style={{color:"#fff",fontFamily:UI,fontSize:14,maxWidth:300,lineHeight:1.55}}>Camera access was denied. Allow the camera for this app in iOS Settings, or upload a photo instead.</div>:
         err==="nogum"?<div style={{color:"#fff",fontFamily:UI,fontSize:14,maxWidth:300,lineHeight:1.55}}>This browser can't open a live camera here. Use the native camera or upload instead.</div>:
         err==="fail"?<div style={{color:"#fff",fontFamily:UI,fontSize:14,maxWidth:300,lineHeight:1.55}}>Couldn't start the camera. Try again, or upload a photo.</div>:
         <div style={{color:"#9aa",fontFamily:UI,fontSize:13,maxWidth:330,lineHeight:1.55}}>Director's viewfinder for 4-perf 35mm open gate. Pick a lens and aspect ratio, frame, and shoot. Photos save to {title||"this area"}.</div>}
        <Btn kind="primary" size={14} onClick={()=>start()}><Camera size={17}/>Start camera</Btn>
        <button onClick={()=>fileRef.current&&fileRef.current.click()} style={{background:"none",border:"none",color:"#8ab4d8",fontFamily:UI,fontSize:13,cursor:"pointer"}}>Use the native camera / upload instead</button>
      </div>}
      <input ref={fileRef} type="file" accept="image/*" capture="environment" style={{display:"none"}} onChange={e=>{const f=e.target.files[0];e.target.value="";onFile(f);}}/>
    </div>
    {showCal&&started&&<div style={{background:"#111",borderTop:"1px solid #222",padding:"10px 14px",flexShrink:0}}>
      <div style={{fontFamily:UI,fontSize:11.5,color:"#aaa",marginBottom:7,lineHeight:1.4}}>Calibrate if the framing looks off. Active lens reads as ~{Math.round(fNative)}mm at its widest ({nativeHFOV.toFixed(0)}° across). The 0.5× ultra-wide is about 9mm on this gate, the 1× about 17mm.</div>
      <div style={{display:"flex",alignItems:"center",gap:10}}>
        <span style={{fontFamily:MONO,fontSize:11,color:"#888"}}>wider</span>
        <input type="range" min="-25" max="25" step="1" value={calib} onChange={e=>setCalib(+e.target.value)} style={{flex:1}}/>
        <span style={{fontFamily:MONO,fontSize:11,color:"#888"}}>tighter</span>
        <button onClick={()=>setCalib(0)} style={{background:"#222",border:"1px solid #333",color:"#ccc",borderRadius:6,padding:"5px 10px",fontFamily:UI,fontSize:12,cursor:"pointer"}}>Reset</button>
      </div>
    </div>}
    {started&&<div style={{background:"#000",flexShrink:0,paddingTop:8,paddingBottom:"max(env(safe-area-inset-bottom), 12px)",paddingLeft:"max(env(safe-area-inset-left), 10px)",paddingRight:"max(env(safe-area-inset-right), 10px)"}}>
      {cams.length>1&&<div style={{display:"flex",gap:6,justifyContent:"center",marginBottom:8}}>{cams.map(cm=><button key={cm.id} onClick={()=>switchTo(cm)} style={vfChip(lens===cm.lens)}>{vfLensLabel[cm.lens]||"cam"}</button>)}</div>}
      <div style={{display:"flex",gap:6,justifyContent:"flex-start",overflowX:"auto",marginBottom:8,paddingBottom:2}}>{VF_RATIOS.map(rt=><button key={rt.k} onClick={()=>setRatio(rt.k)} style={vfChip(ratio===rt.k)}>{rt.k==="1.33"?"Open Gate":rt.k}</button>)}</div>
      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
        <button onClick={()=>stepFocal(-1)} style={vfRound()} title="Wider"><Minus size={18}/></button>
        <div style={{flex:1,display:"flex",gap:5,overflowX:"auto",padding:"2px",alignItems:"center"}}>
          {focals.map(f=><button key={f} onClick={()=>setFocal(f)} style={{flexShrink:0,minWidth:42,padding:"7px 8px",borderRadius:8,border:`1px solid ${focal===f?"#ffd24d":"#333"}`,background:focal===f?"#ffd24d":"#161616",color:focal===f?"#000":"#ccc",fontFamily:MONO,fontSize:13,fontWeight:700,cursor:"pointer"}}>{f}</button>)}
        </div>
        <button onClick={()=>stepFocal(1)} style={vfRound()} title="Tighter"><Plus size={18}/></button>
      </div>
      <div style={{display:"flex",alignItems:"center",justifyContent:"center",position:"relative",height:64}}>
        <div style={{position:"absolute",left:8,fontFamily:MONO,fontSize:13,color:"#bbb"}}>{focal}mm<span style={{color:"#666"}}> · {vfHfov(focal).toFixed(0)}°</span></div>
        <button onClick={capture} disabled={busy} title="Shoot" style={{width:62,height:62,borderRadius:"50%",border:"4px solid #fff",background:"transparent",cursor:busy?"default":"pointer",display:"grid",placeItems:"center",opacity:busy?0.5:1}}><div style={{width:48,height:48,borderRadius:"50%",background:"#fff"}}/></button>
        <div style={{position:"absolute",right:8,fontFamily:UI,fontSize:12,color:"#888"}}>{saved>0?`${saved} saved`:""}</div>
      </div>
    </div>}
  </div>;
}

/* SUN + WEATHER instruments */
function SunBar({lat,lng,tz,date,hm}){
  const data=useMemo(()=>{if(!date)return null;try{const t=sunTimes(dayNoonUTC(date),+lat,+lng);t._hi=sunAboveWindow(dayNoonUTC(date),+lat,+lng,40);return t;}catch{return null;}},[lat,lng,date]);
  if(!data)return null;
  const p={dawn:tMinAbs(data.dawn,date,tz),sr:tMinAbs(data.sunrise,date,tz),ge:tMinAbs(data.goldEnd,date,tz),gs:tMinAbs(data.goldStart,date,tz),ss:tMinAbs(data.sunset,date,tz),dusk:tMinAbs(data.dusk,date,tz)};
  if(p.sr==null||p.ss==null)return null;
  const cl=x=>clamp(x==null?0:x,0,1440),pct=v=>v/1440*100;
  const NI="#0c0e13",TW=c.night,DA="#37597a",GO=c.accent;
  const segs=[[0,cl(p.dawn??p.sr),NI],[cl(p.dawn??p.sr),cl(p.sr),TW],[cl(p.sr),cl(p.ge??p.sr),GO],[cl(p.ge??p.sr),cl(p.gs??p.ss),DA],[cl(p.gs??p.ss),cl(p.ss),GO],[cl(p.ss),cl(p.dusk??p.ss),TW],[cl(p.dusk??p.ss),1440,NI]];
  const hi=data._hi, hs=hi?tMinAbs(hi.start,date,tz):null, he=hi?tMinAbs(hi.end,date,tz):null;
  return <div>
    <div style={{position:"relative",height:22,borderRadius:6,overflow:"hidden",border:`1px solid ${c.line}`}}>
      {segs.map(([a,b,col],i)=><div key={i} style={{position:"absolute",left:pct(a)+"%",width:pct(Math.max(0,b-a))+"%",top:0,bottom:0,background:col}}/>)}
      {hs!=null&&he!=null&&<div title="Harsh high sun, above 40 degrees, avoid" style={{position:"absolute",left:pct(cl(hs))+"%",width:pct(Math.max(0,he-hs))+"%",top:0,bottom:0,background:"repeating-linear-gradient(45deg,transparent,transparent 4px,#ff5a5a66 4px,#ff5a5a66 8px)",borderLeft:"1.5px solid #ff5a5a",borderRight:"1.5px solid #ff5a5a",pointerEvents:"none"}}/>}
      {hm!=null&&<div style={{position:"absolute",left:`calc(${pct(cl(hm))}% - 1px)`,top:-2,bottom:-2,width:2,background:"#fff",boxShadow:"0 0 5px #000"}}/>}
    </div>
    <div style={{position:"relative",height:12,marginTop:3}}>
      <span style={{position:"absolute",left:pct(cl(p.sr))+"%",transform:"translateX(-50%)",fontFamily:MONO,fontSize:9.5,color:c.t2}}>{fmtT(data.sunrise,tz)}</span>
      <span style={{position:"absolute",left:pct(cl(p.ss))+"%",transform:"translateX(-50%)",fontFamily:MONO,fontSize:9.5,color:c.t2}}>{fmtT(data.sunset,tz)}</span>
    </div>
    {hs!=null&&he!=null&&<div style={{display:"flex",alignItems:"center",gap:6,marginTop:2,fontFamily:UI,fontSize:10.5,color:"#ff8a8a",lineHeight:1.3}}><span style={{width:10,height:10,borderRadius:2,flexShrink:0,background:"repeating-linear-gradient(45deg,transparent,transparent 2px,#ff5a5a 2px,#ff5a5a 4px)",border:"1px solid #ff5a5a"}}/>Harsh midday sun (above 40°): {fmtT(hi.start,tz)} to {fmtT(hi.end,tz)}. Avoid shooting.</div>}
  </div>;
}
function SunCompass({lat,lng,tz,date,hm}){
  const cardOf=deg=>CARD[Math.round((((deg%360)+360)%360)/22.5)%16];
  // overhead sun-path plot: center = zenith (90deg up), rim = horizon (0deg); angle = compass azimuth.
  const calc=useMemo(()=>{try{
    const t=sunTimes(dayNoonUTC(date),+lat,+lng);
    const az=d=>d&&!isNaN(d)?azC(sunPos(d,+lat,+lng).az).deg:null;
    const path=[];
    for(let m=0;m<=1440;m+=10){const p=sunPos(localToAbs(date,Math.floor(m/60),m%60,tz),+lat,+lng);path.push({az:azC(p.az).deg,alt:p.alt*180/PI});}
    return {sr:az(t.sunrise),ss:az(t.sunset),noonAlt:sunPos(t.noon,+lat,+lng).alt*180/PI,path};
  }catch{return null;}},[lat,lng,date,tz]);
  const cur=useMemo(()=>{try{const p=sunPos(localToAbs(date,Math.floor(hm/60),hm%60,tz),+lat,+lng);return {az:azC(p.az).deg,alt:p.alt*180/PI};}catch{return null;}},[lat,lng,tz,date,hm]);
  if(!calc)return null;
  const R=66,cx=78,cy=78,S=156;
  const pt=(deg,r)=>[cx+r*Math.sin(deg*rad),cy-r*Math.cos(deg*rad)];
  const rOf=alt=>R*(1-Math.max(0,Math.min(alt,90))/90);            // 0deg->rim, 90deg->center
  const ptsFor=arr=>arr.map(p=>{const [x,y]=pt(p.az,rOf(Math.max(0,p.alt)));return `${x.toFixed(1)},${y.toFixed(1)}`;}).join(" ");
  const above=calc.path.filter(p=>p.alt>=-0.4);
  const dayPts=ptsFor(above), goldPts=ptsFor(above.filter(p=>p.alt<=6));
  const sunR=cur?rOf(Math.max(0,cur.alt)):R;
  const [sx,sy]=cur?pt(cur.az,sunR):[cx,cy];
  let shadow=null;
  if(cur&&cur.alt>2){const len=Math.min(R*0.92,(R*0.45)/Math.tan(cur.alt*rad)+9);const [ex,ey]=pt((cur.az+180)%360,len);shadow={ex,ey};}
  const ray=(deg,col)=>{const [x,y]=pt(deg,R);return <line x1={cx} y1={cy} x2={x.toFixed(1)} y2={y.toFixed(1)} stroke={col} strokeWidth={1.2} strokeDasharray="3 3" opacity={0.7}/>;};
  const card=(deg,t)=>{const [x,y]=pt(deg,R+11);return <text x={x.toFixed(1)} y={(y+3).toFixed(1)} textAnchor="middle" style={{fontFamily:MONO,fontSize:9,fill:c.t2}}>{t}</text>;};
  return <div style={{display:"flex",gap:16,alignItems:"center",flexWrap:"wrap"}}>
    <svg width={S} height={S} viewBox={`0 0 ${S} ${S}`} style={{flexShrink:0}}>
      <circle cx={cx} cy={cy} r={R} fill={c.bg2} stroke={c.line2} strokeWidth={1}/>
      <circle cx={cx} cy={cy} r={rOf(30)} fill="none" stroke={c.line} strokeWidth={0.5}/>
      <circle cx={cx} cy={cy} r={rOf(60)} fill="none" stroke={c.line} strokeWidth={0.5}/>
      <line x1={cx-R} y1={cy} x2={cx+R} y2={cy} stroke={c.line} strokeWidth={0.5}/>
      <line x1={cx} y1={cy-R} x2={cx} y2={cy+R} stroke={c.line} strokeWidth={0.5}/>
      {dayPts&&<polyline points={dayPts} fill="none" stroke={c.accent} strokeWidth={2} strokeLinejoin="round" opacity={0.85}/>}
      {goldPts&&<polyline points={goldPts} fill="none" stroke="#ffb24d" strokeWidth={3.2} strokeLinejoin="round" strokeLinecap="round"/>}
      {calc.sr!=null&&ray(calc.sr,c.accent)}
      {calc.ss!=null&&ray(calc.ss,c.night)}
      {shadow&&<line x1={cx} y1={cy} x2={shadow.ex.toFixed(1)} y2={shadow.ey.toFixed(1)} stroke={c.t2} strokeWidth={2} strokeDasharray="2 2"/>}
      {cur&&cur.alt>0&&<line x1={cx} y1={cy} x2={sx.toFixed(1)} y2={sy.toFixed(1)} stroke={c.accent} strokeWidth={1}/>}
      {cur&&<circle cx={sx.toFixed(1)} cy={sy.toFixed(1)} r={cur.alt>0?6:4} fill={cur.alt>0?c.accent:"none"} stroke={c.accent} strokeWidth={cur.alt>0?0:1.4} opacity={cur.alt>0?1:0.5}/>}
      <circle cx={cx} cy={cy} r={2.5} fill={c.t2}/>
      {card(0,"N")}{card(90,"E")}{card(180,"S")}{card(270,"W")}
    </svg>
    <div style={{fontFamily:UI,fontSize:12,color:c.t1,lineHeight:1.7}}>
      <div><span style={{color:c.accent}}>●</span> Sunrise {calc.sr!=null?`${Math.round(calc.sr)}° ${cardOf(calc.sr)}`:"—"}</div>
      <div><span style={{color:c.night}}>●</span> Sunset {calc.ss!=null?`${Math.round(calc.ss)}° ${cardOf(calc.ss)}`:"—"}</div>
      <div style={{color:c.t2}}>Peak {Math.round(calc.noonAlt)}° at solar noon</div>
      {cur&&<div style={{color:c.t2,marginTop:4}}>Scrub: {cur.alt>0?`${Math.round(cur.az)}° ${cardOf(cur.az)} · ${Math.round(cur.alt)}° up${cur.alt>2?` · shadow ${cardOf((cur.az+180)%360)}`:""}`:"below horizon"}</div>}
      <div style={{fontFamily:MONO,fontSize:9.5,color:c.t2,marginTop:5}}><span style={{color:"#ffb24d"}}>━</span> golden · <span style={{color:c.t2}}>┄</span> shadow</div>
    </div>
  </div>;
}
// Bird's-eye satellite map (Esri World Imagery, keyless) with a north-up sun overlay: the day's
// sun-azimuth arc on the rim, the current sun ray (where light comes FROM) + glyph, and the shadow
// direction. Lets you read where light hits a real window/wall against the actual geography.
function SunMap({lat,lng,tz,date,hm,size=200}){
  const sun=useMemo(()=>{try{const t=sunTimes(dayNoonUTC(date),+lat,+lng);const azOf=d=>d&&!isNaN(d)?azC(sunPos(d,+lat,+lng).az).deg:null;return {sr:azOf(t.sunrise),ss:azOf(t.sunset)};}catch{return null;}},[lat,lng,date]);
  const cur=useMemo(()=>{try{const p=sunPos(localToAbs(date,Math.floor(hm/60),hm%60,tz),+lat,+lng);return {az:azC(p.az).deg,alt:p.alt*180/PI};}catch{return null;}},[lat,lng,tz,date,hm]);
  const [errN,setErrN]=useState(0);
  useEffect(()=>{setErrN(0);},[lat,lng,size]);   // reset tile-error count when the view recenters
  if(lat==null||lat===""||lng==null||lng==="")return null;
  const la=+lat,ln=+lng;
  // Native Esri World Imagery XYZ tiles (sharp, keyless), stitched + centered on the exact coordinate.
  // Pick the zoom whose native ground resolution best fits a ~180m-wide view in this widget.
  let z=Math.round(Math.log2(156543.03392*Math.cos(la*rad)/(180/size)));z=clamp(z,2,19);
  const n=2**z,xf=n*(ln+180)/360,yf=n*(1-Math.log(Math.tan(la*rad)+1/Math.cos(la*rad))/PI)/2;
  const xt=Math.floor(xf),yt=Math.floor(yf),k=Math.ceil((size/2)/256)+1;
  const tiles=[];for(let dy=-k;dy<=k;dy++)for(let dx=-k;dx<=k;dx++){const tx=xt+dx,ty=yt+dy;if(tx<0||ty<0||tx>=n||ty>=n)continue;tiles.push({tx,ty,sx:(tx-xf)*256+size/2,sy:(ty-yf)*256+size/2});}
  const offline=tiles.length>0&&errN>=tiles.length;   // every tile failed (offline / blocked) -> show a note; the sun overlay below stays accurate
  const tileUrl=t=>`https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${t.ty}/${t.tx}`;
  const S=size,cc=S/2,R=S/2-3;
  const pt=(deg,r)=>[cc+r*Math.sin(deg*rad),cc-r*Math.cos(deg*rad)];
  const cardOf=deg=>CARD[Math.round((((deg%360)+360)%360)/22.5)%16];
  let arcPath=null;
  if(sun&&sun.sr!=null&&sun.ss!=null){const [ax,ay]=pt(sun.sr,R-3),[bx,by]=pt(sun.ss,R-3);const large=((sun.ss-sun.sr+360)%360)>180?1:0;arcPath=`M ${ax.toFixed(1)} ${ay.toFixed(1)} A ${R-3} ${R-3} 0 ${large} 1 ${bx.toFixed(1)} ${by.toFixed(1)}`;}
  const sp=cur&&cur.alt>0?pt(cur.az,R-10):null;
  const sh=cur&&cur.alt>1?pt((cur.az+180)%360,Math.min(R-14,(R*0.5)/Math.tan(Math.max(cur.alt,3)*rad)+10)):null;
  const compass=(deg,t)=>{const [x,y]=pt(deg,R-12);return <text x={x.toFixed(1)} y={(y+3).toFixed(1)} textAnchor="middle" style={{fontFamily:MONO,fontSize:9,fontWeight:700,fill:"#fff"}} opacity={0.92}>{t}</text>;};
  return <div style={{width:size,flexShrink:0}}>
    <div style={{position:"relative",width:size,height:size,borderRadius:12,overflow:"hidden",border:`1px solid ${c.line2}`,background:c.bg2}}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{position:"absolute",inset:0}}>
        {tiles.map(t=><image key={t.tx+"_"+t.ty} href={tileUrl(t)} x={t.sx.toFixed(2)} y={t.sy.toFixed(2)} width="256.5" height="256.5" preserveAspectRatio="none" onError={()=>setErrN(n=>n+1)}/>)}
      </svg>
      {offline&&<div style={{position:"absolute",inset:0,display:"grid",placeItems:"center",fontFamily:UI,fontSize:11,color:c.t2,textAlign:"center",padding:10,pointerEvents:"none"}}>Satellite view offline (sun overlay still accurate)</div>}
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{position:"absolute",inset:0,pointerEvents:"none"}}>
        <circle cx={cc} cy={cc} r={R} fill="none" stroke="#0007" strokeWidth={1}/>
        {arcPath&&<path d={arcPath} fill="none" stroke="#ffd27a" strokeWidth={4} strokeLinecap="round" opacity={0.85}/>}
        {sun&&sun.sr!=null&&(()=>{const [x,y]=pt(sun.sr,R-3);return <circle cx={x} cy={y} r={3.2} fill="#ffb24d" stroke="#000" strokeWidth={0.6}/>;})()}
        {sun&&sun.ss!=null&&(()=>{const [x,y]=pt(sun.ss,R-3);return <circle cx={x} cy={y} r={3.2} fill={c.night} stroke="#000" strokeWidth={0.6}/>;})()}
        {sh&&<line x1={cc} y1={cc} x2={sh[0].toFixed(1)} y2={sh[1].toFixed(1)} stroke="#000" strokeWidth={2.5} strokeDasharray="3 3" opacity={0.6}/>}
        {sp&&<><line x1={cc} y1={cc} x2={sp[0].toFixed(1)} y2={sp[1].toFixed(1)} stroke="#ffd27a" strokeWidth={2}/><circle cx={sp[0].toFixed(1)} cy={sp[1].toFixed(1)} r={7} fill="#ffd27a" stroke="#a76a16" strokeWidth={1}/></>}
        {cur&&cur.alt<=0&&<text x={cc} y={cc-30} textAnchor="middle" style={{fontFamily:UI,fontSize:10,fontWeight:700,fill:"#fff"}} opacity={0.85}>sun down</text>}
        {compass(0,"N")}{compass(90,"E")}{compass(180,"S")}{compass(270,"W")}
        {/* pin: tip sits exactly on the location (viewport center) */}
        <g transform={`translate(${cc},${cc})`}>
          <ellipse cx="0" cy="1.5" rx="4" ry="1.6" fill="#000" opacity="0.35"/>
          <path d="M0,0 C-6.5,-13 -9,-19 0,-26 C9,-19 6.5,-13 0,0Z" fill="#ff4d4d" stroke="#fff" strokeWidth="1.3"/>
          <circle cx="0" cy="-18" r="3.1" fill="#fff"/>
        </g>
      </svg>
    </div>
    {cur&&<div style={{fontFamily:UI,fontSize:11,color:c.t1,marginTop:5,lineHeight:1.5}}>{cur.alt>0?<>Light from <b style={{color:c.accent}}>{cardOf(cur.az)}</b> ({Math.round(cur.az)}°), {Math.round(cur.alt)}° up{cur.alt>1?<> · shadows {cardOf((cur.az+180)%360)}</>:null}</>:"Sun below horizon"}</div>}
  </div>;
}
function SunPanel({lat,lng,tz,date}){
  const data=useMemo(()=>{if(!date)return null;try{return sunTimes(dayNoonUTC(date),+lat,+lng);}catch{return null;}},[lat,lng,date]);
  const [hm,setHm]=useState(15*60);
  const pos=useMemo(()=>{if(!date)return null;try{return sunPos(localToAbs(date,Math.floor(hm/60),hm%60,tz),+lat,+lng);}catch{return null;}},[lat,lng,tz,date,hm]);
  if(!date)return <div style={{color:c.t2,fontFamily:UI,fontSize:13}}>Set a shoot day to compute sun.</div>;
  if(!data)return null;
  const a=pos?azC(pos.az):null,al=pos?pos.alt*180/PI:0;
  let noonAlt=0;try{noonAlt=sunPos(data.noon,+lat,+lng).alt*180/PI;}catch{}
  const dayLen=(data.sunrise&&data.sunset&&!isNaN(data.sunrise)&&!isNaN(data.sunset))?(()=>{const mins=Math.round((data.sunset-data.sunrise)/60000);return `${Math.floor(mins/60)}h ${String(mins%60).padStart(2,"0")}m`;})():null;
  const Cell=({ic,l,t})=><div style={{minWidth:54}}><div style={{display:"flex",alignItems:"center",gap:4,color:c.t2,marginBottom:2}}>{ic}<Label>{l}</Label></div><Val size={14}>{fmtT(t,tz)}</Val></div>;
  return <div style={{display:"flex",flexDirection:"column",gap:13}}>
    <SunBar lat={lat} lng={lng} tz={tz} date={date} hm={hm}/>
    <div style={{display:"flex",gap:14,flexWrap:"wrap"}}>
      <Cell ic={<Clock size={12} color={c.night}/>} l="Blue AM" t={data.dawn}/>
      <Cell ic={<Sunrise size={12} color={c.accent}/>} l="Sunrise" t={data.sunrise}/>
      <Cell ic={<Sun size={12} color={c.accent}/>} l="Gold AM" t={data.goldEnd}/>
      <Cell ic={<Sun size={12} color={c.accent}/>} l="Gold PM" t={data.goldStart}/>
      <Cell ic={<Sunset size={12} color={c.accent}/>} l="Sunset" t={data.sunset}/>
      <Cell ic={<Clock size={12} color={c.night}/>} l="Blue PM" t={data.dusk}/>
    </div>
    {dayLen&&<div style={{fontFamily:UI,fontSize:11.5,color:c.t2}}>Daylight {dayLen} · solar noon {fmtT(data.noon,tz)} · peak sun {Math.round(noonAlt)}°</div>}
    <div style={{display:"flex",gap:16,flexWrap:"wrap",alignItems:"flex-start"}}>
      <SunMap lat={lat} lng={lng} tz={tz} date={date} hm={hm}/>
      <SunCompass lat={lat} lng={lng} tz={tz} date={date} hm={hm}/>
    </div>
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
const wxKey=(lat,lng,date)=>`${(+lat).toFixed(3)},${(+lng).toFixed(3)},${date}`;
// Fetch + cache one day's forecast. Caches ok/far results; never caches errors (so a retry can succeed).
// Used by useWeather (live) and to pre-warm the cache before printing DP Sides.
async function fetchWeather(lat,lng,date){
  if(lat==null||lng==null||lng===""||lat===""||!date)return {s:"idle"};
  const key=wxKey(lat,lng,date);
  if(wxCache.has(key))return wxCache.get(key);
  try{
    const d=await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${+lat}&longitude=${+lng}&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_speed_10m_max&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=auto&forecast_days=16`).then(r=>r.json());
    const i=d?.daily?.time?d.daily.time.indexOf(date):-1;
    const r=(i<0)?{s:"far"}:{s:"ok",code:d.daily.weather_code[i],hi:d.daily.temperature_2m_max[i],lo:d.daily.temperature_2m_min[i],pr:d.daily.precipitation_probability_max[i],wind:d.daily.wind_speed_10m_max[i]};
    wxCache.set(key,r);return r;
  }catch{return {s:"err"};}
}
function useWeather(lat,lng,date){
  const [st,setSt]=useState({s:"idle"});
  useEffect(()=>{let on=true;if(lat==null||lng==null||lat===""||lng===""||!date){setSt({s:"idle"});return;}
    const key=wxKey(lat,lng,date);
    if(wxCache.has(key)){setSt(wxCache.get(key));return;}
    setSt({s:"load"});
    fetchWeather(lat,lng,date).then(r=>{if(on)setSt(r);});
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
    {st.s==="ok"&&(()=>{const {Icon,label}=wxMeta(st.code);return <div style={{display:"flex",alignItems:"center",gap:16}}><Icon size={38} color={c.accent} strokeWidth={1.4}/><div><div style={{fontFamily:UI,fontSize:16,fontWeight:700,color:c.t0}}>{label}</div><div style={{display:"flex",gap:15,marginTop:5,flexWrap:"wrap"}}><span><Label>Hi/Lo</Label><div><Val size={15}>{Math.round(st.hi)}° / {Math.round(st.lo)}°F</Val></div></span><span><Label>Rain</Label><div><Val size={15} style={{color:st.pr>=50?c.day:c.t0}}>{st.pr==null?"—":st.pr+"%"}</Val></div></span><span><Label>Wind</Label><div><Val size={15}>{Math.round(st.wind)} mph</Val></div></span></div></div></div>;})()}
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
  const [fullSrc,setFullSrc]=useState(null);
  const touch=useRef(null);
  useEffect(()=>{if(state)setI(clamp(state.i||0,0,(state.items?.length||1)-1));},[state]);
  useEffect(()=>{if(!items)return;const h=e=>{if(e.key==="Escape")onClose();else if(e.key==="ArrowRight"||e.key==="ArrowDown"){e.preventDefault();setI(x=>Math.min(x+1,items.length-1));}else if(e.key==="ArrowLeft"||e.key==="ArrowUp"){e.preventDefault();setI(x=>Math.max(x-1,0));}};window.addEventListener("keydown",h);return()=>window.removeEventListener("keydown",h);},[items,onClose]);
  useEffect(()=>{let on=true;setFullSrc(null);const its=state&&state.items?state.items.filter(Boolean):null;if(its&&its.length)fullImageURL(its[clamp(i,0,its.length-1)]).then(u=>{if(on)setFullSrc(u);});return()=>{on=false;};},[state,i]);
  if(!items)return null;
  const idx=clamp(i,0,items.length-1),id=items[idx],many=items.length>1;
  const go=(d,e)=>{e&&e.stopPropagation();setI(x=>clamp(x+d,0,items.length-1));};
  const nav={width:50,height:50,borderRadius:"50%",border:"none",background:"#0009",color:"#fff",cursor:"pointer",display:"grid",placeItems:"center"};
  const ts=e=>{touch.current=e.touches[0].clientX;};
  const te=e=>{if(touch.current==null)return;const dx=e.changedTouches[0].clientX-touch.current;touch.current=null;if(Math.abs(dx)>45)go(dx<0?1:-1);};
  return <div onClick={onClose} onTouchStart={ts} onTouchEnd={te} style={{position:"fixed",inset:0,background:"#000e",zIndex:95,display:"flex",alignItems:"center",justifyContent:"center",padding:"calc(16px + env(safe-area-inset-top)) 16px"}}>
    <div onClick={e=>e.stopPropagation()} style={{maxWidth:"100%",maxHeight:"100%",display:"flex",alignItems:"center",justifyContent:"center"}}>
      {fullSrc?<img src={fullSrc} alt="" style={{maxWidth:"100%",maxHeight:"86vh",objectFit:"contain",borderRadius:8,display:"block"}}/>:<StoredImg id={id} style={{maxWidth:"100%",maxHeight:"86vh",objectFit:"contain",borderRadius:8,display:"block"}}/>}
    </div>
    <IconBtn icon={X} onClick={onClose} size={20} style={{position:"absolute",top:16,right:16}}/>
    {many&&<>
      <button onClick={e=>go(-1,e)} style={{...nav,position:"absolute",left:14,top:"50%",transform:"translateY(-50%)",opacity:idx===0?0.4:1}}><ChevronLeft size={26}/></button>
      <button onClick={e=>go(1,e)} style={{...nav,position:"absolute",right:14,top:"50%",transform:"translateY(-50%)",opacity:idx===items.length-1?0.4:1}}><ChevronRight size={26}/></button>
      <div style={{position:"absolute",bottom:18,left:"50%",transform:"translateX(-50%)",fontFamily:MONO,fontSize:12,color:"#fff",background:"#0009",borderRadius:20,padding:"5px 12px"}}>{idx+1} / {items.length}</div>
    </>}
  </div>;
}

/* Fullscreen PDF page viewer: flip pages with prev/next (arrows, keys, swipe), zoom, page count.
   Used to expand a scene's script and to open the ground-truth script/schedule documents. */
function PdfViewer({open,slot,start,title,onClose}){
  const [doc,setDoc]=useState(null),[n,setN]=useState(1),[img,setImg]=useState(null),[err,setErr]=useState(false),[zoom,setZoom]=useState(false);
  const touch=useRef(null);
  useEffect(()=>{if(!open)return;let on=true;setDoc(null);setImg(null);setErr(false);setZoom(false);
    ensureDoc(slot).then(d=>{if(!on)return;if(!d){setErr(true);return;}setDoc(d);setN(clamp(start||1,1,d.numPages));});
    return()=>{on=false;};},[open,slot,start]);
  useEffect(()=>{if(!open||!doc)return;let on=true;setImg(null);getDocPageImage(slot,n,zoom).then(r=>{if(on)setImg(r);});return()=>{on=false;};},[open,doc,n,slot,zoom]);// zoom -> re-render the page at high DPI (cached per page+level, so toggling back is instant)
  useEffect(()=>{if(!open)return;const h=e=>{if(e.key==="Escape")onClose();else if(doc&&(e.key==="ArrowRight"||e.key==="ArrowDown")){e.preventDefault();setN(x=>Math.min(x+1,doc.numPages));}else if(doc&&(e.key==="ArrowLeft"||e.key==="ArrowUp")){e.preventDefault();setN(x=>Math.max(x-1,1));}};window.addEventListener("keydown",h);return()=>window.removeEventListener("keydown",h);},[open,doc,onClose]);
  if(!open)return null;
  const N=doc?doc.numPages:0;
  const dpr=(typeof window!=="undefined"&&window.devicePixelRatio)||1;// display the hi-res zoom image at px/dpr so its pixels map 1:1 to device pixels (no DPR upscaling = crisp)
  const go=d=>setN(x=>clamp(x+d,1,N||1));
  const ts=e=>{touch.current=e.touches[0].clientX;};
  const te=e=>{if(touch.current==null||zoom)return;const dx=e.changedTouches[0].clientX-touch.current;touch.current=null;if(Math.abs(dx)>45)go(dx<0?1:-1);};
  const nav={width:48,height:48,borderRadius:"50%",border:"none",background:"#0009",color:"#fff",cursor:"pointer",display:"grid",placeItems:"center"};
  return <div style={{position:"fixed",inset:0,background:"#0b0b0d",zIndex:96,display:"flex",flexDirection:"column"}}>
    <div style={{display:"flex",alignItems:"center",gap:10,paddingTop:"max(env(safe-area-inset-top), 10px)",paddingBottom:10,paddingLeft:"max(env(safe-area-inset-left), 14px)",paddingRight:"max(env(safe-area-inset-right), 14px)",borderBottom:`1px solid ${c.line}`,background:c.bg1,flexShrink:0}}>
      <FileText size={16} color={c.accent}/>
      <div style={{fontFamily:UI,fontWeight:700,fontSize:14,color:c.t0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{title||docs[slot]?.name||DOC_LABEL[slot]}</div>
      {N>0&&<div style={{fontFamily:MONO,fontSize:12,color:c.t2,flexShrink:0}}>{n} / {N}</div>}
      <div style={{flex:1}}/>
      {!err&&<IconBtn icon={zoom?ZoomOut:ZoomIn} dim onClick={()=>setZoom(z=>!z)} title="Zoom"/>}
      <IconBtn icon={X} dim onClick={onClose} title="Close"/>
    </div>
    <div onTouchStart={ts} onTouchEnd={te} style={{flex:1,overflow:"auto",display:"flex",alignItems:zoom?"flex-start":"center",justifyContent:"center",padding:14,position:"relative",WebkitOverflowScrolling:"touch"}}>
      {err?<div style={{color:c.t2,fontFamily:UI,fontSize:14,textAlign:"center",maxWidth:340,lineHeight:1.5,alignSelf:"center"}}>No {DOC_LABEL[slot].toLowerCase()} PDF loaded yet. Add it in Docs and it syncs to your other devices.</div>:
       !img?<div style={{color:c.t2,fontFamily:MONO,fontSize:13,alignSelf:"center"}}>Rendering page {n}…</div>:
       <img src={img.url} alt="" style={{...(zoom?{width:Math.round(img.w/dpr)+"px",maxWidth:"none",maxHeight:"none"}:{width:"100%",maxWidth:920,maxHeight:"100%",objectFit:"contain"}),borderRadius:4,boxShadow:"0 6px 30px #000a"}}/>}
    </div>
    {N>1&&<>
      <button onClick={()=>go(-1)} style={{...nav,position:"absolute",left:14,top:"56%",opacity:n<=1?0.35:1}}><ChevronLeft size={26}/></button>
      <button onClick={()=>go(1)} style={{...nav,position:"absolute",right:14,top:"56%",opacity:n>=N?0.35:1}}><ChevronRight size={26}/></button>
    </>}
  </div>;
}

/* ---- ink + sketch persistence ----------------------------------- */
async function loadSketch(id){const d=await store.get("pb:sketch:"+id);if(!d)return null;if(d.bgImgId&&!d.bgUrl)d.bgUrl=isImgUrl(d.bgImgId)?d.bgImgId:await store.get("pb:img:"+d.bgImgId);return d;}
async function saveSketch(id,data){await store.set("pb:sketch:"+id,{strokes:data.strokes,aspect:data.aspect,bgImgId:data.bgImgId||null});}
async function loadScriptInk(number){return (await store.get("pb:scriptink:"+number))||{};}
async function saveScriptInk(number,page,d){const all=(await store.get("pb:scriptink:"+number))||{};all[page]={strokes:d.strokes,aspect:d.aspect,_mt:Date.now()};await store.set("pb:scriptink:"+number,all);}

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

/* Full-frame parsed script for the CURRENT scene (not the ground-truth PDF) — a clean,
   large, centered read of this scene's screenplay text. */
function ScriptFull({scene,neighbors,goScene,onClose}){
  const navRef=useRef({});
  navRef.current={onClose,prev:neighbors?.prev,next:neighbors?.next,go:goScene};
  useEffect(()=>{const h=e=>{const n=navRef.current;if(e.key==="Escape")n.onClose&&n.onClose();else if((e.key==="ArrowRight"||e.key==="ArrowDown")&&n.next&&n.go){e.preventDefault();n.go(n.next);}else if((e.key==="ArrowLeft"||e.key==="ArrowUp")&&n.prev&&n.go){e.preventDefault();n.go(n.prev);}};window.addEventListener("keydown",h);return()=>window.removeEventListener("keydown",h);},[]);
  const go=d=>{const t=d<0?neighbors?.prev:neighbors?.next;if(t&&goScene)goScene(t);};
  return <div style={{position:"fixed",inset:0,background:c.bg0,zIndex:97,display:"flex",flexDirection:"column"}}>
    <div style={{display:"flex",alignItems:"center",gap:9,paddingTop:"max(env(safe-area-inset-top), 12px)",paddingBottom:12,paddingLeft:"max(env(safe-area-inset-left), 16px)",paddingRight:"max(env(safe-area-inset-right), 16px)",borderBottom:`1px solid ${c.line}`,background:c.bg1,flexShrink:0}}>
      <span style={{fontFamily:MONO,fontSize:18,fontWeight:700,color:c.accent}}>{scene.number}</span>
      {scene.slug&&<Tag label={scene.slug} color={slugColor(scene.slug)}/>}
      {scene.dayNight&&<Tag label={scene.dayNight} color={dnColor(scene.dayNight)}/>}
      <span style={{fontFamily:UI,fontSize:13.5,fontWeight:600,color:c.t0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{scene.set}</span>
      <div style={{flex:1}}/>
      <IconBtn icon={ChevronLeft} onClick={()=>go(-1)} dim={!neighbors?.prev} title="Previous scene (left arrow)"/>
      <IconBtn icon={ChevronRight} onClick={()=>go(1)} dim={!neighbors?.next} title="Next scene (right arrow)"/>
      <IconBtn icon={X} onClick={onClose} dim title="Close (Esc)"/>
    </div>
    <div style={{flex:1,overflowY:"auto",padding:"24px max(18px,calc((100% - 780px)/2))",WebkitOverflowScrolling:"touch"}}>
      {scene.scriptText?<ScreenplayText text={scene.scriptText} size={15}/>:<div style={{fontFamily:UI,fontSize:14,color:c.t2,textAlign:"center",marginTop:40}}>No script text for this scene yet.</div>}
    </div>
  </div>;
}

/* ---- script pages for one scene --------------------------------- */
function ScriptPages({scene,bump,onMark,off=0,sceneNums}){
  const [pages,setPages]=useState(null);
  const ready=!!scriptDoc.doc;
  useEffect(()=>{let on=true;(async()=>{
    const doc=scriptDoc.doc; if(!doc){setPages([]);return;}
    const np=doc.numPages;
    // Anchor to the REAL scene heading found in the PDF text (per scene number), not a page offset.
    const idx=await scriptPageIndex(sceneNums); if(!on)return;
    const key=String(scene.number||"").toUpperCase();
    let start=null,end=null;
    if(idx&&idx.has(key)){
      start=idx.get(key);
      const nexts=[...idx.values()].filter(v=>v>start).sort((a,b)=>a-b);
      end=Math.min(nexts.length?nexts[0]-1:np, start+6, np); // scene spans from its page to the next scene's page
    }else if(scene.pageStart){ // fallback: printed page + title-page offset
      start=Math.min(scene.pageStart+off,np); end=Math.min((scene.pageEnd||scene.pageStart)+off,np);
    }
    if(start==null){setPages([]);return;}
    const ink=await loadScriptInk(scene.number);const out=[];
    for(let n=start;n<=end;n++){try{const img=await getScriptPageImage(n);if(img)out.push({n,url:img.url,aspect:img.w/img.h,ink:ink[n]});}catch{}}
    if(on)setPages(out);
  })();return()=>{on=false;};},[scene.number,scene.pageStart,scene.pageEnd,ready,bump,off,sceneNums]);
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
function SceneView({scene,scenes,meta,locations,gearList,wide,patchScene,openInk,openLightbox,addGear,goScene,neighbors,openInfo,onToast,onSendRef,openPdf,openVf,addCapturedRef}){
  const [bump,setBump]=useState(0),[drag,setDrag]=useState(false),[pickBg,setPickBg]=useState(false),[sendImg,setSendImg]=useState(null),[scriptFull,setScriptFull]=useState(false);
  const fileRef=useRef(null),camRef=useRef(null);
  const loc=locations.find(l=>l.id===scene.locationId);
  const sceneNums=useMemo(()=>scenes.map(s=>s.number),[scenes]);
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
  // patchScene({}) after a save bumps the scene's _mt so the deck push fires + the ink/sketch payload (re-read fresh by exportFullBackup) rides to the cloud. Without it an ink/sketch edit is stranded local-only.
  const markPage=(n,ink,url,aspect)=>openInk({title:`Scene ${scene.number} · page ${n}`,bgUrl:url,draftKey:"si:"+scene.number+":"+n,initial:ink?{...ink,bgUrl:url}:{aspect},onSave:async d=>{await saveScriptInk(scene.number,n,d);setBump(b=>b+1);patchScene({});}});
  const newSketch=async(bg)=>{const bgUrl=bg?(isImgUrl(bg)?bg:await store.get("pb:img:"+bg)):null;const id=uid();openInk({title:`Blocking · Scene ${scene.number}`,bgUrl,draftKey:"sk:"+id,initial:bgUrl?{bgUrl}:{aspect:4/3},onSave:async d=>{await saveSketch(id,{...d,bgImgId:bg||null});patchScene({sketches:[...scene.sketches,id]});}});};
  const editSketch=async id=>{const d=await loadSketch(id);openInk({title:`Blocking · Scene ${scene.number}`,bgUrl:d?.bgUrl||null,draftKey:"sk:"+id,initial:d||{aspect:4/3},onSave:async nd=>{await saveSketch(id,{...nd,bgImgId:d?.bgImgId||null});setBump(b=>b+1);patchScene({});}});};
  const startSketch=()=>{(plans.length||scene.refs.length)?setPickBg(true):newSketch(null);};

  const InfoStrip=(
    <div style={{background:c.bg1,border:`1px solid ${c.line}`,borderRadius:13,padding:"12px 15px"}}>
      <div style={{display:"flex",alignItems:"center",gap:12,flexWrap:"wrap"}}>
        <div style={{display:"flex",alignItems:"baseline",gap:8}}><span style={{fontFamily:MONO,fontSize:25,fontWeight:700,color:c.accent,letterSpacing:"-0.5px"}}>{scene.number||"—"}</span>{scene.status==="omitted"&&<Chip color={c.t2}>not in current draft</Chip>}</div>
        {scene.slug&&<Tag label={scene.slug} color={slugColor(scene.slug)} big/>}
        {scene.dayNight&&<Tag label={scene.dayNight} color={dnColor(scene.dayNight)} big/>}
        {scene.eighths>0&&<Tag label={fmtEighths(scene.eighths)+" pg"} color={c.t2} big/>}
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
  // Wide 3-up view: scene identity/controls live in the merged top bar, so here we only show a
  // slim daylight strip (when the location has GPS) to keep the three columns tall.
  const DaylightStrip=(loc&&loc.lat)?(
    <div style={{display:"flex",alignItems:"center",gap:14,flexWrap:"wrap",background:c.bg1,border:`1px solid ${c.line}`,borderRadius:11,padding:"7px 14px"}}>
      <Label>Daylight {scene.shootDate||""}</Label>
      <div style={{flex:1,minWidth:200,maxWidth:420}}><SunBar lat={loc.lat} lng={loc.lng} tz={meta.tz} date={scene.shootDate||todayISO()}/></div>
      <WeatherInline lat={loc.lat} lng={loc.lng} date={scene.shootDate}/>
      <TravelChip meta={meta} lat={loc.lat} lng={loc.lng}/>
      {loc.address&&<span style={{fontFamily:UI,fontSize:12,color:c.t2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:260}}>{loc.address}</span>}
    </div>
  ):null;

  const Script=<PanelShell wide={wide} title="Script" icon={<FileText size={14} color={c.accent}/>}
    action={<div style={{display:"flex",gap:4}}>
      <IconBtn icon={BookOpen} size={17} dim title="Open the script PDF here and flip pages" onClick={async()=>{try{const idx=await scriptPageIndex(sceneNums);const np=scriptDoc.doc?.numPages||0;const k=String(scene.number||"").toUpperCase();let pg=(idx&&idx.get(k))||0;if(!pg)pg=Math.min((scene.pageStart||1)+(+(meta?.scriptPageOffset||0)),np||9999);openPdf&&openPdf({slot:"script",start:pg||1,title:`Scene ${scene.number} script`});}catch{openPdf&&openPdf({slot:"script",start:1,title:"Script"});}}}/>
      {scene.scriptText&&<IconBtn icon={Maximize2} size={17} dim title="Full-screen reading view (parsed text)" onClick={()=>setScriptFull(true)}/>}
    </div>}>
    <ScriptPages scene={scene} bump={bump} onMark={markPage} off={+(meta?.scriptPageOffset||0)} sceneNums={sceneNums}/>
  </PanelShell>;

  const Reference=<PanelShell wide={wide} title={`Reference${scene.refs.length?` · ${scene.refs.length}`:""}`} icon={<ImageIcon size={14} color={c.accent}/>}
    action={<div style={{display:"flex",gap:6}}>{openVf&&addCapturedRef&&<IconBtn icon={Aperture} size={17} onClick={()=>openVf({title:`Scene ${scene.number} reference`,onCapture:async url=>{const id=await putImage(url);addCapturedRef(id);}})} dim title="Director's viewfinder"/>}<IconBtn icon={Camera} size={17} onClick={()=>camRef.current.click()} dim title="Camera"/><IconBtn icon={Upload} size={17} onClick={()=>fileRef.current.click()} dim title="Add images"/></div>}>
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
      {scene.animation?.length>0&&<div>
        <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:8}}><Film size={14} color={c.animation}/><Label style={{color:c.animation}}>Animation breakdown</Label>{openPdf&&<IconBtn icon={BookOpen} size={15} dim title="Open the animation breakdown PDF (source of truth) at this scene" onClick={()=>openPdf({slot:"animation",start:ANIM_PDF_PAGE[String(scene.number||"").toUpperCase()]||1,title:"Animation breakdown · Scene "+scene.number})}/>}</div>
        <div style={{display:"flex",flexDirection:"column",gap:11}}>
          {scene.animation.map((row,ri)=>row&&<div key={ri} style={{background:c.bg2,border:`1px solid ${c.animation}33`,borderRadius:10,padding:"11px 12px"}}>
            {(row.type||(row.ref&&row.ref!==scene.number))&&<div style={{display:"flex",alignItems:"center",gap:7,flexWrap:"wrap",marginBottom:7}}>{row.type&&<span style={{fontFamily:MONO,fontSize:10,fontWeight:700,letterSpacing:"0.02em",color:c.animation,background:c.animationSoft,border:`1px solid ${c.animation}55`,borderRadius:5,padding:"2px 7px"}}>{row.type}</span>}{row.ref&&row.ref!==scene.number&&<span style={{fontFamily:MONO,fontSize:10,color:c.t2}}>scene {row.ref}</span>}</div>}
            {row.desc&&<div style={{fontFamily:UI,fontSize:13,color:c.t0,lineHeight:1.5,whiteSpace:"pre-wrap"}}>{row.desc}</div>}
            {row.needs&&<div style={{fontFamily:UI,fontSize:12,color:c.t2,lineHeight:1.45,marginTop:6,whiteSpace:"pre-wrap"}}><span style={{color:c.animation,fontWeight:600}}>Needs / questions: </span>{row.needs}</div>}
            {row.imgs&&row.imgs.length>0&&<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(160px,1fr))",gap:7,marginTop:9}}>{row.imgs.map((id,ii)=><div key={ii} onClick={()=>openLightbox&&openLightbox(row.imgs,ii)} style={{borderRadius:7,overflow:"hidden",border:`1px solid ${c.line2}`,background:c.bg1,cursor:"zoom-in"}}><StoredImg id={id} style={{width:"100%",height:"auto",display:"block",minHeight:34}}/></div>)}</div>}
          </div>)}
        </div>
      </div>}
      <div>
        <Label style={{marginBottom:6}}>Notes</Label>
        <TextArea value={scene.notes} placeholder="Ideas, intent, references to the look…" onChange={e=>patchScene({notes:e.target.value})}/>
      </div>
      <div>
        <Label style={{marginBottom:6}}>Time of day</Label>
        <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}}>
          <select value={scene.todSun||""} onChange={e=>patchScene({todSun:e.target.value})} style={{padding:"9px 11px",borderRadius:8,border:`1px solid ${c.line2}`,background:c.bg2,color:c.t0,fontFamily:UI,fontSize:13,fontWeight:600}}>
            <option value="">No sun anchor</option>
            {TOD_ANCHORS.map(a=><option key={a.k} value={a.k}>{a.label}</option>)}
          </select>
          {(scene.todSun||"").startsWith("under")&&<div style={{display:"flex",alignItems:"center",gap:5}}>
            <span style={{fontFamily:UI,fontSize:12,color:c.t2}}>sun below</span>
            <TextInput type="number" min="0" max="90" value={scene.todDeg??""} placeholder="40" onChange={e=>patchScene({todDeg:e.target.value})} style={{width:62}}/>
            <span style={{fontFamily:UI,fontSize:12,color:c.t2}}>°</span>
          </div>}
        </div>
        {(()=>{const w=solveTodWindow(scene.todSun,scene.todDeg,loc&&loc.lat,loc&&loc.lng,scene.shootDate,meta.tz);if(!w)return null;
          return <div style={{fontFamily:UI,fontSize:12,marginTop:7,lineHeight:1.45,padding:"7px 10px",borderRadius:8,background:c.bg2,border:`1px solid ${c.line2}`}}>
            {w.ok
              ? <span style={{color:c.t1}}>{scene.shootDate?`${scene.shootDate} · `:""}{todAnchorLabel(scene.todSun)}: <b style={{color:c.t0}}>{w.win}</b>{w.extra?` (${w.extra})`:""}</span>
              : <span style={{color:c.t2}}>{todAnchorLabel(scene.todSun)}: {w.why}</span>}
            <span style={{color:c.t2}}> · recomputes from the sun if the schedule moves this scene</span>
          </div>;})()}
        <TextArea value={scene.tod||""} placeholder="Notes on the light: backlight, soft window, practicals on…" onChange={e=>patchScene({tod:e.target.value})} style={{minHeight:48,marginTop:8}}/>
        <div style={{fontFamily:UI,fontSize:11.5,color:c.t2,marginTop:5,lineHeight:1.4}}>Pick a sun anchor and the clock window is computed for this scene's shoot date and location. Exports to the AD as a Time of day PDF.</div>
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
      {loc&&<LocationCard loc={loc} meta={meta} tz={meta.tz} date={scene.shootDate||todayISO()} openLightbox={openLightbox} onOpen={()=>goScene&&goScene("__loc__"+loc.id)}/>}
    </div>
  </PanelShell>;

  return <div style={{display:"flex",flexDirection:"column",gap:13,height:wide?"100%":"auto",minHeight:0}}>
    {wide?DaylightStrip:InfoStrip}
    {scene.animation?.length>0&&<div style={{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap",background:c.animationSoft,border:`1px solid ${c.animation}`,borderRadius:11,padding:"9px 14px"}}><Film size={16} color={c.animation}/><span style={{fontFamily:UI,fontSize:13,fontWeight:800,letterSpacing:"0.08em",color:c.animation}}>ANIMATION</span>{[...new Set(scene.animation.map(r=>r&&r.type).filter(Boolean))].map(t=><span key={t} style={{fontFamily:MONO,fontSize:10,fontWeight:600,color:c.animation,background:c.bg1,border:`1px solid ${c.animation}44`,borderRadius:5,padding:"2px 7px"}}>{t}</span>)}</div>}
    {wide?
      <div style={{display:"grid",gridTemplateColumns:"minmax(0,1.05fr) minmax(0,1fr) minmax(0,1.05fr)",gap:13,flex:1,minHeight:0}}>{Script}{Reference}{Work}</div>:
      <div style={{display:"flex",flexDirection:"column",gap:13}}>{Script}{Reference}{Work}</div>}
    {onSendRef&&<RefSendModal open={!!sendImg} fromNumber={scene.number} scenes={scenes||[]} onClose={()=>setSendImg(null)} onSend={(toN,mode)=>{onSendRef(scene.number,sendImg,toN,mode);setSendImg(null);onToast&&onToast(mode==="move"?`Moved to scene ${toN}`:`Copied to scene ${toN}`);}}/>}
    {scriptFull&&<ScriptFull scene={scene} neighbors={neighbors} goScene={goScene} onClose={()=>setScriptFull(false)}/>}
  </div>;
}

/* ---- shot list (free text, checkable) --------------------------- */
function ShotList({scene,patchScene}){
  const [t,setT]=useState("");
  const [drag,setDrag]=useState(null); // {from,to}
  const [editId,setEditId]=useState(null),[editText,setEditText]=useState("");
  const listRef=useRef(null);
  const shots=scene.shots;
  const startEdit=(id,text)=>{setEditId(id);setEditText(text);};
  const saveEdit=()=>{if(editId==null)return;const v=editText.trim();const id=editId;setEditId(null);setEditText("");if(v)patchScene({shots:shots.map(x=>x.id===id?{...x,text:v}:x)});};
  const addLines=()=>{const lines=t.split("\n").map(x=>x.trim()).filter(Boolean);if(!lines.length)return;patchScene({shots:[...shots,...lines.map(text=>({id:uid(),text,done:false}))]});setT("");};
  const done=shots.filter(s=>s.done).length;
  const idxFromY=y=>{const rows=[...(listRef.current?.querySelectorAll("[data-shot]")||[])];for(let i=0;i<rows.length;i++){const r=rows[i].getBoundingClientRect();if(y<r.top+r.height/2)return i;}return rows.length-1;};
  const onHandleDown=i=>e=>{e.preventDefault();e.currentTarget.setPointerCapture?.(e.pointerId);setDrag({from:i,to:i});};
  const onHandleMove=e=>{if(!drag)return;const to=idxFromY(e.clientY);if(to!==drag.to)setDrag(d=>({...d,to}));};
  const onHandleUp=()=>{if(!drag)return;const {from,to}=drag;setDrag(null);if(from===to||to==null||to<0)return;const arr=[...shots];const [m]=arr.splice(from,1);arr.splice(to,0,m);patchScene({shots:arr});};
  return <div>
    <Label style={{marginBottom:6}}>Shot list{shots.length?` · ${done}/${shots.length}`:""}</Label>
    {shots.length>0&&<div ref={listRef} style={{display:"flex",flexDirection:"column",gap:6,marginBottom:8}}>
      {shots.map((s,i)=><div key={s.id} data-shot style={{display:"flex",alignItems:"center",gap:8,background:c.bg2,border:`1px solid ${drag&&drag.to===i&&drag.from!==i?c.accent:c.line}`,borderRadius:8,padding:"7px 8px",opacity:drag&&drag.from===i?0.45:1}}>
        <span onPointerDown={onHandleDown(i)} onPointerMove={onHandleMove} onPointerUp={onHandleUp} onPointerCancel={()=>setDrag(null)} title="Drag to reorder" style={{cursor:"grab",color:c.t2,display:"grid",placeItems:"center",touchAction:"none",padding:"2px 1px",flexShrink:0}}><GripVertical size={15}/></span>
        <span style={{fontFamily:MONO,fontSize:11,color:c.t2,minWidth:15,textAlign:"right"}}>{i+1}</span>
        <button onClick={()=>patchScene({shots:shots.map(x=>x.id===s.id?{...x,done:!x.done}:x)})} style={{width:20,height:20,borderRadius:6,border:`1.5px solid ${s.done?c.ok:c.line2}`,background:s.done?c.ok:"transparent",cursor:"pointer",display:"grid",placeItems:"center",flexShrink:0}}>{s.done&&<Check size={13} color="#fff"/>}</button>
        {editId===s.id?
          <textarea autoFocus value={editText} onChange={e=>setEditText(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();saveEdit();}else if(e.key==="Escape"){setEditId(null);setEditText("");}}} onBlur={saveEdit} style={{...inputStyle(),flex:1,minHeight:34,resize:"none",lineHeight:1.4,padding:"5px 8px",fontSize:13}}/>:
          <span onClick={()=>startEdit(s.id,s.text)} title="Tap to edit" style={{flex:1,fontFamily:UI,fontSize:13,color:s.done?c.t2:c.t0,textDecoration:s.done?"line-through":"none",whiteSpace:"pre-wrap",cursor:"text",padding:"2px 4px",borderRadius:5}}>{s.text}</span>}
        <button onClick={()=>patchScene({shots:shots.filter(x=>x.id!==s.id)})} style={{background:"none",border:"none",color:c.t2,cursor:"pointer",padding:2,flexShrink:0}}><X size={14}/></button>
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
  const orphans=(scene.gearTags||[]).filter(id=>!gearList.some(g=>g.id===id)); // tags whose gear name was lost (sync race); shown as a visible to-do, never silently dropped
  const add=()=>{const v=t.trim();if(!v)return;addGear(v,dept);setT("");};
  const suggest=async()=>{setBusy(true);try{const prompt=`A film scene. Suggest specific camera, grip, electric, and special-effects gear it may need, as a JSON array of {"text":"item","dept":"camera|grip|electric|sfx"}. Be concrete and brief, max 6 items. Scene: ${scene.slug} ${scene.set}, ${scene.dayNight}. ${scene.syn||""} ${scene.notes||""}. Return ONLY the JSON array.`;const arr=extractJSON(await callClaude(prompt,1200));const cur=scene.aiGear||[];const add2=arr.filter(a=>a.text&&!cur.some(x=>x.text.toLowerCase()===a.text.toLowerCase())).map(a=>({text:a.text,dept:DEPTS.some(d=>d.k===a.dept)?a.dept:"camera",dismissed:false}));patchScene({aiGear:[...cur,...add2]});}catch(e){}setBusy(false);};
  const promote=(s)=>{addGear(s.text,s.dept);patchScene({aiGear:scene.aiGear.map(x=>x===s?{...x,dismissed:true}:x)});};
  const live=(scene.aiGear||[]).filter(s=>!s.dismissed&&!tagged.some(g=>g.name.toLowerCase()===s.text.toLowerCase()));
  return <div>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}><Label>Gear</Label><button onClick={suggest} disabled={busy} style={{display:"inline-flex",alignItems:"center",gap:5,background:"none",border:"none",color:c.accent,fontFamily:UI,fontSize:11.5,fontWeight:650,cursor:"pointer"}}><Sparkles size={13}/>{busy?"Thinking…":"Suggest"}</button></div>
    {DEPTS.map(d=>{const items=tagged.filter(g=>g.dept===d.k);if(!items.length)return null;return <div key={d.k} style={{marginBottom:7}}><div style={{fontFamily:MONO,fontSize:10,color:c.t2,marginBottom:4}}>{d.label}</div><div style={{display:"flex",flexWrap:"wrap",gap:6}}>{items.map(g=><span key={g.id} style={{display:"inline-flex",alignItems:"center",gap:5,background:c.bg2,border:`1px solid ${c.line2}`,borderRadius:7,padding:"4px 8px",fontFamily:UI,fontSize:12.5,color:c.t0}}>{g.name}<X size={12} style={{cursor:"pointer",color:c.t2}} onClick={()=>patchScene({gearTags:scene.gearTags.filter(x=>x!==g.id)})}/></span>)}</div></div>;})}
    {orphans.length>0&&<div style={{marginBottom:7,border:`1px dashed ${c.warn||"#d98a3d"}`,borderRadius:9,padding:9,background:(c.warn||"#d98a3d")+"14"}}>
      <div style={{display:"flex",alignItems:"center",gap:5,marginBottom:5,fontFamily:UI,fontSize:11,fontWeight:700,color:c.warn||"#d98a3d"}}><AlertTriangle size={12}/>{orphans.length} gear item{orphans.length>1?"s":""} missing here</div>
      <div style={{fontFamily:UI,fontSize:11.5,color:c.t2,lineHeight:1.4,marginBottom:6}}>The name was lost in a sync. Re-add the gear above, then clear this reminder.</div>
      <div style={{display:"flex",flexWrap:"wrap",gap:6}}>{orphans.map(id=><span key={id} style={{display:"inline-flex",alignItems:"center",gap:6,background:c.bg1,border:`1px dashed ${c.warn||"#d98a3d"}`,borderRadius:7,padding:"4px 8px",fontFamily:UI,fontSize:12.5,color:c.warn||"#d98a3d"}}>name lost<X size={12} title="Clear this reminder" style={{cursor:"pointer"}} onClick={()=>patchScene({gearTags:scene.gearTags.filter(x=>x!==id)})}/></span>)}</div>
    </div>}
    {live.length>0&&<div style={{margin:"4px 0 8px",border:`1px solid ${c.accent}33`,borderRadius:9,padding:9,background:c.accentSoft}}>
      <div style={{display:"flex",alignItems:"center",gap:5,marginBottom:6}}><Sparkles size={12} color={c.accent}/><Label style={{color:c.accent}}>Suggested — tap to add</Label></div>
      <div style={{display:"flex",flexWrap:"wrap",gap:6}}>{live.map((s,i)=><span key={i} style={{display:"inline-flex",alignItems:"center",gap:6,background:c.bg1,border:`1px solid ${c.line2}`,borderRadius:7,padding:"4px 6px 4px 9px",fontFamily:UI,fontSize:12.5,color:c.t1}}>{s.text}<span style={{fontFamily:MONO,fontSize:9,color:c.t2}}>{(DEPTS.find(d=>d.k===s.dept)||{}).abbr||s.dept[0].toUpperCase()}</span><button onClick={()=>promote(s)} style={{border:"none",background:c.accent,color:"#17120a",borderRadius:5,width:18,height:18,display:"grid",placeItems:"center",cursor:"pointer"}}><Plus size={12}/></button><X size={12} style={{cursor:"pointer",color:c.t2}} onClick={()=>patchScene({aiGear:scene.aiGear.map(x=>x===s?{...x,dismissed:true}:x)})}/></span>)}</div>
    </div>}
    <div style={{display:"flex",gap:6,alignItems:"center"}}>
      <div style={{display:"flex",gap:3}}>{DEPTS.map(d=><button key={d.k} onClick={()=>setDept(d.k)} title={d.label} style={{minWidth:30,padding:"0 5px",height:38,borderRadius:7,border:`1px solid ${dept===d.k?c.accent:c.line2}`,background:dept===d.k?c.accentSoft:c.bg2,color:dept===d.k?c.accent:c.t2,fontFamily:MONO,fontSize:12,fontWeight:700,cursor:"pointer"}}>{d.abbr}</button>)}</div>
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
        {s.eighths>0&&<span style={{fontFamily:MONO,fontSize:10,color:c.t2}}>{fmtEighths(s.eighths)} pg</span>}
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
function DayCard({day,date,scenes,project,onOpen,openPdf,today}){
  const loc=dayLocation(scenes,project.locations);
  const schedPage=(project.days||[]).find(x=>String(x.day)===String(day))?.page||0;  // PDF page for this day, from the embedded schedule
  const gear=useMemo(()=>{const map=Object.fromEntries(DEPTS.map(d=>[d.k,new Set()]));scenes.forEach(s=>s.gearTags.forEach(id=>{const g=project.gear.find(x=>x.id===id);if(g&&map[g.dept])map[g.dept].add(g.name);}));return map;},[scenes,project.gear]);
  const hasGear=DEPTS.some(d=>gear[d.k].size);
  return <div style={{background:c.bg1,border:`1px solid ${today?c.accent:c.line}`,borderRadius:14,overflow:"hidden"}}>
    <div style={{padding:"13px 15px",borderBottom:`1px solid ${c.line}`,display:"flex",alignItems:"center",gap:12,flexWrap:"wrap",background:today?c.accentSoft:"transparent"}}>
      <div style={{display:"flex",alignItems:"baseline",gap:9}}><span style={{fontFamily:UI,fontSize:11,fontWeight:700,color:c.t2,letterSpacing:"0.08em"}}>DAY</span><span style={{fontFamily:MONO,fontSize:22,fontWeight:700,color:c.accent}}>{day}</span></div>
      {today&&<Chip color={c.accent} active>TODAY</Chip>}
      {date&&<Val size={13} style={{color:c.t1}}>{new Date(date+"T12:00").toLocaleDateString(undefined,{weekday:"short",month:"short",day:"numeric"})}</Val>}
      <div style={{flex:1}}/>
      <span style={{fontFamily:MONO,fontSize:12,color:c.t2}}>{scenes.length} {scenes.length===1?"scene":"scenes"}{dayEighths(scenes)?` · ${fmtEighths(dayEighths(scenes))} pg`:""}</span>
      {schedPage>0&&openPdf&&<IconBtn icon={BookOpen} size={16} dim title={`Open the schedule PDF at Day ${day}`} onClick={()=>openPdf({slot:"schedule",start:schedPage,title:`Schedule · Day ${day}`})}/>}
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
        {s.eighths>0&&<span style={{fontFamily:MONO,fontSize:10,color:c.t2,flexShrink:0}}>{fmtEighths(s.eighths)}</span>}
        {s.refs.length>0&&<span style={{fontFamily:MONO,fontSize:10,color:c.t2}}>{s.refs.length}<ImageIcon size={10} style={{verticalAlign:"-1px",marginLeft:2}}/></span>}
      </button>)}
    </div>
    {hasGear&&<div style={{padding:"0 15px 14px"}}><div style={{borderTop:`1px solid ${c.line}`,paddingTop:11}}><Label style={{marginBottom:7}}>Gear this day</Label>{DEPTS.map(d=>gear[d.k].size?<div key={d.k} style={{display:"flex",gap:7,marginBottom:5,alignItems:"flex-start"}}><span style={{fontFamily:MONO,fontSize:10,color:c.t2,minWidth:58,paddingTop:3}}>{d.label}</span><div style={{display:"flex",flexWrap:"wrap",gap:5}}>{[...gear[d.k]].map(n=><Chip key={n} small>{n}</Chip>)}</div></div>:null)}</div></div>}
  </div>;
}
function CalendarView({project,onOpen}){
  const sceneByNum=useMemo(()=>{const m=new Map();for(const s of project.scenes)m.set(numKey(s.number),s);return m;},[project.scenes]);
  // Source the calendar from the SCHEDULE (project.days) so EVERY scene listed to shoot a day shows,
  // including split scenes that recur across days. Falls back to per-scene shootDate for older decks.
  const byDate=useMemo(()=>{
    const m=new Map();
    const add=(date,day,num)=>{if(!date)return;let e=m.get(date);if(!e){e={day,scenes:[]};m.set(date,e);}if(!e.scenes.includes(num))e.scenes.push(num);};
    if((project.days||[]).length){for(const d of project.days)for(const n of (d.scenes||[]))add(d.date,d.day,n);}
    else for(const s of project.scenes){if(s.status==="omitted"||!s.shootDate)continue;add(s.shootDate,s.shootDay,s.number);}
    return m;
  },[project.days,project.scenes]);
  const EVCOL="#6ea8fe";  // prep / non-shoot events (readings, recce) - distinct from the amber shoot days
  const evByDate=useMemo(()=>{const m=new Map();for(const e of (project.events||[])){if(!e||!e.start)continue;const last=new Date((e.end||e.start)+"T12:00:00Z");let d=new Date(e.start+"T12:00:00Z"),g=0;while(d<=last&&g++<400){const k=`${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,"0")}-${String(d.getUTCDate()).padStart(2,"0")}`;if(!m.has(k))m.set(k,[]);m.get(k).push(e.title||"Event");d.setUTCDate(d.getUTCDate()+1);}}return m;},[project.events]);
  const dates=[...new Set([...byDate.keys(),...evByDate.keys()])].sort();
  const [ym,setYm]=useState((dates.find(d=>d>=todayISO())||dates[0]||todayISO()).slice(0,7));
  const [y,mo]=ym.split("-").map(Number);
  const firstDow=new Date(Date.UTC(y,mo-1,1)).getUTCDay();
  const dim=new Date(Date.UTC(y,mo,0)).getUTCDate();
  const cells=[];for(let i=0;i<firstDow;i++)cells.push(null);for(let d=1;d<=dim;d++)cells.push(d);
  const ti=todayISO();
  const monthName=new Date(Date.UTC(y,mo-1,1)).toLocaleDateString(undefined,{month:"long",year:"numeric",timeZone:"UTC"});
  const shift=n=>{let mm=mo-1+n,yy=y;while(mm<0){mm+=12;yy--;}while(mm>11){mm-=12;yy++;}setYm(`${yy}-${String(mm+1).padStart(2,"0")}`);};
  const sortNums=a=>[...a].sort(cmpNum);
  return <div>
    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
      <IconBtn icon={ChevronLeft} onClick={()=>shift(-1)} dim title="Previous month"/>
      <div style={{fontFamily:UI,fontSize:15,fontWeight:700,color:c.t0}}>{monthName}</div>
      <IconBtn icon={ChevronRight} onClick={()=>shift(1)} dim title="Next month"/>
    </div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:6,gridAutoRows:"minmax(78px,auto)"}}>
      {["Su","Mo","Tu","We","Th","Fr","Sa"].map(d=><div key={d} style={{textAlign:"center",fontFamily:MONO,fontSize:10,color:c.t2,padding:"2px 0"}}>{d}</div>)}
      {cells.map((d,i)=>{
        if(!d)return <div key={"e"+i}/>;
        const key=`${ym}-${String(d).padStart(2,"0")}`;const sh=byDate.get(key);const ev=evByDate.get(key);const today=key===ti;
        return <div key={key} style={{borderRadius:9,border:`1px solid ${today?c.accent:c.line}`,background:sh?c.accentSoft:(ev?EVCOL+"1f":c.bg1),padding:"5px 6px",display:"flex",flexDirection:"column",gap:3}}>
          <div style={{display:"flex",alignItems:"baseline",justifyContent:"space-between"}}>
            <span style={{fontFamily:MONO,fontSize:11,color:today?c.accent:c.t2,fontWeight:today?700:400}}>{d}</span>
            {sh&&<span style={{fontFamily:UI,fontSize:9.5,fontWeight:700,color:c.accent}}>D{sh.day}</span>}
          </div>
          {ev&&<div style={{display:"flex",flexDirection:"column",gap:2}}>{ev.map((t,j)=><div key={j} title={t} style={{fontFamily:UI,fontSize:9,fontWeight:600,color:EVCOL,background:EVCOL+"22",border:`1px solid ${EVCOL}55`,borderRadius:4,padding:"1px 4px",lineHeight:1.25,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t}</div>)}</div>}
          {sh&&<div style={{display:"flex",flexWrap:"wrap",gap:3}}>
            {sortNums(sh.scenes).map(n=>{const s=sceneByNum.get(numKey(n));const col=s?dnColor(s.dayNight):c.t2;return <button key={n} title={s?`${s.slug} ${s.set} ${s.dayNight||""}`.trim():`Scene ${n}`} onClick={()=>onOpen&&onOpen(n)} style={{fontFamily:MONO,fontSize:9.5,fontWeight:700,color:c.t0,background:c.bg2,border:`1px solid ${c.line2}`,borderLeft:`2.5px solid ${col}`,borderRadius:4,padding:"1px 4px",cursor:"pointer",lineHeight:1.35}}>{n}</button>;})}
          </div>}
        </div>;
      })}
    </div>
    <div style={{display:"flex",gap:12,marginTop:10,flexWrap:"wrap",fontFamily:UI,fontSize:10.5,color:c.t2}}>
      {DAYNIGHT.map(dn=><span key={dn} style={{display:"flex",alignItems:"center",gap:4}}><span style={{width:8,height:8,borderRadius:2,background:dnColor(dn)}}/>{dn}</span>)}
      <span style={{display:"flex",alignItems:"center",gap:4}}><span style={{width:8,height:8,borderRadius:2,background:EVCOL}}/>prep / event</span>
      <span style={{color:c.t2}}>· tap a scene to open it</span>
    </div>
  </div>;
}
function Days({project,onOpen,openPdf}){
  const [mode,setMode]=useState("list");
  const schedLoaded=(project.days||[]).some(d=>d&&d.page>0);
  const present=project.scenes.filter(s=>s.status!=="omitted"&&s.shootDay);
  const days=groupBy([...present].sort((a,b)=>(a.shootOrder||0)-(b.shootOrder||0)),s=>s.shootDay).map(([day,scenes])=>({day,scenes,date:scenes.find(s=>s.shootDate)?.shootDate||""}));
  days.sort((a,b)=>cmpNum(a.day,b.day));
  const ti=todayISO();const todayIdx=days.findIndex(d=>d.date===ti);
  const ordered=todayIdx>=0?[days[todayIdx],...days.filter((_,i)=>i!==todayIdx)]:days;
  const unsched=project.scenes.filter(s=>s.status!=="omitted"&&!s.shootDay).length;
  if(!days.length)return <Empty icon={Calendar} title="No schedule yet" body="Drop the shooting schedule in Import, or feed Claude the call sheet. Your days build themselves, with sun, weather, and a gear rollup each."/>;
  return <div style={{display:"flex",flexDirection:"column",gap:14}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,flexWrap:"wrap"}}>
      {schedLoaded&&openPdf?<Btn kind="ghost" size={12} onClick={()=>openPdf({slot:"schedule",start:1,title:"Schedule PDF"})}><BookOpen size={14}/>Schedule PDF</Btn>:<div/>}
      <div style={{width:200}}><Segmented value={mode} onChange={v=>setMode(v||"list")} options={[{k:"list",label:"List"},{k:"calendar",label:"Calendar"}]}/></div></div>
    {mode==="calendar"?<CalendarView project={project} onOpen={onOpen}/>:<>
      {todayIdx<0&&<div style={{fontFamily:UI,fontSize:12.5,color:c.t2,display:"flex",alignItems:"center",gap:7}}><Clock size={14}/>No shoot day falls on today ({ti}).</div>}
      {ordered.map(d=><DayCard key={d.day} {...d} project={project} onOpen={onOpen} openPdf={openPdf} today={d.date===ti&&!!ti}/>)}
      {unsched>0&&<div style={{fontFamily:UI,fontSize:12.5,color:c.t2,textAlign:"center"}}>{unsched} scene{unsched>1?"s":""} not yet on the schedule.</div>}
    </>}
  </div>;
}
// Full multi-day daily forecast for one lat/lng (Open-Meteo, keyless), cached per location.
const fcCache=new Map();
function useForecast(lat,lng){
  const [st,setSt]=useState({s:"idle"});
  useEffect(()=>{let on=true;if(lat==null||lng==null||lat===""||lng===""){setSt({s:"idle"});return;}
    const key=`${(+lat).toFixed(3)},${(+lng).toFixed(3)}`;
    if(fcCache.has(key)){setSt(fcCache.get(key));return;}
    setSt({s:"load"});
    fetch(`https://api.open-meteo.com/v1/forecast?latitude=${+lat}&longitude=${+lng}&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_speed_10m_max&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=auto&forecast_days=14`).then(r=>r.json()).then(d=>{if(!on)return;const t=d?.daily?.time||[];const days=t.map((date,i)=>({date,code:d.daily.weather_code[i],hi:d.daily.temperature_2m_max[i],lo:d.daily.temperature_2m_min[i],pr:d.daily.precipitation_probability_max[i],wind:d.daily.wind_speed_10m_max[i]}));const r={s:"ok",days};fcCache.set(key,r);setSt(r);}).catch(()=>{if(on)setSt({s:"err"});});
    return()=>{on=false;};},[lat,lng]);
  return st;
}
// WEEK AHEAD — the next 7 days of weather laid over the schedule, so each day reads at a glance:
// weather + (if shooting) the day number, scene count, and location.
function WeekAhead({project,onOpen}){
  const meta=project.meta||{};
  const ti=todayISO();
  const byDate=useMemo(()=>{const m=new Map();const add=(date,day,num)=>{if(!date)return;let e=m.get(date);if(!e){e={day,scenes:[]};m.set(date,e);}if(!e.scenes.includes(num))e.scenes.push(num);};if((project.days||[]).length){for(const d of project.days)for(const n of (d.scenes||[]))add(d.date,d.day,n);}else for(const s of project.scenes){if(s.status==="omitted"||!s.shootDate)continue;add(s.shootDate,s.shootDay,s.number);}return m;},[project.days,project.scenes]);
  const dates=useMemo(()=>{const out=[];const d=new Date(ti+"T12:00:00");for(let i=0;i<7;i++){out.push(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`);d.setDate(d.getDate()+1);}return out;},[ti]);
  const locOf=dt=>{const e=byDate.get(dt);if(!e)return null;for(const n of e.scenes){const s=project.scenes.find(x=>numKey(x.number)===numKey(n));const l=s&&(project.locations||[]).find(L=>L.id===s.locationId);if(l&&l.lat)return l;}return null;};
  const fcLoc=useMemo(()=>{for(const dt of dates){const l=locOf(dt);if(l)return l;}const g=(project.locations||[]).find(l=>l.lat&&l.lng);if(g)return g;if(meta.baseLat)return {name:meta.baseName||"Base",lat:meta.baseLat,lng:meta.baseLng};return null;},[dates,project.locations,project.scenes,project.days]);
  const fc=useForecast(fcLoc?.lat,fcLoc?.lng);
  const wx=useMemo(()=>{const m=new Map();if(fc.s==="ok")for(const x of fc.days)m.set(x.date,x);return m;},[fc]);
  if(!fcLoc)return null;
  return <div>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:8,gap:8,flexWrap:"wrap"}}><Label>Week ahead</Label><span style={{fontFamily:UI,fontSize:11,color:c.t2}}>forecast near {fcLoc.name}</span></div>
    <div style={{display:"flex",gap:8,overflowX:"auto",paddingBottom:3}}>
      {dates.map(dt=>{const w=wx.get(dt);const sh=byDate.get(dt);const today=dt===ti;const dd=new Date(dt+"T12:00");const Icon=w?wxMeta(w.code).Icon:null;
        return <div key={dt} style={{flexShrink:0,width:112,background:today?c.accentSoft:c.bg1,border:`1px solid ${today?c.accent:c.line}`,borderRadius:11,padding:"9px 10px",display:"flex",flexDirection:"column",gap:6}}>
          <div style={{display:"flex",alignItems:"baseline",justifyContent:"space-between"}}><span style={{fontFamily:UI,fontSize:11.5,fontWeight:700,color:today?c.accent:c.t1}}>{today?"Today":dd.toLocaleDateString(undefined,{weekday:"short"})}</span><span style={{fontFamily:MONO,fontSize:10.5,color:c.t2}}>{dd.toLocaleDateString(undefined,{month:"short",day:"numeric"})}</span></div>
          <div style={{display:"flex",alignItems:"center",gap:7,minHeight:30}}>{Icon?<><Icon size={26} color={c.accent} strokeWidth={1.5}/><div><div style={{fontFamily:MONO,fontSize:12.5,color:c.t0}}>{w.hi!=null?`${Math.round(w.hi)}°`:"--"}<span style={{color:c.t2}}> / {w.lo!=null?`${Math.round(w.lo)}°F`:"--"}</span></div><div style={{fontFamily:MONO,fontSize:10,color:w.pr>=50?c.day:c.t2}}>{w.pr!=null?`${w.pr}%`:""}</div></div></>:<span style={{fontFamily:UI,fontSize:11,color:c.t2}}>{fc.s==="load"?"…":"beyond forecast"}</span>}</div>
          {sh?<button onClick={()=>onOpen&&onOpen(sh.scenes[0])} title={`Day ${sh.day}`} style={{fontFamily:UI,fontSize:10.5,fontWeight:700,color:c.accent,background:c.accentSoft,border:`1px solid ${c.accent}55`,borderRadius:6,padding:"3px 6px",cursor:"pointer",textAlign:"left"}}>Day {sh.day} · {sh.scenes.length} sc</button>:<span style={{fontFamily:UI,fontSize:10.5,color:c.t2,padding:"3px 0"}}>no shoot</span>}
        </div>;})}
    </div>
  </div>;
}
// HOME — a prep-and-shoot dashboard: at-a-glance status, the day in front of you with the light,
// prep readiness, and the locations/look you live in. Designed to be the first thing worth opening.
function Dashboard({project,onOpen,onNav}){
  const ti=todayISO();
  const meta=project.meta||{};
  const present=project.scenes.filter(s=>s.status!=="omitted");
  const scheduled=present.filter(s=>s.shootDay);
  const dayList=groupBy([...scheduled].sort((a,b)=>(a.shootOrder||0)-(b.shootOrder||0)),s=>s.shootDay).map(([day,scenes])=>({day,scenes,date:scenes.find(s=>s.shootDate)?.shootDate||""}));
  dayList.sort((a,b)=>cmpNum(a.day,b.day));
  const datedDays=dayList.filter(d=>d.date).sort((a,b)=>a.date<b.date?-1:1);
  const today=dayList.find(d=>d.date===ti)||null;
  const nextDay=today||datedDays.find(d=>d.date>=ti)||null;
  const nextDay2=datedDays.find(d=>d.date>(nextDay?nextDay.date:ti))||null;  // the day after the one in front of you = the "next day" sides glance
  const shootStart=datedDays[0]?.date||"";
  const shootEnd=datedDays[datedDays.length-1]?.date||"";
  const daysToStart=shootStart?Math.round((new Date(shootStart+"T12:00")-new Date(ti+"T12:00"))/864e5):null;
  const totalEighths=present.reduce((n,s)=>n+(+s.eighths||0),0);
  const pages=Math.round(totalEighths/8*10)/10;
  const locs=project.locations||[];
  const locGps=locs.filter(l=>l.lat&&l.lng).length;
  const crew=project.crew||{};
  const crewCount=DEPTS.reduce((n,d)=>n+((crew[d.k]||[]).length),0);
  const waHref=ph=>"https://wa.me/"+String(ph||"").replace(/\D/g,"");  // phone -> WhatsApp text (full international digits, no +/spaces)
  // Zak's primary key crew for the Home widget: 1st AC, gaffer, key grip, the AD's, and Michal (production).
  const keyCrew=(()=>{const out=[],seen=new Set();const add=m=>{if(m&&m.name&&!seen.has(m)){seen.add(m);out.push(m);}};
    add((crew.camera||[]).find(m=>/^1st\s*ac$/i.test((m.role||"").trim())));
    add((crew.electric||[]).find(m=>/^gaffer$/i.test((m.role||"").trim())));
    add((crew.grip||[]).find(m=>/key\s*grip/i.test(m.role||"")));
    for(const ct of (project.contacts||[]))if(/\b[1-3](st|nd|rd)?\s*ad\b/i.test(ct.role||"")||/assistant director/i.test(ct.role||""))add(ct);
    add((project.contacts||[]).find(ct=>/unit production manager|^production manager/i.test(ct.role||"")||/korynek/i.test(ct.name||"")));
    add((project.contacts||[]).find(ct=>/production designer/i.test(ct.role||"")));                 // Asia
    add((project.contacts||[]).find(ct=>/^location manager$/i.test((ct.role||"").trim())));          // Marcin Zajac
    return out;})();
  // Vendors widget: WFDIF lab (Jarek + the rest of the lab), ARRI camera rental, and Marcin at ATM.
  const vendorGroups=[["WFDIF Lab",/wfdif/i],["ARRI Rental",/arri\s*rental|arrirental/i],["ATM System",/atm\s*system|atmgrupa/i]].map(([label,rx])=>({label,people:(project.contacts||[]).filter(ct=>rx.test((ct.role||"")+" "+(ct.email||"")))})).filter(g=>g.people.length);
  const sc=STATUS.map(st=>({...st,n:present.filter(s=>(s.status||"todo")===st.k).length}));
  const look=(project.look||[]);
  const fmtD=d=>d?new Date(d+"T12:00").toLocaleDateString(undefined,{weekday:"short",month:"short",day:"numeric"}):"";
  const statusLine=today?`Today is a shoot day — Day ${today.day}`:(daysToStart!=null&&daysToStart>0?`${daysToStart} day${daysToStart>1?"s":""} to Day 1 · principal photography starts ${fmtD(shootStart)}`:(shootEnd&&ti>shootEnd?"Production wrapped":(nextDay?`Next shoot: Day ${nextDay.day} on ${fmtD(nextDay.date)}`:"No schedule loaded yet")));

  const Stat=({n,label,sub,nav})=><button onClick={nav?()=>onNav(nav):undefined} style={{flex:"1 1 92px",minWidth:92,textAlign:"left",background:c.bg1,border:`1px solid ${c.line}`,borderRadius:12,padding:"11px 13px",cursor:nav?"pointer":"default"}}>
    <div style={{fontFamily:MONO,fontSize:23,fontWeight:700,color:c.t0,lineHeight:1.1}}>{n}</div>
    <div style={{fontFamily:UI,fontSize:11,color:c.t2,marginTop:2}}>{label}</div>
    {sub&&<div style={{fontFamily:UI,fontSize:10.5,color:c.t2,marginTop:1}}>{sub}</div>}
  </button>;

  const DayHero=({d,big})=>{
    const loc=dayLocation(d.scenes,locs);
    const t=(loc&&loc.lat)?(()=>{try{return sunTimes(dayNoonUTC(d.date),+loc.lat,+loc.lng);}catch{return null;}})():null;
    const e8=d.scenes.reduce((n,s)=>n+(+s.eighths||0),0);
    const golden=({l,v})=><div style={{minWidth:48}}><div style={{fontFamily:UI,fontSize:9.5,color:c.t2}}>{l}</div><div style={{fontFamily:MONO,fontSize:12.5,color:c.t0}}>{v}</div></div>;
    return <div style={{background:c.bg1,border:`1px solid ${big?c.accent:c.line}`,borderRadius:14,overflow:"hidden"}}>
      <div style={{padding:"12px 15px",borderBottom:`1px solid ${c.line}`,display:"flex",alignItems:"center",gap:10,flexWrap:"wrap",background:big?c.accentSoft:"transparent"}}>
        <span style={{fontFamily:UI,fontSize:11,fontWeight:700,color:c.t2}}>DAY</span><span style={{fontFamily:MONO,fontSize:big?24:19,fontWeight:700,color:c.accent}}>{d.day}</span>
        {big&&<Chip color={c.accent} active>TODAY</Chip>}
        {d.date&&<Val size={13} style={{color:c.t1}}>{fmtD(d.date)}</Val>}
        <div style={{flex:1}}/>
        <span style={{fontFamily:MONO,fontSize:11.5,color:c.t2}}>{d.scenes.length} sc{e8?` · ${fmtEighths(e8)} pg`:""}</span>
        {loc&&<Chip color={c.t1} onClick={()=>onOpen("__loc__"+loc.id)}><MapPin size={11}/>{loc.name}</Chip>}
      </div>
      {big&&loc&&loc.lat&&<div style={{padding:"11px 15px",borderBottom:`1px solid ${c.line}`,display:"flex",flexDirection:"column",gap:9}}>
        {t&&<div style={{display:"flex",gap:14,flexWrap:"wrap"}}>{golden({l:"Sunrise",v:fmtT(t.sunrise,meta.tz)})}{golden({l:"Gold AM",v:fmtT(t.goldEnd,meta.tz)})}{golden({l:"Gold PM",v:fmtT(t.goldStart,meta.tz)})}{golden({l:"Sunset",v:fmtT(t.sunset,meta.tz)})}</div>}
        <SunBar lat={loc.lat} lng={loc.lng} tz={meta.tz} date={d.date}/>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,flexWrap:"wrap"}}><WeatherInline lat={loc.lat} lng={loc.lng} date={d.date}/><TravelChip meta={meta} lat={loc.lat} lng={loc.lng}/></div>
      </div>}
      <div style={{padding:"7px 9px",display:"flex",flexDirection:"column",gap:3}}>
        {d.scenes.map(s=>{const st=STATUS.find(x=>x.k===(s.status||"todo"));return <button key={s.number} onClick={()=>onOpen(s.number)} style={{display:"flex",alignItems:"center",gap:9,padding:"7px 9px",background:"transparent",border:"none",borderRadius:8,cursor:"pointer",textAlign:"left"}}>
          <span style={{fontFamily:MONO,fontSize:13.5,fontWeight:700,color:slugColor(s.slug),minWidth:34}}>{s.number}</span>
          <span style={{flex:1,minWidth:0,fontFamily:UI,fontSize:12.5,color:c.t1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{s.set||s.syn||""}</span>
          {s.dayNight&&<Tag label={s.dayNight} color={dnColor(s.dayNight)}/>}
          {s.eighths>0&&<span style={{fontFamily:MONO,fontSize:10,color:c.t2,flexShrink:0}}>{fmtEighths(s.eighths)}</span>}
          <span title={st?.label} style={{width:8,height:8,borderRadius:"50%",background:st?.color||c.t2,flexShrink:0}}/>
        </button>;})}
      </div>
    </div>;
  };

  const locBoard=[...locs].map(l=>({l,n:project.scenes.filter(s=>s.locationId===l.id&&s.status!=="omitted").length,d:nextDateForLoc(project.scenes,l.id)})).filter(x=>x.n>0).sort((a,b)=>(a.d||"9999")<(b.d||"9999")?-1:1).slice(0,8);

  return <div style={{display:"flex",flexDirection:"column",gap:16,maxWidth:980}}>
    <div>
      <div style={{fontFamily:UI,fontSize:20,fontWeight:700,color:c.t0}}>{meta.title||"The Painted Bride"}</div>
      <div style={{fontFamily:UI,fontSize:13,color:c.accent,marginTop:2,fontWeight:600}}>{statusLine}</div>
    </div>

    <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
      <Stat n={present.length} label="scenes" nav="scenes"/>
      <Stat n={dayList.length} label="shoot days" nav="days"/>
      <Stat n={pages} label="pages" sub={`${fmtEighths(totalEighths)||"0"} eighths`}/>
      <Stat n={locs.length} label="locations" sub={`${locGps} with GPS`} nav="locations"/>
      <Stat n={crewCount} label="crew" nav="crew"/>
    </div>

    {present.length>0&&<div style={{background:c.bg1,border:`1px solid ${c.line}`,borderRadius:13,padding:14}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:9}}><Label>Prep status</Label><span style={{fontFamily:MONO,fontSize:11,color:c.t2}}>{sc.find(x=>x.k==="ready")?.n+sc.find(x=>x.k==="shot")?.n||0}/{present.length} ready</span></div>
      <div style={{display:"flex",height:9,borderRadius:5,overflow:"hidden",background:c.bg2,marginBottom:9}}>{sc.map(x=>x.n?<div key={x.k} title={`${x.label}: ${x.n}`} style={{width:`${x.n/present.length*100}%`,background:x.color}}/>:null)}</div>
      <div style={{display:"flex",gap:14,flexWrap:"wrap"}}>{sc.map(x=><div key={x.k} style={{display:"flex",alignItems:"center",gap:5}}><span style={{width:9,height:9,borderRadius:2,background:x.color}}/><span style={{fontFamily:UI,fontSize:11.5,color:c.t1}}>{x.label}</span><span style={{fontFamily:MONO,fontSize:11.5,color:c.t2}}>{x.n}</span></div>)}</div>
    </div>}

    {nextDay?<div><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}><Label>{today?"Today's sides":"Next shoot day"}</Label><button onClick={()=>onNav("days")} style={{background:"none",border:"none",color:c.accent,fontFamily:UI,fontSize:12,cursor:"pointer"}}>Full schedule →</button></div><DayHero d={nextDay} big={!!today}/></div>
      :<div style={{background:c.bg1,border:`1px solid ${c.line}`,borderRadius:14,padding:"15px 16px",fontFamily:UI,fontSize:13.5,color:c.t1}}>No shoot schedule loaded yet. Drop the schedule in Import, or hand Claude the call sheet.</div>}

    {nextDay&&(()=>{const sloc=dayLocation(nextDay.scenes,locs);return (sloc&&sloc.lat)?<div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:8,gap:8,flexWrap:"wrap"}}><Label>Sun · Day {nextDay.day} · {sloc.name}</Label><span style={{fontFamily:MONO,fontSize:11,color:c.t2}}>{fmtD(nextDay.date)}</span></div>
      <div style={{background:c.bg1,border:`1px solid ${c.line}`,borderRadius:13,padding:14}}><SunPanel lat={sloc.lat} lng={sloc.lng} tz={meta.tz} date={nextDay.date}/></div>
    </div>:null;})()}

    {nextDay2&&<div><Label style={{marginBottom:7}}>{today?"Next day":"Then"}</Label><DayHero d={nextDay2}/></div>}

    <WeekAhead project={project} onOpen={onOpen}/>

    {locBoard.length>0&&<div><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}><Label>Locations up next</Label><button onClick={()=>onNav("locations")} style={{background:"none",border:"none",color:c.accent,fontFamily:UI,fontSize:12,cursor:"pointer"}}>All {locs.length} →</button></div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(150px,1fr))",gap:10}}>{locBoard.map(({l,n,d})=>{const hero=l.imgId||(l.images&&l.images[0]);return <button key={l.id} onClick={()=>onOpen("__loc__"+l.id)} style={{background:c.bg1,border:`1px solid ${c.line}`,borderRadius:11,overflow:"hidden",cursor:"pointer",textAlign:"left",padding:0}}>
        {hero?<StoredImg id={hero} style={{width:"100%",height:78,objectFit:"cover",display:"block"}}/>:<div style={{height:78,background:c.bg2,display:"grid",placeItems:"center"}}><MapPin size={18} color={c.t2}/></div>}
        <div style={{padding:"8px 10px"}}><div style={{fontFamily:UI,fontSize:13,fontWeight:600,color:c.t0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{l.name}</div><div style={{fontFamily:MONO,fontSize:10.5,color:c.t2,marginTop:2,display:"flex",gap:7}}><span>{n} sc</span>{l.lat?<span style={{color:c.ok}}>GPS</span>:<span style={{color:c.warn}}>no GPS</span>}{d&&<span>{fmtD(d).replace(/^\w+, /,"")}</span>}</div></div>
      </button>;})}</div></div>}

    {look.length>0&&<div><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}><Label>Look</Label><button onClick={()=>onNav("look")} style={{background:"none",border:"none",color:c.accent,fontFamily:UI,fontSize:12,cursor:"pointer"}}>Open →</button></div>
      <div style={{display:"flex",gap:8,overflowX:"auto",paddingBottom:3}}>{look.slice(0,10).map((id,i)=><div key={i} style={{flexShrink:0}}><StoredImg id={id} style={{width:120,height:80,objectFit:"cover",borderRadius:8,display:"block"}}/></div>)}</div></div>}

    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(240px,1fr))",gap:13}}>
      <div style={{background:c.bg1,border:`1px solid ${c.line}`,borderRadius:13,padding:14}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}><Label>Key crew</Label><button onClick={()=>onNav("crew")} style={{background:"none",border:"none",color:c.accent,fontFamily:UI,fontSize:12,cursor:"pointer"}}>Open →</button></div>
        {keyCrew.length===0?<div style={{fontFamily:UI,fontSize:12.5,color:c.t2}}>None yet.</div>:keyCrew.map(ct=><div key={ct.id||ct.name} style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:8,marginBottom:7}}><div style={{minWidth:0}}><div style={{fontFamily:UI,fontSize:13,color:c.t0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{ct.name}</div>{ct.role&&<div style={{fontFamily:UI,fontSize:11,color:c.t2}}>{ct.role}</div>}</div><div style={{display:"flex",gap:9,flexShrink:0}}>{ct.phone&&<a href={waHref(ct.phone)} target="_blank" rel="noopener noreferrer" style={{color:c.t1}} title={`WhatsApp ${ct.phone}`}><Phone size={14}/></a>}{ct.email&&<a href={`mailto:${ct.email}`} style={{color:c.t1}}><Mail size={14}/></a>}</div></div>)}
      </div>
      <div style={{background:c.bg1,border:`1px solid ${c.line}`,borderRadius:13,padding:14}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}><Label>Key contacts</Label><button onClick={()=>onNav("crew")} style={{background:"none",border:"none",color:c.accent,fontFamily:UI,fontSize:12,cursor:"pointer"}}>Open →</button></div>
        {(project.contacts||[]).length===0?<div style={{fontFamily:UI,fontSize:12.5,color:c.t2}}>None yet.</div>:project.contacts.slice(0,5).map(ct=><div key={ct.id||ct.name} style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:8,marginBottom:7}}><div style={{minWidth:0}}><div style={{fontFamily:UI,fontSize:13,color:c.t0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{ct.name}</div>{ct.role&&<div style={{fontFamily:UI,fontSize:11,color:c.t2}}>{ct.role}</div>}</div><div style={{display:"flex",gap:9,flexShrink:0}}>{ct.phone&&<a href={waHref(ct.phone)} target="_blank" rel="noopener noreferrer" style={{color:c.t1}} title={`WhatsApp ${ct.phone}`}><Phone size={14}/></a>}{ct.email&&<a href={`mailto:${ct.email}`} style={{color:c.t1}}><Mail size={14}/></a>}</div></div>)}
      </div>
      <div style={{background:c.bg1,border:`1px solid ${c.line}`,borderRadius:13,padding:14}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}><Label>Vendors</Label><button onClick={()=>onNav("crew")} style={{background:"none",border:"none",color:c.accent,fontFamily:UI,fontSize:12,cursor:"pointer"}}>Open →</button></div>
        {vendorGroups.length===0?<div style={{fontFamily:UI,fontSize:12.5,color:c.t2}}>None yet.</div>:vendorGroups.map(g=><div key={g.label} style={{marginBottom:10}}><div style={{fontFamily:MONO,fontSize:10,color:c.t2,marginBottom:5}}>{g.label}</div>{g.people.map(ct=><div key={ct.id||ct.name} style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:8,marginBottom:6}}><div style={{minWidth:0}}><div style={{fontFamily:UI,fontSize:13,color:c.t0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{ct.name}</div>{ct.role&&<div style={{fontFamily:UI,fontSize:11,color:c.t2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{(ct.role||"").split("·")[0].trim()}</div>}</div><div style={{display:"flex",gap:9,flexShrink:0}}>{ct.phone&&<a href={waHref(ct.phone)} target="_blank" rel="noopener noreferrer" style={{color:c.t1}} title={`WhatsApp ${ct.phone}`}><Phone size={14}/></a>}{ct.email&&<a href={`mailto:${ct.email}`} style={{color:c.t1}} title={ct.email}><Mail size={14}/></a>}</div></div>)}</div>)}
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
/* Compact location widget for the bottom of the shots/notes column in the 3-up view. */
function LocationCard({loc,meta,tz,date,openLightbox,onOpen}){
  const gallery=(loc.images&&loc.images.length?loc.images:(loc.imgId?[loc.imgId]:[]));
  const lat=loc.lat,lng=loc.lng,name=loc.name||"Location";
  const mapsHref=loc.address?`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(loc.address)}`:(lat?`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`:null);
  const appleHref=lat?`https://maps.apple.com/?ll=${lat},${lng}&q=${encodeURIComponent(name)}`:(loc.address?`https://maps.apple.com/?q=${encodeURIComponent(loc.address)}`:null);
  const earthHref=lat?`https://earth.google.com/web/search/${lat},${lng}`:null;
  const shadeHref=lat?shadeMapUrl(lat,lng,date):null;
  const shown=gallery.slice(0,12);
  return <div style={{border:`1px solid ${c.line}`,borderRadius:11,overflow:"hidden",background:c.bg1}}>
    <button onClick={onOpen} style={{width:"100%",display:"flex",alignItems:"center",gap:8,padding:"9px 12px",background:"none",border:"none",borderBottom:`1px solid ${c.line}`,cursor:"pointer",textAlign:"left"}}>
      <MapPin size={14} color={c.accent}/>
      <span style={{fontFamily:UI,fontWeight:700,fontSize:13.5,color:c.t0,flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{name}</span>
      <span style={{fontFamily:UI,fontSize:11,color:c.accent}}>Open page</span><ChevronRight size={14} color={c.accent}/>
    </button>
    <div style={{padding:12,display:"flex",flexDirection:"column",gap:11}}>
      {shown.length>0&&<div style={{display:"flex",gap:6,overflowX:"auto",paddingBottom:2}}>
        {shown.map((g,k)=><div key={k} onClick={()=>openLightbox&&openLightbox(gallery,k)} style={{flexShrink:0,cursor:"zoom-in"}}><StoredImg id={g} style={{width:80,height:60,objectFit:"cover",borderRadius:7,display:"block"}}/></div>)}
        {gallery.length>shown.length&&<button onClick={onOpen} style={{flexShrink:0,width:80,height:60,borderRadius:7,border:`1px solid ${c.line2}`,background:c.bg2,color:c.t2,fontFamily:UI,fontSize:12,cursor:"pointer"}}>+{gallery.length-shown.length}</button>}
      </div>}
      <div style={{display:"flex",flexWrap:"wrap",gap:9,alignItems:"center"}}>
        {meta&&lat&&<TravelChip meta={meta} lat={lat} lng={lng}/>}
        {loc.address&&<span style={{fontFamily:UI,fontSize:12,color:c.t2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:"100%"}}><MapPin size={11} style={{verticalAlign:"-1px"}}/> {loc.address}</span>}
      </div>
      <div style={{display:"flex",gap:7,flexWrap:"wrap"}}>
        {mapsHref&&<a href={mapsHref} target="_blank" rel="noreferrer" style={{textDecoration:"none"}}><Btn kind="ghost" size={11}><MapPin size={13}/>Maps</Btn></a>}
        {appleHref&&<a href={appleHref} target="_blank" rel="noreferrer" style={{textDecoration:"none"}}><Btn kind="ghost" size={11}><MapPin size={13}/>Apple</Btn></a>}
        {earthHref&&<a href={earthHref} target="_blank" rel="noreferrer" style={{textDecoration:"none"}}><Btn kind="ghost" size={11}><Compass size={13}/>Earth</Btn></a>}
        {shadeHref&&<a href={shadeHref} target="_blank" rel="noreferrer" style={{textDecoration:"none"}}><Btn kind="ghost" size={11}><Sun size={13}/>Shade</Btn></a>}
      </div>
      {lat&&lng&&<div style={{borderTop:`1px solid ${c.line}`,paddingTop:10}}><Label style={{marginBottom:7}}>Sun · {date}</Label><SunPanel lat={lat} lng={lng} tz={tz} date={date}/></div>}
    </div>
  </div>;
}
/* Rich, read-first location page: flip-through photos, map links, sun, weather, travel, scenes. */
function LocationDetail({loc,scenes,meta,tz,date,onClose,onEdit,onOpenScene,openLightbox,onAddFiles,openViewfinder}){
  const [pi,setPi]=useState(0);
  const photoRef=useRef(null);
  const gallery=(loc.images&&loc.images.length?loc.images:(loc.imgId?[loc.imgId]:[]));
  const plans=loc.plans||[];
  const here=scenes.filter(s=>s.locationId===loc.id&&s.status!=="omitted").sort((a,b)=>cmpNum(a.number,b.number));
  const name=loc.name||"Location", lat=loc.lat, lng=loc.lng;
  const mapsHref=loc.address?`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(loc.address)}`:(lat?`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`:null);
  const appleHref=lat?`https://maps.apple.com/?ll=${lat},${lng}&q=${encodeURIComponent(name)}`:(loc.address?`https://maps.apple.com/?q=${encodeURIComponent(loc.address)}`:null);
  const earthHref=lat?`https://earth.google.com/web/search/${lat},${lng}`:null;
  const shadeHref=lat?shadeMapUrl(lat,lng,date):null;
  const i=clamp(pi,0,Math.max(0,gallery.length-1));
  const go=d=>setPi(x=>clamp(x+d,0,gallery.length-1));
  const navb=side=>({position:"absolute",[side]:10,top:"50%",transform:"translateY(-50%)",width:38,height:38,borderRadius:"50%",border:"none",background:"#0009",color:"#fff",cursor:"pointer",display:"grid",placeItems:"center"});
  const sect={borderTop:`1px solid ${c.line}`,paddingTop:14};
  return <div style={{position:"fixed",inset:0,background:c.bg1,zIndex:90,display:"flex",flexDirection:"column"}}>
    <div style={{display:"flex",alignItems:"center",gap:10,paddingTop:"max(env(safe-area-inset-top), 11px)",paddingBottom:11,paddingLeft:"max(env(safe-area-inset-left), 14px)",paddingRight:"max(env(safe-area-inset-right), 14px)",borderBottom:`1px solid ${c.line}`,background:c.bg1,flexShrink:0}}>
      <IconBtn icon={ChevronLeft} onClick={onClose} title="Back"/>
      <MapPin size={16} color={c.accent}/>
      <div style={{fontFamily:UI,fontWeight:700,fontSize:16,color:c.t0,flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{name}</div>
      {openViewfinder&&<IconBtn icon={Aperture} onClick={openViewfinder} title="Director's viewfinder"/>}
      {onAddFiles&&<IconBtn icon={Camera} onClick={()=>photoRef.current&&photoRef.current.click()} title="Add photos"/>}
      <input ref={photoRef} type="file" accept="image/*" multiple style={{display:"none"}} onChange={e=>{const fs=[...e.target.files];e.target.value="";if(fs.length&&onAddFiles)onAddFiles(fs);}}/>
      <Btn kind="ghost" size={12} onClick={onEdit}><Settings size={14}/>Edit</Btn>
    </div>
    <div style={{flex:1,overflowY:"auto",WebkitOverflowScrolling:"touch"}}>
      <div style={{maxWidth:900,margin:"0 auto",padding:16,display:"flex",flexDirection:"column",gap:16}}>
        {gallery.length>0&&<div>
          <div style={{position:"relative",borderRadius:12,overflow:"hidden",border:`1px solid ${c.line2}`,background:"#000"}}>
            <StoredImg id={gallery[i]} onClick={()=>openLightbox&&openLightbox(gallery,i)} style={{width:"100%",maxHeight:"54vh",objectFit:"contain",display:"block",cursor:"zoom-in"}}/>
            {gallery.length>1&&<>
              <button onClick={()=>go(-1)} style={{...navb("left"),opacity:i===0?0.4:1}}><ChevronLeft size={22}/></button>
              <button onClick={()=>go(1)} style={{...navb("right"),opacity:i===gallery.length-1?0.4:1}}><ChevronRight size={22}/></button>
              <div style={{position:"absolute",bottom:8,left:"50%",transform:"translateX(-50%)",fontFamily:MONO,fontSize:11,color:"#fff",background:"#0009",borderRadius:20,padding:"4px 10px"}}>{i+1} / {gallery.length}</div>
            </>}
          </div>
          {gallery.length>1&&<div style={{display:"flex",gap:6,overflowX:"auto",marginTop:8,paddingBottom:4}}>
            {gallery.map((g,k)=><div key={k} onClick={()=>setPi(k)} style={{flexShrink:0,cursor:"pointer"}}><StoredImg id={g} style={{width:62,height:62,objectFit:"cover",borderRadius:7,border:`2px solid ${k===i?c.accent:"transparent"}`,display:"block"}}/></div>)}
          </div>}
        </div>}
        <div style={{display:"flex",flexWrap:"wrap",gap:10,alignItems:"center"}}>
          {loc.address&&<span style={{fontFamily:UI,fontSize:13,color:c.t1}}><MapPin size={12} style={{verticalAlign:"-2px"}}/> {loc.address}</span>}
          {here.length>0&&<Chip color={c.t1}><Film size={11}/>{here.length} scene{here.length>1?"s":""}</Chip>}
          {gallery.length>0&&<Chip color={c.t2}><ImageIcon size={11}/>{gallery.length}</Chip>}
          {date&&<span style={{fontFamily:MONO,fontSize:11,color:c.t2}}>next shoot {date}</span>}
          {meta&&lat&&<TravelChip meta={meta} lat={lat} lng={lng}/>}
        </div>
        <div style={{display:"flex",flexWrap:"wrap",gap:9}}>
          {mapsHref&&<a href={mapsHref} target="_blank" rel="noreferrer" style={{textDecoration:"none"}}><Btn kind="ghost" size={12}><MapPin size={14}/>Google Maps</Btn></a>}
          {appleHref&&<a href={appleHref} target="_blank" rel="noreferrer" style={{textDecoration:"none"}}><Btn kind="ghost" size={12}><MapPin size={14}/>Apple Maps</Btn></a>}
          {earthHref&&<a href={earthHref} target="_blank" rel="noreferrer" style={{textDecoration:"none"}}><Btn kind="ghost" size={12}><Compass size={14}/>Google Earth</Btn></a>}
          {shadeHref&&<a href={shadeHref} target="_blank" rel="noreferrer" style={{textDecoration:"none"}}><Btn kind="ghost" size={12}><Sun size={14}/>ShadeMap shadows</Btn></a>}
        </div>
        {lat&&lng?<div style={sect}><Label style={{marginBottom:8}}>Sun · {date}</Label><SunPanel lat={lat} lng={lng} tz={tz} date={date}/></div>
          :<div style={{...sect,fontFamily:UI,fontSize:13,color:c.t2}}>No GPS yet. Add a geotagged photo or coordinates (Edit) to get sun and weather here.</div>}
        {lat&&lng&&<div style={sect}><WeatherCard lat={lat} lng={lng} tz={tz} date={date}/></div>}
        {here.length>0&&<div style={sect}><Label style={{marginBottom:8}}>Scenes here</Label>
          <div style={{display:"flex",flexWrap:"wrap",gap:8}}>{here.map(s=><button key={s.number} onClick={()=>onOpenScene&&onOpenScene(s.number)} style={{display:"flex",flexDirection:"column",gap:2,alignItems:"flex-start",background:c.bg2,border:`1px solid ${c.line2}`,borderRadius:8,padding:"7px 11px",cursor:"pointer",textAlign:"left",maxWidth:240}}>
            <span style={{fontFamily:MONO,fontSize:11,color:c.accent,fontWeight:700}}>Sc {s.number}{s.dayNight?` · ${s.dayNight}`:""}</span>
            <span style={{fontFamily:UI,fontSize:12.5,color:c.t1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:218}}>{s.syn||s.set||""}</span>
          </button>)}</div></div>}
        {plans.length>0&&<div style={sect}><Label style={{marginBottom:8}}>Floor plans</Label>
          <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>{plans.map((p,k)=><StoredImg key={k} id={p} onClick={()=>openLightbox&&openLightbox(plans,k)} style={{width:120,height:90,objectFit:"cover",borderRadius:8,cursor:"zoom-in",border:`1px solid ${c.line2}`}}/>)}</div></div>}
        {loc.notes&&<div style={sect}><Label style={{marginBottom:6}}>Notes</Label><p style={{fontFamily:UI,fontSize:13.5,lineHeight:1.55,color:c.t1,whiteSpace:"pre-wrap",margin:0}}>{loc.notes}</p></div>}
      </div>
    </div>
  </div>;
}
function Locations({project,setProject,onOpen,openLightbox,onToast,focusLoc,onFocused,openVf}){
  const [ed,setEd]=useState(null);
  const [detailId,setDetail]=useState(null);
  const [dropId,setDropId]=useState("");
  // Derive the live location from its id (not a snapshot) so a cloud pull / edit while the detail
  // page is open is reflected, and the Edit hand-off writes back the fresh object, not a stale copy.
  const detail=detailId?(project.locations.find(x=>x.id===detailId)||null):null;
  // Deep-link from a scene's location chip: open the rich detail view, not the edit form.
  useEffect(()=>{if(!focusLoc)return;if(project.locations.some(x=>x.id===focusLoc))setDetail(focusLoc);onFocused&&onFocused();},[focusLoc]);
  const save=l=>{const m={...l,_mt:Date.now()};setProject(p=>({...p,locations:m.id?p.locations.map(x=>x.id===m.id?m:x):[...p.locations,{...m,id:uid(),images:m.images||[],plans:m.plans||[]}]}));};
  const del=id=>setProject(p=>({...p,locations:p.locations.filter(x=>x.id!==id),scenes:p.scenes.map(s=>s.locationId===id?{...s,locationId:""}:s)}));
  const addImagesToLoc=async(locId,files)=>{const ids=[];let gps=null;for(const f of [...files]){if(!f.type.startsWith("image/"))continue;if(!gps){try{gps=await readExifGPS(f);}catch{}}try{ids.push(await putImage(await downscale(f)));}catch{}}if(!ids.length&&!gps)return;setProject(p=>({...p,locations:p.locations.map(l=>{if(l.id!==locId)return l;const next={...l,images:[...(l.images||[]),...ids],imgId:l.imgId||ids[0]||"",_mt:Date.now()};if(gps&&!String(l.lat||"").trim()&&!String(l.lng||"").trim()){next.lat=gps.lat.toFixed(6);next.lng=gps.lng.toFixed(6);}return next;})}));onToast&&onToast(ids.length?`${ids.length} photo${ids.length>1?"s":""} added to location`:"Location GPS set from photo");};
  const addCapturedToLoc=async(locId,url)=>{const id=await putImage(url);setProject(p=>({...p,locations:p.locations.map(l=>l.id===locId?{...l,images:[...(l.images||[]),id],imgId:l.imgId||id,_mt:Date.now()}:l)}));onToast&&onToast("Photo saved to location");};
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
            {hero?<StoredImg id={hero} style={{width:"100%",height:130,objectFit:"cover",display:"block",cursor:"pointer"}} onClick={()=>setDetail(l.id)}/>:<div style={{height:8}}/>}
            <div style={{padding:14}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8}}><div style={{minWidth:0,cursor:"pointer"}} onClick={()=>setDetail(l.id)}><div style={{fontFamily:UI,fontSize:16,fontWeight:700,color:c.t0}}>{l.name}</div>{l.address&&<div style={{fontFamily:UI,fontSize:12,color:c.t2,marginTop:2}}>{l.address}</div>}</div><div style={{display:"flex",gap:6,flexShrink:0,alignItems:"center"}}>{earthHref&&<a href={earthHref} target="_blank" rel="noreferrer" title="Google Earth fly-around" style={{color:c.t2,display:"flex"}}><Compass size={16}/></a>}{mapsHref&&<a href={mapsHref} target="_blank" rel="noreferrer" title="Maps" style={{color:c.t2,display:"flex"}}><MapPin size={16}/></a>}<IconBtn icon={Settings} size={16} dim onClick={()=>setEd(l)}/></div></div>
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
    {detail&&<LocationDetail loc={detail} scenes={project.scenes} meta={project.meta} tz={project.meta.tz} date={nextDateForLoc(project.scenes,detail.id)||todayISO()} openLightbox={openLightbox} onOpenScene={n=>{setDetail(null);onOpen&&onOpen(n);}} onEdit={()=>{const d=detail;setDetail(null);setEd(d);}} onClose={()=>setDetail(null)} onAddFiles={files=>addImagesToLoc(detail.id,files)} openViewfinder={openVf?()=>openVf({title:`${detail.name||"Location"} photos`,onCapture:url=>addCapturedToLoc(detail.id,url)}):null}/>}
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
// One unified Crew page: the DP's own departments (project.crew) at the top, then the rest of the
// production crew + vendors as project.contacts grouped under department headers (a `dept` field).
const MY_DEPTS=[{k:"camera",label:"Camera"},{k:"grip",label:"Grip"},{k:"electric",label:"Electric"},{k:"sfx",label:"SFX"}];
const CONTACT_DEPTS=["Director & Producers","Production","AD & Script","Locations","Casting","Art Department","Costume","Hair & Makeup","Sound","SFX","Stunts","Picture Vehicles","Catering & Base Camp","Post-Production","Production Office","Vendors & Suppliers","Other"];
function PersonCard({m,meta,onEdit,crew}){
  return <div style={{background:c.bg1,border:`1px solid ${c.line}`,borderRadius:11,padding:13}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8}}>
      <div style={{minWidth:0}}><div style={{fontFamily:UI,fontSize:14.5,fontWeight:700,color:c.t0,overflow:"hidden",textOverflow:"ellipsis"}}>{m.name}</div>{m.role&&<div style={{fontFamily:UI,fontSize:12,color:c.accent,marginTop:1}}>{m.role}</div>}</div>
      <div style={{display:"flex",gap:4,flexShrink:0}}>{(crew&&(m.pron||m.name))&&<IconBtn icon={Volume2} size={15} dim onClick={()=>say(m.pron||m.name)} title="Hear name"/>}<IconBtn icon={Settings} size={15} dim onClick={onEdit} title="Edit"/></div>
    </div>
    {m.pron&&<div style={{fontFamily:MONO,fontSize:11,color:c.t2,marginTop:5}}>{m.pron}</div>}
    {m.address&&<div style={{fontFamily:UI,fontSize:12,color:c.t2,marginTop:6}}>{m.address}</div>}
    <div style={{display:"flex",gap:12,marginTop:9,alignItems:"center",flexWrap:"wrap"}}>
      {m.lat&&meta&&<TravelChip meta={meta} lat={m.lat} lng={m.lng}/>}
      {m.address&&<a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(m.address)}`} target="_blank" rel="noreferrer" style={{color:c.t1}} title="Maps"><MapPin size={14}/></a>}
      {m.phone&&<a href={`tel:${m.phone}`} style={{color:c.t1}} title={m.phone}><Phone size={14}/></a>}
      {m.email&&<a href={`mailto:${m.email}`} style={{color:c.t1}} title={m.email}><Mail size={14}/></a>}
    </div>
  </div>;
}
function DeptBlock({label,sub,count,onAdd,children}){
  return <div style={{marginBottom:6}}>
    <div style={{display:"flex",alignItems:"center",gap:9,marginBottom:9}}>
      <div style={{fontFamily:UI,fontSize:13.5,fontWeight:700,color:c.t1}}>{label}</div>
      {count>0&&<div style={{fontFamily:MONO,fontSize:11,color:c.t2}}>{count}</div>}
      <div style={{flex:1,height:1,background:c.line}}/>
      {onAdd&&<IconBtn icon={Plus} size={16} dim onClick={onAdd} title={`Add to ${label}`}/>}
    </div>
    {children}
  </div>;
}
function Crew({project,setProject}){
  const [crewEd,setCrewEd]=useState(null);   // {dept, m}
  const [conEd,setConEd]=useState(null);      // contact obj (existing) or {dept} (new)
  const crew=project.crew||{};
  const contacts=project.contacts||[];
  const meta=project.meta;
  const saveCrew=(dept,m)=>setProject(p=>{const list=p.crew[dept]||[];return {...p,crew:{...p.crew,[dept]:m.id?list.map(x=>x.id===m.id?m:x):[...list,{...m,id:uid()}]}};});
  const delCrew=(dept,id)=>setProject(p=>({...p,crew:{...p.crew,[dept]:(p.crew[dept]||[]).filter(x=>x.id!==id)}}));
  const saveCon=ct=>setProject(p=>({...p,contacts:ct.id?p.contacts.map(x=>x.id===ct.id?ct:x):[...p.contacts,{...ct,id:uid()}]}));
  const delCon=id=>setProject(p=>({...p,contacts:p.contacts.filter(x=>x.id!==id)}));
  const byDept={};for(const ct of contacts){const dep=(ct.dept&&CONTACT_DEPTS.includes(ct.dept))?ct.dept:"Other";(byDept[dep]=byDept[dep]||[]).push(ct);}
  const grid=ch=><div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(240px,1fr))",gap:10}}>{ch}</div>;
  return <div style={{display:"flex",flexDirection:"column",gap:24}}>
    <div>
      <div style={{fontFamily:UI,fontSize:13,fontWeight:800,letterSpacing:"0.06em",textTransform:"uppercase",color:c.accent,marginBottom:12}}>Your crew</div>
      {MY_DEPTS.map(d=>{const ppl=crew[d.k]||[];if(d.k==="sfx"&&!ppl.length)return null;return <DeptBlock key={d.k} label={d.label} count={ppl.length} onAdd={()=>setCrewEd({dept:d.k,m:{}})}>
        {ppl.length?grid(ppl.map(m=><PersonCard key={m.id} m={m} meta={meta} crew onEdit={()=>setCrewEd({dept:d.k,m})}/>)):<div style={{fontFamily:UI,fontSize:12.5,color:c.t2,border:`1px dashed ${c.line2}`,borderRadius:10,padding:13}}>No {d.label.toLowerCase()} crew yet.</div>}
      </DeptBlock>;})}
    </div>
    <div>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12,gap:8,flexWrap:"wrap"}}>
        <div style={{fontFamily:UI,fontSize:13,fontWeight:800,letterSpacing:"0.06em",textTransform:"uppercase",color:c.accent}}>Production & contacts</div>
        <Btn kind="ghost" size={12} onClick={()=>setConEd({dept:"Production"})}><Plus size={15}/>Add contact</Btn>
      </div>
      {contacts.length===0?<div style={{fontFamily:UI,fontSize:12.5,color:c.t2,border:`1px dashed ${c.line2}`,borderRadius:10,padding:14}}>No production crew or contacts yet. Hand Claude the crew list, or add them here.</div>:
        CONTACT_DEPTS.map(dep=>{const ppl=byDept[dep]||[];if(!ppl.length)return null;return <DeptBlock key={dep} label={dep} count={ppl.length} onAdd={()=>setConEd({dept:dep})}>
          {grid(ppl.map(ct=><PersonCard key={ct.id} m={ct} meta={meta} onEdit={()=>setConEd(ct)}/>))}
        </DeptBlock>;})}
    </div>
    <CrewEditor open={!!crewEd} dept={crewEd?.dept} init={crewEd?.m} onClose={()=>setCrewEd(null)} onSave={m=>saveCrew(crewEd.dept,m)} onDelete={id=>delCrew(crewEd.dept,id)}/>
    <ContactEditor open={!!conEd} init={conEd} onClose={()=>setConEd(null)} onSave={saveCon} onDelete={delCon}/>
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
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:11}}>
        <Field label="What they are"><TextInput value={f.role||""} onChange={e=>set("role",e.target.value)} placeholder="Sound Mixer, rental, lab…"/></Field>
        <Field label="Department"><select value={f.dept||"Other"} onChange={e=>set("dept",e.target.value)} style={{...inputStyle(),cursor:"pointer"}}>{CONTACT_DEPTS.map(d=><option key={d} value={d}>{d}</option>)}</select></Field>
      </div>
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
        <Field label="Scene number">{init?.__new
          ? <TextInput value={f.number||""} onChange={e=>set("number",e.target.value)} placeholder="14A"/>
          : <div title="The scene number is the spine that links the script, schedule, photos and sync. It cannot be changed here." style={{padding:"9px 11px",borderRadius:8,border:`1px solid ${c.line2}`,background:c.bg2,color:c.t2,fontFamily:MONO,fontSize:13,display:"flex",justifyContent:"space-between",alignItems:"center"}}><span style={{color:c.t0,fontWeight:700}}>{f.number}</span><span style={{fontSize:10}}>fixed</span></div>}</Field>
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
  const apply=async()=>{
    try{if(R2_KEY)await writeSnapshotNow("before-import-"+Date.now(),"Before import "+new Date().toLocaleString());}catch{}  // rollback point before an import changes the deck
    if(review.kind==="script"){setProject(p=>{let sc=attachRefs(applyScript(p.scenes,review.parsed),review.parsed);sc=linkLocations(sc,review.parsed,p.locations);const d=deriveLocations(sc,p.locations);return {...p,scenes:d.scenes,locations:d.locations};});onToast(`Script merged · ${review.diff.added.length} new, ${review.diff.omitted.length} cut`);}
    else{setProject(p=>({...p,days:review.days,scenes:applySchedule(p.scenes,review.days)}));onToast(`Schedule applied · ${review.diff.days} days`);}
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
    try{if(R2_KEY)await writeSnapshotNow("before-import-"+Date.now(),"Before project import "+new Date().toLocaleString());}catch{}  // rollback point before a full-project import
    try{
      await ensureImageHashIndex(); // so re-imports reuse existing image ids instead of duplicating
      const incScenes=(data.scenes||[]).map(s=>({...s,refs:[...(s.refs||[])]}));
      const total=incScenes.reduce((n,s)=>n+s.refs.filter(r=>typeof r==="string"&&/^data:/.test(r)).length,0);let done=0;
      for(const s of incScenes){const ids=[];for(const r of s.refs){if(typeof r!=="string")continue;if(/^data:/.test(r)){setProg(`Storing images ${++done}/${total}…`);ids.push(await putImage(r));}else ids.push(r);}s.refs=ids;}
      let look=[...(data.look||[])];
      for(let i=0;i<look.length;i++){if(typeof look[i]==="string"&&/^data:/.test(look[i])){setProg(`Storing look ${i+1}/${look.length}…`);look[i]=await putImage(look[i]);}}
      if(data.docs){for(const slot of ["script","schedule"]){const d=data.docs[slot];const m=d&&typeof d.data==="string"&&d.data.match(/^data:.*?;base64,(.*)$/);if(m){setProg(`Storing ${slot} document…`);try{await saveDoc(slot,b64ToU8(m[1]).buffer,d.name||"");}catch{}}}}
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
function SettingsView({project,setProject,onToast,onThemeChange,onNav}){
  const m=project.meta;const set=(k,v)=>setProject(p=>({...p,meta:{...p.meta,[k]:v}}));
  const [wipe,setWipe]=useState(false);
  const [aikey,setAikey]=useState("");
  const [r2key,setR2k]=useState(""),[syncing,setSyncing]=useState("");
  const [snaps,setSnaps]=useState(null),[restoring,setRestoring]=useState(""),[lastBk,setLastBk]=useState(0);
  const [shadows,setShadows]=useState(null),[myDev,setMyDev]=useState("");
  const [blocked,setBlocked]=useState(null);   // pb:sync_blocked: the shrink guard held a push to protect the cloud
  const loadSnaps=()=>{if(!R2_KEY){setSnaps([]);return;}setSnaps(null);readSnapshotIndex().then(idx=>setSnaps(idx.slice().reverse())).catch(()=>setSnaps([]));};
  const loadShadows=()=>{if(!R2_KEY){setShadows([]);return;}setShadows(null);readShadowIndex().then(d=>setShadows(d.slice().sort((a,b)=>(b.ts||0)-(a.ts||0)))).catch(()=>setShadows([]));};
  useEffect(()=>{store.get("pb:aikey").then(k=>setAikey(k||""));store.get("pb:r2key").then(k=>setR2k(k||""));store.get("pb:lastbackup").then(v=>setLastBk(v||0));store.get("pb:sync_blocked").then(b=>setBlocked(b||null));deviceId().then(setMyDev).catch(()=>{});loadSnaps();loadShadows();},[]);
  const useHere=async()=>{try{const {lat,lng}=await whereAmI();setProject(p=>({...p,meta:{...p.meta,baseLat:lat.toFixed(6),baseLng:lng.toFixed(6)}}));onToast("Base set to current location");}catch{onToast("Couldn't get location");}};
  return <div style={{maxWidth:640,margin:"0 auto",display:"flex",flexDirection:"column",gap:16}}>
    {blocked&&R2_KEY&&<div style={{background:c.bg1,border:`1px solid ${c.warn||"#d98a3d"}`,borderRadius:13,padding:15}}>
      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}><AlertTriangle size={16} color={c.warn||"#d98a3d"}/><Label style={{color:c.warn||"#d98a3d"}}>Cloud sync paused</Label></div>
      <div style={{fontFamily:UI,fontSize:13,color:c.t1,lineHeight:1.5,marginBottom:12}}>This device has <b>{blocked.next}</b> {blocked.kind||"scenes"} but the cloud has <b>{blocked.prior}</b>. To protect the cloud deck, the sync was held instead of overwriting it. Almost always you want to <b>pull the cloud copy</b>. Only force-push if this device is deliberately the new source of truth.</div>
      <div style={{display:"flex",gap:9,flexWrap:"wrap"}}>
        <Btn kind="primary" size={12} disabled={!!syncing} onClick={async()=>{setSyncing("pull");try{await pullDeckFromCloud();await store.del("pb:sync_blocked");onToast("Pulled the cloud copy. Reloading…");setTimeout(()=>location.reload(),800);}catch(e){onToast("Pull failed: "+(e.message||""));setSyncing("");}}}><CloudDownload size={15}/>{syncing==="pull"?"Pulling…":"Pull cloud copy (recommended)"}</Btn>
        <Btn kind="danger" size={12} disabled={!!syncing} onClick={async()=>{if(!window.confirm(`Force-push this device's ${blocked.next}-scene deck and OVERWRITE the cloud's ${blocked.prior}-scene deck? A snapshot of the cloud is saved first, so it is reversible from Version history.`))return;setSyncing("force");try{await writeSnapshotNow("before-force-push-"+Date.now(),"Before force push "+todayISO());await forcePushDeck();setBlocked(null);onToast("Forced this device's deck to the cloud.");}catch(e){onToast("Force push failed: "+(e.message||""));}setSyncing("");}}><Upload size={15}/>{syncing==="force"?"Pushing…":"Force push this device"}</Btn>
      </div>
    </div>}
    <Card title="Film" icon={Film}>
      <Field label="Title"><TextInput value={m.title} onChange={e=>set("title",e.target.value)}/></Field>
    </Card>
    <Card title="Documents" icon={FileText}>
      <div style={{fontFamily:UI,fontSize:12.5,color:c.t2,lineHeight:1.5,marginBottom:11}}>The ground-truth script and shooting-schedule PDFs. They travel with the deck and drive the per-scene script pages. Open or replace them here.</div>
      <Btn kind="ghost" size={12} onClick={()=>onNav&&onNav("docs")}><BookOpen size={15}/>Open Documents</Btn>
    </Card>
    <Card title="Import / load a project" icon={Upload}>
      <div style={{fontFamily:UI,fontSize:12.5,color:c.t2,lineHeight:1.5,marginBottom:11}}>Load a project file or paste a parsed deck (script, schedule, shots, gear). On a new device with Cloud sync on, you do not need this; just enter the key.</div>
      <Btn kind="ghost" size={12} onClick={()=>onNav&&onNav("import")}><Upload size={15}/>Open Import</Btn>
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
      <div style={{fontFamily:UI,fontSize:12.5,color:c.t2,lineHeight:1.5,marginBottom:11}}>Enter your R2 Files Worker key once on each device and the deck syncs automatically: it pulls the latest when you open or refocus the app, and pushes your edits a few seconds after you make them (a "Synced" badge shows in the top bar). No manual import needed on a new device, just the key. The film stays private: the worker requires this key, nothing is public. The buttons below force a sync if you ever want to.</div>
      <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:11}}>
        <TextInput type="password" value={r2key} placeholder="Files Worker X-API-Key" autoComplete="off" onChange={e=>setR2k(e.target.value)}/>
        <Btn kind="ghost" size={12} onClick={async()=>{await setR2Key(r2key.trim());onToast(r2key.trim()?"Cloud key saved on this device":"Cloud key cleared");}}>Save</Btn>
      </div>
      <div style={{display:"flex",gap:9,flexWrap:"wrap"}}>
        <Btn kind="ghost" size={12} disabled={!!syncing} onClick={async()=>{setSyncing("push");try{const n=await pushDeckToCloud();onToast(`Pushed deck to cloud (${(n.len/1048576).toFixed(1)} MB)${n.merged?" · merged in cloud edits, reloading…":""}`);if(n.merged)setTimeout(()=>location.reload(),900);}catch(e){onToast("Push failed: "+(e.message||""));}setSyncing("");}}><Upload size={15}/>{syncing==="push"?"Pushing…":"Push deck to cloud"}</Btn>
        <Btn kind="ghost" size={12} disabled={!!syncing} onClick={async()=>{setSyncing("pull");try{await pullDeckFromCloud();onToast("Pulled deck from cloud. Reloading…");setTimeout(()=>location.reload(),800);}catch(e){onToast("Pull failed: "+(e.message||""));setSyncing("");}}}><CloudDownload size={15}/>{syncing==="pull"?"Pulling…":"Pull deck from cloud"}</Btn>
      </div>
    </Card>
    <Card title="Version history (automatic)" icon={RefreshCw}>
      <div style={{fontFamily:UI,fontSize:12.5,color:c.t2,lineHeight:1.5,marginBottom:11}}>{R2_KEY?`A dated snapshot of the whole deck is saved to your cloud automatically once a day and kept for ${SNAP_KEEP} days. If a sync goes wrong or you erase by accident, roll back to any day below. This is your safety net.`:"Turn on Cloud sync above to get automatic daily snapshots you can roll back to."}</div>
      {R2_KEY&&<>
        {snaps===null?<div style={{fontFamily:UI,fontSize:12.5,color:c.t2}}>Loading snapshots…</div>:
         snaps.length===0?<div style={{fontFamily:UI,fontSize:12.5,color:c.t2}}>No snapshots yet — one is written the next time the deck syncs.</div>:
         <div style={{display:"flex",flexDirection:"column",gap:7,maxHeight:280,overflowY:"auto"}}>
           {snaps.map(s=><div key={s.tag} style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,background:c.bg2,border:`1px solid ${c.line}`,borderRadius:9,padding:"8px 11px"}}>
             <div style={{minWidth:0}}><div style={{fontFamily:UI,fontSize:13,color:c.t0}}>{s.label||s.tag}</div><div style={{fontFamily:MONO,fontSize:10.5,color:c.t2}}>{s.ts?new Date(s.ts).toLocaleString(undefined,{month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"}):s.tag}</div></div>
             <Btn kind="ghost" size={12} disabled={!!restoring} onClick={async()=>{if(!window.confirm(`Restore the deck to ${s.label||s.tag}? This replaces the current deck (a snapshot of the current state is saved first, so this is reversible).`))return;setRestoring(s.tag);try{await writeSnapshotNow("before-restore-"+Date.now(),"Before restore "+todayISO());await restoreSnapshot(s.tag);onToast("Restored "+(s.label||s.tag)+". Reloading…");setTimeout(()=>location.reload(),900);}catch(e){onToast("Restore failed: "+(e.message||""));setRestoring("");}}}>{restoring===s.tag?"Restoring…":"Restore"}</Btn>
           </div>)}
         </div>}
        <div style={{marginTop:10}}><Btn kind="ghost" size={12} onClick={loadSnaps}><RefreshCw size={14}/>Refresh</Btn></div>
      </>}
    </Card>
    <Card title="Device safety copies (automatic)" icon={Cloud}>
      <div style={{fontFamily:UI,fontSize:12.5,color:c.t2,lineHeight:1.5,marginBottom:11}}>{R2_KEY?"Each device saves its own private copy of the prep data (scenes, schedule, gear, notes, crew, contacts; no photos) to your cloud under its own key, refreshed on every sync. Nothing one device typed can be wiped by another device or a bad merge. If a device's deck ever looks wrong, restore its copy here. This runs silently; you don't need to do anything.":"Turn on Cloud sync above and each device keeps its own clobber-proof safety copy here."}</div>
      {R2_KEY&&<>
        {shadows===null?<div style={{fontFamily:UI,fontSize:12.5,color:c.t2}}>Loading…</div>:
         shadows.length===0?<div style={{fontFamily:UI,fontSize:12.5,color:c.t2}}>No copies yet. One is written the next time the deck syncs.</div>:
         <div style={{display:"flex",flexDirection:"column",gap:7,maxHeight:240,overflowY:"auto"}}>
           {shadows.map(s=><div key={s.id} style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,background:c.bg2,border:`1px solid ${c.line}`,borderRadius:9,padding:"8px 11px"}}>
             <div style={{minWidth:0}}><div style={{fontFamily:UI,fontSize:13,color:c.t0}}>{(s.label||"Device")}{s.id===myDev?" · this device":""}</div><div style={{fontFamily:MONO,fontSize:10.5,color:c.t2}}>{s.ts?new Date(s.ts).toLocaleString(undefined,{month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"}):s.id.slice(0,8)}</div></div>
             <Btn kind="ghost" size={12} disabled={!!restoring} onClick={async()=>{if(!window.confirm(`Restore prep data from "${s.label||"this device"}"${s.id===myDev?" (this device's last copy)":""}? It replaces the current scenes/gear/notes/schedule/crew (photos are kept as they are). A snapshot of the current deck is saved first, so this is reversible.`))return;setRestoring("sh:"+s.id);try{if(R2_KEY)await writeSnapshotNow("before-shadow-restore-"+Date.now(),"Before safety-copy restore "+todayISO());const sh=await readShadow(s.id);if(!sh||!sh.project)throw new Error("Copy not found.");await store.set("pb:project",sh.project);await store.set("pb:project_mtime",Date.now());mirrorLocal(sh.project);onToast("Restored prep from "+(s.label||"device")+". Reloading…");setTimeout(()=>location.reload(),900);}catch(e){onToast("Restore failed: "+(e.message||""));setRestoring("");}}}>{restoring==="sh:"+s.id?"Restoring…":"Restore"}</Btn>
           </div>)}
         </div>}
        <div style={{marginTop:10}}><Btn kind="ghost" size={12} onClick={loadShadows}><RefreshCw size={14}/>Refresh</Btn></div>
      </>}
    </Card>
    <Card title="Data" icon={Settings}>
      <div style={{fontFamily:UI,fontSize:12.5,color:c.t2,lineHeight:1.5,marginBottom:12}}>{HAS?"Your deck is saved locally (IndexedDB, persistent) and, with Cloud sync on, mirrored to your R2 cloud with daily snapshots above. A downloaded backup is an extra offline copy and the way to move the deck to a device that isn't on sync.":"Heads up: persistent storage isn't available here, so this session won't be saved. Download a backup."}</div>
      <div style={{display:"flex",gap:9,flexWrap:"wrap",marginBottom:8}}>
        <Btn kind="ghost" size={12} onClick={async()=>{try{onToast("Building backup…");const b=await exportFullBackup();downloadJSON(`dpdeck-backup-${todayISO()}.json`,b);await store.set("pb:lastbackup",Date.now());setLastBk(Date.now());onToast("Backup downloaded");}catch(e){onToast("Backup failed: "+(e.message||""));}}}><CloudDownload size={15}/>Download full backup</Btn>
        <label style={{cursor:"pointer"}}><Btn kind="ghost" size={12}><Upload size={15}/>Restore backup</Btn><input type="file" accept="application/json,.json" style={{display:"none"}} onChange={async e=>{const f=e.target.files[0];e.target.value="";if(!f)return;try{await importFullBackup(JSON.parse(await f.text()));await store.set("pb:project_mtime",Date.now());onToast("Backup restored. Reloading…");setTimeout(()=>location.reload(),700);}catch(err){onToast("Restore failed: "+(err.message||""));}}}/></label>
        <Btn kind="ghost" size={12} onClick={async()=>{onToast("Scanning for duplicate images…");try{const r=await dedupeImages();if(r.removed){await store.set("pb:project_mtime",Date.now());onToast(`Removed ${r.removed} duplicate image${r.removed>1?"s":""}. Reloading…`);setTimeout(()=>location.reload(),1000);}else onToast("No duplicate images found.");}catch(e){onToast("Dedupe failed: "+(e.message||""));}}}><Copy size={15}/>Remove duplicate images</Btn>
      </div>
      <div style={{fontFamily:MONO,fontSize:10.5,color:c.t2,marginBottom:14}}>{lastBk?`Last download backup: ${new Date(lastBk).toLocaleDateString()}`:"No download backup taken yet."}{R2_KEY?" · cloud snapshots: on":" · cloud snapshots: off"}</div>
      {!wipe?<Btn kind="danger" size={12} onClick={()=>setWipe(true)}><Trash2 size={15}/>Erase everything</Btn>:
        <div style={{display:"flex",gap:9,alignItems:"center",flexWrap:"wrap"}}><span style={{fontFamily:UI,fontSize:13,color:c.danger,maxWidth:340,lineHeight:1.4}}>{R2_KEY?"Erase this device's deck? A snapshot is saved to your cloud first, so you can roll it back from Version history.":"Erase all scenes, prep, and media on this device? There's no cloud snapshot to roll back to. Turn on Cloud sync first to be safe."}</span><Btn kind="danger" size={12} onClick={async()=>{try{if(R2_KEY)await writeSnapshotNow("before-erase-"+Date.now(),"Before erase "+todayISO());}catch{}for(const k of ["pb:project","pb:scriptpdf","pb:scriptpdfname","pb:doc:script","pb:doc:schedule","pb:doc:animation","pb:doc:scriptname","pb:doc:schedulename","pb:doc:animationname","pb:doccache:animation","pb:snap_day"])await store.del(k);try{localStorage.removeItem(LS_MIRROR);}catch{}location.reload();}}>Yes, erase</Btn><Btn kind="ghost" size={12} onClick={()=>setWipe(false)}>Cancel</Btn></div>}
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
  .pd-scene,.pd-loc,.pd-row,.pd-gearscene{break-inside:avoid;}
  .pd-section{break-before:page;}
  .pd-day{break-before:page;}
  .pd-day:first-child{break-before:auto;}
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
        {s.animation&&s.animation.length>0&&<div style={{marginTop:8}}><span style={sub}>Animation</span><div style={{marginTop:3}}>{s.animation.map((row,ri)=>row&&<div key={ri} style={{fontFamily:UI,fontSize:12.5,lineHeight:1.5,marginBottom:8}}>{(row.type||(row.ref&&row.ref!==s.number))&&<div style={{marginBottom:2}}>{row.type&&<b>{row.type}</b>}{row.ref&&row.ref!==s.number&&<span style={{color:P.muted,fontFamily:MONO,fontSize:11}}>{row.type?" · ":""}scene {row.ref}</span>}</div>}{row.desc&&<div style={{whiteSpace:"pre-wrap"}}>{row.desc}</div>}{row.needs&&<div style={{color:P.muted,whiteSpace:"pre-wrap",marginTop:2}}>Needs: {row.needs}</div>}{row.imgs&&row.imgs.length>0&&imgRow(row.imgs,120)}</div>)}</div></div>}
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

/* GEAR PULL: specialty gear, organized by department (each item with the scenes it is on) or by scene */
function GearSheet({project,depts,by="dept"}){
  const P={text:"#161616",muted:"#6a6a6a",line:"#dcdcdc",accent:"#8a5a00"};
  const sec={fontFamily:SERIF,fontSize:18,fontWeight:700,color:P.text,borderBottom:`2px solid ${P.text}`,paddingBottom:5,margin:"0 0 10px"};
  const selDepts=DEPTS.filter(d=>depts.includes(d.k));
  const gearById=id=>project.gear.find(g=>g.id===id);
  const usedBy=id=>project.scenes.filter(s=>s.status!=="omitted"&&(s.gearTags||[]).includes(id)).sort((a,b)=>cmpNum(a.number,b.number)).map(s=>s.number);
  const head=<div style={{marginBottom:24}}>
    <div style={{fontFamily:UI,fontSize:10,letterSpacing:"0.08em",textTransform:"uppercase",color:P.muted,fontWeight:700,marginBottom:8}}>Specialty gear pull{by==="scene"?" · by scene":""}</div>
    <div style={{fontFamily:SERIF,fontSize:32,fontWeight:700,lineHeight:1.1}}>{project.meta.title||"Untitled Film"}</div>
    <div style={{fontFamily:UI,fontSize:12,color:P.muted,marginTop:4}}>{selDepts.map(d=>d.label).join(" + ")||"No department selected"} · Generated {new Date().toLocaleDateString(undefined,{year:"numeric",month:"long",day:"numeric"})}</div>
  </div>;
  const shell=kids=><div id="print-doc" style={{maxWidth:840,margin:"0 auto",background:"#fff",color:P.text,padding:"40px 44px",fontFamily:UI,boxShadow:"0 0 0 1px #00000010"}}>{head}{kids}</div>;
  if(by==="scene"){
    const scenes=project.scenes.filter(s=>s.status!=="omitted").filter(s=>(s.gearTags||[]).some(id=>{const g=gearById(id);return g&&depts.includes(g.dept);})).sort((a,b)=>{
      const ad=a.shootDay?0:1,bd=b.shootDay?0:1;if(ad!==bd)return ad-bd;
      if(a.shootDay&&b.shootDay){const c=cmpNum(a.shootDay,b.shootDay);if(c)return c;const o=(+a.shootOrder||0)-(+b.shootOrder||0);if(o)return o;}
      return cmpNum(a.number,b.number);
    });
    return shell(scenes.length===0?<div style={{fontFamily:UI,fontSize:12.5,color:P.muted}}>No gear tagged on any scene in the selected departments.</div>:
      scenes.map(s=>{const items=(s.gearTags||[]).map(gearById).filter(g=>g&&depts.includes(g.dept));return <div key={s.number} className="pd-gearscene" style={{marginBottom:13,paddingBottom:11,borderBottom:`1px solid ${P.line}`}}>
        <div style={{display:"flex",alignItems:"baseline",gap:9,flexWrap:"wrap"}}>
          <span style={{fontFamily:MONO,fontSize:16,fontWeight:700,color:P.accent}}>{s.number}</span>
          <span style={{fontFamily:UI,fontSize:13,fontWeight:700}}>{s.slug} {s.set}</span>
          {s.dayNight&&<span style={{fontFamily:MONO,fontSize:10,color:P.muted}}>{s.dayNight}</span>}
          <span style={{flex:1}}/>
          {s.shootDay&&<span style={{fontFamily:MONO,fontSize:11,color:P.muted}}>Day {s.shootDay}{s.shootOrder?` · #${s.shootOrder}`:""}</span>}
        </div>
        <div style={{marginTop:5}}>{selDepts.map(d=>{const di=items.filter(x=>x.dept===d.k);return di.length?<div key={d.k} style={{fontFamily:UI,fontSize:12.5,lineHeight:1.6}}><b>{d.label}:</b> {di.map(x=>x.name).join(", ")}</div>:null;})}</div>
      </div>;}));
  }
  return shell(selDepts.map(d=>{const items=project.gear.filter(g=>g.dept===d.k);return <div key={d.k} className="pd-section" style={{marginBottom:22}}>
    <div style={sec}>{d.label}</div>
    {items.length===0?<div style={{fontFamily:UI,fontSize:12.5,color:P.muted}}>None on this department.</div>:
      <table style={{width:"100%",borderCollapse:"collapse"}}><tbody>
        {items.map(g=>{const ns=usedBy(g.id);return <tr key={g.id} className="pd-row" style={{borderBottom:`1px solid ${P.line}`}}>
          <td style={{padding:"7px 8px",fontFamily:UI,fontSize:13.5,fontWeight:600,verticalAlign:"top",width:"38%"}}>{g.name}</td>
          <td style={{padding:"7px 8px",fontFamily:MONO,fontSize:11,color:P.muted,verticalAlign:"top"}}>{ns.length?`${ns.length} scene${ns.length>1?"s":""}: ${ns.join(", ")}`:"unassigned"}</td>
        </tr>;})}
      </tbody></table>}
  </div>;}));
}

/* TIME OF DAY: a one-page list of every scene with an ideal shooting window noted, in shooting order.
   For the AD to schedule scenes against the sun. Only scenes that have a time-of-day note appear. */
function TimeOfDaySheet({project}){
  const P={text:"#161616",muted:"#6a6a6a",line:"#dcdcdc",accent:"#8a5a00"};
  const m=project.meta;
  const locById=id=>project.locations.find(l=>l.id===id);
  const scenes=project.scenes.filter(s=>s.status!=="omitted"&&(s.todSun||(s.tod||"").trim())).sort((a,b)=>{
    const ad=a.shootDay?0:1,bd=b.shootDay?0:1;if(ad!==bd)return ad-bd;
    if(a.shootDay&&b.shootDay){const cc=cmpNum(a.shootDay,b.shootDay);if(cc)return cc;const o=(+a.shootOrder||0)-(+b.shootOrder||0);if(o)return o;}
    return cmpNum(a.number,b.number);
  });
  const head=<div style={{marginBottom:24}}>
    <div style={{fontFamily:UI,fontSize:10,letterSpacing:"0.08em",textTransform:"uppercase",color:P.muted,fontWeight:700,marginBottom:8}}>Time of day</div>
    <div style={{fontFamily:SERIF,fontSize:32,fontWeight:700,lineHeight:1.1}}>{m.title||"Untitled Film"}</div>
    <div style={{fontFamily:UI,fontSize:12,color:P.muted,marginTop:4}}>Ideal shooting window per scene, computed from the sun for each scene's shoot date · {scenes.length} scene{scenes.length===1?"":"s"} noted · Generated {new Date().toLocaleDateString(undefined,{year:"numeric",month:"long",day:"numeric"})}</div>
  </div>;
  return <div id="print-doc" style={{maxWidth:840,margin:"0 auto",background:"#fff",color:P.text,padding:"40px 44px",fontFamily:UI,boxShadow:"0 0 0 1px #00000010"}}>
    {head}
    {scenes.length===0?<div style={{fontFamily:UI,fontSize:12.5,color:P.muted}}>No time-of-day notes yet. Open a scene, pick a sun anchor (or add a note) in the Time of day field, and it will appear here.</div>:
      <table style={{width:"100%",borderCollapse:"collapse"}}><tbody>
        {scenes.map(s=>{const l=locById(s.locationId);const w=solveTodWindow(s.todSun,s.todDeg,l&&l.lat,l&&l.lng,s.shootDate,m.tz);return <tr key={s.number} className="pd-row" style={{borderBottom:`1px solid ${P.line}`}}>
          <td style={{padding:"9px 8px",fontFamily:MONO,fontSize:14,fontWeight:700,color:P.accent,verticalAlign:"top",width:62,whiteSpace:"nowrap"}}>{s.number}</td>
          <td style={{padding:"9px 8px",verticalAlign:"top",width:"34%"}}>
            <div style={{fontFamily:UI,fontSize:13,fontWeight:700,lineHeight:1.3}}>{s.slug} {s.set}</div>
            <div style={{fontFamily:MONO,fontSize:10.5,color:P.muted,marginTop:2}}>{[s.dayNight,s.shootDay?`Day ${s.shootDay}`:"",s.shootDate||"",l?l.name:""].filter(Boolean).join(" · ")||"unscheduled"}</div>
          </td>
          <td style={{padding:"9px 8px",fontFamily:UI,fontSize:13,color:P.text,verticalAlign:"top",lineHeight:1.45}}>
            {w&&<div style={{fontWeight:700}}>{todAnchorLabel(s.todSun)}{w.ok?`: ${w.win}`:""}{w.ok&&w.extra?<span style={{fontWeight:400,color:P.muted}}> ({w.extra})</span>:""}</div>}
            {w&&!w.ok&&<div style={{fontSize:11.5,color:P.muted}}>{w.why}</div>}
            {(s.tod||"").trim()&&<div style={{whiteSpace:"pre-wrap",color:w?P.muted:P.text,marginTop:w?3:0,fontSize:w?12:13}}>{s.tod}</div>}
          </td>
        </tr>;})}
      </tbody></table>}
  </div>;
}

/* DP SIDES: a per-shoot-day crew packet: the day's schedule + sun + weather, then each scene with
   script, shots, gear, location and references. One day per page; pick a day or send them all. */
function PrintWeather({lat,lng,date}){
  const st=useWeather(lat,lng,date);
  if(st.s==="ok"){const {label}=wxMeta(st.code);return <span>{label}, {Math.round(st.hi)}°/{Math.round(st.lo)}°F{st.pr>=30?`, ${st.pr}% rain`:""}{st.wind?`, wind ${Math.round(st.wind)} mph`:""}</span>;}
  return <span style={{color:"#888"}}>{st.s==="far"?"forecast opens about 16 days out":st.s==="err"?"forecast unavailable":"checking forecast…"}</span>;
}
// Single source of truth for the per-shoot-day list (used by SidesDoc, the export day picker, and weather pre-warm).
function sidesDays(project){
  let d;
  if(project.days&&project.days.length)d=project.days.map(x=>{const seen=new Set(),nums=[];for(const n of (x.scenes||[])){const k=numKey(n);if(!seen.has(k)){seen.add(k);nums.push(String(n));}}return {day:String(x.day),date:x.date||"",nums};});  // dedupe within a day: a scene split across strips (124 pt 1/2) maps to one number, must print once per day
  else d=groupBy(project.scenes.filter(s=>s.status!=="omitted"&&String(s.shootDay||"")),s=>String(s.shootDay)).map(([day,sc])=>({day,date:(sc.find(z=>z.shootDate)||{}).shootDate||"",nums:[...sc].sort((a,b)=>(+a.shootOrder||0)-(+b.shootOrder||0)).map(z=>String(z.number))}));
  return d.filter(x=>x.day).sort((a,b)=>cmpNum(a.day,b.day));
}
// Print-safe sun-path block for DP Sides: an overhead sun-path arc + the full daily sun info
// (sunrise/sunset times AND compass bearings, golden + blue hours, solar noon, peak elevation, daylight).
// Uses print colors (SunCompass is themed for the dark UI and would not read on white paper).
function SidesSun({lat,lng,tz,date}){
  const A={text:"#161616",muted:"#6a6a6a",line:"#d4d4d4",gold:"#c8881b",accent:"#8a5a00"};
  const data=useMemo(()=>{try{
    const t=sunTimes(dayNoonUTC(date),+lat,+lng);
    const path=[];for(let mn=0;mn<=1440;mn+=15){const p=sunPos(localToAbs(date,Math.floor(mn/60),mn%60,tz),+lat,+lng);path.push({az:azC(p.az).deg,alt:p.alt*180/PI});}
    const azOf=d=>(d&&!isNaN(d))?azC(sunPos(d,+lat,+lng).az):null;
    return {t,sr:azOf(t.sunrise),ss:azOf(t.sunset),noonAlt:sunPos(t.noon,+lat,+lng).alt*180/PI,path};
  }catch{return null;}},[lat,lng,date,tz]);
  if(!data)return null;
  const {t}=data,cardOf=deg=>CARD[Math.round((((deg%360)+360)%360)/22.5)%16];
  const R=52,cx=60,cy=60,S=120;
  const pt=(deg,r)=>[cx+r*Math.sin(deg*rad),cy-r*Math.cos(deg*rad)];
  const rOf=alt=>R*(1-Math.max(0,Math.min(alt,90))/90);
  const above=data.path.filter(p=>p.alt>=-0.4);
  const ptsFor=arr=>arr.map(p=>{const [x,y]=pt(p.az,rOf(Math.max(0,p.alt)));return `${x.toFixed(1)},${y.toFixed(1)}`;}).join(" ");
  const dayPts=ptsFor(above),goldPts=ptsFor(above.filter(p=>p.alt<=6));
  const dayLen=(t.sunrise&&t.sunset&&!isNaN(t.sunrise)&&!isNaN(t.sunset))?(()=>{const mins=Math.round((t.sunset-t.sunrise)/60000);return `${Math.floor(mins/60)}h ${String(mins%60).padStart(2,"0")}m`;})():null;
  const card=(deg,tx)=>{const [x,y]=pt(deg,R+9);return <text x={x.toFixed(1)} y={(y+3).toFixed(1)} textAnchor="middle" style={{fontFamily:MONO,fontSize:8,fill:A.muted}}>{tx}</text>;};
  const Row=({l,v})=><div style={{display:"flex",gap:8}}><span style={{color:A.muted,minWidth:74}}>{l}</span><span style={{color:A.text,fontWeight:600}}>{v}</span></div>;
  return <div style={{display:"flex",gap:14,alignItems:"flex-start",flexWrap:"wrap",marginTop:6}}>
    <svg width={S} height={S} viewBox={`0 0 ${S} ${S}`} style={{flexShrink:0}}>
      <circle cx={cx} cy={cy} r={R} fill="#fafafa" stroke={A.line} strokeWidth={1}/>
      <circle cx={cx} cy={cy} r={rOf(30)} fill="none" stroke={A.line} strokeWidth={0.5}/>
      <circle cx={cx} cy={cy} r={rOf(60)} fill="none" stroke={A.line} strokeWidth={0.5}/>
      <line x1={cx-R} y1={cy} x2={cx+R} y2={cy} stroke={A.line} strokeWidth={0.5}/>
      <line x1={cx} y1={cy-R} x2={cx} y2={cy+R} stroke={A.line} strokeWidth={0.5}/>
      {dayPts&&<polyline points={dayPts} fill="none" stroke={A.accent} strokeWidth={1.6} strokeLinejoin="round"/>}
      {goldPts&&<polyline points={goldPts} fill="none" stroke={A.gold} strokeWidth={2.6} strokeLinejoin="round" strokeLinecap="round"/>}
      <circle cx={cx} cy={cy} r={2} fill={A.muted}/>
      {card(0,"N")}{card(90,"E")}{card(180,"S")}{card(270,"W")}
    </svg>
    <div style={{fontFamily:UI,fontSize:11.5,lineHeight:1.65,minWidth:210}}>
      <Row l="Sunrise" v={`${fmtT(t.sunrise,tz)}${data.sr?` · ${Math.round(data.sr.deg)}° ${data.sr.card}`:""}`}/>
      <Row l="Golden AM" v={`${fmtT(t.sunrise,tz)} to ${fmtT(t.goldEnd,tz)}`}/>
      <Row l="Solar noon" v={`${fmtT(t.noon,tz)} · sun ${Math.round(data.noonAlt)}° up`}/>
      <Row l="Golden PM" v={`${fmtT(t.goldStart,tz)} to ${fmtT(t.sunset,tz)}`}/>
      <Row l="Sunset" v={`${fmtT(t.sunset,tz)}${data.ss?` · ${Math.round(data.ss.deg)}° ${data.ss.card}`:""}`}/>
      <Row l="Blue hour" v={`${fmtT(t.dawn,tz)} AM · ${fmtT(t.dusk,tz)} PM`}/>
      {dayLen&&<Row l="Daylight" v={dayLen}/>}
    </div>
  </div>;
}
function SidesDoc({project,dayFilter}){
  const P={text:"#161616",muted:"#6a6a6a",line:"#dcdcdc",accent:"#8a5a00",soft:"#f5f2ec"};
  const m=project.meta||{};
  const sub={fontFamily:UI,fontSize:10,letterSpacing:"0.08em",textTransform:"uppercase",color:P.muted,fontWeight:700};
  const sceneByNum=new Map(project.scenes.map(s=>[numKey(s.number),s]));
  const loc=id=>project.locations.find(l=>l.id===id);
  const gearOf=s=>(s.gearTags||[]).map(id=>project.gear.find(g=>g.id===id)).filter(Boolean);
  const allDays=sidesDays(project);
  const days=(dayFilter&&dayFilter!=="all")?allDays.filter(d=>String(d.day)===String(dayFilter)):allDays;
  const imgRow=(arr,h)=>arr&&arr.length?<div style={{display:"flex",flexWrap:"wrap",gap:6,marginTop:6}}>{arr.map((v,i)=><StoredImg key={i} id={v} style={{height:h,maxWidth:"31%",objectFit:"cover",border:`1px solid ${P.line}`,borderRadius:4,background:P.soft}}/>)}</div>:null;
  return <div id="print-doc" style={{maxWidth:840,margin:"0 auto",background:"#fff",color:P.text,padding:"40px 44px",fontFamily:UI,boxShadow:"0 0 0 1px #00000010"}}>
    {days.length===0&&<div style={{fontFamily:UI,fontSize:13,color:P.muted}}>{allDays.length?"That shoot day has no scenes. Pick another day, or choose All shoot days.":"No shoot days scheduled yet. Add a schedule in Settings, under Import."}</div>}
    {days.map((day,di)=>{
      const scenes=day.nums.map(n=>sceneByNum.get(numKey(n))).filter(Boolean).filter(s=>s.status!=="omitted");
      const dloc=dayLocation(scenes,project.locations);
      const dt=day.date?new Date(day.date+"T12:00"):null;
      const gear=Object.fromEntries(DEPTS.map(d=>[d.k,new Set()]));scenes.forEach(s=>gearOf(s).forEach(g=>{if(gear[g.dept])gear[g.dept].add(g.name);}));
      const eighths=scenes.reduce((a,s)=>a+(+s.eighths||0),0);
      return <div key={day.day+"_"+di} className="pd-day">
        <div style={{borderBottom:`2px solid ${P.text}`,paddingBottom:8,marginBottom:12}}>
          <div style={{display:"flex",alignItems:"baseline",gap:12,flexWrap:"wrap"}}>
            <span style={{fontFamily:SERIF,fontSize:26,fontWeight:700}}>Day {day.day}</span>
            {dt&&<span style={{fontFamily:UI,fontSize:14,color:P.muted}}>{dt.toLocaleDateString(undefined,{weekday:"long",month:"long",day:"numeric"})}</span>}
            <span style={{flex:1}}/>
            <span style={{fontFamily:MONO,fontSize:12,color:P.muted}}>{scenes.length} scene{scenes.length===1?"":"s"}{eighths?` · ${fmtEighths(eighths)} pg`:""}</span>
          </div>
          <div style={{fontFamily:UI,fontSize:11.5,color:P.muted,marginTop:5}}>{m.title||"Untitled Film"}{dloc?` · ${dloc.name}`:""}</div>
          {dloc&&dloc.lat!=null&&dloc.lat!==""&&day.date&&<div style={{marginTop:6}}>
            <div style={{fontFamily:UI,fontSize:11.5,color:P.text}}><b>Weather:</b> <PrintWeather lat={dloc.lat} lng={dloc.lng} date={day.date}/></div>
            <SidesSun lat={dloc.lat} lng={dloc.lng} tz={m.tz} date={day.date}/>
          </div>}
        </div>
        {DEPTS.some(d=>gear[d.k].size)&&<div style={{marginBottom:12}}><span style={sub}>Gear this day</span><div style={{marginTop:3}}>{DEPTS.map(d=>gear[d.k].size?<div key={d.k} style={{fontFamily:UI,fontSize:12,lineHeight:1.55}}><b>{d.label}:</b> {[...gear[d.k]].join(", ")}</div>:null)}</div></div>}
        {(()=>{const dl=[...new Set(scenes.map(s=>s.locationId).filter(Boolean))].map(id=>project.locations.find(l=>l.id===id)).filter(l=>l&&l.images&&l.images.length);return dl.length?<div style={{marginBottom:14}}>{dl.map(l=><div key={l.id} style={{marginBottom:8}}><span style={sub}>{l.name} · location photos</span>{imgRow((l.images||[]).slice(0,6),120)}</div>)}</div>:null;})()}
        {scenes.map((s,si)=>{const l=loc(s.locationId);const g=gearOf(s);return <div key={s.number+"_"+si} className="pd-scene" style={{marginBottom:16,paddingBottom:13,borderBottom:`1px solid ${P.line}`}}>
          <div style={{display:"flex",alignItems:"baseline",gap:9,flexWrap:"wrap"}}>
            {s.shootOrder?<span style={{fontFamily:MONO,fontSize:11,color:P.muted}}>#{s.shootOrder}</span>:null}
            <span style={{fontFamily:MONO,fontSize:18,fontWeight:700,color:P.accent}}>{s.number}</span>
            <span style={{fontFamily:UI,fontSize:13.5,fontWeight:700}}>{s.slug} {s.set}</span>
            {s.dayNight&&<span style={{fontFamily:MONO,fontSize:11,color:P.muted}}>{s.dayNight}</span>}
            <span style={{flex:1}}/>
            {s.eighths>0&&<span style={{fontFamily:MONO,fontSize:11,color:P.muted}}>{fmtEighths(s.eighths)} pg</span>}
          </div>
          {l&&<div style={{fontFamily:UI,fontSize:11.5,color:P.muted,marginTop:2}}>Location: {l.name}</div>}
          {s.syn&&<div style={{fontFamily:SERIF,fontSize:13,lineHeight:1.5,marginTop:6}}>{s.syn}</div>}
          {s.scriptText&&<div style={{marginTop:6}}><span style={sub}>Script</span><div style={{marginTop:3}}><ScreenplayText text={s.scriptText} base={P.text} strong={P.text} dim={P.muted} size={10}/></div></div>}
          {s.notes&&<div style={{marginTop:6}}><span style={sub}>Notes</span><div style={{fontFamily:UI,fontSize:12,lineHeight:1.5,marginTop:3,whiteSpace:"pre-wrap"}}>{s.notes}</div></div>}
          {s.animation&&s.animation.length>0&&<div style={{marginTop:6}}><span style={sub}>Animation</span><div style={{marginTop:3}}>{s.animation.map((row,ri)=>row&&<div key={ri} style={{fontFamily:UI,fontSize:12,lineHeight:1.5,marginBottom:7}}>{(row.type||(row.ref&&row.ref!==s.number))&&<div style={{marginBottom:2}}>{row.type&&<b>{row.type}</b>}{row.ref&&row.ref!==s.number&&<span style={{color:P.muted,fontFamily:MONO,fontSize:10}}>{row.type?" · ":""}scene {row.ref}</span>}</div>}{row.desc&&<div style={{whiteSpace:"pre-wrap"}}>{row.desc}</div>}{row.needs&&<div style={{color:P.muted,whiteSpace:"pre-wrap",marginTop:2}}>Needs: {row.needs}</div>}{row.imgs&&row.imgs.length>0&&imgRow(row.imgs,90)}</div>)}</div></div>}
          {(()=>{const w=solveTodWindow(s.todSun,s.todDeg,l&&l.lat,l&&l.lng,day.date,m.tz);if(!w&&!(s.tod||"").trim())return null;return <div style={{marginTop:6}}><span style={sub}>Time of day</span><div style={{fontFamily:UI,fontSize:12,lineHeight:1.5,marginTop:3}}>
            {w&&w.ok&&<div style={{fontWeight:700}}>{todAnchorLabel(s.todSun)}: {w.win}{w.extra?<span style={{fontWeight:400,color:P.muted}}> ({w.extra})</span>:""}</div>}
            {w&&!w.ok&&<div style={{color:P.muted}}>{todAnchorLabel(s.todSun)}: {w.why}</div>}
            {(s.tod||"").trim()&&<div style={{whiteSpace:"pre-wrap",color:w?P.muted:P.text,marginTop:w?2:0}}>{s.tod}</div>}
          </div></div>;})()}
          {s.shots.length>0&&<div style={{marginTop:6}}><span style={sub}>Shots</span><div style={{marginTop:3}}>{s.shots.map((sh,i)=><div key={sh.id} style={{fontFamily:UI,fontSize:12,lineHeight:1.5,display:"flex",gap:7}}><span style={{color:P.muted,fontFamily:MONO,fontSize:10,minWidth:16}}>{i+1}.</span><span>{sh.text}</span></div>)}</div></div>}
          {g.length>0&&<div style={{marginTop:6}}><span style={sub}>Gear</span><div style={{marginTop:3}}>{DEPTS.map(d=>{const di=g.filter(x=>x.dept===d.k);return di.length?<div key={d.k} style={{fontFamily:UI,fontSize:12,lineHeight:1.55}}><b>{d.label}:</b> {di.map(x=>x.name).join(", ")}</div>:null;})}</div></div>}
          {s.refs.length>0&&<div style={{marginTop:6}}><span style={sub}>Reference</span>{imgRow(s.refs,110)}</div>}
        </div>;})}
      </div>;
    })}
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
  const setLookNotes=v=>setProject(p=>({...p,lookNotes:v}));
  const addImages=async files=>{const ids=[];for(const f of files){if(!f.type?.startsWith("image/"))continue;try{ids.push(await putImage(await downscale(f)));}catch{}}if(ids.length)setLook(l=>[...l,...ids]);};
  const onDrop=async e=>{e.preventDefault();e.stopPropagation();setDrag(false);const dt=e.dataTransfer;const files=[...(dt.files||[])].filter(f=>f.type.startsWith("image/"));if(files.length)return addImages(files);let url=(dt.getData("text/uri-list")||"").split("\n").find(l=>l&&!l.startsWith("#"))||"";if(!url){const h=dt.getData("text/html")||"";const m=h.match(/<img[^>]+src=["']([^"']+)["']/i);if(m)url=m[1];}url=(url||"").trim();if(isImgUrl(url)){setLook(l=>[...l,url]);onToast&&onToast("Reference added to the look");}else onToast&&onToast("Couldn't read that drop. Save the image, then drag the file in.");};
  return <div>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14,flexWrap:"wrap",gap:10}}>
      <span style={{fontFamily:UI,fontSize:13.5,color:c.t1,lineHeight:1.5,maxWidth:640}}>The look. Top-level visual references for the whole film: palette, lensing, light. These sit above any one scene. Drop images, paste a URL, or upload.</span>
      <Btn kind="primary" size={12} onClick={()=>fileRef.current.click()}><Upload size={15}/>Add</Btn>
      <input ref={fileRef} type="file" accept="image/*" multiple style={{display:"none"}} onChange={e=>{addImages([...e.target.files]);e.target.value="";}}/>
    </div>
    <div style={{marginBottom:16}}>
      <Label style={{marginBottom:6}}>Look notes</Label>
      <TextArea value={project.lookNotes||""} placeholder="Overall notes on the look: palette, lensing, light, references, grade direction, anything that holds across scenes…" onChange={e=>setLookNotes(e.target.value)} style={{minHeight:90}}/>
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

/* DOCUMENTS — the ground-truth current PDFs (script + schedule), viewable full-screen */
function Documents({openPdf,onToast}){
  const [,tick]=useState(0);
  useEffect(()=>{let on=true;Promise.all([ensureDoc("script"),ensureDoc("schedule")]).then(()=>on&&tick(x=>x+1));return()=>{on=false;};},[]);// animation is cloud-backed (1.83MB) — don't eagerly download it; the card's Open loads it on demand
  const load=slot=>async file=>{if(!file)return;try{onToast&&onToast("Loading "+DOC_LABEL[slot]+"…");await saveDoc(slot,await file.arrayBuffer(),file.name);tick(x=>x+1);onToast&&onToast(DOC_LABEL[slot]+" loaded · syncs to your other devices");}catch(e){onToast&&onToast("Couldn't load that PDF");}};
  const Slot=({slot,icon:Icon,desc,cloud})=>{const loaded=!!docs[slot].doc,name=docs[slot].name;return (
    <Card title={DOC_LABEL[slot]} icon={Icon}>
      <div style={{fontFamily:UI,fontSize:12.5,color:c.t2,lineHeight:1.5,marginBottom:11}}>{desc}</div>
      <div style={{display:"flex",gap:9,alignItems:"center",flexWrap:"wrap"}}>
        <Btn kind="primary" size={12} disabled={!loaded&&!cloud} onClick={()=>openPdf({slot,start:1,title:DOC_LABEL[slot]})}><BookOpen size={15}/>{loaded||cloud?"Open":"Not loaded"}</Btn>
        {cloud?<span style={{fontFamily:MONO,fontSize:11,color:c.t2}}>Stored in cloud · loads on open</span>:<label style={{cursor:"pointer"}}><Btn kind="ghost" size={12}><Upload size={14}/>{loaded?"Replace PDF":"Load PDF"}</Btn><input type="file" accept="application/pdf" style={{display:"none"}} onChange={e=>{const f=e.target.files[0];e.target.value="";load(slot)(f);}}/></label>}
        {loaded&&name&&<span style={{fontFamily:MONO,fontSize:11,color:c.t2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:240}}>{name}</span>}
      </div>
    </Card>);};
  return <div style={{maxWidth:720,margin:"0 auto",display:"flex",flexDirection:"column",gap:14}}>
    <div style={{fontFamily:UI,fontSize:13.5,color:c.t1,lineHeight:1.55,maxWidth:640}}>The ground-truth current documents. Open any full-screen and flip pages with the arrows (or swipe). They travel with the deck, so once loaded they show on every synced device.</div>
    <Slot slot="script" icon={FileText} desc="The current screenplay PDF. Also drives the per-scene script pages and the expand button in each scene."/>
    <Slot slot="schedule" icon={Calendar} desc="The current one-liner / shooting schedule PDF."/>
    <Slot slot="animation" icon={Film} cloud desc="The claymation & animation breakdown (per-scene description, needs & storyboards). The book icon in each animation scene opens it here too. Stored in cloud storage to keep the deck light, so it loads when you open it."/>
  </div>;
}

/* APP */
const DEFAULT_PROJECT=()=>({meta:{title:"Untitled Film",baseName:"",baseLat:"",baseLng:"",avgKmh:28,tz:(Intl.DateTimeFormat().resolvedOptions().timeZone)||"UTC",theme:"dark"},scenes:[],days:[],locations:[],crew:{camera:[],grip:[],electric:[]},contacts:[],gear:[],inbox:[],look:[],lookNotes:""});
function normalizeProject(p){
  if(!p||typeof p!=="object")p=DEFAULT_PROJECT();
  p.meta={...DEFAULT_PROJECT().meta,...(p.meta||{})};
  p.scenes=(p.scenes||[]).map(s=>{const m={...emptyScene(s.number),...s};for(const k of ["refs","shots","gearTags","sketches","aiGear","animation"])if(!Array.isArray(m[k]))m[k]=[];m.number=String(m.number??"");m.shootDay=m.shootDay==null?"":String(m.shootDay);return m;}); // coerce number/shootDay so an external/AI deck with numeric values can't crash sorts
  p.locations=(p.locations||[]).map(l=>({...l,images:l.images||[],plans:l.plans||[]}));
  p.crew={camera:[],grip:[],electric:[],sfx:[],...(p.crew||{})};
  p.contacts=p.contacts||[];p.gear=p.gear||[];p.inbox=p.inbox||[];p.look=p.look||[];p.lookNotes=p.lookNotes||"";p.days=Array.isArray(p.days)?p.days:[];
  p.events=Array.isArray(p.events)?p.events:[];  // non-shoot calendar events (readings, recce, etc.): {id,title,start,end}
  return p;
}
const NAV=[
  {k:"home",label:"Home",icon:Home},
  {k:"days",label:"Schedule",icon:Calendar},
  {k:"scenes",label:"Scenes",icon:Film},
  {k:"look",label:"Look",icon:ImageIcon},
  {k:"locations",label:"Locations",icon:MapPin},
  {k:"crew",label:"Crew",icon:Users},
  {k:"gear",label:"Gear",icon:Wrench},
  {k:"export",label:"Export PDF",icon:Printer},
  {k:"settings",label:"Settings",icon:Settings},
];  // Docs + Import live inside Settings; Capture is replaced by the in-app viewfinder.
const MOBILE_NAV=["home","scenes","days","locations"];

export default function App(){
  const [project,setProject]=useState(null);
  const [view,setView]=useState("scenes");
  const [activeScene,setActiveScene]=useState(null);
  const [lens,setLens]=useState("story");
  // PWA auto-update: when a newly deployed service worker takes control, reload once so the latest
  // version shows on this relaunch instead of leaving a stale cached bundle. Skips first install (no
  // controller yet) and guards against reload loops. Fixes "I reopened but still see the old layout".
  useEffect(()=>{if(!("serviceWorker"in navigator)||!navigator.serviceWorker.controller)return;let done=false;const onCtrl=()=>{if(done)return;done=true;location.reload();};navigator.serviceWorker.addEventListener("controllerchange",onCtrl);return()=>navigator.serviceWorker.removeEventListener("controllerchange",onCtrl);},[]);
  const [ink,setInk]=useState(null);
  const [vf,setVf]=useState(null);
  const [light,setLight]=useState(null);
  const [toast,setToast]=useState(null);
  const [tb,setTb]=useState(0);
  const [info,setInfo]=useState(null);
  const [more,setMore]=useState(false);
  const [jump,setJump]=useState(false);
  const [exp,setExp]=useState({mode:"full",depts:DEPTS.map(d=>d.k),gearBy:"dept",day:"all"});
  const [pdfv,setPdfv]=useState(null);
  const [focusLoc,setFocusLoc]=useState(null);
  const [hasKey,setHasKey]=useState(false);
  const [sync,setSync]=useState({state:"off",at:0}); // off|idle|pending|syncing|synced|error
  const wide=useWide();
  const loaded=useRef(false);
  const pulling=useRef(false),skipPush=useRef(false),pushTimer=useRef(null),dirty=useRef(false),nudged=useRef(false),needReload=useRef(false),syncBusy=useRef(false),needReloadBase=useRef(undefined);
  const projectRef=useRef(null);projectRef.current=project;   // latest in-memory project, for flush + during-sync fold
  const persistTimer=useRef(null);
  // Adopt the store's project into React state after a merge/pull. If the user edited DURING the sync
  // round-trip, 3-way fold that edit (live vs the pre-sync snapshot) into the merged store so no keystroke is lost.
  const reloadFromStore=useCallback(async(syncStartProject)=>{
    clearTimeout(persistTimer.current);                       // cancel any pending stale persist before adopting
    let proj=await store.get("pb:project");
    const live=projectRef.current;
    if(syncStartProject!==undefined&&live&&live!==syncStartProject){
      proj=mergeProjects(syncStartProject,live,proj);         // fold the during-sync edit back in (ancestor = pre-sync)
      await store.set("pb:project",proj);await store.set("pb:project_mtime",Date.now());dirty.current=true;
      setProject(normalizeProject(proj));setTb(b=>b+1);       // no skipPush -> the debounce republishes the folded edit
    }else{
      skipPush.current=true;setProject(normalizeProject(proj));setTb(b=>b+1);
    }
  },[]);
  // Merge-aware push: flush the latest in-memory edits to the store FIRST (so a merge can't miss them), then
  // push. pushDeckToCloud may merge cloud changes in; if it did, re-sync the UI from the merged store.
  const syncPush=useCallback(async()=>{
    const startProj=projectRef.current;
    if(startProj){try{await store.set("pb:project",startProj);}catch{}}
    const r=await pushDeckToCloud();
    if(r&&r.merged){if(typeof document!=="undefined"&&document.visibilityState==="hidden"){needReload.current=true;needReloadBase.current=startProj;}else await reloadFromStore(startProj);}
    return r;
  },[reloadFromStore]);

  useEffect(()=>{(async()=>{
    try{if(navigator.storage&&navigator.storage.persist)await navigator.storage.persist();}catch{}
    loadAIKey();await loadR2Key();
    const keyed=!!R2_KEY;setHasKey(keyed);
    const localSynced0=(await store.get("pb:synced_ts"))||0,localMtime0=(await store.get("pb:project_mtime"))||0;
    const hasLocalEdits=localMtime0>localSynced0; // unsynced local work — a pull must NEVER clobber it
    let pulled=false;
    // Auto-pull on open ONLY when this device has no unsynced edits; otherwise we would revert the user's work.
    if(keyed){try{
      setSync({state:"syncing",at:Date.now()});
      const meta=await remoteDeckMeta();
      if(meta&&meta.ts&&meta.ts>localSynced0&&!hasLocalEdits){pulling.current=true;await pullDeckFromCloud();pulling.current=false;pulled=true;}
      setSync({state:"synced",at:Date.now()});
    }catch{pulling.current=false;setSync({state:"error",at:Date.now()});}}
    let p=normalizeProject(await store.get("pb:project"));
    // REDUNDANCY: if IndexedDB was wiped/corrupted (came back empty) but the localStorage mirror still holds the
    // deck, recover from it. Deliberately conservative: only fires when IDB has NO scenes, so it can never roll a
    // good IDB deck (or a freshly-pulled cloud deck) backward. The mirror is cleared on a deliberate Erase.
    try{const mir=readMirror();
      if(!pulled&&!(p.scenes&&p.scenes.length)&&mir&&mir.project&&Array.isArray(mir.project.scenes)&&mir.project.scenes.length){
        p=normalizeProject(mir.project);
        await store.set("pb:project",mir.project);await store.set("pb:project_mtime",mir.mtime||Date.now());
      }
    }catch{}
    applyTheme(p.meta.theme);setProject(p);mirrorLocal(p);   // seed the localStorage mirror on load so it protects from the first moment, not only after the first edit
    setView(p.scenes.length?"home":"import");
    restoreScriptPDF().then(()=>setTb(b=>b+1));
    setTimeout(()=>{loaded.current=true;
      // Push stranded local edits from a previous session right away so they reach the cloud.
      if(hasLocalEdits&&R2_KEY&&!pulling.current){dirty.current=true;syncPush().then(()=>{dirty.current=false;setSync({state:"synced",at:Date.now()});}).catch(()=>{});}
    },60);
    if(R2_KEY)setTimeout(()=>backupSceneImages(),8000);          // mirror referenced image blobs to R2 a few seconds after load (durable image backup)
  })();},[]);

  // Auto-push: debounced cloud sync after local edits (only when a worker key is set).
  useEffect(()=>{
    if(!loaded.current||!project||!R2_KEY)return;
    if(skipPush.current){skipPush.current=false;return;}
    store.set("pb:project_mtime",Date.now());
    dirty.current=true;
    setSync({state:"pending",at:Date.now()});
    clearTimeout(pushTimer.current);
    const fire=async()=>{
      if(syncBusy.current||pulling.current){pushTimer.current=setTimeout(fire,1500);return;}  // a sync is in flight -> retry soon; NEVER drop the edit (syncPush flushes the latest project)
      syncBusy.current=true;setSync({state:"syncing",at:Date.now()});
      try{await syncPush();dirty.current=false;setSync({state:"synced",at:Date.now()});}catch(e){setSync({state:(e&&e.code==="SYNC_SHRINK_GUARD")?"blocked":"error",at:Date.now()});}
      finally{syncBusy.current=false;}
    };
    pushTimer.current=setTimeout(fire,5000);
    return()=>clearTimeout(pushTimer.current);
  },[project]);

  // Fully automatic BOTH-WAY sync — hands-off. A background poll (every 12s while visible) + focus +
  // visibility cover every case with no manual action: another device's edits pull in on their own;
  // when both devices edited, it MERGES (pull+merge+push) so nothing is ever lost; ours push on the
  // 5s debounce. A reconcile is in flight at most once at a time (busy guard).
  useEffect(()=>{
    let pollTimer=null;
    const reconcile=async(opts={})=>{
      if(needReload.current){needReload.current=false;const nb=needReloadBase.current;needReloadBase.current=undefined;await reloadFromStore(nb);}  // adopt a merge that landed while hidden, folding in any edit made during that window
      if(!R2_KEY||pulling.current||syncBusy.current)return;
      syncBusy.current=true;
      try{
        const meta=await remoteDeckMeta();
        const localSynced=(await store.get("pb:synced_ts"))||0,localMtime=(await store.get("pb:project_mtime"))||0;
        const hasLocal=localMtime>localSynced||dirty.current;
        const remoteNewer=!!(meta&&meta.ts&&meta.ts>localSynced);
        // One path for everything: syncPush pulls+merges, adopts-without-push when we only pull (no ping-pong),
        // and folds any edit made DURING the round-trip (reloadFromStore vs the pre-sync snapshot). A passive
        // poll with only-local edits is left to the debounce; focus/flush (pushLocal) recovers stranded local edits.
        if(remoteNewer||(hasLocal&&opts.pushLocal)){
          clearTimeout(pushTimer.current);setSync({state:"syncing",at:Date.now()});
          try{await syncPush();dirty.current=false;setSync({state:"synced",at:Date.now()});}catch(e){setSync({state:(e&&e.code==="SYNC_SHRINK_GUARD")?"blocked":"error",at:Date.now()});}
        }
      }catch{}
      finally{syncBusy.current=false;}
    };
    const tick=()=>{if(typeof document==="undefined"||document.visibilityState==="visible")reconcile();};
    const startPoll=()=>{if(pollTimer)return;pollTimer=setInterval(tick,12000);};
    const stopPoll=()=>{if(pollTimer){clearInterval(pollTimer);pollTimer=null;}};
    const onFocus=()=>reconcile({pushLocal:true});
    // Persist the latest in-memory project locally on EVERY close, key or no key (the cloud push stays key-gated).
    // Without this a non-keyed device loses edits made within the 600ms persist debounce when the tab is closed;
    // also writes the localStorage mirror so the work survives even an IndexedDB eviction.
    const flushLocal=()=>{const pr=projectRef.current;if(!pr)return;clearTimeout(persistTimer.current);try{store.set("pb:project",pr);}catch{}mirrorLocal(pr);};
    const onVis=()=>{
      if(document.visibilityState==="visible"){reconcile({pushLocal:true});startPoll();}
      else{stopPoll();flushLocal();if(R2_KEY&&dirty.current&&!pulling.current){clearTimeout(pushTimer.current);syncPush().catch(()=>{});}}
    };
    const onHide=()=>{stopPoll();flushLocal();if(R2_KEY&&dirty.current&&!pulling.current){clearTimeout(pushTimer.current);syncPush().catch(()=>{});}};
    window.addEventListener("focus",onFocus);document.addEventListener("visibilitychange",onVis);window.addEventListener("pagehide",onHide);window.addEventListener("beforeunload",flushLocal);
    if(typeof document==="undefined"||document.visibilityState==="visible")startPoll();
    return()=>{window.removeEventListener("focus",onFocus);document.removeEventListener("visibilitychange",onVis);window.removeEventListener("pagehide",onHide);window.removeEventListener("beforeunload",flushLocal);stopPoll();};
  },[]);

  useEffect(()=>{if(!loaded.current||!project||needReload.current)return;clearTimeout(persistTimer.current);persistTimer.current=setTimeout(()=>{store.set("pb:project",project);mirrorLocal(project);},600);return()=>clearTimeout(persistTimer.current);},[project]);

  useEffect(()=>{const h=e=>{const tag=((e.target&&e.target.tagName)||"").toLowerCase();const typing=tag==="input"||tag==="textarea"||(e.target&&e.target.isContentEditable);if(e.key==="k"&&(e.metaKey||e.ctrlKey)){e.preventDefault();setJump(j=>!j);}else if(e.key==="/"&&!typing){e.preventDefault();setJump(true);}};window.addEventListener("keydown",h);return()=>window.removeEventListener("keydown",h);},[]);

  const toastFn=useCallback((msg,action)=>setToast({msg,action,id:uid()}),[]);
  const patchScene=useCallback((number,patch)=>setProject(p=>({...p,scenes:p.scenes.map(s=>s.number===number?{...s,...patch,_mt:Date.now()}:s)})),[]);
  const addSceneRefs=useCallback((number,ids)=>setProject(p=>({...p,scenes:p.scenes.map(s=>s.number===number?{...s,refs:[...s.refs,...ids],_mt:Date.now()}:s)})),[]);// functional append so multiple viewfinder snaps don't clobber earlier ones
  const tagGear=useCallback((number,name,dept)=>setProject(p=>{let g=p.gear.find(x=>x.name.toLowerCase()===name.toLowerCase()&&x.dept===dept),gear=p.gear;if(!g){g={id:uid(),name,dept};gear=[...p.gear,g];}return {...p,gear,scenes:p.scenes.map(s=>s.number===number?(s.gearTags.includes(g.id)?s:{...s,gearTags:[...s.gearTags,g.id]}):s)};}),[]);
  const openLightbox=useCallback((items,i=0)=>setLight({items:(Array.isArray(items)?items:[items]).filter(Boolean),i}),[]);
  const sendRefBetween=useCallback((fromN,imgId,toN,mode)=>setProject(p=>({...p,scenes:p.scenes.map(s=>{
    if(s.number===toN)return s.refs.includes(imgId)?s:{...s,refs:[...s.refs,imgId]};
    if(mode==="move"&&s.number===fromN)return {...s,refs:s.refs.filter(x=>x!==imgId)};
    return s;
  })})),[]);
  const openPdf=useCallback(v=>setPdfv(v),[]);
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
  // One-shot safety nudge: only when this device has work but no cloud safety net (no key + stale/no backup).
  useEffect(()=>{
    if(!project||nudged.current)return;nudged.current=true;
    setTimeout(async()=>{
      if(R2_KEY)return; // cloud snapshots already cover safety
      if(!(project.scenes||[]).some(s=>s.status!=="omitted"))return;
      const last=(await store.get("pb:lastbackup"))||0;
      if(((Date.now()-last)/864e5)>=10)toastFn("This deck is only on this device. Turn on Cloud sync in Settings, or download a backup, so you don't lose work.");
    },2500);
  },[project]);

  if(!project)return <div style={{position:"fixed",inset:0,background:c.bg0,display:"grid",placeItems:"center"}}><div style={{fontFamily:MONO,color:c.accent,fontSize:13}}>Loading deck…</div></div>;

  const present=project.scenes.filter(s=>s.status!=="omitted").sort((a,b)=>cmpScene(a,b,lens));
  const openScene=key=>{if(typeof key==="string"&&key.startsWith("__loc__")){setFocusLoc(key.slice(7)||null);setView("locations");return;}setActiveScene(key);setView("scene");};
  const curScene=project.scenes.find(s=>s.number===activeScene);
  let neighbors=null;
  if(curScene){const i=present.findIndex(s=>s.number===curScene.number);neighbors={prev:i>0?present[i-1].number:null,next:i>=0&&i<present.length-1?present[i+1].number:null};}
  const saveInfo=f=>{const {__new,...d}=f;setProject(p=>{if(info.__new){if(!d.number)return p;return {...p,scenes:[...p.scenes,{...emptyScene(d.number,d),...d,_mt:Date.now()}]};}return {...p,scenes:p.scenes.map(s=>s.number===info.number?{...s,...d,_mt:Date.now()}:s)};});};
  const delScene=number=>{setProject(p=>({...p,scenes:p.scenes.filter(s=>s.number!==number)}));if(activeScene===number){setView("scenes");setActiveScene(null);}};
  const collapsed=!!project.meta.navCollapsed;
  const toggleNav=()=>setProject(p=>({...p,meta:{...p.meta,navCollapsed:!p.meta.navCollapsed}}));
  const sbLoc=curScene&&project.locations.find(l=>l.id===curScene.locationId);
  const sceneCycle=()=>{if(!curScene)return;const i=STATUS.findIndex(x=>x.k===curScene.status);patchScene(curScene.number,{status:STATUS[(i+1)%STATUS.length].k});};

  const Nav=wide?(
    <div data-noprint style={{width:collapsed?60:188,flexShrink:0,borderRight:`1px solid ${c.line}`,background:c.panel,display:"flex",flexDirection:"column",padding:collapsed?"14px 8px":"14px 12px",gap:3,height:"100vh",position:"sticky",top:0}}>
      <div style={{padding:collapsed?"4px 0 14px":"4px 4px 14px",display:"flex",alignItems:"center",justifyContent:collapsed?"center":"space-between",gap:8}}>
        {!collapsed&&<div style={{display:"flex",alignItems:"center",gap:9,minWidth:0}}><div style={{width:26,height:26,borderRadius:7,background:c.accent,display:"grid",placeItems:"center",flexShrink:0}}><Film size={15} color="#17120a"/></div><div style={{fontFamily:UI,fontSize:14,fontWeight:800,letterSpacing:"0.04em",color:c.t0}}>DP DECK</div></div>}
        <IconBtn icon={collapsed?ChevronRight:ChevronLeft} size={16} dim title={collapsed?"Expand menu":"Collapse menu"} onClick={toggleNav}/>
      </div>
      {NAV.map(n=>{const on=view===n.k||(n.k==="scenes"&&view==="scene");return <button key={n.k} title={n.label} onClick={()=>{setView(n.k);setMore(false);}} style={{display:"flex",alignItems:"center",justifyContent:collapsed?"center":"flex-start",gap:11,padding:collapsed?"11px 0":"10px 11px",borderRadius:9,border:"none",background:on?c.accentSoft:"transparent",color:on?c.accent:c.t1,cursor:"pointer",fontFamily:UI,fontSize:13.5,fontWeight:on?700:550,textAlign:"left"}}><n.icon size={18}/>{!collapsed&&n.label}</button>;})}
      <div style={{flex:1}}/>
      {!collapsed&&<div style={{padding:"8px 11px",fontFamily:UI,fontSize:11.5,color:c.t2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{project.meta.title}</div>}
    </div>
  ):null;

  const TopBar=(
    <div data-noprint style={{display:"flex",alignItems:"center",gap:10,paddingTop:`max(env(safe-area-inset-top), ${wide?14:11}px)`,paddingBottom:`${wide?14:11}px`,paddingLeft:`max(env(safe-area-inset-left), ${wide?22:14}px)`,paddingRight:`max(env(safe-area-inset-right), ${wide?22:14}px)`,borderBottom:`1px solid ${c.line}`,background:c.bg0,position:"sticky",top:0,zIndex:40}}>
      {!wide&&<div style={{display:"flex",alignItems:"center",gap:8}}><div style={{width:24,height:24,borderRadius:6,background:c.accent,display:"grid",placeItems:"center"}}><Film size={14} color="#17120a"/></div></div>}
      <div style={{display:"flex",gap:2}}>
        <IconBtn icon={ArrowLeft} onClick={goBack} dim title="Back to last screen" style={{opacity:canBack?1:0.3,width:wide?40:34}}/>
        <IconBtn icon={ArrowRight} onClick={goFwd} dim title="Forward" style={{opacity:canFwd?1:0.3,width:wide?40:34}}/>
      </div>
      {/* CENTER: page identity (scene chips when on a scene, otherwise the page title). It flex-grows and
          truncates, so it NEVER pushes the control cluster — the controls stay put on every page. */}
      <div style={{flex:"1 1 auto",minWidth:0,display:"flex",alignItems:"center",gap:8,overflow:"hidden"}}>
        {wide&&view==="scene"&&curScene?<>
          <span style={{fontFamily:MONO,fontSize:20,fontWeight:700,color:c.accent,letterSpacing:"-0.5px",flexShrink:0}}>{curScene.number}</span>
          {curScene.slug&&<Tag label={curScene.slug} color={slugColor(curScene.slug)}/>}
          {curScene.dayNight&&<Tag label={curScene.dayNight} color={dnColor(curScene.dayNight)}/>}
          {curScene.eighths>0&&<Tag label={fmtEighths(curScene.eighths)+" pg"} color={c.t2}/>}
          <StatusPill status={curScene.status==="omitted"?"todo":curScene.status} onCycle={sceneCycle}/>
          {curScene.shootDay?<Chip color={c.accent} active><Calendar size={11}/>Day {curScene.shootDay}{curScene.shootOrder?` · #${curScene.shootOrder}`:""}</Chip>:<Chip color={c.t2}>unscheduled</Chip>}
          {sbLoc&&<Chip color={c.t1} onClick={()=>openScene("__loc__"+sbLoc.id)}><MapPin size={11}/>{sbLoc.name.length>22?sbLoc.name.slice(0,21)+"…":sbLoc.name}</Chip>}
        </>:<div style={{minWidth:0,fontFamily:UI,fontSize:wide?18:15,fontWeight:800,color:c.t0,letterSpacing:"-0.2px",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{view==="scene"?(curScene?`Scene ${curScene.number}`:"Scene"):(TITLES[view]||project.meta.title)}</div>}
      </div>
      {/* FIXED CONTROL CLUSTER: identical order + position on every page (jump / sync / theme are pinned to
          the right edge; the Story↔Shooting toggle sits in the same slot whenever it applies). */}
      <div style={{display:"flex",alignItems:"center",gap:8,flexShrink:0}}>
        {wide&&view==="scene"&&curScene&&neighbors&&<div style={{display:"flex",gap:2}}><IconBtn icon={ChevronLeft} size={18} onClick={()=>neighbors.prev&&openScene(neighbors.prev)} dim title="Previous scene" style={{opacity:neighbors.prev?1:0.3}}/><IconBtn icon={ChevronRight} size={18} onClick={()=>neighbors.next&&openScene(neighbors.next)} dim title="Next scene" style={{opacity:neighbors.next?1:0.3}}/></div>}
        {wide&&view==="scene"&&curScene&&<IconBtn icon={Settings} onClick={()=>setInfo(curScene)} dim title="Edit scene info"/>}
        {(view==="scenes"||view==="scene")&&<div style={{display:"flex",flexShrink:0,borderRadius:8,overflow:"hidden",border:`1px solid ${c.line2}`}}>
          {[{k:"story",l:"Story"},{k:"shoot",l:wide?"Shooting":"Shoot"}].map(o=><button key={o.k} onClick={()=>setLens(o.k)} title={o.k==="story"?"Story order":"Shooting order (sets prev/next order)"} style={{padding:wide?"7px 12px":"6px 9px",border:"none",background:lens===o.k?c.accent:c.bg2,color:lens===o.k?"#17120a":c.t1,fontFamily:UI,fontSize:wide?12:11.5,fontWeight:700,cursor:"pointer",whiteSpace:"nowrap"}}>{o.l}</button>)}
        </div>}
        <IconBtn icon={Search} onClick={()=>setJump(true)} title="Jump ( / or Cmd-K )" dim/>
        {hasKey&&<div onClick={()=>sync.state==="blocked"&&setView("settings")} title={{pending:"Sync queued",syncing:"Syncing…",synced:"Synced to cloud",error:"Sync error, will retry",blocked:"Sync paused to protect the cloud deck: open Settings",off:"Cloud sync on",idle:"Synced"}[sync.state]||"Synced"} style={{display:"flex",alignItems:"center",gap:5,flexShrink:0,fontFamily:UI,fontSize:11,cursor:sync.state==="blocked"?"pointer":"default",color:sync.state==="error"?c.danger:sync.state==="blocked"?c.warn||"#d98a3d":c.t2}}>
          {sync.state==="syncing"||sync.state==="pending"?<RefreshCw size={15} color={c.accent}/>:sync.state==="blocked"?<AlertTriangle size={15} color={c.warn||"#d98a3d"}/>:sync.state==="error"?<Cloud size={15}/>:<CheckCircle2 size={15} color={c.ok}/>}
          {wide&&<span style={sync.state==="blocked"?{color:c.warn||"#d98a3d",fontWeight:700}:undefined}>{sync.state==="syncing"||sync.state==="pending"?"Syncing":sync.state==="blocked"?"Sync paused":sync.state==="error"?"Sync off":"Synced"}</span>}
        </div>}
        {wide&&<IconBtn icon={c.bg0===DARK.bg0?SunMedium:MoonStar} dim title="Theme" onClick={()=>{const t=(project.meta.theme==="light")?"dark":"light";setProject(p=>({...p,meta:{...p.meta,theme:t}}));themeChange(t);}}/>}
      </div>
    </div>
  );

  return <div style={{minHeight:"100vh",background:c.bg0,color:c.t0,display:"flex",fontFamily:UI}}>
    <style>{PRINT_CSS}</style>
    {Nav}
    <div style={{flex:1,minWidth:0,display:"flex",flexDirection:"column",minHeight:"100vh"}}>
      {TopBar}
      <div style={{flex:1,paddingTop:wide?20:15,paddingBottom:wide?40:"calc(90px + env(safe-area-inset-bottom))",paddingLeft:`max(env(safe-area-inset-left), ${wide?22:13}px)`,paddingRight:`max(env(safe-area-inset-right), ${wide?22:13}px)`,overflowY:"auto",...(view==="scene"&&wide?{display:"flex",flexDirection:"column"}:{})}}>
        {view==="home"&&<Dashboard project={project} onOpen={openScene} onNav={setView}/>}
        {view==="scene"&&curScene&&<SceneView scene={curScene} scenes={project.scenes} meta={project.meta} locations={project.locations} gearList={project.gear} wide={wide} patchScene={patch=>patchScene(curScene.number,patch)} openInk={setInk} openLightbox={openLightbox} addGear={(name,dept)=>tagGear(curScene.number,name,dept)} goScene={openScene} neighbors={neighbors} openInfo={()=>setInfo(curScene)} onToast={toastFn} onSendRef={sendRefBetween} openPdf={openPdf} openVf={setVf} addCapturedRef={id=>addSceneRefs(curScene.number,[id])}/>}
        {view==="scene"&&!curScene&&<Empty icon={Film} title="Scene not found" body="It may have been cut. Open the Scenes list." action={<Btn kind="primary" onClick={()=>setView("scenes")}>Scenes</Btn>}/>}
        {view==="scenes"&&<><div style={{display:"flex",justifyContent:"flex-end",marginBottom:12}}><Btn kind="ghost" size={12} onClick={()=>setInfo({__new:true,status:"todo"})}><Plus size={15}/>Add scene</Btn></div><Library project={project} lens={lens} onOpen={openScene}/></>}
        {view==="look"&&<LookBoard project={project} setProject={setProject} openLightbox={openLightbox} onToast={toastFn}/>}
        {view==="docs"&&<Documents openPdf={openPdf} onToast={toastFn}/>}
        {view==="days"&&<Days project={project} onOpen={openScene} openPdf={openPdf}/>}
        {view==="locations"&&<Locations project={project} setProject={setProject} onOpen={openScene} openLightbox={openLightbox} onToast={toastFn} focusLoc={focusLoc} onFocused={()=>setFocusLoc(null)} openVf={setVf}/>}
        {view==="crew"&&<Crew project={project} setProject={setProject}/>}
        {view==="gear"&&<Gear project={project} setProject={setProject}/>}
        {view==="contacts"&&<Crew project={project} setProject={setProject}/>}
        {view==="export"&&(()=>{
          const dayList=sidesDays(project);
          const dayVal=(exp.day!=="all"&&!dayList.some(d=>String(d.day)===String(exp.day)))?"all":exp.day;   // a stale day selection (after a schedule re-import) falls back to All
          const desc=exp.mode==="full"?"Full package: script, synopsis, notes, shot lists, gear, reference frames, blocking, plus locations and crew/contacts. Scroll through once so images load, then print.":exp.mode==="gear"?(exp.gearBy==="scene"?"Gear pull organized by scene: every scene with the specialty gear it needs, in shooting order. Toggle departments to include.":"Gear pull by department: each item with the scenes it is needed on. Toggle departments to include."):exp.mode==="sides"?"DP Sides: a per-shoot-day packet to send the crew. Each day has its schedule, every scene with script, shots, gear, location, sun and weather. Pick one day or send them all. Scroll through once so images load, then print.":"Time of day: a one-page list of every scene with an ideal shooting window noted, in shooting order. Hand it to the AD to schedule against the sun. Add a window in any scene's Time of day field.";
          // For DP Sides, pre-fetch every selected day's weather (and let React settle) before printing, so the crew PDF shows real forecasts instead of "checking forecast".
          const doPrint=async()=>{
            if(exp.mode==="sides"){try{
              const byNum=new Map(project.scenes.map(s=>[numKey(s.number),s]));
              const sel=(dayVal!=="all")?dayList.filter(d=>String(d.day)===String(dayVal)):dayList;
              await Promise.all(sel.map(d=>{const sc=d.nums.map(n=>byNum.get(numKey(n))).filter(Boolean);const l=dayLocation(sc,project.locations);return (l&&l.lat!=null&&l.lat!==""&&d.date)?fetchWeather(l.lat,l.lng,d.date):null;}).filter(Boolean));
              await new Promise(r=>setTimeout(r,180));
            }catch{}}
            window.print();
          };
          return <div>
          <div data-noprint style={{display:"flex",alignItems:"center",gap:12,marginBottom:12,flexWrap:"wrap"}}>
            <div style={{maxWidth:470}}><Segmented value={exp.mode} onChange={v=>setExp(e=>({...e,mode:v||"full"}))} options={[{k:"full",label:"Full package"},{k:"gear",label:"Gear pull"},{k:"sides",label:"DP Sides"},{k:"tod",label:"Time of day"}]}/></div>
            {exp.mode==="gear"&&<>
              <div style={{width:230}}><Segmented value={exp.gearBy} onChange={v=>setExp(e=>({...e,gearBy:v||"dept"}))} options={[{k:"dept",label:"By department"},{k:"scene",label:"By scene"}]}/></div>
              <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>{DEPTS.map(d=>{const on=exp.depts.includes(d.k);return <button key={d.k} onClick={()=>setExp(e=>({...e,depts:on?e.depts.filter(x=>x!==d.k):[...e.depts,d.k]}))} style={{padding:"8px 12px",borderRadius:8,border:`1px solid ${on?c.accent:c.line2}`,background:on?c.accentSoft:c.bg2,color:on?c.accent:c.t1,fontFamily:UI,fontSize:13,fontWeight:650,cursor:"pointer"}}>{d.label}</button>;})}</div>
            </>}
            {exp.mode==="sides"&&<select value={dayVal} onChange={e=>setExp(x=>({...x,day:e.target.value}))} style={{padding:"9px 11px",borderRadius:8,border:`1px solid ${c.line2}`,background:c.bg2,color:c.t0,fontFamily:UI,fontSize:13,fontWeight:600}}>
              <option value="all">All shoot days</option>
              {dayList.map(d=><option key={d.day} value={d.day}>Day {d.day}{d.date?` · ${new Date(d.date+"T12:00").toLocaleDateString(undefined,{month:"short",day:"numeric"})}`:""}</option>)}
            </select>}
            <Btn kind="primary" size={13} onClick={doPrint}><Printer size={16}/>Print / Save as PDF</Btn>
          </div>
          <div data-noprint style={{fontFamily:UI,fontSize:12.5,color:c.t2,lineHeight:1.5,maxWidth:640,marginBottom:14}}>{desc}</div>
          {exp.mode==="full"?<ExportDoc project={project}/>:exp.mode==="gear"?<GearSheet project={project} depts={exp.depts} by={exp.gearBy}/>:exp.mode==="sides"?<SidesDoc project={project} dayFilter={dayVal}/>:<TimeOfDaySheet project={project}/>}
          </div>;
        })()}
        {view==="import"&&<Import project={project} setProject={setProject} onToast={toastFn}/>}
        {view==="settings"&&<SettingsView project={project} setProject={setProject} onToast={toastFn} onThemeChange={themeChange} onNav={setView}/>}
      </div>
    </div>

    {!wide&&<div data-noprint style={{position:"fixed",left:0,right:0,bottom:0,zIndex:50,background:c.panel,borderTop:`1px solid ${c.line}`,display:"flex",alignItems:"center",justifyContent:"space-around",paddingTop:7,paddingLeft:"max(env(safe-area-inset-left), 6px)",paddingRight:"max(env(safe-area-inset-right), 6px)",paddingBottom:"max(env(safe-area-inset-bottom), 9px)"}}>
      {MOBILE_NAV.map(k=>{const n=NAV.find(x=>x.k===k);const on=view===k||(k==="scenes"&&view==="scene");return <button key={k} onClick={()=>setView(k)} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:3,background:"none",border:"none",color:on?c.accent:c.t2,cursor:"pointer",flex:1}}><n.icon size={21}/><span style={{fontFamily:UI,fontSize:9.5,fontWeight:600}}>{n.label}</span></button>;})}
      <button onClick={()=>setMore(true)} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:3,background:"none",border:"none",color:c.t2,cursor:"pointer",flex:1}}><ChevronDown size={21} style={{transform:"rotate(180deg)"}}/><span style={{fontFamily:UI,fontSize:9.5,fontWeight:600}}>More</span></button>
    </div>}
    {more&&!wide&&<div data-noprint onClick={()=>setMore(false)} style={{position:"fixed",inset:0,background:c.scrim,zIndex:70,display:"flex",alignItems:"flex-end"}}><div onClick={e=>e.stopPropagation()} style={{background:c.bg1,borderTopLeftRadius:18,borderTopRightRadius:18,width:"100%",paddingTop:10,paddingLeft:12,paddingRight:12,paddingBottom:"calc(26px + env(safe-area-inset-bottom))",borderTop:`1px solid ${c.line2}`}}>
      <div style={{width:38,height:4,borderRadius:2,background:c.line2,margin:"6px auto 14px"}}/>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:9}}>{NAV.filter(n=>!MOBILE_NAV.includes(n.k)).map(n=><button key={n.k} onClick={()=>{setView(n.k);setMore(false);}} style={{display:"flex",alignItems:"center",gap:11,padding:"14px 13px",borderRadius:11,border:`1px solid ${c.line}`,background:view===n.k?c.accentSoft:c.bg2,color:view===n.k?c.accent:c.t0,cursor:"pointer",fontFamily:UI,fontSize:14,fontWeight:600}}><n.icon size={19}/>{n.label}</button>)}</div>
      <button onClick={()=>{const t=(project.meta.theme==="light")?"dark":"light";setProject(p=>({...p,meta:{...p.meta,theme:t}}));themeChange(t);}} style={{marginTop:9,width:"100%",display:"flex",alignItems:"center",justifyContent:"center",gap:8,padding:"12px",borderRadius:11,border:`1px solid ${c.line}`,background:c.bg2,color:c.t1,cursor:"pointer",fontFamily:UI,fontSize:13.5}}>{c.bg0===DARK.bg0?<SunMedium size={17}/>:<MoonStar size={17}/>}Switch theme</button>
    </div></div>}

    <QuickJump open={jump} scenes={project.scenes} onClose={()=>setJump(false)} onOpen={openScene}/>
    {ink&&<InkCanvas title={ink.title} bgUrl={ink.bgUrl} initial={ink.initial} draftKey={ink.draftKey} onClose={()=>setInk(null)} onSave={d=>{ink.onSave&&ink.onSave(d);}}/>}
    {vf&&<Viewfinder title={vf.title} onCapture={vf.onCapture} onClose={()=>setVf(null)}/>}
    <Lightbox state={light} onClose={()=>setLight(null)}/>
    <PdfViewer open={!!pdfv} slot={pdfv?.slot} start={pdfv?.start} title={pdfv?.title} onClose={()=>setPdfv(null)}/>
    <SceneInfo open={!!info} init={info} locations={project.locations} onClose={()=>setInfo(null)} onSave={saveInfo} onDelete={delScene}/>
    <Toast toast={toast} onClose={()=>setToast(null)}/>
  </div>;
}
const TITLES={home:"Home",days:"Schedule",scenes:"Scenes",look:"Look",docs:"Documents",locations:"Locations",crew:"Crew",gear:"Gear",contacts:"Crew",export:"Export PDF",import:"Import",settings:"Settings",scene:""};
