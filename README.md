# IoT Smart Home — Kiến trúc & Bảo mật hệ thống IoT

Bài tập lớn môn **IT6015 - Kiến trúc và Bảo mật trong hệ thống IoT**, Đại học Bách khoa Hà Nội.

Hệ thống nhà thông minh demo end-to-end: ESP32 thu thập cảm biến & điều khiển thiết bị, backend Node.js làm trung tâm xử lý nghiệp vụ/xác thực, MongoDB lưu trữ, MQTT (EMQX Cloud, TLS) làm kênh giao tiếp backend ↔ ESP32, và mobile app React Native cho người dùng theo dõi/điều khiển.

## Kiến trúc tổng quan

```
Mobile App (React Native)
        │  REST API (JWT)
        ▼
Backend (Node.js/Express) ──── MongoDB Atlas
        │  MQTT over TLS
        ▼
MQTT Broker (EMQX Cloud)
        │
        ▼
ESP32 (DHT22, MQ135, cảm biến ánh sáng, relay đèn/quạt)
```

Nguyên tắc thiết kế cốt lõi: **mobile app không giao tiếp trực tiếp với ESP32** — mọi thao tác đều đi qua backend, giúp tập trung xác thực, kiểm soát quyền truy cập và logic nghiệp vụ ở một nơi duy nhất.

## Cấu trúc repo

| Thư mục | Nội dung |
| --- | --- |
| [`be-node-js/`](be-node-js/README.md) | Backend Node.js/Express: REST API, xác thực JWT, MQTT client, kết nối MongoDB |
| [`fe-react-native-app/`](fe-react-native-app) | Mobile app React Native + TypeScript (thư mục con `smarthouse/`) |
| [`arduino-esp32/`](arduino-esp32) | Firmware ESP32 (Arduino) đọc cảm biến, điều khiển relay, giao tiếp MQTT |
| `docs/` | Báo cáo cuối kỳ, slide thuyết trình, kịch bản thuyết trình, tài liệu deploy |

## Chức năng chính

- **Người dùng**: đăng ký, đăng nhập, refresh token, đăng xuất.
- **Giám sát môi trường**: nhiệt độ, độ ẩm (DHT22), chất lượng không khí/PPM (MQ135), cảnh báo cháy.
- **Điều khiển đèn/quạt**: 3 chế độ — thủ công, hẹn giờ, tự động (cảm biến ánh sáng cho đèn; theo nhiệt độ cho quạt) — với logic ưu tiên chống xung đột giữa các nguồn điều khiển.
- **An toàn**: PPM vượt ngưỡng nguy hiểm → backend ép buộc tắt quạt bất kể trạng thái trước đó.

## Bảo mật đã triển khai

- JWT access token (ngắn hạn) + refresh token (dài hạn, lưu hash trong DB, rotate mỗi lần dùng).
- Middleware xác thực đặt trước toàn bộ API nghiệp vụ; rate limit cho `login`/`register` theo IP + username.
- Mật khẩu hash bằng `scrypt` kèm salt; validate input strict để chặn NoSQL injection.
- Kết nối MQTT qua `mqtts://` (TLS); backend và ESP32 dùng credential MQTT riêng biệt, không dùng wildcard `#`.
- Secret nhạy cảm (Mongo URI, JWT secret, MQTT credential) đưa vào biến môi trường, không commit vào repo.

Chi tiết đầy đủ: xem [`docs/bao-cao-cuoi-ky.md`](docs/bao-cao-cuoi-ky.md) hoặc [`be-node-js/README.md`](be-node-js/README.md#bảo-mật-đã-triển-khai).

## Bắt đầu nhanh

```bash
# Backend
cd be-node-js
npm install
cp .env.example .env   # điền MONGO_URI, MQTT_*, JWT_SECRET...
npm start              # http://localhost:4000, docs tại /api-docs

# Mobile app
cd fe-react-native-app
npm start               # hoặc npm run ios / npm run android
```

Firmware ESP32: mở `arduino-esp32/smart-home/smart-home.ino` bằng Arduino IDE, cấu hình WiFi/MQTT credential trong code trước khi nạp.

## Deploy

Backend deploy tự động lên [Render](https://render.com) qua GitHub Actions (`.github/workflows/backend-render-deploy.yml`) khi push vào nhánh có thay đổi liên quan — chi tiết tại [`docs/render-backend-deploy.md`](docs/render-backend-deploy.md).

## Tài liệu

- [`docs/bao-cao-cuoi-ky.md`](docs/bao-cao-cuoi-ky.md) — báo cáo cuối kỳ đầy đủ
- [`docs/bao-cao-cuoi-ky-slides.pptx`](docs/bao-cao-cuoi-ky-slides.pptx) — slide đầy đủ (33 slide)
- [`docs/bao-cao-cuoi-ky-slides-v2.pptx`](docs/bao-cao-cuoi-ky-slides-v2.pptx) — slide rút gọn cho thuyết trình 10 phút (20 slide)
- [`docs/kich-ban-thuyet-trinh-10phut.md`](docs/kich-ban-thuyet-trinh-10phut.md) — kịch bản nói cho bản slide 10 phút

## Nhóm thực hiện

Trần Hoàng Sơn • Hà Quang Thắng • Trần Mạnh Đạt • Đặng Minh Ánh
GVHD: TS. Phạm Ngọc Hưng • TS. Trịnh Văn Chiến • PGS. Trần Quang Đức
