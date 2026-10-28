import { AudioEngine } from "./audio-engine";

interface AudioTask {
  trackUrl: string;
  controller: AbortController;
  resolve: (buffer: AudioBuffer) => void;
  reject: (error: unknown) => void;
}

interface AudioTaskQueueCallbacks {
  onPlaybackStart?: (trackUrl: string) => void;
  onPlaybackEnd?: (trackUrl: string) => void;
}

export class AudioTaskQueue {
  private queue: AudioTask[] = [];
  private isProcessing = false;
  private activeController: AbortController | null = null;

  private readonly audioEngine: AudioEngine;
  private readonly callbacks: AudioTaskQueueCallbacks;

  constructor(
    audioEngine: AudioEngine,
    callbacks: AudioTaskQueueCallbacks = {}
  ) {
    this.audioEngine = audioEngine;
    this.callbacks = callbacks;
  }

  enqueue(trackUrl: string): Promise<AudioBuffer> {
    const controller = new AbortController();

    return new Promise<AudioBuffer>(
      (resolve, reject) => {
        this.queue.push({
          trackUrl,
          controller,
          resolve,
          reject,
        });

        void this.processNext();
      }
    );
  }

  cancelActive(): void {
    if (!this.activeController) {
      return;
    }

    this.activeController.abort();
  }

  private async processNext(): Promise<void> {
    if (this.isProcessing) {
      return;
    }

    this.isProcessing = true;

    try {
      while (this.queue.length > 0) {
        const task = this.queue.shift();

        if (!task) {
          break;
        }

        this.activeController = task.controller;

        let playbackStarted = false;

        console.log(
          `Processing: ${task.trackUrl}`
        );

        try {
          const audioBuffer =
            await this.audioEngine.loadAudio(
              task.trackUrl,
              task.controller.signal
            );

          this.callbacks.onPlaybackStart?.(
            task.trackUrl
          );

          playbackStarted = true;

          await this.audioEngine.playAudioAndWait(
            audioBuffer,
            task.controller.signal
          );

          console.log(
            `Completed: ${task.trackUrl}`
          );

          task.resolve(audioBuffer);
        } catch (error) {
          if (
            error instanceof DOMException &&
            error.name === "AbortError"
          ) {
            console.log(
              `Cancelled: ${task.trackUrl}`
            );
          } else {
            console.error(
              `Failed: ${task.trackUrl}`,
              error
            );
          }

          task.reject(error);
        } finally {
          if (playbackStarted) {
            this.callbacks.onPlaybackEnd?.(
              task.trackUrl
            );
          }

          if (
            this.activeController ===
            task.controller
          ) {
            this.activeController = null;
          }
        }
      }
    } finally {
      this.activeController = null;
      this.isProcessing = false;
    }
  }
}