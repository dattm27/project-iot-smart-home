import React, { useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  Switch,
  Alert,
  Button,
  Modal,
  Platform,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';

const SERVER_URL = 'http://192.168.1.4:4000'; // Replace with your actual server URL

const gmt7Offset = -420;

const formatToISOWithOffset = (date: Date, offset: number): string => {
  const offsetSign = offset >= 0 ? "+" : "-";
  const offsetHours = String(Math.abs(Math.floor(offset / 60))).padStart(2, '0');
  const offsetMinutes = String(Math.abs(offset % 60)).padStart(2, '0');

  const isoString = date.toISOString().slice(0, -1); // Get the UTC ISO string without 'Z'

  return `${isoString}${offsetSign}${offsetHours}:${offsetMinutes}`;
};

const sendMessage = async (deviceName: string, type: number) => {
  try {
    const response = await fetch(`${SERVER_URL}/lights/OnOff`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: deviceName,
        type: type,
      }),
    });
    if (response.ok) {
      Alert.alert('Success', `${deviceName} is now ${type === 1 ? 'On' : 'Off'}`);
    } else {
      throw new Error('Failed to update device');
    }
  } catch (error) {
    //Alert.alert('Error', error instanceof Error ? error.message : 'An unknown error occurred');
  }
};

const sendTimer = async (deviceName: string, timerData: TimerData) => {
  try {
    const response = await fetch(`${SERVER_URL}/lights/Timer/`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: "DEN_DUONG_2",
        timerEnabled: timerData.timerEnabled,
        autoOnTime: formatToISOWithOffset(timerData.autoOnTime, gmt7Offset), // Convert to ISO format
        autoOffTime: formatToISOWithOffset(timerData.autoOffTime, gmt7Offset), // Convert to ISO format
      }),
    });
    if (response.ok) {
      Alert.alert('Success', `Timer set for ${deviceName}`);
    } else {
      throw new Error('Failed to set timer');
    }
  } catch (error) {
    //Alert.alert('Error', error instanceof Error ? error.message : 'An unknown error occurred');
  }
};

interface TimerData {
  timerEnabled: boolean;
  autoOnTime: Date; // Use Date object
  autoOffTime: Date; // Use Date object
}

const DevicesPage: React.FC = ({ route }: any) => {
  const { room } = route.params; // Get room name from navigation params
  const devices = [
    { name: 'Light1', state: false },
    { name: 'Light2', state: true },
    { name: 'Light3', state: false },
  ]; // Replace with actual devices for the room
  const [deviceStates, setDeviceStates] = useState(devices);
  const [selectedDevice, setSelectedDevice] = useState<string | null>(null); // Track which device is being configured
  const [timerData, setTimerData] = useState<TimerData>({
    timerEnabled: false,
    autoOnTime: new Date(),
    autoOffTime: new Date(),
  });
  const [isTimerModalVisible, setIsTimerModalVisible] = useState(false);
  const [timePickerMode, setTimePickerMode] = useState<'autoOnTime' | 'autoOffTime' | null>(null);

  const toggleDevice = (deviceName: string, currentState: boolean) => {
    const newType = currentState ? 0 : 1; // Toggle state
    sendMessage(deviceName, newType);
    setDeviceStates((prevStates) =>
      prevStates.map((device) =>
        device.name === deviceName ? { ...device, state: !currentState } : device
      )
    );
  };

  const handleOpenTimerModal = (deviceName: string) => {
    setSelectedDevice(deviceName);
    setIsTimerModalVisible(true);
  };

  const handleTimeChange = (event: any, selectedTime?: Date) => {
    if (selectedTime) {
      setTimerData((prev) => ({
        ...prev,
        [timePickerMode!]: selectedTime,
      }));
    }
    setTimePickerMode(null); // Close picker
  };

  const handleSetTimer = () => {
    if (selectedDevice) {
      sendTimer(selectedDevice, timerData);
      setIsTimerModalVisible(false); // Close modal
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Active Devices</Text>
      <Text style={styles.roomTitle}>
        {deviceStates.length} devices in {room}
      </Text>
      <FlatList
        data={deviceStates}
        keyExtractor={(item, index) => index.toString()}
        numColumns={2}
        renderItem={({ item }) => (
          <View style={styles.deviceCard}>
            <Text style={styles.deviceName}>{item.name}</Text>
            <Switch
              value={item.state}
              onValueChange={() => toggleDevice(item.name, item.state)}
              thumbColor={item.state ? '#FF4081' : '#f4f4f4'}
              trackColor={{ false: '#767577', true: '#FFC1E3' }}
            />
            <Text style={styles.deviceState}>
              {item.state ? 'On' : 'Off'}
            </Text>
            <Button
              title="Set Timer"
              onPress={() => handleOpenTimerModal(item.name)}
              color="#FF4081"
            />
          </View>
        )}
        contentContainerStyle={styles.deviceGrid}
      />

      {/* Timer Modal */}
      <Modal visible={isTimerModalVisible} animationType="slide" transparent={true}>
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalHeader}>Set Timer for {selectedDevice}</Text>
            <View style={styles.timerRow}>
              <Text style={styles.timerLabel}>Auto On Time</Text>
              <Button
                title={timerData.autoOnTime.toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
                onPress={() => setTimePickerMode('autoOnTime')}
              />
            </View>
            <View style={styles.timerRow}>
              <Text style={styles.timerLabel}>Auto Off Time</Text>
              <Button
                title={timerData.autoOffTime.toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
                onPress={() => setTimePickerMode('autoOffTime')}
              />
            </View>
            <View style={styles.timerRow}>
              <Text style={styles.timerLabel}>Enable Timer</Text>
              <Switch
                value={timerData.timerEnabled}
                onValueChange={(value) =>
                  setTimerData((prev) => ({ ...prev, timerEnabled: value }))
                }
              />
            </View>
            <Button title="Set Timer" onPress={handleSetTimer} color="#4CAF50" />
            <Button
              title="Cancel"
              onPress={() => setIsTimerModalVisible(false)}
              color="#FF4081"
            />
          </View>
        </View>
      </Modal>

      {/* DateTime Picker */}
      {timePickerMode && (
        <DateTimePicker
          value={
            timePickerMode === 'autoOnTime'
              ? timerData.autoOnTime
              : timerData.autoOffTime
          }
          mode="time"
          is24Hour={true}
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={handleTimeChange}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1c1c1c',
    padding: 15,
  },
  header: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 5,
  },
  roomTitle: {
    fontSize: 16,
    color: '#bbb',
    marginBottom: 15,
  },
  deviceGrid: {
    justifyContent: 'space-between',
  },
  deviceCard: {
    flex: 1,
    margin: 10,
    backgroundColor: '#2c2c2c',
    borderRadius: 15,
    padding: 15,
    alignItems: 'center',
    maxWidth: '45%',
  },
  deviceName: {
    fontSize: 16,
    color: '#fff',
    marginBottom: 10,
  },
  deviceState: {
    fontSize: 14,
    color: '#bbb',
    marginTop: 10,
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  modalContent: {
    width: '90%',
    backgroundColor: '#2c2c2c',
    borderRadius: 15,
    padding: 20,
  },
  modalHeader: {
    fontSize: 18,
    color: '#fff',
    fontWeight: 'bold',
    marginBottom: 20,
  },
  timerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 10,
  },
  timerLabel: {
    fontSize: 16,
    color: '#bbb',
  },
});

export default DevicesPage;
