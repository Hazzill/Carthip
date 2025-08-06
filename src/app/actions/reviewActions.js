'use server';

import { db } from '@/app/lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';
import { sendLineMessage } from './lineActions'; // [!code focus]

/**
 * Submits a review for a completed booking.
 * @param {object} reviewData - The review data from the form.
 * @param {string} reviewData.bookingId - The ID of the booking being reviewed.
 * @param {string} reviewData.userId - The LINE User ID of the customer.
 * @param {string} reviewData.driverId - The ID of the driver.
 * @param {number} reviewData.rating - The star rating (1-5).
 * @param {string} reviewData.comment - The customer's comment.
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function submitReview(reviewData) {
  const { bookingId, userId, driverId, rating, comment } = reviewData;

  if (!bookingId || !userId || !rating) {
    return { success: false, error: 'ข้อมูลที่จำเป็นไม่ครบถ้วน' };
  }

  const bookingRef = db.collection('bookings').doc(bookingId);
  const reviewRef = db.collection('reviews').doc(bookingId); // Use bookingId as reviewId for simplicity

  try {
    await db.runTransaction(async (transaction) => {
      const bookingDoc = await transaction.get(bookingRef);
      if (!bookingDoc.exists) {
        throw new Error('ไม่พบข้อมูลการจองนี้');
      }
      
      const bookingData = bookingDoc.data();
      if (bookingData.userId !== userId) {
          throw new Error('คุณไม่มีสิทธิ์รีวิวการจองนี้');
      }
      if (bookingData.reviewInfo?.submitted) {
          throw new Error('คุณได้รีวิวการจองนี้ไปแล้ว');
      }

      // Save the new review
      transaction.set(reviewRef, {
        bookingId,
        userId,
        driverId: driverId || null,
        customerName: bookingData.customerInfo.name,
        rating: Number(rating),
        comment: comment || '',
        createdAt: FieldValue.serverTimestamp(),
      });

      // Mark the booking as reviewed
      transaction.update(bookingRef, {
        'reviewInfo.submitted': true,
        'reviewInfo.rating': Number(rating),
        updatedAt: FieldValue.serverTimestamp(),
      });
    });

    // [!code focus start]
    // ส่งข้อความขอบคุณหลังจากบันทึกรีวิวสำเร็จ
    const thankYouMessage = 'ขอบคุณสำหรับรีวิวครับ! ความคิดเห็นของคุณมีความสำคัญอย่างยิ่งในการพัฒนาบริการของเราให้ดียิ่งขึ้นไปครับ';
    await sendLineMessage(userId, thankYouMessage);
    // [!code focus end]

    return { success: true };
  } catch (error) {
    console.error("Error submitting review:", error);
    return { success: false, error: error.message };
  }
}
