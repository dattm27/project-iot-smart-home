import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Alert, TouchableOpacity } from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome'; // Correct import for FontAwesome icons
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootParamList } from './types';

type HomePageNavigationProp = StackNavigationProp<RootParamList, 'Home'>;

const HomePage: React.FC = () => {
  const [notifications, setNotifications] = useState<string | null>(null);
  const navigation = useNavigation<HomePageNavigationProp>();

  const SERVER_URL = 'http://192.168.1.4:4000'; // Replace with your server's IP

  // Fetch notifications from the Express server
  const fetchNotifications = async () => {
    try {
      const response = await fetch(`${SERVER_URL}/fire-alarm`);
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }

      const data = await response.json();
      console.log('Fetched data:', data);

      const message = data.isFire ? 'Fire detected!' : 'No fire detected.';
      setNotifications(message);

      if (message === 'Fire detected!') Alert.alert('New Notification', message);
    } catch (error) {
      console.error('Error fetching notifications:', error);
      Alert.alert('Error', 'Failed to fetch notifications');
    }
  };

  // Polling the server every 10 seconds
  useEffect(() => {
    const intervalId = setInterval(() => {
      fetchNotifications();
    }, 10000);

    return () => clearInterval(intervalId);
  }, []);

  return (
    <View style={styles.container}>
      {/* Main buttons */}
      <View style={styles.buttonsContainer}>
        <View style={styles.row}>
          <TouchableOpacity
            style={styles.card}
            onPress={() => navigation.navigate('Rooms')}
          >
            <Icon name="desktop" size={40} color="#fff" />  {/* Changed to use FontAwesome icons */}
            <Text style={styles.buttonText}>Devices</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.card}
            onPress={() => Alert.alert('Monitoring pressed')}
          >
            <Icon name="bar-chart" size={40} color="#fff" />  {/* Changed to use FontAwesome icons */}
            <Text style={styles.buttonText}>Monitoring</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.row}>
          <TouchableOpacity
            style={styles.card}
            onPress={() => Alert.alert('Settings pressed')}
          >
            <Icon name="cogs" size={40} color="#fff" />
            <Text style={styles.buttonText}>Settings</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.card}
            onPress={() => Alert.alert('Tools pressed')}
          >
            <Icon name="wrench" size={40} color="#fff" />
            <Text style={styles.buttonText}>Tools</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Notifications area */}
      <View style={styles.notificationArea}>
        <Text style={styles.notificationText}>
          {notifications ? `Latest Notification: ${notifications}` : 'No new notifications'}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 10,
    backgroundColor: '#f4f4f4',
  },
  buttonsContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    width: '100%',
    marginVertical: 10,
  },
  card: {
    width: 150,
    height: 150,
    borderRadius: 10,
    padding: 10,
    margin: 10,
    backgroundColor: '#4CAF50',
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
    marginTop: 10,
  },
  notificationArea: {
    width: '100%',
    padding: 10,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderColor: '#ddd',
  },
  notificationText: {
    fontSize: 16,
    color: '#333',
    textAlign: 'center',
  },
});

export default HomePage;
