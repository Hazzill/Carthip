"use client";

import React from 'react';

// --- Notification Component ---
export const Notification = ({ show, title, message, type }) => {
    if (!show) return null;
    const icons = {
        success: (
            <svg className="w-6 h-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            </svg>
        ),
        error: (
            <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            </svg>
        ),
    };
    const colors = {
        success: 'bg-green-50 border-green-200 text-green-800',
        error: 'bg-red-50 border-red-200 text-red-800',
    };
    return (
        <div className={`fixed top-5 left-1/2 -translate-x-1/2 w-11/12 max-w-md p-4 rounded-lg border shadow-lg z-50 ${colors[type]}`}>
            <div className="flex items-start">
                <div className="flex-shrink-0">{icons[type]}</div>
                <div className="ml-3">
                    <h3 className="text-sm font-bold">{title}</h3>
                    {message && <div className="mt-1 text-sm">{message}</div>}
                </div>
            </div>
        </div>
    );
};

// --- Confirmation Modal ---
export const ConfirmationModal = ({ show, title, message, onConfirm, onCancel, isProcessing }) => {
    if (!show) return null;
    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50 p-4">
            <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-sm">
                <h2 className="text-lg font-bold mb-2">{title}</h2>
                <p className="text-sm text-gray-600 mb-6">{message}</p>
                <div className="flex justify-end space-x-3">
                    <button onClick={onCancel} className="px-4 py-2 bg-gray-200 rounded-md font-semibold">ยกเลิก</button>
                    <button onClick={onConfirm} disabled={isProcessing} className="px-4 py-2 bg-red-600 text-white rounded-md font-semibold disabled:bg-gray-400">
                        {isProcessing ? 'กำลังดำเนินการ...' : 'ยืนยัน'}
                    </button>
                </div>
            </div>
        </div>
    );
};