import React, { createContext, useContext, useMemo, useState } from 'react';

interface ThemeContextValue {
  isDark: boolean;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

interface ThemeProviderProps {
  children: React.ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const [isDark, setIsDark] = useState(true);

  const toggleTheme = () => setIsDark((prev) => !prev);

  const value = useMemo(
    () => ({
      isDark,
      toggleTheme,
    }),
    [isDark],
  );

  return (
    <ThemeContext.Provider value={value}>
      <div
        className={`${
          isDark ? 'dark bg-[#050505]' : 'light bg-gray-50'
        } min-h-screen transition-colors duration-500`}
      >
        {children}
      </div>
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return ctx;
};
