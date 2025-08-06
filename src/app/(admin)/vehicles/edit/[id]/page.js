"use client";

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { db } from '@/app/lib/firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';

export default function EditVehiclePage() {
  const [formData, setFormData] = useState(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const { id } = useParams();

  useEffect(() => {
    if (!id) return;
    const fetchVehicle = async () => {
      setLoading(true);
      const docRef = doc(db, "vehicles", id);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setFormData(docSnap.data());
      } else {
        alert("ไม่พบข้อมูลรถ");
        router.push('/vehicles');
      }
      setLoading(false);
    };
    fetchVehicle();
  }, [id, router]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const docRef = doc(db, "vehicles", id);
      await updateDoc(docRef, {
        ...formData,
        seatCapacity: Number(formData.seatCapacity),
        bagCapacity: Number(formData.bagCapacity),
      });
      alert("อัปเดตข้อมูลสำเร็จ!");
      router.push('/vehicles');
    } catch (error) {
      console.error("Error updating document: ", error);
      alert("เกิดข้อผิดพลาด: " + error.message);
    } finally {
      setLoading(false);
    }
  };
  
  if (loading || !formData) return <div className="text-center mt-20">กำลังโหลด...</div>;

  return (
    <div className="max-w-2xl mx-auto p-6 bg-white rounded-lg shadow-md mt-10">
      <h1 className="text-2xl font-bold mb-6">แก้ไขข้อมูลรถ</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
                <label className="block text-sm font-medium text-gray-700">ทะเบียนรถ</label>
                <input name="plateNumber" value={formData.plateNumber} onChange={handleChange} placeholder="1กข 1234" required className="w-full mt-1 p-2 border rounded-md"/>
            </div>
            <div>
                <label className="block text-sm font-medium text-gray-700">ยี่ห้อ</label>
                <input name="brand" value={formData.brand} onChange={handleChange} placeholder="Toyota" required className="w-full mt-1 p-2 border rounded-md"/>
            </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
                <label className="block text-sm font-medium text-gray-700">รุ่น</label>
                <input name="model" value={formData.model} onChange={handleChange} placeholder="Yaris Ativ" required className="w-full mt-1 p-2 border rounded-md"/>
            </div>
            <div>
                <label className="block text-sm font-medium text-gray-700">สี</label>
                <input name="color" value={formData.color} onChange={handleChange} placeholder="บรอนซ์เงิน" className="w-full mt-1 p-2 border rounded-md"/>
            </div>
        </div>
         {/* --- ส่วนที่แก้ไข: เพิ่ม Dropdown สำหรับสถานะ --- */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
                <label className="block text-sm font-medium text-gray-700">ประเภทรถ</label>
                <select name="type" value={formData.type} onChange={handleChange} className="w-full mt-1 p-2 border rounded-md bg-white">
                    <option value="Sedan">Sedan</option>
                    <option value="SUV">SUV</option>
                    <option value="Van">Van</option>
                </select>
            </div>
             <div>
                <label className="block text-sm font-medium text-gray-700">สถานะ</label>
                <select name="status" value={formData.status} onChange={handleChange} className="w-full mt-1 p-2 border rounded-md bg-white">
                    <option value="available">พร้อมใช้</option>
                    <option value="maintenance">ซ่อมบำรุง</option>
                    <option value="inactive">ไม่ใช้งาน</option>
                </select>
            </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
                <label className="block text-sm font-medium text-gray-700">จำนวนผู้โดยสาร</label>
                <input type="number" name="seatCapacity" value={formData.seatCapacity} onChange={handleChange} placeholder="4" className="w-full mt-1 p-2 border rounded-md"/>
            </div>
            <div>
                <label className="block text-sm font-medium text-gray-700">จำนวนกระเป๋า</label>
                <input type="number" name="bagCapacity" value={formData.bagCapacity} onChange={handleChange} placeholder="2" className="w-full mt-1 p-2 border rounded-md"/>
            </div>
        </div>
        <div>
            <label className="block text-sm font-medium text-gray-700">URL รูปภาพ</label>
            <input name="imageUrl" value={formData.imageUrl} onChange={handleChange} placeholder="https://example.com/image.png" className="w-full mt-1 p-2 border rounded-md"/>
        </div>
        <div>
            <label className="block text-sm font-medium text-gray-700">รายละเอียดเพิ่มเติม</label>
            <textarea name="details" value={formData.details} onChange={handleChange} rows="3" placeholder="เช่น เบาะหนัง, ที่นั่งเด็ก" className="w-full mt-1 p-2 border rounded-md"></textarea>
        </div>
        
        <button type="submit" disabled={loading} className="w-full bg-indigo-600 text-white p-2 rounded-md hover:bg-indigo-700 disabled:bg-gray-400">
          {loading ? 'กำลังบันทึก...' : 'บันทึกการเปลี่ยนแปลง'}
        </button>
      </form>
    </div>
  );
}