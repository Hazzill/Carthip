"use client";

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { db } from '@/app/lib/firebase';
import { doc, getDoc } from 'firebase/firestore'; // Removed addDoc, setDoc, collection, serverTimestamp, GeoPoint
import Image from 'next/image';
import { useLiffContext } from '@/context/LiffProvider';
import { createBookingWithCheck } from '@/app/actions/bookingActions'; // Import the new server action

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
// --- End UI Helper Components ---


function ConfirmPageContent() {
    const { profile, loading: liffLoading } = useLiffContext();
    const [vehicle, setVehicle] = useState(null);
    const [bookingDetails, setBookingDetails] = useState(null);
    const [customerInfo, setCustomerInfo] = useState({ name: '', phone: '', email: '' });
    const [note, setNote] = useState('');
    const [totalPrice, setTotalPrice] = useState(0);
    const [loading, setLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    const router = useRouter();
    const searchParams = useSearchParams();

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
                alert(err.message);
                router.push('/booking');
            } finally {
                setLoading(false);
            }
        };
        fetchVehicle();
    }, [searchParams, router, liffLoading]);
    
    const handleConfirmBooking = async () => {
        if (!profile?.userId) {
            alert("ไม่สามารถระบุตัวตนผู้ใช้ได้"); return;
        }
        if (!customerInfo.name || !customerInfo.phone) {
            alert("กรุณากรอกชื่อและเบอร์โทรศัพท์ให้ครบถ้วน"); return;
        }
        
        setIsSubmitting(true);
        
        // Prepare the data payload for the server action
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
                dateTime: new Date(bookingDetails.pickupDateTime).toISOString(), // Send as ISO string
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
            // Call the server action to create the booking with a transaction check
            const result = await createBookingWithCheck(finalBookingData);

            if (result.success) {
                alert("ทำการจองเรียบร้อยแล้ว!");
                router.push('/my-bookings');
            } else {
                // Display the specific error message from the server (e.g., "Vehicle is already booked")
                alert(result.error);
            }
        } catch (error) {
            console.error("Error confirming booking: ", error);
            alert("เกิดข้อผิดพลาดในการยืนยันการจอง: " + error.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    if (liffLoading || loading || !bookingDetails || !vehicle) {
        return <div className="p-4 text-center">กำลังเตรียมข้อมูลการจอง...</div>;
    }

    return (
        <main className="space-y-4">
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