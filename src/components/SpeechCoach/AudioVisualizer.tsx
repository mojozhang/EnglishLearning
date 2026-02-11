"use client";

import { useEffect, useRef } from "react";

// Define props interface
interface AudioVisualizerProps {
  stream: MediaStream | null;
}

export default function AudioVisualizer({ stream }: AudioVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const requestRef = useRef<number>();

  useEffect(() => {
    if (!stream) {
      cleanup();
      return;
    }

    // Only initialize if we have an active audio track
    const audioTracks = stream.getAudioTracks();
    if (audioTracks.length === 0 || audioTracks[0].readyState === "ended") {
      console.warn("Stream has no active audio tracks");
      return;
    }

    const initAudio = async () => {
      try {
        // Ensure context exists
        if (!audioContextRef.current) {
          audioContextRef.current = new (
            window.AudioContext || (window as any).webkitAudioContext
          )();
        }

        const ctx = audioContextRef.current;

        // Resume if suspended (browser autoplay policy)
        if (ctx.state === "suspended") {
          await ctx.resume();
        }

        // Create Source and Analyser
        analyserRef.current = ctx.createAnalyser();
        analyserRef.current.fftSize = 256;
        // Smoothing for better visuals
        analyserRef.current.smoothingTimeConstant = 0.8;

        sourceRef.current = ctx.createMediaStreamSource(stream);
        sourceRef.current.connect(analyserRef.current);

        draw();
      } catch (err) {
        console.error("Error accessing audio context for visualizer:", err);
      }
    };

    initAudio();

    return () => {
      cleanup();
    };
  }, [stream]);

  const cleanup = () => {
    if (requestRef.current) {
      cancelAnimationFrame(requestRef.current);
      requestRef.current = undefined;
    }

    if (sourceRef.current) {
      try {
        sourceRef.current.disconnect();
      } catch (e) {
        /* ignore */
      }
      sourceRef.current = null;
    }

    // We do NOT close the AudioContext here to avoid overhead of recreating it repeatedly.
    // But we clear the canvas.
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        // Draw a flat line to indicate "ready" but silence
        ctx.beginPath();
        ctx.moveTo(0, canvas.height / 2);
        ctx.lineTo(canvas.width, canvas.height / 2);
        ctx.strokeStyle = "rgba(0,0,0,0.1)";
        ctx.stroke();
      }
    }
  };

  const draw = () => {
    const canvas = canvasRef.current;
    const analyser = analyserRef.current;
    if (!canvas || !analyser) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const renderFrame = () => {
      requestRef.current = requestAnimationFrame(renderFrame);
      analyser.getByteFrequencyData(dataArray);

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Check if we have any data (sanity check for debug)
      // const hasSignal = dataArray.some(v => v > 0);

      // Draw Bars
      const barWidth = (canvas.width / bufferLength) * 2.5;
      let barHeight;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        barHeight = dataArray[i] / 2; // Scale down

        // Dynamic color based on volume make it more vibrant
        // Use HSL for rainbow effect
        // const hue = (i / bufferLength) * 360;
        // ctx.fillStyle = `hsl(${hue}, 100%, 50%)`;

        // Or user's blue theme
        const r = 50 + i * 2;
        const g = 100 + barHeight * 2;
        const b = 255;
        ctx.fillStyle = `rgb(${r},${g},${b})`;

        ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);

        x += barWidth + 1;
      }

      // Draw baseline
      ctx.fillStyle = "rgba(0,0,0,0.05)";
      ctx.fillRect(0, canvas.height - 1, canvas.width, 1);
    };

    renderFrame();
  };

  return (
    <canvas
      ref={canvasRef}
      width={300}
      height={60}
      style={{
        width: "100%",
        height: "60px",
        borderRadius: "8px",
        background: "rgba(0,0,0,0.02)",
        // Always show block if stream is present, but content determines what is seen
        display: stream ? "block" : "none",
      }}
    />
  );
}
