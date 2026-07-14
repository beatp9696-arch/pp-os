// ยูทิลเล็กๆ ที่ทุกแอปใช้ร่วมกัน — motion ที่ปิดได้ + ตัวเลขนับขึ้น

export const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

// ตัวเลขพระเอก (ยอดเงิน, อุณหภูมิ) นับขึ้นตอนเข้าจอ — ให้ความรู้สึกว่าเลขถูก "คำนวณ" ไม่ใช่แค่พิมพ์ทิ้งไว้
export function countUp(el, to, { dur = 750, from = 0, fmt = (n) => Math.round(n).toLocaleString("th-TH") } = {}) {
  if (!el) return;
  if (reduced() || !Number.isFinite(to)) {
    el.textContent = fmt(to);
    return;
  }
  const t0 = performance.now();
  const step = (t) => {
    const p = Math.min(1, (t - t0) / dur);
    const e = 1 - (1 - p) ** 3; // ease-out cubic — เร็วตอนต้น ค่อยๆ นิ่ง
    el.textContent = fmt(from + (to - from) * e);
    if (p < 1 && el.isConnected) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

// บังคับให้เบราว์เซอร์คำนวณสไตล์ปัจจุบันก่อน แล้วค่อยเปลี่ยนค่า → transition ถึงจะเล่น
// (ไม่งั้นค่าเริ่มต้นกับค่าปลายถูกเซ็ตในเฟรมเดียวกัน เบราว์เซอร์เห็นแค่ค่าปลาย = ไม่มีอนิเมชัน)
export function flush(el) {
  el.getBoundingClientRect();
}
