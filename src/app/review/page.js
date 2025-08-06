
"use client";

import { useState, useEffect, Suspense } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useLiffContext } from '@/context/LiffProvider';
import { submitReview } from '@/app/actions/reviewActions';

// Star Rating Component
const StarRating = ({ rating, setRating }) => {
    return (
        <div className="flex justify-center space-x-2">
            {[1, 2, 3, 4, 5].map((star) => (
                <button
                    key={star}
                    type="button"
                    onClick={() => setRating(star)}
                    className="focus:outline-none"
                >
                    <svg
                        className={`w-10 h-10 transition-colors ${rating >= star ? 'text-yellow-400' : 'text-gray-300'}`}
                        fill="currentColor"
                        viewBox="0 0 20 20"
                    >
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.286 3.957a1 1 0 00.95.69h4.16c.969 0 1.371 1.24.588 1.81l-3.363 2.44a1 1 0 00-.364 1.118l1.287 3.957c.3.921-.755 1.688-1.539 1.118l-3.362-2.44a1 1 0 00-1.176 0l-3.362 2.44c-.783.57-1.838-.197-1.539-1.118l1.287-3.957a1 1 0 00-.364-1.118L2.07 9.39c-.783-.57-.38-1.81.588-1.81h4.16a1 1 0 00.95-.69L9.049 2.927z" />
                    </svg>
                </button>
            ))}
        </div>
    );
};

function ReviewContent() {
    const { profile, loading: liffLoading } = useLiffContext();
    const [rating, setRating] = useState(0);
    const [comment, setComment] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);
    const [bookingId, setBookingId] = useState(null);
    
    const params = useParams();
    const searchParams = useSearchParams();
    const router = useRouter();

    useEffect(() => {
        const getBookingId = () => {
            // 1. Try to get bookingId from the dynamic route parameter first (will be undefined here, but good practice)
            if (params.bookingId) {
                return params.bookingId;
            }
            // 2. If not found, try to get it from liff.state after a redirect
            const liffState = searchParams.get('liff.state');
            if (liffState) {
                // Example liffState: "/review/some-booking-id"
                const parts = liffState.split('/');
                if (parts.length > 2 && parts[1] === 'review') {
                    return parts[2];
                }
            }
            return null;
        };

        const id = getBookingId();
        if (id) {
            setBookingId(id);
        } else if (!liffLoading) {
            setError('ไม่พบ Booking ID');
        }
    }, [params, searchParams, liffLoading]);


    const handleSubmit = async (e) => {
        e.preventDefault();
        if (rating === 0) {
            setError('กรุณาให้คะแนนอย่างน้อย 1 ดาว');
            return;
        }
        if (!profile?.userId) {
            setError('ไม่สามารถระบุตัวตนผู้ใช้ได้ กรุณาลองอีกครั้ง');
            return;
        }
        setIsSubmitting(true);
        setError('');

        const reviewData = {
            bookingId: bookingId,
            userId: profile.userId,
            rating: rating,
            comment: comment,
        };

        const result = await submitReview(reviewData);

        if (result.success) {
            setSuccess(true);
        } else {
            setError(result.error);
        }
        setIsSubmitting(false);
    };
    
    if (liffLoading) {
        return <div className="p-4 text-center">กำลังโหลด...</div>
    }

    if (error && !bookingId) {
        return (
            <div className="bg-white p-8 rounded-lg shadow-lg text-center">
                <h1 className="text-2xl font-bold text-red-600 mb-2">เกิดข้อผิดพลาด</h1>
                <p className="text-gray-600">{error}</p>
            </div>
        )
    }

    if (!bookingId) {
        return <div className="p-4 text-center">กำลังค้นหาข้อมูลการจอง...</div>
    }

    if (success) {
        return (
            <div className="bg-white p-8 rounded-lg shadow-lg text-center">
                <h1 className="text-2xl font-bold text-green-600 mb-2">ขอบคุณสำหรับรีวิว!</h1>
                <p className="text-gray-600">ความคิดเห็นของคุณมีความสำคัญต่อการพัฒนาบริการของเรา</p>
            </div>
        )
    }

    return (
        <div className="bg-white p-6 rounded-lg shadow-lg">
            <h1 className="text-2xl font-bold text-center mb-2">รีวิวการเดินทาง</h1>
            <p className="text-center text-gray-500 mb-6">Booking ID: {bookingId.substring(0, 6).toUpperCase()}</p>

            <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                    <label className="block text-center text-lg font-medium text-gray-700 mb-3">
                        ให้คะแนนความพึงพอใจ
                    </label>
                    <StarRating rating={rating} setRating={setRating} />
                </div>

                <div>
                    <label htmlFor="comment" className="block text-sm font-medium text-gray-700">
                        ความคิดเห็นเพิ่มเติม (ถ้ามี)
                    </label>
                    <textarea
                        id="comment"
                        rows="4"
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                        className="w-full mt-1 p-2 border rounded-md"
                        placeholder="เล่าประสบการณ์ของคุณ..."
                    ></textarea>
                </div>

                {error && <p className="text-red-500 text-sm text-center">{error}</p>}

                <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full bg-slate-800 text-white p-3 rounded-lg font-bold text-lg hover:bg-slate-700 disabled:bg-gray-400"
                >
                    {isSubmitting ? 'กำลังส่ง...' : 'ส่งรีวิว'}
                </button>
            </form>
        </div>
    );
}

export default function ReviewPage() {
    return (
        <Suspense fallback={<div className="p-4 text-center">กำลังโหลดหน้า...</div>}>
            <ReviewContent />
        </Suspense>
    );
}
