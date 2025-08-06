'use server';

import { db } from '@/app/lib/firebase';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';

export async function fetchPickupLocations() {
    try {
        const locationsQuery = query(collection(db, 'pickup_locations'), orderBy('category'), orderBy('name'));
        const querySnapshot = await getDocs(locationsQuery);
        const locationsData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        return locationsData;
    } catch (err) {
        console.error("Error fetching locations in Server Action:", err);
        // It's better to throw the error or return a specific error object
        // so the calling code can handle it.
        throw new Error("Failed to fetch pickup locations.");
    }
}