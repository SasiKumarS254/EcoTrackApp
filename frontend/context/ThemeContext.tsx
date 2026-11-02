import React, { createContext, useContext, useState, useEffect } from 'react';
import { LightColors, DarkColors } from '@/constants/theme';
import AsyncStorage from '@react-native-async-storage/async-storage';

type ThemeType = 'light' | 'dark';

interface ThemeContextProps {
  theme: ThemeType;
  colors: typeof LightColors;
  toggleTheme: () => void;
  isDark: boolean;
}

const ThemeContext = createContext<ThemeContextProps>({
  theme: 'light',
  colors: LightColors,
  toggleTheme: () => {},
  isDark: false,
});

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const [theme, setTheme] = useState<ThemeType>('light');

  useEffect(() => {
    AsyncStorage.getItem('@ecotrack_theme')
      .then((saved) => {
        if (saved === 'dark' || saved === 'light') {
          setTheme(saved);
        }
      })
      .catch(() => {});
  }, []);

  const toggleTheme = () => {
    setTheme((prev) => {
      const next = prev === 'light' ? 'dark' : 'light';
      AsyncStorage.setItem('@ecotrack_theme', next).catch(() => {});
      return next;
    });
  };

  const colors = theme === 'dark' ? DarkColors : LightColors;
  const isDark = theme === 'dark';

  return (
    <ThemeContext.Provider value={{ theme, colors, toggleTheme, isDark }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
