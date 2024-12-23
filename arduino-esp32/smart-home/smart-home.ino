
#include <MQ135.h>
#include <DHT.h>

#include <WiFi.h>
#include <WiFiUdp.h>

#include <RTClib.h>
#include <NTPClient.h>

#include "MQTTHandler.h"
#include "MQ135Handler.h"
#include "FanHandler.h"
const char *sensor1_topic = "MQ135/FireAlarm";
const char *mqttStatistic = "MQ135/Statistics";

#define PIN_MQ135 32
#define DHT_PIN 15
#define BUZZER_PIN 13
#define DHTTYPE DHT22
#define BUTTON_LED_PIN 14
#define BUTTON_FAN_PIN 18
#define LED_1 5
#define INA 25
#define INB 26
#define LIGHT_SENSOR_PIN 33

#define DEBOUNCE_DELAY 200

DHT dht(DHT_PIN, DHTTYPE);
MQ135 mq135_sensor(PIN_MQ135);

unsigned long lastNotify = 0;
unsigned long lastAirQualityStatusUpdate = 0;
String fireAlarmStatus = "inactive";
unsigned long lastDebounceTime = 0;
unsigned long lastDebounceTime2 = 0;
int ledState = HIGH;

//const char *ssid = "La Thuy";
//const char *password = "hoilamchi";
 const char *ssid = "Đạt’s iPhone";
 const char *password = "datiphone";

const long utcOffsetInSeconds = 7 * 3600; // Hanoi timezone (GMT+7)

// Initiate UDP -> init timeClient
WiFiUDP ntpUDP;

// Initiate timeClient -> get current DateTime
NTPClient timeClient(ntpUDP, "pool.ntp.org", utcOffsetInSeconds);

void setup()
{
  pinMode(BUZZER_PIN, OUTPUT);
  pinMode(LIGHT_SENSOR_PIN, INPUT);
  pinMode(LED_1, OUTPUT);
  
  
  Serial.begin(115200);
  digitalWrite(BUZZER_PIN, LOW); 
  digitalWrite(LED_1, ledState);
  connectWifi();
  initMQTT(ssid, password); 
  dht.begin();
  initMQ135(PIN_MQ135);

  
  initFan(INA, INB); 
  turnFanOn(); 
 
}


void loop()
{

  handleMQTT(); 
  handleLightSensor();
  handleDHTSensor();
  handleLedButtonPressed();
  handleFanButtonPressed();
  handleSensorMQ135();
  updateAirqualityStatus(1000 * 20);

  delay(200);
}

void handleLedButtonPressed() {
  
  int ledButtonState = digitalRead(BUTTON_LED_PIN);
  if (debounce(BUTTON_LED_PIN, lastDebounceTime))
  {
    Serial.print("Button pressed");
    lastDebounceTime = millis();
    toggleBuzzer();
    toggleLight();
  }
}

void handleFanButtonPressed() {
  
  int fanButtonState = digitalRead(BUTTON_FAN_PIN);
  if (debounce(BUTTON_FAN_PIN, lastDebounceTime2))
  {
    lastDebounceTime2 = millis();
    toggleBuzzer();
    if (isFanOn())
    {
      turnFanOff();
      genFanMsg("0");
    }
    else
    {
      turnFanOn();
      genFanMsg("1");
    }
  }


}
void handleDHTSensor() {
    float h = dht.readHumidity();
    float t = dht.readTemperature();
    Serial.print("Temperature:");
    Serial.println(String(t));
    Serial.print("Humidity: ");
    Serial.println(String(h));
}
void handleLightSensor() {
    int lightLevel = analogRead(LIGHT_SENSOR_PIN);
   if ((lightLevel < 80) && (ledState == LOW) && (millis() - lastDebounceTime > 20000) ) {
      toggleLight();
      lastDebounceTime = millis();

   }

  Serial.print("Light level = ");
  Serial.println(lightLevel); 
}

void connectWifi()
{

  Serial.println("Connecting to WiFi...");
  WiFi.begin(ssid, password);
  unsigned long startAttemptTime = millis();

  while (WiFi.status() != WL_CONNECTED && (millis() - startAttemptTime) < 30000) //timeout: 30 seconds
  {
    delay(1000);
    Serial.print(".");
  }
  if (WiFi.status() == WL_CONNECTED)
  {
    Serial.println("\nConnected to WiFi");
    toggleBuzzer();
   
  }
  else
  {
    Serial.println("\nConnect failed");
  }

  if (WiFi.status() == WL_CONNECTED)
  {
    timeClient.begin();
    timeClient.update();
    Serial.println(getCurrentDateTime());
  }
}


void handleSensorMQ135()
{
  int ppm = analogRead(PIN_MQ135);
  Serial.print("Gas PPM: ");
  Serial.println(String(ppm));
  if ( ppm > 2000)
  {

    for (int i = 0; i < 10; i++)
    {
      toggleBuzzer();
    }

    if (fireAlarmStatus.equals("inactive") || !lastNotify)
    {
      fireAlarmStatus = "active";
      String currentDateTime = getCurrentDateTime();
      String alarmMsg = genAlarmMsg(currentDateTime, fireAlarmStatus);
      publishMessage(sensor1_topic, alarmMsg, true);
      lastNotify = millis();
    }
  }
  else
  {
    if (millis() - lastNotify > 1000 * 60)
    {
      fireAlarmStatus = "inactive";
      String currentDateTime = getCurrentDateTime();
      String alarmMsg = genAlarmMsg(currentDateTime, fireAlarmStatus);
      publishMessage(sensor1_topic, alarmMsg, true);
      lastNotify = millis();
    }
  }
}

void updateAirqualityStatus(long interval)
{

  if (millis() - lastAirQualityStatusUpdate > interval)
  {
    float CO2 = readCO2();
    float CO = readPPM();
    String currentDateTime = getCurrentDateTime();
    float t = dht.readTemperature();
    String airQualityUpdateMsg = genAirQualityStatusMsg(currentDateTime, CO2, CO, t);
    
    publishMessage(mqttStatistic, airQualityUpdateMsg, true);
    lastAirQualityStatusUpdate = millis();
  }
}

void toggleBuzzer() {
    digitalWrite(BUZZER_PIN, HIGH);
    delay(100);
    digitalWrite(BUZZER_PIN, LOW);
}

void toggleLight(){
    ledState = !ledState;        
    digitalWrite(LED_1, ledState); 
    genLightMsg(ledState == HIGH ? "1" : "0");
}

String getCurrentDateTime()
{
  timeClient.update();
  unsigned long epochTime = timeClient.getEpochTime();
  
  // Chuyển đổi thành DateTime
  DateTime now(epochTime);
  
  // In thời gian theo định dạng YYYY-MM-DD HH:MM:SS
  char formattedDateTime[20]; 
  snprintf(formattedDateTime, sizeof(formattedDateTime),
           "%04d-%02d-%02d %02d:%02d:%02d",
           now.year(), now.month(), now.day(),
           now.hour(), now.minute(), now.second());

  Serial.println("Thời gian hiện tại:");
  return formattedDateTime;
}


bool debounce(int pin, unsigned long &lastTime) {
    if (digitalRead(pin) == HIGH && (millis() - lastTime > DEBOUNCE_DELAY)) {
        lastTime = millis();
        return true;
    }
    return false;
}
