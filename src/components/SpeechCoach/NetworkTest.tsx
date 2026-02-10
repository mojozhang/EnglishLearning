'use client';

import { useState } from 'react';
import { Wifi } from 'lucide-react';

/**
 * 测试网络连接和VPN是否能访问Google服务
 */
export default function NetworkTest() {
    const [googleStatus, setGoogleStatus] = useState<'idle' | 'testing' | 'success' | 'failed'>('idle');
    const [speechStatus, setSpeechStatus] = useState<'idle' | 'testing' | 'success' | 'failed'>('idle');

    const testGoogle = async () => {
        setGoogleStatus('testing');
        try {
            const response = await fetch('https://www.google.com', { mode: 'no-cors' });
            // no-cors mode always returns opaque response, so we assume success if no error
            setGoogleStatus('success');
        } catch (e) {
            setGoogleStatus('failed');
        }
    };

    const testSpeechAPI = () => {
        setSpeechStatus('testing');

        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (!SpeechRecognition) {
            setSpeechStatus('failed');
            return;
        }

        const recognition = new SpeechRecognition();
        recognition.lang = 'en-US';

        let gotResult = false;

        // 15秒超时
        const timeout = setTimeout(() => {
            if (!gotResult) {
                setSpeechStatus('failed');
                recognition.stop();
            }
        }, 15000);

        recognition.onresult = () => {
            gotResult = true;
            clearTimeout(timeout);
            setSpeechStatus('success');
            recognition.stop();
        };

        recognition.onerror = (event: any) => {
            clearTimeout(timeout);
            if (event.error !== 'no-speech') {
                setSpeechStatus('failed');
            }
        };

        recognition.start();
    };

    return (
        <div style={{
            position: 'fixed',
            top: 20,
            right: 20,
            padding: '1rem',
            backgroundColor: '#1f2937',
            color: 'white',
            borderRadius: 8,
            minWidth: 280,
            zIndex: 9999
        }}>
            <h3 style={{ margin: 0, marginBottom: '1rem', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Wifi size={16} />
                网络诊断工具
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {/* Google连通性测试 */}
                <div>
                    <button
                        onClick={testGoogle}
                        disabled={googleStatus === 'testing'}
                        style={{
                            width: '100%',
                            padding: '0.5rem',
                            backgroundColor: '#4b5563',
                            color: 'white',
                            border: 'none',
                            borderRadius: 4,
                            cursor: googleStatus === 'testing' ? 'wait' : 'pointer',
                            fontSize: '0.875rem'
                        }}
                    >
                        测试Google连通性
                    </button>
                    {googleStatus !== 'idle' && (
                        <div style={{
                            marginTop: '0.5rem',
                            padding: '0.5rem',
                            backgroundColor: googleStatus === 'success' ? '#10b981' : googleStatus === 'failed' ? '#ef4444' : '#fbbf24',
                            borderRadius: 4,
                            fontSize: '0.75rem'
                        }}>
                            {googleStatus === 'testing' && '测试中...'}
                            {googleStatus === 'success' && '✅ Google可访问 (VPN有效)'}
                            {googleStatus === 'failed' && '❌ Google无法访问'}
                        </div>
                    )}
                </div>

                {/* Speech API测试 */}
                <div>
                    <button
                        onClick={testSpeechAPI}
                        disabled={speechStatus === 'testing'}
                        style={{
                            width: '100%',
                            padding: '0.5rem',
                            backgroundColor: '#4b5563',
                            color: 'white',
                            border: 'none',
                            borderRadius: 4,
                            cursor: speechStatus === 'testing' ? 'wait' : 'pointer',
                            fontSize: '0.875rem'
                        }}
                    >
                        测试Speech API
                    </button>
                    {speechStatus !== 'idle' && (
                        <div style={{
                            marginTop: '0.5rem',
                            padding: '0.5rem',
                            backgroundColor: speechStatus === 'success' ? '#10b981' : speechStatus === 'failed' ? '#ef4444' : '#fbbf24',
                            borderRadius: 4,
                            fontSize: '0.75rem'
                        }}>
                            {speechStatus === 'testing' && '测试中...请对麦克风说话'}
                            {speechStatus === 'success' && '✅ Speech API工作正常'}
                            {speechStatus === 'failed' && '❌ Speech API无法识别'}
                        </div>
                    )}
                </div>
            </div>

            <div style={{
                marginTop: '1rem',
                fontSize: '0.7rem',
                color: '#9ca3af',
                lineHeight: 1.4
            }}>
                <strong>说明：</strong><br />
                1. 先测试Google连通性<br />
                2. 如果失败，说明VPN未生效<br />
                3. 再测试Speech API（点击后立刻说话）
            </div>
        </div>
    );
}
