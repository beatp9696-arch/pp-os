import { load, save } from "../core/storage.js";

const MOODS = ["😫", "😕", "😐", "🙂", "😄"];
const METRICS = [
  { m: "water", ico: "💧", lbl: "น้ำดื่ม (แก้ว)", step: 1 },
  { m: "ex", ico: "🏃", lbl: "ออกกำลังกาย (นาที)", step: 10 },
  { m: "sleep", ico: "😴", lbl: "นอน (ชั่วโมง)", step: 0.5 },
];

// key เป็นวันที่ local ไม่ใช่ UTC — ตีสองบ้านเรายังต้องนับเป็นวันนี้
function dayKey(offset = 0) {
  const d = new Date();
  d.setDate(d.getDate() - offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default {
  id: "health",
  name: "Health",
  icon: "❤️",
  defaultSize: { w: 430, h: 600 },
  mount(body) {
    body.classList.add("app-pane", "app-health");
    const days = load("health.days", {});
    const today = () => (days[dayKey()] ??= { water: 0, ex: 0, sleep: 0, weight: null, mood: null });

    body.innerHTML = `
      <div class="today-date">${new Date().toLocaleDateString("th-TH", { weekday: "long", day: "numeric", month: "long" })}</div>
      ${METRICS.map(
        ({ m, ico, lbl }) => `
        <div class="step-row" data-m="${m}">
          <span class="ico">${ico}</span><span class="lbl">${lbl}</span>
          <button class="step-btn" data-d="-1">−</button>
          <span class="val"></span>
          <button class="step-btn" data-d="1">+</button>
        </div>`
      ).join("")}
      <div class="step-row">
        <span class="ico">⚖️</span><span class="lbl">น้ำหนัก (กก.)</span>
        <input class="weight-input" type="number" min="0" step="0.1" placeholder="—">
      </div>
      <div class="step-row">
        <span class="ico">🧠</span><span class="lbl">อารมณ์วันนี้</span>
        <span class="mood">${MOODS.map((e, i) => `<button data-i="${i}">${e}</button>`).join("")}</span>
      </div>
      <h3>ย้อนหลัง 7 วัน</h3>
      ${METRICS.map(
        ({ m, ico, lbl }) => `
        <div class="trend" data-m="${m}">
          <div class="trend-head"><span>${ico} ${lbl}</span><span class="cap"></span></div>
          <div class="bars"></div>
        </div>`
      ).join("")}
    `;

    const persist = () => save("health.days", days);

    const update = () => {
      for (const { m } of METRICS) {
        body.querySelector(`.step-row[data-m="${m}"] .val`).textContent = today()[m];
      }
      body.querySelector(".weight-input").value = today().weight ?? "";
      body.querySelectorAll(".mood button").forEach((b) => {
        b.classList.toggle("sel", Number(b.dataset.i) === today().mood);
      });

      for (const { m } of METRICS) {
        const trend = body.querySelector(`.trend[data-m="${m}"]`);
        const barsEl = trend.querySelector(".bars");
        const vals = [];
        for (let off = 6; off >= 0; off--) {
          const rec = days[dayKey(off)];
          vals.push({ key: dayKey(off), v: rec ? rec[m] || 0 : null });
        }
        const max = Math.max(1, ...vals.map((x) => x.v ?? 0));
        barsEl.innerHTML = vals
          .map(
            (x, i) =>
              `<div class="bar${i === 6 ? " today" : ""}" style="height:${((x.v ?? 0) / max) * 100}%" title="${x.key}: ${x.v ?? "ไม่มีข้อมูล"}"></div>`
          )
          .join("");
        const logged = vals.filter((x) => x.v !== null);
        const avg = logged.length ? Math.round((logged.reduce((s, x) => s + x.v, 0) / logged.length) * 10) / 10 : 0;
        trend.querySelector(".cap").textContent = `วันนี้ ${today()[m]} · เฉลี่ย ${avg}`;
      }
    };

    body.addEventListener("click", (e) => {
      const stepBtn = e.target.closest(".step-btn");
      if (stepBtn) {
        const row = stepBtn.closest(".step-row");
        const { m } = row.dataset;
        const { step } = METRICS.find((x) => x.m === m);
        const next = today()[m] + step * Number(stepBtn.dataset.d);
        today()[m] = Math.max(0, Math.round(next * 10) / 10);
        persist();
        update();
      }
      const moodBtn = e.target.closest(".mood button");
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
    });

    update();
  },
};
