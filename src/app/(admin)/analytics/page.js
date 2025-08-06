"use client";

import { useState, useEffect, useMemo } from 'react';
import { db } from '@/app/lib/firebase';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, parseISO } from 'date-fns';

// --- Helper Components ---

const AnalyticsCard = ({ title, value, subtext }) => (
    <div className="bg-white p-6 rounded-lg shadow-md">
        <h3 className="text-sm font-medium text-gray-500">{title}</h3>
        <p className="mt-1 text-3xl font-semibold text-gray-900">{value}</p>
        {subtext && <p className="text-sm text-gray-500 mt-1">{subtext}</p>}
    </div>
);

const ChartContainer = ({ title, children }) => (
    <div className="bg-white p-6 rounded-lg shadow-md">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">{title}</h3>
        <div style={{ width: '100%', height: 300 }}>
            <ResponsiveContainer>
                {children}
            </ResponsiveContainer>
        </div>
    </div>
);

// --- Main Page ---

export default function AnalyticsPage() {
    const [bookings, setBookings] = useState([]);
    const [drivers, setDrivers] = useState([]); // [!code focus]
    const [reviews, setReviews] = useState([]);
    const [loading, setLoading] = useState(true);
    const [dateRange, setDateRange] = useState({
        start: startOfMonth(new Date()),
        end: endOfMonth(new Date()),
    });

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
                const driversData = driversSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })); // [!code focus]
                const reviewsData = reviewsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

                setBookings(bookingsData);
                setDrivers(driversData); // [!code focus]
                setReviews(reviewsData);

            } catch (err) {
                console.error("Error fetching data: ", err);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    const analyticsData = useMemo(() => {
        // ... (โค้ดส่วนคำนวณเหมือนเดิม) ...
        if (loading) return null;

        const filteredBookings = bookings.filter(b => {
            const bookingDate = b.createdAt.toDate();
            return bookingDate >= dateRange.start && bookingDate <= dateRange.end;
        });

        // 1. Booking Analytics
        const bookingsByDay = filteredBookings.reduce((acc, b) => {
            const day = format(b.createdAt.toDate(), 'yyyy-MM-dd');
            acc[day] = (acc[day] || 0) + 1;
            return acc;
        }, {});
        
        const bookingChartData = eachDayOfInterval(dateRange).map(day => {
            const formattedDay = format(day, 'yyyy-MM-dd');
            return {
                name: format(day, 'dd/MM'),
                bookings: bookingsByDay[formattedDay] || 0,
            };
        });
        
        // 2. Revenue Analytics
        const paidBookings = filteredBookings.filter(b => b.paymentInfo.paymentStatus === 'paid');
        const revenueByDay = paidBookings.reduce((acc, b) => {
             const day = format(b.paymentInfo.paidAt.toDate(), 'yyyy-MM-dd');
             acc[day] = (acc[day] || 0) + b.paymentInfo.totalPrice;
             return acc;
        }, {});

        const revenueChartData = eachDayOfInterval(dateRange).map(day => {
            const formattedDay = format(day, 'yyyy-MM-dd');
            return {
                name: format(day, 'dd/MM'),
                revenue: revenueByDay[formattedDay] || 0,
            };
        });

        const totalRevenue = paidBookings.reduce((sum, b) => sum + b.paymentInfo.totalPrice, 0);

        // 3. Vehicle Type Popularity
        const vehicleTypeData = filteredBookings.reduce((acc, b) => {
            const type = b.vehicleInfo?.vehicleClass || 'Unknown';
            acc[type] = (acc[type] || 0) + 1;
            return acc;
        }, {});
        
        const vehiclePieChartData = Object.keys(vehicleTypeData).map(key => ({
            name: key,
            value: vehicleTypeData[key]
        }));
        
        // 4. Review Analytics
        const averageRating = reviews.length > 0
            ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(2)
            : 'N/A';

        return {
            totalBookings: filteredBookings.length,
            totalRevenue,
            averageRating,
            bookingChartData,
            revenueChartData,
            vehiclePieChartData,
            reviewCount: reviews.length,
        };
    }, [loading, bookings, reviews, dateRange]);
    
    // [!code focus start]
    // Function สำหรับ Export ข้อมูลเป็น CSV ที่ปรับปรุงแล้ว
    const exportToCSV = () => {
        // เพิ่ม Header ให้ครอบคลุมข้อมูลที่ต้องการ
        const headers = ['Booking ID', 'Customer Name', 'Pickup Location', 'Dropoff Location', 'Pickup DateTime', 'Total Price', 'Payment Status', 'Booking Status', 'Driver Name', 'Vehicle'];
        
        const rows = bookings.map(b => {
            // ค้นหาชื่อคนขับจาก ID
            const driver = drivers.find(d => d.id === b.driverId);
            const driverName = driver ? `${driver.firstName} ${driver.lastName}` : 'N/A';
            
            // จัดการกับเครื่องหมาย comma (,) ในที่อยู่ เพื่อไม่ให้ไฟล์ CSV เพี้ยน
            const escapeCSV = (str) => `"${String(str || '').replace(/"/g, '""')}"`;

            return [
                b.id,
                escapeCSV(b.customerInfo.name),
                escapeCSV(b.pickupInfo.address),
                escapeCSV(b.dropoffInfo.address),
                b.pickupInfo.dateTime.toDate().toLocaleString('th-TH'),
                b.paymentInfo.totalPrice,
                b.paymentInfo.paymentStatus,
                b.status,
                escapeCSV(driverName),
                escapeCSV(`${b.vehicleInfo.brand} ${b.vehicleInfo.model}`)
            ].join(',');
        });
        
        // สร้างเนื้อหาไฟล์ CSV และ BOM สำหรับภาษาไทย
        const bom = '\uFEFF';
        const csvContent = bom + [headers.join(','), ...rows].join('\n');
        
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        if (link.download !== undefined) {
            const url = URL.createObjectURL(blob);
            link.setAttribute("href", url);
            link.setAttribute("download", `carforthip_bookings_export_${new Date().toISOString().split('T')[0]}.csv`);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    };
    // [!code focus end]

    const handleDateChange = (e) => {
        const { name, value } = e.target;
        setDateRange(prev => ({...prev, [name]: parseISO(value) }));
    };

    if (loading) return <div className="text-center mt-20">กำลังโหลดและวิเคราะห์ข้อมูล...</div>;
    if (!analyticsData) return <div className="text-center mt-20">ไม่มีข้อมูลเพียงพอสำหรับการวิเคราะห์</div>;

    const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042'];

    return (
        <div className="container mx-auto p-4 md:p-8 space-y-8">
            <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
                <h1 className="text-2xl font-bold text-slate-800">หน้าวิเคราะห์ข้อมูล</h1>
                {/* [!code focus start] */}
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                        <input type="date" name="start" onChange={handleDateChange} value={format(dateRange.start, 'yyyy-MM-dd')} className="p-2 border rounded-md"/>
                        <span>ถึง</span>
                        <input type="date" name="end" onChange={handleDateChange} value={format(dateRange.end, 'yyyy-MM-dd')} className="p-2 border rounded-md"/>
                    </div>
                    <button 
                        onClick={exportToCSV}
                        className="bg-green-600 text-white px-5 py-2 rounded-lg font-semibold shadow hover:bg-green-700"
                    >
                        Export to CSV
                    </button>
                </div>
                {/* [!code focus end] */}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                 <AnalyticsCard title="ยอดจอง" value={analyticsData.totalBookings.toLocaleString()} subtext={`ในข่วงเวลาที่เลือก`} />
                <AnalyticsCard title="รายได้รวม" value={`${analyticsData.totalRevenue.toLocaleString()}`} subtext="บาท" />
                <AnalyticsCard title="คะแนนรีวิวเฉลี่ย" value={`${analyticsData.averageRating} ★`} subtext={`จาก ${analyticsData.reviewCount} รีวิว`} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                 <ChartContainer title="ยอดจองรายวัน">
                    <BarChart data={analyticsData.bookingChartData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="bookings" fill="#8884d8" name="จำนวนการจอง" />
                    </BarChart>
                </ChartContainer>

                <ChartContainer title="รายได้รายวัน (บาท)">
                    <LineChart data={analyticsData.revenueChartData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" />
                        <YAxis />
                        <Tooltip formatter={(value) => value.toLocaleString()} />
                        <Legend />
                        <Line type="monotone" dataKey="revenue" stroke="#82ca9d" name="รายได้"/>
                    </LineChart>
                </ChartContainer>

                 <ChartContainer title="ประเภทรถยอดนิยม">
                    <PieChart>
                        <Pie data={analyticsData.vehiclePieChartData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label>
                            {analyticsData.vehiclePieChartData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                        </Pie>
                        <Tooltip />
                        <Legend />
                    </PieChart>
                </ChartContainer>
            </div>
        </div>
    );
}