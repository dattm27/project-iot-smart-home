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

const formatEspTime = () => new Date().toISOString().replace('T', ' ').slice(0, 19).replace(/:/g, '-');
const topic = getArg('topic', process.env.MQTT_DHT22_STATISTICS_TOPIC || 'DHT22/Statistics');

const payload = {
    time: formatEspTime(),
    temp: Number(getArg('temp', 35)),
    humidity: Number(getArg('humidity', 70)),
};

const client = mqtt.connect(requiredEnv('MQTT_BROKER_URL'), {
    port: Number(requiredEnv('MQTT_PORT')),
    username: requiredEnv('HIVEMQ_USERNAME'),
    password: requiredEnv('HIVEMQ_PASSWORD'),
    clientId: `dht22-test-${Date.now()}`,
    clean: true,
    connectTimeout: 10000,
});

const close = (code) => {
    client.end(true, () => process.exit(code));
};

client.on('connect', () => {
    const message = JSON.stringify(payload);
    client.publish(topic, message, { qos: 0 }, (publishError) => {
        if (publishError) {
            console.error('Publish error:', publishError.message);
            close(1);
            return;
        }

        console.log(`Published to ${topic}:`);
        console.log(message);
        close(0);
    });
});

client.on('error', (error) => {
    console.error('MQTT error:', error.message);
    close(1);
});
