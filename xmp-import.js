/* Fuji Pocket XMP importer. Supports common Lightroom/Camera Raw global develop controls and HSL mixer. */
(function(){
"use strict";
function parse(source){
 const doc=new DOMParser().parseFromString(source,"application/xml");
 if(doc.querySelector("parsererror"))throw Error("Ongeldige XMP/XML.");
 const v={};
 for(const el of doc.getElementsByTagName("*")){
  for(const a of el.attributes)v[a.localName||a.name.split(":").pop()]=a.value;
  if(!el.children.length&&el.textContent.trim())v[el.localName||el.nodeName.split(":").pop()]=el.textContent.trim();
 }
 const num=(k,d=0)=>{const n=Number(v[k]);return Number.isFinite(n)?n:d;};
 const p={name:String(v.Name||v.PresetName||v.Title||"Mijn XMP-preset").slice(0,36),exposure:num("Exposure2012"),contrast:num("Contrast2012"),highlights:num("Highlights2012"),shadows:num("Shadows2012"),whites:num("Whites2012"),blacks:num("Blacks2012"),temperature:num("Temperature",5500),tint:num("Tint"),vibrance:num("Vibrance"),saturation:num("Saturation"),hue:[],sat:[],lum:[]};
 const channels=["Red","Orange","Yellow","Green","Aqua","Blue","Purple","Magenta"];
 channels.forEach(c=>{p.hue.push(num("HueAdjustment"+c));p.sat.push(num("SaturationAdjustment"+c));p.lum.push(num("LuminanceAdjustment"+c));});
 if(!Object.keys(v).some(k=>/^(Exposure2012|Contrast2012|Highlights2012|Shadows2012|Whites2012|Blacks2012|Temperature|Tint|Vibrance|Saturation|HueAdjustment|SaturationAdjustment|LuminanceAdjustment)/.test(k)))throw Error("Geen ondersteunde Lightroom-ontwikkelinstellingen gevonden.");
 return p;
}
function clamp(x){return Math.max(0,Math.min(1,x));}
function linear(x){return x<=.04045?x/12.92:Math.pow((x+.055)/1.055,2.4);}
function srgb(x){x=Math.max(0,x);return x<=.0031308?12.92*x:1.055*Math.pow(x,1/2.4)-.055;}
function smooth(a,b,x){let t=clamp((x-a)/(b-a));return t*t*(3-2*t);}
function build(p){
 const n=49,data=new Uint8Array(n*n*n*4),centers=[0,30,60,120,180,240,275,320];let k=0;
 for(let g=0;g<n;g++)for(let b=0;b<n;b++)for(let r=0;r<n;r++){
  let R=r/(n-1),G=g/(n-1),B=b/(n-1),temp=(p.temperature-5500)*.00006;
  R=srgb(linear(R)*Math.pow(2,p.exposure+temp+p.tint*.00012));
  G=srgb(linear(G)*Math.pow(2,p.exposure+p.tint*.00008));
  B=srgb(linear(B)*Math.pow(2,p.exposure-temp-p.tint*.00012));
  const y=.2126*R+.7152*G+.0722*B,sh=1-smooth(.12,.58,y),hi=smooth(.48,.92,y);
  const lift=p.shadows/100*.22*sh+p.highlights/100*.20*hi+p.blacks/100*.16*(1-smooth(.02,.25,y))+p.whites/100*.16*smooth(.72,.99,y);
  R+=lift;G+=lift;B+=lift;
  const c=1+p.contrast/100*.65,mid=.18;R=mid+(R-mid)*c;G=mid+(G-mid)*c;B=mid+(B-mid)*c;
  const mx=Math.max(R,G,B),mn=Math.min(R,G,B),d=mx-mn;let h=0,l=(mx+mn)/2,s=0;
  if(d>1e-6){s=d/(1-Math.abs(2*l-1));if(mx===R)h=60*(((G-B)/d)%6);else if(mx===G)h=60*((B-R)/d+2);else h=60*((R-G)/d+4);if(h<0)h+=360;}
  let dh=0,ds=0,dl=0,ws=0;
  for(let i=0;i<8;i++){const dist=Math.abs(((h-centers[i]+540)%360)-180),w=Math.exp(-.5*Math.pow(dist/24,2));dh+=p.hue[i]*w;ds+=p.sat[i]*w;dl+=p.lum[i]*w;ws+=w;}
  if(ws){h=(h+dh/ws*.9+360)%360;s*=Math.max(0,1+ds/ws/100);l+=dl/ws/100*.18;}
  s*=Math.max(0,1+p.saturation/100+p.vibrance/100*(1-s));l=clamp(l);
  const C=(1-Math.abs(2*l-1))*s,X=C*(1-Math.abs((h/60)%2-1)),m=l-C/2,hp=h/60;let rr=0,gg=0,bb=0;
  if(hp<1){rr=C;gg=X}else if(hp<2){rr=X;gg=C}else if(hp<3){gg=C;bb=X}else if(hp<4){gg=X;bb=C}else if(hp<5){rr=X;bb=C}else{rr=C;bb=X}
  data[k++]=Math.round(clamp(rr+m)*255);data[k++]=Math.round(clamp(gg+m)*255);data[k++]=Math.round(clamp(bb+m)*255);data[k++]=255;
 }
 return {n,width:n*n,data,domainMin:[0,0,0],domainMax:[1,1,1],title:p.name};
}
window.FujiPocketXmp={parse,build};
})();