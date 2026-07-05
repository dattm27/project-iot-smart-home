const mongoose = require('mongoose');

const mq135StatisticsSchema = new mongoose.Schema({
    time: { type: String, required: true },
    airQuality: { type: String, required: true },
    ppm: { type: Number, required: true },
    co2_ppm: { type: Number },
    co_ppm: { type: Number },
    timestamp: { type: Date, default: Date.now }
});

const MQ135Statistics = mongoose.model('MQ135Statistics', mq135StatisticsSchema);

module.exports = MQ135Statistics;
