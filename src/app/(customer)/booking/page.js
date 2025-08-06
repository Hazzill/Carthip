"use client";

import { useState, useEffect, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';

// +++ ADDED: Imports สำหรับ react-datepicker +++
import DatePicker, { registerLocale } from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css"; // Import CSS ของ datepicker
import { th } from 'date-fns/locale';

// +++ ADDED: ลงทะเบียน locale ภาษาไทยสำหรับ react-datepicker +++
registerLocale('th', th);

const BookingMap = dynamic(
    () => import('@/app/components/BookingMap'),
    { ssr: false }
);

import { db } from '@/app/lib/firebase';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { useLiffContext } from '@/context/LiffProvider';

// --- Notification Component ---
const Notification = ({ show, title, message, type }) => {
    if (!show) return null;
    const icons = {
        error: (
            <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            </svg>
        ),
    };
    const colors = {
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


function BookingStepOneContent() {
    const { loading: liffLoading } = useLiffContext();
    const [allLocations, setAllLocations] = useState([]);
    const [filteredLocations, setFilteredLocations] = useState([]);
    const [categories, setCategories] = useState(["All"]);
    const [selectedCategory, setSelectedCategory] = useState("All");
    const [origin, setOrigin] = useState(null);
    const [destination, setDestination] = useState(null);
    const [loading, setLoading] = useState(true);
    const router = useRouter();

    const [selectedDate, setSelectedDate] = useState(null);
    const [selectedTime, setSelectedTime] = useState(null);
    const [notification, setNotification] = useState({ show: false, title: '', message: '', type: 'error' });

    useEffect(() => {
        if (notification.show) {
            const timer = setTimeout(() => {
                setNotification({ show: false, title: '', message: '', type: 'error' });
            }, 5000);
            return () => clearTimeout(timer);
        }
    }, [notification]);

    useEffect(() => {
        const fetchLocations = async () => {
            setLoading(true);
            try {
                const locationsQuery = query(collection(db, 'pickup_locations'), orderBy('category'), orderBy('name'));
                const querySnapshot = await getDocs(locationsQuery);
                const locationsData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                setAllLocations(locationsData);
                setFilteredLocations(locationsData);
                if (locationsData.length > 0) {
                    setOrigin(locationsData[0]);
                    const uniqueCategories = ["All", ...new Set(locationsData.map(loc => loc.category))];
                    setCategories(uniqueCategories);
                }
            } catch (err) {
                console.error("Error fetching locations:", err);
            } finally {
                setLoading(false);
            }
        };
        fetchLocations();
    }, []);

    const handleCategoryFilter = (category) => {
        setSelectedCategory(category);
        let filtered = category === "All" ? allLocations : allLocations.filter(loc => loc.category === category);
        setFilteredLocations(filtered);
        setOrigin(filtered.length > 0 ? filtered[0] : null);
    };

    const handleLocationSelect = (locationData) => setDestination(locationData);
    const handleOriginChange = (e) => setOrigin(allLocations.find(loc => loc.id === e.target.value));

    const handleNextStep = () => {
        if (!origin || !destination || !selectedDate || !selectedTime) {
            setNotification({ show: true, title: 'ข้อมูลไม่ครบถ้วน', message: 'กรุณาเลือกข้อมูลการเดินทางให้ครบถ้วน', type: 'error' });
            return;
        }

        const combinedDateTime = new Date(
            selectedDate.getFullYear(),
            selectedDate.getMonth(),
            selectedDate.getDate(),
            selectedTime.getHours(),
            selectedTime.getMinutes()
        );

        if (combinedDateTime < new Date()) {
            setNotification({ show: true, title: 'เลือกเวลาไม่ถูกต้อง', message: 'ไม่สามารถเลือกวันและเวลาในอดีตได้', type: 'error' });
            return;
        }

        const year = combinedDateTime.getFullYear();
        const month = String(combinedDateTime.getMonth() + 1).padStart(2, '0');
        const day = String(combinedDateTime.getDate()).padStart(2, '0');
        const hours = String(combinedDateTime.getHours()).padStart(2, '0');
        const minutes = String(combinedDateTime.getMinutes()).padStart(2, '0');
        const formattedDateTime = `${year}-${month}-${day}T${hours}:${minutes}`;

        const params = new URLSearchParams({
            originName: origin.name,
            originAddress: origin.address,
            originLat: origin.latlng.latitude,
            originLng: origin.latlng.longitude,
            destAddress: destination.address,
            destLat: destination.lat,
            destLng: destination.lng,
            pickupDateTime: formattedDateTime,
        });
        router.push(`booking/select-vehicle?${params.toString()}`);
    };

    if (liffLoading || loading) return <div className="p-4 text-center">กำลังโหลด...</div>;

    return (
        <main className="space-y-4">
            <Notification {...notification} /> 
            <div className="bg-gray-100 p-4 rounded-2xl">
                <label className="block text-sm font-medium text-gray-700 mb-2">ช่วงเวลารับ</label>
                <div className="flex space-x-2">
                    <DatePicker
                        selected={selectedDate}
                        onChange={(date) => setSelectedDate(date)}
                        locale="th"
                        dateFormat="dd/MM/yyyy"
                        placeholderText="วันที่"
                        minDate={new Date()}
                        className="w-full p-2 border border-gray-200 rounded-full bg-white text-center focus:ring-primary focus:border-primary"
                        wrapperClassName="w-full"
                    />
                    <DatePicker
                        selected={selectedTime}
                        onChange={(date) => setSelectedTime(date)}
                        locale="th"
                        showTimeSelect
                        showTimeSelectOnly
                        timeIntervals={15}
                        timeCaption="เวลา"
                        timeFormat="HH:mm"
                        dateFormat="HH:mm"
                        placeholderText="เวลา"
                        className="w-full p-2 border border-gray-200 rounded-full bg-white text-center focus:ring-primary focus:border-primary"
                        wrapperClassName="w-full"
                    />
                </div>
            </div>

            <div className="bg-gray-100 p-4 rounded-2xl">
                <label className="block text-sm font-medium text-gray-700 mb-2">สถานที่รับ</label>
                <div className="flex flex-wrap gap-2 mb-3">
                    {categories.map(cat => (
                        <button
                            key={cat}
                            onClick={() => handleCategoryFilter(cat)}
                            className={`px-3 py-1 text-xs rounded-full font-semibold transition ${selectedCategory === cat ? 'bg-primary text-white' : 'bg-gray-200 text-gray-700'}`}
                        >
                            {cat}
                        </button>
                    ))}
                </div>
                <select
                    value={origin?.id || ''}
                    onChange={handleOriginChange}
                    className="w-full p-2 border border-gray-200 rounded-full bg-gray-200"
                    disabled={filteredLocations.length === 0}
                >
                    {filteredLocations.map(loc => <option key={loc.id} value={loc.id}>{loc.name}</option>)}
                </select>
            </div>

            <div className="bg-gray-100 p-4 rounded-2xl">
                <label className="block text-sm font-medium text-gray-700 mb-2">สถานที่ส่ง</label>
                <BookingMap onLocationSelect={handleLocationSelect} />
            </div>

            <button 
                onClick={handleNextStep}
                className="w-full mt-4 p-3 bg-primary text-white rounded-full font-bold text-lg hover:bg-gray-700 transition disabled:bg-gray-400"
            >
                ค้นหารถ
            </button>
        </main>
    );
}

export default function BookingStepOnePage() {
    return (
        <Suspense fallback={<div className="p-4 text-center">Loading Page...</div>}>
            <BookingStepOneContent />
        </Suspense>
    );
}