import { formatMs, formatPct, formatSeconds, storage } from './util.js';

const SETTINGS_KEY = 'aimforge.settings.v5';
const LASTRUN_KEY = 'aimforge.lastrun.v5';

const MODE_INFO = {
  snap: {
    title: 'Snap Tiles',
    lines: ['Single wall target that respawns instantly on hit.', 'Designed for quick reaction flicks and clean stops.'],
    focus: 'Fast first-shot precision',
    controls: 'Left click to shoot',
  },
  cluster: {
    title: 'Wall Cluster',
    lines: ['Multiple live targets on the wall.', 'Hit-any respawns to keep your switching rhythm moving.'],
    focus: 'Target switching + consistency',
    controls: 'Left click to shoot',
  },
  track: {
    title: 'Strafe Trail',
    lines: ['A single target strafes left/right across the wall.', 'Stay glued to it and keep your aim smooth.'],
    focus: 'Smooth tracking control',
    controls:
      'Passive: crosshair on target scores automatically. Hold Fire: hold left click while on target.',
  },
};

export class UI {
  constructor({ game }) {
    this.game = game;

    this.el = {
      app: document.getElementById('app'),
      menu: document.getElementById('menu'),
      startBtn: document.getElementById('startBtn'),
      restartBtn: document.getElementById('restartBtn'),
      backBtn: document.getElementById('backBtn'),

      results: document.getElementById('results'),
      resultsBody: document.getElementById('resultsBody'),

      countdown: document.getElementById('countdown'),
      countdownText: document.getElementById('countdownText'),

      pause: document.getElementById('pause'),
      toast: document.getElementById('toast'),

      hud: document.getElementById('hud'),
      timerReadout: document.getElementById('timerReadout'),
      fpsReadout: document.getElementById('fpsReadout'),
      timeBar: document.getElementById('timeBar'),

      statAccuracy: document.getElementById('statAccuracy'),
      statAccuracyLabel: document.getElementById('statAccuracyLabel'),
      statResponse: document.getElementById('statResponse'),
      statResponseLabel: document.getElementById('statResponseLabel'),
      statExtraLabel: document.getElementById('statExtraLabel'),
      statExtraValue: document.getElementById('statExtraValue'),

      lastRun: document.getElementById('lastRun'),
      modeInfo: document.getElementById('modeInfo'),

      timer: document.getElementById('timer'),
      timerVal: document.getElementById('timerVal'),
      targetSize: document.getElementById('targetSize'),
      targetSizeVal: document.getElementById('targetSizeVal'),
      sensitivity: document.getElementById('sensitivity'),
      sensitivityVal: document.getElementById('sensitivityVal'),
      fov: document.getElementById('fov'),
      fovVal: document.getElementById('fovVal'),

      targetShape: document.getElementById('targetShape'),
      target3DColor: document.getElementById('target3DColor'),

      crosshairType: document.getElementById('crosshairType'),
      crosshairSize: document.getElementById('crosshairSize'),
      crosshairSizeVal: document.getElementById('crosshairSizeVal'),
      crosshairColor: document.getElementById('crosshairColor'),
      crosshairGlow: document.getElementById('crosshairGlow'),

      bg: document.getElementById('bg'),

      trackSettings: document.getElementById('trackSettings'),
      trackInputMode: document.getElementById('trackInputMode'),
      motionSpeed: document.getElementById('motionSpeed'),
      motionSpeedVal: document.getElementById('motionSpeedVal'),

      crosshair: document.getElementById('crosshair'),
      chDot: document.getElementById('chDot'),
      chRing: document.getElementById('chRing'),
      chH: document.getElementById('chH'),
      chV: document.getElementById('chV'),
    };

    this.modeId = 'snap';
    this._glowActive = false;

    this._lastResults = null;
    this._resizeRaf = 0;

    this._loadSettings();
    this._wireMenu();
    this._wireShortcuts();
    this._renderLastRun();
    this._refreshModeSpecificSettings();
    this.setVisible({ menu: true, hud: false, countdown: false, pause: false, results: false });
    // Initialize custom dropdowns ONCE after everything is loaded
    this.initCustomSelects();

    // Sound effects
    this.sounds = {
      click: new Audio('./assets/sounds/UI_mouse_click_sound.mp3'),
      hit: new Audio('./assets/sounds/target_hit_sound.mp3'),
      end: new Audio('./assets/sounds/session_end_sound.mp3')
    };

    // Preload sounds
    Object.values(this.sounds).forEach(sound => {
      sound.load();
      sound.volume = 0.3;
    });

    window.addEventListener('resize', () => {
      if (!this._lastResults) return;
      if (this.el.results.classList.contains('hidden')) return;
      cancelAnimationFrame(this._resizeRaf);
      this._resizeRaf = requestAnimationFrame(() => this._drawResultsCharts(this._lastResults));
    });
  }

  _loadSettings() {
    const saved = storage.get(SETTINGS_KEY, null);
    const s = {
      timer: 60,
      targetSize: 1,
      sensitivity: 1,
      fov: 103,
      targetShape: 'circle',
      target3DColor: '#ffffff',
      crosshairType: 'dot',
      crosshairSize: 1,
      crosshairColor: '#e8f0ff',
      crosshairGlow: false,
      bg: 'deep',
      motionSpeed: 1.5,
      trackInputMode: 'passive',
      ...(saved ?? {}),
    };

    this.el.timer.value = String(s.timer);
    this.el.targetSize.value = String(s.targetSize);
    this.el.sensitivity.value = String(s.sensitivity);
    this.el.fov.value = String(s.fov);

    this.el.targetShape.value = s.targetShape;
    this.el.target3DColor.value = s.target3DColor;

    this.el.crosshairType.value = s.crosshairType;
    this.el.crosshairSize.value = String(s.crosshairSize);
    this.el.crosshairColor.value = s.crosshairColor;
    this.el.crosshairGlow.value = s.crosshairGlow ? 'on' : 'off';

    this.el.bg.value = s.bg;

    this.el.motionSpeed.value = String(s.motionSpeed);
    this.el.trackInputMode.value = s.trackInputMode;

    this._refreshSettingReadouts();
    this.applyCrosshair();
    this.applyBackground();
  }

  _saveSettings() {
    storage.set(SETTINGS_KEY, this.getSettings());
  }

  getSettings() {
    return {
      timer: Number(this.el.timer.value),
      targetSize: Number(this.el.targetSize.value),
      sensitivity: Number(this.el.sensitivity.value),
      fov: Number(this.el.fov.value),
      targetShape: this.el.targetShape.value,
      target3DColor: this.el.target3DColor.value,
      crosshairType: this.el.crosshairType.value,
      crosshairSize: Number(this.el.crosshairSize.value),
      crosshairColor: this.el.crosshairColor.value,
      crosshairGlow: this.el.crosshairGlow.value === 'on',
      bg: this.el.bg.value,
      motionSpeed: Number(this.el.motionSpeed.value),
      trackInputMode: this.el.trackInputMode.value,
    };
  }

  _refreshSettingReadouts() {
    const timer = Number(this.el.timer.value);
    this.el.timerVal.textContent = timer === 0 ? '∞' : `${timer}s`;

    this.el.targetSizeVal.textContent = `${Math.round(Number(this.el.targetSize.value) * 100)}%`;
    this.el.sensitivityVal.textContent = `${Number(this.el.sensitivity.value).toFixed(2)}x`;
    this.el.fovVal.textContent = `${Math.round(Number(this.el.fov.value))}°`;

    this.el.crosshairSizeVal.textContent = `${Number(this.el.crosshairSize.value).toFixed(2)}x`;
    this.el.motionSpeedVal.textContent = Number(this.el.motionSpeed.value).toFixed(2);
  }

  _refreshModeSpecificSettings() {
    this.el.trackSettings?.classList.toggle('hidden', this.modeId !== 'track');
  }

  _renderModeInfo(modeId) {
    const info = MODE_INFO[modeId];
    const box = this.el.modeInfo;
    if (!box || !info) return;

    box.replaceChildren();

    const title = document.createElement('div');
    title.className = 'modeInfoTitle';
    title.textContent = info.title;
    box.appendChild(title);

    info.lines?.forEach((line) => {
      const row = document.createElement('div');
      row.className = 'modeInfoLine';
      row.textContent = line;
      box.appendChild(row);
    });

    const addHint = (label, value) => {
      if (!value) return;
      const hint = document.createElement('div');
      hint.className = 'modeInfoHint';

      const strong = document.createElement('span');
      strong.className = 'modeInfoLabel';
      strong.textContent = `${label} `;
      hint.appendChild(strong);

      const text = document.createElement('span');
      text.textContent = value;
      hint.appendChild(text);

      box.appendChild(hint);
    };

    addHint('Focus:', info.focus);
    addHint('Controls:', info.controls);
  }

  applyBackground() {
    this.el.app.dataset.bg = this.el.bg.value;
  }

  applyCrosshair() {
    const type = this.el.crosshairType.value;

    // values like: dot, cross, dot+cross, ring, dot+ring, ring+cross
    this.el.chDot.style.display = type.includes('dot') ? 'block' : 'none';
    this.el.chRing.style.display = type.includes('ring') ? 'block' : 'none';
    this.el.chH.style.display = type.includes('cross') ? 'block' : 'none';
    this.el.chV.style.display = type.includes('cross') ? 'block' : 'none';

    document.documentElement.style.setProperty('--crosshair-color', this.el.crosshairColor.value);
    document.documentElement.style.setProperty('--crosshair-scale', String(this.el.crosshairSize.value));
  }

  playSound(soundName) {
    const sound = this.sounds[soundName];
    if (sound) {
      sound.currentTime = 0;
      sound.play().catch(() => { });
    }
  }

  initCustomSelects() {
    // Only style dropdowns in the Crosshair and Environment columns
    const selectsToStyle = [
      this.el.targetShape,
      this.el.crosshairType,
      this.el.crosshairGlow,
      this.el.bg,
      this.el.trackInputMode
    ];

    selectsToStyle.forEach(select => {
      if (!select) return;

      const wrapper = document.createElement('div');
      wrapper.className = 'custom-select-wrapper';

      const display = document.createElement('div');
      display.className = 'custom-select-display';
      display.textContent = select.options[select.selectedIndex].text;

      const dropdown = document.createElement('div');
      dropdown.className = 'custom-select-dropdown hidden';

      Array.from(select.options).forEach((option, index) => {
        const item = document.createElement('div');
        item.className = 'custom-select-item';
        if (index === select.selectedIndex) item.classList.add('selected');
        item.textContent = option.text;
        item.dataset.value = option.value;

        item.addEventListener('click', () => {
          select.selectedIndex = index;
          select.dispatchEvent(new Event('change'));
          display.textContent = option.text;

          dropdown.querySelectorAll('.custom-select-item').forEach(i => i.classList.remove('selected'));
          item.classList.add('selected');
          dropdown.classList.add('hidden');
        });

        dropdown.appendChild(item);
      });

      display.addEventListener('click', (e) => {
        e.stopPropagation();
        document.querySelectorAll('.custom-select-dropdown').forEach(d => {
          if (d !== dropdown) d.classList.add('hidden');
        });
        dropdown.classList.toggle('hidden');
      });

      wrapper.appendChild(display);
      wrapper.appendChild(dropdown);

      select.style.display = 'none';
      select.parentNode.insertBefore(wrapper, select);

      // Sync custom display when select changes programmatically
      select.addEventListener('change', () => {
        display.textContent = select.options[select.selectedIndex].text;
        dropdown.querySelectorAll('.custom-select-item').forEach((item, idx) => {
          item.classList.toggle('selected', idx === select.selectedIndex);
        });
      });
    });

    // Close dropdowns when clicking outside
    document.addEventListener('click', () => {
      document.querySelectorAll('.custom-select-dropdown').forEach(d => d.classList.add('hidden'));
    });
  }

  setCrosshairGlow(on) {
    if (this._glowActive === on) return;
    this._glowActive = on;
    document.documentElement.style.setProperty('--crosshair-glow', on ? '1' : '0');
  }

  _wireMenu() {
    const selectMode = (btn) => {
      document.querySelectorAll('.modeBtn').forEach((b) => b.classList.remove('selected'));
      btn.classList.add('selected');
      this.modeId = btn.dataset.mode;
      this._refreshModeSpecificSettings();
      this._renderModeInfo(this.modeId);
    };

    document.querySelectorAll('.modeBtn').forEach((btn) => {
      btn.addEventListener('click', () => selectMode(btn));
      btn.addEventListener('focus', () => selectMode(btn));
    });

    const initial = document.querySelector('.modeBtn.selected') ?? document.querySelector('.modeBtn');
    if (initial) selectMode(initial);

    const onSettingsChange = () => {
      this._refreshSettingReadouts();
      this.applyCrosshair();
      this.applyBackground();
      this._saveSettings();
    };

    [
      'timer',
      'targetSize',
      'sensitivity',
      'fov',
      'targetShape',
      'target3DColor',
      'crosshairType',
      'crosshairSize',
      'crosshairColor',
      'crosshairGlow',
      'bg',
      'motionSpeed',
      'trackInputMode',
    ].forEach((id) => {
      const el = this.el[id];
      if (!el) return;
      el.addEventListener('input', onSettingsChange);
      el.addEventListener('change', onSettingsChange);
    });

    this.el.startBtn.addEventListener('click', () => {
      this.playSound('click');
      this.startFromMenu();
    });
    this.el.restartBtn.addEventListener('click', () => {
      this.playSound('click');
      this.restart();
    });
    this.el.backBtn.addEventListener('click', () => {
      this.playSound('click');
      this.backToMenu();
    });
  }

  _wireShortcuts() {
    document.addEventListener('keydown', async (e) => {
      if (e.repeat) return;

      if (e.key === 'f' || e.key === 'F') {
        this.game.toggleFullscreen();
        return;
      }

      if (e.key === 'p' || e.key === 'P') {
        if (this.game.state === 'running') {
          this.game.pause();
          this.setVisible({ pause: true });
        } else if (this.game.state === 'paused') {
          this.setVisible({ pause: false });
          await this.game.resume();
        }
        return;
      }

      if (e.key === 'Escape') {
        if (this.game.state === 'running' || this.game.state === 'paused') this.backToMenu();
      }
    });
  }

  setVisible({ menu, hud, countdown, pause, results }) {
    if (menu != null) this.el.menu.classList.toggle('hidden', !menu);
    if (hud != null) this.el.hud.classList.toggle('hidden', !hud);
    if (countdown != null) this.el.countdown.classList.toggle('hidden', !countdown);
    if (pause != null) this.el.pause.classList.toggle('hidden', !pause);
    if (results != null) this.el.results.classList.toggle('hidden', !results);

    this.el.hud.setAttribute('aria-hidden', String(this.el.hud.classList.contains('hidden')));
  }

  toast(msg) {
    if (!msg) return;
    this.el.toast.textContent = msg;
    this.el.toast.classList.remove('hidden');
    clearTimeout(this._toastT);
    this._toastT = setTimeout(() => this.el.toast.classList.add('hidden'), 2400);
  }

  async startFromMenu() {
    this._lastResults = null;
    this.setVisible({ menu: false, results: false, pause: false });

    const settings = this.getSettings();
    this.game.setSettings(settings);

    await this.game.prepareSession({ modeId: this.modeId, settings });

    if (this.modeId === 'track' && settings.trackInputMode === 'hold') {
      this.toast('Hold left click while on target to score.');
    }

    await this._runCountdown();

    this.setVisible({ hud: true, countdown: false });

    this.game.beginSession();
  }

  async _runCountdown() {
    this.setVisible({ countdown: true });

    const step = async (text) => {
      this.el.countdownText.textContent = text;
      await new Promise((r) => setTimeout(r, 860));
    };

    await step('3');
    await step('2');
    await step('1');
    this.el.countdownText.textContent = 'GO!';
    await new Promise((r) => setTimeout(r, 520));
  }

  updateHud(snapshot) {
    if (!snapshot) return;

    if (snapshot.modeId === 'track') {
      this.el.statAccuracyLabel.textContent = 'On target';
      this.el.statAccuracy.textContent = formatPct(snapshot.accuracy01 ?? 0);

      this.el.statResponseLabel.textContent = 'Avg reacquire';
      this.el.statResponse.textContent = formatMs(snapshot.avgResponseMs);
    } else {
      this.el.statAccuracyLabel.textContent = 'Accuracy';
      this.el.statAccuracy.textContent = formatPct(snapshot.accuracy01 ?? 0);

      this.el.statResponseLabel.textContent = 'Avg response';
      this.el.statResponse.textContent = formatMs(snapshot.avgResponseMs);
    }

    this.el.statExtraLabel.textContent = snapshot.extraLabel ?? '';
    this.el.statExtraValue.textContent = snapshot.extraValue ?? '';

    this.el.timerReadout.textContent = formatSeconds(snapshot.remaining === Infinity ? snapshot.elapsed : snapshot.remaining);

    if (this.el.fpsReadout) {
      const fps = Number(snapshot.fps ?? 0);
      this.el.fpsReadout.textContent = `${Math.round(fps)} FPS`;
    }

    if (this.el.timeBar) {
      const duration = Number(snapshot.duration ?? 0);
      const timed = Number.isFinite(duration) && duration > 0 && snapshot.remaining !== Infinity;
      this.el.timeBar.classList.toggle('hidden', !timed);

      if (timed) {
        const p = Math.max(0, Math.min(1, (snapshot.elapsed ?? 0) / duration));
        this.el.timeBar.style.setProperty('--p', p.toFixed(4));
      }
    }
  }

  _stripDetails(summary) {
    if (!summary || typeof summary !== 'object') return summary;
    const { details, ...rest } = summary;
    return rest;
  }

  onSessionEnd(summary) {
    this._lastResults = summary;

    this.playSound('end');

    this.setVisible({ hud: false, pause: false, countdown: false, results: true });

    // Store lightweight last-run only (details arrays can be large)
    storage.set(LASTRUN_KEY, { at: Date.now(), ...this._stripDetails(summary) });
    this._renderLastRun();

    this._renderResults(summary);
    requestAnimationFrame(() => this._drawResultsCharts(this._lastResults));

    // Disable buttons for 2 seconds to prevent accidental clicks after session is completed
    this.el.restartBtn.disabled = true;
    this.el.backBtn.disabled = true;
    setTimeout(() => {
      this.el.restartBtn.disabled = false;
      this.el.backBtn.disabled = false;
    }, 2000);
  }

  _renderResults(summary) {
    const modeName = summary.modeName ?? 'Session';
    const elapsed = Number(summary.elapsed ?? 0);

    const items = [{ label: 'Time', value: `${formatSeconds(elapsed)}s` }];

    if (summary.modeId === 'track') {
      items.push({ label: 'On target', value: formatPct(summary.accuracy01 ?? 0) });
      items.push({ label: 'Avg reacquire', value: formatMs(summary.avgResponseMs) });
      items.push({ label: 'Reacquires', value: String(summary.reacquireCount ?? 0) });
      items.push({ label: 'Shots', value: String(summary.shots ?? 0) });
      items.push({ label: 'Hits', value: String(summary.hits ?? 0) });
    } else {
      items.push({ label: 'Accuracy', value: formatPct(summary.accuracy01 ?? 0) });
      items.push({ label: 'Avg response', value: formatMs(summary.avgResponseMs) });
      items.push({ label: 'Hits', value: String(summary.hits ?? 0) });
      items.push({ label: 'Shots', value: String(summary.shots ?? 0) });
      items.push({ label: 'Best streak', value: String(summary.bestStreak ?? 0) });
    }

    const summaryHtml = items
      .map(
        (it) => `
        <div class="resItem">
          <div class="resLabel">${it.label}</div>
          <div class="resValue">${it.value}</div>
        </div>`
      )
      .join('');

    let chartsHtml = '';

    if (summary.modeId === 'snap' || summary.modeId === 'cluster') {
      const rts = summary.details?.reactionTimes ?? [];
      const st = summary.details?.streakTimeline ?? [];
      chartsHtml = `
        <div class="chartCard">
          <div class="chartHeader">
            <div class="chartTitle">Response times per shot</div>
            <div class="chartMeta">${rts.length} hits</div>
          </div>
          <canvas id="chartHitTiming" class="chartCanvas"></canvas>
        </div>

        <div class="chartCard">
          <div class="chartHeader">
            <div class="chartTitle">Streak timeline</div>
            <div class="chartMeta">${st.length} shots</div>
          </div>
          <canvas id="chartStreak" class="chartCanvas"></canvas>
        </div>
      `;
    } else if (summary.modeId === 'track') {
      const reacq = summary.details?.reacquireTimes ?? [];
      chartsHtml = `
        <div class="chartCard">
          <div class="chartHeader">
            <div class="chartTitle">Time on target breakdown</div>
            <div class="chartMeta">${formatPct(summary.accuracy01 ?? 0)}</div>
          </div>
          <canvas id="chartOnTarget" class="chartCanvas chartCanvasShort"></canvas>
        </div>

        <div class="chartCard">
          <div class="chartHeader">
            <div class="chartTitle">Reacquire times per attempt</div>
            <div class="chartMeta">${reacq.length} reacquires</div>
          </div>
          <canvas id="chartReacquire" class="chartCanvas"></canvas>
        </div>
      `;
    }

    this.el.resultsBody.innerHTML = `
      <div class="resultsGrid">
        <div class="resultsSummary">
          <div class="resultsSummaryTitle">${modeName}</div>
          <div class="resultsSummaryGrid">${summaryHtml}</div>
        </div>
        <div class="resultsChartsGrid">${chartsHtml}</div>
      </div>
    `;
  }

  _setupCanvas(canvas) {
    if (!canvas) return null;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = canvas.getBoundingClientRect();
    const w = Math.max(1, rect.width);
    const h = Math.max(1, rect.height);

    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);

    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    return { ctx, w, h };
  }

  _drawPlaceholder(ctx, w, h, text) {
    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.font = '12px system-ui, -apple-system, Segoe UI, Roboto, Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, w / 2, h / 2);
    ctx.restore();
  }

  _drawShotBars(canvasId, data, { maxMs = 1200 } = {}) {
    const canvas = document.getElementById(canvasId);
    const s = this._setupCanvas(canvas);
    if (!s) return;

    const { ctx, w, h } = s;
    const values = Array.isArray(data) ? data.filter((n) => Number.isFinite(n) && n >= 0) : [];
    if (values.length === 0) return this._drawPlaceholder(ctx, w, h, 'No shots recorded');

    const pad = 8;
    const labelH = 14;
    const innerW = w - pad * 2;
    const innerH = h - pad * 2 - labelH;

    const maxVal = Math.max(...values, maxMs);
    const barW = Math.max(2, Math.min(20, innerW / values.length - 1));
    const spacing = innerW / values.length;

    // Draw bars
    for (let i = 0; i < values.length; i++) {
      const val = values[i];
      const bh = (val / maxVal) * innerH;
      const x = pad + i * spacing + (spacing - barW) / 2;
      const y = pad + innerH - bh;

      ctx.fillStyle = 'rgba(255,255,255,0.78)';
      ctx.fillRect(x, y, barW, bh);
    }

    // Draw axis
    ctx.strokeStyle = 'rgba(255,255,255,0.22)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(pad, pad + innerH + 0.5);
    ctx.lineTo(pad + innerW, pad + innerH + 0.5);
    ctx.stroke();

    // Draw labels
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.font = '11px system-ui, -apple-system, Segoe UI, Roboto, Arial';
    ctx.textBaseline = 'top';
    ctx.textAlign = 'center';
    ctx.fillText(`${Math.round(maxVal)}ms max`, pad + innerW / 2, pad + innerH + 2);

    // Add hover tooltip
    let tooltipDiv = document.getElementById(`tooltip-${canvasId}`);
    if (!tooltipDiv) {
      tooltipDiv = document.createElement('div');
      tooltipDiv.id = `tooltip-${canvasId}`;
      tooltipDiv.style.cssText = 'position:absolute;background:rgba(0,0,0,0.9);color:#fff;padding:6px 10px;border-radius:6px;font-size:12px;pointer-events:none;display:none;z-index:9999;border:1px solid rgba(255,255,255,0.2);';
      canvas.parentElement.style.position = 'relative';
      canvas.parentElement.appendChild(tooltipDiv);
    }

    canvas.onmousemove = (e) => {
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;

      const idx = Math.floor((mx - pad) / spacing);
      if (idx >= 0 && idx < values.length && mx >= pad && mx <= pad + innerW && my >= pad && my <= pad + innerH) {
        const val = values[idx];
        tooltipDiv.textContent = `Shot ${idx + 1}: ${Math.round(val)}ms`;
        tooltipDiv.style.display = 'block';
        tooltipDiv.style.left = `${e.clientX - canvas.parentElement.getBoundingClientRect().left + 10}px`;
        tooltipDiv.style.top = `${e.clientY - canvas.parentElement.getBoundingClientRect().top - 30}px`;
      } else {
        tooltipDiv.style.display = 'none';
      }
    };

    canvas.onmouseleave = () => {
      tooltipDiv.style.display = 'none';
    };
  }

  _drawHistogram(canvasId, data, { binMs = 50, maxMs = 1200 } = {}) {
    const canvas = document.getElementById(canvasId);
    const s = this._setupCanvas(canvas);
    if (!s) return;

    const { ctx, w, h } = s;
    const values = Array.isArray(data) ? data.filter((n) => Number.isFinite(n) && n >= 0) : [];
    if (values.length < 2) return this._drawPlaceholder(ctx, w, h, 'Not enough data');

    const bin = Math.max(10, Math.round(binMs));
    const cap = Math.max(bin * 5, Math.round(maxMs / bin) * bin);
    const bins = Math.max(5, Math.ceil(cap / bin));

    const counts = new Array(bins).fill(0);
    for (const v of values) {
      const idx = Math.min(bins - 1, Math.floor(v / bin));
      counts[idx]++;
    }

    const maxCount = Math.max(...counts);
    if (maxCount <= 0) return this._drawPlaceholder(ctx, w, h, 'No data');

    const pad = 8;
    const labelH = 14;
    const innerW = w - pad * 2;
    const innerH = h - pad * 2 - labelH;

    const barW = innerW / bins;

    // Draw bars
    for (let i = 0; i < bins; i++) {
      const c = counts[i];
      if (c <= 0) continue;

      const bh = (c / maxCount) * innerH;
      const x = pad + i * barW + 1;
      const y = pad + innerH - bh;

      ctx.fillStyle = 'rgba(255,255,255,0.78)';
      ctx.fillRect(x, y, Math.max(1, barW - 2), bh);
    }

    // Draw axis
    ctx.strokeStyle = 'rgba(255,255,255,0.22)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(pad, pad + innerH + 0.5);
    ctx.lineTo(pad + innerW, pad + innerH + 0.5);
    ctx.stroke();

    // Draw labels
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.font = '11px system-ui, -apple-system, Segoe UI, Roboto, Arial';
    ctx.textBaseline = 'top';

    const midMs = Math.round((cap / 2) / bin) * bin;
    ctx.textAlign = 'left';
    ctx.fillText('0ms', pad, pad + innerH + 2);
    ctx.textAlign = 'center';
    ctx.fillText(`${midMs}ms`, pad + innerW / 2, pad + innerH + 2);
    ctx.textAlign = 'right';
    ctx.fillText(`${cap}ms`, pad + innerW, pad + innerH + 2);

    // Add hover tooltip
    let tooltipDiv = document.getElementById(`tooltip-${canvasId}`);
    if (!tooltipDiv) {
      tooltipDiv = document.createElement('div');
      tooltipDiv.id = `tooltip-${canvasId}`;
      tooltipDiv.style.cssText = 'position:absolute;background:rgba(0,0,0,0.9);color:#fff;padding:6px 10px;border-radius:6px;font-size:12px;pointer-events:none;display:none;z-index:9999;border:1px solid rgba(255,255,255,0.2);';
      canvas.parentElement.style.position = 'relative';
      canvas.parentElement.appendChild(tooltipDiv);
    }

    canvas.onmousemove = (e) => {
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;

      const binIdx = Math.floor((mx - pad) / barW);
      if (binIdx >= 0 && binIdx < bins && mx >= pad && mx <= pad + innerW && my >= pad && my <= pad + innerH) {
        const count = counts[binIdx];

        // Only show tooltip if there are hits in this bin
        if (count > 0) {
          const rangeStart = binIdx * bin;
          const rangeEnd = (binIdx + 1) * bin;

          tooltipDiv.textContent = `${rangeStart}-${rangeEnd}ms: ${count} hit${count !== 1 ? 's' : ''}`;
          tooltipDiv.style.display = 'block';
          tooltipDiv.style.left = `${e.clientX - canvas.parentElement.getBoundingClientRect().left + 10}px`;
          tooltipDiv.style.top = `${e.clientY - canvas.parentElement.getBoundingClientRect().top - 30}px`;
        } else {
          tooltipDiv.style.display = 'none';
        }
      } else {
        tooltipDiv.style.display = 'none';
      }
    };

    canvas.onmouseleave = () => {
      tooltipDiv.style.display = 'none';
    };
  }

  _drawLine(canvasId, points, { xMax, yMax } = {}) {
    const canvas = document.getElementById(canvasId);
    const s = this._setupCanvas(canvas);
    if (!s) return;

    const { ctx, w, h } = s;
    const pts = Array.isArray(points)
      ? points.filter((p) => p && Number.isFinite(p.t) && Number.isFinite(p.streak))
      : [];
    if (pts.length < 2) return this._drawPlaceholder(ctx, w, h, 'Not enough data');

    const pad = 10;
    const innerW = w - pad * 2;
    const innerH = h - pad * 2 - 14;

    const x1 = Number.isFinite(xMax) ? xMax : Math.max(...pts.map((p) => p.t));
    const y1 = Number.isFinite(yMax) ? yMax : Math.max(1, Math.max(...pts.map((p) => p.streak)));
    if (x1 <= 0 || y1 <= 0) return this._drawPlaceholder(ctx, w, h, 'Not enough data');

    const toX = (t) => pad + (t / x1) * innerW;
    const toY = (v) => pad + innerH - (v / y1) * innerH;

    ctx.strokeStyle = 'rgba(255,255,255,0.22)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(pad, pad + innerH + 0.5);
    ctx.lineTo(pad + innerW, pad + innerH + 0.5);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(255,255,255,0.88)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(toX(pts[0].t), toY(pts[0].streak));
    for (let i = 1; i < pts.length; i++) ctx.lineTo(toX(pts[i].t), toY(pts[i].streak));
    ctx.stroke();

    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.font = '11px system-ui, -apple-system, Segoe UI, Roboto, Arial';
    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';
    ctx.fillText('0s', pad, pad + innerH + 2);
    ctx.textAlign = 'right';
    ctx.fillText(`${formatSeconds(x1)}s`, pad + innerW, pad + innerH + 2);
  }

  _drawTimeline(canvasId, segments, elapsed) {
    const canvas = document.getElementById(canvasId);
    const s = this._setupCanvas(canvas);
    if (!s) return;

    const { ctx, w, h } = s;

    const segs = Array.isArray(segments)
      ? segments.filter((s) => s && Number.isFinite(s.start) && Number.isFinite(s.end) && s.end > s.start)
      : [];

    if (!Number.isFinite(elapsed) || elapsed <= 0 || segs.length === 0) {
      return this._drawPlaceholder(ctx, w, h, 'Not enough data');
    }

    const pad = 10;
    const innerW = w - pad * 2;
    const barH = Math.min(22, Math.max(14, h - 2 * pad));
    const y = Math.round(h / 2 - barH / 2);

    ctx.fillStyle = 'rgba(255,255,255,0.10)';
    ctx.fillRect(pad, y, innerW, barH);

    for (const seg of segs) {
      const x1 = pad + (seg.start / elapsed) * innerW;
      const x2 = pad + (seg.end / elapsed) * innerW;
      const ww = Math.max(0.6, x2 - x1);
      ctx.fillStyle = seg.on ? 'rgba(255,255,255,0.86)' : 'rgba(255,255,255,0.18)';
      ctx.fillRect(x1, y, ww, barH);
    }

    ctx.strokeStyle = 'rgba(255,255,255,0.22)';
    ctx.lineWidth = 1;
    ctx.strokeRect(pad + 0.5, y + 0.5, innerW - 1, barH - 1);

    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.font = '11px system-ui, -apple-system, Segoe UI, Roboto, Arial';
    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';
    ctx.fillText('0s', pad, y + barH + 4);
    ctx.textAlign = 'right';
    ctx.fillText(`${formatSeconds(elapsed)}s`, pad + innerW, y + barH + 4);
  }

  _drawResultsCharts(summary) {
    if (!summary) return;

    if (summary.modeId === 'snap' || summary.modeId === 'cluster') {
      const rts = summary.details?.reactionTimes ?? [];
      const st = summary.details?.streakTimeline ?? [];
      const elapsed = Number(summary.elapsed ?? 0);

      this._drawShotBars('chartHitTiming', rts, { maxMs: 1200 });
      this._drawLine('chartStreak', st, { xMax: elapsed, yMax: Number(summary.bestStreak ?? 0) || undefined });
    }

    if (summary.modeId === 'track') {
      const segs = summary.details?.segments ?? [];
      const reacq = summary.details?.reacquireTimes ?? [];
      const elapsed = Number(summary.elapsed ?? 0);

      this._drawTimeline('chartOnTarget', segs, elapsed);
      this._drawShotBars('chartReacquire', reacq, { maxMs: 2000 });
    }
  }

  _renderLastRun() {
    const lr = storage.get(LASTRUN_KEY, null);
    if (!lr) {
      this.el.lastRun.textContent = 'No previous session stored yet.';
      return;
    }

    const parts = [`<div><strong>Last session</strong> · ${new Date(lr.at).toLocaleString()}</div>`];

    if (lr.modeId === 'track') {
      parts.push(
        `<div>${lr.modeName ?? 'Task'} · ${formatSeconds(lr.elapsed ?? 0)}s · On-target ${formatPct(
          lr.accuracy01 ?? 0
        )} · Reacquire ${formatMs(lr.avgResponseMs)}</div>`
      );
      parts.push(`<div>Reacquires: ${lr.reacquireCount ?? 0}</div>`);
    } else {
      parts.push(
        `<div>${lr.modeName ?? 'Task'} · ${formatSeconds(lr.elapsed ?? 0)}s · ${formatPct(
          lr.accuracy01 ?? 0
        )} · ${formatMs(lr.avgResponseMs)}</div>`
      );
      parts.push(`<div>Hits/Shots: ${lr.hits ?? 0}/${lr.shots ?? 0} · Best streak: ${lr.bestStreak ?? 0}</div>`);
    }

    this.el.lastRun.innerHTML = parts.join('');
  }

  restart() {
    this._lastResults = null;
    this.setVisible({ results: false });
    this.startFromMenu();
  }

  backToMenu() {
    this._lastResults = null;
    this.game.exitToMenu();
    this.setVisible({ menu: true, hud: false, countdown: false, pause: false, results: false });
  }
}