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
  theme: string;
  handleThemeChange: () => void;
};

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

function ThemeContextBridge({ children }: { children: ReactNode }) {
  const { resolvedTheme, setTheme } = useNextTheme();
  const theme = resolvedTheme ?? "system";

  const handleThemeChange = useCallback(() => {
    setTheme(theme === "dark" ? "light" : "dark");
  }, [theme, setTheme]);

  const value = useMemo(
    () => ({
      theme,
      handleThemeChange,
    }),
    [theme, handleThemeChange],
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
