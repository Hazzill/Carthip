'use server';

import { db } from '@/app/lib/firebaseAdmin';
import { FieldValue, GeoPoint, Timestamp } from 'firebase-admin/firestore';
import { sendLineMessage } from '@/app/actions/lineActions';
import { sendTelegramMessageToAdmin } from '@/app/actions/telegramActions';

/**
 * Creates a booking after verifying that the vehicle is available for the requested time slot.
 */
export async function createBookingWithCheck(bookingData) {
    const { vehicleId, pickupInfo, tripDetails, customerInfo, userInfo, paymentInfo, vehicleInfo } = bookingData;
    const requestedStartTime = new Date(pickupInfo.dateTime);
    const rentalHours = Number(tripDetails.rentalHours);
    const requestedEndTime = new Date(requestedStartTime.getTime() + rentalHours * 60 * 60 * 1000);
    const requestedEndTimestamp = Timestamp.fromDate(requestedEndTime);
    const bookingsRef = db.collection('bookings');

    try {
        const transactionResult = await db.runTransaction(async (transaction) => {
            const conflictQuery = bookingsRef
                .where('vehicleId', '==', vehicleId)
                .where('status', 'in', ['pending', 'confirmed', 'assigned', 'stb', 'pickup'])
                .where('pickupInfo.dateTime', '<', requestedEndTimestamp);
            const conflictSnapshot = await transaction.get(conflictQuery);
            let isOverlapping = false;
            conflictSnapshot.forEach(doc => {
                const existingBooking = doc.data();
                const bookingStartTime = existingBooking.pickupInfo.dateTime.toDate();
                const bookingRentalHours = Number(existingBooking.tripDetails.rentalHours);
                const bookingEndTime = new Date(bookingStartTime.getTime() + (bookingRentalHours * 60 * 60 * 1000));
                if (requestedStartTime < bookingEndTime && requestedEndTime > bookingStartTime) {
                    isOverlapping = true;
                }
            });
            if (isOverlapping) {
                throw new Error('ขออภัย รถคันนี้ถูกจองในช่วงเวลาที่คุณเลือกไปแล้ว กรุณาเลือกเวลาใหม่');
            }
            const newBookingRef = bookingsRef.doc();
            transaction.set(newBookingRef, {
                ...bookingData,
                pickupInfo: {
                    ...bookingData.pickupInfo,
                    dateTime: Timestamp.fromDate(requestedStartTime),
                    latlng: new GeoPoint(bookingData.pickupInfo.latlng.latitude, bookingData.pickupInfo.latlng.longitude),
                },
                dropoffInfo: {
                    ...bookingData.dropoffInfo,
                    latlng: new GeoPoint(bookingData.dropoffInfo.latlng.latitude, bookingData.dropoffInfo.latlng.longitude),
                },
                createdAt: FieldValue.serverTimestamp(),
                updatedAt: FieldValue.serverTimestamp(),
            });
            const customerRef = db.collection("customers").doc(bookingData.userId);
            transaction.set(customerRef, {
                lineUserId: bookingData.userId,
                displayName: userInfo.displayName,
                name: customerInfo.name,
                pictureUrl: userInfo.pictureUrl || '',
                email: customerInfo.email,
                phone: customerInfo.phone,
                lastActivity: FieldValue.serverTimestamp()
            }, { merge: true });
            return { bookingId: newBookingRef.id };
        });
        const customerMessage = `การจองของคุณสำหรับรถ ${vehicleInfo.brand} ${vehicleInfo.model} ได้รับการยืนยันแล้วค่ะ ขณะนี้กำลังรอแอดมินตรวจสอบและมอบหมายคนขับให้คุณ`;
        await sendLineMessage(bookingData.userId, customerMessage);
        const pickupLocationName = pickupInfo.name || pickupInfo.address;
        const adminMessage = `🔔 มีรายการจองใหม่!\n\n*ลูกค้า:* ${customerInfo.name}\n*รถ:* ${vehicleInfo.brand} ${vehicleInfo.model}\n*รับที่:* ${pickupLocationName}\n*เวลานัด:* ${requestedStartTime.toLocaleString('th-TH')}\n*ราคา:* ${paymentInfo.totalPrice.toLocaleString()} บาท`;
        await sendTelegramMessageToAdmin(adminMessage);
        return { success: true, message: 'Booking created successfully!', id: transactionResult.bookingId };
    } catch (error) {
        console.error('Transaction failure:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Cancels a booking by an admin, updates statuses, and notifies the customer and driver.
 */
export async function cancelBookingByAdmin(bookingId, reason) {
    if (!bookingId || !reason) {
        return { success: false, error: 'Booking ID and reason are required.' };
    }
    const bookingRef = db.collection('bookings').doc(bookingId);
    try {
        const resultForNotification = await db.runTransaction(async (transaction) => {
            const bookingDoc = await transaction.get(bookingRef);
            if (!bookingDoc.exists) throw new Error("Booking not found!");
            const bookingData = bookingDoc.data();
            const driverId = bookingData.driverId;
            let driverDoc = null;
            let driverRef = null;
            if (driverId) {
                driverRef = db.collection('drivers').doc(driverId);
                driverDoc = await transaction.get(driverRef);
            }
            transaction.update(bookingRef, {
                status: 'cancelled',
                cancellationInfo: { cancelledBy: 'admin', reason, timestamp: FieldValue.serverTimestamp() },
                updatedAt: FieldValue.serverTimestamp()
            });
            if (driverRef && driverDoc && driverDoc.exists) {
                transaction.update(driverRef, { status: 'available' });
            }
            return { customerUserId: bookingData.userId, driverToNotify: driverDoc ? driverDoc.data() : null };
        });
        if (resultForNotification.customerUserId) {
            const customerMessage = `ขออภัยค่ะ การจองของคุณ (ID: ${bookingId.substring(0, 6).toUpperCase()}) ถูกยกเลิกเนื่องจาก: "${reason}"\n\nกรุณาติดต่อแอดมินสำหรับข้อมูลเพิ่มเติม`;
            await sendLineMessage(resultForNotification.customerUserId, customerMessage);
        }
        const { driverToNotify } = resultForNotification;
        if (driverToNotify && driverToNotify.lineUserId) {
            const driverMessage = `งาน #${bookingId.substring(0, 6).toUpperCase()} ถูกยกเลิกโดยแอดมิน\nเหตุผล: "${reason}"\n\nสถานะของคุณถูกเปลี่ยนเป็น "พร้อมขับ" แล้ว`;
            await sendLineMessage(driverToNotify.lineUserId, driverMessage);
        }
        return { success: true };
    } catch (error) {
        console.error("Error cancelling booking:", error);
        return { success: false, error: error.message };
    }
}

/**
 * Sends a review request link to the customer for a completed booking.
 */
export async function sendReviewRequestToCustomer(bookingId) {
    const bookingRef = db.collection('bookings').doc(bookingId);
    try {
        const bookingDoc = await bookingRef.get();
        if (!bookingDoc.exists) {
            console.log(`[Review Request] Booking not found for ID: ${bookingId}`);
            throw new Error("Booking not found.");
        }
        const bookingData = bookingDoc.data();

        if (bookingData.status !== 'completed') {
            console.log(`[Review Request] Booking status is '${bookingData.status}', not 'completed' for ID: ${bookingId}`);
            throw new Error("Cannot request review for an incomplete booking.");
        }

        if (bookingData.reviewInfo?.submitted) {
            console.log(`[Review Request] Booking already reviewed for ID: ${bookingId}`);
            throw new Error("This booking has already been reviewed.");
        }

        if (!bookingData.userId) {
            console.log(`[Review Request] No userId found for booking ID: ${bookingId}`);
            throw new Error("Customer LINE User ID not found.");
        }

        const reviewLiffUrl = `https://liff.line.me/${process.env.NEXT_PUBLIC_REVIEW_LIFF_ID}/${bookingId}`;
        const reviewMessage = `รบกวนสละเวลารีวิวการเดินทางของคุณ เพื่อนำไปพัฒนาบริการให้ดียิ่งขึ้น\n${reviewLiffUrl}`;

        await sendLineMessage(bookingData.userId, reviewMessage);

        return { success: true };
    } catch (error) {
        console.error(`[Review Request] Error sending review request for booking ID ${bookingId}:`, error);
        return { success: false, error: error.message };
    }
}


/**
 * Updates a booking's status, typically called by a driver.
 */
export async function updateBookingStatusByDriver(bookingId, driverId, newStatus, note) {
    if (!bookingId || !driverId || !newStatus) {
        return { success: false, error: 'Booking ID, Driver ID, and new status are required.' };
    }
    const bookingRef = db.collection('bookings').doc(bookingId);
    const driverRef = db.collection('drivers').doc(driverId);

    // --- ADDED: Variable to hold booking data for notifications ---
    let bookingDataForNotification = null;

    try {
        await db.runTransaction(async (transaction) => {
            const bookingDoc = await transaction.get(bookingRef);
            if (!bookingDoc.exists) throw new Error("Booking not found!");

            // --- ADDED: Get booking data here ---
            bookingDataForNotification = bookingDoc.data();

            transaction.update(bookingRef, {
                status: newStatus,
                statusHistory: FieldValue.arrayUnion({ status: newStatus, note: note || "", timestamp: Timestamp.now() }),
                updatedAt: FieldValue.serverTimestamp()
            });
            if (newStatus === 'completed' || newStatus === 'noshow') {
                transaction.update(driverRef, { status: 'available' });
            }
        });

        // --- MOVED & EDITED: Notification logic ---
        if (bookingDataForNotification && bookingDataForNotification.userId) {
            let customerMessage = '';
            switch (newStatus) {
                case 'stb':
                    customerMessage = `คนขับรถถึงจุดนัดรับแล้วค่ะ กรุณาเตรียมพร้อมสำหรับการเดินทาง`;
                    break;
                case 'pickup':
                    customerMessage = `คนขับได้รับคุณขึ้นรถแล้ว ขอให้เดินทางโดยสวัสดิภาพค่ะ`;
                    break;
                case 'completed':
                    // --- EDITED: Send two messages on completion ---
                    const thankYouMessage = `เดินทางถึงที่หมายเรียบร้อยแล้ว ขอบคุณที่ใช้บริการ CARFORTHIP ค่ะ`;
                    await sendLineMessage(bookingDataForNotification.userId, thankYouMessage);

                    const reviewLiffUrl = `https://liff.line.me/${process.env.NEXT_PUBLIC_REVIEW_LIFF_ID}/${bookingId}`;
                    const reviewMessage = `รบกวนสละเวลารีวิวการเดินทางของคุณ เพื่อนำไปพัฒนาบริการให้ดียิ่งขึ้น\n${reviewLiffUrl}`;
                    await sendLineMessage(bookingDataForNotification.userId, reviewMessage);

                    // Set customerMessage to empty to avoid sending it again below
                    customerMessage = '';
                    break;
                case 'noshow':
                    customerMessage = `คนขับไม่พบคุณที่จุดนัดรับตามเวลาที่กำหนด หากมีข้อสงสัยกรุณาติดต่อแอดมินค่ะ`;
                    break;
            }

            if (customerMessage) {
                await sendLineMessage(bookingDataForNotification.userId, customerMessage);
            }
        }

        return { success: true };
    } catch (error) {
        console.error("Error updating booking status:", error);
        return { success: false, error: error.message };
    }
}

/**
 * Cancels a booking by the customer who owns it.
 */
export async function cancelBookingByUser(bookingId, userId) {
    if (!bookingId || !userId) {
        return { success: false, error: 'Booking ID and User ID are required.' };
    }
    const bookingRef = db.collection('bookings').doc(bookingId);
    try {
        const result = await db.runTransaction(async (transaction) => {
            const bookingDoc = await transaction.get(bookingRef);
            if (!bookingDoc.exists) throw new Error("Booking not found.");
            const bookingData = bookingDoc.data();
            if (bookingData.userId !== userId) throw new Error("Permission denied.");
            if (bookingData.status !== 'pending') throw new Error("This booking cannot be cancelled.");
            transaction.update(bookingRef, {
                status: 'cancelled',
                cancellationInfo: { cancelledBy: 'customer', reason: 'Cancelled by customer.', timestamp: FieldValue.serverTimestamp() },
                updatedAt: FieldValue.serverTimestamp()
            });
            return { customerName: bookingData.customerInfo.name };
        });
        const adminMessage = `🚫 การจองถูกยกเลิกโดยลูกค้า\n\n*ลูกค้า:* ${result.customerName}\n*Booking ID:* ${bookingId.substring(0, 6).toUpperCase()}`;
        await sendTelegramMessageToAdmin(adminMessage);
        return { success: true };
    } catch (error) {
        console.error("Error cancelling booking by user:", error);
        return { success: false, error: error.message };
    }
}

/**
 * (ฟังก์ชันที่แก้ไข)
 * Sends an invoice link to the customer via LINE using the dedicated payment LIFF.
 */
export async function sendInvoiceToCustomer(bookingId) {
    const bookingRef = db.collection('bookings').doc(bookingId);
    try {
        const bookingDoc = await bookingRef.get();
        if (!bookingDoc.exists) {
            throw new Error("Booking not found.");
        }
        const bookingData = bookingDoc.data();

        // --- แก้ไข: เพิ่ม bookingId เข้าไปใน LIFF URL ---
        const liffUrl = `https://liff.line.me/${process.env.NEXT_PUBLIC_PAYMENT_LIFF_ID}/${bookingId}`;

        await bookingRef.update({
            'paymentInfo.paymentStatus': 'invoiced',
            updatedAt: FieldValue.serverTimestamp()
        });

        const customerMessage = `เรียนคุณ ${bookingData.customerInfo.name},\n\nนี่คือใบแจ้งค่าบริการสำหรับการเดินทางของคุณ\nยอดชำระ: ${bookingData.paymentInfo.totalPrice.toLocaleString()} บาท\n\nกรุณาคลิกที่ลิงก์เพื่อชำระเงิน:\n${liffUrl}`;

        await sendLineMessage(bookingData.userId, customerMessage);

        return { success: true };
    } catch (error) {
        console.error("Error sending invoice:", error);
        return { success: false, error: error.message };
    }
}
/**
 * (ฟังก์ชันที่เพิ่มเข้ามาใหม่)
 * Confirms that a payment has been received for a booking.
 */
export async function confirmPayment(bookingId) {
    const bookingRef = db.collection('bookings').doc(bookingId);
    try {
        await bookingRef.update({
            'paymentInfo.paymentStatus': 'paid',
            'paymentInfo.paidAt': FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp()
        });
        return { success: true };
    } catch (error) {
        console.error("Error confirming payment:", error);
        return { success: false, error: error.message };
    }
}
