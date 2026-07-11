// models/Light.js
const mongoose = require('mongoose');

const lightSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        unique: true,  // Tên đèn là duy nhất
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
    manualOverride: {
        type: Boolean,
        default: false,
    },
    lastAutoReason: {
        type: String,
        enum: ['timer', 'light_sensor', null],
        default: null,
    },
    // Field legacy, chỉ giữ để đọc dữ liệu đã lưu trước khi đổi sang manualOverride.
    autoControlLocked: {
        type: Boolean,
        default: undefined,
    },
    lightSensorEnabled: {
        type: Boolean,
        default: false,
    },
});

lightSchema.set('toJSON', {
    transform: (_doc, ret) => {
        delete ret.autoControlLocked;
        return ret;
    },
});

lightSchema.set('toObject', {
    transform: (_doc, ret) => {
        delete ret.autoControlLocked;
        return ret;
    },
});

// Tạo model từ schema
const Light = mongoose.model('Light', lightSchema);

module.exports = Light;
