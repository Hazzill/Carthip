// src/app/actions/vehicleActions.js
"use server";

import { db } from '@/app/lib/firebaseAdmin'; 
import { revalidatePath } from 'next/cache';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';

/**
 * (ฟังก์ชันเดิม)
 * Adds a new vehicle to the Firestore collection.
 */
export async function addVehicle(formData) {
  try {
    const vehicleData = {
      plateNumber: formData.get('plateNumber'),
      brand: formData.get('brand'),
      model: formData.get('model'),
      type: formData.get('type'),
      color: formData.get('color'),
      status: 'available',
      createdAt: FieldValue.serverTimestamp(),
    };
    
    const vehicleRef = await db.collection('vehicles').add(vehicleData);
    
    console.log('✅ Vehicle added to Firestore with ID: ', vehicleRef.id);

    revalidatePath('/admin/vehicles'); 

    return { success: true, message: `เพิ่มรถสำเร็จ ID: ${vehicleRef.id}` };

  } catch (error) {
    console.error("🔥 Error adding vehicle to Firestore:", error);
    return { success: false, error: error.message };
  }
}

/**
 * (ฟังก์ชันที่แก้ไขใหม่)
 * Fetches all vehicles and their active booking schedules.
 * This allows the client-side to determine availability based on user input.
 * @returns {Promise<{vehicles: Array, bookings: Object}|{error: string, details: string}>}
 */
export async function fetchAllVehiclesWithSchedules() {
  try {
    // 1. Get all vehicles with 'available' status, ordered by brand and model.
    const vehiclesRef = db.collection('vehicles');
    const vehiclesQuery = vehiclesRef.where('status', '==', 'available').orderBy('brand').orderBy('model');
    const vehiclesSnapshot = await vehiclesQuery.get();
    const vehicles = vehiclesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    const vehicleIds = vehicles.map(v => v.id);
    if (vehicleIds.length === 0) {
      return { vehicles: [], bookings: {} };
    }

    // 2. Get all active bookings for these vehicles.
    const bookingsRef = db.collection('bookings');
    const bookingsQuery = bookingsRef
      .where('vehicleId', 'in', vehicleIds)
      .where('status', 'in', ['pending', 'confirmed', 'assigned', 'stb', 'pickup']);
      
    const bookingsSnapshot = await bookingsQuery.get();

    // 3. Create a schedule map: { vehicleId: [{ start: Date, end: Date }] }
    const bookingsMap = {};
    bookingsSnapshot.forEach(doc => {
      const booking = doc.data();
      if (!bookingsMap[booking.vehicleId]) {
        bookingsMap[booking.vehicleId] = [];
      }
      const startTime = booking.pickupInfo.dateTime.toDate();
      const endTime = new Date(startTime.getTime() + (booking.tripDetails.rentalHours * 60 * 60 * 1000));
      bookingsMap[booking.vehicleId].push({
        start: startTime.toISOString(), // Send as ISO strings
        end: endTime.toISOString(),
      });
    });

    // 4. Return both lists to the client
    return {
      vehicles: JSON.parse(JSON.stringify(vehicles)),
      bookings: bookingsMap,
    };

  } catch (error) {
    console.error("Error fetching vehicles with schedules:", error);
    return { error: "Failed to fetch vehicle data.", details: error.message };
  }
}