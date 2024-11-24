// Import thư viện express
const express = require('express');
const connectDB = require('./database');
const fs = require('fs');

const mqtt = require('mqtt');
const app = express();

// Khai báo các hằng
const port = 4000;
const ip = '192.168.1.4';
const brokerUrl = 'mqtts://c509d576b5cb44a0ac951816712cb591.s1.eu.hivemq.cloud';
const caCert = fs.readFileSync('./CERT.txt');
const options = {
    port: 8883,
    username: 'hivemq.webclient.1732431972503',
    password: 'mP<195YJ2VxlDG&s,w$r',
    clientId: 'nodejs-client',
    clean: true,
    reconnectPeriod: 1000,
    connectTimeout: 30 * 1000,
    ca: caCert,
};
// Liệt kê các topic
const fireAlarmTopic = 'MQ135/FireAlarm';
const MQ135StatisticsTopic = 'MQ135/Statistics';

// Khai báo các model
const FireAlarm = require('./models/FireAlarm');  // Import model FireAlarm từ thư mục models
const MQ135Statistics = require('./models/MQ135Statistics');


// kết nối với database
connectDB();

// Kiểm tra đầu vào có là 1 json không
function isValidJson(str) {
    try {
        JSON.parse(str);
    } catch (e) {
        return false;
    }
    return true;
}

// Kết nối với mqtt
const mqttClient = mqtt.connect(brokerUrl, options);

// Kiểm tra kết nối MQTT
mqttClient.on('connect', () => {
    console.log('Đã kết nối với MQTT broker.');

    // Lắng nghe sự kiện FireAlarm từ topic MQ135/FireAlarm
    mqttClient.subscribe(fireAlarmTopic, (err) => {
        if (err) {
            console.error('Không thể đăng ký topic FireAlarm:', err);
        } else {
            console.log('Đã đăng ký thành công topic MQ135/FireAlarm');
        }
    });
    // Lắng nghe sự kiện FireAlarm từ topic MQ135/Statistics
    mqttClient.subscribe(MQ135StatisticsTopic, (err) => {
        if (err) {
            console.error('Không thể đăng ký topic Statistics:', err);
        } else {
            console.log('Đã đăng ký thành công topic MQ135/Statistics');
        }
    });

});

// Xử lý khi nhận thông điệp từ MQTT
mqttClient.on('message', async (topic, message) => {
    const payload = message.toString();
    if (topic === fireAlarmTopic) {
        try {
            if (isValidJson(payload)) {
                const { time, status } = JSON.parse(payload);

                // Kiểm tra nếu tham số time và status hợp lệ
                if (time && status) {
                    // Tạo mới một FireAlarm từ các tham số nhận được
                    const newFireAlarm = new FireAlarm({
                        time,
                        status
                    });
                    // Lưu vào MongoDB
                    await newFireAlarm.save();
                    console.log(`Thông báo cháy đã được lưu vào MongoDB với time: ${time} và status: ${status}`);
                } else {
                    console.error('Thông điệp không hợp lệ. Thiếu time hoặc status.');
                }
            } else {
                console.error('Thông điệp không phải JSON hợp lệ:', payload);
            }
        } catch (err) {
            console.error('Lỗi khi xử lý thông điệp:', err);
        }
    }
    if (topic === MQ135StatisticsTopic) {
        try {
            if (isValidJson(payload)) {

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
            }
            else {
                console.error('Thông điệp không phải JSON hợp lệ:', payload);
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
