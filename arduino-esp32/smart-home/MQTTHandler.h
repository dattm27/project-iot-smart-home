#ifndef MQTT_HANDLER_H
#define MQTT_HANDLER_H

#include <WiFi.h>
#include <PubSubClient.h>
#include <WiFiClientSecure.h>

// Định nghĩa các biến cấu hình MQTT
extern const char* mqtt_server;
extern const char* mqtt_username;
extern const char* mqtt_password;
extern const int mqtt_port;

// Hàm khởi tạo và quản lý MQTT
void initMQTT(const char* ssid, const char* password);
void publishMessage(const char* topic, String payload, boolean retained);
void handleMQTT();
String genAlarmMsg(String currentTime, String status) ;
void genLightMsg(String status);
void genFanMsg(String status);
String genAirQualityStatusMsg(String currentTime,float CO2, float CO, float temp) ;
#endif // MQTT_HANDLER_H
