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
  isInitialized: boolean; // NEW: Track if auth check is complete
  isAuthenticated: boolean;
  pinVerified: boolean; // NEW: Track PIN verification state
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
  const [isInitialized, setIsInitialized] = useState(false); // NEW
  const [pinVerified, setPinVerified] = useState(false); // NEW
  const [pendingAdminEmail, setPendingAdminEmail] = useState<string | null>(null);

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

  // Handle Google callback for admin
  const processGoogleCallback = async (sessionId: string): Promise<boolean> => {
    console.log('Processing Google callback...');
    
    const email = await AsyncStorage.getItem('pending_admin_email');
    const pinVerifiedState = await AsyncStorage.getItem('admin_pin_verified');
    
    console.log('Pending admin email:', email);
    console.log('PIN verified state:', pinVerifiedState);
    
    if (!email) {
      console.error('No pending admin email found');
      return false;
    }
    
    if (pinVerifiedState !== 'true') {
      console.error('PIN not verified');
      return false;
    }

    try {
      console.log('Calling adminGoogleVerify...');
      const response = await authApi.adminGoogleVerify(email, sessionId);
      console.log('Google verify response:', response);
      
      if (response.token) {
        // Save token
        await AsyncStorage.setItem('session_token', response.token);
        
        // Clear pending states
        await AsyncStorage.removeItem('pending_admin_email');
        await AsyncStorage.removeItem('admin_pin_verified');
        
        // Set user
        setUser(response.user);
        setPendingAdminEmail(null);
        setPinVerified(false);
        
        console.log('Admin login complete, user:', response.user.email);
        return true;
      }
    } catch (error: any) {
      console.error('Google verification failed:', error.response?.data || error.message);
      // Clear states on error
      await AsyncStorage.removeItem('pending_admin_email');
      await AsyncStorage.removeItem('admin_pin_verified');
      setPendingAdminEmail(null);
      setPinVerified(false);
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

      // Check for Google callback (session_id in URL)
      let googleCallbackProcessed = false;
      
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        const hash = window.location.hash;
        const sessionIdMatch = hash.match(/session_id=([^&]+)/);
        
        if (sessionIdMatch) {
          console.log('Found session_id in URL, processing Google callback...');
          googleCallbackProcessed = await processGoogleCallback(sessionIdMatch[1]);
          // Clear the URL hash
          window.history.replaceState({}, document.title, window.location.pathname);
        }
      } else {
        // Mobile: check for initial URL
        const initialUrl = await Linking.getInitialURL();
        if (initialUrl) {
          const sessionIdMatch = initialUrl.match(/session_id=([^&]+)/);
          if (sessionIdMatch) {
            googleCallbackProcessed = await processGoogleCallback(sessionIdMatch[1]);
          }
        }
      }

      // If no Google callback, check existing session
      if (!googleCallbackProcessed) {
        await checkExistingSession();
      }
      
      // Check if there's a pending admin PIN verification
      const pendingEmail = await AsyncStorage.getItem('pending_admin_email');
      const pinVerifiedState = await AsyncStorage.getItem('admin_pin_verified');
      
      if (pendingEmail && pinVerifiedState === 'true') {
        setPendingAdminEmail(pendingEmail);
        setPinVerified(true);
      }
      
      setIsLoading(false);
      setIsInitialized(true);
      console.log('=== Auth Init Complete ===');
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
      console.log('Verifying admin PIN for:', email);
      const response = await authApi.adminPinVerify(email, pin);
      
      if (response.temp_token) {
        // PIN verified - save state persistently
        await AsyncStorage.setItem('pending_admin_email', email.toLowerCase());
        await AsyncStorage.setItem('admin_pin_verified', 'true');
        
        setPendingAdminEmail(email.toLowerCase());
        setPinVerified(true);
        
        console.log('PIN verified, ready for Google');
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
    console.log('Starting Google OAuth...');
    
    const redirectUrl = Platform.OS === 'web'
      ? `${BACKEND_URL}/`
      : Linking.createURL('/');
    
    console.log('Redirect URL:', redirectUrl);
    
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
    console.log('Logging out...');
    try {
      await authApi.logout();
    } catch (error) {
      console.error('Logout error:', error);
    }
    
    // Clear all auth state
    await AsyncStorage.removeItem('session_token');
    await AsyncStorage.removeItem('pending_admin_email');
    await AsyncStorage.removeItem('admin_pin_verified');
    
    setUser(null);
    setPendingAdminEmail(null);
    setPinVerified(false);
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
        isInitialized,
        isAuthenticated: !!user,
        pinVerified,
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
