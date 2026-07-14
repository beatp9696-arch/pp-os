// หัวใจของ OS — จัดการวงจรชีวิตหน้าต่างทั้งหมด: เปิด/ปิด/ลาก/ย่อ/z-index/focus
// ไม่รู้จักแอปตัวไหนเลย รู้จักแค่ contract { id, name, icon, defaultSize, mount }

const open = new Map(); // appId -> { el, app, minimized }
let zCounter = 10;
let focusedId = null;
let cascade = 0;

const listeners = new Map();

export function on(event, fn) {
  if (!listeners.has(event)) listeners.set(event, []);
  listeners.get(event).push(fn);
}

function emit(event, id) {
  for (const fn of listeners.get(event) ?? []) fn(id);
}

export function openApp(app) {
  const existing = open.get(app.id);
  if (existing) {
    if (existing.minimized) restore(app.id);
    else focus(app.id);
    return;
  }

  const desktop = document.getElementById("desktop");
  const { w = 480, h = 360 } = app.defaultSize ?? {};

  const el = document.createElement("section");
  el.className = "window";
  el.style.width = `${w}px`;
  el.style.height = `${h}px`;
  el.style.left = `${Math.min(90 + cascade * 34, Math.max(10, desktop.clientWidth - w - 20))}px`;
  el.style.top = `${60 + cascade * 30}px`;
  cascade = (cascade + 1) % 7;

  el.innerHTML = `
    <header class="titlebar">
      <span class="title">${app.icon} ${app.name}</span>
      <span class="controls">
        <button class="win-btn win-min" title="ย่อ">─</button>
        <button class="win-btn win-close" title="ปิด">✕</button>
      </span>
    </header>
    <div class="win-body"></div>
  `;

  document.getElementById("windows").append(el);
  open.set(app.id, { el, app, minimized: false });

  el.querySelector(".win-min").addEventListener("click", (e) => {
    e.stopPropagation();
    minimize(app.id);
  });
  el.querySelector(".win-close").addEventListener("click", (e) => {
    e.stopPropagation();
    close(app.id);
  });
  el.addEventListener("pointerdown", () => focus(app.id));
  makeDraggable(el, el.querySelector(".titlebar"));

  app.mount(el.querySelector(".win-body"));
  emit("open", app.id);
  focus(app.id);
}

export function focus(id) {
  const w = open.get(id);
  if (!w || w.minimized || focusedId === id) return;
  w.el.style.zIndex = ++zCounter;
  w.el.classList.add("focused");
  const prev = open.get(focusedId);
  if (prev) prev.el.classList.remove("focused");
  focusedId = id;
  emit("focus", id);
}

export function minimize(id) {
  const w = open.get(id);
  if (!w) return;
  w.minimized = true;
  w.el.classList.add("minimized");
  w.el.classList.remove("focused");
  if (focusedId === id) focusedId = null;
  emit("minimize", id);
}

export function restore(id) {
  const w = open.get(id);
  if (!w) return;
  w.minimized = false;
  w.el.classList.remove("minimized");
  emit("restore", id);
  focus(id);
}

export function close(id) {
  const w = open.get(id);
  if (!w) return;
  w.el.remove();
  open.delete(id);
  if (focusedId === id) focusedId = null;
  emit("close", id);
}

// ปุ่มบน taskbar: ย่ออยู่ → คืน / focus อยู่ → ย่อ / เปิดอยู่เฉยๆ → ดันขึ้นหน้า
export function toggle(id) {
  const w = open.get(id);
  if (!w) return;
  if (w.minimized) restore(id);
  else if (focusedId === id) minimize(id);
  else focus(id);
}

function makeDraggable(win, handle) {
  let dragging = false;
  let startX = 0;
  let startY = 0;
  let origX = 0;
  let origY = 0;

  handle.addEventListener("pointerdown", (e) => {
    if (e.target.closest("button")) return;
    dragging = true;
    startX = e.clientX;
    startY = e.clientY;
    origX = win.offsetLeft;
    origY = win.offsetTop;
    handle.setPointerCapture(e.pointerId);
    win.classList.add("dragging");
  });

  handle.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    const desk = document.getElementById("desktop");
    // clamp ให้เหลือขอบหน้าต่างพอจับกลับมาได้เสมอ
    const x = clamp(origX + e.clientX - startX, 80 - win.offsetWidth, desk.clientWidth - 80);
    const y = clamp(origY + e.clientY - startY, 0, desk.clientHeight - 40);
    win.style.left = `${x}px`;
    win.style.top = `${y}px`;
  });

  const end = (e) => {
    if (!dragging) return;
    dragging = false;
    win.classList.remove("dragging");
    if (handle.hasPointerCapture?.(e.pointerId)) handle.releasePointerCapture(e.pointerId);
  };
  handle.addEventListener("pointerup", end);
  handle.addEventListener("pointercancel", end);
}

function clamp(v, min, max) {
  return Math.min(Math.max(v, min), max);
}
