"use server";

import { db } from '@/app/lib/firebaseAdmin';

/**
 * Fetches all admin users from the 'admins' collection.
 * @returns {Promise<{success: boolean, admins?: Array, error?: string}>}
 */
export async function fetchAllAdmins() {
  try {
    const adminsRef = db.collection('admins');
    const snapshot = await adminsRef.orderBy('firstName').get();

    if (snapshot.empty) {
      return { success: true, admins: [] };
    }

    const admins = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
            id: doc.id, // ใช้ uid ที่เป็น document id
            firstName: data.firstName,
            lastName: data.lastName
        };
    });

    return { success: true, admins: JSON.parse(JSON.stringify(admins)) };
  } catch (error) {
    console.error("Error fetching all admins:", error);
    return { success: false, error: error.message };
  }
}