require('react-native-gesture-handler/jestSetup');

process.env.EXPO_OS = 'ios';
process.env.EXPO_PUBLIC_API_BASE_URL = 'http://localhost:4000';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

jest.mock('@expo/vector-icons', () => {
  const React = require('react');
  const { Text } = require('react-native');
  const Icon = ({ name }) => React.createElement(Text, null, name);
  Icon.glyphMap = {};

  return {
    FontAwesome: Icon,
    MaterialCommunityIcons: Icon,
  };
});
