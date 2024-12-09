import React, { useState } from 'react';
import { View, Text, FlatList, StyleSheet, Switch, Alert } from 'react-native';

const SERVER_URL = 'http://192.168.1.4:4000'; // Replace with your actual server URL

const sendMessage = async (deviceName: string, type: number) => {
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
};

const DevicesPage: React.FC = ({ route }: any) => {
  const { room } = route.params; // Get room name from navigation params
  const devices = [
    { name: 'Light1', state: false },
    { name: 'Light2', state: true },
    { name: 'Light3', state: false },
  ]; // Replace with actual devices for the room
  const [deviceStates, setDeviceStates] = useState(devices);

  const toggleDevice = (deviceName: string, currentState: boolean) => {
    const newType = currentState ? 0 : 1; // Toggle state
    sendMessage(deviceName, newType);
    setDeviceStates((prevStates) =>
      prevStates.map((device) =>
        device.name === deviceName ? { ...device, state: !currentState } : device
      )
    );
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
          </View>
        )}
        contentContainerStyle={styles.deviceGrid}
      />
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
});

export default DevicesPage;
