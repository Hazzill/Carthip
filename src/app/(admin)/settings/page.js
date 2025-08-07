"use client";

import { useState, useEffect } from 'react';
import { db } from '@/app/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { saveNotificationSettings } from '@/app/actions/settingsActions';
import { fetchAllAdmins } from '@/app/actions/adminActions';
import { sendDailyReportNow } from '@/app/actions/reportActions'; 

const SettingsCard = ({ title, children }) => (
    <div className="bg-white p-6 rounded-lg shadow-md">
        <h2 className="text-xl font-semibold text-gray-800 mb-4 border-b pb-3">{title}</h2>
        <div className="space-y-4">{children}</div>
    </div>
);

const TimeInput = ({ label, value, onChange, name }) => (
    <div>
        <label htmlFor={name} className="block text-sm font-medium text-gray-700">{label}</label>
        <input
            type="time"
            id={name}
            name={name}
            value={value}
            onChange={onChange}
            className="mt-1 w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
        />
    </div>
);

export default function AdminSettingsPage() {
    const [settings, setSettings] =  useState({
        reportSendTime: '08:00',
        reportRecipients: [],
    });
    const [allAdmins, setAllAdmins] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isSending, setIsSending] = useState(false); 
    const [message, setMessage] = useState('');

    useEffect(() => {
        const fetchInitialData = async () => {
            setLoading(true);
            try {
                const settingsRef = doc(db, 'settings', 'notifications');
                const docSnap = await getDoc(settingsRef);
                if (docSnap.exists()) {
                    setSettings(prev => ({ ...prev, ...docSnap.data() }));
                }

                const adminResult = await fetchAllAdmins();
                if (adminResult.success) {
                    setAllAdmins(adminResult.admins);
                } else {
                    throw new Error(adminResult.error);
                }

            } catch (error) {
                console.error("Error fetching initial data:", error);
                setMessage('เกิดข้อผิดพลาดในการโหลดข้อมูล');
            } finally {
                setLoading(false);
            }
        };
        fetchInitialData();
    }, []);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setSettings(prev => ({ ...prev, [name]: value }));
    };
    
    const handleRecipientChange = (e) => {
        const { value, checked } = e.target;
        setSettings(prev => {
            const recipients = prev.reportRecipients || [];
            if (checked) {
                return { ...prev, reportRecipients: [...recipients, value] };
            } else {
                return { ...prev, reportRecipients: recipients.filter(id => id !== value) };
            }
        });
    };

    const handleSave = async () => {
        setIsSaving(true);
        setMessage('');

        const settingsToSave = {
            reportSendTime: settings.reportSendTime,
            reportRecipients: settings.reportRecipients || [],
        };

        try {
            const result = await saveNotificationSettings(settingsToSave);
            if (result.success) {
                setMessage('บันทึกการตั้งค่าสำเร็จ!');
            } else {
                throw new Error(result.error);
            }
        } catch (error) {
            setMessage(`เกิดข้อผิดพลาด: ${error.message}`);
        } finally {
            setIsSaving(false);
            setTimeout(() => setMessage(''), 3000);
        }
    };
    
    const handleSendNow = async () => {
        setIsSending(true);
        setMessage('');
        try {
            const result = await sendDailyReportNow();
            if (result.success) {
                setMessage(result.message || 'ส่ง Report สำเร็จ!');
            } else {
                throw new Error(result.error);
            }
        } catch (error) {
             setMessage(`เกิดข้อผิดพลาด: ${error.message}`);
        } finally {
            setIsSending(false);
            setTimeout(() => setMessage(''), 5000);
        }
    };

    if (loading) {
        return <div className="text-center p-10">กำลังโหลดการตั้งค่า...</div>;
    }

    return (
        <div className="container mx-auto p-4 md:p-8">
            <h1 className="text-3xl font-bold text-slate-800 mb-6">ตั้งค่าระบบ</h1>
            <div className="max-w-2xl mx-auto space-y-6">
                <SettingsCard title="ตั้งค่า Report สรุปรายวัน">
                    <TimeInput
                        label="เวลาส่ง Report ประจำวัน (เวลาประเทศไทย)"
                        name="reportSendTime"
                        value={settings.reportSendTime}
                        onChange={handleChange}
                    />
                    <div>
                        <label className="block text-sm font-medium text-gray-700">เลือกผู้รับ Report</label>
                        <div className="mt-2 space-y-2 border p-4 rounded-md max-h-48 overflow-y-auto">
                            {allAdmins.map(admin => (
                                <div key={admin.id} className="flex items-center">
                                    <input
                                        id={`admin-${admin.id}`}
                                        name="reportRecipients"
                                        type="checkbox"
                                        value={admin.id}
                                        checked={(settings.reportRecipients || []).includes(admin.id)}
                                        onChange={handleRecipientChange}
                                        className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                                    />
                                    <label htmlFor={`admin-${admin.id}`} className="ml-3 text-sm text-gray-900">
                                        {admin.firstName} {admin.lastName}
                                    </label>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="border-t pt-4">
                        <button
                            onClick={handleSendNow}
                            disabled={isSending}
                            className="w-full bg-green-600 text-white px-6 py-2 rounded-lg font-semibold shadow hover:bg-green-700 disabled:bg-gray-400"
                        >
                            {isSending ? 'กำลังส่ง Report...' : 'ส่ง Report สรุปของวันนี้ทันที'}
                        </button>
                    </div>
                </SettingsCard>

                <div className="flex justify-end items-center">
                    {message && <p className="text-sm text-gray-600 mr-4">{message}</p>}
                    <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="bg-indigo-600 text-white px-6 py-2 rounded-lg font-semibold shadow hover:bg-indigo-700 disabled:bg-gray-400"
                    >
                        {isSaving ? 'กำลังบันทึก...' : 'บันทึกการเปลี่ยนแปลง'}
                    </button>
                </div>
            </div>
        </div>
    );
}
