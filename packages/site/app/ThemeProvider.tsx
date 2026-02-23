"use client";

import {
  ThemeProvider as NextThemesProvider,
  useTheme as useNextTheme,
} from "next-themes";
import {
  type ComponentProps,
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useMemo,
} from "react";

type ThemeContextValue = {
  isDark: boolean;
  handleThemeChange: () => void;
};

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

function ThemeContextBridge({ children }: { children: ReactNode }) {
  const { resolvedTheme, setTheme } = useNextTheme();

  const isDark = resolvedTheme === "dark";

  const handleThemeChange = useCallback(() => {
    setTheme(isDark ? "light" : "dark");
  }, [isDark, setTheme]);

  const value = useMemo(
    () => ({
      isDark,
      handleThemeChange,
    }),
    [isDark, handleThemeChange],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

type ThemeProviderProps = ComponentProps<typeof NextThemesProvider>;

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return (
    <NextThemesProvider {...props}>
      <ThemeContextBridge>{children}</ThemeContextBridge>
    </NextThemesProvider>
  );
}

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return context;
};
