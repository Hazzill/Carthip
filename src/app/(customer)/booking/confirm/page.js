"use client";

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { db } from '@/app/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import Image from 'next/image';
import { useLiffContext } from '@/context/LiffProvider';
import { createBookingWithCheck } from '@/app/actions/bookingActions';

// --- UI Helper Components ---
const InfoCard = ({ title, children }) => (
    <div className="bg-gray-100 rounded-2xl p-5">
        <h2 className="text-xl font-bold text-gray-800 mb-4">{title}</h2>
        <div className="space-y-3">{children}</div>
    </div>
);

const DetailRow = ({ label, value, valueClass = 'text-gray-800' }) => (
    <div className="flex justify-between items-center text-sm">
        <span className="text-gray-500">{label}</span>
        <span className={`font-semibold text-right ${valueClass}`}>{value}</span>
    </div>
);

const FormInput = ({ placeholder, value, onChange, type = 'text', required = true }) => (
    <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        required={required}
        className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400 transition"
    />
);

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


function ConfirmPageContent() {
    const { profile, loading: liffLoading } = useLiffContext();
    const [vehicle, setVehicle] = useState(null);
    const [bookingDetails, setBookingDetails] = useState(null);
    const [customerInfo, setCustomerInfo] = useState({ name: '', phone: '', email: '' });
    const [note, setNote] = useState('');
    const [totalPrice, setTotalPrice] = useState(0);
    const [loading, setLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [notification, setNotification] = useState({ show: false, title: '', message: '', type: 'success' });
    
    const router = useRouter();
    const searchParams = useSearchParams();

    // Effect to handle notification visibility
    useEffect(() => {
        if (notification.show) {
            const timer = setTimeout(() => {
                setNotification({ show: false, title: '', message: '', type: '' });
            }, 5000); // Hide after 5 seconds
            return () => clearTimeout(timer);
        }
    }, [notification]);

    // Effect to fetch existing customer data
    useEffect(() => {
        const fetchCustomerData = async () => {
            if (profile?.userId) {
                const customerRef = doc(db, "customers", profile.userId);
                const customerSnap = await getDoc(customerRef);

                if (customerSnap.exists()) {
                    const customerData = customerSnap.data();
                    setCustomerInfo({
                        name: customerData.name || profile.displayName || '',
                        phone: customerData.phone || '',
                        email: customerData.email || ''
                    });
                } else {
                    setCustomerInfo(prev => ({ ...prev, name: profile.displayName || '' }));
                }
            }
        };
        if (!liffLoading) {
            fetchCustomerData();
        }
    }, [profile, liffLoading]);

    // Effect to fetch booking and vehicle details
    useEffect(() => {
        const params = {
            vehicleId: searchParams.get('vehicleId'),
            passengers: searchParams.get('passengers'),
            bags: searchParams.get('bags'),
            rentalHours: searchParams.get('rentalHours'),
            originName: searchParams.get('originName'),
            originAddress: searchParams.get('originAddress'),
            originLat: searchParams.get('originLat'),
            originLng: searchParams.get('originLng'),
            destAddress: searchParams.get('destAddress'),
            destLat: searchParams.get('destLat'),
            destLng: searchParams.get('destLng'),
            pickupDateTime: searchParams.get('pickupDateTime'),
        };
        
        if (!params.vehicleId) {
            if (!liffLoading) router.push('/booking');
            return;
        }
        setBookingDetails(params);

        const fetchVehicle = async () => {
            setLoading(true);
            try {
                const docRef = doc(db, "vehicles", params.vehicleId);
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    const vehicleData = { id: docSnap.id, ...docSnap.data() };
                    setVehicle(vehicleData);
                    const hours = Number(params.rentalHours) || 0;
                    const pricePerHour = Number(vehicleData.pricePerHour) || 0;
                    setTotalPrice(hours * pricePerHour);
                } else {
                    throw new Error("ไม่พบข้อมูลรถ");
                }
            } catch (err) {
                 setNotification({ show: true, title: 'เกิดข้อผิดพลาด', message: err.message, type: 'error' });
                router.push('/booking');
            } finally {
                setLoading(false);
            }
        };
        fetchVehicle();
    }, [searchParams, router, liffLoading]);

    const handleConfirmBooking = async () => {
        if (!profile?.userId) {
            setNotification({ show: true, title: 'เกิดข้อผิดพลาด', message: "ไม่สามารถระบุตัวตนผู้ใช้ได้", type: 'error' }); return;
        }
        if (!customerInfo.name || !customerInfo.phone) {
            setNotification({ show: true, title: 'ข้อมูลไม่ครบถ้วน', message: "กรุณากรอกชื่อและเบอร์โทรศัพท์", type: 'error' }); return;
        }
        
        setIsSubmitting(true);
        
        const finalBookingData = {
            userId: profile.userId,
            userInfo: { displayName: profile.displayName, pictureUrl: profile.pictureUrl || '' },
            vehicleId: bookingDetails.vehicleId,
            vehicleInfo: {
                brand: vehicle.brand,
                model: vehicle.model,
                plateNumber: vehicle.plateNumber,
                imageUrl: vehicle.imageUrl || '',
                vehicleClass: vehicle.vehicleClass || '',
            },
            status: 'pending',
            pickupInfo: {
                name: bookingDetails.originName || bookingDetails.originAddress,
                address: bookingDetails.originAddress,
                dateTime: new Date(bookingDetails.pickupDateTime).toISOString(),
                latlng: {
                    latitude: parseFloat(bookingDetails.originLat),
                    longitude: parseFloat(bookingDetails.originLng),
                }
            },
            dropoffInfo: {
                address: bookingDetails.destAddress,
                latlng: {
                    latitude: parseFloat(bookingDetails.destLat),
                    longitude: parseFloat(bookingDetails.destLng),
                }
            },
            customerInfo: { ...customerInfo },
            tripDetails: {
                noteToDriver: note,
                passengers: Number(bookingDetails.passengers),
                bags: Number(bookingDetails.bags),
                rentalHours: Number(bookingDetails.rentalHours),
            },
            paymentInfo: {
                pricePerHour: Number(vehicle.pricePerHour || 0),
                overtimeRate: Number(vehicle.overtimeRate || 0),
                totalPrice: totalPrice,
                paymentStatus: 'unpaid'
            },
        };

        try {
            const result = await createBookingWithCheck(finalBookingData);

            if (result.success) {
                setNotification({ show: true, title: 'การจองสำเร็จ!', message: 'ระบบได้บันทึกข้อมูลของคุณแล้ว', type: 'success' });
                setTimeout(() => router.push('/my-bookings'), 2000);
            } else {
                setNotification({ show: true, title: 'เกิดข้อผิดพลาด', message: result.error, type: 'error' });
            }
        } catch (error) {
            console.error("Error confirming booking: ", error);
            setNotification({ show: true, title: 'เกิดข้อผิดพลาดรุนแรง', message: error.message, type: 'error' });
        } finally {
            setIsSubmitting(false);
        }
    };

    if (liffLoading || loading || !bookingDetails || !vehicle) {
        return <div className="p-4 text-center">กำลังเตรียมข้อมูลการจอง...</div>;
    }

    return (
        <main className="space-y-4">
            <Notification 
                show={notification.show}
                title={notification.title}
                message={notification.message}
                type={notification.type}
            />
            
            {/* Vehicle Summary */}
            <div className="bg-gray-100 rounded-2xl  p-4 flex items-center space-x-4">
                <div className="relative w-24 h-20 flex-shrink-0">
                    <Image src={vehicle.imageUrl || '/placeholder.png'} alt={vehicle.brand} fill style={{ objectFit: 'cover' }} className="rounded-lg" />
                </div>
                <div className="flex-grow">
                    <p className="font-bold text-xl text-gray-800">{vehicle.brand} {vehicle.model}</p>
                    <p className="text-sm text-gray-500 font-semibold">{vehicle.vehicleClass}</p>
                </div>
            </div>

            {/* Trip Details */}
            <InfoCard title="รายละเอียดการเดินทาง">
                <DetailRow label="วันที่นัดหมาย" value={new Date(bookingDetails.pickupDateTime).toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' })} />
                <DetailRow label="เวลานัดหมาย" value={`${new Date(bookingDetails.pickupDateTime).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} น.`} />
                <DetailRow label="จำนวนชั่วโมง" value={`${bookingDetails.rentalHours} ชั่วโมง`} />
                <DetailRow label="ผู้โดยสาร" value={`${bookingDetails.passengers} คน`} />
                <DetailRow label="กระเป๋า" value={`${bookingDetails.bags} ใบ`} />
                <DetailRow label="จุดรับ" value={bookingDetails.originName || bookingDetails.originAddress} />
                <DetailRow label="จุดส่ง" value={bookingDetails.destAddress} />
            </InfoCard>

            {/* Pricing */}
            <InfoCard title="สรุปค่าใช้จ่าย">
                <DetailRow label={`ค่าบริการ (${bookingDetails.rentalHours} ชม.)`} value={`${totalPrice.toLocaleString()} บาท`} />
                <div className="border-t border-gray-100 my-2"></div>
                <DetailRow label="ยอดรวม" value={`${totalPrice.toLocaleString()} บาท`} valueClass="text-gray-800 text-lg" />
            </InfoCard>

            {/* Customer Info & Note */}
            <InfoCard title="ข้อมูลผู้ติดต่อ">
                <FormInput placeholder="ชื่อ-นามสกุล*" value={customerInfo.name} onChange={(e) => setCustomerInfo({...customerInfo, name: e.target.value})} />
                <FormInput placeholder="เบอร์โทรศัพท์*" value={customerInfo.phone} onChange={(e) => setCustomerInfo({...customerInfo, phone: e.target.value})} type="tel" />
                <FormInput placeholder="อีเมล (ถ้ามี)" value={customerInfo.email} onChange={(e) => setCustomerInfo({...customerInfo, email: e.target.value})} type="email" required={false} />
         
                <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    rows="3"
                    className="w-full text-sm p-3 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400 transition"
                    placeholder="หมายเหตุถึงคนขับ (ถ้ามี) เช่น เที่ยวบิน, ข้อมูลป้ายรับ"
                ></textarea>
            </InfoCard>

            <button onClick={handleConfirmBooking} disabled={isSubmitting} className="w-full mt-2 p-4 bg-primary text-white rounded-full font-bold text-lg  hover:bg-gray-700 transition disabled:bg-gray-400 disabled:shadow-none">
                {isSubmitting ? 'กำลังบันทึก...' : 'ยืนยันการจอง'}
            </button>
        </main>
    );
}

export default function ConfirmBookingPage() {
    return (
        <Suspense fallback={<div className="p-4 text-center">Loading Page...</div>}>
            <ConfirmPageContent />
        </Suspense>
    );
}