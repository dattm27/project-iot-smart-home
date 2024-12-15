import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import HomePage from './HomePage';
import DevicesPage from './DevicesPage';
import RoomsPage from './RoomsPage'; 
import MonitorPage from './MonitorPage';

const Stack = createStackNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="Home">
        <Stack.Screen name="Home" component={HomePage} />
        <Stack.Screen name="Devices" component={DevicesPage} />
        <Stack.Screen name="Rooms" component={RoomsPage} /> 
        <Stack.Screen name="Monitoring" component={MonitorPage} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}