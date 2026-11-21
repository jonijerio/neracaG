import { MonsterKind } from './types';

class GameAudioEngine {
  private ctx: AudioContext | null = null;
  private muted = false;
  private lastWarningTime = 0;

  private ensureContext(): AudioContext | null {
    if (this.muted || typeof window === 'undefined') return null;
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return null;
    if (!this.ctx) {
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public setMuted(muted: boolean): void {
    this.muted = muted;
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public unlock(): void {
    this.ensureContext();
  }

  public playStart(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    this.tone(ctx, 440, 554.37, 0.14, 'triangle', 0.08, now);
    this.tone(ctx, 554.37, 659.25, 0.18, 'triangle', 0.07, now + 0.07);
  }

  public playTargetEnter(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    this.tone(ctx, 520, 580, 0.08, 'sine', 0.04, now);
  }

  public playTargetComplete(combo: number): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const pitchScale = Math.pow(1.06, Math.min(combo - 1, 7));
    const base = 523.25 * pitchScale;
    this.tone(ctx, base, base * 1.02, 0.16, 'triangle', 0.11, now);
    this.tone(ctx, base * 1.25, base * 1.5, 0.24, 'sine', 0.09, now + 0.06);
  }

  public playWindTelegraph(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    this.tone(ctx, 220, 310, 0.22, 'sine', 0.04, now);
  }

  public playWindGust(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    // Filtered noise burst for gentle air gust
    const bufferSize = Math.floor(ctx.sampleRate * 0.45);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.sin((i / bufferSize) * Math.PI);
    }
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(520, now);
    filter.frequency.linearRampToValueAtTime(860, now + 0.22);
    filter.Q.value = 2.2;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.055, now + 0.12);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.44);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    source.start(now);
  }

  public playEdgeWarning(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    if (now - this.lastWarningTime < 0.45) return;
    this.lastWarningTime = now;
    this.tone(ctx, 340, 290, 0.09, 'sawtooth', 0.035, now);
  }

  public playImpact(intensity = 0.5): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const clamped = Math.max(0.2, Math.min(1, intensity));
    this.tone(ctx, 175 + clamped * 65, 72, 0.11, 'triangle', 0.05 + clamped * 0.06, now);
  }

  public playPowerUpCollect(type: 'slow_motion' | 'stabilizer'): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    if (type === 'slow_motion') {
      this.tone(ctx, 660, 440, 0.16, 'sine', 0.08, now);
      this.tone(ctx, 523.25, 783.99, 0.22, 'triangle', 0.07, now + 0.07);
    } else {
      this.tone(ctx, 440, 554.37, 0.14, 'triangle', 0.08, now);
      this.tone(ctx, 659.25, 880, 0.2, 'sine', 0.08, now + 0.06);
    }
  }

  public playMonsterTelegraph(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    this.tone(ctx, 330, 440, 0.11, 'triangle', 0.045, now);
    this.tone(ctx, 440, 587.33, 0.12, 'sine', 0.04, now + 0.09);
  }

  public playMonsterImpact(kind: MonsterKind): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    if (kind === 'alien') {
      this.tone(ctx, 740, 390, 0.24, 'sine', 0.06, now);
    } else if (kind === 'monkey') {
      this.tone(ctx, 320, 480, 0.11, 'triangle', 0.065, now);
    } else if (kind === 'human') {
      this.tone(ctx, 130, 58, 0.2, 'triangle', 0.095, now);
    } else if (kind === 'robot') {
      this.tone(ctx, 490, 260, 0.13, 'sawtooth', 0.045, now);
    } else if (kind === 'titan') {
      this.tone(ctx, 88, 34, 0.36, 'triangle', 0.14, now);
      this.tone(ctx, 145, 52, 0.24, 'sawtooth', 0.06, now + 0.015);
    } else {
      this.tone(ctx, 210, 145, 0.16, 'sine', 0.065, now);
    }
  }

  public playHeavyCollisionDistortion(intensity = 1): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const scale = Math.max(0.4, Math.min(1, intensity));
    this.tone(ctx, 110, 38, 0.34, 'sine', 0.12 * scale, now);
    this.tone(ctx, 220, 75, 0.22, 'triangle', 0.065 * scale, now + 0.02);
  }

  public playCoinEarned(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    this.tone(ctx, 987.77, 1318.51, 0.11, 'sine', 0.05, now + 0.05);
  }

  public playShopPurchase(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    this.tone(ctx, 523.25, 659.25, 0.1, 'triangle', 0.07, now);
    this.tone(ctx, 783.99, 1046.5, 0.16, 'sine', 0.07, now + 0.07);
  }

  public playBallFall(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    this.tone(ctx, 260, 110, 0.36, 'triangle', 0.13, now);
    this.tone(ctx, 140, 68, 0.32, 'sine', 0.12, now + 0.08);
  }

  private tone(
    ctx: AudioContext,
    startFreq: number,
    endFreq: number,
    duration: number,
    type: OscillatorType,
    volume: number,
    startTime: number
  ): void {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(startFreq, startTime);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), startTime + duration);

    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.linearRampToValueAtTime(volume, startTime + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(startTime);
    osc.stop(startTime + duration + 0.02);
  }
}

export const gameAudio = new GameAudioEngine();
