import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { apiFetch, apiUrl, configureAuthSession } from './api';

type User = {
  id: string;
  username: string;
  email?: string;
};

type AuthResponse = {
  token: string;
  refreshToken: string;
  user: User;
};

type AuthContextValue = {
  isLoading: boolean;
  token: string | null;
  user: User | null;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const TOKEN_KEY = 'smarthouse.auth.token';
const REFRESH_TOKEN_KEY = 'smarthouse.auth.refreshToken';
const USER_KEY = 'smarthouse.auth.user';

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const saveSession = async (auth: AuthResponse) => {
  await AsyncStorage.multiSet([
    [TOKEN_KEY, auth.token],
    [REFRESH_TOKEN_KEY, auth.refreshToken],
    [USER_KEY, JSON.stringify(auth.user)],
  ]);
};

export const AuthProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);

  const clearSession = useCallback(async () => {
    await AsyncStorage.multiRemove([TOKEN_KEY, REFRESH_TOKEN_KEY, USER_KEY]);
    setToken(null);
    setUser(null);
  }, []);

  const refreshSession = useCallback(async () => {
    const savedRefreshToken = await AsyncStorage.getItem(REFRESH_TOKEN_KEY);
    if (!savedRefreshToken) return null;

    try {
      const response = await fetch(apiUrl('/auth/refresh'), {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refreshToken: savedRefreshToken }),
      });

      if (!response.ok) {
        await clearSession();
        return null;
      }

      const auth: AuthResponse = await response.json();
      await saveSession(auth);
      setToken(auth.token);
      setUser(auth.user);
      return auth.token;
    } catch {
      return null;
    }
  }, [clearSession]);

  useEffect(() => {
    const restoreSession = async () => {
      try {
        const [[, savedToken], [, savedRefreshToken], [, savedUser]] = await AsyncStorage.multiGet([
          TOKEN_KEY,
          REFRESH_TOKEN_KEY,
          USER_KEY,
        ]);

        if (savedToken && savedUser) {
          setToken(savedToken);
          setUser(JSON.parse(savedUser));
        } else if (savedRefreshToken) {
          await refreshSession();
        }
      } finally {
        setIsLoading(false);
      }
    };

    restoreSession();
  }, [refreshSession]);

  useEffect(() => {
    configureAuthSession({
      refresh: refreshSession,
      onUnauthorized: clearSession,
    });
  }, [clearSession, refreshSession]);

  const login = async (username: string, password: string) => {
    const response = await apiFetch('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    const auth: AuthResponse = await response.json();

    await saveSession(auth);
    setToken(auth.token);
    setUser(auth.user);
  };

  const register = async (username: string, email: string, password: string) => {
    const response = await apiFetch('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, email, password }),
    });
    const auth: AuthResponse = await response.json();

    await saveSession(auth);
    setToken(auth.token);
    setUser(auth.user);
  };

  const logout = async () => {
    const savedRefreshToken = await AsyncStorage.getItem(REFRESH_TOKEN_KEY);
    if (savedRefreshToken) {
      try {
        await apiFetch('/auth/logout', {
          method: 'POST',
          body: JSON.stringify({ refreshToken: savedRefreshToken }),
          skipAuthRefresh: true,
        });
      } catch {
        // Local logout still succeeds when the network is unavailable.
      }
    }

    await clearSession();
  };

  const value = useMemo(
    () => ({ isLoading, token, user, login, register, logout }),
    [isLoading, token, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider');
  }

  return context;
};
