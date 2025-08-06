"use client";

import { useState, useEffect, Suspense, useMemo, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { useLiffContext } from '@/context/LiffProvider';
import { fetchAllVehiclesWithSchedules } from '@/app/actions/vehicleActions';

// --- Icon Components ---
const UserIcon = (props) => ( <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg> );
const BagIcon = (props) => ( <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" {...props}><rect width="20" height="14" x="2" y="7" rx="2" ry="2" /><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" /></svg> );
const ClockIcon = (props) => ( <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" {...props}><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg> );

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

// --- Helper Components ---
const NumberInput = ({ label, value, onValueChange }) => (
    <div className="flex bg-gray-100 rounded-full flex-1 items-center justify-between px-4 py-3">
        <input type="number" value={value} onChange={(e) => onValueChange(e.target.value)} placeholder="0" min={label === 'กระเป๋า' ? '0' : '1'} className="w-1/2 text-center text-gray-800 font-semibold bg-transparent focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
        <span className="text-xs text-gray-400">{label}</span>
    </div>
);

const VehicleCard = ({ vehicle, onSelect, isBooked }) => {
    const [isExpanded, setIsExpanded] = useState(false);

    const handleToggleExpand = (e) => {
        e.stopPropagation();
        if (!isBooked) setIsExpanded(!isExpanded);
    };
    
    const cardClasses = isBooked
        ? "bg-gray-200 rounded-2xl p-4 transition-all duration-300 relative cursor-not-allowed opacity-60"
        : "bg-gray-100 rounded-2xl p-4 transition-all duration-300 relative cursor-pointer hover:ring-2 hover:ring-gray-500";

    return (
        <div onClick={() => !isBooked && onSelect(vehicle.id)} className={cardClasses}>
            {isBooked && (
                <div className="absolute top-0 left-0 right-0 bg-red-600 text-white text-center text-xs font-bold py-1 rounded-t-2xl z-20">
                    จองแล้ว
                </div>
            )}
            <div className="absolute top-4 right-4 z-10">
                <span className="bg-primary text-white text-xs font-semibold px-3 py-1.5 rounded-full">
                    {vehicle.vehicleClass}
                </span>
            </div>
            <div className={`flex space-x-4 ${isBooked ? 'pt-4' : ''}`}>
                <div className="flex flex-col items-center flex-shrink-0">
                    <div className="relative w-32 h-24">
                        <Image src={vehicle.imageUrl || 'https://placehold.co/600x400/e2e8f0/334155?text=No+Image'} alt={`${vehicle.brand} ${vehicle.model}`} fill style={{ objectFit: 'cover' }} className="rounded-lg" />
                    </div>
                    <button onClick={handleToggleExpand} disabled={isBooked} className="w-full text-center text-xs font-semibold mt-2 py-1 px-3 rounded-full bg-gray-200 text-gray-700 hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed">
                        {isExpanded ? 'ปิด' : 'รายละเอียด'}
                    </button>
                </div>
                <div className="flex-grow space-y-1">
                    <p className="font-extrabold text-lg text-gray-800 uppercase tracking-wider">{vehicle.brand}</p>
                    <h3 className="font-semibold text-md text-gray-600 -mt-1">{vehicle.model}</h3>
                    <div className="flex items-center text-sm text-gray-600 pt-1 gap-5">
                        <span className="flex items-center gap-1.5 font-medium"><UserIcon className="w-4 h-4 text-gray-500" />{vehicle.seatCapacity || 'N/A'}</span>
                        <span className="flex items-center gap-1.5 font-medium"><BagIcon className="w-4 h-4 text-gray-500" />{vehicle.bagCapacity || 'N/A'}</span>
                    </div>
                    <div className="flex items-baseline pt-2">
                        <span className="text-sm text-gray-500 mr-2">ราคาเริ่มต้น</span>
                        <p className="font-bold text-md text-gray-800">{Number(vehicle.pricePerHour || 0).toLocaleString()}</p>
                        <span className="flex items-center text-sm text-gray-500 ml-1">/ ชั่วโมง</span>
                    </div>
                </div>
            </div>
            {isExpanded && !isBooked && (
                <div className="border-t border-gray-200 mt-4 pt-3 space-y-2 text-sm animate-fade-in">
                    <h4 className="font-bold text-base text-gray-800">รายละเอียดเพิ่มเติม</h4>
                    <div className="flex justify-between"><span className="text-gray-500">ราคาต่อชั่วโมง</span><span className="font-bold text-gray-800 flex items-center">{Number(vehicle.pricePerHour || 0).toLocaleString()} / <ClockIcon className="w-4 h-4 ml-1" /></span></div>
                    <div className="flex justify-between"><span className="text-gray-500">ชั่วโมงเกิน OT</span><span className="font-bold text-gray-800 flex items-center">{Number(vehicle.overtimeRate || 0).toLocaleString()} / <ClockIcon className="w-4 h-4 ml-1" /></span></div>
                </div>
            )}
        </div>
    );
};

function SelectVehicleContent() {
    const { loading: liffLoading } = useLiffContext();
    const [allVehicles, setAllVehicles] = useState([]);
    const [vehicleBookings, setVehicleBookings] = useState({});
    const [filteredVehicles, setFilteredVehicles] = useState([]);
    const [passengers, setPassengers] = useState('1');
    const [bags, setBags] = useState('0');
    const [rentalHours, setRentalHours] = useState('4');
    const [vehicleClasses, setVehicleClasses] = useState(["All"]);
    const [selectedClass, setSelectedClass] = useState("All");
    const [loading, setLoading] = useState(true);
    const router = useRouter();
    const searchParams = useSearchParams();
    const [notification, setNotification] = useState({ show: false, title: '', message: '', type: 'error' });

    useEffect(() => {
        if (notification.show) {
            const timer = setTimeout(() => {
                setNotification({ show: false, title: '', message: '', type: 'error' });
            }, 5000);
            return () => clearTimeout(timer);
        }
    }, [notification]);

    const bookingParams = useMemo(() => ({
        pickupDateTime: searchParams.get('pickupDateTime'),
        originName: searchParams.get('originName'),
        originAddress: searchParams.get('originAddress'),
        originLat: searchParams.get('originLat'),
        originLng: searchParams.get('originLng'),
        destAddress: searchParams.get('destAddress'),
        destLat: searchParams.get('destLat'),
        destLng: searchParams.get('destLng'),
    }), [searchParams]);

    useEffect(() => {
        const fetchVehicleData = async () => {
            setLoading(true);
            try {
                const { vehicles, bookings, error, details } = await fetchAllVehiclesWithSchedules();
                if (error) throw new Error(details || error);
                
                setAllVehicles(vehicles);
                setVehicleBookings(bookings);

                const classesFromDB = [...new Set(vehicles.map(v => v.vehicleClass).filter(Boolean))];
                setVehicleClasses(["All", ...classesFromDB.sort()]);
            } catch (err) {
                console.error("Error fetching vehicle data:", err);
                setNotification({ show: true, title: 'เกิดข้อผิดพลาด', message: 'ไม่สามารถโหลดข้อมูลรถได้', type: 'error' });
            } finally {
                setLoading(false);
            }
        };
        if (!liffLoading) {
            fetchVehicleData();
        }
    }, [liffLoading]);

    const isVehicleBooked = useCallback((vehicleId, requestedStartTime, requestedEndTime) => {
        const schedules = vehicleBookings[vehicleId];
        if (!schedules || !requestedStartTime || !requestedEndTime) return false;

        for (const booking of schedules) {
            const bookingStart = new Date(booking.start);
            const bookingEnd = new Date(booking.end);
            if (requestedStartTime < bookingEnd && requestedEndTime > bookingStart) {
                return true;
            }
        }
        return false;
    }, [vehicleBookings]);
    
    useEffect(() => {
        if (loading || !bookingParams.pickupDateTime) return;
        
        const requestedStartTime = new Date(bookingParams.pickupDateTime);
        const requestedEndTime = new Date(requestedStartTime.getTime() + Number(rentalHours) * 60 * 60 * 1000);

        if (isNaN(requestedStartTime.getTime()) || isNaN(requestedEndTime.getTime())) return;

        const newFilteredVehicles = allVehicles
            .filter(v => {
                const capacityCheck = (v.seatCapacity || 0) >= (Number(passengers) || 0) &&
                                      (v.bagCapacity || 0) >= (Number(bags) || 0);
                const classCheck = selectedClass === 'All' ? true : v.vehicleClass === selectedClass;
                return capacityCheck && classCheck;
            })
            .map(vehicle => ({
                ...vehicle,
                isBooked: isVehicleBooked(vehicle.id, requestedStartTime, requestedEndTime)
            }));
            
        setFilteredVehicles(newFilteredVehicles);

    }, [passengers, bags, selectedClass, allVehicles, loading, bookingParams.pickupDateTime, rentalHours, isVehicleBooked]);


    const handleSelectVehicle = (vehicleId) => {
        const finalPassengers = Number(passengers) || 0;
        const finalBags = Number(bags) || 0;
        const finalRentalHours = Number(rentalHours) || 0;

        if (finalPassengers < 1) {
            setNotification({ show: true, title: 'ข้อมูลไม่ถูกต้อง', message: 'จำนวนผู้โดยสารต้องมีค่าอย่างน้อย 1 คน', type: 'error' });
            return;
        }
        if (finalRentalHours < 1) {
            setNotification({ show: true, title: 'ข้อมูลไม่ถูกต้อง', message: 'จำนวนชั่วโมงต้องมีค่าอย่างน้อย 1 ชั่วโมง', type: 'error' });
            return;
        }

        const params = new URLSearchParams({
            ...bookingParams,
            vehicleId,
            passengers: finalPassengers,
            bags: finalBags,
            rentalHours: finalRentalHours,
        });
        router.push(`./confirm?${params.toString()}`);
    };
    
    if (liffLoading || loading) return <div className="p-4 text-center">กำลังโหลดข้อมูลรถ...</div>;

    return (
        <main className="space-y-5">
            <Notification {...notification} />
            <div className="flex items-center gap-2">
                <NumberInput label="คน" value={passengers} onValueChange={setPassengers} />
                <NumberInput label="กระเป๋า" value={bags} onValueChange={setBags} />
                <NumberInput label="ชั่วโมง" value={rentalHours} onValueChange={setRentalHours} />
            </div>
            <div className="flex items-center gap-2 overflow-x-auto pb-2 -mx-4 px-4">
                {vehicleClasses.map(v_class => (
                    <button key={v_class} onClick={() => setSelectedClass(v_class)} className={`px-5 py-2 text-sm rounded-full font-semibold whitespace-nowrap transition ${selectedClass === v_class ? 'bg-primary text-white ' : 'bg-gray-100 text-gray-700'}`}>
                        {v_class}
                    </button>
                ))}
            </div>
            <div className="space-y-4">
                {filteredVehicles.length > 0 ? (
                    filteredVehicles.map(vehicle => (
                        <VehicleCard key={vehicle.id} vehicle={vehicle} onSelect={handleSelectVehicle} isBooked={vehicle.isBooked} />
                    ))
                ) : (
                    <div className="text-center text-gray-500 pt-10 bg-gray-50 p-6 rounded-2xl ">
                        <p className='font-semibold'>ไม่พบรถที่ตรงตามเงื่อนไข</p>
                        <p className="text-sm mt-1">กรุณาลองเปลี่ยนจำนวนผู้โดยสารหรือประเภทรถ</p>
                    </div>
                )}
            </div>
        </main>
    );
}

export default function SelectVehiclePage() {
    return (
        <Suspense fallback={<div className="p-4 text-center">Loading Page...</div>}>
            <SelectVehicleContent />
        </Suspense>
    );
}