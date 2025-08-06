// src/app/(admin)/locations/add/page.js
"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { db } from '@/app/lib/firebase';
import { collection, addDoc, serverTimestamp, GeoPoint } from 'firebase/firestore';

export default function AddLocationPage() {
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    category: 'Other',
    lat: '',
    lng: ''
  });
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    if (!formData.name || !formData.category || !formData.lat || !formData.lng) {
      alert("กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน");
      setLoading(false);
      return;
    }

    try {
      const locationData = {
        name: formData.name,
        address: formData.address || formData.name, // ถ้าที่อยู่ว่างให้ใช้ชื่อแทน
        category: formData.category,
        // แปลง lat, lng เป็น GeoPoint
        latlng: new GeoPoint(parseFloat(formData.lat), parseFloat(formData.lng)),
        createdAt: serverTimestamp(),
      };

      await addDoc(collection(db, "pickup_locations"), locationData);
      
      alert("เพิ่มสถานที่ใหม่สำเร็จ!");
      router.push('/locations'); // แก้ไข path ไปยังหน้ารายการสถานที่

    } catch (error) {
      console.error("Error adding document: ", error);
      alert("เกิดข้อผิดพลาด: " + error.message);
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6 bg-white rounded-lg shadow-md mt-10">
      <h1 className="text-2xl font-bold mb-6">เพิ่มสถานที่รับใหม่</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-700">ชื่อสถานที่ (เช่น BTS สยาม)</label>
          <input type="text" name="name" value={formData.name} onChange={handleChange} required className="w-full mt-1 p-2 border rounded-md"/>
        </div>
        
        <div>
          <label htmlFor="address" className="block text-sm font-medium text-gray-700">ที่อยู่ (ถ้ามี)</label>
          <textarea name="address" value={formData.address} onChange={handleChange} rows="2" className="w-full mt-1 p-2 border rounded-md"></textarea>
        </div>

        <div>
          <label htmlFor="category" className="block text-sm font-medium text-gray-700">ประเภท</label>
          <select name="category" value={formData.category} onChange={handleChange} className="w-full mt-1 p-2 border rounded-md bg-white">
            <option value="Airport">Airport</option>
            <option value="BTS">BTS</option>
            <option value="MRT">MRT</option>
            <option value="Hotel">Hotel</option>
            <option value="Other">Other</option>
          </select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="lat" className="block text-sm font-medium text-gray-700">ละติจูด (Latitude)</label>
            <input type="number" step="any" name="lat" placeholder="13.7462" value={formData.lat} onChange={handleChange} required className="w-full mt-1 p-2 border rounded-md"/>
          </div>
          <div>
            <label htmlFor="lng" className="block text-sm font-medium text-gray-700">ลองจิจูด (Longitude)</label>
            <input type="number" step="any" name="lng" placeholder="100.5348" value={formData.lng} onChange={handleChange} required className="w-full mt-1 p-2 border rounded-md"/>
          </div>
        </div>

        <button type="submit" disabled={loading} className="w-full bg-indigo-600 text-white p-2 rounded hover:bg-indigo-700 disabled:bg-gray-400">
          {loading ? 'กำลังบันทึก...' : 'บันทึกสถานที่'}
        </button>
      </form>
    </div>
  );
}