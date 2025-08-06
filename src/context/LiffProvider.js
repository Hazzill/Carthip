"use client";

import { createContext, useContext } from 'react';
import useLiff from '@/hooks/useLiff';

const LiffContext = createContext(null);

export const useLiffContext = () => useContext(LiffContext);

// Provider จะรับ liffId เป็น prop
export const LiffProvider = ({ children, liffId }) => {
    // ส่ง liffId ที่ได้รับไปให้ useLiff hook
    const liffData = useLiff(liffId);

    return (
        <LiffContext.Provider value={liffData}>
            {children}
        </LiffContext.Provider>
    );
};
