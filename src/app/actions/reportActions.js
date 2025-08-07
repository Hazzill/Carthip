"use server";

import { db } from '@/app/lib/firebaseAdmin';
import { sendLineMessage } from './lineActions';
import { Timestamp } from 'firebase-admin/firestore';

/**
 * Generates and sends a daily report to selected admins.
 */
export async function sendDailyReportNow() {
  try {
    // 1. ดึงข้อมูลการตั้งค่าเพื่อดูว่าต้องส่งให้ใครบ้าง
    const settingsRef = db.collection('settings').doc('notifications');
    const settingsDoc = await settingsRef.get();
    if (!settingsDoc.exists) {
      throw new Error("ยังไม่มีการตั้งค่าการส่ง Report");
    }
    const settingsData = settingsDoc.data();
    const recipientUids = settingsData.reportRecipients;

    if (!recipientUids || recipientUids.length === 0) {
      return { success: true, message: "ไม่มีผู้รับที่ถูกตั้งค่าไว้" };
    }

    // 2. ดึงข้อมูล lineUserId ของแอดมินที่ต้องรับ Report
    const adminsRef = db.collection('admins');
    const adminsSnapshot = await adminsRef.where('uid', 'in', recipientUids).get();
    const recipientLineIds = adminsSnapshot.docs
        .map(doc => doc.data().lineUserId)
        .filter(Boolean); // กรองเอาเฉพาะคนที่มี lineUserId

    if (recipientLineIds.length === 0) {
        return { success: true, message: "ผู้รับที่เลือกไม่มี Line User ID" };
    }

    // 3. ดึงข้อมูลการจองสำหรับวันนี้
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const bookingsQuery = db.collection('bookings')
      .where('createdAt', '>=', Timestamp.fromDate(today))
      .where('createdAt', '<', Timestamp.fromDate(tomorrow));
      
    const bookingsSnapshot = await bookingsQuery.get();
    const todaysBookings = bookingsSnapshot.docs.map(doc => doc.data());

    // 4. สรุปข้อมูล
    const totalBookings = todaysBookings.length;
    const completedBookings = todaysBookings.filter(b => b.status === 'completed').length;
    const cancelledBookings = todaysBookings.filter(b => b.status === 'cancelled').length;
    const totalRevenue = todaysBookings
      .filter(b => b.paymentInfo.paymentStatus === 'paid')
      .reduce((sum, b) => sum + b.paymentInfo.totalPrice, 0);

    // 5. สร้างข้อความ Report
    const reportMessage = `📊 Report สรุปประจำวันที่ ${today.toLocaleDateString('th-TH')}\n\n` +
      `- รายการจองใหม่: ${totalBookings} รายการ\n` +
      `- งานที่สำเร็จ: ${completedBookings} รายการ\n` +
      `- ยกเลิก: ${cancelledBookings} รายการ\n` +
      `- รายได้รวม: ${totalRevenue.toLocaleString()} บาท\n\n` +
      `(ข้อความนี้ถูกสร้างโดยการกดส่งทันที)`;

    // 6. ส่งข้อความไปยังแอดมินทุกคนที่เลือกไว้
    const sendPromises = recipientLineIds.map(lineId => sendLineMessage(lineId, reportMessage));
    await Promise.all(sendPromises);

    return { success: true, message: `ส่ง Report สำเร็จไปยังแอดมิน ${recipientLineIds.length} คน` };

  } catch (error) {
    console.error("Error sending daily report:", error);
    return { success: false, error: error.message };
  }
}