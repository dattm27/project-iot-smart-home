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

const requiredEnvAny = (...names) => {
    const foundName = names.find((name) => process.env[name]);
    if (!foundName) {
        throw new Error(`${names.join(' or ')} is required in .env`);
    }

    return process.env[foundName];
};

const topic = getArg('topic', process.env.MQTT_MQ135_STATISTICS_TOPIC || 'MQ135/Statistics');
const fanCommandTopic = process.env.MQTT_FANS_CONTROL_TOPIC || 'fans/01/server';
const waitMs = Number(getArg('wait', 8000));

const payload = {
    time: new Date().toISOString().replace('T', ' ').slice(0, 19).replace(/:/g, '-'),
    ppm: Number(getArg('ppm', 850)),
};

const client = mqtt.connect(requiredEnv('MQTT_BROKER_URL'), {
    port: Number(requiredEnv('MQTT_PORT')),
    username: requiredEnvAny('MQTT_USERNAME', 'HIVEMQ_USERNAME'),
    password: requiredEnvAny('MQTT_PASSWORD', 'HIVEMQ_PASSWORD'),
    clientId: `mq135-test-${Date.now()}`,
    clean: true,
    connectTimeout: 10000,
});

let sawFanCommand = false;

const close = (code) => {
    client.end(true, () => process.exit(code));
};

client.on('connect', () => {
    console.log('Connected to MQTT broker');
    console.log(`Listening for fan commands on: ${fanCommandTopic}`);

    client.subscribe(fanCommandTopic, (subscribeError) => {
        if (subscribeError) {
            console.error('Subscribe error:', subscribeError.message);
            close(1);
            return;
        }

        const message = JSON.stringify(payload);
        client.publish(topic, message, { qos: 0 }, (publishError) => {
            if (publishError) {
                console.error('Publish error:', publishError.message);
                close(1);
                return;
            }

            console.log(`Published to ${topic}:`);
            console.log(message);
            console.log(`Waiting ${waitMs}ms for backend auto-cooling response...`);
        });
    });
});

client.on('message', (receivedTopic, message) => {
    if (receivedTopic !== fanCommandTopic) {
        return;
    }

    sawFanCommand = true;
    console.log(`Received fan command from backend on ${receivedTopic}:`);
    console.log(message.toString());
    close(0);
});

client.on('error', (error) => {
    console.error('MQTT error:', error.message);
    close(1);
});

setTimeout(() => {
    if (!sawFanCommand) {
        console.log('No fan command received before timeout.');
        console.log('If backend is running and QUAT_1 has auto cooling enabled, check temp threshold, ppm <= 1100, and server logs.');
    }

    close(0);
}, waitMs);
