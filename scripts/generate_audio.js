const fs = require('fs');
const path = require('path');

// Audio parameters
const SAMPLE_RATE = 44100;
const NUM_CHANNELS = 2;
const BPM = 144; // Fast driving Heavy Metal tempo
const BEAT_DURATION = 60 / BPM; // ~0.4167s per beat
const NUM_BARS = 18;
const TOTAL_DURATION = NUM_BARS * 4 * BEAT_DURATION; // ~30.0s
const TOTAL_SAMPLES = Math.floor(TOTAL_DURATION * SAMPLE_RATE);

console.log(`Synthesizing Gemini Heavy Metal Track: ${TOTAL_DURATION.toFixed(1)}s @ ${SAMPLE_RATE}Hz (${BPM} BPM)...`);

const leftBuffer = new Float32Array(TOTAL_SAMPLES);
const rightBuffer = new Float32Array(TOTAL_SAMPLES);

// Note frequencies (Hz)
const NOTES = {
  E1: 41.20, F1: 43.65, G1: 49.00, A1: 55.00, B1: 61.74,
  C2: 65.41, D2: 73.42, E2: 82.41, F2: 87.31, G2: 98.00, A2: 110.00, B2: 123.47,
  C3: 130.81, D3: 146.83, E3: 164.81, F3: 174.61, G3: 196.00, A3: 220.00, B3: 246.94,
  C4: 261.63, D4: 293.66, E4: 329.63, F4: 349.23, G4: 392.00, A4: 440.00, B4: 493.88,
  C5: 523.25, D5: 587.33, E5: 659.25, F5: 698.46, G5: 783.99, A5: 880.00, B5: 987.77,
  E6: 1318.51
};

// Power Chord Generator (Root, 5th, Octave)
function getPowerChord(rootNote) {
  const root = NOTES[rootNote] || 82.41;
  const fifth = root * 1.4983; // Perfect 5th
  const octave = root * 2.0;
  return [root, fifth, octave];
}

// Distortion & Tube Saturation Waveshaper
function metalDistort(x, drive = 5.0) {
  const v = x * drive;
  // Non-linear saturation + asymmetric soft clipping for tube amplifier grit
  return Math.tanh(v) * 0.7 + Math.tanh(v * 2.5) * 0.25 + (Math.sin(v) * 0.05);
}

// Oscillators
function oscSaw(phase) {
  return 2 * (phase - Math.floor(phase + 0.5));
}
function oscSquare(phase) {
  return Math.sin(phase * 2 * Math.PI) >= 0 ? 0.85 : -0.85;
}
function oscSine(phase) {
  return Math.sin(phase * 2 * Math.PI);
}
function oscTriangle(phase) {
  return 2 * Math.abs(2 * (phase - Math.floor(phase + 0.5))) - 1;
}

// -------------------------------------------------------------
// 1. DRUMS: Double-Bass Metal Blast, Snare Crack & Heavy Cymbals
// -------------------------------------------------------------
const totalBeats = NUM_BARS * 4;
for (let beat = 0; beat < totalBeats; beat++) {
  const beatTime = beat * BEAT_DURATION;
  const startSample = Math.floor(beatTime * SAMPLE_RATE);

  // Crash Cymbal on bar downbeats (beat 0, 16, 32, 48...)
  if (beat % 16 === 0) {
    const crashDuration = 1.4;
    const crashSamples = Math.floor(crashDuration * SAMPLE_RATE);
    for (let i = 0; i < crashSamples && (startSample + i) < TOTAL_SAMPLES; i++) {
      const progress = i / crashSamples;
      const env = Math.exp(-progress * 4.5);
      const noise = (Math.random() * 2 - 1) * env * 0.45;
      const metallic = Math.sin(i * 0.18) * Math.sin(i * 0.31) * env * 0.25;
      leftBuffer[startSample + i] += (noise + metallic) * 0.8;
      rightBuffer[startSample + i] += (noise + metallic) * 0.8;
    }
  }

  // Snare Rimshot / Metal Crack on beats 2 and 4 (beat index 1, 3, 5, 7...)
  if (beat % 2 === 1) {
    const snareDuration = 0.32;
    const snareSamples = Math.floor(snareDuration * SAMPLE_RATE);
    for (let i = 0; i < snareSamples && (startSample + i) < TOTAL_SAMPLES; i++) {
      const t = i / SAMPLE_RATE;
      const progress = i / snareSamples;
      const env = Math.exp(-progress * 13.0);
      const noise = (Math.random() * 2 - 1) * env * 0.75;
      const bodyTone = oscSine(220 * t) * Math.exp(-progress * 22) * 0.5;
      const punchTone = oscSine(340 * t) * Math.exp(-progress * 40) * 0.35;
      const snareVal = (noise + bodyTone + punchTone) * 0.85;

      leftBuffer[startSample + i] += snareVal;
      rightBuffer[startSample + i] += snareVal;
    }
  }

  // Double-Bass Kick Drums (16th-note rapid double-kicking)
  // Double-kick pattern: 4 kicks per beat
  for (let sixteenth = 0; sixteenth < 4; sixteenth++) {
    const kickTime = beatTime + (sixteenth * BEAT_DURATION / 4);
    const kickStart = Math.floor(kickTime * SAMPLE_RATE);
    const kickDuration = 0.20;
    const kickSamples = Math.floor(kickDuration * SAMPLE_RATE);

    // Double kick velocity variation
    const kickVol = (sixteenth % 2 === 0) ? 0.95 : 0.80;

    for (let i = 0; i < kickSamples && (kickStart + i) < TOTAL_SAMPLES; i++) {
      const t = i / SAMPLE_RATE;
      const progress = i / kickSamples;
      const env = Math.exp(-progress * 12.0);
      // Pitch drop: 160Hz -> 42Hz for punchy metal kick
      const freq = 42 + 118 * Math.exp(-progress * 28);
      const kickTone = oscSine(freq * t) * env * kickVol;
      // Beater click
      const click = (Math.random() * 2 - 1) * Math.exp(-progress * 85) * 0.45;

      leftBuffer[kickStart + i] += (kickTone + click) * 0.8;
      rightBuffer[kickStart + i] += (kickTone + click) * 0.8;
    }
  }

  // Hi-Hats / Ride Cymbal (8th notes)
  for (let eighth = 0; eighth < 2; eighth++) {
    const hatTime = beatTime + (eighth * BEAT_DURATION / 2);
    const hatStart = Math.floor(hatTime * SAMPLE_RATE);
    const hatSamples = Math.floor(0.06 * SAMPLE_RATE);

    for (let i = 0; i < hatSamples && (hatStart + i) < TOTAL_SAMPLES; i++) {
      const progress = i / hatSamples;
      const env = Math.exp(-progress * 28.0);
      const noise = (Math.random() * 2 - 1) * env * 0.22;
      leftBuffer[hatStart + i] += noise * 0.7;
      rightBuffer[hatStart + i] += noise * 0.9;
    }
  }
}

// -------------------------------------------------------------
// 2. RHYTHM GUITAR: Heavy Distorted Palm-Muted Metal Riff
// -------------------------------------------------------------
// Metal Riff Progression: E5 (Chug) -> G5 -> A5 -> Bb5 -> A5 -> G5 -> F5 -> E5
const METAL_RIFF = [
  // Bar 1-2 (E5 Chug + G5-A5 accents)
  { chord: 'E2', type: 'palm', beats: 0.5 },
  { chord: 'E2', type: 'palm', beats: 0.5 },
  { chord: 'E2', type: 'palm', beats: 0.5 },
  { chord: 'G2', type: 'open', beats: 0.5 },
  { chord: 'E2', type: 'palm', beats: 0.5 },
  { chord: 'E2', type: 'palm', beats: 0.5 },
  { chord: 'A2', type: 'open', beats: 0.5 },
  { chord: 'Bb2', type: 'open', beats: 0.5 },

  // Bar 3-4
  { chord: 'A2', type: 'open', beats: 0.5 },
  { chord: 'G2', type: 'open', beats: 0.5 },
  { chord: 'E2', type: 'palm', beats: 0.5 },
  { chord: 'E2', type: 'palm', beats: 0.5 },
  { chord: 'F2', type: 'open', beats: 1.0 },
  { chord: 'E2', type: 'open', beats: 1.0 },

  // Bar 5-6 (Gallop variation)
  { chord: 'E2', type: 'palm', beats: 0.25 },
  { chord: 'E2', type: 'palm', beats: 0.25 },
  { chord: 'E2', type: 'palm', beats: 0.5 },
  { chord: 'C3', type: 'open', beats: 0.5 },
  { chord: 'D3', type: 'open', beats: 0.5 },
  { chord: 'E2', type: 'palm', beats: 0.25 },
  { chord: 'E2', type: 'palm', beats: 0.25 },
  { chord: 'E2', type: 'palm', beats: 0.5 },
  { chord: 'G2', type: 'open', beats: 0.5 },
  { chord: 'B2', type: 'open', beats: 0.5 },

  // Bar 7-8 (Turnaround)
  { chord: 'C3', type: 'open', beats: 1.0 },
  { chord: 'B2', type: 'open', beats: 1.0 },
  { chord: 'A2', type: 'open', beats: 1.0 },
  { chord: 'G2', type: 'open', beats: 1.0 }
];

let riffBeat = 0;
while (riffBeat < totalBeats) {
  for (const step of METAL_RIFF) {
    if (riffBeat >= totalBeats) break;

    const startSample = Math.floor(riffBeat * BEAT_DURATION * SAMPLE_RATE);
    const duration = step.beats * BEAT_DURATION;
    const noteSamples = Math.floor(duration * SAMPLE_RATE);
    const isPalm = step.type === 'palm';
    const freqs = getPowerChord(step.chord);

    // Double-tracked rhythm guitars (Left and Right slightly detuned for massive stereo wall)
    for (let i = 0; i < noteSamples && (startSample + i) < TOTAL_SAMPLES; i++) {
      const t = i / SAMPLE_RATE;
      const progress = i / noteSamples;
      const env = isPalm ? Math.exp(-progress * 8.5) : Math.exp(-progress * 2.2);

      // Left Track
      let rawL = 0;
      for (const f of freqs) {
        rawL += oscSaw(f * t) * 0.4 + oscSquare((f * 1.003) * t) * 0.3;
      }
      const distL = metalDistort(rawL, isPalm ? 5.5 : 7.0) * env * 0.32;

      // Right Track (detuned slightly)
      let rawR = 0;
      for (const f of freqs) {
        rawR += oscSaw((f * 0.997) * t) * 0.4 + oscSquare((f * 1.005) * t) * 0.3;
      }
      const distR = metalDistort(rawR, isPalm ? 5.5 : 7.0) * env * 0.32;

      leftBuffer[startSample + i] += distL * 0.85 + distR * 0.15;
      rightBuffer[startSample + i] += distR * 0.85 + distL * 0.15;
    }

    riffBeat += step.beats;
  }
}

// -------------------------------------------------------------
// 3. BASS GUITAR: Distorted Overdriven Sub Growl
// -------------------------------------------------------------
let bassBeat = 0;
while (bassBeat < totalBeats) {
  for (const step of METAL_RIFF) {
    if (bassBeat >= totalBeats) break;

    const startSample = Math.floor(bassBeat * BEAT_DURATION * SAMPLE_RATE);
    const duration = step.beats * BEAT_DURATION;
    const noteSamples = Math.floor(duration * SAMPLE_RATE);
    const rootFreq = NOTES[step.chord] ? NOTES[step.chord] / 2 : 41.2;

    for (let i = 0; i < noteSamples && (startSample + i) < TOTAL_SAMPLES; i++) {
      const t = i / SAMPLE_RATE;
      const progress = i / noteSamples;
      const env = Math.exp(-progress * 3.5);

      const osc1 = oscSaw(rootFreq * t);
      const osc2 = oscSine((rootFreq * 0.5) * t) * 0.8; // Sub bass
      const bassDist = metalDistort(osc1 + osc2, 3.8) * env * 0.42;

      leftBuffer[startSample + i] += bassDist;
      rightBuffer[startSample + i] += bassDist;
    }

    bassBeat += step.beats;
  }
}

// -------------------------------------------------------------
// 4. LEAD GUITAR SOLO: Screaming Harmonic Minor Solos & Bends
// -------------------------------------------------------------
const LEAD_SOLO = [
  // Solo Section (Starts after bar 2)
  { note: NOTES.E4, beats: 1.0 }, { note: NOTES.G4, beats: 1.0 }, { note: NOTES.A4, beats: 1.0 }, { note: NOTES.B4, beats: 1.0 },
  { note: NOTES.C5, beats: 1.5 }, { note: NOTES.B4, beats: 0.5 }, { note: NOTES.A4, beats: 1.0 }, { note: NOTES.G4, beats: 1.0 },
  { note: NOTES.E5, beats: 2.0 }, { note: NOTES.D5, beats: 1.0 }, { note: NOTES.C5, beats: 1.0 },
  { note: NOTES.B4, beats: 2.0 }, { note: NOTES.A4, beats: 2.0 },

  // Shred Run
  { note: NOTES.E5, beats: 0.5 }, { note: NOTES.F5, beats: 0.5 }, { note: NOTES.G5, beats: 0.5 }, { note: NOTES.A5, beats: 0.5 },
  { note: NOTES.B5, beats: 1.5 }, { note: NOTES.A5, beats: 0.5 }, { note: NOTES.G5, beats: 1.0 }, { note: NOTES.F5, beats: 1.0 },
  { note: NOTES.E5, beats: 3.0 }, { note: null, beats: 1.0 },

  // Climax Screaming High Notes
  { note: NOTES.B5, beats: 1.5 }, { note: NOTES.A5, beats: 0.5 }, { note: NOTES.B5, beats: 2.0 },
  { note: NOTES.E6, beats: 3.0 }, { note: NOTES.D5, beats: 1.0 },
  { note: NOTES.E5, beats: 4.0 }
];

let soloBeat = 8; // Lead guitar enters at bar 3 (beat 8)
while (soloBeat < totalBeats) {
  for (const phrase of LEAD_SOLO) {
    if (soloBeat >= totalBeats) break;

    if (phrase.note) {
      const startSample = Math.floor(soloBeat * BEAT_DURATION * SAMPLE_RATE);
      const noteDuration = phrase.beats * BEAT_DURATION;
      const noteSamples = Math.floor(noteDuration * SAMPLE_RATE);

      for (let i = 0; i < noteSamples && (startSample + i) < TOTAL_SAMPLES; i++) {
        const t = i / SAMPLE_RATE;
        const progress = i / noteSamples;

        // Whammy / Heavy vibrato
        const vibrato = Math.sin(t * 40) * (t > 0.15 ? 6.5 : 0);
        const freq = phrase.note + vibrato;
        const env = Math.sin(Math.PI * Math.pow(progress, 0.25)) * Math.exp(-progress * 0.6);

        const osc1 = oscSaw(freq * t);
        const osc2 = oscSquare((freq * 1.004) * t) * 0.7;
        const rawLead = (osc1 + osc2) * env;
        const leadDist = metalDistort(rawLead, 8.5) * 0.36;

        // Stereo delay echo
        leftBuffer[startSample + i] += leadDist * 0.7;
        rightBuffer[startSample + i] += leadDist * 0.7;

        const delaySamples = Math.floor(0.21 * SAMPLE_RATE); // 16th note metal delay
        if (startSample + i + delaySamples < TOTAL_SAMPLES) {
          leftBuffer[startSample + i + delaySamples] += leadDist * 0.28;
          rightBuffer[startSample + i + delaySamples] += leadDist * 0.38;
        }
      }
    }
    soloBeat += phrase.beats;
  }
}

// -------------------------------------------------------------
// 5. Master Limiter & High-Power Normalization
// -------------------------------------------------------------
let maxPeak = 0;
for (let i = 0; i < TOTAL_SAMPLES; i++) {
  if (Math.abs(leftBuffer[i]) > maxPeak) maxPeak = Math.abs(leftBuffer[i]);
  if (Math.abs(rightBuffer[i]) > maxPeak) maxPeak = Math.abs(rightBuffer[i]);
}

const targetPeak = 0.94;
const gain = maxPeak > 0 ? (targetPeak / maxPeak) : 1;
console.log(`Peak detected: ${maxPeak.toFixed(2)}. Applying master limiter gain: ${gain.toFixed(2)}`);

// Encode 16-bit PCM WAV File
const wavDataSize = TOTAL_SAMPLES * NUM_CHANNELS * 2;
const buffer = Buffer.alloc(44 + wavDataSize);

// RIFF Header
buffer.write('RIFF', 0);
buffer.writeUInt32LE(36 + wavDataSize, 4);
buffer.write('WAVE', 8);

// fmt chunk
buffer.write('fmt ', 12);
buffer.writeUInt32LE(16, 16);
buffer.writeUInt16LE(1, 20);  // PCM
buffer.writeUInt16LE(NUM_CHANNELS, 22);
buffer.writeUInt32LE(SAMPLE_RATE, 24);
buffer.writeUInt32LE(SAMPLE_RATE * NUM_CHANNELS * 2, 28);
buffer.writeUInt16LE(NUM_CHANNELS * 2, 32);
buffer.writeUInt16LE(16, 34);

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
console.log(`Saved Heavy Metal demo track to ${outputPath} (${(buffer.length / (1024 * 1024)).toFixed(2)} MB)`);
