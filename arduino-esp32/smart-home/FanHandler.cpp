#include "FanHandler.h"

static int INA_PIN = -1;
static int INB_PIN = -1;
static bool fanState = false;

void initFan(int inaPin, int inbPin) {
    INA_PIN = inaPin;
    INB_PIN = inbPin;
    pinMode(INA_PIN, OUTPUT);
    pinMode(INB_PIN, OUTPUT);
    turnFanOn(); // Tắt quạt ban đầu
}

void turnFanOn() {
    if (INA_PIN != -1 && INB_PIN != -1) {
        digitalWrite(INA_PIN, HIGH);
        digitalWrite(INB_PIN, LOW);
        fanState = true;
    }
}

void turnFanOff() {
    if (INA_PIN != -1 && INB_PIN != -1) {
        digitalWrite(INA_PIN, LOW);
        digitalWrite(INB_PIN, LOW);
        fanState = false;
    }
}

bool isFanOn() {
    return fanState;
}
