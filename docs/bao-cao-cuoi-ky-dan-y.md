# Dàn ý báo cáo cuối kỳ - Hệ thống IoT Smart Home

> Phiên bản nháp để duyệt nội dung. Sau khi thống nhất dàn ý, có thể triển khai thành báo cáo hoàn chỉnh kèm hình ảnh, bảng biểu, mã nguồn minh họa và kết quả demo.

## Trang bìa

- Tên đề tài: Xây dựng hệ thống nhà thông minh ứng dụng IoT.
- Môn học: ...
- Giảng viên hướng dẫn: ...
- Nhóm thực hiện: ...
- Thành viên và phân công nhiệm vụ.
- Thời gian thực hiện.

## Mục lục

- Danh mục hình ảnh.
- Danh mục bảng biểu.
- Danh mục từ viết tắt.

## 1. Giới thiệu đề tài

### 1.1. Lý do chọn đề tài

- Nhà thông minh là một ứng dụng tiêu biểu của IoT, kết hợp cảm biến, thiết bị chấp hành, backend, database và ứng dụng người dùng.
- Hệ thống giúp người dùng theo dõi môi trường trong nhà và điều khiển thiết bị từ xa.
- Đề tài phù hợp để minh họa kiến trúc IoT hoàn chỉnh: thiết bị phần cứng, giao tiếp MQTT, backend API, mobile app và các cơ chế bảo mật.

### 1.2. Mục tiêu đề tài

- Xây dựng hệ thống IoT có thể thu thập dữ liệu môi trường:
  - Nhiệt độ.
  - Độ ẩm.
  - Nồng độ khí PPM.
- Điều khiển thiết bị:
  - Đèn phòng.
  - Quạt.
- Hỗ trợ các chế độ tự động:
  - Đèn bật/tắt theo hẹn giờ.
  - Đèn bật/tắt theo cảm biến ánh sáng.
  - Quạt tự động theo nhiệt độ, có kiểm tra điều kiện khí gas.
- Xây dựng backend API và mobile app để người dùng tương tác với hệ thống.
- Áp dụng một số kỹ thuật bảo mật:
  - Xác thực người dùng.
  - Xác thực API bằng JWT.
  - Refresh token.
  - Rate limit.
  - Validate input.
  - MQTT over TLS và đề xuất MQTT ACL.

### 1.3. Phạm vi đề tài

- Hệ thống demo với một ESP32 điều khiển các thiết bị:
  - 1 đèn.
  - 1 quạt.
  - Cảm biến MQ135.
  - Cảm biến DHT22.
  - Cảm biến ánh sáng cho đèn.
- Backend xử lý logic nghiệp vụ, lưu dữ liệu và trung gian giao tiếp MQTT.
- Mobile app phục vụ người dùng cuối.
- Chưa tập trung vào sản xuất phần cứng công nghiệp hoặc triển khai bảo mật phần cứng ở mức thương mại.

## 2. Yêu cầu hệ thống

### 2.1. Yêu cầu chức năng

- Người dùng có thể đăng ký, đăng nhập, đăng xuất.
- Người dùng có thể xem dashboard môi trường:
  - Nhiệt độ.
  - Độ ẩm.
  - Chất lượng không khí theo PPM.
  - Trạng thái báo cháy.
- Người dùng có thể bật/tắt đèn.
- Người dùng có thể bật/tắt quạt.
- Người dùng có thể cấu hình hẹn giờ cho đèn và quạt.
- Người dùng có thể bật/tắt chế độ đèn theo cảm biến ánh sáng.
- Người dùng có thể bật/tắt chế độ quạt tự động theo nhiệt độ và cài ngưỡng nhiệt độ.
- Backend nhận dữ liệu cảm biến từ ESP32 qua MQTT và lưu vào database.
- Backend publish lệnh điều khiển thiết bị tới ESP32 qua MQTT.
- App tự cập nhật trạng thái thiết bị định kỳ và cho phép bấm refresh thủ công.

### 2.2. Yêu cầu phi chức năng

- Giao tiếp thời gian gần thực qua MQTT.
- API có xác thực với JWT.
- Dữ liệu được lưu trong MongoDB.
- Mobile app có giao diện dễ dùng, hiển thị trạng thái rõ ràng.
- Logic tự động cần tránh xung đột giữa các chế độ điều khiển.
- Hệ thống có thể demo trên mạng local hoặc môi trường cloud.

## 3. Kiến trúc tổng quan hệ thống IoT

### 3.1. Sơ đồ kiến trúc hệ thống

Hình cần đưa vào báo cáo:

- Sơ đồ kiến trúc tổng quan: App -> Backend API -> Database/MQTT Broker -> ESP32 -> Cảm biến/Thiết bị.
- Có thể dùng thêm 2 hình luồng đã tạo:
  - `docs/diagrams/luong-hoat-dong-den.png`
  - `docs/diagrams/luong-hoat-dong-quat.png`

Mô tả sơ bộ:

```text
Mobile App
   |
   | HTTPS/HTTP REST API + JWT
   v
Backend Node.js/Express
   |                         |
   | MongoDB Driver/Mongoose | MQTT over TLS
   v                         v
MongoDB Atlas              EMQX Cloud MQTT Broker
                              |
                              | MQTT publish/subscribe
                              v
                           ESP32
                              |
             ----------------------------------
             | Cảm biến DHT22, MQ135, ánh sáng |
             | Relay điều khiển đèn và quạt    |
             ----------------------------------
```

### 3.2. Các thành phần trong hệ thống

#### 3.2.1. Thiết bị IoT / phần cứng

- ESP32:
  - Kết nối Wi-Fi.
  - Kết nối MQTT broker.
  - Publish dữ liệu cảm biến.
  - Subscribe lệnh điều khiển đèn/quạt từ backend.
- DHT22:
  - Đo nhiệt độ và độ ẩm.
  - Gửi dữ liệu lên topic `DHT22/Statistics`.
- MQ135:
  - Đo nồng độ khí dạng PPM.
  - Gửi dữ liệu lên topic `MQ135/Statistics`.
  - PPM được backend phân loại:
    - PPM < 900: an toàn.
    - 900 <= PPM <= 1100: cảnh báo/chất lượng không khí không tốt.
    - PPM > 1100: nguy hiểm, báo cháy.
- Cảm biến ánh sáng:
  - ESP32 dùng để tự bật/tắt đèn khi chế độ cảm biến ánh sáng được bật.
- Relay:
  - Điều khiển bật/tắt đèn và quạt.

#### 3.2.2. MQTT Broker / IoT Platform

- Sử dụng EMQX Cloud.
- Giao thức MQTT over TLS.
- Broker đóng vai trò trung gian publish/subscribe giữa backend và ESP32.
- Backend không điều khiển ESP32 trực tiếp qua HTTP mà publish lệnh vào topic MQTT.

#### 3.2.3. Backend Server

- Công nghệ:
  - Node.js.
  - Express.js.
  - Mongoose.
  - MQTT.js.
  - JWT.
  - Swagger/OpenAPI.
- Vai trò:
  - Cung cấp REST API cho mobile app.
  - Xác thực người dùng.
  - Lưu dữ liệu cảm biến và trạng thái thiết bị.
  - Subscribe dữ liệu từ MQTT broker.
  - Publish lệnh điều khiển tới MQTT broker.
  - Xử lý logic tự động: hẹn giờ, quạt theo nhiệt độ, báo cháy, cảm biến ánh sáng.

#### 3.2.4. Database

- Sử dụng MongoDB Atlas.
- Lưu các nhóm dữ liệu chính:
  - User.
  - RefreshToken.
  - Light.
  - Fan.
  - MQ135Statistics.
  - DHT22Statistics.
  - FireAlarm.

#### 3.2.5. Mobile App

- Công nghệ:
  - React Native.
  - TypeScript.
- Vai trò:
  - Đăng ký, đăng nhập.
  - Hiển thị dashboard môi trường.
  - Hiển thị trạng thái thiết bị.
  - Điều khiển bật/tắt đèn/quạt.
  - Cài hẹn giờ.
  - Cài ngưỡng nhiệt độ tự động bật quạt.
  - Bật/tắt chế độ cảm biến ánh sáng cho đèn.
  - Tự refresh trạng thái thiết bị định kỳ 30 giây và có nút refresh thủ công.

### 3.3. Phương thức giao tiếp và trao đổi dữ liệu

#### 3.3.1. Mobile App <-> Backend

- Giao tiếp bằng REST API.
- Dữ liệu truyền dạng JSON.
- Các API nghiệp vụ yêu cầu header:

```http
Authorization: Bearer <access-token>
```

Ví dụ API:

- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/refresh`
- `PUT /lights/OnOff`
- `PUT /lights/Timer/`
- `PUT /lights/SensorMode`
- `PUT /fans/OnOff`
- `PUT /fans/Timer/`
- `PUT /fans/AutoCooling`
- `GET /lights/`
- `GET /fans/`
- `GET /mq135statistics`
- `GET /dht22statistics`
- `GET /fire-alarm`

#### 3.3.2. Backend <-> MQTT Broker <-> ESP32

- Giao tiếp bằng MQTT publish/subscribe.
- MQTT broker dùng TLS.
- Payload dạng JSON.

Bảng topic chính:

| Topic | Publisher | Subscriber | Payload mẫu | Ý nghĩa |
| --- | --- | --- | --- | --- |
| `MQ135/Statistics` | ESP32 | Backend | `{ "time": "...", "ppm": 850 }` | Gửi dữ liệu khí PPM |
| `DHT22/Statistics` | ESP32 | Backend | `{ "time": "...", "temp": 35, "humidity": 70 }` | Gửi nhiệt độ, độ ẩm |
| `MQ135/FireAlarm` | ESP32 | Backend | `{ "time": "...", "status": "active" }` | Gửi trạng thái báo cháy từ ESP32 |
| `lights/01/server` | Backend | ESP32 | `{ "type": 1 }` | Lệnh bật/tắt đèn |
| `lights/01/button` | ESP32 | Backend | `{ "status": 1 }` | ESP32 phản hồi trạng thái đèn |
| `lights/01/sensor` | ESP32 | Backend | `{ "status": 1 }` | Đèn đổi trạng thái theo cảm biến ánh sáng |
| `lights/01/sensorControl` | Backend | ESP32 | `{ "enabled": 1 }` | Bật/tắt chế độ cảm biến ánh sáng |
| `fans/01/server` | Backend | ESP32 | `{ "type": 1 }` | Lệnh bật/tắt quạt |
| `fans/01/button` | ESP32 | Backend | `{ "status": 1 }` | ESP32 phản hồi trạng thái quạt |

## 4. Thiết kế dữ liệu

### 4.1. User

- Lưu thông tin người dùng.
- Password không lưu plaintext, được hash kèm salt.

### 4.2. RefreshToken

- Lưu hash của refresh token.
- Có thời gian hết hạn.
- Token được rotate sau mỗi lần refresh.

### 4.3. Light

Các trường quan trọng:

- `name`
- `status`
- `room`
- `timerEnabled`
- `autoOnTime`
- `autoOffTime`
- `isAutoControlled`
- `manualOverride`
- `lastAutoReason`
- `lightSensorEnabled`

Ý nghĩa:

- `timerEnabled`: chế độ hẹn giờ có bật không.
- `lightSensorEnabled`: chế độ cảm biến ánh sáng có bật không.
- `manualOverride`: người dùng vừa can thiệp thủ công, automation cần tôn trọng.
- `lastAutoReason`: lý do tự động gần nhất, ví dụ `timer` hoặc `light_sensor`.

### 4.4. Fan

Các trường quan trọng:

- `name`
- `status`
- `room`
- `timerEnabled`
- `autoOnTime`
- `autoOffTime`
- `autoOnByTemperature`
- `autoOnTemperature`
- `isAutoControlled`
- `manualOverride`
- `lastAutoReason`

Ý nghĩa:

- `autoOnByTemperature`: có bật chế độ tự động theo nhiệt độ không.
- `autoOnTemperature`: ngưỡng nhiệt độ để tự bật quạt.
- `manualOverride`: nếu người dùng tắt tay thì hệ thống không tự bật lại ngay.
- `lastAutoReason`: `timer` hoặc `temperature`.

### 4.5. MQ135Statistics

- `time`
- `ppm`
- `airQuality`
- `timestamp`

### 4.6. DHT22Statistics

- `time`
- `temp`
- `humidity`
- `timestamp`

### 4.7. FireAlarm

- `time`
- `status`
- `timestamp`

## 5. Xây dựng chức năng nghiệp vụ

### 5.1. Chức năng xác thực người dùng

- Đăng ký tài khoản.
- Đăng nhập.
- Cấp access token và refresh token.
- Refresh access token.
- Logout.

### 5.2. Chức năng dashboard môi trường

- Backend nhận dữ liệu MQ135 và DHT22 qua MQTT.
- Lưu dữ liệu vào MongoDB.
- App lấy dữ liệu mới nhất để hiển thị:
  - Nhiệt độ.
  - Độ ẩm.
  - PPM.
  - Trạng thái chất lượng không khí.
  - Trạng thái báo cháy.

### 5.3. Chức năng điều khiển đèn

#### 5.3.1. Bật/tắt thủ công

- App gọi API `/lights/OnOff`.
- Backend cập nhật database.
- Backend publish lệnh MQTT tới `lights/01/server`.
- ESP32 nhận lệnh và điều khiển relay.
- ESP32 phản hồi trạng thái qua `lights/01/button`.

#### 5.3.2. Hẹn giờ đèn

- App cấu hình thời gian bật/tắt.
- Backend lưu `timerEnabled`, `autoOnTime`, `autoOffTime`.
- Backend kiểm tra định kỳ.
- Nếu đến khung giờ bật và không bị `manualOverride`, backend bật đèn.
- Nếu hết khung giờ và đèn do timer bật, backend tắt đèn.

#### 5.3.3. Đèn theo cảm biến ánh sáng

- App bật/tắt chế độ cảm biến ánh sáng.
- Backend publish tới `lights/01/sensorControl`:

```json
{ "enabled": 1 }
```

- ESP32 tự xử lý cảm biến ánh sáng và publish trạng thái đèn lên `lights/01/sensor`.
- Backend chỉ sync trạng thái từ topic này nếu `lightSensorEnabled = true`.

### 5.4. Chức năng điều khiển quạt

#### 5.4.1. Bật/tắt thủ công

- App gọi API `/fans/OnOff`.
- Backend cập nhật DB và publish lệnh MQTT tới `fans/01/server`.
- ESP32 điều khiển relay quạt và phản hồi qua `fans/01/button`.

#### 5.4.2. Hẹn giờ quạt

- App cấu hình thời gian bật/tắt.
- Backend lưu cấu hình timer.
- Backend kiểm tra định kỳ để bật/tắt quạt.

#### 5.4.3. Quạt tự động theo nhiệt độ

- App bật chế độ tự động theo nhiệt độ và cài ngưỡng.
- Backend nhận dữ liệu DHT22 và MQ135.
- Điều kiện tự bật quạt:

```text
Nhiệt độ >= ngưỡng cài đặt
và PPM < 900
và không có manualOverride
```

- Nếu PPM >= 900 thì quạt không tự bật theo nhiệt độ.
- Nếu PPM > 1100 thì backend force tắt quạt vì nguy hiểm.

### 5.5. Logic ưu tiên chống conflict

#### 5.5.1. Quạt

Thứ tự ưu tiên:

```text
Gas danger > manualOverride > timer > auto cooling theo nhiệt độ
```

Giải thích:

- `Gas danger`: nếu PPM > 1100, force tắt quạt để tránh làm khí lan rộng.
- `manualOverride`: nếu người dùng tắt tay, hệ thống không tự bật lại ngay.
- `timer`: nếu timer đang trong khung active, sensor auto cooling không được tự tắt quạt, trừ gas danger.
- `auto cooling`: chỉ tự bật khi nhiệt độ cao và PPM an toàn.

#### 5.5.2. Đèn

Thứ tự ưu tiên:

```text
manualOverride > timer / light sensor
```

Giải thích:

- Nếu người dùng tắt tay trong khung timer, backend không bật lại ngay.
- Nếu chế độ cảm biến ánh sáng bị tắt, backend bỏ qua message từ `lights/01/sensor`.

## 6. Giao diện mobile app

### 6.1. Màn hình đăng nhập/đăng ký

- Nhập username/password.
- Gọi API auth.
- Lưu token phục vụ gọi API nghiệp vụ.

### 6.2. Màn hình dashboard

- Hiển thị nhiệt độ, độ ẩm, PPM, chất lượng không khí.
- Hiển thị cảnh báo cháy khi PPM vượt ngưỡng nguy hiểm.

### 6.3. Màn hình thiết bị

- Hiển thị trạng thái đèn/quạt.
- Bật/tắt thủ công.
- Cài đặt hẹn giờ.
- Cài đặt tự động theo nhiệt độ cho quạt.
- Bật/tắt chế độ cảm biến ánh sáng cho đèn.
- Refresh trạng thái định kỳ 30 giây và nút refresh thủ công.

## 7. Triển khai bảo mật cho hệ thống

### 7.1. Các rủi ro bảo mật chính

| Rủi ro | Mô tả | Biện pháp |
| --- | --- | --- |
| Người lạ gọi API điều khiển thiết bị | Bật/tắt đèn/quạt trái phép | JWT access token |
| Brute-force login/register | Thử nhiều mật khẩu hoặc spam tài khoản | Rate limit theo IP + username |
| Lưu mật khẩu plaintext | Lộ mật khẩu nếu database bị lộ | Hash password bằng scrypt + salt |
| Token bị đánh cắp | Access token có thể bị lạm dụng | Access token ngắn hạn + refresh token rotate |
| NoSQL injection | Payload kiểu `{ "$ne": null }` | Validate input strict, chỉ nhận đúng kiểu dữ liệu |
| Nghe lén MQTT | Lộ dữ liệu/lệnh điều khiển | MQTT over TLS |
| Client MQTT publish sai topic | ESP32 hoặc backend gửi/nhận nhầm topic | Đề xuất MQTT ACL theo username |
| Logic tự động gây nguy hiểm | Quạt chạy khi khí gas nguy hiểm | Gas danger priority force tắt quạt |

### 7.2. Xác thực người dùng và API

- Người dùng đăng nhập nhận access token JWT.
- Các API nghiệp vụ đặt sau middleware `authenticateToken`.
- Client phải gửi:

```http
Authorization: Bearer <access-token>
```

- API public:
  - `/auth/register`
  - `/auth/login`
  - `/auth/refresh`
  - `/api-docs`
  - `/openapi.json`
  - `/health`

### 7.3. Refresh token

- Access token có thời gian sống ngắn.
- Refresh token có thời gian sống dài hơn.
- Refresh token được lưu trong database dưới dạng hash.
- Khi refresh, backend rotate refresh token cũ sang token mới.
- Logout sẽ xóa refresh token trong database.

### 7.4. Rate limit login/register

- Áp dụng rate limit cho `/auth/login` và `/auth/register`.
- Giới hạn theo IP + username.
- Giảm nguy cơ brute-force hoặc spam đăng ký.

### 7.5. Validate input

- Kiểm tra body request phải là JSON object hợp lệ.
- Kiểm tra kiểu dữ liệu:
  - `type` phải là 0 hoặc 1.
  - `timerEnabled` phải là boolean.
  - `autoOnTemperature` phải là số trong khoảng hợp lệ.
  - `name`, `room`, `username`, `email` phải đúng format.
- Chặn payload object trước khi query MongoDB để giảm nguy cơ NoSQL injection.

### 7.6. Bảo mật MQTT

- Backend kết nối MQTT bằng `mqtts://`.
- MQTT broker yêu cầu username/password.
- Đề xuất ACL:

| Client | Được publish | Được subscribe |
| --- | --- | --- |
| `be-server` | `lights/01/server`, `lights/01/sensorControl`, `fans/01/server` | `MQ135/Statistics`, `MQ135/FireAlarm`, `DHT22/Statistics`, `lights/01/button`, `lights/01/sensor`, `fans/01/button` |
| `esp32-main` | `MQ135/Statistics`, `MQ135/FireAlarm`, `DHT22/Statistics`, `lights/01/button`, `lights/01/sensor`, `fans/01/button` | `lights/01/server`, `lights/01/sensorControl`, `fans/01/server` |

Không cấp wildcard `#` cho ESP32.

### 7.7. Bảo mật cấu hình

- Biến nhạy cảm được đưa vào `.env`.
- Repo chỉ commit `.env.example`.
- Các secret cần được cấu hình ở môi trường deploy:
  - `MONGO_URI`
  - `JWT_SECRET`
  - `MQTT_USERNAME`
  - `MQTT_PASSWORD`

### 7.8. Bảo mật logic nghiệp vụ

- Quạt không tự bật nếu PPM không an toàn.
- Nếu PPM > 1100, backend force tắt quạt.
- Sensor auto cooling không được tắt quạt khi timer đang active, trừ gas danger.
- Light sensor message bị bỏ qua nếu người dùng đã tắt chế độ cảm biến ánh sáng.

### 7.9. Hạn chế và hướng cải thiện bảo mật

- Nên triển khai HTTPS cho backend nếu chạy public.
- Nên bật CORS whitelist theo domain/app cụ thể.
- Nên thêm Helmet cho HTTP security headers.
- Nên rotate MQTT password định kỳ.
- Nên cấu hình MQTT ACL trực tiếp trên EMQX Cloud.
- Có thể dùng client certificate cho ESP32 nếu yêu cầu bảo mật cao hơn.
- Có thể bổ sung audit log cho thao tác bật/tắt thiết bị.
- Có thể áp dụng secure boot/flash encryption cho ESP32 trong phiên bản nâng cao.

## 8. Kiểm thử hệ thống

### 8.1. Kiểm thử backend

- Unit/API tests bằng `node --test`.
- Các nhóm test:
  - Auth.
  - Validate input.
  - Refresh token.
  - Logic đèn.
  - Logic quạt.
  - Logic gas danger.
  - Light sensor disabled.

### 8.2. Kiểm thử mobile app

- TypeScript typecheck.
- Jest render test.
- Test thao tác thủ công trên thiết bị thật:
  - Bật/tắt đèn.
  - Bật/tắt quạt.
  - Cài hẹn giờ.
  - Cài ngưỡng nhiệt độ.
  - Bật/tắt sensor ánh sáng.

### 8.3. Kiểm thử MQTT

- Publish thử dữ liệu DHT22.
- Publish thử dữ liệu MQ135:
  - PPM < 900.
  - 900 <= PPM <= 1100.
  - PPM > 1100.
- Kiểm tra DB có lưu dữ liệu.
- Kiểm tra app cập nhật trạng thái.

## 9. Kết quả đạt được

- Xây dựng được hệ thống IoT gồm phần cứng, backend, database, MQTT broker và mobile app.
- Backend nhận dữ liệu cảm biến qua MQTT và lưu vào MongoDB.
- App hiển thị dữ liệu môi trường và điều khiển thiết bị.
- Đèn/quạt hỗ trợ điều khiển thủ công và tự động.
- Có cơ chế báo cháy theo PPM.
- Có áp dụng xác thực người dùng, xác thực API và các cơ chế bảo mật cơ bản.
- Có test cho các logic nghiệp vụ quan trọng.

## 10. Hạn chế của hệ thống

- Demo hiện tại sử dụng một ESP32 điều khiển tất cả thiết bị.
- Số lượng thiết bị còn ít: một đèn, một quạt.
- Chưa có web dashboard riêng cho admin, chủ yếu dùng mobile app và Swagger UI.
- MQTT ACL mới ở mức đề xuất/cấu hình broker, cần trình bày rõ nếu chưa cấu hình hoàn toàn trên broker.
- Chưa áp dụng đầy đủ bảo mật phần cứng như secure boot, flash encryption.
- Chưa có logging/audit log đầy đủ cho toàn bộ thao tác người dùng.

## 11. Hướng phát triển

- Mở rộng nhiều phòng và nhiều thiết bị.
- Chuẩn hóa topic theo dạng:

```text
devices/{deviceId}/...
```

- Thêm web dashboard cho quản trị viên.
- Thêm thông báo push khi có cảnh báo cháy.
- Thêm phân quyền người dùng.
- Thêm audit log.
- Cấu hình MQTT ACL chặt chẽ hơn.
- Nâng cấp bảo mật phần cứng ESP32.
- Tối ưu giao diện mobile app và biểu đồ dữ liệu lịch sử.

## 12. Kết luận

- Đề tài đã xây dựng được một hệ thống IoT smart home có đầy đủ các lớp cơ bản:
  - Thiết bị IoT.
  - MQTT broker.
  - Backend server.
  - Database.
  - Mobile app.
- Hệ thống đáp ứng các yêu cầu chính:
  - Thiết kế kiến trúc tổng quan.
  - Xây dựng hệ thống IoT hoạt động được.
  - Áp dụng các kỹ thuật bảo mật cơ bản.
- Hệ thống có thể dùng để demo luồng thu thập dữ liệu, điều khiển thiết bị, tự động hóa và bảo mật trong IoT.

## Phụ lục đề xuất

### Phụ lục A - Danh sách API

- Trích từ Swagger/OpenAPI.

### Phụ lục B - Danh sách MQTT topic

- Trích bảng topic ở mục 3.3.2.

### Phụ lục C - Một số đoạn code quan trọng

- Middleware xác thực JWT.
- Validate input.
- Logic auto fan.
- Logic light sensor.
- MQTT handler.

### Phụ lục D - Hình ảnh giao diện và demo

- Màn hình login.
- Dashboard.
- Màn hình thiết bị.
- Popup cài hẹn giờ.
- Cài ngưỡng nhiệt độ quạt.

### Phụ lục E - Kết quả kiểm thử

- Backend test result.
- Frontend test result.
- Ảnh chụp DB/MQTT khi demo.
