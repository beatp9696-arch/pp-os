import { load, save } from "../core/storage.js";
import { countUp } from "../core/ui.js";

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

// เส้นโค้งลื่นผ่านทุกจุด (Catmull-Rom → Bézier) — เส้นหักศอกทำให้กราฟดูเป็นแผนภูมิราชการ
function smoothPath(pts) {
  if (pts.length < 3) return pts.map((p, i) => `${i ? "L" : "M"}${p.x},${p.y}`).join(" ");
  let d = `M${pts[0].x},${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C${c1x.toFixed(1)},${c1y.toFixed(1)} ${c2x.toFixed(1)},${c2y.toFixed(1)} ${p2.x},${p2.y}`;
  }
  return d;
}

// กราฟ 24 ชม. ข้างหน้า — จุดทุก 3 ชม. + พื้นไล่เฉดใต้เส้น
function hourlyChart(hourly) {
  if (!hourly?.time?.length) return "";
  const nowMs = Date.now();
  let start = hourly.time.findIndex((t) => new Date(t).getTime() >= nowMs);
  if (start < 0) start = 0;

  const raw = [];
  for (let i = 0; i < 8; i++) {
    const j = start + i * 3;
    if (j >= hourly.time.length) break;
    raw.push({ h: new Date(hourly.time[j]).getHours(), t: hourly.temperature_2m[j] });
  }
  if (raw.length < 3) return "";

  const min = Math.min(...raw.map((p) => p.t));
  const max = Math.max(...raw.map((p) => p.t));
  const span = Math.max(1, max - min);
  const W = 330;
  const H = 104;
  const pts = raw.map((p, i) => ({
    ...p,
    x: +(20 + (i * (W - 40)) / (raw.length - 1)).toFixed(1),
    y: +(32 + (1 - (p.t - min) / span) * 40).toFixed(1),
  }));

  const line = smoothPath(pts);
  const area = `${line} L${pts.at(-1).x},${H - 20} L${pts[0].x},${H - 20} Z`;

  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="อุณหภูมิ 24 ชั่วโมงข้างหน้า">
    <defs>
      <linearGradient id="wxg" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="currentColor" stop-opacity="0.16"/>
        <stop offset="100%" stop-color="currentColor" stop-opacity="0"/>
      </linearGradient>
    </defs>
    <path d="${area}" fill="url(#wxg)"/>
    <path d="${line}" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" opacity="0.75"/>
    ${pts
      .map(
        (p, i) => `<circle cx="${p.x}" cy="${p.y}" r="${i === 0 ? 3.6 : 2.6}" fill="currentColor"${i === 0 ? "" : ' opacity="0.55"'}/>
      <text x="${p.x}" y="${(p.y - 10).toFixed(1)}" text-anchor="middle" font-size="10.5" font-family="IBM Plex Mono, monospace" fill="currentColor">${Math.round(p.t)}°</text>
      <text x="${p.x}" y="${H - 4}" text-anchor="middle" font-size="9.5" font-family="IBM Plex Mono, monospace" fill="currentColor" opacity="0.45">${String(p.h).padStart(2, "0")}</text>`
      )
      .join("")}
  </svg>`;
}

export default {
  id: "weather",
  name: "Weather",
  icon: "⛅",
  defaultSize: { w: 420, h: 700 },
  mount(body) {
    body.classList.add("app-pane", "app-weather");
    let loc = load("weather.loc", DEFAULT_LOC);
    let firstPaint = true;

    body.innerHTML = `
      <header class="page-head">
        <div>
          <div class="eyebrow">Weather</div>
          <h1 class="page-title loc"></h1>
        </div>
        <div class="head-actions">
          <button class="icon-btn use-geo" title="ใช้ตำแหน่งปัจจุบัน" aria-label="ใช้ตำแหน่งปัจจุบัน">📍</button>
          <button class="icon-btn refresh" title="รีเฟรช" aria-label="รีเฟรช">⟳</button>
        </div>
      </header>
      <div class="wx-main"><div class="card"><div class="empty">กำลังโหลด…</div></div></div>
    `;

    const locEl = body.querySelector(".loc");
    const main = body.querySelector(".wx-main");
    locEl.textContent = loc.label;

    const render = (data, ts, stale = false) => {
      const c = data.current;
      const now = describe(c.weather_code);
      const d = data.daily;

      // สเกลร่วมทั้งสัปดาห์ — pill ของแต่ละวันวางบนแกน min→max เดียวกัน เทียบข้ามวันได้ด้วยตา
      const weekMin = Math.min(...d.temperature_2m_min);
      const weekMax = Math.max(...d.temperature_2m_max);
      const weekSpan = Math.max(1, weekMax - weekMin);
      const chart = hourlyChart(data.hourly);

      main.innerHTML = `
        <div class="card">
          <div class="card-head"><span class="card-title serif" style="font-size:19px">Right Now</span></div>
          <div class="wx-now">
            <span class="emoji">${now.e}</span>
            <div>
              <div class="t serif"></div>
              <div class="desc">${now.t}</div>
            </div>
          </div>
          <div class="chips">
            <span class="chip">รู้สึกเหมือน <b>${Math.round(c.apparent_temperature)}°</b></span>
            <span class="chip">สูง/ต่ำ <b>${Math.round(d.temperature_2m_max[0])}° / ${Math.round(d.temperature_2m_min[0])}°</b></span>
            <span class="chip">ความชื้น <b>${c.relative_humidity_2m}%</b></span>
            <span class="chip">ลม <b>${Math.round(c.wind_speed_10m)}</b> กม./ชม.</span>
          </div>
        </div>

        ${
          chart
            ? `<div class="card">
                <div class="card-head"><span class="card-title serif" style="font-size:19px">Next 24 Hours</span></div>
                <div class="wx-chart">${chart}</div>
              </div>`
            : ""
        }

        <div class="card">
          <div class="card-head"><span class="card-title serif" style="font-size:19px">Next 6 Days</span></div>
          <div class="list wx-days">
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
                    <span class="track"><span class="pill" style="left:${left.toFixed(1)}%;width:${width.toFixed(1)}%;animation-delay:${i * 60}ms"></span></span>
                    <span class="hi">${Math.round(hi)}°</span>
                  </span>
                </div>`;
              })
              .join("")}
          </div>
        </div>

        <div class="wx-note">${stale ? "ออฟไลน์ · " : ""}อัปเดต ${new Date(ts).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })}</div>
      `;

      const tEl = main.querySelector(".wx-now .t");
      if (firstPaint) countUp(tEl, Math.round(c.temperature_2m), { fmt: (n) => `${Math.round(n)}°`, dur: 650 });
      else tEl.textContent = `${Math.round(c.temperature_2m)}°`;
      firstPaint = false;
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
        if (!cache) main.innerHTML = `<div class="card"><div class="empty">โหลดข้อมูลไม่ได้ — เช็คอินเทอร์เน็ตแล้วกด ⟳</div></div>`;
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
          firstPaint = true;
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
