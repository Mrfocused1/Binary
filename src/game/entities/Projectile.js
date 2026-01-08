import { Entity } from './Entity.js';

export class Projectile extends Entity {
  constructor(game, x, y, direction, owner = 'player') {
    super(x, y, 16, 16);

    this.game = game;
    this.direction = direction; // 'up', 'down', 'left', 'right'
    this.owner = owner; // 'player' or 'opp'

    // Projectile properties
    const isPlayerOrAlly = owner === 'player' || owner === 'ally';
    this.speed = isPlayerOrAlly ? 400 : 300; // Opp projectiles are slower
    this.lifetime = 2; // seconds
    this.age = 0;
    this.damage = isPlayerOrAlly ? 15 : 10; // Player/allies do more damage

    // Visual properties - allies use cyan, player uses gold, opps use red
    if (owner === 'ally') {
      this.color = '#00FFFF'; // Cyan for allies
      this.glowColor = 'rgba(0, 255, 255, 0.5)';
    } else if (owner === 'player') {
      this.color = '#FFD700'; // Gold for player
      this.glowColor = 'rgba(255, 215, 0, 0.5)';
    } else {
      this.color = '#C0C0C0'; // Silver for opps
      this.glowColor = 'rgba(192, 192, 192, 0.5)';
    }
    this.radius = 8;
    this.pulseTimer = 0;

    // Set velocity based on direction
    this.setVelocityFromDirection();

    // Collision box centered
    this.collisionBox = {
      offsetX: 4,
      offsetY: 4,
      width: 8,
      height: 8
    };
  }

  setVelocityFromDirection() {
    switch (this.direction) {
      case 'up':
        this.vx = 0;
        this.vy = -this.speed;
        break;
      case 'down':
        this.vx = 0;
        this.vy = this.speed;
        break;
      case 'left':
        this.vx = -this.speed;
        this.vy = 0;
        break;
      case 'right':
        this.vx = this.speed;
        this.vy = 0;
        break;
    }
  }

  update(deltaTime) {
    if (!this.active) return;

    // Update age
    this.age += deltaTime;
    if (this.age >= this.lifetime) {
      this.active = false;
      return;
    }

    // Update position
    this.x += this.vx * deltaTime;
    this.y += this.vy * deltaTime;

    // Update pulse animation
    this.pulseTimer += deltaTime * 10;

    // Check if out of world bounds
    const state = this.game.stateManager.currentState;
    if (state && state.worldWidth && state.worldHeight) {
      if (this.x < -50 || this.x > state.worldWidth + 50 ||
          this.y < -50 || this.y > state.worldHeight + 50) {
        this.active = false;
      }
    }
  }

  render(ctx) {
    if (!this.active || !this.visible) return;

    const centerX = this.getCenterX();
    const centerY = this.getCenterY();

    ctx.save();

    // Calculate rotation based on direction
    let rotation = 0;
    switch (this.direction) {
      case 'right': rotation = 0; break;
      case 'down': rotation = Math.PI / 2; break;
      case 'left': rotation = Math.PI; break;
      case 'up': rotation = -Math.PI / 2; break;
    }

    // Different colors based on owner
    let smokeColor, casingColor, casingStroke, tipColor, highlightColor, shadowColor;

    if (this.owner === 'ally') {
      // Cyan/blue colors for allies
      smokeColor = 'rgba(100, 200, 255, ';
      casingColor = '#006666';
      casingStroke = '#004444';
      tipColor = '#00FFFF';
      highlightColor = '#88FFFF';
      shadowColor = '#00CCCC';
    } else if (this.owner === 'opp') {
      // Silver colors for opps
      smokeColor = 'rgba(180, 180, 180, ';
      casingColor = '#808080';
      casingStroke = '#606060';
      tipColor = '#C0C0C0';
      highlightColor = '#E8E8E8';
      shadowColor = '#909090';
    } else {
      // Gold/copper colors for player
      smokeColor = 'rgba(180, 180, 180, ';
      casingColor = '#B87333';
      casingStroke = '#8B5A2B';
      tipColor = '#C0C0C0';
      highlightColor = '#E8E8E8';
      shadowColor = '#909090';
    }

    // Draw smoke trail behind bullet
    const smokeOffset = 12;
    const smokeX = centerX - Math.cos(rotation) * smokeOffset;
    const smokeY = centerY - Math.sin(rotation) * smokeOffset;

    // Multiple smoke puffs with varying opacity
    for (let i = 0; i < 4; i++) {
      const puffOffset = i * 6;
      const puffX = smokeX - Math.cos(rotation) * puffOffset;
      const puffY = smokeY - Math.sin(rotation) * puffOffset;
      const puffSize = 4 + i * 2;
      const alpha = 0.4 - i * 0.1;

      // Smoke puff with slight random offset
      const wobble = Math.sin(this.pulseTimer + i) * 2;
      const perpX = -Math.sin(rotation) * wobble;
      const perpY = Math.cos(rotation) * wobble;

      ctx.beginPath();
      ctx.arc(puffX + perpX, puffY + perpY, puffSize, 0, Math.PI * 2);
      ctx.fillStyle = smokeColor + alpha + ')';
      ctx.fill();
    }

    // Draw bullet body (elongated oval)
    ctx.translate(centerX, centerY);
    ctx.rotate(rotation);

    // Bullet casing (back part)
    ctx.beginPath();
    ctx.ellipse(-3, 0, 4, 3, 0, 0, Math.PI * 2);
    ctx.fillStyle = casingColor;
    ctx.fill();
    ctx.strokeStyle = casingStroke;
    ctx.lineWidth = 0.5;
    ctx.stroke();

    // Bullet tip (front part)
    ctx.beginPath();
    ctx.ellipse(4, 0, 6, 3, 0, 0, Math.PI * 2);
    ctx.fillStyle = tipColor;
    ctx.fill();

    // Highlight on bullet tip
    ctx.beginPath();
    ctx.ellipse(5, -1, 3, 1.5, 0, 0, Math.PI * 2);
    ctx.fillStyle = highlightColor;
    ctx.fill();

    // Dark edge on bullet
    ctx.beginPath();
    ctx.ellipse(4, 1, 4, 1, 0, 0, Math.PI * 2);
    ctx.fillStyle = shadowColor;
    ctx.fill();

    ctx.restore();
  }

  // Get direction vector for knockback
  getDirectionVector() {
    switch (this.direction) {
      case 'up':
        return { x: 0, y: -1 };
      case 'down':
        return { x: 0, y: 1 };
      case 'left':
        return { x: -1, y: 0 };
      case 'right':
        return { x: 1, y: 0 };
      default:
        return { x: 0, y: 0 };
    }
  }

  // Deactivate projectile (called on hit)
  hit() {
    this.active = false;
  }
}
