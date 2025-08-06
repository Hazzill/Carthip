"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
// 1. Import Firebase functions ที่จำเป็น
import { auth, db } from '@/app/lib/firebase';
import { signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  const handleAdminLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // 2. ลองทำการ Sign in ด้วยอีเมลและรหัสผ่าน
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // 3. ตรวจสอบใน Firestore ว่า user ที่ login เข้ามา เป็น admin หรือไม่
      const adminDocRef = doc(db, 'admins', user.uid);
      const adminDocSnap = await getDoc(adminDocRef);

      if (adminDocSnap.exists()) {
        // 4. ถ้าเป็น admin จริง ให้ redirect ไปหน้า dashboard
        router.push('dashboard');
      } else {
        // 5. ถ้าไม่ใช่ admin ให้ออกจากระบบและแสดงข้อผิดพลาด
        await signOut(auth);
        setError('คุณไม่มีสิทธิ์เข้าถึงส่วนนี้');
      }

    } catch (error) {
      // 6. จัดการข้อผิดพลาดในการล็อกอิน
      console.error("Admin login failed:", error.code, error.message);
      let errorMessage = "อีเมลหรือรหัสผ่านไม่ถูกต้อง";
      if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        errorMessage = "อีเมลหรือรหัสผ่านไม่ถูกต้อง";
      }
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex items-center justify-center min-h-screen bg-gray-100">
      <div className="w-full max-w-md p-8 space-y-8 bg-white rounded-xl shadow-lg">
        
        <div className="text-center">
          <h1 className="text-4xl font-bold text-slate-800">CARFORTHIP</h1>
          <p className="text-gray-500">ระบบจองรถรับ-ส่งสนามบิน</p>
        </div>

        {/* Customer & Driver Section */}
        <div className="p-6 border rounded-lg bg-gray-50">
          <h2 className="text-xl font-semibold text-center text-gray-700 mb-4">สำหรับลูกค้าและพนักงานขับรถ</h2>
          <button 
            onClick={() => router.push('/my-bookings')} // Redirect ไปหน้าลูกค้าเพื่อเริ่ม LIFF flow
            className="w-full flex items-center justify-center py-3 px-4 bg-green-500 text-white rounded-lg font-semibold hover:bg-green-600 transition-colors"
          >
            <svg className="w-6 h-6 mr-2" fill="currentColor" viewBox="0 0 24 24">
              <path d="M21.5,4.9c-0.1-0.1-0.2-0.2-0.3-0.2c-0.6-0.3-1.3-0.5-2-0.5c-0.7,0-1.4,0.1-2.1,0.4c-0.1,0-0.2,0.1-0.3,0.1
              c-0.6,0.3-1.2,0.7-1.7,1.2c-0.5,0.5-0.9,1.1-1.2,1.7c-0.1,0.1-0.1,0.2-0.1,0.3c-0.2,0.7-0.4,1.4-0.4,2.1c0,0.7,0.1,1.4,0.4,2
              c0,0.1,0.1,0.2,0.1,0.3c0.3,0.6,0.7,1.2,1.2,1.7c0.5,0.5,1.1,0.9,1.7,1.2c0.1,0.1,0.2,0.1,0.3,0.1c0.7,0.2,1.4,0.4,2.1,0.4
              c0.7,0,1.4-0.1,2-0.4c0.1,0,0.2-0.1,0.3-0.1c0.7-0.3,1.3-0.7,1.8-1.2c0.5-0.5,0.9-1.2,1.2-1.8c0.1-0.1,0.1-0.2,0.1-0.3
              c0.3-0.6,0.5-1.3,0.5-2c0-0.7-0.1-1.4-0.4-2c-0.1-0.2-0.1-0.3-0.2-0.4c-0.3-0.7-0.7-1.3-1.2-1.8C22.4,5.8,21.9,5.3,21.5,4.9z
              M16.2,13.5h-1.6c-0.2,0-0.3-0.1-0.3-0.3V11h-2.5v2.2c0,0.2-0.1,0.3-0.3,0.3h-1.6c-0.2,0-0.3-0.1-0.3-0.3v-5
              c0-0.2,0.1-0.3,0.3-0.3h1.6c0.2,0,0.3,0.1,0.3,0.3v2.3h2.5V8.5c0-0.2,0.1-0.3,0.3-0.3h1.6c0.2,0,0.3,0.1,0.3,0.3V13.5
              C16.5,13.4,16.4,13.5,16.2,13.5z M8.1,13.5H6.6c-0.2,0-0.3-0.1-0.3-0.3V8.5c0-0.2,0.1-0.3,0.3-0.3h1.6c0.2,0,0.3,0.1,0.3,0.3
              v5C8.4,13.4,8.3,13.5,8.1,13.5z M4.5,13.2L4.5,13.2c-0.2,0-0.3-0.1-0.3-0.3v-5c0-0.2,0.1-0.3,0.3-0.3h0c0.2,0,0.3,0.1,0.3,0.3
              v5C4.8,13.1,4.7,13.2,4.5,13.2z"/>
            </svg>
            เข้าสู่ระบบด้วย LINE
          </button>
        </div>

        {/* Admin Section */}
        <div className="p-6 border rounded-lg">
          <h2 className="text-xl font-semibold text-center text-gray-700 mb-4">สำหรับผู้ดูแลระบบ</h2>
          <form onSubmit={handleAdminLogin} className="space-y-4">
            <div>
              <label htmlFor="email" className="sr-only">Email</label>
              <input 
                type="email" 
                name="email" 
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="อีเมล"
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>
            <div>
              <label htmlFor="password-admin" className="sr-only">Password</label>
              <input 
                type="password" 
                name="password-admin" 
                id="password-admin"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="รหัสผ่าน"
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>
            
            {error && <p className="text-red-500 text-sm text-center">{error}</p>}
            
            <button 
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 bg-slate-800 text-white rounded-lg font-semibold hover:bg-slate-700 transition-colors disabled:bg-gray-400"
            >
              {loading ? 'กำลังตรวจสอบ...' : 'เข้าสู่ระบบ'}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
