
#include <MQ135.h>
#include <DHT.h>

#include <WiFi.h>
#include <WiFiUdp.h>

#include <RTClib.h>
#include <NTPClient.h>

#include "MQTTHandler.h"
#include "MQ135Handler.h"
const char* sensor1_topic = "MQ135/FireAlarm";


#define PIN_MQ135 32
#define DHT_PIN 15
#define BUZZER_PIN 13
#define DHTTYPE DHT22
#define BUTTON_PIN 14
#define LED_1 5
DHT dht(DHT_PIN, DHTTYPE);

MQ135 mq135_sensor(PIN_MQ135);
unsigned long lastNotify = 0;


//const char *ssid     = "GOCVUONG";
//const char *password = "chinmuoido";
const char *ssid = "THANG_2G";
const char *password = "0967240219";
const long utcOffsetInSeconds = 7 * 3600; //Hanoi timezone (GMT+7)


int ledState = HIGH;
 
        
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
    timeClient.update();
    Serial.println(getCurrentDateTime());
  }

  initMQTT(ssid, password); // Khởi tạo MQTT  

  
   dht.begin();
   initMQ135(PIN_MQ135);

    // Thiết lập chân buzzer
    pinMode(BUZZER_PIN, OUTPUT);
    digitalWrite(BUZZER_PIN, LOW); // Tắt buzzer ban đầu
    pinMode(LED_1 , OUTPUT);
    digitalWrite(LED_1 , ledState); //bật đèn ban đầu

  
}
void loop() {
 
    handleMQTT(); // Xử lý MQTT
    //Chống nhảy phím
    unsigned long lastDebounceTime = 0;
    const unsigned long debounceDelay = 200;

     int buttonState = digitalRead(BUTTON_PIN);
      if (buttonState == HIGH && (millis() - lastDebounceTime > debounceDelay)) {
        lastDebounceTime = millis();
        // Buzzer kêu
        digitalWrite(BUZZER_PIN, HIGH);
        delay(100); // Kêu trong 100ms
        digitalWrite(BUZZER_PIN, LOW);

        // Đổi trạng thái LED
        ledState = !ledState; // Toggle trạng thái
        digitalWrite(LED_1, ledState); // Cập nhật trạng thái LED
        
      } 

    float h = dht.readHumidity();
    float t = dht.readTemperature();
    Serial.print("Temperature:"); 
    Serial.println(String(t));
    Serial.print("Humidity: ");
    Serial.println(String(h)); 

    readCO2();

    readPPM();
    
    Serial.print("Gas PPM: "); 
    Serial.println(String(analogRead(PIN_MQ135)));
    FireAlarmCheck();

    
    
    
  delay(200); 
}

void FireAlarmCheck(){
  // Đọc giá trị từ cảm biến MQ135
   if ( analogRead(PIN_MQ135) > 2000){

        //keu coi 10 lan
        for(int i = 0 ; i< 10 ; i++ ) {
           digitalWrite(BUZZER_PIN, HIGH);
           delay(100); // Kêu trong 100ms
           digitalWrite(BUZZER_PIN, LOW);
        }

        if ( (millis() - lastNotify > 1000*60 )|| !lastNotify ) {
          
          // Hàm bạn đã viết
          String status = "active";
          String currentDateTime = getCurrentDateTime();
          String alarmMsg = genAlarmMsg(currentDateTime, status);
      
          publishMessage(sensor1_topic, alarmMsg, true);
          lastNotify = millis();
        }
       
   }
   else {
      if ( millis() - lastNotify > 1000*60) {
          
          // Hàm bạn đã viết
          String status = "inactive";
          String currentDateTime = getCurrentDateTime();
          String alarmMsg = genAlarmMsg(currentDateTime, status);
      
          publishMessage(sensor1_topic, alarmMsg, true);
          lastNotify = millis();
      }
   }
}


String getCurrentDateTime(){
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
  return formattedDateTime;
}
