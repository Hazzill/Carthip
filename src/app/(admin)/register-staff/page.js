"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { auth, db } from '@/app/lib/firebase';  
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { collection, doc, setDoc, serverTimestamp } from 'firebase/firestore';

export default function RegisterStaffPage() {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    email: '',
    password: '',
    lineUserId: '',
    role: 'driver',
    status: 'available' // <-- เพิ่มสถานะ
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!formData.firstName || !formData.phone || !formData.email || !formData.password) {
        setError("กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน");
        return;
    }
    if (formData.password.length < 6) {
        setError("รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร");
        return;
    }
    setLoading(true);
    
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, formData.email, formData.password);
      const user = userCredential.user;

      await updateProfile(user, {
        displayName: `${formData.firstName} ${formData.lastName}`.trim(),
      });

      const targetCollection = formData.role === 'driver' ? 'drivers' : 'admins';
      const dataToSave = {
        uid: user.uid,
        firstName: formData.firstName,
        lastName: formData.lastName,
        phoneNumber: formData.phone,
        email: user.email,
        lineUserId: formData.lineUserId,
        status: formData.status, // <-- เพิ่มสถานะ
        createdAt: serverTimestamp(),
      };

      if (formData.role === 'admin') {
        dataToSave.role = 'admin';
      }

      await setDoc(doc(db, targetCollection, user.uid), dataToSave);

      alert(`เพิ่มผู้ใช้ตำแหน่ง ${formData.role} สำเร็จ!`);
      router.push('dashboard');

    } catch (error) {
      console.error("Error creating new user:", error.code, error.message);
      let errorMessage = "เกิดข้อผิดพลาดที่ไม่รู้จักในการลงทะเบียน";
      if (error.code === 'auth/email-already-in-use') {
        errorMessage = "อีเมลนี้ถูกใช้งานแล้ว";
      } else if (error.code === 'auth/weak-password') {
        errorMessage = "รหัสผ่านไม่ปลอดภัย (ต้องมีอย่างน้อย 6 ตัวอักษร)";
      }
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-4 md:p-8">
        <div className="max-w-2xl mx-auto">
            <div className="bg-white p-6 rounded-lg shadow-md">
                <h1 className="text-2xl font-bold mb-6">ลงทะเบียนผู้ใช้ใหม่</h1>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700">ชื่อจริง</label>
                            <input name="firstName" value={formData.firstName} onChange={handleChange} required className="w-full mt-1 p-2 border rounded-md"/>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">นามสกุล</label>
                            <input name="lastName" value={formData.lastName} onChange={handleChange} className="w-full mt-1 p-2 border rounded-md"/>
                        </div>
                    </div>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700">ตำแหน่ง</label>
                            <select name="role" value={formData.role} onChange={handleChange} className="w-full mt-1 p-2 border rounded-md bg-white">
                                <option value="driver">พนักงานขับรถ</option>
                                <option value="admin">ผู้ดูแลระบบ</option>
                            </select>
                        </div>
                        {/* --- ส่วนที่แก้ไข: เพิ่ม Dropdown สำหรับสถานะ --- */}
                        {formData.role === 'driver' && (
                            <div>
                                <label className="block text-sm font-medium text-gray-700">สถานะ</label>
                                <select name="status" value={formData.status} onChange={handleChange} className="w-full mt-1 p-2 border rounded-md bg-white">
                                    <option value="available">พร้อมขับ</option>
                                    <option value="unavailable">ไม่พร้อมขับ</option>
                                    <option value="suspended">พักงาน</option>
                                </select>
                            </div>
                        )}
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">เบอร์โทรศัพท์</label>
                        <input type="tel" name="phone" value={formData.phone} onChange={handleChange} required className="w-full mt-1 p-2 border rounded-md"/>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">อีเมล (สำหรับเข้าระบบ)</label>
                        <input type="email" name="email" value={formData.email} onChange={handleChange} required className="w-full mt-1 p-2 border rounded-md"/>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">รหัสผ่าน</label>
                        <input type="password" name="password" value={formData.password} onChange={handleChange} required placeholder="อย่างน้อย 6 ตัวอักษร" className="w-full mt-1 p-2 border rounded-md"/>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">LINE User ID (ถ้ามี)</label>
                        <input name="lineUserId" value={formData.lineUserId} onChange={handleChange} placeholder="U12345..." className="w-full mt-1 p-2 border rounded-md"/>
                    </div>
                    
                    {error && <p className="text-red-500 text-sm text-center font-semibold">{error}</p>}
                    
                    <button type="submit" disabled={loading} className="w-full bg-indigo-600 text-white p-2 rounded-md hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed">
                      {loading ? 'กำลังบันทึก...' : 'ลงทะเบียนผู้ใช้'}
                    </button>
                </form>
            </div>
        </div>
    </div>
  );
}