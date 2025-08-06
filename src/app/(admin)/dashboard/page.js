"use client";

import { useState, useEffect } from 'react';
import { db } from '@/app/lib/firebase';
import { collection, query, orderBy, onSnapshot, doc, getDoc } from 'firebase/firestore';
import Link from 'next/link';
import Image from 'next/image';
import { cancelBookingByAdmin, sendInvoiceToCustomer, confirmPayment, sendReviewRequestToCustomer } from '@/app/actions/bookingActions';

// --- Modal Component for Cancellation ---
function CancelBookingModal({ booking, onClose, onConfirm }) {
    const [reason, setReason] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async () => {
        if (!reason.trim()) {
            alert('กรุณาระบุเหตุผลการยกเลิก');
            return;
        }
        setIsSubmitting(true);
        await onConfirm(booking.id, reason);
        setIsSubmitting(false);
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50 p-4">
            <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-md">
                <h2 className="text-xl font-bold mb-2 text-gray-800">ยืนยันการยกเลิก</h2>
                <p className="text-sm text-gray-600 mb-4">
                    คุณต้องการยกเลิกการจองของ <span className="font-semibold">{booking.customerInfo.name}</span> (ID: {booking.id.substring(0, 6).toUpperCase()}) ใช่หรือไม่?
                </p>
                <div>
                    <label htmlFor="cancellationReason" className="block text-sm font-medium text-gray-700">
                        เหตุผลการยกเลิก <span className="text-red-500">*</span>
                    </label>
                    <textarea
                        id="cancellationReason"
                        rows="3"
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        className="w-full mt-1 p-2 border rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                        placeholder="เช่น รถเสีย, ลูกค้าขอเลื่อนการเดินทาง"
                    ></textarea>
                </div>
                <div className="flex justify-end space-x-3 mt-5">
                    <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 font-semibold">
                        ปิด
                    </button>
                    <button
                        type="button"
                        onClick={handleSubmit}
                        disabled={isSubmitting}
                        className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 font-semibold disabled:bg-gray-400"
                    >
                        {isSubmitting ? 'กำลังยกเลิก...' : 'ยืนยันการยกเลิก'}
                    </button>
                </div>
            </div>
        </div>
    );
}

// --- Modal Component for Invoice Preview ---
function InvoicePreviewModal({ booking, onClose, onConfirm }) {
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    const paymentUrl = `https://liff.line.me/${process.env.NEXT_PUBLIC_CUSTOMER_LIFF_ID}/payment/${booking.id}`;
    const customerMessage = `เรียนคุณ ${booking.customerInfo.name},\n\nนี่คือใบแจ้งค่าบริการสำหรับการเดินทางของคุณ\nยอดชำระ: ${booking.paymentInfo.totalPrice.toLocaleString()} บาท\n\nกรุณาคลิกที่ลิงก์เพื่อชำระเงิน:\n${paymentUrl}`;

    const handleSubmit = async () => {
        setIsSubmitting(true);
        await onConfirm(booking.id);
        setIsSubmitting(false);
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50 p-4">
            <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-md">
                <h2 className="text-xl font-bold mb-2 text-gray-800">ตัวอย่างใบแจ้งหนี้</h2>
                <p className="text-sm text-gray-600 mb-4">
                    ระบบจะส่งข้อความด้านล่างนี้ไปยัง LINE ของลูกค้า
                </p>
                <div className="bg-gray-100 p-4 rounded-md border border-gray-200 mb-5">
                    <pre className="text-sm text-gray-800 whitespace-pre-wrap font-sans">
                        {customerMessage}
                    </pre>
                </div>
                <div className="flex justify-end space-x-3">
                    <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 font-semibold">
                        ยกเลิก
                    </button>
                    <button
                        type="button"
                        onClick={handleSubmit}
                        disabled={isSubmitting}
                        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-semibold disabled:bg-gray-400"
                    >
                        {isSubmitting ? 'กำลังส่ง...' : 'ยืนยันและส่ง'}
                    </button>
                </div>
            </div>
        </div>
    );
}


// --- Status Translations ---
const statusTranslations = {
    'pending': 'รอการยืนยัน',
    'confirmed': 'รอมอบหมายงาน',
    'assigned': 'มอบหมายแล้ว',
    'stb': 'คนขับถึงจุดรับ',
    'pickup': 'กำลังเดินทาง',
    'completed': 'สำเร็จ',
    'cancelled': 'ยกเลิก',
    'noshow': 'ไม่พบลูกค้า'
};

// --- Status Tabs ---
const statusTabs = [
    { key: 'ongoing', label: 'งานที่กำลังดำเนิน' },
    { key: 'pending_payment', label: 'รอเรียกเก็บเงิน' },
    { key: 'finished', label: 'งานเสร็จสิ้น' }
];

const ProgressBar = ({ status }) => {
    const steps = ['confirmed', 'assigned', 'stb', 'pickup', 'completed'];
    const currentStepIndex = steps.indexOf(status);
    
    if (status === 'pending') {
        return (
            <div className="w-full bg-gray-200 rounded-full h-2.5">
                <div className="bg-yellow-400 h-2.5 rounded-full" style={{ width: '5%' }}></div>
            </div>
        );
    }

    if (currentStepIndex === -1) {
         return <div className="w-full bg-gray-200 rounded-full h-2.5"></div>;
    }

    return (
        <div className="w-full bg-gray-200 rounded-full h-2.5">
            <div 
                className="bg-green-500 h-2.5 rounded-full transition-all duration-500" 
                style={{ width: `${((currentStepIndex + 1) / steps.length) * 100}%` }}
            ></div>
        </div>
    );
};

export default function AdminDashboardPage() {
    const [allBookings, setAllBookings] = useState([]);
    const [filteredBookings, setFilteredBookings] = useState([]);
    const [activeTab, setActiveTab] = useState('ongoing');
    const [dateFilter, setDateFilter] = useState({
        type: 'all',
        startDate: '',
        endDate: ''
    });
    const [loading, setLoading] = useState(true);
    const [drivers, setDrivers] = useState({});
    const [bookingToCancel, setBookingToCancel] = useState(null);
    const [bookingToInvoice, setBookingToInvoice] = useState(null);

    useEffect(() => {
        const bookingsQuery = query(collection(db, 'bookings'), orderBy('createdAt', 'desc'));
        
        const unsubscribeBookings = onSnapshot(bookingsQuery, async (querySnapshot) => {
            setLoading(true);
            const newDrivers = {};
            
            const bookingsData = await Promise.all(querySnapshot.docs.map(async (bookingDoc) => {
                const booking = { id: bookingDoc.id, ...bookingDoc.data() };
                if (booking.driverId && !drivers[booking.driverId] && !newDrivers[booking.driverId]) {
                    try {
                        const driverRef = doc(db, 'drivers', booking.driverId);
                        const driverSnap = await getDoc(driverRef);
                        if (driverSnap.exists()) {
                            newDrivers[booking.driverId] = driverSnap.data();
                        }
                    } catch (error) {
                        console.error("Error fetching driver data:", error);
                    }
                }
                return booking;
            }));
            
            if (Object.keys(newDrivers).length > 0) {
                 setDrivers(prev => ({ ...prev, ...newDrivers }));
            }

            setAllBookings(bookingsData);
            setLoading(false);
        }, (error) => {
            console.error("Error fetching bookings:", error);
            setLoading(false);
        });

        return () => unsubscribeBookings();
    }, []);

    useEffect(() => {
        let filtered;
        if (activeTab === 'ongoing') {
            const ongoingStatuses = ['pending', 'confirmed', 'assigned', 'stb', 'pickup'];
            filtered = allBookings.filter(booking => ongoingStatuses.includes(booking.status));
        } else if (activeTab === 'pending_payment') {
            filtered = allBookings.filter(booking =>
                booking.status === 'completed' &&
                (booking.paymentInfo.paymentStatus === 'unpaid' || booking.paymentInfo.paymentStatus === 'invoiced')
            );
        } else { // 'finished'
            filtered = allBookings.filter(booking =>
                (booking.status === 'completed' && booking.paymentInfo.paymentStatus === 'paid') ||
                ['cancelled', 'noshow'].includes(booking.status)
            );
        }

        if (dateFilter.startDate && dateFilter.endDate) {
            const startOfDay = new Date(dateFilter.startDate);
            startOfDay.setHours(0, 0, 0, 0);

            const endOfDay = new Date(dateFilter.endDate);
            endOfDay.setHours(23, 59, 59, 999);

            filtered = filtered.filter(booking => {
                if (booking.pickupInfo?.dateTime?.toDate) {
                    const bookingDate = booking.pickupInfo.dateTime.toDate();
                    return bookingDate >= startOfDay && bookingDate <= endOfDay;
                }
                return false;
            });
        }
        
        setFilteredBookings(filtered);
    }, [allBookings, activeTab, dateFilter]);

    const getTabCount = (tabKey) => {
        if (tabKey === 'ongoing') {
            const ongoingStatuses = ['pending', 'confirmed', 'assigned', 'stb', 'pickup'];
            return allBookings.filter(b => ongoingStatuses.includes(b.status)).length;
        }
        if (tabKey === 'pending_payment') {
            return allBookings.filter(b => b.status === 'completed' && (b.paymentInfo.paymentStatus === 'unpaid' || b.paymentInfo.paymentStatus === 'invoiced')).length;
        }
        if (tabKey === 'finished') {
            return allBookings.filter(b => (b.status === 'completed' && b.paymentInfo.paymentStatus === 'paid') || ['cancelled', 'noshow'].includes(b.status)).length;
        }
        return 0;
    };

    const handleConfirmCancel = async (bookingId, reason) => {
        try {
            const result = await cancelBookingByAdmin(bookingId, reason);
            if (result.success) {
                alert('ยกเลิกการจองสำเร็จและแจ้งลูกค้าแล้ว');
            } else {
                throw new Error(result.error);
            }
        } catch (error) {
            console.error("Failed to cancel booking:", error);
            alert(`เกิดข้อผิดพลาดในการยกเลิก: ${error.message}`);
        }
    };

    const handleSendInvoice = async (bookingId) => {
        try {
            const result = await sendInvoiceToCustomer(bookingId);
            if (result.success) {
                alert("ส่งใบแจ้งหนี้ให้ลูกค้าสำเร็จแล้ว");
            } else {
                throw new Error(result.error);
            }
        } catch (error) {
            alert(`เกิดข้อผิดพลาด: ${error.message}`);
        }
    };

    const handleConfirmPayment = async (bookingId) => {
        if (window.confirm("ยืนยันว่าได้รับชำระเงินสำหรับงานนี้แล้วใช่หรือไม่?")) {
            try {
                const result = await confirmPayment(bookingId);
                if (result.success) {
                    alert("ยืนยันการชำระเงินสำเร็จ");
                } else {
                    throw new Error(result.error);
                }
            } catch (error) {
                alert(`เกิดข้อผิดพลาด: ${error.message}`);
            }
        }
    };
    
    const handleSendReviewRequest = async (booking) => {
        if (window.confirm(`คุณต้องการส่งคำขอรีวิวให้คุณ ${booking.customerInfo.name} ใช่หรือไม่?`)) {
            try {
                const result = await sendReviewRequestToCustomer(booking.id);
                if (result.success) {
                    alert("ส่งคำขอรีวิวให้ลูกค้าสำเร็จแล้ว");
                } else {
                    throw new Error(result.error);
                }
            } catch (error) {
                alert(`เกิดข้อผิดพลาด: ${error.message}`);
            }
        }
    };

    if (loading) {
        return <div className="text-center p-10">Loading Dashboard...</div>;
    }

    return (
        <div className="container mx-auto p-4 md:p-6">
            {bookingToCancel && (
                <CancelBookingModal
                    booking={bookingToCancel}
                    onClose={() => setBookingToCancel(null)}
                    onConfirm={handleConfirmCancel}
                />
            )}
            {bookingToInvoice && (
                <InvoicePreviewModal
                    booking={bookingToInvoice}
                    onClose={() => setBookingToInvoice(null)}
                    onConfirm={handleSendInvoice}
                />
            )}
            <div className="flex flex-col md:flex-row md:items-center justify-between mb-4 gap-4">
                <div className="border-b border-gray-200">
                    <nav className="-mb-px flex space-x-6 overflow-x-auto">
                        {statusTabs.map(tab => (
                            <button
                                key={tab.key}
                                onClick={() => setActiveTab(tab.key)}
                                className={`whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm ${
                                    activeTab === tab.key
                                    ? 'border-slate-800 text-slate-900'
                                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                }`}
                            >
                                {tab.label} ({getTabCount(tab.key)})
                            </button>
                        ))}
                    </nav>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                    <button onClick={() => setDateFilter({ type: 'all', startDate: '', endDate: '' })} className={`px-3 py-1 text-sm rounded-md ${dateFilter.type === 'all' ? 'bg-slate-800 text-white' : 'bg-white border'}`}>ทั้งหมด</button>
                    <button onClick={() => {
                        const today = new Date().toISOString().split('T')[0];
                        setDateFilter({ type: 'custom', startDate: today, endDate: today });
                    }} className={`px-3 py-1 text-sm rounded-md ${dateFilter.type === 'today' ? 'bg-slate-800 text-white' : 'bg-white border'}`}>วันนี้</button>
                    <div className="flex items-center gap-2">
                        <input 
                            type="date"
                            value={dateFilter.startDate}
                            onChange={(e) => setDateFilter({ ...dateFilter, type: 'custom', startDate: e.target.value })}
                            className="p-1.5 border rounded-md shadow-sm text-sm"
                        />
                        <span>-</span>
                        <input 
                            type="date"
                            value={dateFilter.endDate}
                            onChange={(e) => setDateFilter({ ...dateFilter, type: 'custom', endDate: e.target.value })}
                            className="p-1.5 border rounded-md shadow-sm text-sm"
                        />
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {filteredBookings.length > 0 ? filteredBookings.map(booking => {
                    const driver = booking.driverId ? drivers[booking.driverId] : null;
                    const isCancellable = ['pending', 'confirmed', 'assigned', 'stb', 'pickup'].includes(booking.status);
                    
                    return (
                        <div key={booking.id} className="bg-white rounded-lg shadow-md flex flex-col">
                            <div className="p-4 border-b flex justify-between items-center bg-gray-50 rounded-t-lg">
                                <p className="font-bold text-slate-800">บิล {booking.id.substring(0, 6).toUpperCase()}</p>
                                <p className="text-sm text-gray-600">
                                    {booking.pickupInfo?.dateTime?.toDate ? (
                                        <>
                                            {booking.pickupInfo.dateTime.toDate().toLocaleDateString('th-TH', { day: '2-digit', month: 'short', year: 'numeric' })}
                                            {' '}
                                            {booking.pickupInfo.dateTime.toDate().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}
                                        </>
                                    ) : 'ไม่มีข้อมูลเวลา'}
                                </p>
                            </div>
                            <div className="p-4 space-y-3 flex-grow">
                                <div className="flex items-start space-x-4">
                                    <Image src={booking.vehicleInfo?.imageUrl || '/placeholder.png'} alt="car" width={64} height={64} className="rounded-md object-cover w-16 h-16"/>
                                    <div className="flex-grow">
                                        <p className="font-bold">{booking.vehicleInfo?.brand} {booking.vehicleInfo?.model}</p>
                                        <p className="text-sm text-gray-500">
                                            {booking.tripDetails?.rentalHours || 0} ชม. / {booking.tripDetails?.passengers || 0} คน / {booking.tripDetails?.bags || 0} กระเป๋า
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        <p className="font-semibold">{booking.customerInfo?.name || 'ไม่มีชื่อ'}</p>
                                        <p className="text-sm text-gray-500">{booking.customerInfo?.phone || ''}</p>
                                    </div>
                                </div>
                                <div className="text-sm space-y-1">
                                    <p><strong>รับ:</strong> {booking.pickupInfo?.address || 'N/A'}</p>
                                    <p><strong>ส่ง:</strong> {booking.dropoffInfo?.address || 'N/A'}</p>
                                </div>
                            </div>
                            <div className="p-4 border-t flex flex-col items-start gap-3">
                                <div className="w-full flex justify-between items-center">
                                     <div>
                                        <p className="text-xs text-gray-500">สถานะชำระเงิน</p>
                                        <p className="font-semibold text-sm">
                                            {booking.paymentInfo.paymentStatus === 'paid' ? 'ชำระแล้ว' : 
                                             booking.paymentInfo.paymentStatus === 'invoiced' ? 'รอชำระ' : 'ยังไม่เรียกเก็บ'}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-500 text-right">คนขับ</p>
                                        <p className="font-semibold text-sm">{driver ? `${driver.firstName}` : 'ยังไม่มี'}</p>
                                    </div>
                                </div>
                                <div className="w-full flex items-center gap-2 flex-wrap justify-end">
                                    {booking.status === 'completed' && booking.paymentInfo.paymentStatus === 'unpaid' && (
                                        <button 
                                            onClick={() => setBookingToInvoice(booking)}
                                            className="bg-blue-500 text-white px-3 py-2 rounded-lg font-semibold text-xs hover:bg-blue-600">
                                            เรียกเก็บเงิน
                                        </button>
                                    )}
                                    {booking.status === 'completed' && !booking.reviewInfo?.submitted && (
                                        <button
                                            onClick={() => handleSendReviewRequest(booking)}
                                            className="bg-purple-500 text-white px-3 py-2 rounded-lg font-semibold text-xs hover:bg-purple-600">
                                            ส่งรีวิว
                                        </button>
                                    )}
                                    {booking.paymentInfo.paymentStatus === 'invoiced' && (
                                         <button onClick={() => handleConfirmPayment(booking.id)} className="bg-green-500 text-white px-3 py-2 rounded-lg font-semibold text-xs hover:bg-green-600">
                                            ยืนยันชำระเงิน
                                        </button>
                                    )}
                                    {isCancellable && (
                                        <button 
                                            onClick={() => setBookingToCancel(booking)}
                                            className="bg-red-100 text-red-700 px-3 py-2 rounded-lg font-semibold text-sm hover:bg-red-200"
                                        >
                                            ยกเลิก
                                        </button>
                                    )}
                                    <Link href={`/bookings/${booking.id}`} className="bg-primary text-white px-3 py-2 rounded-lg font-semibold text-xs hover:bg-gray-700">
                                        รายละเอียด
                                    </Link>
                                </div>
                            </div>
                            <div className="bg-primary p-3 rounded-b-lg text-white">
                                <p className="text-sm font-semibold">{statusTranslations[booking.status] || booking.status}</p>
                                <ProgressBar status={booking.status} />
                            </div>
                        </div>
                    )
                }) : (
                    <div className="col-span-full text-center py-10 bg-white rounded-lg shadow-md">
                        <p className="text-gray-500">ไม่พบรายการจองสำหรับเงื่อนไขที่เลือก</p>
                    </div>
                )}
            </div>
        </div>
    );
}
