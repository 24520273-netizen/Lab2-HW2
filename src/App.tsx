import { useRef, useState } from "react";
import "./App.css";
import { AudioEngine } from "./audio/audio-engine";
import { AudioTaskQueue } from "./audio/audio-task-queue";
import { AudioVisualizer } from "./components/AudioVisualizer";

const SAMPLE_TRACK_URL = "/sample.mp3";

const TRACK_A_URL = "/sample.mp3?track=A";
const TRACK_B_URL = "/sample.mp3?track=B";
const TRACK_C_URL = "/sample.mp3?track=C";

const INVALID_TRACK_URL = "/missing-track.mp3";

function App() {
  const [audioEngine] = useState(
    () => new AudioEngine()
  );

  const audioQueueRef =
    useRef<AudioTaskQueue | null>(null);

  const audioBufferRef =
    useRef<AudioBuffer | null>(null);

  const manualPlaybackControllerRef =
    useRef<AbortController | null>(null);

  const [status, setStatus] = useState(
    "Audio is not loaded."
  );

  const [frequencyPreview, setFrequencyPreview] =
    useState<number[]>([]);

  const [isLoaded, setIsLoaded] =
    useState(false);

  const [queueLog, setQueueLog] =
    useState<string[]>([]);

  const [currentTrack, setCurrentTrack] =
    useState("None");

  const [
    isVisualizerActive,
    setIsVisualizerActive,
  ] = useState(false);

  const [isManualPlaying, setIsManualPlaying] =
    useState(false);

  const getTrackLabel = (
    trackUrl: string
  ): string => {
    if (trackUrl.includes("track=A")) {
      return "Track A";
    }

    if (trackUrl.includes("track=B")) {
      return "Track B";
    }

    if (trackUrl.includes("track=C")) {
      return "Track C";
    }

    if (trackUrl.includes("missing-track")) {
      return "Invalid Track";
    }

    return "Sample Audio";
  };

  const getAudioQueue = (): AudioTaskQueue => {
    if (!audioQueueRef.current) {
      audioQueueRef.current =
        new AudioTaskQueue(audioEngine, {
          onPlaybackStart: (trackUrl) => {
            setCurrentTrack(
              getTrackLabel(trackUrl)
            );

            setIsVisualizerActive(true);

            setStatus(
              `Playing ${getTrackLabel(trackUrl)} through the analyser.`
            );
          },

          onPlaybackEnd: () => {
            setIsVisualizerActive(false);
            setCurrentTrack("None");
          },
        });
    }

    return audioQueueRef.current;
  };

  const addQueueLog = (
    message: string
  ): void => {
    setQueueLog((currentLog) => [
      ...currentLog,
      message,
    ]);
  };

  const isAbortError = (
    error: unknown
  ): boolean => {
    return (
      error instanceof DOMException &&
      error.name === "AbortError"
    );
  };

  const enqueueTrack = async (
    label: string,
    trackUrl: string
  ): Promise<void> => {
    try {
      const audioBuffer =
        await getAudioQueue().enqueue(trackUrl);

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

  const handleLoadAudio =
    async (): Promise<void> => {
      try {
        setStatus("Loading audio...");

        const audioBuffer =
          await audioEngine.loadAudio(
            SAMPLE_TRACK_URL
          );

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

  const handlePlayAudio =
    async (): Promise<void> => {
      if (!audioBufferRef.current) {
        setStatus(
          "Load or enqueue audio before playing it."
        );
        return;
      }

      if (manualPlaybackControllerRef.current) {
        manualPlaybackControllerRef.current.abort();
      }

      const controller =
        new AbortController();

      manualPlaybackControllerRef.current =
        controller;

      setCurrentTrack("Sample Audio");
      setIsVisualizerActive(true);
      setIsManualPlaying(true);

      setStatus(
        "Audio is playing through the analyser."
      );

      try {
        await audioEngine.playAudioAndWait(
          audioBufferRef.current,
          controller.signal
        );

        if (!controller.signal.aborted) {
          setStatus(
            "Audio playback completed."
          );
        }
      } catch (error) {
        if (isAbortError(error)) {
          setStatus(
            "Active audio source stopped and disconnected."
          );
        } else {
          const message =
            error instanceof Error
              ? error.message
              : "Unknown audio playback error.";

          setStatus(message);
        }
      } finally {
        if (
          manualPlaybackControllerRef.current ===
          controller
        ) {
          manualPlaybackControllerRef.current =
            null;

          setIsManualPlaying(false);
          setIsVisualizerActive(false);
          setCurrentTrack("None");
        }
      }
    };

  const handleStopAudio = (): void => {
    const controller =
      manualPlaybackControllerRef.current;

    if (controller) {
      controller.abort();
    } else {
      audioEngine.stopActiveSource();
    }

    setIsManualPlaying(false);
    setIsVisualizerActive(false);
    setCurrentTrack("None");

    setStatus(
      "Active audio source stopped and disconnected."
    );
  };

  const handleReadFrequencyData =
    (): void => {
      try {
        const frequencyData =
          audioEngine.getFrequencyData();

        const preview = Array.from(
          frequencyData.slice(0, 16)
        );

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

    void enqueueTrack(
      "Track A",
      TRACK_A_URL
    );
  };

  const handleFifoTest = (): void => {
    setQueueLog([]);

    addQueueLog("Enqueued: Track A");
    addQueueLog("Enqueued: Track B");
    addQueueLog("Enqueued: Track C");

    void enqueueTrack(
      "Track A",
      TRACK_A_URL
    );

    void enqueueTrack(
      "Track B",
      TRACK_B_URL
    );

    void enqueueTrack(
      "Track C",
      TRACK_C_URL
    );
  };

  const handleErrorRecoveryTest =
    (): void => {
      setQueueLog([]);

      addQueueLog(
        "Enqueued: Invalid Track A"
      );

      addQueueLog("Enqueued: Track B");

      void enqueueTrack(
        "Invalid Track A",
        INVALID_TRACK_URL
      );

      void enqueueTrack(
        "Track B",
        TRACK_B_URL
      );
    };

  const handleCancelActive = (): void => {
    getAudioQueue().cancelActive();

    addQueueLog(
      "Cancel requested for active task"
    );
  };

  const handleCancellationTest =
    (): void => {
      setQueueLog([]);

      addQueueLog("Enqueued: Track A");
      addQueueLog("Enqueued: Track B");

      void enqueueTrack(
        "Track A",
        TRACK_A_URL
      );

      void enqueueTrack(
        "Track B",
        TRACK_B_URL
      );

      getAudioQueue().cancelActive();

      addQueueLog(
        "Cancel requested for active task"
      );
    };

  return (
    <main className="app">
      <section className="audio-panel">
        <h1>
          Concurrent FIFO Audio Visualizer
        </h1>

        <p className="track-path">
          Audio source:{" "}
          <code>{SAMPLE_TRACK_URL}</code>
        </p>

        <section className="engine-section">
          <h2>Web Audio Engine</h2>

          <div className="controls">
            <button
              type="button"
              onClick={handleLoadAudio}
            >
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
              disabled={!isManualPlaying}
            >
              Stop Audio
            </button>

            <button
              type="button"
              onClick={
                handleReadFrequencyData
              }
              disabled={!isLoaded}
            >
              Read Frequency Data
            </button>
          </div>

          <p className="status">{status}</p>

          {frequencyPreview.length > 0 && (
            <section className="frequency-output">
              <h3>
                Frequency Data Preview
              </h3>

              <p>
                {frequencyPreview.join(", ")}
              </p>
            </section>
          )}
        </section>

        <section className="visualizer-section">
          <div className="visualizer-header">
            <h2>Audio Visualizer</h2>

            <p>
              Current Track:{" "}
              <strong>{currentTrack}</strong>
            </p>
          </div>

          <AudioVisualizer
            audioEngine={audioEngine}
            isActive={isVisualizerActive}
          />
        </section>

        <section className="queue-section">
          <h2>FIFO Audio Task Queue</h2>

          <div className="controls">
            <button
              type="button"
              onClick={
                handleSingleTrackTest
              }
            >
              Enqueue Track A
            </button>

            <button
              type="button"
              onClick={handleFifoTest}
            >
              Enqueue A, B, C
            </button>

            <button
              type="button"
              onClick={
                handleErrorRecoveryTest
              }
            >
              Test Error Recovery
            </button>

            <button
              type="button"
              onClick={
                handleCancelActive
              }
            >
              Cancel Active Task
            </button>

            <button
              type="button"
              onClick={
                handleCancellationTest
              }
            >
              Test Active Cancellation
            </button>
          </div>

          <section className="queue-log">
            <h3>Queue Test Log</h3>

            {queueLog.length === 0 ? (
              <p>
                No queue test has been
                started.
              </p>
            ) : (
              <ol>
                {queueLog.map(
                  (message, index) => (
                    <li
                      key={`${message}-${index}`}
                    >
                      {message}
                    </li>
                  )
                )}
              </ol>
            )}
          </section>
        </section>
      </section>
    </main>
  );
}

export default App;