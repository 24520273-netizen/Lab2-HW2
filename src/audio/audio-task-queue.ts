import { AudioEngine } from "./audio-engine";

interface AudioTask {
  trackUrl: string;
  controller: AbortController;
  resolve: (buffer: AudioBuffer) => void;
  reject: (error: unknown) => void;
}

export class AudioTaskQueue {
  private queue: AudioTask[] = [];
  private isProcessing = false;
  private activeController: AbortController | null = null;
  private readonly audioEngine: AudioEngine;

  constructor(audioEngine: AudioEngine) {
    this.audioEngine = audioEngine;
  }

  enqueue(trackUrl: string): Promise<AudioBuffer> {
    const controller = new AbortController();

    return new Promise<AudioBuffer>((resolve, reject) => {
      this.queue.push({
        trackUrl,
        controller,
        resolve,
        reject,
      });

      void this.processNext();
    });
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

        console.log(`Processing: ${task.trackUrl}`);

        try {
          const audioBuffer = await this.audioEngine.loadAudio(
            task.trackUrl,
            task.controller.signal
          );

          console.log(`Completed: ${task.trackUrl}`);

          task.resolve(audioBuffer);
        } catch (error) {
          if (
            error instanceof DOMException &&
            error.name === "AbortError"
          ) {
            console.log(`Cancelled: ${task.trackUrl}`);
          } else {
            console.error(`Failed: ${task.trackUrl}`, error);
          }

          task.reject(error);
        } finally {
          if (this.activeController === task.controller) {
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