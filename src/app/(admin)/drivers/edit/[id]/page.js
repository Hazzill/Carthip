"use client";

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { db } from '@/app/lib/firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import Link from 'next/link';

export default function EditDriverPage() {
  const [formData, setFormData] = useState(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const { id } = useParams();

  useEffect(() => {
    if (!id) return;
    const fetchDriver = async () => {
      setLoading(true);
      try {
        const docRef = doc(db, "drivers", id);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setFormData(docSnap.data());
        } else {
          alert("ไม่พบข้อมูลคนขับ");
          router.push('/drivers');
        }
      } catch (error) {
        console.error("Error fetching document:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchDriver();
  }, [id, router]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const docRef = doc(db, "drivers", id);
      await updateDoc(docRef, formData);
      alert("อัปเดตข้อมูลคนขับสำเร็จ!");
      router.push('/drivers');
    } catch (error) {
      console.error("Error updating document: ", error);
      alert("เกิดข้อผิดพลาด: " + error.message);
      setLoading(false);
    }
  };

  if (loading || !formData) {
    return <div className="text-center mt-20">กำลังโหลดข้อมูล...</div>;
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
        <div className="bg-white p-6 rounded-lg shadow-md">
            <h1 className="text-2xl font-bold mb-6">แก้ไขข้อมูลคนขับ</h1>
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
                <button type="submit" disabled={loading} className="w-full bg-indigo-600 text-white p-2 rounded-md hover:bg-indigo-700 disabled:bg-gray-400">
                  {loading ? 'กำลังบันทึก...' : 'บันทึกการเปลี่ยนแปลง'}
                </button>
            </form>
        </div>
    </div>
  );
}