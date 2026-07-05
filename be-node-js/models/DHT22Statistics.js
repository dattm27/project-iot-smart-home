const mongoose = require('mongoose');

const dht22StatisticsSchema = new mongoose.Schema({
    time: { type: String, required: true },
    temp: { type: Number, required: true },
    humidity: { type: Number, required: true },
    timestamp: { type: Date, default: Date.now },
});

const DHT22Statistics = mongoose.model('DHT22Statistics', dht22StatisticsSchema);

module.exports = DHT22Statistics;
