'use client';

import { useState, useRef, useMemo } from 'react';
import { useStore } from '@/store/useStore';
import { calculateSimilarity } from '@/lib/utils';
import { Mic, Volume2, ArrowRight, Square, Loader2, Play } from 'lucide-react';
import { clsx } from 'clsx';
import AudioVisualizer from './AudioVisualizer';
import DeviceSelector from './DeviceSelector';
import StruggleList, { StruggleItem } from './StruggleList';
import { WAVRecorder } from '@/lib/wavRecorder';
import { arePhoneticallySimila } from '@/lib/phoneticMatch';

export default function SpeechTrainer() {
    const { chunks, currentChunkIndex, nextChunk } = useStore();

    const currentChunkText = chunks[currentChunkIndex]?.en || "";
    const sentences = useMemo(() => {
        if (!currentChunkText) return [];
        return currentChunkText.match(/[^.!?]+[.!?]+/g) || [currentChunkText];
    }, [currentChunkText]);

    const [currentSentenceIndex, setCurrentSentenceIndex] = useState(0);
    const [isRecording, setIsRecording] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);

    const [cursor, setCursor] = useState(0);
    const [struggleItems, setStruggleItems] = useState<StruggleItem[]>([]);
    const [feedbackMsg, setFeedbackMsg] = useState("点击麦克风开始");
    const [status, setStatus] = useState<'IDLE' | 'RECORDING' | 'PROCESSING' | 'SUCCESS'>('IDLE');
    const [recognizedText, setRecognizedText] = useState("");

    const [mediaStream, setMediaStream] = useState<MediaStream | null>(null);
    const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
    const [recordedAudio, setRecordedAudio] = useState<Blob | null>(null);

    const wavRecorderRef = useRef<WAVRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const isRecordingRef = useRef(false);

    const targetWords = useMemo(() => {
        const s = sentences[currentSentenceIndex] || "";
        return s.replace(/[.,!?;:"()]/g, '').split(/\s+/).filter(w => w.length > 0);
    }, [sentences, currentSentenceIndex]);

    // ==================== 录音功能 ====================
    const startRecording = async () => {
        try {
            setCursor(0);
            setStruggleItems([]);
            setRecognizedText("");

            setStatus('RECORDING');
            setFeedbackMsg("Ready...");

            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    deviceId: selectedDeviceId ? { exact: selectedDeviceId } : undefined,
                    channelCount: 1,
                    sampleRate: 16000
                }
            });
            setMediaStream(stream);

            // 使用WAV录音器
            const recorder = new WAVRecorder();

            // 设置静音回调 (4秒无声自动停止)
            recorder.onSilence = () => {
                console.log("检测到静音，自动停止录音");
                stopRecording();
            };

            // 更新UI显示倒计时
            recorder.onVADStateChange = (rms, isSpeech, silenceDuration) => {
                // 使用Ref来检查录音状态，避免闭包问题
                if (!isRecordingRef.current) return;

                // 仅在Go之后更新文本
                if (silenceDuration > 500) {
                    const remaining = Math.ceil((4000 - silenceDuration) / 1000);
                    if (remaining > 0 && remaining < 4) {
                        setFeedbackMsg(`静音检测: ${remaining}秒后停止...`);
                    } else if (remaining <= 0) {
                        setFeedbackMsg("正在停止...");
                    } else {
                        // 正常录音中
                        setFeedbackMsg(isSpeech ? "正在录音... (检测到人声)" : "正在录音...");
                    }
                } else {
                    setFeedbackMsg(isSpeech ? "正在录音... (检测到人声)" : "正在录音...");
                }
            };

            await recorder.start(stream);
            wavRecorderRef.current = recorder;

            // 等待录音器完全就绪（1.5秒）
            setTimeout(() => {
                setIsRecording(true);
                isRecordingRef.current = true; // 更新Ref
                setFeedbackMsg("Go! 正在录音...");
            }, 1500);
        } catch (e) {
            console.error(e);
            setFeedbackMsg("麦克风错误");
            setIsRecording(false);
            isRecordingRef.current = false;
        }
    };

    const stopRecording = () => {
        if (wavRecorderRef.current && isRecordingRef.current) {
            const wavBlob = wavRecorderRef.current.stop();
            setIsRecording(false);
            isRecordingRef.current = false; // 更新Ref
            mediaStream?.getTracks().forEach(t => t.stop());
            setMediaStream(null);

            // 保存录音以供回放
            setRecordedAudio(wavBlob);

            // 处理WAV文件
            processRecording(wavBlob);
        }
    };

    // ==================== 处理录音并发送到后端 ====================
    const processRecording = async (audioBlob: Blob) => {
        setIsProcessing(true);
        setStatus('PROCESSING');
        setFeedbackMsg("识别中...");

        try {

            // 发送到后端API
            const formData = new FormData();
            formData.append('audio', audioBlob);
            formData.append('targetText', sentences[currentSentenceIndex]);

            const response = await fetch('/api/speech/recognize', {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                throw new Error('识别失败');
            }

            const result = await response.json();

            // 处理识别结果
            handleRecognitionResult(result.text, result.confidence);
        } catch (error: any) {
            console.error('Recognition error:', error);
            setFeedbackMsg(`错误: ${error.message}`);
            setStatus('IDLE');
        } finally {
            setIsProcessing(false);
        }
    };

    // ==================== 处理识别结果 ====================
    const handleRecognitionResult = (recognizedText: string, confidence: number) => {
        setRecognizedText(recognizedText);

        const spokenWords = recognizedText.toLowerCase().split(/\s+/).filter(w => w.length > 0);
        const newStruggles: StruggleItem[] = [];

        let spokenIndex = 0; // 识别结果中的当前位置

        // 对每个目标单词，在识别结果中查找匹配
        for (let i = 0; i < targetWords.length; i++) {
            const targetWord = targetWords[i].toLowerCase();

            // 处理连字符：decade-old -> ["decade", "old"]
            const targetParts = targetWord.split('-').filter((p: string) => p.length > 0);
            const targetClean = targetWord.replace(/[^a-z0-9]/g, '');

            let matched = false;

            // 尝试匹配整个单词
            // 限制查找范围，避免跳跃太远匹配到后面的词
            const searchWindow = Math.min(spokenIndex + 6, spokenWords.length);

            for (let j = spokenIndex; j < searchWindow; j++) {
                const spokenWord = spokenWords[j].replace(/[^a-z0-9]/g, '');

                // 特殊处理 "a"
                if (targetClean === 'a') {
                    // "a" 可以匹配以下任何发音/拼写 (包括错误识别)
                    const aVariants = ['a', 'an', 'uh', 'ah', 'eh', 'ei', 'ey', 'eight', 'o', 'oh', 'one'];

                    // 1. 直匹配变体
                    if (aVariants.includes(spokenWord)) {
                        matched = true;
                        spokenIndex = j + 1;
                        console.log(`Matched 'a' with '${spokenWord}' at index ${j}`);
                        break;
                    }

                    // 2. 前瞻救因 (Lookahead Rescue): 
                    // 如果当前词匹配失败，但下一个词匹配成功，则假设当前词就是 "a" (或者 "a" 被合并/跳过)
                    if (i < targetWords.length - 1 && j < spokenWords.length - 1) {
                        const nextTarget = targetWords[i + 1].toLowerCase().replace(/[^a-z0-9]/g, '');
                        const nextSpoken = spokenWords[j + 1].replace(/[^a-z0-9]/g, '');

                        // 如果下一个目标词 == 下一个识别词
                        if (arePhoneticallySimila(nextTarget, nextSpoken, 0.7)) {
                            console.log(`Rescue 'a': forced match with '${spokenWord}' because next word '${nextTarget}' matches '${nextSpoken}'`);
                            matched = true;
                            spokenIndex = j + 1; // 消耗当前这个奇怪的词作为 "a"
                            break;
                        }
                    }
                }

                // 常规音素匹配
                if (arePhoneticallySimila(targetClean, spokenWord, 0.7)) {
                    matched = true;
                    spokenIndex = j + 1;
                    break;
                }

                // 宽松的部分匹配 (针对长词)
                if (targetClean.length >= 4 && spokenWord.length >= 4) {
                    if (targetClean.includes(spokenWord) || spokenWord.includes(targetClean)) {
                        matched = true;
                        spokenIndex = j + 1;
                        break;
                    }
                }
            }

            // 如果整词没匹配上，尝试匹配连字符拆分的部分
            if (!matched && targetParts.length > 1) {
                let allPartsMatched = true;
                let tempIndex = spokenIndex;

                for (const part of targetParts) {
                    let partMatched = false;
                    for (let j = tempIndex; j < Math.min(tempIndex + 3, spokenWords.length); j++) {
                        const spokenWord = spokenWords[j].replace(/[^a-z0-9]/g, '');
                        if (arePhoneticallySimila(part, spokenWord, 0.65)) {
                            partMatched = true;
                            tempIndex = j + 1;
                            break;
                        }
                    }
                    if (!partMatched) {
                        allPartsMatched = false;
                        break;
                    }
                }

                if (allPartsMatched) {
                    matched = true;
                    spokenIndex = tempIndex;
                }
            }

            if (!matched) {
                newStruggles.push({ word: targetWord, type: 'wrong', timestamp: Date.now() });
            }
        }

        setCursor(targetWords.length);
        setStruggleItems(newStruggles);

        if (newStruggles.length === 0) {
            handleSuccess();
        } else {
            setStatus('IDLE');
            setFeedbackMsg(`发现 ${newStruggles.length} 个错误`);
        }
    };

    const handleSuccess = () => {
        setStatus('SUCCESS');
        setFeedbackMsg("太棒了！点击→进入下一句");
        const u = new SpeechSynthesisUtterance("Great job!");
        u.lang = 'en-US';
        window.speechSynthesis.speak(u);
        // 不自动跳转，由用户点击→按钮
    };

    // ==================== 控制函数 ====================
    const advanceSentence = () => {
        if (currentSentenceIndex < sentences.length - 1) {
            setCurrentSentenceIndex(p => p + 1);
            setStatus('IDLE');
            setRecognizedText("");
            setCursor(0);
            setStruggleItems([]);
            setFeedbackMsg("点击麦克风读下一句");
        } else {
            nextChunk();
        }
    };

    const playOriginal = () => {
        const u = new SpeechSynthesisUtterance(sentences[currentSentenceIndex]);
        u.lang = 'en-US';
        window.speechSynthesis.speak(u);
    };

    // 播放单词发音 (支持重复播放)
    // repeatCount: 1 (默认，用于绿色/普通单词) | 3 (用于红色错误单词)
    const playWord = (word: string, repeatCount: number = 1) => {
        console.log(`Playing word: '${word}', repeat: ${repeatCount}`);

        // 停止当前所有语音
        window.speechSynthesis.cancel();

        // 确保语音库已加载
        const voices = window.speechSynthesis.getVoices();
        if (voices.length === 0) {
            window.speechSynthesis.addEventListener('voiceschanged', () => {
                playWord(word, repeatCount);
            }, { once: true });
            return;
        }

        const speakOnce = (count: number) => {
            if (count <= 0) return;

            const u = new SpeechSynthesisUtterance(word);
            u.lang = 'en-US';
            u.rate = 0.8; // 稍微慢一点，方便模仿
            u.volume = 1.0;

            const enVoice = voices.find(v => v.lang.startsWith('en'));
            if (enVoice) u.voice = enVoice;

            u.onend = () => {
                if (count > 1) {
                    // 间隔 500ms 再次播放
                    setTimeout(() => speakOnce(count - 1), 500);
                }
            };

            u.onerror = (e) => console.error('Speech error:', e);

            window.speechSynthesis.speak(u);
        };

        // 短暂延迟后开始播放
        setTimeout(() => speakOnce(repeatCount), 100);
    };

    const playRecording = () => {
        if (recordedAudio) {
            const audioUrl = URL.createObjectURL(recordedAudio);
            const audio = new Audio(audioUrl);
            audio.play();
            audio.onended = () => URL.revokeObjectURL(audioUrl);
        }
    };

    // ==================== 渲染 ====================
    if (!chunks.length) return <div>没有文本</div>;

    const renderedText = targetWords.map((word, idx) => {
        let color = 'black';
        let bg = 'transparent';
        let icon = '';

        // 检查是否是错误单词
        const isWrong = struggleItems.some(item =>
            item.word.toLowerCase() === word.toLowerCase()
        );

        if (idx < cursor) {
            if (isWrong) {
                color = '#dc2626'; // 红色（错误）
                icon = ' ✗';
            } else {
                color = '#16a34a'; // 绿色（正确）
                icon = ' ✓';
            }
        } else if (idx === cursor) {
            color = '#1f2937';
            bg = '#dbeafe'; // 蓝色高亮（当前）
        } else {
            color = '#9ca3af'; // 灰色（未读）
        }

        return (
            <span
                key={idx}
                onClick={() => playWord(word, isWrong ? 3 : 1)}
                style={{
                    color,
                    backgroundColor: bg,
                    padding: '2px 6px',
                    margin: '0 2px',
                    borderRadius: 4,
                    transition: 'all 0.2s',
                    display: 'inline-block',
                    fontWeight: isWrong ? 600 : 500,
                    cursor: 'pointer',
                    userSelect: 'none'
                }}
                title="点击发音"
            >
                {word}{icon}
            </span>
        );
    });

    return (
        <div style={{ maxWidth: '900px', margin: '0 auto', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '2rem', padding: '1rem' }}>
            <div style={{ color: '#888', fontSize: '0.875rem' }}>
                句子 {currentSentenceIndex + 1} / {sentences.length}
            </div>

            <div style={{
                padding: '2rem 1.5rem',
                border: isRecording ? '2px solid #ef4444' : isProcessing ? '2px solid #fbbf24' : '1px solid #e5e7eb',
                borderRadius: '12px',
                backgroundColor: 'white',
                fontSize: '1.5rem',
                fontWeight: 500,
                lineHeight: 1.8,
                display: 'flex',
                flexWrap: 'wrap',
                gap: '0.25rem',
                justifyContent: 'center',
                boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
            }}>
                {renderedText}
            </div>

            {recognizedText && (
                <div style={{
                    padding: '1rem',
                    backgroundColor: '#f3f4f6',
                    borderRadius: '8px',
                    fontSize: '1rem',
                    color: '#4b5563'
                }}>
                    <strong>识别结果：</strong>{recognizedText}
                </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.25rem' }}>
                {!isRecording && !isProcessing && <DeviceSelector onDeviceSelect={setSelectedDeviceId} />}
                {isRecording && mediaStream && <AudioVisualizer stream={mediaStream} />}

                <div style={{
                    fontWeight: 600,
                    color: status === 'SUCCESS' ? '#16a34a' : status === 'RECORDING' ? '#ef4444' : '#2563eb',
                    fontSize: (feedbackMsg.includes('Ready') || feedbackMsg.includes('Go!')) ? '2.5rem' : '1rem',
                    transition: 'font-size 0.3s'
                }}>
                    {feedbackMsg}
                </div>

                <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
                    <button
                        onClick={playOriginal}
                        disabled={isRecording || isProcessing}
                        style={{
                            width: 48, height: 48,
                            borderRadius: '50%',
                            border: '2px solid #e5e7eb',
                            backgroundColor: 'white',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: isRecording || isProcessing ? 'not-allowed' : 'pointer',
                            opacity: isRecording || isProcessing ? 0.5 : 1,
                            transition: 'all 0.2s'
                        }}
                        title="听原句"
                    >
                        <Volume2 size={20} />
                    </button>

                    {recordedAudio && (
                        <button
                            onClick={playRecording}
                            disabled={isRecording || isProcessing}
                            style={{
                                width: 48, height: 48,
                                borderRadius: '50%',
                                border: '2px solid #10b981',
                                backgroundColor: 'white',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: isRecording || isProcessing ? 'not-allowed' : 'pointer',
                                opacity: isRecording || isProcessing ? 0.5 : 1,
                                transition: 'all 0.2s',
                                color: '#10b981'
                            }}
                            title="听我的录音"
                        >
                            <Play size={20} />
                        </button>
                    )}

                    <button
                        onClick={isRecording ? stopRecording : startRecording}
                        disabled={isProcessing}
                        className={clsx(isRecording && "animate-pulse")}
                        style={{
                            width: 72, height: 72,
                            borderRadius: '50%',
                            background: isRecording ? '#ef4444' : isProcessing ? '#fbbf24' : '#3b82f6',
                            color: 'white',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: isProcessing ? 'wait' : 'pointer',
                            boxShadow: '0 6px 20px rgba(59,130,246,0.4)',
                            border: 'none',
                            transition: 'all 0.2s',
                            opacity: isProcessing ? 0.7 : 1
                        }}
                    >
                        {isProcessing ? <Loader2 size={32} className="animate-spin" /> : isRecording ? <Square size={28} fill="currentColor" /> : <Mic size={32} />}
                    </button>

                    <button
                        onClick={advanceSentence}
                        disabled={isRecording || isProcessing}
                        style={{
                            width: 48, height: 48,
                            borderRadius: '50%',
                            border: '2px solid #e5e7eb',
                            backgroundColor: 'white',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: isRecording || isProcessing ? 'not-allowed' : 'pointer',
                            opacity: isRecording || isProcessing ? 0.5 : 1,
                            transition: 'all 0.2s'
                        }}
                        title="下一句"
                    >
                        <ArrowRight size={20} />
                    </button>
                </div>
            </div>
        </div>
    );
}
