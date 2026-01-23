// PopupContext - Global state untuk mengatur popup dan visibility header/footer
import React, { createContext, useContext, useState, useCallback, ReactNode, useRef, useEffect } from 'react';

interface PopupContextType {
    isAnyPopupOpen: boolean;
    registerPopup: (id: string, isOpen: boolean) => void;
}

const PopupContext = createContext<PopupContextType | undefined>(undefined);

export const PopupProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [openPopups, setOpenPopups] = useState<Set<string>>(new Set());

    const registerPopup = useCallback((id: string, isOpen: boolean) => {
        setOpenPopups(prev => {
            const newSet = new Set(prev);
            if (isOpen) {
                newSet.add(id);
            } else {
                newSet.delete(id);
            }
            return newSet;
        });
    }, []);

    const isAnyPopupOpen = openPopups.size > 0;

    return (
        <PopupContext.Provider value={{ isAnyPopupOpen, registerPopup }}>
            {children}
        </PopupContext.Provider>
    );
};

// Custom hook untuk menggunakan popup context
export const usePopup = (): PopupContextType => {
    const context = useContext(PopupContext);
    if (!context) {
        throw new Error('usePopup must be used within PopupProvider');
    }
    return context;
};

// Custom hook untuk mendaftarkan popup dengan ID unik
export const usePopupState = (isOpen: boolean): void => {
    const { registerPopup } = usePopup();
    const popupIdRef = useRef<string>(`popup-${Math.random().toString(36).slice(2, 11)}`);

    useEffect(() => {
        registerPopup(popupIdRef.current, isOpen);

        // Cleanup saat unmount
        return () => {
            registerPopup(popupIdRef.current, false);
        };
    }, [isOpen, registerPopup]);
};

export default PopupContext;
