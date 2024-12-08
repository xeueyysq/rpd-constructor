import React, { createContext, useState, useEffect, useContext } from 'react';
import { axiosBase } from '../fetchers/baseURL';

interface AuthContextType {
    auth: any;
    login: (username: string, password: string) => Promise<void>;
    logout: () => void;
    refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export const useAuth = () => {
    return useContext(AuthContext);
};

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
    const [auth, setAuth] = useState<any>(null);

    const login = async (username: string, password: string) => {
        try {
            const response = await axiosBase.post('auth/sign-in', {
                username,
                password
            });
            
            if (response?.data) {
                setAuth(response.data);
                return response.data;
            }
            throw new Error('No data received from server');
        } catch (error) {
            console.error('Login error:', error);
            throw error;
        }
    };

    const logout = () => {
        setAuth(null);
    };

    const refresh = async () => {
        try {
            const response = await axiosBase.post('auth/refresh');
            
            if (response?.data) {
                setAuth(response.data);
                return response.data;
            }
            throw new Error('No data received from server');
        } catch (error) {
            console.error('Refresh error:', error);
            throw error;
        }
    };

    const value = {
        auth,
        login,
        logout,
        refresh
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};