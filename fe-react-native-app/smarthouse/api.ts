import { API_BASE_URL } from './config';

type ApiOptions = RequestInit & {
  token?: string | null;
  skipAuthRefresh?: boolean;
};

export const apiUrl = (path: string) => `${API_BASE_URL}${path}`;

let refreshAccessToken: (() => Promise<string | null>) | null = null;
let handleUnauthorized: (() => Promise<void>) | null = null;

export const configureAuthSession = ({
  refresh,
  onUnauthorized,
}: {
  refresh: () => Promise<string | null>;
  onUnauthorized: () => Promise<void>;
}) => {
  refreshAccessToken = refresh;
  handleUnauthorized = onUnauthorized;
};

const requestWithToken = async (path: string, fetchOptions: RequestInit, token?: string | null) =>
  fetch(apiUrl(path), {
    ...fetchOptions,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...fetchOptions.headers,
    },
  });

export const apiFetch = async (path: string, options: ApiOptions = {}) => {
  const { token, headers, skipAuthRefresh, ...fetchOptions } = options;
  const requestOptions = { ...fetchOptions, headers };
  let response = await requestWithToken(path, requestOptions, token);

  if (response.status === 401 && token && !skipAuthRefresh && refreshAccessToken) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      response = await requestWithToken(path, requestOptions, newToken);
    } else if (handleUnauthorized) {
      await handleUnauthorized();
    }
  }

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
