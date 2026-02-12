"use client";

import { useEffect, useRef } from "react";

// Define props interface
interface AudioVisualizerProps {
  stream: MediaStream | null;
  width?: number | string;
  height?: number | string;
}

export default function AudioVisualizer({
  stream,
  width = 300,
  height = 60,
}: AudioVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // ... refs ...

  // ... useEffects ...

  return (
    <canvas
      ref={canvasRef}
      width={typeof width === "number" ? width : 300}
      height={typeof height === "number" ? height : 60}
      style={{
        width: width === "100%" ? "100%" : typeof width === "number" ? `${width}px` : width,
        height: typeof height === "number" ? `${height}px` : height,
        borderRadius: "8px",
        background: "rgba(0,0,0,0.02)",
        // Always show block if stream is present, but content determines what is seen
        display: stream ? "block" : "none",
      }}
    />
  );
}
