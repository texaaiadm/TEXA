import React from 'react';
import { useTheme } from '../services/ThemeContext';

const ThemeToggle: React.FC = () => {
    const { theme, toggleTheme } = useTheme();

    return (
        <button
            onClick={toggleTheme}
            aria-label={theme === 'dark' ? 'Aktifkan mode terang' : 'Aktifkan mode gelap'}
            title={theme === 'dark' ? 'Mode Terang' : 'Mode Gelap'}
            className="
        relative w-9 h-9 md:w-10 md:h-10 
        rounded-xl 
        glass-chip
        flex items-center justify-center 
        transition-all duration-300 
        hover:scale-105 active:scale-95
        focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:ring-offset-2 focus:ring-offset-transparent
        group
      "
        >
            {/* Sun Icon (Light Mode) */}
            <svg
                className={`
          w-4 h-4 md:w-5 md:h-5 
          transition-all duration-300 
          absolute
          ${theme === 'light'
                        ? 'opacity-100 rotate-0 scale-100 text-amber-500'
                        : 'opacity-0 rotate-90 scale-50 text-amber-500'
                    }
        `}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
            >
                <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
                />
            </svg>

            {/* Moon Icon (Dark Mode) */}
            <svg
                className={`
          w-4 h-4 md:w-5 md:h-5 
          transition-all duration-300 
          absolute
          ${theme === 'dark'
                        ? 'opacity-100 rotate-0 scale-100 text-indigo-300'
                        : 'opacity-0 -rotate-90 scale-50 text-indigo-300'
                    }
        `}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
            >
                <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
                />
            </svg>
        </button>
    );
};

export default ThemeToggle;
