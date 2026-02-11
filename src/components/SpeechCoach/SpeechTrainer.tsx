"use client";

import { useState, useRef, useMemo, useEffect } from "react";
import { useStore } from "@/store/useStore";
import { calculateSimilarity } from "@/lib/utils";
import { Mic, Volume2, ArrowRight, Square, Loader2, Play } from "lucide-react";
import { clsx } from "clsx";
import AudioVisualizer from "./AudioVisualizer";
import DeviceSelector from "./DeviceSelector";
import StruggleList, { StruggleItem } from "./StruggleList";
import { WAVRecorder } from "@/lib/wavRecorder";
import { arePhoneticallySimila } from "@/lib/phoneticMatch";

export default function SpeechTrainer() {
  const {
    chunks,
    currentChunkIndex,
    currentSentenceIndex,
    setCurrentSentenceIndex,
    nextChunk,
  } = useStore();

  const currentChunkText = chunks[currentChunkIndex]?.en || "";
  const sentences = useMemo(() => {
    if (!currentChunkText) return [];
    return currentChunkText.match(/[^.!?]+[.!?]+/g) || [currentChunkText];
  }, [currentChunkText]);

  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const [cursor, setCursor] = useState(0);
  const [struggleItems, setStruggleItems] = useState<StruggleItem[]>([]);
  const [feedbackMsg, setFeedbackMsg] = useState("点击麦克风开始");
  const [status, setStatus] = useState<
    "IDLE" | "RECORDING" | "PROCESSING" | "SUCCESS"
  >("IDLE");
  const [recognizedText, setRecognizedText] = useState("");

  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>("");
  const [recordedAudio, setRecordedAudio] = useState<Blob | null>(null);

  const wavRecorderRef = useRef<WAVRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const isRecordingRef = useRef(false);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  const targetWords = useMemo(() => {
    const s = sentences[currentSentenceIndex] || "";
    // Replace punctuation including em-dash and en-dash
    return s
      .replace(/[.,!?;:"()]/g, " ")
      .replace(/[-—–]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 0);
  }, [sentences, currentSentenceIndex]);

  const [isPlayingOriginal, setIsPlayingOriginal] = useState(false);
  const [isPlayingRecording, setIsPlayingRecording] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1.0); // 0.8 or 1.0
  const [sentenceTranslation, setSentenceTranslation] = useState("");
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Fetch translation for current sentence
  useEffect(() => {
    const sentence = sentences[currentSentenceIndex];
    if (!sentence) return;

    setSentenceTranslation("翻译中...");
    fetch("/api/translate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: sentence }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.translation) {
          setSentenceTranslation(data.translation);
        }
      })
      .catch((err) => {
        console.error(err);
        setSentenceTranslation("翻译失败");
      });
  }, [currentSentenceIndex, sentences]);

  // ==================== 录音功能 ====================
  const startRecording = async () => {
    try {
      // Stop any playing audio
      stopPlayingOriginal();
      stopPlayingRecording();

      setCursor(0);
      setStruggleItems([]);
      setRecognizedText("");

      setStatus("RECORDING");
      setFeedbackMsg("准备...");

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          deviceId: selectedDeviceId ? { exact: selectedDeviceId } : undefined,
          channelCount: 1,
          sampleRate: 16000,
        },
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
            setFeedbackMsg(
              isSpeech ? "正在录音... (检测到人声)" : "正在录音...",
            );
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
      mediaStream?.getTracks().forEach((t) => t.stop());
      setMediaStream(null);

      // 保存录音以供回放
      setRecordedAudio(wavBlob);

      // 处理WAV文件
      processRecording(wavBlob);
    }
  };

  // ==================== 处理录音并发送到后端 ====================
  const processRecording = async (audioBlob: Blob) => {
    // Check if audio is too short/empty (e.g., < 1KB)
    if (audioBlob.size < 1024) {
      setStatus("IDLE");
      setFeedbackMsg("录音太短，请重试");
      return;
    }

    setIsProcessing(true);
    setStatus("PROCESSING");
    setFeedbackMsg("识别中...");

    // Check if target sentence exists
    const targetSentence = sentences[currentSentenceIndex];
    if (!targetSentence) {
      console.error(
        "No target sentence found for index:",
        currentSentenceIndex,
      );
      setFeedbackMsg("错误：无法获取当前句子");
      setStatus("IDLE");
      return;
    }

    try {
      // 发送到后端API (SiliconFlow)
      const formData = new FormData();
      formData.append("audio", audioBlob);

      // SiliconFlow doesn't strictly need target text for standard Whisper,
      // but we keep it in case we advanced prompting later.
      // The backend mostly just needs the audio.

      const response = await fetch("/api/speech/siliconflow", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "识别失败");
      }

      const result = await response.json();

      // 处理识别结果
      if (!result.text || result.text.trim() === "") {
        setFeedbackMsg("未检测到语音，请大声一点");
        setStatus("IDLE");
      } else {
        // Use a high confidence placeholder since Whisper doesn't always return confidence per word/sentence easily
        handleRecognitionResult(result.text, 0.95);
      }
    } catch (error: any) {
      console.error("Recognition error:", error);
      setFeedbackMsg(`识别失败: ${error.message}`);
      setStatus("IDLE");
    } finally {
      setIsProcessing(false);
    }
  };

  // ==================== 处理识别结果 ====================
  const handleRecognitionResult = (
    recognizedText: string,
    confidence: number,
  ) => {
    setRecognizedText(recognizedText);

    const normalize = (w: string) => w.replace(/[^a-z0-9]/g, "");
    // 增加对常见 AS R 错误的容忍
    const fillerWords = [
      "um",
      "uh",
      "ah",
      "hmm",
      "er",
      "like",
      "so",
      "you know",
    ];

    const spokenWordsRaw = recognizedText
      .toLowerCase()
      .replace(/[.,!?;:"()]/g, " ")
      .replace(/-/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 0);

    const spokenWords = spokenWordsRaw.filter(
      (w) => !fillerWords.includes(normalize(w)),
    );

    const n = targetWords.length;
    const m = spokenWords.length;

    // DP Matrix
    const dp: number[][] = Array(n + 1)
      .fill(0)
      .map(() => Array(m + 1).fill(0));
    // Direction Matrix: 0=diag, 1=up(skip target), 2=left(skip spoken)
    const ptr: number[][] = Array(n + 1)
      .fill(0)
      .map(() => Array(m + 1).fill(0));

    // Initialization
    for (let i = 0; i <= n; i++) dp[i][0] = i * -5;
    for (let j = 0; j <= m; j++) dp[0][j] = j * -2; // Lower penalty for extra spoken words

    // 1. Fill DP Table
    for (let i = 1; i <= n; i++) {
      for (let j = 1; j <= m; j++) {
        const tWord = targetWords[i - 1];
        const sWord = spokenWords[j - 1]; // Spoken is already lowercase

        const tClean = normalize(tWord.toLowerCase());
        const sClean = normalize(sWord);

        const isProperNoun = /^[A-Z]/.test(tWord);
        const lenDiff = Math.abs(tClean.length - sClean.length);
        const firstLetterMatch = tClean[0] === sClean[0];

        let matchScore = -5; // Default mismatch

        // --- Match Scoring Logic ---
        if (tClean === sClean) {
          matchScore = 15; // Exact match
        } else if (
          tClean === "a" &&
          ["a", "an", "one", "ei", "uh", "ah"].includes(sClean)
        ) {
          matchScore = 12; // 'a' variants
        } else if (isProperNoun && firstLetterMatch && lenDiff <= 2) {
          matchScore = 8; // Proper Noun Heuristic (Muggle -> Marel)
        } else if (
          arePhoneticallySimila(tClean, sClean, isProperNoun ? 0.45 : 0.6)
        ) {
          matchScore = 8; // Phonetic match
        } else if (tClean.startsWith(sClean) && sClean.length >= 3) {
          matchScore = 5; // Start match
        } else if (sClean.startsWith(tClean) && tClean.length >= 3) {
          matchScore = 5;
        }

        const scoreDiag = dp[i - 1][j - 1] + matchScore;
        const scoreDeleteTarget = dp[i - 1][j] - 5;
        const scoreInsertSpoken = dp[i][j - 1] - 2;

        dp[i][j] = Math.max(scoreDiag, scoreDeleteTarget, scoreInsertSpoken);

        if (dp[i][j] === scoreDiag) ptr[i][j] = 0;
        else if (dp[i][j] === scoreDeleteTarget) ptr[i][j] = 1;
        else ptr[i][j] = 2;
      }
    }

    // 2. Backtrack and Validation
    const newStruggles: StruggleItem[] = [];
    let i = n;
    let j = m;
    const matchedIndices = new Set<number>();

    while (i > 0 || j > 0) {
      if (i > 0 && j > 0 && ptr[i][j] === 0) {
        // Diagonal: The algorithm aligned these two.
        // We MUST validate if they are "good enough" to be marked green.

        const tWord = targetWords[i - 1];
        const sWord = spokenWords[j - 1];
        const tClean = normalize(tWord.toLowerCase());
        const sClean = normalize(sWord);

        const isProperNoun = /^[A-Z]/.test(tWord);
        const lenDiff = Math.abs(tClean.length - sClean.length);
        const firstLetterMatch = tClean[0] === sClean[0];

        let isGoodMatch = false;

        // --- Validation Logic (MUST SYNC WITH SCORING) ---
        if (tClean === sClean) isGoodMatch = true;
        else if (
          tClean === "a" &&
          ["a", "an", "uh", "ah", "one", "er", "ei"].includes(sClean)
        )
          isGoodMatch = true;
        else if (isProperNoun && firstLetterMatch && lenDiff <= 2)
          isGoodMatch = true; // Proper Noun Heuristic
        else if (
          arePhoneticallySimila(tClean, sClean, isProperNoun ? 0.45 : 0.6)
        )
          isGoodMatch = true;
        else if (
          (tClean.startsWith(sClean) || sClean.startsWith(tClean)) &&
          Math.min(tClean.length, sClean.length) >= 3
        )
          isGoodMatch = true;

        if (isGoodMatch) matchedIndices.add(i - 1);
        else {
          // console.log(`Aligned but rejected: ${tWord} vs ${sWord}`);
        }

        i--;
        j--;
      } else if (i > 0 && (j === 0 || ptr[i][j] === 1)) {
        // Skip Target (Deletion)
        i--;
      } else {
        // Skip Spoken (Insertion)
        j--;
      }
    }

    // 3. Collect errors
    for (let k = 0; k < n; k++) {
      if (!matchedIndices.has(k)) {
        newStruggles.push({
          word: targetWords[k],
          type: "wrong",
          timestamp: Date.now(),
        });
      }
    }

    setCursor(targetWords.length);
    setStruggleItems(newStruggles);

    if (newStruggles.length === 0) {
      handleSuccess();
    } else {
      setStatus("IDLE");
      if (newStruggles.length > 3) {
        setFeedbackMsg(`发现 ${newStruggles.length} 个错误，请重新朗读`);
      } else {
        setFeedbackMsg(`发现 ${newStruggles.length} 个错误`);
      }
    }
  };

  const handleSuccess = () => {
    setStatus("SUCCESS");
    setFeedbackMsg("太棒了！点击→进入下一句");
    const u = new SpeechSynthesisUtterance("Great job!");
    u.lang = "en-US";
    window.speechSynthesis.speak(u);
    // 不自动跳转，由用户点击→按钮
  };

  // ==================== 控制函数 ====================

  // Previous Sentence
  const prevSentence = () => {
    if (currentSentenceIndex > 0) {
      setCurrentSentenceIndex(currentSentenceIndex - 1);
      resetState();
    }
  };

  // Next Sentence
  const advanceSentence = () => {
    if (currentSentenceIndex < sentences.length - 1) {
      setCurrentSentenceIndex(currentSentenceIndex + 1);
      resetState();
    } else {
      nextChunk();
    }
  };

  const resetState = () => {
    setStatus("IDLE");
    setRecognizedText("");
    setCursor(0);
    setStruggleItems([]);
    setFeedbackMsg("点击麦克风读下一句");
    stopPlayingOriginal();
    stopPlayingRecording();
    setRecordedAudio(null);
  };

  // Toggle Play Original
  const togglePlayOriginal = () => {
    if (isPlayingOriginal) {
      stopPlayingOriginal();
    } else {
      // Stop recording playback if active
      stopPlayingRecording();

      // Cancel any previous
      window.speechSynthesis.cancel();

      const u = new SpeechSynthesisUtterance(sentences[currentSentenceIndex]);
      u.lang = "en-US";
      u.rate = playbackRate; // Use state
      u.onstart = () => setIsPlayingOriginal(true);
      u.onend = () => {
        setIsPlayingOriginal(false);
        utteranceRef.current = null;
      };
      u.onerror = (e) => {
        console.error("TTS Error:", e);
        setIsPlayingOriginal(false);
        utteranceRef.current = null;
      };

      utteranceRef.current = u; // Keep alive
      window.speechSynthesis.speak(u);
    }
  };

  const stopPlayingOriginal = () => {
    window.speechSynthesis.cancel();
    setIsPlayingOriginal(false);
    utteranceRef.current = null;
  };

  // Toggle Play Recording
  const togglePlayRecording = () => {
    if (!recordedAudio) return;

    if (isPlayingRecording) {
      stopPlayingRecording();
    } else {
      // Stop original if active
      stopPlayingOriginal();

      const audioUrl = URL.createObjectURL(recordedAudio);
      const audio = new Audio(audioUrl);
      audioRef.current = audio;

      audio.onplay = () => setIsPlayingRecording(true);
      audio.onended = () => {
        setIsPlayingRecording(false);
        URL.revokeObjectURL(audioUrl);
      };
      audio.play();
    }
  };

  const stopPlayingRecording = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    setIsPlayingRecording(false);
  };

  // 播放单词发音 (支持重复播放)
  // repeatCount: 1 (默认，用于绿色/普通单词) | 3 (用于红色错误单词)
  const playWord = (word: string, repeatCount: number = 1) => {
    stopPlayingOriginal();
    stopPlayingRecording();

    console.log(`Playing word: '${word}', repeat: ${repeatCount}`);

    // 停止当前所有语音
    window.speechSynthesis.cancel();

    // 确保语音库已加载
    const voices = window.speechSynthesis.getVoices();
    if (voices.length === 0) {
      window.speechSynthesis.addEventListener(
        "voiceschanged",
        () => {
          playWord(word, repeatCount);
        },
        { once: true },
      );
      return;
    }

    const speakOnce = (count: number) => {
      if (count <= 0) return;

      const u = new SpeechSynthesisUtterance(word);
      u.lang = "en-US";
      u.rate = playbackRate; // Use state
      u.volume = 1.0;

      const enVoice = voices.find((v) => v.lang.startsWith("en"));
      if (enVoice) u.voice = enVoice;

      u.onend = () => {
        if (count > 1) {
          // 间隔 500ms 再次播放
          setTimeout(() => speakOnce(count - 1), 500);
        }
        utteranceRef.current = null; // Clear ref after done
      };

      u.onerror = (e) => {
        // Don't alert for interruption
        if (e.error !== "interrupted" && e.error !== "canceled") {
          console.error("TTS Failed:", e.error);
        }
      };

      utteranceRef.current = u; // Keep alive!
      window.speechSynthesis.speak(u);
    };

    // 短暂延迟后开始播放
    setTimeout(() => speakOnce(repeatCount), 50);
  };

  // ==================== 渲染 ====================
  if (!chunks.length) return <div>没有文本</div>;

  const renderedText = targetWords.map((word, idx) => {
    let color = "black";
    let bg = "transparent";
    let icon = "";

    // 检查是否是错误单词
    const isWrong = struggleItems.some(
      (item) => item.word.toLowerCase() === word.toLowerCase(),
    );

    if (idx < cursor) {
      if (isWrong) {
        color = "#dc2626"; // 红色（错误）
        icon = " ✗";
      } else {
        color = "#16a34a"; // 绿色（正确）
        icon = " ✓";
      }
    } else if (idx === cursor) {
      color = "black"; // 黑色（当前）
      bg = "transparent";
    } else {
      color = "black"; // 黑色（未读）
    }

    return (
      <span
        key={idx}
        onClick={() => playWord(word, isWrong ? 3 : 1)}
        style={{
          color,
          backgroundColor: bg,
          padding: "2px 6px",
          margin: "0 2px",
          borderRadius: 4,
          transition: "all 0.2s",
          display: "inline-block",
          fontWeight: isWrong ? 600 : 500,
          cursor: "pointer",
          userSelect: "none",
        }}
        title="点击发音"
      >
        {word}
        {icon}
      </span>
    );
  });

  return (
    <div
      style={{
        maxWidth: "900px",
        margin: "0 auto",
        textAlign: "center",
        height: "100%",
        paddingBottom: "160px" /* fixed footer padding */,
      }}
    >
      <div
        style={{
          color: "#888",
          fontSize: "0.875rem",
          marginBottom: "1rem",
          marginTop: "1rem",
        }}
      >
        句子 {currentSentenceIndex + 1} / {sentences.length}
      </div>

      {/* Translation Display */}
      <div
        style={{
          marginBottom: "1rem",
          color: "var(--secondary-foreground)",
          fontSize: "1rem",
          minHeight: "1.5em",
        }}
      >
        {sentenceTranslation}
      </div>

      <div
        style={{
          padding: "2rem 1.5rem",
          border: isRecording
            ? "2px solid #ef4444"
            : isProcessing
              ? "2px solid #fbbf24"
              : "1px solid #e5e7eb",
          borderRadius: "12px",
          backgroundColor: "white",
          fontSize: "1.5rem",
          fontWeight: 500,
          lineHeight: 1.8,
          display: "flex",
          flexWrap: "wrap",
          gap: "0.25rem",
          justifyContent: "center",
          boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
          minHeight: "200px",
          alignItems: "center",
        }}
      >
        {renderedText}
      </div>

      {recognizedText && (
        <div
          style={{
            marginTop: "2rem",
            padding: "1rem",
            backgroundColor: "#f3f4f6",
            borderRadius: "8px",
            fontSize: "1rem",
            color: "black",
          }}
        >
          <strong>识别结果：</strong>
          {recognizedText}
        </div>
      )}

      <div
        style={{
          marginTop: "2rem",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "1rem",
        }}
      >
        {!isRecording && !isProcessing && (
          <DeviceSelector onDeviceSelect={setSelectedDeviceId} />
        )}
        {isRecording && mediaStream && <AudioVisualizer stream={mediaStream} />}

        <div
          style={{
            fontWeight: 600,
            color:
              status === "SUCCESS"
                ? "#16a34a"
                : status === "RECORDING"
                  ? "#ef4444"
                  : "#2563eb",
            fontSize:
              feedbackMsg.includes("Ready") || feedbackMsg.includes("Go!")
                ? "1.5rem"
                : "1rem",
            transition: "font-size 0.3s",
          }}
        >
          {feedbackMsg}
        </div>

        {/* Error Warning */}
        {struggleItems.length > 3 && (
          <div
            style={{
              color: "#ef4444",
              fontSize: "0.875rem",
              marginTop: "0.5rem",
              fontWeight: 500,
            }}
          >
            超过3个错误无法进入下一句 (标点符号不发音)
          </div>
        )}
      </div>
      <div
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: "white",
          borderTop: "1px solid #e5e7eb",
          padding: "1rem 2rem 2rem 2rem", // more padding at bottom for safety area
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          gap: "2rem",
          boxShadow: "0 -4px 20px rgba(0,0,0,0.05)",
          zIndex: 50,
        }}
      >
        {/* 0. Speed Control */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "0.5rem",
          }}
        >
          <button
            onClick={() =>
              setPlaybackRate((prev) => (prev === 1.0 ? 0.8 : 1.0))
            }
            disabled={isRecording || isProcessing}
            style={{
              width: 50,
              height: 50,
              borderRadius: "50%",
              border: "2px solid #e5e7eb",
              backgroundColor: "white",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: isRecording || isProcessing ? "not-allowed" : "pointer",
              opacity: isRecording || isProcessing ? 0.5 : 1,
              transition: "all 0.2s",
              color: "var(--foreground)",
              fontWeight: 600,
              fontSize: "0.9rem",
            }}
          >
            {playbackRate}x
          </button>
          <span style={{ fontSize: "0.75rem", color: "#6b7280" }}>语速</span>
        </div>

        {/* 1. Original Audio */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "0.5rem",
          }}
        >
          <button
            onClick={togglePlayOriginal}
            disabled={isRecording || isProcessing}
            style={{
              width: 50,
              height: 50,
              borderRadius: "50%",
              border: "2px solid #e5e7eb",
              backgroundColor: isPlayingOriginal ? "#e5e7eb" : "white",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: isRecording || isProcessing ? "not-allowed" : "pointer",
              opacity: isRecording || isProcessing ? 0.5 : 1,
              transition: "all 0.2s",
              color: "var(--foreground)",
            }}
          >
            {isPlayingOriginal ? (
              <Square size={20} fill="currentColor" />
            ) : (
              <Volume2 size={24} />
            )}
          </button>
          <span style={{ fontSize: "0.75rem", color: "#6b7280" }}>原音</span>
        </div>

        {/* 2. Prev Button */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "0.5rem",
          }}
        >
          <button
            onClick={prevSentence}
            disabled={currentSentenceIndex === 0 || isRecording || isProcessing}
            style={{
              width: 50,
              height: 50,
              borderRadius: "50%",
              border: "2px solid #e5e7eb",
              backgroundColor: "white",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor:
                currentSentenceIndex === 0 || isRecording || isProcessing
                  ? "not-allowed"
                  : "pointer",
              opacity:
                currentSentenceIndex === 0 || isRecording || isProcessing
                  ? 0.5
                  : 1,
              transition: "all 0.2s",
              color: "var(--foreground)",
            }}
          >
            <ArrowRight size={24} style={{ transform: "rotate(180deg)" }} />
          </button>
          <span style={{ fontSize: "0.75rem", color: "#6b7280" }}>上一个</span>
        </div>

        {/* 3. Main Record Button */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "0.5rem",
          }}
        >
          <button
            onClick={isRecording ? stopRecording : startRecording}
            disabled={isProcessing}
            className={clsx(isRecording && "animate-pulse")}
            style={{
              width: 80,
              height: 80,
              borderRadius: "50%",
              background: isRecording
                ? "#ef4444"
                : isProcessing
                  ? "#fbbf24"
                  : "#3b82f6",
              color: "white",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: isProcessing ? "wait" : "pointer",
              boxShadow: "0 6px 20px rgba(59,130,246,0.4)",
              border: "none",
              transition: "all 0.2s",
              opacity: isProcessing ? 0.7 : 1,
            }}
          >
            {isProcessing ? (
              <Loader2 size={36} className="animate-spin" />
            ) : isRecording ? (
              <Square size={32} fill="currentColor" />
            ) : (
              <Mic size={36} />
            )}
          </button>
          <span style={{ fontSize: "0.75rem", color: "#6b7280" }}>
            {isRecording ? "停止" : "录音"}
          </span>
        </div>

        {/* 4. Next Button */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "0.5rem",
          }}
        >
          <button
            onClick={advanceSentence}
            disabled={
              (currentSentenceIndex === sentences.length - 1 &&
                chunks.length > 0 &&
                false) ||
              isRecording ||
              isProcessing ||
              struggleItems.length > 3 // Block if too many errors
            }
            style={{
              width: 50,
              height: 50,
              borderRadius: "50%",
              border: "2px solid #e5e7eb",
              backgroundColor: "white",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: isRecording || isProcessing ? "not-allowed" : "pointer",
              opacity: isRecording || isProcessing ? 0.5 : 1,
              transition: "all 0.2s",
              color: "var(--foreground)",
            }}
          >
            <ArrowRight size={24} />
          </button>
          <span style={{ fontSize: "0.75rem", color: "#6b7280" }}>下一个</span>
        </div>

        {/* 5. Playback Recording */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "0.5rem",
          }}
        >
          <button
            onClick={togglePlayRecording}
            disabled={!recordedAudio || isRecording || isProcessing}
            style={{
              width: 50,
              height: 50,
              borderRadius: "50%",
              border: `2px solid ${isPlayingRecording ? "#ef4444" : "#10b981"}`,
              backgroundColor: "white",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor:
                !recordedAudio || isRecording || isProcessing
                  ? "not-allowed"
                  : "pointer",
              opacity: !recordedAudio || isRecording || isProcessing ? 0.5 : 1,
              transition: "all 0.2s",
              color: isPlayingRecording ? "#ef4444" : "#10b981",
            }}
          >
            {isPlayingRecording ? (
              <Square size={20} fill="currentColor" />
            ) : (
              <Play size={24} />
            )}
          </button>
          <span style={{ fontSize: "0.75rem", color: "#6b7280" }}>回放</span>
        </div>
      </div>
    </div>
  );
}
