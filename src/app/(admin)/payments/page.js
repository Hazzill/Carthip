"use client";

import { useState, useEffect } from 'react';
import { db } from '@/app/lib/firebase';
import { collection, getDocs, query, orderBy, where } from 'firebase/firestore';
import Link from 'next/link';

// Helper component for Payment Status Badge
const PaymentStatusBadge = ({ status }) => {
    let text = '';
    let colorClasses = '';
    switch (status) {
        case 'paid':
            text = 'ชำระแล้ว';
            colorClasses = 'bg-green-100 text-green-800';
            break;
        case 'unpaid':
            text = 'ยังไม่ชำระ';
            colorClasses = 'bg-yellow-100 text-yellow-800';
            break;
        case 'invoiced':
            text = 'ส่งใบแจ้งหนี้แล้ว';
            colorClasses = 'bg-blue-100 text-blue-800';
            break;
        case 'cancelled':
            text = 'ยกเลิก';
            colorClasses = 'bg-red-100 text-red-800';
            break;
        default:
            text = status || 'N/A';
            colorClasses = 'bg-gray-100 text-gray-700';
    }
    return <span className={`px-2 py-1 text-xs font-semibold rounded-full ${colorClasses}`}>{text}</span>;
};

const paymentFilters = [
    { key: 'paid', label: 'ชำระแล้ว' },
    { key: 'unpaid', label: 'ยังไม่ชำระ' },
    { key: 'invoiced', label: 'รอชำระ' },
    { key: 'cancelled', label: 'ยกเลิก' },
    { key: 'all', label: 'ทั้งหมด' }
];

export default function AdminPaymentPage() {
    const [allBookings, setAllBookings] = useState([]);
    const [filteredBookings, setFilteredBookings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState('all');

    useEffect(() => {
        const fetchBookings = async () => {
            setLoading(true);
            try {
                const bookingsQuery = query(collection(db, 'bookings'), orderBy('createdAt', 'desc'));
                const querySnapshot = await getDocs(bookingsQuery);
                const bookingsData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                setAllBookings(bookingsData);
                setFilteredBookings(bookingsData); 
            } catch (err) {
                console.error("Error fetching bookings: ", err);
            } finally {
                setLoading(false);
            }
        };
        fetchBookings();
    }, []);

    useEffect(() => {
        if (statusFilter === 'all') {
            setFilteredBookings(allBookings);
        } else {
            const filtered = allBookings.filter(b => b.paymentInfo.paymentStatus === statusFilter || (statusFilter === 'cancelled' && b.status === 'cancelled'));
            setFilteredBookings(filtered);
        }
    }, [statusFilter, allBookings]);

    if (loading) return <div className="text-center mt-20">กำลังโหลดข้อมูลการชำระเงิน...</div>;

    return (
        <div className="container mx-auto p-4 md:p-8">
            <div className="flex flex-col md:flex-row justify-between md:items-center mb-6 gap-4">
                <h1 className="text-2xl font-bold text-slate-800">จัดการการชำระเงิน</h1>
                <div className="flex items-center gap-2 bg-gray-100 rounded-lg p-1">
                    {paymentFilters.map(filter => (
                        <button
                            key={filter.key}
                            onClick={() => setStatusFilter(filter.key)}
                            className={`px-3 py-1 text-sm rounded-md font-semibold whitespace-nowrap ${statusFilter === filter.key ? 'bg-white text-slate-800 shadow' : 'bg-transparent text-gray-600'}`}
                        >
                            {filter.label}
                        </button>
                    ))}
                </div>
            </div>

            <div className="bg-white shadow-md rounded-lg overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Booking ID</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">ลูกค้า</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">ยอดชำระ</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">สถานะ</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">วันที่ชำระ</th>
                            <th className="relative px-6 py-3"><span className="sr-only">Details</span></th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {filteredBookings.map(booking => (
                            <tr key={booking.id}>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{booking.id.substring(0, 8).toUpperCase()}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-800">{booking.customerInfo.name}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-800">{booking.paymentInfo.totalPrice.toLocaleString()} บาท</td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <PaymentStatusBadge status={booking.status === 'cancelled' ? 'cancelled' : booking.paymentInfo.paymentStatus} />
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                    {booking.paymentInfo.paidAt ? booking.paymentInfo.paidAt.toDate().toLocaleDateString('th-TH') : '-'}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                    <Link href={`/bookings/${booking.id}`} className="text-indigo-600 hover:text-indigo-900">
                                        ดูรายละเอียด
                                    </Link>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}