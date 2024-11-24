const mongoose = require('mongoose');

// Định nghĩa schema cho thông báo MQ135 Statistics
const mq135StatisticsSchema = new mongoose.Schema({
    time: { type: String, required: true },       // Thời gian của sự kiện
    airQuality: { type: String, required: true },  // Chất lượng không khí
    co2_ppm: { type: Number, required: true },    // Nồng độ CO2 (ppm)
    co_ppm: { type: Number, required: true },     // Nồng độ CO (ppm)
    timestamp: { type: Date, default: Date.now }   // Thời gian lưu thông báo, mặc định là thời gian hiện tại
});

// Tạo model MQ135Statistics từ schema trên
const MQ135Statistics = mongoose.model('MQ135Statistics', mq135StatisticsSchema);

module.exports = MQ135Statistics;
