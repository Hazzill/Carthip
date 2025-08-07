import { NextResponse } from 'next/server';
import { db } from '@/app/lib/firebaseAdmin';
import { sendLineMessage } from '@/app/actions/lineActions';
import { Timestamp, FieldPath } from 'firebase-admin/firestore';

export async function GET() {
    // Security Check: ตรวจสอบว่า request มาจาก Vercel Cron หรือไม่
    // สามารถเพิ่มการตรวจสอบ 'x-vercel-cron-secret' header ได้เพื่อความปลอดภัยสูงสุด
    
    try {
        console.log('Cron job triggered by Vercel: Starting daily report process...');

        const settingsRef = db.collection('settings').doc('notifications');
        const settingsDoc = await settingsRef.get();
        if (!settingsDoc.exists) {
            throw new Error("ยังไม่มีการตั้งค่าการส่ง Report");
        }
        const settingsData = settingsDoc.data();
        const { reportRecipients } = settingsData;

        if (!reportRecipients || reportRecipients.length === 0) {
            return NextResponse.json({ message: "ไม่มีผู้รับที่ถูกตั้งค่าไว้" });
        }

        const adminsRef = db.collection('admins');
        const adminsSnapshot = await adminsRef.where(FieldPath.documentId(), 'in', reportRecipients).get();
        const recipientLineIds = adminsSnapshot.docs
            .map(doc => doc.data().lineUserId)
            .filter(Boolean);

        if (recipientLineIds.length === 0) {
            return NextResponse.json({ message: "ผู้รับที่เลือกไม่มี Line User ID" });
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const bookingsSnapshot = await db.collection('bookings')
            .where('createdAt', '>=', Timestamp.fromDate(today))
            .where('createdAt', '<', Timestamp.fromDate(tomorrow))
            .get();
            
        const todaysBookings = bookingsSnapshot.docs.map(doc => doc.data());

        const totalBookings = todaysBookings.length;
        const totalRevenue = todaysBookings
            .filter(b => b.paymentInfo.paymentStatus === 'paid')
            .reduce((sum, b) => sum + b.paymentInfo.totalPrice, 0);

        const reportMessage = `📊 Report สรุปอัตโนมัติ ประจำวันที่ ${today.toLocaleDateString('th-TH', { timeZone: 'Asia/Bangkok' })}\n\n` +
            `- รายการจองใหม่: ${totalBookings} รายการ\n` +
            `- รายได้รวม: ${totalRevenue.toLocaleString()} บาท`;

        const sendPromises = recipientLineIds.map(lineId => sendLineMessage(lineId, reportMessage));
        await Promise.all(sendPromises);

        return NextResponse.json({ success: true, message: `ส่ง Report สำเร็จไปยังแอดมิน ${recipientLineIds.length} คน` });

    } catch (error) {
        console.error("Vercel Cron job error:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}