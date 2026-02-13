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
    // Force Custom Logic: Intl.Segmenter varies by browser and might split abbreviations incorrectly.
    // We use a robust "Protect-Split-Restore" strategy to guarantee consistency.

    // 1. Protect Abbreviations
    let tempText = currentChunkText
      .replace(/\b(Mr)\./g, "Mr###")
      .replace(/\b(Mrs)\./g, "Mrs###")
      .replace(/\b(Ms)\./g, "Ms###")
      .replace(/\b(Dr)\./g, "Dr###")
      .replace(/\b(Prof)\./g, "Prof###")
      .replace(/\b(Sr)\./g, "Sr###")
      .replace(/\b(Jr)\./g, "Jr###")
      .replace(/\b(St)\./g, "St###");

    // 2. Split by Punctuation
    // Matches sequence of non-punctuation followed by punctuation and optional quotes/brackets
    const matches =
      tempText.match(/[^.!?]+[.!?]+['"”’)]*/g) || [tempText];

    // 3. Restore and Filter
    return matches
      .map(s => s.replace(/###/g, "."))
      .filter((s) => s.trim().length > 0);
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
    const segmenter = new Intl.Segmenter("en", { granularity: "word" });
    const segments = Array.from(segmenter.segment(s));

    return segments.map((segment) => ({
      display: segment.segment,
      clean: segment.isWordLike ? segment.segment.toLowerCase() : "",
      isWord: !!segment.isWordLike
    }));
  }, [sentences, currentSentenceIndex]);

  const [isPlayingOriginal, setIsPlayingOriginal] = useState(false);
  const [isPlayingRecording, setIsPlayingRecording] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1.0); // 0.8 or 1.0
  const [sentenceTranslation, setSentenceTranslation] = useState("");
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const recordingTimerRef = useRef<any>(null); // 用于清理 Ready 阶段的 1.5s 计时器
  const isBusyRef = useRef(false); // 同步原子锁，防止事件穿透导致的重入

  // Cleanup for recording timer
  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) {
        clearTimeout(recordingTimerRef.current);
      }
    };
  }, []);

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

    // 原子锁检查：同步拦截任何正在进行的任务
    if (isBusyRef.current) {
      console.log("原子锁激活：拦截启动信号");
      return;
    }

    // 重入锁 (React 状态双重检查)
    if (isProcessing || status === "PROCESSING" || status === "SUCCESS") {
      console.log("状态锁激活：拦截启动信号");
      return;
    }

    // 立即加锁
    isBusyRef.current = true;
    console.log("录音会话开始，已加锁");

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
        // 关键修复：传入当前的 recorder 实例进行校验，防止旧回调关闭新录音
        if (isRecordingRef.current) {
          console.log("检测到静音，尝试自动停止录音...");
          stopRecording(recorder);
        } else {
          console.log("处于Ready阶段或已停止，忽略静音信号");
        }
      };

      // 更新UI显示倒计时
      recorder.onVADStateChange = (rms, isSpeech, silenceDuration) => {
        // 使用Ref来检查录音状态，避免闭包问题
        if (!isRecordingRef.current) {
          // 在Ready阶段，不断重置静音起始时间，防止计时器提前跑
          // 虽然底层库在计算，但我们在这里反馈中立状态
          return;
        }

        if (silenceDuration > 500) {
          const remaining = Math.ceil((4000 - silenceDuration) / 1000);
          if (remaining > 0 && remaining < 4) {
            setFeedbackMsg(`静音检测: ${remaining}秒后停止...`);
          } else if (remaining <= 0) {
            setFeedbackMsg("正在停止...");
          } else {
            setFeedbackMsg(isSpeech ? "正在录音... (已捕捉声波)" : "正在录音...");
          }
        } else {
          setFeedbackMsg(isSpeech ? "正在录音... (已捕捉声波)" : "正在录音...");
        }
      };

      await recorder.start(stream);
      wavRecorderRef.current = recorder;

      // 等待录音器完全就绪（1.5秒）
      recordingTimerRef.current = setTimeout(() => {
        setIsRecording(true);
        isRecordingRef.current = true; // 更新Ref
        setFeedbackMsg("Go! 正在录音...");
        recordingTimerRef.current = null;
      }, 1500);
    } catch (e) {
      console.error(e);
      setFeedbackMsg("麦克风错误");
      setIsRecording(false);
      isRecordingRef.current = false;
      isBusyRef.current = false; // 报错即解锁
    }
  };

  const stopRecording = (targetRecorder?: WAVRecorder) => {

    // 实例验证：如果传入了 targetRecorder (来自 VAD 回调)，必须与当前 ref 中的实例一致才准许停止
    // 这能有效防止“过期回调”误杀新进程
    if (
      targetRecorder &&
      wavRecorderRef.current &&
      targetRecorder !== wavRecorderRef.current
    ) {
      console.log("收到过期停止信号，已拦截");
      return;
    }

    // 关键修复：立即清理计时器，防止 Ready 阶段点击停止后又“自动启动”
    if (recordingTimerRef.current) {
      clearTimeout(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }

    if (wavRecorderRef.current) {
      const activeRecorder = wavRecorderRef.current;
      const wasRecording = isRecordingRef.current;

      // 注意：这里暂时不要重置 isBusyRef，因为停止后马上进入了 PROCESSING 阶段
      // 只有在流程彻底结束（processRecording 结束或 Error）时才释放

      const wavBlob = activeRecorder.stop();

      // 彻底清理引用
      wavRecorderRef.current = null;
      setIsRecording(false);
      isRecordingRef.current = false; // 更新Ref
      mediaStream?.getTracks().forEach((t) => t.stop());
      setMediaStream(null);

      // 如果是在正式录音阶段停止的，才进行处理
      if (wasRecording) {
        setRecordedAudio(wavBlob);
        processRecording(wavBlob);
      } else {
        // 在 Ready 阶段被中断，回到 IDLE 并释放锁
        isBusyRef.current = false;
        console.log("Ready阶段取消，已释放锁");
        setStatus("IDLE");
        setFeedbackMsg("已取消录音");
      }
    } else {
      // 没有任何实例可停止，但也需要解锁
      isBusyRef.current = false;
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
      isBusyRef.current = false; // 终极释放锁：处理流程（无论成败）彻底结束
      console.log("录音处理流程结束，已释放锁");
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
      // "like", // Removed: "like" is a common word in target text
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

    // Filter target words for matching (ignore punctuation)
    const matchableTargets = targetWords.filter(w => w.isWord);

    const n = matchableTargets.length;
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
        const tWord = matchableTargets[i - 1];
        const sWord = spokenWords[j - 1]; // Spoken is already lowercase

        const tClean = normalize(tWord.clean);
        const sClean = normalize(sWord);

        const isProperNoun = /^[A-Z]/.test(tWord.display);
        const lenDiff = Math.abs(tClean.length - sClean.length);
        const firstLetterMatch = tClean[0] === sClean[0];

        let matchScore = -5; // Default mismatch

        // --- Match Scoring Logic ---
        const numberMap: Record<string, string> = {
          "zero": "0", "one": "1", "two": "2", "three": "3", "four": "4",
          "five": "5", "six": "6", "seven": "7", "eight": "8", "nine": "9", "ten": "10"
        };
        const tNorm = numberMap[tClean] || tClean;
        const sNorm = numberMap[sClean] || sClean;

        if (tClean === sClean || tNorm === sNorm) {
          matchScore = 15; // Exact match or Number match
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

        const tWord = matchableTargets[i - 1];
        const sWord = spokenWords[j - 1];
        const tClean = normalize(tWord.clean);
        const sClean = normalize(sWord);

        const isProperNoun = /^[A-Z]/.test(tWord.display);
        const lenDiff = Math.abs(tClean.length - sClean.length);
        const firstLetterMatch = tClean[0] === sClean[0];

        let isGoodMatch = false;

        // --- Validation Logic (MUST SYNC WITH SCORING) ---
        const numberMap: Record<string, string> = {
          "zero": "0", "one": "1", "two": "2", "three": "3", "four": "4",
          "five": "5", "six": "6", "seven": "7", "eight": "8", "nine": "9", "ten": "10"
        };
        const tNorm = numberMap[tClean] || tClean;
        const sNorm = numberMap[sClean] || sClean;

        if (tClean === sClean || tNorm === sNorm) isGoodMatch = true;
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
          word: matchableTargets[k].clean, // Use clean text for correct matching in render loop
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

  const renderedText = targetWords.map((item: { display: string; clean: string; isWord: boolean }, idx: number) => {
    // Render punctuation/spaces simply
    if (!item.isWord) {
      // Don't render pure whitespace if we want to rely on gaps, but Intl.Segmenter produces whitespace segments.
      // We usually want to preserve them for layout.
      return <span key={idx} style={{ userSelect: "none" }}>{item.display}</span>;
    }

    let color = "black";
    let bg = "transparent";
    let icon = "";

    // 检查是否是错误单词 (compare against clean text)
    const isWrong = struggleItems.some(
      (struggle) => struggle.word.toLowerCase() === item.clean,
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
        onClick={() => playWord(item.display, isWrong ? 3 : 1)}
        style={{
          color,
          backgroundColor: bg,
          padding: "2px 0", // Reduced padding
          margin: "0",      // Removed margin to let punctuation sit tight
          borderRadius: 4,
          transition: "all 0.2s",
          display: "inline-block",
          fontWeight: isWrong ? 600 : 500,
          cursor: "pointer",
          userSelect: "none",
        }}
        title="点击发音"
      >
        {item.display}
        {icon}
      </span>
    );
  });

  return (
    <>
      <div
        className="animate-slide-up"
        style={{
          maxWidth: "960px",
          margin: "0 auto",
          textAlign: "center",
          height: "100%",
          paddingBottom: "180px",
          paddingLeft: "1rem",
          paddingRight: "1rem"
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "0.5rem",
            color: "var(--secondary-foreground)",
            fontSize: "0.85rem",
            fontWeight: 700,
            marginBottom: "1rem",
            marginTop: "1rem",
            textTransform: "uppercase",
            opacity: 0.6
          }}
        >
          <div style={{ width: "20px", height: "1px", background: "currentColor" }} />
          <span>进度 {currentSentenceIndex + 1} / {sentences.length}</span>
          <div style={{ width: "20px", height: "1px", background: "currentColor" }} />
        </div>

        {/* Translation Display */}
        <div
          className="glass-card"
          style={{
            marginBottom: "1.5rem",
            color: "var(--primary)",
            fontSize: "1.1rem",
            fontWeight: 600,
            background: "rgba(99, 102, 241, 0.05)",
            padding: "1rem 1.5rem",
            borderLeft: "5px solid var(--primary)",
            borderRadius: "14px",
            fontStyle: "italic",
            opacity: 0.9,
            textAlign: "left"
          }}
        >
          {sentenceTranslation}
        </div>

        <div
          className="glass-card"
          style={{
            padding: "2.5rem 1.5rem",
            border: isRecording
              ? "3px solid #ef4444"
              : isProcessing
                ? "3px solid #f59e0b"
                : "2px solid var(--border)",
            backgroundColor: "var(--secondary)",
            fontSize: "1.75rem",
            fontWeight: 700,
            lineHeight: 1.8,
            display: "flex",
            flexWrap: "wrap",
            gap: "0.4rem",
            justifyContent: "center",
            boxShadow: isRecording ? "0 0 30px rgba(239, 68, 68, 0.2)" : "var(--shadow)",
            minHeight: "260px",
            alignItems: "center",
            transition: "all 0.3s ease",
            letterSpacing: "-0.02em"
          }}
        >
          {renderedText}
        </div>

        {recognizedText && (
          <div
            className="glass-card"
            style={{
              marginTop: "1.5rem",
              padding: "1.25rem",
              background: "rgba(0,0,0,0.03)",
              fontSize: "0.95rem",
              color: "var(--foreground)",
              borderStyle: "dashed",
              opacity: 0.8
            }}
          >
            <strong style={{ color: "var(--primary)", marginRight: "0.5rem" }}>识别结果：</strong>
            {recognizedText}
          </div>
        )}

        <div
          style={{
            marginTop: "2rem",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "1.25rem",
          }}
        >
          {/* DeviceSelector moved to footer */}
          {/* AudioVisualizer moved to footer */}

          <div
            style={{
              fontWeight: 800,
              color:
                status === "SUCCESS"
                  ? "var(--success)"
                  : status === "RECORDING"
                    ? "#ef4444"
                    : "var(--primary)",
              fontSize:
                feedbackMsg.includes("Go!") || feedbackMsg.includes("SUCCESS")
                  ? "1.8rem"
                  : "1.1rem",
              transition: "all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
              filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.1))"
            }}
          >
            {feedbackMsg}
          </div>

        </div>

      </div>

      {/* Floating Controller Footer */}
      <div
        className="glass-card"
        style={{
          position: "fixed",
          bottom: "1.5rem",
          left: "50%",
          transform: "translateX(-50%)",
          width: "calc(100% - 3rem)",
          maxWidth: "500px",
          padding: "0.5rem 1rem",
          display: "flex",
          flexDirection: "column", // Change to column to stack buttons and selector
          alignItems: "center",
          gap: "0.5rem",
          boxShadow: "0 10px 40px rgba(0,0,0,0.15)",
          zIndex: 100,
          borderRadius: "30px",
          background: "rgba(255, 255, 255, 0.9)",
          backdropFilter: "blur(10px)",
          border: "1px solid rgba(255,255,255,0.5)",
        }}
      >
        {/* Error Warning - Floating above control bar */}
        {struggleItems.length > 3 && (
          <div
            className="animate-slide-up"
            style={{
              position: "absolute",
              top: "-50px",
              left: "50%",
              transform: "translateX(-50%)",
              color: "#ef4444",
              fontSize: "0.85rem",
              background: "#fff1f2",
              padding: "0.5rem 1rem",
              borderRadius: "20px",
              fontWeight: 700,
              boxShadow: "0 4px 6px -1px rgba(225, 29, 72, 0.1)",
              whiteSpace: "nowrap",
              zIndex: 90
            }}
          >
            🚧 错误稍多，请多尝试几次 (忽略标点)
          </div>
        )}

        {/* Row 1: Buttons Grid */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "1fr auto 1fr",
          width: "100%",
          alignItems: "center"
        }}>
          {/* LEFT COLUMN: Controls */}
          <div style={{ display: "flex", gap: "0.5rem", justifySelf: "start" }}>
            {/* Previous */}
            <button
              onClick={prevSentence}
              disabled={currentSentenceIndex === 0 || isRecording || isProcessing}
              style={{
                width: 40,
                height: 40,
                borderRadius: "50%",
                background: "var(--glass)",
                border: "none",
                color: "var(--foreground)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "all 0.2s",
                opacity: currentSentenceIndex === 0 || isRecording || isProcessing ? 0.3 : 0.8,
                cursor: "pointer"
              }}
            >
              <ArrowRight size={18} style={{ transform: "rotate(180deg)" }} />
            </button>

            {/* Speed */}
            <button
              onClick={() => setPlaybackRate((prev) => (prev === 1.0 ? 0.8 : 1.0))}
              style={{
                width: 40,
                height: 40,
                borderRadius: "50%",
                background: playbackRate === 0.8 ? "var(--primary)" : "var(--glass)",
                color: playbackRate === 0.8 ? "white" : "var(--primary)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "0.75rem",
                fontWeight: 800,
                border: "none",
                cursor: "pointer"
              }}
            >
              {playbackRate === 1.0 ? "1x" : "0.8x"}
            </button>

            {/* Original Audio */}
            <button
              onClick={togglePlayOriginal}
              disabled={isRecording || isProcessing}
              style={{
                width: 40,
                height: 40,
                borderRadius: "50%",
                background: isPlayingOriginal ? "var(--primary)" : "var(--glass)",
                color: isPlayingOriginal ? "white" : "var(--primary)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                border: "none",
                cursor: "pointer"
              }}
            >
              {isPlayingOriginal ? <Square size={16} /> : <Volume2 size={18} />}
            </button>
          </div>

          {/* CENTER COLUMN: Record Button */}
          <div style={{ justifySelf: "center" }}>
            <button
              onClick={() => {
                if (isRecording) {
                  stopRecording();
                } else {
                  startRecording();
                }
              }}
              disabled={isProcessing || status === "SUCCESS"}
              style={{
                width: "64px",
                height: "64px",
                borderRadius: "50%",
                background: isRecording ? "#ef4444" : "var(--primary)",
                color: "white",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
                boxShadow: isRecording
                  ? "0 0 25px rgba(239, 68, 68, 0.6)"
                  : "0 10px 25px -5px rgba(99, 102, 241, 0.5)",
                border: "4px solid white",
                transform: isRecording ? "scale(1.15)" : "scale(1)",
                opacity: isProcessing || status === "SUCCESS" ? 0.3 : 1,
                cursor: "pointer"
              }}
            >
              {isProcessing ? (
                <Loader2 className="animate-spin" size={28} />
              ) : isRecording ? (
                <Square size={28} fill="white" />
              ) : (
                <Mic size={28} />
              )}
            </button>
          </div>

          {/* RIGHT COLUMN: Playback & Next */}
          <div style={{ display: "flex", gap: "0.5rem", justifySelf: "end" }}>
            {/* Play Recorded */}
            <button
              onClick={togglePlayRecording}
              disabled={!recordedAudio || isRecording || isProcessing}
              style={{
                width: 40,
                height: 40,
                borderRadius: "50%",
                background: isPlayingRecording ? "#10b981" : "var(--glass)",
                color: isPlayingRecording ? "white" : "#10b981",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                border: "none",
                opacity: !recordedAudio ? 0.2 : 1,
                cursor: "pointer"
              }}
            >
              {isPlayingRecording ? <Square size={16} /> : <Play size={18} />}
            </button>

            {/* Next */}
            <button
              onClick={advanceSentence}
              disabled={isRecording || isProcessing || (struggleItems.length > 3 && status !== "SUCCESS")}
              style={{
                width: 40,
                height: 40,
                borderRadius: "50%",
                background: status === "SUCCESS" ? "var(--success)" : "var(--glass)",
                border: "none",
                color: status === "SUCCESS" ? "white" : "var(--foreground)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "all 0.2s",
                opacity: isRecording || isProcessing || (struggleItems.length > 3 && status !== "SUCCESS") ? 0.3 : 0.8,
                cursor: "pointer"
              }}
            >
              <ArrowRight size={18} />
            </button>
          </div>
        </div>


        {/* Row 2: Dynamic Content Area (Fixed Height to prevent jitter) */}
        <div style={{
          position: "relative",
          width: "100%",
          height: "32px",
          marginTop: "0.25rem",
        }}>
          {/* Audio Visualizer - Absolute Overlay */}
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              height: "100%",
              opacity: isRecording && mediaStream ? 0.8 : 0,
              pointerEvents: isRecording ? "auto" : "none",
              transition: "opacity 0.2s",
              borderRadius: "12px",
              overflow: "hidden",
              zIndex: 10
            }}
          >
            {isRecording && mediaStream && (
              <AudioVisualizer stream={mediaStream} height={32} width="100%" />
            )}
          </div>

          {/* Device Selector - Absolute Overlay */}
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              height: "100%",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              opacity: !isRecording && !isProcessing ? 0.8 : 0,
              pointerEvents: !isRecording && !isProcessing ? "auto" : "none",
              transition: "opacity 0.2s",
              transform: "scale(0.9)",
              zIndex: 5
            }}
          >
            <DeviceSelector onDeviceSelect={setSelectedDeviceId} />
          </div>
        </div>
      </div>
    </>
  );
}

