'use server';

import { db } from '@/app/lib/firebaseAdmin';
import { FieldValue, GeoPoint, Timestamp } from 'firebase-admin/firestore';
import { sendLineMessage } from '@/app/actions/lineActions';
import { sendTelegramMessageToAdmin } from '@/app/actions/telegramActions';

/**
 * สร้างการจองใหม่พร้อมตรวจสอบว่าช่วงเวลาที่ขอมานั้นรถว่างหรือไม่
 * @param {object} bookingData - ข้อมูลทั้งหมดที่จำเป็นสำหรับการสร้างการจอง
 * @returns {Promise<object>} - ผลลัพธ์ของการสร้างการจอง
 */
export async function createBookingWithCheck(bookingData) {
    // ดึงข้อมูลที่จำเป็นออกมาจาก bookingData
    const { vehicleId, pickupInfo, tripDetails, customerInfo, userInfo, paymentInfo, vehicleInfo } = bookingData;
    
    // แปลงข้อมูลเวลาที่รับมาเป็น Object Date ของ JavaScript
    const requestedStartTime = new Date(pickupInfo.dateTime);
    const rentalHours = Number(tripDetails.rentalHours);
    // คำนวณเวลาสิ้นสุดการจอง
    const requestedEndTime = new Date(requestedStartTime.getTime() + rentalHours * 60 * 60 * 1000);
    // แปลงเวลาสิ้นสุดเป็น Timestamp ของ Firestore เพื่อใช้ในการ query
    const requestedEndTimestamp = Timestamp.fromDate(requestedEndTime);
    
    const bookingsRef = db.collection('bookings');

    try {
        // ใช้ Transaction เพื่อให้แน่ใจว่าการตรวจสอบและการสร้างข้อมูลจะสำเร็จไปพร้อมกันทั้งหมด
        // หรือไม่ก็ล้มเหลวทั้งหมด เพื่อป้องกันข้อมูลผิดพลาด
        const transactionResult = await db.runTransaction(async (transaction) => {
            // 1. ตรวจสอบช่วงเวลาทับซ้อน (Conflict Check)
            // ค้นหาการจองทั้งหมดของรถคันนี้ที่มีสถานะยังไม่เสร็จสิ้น
            // และมีเวลานัดรับก่อน 'เวลาสิ้นสุด' ของการจองใหม่ที่เรากำลังจะสร้าง
            const conflictQuery = bookingsRef
                .where('vehicleId', '==', vehicleId)
                .where('status', 'in', ['pending', 'confirmed', 'assigned', 'stb', 'pickup'])
                .where('pickupInfo.dateTime', '<', requestedEndTimestamp);
            
            const conflictSnapshot = await transaction.get(conflictQuery);
            let isOverlapping = false;
            
            // วนลูปการจองที่อาจจะทับซ้อนทั้งหมดเพื่อตรวจสอบอย่างละเอียด
            conflictSnapshot.forEach(doc => {
                const existingBooking = doc.data();
                const bookingStartTime = existingBooking.pickupInfo.dateTime.toDate();
                const bookingRentalHours = Number(existingBooking.tripDetails.rentalHours);
                const bookingEndTime = new Date(bookingStartTime.getTime() + (bookingRentalHours * 60 * 60 * 1000));
                
                // เช็คว่าเวลาของการจองใหม่ (requested) ไปทับซ้อนกับเวลาของการจองที่มีอยู่ (booking) หรือไม่
                if (requestedStartTime < bookingEndTime && requestedEndTime > bookingStartTime) {
                    isOverlapping = true;
                }
            });

            // ถ้าพบว่ามีช่วงเวลาทับซ้อน ให้โยน Error ออกไปเพื่อหยุด Transaction
            if (isOverlapping) {
                throw new Error('ขออภัย รถคันนี้ถูกจองในช่วงเวลาที่คุณเลือกไปแล้ว กรุณาเลือกเวลาใหม่');
            }

            // 2. ถ้าไม่ทับซ้อน ให้สร้างการจองใหม่
            const newBookingRef = bookingsRef.doc();
            transaction.set(newBookingRef, {
                ...bookingData,
                // แปลงข้อมูลบางอย่างให้อยู่ในรูปแบบที่ Firestore เข้าใจ เช่น Timestamp, GeoPoint
                pickupInfo: {
                    ...bookingData.pickupInfo,
                    dateTime: Timestamp.fromDate(requestedStartTime),
                    latlng: new GeoPoint(bookingData.pickupInfo.latlng.latitude, bookingData.pickupInfo.latlng.longitude),
                },
                dropoffInfo: {
                    ...bookingData.dropoffInfo,
                    latlng: new GeoPoint(bookingData.dropoffInfo.latlng.latitude, bookingData.dropoffInfo.latlng.longitude),
                },
                createdAt: FieldValue.serverTimestamp(), // ใช้เวลาจาก Server
                updatedAt: FieldValue.serverTimestamp(),
            });
            
            // 3. อัปเดตหรือสร้างข้อมูลลูกค้าใน collection 'customers'
            const customerRef = db.collection("customers").doc(bookingData.userId);
            transaction.set(customerRef, {
                lineUserId: bookingData.userId,
                displayName: userInfo.displayName,
                name: customerInfo.name,
                pictureUrl: userInfo.pictureUrl || '',
                email: customerInfo.email,
                phone: customerInfo.phone,
                lastActivity: FieldValue.serverTimestamp()
            }, { merge: true }); // merge: true เพื่ออัปเดตเฉพาะ field ที่มีข้อมูลใหม่

            return { bookingId: newBookingRef.id };
        });

        // 4. ส่งข้อความแจ้งเตือนเมื่อ Transaction สำเร็จ
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
 * ยกเลิกการจองโดยแอดมิน, อัปเดตสถานะ, และแจ้งเตือนลูกค้ากับคนขับ
 */
export async function cancelBookingByAdmin(bookingId, reason) {
    if (!bookingId || !reason) {
        return { success: false, error: 'จำเป็นต้องมี Booking ID และเหตุผล' };
    }
    const bookingRef = db.collection('bookings').doc(bookingId);
    try {
        const resultForNotification = await db.runTransaction(async (transaction) => {
            const bookingDoc = await transaction.get(bookingRef);
            if (!bookingDoc.exists) throw new Error("ไม่พบข้อมูลการจอง!");
            
            const bookingData = bookingDoc.data();
            const driverId = bookingData.driverId;
            let driverDoc = null;
            let driverRef = null;

            if (driverId) {
                driverRef = db.collection('drivers').doc(driverId);
                driverDoc = await transaction.get(driverRef);
            }

            // อัปเดตสถานะการจองเป็น 'cancelled'
            transaction.update(bookingRef, {
                status: 'cancelled',
                cancellationInfo: { cancelledBy: 'admin', reason, timestamp: FieldValue.serverTimestamp() },
                updatedAt: FieldValue.serverTimestamp()
            });

            // ถ้ามีคนขับที่รับงานนี้อยู่ ให้เปลี่ยนสถานะคนขับกลับเป็น 'available' (พร้อมขับ)
            if (driverRef && driverDoc && driverDoc.exists) {
                transaction.update(driverRef, { status: 'available' });
            }
            
            return { customerUserId: bookingData.userId, driverToNotify: driverDoc ? driverDoc.data() : null };
        });

        // ส่งข้อความแจ้งลูกค้า
        if (resultForNotification.customerUserId) {
            const customerMessage = `ขออภัยค่ะ การจองของคุณ (ID: ${bookingId.substring(0, 6).toUpperCase()}) ถูกยกเลิกเนื่องจาก: "${reason}"\n\nกรุณาติดต่อแอดมินสำหรับข้อมูลเพิ่มเติม`;
            await sendLineMessage(resultForNotification.customerUserId, customerMessage);
        }
        
        // ส่งข้อความแจ้งคนขับ (ถ้ามี)
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
 * ส่งลิงก์สำหรับทำรีวิวให้ลูกค้าเมื่องานเสร็จสิ้น
 */
export async function sendReviewRequestToCustomer(bookingId) {
    const bookingRef = db.collection('bookings').doc(bookingId);
    try {
        const bookingDoc = await bookingRef.get();
        if (!bookingDoc.exists) {
            throw new Error("ไม่พบข้อมูลการจอง");
        }
        const bookingData = bookingDoc.data();

        if (bookingData.status !== 'completed') {
            throw new Error("ไม่สามารถส่งรีวิวสำหรับงานที่ยังไม่เสร็จสิ้น");
        }

        if (bookingData.reviewInfo?.submitted) {
            throw new Error("การจองนี้ได้รับการรีวิวแล้ว");
        }

        if (!bookingData.userId) {
            throw new Error("ไม่พบ LINE User ID ของลูกค้า");
        }

        // สร้าง LIFF URL สำหรับหน้ารีวิวโดยเฉพาะ
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
 * อัปเดตสถานะการจอง (โดยปกติจะถูกเรียกใช้โดยคนขับ)
 */
export async function updateBookingStatusByDriver(bookingId, driverId, newStatus, note) {
    if (!bookingId || !driverId || !newStatus) {
        return { success: false, error: 'ต้องการ Booking ID, Driver ID, และสถานะใหม่' };
    }
    const bookingRef = db.collection('bookings').doc(bookingId);
    const driverRef = db.collection('drivers').doc(driverId);

    let bookingDataForNotification = null;

    try {
        await db.runTransaction(async (transaction) => {
            const bookingDoc = await transaction.get(bookingRef);
            if (!bookingDoc.exists) throw new Error("ไม่พบข้อมูลการจอง!");

            bookingDataForNotification = bookingDoc.data();

            // อัปเดตสถานะและเพิ่มประวัติ
            transaction.update(bookingRef, {
                status: newStatus,
                statusHistory: FieldValue.arrayUnion({ status: newStatus, note: note || "", timestamp: Timestamp.now() }),
                updatedAt: FieldValue.serverTimestamp()
            });
            // เมื่องานเสร็จสิ้น (completed) หรือลูกค้าไม่มา (noshow) ให้เปลี่ยนสถานะคนขับเป็น 'available'
            if (newStatus === 'completed' || newStatus === 'noshow') {
                transaction.update(driverRef, { status: 'available' });
            }
        });
        
        // ส่วนของการส่งข้อความแจ้งเตือนลูกค้าตามสถานะต่างๆ
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
                    // เมื่องานเสร็จ จะส่ง 2 ข้อความ: ขอบคุณ และ ขอรีวิว
                    const thankYouMessage = `เดินทางถึงที่หมายเรียบร้อยแล้ว ขอบคุณที่ใช้บริการ CARFORTHIP ค่ะ`;
                    await sendLineMessage(bookingDataForNotification.userId, thankYouMessage);

                    const reviewLiffUrl = `https://liff.line.me/${process.env.NEXT_PUBLIC_REVIEW_LIFF_ID}/${bookingId}`;
                    const reviewMessage = `รบกวนสละเวลารีวิวการเดินทางของคุณ เพื่อนำไปพัฒนาบริการให้ดียิ่งขึ้น\n${reviewLiffUrl}`;
                    await sendLineMessage(bookingDataForNotification.userId, reviewMessage);

                    customerMessage = ''; // ไม่ต้องส่งข้อความซ้ำ
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
 * ยกเลิกการจองโดยลูกค้า (เจ้าของการจอง)
*/
export async function cancelBookingByUser(bookingId, userId) {
    if (!bookingId || !userId) {
        return { success: false, error: 'ต้องการ Booking ID และ User ID' };
    }
    const bookingRef = db.collection('bookings').doc(bookingId);
    try {
        const result = await db.runTransaction(async (transaction) => {
            const bookingDoc = await transaction.get(bookingRef);
            if (!bookingDoc.exists) throw new Error("ไม่พบข้อมูลการจอง");
            
            const bookingData = bookingDoc.data();
            // ตรวจสอบว่าเป็นเจ้าของการจองจริง
            if (bookingData.userId !== userId) throw new Error("ไม่มีสิทธิ์ยกเลิกการจองนี้");
            // อนุญาตให้ยกเลิกได้เฉพาะสถานะ 'pending' เท่านั้น
            if (bookingData.status !== 'pending') throw new Error("การจองนี้ไม่สามารถยกเลิกได้");

            transaction.update(bookingRef, {
                status: 'cancelled',
                cancellationInfo: { cancelledBy: 'customer', reason: 'Cancelled by customer.', timestamp: FieldValue.serverTimestamp() },
                updatedAt: FieldValue.serverTimestamp()
            });
            return { customerName: bookingData.customerInfo.name };
        });
        
        // แจ้งเตือนแอดมินเมื่อลูกค้าทำการยกเลิก
        const adminMessage = `🚫 การจองถูกยกเลิกโดยลูกค้า\n\n*ลูกค้า:* ${result.customerName}\n*Booking ID:* ${bookingId.substring(0, 6).toUpperCase()}`;
        await sendTelegramMessageToAdmin(adminMessage);
        
        return { success: true };
    } catch (error) {
        console.error("Error cancelling booking by user:", error);
        return { success: false, error: error.message };
    }
}

/**
 * (แก้ไข) ส่งลิงก์ใบแจ้งหนี้ให้ลูกค้าผ่าน LINE โดยใช้ LIFF สำหรับการชำระเงินโดยเฉพาะ
 */
export async function sendInvoiceToCustomer(bookingId) {
    const bookingRef = db.collection('bookings').doc(bookingId);
    try {
        const bookingDoc = await bookingRef.get();
        if (!bookingDoc.exists) {
            throw new Error("ไม่พบข้อมูลการจอง");
        }
        const bookingData = bookingDoc.data();

        // **สำคัญ** สร้าง LIFF URL โดยมี bookingId ต่อท้าย
        const liffUrl = `https://liff.line.me/${process.env.NEXT_PUBLIC_PAYMENT_LIFF_ID}/${bookingId}`;

        await bookingRef.update({
            'paymentInfo.paymentStatus': 'invoiced', // เปลี่ยนสถานะเป็น 'ส่งใบแจ้งหนี้แล้ว'
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
 * (เพิ่มใหม่) ยืนยันว่าได้รับการชำระเงินสำหรับการจองแล้ว
 */
export async function confirmPayment(bookingId) {
    const bookingRef = db.collection('bookings').doc(bookingId);
    try {
        await bookingRef.update({
            'paymentInfo.paymentStatus': 'paid', // เปลี่ยนสถานะการจ่ายเงินเป็น 'paid'
            'paymentInfo.paidAt': FieldValue.serverTimestamp(), // บันทึกเวลาที่จ่ายเงิน
            updatedAt: FieldValue.serverTimestamp()
        });
        return { success: true };
    } catch (error) {
        console.error("Error confirming payment:", error);
        return { success: false, error: error.message };
    }
}
