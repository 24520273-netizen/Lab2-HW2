export class AudioEngine {
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private activeSource: AudioBufferSourceNode | null = null;

  private ensureInitialized(): void {
    if (this.audioContext && this.analyser) {
      return;
    }

    this.audioContext = new AudioContext();

    this.analyser = this.audioContext.createAnalyser();

    // fftSize = 512 produces 256 frequency bins.
    this.analyser.fftSize = 512;

    this.analyser.connect(this.audioContext.destination);
  }

  private createAbortError(): DOMException {
    return new DOMException(
      "Audio operation was cancelled.",
      "AbortError"
    );
  }

  private throwIfAborted(signal?: AbortSignal): void {
    if (signal?.aborted) {
      throw this.createAbortError();
    }
  }

  private isAbortError(error: unknown): boolean {
    return (
      error instanceof DOMException &&
      error.name === "AbortError"
    );
  }

  private safeDisconnect(
    source: AudioBufferSourceNode
  ): void {
    try {
      source.disconnect();
    } catch {
      // The source may already be disconnected.
    }
  }

  async loadAudio(
    trackUrl: string,
    signal?: AbortSignal
  ): Promise<AudioBuffer> {
    this.ensureInitialized();

    if (!this.audioContext) {
      throw new Error(
        "AudioContext could not be initialized."
      );
    }

    this.throwIfAborted(signal);

    let response: Response;

    try {
      response = await fetch(trackUrl, {
        signal,
      });
    } catch (error) {
      if (
        signal?.aborted ||
        this.isAbortError(error)
      ) {
        throw this.createAbortError();
      }

      throw new Error(
        `Failed to download audio from "${trackUrl}".`
      );
    }

    if (!response.ok) {
      throw new Error(
        `Failed to download audio: ${response.status} ${response.statusText}`
      );
    }

    this.throwIfAborted(signal);

    let arrayBuffer: ArrayBuffer;

    try {
      arrayBuffer = await response.arrayBuffer();
    } catch (error) {
      if (
        signal?.aborted ||
        this.isAbortError(error)
      ) {
        throw this.createAbortError();
      }

      throw new Error(
        "Failed to read the downloaded audio data."
      );
    }

    this.throwIfAborted(signal);

    let audioBuffer: AudioBuffer;

    try {
      audioBuffer =
        await this.audioContext.decodeAudioData(
          arrayBuffer
        );
    } catch (error) {
      if (
        signal?.aborted ||
        this.isAbortError(error)
      ) {
        throw this.createAbortError();
      }

      throw new Error(
        "Failed to decode the downloaded audio data."
      );
    }

    this.throwIfAborted(signal);

    return audioBuffer;
  }

  async playAudioAndWait(
    audioBuffer: AudioBuffer,
    signal?: AbortSignal
  ): Promise<void> {
    this.ensureInitialized();

    if (!this.audioContext || !this.analyser) {
      throw new Error(
        "Audio engine is not initialized."
      );
    }

    this.throwIfAborted(signal);

    if (this.audioContext.state === "suspended") {
      await this.audioContext.resume();
    }

    this.throwIfAborted(signal);

    this.stopActiveSource();

    const source =
      this.audioContext.createBufferSource();

    source.buffer = audioBuffer;
    source.connect(this.analyser);

    this.activeSource = source;

    return new Promise<void>((resolve, reject) => {
      let settled = false;

      const cleanup = (): void => {
        source.onended = null;

        if (signal) {
          signal.removeEventListener(
            "abort",
            handleAbort
          );
        }

        this.safeDisconnect(source);

        if (this.activeSource === source) {
          this.activeSource = null;
        }
      };

      const handleEnded = (): void => {
        if (settled) {
          return;
        }

        settled = true;
        cleanup();
        resolve();
      };

      const handleAbort = (): void => {
        if (settled) {
          return;
        }

        settled = true;

        source.onended = null;

        try {
          source.stop();
        } catch {
          // The source may already have stopped.
        }

        cleanup();
        reject(this.createAbortError());
      };

      source.onended = handleEnded;

      if (signal) {
        signal.addEventListener(
          "abort",
          handleAbort,
          { once: true }
        );
      }

      try {
        source.start();
      } catch (error) {
        settled = true;
        cleanup();
        reject(error);
      }
    });
  }

  stopActiveSource(): void {
    const source = this.activeSource;

    if (!source) {
      return;
    }

    try {
      source.stop();
    } catch {
      // The source may already have stopped.
    }

    this.safeDisconnect(source);
    this.activeSource = null;
  }

  fillFrequencyData(
    frequencyData: Uint8Array<ArrayBuffer>
  ): void {
    if (!this.analyser) {
      frequencyData.fill(0);
      return;
    }

    this.analyser.getByteFrequencyData(
      frequencyData
    );
  }

  getFrequencyData(): Uint8Array<ArrayBuffer> {
    if (!this.analyser) {
      throw new Error(
        "AnalyserNode is not initialized."
      );
    }

    const frequencyData = new Uint8Array(
      this.analyser.frequencyBinCount
    );

    this.fillFrequencyData(frequencyData);

    return frequencyData;
  }

  getFrequencyBinCount(): number {
    if (!this.analyser) {
      return 0;
    }

    return this.analyser.frequencyBinCount;
  }

  getFftSize(): number {
    if (!this.analyser) {
      return 0;
    }

    return this.analyser.fftSize;
  }
}