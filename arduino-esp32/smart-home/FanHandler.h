#ifndef FAN_HANDLER_H
#define FAN_HANDLER_H

#include <Arduino.h>

// Hàm khởi tạo quạt
void initFan(int inaPin, int inbPin);

// Hàm bật/tắt quạt
void turnFanOn();
void turnFanOff();

// Hàm kiểm tra trạng thái quạt
bool isFanOn();

#endif // FAN_HANDLER_H
