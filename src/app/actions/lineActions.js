"use server";

import { Client } from '@line/bot-sdk';
import { db } from '@/app/lib/firebaseAdmin'; // 1. Import db จาก Admin SDK
import { collection, getDocs, query, where } from 'firebase/firestore';

const client = new Client({
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET,
});

/**
 * Sends a push message to a single LINE user.
 */
export async function sendLineMessage(to, messageText) {
  if (!to || !messageText) {
    console.error("Missing 'to' or 'messageText'");
    return { success: false, error: "Missing recipient or message." };
  }
  try {
    const messageObject = { type: 'text', text: messageText };
    await client.pushMessage(to, messageObject);
    return { success: true };
  } catch (error) {
    console.error(`Failed to send message to ${to}:`, error.originalError?.response?.data || error);
    return { success: false, error: 'Failed to send message' };
  }
}

/**
 * (ใหม่) Sends a push message to all registered admins.
 * @param {string} messageText - The text message to send.
 * @returns {Promise<{success: boolean, error?: string}>} - The result of the operation.
 */
export async function sendLineMessageToAllAdmins(messageText) {
  try {
    // 2. ค้นหาแอดมินทั้งหมดใน Firestore
    const adminsQuery = query(collection(db, 'admins'), where("lineUserId", "!=", null));
    const adminSnapshot = await getDocs(adminsQuery);

    if (adminSnapshot.empty) {
      console.warn("No admins with lineUserId found to notify.");
      return { success: true, message: "No admins to notify." };
    }

    // 3. สร้าง Promise สำหรับส่งข้อความหาแอดมินทุกคน
    const notificationPromises = adminSnapshot.docs.map(doc => {
      const admin = doc.data();
      return sendLineMessage(admin.lineUserId, messageText);
    });

    // 4. รอให้ส่งข้อความครบทุกคน
    await Promise.all(notificationPromises);

    console.log(`Successfully sent notifications to ${adminSnapshot.size} admins.`);
    return { success: true };

  } catch (error) {
    console.error('Error sending message to all admins:', error);
    return { success: false, error: 'Failed to send message to admins' };
  }
}
