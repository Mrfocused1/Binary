import { Entity } from './Entity.js';

export class Loot extends Entity {
  constructor(game, x, y, color) {
    super(x, y, 16, 20);
    this.game = game;

    // Loot properties
    this.color = color; // Loot type indicator
    this.isHeld = false;
    this.isStashed = false;
    this.holder = null; // Entity holding this loot
    this.stashLocation = null; // SafeHouse or Traphouse this loot belongs to

    // Unique ID for tracking
    this.id = `loot-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Physics
    this.friction = 0.9;
    this.bounceDecay = 0.7;
    this.gravity = 0;

    // Visual
    this.rotation = 0;
    this.rotationSpeed = 0;
    this.sparkleTimer = 0;

    // Collision box
    this.collisionBox = {
      offsetX: 2,
      offsetY: 2,
      width: 12,
      height: 16
    };

    // Glow effect when on floor
    this.glowIntensity = 0;
    this.glowDirection = 1;
  }

  update(deltaTime) {
    // Skip physics for held loot
    if (this.isHeld) {
      return;
    }

    // Apply friction to velocity
    this.vx *= this.friction;
    this.vy *= this.friction;

    // Store old position
    const oldX = this.x;
    const oldY = this.y;

    // Update position
    this.x += this.vx * deltaTime;
    this.y += this.vy * deltaTime;

    // Check collision with traphouses if not stashed
    if (!this.isStashed) {
      const state = this.game.stateManager.currentState;
      if (state && state.traphouses) {
        for (const traphouse of state.traphouses) {
          // Check if loot overlaps with traphouse
          if (!(this.x + this.width < traphouse.x ||
                this.x > traphouse.x + traphouse.width ||
                this.y + this.height < traphouse.y ||
                this.y > traphouse.y + traphouse.height)) {
            // Loot collided with traphouse, bounce it away
            this.x = oldX;
            this.y = oldY;

            // Reverse velocity and reduce it
            this.vx = -this.vx * 0.5;
            this.vy = -this.vy * 0.5;

            // Add some randomness to prevent getting stuck
            this.vx += (Math.random() - 0.5) * 20;
            this.vy += (Math.random() - 0.5) * 20;

            break; // Only handle first collision
          }
        }
      }
    }

    // Update rotation
    this.rotation += this.rotationSpeed * deltaTime;
    this.rotationSpeed *= 0.95; // Slow down rotation

    // Sparkle effect
    this.sparkleTimer += deltaTime;

    // Glow pulsing
    this.glowIntensity += this.glowDirection * deltaTime * 2;
    if (this.glowIntensity >= 1) {
      this.glowIntensity = 1;
      this.glowDirection = -1;
    } else if (this.glowIntensity <= 0.3) {
      this.glowIntensity = 0.3;
      this.glowDirection = 1;
    }

    // Stop moving if velocity is very small
    if (Math.abs(this.vx) < 5 && Math.abs(this.vy) < 5) {
      this.vx = 0;
      this.vy = 0;
    }
  }

  render(ctx, interpolation) {
    if (!this.visible) return;

    const sprite = this.game.assetLoader.getImage('loot');

    // Draw glow effect if on floor
    if (!this.isHeld && !this.isStashed) {
      ctx.save();
      ctx.globalAlpha = this.glowIntensity * 0.5;
      ctx.fillStyle = this.getColorHex();
      ctx.beginPath();
      ctx.arc(
        this.getCenterX(),
        this.getCenterY(),
        20,
        0,
        Math.PI * 2
      );
      ctx.filter = 'blur(8px)';
      ctx.fill();
      ctx.restore();

      // Sparkle effect
      if (Math.sin(this.sparkleTimer * 5) > 0.5) {
        ctx.save();
        ctx.fillStyle = '#ffffff';
        ctx.globalAlpha = 0.8;
        const sparkleX = this.x + Math.random() * this.width;
        const sparkleY = this.y + Math.random() * this.height;
        ctx.fillRect(sparkleX - 1, sparkleY - 1, 2, 2);
        ctx.restore();
      }
    }

    // Draw loot sprite (or fallback)
    if (sprite) {
      this.game.renderer.drawSprite(
        sprite,
        this.x,
        this.y,
        this.width,
        this.height,
        {
          rotation: this.rotation,
          alpha: this.isHeld ? 0.8 : 1
        }
      );
    } else {
      // Fallback rendering - draw as money/loot bag
      ctx.save();
      ctx.fillStyle = this.getColorHex();
      ctx.fillRect(this.x, this.y, this.width, this.height);
      ctx.strokeStyle = '#000';
      ctx.strokeRect(this.x, this.y, this.width, this.height);
      // Draw $ symbol
      ctx.fillStyle = '#000';
      ctx.font = '10px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('$', this.x + this.width/2, this.y + this.height/2 + 3);
      ctx.restore();
    }

    // Draw color indicator
    ctx.save();
    ctx.fillStyle = this.getColorHex();
    ctx.fillRect(this.x + 4, this.y + 2, this.width - 8, 4);
    ctx.restore();
  }

  getColorHex() {
    const colors = {
      red: '#ff4444',
      blue: '#4444ff',
      green: '#44ff44',
      yellow: '#ffff44',
      purple: '#ff44ff',
      orange: '#ff8844'
    };
    return colors[this.color] || '#888888';
  }

  pickup(holder) {
    this.isHeld = true;
    this.holder = holder;
    this.visible = false; // Hide when picked up
    this.vx = 0;
    this.vy = 0;
    this.rotation = 0;
    this.rotationSpeed = 0;
  }

  drop(x, y, throwVelocity = null) {
    this.isHeld = false;
    this.holder = null;
    this.visible = true; // Show when dropped
    this.x = x;
    this.y = y;

    if (throwVelocity) {
      this.vx = throwVelocity.x;
      this.vy = throwVelocity.y;
      this.rotationSpeed = (Math.random() - 0.5) * 10;
    }
  }

  stash(location = null) {
    this.isStashed = true;
    this.isHeld = false;
    this.holder = null;
    this.stashLocation = location;
    this.visible = true; // Show when stashed (for display around buildings)
    this.vx = 0;
    this.vy = 0;
    this.rotation = 0;
    this.rotationSpeed = 0;
  }

  unstash() {
    this.isStashed = false;
    this.stashLocation = null;
  }

  getStateString() {
    if (this.isStashed) return 'stashed';
    if (this.isHeld) return `held by ${this.holder?.constructor.name || 'unknown'}`;
    return 'on floor';
  }
}
