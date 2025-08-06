"use client";

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { db } from '@/app/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { generateQrCodePayload } from '@/app/actions/paymentActions';
import Image from 'next/image';

// --- !! สำคัญมาก !! ---
// --- ใส่เบอร์ PromptPay ของคุณที่นี่ ---
const PROMPTPAY_ID = '0623733306'; // <--- แก้ไขตรงนี้

// Component ที่จะจัดการ useSearchParams
function PaymentContent() {
    const [booking, setBooking] = useState(null);
    const [qrCodeDataUrl, setQrCodeDataUrl] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const searchParams = useSearchParams();

    const getBookingId = () => {
        // ลอง query parameter ก่อน
        const bookingIdFromQuery = searchParams.get('bookingId');
        if (bookingIdFromQuery) {
            return bookingIdFromQuery;
        }

        // ลอง liff.state
        const liffState = searchParams.get('liff.state');
        if (liffState) {
            // ลบ slash แรกออกเพื่อใช้เป็น bookingId
            return liffState.replace(/^\//, '');
        }

        return null;
    };

    useEffect(() => {
        const bookingId = getBookingId();
        
        if (!bookingId) {
            setError('ไม่พบ Booking ID');
            setLoading(false);
            return;
        }

        console.log('Found Booking ID:', bookingId);

        const fetchBookingAndGenerateQR = async () => {
            setLoading(true);
            try {
                const bookingRef = doc(db, 'bookings', bookingId);
                const bookingSnap = await getDoc(bookingRef);

                if (!bookingSnap.exists()) {
                    throw new Error('ไม่พบข้อมูลการจอง');
                }
                
                const bookingData = { id: bookingSnap.id, ...bookingSnap.data() };
                setBooking(bookingData);

                console.log('PROMPTPAY_ID:', PROMPTPAY_ID);

                const amount = bookingData.paymentInfo.totalPrice;
                const dataUrl = await generateQrCodePayload(PROMPTPAY_ID, amount);
                
                setQrCodeDataUrl(dataUrl);

            } catch (err) {
                setError(err.message);
                console.error('Error:', err);
            } finally {
                setLoading(false);
            }
        };

        fetchBookingAndGenerateQR();
    }, [searchParams]);

    if (loading) {
        return (
            <div className="text-center p-10">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-800 mx-auto mb-4"></div>
                <p>กำลังสร้าง QR Code สำหรับชำระเงิน...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="text-center p-10 text-red-500">
                <p className="text-lg font-semibold">เกิดข้อผิดพลาด</p>
                <p>{error}</p>
                <button 
                    onClick={() => window.location.reload()} 
                    className="mt-4 px-4 py-2 bg-slate-800 text-white rounded-lg"
                >
                    ลองใหม่
                </button>
            </div>
        );
    }

    return (
        <div className="max-w-md mx-auto p-4">
            <div className="bg-white rounded-lg shadow-lg p-6 text-center">
                <h1 className="text-2xl font-bold text-gray-800 mb-2">ใบแจ้งค่าบริการ</h1>
                <p className="text-sm text-gray-500 mb-4">
                    Booking ID: {booking?.id.substring(0, 6).toUpperCase()}
                </p>
                
                <div className="my-6">
                    <p className="text-gray-600">ยอดชำระทั้งหมด</p>
                    <p className="text-5xl font-bold text-slate-800">
                        {booking?.paymentInfo.totalPrice.toLocaleString()}
                        <span className="text-2xl font-medium ml-1">บาท</span>
                    </p>
                </div>
                
                {qrCodeDataUrl && (
                    <div className="flex justify-center my-6">
                         <Image 
                            src={qrCodeDataUrl} 
                            alt="PromptPay QR Code" 
                            width={250} 
                            height={250} 
                            className="border-2 border-gray-200 rounded-lg"
                         />
                    </div>
                )}
                
                <p className="text-gray-600 mb-4">
                    สแกน QR Code นี้เพื่อชำระเงินผ่านแอปพลิเคชันของธนาคาร
                </p>

                {booking && (
                    <div className="mt-6 text-left bg-gray-50 p-4 rounded-lg text-sm">
                        <h3 className="font-semibold mb-2">สรุปรายการ</h3>
                        <p><strong>ลูกค้า:</strong> {booking.customerInfo.name}</p>
                        <p><strong>การเดินทาง:</strong> {booking.pickupInfo.name || booking.pickupInfo.address} ไปยัง {booking.dropoffInfo.address}</p>
                        <p><strong>วันที่:</strong> {booking.pickupInfo.dateTime.toDate().toLocaleDateString('th-TH')}</p>
                        <p><strong>เวลา:</strong> {booking.pickupInfo.dateTime.toDate().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}</p>
                    </div>
                )}

                <button 
                    onClick={() => window.location.reload()} 
                    className="mt-6 w-full px-4 py-3 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition"
                >
                    รีเฟรชหน้า
                </button>
            </div>
        </div>
    );
}

// Main component ที่ห่อ PaymentContent ด้วย Suspense
export default function PaymentMainPage() {
    return (
        <Suspense fallback={
            <div className="text-center p-10">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-800 mx-auto mb-4"></div>
                <p>กำลังโหลด...</p>
            </div>
        }>
            <PaymentContent />
        </Suspense>
    );
}
