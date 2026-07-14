// Wrapper localStorage ของ OS — ทุกแอปเก็บข้อมูลผ่านตัวนี้ (namespace "pp-os:")

const PREFIX = "pp-os:";

export function load(key, fallback = null) {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function save(key, value) {
  localStorage.setItem(PREFIX + key, JSON.stringify(value));
}

export function remove(key) {
  localStorage.removeItem(PREFIX + key);
}
