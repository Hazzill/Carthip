import { Client } from '@line/bot-sdk';
import { NextResponse } from 'next/server';

// Initialize LINE Bot client
const client = new Client({
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET,
});

export async function POST(request) {
  try {
    const body = await request.json();
    const { to, message } = body;

    if (!to || !message) {
      return NextResponse.json({ message: 'Missing "to" or "message" in request body' }, { status: 400 });
    }

    // Create a text message object
    const messageObject = {
      type: 'text',
      text: message,
    };

    // Send the push message
    await client.pushMessage(to, messageObject);

    return NextResponse.json({ success: true, message: `Message sent to ${to}` });

  } catch (error) {
    console.error('Error sending LINE message:', error.originalError?.response?.data || error);
    return NextResponse.json({ success: false, message: 'Failed to send message' }, { status: 500 });
  }
}
