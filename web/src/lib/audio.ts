/**
 * NAVIC-TRACK JARVIS Voice Utilities
 * Handles microphone recording, real-time waveform analysis, 16-bit PCM WAV encoding,
 * Web Speech live recognition, and unified single-utterance audio playback.
 */

/**
 * Encodes Float32Array audio samples into standard 16-bit mono PCM WAV blob
 */
export function encodePcmWav(samples: Float32Array, sampleRate = 16000): Blob {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);

  // RIFF identifier
  writeString(view, 0, 'RIFF');
  // file length minus RIFF identifier and length description
  view.setUint32(4, 36 + samples.length * 2, true);
  // RIFF type
  writeString(view, 8, 'WAVE');
  // format chunk identifier
  writeString(view, 12, 'fmt ');
  // format chunk length
  view.setUint32(16, 16, true);
  // sample format (1 = PCM)
  view.setUint16(20, 1, true);
  // channel count (1 = mono)
  view.setUint16(22, 1, true);
  // sample rate
  view.setUint32(24, sampleRate, true);
  // byte rate (sampleRate * 1 * 2)
  view.setUint32(28, sampleRate * 2, true);
  // block align (channel count * bytes per sample)
  view.setUint16(32, 2, true);
  // bits per sample
  view.setUint16(34, 16, true);
  // data chunk identifier
  writeString(view, 36, 'data');
  // data chunk length
  view.setUint32(40, samples.length * 2, true);

  // Write PCM samples (clamp float to 16-bit integer)
  let offset = 44;
  for (let i = 0; i < samples.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }

  return new Blob([buffer], { type: 'audio/wav' });
}

function writeString(view: DataView, offset: number, string: string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

/**
 * Microphone Recorder with real-time audio level monitoring
 */
export class JarvisVoiceRecorder {
  private stream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private processor: ScriptProcessorNode | null = null;
  private analyser: AnalyserNode | null = null;
  private pcmChunks: Float32Array[] = [];
  private totalSamples = 0;
  private isRecording = false;
  private animFrameId: number | null = null;

  async start(
    onAudioLevel?: (level: number, frequencies: Uint8Array) => void
  ): Promise<void> {
    this.cleanup();

    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error('Microphone access is not supported by your browser.');
    }

    // Request high-quality speech audio
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      }
    });

    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    this.audioContext = new AudioContextClass();

    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }

    this.source = this.audioContext.createMediaStreamSource(this.stream);
    this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = 256;
    this.analyser.smoothingTimeConstant = 0.5;

    // Buffer size of 4096 gives reliable collection without audio stuttering
    this.processor = this.audioContext.createScriptProcessor(4096, 1, 1);
    this.pcmChunks = [];
    this.totalSamples = 0;
    this.isRecording = true;

    this.processor.onaudioprocess = (e) => {
      if (!this.isRecording) return;
      const inputData = e.inputBuffer.getChannelData(0);
      const copy = new Float32Array(inputData.length);
      copy.set(inputData);
      this.pcmChunks.push(copy);
      this.totalSamples += copy.length;
    };

    this.source.connect(this.analyser);
    this.analyser.connect(this.processor);
    this.processor.connect(this.audioContext.destination);

    // Level & Frequency monitor loop
    if (onAudioLevel && this.analyser) {
      const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
      const updateLevel = () => {
        if (!this.isRecording || !this.analyser) return;
        this.analyser.getByteFrequencyData(dataArray);

        // Compute average volume level (0.0 to 1.0)
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const avg = sum / dataArray.length / 255;
        onAudioLevel(avg, dataArray);
        this.animFrameId = requestAnimationFrame(updateLevel);
      };
      this.animFrameId = requestAnimationFrame(updateLevel);
    }
  }

  async stop(): Promise<{ blob: Blob; duration: number }> {
    this.isRecording = false;

    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }

    const currentContext = this.audioContext;
    const sampleRate = currentContext?.sampleRate || 16000;

    // Merge chunks
    const mergedSamples = new Float32Array(this.totalSamples);
    let offset = 0;
    for (const chunk of this.pcmChunks) {
      mergedSamples.set(chunk, offset);
      offset += chunk.length;
    }

    // Downsample to 16000 Hz if recorded at 44.1kHz or 48kHz for optimal speech recognition
    const targetSampleRate = 16000;
    const downsampled = downsampleBuffer(mergedSamples, sampleRate, targetSampleRate);
    const wavBlob = encodePcmWav(downsampled, targetSampleRate);
    const duration = mergedSamples.length / sampleRate;

    this.cleanup();
    return { blob: wavBlob, duration };
  }

  cleanup(): void {
    this.isRecording = false;
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    if (this.processor) {
      this.processor.disconnect();
      this.processor.onaudioprocess = null;
      this.processor = null;
    }
    if (this.analyser) {
      this.analyser.disconnect();
      this.analyser = null;
    }
    if (this.source) {
      this.source.disconnect();
      this.source = null;
    }
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close().catch(() => {});
      this.audioContext = null;
    }
    this.pcmChunks = [];
    this.totalSamples = 0;
  }
}

/**
 * Resamples audio buffer to target sample rate using linear interpolation
 */
function downsampleBuffer(
  buffer: Float32Array,
  inputRate: number,
  outputRate: number
): Float32Array {
  if (inputRate === outputRate) return buffer;
  const ratio = inputRate / outputRate;
  const newLength = Math.round(buffer.length / ratio);
  const result = new Float32Array(newLength);
  let offsetResult = 0;
  let offsetBuffer = 0;

  while (offsetResult < result.length) {
    const nextOffsetBuffer = Math.round((offsetResult + 1) * ratio);
    let accum = 0;
    let count = 0;
    for (let i = offsetBuffer; i < nextOffsetBuffer && i < buffer.length; i++) {
      accum += buffer[i];
      count++;
    }
    result[offsetResult] = count > 0 ? accum / count : 0;
    offsetResult++;
    offsetBuffer = nextOffsetBuffer;
  }
  return result;
}

/**
 * Singleton Voice Player ensuring exactly ONE assistant utterance at a time.
 * Prevents multiple voices speaking simultaneously and provides instant interruption.
 */
class JarvisAudioPlayer {
  private audioElement: HTMLAudioElement | null = null;
  private currentObjectUrl: string | null = null;
  private isSpeaking = false;
  private muted = false;
  private currentOnEnd: (() => void) | null = null;

  play(
    audioBlob: Blob,
    onStart?: () => void,
    onEnded?: () => void,
    onError?: (err: any) => void
  ): void {
    this.stop();

    if (this.muted) {
      onEnded?.();
      return;
    }

    try {
      this.currentObjectUrl = URL.createObjectURL(audioBlob);
      this.audioElement = new Audio(this.currentObjectUrl);
      this.currentOnEnd = onEnded || null;

      this.audioElement.onplay = () => {
        this.isSpeaking = true;
        onStart?.();
      };

      this.audioElement.onended = () => {
        this.cleanup();
        onEnded?.();
      };

      this.audioElement.onerror = (e) => {
        this.cleanup();
        onError?.(e);
      };

      this.audioElement.play().catch((err) => {
        this.cleanup();
        onError?.(err);
      });
    } catch (err) {
      this.cleanup();
      onError?.(err);
    }
  }

  /**
   * Browser SpeechSynthesis fallback if network TTS audio is unavailable
   */
  speakWithBrowser(text: string, onStart?: () => void, onEnded?: () => void): void {
    this.stop();
    if (typeof window === 'undefined' || !window.speechSynthesis || this.muted) {
      onEnded?.();
      return;
    }

    try {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.0;
      utterance.pitch = 0.95;

      // Select an English voice if available
      const voices = window.speechSynthesis.getVoices();
      const britishVoice = voices.find(
        (v) => v.lang.includes('en-GB') || v.name.includes('UK') || v.name.includes('George') || v.name.includes('Daniel')
      ) || voices.find((v) => v.lang.startsWith('en'));

      if (britishVoice) {
        utterance.voice = britishVoice;
      }

      utterance.onstart = () => {
        this.isSpeaking = true;
        onStart?.();
      };

      utterance.onend = () => {
        this.isSpeaking = false;
        onEnded?.();
      };

      utterance.onerror = () => {
        this.isSpeaking = false;
        onEnded?.();
      };

      window.speechSynthesis.speak(utterance);
    } catch (err) {
      this.isSpeaking = false;
      onEnded?.();
    }
  }

  stop(): void {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }

    if (this.audioElement) {
      this.audioElement.onended = null;
      this.audioElement.onerror = null;
      this.audioElement.pause();
      this.audioElement.src = '';
      this.audioElement = null;
    }

    if (this.currentObjectUrl) {
      URL.revokeObjectURL(this.currentObjectUrl);
      this.currentObjectUrl = null;
    }

    if (this.isSpeaking && this.currentOnEnd) {
      const callback = this.currentOnEnd;
      this.currentOnEnd = null;
      callback();
    }

    this.isSpeaking = false;
  }

  pause(): void {
    if (this.audioElement && !this.audioElement.paused) {
      this.audioElement.pause();
    }
  }

  resume(): void {
    if (this.audioElement && this.audioElement.paused) {
      this.audioElement.play().catch(() => {});
    }
  }

  getIsSpeaking(): boolean {
    return this.isSpeaking;
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (muted) {
      this.stop();
    }
  }

  getIsMuted(): boolean {
    return this.muted;
  }

  private cleanup(): void {
    this.isSpeaking = false;
    this.currentOnEnd = null;
    if (this.currentObjectUrl) {
      URL.revokeObjectURL(this.currentObjectUrl);
      this.currentObjectUrl = null;
    }
    this.audioElement = null;
  }
}

export const jarvisVoicePlayer = new JarvisAudioPlayer();

/**
 * Creates live browser speech recognizer for zero-latency instant transcript
 */
export function createSpeechRecognizer(
  onInterim: (text: string) => void,
  onFinal: (text: string) => void,
  onError?: (err: string) => void
): { start: () => void; stop: () => void; isSupported: boolean } {
  if (typeof window === 'undefined') {
    return { start: () => {}, stop: () => {}, isSupported: false };
  }

  const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  if (!SpeechRec) {
    return { start: () => {}, stop: () => {}, isSupported: false };
  }

  const recognition = new SpeechRec();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = 'en-US';

  recognition.onresult = (event: any) => {
    let interim = '';
    let final = '';

    for (let i = event.resultIndex; i < event.results.length; ++i) {
      const transcript = event.results[i][0].transcript;
      if (event.results[i].isFinal) {
        final += transcript;
      } else {
        interim += transcript;
      }
    }

    if (final) onFinal(final);
    if (interim) onInterim(interim);
  };

  recognition.onerror = (e: any) => {
    if (e.error !== 'no-speech' && e.error !== 'aborted') {
      onError?.(e.error);
    }
  };

  return {
    start: () => {
      try {
        recognition.start();
      } catch {
        // Already active
      }
    },
    stop: () => {
      try {
        recognition.stop();
      } catch {
        // Ignored
      }
    },
    isSupported: true
  };
}

