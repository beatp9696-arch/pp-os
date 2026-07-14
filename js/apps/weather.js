import { load, save } from "../core/storage.js";

// Open-Meteo — ฟรี ไม่ต้องมี API key, CORS เปิด
const DEFAULT_LOC = { lat: 13.7563, lon: 100.5018, label: "กรุงเทพฯ" };
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

function describe(code) {
  const hit = WMO.find(([codes]) => codes.includes(code));
  return hit ? { t: hit[1], e: hit[2] } : { t: "—", e: "🌡️" };
}

async function fetchForecast({ lat, lon }) {
  const u = new URL("https://api.open-meteo.com/v1/forecast");
  u.search = new URLSearchParams({
    latitude: lat,
    longitude: lon,
    current: "temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m",
    daily: "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max",
    timezone: "auto",
    forecast_days: "6",
  });
  const res = await fetch(u);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export default {
  id: "weather",
  name: "Weather",
  icon: "⛅",
  defaultSize: { w: 390, h: 540 },
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
      main.innerHTML = `
        <div class="wx-now">
          <span class="emoji">${now.e}</span>
          <div>
            <div class="t">${Math.round(c.temperature_2m)}°</div>
            <div class="desc">${now.t} · รู้สึกเหมือน ${Math.round(c.apparent_temperature)}°</div>
            <div class="wx-meta">ความชื้น ${c.relative_humidity_2m}% · ลม ${Math.round(c.wind_speed_10m)} กม./ชม.</div>
          </div>
        </div>
        <div class="wx-days">
          ${d.time
            .map((t, i) => {
              const w = describe(d.weather_code[i]);
              const day = i === 0 ? "วันนี้" : DAY_TH[new Date(t).getDay()];
              return `<div class="wx-day">
                <span class="d">${day}</span><span>${w.e}</span>
                <span class="rain">☔ ${d.precipitation_probability_max[i] ?? 0}%</span>
                <span class="range">${Math.round(d.temperature_2m_min[i])}°–${Math.round(d.temperature_2m_max[i])}°</span>
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
