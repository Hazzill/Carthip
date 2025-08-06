"use client";

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { db } from '@/app/lib/firebase';
import { doc, getDoc, updateDoc, collection, addDoc, getDocs, query, where, serverTimestamp } from 'firebase/firestore';
import { sendLineMessage } from '@/app/actions/lineActions';

// --- Icon Components for Timeline ---
const CheckCircleIcon = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-green-500" viewBox="0 0 20 20" fill="currentColor" {...props}>
    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
  </svg>
);

// --- Helper Components ---
const statusTranslations = {
    'pending': 'รอการยืนยัน', 'confirmed': 'รอมอบหมายงาน', 'assigned': 'มอบหมายแล้ว',
    'stb': 'คนขับถึงจุดรับ', 'pickup': 'กำลังเดินทาง', 'completed': 'สำเร็จ',
    'cancelled': 'ยกเลิก', 'noshow': 'ไม่พบลูกค้า'
};

const InfoCard = ({ title, children }) => (
    <div className="bg-white p-6 rounded-lg shadow-md">
        <h2 className="text-xl font-bold text-gray-800 mb-4 border-b pb-2">{title}</h2>
        <div className="space-y-3">{children}</div>
    </div>
);

const DetailRow = ({ label, value }) => (
    <div className="flex justify-between items-start text-sm">
        <span className="text-gray-500">{label}</span>
        <span className="font-semibold text-gray-800 text-right">{value}</span>
    </div>
);

const StatusTimeline = ({ history = [], createdAt }) => {
    const timelineEvents = [
        { status: 'created', timestamp: createdAt, note: 'สร้างรายการจอง' },
        ...history.sort((a, b) => a.timestamp.toDate() - b.timestamp.toDate())
    ];

    return (
        <InfoCard title="ไทม์ไลน์สถานะ">
            <ul className="space-y-4">
                {timelineEvents.map((event, index) => (
                    <li key={index} className="flex gap-x-3">
                        <div className="relative last:after:hidden">
                            <div className="relative flex h-6 w-6 items-center justify-center">
                                <CheckCircleIcon />
                            </div>
                            {index < timelineEvents.length - 1 && (
                                <div className="absolute left-3 top-6 h-full w-px bg-gray-200" />
                            )}
                        </div>
                        <div className="flex-auto py-0.5">
                            <p className="text-sm font-semibold text-gray-800">
                                {statusTranslations[event.status] || event.note}
                            </p>
                            <p className="text-xs text-gray-500">
                                {event.timestamp.toDate().toLocaleString('th-TH')}
                            </p>
                            {event.note && event.status !== 'created' && (
                                <p className="text-xs italic text-gray-500 mt-1">"{event.note}"</p>
                            )}
                        </div>
                    </li>
                ))}
            </ul>
        </InfoCard>
    );
};


export default function BookingDetailPage() {
    const [booking, setBooking] = useState(null);
    const [drivers, setDrivers] = useState([]);
    const [assignedDriver, setAssignedDriver] = useState(null);
    const [selectedDriverId, setSelectedDriverId] = useState('');
    const [loading, setLoading] = useState(true);
    const [isAssigning, setIsAssigning] = useState(false);
    const params = useParams();
    const router = useRouter();
    const { id } = params;

    useEffect(() => {
        if (!id) return;

        const fetchData = async () => {
            setLoading(true);
            try {
                const bookingDocRef = doc(db, 'bookings', id);
                const bookingDocSnap = await getDoc(bookingDocRef);

                if (bookingDocSnap.exists()) {
                    const bookingData = { id: bookingDocSnap.id, ...bookingDocSnap.data() };
                    setBooking(bookingData);
                    setSelectedDriverId(bookingData.driverId || '');

                    if (bookingData.driverId) {
                        const driverDocRef = doc(db, 'drivers', bookingData.driverId);
                        const driverDocSnap = await getDoc(driverDocRef);
                        if (driverDocSnap.exists()) {
                            setAssignedDriver(driverDocSnap.data());
                        }
                    }
                } else {
                    alert("ไม่พบข้อมูลการจอง");
                    router.push('/dashboard');
                    return;
                }

                const driversQuery = query(collection(db, 'drivers'), where("status", "==", "available"));
                const driversSnapshot = await getDocs(driversQuery);
                const driversList = driversSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                setDrivers(driversList);

            } catch (error) {
                console.error("Error fetching data:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [id, router]);

    const handleAssignDriver = async () => {
        if (!selectedDriverId) {
            alert("กรุณาเลือกคนขับก่อน");
            return;
        }
        setIsAssigning(true);
        try {
            const bookingDocRef = doc(db, 'bookings', id);
            await updateDoc(bookingDocRef, {
                driverId: selectedDriverId,
                status: 'assigned',
                updatedAt: serverTimestamp()
            });

            // --- **จุดที่แก้ไข** ---
            // เปลี่ยนสถานะคนขับที่ถูกเลือกเป็น 'on_trip' (กำลังทำงาน)
            const driverDocRef = doc(db, 'drivers', selectedDriverId);
            await updateDoc(driverDocRef, {
                status: 'on_trip' 
            });

            const selectedDriver = drivers.find(d => d.id === selectedDriverId);

            if (selectedDriver && selectedDriver.lineUserId) {
                const driverMessage = `คุณได้รับงานใหม่!\n\nลูกค้า: ${booking.customerInfo.name}\nรับที่: ${booking.pickupInfo.address}\nเวลา: ${booking.pickupInfo.dateTime.toDate().toLocaleString('th-TH')}`;
                await sendLineMessage(selectedDriver.lineUserId, driverMessage);
            }
            
            if (booking.userId && selectedDriver) {
                const customerMessage = `การจองของคุณได้รับการยืนยันคนขับแล้ว!\n\nคนขับ: ${selectedDriver.firstName}\nรถ: ${booking.vehicleInfo.brand} ${booking.vehicleInfo.model}\nทะเบียน: ${booking.vehicleInfo.plateNumber}`;
                await sendLineMessage(booking.userId, customerMessage);
            }

            alert("มอบหมายงานและส่งแจ้งเตือนสำเร็จ!");
            router.push('/dashboard');

        } catch (error) {
            console.error("Error assigning driver:", error);
            alert("เกิดข้อผิดพลาดในการมอบหมายงาน: " + error.message);
        } finally {
            setIsAssigning(false);
        }
    };
    
    if (loading) return <div className="text-center mt-20">กำลังโหลดข้อมูล...</div>;
    if (!booking) return <div className="text-center mt-20">ไม่พบข้อมูลการจอง</div>;

    return (
        <div className="container mx-auto p-4 md:p-8">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-3xl font-bold">รายละเอียดการจอง #{booking.id.substring(0, 6).toUpperCase()}</h1>
                    <p className="text-gray-500">สถานะปัจจุบัน: <span className="font-semibold text-slate-800">{statusTranslations[booking.status]}</span></p>
                </div>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                    <InfoCard title="ข้อมูลการเดินทาง">
                        <DetailRow label="วัน-เวลาที่นัดรับ" value={booking.pickupInfo.dateTime.toDate().toLocaleString('th-TH')} />
                        <DetailRow label="จุดรับ" value={booking.pickupInfo.address} />
                        <DetailRow label="จุดส่ง" value={booking.dropoffInfo.address} />
                        <DetailRow label="จำนวนชั่วโมง" value={`${booking.tripDetails.rentalHours} ชั่วโมง`} />
                        <DetailRow label="หมายเหตุจากลูกค้า" value={booking.tripDetails.noteToDriver || '-'} />
                    </InfoCard>

                    <InfoCard title="ข้อมูลลูกค้า">
                        <DetailRow label="ชื่อ" value={booking.customerInfo.name} />
                        <DetailRow label="เบอร์โทรศัพท์" value={booking.customerInfo.phone} />
                        <DetailRow label="ผู้โดยสาร" value={`${booking.tripDetails.passengers} คน, ${booking.tripDetails.bags} กระเป๋า`} />
                    </InfoCard>

                    <InfoCard title="ข้อมูลรถและคนขับ">
                         <DetailRow label="รถที่เลือก" value={`${booking.vehicleInfo.brand} ${booking.vehicleInfo.model} (${booking.vehicleInfo.plateNumber})`} />
                         <DetailRow label="คนขับที่มอบหมาย" value={assignedDriver ? `${assignedDriver.firstName} ${assignedDriver.lastName}` : 'ยังไม่มอบหมาย'} />
                         {assignedDriver && <DetailRow label="เบอร์โทรคนขับ" value={assignedDriver.phoneNumber} />}
                    </InfoCard>

                    <InfoCard title="ข้อมูลการชำระเงิน">
                        <DetailRow label="ราคารวม" value={`${booking.paymentInfo.totalPrice.toLocaleString()} บาท`} />
                        <DetailRow label="สถานะ" value={booking.paymentInfo.paymentStatus === 'paid' ? 'ชำระแล้ว' : 'ยังไม่ชำระ'} />
                    </InfoCard>
                </div>

                <div className="lg:col-span-1 space-y-6">
                     <InfoCard title="จัดการงาน">
                        <div className="space-y-4">
                            <div>
                                <label htmlFor="driverSelect" className="block text-sm font-medium text-gray-700">เลือกคนขับที่ว่าง</label>
                                <select
                                    id="driverSelect"
                                    value={selectedDriverId}
                                    onChange={(e) => setSelectedDriverId(e.target.value)}
                                    className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                                >
                                    <option value="">-- เลือกคนขับ --</option>
                                    {drivers.length > 0 ? (
                                        drivers.map(driver => (
                                            <option key={driver.id} value={driver.id}>
                                                {driver.firstName} {driver.lastName}
                                            </option>
                                        ))
                                    ) : (
                                        <option value="" disabled>ไม่มีคนขับที่พร้อมให้บริการ</option>
                                    )}
                                </select>
                            </div>
                            <button
                                onClick={handleAssignDriver}
                                disabled={loading || isAssigning || !selectedDriverId}
                                className="w-full bg-slate-800 text-white p-2 rounded-md font-semibold hover:bg-slate-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                            >
                                {isAssigning ? 'กำลังมอบหมาย...' : 'ยืนยันการมอบหมาย'}
                            </button>
                        </div>
                    </InfoCard>

                    <StatusTimeline history={booking.statusHistory} createdAt={booking.createdAt} />
                </div>
            </div>
        </div>
    );
}