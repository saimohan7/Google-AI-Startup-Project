const fs = require('fs');
const path = require('path');

// Audio parameters
const SAMPLE_RATE = 44100;
const NUM_CHANNELS = 2;
const BPM = 120;
const BEAT_DURATION = 60 / BPM; // 0.5s per beat
const NUM_BARS = 16; // 16 bars = 64 beats = 32 seconds
const TOTAL_DURATION = (64 * BEAT_DURATION);
const TOTAL_SAMPLES = Math.floor(TOTAL_DURATION * SAMPLE_RATE);

console.log(`Generating Demo Synthwave Track: ${TOTAL_DURATION}s @ ${SAMPLE_RATE}Hz stereo...`);

// Buffer allocation for stereo floats
const leftBuffer = new Float32Array(TOTAL_SAMPLES);
const rightBuffer = new Float32Array(TOTAL_SAMPLES);

// Note frequencies (Hz)
const NOTES = {
  A1: 55.00, C2: 65.41, D2: 73.42, E2: 82.41, F2: 87.31, G2: 97.99,
  A2: 110.00, C3: 130.81, D3: 146.83, E3: 164.81, F3: 174.61, G3: 196.00,
  A3: 220.00, B3: 246.94, C4: 261.63, D4: 293.66, E4: 329.63, F4: 349.23, G4: 392.00,
  A4: 440.00, B4: 493.88, C5: 523.25, D5: 587.33, E5: 659.25, F5: 698.46, G5: 783.99, A5: 880.00
};

// Chord progressions (4 bars each: Am -> F -> C -> G)
const CHORDS = [
  { root: NOTES.A2, notes: [NOTES.A3, NOTES.C4, NOTES.E4, NOTES.A4], bass: NOTES.A1 },
  { root: NOTES.F2, notes: [NOTES.F3, NOTES.A3, NOTES.C4, NOTES.F4], bass: NOTES.F2 / 2 },
  { root: NOTES.C3, notes: [NOTES.C4, NOTES.E4, NOTES.G4, NOTES.C5], bass: NOTES.C2 },
  { root: NOTES.G2, notes: [NOTES.G3, NOTES.B3, NOTES.D4, NOTES.G4], bass: NOTES.G2 / 2 }
];

// Synth oscillators
function oscSaw(phase) {
  return 2 * (phase - Math.floor(phase + 0.5));
}
function oscSquare(phase) {
  return Math.sin(phase * 2 * Math.PI) >= 0 ? 0.7 : -0.7;
}
function oscSine(phase) {
  return Math.sin(phase * 2 * Math.PI);
}

// 1. Render Drums (Kick, Snare, HiHats)
for (let beat = 0; beat < 64; beat++) {
  const beatStartTime = beat * BEAT_DURATION;
  const startSample = Math.floor(beatStartTime * SAMPLE_RATE);

  // Four-on-the-floor Kick
  const kickDuration = 0.35;
  const kickSamples = Math.floor(kickDuration * SAMPLE_RATE);
  for (let i = 0; i < kickSamples && (startSample + i) < TOTAL_SAMPLES; i++) {
    const t = i / SAMPLE_RATE;
    const progress = i / kickSamples;
    const env = Math.exp(-progress * 9);
    // Pitch envelope: 150Hz drop to 40Hz
    const freq = 40 + 110 * Math.exp(-progress * 24);
    const kickVal = oscSine(freq * t) * env * 0.85;
    // Click transient
    const click = (Math.random() * 2 - 1) * Math.exp(-progress * 70) * 0.3;
    leftBuffer[startSample + i] += (kickVal + click);
    rightBuffer[startSample + i] += (kickVal + click);
  }

  // Snare on beats 2 and 4 (beat index 1, 3, 5, 7...)
  if (beat % 2 === 1) {
    const snareDuration = 0.28;
    const snareSamples = Math.floor(snareDuration * SAMPLE_RATE);
    for (let i = 0; i < snareSamples && (startSample + i) < TOTAL_SAMPLES; i++) {
      const t = i / SAMPLE_RATE;
      const progress = i / snareSamples;
      const env = Math.exp(-progress * 11);
      const noise = (Math.random() * 2 - 1) * env * 0.6;
      const tone = oscSine(190 * t) * Math.exp(-progress * 16) * 0.4;
      leftBuffer[startSample + i] += (noise + tone) * 0.7;
      rightBuffer[startSample + i] += (noise + tone) * 0.7;
    }
  }

  // 16th note Hi-Hats (4 per beat)
  for (let sixteenth = 0; sixteenth < 4; sixteenth++) {
    const hatTime = beatStartTime + (sixteenth * BEAT_DURATION / 4);
    const hatStart = Math.floor(hatTime * SAMPLE_RATE);
    const isOffbeat = (sixteenth === 2);
    const hatDuration = isOffbeat ? 0.08 : 0.04;
    const hatSamples = Math.floor(hatDuration * SAMPLE_RATE);
    const hatVolume = isOffbeat ? 0.35 : 0.18;

    for (let i = 0; i < hatSamples && (hatStart + i) < TOTAL_SAMPLES; i++) {
      const progress = i / hatSamples;
      const env = Math.exp(-progress * 22);
      const noise = (Math.random() * 2 - 1) * env * hatVolume;
      leftBuffer[hatStart + i] += noise * 0.8;
      rightBuffer[hatStart + i] += noise * 0.8;
    }
  }
}

// 2. Render Bassline (Rolling 16th-note synth bass)
for (let sixteenth = 0; sixteenth < 64 * 4; sixteenth++) {
  const bar = Math.floor(sixteenth / 16);
  const chordIdx = bar % 4;
  const chord = CHORDS[chordIdx];
  const time = sixteenth * (BEAT_DURATION / 4);
  const startSample = Math.floor(time * SAMPLE_RATE);
  const noteDuration = (BEAT_DURATION / 4) * 0.9;
  const noteSamples = Math.floor(noteDuration * SAMPLE_RATE);

  // Bass pattern: root note with octaves
  const isOctave = (sixteenth % 4 === 2 || sixteenth % 8 === 6);
  const baseFreq = isOctave ? chord.bass * 2 : chord.bass;

  for (let i = 0; i < noteSamples && (startSample + i) < TOTAL_SAMPLES; i++) {
    const t = i / SAMPLE_RATE;
    const progress = i / noteSamples;
    const env = Math.exp(-progress * 5.5);
    const osc1 = oscSaw(baseFreq * t);
    const osc2 = oscSquare((baseFreq * 1.004) * t) * 0.7;
    const sub = oscSine((baseFreq / 2) * t) * 0.5;
    const bassVal = (osc1 + osc2 + sub) * env * 0.35;

    leftBuffer[startSample + i] += bassVal;
    rightBuffer[startSample + i] += bassVal;
  }
}

// 3. Render Arp & Chords
for (let sixteenth = 0; sixteenth < 64 * 4; sixteenth++) {
  const bar = Math.floor(sixteenth / 16);
  const chordIdx = bar % 4;
  const chord = CHORDS[chordIdx];
  const time = sixteenth * (BEAT_DURATION / 4);
  const startSample = Math.floor(time * SAMPLE_RATE);
  const arpNoteIdx = (sixteenth % 4);
  const freq = chord.notes[arpNoteIdx];
  const arpDuration = (BEAT_DURATION / 4) * 1.5;
  const arpSamples = Math.floor(arpDuration * SAMPLE_RATE);

  const pan = Math.sin(sixteenth * 0.5) * 0.4; // Stereo panning

  for (let i = 0; i < arpSamples && (startSample + i) < TOTAL_SAMPLES; i++) {
    const t = i / SAMPLE_RATE;
    const progress = i / arpSamples;
    const env = Math.exp(-progress * 6.0);
    const oscA = oscSaw(freq * t);
    const oscB = oscSaw((freq * 1.006) * t);
    const val = (oscA + oscB) * env * 0.16;

    leftBuffer[startSample + i] += val * (0.5 - pan);
    rightBuffer[startSample + i] += val * (0.5 + pan);
  }
}

// 4. Render Lead Cyber Melody
const MELODY = [
  // Bar 1-4 (Am -> F -> C -> G)
  { note: NOTES.E5, beats: 1.5 }, { note: NOTES.C5, beats: 0.5 }, { note: NOTES.D5, beats: 1.0 }, { note: NOTES.E5, beats: 1.0 },
  { note: NOTES.F5, beats: 2.0 }, { note: NOTES.E5, beats: 1.0 }, { note: NOTES.D5, beats: 1.0 },
  { note: NOTES.G5, beats: 2.0 }, { note: NOTES.E5, beats: 1.0 }, { note: NOTES.C5, beats: 1.0 },
  { note: NOTES.D5, beats: 3.0 }, { note: null, beats: 1.0 },

  // Bar 5-8
  { note: NOTES.A5, beats: 1.5 }, { note: NOTES.G5, beats: 0.5 }, { note: NOTES.E5, beats: 1.0 }, { note: NOTES.D5, beats: 1.0 },
  { note: NOTES.C5, beats: 1.5 }, { note: NOTES.D5, beats: 0.5 }, { note: NOTES.E5, beats: 2.0 },
  { note: NOTES.G5, beats: 2.0 }, { note: NOTES.A5, beats: 2.0 },
  { note: NOTES.E5, beats: 3.0 }, { note: null, beats: 1.0 },

  // Repeat bars 9-16 (energy up)
  { note: NOTES.E5, beats: 1.5 }, { note: NOTES.C5, beats: 0.5 }, { note: NOTES.D5, beats: 1.0 }, { note: NOTES.E5, beats: 1.0 },
  { note: NOTES.F5, beats: 2.0 }, { note: NOTES.E5, beats: 1.0 }, { note: NOTES.D5, beats: 1.0 },
  { note: NOTES.G5, beats: 2.0 }, { note: NOTES.E5, beats: 1.0 }, { note: NOTES.C5, beats: 1.0 },
  { note: NOTES.D5, beats: 3.0 }, { note: null, beats: 1.0 },

  { note: NOTES.A5, beats: 1.5 }, { note: NOTES.G5, beats: 0.5 }, { note: NOTES.E5, beats: 1.0 }, { note: NOTES.D5, beats: 1.0 },
  { note: NOTES.C5, beats: 1.5 }, { note: NOTES.D5, beats: 0.5 }, { note: NOTES.E5, beats: 2.0 },
  { note: NOTES.G5, beats: 2.0 }, { note: NOTES.A5, beats: 2.0 },
  { note: NOTES.A5, beats: 4.0 }
];

let leadCurrentBeat = 0;
for (const phrase of MELODY) {
  const noteDuration = phrase.beats * BEAT_DURATION;
  if (phrase.note) {
    const startSample = Math.floor(leadCurrentBeat * BEAT_DURATION * SAMPLE_RATE);
    const noteSamples = Math.floor(noteDuration * SAMPLE_RATE);

    for (let i = 0; i < noteSamples && (startSample + i) < TOTAL_SAMPLES; i++) {
      const t = i / SAMPLE_RATE;
      const progress = i / noteSamples;
      // Vibrato
      const vibrato = Math.sin(t * 35) * (t > 0.3 ? 4 : 0);
      const freq = phrase.note + vibrato;
      const env = Math.sin(Math.PI * Math.pow(progress, 0.4)) * Math.exp(-progress * 0.8);

      const osc1 = oscSquare(freq * t);
      const osc2 = oscSaw((freq * 1.008) * t) * 0.6;
      const leadVal = (osc1 + osc2) * env * 0.22;

      // Echo / delay effect
      leftBuffer[startSample + i] += leadVal * 0.6;
      rightBuffer[startSample + i] += leadVal * 0.6;

      const delaySamples = Math.floor(0.25 * SAMPLE_RATE); // 8th note delay
      if (startSample + i + delaySamples < TOTAL_SAMPLES) {
        leftBuffer[startSample + i + delaySamples] += leadVal * 0.25;
        rightBuffer[startSample + i + delaySamples] += leadVal * 0.35;
      }
    }
  }
  leadCurrentBeat += phrase.beats;
}

// 5. Master Limiter & Normalization
let maxPeak = 0;
for (let i = 0; i < TOTAL_SAMPLES; i++) {
  if (Math.abs(leftBuffer[i]) > maxPeak) maxPeak = Math.abs(leftBuffer[i]);
  if (Math.abs(rightBuffer[i]) > maxPeak) maxPeak = Math.abs(rightBuffer[i]);
}

const targetPeak = 0.92;
const gain = maxPeak > 0 ? (targetPeak / maxPeak) : 1;
console.log(`Peak detected: ${maxPeak.toFixed(2)}. Applying master gain: ${gain.toFixed(2)}`);

// Encode 16-bit PCM WAV File
const wavDataSize = TOTAL_SAMPLES * NUM_CHANNELS * 2;
const buffer = Buffer.alloc(44 + wavDataSize);

// RIFF Header
buffer.write('RIFF', 0);
buffer.writeUInt32LE(36 + wavDataSize, 4);
buffer.write('WAVE', 8);

// fmt chunk
buffer.write('fmt ', 12);
buffer.writeUInt32LE(16, 16); // Subchunk1Size
buffer.writeUInt16LE(1, 20);  // AudioFormat (PCM)
buffer.writeUInt16LE(NUM_CHANNELS, 22);
buffer.writeUInt32LE(SAMPLE_RATE, 24);
buffer.writeUInt32LE(SAMPLE_RATE * NUM_CHANNELS * 2, 28); // ByteRate
buffer.writeUInt16LE(NUM_CHANNELS * 2, 32); // BlockAlign
buffer.writeUInt16LE(16, 34); // BitsPerSample

// data chunk
buffer.write('data', 36);
buffer.writeUInt32LE(wavDataSize, 40);

// Write interleaved 16-bit PCM samples
let offset = 44;
for (let i = 0; i < TOTAL_SAMPLES; i++) {
  let left = Math.max(-1, Math.min(1, leftBuffer[i] * gain));
  let right = Math.max(-1, Math.min(1, rightBuffer[i] * gain));

  const leftInt = left < 0 ? Math.floor(left * 32768) : Math.floor(left * 32767);
  const rightInt = right < 0 ? Math.floor(right * 32768) : Math.floor(right * 32767);

  buffer.writeInt16LE(leftInt, offset);
  buffer.writeInt16LE(rightInt, offset + 2);
  offset += 4;
}

const outputPath = path.join(__dirname, '../assets/demo_track.wav');
fs.writeFileSync(outputPath, buffer);
console.log(`Saved demo audio to ${outputPath} (${(buffer.length / (1024 * 1024)).toFixed(2)} MB)`);
