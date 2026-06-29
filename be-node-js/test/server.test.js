process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret';

const assert = require('node:assert/strict');
const http = require('node:http');
const { after, before, describe, it } = require('node:test');

const { app, autoTurnOnFans } = require('../server');
const { generateToken, hashPassword } = require('../auth');
const Fan = require('../models/Fan');
const Light = require('../models/Light');
const User = require('../models/User');

let server;
let baseUrl;

const request = async (method, pathname, body, token) => {
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
                    body: data ? JSON.parse(data) : null,
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

    it('registers a user and returns a jwt', async () => {
        User.findOne = async () => null;
        User.prototype.save = async function saveUser() {
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
        assert.equal(response.body.user.username, 'tester');
    });

    it('logs in an existing user and returns a jwt', async () => {
        User.findOne = async () => ({
            _id: 'user-id',
            username: 'tester',
            email: 'tester@example.com',
            passwordHash: hashPassword('secret123'),
        });

        const response = await request('POST', '/auth/login', {
            username: 'tester',
            password: 'secret123',
        });

        assert.equal(response.statusCode, 200);
        assert.equal(response.body.message, 'Đăng nhập thành công');
        assert.ok(response.body.token);
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

    it('automatically turns fans on when the house is hot or air quality is bad', async () => {
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

        await autoTurnOnFans(31, 'BAD', 40, 1200);

        assert.equal(hotFan.status, 1);
        assert.equal(hotFan.isAutoControlled, true);
        assert.equal(gasFan.status, 1);
        assert.equal(gasFan.isAutoControlled, true);
    });
});
