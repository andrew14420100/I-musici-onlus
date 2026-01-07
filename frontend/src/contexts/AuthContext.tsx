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
  pendingAdminEmail: string | null;
  setPendingAdminEmail: (email: string | null) => void;
  loginWithCredentials: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  loginAdminPin: (email: string, pin: string) => Promise<{ success: boolean; needsGoogle?: boolean; error?: string }>;
  loginAdminGoogle: () => Promise<void>;
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
  const [pendingAdminEmail, setPendingAdminEmail] = useState<string | null>(null);

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

  // Handle Google callback for admin
  const processGoogleCallback = async (sessionId: string) => {
    const email = await AsyncStorage.getItem('pending_admin_email');
    if (!email) {
      console.error('No pending admin email');
      return;
    }

    try {
      const response = await authApi.adminGoogleVerify(email, sessionId);
      if (response.token) {
        await AsyncStorage.setItem('session_token', response.token);
        await AsyncStorage.removeItem('pending_admin_email');
        setUser(response.user);
        setPendingAdminEmail(null);
      }
    } catch (error) {
      console.error('Google verification failed:', error);
    }
  };

  useEffect(() => {
    const init = async () => {
      setIsLoading(true);
      
      // First seed the database
      try {
        await seedApi.seed();
      } catch (e) {
        // Ignore
      }

      // Check for session_id in URL (web) - for admin Google callback
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        const hash = window.location.hash;
        const sessionIdMatch = hash.match(/session_id=([^&]+)/);
        if (sessionIdMatch) {
          await processGoogleCallback(sessionIdMatch[1]);
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
            await processGoogleCallback(sessionIdMatch[1]);
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

  // Login for Students and Teachers (email + password)
  const loginWithCredentials = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const response = await authApi.login(email, password);
      if (response.token) {
        await AsyncStorage.setItem('session_token', response.token);
        setUser(response.user);
        return { success: true };
      }
      return { success: false, error: 'Login fallito' };
    } catch (error: any) {
      const message = error.response?.data?.detail || 'Errore di login';
      return { success: false, error: message };
    }
  };

  // Admin login Step 1: PIN verification
  const loginAdminPin = async (email: string, pin: string): Promise<{ success: boolean; needsGoogle?: boolean; error?: string }> => {
    try {
      const response = await authApi.adminPinVerify(email, pin);
      if (response.temp_token) {
        // PIN verified, need Google
        await AsyncStorage.setItem('pending_admin_email', email);
        setPendingAdminEmail(email);
        return { success: true, needsGoogle: true };
      }
      return { success: false, error: 'PIN non valido' };
    } catch (error: any) {
      const message = error.response?.data?.detail || 'PIN non valido';
      return { success: false, error: message };
    }
  };

  // Admin login Step 2: Google OAuth
  const loginAdminGoogle = async () => {
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
          await processGoogleCallback(sessionIdMatch[1]);
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
    await AsyncStorage.removeItem('pending_admin_email');
    setUser(null);
    setPendingAdminEmail(null);
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
        pendingAdminEmail,
        setPendingAdminEmail,
        loginWithCredentials,
        loginAdminPin,
        loginAdminGoogle,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
