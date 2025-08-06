// src/app/(customer)/payment/layout.js
"use client";

import { LiffProvider, useLiffContext } from '@/context/LiffProvider';
import Image from 'next/image';

function PaymentHeader() {
    const { profile, loading, error } = useLiffContext();
}

export default function PaymentLayout({ children }) {
    // ใช้ PAYMENT_LIFF_ID สำหรับหน้าชำระเงินโดยเฉพาะ
    const paymentLiffId = process.env.NEXT_PUBLIC_PAYMENT_LIFF_ID;
    
    console.log('Payment LIFF ID:', paymentLiffId); // Debug log
    
    return (
        <LiffProvider liffId={paymentLiffId}>
            <div className="max-w-md mx-auto bg-gray-100 min-h-screen">
                <PaymentHeader />
                <main className="px-4 pb-4">
                    {children}
                </main>
            </div>
        </LiffProvider>
    );
}
