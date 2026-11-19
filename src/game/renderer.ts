import {
  AtmosphereState,
  computeAtmosphereFromProgress,
  levelToAtmosphereProgress,
} from './atmosphere';
import { ballBoardToWorld, clamp } from './physics';
import { SpecialRewardId } from './missions';
import { SKIN_PRESETS, SkinConfig, SkinId, getSkinConfig } from './skins';
import {
  GamePhase,
  MONSTER_PRESETS,
  MonsterEntity,
  PHYSICS_CONSTANTS,
  PhysicsState,
} from './types';

const C = PHYSICS_CONSTANTS;

const PARTICLE_POOL_SIZE = 2600;

const CONFETTI_PALETTE = [
  '#fde047',
  '#f59e0b',
  '#34d399',
  '#38bdf8',
  '#fb7185',
  '#c084fc',
  '#f472b6',
  '#f4f1ea',
] as const;

interface Particle {
  active: boolean;
  space: 'world' | 'screen';
  kind: 'spark' | 'confetti';
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  aspect: number;
  rotation: number;
  rotSpeed: number;
  flipSpeed: number;
  wobbleFreq: number;
  phase: number;
  color: string;
}

interface AmbientParticle {
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  gravity: number;
  life: number;
  maxLife: number;
  size: number;
  rotation: number;
  rotSpeed: number;
  color: string;
  shape: SkinConfig['fx']['particleShape'];
}

interface Shockwave {
  active: boolean;
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  life: number;
  maxLife: number;
  color: string;
}

interface FloatingCallout {
  active: boolean;
  x: number;
  y: number;
  vy: number;
  life: number;
  maxLife: number;
  text: string;
  color: string;
}

interface TrailNode {
  active: boolean;
  x: number;
  y: number;
  speed: number;
  age: number;
  maxAge: number;
}

export class BalanceRenderer {
  private skinId: SkinId = 'classic';
  private activeRewards: Set<SpecialRewardId> = new Set();
  private particles: Particle[];
  private particleCursor = 0;
  private ambientParticles: AmbientParticle[];
  private ambientCursor = 0;
  private ambientEmitAcc = 0;
  private shockwaves: Shockwave[];
  private shockwaveCursor = 0;
  private callouts: FloatingCallout[];
  private calloutCursor = 0;
  private trailNodes: TrailNode[];
  private trailCursor = 0;
  private lastTrailX = 0;
  private lastTrailY = 0;
  private hasLastTrail = false;
  private trauma = 0;
  private shakeImpulseX = 0;
  private shakeImpulseY = 0;
  private animTime = 0;
  private atmosphereProgress = 0;
  private targetAtmosphereProgress = 0;
  private lightningFlash = 0;
  private lightningCooldown = 2.4;
  private lastRenderWidth = 1280;
  private lastRenderHeight = 720;
  private gridCache: HTMLCanvasElement | null = null;
  private gridCacheW = 0;
  private gridCacheH = 0;

  constructor(initialSkin: SkinId = 'classic') {
    this.skinId = initialSkin in SKIN_PRESETS ? initialSkin : 'classic';
    this.particles = Array.from({ length: PARTICLE_POOL_SIZE }, () => ({
      active: false,
      space: 'world',
      kind: 'spark',
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      life: 0,
      maxLife: 1,
      size: 3,
      aspect: 1,
      rotation: 0,
      rotSpeed: 0,
      flipSpeed: 0,
      wobbleFreq: 0,
      phase: 0,
      color: '#e89b2d',
    }));
    this.ambientParticles = Array.from({ length: 56 }, () => ({
      active: false,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      gravity: 0,
      life: 0,
      maxLife: 1,
      size: 3,
      rotation: 0,
      rotSpeed: 0,
      color: '#f5c469',
      shape: 'circle',
    }));
    this.shockwaves = Array.from({ length: 8 }, () => ({
      active: false,
      x: 0,
      y: 0,
      radius: 10,
      maxRadius: 72,
      life: 0,
      maxLife: 0.45,
      color: '#f5c469',
    }));
    this.callouts = Array.from({ length: 8 }, () => ({
      active: false,
      x: 0,
      y: 0,
      vy: -38,
      life: 0,
      maxLife: 0.9,
      text: '',
      color: '#e89b2d',
    }));
    this.trailNodes = Array.from({ length: 20 }, () => ({
      active: false,
      x: 0,
      y: 0,
      speed: 0,
      age: 0,
      maxAge: 0.28,
    }));
  }

  public setSkin(skinId: SkinId): void {
    const next = skinId in SKIN_PRESETS ? skinId : 'classic';
    if (this.skinId !== next) {
      this.skinId = next;
      // Clear previous skin's ambient motes & trail so new skin's effects appear cleanly
      for (const a of this.ambientParticles) a.active = false;
      for (const t of this.trailNodes) t.active = false;
      this.hasLastTrail = false;
      this.ambientEmitAcc = 0;
    }
  }

  public getSkinId(): SkinId {
    return this.skinId;
  }

  public getSkin(): SkinConfig {
    return getSkinConfig(this.skinId);
  }

  public setActiveRewards(rewards: readonly SpecialRewardId[]): void {
    this.activeRewards = new Set(rewards);
  }

  public hasActiveReward(rewardId: SpecialRewardId): boolean {
    return this.activeRewards.has(rewardId);
  }

  public setAtmosphereLevel(level: number): void {
    this.targetAtmosphereProgress = levelToAtmosphereProgress(level);
  }

  public getAtmosphereState(): AtmosphereState {
    return computeAtmosphereFromProgress(this.atmosphereProgress);
  }

  public resetEffects(): void {
    for (const p of this.particles) p.active = false;
    for (const a of this.ambientParticles) a.active = false;
    for (const s of this.shockwaves) s.active = false;
    for (const c of this.callouts) c.active = false;
    for (const t of this.trailNodes) t.active = false;
    this.hasLastTrail = false;
    this.ambientEmitAcc = 0;
    this.trauma = 0;
    this.shakeImpulseX = 0;
    this.shakeImpulseY = 0;
    this.atmosphereProgress = 0;
    this.targetAtmosphereProgress = 0;
    this.lightningFlash = 0;
    this.lightningCooldown = 2.4;
  }

  public hasActiveEffects(): boolean {
    if (
      this.trauma > 0.005 ||
      Math.abs(this.shakeImpulseX) > 0.1 ||
      Math.abs(this.shakeImpulseY) > 0.1
    ) {
      return true;
    }
    for (let i = 0; i < this.particles.length; i++) {
      if (this.particles[i].active) return true;
    }
    for (let i = 0; i < this.ambientParticles.length; i++) {
      if (this.ambientParticles[i].active) return true;
    }
    for (let i = 0; i < this.shockwaves.length; i++) {
      if (this.shockwaves[i].active) return true;
    }
    for (let i = 0; i < this.callouts.length; i++) {
      if (this.callouts[i].active) return true;
    }
    for (let i = 0; i < this.trailNodes.length; i++) {
      if (this.trailNodes[i].active) return true;
    }
    return false;
  }

  public getActiveAmbientCount(): number {
    let count = 0;
    for (let i = 0; i < this.ambientParticles.length; i++) {
      if (this.ambientParticles[i].active) count += 1;
    }
    return count;
  }

  public getActiveParticleCount(): number {
    let count = 0;
    for (let i = 0; i < this.particles.length; i++) {
      if (this.particles[i].active) count += 1;
    }
    return count;
  }

  public getActiveShockwaveCount(): number {
    let count = 0;
    for (let i = 0; i < this.shockwaves.length; i++) {
      if (this.shockwaves[i].active) count += 1;
    }
    return count;
  }

  public emitAmbientForBall(worldX: number, worldY: number, speed: number, dt: number): void {
    const skin = this.getSkin();
    const speedFactor = clamp(Math.abs(speed) / 140, 0, 2.2);
    const effectiveRate = skin.fx.emitRate * (0.65 + speedFactor);
    this.ambientEmitAcc += effectiveRate * dt;

    let emitted = 0;
    while (this.ambientEmitAcc >= 1 && emitted < 4) {
      this.ambientEmitAcc -= 1;
      emitted += 1;

      const a = this.ambientParticles[this.ambientCursor];
      this.ambientCursor = (this.ambientCursor + 1) % this.ambientParticles.length;

      const angle = Math.random() * Math.PI * 2;
      const offsetR = C.BALL_RADIUS * (0.4 + Math.random() * 0.85);
      const colors = skin.fx.particleColors;
      a.active = true;
      a.x = worldX + Math.cos(angle) * offsetR;
      a.y = worldY + Math.sin(angle) * offsetR;
      a.vx = (Math.random() - 0.5) * skin.fx.particleDrift - speed * 0.08;
      a.vy = (Math.random() - 0.5) * 24 + (skin.fx.particleGravity < 0 ? -18 : 10);
      a.gravity = skin.fx.particleGravity;
      a.life = 0;
      a.maxLife = 0.45 + Math.random() * 0.55;
      a.size = 2.2 + Math.random() * 2.8;
      a.rotation = Math.random() * Math.PI * 2;
      a.rotSpeed = (Math.random() - 0.5) * 6;
      a.color = colors[Math.floor(Math.random() * colors.length)];
      a.shape = skin.fx.particleShape;
    }
  }

  public spawnShockwave(worldX: number, worldY: number, color?: string, maxRadius = 68): void {
    const s = this.shockwaves[this.shockwaveCursor];
    this.shockwaveCursor = (this.shockwaveCursor + 1) % this.shockwaves.length;
    s.active = true;
    s.x = worldX;
    s.y = worldY;
    s.radius = C.BALL_RADIUS * 0.7;
    s.maxRadius = maxRadius;
    s.life = 0;
    s.maxLife = 0.42;
    s.color = color ?? this.getSkin().fx.shockwaveColor;
  }

  public recordTrailPoint(worldX: number, worldY: number, speed: number): void {
    const absSpeed = Math.abs(speed);
    if (absSpeed < 32) {
      this.hasLastTrail = false;
      return;
    }
    if (this.hasLastTrail) {
      const dx = worldX - this.lastTrailX;
      const dy = worldY - this.lastTrailY;
      if (dx * dx + dy * dy < 20) {
        return;
      }
    }
    const node = this.trailNodes[this.trailCursor];
    this.trailCursor = (this.trailCursor + 1) % this.trailNodes.length;
    node.active = true;
    node.x = worldX;
    node.y = worldY;
    node.speed = absSpeed;
    node.age = 0;
    node.maxAge = clamp(0.2 + absSpeed / 920, 0.22, 0.38);

    this.lastTrailX = worldX;
    this.lastTrailY = worldY;
    this.hasLastTrail = true;
  }

  public getActiveTrailCount(): number {
    let count = 0;
    for (let i = 0; i < this.trailNodes.length; i++) {
      if (this.trailNodes[i].active) count += 1;
    }
    return count;
  }

  public addTrauma(amount: number): void {
    this.trauma = Math.min(1, this.trauma + Math.max(0, amount));
  }

  public triggerImpactShake(intensity: number, dirX = 0, dirY = 0): void {
    const clamped = clamp(intensity, 0, 1);
    this.addTrauma(clamped * 0.85);
    this.shakeImpulseX = clamp(this.shakeImpulseX + dirX * clamped * 11, -18, 18);
    this.shakeImpulseY = clamp(this.shakeImpulseY + dirY * clamped * 9, -14, 14);
  }

  public getTrauma(): number {
    return this.trauma;
  }

  public getShakeOffsets(): { x: number; y: number; angle: number } {
    const shake = this.trauma * this.trauma;
    if (shake <= 0.001 && Math.abs(this.shakeImpulseX) <= 0.05 && Math.abs(this.shakeImpulseY) <= 0.05) {
      return { x: 0, y: 0, angle: 0 };
    }
    const oscX = Math.sin(this.animTime * 61.3 + 0.7) * 14 * shake;
    const oscY = Math.cos(this.animTime * 73.1 + 1.9) * 11 * shake;
    const angle = Math.sin(this.animTime * 53.7) * 0.018 * shake;
    return {
      x: oscX + this.shakeImpulseX,
      y: oscY + this.shakeImpulseY,
      angle,
    };
  }

  public spawnBurst(worldX: number, worldY: number, count: number, color?: string): void {
    const fallbackColors = this.getSkin().fx.particleColors;
    for (let i = 0; i < count; i++) {
      const p = this.particles[this.particleCursor];
      this.particleCursor = (this.particleCursor + 1) % this.particles.length;
      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.45;
      const speed = 55 + Math.random() * 145;
      p.active = true;
      p.space = 'world';
      p.kind = 'spark';
      p.x = worldX;
      p.y = worldY;
      p.vx = Math.cos(angle) * speed;
      p.vy = Math.sin(angle) * speed - 40;
      p.life = 0;
      p.maxLife = 0.45 + Math.random() * 0.35;
      p.size = 2.4 + Math.random() * 2.8;
      p.aspect = 1;
      p.rotation = 0;
      p.rotSpeed = 0;
      p.flipSpeed = 0;
      p.wobbleFreq = 0;
      p.phase = 0;
      p.color = color ?? fallbackColors[i % fallbackColors.length];
    }
  }

  /**
   * Triggers a full-screen confetti explosion using thousands of small particles
   * allocated from the existing canvas particle ring buffer.
   */
  public spawnConfettiExplosion(
    count = 2000,
    width = this.lastRenderWidth,
    height = this.lastRenderHeight
  ): void {
    const w = Math.max(320, width);
    const h = Math.max(240, height);
    const total = clamp(Math.round(count), 1, this.particles.length);
    const skinColors = this.getSkin().fx.particleColors;
    const minDim = Math.min(w, h);

    // 5 simultaneous burst origins across the viewport + full-screen scatter
    const cannons = [
      { cx: w * 0.5, cy: h * 0.46 },
      { cx: w * 0.18, cy: h * 0.38 },
      { cx: w * 0.82, cy: h * 0.38 },
      { cx: w * 0.32, cy: h * 0.72 },
      { cx: w * 0.68, cy: h * 0.72 },
    ];

    for (let i = 0; i < total; i++) {
      const p = this.particles[this.particleCursor];
      this.particleCursor = (this.particleCursor + 1) % this.particles.length;

      const isScatter = i % 5 === 0;
      const cannon = cannons[i % cannons.length];
      const angle = Math.random() * Math.PI * 2;
      const speed = isScatter
        ? 90 + Math.random() * (minDim * 0.65)
        : 180 + Math.random() * (minDim * 1.15);

      p.active = true;
      p.space = 'screen';
      p.kind = 'confetti';
      p.x = isScatter ? Math.random() * w : cannon.cx + (Math.random() - 0.5) * 32;
      p.y = isScatter ? Math.random() * h * 0.88 : cannon.cy + (Math.random() - 0.5) * 28;
      p.vx = Math.cos(angle) * speed;
      p.vy = Math.sin(angle) * speed - (isScatter ? 110 : 190);
      p.life = 0;
      p.maxLife = 1.9 + Math.random() * 1.65;
      p.size = 1.8 + Math.random() * 2.2;
      p.aspect = 0.45 + Math.random() * 0.45;
      p.rotation = Math.random() * Math.PI * 2;
      p.rotSpeed = (Math.random() - 0.5) * 14;
      p.flipSpeed = 6 + Math.random() * 9;
      p.wobbleFreq = 4 + Math.random() * 5;
      p.phase = Math.random() * Math.PI * 2;
      p.color =
        i % 4 === 0
          ? skinColors[i % skinColors.length]
          : CONFETTI_PALETTE[i % CONFETTI_PALETTE.length];
    }
  }

  public spawnCallout(worldX: number, worldY: number, text: string, color = '#f5c469'): void {
    const c = this.callouts[this.calloutCursor];
    this.calloutCursor = (this.calloutCursor + 1) % this.callouts.length;
    c.active = true;
    c.x = worldX;
    c.y = worldY - 26;
    c.vy = -44;
    c.life = 0;
    c.maxLife = 0.95;
    c.text = text;
    c.color = color;
  }

  public tickVisuals(dt: number): void {
    this.animTime += dt;
    const atmoDiff = this.targetAtmosphereProgress - this.atmosphereProgress;
    if (Math.abs(atmoDiff) > 0.0005) {
      this.atmosphereProgress += atmoDiff * Math.min(1, dt * 1.6);
    } else {
      this.atmosphereProgress = this.targetAtmosphereProgress;
    }

    this.lightningFlash = Math.max(0, this.lightningFlash - dt * 4.8);
    const atmo = this.getAtmosphereState();
    if (atmo.lightningChance > 0.02) {
      this.lightningCooldown -= dt;
      if (this.lightningCooldown <= 0) {
        this.lightningFlash = 0.72 + Math.random() * 0.28;
        this.lightningCooldown = Math.max(1.1, 3.6 - atmo.lightningChance * 2.2 + Math.random() * 2.4);
      }
    }

    this.trauma = Math.max(0, this.trauma - dt * 2.1);
    const impulseDecay = Math.exp(-14 * dt);
    this.shakeImpulseX *= impulseDecay;
    this.shakeImpulseY *= impulseDecay;

    for (let i = 0; i < this.trailNodes.length; i++) {
      const t = this.trailNodes[i];
      if (!t.active) continue;
      t.age += dt;
      if (t.age >= t.maxAge) {
        t.active = false;
      }
    }

    for (let i = 0; i < this.ambientParticles.length; i++) {
      const a = this.ambientParticles[i];
      if (!a.active) continue;
      a.life += dt;
      if (a.life >= a.maxLife) {
        a.active = false;
        continue;
      }
      a.vy += a.gravity * dt;
      a.x += a.vx * dt;
      a.y += a.vy * dt;
      a.rotation += a.rotSpeed * dt;
    }

    for (let i = 0; i < this.shockwaves.length; i++) {
      const s = this.shockwaves[i];
      if (!s.active) continue;
      s.life += dt;
      if (s.life >= s.maxLife) {
        s.active = false;
        continue;
      }
      const prog = s.life / s.maxLife;
      const eased = 1 - (1 - prog) * (1 - prog);
      s.radius = C.BALL_RADIUS * 0.7 + (s.maxRadius - C.BALL_RADIUS * 0.7) * eased;
    }

    const confettiDrag = Math.exp(-2.05 * dt);
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      if (!p.active) continue;
      p.life += dt;
      if (p.life >= p.maxLife) {
        p.active = false;
        continue;
      }
      if (p.kind === 'confetti') {
        p.vx *= confettiDrag;
        p.vy = p.vy * confettiDrag + 215 * dt;
        p.x += (p.vx + Math.sin(p.life * p.wobbleFreq + p.phase) * 44) * dt;
        p.y += p.vy * dt;
        p.rotation += p.rotSpeed * dt;
      } else {
        p.vy += 260 * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
      }
    }

    for (let i = 0; i < this.callouts.length; i++) {
      const c = this.callouts[i];
      if (!c.active) continue;
      c.life += dt;
      if (c.life >= c.maxLife) {
        c.active = false;
        continue;
      }
      c.y += c.vy * dt;
    }
  }

  private ensureGridCache(width: number, height: number): HTMLCanvasElement | null {
    if (typeof document === 'undefined') return null;
    const w = Math.max(1, Math.round(width));
    const h = Math.max(1, Math.round(height));
    if (this.gridCache && this.gridCacheW === w && this.gridCacheH === h) {
      return this.gridCache;
    }
    const offscreen = this.gridCache ?? document.createElement('canvas');
    offscreen.width = w;
    offscreen.height = h;
    const octx = offscreen.getContext('2d');
    if (!octx) return null;

    octx.clearRect(0, 0, w, h);
    this.drawDraftingGrid(octx, w, h);

    this.gridCache = offscreen;
    this.gridCacheW = w;
    this.gridCacheH = h;
    return offscreen;
  }

  public render(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    state: PhysicsState,
    phase: GamePhase,
    skinId?: SkinId
  ): void {
    if (skinId) {
      this.setSkin(skinId);
    }
    this.lastRenderWidth = width;
    this.lastRenderHeight = height;
    const skin = this.getSkin();
    this.setAtmosphereLevel(phase === 'title' ? 1 : state.level);

    ctx.save();

    // Compute layout center & scale so board fits comfortably on any viewport
    const isDesktopTitle = phase === 'title' && width >= 900;
    const fulcrumScreenX = isDesktopTitle ? width * 0.65 : width * 0.5;
    const fulcrumScreenY = phase === 'title' && width < 900 ? height * 0.69 : height * 0.54;

    // 1. Dynamic Level-Based Sky Background (Calm Sunrise -> Stormy Night)
    const sunScreenX = isDesktopTitle ? width * 0.84 : width * 0.22;
    this.drawDynamicBackground(ctx, width, height, state, sunScreenX);

    const availW = isDesktopTitle ? width * 0.58 : width * 0.9;
    const availH = height * 0.72;
    const scale = clamp(Math.min(availW / 620, availH / 380), 0.52, 1.45);

    // Screen trauma + directional impact shake
    const shakeOffset = this.getShakeOffsets();

    ctx.translate(fulcrumScreenX + shakeOffset.x, fulcrumScreenY + shakeOffset.y);
    if (shakeOffset.angle !== 0) {
      ctx.rotate(shakeOffset.angle);
    }
    ctx.scale(scale, scale);

    // 2. Protractor Arc & Fulcrum Stand (Stationary world space)
    this.drawProtractorAndFulcrum(ctx, state, skin);

    // 3. Wind Telegraphs & Gust Streaks (behind & around board)
    if (phase !== 'title') {
      this.drawWindEffects(ctx, state);
    }

    // 4. Tilting Board, Target Zone, Power-Up Collectible & Balance-Disturbing Monsters
    ctx.save();
    ctx.rotate(state.boardAngle);
    this.drawBoard(ctx, state, phase, skin);
    if (phase !== 'title' && state.powerUp) {
      this.drawPowerUpCollectible(ctx, state);
    }
    if (phase !== 'title' && state.monsters.length > 0) {
      this.drawMonsters(ctx, state);
    }
    ctx.restore();

    // 5. Ambient Skin Particles, Shockwave Rings, Ball Motion Trail & Rolling/Falling Ball
    this.drawAmbientParticles(ctx);
    this.drawShockwaves(ctx);
    this.drawMotionTrail(ctx, state, skin);
    this.drawBall(ctx, state, skin);

    // 6. Pooled Impact Particles & Score Callouts (world space)
    this.drawParticlesAndCallouts(ctx);

    ctx.restore();

    // 7. Full-Screen Confetti Explosion Particles (screen space)
    this.drawScreenParticles(ctx);
  }

  private drawDynamicBackground(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    state: PhysicsState,
    sunCenterX: number
  ): void {
    const atmo = this.getAtmosphereState();

    // Base sky gradient
    const skyGrad = ctx.createLinearGradient(0, 0, 0, height);
    skyGrad.addColorStop(0, atmo.skyTop);
    skyGrad.addColorStop(0.55, atmo.skyMid);
    skyGrad.addColorStop(1, atmo.skyHorizon);
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, width, height);

    // Subtle atmospheric horizon / sun glow
    if (atmo.glowAlpha > 0.01) {
      const sunY = height * atmo.sunYNorm;
      const glowGrad = ctx.createRadialGradient(
        sunCenterX,
        sunY,
        12,
        sunCenterX,
        sunY,
        Math.max(width, height) * 0.62
      );
      glowGrad.addColorStop(0, atmo.glowColor);
      glowGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.save();
      ctx.globalAlpha = atmo.glowAlpha;
      ctx.fillStyle = glowGrad;
      ctx.fillRect(0, 0, width, height);
      ctx.restore();
    }

    // Distant stars emerging from dusk into night
    if (atmo.starAlpha > 0.02) {
      ctx.save();
      ctx.fillStyle = '#f8fafc';
      for (let i = 0; i < 28; i++) {
        const sx = (((i * 197 + 43) % 997) / 997) * width;
        const sy = (((i * 313 + 79) % 547) / 547) * (height * 0.64);
        const twinkle = 0.45 + 0.55 * Math.sin(this.animTime * 2.1 + i * 1.9);
        ctx.globalAlpha = atmo.starAlpha * twinkle;
        const size = i % 5 === 0 ? 1.8 : 1.1;
        ctx.beginPath();
        ctx.arc(sx, sy, size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // Rising / setting sun disc
    if (atmo.sunOpacity > 0.03) {
      const sunY = height * atmo.sunYNorm;
      ctx.save();
      ctx.globalAlpha = atmo.sunOpacity * 0.25;
      ctx.fillStyle = atmo.sunColor;
      ctx.beginPath();
      ctx.arc(sunCenterX, sunY, atmo.sunRadius * 1.65, 0, Math.PI * 2);
      ctx.fill();

      ctx.globalAlpha = atmo.sunOpacity * 0.85;
      ctx.beginPath();
      ctx.arc(sunCenterX, sunY, atmo.sunRadius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Drifting clouds (soft morning wisps -> heavy storm deck)
    if (atmo.cloudAlpha > 0.02) {
      ctx.save();
      ctx.fillStyle = atmo.cloudTint;
      const spanW = width + 420;
      for (let i = 0; i < 6; i++) {
        const baseSpeed = atmo.cloudSpeed * (0.75 + (i % 3) * 0.22);
        const cx = ((i * 290 + this.animTime * baseSpeed) % spanW) - 210;
        const cy = height * (0.14 + (i % 3) * 0.13) + Math.sin(this.animTime * 0.4 + i) * 6;
        const rx = 125 + (i % 3) * 48;
        const ry = 20 + (i % 2) * 10;
        ctx.globalAlpha = atmo.cloudAlpha * (i % 2 === 0 ? 0.36 : 0.26);
        ctx.beginPath();
        ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = atmo.cloudAlpha * 0.28;
        ctx.beginPath();
        ctx.ellipse(cx + rx * 0.38, cy - ry * 0.35, rx * 0.56, ry * 0.82, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(cx - rx * 0.34, cy - ry * 0.22, rx * 0.48, ry * 0.72, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // Stormy night lightning flash & distant bolt
    if (this.lightningFlash > 0.02) {
      ctx.save();
      ctx.globalAlpha = this.lightningFlash * 0.2;
      ctx.fillStyle = '#bae6fd';
      ctx.fillRect(0, 0, width, height);

      ctx.globalAlpha = this.lightningFlash * 0.65;
      ctx.strokeStyle = '#e0f2fe';
      ctx.lineWidth = 2.2;
      const bx = width * 0.22;
      ctx.beginPath();
      ctx.moveTo(bx, height * 0.06);
      ctx.lineTo(bx - 16, height * 0.19);
      ctx.lineTo(bx + 10, height * 0.23);
      ctx.lineTo(bx - 12, height * 0.39);
      ctx.stroke();
      ctx.restore();
    }

    // Storm rain streaks
    if (atmo.rainIntensity > 0.04) {
      const dropCount = Math.round(atmo.rainIntensity * 72);
      const windTilt = state.windPhase === 'active' ? state.windDir * 5.5 : -2.6;
      ctx.save();
      ctx.strokeStyle = `rgba(186, 230, 253, ${0.14 + atmo.rainIntensity * 0.24})`;
      ctx.lineWidth = 1.25;
      ctx.beginPath();
      for (let i = 0; i < dropCount; i++) {
        const seedX = ((i * 151 + 29) % 1009) / 1009;
        const speedY = 480 + (i % 5) * 90;
        const yOff = ((this.animTime * speedY + i * 73) % (height + 40)) - 20;
        const xOff = (seedX * width + this.animTime * windTilt * 32 + width * 4) % width;
        const len = 14 + atmo.rainIntensity * 14;
        ctx.moveTo(xOff, yOff);
        ctx.lineTo(xOff + windTilt * 1.4, yOff + len);
      }
      ctx.stroke();
      ctx.restore();
    }

    // Subtle top HUD readability vignette
    const topScrim = ctx.createLinearGradient(0, 0, 0, 108);
    topScrim.addColorStop(0, 'rgba(10, 14, 22, 0.45)');
    topScrim.addColorStop(1, 'rgba(10, 14, 22, 0)');
    ctx.fillStyle = topScrim;
    ctx.fillRect(0, 0, width, 108);

    // Cached architectural drafting grid overlay
    const cachedGrid = this.ensureGridCache(width, height);
    if (cachedGrid) {
      ctx.save();
      ctx.globalAlpha = atmo.gridAlpha / 0.032;
      ctx.drawImage(cachedGrid, 0, 0, width, height);
      ctx.restore();
    }
  }

  private drawDraftingGrid(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const step = 48;
    ctx.strokeStyle = 'rgba(244, 241, 234, 0.032)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = (width % step) * 0.5; x < width; x += step) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
    }
    for (let y = (height % step) * 0.5; y < height; y += step) {
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
    }
    ctx.stroke();
  }

  private drawProtractorAndFulcrum(
    ctx: CanvasRenderingContext2D,
    state: PhysicsState,
    skin: SkinConfig
  ): void {
    const arcRadius = 155;
    const maxDeg = 26;

    // Subtle skin-tinted protractor arc below the board
    ctx.save();
    ctx.strokeStyle = skin.fulcrum.arcColor;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0, 0, arcRadius, Math.PI * 0.5 - (maxDeg * Math.PI) / 180, Math.PI * 0.5 + (maxDeg * Math.PI) / 180);
    ctx.stroke();

    // Degree ticks aligned with needle sign (positive angle = right side)
    for (let deg = -25; deg <= 25; deg += 5) {
      const rad = Math.PI * 0.5 - (deg * Math.PI) / 180;
      const inner = deg % 10 === 0 ? arcRadius - 10 : arcRadius - 5;
      ctx.strokeStyle = deg === 0 ? skin.fulcrum.needleColor : 'rgba(244, 241, 234, 0.2)';
      ctx.lineWidth = deg === 0 ? 2 : 1;
      ctx.beginPath();
      ctx.moveTo(Math.cos(rad) * inner, Math.sin(rad) * inner);
      ctx.lineTo(Math.cos(rad) * arcRadius, Math.sin(rad) * arcRadius);
      ctx.stroke();
    }

    // Live angle pointer needle drawn behind pedestal, emerging cleanly beneath baseplate
    const needleRad = Math.PI * 0.5 - state.boardAngle;
    ctx.strokeStyle = skin.fulcrum.needleColor;
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(Math.cos(needleRad) * 94, Math.sin(needleRad) * 94);
    ctx.lineTo(Math.cos(needleRad) * (arcRadius - 12), Math.sin(needleRad) * (arcRadius - 12));
    ctx.stroke();

    // Diegetic degree readout under arc
    const degVal = Math.round((state.boardAngle * 180) / Math.PI);
    ctx.fillStyle = 'rgba(244, 241, 234, 0.65)';
    ctx.font = '600 12px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`${degVal > 0 ? '+' : ''}${degVal}°`, 0, arcRadius + 22);

    // Fulcrum Pedestal Triangle
    ctx.fillStyle = skin.fulcrum.pedestalFill;
    ctx.strokeStyle = skin.fulcrum.pedestalStroke;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, 8);
    ctx.lineTo(-34, 78);
    ctx.lineTo(34, 78);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Pedestal base plate
    ctx.fillStyle = skin.fulcrum.baseFill;
    ctx.strokeStyle = skin.fulcrum.baseStroke;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(-52, 78, 104, 12, 4);
    ctx.fill();
    ctx.stroke();

    // Center gimbal pin
    ctx.fillStyle = skin.fulcrum.gimbalColor;
    ctx.beginPath();
    ctx.arc(0, 0, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#181e25';
    ctx.beginPath();
    ctx.arc(0, 0, 4, 0, Math.PI * 2);
    ctx.fill();

    // Unlocked Special Reward: Lencana Master Neraca engraved golden star on pedestal
    if (this.activeRewards.has('master_badge')) {
      ctx.fillStyle = '#facc15';
      ctx.beginPath();
      const cy = 54;
      const outer = 6.2;
      const inner = 2.7;
      for (let i = 0; i < 10; i++) {
        const ang = -Math.PI * 0.5 + (Math.PI * i) / 5;
        const rad = i % 2 === 0 ? outer : inner;
        const x = Math.cos(ang) * rad;
        const y = cy + Math.sin(ang) * rad;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fill();
    }

    ctx.restore();
  }

  private drawBoard(
    ctx: CanvasRenderingContext2D,
    state: PhysicsState,
    phase: GamePhase,
    skin: SkinConfig
  ): void {
    const halfLen = C.BOARD_HALF_LEN;
    const thick = C.BOARD_THICKNESS;
    const halfThick = thick * 0.5;

    // Optional outer skin aura around the beam
    if (skin.board.glowColor) {
      const pulse = 0.75 + 0.25 * Math.sin(this.animTime * 3.4);
      ctx.save();
      ctx.globalAlpha = pulse;
      ctx.fillStyle = skin.board.glowColor;
      ctx.beginPath();
      ctx.roundRect(-halfLen - 4, -halfThick - 4, halfLen * 2 + 8, thick + 8, 9);
      ctx.fill();
      ctx.restore();
    }

    // Board drop shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.beginPath();
    ctx.roundRect(-halfLen + 2, -halfThick + 6, halfLen * 2, thick, 6);
    ctx.fill();

    // Main beam body gradient (or prismatic shifting gradient for prism)
    if (skin.board.pattern === 'prism') {
      const prismGrad = ctx.createLinearGradient(-halfLen, 0, halfLen, 0);
      const shift = (this.animTime * 0.16) % 1;
      prismGrad.addColorStop(0, `hsl(${Math.round(shift * 360)}, 85%, 72%)`);
      prismGrad.addColorStop(0.25, `hsl(${Math.round((shift * 360 + 90) % 360)}, 85%, 72%)`);
      prismGrad.addColorStop(0.5, `hsl(${Math.round((shift * 360 + 180) % 360)}, 85%, 72%)`);
      prismGrad.addColorStop(0.75, `hsl(${Math.round((shift * 360 + 270) % 360)}, 85%, 72%)`);
      prismGrad.addColorStop(1, `hsl(${Math.round(shift * 360)}, 85%, 72%)`);
      ctx.fillStyle = prismGrad;
    } else {
      const beamGrad = ctx.createLinearGradient(0, -halfThick, 0, halfThick);
      beamGrad.addColorStop(0, skin.board.gradTop);
      beamGrad.addColorStop(0.32, skin.board.gradMid);
      beamGrad.addColorStop(1, skin.board.gradBottom);
      ctx.fillStyle = beamGrad;
    }

    ctx.beginPath();
    ctx.roundRect(-halfLen, -halfThick, halfLen * 2, thick, 6);
    ctx.fill();

    // Clipped skin-specific board surface detail pattern
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(-halfLen + 14, -halfThick, (halfLen - 14) * 2, thick, 4);
    ctx.clip();
    this.drawBoardPattern(ctx, halfLen, halfThick, thick, skin);
    ctx.restore();

    // Top running rail highlight
    ctx.fillStyle = skin.board.railColor;
    ctx.fillRect(-halfLen + 14, -halfThick, (halfLen - 14) * 2, 3);

    // Subtle measurement ruler ticks along the beam
    ctx.strokeStyle = skin.board.tickColor;
    ctx.lineWidth = 1;
    for (let x = -220; x <= 220; x += 20) {
      const h = x === 0 ? 9 : x % 60 === 0 ? 7 : 4;
      ctx.beginPath();
      ctx.moveTo(x, -halfThick + 3);
      ctx.lineTo(x, -halfThick + 3 + h);
      ctx.stroke();
    }

    // End-caps with danger glow when ball approaches edge
    const leftDanger = state.ballX < 0 ? state.edgeDanger : 0;
    const rightDanger = state.ballX > 0 ? state.edgeDanger : 0;

    this.drawEndCap(ctx, -halfLen, -halfThick, 16, thick, leftDanger, true, skin);
    this.drawEndCap(ctx, halfLen - 16, -halfThick, 16, thick, rightDanger, false, skin);

    // Target Zone Inset Plate (active in playing / paused / gameover)
    if (phase !== 'title') {
      this.drawTargetZone(ctx, state);
    }

    // Center pivot collar on the beam
    ctx.fillStyle = skin.board.collarFill;
    ctx.strokeStyle = skin.board.collarStroke;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(-14, -halfThick - 1, 28, thick + 2, 4);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = skin.board.collarPin;
    ctx.beginPath();
    ctx.arc(0, 0, 5.5, 0, Math.PI * 2);
    ctx.fill();
  }

  private drawBoardPattern(
    ctx: CanvasRenderingContext2D,
    halfLen: number,
    halfThick: number,
    thick: number,
    skin: SkinConfig
  ): void {
    const t = this.animTime;
    const pattern = skin.board.pattern;

    if (pattern === 'wood') {
      ctx.strokeStyle = 'rgba(40, 20, 8, 0.28)';
      ctx.lineWidth = 1.2;
      for (let y = -4; y <= 6; y += 5) {
        ctx.beginPath();
        ctx.moveTo(-halfLen + 16, y);
        ctx.bezierCurveTo(-90, y - 2, 90, y + 2, halfLen - 16, y);
        ctx.stroke();
      }
      return;
    }

    if (pattern === 'circuit') {
      const pulse = 0.45 + 0.35 * Math.sin(t * 4);
      ctx.strokeStyle = `rgba(34, 211, 238, ${pulse})`;
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      for (let x = -220; x <= 220; x += 55) {
        ctx.moveTo(x, -2);
        ctx.lineTo(x + 18, -2);
        ctx.lineTo(x + 26, 4);
        ctx.lineTo(x + 48, 4);
      }
      ctx.stroke();
      ctx.fillStyle = '#f472b6';
      for (let x = -220; x <= 220; x += 55) {
        ctx.beginPath();
        ctx.arc(x + 48, 4, 1.8, 0, Math.PI * 2);
        ctx.fill();
      }
      return;
    }

    if (pattern === 'lava') {
      const glow = 0.55 + 0.4 * Math.sin(t * 5.2);
      ctx.strokeStyle = `rgba(251, 146, 60, ${glow})`;
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      for (let x = -230; x <= 200; x += 44) {
        ctx.moveTo(x, 8);
        ctx.lineTo(x + 14, -1);
        ctx.lineTo(x + 26, 3);
        ctx.lineTo(x + 36, -6);
      }
      ctx.stroke();
      return;
    }

    if (pattern === 'frost') {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.36)';
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      for (let x = -230; x <= 230; x += 32) {
        ctx.moveTo(x, halfThick);
        ctx.lineTo(x + 14, -halfThick);
        ctx.lineTo(x + 28, halfThick);
      }
      ctx.stroke();
      return;
    }

    if (pattern === 'royal') {
      ctx.fillStyle = '#7f1d1d';
      ctx.fillRect(-halfLen + 16, -3.5, (halfLen - 16) * 2, 7);
      ctx.strokeStyle = '#fef08a';
      ctx.lineWidth = 1;
      ctx.strokeRect(-halfLen + 18, -3.5, (halfLen - 18) * 2, 7);
      return;
    }

    if (pattern === 'cosmos') {
      for (let x = -225; x <= 225; x += 28) {
        const twinkle = 0.45 + 0.55 * Math.sin(t * 3.5 + x * 0.2);
        const y = ((x * 7) % 12) - 6;
        ctx.fillStyle = `rgba(233, 213, 255, ${twinkle})`;
        ctx.beginPath();
        ctx.arc(x, y, x % 56 === 0 ? 1.8 : 1.1, 0, Math.PI * 2);
        ctx.fill();
      }
      return;
    }

    if (pattern === 'leaf') {
      ctx.strokeStyle = 'rgba(190, 242, 100, 0.42)';
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      for (let x = -220; x <= 220; x += 38) {
        ctx.moveTo(x, 6);
        ctx.quadraticCurveTo(x + 12, -4, x + 26, 2);
      }
      ctx.stroke();
      return;
    }

    if (pattern === 'rune') {
      const pulse = 0.45 + 0.4 * Math.sin(t * 3.8);
      ctx.strokeStyle = `rgba(245, 208, 254, ${pulse})`;
      ctx.lineWidth = 1.2;
      for (let x = -210; x <= 210; x += 35) {
        ctx.beginPath();
        ctx.moveTo(x, -4);
        ctx.lineTo(x + 4, 1);
        ctx.lineTo(x, 6);
        ctx.lineTo(x - 4, 1);
        ctx.closePath();
        ctx.stroke();
      }
      return;
    }

    if (pattern === 'sakura') {
      ctx.fillStyle = 'rgba(251, 113, 133, 0.35)';
      ctx.fillRect(-halfLen + 16, halfThick - 4, (halfLen - 16) * 2, 4);
      ctx.fillStyle = 'rgba(255, 241, 242, 0.72)';
      for (let x = -210; x <= 210; x += 48) {
        ctx.beginPath();
        ctx.ellipse(x, 1, 4, 2, 0.4, 0, Math.PI * 2);
        ctx.fill();
      }
      return;
    }

    if (pattern === 'gear') {
      ctx.strokeStyle = 'rgba(41, 21, 7, 0.6)';
      ctx.lineWidth = 1.5;
      for (let x = -200; x <= 200; x += 50) {
        ctx.beginPath();
        ctx.moveTo(x, -halfThick);
        ctx.lineTo(x, halfThick);
        ctx.stroke();
        ctx.fillStyle = '#cbd5e1';
        ctx.beginPath();
        ctx.arc(x + 7, 3, 1.8, 0, Math.PI * 2);
        ctx.arc(x - 7, 3, 1.8, 0, Math.PI * 2);
        ctx.fill();
      }
      return;
    }

    if (pattern === 'plasma') {
      const pulse = 0.55 + 0.45 * Math.sin(t * 11);
      ctx.strokeStyle = `rgba(254, 240, 138, ${pulse * 0.7})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(-235, 2);
      for (let x = -220; x <= 235; x += 18) {
        const yOff = Math.sin(x * 0.4 + t * 14) * 4;
        ctx.lineTo(x, yOff);
      }
      ctx.stroke();
      return;
    }

    if (pattern === 'shadow') {
      ctx.fillStyle = 'rgba(244, 63, 94, 0.25)';
      ctx.fillRect(-halfLen + 16, 4, (halfLen - 16) * 2, 2.5);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.lineWidth = 8;
      ctx.beginPath();
      for (let x = -220; x <= 220; x += 70) {
        ctx.moveTo(x, -halfThick - 4);
        ctx.lineTo(x + 18, halfThick + 4);
      }
      ctx.stroke();
      return;
    }

    if (pattern === 'wave') {
      ctx.strokeStyle = 'rgba(204, 251, 241, 0.45)';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      for (let x = -235; x <= 235; x += 10) {
        const y = Math.sin(x * 0.06 - t * 3.5) * 3.5 + 1;
        if (x === -235) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      return;
    }

    if (pattern === 'solar') {
      ctx.strokeStyle = 'rgba(255, 251, 235, 0.45)';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      for (let x = -220; x <= 220; x += 34) {
        ctx.moveTo(x - 6, thick * 0.4);
        ctx.lineTo(x, -2);
        ctx.lineTo(x + 6, thick * 0.4);
      }
      ctx.stroke();
      return;
    }

    if (pattern === 'prism') {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
      for (let x = -220; x <= 220; x += 44) {
        ctx.beginPath();
        ctx.moveTo(x, -halfThick);
        ctx.lineTo(x + 16, -halfThick);
        ctx.lineTo(x + 4, halfThick);
        ctx.lineTo(x - 12, halfThick);
        ctx.closePath();
        ctx.fill();
      }
    }
  }

  private drawEndCap(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    danger: number,
    isLeft: boolean,
    skin: SkinConfig
  ): void {
    const capGrad = ctx.createLinearGradient(0, y, 0, y + h);
    if (danger > 0.2) {
      const pulse = 0.55 + 0.45 * Math.sin(this.animTime * 18);
      const r = Math.round(212 + 25 * danger * pulse);
      const g = Math.round(163 - 115 * danger);
      const b = Math.round(89 - 40 * danger);
      capGrad.addColorStop(0, `rgb(${r}, ${g}, ${b})`);
      capGrad.addColorStop(1, '#7f1d1d');
    } else {
      capGrad.addColorStop(0, skin.board.capTop);
      capGrad.addColorStop(1, skin.board.capBottom);
    }
    ctx.fillStyle = capGrad;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, isLeft ? [6, 2, 2, 6] : [2, 6, 6, 2]);
    ctx.fill();

    // Small end-cap rivet
    ctx.fillStyle = skin.board.capRivet;
    ctx.beginPath();
    ctx.arc(x + w * 0.5, 0, 2.2, 0, Math.PI * 2);
    ctx.fill();
  }

  private drawTargetZone(ctx: CanvasRenderingContext2D, state: PhysicsState): void {
    const tx = state.targetX;
    const hw = state.targetHalfWidth;
    const topY = -C.BOARD_THICKNESS * 0.5;

    if (state.targetArmingTimer > 0) {
      // Arming telegraph pulse
      const pulse = 0.35 + 0.35 * Math.sin(this.animTime * 16);
      ctx.fillStyle = `rgba(232, 155, 45, ${pulse * 0.45})`;
      ctx.fillRect(tx - hw, topY - 4, hw * 2, 7);
      ctx.strokeStyle = `rgba(232, 155, 45, ${0.4 + pulse * 0.5})`;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(tx - hw, topY - 12, hw * 2, 10);
      return;
    }

    // Active target track glow
    const activeColor = state.inTargetZone ? '#10b981' : '#e89b2d';
    ctx.fillStyle = state.inTargetZone ? 'rgba(16, 185, 129, 0.25)' : 'rgba(232, 155, 45, 0.18)';
    ctx.fillRect(tx - hw, topY - 26, hw * 2, 26);

    // Base plate on board rail
    ctx.fillStyle = activeColor;
    ctx.fillRect(tx - hw, topY - 4, hw * 2, 5);

    // Bracket posts on target zone edges
    ctx.strokeStyle = activeColor;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(tx - hw, topY - 14);
    ctx.lineTo(tx - hw, topY);
    ctx.moveTo(tx + hw, topY - 14);
    ctx.lineTo(tx + hw, topY);
    ctx.stroke();

    // Charge progress bar right below top edge of target zone
    if (state.targetProgress > 0.01) {
      ctx.fillStyle = '#34d399';
      const fillW = hw * 2 * clamp(state.targetProgress, 0, 1);
      ctx.fillRect(tx - fillW * 0.5, topY - 8, fillW, 3.5);
    }
  }

  private drawBall(ctx: CanvasRenderingContext2D, state: PhysicsState, skin: SkinConfig): void {
    const r = C.BALL_RADIUS;
    let bx = 0;
    let by = 0;

    if (state.isFalling) {
      bx = state.fallWorldX;
      by = state.fallWorldY;
    } else {
      const world = ballBoardToWorld(state.boardAngle, state.ballX);
      bx = world.x;
      by = world.y;

      // Contact shadow on the board directly under the ball
      ctx.save();
      ctx.rotate(state.boardAngle);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.42)';
      ctx.beginPath();
      ctx.ellipse(state.ballX, -C.BOARD_THICKNESS * 0.5 + 1, r * 0.88, 3.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    ctx.save();
    ctx.translate(bx, by);

    // Skin ambient aura ring
    if (skin.ball.auraColor) {
      const pulse = 1 + 0.07 * Math.sin(this.animTime * 5.5);
      ctx.fillStyle = skin.ball.auraColor;
      ctx.beginPath();
      ctx.arc(0, 0, (r + 5) * pulse, 0, Math.PI * 2);
      ctx.fill();
    }

    // Unlocked Special Reward: Aura Mahkota Juara golden halo + rotating diamond glints
    if (this.activeRewards.has('aura_juara')) {
      const crownR = r + 9;
      ctx.strokeStyle = 'rgba(250, 204, 21, 0.72)';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.arc(0, 0, crownR, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = '#fef08a';
      for (let i = 0; i < 4; i++) {
        const ang = -this.animTime * 2.4 + (Math.PI * 2 * i) / 4;
        const gx = Math.cos(ang) * crownR;
        const gy = Math.sin(ang) * crownR;
        ctx.beginPath();
        ctx.moveTo(gx, gy - 3.2);
        ctx.lineTo(gx + 2.4, gy);
        ctx.lineTo(gx, gy + 3.2);
        ctx.lineTo(gx - 2.4, gy);
        ctx.closePath();
        ctx.fill();
      }
    }

    // Active Power-Up Aura Ring around ball
    if (state.activePowerUp) {
      const isSlow = state.activePowerUp.type === 'slow_motion';
      const auraColor = isSlow ? 'rgba(56, 189, 248, 0.72)' : 'rgba(52, 211, 153, 0.72)';
      const pulse = 1 + 0.09 * Math.sin(this.animTime * 8);
      ctx.strokeStyle = auraColor;
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.arc(0, 0, (r + 7) * pulse, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Outer sphere shading (top-left light source)
    const sphereGrad = ctx.createRadialGradient(-r * 0.32, -r * 0.35, r * 0.1, 0, 0, r);
    sphereGrad.addColorStop(0, skin.ball.gradHighlight);
    sphereGrad.addColorStop(0.35, skin.ball.gradMid);
    sphereGrad.addColorStop(0.78, skin.ball.gradEdge);
    sphereGrad.addColorStop(1, skin.ball.gradCore);

    ctx.fillStyle = sphereGrad;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();

    // Crisp outer rim
    ctx.strokeStyle = state.edgeDanger > 0.55 ? '#f43f5e' : skin.ball.rimColor;
    ctx.lineWidth = state.edgeDanger > 0.55 ? 2.2 : 1.2;
    ctx.stroke();

    // Rotating skin motif clipped inside sphere so rolling spin is unmistakably visible
    ctx.save();
    ctx.beginPath();
    ctx.arc(0, 0, r - 1, 0, Math.PI * 2);
    ctx.clip();
    ctx.rotate(state.ballSpin);
    this.drawBallPattern(ctx, r, skin);
    ctx.restore();

    // Specular pinpoint highlight (fixed to light source)
    ctx.fillStyle = skin.ball.specularColor;
    ctx.beginPath();
    ctx.ellipse(-r * 0.34, -r * 0.36, r * 0.22, r * 0.13, -0.6, 0, Math.PI * 2);
    ctx.fill();

    // Orbiting energy motes around ball for high-effect skins
    if (skin.ball.orbiterColor && skin.ball.orbiterCount > 0) {
      const orbitR = r + 6.5;
      ctx.fillStyle = skin.ball.orbiterColor;
      for (let i = 0; i < skin.ball.orbiterCount; i++) {
        const ang = this.animTime * 3.1 + (Math.PI * 2 * i) / skin.ball.orbiterCount;
        const ox = Math.cos(ang) * orbitR;
        const oy = Math.sin(ang) * orbitR * 0.72;
        ctx.beginPath();
        ctx.arc(ox, oy, 2.2, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.restore();
  }

  private drawBallPattern(ctx: CanvasRenderingContext2D, r: number, skin: SkinConfig): void {
    const p = skin.ball.pattern;
    ctx.strokeStyle = skin.ball.bandColor;
    ctx.fillStyle = skin.ball.dotColor;

    if (p === 'band' || p === 'crown') {
      ctx.lineWidth = p === 'crown' ? 4 : 2.5;
      ctx.beginPath();
      ctx.moveTo(-r, 0);
      ctx.lineTo(r, 0);
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(r * 0.45, 0, 2.6, 0, Math.PI * 2);
      ctx.arc(-r * 0.45, 0, 2.6, 0, Math.PI * 2);
      ctx.fill();
      return;
    }

    if (p === 'circuit' || p === 'plasma') {
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(-r, 0);
      ctx.lineTo(r, 0);
      ctx.moveTo(0, -r);
      ctx.lineTo(0, r);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.42, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, 2.5, 0, Math.PI * 2);
      ctx.fill();
      return;
    }

    if (p === 'magma') {
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(-r, -2);
      ctx.lineTo(-4, 3);
      ctx.lineTo(5, -4);
      ctx.lineTo(r, 2);
      ctx.moveTo(-2, -r);
      ctx.lineTo(3, 1);
      ctx.lineTo(-4, r);
      ctx.stroke();
      return;
    }

    if (p === 'snowflake' || p === 'prism') {
      ctx.lineWidth = 1.6;
      for (let i = 0; i < 3; i++) {
        const a = (Math.PI * i) / 3;
        ctx.beginPath();
        ctx.moveTo(-Math.cos(a) * r * 0.82, -Math.sin(a) * r * 0.82);
        ctx.lineTo(Math.cos(a) * r * 0.82, Math.sin(a) * r * 0.82);
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.arc(0, 0, 3, 0, Math.PI * 2);
      ctx.fill();
      return;
    }

    if (p === 'galaxy' || p === 'spiral' || p === 'wave') {
      ctx.lineWidth = 2.1;
      ctx.beginPath();
      for (let i = 0; i <= 18; i++) {
        const t = i / 18;
        const ang = t * Math.PI * 2.5;
        const rad = t * r * 0.85;
        const x = Math.cos(ang) * rad;
        const y = Math.sin(ang) * rad;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(r * 0.5, -r * 0.25, 2, 0, Math.PI * 2);
      ctx.arc(-r * 0.45, r * 0.35, 1.8, 0, Math.PI * 2);
      ctx.fill();
      return;
    }

    if (p === 'rune') {
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(0, -r * 0.72);
      ctx.lineTo(r * 0.72, 0);
      ctx.lineTo(0, r * 0.72);
      ctx.lineTo(-r * 0.72, 0);
      ctx.closePath();
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, 2.8, 0, Math.PI * 2);
      ctx.fill();
      return;
    }

    if (p === 'blossom') {
      ctx.fillStyle = skin.ball.bandColor;
      for (let i = 0; i < 5; i++) {
        const a = (Math.PI * 2 * i) / 5;
        ctx.beginPath();
        ctx.ellipse(Math.cos(a) * 6, Math.sin(a) * 6, 4.2, 2.4, a, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = skin.ball.dotColor;
      ctx.beginPath();
      ctx.arc(0, 0, 2.5, 0, Math.PI * 2);
      ctx.fill();
      return;
    }

    if (p === 'gear') {
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.5, 0, Math.PI * 2);
      ctx.stroke();
      for (let i = 0; i < 6; i++) {
        const a = (Math.PI * 2 * i) / 6;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * r * 0.5, Math.sin(a) * r * 0.5);
        ctx.lineTo(Math.cos(a) * r * 0.88, Math.sin(a) * r * 0.88);
        ctx.stroke();
      }
      return;
    }

    if (p === 'eclipse') {
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.58, -0.4, Math.PI + 0.4);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(r * 0.48, 0, 2.2, 0, Math.PI * 2);
      ctx.fill();
      return;
    }

    if (p === 'sun') {
      ctx.lineWidth = 2;
      for (let i = 0; i < 8; i++) {
        const a = (Math.PI * 2 * i) / 8;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * r * 0.35, Math.sin(a) * r * 0.35);
        ctx.lineTo(Math.cos(a) * r * 0.85, Math.sin(a) * r * 0.85);
        ctx.stroke();
      }
    }
  }

  private drawMotionTrail(
    ctx: CanvasRenderingContext2D,
    state: PhysicsState,
    skin: SkinConfig
  ): void {
    const activeType = state.activePowerUp?.type;
    const style = skin.fx.trailStyle;
    const baseRgb =
      activeType === 'slow_motion'
        ? '56, 189, 248'
        : activeType === 'stabilizer'
          ? '52, 211, 153'
          : Math.abs(state.ballVel) > 220
            ? skin.fx.trailSecondaryRgb
            : skin.fx.trailRgb;

    ctx.save();

    // Ordered active trail points oldest -> newest
    if (style === 'ribbon' || style === 'lightning') {
      let prevX = 0;
      let prevY = 0;
      let hasPrev = false;
      for (let i = 0; i < this.trailNodes.length; i++) {
        const idx = (this.trailCursor + i) % this.trailNodes.length;
        const t = this.trailNodes[idx];
        if (!t.active) continue;
        const lifeRatio = 1 - t.age / t.maxAge;
        const speedFactor = clamp(t.speed / 240, 0.25, 1);
        const alpha = lifeRatio * 0.52 * speedFactor;

        if (hasPrev && alpha > 0.02) {
          ctx.strokeStyle = `rgba(${baseRgb}, ${alpha})`;
          ctx.lineWidth = style === 'lightning' ? 2.4 : C.BALL_RADIUS * 0.72 * lifeRatio;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(prevX, prevY);
          if (style === 'lightning') {
            const mx = (prevX + t.x) * 0.5 + Math.sin(this.animTime * 45 + i) * 7;
            const my = (prevY + t.y) * 0.5 + Math.cos(this.animTime * 53 + i) * 7;
            ctx.lineTo(mx, my);
          }
          ctx.lineTo(t.x, t.y);
          ctx.stroke();
        }
        prevX = t.x;
        prevY = t.y;
        hasPrev = true;
      }
    }

    for (let i = 0; i < this.trailNodes.length; i++) {
      const idx = (this.trailCursor + i) % this.trailNodes.length;
      const t = this.trailNodes[idx];
      if (!t.active) continue;
      const lifeRatio = 1 - t.age / t.maxAge;
      const speedFactor = clamp(t.speed / 240, 0.22, 1);
      const alpha = lifeRatio * lifeRatio * 0.38 * speedFactor;
      const radius = C.BALL_RADIUS * (0.24 + 0.56 * lifeRatio);
      if (alpha <= 0.01) continue;

      if (style === 'rainbow') {
        const hue = Math.round((this.animTime * 180 + i * 24) % 360);
        ctx.fillStyle = `hsla(${hue}, 90%, 66%, ${alpha * 1.15})`;
        ctx.beginPath();
        ctx.arc(t.x, t.y, radius, 0, Math.PI * 2);
        ctx.fill();
      } else if (style === 'crystal') {
        ctx.save();
        ctx.translate(t.x, t.y);
        ctx.rotate(i * 0.4 + this.animTime * 2);
        ctx.fillStyle = `rgba(${baseRgb}, ${alpha})`;
        ctx.beginPath();
        ctx.moveTo(0, -radius);
        ctx.lineTo(radius * 0.85, 0);
        ctx.lineTo(0, radius);
        ctx.lineTo(-radius * 0.85, 0);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      } else if (style === 'bubble') {
        ctx.strokeStyle = `rgba(${baseRgb}, ${alpha * 1.4})`;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.arc(t.x, t.y, radius * 0.85, 0, Math.PI * 2);
        ctx.stroke();
      } else if (style === 'shadow') {
        ctx.fillStyle = `rgba(${skin.fx.trailRgb}, ${alpha * 1.3})`;
        ctx.strokeStyle = `rgba(${skin.fx.trailSecondaryRgb}, ${alpha * 1.25})`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(t.x, t.y, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      } else {
        ctx.fillStyle = `rgba(${baseRgb}, ${alpha})`;
        ctx.beginPath();
        ctx.arc(t.x, t.y, radius, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  private drawAmbientParticles(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    for (let i = 0; i < this.ambientParticles.length; i++) {
      const a = this.ambientParticles[i];
      if (!a.active) continue;
      const alpha = (1 - a.life / a.maxLife) * 0.82;
      if (alpha <= 0.02) continue;

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(a.x, a.y);
      ctx.rotate(a.rotation);
      ctx.fillStyle = a.color;
      ctx.strokeStyle = a.color;

      if (a.shape === 'diamond') {
        const s = a.size * 1.2;
        ctx.beginPath();
        ctx.moveTo(0, -s);
        ctx.lineTo(s * 0.75, 0);
        ctx.lineTo(0, s);
        ctx.lineTo(-s * 0.75, 0);
        ctx.closePath();
        ctx.fill();
      } else if (a.shape === 'petal') {
        ctx.beginPath();
        ctx.ellipse(0, 0, a.size * 1.35, a.size * 0.7, 0, 0, Math.PI * 2);
        ctx.fill();
      } else if (a.shape === 'ring') {
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.arc(0, 0, a.size * 1.15, 0, Math.PI * 2);
        ctx.stroke();
      } else if (a.shape === 'spark') {
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(-a.size * 1.3, 0);
        ctx.lineTo(a.size * 1.3, 0);
        ctx.stroke();
      } else if (a.shape === 'star') {
        const s = a.size * 1.25;
        ctx.beginPath();
        ctx.moveTo(0, -s);
        ctx.lineTo(s * 0.3, -s * 0.3);
        ctx.lineTo(s, 0);
        ctx.lineTo(s * 0.3, s * 0.3);
        ctx.lineTo(0, s);
        ctx.lineTo(-s * 0.3, s * 0.3);
        ctx.lineTo(-s, 0);
        ctx.lineTo(-s * 0.3, -s * 0.3);
        ctx.closePath();
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.arc(0, 0, a.size * 0.9, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
    ctx.restore();
  }

  private drawShockwaves(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    for (let i = 0; i < this.shockwaves.length; i++) {
      const s = this.shockwaves[i];
      if (!s.active) continue;
      const alpha = (1 - s.life / s.maxLife) * 0.65;
      if (alpha <= 0.02) continue;
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = s.color;
      ctx.lineWidth = 2.4 * (1 - s.life / s.maxLife) + 0.6;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.radius, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  private drawPowerUpCollectible(ctx: CanvasRenderingContext2D, state: PhysicsState): void {
    const pu = state.powerUp;
    if (!pu) return;

    // Blink gently during last 2.2s before expiry
    if (pu.life < 2.2 && Math.floor(pu.life * 8) % 2 === 0) {
      return;
    }

    const isSlow = pu.type === 'slow_motion';
    const primary = isSlow ? '#38bdf8' : '#34d399';
    const glow = isSlow ? 'rgba(56, 189, 248, 0.24)' : 'rgba(52, 211, 153, 0.24)';
    const bobY = Math.sin(this.animTime * 4.5) * 3;
    const cy = -C.BOARD_THICKNESS * 0.5 - 22 + bobY;

    ctx.save();
    ctx.translate(pu.x, cy);

    // Outer halo
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, 0, 17, 0, Math.PI * 2);
    ctx.fill();

    // Token body
    ctx.fillStyle = '#182028';
    ctx.strokeStyle = primary;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Geometric workshop glyph inside token
    ctx.strokeStyle = primary;
    ctx.fillStyle = primary;
    ctx.lineWidth = 1.8;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (isSlow) {
      // Clock / Slow-motion emblem
      ctx.beginPath();
      ctx.moveTo(0, -5.5);
      ctx.lineTo(0, 0);
      ctx.lineTo(4, 2.5);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, 1.5, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Stabilizer horizontal level bar + center fulcrum dot
      ctx.beginPath();
      ctx.moveTo(-6, 0);
      ctx.lineTo(6, 0);
      ctx.moveTo(-4, -3.5);
      ctx.lineTo(0, -1);
      ctx.lineTo(4, -3.5);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 3.5, 1.6, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  private drawWindEffects(ctx: CanvasRenderingContext2D, state: PhysicsState): void {
    if (state.windPhase === 'calm') return;

    const dir = state.windDir;
    const isTelegraph = state.windPhase === 'telegraph';

    ctx.save();
    if (isTelegraph) {
      const pulse = 0.4 + 0.5 * Math.sin(this.animTime * 14);
      const xAnchor = -dir * 235;
      ctx.fillStyle = `rgba(125, 211, 252, ${pulse})`;
      ctx.strokeStyle = `rgba(125, 211, 252, ${pulse})`;
      ctx.font = '700 12px "Plus Jakarta Sans", sans-serif';
      ctx.textAlign = 'center';
      const arrow = dir > 0 ? 'ANGIN →' : '← ANGIN';
      ctx.fillText(arrow, xAnchor, -112);

      // Subtle dashed wind path preview
      ctx.setLineDash([6, 6]);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(-dir * 260, -92);
      ctx.lineTo(dir * 260, -92);
      ctx.stroke();
      ctx.setLineDash([]);
    } else if (state.windPhase === 'active') {
      const intensity = clamp(Math.abs(state.windStrength) / 90, 0.2, 1);
      ctx.strokeStyle = `rgba(147, 197, 253, ${0.35 * intensity})`;
      ctx.lineWidth = 2;
      for (let i = 0; i < 6; i++) {
        const y = -110 + i * 28;
        const speedOffset = ((this.animTime * 420 + i * 95) % 580) - 290;
        const xStart = speedOffset * dir;
        ctx.beginPath();
        ctx.moveTo(xStart, y);
        ctx.lineTo(xStart + dir * 56, y);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  private drawParticlesAndCallouts(ctx: CanvasRenderingContext2D): void {
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      if (!p.active || p.space !== 'world') continue;
      const alpha = 1 - p.life / p.maxLife;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * (0.5 + 0.5 * alpha), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    ctx.font = '700 15px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    for (let i = 0; i < this.callouts.length; i++) {
      const c = this.callouts[i];
      if (!c.active) continue;
      const alpha = 1 - c.life / c.maxLife;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
      ctx.fillText(c.text, c.x + 1, c.y + 1);
      ctx.fillStyle = c.color;
      ctx.fillText(c.text, c.x, c.y);
    }
    ctx.globalAlpha = 1;
  }

  private drawScreenParticles(ctx: CanvasRenderingContext2D): void {
    let anyScreen = false;
    for (let i = 0; i < this.particles.length; i++) {
      if (this.particles[i].active && this.particles[i].space === 'screen') {
        anyScreen = true;
        break;
      }
    }
    if (!anyScreen) return;

    ctx.save();
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      if (!p.active || p.space !== 'screen') continue;

      const lifeRatio = p.life / p.maxLife;
      const alpha = lifeRatio > 0.72 ? (1 - lifeRatio) / 0.28 : 1;
      const hw = p.size;
      const hh = p.size * p.aspect * (0.28 + 0.72 * Math.abs(Math.cos(p.life * p.flipSpeed + p.phase)));
      const cos = Math.cos(p.rotation);
      const sin = Math.sin(p.rotation);
      const dxX = cos * hw;
      const dxY = sin * hw;
      const dyX = -sin * hh;
      const dyY = cos * hh;

      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.moveTo(p.x - dxX - dyX, p.y - dxY - dyY);
      ctx.lineTo(p.x + dxX - dyX, p.y + dxY - dyY);
      ctx.lineTo(p.x + dxX + dyX, p.y + dxY + dyY);
      ctx.lineTo(p.x - dxX + dyX, p.y - dxY + dyY);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  private drawMonsters(ctx: CanvasRenderingContext2D, state: PhysicsState): void {
    const topY = -C.BOARD_THICKNESS * 0.5;
    for (let i = 0; i < state.monsters.length; i++) {
      const m = state.monsters[i];
      if (m.phase === 'telegraph') {
        this.drawMonsterTelegraph(ctx, m, topY);
      } else {
        this.drawActiveMonster(ctx, m, state.boardAngle, topY);
      }
    }
  }

  private drawMonsterTelegraph(
    ctx: CanvasRenderingContext2D,
    m: MonsterEntity,
    topY: number
  ): void {
    const preset = MONSTER_PRESETS[m.kind];
    const pulse = 0.45 + 0.5 * Math.sin(this.animTime * 18);
    const shortTag =
      m.kind === 'monkey'
        ? 'MONYET!'
        : m.kind === 'alien'
          ? 'ALIEN UFO!'
          : m.kind === 'human'
            ? 'MANUSIA!'
            : m.kind === 'robot'
              ? 'ROBOT!'
              : 'SLIME!';

    ctx.save();
    ctx.translate(m.x, topY);

    // Landing warning pad on the board
    ctx.globalAlpha = 0.3 + pulse * 0.4;
    ctx.fillStyle = preset.color;
    ctx.fillRect(-20, -4, 40, 5);

    // Vertical drop guide line
    ctx.strokeStyle = preset.color;
    ctx.lineWidth = 1.6;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(0, -10);
    ctx.lineTo(0, -64);
    ctx.stroke();
    ctx.setLineDash([]);

    // Exclamation badge & label
    ctx.globalAlpha = 0.75 + pulse * 0.25;
    ctx.fillStyle = '#141920';
    ctx.strokeStyle = preset.color;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.roundRect(-36, -92, 72, 22, 6);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = preset.color;
    ctx.font = '800 10px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(shortTag, 0, -77);

    ctx.restore();
  }

  private drawActiveMonster(
    ctx: CanvasRenderingContext2D,
    m: MonsterEntity,
    boardAngle: number,
    topY: number
  ): void {
    // Gentle fade blink right before leaving
    if (m.timer < 0.75 && Math.floor(m.timer * 10) % 2 === 0) {
      ctx.save();
      ctx.globalAlpha = 0.55;
      this.drawMonsterBody(ctx, m, boardAngle, topY);
      ctx.restore();
      return;
    }
    this.drawMonsterBody(ctx, m, boardAngle, topY);
  }

  private drawMonsterBody(
    ctx: CanvasRenderingContext2D,
    m: MonsterEntity,
    boardAngle: number,
    topY: number
  ): void {
    ctx.save();
    ctx.translate(m.x, topY);

    if (m.kind === 'monkey') {
      const hopY = -m.hopHeight;
      // Ground shadow shrinks as monkey jumps higher
      const shadowScale = clamp(1 - m.hopHeight / 42, 0.45, 1);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.36)';
      ctx.beginPath();
      ctx.ellipse(0, 0, 12 * shadowScale, 3.2 * shadowScale, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.translate(0, hopY);
      // Curling tail
      ctx.strokeStyle = '#78350f';
      ctx.lineWidth = 3.2;
      ctx.lineCap = 'round';
      ctx.beginPath();
      const tailWag = Math.sin(this.animTime * 9) * 5;
      ctx.moveTo(-m.dir * 8, -10);
      ctx.bezierCurveTo(-m.dir * 20, -14 + tailWag, -m.dir * 22, -28 + tailWag, -m.dir * 13, -30);
      ctx.stroke();

      // Torso & legs
      ctx.fillStyle = '#92400e';
      ctx.beginPath();
      ctx.ellipse(0, -14, 11, 12, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fcd34d';
      ctx.beginPath();
      ctx.ellipse(0, -13, 6.5, 7.5, 0, 0, Math.PI * 2);
      ctx.fill();

      // Ears
      ctx.fillStyle = '#92400e';
      ctx.beginPath();
      ctx.arc(-11, -28, 4.5, 0, Math.PI * 2);
      ctx.arc(11, -28, 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fde68a';
      ctx.beginPath();
      ctx.arc(-11, -28, 2.3, 0, Math.PI * 2);
      ctx.arc(11, -28, 2.3, 0, Math.PI * 2);
      ctx.fill();

      // Head & muzzle
      ctx.fillStyle = '#92400e';
      ctx.beginPath();
      ctx.arc(0, -28, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fde68a';
      ctx.beginPath();
      ctx.ellipse(0, -25, 7, 5, 0, 0, Math.PI * 2);
      ctx.fill();

      // Mischievous eyes & grin
      ctx.fillStyle = '#111827';
      ctx.beginPath();
      ctx.arc(-3.5, -30, 1.8, 0, Math.PI * 2);
      ctx.arc(3.5, -30, 1.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#78350f';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(0, -25.5, 3.2, 0.2, Math.PI - 0.2);
      ctx.stroke();
    } else if (m.kind === 'alien') {
      // Hovering UFO above board with pulsing tractor beam cone down to board surface
      const hoverY = -104 + Math.sin(this.animTime * 4.2) * 5;
      const beamPulse = 0.18 + 0.1 * Math.sin(this.animTime * 9);

      // Tractor beam cone reaching board surface
      const beamGrad = ctx.createLinearGradient(0, hoverY + 8, 0, 0);
      beamGrad.addColorStop(0, `rgba(34, 211, 238, ${beamPulse * 1.8})`);
      beamGrad.addColorStop(1, `rgba(52, 211, 153, ${beamPulse * 0.55})`);
      ctx.fillStyle = beamGrad;
      ctx.beginPath();
      ctx.moveTo(-14, hoverY + 8);
      ctx.lineTo(14, hoverY + 8);
      ctx.lineTo(36, 0);
      ctx.lineTo(-36, 0);
      ctx.closePath();
      ctx.fill();

      // Tractor beam rings
      const ringProgress = (this.animTime * 1.4) % 1;
      const ringY = hoverY + 14 + (1 - ringProgress) * (-hoverY - 18);
      const ringW = 12 + (1 - ringProgress) * 20;
      ctx.strokeStyle = `rgba(103, 232, 249, ${ringProgress * 0.65})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.ellipse(0, ringY, ringW, 4, 0, 0, Math.PI * 2);
      ctx.stroke();

      // UFO Saucer Body (slightly stabilized against board tilt)
      ctx.translate(0, hoverY);
      ctx.rotate(-boardAngle * 0.65);

      // Glass dome
      ctx.fillStyle = 'rgba(165, 243, 252, 0.38)';
      ctx.strokeStyle = '#67e8f9';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(0, -4, 15, Math.PI, 0);
      ctx.fill();
      ctx.stroke();

      // Little green alien inside dome
      ctx.fillStyle = '#4ade80';
      ctx.beginPath();
      ctx.arc(0, -8, 6.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.ellipse(-2.5, -8.5, 1.8, 2.5, -0.25, 0, Math.PI * 2);
      ctx.ellipse(2.5, -8.5, 1.8, 2.5, 0.25, 0, Math.PI * 2);
      ctx.fill();

      // Metallic saucer ring
      const hullGrad = ctx.createLinearGradient(0, -6, 0, 8);
      hullGrad.addColorStop(0, '#cbd5e1');
      hullGrad.addColorStop(0.5, '#475569');
      hullGrad.addColorStop(1, '#1e293b');
      ctx.fillStyle = hullGrad;
      ctx.beginPath();
      ctx.ellipse(0, 2, 27, 8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 1.4;
      ctx.stroke();

      // Blinking rim lights
      for (let i = -2; i <= 2; i++) {
        const lit = (Math.floor(this.animTime * 8) + i + 5) % 3 === 0;
        ctx.fillStyle = lit ? '#22d3ee' : '#0ea5e9';
        ctx.beginPath();
        ctx.arc(i * 9.5, 2.5, 2.1, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (m.kind === 'human') {
      // Heavyweight stomper pushing board down
      const stompSquash = Math.abs(Math.sin(m.hopPhase)) * 2.5;
      ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
      ctx.beginPath();
      ctx.ellipse(0, 0, 15, 3.8, 0, 0, Math.PI * 2);
      ctx.fill();

      // Heavy boots
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(-10, -7, 7, 7);
      ctx.fillRect(3, -7, 7, 7);

      // Stocky torso
      ctx.fillStyle = '#e11d48';
      ctx.beginPath();
      ctx.roundRect(-12, -28 + stompSquash, 24, 22 - stompSquash * 0.5, 6);
      ctx.fill();
      ctx.strokeStyle = '#fda4af';
      ctx.lineWidth = 1.4;
      ctx.stroke();

      // Arms crossed / flexing
      ctx.fillStyle = '#fdba74';
      ctx.beginPath();
      ctx.arc(-13, -18 + stompSquash, 4.2, 0, Math.PI * 2);
      ctx.arc(13, -18 + stompSquash, 4.2, 0, Math.PI * 2);
      ctx.fill();

      // Head + headband
      ctx.fillStyle = '#fed7aa';
      ctx.beginPath();
      ctx.arc(0, -37 + stompSquash, 9.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#be123c';
      ctx.fillRect(-9.5, -42 + stompSquash, 19, 4);

      // Determined brows & eyes
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(-5, -36 + stompSquash, 3, 2.2);
      ctx.fillRect(2, -36 + stompSquash, 3, 2.2);

      // Downward heavy weight arrow cue
      const arrowDrop = (this.animTime * 14) % 8;
      ctx.strokeStyle = 'rgba(251, 113, 133, 0.8)';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(-6, -54 + arrowDrop);
      ctx.lineTo(0, -49 + arrowDrop);
      ctx.lineTo(6, -54 + arrowDrop);
      ctx.stroke();
    } else if (m.kind === 'robot') {
      // Spring-bumper dashing robot
      ctx.fillStyle = 'rgba(0, 0, 0, 0.36)';
      ctx.beginPath();
      ctx.ellipse(0, 0, 14, 3.2, 0, 0, Math.PI * 2);
      ctx.fill();

      // Wheels / treads
      ctx.fillStyle = '#0f172a';
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(-7, -5, 4.5, 0, Math.PI * 2);
      ctx.arc(7, -5, 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Side spring bumpers
      ctx.strokeStyle = '#facc15';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-14, -18);
      ctx.lineTo(-19, -18);
      ctx.moveTo(14, -18);
      ctx.lineTo(19, -18);
      ctx.stroke();
      ctx.fillStyle = '#f59e0b';
      ctx.fillRect(-21, -23, 3, 10);
      ctx.fillRect(18, -23, 3, 10);

      // Chassis
      const botGrad = ctx.createLinearGradient(0, -32, 0, -8);
      botGrad.addColorStop(0, '#c4b5fd');
      botGrad.addColorStop(1, '#5b21b6');
      ctx.fillStyle = botGrad;
      ctx.strokeStyle = '#ddd6fe';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(-13, -32, 26, 23, 5);
      ctx.fill();
      ctx.stroke();

      // Glowing visor
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(-9, -27, 18, 7);
      ctx.fillStyle = '#38bdf8';
      const eyeOffset = m.dir * 3;
      ctx.beginPath();
      ctx.arc(-3 + eyeOffset, -23.5, 2, 0, Math.PI * 2);
      ctx.arc(4 + eyeOffset, -23.5, 2, 0, Math.PI * 2);
      ctx.fill();

      // Antenna beacon
      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(0, -32);
      ctx.lineTo(0, -40);
      ctx.stroke();
      ctx.fillStyle = Math.sin(this.animTime * 16) > 0 ? '#f43f5e' : '#38bdf8';
      ctx.beginPath();
      ctx.arc(0, -42, 2.8, 0, Math.PI * 2);
      ctx.fill();
    } else if (m.kind === 'slime') {
      // Sticky goo puddle along board surface
      const wobble = Math.sin(m.hopPhase) * 2.5;
      ctx.fillStyle = 'rgba(74, 222, 128, 0.34)';
      ctx.beginPath();
      ctx.ellipse(0, 0, 40, 5.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(134, 239, 172, 0.55)';
      ctx.fillRect(-36, -3, 72, 3.5);

      // Bouncy jelly slime dome
      const w = 16 + wobble;
      const h = 23 - wobble * 0.8;
      const slimeGrad = ctx.createRadialGradient(-4, -h * 0.65, 2, 0, -h * 0.4, 20);
      slimeGrad.addColorStop(0, '#bbf7d0');
      slimeGrad.addColorStop(0.5, '#22c55e');
      slimeGrad.addColorStop(1, '#15803d');
      ctx.fillStyle = slimeGrad;
      ctx.beginPath();
      ctx.moveTo(-w, 0);
      ctx.bezierCurveTo(-w, -h * 1.15, w, -h * 1.15, w, 0);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#86efac';
      ctx.lineWidth = 1.4;
      ctx.stroke();

      // Glossy highlight & googly eyes
      ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
      ctx.beginPath();
      ctx.ellipse(-5, -h * 0.62, 3.2, 1.8, -0.4, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(-4.5, -h * 0.42, 3, 0, Math.PI * 2);
      ctx.arc(4.5, -h * 0.42, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.arc(-4, -h * 0.42, 1.5, 0, Math.PI * 2);
      ctx.arc(5, -h * 0.42, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }
}
