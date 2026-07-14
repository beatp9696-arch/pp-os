# PP OS

แอปส่วนตัวในเบราว์เซอร์ — เขียนด้วย vanilla JS (ES modules) ไม่มี build step ติดตั้งเป็นแอปบนมือถือได้

**สองโหมดจาก codebase เดียว** (แอปตัวเดียวกัน ใช้ contract `mount(body)` เหมือนกัน):

- **app mode** — แอปมือถือเต็มจอ + แท็บล่าง `Me / Health / Money / Weather / More` (ดีฟอลต์เมื่อจอ ≤820px หรือเปิดจากไอคอน PWA)
- **desktop mode** — desktop + หน้าต่างลาก/ย่อ/focus + taskbar + start menu (ดีฟอลต์บนจอกว้าง)

สลับโหมดได้สองทาง (ปุ่มใต้นาฬิกาบน desktop / More ในแอป) หรือบังคับด้วย `?mode=app|desktop`

- **UI เป็นภาษาอังกฤษล้วน** (14 ก.ค. 2026) — ฟอนต์ Inter (variable, self-hosted) + Instrument Serif เฉพาะหัวเรื่อง Weather + IBM Plex Mono เฉพาะ eyebrow/label เครื่องมือ
- **Design system ชั้นเดียว** — component (`.card` / `.page-head` / `.chip` / `.seg` / `.list` / `.btn`) นิยามครั้งเดียวใน `css/apps.css` แล้วแต่ละแอปประกาศแค่ **จานสี 8 ตัวแปร** ที่ราก `.app-<id>` (`--canvas --card --line --ink --dim --a --a-soft --on-a`); แต่ละแอปเลยมีบุคลิกของตัวเอง (Health = จอดำ WHOOP, Weather = กระดาษครีม Acme, Money = ดำ-เขียวมะนาว FinTrack) แต่โครงเหมือนกันหมด
- **ข้อมูลอยู่ในเครื่องล้วนๆ** — localStorage ต่ออุปกรณ์ ไม่มีเซิร์ฟเวอร์ ไม่มี tracking (More → ดาวน์โหลดข้อมูลทั้งหมดเป็น JSON ได้)

## รันยังไง

ES modules เปิดผ่าน `file://` ไม่ได้ ต้องมี local server:

```bash
cd pp-os
python3 -m http.server 8000
# เปิด http://localhost:8000
```

Deep link: `?mode=app&tab=health` · `?open=notes,calculator` (desktop)

## Apple Health

เว็บอ่าน HealthKit ตรงๆ **ไม่ได้** — Apple เปิดให้เฉพาะแอป native เท่านั้น ไม่มี Web API เลย
PP OS เลยรับข้อมูลเข้าทาง import แทน (Health → ปุ่ม ⌚ มุมขวาบน) รองรับ:

| แหล่ง | ทำยังไง | ได้อะไร |
|---|---|---|
| `export.zip` จากแอปสุขภาพ | สุขภาพ → รูปโปรไฟล์ → ส่งออกข้อมูลสุขภาพทั้งหมด → เลือกไฟล์ที่ได้ | ก้าว/ออกกำลังกาย/นอน/น้ำ/น้ำหนัก ย้อนหลังสูงสุด 400 วัน |
| `.json` จาก Shortcut | Shortcut อ่าน Health → เขียนไฟล์ JSON → เลือกไฟล์นั้น | อัปเดตรายวัน |
| `?hk=<base64 JSON>` | Shortcut สั่ง Open URL | เข้าอัตโนมัติตอนเปิด (ใช้กับ Safari — PWA ที่ติดตั้งแล้วมี storage แยกจาก Safari) |

รูปแบบ JSON: `{"days":{"2026-07-14":{"steps":8210,"ex":30,"sleep":7.5,"water":6,"weight":70.5}}}`

การแกะ zip + สตรีมอ่าน `export.xml` ทำเองใน `js/core/apple-health.js` (ไม่มี library — ใช้ `DecompressionStream("deflate-raw")` ของเบราว์เซอร์) ทุกอย่างอ่านในเครื่อง ไม่มีการอัปโหลด

**กับดักที่โค้ดจัดการให้แล้ว:** iPhone กับ Apple Watch นับก้าว/ออกกำลังกายซ้ำกัน → รวมแยกตาม source แล้วเอาแหล่งที่มากสุดของวันนั้น (ไม่ใช่ sum ทุกแหล่ง ไม่งั้นเลขเบิ้ล) · การนอนนับเข้า "วันที่ตื่น" และตัด `InBed` ออก เอาเฉพาะ `Asleep*` · import ทับเฉพาะตัวชี้วัดที่ Apple มี ไม่แตะอารมณ์ที่กรอกเอง

## Structure

```
index.html              # shell กลาง (โหมดไหนก็ boot จากไฟล์นี้)
manifest.webmanifest    # PWA manifest + shortcuts (Health/Money/Weather)
sw.js                   # service worker — แก้/เพิ่มไฟล์ต้อง bump VERSION + อัปเดต SHELL list
css/                    # base / desktop / window / taskbar / shell (โหมดแอป) / apps
assets/                 # fonts + icons ชุดเดียวกับเว็บ Moatrices
js/
├── main.js             # boot: register แอป → เลือกโหมด → import ?hk= ถ้ามี
├── core/
│   ├── app-shell.js        # โหมดแอป: view เต็มจอ + tabbar + More + export
│   ├── window-manager.js   # โหมด desktop: เปิด/ปิด/ลาก/ย่อ/z-index/focus
│   ├── taskbar.js          # ปุ่มแอป + นาฬิกา + start menu
│   ├── apple-health.js     # แกะ export.zip / JSON → merge เข้า health.days
│   ├── app-registry.js     # ทะเบียนแอป
│   └── storage.js          # wrapper localStorage (namespace pp-os:)
└── apps/               # หนึ่งไฟล์ = หนึ่งแอป (me, health, money, weather, notes, todo, calculator)
```

## เพิ่มแอปใหม่

1. สร้าง `js/apps/<ชื่อ>.js` export object ตาม contract:

```js
export default {
  id: "myapp",
  name: "My App",
  icon: "🚀",
  defaultSize: { w: 480, h: 360 },   // ใช้เฉพาะโหมด desktop
  mount(body) {
    // body = div ที่ window manager หรือ app shell สร้างให้ — logic ทั้งหมดอยู่ในนี้
  },
};
```

2. import + เพิ่มเข้า array ใน `js/main.js` — จบ ไม่ต้องแตะ core
   (ถ้าไม่มีแท็บของตัวเอง จะไปโผล่ใต้ More เป็นหน้าซ้อนอัตโนมัติ — เพิ่มชื่อใน `MORE_APPS` ของ `app-shell.js`)

## Roadmap

- [x] desktop + window manager + taskbar + start menu
- [x] แอป: Notes, To-do, Calculator, Health, Weather (Open-Meteo), Money
- [x] PWA + offline + identity Moatrices
- [x] โหมดแอปมือถือ + แท็บล่าง + หน้า Me (แดชบอร์ดรวมทุกแอป)
- [x] นำเข้าจาก Apple Health (export.zip / Shortcut JSON / URL)
- [ ] กราฟน้ำหนัก + แนวโน้มระยะยาว (ตอนนี้ย้อนหลัง 7 วัน)
- [ ] งบต่อหมวดต่อเดือนใน Money (ตั้งเพดาน + เตือนตอนใกล้เต็ม)
```
