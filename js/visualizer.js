/**
 * Toronto Skyline 16:9 Window Matrix Reflection Visualizer Engine
 * Inverted Equalizer: Starts from the middle shoreline (reflection top) and flows downwards into the water.
 * Top skyline is permanently visible; lower reflection starts pitch black and illuminates original image boxes to music.
 */

class SkylineVisualizer {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas.getContext('2d', { alpha: false });

    // Internal 16:9 Resolution
    this.width = 1920;
    this.height = 1080;
    this.canvas.width = this.width;
    this.canvas.height = this.height;

    // Horizon line (Shoreline boundary where skyline meets water reflection)
    this.horizonRatio = 0.58; // 58% down from top
    this.horizonY = Math.round(this.height * this.horizonRatio);
    this.reflHeight = this.height - this.horizonY;

    // Grid Box Configuration for the Reflection Part
    this.cols = 48;
    this.rows = 20;
    this.boxGap = 1.5; // Gap between boxed image slices

    // Visualizer Settings
    this.mode = 'reflection_eq'; // reflection_eq | wave_cascade | beat_pulse | radial_spire
    this.sensitivity = 1.35;
    this.decaySpeed = 0.82;
    this.restOpacity = 0.0; // Starts pitch black
    this.boxBorderGlow = true;

    // Precomputed Column Equalizer Levels & Drops
    this.columnHeights = new Float32Array(this.cols);
    this.columnPeaks = new Float32Array(this.cols);
    this.columnPeakDrops = new Float32Array(this.cols);

    // Box Matrix Array
    this.reflectionBoxes = [];

    // Image State
    this.image = new Image();
    this.isImageLoaded = false;
    this.time = 0;

    // Performance Stats
    this.lastFrameTime = performance.now();
    this.fps = 60;
    this.frameCount = 0;
    this.fpsTimer = performance.now();

    this.loadImage('assets/toronto_skyline.jpg');
  }

  loadImage(src) {
    this.image.crossOrigin = 'anonymous';
    this.image.onload = () => {
      this.isImageLoaded = true;
      this.computeReflectionGrid();
    };
    this.image.src = src;
  }

  /**
   * Divide the lower reflection region into individual boxes starting at the middle shoreline
   */
  computeReflectionGrid() {
    this.horizonY = Math.round(this.height * this.horizonRatio);
    this.reflHeight = this.height - this.horizonY;

    const cellW = this.width / this.cols;
    const cellH = this.reflHeight / this.rows;

    this.columnHeights = new Float32Array(this.cols);
    this.columnPeaks = new Float32Array(this.cols);
    this.columnPeakDrops = new Float32Array(this.cols);

    this.reflectionBoxes = [];

    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const x = c * cellW;
        const y = this.horizonY + (r * cellH);

        this.reflectionBoxes.push({
          col: c,
          row: r, // 0 = at middle shoreline, rows-1 = bottom of screen
          x: x,
          y: y,
          w: cellW,
          h: cellH,
          normX: c / this.cols,
          normY: r / this.rows,
          currentAlpha: 0
        });
      }
    }
  }

  setGridDensity(cols, rows) {
    this.cols = cols;
    this.rows = rows || Math.round(cols * 0.42);
    if (this.isImageLoaded) {
      this.computeReflectionGrid();
    }
  }

  setHorizonRatio(ratio) {
    this.horizonRatio = Math.max(0.45, Math.min(0.70, ratio));
    if (this.isImageLoaded) {
      this.computeReflectionGrid();
    }
  }

  /**
   * Main Render Loop
   */
  render(audioData) {
    this.time += 0.016;

    // Calculate FPS
    this.frameCount++;
    const now = performance.now();
    if (now - this.fpsTimer >= 500) {
      this.fps = Math.round((this.frameCount * 1000) / (now - this.fpsTimer));
      this.frameCount = 0;
      this.fpsTimer = now;
      const fpsEl = document.getElementById('stat-fps');
      if (fpsEl) fpsEl.textContent = this.fps;
    }

    if (!this.isImageLoaded) {
      this.ctx.fillStyle = '#000';
      this.ctx.fillRect(0, 0, this.width, this.height);
      return;
    }

    const { frequencyData, smoothedData, bands, beatImpact } = audioData;
    const binCount = smoothedData.length;

    // 1. Draw Top Skyline (Permanently Visible, Fixed, Crisp Original Photograph)
    const imgW = this.image.naturalWidth || this.width;
    const imgH = this.image.naturalHeight || this.height;
    const srcHorizonY = (this.horizonY / this.height) * imgH;

    this.ctx.drawImage(
      this.image,
      0, 0, imgW, srcHorizonY,
      0, 0, this.width, this.horizonY
    );

    // 2. Clear Lower Reflection Area to Pure Black (Initial Rest State)
    this.ctx.fillStyle = '#000000';
    this.ctx.fillRect(0, this.horizonY, this.width, this.reflHeight);

    // 3. Map Audio Frequency Bins to Downward Equalizer Columns
    for (let c = 0; c < this.cols; c++) {
      const normC = c / this.cols;
      // Logarithmic curve across columns
      const binIdx = Math.min(binCount - 1, Math.floor(Math.pow(normC, 1.35) * (binCount * 0.75)));
      const rawVal = smoothedData[binIdx] || 0;

      // Downward depth in rows from the shoreline (0 to this.rows)
      const targetDepth = rawVal * this.rows * this.sensitivity;

      // Smooth column transition
      this.columnHeights[c] = (this.columnHeights[c] * this.decaySpeed) + (targetDepth * (1 - this.decaySpeed));

      // Downward peak tracker: pushes downwards on loud hits, retracts back up towards shoreline on decay
      if (this.columnHeights[c] > this.columnPeaks[c]) {
        this.columnPeaks[c] = this.columnHeights[c];
        this.columnPeakDrops[c] = 0;
      } else {
        this.columnPeakDrops[c] += 0.025;
        this.columnPeaks[c] = Math.max(0, this.columnPeaks[c] - this.columnPeakDrops[c]);
      }
    }

    // 4. Render the Split Boxed Images of the Reflection (Illuminated Downwards)
    this.renderReflectionBoxes(audioData, imgW, imgH);
  }

  /**
   * Render the reflection split into individual boxed slices
   * Equalizer starts from the middle shoreline (row = 0) and lights up downwards
   */
  renderReflectionBoxes(audioData, imgW, imgH) {
    const { bands, beatImpact } = audioData;
    const gap = this.boxGap;

    for (let i = 0; i < this.reflectionBoxes.length; i++) {
      const box = this.reflectionBoxes[i];
      let targetAlpha = this.restOpacity;

      switch (this.mode) {
        case 'reflection_eq': {
          // Downward Equalizer from Middle Shoreline:
          // row 0 is right at the shoreline, row = rows-1 is bottom of screen
          const colDepth = this.columnHeights[box.col];
          const rowFromShore = box.row;

          if (rowFromShore <= colDepth) {
            // Box is within the active downward column
            const depthRatio = colDepth > 0 ? (rowFromShore / colDepth) : 0;
            // Shoreline is most intensely lit, tapering cleanly to the bottom leading edge
            targetAlpha = Math.min(1.0, 0.45 + (1 - depthRatio * 0.4));
          } else {
            // Soft falloff just below the active tip
            const dist = rowFromShore - colDepth;
            if (dist < 1.4) {
              targetAlpha = (1.4 - dist) / 1.4 * 0.22;
            } else {
              targetAlpha = this.restOpacity;
            }
          }
          break;
        }

        case 'wave_cascade': {
          // Downward cascading wave pulses originating from the middle shoreline
          const wavePhase = (this.time * 3.2 - box.row * 0.45 + box.col * 0.15);
          const waveFactor = Math.sin(wavePhase);
          const colPower = this.columnHeights[box.col] / this.rows;

          if (waveFactor > 0.05 && colPower > 0.08) {
            targetAlpha = Math.min(1.0, waveFactor * colPower * 1.9 + beatImpact * 0.35);
          } else {
            targetAlpha = this.restOpacity;
          }
          break;
        }

        case 'beat_pulse': {
          // Rhythmic Beat Matrix: Kick impacts illuminate downward from middle shoreline
          const colPower = this.columnHeights[box.col] / this.rows;
          const verticalDecay = Math.max(0.2, 1 - (box.row / this.rows) * 0.7);
          targetAlpha = Math.min(1.0, (beatImpact * 0.95 * verticalDecay) + (colPower * 0.5));
          break;
        }

        case 'radial_spire': {
          // Radial shockwave starting at CN Tower shoreline axis (X: 50%, Y: 0 in reflection) and expanding downwards
          const dx = box.normX - 0.50;
          const dy = box.normY; // 0 at shoreline down to 1.0 at bottom
          const dist = Math.sqrt(dx * dx + dy * dy);

          const wavePos = (this.time * 2.2) % 1.35;
          const waveDist = Math.abs(dist - wavePos);

          if (waveDist < 0.16) {
            targetAlpha = (1 - (waveDist / 0.16)) * (0.85 + beatImpact * 0.55);
          } else {
            targetAlpha = Math.max(this.restOpacity, (this.columnHeights[box.col] / this.rows) * 0.35);
          }
          break;
        }
      }

      // Snappy attack & smooth release interpolation
      box.currentAlpha = (box.currentAlpha * 0.6) + (targetAlpha * 0.4);

      // Only draw box if illuminated above threshold
      if (box.currentAlpha > 0.01) {
        const sx = (box.x / this.width) * imgW;
        const sy = (box.y / this.height) * imgH;
        const sw = (box.w / this.width) * imgW;
        const sh = (box.h / this.height) * imgH;

        const dx = box.x + gap / 2;
        const dy = box.y + gap / 2;
        const dw = Math.max(1, box.w - gap);
        const dh = Math.max(1, box.h - gap);

        this.ctx.save();
        this.ctx.globalAlpha = box.currentAlpha;

        // Draw exact piece of the original image's reflection
        this.ctx.drawImage(this.image, sx, sy, sw, sh, dx, dy, dw, dh);

        // Crisp Subtle Box Grid Outline
        if (this.boxBorderGlow && box.currentAlpha > 0.2) {
          this.ctx.strokeStyle = `rgba(255, 255, 255, ${box.currentAlpha * 0.22})`;
          this.ctx.lineWidth = 1;
          this.ctx.strokeRect(dx, dy, dw, dh);
        }

        this.ctx.restore();
      }
    }

    // 5. Peak Indicator Dots at the Leading Downward Edge of Equalizer Columns
    if (this.mode === 'reflection_eq') {
      const cellW = this.width / this.cols;
      const cellH = this.reflHeight / this.rows;

      for (let c = 0; c < this.cols; c++) {
        const peakRow = Math.min(this.rows - 1, Math.floor(this.columnPeaks[c]));
        if (peakRow > 0 && this.columnPeaks[c] > 0.5) {
          const x = c * cellW + gap / 2;
          const y = this.horizonY + (peakRow * cellH) + gap / 2;
          const w = cellW - gap;
          const h = Math.max(2, cellH * 0.25);

          // Draw bright white leading tip indicator
          this.ctx.save();
          this.ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
          this.ctx.shadowColor = '#ffffff';
          this.ctx.shadowBlur = 6;
          this.ctx.fillRect(x, y, w, h);
          this.ctx.restore();
        }
      }
    }
  }
}

window.SkylineVisualizer = SkylineVisualizer;
