require('dotenv').config();

const mqtt = require('mqtt');

const getArg = (name, defaultValue) => {
    const index = process.argv.indexOf(`--${name}`);
    if (index === -1 || process.argv[index + 1] === undefined) {
        return defaultValue;
    }

    return process.argv[index + 1];
};

const requiredEnv = (name) => {
    if (!process.env[name]) {
        throw new Error(`${name} is required in .env`);
    }

    return process.env[name];
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const formatEspTime = () => new Date().toISOString().replace('T', ' ').slice(0, 19).replace(/:/g, '-');

const topic = getArg('topic', process.env.MQTT_FIRE_ALARM_TOPIC || 'MQ135/FireAlarm');
const count = Number(getArg('count', 4));
const intervalMs = Number(getArg('interval', 1000));
const basePpm = Number(getArg('ppm', 1200));
const ppmStep = Number(getArg('step', 25));
const fireThreshold = Number(getArg('threshold', 1100));
const username = getArg('username', process.env.BE_SERVER_MQTT_USERNAME || process.env.MQTT_USERNAME || 'be-server');
const password = getArg('password', process.env.BE_SERVER_MQTT_PASSWORD || process.env.MQTT_PASSWORD || process.env.HIVEMQ_PASSWORD);

if (!password) {
    throw new Error('BE_SERVER_MQTT_PASSWORD or MQTT_PASSWORD is required in .env, or pass --password');
}

if (!Number.isInteger(count) || count <= 0) {
    throw new Error('--count must be a positive integer');
}

if (!Number.isFinite(basePpm) || !Number.isFinite(ppmStep) || !Number.isFinite(fireThreshold)) {
    throw new Error('--ppm, --step, and --threshold must be valid numbers');
}

const getFireStatusFromPpm = (ppm) => (ppm > fireThreshold ? 'active' : 'inactive');

const client = mqtt.connect(requiredEnv('MQTT_BROKER_URL'), {
    port: Number(requiredEnv('MQTT_PORT')),
    username,
    password,
    clientId: `fire-alarm-test-${Date.now()}`,
    clean: true,
    connectTimeout: 10000,
});

const close = (code) => {
    client.end(true, () => process.exit(code));
};

client.on('connect', async () => {
    console.log('Connected to MQTT broker');
    console.log(`Publishing ${count} fire alarm message(s) to: ${topic}`);
    console.log(`Using MQTT username: ${username}`);
    console.log(`Fire status is generated from ppm > ${fireThreshold}`);

    for (let index = 0; index < count; index += 1) {
        const ppm = basePpm + index * ppmStep;
        const status = getFireStatusFromPpm(ppm);
        const payload = {
            time: formatEspTime(),
            status,
        };
        const message = JSON.stringify(payload);

        await new Promise((resolve, reject) => {
            client.publish(topic, message, { qos: 0 }, (publishError) => {
                if (publishError) {
                    reject(publishError);
                    return;
                }

                console.log(`Published ${index + 1}/${count}: ${message} (simulated ppm=${ppm})`);
                resolve();
            });
        });

        if (index < count - 1) {
            await sleep(intervalMs);
        }
    }

    close(0);
});

client.on('error', (error) => {
    console.error('MQTT error:', error.message);
    close(1);
});
