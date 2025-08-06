"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { db } from '@/app/lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

export default function AddVehiclePage() {
  const [formData, setFormData] = useState({
    plateNumber: '',
    brand: '',
    model: '',
    type: 'Sedan',
    color: '',
    imageUrl: '',
    details: '',
    seatCapacity: 4,
    bagCapacity: 2,
    status: 'available'
  });
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.plateNumber || !formData.brand || !formData.model) {
        alert("กรุณากรอกข้อมูลทะเบียน, ยี่ห้อ และรุ่นให้ครบถ้วน");
        return;
    }
    setLoading(true);
    try {
      await addDoc(collection(db, "vehicles"), {
        ...formData,
        seatCapacity: Number(formData.seatCapacity),
        bagCapacity: Number(formData.bagCapacity),
        createdAt: serverTimestamp(),
      });
      alert("เพิ่มรถใหม่สำเร็จ!");
      router.push('/vehicles');
    } catch (error) {
      console.error("Error adding document: ", error);
      alert("เกิดข้อผิดพลาด: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6 bg-white rounded-lg shadow-md mt-10">
      <h1 className="text-2xl font-bold mb-6">เพิ่มรถใหม่เข้าระบบ</h1>
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
        <div>
            <label className="block text-sm font-medium text-gray-700">ประเภทรถ</label>
            <select name="type" value={formData.type} onChange={handleChange} className="w-full mt-1 p-2 border rounded-md bg-white">
                <option value="Sedan">Sedan</option>
                <option value="SUV">SUV</option>
                <option value="Van">Van</option>
            </select>
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
          {loading ? 'กำลังบันทึก...' : 'บันทึกข้อมูลรถ'}
        </button>
      </form>
    </div>
  );
}
