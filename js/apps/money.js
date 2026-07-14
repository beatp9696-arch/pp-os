import { load, save } from "../core/storage.js";

const CATS = {
  out: [["อาหาร", "🍜"], ["เดินทาง", "🚗"], ["ของใช้", "🛒"], ["บันเทิง", "🎮"], ["สุขภาพ", "💊"], ["อื่นๆ", "📦"]],
  in: [["เงินเดือน", "💼"], ["ลงทุน", "📈"], ["อื่นๆ", "💵"]],
};

const fmt = (n) => n.toLocaleString("th-TH", { maximumFractionDigits: 2 });

function localDate() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default {
  id: "money",
  name: "Money",
  icon: "💰",
  defaultSize: { w: 440, h: 620 },
  mount(body) {
    body.classList.add("app-pane", "app-money");
    let entries = load("money.entries", []);
    const now = new Date();
    let ym = { y: now.getFullYear(), m: now.getMonth() };

    body.innerHTML = `
      <div class="month-nav">
        <button class="btn-ghost prev">‹</button>
        <span class="m"></span>
        <button class="btn-ghost next">›</button>
      </div>
      <div class="stats">
        <div class="stat"><div class="k">รายรับ</div><div class="v in"></div></div>
        <div class="stat"><div class="k">รายจ่าย</div><div class="v out"></div></div>
        <div class="stat"><div class="k">คงเหลือ</div><div class="v net"></div></div>
      </div>
      <form class="money-form">
        <div class="row">
          <input name="amount" type="number" min="0.01" step="0.01" placeholder="จำนวนเงิน (บาท)" required style="flex:1">
          <select name="type"><option value="out">รายจ่าย</option><option value="in">รายรับ</option></select>
        </div>
        <div class="row">
          <select name="cat" style="flex:1"></select>
          <input name="note" placeholder="โน้ต (ไม่บังคับ)" autocomplete="off" style="flex:1.4">
          <button class="btn" type="submit">บันทึก</button>
        </div>
      </form>
      <h3>รายจ่ายตามหมวด</h3>
      <div class="breakdown"></div>
      <h3>รายการเดือนนี้</h3>
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
      body.querySelector(".month-nav .m").textContent = new Date(ym.y, ym.m, 1).toLocaleDateString("th-TH", {
        month: "long",
        year: "numeric",
      });

      const rows = entries.filter(inMonth);
      const sumIn = rows.filter((e) => e.type === "in").reduce((s, e) => s + e.amount, 0);
      const sumOut = rows.filter((e) => e.type === "out").reduce((s, e) => s + e.amount, 0);
      body.querySelector(".stat .v.in").textContent = fmt(sumIn);
      body.querySelector(".stat .v.out").textContent = fmt(sumOut);
      body.querySelector(".stat .v.net").textContent = fmt(sumIn - sumOut);

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
      for (const e of rows.slice().sort((a, b) => b.id - a.id)) {
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
      if (!rows.length) list.innerHTML = `<div class="muted" style="font-size:13px">ยังไม่มีรายการ</div>`;
    };

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
