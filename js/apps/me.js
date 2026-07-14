import { load, save } from "../core/storage.js";
import { DEFAULT_LOC, describe, fetchForecast } from "./weather.js";

// หน้า Me — แดชบอร์ดชีวิตวันนี้ อ่านข้อมูลจากทุกแอปมารวมในจอเดียว
// ทุกการ์ดกดแล้วกระโดดไปแท็บที่ลึกกว่าได้ (ยิง event ให้ shell จัดการ)

const GOAL = { water: 8, ex: 45, sleep: 8, steps: 8000 };
const RING_C = 2 * Math.PI * 22; // r=22 ใน viewBox 52
const fmt = (n) => n.toLocaleString("th-TH", { maximumFractionDigits: 0 });

function dayKey(offset = 0) {
  const d = new Date();
  d.setDate(d.getDate() - offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const hasData = (rec) => !!rec && (rec.water > 0 || rec.ex > 0 || rec.sleep > 0 || rec.weight != null || rec.mood != null);

// นับวันติดต่อกันที่บันทึกสุขภาพ — ถ้าวันนี้ยังไม่บันทึก ให้เริ่มนับจากเมื่อวาน (streak ยังไม่ขาด)
function streakOf(days) {
  let start = hasData(days[dayKey(0)]) ? 0 : 1;
  if (start === 1 && !hasData(days[dayKey(1)])) return 0;
  let n = 0;
  for (let off = start; off < 400; off++) {
    if (!hasData(days[dayKey(off)])) break;
    n++;
  }
  return n;
}

function greet(h) {
  if (h < 5) return "ดึกแล้ว";
  if (h < 12) return "สวัสดีตอนเช้า";
  if (h < 17) return "สวัสดีตอนบ่าย";
  if (h < 21) return "สวัสดีตอนเย็น";
  return "ค่ำแล้ว";
}

function miniRing(cls, frac, label, center) {
  const f = Math.max(0, Math.min(frac, 1));
  return `<div class="mini ${cls}">
    <div class="dial">
      <svg viewBox="0 0 52 52">
        <circle class="track" cx="26" cy="26" r="22"></circle>
        <circle class="val" cx="26" cy="26" r="22" stroke-dasharray="${f * RING_C} ${RING_C}"></circle>
      </svg>
      <span class="c">${center}</span>
    </div>
    <span class="l">${label}</span>
  </div>`;
}

export default {
  id: "me",
  name: "Me",
  icon: "🙂",
  defaultSize: { w: 400, h: 720 },
  mount(body) {
    body.classList.add("app-pane", "app-me");

    const go = (tab) => document.dispatchEvent(new CustomEvent("pp-go", { detail: tab }));

    const render = () => {
      const days = load("health.days", {});
      const t = days[dayKey()] ?? { water: 0, ex: 0, sleep: 0, weight: null, mood: null };
      const entries = load("money.entries", []);
      const todos = load("todo.items", []);
      const name = load("os.name", "");
      const now = new Date();

      const ym = { y: now.getFullYear(), m: now.getMonth() };
      const monthRows = entries.filter((e) => {
        const d = new Date(e.date);
        return d.getFullYear() === ym.y && d.getMonth() === ym.m;
      });
      const sumIn = monthRows.filter((e) => e.type === "in").reduce((s, e) => s + e.amount, 0);
      const sumOut = monthRows.filter((e) => e.type === "out").reduce((s, e) => s + e.amount, 0);
      const todayOut = entries
        .filter((e) => e.date === dayKey() && e.type === "out")
        .reduce((s, e) => s + e.amount, 0);

      const undone = todos.filter((x) => !x.done);
      const streak = streakOf(days);
      const logged = [t.water > 0, t.ex > 0, t.sleep > 0, t.weight != null, t.mood != null].filter(Boolean).length;
      const hasApple = !!load("health.lastImport");

      body.innerHTML = `
        <header class="me-head">
          <div>
            <div class="greet">${greet(now.getHours())}</div>
            <button class="me-name">${name ? `${name}` : "ตั้งชื่อของคุณ"}</button>
            <div class="me-date">${now.toLocaleDateString("th-TH", { weekday: "long", day: "numeric", month: "long" })}</div>
          </div>
          <div class="me-av">${name ? name.trim().slice(0, 2) : "PP"}</div>
        </header>

        <button class="me-card ring-card" data-go="health">
          <div class="mc-top">
            <span class="mc-title">สุขภาพวันนี้</span>
            <span class="mc-more">${logged}/5 ครบ ›</span>
          </div>
          <div class="minis">
            ${miniRing("sleep", (t.sleep ?? 0) / GOAL.sleep, "นอน", `${t.sleep || 0}`)}
            ${
              // ถ้ามีข้อมูลก้าวจาก Apple Health ให้โชว์ก้าวแทนน้ำ (แม่นกว่า และ PP ไม่ต้องกรอกเอง)
              t.steps > 0
                ? miniRing("steps", t.steps / GOAL.steps, "ก้าว", `${Math.round(t.steps / 100) / 10}k`)
                : miniRing("water", (t.water ?? 0) / GOAL.water, "น้ำ", `${t.water || 0}`)
            }
            ${miniRing("ex", (t.ex ?? 0) / GOAL.ex, "ออกกำลัง", `${t.ex || 0}`)}
          </div>
          <div class="streak">${
            streak > 0 ? `🔥 บันทึกต่อเนื่อง ${streak} วัน` : "ยังไม่ได้เริ่ม streak — บันทึกวันนี้เลย"
          }${hasApple ? " · ⌚ ซิงก์จาก Apple Health" : ""}</div>
        </button>

        <div class="me-duo">
          <button class="me-card wx-card" data-go="weather">
            <div class="mc-title">อากาศ</div>
            <div class="wx-body"><span class="muted" style="font-size:12.5px">กำลังโหลด…</span></div>
          </button>
          <button class="me-card fin-card" data-go="money">
            <div class="mc-title">คงเหลือเดือนนี้</div>
            <div class="fin-v ${sumIn - sumOut < 0 ? "neg" : ""}">฿${fmt(sumIn - sumOut)}</div>
            <div class="fin-sub">${todayOut > 0 ? `วันนี้ใช้ไป ฿${fmt(todayOut)}` : "วันนี้ยังไม่ได้ใช้เงิน"}</div>
          </button>
        </div>

        <section class="me-card todo-card">
          <div class="mc-top">
            <span class="mc-title">งานวันนี้</span>
            <span class="mc-more">${undone.length ? `เหลือ ${undone.length}` : "เคลียร์หมดแล้ว 🎉"}</span>
          </div>
          <form class="me-todo-add">
            <input name="text" placeholder="เพิ่มงาน…" autocomplete="off">
            <button class="btn" type="submit">＋</button>
          </form>
          <div class="me-todos"></div>
        </section>
      `;

      // ---- งานวันนี้: แสดง 5 อันแรกที่ยังไม่เสร็จ ติ๊กได้ในตัว ----
      const listEl = body.querySelector(".me-todos");
      if (!undone.length) {
        listEl.innerHTML = `<div class="muted" style="font-size:12.5px">ไม่มีงานค้าง — เพิ่มงานใหม่ได้ด้านบน</div>`;
      } else {
        for (const it of undone.slice(0, 5)) {
          const row = document.createElement("label");
          row.className = "me-todo";
          row.innerHTML = `<input type="checkbox"><span></span>`;
          row.querySelector("span").textContent = it.text;
          row.querySelector("input").addEventListener("change", () => {
            const all = load("todo.items", []);
            const hit = all.find((x) => x.id === it.id);
            if (hit) hit.done = true;
            save("todo.items", all);
            render();
          });
          listEl.append(row);
        }
        if (undone.length > 5) {
          listEl.insertAdjacentHTML("beforeend", `<div class="muted" style="font-size:12px">…และอีก ${undone.length - 5} งาน</div>`);
        }
      }

      body.querySelector(".me-todo-add").addEventListener("submit", (e) => {
        e.preventDefault();
        const input = e.target.text;
        const text = input.value.trim();
        if (!text) return;
        const all = load("todo.items", []);
        all.unshift({ id: Date.now(), text, done: false });
        save("todo.items", all);
        render();
      });

      // ---- ตั้งชื่อ: แก้ inline ไม่ใช้ prompt ----
      body.querySelector(".me-name").addEventListener("click", (e) => {
        const btn = e.currentTarget;
        const input = document.createElement("input");
        input.className = "me-name-input";
        input.value = load("os.name", "");
        input.placeholder = "ชื่อของคุณ";
        const commit = () => {
          save("os.name", input.value.trim());
          render();
        };
        input.addEventListener("blur", commit);
        input.addEventListener("keydown", (ev) => {
          if (ev.key === "Enter") commit();
        });
        btn.replaceWith(input);
        input.focus();
      });

      for (const card of body.querySelectorAll("[data-go]")) {
        card.addEventListener("click", () => go(card.dataset.go));
      }

      // ---- อากาศ: ใช้ cache ก่อนเสมอ แล้วค่อยอัปเดตเบื้องหลัง ----
      const wxBody = body.querySelector(".wx-body");
      const paint = (data) => {
        const c = data.current;
        const w = describe(c.weather_code);
        wxBody.innerHTML = `
          <div class="wx-line"><span class="e">${w.e}</span><span class="t">${Math.round(c.temperature_2m)}°</span></div>
          <div class="fin-sub">${w.t} · สูงสุด ${Math.round(data.daily.temperature_2m_max[0])}°</div>`;
      };
      const cached = load("weather.cache");
      if (cached) paint(cached.data);
      fetchForecast(load("weather.loc", DEFAULT_LOC))
        .then((data) => {
          save("weather.cache", { data, ts: Date.now() });
          if (body.isConnected) paint(data);
        })
        .catch(() => {
          if (!cached && body.isConnected) {
            wxBody.innerHTML = `<span class="muted" style="font-size:12.5px">ออฟไลน์</span>`;
          }
        });
    };

    render();
  },
};
