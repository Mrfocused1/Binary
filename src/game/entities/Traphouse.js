import { Entity } from './Entity.js';

export class Traphouse extends Entity {
  constructor(game, x, y, color, capacity = 6) {
    super(x, y, 230, 200); // Size to cover gray rooftop areas
    this.game = game;

    // Traphouse properties
    this.color = color;
    this.capacity = capacity;
    this.loot = new Array(capacity).fill(null); // Fixed-size array for loot
    this.isOppBlock = false; // Set to true for the special high-risk traphouse

    // Visual properties
    this.lootGlow = 0;
    this.lootGlowDirection = 1;

    // Collision box (solid obstacle) - covers most of the building
    this.collisionBox = {
      offsetX: 15,
      offsetY: 15,
      width: 200,
      height: 170
    };
  }

  update(deltaTime) {
    // Update loot glow - glow when traphouse has loot (player target)
    if (this.hasLoot()) {
      // Check if player is nearby
      const state = this.game.stateManager.currentState;
      const playerNearby = state && state.player &&
        this.getDistanceTo(state.player) < 200;

      // Glow more intensely if player is nearby
      const glowSpeed = playerNearby ? 4 : 2;
      const maxGlow = playerNearby ? 1 : 0.7;
      const minGlow = playerNearby ? 0.5 : 0.3;

      this.lootGlow += this.lootGlowDirection * deltaTime * glowSpeed;
      if (this.lootGlow >= maxGlow) {
        this.lootGlow = maxGlow;
        this.lootGlowDirection = -1;
      } else if (this.lootGlow <= minGlow) {
        this.lootGlow = minGlow;
        this.lootGlowDirection = 1;
      }
    } else {
      this.lootGlow = 0;
    }
  }

  getDistanceTo(entity) {
    const dx = this.getCenterX() - entity.getCenterX();
    const dy = this.getCenterY() - entity.getCenterY();
    return Math.sqrt(dx * dx + dy * dy);
  }

  render(ctx, interpolation) {
    const sprite = this.game.assetLoader.getImage('building');

    // Draw building sprite
    if (sprite) {
      this.game.renderer.drawSprite(
        sprite,
        this.x,
        this.y,
        this.width,
        this.height
      );
    } else {
      // Fallback rendering - simple building shape
      ctx.fillStyle = '#4a5568';
      ctx.fillRect(this.x, this.y, this.width, this.height);
      ctx.strokeStyle = '#2d3748';
      ctx.lineWidth = 2;
      ctx.strokeRect(this.x, this.y, this.width, this.height);
    }

    // Draw loot indicator (glowing outline when has loot - player target)
    if (this.hasLoot()) {
      ctx.save();
      ctx.globalAlpha = this.lootGlow * 0.6;
      ctx.strokeStyle = '#ffcc00'; // Gold glow for loot
      ctx.lineWidth = 4;
      ctx.strokeRect(this.x + 5, this.y + 5, this.width - 10, this.height - 10);
      ctx.restore();
    }

    // Draw loot around the building
    this.renderLoot(ctx);

    // Draw capacity indicator
    ctx.save();
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 3;
    ctx.font = 'bold 14px Arial';
    ctx.textAlign = 'center';
    const text = `${this.loot.filter(l => l !== null).length}/${this.capacity}`;
    ctx.strokeText(text, this.getCenterX(), this.y + this.height + 15);
    ctx.fillText(text, this.getCenterX(), this.y + this.height + 15);
    ctx.restore();

    // Draw "OPP BLOCK" label if this is the special high-risk traphouse
    if (this.isOppBlock) {
      ctx.save();
      // Red warning background
      ctx.fillStyle = '#dc2626';
      ctx.fillRect(this.x + 40, this.y - 30, 150, 24);
      // White text
      ctx.fillStyle = '#fff';
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 2;
      ctx.font = 'bold 16px Arial';
      ctx.textAlign = 'center';
      ctx.strokeText('⚠ OPP BLOCK ⚠', this.getCenterX(), this.y - 12);
      ctx.fillText('⚠ OPP BLOCK ⚠', this.getCenterX(), this.y - 12);
      ctx.restore();
    }
  }

  renderLoot(ctx) {
    // Position loot around the building perimeter
    const positions = [
      { x: this.x - 15, y: this.y + 20 },           // Left side top
      { x: this.x - 15, y: this.y + 80 },           // Left side bottom
      { x: this.x + this.width - 5, y: this.y + 20 }, // Right side top
      { x: this.x + this.width - 5, y: this.y + 80 }, // Right side bottom
      { x: this.x + 40, y: this.y - 15 },           // Top
      { x: this.x + 100, y: this.y - 15 }           // Top right
    ];

    this.loot.forEach((item, index) => {
      if (!item) return;

      // Validate loot state
      if (!item.isStashed || item.stashLocation !== this) {
        // Clean up invalid loot reference silently
        this.loot[index] = null;
        return;
      }

      if (index < positions.length) {
        item.x = positions[index].x;
        item.y = positions[index].y;
        item.render(ctx, 1);
      }
    });
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

  hasLoot() {
    return this.loot.some(item => item !== null);
  }

  hasEmptySlots() {
    const lootCount = this.loot.filter(item => item !== null).length;
    return lootCount < this.capacity;
  }

  addLoot(item) {
    if (!this.hasEmptySlots()) {
      return false;
    }

    // Find first empty slot
    let slotIndex = 0;
    while (slotIndex < this.capacity && this.loot[slotIndex]) {
      slotIndex++;
    }

    if (slotIndex < this.capacity) {
      this.loot[slotIndex] = item;
      item.stash(this);
      return true;
    }

    return false;
  }

  removeLoot(index) {
    if (index >= 0 && index < this.loot.length && this.loot[index]) {
      const item = this.loot[index];
      this.loot[index] = null;
      item.unstash();
      return item;
    }
    return null;
  }

  removeRandomLoot() {
    // Get indices of all loot in traphouse
    const lootIndices = [];
    for (let i = 0; i < this.loot.length; i++) {
      if (this.loot[i]) {
        lootIndices.push(i);
      }
    }

    if (lootIndices.length === 0) {
      return null;
    }

    // Remove random loot
    const randomIndex = lootIndices[Math.floor(Math.random() * lootIndices.length)];
    return this.removeLoot(randomIndex);
  }

  getEmptySlotCount() {
    return this.capacity - this.loot.filter(item => item !== null).length;
  }

  getLootCount() {
    return this.loot.filter(item => item !== null).length;
  }
}
