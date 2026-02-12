/**
 * 录制WAV格式音频
 * 使用Web Audio API直接获取PCM数据并转换为WAV格式
 */

export class WAVRecorder {
  private audioContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private processor: ScriptProcessorNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  // @ts-ignore
  private vadNode: ScriptProcessorNode | null = null;

  private recording: boolean = false;
  private buffers: Float32Array[] = [];

  // VAD (静音检测) 相关
  public onSilence: (() => void) | null = null;
  // 参数: rms(当前音量), isSpeech(是否说话), silenceDuration(静音持续毫秒)
  public onVADStateChange:
    | ((rms: number, isSpeech: boolean, silenceDuration: number) => void)
    | null = null;

  private silenceStartTime: number | null = null;
  private readonly SPEECH_THRESHOLD = 0.035; // 提高阈值以过滤咳嗽/噪音 (原 0.015)
  private readonly SILENCE_DURATION = 4000; // 4秒 (按用户要求保持)

  async start(stream: MediaStream) {
    this.audioContext = new AudioContext({ sampleRate: 16000 });
    this.mediaStream = stream;
    this.source = this.audioContext.createMediaStreamSource(stream);

    // 1. 录音路径
    this.processor = this.audioContext.createScriptProcessor(4096, 1, 1);
    this.buffers = [];
    this.recording = true;

    this.processor.onaudioprocess = (e) => {
      if (!this.recording) return;
      const inputData = e.inputBuffer.getChannelData(0);
      this.buffers.push(new Float32Array(inputData));
    };

    // 2. VAD检测路径：直接用原始信号计算RMS
    this.vadNode = this.audioContext.createScriptProcessor(4096, 1, 1);
    this.silenceStartTime = Date.now();

    this.vadNode.onaudioprocess = (e) => {
      if (!this.recording) return;
      const data = e.inputBuffer.getChannelData(0);

      // 计算RMS
      let sum = 0;
      for (let i = 0; i < data.length; i++) {
        sum += data[i] * data[i];
      }
      const rms = Math.sqrt(sum / data.length);

      // 简单有效的逻辑：RMS大于阈值视为说话
      const isSpeech = rms > this.SPEECH_THRESHOLD;

      if (isSpeech) {
        this.silenceStartTime = Date.now();
      }

      const currentSilenceDuration = this.silenceStartTime
        ? Date.now() - this.silenceStartTime
        : 0;

      // 触发状态回调
      if (this.onVADStateChange) {
        this.onVADStateChange(rms, isSpeech, currentSilenceDuration);
      }

      if (currentSilenceDuration > this.SILENCE_DURATION) {
        if (this.onSilence) {
          console.log(
            `Silence detected (${currentSilenceDuration}ms), trigger stop.`,
          );
          this.onSilence();
          this.silenceStartTime = Date.now(); // 防止重复触发
        }
      }
    };

    this.source.connect(this.processor);
    this.processor.connect(this.audioContext.destination);

    this.source.connect(this.vadNode);
    this.vadNode.connect(this.audioContext.destination);
  }

  stop(): Blob {
    if (!this.recording) return new Blob([], { type: "audio/wav" });
    this.recording = false;

    if (this.processor) {
      this.processor.disconnect();
    }
    if (this.vadNode) {
      this.vadNode.disconnect();
    }
    this.onSilence = null;
    this.onVADStateChange = null;
    if (this.source) {
      this.source.disconnect();
    }
    if (this.audioContext && this.audioContext.state !== "closed") {
      try {
        this.audioContext.close();
      } catch (e) {
        console.warn("AudioContext already closing/closed", e);
      }
    }

    // 合并所有buffer
    const totalLength = this.buffers.reduce((acc, buf) => acc + buf.length, 0);
    const combined = new Float32Array(totalLength);
    let offset = 0;
    for (const buffer of this.buffers) {
      combined.set(buffer, offset);
      offset += buffer.length;
    }

    // 转换为PCM16
    const pcm16 = this.floatTo16BitPCM(combined);

    // 生成WAV文件
    const wavBlob = this.encodeWAV(pcm16, 16000);

    return wavBlob;
  }

  private floatTo16BitPCM(input: Float32Array): Int16Array {
    const output = new Int16Array(input.length);
    for (let i = 0; i < input.length; i++) {
      const s = Math.max(-1, Math.min(1, input[i]));
      output[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    return output;
  }

  private encodeWAV(samples: Int16Array, sampleRate: number): Blob {
    const buffer = new ArrayBuffer(44 + samples.length * 2);
    const view = new DataView(buffer);

    // WAV文件头
    this.writeString(view, 0, "RIFF");
    view.setUint32(4, 36 + samples.length * 2, true);
    this.writeString(view, 8, "WAVE");
    this.writeString(view, 12, "fmt ");
    view.setUint32(16, 16, true); // fmt chunk size
    view.setUint16(20, 1, true); // PCM format
    view.setUint16(22, 1, true); // mono
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true); // byte rate
    view.setUint16(32, 2, true); // block align
    view.setUint16(34, 16, true); // bits per sample
    this.writeString(view, 36, "data");
    view.setUint32(40, samples.length * 2, true);

    // 写入PCM数据
    const offset = 44;
    for (let i = 0; i < samples.length; i++) {
      view.setInt16(offset + i * 2, samples[i], true);
    }

    return new Blob([buffer], { type: "audio/wav" });
  }

  private writeString(view: DataView, offset: number, string: string) {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  }
}
