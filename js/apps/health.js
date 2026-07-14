import { load, save } from "../core/storage.js";

const MOODS = ["😫", "😕", "😐", "🙂", "😄"];
const METRICS = [
  { m: "water", ico: "💧", lbl: "น้ำดื่ม (แก้ว)", step: 1 },
  { m: "ex", ico: "🏃", lbl: "ออกกำลังกาย (นาที)", step: 10 },
  { m: "sleep", ico: "😴", lbl: "นอน (ชั่วโมง)", step: 0.5 },
];

// เป้าประจำวัน — ใช้คำนวณ % ของวงแหวน
const GOAL = { water: 8, ex: 45, sleep: 8 };
const RING_C = 2 * Math.PI * 35; // เส้นรอบวง r=35 ใน viewBox 84

// key เป็นวันที่ local ไม่ใช่ UTC — ตีสองบ้านเรายังต้องนับเป็นวันนี้
function dayKey(offset = 0) {
  const d = new Date();
  d.setDate(d.getDate() - offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function ringHTML(id, color, name) {
  return `<div class="ring" data-r="${id}" data-c="${color}">
    <div class="dial">
      <svg viewBox="0 0 84 84">
        <circle class="track" cx="42" cy="42" r="35"></circle>
        <circle class="val" cx="42" cy="42" r="35" stroke-dasharray="0 ${RING_C}"></circle>
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
    return { t: "เริ่มวันนี้", d: "ยังไม่มีข้อมูลวันนี้ — เริ่มจากบันทึกชั่วโมงนอนเมื่อคืน แล้วค่อยเติมน้ำดื่มกับการออกกำลังกายระหว่างวัน" };
  }
  if (t.sleep > 0 && t.sleep < 6) {
    return { t: "ต้องการการพักฟื้น", warn: true, d: `เมื่อคืนนอน ${t.sleep} ชม. ต่ำกว่าเป้า 8 ชม. — วันนี้ผ่อน strain ลงหน่อย แล้วพยายามเข้านอนให้เร็วขึ้น` };
  }
  if (t.mood != null && t.mood >= 3 && t.sleep >= 7) {
    return { t: "OPTIMAL HEALTH", d: `Recovery เขียว นอนครบ ${t.sleep} ชม. — ร่างกายพร้อมรับ strain เต็มที่ วันนี้ออกกำลังกายหนักได้เลย` };
  }
  if (t.ex >= GOAL.ex) {
    return { t: "STRAIN ถึงเป้าแล้ว", d: `ออกกำลังกายครบ ${t.ex} นาที — ที่เหลือของวันนี้คือดื่มน้ำให้ครบ ${GOAL.water} แก้ว แล้วนอนให้พอเพื่อ recovery พรุ่งนี้` };
  }
  return { t: "KEEP BUILDING", d: "บันทึกให้ครบทุกตัวชี้วัด แล้วภาพรวมสุขภาพของวันนี้จะชัดขึ้น — ความสม่ำเสมอสำคัญกว่าความหนัก" };
}

export default {
  id: "health",
  name: "Health",
  icon: "❤️",
  defaultSize: { w: 410, h: 700 },
  mount(body) {
    body.classList.add("app-pane", "app-health");
    const days = load("health.days", {});
    const today = () => (days[dayKey()] ??= { water: 0, ex: 0, sleep: 0, weight: null, mood: null });

    body.innerHTML = `
      <div class="h-top">
        <span class="h-brand">PP · HEALTH</span>
        <span class="h-date">${new Date().toLocaleDateString("th-TH", { weekday: "long", day: "numeric", month: "long" })}</span>
      </div>
      <div class="rings">
        ${ringHTML("sleep", "blue", "SLEEP")}
        ${ringHTML("rec", "green", "RECOVERY")}
        ${ringHTML("strain", "cyan", "STRAIN")}
      </div>
      <div class="h-insight"><div class="t"></div><div class="d"></div></div>
      <div class="h-chips">
        <span class="h-chip mon">✓ HEALTH MONITOR <b></b></span>
        <span class="h-chip">💧 น้ำดื่ม <b></b></span>
      </div>
      <h3>บันทึกวันนี้</h3>
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

    const setRing = (id, frac, center, sub) => {
      const ring = body.querySelector(`.ring[data-r="${id}"]`);
      const clamped = Math.max(0, Math.min(frac, 1));
      ring.querySelector(".val").setAttribute("stroke-dasharray", `${clamped * RING_C} ${RING_C}`);
      ring.querySelector(".pct").textContent = center;
      ring.querySelector(".sub").textContent = sub;
    };

    const update = () => {
      const t = today();

      const sleepFrac = t.sleep / GOAL.sleep;
      setRing("sleep", sleepFrac, `${Math.round(sleepFrac * 100)}%`, `${t.sleep} ชม.`);
      if (t.mood == null) setRing("rec", 0, "—", "ยังไม่เลือกอารมณ์");
      else setRing("rec", (t.mood + 1) / 5, `${(t.mood + 1) * 20}%`, MOODS[t.mood]);
      setRing("strain", t.ex / GOAL.ex, `${t.ex}`, `นาที / เป้า ${GOAL.ex}`);

      const logged = [t.water > 0, t.ex > 0, t.sleep > 0, t.weight != null, t.mood != null].filter(Boolean).length;
      const ins = insight(t, logged);
      const card = body.querySelector(".h-insight");
      card.classList.toggle("warn", !!ins.warn);
      card.querySelector(".t").textContent = ins.t;
      card.querySelector(".d").textContent = ins.d;

      const mon = body.querySelector(".h-chip.mon");
      mon.classList.toggle("ok", logged >= 4);
      mon.querySelector("b").textContent = `${logged}/5 METRICS`;
      body.querySelector(".h-chip:not(.mon) b").textContent = `${t.water}/${GOAL.water} แก้ว`;

      for (const { m } of METRICS) {
        body.querySelector(`.step-row[data-m="${m}"] .val`).textContent = t[m];
      }
      body.querySelector(".weight-input").value = t.weight ?? "";
      body.querySelectorAll(".mood button").forEach((b) => {
        b.classList.toggle("sel", Number(b.dataset.i) === t.mood);
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
        const logged7 = vals.filter((x) => x.v !== null);
        const avg = logged7.length ? Math.round((logged7.reduce((s, x) => s + x.v, 0) / logged7.length) * 10) / 10 : 0;
        trend.querySelector(".cap").textContent = `วันนี้ ${t[m]} · เฉลี่ย ${avg}`;
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
      update();
    });

    update();
  },
};
