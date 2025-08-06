"use client";

import { useState, useEffect } from 'react';
import { db } from '@/app/lib/firebase';
import { collection, getDocs, query, orderBy, Timestamp } from 'firebase/firestore';
import Link from 'next/link';

// --- Helper Components ---

// การ์ดแสดงผลข้อมูลแต่ละรายการ
const AnalyticsCard = ({ title, value, subtext }) => (
    <div className="bg-white p-6 rounded-lg shadow-md">
        <h3 className="text-sm font-medium text-gray-500">{title}</h3>
        <p className="mt-1 text-3xl font-semibold text-gray-900">{value}</p>
        {subtext && <p className="text-sm text-gray-500 mt-1">{subtext}</p>}
    </div>
);

// --- หน้าหลัก ---

export default function AnalyticsPage() {
    const [bookings, setBookings] = useState([]);
    const [drivers, setDrivers] = useState([]);
    const [reviews, setReviews] = useState([]);
    const [loading, setLoading] = useState(true);
    const [analytics, setAnalytics] = useState(null);

    // Fetch ข้อมูลทั้งหมดจาก Firestore
    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const bookingsQuery = query(collection(db, 'bookings'), orderBy('createdAt', 'desc'));
                const driversQuery = query(collection(db, 'drivers'));
                const reviewsQuery = query(collection(db, 'reviews'));

                const [bookingsSnapshot, driversSnapshot, reviewsSnapshot] = await Promise.all([
                    getDocs(bookingsQuery),
                    getDocs(driversQuery),
                    getDocs(reviewsQuery),
                ]);

                const bookingsData = bookingsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                const driversData = driversSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                const reviewsData = reviewsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

                setBookings(bookingsData);
                setDrivers(driversData);
                setReviews(reviewsData);

            } catch (err) {
                console.error("Error fetching data: ", err);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);
    
    // คำนวณข้อมูล Analytics
    useEffect(() => {
        if (loading || bookings.length === 0) return;

        // 1. Booking Analytics
        const totalBookings = bookings.length;
        const popularPickup = bookings.reduce((acc, b) => {
            const location = b.pickupInfo.name || b.pickupInfo.address;
            acc[location] = (acc[location] || 0) + 1;
            return acc;
        }, {});

        // 2. Revenue & Payment Analytics
        const totalRevenue = bookings
            .filter(b => b.paymentInfo.paymentStatus === 'paid')
            .reduce((sum, b) => sum + (b.paymentInfo.totalPrice || 0), 0);
        
        const unpaidAmount = bookings
            .filter(b => b.paymentInfo.paymentStatus === 'unpaid' || b.paymentInfo.paymentStatus === 'invoiced')
            .reduce((sum, b) => sum + (b.paymentInfo.totalPrice || 0), 0);

        // 3. Driver Analytics
        const driverJobs = bookings.reduce((acc, b) => {
            if (b.driverId) {
                acc[b.driverId] = (acc[b.driverId] || 0) + 1;
            }
            return acc;
        }, {});
        
        // 4. Review Analytics
        const averageRating = reviews.length > 0
            ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(2)
            : 'N/A';

        setAnalytics({
            totalBookings,
            totalRevenue,
            unpaidAmount,
            averageRating
        });

    }, [loading, bookings, drivers, reviews]);
    
    // Function สำหรับ Export ข้อมูลเป็น CSV
    const exportToCSV = () => {
        const headers = ['Booking ID', 'Customer Name', 'Pickup', 'Dropoff', 'Date', 'Price', 'Payment Status', 'Booking Status'];
        const rows = bookings.map(b => [
            b.id,
            b.customerInfo.name,
            b.pickupInfo.address,
            b.dropoffInfo.address,
            b.pickupInfo.dateTime.toDate().toLocaleString('th-TH'),
            b.paymentInfo.totalPrice,
            b.paymentInfo.paymentStatus,
            b.status
        ].join(','));
        
        const csvContent = "data:text/csv;charset=utf-8," + [headers.join(','), ...rows].join('\n');
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", "bookings_export.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };


    if (loading) return <div className="text-center mt-20">กำลังโหลดข้อมูล...</div>;
    if (!analytics) return <div className="text-center mt-20">ไม่มีข้อมูลเพียงพอสำหรับการวิเคราะห์</div>;

    return (
        <div className="container mx-auto p-4 md:p-8">
            <div className="flex flex-col md:flex-row justify-between md:items-center mb-6 gap-4">
                <h1 className="text-2xl font-bold text-slate-800">หน้าวิเคราะห์ข้อมูล</h1>
                <button 
                    onClick={exportToCSV}
                    className="bg-green-600 text-white px-5 py-2 rounded-lg font-semibold shadow hover:bg-green-700"
                >
                    Export to CSV
                </button>
            </div>

            {/* ส่วนของ Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <AnalyticsCard title="ยอดจองทั้งหมด" value={analytics.totalBookings.toLocaleString()} subtext="รายการ" />
                <AnalyticsCard title="รายได้รวม (ที่ชำระแล้ว)" value={`${analytics.totalRevenue.toLocaleString()}`} subtext="บาท" />
                <AnalyticsCard title="ยอดค้างชำระ" value={`${analytics.unpaidAmount.toLocaleString()}`} subtext="บาท" />
                <AnalyticsCard title="คะแนนรีวิวเฉลี่ย" value={`${analytics.averageRating} ★`} subtext={`จาก ${reviews.length} รีวิว`} />
            </div>

            {/* TODO: เพิ่มกราฟและรายละเอียดการวิเคราะห์อื่นๆ ที่นี่ */}
            <div className="text-center text-gray-500 p-10 bg-white rounded-lg shadow-md">
                <h2 className="text-xl font-semibold">เร็วๆ นี้</h2>
                <p>กราฟและข้อมูลการวิเคราะห์เชิงลึกกำลังอยู่ในระหว่างการพัฒนา</p>
            </div>
        </div>
    );
}