"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { auth, db } from '@/app/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import AdminNavbar from '@/app/components/AdminNavbar';
import { markAllNotificationsAsRead, clearAllNotifications } from '@/app/actions/notificationActions';

export default function AdminLayout({ children }) {
  const [loading, setLoading] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const router = useRouter();

  useEffect(() => {
    // ตรวจสอบสิทธิ์การเข้าถึง
    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const adminDocRef = doc(db, 'admins', user.uid);
        const adminDocSnap = await getDoc(adminDocRef);
        if (adminDocSnap.exists()) {
          setIsAuthorized(true);
        } else {
          router.push('/');
        }
      } else {
        router.push('/');
      }
      setLoading(false);
    });

    // ดึงข้อมูลการแจ้งเตือนแบบ Real-time
    const notifQuery = query(collection(db, 'notifications'), orderBy('createdAt', 'desc'));
    const unsubscribeNotifs = onSnapshot(notifQuery, (querySnapshot) => {
        const notifsData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setNotifications(notifsData);
        // คำนวณจำนวนการแจ้งเตือนที่ยังไม่ได้อ่าน
        const unread = notifsData.filter(n => !n.isRead).length;
        setUnreadCount(unread);
    });

    // Cleanup listeners เมื่อ component ถูกปิด
    return () => {
        unsubscribeAuth();
        unsubscribeNotifs();
    };
  }, [router]);
  
  // ฟังก์ชันสำหรับเรียก Action 'อ่านทั้งหมด'
  const handleMarkAsRead = async () => {
      if (unreadCount > 0) {
          await markAllNotificationsAsRead();
          // onSnapshot จะอัปเดต unreadCount เป็น 0 ให้อัตโนมัติ
      }
  };

  // ฟังก์ชันสำหรับเรียก Action 'ลบทั้งหมด'
  const handleClearAll = async () => {
      if (notifications.length > 0 && window.confirm("คุณแน่ใจหรือไม่ว่าต้องการลบการแจ้งเตือนทั้งหมด?")) {
          await clearAllNotifications();
          // onSnapshot จะอัปเดต notifications เป็น [] ให้อัตโนมัติ
      }
  };

  // UI ขณะกำลังตรวจสอบสิทธิ์
  if (loading) {
    return (
        <div className="flex items-center justify-center min-h-screen bg-gray-100">
            <div className="text-center">
                <p>Verifying admin access...</p>
            </div>
        </div>
    );
  }

  // แสดง Layout ของ Admin เมื่อมีสิทธิ์เท่านั้น
  if (isAuthorized) {
    return (
      <div className="min-h-screen bg-gray-100">
        <AdminNavbar 
            notifications={notifications} 
            unreadCount={unreadCount} 
            onMarkAsRead={handleMarkAsRead}
            onClearAll={handleClearAll}
        />
        <main>{children}</main>
      </div>
    );
  }

  // ถ้าไม่มีสิทธิ์ จะไม่แสดงอะไรเลย (เพราะถูก redirect ไปแล้ว)
  return null;
}
