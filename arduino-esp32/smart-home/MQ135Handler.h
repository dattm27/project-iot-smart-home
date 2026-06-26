#ifndef MQ135_HANDLER_H
#define MQ135_HANDLER_H

#include <Arduino.h>
#include <MQ135.h>

// Cấu hình chân cảm biến
extern int MQ135_PIN;

// Khởi tạo cảm biến
void initMQ135(int pin);

// Đọc giá trị nồng độ khí từ cảm biến
float readCO2();

// Đọc nồng độ khí cụ thể theo phần trăm
float readPPM();

#endif // MQ135_HANDLER_H
