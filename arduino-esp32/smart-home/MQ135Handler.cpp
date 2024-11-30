#include "MQ135Handler.h"

// Chân cảm biến
int MQ135_PIN ;
int PPM1 = 0, PPM2 = 0; 
float RZero1 = 0,  RZero2 = 0;
// Biến toàn cục để lưu đối tượng cảm biến
static MQ135 mq135_sensor(MQ135_PIN);

// Hàm khởi tạo MQ135
void initMQ135(int pin) {
    MQ135_PIN = pin;
    mq135_sensor = MQ135(pin); // Khởi tạo đối tượng cảm biến
    Serial.println("MQ135 initialized on pin: " + String(pin));
}

// Hàm đọc giá trị CO2 từ cảm biến
float readCO2() {
    float co2 =  mq135_sensor.getRZero_CO2(); // Đọc nồng độ CO2
    Serial.println("CO2 Concentration: " + String(co2) + " ppm");
    return co2;
}

// Hàm đọc nồng độ khí theo đơn vị PPM
float readPPM() {
    float ppm =  mq135_sensor.getRZero_CO(); // Lấy chỉ số RZero
    Serial.println("Gas Concentration (PPM): " + String(ppm));
    return ppm;
}
