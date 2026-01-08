import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { User } from '../types';
import { authApi, seedApi } from '../services/api';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isInitialized: boolean;
  isAuthenticated: boolean;
  loginWithCredentials: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
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
  const [isInitialized, setIsInitialized] = useState(false);

  const checkExistingSession = async () => {
    try {
      const token = await AsyncStorage.getItem('session_token');
      console.log('Checking existing session, token exists:', !!token);
      if (token) {
        const userData = await authApi.getMe();
        console.log('Session valid, user:', userData.email, userData.ruolo);
        setUser(userData);
        return true;
      }
    } catch (error) {
      console.log('No valid session');
      await AsyncStorage.removeItem('session_token');
    }
    return false;
  };

  useEffect(() => {
    const init = async () => {
      console.log('=== Auth Init Start ===');
      setIsLoading(true);
      setIsInitialized(false);
      
      // First seed the database (silent)
      try {
        await seedApi.seed();
      } catch (e) {
        // Ignore
      }

      // Check existing session
      await checkExistingSession();
      
      setIsLoading(false);
      setIsInitialized(true);
      console.log('=== Auth Init Complete ===');
    };
    
    init();
  }, []);

  const loginWithCredentials = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      console.log('Attempting login for:', email);
      const response = await authApi.login(email, password);
      
      if (response.token) {
        await AsyncStorage.setItem('session_token', response.token);
        setUser(response.user);
        console.log('Login successful for:', response.user.email);
        return { success: true };
      }
      return { success: false, error: 'Token non ricevuto' };
    } catch (error: any) {
      console.error('Login error:', error.response?.data || error.message);
      return { 
        success: false, 
        error: error.response?.data?.detail || 'Errore durante il login' 
      };
    }
  };

  const logout = async () => {
    try {
      await authApi.logout();
    } catch (error) {
      // Ignore
    }
    await AsyncStorage.removeItem('session_token');
    setUser(null);
    console.log('Logged out');
  };

  const refreshUser = async () => {
    await checkExistingSession();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isInitialized,
        isAuthenticated: !!user,
        loginWithCredentials,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
