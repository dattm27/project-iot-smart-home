# IoT Smart Home Backend

Backend Node.js/Express cho hệ thống nhà thông minh: xác thực JWT, quản lý đèn/quạt, nhận dữ liệu MQ135 qua MQTT, tự động bật/tắt quạt theo nhiệt độ/chất lượng không khí, và cung cấp API docs bằng Swagger UI.

## Yêu cầu

- Node.js 18+.
- MongoDB Atlas connection string.
- HiveMQ Cloud broker dùng MQTT over TLS.
- File `CERT.txt` có sẵn trong thư mục `be-node-js`.

## Cài đặt

```powershell
cd D:\project-iot-smart-home\be-node-js
npm install
```

## Cấu hình môi trường

Tạo file `.env` từ file mẫu:

```powershell
Copy-Item .env.example .env
```

Sau đó sửa các biến trong `.env`:

```env
MONGO_URI=mongodb+srv://<username>:<password>@<cluster-host>/?retryWrites=true&w=majority&appName=<app-name>
HIVEMQ_USERNAME=<hivemq-username>
HIVEMQ_PASSWORD=<hivemq-password>
JWT_SECRET=<strong-random-secret>
MQTT_BROKER_URL=mqtts://<cluster-id>.s1.eu.hivemq.cloud
MQTT_PORT=8883
```

Không commit file `.env`. Repo chỉ commit `.env.example`.

## Chạy backend

```powershell
npm start
```

Mặc định server chạy tại:

```text
http://localhost:4000
```

Docs API:

```text
http://localhost:4000/api-docs
```

OpenAPI JSON:

```text
http://localhost:4000/openapi.json
```

## Chạy test

Unit/API tests không cần MongoDB thật, HiveMQ thật hoặc phần cứng:

```powershell
npm test
```

## Test auto cooling bằng MQTT

Chạy backend trước:

```powershell
npm start
```

Đảm bảo đã tạo quạt `QUAT_1` và bật auto cooling:

```json
{
  "name": "QUAT_1",
  "autoOnByTemperature": true,
  "autoOnTemperature": 30
}
```

Publish nhiệt độ cao:

```powershell
npm run test:auto-cooling -- --temp 35 --humidity 70 --co2 500 --co 5
```

Publish nhiệt độ bình thường:

```powershell
npm run test:auto-cooling -- --temp 25 --humidity 70 --co2 500 --co 5
```

Publish khí xấu/gas:

```powershell
npm run test:auto-cooling -- --temp 25 --humidity 70 --co2 1200 --co 40
```

## Auth flow

Đăng ký:

```http
POST /auth/register
```

Đăng nhập:

```http
POST /auth/login
```

Các endpoint còn lại cần header:

```http
Authorization: Bearer <token>
```

## Logic chính

- Đèn:
  - Bật/tắt thủ công qua `PUT /lights/OnOff`.
  - Hẹn giờ qua `PUT /lights/Timer/`.
  - Nếu người dùng tắt tay trong khung giờ auto, backend không bật lại ngay.

- Quạt:
  - Bật/tắt thủ công qua `PUT /fans/OnOff`.
  - Auto cooling qua `PUT /fans/AutoCooling`.
  - Khi nhiệt độ hoặc chất lượng không khí vượt ngưỡng, quạt tự bật.
  - Khi sensor trở lại bình thường, quạt tự tắt nếu trước đó được sensor bật.
  - Nếu người dùng tắt tay khi quạt đang auto bật, backend tôn trọng thao tác tay và không bật lại ngay cho tới khi sensor trở lại bình thường.

- MQ135:
  - Backend subscribe topic `MQ135/Statistics`.
  - Payload mẫu:

```json
{
  "time": "2026-06-29T10:00:00Z",
  "co2_ppm": 1200,
  "co_ppm": 40,
  "temp": 35,
  "humidity": 70
}
```

- Fire alarm:
  - Backend subscribe topic `MQ135/FireAlarm`.
  - Payload mẫu:

```json
{
  "time": "2026-06-29T10:05:00Z",
  "status": "active"
}
```
