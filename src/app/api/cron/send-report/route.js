import { NextResponse } from 'next/server';
import { db } from '@/app/lib/firebaseAdmin';
import { sendLineMessage } from '@/app/actions/lineActions';
import { Timestamp, FieldPath } from 'firebase-admin/firestore';

export async function GET(request) {
    try {
        const settingsRef = db.collection('settings').doc('notifications');
        const settingsDoc = await settingsRef.get();
        if (!settingsDoc.exists) {
            console.log("Settings not found. Cron job exiting.");
            return NextResponse.json({ message: "ยังไม่มีการตั้งค่า" });
        }
        
        const settingsData = settingsDoc.data();
        const { reportSendTime, reportRecipients, lastReportSentDate } = settingsData;
        
        // --- 1. ตรวจสอบเวลาโดยใช้โซน GMT+7 ---
        const now = new Date();
        const gmt7Time = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Bangkok' }));
        const currentHour = gmt7Time.getHours();
        const [settingHour] = reportSendTime.split(':').map(Number);
        
        // ถ้ายังไม่ถึงชั่วโมงที่ตั้งไว้ ให้ออกจากฟังก์ชัน
        if (currentHour !== settingHour) {
            return NextResponse.json({ message: `Current hour: ${currentHour}, Scheduled for: ${settingHour}. Skipping.` });
        }
        
        // --- 2. ตรวจสอบว่าวันนี้ส่ง Report ไปแล้วหรือยัง ---
        const todayStr = gmt7Time.toISOString().split('T')[0]; // Format: YYYY-MM-DD
        if (lastReportSentDate === todayStr) {
            return NextResponse.json({ message: `Report for ${todayStr} already sent. Skipping.` });
        }

        // --- เริ่มกระบวนการส่ง Report (ถ้าเวลาตรงและยังไม่เคยส่ง) ---
        if (!reportRecipients || reportRecipients.length === 0) {
            return NextResponse.json({ message: "ไม่มีผู้รับที่ถูกตั้งค่าไว้" });
        }

        const recipientLineIds = (await db.collection('admins').where(FieldPath.documentId(), 'in', reportRecipients).get())
            .docs.map(doc => doc.data().lineUserId).filter(Boolean);

        if (recipientLineIds.length === 0) {
            return NextResponse.json({ message: "ผู้รับที่เลือกไม่มี Line User ID" });
        }

        // ดึงข้อมูลการจอง
        const reportDate = new Date(gmt7Time);
        reportDate.setHours(0,0,0,0);
        const nextDay = new Date(reportDate);
        nextDay.setDate(reportDate.getDate() + 1);

        const bookingsSnapshot = await db.collection('bookings')
            .where('createdAt', '>=', Timestamp.fromDate(reportDate))
            .where('createdAt', '<', Timestamp.fromDate(nextDay))
            .get();
        
        const todaysBookings = bookingsSnapshot.docs.map(doc => doc.data());

        // สร้างและส่ง Report
        const reportMessage = `📊 Report สรุปอัตโนมัติ ประจำวันที่ ${reportDate.toLocaleDateString('th-TH')}\n\n` +
            `- รายการจองใหม่: ${todaysBookings.length} รายการ\n` +
            `- รายได้รวม: ${todaysBookings.filter(b => b.paymentInfo.paymentStatus === 'paid').reduce((sum, b) => sum + b.paymentInfo.totalPrice, 0).toLocaleString()} บาท`;

        await Promise.all(recipientLineIds.map(lineId => sendLineMessage(lineId, reportMessage)));

        // --- 3. บันทึกว่าวันนี้ส่ง Report ไปแล้ว ---
        await settingsRef.update({ lastReportSentDate: todayStr });

        return NextResponse.json({ success: true, message: `ส่ง Report สำเร็จไปยังแอดมิน ${recipientLineIds.length} คน` });

    } catch (error) {
        console.error("Cron job error:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
