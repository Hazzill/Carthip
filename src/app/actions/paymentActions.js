import QRCode from 'qrcode';

export async function generateQrCodePayload(promptPayId, amount) {
  try {
    console.log('PromptPay ID:', promptPayId);
    console.log('Booking amount:', amount);
    // Generate the QR code data URL using the qrcode library
    const qrCodeDataUrl = await QRCode.toDataURL(promptPayId, { amount: amount });

    return qrCodeDataUrl;

  } catch (error) {
    console.error('Error generating QR code payload:', error);
    throw new Error('Failed to generate QR code payload.');
  }
}

// The original PaymentLayout function remains here as it was not requested to be removed.