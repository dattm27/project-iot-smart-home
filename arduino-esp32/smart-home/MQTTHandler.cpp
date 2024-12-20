#include "MQTTHandler.h"
#include <ArduinoJson.h>
//Fan 
#define INA 25
#define INB 26
#define LED_1 5
#define BUZZER_PIN 13
// Cấu hình MQTT Broker
const char* mqtt_server = "192.168.1.4"; // Không sử dụng "mqtt://"
const char* mqtt_username = "dattran";
const char* mqtt_password = "Dattran2";
const char* LIGHT_SERVER_TOPIC = "lights/01/server";
const char* FAN_SERVER_TOPIC = "fans/01/server";
const char* LIGHT_BUTTON_TOPIC = "lights/01/button";
const char* FAN_BUTTON_TOPIC = "fans/01/button";
const int mqtt_port = 1883; // Mosquitto port mặc định

// MQTT client và WiFi client
WiFiClient espClient; // Không dùng WiFiClientSecure
PubSubClient client(espClient);

// Hàm callback xử lý khi nhận tin nhắn MQTT
void callback(char* topic, byte* payload, unsigned int length) {
    String incomingMessage = "";
    for (int i = 0; i < length; i++) {
        incomingMessage += (char)payload[i];
    }
    Serial.println("Message arrived [" + String(topic) + "]: " + incomingMessage);
    
    // Parse JSON message
    StaticJsonDocument<200> doc; // Tạo tài liệu JSON với kích thước tối đa là 200 byte
    DeserializationError error = deserializeJson(doc, incomingMessage);

    if (error) {
        Serial.print("Failed to parse JSON: ");
        Serial.println(error.c_str());
        return;
    }

    // Kiểm tra topic và xử lý nếu là "lights/01"
    if (String(topic) == FAN_SERVER_TOPIC) {
        int type = doc["type"]; // Lấy giá trị "type" từ JSON
        digitalWrite(BUZZER_PIN, HIGH);
        delay(100); // Kêu trong 100ms
        digitalWrite(BUZZER_PIN, LOW);
        if (type == 1) {
            // Bật quạt
            digitalWrite(INA, HIGH);
            digitalWrite(INB, LOW);
            Serial.println("Fan turned ON");
        } else if (type == 0) {
            // Tắt quạt
            digitalWrite(INA, LOW);
            digitalWrite(INB, LOW);
            Serial.println("Fan turned OFF");
        } else {
            Serial.println("Unknown type value");
        }
    }

    if (String(topic) == LIGHT_SERVER_TOPIC) {
        digitalWrite(BUZZER_PIN, HIGH);
        delay(100); // Kêu trong 100ms
        digitalWrite(BUZZER_PIN, LOW);
        int type = doc["type"]; // Lấy giá trị "type" từ JSON
        if (type == 1) {
            digitalWrite(LED_1, HIGH); 
            Serial.println("Light turned ON");
        } else if (type == 0) {
            
            digitalWrite(LED_1, LOW); 
            Serial.println("Light turned OFF");
        } else {
            Serial.println("Unknown type value");
        }
    }
}

// Hàm khởi tạo MQTT và kết nối WiFi
void initMQTT(const char* ssid, const char* password) {
    // Kết nối WiFi
    Serial.print("Connecting to WiFi...");
    WiFi.mode(WIFI_STA);
    WiFi.begin(ssid, password);
    while (WiFi.status() != WL_CONNECTED) {
        delay(500);
        Serial.print(".");
    }
    Serial.println("\nWiFi connected!");
    Serial.println("IP Address: " + WiFi.localIP().toString());

    // Cấu hình MQTT
    client.setServer(mqtt_server, mqtt_port); // Cấu hình server MQTT
    client.setCallback(callback);            // Cấu hình callback
}

// Hàm xử lý vòng lặp MQTT
void handleMQTT() {
    if (!client.connected()) {
        while (!client.connected()) {
            Serial.print("Attempting MQTT connection...");
            String clientId = "ESP32Client-" + String(random(0xffff), HEX);
            if (client.connect(clientId.c_str(), mqtt_username, mqtt_password)) {
                Serial.println("connected!");
                client.subscribe(LIGHT_SERVER_TOPIC); 
                 client.subscribe(FAN_SERVER_TOPIC); 
                Serial.println("Subscribed to topic: lights/01");
                Serial.println("Subscribed to topic: fans/01");
            } else {
                Serial.print("failed, rc=");
                Serial.print(client.state());
                Serial.println(" try again in 5 seconds...");
                delay(5000);
            }
        }
    }
    client.loop();
}

String genAlarmMsg(String currentTime, String status) {
    String jsonPayload = "{ \"time\": \"" + currentTime + "\", \"status\": \"" + status + "\" }";
    return jsonPayload;
}

String genAirQualityStatusMsg(String currentTime,float CO2, float CO, float temp) { 
    String jsonPayload =  "{ \"time\": \"" + currentTime + "\", \"co2_ppm\": \"" + CO2 + "\" , \"co_ppm\": \"" + CO + "\" , \"temp\": \"" + temp + "\"}";
    return jsonPayload;
}

void genLightMsg(String status){
    Serial.println("Generate Fan Msg");
    String jsonPayload = "{\"status\": \"" + status + "\" }";
     publishMessage(LIGHT_BUTTON_TOPIC, jsonPayload, true);
}

void genFanMsg(String status){
    Serial.println("Generate Fan Msg");
    String jsonPayload = "{\"type\": \"" + status + "\" }";
    publishMessage(FAN_BUTTON_TOPIC, jsonPayload, true);
}

// Hàm publish tin nhắn MQTT
void publishMessage(const char* topic, String payload, boolean retained) {
    if (client.publish(topic, payload.c_str(), retained)) {
        Serial.println("Message published [" + String(topic) + "]: " + payload);
    } else {
        Serial.println("Publish failed");
    }
}
