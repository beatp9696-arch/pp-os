import { load, save } from "../core/storage.js";
import { parseAppleExport, parseHealthJSON, mergeDays } from "../core/apple-health.js";
import { flush } from "../core/ui.js";

const MOODS = ["😫", "😕", "😐", "🙂", "😄"];
const METRICS = [
  { m: "steps", ico: "👟", lbl: "ก้าว", step: 500 },
  { m: "water", ico: "💧", lbl: "น้ำดื่ม (แก้ว)", step: 1 },
  { m: "ex", ico: "🏃", lbl: "ออกกำลังกาย (นาที)", step: 10 },
  { m: "sleep", ico: "😴", lbl: "นอน (ชั่วโมง)", step: 0.5 },
];

const GOAL = { steps: 8000, water: 8, ex: 45, sleep: 8 };
const RING_C = 2 * Math.PI * 36; // r=36 ใน viewBox 86
const nf = (n) => n.toLocaleString("th-TH");

// key เป็นวันที่ local ไม่ใช่ UTC — ตีสองบ้านเรายังต้องนับเป็นวันนี้
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
    return { t: "เริ่มวันนี้", d: "ยังไม่มีข้อมูลวันนี้ — นำเข้าจาก Apple Health ได้เลย (ปุ่มมุมขวาบน) หรือกรอกเองด้านล่าง" };
  }
  if (t.sleep > 0 && t.sleep < 6) {
    return { t: "ต้องการการพักฟื้น", warn: true, d: `เมื่อคืนนอน ${t.sleep} ชม. ต่ำกว่าเป้า 8 ชม. — วันนี้ผ่อน strain ลงหน่อย แล้วพยายามเข้านอนให้เร็วขึ้น` };
  }
  if (t.mood != null && t.mood >= 3 && t.sleep >= 7) {
    return { t: "Optimal Health", d: `Recovery เขียว นอนครบ ${t.sleep} ชม. — ร่างกายพร้อมรับ strain เต็มที่ วันนี้ออกกำลังกายหนักได้เลย` };
  }
  if (t.ex >= GOAL.ex) {
    return { t: "Strain ถึงเป้าแล้ว", d: `ออกกำลังกายครบ ${t.ex} นาที — ที่เหลือของวันนี้คือดื่มน้ำให้ครบ ${GOAL.water} แก้ว แล้วนอนให้พอเพื่อ recovery พรุ่งนี้` };
  }
  if (t.steps >= GOAL.steps) {
    return { t: "เดินถึงเป้าแล้ว", d: `${nf(t.steps)} ก้าววันนี้ — เกินเป้า ${nf(GOAL.steps)} ก้าว ร่างกายได้ขยับพอแล้ว` };
  }
  return { t: "Keep building", d: "บันทึกให้ครบทุกตัวชี้วัด แล้วภาพรวมสุขภาพของวันนี้จะชัดขึ้น — ความสม่ำเสมอสำคัญกว่าความหนัก" };
}

const SHEET = `
  <div class="hk-sheet hidden">
    <div class="hk-card">
      <div class="hk-h">
        <span>⌚ นำเข้าจาก Apple Health</span>
        <button class="hk-x" title="ปิด" aria-label="ปิด">✕</button>
      </div>
      <p class="hk-p">เว็บอ่าน Apple Health ตรงๆ ไม่ได้ (Apple เปิดให้เฉพาะแอป native) — แต่เลือกไฟล์เข้ามาได้ ข้อมูลถูกอ่านในเครื่องนี้เท่านั้น ไม่ถูกอัปโหลดไปไหน</p>

      <label class="hk-drop">
        <input type="file" accept=".zip,.xml,.json" class="hk-file" hidden>
        <b>เลือกไฟล์</b>
        <small>export.zip จากแอปสุขภาพ · หรือ .json จาก Shortcut</small>
      </label>
      <div class="hk-status"></div>

      <details class="hk-how">
        <summary>วิธีที่ 1 — ดึงย้อนหลังทั้งหมด (ทำครั้งเดียว ~2 นาที)</summary>
        <ol>
          <li>เปิดแอป <b>สุขภาพ</b> บน iPhone → แตะรูปโปรไฟล์มุมขวาบน</li>
          <li>เลื่อนลงสุด → <b>ส่งออกข้อมูลสุขภาพทั้งหมด</b> → รอสักครู่</li>
          <li>เลือก <b>บันทึกไปยังไฟล์</b> (ได้ไฟล์ <code>ส่งออก.zip</code> / <code>export.zip</code>)</li>
          <li>กลับมาที่นี่ → <b>เลือกไฟล์</b> → เลือก zip นั้น</li>
        </ol>
        <p>ได้: ก้าว, ออกกำลังกาย, การนอน, น้ำดื่ม, น้ำหนัก ย้อนหลังสูงสุด 400 วัน</p>
      </details>

      <details class="hk-how">
        <summary>วิธีที่ 2 — อัปเดตอัตโนมัติทุกวัน (Shortcut)</summary>
        <ol>
          <li>เปิดแอป <b>Shortcuts</b> → สร้าง Shortcut ใหม่</li>
          <li>ใส่ action <b>Find Health Samples</b> ของแต่ละอย่าง (Steps / Exercise Minutes / Sleep / Water / Weight) กรอง <i>Today</i> แล้ว <b>Calculate Statistics → Sum</b></li>
          <li>ใส่ action <b>Text</b> พิมพ์ JSON แบบนี้ (ลากตัวแปรจากขั้นก่อนหน้ามาแทนตัวเลข):<br>
            <code>{"days":{"YYYY-MM-DD":{"steps":8210,"ex":30,"sleep":7.5,"water":6,"weight":70.5}}}</code></li>
          <li>ปิดท้ายด้วย <b>Save File</b> → บันทึกทับไฟล์เดิมใน iCloud Drive ชื่อ <code>pp-health.json</code></li>
          <li>ตั้ง <b>Automation</b> ให้รันทุกวันตอน 4 ทุ่ม — วันไหนอยากอัปเดตก็มากด "เลือกไฟล์" → เลือก pp-health.json</li>
        </ol>
        <p>ถ้าใช้ผ่าน Safari (ไม่ได้ติดตั้งเป็นแอป) ให้ Shortcut สั่ง <b>Open URL</b> ไปที่<br>
          <code>…/pp-os/?hk=&lt;JSON ที่เข้ารหัส Base64&gt;</code> — เปิดปุ๊บข้อมูลเข้าเองทันที ไม่ต้องเลือกไฟล์</p>
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
          <h1 class="page-title">สุขภาพ</h1>
          <div class="page-sub">${new Date().toLocaleDateString("th-TH", { weekday: "long", day: "numeric", month: "long" })}</div>
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
        <span class="chip mon">✓ ครบ <b></b></span>
        <span class="chip steps">👟 <b></b> ก้าว</span>
        <span class="chip water">💧 <b></b> แก้ว</span>
      </div>

      <div class="sec">บันทึกวันนี้</div>
      <div class="card">
        <div class="list">
          ${METRICS.map(
            ({ m, ico, lbl }) => `
            <div class="metric-row" data-m="${m}">
              <span class="ico">${ico}</span><span class="lbl">${lbl}</span>
              <button class="step-btn" data-d="-1" aria-label="ลด ${lbl}">−</button>
              <span class="val"></span>
              <button class="step-btn" data-d="1" aria-label="เพิ่ม ${lbl}">+</button>
            </div>`
          ).join("")}
          <div class="metric-row">
            <span class="ico">⚖️</span><span class="lbl">น้ำหนัก (กก.)</span>
            <input class="weight-input" type="number" min="0" step="0.1" placeholder="—" aria-label="น้ำหนัก">
          </div>
          <div class="metric-row">
            <span class="ico">🧠</span><span class="lbl">อารมณ์วันนี้</span>
            <span class="mood-seg">${MOODS.map((e, i) => `<button data-i="${i}" aria-label="อารมณ์ระดับ ${i + 1}">${e}</button>`).join("")}</span>
          </div>
        </div>
      </div>

      <div class="sec">ย้อนหลัง 7 วัน</div>
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
      setRing("sleep", sleepFrac, `${Math.round(sleepFrac * 100)}%`, `${sleep} ชม.`);
      if (t.mood == null) setRing("rec", 0, "—", "ยังไม่เลือกอารมณ์");
      else setRing("rec", (t.mood + 1) / 5, `${(t.mood + 1) * 20}%`, MOODS[t.mood]);
      setRing("strain", ex / GOAL.ex, `${ex}`, `นาที · เป้า ${GOAL.ex}`);

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
      chip(".chip.steps", steps >= GOAL.steps, nf(steps));
      chip(".chip.water", water >= GOAL.water, `${water}/${GOAL.water}`);

      for (const { m } of METRICS) {
        body.querySelector(`.metric-row[data-m="${m}"] .val`).textContent = nf(val(t, m));
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
              `<div class="bar${i === 6 ? " today" : ""}" style="height:${((x.v ?? 0) / max) * 100}%" title="${x.key}: ${x.v ?? "ไม่มีข้อมูล"}"></div>`
          )
          .join("");
        const logged7 = vals.filter((x) => x.v !== null);
        const avg = logged7.length ? Math.round((logged7.reduce((s, x) => s + x.v, 0) / logged7.length) * 10) / 10 : 0;
        trend.querySelector(".cap").textContent = `วันนี้ ${nf(val(t, m))} · เฉลี่ย ${nf(avg)}`;
      }

      const last = load("health.lastImport");
      body.querySelector(".h-src").textContent = last
        ? `⌚ ซิงก์จาก Apple Health ล่าสุด ${new Date(last.at).toLocaleString("th-TH", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })} · ${last.days} วัน`
        : "ยังไม่เคยนำเข้าจาก Apple Health — กดปุ่ม ⌚ มุมขวาบนเพื่อเลิกกรอกมือ";
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

    // More > "เชื่อมกับ Apple Health" เด้งมาแท็บนี้แล้วสั่งเปิดชีตให้เลย
    document.addEventListener("pp-hk-open", () => body.isConnected && openSheet());

    body.querySelector(".hk-file").addEventListener("change", async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      e.target.value = "";
      status.className = "hk-status busy";
      status.textContent = "กำลังอ่านไฟล์…";

      try {
        const imported = file.name.endsWith(".json")
          ? parseHealthJSON(await file.text())
          : await parseAppleExport(file, ({ mb, records }) => {
              status.textContent = `กำลังอ่าน ${mb.toFixed(1)} MB · ${nf(records)} รายการ…`;
            });

        const res = mergeDays(imported);
        Object.assign(days, load("health.days", {})); // days ใน closure เป็นสำเนาเก่า ต้องดึงของที่ merge แล้วมาทับ

        status.className = "hk-status ok";
        const got = Object.entries(res.filled)
          .filter(([, n]) => n > 0)
          .map(([k, n]) => `${{ steps: "ก้าว", water: "น้ำ", ex: "ออกกำลัง", sleep: "นอน", weight: "น้ำหนัก" }[k]} ${n} วัน`)
          .join(" · ");
        status.textContent = `✓ นำเข้า ${res.days} วัน (${res.from} → ${res.to})\n${got || "ไม่พบตัวชี้วัดที่รองรับในไฟล์นี้"}`;
        update();
      } catch (err) {
        status.className = "hk-status err";
        status.textContent = `นำเข้าไม่สำเร็จ — ${err.message}`;
      }
    });

    flush(body); // ให้เบราว์เซอร์เห็นวงแหวนที่ 0 ก่อน แล้ว update() ค่อยดันขึ้น = เส้นวิ่งให้เห็น
    update();
  },
};
