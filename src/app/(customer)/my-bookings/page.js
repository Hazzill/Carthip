"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { db } from '@/app/lib/firebase';
import { collection, query, where, orderBy, onSnapshot, doc, getDoc } from 'firebase/firestore';
import Image from 'next/image';
import { useLiffContext } from '@/context/LiffProvider';
import { cancelBookingByUser } from '@/app/actions/bookingActions';

// --- Notification Component ---
const Notification = ({ show, title, message, type }) => {
    if (!show) return null;
    const icons = {
        success: (
            <svg className="w-6 h-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            </svg>
        ),
        error: (
            <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            </svg>
        ),
    };
    const colors = {
        success: 'bg-green-50 border-green-200 text-green-800',
        error: 'bg-red-50 border-red-200 text-red-800',
    };
    return (
        <div className={`fixed top-5 left-1/2 -translate-x-1/2 w-11/12 max-w-md p-4 rounded-lg border shadow-lg z-50 ${colors[type]}`}>
            <div className="flex items-start">
                <div className="flex-shrink-0">{icons[type]}</div>
                <div className="ml-3">
                    <h3 className="text-sm font-bold">{title}</h3>
                    {message && <div className="mt-1 text-sm">{message}</div>}
                </div>
            </div>
        </div>
    );
};

// --- Confirmation Modal ---
const ConfirmationModal = ({ show, title, message, onConfirm, onCancel, isProcessing }) => {
    if (!show) return null;
    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50 p-4">
            <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-sm">
                <h2 className="text-lg font-bold mb-2">{title}</h2>
                <p className="text-sm text-gray-600 mb-6">{message}</p>
                <div className="flex justify-end space-x-3">
                    <button onClick={onCancel} className="px-4 py-2 bg-gray-200 rounded-md font-semibold">ยกเลิก</button>
                    <button onClick={onConfirm} disabled={isProcessing} className="px-4 py-2 bg-red-600 text-white rounded-md font-semibold disabled:bg-gray-400">
                        {isProcessing ? 'กำลังดำเนินการ...' : 'ยืนยัน'}
                    </button>
                </div>
            </div>
        </div>
    );
};


// --- Helper Components ---
const statusConfig = {
    'pending': { text: 'รอการยืนยัน', progress: 10, color: 'bg-yellow-500' },
    'confirmed': { text: 'ยืนยันแล้ว', progress: 20, color: 'bg-blue-500' },
    'assigned': { text: 'คนขับรับงานแล้ว', progress: 40, color: 'bg-cyan-500' },
    'stb': { text: 'คนขับกำลังไปรับ', progress: 50, color: 'bg-purple-500' },
    'pickup': { text: 'รับลูกค้าแล้ว', progress: 70, color: 'bg-green-500' },
    'completed': { text: 'ส่งสำเร็จ', progress: 100, color: 'bg-green-500' },
    'noshow': { text: 'ไม่พบลูกค้า', progress: 0, color: 'bg-red-500' },
    'cancelled': { text: 'ยกเลิก', progress: 0, color: 'bg-red-500' }
};

const ProgressBar = ({ status }) => {
    const config = statusConfig[status] || { progress: 0, color: 'bg-gray-400' };
    return (
        <div className="w-full bg-gray-100 rounded-full h-1.5">
            <div
                className={`h-1.5 rounded-full transition-all duration-500 ${config.color}`}
                style={{ width: `${config.progress}%` }}
            ></div>
        </div>
    );
};

const BookingCard = ({ job, onCancel, isCancelling }) => {
    const handleReportIssue = () => {
        // This can be replaced with a proper notification
        onCancel.showNotification({
            show: true,
            title: 'ฟังก์ชันยังไม่พร้อม',
            message: "ฟังก์ชัน 'แจ้งเรื่อง' กำลังอยู่ในระหว่างการพัฒนา",
            type: 'error'
        });
    };

    const pickupDateTime = job.pickupInfo.dateTime.toDate();

    return (
        <div className="bg-white rounded-2xl p-5 space-y-4 shadow">
            <div className="flex justify-between items-start">
                <div className="flex items-center space-x-4">
                    <Image
                        src={job.vehicleInfo?.imageUrl || 'https://placehold.co/600x400/e2e8f0/334155?text=No+Image'}
                        alt={job.vehicleInfo?.model || 'Car'}
                        width={80}
                        height={60}
                        className="rounded-lg object-cover w-24 h-16"
                    />
                    <div>
                        <p className="font-bold text-lg text-gray-800">{job.vehicleInfo?.brand}</p>
                        <p className="text-sm text-gray-500">{job.vehicleInfo?.model}</p>
                    </div>
                </div>
                <button onClick={handleReportIssue} className="bg-primary text-white text-xs font-bold py-1.5 px-4 rounded-full hover:bg-gray-700">
                    แจ้งเรื่อง
                </button>
            </div>

            <div className="border-t border-gray-100 pt-4 space-y-3">
                <div className="text-sm text-gray-700 grid grid-cols-2 gap-x-6 gap-y-2">
                    <DetailRow label="วันที่" value={pickupDateTime.toLocaleDateString('th-TH', { year: '2-digit', month: '2-digit', day: '2-digit' })} />
                    <DetailRow label="เวลา" value={pickupDateTime.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} />
                    <DetailRow label="ระยะเวลาเช่า" value={`${job.tripDetails?.rentalHours || 'N/A'} ชั่วโมง`} />
                    <DetailRow label="ราคา" value={`${job.paymentInfo?.totalPrice?.toLocaleString() || 'N/A'} บาท`} />
                </div>
                <div className="text-sm text-gray-700 space-y-2 pt-2">
                    <div className="flex flex-col">
                        <span className="text-gray-500">จุดรับ</span>
                        <span className="font-semibold text-gray-800">{job.pickupInfo?.name || 'N/A'}</span>
                    </div>
                    <div className="flex flex-col">
                        <span className="text-gray-500">จุดส่ง</span>
                        <span className="font-semibold text-gray-800">{job.dropoffInfo?.address.split(',')[0] || 'N/A'}</span>
                    </div>
                </div>
            </div>

            {job.driverInfo ? (
                <div className="flex justify-between items-center border-t border-gray-100 pt-4">
                    <div className="flex items-center space-x-3">
                        <Image
                            src={job.driverInfo.imageUrl || 'https://via.placeholder.com/150'}
                            alt={job.driverInfo.firstName}
                            width={40}
                            height={40}
                            className="w-10 h-10 rounded-full object-cover bg-gray-200"
                        />
                        <div>
                            <p className="text-xs text-gray-500">driver</p>
                            <p className="font-semibold text-sm text-gray-800">
                                {job.driverInfo.firstName}
                            </p>
                        </div>
                    </div>
                    <div className="text-right w-1/3">
                        <p className="font-bold text-xs text-gray-500 uppercase tracking-wider mb-1">
                            {statusConfig[job.status]?.text || job.status}
                        </p>
                        <ProgressBar status={job.status} />
                    </div>
                    <a href={`tel:${job.driverInfo.phoneNumber}`} className={`bg-gray-200 text-black px-6 py-2 rounded-full font-semibold text-sm ${!job.driverInfo.phoneNumber ? 'opacity-50 cursor-not-allowed' : ''}`}>
                        โทร
                    </a>
                </div>
            ) : (
                <div className="border-t border-gray-100 pt-3 text-center flex justify-center items-center gap-x-4">
                    <span className="font-semibold text-sm bg-yellow-100 text-yellow-800 py-2 px-4 rounded-full inline-block">
                        {statusConfig[job.status]?.text || 'รอการยืนยัน'}
                    </span>
                    {job.status === 'pending' && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onCancel.openModal(job.id);
                            }}
                            disabled={isCancelling}
                            className="text-sm bg-red-500 text-white font-bold py-2 px-4 rounded-full hover:bg-red-600 transition-colors disabled:bg-gray-400"
                        >
                            {isCancelling ? 'กำลังยกเลิก...' : 'ยกเลิก'}
                        </button>
                    )}
                </div>
            )}
        </div>
    );
};

const DetailRow = ({ label, value }) => (
    <div className="flex justify-between">
        <span className="text-gray-500">{label}</span>
        <span className="font-semibold text-right">{value}</span>
    </div>
);

export default function MyBookingsPage() {
    const { profile, loading: liffLoading, error: liffError } = useLiffContext();
    const [bookings, setBookings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isCancelling, setIsCancelling] = useState(false);
    const [notification, setNotification] = useState({ show: false, title: '', message: '', type: 'success' });
    const [cancelModal, setCancelModal] = useState({ show: false, bookingId: null });

    useEffect(() => {
        if (notification.show) {
            const timer = setTimeout(() => {
                setNotification({ show: false, title: '', message: '', type: 'success' });
            }, 5000);
            return () => clearTimeout(timer);
        }
    }, [notification]);

    useEffect(() => {
        if (liffLoading || !profile?.userId) {
            if (!liffLoading) setLoading(false);
            return;
        }

        setLoading(true);
        const bookingsQuery = query(
            collection(db, 'bookings'),
            where("userId", "==", profile.userId),
            where("status", "in", ['pending', 'confirmed', 'assigned', 'stb', 'pickup'])
        );

        const unsubscribe = onSnapshot(bookingsQuery, async (querySnapshot) => {
            const bookingsData = await Promise.all(querySnapshot.docs.map(async (bookingDoc) => {
                const job = { id: bookingDoc.id, ...bookingDoc.data() };
                if (job.driverId) {
                    const driverRef = doc(db, 'drivers', job.driverId);
                    const driverSnap = await getDoc(driverRef);
                    if (driverSnap.exists()) {
                        job.driverInfo = driverSnap.data();
                    }
                }
                return job;
            }));

            bookingsData.sort((a, b) => (b.createdAt?.toDate() || 0) - (a.createdAt?.toDate() || 0));
            setBookings(bookingsData);
            setLoading(false);
        }, (error) => {
            console.error("Error fetching real-time bookings:", error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [profile, liffLoading]);

    const handleCancelBooking = async () => {
        if (!cancelModal.bookingId || !profile || !profile.userId) {
            setNotification({ show: true, title: 'เกิดข้อผิดพลาด', message: 'ไม่สามารถระบุข้อมูลที่จำเป็นได้', type: 'error' });
            return;
        }

        setIsCancelling(true);
        try {
            const result = await cancelBookingByUser(cancelModal.bookingId, profile.userId);
            if (result.success) {
                setNotification({ show: true, title: 'สำเร็จ', message: 'การจองของคุณถูกยกเลิกแล้ว', type: 'success' });
            } else {
                throw new Error(result.error);
            }
        } catch (error) {
            setNotification({ show: true, title: 'เกิดข้อผิดพลาด', message: error.message, type: 'error' });
        } finally {
            setIsCancelling(false);
            setCancelModal({ show: false, bookingId: null });
        }
    };

    if (liffLoading) {
        return <div className="p-4 text-center">รอสักครู่...</div>;
    }
    if (liffError) {
        return <div className="p-4 text-center text-red-500">LIFF Error: {liffError}</div>;
    }

    return (
        <div className="space-y-5">
            <Notification {...notification} />
            <ConfirmationModal
                show={cancelModal.show}
                title="ยืนยันการยกเลิก"
                message="คุณต้องการยกเลิกการจองนี้ใช่หรือไม่?"
                onConfirm={handleCancelBooking}
                onCancel={() => setCancelModal({ show: false, bookingId: null })}
                isProcessing={isCancelling}
            />

            <div className="flex items-center space-x-3">
                <Link href="/booking" className="w-full bg-white text-primary rounded-full py-4 text-center font-semibold shadow">
                    จองรถ
                </Link>
            </div>

            <div className="flex bg-white rounded-full shadow-sm p-1">
                <button className="w-1/2 bg-slate-800 text-white rounded-full py-2 font-semibold">
                    รายการจองของฉัน
                </button>
                <Link href="/my-bookings/history" className="w-1/2 text-center py-2 text-gray-600 font-semibold">
                    ประวัติการจอง
                </Link>
            </div>

            <div className="space-y-4">
                {loading ? (
                    <div className="text-center text-gray-500 pt-10">กำลังโหลดรายการจอง...</div>
                ) : bookings.length === 0 ? (
                    <div className="text-center text-gray-500 pt-10 bg-white p-8 rounded-2xl shadow">
                        <p className="font-semibold">ไม่มีรายการจองที่กำลังดำเนินอยู่</p>
                    </div>
                ) : (
                    bookings.map(job => (
                        <BookingCard
                            key={job.id}
                            job={job}
                            onCancel={{
                                openModal: (bookingId) => setCancelModal({ show: true, bookingId }),
                                showNotification: setNotification
                            }}
                            isCancelling={isCancelling && cancelModal.bookingId === job.id}
                        />
                    ))
                )}
            </div>
        </div>
    );
}
