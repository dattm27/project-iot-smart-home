// Import thư viện express
const dotenv = require('dotenv');
dotenv.config();

const express = require('express');
const connectDB = require('./database');
const { DateTime } = require('luxon');
const fs = require('fs');
const axios = require('axios');
const mqtt = require('mqtt');
const app = express();

// Khai báo các hằng
const port = 4000;
const ip = '192.168.1.4';
const brokerUrl = 'mqtts://c509d576b5cb44a0ac951816712cb591.s1.eu.hivemq.cloud'; // Static IP
const phoneIp = 'http://192.168.1.25:8080';
const caCert = fs.readFileSync('./CERT.txt');
const hiveMQusername = process.env.HIVEMQ_USERNAME;
const hiveMQpassword = process.env.HIVEMQ_PASSWORD;

console.log("TK + MK: ", hiveMQusername + " " + hiveMQpassword);

const options = {
    port: 8883,
    username: hiveMQusername,
    password: hiveMQpassword,
    clientId: 'nodes',
    clean: true,
    reconnectPeriod: 1000,
    connectTimeout: 30 * 1000,
    ca: caCert,
};

// Khai báo các topic
const fireAlarmTopic = 'MQ135/FireAlarm';
const MQ135StatisticsTopic = 'MQ135/Statistics';
const LightsControlTopic = 'lights/01/server';
const LightsResponseTopic = 'lights/01/button';
const FansControlTopic = 'fans/01/server';
const FansResponseTopic = 'fans/01/button';
const MQ135PeriodTopic = 'MQ135/Period';


// Khai báo các model
const FireAlarm = require('./models/FireAlarm');  // Import model FireAlarm từ thư mục models
const MQ135Statistics = require('./models/MQ135Statistics');
const Light = require('./models/Light');
const Fan = require('./models/Fan');

//Khai báo các biến toàn cục
let isFire = false;

// Kết nối với database
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
    mqttClient.subscribe(LightsResponseTopic, (err) => {
        if (err) {
            console.error('Không thể đăng ký topic Light button:', err);
        } else {
            console.log('Đã đăng ký thành công topic Light button');
        }
    });
    mqttClient.subscribe(FansResponseTopic, (err) => {
        if (err) {
            console.error('Không thể đăng ký topic Fan button:', err);
        } else {
            console.log('Đã đăng ký thành công topic Fan button');
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
                            console.log('Trạng thái hiện tại trùng với trạng thái gần nhất, không thực hiện thay đổi.');
                            return;
                        }
                        else {
                            console.log('Trạng thái mới khác với trạng thái hiện tại, cập nhật trạng thái và thời gian.');
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
                const { time, co2_ppm, co_ppm, temp } = JSON.parse(payload);

                // Kiểm tra nếu tham số time và status hợp lệ
                if (time && co2_ppm !== undefined && co_ppm && temp !== undefined) {
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
                    //console.log(`Thông báo MQ135Statistics đã được lưu vào MongoDB với time: ${time}` + ' với nội dung là ' + newMQ135Statistics);

                    // bat tat quat khi nhiet do qua nong
                    //console.log("BAT DAU CHUC NANG BAT QUAT THEO NHIET DO")
                    autoTurnOnFans(temp);

                } else {
                    console.error('Thông điệp không hợp lệ. Thiếu thông tin cần thiết.');
                }
            }
            else {
                console.error('Thông điệp không phải JSON hợp lệ:', payload);
            }
        } catch (err) {
            console.error('Lỗi khi xử lý thông điệp của mq135 do các trường thông tin lỗi');
        }
    }
    if (topic === FansResponseTopic) {
        // Trả về phản hồi thành công
        try {
            if (isValidJson(payload)) {
                const { type } = JSON.parse(payload);
                const name = 'QUAT_1';
                let fan = await Fan.findOne({ name });

                if (!fan) {
                    return;
                }
                // console.log("HIEU LENH TYPE: ", type);
                // Cập nhật trạng thái của đèn
                fan.status = type == 1 ? 1 : 0;
                //console.log("I FOUND THIS FAN: ", fan);
                await fan.save();
                if (type == 1)
                    console.log('Đã bật quạt thành công');
                else
                    console.log('Đã tắt quạt thành công');
            }
            else {
                console.error('Thông điệp không phải JSON hợp lệ:', payload);
            }
        }
        catch (err) {
            console.error('Lỗi khi xử lý thông điệp:', err);
        }

    }
    if (topic === LightsResponseTopic) {
        try {
            if (isValidJson(payload)) {
                const { type } = JSON.parse(payload);
                const name = 'DEN_PH';
                let light = await Fan.findOne({ name });

                if (!light) {
                    return;
                }

                // Cập nhật trạng thái của đèn
                light.status = type == 1 ? 1 : 0;
                await light.save();
                if (type == 1)
                    console.log('Đã bật đèn thành công');
                else
                    console.log('Đã tắt đèn thành công');
            }
            else {
                console.error('Thông điệp không phải JSON hợp lệ:', payload);
            }
        }
        catch (err) {
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
    console.log("co tin hieu bat/tat quat", req.body);
    try {
        // Tìm quạt theo name
        let fan = await Fan.findOne({ name });

        if (!fan) {
            return res.status(404).json({ error: 'Quạt không tồn tại' });
        }

        // Cập nhật trạng thái của đèn
        fan.status = type === 1 ? 1 : 0;
        await fan.save();

        const message = JSON.stringify({ type });

        // Gửi tin nhắn vào Mosquitto broker tại topic /lights/01
        mqttClient.publish(FansControlTopic, message, { qos: 0 }, (err) => {
            if (err) {
                console.error('Error publishing to MQTT broker:', err);
                return res.status(500).json({ error: 'Không thể gửi tin nhắn đến Mosquitto broker' });
            }
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
        console.error('Error fetching fans:', error);
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
        console.error('Error deleting fan by name:', error);
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
    console.log("co tin hieu bat/tat den", req.body);
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
        console.error('Error fetching lights:', error);
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
        console.error('Error deleting light by name:', error);
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
        console.error('Lỗi khi xóa thông báo báo cháy:', error);
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
            const currentTime = DateTime.now().setZone('Asia/Ho_Chi_Minh');
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
                    console.log(`Quạt ${fan.name} đã bật tự động.`);
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
                    console.log(`Quạt ${fan.name} đã tắt tự động.`);
                }
            }
        });
    } catch (err) {
        console.error('Lỗi khi kiểm tra và tự động bật/tắt quạt:', err);
    }
};

// Hàm kiểm tra và tự động bật/tắt đèn theo thời gian
const checkAutoLights = async () => {
    try {
        // Lấy tất cả đèn đang bật chế độ hẹn giờ
        const lights = await Light.find({ timerEnabled: true });

        lights.forEach(async (light) => {
            const currentTime = DateTime.now().setZone('Asia/Ho_Chi_Minh');
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
                    console.log(`Đèn ${light.name} đã bật tự động.`);
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
                    console.log(`Đèn ${light.name} đã tắt tự động.`);
                }
            }
        });
    } catch (err) {
        console.error('Lỗi khi kiểm tra và tự động bật/tắt đèn:', err);
    }
};

const autoTurnOnFans = async (currentTemperature) => {
    try {
        // Lấy danh sách tất cả các quạt
        const fans = await Fan.find();
        if (!fans || fans.length === 0) {
            console.log('Không có quạt nào trong danh sách.');
            return;
        }
        // Duyệt qua tất cả các quạt
        for (const fan of fans) {
            // Chỉ bật quạt nếu nhiệt độ cao hơn ngưỡng và quạt đang tắt
            var autoOnTemperature = fan.autoOnTemperature;
            if (currentTemperature >= autoOnTemperature && fan.status === 0) {
                // Cập nhật trạng thái quạt
                fan.status = 1;
                await fan.save();

                // Tạo thông điệp bật quạt
                const message = JSON.stringify({ type: 1 });

                // Gửi tín hiệu tới MQTT broker
                mqttClient.publish(FansControlTopic, message, { qos: 0 }, (err) => {
                    if (err) {
                        console.error(`Lỗi khi gửi tín hiệu tới quạt ${fan.name}:`, err);
                    } else {
                        console.log(`Đã bật quạt ${fan.name}`);
                    }
                });
            }
        }
    } catch (error) {
        console.error('Lỗi trong quá trình điều khiển quạt:', error);
    }
};

// Thiết lập một chu kỳ để kiểm tra mỗi phút (60000ms)
setInterval(checkAutoLights, 30000);
setInterval(checkAutoFans, 30000);

app.listen(port, () => {
    console.log(`Server đang chạy tại http://${ip}:${port}`);
});
