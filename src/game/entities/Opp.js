import { Entity } from './Entity.js';
import { Projectile } from './Projectile.js';

export class Opp extends Entity {
  constructor(game, x, y, aggressionLevel = 1) {
    super(x, y, 32, 40); // Slightly larger for better visibility
    this.game = game;
    this.aggressionLevel = aggressionLevel; // 1 = easy, 2 = normal, 3 = aggressive
    
    // Randomly select sprite type (1, 2, or 3)
    this.spriteType = Math.floor(Math.random() * 3) + 1;
    
    // Movement properties - scale with aggression (faster for more street presence)
    this.speed = aggressionLevel === 1 ? 90 : aggressionLevel === 2 ? 110 : 130;
    this.fleeSpeed = aggressionLevel === 1 ? 120 : aggressionLevel === 2 ? 140 : 160;
    this.direction = Math.random() * Math.PI * 2; // Random initial direction
    this.targetDirection = this.direction; // Smoothly interpolate toward this
    this.directionChangeTimer = 0;
    this.directionChangeInterval = 2; // Change direction every 2 seconds
    this.stuckTimer = 0; // Track if opp is stuck
    this.lastPosition = { x: 0, y: 0 }; // For stuck detection
    
    // Behavior states
    this.state = 'wandering'; // wandering, fleeing, stealing, chasing
    this.target = null; // Target shelf or escape point

    // Chasing behavior - aggressive opps chase instead of flee
    this.isChaser = aggressionLevel >= 2 && Math.random() < 0.5; // 50% of level 2+ are chasers
    this.chaseSpeed = aggressionLevel === 2 ? 85 : 100; // Chasers are fast
    
    // Loot carrying - scale with aggression (reduced cooldowns for constant stealing)
    this.carriedLoot = null;
    this.lootStealCooldown = 0;
    this.lootStealCooldownTime = aggressionLevel === 1 ? 2.0 : aggressionLevel === 2 ? 1.0 : 0.5;
    this.dropLootTimer = 0; // Timer for when to drop carried loot
    this.grabDelay = 0; // Delay before grabbing loot from safe house
    this.grabDelayTime = aggressionLevel === 1 ? 1.0 : aggressionLevel === 2 ? 0.5 : 0.2;
    this.dropLootMinTime = aggressionLevel === 1 ? 8 : aggressionLevel === 2 ? 5 : 3;
    this.dropLootMaxTime = aggressionLevel === 1 ? 10 : aggressionLevel === 2 ? 8 : 5;

    // Detection ranges
    this.safeHouseDetectionRange = 1500; // Can see safe house from anywhere on map
    this.playerDetectionRange = 96; // 3 tiles
    
    // Animation
    this.animationFrame = 0;
    this.animationTimer = 0;
    this.facing = 'left'; // Opps face left by default
    this.isMoving = false;
    
    // Sound effects
    this.hasPlayedLaughSound = false; // Prevent multiple laugh sounds per flee

    // Knockback system
    this.isKnockedBack = false;
    this.knockbackTimer = 0;
    this.knockbackRecoveryTime = 0.5; // seconds
    this.knockbackFriction = 0.92;

    // Health system
    this.health = 30;
    this.maxHealth = 30;
    this.isDead = false;

    // Shooting system
    this.shootCooldown = 1.2; // seconds between shots (aggressive shooting!)
    this.shootTimer = Math.random() * 1; // Randomize initial cooldown (faster start)
    this.shootRange = 350; // Shoot from further away

    // Opp Block guard properties (set externally if this is a guard)
    this.isOppBlockGuard = false;
    this.guardPatrolCenter = null;
    this.oppBlock = null;
    this.isAlerted = false;
    this.alertTarget = null;
    this.guardPatrolRadius = 80; // How far guards wander from their post
  }

  update(deltaTime) {
    // Handle knockback state
    if (this.isKnockedBack) {
      this.knockbackTimer -= deltaTime;

      // Apply knockback velocity with friction
      this.x += this.vx * deltaTime;
      this.y += this.vy * deltaTime;
      this.vx *= this.knockbackFriction;
      this.vy *= this.knockbackFriction;

      // Keep within world bounds during knockback
      const state = this.game.stateManager.currentState;
      if (state && state.worldWidth && state.worldHeight) {
        this.x = Math.max(0, Math.min(state.worldWidth - this.width, this.x));
        this.y = Math.max(0, Math.min(state.worldHeight - this.height, this.y));
      }

      // Recover from knockback
      if (this.knockbackTimer <= 0) {
        this.isKnockedBack = false;
        this.vx = 0;
        this.vy = 0;
        // Drop loot if carrying any
        if (this.carriedLoot) {
          this.dropLoot();
        }
      }
      return; // Skip normal behavior while knocked back
    }

    // Update cooldowns
    if (this.lootStealCooldown > 0) {
      this.lootStealCooldown -= deltaTime;
    }

    // Push out of buildings if stuck inside
    this.pushOutOfBuildings();

    // State machine
    switch (this.state) {
      case 'wandering':
        this.updateWandering(deltaTime);
        break;
      case 'fleeing':
        this.updateFleeing(deltaTime);
        break;
      case 'stealing':
        this.updateStealing(deltaTime);
        break;
      case 'chasing':
        this.updateChasing(deltaTime);
        break;
    }

    // Shooting logic - shoot at player if in range
    this.updateShooting(deltaTime);

    // Update animation
    this.isMoving = this.vx !== 0 || this.vy !== 0;
    if (this.isMoving) {
      this.animationTimer += deltaTime;
      if (this.animationTimer >= 0.2) {
        this.animationFrame = (this.animationFrame + 1) % 2; // Alternate between 2 frames
        this.animationTimer = 0;
      }
    } else {
      this.animationFrame = 0;
      this.animationTimer = 0;
    }
    
    // Update facing direction (only left/right for opps)
    if (Math.abs(this.vx) > 0.1) {
      this.facing = this.vx > 0 ? 'right' : 'left';
    }
    
    // Update loot drop timer if carrying
    if (this.carriedLoot) {
      this.dropLootTimer += deltaTime;
      // Drop loot after time based on aggression level
      if (this.dropLootTimer > this.dropLootMinTime + Math.random() * (this.dropLootMaxTime - this.dropLootMinTime)) {
        this.dropLoot();
        this.dropLootTimer = 0;
        this.state = 'wandering'; // Go find more loot
      }
    }
    
    // Keep within world bounds
    const state = this.game.stateManager.currentState;
    if (state && state.worldWidth && state.worldHeight) {
      this.x = Math.max(0, Math.min(state.worldWidth - this.width, this.x));
      this.y = Math.max(0, Math.min(state.worldHeight - this.height, this.y));
    }
  }
  
  updateWandering(deltaTime) {
    const state = this.game.stateManager.currentState;
    if (!state) return;

    const player = state.player;
    const safeHouse = state.safeHouse;

    // === OPP BLOCK GUARD BEHAVIOR ===
    if (this.isOppBlockGuard) {
      // If alerted, chase the player!
      if (this.isAlerted && player) {
        this.state = 'chasing';
        return;
      }

      // Guards patrol near their assigned position, not the safe house
      // Check for player near the Opp Block - guards are aggressive
      if (player) {
        const distToPlayer = this.getDistanceTo(player);
        if (distToPlayer < this.playerDetectionRange * 1.5) {
          // Guards always chase when player is nearby
          this.state = 'chasing';
          return;
        }
      }

      // Patrol near guard position with smooth movement
      this.directionChangeTimer -= deltaTime;
      if (this.directionChangeTimer <= 0) {
        if (this.guardPatrolCenter) {
          // Check if too far from patrol center
          const dx = this.guardPatrolCenter.x - this.getCenterX();
          const dy = this.guardPatrolCenter.y - this.getCenterY();
          const distFromPost = Math.sqrt(dx * dx + dy * dy);

          if (distFromPost > this.guardPatrolRadius) {
            // Return to patrol center
            this.targetDirection = Math.atan2(dy, dx);
          } else {
            // Patrol in a circular pattern near post
            this.targetDirection = this.direction + Math.PI / 4 + (Math.random() - 0.5) * 0.3;
          }
        }
        this.directionChangeTimer = 2.0 + Math.random() * 1.5;
      }

      // Smoothly interpolate direction
      this.direction = this.lerpAngle(this.direction, this.targetDirection, 2.5 * deltaTime);

      // Move in patrol direction
      this.vx = Math.cos(this.direction) * this.speed * 0.6; // Patrol speed
      this.vy = Math.sin(this.direction) * this.speed * 0.6;
      this.applyMovement(deltaTime);
      return; // Guards don't do normal wandering
    }

    // === NORMAL OPP BEHAVIOR ===

    // === BEEF TRIGGERED - OPPS GO TO SAFE HOUSE ===
    if (this.targetingSafeHouse && safeHouse) {
      // When beef is triggered, opps relentlessly go to safe house
      const dx = safeHouse.getCenterX() - this.getCenterX();
      const dy = safeHouse.getCenterY() - this.getCenterY();

      // Smoothly turn toward safe house
      this.targetDirection = Math.atan2(dy, dx);
      this.direction = this.lerpAngle(this.direction, this.targetDirection, 4.0 * deltaTime);

      // Move faster when targeting safe house (1.5x speed)
      this.vx = Math.cos(this.direction) * this.speed * 1.5;
      this.vy = Math.sin(this.direction) * this.speed * 1.5;
      this.applyMovement(deltaTime);

      // If near safe house, try to steal or attack
      if (this.isNearBuilding(safeHouse, 10)) {
        // Try to steal if safe house has loot and we're not carrying
        if (!this.carriedLoot && safeHouse.hasLoot()) {
          this.target = safeHouse;
          this.state = 'stealing';
        }
        // Stay aggressive even if no loot - they're here for beef!
      }
      return;
    }

    // Check for player proximity
    if (player) {
      const distToPlayer = this.getDistanceTo(player);
      if (distToPlayer < this.playerDetectionRange * 2) { // Wider detection for chasers
        if (this.isChaser) {
          // Chasers attack!
          this.state = 'chasing';
          return;
        } else if (distToPlayer < this.playerDetectionRange) {
          // Non-chasers flee
          if (this.state !== 'fleeing') {
            this.game.gameData.oppsRepelled++;
          }
          this.state = 'fleeing';
          this.playLaughingSound();
          return;
        }
      }
    }

    // ALWAYS look for safe house with loot to steal (opps constantly raid player's stash!)
    if (!this.carriedLoot && this.lootStealCooldown <= 0 && safeHouse && safeHouse.hasLoot()) {
      // Always target safe house if it has loot - opps are relentless!
      this.target = safeHouse;
      this.state = 'stealing';
      return;
    }

    // Wander the streets - only seek safe house if it has loot
    if (!this.carriedLoot) {
      this.directionChangeTimer -= deltaTime;
      if (this.directionChangeTimer <= 0) {
        // 80% chance to head toward safe house ONLY if it has loot
        if (safeHouse && safeHouse.hasLoot() && Math.random() < 0.8 && this.lootStealCooldown <= 0) {
          const dx = safeHouse.getCenterX() - this.getCenterX();
          const dy = safeHouse.getCenterY() - this.getCenterY();
          this.targetDirection = Math.atan2(dy, dx) + (Math.random() - 0.5) * 0.2;
        } else {
          // Pick a patrol waypoint instead of random direction
          this.targetDirection = this.pickPatrolDirection(state);
        }
        this.directionChangeTimer = 2.5 + Math.random() * 2.0; // 2.5-4.5 seconds (longer intervals)
      }

      // Smoothly interpolate toward target direction
      this.direction = this.lerpAngle(this.direction, this.targetDirection, 3.0 * deltaTime);
    } else {
      // Carrying loot - take it back to a traphouse
      this.directionChangeTimer -= deltaTime;
      if (this.directionChangeTimer <= 0) {
        // Move towards nearest traphouse to return stolen loot
        const traphouses = state.traphouses || [];
        let nearestTraphouse = null;
        let nearestDist = Infinity;

        for (const traphouse of traphouses) {
          if (traphouse.hasEmptySlots()) {
            const dist = this.getDistanceTo(traphouse);
            if (dist < nearestDist) {
              nearestDist = dist;
              nearestTraphouse = traphouse;
            }
          }
        }

        if (nearestTraphouse) {
          const dx = nearestTraphouse.getCenterX() - this.getCenterX();
          const dy = nearestTraphouse.getCenterY() - this.getCenterY();
          this.direction = Math.atan2(dy, dx);

          // If close to traphouse, deposit loot
          if (nearestDist < 50 && nearestTraphouse.hasEmptySlots()) {
            nearestTraphouse.addLoot(this.carriedLoot);
            this.carriedLoot = null;
            this.dropLootTimer = 0;
          }
        } else {
          this.direction = Math.random() * Math.PI * 2;
        }
        this.directionChangeTimer = 1.0;
      }
    }

    // Move in current direction
    this.vx = Math.cos(this.direction) * this.speed;
    this.vy = Math.sin(this.direction) * this.speed;

    // When hitting edges, turn toward center
    if (state.worldWidth && state.worldHeight) {
      const margin = 10;
      if (this.x <= margin || this.x >= state.worldWidth - this.width - margin ||
          this.y <= margin || this.y >= state.worldHeight - this.height - margin) {
        // Turn toward center
        const centerX = state.worldWidth / 2;
        const centerY = state.worldHeight / 2;
        const dx = centerX - this.getCenterX();
        const dy = centerY - this.getCenterY();
        this.direction = Math.atan2(dy, dx) + (Math.random() - 0.5) * 0.5;
      }
    }

    // Apply movement with collision detection
    this.applyMovement(deltaTime);
  }
  
  updateFleeing(deltaTime) {
    const state = this.game.stateManager.currentState;
    if (!state) return;
    
    const player = state.player;
    
    // If no player or player is far, just run in a random direction briefly
    if (!player) {
      // Run away from where we were for a bit
      this.vx = Math.cos(this.direction) * this.fleeSpeed;
      this.vy = Math.sin(this.direction) * this.fleeSpeed;
      this.applyMovement(deltaTime);
      
      // Stop fleeing after 1 second
      if (!this.fleeTimer) this.fleeTimer = 1;
      this.fleeTimer -= deltaTime;
      if (this.fleeTimer <= 0) {
        this.fleeTimer = null;
        this.state = 'wandering';
        this.hasPlayedLaughSound = false; // Reset for next flee
      }
      return;
    }
    
    const distToPlayer = this.getDistanceTo(player);
    
    // Stop fleeing if far enough away
    if (distToPlayer > this.playerDetectionRange * 1.5) {
      this.state = 'wandering';
      this.hasPlayedLaughSound = false; // Reset for next flee
      return;
    }
    
    // Run away from player with smooth turning
    const dx = this.getCenterX() - player.getCenterX();
    const dy = this.getCenterY() - player.getCenterY();
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist > 0) {
      // Smoothly turn away from player
      this.targetDirection = Math.atan2(dy, dx);
      this.direction = this.lerpAngle(this.direction, this.targetDirection, 6.0 * deltaTime);

      this.vx = Math.cos(this.direction) * this.fleeSpeed;
      this.vy = Math.sin(this.direction) * this.fleeSpeed;
    }

    // Apply movement with collision detection
    this.applyMovement(deltaTime);

    // Drop loot if carrying any (scared)
    if (this.carriedLoot && Math.random() < 2.0 * deltaTime) { // 200% chance per second (almost immediately)
      this.dropLoot();
    }
  }

  updateChasing(deltaTime) {
    const state = this.game.stateManager.currentState;
    if (!state) return;

    const player = state.player;

    // If no player, wander
    if (!player) {
      this.state = 'wandering';
      return;
    }

    const distToPlayer = this.getDistanceTo(player);

    // Stop chasing if player is too far (unless alerted guard)
    if (distToPlayer > this.playerDetectionRange * 3 && !this.isAlerted) {
      this.state = 'wandering';
      return;
    }

    // Chase the player with smooth turning!
    const dx = player.getCenterX() - this.getCenterX();
    const dy = player.getCenterY() - this.getCenterY();
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist > 0) {
      // Smoothly turn toward player
      this.targetDirection = Math.atan2(dy, dx);
      this.direction = this.lerpAngle(this.direction, this.targetDirection, 5.0 * deltaTime);

      this.vx = Math.cos(this.direction) * this.chaseSpeed;
      this.vy = Math.sin(this.direction) * this.chaseSpeed;
    }

    // Apply movement with collision detection
    this.applyMovement(deltaTime);
  }

  updateStealing(deltaTime) {
    if (!this.target || this.carriedLoot) {
      this.state = 'wandering';
      return;
    }

    const state = this.game.stateManager.currentState;
    const player = state ? state.player : null;

    // Check for player proximity
    if (player) {
      const distToPlayer = this.getDistanceTo(player);
      if (distToPlayer < this.playerDetectionRange) {
        // Track opp being repelled
        if (this.state !== 'fleeing') {
          this.game.gameData.oppsRepelled++;
        }
        this.state = 'fleeing';
        this.playLaughingSound();
        return;
      }
    }

    // Move towards target (safe house) with smooth movement
    const dx = this.target.getCenterX() - this.getCenterX();
    const dy = this.target.getCenterY() - this.getCenterY();
    const dist = Math.sqrt(dx * dx + dy * dy);

    // Use rectangle-based proximity check instead of center distance
    if (!this.isNearBuilding(this.target, 5)) { // 5 pixels - must be touching
      // Smoothly turn toward safe house
      this.targetDirection = Math.atan2(dy, dx);
      this.direction = this.lerpAngle(this.direction, this.targetDirection, 4.0 * deltaTime);

      this.vx = Math.cos(this.direction) * this.speed;
      this.vy = Math.sin(this.direction) * this.speed;
      // Apply movement with collision detection
      this.applyMovement(deltaTime);
    } else {
      // Near safe house (any side), wait a moment then steal loot
      if (this.grabDelay <= 0) {
        this.grabDelay = this.grabDelayTime; // Grab delay based on aggression
      }

      this.grabDelay -= deltaTime;

      if (this.grabDelay <= 0) {
        const item = this.target.removeRandomLoot();
        if (item) {
          // Loot has already been removed from safe house
          // Pick it up and carry it back to traphouse
          this.carriedLoot = item;
          item.isHeld = true;
          item.holder = this;
          item.visible = true;

          this.lootStealCooldown = this.lootStealCooldownTime;
          // Flee after stealing
          this.state = 'fleeing';
        } else {
          // No loot to steal, go back to wandering
          this.state = 'wandering';
          this.lootStealCooldown = 1; // Short cooldown before trying again
        }
        this.target = null;
        this.grabDelay = 0; // Reset grab delay
      }
    }
  }
  
  render(ctx, interpolation) {
    // Get appropriate sprite based on sprite type and animation state
    let sprite;

    // Allies (Slew Dem) use the player sprite (Chronik)
    if (this.isAlly) {
      if (this.isMoving) {
        sprite = this.animationFrame === 0
          ? this.game.assetLoader.getImage('chronikWalk1')
          : this.game.assetLoader.getImage('chronikWalk2');
      } else {
        sprite = this.game.assetLoader.getImage('chronikStand');
      }
      // Fallback if walk sprites don't load
      if (!sprite) {
        sprite = this.game.assetLoader.getImage('chronikStand');
      }
    } else {
      // Regular opps use opp sprites
      const spritePrefix = `opp${this.spriteType}`;

      if (this.isMoving) {
        // Use walking sprite when moving
        sprite = this.animationFrame === 0
          ? this.game.assetLoader.getImage(`${spritePrefix}Stand`)
          : this.game.assetLoader.getImage(`${spritePrefix}Walk`);
      } else {
        // Use standing sprite when stationary
        sprite = this.game.assetLoader.getImage(`${spritePrefix}Stand`);
      }

      // Fallback to placeholder
      if (!sprite) {
        sprite = this.game.assetLoader.getImage('opp');
      }
    }

    if (sprite) {
      // Calculate proper dimensions to maintain aspect ratio
      const targetHeight = this.height; // Keep height consistent
      const aspectRatio = sprite.width / sprite.height;
      const targetWidth = targetHeight * aspectRatio;

      // Center the sprite horizontally within the entity bounds
      const xOffset = (this.width - targetWidth) / 2;

      // Draw sprite with direction flipping and proper aspect ratio
      this.game.renderer.drawSprite(
        sprite,
        this.x + xOffset,
        this.y,
        targetWidth,
        targetHeight,
        {
          flipX: this.facing === 'right' // Flip when facing right
        }
      );
    }
    // No fallback - if sprite doesn't load, nothing is drawn
    
    // Draw carried loot above head
    if (this.carriedLoot) {
      // Center loot above the opp's actual sprite (accounting for aspect ratio)
      this.carriedLoot.x = this.getCenterX() - this.carriedLoot.width / 2;
      this.carriedLoot.y = this.y - this.carriedLoot.height - 4;
      this.carriedLoot.render(ctx, interpolation);
    }

    // Draw health bar above opp
    this.renderHealthBar(ctx);
  }

  renderHealthBar(ctx) {
    const barWidth = 30;
    const barHeight = 4;
    const barX = this.getCenterX() - barWidth / 2;
    const barY = this.y - 10;

    // Background (black)
    ctx.fillStyle = '#000';
    ctx.fillRect(barX - 1, barY - 1, barWidth + 2, barHeight + 2);

    // Allies get blue/cyan health bar, enemies get red/green
    if (this.isAlly) {
      // Blue background (damage)
      ctx.fillStyle = '#003366';
      ctx.fillRect(barX, barY, barWidth, barHeight);

      // Cyan health
      const healthPercent = this.health / this.maxHealth;
      ctx.fillStyle = '#00ffff';
      ctx.fillRect(barX, barY, barWidth * healthPercent, barHeight);
    } else {
      // Red background (damage)
      ctx.fillStyle = '#ff0000';
      ctx.fillRect(barX, barY, barWidth, barHeight);

      // Green health
      const healthPercent = this.health / this.maxHealth;
      ctx.fillStyle = '#00ff00';
      ctx.fillRect(barX, barY, barWidth * healthPercent, barHeight);
    }
  }
  
  dropLoot() {
    if (this.carriedLoot) {
      const item = this.carriedLoot;
      item.isHeld = false;
      item.holder = null;
      item.isStashed = false; // CRITICAL: Ensure loot is marked as not stashed
      item.visible = true; // Ensure loot remains visible

      // Check if we're near any building and adjust drop position
      const state = this.game.stateManager.currentState;
      let dropX = this.x + (this.width - item.width) / 2;
      let dropY = this.y + this.height;

      // Get all buildings (traphouses + safe house)
      const buildings = [];
      if (state && state.traphouses) {
        buildings.push(...state.traphouses);
      }
      if (state && state.safeHouse) {
        buildings.push(state.safeHouse);
      }

      const safetyMargin = 30;

      for (const building of buildings) {
        // Check if the loot's bounding box would overlap with building (with margin)
        const itemLeft = dropX;
        const itemRight = dropX + item.width;
        const itemTop = dropY;
        const itemBottom = dropY + item.height;

        const buildingLeft = building.x - safetyMargin;
        const buildingRight = building.x + building.width + safetyMargin;
        const buildingTop = building.y - safetyMargin;
        const buildingBottom = building.y + building.height + safetyMargin;

        // Check for overlap
        if (!(itemLeft > buildingRight || itemRight < buildingLeft ||
              itemTop > buildingBottom || itemBottom < buildingTop)) {
          // Loot would overlap with building, find safe position
          const leftDist = Math.abs(this.getCenterX() - building.x);
          const rightDist = Math.abs(this.getCenterX() - (building.x + building.width));
          const topDist = Math.abs(this.getCenterY() - building.y);
          const bottomDist = Math.abs(this.getCenterY() - (building.y + building.height));

          const minDist = Math.min(leftDist, rightDist, topDist, bottomDist);

          if (minDist === leftDist) {
            dropX = building.x - item.width - safetyMargin;
          } else if (minDist === rightDist) {
            dropX = building.x + building.width + safetyMargin;
          } else if (minDist === topDist) {
            dropY = building.y - item.height - safetyMargin;
          } else {
            dropY = building.y + building.height + safetyMargin;
          }
        }
      }

      // Ensure loot is dropped within playable bounds
      if (state && state.worldWidth && state.worldHeight) {
        const margin = 50;
        dropX = Math.max(margin, Math.min(state.worldWidth - item.width - margin, dropX));
        dropY = Math.max(margin, Math.min(state.worldHeight - item.height - margin, dropY));
      }

      item.x = dropX;
      item.y = dropY;

      // Give loot a little random velocity
      item.vx = (Math.random() - 0.5) * 50;
      item.vy = Math.random() * 25 + 25;

      this.carriedLoot = null;
    }
  }
  
  getDistanceTo(entity) {
    const dx = this.getCenterX() - entity.getCenterX();
    const dy = this.getCenterY() - entity.getCenterY();
    return Math.sqrt(dx * dx + dy * dy);
  }
  
  applyMovement(deltaTime) {
    const state = this.game.stateManager.currentState;

    // Get all buildings (traphouses + safe house)
    const buildings = [];
    if (state && state.traphouses) {
      buildings.push(...state.traphouses);
    }
    if (state && state.safeHouse) {
      buildings.push(state.safeHouse);
    }

    if (buildings.length === 0) {
      // No collision detection available, just move
      this.x += this.vx * deltaTime;
      this.y += this.vy * deltaTime;
      return;
    }

    // Calculate new position
    const newX = this.x + this.vx * deltaTime;
    const newY = this.y + this.vy * deltaTime;

    // Check collisions with buildings (only nearby ones)
    let canMoveX = true;
    let canMoveY = true;
    const checkRadius = 100;

    for (const building of buildings) {
      // Quick bounds check
      if (Math.abs(building.x - this.x) > checkRadius ||
          Math.abs(building.y - this.y) > checkRadius) {
        continue;
      }

      // Check X movement
      if (canMoveX && this.checkCollision(newX, this.y, building)) {
        canMoveX = false;
      }
      // Check Y movement
      if (canMoveY && this.checkCollision(this.x, newY, building)) {
        canMoveY = false;
      }

      // Early exit if both movements are blocked
      if (!canMoveX && !canMoveY) {
        break;
      }
    }

    // Apply movement - slide along walls instead of bouncing
    if (canMoveX) {
      this.x = newX;
    } else {
      // Can't move X - slide along wall, don't reverse
      this.vx = 0;
    }

    if (canMoveY) {
      this.y = newY;
    } else {
      // Can't move Y - slide along wall, don't reverse
      this.vy = 0;
    }

    // If completely blocked, pick a new direction
    if (!canMoveX && !canMoveY && this.state === 'wandering') {
      // Turn perpendicular to current direction
      this.targetDirection = this.direction + Math.PI / 2 + (Math.random() - 0.5) * 0.5;
      this.directionChangeTimer = 0.5; // Quick reassess
    }
  }

  pushOutOfBuildings() {
    const state = this.game.stateManager.currentState;
    if (!state) return;

    // Get all buildings (traphouses + safe house)
    const buildings = [];
    if (state.traphouses) buildings.push(...state.traphouses);
    if (state.safeHouse) buildings.push(state.safeHouse);

    for (const building of buildings) {
      // Check if opp is inside this building
      if (this.isInsideBuilding(building)) {
        // Push opp out to nearest edge
        const oppCenterX = this.getCenterX();
        const oppCenterY = this.getCenterY();
        const buildingCenterX = building.x + building.width / 2;
        const buildingCenterY = building.y + building.height / 2;

        // Find which edge is closest
        const distToLeft = oppCenterX - building.x;
        const distToRight = (building.x + building.width) - oppCenterX;
        const distToTop = oppCenterY - building.y;
        const distToBottom = (building.y + building.height) - oppCenterY;

        const minDist = Math.min(distToLeft, distToRight, distToTop, distToBottom);

        // Push out to the closest edge + buffer
        const buffer = 5;
        if (minDist === distToLeft) {
          this.x = building.x - this.width - buffer;
        } else if (minDist === distToRight) {
          this.x = building.x + building.width + buffer;
        } else if (minDist === distToTop) {
          this.y = building.y - this.height - buffer;
        } else {
          this.y = building.y + building.height + buffer;
        }
        break; // Only push out of one building at a time
      }
    }
  }

  isInsideBuilding(building) {
    const oppLeft = this.x;
    const oppRight = this.x + this.width;
    const oppTop = this.y;
    const oppBottom = this.y + this.height;

    const buildingLeft = building.x;
    const buildingRight = building.x + building.width;
    const buildingTop = building.y;
    const buildingBottom = building.y + building.height;

    // Check if opp center is inside building bounds
    const oppCenterX = this.getCenterX();
    const oppCenterY = this.getCenterY();

    return oppCenterX > buildingLeft && oppCenterX < buildingRight &&
           oppCenterY > buildingTop && oppCenterY < buildingBottom;
  }

  isNearBuilding(building, distance) {
    // Check if opp is within distance of any edge of the building
    const oppLeft = this.x;
    const oppRight = this.x + this.width;
    const oppTop = this.y;
    const oppBottom = this.y + this.height;

    const buildingLeft = building.x;
    const buildingRight = building.x + building.width;
    const buildingTop = building.y;
    const buildingBottom = building.y + building.height;

    // Expand building bounds by distance
    const expandedLeft = buildingLeft - distance;
    const expandedRight = buildingRight + distance;
    const expandedTop = buildingTop - distance;
    const expandedBottom = buildingBottom + distance;

    // Check if opp overlaps with expanded bounds
    return !(oppLeft >= expandedRight ||
             oppRight <= expandedLeft ||
             oppTop >= expandedBottom ||
             oppBottom <= expandedTop);
  }

  // Smoothly interpolate between angles
  lerpAngle(from, to, t) {
    // Normalize angles to -PI to PI
    let diff = to - from;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    return from + diff * Math.min(t, 1);
  }

  // Pick a good patrol direction (toward open roads)
  pickPatrolDirection(state) {
    // Road waypoints (centers of road intersections)
    const waypoints = [
      { x: 265, y: 250 }, { x: 535, y: 250 }, { x: 805, y: 250 },
      { x: 265, y: 540 }, { x: 535, y: 540 }, { x: 805, y: 540 },
      { x: 265, y: 820 }, { x: 535, y: 820 }, { x: 805, y: 820 },
      { x: 130, y: 400 }, { x: 130, y: 680 },
      { x: 940, y: 400 }, { x: 940, y: 680 }
    ];

    // Pick a random waypoint that's not too close
    const validWaypoints = waypoints.filter(wp => {
      const dx = wp.x - this.getCenterX();
      const dy = wp.y - this.getCenterY();
      const dist = Math.sqrt(dx * dx + dy * dy);
      return dist > 100 && dist < 600; // Not too close, not too far
    });

    if (validWaypoints.length > 0) {
      const wp = validWaypoints[Math.floor(Math.random() * validWaypoints.length)];
      const dx = wp.x - this.getCenterX();
      const dy = wp.y - this.getCenterY();
      return Math.atan2(dy, dx);
    }

    // Fallback: random direction
    return Math.random() * Math.PI * 2;
  }

  checkCollision(x, y, entity) {
    // Check if entity has a collision box
    if (!entity.collisionBox) {
      return false;
    }

    // Calculate opp's bounds at new position
    const oppLeft = x;
    const oppRight = x + this.width;
    const oppTop = y;
    const oppBottom = y + this.height;
    
    // Calculate entity's collision bounds
    const entityLeft = entity.x + entity.collisionBox.offsetX;
    const entityRight = entityLeft + entity.collisionBox.width;
    const entityTop = entity.y + entity.collisionBox.offsetY;
    const entityBottom = entityTop + entity.collisionBox.height;
    
    // Check for overlap
    return !(oppLeft >= entityRight ||
             oppRight <= entityLeft ||
             oppTop >= entityBottom ||
             oppBottom <= entityTop);
  }

  getUnstuck() {
    const state = this.game.stateManager.currentState;
    if (!state) return;
    
    // If near edges, move towards center
    if (state.worldWidth && state.worldHeight) {
      const centerX = state.worldWidth / 2;
      const centerY = state.worldHeight / 2;
      
      // Calculate direction towards center
      const dx = centerX - this.x;
      const dy = centerY - this.y;
      this.direction = Math.atan2(dy, dx);
      
      // Add some randomness
      this.direction += (Math.random() - 0.5) * Math.PI / 4;
      
      // Force movement
      this.vx = Math.cos(this.direction) * this.speed;
      this.vy = Math.sin(this.direction) * this.speed;
      
      // Try to teleport slightly if really stuck
      if (this.x < 50 || this.x > state.worldWidth - 50 - this.width ||
          this.y < 50 || this.y > state.worldHeight - 50 - this.height) {
        this.x = Math.max(100, Math.min(state.worldWidth - 100 - this.width, this.x));
        this.y = Math.max(100, Math.min(state.worldHeight - 100 - this.height, this.y));
      }
    }
    
    // Reset state to wandering
    this.state = 'wandering';
    this.target = null;
  }
  
  playLaughingSound() {
    // Only play if we haven't already played it for this flee session
    if (!this.hasPlayedLaughSound) {
      // Select laugh sound based on sprite type
      const laughFile = `/opp_laughing_${this.spriteType}.mp3`;
      const laughSound = new Audio(laughFile);
      laughSound.volume = 0.5;
      laughSound.play().catch(e => console.log('Opp laugh sound play failed:', e));
      this.hasPlayedLaughSound = true;
    }
  }

  knockback(directionX, directionY, force = 300) {
    // Apply knockback velocity
    this.vx = directionX * force;
    this.vy = directionY * force;

    // Enter knockback state
    this.isKnockedBack = true;
    this.knockbackTimer = this.knockbackRecoveryTime;

    // Track as repelled
    this.game.gameData.oppsRepelled++;

    // Reset laugh sound so it can play again when they recover
    this.hasPlayedLaughSound = false;
  }

  updateShooting(deltaTime) {
    // Don't shoot while knocked back or fleeing
    if (this.isKnockedBack || this.state === 'fleeing') return;

    // Update shoot timer
    this.shootTimer -= deltaTime;
    if (this.shootTimer > 0) return;

    // Check if player is in range
    const state = this.game.stateManager.currentState;
    const player = state ? state.player : null;
    if (!player || player.isDead) return;

    const distToPlayer = this.getDistanceTo(player);
    if (distToPlayer > this.shootRange) return;

    // Shoot at player
    this.shoot(player);
    this.shootTimer = this.shootCooldown;
  }

  shoot(player) {
    // Calculate direction to player
    const dx = player.getCenterX() - this.getCenterX();
    const dy = player.getCenterY() - this.getCenterY();
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist === 0) return;

    // Determine projectile direction (4-directional)
    let direction;
    if (Math.abs(dx) > Math.abs(dy)) {
      direction = dx > 0 ? 'right' : 'left';
    } else {
      direction = dy > 0 ? 'down' : 'up';
    }

    // Create projectile
    const projectile = new Projectile(
      this.game,
      this.getCenterX() - 8,
      this.getCenterY() - 8,
      direction,
      'opp' // owner
    );

    // Add to game state
    const state = this.game.stateManager.currentState;
    if (state && state.addProjectile) {
      state.addProjectile(projectile);
    }
  }

  // Allies shoot at opps - projectiles should hit opps, not player
  shootAt(target) {
    // Calculate direction to target
    const dx = target.getCenterX() - this.getCenterX();
    const dy = target.getCenterY() - this.getCenterY();
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist === 0) return;

    // Determine projectile direction (4-directional)
    let direction;
    if (Math.abs(dx) > Math.abs(dy)) {
      direction = dx > 0 ? 'right' : 'left';
    } else {
      direction = dy > 0 ? 'down' : 'up';
    }

    // Create projectile - allies use 'ally' owner so it hits opps
    const projectile = new Projectile(
      this.game,
      this.getCenterX() - 8,
      this.getCenterY() - 8,
      direction,
      'ally' // owner - hits opps, not player
    );

    // Add to game state
    const state = this.game.stateManager.currentState;
    if (state && state.addProjectile) {
      state.addProjectile(projectile);
    }
  }

  takeDamage(amount) {
    if (this.isDead) return;

    this.health -= amount;

    // If this is an Opp Block guard, alert all other guards!
    if (this.isOppBlockGuard) {
      const state = this.game.stateManager.currentState;
      if (state && state.alertOppBlockGuards) {
        const playerPos = state.player ? { x: state.player.getCenterX(), y: state.player.getCenterY() } : null;
        state.alertOppBlockGuards(playerPos);
      }
    }

    if (this.health <= 0) {
      this.health = 0;
      this.isDead = true;
      // Drop loot if carrying
      if (this.carriedLoot) {
        this.dropLoot();
      }
    }
  }
}