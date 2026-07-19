# Kịch bản thuyết trình 10 phút — bao-cao-cuoi-ky-slides-v2.pptx (20 slide)

Tổng thời lượng ước tính: **~9 phút 30 giây** nội dung + dư khoảng 30s cho chuyển slide/hít thở.
Đọc thoải mái theo ý, không cần học thuộc lòng từng chữ — đây là *ý cần nói*, không phải văn bản đọc nguyên.

---

### Slide 1-2 — Bìa (HUST + Tiêu đề) — ~20s
> Em xin chào thầy/cô và các bạn. Em xin trình bày bài tập lớn môn Kiến trúc và Bảo mật trong hệ thống IoT, đề tài: **Bảo mật hệ thống IoT — case study nhà thông minh**. Nhóm em gồm [đọc tên 4 thành viên trên slide].

---

### Slide 3 — Nội dung trình bày — ~15s
> Bài trình bày của nhóm em gồm 5 phần: giới thiệu và yêu cầu hệ thống, kiến trúc tổng quan, triển khai xây dựng hệ thống, bảo mật hệ thống, và cuối cùng là kết quả, hạn chế, kết luận.

---

### Slide 4 — Giới thiệu đề tài — ~35s
> Nhà thông minh là bài toán rất phù hợp để thể hiện đầy đủ các thành phần cơ bản của một hệ thống IoT: từ thiết bị phần cứng thu thập dữ liệu môi trường, cho tới backend xử lý nghiệp vụ, lưu trữ dữ liệu, và mobile app để người dùng theo dõi, điều khiển.
> Mục tiêu của nhóm là xây dựng một hệ thống hoàn chỉnh ở mức demo, hoạt động thật với phần cứng ESP32 và ứng dụng mobile thật — không chỉ là mô phỏng trên giấy.
> Về mặt ý nghĩa, đây là dịp để nhóm nghiên cứu và áp dụng các kỹ thuật bảo mật cơ bản cho một hệ thống IoT có khả năng điều khiển thiết bị vật lý — tức là rủi ro không chỉ là lộ dữ liệu mà còn có thể ảnh hưởng vật lý thật.

---

### Slide 5 — Mục tiêu & Phạm vi đề tài — ~40s
> Về mục tiêu chính, nhóm thiết kế kiến trúc tổng quan cho hệ thống nhà thông minh, xây dựng ESP32 kết nối cảm biến và thiết bị chấp hành, backend bằng Node.js/Express lưu dữ liệu bằng MongoDB, dùng MQTT broker để trao đổi dữ liệu giữa backend và ESP32, và mobile app bằng React Native để người dùng tương tác. Toàn bộ hệ thống áp dụng các kỹ thuật bảo mật như JWT, refresh token, rate limit, MQTT TLS.
> Vì đây là demo cuối kỳ, phạm vi được giới hạn: một ESP32 đóng vai trò gateway trung tâm, với cảm biến DHT22, MQ135 đo khí, và một đèn một quạt điều khiển qua relay. Nhóm chưa làm nhiều thiết bị/nhiều phòng, đa vai trò người dùng, hay bảo mật phần cứng nâng cao — những phần này nằm trong hướng phát triển sau.

---

### Slide 6 — Yêu cầu chức năng & phi chức năng — ~35s
> Về chức năng, hệ thống hỗ trợ người dùng đăng ký/đăng nhập với refresh token, giám sát môi trường — nhiệt độ, độ ẩm, PPM khí, cảnh báo cháy — và điều khiển đèn/quạt theo 3 chế độ: thủ công, hẹn giờ, tự động.
> Về phi chức năng, giao tiếp giữa backend và thiết bị cần độ trễ thấp, dữ liệu qua MQTT được mã hoá TLS, API được xác thực bằng JWT, và logic tự động có thứ tự ưu tiên rõ ràng để tránh xung đột giữa tay bấm, hẹn giờ và cảm biến.

*(Chuyển ý)* → Bây giờ em xin đi vào phần 1: kiến trúc tổng quan hệ thống.

---

### Slide 7 — Divider: PHẦN 1 — ~8s
> Phần 1 — Kiến trúc tổng quan hệ thống IoT.

---

### Slide 8 — Sơ đồ kiến trúc hệ thống — ~50s
> Đây là sơ đồ kiến trúc tổng thể. Mobile app ở trên cùng, giao tiếp với Backend qua REST API. Backend đóng vai trò trung tâm: nó lưu dữ liệu vào MongoDB Atlas, đồng thời là MQTT client kết nối tới MQTT Broker để trao đổi với ESP32 — nơi gắn các cảm biến DHT22, MQ135, cảm biến ánh sáng, và điều khiển đèn/quạt qua relay.
> Điểm quan trọng nhất của kiến trúc này: **Mobile app không giao tiếp trực tiếp với ESP32** — mọi thao tác đều phải đi qua Backend. Điều này giúp kiểm soát quyền truy cập tập trung và toàn bộ logic nghiệp vụ, xác thực đều nằm ở một chỗ, dễ bảo mật và bảo trì hơn so với việc mobile app điều khiển trực tiếp thiết bị.

---

### Slide 9 — Các thành phần hệ thống & công nghệ — ~35s
> Về công nghệ cụ thể: thiết bị IoT dùng ESP32 với các cảm biến DHT22, MQ135, cảm biến ánh sáng và relay. MQTT Broker dùng EMQX Cloud với kết nối TLS. Backend server dùng Node.js, Express, Mongoose, MQTT.js, JWT, có tài liệu API bằng Swagger. Database là MongoDB Atlas. Và Mobile app viết bằng React Native với TypeScript.

*(Chuyển ý)* → Tiếp theo là phần 2: triển khai xây dựng hệ thống, đi vào các chức năng nghiệp vụ chính.

---

### Slide 10 — Divider: PHẦN 2 — ~8s
> Phần 2 — Triển khai xây dựng hệ thống.

---

### Slide 11 — Chức năng điều khiển đèn & quạt — ~45s
> Đèn có 3 chế độ: thủ công — app gửi lệnh, backend cập nhật database rồi publish MQTT xuống ESP32; hẹn giờ — backend quét định kỳ mỗi 5 giây để kiểm tra thời gian bật/tắt cấu hình; và theo cảm biến ánh sáng — lúc này ESP32 tự quyết định bật tắt dựa trên độ sáng môi trường. Nhóm có cơ chế `manualOverride` và `lastAutoReason` để tránh timer hoặc cảm biến vô tình bật/tắt lại đèn ngay sau khi người dùng vừa thao tác tay.
> Quạt cũng có cơ chế tương tự thủ công/hẹn giờ, nhưng có thêm chế độ auto cooling — tự bật khi nhiệt độ vượt ngưỡng và chất lượng không khí còn an toàn. Đặc biệt có lớp an toàn: nếu nồng độ khí PPM vượt quá 1100 — tức nguy hiểm cháy — backend sẽ **ép buộc tắt quạt ngay lập tức**, bất kể quạt đang bật vì lý do gì, để tránh quạt thổi gió làm lửa lan nhanh hơn.

---

### Slide 12 — Logic ưu tiên chống xung đột & cảnh báo cháy — ~45s
> Vì có nhiều nguồn cùng điều khiển thiết bị — tay bấm, hẹn giờ, cảm biến — nhóm thiết kế thứ tự ưu tiên rõ ràng, giảm dần: cao nhất là cảnh báo khí gas nguy hiểm, sau đó đến timer/thao tác thủ công, thấp nhất là auto cooling theo nhiệt độ.
> Cơ chế `lastAutoReason` đảm bảo timer chỉ tự tắt thiết bị nếu chính timer là nguồn bật trước đó, tránh việc tắt nhầm thiết bị người dùng vừa mới bật tay. Và `manualOverride` ngăn timer bật lại thiết bị mà người dùng vừa tắt thủ công.
> Về ngưỡng cảnh báo không khí: dưới 900 PPM là an toàn, từ 900 đến 1100 là cảnh báo, và trên 1100 là mức nguy hiểm, kích hoạt báo cháy.

---

### Slide 13 — Giao diện mobile app — ~25s
> Đây là một số màn hình chính của mobile app: màn hình đăng nhập/đăng ký, dashboard hiển thị chỉ số môi trường và danh sách thiết bị, và màn hình cấu hình hẹn giờ/tự động theo nhiệt độ cho từng thiết bị.

*(Chuyển ý)* → Phần cuối cùng, cũng là trọng tâm của đề tài: bảo mật hệ thống IoT.

---

### Slide 14 — Divider: PHẦN 3 — ~8s
> Phần 3 — Bảo mật hệ thống IoT.

---

### Slide 15 — Tổng quan rủi ro bảo mật — ~40s
> Nhóm xác định các rủi ro chính và biện pháp tương ứng: gọi API trái phép được chặn bằng JWT access token; brute-force đăng nhập được chặn bằng rate limit; lộ mật khẩu trong database được giảm thiểu bằng hash scrypt kèm salt; access token bị đánh cắp thì có thời hạn ngắn kèm refresh token; NoSQL injection được chặn bằng validate input nghiêm ngặt; nghe lén MQTT được chặn bằng TLS; và logic tự động nguy hiểm — như quạt chạy khi có gas — được xử lý bằng cơ chế ưu tiên an toàn đã nói ở phần trước.

---

### Slide 16 — Các biện pháp bảo mật đã áp dụng — ~50s
> Về xác thực và API: mọi API nghiệp vụ đều yêu cầu JWT access token qua middleware xác thực đặt trước toàn bộ route. Refresh token được lưu dạng hash trong database và rotate sau mỗi lần dùng. Có rate limit cho đăng nhập/đăng ký theo cả IP và username.
> Về chống injection và cấu hình: mật khẩu hash bằng scrypt kèm salt; input được validate nghiêm ngặt để chặn payload NoSQL injection kiểu dùng toán tử Mongo; các thông tin nhạy cảm như connection string, JWT secret, MQTT credential đều đưa vào biến môi trường, không hardcode trong code, và có gitignore riêng cho từng project.
> Về kênh MQTT: kết nối qua `mqtts://` tức MQTT over TLS để mã hoá dữ liệu; backend và ESP32 dùng hai bộ username/password riêng biệt, không dùng chung một credential; và không dùng wildcard cho ESP32, giới hạn theo nhóm topic cụ thể để giảm thiệt hại nếu credential bị lộ.

---

### Slide 17 — Kết quả đạt được — ~25s
> Nhóm đã hoàn thành: kiến trúc tổng quan hệ thống IoT smart home, backend Node.js/Express hoàn chỉnh, mobile app bằng React Native, kết nối MQTT broker cloud có TLS, ESP32 gửi dữ liệu và nhận lệnh điều khiển, điều khiển đèn/quạt đủ 3 chế độ, cảnh báo cháy theo ngưỡng PPM, và đầy đủ các cơ chế bảo mật JWT, refresh token, rate limit, validate input, cùng MQTT ACL với 2 credential riêng biệt.

---

### Slide 18 — Hạn chế & hướng phát triển — ~30s
> Về hạn chế: hiện một ESP32 điều khiển toàn bộ thiết bị nên số lượng thiết bị còn ít, chưa có web dashboard riêng cho admin, chưa phân quyền người dùng theo vai trò.
> Hướng phát triển tiếp theo: mở rộng nhiều phòng nhiều ESP32 với chuẩn hoá topic theo device ID, xây web dashboard quản trị kèm push notification khi có cảnh báo cháy, và thêm phân quyền người dùng cùng audit log.

---

### Slide 19 — Kết luận — ~30s
> Tóm lại, nhóm đã xây dựng hoàn chỉnh một hệ thống nhà thông minh IoT gồm đầy đủ thiết bị, MQTT broker, backend, database và mobile app. Kiến trúc backend-trung tâm giúp tách biệt rõ ràng giữa app và thiết bị, tập trung xác thực và xử lý nghiệp vụ ở một nơi duy nhất. Nhóm đã áp dụng các kỹ thuật bảo mật cơ bản như JWT, refresh token, rate limit, validate input, hash password và MQTT over TLS — đáp ứng đầy đủ 3 yêu cầu chính của đề tài: kiến trúc, triển khai và bảo mật hệ thống IoT.

---

### Slide 20 — Cảm ơn — ~5s
> Nhóm em xin cảm ơn thầy/cô và các bạn đã lắng nghe. Nhóm em xin sẵn sàng nhận câu hỏi.

---

## Ghi chú luyện tập
- Tổng cộng ~9p30s lời nói + dư ra cho việc chuyển slide, hít thở, click chỉ vào sơ đồ → an toàn cho khung 10 phút.
- 2 slide đáng dừng lâu nhất là **Sơ đồ kiến trúc** (slide 8) và **Biện pháp bảo mật** (slide 16) — đây là 2 slide "chấm điểm" nên nói chậm, rõ, có thể chỉ tay vào sơ đồ khi nói.
- 3 slide chuyển phần (divider) chỉ cần đọc tên phần, không dừng lại giải thích gì thêm.
- Nếu bị hụt giờ, có thể cắt bớt phần script ở slide 17-18 (Kết quả / Hạn chế) — đọc nhanh, không cần đọc hết từng gạch đầu dòng, vì nội dung đã hiện đủ trên slide cho khán giả tự đọc.
