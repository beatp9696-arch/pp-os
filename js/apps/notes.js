import { load, save } from "../core/storage.js";

export default {
  id: "notes",
  name: "Notes",
  icon: "📝",
  defaultSize: { w: 420, h: 340 },
  mount(body) {
    body.classList.add("app-notes");
    const ta = document.createElement("textarea");
    ta.placeholder = "Write anything… saves itself";
    ta.value = load("notes.text", "");
    ta.addEventListener("input", () => save("notes.text", ta.value));
    body.append(ta);
  },
};
