# IoT Smart Home Backend

Backend Node.js/Express cho hệ thống nhà thông minh: xác thực JWT, quản lý đèn/quạt, nhận dữ liệu MQ135 qua MQTT, tự động bật/tắt quạt theo nhiệt độ/chất lượng không khí, và cung cấp API docs bằng Swagger UI.

## Yêu cầu

- Node.js 18+.
- MongoDB Atlas connection string.
- EMQX Cloud broker dùng MQTT over TLS.
- Backend có thể dùng CA store mặc định của Node. Nếu cần pin CA riêng, dùng CA certificate của broker MQTT vào `CERT.txt` rồi đặt `MQTT_CA_CERT_PATH=./CERT.txt`.

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
MQTT_USERNAME=be-server
MQTT_PASSWORD=<mqtt-password>
JWT_SECRET=<strong-random-secret>
JWT_EXPIRES_IN=15m
REFRESH_TOKEN_TTL_MS=2592000000
AUTH_RATE_LIMIT_WINDOW_MS=900000
AUTH_RATE_LIMIT_MAX=8
MQTT_BROKER_URL=mqtts://u7bf1cb3.ala.asia-southeast1.emqxsl.com
MQTT_PORT=8883
MQTT_MQ135_STATISTICS_TOPIC=MQ135/Statistics
MQTT_DHT22_STATISTICS_TOPIC=DHT22/Statistics
MQTT_LIGHT_SENSOR_TOPIC=lights/01/sensor
MQTT_LIGHT_SENSOR_CONTROL_TOPIC=lights/01/sensorControl
```

Không commit file `.env`. Repo chỉ commit `.env.example`.

## Bảo mật đã triển khai

- Password được hash bằng `scrypt` kèm salt, không lưu plaintext.
- API nghiệp vụ yêu cầu `Authorization: Bearer <access-token>`.
- Access token là JWT ngắn hạn, refresh token dài hạn được lưu trong database ở dạng hash và được rotate sau mỗi lần refresh.
- Login/register có rate limit theo IP + username để giảm brute-force.
- Body API được validate strict kiểu dữ liệu, chặn payload object như `{ "$ne": null }` trước khi query MongoDB.
- Kết nối MQTT dùng `mqtts://` với CA certificate, username/password.

## MQTT ACL

Backend dùng credential `be-server`, ESP32 dùng credential `esp32-main`. Không cấp wildcard `#` cho ESP32; mỗi client chỉ được publish/subscribe đúng các topic nó cần.

Các permission gợi ý:

| Username | Publish | Subscribe |
| --- | --- | --- |
| `be-server` | `lights/01/server`, `lights/01/sensorControl`, `fans/01/server` | `MQ135/Statistics`, `MQ135/FireAlarm`, `DHT22/Statistics`, `lights/01/button`, `lights/01/sensor`, `fans/01/button` |
| `esp32-main` | `MQ135/Statistics`, `MQ135/FireAlarm`, `DHT22/Statistics`, `lights/01/button`, `lights/01/sensor`, `fans/01/button` | `lights/01/server`, `lights/01/sensorControl`, `fans/01/server` |

Credential `mqtt-test` chỉ nên tạo tạm khi test thủ công, xong thì disable hoặc xóa.

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

Unit/API tests không cần MongoDB thật, EMQX thật hoặc phần cứng:

```powershell
npm test
```

## Test auto cooling bằng MQTT

Chạy backend trước:

```powershell
npm start
```

Đảm bảo đã tạo quạt `QUAT_1`, bật `autoOnByTemperature=true` và đặt `autoOnTemperature` phù hợp.

Publish nhiệt độ/độ ẩm DHT22 trước để backend có dữ liệu nhiệt mới nhất:

```powershell
npm run test:dht22 -- --temp 35 --humidity 70
```

Publish PPM bình thường:

```powershell
npm run test:auto-cooling -- --ppm 850
```

Publish PPM không ổn, quạt sẽ không tự bật dù nhiệt độ cao:

```powershell
npm run test:auto-cooling -- --ppm 1000
```

Publish PPM nguy hiểm/báo cháy:

```powershell
npm run test:auto-cooling -- --ppm 1250
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
  - Bật/tắt chế độ cảm biến ánh sáng qua `PUT /lights/SensorMode`, backend publish tới `lights/01/sensorControl` với payload `{ "enabled": 1 }` hoặc `{ "enabled": 0 }`.
  - ESP32 publish trạng thái đèn do cảm biến ánh sáng điều khiển lên `lights/01/sensor` với payload `{ "status": 1 }` hoặc `{ "status": 0 }`.
  - Nếu người dùng tắt tay trong khung giờ auto, backend không bật lại ngay.

- Quạt:
  - Bật/tắt thủ công qua `PUT /fans/OnOff`.
  - Auto cooling qua `PUT /fans/AutoCooling`.
  - Quạt chỉ tự bật khi nhiệt độ cao hơn ngưỡng cài đặt và PPM nhỏ hơn 900.
  - Khi PPM từ 900 trở lên, backend không tự bật quạt để tránh làm lan khí gas.
  - Khi PPM lớn hơn 1100, backend bật trạng thái báo cháy.
  - Khi sensor trở lại bình thường, quạt tự tắt nếu trước đó được sensor bật.
  - Nếu người dùng tắt tay khi quạt đang auto bật, backend tôn trọng thao tác tay và không bật lại ngay cho tới khi sensor trở lại bình thường.

- MQ135:
  - Backend subscribe topic `MQ135/Statistics`.
  - Payload mẫu:

```json
{
  "time": "2026-06-29 10-00-00",
  "ppm": 1250
}
```

- DHT22:
  - Backend subscribe topic `DHT22/Statistics`.
  - Payload mẫu:

```json
{
  "time": "2026-06-29 10-00-00",
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
