"use client";

import { useState, useEffect } from 'react';

const MOCK_PROFILE = {
    userId: 'U_TEST_1234567890ABCDEF',
    displayName: 'คุณทดสอบ',
    pictureUrl: 'https://lh5.googleusercontent.com/d/10mcLZP15XqebnVb1IaODQLhZ93EWT7h7'
};

const useLiff = (liffId) => {
    const [liffObject, setLiffObject] = useState(null);
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        const initializeLiff = async () => {
            if (process.env.NODE_ENV === 'development') {
                console.warn("LIFF mock mode is active.");
                setProfile(MOCK_PROFILE);
                setLoading(false);
                return;
            }

            if (!liffId) {
                setError("LIFF ID is not provided.");
                setLoading(false);
                return;
            }
            try {
                const liff = (await import('@line/liff')).default;
                await liff.init({ liffId });

                const params = new URLSearchParams(window.location.search);
                const redirectPath = params.get('liff.state');
                
                if (redirectPath) {
                    window.location.replace(redirectPath);
                    return; 
                }

                if (!liff.isLoggedIn()) {
                    liff.login();
                    return;
                }

                const userProfile = await liff.getProfile();
                setProfile(userProfile);
                setLiffObject(liff);

            } catch (err) {
                console.error("LIFF initialization failed", err);
                setError(err.toString());
            } finally {
                setLoading(false);
            }
        };

        initializeLiff();
    }, [liffId]);

    return { liffObject, profile, loading, error };
};

export default useLiff;