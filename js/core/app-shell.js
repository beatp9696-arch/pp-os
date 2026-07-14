// App shell — โหมดแอปมือถือ: ไม่มี desktop/หน้าต่าง มีแค่ view เต็มจอ + แท็บล่าง
// ใช้ app contract เดิม { id, name, icon, mount(body) } เหมือน window manager ทุกประการ

import { getApp } from "./app-registry.js";
import { load, save } from "./storage.js";

const I = (d) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;

const ICONS = {
  me: I('<circle cx="12" cy="8" r="3.6"/><path d="M4.8 20a7.2 7.2 0 0 1 14.4 0"/>'),
  health: I('<path d="M20.4 6.9a4.6 4.6 0 0 0-7.8-2L12 5.6l-.6-.7a4.6 4.6 0 0 0-7.8 2c-.5 2 .3 3.9 1.8 5.5L12 19l6.6-6.6c1.5-1.6 2.3-3.5 1.8-5.5Z"/><path d="M3.4 12h3.3l1.5-2.4 2 4.4 1.6-3 1.1 1h4.2"/>'),
  money: I('<rect x="3" y="6" width="18" height="13" rx="3"/><path d="M3 10h18"/><circle cx="16.5" cy="14.5" r="1.4"/><path d="M6.5 3.8 15 6"/>'),
  weather: I('<circle cx="8.2" cy="8.2" r="3"/><path d="M8.2 2.4v1.3M8.2 12.7V14M2.4 8.2h1.3M12.7 8.2H14M4.1 4.1l.9.9M11.4 11.4l.9.9M12.3 4.1l-.9.9M5 11.4l-.9.9"/><path d="M9 20h8.5a3.5 3.5 0 0 0 .3-7 5 5 0 0 0-9.4-1.1A3.6 3.6 0 0 0 9 20Z"/>'),
  more: I('<path d="M4 7h16M4 12h16M4 17h16"/>'),
  back: I('<path d="M15 5l-7 7 7 7"/>'),
  chev: I('<path d="M9 5l7 7-7 7"/>'),
};

const TABS = [
  { id: "me", label: "Me", app: "me" },
  { id: "health", label: "Health", app: "health" },
  { id: "money", label: "Money", app: "money" },
  { id: "weather", label: "Weather", app: "weather" },
  { id: "more", label: "More", app: null },
];

// แอปที่ไม่มีแท็บของตัวเอง — ไปอยู่ใต้ More
const MORE_APPS = [
  ["notes", "A scratchpad that saves itself"],
  ["todo", "Every task (Me shows the first five)"],
  ["calculator", "Quick math"],
];

// สีแถบสถานะของมือถือ ให้กลืนกับพื้นหลังของแท็บที่เปิดอยู่
const THEME = { health: "#0c1014", money: "#0f120e", weather: "#faf4e4" };

let shell, view, bar, themeMeta;

export function initShell() {
  document.body.classList.add("mode-app");
  document.getElementById("desktop")?.remove();
  document.getElementById("taskbar")?.remove();
  document.getElementById("start-menu")?.remove();

  // theme-color แบบมี media ทำให้ override ด้วย JS ไม่ได้ — ถอดแล้วคุมเองตัวเดียว
  for (const m of document.querySelectorAll('meta[name="theme-color"]')) m.remove();
  themeMeta = document.createElement("meta");
  themeMeta.name = "theme-color";
  document.head.append(themeMeta);

  shell = document.createElement("div");
  shell.id = "shell";
  shell.innerHTML = `<main id="shell-view"></main><nav id="tabbar"></nav>`;
  document.body.append(shell);

  view = shell.querySelector("#shell-view");
  bar = shell.querySelector("#tabbar");

  for (const t of TABS) {
    const btn = document.createElement("button");
    btn.className = "tab";
    btn.dataset.tab = t.id;
    btn.innerHTML = `${ICONS[t.id]}<span>${t.label}</span>`;
    btn.addEventListener("click", () => goTab(t.id));
    bar.append(btn);
  }

  // การ์ดในหน้า Me กดแล้วเด้งไปแท็บที่ลึกกว่า
  document.addEventListener("pp-go", (e) => goTab(e.detail));

  const start = new URLSearchParams(location.search).get("tab");
  goTab(TABS.some((t) => t.id === start) ? start : "me");
}

function goTab(id) {
  shell.dataset.tab = id;
  for (const b of bar.children) b.classList.toggle("on", b.dataset.tab === id);

  const bg = THEME[id];
  themeMeta.content =
    bg ?? (matchMedia("(prefers-color-scheme: dark)").matches ? "#121417" : "#f7f5f0");

  const tab = TABS.find((t) => t.id === id);
  view.scrollTop = 0;
  view.innerHTML = "";

  if (!tab.app) {
    renderMore();
    return;
  }
  mountApp(tab.app);
}

function mountApp(appId) {
  const app = getApp(appId);
  const pane = document.createElement("div");
  pane.className = "view";
  view.append(pane);
  app.mount(pane);
}

// ---- More: แอปที่เหลือ + ตั้งค่า ----
function renderMore() {
  const pane = document.createElement("div");
  pane.className = "view more-view";
  const name = load("os.name", "");
  const used = Math.round(
    Object.keys(localStorage)
      .filter((k) => k.startsWith("pp-os:"))
      .reduce((s, k) => s + (localStorage.getItem(k)?.length ?? 0), 0) / 1024
  );

  pane.innerHTML = `
    <h1 class="more-h">More</h1>
    <div class="more-sec">Apps</div>
    <div class="more-list">
      ${MORE_APPS.map(([id, desc]) => {
        const a = getApp(id);
        return `<button class="more-row" data-app="${id}">
          <span class="mr-ico">${a.icon}</span>
          <span class="mr-txt"><b>${a.name}</b><small>${desc}</small></span>
          <span class="mr-chev">${ICONS.chev}</span>
        </button>`;
      }).join("")}
    </div>
    <div class="more-sec">Settings</div>
    <div class="more-list">
      <button class="more-row" data-act="hk">
        <span class="mr-ico">⌚</span>
        <span class="mr-txt"><b>Apple Health</b><small>Pull steps, sleep and workouts — stop logging by hand</small></span>
        <span class="mr-chev">${ICONS.chev}</span>
      </button>
      <div class="more-row static">
        <span class="mr-ico">🙂</span>
        <span class="mr-txt"><b>Name</b><small>${name || "Not set — add it on the Me tab"}</small></span>
      </div>
      <button class="more-row" data-act="desktop">
        <span class="mr-ico">🖥️</span>
        <span class="mr-txt"><b>Switch to desktop mode</b><small>Draggable windows and a taskbar</small></span>
        <span class="mr-chev">${ICONS.chev}</span>
      </button>
      <button class="more-row" data-act="export">
        <span class="mr-ico">⬇️</span>
        <span class="mr-txt"><b>Export all data</b><small>A JSON backup on this device · ${used} KB in use</small></span>
        <span class="mr-chev">${ICONS.chev}</span>
      </button>
    </div>
    <div class="more-foot">PP OS · Everything stays on this device. Nothing is sent to a server.</div>
  `;
  view.append(pane);

  for (const row of pane.querySelectorAll("[data-app]")) {
    row.addEventListener("click", () => openSub(row.dataset.app));
  }
  pane.querySelector('[data-act="hk"]').addEventListener("click", () => {
    goTab("health"); // ชีตนำเข้าอยู่ในแอป Health — เด้งไปแล้วสั่งเปิดให้เลย
    document.dispatchEvent(new CustomEvent("pp-hk-open"));
  });
  pane.querySelector('[data-act="desktop"]').addEventListener("click", () => {
    save("os.mode", "desktop");
    location.replace(location.pathname);
  });
  pane.querySelector('[data-act="export"]').addEventListener("click", exportData);
}

// แอปใน More เปิดเป็นหน้าซ้อน มีปุ่มย้อนกลับ (ปุ่ม back ของเครื่องก็ใช้ได้)
function openSub(appId) {
  const app = getApp(appId);
  view.scrollTop = 0;
  view.innerHTML = "";

  const wrap = document.createElement("div");
  wrap.className = "sub-wrap";
  wrap.innerHTML = `
    <header class="sub-bar">
      <button class="sub-back">${ICONS.back}</button>
      <span class="sub-title">${app.icon} ${app.name}</span>
    </header>
  `;
  const pane = document.createElement("div");
  pane.className = "view";
  wrap.append(pane);
  view.append(wrap);

  // ดันเข้า history เพื่อให้ปุ่ม back ของเครื่อง (Android/ท่าทางปัด) พากลับหน้า More ได้
  history.pushState({ sub: appId }, "");
  const onPop = () => {
    removeEventListener("popstate", onPop);
    if (shell.dataset.tab === "more") goTab("more");
  };
  addEventListener("popstate", onPop);

  wrap.querySelector(".sub-back").addEventListener("click", () => {
    if (history.state?.sub === appId) history.back(); // popstate จะพากลับเอง
    else {
      removeEventListener("popstate", onPop);
      goTab("more");
    }
  });

  app.mount(pane);
}

function exportData() {
  const data = {};
  for (const k of Object.keys(localStorage)) {
    if (k.startsWith("pp-os:")) data[k.slice(6)] = JSON.parse(localStorage.getItem(k));
  }
  const blob = new Blob([JSON.stringify({ exported: new Date().toISOString(), data }, null, 2)], {
    type: "application/json",
  });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `pp-os-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
