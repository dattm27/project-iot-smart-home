import { API_BASE_URL } from './config';

type ApiOptions = RequestInit & {
  token?: string | null;
};

export const apiUrl = (path: string) => `${API_BASE_URL}${path}`;

export const apiFetch = async (path: string, options: ApiOptions = {}) => {
  const { token, headers, ...fetchOptions } = options;
  const response = await fetch(apiUrl(path), {
    ...fetchOptions,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
  });

  if (!response.ok) {
    let message = `HTTP error! Status: ${response.status}`;

    try {
      const body = await response.json();
      message = body.error || body.message || message;
    } catch {
      // Keep the status-based message when the server does not return JSON.
    }

    throw new Error(message);
  }

  return response;
};
