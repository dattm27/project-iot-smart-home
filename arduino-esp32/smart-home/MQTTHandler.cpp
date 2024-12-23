#include "MQTTHandler.h"
#include <ArduinoJson.h>
//Fan 
#define INA 25
#define INB 26
#define LED_1 5
#define BUZZER_PIN 13
// Cấu hình MQTT Broker
const char* mqtt_server = "172.20.10.7"; // Không sử dụng "mqtt://"
const char* mqtt_username = "dattran";
const char* mqtt_password = "Dattran2";
const int mqtt_port = 1883; // Mosquitto port mặc định
//const char* mqtt_server = "c509d576b5cb44a0ac951816712cb591.s1.eu.hivemq.cloud";
//const char* mqtt_username = "dattran";
//const char* mqtt_password = "Dattran2";
//const int mqtt_port = 8883;
const char* LIGHT_SERVER_TOPIC = "lights/01/server";
const char* FAN_SERVER_TOPIC = "fans/01/server";
const char* LIGHT_BUTTON_TOPIC = "lights/01/button";
const char* FAN_BUTTON_TOPIC = "fans/01/button";

static const char* root_ca PROGMEM = R"EOF(
-----BEGIN CERTIFICATE-----
MIIFazCCA1OgAwIBAgIRAIIQz7DSQONZRGPgu2OCiwAwDQYJKoZIhvcNAQELBQAw
TzELMAkGA1UEBhMCVVMxKTAnBgNVBAoTIEludGVybmV0IFNlY3VyaXR5IFJlc2Vh
cmNoIEdyb3VwMRUwEwYDVQQDEwxJU1JHIFJvb3QgWDEwHhcNMTUwNjA0MTEwNDM4
WhcNMzUwNjA0MTEwNDM4WjBPMQswCQYDVQQGEwJVUzEpMCcGA1UEChMgSW50ZXJu
ZXQgU2VjdXJpdHkgUmVzZWFyY2ggR3JvdXAxFTATBgNVBAMTDElTUkcgUm9vdCBY
MTCCAiIwDQYJKoZIhvcNAQEBBQADggIPADCCAgoCggIBAK3oJHP0FDfzm54rVygc
h77ct984kIxuPOZXoHj3dcKi/vVqbvYATyjb3miGbESTtrFj/RQSa78f0uoxmyF+
0TM8ukj13Xnfs7j/EvEhmkvBioZxaUpmZmyPfjxwv60pIgbz5MDmgK7iS4+3mX6U
A5/TR5d8mUgjU+g4rk8Kb4Mu0UlXjIB0ttov0DiNewNwIRt18jA8+o+u3dpjq+sW
T8KOEUt+zwvo/7V3LvSye0rgTBIlDHCNAymg4VMk7BPZ7hm/ELNKjD+Jo2FR3qyH
B5T0Y3HsLuJvW5iB4YlcNHlsdu87kGJ55tukmi8mxdAQ4Q7e2RCOFvu396j3x+UC
B5iPNgiV5+I3lg02dZ77DnKxHZu8A/lJBdiB3QW0KtZB6awBdpUKD9jf1b0SHzUv
KBds0pjBqAlkd25HN7rOrFleaJ1/ctaJxQZBKT5ZPt0m9STJEadao0xAH0ahmbWn
OlFuhjuefXKnEgV4We0+UXgVCwOPjdAvBbI+e0ocS3MFEvzG6uBQE3xDk3SzynTn
jh8BCNAw1FtxNrQHusEwMFxIt4I7mKZ9YIqioymCzLq9gwQbooMDQaHWBfEbwrbw
qHyGO0aoSCqI3Haadr8faqU9GY/rOPNk3sgrDQoo//fb4hVC1CLQJ13hef4Y53CI
rU7m2Ys6xt0nUW7/vGT1M0NPAgMBAAGjQjBAMA4GA1UdDwEB/wQEAwIBBjAPBgNV
HRMBAf8EBTADAQH/MB0GA1UdDgQWBBR5tFnme7bl5AFzgAiIyBpY9umbbjANBgkq
hkiG9w0BAQsFAAOCAgEAVR9YqbyyqFDQDLHYGmkgJykIrGF1XIpu+ILlaS/V9lZL
ubhzEFnTIZd+50xx+7LSYK05qAvqFyFWhfFQDlnrzuBZ6brJFe+GnY+EgPbk6ZGQ
3BebYhtF8GaV0nxvwuo77x/Py9auJ/GpsMiu/X1+mvoiBOv/2X/qkSsisRcOj/KK
NFtY2PwByVS5uCbMiogziUwthDyC3+6WVwW6LLv3xLfHTjuCvjHIInNzktHCgKQ5
ORAzI4JMPJ+GslWYHb4phowim57iaztXOoJwTdwJx4nLCgdNbOhdjsnvzqvHu7Ur
TkXWStAmzOVyyghqpZXjFaH3pO3JLF+l+/+sKAIuvtd7u+Nxe5AW0wdeRlN8NwdC
jNPElpzVmbUq4JUagEiuTDkHzsxHpFKVK7q4+63SM1N95R1NbdWhscdCb+ZAJzVc
oyi3B43njTOQ5yOf+1CceWxG1bQVs5ZufpsMljq4Ui0/1lvh+wjChP4kqKOJ2qxq
4RgqsahDYVvTH9w7jXbyLeiNdd8XM2w9U/t7y0Ff/9yi0GE44Za4rF2LN9d11TPA
mRGunUHBcnWEvgJBQl9nJEiU0Zsnvgc/ubhPgXRR4Xq37Z0j4r7g1SgEEzwxA57d
emyPxgcYxn/eR44/KJ4EBs+lVDR3veyJm+kXQ99b21/+jh5Xos1AnX5iItreGCc=
-----END CERTIFICATE-----
)EOF";

// MQTT client và WiFi client
WiFiClient espClient; // Không dùng WiFiClientSecure
//WiFiClientSecure espClient;
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
    //espClient.setCACert(root_ca);
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
