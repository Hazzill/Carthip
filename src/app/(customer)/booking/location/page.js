"use client";

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';

const BookingMap = dynamic(
  () =>
    import('@/app/components/BookingMap').then((mod) => mod.BookingMap),
  { ssr: false }
);


import { db } from '@/app/lib/firebase';
import { collection, getDocs, query, orderBy, doc, getDoc } from 'firebase/firestore';
import Image from 'next/image';
import { useLiffContext } from '@/context/LiffProvider';

function LocationPageContent() {
  const { loading: liffLoading } = useLiffContext();
  const [vehicle, setVehicle] = useState(null);
  const [allLocations, setAllLocations] = useState([]);
  const [filteredLocations, setFilteredLocations] = useState([]);
  const [categories, setCategories] = useState(["All"]);
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [origin, setOrigin] = useState(null);
  const [destination, setDestination] = useState(null);
  const [pickupDate, setPickupDate] = useState('');
  const [pickupTime, setPickupTime] = useState('');
  const [loading, setLoading] = useState(true);
  
  const router = useRouter();
  const searchParams = useSearchParams();
  const vehicleId = searchParams.get('vehicleId');
  const passengers = searchParams.get('passengers');
  const bags = searchParams.get('bags');

  useEffect(() => {
    const fetchData = async () => {
      if (!vehicleId) {
        if (!liffLoading) {
            alert("กรุณาเลือกรถก่อน");
            router.push('/booking');
        }
        return;
      }
      setLoading(true);
      try {
        const [vehicleDocSnap, locationsSnapshot] = await Promise.all([
          getDoc(doc(db, "vehicles", vehicleId)),
          getDocs(query(collection(db, 'pickup_locations'), orderBy('category'), orderBy('name')))
        ]);

        if (vehicleDocSnap.exists()) {
          setVehicle({ id: vehicleDocSnap.id, ...vehicleDocSnap.data() });
        } else {
           throw new Error("ไม่พบข้อมูลรถ");
        }

        const locationsData = locationsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setAllLocations(locationsData);
        setFilteredLocations(locationsData);
        if (locationsData.length > 0) {
          setOrigin(locationsData[0]);
          const uniqueCategories = ["All", ...new Set(locationsData.map(loc => loc.category))];
          setCategories(uniqueCategories);
        }
      } catch (err) {
        console.error("Error fetching data: ", err);
        alert(err.message);
        router.push('/booking');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [vehicleId, router, liffLoading]);

  const handleCategoryFilter = (category) => {
    setSelectedCategory(category);
    let filtered = category === "All" ? allLocations : allLocations.filter(loc => loc.category === category);
    setFilteredLocations(filtered);
    setOrigin(filtered.length > 0 ? filtered[0] : null);
  };
  
  const handleLocationSelect = (locationData) => setDestination(locationData);
  const handleOriginChange = (e) => setOrigin(allLocations.find(loc => loc.id === e.target.value));

  const handleNextStep = () => {
    if (!vehicleId || !origin || !destination || !pickupDate || !pickupTime) {
      alert("กรุณากรอกข้อมูลให้ครบถ้วน");
      return;
    }
    
    const combinedPickupDateTime = `${pickupDate}T${pickupTime}`;

    const params = new URLSearchParams({
      vehicleId,
      passengers,
      bags,
      originAddress: origin.address,
      originLat: origin.latlng.latitude,
      originLng: origin.latlng.longitude,
      destAddress: destination.address,
      destLat: destination.lat,
      destLng: destination.lng,
      pickupDateTime: combinedPickupDateTime,
    });
    router.push(`/booking/confirm?${params.toString()}`);
  };

  if (liffLoading || loading) return <div className="p-4 text-center">กำลังโหลดข้อมูล...</div>;

  return (
    <main className="space-y-4">
      {vehicle && (
          <div className="bg-white rounded-lg shadow p-4">
              <p className="text-sm font-semibold text-gray-500 mb-2">รถที่คุณเลือก</p>
              <div className="flex items-center space-x-4">
                  <Image 
                      src={vehicle.imageUrl || '/placeholder.png'} 
                      alt={vehicle.brand || 'Vehicle image'} 
                      width={80} height={80} 
                      className="rounded-md object-cover"
                  />
                  <div>
                      <p className="font-bold">{vehicle.brand} {vehicle.model}</p>
                      <p className="text-sm text-gray-600">{vehicle.type}</p>
                  </div>
              </div>
          </div>
      )}
      <div className="bg-white p-4 rounded-lg shadow">
        <h2 className="font-bold text-lg mb-2">สถานที่และเวลา</h2>
        <div className="space-y-4">
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">สถานที่รับ</label>
                <select 
                  id="originSelector"
                  value={origin?.id || ''}
                  onChange={handleOriginChange}
                  className="w-full p-2 border rounded-md bg-white"
                  disabled={filteredLocations.length === 0}
                >
                  {filteredLocations.length > 0 ? (
                    filteredLocations.map(loc => <option key={loc.id} value={loc.id}>{loc.name}</option>)
                  ) : (
                    <option>ไม่พบสถานที่</option>
                  )}
                </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label htmlFor="pickupDate" className="block text-sm font-medium text-gray-700 mb-1">วันที่</label>
                    <input type="date" id="pickupDate" value={pickupDate} onChange={(e) => setPickupDate(e.target.value)} required className="w-full p-2 border rounded-md"/>
                </div>
                <div>
                    <label htmlFor="pickupTime" className="block text-sm font-medium text-gray-700 mb-1">เวลา</label>
                    <input type="time" id="pickupTime" value={pickupTime} onChange={(e) => setPickupTime(e.target.value)} required className="w-full p-2 border rounded-md"/>
                </div>
            </div>
        </div>
      </div>
      <div className="bg-white p-4 rounded-lg shadow">
          <label className="block text-sm font-medium text-gray-700 mb-2">สถานที่ส่ง (ค้นหา หรือเลื่อนแผนที่)</label>
          <BookingMap onLocationSelect={handleLocationSelect} />
      </div>
      
      <button onClick={handleNextStep} disabled={!origin || !destination || !pickupDate || !pickupTime || loading} className="w-full mt-4 p-3 bg-slate-800 text-white rounded-lg font-bold text-lg disabled:bg-gray-400 disabled:cursor-not-allowed">
        ต่อไป
      </button>
    </main>
  );
}

export default function LocationPage() {
    return (
        <Suspense fallback={<div className="p-4 text-center">Loading Page...</div>}>
            <LocationPageContent />
        </Suspense>
    );
}
