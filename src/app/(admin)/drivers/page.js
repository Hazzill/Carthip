"use client";

import { useState, useEffect } from 'react';
import { db } from '@/app/lib/firebase';
import { collection, getDocs, query, orderBy, doc, deleteDoc } from 'firebase/firestore';
import Image from 'next/image';
import Link from 'next/link';

// --- Helper Components (แก้ไขใหม่) ---
const StatusBadge = ({ status }) => {
    let text = '';
    let colorClasses = '';
    switch (status) {
        case 'available':
            text = 'พร้อมขับ';
            colorClasses = 'bg-green-100 text-green-800';
            break;
        case 'on_trip':
            text = 'กำลังทำงาน';
            colorClasses = 'bg-blue-100 text-blue-800';
            break;
        case 'unavailable':
            text = 'ไม่พร้อมขับ';
            colorClasses = 'bg-yellow-100 text-yellow-800';
            break;
        case 'suspended':
            text = 'พักงาน';
            colorClasses = 'bg-red-100 text-red-800';
            break;
        default:
            text = status || 'ไม่ระบุ';
            colorClasses = 'bg-gray-100 text-gray-700';
    }
    return <span className={`px-2 py-1 text-xs font-semibold rounded-full ${colorClasses}`}>{text}</span>;
};

// --- เพิ่ม: ตัวกรองสถานะ ---
const statusFilters = [
    { key: 'available', label: 'พร้อมขับ' },
    { key: 'on_trip', label: 'กำลังทำงาน' },
    { key: 'unavailable', label: 'ไม่พร้อมขับ' },
    { key: 'suspended', label: 'พักงาน' },
    { key: 'all', label: 'ทั้งหมด' }
];

export default function DriversListPage() {
  const [allDrivers, setAllDrivers] = useState([]);
  const [filteredDrivers, setFilteredDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('available');

  useEffect(() => {
    const fetchDrivers = async () => {
        setLoading(true);
        try {
          const driversQuery = query(collection(db, 'drivers'), orderBy('createdAt', 'desc'));
          const querySnapshot = await getDocs(driversQuery);
          const driversData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          setAllDrivers(driversData);
        } catch (err) {
          console.error("Error fetching drivers: ", err);
        } finally {
          setLoading(false);
        }
    };
    fetchDrivers();
  }, []);

  useEffect(() => {
      let filtered = allDrivers;
      if (statusFilter !== 'all') {
          filtered = filtered.filter(d => d.status === statusFilter);
      }
      setFilteredDrivers(filtered);
  }, [statusFilter, allDrivers]);

  const handleDelete = async (driverId, driverName) => {
    if (window.confirm(`คุณแน่ใจหรือไม่ว่าต้องการลบคนขับ "${driverName}"?`)) {
      try {
        await deleteDoc(doc(db, "drivers", driverId));
        setAllDrivers(prev => prev.filter(d => d.id !== driverId));
        alert("ลบข้อมูลคนขับสำเร็จ!");
      } catch (error) {
        console.error("Error removing document: ", error);
        alert("เกิดข้อผิดพลาดในการลบข้อมูล");
      }
    }
  };

  if (loading) return <div className="text-center mt-20">กำลังโหลดข้อมูลคนขับ...</div>;

  return (
    <div className="container mx-auto p-4 md:p-8">
        <div className="flex flex-col md:flex-row justify-between md:items-center mb-6 gap-4">
            <h1 className="text-2xl font-bold text-slate-800">จัดการคนขับ</h1>
            <div className="flex items-center gap-4 flex-wrap">
                <div className="flex items-center gap-2 bg-gray-100 rounded-lg p-1">
                    {statusFilters.map(filter => (
                        <button 
                            key={filter.key}
                            onClick={() => setStatusFilter(filter.key)}
                            className={`px-3 py-1 text-sm rounded-md font-semibold whitespace-nowrap ${statusFilter === filter.key ? 'bg-white text-slate-800 shadow' : 'bg-transparent text-gray-600'}`}
                        >
                            {filter.label}
                        </button>
                    ))}
                </div>
                <Link href="/drivers/add" className="bg-slate-800 text-white px-5 py-2 rounded-lg font-semibold shadow hover:bg-slate-700">
                  เพิ่มคนขับ
                </Link>
            </div>
        </div>
        
        <div className="bg-white shadow-md rounded-lg overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                    <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">คนขับ</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">เบอร์โทร</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">สถานะ</th>
                        <th className="relative px-6 py-3"><span className="sr-only">Actions</span></th>
                    </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                    {filteredDrivers.map(driver => (
                        <tr key={driver.id}>
                            <td className="px-6 py-4 whitespace-nowrap">
                                <div className="flex items-center">
                                    <div className="flex-shrink-0 h-10 w-10">
                                        <Image
                                            className="h-10 w-10 rounded-full object-cover"
                                            src={driver.imageUrl || 'https://via.placeholder.com/150'}
                                            alt={`${driver.firstName} ${driver.lastName}`}
                                            width={40}
                                            height={40}
                                        />
                                    </div>
                                    <div className="ml-4">
                                        <div className="text-sm font-medium text-gray-900">{driver.firstName} {driver.lastName}</div>
                                        <div className="text-sm text-gray-500">{driver.lineUserId || 'N/A'}</div>
                                    </div>
                                </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-800">{driver.phoneNumber}</td>
                            <td className="px-6 py-4 whitespace-nowrap"><StatusBadge status={driver.status} /></td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-4">
                                <Link href={`/drivers/edit/${driver.id}`} className="text-indigo-600 hover:text-indigo-900">แก้ไข</Link>
                                <button onClick={() => handleDelete(driver.id, `${driver.firstName} ${driver.lastName}`)} className="text-red-600 hover:text-red-900">ลบ</button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    </div>
  );
}