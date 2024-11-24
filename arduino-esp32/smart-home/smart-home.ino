#include <MQ135.h>
#include <DHT.h>

#include <WiFi.h>
#include <WiFiUdp.h>

#include <NTPClient.h>
#define PIN_MQ135 32
#define DHT_PIN 15
#define DHTTYPE DHT22
DHT dht(DHT_PIN, DHTTYPE);
MQ135 mq135_sensor(PIN_MQ135);

const char *ssid     = "THANG_5G";
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

  // Kết nối WiFi
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(1000);
    Serial.println("Connecting to WiFi...");
  }

  Serial.println("Connected to WiFi");

  // Cập nhật thời gian từ NTP
  timeClient.begin();
  timeClient.update();
  unsigned long epochTime = timeClient.getEpochTime();

  // Chuyển đổi epoch sang ngày giờ
  unsigned long currentSecond = epochTime % 60;
  unsigned long currentMinute = (epochTime / 60) % 60;
  unsigned long currentHour = (epochTime / 3600 + 7) % 24; // GMT+7
  unsigned int currentDay = (epochTime / 86400) % 30 + 1;  // Đơn giản hóa, chưa xử lý số ngày/tháng chính xác

  Serial.printf("Time: %02lu:%02lu:%02lu\n", currentHour, currentMinute, currentSecond);
}
void loop() {
  // put your main code here, to run repeatedly:

}
