process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret';

const assert = require('node:assert/strict');
const http = require('node:http');
const { after, before, beforeEach, describe, it } = require('node:test');
const { DateTime } = require('luxon');

const {
    app,
    autoTurnOnFans,
    checkAutoFans,
    checkAutoLights,
    evaluateAirQuality,
    getDeviceStatusFromPayload,
    handleFireAlarmStatusPayload,
    handleLightSensorStatusPayload,
    isTimeBetween,
} = require('../server');
const { generateToken, hashPassword } = require('../auth');
const Fan = require('../models/Fan');
const FireAlarm = require('../models/FireAlarm');
const Light = require('../models/Light');
const MQ135Statistics = require('../models/MQ135Statistics');
const RefreshToken = require('../models/RefreshToken');
const User = require('../models/User');

let server;
let baseUrl;

const mockLatestFireAlarm = (fireAlarm) => {
    FireAlarm.findOne = () => ({
        sort: async () => fireAlarm,
    });
};

const request = async (method, pathname, body, token, options = {}) => {
    const payload = body ? JSON.stringify(body) : undefined;

    return new Promise((resolve, reject) => {
        const req = http.request(`${baseUrl}${pathname}`, {
            method,
            headers: {
                ...(payload ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } : {}),
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
        }, (res) => {
            let data = '';
            res.on('data', (chunk) => {
                data += chunk;
            });
            res.on('end', () => {
                resolve({
                    statusCode: res.statusCode,
                    body: data && options.parseJson !== false ? JSON.parse(data) : data,
                    headers: res.headers,
                });
            });
        });

        req.on('error', reject);
        if (payload) req.write(payload);
        req.end();
    });
};

describe('smart home backend endpoints', () => {
    before(() => {
        server = app.listen(0);
        const address = server.address();
        baseUrl = `http://127.0.0.1:${address.port}`;
    });

    beforeEach(() => {
        mockLatestFireAlarm(null);
    });

    after(() => {
        server.close();
    });

    it('rejects protected endpoints without jwt', async () => {
        const response = await request('GET', '/lights/');

        assert.equal(response.statusCode, 401);
        assert.equal(response.body.error, 'Cần đăng nhập để sử dụng API');
    });

    it('serves public OpenAPI and Swagger UI docs', async () => {
        const openApiResponse = await request('GET', '/openapi.json');
        const docsResponse = await request('GET', '/api-docs', undefined, undefined, { parseJson: false });

        assert.equal(openApiResponse.statusCode, 200);
        assert.equal(openApiResponse.body.openapi, '3.0.3');
        assert.ok(openApiResponse.body.paths['/lights/OnOff']);
        assert.ok(openApiResponse.body.paths['/lights/SensorMode']);
        assert.ok(openApiResponse.body.paths['/dht22statistics']);
        assert.equal(docsResponse.statusCode, 200);
        assert.match(docsResponse.body, /SwaggerUIBundle/);
    });

    it('evaluates MQ135 air quality from the combined PPM level', () => {
        assert.equal(evaluateAirQuality(899), 'GOOD');
        assert.equal(evaluateAirQuality(900), 'WARNING');
        assert.equal(evaluateAirQuality(1100), 'WARNING');
        assert.equal(evaluateAirQuality(1101), 'DANGER');
    });

    it('parses device status from type or status MQTT payloads', () => {
        assert.equal(getDeviceStatusFromPayload({ type: 1 }), 1);
        assert.equal(getDeviceStatusFromPayload({ status: '1' }), 1);
        assert.equal(getDeviceStatusFromPayload({ status: '0' }), 0);
        assert.equal(getDeviceStatusFromPayload({ status: 'on' }), undefined);
    });

    it('keeps timers active through the configured end minute', () => {
        assert.equal(isTimeBetween(21, 16, 21, 16, 21, 17), true);
        assert.equal(isTimeBetween(21, 17, 21, 16, 21, 17), true);
        assert.equal(isTimeBetween(21, 18, 21, 16, 21, 17), false);
        assert.equal(isTimeBetween(0, 0, 23, 59, 0, 0), true);
        assert.equal(isTimeBetween(0, 1, 23, 59, 0, 0), false);
    });

    it('registers a user and returns a jwt', async () => {
        User.findOne = async () => null;
        User.prototype.save = async function saveUser() {
            return this;
        };
        RefreshToken.prototype.save = async function saveRefreshToken() {
            return this;
        };

        const response = await request('POST', '/auth/register', {
            username: 'tester',
            email: 'tester@example.com',
            password: 'secret123',
        });

        assert.equal(response.statusCode, 201);
        assert.equal(response.body.message, 'Đăng ký thành công');
        assert.ok(response.body.token);
        assert.ok(response.body.refreshToken);
        assert.equal(response.body.user.username, 'tester');
    });

    it('logs in an existing user and returns a jwt', async () => {
        User.findOne = async () => ({
            _id: 'user-id',
            username: 'tester',
            email: 'tester@example.com',
            passwordHash: hashPassword('secret123'),
        });
        RefreshToken.prototype.save = async function saveRefreshToken() {
            return this;
        };

        const response = await request('POST', '/auth/login', {
            username: 'tester',
            password: 'secret123',
        });

        assert.equal(response.statusCode, 200);
        assert.equal(response.body.message, 'Đăng nhập thành công');
        assert.ok(response.body.token);
        assert.ok(response.body.refreshToken);
    });

    it('rejects object payloads that could be used for NoSQL injection', async () => {
        User.findOne = async () => {
            throw new Error('User.findOne should not be called for invalid input');
        };

        const response = await request('POST', '/auth/login', {
            username: { $ne: null },
            password: 'secret123',
        });

        assert.equal(response.statusCode, 400);
        assert.match(response.body.error, /Username/);
    });

    it('refreshes access tokens and rotates refresh tokens', async () => {
        const storedToken = {
            userId: 'user-id',
            revokedAt: null,
            expiresAt: new Date(Date.now() + 60_000),
            save: async function saveRefreshToken() {
                return this;
            },
        };
        RefreshToken.findOne = async () => storedToken;
        RefreshToken.prototype.save = async function saveRefreshToken() {
            return this;
        };
        User.findById = async () => ({
            _id: 'user-id',
            username: 'tester',
            email: 'tester@example.com',
        });

        const response = await request('POST', '/auth/refresh', {
            refreshToken: 'valid-refresh-token',
        });

        assert.equal(response.statusCode, 200);
        assert.equal(response.body.message, 'Làm mới token thành công');
        assert.ok(response.body.token);
        assert.ok(response.body.refreshToken);
        assert.ok(storedToken.revokedAt instanceof Date);
    });

    it('turns a light off without allowing auto mode to immediately turn it back on', async () => {
        const token = generateToken({ _id: 'user-id', username: 'tester' });
        const light = {
            name: 'DEN_PH',
            status: 1,
            manualOverride: false,
            lastAutoReason: null,
            save: async function saveLight() {
                return this;
            },
        };
        Light.findOne = async () => light;

        const response = await request('PUT', '/lights/OnOff', {
            name: 'DEN_PH',
            type: 0,
        }, token);

        assert.equal(response.statusCode, 200);
        assert.equal(response.body.lightStatus, 0);
        assert.equal(light.status, 0);
        assert.equal(light.manualOverride, true);
        assert.equal(light.lastAutoReason, null);
    });

    it('turns a fan off manually and clears auto reason', async () => {
        const token = generateToken({ _id: 'user-id', username: 'tester' });
        const fan = {
            name: 'QUAT_1',
            status: 1,
            manualOverride: false,
            lastAutoReason: 'temperature',
            save: async function saveFan() {
                return this;
            },
        };
        Fan.findOne = async () => fan;

        const response = await request('PUT', '/fans/OnOff', {
            name: 'QUAT_1',
            type: 0,
        }, token);

        assert.equal(response.statusCode, 200);
        assert.equal(response.body.fanStatus, 0);
        assert.equal(fan.status, 0);
        assert.equal(fan.manualOverride, true);
        assert.equal(fan.lastAutoReason, null);
    });

    it('clears manual override when auto cooling is enabled', async () => {
        const token = generateToken({ _id: 'user-id', username: 'tester' });
        const fan = {
            name: 'QUAT_1',
            status: 0,
            autoOnByTemperature: false,
            autoOnTemperature: 30,
            manualOverride: true,
            save: async function saveFan() {
                return this;
            },
        };
        Fan.findOne = async () => fan;

        const response = await request('PUT', '/fans/AutoCooling', {
            name: 'QUAT_1',
            autoOnByTemperature: true,
            autoOnTemperature: 24,
        }, token);

        assert.equal(response.statusCode, 200);
        assert.equal(response.body.fanAutoOnByTemperature, true);
        assert.equal(fan.autoOnTemperature, 24);
        assert.equal(fan.manualOverride, false);
    });

    it('rejects device commands with invalid field types before querying MongoDB', async () => {
        const token = generateToken({ _id: 'user-id', username: 'tester' });
        Light.findOne = async () => {
            throw new Error('Light.findOne should not be called for invalid input');
        };

        const response = await request('PUT', '/lights/OnOff', {
            name: { $ne: null },
            type: 1,
        }, token);

        assert.equal(response.statusCode, 400);
        assert.match(response.body.error, /Tên đèn/);
    });

    it('updates light sensor mode and publishes the MQTT setting', async () => {
        const token = generateToken({ _id: 'user-id', username: 'tester' });
        const light = {
            name: 'DEN_PH',
            lightSensorEnabled: false,
            save: async function saveLight() {
                return this;
            },
        };
        Light.findOne = async () => light;

        const response = await request('PUT', '/lights/SensorMode', {
            name: 'DEN_PH',
            enabled: true,
        }, token);

        assert.equal(response.statusCode, 200);
        assert.equal(light.lightSensorEnabled, true);
        assert.equal(response.body.lightSensorEnabled, true);
    });

    it('automatically turns fans on only when the house is hot and PPM is below the warning threshold', async () => {
        const hotFan = {
            name: 'QUAT_1',
            status: 0,
            autoOnByTemperature: true,
            autoOnTemperature: 30,
            save: async function saveFan() {
                return this;
            },
        };
        const gasFan = {
            name: 'QUAT_2',
            status: 0,
            autoOnByTemperature: true,
            autoOnTemperature: 40,
            save: async function saveFan() {
                return this;
            },
        };
        Fan.find = async () => [hotFan, gasFan];

        await autoTurnOnFans(41, 'GOOD', 899);

        assert.equal(hotFan.status, 1);
        assert.equal(gasFan.status, 1);
    });

    it('does not turn fans on when PPM reaches the warning threshold even if the house is hot', async () => {
        const fan = {
            name: 'QUAT_1',
            status: 0,
            autoOnByTemperature: true,
            autoOnTemperature: 30,
            save: async function saveFan() {
                return this;
            },
        };
        Fan.find = async () => [fan];

        await autoTurnOnFans(35, 'WARNING', 900);

        assert.equal(fan.status, 0);
    });

    it('does not turn fans on from PPM warning alone', async () => {
        const fan = {
            name: 'QUAT_1',
            status: 0,
            autoOnByTemperature: false,
            autoOnTemperature: 30,
            save: async function saveFan() {
                return this;
            },
        };
        Fan.find = async () => [fan];

        await autoTurnOnFans(35, 'WARNING', 1000);

        assert.equal(fan.status, 0);
    });

    it('does not turn fans on by temperature until a gas level is known', async () => {
        const fan = {
            name: 'QUAT_1',
            status: 0,
            autoOnByTemperature: true,
            autoOnTemperature: 30,
            save: async function saveFan() {
                return this;
            },
        };
        Fan.find = async () => [fan];

        await autoTurnOnFans(35, 'UNKNOWN', undefined);

        assert.equal(fan.status, 0);
    });

    it('automatically turns a light on while inside the configured timer window', async () => {
        const now = DateTime.now().setZone(process.env.TIMEZONE || 'Asia/Ho_Chi_Minh');
        const light = {
            name: 'DEN_PH',
            status: 0,
            manualOverride: false,
            lastAutoReason: null,
            timerEnabled: true,
            autoOnTime: now.minus({ minutes: 1 }).toJSDate(),
            autoOffTime: now.plus({ minutes: 1 }).toJSDate(),
            save: async function saveLight() {
                return this;
            },
        };
        Light.find = async () => [light];

        await checkAutoLights();

        assert.equal(light.status, 1);
        assert.equal(light.manualOverride, false);
        assert.equal(light.lastAutoReason, 'timer');
    });

    it('does not turn a manually turned-off light back on inside the timer window', async () => {
        const now = DateTime.now().setZone(process.env.TIMEZONE || 'Asia/Ho_Chi_Minh');
        const light = {
            name: 'DEN_PH',
            status: 0,
            manualOverride: true,
            lastAutoReason: null,
            timerEnabled: true,
            autoOnTime: now.minus({ minutes: 1 }).toJSDate(),
            autoOffTime: now.plus({ minutes: 1 }).toJSDate(),
            save: async function saveLight() {
                return this;
            },
        };
        Light.find = async () => [light];

        await checkAutoLights();

        assert.equal(light.status, 0);
        assert.equal(light.manualOverride, true);
    });

    it('turns off a light timer when timerEnabled is false', async () => {
        const token = generateToken({ _id: 'user-id', username: 'tester' });
        const light = {
            name: 'DEN_PH',
            timerEnabled: true,
            autoOnTime: new Date(),
            autoOffTime: new Date(),
            save: async function saveLight() {
                return this;
            },
        };
        Light.findOne = async () => light;

        const response = await request('PUT', '/lights/Timer/', {
            name: 'DEN_PH',
            timerEnabled: false,
        }, token);

        assert.equal(response.statusCode, 200);
        assert.equal(light.timerEnabled, false);
        assert.equal(light.autoOnTime, null);
        assert.equal(light.autoOffTime, null);
        assert.equal(response.body.timerEnabled, false);
    });

    it('automatically turns a sensor-controlled fan off when conditions return to normal', async () => {
        const fan = {
            name: 'QUAT_1',
            status: 1,
            manualOverride: false,
            lastAutoReason: 'temperature',
            autoOnByTemperature: true,
            autoOnTemperature: 30,
            save: async function saveFan() {
                return this;
            },
        };
        Fan.find = async () => [fan];

        await autoTurnOnFans(25, 'GOOD', 500);

        assert.equal(fan.status, 0);
        assert.equal(fan.lastAutoReason, null);
    });

    it('turns a sensor-controlled fan off when gas level becomes unsafe', async () => {
        const fan = {
            name: 'QUAT_1',
            status: 1,
            manualOverride: false,
            lastAutoReason: 'temperature',
            autoOnByTemperature: true,
            autoOnTemperature: 30,
            save: async function saveFan() {
                return this;
            },
        };
        Fan.find = async () => [fan];

        await autoTurnOnFans(35, 'WARNING', 900);

        assert.equal(fan.status, 0);
        assert.equal(fan.lastAutoReason, null);
    });

    it('forces a fan off when gas level reaches danger even if timer or manual control is active', async () => {
        const now = DateTime.now().setZone(process.env.TIMEZONE || 'Asia/Ho_Chi_Minh');
        const timerFan = {
            name: 'QUAT_TIMER',
            status: 1,
            manualOverride: false,
            lastAutoReason: 'timer',
            timerEnabled: true,
            autoOnTime: now.minus({ minutes: 1 }).toJSDate(),
            autoOffTime: now.plus({ minutes: 1 }).toJSDate(),
            autoOnByTemperature: true,
            autoOnTemperature: 30,
            save: async function saveFan() {
                return this;
            },
        };
        const manualFan = {
            name: 'QUAT_MANUAL',
            status: 1,
            manualOverride: false,
            lastAutoReason: null,
            timerEnabled: false,
            autoOnByTemperature: true,
            autoOnTemperature: 30,
            save: async function saveFan() {
                return this;
            },
        };
        Fan.find = async () => [timerFan, manualFan];

        await autoTurnOnFans(35, 'DANGER', 1101);

        assert.equal(timerFan.status, 0);
        assert.equal(timerFan.manualOverride, false);
        assert.equal(timerFan.lastAutoReason, null);
        assert.equal(manualFan.status, 0);
    });

    it('does not let sensor auto cooling turn a fan off while its timer window is active', async () => {
        const now = DateTime.now().setZone(process.env.TIMEZONE || 'Asia/Ho_Chi_Minh');
        const fan = {
            name: 'QUAT_1',
            status: 1,
            manualOverride: false,
            lastAutoReason: 'temperature',
            timerEnabled: true,
            autoOnTime: now.minus({ minutes: 1 }).toJSDate(),
            autoOffTime: now.plus({ minutes: 1 }).toJSDate(),
            autoOnByTemperature: true,
            autoOnTemperature: 30,
            save: async function saveFan() {
                return this;
            },
        };
        Fan.find = async () => [fan];

        await autoTurnOnFans(25, 'GOOD', 500);

        assert.equal(fan.status, 1);
        assert.equal(fan.lastAutoReason, 'temperature');
    });

    it('does not let fan timer turn a fan on while the latest gas level is dangerous', async () => {
        const now = DateTime.now().setZone(process.env.TIMEZONE || 'Asia/Ho_Chi_Minh');
        const fan = {
            name: 'QUAT_1',
            status: 0,
            manualOverride: false,
            lastAutoReason: null,
            timerEnabled: true,
            autoOnTime: now.minus({ minutes: 1 }).toJSDate(),
            autoOffTime: now.plus({ minutes: 1 }).toJSDate(),
            save: async function saveFan() {
                return this;
            },
        };
        Fan.find = async () => [fan];
        MQ135Statistics.findOne = () => ({
            sort: async () => ({ ppm: 1101, airQuality: 'DANGER' }),
        });

        await checkAutoFans();

        assert.equal(fan.status, 0);
        assert.equal(fan.lastAutoReason, null);
    });

    it('does not let fan timer turn a fan back on while fire alarm is active', async () => {
        const now = DateTime.now().setZone(process.env.TIMEZONE || 'Asia/Ho_Chi_Minh');
        const fan = {
            name: 'QUAT_1',
            status: 0,
            manualOverride: false,
            lastAutoReason: null,
            timerEnabled: true,
            autoOnTime: now.minus({ minutes: 1 }).toJSDate(),
            autoOffTime: now.plus({ minutes: 1 }).toJSDate(),
            save: async function saveFan() {
                return this;
            },
        };
        Fan.find = async () => [fan];
        MQ135Statistics.findOne = () => ({
            sort: async () => ({ ppm: 500, airQuality: 'GOOD' }),
        });
        mockLatestFireAlarm({ status: 'active', time: '2026-07-13 16-21-42' });

        await checkAutoFans();

        assert.equal(fan.status, 0);
        assert.equal(fan.manualOverride, false);
        assert.equal(fan.lastAutoReason, null);
    });

    it('does not turn a manually turned-off fan back on inside the timer window', async () => {
        const now = DateTime.now().setZone(process.env.TIMEZONE || 'Asia/Ho_Chi_Minh');
        const fan = {
            name: 'QUAT_1',
            status: 0,
            manualOverride: true,
            lastAutoReason: null,
            timerEnabled: true,
            autoOnTime: now.minus({ minutes: 1 }).toJSDate(),
            autoOffTime: now.plus({ minutes: 1 }).toJSDate(),
            save: async function saveFan() {
                return this;
            },
        };
        Fan.find = async () => [fan];
        MQ135Statistics.findOne = () => ({
            sort: async () => ({ ppm: 500, airQuality: 'GOOD' }),
        });

        await checkAutoFans();

        assert.equal(fan.status, 0);
        assert.equal(fan.manualOverride, true);
        assert.equal(fan.lastAutoReason, null);
    });

    it('does not let auto temperature turn a fan on while fire alarm is active', async () => {
        const fan = {
            name: 'QUAT_1',
            status: 0,
            manualOverride: false,
            lastAutoReason: null,
            autoOnByTemperature: true,
            autoOnTemperature: 30,
            save: async function saveFan() {
                return this;
            },
        };
        Fan.find = async () => [fan];
        mockLatestFireAlarm({ status: 'active', time: '2026-07-13 16-21-42' });

        await autoTurnOnFans(35, 'GOOD', 500);

        assert.equal(fan.status, 0);
        assert.equal(fan.manualOverride, false);
        assert.equal(fan.lastAutoReason, null);
    });

    it('keeps fan timer manual override when auto cooling conditions are not met', async () => {
        const now = DateTime.now().setZone(process.env.TIMEZONE || 'Asia/Ho_Chi_Minh');
        const fan = {
            name: 'QUAT_1',
            status: 0,
            manualOverride: true,
            lastAutoReason: null,
            timerEnabled: true,
            autoOnTime: now.minus({ minutes: 1 }).toJSDate(),
            autoOffTime: now.plus({ minutes: 1 }).toJSDate(),
            autoOnByTemperature: true,
            autoOnTemperature: 30,
            save: async function saveFan() {
                return this;
            },
        };
        Fan.find = async () => [fan];

        await autoTurnOnFans(25, 'GOOD', 500);

        assert.equal(fan.status, 0);
        assert.equal(fan.manualOverride, true);
        assert.equal(fan.lastAutoReason, null);
    });

    it('lets auto temperature turn a fan on even after a manual off', async () => {
        const fan = {
            name: 'QUAT_1',
            status: 0,
            manualOverride: true,
            lastAutoReason: null,
            autoOnByTemperature: true,
            autoOnTemperature: 30,
            save: async function saveFan() {
                return this;
            },
        };
        Fan.find = async () => [fan];

        await autoTurnOnFans(35, 'GOOD', 500);

        assert.equal(fan.status, 1);
        assert.equal(fan.manualOverride, false);
        assert.equal(fan.lastAutoReason, 'temperature');
    });

    it('ignores light sensor status when light sensor mode is disabled', async () => {
        const light = {
            name: 'DEN_PH',
            status: 0,
            manualOverride: true,
            lastAutoReason: null,
            lightSensorEnabled: false,
            save: async function saveLight() {
                throw new Error('disabled sensor should not save');
            },
        };
        Light.findOne = async () => light;

        const result = await handleLightSensorStatusPayload(JSON.stringify({ status: 1, name: 'DEN_PH' }));

        assert.equal(result.updated, false);
        assert.equal(result.reason, 'disabled');
        assert.equal(light.status, 0);
        assert.equal(light.manualOverride, true);
        assert.equal(light.lastAutoReason, null);
    });

    it('lets light sensor control the light even after a manual off', async () => {
        const light = {
            name: 'DEN_PH',
            status: 0,
            manualOverride: true,
            lastAutoReason: null,
            lightSensorEnabled: true,
            save: async function saveLight() {
                return this;
            },
        };
        Light.findOne = async () => light;

        const result = await handleLightSensorStatusPayload(JSON.stringify({ status: 1, name: 'DEN_PH' }));

        assert.equal(result.updated, true);
        assert.equal(result.reason, 'updated');
        assert.equal(light.status, 1);
        assert.equal(light.manualOverride, false);
        assert.equal(light.lastAutoReason, 'light_sensor');
    });

    it('forces running fans off when fire alarm topic reports active', async () => {
        const runningFan = {
            name: 'QUAT_1',
            status: 1,
            manualOverride: true,
            lastAutoReason: 'timer',
            save: async function saveFan() {
                return this;
            },
        };
        const stoppedFan = {
            name: 'QUAT_2',
            status: 0,
            manualOverride: false,
            lastAutoReason: null,
            save: async function saveFan() {
                throw new Error('stopped fan should not save');
            },
        };
        FireAlarm.findOne = () => ({ sort: async () => null });
        FireAlarm.prototype.save = async function saveFireAlarm() {
            return this;
        };
        Fan.find = async () => [runningFan, stoppedFan];

        const result = await handleFireAlarmStatusPayload(JSON.stringify({
            time: '2026-07-13 16-21-42',
            status: 'active',
        }));

        assert.equal(result.updated, true);
        assert.equal(result.turnedOffFans, 1);
        assert.equal(runningFan.status, 0);
        assert.equal(runningFan.manualOverride, false);
        assert.equal(runningFan.lastAutoReason, null);
        assert.equal(stoppedFan.status, 0);
    });

    it('does not force fans off when fire alarm topic reports inactive', async () => {
        const runningFan = {
            name: 'QUAT_1',
            status: 1,
            manualOverride: false,
            lastAutoReason: null,
            save: async function saveFan() {
                throw new Error('inactive fire alarm should not save fan');
            },
        };
        FireAlarm.findOne = () => ({ sort: async () => null });
        FireAlarm.prototype.save = async function saveFireAlarm() {
            return this;
        };
        Fan.find = async () => [runningFan];

        const result = await handleFireAlarmStatusPayload(JSON.stringify({
            time: '2026-07-13 16-22-10',
            status: 'inactive',
        }));

        assert.equal(result.updated, true);
        assert.equal(result.turnedOffFans, 0);
        assert.equal(runningFan.status, 1);
        assert.equal(runningFan.manualOverride, false);
        assert.equal(runningFan.lastAutoReason, null);
    });
});
