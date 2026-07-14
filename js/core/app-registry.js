// ทะเบียนแอปทั้งหมดของ OS — แอปใหม่แค่ register ที่นี่ ไม่ต้องแตะ core อื่น

const apps = new Map();

export function register(app) {
  apps.set(app.id, app);
}

export function getApp(id) {
  return apps.get(id);
}

export function allApps() {
  return [...apps.values()];
}
