# Báo cáo cuối kỳ

# Xây dựng hệ thống nhà thông minh ứng dụng IoT

## Thông tin chung

- **Tên đề tài:** Xây dựng hệ thống nhà thông minh ứng dụng IoT
- **Môn học:** ...
- **Giảng viên hướng dẫn:** ...
- **Nhóm thực hiện:** ...
- **Thành viên:** ...
- **Thời gian thực hiện:** ...

---

## Mục lục

1. Giới thiệu đề tài
2. Yêu cầu hệ thống
3. Kiến trúc tổng quan hệ thống IoT
4. Thiết kế dữ liệu
5. Xây dựng các chức năng nghiệp vụ
6. Giao diện ứng dụng mobile
7. Bảo mật trong hệ thống IoT
8. Kết quả đạt được
9. Hạn chế và hướng phát triển
10. Kết luận
11. Phụ lục

---

## 1. Giới thiệu đề tài

### 1.1. Lý do chọn đề tài

Internet of Things, hay IoT, là một trong những hướng phát triển quan trọng của các hệ thống phần mềm hiện đại. IoT cho phép kết nối các thiết bị vật lý, cảm biến, bộ điều khiển và ứng dụng người dùng thông qua mạng Internet hoặc mạng nội bộ. Trong thực tế, IoT được ứng dụng trong nhiều lĩnh vực như nhà thông minh, giám sát môi trường, công nghiệp, y tế, nông nghiệp thông minh và đô thị thông minh.

Trong phạm vi đề tài này, nhóm lựa chọn xây dựng một hệ thống nhà thông minh vì đây là một bài toán phù hợp để thể hiện đầy đủ các thành phần cơ bản của một hệ thống IoT. Hệ thống có thiết bị phần cứng để thu thập dữ liệu môi trường, có bộ điều khiển ESP32 để kết nối mạng và giao tiếp MQTT, có backend server để xử lý nghiệp vụ, có database để lưu trữ dữ liệu, và có ứng dụng mobile để người dùng theo dõi, điều khiển thiết bị.

Hệ thống nhà thông minh được xây dựng nhằm giúp người dùng theo dõi các thông số môi trường trong nhà như nhiệt độ, độ ẩm, chất lượng không khí, đồng thời điều khiển các thiết bị cơ bản như đèn và quạt. Ngoài điều khiển thủ công, hệ thống còn hỗ trợ một số chế độ tự động như hẹn giờ bật/tắt thiết bị, bật/tắt đèn theo cảm biến ánh sáng và tự động bật quạt theo nhiệt độ.

Đề tài cũng có ý nghĩa trong việc nghiên cứu và áp dụng các kỹ thuật bảo mật cơ bản cho hệ thống IoT. Do hệ thống IoT có khả năng điều khiển thiết bị vật lý, việc bảo vệ API, tài khoản người dùng, kênh giao tiếp MQTT và logic điều khiển là rất cần thiết.

### 1.2. Mục tiêu đề tài

Mục tiêu chính của đề tài là thiết kế và xây dựng một hệ thống IoT hoàn chỉnh ở mức demo, có thể hoạt động với thiết bị phần cứng thật và ứng dụng mobile. Các mục tiêu cụ thể gồm:

- Thiết kế kiến trúc tổng quan của một hệ thống nhà thông minh ứng dụng IoT.
- Xây dựng thiết bị IoT dùng ESP32 để kết nối cảm biến và thiết bị chấp hành.
- Thu thập dữ liệu từ cảm biến DHT22 và MQ135.
- Điều khiển đèn và quạt thông qua relay.
- Xây dựng backend server bằng Node.js và Express.js.
- Lưu dữ liệu và trạng thái hệ thống vào MongoDB.
- Sử dụng MQTT broker để trao đổi dữ liệu giữa backend và ESP32.
- Xây dựng ứng dụng mobile bằng React Native để người dùng tương tác với hệ thống.
- Triển khai các chức năng nghiệp vụ như đăng nhập, xem dashboard, điều khiển thiết bị, hẹn giờ và tự động hóa.
- Áp dụng các kỹ thuật bảo mật cơ bản như JWT, refresh token, rate limit, validate input, MQTT over TLS và đề xuất MQTT ACL.

### 1.3. Phạm vi đề tài

Trong phạm vi demo cuối kỳ, hệ thống được xây dựng với các thành phần chính sau:

- Một ESP32 đóng vai trò gateway và bộ điều khiển trung tâm cho các thiết bị.
- Một cảm biến DHT22 để đo nhiệt độ và độ ẩm.
- Một cảm biến MQ135 để đo nồng độ khí dạng PPM.
- Một cảm biến ánh sáng phục vụ chế độ bật/tắt đèn tự động.
- Một đèn và một quạt được điều khiển thông qua relay.
- Một backend server xử lý API, MQTT, database và logic tự động.
- Một ứng dụng mobile để người dùng đăng nhập, xem thông tin và điều khiển thiết bị.
- Một MQTT broker cloud để trung gian truyền nhận dữ liệu.
- Một database cloud để lưu trữ dữ liệu.

Hệ thống tập trung vào việc chứng minh kiến trúc và luồng hoạt động của một ứng dụng IoT. Các vấn đề triển khai quy mô lớn như quản lý hàng trăm thiết bị, phân quyền nhiều vai trò người dùng, bảo mật phần cứng nâng cao hoặc triển khai production hoàn chỉnh chưa nằm trong phạm vi chính của đề tài.

---

## 2. Yêu cầu hệ thống

### 2.1. Yêu cầu chức năng

Hệ thống cần đáp ứng các nhóm chức năng chính sau.

#### 2.1.1. Chức năng người dùng

Người dùng có thể đăng ký tài khoản, đăng nhập vào hệ thống và sử dụng ứng dụng mobile để thao tác với các thiết bị. Sau khi đăng nhập, người dùng có thể truy cập các API nghiệp vụ thông qua access token do backend cấp.

Các chức năng người dùng gồm:

- Đăng ký tài khoản.
- Đăng nhập.
- Làm mới access token bằng refresh token.
- Đăng xuất.
- Truy cập các chức năng điều khiển thiết bị sau khi xác thực.

#### 2.1.2. Chức năng giám sát môi trường

Hệ thống cần thu thập và hiển thị các thông số môi trường trong nhà:

- Nhiệt độ.
- Độ ẩm.
- Nồng độ khí PPM.
- Đánh giá chất lượng không khí.
- Trạng thái cảnh báo cháy.

Dữ liệu cảm biến được ESP32 gửi lên MQTT broker, backend subscribe các topic tương ứng, xử lý dữ liệu và lưu vào MongoDB. Ứng dụng mobile gọi API backend để lấy dữ liệu mới nhất và hiển thị cho người dùng.

#### 2.1.3. Chức năng điều khiển đèn

Đèn trong hệ thống hỗ trợ ba hình thức điều khiển:

- Bật/tắt thủ công từ ứng dụng mobile.
- Bật/tắt theo hẹn giờ do người dùng cấu hình.
- Bật/tắt theo cảm biến ánh sáng khi chế độ cảm biến được bật.

Khi người dùng bật/tắt đèn từ app, app không gửi lệnh trực tiếp đến ESP32 mà gửi request đến backend. Backend cập nhật database và publish lệnh đến MQTT topic điều khiển đèn. ESP32 subscribe topic này, nhận lệnh và điều khiển relay.

#### 2.1.4. Chức năng điều khiển quạt

Quạt trong hệ thống hỗ trợ:

- Bật/tắt thủ công từ ứng dụng mobile.
- Bật/tắt theo hẹn giờ.
- Tự động bật theo nhiệt độ khi người dùng bật chế độ auto cooling.

Để đảm bảo an toàn, quạt không tự động bật khi PPM không an toàn. Nếu PPM vượt ngưỡng nguy hiểm, backend force tắt quạt để tránh làm khí gas lan rộng.

#### 2.1.5. Chức năng cảnh báo cháy

Cảm biến MQ135 gửi dữ liệu PPM lên backend thông qua MQTT. Backend phân loại mức chất lượng không khí theo ngưỡng:

- PPM < 900: trạng thái tốt/an toàn.
- 900 <= PPM <= 1100: trạng thái cảnh báo, chất lượng không khí không tốt.
- PPM > 1100: trạng thái nguy hiểm, kích hoạt cảnh báo cháy.

Khi PPM vượt ngưỡng nguy hiểm, backend lưu trạng thái cảnh báo cháy vào database và áp dụng logic an toàn cho quạt.

### 2.2. Yêu cầu phi chức năng

Bên cạnh chức năng nghiệp vụ, hệ thống cần đáp ứng các yêu cầu phi chức năng sau:

- Giao tiếp giữa backend và thiết bị IoT có độ trễ thấp, phù hợp với điều khiển thiết bị.
- Dữ liệu truyền giữa backend và MQTT broker sử dụng MQTT over TLS.
- API nghiệp vụ cần được xác thực bằng JWT.
- Dữ liệu người dùng và thiết bị được lưu trữ trong database.
- Giao diện mobile cần dễ quan sát, dễ thao tác và hiển thị trạng thái thiết bị rõ ràng.
- Logic tự động cần có thứ tự ưu tiên để tránh xung đột giữa điều khiển tay, hẹn giờ và cảm biến.
- Hệ thống có thể cấu hình bằng biến môi trường để thuận tiện cho triển khai.

---

## 3. Kiến trúc tổng quan hệ thống IoT

### 3.1. Sơ đồ kiến trúc hệ thống

**[Placeholder hình 3.1 - Sơ đồ kiến trúc tổng quan hệ thống IoT]**

Sơ đồ kiến trúc tổng quan của hệ thống gồm các lớp chính:

- Lớp người dùng: ứng dụng mobile.
- Lớp backend: REST API, xử lý nghiệp vụ, xác thực, MQTT client.
- Lớp dữ liệu: MongoDB Atlas.
- Lớp giao tiếp IoT: MQTT broker.
- Lớp thiết bị: ESP32, cảm biến, relay, đèn và quạt.

Mô hình giao tiếp tổng quát:

```text
Mobile App
   |
   | REST API + JWT
   v
Backend Node.js/Express
   |                         |
   | Mongoose                | MQTT over TLS
   v                         v
MongoDB Atlas              EMQX Cloud MQTT Broker
                              |
                              | MQTT publish/subscribe
                              v
                           ESP32
                              |
          ------------------------------------------------
          | DHT22 | MQ135 | Cảm biến ánh sáng | Relay    |
          | Nhiệt độ/độ ẩm | PPM | Đèn | Quạt          |
          ------------------------------------------------
```

Trong kiến trúc này, mobile app không giao tiếp trực tiếp với ESP32. Mọi thao tác của người dùng đều đi qua backend. Backend vừa đóng vai trò API server cho mobile app, vừa đóng vai trò MQTT client để trao đổi dữ liệu với thiết bị IoT.

Cách thiết kế này giúp hệ thống dễ kiểm soát quyền truy cập, dễ lưu vết trạng thái thiết bị và dễ áp dụng logic nghiệp vụ tập trung tại backend.

### 3.2. Các thành phần trong hệ thống

#### 3.2.1. Thiết bị IoT và phần cứng

Thiết bị IoT chính trong hệ thống là ESP32. ESP32 có khả năng kết nối Wi-Fi, xử lý dữ liệu cảm biến, điều khiển relay và giao tiếp với MQTT broker. Trong hệ thống demo, một ESP32 được sử dụng để kết nối tất cả cảm biến và thiết bị chấp hành.

Các phần cứng chính gồm:

- **ESP32:** bộ điều khiển trung tâm, kết nối Wi-Fi và MQTT broker.
- **DHT22:** cảm biến nhiệt độ và độ ẩm.
- **MQ135:** cảm biến khí, gửi giá trị PPM.
- **Cảm biến ánh sáng:** hỗ trợ đèn tự động bật/tắt theo môi trường ánh sáng.
- **Relay:** đóng/ngắt nguồn cho đèn và quạt.
- **Đèn:** thiết bị chấp hành được điều khiển thủ công, theo timer hoặc theo cảm biến ánh sáng.
- **Quạt:** thiết bị chấp hành được điều khiển thủ công, theo timer hoặc tự động theo nhiệt độ.

ESP32 publish dữ liệu cảm biến lên MQTT broker và subscribe các topic điều khiển do backend publish. Khi nhận được lệnh bật/tắt, ESP32 điều khiển relay tương ứng và publish trạng thái phản hồi lại broker.

#### 3.2.2. MQTT Broker

Hệ thống sử dụng EMQX Cloud làm MQTT broker. MQTT broker đóng vai trò trung gian truyền nhận message giữa backend và ESP32.

MQTT phù hợp cho hệ thống IoT vì:

- Nhẹ, phù hợp với thiết bị tài nguyên hạn chế.
- Hỗ trợ mô hình publish/subscribe.
- Giảm sự phụ thuộc trực tiếp giữa backend và thiết bị.
- Phù hợp với dữ liệu cảm biến gửi liên tục.
- Có thể sử dụng MQTT over TLS để bảo vệ kênh truyền.

Trong hệ thống, backend và ESP32 không cần biết địa chỉ trực tiếp của nhau. Hai bên chỉ cần biết MQTT broker và các topic quy ước.

#### 3.2.3. Backend Server

Backend server được xây dựng bằng Node.js và Express.js. Backend là thành phần trung tâm xử lý nghiệp vụ của hệ thống.

Các vai trò chính của backend:

- Cung cấp REST API cho mobile app.
- Xác thực người dùng.
- Quản lý access token và refresh token.
- Kết nối MongoDB để lưu dữ liệu.
- Kết nối MQTT broker để nhận dữ liệu cảm biến.
- Publish lệnh điều khiển thiết bị tới ESP32.
- Xử lý logic tự động như hẹn giờ, quạt theo nhiệt độ và báo cháy.
- Cung cấp tài liệu API thông qua Swagger/OpenAPI.

Các công nghệ chính:

- Node.js.
- Express.js.
- Mongoose.
- MQTT.js.
- JSON Web Token.
- Swagger/OpenAPI.

#### 3.2.4. Database

Database sử dụng MongoDB Atlas. MongoDB phù hợp với hệ thống demo vì dữ liệu trong hệ thống có dạng document JSON linh hoạt, ví dụ dữ liệu cảm biến, trạng thái thiết bị, người dùng và refresh token.

Các nhóm dữ liệu chính được lưu:

- Người dùng.
- Refresh token.
- Trạng thái đèn.
- Trạng thái quạt.
- Dữ liệu MQ135.
- Dữ liệu DHT22.
- Trạng thái cảnh báo cháy.

#### 3.2.5. Mobile App

Ứng dụng mobile được xây dựng bằng React Native và TypeScript. App là giao diện chính để người dùng tương tác với hệ thống.

Các vai trò chính của app:

- Đăng ký và đăng nhập.
- Hiển thị dashboard môi trường.
- Hiển thị trạng thái đèn và quạt.
- Điều khiển bật/tắt đèn, quạt.
- Cài đặt hẹn giờ.
- Cài đặt ngưỡng nhiệt độ tự động bật quạt.
- Bật/tắt chế độ đèn theo cảm biến ánh sáng.
- Refresh trạng thái thiết bị định kỳ và thủ công.

### 3.3. Phương thức giao tiếp trao đổi dữ liệu

#### 3.3.1. Giao tiếp giữa Mobile App và Backend

Mobile app giao tiếp với backend bằng REST API. Dữ liệu request và response sử dụng định dạng JSON.

Các API nghiệp vụ yêu cầu access token trong header:

```http
Authorization: Bearer <access-token>
```

Một số API chính:

| API | Phương thức | Ý nghĩa |
| --- | --- | --- |
| `/auth/register` | POST | Đăng ký tài khoản |
| `/auth/login` | POST | Đăng nhập |
| `/auth/refresh` | POST | Làm mới access token |
| `/auth/logout` | POST | Đăng xuất |
| `/lights/` | GET | Lấy danh sách đèn |
| `/lights/OnOff` | PUT | Bật/tắt đèn |
| `/lights/Timer/` | PUT | Cấu hình hẹn giờ đèn |
| `/lights/SensorMode` | PUT | Bật/tắt chế độ cảm biến ánh sáng |
| `/fans/` | GET | Lấy danh sách quạt |
| `/fans/OnOff` | PUT | Bật/tắt quạt |
| `/fans/Timer/` | PUT | Cấu hình hẹn giờ quạt |
| `/fans/AutoCooling` | PUT | Cấu hình quạt tự động theo nhiệt độ |
| `/mq135statistics` | GET | Lấy dữ liệu MQ135 |
| `/dht22statistics` | GET | Lấy dữ liệu DHT22 |
| `/fire-alarm` | GET | Lấy trạng thái báo cháy |

#### 3.3.2. Giao tiếp giữa Backend, MQTT Broker và ESP32

Backend và ESP32 trao đổi dữ liệu thông qua MQTT broker. Các message có payload dạng JSON.

Bảng topic chính:

| Topic | Publisher | Subscriber | Payload mẫu | Ý nghĩa |
| --- | --- | --- | --- | --- |
| `MQ135/Statistics` | ESP32 | Backend | `{ "time": "...", "ppm": 850 }` | Gửi dữ liệu khí PPM |
| `DHT22/Statistics` | ESP32 | Backend | `{ "time": "...", "temp": 35, "humidity": 70 }` | Gửi nhiệt độ, độ ẩm |
| `MQ135/FireAlarm` | ESP32 | Backend | `{ "time": "...", "status": "active" }` | Gửi trạng thái báo cháy |
| `lights/01/server` | Backend | ESP32 | `{ "type": 1 }` | Lệnh bật/tắt đèn |
| `lights/01/button` | ESP32 | Backend | `{ "status": 1 }` | Phản hồi trạng thái đèn |
| `lights/01/sensor` | ESP32 | Backend | `{ "status": 1 }` | Trạng thái đèn do cảm biến ánh sáng |
| `lights/01/sensorControl` | Backend | ESP32 | `{ "enabled": 1 }` | Bật/tắt chế độ cảm biến ánh sáng |
| `fans/01/server` | Backend | ESP32 | `{ "type": 1 }` | Lệnh bật/tắt quạt |
| `fans/01/button` | ESP32 | Backend | `{ "status": 1 }` | Phản hồi trạng thái quạt |

Ví dụ payload MQ135:

```json
{
  "time": "2026-06-29 10-00-00",
  "ppm": 850
}
```

Ví dụ payload DHT22:

```json
{
  "time": "2026-06-29 10-00-00",
  "temp": 35,
  "humidity": 70
}
```

Ví dụ payload điều khiển đèn:

```json
{
  "type": 1
}
```

Trong đó `type = 1` là bật và `type = 0` là tắt.

---

## 4. Thiết kế dữ liệu

### 4.1. User

Model User lưu thông tin tài khoản người dùng. Mật khẩu không được lưu trực tiếp dưới dạng plaintext mà được hash trước khi lưu vào database.

Các trường chính:

| Trường | Ý nghĩa |
| --- | --- |
| `username` | Tên đăng nhập |
| `email` | Email người dùng |
| `password` | Mật khẩu đã hash |
| `salt` | Salt dùng khi hash mật khẩu |

### 4.2. RefreshToken

RefreshToken dùng để cấp lại access token khi access token hết hạn. Để giảm rủi ro khi database bị lộ, refresh token không được lưu trực tiếp mà lưu dưới dạng hash.

Các trường chính:

| Trường | Ý nghĩa |
| --- | --- |
| `userId` | ID người dùng sở hữu token |
| `tokenHash` | Hash của refresh token |
| `expiresAt` | Thời điểm hết hạn |

### 4.3. Light

Model Light lưu trạng thái và cấu hình của đèn.

Các trường chính:

| Trường | Ý nghĩa |
| --- | --- |
| `name` | Tên định danh của đèn |
| `status` | Trạng thái bật/tắt, 1 là bật, 0 là tắt |
| `room` | Phòng chứa đèn |
| `timerEnabled` | Có bật hẹn giờ hay không |
| `autoOnTime` | Thời gian tự bật |
| `autoOffTime` | Thời gian tự tắt |
| `isAutoControlled` | Trạng thái hiện tại có được tạo bởi automation không |
| `manualOverride` | Người dùng vừa can thiệp thủ công |
| `lastAutoReason` | Lý do tự động gần nhất, ví dụ `timer`, `light_sensor` |
| `lightSensorEnabled` | Chế độ cảm biến ánh sáng có được bật không |

Trong logic đèn, `manualOverride` giúp hệ thống không tự bật lại đèn ngay sau khi người dùng vừa tắt tay trong khung giờ tự động.

### 4.4. Fan

Model Fan lưu trạng thái và cấu hình của quạt.

Các trường chính:

| Trường | Ý nghĩa |
| --- | --- |
| `name` | Tên định danh của quạt |
| `status` | Trạng thái bật/tắt |
| `room` | Phòng chứa quạt |
| `timerEnabled` | Có bật hẹn giờ hay không |
| `autoOnTime` | Thời gian tự bật |
| `autoOffTime` | Thời gian tự tắt |
| `autoOnByTemperature` | Có bật chế độ tự động theo nhiệt độ không |
| `autoOnTemperature` | Ngưỡng nhiệt độ để tự bật quạt |
| `isAutoControlled` | Trạng thái hiện tại có được tạo bởi automation không |
| `manualOverride` | Người dùng vừa can thiệp thủ công |
| `lastAutoReason` | Lý do tự động gần nhất, ví dụ `timer`, `temperature` |

### 4.5. MQ135Statistics

Model MQ135Statistics lưu dữ liệu khí đo được từ cảm biến MQ135.

Các trường chính:

| Trường | Ý nghĩa |
| --- | --- |
| `time` | Thời gian do ESP32 gửi lên |
| `ppm` | Giá trị PPM |
| `airQuality` | Đánh giá chất lượng không khí |
| `timestamp` | Thời điểm backend lưu dữ liệu |

### 4.6. DHT22Statistics

Model DHT22Statistics lưu dữ liệu nhiệt độ và độ ẩm.

Các trường chính:

| Trường | Ý nghĩa |
| --- | --- |
| `time` | Thời gian do ESP32 gửi lên |
| `temp` | Nhiệt độ |
| `humidity` | Độ ẩm |
| `timestamp` | Thời điểm backend lưu dữ liệu |

### 4.7. FireAlarm

Model FireAlarm lưu trạng thái cảnh báo cháy.

Các trường chính:

| Trường | Ý nghĩa |
| --- | --- |
| `time` | Thời gian sự kiện |
| `status` | Trạng thái `active` hoặc `inactive` |
| `timestamp` | Thời điểm backend lưu dữ liệu |

---

## 5. Xây dựng các chức năng nghiệp vụ

### 5.1. Chức năng xác thực người dùng

Hệ thống cung cấp chức năng đăng ký, đăng nhập, refresh token và đăng xuất. Khi người dùng đăng ký, backend kiểm tra dữ liệu đầu vào, hash mật khẩu và lưu thông tin người dùng vào database. Khi đăng nhập thành công, backend trả về access token và refresh token.

Access token được dùng để truy cập các API nghiệp vụ. Refresh token được dùng để cấp lại access token khi access token hết hạn. Cơ chế này giúp access token có thời gian sống ngắn hơn, giảm rủi ro nếu token bị lộ.

Luồng đăng nhập:

1. Người dùng nhập username và password trên mobile app.
2. App gọi API `/auth/login`.
3. Backend kiểm tra thông tin đăng nhập.
4. Nếu hợp lệ, backend trả về access token và refresh token.
5. App sử dụng access token để gọi các API nghiệp vụ.

**[Placeholder hình 5.1 - Luồng đăng nhập và xác thực API]**

### 5.2. Chức năng dashboard môi trường

Dashboard môi trường hiển thị các thông tin mới nhất từ hệ thống cảm biến. ESP32 gửi dữ liệu cảm biến lên MQTT broker. Backend subscribe các topic dữ liệu, validate payload, lưu vào database và cung cấp API cho mobile app.

Dữ liệu hiển thị gồm:

- Nhiệt độ.
- Độ ẩm.
- PPM.
- Trạng thái chất lượng không khí.
- Trạng thái báo cháy.

Backend phân loại PPM theo ngưỡng:

| Điều kiện | Trạng thái |
| --- | --- |
| PPM < 900 | Tốt/an toàn |
| 900 <= PPM <= 1100 | Cảnh báo |
| PPM > 1100 | Nguy hiểm/báo cháy |

Khi PPM vượt 1100, backend lưu trạng thái báo cháy là `active`. Khi PPM trở lại dưới ngưỡng nguy hiểm, backend có thể cập nhật trạng thái báo cháy về `inactive`.

### 5.3. Chức năng điều khiển đèn

#### 5.3.1. Bật/tắt đèn thủ công

Khi người dùng bấm bật hoặc tắt đèn trên app, app gửi request đến API `/lights/OnOff`. Backend kiểm tra token, validate dữ liệu, cập nhật trạng thái đèn trong database và publish lệnh MQTT đến topic `lights/01/server`.

ESP32 subscribe topic `lights/01/server`, nhận payload `{ "type": 1 }` hoặc `{ "type": 0 }`, sau đó điều khiển relay đèn. Sau khi trạng thái thay đổi, ESP32 publish phản hồi lên `lights/01/button` để backend đồng bộ trạng thái thực tế.

**[Placeholder hình 5.2 - Luồng bật/tắt đèn thủ công]**

#### 5.3.2. Hẹn giờ đèn

Người dùng có thể cài đặt thời gian bật và tắt đèn. Backend lưu cấu hình gồm:

- `timerEnabled`.
- `autoOnTime`.
- `autoOffTime`.

Backend chạy kiểm tra định kỳ. Nếu thời gian hiện tại nằm trong khung bật đèn, backend sẽ bật đèn nếu đèn chưa bật và không bị `manualOverride`. Nếu hết khung giờ, backend chỉ tắt đèn nếu đèn đó đang được timer điều khiển.

Cơ chế này giúp tránh tình huống backend tắt nhầm đèn mà người dùng bật thủ công ngoài khung timer.

#### 5.3.3. Đèn theo cảm biến ánh sáng

Hệ thống hỗ trợ chế độ bật/tắt đèn theo cảm biến ánh sáng. Khi người dùng bật chế độ này trên app, backend cập nhật `lightSensorEnabled = true` và publish cấu hình tới topic `lights/01/sensorControl`.

Payload bật chế độ cảm biến ánh sáng:

```json
{
  "enabled": 1
}
```

Khi chế độ cảm biến ánh sáng được bật, ESP32 có thể tự quyết định bật/tắt đèn theo cảm biến và publish trạng thái lên topic `lights/01/sensor`.

Backend chỉ cập nhật trạng thái từ topic `lights/01/sensor` nếu `lightSensorEnabled = true`. Nếu người dùng đã tắt chế độ cảm biến ánh sáng, backend bỏ qua message từ topic này để tránh việc cảm biến cũ hoặc message ngoài ý muốn làm thay đổi trạng thái đèn.

**[Placeholder hình 5.3 - Luồng đèn theo cảm biến ánh sáng]**

### 5.4. Chức năng điều khiển quạt

#### 5.4.1. Bật/tắt quạt thủ công

Luồng bật/tắt quạt thủ công tương tự đèn. App gọi API `/fans/OnOff`, backend cập nhật database và publish lệnh MQTT tới topic `fans/01/server`. ESP32 nhận lệnh, điều khiển relay quạt và publish phản hồi trạng thái lên `fans/01/button`.

**[Placeholder hình 5.4 - Luồng bật/tắt quạt thủ công]**

#### 5.4.2. Hẹn giờ quạt

Người dùng có thể cấu hình thời gian bật/tắt quạt. Backend lưu cấu hình timer và kiểm tra định kỳ. Khi thời gian hiện tại nằm trong khung giờ bật, backend bật quạt. Khi hết khung giờ, backend tắt quạt nếu quạt đang được điều khiển bởi timer.

#### 5.4.3. Quạt tự động theo nhiệt độ

Người dùng có thể bật chế độ quạt tự động theo nhiệt độ và cài đặt ngưỡng nhiệt độ. Backend nhận dữ liệu nhiệt độ từ DHT22 và dữ liệu PPM từ MQ135 để quyết định có bật quạt hay không.

Điều kiện tự động bật quạt:

```text
Nhiệt độ >= ngưỡng người dùng cài đặt
và PPM < 900
và không có manualOverride
```

Lý do cần kiểm tra PPM là vì nếu khí gas đang ở mức không an toàn, việc bật quạt có thể làm khí lan rộng hơn. Do đó hệ thống chỉ cho phép auto cooling khi PPM ở mức an toàn.

#### 5.4.4. Logic an toàn khi PPM nguy hiểm

Khi PPM vượt 1100, backend áp dụng chính sách an toàn cao nhất:

```text
Nếu PPM > 1100:
  Force tắt quạt
```

Chính sách này được ưu tiên hơn cả điều khiển thủ công và hẹn giờ. Nghĩa là dù quạt đang bật do người dùng bật tay hoặc do timer, backend vẫn publish lệnh tắt quạt khi phát hiện gas danger.

### 5.5. Logic ưu tiên chống xung đột

Trong hệ thống IoT, một thiết bị có thể bị điều khiển bởi nhiều nguồn khác nhau: người dùng, hẹn giờ, cảm biến hoặc rule an toàn. Nếu không định nghĩa thứ tự ưu tiên, các luồng này có thể xung đột với nhau.

#### 5.5.1. Thứ tự ưu tiên của quạt

Hệ thống định nghĩa thứ tự ưu tiên cho quạt như sau:

```text
Gas danger > manualOverride > timer > auto cooling theo nhiệt độ
```

Ý nghĩa:

- **Gas danger:** nếu PPM > 1100, quạt bị force tắt để đảm bảo an toàn.
- **manualOverride:** nếu người dùng vừa tắt tay, hệ thống không tự bật lại ngay.
- **timer:** nếu timer đang trong khung active, sensor auto cooling không được tự tắt quạt.
- **auto cooling:** chỉ tự bật quạt khi nhiệt độ cao và PPM an toàn.

Nhờ thứ tự ưu tiên này, hệ thống tránh được các tình huống như:

- Quạt đang trong khung timer nhưng bị sensor tắt nhầm khi nhiệt độ giảm.
- Quạt tiếp tục chạy khi khí gas nguy hiểm.
- Người dùng vừa tắt quạt nhưng hệ thống tự bật lại ngay.

#### 5.5.2. Thứ tự ưu tiên của đèn

Với đèn, hệ thống sử dụng `manualOverride` để tôn trọng thao tác người dùng. Nếu người dùng tắt đèn trong khung timer, backend không tự bật lại ngay trong cùng khung giờ.

Ngoài ra, với cảm biến ánh sáng, backend chỉ nhận trạng thái từ topic sensor nếu chế độ cảm biến đang được bật. Điều này giúp tránh xung đột giữa việc người dùng đã tắt chế độ cảm biến nhưng ESP32 vẫn gửi message trạng thái cũ.

**[Placeholder hình 5.5 - Luồng hoạt động của đèn]**

**[Placeholder hình 5.6 - Luồng hoạt động của quạt]**

---

## 6. Giao diện ứng dụng mobile

### 6.1. Màn hình đăng nhập và đăng ký

Ứng dụng mobile cung cấp màn hình đăng nhập và đăng ký để người dùng truy cập hệ thống. Người dùng nhập thông tin tài khoản, app gửi request đến backend và nhận token nếu thông tin hợp lệ.

Sau khi đăng nhập thành công, app lưu token để gọi các API nghiệp vụ. Nếu token hết hạn, app có thể dùng refresh token để xin access token mới.

**[Placeholder hình 6.1 - Màn hình đăng nhập]**

**[Placeholder hình 6.2 - Màn hình đăng ký]**

### 6.2. Màn hình dashboard

Màn hình dashboard hiển thị dữ liệu môi trường mới nhất. Các thông tin chính gồm:

- Nhiệt độ.
- Độ ẩm.
- PPM.
- Trạng thái chất lượng không khí.
- Cảnh báo cháy nếu có.

Giao diện dashboard được thiết kế để người dùng có thể nhanh chóng quan sát tình trạng môi trường trong nhà.

**[Placeholder hình 6.3 - Màn hình dashboard môi trường]**

### 6.3. Màn hình thiết bị

Màn hình thiết bị hiển thị trạng thái đèn và quạt. Người dùng có thể bật/tắt thiết bị, cấu hình timer và bật/tắt các chế độ tự động.

Với đèn, app hỗ trợ:

- Bật/tắt thủ công.
- Cài hẹn giờ bật/tắt.
- Bật/tắt chế độ cảm biến ánh sáng.
- Hiển thị trạng thái hiện tại và khung giờ hẹn giờ.

Với quạt, app hỗ trợ:

- Bật/tắt thủ công.
- Cài hẹn giờ bật/tắt.
- Bật/tắt chế độ tự động theo nhiệt độ.
- Cài đặt ngưỡng nhiệt độ.
- Hiển thị trạng thái hiện tại và khung giờ hẹn giờ.

App tự refresh trạng thái thiết bị định kỳ 30 giây và có nút refresh thủ công để người dùng cập nhật trạng thái ngay khi cần.

**[Placeholder hình 6.4 - Màn hình danh sách thiết bị]**

**[Placeholder hình 6.5 - Popup cài hẹn giờ thiết bị]**

**[Placeholder hình 6.6 - Cài đặt tự động theo nhiệt độ cho quạt]**

---

## 7. Bảo mật trong hệ thống IoT

### 7.1. Tổng quan rủi ro bảo mật

Hệ thống IoT có đặc thù là phần mềm có thể tác động trực tiếp đến thiết bị vật lý. Vì vậy, nếu hệ thống bị truy cập trái phép, kẻ tấn công có thể bật/tắt thiết bị, đọc dữ liệu cảm biến hoặc làm sai lệch logic tự động.

Các rủi ro chính trong hệ thống gồm:

| Rủi ro | Mô tả | Biện pháp áp dụng |
| --- | --- | --- |
| Gọi API trái phép | Người lạ điều khiển thiết bị | JWT access token |
| Brute-force login | Thử nhiều mật khẩu | Rate limit login/register |
| Lộ mật khẩu | Database bị lộ dữ liệu | Hash password bằng scrypt + salt |
| Token bị đánh cắp | Access token bị lạm dụng | Access token ngắn hạn + refresh token |
| NoSQL injection | Payload object độc hại | Validate input strict |
| Nghe lén MQTT | Lộ dữ liệu cảm biến/lệnh điều khiển | MQTT over TLS |
| Client MQTT publish sai topic | Điều khiển sai thiết bị | Đề xuất MQTT ACL |
| Logic tự động gây nguy hiểm | Quạt chạy khi gas nguy hiểm | Gas danger priority |

### 7.2. Xác thực người dùng

Hệ thống yêu cầu người dùng đăng nhập trước khi sử dụng các chức năng nghiệp vụ. Khi đăng nhập thành công, backend cấp access token dưới dạng JWT.

JWT chứa thông tin định danh người dùng và được ký bằng secret ở backend. Khi app gọi API nghiệp vụ, backend kiểm tra token trong header `Authorization`.

Ví dụ header:

```http
Authorization: Bearer <access-token>
```

Nếu token không hợp lệ hoặc không tồn tại, backend từ chối request.

### 7.3. Xác thực API bằng middleware

Các API nghiệp vụ như bật/tắt đèn, bật/tắt quạt, cấu hình timer, lấy dữ liệu cảm biến đều được đặt sau middleware xác thực. Điều này đảm bảo chỉ người dùng đã đăng nhập mới có thể truy cập các chức năng điều khiển thiết bị.

Một số API public không cần token:

- `/auth/register`
- `/auth/login`
- `/auth/refresh`
- `/auth/logout`
- `/api-docs`
- `/openapi.json`
- `/health`

Các API còn lại yêu cầu access token.

### 7.4. Bảo vệ mật khẩu người dùng

Mật khẩu người dùng không được lưu trực tiếp trong database. Backend sử dụng cơ chế hash mật khẩu kèm salt. Nhờ đó, nếu database bị lộ, kẻ tấn công không thể đọc trực tiếp mật khẩu gốc của người dùng.

Quy trình lưu mật khẩu:

1. Người dùng gửi password khi đăng ký.
2. Backend tạo salt.
3. Backend hash password cùng salt.
4. Backend lưu hash và salt vào database.

Khi đăng nhập, backend hash password người dùng nhập với salt đã lưu và so sánh với hash trong database.

### 7.5. Refresh token và rotation

Access token có thời gian sống ngắn để giảm rủi ro nếu bị lộ. Tuy nhiên, nếu access token hết hạn quá nhanh, người dùng sẽ phải đăng nhập lại nhiều lần. Vì vậy hệ thống sử dụng refresh token.

Refresh token có các đặc điểm:

- Có thời gian sống dài hơn access token.
- Được lưu trong database dưới dạng hash.
- Được rotate sau mỗi lần refresh.
- Có thể bị xóa khi người dùng logout.

Rotation refresh token giúp giảm nguy cơ reuse token cũ. Khi app dùng refresh token để xin access token mới, backend xóa hoặc vô hiệu refresh token cũ và cấp refresh token mới.

### 7.6. Rate limit cho login/register

API đăng nhập và đăng ký là các điểm dễ bị tấn công brute-force hoặc spam. Hệ thống áp dụng rate limit cho các API này.

Cơ chế rate limit:

- Giới hạn số lần gọi trong một khoảng thời gian.
- Key giới hạn dựa trên IP và username.
- Nếu vượt quá giới hạn, backend trả về lỗi 429.

Cơ chế này giúp giảm nguy cơ kẻ tấn công thử nhiều mật khẩu liên tục hoặc spam tạo tài khoản.

### 7.7. Validate input và chống NoSQL injection

Do backend sử dụng MongoDB, hệ thống cần tránh trường hợp người dùng gửi payload dạng object độc hại như:

```json
{
  "username": { "$ne": null }
}
```

Nếu không validate, payload dạng này có thể làm sai lệch điều kiện query. Vì vậy backend validate input chặt chẽ trước khi truy vấn database.

Các rule validate chính:

- Body request phải là JSON object hợp lệ.
- `type` phải là số 0 hoặc 1.
- `timerEnabled` phải là boolean.
- `enabled` phải là boolean.
- `autoOnTemperature` phải là số trong khoảng hợp lệ.
- `name` chỉ được chứa các ký tự hợp lệ.
- `username`, `email`, `password` phải đúng định dạng.
- Không chấp nhận object ở các trường cần string/number/boolean.

Nhờ validate input, hệ thống giảm được rủi ro NoSQL injection và lỗi dữ liệu không đúng kiểu.

### 7.8. Bảo mật kênh MQTT

Hệ thống sử dụng MQTT over TLS thông qua broker EMQX Cloud. MQTT over TLS giúp mã hóa dữ liệu truyền giữa backend, broker và thiết bị, giảm nguy cơ bị nghe lén.

Backend kết nối MQTT bằng:

```text
mqtts://u7bf1cb3.ala.asia-southeast1.emqxsl.com
```

Backend và ESP32 sử dụng username/password để xác thực với MQTT broker.

### 7.9. Đề xuất MQTT ACL

MQTT ACL giúp giới hạn quyền publish/subscribe của từng client. Vì hệ thống hiện tại có một ESP32 điều khiển toàn bộ thiết bị, không nhất thiết phải tạo credential riêng cho từng đèn/quạt/cảm biến. Cách hợp lý hơn là dùng credential theo vai trò client:

- `be-server`: dùng cho backend.
- `esp32-main`: dùng cho ESP32.

Đề xuất phân quyền:

| Client | Được publish | Được subscribe |
| --- | --- | --- |
| `be-server` | `lights/01/server`, `lights/01/sensorControl`, `fans/01/server` | `MQ135/Statistics`, `MQ135/FireAlarm`, `DHT22/Statistics`, `lights/01/button`, `lights/01/sensor`, `fans/01/button` |
| `esp32-main` | `MQ135/Statistics`, `MQ135/FireAlarm`, `DHT22/Statistics`, `lights/01/button`, `lights/01/sensor`, `fans/01/button` | `lights/01/server`, `lights/01/sensorControl`, `fans/01/server` |

Không nên cấp wildcard `#` cho ESP32 vì nếu credential bị lộ, attacker có thể publish/subscribe toàn bộ hệ thống.

### 7.10. Bảo mật cấu hình

Các thông tin nhạy cảm được đưa vào biến môi trường thay vì hard-code trong mã nguồn.

Các biến quan trọng:

- `MONGO_URI`
- `JWT_SECRET`
- `MQTT_USERNAME`
- `MQTT_PASSWORD`
- `MQTT_BROKER_URL`

Repository chỉ nên commit file `.env.example`, không commit file `.env` thật. Điều này giúp tránh lộ secret khi đưa mã nguồn lên GitHub.

### 7.11. Bảo mật logic nghiệp vụ

Ngoài bảo mật tài khoản và kênh truyền, hệ thống còn cần bảo mật ở mức logic nghiệp vụ. Với IoT, logic sai có thể gây nguy hiểm vật lý.

Hệ thống đã áp dụng các rule an toàn:

- Quạt chỉ tự động bật khi nhiệt độ cao và PPM < 900.
- Nếu PPM > 1100, backend force tắt quạt.
- Timer không được bật lại quạt khi dữ liệu khí mới nhất đang ở mức nguy hiểm.
- Auto cooling không được tắt quạt nếu timer đang active, trừ trường hợp gas danger.
- Light sensor message bị bỏ qua nếu người dùng đã tắt chế độ cảm biến ánh sáng.

Nhờ đó, hệ thống tránh được các xung đột như quạt chạy khi khí gas nguy hiểm hoặc cảm biến ánh sáng thay đổi đèn dù chế độ sensor đã tắt.

### 7.12. Hạn chế bảo mật và đề xuất cải thiện

Các cơ chế bảo mật hiện tại đáp ứng yêu cầu demo và thể hiện được các kỹ thuật cơ bản. Tuy nhiên, nếu triển khai production, hệ thống cần bổ sung:

- HTTPS cho backend nếu public ra Internet.
- CORS whitelist theo domain/app cụ thể.
- HTTP security headers bằng Helmet.
- Audit log cho các thao tác điều khiển thiết bị.
- Phân quyền người dùng theo vai trò.
- Cấu hình MQTT ACL trực tiếp trên EMQX Cloud.
- Rotate MQTT password định kỳ.
- Secure boot và flash encryption cho ESP32.
- Cơ chế revoke toàn bộ token khi người dùng đổi mật khẩu.

---

## 8. Kết quả đạt được

Sau quá trình xây dựng, hệ thống đã đạt được các kết quả chính sau:

- Thiết kế được kiến trúc tổng quan của một hệ thống IoT smart home.
- Xây dựng được backend server bằng Node.js/Express.
- Xây dựng được mobile app bằng React Native.
- Kết nối được backend với MQTT broker cloud.
- ESP32 có thể gửi dữ liệu cảm biến và nhận lệnh điều khiển thiết bị qua MQTT.
- Backend có thể lưu dữ liệu cảm biến vào MongoDB.
- Người dùng có thể đăng ký, đăng nhập và sử dụng app để điều khiển thiết bị.
- Hệ thống hỗ trợ điều khiển đèn và quạt thủ công.
- Hệ thống hỗ trợ hẹn giờ cho đèn và quạt.
- Hệ thống hỗ trợ đèn theo cảm biến ánh sáng.
- Hệ thống hỗ trợ quạt tự động theo nhiệt độ, có kiểm tra PPM để đảm bảo an toàn.
- Hệ thống có cảnh báo cháy theo ngưỡng PPM.
- Hệ thống áp dụng được các kỹ thuật bảo mật cơ bản như JWT, refresh token, rate limit, validate input và MQTT over TLS.

**[Placeholder hình 8.1 - Ảnh demo dashboard hiển thị nhiệt độ, độ ẩm, PPM]**

**[Placeholder hình 8.2 - Ảnh demo điều khiển đèn/quạt trên mobile app]**

**[Placeholder hình 8.3 - Ảnh demo message MQTT trên broker/client]**

---

## 9. Hạn chế và hướng phát triển

### 9.1. Hạn chế

Hệ thống hiện tại vẫn còn một số hạn chế:

- Demo sử dụng một ESP32 điều khiển tất cả thiết bị, chưa mô phỏng nhiều node IoT độc lập.
- Số lượng thiết bị còn ít, chủ yếu gồm một đèn và một quạt.
- Chưa có web dashboard riêng cho admin.
- MQTT ACL mới nên được trình bày là đề xuất hoặc cấu hình cần hoàn thiện nếu chưa triển khai đầy đủ trên broker.
- Chưa có phân quyền người dùng theo vai trò.
- Chưa có audit log đầy đủ cho thao tác điều khiển thiết bị.
- Chưa áp dụng bảo mật phần cứng nâng cao như secure boot hoặc flash encryption.
- Giao diện app mới tập trung cho demo, chưa tối ưu cho nhiều phòng/nhiều thiết bị.

### 9.2. Hướng phát triển

Trong tương lai, hệ thống có thể được phát triển thêm theo các hướng:

- Mở rộng nhiều phòng và nhiều thiết bị.
- Chuẩn hóa topic MQTT theo dạng:

```text
devices/{deviceId}/...
```

- Bổ sung web dashboard cho quản trị viên.
- Thêm thông báo push khi có cảnh báo cháy.
- Thêm phân quyền người dùng.
- Thêm audit log cho các thao tác điều khiển.
- Cấu hình MQTT ACL chặt chẽ hơn trên broker.
- Nâng cấp bảo mật phần cứng ESP32.
- Bổ sung biểu đồ dữ liệu lịch sử nhiệt độ, độ ẩm và PPM.
- Tối ưu giao diện mobile app cho nhiều thiết bị và nhiều phòng.

---

## 10. Kết luận

Đề tài đã xây dựng được một hệ thống nhà thông minh ứng dụng IoT với đầy đủ các thành phần cơ bản: thiết bị IoT, MQTT broker, backend server, database và ứng dụng mobile. Hệ thống cho phép người dùng giám sát môi trường trong nhà, điều khiển đèn/quạt và sử dụng một số chế độ tự động như hẹn giờ, cảm biến ánh sáng và quạt tự động theo nhiệt độ.

Về mặt kiến trúc, hệ thống sử dụng mô hình backend làm trung tâm. Mobile app giao tiếp với backend bằng REST API, backend giao tiếp với ESP32 thông qua MQTT broker. Cách thiết kế này giúp tách biệt app và thiết bị, đồng thời tạo điều kiện để backend kiểm soát xác thực, lưu dữ liệu và xử lý logic nghiệp vụ.

Về mặt bảo mật, hệ thống đã áp dụng các cơ chế cơ bản như xác thực người dùng, xác thực API bằng JWT, refresh token, rate limit, validate input, hash mật khẩu và MQTT over TLS. Ngoài ra, hệ thống cũng có các rule an toàn ở tầng nghiệp vụ, đặc biệt là logic force tắt quạt khi PPM vượt ngưỡng nguy hiểm.

Nhìn chung, hệ thống đáp ứng được các yêu cầu chính của đề tài cuối kỳ: thiết kế kiến trúc IoT, xây dựng hệ thống IoT hoạt động được và áp dụng các kỹ thuật bảo mật cơ bản cho hệ thống.

---

## 11. Phụ lục

### Phụ lục A - Danh sách topic MQTT

| Topic | Ý nghĩa |
| --- | --- |
| `MQ135/Statistics` | ESP32 gửi dữ liệu PPM |
| `DHT22/Statistics` | ESP32 gửi nhiệt độ và độ ẩm |
| `MQ135/FireAlarm` | ESP32 gửi trạng thái báo cháy |
| `lights/01/server` | Backend gửi lệnh bật/tắt đèn |
| `lights/01/button` | ESP32 phản hồi trạng thái đèn |
| `lights/01/sensor` | ESP32 gửi trạng thái đèn theo cảm biến ánh sáng |
| `lights/01/sensorControl` | Backend bật/tắt chế độ cảm biến ánh sáng |
| `fans/01/server` | Backend gửi lệnh bật/tắt quạt |
| `fans/01/button` | ESP32 phản hồi trạng thái quạt |

### Phụ lục B - Danh sách API chính

| API | Ý nghĩa |
| --- | --- |
| `POST /auth/register` | Đăng ký |
| `POST /auth/login` | Đăng nhập |
| `POST /auth/refresh` | Làm mới access token |
| `POST /auth/logout` | Đăng xuất |
| `GET /lights/` | Lấy danh sách đèn |
| `PUT /lights/OnOff` | Bật/tắt đèn |
| `PUT /lights/Timer/` | Cài timer đèn |
| `PUT /lights/SensorMode` | Bật/tắt cảm biến ánh sáng |
| `GET /fans/` | Lấy danh sách quạt |
| `PUT /fans/OnOff` | Bật/tắt quạt |
| `PUT /fans/Timer/` | Cài timer quạt |
| `PUT /fans/AutoCooling` | Cài quạt tự động theo nhiệt độ |
| `GET /mq135statistics` | Lấy dữ liệu MQ135 |
| `GET /dht22statistics` | Lấy dữ liệu DHT22 |
| `GET /fire-alarm` | Lấy trạng thái báo cháy |

### Phụ lục C - Hình ảnh cần bổ sung

- **[Placeholder phụ lục C.1 - Ảnh mô hình phần cứng]**
- **[Placeholder phụ lục C.2 - Ảnh ESP32 và các cảm biến]**
- **[Placeholder phụ lục C.3 - Ảnh giao diện mobile app]**
- **[Placeholder phụ lục C.4 - Ảnh MQTT broker/client khi gửi message]**
- **[Placeholder phụ lục C.5 - Ảnh MongoDB lưu dữ liệu cảm biến]**

### Phụ lục D - Link tài liệu API

Khi backend chạy, tài liệu API có thể truy cập tại:

```text
http://localhost:4000/api-docs
```

OpenAPI JSON:

```text
http://localhost:4000/openapi.json
```
