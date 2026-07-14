import { load, save } from "../core/storage.js";
import { parseAppleExport, parseHealthJSON, mergeDays } from "../core/apple-health.js";
import { flush, stagger, num, dateLong, dateShort, timeShort } from "../core/ui.js";

const MOODS = ["😫", "😕", "😐", "🙂", "😄"];
const METRICS = [
  { m: "steps", ico: "👟", lbl: "Steps", step: 500 },
  { m: "water", ico: "💧", lbl: "Water", unit: "glasses", step: 1 },
  { m: "ex", ico: "🏃", lbl: "Exercise", unit: "min", step: 10 },
  { m: "sleep", ico: "😴", lbl: "Sleep", unit: "hrs", step: 0.5 },
];

const GOAL = { steps: 8000, water: 8, ex: 45, sleep: 8 };
const RING_C = 2 * Math.PI * 36; // r=36 ใน viewBox 86

function dayKey(offset = 0) {
  const d = new Date();
  d.setDate(d.getDate() - offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function ringHTML(id, color, name) {
  return `<div class="ring" data-r="${id}" data-c="${color}">
    <div class="dial">
      <svg viewBox="0 0 86 86">
        <circle class="ring-track" cx="43" cy="43" r="36"></circle>
        <circle class="ring-val" cx="43" cy="43" r="36" stroke-dasharray="0 ${RING_C}"></circle>
      </svg>
      <div class="pct"></div>
    </div>
    <span class="name">${name}</span>
    <span class="sub"></span>
  </div>`;
}

// insight แบบ WHOOP — อ่านข้อมูลวันนี้แล้วสรุปว่าร่างกายพร้อมแค่ไหน
function insight(t, logged) {
  if (!logged) {
    return { t: "Get started", d: "No data yet today. Import from Apple Health (top right) — or log it by hand below." };
  }
  if (t.sleep > 0 && t.sleep < 6) {
    return {
      t: "Needs recovery",
      warn: true,
      d: `You slept ${t.sleep} hrs, below your 8-hour target. Ease off strain today and get to bed earlier tonight.`,
    };
  }
  if (t.mood != null && t.mood >= 3 && t.sleep >= 7) {
    return { t: "Optimal health", d: `Recovery is green on ${t.sleep} hrs of sleep. Your body can take on significant strain today.` };
  }
  if (t.ex >= GOAL.ex) {
    return { t: "Strain target met", d: `${t.ex} minutes logged. Finish the day with ${GOAL.water} glasses of water and a full night's sleep.` };
  }
  if (t.steps >= GOAL.steps) {
    return { t: "Step goal met", d: `${num(t.steps)} steps today, past your ${num(GOAL.steps)} goal. Your body has moved enough.` };
  }
  return { t: "Keep building", d: "Log every metric and today's picture gets sharper. Consistency beats intensity." };
}

const SHEET = `
  <div class="hk-sheet hidden">
    <div class="hk-card">
      <div class="hk-h">
        <span>⌚ Import from Apple Health</span>
        <button class="hk-x" title="Close" aria-label="Close">✕</button>
      </div>
      <p class="hk-p">The web can't read Apple Health directly — Apple only opens HealthKit to native apps. Pick a file instead: it's parsed on this device and never uploaded anywhere.</p>

      <label class="hk-drop">
        <input type="file" accept=".zip,.xml,.json" class="hk-file" hidden>
        <b>Choose a file</b>
        <small>export.zip from the Health app · or .json from a Shortcut</small>
      </label>
      <div class="hk-status"></div>

      <details class="hk-how">
        <summary>Option 1 — Backfill everything (one time, ~2 min)</summary>
        <ol>
          <li>Open the <b>Health</b> app on iPhone → tap your profile picture</li>
          <li>Scroll to the bottom → <b>Export All Health Data</b> → wait a moment</li>
          <li>Choose <b>Save to Files</b> (you get <code>export.zip</code>)</li>
          <li>Come back here → <b>Choose a file</b> → pick that zip</li>
        </ol>
        <p>Imports steps, exercise, sleep, water and weight — up to 400 days back.</p>
      </details>

      <details class="hk-how">
        <summary>Option 2 — Daily auto-update (Shortcut)</summary>
        <ol>
          <li>Open <b>Shortcuts</b> → new shortcut</li>
          <li>Add <b>Find Health Samples</b> for each metric (Steps / Exercise Minutes / Sleep / Water / Weight), filter <i>Today</i>, then <b>Calculate Statistics → Sum</b></li>
          <li>Add a <b>Text</b> action with this JSON (drag the variables in place of the numbers):<br>
            <code>{"days":{"YYYY-MM-DD":{"steps":8210,"ex":30,"sleep":7.5,"water":6,"weight":70.5}}}</code></li>
          <li>Finish with <b>Save File</b> → overwrite <code>pp-health.json</code> in iCloud Drive</li>
          <li>Set an <b>Automation</b> to run it daily at 10pm — then just pick that file here whenever you want to sync</li>
        </ol>
        <p>On Safari (not installed as an app), have the Shortcut <b>Open URL</b> instead:<br>
          <code>…/pp-os/?hk=&lt;base64-encoded JSON&gt;</code> — data lands the moment the page opens, no file picking.</p>
      </details>
    </div>
  </div>
`;

export default {
  id: "health",
  name: "Health",
  icon: "❤️",
  defaultSize: { w: 430, h: 740 },
  mount(body) {
    body.classList.add("app-pane", "app-health");
    const days = load("health.days", {});
    const today = () => (days[dayKey()] ??= { steps: 0, water: 0, ex: 0, sleep: 0, weight: null, mood: null });
    const val = (rec, m) => rec?.[m] ?? 0; // วันเก่าที่บันทึกก่อนมี steps จะไม่มี key นี้

    body.innerHTML = `
      <header class="page-head">
        <div>
          <div class="eyebrow">PP · Health</div>
          <h1 class="page-title">Today</h1>
          <div class="page-sub">${dateLong()}</div>
        </div>
        <div class="head-actions">
          <button class="btn-soft h-import">⌚ Apple Health</button>
        </div>
      </header>

      <div class="card">
        <div class="rings">
          ${ringHTML("sleep", "blue", "SLEEP")}
          ${ringHTML("rec", "green", "RECOVERY")}
          ${ringHTML("strain", "cyan", "STRAIN")}
        </div>
      </div>

      <div class="card insight"><div class="t"></div><div class="d"></div></div>

      <div class="chips">
        <span class="chip mon">✓ Logged <b></b></span>
        <span class="chip steps">👟 <b></b> steps</span>
        <span class="chip water">💧 <b></b> glasses</span>
      </div>

      <div class="sec">Log today</div>
      <div class="card">
        <div class="list">
          ${METRICS.map(
            ({ m, ico, lbl, unit }) => `
            <div class="metric-row" data-m="${m}">
              <span class="ico">${ico}</span>
              <span class="lbl">${lbl}${unit ? ` <span class="unit">${unit}</span>` : ""}</span>
              <button class="step-btn" data-d="-1" aria-label="Decrease ${lbl}">−</button>
              <span class="val"></span>
              <button class="step-btn" data-d="1" aria-label="Increase ${lbl}">+</button>
            </div>`
          ).join("")}
          <div class="metric-row">
            <span class="ico">⚖️</span><span class="lbl">Weight <span class="unit">kg</span></span>
            <input class="weight-input" type="number" min="0" step="0.1" placeholder="—" aria-label="Weight">
          </div>
          <div class="metric-row">
            <span class="ico">🧠</span><span class="lbl">Mood</span>
            <span class="mood-seg">${MOODS.map((e, i) => `<button data-i="${i}" aria-label="Mood level ${i + 1}">${e}</button>`).join("")}</span>
          </div>
        </div>
      </div>

      <div class="sec">Last 7 days</div>
      <div class="card">
        ${METRICS.map(
          ({ m, ico, lbl }) => `
          <div class="trend" data-m="${m}">
            <div class="trend-head"><span>${ico} ${lbl}</span><span class="cap"></span></div>
            <div class="bars"></div>
          </div>`
        ).join("")}
      </div>

      <div class="h-src"></div>
      ${SHEET}
    `;

    const persist = () => save("health.days", days);

    const setRing = (id, frac, center, sub) => {
      const ring = body.querySelector(`.ring[data-r="${id}"]`);
      const clamped = Math.max(0, Math.min(frac, 1));
      ring.querySelector(".ring-val").setAttribute("stroke-dasharray", `${clamped * RING_C} ${RING_C}`);
      ring.querySelector(".pct").textContent = center;
      ring.querySelector(".sub").textContent = sub;
    };

    const update = () => {
      const t = today();
      const [steps, water, ex, sleep] = [val(t, "steps"), val(t, "water"), val(t, "ex"), val(t, "sleep")];

      const sleepFrac = sleep / GOAL.sleep;
      setRing("sleep", sleepFrac, `${Math.round(sleepFrac * 100)}%`, `${sleep} hrs`);
      if (t.mood == null) setRing("rec", 0, "—", "no mood yet");
      else setRing("rec", (t.mood + 1) / 5, `${(t.mood + 1) * 20}%`, MOODS[t.mood]);
      setRing("strain", ex / GOAL.ex, `${ex}`, `min · goal ${GOAL.ex}`);

      const logged = [water > 0, ex > 0, sleep > 0, t.weight != null, t.mood != null].filter(Boolean).length;
      const ins = insight({ ...t, steps, sleep, ex }, logged);
      const card = body.querySelector(".insight");
      card.classList.toggle("warn", !!ins.warn);
      card.querySelector(".t").textContent = ins.t;
      card.querySelector(".d").textContent = ins.d;

      const chip = (sel, on, text) => {
        const el = body.querySelector(sel);
        el.classList.toggle("on", on);
        el.querySelector("b").textContent = text;
      };
      chip(".chip.mon", logged >= 4, `${logged}/5`);
      chip(".chip.steps", steps >= GOAL.steps, num(steps));
      chip(".chip.water", water >= GOAL.water, `${water}/${GOAL.water}`);

      for (const { m } of METRICS) {
        body.querySelector(`.metric-row[data-m="${m}"] .val`).textContent = num(val(t, m));
      }
      body.querySelector(".weight-input").value = t.weight ?? "";
      body.querySelectorAll(".mood-seg button").forEach((b) => {
        b.classList.toggle("sel", Number(b.dataset.i) === t.mood);
      });

      for (const { m } of METRICS) {
        const trend = body.querySelector(`.trend[data-m="${m}"]`);
        const vals = [];
        for (let off = 6; off >= 0; off--) {
          const rec = days[dayKey(off)];
          vals.push({ key: dayKey(off), v: rec ? val(rec, m) : null });
        }
        const max = Math.max(1, ...vals.map((x) => x.v ?? 0));
        trend.querySelector(".bars").innerHTML = vals
          .map(
            (x, i) =>
              `<div class="bar${i === 6 ? " today" : ""}" style="height:${((x.v ?? 0) / max) * 100}%" title="${x.key}: ${x.v ?? "no data"}"></div>`
          )
          .join("");
        const logged7 = vals.filter((x) => x.v !== null);
        const avg = logged7.length ? Math.round((logged7.reduce((s, x) => s + x.v, 0) / logged7.length) * 10) / 10 : 0;
        trend.querySelector(".cap").textContent = `today ${num(val(t, m))} · avg ${num(avg)}`;
      }

      const last = load("health.lastImport");
      body.querySelector(".h-src").textContent = last
        ? `⌚ Last synced from Apple Health ${dateShort(new Date(last.at))}, ${timeShort(new Date(last.at))} · ${last.days} days`
        : "Never synced with Apple Health — tap ⌚ above to stop logging by hand";
    };

    body.addEventListener("click", (e) => {
      const stepBtn = e.target.closest(".step-btn");
      if (stepBtn) {
        const { m } = stepBtn.closest(".metric-row").dataset;
        const { step } = METRICS.find((x) => x.m === m);
        const next = val(today(), m) + step * Number(stepBtn.dataset.d);
        today()[m] = Math.max(0, Math.round(next * 10) / 10);
        persist();
        update();
      }
      const moodBtn = e.target.closest(".mood-seg button");
      if (moodBtn) {
        today().mood = Number(moodBtn.dataset.i);
        persist();
        update();
      }
    });

    body.querySelector(".weight-input").addEventListener("change", (e) => {
      const v = parseFloat(e.target.value);
      today().weight = Number.isFinite(v) && v > 0 ? v : null;
      persist();
      update();
    });

    // ---- Apple Health import ----
    const sheet = body.querySelector(".hk-sheet");
    const status = body.querySelector(".hk-status");
    const openSheet = () => sheet.classList.remove("hidden");
    const closeSheet = () => sheet.classList.add("hidden");

    body.querySelector(".h-import").addEventListener("click", openSheet);
    body.querySelector(".hk-x").addEventListener("click", closeSheet);
    sheet.addEventListener("click", (e) => e.target === sheet && closeSheet());
    addEventListener("keydown", (e) => e.key === "Escape" && body.isConnected && closeSheet());
    document.addEventListener("pp-hk-open", () => body.isConnected && openSheet());

    body.querySelector(".hk-file").addEventListener("change", async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      e.target.value = "";
      status.className = "hk-status busy";
      status.textContent = "Reading file…";

      try {
        const imported = file.name.endsWith(".json")
          ? parseHealthJSON(await file.text())
          : await parseAppleExport(file, ({ mb, records }) => {
              status.textContent = `Reading ${mb.toFixed(1)} MB · ${num(records)} records…`;
            });

        const res = mergeDays(imported);
        Object.assign(days, load("health.days", {})); // days ใน closure เป็นสำเนาเก่า ต้องดึงของที่ merge แล้วมาทับ

        status.className = "hk-status ok";
        const got = Object.entries(res.filled)
          .filter(([, n]) => n > 0)
          .map(([k, n]) => `${{ steps: "steps", water: "water", ex: "exercise", sleep: "sleep", weight: "weight" }[k]} ${n}d`)
          .join(" · ");
        status.textContent = `✓ Imported ${res.days} days (${res.from} → ${res.to})\n${got || "No supported metrics found in this file"}`;
        update();
      } catch (err) {
        status.className = "hk-status err";
        status.textContent = `Import failed — ${err.message}`;
      }
    });

    stagger(body);
    flush(body); // ให้เบราว์เซอร์เห็นวงแหวนที่ 0 ก่อน แล้ว update() ค่อยดันขึ้น = เส้นวิ่งให้เห็น
    update();
  },
};
