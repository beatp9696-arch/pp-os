import { load, save } from "../core/storage.js";

export default {
  id: "todo",
  name: "To-do",
  icon: "✅",
  defaultSize: { w: 380, h: 440 },
  mount(body) {
    body.classList.add("app-pane", "app-todo");
    let items = load("todo.items", []);

    body.innerHTML = `
      <form class="row">
        <input name="text" placeholder="ต้องทำอะไร…" autocomplete="off" style="flex:1">
        <button class="btn" type="submit">เพิ่ม</button>
      </form>
      <div class="todo-list"></div>
      <div class="todo-foot">
        <span class="left"></span>
        <button class="btn-ghost clear" type="button">เคลียร์ที่เสร็จแล้ว</button>
      </div>
    `;

    const list = body.querySelector(".todo-list");
    const left = body.querySelector(".left");

    const persist = () => save("todo.items", items);

    const render = () => {
      list.innerHTML = "";
      for (const it of items) {
        const row = document.createElement("div");
        row.className = "todo-item" + (it.done ? " done" : "");
        row.innerHTML = `
          <input type="checkbox" ${it.done ? "checked" : ""}>
          <span class="txt"></span>
          <button class="x-btn" title="ลบ">✕</button>
        `;
        row.querySelector(".txt").textContent = it.text;
        row.querySelector("input").addEventListener("change", (e) => {
          it.done = e.target.checked;
          persist();
          render();
        });
        row.querySelector(".x-btn").addEventListener("click", () => {
          items = items.filter((x) => x.id !== it.id);
          persist();
          render();
        });
        list.append(row);
      }
      const remain = items.filter((x) => !x.done).length;
      left.textContent = items.length ? `เหลือ ${remain} งาน` : "ยังไม่มีงาน";
    };

    body.querySelector("form").addEventListener("submit", (e) => {
      e.preventDefault();
      const input = e.target.text;
      const text = input.value.trim();
      if (!text) return;
      items.unshift({ id: Date.now(), text, done: false });
      input.value = "";
      persist();
      render();
    });

    body.querySelector(".clear").addEventListener("click", () => {
      items = items.filter((x) => !x.done);
      persist();
      render();
    });

    render();
  },
};
