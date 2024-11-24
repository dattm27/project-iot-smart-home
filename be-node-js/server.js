// Import thư viện express
const express = require('express');
const connectDB = require('./database');
const mqtt = require('mqtt');
const app = express();

// Khai báo các hằng
const port = 4000;
const ip = '192.168.1.4';

// Khai báo các model
const FireAlarm = require('./models/FireAlarm');  // Import model FireAlarm từ thư mục models
const MQ135Statistics = require('./models/MQ135Statistics');


// kết nối với database
connectDB();

// Kết nối với mqtt
const mqttClient = mqtt.connect('mqtt://broker.hivemq.com:1883');

// Kiểm tra kết nối MQTT
mqttClient.on('connect', () => {
    console.log('Đã kết nối với MQTT broker.');

    // Lắng nghe sự kiện FireAlarm từ topic /132002abc/MQ135/FireAlarm
    mqttClient.subscribe('/132002abc/MQ135/FireAlarm', (err) => {
        if (err) {
            console.error('Không thể đăng ký topic FireAlarm:', err);
        } else {
            console.log('Đã đăng ký thành công topic /132002abc/MQ135/FireAlarm');
        }
    });

    mqttClient.subscribe('/132002abc/MQ135/Statistics', (err) => {
        if (err) {
            console.error('Không thể đăng ký topic Statistics:', err);
        } else {
            console.log('Đã đăng ký thành công topic /132002abc/MQ135/Statistics');
        }
    });

});

// Xử lý khi nhận thông điệp từ MQTT
mqttClient.on('message', async (topic, message) => {
    if (topic === '/132002abc/MQ135/FireAlarm') {
        try {
            // Chuyển thông điệp từ Buffer sang chuỗi
            const payload = message.toString();

            // Giả sử payload là một chuỗi JSON có dạng { "time": "2024-11-24T12:00:00Z", "status": "active" }
            const { time, status } = JSON.parse(payload);

            // Kiểm tra nếu tham số time và status hợp lệ
            if (time && status) {
                // Tạo mới một FireAlarm từ các tham số nhận được
                const newFireAlarm = new FireAlarm({
                    time,
                    status
                });
                // Lưu thông báo báo cháy vào MongoDB
                await newFireAlarm.save();
                console.log(`Thông báo cháy đã được lưu vào MongoDB với time: ${time} và status: ${status}`);
            } else {
                console.error('Thông điệp không hợp lệ. Thiếu time hoặc status.');
            }
        } catch (err) {
            console.error('Lỗi khi xử lý thông điệp:', err);
        }
    }
    if (topic === '/132002abc/MQ135/Statistics') {
        try {
            // Chuyển thông điệp từ Buffer sang chuỗi
            const payload = message.toString();

            // Giả sử payload là một chuỗi JSON có dạng { "time": "2024-11-24T12:00:00Z", "status": "active" }
            const { Time, AirQuality, CO2_PPM, CO_PPM } = JSON.parse(payload);

            // Kiểm tra nếu tham số time và status hợp lệ
            if (Time && AirQuality && CO2_PPM !== undefined && CO_PPM !== undefined) {
                // Tạo mới một MQ135Statistics từ các tham số nhận được
                const newMQ135Statistics = new MQ135Statistics({
                    time: Time,
                    airQuality: AirQuality,
                    co2_ppm: CO2_PPM,
                    co_ppm: CO_PPM
                });
                // Lưu thông tin MQ135Statistics vào MongoDB
                await newMQ135Statistics.save();
                console.log(`Thông báo MQ135Statistics đã được lưu vào MongoDB với time: ${Time}`);
            } else {
                console.error('Thông điệp không hợp lệ. Thiếu thông tin cần thiết.');
            }
        } catch (err) {
            console.error('Lỗi khi xử lý thông điệp:', err);
        }
    }
});

// Khi xảy ra lỗi với MQTT
mqttClient.on('error', (err) => {
    console.error('Lỗi kết nối MQTT:', err);
});

app.listen(port, () => {
    console.log(`Server đang chạy tại http://${ip}:${port}`);
});
