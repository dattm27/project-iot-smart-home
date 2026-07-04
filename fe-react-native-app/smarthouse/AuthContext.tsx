import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { apiFetch } from './api';

type User = {
  id: string;
  username: string;
  email?: string;
};

type AuthResponse = {
  token: string;
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
const USER_KEY = 'smarthouse.auth.user';

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const saveSession = async (auth: AuthResponse) => {
  await AsyncStorage.multiSet([
    [TOKEN_KEY, auth.token],
    [USER_KEY, JSON.stringify(auth.user)],
  ]);
};

export const AuthProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const restoreSession = async () => {
      try {
        const [[, savedToken], [, savedUser]] = await AsyncStorage.multiGet([
          TOKEN_KEY,
          USER_KEY,
        ]);

        setToken(savedToken);
        setUser(savedUser ? JSON.parse(savedUser) : null);
      } finally {
        setIsLoading(false);
      }
    };

    restoreSession();
  }, []);

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
    await AsyncStorage.multiRemove([TOKEN_KEY, USER_KEY]);
    setToken(null);
    setUser(null);
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
