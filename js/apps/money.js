import { load, save } from "../core/storage.js";

const CATS = {
  out: [["อาหาร", "🍜"], ["เดินทาง", "🚗"], ["ของใช้", "🛒"], ["บันเทิง", "🎮"], ["สุขภาพ", "💊"], ["อื่นๆ", "📦"]],
  in: [["เงินเดือน", "💼"], ["ลงทุน", "📈"], ["อื่นๆ", "💵"]],
};

const fmt = (n) => n.toLocaleString("th-TH", { maximumFractionDigits: 2 });
const RING_C = 2 * Math.PI * 26; // เส้นรอบวง r=26 ใน viewBox 64

function localDate() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default {
  id: "money",
  name: "Money",
  icon: "💰",
  defaultSize: { w: 430, h: 720 },
  mount(body) {
    body.classList.add("app-pane", "app-money");
    let entries = load("money.entries", []);
    const now = new Date();
    let ym = { y: now.getFullYear(), m: now.getMonth() };
    let filter = "all"; // all | out | in

    body.innerHTML = `
      <div class="m-nav">
        <button class="btn-ghost prev">‹</button>
        <span class="m"></span>
        <button class="btn-ghost next">›</button>
      </div>
      <div class="m-balance">
        <div class="k">คงเหลือเดือนนี้</div>
        <div class="v"></div>
      </div>
      <div class="m-well hidden">
        <div class="txt"><b></b><span></span></div>
        <div class="dial">
          <svg viewBox="0 0 64 64">
            <circle class="track" cx="32" cy="32" r="26"></circle>
            <circle class="val" cx="32" cy="32" r="26" stroke-dasharray="0 ${RING_C}"></circle>
          </svg>
          <div class="pct"></div>
        </div>
      </div>
      <div class="m-duo">
        <div class="m-card in"><div class="k"><span class="dot">↓</span>รายรับ</div><div class="v"></div></div>
        <div class="m-card out"><div class="k"><span class="dot">↑</span>รายจ่าย</div><div class="v"></div></div>
      </div>
      <form class="money-form">
        <div class="row">
          <input name="amount" type="number" min="0.01" step="0.01" placeholder="จำนวนเงิน (บาท)" required style="flex:1">
          <select name="type"><option value="out">รายจ่าย</option><option value="in">รายรับ</option></select>
        </div>
        <div class="row">
          <select name="cat" style="flex:1"></select>
          <input name="note" placeholder="โน้ต (ไม่บังคับ)" autocomplete="off" style="flex:1.4">
          <button class="btn" type="submit">＋ บันทึก</button>
        </div>
      </form>
      <h3>รายจ่ายตามหมวด</h3>
      <div class="breakdown"></div>
      <div class="m-tabs">
        <button type="button" data-f="all" class="on">ทั้งหมด</button>
        <button type="button" data-f="out">รายจ่าย</button>
        <button type="button" data-f="in">รายรับ</button>
      </div>
      <div class="entries"></div>
    `;

    const form = body.querySelector(".money-form");
    const catSel = form.cat;

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
      body.querySelector(".m-nav .m").textContent = new Date(ym.y, ym.m, 1).toLocaleDateString("th-TH", {
        month: "long",
        year: "numeric",
      });

      const rows = entries.filter(inMonth);
      const sumIn = rows.filter((e) => e.type === "in").reduce((s, e) => s + e.amount, 0);
      const sumOut = rows.filter((e) => e.type === "out").reduce((s, e) => s + e.amount, 0);
      const net = sumIn - sumOut;

      const balEl = body.querySelector(".m-balance .v");
      balEl.textContent = `฿${fmt(net)}`;
      balEl.classList.toggle("neg", net < 0);
      body.querySelector(".m-card.in .v").textContent = `฿${fmt(sumIn)}`;
      body.querySelector(".m-card.out .v").textContent = `฿${fmt(sumOut)}`;

      // การ์ด "เก็บได้" แบบ FinTrack — โชว์เฉพาะเดือนที่มีรายรับ
      const well = body.querySelector(".m-well");
      well.classList.toggle("hidden", sumIn <= 0);
      if (sumIn > 0) {
        const rate = net / sumIn;
        well.classList.toggle("over", net < 0);
        if (net >= 0) {
          well.querySelector("b").textContent = "เยี่ยมมาก!";
          well.querySelector("span").textContent = `เดือนนี้เก็บได้ ฿${fmt(net)} จากรายรับทั้งหมด`;
        } else {
          well.querySelector("b").textContent = "ใช้เกินรายรับ";
          well.querySelector("span").textContent = `เดือนนี้ติดลบ ฿${fmt(-net)} — เช็ครายจ่ายตามหมวดด้านล่าง`;
        }
        const frac = Math.max(0.01, Math.min(Math.abs(rate), 1));
        well.querySelector(".val").setAttribute("stroke-dasharray", `${frac * RING_C} ${RING_C}`);
        well.querySelector(".pct").textContent = `${Math.round(rate * 100)}%`;
      }

      // breakdown รายจ่ายต่อหมวด — แท่งสีเดียว (identity อยู่ที่ label) เรียงมาก→น้อย
      const byCat = {};
      for (const e of rows) if (e.type === "out") byCat[e.cat] = (byCat[e.cat] ?? 0) + e.amount;
      const cats = Object.entries(byCat).sort((a, b) => b[1] - a[1]);
      const maxCat = cats[0]?.[1] ?? 1;
      body.querySelector(".breakdown").innerHTML = cats.length
        ? cats
            .map(
              ([c, a]) => `<div class="cat-row">
                <span class="name">${c}</span>
                <span class="track"><span class="fill" style="width:${(a / maxCat) * 100}%; display:block"></span></span>
                <span class="amt">฿${fmt(a)} · ${Math.round((a / sumOut) * 100)}%</span>
              </div>`
            )
            .join("")
        : `<div class="muted" style="font-size:13px">ยังไม่มีรายจ่ายเดือนนี้</div>`;

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
          <button class="x-btn" title="ลบ">✕</button>
        `;
        row.querySelector(".what").textContent = `${emoji} ${e.cat}${e.note ? " · " + e.note : ""}`;
        row.querySelector(".x-btn").addEventListener("click", () => {
          entries = entries.filter((x) => x.id !== e.id);
          persist();
          update();
        });
        list.append(row);
      }
      if (!visible.length) list.innerHTML = `<div class="muted" style="font-size:13px">ยังไม่มีรายการ</div>`;
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

    update();
  },
};
