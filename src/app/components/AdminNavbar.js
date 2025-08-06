"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { auth } from "@/app/lib/firebase";
import { signOut } from "firebase/auth";

// --- Custom Hook สำหรับตรวจจับการคลิกนอก Component ---
function useClickOutside(ref, handler) {
  useEffect(() => {
    const listener = (event) => {
      if (!ref.current || ref.current.contains(event.target)) {
        return;
      }
      handler(event);
    };
    document.addEventListener("mousedown", listener);
    document.addEventListener("touchstart", listener);
    return () => {
      document.removeEventListener("mousedown", listener);
      document.removeEventListener("touchstart", listener);
    };
  }, [ref, handler]);
}

// Helper function to format time
function formatTimeAgo(timestamp) {
  if (!timestamp) return "";
  const date = timestamp.toDate();
  const now = new Date();
  const seconds = Math.floor((now - date) / 1000);
  let interval = seconds / 60;
  if (interval < 60) return Math.floor(interval) + " นาทีที่แล้ว";
  interval = seconds / 3600;
  if (interval < 24) return Math.floor(interval) + " ชั่วโมงที่แล้ว";
  return date.toLocaleDateString("th-TH");
}

// --- Nav Links with Grouping ---
const navLinks = [
  { name: "Dashboard", href: "/dashboard" },
  { name: "Analytics", href: "/analytics" },
  {
    name: "จัดการข้อมูล",
    items: [
      { name: "จัดการรถ", href: "/vehicles" },
      { name: "จัดการคนขับ", href: "/drivers" },
      { name: "จัดการสถานที่", href: "/locations" },
    ]
  },
  {
    name: "การเงินและรีวิว",
    items: [
      { name: "รายการชำระเงิน", href: "/payments" },
      { name: "รีวิวลูกค้า", href: "/reviews" },
    ]
  },
  { name: "ลงทะเบียน", href: "/register-staff" },
];

const NavLink = ({ link, currentPath }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);
  useClickOutside(dropdownRef, () => setIsOpen(false));

  const isActive = link.items ? link.items.some(item => currentPath.startsWith(item.href)) : currentPath === link.href;

  if (link.items) {
    return (
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={`px-3 py-2 rounded-md text-sm font-medium flex items-center gap-1 ${isActive ? "bg-slate-800 text-white" : "text-gray-600 hover:bg-gray-100"
            }`}
        >
          {link.name}
          <svg className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
        </button>
        {isOpen && (
          <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-20 border">
            {link.items.map(item => (
              <Link
                key={item.name}
                href={item.href}
                onClick={() => setIsOpen(false)}
                className={`block px-4 py-2 text-sm ${currentPath === item.href ? 'bg-gray-100 text-gray-900' : 'text-gray-700 hover:bg-gray-100'
                  }`}
              >
                {item.name}
              </Link>
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <Link
      href={link.href}
      className={`px-3 py-2 rounded-md text-sm font-medium ${isActive ? "bg-slate-800 text-white" : "text-gray-600 hover:bg-gray-100"
        }`}
    >
      {link.name}
    </Link>
  )
}

export default function AdminNavbar({
  notifications,
  unreadCount,
  onMarkAsRead,
  onClearAll,
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const notifPopoverRef = useRef(null);

  useClickOutside(notifPopoverRef, () => setIsNotifOpen(false));

  const handleLogout = async () => {
    try {
      await signOut(auth);
      router.push("/");
    } catch (error) {
      console.error("Error signing out: ", error);
    }
  };

  const toggleNotifPopover = () => {
    setIsNotifOpen(!isNotifOpen);
  };

  return (
    <nav className="bg-white shadow-md sticky top-0 z-10">
      <div className="container mx-auto px-4 md:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center">
            <Link href="/dashboard" className="text-xl font-bold text-slate-800" >
              CARFORTHIP Admin
            </Link>
          </div>
          <div className="hidden md:flex items-center space-x-2">
            {navLinks.map((link) => (
              <NavLink key={link.name} link={link} currentPath={pathname} />
            ))}
          </div>
          <div className="flex items-center">
            <div className="relative" ref={notifPopoverRef}>
              <button
                onClick={toggleNotifPopover}
                className="p-2 rounded-full hover:bg-gray-100"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-6 w-6 text-gray-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                  />
                </svg>
                {unreadCount > 0 && (
                  <span className="absolute top-0 right-0 block h-4 w-4 transform -translate-y-1/2 translate-x-1/2 rounded-full bg-red-500 text-white text-xs flex items-center justify-center">
                    {unreadCount}
                  </span>
                )}
              </button>
              {isNotifOpen && (
                <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-xl border z-20">
                  <div className="p-3 font-bold border-b">การแจ้งเตือน</div>
                  <ul className="max-h-96 overflow-y-auto">
                    {notifications.length > 0 ? (
                      notifications.map((notif) => (
                        <li
                          key={notif.id}
                          className={`p-3 border-b hover:bg-gray-50 ${!notif.isRead ? "bg-blue-50" : ""
                            }`}
                        >
                          <p className="text-sm text-gray-800">
                            {notif.message}
                          </p>
                          <p className="text-xs text-gray-400 mt-1">
                            {formatTimeAgo(notif.createdAt)}
                          </p>
                        </li>
                      ))
                    ) : (
                      <li className="p-3 text-center text-sm text-gray-500">
                        ไม่มีการแจ้งเตือน
                      </li>
                    )}
                  </ul>
                  <div className="p-2 border-t flex justify-between bg-gray-50 rounded-b-lg">
                    <button
                      onClick={onMarkAsRead}
                      disabled={unreadCount === 0}
                      className="text-xs text-blue-600 hover:underline disabled:text-gray-400 disabled:no-underline"
                    >
                      ทำเครื่องหมายว่าอ่านแล้ว
                    </button>
                    <button
                      onClick={onClearAll}
                      className="text-xs text-red-600 hover:underline"
                    >
                      ลบทั้งหมด
                    </button>
                  </div>
                </div>
              )}
            </div>
            <button
              onClick={handleLogout}
              className="ml-4 px-3 py-2 rounded-md text-sm font-medium text-white bg-red-600 hover:bg-red-700"
            >
              ออกจากระบบ
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}
