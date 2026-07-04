import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Alert, TouchableOpacity } from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { apiFetch } from './api';
import { useAuth } from './AuthContext';
import { RootParamList } from './types';

type HomePageNavigationProp = StackNavigationProp<RootParamList, 'Home'>;

const HomePage: React.FC = () => {
  const [notifications, setNotifications] = useState<string | null>(null);
  const navigation = useNavigation<HomePageNavigationProp>();
  const { logout, token, user } = useAuth();

  // Fetch notifications from the Express server
  const fetchNotifications = async () => {
    try {
      const response = await apiFetch('/fire-alarm', { token });

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
    fetchNotifications();

    const intervalId = setInterval(() => {
      fetchNotifications();
    }, 10000);

    return () => clearInterval(intervalId);
  }, [token]);

  return (
    <View style={styles.container}>
      <View style={styles.accountBar}>
        <Text style={styles.accountText}>Xin chào, {user?.username || 'user'}</Text>
        <TouchableOpacity onPress={logout} style={styles.logoutButton}>
          <Text style={styles.logoutText}>Đăng xuất</Text>
        </TouchableOpacity>
      </View>

      {/* Main buttons */}
      <View style={styles.buttonsContainer}>
        <View style={styles.row}>
          <TouchableOpacity
            style={styles.card}
            onPress={() => navigation.navigate('Rooms')}
          >
            <FontAwesome name="desktop" size={40} color="#fff" />
            <Text style={styles.buttonText}>Devices</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.card}
            onPress={() => navigation.navigate('Monitoring')}
          >
            <FontAwesome name="bar-chart" size={40} color="#fff" />
            <Text style={styles.buttonText}>Monitoring</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.row}>
          <TouchableOpacity
            style={styles.card}
            onPress={() => Alert.alert('Settings pressed')}
          >
            <FontAwesome name="cogs" size={40} color="#fff" />
            <Text style={styles.buttonText}>Settings</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.card}
            onPress={() => Alert.alert('Tools pressed')}
          >
            <FontAwesome name="wrench" size={40} color="#fff" />
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
  accountBar: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 6,
    paddingTop: 4,
    width: '100%',
  },
  accountText: {
    color: '#333',
    fontSize: 15,
    fontWeight: '600',
  },
  logoutButton: {
    backgroundColor: '#e53935',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  logoutText: {
    color: '#fff',
    fontWeight: '700',
  },
});

export default HomePage;
