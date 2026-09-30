# AAF Thailand website

เว็บไซต์บริษัท แอสเซ้นต์ ออโตโมทีฟ ฟิลเทรชั่น จำกัด (Ascend Automotive Filtration Co., Ltd.) — HTML + Tailwind CSS (CDN), 3 ภาษา ไทย / English / 繁體中文

| ไฟล์ | หน้าที่ |
|---|---|
| `index.html` | หน้าเว็บทั้งหมด + คำแปลในตัวแปร `I18N` |
| `content.json` | ข้อความ/รูปที่แก้ผ่านหน้า Admin (ระบบเขียนให้อัตโนมัติ) |
| `assets/` | รูปภาพ (`assets/uploads/` = รูปที่อัปโหลดผ่าน Admin) |
| `admin/admin.js` | ระบบ Admin — เข้าที่ `https://www.aaf-thailand.com/?admin` |
| `CNAME` | โดเมน www.aaf-thailand.com สำหรับ GitHub Pages |

ตั้งค่า Admin ครั้งแรก: สร้าง GitHub fine-grained token เฉพาะ repo นี้ (Contents: Read and write) แล้วตั้งรหัสผ่าน
