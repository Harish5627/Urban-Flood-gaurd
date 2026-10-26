/* Urban FloodGuard AI - prototype. All data below is SAMPLE data for demonstration. */

// ---------- Sample locations (Madurai, approximate) ----------
const LOCS = [
 ["Vaigai Riverside",9.9195,78.1290,96,0.35,5],["Simmakkal",9.9260,78.1210,101,0.40,4],
 ["Thallakulam",9.9400,78.1330,104,0.45,4],["Goripalayam",9.9330,78.1360,106,0.50,3],
 ["Sellur",9.9450,78.1130,103,0.40,4],["Arapalayam",9.9290,78.1110,110,0.55,2],
 ["Teppakulam",9.9140,78.1480,108,0.55,3],["Thirunagar",9.8890,78.0890,125,0.60,2],
 ["Anna Nagar",9.9330,78.1010,122,0.70,1],["KK Nagar",9.9300,78.1440,128,0.75,1],
 ["Mattuthavani",9.9470,78.1580,115,0.60,2],["Avaniyapuram",9.8840,78.1000,118,0.45,3],
 ["Tirupparankundram",9.8750,78.0780,142,0.80,0],["Vilangudi",9.9650,78.1380,120,0.65,1]
].map((a,i)=>({id:i,name:a[0],lat:a[1],lng:a[2],elev:a[3],drain:a[4],hist:a[5],reports:0}));

// ---------- Tiny "trained" logistic model (weights stand in for a Scikit-learn model) ----------
const W = {rainfall:3.4, elevation:1.6, drainage:1.5, history:1.1, reports:0.8}, BIAS = -3.0;
const NAMES = {rainfall:"Rainfall",elevation:"Low elevation",drainage:"Weak drainage",history:"Past floods",reports:"Citizen reports"};
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
function features(l,rain){return {rainfall:clamp(rain/150,0,1.6),elevation:clamp((150-l.elev)/55,0,1),
  drainage:1-l.drain,history:l.hist/5,reports:Math.min(l.reports,5)/5};}
function predict(l,rain){
  const f=features(l,rain); const parts={}; let z=BIAS;
  for(const k in W){parts[k]=W[k]*f[k]; z+=parts[k];}
  const p=1/(1+Math.exp(-z)), level=p>=0.6?"High":p>=0.3?"Medium":"Low";
  const sum=Object.values(parts).reduce((a,b)=>a+b,0)||1;
  const share={}; for(const k in parts) share[k]=parts[k]/sum;
  return {p,level,conf:clamp(Math.max(p,1-p),0.5,0.97),share};
}

// ---------- Translations ----------
const TXT={
 en:{title:"Urban FloodGuard AI",High:"High",Medium:"Medium",Low:"Low",
  rec:{High:"Avoid the area and prepare to move to safer ground.",Medium:"Monitor and prepare.",Low:"No action needed."}},
 ta:{title:"நகர வெள்ள பாதுகாப்பு AI",High:"அதிகம்",Medium:"நடுத்தரம்",Low:"குறைவு",
  rec:{High:"அந்தப் பகுதியைத் தவிர்த்து, பாதுகாப்பான இடத்துக்குச் செல்லத் தயாராகுங்கள்.",Medium:"கண்காணித்துத் தயாராக இருங்கள்.",Low:"நடவடிக்கை தேவையில்லை."}},
 hi:{title:"शहरी बाढ़ सुरक्षा AI",High:"उच्च",Medium:"मध्यम",Low:"निम्न",
  rec:{High:"क्षेत्र से बचें और सुरक्षित स्थान पर जाने के लिए तैयार रहें।",Medium:"निगरानी करें और तैयार रहें।",Low:"कोई कार्रवाई आवश्यक नहीं।"}}
};
let lang="en"; const T=k=>TXT[lang][k];
const COLORS={High:"#c8372d",Medium:"#d99a1c",Low:"#2f8f5b"};
const $=id=>document.getElementById(id);

// ---------- State ----------
let rain=90, liveHourly=null, selected=null, results=[], prevLevels={}, alertCount=0, evacLine=null;
const alerts=[], markers=[];
const map=L.map("map").setView([9.925,78.12],12);
L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png",{attribution:"&copy; OpenStreetMap contributors",maxZoom:18}).addTo(map);
LOCS.forEach(l=>{
  const m=L.circleMarker([l.lat,l.lng],{radius:14,weight:2,color:"#fff",fillOpacity:.85}).addTo(map);
  m.bindTooltip(l.name); m.on("click",()=>select(l.id)); markers[l.id]=m;
  $("areas").insertAdjacentHTML("beforeend",`<option value="${l.name}">`);
  $("repArea").insertAdjacentHTML("beforeend",`<option value="${l.id}">${l.name}</option>`);
});

// ---------- Rendering ----------
function recompute(){results=LOCS.map(l=>({l,...predict(l,rain)}));}
function render(){
  recompute();
  const c={High:0,Medium:0,Low:0};
  results.forEach(r=>{c[r.level]++;
    markers[r.l.id].setStyle({fillColor:COLORS[r.level],color:selected===r.l.id?"#10242e":"#fff",weight:selected===r.l.id?4:2});});
  $("sHigh").textContent=c.High;$("sMed").textContent=c.Medium;$("sLow").textContent=c.Low;
  $("sMon").textContent=LOCS.length;$("sAlert").textContent=alertCount;
  const lab={high:"High",med:"Medium",low:"Low"};
  document.querySelectorAll("[data-i]").forEach(e=>{const k=e.dataset.i;e.textContent=k==="title"?T("title"):T(lab[k]);});
  renderPriority(); renderDetail(); drawRain();
}
function renderPriority(){
  const rows=[...results].sort((a,b)=>b.p-a.p).map((r,i)=>{
    const top=Object.entries(r.share).sort((a,b)=>b[1]-a[1])[0][0];
    const act=r.level==="High"?"Inspect drains now":r.level==="Medium"?"Schedule inspection":"Routine check";
    return `<tr data-id="${r.l.id}"><td>${i+1}</td><td>${r.l.name}</td><td><span class="badge ${r.level}">${T(r.level)}</span></td>
    <td>${Math.round(r.p*100)}%</td><td>${NAMES[top]}</td><td>${act}</td></tr>`;}).join("");
  $("prio").innerHTML=`<thead><tr><th>#</th><th>Area</th><th>Risk</th><th>Probability</th><th>Main driver</th><th>Suggested action</th></tr></thead><tbody>${rows}</tbody>`;
  $("prio").querySelectorAll("tr[data-id]").forEach(tr=>tr.onclick=()=>select(+tr.dataset.id,true));
}
function renderDetail(){
  if(selected===null)return;
  const r=results[selected],l=r.l;
  $("dName").textContent=l.name;
  $("dBadge").innerHTML=`<span class="badge ${r.level}">${T(r.level)}</span> &nbsp;confidence ${r.conf.toFixed(2)}`;
  $("dFacts").innerHTML=`<dt>Rainfall (24h)</dt><dd>${rain} mm</dd><dt>Elevation</dt><dd>${l.elev} m</dd>
   <dt>Drainage capacity</dt><dd>${Math.round(l.drain*100)}%</dd><dt>Past floods</dt><dd>${l.hist}</dd>
   <dt>Citizen reports</dt><dd>${l.reports}</dd><dt>Coordinates</dt><dd>${l.lat.toFixed(4)}, ${l.lng.toFixed(4)}</dd>`;
  $("factors").innerHTML=Object.entries(r.share).sort((a,b)=>b[1]-a[1]).map(([k,v])=>
    `<div class="frow"><span>${NAMES[k]}</span><div class="bar"><i style="width:${Math.round(v*100)}%"></i></div><span>${Math.round(v*100)}%</span></div>`).join("");
  $("dRec").textContent=TXT[lang].rec[r.level];
  if(evacLine){map.removeLayer(evacLine);evacLine=null;}
  $("dEvac").textContent="";
  if(r.level!=="Low"){
    const safe=results.filter(x=>x.level==="Low").sort((a,b)=>dist(l,a.l)-dist(l,b.l))[0];
    if(safe){evacLine=L.polyline([[l.lat,l.lng],[safe.l.lat,safe.l.lng]],{color:"#1f6f8b",dashArray:"8 8",weight:4}).addTo(map);
      $("dEvac").textContent=`Evacuation route (straight-line demo): move toward ${safe.l.name}, about ${dist(l,safe.l).toFixed(1)} km away.`;}
    else $("dEvac").textContent="No low-risk area found nearby. Follow official instructions.";
  }
  drawHist(l);
}
const dist=(a,b)=>{const R=6371,t=x=>x*Math.PI/180,dl=t(b.lat-a.lat),dg=t(b.lng-a.lng);
  const h=Math.sin(dl/2)**2+Math.cos(t(a.lat))*Math.cos(t(b.lat))*Math.sin(dg/2)**2;return 2*R*Math.asin(Math.sqrt(h));};
function select(id,fly){selected=id;if(fly)map.flyTo([LOCS[id].lat,LOCS[id].lng],14);render();}

// ---------- Charts (plain canvas) ----------
function bars(canvas,vals,labels,color){
  const c=canvas.getContext("2d"),W=canvas.width,H=canvas.height,m=18,max=Math.max(...vals,1),bw=(W-2*m)/vals.length;
  c.clearRect(0,0,W,H);c.fillStyle=color;c.font="10px sans-serif";
  vals.forEach((v,i)=>{const h=(H-2*m)*v/max;c.fillRect(m+i*bw+2,H-m-h,bw-4,h);
    if(labels[i]!==""){c.fillStyle="#5b7079";c.fillText(labels[i],m+i*bw,H-5);c.fillStyle=color;}});
}
function drawRain(){
  let shape=liveHourly&&liveHourly.length===24?liveHourly:Array.from({length:24},(_,h)=>Math.exp(-((h-15)**2)/18));
  const s=shape.reduce((a,b)=>a+b,0)||1, vals=shape.map(v=>v/s*rain);
  bars($("rainChart"),vals,vals.map((_,h)=>h%4===0?String(h):""),"#1f6f8b");
}
function drawHist(l){
  const years=[2019,2020,2021,2022,2023,2024,2025],
   vals=years.map((_,i)=>Math.max(0,Math.round(l.hist/3+((i*5+l.id*3)%4)-1.5)));
  bars($("histChart"),vals,years.map(String),"#5b7079");
}

// ---------- Alerts (fire when an area newly becomes High) ----------
let timer; function checkAlerts(){
  recompute();
  results.forEach(r=>{
    if(r.level==="High"&&prevLevels[r.l.id]&&prevLevels[r.l.id]!=="High"){
      alertCount++;alerts.unshift(`${new Date().toLocaleTimeString()} - ${r.l.name} is now HIGH risk at ${rain} mm. ${TXT[lang].rec.High}`);}
    prevLevels[r.l.id]=r.level;});
  $("alerts").innerHTML=alerts.slice(0,10).map(a=>`<li>${a}</li>`).join("")||"<li>No alerts yet. Move the rainfall slider up to trigger some.</li>";
  render();
}

// ---------- Model evaluation (synthetic, seeded) ----------
function evaluate(){
  let s=42;const rnd=()=>(s=(s*16807)%2147483647)/2147483647;
  let TP=0,FN=0,FP=0,TN=0;
  for(let i=0;i<300;i++){
    const l={elev:95+rnd()*55,drain:0.3+rnd()*0.65,hist:Math.floor(rnd()*6),reports:0};
    const rr=rnd()*220,pr=predict(l,rr),truth=(pr.p+(rnd()-0.5)*0.4)>=0.6,pred=pr.level==="High";
    if(truth&&pred)TP++;else if(truth)FN++;else if(pred)FP++;else TN++;}
  const P=TP/(TP+FP||1),R=TP/(TP+FN||1),F=2*P*R/(P+R||1),A=(TP+TN)/300;
  $("evalBox").innerHTML=`<p class="note">Illustrative test on 300 synthetic samples. Replace with real flood records to get real numbers.</p>
   <div class="metrics"><div><b>${P.toFixed(2)}</b>Precision</div><div><b>${R.toFixed(2)}</b>Recall</div>
   <div><b>${F.toFixed(2)}</b>F1-score</div><div><b>${A.toFixed(2)}</b>Accuracy</div></div>
   <div class="cm"><div class="ok"><b>${TP}</b>True positive</div><div class="bad"><b>${FN}</b>False negative</div>
   <div class="bad"><b>${FP}</b>False positive</div><div class="ok"><b>${TN}</b>True negative</div></div>
   <p class="note">Rows: actual High / not High. Columns: predicted High / not High.</p>`;
}

// ---------- Live weather (Open-Meteo, free, no key) ----------
$("liveBtn").onclick=async()=>{
  $("rainSrc").textContent="Fetching live data...";
  try{
    const r=await fetch("https://api.open-meteo.com/v1/forecast?latitude=9.9252&longitude=78.1198&hourly=precipitation&past_days=1&forecast_days=1&timezone=auto");
    const d=await r.json(),h=d.hourly.precipitation.slice(0,24);
    liveHourly=h;rain=Math.round(h.reduce((a,b)=>a+b,0));
    $("rain").value=rain;$("rainVal").textContent=rain;
    $("rainSrc").textContent=`Source: Open-Meteo, last 24h total for Madurai (${rain} mm)`;checkAlerts();
  }catch(e){$("rainSrc").textContent="Live weather unavailable (check your internet). Using the manual slider.";}
};

// ---------- Events ----------
$("rain").oninput=e=>{rain=+e.target.value;liveHourly=null;$("rainVal").textContent=rain;
  $("rainSrc").textContent="Source: manual slider (sample data)";clearTimeout(timer);timer=setTimeout(checkAlerts,300);render();};
$("lang").onchange=e=>{lang=e.target.value;render();checkAlerts();};
$("search").onchange=e=>{const l=LOCS.find(x=>x.name.toLowerCase()===e.target.value.trim().toLowerCase());if(l)select(l.id,true);};
document.querySelectorAll(".tab").forEach(b=>b.onclick=()=>{
  document.querySelectorAll(".tab").forEach(t=>t.classList.toggle("on",t===b));
  document.querySelectorAll(".tabbody").forEach(s=>s.hidden=s.id!==b.dataset.tab);});
$("repBtn").onclick=()=>{
  const l=LOCS[+$("repArea").value],note=$("repNote").value.trim()||"Waterlogging reported";
  l.reports++;L.circleMarker([l.lat+0.002,l.lng+0.002],{radius:5,color:"#10242e",fillColor:"#10242e",fillOpacity:1}).addTo(map).bindTooltip("Report: "+note);
  $("reports").insertAdjacentHTML("afterbegin",`<li><b>${l.name}</b>: ${note} (${new Date().toLocaleTimeString()})</li>`);
  $("repNote").value="";checkAlerts();
};

// ---------- Start ----------
recompute();results.forEach(r=>prevLevels[r.l.id]=r.level);
evaluate();checkAlerts();select(0);
