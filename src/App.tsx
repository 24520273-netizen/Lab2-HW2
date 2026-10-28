import { useRef, useState } from "react";
import "./App.css";
import { AudioEngine } from "./audio/audio-engine";

const SAMPLE_TRACK_URL = "/sample.mp3";

function App() {
  const audioEngineRef = useRef<AudioEngine | null>(null);
  const audioBufferRef = useRef<AudioBuffer | null>(null);

  const [status, setStatus] = useState("Audio is not loaded.");
  const [frequencyPreview, setFrequencyPreview] = useState<number[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  const getAudioEngine = (): AudioEngine => {
    if (!audioEngineRef.current) {
      audioEngineRef.current = new AudioEngine();
    }

    return audioEngineRef.current;
  };

  const handleLoadAudio = async (): Promise<void> => {
    try {
      setStatus("Loading audio...");

      const audioEngine = getAudioEngine();
      const audioBuffer = await audioEngine.loadAudio(SAMPLE_TRACK_URL);

      audioBufferRef.current = audioBuffer;
      setIsLoaded(true);

      setStatus(
        `Audio loaded. FFT size: ${audioEngine.getFftSize()}, frequency bins: ${audioEngine.getFrequencyBinCount()}.`
      );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unknown audio loading error.";

      setStatus(message);
      setIsLoaded(false);
      audioBufferRef.current = null;
    }
  };

  const handlePlayAudio = async (): Promise<void> => {
    if (!audioBufferRef.current) {
      setStatus("Load the audio before playing it.");
      return;
    }

    try {
      const audioEngine = getAudioEngine();

      await audioEngine.playAudio(audioBufferRef.current);

      setStatus("Audio is playing through the analyser.");
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unknown audio playback error.";

      setStatus(message);
    }
  };

  const handleReadFrequencyData = (): void => {
    try {
      const audioEngine = getAudioEngine();
      const frequencyData = audioEngine.getFrequencyData();

      const preview = Array.from(frequencyData.slice(0, 16));

      setFrequencyPreview(preview);

      setStatus(
        `Frequency data read successfully: ${frequencyData.length} bins available.`
      );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unknown frequency analysis error.";

      setStatus(message);
    }
  };

  return (
    <main className="app">
      <section className="audio-panel">
        <h1>Web Audio Engine</h1>

        <p className="track-path">
          Audio source: <code>{SAMPLE_TRACK_URL}</code>
        </p>

        <div className="controls">
          <button type="button" onClick={handleLoadAudio}>
            Load Audio
          </button>

          <button
            type="button"
            onClick={handlePlayAudio}
            disabled={!isLoaded}
          >
            Play Audio
          </button>

          <button
            type="button"
            onClick={handleReadFrequencyData}
            disabled={!isLoaded}
          >
            Read Frequency Data
          </button>
        </div>

        <p className="status">{status}</p>

        {frequencyPreview.length > 0 && (
          <section className="frequency-output">
            <h2>Frequency Data Preview</h2>
            <p>{frequencyPreview.join(", ")}</p>
          </section>
        )}
      </section>
    </main>
  );
}

export default App;