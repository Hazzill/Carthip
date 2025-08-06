"use client";

import { useState, useEffect } from 'react';
import { db } from '@/app/lib/firebase';
import { collection, getDocs, query, orderBy, doc, getDoc } from 'firebase/firestore';
import Image from 'next/image';

// Star Rating Display Component
const StarRating = ({ rating }) => {
    return (
        <div className="flex">
            {[1, 2, 3, 4, 5].map((star) => (
                <svg
                    key={star}
                    className={`w-5 h-5 ${rating >= star ? 'text-yellow-400' : 'text-gray-300'}`}
                    fill="currentColor"
                    viewBox="0 0 20 20"
                >
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.286 3.957a1 1 0 00.95.69h4.16c.969 0 1.371 1.24.588 1.81l-3.363 2.44a1 1 0 00-.364 1.118l1.287 3.957c.3.921-.755 1.688-1.539 1.118l-3.362-2.44a1 1 0 00-1.176 0l-3.362-2.44c-.783.57-1.838-.197-1.539-1.118l1.287-3.957a1 1 0 00-.364-1.118L2.07 9.39c-.783-.57-.38-1.81.588-1.81h4.16a1 1 0 00.95-.69L9.049 2.927z" />
                </svg>
            ))}
        </div>
    );
};

export default function AdminReviewsPage() {
    const [allReviews, setAllReviews] = useState([]);
    const [filteredReviews, setFilteredReviews] = useState([]);
    const [loading, setLoading] = useState(true);
    const [ratingFilter, setRatingFilter] = useState('all'); // 'all', 1, 2, 3, 4, 5

    useEffect(() => {
        const fetchReviews = async () => {
            setLoading(true);
            try {
                const reviewsQuery = query(collection(db, 'reviews'), orderBy('createdAt', 'desc'));
                const reviewsSnapshot = await getDocs(reviewsQuery);

                const reviewsData = await Promise.all(reviewsSnapshot.docs.map(async (reviewDoc) => {
                    const review = { id: reviewDoc.id, ...reviewDoc.data() };
                    
                    // Fetch booking details
                    const bookingRef = doc(db, 'bookings', review.bookingId);
                    const bookingSnap = await getDoc(bookingRef);
                    if (bookingSnap.exists()) {
                        review.bookingInfo = bookingSnap.data();
                    }

                    // Fetch driver details if driverId exists
                    if (review.driverId) {
                        const driverRef = doc(db, 'drivers', review.driverId);
                        const driverSnap = await getDoc(driverRef);
                        if (driverSnap.exists()) {
                            review.driverInfo = driverSnap.data();
                        }
                    }
                    return review;
                }));
                
                setAllReviews(reviewsData);
            } catch (err) {
                console.error("Error fetching reviews: ", err);
            } finally {
                setLoading(false);
            }
        };
        fetchReviews();
    }, []);

    useEffect(() => {
        if (ratingFilter === 'all') {
            setFilteredReviews(allReviews);
        } else {
            const filtered = allReviews.filter(r => r.rating === Number(ratingFilter));
            setFilteredReviews(filtered);
        }
    }, [ratingFilter, allReviews]);


    if (loading) return <div className="text-center mt-20">กำลังโหลดข้อมูลรีวิว...</div>;

    return (
        <div className="container mx-auto p-4 md:p-8">
            <div className="flex flex-col md:flex-row justify-between md:items-center mb-6 gap-4">
                <h1 className="text-2xl font-bold text-slate-800">รีวิวจากลูกค้า</h1>
                <div className="flex items-center gap-2 bg-gray-100 rounded-lg p-1">
                    <button onClick={() => setRatingFilter('all')} className={`px-3 py-1 text-sm rounded-md font-semibold ${ratingFilter === 'all' ? 'bg-white shadow' : ''}`}>ทั้งหมด</button>
                    {[5, 4, 3, 2, 1].map(star => (
                         <button 
                            key={star}
                            onClick={() => setRatingFilter(star)}
                            className={`px-3 py-1 text-sm rounded-md font-semibold flex items-center ${ratingFilter === star ? 'bg-white shadow' : ''}`}
                        >
                            {star} ★
                        </button>
                    ))}
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredReviews.length > 0 ? filteredReviews.map(review => (
                    <div key={review.id} className="bg-white rounded-lg shadow-md p-5 flex flex-col">
                        <div className="flex justify-between items-start mb-3">
                            <div>
                                <p className="font-bold text-gray-800">{review.customerName}</p>
                                <p className="text-xs text-gray-400">
                                    {review.createdAt?.toDate().toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' })}
                                </p>
                            </div>
                            <StarRating rating={review.rating} />
                        </div>
                        
                        <p className="text-gray-600 text-sm mb-4 flex-grow italic">"{review.comment || 'ไม่มีความคิดเห็นเพิ่มเติม'}"</p>

                        <div className="border-t pt-3 mt-auto text-xs text-gray-500">
                           <p><strong>รถ:</strong> {review.bookingInfo?.vehicleInfo.brand} {review.bookingInfo?.vehicleInfo.model}</p>
                           <p><strong>คนขับ:</strong> {review.driverInfo ? `${review.driverInfo.firstName} ${review.driverInfo.lastName}` : 'N/A'}</p>
                        </div>
                    </div>
                )) : (
                     <div className="col-span-full text-center py-10 bg-white rounded-lg shadow-md">
                        <p className="text-gray-500">ไม่พบรีวิวที่ตรงตามเงื่อนไข</p>
                    </div>
                )}
            </div>
        </div>
    );
}