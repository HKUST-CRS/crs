"use client"; 

import { useEffect, useState, ReactNode } from "react";

export function ThemeProvider() {
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

    useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    const handleThemeChange = (fromListener = false, eMatches: boolean) => {
        const root = document.documentElement;
        if (fromListener) { // Change to the new system theme 
        if (eMatches) {
            root.classList.add('dark');
            console.log("Applied dark theme from listener: to dark");
        } else {
            root.classList.remove('dark');
            console.log("Applied light theme from listener: to light");
        }
        }else { // toggle toggle theme manually
            if (isDark) { 
            root.classList.remove('dark');
            setIsDark(false); // Update state
            console.log("Applied light theme manually");
            }else{
            root.classList.add('dark');
            setIsDark(true);
            console.log("Applied dark theme manually");
            }
    };
    };

    handleThemeChange(true, mediaQuery.matches);

    const handleChange = (e: MediaQueryListEvent) => {
        handleThemeChange(true, e.matches);
    };    
        
    mediaQuery.addEventListener('change', handleChange);

    return () => mediaQuery.removeEventListener('change', handleChange);
    }, []);

    return <>
        <script dangerouslySetInnerHTML={{ __html: blockingStatusScript }} />
    </>;
}