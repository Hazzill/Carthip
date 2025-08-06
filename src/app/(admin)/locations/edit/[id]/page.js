// src/app/(admin)/locations/edit/[id]/page.js
"use client";

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { db } from '@/app/lib/firebase';
import { doc, getDoc, updateDoc, GeoPoint } from 'firebase/firestore';

export default function EditLocationPage() {
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    category: 'Other',
    lat: '',
    lng: ''
  });
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const { id } = useParams();

  // 1. ดึงข้อมูลเดิมของสถานที่มาแสดง
  useEffect(() => {
    if (!id) return;
    const fetchLocation = async () => {
      setLoading(true);
      const docRef = doc(db, "pickup_locations", id);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        setFormData({
          name: data.name,
          address: data.address,
          category: data.category,
          // แปลง GeoPoint กลับเป็น lat, lng สำหรับแสดงในฟอร์ม
          lat: data.latlng.latitude,
          lng: data.latlng.longitude
        });
      } else {
        alert("ไม่พบข้อมูล");
        router.push('/admin/locations');
      }
      setLoading(false);
    };
    fetchLocation();
  }, [id, router]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  // 2. ฟังก์ชันสำหรับอัปเดตข้อมูล
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    if (!formData.name || !formData.category || !formData.lat || !formData.lng) {
      alert("กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน");
      setLoading(false);
      return;
    }

    try {
      const docRef = doc(db, "pickup_locations", id);
      await updateDoc(docRef, {
        name: formData.name,
        address: formData.address || formData.name,
        category: formData.category,
        // แปลง lat, lng กลับเป็น GeoPoint ก่อนบันทึก
        latlng: new GeoPoint(parseFloat(formData.lat), parseFloat(formData.lng)),
      });
      alert("อัปเดตข้อมูลสำเร็จ!");
      router.push('/locations');
    } catch (error) {
      console.error("Error updating document: ", error);
      alert("เกิดข้อผิดพลาด: " + error.message);
      setLoading(false);
    }
  };

  if (loading) return <div className="text-center mt-20">กำลังโหลดข้อมูล...</div>;

  return (
    <div className="max-w-2xl mx-auto p-6 bg-white rounded-lg shadow-md mt-10">
      <h1 className="text-2xl font-bold mb-6">แก้ไขข้อมูลสถานที่รับ</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-700">ชื่อสถานที่</label>
          <input type="text" name="name" value={formData.name} onChange={handleChange} required className="w-full mt-1 p-2 border rounded-md"/>
        </div>
        
        <div>
          <label htmlFor="address" className="block text-sm font-medium text-gray-700">ที่อยู่</label>
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
            <label htmlFor="lat" className="block text-sm font-medium text-gray-700">ละติจูด</label>
            <input type="number" step="any" name="lat" value={formData.lat} onChange={handleChange} required className="w-full mt-1 p-2 border rounded-md"/>
          </div>
          <div>
            <label htmlFor="lng" className="block text-sm font-medium text-gray-700">ลองจิจูด</label>
            <input type="number" step="any" name="lng" value={formData.lng} onChange={handleChange} required className="w-full mt-1 p-2 border rounded-md"/>
          </div>
        </div>

        <button type="submit" disabled={loading} className="w-full bg-indigo-600 text-white p-2 rounded hover:bg-indigo-700 disabled:bg-gray-400">
          {loading ? 'กำลังบันทึก...' : 'บันทึกการเปลี่ยนแปลง'}
        </button>
      </form>
    </div>
  );
}