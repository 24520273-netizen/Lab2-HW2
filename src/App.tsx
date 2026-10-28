import { useRef, useState } from "react";
import "./App.css";
import { AudioEngine } from "./audio/audio-engine";
import { AudioTaskQueue } from "./audio/audio-task-queue";

const SAMPLE_TRACK_URL = "/sample.mp3";

const TRACK_A_URL = "/sample.mp3?track=A";
const TRACK_B_URL = "/sample.mp3?track=B";
const TRACK_C_URL = "/sample.mp3?track=C";

const INVALID_TRACK_URL = "/missing-track.mp3";

function App() {
  const audioEngineRef = useRef<AudioEngine | null>(null);
  const audioQueueRef = useRef<AudioTaskQueue | null>(null);
  const audioBufferRef = useRef<AudioBuffer | null>(null);

  const [status, setStatus] = useState("Audio is not loaded.");
  const [frequencyPreview, setFrequencyPreview] = useState<number[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [queueLog, setQueueLog] = useState<string[]>([]);

  const getAudioEngine = (): AudioEngine => {
    if (!audioEngineRef.current) {
      audioEngineRef.current = new AudioEngine();
    }

    return audioEngineRef.current;
  };

  const getAudioQueue = (): AudioTaskQueue => {
    if (!audioQueueRef.current) {
      audioQueueRef.current = new AudioTaskQueue(getAudioEngine());
    }

    return audioQueueRef.current;
  };

  const addQueueLog = (message: string): void => {
    setQueueLog((currentLog) => [...currentLog, message]);
  };

  const isAbortError = (error: unknown): boolean => {
    return error instanceof DOMException && error.name === "AbortError";
  };

  const enqueueTrack = async (
    label: string,
    trackUrl: string
  ): Promise<void> => {
    try {
      const audioBuffer = await getAudioQueue().enqueue(trackUrl);

      audioBufferRef.current = audioBuffer;
      setIsLoaded(true);

      addQueueLog(`Resolved: ${label}`);
    } catch (error) {
      if (isAbortError(error)) {
        addQueueLog(`Cancelled: ${label}`);
        return;
      }

      addQueueLog(`Rejected: ${label}`);
    }
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
      setStatus("Load or enqueue audio before playing it.");
      return;
    }

    try {
      await getAudioEngine().playAudio(audioBufferRef.current);

      setStatus("Audio is playing through the analyser.");
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unknown audio playback error.";

      setStatus(message);
    }
  };

  const handleStopAudio = (): void => {
    getAudioEngine().stopActiveSource();

    setStatus("Active audio source stopped and disconnected.");
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

  const handleSingleTrackTest = (): void => {
    setQueueLog([]);

    addQueueLog("Enqueued: Track A");

    void enqueueTrack("Track A", TRACK_A_URL);
  };

  const handleFifoTest = (): void => {
    setQueueLog([]);

    addQueueLog("Enqueued: Track A");
    addQueueLog("Enqueued: Track B");
    addQueueLog("Enqueued: Track C");

    void enqueueTrack("Track A", TRACK_A_URL);
    void enqueueTrack("Track B", TRACK_B_URL);
    void enqueueTrack("Track C", TRACK_C_URL);
  };

  const handleErrorRecoveryTest = (): void => {
    setQueueLog([]);

    addQueueLog("Enqueued: Invalid Track A");
    addQueueLog("Enqueued: Track B");

    void enqueueTrack("Invalid Track A", INVALID_TRACK_URL);
    void enqueueTrack("Track B", TRACK_B_URL);
  };

  const handleCancelActive = (): void => {
    getAudioQueue().cancelActive();

    addQueueLog("Cancel requested for active task");
  };

  const handleCancellationTest = (): void => {
    setQueueLog([]);

    addQueueLog("Enqueued: Track A");
    addQueueLog("Enqueued: Track B");

    void enqueueTrack("Track A", TRACK_A_URL);
    void enqueueTrack("Track B", TRACK_B_URL);

    getAudioQueue().cancelActive();

    addQueueLog("Cancel requested for active task");
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
            onClick={handleStopAudio}
            disabled={!isLoaded}
          >
            Stop Audio
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

        <section className="queue-section">
          <h2>FIFO Audio Task Queue</h2>

          <div className="controls">
            <button type="button" onClick={handleSingleTrackTest}>
              Enqueue Track A
            </button>

            <button type="button" onClick={handleFifoTest}>
              Enqueue A, B, C
            </button>

            <button type="button" onClick={handleErrorRecoveryTest}>
              Test Error Recovery
            </button>

            <button type="button" onClick={handleCancelActive}>
              Cancel Active Task
            </button>

            <button type="button" onClick={handleCancellationTest}>
              Test Active Cancellation
            </button>
          </div>

          <section className="queue-log">
            <h3>Queue Test Log</h3>

            {queueLog.length === 0 ? (
              <p>No queue test has been started.</p>
            ) : (
              <ol>
                {queueLog.map((message, index) => (
                  <li key={`${message}-${index}`}>{message}</li>
                ))}
              </ol>
            )}
          </section>
        </section>
      </section>
    </main>
  );
}

export default App;