"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { db } from '@/app/lib/firebase';
import { collection, query, where, orderBy, getDocs } from 'firebase/firestore';
import { useLiffContext } from '@/context/LiffProvider';
import Image from 'next/image';

const statusTranslations = { 'completed': 'ส่งสำเร็จ', 'noshow': 'ไม่พบลูกค้า' };

const StatusBadge = ({ status }) => {
    const baseClasses = "px-2 py-1 text-xs font-semibold rounded-full";
    let colorClasses = "";
    switch (status) {
        case 'completed': 
            colorClasses = "bg-green-100 text-green-800"; 
            break;
        case 'noshow':
            colorClasses = "bg-red-100 text-red-800"; 
            break;
        default: 
            colorClasses = "bg-gray-100 text-gray-800";
    }
    return <span className={`${baseClasses} ${colorClasses}`}>{statusTranslations[status] || status}</span>;
};

export default function DriverHistoryPage() {
    const { profile, loading: liffLoading, error: liffError } = useLiffContext();
    const [historyJobs, setHistoryJobs] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (liffLoading || !profile?.userId) {
            if (!liffLoading) setLoading(false);
            return;
        }

        const fetchHistory = async () => {
            setLoading(true);
            try {
                // 1. ค้นหาข้อมูลคนขับจาก lineUserId ที่ได้จาก LIFF
                const driversQuery = query(collection(db, 'drivers'), where("lineUserId", "==", profile.userId));
                const driverSnapshot = await getDocs(driversQuery);

                if (driverSnapshot.empty) {
                    console.log("No matching driver found for this LINE user.");
                    setHistoryJobs([]); // ไม่พบคนขับ ก็ไม่ควรมีงาน
                    return;
                }

                // 2. ใช้ Document ID ของคนขับที่หาเจอเพื่อค้นหางาน
                const driverDocId = driverSnapshot.docs[0].id;

                const historyQuery = query(
                    collection(db, 'bookings'),
                    where("driverId", "==", driverDocId), // ใช้ ID ของคนขับในการค้นหา
                    where("status", "in", ["completed", "noshow"]),
                    orderBy("updatedAt", "desc")
                );
                const querySnapshot = await getDocs(historyQuery);
                const jobsData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                setHistoryJobs(jobsData);
            } catch (error) {
                console.error("Error fetching job history:", error);
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
        <main className="p-4">
            <div className="flex justify-between items-center mb-4">
                <Link href="driver" className="text-gray-600 p-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                </Link>
                <h1 className="text-lg font-bold flex-grow text-center">ประวัติงาน</h1>
                <div className="w-8"></div> {/* Spacer */}
            </div>

            {loading ? (
                <div className="text-center text-gray-500 mt-10">กำลังโหลดประวัติ...</div>
            ) : historyJobs.length === 0 ? (
                <div className="text-center text-gray-500 mt-10 bg-white p-6 rounded-lg shadow">
                    <p>ยังไม่มีประวัติงานที่เสร็จสิ้น</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {historyJobs.map(job => (
                        <div key={job.id} className="bg-white rounded-lg shadow p-4">
                            <div className="flex justify-between items-start mb-2">
                                <div>
                                    <p className="font-semibold text-gray-900">
                                        {job.pickupInfo.dateTime.toDate().toLocaleDateString('th-TH', {
                                            year: 'numeric', month: 'long', day: 'numeric'
                                        })}
                                    </p>
                                    <p className="text-sm text-gray-500">ID: {job.id.substring(0, 6).toUpperCase()}</p>
                                </div>
                                <StatusBadge status={job.status} />
                            </div>
                            <div className="border-t my-2"></div>
                            <div className="flex items-center space-x-4">
                                <Image src={job.vehicleInfo.imageUrl || '/placeholder.png'} alt="car" width={70} height={70} className="rounded-md object-cover flex-shrink-0"/>
                                <div className="text-xs text-gray-600 space-y-1">
                                    <p><strong>ลูกค้า:</strong> {job.customerInfo.name}</p>
                                    <p><strong>รับที่:</strong> {job.pickupInfo.address}</p>
                                    <p><strong>ส่งที่:</strong> {job.dropoffInfo.address}</p>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </main>
    );
}
