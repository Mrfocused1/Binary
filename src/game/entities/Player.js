import { Entity } from './Entity.js';
import { Projectile } from './Projectile.js';

export class Player extends Entity {
  constructor(game, x, y) {
    super(x, y, 48, 64); // Increased size from 32x48 to 48x64
    this.game = game;
    
    // Stats (from design doc)
    this.stats = {
      moveSpeed: 3, // meters per second (assuming 1 meter = 32 pixels)
      pickupRadius: 1.0, // 1.0 meters (32 pixels) - reasonable pickup range
      returnRadius: 1.0, // 1.0 meters (32 pixels) - reasonable deposit range
      carrySlots: 5,
      stamina: 100,
      maxStamina: 100,
      beefDampening: 0,
      xpMultiplier: 1.0 // For Reading Glasses upgrade
    };

    // Health system
    this.health = 100;
    this.maxHealth = 100;
    this.isDead = false;
    
    // Upgrade tracking
    this.upgradeLevels = {};
    
    // Movement
    this.baseSpeed = this.stats.moveSpeed * 32; // Convert to pixels/second

    // Shooting
    this.shootCooldown = 0.5; // seconds between shots
    this.shootTimer = 0; // current cooldown timer
    this.isShooting = false; // for shooting animation
    this.shootAnimationDuration = 0.2; // how long to show shooting sprite
    this.shootAnimationTimer = 0;
    
    // Loot carried
    this.carriedLoot = [];
    
    // Animation
    this.facing = 'down'; // up, down, left, right
    this.lastHorizontalFacing = 'left'; // Track last horizontal direction for sprite flipping
    this.animationTimer = 0;
    this.animationFrame = 0;
    this.isMoving = false;
    
    // Collision box (covers most of the player)
    this.collisionBox = {
      offsetX: 8,
      offsetY: 24, // Adjusted for larger sprite
      width: 32,
      height: 36  // Adjusted for larger sprite
    };
    
    // Repel radius for kids
    this.repelRadius = 1.5 * 32; // 1.5 meters in pixels
    
    // Sound effects
    this.outOfBreathSound = null;
    this.isPlayingOutOfBreath = false;
  }
  
  update(deltaTime) {
    const input = this.game.inputManager;

    // Get movement input
    const movement = input.getMovementVector();

    // Update shoot cooldown
    if (this.shootTimer > 0) {
      this.shootTimer -= deltaTime;
    }

    // Handle shooting (Shift key or touch shoot button)
    if (input.isShootingActive() && this.shootTimer <= 0) {
      this.shoot();
    }

    // Update shooting animation
    if (this.isShooting) {
      this.shootAnimationTimer -= deltaTime;
      if (this.shootAnimationTimer <= 0) {
        this.isShooting = false;
      }
    }

    // Regenerate stamina passively (kept for potential future use)
    this.stats.stamina += 10 * deltaTime;
    this.stats.stamina = Math.min(this.stats.maxStamina, this.stats.stamina);

    // Calculate speed (no sprint multiplier anymore)
    const currentSpeed = this.baseSpeed;
    
    // Apply movement
    this.vx = movement.x * currentSpeed;
    this.vy = movement.y * currentSpeed;
    
    // Calculate new position
    const newX = this.x + this.vx * deltaTime;
    const newY = this.y + this.vy * deltaTime;
    
    // Check collisions with traphouses and safe house
    const state = this.game.stateManager.currentState;
    let canMoveX = true;
    let canMoveY = true;

    // Get all buildings to check collision against
    const buildings = [];
    if (state && state.traphouses) {
      buildings.push(...state.traphouses);
    }
    if (state && state.safeHouse) {
      buildings.push(state.safeHouse);
    }

    for (const building of buildings) {
      // Check X movement
      if (this.checkCollision(newX, this.y, building)) {
        canMoveX = false;
      }
      // Check Y movement
      if (this.checkCollision(this.x, newY, building)) {
        canMoveY = false;
      }
      // Check diagonal movement if both X and Y are blocked
      if (!canMoveX && !canMoveY && this.checkCollision(newX, newY, building)) {
        break; // Already blocked in both directions
      }
    }
    
    // Apply movement if no collision
    if (canMoveX) {
      this.x = newX;
    }
    if (canMoveY) {
      this.y = newY;
    }
    
    // Keep within world bounds
    if (state && state.worldWidth && state.worldHeight) {
      this.x = Math.max(0, Math.min(state.worldWidth - this.width, this.x));
      this.y = Math.max(0, Math.min(state.worldHeight - this.height, this.y));
    }
    
    // Update facing direction only when moving - prioritize horizontal movement
    if (this.vx !== 0 || this.vy !== 0) {
      // Only update facing when actually moving
      if (this.vx !== 0) {
        // If moving horizontally at all, face left or right
        this.facing = this.vx > 0 ? 'right' : 'left';
        this.lastHorizontalFacing = this.facing; // Remember horizontal direction
      } else {
        // Only face up/down if not moving horizontally
        this.facing = this.vy > 0 ? 'down' : 'up';
      }
    }
    // When not moving, maintain the last facing direction
    
    // Update animation
    this.isMoving = this.vx !== 0 || this.vy !== 0;
    if (this.isMoving) {
      this.animationTimer += deltaTime;
      if (this.animationTimer >= 0.4) {
        this.animationFrame = (this.animationFrame + 1) % 2; // Alternate between 2 frames
        this.animationTimer = 0;
      }
    } else {
      this.animationFrame = 0;
      this.animationTimer = 0;
    }
    
    // Update camera to follow player
    this.game.camera.follow(this);
  }
  
  render(ctx, interpolation) {
    // Get appropriate sprite based on animation frame and facing direction
    let sprite;

    // Shooting animation takes priority
    if (this.isShooting) {
      if (this.facing === 'down') {
        sprite = this.game.assetLoader.getImage('chronikShootDown');
      } else if (this.facing === 'up') {
        sprite = this.game.assetLoader.getImage('chronikShootUp');
      } else {
        sprite = this.game.assetLoader.getImage('chronikShootSide');
      }
    } else if (this.isMoving) {
      if (this.facing === 'down') {
        // Use down-facing walk sprites
        sprite = this.animationFrame === 0
          ? this.game.assetLoader.getImage('chronikWalkDown1')
          : this.game.assetLoader.getImage('chronikWalkDown2');
      } else if (this.facing === 'up') {
        // Use up-facing walk sprites
        sprite = this.animationFrame === 0
          ? this.game.assetLoader.getImage('chronikWalkUp1')
          : this.game.assetLoader.getImage('chronikWalkUp2');
      } else {
        // Use side-facing walk sprites (left/right)
        sprite = this.animationFrame === 0
          ? this.game.assetLoader.getImage('chronikWalk1')
          : this.game.assetLoader.getImage('chronikWalk2');
      }
    } else {
      sprite = this.game.assetLoader.getImage('chronikStand'); // Use standing sprite when not moving
    }

    // Fallback to placeholder if sprites not loaded
    if (!sprite) {
      sprite = this.game.assetLoader.getImage('chronik');
    }
    
    // Draw speed trail effect if moving fast with upgrades
    const speedLevel = this.upgradeLevels?.speed || 0;
    if (speedLevel > 0 && (this.vx !== 0 || this.vy !== 0)) {
      ctx.save();
      ctx.globalAlpha = 0.3;
      
      // Draw motion blur trails
      for (let i = 1; i <= speedLevel; i++) {
        const trailX = this.x - (this.vx * 0.01 * i);
        const trailY = this.y - (this.vy * 0.01 * i);
        ctx.globalAlpha = 0.3 - (i * 0.05);
        
        if (sprite) {
          this.game.renderer.drawSprite(
            sprite,
            trailX,
            trailY,
            this.width,
            this.height,
            {
              flipX: (this.facing === 'left' || this.facing === 'right') && this.lastHorizontalFacing === 'right' // Only flip side-facing sprites
            }
          );
        }
      }
      ctx.restore();
    }
    
    if (!sprite) return;
    
    // Draw sprite with direction flipping (don't flip down-facing sprites)
    this.game.renderer.drawSprite(
      sprite,
      this.x,
      this.y,
      this.width,
      this.height,
      {
        flipX: (this.facing === 'left' || this.facing === 'right') && this.lastHorizontalFacing === 'right'
      }
    );
    
    // Draw pickup radius indicator when Long Arms upgrade is active
    if (this.upgradeLevels?.pickupRadius > 0) {
      ctx.save();
      
      // Enhanced pulsing effect
      const pulseScale = 1 + Math.sin(Date.now() * 0.003) * 0.05;
      const radius = this.stats.pickupRadius * 32 * pulseScale;
      const centerX = this.getCenterX();
      const centerY = this.getCenterY();
      
      // Outer glow circle
      ctx.strokeStyle = 'rgba(100, 200, 255, 0.1)';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius + 2, 0, Math.PI * 2);
      ctx.stroke();
      
      // Main circle with gradient
      const gradient = ctx.createRadialGradient(centerX, centerY, radius - 10, centerX, centerY, radius);
      gradient.addColorStop(0, 'rgba(100, 200, 255, 0.1)');
      gradient.addColorStop(1, 'rgba(100, 200, 255, 0.3)');
      ctx.strokeStyle = gradient;
      ctx.lineWidth = 3;
      ctx.setLineDash([8, 4]); // Dashed line
      
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
      ctx.stroke();
      
      // Inner bright circle for emphasis
      ctx.strokeStyle = 'rgba(150, 220, 255, 0.25)';
      ctx.lineWidth = 2;
      ctx.setLineDash([]); // Solid line
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius - 4, 0, Math.PI * 2);
      ctx.stroke();
      
      ctx.restore();
    }
    
    // Draw pickup radius (debug)
    if (this.game.debug.showCollisionBoxes) {
      ctx.save();
      ctx.strokeStyle = 'rgba(0, 255, 0, 0.3)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(
        this.getCenterX(),
        this.getCenterY(),
        this.stats.pickupRadius * 32,
        0,
        Math.PI * 2
      );
      ctx.stroke();
      
      // Draw repel radius
      ctx.strokeStyle = 'rgba(255, 0, 0, 0.3)';
      ctx.beginPath();
      ctx.arc(
        this.getCenterX(),
        this.getCenterY(),
        this.repelRadius,
        0,
        Math.PI * 2
      );
      ctx.stroke();
      ctx.restore();
    }
    
    // Draw carried loot indicator with colors
    if (this.carriedLoot.length > 0) {
      ctx.save();

      // Draw loot count
      ctx.fillStyle = '#000';
      ctx.font = 'bold 12px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(
        `${this.carriedLoot.length}/${this.stats.carrySlots}`,
        this.getCenterX(),
        this.y - 5
      );

      // Draw colored indicators for each loot type
      const lootColors = {};
      this.carriedLoot.forEach(item => {
        lootColors[item.color] = (lootColors[item.color] || 0) + 1;
      });

      let offsetX = -20;
      Object.entries(lootColors).forEach(([color, count]) => {
        // Draw colored circle for each loot type
        const colorHex = this.getLootColorHex(color);
        ctx.fillStyle = colorHex;
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 1;

        ctx.beginPath();
        ctx.arc(this.getCenterX() + offsetX, this.y - 20, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Draw count if more than 1
        if (count > 1) {
          ctx.fillStyle = '#fff';
          ctx.font = 'bold 8px Arial';
          ctx.fillText(count.toString(), this.getCenterX() + offsetX, this.y - 17);
        }

        offsetX += 15;
      });

      ctx.restore();
    }

    // Draw health bar above player
    this.renderHealthBar(ctx);
  }

  renderHealthBar(ctx) {
    const barWidth = 50;
    const barHeight = 6;
    const barX = this.getCenterX() - barWidth / 2;
    const barY = this.y - 35;

    // Background (black)
    ctx.fillStyle = '#000';
    ctx.fillRect(barX - 1, barY - 1, barWidth + 2, barHeight + 2);

    // Red background (damage)
    ctx.fillStyle = '#ff0000';
    ctx.fillRect(barX, barY, barWidth, barHeight);

    // Green health
    const healthPercent = this.health / this.maxHealth;
    ctx.fillStyle = '#00ff00';
    ctx.fillRect(barX, barY, barWidth * healthPercent, barHeight);
  }

  takeDamage(amount) {
    if (this.isDead) return;

    this.health -= amount;
    if (this.health <= 0) {
      this.health = 0;
      this.isDead = true;
    }
  }

  pickupLoot(item) {
    if (this.carriedLoot.length >= this.stats.carrySlots) {
      return false;
    }

    this.carriedLoot.push(item);
    return true;
  }

  stashLoot() {
    // Remove and return the first item from carried loot
    if (this.carriedLoot.length > 0) {
      return this.carriedLoot.shift();
    }
    return null;
  }

  dropAllLoot() {
    const dropped = [...this.carriedLoot];
    this.carriedLoot = [];
    return dropped;
  }
  
  // Upgrade methods
  upgrade(stat, amount) {
    switch (stat) {
      case 'moveSpeed':
        this.stats.moveSpeed += amount;
        this.baseSpeed = this.stats.moveSpeed * 32;
        break;
      case 'pickupRadius':
        this.stats.pickupRadius += amount;
        break;
      case 'returnRadius':
        this.stats.returnRadius += amount;
        break;
      case 'carrySlots':
        this.stats.carrySlots += amount;
        break;
      case 'stamina':
        this.stats.maxStamina += amount;
        this.stats.stamina += amount;
        break;
      case 'beefDampening':
        this.stats.beefDampening += amount;
        break;
      case 'xpMultiplier':
        this.stats.xpMultiplier += amount;
        break;
    }
  }
  
  getXPMultiplier() {
    return this.stats.xpMultiplier;
  }
  
  checkCollision(x, y, entity) {
    // Check if entity has a collision box
    if (!entity.collisionBox) {
      return false;
    }
    
    // Calculate player's collision bounds at new position using collision box
    const playerLeft = x + this.collisionBox.offsetX;
    const playerRight = playerLeft + this.collisionBox.width;
    const playerTop = y + this.collisionBox.offsetY;
    const playerBottom = playerTop + this.collisionBox.height;
    
    // Calculate entity's collision bounds
    const entityLeft = entity.x + entity.collisionBox.offsetX;
    const entityRight = entityLeft + entity.collisionBox.width;
    const entityTop = entity.y + entity.collisionBox.offsetY;
    const entityBottom = entityTop + entity.collisionBox.height;
    
    // Check for overlap
    return !(playerLeft >= entityRight || 
             playerRight <= entityLeft || 
             playerTop >= entityBottom || 
             playerBottom <= entityTop);
  }
  
  getLootColorHex(color) {
    const colors = {
      red: '#ff4444',
      blue: '#4444ff',
      green: '#44ff44',
      yellow: '#ffff44',
      purple: '#ff44ff',
      orange: '#ff8844'
    };
    return colors[color] || '#888888';
  }
  
  playOutOfBreathSound() {
    if (!this.outOfBreathSound) {
      this.outOfBreathSound = new Audio('/out_of_breath.mp3');
      this.outOfBreathSound.volume = 0.6;
      this.outOfBreathSound.loop = true;
    }
    this.outOfBreathSound.play().catch(e => console.log('Out of breath sound play failed:', e));
  }
  
  stopOutOfBreathSound() {
    if (this.outOfBreathSound) {
      this.outOfBreathSound.pause();
      this.outOfBreathSound.currentTime = 0;
    }
  }
  
  cleanup() {
    // Stop all sounds when player is cleaned up
    this.stopOutOfBreathSound();
    this.isPlayingOutOfBreath = false;
  }

  shoot() {
    // Create projectile at player center
    const projectile = new Projectile(
      this.game,
      this.getCenterX() - 8, // Center the 16x16 projectile
      this.getCenterY() - 8,
      this.facing
    );

    // Add to game state
    const state = this.game.stateManager.currentState;
    if (state && state.addProjectile) {
      state.addProjectile(projectile);
    }

    // Reset cooldown
    this.shootTimer = this.shootCooldown;

    // Start shooting animation
    this.isShooting = true;
    this.shootAnimationTimer = this.shootAnimationDuration;
  }
}