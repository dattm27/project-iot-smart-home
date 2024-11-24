const mongoose = require('mongoose');
const mongoURI = 'mongodb+srv://SmartHome:s04072000@smarthome.mbgpd.mongodb.net/?retryWrites=true&w=majority&appName=SmartHome';

const connectDB = async () => {
    try {
        await mongoose.connect(mongoURI, { useNewUrlParser: true, useUnifiedTopology: true });
        console.log('Kết nối MongoDB Atlas thành công!');
    } catch (err) {
        console.error('Lỗi kết nối MongoDB:', err);
        process.exit(1);
    }
};

module.exports = connectDB;
