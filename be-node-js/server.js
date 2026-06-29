// Import thư viện express
const dotenv = require('dotenv');
dotenv.config();

const express = require('express');
const connectDB = require('./database');
const { DateTime } = require('luxon');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const mqtt = require('mqtt');
const authenticateToken = require('./middleware/authenticateToken');
const { comparePassword, generateToken, hashPassword } = require('./auth');
const app = express();
const requiredEnv = (name) => {
    if (!process.env[name]) {
        throw new Error(`${name} is required`);
    }
    return process.env[name];
};
const log = (scope, message, data = {}) => {
    const details = Object.entries(data)
        .filter(([, value]) => value !== undefined && value !== null)
        .map(([key, value]) => `${key}=${typeof value === 'object' ? JSON.stringify(value) : value}`)
        .join(' ');

    console.log(`[${scope}] ${message}${details ? ` | ${details}` : ''}`);
};
const logError = (scope, message, error) => {
    console.error(`[${scope}] ${message}`, error?.message || error || '');
};
const actionText = (type) => (Number(type) === 1 ? 'ON' : 'OFF');

// Khai báo các hằng
const port = Number(requiredEnv('PORT'));
const ip = requiredEnv('SERVER_IP');
const brokerUrl = requiredEnv('MQTT_BROKER_URL');
const phoneIp = requiredEnv('PHONE_IP');
const caCertPath = requiredEnv('MQTT_CA_CERT_PATH');
const caCert = process.env.NODE_ENV === 'test' ? undefined : fs.readFileSync(path.resolve(__dirname, caCertPath));
const hiveMQusername = requiredEnv('HIVEMQ_USERNAME');
const hiveMQpassword = requiredEnv('HIVEMQ_PASSWORD');
log('CONFIG', 'Loaded MQTT config', { brokerUrl, port: process.env.MQTT_PORT, clientId: process.env.MQTT_CLIENT_ID });

const options = {
    port: Number(requiredEnv('MQTT_PORT')),
    username: hiveMQusername,
    password: hiveMQpassword,
    clientId: requiredEnv('MQTT_CLIENT_ID'),
    clean: requiredEnv('MQTT_CLEAN') === 'true',
    reconnectPeriod: Number(requiredEnv('MQTT_RECONNECT_PERIOD_MS')),
    connectTimeout: Number(requiredEnv('MQTT_CONNECT_TIMEOUT_MS')),
    ca: caCert,
};

// Khai báo các topic
const fireAlarmTopic = requiredEnv('MQTT_FIRE_ALARM_TOPIC');
const MQ135StatisticsTopic = requiredEnv('MQTT_MQ135_STATISTICS_TOPIC');
const LightsControlTopic = requiredEnv('MQTT_LIGHTS_CONTROL_TOPIC');
const LightsResponseTopic = requiredEnv('MQTT_LIGHTS_RESPONSE_TOPIC');
const FansControlTopic = requiredEnv('MQTT_FANS_CONTROL_TOPIC');
const FansResponseTopic = requiredEnv('MQTT_FANS_RESPONSE_TOPIC');
const MQ135PeriodTopic = requiredEnv('MQTT_MQ135_PERIOD_TOPIC');
const defaultFanName = requiredEnv('DEFAULT_FAN_NAME');
const defaultLightName = requiredEnv('DEFAULT_LIGHT_NAME');
const timezone = requiredEnv('TIMEZONE');
const autoCheckIntervalMs = Number(requiredEnv('AUTO_CHECK_INTERVAL_MS'));
const autoFanOnBadAir = requiredEnv('AUTO_FAN_ON_BAD_AIR') === 'true';
const autoFanCoThreshold = Number(requiredEnv('AUTO_FAN_CO_THRESHOLD'));
const autoFanCo2Threshold = Number(requiredEnv('AUTO_FAN_CO2_THRESHOLD'));


// Khai báo các model
const FireAlarm = require('./models/FireAlarm');  // Import model FireAlarm từ thư mục models
const MQ135Statistics = require('./models/MQ135Statistics');
const Light = require('./models/Light');
const Fan = require('./models/Fan');
const User = require('./models/User');

//Khai báo các biến toàn cục
let isFire = false;

// Kết nối với database
if (process.env.NODE_ENV !== 'test') {
    connectDB();
}

// Kiểm tra đầu vào có là 1 json không
function isValidJson(str) {
    try {
        JSON.parse(str);
    } catch (e) {
        return false;
    }
    return true;
}

// Hàm trả về chất lượng không khí
function evaluateAirQuality(co2, co) {
    // Định nghĩa ngưỡng
    const co2Levels = { GOOD: 400, NORMAL: 1000 };
    const coLevels = { GOOD: 9, NORMAL: 35 };

    // Đánh giá CO2
    let co2Status = "BAD";
    if (co2 <= co2Levels.GOOD) co2Status = "GOOD";
    else if (co2 <= co2Levels.NORMAL) co2Status = "NORMAL";

    // Đánh giá CO
    let coStatus = "BAD";
    if (co <= coLevels.GOOD) coStatus = "GOOD";
    else if (co <= coLevels.NORMAL) coStatus = "NORMAL";

    // Kết hợp đánh giá
    if (co2Status === "GOOD" && coStatus === "GOOD") {
        return "GOOD";
    } else if (co2Status === "BAD" || coStatus === "BAD") {
        return "BAD";
    } else {
        return "NORMAL";
    }
}

const createTestMqttClient = () => ({
    on: () => {},
    subscribe: (_topic, callback) => callback && callback(),
    publish: (_topic, _message, _options, callback) => callback && callback(),
});

// Kết nối với mqtt
const mqttClient = process.env.NODE_ENV === 'test' ? createTestMqttClient() : mqtt.connect(brokerUrl, options);

// Kiểm tra kết nối MQTT
mqttClient.on('connect', () => {
    log('MQTT', 'Connected to broker', { brokerUrl });

    // Lắng nghe sự kiện FireAlarm từ topic MQ135/FireAlarm
    mqttClient.subscribe(fireAlarmTopic, (err) => {
        if (err) {
            logError('MQTT', `Subscribe failed topic=${fireAlarmTopic}`, err);
        } else {
            log('MQTT', 'Subscribed', { topic: fireAlarmTopic });
        }
    });
    // Lắng nghe sự kiện FireAlarm từ topic MQ135/Statistics
    mqttClient.subscribe(MQ135StatisticsTopic, (err) => {
        if (err) {
            logError('MQTT', `Subscribe failed topic=${MQ135StatisticsTopic}`, err);
        } else {
            log('MQTT', 'Subscribed', { topic: MQ135StatisticsTopic });
        }
    });
    mqttClient.subscribe(LightsResponseTopic, (err) => {
        if (err) {
            logError('MQTT', `Subscribe failed topic=${LightsResponseTopic}`, err);
        } else {
            log('MQTT', 'Subscribed', { topic: LightsResponseTopic });
        }
    });
    mqttClient.subscribe(FansResponseTopic, (err) => {
        if (err) {
            logError('MQTT', `Subscribe failed topic=${FansResponseTopic}`, err);
        } else {
            log('MQTT', 'Subscribed', { topic: FansResponseTopic });
        }
    });

});

// Xử lý khi nhận thông điệp từ MQTT
mqttClient.on('message', async (topic, message) => {
    const payload = message.toString();
    //console.log("PAYLOAD NHAN DUOC", payload);
    if (topic === fireAlarmTopic) {
        try {
            if (isValidJson(payload)) {
                const { time, status } = JSON.parse(payload);
                log('MQTT][FIRE', 'Received fire alarm event', { status, time, topic });

                // Kiểm tra nếu tham số time và status hợp lệ
                if (time && status) {
                    // 
                    if (status === 'inactive')
                        isFire = false;
                    else
                        isFire = true;
                    // Tạo mới một FireAlarm từ các tham số nhận được
                    const latestFireAlarm = await FireAlarm.findOne().sort({ timestamp: -1 });

                    if (latestFireAlarm) {
                        // So sánh status của bản ghi gần nhất với status mới
                        if (latestFireAlarm.status === status) {
                            log('DB][FIRE', 'Skipped duplicate fire alarm status', { status });
                            return;
                        }
                        else {
                            log('DB][FIRE', 'Updated latest fire alarm status', { from: latestFireAlarm.status, to: status, time });
                            // Cập nhật trạng thái và thời gian
                            latestFireAlarm.status = status;
                            latestFireAlarm.time = time;
                            latestFireAlarm.timestamp = Date.now();
                            await latestFireAlarm.save();
                        }
                    }
                    else {
                        const newFireAlarm = new FireAlarm({
                            time,
                            status
                        });
                        // Lưu vào MongoDB
                        await newFireAlarm.save();
                    }
                    log('DB][FIRE', 'Saved fire alarm event', { status, time, isFire });
                } else {
                    logError('MQTT][FIRE', 'Invalid payload, missing time or status', payload);
                }
            } else {
                logError('MQTT][FIRE', 'Payload is not valid JSON', payload);
            }
        } catch (err) {
            logError('MQTT][FIRE', 'Failed to handle message', err);
        }
    }
    if (topic === MQ135StatisticsTopic) {
        try {
            if (isValidJson(payload)) {

                // Giả sử payload là một chuỗi JSON có dạng { "time": "2024-11-24T12:00:00Z", "status": "active" }
                const { time, co2_ppm, co_ppm, temp } = JSON.parse(payload);
                log('MQTT][SENSOR', 'Received MQ135 statistics', { temp, co2_ppm, co_ppm, topic });

                // Kiểm tra nếu tham số time và status hợp lệ
                if (time && co2_ppm !== undefined && co_ppm !== undefined && temp !== undefined) {
                    // Tạo mới một MQ135Statistics từ các tham số nhận được
                    const AirQuality = evaluateAirQuality(co2_ppm, co_ppm);
                    const newMQ135Statistics = new MQ135Statistics({
                        time: time,
                        airQuality: AirQuality,
                        co2_ppm: co2_ppm,
                        co_ppm: co_ppm,
                        temp: temp,
                    });
                    // Lưu thông tin MQ135Statistics vào MongoDB
                    await newMQ135Statistics.save();
                    log('DB][SENSOR', 'Saved MQ135 statistics', { temp, co2_ppm, co_ppm, airQuality: AirQuality });
                    //console.log(`Thông báo MQ135Statistics đã được lưu vào MongoDB với time: ${time}` + ' với nội dung là ' + newMQ135Statistics);

                    // bat tat quat khi nhiet do qua nong
                    //console.log("BAT DAU CHUC NANG BAT QUAT THEO NHIET DO")
                    autoTurnOnFans(temp, AirQuality, co_ppm, co2_ppm);

                } else {
                    logError('MQTT][SENSOR', 'Invalid payload, missing required fields', payload);
                }
            }
            else {
                logError('MQTT][SENSOR', 'Payload is not valid JSON', payload);
            }
        } catch (err) {
            logError('MQTT][SENSOR', 'Failed to handle MQ135 message', err);
        }
    }
    if (topic === FansResponseTopic) {
        // Trả về phản hồi thành công
        try {
            if (isValidJson(payload)) {
                const { type, name: payloadName } = JSON.parse(payload);
                const name = payloadName || defaultFanName;
                log('MQTT][FAN', 'Received device response', { name, action: actionText(type), topic });
                let fan = await Fan.findOne({ name });

                if (!fan) {
                    log('MQTT][FAN', 'Ignored response because fan was not found', { name });
                    return;
                }
                // console.log("HIEU LENH TYPE: ", type);
                // Cập nhật trạng thái của đèn
                fan.status = type == 1 ? 1 : 0;
                fan.isAutoControlled = type == 0;
                //console.log("I FOUND THIS FAN: ", fan);
                await fan.save();
                log('DB][FAN', 'Synced fan status from device response', { name, status: fan.status, source: topic });
            }
            else {
                logError('MQTT][FAN', 'Payload is not valid JSON', payload);
            }
        }
        catch (err) {
            logError('MQTT][FAN', 'Failed to handle device response', err);
        }

    }
    if (topic === LightsResponseTopic) {
        try {
            if (isValidJson(payload)) {
                const { type, name: payloadName } = JSON.parse(payload);
                const name = payloadName || defaultLightName;
                log('MQTT][LIGHT', 'Received device response', { name, action: actionText(type), topic });
                let light = await Light.findOne({ name });

                if (!light) {
                    log('MQTT][LIGHT', 'Ignored response because light was not found', { name });
                    return;
                }

                // Cập nhật trạng thái của đèn
                light.status = type == 1 ? 1 : 0;
                light.isAutoControlled = type == 0;
                await light.save();
                log('DB][LIGHT', 'Synced light status from device response', { name, status: light.status, source: topic });
            }
            else {
                logError('MQTT][LIGHT', 'Payload is not valid JSON', payload);
            }
        }
        catch (err) {
            logError('MQTT][LIGHT', 'Failed to handle device response', err);
        }
    }
});

// Khi xảy ra lỗi với MQTT
mqttClient.on('error', (err) => {
    logError('MQTT', 'Connection error', err);
});

app.use(express.json());

app.post('/auth/register', async (req, res) => {
    const { username, email, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: 'Cần cung cấp username và password' });
    }

    if (password.length < 6) {
        return res.status(400).json({ error: 'Password phải có ít nhất 6 ký tự' });
    }

    try {
        const existingUser = await User.findOne({ username });
        if (existingUser) {
            return res.status(400).json({ error: 'Username này đã tồn tại' });
        }

        const user = new User({
            username,
            email,
            passwordHash: hashPassword(password),
        });
        await user.save();

        const token = generateToken(user);
        return res.status(201).json({
            message: 'Đăng ký thành công',
            token,
            user: {
                id: user._id,
                username: user.username,
                email: user.email,
            },
        });
    } catch (error) {
        return res.status(500).json({ error: 'Lỗi khi đăng ký tài khoản' });
    }
});

app.post('/auth/login', async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: 'Cần cung cấp username và password' });
    }

    try {
        const user = await User.findOne({ username });
        if (!user || !comparePassword(password, user.passwordHash)) {
            return res.status(401).json({ error: 'Username hoặc password không đúng' });
        }

        const token = generateToken(user);
        return res.status(200).json({
            message: 'Đăng nhập thành công',
            token,
            user: {
                id: user._id,
                username: user.username,
                email: user.email,
            },
        });
    } catch (error) {
        return res.status(500).json({ error: 'Lỗi khi đăng nhập' });
    }
});

app.use(authenticateToken);

// Xử lí báo cháy
app.get('/fire-alarm', (req, res) => {
    res.status(200).json({ isFire: isFire });
});

////////////////////////////////////////// XU LI LIEN QUAN DEN QUAT //////////////////////////////////////////

// Xử lí tắt bật quạt
app.put('/fans/OnOff', async (req, res) => {
    //console.log('BODY', req.body);
    const { type, name } = req.body;
    if (!name) {
        return res.status(400).json({ error: 'Cần cung cấp tên quạt (name)' });
    }
    if (type !== 1 && type !== 0) {
        return res.status(400).json({ error: 'Tham số "type" phải là 1 (bật) hoặc 0 (tắt)' });
    }
    log('HTTP][FAN', 'Received manual command', { name, action: actionText(type) });
    try {
        // Tìm quạt theo name
        let fan = await Fan.findOne({ name });

        if (!fan) {
            return res.status(404).json({ error: 'Quạt không tồn tại' });
        }

        // Cập nhật trạng thái của đèn
        fan.status = type === 1 ? 1 : 0;
        fan.isAutoControlled = type === 0;
        await fan.save();
        log('DB][FAN', 'Updated fan status from HTTP command', { name, status: fan.status, isAutoControlled: fan.isAutoControlled });

        const message = JSON.stringify({ type });

        // Gửi tin nhắn vào Mosquitto broker tại topic /lights/01
        mqttClient.publish(FansControlTopic, message, { qos: 0 }, (err) => {
            if (err) {
                logError('MQTT][FAN', `Publish failed topic=${FansControlTopic}`, err);
                return res.status(500).json({ error: 'Không thể gửi tin nhắn đến Mosquitto broker' });
            }
            log('MQTT][FAN', 'Published command', { topic: FansControlTopic, name, action: actionText(type), payload: message });
        });
        res.status(200).json({
            message: type === 1 ? 'Quạt đã bật' : 'Quạt đã tắt',
            fanStatus: fan.status
        });
    } catch (error) {
        res.status(500).json({ error: 'Lỗi khi cập nhật trạng thái quạt' });
    }
});

// Xử lí tắt bật chế độ tư động làm mát của quạt
app.put('/fans/AutoCooling', async (req, res) => {
    const { name, autoOnByTemperature, autoOnTemperature } = req.body;
    if (!name) {
        return res.status(400).json({ error: 'Cần cung cấp tên quạt (name)' });
    }
    try {
        // Tìm quạt theo name
        let fan = await Fan.findOne({ name });

        if (!fan) {
            return res.status(404).json({ error: 'Quạt không tồn tại' });
        }

        // Cập nhật trạng thái của đèn
        fan.autoOnByTemperature = autoOnByTemperature == true ? true : false;
        fan.autoOnTemperature = autoOnTemperature;
        await fan.save();

        res.status(200).json({
            message: autoOnByTemperature == true ? 'Quạt đã bật chế độ autocooling' : 'Quạt đã tắt chế độ autocooling',
            fanAutoOnByTemperature: fan.autoOnByTemperature
        });
    } catch (error) {
        res.status(500).json({ error: 'Lỗi khi cập nhật trạng thái AutoCooling quạt' });
    }
});

// Xử lí thêm quạt mới
app.post('/fans/', async (req, res) => {
    const { name, status, room, timerEnabled, autoOnTime, autoOffTime } = req.body;

    if (!name || !room) {
        return res.status(400).json({ error: 'Cần cung cấp tên quạt (name) và phòng (room)' });
    }

    try {
        // Kiểm tra xem quạt đã tồn tại chưa
        let existingFan = await Fan.findOne({ name });
        if (existingFan) {
            return res.status(400).json({ error: 'Quạt với tên này đã tồn tại' });
        }

        // Tạo một đèn mới
        const newFan = new Fan({
            name,
            room,
            status: 0,
            timerEnabled: timerEnabled !== undefined ? timerEnabled : false,
            autoOnTime: autoOnTime || null,
            autoOffTime: autoOffTime || null
        });

        // Lưu đèn mới vào cơ sở dữ liệu
        await newFan.save();

        // Trả về thông tin đèn đã tạo
        res.status(201).json({
            message: 'Quạt mới đã được thêm thành công',
            Fan: newFan
        });
    } catch (error) {
        res.status(500).json({ error: 'Lỗi khi thêm quạt mới' });
    }
});

// Lấy danh sách các quạt
app.get('/fans/', async (req, res) => {
    try {
        // Lấy tất cả đèn từ cơ sở dữ liệu
        const fans = await Fan.find();

        // Kiểm tra nếu danh sách quạt trống
        if (fans.length === 0) {
            return res.status(404).json({ error: 'Không có quạt nào trong cơ sở dữ liệu' });
        }

        // Trả về danh sách đèn
        res.status(200).json({
            message: 'Danh sách quạt đã được lấy thành công',
            fans,
        });
    } catch (error) {
        logError('HTTP][FAN', 'Failed to fetch fans', error);
        res.status(500).json({ error: 'Lỗi khi lấy danh sách quạt' });
    }
});

// Xử lí thay đổi chức năng hẹn giờ cho quạt
app.put('/fans/Timer/', async (req, res) => {
    const { name, timerEnabled, autoOnTime, autoOffTime } = req.body;

    if (!name) {
        return res.status(400).json({ error: 'Cần cung cấp tên quạt (name)' });
    }

    try {
        // Tìm quạt theo name
        let fan = await Fan.findOne({ name });

        if (!fan) {
            return res.status(404).json({ error: 'Quạt không tồn tại' });
        }
        // Cập nhật chế độ hẹn giờ
        fan.timerEnabled = timerEnabled || false;

        // Nếu bật chế độ hẹn giờ, cập nhật thời gian bật và tắt
        if (timerEnabled) {
            if (autoOnTime) {
                fan.autoOnTime = new Date(autoOnTime);  // Thời gian bật đèn
            }
            if (autoOffTime) {
                fan.autoOffTime = new Date(autoOffTime);  // Thời gian tắt đèn
            }
        } else {
            // Nếu tắt chế độ hẹn giờ, xóa thời gian bật và tắt
            fan.autoOnTime = null;
            fan.autoOffTime = null;
        }

        // Lưu quạt mới vào cơ sở dữ liệu
        await fan.save();

        // Trả về phản hồi thành công
        res.status(200).json({
            message: 'Chế độ hẹn giờ đã được cập nhật',
            timerEnabled: fan.timerEnabled,
            autoOnTime: fan.autoOnTime,
            autoOffTime: fan.autoOffTime
        });
    } catch (error) {
        res.status(500).json({ error: 'Lỗi khi cập nhật chế độ hẹn giờ' });
    }
});

// Xóa quạt theo tên
app.delete('/fans/', async (req, res) => {
    const { name } = req.body;

    if (!name) {
        return res.status(400).json({ error: 'Cần cung cấp tên quạt để xóa' });
    }

    try {
        // Tìm đèn theo tên
        const fan = await Fan.findOne({ name });
        if (!fan) {
            return res.status(404).json({ error: 'Không tìm thấy quạt với tên này' });
        }

        // Xóa đèn
        await Fan.deleteOne({ name });

        // Trả về phản hồi thành công
        res.status(200).json({
            message: 'Quạt đã được xóa thành công',
            fan,
        });
    } catch (error) {
        logError('HTTP][FAN', 'Failed to delete fan', error);
        res.status(500).json({ error: 'Lỗi khi xóa quạt' });
    }
});


////////////////////////////////////////// XU LI LIEN QUAN DEN DEN //////////////////////////////////////////

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
    log('HTTP][LIGHT', 'Received manual command', { name, action: actionText(type) });
    try {
        // Tìm đèn theo name
        let light = await Light.findOne({ name });

        if (!light) {
            return res.status(404).json({ error: 'Đèn không tồn tại' });
        }

        // Cập nhật trạng thái của đèn
        light.status = type === 1 ? 1 : 0;
        light.isAutoControlled = type === 0;
        await light.save();
        log('DB][LIGHT', 'Updated light status from HTTP command', { name, status: light.status, isAutoControlled: light.isAutoControlled });

        const message = JSON.stringify({ type });

        // Gửi tin nhắn vào Mosquitto broker tại topic /lights/01
        mqttClient.publish(LightsControlTopic, message, { qos: 0 }, (err) => {
            if (err) {
                logError('MQTT][LIGHT', `Publish failed topic=${LightsControlTopic}`, err);
                return res.status(500).json({ error: 'Không thể gửi tin nhắn đến Mosquitto broker' });
            }
            log('MQTT][LIGHT', 'Published command', { topic: LightsControlTopic, name, action: actionText(type), payload: message });
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
    //console.log("BAT DEN TU DONG: ", name, timerEnabled, autoOffTime, autoOnTime);
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
        //console.log("ADD DEN: ", light);
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
    const { name, status, room, timerEnabled, autoOnTime, autoOffTime } = req.body;

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
            status: 0,
            timerEnabled: timerEnabled !== undefined ? timerEnabled : false,
            autoOnTime: autoOnTime || null,
            autoOffTime: autoOffTime || null,
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

// Lấy danh sách các đèn
app.get('/lights/', async (req, res) => {
    try {
        // Lấy tất cả đèn từ cơ sở dữ liệu
        const lights = await Light.find();

        // Kiểm tra nếu danh sách đèn trống
        if (lights.length === 0) {
            return res.status(404).json({ error: 'Không có đèn nào trong cơ sở dữ liệu' });
        }

        // Trả về danh sách đèn
        res.status(200).json({
            message: 'Danh sách đèn đã được lấy thành công',
            lights,
        });
    } catch (error) {
        logError('HTTP][LIGHT', 'Failed to fetch lights', error);
        res.status(500).json({ error: 'Lỗi khi lấy danh sách đèn' });
    }
});

// Xóa đèn theo tên
app.delete('/lights/', async (req, res) => {
    const { name } = req.body;

    if (!name) {
        return res.status(400).json({ error: 'Cần cung cấp tên đèn để xóa' });
    }

    try {
        // Tìm đèn theo tên
        const light = await Light.findOne({ name });
        if (!light) {
            return res.status(404).json({ error: 'Không tìm thấy đèn với tên này' });
        }

        // Xóa đèn
        await Light.deleteOne({ name });

        // Trả về phản hồi thành công
        res.status(200).json({
            message: 'Đèn đã được xóa thành công',
            light,
        });
    } catch (error) {
        logError('HTTP][LIGHT', 'Failed to delete light', error);
        res.status(500).json({ error: 'Lỗi khi xóa đèn' });
    }
});

////////////////////////////////////////// XU LI LIEN QUAN DEN MQ135 //////////////////////////////////////////

app.delete('/fire-alarms', async (req, res) => {
    try {
        // Xóa tất cả các tài liệu trong collection FireAlarm
        const result = await FireAlarm.deleteMany({});
        res.status(200).json({
            message: 'Tất cả thông báo báo cháy đã được xóa',
            deletedCount: result.deletedCount, // Số tài liệu đã xóa
        });
    } catch (error) {
        logError('HTTP][FIRE', 'Failed to delete fire alarms', error);
        res.status(500).json({ error: 'Lỗi khi xóa tất cả thông báo báo cháy' });
    }
});

app.get('/mq135statistics', async (req, res) => {
    try {
        // Lấy tham số n từ query, nếu không có mặc định là 10
        const NumOfRecords = parseInt(req.query.NumOfRecords) || 10;

        // Lấy n bản ghi mới nhất, sắp xếp giảm dần theo timestamp
        const records = await MQ135Statistics.find().sort({ timestamp: -1 }).limit(NumOfRecords);

        // Trả về kết quả JSON
        res.status(200).json(records);
    } catch (error) {
        // Xử lý lỗi và trả về phản hồi lỗi
        res.status(500).json({ message: 'Lỗi khi lấy dữ liệu MQ135 Statistics', error: error.message });
    }
});


////////////////////////////////////////// ------------------------ //////////////////////////////////////////
// Hàm kiểm tra và tự động bật/tắt quạt theo thời gian
const checkAutoFans = async () => {
    try {
        // Lấy tất cả quạt đang bật chế độ hẹn giờ
        const fans = await Fan.find({ timerEnabled: true });

        fans.forEach(async (fan) => {
            const currentTime = DateTime.now().setZone(timezone);
            //console.log("THOI GIAN HIEN TAI: ", currentTime);
            const currentHour = currentTime.hour;
            const currentMinute = currentTime.minute;

            const autoOnTime = new Date(fan.autoOnTime);
            const autoOffTime = new Date(fan.autoOffTime);

            //console.log("NGAY BAT DAU: ", autoOnTime);
            const autoOnHour = autoOnTime.getUTCHours();
            const autoOnMinute = autoOnTime.getUTCMinutes();

            const autoOffHour = autoOffTime.getUTCHours();
            const autoOffMinute = autoOffTime.getUTCMinutes();
            //console.log("GIO VA PHUT: ", autoOnHour, autoOnMinute, autoOffHour, autoOffMinute, currentHour, currentMinute);
            // Hàm kiểm tra giờ và phút
            const isTimeBetween = (hour, minute, startHour, startMinute, endHour, endMinute) => {
                const currentTimeInMinutes = hour * 60 + minute;
                const startTimeInMinutes = startHour * 60 + startMinute;
                const endTimeInMinutes = endHour * 60 + endMinute;
                return currentTimeInMinutes >= startTimeInMinutes && currentTimeInMinutes < endTimeInMinutes;
            };

            // Nếu hiện tại nằm trong thời gian bật quạt
            if (isTimeBetween(currentHour, currentMinute, autoOnHour, autoOnMinute, autoOffHour, autoOffMinute)) {
                // Bật quạt tự động nếu chưa được bật bởi hệ thống
                if (fan.status === 1 && !fan.isAutoControlled) {
                    fan.isAutoControlled = true;
                    await fan.save();
                }
                if (!fan.isAutoControlled && fan.status === 0) {
                    fan.status = 1;
                    fan.isAutoControlled = true; // Đánh dấu là quạt đã được bật tự động
                    await fan.save();

                    // Gửi thông điệp MQTT để bật quạt
                    const message = JSON.stringify({ type: 1 });
                    mqttClient.publish(FansControlTopic, message, { qos: 1 });
                    log('AUTO][FAN', 'Turned fan on by timer', { name: fan.name, topic: FansControlTopic, payload: message });
                }
            }
            // Nếu hiện tại không nằm trong khoảng thời gian bật
            else {
                // Tắt quạt tự động nếu chưa được tắt bởi hệ thống
                if (fan.status === 0 && fan.isAutoControlled) {
                    fan.isAutoControlled = false;
                    await fan.save();
                }
                if (fan.isAutoControlled && fan.status === 1) {
                    fan.status = 0;
                    fan.isAutoControlled = false; // Đánh dấu là quạt đã được tắt tự động
                    await fan.save();

                    // Gửi thông điệp MQTT để tắt đèn
                    const message = JSON.stringify({ type: 0 });
                    mqttClient.publish(FansControlTopic, message, { qos: 1 });
                    log('AUTO][FAN', 'Turned fan off by timer', { name: fan.name, topic: FansControlTopic, payload: message });
                }
            }
        });
    } catch (err) {
        logError('AUTO][FAN', 'Failed while checking fan timer', err);
    }
};

// Hàm kiểm tra và tự động bật/tắt đèn theo thời gian
const checkAutoLights = async () => {
    try {
        // Lấy tất cả đèn đang bật chế độ hẹn giờ
        const lights = await Light.find({ timerEnabled: true });

        lights.forEach(async (light) => {
            const currentTime = DateTime.now().setZone(timezone);
            //console.log("THOI GIAN HIEN TAI: ", currentTime);
            const currentHour = currentTime.hour;
            const currentMinute = currentTime.minute;

            const autoOnTime = new Date(light.autoOnTime);
            const autoOffTime = new Date(light.autoOffTime);

            //console.log("NGAY BAT DAU: ", autoOnTime);
            const autoOnHour = autoOnTime.getUTCHours();
            const autoOnMinute = autoOnTime.getUTCMinutes();

            const autoOffHour = autoOffTime.getUTCHours();
            const autoOffMinute = autoOffTime.getUTCMinutes();
            //console.log("GIO VA PHUT: ", autoOnHour, autoOnMinute, autoOffHour, autoOffMinute, currentHour, currentMinute);
            // Hàm kiểm tra giờ và phút
            const isTimeBetween = (hour, minute, startHour, startMinute, endHour, endMinute) => {
                const currentTimeInMinutes = hour * 60 + minute;
                const startTimeInMinutes = startHour * 60 + startMinute;
                const endTimeInMinutes = endHour * 60 + endMinute;
                return currentTimeInMinutes >= startTimeInMinutes && currentTimeInMinutes < endTimeInMinutes;
            };

            // Nếu hiện tại nằm trong thời gian bật đèn
            if (isTimeBetween(currentHour, currentMinute, autoOnHour, autoOnMinute, autoOffHour, autoOffMinute)) {
                // Bật đèn tự động nếu chưa được bật bởi hệ thống
                if (light.status === 1 && !light.isAutoControlled) {
                    light.isAutoControlled = true;
                    await light.save();
                }
                if (!light.isAutoControlled && light.status === 0) {
                    light.status = 1;
                    light.isAutoControlled = true; // Đánh dấu là đèn đã được bật tự động
                    await light.save();

                    // Gửi thông điệp MQTT để bật đèn
                    const message = JSON.stringify({ type: 1 });
                    mqttClient.publish(LightsControlTopic, message, { qos: 1 });
                    log('AUTO][LIGHT', 'Turned light on by timer', { name: light.name, topic: LightsControlTopic, payload: message });
                }
            }
            // Nếu hiện tại không nằm trong khoảng thời gian bật
            else {
                if (light.status === 0 && light.isAutoControlled) {
                    light.isAutoControlled = false;
                    await light.save();
                }
                // Tắt đèn tự động nếu chưa được tắt bởi hệ thống
                if (light.isAutoControlled && light.status === 1) {
                    light.status = 0;
                    light.isAutoControlled = false; // Đánh dấu là đèn đã được tắt tự động
                    await light.save();

                    // Gửi thông điệp MQTT để tắt đèn
                    const message = JSON.stringify({ type: 0 });
                    mqttClient.publish(LightsControlTopic, message, { qos: 1 });
                    log('AUTO][LIGHT', 'Turned light off by timer', { name: light.name, topic: LightsControlTopic, payload: message });
                }
            }
        });
    } catch (err) {
        logError('AUTO][LIGHT', 'Failed while checking light timer', err);
    }
};

const autoTurnOnFans = async (currentTemperature, airQuality, coPpm, co2Ppm) => {
    try {
        // Lấy danh sách tất cả các quạt
        const fans = await Fan.find();
        if (!fans || fans.length === 0) {
            log('AUTO][FAN', 'Skipped auto cooling because no fans exist');
            return;
        }
        const isBadAir = autoFanOnBadAir && (
            airQuality === 'BAD'
            || Number(coPpm) >= autoFanCoThreshold
            || Number(co2Ppm) >= autoFanCo2Threshold
        );

        // Duyệt qua tất cả các quạt
        for (const fan of fans) {
            const autoOnTemperature = fan.autoOnTemperature;
            const shouldTurnOnByTemperature = fan.autoOnByTemperature === true
                && Number(currentTemperature) >= Number(autoOnTemperature);
            const shouldTurnOn = shouldTurnOnByTemperature || isBadAir;
            const reason = shouldTurnOnByTemperature ? 'temperature' : (isBadAir ? 'air_quality' : 'none');

            // Chỉ bật quạt nếu nhiệt độ cao hơn ngưỡng hoặc chất lượng không khí xấu
            if (shouldTurnOn && fan.status === 0) {
                // Cập nhật trạng thái quạt
                fan.status = 1;
                fan.isAutoControlled = true;
                await fan.save();

                // Tạo thông điệp bật quạt
                const message = JSON.stringify({ type: 1 });

                // Gửi tín hiệu tới MQTT broker
                mqttClient.publish(FansControlTopic, message, { qos: 0 }, (err) => {
                    if (err) {
                        logError('MQTT][FAN', `Publish failed topic=${FansControlTopic}`, err);
                    } else {
                        log('AUTO][FAN', 'Turned fan on from sensor data', {
                            name: fan.name,
                            reason,
                            temp: currentTemperature,
                            threshold: autoOnTemperature,
                            airQuality,
                            coPpm,
                            co2Ppm,
                            topic: FansControlTopic,
                            payload: message,
                        });
                    }
                });
            }
        }
    } catch (error) {
        logError('AUTO][FAN', 'Failed while controlling fan from sensor data', error);
    }
};

// Thiết lập một chu kỳ để kiểm tra mỗi phút (60000ms)
if (process.env.NODE_ENV !== 'test') {
    setInterval(checkAutoLights, autoCheckIntervalMs);
    setInterval(checkAutoFans, autoCheckIntervalMs);
}

if (require.main === module) {
    app.listen(port, () => {
        log('SERVER', 'Started', { url: `http://${ip}:${port}` });
    });
}

module.exports = {
    app,
    autoTurnOnFans,
    checkAutoFans,
    checkAutoLights,
    evaluateAirQuality,
};
