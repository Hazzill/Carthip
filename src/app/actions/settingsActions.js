"use server";

import { db } from '@/app/lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';

/**
 * Saves notification settings to Firestore.
 * @param {object} settingsData - The settings object from the form.
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function saveNotificationSettings(settingsData) {
  try {
    const settingsRef = db.collection('settings').doc('notifications');
    
    await settingsRef.set({
      ...settingsData,
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true }); // Use merge to avoid overwriting other settings if any

    console.log("Successfully saved notification settings.");
    return { success: true };

  } catch (error) {
    console.error("Error saving notification settings:", error);
    return { success: false, error: error.message };
  }
}