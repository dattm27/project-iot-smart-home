#include "MQTTHandler.h"
#include <ArduinoJson.h>
//Fan 
#define INA 25
#define INB 26
#define LED_1 5
#define BUZZER_PIN 13
// Cấu hình MQTT Broker
//const char* mqtt_server = "192.168.1.4"; // Không sử dụng "mqtt://"
//const char* mqtt_username = "dattran";
//const char* mqtt_password = "Dattran2";
//const int mqtt_port = 8883; // Mosquitto port mặc định
const char* mqtt_server = "u7bf1cb3.ala.asia-southeast1.emqxsl.com";
const char* mqtt_username = "esp32-main";
const char* mqtt_password = "Son04072000";
const int mqtt_port = 8883;
const char* LIGHT_SERVER_TOPIC = "lights/01/server";
const char* FAN_SERVER_TOPIC = "fans/01/server";
const char* LIGHT_BUTTON_TOPIC = "lights/01/button";
const char* FAN_BUTTON_TOPIC = "fans/01/button";
const char* LIGHT_SENSOR_TOPIC = "lights/01/sensor";
const char* LIGHT_SENSOR_CONTROL_TOPIC = "lights/01/sensorControl";

bool autoLightEnabled = true;

static const char* root_ca PROGMEM = R"EOF(
-----BEGIN CERTIFICATE-----
MIIDjjCCAnagAwIBAgIQAzrx5qcRqaC7KGSxHQn65TANBgkqhkiG9w0BAQsFADBh
MQswCQYDVQQGEwJVUzEVMBMGA1UEChMMRGlnaUNlcnQgSW5jMRkwFwYDVQQLExB3
d3cuZGlnaWNlcnQuY29tMSAwHgYDVQQDExdEaWdpQ2VydCBHbG9iYWwgUm9vdCBH
MjAeFw0xMzA4MDExMjAwMDBaFw0zODAxMTUxMjAwMDBaMGExCzAJBgNVBAYTAlVT
MRUwEwYDVQQKEwxEaWdpQ2VydCBJbmMxGTAXBgNVBAsTEHd3dy5kaWdpY2VydC5j
b20xIDAeBgNVBAMTF0RpZ2lDZXJ0IEdsb2JhbCBSb290IEcyMIIBIjANBgkqhkiG
9w0BAQEFAAOCAQ8AMIIBCgKCAQEAuzfNNNx7a8myaJCtSnX/RrohCgiN9RlUyfuI
2/Ou8jqJkTx65qsGGmvPrC3oXgkkRLpimn7Wo6h+4FR1IAWsULecYxpsMNzaHxmx
1x7e/dfgy5SDN67sH0NO3Xss0r0upS/kqbitOtSZpLYl6ZtrAGCSYP9PIUkY92eQ
q2EGnI/yuum06ZIya7XzV+hdG82MHauVBJVJ8zUtluNJbd134/tJS7SsVQepj5Wz
tCO7TG1F8PapspUwtP1MVYwnSlcUfIKdzXOS0xZKBgyMUNGPHgm+F6HmIcr9g+UQ
vIOlCsRnKPZzFBQ9RnbDhxSJITRNrw9FDKZJobq7nMWxM4MphQIDAQABo0IwQDAP
BgNVHRMBAf8EBTADAQH/MA4GA1UdDwEB/wQEAwIBhjAdBgNVHQ4EFgQUTiJUIBiV
5uNu5g/6+rkS7QYXjzkwDQYJKoZIhvcNAQELBQADggEBAGBnKJRvDkhj6zHd6mcY
1Yl9PMWLSn/pvtsrF9+wX3N3KjITOYFnQoQj8kVnNeyIv/iPsGEMNKSuIEyExtv4
NeF22d+mQrvHRAiGfzZ0JFrabA0UWTW98kndth/Jsw1HKj2ZL7tcu7XUIOGZX1NG
Fdtom/DzMNU+MeKNhJ7jitralj41E6Vf8PlwUHBHQRFXGU7Aj64GxJUTFy8bJZ91
8rGOmaFvE7FBcf6IKshPECBV1/MUReXgRPTqh5Uykw7+U0b6LJ3/iyK5S9kJRaTe
pLiaWN0bfVKfjllDiIGknibVb63dDcY3fe0Dkhvld1927jyNxF1WW6LZZm6zNTfl
MrY=
-----END CERTIFICATE-----
)EOF";

// MQTT client và WiFi client
//WiFiClient espClient; // Không dùng WiFiClientSecure
WiFiClientSecure espClient;
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

    if (String(topic) == LIGHT_SENSOR_CONTROL_TOPIC) {
        if (doc.containsKey("enabled")) {
            int enabled = doc["enabled"];
            autoLightEnabled = (enabled != 0);
            Serial.println(autoLightEnabled ? "Auto light control ENABLED" : "Auto light control DISABLED");
        }
    }

    if (String(topic) == LIGHT_SERVER_TOPIC) {
        digitalWrite(BUZZER_PIN, HIGH);
        delay(100); // Kêu trong 100ms
        digitalWrite(BUZZER_PIN, LOW);
        int type = doc["type"]; // Lấy giá trị "type" từ JSON
        if (type == 1) {
            ledState = HIGH;
            digitalWrite(LED_1, ledState);
            Serial.println("Light turned ON");
        } else if (type == 0) {
            ledState = LOW;
            digitalWrite(LED_1, ledState);
            Serial.println("Light turned OFF");
        } else {
            Serial.println("Unknown type value");
        }
    }
}


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

    // Đồng bộ thời gian hệ thống (bắt buộc để xác thực chứng chỉ TLS của HiveMQ)
    configTime(7 * 3600, 0, "pool.ntp.org", "time.nist.gov");
    Serial.print("Waiting for NTP time sync...");
    time_t nowSecs = time(nullptr);
    while (nowSecs < 8 * 3600 * 2) {
        delay(500);
        Serial.print(".");
        nowSecs = time(nullptr);
    }
    Serial.println(" done, current time: " + String(nowSecs));

    // Cấu hình MQTT
    espClient.setCACert(root_ca);
    client.setServer(mqtt_server, mqtt_port); // Cấu hình server MQTT
    client.setCallback(callback);            // Cấu hình callback
}


void handleMQTT() {
    if (!client.connected()) {
        while (!client.connected()) {
            Serial.print("Attempting MQTT connection...");
            String clientId = "ESP32Client-" + String(random(0xffff), HEX);
            if (client.connect(clientId.c_str(), mqtt_username, mqtt_password)) {
                Serial.println("connected!");
                client.subscribe(LIGHT_SERVER_TOPIC);
                 client.subscribe(FAN_SERVER_TOPIC);
                client.subscribe(LIGHT_SENSOR_CONTROL_TOPIC);
                Serial.println("Subscribed to topic: lights/01");
                Serial.println("Subscribed to topic: fans/01");
                Serial.println("Subscribed to topic: lights/01/sensorControl");
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

String genAirQualityStatusMsg(String currentTime, float ppm) {
    String jsonPayload = "{ \"time\": \"" + currentTime + "\", \"ppm\": \"" + String(ppm) + "\" }";
    return jsonPayload;
}

String genDHTStatusMsg(String currentTime, float temp, float humidity) {
    String jsonPayload = "{ \"time\": \"" + currentTime + "\", \"temp\": " + String(temp) + ", \"humidity\": " + String(humidity) + " }";
    return jsonPayload;
}

void genLightMsg(String status){
    Serial.println("Generate Fan Msg");
    String jsonPayload = "{\"status\": \"" + status + "\" }";
     publishMessage(LIGHT_BUTTON_TOPIC, jsonPayload, true);
}

void genLightSensorMsg(String status){
    String jsonPayload = "{\"status\": \"" + status + "\" }";
    publishMessage(LIGHT_SENSOR_TOPIC, jsonPayload, true);
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
