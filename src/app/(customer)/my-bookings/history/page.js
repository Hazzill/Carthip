"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { db } from '@/app/lib/firebase';
import { collection, query, where, orderBy, getDocs } from 'firebase/firestore';
import Image from 'next/image';
import { useLiffContext } from '@/context/LiffProvider';

const statusTranslations = {
    'completed': 'ส่งสำเร็จ',
    'noshow': 'ไม่พบลูกค้า',
    'cancelled': 'ยกเลิกโดยคุณ'
};

const StatusBadge = ({ status }) => {
    const baseClasses = "px-2 py-1 text-xs font-semibold rounded-full";
    let colorClasses = "";
    switch (status) {
        case 'completed': 
            colorClasses = "bg-green-100 text-green-800"; 
            break;
        case 'cancelled':
        case 'noshow':
            colorClasses = "bg-red-100 text-red-800"; 
            break;
        default: 
            colorClasses = "bg-gray-100 text-gray-800";
    }
    return <span className={`${baseClasses} ${colorClasses}`}>{statusTranslations[status] || status}</span>;
};

export default function BookingHistoryPage() {
    const { profile, loading: liffLoading, error: liffError } = useLiffContext(); 
    const [historyBookings, setHistoryBookings] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (liffLoading || !profile?.userId) {
            if (!liffLoading) setLoading(false);
            return;
        }

        const fetchHistory = async () => {
            setLoading(true);
            try {
                const bookingsQuery = query(
                    collection(db, 'bookings'),
                    where("userId", "==", profile.userId),
                    where("status", "in", ["completed", "cancelled", "noshow"]),
                    orderBy("createdAt", "desc")
                );
                const querySnapshot = await getDocs(bookingsQuery);
                const bookingsData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                setHistoryBookings(bookingsData);
            } catch (error) {
                console.error("Error fetching booking history:", error);
            } finally {
                setLoading(false);
            }
        };
        
        fetchHistory();
    }, [profile, liffLoading]);

    if (liffLoading) {
        return <div className="p-4 text-center">Initializing LIFF...</div>;
    }

    if (liffError) {
        return <div className="p-4 text-center text-red-500">LIFF Error: {liffError}</div>;
    }

    return (
        <main className="space-y-4">
            <div className="flex bg-gray-100 rounded-full shadow-sm p-1">
                <Link href="../my-bookings" className="w-1/2 text-center py-2 text-gray-600 font-semibold">
                    รายการจองของฉัน
                </Link>
                <button className="w-1/2 bg-slate-800 text-white rounded-full py-2 font-semibold">ประวัติการจอง</button>
            </div>

            {loading ? (
                <div className="text-center text-gray-500 pt-10">กำลังโหลดประวัติ...</div>
            ) : historyBookings.length === 0 ? (
                <div className="text-center text-gray-500 pt-10">
                    <p>ยังไม่มีประวัติการจอง</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {historyBookings.map(job => (
                        <div key={job.id} className="bg-gray-100 rounded-lg shadow p-4 opacity-90">
                            <div className="flex justify-between items-start mb-2">
                                <div>
                                    <p className="font-bold text-gray-800">
                                        {job.pickupInfo.dateTime.toDate().toLocaleDateString('th-TH', {
                                            year: 'numeric', month: 'long', day: 'numeric'
                                        })}
                                    </p>
                                    <p className="text-sm text-gray-500">ID: {job.id.substring(0, 6).toUpperCase()}</p>
                                </div>
                                <StatusBadge status={job.status} />
                            </div>
                            <div className="flex items-center space-x-4">
                                <Image src={job.vehicleInfo.imageUrl || '/placeholder.png'} alt="car" width={70} height={70} className="rounded-md object-cover flex-shrink-0"/>
                                <div className="text-sm text-gray-700">
                                    <p><strong>รถ:</strong> {job.vehicleInfo.brand} {job.vehicleInfo.model}</p>
                                    <p><strong>รับ:</strong> {job.pickupInfo.address}</p>
                                    <p><strong>ส่ง:</strong> {job.dropoffInfo.address}</p>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </main>
    );
}
