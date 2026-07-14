// Boot PP OS: ลงทะเบียนแอป → วาด desktop icons → start taskbar

import { register, allApps, getApp } from "./core/app-registry.js";
import { openApp } from "./core/window-manager.js";
import { initTaskbar } from "./core/taskbar.js";

import notes from "./apps/notes.js";
import calculator from "./apps/calculator.js";

[notes, calculator].forEach(register);

const icons = document.getElementById("icons");
for (const app of allApps()) {
  const btn = document.createElement("button");
  btn.className = "desk-icon";
  btn.innerHTML = `<span class="glyph">${app.icon}</span><span class="label">${app.name}</span>`;
  btn.addEventListener("click", () => openApp(app));
  icons.append(btn);
}

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
