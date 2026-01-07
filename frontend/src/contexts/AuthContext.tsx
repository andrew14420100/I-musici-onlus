import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { Platform } from 'react-native';
import { User, UserRole } from '../types';
import { authApi, seedApi } from '../services/api';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const processSessionId = async (sessionId: string) => {
    try {
      console.log('Processing session ID...');
      const response = await authApi.exchangeSession(sessionId);
      
      if (response.session_token) {
        await AsyncStorage.setItem('session_token', response.session_token);
        setUser(response.user);
        
        // Seed database with sample data
        try {
          await seedApi.seed();
          console.log('Database seeded');
        } catch (e) {
          console.log('Seed skipped or already done');
        }
      }
    } catch (error) {
      console.error('Error processing session:', error);
    }
  };

  const checkExistingSession = async () => {
    try {
      const token = await AsyncStorage.getItem('session_token');
      if (token) {
        const userData = await authApi.getMe();
        setUser(userData);
      }
    } catch (error) {
      console.log('No existing session');
      await AsyncStorage.removeItem('session_token');
    }
  };

  useEffect(() => {
    const init = async () => {
      setIsLoading(true);
      
      // Check for session_id in URL (web)
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        const hash = window.location.hash;
        const sessionIdMatch = hash.match(/session_id=([^&]+)/);
        if (sessionIdMatch) {
          await processSessionId(sessionIdMatch[1]);
          window.history.replaceState({}, document.title, window.location.pathname);
        } else {
          await checkExistingSession();
        }
      } else {
        // Mobile: check for initial URL
        const initialUrl = await Linking.getInitialURL();
        if (initialUrl) {
          const sessionIdMatch = initialUrl.match(/session_id=([^&]+)/);
          if (sessionIdMatch) {
            await processSessionId(sessionIdMatch[1]);
          } else {
            await checkExistingSession();
          }
        } else {
          await checkExistingSession();
        }
      }
      
      setIsLoading(false);
    };

    init();
  }, []);

  const login = async () => {
    const redirectUrl = Platform.OS === 'web'
      ? `${BACKEND_URL}/`
      : Linking.createURL('/');
    
    const authUrl = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
    
    if (Platform.OS === 'web') {
      window.location.href = authUrl;
    } else {
      const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUrl);
      
      if (result.type === 'success' && result.url) {
        const sessionIdMatch = result.url.match(/session_id=([^&]+)/);
        if (sessionIdMatch) {
          setIsLoading(true);
          await processSessionId(sessionIdMatch[1]);
          setIsLoading(false);
        }
      }
    }
  };

  const logout = async () => {
    try {
      await authApi.logout();
    } catch (error) {
      console.error('Logout error:', error);
    }
    await AsyncStorage.removeItem('session_token');
    setUser(null);
  };

  const refreshUser = async () => {
    try {
      const userData = await authApi.getMe();
      setUser(userData);
    } catch (error) {
      console.error('Error refreshing user:', error);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
