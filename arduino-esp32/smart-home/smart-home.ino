#include <MQ135.h>
#include <DHT.h>

#include <WiFi.h>
#include <WiFiUdp.h>

#include <RTClib.h>
#include <NTPClient.h>
#define PIN_MQ135 32
#define DHT_PIN 15
#define DHTTYPE DHT22
DHT dht(DHT_PIN, DHTTYPE);
MQ135 mq135_sensor(PIN_MQ135);

const char *ssid     = "THANG_2G";
const char *password = "0967240219";

const char* serverIP = "172.20.10.11";      // Server IP address
const uint16_t serverPort = 8000;           // Server port number

// Set Hanoi timezone (GMT+7)
const long utcOffsetInSeconds = 7 * 3600;

// Initiate UDP -> init timeClient
WiFiUDP ntpUDP;

//Initiate timeClient -> get current DateTime
NTPClient timeClient(ntpUDP, "pool.ntp.org", utcOffsetInSeconds);

void setup() {
  Serial.begin(115200);

  Serial.println("Connecting to WiFi...");

  WiFi.begin(ssid, password);

  // Thời gian chờ tối đa: 30 giây
  unsigned long startAttemptTime = millis();
  const unsigned long wifiTimeout = 30000; // 30 giây

  // Chờ kết nối WiFi
  while (WiFi.status() != WL_CONNECTED && (millis() - startAttemptTime) < wifiTimeout) {
    delay(1000);
    Serial.print(".");
  }

  // Kiểm tra kết quả kết nối
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\nConnected to WiFi");
  } else {
    Serial.println("\nConnect failed");
  }

  // Nếu đã kết nối WiFi, bắt đầu cập nhật thời gian
  if (WiFi.status() == WL_CONNECTED) {
   // Bắt đầu cập nhật thời gian từ NTP
    timeClient.begin();
    printCurrentDateTime();
  }
}
void loop() {
  // put your main code here, to run repeatedly:

}

void printCurrentDateTime(){
    timeClient.update();
    unsigned long epochTime = timeClient.getEpochTime();
  
    // Chuyển đổi thành DateTime
    DateTime now(epochTime);
 
    // In thời gian theo định dạng YYYY-MM-DD HH:MM:SS
  char formattedDateTime[20]; // Chuỗi đủ dài để chứa định dạng
  snprintf(formattedDateTime, sizeof(formattedDateTime), 
           "%04d-%02d-%02d %02d:%02d:%02d",
           now.year(), now.month(), now.day(),
           now.hour(), now.minute(), now.second());

  Serial.println("Thời gian hiện tại:");
  Serial.println(formattedDateTime);
  
}
