export default {
  id: "calculator",
  name: "Calculator",
  icon: "🧮",
  defaultSize: { w: 280, h: 400 },
  mount(body) {
    body.classList.add("app-calc");
    const keys = ["C", "±", "%", "÷", "7", "8", "9", "×", "4", "5", "6", "−", "1", "2", "3", "+", "0", ".", "="];
    body.innerHTML = `
      <div class="calc-display">0</div>
      <div class="calc-keys">
        ${keys
          .map(
            (k) =>
              `<button class="calc-key${"÷×−+=".includes(k) ? " op" : ""}${k === "0" ? " zero" : ""}" data-key="${k}">${k}</button>`
          )
          .join("")}
      </div>`;

    const display = body.querySelector(".calc-display");
    let acc = null;
    let op = null;
    let entry = "0";
    let fresh = true; // กดเลขครั้งถัดไปจะขึ้นค่าใหม่แทนที่จอ

    const compute = () => {
      const b = parseFloat(entry);
      let v = acc;
      if (op === "+") v = acc + b;
      if (op === "−") v = acc - b;
      if (op === "×") v = acc * b;
      if (op === "÷") v = b === 0 ? NaN : acc / b;
      return Math.round(v * 1e10) / 1e10;
    };

    body.querySelector(".calc-keys").addEventListener("click", (e) => {
      const key = e.target.closest(".calc-key")?.dataset.key;
      if (!key) return;

      if (/[0-9]/.test(key)) {
        entry = fresh || entry === "0" ? key : entry + key;
        fresh = false;
      } else if (key === ".") {
        if (fresh) {
          entry = "0.";
          fresh = false;
        } else if (!entry.includes(".")) {
          entry += ".";
        }
      } else if (key === "C") {
        acc = null;
        op = null;
        entry = "0";
        fresh = true;
      } else if (key === "±") {
        if (entry !== "0") entry = entry.startsWith("-") ? entry.slice(1) : "-" + entry;
      } else if (key === "%") {
        entry = String(parseFloat(entry) / 100);
      } else if (key === "=") {
        if (op !== null) {
          entry = String(compute());
          acc = null;
          op = null;
          fresh = true;
        }
      } else {
        // ตัวดำเนินการ ÷ × − +
        if (op !== null && !fresh) {
          acc = compute();
          entry = String(acc);
        } else {
          acc = parseFloat(entry);
        }
        op = key;
        fresh = true;
      }

      if (entry === "NaN") entry = "Error";
      display.textContent = entry;
    });
  },
};
