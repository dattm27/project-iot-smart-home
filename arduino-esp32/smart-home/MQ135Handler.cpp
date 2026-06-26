#include "MQ135Handler.h"

// Chân cảm biến
int MQ135_PIN ;
int PPM1 = 0, PPM2 = 0; 
float RZero1 = 0,  RZero2 = 0;
// Biến toàn cục để lưu đối tượng cảm biến
static MQ135 mq135_sensor(MQ135_PIN);

//khởi tạo R0
void updateRZero() {
   for (int i = 1; i <= 50; i++) {
        RZero1 += mq135_sensor.getRZero_CO2();
        RZero2 += mq135_sensor.getRZero_CO();
      }
      RZero1 /= 50;
      RZero2 /= 50; 
}

// Hàm khởi tạo MQ135
void initMQ135(int pin) {
    MQ135_PIN = pin;
    mq135_sensor = MQ135(pin); 
    Serial.println("MQ135 initialized on pin: " + String( MQ135_PIN));
    updateRZero();
    
}

// Hàm đọc giá trị CO2 từ cảm biến
float readCO2() {
    float co2 =  mq135_sensor.getPPM_CO2(RZero1); // Đọc nồng độ CO2
    Serial.println("CO2 Concentration: " + String(co2) + " ppm");
    return co2;
}

// Hàm đọc nồng độ khí theo đơn vị PPM
float readPPM() {
    float ppm =  mq135_sensor.getPPM_CO(RZero2); // Lấy chỉ số RZero
    Serial.println("Gas Concentration (PPM): " + String(ppm));
    return ppm;
}
