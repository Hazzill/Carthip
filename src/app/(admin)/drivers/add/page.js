"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { db } from '@/app/lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import Link from 'next/link';

export default function AddDriverPage() {
  const [formData, setFormData] = useState({ 
      firstName: '', 
      lastName: '', 
      phoneNumber: '', 
      lineUserId: '',
      imageUrl: '',
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
    setLoading(true);
    if (!formData.firstName || !formData.phoneNumber) {
      alert("กรุณากรอกชื่อ และเบอร์โทร");
      setLoading(false);
      return;
    }
    try {
      await addDoc(collection(db, "drivers"), {
        ...formData,
        createdAt: serverTimestamp(),
      });
      alert("เพิ่มคนขับใหม่สำเร็จ!");
      router.push('/drivers');
    } catch (error) {
      console.error("Error adding document: ", error);
      alert("เกิดข้อผิดพลาด: " + error.message);
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
        <div className="bg-white p-6 rounded-lg shadow-md">
            <h1 className="text-2xl font-bold mb-6">เพิ่มคนขับใหม่</h1>
            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700">ชื่อจริง</label>
                        <input type="text" name="firstName" placeholder="สมชาย" value={formData.firstName} onChange={handleChange} required className="w-full mt-1 p-2 border rounded-md"/>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">นามสกุล</label>
                        <input type="text" name="lastName" placeholder="ใจดี" value={formData.lastName} onChange={handleChange} className="w-full mt-1 p-2 border rounded-md"/>
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700">เบอร์โทรศัพท์</label>
                        <input type="tel" name="phoneNumber" placeholder="0812345678" value={formData.phoneNumber} onChange={handleChange} required className="w-full mt-1 p-2 border rounded-md"/>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">สถานะ</label>
                        <select name="status" value={formData.status} onChange={handleChange} className="w-full mt-1 p-2 border rounded-md bg-white">
                            <option value="available">พร้อมขับ</option>
                            <option value="on_trip">กำลังทำงาน</option>
                            <option value="unavailable">ไม่พร้อมขับ</option>
                            <option value="suspended">พักงาน</option>
                        </select>
                    </div>
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700">LINE User ID (ถ้ามี)</label>
                    <input type="text" name="lineUserId" placeholder="U12345..." value={formData.lineUserId} onChange={handleChange} className="w-full mt-1 p-2 border rounded-md"/>
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700">URL รูปภาพ (ถ้ามี)</label>
                    <input type="url" name="imageUrl" placeholder="https://example.com/photo.jpg" value={formData.imageUrl} onChange={handleChange} className="w-full mt-1 p-2 border rounded-md"/>
                </div>
                <button type="submit" disabled={loading} className="w-full bg-gray-900 text-white p-2 rounded-md hover:bg-gray-700 disabled:bg-gray-400">
                  {loading ? 'กำลังบันทึก...' : 'บันทึกข้อมูลคนขับ'}
                </button>
            </form>
        </div>
    </div>
  );
}