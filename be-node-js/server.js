// Import thư viện express
const dotenv = require('dotenv');
dotenv.config();

const express = require('express');
const connectDB = require('./database');
const { DateTime } = require('luxon');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const mqtt = require('mqtt');
const authenticateToken = require('./middleware/authenticateToken');
const { comparePassword, generateToken, hashPassword } = require('./auth');
const { openApiDocument, swaggerHtml } = require('./openapi');
const app = express();
const requiredEnv = (name) => {
    if (!process.env[name]) {
        throw new Error(`${name} is required`);
    }
    return process.env[name];
};
const requiredEnvAny = (...names) => {
    const foundName = names.find((name) => process.env[name]);
    if (!foundName) {
        throw new Error(`${names.join(' or ')} is required`);
    }
    return process.env[foundName];
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
const caCertPath = process.env.MQTT_CA_CERT_PATH;
const caCert = process.env.NODE_ENV === 'test' || !caCertPath
    ? undefined
    : fs.readFileSync(path.resolve(__dirname, caCertPath));
const mqttUsername = requiredEnvAny('MQTT_USERNAME', 'HIVEMQ_USERNAME');
const mqttPassword = requiredEnvAny('MQTT_PASSWORD', 'HIVEMQ_PASSWORD');
log('CONFIG', 'Loaded MQTT config', { brokerUrl, port: process.env.MQTT_PORT, clientId: process.env.MQTT_CLIENT_ID });

const options = {
    port: Number(requiredEnv('MQTT_PORT')),
    username: mqttUsername,
    password: mqttPassword,
    clientId: requiredEnv('MQTT_CLIENT_ID'),
    clean: requiredEnv('MQTT_CLEAN') === 'true',
    reconnectPeriod: Number(requiredEnv('MQTT_RECONNECT_PERIOD_MS')),
    connectTimeout: Number(requiredEnv('MQTT_CONNECT_TIMEOUT_MS')),
    ...(caCert ? { ca: caCert } : {}),
};

// Khai báo các topic
const fireAlarmTopic = requiredEnv('MQTT_FIRE_ALARM_TOPIC');
const MQ135StatisticsTopic = requiredEnv('MQTT_MQ135_STATISTICS_TOPIC');
const DHT22StatisticsTopic = requiredEnv('MQTT_DHT22_STATISTICS_TOPIC');
const LightsControlTopic = requiredEnv('MQTT_LIGHTS_CONTROL_TOPIC');
const LightsSensorTopic = requiredEnv('MQTT_LIGHT_SENSOR_TOPIC');
const LightsSensorControlTopic = requiredEnv('MQTT_LIGHT_SENSOR_CONTROL_TOPIC');
const LightsResponseTopic = requiredEnv('MQTT_LIGHTS_RESPONSE_TOPIC');
const FansControlTopic = requiredEnv('MQTT_FANS_CONTROL_TOPIC');
const FansResponseTopic = requiredEnv('MQTT_FANS_RESPONSE_TOPIC');
const MQ135PeriodTopic = requiredEnv('MQTT_MQ135_PERIOD_TOPIC');
const defaultFanName = requiredEnv('DEFAULT_FAN_NAME');
const defaultLightName = requiredEnv('DEFAULT_LIGHT_NAME');
const timezone = requiredEnv('TIMEZONE');
const autoCheckIntervalMs = Number(requiredEnv('AUTO_CHECK_INTERVAL_MS'));
const keepAliveUrl = process.env.KEEP_ALIVE_URL;
const keepAliveIntervalMs = Number(process.env.KEEP_ALIVE_INTERVAL_MS || 5000);
const warningPpmThreshold = 900;
const fireWarningPpmThreshold = 1100;

const getTimePartsInZone = (dateValue) => {
    const dateTime = DateTime.fromJSDate(new Date(dateValue)).setZone(timezone);
    return {
        hour: dateTime.hour,
        minute: dateTime.minute,
    };
};

const isTimeBetween = (hour, minute, startHour, startMinute, endHour, endMinute) => {
    const currentTimeInMinutes = hour * 60 + minute;
    const startTimeInMinutes = startHour * 60 + startMinute;
    const endExclusiveTimeInMinutes = ((endHour * 60 + endMinute) + 1) % (24 * 60);

    if (startTimeInMinutes < endExclusiveTimeInMinutes) {
        return currentTimeInMinutes >= startTimeInMinutes && currentTimeInMinutes < endExclusiveTimeInMinutes;
    }

    return currentTimeInMinutes >= startTimeInMinutes || currentTimeInMinutes < endExclusiveTimeInMinutes;
};


// Khai báo các model
const FireAlarm = require('./models/FireAlarm');  // Import model FireAlarm từ thư mục models
const MQ135Statistics = require('./models/MQ135Statistics');
const DHT22Statistics = require('./models/DHT22Statistics');
const Light = require('./models/Light');
const Fan = require('./models/Fan');
const User = require('./models/User');
const RefreshToken = require('./models/RefreshToken');

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
const toFiniteNumber = (value) => {
    const numberValue = Number(value);
    return Number.isFinite(numberValue) ? numberValue : undefined;
};

const getDeviceStatusFromPayload = (payload) => {
    const statusValue = toFiniteNumber(payload.type ?? payload.status);
    return statusValue === 0 || statusValue === 1 ? statusValue : undefined;
};

const getLightManualOverride = (light) => Boolean(light.manualOverride ?? (light.status === 0 && light.autoControlLocked));
const setLightManualState = (light, status) => {
    light.status = status;
    light.manualOverride = status === 0;
    light.lastAutoReason = null;
    light.autoControlLocked = undefined;
};
const setLightAutoState = (light, status, reason) => {
    light.status = status;
    light.manualOverride = false;
    light.lastAutoReason = reason;
    light.autoControlLocked = undefined;
};
const setFanManualState = (fan, status) => {
    fan.status = status;
    fan.manualOverride = status === 0;
    fan.lastAutoReason = null;
};

const isFanTimerActive = (fan, currentTime = DateTime.now().setZone(timezone)) => {
    if (!fan.timerEnabled || !fan.autoOnTime || !fan.autoOffTime) {
        return false;
    }

    const autoOnTime = getTimePartsInZone(fan.autoOnTime);
    const autoOffTime = getTimePartsInZone(fan.autoOffTime);
    return isTimeBetween(
        currentTime.hour,
        currentTime.minute,
        autoOnTime.hour,
        autoOnTime.minute,
        autoOffTime.hour,
        autoOffTime.minute
    );
};

const turnFanOffForGasDanger = async (fan, ppmValue, currentTemperature, airQuality) => {
    if (fan.status !== 1) {
        return false;
    }

    fan.status = 0;
    fan.manualOverride = false;
    fan.lastAutoReason = null;
    await fan.save();

    const message = JSON.stringify({ type: 0 });
    mqttClient.publish(FansControlTopic, message, { qos: 0 }, (err) => {
        if (err) {
            logError('MQTT][FAN', `Publish failed topic=${FansControlTopic}`, err);
        } else {
            log('AUTO][FAN', 'Forced fan off because gas level is dangerous', {
                name: fan.name,
                temp: currentTemperature,
                airQuality,
                ppm: ppmValue,
                topic: FansControlTopic,
                payload: message,
            });
        }
    });

    return true;
};

const isFireAlarmActiveStatus = (status) => status !== 'inactive';

const turnFanOffForFireAlarm = async (fan, status, time) => {
    if (fan.status !== 1) {
        return false;
    }

    fan.status = 0;
    fan.manualOverride = false;
    fan.lastAutoReason = null;
    await fan.save();

    const message = JSON.stringify({ type: 0 });
    mqttClient.publish(FansControlTopic, message, { qos: 0 }, (err) => {
        if (err) {
            logError('MQTT][FAN', `Publish failed topic=${FansControlTopic}`, err);
        } else {
            log('AUTO][FAN', 'Forced fan off because fire alarm is active', {
                name: fan.name,
                status,
                time,
                topic: FansControlTopic,
                payload: message,
            });
        }
    });

    return true;
};

const turnFansOffForFireAlarm = async (status, time) => {
    if (!isFireAlarmActiveStatus(status)) {
        return 0;
    }

    const fans = await Fan.find();
    let turnedOffCount = 0;

    for (const fan of fans) {
        const didTurnOff = await turnFanOffForFireAlarm(fan, status, time);
        if (didTurnOff) {
            turnedOffCount += 1;
        }
    }

    log('AUTO][FAN', 'Processed fan safety for fire alarm', {
        status,
        time,
        turnedOffCount,
    });

    return turnedOffCount;
};

const getLatestFireAlarmState = async () => {
    const latestFireAlarm = await FireAlarm.findOne().sort({ timestamp: -1 });
    const status = latestFireAlarm?.status;

    return {
        isActive: status !== undefined && isFireAlarmActiveStatus(status),
        status,
        time: latestFireAlarm?.time,
    };
};

const getLatestGasState = async () => {
    const latestMQ135 = await MQ135Statistics.findOne().sort({ timestamp: -1 });
    const latestFireAlarm = await getLatestFireAlarmState();
    const ppmValue = latestMQ135 ? toFiniteNumber(latestMQ135.ppm) : undefined;
    const isPpmDanger = ppmValue !== undefined && ppmValue > fireWarningPpmThreshold;

    return {
        airQuality: latestMQ135?.airQuality ?? evaluateAirQuality(ppmValue),
        isDanger: isPpmDanger || latestFireAlarm.isActive,
        isFireAlarmActive: latestFireAlarm.isActive,
        fireAlarmStatus: latestFireAlarm.status,
        fireAlarmTime: latestFireAlarm.time,
        ppm: ppmValue,
    };
};

const handleLightSensorStatusPayload = async (payload, topic = LightsSensorTopic) => {
    if (!isValidJson(payload)) {
        logError('MQTT][LIGHT_SENSOR', 'Payload is not valid JSON', payload);
        return { updated: false, reason: 'invalid_json' };
    }

    const { status, name: payloadName } = JSON.parse(payload);
    const statusValue = toFiniteNumber(status);
    const name = payloadName || defaultLightName;
    log('MQTT][LIGHT_SENSOR', 'Received light status from sensor', { name, status: statusValue, topic });

    if (statusValue !== 0 && statusValue !== 1) {
        logError('MQTT][LIGHT_SENSOR', 'Invalid payload, missing valid status', payload);
        return { updated: false, reason: 'invalid_status' };
    }

    const light = await Light.findOne({ name });

    if (!light) {
        log('MQTT][LIGHT_SENSOR', 'Ignored status because light was not found', { name });
        return { updated: false, reason: 'not_found' };
    }

    if (light.lightSensorEnabled !== true) {
        log('MQTT][LIGHT_SENSOR', 'Ignored status because light sensor mode is disabled', { name, status: statusValue });
        return { updated: false, reason: 'disabled', light };
    }

    setLightAutoState(light, statusValue, 'light_sensor');
    await light.save();
    log('DB][LIGHT_SENSOR', 'Synced light status from light sensor', { name, status: light.status, source: topic });
    return { updated: true, reason: 'updated', light };
};

const authRateLimitStore = new Map();
const authRateLimitWindowMs = Number(process.env.AUTH_RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000);
const authRateLimitMax = Number(process.env.AUTH_RATE_LIMIT_MAX || 8);
const refreshTokenTtlMs = Number(process.env.REFRESH_TOKEN_TTL_MS || 30 * 24 * 60 * 60 * 1000);

const isPlainObject = (value) => Object.prototype.toString.call(value) === '[object Object]';
const isNonEmptyString = (value, maxLength = 100) =>
    typeof value === 'string' && value.trim().length > 0 && value.trim().length <= maxLength;
const normalizeString = (value) => (typeof value === 'string' ? value.trim() : value);
const isValidDeviceName = (value) => isNonEmptyString(value, 50) && /^[A-Za-z0-9_.-]+$/.test(value.trim());
const isValidRoomName = (value) => isNonEmptyString(value, 80) && /^[\p{L}0-9 ._-]+$/u.test(value.trim());
const isValidBoolean = (value) => typeof value === 'boolean';
const isValidOnOffType = (value) => value === 0 || value === 1;
const isValidFiniteNumber = (value, min, max) => {
    const numberValue = Number(value);
    return Number.isFinite(numberValue) && numberValue >= min && numberValue <= max;
};
const isValidDateValue = (value) => {
    if (!isNonEmptyString(value, 80)) return false;
    const timestamp = Date.parse(value);
    return Number.isFinite(timestamp);
};

const getClientKey = (req, username = '') => {
    const forwardedFor = req.headers['x-forwarded-for'];
    const ip = Array.isArray(forwardedFor) ? forwardedFor[0] : (forwardedFor || req.ip || req.socket.remoteAddress || '');
    return `${ip.split(',')[0].trim()}|${String(username).toLowerCase()}`;
};

const authRateLimiter = (req, res, next) => {
    const username = isPlainObject(req.body) && typeof req.body.username === 'string' ? req.body.username : '';
    const key = getClientKey(req, username);
    const now = Date.now();
    const current = authRateLimitStore.get(key);

    if (!current || current.resetAt <= now) {
        authRateLimitStore.set(key, { count: 1, resetAt: now + authRateLimitWindowMs });
        return next();
    }

    if (current.count >= authRateLimitMax) {
        res.set('Retry-After', String(Math.ceil((current.resetAt - now) / 1000)));
        return res.status(429).json({ error: 'Bạn thử quá nhiều lần, vui lòng chờ một lúc rồi thử lại' });
    }

    current.count += 1;
    authRateLimitStore.set(key, current);
    return next();
};

const validateAuthPayload = (body, { requireEmail = false } = {}) => {
    if (!isPlainObject(body)) {
        return { error: 'Body phải là JSON object hợp lệ' };
    }

    const username = normalizeString(body.username);
    const email = normalizeString(body.email);
    const password = body.password;

    if (!isNonEmptyString(username, 30) || !/^[A-Za-z0-9_.-]{3,30}$/.test(username)) {
        return { error: 'Username phải là chuỗi 3-30 ký tự, chỉ gồm chữ, số, dấu ., _ hoặc -' };
    }

    if (typeof password !== 'string' || password.length < 6 || password.length > 72) {
        return { error: 'Password phải là chuỗi từ 6 đến 72 ký tự' };
    }

    if ((requireEmail || email) && (!isNonEmptyString(email, 120) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) {
        return { error: 'Email không hợp lệ' };
    }

    return { value: { username, email: email || undefined, password } };
};

const validateRefreshPayload = (body) => {
    if (!isPlainObject(body) || !isNonEmptyString(body.refreshToken, 300)) {
        return { error: 'Refresh token không hợp lệ' };
    }

    return { value: { refreshToken: body.refreshToken.trim() } };
};

const validateNamePayload = (body, label) => {
    if (!isPlainObject(body) || !isValidDeviceName(body.name)) {
        return { error: `Tên ${label} phải là chuỗi hợp lệ, chỉ gồm chữ, số, dấu ., _ hoặc -` };
    }

    return { value: { name: body.name.trim() } };
};

const validateOnOffPayload = (body, label) => {
    const nameValidation = validateNamePayload(body, label);
    if (nameValidation.error) return nameValidation;

    if (!isValidOnOffType(body.type)) {
        return { error: 'Tham số "type" phải là số 1 (bật) hoặc 0 (tắt)' };
    }

    return { value: { ...nameValidation.value, type: body.type } };
};

const validateEnabledPayload = (body, label) => {
    const nameValidation = validateNamePayload(body, label);
    if (nameValidation.error) return nameValidation;

    if (!isValidBoolean(body.enabled)) {
        return { error: 'Tham số "enabled" phải là boolean' };
    }

    return { value: { ...nameValidation.value, enabled: body.enabled } };
};

const validateCreateDevicePayload = (body, label) => {
    const nameValidation = validateNamePayload(body, label);
    if (nameValidation.error) return nameValidation;

    if (!isValidRoomName(body.room)) {
        return { error: 'Tên phòng phải là chuỗi hợp lệ' };
    }

    if (body.timerEnabled !== undefined && !isValidBoolean(body.timerEnabled)) {
        return { error: 'timerEnabled phải là boolean' };
    }

    if (body.autoOnTime !== undefined && body.autoOnTime !== null && !isValidDateValue(body.autoOnTime)) {
        return { error: 'autoOnTime phải là thời gian ISO hợp lệ' };
    }

    if (body.autoOffTime !== undefined && body.autoOffTime !== null && !isValidDateValue(body.autoOffTime)) {
        return { error: 'autoOffTime phải là thời gian ISO hợp lệ' };
    }

    return {
        value: {
            name: nameValidation.value.name,
            room: body.room.trim(),
            timerEnabled: body.timerEnabled,
            autoOnTime: body.autoOnTime,
            autoOffTime: body.autoOffTime,
        },
    };
};

const validateTimerPayload = (body, label) => {
    const nameValidation = validateNamePayload(body, label);
    if (nameValidation.error) return nameValidation;

    if (!isValidBoolean(body.timerEnabled)) {
        return { error: 'timerEnabled phải là boolean' };
    }

    if (body.timerEnabled) {
        if (!isValidDateValue(body.autoOnTime) || !isValidDateValue(body.autoOffTime)) {
            return { error: 'autoOnTime và autoOffTime phải là thời gian ISO hợp lệ khi bật hẹn giờ' };
        }
    }

    return {
        value: {
            name: nameValidation.value.name,
            timerEnabled: body.timerEnabled,
            autoOnTime: body.autoOnTime,
            autoOffTime: body.autoOffTime,
        },
    };
};

const createRefreshTokenValue = () => crypto.randomBytes(48).toString('base64url');
const hashRefreshToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

const createRefreshToken = async (user) => {
    const refreshToken = createRefreshTokenValue();
    await new RefreshToken({
        userId: user._id,
        tokenHash: hashRefreshToken(refreshToken),
        expiresAt: new Date(Date.now() + refreshTokenTtlMs),
    }).save();

    return refreshToken;
};

const buildAuthResponse = async (user, message, statusCode, res) => {
    const token = generateToken(user);
    const refreshToken = await createRefreshToken(user);

    return res.status(statusCode).json({
        message,
        token,
        refreshToken,
        user: {
            id: user._id,
            username: user.username,
            email: user.email,
        },
    });
};

const saveFireAlarmStatus = async (time, status) => {
    isFire = status !== 'inactive';
    const latestFireAlarm = await FireAlarm.findOne().sort({ timestamp: -1 });

    if (latestFireAlarm) {
        if (latestFireAlarm.status === status) {
            log('DB][FIRE', 'Skipped duplicate fire alarm status', { status });
            return;
        }

        log('DB][FIRE', 'Updated latest fire alarm status', { from: latestFireAlarm.status, to: status, time });
        latestFireAlarm.status = status;
        latestFireAlarm.time = time;
        latestFireAlarm.timestamp = Date.now();
        await latestFireAlarm.save();
    } else {
        const newFireAlarm = new FireAlarm({
            time,
            status
        });
        await newFireAlarm.save();
    }

    log('DB][FIRE', 'Saved fire alarm event', { status, time, isFire });
};

const handleFireAlarmStatusPayload = async (payload, topic = fireAlarmTopic) => {
    if (!isValidJson(payload)) {
        logError('MQTT][FIRE', 'Payload is not valid JSON', payload);
        return { updated: false, reason: 'invalid_json' };
    }

    const { time, status } = JSON.parse(payload);
    log('MQTT][FIRE', 'Received fire alarm event', { status, time, topic });

    if (!time || !status) {
        logError('MQTT][FIRE', 'Invalid payload, missing time or status', payload);
        return { updated: false, reason: 'invalid_payload' };
    }

    await saveFireAlarmStatus(time, status);
    const turnedOffFans = await turnFansOffForFireAlarm(status, time);

    return {
        updated: true,
        reason: 'updated',
        status,
        turnedOffFans,
    };
};

function evaluateAirQuality(ppm) {
    const ppmValue = toFiniteNumber(ppm);
    if (ppmValue === undefined) return "UNKNOWN";

    if (ppmValue > fireWarningPpmThreshold) return "DANGER";
    if (ppmValue >= warningPpmThreshold) return "WARNING";
    return "GOOD";
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
    // Lắng nghe dữ liệu MQ135 để lưu thống kê khí và xử lý logic quạt.
    // Trạng thái báo cháy chỉ được nhận từ topic MQ135/FireAlarm.
    mqttClient.subscribe(MQ135StatisticsTopic, (err) => {
        if (err) {
            logError('MQTT', `Subscribe failed topic=${MQ135StatisticsTopic}`, err);
        } else {
            log('MQTT', 'Subscribed', { topic: MQ135StatisticsTopic });
        }
    });
    mqttClient.subscribe(DHT22StatisticsTopic, (err) => {
        if (err) {
            logError('MQTT', `Subscribe failed topic=${DHT22StatisticsTopic}`, err);
        } else {
            log('MQTT', 'Subscribed', { topic: DHT22StatisticsTopic });
        }
    });
    mqttClient.subscribe(LightsResponseTopic, (err) => {
        if (err) {
            logError('MQTT', `Subscribe failed topic=${LightsResponseTopic}`, err);
        } else {
            log('MQTT', 'Subscribed', { topic: LightsResponseTopic });
        }
    });
    mqttClient.subscribe(LightsSensorTopic, (err) => {
        if (err) {
            logError('MQTT', `Subscribe failed topic=${LightsSensorTopic}`, err);
        } else {
            log('MQTT', 'Subscribed', { topic: LightsSensorTopic });
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
                    await saveFireAlarmStatus(time, status);
                    await turnFansOffForFireAlarm(status, time);
                    return;
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
                const { time, ppm, co2_ppm, co_ppm } = JSON.parse(payload);
                const legacyPpmValues = [toFiniteNumber(co2_ppm), toFiniteNumber(co_ppm)]
                    .filter((value) => value !== undefined);
                const ppmValue = toFiniteNumber(ppm) ?? (legacyPpmValues.length > 0 ? Math.max(...legacyPpmValues) : undefined);
                log('MQTT][SENSOR', 'Received MQ135 statistics', { ppm: ppmValue, topic });

                // Kiểm tra nếu tham số time và status hợp lệ
                if (time && ppmValue !== undefined) {
                    // Tạo mới một MQ135Statistics từ các tham số nhận được
                    const AirQuality = evaluateAirQuality(ppmValue);
                    const newMQ135Statistics = new MQ135Statistics({
                        time: time,
                        airQuality: AirQuality,
                        ppm: ppmValue,
                        co2_ppm: co2_ppm,
                        co_ppm: co_ppm,
                    });
                    // Lưu thông tin MQ135Statistics vào MongoDB
                    await newMQ135Statistics.save();
                    log('DB][SENSOR', 'Saved MQ135 statistics', { ppm: ppmValue, airQuality: AirQuality });
                    //console.log(`Thông báo MQ135Statistics đã được lưu vào MongoDB với time: ${time}` + ' với nội dung là ' + newMQ135Statistics);

                    // bat tat quat khi nhiet do qua nong
                    //console.log("BAT DAU CHUC NANG BAT QUAT THEO NHIET DO")
                    const latestDHT22 = await DHT22Statistics.findOne().sort({ timestamp: -1 });
                    if (latestDHT22) {
                        await autoTurnOnFans(latestDHT22.temp, AirQuality, ppmValue);
                    }

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
    if (topic === DHT22StatisticsTopic) {
        try {
            if (isValidJson(payload)) {
                const { time, temp, humidity } = JSON.parse(payload);
                const tempValue = toFiniteNumber(temp);
                const humidityValue = toFiniteNumber(humidity);
                log('MQTT][DHT22', 'Received DHT22 statistics', { time, temp: tempValue, humidity: humidityValue, topic });

                if (time && tempValue !== undefined && humidityValue !== undefined) {
                    const newDHT22Statistics = new DHT22Statistics({
                        time,
                        temp: tempValue,
                        humidity: humidityValue,
                    });

                    await newDHT22Statistics.save();
                    log('DB][DHT22', 'Saved DHT22 statistics', { time, temp: tempValue, humidity: humidityValue });

                    const latestMQ135 = await MQ135Statistics.findOne().sort({ timestamp: -1 });
                    if (latestMQ135) {
                        await autoTurnOnFans(tempValue, latestMQ135.airQuality, latestMQ135.ppm);
                    }
                } else {
                    logError('MQTT][DHT22', 'Invalid payload, missing required fields', payload);
                }
            }
            else {
                logError('MQTT][DHT22', 'Payload is not valid JSON', payload);
            }
        } catch (err) {
            logError('MQTT][DHT22', 'Failed to handle DHT22 message', err);
        }
    }
    if (topic === FansResponseTopic) {
        // Trả về phản hồi thành công
        try {
            if (isValidJson(payload)) {
                const parsedPayload = JSON.parse(payload);
                const { name: payloadName } = parsedPayload;
                const statusValue = getDeviceStatusFromPayload(parsedPayload);
                const name = payloadName || defaultFanName;
                log('MQTT][FAN', 'Received device response', { name, action: actionText(statusValue), status: statusValue, topic });

                if (statusValue === undefined) {
                    logError('MQTT][FAN', 'Invalid payload, missing valid type/status', payload);
                    return;
                }

                let fan = await Fan.findOne({ name });

                if (!fan) {
                    log('MQTT][FAN', 'Ignored response because fan was not found', { name });
                    return;
                }
                // console.log("HIEU LENH TYPE: ", type);
                // Chỉ sync trạng thái thực tế từ ESP32, không ghi đè metadata auto/manual của backend.
                fan.status = statusValue;
                //console.log("I FOUND THIS FAN: ", fan);
                await fan.save();
                log('DB][FAN', 'Synced fan status from device response', {
                    name,
                    status: fan.status,
                    manualOverride: fan.manualOverride,
                    source: topic,
                });
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
                const parsedPayload = JSON.parse(payload);
                const { name: payloadName } = parsedPayload;
                const statusValue = getDeviceStatusFromPayload(parsedPayload);
                const name = payloadName || defaultLightName;
                log('MQTT][LIGHT', 'Received device response', { name, action: actionText(statusValue), status: statusValue, topic });

                if (statusValue === undefined) {
                    logError('MQTT][LIGHT', 'Invalid payload, missing valid type/status', payload);
                    return;
                }

                let light = await Light.findOne({ name });

                if (!light) {
                    log('MQTT][LIGHT', 'Ignored response because light was not found', { name });
                    return;
                }

                // Chỉ sync trạng thái thực tế từ ESP32, không ghi đè metadata auto/manual của backend.
                light.status = statusValue;
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
    if (topic === LightsSensorTopic) {
        try {
            await handleLightSensorStatusPayload(payload, topic);
        } catch (err) {
            logError('MQTT][LIGHT_SENSOR', 'Failed to handle light sensor status', err);
        }
    }
});

// Khi xảy ra lỗi với MQTT
mqttClient.on('error', (err) => {
    logError('MQTT', 'Connection error', err);
});

app.use(express.json());

app.get('/openapi.json', (req, res) => {
    res.status(200).json(openApiDocument);
});

app.get('/api-docs', (req, res) => {
    res.status(200).type('html').send(swaggerHtml);
});

app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'ok',
        service: 'iot-smart-home-backend',
        timestamp: new Date().toISOString(),
    });
});

app.post('/auth/register', authRateLimiter, async (req, res) => {
    const validation = validateAuthPayload(req.body, { requireEmail: false });
    if (validation.error) {
        return res.status(400).json({ error: validation.error });
    }
    const { username, email, password } = validation.value;

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

        return buildAuthResponse(user, 'Đăng ký thành công', 201, res);
    } catch (error) {
        logError('AUTH', 'Register failed', error);
        return res.status(500).json({ error: 'Lỗi khi đăng ký tài khoản' });
    }
});

app.post('/auth/login', authRateLimiter, async (req, res) => {
    const validation = validateAuthPayload(req.body);
    if (validation.error) {
        return res.status(400).json({ error: validation.error });
    }
    const { username, password } = validation.value;

    try {
        const user = await User.findOne({ username });
        if (!user || !comparePassword(password, user.passwordHash)) {
            return res.status(401).json({ error: 'Username hoặc password không đúng' });
        }

        return buildAuthResponse(user, 'Đăng nhập thành công', 200, res);
    } catch (error) {
        logError('AUTH', 'Login failed', error);
        return res.status(500).json({ error: 'Lỗi khi đăng nhập' });
    }
});

app.post('/auth/refresh', async (req, res) => {
    const validation = validateRefreshPayload(req.body);
    if (validation.error) {
        return res.status(400).json({ error: validation.error });
    }

    try {
        const { refreshToken } = validation.value;
        const tokenHash = hashRefreshToken(refreshToken);
        const storedToken = await RefreshToken.findOne({ tokenHash });

        if (!storedToken || storedToken.revokedAt || storedToken.expiresAt <= new Date()) {
            return res.status(401).json({ error: 'Refresh token không hợp lệ hoặc đã hết hạn' });
        }

        const user = await User.findById(storedToken.userId);
        if (!user) {
            storedToken.revokedAt = new Date();
            await storedToken.save();
            return res.status(401).json({ error: 'Refresh token không hợp lệ' });
        }

        storedToken.revokedAt = new Date();
        await storedToken.save();

        return buildAuthResponse(user, 'Làm mới token thành công', 200, res);
    } catch (error) {
        logError('AUTH', 'Refresh token failed', error);
        return res.status(500).json({ error: 'Lỗi khi làm mới token' });
    }
});

app.post('/auth/logout', async (req, res) => {
    const validation = validateRefreshPayload(req.body);
    if (validation.error) {
        return res.status(400).json({ error: validation.error });
    }

    try {
        const tokenHash = hashRefreshToken(validation.value.refreshToken);
        await RefreshToken.updateOne(
            { tokenHash, revokedAt: null },
            { $set: { revokedAt: new Date() } },
        );

        return res.status(200).json({ message: 'Đăng xuất thành công' });
    } catch (error) {
        logError('AUTH', 'Logout failed', error);
        return res.status(500).json({ error: 'Lỗi khi đăng xuất' });
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
    const validation = validateOnOffPayload(req.body, 'quạt');
    if (validation.error) {
        return res.status(400).json({ error: validation.error });
    }
    const { type, name } = validation.value;
    log('HTTP][FAN', 'Received manual command', { name, action: actionText(type) });
    try {
        // Tìm quạt theo name
        let fan = await Fan.findOne({ name });

        if (!fan) {
            return res.status(404).json({ error: 'Quạt không tồn tại' });
        }

        // Cập nhật trạng thái của quạt theo thao tác thủ công.
        setFanManualState(fan, type === 1 ? 1 : 0);
        await fan.save();
        log('DB][FAN', 'Updated fan status from HTTP command', {
            name,
            status: fan.status,
            manualOverride: fan.manualOverride,
        });

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
    const nameValidation = validateNamePayload(req.body, 'quạt');
    if (nameValidation.error) {
        return res.status(400).json({ error: nameValidation.error });
    }
    if (!isValidBoolean(req.body.autoOnByTemperature)) {
        return res.status(400).json({ error: 'autoOnByTemperature phải là boolean' });
    }
    if (!isValidFiniteNumber(req.body.autoOnTemperature, 0, 100)) {
        return res.status(400).json({ error: 'autoOnTemperature phải là số từ 0 đến 100' });
    }
    const { name } = nameValidation.value;
    const { autoOnByTemperature, autoOnTemperature } = req.body;
    try {
        // Tìm quạt theo name
        let fan = await Fan.findOne({ name });

        if (!fan) {
            return res.status(404).json({ error: 'Quạt không tồn tại' });
        }

        // Cập nhật trạng thái của đèn
        fan.autoOnByTemperature = autoOnByTemperature == true ? true : false;
        fan.autoOnTemperature = autoOnTemperature;
        if (fan.autoOnByTemperature) {
            fan.manualOverride = false;
        }
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
    const validation = validateCreateDevicePayload(req.body, 'quạt');
    if (validation.error) {
        return res.status(400).json({ error: validation.error });
    }
    const { name, room, timerEnabled, autoOnTime, autoOffTime } = validation.value;

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
    const validation = validateTimerPayload(req.body, 'quạt');
    if (validation.error) {
        return res.status(400).json({ error: validation.error });
    }
    const { name, timerEnabled, autoOnTime, autoOffTime } = validation.value;

    try {
        // Tìm quạt theo name
        let fan = await Fan.findOne({ name });

        if (!fan) {
            return res.status(404).json({ error: 'Quạt không tồn tại' });
        }
        // Cập nhật chế độ hẹn giờ
        fan.timerEnabled = timerEnabled || false;
        if (timerEnabled) {
            fan.manualOverride = false;
            fan.lastAutoReason = null;
        }

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
        if (timerEnabled) {
            try {
                await checkAutoFans();
            } catch (timerError) {
                logError('AUTO][FAN', 'Failed immediate timer check after timer update', timerError);
            }
        }

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
    const validation = validateNamePayload(req.body, 'quạt');
    if (validation.error) {
        return res.status(400).json({ error: validation.error });
    }
    const { name } = validation.value;

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
    const validation = validateOnOffPayload(req.body, 'đèn');
    if (validation.error) {
        return res.status(400).json({ error: validation.error });
    }
    const { type, name } = validation.value;
    log('HTTP][LIGHT', 'Received manual command', { name, action: actionText(type) });
    try {
        // Tìm đèn theo name
        let light = await Light.findOne({ name });

        if (!light) {
            return res.status(404).json({ error: 'Đèn không tồn tại' });
        }

        // Cập nhật trạng thái của đèn
        setLightManualState(light, type === 1 ? 1 : 0);
        await light.save();
        log('DB][LIGHT', 'Updated light status from HTTP command', {
            name,
            status: light.status,
            manualOverride: light.manualOverride,
        });

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
                lightStatus: light.status,
                light,
            });
        });

    } catch (error) {
        res.status(500).json({ error: 'Lỗi khi cập nhật trạng thái đèn' });
    }
});

// Xử lí bật/tắt chế độ đèn tự động theo cảm biến ánh sáng
app.put('/lights/SensorMode', async (req, res) => {
    const validation = validateEnabledPayload(req.body, 'đèn');
    if (validation.error) {
        return res.status(400).json({ error: validation.error });
    }

    const { enabled, name } = validation.value;
    log('HTTP][LIGHT', 'Received light sensor mode command', { name, enabled });

    try {
        const light = await Light.findOne({ name });

        if (!light) {
            return res.status(404).json({ error: 'Đèn không tồn tại' });
        }

        light.lightSensorEnabled = enabled;
        await light.save();

        const message = JSON.stringify({ enabled: enabled ? 1 : 0 });
        mqttClient.publish(LightsSensorControlTopic, message, { qos: 0 }, (err) => {
            if (err) {
                logError('MQTT][LIGHT', `Publish failed topic=${LightsSensorControlTopic}`, err);
                return res.status(500).json({ error: 'Không thể gửi cấu hình cảm biến ánh sáng đến MQTT broker' });
            }

            log('MQTT][LIGHT', 'Published light sensor mode', { topic: LightsSensorControlTopic, name, enabled: enabled ? 1 : 0, payload: message });
            res.status(200).json({
                message: enabled ? 'Đã bật chế độ cảm biến ánh sáng' : 'Đã tắt chế độ cảm biến ánh sáng',
                lightSensorEnabled: light.lightSensorEnabled,
            });
        });
    } catch (error) {
        logError('HTTP][LIGHT', 'Failed to update light sensor mode', error);
        res.status(500).json({ error: 'Lỗi khi cập nhật chế độ cảm biến ánh sáng' });
    }
});

// Xử lí thay đổi chức năng hẹn giờ cho đèn
app.put('/lights/Timer/', async (req, res) => {
    const validation = validateTimerPayload(req.body, 'đèn');
    if (validation.error) {
        return res.status(400).json({ error: validation.error });
    }
    const { name, timerEnabled, autoOnTime, autoOffTime } = validation.value;
    //console.log("BAT DEN TU DONG: ", name, timerEnabled, autoOffTime, autoOnTime);
    try {
        // Tìm đèn theo name
        let light = await Light.findOne({ name });

        if (!light) {
            return res.status(404).json({ error: 'Đèn không tồn tại' });
        }

        // Cập nhật chế độ hẹn giờ
        light.timerEnabled = timerEnabled || false;
        if (timerEnabled) {
            light.manualOverride = false;
            light.lastAutoReason = null;
            light.autoControlLocked = undefined;
        }

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
        if (timerEnabled) {
            try {
                await checkAutoLights();
            } catch (timerError) {
                logError('AUTO][LIGHT', 'Failed immediate timer check after timer update', timerError);
            }
        }

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
    const validation = validateCreateDevicePayload(req.body, 'đèn');
    if (validation.error) {
        return res.status(400).json({ error: validation.error });
    }
    const { name, room, timerEnabled, autoOnTime, autoOffTime } = validation.value;

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
            lightSensorEnabled: false,
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
    const validation = validateNamePayload(req.body, 'đèn');
    if (validation.error) {
        return res.status(400).json({ error: validation.error });
    }
    const { name } = validation.value;

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
        const NumOfRecords = req.query.NumOfRecords === undefined ? 10 : Number(req.query.NumOfRecords);
        if (!Number.isInteger(NumOfRecords) || NumOfRecords < 1 || NumOfRecords > 100) {
            return res.status(400).json({ error: 'NumOfRecords phải là số nguyên từ 1 đến 100' });
        }

        // Lấy n bản ghi mới nhất, sắp xếp giảm dần theo timestamp
        const records = await MQ135Statistics.find().sort({ timestamp: -1 }).limit(NumOfRecords);

        // Trả về kết quả JSON
        res.status(200).json(records);
    } catch (error) {
        // Xử lý lỗi và trả về phản hồi lỗi
        res.status(500).json({ message: 'Lỗi khi lấy dữ liệu MQ135 Statistics', error: error.message });
    }
});

app.get('/dht22statistics', async (req, res) => {
    try {
        const NumOfRecords = req.query.NumOfRecords === undefined ? 10 : Number(req.query.NumOfRecords);
        if (!Number.isInteger(NumOfRecords) || NumOfRecords < 1 || NumOfRecords > 100) {
            return res.status(400).json({ error: 'NumOfRecords phải là số nguyên từ 1 đến 100' });
        }

        const records = await DHT22Statistics.find().sort({ timestamp: -1 }).limit(NumOfRecords);
        res.status(200).json(records);
    } catch (error) {
        res.status(500).json({ message: 'Lỗi khi lấy dữ liệu DHT22 Statistics', error: error.message });
    }
});


////////////////////////////////////////// ------------------------ //////////////////////////////////////////
// Hàm kiểm tra và tự động bật/tắt quạt theo thời gian
const checkAutoFans = async () => {
    try {
        // Lấy tất cả quạt đang bật chế độ hẹn giờ
        const latestGasState = await getLatestGasState();
        const fans = await Fan.find({ timerEnabled: true });

        for (const fan of fans) {
            if (latestGasState.isDanger) {
                if (latestGasState.isFireAlarmActive) {
                    await turnFanOffForFireAlarm(fan, latestGasState.fireAlarmStatus, latestGasState.fireAlarmTime);
                } else {
                    await turnFanOffForGasDanger(fan, latestGasState.ppm, undefined, latestGasState.airQuality);
                }
                continue;
            }

            const currentTime = DateTime.now().setZone(timezone);
            //console.log("THOI GIAN HIEN TAI: ", currentTime);
            const currentHour = currentTime.hour;
            const currentMinute = currentTime.minute;

            const autoOnTime = getTimePartsInZone(fan.autoOnTime);
            const autoOffTime = getTimePartsInZone(fan.autoOffTime);

            const autoOnHour = autoOnTime.hour;
            const autoOnMinute = autoOnTime.minute;

            const autoOffHour = autoOffTime.hour;
            const autoOffMinute = autoOffTime.minute;
            //console.log("GIO VA PHUT: ", autoOnHour, autoOnMinute, autoOffHour, autoOffMinute, currentHour, currentMinute);

            // Nếu hiện tại nằm trong thời gian bật quạt
            if (isTimeBetween(currentHour, currentMinute, autoOnHour, autoOnMinute, autoOffHour, autoOffMinute)) {
                // Bật quạt tự động nếu chưa được bật bởi hệ thống
                if (fan.status === 1 && !fan.lastAutoReason && !fan.manualOverride) {
                    fan.manualOverride = false;
                    fan.lastAutoReason = 'timer';
                    await fan.save();
                }
                if (!fan.lastAutoReason && !fan.manualOverride && fan.status === 0) {
                    fan.status = 1;
                    fan.manualOverride = false;
                    fan.lastAutoReason = 'timer';
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
                if (fan.status === 0 && fan.manualOverride) {
                    fan.manualOverride = false;
                    await fan.save();
                }
                if (fan.lastAutoReason === 'timer' && fan.status === 1) {
                    fan.status = 0;
                    fan.lastAutoReason = null;
                    await fan.save();

                    // Gửi thông điệp MQTT để tắt đèn
                    const message = JSON.stringify({ type: 0 });
                    mqttClient.publish(FansControlTopic, message, { qos: 1 });
                    log('AUTO][FAN', 'Turned fan off by timer', { name: fan.name, topic: FansControlTopic, payload: message });
                }
            }
        }
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

            const autoOnTime = getTimePartsInZone(light.autoOnTime);
            const autoOffTime = getTimePartsInZone(light.autoOffTime);

            const autoOnHour = autoOnTime.hour;
            const autoOnMinute = autoOnTime.minute;

            const autoOffHour = autoOffTime.hour;
            const autoOffMinute = autoOffTime.minute;
            //console.log("GIO VA PHUT: ", autoOnHour, autoOnMinute, autoOffHour, autoOffMinute, currentHour, currentMinute);

            // Nếu hiện tại nằm trong thời gian bật đèn
            if (isTimeBetween(currentHour, currentMinute, autoOnHour, autoOnMinute, autoOffHour, autoOffMinute)) {
                // Bật đèn tự động nếu chưa được bật bởi hệ thống
                if (light.status === 1 && !light.lastAutoReason && !getLightManualOverride(light)) {
                    light.lastAutoReason = 'timer';
                    await light.save();
                }
                if (!light.lastAutoReason && !getLightManualOverride(light) && light.status === 0) {
                    setLightAutoState(light, 1, 'timer');
                    await light.save();

                    // Gửi thông điệp MQTT để bật đèn
                    const message = JSON.stringify({ type: 1 });
                    mqttClient.publish(LightsControlTopic, message, { qos: 1 });
                    log('AUTO][LIGHT', 'Turned light on by timer', { name: light.name, topic: LightsControlTopic, payload: message });
                }
            }
            // Nếu hiện tại không nằm trong khoảng thời gian bật
            else {
                if (light.status === 0 && getLightManualOverride(light)) {
                    light.manualOverride = false;
                    light.autoControlLocked = undefined;
                    await light.save();
                }
                // Tắt đèn tự động nếu chưa được tắt bởi hệ thống
                if (light.lastAutoReason === 'timer' && light.status === 1) {
                    light.status = 0;
                    light.manualOverride = false;
                    light.lastAutoReason = null;
                    light.autoControlLocked = undefined;
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

const autoTurnOnFans = async (currentTemperature, airQuality, ppm) => {
    try {
        // Lấy danh sách tất cả các quạt
        const fans = await Fan.find();
        if (!fans || fans.length === 0) {
            log('AUTO][FAN', 'Skipped auto cooling because no fans exist');
            return;
        }
        const latestFireAlarm = await getLatestFireAlarmState();
        const ppmValue = toFiniteNumber(ppm);
        const isGasLevelKnown = ppmValue !== undefined;
        const isGasDanger = isGasLevelKnown && ppmValue > fireWarningPpmThreshold;
        const isAirQualitySafeForCooling = isGasLevelKnown && ppmValue < warningPpmThreshold;

        // Duyệt qua tất cả các quạt
        for (const fan of fans) {
            if (latestFireAlarm.isActive) {
                await turnFanOffForFireAlarm(fan, latestFireAlarm.status, latestFireAlarm.time);
                continue;
            }

            if (isGasDanger) {
                await turnFanOffForGasDanger(fan, ppmValue, currentTemperature, airQuality);
                continue;
            }

            const autoOnTemperature = fan.autoOnTemperature;
            const shouldTurnOnByTemperature = fan.autoOnByTemperature === true
                && isGasLevelKnown
                && Number(currentTemperature) >= Number(autoOnTemperature)
                && isAirQualitySafeForCooling;
            const shouldTurnOn = shouldTurnOnByTemperature;
            const reason = shouldTurnOnByTemperature ? 'temperature' : 'none';
            const timerActive = isFanTimerActive(fan);

            if (!shouldTurnOn) {
                if (fan.status === 1 && fan.lastAutoReason === 'temperature' && !timerActive) {
                    fan.status = 0;
                    fan.lastAutoReason = null;
                    await fan.save();

                    const message = JSON.stringify({ type: 0 });
                    mqttClient.publish(FansControlTopic, message, { qos: 0 }, (err) => {
                        if (err) {
                            logError('MQTT][FAN', `Publish failed topic=${FansControlTopic}`, err);
                        } else {
                            log('AUTO][FAN', 'Turned fan off because auto fan conditions are not met', {
                                name: fan.name,
                                temp: currentTemperature,
                                threshold: autoOnTemperature,
                                airQuality,
                                ppm: ppmValue,
                                topic: FansControlTopic,
                                payload: message,
                            });
                        }
                    });
                }

                if (timerActive && fan.status === 1 && fan.lastAutoReason === 'temperature') {
                    log('AUTO][FAN', 'Kept fan on because timer is active', {
                        name: fan.name,
                        temp: currentTemperature,
                        threshold: autoOnTemperature,
                        airQuality,
                        ppm: ppmValue,
                    });
                }

                continue;
            }

            // Chỉ tự bật quạt khi nhà nóng và PPM đang dưới ngưỡng an toàn.
            if (shouldTurnOn && fan.status === 0) {
                // Cập nhật trạng thái quạt
                fan.status = 1;
                fan.manualOverride = false;
                fan.lastAutoReason = reason;
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
                            ppm: ppmValue,
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

const startKeepAlive = () => {
    if (!keepAliveUrl) {
        return;
    }

    const ping = async () => {
        try {
            const response = await axios.get(keepAliveUrl, {
                timeout: 5000,
                validateStatus: () => true,
            });
            log('KEEP_ALIVE', 'Pinged render endpoint', { url: keepAliveUrl, status: response.status });
        } catch (error) {
            logError('KEEP_ALIVE', `Failed to ping ${keepAliveUrl}`, error);
        }
    };

    setInterval(ping, keepAliveIntervalMs);
};

// Thiết lập một chu kỳ để kiểm tra mỗi phút (60000ms)
if (process.env.NODE_ENV !== 'test') {
    setInterval(checkAutoLights, autoCheckIntervalMs);
    setInterval(checkAutoFans, autoCheckIntervalMs);
    startKeepAlive();
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
    getDeviceStatusFromPayload,
    handleFireAlarmStatusPayload,
    handleLightSensorStatusPayload,
    isFanTimerActive,
    isTimeBetween,
};
