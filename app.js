const CONFIG = {
  api: "https://api.aladhan.com/v1/timings",
  qiblaApi: "https://api.aladhan.com/v1/qibla",
  method: 20, // Kementerian Agama Republik Indonesia
  school: 0, // Shafi'i
  fallback: {lat: -6.4819, lon: 106.8047, label: "Bojonggede, Bogor"},
  prayers: [
    ["Imsak","Imsak"],["Subuh","Fajr"],["Terbit","Sunrise"],["Dzuhur","Dhuhr"],
    ["Ashar","Asr"],["Maghrib","Maghrib"],["Isya","Isha"]
  ]
};
const state = {
  coords: {...CONFIG.fallback}, label: CONFIG.fallback.label, timings: null,
  announcements: [
    {title:"Kajian rutin pekan ini", text:"Mari hadir dan belajar bersama setelah salat Isya."},
    {title:"Jaga kebersihan masjid", text:"Mohon membuang sampah pada tempatnya dan menjaga fasilitas bersama."},
    {title:"Sedekah terbaik", text:"Dukung kegiatan Masjid An-Nur melalui kotak amal atau QRIS masjid."}
  ],
  announcementIndex:0, settings: JSON.parse(localStorage.getItem("annur-settings") || "{}")
};

const $ = id => document.getElementById(id);
const pad = n => String(n).padStart(2,"0");
function todayISO(d=new Date()){return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`}
function cleanTime(v){return (v||"").split(" ")[0].slice(0,5)}
function minutes(hm){const [h,m]=hm.split(":").map(Number); return h*60+m}
function formatCountdown(ms){
  if(ms<0) ms=0; const s=Math.floor(ms/1000), h=Math.floor(s/3600), m=Math.floor((s%3600)/60), sec=s%60;
  return `${pad(h)}:${pad(m)}:${pad(sec)}`;
}
function localDateString(){return new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Jakarta"}).format(new Date())}
function updateClock(){
  const now=new Date();
  $("clock").textContent=new Intl.DateTimeFormat("id-ID",{hour:"2-digit",minute:"2-digit",second:"2-digit",hour12:false,timeZone:"Asia/Jakarta"}).format(now);
  $("year").textContent=new Intl.DateTimeFormat("en",{timeZone:"Asia/Jakarta",year:"numeric"}).format(now);
  $("dateLine").textContent=new Intl.DateTimeFormat("id-ID",{weekday:"long",day:"numeric",month:"long",year:"numeric",timeZone:"Asia/Jakarta"}).format(now);
  updateNextPrayer();
}
async function getLocation(){
  if(!navigator.geolocation){return loadPrayerTimes()}
  navigator.geolocation.getCurrentPosition(
    pos=>{state.coords={lat:pos.coords.latitude,lon:pos.coords.longitude};state.label="Lokasi perangkat";loadPrayerTimes()},
    ()=>loadPrayerTimes(),
    {enableHighAccuracy:true,timeout:8000,maximumAge:600000}
  );
}
async function loadPrayerTimes(){
  $("locationLabel").textContent=state.label;
  const d=localDateString();
  const url=`${CONFIG.api}/${d}?latitude=${state.coords.lat}&longitude=${state.coords.lon}&method=${CONFIG.method}&school=${CONFIG.school}&iso8601=true`;
  try{
    const r=await fetch(url); if(!r.ok) throw Error("API");
    const j=await r.json(); state.timings=j.data.timings; state.meta=j.data;
    renderPrayerTimes(); renderHijri(); await loadQibla();
  }catch(e){
    $("locationLabel").textContent=`${state.label} • offline`;
    renderFallback();
  }
}
function renderPrayerTimes(){
  const list=$("prayerList"); list.innerHTML="";
  CONFIG.prayers.forEach(([id,key])=>{
    const t=cleanTime(state.timings[key]);
    const row=document.createElement("div"); row.className="prayer-row"; row.dataset.key=key;
    row.innerHTML=`<div class="name">${id}</div><div><span class="time">${t}</span></div>`;
    list.appendChild(row);
  });
  updateNextPrayer();
}
function getPrayerEvents(){
  if(!state.timings) return [];
  const keys=[["Subuh","Fajr"],["Dzuhur","Dhuhr"],["Ashar","Asr"],["Maghrib","Maghrib"],["Isya","Isha"]];
  const now=new Date();
  return keys.map(([name,key])=>{
    const [h,m]=cleanTime(state.timings[key]).split(":").map(Number);
    const dt=new Date(now); dt.setHours(h,m,0,0); return {name,key,time:dt};
  });
}
function updateNextPrayer(){
  if(!state.timings)return;
  const now=new Date(), events=getPrayerEvents();
  let next=events.find(x=>x.time>now);
  if(!next){next=events[0]; next={...next,time:new Date(next.time.getTime()+86400000)}}
  $("nextPrayerName").textContent=next.name;
  $("countdown").textContent=formatCountdown(next.time-now);
  document.querySelectorAll(".prayer-row").forEach(r=>r.classList.toggle("active",r.dataset.key===next.key));
}
function renderHijri(){
  const h=state.meta?.date?.hijri;
  $("hijri").textContent=h ? `${h.day} ${h.month.en} ${h.year} H` : "—";
}
async function loadQibla(){
  try{
    const r=await fetch(`${CONFIG.qiblaApi}/${state.coords.lat}/${state.coords.lon}`);
    const j=await r.json(); const deg=Math.round(j.data.direction);
    $("qibla").textContent=`${deg}° dari Utara`;
  }catch{$("qibla").textContent="—"}
}
function renderFallback(){
  $("prayerList").innerHTML=`<div class="muted">Jadwal belum tersedia. Periksa koneksi internet lalu tekan ↻.</div>`;
}
function renderAnnouncements(){
  const a=state.announcements[state.announcementIndex];
  $("announcement").innerHTML=`<h3>${a.title}</h3><p>${a.text}</p>`;
  $("announcementDots").innerHTML=state.announcements.map((_,i)=>`<span class="dot ${i===state.announcementIndex?"on":""}"></span>`).join("");
}
function renderAgenda(){
  const items=[
    ["07","Kajian Subuh","Setiap Ahad • 05.30 WIB"],
    ["14","Kajian Keluarga","Sabtu • 19.30 WIB"],
    ["21","TPA An-Nur","Senin–Jumat • 16.00 WIB"]
  ];
  $("agendaList").innerHTML=items.map(x=>`<div class="agenda"><div class="agenda-date">${x[0]}</div><div><strong>${x[1]}</strong><span>${x[2]}</span></div></div>`).join("");
}
function loadSettings(){
  const s=state.settings;
  if(s.mosqueName){$("greeting").textContent=`Selamat datang di ${s.mosqueName}`;document.title=`${s.mosqueName} • Digital Display`}
  if(s.fallback) CONFIG.fallback.label=s.fallback;
  if(s.ticker) $("tickerText").textContent=s.ticker;
  $("setMosqueName").value=s.mosqueName||"Masjid An-Nur";
  $("setFallback").value=s.fallback||"Bojonggede, Bogor, Indonesia";
  $("setSlide").value=s.slide||8;
  $("setTune").value=s.tune||0;
  $("setTicker").value=s.ticker||"Mari merapatkan dan meluruskan shaf. • Mohon menjaga kebersihan masjid.";
}
function saveSettings(){
  state.settings={
    mosqueName:$("setMosqueName").value.trim()||"Masjid An-Nur",
    fallback:$("setFallback").value.trim()||"Bojonggede, Bogor, Indonesia",
    slide:Math.max(3,Math.min(60,Number($("setSlide").value)||8)),
    tune:Number($("setTune").value)||0,
    ticker:$("setTicker").value.trim()||"Mari merapatkan dan meluruskan shaf."
  };
  localStorage.setItem("annur-settings",JSON.stringify(state.settings));
  $("settingsModal").classList.remove("show"); loadSettings();
  // Tune is intentionally UI-ready; apply it locally to displayed times for mosque-specific calibration.
  if(state.timings && state.settings.tune){for(const k in state.timings){if(typeof state.timings[k]==="string" && /^\d\d:\d\d/.test(state.timings[k])) state.timings[k]=shiftTime(state.timings[k],state.settings.tune)} renderPrayerTimes()}
}
function shiftTime(v,delta){let [h,m]=cleanTime(v).split(":").map(Number);m+=delta;h=(h+Math.floor(m/60)+24)%24;m=(m%60+60)%60;return `${pad(h)}:${pad(m)}`}
$("refreshBtn").onclick=loadPrayerTimes;
$("settingsBtn").onclick=()=>{loadSettings();$("settingsModal").classList.add("show")};
$("closeSettings").onclick=()=>$("settingsModal").classList.remove("show");
$("settingsModal").onclick=e=>{if(e.target.id==="settingsModal")e.currentTarget.classList.remove("show")};
$("saveSettings").onclick=saveSettings;
$("fullscreenBtn").onclick=async()=>{if(!document.fullscreenElement) await document.documentElement.requestFullscreen?.(); else await document.exitFullscreen?.()};
setInterval(updateClock,1000);
setInterval(()=>{state.announcementIndex=(state.announcementIndex+1)%state.announcements.length;renderAnnouncements()},8000);
$("weather").textContent="Aktifkan API cuaca";
renderAnnouncements();renderAgenda();loadSettings();updateClock();getLocation();
