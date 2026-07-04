import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { AuthProvider, useAuth } from './AuthContext';
import HomePage from './HomePage';
import DevicesPage from './DevicesPage';
import RoomsPage from './RoomsPage'; 
import MonitorPage from './MonitorPage';
import LoginPage from './LoginPage';
import RegisterPage from './RegisterPage';

const Stack = createStackNavigator();

function RootNavigator() {
  const { isLoading, token } = useAuth();

  if (isLoading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color="#2e7d32" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerTitleAlign: 'center' }}>
        {token ? (
          <>
            <Stack.Screen name="Home" component={HomePage} />
            <Stack.Screen name="Devices" component={DevicesPage} />
            <Stack.Screen name="Rooms" component={RoomsPage} />
            <Stack.Screen name="Monitoring" component={MonitorPage} />
          </>
        ) : (
          <>
            <Stack.Screen name="Login" component={LoginPage} options={{ headerShown: false }} />
            <Stack.Screen name="Register" component={RegisterPage} options={{ headerShown: false }} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <RootNavigator />
    </AuthProvider>
  );
}
