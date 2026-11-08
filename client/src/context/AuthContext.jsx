import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => {
    try {
      return localStorage.getItem('seedr_auth_token') || null;
    } catch (e) {
      return null;
    }
  });

  const [mode, setMode] = useState(() => {
    try {
      return localStorage.getItem('seedr_user_mode') || 'guest';
    } catch (e) {
      return 'guest';
    }
  });

  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // If there's a token and mode is 'user', the session is active as a personal account
  const isGuest = mode === 'guest' || !token;
  const hasUserSession = !!token;

  const refreshProfile = useCallback(async () => {
    try {
      const res = await api.get('/auth/me');
      if (res.data && res.data.user) {
        setUser(res.data.user);
      }
    } catch (err) {
      // If 401, token might have expired
      if (err.response?.status === 401) {
        setToken(null);
        setUser(null);
        try {
          localStorage.removeItem('seedr_auth_token');
          localStorage.setItem('seedr_user_mode', 'guest');
        } catch (e) {}
        setMode('guest');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshProfile();
  }, [refreshProfile, mode, token]);

  const login = async (email, password) => {
    const res = await api.post('/auth/login', { email, password });
    if (res.data?.success && res.data.token) {
      const newToken = res.data.token;
      setToken(newToken);
      setUser(res.data.user);
      setMode('user');
      try {
        localStorage.setItem('seedr_auth_token', newToken);
        localStorage.setItem('seedr_user_mode', 'user');
      } catch (e) {}
      return res.data;
    }
    throw new Error(res.data?.error || 'Authentication failed');
  };

  const loginWithToken = (newToken, userData) => {
    setToken(newToken);
    setUser(userData);
    setMode('user');
    try {
      localStorage.setItem('seedr_auth_token', newToken);
      localStorage.setItem('seedr_user_mode', 'user');
    } catch (e) {}
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    setMode('guest');
    try {
      localStorage.removeItem('seedr_auth_token');
      localStorage.setItem('seedr_user_mode', 'guest');
    } catch (e) {}
  };

  const switchToGuest = () => {
    setMode('guest');
    try {
      localStorage.setItem('seedr_user_mode', 'guest');
    } catch (e) {}
  };

  const switchToUser = () => {
    if (token) {
      setMode('user');
      try {
        localStorage.setItem('seedr_user_mode', 'user');
      } catch (e) {}
    }
  };

  return (
    <AuthContext.Provider
      value={{
        token,
        mode,
        user,
        isGuest,
        hasUserSession,
        loading,
        login,
        loginWithToken,
        logout,
        switchToGuest,
        switchToUser,
        refreshProfile
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

