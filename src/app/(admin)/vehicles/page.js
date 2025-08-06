"use client";

import { useState, useEffect } from 'react';
import { db } from '@/app/lib/firebase';
import { collection, getDocs, query, orderBy, doc, deleteDoc } from 'firebase/firestore';
import Link from 'next/link';
import Image from 'next/image';

// --- Helper Components ---
const StatusButton = ({ status }) => {
    let text, colorClasses;
    switch (status) {
        case 'available':
            text = 'พร้อมขับ';
            colorClasses = 'bg-green-500 hover:bg-green-600';
            break;
        case 'maintenance':
            text = 'ซ่อม';
            colorClasses = 'bg-orange-500 hover:bg-orange-600';
            break;
        case 'in_use':
            text = 'ปิดงาน';
            colorClasses = 'bg-blue-500 hover:bg-blue-600';
            break;
        default:
            text = 'ไม่ระบุ';
            colorClasses = 'bg-gray-400';
    }
    return <button className={`text-xs text-white font-semibold py-1 px-3 rounded-md ${colorClasses}`}>{text}</button>;
};

const vehicleTypeFilters = ['All', 'Sedan', 'SUV', 'Van'];

export default function VehiclesListPage() {
  const [allVehicles, setAllVehicles] = useState([]);
  const [filteredVehicles, setFilteredVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('card'); // 'card' or 'table'
  const [typeFilter, setTypeFilter] = useState('All');

  useEffect(() => {
    const fetchVehicles = async () => {
      setLoading(true);
      try {
        const vehiclesQuery = query(collection(db, 'vehicles'), orderBy('createdAt', 'desc'));
        const querySnapshot = await getDocs(vehiclesQuery);
        const vehiclesData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setAllVehicles(vehiclesData);
      } catch (err) {
        console.error("Error fetching vehicles: ", err);
      } finally {
        setLoading(false);
      }
    };
    fetchVehicles();
  }, []);

  useEffect(() => {
      let filtered = typeFilter === 'All' 
          ? allVehicles 
          : allVehicles.filter(v => v.type === typeFilter);
      setFilteredVehicles(filtered);
  }, [typeFilter, allVehicles]);

  const handleDelete = async (vehicleId, vehiclePlate) => {
    if (window.confirm(`คุณแน่ใจหรือไม่ว่าต้องการลบรถทะเบียน "${vehiclePlate}"?`)) {
      try {
        await deleteDoc(doc(db, "vehicles", vehicleId));
        setAllVehicles(prev => prev.filter(v => v.id !== vehicleId));
        alert("ลบข้อมูลรถสำเร็จ!");
      } catch (error) {
        console.error("Error removing document: ", error);
        alert("เกิดข้อผิดพลาดในการลบข้อมูล");
      }
    }
  };

  if (loading) return <div className="text-center mt-20">กำลังโหลดข้อมูลรถ...</div>;

  return (
    <div className="container mx-auto p-4 md:p-8">
      <div className="flex flex-col md:flex-row justify-between md:items-center mb-6 gap-4">
        <div className="flex items-center gap-4">
            <h1 className="text-2xl font-bold text-slate-800">จัดการข้อมูลรถ</h1>
            <div className="bg-white rounded-lg p-1 flex items-center border">
                <button onClick={() => setViewMode('card')} className={`px-3 py-1.5 text-sm font-semibold rounded-md ${viewMode === 'card' ? 'bg-slate-800 text-white' : 'text-gray-500'}`}>การ์ด</button>
                <button onClick={() => setViewMode('table')} className={`px-3 py-1.5 text-sm font-semibold rounded-md ${viewMode === 'table' ? 'bg-slate-800 text-white' : 'text-gray-500'}`}>ตาราง</button>
            </div>
        </div>
        <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
                {vehicleTypeFilters.map(type => (
                    <button 
                        key={type}
                        onClick={() => setTypeFilter(type)}
                        className={`px-3 py-1.5 text-sm rounded-md font-semibold ${typeFilter === type ? 'bg-white text-slate-800 shadow' : 'bg-transparent text-gray-500'}`}
                    >
                        {type}
                    </button>
                ))}
            </div>
            <Link href="/vehicles/add" className="bg-slate-800 text-white px-5 py-2 rounded-lg font-semibold shadow hover:bg-slate-700">
              เพิ่ม
            </Link>
        </div>
      </div>
      
      {viewMode === 'card' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredVehicles.map(vehicle => (
                <div key={vehicle.id} className="bg-white rounded-lg shadow-md p-4 flex flex-col justify-between">
                    <div>
                        <div className="relative w-full h-40 mb-3">
                            <Image src={vehicle.imageUrl || '/placeholder.png'} alt={vehicle.brand} layout="fill" objectFit="cover" className="rounded-md" />
                        </div>
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="font-bold text-lg text-gray-800">{vehicle.brand} {vehicle.model}</p>
                                <p className="text-xs text-gray-400">{vehicle.type}</p>
                            </div>
                            <div className="text-sm font-semibold bg-gray-800 text-white px-3 py-1 rounded">{vehicle.plateNumber}</div>
                        </div>
                        <div className="text-sm text-gray-600 mt-2">
                            <p>ที่นั่ง: {vehicle.seatCapacity} | กระเป๋า: {vehicle.bagCapacity}</p>
                            <p className="truncate">{vehicle.details}</p>
                        </div>
                    </div>
                    <div className="border-t mt-4 pt-3 flex justify-between items-center gap-2">
                        <StatusButton status={vehicle.status} />
                        <div className="flex gap-2">
                            <Link href={`/vehicles/edit/${vehicle.id}`} className="text-sm bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold py-1 px-3 rounded-md">แก้ไข</Link>
                            <button onClick={() => handleDelete(vehicle.id, vehicle.plateNumber)} className="text-sm bg-red-500 hover:bg-red-600 text-white font-semibold py-1 px-3 rounded-md">ลบ</button>
                        </div>
                    </div>
                </div>
            ))}
        </div>
      ) : (
        <div className="bg-white shadow-md rounded-lg overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                    <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">รถ</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">ทะเบียน</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">ความจุ</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">สถานะ</th>
                        <th className="relative px-6 py-3"><span className="sr-only">Actions</span></th>
                    </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                    {filteredVehicles.map(vehicle => (
                        <tr key={vehicle.id}>
                            <td className="px-6 py-4 whitespace-nowrap">
                                <div className="flex items-center">
                                    <div className="flex-shrink-0 h-10 w-10">
                                        <Image className="h-10 w-10 rounded-md object-cover" src={vehicle.imageUrl || '/placeholder.png'} alt={vehicle.brand} width={40} height={40} />
                                    </div>
                                    <div className="ml-4">
                                        <div className="text-sm font-medium text-gray-900">{vehicle.brand} {vehicle.model}</div>
                                        <div className="text-sm text-gray-500">{vehicle.type}</div>
                                    </div>
                                </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-800">{vehicle.plateNumber}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                <div>ผู้โดยสาร: {vehicle.seatCapacity || 'N/A'}</div>
                                <div>กระเป๋า: {vehicle.bagCapacity || 'N/A'}</div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap"><StatusButton status={vehicle.status} /></td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-4">
                                <Link href={`/vehicles/edit/${vehicle.id}`} className="text-indigo-600 hover:text-indigo-900">แก้ไข</Link>
                                <button onClick={() => handleDelete(vehicle.id, vehicle.plateNumber)} className="text-red-600 hover:text-red-900">ลบ</button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
      )}
    </div>
  );
}
