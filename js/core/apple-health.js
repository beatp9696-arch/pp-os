// นำเข้าข้อมูลจาก Apple Health
//
// ข้อจำกัดที่ต้องรู้: เว็บอ่าน HealthKit ตรงๆ ไม่ได้ (ไม่มี Web API — เฉพาะแอป native เท่านั้น)
// ทางที่ทำได้จริงมีสองทาง ไฟล์นี้รองรับทั้งคู่:
//   1. export.zip จากแอป "สุขภาพ" → แกะ zip + สตรีมอ่าน export.xml ในเครื่อง (ย้อนหลังทั้งหมด)
//   2. JSON จาก Shortcut (ไฟล์ หรือส่งมาทาง ?hk=<base64>) → อัปเดตรายวันแบบอัตโนมัติ
// ทุกอย่างทำในเครื่อง 100% ไม่มีการอัปโหลดไปไหน

import { load, save } from "./storage.js";

const ML_PER_GLASS = 250;
const MAX_DAYS = 400; // ไม่ต้องอ่านย้อนหลังเกินนี้ — กันไฟล์ยักษ์กินเวลา

const TYPE_MAP = {
  HKQuantityTypeIdentifierStepCount: "steps",
  HKQuantityTypeIdentifierAppleExerciseTime: "ex",
  HKQuantityTypeIdentifierDietaryWater: "water",
  HKQuantityTypeIdentifierBodyMass: "weight",
  HKCategoryTypeIdentifierSleepAnalysis: "sleep",
};

const cutoffKey = () => {
  const d = new Date();
  d.setDate(d.getDate() - MAX_DAYS);
  return d.toISOString().slice(0, 10);
};

// Apple เขียนเวลาเป็น local time ของเครื่องอยู่แล้ว ("2026-07-14 08:12:03 +0700")
// เลยตัดวันจาก string ตรงๆ ได้ ไม่ต้องแปลง timezone (กันวันเพี้ยนตอนข้ามเที่ยงคืน)
const dayOf = (s) => s.slice(0, 10);

function toDate(s) {
  const m = /^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2}) ([+-]\d{2})(\d{2})$/.exec(s);
  if (!m) return new Date(s);
  return new Date(`${m[1]}T${m[2]}${m[3]}:${m[4]}`);
}

function toMl(value, unit) {
  if (unit === "L") return value * 1000;
  if (unit === "fl_oz_us") return value * 29.5735;
  return value; // mL
}

// ---- ตัวรวมยอดต่อวัน ----
// iPhone กับ Apple Watch นับก้าว/ออกกำลังกายซ้ำกัน ถ้า sum ทุกแหล่ง = ตัวเลขเบิ้ล
// เลยรวมแยกตาม source แล้วเอา "แหล่งที่มากที่สุด" ของวันนั้น (วิธีเดียวกับที่แอปสุขภาพเลือกแหล่งหลัก)
class DayAgg {
  constructor() {
    this.perSource = {}; // metric -> day -> source -> number
    this.weight = {}; // day -> { ts, kg }
  }

  add(metric, day, source, amount) {
    const bySrc = (this.perSource[metric] ??= {});
    const srcs = (bySrc[day] ??= {});
    srcs[source] = (srcs[source] ?? 0) + amount;
  }

  setWeight(day, ts, kg) {
    const cur = this.weight[day];
    if (!cur || ts >= cur.ts) this.weight[day] = { ts, kg };
  }

  result() {
    const days = {};
    for (const [metric, byDay] of Object.entries(this.perSource)) {
      for (const [day, srcs] of Object.entries(byDay)) {
        const top = Math.max(...Object.values(srcs));
        (days[day] ??= {})[metric] = top;
      }
    }
    for (const [day, w] of Object.entries(this.weight)) {
      (days[day] ??= {}).weight = Math.round(w.kg * 10) / 10;
    }
    // ปัดให้อยู่ในหน่วยที่แอปใช้: น้ำ = แก้ว, ออกกำลังกาย = นาที, ก้าว = จำนวนเต็ม
    for (const d of Object.values(days)) {
      if (d.water != null) d.water = Math.round((d.water / ML_PER_GLASS) * 10) / 10;
      if (d.ex != null) d.ex = Math.round(d.ex);
      if (d.steps != null) d.steps = Math.round(d.steps);
      if (d.sleep != null) d.sleep = Math.round(d.sleep * 10) / 10;
    }
    return days;
  }
}

function handleRecord(attrs, agg, cutoff) {
  const metric = TYPE_MAP[attrs.type];
  if (!metric) return;

  const source = attrs.sourceName ?? "?";

  if (metric === "sleep") {
    // เอาเฉพาะช่วงที่ "หลับจริง" ไม่เอา InBed (นอนเล่นบนเตียงไม่ใช่การนอน)
    if (!/Asleep/.test(attrs.value ?? "")) return;
    const day = dayOf(attrs.endDate ?? ""); // นับเข้าวันที่ตื่น
    if (!day || day < cutoff) return;
    const hrs = (toDate(attrs.endDate) - toDate(attrs.startDate)) / 3600000;
    if (hrs > 0 && hrs < 24) agg.add("sleep", day, source, hrs);
    return;
  }

  const day = dayOf(attrs.startDate ?? "");
  if (!day || day < cutoff) return;
  const v = parseFloat(attrs.value);
  if (!Number.isFinite(v)) return;

  if (metric === "weight") {
    const kg = attrs.unit === "lb" ? v * 0.453592 : v;
    agg.setWeight(day, toDate(attrs.startDate).getTime(), kg);
  } else if (metric === "water") {
    agg.add("water", day, source, toMl(v, attrs.unit));
  } else {
    agg.add(metric, day, source, v); // steps, ex
  }
}

// ---- แกะ zip เอง (ไม่มี library) แล้วสตรีมอ่าน export.xml ----
async function xmlTextStream(file) {
  if (file.name.endsWith(".xml")) return file.stream().pipeThrough(new TextDecoderStream("utf-8"));

  const tailLen = Math.min(file.size, 66_000); // EOCD อยู่ท้ายไฟล์ (comment ยาวสุด 64KB)
  const tail = new DataView(await file.slice(file.size - tailLen).arrayBuffer());
  let eocd = -1;
  for (let i = tail.byteLength - 22; i >= 0; i--) {
    if (tail.getUint32(i, true) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error("ไฟล์ zip ไม่ถูกต้อง");

  const cdSize = tail.getUint32(eocd + 12, true);
  const cdOffset = tail.getUint32(eocd + 16, true);
  const cd = new DataView(await file.slice(cdOffset, cdOffset + cdSize).arrayBuffer());

  let p = 0;
  let entry = null;
  const dec = new TextDecoder();
  while (p + 46 <= cd.byteLength && cd.getUint32(p, true) === 0x02014b50) {
    const nameLen = cd.getUint16(p + 28, true);
    const extraLen = cd.getUint16(p + 30, true);
    const commentLen = cd.getUint16(p + 32, true);
    const name = dec.decode(new Uint8Array(cd.buffer, cd.byteOffset + p + 46, nameLen));
    if (/export\.xml$/i.test(name) && !/cda/i.test(name)) {
      entry = {
        method: cd.getUint16(p + 10, true),
        compSize: cd.getUint32(p + 20, true),
        localOffset: cd.getUint32(p + 42, true),
      };
      break;
    }
    p += 46 + nameLen + extraLen + commentLen;
  }
  if (!entry) throw new Error("ไม่เจอ export.xml ในไฟล์ zip นี้");

  // local header ยาวไม่คงที่ ต้องอ่าน nameLen/extraLen ของมันเองก่อนถึงจะรู้จุดเริ่มข้อมูล
  const lh = new DataView(await file.slice(entry.localOffset, entry.localOffset + 30).arrayBuffer());
  const dataStart = entry.localOffset + 30 + lh.getUint16(26, true) + lh.getUint16(28, true);
  const blob = file.slice(dataStart, dataStart + entry.compSize);

  const raw = entry.method === 8 ? blob.stream().pipeThrough(new DecompressionStream("deflate-raw")) : blob.stream();
  return raw.pipeThrough(new TextDecoderStream("utf-8"));
}

const RECORD_RE = /<Record\s([^>]*?)\/?>/g;
const ATTR_RE = /([\w-]+)="([^"]*)"/g;

export async function parseAppleExport(file, onProgress) {
  const stream = await xmlTextStream(file);
  const reader = stream.getReader();
  const agg = new DayAgg();
  const cutoff = cutoffKey();
  let buf = "";
  let bytes = 0;
  let records = 0;

  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    bytes += value.length;
    buf += value;

    RECORD_RE.lastIndex = 0;
    let m;
    let last = 0;
    while ((m = RECORD_RE.exec(buf))) {
      const attrs = {};
      ATTR_RE.lastIndex = 0;
      let a;
      while ((a = ATTR_RE.exec(m[1]))) attrs[a[1]] = a[2];
      handleRecord(attrs, agg, cutoff);
      records++;
      last = RECORD_RE.lastIndex;
    }
    buf = buf.slice(last);
    if (buf.length > 2_000_000) buf = buf.slice(-4000); // กันบัฟเฟอร์บวมถ้าเจอบล็อกที่ไม่ใช่ Record

    onProgress?.({ mb: bytes / 1e6, records });
    await new Promise((r) => setTimeout(r)); // คืนคิวให้ UI ได้วาด progress
  }

  return agg.result();
}

// ---- JSON จาก Shortcut ----
// รับได้ทั้ง {days:{...}}, {"2026-07-14":{...}} และ [{date, sleep, ...}]
export function parseHealthJSON(text) {
  const raw = JSON.parse(text);
  const src = raw.days ?? raw;
  const out = {};

  const put = (day, o) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return;
    const d = {};
    for (const k of ["water", "ex", "sleep", "steps", "weight"]) {
      const v = Number(o[k]);
      if (Number.isFinite(v)) d[k] = Math.round(v * 10) / 10;
    }
    if (Object.keys(d).length) out[day] = d;
  };

  if (Array.isArray(src)) for (const row of src) put(row.date ?? row.day, row);
  else for (const [day, o] of Object.entries(src)) put(day, o ?? {});

  if (!Object.keys(out).length) throw new Error("ไม่เจอข้อมูลวันไหนเลยในไฟล์นี้");
  return out;
}

// ---- เขียนลง storage ----
// Apple = แหล่งความจริงสำหรับตัวเลขที่มันวัดได้ ทับของเดิมได้เลย
// แต่ห้ามแตะสิ่งที่ Apple ไม่มี (อารมณ์ที่ PP กดเอง) — ไม่งั้นบันทึกมือหายเงียบๆ
export function mergeDays(imported) {
  const days = load("health.days", {});
  let touched = 0;
  const filled = { water: 0, ex: 0, sleep: 0, steps: 0, weight: 0 };

  for (const [day, vals] of Object.entries(imported)) {
    const rec = (days[day] ??= { water: 0, ex: 0, sleep: 0, steps: 0, weight: null, mood: null });
    let any = false;
    for (const [k, v] of Object.entries(vals)) {
      if (v == null) continue;
      rec[k] = v;
      filled[k] = (filled[k] ?? 0) + 1;
      any = true;
    }
    if (any) touched++;
  }

  save("health.days", days);
  save("health.lastImport", { at: Date.now(), days: touched });

  const keys = Object.keys(imported).sort();
  return { days: touched, from: keys[0], to: keys.at(-1), filled };
}

// ---- Shortcut ส่งข้อมูลมาทาง URL: ?hk=<base64 ของ JSON> ----
export function importFromURL() {
  const url = new URL(location.href);
  const raw = url.searchParams.get("hk") ?? (location.hash.startsWith("#hk=") ? location.hash.slice(4) : null);
  if (!raw) return null;

  try {
    const json = decodeURIComponent(escape(atob(decodeURIComponent(raw).replace(/-/g, "+").replace(/_/g, "/"))));
    const res = mergeDays(parseHealthJSON(json));
    url.searchParams.delete("hk");
    history.replaceState(null, "", url.pathname + url.search); // ล้าง URL ไม่ให้ import ซ้ำตอน refresh
    return res;
  } catch {
    return null;
  }
}
