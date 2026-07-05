process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret';

const assert = require('node:assert/strict');
const http = require('node:http');
const { after, before, describe, it } = require('node:test');
const { DateTime } = require('luxon');

const { app, autoTurnOnFans, checkAutoLights, evaluateAirQuality, isTimeBetween } = require('../server');
const { generateToken, hashPassword } = require('../auth');
const Fan = require('../models/Fan');
const Light = require('../models/Light');
const RefreshToken = require('../models/RefreshToken');
const User = require('../models/User');

let server;
let baseUrl;

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
            isAutoControlled: false,
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
        assert.equal(light.isAutoControlled, true);
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

    it('automatically turns fans on when the house is hot or air quality is not good but not dangerous', async () => {
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
            autoOnByTemperature: false,
            autoOnTemperature: 40,
            save: async function saveFan() {
                return this;
            },
        };
        Fan.find = async () => [hotFan, gasFan];

        await autoTurnOnFans(31, 'WARNING', 1000);

        assert.equal(hotFan.status, 1);
        assert.equal(hotFan.isAutoControlled, true);
        assert.equal(gasFan.status, 1);
        assert.equal(gasFan.isAutoControlled, true);
    });

    it('does not turn fans on when gas level is dangerous even if the house is hot', async () => {
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

        await autoTurnOnFans(35, 'DANGER', 1300);

        assert.equal(fan.status, 0);
        assert.equal(fan.isAutoControlled, undefined);
    });

    it('allows auto fan control at the fire boundary because only values above it are dangerous', async () => {
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

        await autoTurnOnFans(35, 'WARNING', 1100);

        assert.equal(fan.status, 1);
        assert.equal(fan.isAutoControlled, true);
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
        assert.equal(fan.isAutoControlled, undefined);
    });

    it('automatically turns a light on while inside the configured timer window', async () => {
        const now = DateTime.now().setZone(process.env.TIMEZONE || 'Asia/Ho_Chi_Minh');
        const light = {
            name: 'DEN_PH',
            status: 0,
            isAutoControlled: false,
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
        assert.equal(light.isAutoControlled, true);
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
            isAutoControlled: true,
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
        assert.equal(fan.isAutoControlled, false);
        assert.equal(fan.lastAutoReason, null);
    });

    it('turns a sensor-controlled fan off when gas level becomes unsafe', async () => {
        const fan = {
            name: 'QUAT_1',
            status: 1,
            isAutoControlled: true,
            manualOverride: false,
            lastAutoReason: 'temperature',
            autoOnByTemperature: true,
            autoOnTemperature: 30,
            save: async function saveFan() {
                return this;
            },
        };
        Fan.find = async () => [fan];

        await autoTurnOnFans(35, 'DANGER', 1300);

        assert.equal(fan.status, 0);
        assert.equal(fan.isAutoControlled, false);
        assert.equal(fan.lastAutoReason, null);
    });

    it('respects manual fan off until sensor conditions return to normal', async () => {
        const fan = {
            name: 'QUAT_1',
            status: 0,
            isAutoControlled: true,
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

        assert.equal(fan.status, 0);
        assert.equal(fan.manualOverride, true);

        await autoTurnOnFans(25, 'GOOD', 500);

        assert.equal(fan.status, 0);
        assert.equal(fan.manualOverride, false);
    });
});
