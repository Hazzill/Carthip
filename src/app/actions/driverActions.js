"use server";

import { db } from '@/app/lib/firebaseAdmin';

/**
 * Registers a LINE User ID to a driver profile based on their phone number.
 * @param {string} phoneNumber - The phone number entered by the driver.
 * @param {string} lineUserId - The LINE User ID from the LIFF context.
 * @returns {Promise<object>} - An object indicating success or failure.
 */
export async function registerLineIdToDriver(phoneNumber, lineUserId) {
    if (!phoneNumber || !lineUserId) {
        return { success: false, error: 'Phone number and LINE User ID are required.' };
    }

    const driversRef = db.collection('drivers');
    
    // 1. Find the driver by phone number
    const query = driversRef.where('phoneNumber', '==', phoneNumber).limit(1);
    const snapshot = await query.get();

    if (snapshot.empty) {
        return { success: false, error: 'ไม่พบเบอร์โทรศัพท์นี้ในระบบ กรุณาติดต่อแอดมิน' };
    }

    const driverDoc = snapshot.docs[0];
    const driverData = driverDoc.data();

    // 2. Check if the driver is already linked to another LINE account
    if (driverData.lineUserId && driverData.lineUserId !== '') {
        return { success: false, error: 'เบอร์โทรศัพท์นี้ถูกผูกกับบัญชี LINE อื่นไปแล้ว' };
    }

    // 3. Update the driver document with the new LINE User ID
    try {
        await driverDoc.ref.update({
            lineUserId: lineUserId
        });
        return { success: true, message: 'ยืนยันตัวตนสำเร็จ' };
    } catch (error) {
        console.error("Error updating driver document:", error);
        return { success: false, error: 'เกิดข้อผิดพลาดในการบันทึกข้อมูล' };
    }
}