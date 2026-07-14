import { load, save } from "../core/storage.js";
import { DEFAULT_LOC, describe, fetchForecast } from "./weather.js";
import { countUp, flush, stagger, money0, dateLong } from "../core/ui.js";

// หน้า Me — แดชบอร์ดชีวิตวันนี้ อ่านข้อมูลจากทุกแอปมารวมในจอเดียว
// ทุกการ์ดกดแล้วกระโดดไปแท็บที่ลึกกว่าได้ (ยิง event ให้ shell จัดการ)

const GOAL = { water: 8, ex: 45, sleep: 8, steps: 8000 };
const RING_C = 2 * Math.PI * 23; // r=23 ใน viewBox 54

function dayKey(offset = 0) {
  const d = new Date();
  d.setDate(d.getDate() - offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const hasData = (rec) =>
  !!rec && (rec.water > 0 || rec.ex > 0 || rec.sleep > 0 || rec.steps > 0 || rec.weight != null || rec.mood != null);

// นับวันติดต่อกันที่บันทึกสุขภาพ — ถ้าวันนี้ยังไม่บันทึก ให้เริ่มนับจากเมื่อวาน (streak ยังไม่ขาด)
function streakOf(days) {
  const start = hasData(days[dayKey(0)]) ? 0 : 1;
  if (start === 1 && !hasData(days[dayKey(1)])) return 0;
  let n = 0;
  for (let off = start; off < 400; off++) {
    if (!hasData(days[dayKey(off)])) break;
    n++;
  }
  return n;
}

function greet(h) {
  if (h < 5) return "Up late";
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  if (h < 21) return "Good evening";
  return "Winding down";
}

function miniRing(cls, frac, label, center) {
  const f = Math.max(0, Math.min(frac, 1));
  return `<div class="mini ${cls}">
    <div class="dial">
      <svg viewBox="0 0 54 54">
        <circle class="ring-track" cx="27" cy="27" r="23"></circle>
        <circle class="ring-val" cx="27" cy="27" r="23" stroke-dasharray="${f * RING_C} ${RING_C}"></circle>
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
  defaultSize: { w: 410, h: 740 },
  mount(body) {
    body.classList.add("app-pane", "app-me");
    let firstPaint = true;

    const go = (tab) => document.dispatchEvent(new CustomEvent("pp-go", { detail: tab }));

    const render = () => {
      const days = load("health.days", {});
      const t = days[dayKey()] ?? { steps: 0, water: 0, ex: 0, sleep: 0, weight: null, mood: null };
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
      const net = sumIn - sumOut;
      const todayOut = entries
        .filter((e) => e.date === dayKey() && e.type === "out")
        .reduce((s, e) => s + e.amount, 0);

      const undone = todos.filter((x) => !x.done);
      const streak = streakOf(days);
      const logged = [t.water > 0, t.ex > 0, t.sleep > 0, t.weight != null, t.mood != null].filter(Boolean).length;
      const hasApple = !!load("health.lastImport");
      const steps = t.steps ?? 0;

      body.innerHTML = `
        <header class="me-head">
          <div>
            <div class="page-sub">${greet(now.getHours())}</div>
            <button class="me-name">${name || "Set your name"}</button>
            <div class="page-sub">${dateLong(now)}</div>
          </div>
          <div class="me-av">${name ? name.trim().slice(0, 2) : "PP"}</div>
        </header>

        <button class="card" data-go="health">
          <div class="card-head">
            <span class="card-title">Health</span>
            <span class="card-meta">${logged}/5 logged ›</span>
          </div>
          <div class="minis">
            ${miniRing("sleep", (t.sleep ?? 0) / GOAL.sleep, "Sleep", `${t.sleep || 0}`)}
            ${
              // มีข้อมูลก้าวจาก Apple Health แล้วให้โชว์ก้าวแทนน้ำ (แม่นกว่า และไม่ต้องกรอกเอง)
              steps > 0
                ? miniRing("steps", steps / GOAL.steps, "Steps", `${Math.round(steps / 100) / 10}k`)
                : miniRing("water", (t.water ?? 0) / GOAL.water, "Water", `${t.water || 0}`)
            }
            ${miniRing("ex", (t.ex ?? 0) / GOAL.ex, "Exercise", `${t.ex || 0}`)}
          </div>
          <div class="streak">${
            streak > 0 ? `🔥 ${streak}-day logging streak` : "No streak yet — log something today"
          }${hasApple ? " · ⌚ synced with Apple Health" : ""}</div>
        </button>

        <div class="me-duo">
          <button class="card" data-go="weather">
            <div class="card-title">Weather</div>
            <div class="wx-body"><div class="fin-sub">Loading…</div></div>
          </button>
          <button class="card" data-go="money">
            <div class="card-title">Left this month</div>
            <div class="fin-v ${net < 0 ? "neg" : ""}"></div>
            <div class="fin-sub">${todayOut > 0 ? `${money0(todayOut)} spent today` : "Nothing spent today"}</div>
          </button>
        </div>

        <section class="card">
          <div class="card-head">
            <span class="card-title">Tasks</span>
            <span class="card-meta">${undone.length ? `${undone.length} left` : "all clear 🎉"}</span>
          </div>
          <form class="me-todo-add">
            <input name="text" placeholder="Add a task…" autocomplete="off" aria-label="Add a task">
            <button class="btn" type="submit">Add</button>
          </form>
          <div class="list me-todos"></div>
        </section>
      `;

      const finEl = body.querySelector(".fin-v");
      if (firstPaint) countUp(finEl, net, { fmt: money0, dur: 800 });
      else finEl.textContent = money0(net);

      // ---- งานวันนี้: 5 อันแรกที่ยังไม่เสร็จ ติ๊กได้ในตัว ----
      const listEl = body.querySelector(".me-todos");
      if (!undone.length) {
        listEl.innerHTML = `<div class="empty">Nothing pending — add one above</div>`;
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
          listEl.insertAdjacentHTML("beforeend", `<div class="empty">…and ${undone.length - 5} more</div>`);
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

      // ---- ตั้งชื่อ: แก้ inline ไม่เปิด dialog ----
      body.querySelector(".me-name").addEventListener("click", (e) => {
        const btn = e.currentTarget;
        const input = document.createElement("input");
        input.className = "me-name-input";
        input.value = load("os.name", "");
        input.placeholder = "Your name";
        const commit = () => {
          save("os.name", input.value.trim());
          render();
        };
        input.addEventListener("blur", commit);
        input.addEventListener("keydown", (ev) => ev.key === "Enter" && commit());
        btn.replaceWith(input);
        input.focus();
      });

      for (const card of body.querySelectorAll("[data-go]")) {
        card.addEventListener("click", () => go(card.dataset.go));
      }

      // ---- อากาศ: cache ก่อนเสมอ แล้วค่อยอัปเดตเบื้องหลัง ----
      const wxBody = body.querySelector(".wx-body");
      const paint = (data) => {
        const c = data.current;
        const w = describe(c.weather_code);
        wxBody.innerHTML = `
          <div class="wx-line"><span class="e">${w.e}</span><span class="t">${Math.round(c.temperature_2m)}°</span></div>
          <div class="fin-sub">${w.t} · high ${Math.round(data.daily.temperature_2m_max[0])}°</div>`;
      };
      const cached = load("weather.cache");
      if (cached) paint(cached.data);
      fetchForecast(load("weather.loc", DEFAULT_LOC))
        .then((data) => {
          save("weather.cache", { data, ts: Date.now() });
          if (body.isConnected) paint(data);
        })
        .catch(() => {
          if (!cached && body.isConnected) wxBody.innerHTML = `<div class="fin-sub">Offline</div>`;
        });

      stagger(body);
      firstPaint = false;
    };

    flush(body);
    render();
  },
};
