/**
 * Toronto Skyline Audio Visualizer - Main Application Controller
 * Reflection Box Equalizer, Audio Engine, UI Controls & Sliders
 */

document.addEventListener('DOMContentLoaded', () => {
  // Initialize Subsystems
  const audio = new AudioEngine();
  const visualizer = new SkylineVisualizer('visualizer-canvas');

  // DOM Elements
  const btnPlayPause = document.getElementById('btn-play-pause');
  const playPauseIcon = document.getElementById('play-pause-icon');
  const btnLoadDemo = document.getElementById('btn-load-demo');
  const btnHeroDemo = document.getElementById('btn-hero-demo');
  const btnHeroUpload = document.getElementById('btn-hero-upload');
  const audioFileInput = document.getElementById('audio-file-input');
  const btnMicToggle = document.getElementById('btn-mic-toggle');
  const btnFullscreenToggle = document.getElementById('btn-fullscreen-toggle');
  const btnSettingsToggle = document.getElementById('btn-settings-toggle');
  const btnDrawerOpen = document.getElementById('btn-drawer-open');
  const btnDrawerClose = document.getElementById('btn-drawer-close');
  const settingsDrawer = document.getElementById('settings-drawer');
  const idleOverlay = document.getElementById('idle-overlay');
  const dragDropZone = document.getElementById('drag-drop-zone');
  const viewportWrapper = document.getElementById('viewport-wrapper');

  // Player Elements
  const playerTrackTitle = document.getElementById('player-track-title');
  const playerTrackArtist = document.getElementById('player-track-artist');
  const hudTrackName = document.getElementById('hud-track-name');
  const trackSpinIcon = document.getElementById('track-spin-icon');
  const currentTimeDisplay = document.getElementById('current-time-display');
  const totalTimeDisplay = document.getElementById('total-time-display');
  const seekBarTrack = document.getElementById('seek-bar-track');
  const seekBarFill = document.getElementById('seek-bar-fill');
  const seekBarThumb = document.getElementById('seek-bar-thumb');
  const volumeSlider = document.getElementById('volume-slider');
  const btnMute = document.getElementById('btn-mute');
  const volumeIcon = document.getElementById('volume-icon');
  const btnLoopToggle = document.getElementById('btn-loop-toggle');
  const btnBackward10 = document.getElementById('btn-backward-10');
  const btnForward10 = document.getElementById('btn-forward-10');

  // Customization Controls
  const sliderGridCols = document.getElementById('slider-grid-cols');
  const valGridCols = document.getElementById('val-grid-cols');
  const sliderGridRows = document.getElementById('slider-grid-rows');
  const valGridRows = document.getElementById('val-grid-rows');
  const statGridSize = document.getElementById('stat-grid-size');
  const sliderBoxGap = document.getElementById('slider-box-gap');
  const valBoxGap = document.getElementById('val-box-gap');
  const sliderSensitivity = document.getElementById('slider-sensitivity');
  const valSensitivity = document.getElementById('val-sensitivity');
  const sliderDecay = document.getElementById('slider-decay');
  const valDecay = document.getElementById('val-decay');
  const sliderHorizon = document.getElementById('slider-horizon');
  const valHorizon = document.getElementById('val-horizon');

  // Toggle Checkboxes
  const toggleBoxBorder = document.getElementById('toggle-box-border');
  const toggleRestState = document.getElementById('toggle-rest-state');
  const btnResetDefaults = document.getElementById('btn-reset-defaults');

  // HUD Meters
  const meterSub = document.getElementById('meter-sub');
  const meterBass = document.getElementById('meter-bass');
  const meterMid = document.getElementById('meter-mid');
  const meterHigh = document.getElementById('meter-high');

  let isDraggingSeek = false;
  let lastVolume = 0.85;

  // Format Seconds to M:SS
  function formatTime(seconds) {
    if (!isFinite(seconds) || seconds < 0) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  }

  // ==========================================
  // Playback Control Handlers
  // ==========================================
  async function handlePlayPause() {
    await audio.togglePlay();
    hideIdleOverlay();
  }

  function hideIdleOverlay() {
    if (idleOverlay && !idleOverlay.classList.contains('hidden')) {
      idleOverlay.classList.add('hidden');
    }
  }

  btnPlayPause.addEventListener('click', handlePlayPause);

  btnLoadDemo.addEventListener('click', async () => {
    await audio.loadDemoTrack();
    hideIdleOverlay();
  });

  btnHeroDemo.addEventListener('click', async () => {
    await audio.loadDemoTrack();
    hideIdleOverlay();
  });

  btnHeroUpload.addEventListener('click', () => {
    audioFileInput.click();
  });

  // User File Upload
  audioFileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (file) {
      await audio.loadUserFile(file);
      hideIdleOverlay();
    }
  });

  // Drag & Drop Audio Upload
  ['dragenter', 'dragover'].forEach(eventName => {
    viewportWrapper.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dragDropZone.classList.add('active');
    });
  });

  ['dragleave', 'drop'].forEach(eventName => {
    viewportWrapper.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dragDropZone.classList.remove('active');
    });
  });

  viewportWrapper.addEventListener('drop', async (e) => {
    const dt = e.dataTransfer;
    const file = dt.files[0];
    if (file && file.type.startsWith('audio/')) {
      await audio.loadUserFile(file);
      hideIdleOverlay();
    }
  });

  // Microphone Input Toggle
  btnMicToggle.addEventListener('click', async () => {
    const isMicActive = await audio.toggleMic();
    btnMicToggle.classList.toggle('active', isMicActive);
    if (isMicActive) hideIdleOverlay();
  });

  // 10s Rewind / Forward
  btnBackward10.addEventListener('click', () => {
    audio.seek(audio.audioElement.currentTime - 10);
  });

  btnForward10.addEventListener('click', () => {
    audio.seek(audio.audioElement.currentTime + 10);
  });

  // Loop Toggle
  btnLoopToggle.addEventListener('click', () => {
    audio.audioElement.loop = !audio.audioElement.loop;
    btnLoopToggle.classList.toggle('active', audio.audioElement.loop);
  });
  btnLoopToggle.classList.add('active'); // Default loop on

  // Volume & Mute
  volumeSlider.addEventListener('input', (e) => {
    const val = parseFloat(e.target.value);
    audio.setVolume(val);
    updateVolumeIcon(val);
  });

  function updateVolumeIcon(val) {
    if (val === 0) {
      volumeIcon.className = 'fa-solid fa-volume-xmark';
    } else if (val < 0.5) {
      volumeIcon.className = 'fa-solid fa-volume-low';
    } else {
      volumeIcon.className = 'fa-solid fa-volume-high';
    }
  }

  btnMute.addEventListener('click', () => {
    if (volumeSlider.value > 0) {
      lastVolume = parseFloat(volumeSlider.value);
      volumeSlider.value = 0;
      audio.setVolume(0);
      updateVolumeIcon(0);
    } else {
      volumeSlider.value = lastVolume || 0.85;
      audio.setVolume(volumeSlider.value);
      updateVolumeIcon(volumeSlider.value);
    }
  });

  // Seek Bar Interaction
  seekBarTrack.addEventListener('click', (e) => {
    const rect = seekBarTrack.getBoundingClientRect();
    const pos = (e.clientX - rect.left) / rect.width;
    const duration = audio.audioElement.duration || 32;
    audio.seek(pos * duration);
  });

  // Fullscreen 16:9 Viewport Toggle
  btnFullscreenToggle.addEventListener('click', () => {
    toggleFullscreen();
  });

  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      viewportWrapper.requestFullscreen?.() || viewportWrapper.webkitRequestFullscreen?.();
      btnFullscreenToggle.classList.add('active');
    } else {
      document.exitFullscreen?.() || document.webkitExitFullscreen?.();
      btnFullscreenToggle.classList.remove('active');
    }
  }

  // ==========================================
  // Drawer / Settings Toggle
  // ==========================================
  function openDrawer() {
    settingsDrawer.classList.add('open');
    btnSettingsToggle.classList.add('active');
  }

  function closeDrawer() {
    settingsDrawer.classList.remove('open');
    btnSettingsToggle.classList.remove('active');
  }

  btnSettingsToggle.addEventListener('click', () => {
    if (settingsDrawer.classList.contains('open')) closeDrawer();
    else openDrawer();
  });

  btnDrawerOpen.addEventListener('click', openDrawer);
  btnDrawerClose.addEventListener('click', closeDrawer);

  // ==========================================
  // Visualizer Mode Selector
  // ==========================================
  function setVisualizerMode(mode) {
    visualizer.mode = mode;

    // Update Quick Header Pills
    document.querySelectorAll('#quick-mode-selector .preset-pill').forEach(pill => {
      pill.classList.toggle('active', pill.dataset.mode === mode);
    });

    // Update Drawer Cards
    document.querySelectorAll('.mode-card').forEach(card => {
      card.classList.toggle('active', card.dataset.mode === mode);
    });
  }

  document.querySelectorAll('#quick-mode-selector .preset-pill').forEach(btn => {
    btn.addEventListener('click', () => setVisualizerMode(btn.dataset.mode));
  });

  document.querySelectorAll('.mode-card').forEach(btn => {
    btn.addEventListener('click', () => setVisualizerMode(btn.dataset.mode));
  });

  // ==========================================
  // Grid Density & FX Sliders
  // ==========================================
  sliderGridCols.addEventListener('input', (e) => {
    const cols = parseInt(e.target.value, 10);
    const rows = parseInt(sliderGridRows.value, 10);
    visualizer.setGridDensity(cols, rows);
    valGridCols.textContent = `${cols} cols (${cols} × ${rows})`;
    statGridSize.textContent = `${cols} × ${rows}`;
  });

  sliderGridRows.addEventListener('input', (e) => {
    const rows = parseInt(e.target.value, 10);
    const cols = parseInt(sliderGridCols.value, 10);
    visualizer.setGridDensity(cols, rows);
    valGridRows.textContent = `${rows} rows`;
    valGridCols.textContent = `${cols} cols (${cols} × ${rows})`;
    statGridSize.textContent = `${cols} × ${rows}`;
  });

  sliderBoxGap.addEventListener('input', (e) => {
    const gap = parseFloat(e.target.value);
    visualizer.boxGap = gap;
    valBoxGap.textContent = `${gap.toFixed(1)} px`;
  });

  sliderSensitivity.addEventListener('input', (e) => {
    const val = parseFloat(e.target.value);
    visualizer.sensitivity = val;
    valSensitivity.textContent = `${val.toFixed(1)}x`;
  });

  sliderDecay.addEventListener('input', (e) => {
    const val = parseFloat(e.target.value);
    visualizer.decaySpeed = val;
    audio.setSmoothing(val);
    valDecay.textContent = val < 0.65 ? 'Instant' : (val > 0.85 ? 'Smooth' : 'Medium');
  });

  sliderHorizon.addEventListener('input', (e) => {
    const val = parseInt(e.target.value, 10);
    visualizer.setHorizonRatio(val / 100);
    valHorizon.textContent = `${val}%`;
  });

  // Option Toggles
  toggleBoxBorder.addEventListener('change', (e) => {
    visualizer.boxBorderGlow = e.target.checked;
  });

  toggleRestState.addEventListener('change', (e) => {
    visualizer.restOpacity = e.target.checked ? 0.05 : 0.0;
  });

  // Reset Defaults
  btnResetDefaults.addEventListener('click', () => {
    setVisualizerMode('reflection_eq');

    sliderGridCols.value = 48;
    sliderGridRows.value = 20;
    visualizer.setGridDensity(48, 20);
    valGridCols.textContent = '48 cols (48 × 20)';
    valGridRows.textContent = '20 rows';
    statGridSize.textContent = '48 × 20';

    sliderBoxGap.value = 1.5;
    visualizer.boxGap = 1.5;
    valBoxGap.textContent = '1.5 px';

    sliderSensitivity.value = 1.3;
    visualizer.sensitivity = 1.3;
    valSensitivity.textContent = '1.3x';

    sliderDecay.value = 0.82;
    visualizer.decaySpeed = 0.82;
    audio.setSmoothing(0.82);
    valDecay.textContent = 'Smooth';

    sliderHorizon.value = 58;
    visualizer.setHorizonRatio(0.58);
    valHorizon.textContent = '58%';

    toggleBoxBorder.checked = true;
    visualizer.boxBorderGlow = true;

    toggleRestState.checked = false;
    visualizer.restOpacity = 0.0;
  });

  // ==========================================
  // Audio Event Listeners
  // ==========================================
  window.addEventListener('audio-play-state', (e) => {
    const { isPlaying } = e.detail;
    playPauseIcon.className = isPlaying ? 'fa-solid fa-pause' : 'fa-solid fa-play';
    trackSpinIcon.classList.toggle('playing', isPlaying);
  });

  window.addEventListener('track-changed', (e) => {
    const { title, artist, isMic } = e.detail;
    playerTrackTitle.textContent = title;
    playerTrackArtist.textContent = artist;
    hudTrackName.textContent = title;
  });

  window.addEventListener('audio-time-update', (e) => {
    if (isDraggingSeek) return;
    const { currentTime, duration } = e.detail;
    currentTimeDisplay.textContent = formatTime(currentTime);
    totalTimeDisplay.textContent = formatTime(duration);

    const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;
    seekBarFill.style.width = `${progressPercent}%`;
    seekBarThumb.style.left = `${progressPercent}%`;
  });

  // ==========================================
  // Keyboard Shortcuts
  // ==========================================
  window.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT') return;

    if (e.code === 'Space') {
      e.preventDefault();
      handlePlayPause();
    } else if (e.key === 'f' || e.key === 'F') {
      toggleFullscreen();
    } else if (e.key === 'm' || e.key === 'M') {
      btnMute.click();
    } else if (e.code === 'ArrowLeft') {
      btnBackward10.click();
    } else if (e.code === 'ArrowRight') {
      btnForward10.click();
    } else if (e.key === 'Escape') {
      closeDrawer();
    }
  });

  // ==========================================
  // Main Animation / Render Loop
  // ==========================================
  function animate() {
    requestAnimationFrame(animate);

    // 1. Update Audio Analysis
    const audioData = audio.update(visualizer.sensitivity);

    // 2. Render 16:9 Canvas Skyline Visualizer
    visualizer.render(audioData);

    // 3. Update HUD Band Meters
    if (meterSub && meterBass && meterMid && meterHigh) {
      meterSub.style.height = `${Math.max(3, audioData.bands.sub * 20)}px`;
      meterBass.style.height = `${Math.max(3, audioData.bands.bass * 20)}px`;
      meterMid.style.height = `${Math.max(3, audioData.bands.mid * 20)}px`;
      meterHigh.style.height = `${Math.max(3, audioData.bands.highMid * 20)}px`;
    }
  }

  // Start Animation Loop
  animate();
});
