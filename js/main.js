// Boot PP OS: ลงทะเบียนแอป → วาด desktop icons → start taskbar

import { register, allApps, getApp } from "./core/app-registry.js";
import { openApp } from "./core/window-manager.js";
import { initTaskbar } from "./core/taskbar.js";

import notes from "./apps/notes.js";
import todo from "./apps/todo.js";
import health from "./apps/health.js";
import weather from "./apps/weather.js";
import money from "./apps/money.js";
import calculator from "./apps/calculator.js";

[notes, todo, health, weather, money, calculator].forEach(register);

const icons = document.getElementById("icons");
for (const app of allApps()) {
  const btn = document.createElement("button");
  btn.className = "desk-icon";
  btn.dataset.app = app.id;
  btn.innerHTML = `<span class="glyph">${app.icon}</span><span class="label">${app.name}</span>`;
  btn.addEventListener("click", () => openApp(app));
  icons.append(btn);
}

// นาฬิกา + คำทักทายบน desktop — เติมชีวิตให้พื้นที่ว่าง
const widget = document.createElement("div");
widget.id = "desk-widget";
widget.innerHTML = `<div class="dw-greet"></div><div class="dw-time"></div><div class="dw-date"></div>`;
document.getElementById("desktop").append(widget);

const tickWidget = () => {
  const now = new Date();
  const h = now.getHours();
  widget.querySelector(".dw-greet").textContent =
    h < 5 ? "ดึกแล้ว นอนได้แล้วนะ" : h < 12 ? "สวัสดีตอนเช้า ☀️" : h < 17 ? "สวัสดีตอนบ่าย" : h < 21 ? "สวัสดีตอนเย็น" : "ค่ำแล้ว พักผ่อนบ้างนะ";
  widget.querySelector(".dw-time").textContent = now.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });
  widget.querySelector(".dw-date").textContent = now.toLocaleDateString("th-TH", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
};
tickWidget();
setInterval(tickWidget, 10_000);

initTaskbar();

// deep link: ?open=notes,calculator เปิดแอปให้เลยตอน boot
const auto = new URLSearchParams(location.search).get("open");
if (auto) {
  for (const id of auto.split(",")) {
    const app = getApp(id.trim());
    if (app) openApp(app);
  }
}

// PWA: ให้ติดตั้งบนมือถือ + ใช้ offline ได้
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("./sw.js");
}
