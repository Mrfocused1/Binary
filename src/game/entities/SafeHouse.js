import { Entity } from './Entity.js';

export class SafeHouse extends Entity {
  constructor(game, x, y) {
    super(x, y, 230, 200); // Same size as traphouses
    this.game = game;

    // SafeHouse properties - unlimited capacity
    this.loot = []; // Dynamic array for loot

    // Visual properties
    this.safeGlow = 0;
    this.safeGlowDirection = 1;

    // Collision box (solid obstacle)
    this.collisionBox = {
      offsetX: 15,
      offsetY: 15,
      width: 200,
      height: 170
    };
  }

  update(deltaTime) {
    // Always glow slightly to indicate safe zone
    const state = this.game.stateManager.currentState;
    const playerNearby = state && state.player &&
      this.getDistanceTo(state.player) < 150;
    const playerHasLoot = state && state.player &&
      state.player.carriedLoot && state.player.carriedLoot.length > 0;

    // Glow more intensely if player is nearby with loot
    const glowSpeed = (playerNearby && playerHasLoot) ? 4 : 2;
    const maxGlow = (playerNearby && playerHasLoot) ? 1 : 0.6;
    const minGlow = 0.3;

    this.safeGlow += this.safeGlowDirection * deltaTime * glowSpeed;
    if (this.safeGlow >= maxGlow) {
      this.safeGlow = maxGlow;
      this.safeGlowDirection = -1;
    } else if (this.safeGlow <= minGlow) {
      this.safeGlow = minGlow;
      this.safeGlowDirection = 1;
    }
  }

  getDistanceTo(entity) {
    const dx = this.getCenterX() - entity.getCenterX();
    const dy = this.getCenterY() - entity.getCenterY();
    return Math.sqrt(dx * dx + dy * dy);
  }

  render(ctx, interpolation) {
    const sprite = this.game.assetLoader.getImage('safehouse');

    // Draw building sprite (or fallback)
    if (sprite) {
      this.game.renderer.drawSprite(
        sprite,
        this.x,
        this.y,
        this.width,
        this.height
      );
    } else {
      // Fallback rendering - distinct from traphouses (darker, more secure look)
      ctx.fillStyle = '#2d5a27'; // Dark green for safe zone
      ctx.fillRect(this.x, this.y, this.width, this.height);
      ctx.strokeStyle = '#1a3d18';
      ctx.lineWidth = 4;
      ctx.strokeRect(this.x, this.y, this.width, this.height);

      // Draw "SAFE" text
      ctx.save();
      ctx.fillStyle = '#4ade80';
      ctx.font = 'bold 24px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('STASH', this.getCenterX(), this.getCenterY());
      ctx.restore();
    }

    // Draw safe zone indicator (green glowing outline)
    ctx.save();
    ctx.globalAlpha = this.safeGlow * 0.6;
    ctx.strokeStyle = '#4ade80'; // Green glow for safe zone
    ctx.lineWidth = 6;
    ctx.strokeRect(this.x + 3, this.y + 3, this.width - 6, this.height - 6);
    ctx.restore();

    // Draw loot around the safe house
    this.renderLoot(ctx);

    // Draw loot count indicator
    ctx.save();
    ctx.fillStyle = '#4ade80';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 3;
    ctx.font = 'bold 16px Arial';
    ctx.textAlign = 'center';
    const lootCount = this.getLootCount();
    const text = `STASH: ${lootCount}`;
    ctx.strokeText(text, this.getCenterX(), this.y + this.height + 20);
    ctx.fillText(text, this.getCenterX(), this.y + this.height + 20);
    ctx.restore();
  }

  renderLoot(ctx) {
    // Position loot around the building perimeter (show first 6 visually)
    const positions = [
      { x: this.x - 15, y: this.y + 20 },
      { x: this.x - 15, y: this.y + 80 },
      { x: this.x + this.width - 5, y: this.y + 20 },
      { x: this.x + this.width - 5, y: this.y + 80 },
      { x: this.x + 40, y: this.y - 15 },
      { x: this.x + 100, y: this.y - 15 }
    ];

    // Only render first 6 items visually
    for (let i = 0; i < Math.min(this.loot.length, positions.length); i++) {
      const item = this.loot[i];
      if (!item) continue;

      item.x = positions[i].x;
      item.y = positions[i].y;
      item.render(ctx, 1);
    }
  }

  hasLoot() {
    return this.loot.length > 0;
  }

  hasEmptySlots() {
    return true; // Unlimited capacity
  }

  addLoot(item) {
    this.loot.push(item);
    item.stash(this);
    return true;
  }

  removeLoot(index) {
    if (index >= 0 && index < this.loot.length) {
      const item = this.loot[index];
      this.loot.splice(index, 1); // Remove from array
      item.unstash();
      return item;
    }
    return null;
  }

  removeRandomLoot() {
    if (this.loot.length === 0) {
      return null;
    }

    const randomIndex = Math.floor(Math.random() * this.loot.length);
    return this.removeLoot(randomIndex);
  }

  getLootCount() {
    return this.loot.length;
  }
}
