import { load, save } from "../core/storage.js";

// Open-Meteo — ฟรี ไม่ต้องมี API key, CORS เปิด
// export ไว้ให้หน้า Me ดึงสภาพอากาศมาโชว์ได้โดยไม่ต้องเขียน logic ซ้ำ
export const DEFAULT_LOC = { lat: 13.7563, lon: 100.5018, label: "กรุงเทพฯ" };
const DAY_TH = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];

const WMO = [
  [[0], "แจ่มใส", "☀️"],
  [[1, 2], "เมฆบางส่วน", "🌤️"],
  [[3], "เมฆมาก", "☁️"],
  [[45, 48], "หมอก", "🌫️"],
  [[51, 53, 55, 56, 57], "ฝนปรอย", "🌦️"],
  [[61, 63, 65, 66, 67], "ฝน", "🌧️"],
  [[71, 73, 75, 77, 85, 86], "หิมะ", "🌨️"],
  [[80, 81, 82], "ฝนซู่", "🌧️"],
  [[95], "ฝนฟ้าคะนอง", "⛈️"],
  [[96, 99], "พายุลูกเห็บ", "⛈️"],
];

export function describe(code) {
  const hit = WMO.find(([codes]) => codes.includes(code));
  return hit ? { t: hit[1], e: hit[2] } : { t: "—", e: "🌡️" };
}

export async function fetchForecast({ lat, lon }) {
  const u = new URL("https://api.open-meteo.com/v1/forecast");
  u.search = new URLSearchParams({
    latitude: lat,
    longitude: lon,
    current: "temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m",
    hourly: "temperature_2m",
    daily: "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max",
    timezone: "auto",
    forecast_days: "6",
  });
  const res = await fetch(u);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// กราฟเส้น 24 ชม. ข้างหน้า สไตล์ Acme — จุดทุก 3 ชม. + อุณหภูมิกำกับ
function hourlyChart(hourly) {
  if (!hourly?.time?.length) return "";
  const nowMs = Date.now();
  let start = hourly.time.findIndex((t) => new Date(t).getTime() >= nowMs);
  if (start < 0) start = 0;

  const pts = [];
  for (let i = 0; i < 8; i++) {
    const j = start + i * 3;
    if (j >= hourly.time.length) break;
    pts.push({ h: new Date(hourly.time[j]).getHours(), t: hourly.temperature_2m[j] });
  }
  if (pts.length < 3) return "";

  const min = Math.min(...pts.map((p) => p.t));
  const max = Math.max(...pts.map((p) => p.t));
  const span = Math.max(1, max - min);
  const W = 320;
  const H = 92;
  const x = (i) => 18 + (i * (W - 36)) / (pts.length - 1);
  const y = (t) => 28 + (1 - (t - min) / span) * 38;
  const path = pts.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.t).toFixed(1)}`).join(" ");

  return `<div class="wx-chart"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="อุณหภูมิ 24 ชั่วโมงข้างหน้า">
    <path d="${path}" fill="none" stroke="#5b5142" stroke-width="1.6"/>
    ${pts
      .map(
        (p, i) => `<circle cx="${x(i).toFixed(1)}" cy="${y(p.t).toFixed(1)}" r="3" fill="#33291c"/>
      <text x="${x(i).toFixed(1)}" y="${(y(p.t) - 9).toFixed(1)}" text-anchor="middle" font-size="10.5" font-family="IBM Plex Mono, monospace" fill="#33291c">${Math.round(p.t)}°</text>
      <text x="${x(i).toFixed(1)}" y="${H - 6}" text-anchor="middle" font-size="9.5" font-family="IBM Plex Mono, monospace" fill="#94886f">${String(p.h).padStart(2, "0")}</text>`
      )
      .join("")}
  </svg></div>`;
}

export default {
  id: "weather",
  name: "Weather",
  icon: "⛅",
  defaultSize: { w: 410, h: 660 },
  mount(body) {
    body.classList.add("app-pane", "app-weather");
    let loc = load("weather.loc", DEFAULT_LOC);

    body.innerHTML = `
      <div class="wx-head">
        <span class="loc"></span>
        <button class="btn-ghost use-geo" title="ใช้ตำแหน่งปัจจุบัน">📍</button>
        <button class="btn-ghost refresh" title="รีเฟรช">⟳</button>
      </div>
      <div class="wx-main"><div class="wx-note">กำลังโหลด…</div></div>
    `;

    const locEl = body.querySelector(".loc");
    const main = body.querySelector(".wx-main");
    locEl.textContent = loc.label;

    const render = (data, ts, stale = false) => {
      const c = data.current;
      const now = describe(c.weather_code);
      const d = data.daily;

      // สเกลร่วมทั้งสัปดาห์ — pill ของแต่ละวันวางบนแกน min→max เดียวกันแบบ Acme
      const weekMin = Math.min(...d.temperature_2m_min);
      const weekMax = Math.max(...d.temperature_2m_max);
      const weekSpan = Math.max(1, weekMax - weekMin);

      const chart = hourlyChart(data.hourly);

      main.innerHTML = `
        <h2 class="wx-serif">Right Now</h2>
        <div class="wx-now">
          <span class="emoji">${now.e}</span>
          <div>
            <div class="t">${Math.round(c.temperature_2m)}°</div>
            <div class="desc">${now.t} · รู้สึกเหมือน ${Math.round(c.apparent_temperature)}°</div>
            <div class="wx-meta">สูงสุด ${Math.round(d.temperature_2m_max[0])}° ต่ำสุด ${Math.round(d.temperature_2m_min[0])}° · ความชื้น ${c.relative_humidity_2m}% · ลม ${Math.round(c.wind_speed_10m)} กม./ชม.</div>
          </div>
        </div>
        ${chart ? `<h2 class="wx-serif">Next 24 Hours</h2>${chart}` : ""}
        <h2 class="wx-serif">Next 6 Days</h2>
        <div class="wx-days">
          ${d.time
            .map((t, i) => {
              const w = describe(d.weather_code[i]);
              const day = i === 0 ? "วันนี้" : DAY_TH[new Date(t).getDay()];
              const lo = d.temperature_2m_min[i];
              const hi = d.temperature_2m_max[i];
              const left = ((lo - weekMin) / weekSpan) * 100;
              const width = Math.max(8, ((hi - lo) / weekSpan) * 100);
              return `<div class="wx-day">
                <span class="d">${day}</span><span class="e">${w.e}</span>
                <span class="rain">💧${d.precipitation_probability_max[i] ?? 0}%</span>
                <span class="wx-range">
                  <span class="lo">${Math.round(lo)}°</span>
                  <span class="track"><span class="pill" style="left:${left.toFixed(1)}%;width:${width.toFixed(1)}%"></span></span>
                  <span class="hi">${Math.round(hi)}°</span>
                </span>
              </div>`;
            })
            .join("")}
        </div>
        <div class="wx-note">${stale ? "ออฟไลน์ · " : ""}อัปเดต ${new Date(ts).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })}</div>
      `;
    };

    const refresh = async () => {
      const cache = load("weather.cache");
      if (cache) render(cache.data, cache.ts, true);
      try {
        const data = await fetchForecast(loc);
        const ts = Date.now();
        save("weather.cache", { data, ts });
        render(data, ts);
      } catch {
        if (!cache) main.innerHTML = `<div class="wx-note">โหลดข้อมูลไม่ได้ — เช็คอินเทอร์เน็ตแล้วกด ⟳</div>`;
      }
    };

    body.querySelector(".refresh").addEventListener("click", refresh);

    body.querySelector(".use-geo").addEventListener("click", () => {
      if (!navigator.geolocation) return;
      locEl.textContent = "กำลังหาตำแหน่ง…";
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          loc = { lat: pos.coords.latitude, lon: pos.coords.longitude, label: "ตำแหน่งของฉัน" };
          save("weather.loc", loc);
          locEl.textContent = loc.label;
          refresh();
        },
        () => {
          locEl.textContent = loc.label;
          main.insertAdjacentHTML("beforeend", `<div class="wx-note">เข้าถึงตำแหน่งไม่ได้ — ใช้ ${loc.label} ต่อ</div>`);
        },
        { timeout: 8000 }
      );
    });

    refresh();
  },
};
