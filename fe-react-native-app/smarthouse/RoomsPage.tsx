import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

const RoomsPage: React.FC = ({ navigation }: any) => {
  const rooms = ['Living Room', 'Kitchen', 'Bedroom'];

  const goToDevices = (room: string) => {
    navigation.navigate('Devices', { room }); // Pass room name to DevicesPage
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Select a Room</Text>
      {rooms.map((room) => (
        <TouchableOpacity
          key={room}
          style={styles.roomButton}
          onPress={() => goToDevices(room)}
        >
          <Text style={styles.roomText}>{room}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  roomButton: {
    padding: 15,
    backgroundColor: '#007BFF',
    marginVertical: 10,
    borderRadius: 10,
    width: '80%',
    alignItems: 'center',
  },
  roomText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
});

export default RoomsPage;
