// src/app/(admin)/locations/page.js
"use client";

import { useState, useEffect } from 'react';
import { db } from '@/app/lib/firebase';
import { collection, getDocs, query, orderBy, doc, deleteDoc } from 'firebase/firestore';
import Link from 'next/link';

export default function LocationsListPage() {
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLocations = async () => {
      setLoading(true);
      try {
        const locationsQuery = query(collection(db, 'pickup_locations'), orderBy('category'), orderBy('name'));
        const querySnapshot = await getDocs(locationsQuery);
        const locationsData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setLocations(locationsData);
      } catch (err) {
        console.error("Error fetching locations: ", err);
      } finally {
        setLoading(false);
      }
    };
    fetchLocations();
  }, []);

  const handleDelete = async (locationId, locationName) => {
    if (window.confirm(`คุณแน่ใจหรือไม่ว่าต้องการลบสถานที่ "${locationName}"?`)) {
      try {
        await deleteDoc(doc(db, "pickup_locations", locationId));
        setLocations(locations.filter(loc => loc.id !== locationId));
        alert("ลบข้อมูลสำเร็จ!");
      } catch (error) {
        console.error("Error removing document: ", error);
        alert("เกิดข้อผิดพลาดในการลบข้อมูล");
      }
    }
  };

  if (loading) return <div className="text-center mt-20">กำลังโหลดข้อมูลสถานที่...</div>;

  return (
    <div className="container mx-auto p-4 md:p-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">จัดการสถานที่รับ-ส่ง</h1>
        <Link href="/locations/add" className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700">
          + เพิ่มสถานที่ใหม่
        </Link>
      </div>
      <div className="bg-white shadow-md rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ชื่อสถานที่</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ประเภท</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">พิกัด (Lat, Lng)</th>
                <th scope="col" className="relative px-6 py-3">
                  <span className="sr-only">Edit</span>
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {locations.map(location => (
                <tr key={location.id}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{location.name}</div>
                    <div className="text-sm text-gray-500">{location.address}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                      {location.category}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {location.latlng.latitude.toFixed(4)}, {location.latlng.longitude.toFixed(4)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-4">
                    <Link href={`/locations/edit/${location.id}`} className="text-indigo-600 hover:text-indigo-900">แก้ไข</Link>
                    <button onClick={() => handleDelete(location.id, location.name)} className="text-red-600 hover:text-red-900">ลบ</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}