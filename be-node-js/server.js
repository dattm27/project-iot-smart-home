// Import thư viện express
const express = require('express');
const connectDB = require('./database');
const fs = require('fs');
const axios = require('axios');
const mqtt = require('mqtt');
const app = express();

// Khai báo các hằng
const port = 4000;
const ip = '192.168.1.4';
const brokerUrl = 'mqtt://192.168.1.4'; // Static IP
const options = {
    port: 1883,
    //username: 'hivemq.webclient.1732431972503',
    //password: 'mP<195YJ2VxlDG&s,w$r',
    clientId: 'nodejs-client',
    clean: true,
    reconnectPeriod: 1000,
    connectTimeout: 30 * 1000,
};
const phoneIp = 'http://192.168.1.25:8080';
// Khai báo các topic
const fireAlarmTopic = 'MQ135/FireAlarm';
const MQ135StatisticsTopic = 'MQ135/Statistics';
const LightsControlTopic = 'lights/01';

// Khai báo các model
const FireAlarm = require('./models/FireAlarm');  // Import model FireAlarm từ thư mục models
const MQ135Statistics = require('./models/MQ135Statistics');
const Light = require('./models/Light');

//Khai báo các biến toàn cục
let isFire = false;

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
                    // 
                    if (status === 'inactive')
                        isFire = false;
                    else
                        isFire = true;
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

app.use(express.json());

// Xử lí báo cháy
app.get('/fire-alarm', (req, res) => {
    res.status(200).json({ isFire: isFire });
});

// Xử lí tắt bật đèn
app.put('/lights/OnOff', async (req, res) => {
    //console.log('BODY', req.body);
    const { type, name } = req.body;

    if (!name) {
        return res.status(400).json({ error: 'Cần cung cấp tên đèn (name)' });
    }

    if (type !== 1 && type !== 0) {
        return res.status(400).json({ error: 'Tham số "type" phải là 1 (bật) hoặc 0 (tắt)' });
    }

    try {
        // Tìm đèn theo name
        let light = await Light.findOne({ name });

        if (!light) {
            return res.status(404).json({ error: 'Đèn không tồn tại' });
        }

        // Cập nhật trạng thái của đèn
        light.status = type === 1 ? 1 : 0;
        await light.save();

        const message = JSON.stringify({ type });

        // Gửi tin nhắn vào Mosquitto broker tại topic /lights/01
        mqttClient.publish(LightsControlTopic, message, { qos: 0 }, (err) => {
            if (err) {
                console.error('Error publishing to MQTT broker:', err);
                return res.status(500).json({ error: 'Không thể gửi tin nhắn đến Mosquitto broker' });
            }
            // Trả về phản hồi thành công
            res.status(200).json({
                message: type === 1 ? 'Đèn đã bật' : 'Đèn đã tắt',
                lightStatus: light.status
            });
        });

    } catch (error) {
        res.status(500).json({ error: 'Lỗi khi cập nhật trạng thái đèn' });
    }
});
// Xử lí thay đổi chức năng hẹn giờ cho đèn
app.put('/lights/Timer/', async (req, res) => {
    const { name, timerEnabled, autoOnTime, autoOffTime } = req.body;

    if (!name) {
        return res.status(400).json({ error: 'Cần cung cấp tên đèn (name)' });
    }

    try {
        // Tìm đèn theo name
        let light = await Light.findOne({ name });

        if (!light) {
            return res.status(404).json({ error: 'Đèn không tồn tại' });
        }

        // Cập nhật chế độ hẹn giờ
        light.timerEnabled = timerEnabled || false;

        // Nếu bật chế độ hẹn giờ, cập nhật thời gian bật và tắt
        if (timerEnabled) {
            if (autoOnTime) {
                light.autoOnTime = new Date(autoOnTime);  // Thời gian bật đèn
            }
            if (autoOffTime) {
                light.autoOffTime = new Date(autoOffTime);  // Thời gian tắt đèn
            }
        } else {
            // Nếu tắt chế độ hẹn giờ, xóa thời gian bật và tắt
            light.autoOnTime = null;
            light.autoOffTime = null;
        }

        // Lưu đèn mới vào cơ sở dữ liệu
        await light.save();

        // Trả về phản hồi thành công
        res.status(200).json({
            message: 'Chế độ hẹn giờ đã được cập nhật',
            timerEnabled: light.timerEnabled,
            autoOnTime: light.autoOnTime,
            autoOffTime: light.autoOffTime
        });
    } catch (error) {
        res.status(500).json({ error: 'Lỗi khi cập nhật chế độ hẹn giờ' });
    }
});

// Xử lí thêm đèn mới
app.post('/lights/', async (req, res) => {
    const { name, status, room } = req.body;

    if (!name || !room) {
        return res.status(400).json({ error: 'Cần cung cấp tên đèn (name) và phòng (room)' });
    }

    try {
        // Kiểm tra xem đèn đã tồn tại chưa
        let existingLight = await Light.findOne({ name });
        if (existingLight) {
            return res.status(400).json({ error: 'Đèn với tên này đã tồn tại' });
        }

        // Tạo một đèn mới
        const newLight = new Light({
            name,
            room,
            status: 0  // Mặc định là tắt khi tạo mới
        });

        // Lưu đèn mới vào cơ sở dữ liệu
        await newLight.save();

        // Trả về thông tin đèn đã tạo
        res.status(201).json({
            message: 'Đèn mới đã được thêm thành công',
            light: newLight
        });
    } catch (error) {
        res.status(500).json({ error: 'Lỗi khi thêm đèn mới' });
    }
});


// Hàm kiểm tra và tự động bật/tắt đèn theo thời gian
const checkAutoLights = async () => {
    try {
        // Lấy tất cả đèn đang bật chế độ hẹn giờ
        const lights = await Light.find({ timerEnabled: true });

        lights.forEach(async (light) => {
            const currentTime = new Date();
            const autoOnTime = new Date(light.autoOnTime);
            const autoOffTime = new Date(light.autoOffTime);

            // Kiểm tra nếu hiện tại là thời gian bật đèn
            if (currentTime >= autoOnTime && currentTime < autoOffTime && light.status === 0) {
                // Cập nhật trạng thái bật đèn
                light.status = 1;
                await light.save();

                // Gửi thông điệp MQTT để bật đèn
                const message = JSON.stringify({ type: 1 });
                mqttClient.publish(LightsControlTopic, message, { qos: 1 });
                console.log(`Đèn ${light.name} đã bật tự động.`);
            }

            // Kiểm tra nếu hiện tại là thời gian tắt đèn
            if (currentTime >= autoOffTime && light.status === 1) {
                // Cập nhật trạng thái tắt đèn
                light.status = 0;
                await light.save();

                // Gửi thông điệp MQTT để tắt đèn
                const message = JSON.stringify({ type: 0 });
                mqttClient.publish(LightsControlTopic, message, { qos: 1 });
                console.log(`Đèn ${light.name} đã tắt tự động.`);
            }
        });
    } catch (err) {
        console.error('Lỗi khi kiểm tra và tự động bật/tắt đèn:', err);
    }
};

// Thiết lập một chu kỳ để kiểm tra mỗi phút (60000ms)
setInterval(checkAutoLights, 60000);



app.listen(port, () => {
    console.log(`Server đang chạy tại http://${ip}:${port}`);
});
