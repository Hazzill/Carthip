"use server";

export async function sendTelegramMessageToAdmin(messageText) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_ADMIN_CHAT_ID;

  if (!botToken || !chatId) {
    console.error("Telegram Bot Token or Chat ID is not configured in .env.local");
    return { success: false, error: "Telegram not configured." };
  }

  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: chatId,
        text: messageText,
        parse_mode: 'Markdown', // Optional: for formatting like *bold* or _italic_
      }),
    });

    const result = await response.json();

    if (!result.ok) {
      throw new Error(result.description || "Telegram API error");
    }

    console.log("Successfully sent Telegram message.");
    return { success: true };

  } catch (error) {
    console.error("Error sending Telegram message:", error);
    return { success: false, error: error.message };
  }
}
