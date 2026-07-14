import { load, save } from "../core/storage.js";
import { countUp, flush } from "../core/ui.js";

const CATS = {
  out: [["อาหาร", "🍜"], ["เดินทาง", "🚗"], ["ของใช้", "🛒"], ["บันเทิง", "🎮"], ["สุขภาพ", "💊"], ["อื่นๆ", "📦"]],
  in: [["เงินเดือน", "💼"], ["ลงทุน", "📈"], ["อื่นๆ", "💵"]],
};

const fmt = (n) => n.toLocaleString("th-TH", { maximumFractionDigits: 2 });
const RING_C = 2 * Math.PI * 30; // r=30 ใน viewBox 72

function localDate() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default {
  id: "money",
  name: "Money",
  icon: "💰",
  defaultSize: { w: 430, h: 740 },
  mount(body) {
    body.classList.add("app-pane", "app-money");
    let entries = load("money.entries", []);
    const now = new Date();
    let ym = { y: now.getFullYear(), m: now.getMonth() };
    let filter = "all"; // all | out | in
    let firstPaint = true;

    body.innerHTML = `
      <header class="page-head">
        <div>
          <div class="eyebrow">PP · Money</div>
          <h1 class="page-title">การเงิน</h1>
        </div>
        <div class="head-actions">
          <div class="month-pick">
            <button class="prev" aria-label="เดือนก่อนหน้า">‹</button>
            <span class="m"></span>
            <button class="next" aria-label="เดือนถัดไป">›</button>
          </div>
        </div>
      </header>

      <div class="card hero">
        <div class="hero-top">
          <div>
            <div class="k">คงเหลือเดือนนี้</div>
            <div class="big"></div>
            <div class="note"></div>
          </div>
          <div class="dial-sm">
            <svg viewBox="0 0 72 72">
              <circle class="ring-track" cx="36" cy="36" r="30"></circle>
              <circle class="ring-val" cx="36" cy="36" r="30" stroke-dasharray="0 ${RING_C}"></circle>
            </svg>
            <div class="c"></div>
          </div>
        </div>
        <div class="hero-split">
          <div class="io in"><div class="k"><span class="dot">↓</span>รายรับ</div><div class="v"></div></div>
          <div class="io out"><div class="k"><span class="dot">↑</span>รายจ่าย</div><div class="v"></div></div>
        </div>
      </div>

      <div class="sec">บันทึกรายการ</div>
      <form class="card money-form">
        <div class="row">
          <input name="amount" type="number" min="0.01" step="0.01" placeholder="จำนวนเงิน (บาท)" required style="flex:1" aria-label="จำนวนเงิน">
          <select name="type" aria-label="ประเภท"><option value="out">รายจ่าย</option><option value="in">รายรับ</option></select>
        </div>
        <div class="row">
          <select name="cat" style="flex:1" aria-label="หมวด"></select>
          <input name="note" placeholder="โน้ต (ไม่บังคับ)" autocomplete="off" style="flex:1.3">
          <button class="btn" type="submit">บันทึก</button>
        </div>
      </form>

      <div class="sec">รายจ่ายตามหมวด</div>
      <div class="card breakdown"></div>

      <div class="sec">รายการเดือนนี้</div>
      <div class="card">
        <div class="seg m-tabs">
          <button type="button" data-f="all" class="on">ทั้งหมด</button>
          <button type="button" data-f="out">รายจ่าย</button>
          <button type="button" data-f="in">รายรับ</button>
        </div>
        <div class="list entries"></div>
      </div>
    `;

    const form = body.querySelector(".money-form");
    const catSel = form.cat;
    const bigEl = body.querySelector(".hero .big");

    const fillCats = () => {
      catSel.innerHTML = CATS[form.type.value].map(([c, e]) => `<option value="${c}">${e} ${c}</option>`).join("");
    };
    form.type.addEventListener("change", fillCats);
    fillCats();

    const persist = () => save("money.entries", entries);
    const inMonth = (e) => {
      const d = new Date(e.date);
      return d.getFullYear() === ym.y && d.getMonth() === ym.m;
    };

    const update = () => {
      body.querySelector(".month-pick .m").textContent = new Date(ym.y, ym.m, 1).toLocaleDateString("th-TH", {
        month: "short",
        year: "numeric",
      });

      const rows = entries.filter(inMonth);
      const sumIn = rows.filter((e) => e.type === "in").reduce((s, e) => s + e.amount, 0);
      const sumOut = rows.filter((e) => e.type === "out").reduce((s, e) => s + e.amount, 0);
      const net = sumIn - sumOut;

      bigEl.classList.toggle("neg", net < 0);
      if (firstPaint) countUp(bigEl, net, { fmt: (n) => `฿${fmt(Math.round(n))}` });
      else bigEl.textContent = `฿${fmt(net)}`;

      body.querySelector(".io.in .v").textContent = `฿${fmt(sumIn)}`;
      body.querySelector(".io.out .v").textContent = `฿${fmt(sumOut)}`;

      // วงแหวน "เก็บได้กี่ % ของรายรับ" — เดือนที่ไม่มีรายรับก็ไม่มีอะไรให้วัด
      const dial = body.querySelector(".dial-sm");
      const noteEl = body.querySelector(".hero .note");
      if (sumIn > 0) {
        const rate = net / sumIn;
        dial.classList.remove("hidden");
        dial.classList.toggle("over", net < 0);
        dial.querySelector(".ring-val").setAttribute(
          "stroke-dasharray",
          `${Math.max(0.02, Math.min(Math.abs(rate), 1)) * RING_C} ${RING_C}`
        );
        dial.querySelector(".c").textContent = `${Math.round(rate * 100)}%`;
        noteEl.textContent =
          net >= 0
            ? `เก็บได้ ฿${fmt(net)} จากรายรับ ฿${fmt(sumIn)}`
            : `ใช้เกินรายรับ ฿${fmt(-net)} — ดูรายจ่ายตามหมวดด้านล่าง`;
      } else {
        dial.classList.add("hidden");
        noteEl.textContent = rows.length ? "เดือนนี้ยังไม่มีรายรับ" : "ยังไม่มีรายการเดือนนี้";
      }

      // breakdown — แท่งสีเดียว เรียงมาก→น้อย (identity อยู่ที่ label ไม่ใช่สี)
      const byCat = {};
      for (const e of rows) if (e.type === "out") byCat[e.cat] = (byCat[e.cat] ?? 0) + e.amount;
      const cats = Object.entries(byCat).sort((a, b) => b[1] - a[1]);
      const maxCat = cats[0]?.[1] ?? 1;
      body.querySelector(".breakdown").innerHTML = cats.length
        ? cats
            .map(
              ([c, a], i) => `<div class="cat-row">
                <span class="name">${c}</span>
                <span class="track"><span class="fill" style="width:${(a / maxCat) * 100}%; animation-delay:${i * 45}ms"></span></span>
                <span class="amt">฿${fmt(a)} · ${Math.round((a / sumOut) * 100)}%</span>
              </div>`
            )
            .join("")
        : `<div class="empty">ยังไม่มีรายจ่ายเดือนนี้</div>`;

      const list = body.querySelector(".entries");
      list.innerHTML = "";
      const visible = rows.filter((e) => filter === "all" || e.type === filter);
      for (const e of visible.slice().sort((a, b) => b.id - a.id)) {
        const row = document.createElement("div");
        row.className = "entry";
        const emoji = (CATS[e.type].find(([c]) => c === e.cat) ?? ["", "•"])[1];
        row.innerHTML = `
          <span class="d">${new Date(e.date).toLocaleDateString("th-TH", { day: "numeric", month: "short" })}</span>
          <span class="what"></span>
          <span class="amt ${e.type}">${e.type === "in" ? "+" : "−"}฿${fmt(e.amount)}</span>
          <button class="x-btn" title="ลบ" aria-label="ลบรายการ">✕</button>
        `;
        row.querySelector(".what").textContent = `${emoji} ${e.cat}${e.note ? " · " + e.note : ""}`;
        row.querySelector(".x-btn").addEventListener("click", () => {
          entries = entries.filter((x) => x.id !== e.id);
          persist();
          update();
        });
        list.append(row);
      }
      if (!visible.length) list.innerHTML = `<div class="empty">ยังไม่มีรายการ</div>`;

      firstPaint = false;
    };

    body.querySelector(".m-tabs").addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-f]");
      if (!btn) return;
      filter = btn.dataset.f;
      body.querySelectorAll(".m-tabs button").forEach((b) => b.classList.toggle("on", b === btn));
      update();
    });

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const amount = parseFloat(form.amount.value);
      if (!Number.isFinite(amount) || amount <= 0) return;
      entries.push({
        id: Date.now(),
        date: localDate(),
        type: form.type.value,
        amount,
        cat: form.cat.value,
        note: form.note.value.trim(),
      });
      form.amount.value = "";
      form.note.value = "";
      persist();
      update();
    });

    body.querySelector(".prev").addEventListener("click", () => {
      ym = ym.m === 0 ? { y: ym.y - 1, m: 11 } : { y: ym.y, m: ym.m - 1 };
      update();
    });
    body.querySelector(".next").addEventListener("click", () => {
      ym = ym.m === 11 ? { y: ym.y + 1, m: 0 } : { y: ym.y, m: ym.m + 1 };
      update();
    });

    flush(body);
    update();
  },
};
