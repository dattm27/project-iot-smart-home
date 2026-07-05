const apiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL;

if (!apiBaseUrl) {
  console.warn('Missing EXPO_PUBLIC_API_BASE_URL in .env');
}

export const API_BASE_URL = apiBaseUrl || '';
