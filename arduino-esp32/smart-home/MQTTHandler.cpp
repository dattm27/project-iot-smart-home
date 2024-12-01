#include "MQTTHandler.h"

// Cấu hình MQTT Broker
const char* mqtt_server = "192.168.1.4"; // Không sử dụng "mqtt://"
const char* mqtt_username = "dattran";
const char* mqtt_password = "Dattran2";
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

                // Subscribe vào topic mong muốn
                client.subscribe("lights/01"); // Sửa thành topic bạn cần
                Serial.println("Subscribed to topic: test/topic");
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

// Hàm publish tin nhắn MQTT
void publishMessage(const char* topic, String payload, boolean retained) {
    if (client.publish(topic, payload.c_str(), retained)) {
        Serial.println("Message published [" + String(topic) + "]: " + payload);
    } else {
        Serial.println("Publish failed");
    }
}
