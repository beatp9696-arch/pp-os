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

// ไล่ลำดับการ์ดให้เข้าจอทีละใบ (CSS อ่าน --i ไปคำนวณ animation-delay)
export function stagger(root) {
  root.querySelectorAll(".card").forEach((el, i) => el.style.setProperty("--i", i));
}

// ฟอร์แมตอังกฤษล้วน — ตัวเลข/วันที่/เวลา ต้องมาจากที่เดียวกันหมด ไม่งั้นแต่ละหน้าจะเพี้ยนกันเอง
export const num = (n, opts = {}) => n.toLocaleString("en-US", opts);

// ฿ ไม่มีใน Inter (มันเป็นอักษรไทย U+0E3F) เบราว์เซอร์เลย fallback ไปฟอนต์ระบบ
// เว้น thin space คั่นไว้ ไม่งั้นกลิฟจากคนละฟอนต์จะชนกันจนดูไม่เนี๊ยบ
const BAHT = "฿ ";
export const money = (n) => `${BAHT}${num(n, { maximumFractionDigits: 2 })}`;
export const money0 = (n) => `${BAHT}${num(Math.round(n))}`;
export const dateLong = (d = new Date()) =>
  d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
export const dateShort = (d) => d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
export const timeShort = (d) => d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
