import { ballBoardToWorld, clamp } from './physics';
import { SpecialRewardId } from './missions';
import { SKIN_PRESETS, SkinConfig, SkinId, getSkinConfig } from './skins';
import { GamePhase, PHYSICS_CONSTANTS, PhysicsState } from './types';

const C = PHYSICS_CONSTANTS;

interface Particle {
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
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
  private bgCache: HTMLCanvasElement | null = null;
  private bgCacheW = 0;
  private bgCacheH = 0;

  constructor(initialSkin: SkinId = 'classic') {
    this.skinId = initialSkin in SKIN_PRESETS ? initialSkin : 'classic';
    this.particles = Array.from({ length: 72 }, () => ({
      active: false,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      life: 0,
      maxLife: 1,
      size: 3,
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
      p.x = worldX;
      p.y = worldY;
      p.vx = Math.cos(angle) * speed;
      p.vy = Math.sin(angle) * speed - 40;
      p.life = 0;
      p.maxLife = 0.45 + Math.random() * 0.35;
      p.size = 2.4 + Math.random() * 2.8;
      p.color = color ?? fallbackColors[i % fallbackColors.length];
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

    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      if (!p.active) continue;
      p.life += dt;
      if (p.life >= p.maxLife) {
        p.active = false;
        continue;
      }
      p.vy += 260 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
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

  private ensureBackgroundCache(width: number, height: number): HTMLCanvasElement | null {
    if (typeof document === 'undefined') return null;
    const w = Math.max(1, Math.round(width));
    const h = Math.max(1, Math.round(height));
    if (this.bgCache && this.bgCacheW === w && this.bgCacheH === h) {
      return this.bgCache;
    }
    const offscreen = this.bgCache ?? document.createElement('canvas');
    offscreen.width = w;
    offscreen.height = h;
    const octx = offscreen.getContext('2d');
    if (!octx) return null;

    const bgGrad = octx.createRadialGradient(
      w * 0.5,
      h * 0.48,
      20,
      w * 0.5,
      h * 0.5,
      Math.max(w, h) * 0.75
    );
    bgGrad.addColorStop(0, '#212832');
    bgGrad.addColorStop(0.6, '#171c23');
    bgGrad.addColorStop(1, '#101419');
    octx.fillStyle = bgGrad;
    octx.fillRect(0, 0, w, h);

    this.drawDraftingGrid(octx, w, h);

    this.bgCache = offscreen;
    this.bgCacheW = w;
    this.bgCacheH = h;
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
    const skin = this.getSkin();

    ctx.save();

    // 1. Background: Cached Architectural Oiled Slate Drafting Table
    const cachedBg = this.ensureBackgroundCache(width, height);
    if (cachedBg) {
      ctx.drawImage(cachedBg, 0, 0, width, height);
    } else {
      ctx.fillStyle = '#171c23';
      ctx.fillRect(0, 0, width, height);
    }

    // Compute layout center & scale so board fits comfortably on any viewport
    const isDesktopTitle = phase === 'title' && width >= 900;
    const fulcrumScreenX = isDesktopTitle ? width * 0.65 : width * 0.5;
    const fulcrumScreenY = phase === 'title' && width < 900 ? height * 0.69 : height * 0.54;

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

    // 4. Tilting Board, Target Zone & Power-Up Collectible
    ctx.save();
    ctx.rotate(state.boardAngle);
    this.drawBoard(ctx, state, phase, skin);
    if (phase !== 'title' && state.powerUp) {
      this.drawPowerUpCollectible(ctx, state);
    }
    ctx.restore();

    // 5. Ambient Skin Particles, Shockwave Rings, Ball Motion Trail & Rolling/Falling Ball
    this.drawAmbientParticles(ctx);
    this.drawShockwaves(ctx);
    this.drawMotionTrail(ctx, state, skin);
    this.drawBall(ctx, state, skin);

    // 6. Pooled Impact Particles & Score Callouts
    this.drawParticlesAndCallouts(ctx);

    ctx.restore();
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
      if (!p.active) continue;
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
}
