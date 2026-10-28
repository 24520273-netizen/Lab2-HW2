export class AudioEngine {
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;

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

  async loadAudio(
    trackUrl: string,
    signal?: AbortSignal
  ): Promise<AudioBuffer> {
    this.ensureInitialized();

    if (!this.audioContext) {
      throw new Error("AudioContext could not be initialized.");
    }

    let response: Response;

    try {
      response = await fetch(trackUrl, { signal });
    } catch {
      throw new Error(`Failed to download audio from "${trackUrl}".`);
    }

    if (!response.ok) {
      throw new Error(
        `Failed to download audio: ${response.status} ${response.statusText}`
      );
    }

    const arrayBuffer = await response.arrayBuffer();

    try {
      return await this.audioContext.decodeAudioData(arrayBuffer);
    } catch {
      throw new Error("Failed to decode the downloaded audio data.");
    }
  }

  async playAudio(audioBuffer: AudioBuffer): Promise<AudioBufferSourceNode> {
    this.ensureInitialized();

    if (!this.audioContext || !this.analyser) {
      throw new Error("Audio engine is not initialized.");
    }

    if (this.audioContext.state === "suspended") {
      await this.audioContext.resume();
    }

    const source = this.audioContext.createBufferSource();

    source.buffer = audioBuffer;

    source.connect(this.analyser);

    source.start();

    return source;
  }

  getFrequencyData(): Uint8Array {
    if (!this.analyser) {
      throw new Error("AnalyserNode is not initialized.");
    }

    const frequencyData = new Uint8Array(
      this.analyser.frequencyBinCount
    );

    this.analyser.getByteFrequencyData(frequencyData);

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