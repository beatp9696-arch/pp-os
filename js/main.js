// Boot PP OS — สองโหมด:
//   app     = แอปมือถือเต็มจอ + แท็บล่าง (ดีฟอลต์บนมือถือ/เปิดจากไอคอน PWA)
//   desktop = หน้าต่าง + taskbar แบบคอมพิวเตอร์ (ดีฟอลต์บนจอกว้าง)
// แอปตัวเดียวกันใช้ได้ทั้งสองโหมด เพราะ contract mount(body) เหมือนกัน

import { register, allApps, getApp } from "./core/app-registry.js";
import { openApp } from "./core/window-manager.js";
import { initTaskbar } from "./core/taskbar.js";
import { initShell } from "./core/app-shell.js";
import { importFromURL } from "./core/apple-health.js";
import { load, save } from "./core/storage.js";

import me from "./apps/me.js";
import health from "./apps/health.js";
import money from "./apps/money.js";
import weather from "./apps/weather.js";
import notes from "./apps/notes.js";
import todo from "./apps/todo.js";
import calculator from "./apps/calculator.js";

[me, health, money, weather, notes, todo, calculator].forEach(register);

// Shortcut ยิงข้อมูลสุขภาพมาทาง ?hk=<base64> — เขียนลง storage ก่อนแอปเริ่มวาด
importFromURL();

const params = new URLSearchParams(location.search);
const auto =
  matchMedia("(max-width: 820px)").matches || matchMedia("(display-mode: standalone)").matches
    ? "app"
    : "desktop";
const mode = params.get("mode") ?? load("os.mode", null) ?? auto;

if (mode === "app") {
  initShell();
} else {
  initDesktop();
}

function initDesktop() {
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
  widget.innerHTML = `<div class="dw-greet"></div><div class="dw-time"></div><div class="dw-date"></div>
    <button class="dw-mode">สลับเป็นโหมดแอป →</button>`;
  document.getElementById("desktop").append(widget);

  widget.querySelector(".dw-mode").addEventListener("click", () => {
    save("os.mode", "app");
    location.replace(location.pathname);
  });

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
  const auto = params.get("open");
  if (auto) {
    for (const id of auto.split(",")) {
      const app = getApp(id.trim());
      if (app) openApp(app);
    }
  }
}

// PWA: ให้ติดตั้งบนมือถือ + ใช้ offline ได้
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("./sw.js");
}
