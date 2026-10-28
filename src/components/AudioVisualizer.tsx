import { useEffect, useRef } from "react";
import type { AudioEngine } from "../audio/audio-engine";

interface AudioVisualizerProps {
  audioEngine: AudioEngine;
  isActive: boolean;
}

export function AudioVisualizer({
  audioEngine,
  isActive,
}: AudioVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameIdRef = useRef<number | null>(null);
  const frequencyDataRef = useRef<Uint8Array<ArrayBuffer> | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;

    if (!canvas) {
      return;
    }

    const context = canvas.getContext("2d");

    if (!context) {
      return;
    }

    const stopAnimationLoop = (): void => {
      if (animationFrameIdRef.current !== null) {
        cancelAnimationFrame(animationFrameIdRef.current);
        animationFrameIdRef.current = null;
      }
    };

    stopAnimationLoop();

    if (!isActive) {
      context.clearRect(0, 0, canvas.width, canvas.height);
      return stopAnimationLoop;
    }

    const frequencyBinCount = audioEngine.getFrequencyBinCount();

    if (frequencyBinCount === 0) {
      context.clearRect(0, 0, canvas.width, canvas.height);
      return stopAnimationLoop;
    }

    if (
      !frequencyDataRef.current ||
      frequencyDataRef.current.length !== frequencyBinCount
    ) {
      frequencyDataRef.current = new Uint8Array(frequencyBinCount);
    }

    const frequencyData = frequencyDataRef.current;

    const draw = (): void => {
      audioEngine.fillFrequencyData(frequencyData);

      context.clearRect(
        0,
        0,
        canvas.width,
        canvas.height
      );

      const barCount = frequencyData.length;
      const gap = 1;
      const availableWidth =
        canvas.width - gap * (barCount - 1);
      const barWidth = availableWidth / barCount;

      context.fillStyle = "#2563eb";

      for (let index = 0; index < barCount; index += 1) {
        const value = frequencyData[index];
        const barHeight =
          (value / 255) * canvas.height;

        const x = index * (barWidth + gap);
        const y = canvas.height - barHeight;

        context.fillRect(
          x,
          y,
          barWidth,
          barHeight
        );
      }

      animationFrameIdRef.current =
        requestAnimationFrame(draw);
    };

    draw();

    return () => {
      stopAnimationLoop();

      context.clearRect(
        0,
        0,
        canvas.width,
        canvas.height
      );
    };
  }, [audioEngine, isActive]);

  return (
    <canvas
      ref={canvasRef}
      className="audio-visualizer"
      width={800}
      height={300}
      aria-label="Real-time audio frequency visualizer"
    />
  );
}