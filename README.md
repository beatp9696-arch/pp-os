# PP OS

Web OS ในเบราว์เซอร์ — desktop, หน้าต่างลาก/ย่อ/focus ได้, taskbar + start menu, แอปย่่อยข้างใน เขียนด้วย vanilla JS (ES modules) ไม่มี build step

## รันยังไง

ES modules เปิดผ่าน `file://` ไม่ได้ ต้องมี local server:

```bash
cd pp-os
python3 -m http.server 8000
# เปิด http://localhost:8000
```

Deep link เปิดแอปอัตโนมัติ: `http://localhost:8000/?open=notes,calculator`

## Structure

```
index.html              # shell: desktop + taskbar
css/                    # base / desktop / window / taskbar / apps
js/
├── main.js             # boot: ลงทะเบียนแอป, วาด icons, start taskbar
├── core/
│   ├── window-manager.js   # เปิด/ปิด/ลาก/ย่อ/z-index/focus
│   ├── taskbar.js          # ปุ่มแอป + นาฬิกา + start menu
│   ├── app-registry.js     # ทะเบียนแอป
│   └── storage.js          # wrapper localStorage (namespace pp-os:)
└── apps/               # หนึ่งไฟล์ = หนึ่งแอป
```

## เพิ่มแอปใหม่

1. สร้าง `js/apps/<ชื่อ>.js` export object ตาม contract:

```js
export default {
  id: "myapp",
  name: "My App",
  icon: "🚀",
  defaultSize: { w: 480, h: 360 },
  mount(body) {
    // body = div ข้างในหน้าต่างที่ window manager สร้างให้
    // logic ของแอปอยู่ในนี้ทั้งหมด
  },
};
```

2. import + เพิ่มเข้า array ใน `js/main.js` — จบ ไม่ต้องแตะ core

## Roadmap

- [x] Milestone 1–2: desktop + window manager (ลาก, focus, z-index)
- [x] Milestone 3: taskbar + minimize/restore + นาฬิกา
- [x] Milestone 4: app registry + Notes + Calculator
- [ ] Milestone 5: persistence ตำแหน่ง/ขนาดหน้าต่าง (notes เซฟแล้ว)
- [ ] Milestone 6: resize handle, wallpaper picker, Files app
