// src/app/api/firebase-custom-token/route.js

import { NextResponse } from 'next/server';
import { auth as adminAuth } from '@/app/lib/firebaseAdmin'; // 1. Import Admin SDK
import { Client } from '@line/bot-sdk'; // 2. Import LINE SDK สำหรับตรวจสอบ Token

// 3. ตั้งค่า LINE Client ด้วยค่าจาก .env.local
const client = new Client({
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET,
});

export async function POST(request) {
  try {
    const body = await request.json();
    const { idToken } = body;

    if (!idToken) {
      return NextResponse.json({ error: 'ID token is required.' }, { status: 400 });
    }

    // --- 4. เพิ่มขั้นตอนการตรวจสอบ ID Token กับ LINE ---
    // เพื่อความปลอดภัยสูงสุด เราต้องแน่ใจว่า Token นี้มาจาก LINE จริงๆ
    let lineProfile;
    try {
        lineProfile = await client.getProfile(idToken); // ใช้ idToken ในการ getProfile เพื่อ verify
    } catch (lineError) {
        console.error('LINE token verification failed:', lineError);
        return NextResponse.json({ error: 'Invalid or expired LINE token.' }, { status: 401 });
    }

    const uid = lineProfile.userId; // 5. ใช้ userId ที่ได้จากการ verify แล้วเท่านั้น

    // 6. สร้าง Custom Token จาก Firebase Admin SDK
    const customToken = await adminAuth.createCustomToken(uid);

    return NextResponse.json({ customToken });

  } catch (error) {
    console.error('Custom token creation error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
