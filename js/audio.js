/**
 * Toronto Skyline Audio Visualizer - Audio Processing Engine
 * Web Audio API Analyzer, Media Element Source, Mic Input & Beat Detection
 */

class AudioEngine {
  constructor() {
    this.audioCtx = null;
    this.analyser = null;
    this.gainNode = null;
    this.sourceNode = null;
    this.micStream = null;
    this.micSourceNode = null;
    this.audioElement = document.getElementById('audio-player');

    // Audio Analysis State
    this.fftSize = 1024;
    this.frequencyData = new Uint8Array(this.fftSize / 2);
    this.timeDomainData = new Uint8Array(this.fftSize / 2);
    this.smoothedFrequencyData = new Float32Array(this.fftSize / 2);

    // Audio Bands (0.0 - 1.0)
    this.bands = {
      sub: 0,
      bass: 0,
      lowMid: 0,
      mid: 0,
      highMid: 0,
      treble: 0,
      energy: 0
    };

    // Beat Detection
    this.beatThreshold = 0.25;
    this.beatDecayRate = 0.95;
    this.beatCutoff = 0.15;
    this.beatImpact = 0; // 0.0 to 1.0 flash/shockwave power
    this.isBeat = false;
    this.lastBeatTime = 0;
    this.bpm = 144;

    // Track Metadata
    this.currentTrack = {
      title: 'Toronto Cyber Metal (Gemini Demo)',
      artist: 'Gemini Heavy Metal Synthesizer',
      isDemo: true,
      isMic: false
    };

    this.isPlaying = false;
    this.isInitialized = false;

    this.initAudioElement();
  }

  /**
   * Ensure AudioContext is active on user interaction
   */
  async ensureContext() {
    if (!this.audioCtx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      this.audioCtx = new AudioContextClass();

      this.analyser = this.audioCtx.createAnalyser();
      this.analyser.fftSize = this.fftSize;
      this.analyser.smoothingTimeConstant = 0.78;

      this.gainNode = this.audioCtx.createGain();
      this.gainNode.gain.value = parseFloat(document.getElementById('volume-slider')?.value || 0.85);

      // Connect source to analyser and output
      this.sourceNode = this.audioCtx.createMediaElementSource(this.audioElement);
      this.sourceNode.connect(this.gainNode);
      this.gainNode.connect(this.analyser);
      this.analyser.connect(this.audioCtx.destination);

      this.isInitialized = true;
    }

    if (this.audioCtx.state === 'suspended') {
      await this.audioCtx.resume();
    }
  }

  initAudioElement() {
    this.audioElement.src = 'assets/demo_track.wav';
    this.audioElement.loop = true;

    this.audioElement.addEventListener('play', () => {
      this.isPlaying = true;
      window.dispatchEvent(new CustomEvent('audio-play-state', { detail: { isPlaying: true } }));
    });

    this.audioElement.addEventListener('pause', () => {
      this.isPlaying = false;
      window.dispatchEvent(new CustomEvent('audio-play-state', { detail: { isPlaying: false } }));
    });

    this.audioElement.addEventListener('ended', () => {
      this.isPlaying = false;
      window.dispatchEvent(new CustomEvent('audio-play-state', { detail: { isPlaying: false } }));
    });

    this.audioElement.addEventListener('timeupdate', () => {
      window.dispatchEvent(new CustomEvent('audio-time-update', {
        detail: {
          currentTime: this.audioElement.currentTime,
          duration: this.audioElement.duration || 30
        }
      }));
    });
  }

  /**
   * Load and play the demo audio track
   */
  async loadDemoTrack() {
    await this.ensureContext();
    this.stopMic();

    this.currentTrack = {
      title: 'Toronto Cyber Metal (Gemini Demo)',
      artist: 'Gemini Heavy Metal Synthesizer',
      isDemo: true,
      isMic: false
    };

    this.audioElement.src = 'assets/demo_track.wav';
    this.audioElement.load();
    await this.audioElement.play();
    window.dispatchEvent(new CustomEvent('track-changed', { detail: this.currentTrack }));
  }

  /**
   * Load user provided audio file
   */
  async loadUserFile(file) {
    if (!file) return;
    await this.ensureContext();
    this.stopMic();

    const fileUrl = URL.createObjectURL(file);
    const fileName = file.name.replace(/\.[^/.]+$/, '');

    this.currentTrack = {
      title: fileName,
      artist: 'User Upload',
      isDemo: false,
      isMic: false
    };

    this.audioElement.src = fileUrl;
    this.audioElement.load();
    await this.audioElement.play();
    window.dispatchEvent(new CustomEvent('track-changed', { detail: this.currentTrack }));
  }

  /**
   * Toggle Live Microphone listening mode
   */
  async toggleMic() {
    await this.ensureContext();

    if (this.currentTrack.isMic) {
      this.stopMic();
      await this.loadDemoTrack();
      return false;
    }

    try {
      this.audioElement.pause();
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      this.micStream = stream;
      this.micSourceNode = this.audioCtx.createMediaStreamSource(stream);
      this.micSourceNode.connect(this.analyser);

      this.currentTrack = {
        title: 'Live Microphone Input',
        artist: 'Ambient Audio Stream',
        isDemo: false,
        isMic: true
      };

      this.isPlaying = true;
      window.dispatchEvent(new CustomEvent('track-changed', { detail: this.currentTrack }));
      window.dispatchEvent(new CustomEvent('audio-play-state', { detail: { isPlaying: true } }));
      return true;
    } catch (err) {
      console.warn('Microphone access denied or error:', err);
      alert('Could not access microphone. Please check permissions.');
      return false;
    }
  }

  stopMic() {
    if (this.micStream) {
      this.micStream.getTracks().forEach(track => track.stop());
      this.micStream = null;
    }
    if (this.micSourceNode) {
      this.micSourceNode.disconnect();
      this.micSourceNode = null;
    }
  }

  async togglePlay() {
    await this.ensureContext();
    if (this.currentTrack.isMic) {
      this.stopMic();
      await this.loadDemoTrack();
      return;
    }

    if (this.audioElement.paused) {
      await this.audioElement.play();
    } else {
      this.audioElement.pause();
    }
  }

  seek(seconds) {
    if (this.audioElement && !this.currentTrack.isMic && isFinite(seconds)) {
      this.audioElement.currentTime = Math.max(0, Math.min(this.audioElement.duration || 32, seconds));
    }
  }

  setVolume(val) {
    if (this.gainNode) {
      this.gainNode.gain.value = Math.max(0, Math.min(1, val));
    }
    if (this.audioElement) {
      this.audioElement.volume = Math.max(0, Math.min(1, val));
    }
  }

  setSmoothing(val) {
    if (this.analyser) {
      this.analyser.smoothingTimeConstant = Math.max(0.1, Math.min(0.95, val));
    }
  }

  /**
   * Main per-frame analysis tick
   */
  update(sensitivity = 1.0) {
    if (!this.analyser) {
      // Idle / ambient mock decay
      this.beatImpact *= 0.92;
      return {
        frequencyData: this.frequencyData,
        smoothedData: this.smoothedFrequencyData,
        bands: this.bands,
        beatImpact: this.beatImpact,
        isBeat: false
      };
    }

    // Get Raw Frequency & Time Domain Data
    this.analyser.getByteFrequencyData(this.frequencyData);
    this.analyser.getByteTimeDomainData(this.timeDomainData);

    const binCount = this.frequencyData.length;
    const sampleRate = this.audioCtx.sampleRate || 44100;
    const hzPerBin = sampleRate / (binCount * 2);

    let subSum = 0, subCount = 0;
    let bassSum = 0, bassCount = 0;
    let lowMidSum = 0, lowMidCount = 0;
    let midSum = 0, midCount = 0;
    let highMidSum = 0, highMidCount = 0;
    let trebleSum = 0, trebleCount = 0;
    let totalEnergy = 0;

    // Process bins with sensitivity multiplier
    for (let i = 0; i < binCount; i++) {
      let rawVal = (this.frequencyData[i] / 255) * sensitivity;
      rawVal = Math.min(1.0, rawVal);

      // Exponential smoothing per bin
      this.smoothedFrequencyData[i] = (this.smoothedFrequencyData[i] * 0.4) + (rawVal * 0.6);

      const val = this.smoothedFrequencyData[i];
      const hz = i * hzPerBin;

      totalEnergy += val;

      if (hz >= 20 && hz < 60) { subSum += val; subCount++; }
      else if (hz >= 60 && hz < 250) { bassSum += val; bassCount++; }
      else if (hz >= 250 && hz < 500) { lowMidSum += val; lowMidCount++; }
      else if (hz >= 500 && hz < 2000) { midSum += val; midCount++; }
      else if (hz >= 2000 && hz < 6000) { highMidSum += val; highMidCount++; }
      else if (hz >= 6000) { trebleSum += val; trebleCount++; }
    }

    this.bands.sub = subCount ? (subSum / subCount) : 0;
    this.bands.bass = bassCount ? (bassSum / bassCount) : 0;
    this.bands.lowMid = lowMidCount ? (lowMidSum / lowMidCount) : 0;
    this.bands.mid = midCount ? (midSum / midCount) : 0;
    this.bands.highMid = highMidCount ? (highMidSum / highMidCount) : 0;
    this.bands.treble = trebleCount ? (trebleSum / trebleCount) : 0;
    this.bands.energy = binCount ? (totalEnergy / binCount) : 0;

    // Transient Beat Detection on Sub + Bass
    const bassEnergy = (this.bands.sub * 0.6 + this.bands.bass * 0.4);
    const now = performance.now();

    this.isBeat = false;
    if (bassEnergy > this.beatCutoff && bassEnergy > this.beatThreshold && (now - this.lastBeatTime) > 220) {
      this.isBeat = true;
      this.lastBeatTime = now;
      this.beatImpact = Math.min(1.0, (bassEnergy - this.beatCutoff) * 2.2);
      this.beatThreshold = bassEnergy * 1.05;
    } else {
      this.beatThreshold = Math.max(this.beatCutoff, this.beatThreshold * this.beatDecayRate);
      this.beatImpact *= 0.90; // Smooth decay
    }

    return {
      frequencyData: this.frequencyData,
      smoothedData: this.smoothedFrequencyData,
      bands: this.bands,
      beatImpact: this.beatImpact,
      isBeat: this.isBeat
    };
  }
}

window.AudioEngine = AudioEngine;
