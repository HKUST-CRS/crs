"use client"; 

import { useEffect, useState, ReactNode, createContext, useContext } from "react";

const ThemeContext = createContext<any>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
    const [isDark, setIsDark] = useState(false);

    // Prevent FOUC by applying theme before rendering
    const blockingStatusScript = `
    (function() {
        const savedTheme = localStorage.getItem('theme');
        const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        if (savedTheme === 'dark' || (!savedTheme && systemDark)) {
        document.documentElement.classList.add('dark');
        } else {
        document.documentElement.classList.remove('dark');
        }
    })()
        `;

    
    const handleThemeChange = (fromListener = false, eMatches?: boolean) => {
        const root = document.documentElement;
        if (fromListener) {
            if (eMatches) {
                root.classList.add('dark');
                setIsDark(true); 
            } else {
                root.classList.remove('dark');
                setIsDark(false);
            }
        } else {
            if (isDark) { 
                root.classList.remove('dark');
                setIsDark(false);
                console.log()
            } else {
                root.classList.add('dark');
                setIsDark(true);
            }
        }
    };

    useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    


    handleThemeChange(true, mediaQuery.matches);

    const handleChange = (e: MediaQueryListEvent) => {
        handleThemeChange(true, e.matches);
    };    
        
    mediaQuery.addEventListener('change', handleChange);

    return () => mediaQuery.removeEventListener('change', handleChange);
    }, []);

    return (
        <ThemeContext.Provider value={{ isDark, handleThemeChange }}>
            <script dangerouslySetInnerHTML={{ __html: blockingStatusScript }} />
            {children}
        </ThemeContext.Provider>
    );
}

export const useTheme = () => useContext(ThemeContext);