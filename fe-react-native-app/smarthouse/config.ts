const apiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL;
const defaultApiBaseUrl = 'https://project-iot-smart-home-api.onrender.com';

if (!apiBaseUrl) {
  console.warn(`Missing EXPO_PUBLIC_API_BASE_URL in .env, using ${defaultApiBaseUrl}`);
}

export const API_BASE_URL = apiBaseUrl || defaultApiBaseUrl;
