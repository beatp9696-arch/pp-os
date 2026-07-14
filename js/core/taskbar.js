// Taskbar — ฟัง event จาก window manager มาวาดปุ่ม + นาฬิกา + start menu

import * as wm from "./window-manager.js";
import { getApp, allApps } from "./app-registry.js";

const buttons = new Map(); // appId -> button element

export function initTaskbar() {
  const bar = document.getElementById("task-buttons");

  wm.on("open", (id) => {
    const app = getApp(id);
    const btn = document.createElement("button");
    btn.className = "task-btn";
    btn.innerHTML = `<span>${app.icon}</span><span>${app.name}</span>`;
    btn.addEventListener("click", () => wm.toggle(id));
    bar.append(btn);
    buttons.set(id, btn);
  });

  wm.on("close", (id) => {
    buttons.get(id)?.remove();
    buttons.delete(id);
  });

  wm.on("focus", (id) => {
    for (const [bid, btn] of buttons) btn.classList.toggle("active", bid === id);
  });

  wm.on("minimize", (id) => buttons.get(id)?.classList.remove("active"));

  startClock();
  initStartMenu();
}

function startClock() {
  const el = document.getElementById("clock");
  const tick = () => {
    el.textContent = new Date().toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });
  };
  tick();
  setInterval(tick, 1000);
}

function initStartMenu() {
  const menu = document.getElementById("start-menu");
  const startBtn = document.getElementById("start-btn");

  for (const app of allApps()) {
    const item = document.createElement("button");
    item.className = "menu-item";
    item.innerHTML = `<span class="glyph">${app.icon}</span><span>${app.name}</span>`;
    item.addEventListener("click", () => {
      wm.openApp(app);
      menu.classList.add("hidden");
    });
    menu.append(item);
  }

  startBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    menu.classList.toggle("hidden");
  });
  document.addEventListener("click", (e) => {
    if (!menu.contains(e.target)) menu.classList.add("hidden");
  });
}
