const mongoose = require('mongoose');

// Định nghĩa schema cho thông báo báo cháy
const fireAlarmSchema = new mongoose.Schema({
    time: { type: String, required: true },   // Thời gian xảy ra sự cố
    status: { type: String, required: true }, // Trạng thái sự cố (ví dụ: 'active', 'resolved')
    timestamp: { type: Date, default: Date.now }  // Thời gian lưu thông báo
});

// Tạo model FireAlarm từ schema trên
const FireAlarm = mongoose.model('FireAlarm', fireAlarmSchema);

module.exports = FireAlarm;
