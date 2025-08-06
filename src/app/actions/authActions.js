"use client";

import { auth, db } from '@/app/lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';

export async function registerStaffUser(formData) {
  const { email, password, firstName, lastName, phone, lineUserId, role } = formData;

  try {
    // สร้าง user ด้วย client SDK
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(userCredential.user, {
      displayName: `${firstName} ${lastName}`,
    });

    const targetCollection = role === 'driver' ? 'drivers' : 'admins';
    const dataToSave = {
      uid: userCredential.user.uid,
      firstName: firstName,
      lastName: lastName,
      phoneNumber: phone,
      email: email,
      lineUserId: lineUserId,
      status: 'available',
      createdAt: serverTimestamp(),
    };

    if (role === 'admin') {
      dataToSave.role = 'admin';
    }

    await addDoc(collection(db, targetCollection), dataToSave);

    return { success: true };
  } catch (error) {
    console.error("Error creating new user:", error);
    let errorMessage = "เกิดข้อผิดพลาดในการลงทะเบียน";
    if (error.code === 'auth/email-already-in-use') {
      errorMessage = "อีเมลนี้ถูกใช้งานแล้ว";
    } else if (error.code === 'auth/weak-password') {
      errorMessage = "รหัสผ่านไม่ถูกต้อง ต้องมีอย่างน้อย 6 ตัวอักษร";
    }
    return { success: false, error: errorMessage };
  }
}