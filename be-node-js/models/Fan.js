// models/Light.js
const mongoose = require('mongoose');

const fanSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        unique: true,  // Tên quạt là duy nhất
    },
    status: {
        type: Number,
        required: true,
        enum: [0, 1],  // 0 là tắt, 1 là bật
        default: 0,  // Mặc định là tắt
    },
    room: {
        type: String,
        required: true,  // Cần phải có thông tin phòng
    },
    // Các trường liên quan đến hẹn giờ
    timerEnabled: {
        type: Boolean,
        default: false,  // Chế độ hẹn giờ mặc định là tắt
    },
    autoOnTime: {
        type: Date,  // Thời gian tự động bật đèn
    },
    autoOffTime: {
        type: Date,  // Thời gian tự động tắt đèn
    },
    isAutoControlled: {
        type: Boolean,
        default: false,
    },
});

// Tạo model từ schema
const Fan = mongoose.model('Fan', fanSchema);

module.exports = Fan;