import { State } from './State.js';
import { Player } from '../entities/Player.js';
import { Loot } from '../entities/Loot.js';
import { Traphouse } from '../entities/Traphouse.js';
import { SafeHouse } from '../entities/SafeHouse.js';
import { Opp } from '../entities/Opp.js';
import { Projectile } from '../entities/Projectile.js';
import { MobileControls } from '../systems/MobileControls.js';

export class PlayingState extends State {
  constructor(game) {
    super(game);
    this.instanceId = Math.random().toString(36).substring(7); // Unique ID for debugging
    console.log(`[RESTART DEBUG] Creating new PlayingState instance: ${this.instanceId}`);
    this.player = null;
    this.opps = [];
    this.loot = [];
    this.traphouses = [];
    this.safeHouse = null;
    this.oppBlock = null; // Special high-risk traphouse
    this.oppBlockGuards = []; // Guards protecting the Opp Block
    this.particles = [];
    this.projectiles = [];
    this.chalkOutlines = []; // Chalk outlines where opps died
    
    // World bounds - minimal area just for bookshelves
    // Shelves: 8 cols, last shelf at x = 320 + 7*160 = 1440, shelf width = 64
    // So rightmost edge = 1440 + 64 = 1504
    // Shelves: 4 rows, last shelf at y = 240 + 3*200 = 840, shelf height = 96
    // So bottommost edge = 840 + 96 = 936
    // Add small buffer: 100 pixels on each side
    this.worldWidth = 1344; // Match background tile width
    this.worldHeight = 1152; // 1.5x background tile height (768 * 1.5)
    
    // Opp spawning
    this.oppSpawnTimer = 0;
    this.oppSpawnInterval = 8; // Seconds between spawns
    this.maxOpps = 10; // Starting max, will increase with waves
    this.lastMaxOpps = 5; // Track previous max to detect increases
    
    // Wave notification
    this.maxOppsIncreaseNotification = {
      active: false,
      increase: 0,
      timer: 0,
      duration: 3 // Show for 3 seconds
    }
    
    // Performance optimizations
    this.floorPattern = null; // Cache floor pattern
    this.patternCanvas = null; // Canvas for pattern
    
    // Background music
    this.bgMusic = null;
    this.beefMusic = null;
    this.musicLoaded = false;
    this.isBeefMusicPlaying = false;
    
    // Sound effects
    this.pickupSounds = []; // Array of audio elements for overlapping sounds
    this.shelfSound = null;
    
    // Spawn points on ROADS ONLY (gaps between buildings)
    // Buildings: X at 20,290,560,830,1100 (width 230), Y at 20,300,580,860 (height 200)
    // Horizontal roads at Y: 230-290 (row gap 1), 510-570 (row gap 2), 790-850 (row gap 3)
    // Vertical roads at X: 255-285, 525-555, 795-825, 1065-1095 (column gaps)
    this.spawnPoints = [
      // Horizontal road spawns (between building rows)
      { x: 130, y: 250 },  // Road between row 0-1
      { x: 400, y: 250 },
      { x: 670, y: 250 },
      { x: 940, y: 250 },
      { x: 130, y: 540 },  // Road between row 1-2
      { x: 400, y: 540 },
      { x: 670, y: 540 },
      { x: 940, y: 540 },
      { x: 130, y: 820 },  // Road between row 2-3
      { x: 400, y: 820 },
      { x: 670, y: 820 },
      { x: 940, y: 820 },
      // Vertical road spawns (between building columns)
      { x: 265, y: 130 },  // Column gap 1
      { x: 265, y: 410 },
      { x: 265, y: 690 },
      { x: 535, y: 130 },  // Column gap 2
      { x: 535, y: 410 },
      { x: 535, y: 690 },
      { x: 805, y: 130 },  // Column gap 3
      { x: 805, y: 410 },
      { x: 805, y: 690 },
      // Map edge spawns (outside building grid)
      { x: 1200, y: 250 },
      { x: 1200, y: 540 },
      { x: 1200, y: 820 },
      { x: 130, y: 1000 },
      { x: 400, y: 1000 },
      { x: 670, y: 1000 }
    ];
  }
  
  enter() {
    console.log(`[RESTART DEBUG] PlayingState.enter() called for instance: ${this.instanceId}`);
    console.log(`[RESTART DEBUG] opps.length before clearing: ${this.opps.length}`);
    
    // Clear any existing entities first to prevent accumulation
    this.opps = [];
    this.loot = [];
    this.particles = [];
    this.traphouses = [];
    this.safeHouse = null;
    this.oppBlock = null;
    this.oppBlockGuards = [];
    this.projectiles = [];
    this.chalkOutlines = [];
    
    // Reset game data
    this.game.gameData = {
      beefLevel: 0,
      maxBeef: 100,
      playerLevel: 1,
      xp: 0,
      xpToNext: 100,
      elapsedTime: 0,
      targetTime: 30 * 60,
      isPaused: false,
      // Stats tracking
      lootCollected: 0,
      lootStashed: 0,
      bodiesDropped: 0
    };

    // Grace period - no auto-pickup for first 1 second
    this.startupGracePeriod = 1.0;

    // Pickup cooldown - time between picking up loot
    this.pickupCooldown = 0;
    this.pickupCooldownTime = 0.8; // 0.8 seconds between pickups

    // Beef threshold flag - track if we've shown upgrade screen for current beef level
    this.beefUpgradeShown = false;

    // Allies (Slew Dem)
    this.allies = [];

    // Opp Block guard respawn queue (they multiply after death)
    this.oppBlockRespawnQueue = [];

    // Beef-triggered opp spawn queue (gradual spawning from Opp Block)
    this.beefOppSpawnQueue = {
      count: 0,
      timer: 0,
      interval: 0.8 // Spawn one opp every 0.8 seconds
    };

    // Top Boy (special boss opp)
    this.topBoy = null;
    this.topBoySpawned = false;
    this.topBoyDefeated = false;

    // Level progression system
    this.currentLevel = 1;
    this.levelExpansionDirection = 'right'; // Expand from Opp Block direction
    this.levelTransitioning = false;

    // Alert notification system
    this.alertNotification = {
      active: false,
      text: '',
      timer: 0,
      duration: 3
    };

    // Mobile controls overlay
    this.mobileControls = new MobileControls(this.game.inputManager, this.game.canvas);

    // Ensure opp spawning is reset to initial values
    this.maxOpps = 10; // Start with capacity for 10 opps
    this.lastMaxOpps = 5;
    this.oppSpawnTimer = 0;
    this.oppSpawnInterval = 8;

    // Reset wave notification
    this.maxOppsIncreaseNotification = {
      active: false,
      increase: 0,
      timer: 0,
      duration: 3
    };

    console.log(`[OPP SPAWNING] World dimensions: ${this.worldWidth}x${this.worldHeight}`);
    console.log(`[OPP SPAWNING] Spawn points:`, this.spawnPoints);
    
    // Initialize game world
    this.initializeLevel();
    
    // Start background music
    if (!this.bgMusic) {
      this.bgMusic = new Audio('/game_music.mp3');
      this.bgMusic.loop = true;
      this.bgMusic.volume = 0.4; // Slightly lower volume for gameplay

      this.bgMusic.addEventListener('loadeddata', () => {
        this.musicLoaded = true;
        this.bgMusic.play().catch(e => console.log('Game music play failed:', e));
      });

      this.bgMusic.load();
    } else {
      // Resume if returning to game
      this.bgMusic.play().catch(e => console.log('Game music play failed:', e));
    }

    // Initialize beef music
    if (!this.beefMusic) {
      this.beefMusic = new Audio('/beef music.mp3');
      this.beefMusic.loop = true;
      this.beefMusic.volume = 0.5;
      this.beefMusic.load();
    }
    this.isBeefMusicPlaying = false;

    // Initialize sound effects
    if (this.pickupSounds.length === 0) {
      // Create 5 audio instances for overlapping pickup sounds
      for (let i = 0; i < 5; i++) {
        const audio = new Audio('/pickup_book.mp3');
        audio.volume = 0.7; // Increased from 0.5 for better audibility
        this.pickupSounds.push(audio);
      }
    }
    
    if (!this.shelfSound) {
      this.shelfSound = new Audio('/book_on_shelf.mp3');
      this.shelfSound.volume = 0.6;
    }
  }
  
  exit() {
    // Clean up
    this.opps = [];
    this.loot = [];
    this.particles = [];
    this.traphouses = [];
    this.safeHouse = null;
    this.projectiles = [];

    // Reset opp spawning variables to initial state
    this.maxOpps = 10;
    this.lastMaxOpps = 5;
    this.oppSpawnTimer = 0;
    this.oppSpawnInterval = 8;

    // Reset wave notification
    this.maxOppsIncreaseNotification = {
      active: false,
      increase: 0,
      timer: 0,
      duration: 3
    };
    
    // Pause music when leaving game
    if (this.bgMusic) {
      this.bgMusic.pause();
    }
    if (this.beefMusic) {
      this.beefMusic.pause();
    }
    this.isBeefMusicPlaying = false;

    // Stop player sounds
    if (this.player) {
      this.player.cleanup();
    }
    
    // Clear sound arrays to ensure re-initialization
    this.pickupSounds = [];
    this.shelfSound = null;
  }
  
  initializeLevel() {
    // Generate street layout first
    this.generateStreetLayout();
    
    // Create player on a road between buildings
    this.player = new Player(
      this.game,
      600,  // Between building columns
      500   // Between building rows
    );
    
    // Set camera bounds to world
    this.game.camera.setBounds(0, 0, this.worldWidth, this.worldHeight);
    
    // Center camera on player
    this.game.camera.follow(this.player);
    
    // Spawn initial opps - start with 4 opps
    const initialOpps = 4;
    for (let i = 0; i < initialOpps; i++) {
      const spawnPoint = this.spawnPoints[Math.floor(Math.random() * this.spawnPoints.length)];
      // Mix of easy and normal opps at start
      const aggressionLevel = i < 2 ? 1 : 2;
      const opp = new Opp(this.game, spawnPoint.x, spawnPoint.y, aggressionLevel);
      this.opps.push(opp);
    }

    // Initialize opp spawning for additional opps
    this.oppSpawnTimer = 5; // First additional opp spawns after 5 seconds
  }
  
  update(deltaTime) {
    const input = this.game.inputManager;
    const gameData = this.game.gameData;
    
    // Recovery mechanism: Press 'r' to refocus canvas if input seems stuck
    if (input.isKeyPressed('r') || input.isKeyPressed('R')) {
      console.log('Manual focus recovery triggered');
      input.ensureFocus();
    }
    
    // Handle pause
    if (input.isKeyPressed('p') || input.isKeyPressed('Escape')) {
      // Pause music when pausing game
      if (this.bgMusic) {
        this.bgMusic.pause();
      }
      this.game.stateManager.pushState('paused');
      return;
    }
    
    // Don't update if paused
    if (gameData.isPaused) return;
    
    // Update game timer
    gameData.elapsedTime += deltaTime;

    // Update startup grace period
    if (this.startupGracePeriod > 0) {
      this.startupGracePeriod -= deltaTime;
    }

    // Update pickup cooldown
    if (this.pickupCooldown > 0) {
      this.pickupCooldown -= deltaTime;
    }

    // Check win condition
    if (gameData.elapsedTime >= gameData.targetTime) {
      this.game.stateManager.changeState('gameover', { won: true });
      return;
    }
    
    // Update beef (based on loot on floor and combat)
    this.updateBeef(deltaTime);

    // Check if beef is high - show upgrade options
    this.checkBeefThreshold();

    // Update gradual beef opp spawning
    this.updateBeefOppSpawning(deltaTime);

    // Update alert notification
    this.updateAlertNotification(deltaTime);

    // Check if Top Boy was defeated - trigger level progression
    this.checkTopBoyDefeated();

    // Beef no longer causes game over - just caps at 100%
    if (gameData.beefLevel > gameData.maxBeef) {
      gameData.beefLevel = gameData.maxBeef;
    }
    
    // Update player
    if (this.player) {
      this.player.update(deltaTime);
    }
    
    // Update traphouses
    for (const traphouse of this.traphouses) {
      traphouse.update(deltaTime);
    }

    // Update safe house
    if (this.safeHouse) {
      this.safeHouse.update(deltaTime);
    }

    // Update loot
    for (const item of this.loot) {
      item.update(deltaTime);
    }
    
    // Update opps
    const oppsBeforeUpdate = this.opps.length;
    for (const opp of this.opps) {
      opp.update(deltaTime);
    }

    // Check if any opps disappeared during update
    if (this.opps.length !== oppsBeforeUpdate) {
      console.log(`[OPP SPAWNING] WARNING: Opps count changed during update! Before: ${oppsBeforeUpdate}, After: ${this.opps.length}`);
    }

    // Update opp spawning
    this.updateOppSpawning(deltaTime);

    // Check loot pickup from traphouses
    this.checkLootPickup();

    // Check loot snatching from opps
    this.checkLootSnatching();

    // Check loot stashing at safe house
    this.checkLootStashing();


    // Update particles
    this.updateParticles(deltaTime);

    // Update chalk outlines (fade over time)
    this.updateChalkOutlines(deltaTime);

    // Update projectiles and check collisions
    this.updateProjectiles(deltaTime);

    // Update allies (Slew Dem)
    this.updateAllies(deltaTime);

    // Validate loot states (debug)
    if (Math.random() < 0.01) { // Check 1% of frames to avoid spam
      this.validateLootStates();
    }
    
  }
  
  updateBeef(deltaTime) {
    const gameData = this.game.gameData;

    // Count loot causing heat (on floor or held by player - unstashed loot draws attention)
    const lootOnFloor = this.loot.filter(item => !item.isHeld && !item.isStashed).length;
    const lootHeldByPlayer = this.player?.carriedLoot?.length || 0;
    const totalHeatLoot = lootOnFloor + lootHeldByPlayer;

    // Sliding heat rate based on game progression
    let heatRate = 0;
    if (totalHeatLoot > 0) {
      // Calculate game time in minutes
      const minutes = gameData.elapsedTime / 60;

      // Determine heat rate per loot based on time
      let heatPerLoot;
      if (minutes < 3) {
        heatPerLoot = 0.05; // 0-3 minutes: 0.05% per loot per second
      } else if (minutes < 5) {
        heatPerLoot = 0.03; // 3-5 minutes: 0.03% per loot per second
      } else {
        heatPerLoot = 0.01; // 5+ minutes: 0.01% per loot per second
      }

      heatRate = totalHeatLoot * heatPerLoot;

      // Apply beef dampening from upgrades
      const beefDampening = this.player?.stats?.beefDampening || 0;
      const beefMultiplier = 1 - (beefDampening / 100);
      gameData.beefLevel += heatRate * deltaTime * beefMultiplier;
    }

    // Passive heat decay when low (helps recovery)
    if (gameData.beefLevel > 0) {
      if (totalHeatLoot === 0) {
        // Slow decay when no loot is out
        gameData.beefLevel -= 0.1 * deltaTime;
      }
    }

    // Clamp heat level
    gameData.beefLevel = Math.max(0, Math.min(gameData.maxBeef, gameData.beefLevel));
  }
  
  render(renderer, interpolation) {
    const ctx = renderer.ctx;
    const { width, height } = this.game;
    const gameData = this.game.gameData;
    
    // Clear with library floor color
    ctx.fillStyle = '#d4a574';
    ctx.fillRect(0, 0, width, height);
    
    // Render floor tiles
    this.renderFloor(ctx);
    
    // Get viewport bounds for culling
    const viewportX = this.game.camera.getViewportX();
    const viewportY = this.game.camera.getViewportY();
    const viewportWidth = this.game.camera.viewportWidth / this.game.camera.zoom;
    const viewportHeight = this.game.camera.viewportHeight / this.game.camera.zoom;
    const padding = 100; // Render entities slightly outside viewport
    
    // Render chalk outlines (on the ground, before entities)
    renderer.addToLayer('floor', {
      render: (ctx) => this.renderChalkOutlines(ctx)
    });

    // Render traphouses (only visible ones)
    for (const traphouse of this.traphouses) {
      if (this.isInViewport(traphouse, viewportX - padding, viewportY - padding,
                           viewportWidth + padding * 2, viewportHeight + padding * 2)) {
        renderer.addToLayer('entities', traphouse);
      }
    }

    // Render safe house
    if (this.safeHouse && this.isInViewport(this.safeHouse, viewportX - padding, viewportY - padding,
                         viewportWidth + padding * 2, viewportHeight + padding * 2)) {
      renderer.addToLayer('entities', this.safeHouse);
    }

    // Render loot (only visible ones that are not held or stashed)
    for (const item of this.loot) {
      if (!item.isHeld && !item.isStashed &&
          this.isInViewport(item, viewportX - padding, viewportY - padding,
                           viewportWidth + padding * 2, viewportHeight + padding * 2)) {
        renderer.addToLayer('entities', item);
      }
    }
    
    // Render opps (only visible ones)
    for (const opp of this.opps) {
      if (this.isInViewport(opp, viewportX - padding, viewportY - padding,
                           viewportWidth + padding * 2, viewportHeight + padding * 2)) {
        renderer.addToLayer('entities', opp);
      }
    }

    // Render allies (Slew Dem)
    for (const ally of this.allies) {
      if (!ally.isDead && this.isInViewport(ally, viewportX - padding, viewportY - padding,
                           viewportWidth + padding * 2, viewportHeight + padding * 2)) {
        renderer.addToLayer('entities', ally);
      }
    }

    // Render projectiles
    this.renderProjectiles(renderer);

    // TODO: Render particles

    // Render player
    if (this.player) {
      renderer.addToLayer('entities', this.player);
    }
    
    // Render all layers
    renderer.render(interpolation);

    // Draw arrow pointing to safe house when player has loot
    if (this.player && this.safeHouse && this.player.carriedLoot.length > 0) {
      const playerCenterX = this.player.getCenterX();
      const playerCenterY = this.player.getCenterY();
      const stashCenterX = this.safeHouse.getCenterX();
      const stashCenterY = this.safeHouse.getCenterY();

      // Calculate direction to stash
      const dx = stashCenterX - playerCenterX;
      const dy = stashCenterY - playerCenterY;
      const distance = Math.sqrt(dx * dx + dy * dy);

      // Only show arrow if stash is far enough away
      if (distance > 150) {
        const angle = Math.atan2(dy, dx);

        // Position arrow at edge of screen pointing toward stash
        const arrowDistance = 80;
        const arrowX = width / 2 + Math.cos(angle) * arrowDistance;
        const arrowY = height / 2 + Math.sin(angle) * arrowDistance;

        ctx.save();
        ctx.translate(arrowX, arrowY);
        ctx.rotate(angle);

        // Draw pulsing arrow
        const pulse = 0.7 + Math.sin(Date.now() * 0.005) * 0.3;
        ctx.globalAlpha = pulse;
        ctx.fillStyle = '#4ade80';
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2;

        // Arrow shape
        ctx.beginPath();
        ctx.moveTo(20, 0);
        ctx.lineTo(-10, -12);
        ctx.lineTo(-5, 0);
        ctx.lineTo(-10, 12);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.restore();

        // Draw "STASH →" text near arrow
        ctx.save();
        ctx.fillStyle = '#4ade80';
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 3;
        ctx.font = 'bold 16px Arial';
        ctx.textAlign = 'center';
        const textX = width / 2 + Math.cos(angle) * (arrowDistance + 40);
        const textY = height / 2 + Math.sin(angle) * (arrowDistance + 40);
        ctx.strokeText('STASH', textX, textY);
        ctx.fillText('STASH', textX, textY);
        ctx.restore();
      }
    }

    // Render UI
    this.renderUI(ctx);

    // Heat vignette effect
    if (gameData.beefLevel > 80) {
      const intensity = (gameData.beefLevel - 80) / 20;
      this.renderHeatVignette(ctx, intensity);
    }

    // Render mobile controls overlay (only on touch devices)
    if (this.mobileControls) {
      this.mobileControls.render(ctx, width, height);
    }
  }
  
  renderUI(ctx) {
    const gameData = this.game.gameData;
    const { width, height } = this.game;
    
    ctx.save();
    
    // Top Center - Heat meter
    const meterWidth = 300;
    const meterHeight = 30;
    const meterX = width / 2 - meterWidth / 2;
    const meterY = 20;

    // Heat meter background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.fillRect(meterX - 2, meterY - 2, meterWidth + 4, meterHeight + 4);

    // Heat meter fill
    const heatPercent = gameData.beefLevel / gameData.maxBeef;
    const heatColor = heatPercent > 0.8 ? '#ff0000' :
                      heatPercent > 0.6 ? '#ff8800' :
                      heatPercent > 0.4 ? '#ffff00' : '#00ff00';

    ctx.fillStyle = heatColor;
    ctx.fillRect(meterX, meterY, meterWidth * heatPercent, meterHeight);

    // Heat meter text
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 20px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`BEEF: ${Math.floor(gameData.beefLevel)}%`, width / 2, meterY + meterHeight / 2);
    
    // Wave increase notification below chaos meter
    if (this.maxOppsIncreaseNotification.active) {
      const notificationY = meterY + meterHeight + 15;
      const fadeProgress = this.maxOppsIncreaseNotification.timer / this.maxOppsIncreaseNotification.duration;
      let alpha;

      // Fade in for first 0.5 seconds, stay solid, then fade out in last 0.5 seconds
      if (fadeProgress < 0.5 / 3) {
        alpha = fadeProgress * 6; // Fade in
      } else if (fadeProgress > 2.5 / 3) {
        alpha = (1 - fadeProgress) * 6; // Fade out
      } else {
        alpha = 1; // Solid
      }

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.font = 'bold 18px Arial';
      ctx.fillStyle = '#ffff00'; // Yellow color for visibility
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 3;

      const notificationText = `Maximum opps allowed grew by ${this.maxOppsIncreaseNotification.increase}`;

      // Draw text outline for better visibility
      ctx.strokeText(notificationText, width / 2, notificationY);
      ctx.fillText(notificationText, width / 2, notificationY);
      ctx.restore();
    }

    // Alert notification (Top Boy warning, etc.)
    if (this.alertNotification && this.alertNotification.active) {
      const alertY = height / 3;
      const fadeProgress = this.alertNotification.timer / this.alertNotification.duration;
      let alpha;

      // Fade in for first 0.3 seconds, stay solid, then fade out in last 0.5 seconds
      if (fadeProgress < 0.1) {
        alpha = fadeProgress * 10; // Fade in
      } else if (fadeProgress > 0.8) {
        alpha = (1 - fadeProgress) * 5; // Fade out
      } else {
        alpha = 1; // Solid
      }

      ctx.save();
      ctx.globalAlpha = alpha;

      // Red warning background
      ctx.fillStyle = 'rgba(200, 0, 0, 0.9)';
      const alertWidth = 500;
      const alertHeight = 60;
      ctx.fillRect(width / 2 - alertWidth / 2, alertY - alertHeight / 2, alertWidth, alertHeight);

      // White border
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 3;
      ctx.strokeRect(width / 2 - alertWidth / 2, alertY - alertHeight / 2, alertWidth, alertHeight);

      // Alert text
      ctx.font = 'bold 28px Arial';
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(this.alertNotification.text, width / 2, alertY);

      ctx.restore();
    }

    // Top Left - Level indicator
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(15, 15, 100, 40);
    ctx.font = 'bold 20px Arial';
    ctx.fillStyle = '#ffcc00';
    ctx.textAlign = 'center';
    ctx.fillText(`LEVEL ${this.currentLevel}`, 65, 42);

    // Top Right - Timer and Opp Counter
    const timeRemaining = Math.max(0, gameData.targetTime - gameData.elapsedTime);
    const minutes = Math.floor(timeRemaining / 60);
    const seconds = Math.floor(timeRemaining % 60);

    // Timer background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(width - 120, 15, 110, 40);

    ctx.font = '24px Arial';
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.fillText(`${minutes}:${seconds.toString().padStart(2, '0')}`, width - 65, 40);
    
    // Opp counter below timer
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(width - 120, 60, 110, 35);

    ctx.font = '18px Arial';
    ctx.fillStyle = '#fff';
    ctx.fillText(`Opps: ${this.opps.length}/${this.maxOpps}`, width - 65, 82);
    
    // Left Side Panel - Player Stats
    const panelX = 10;
    const panelY = 10;
    const panelWidth = 250;
    const panelHeight = 175; // Height to fit health, stamina, and loot
    
    // Panel background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(panelX, panelY, panelWidth, panelHeight);
    
    // Level and XP
    ctx.textAlign = 'left';
    ctx.font = 'bold 20px Arial';
    ctx.fillStyle = '#fff';
    ctx.fillText(`Level ${gameData.playerLevel}`, panelX + 10, panelY + 30);
    
    // XP bar
    const xpBarX = panelX + 10;
    const xpBarY = panelY + 40;
    const xpBarWidth = panelWidth - 20;
    const xpBarHeight = 15;
    
    ctx.fillStyle = '#333';
    ctx.fillRect(xpBarX, xpBarY, xpBarWidth, xpBarHeight);
    
    const xpPercent = gameData.xp / gameData.xpToNext;
    ctx.fillStyle = '#4169E1';
    ctx.fillRect(xpBarX, xpBarY, xpBarWidth * xpPercent, xpBarHeight);
    
    // XP text
    ctx.font = '12px Arial';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fff';
    ctx.fillText(`${gameData.xp} / ${gameData.xpToNext} XP`, xpBarX + xpBarWidth / 2, xpBarY + xpBarHeight / 2 + 1);
    
    if (this.player) {
      // Health bar
      ctx.textAlign = 'left';
      ctx.font = '16px Arial';
      ctx.fillStyle = '#fff';
      ctx.fillText('Health', panelX + 10, panelY + 80);

      const healthBarX = panelX + 75;
      const healthBarY = panelY + 65;
      const healthBarWidth = panelWidth - 85;
      const healthBarHeight = 20;

      ctx.fillStyle = '#333';
      ctx.fillRect(healthBarX, healthBarY, healthBarWidth, healthBarHeight);

      const healthPercent = this.player.health / this.player.maxHealth;
      ctx.fillStyle = healthPercent > 0.5 ? '#00ff00' : healthPercent > 0.25 ? '#ffff00' : '#ff0000';
      ctx.fillRect(healthBarX, healthBarY, healthBarWidth * healthPercent, healthBarHeight);

      // Health text
      ctx.font = '12px Arial';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#fff';
      ctx.fillText(`${Math.floor(this.player.health)} / ${this.player.maxHealth}`, healthBarX + healthBarWidth / 2, healthBarY + healthBarHeight / 2 + 4);

      // Stamina bar
      ctx.textAlign = 'left';
      ctx.font = '16px Arial';
      ctx.fillStyle = '#fff';
      ctx.fillText('Stamina', panelX + 10, panelY + 110);

      const staminaBarX = panelX + 75;
      const staminaBarY = panelY + 95;
      const staminaBarWidth = panelWidth - 85;
      const staminaBarHeight = 20;

      ctx.fillStyle = '#333';
      ctx.fillRect(staminaBarX, staminaBarY, staminaBarWidth, staminaBarHeight);

      const staminaPercent = this.player.stats.stamina / this.player.stats.maxStamina;
      ctx.fillStyle = '#00aaff';
      ctx.fillRect(staminaBarX, staminaBarY, staminaBarWidth * staminaPercent, staminaBarHeight);

      // Stamina text
      ctx.font = '12px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(`${Math.floor(this.player.stats.stamina)} / ${this.player.stats.maxStamina}`, staminaBarX + staminaBarWidth / 2, staminaBarY + staminaBarHeight / 2 + 4);

      // Loot carried indicator
      ctx.font = '16px Arial';
      ctx.textAlign = 'left';
      ctx.fillStyle = '#fff';
      ctx.fillText(`Loot: ${this.player.carriedLoot.length} / ${this.player.stats.carrySlots}`, panelX + 10, panelY + 135);
    }
    
    ctx.restore();
  }
  
  renderHeatVignette(ctx, intensity) {
    const { width, height } = this.game;

    const gradient = ctx.createRadialGradient(
      width / 2, height / 2, Math.min(width, height) * 0.4,
      width / 2, height / 2, Math.max(width, height) * 0.7
    );

    gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
    gradient.addColorStop(1, `rgba(139, 0, 0, ${intensity * 0.5})`);

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
  }
  
  renderFloor(ctx) {
    const woodFloorImage = this.game.assetLoader.getImage('woodFloor');
    
    if (!woodFloorImage || !woodFloorImage.complete) {
      // Fallback to solid color if image hasn't loaded
      const viewportX = this.game.camera.getViewportX();
      const viewportY = this.game.camera.getViewportY();
      const viewportWidth = this.game.camera.viewportWidth / this.game.camera.zoom;
      const viewportHeight = this.game.camera.viewportHeight / this.game.camera.zoom;
      
      this.game.renderer.addToLayer('background', (ctx) => {
        ctx.fillStyle = '#d4a574';
        ctx.fillRect(viewportX, viewportY, viewportWidth, viewportHeight);
      });
      return;
    }
    
    // Create pattern once and cache it
    if (!this.floorPattern) {
      // Create a scaled pattern canvas
      const scale = 0.5;
      this.patternCanvas = document.createElement('canvas');
      this.patternCanvas.width = woodFloorImage.width * scale;
      this.patternCanvas.height = woodFloorImage.height * scale;
      const patternCtx = this.patternCanvas.getContext('2d');
      patternCtx.drawImage(woodFloorImage, 0, 0, this.patternCanvas.width, this.patternCanvas.height);
      this.floorPattern = this.game.renderer.ctx.createPattern(this.patternCanvas, 'repeat');
    }
    
    // Add wood floor image rendering to background layer
    this.game.renderer.addToLayer('background', (ctx) => {
      if (this.floorPattern) {
        ctx.save();
        ctx.fillStyle = this.floorPattern;
        // Fill the entire world area, not just viewport
        ctx.fillRect(0, 0, this.worldWidth, this.worldHeight);
        ctx.restore();
      }
    });
  }
  
  updateOppSpawning(deltaTime) {
    const gameData = this.game.gameData;
    const beefLevel = gameData.beefLevel;
    const minutes = gameData.elapsedTime / 60;

    // Base max opps + heat bonus + time bonus
    // Base: 10 opps
    // Heat: +1 opp per 10% heat (up to +10 at 100% heat)
    // Time: +1 opp per 2 minutes (up to +5)
    // Max: 25 opps
    const baseOpps = 10;
    const heatBonus = Math.floor(beefLevel / 10);
    const timeBonus = Math.min(5, Math.floor(minutes / 2));
    const newMaxOpps = Math.min(25, baseOpps + heatBonus + timeBonus);

    // Check if max opps increased
    if (newMaxOpps > this.maxOpps) {
      const increase = newMaxOpps - this.maxOpps;
      this.maxOpps = newMaxOpps;

      // Trigger notification
      this.maxOppsIncreaseNotification = {
        active: true,
        increase: increase,
        timer: 0,
        duration: 3
      };
    }

    // Update notification timer
    if (this.maxOppsIncreaseNotification.active) {
      this.maxOppsIncreaseNotification.timer += deltaTime;
      if (this.maxOppsIncreaseNotification.timer >= this.maxOppsIncreaseNotification.duration) {
        this.maxOppsIncreaseNotification.active = false;
      }
    }

    // Don't spawn more opps if we're at the limit
    if (this.opps.length >= this.maxOpps) {
      return;
    }

    // Spawn interval decreases with heat (faster spawns when hot!)
    // Base: 8 seconds, min: 2 seconds at high heat
    const baseInterval = 8;
    const heatSpeedBonus = (beefLevel / 100) * 6; // Up to 6 seconds faster
    const spawnInterval = Math.max(2, baseInterval - heatSpeedBonus);

    // Update spawn timer
    this.oppSpawnTimer -= deltaTime;

    if (this.oppSpawnTimer <= 0) {
      // Determine aggression level based on heat and time
      let aggressionLevel = 1; // Easy by default

      if (beefLevel >= 70 || minutes >= 15) {
        aggressionLevel = 3; // Aggressive
      } else if (beefLevel >= 40 || minutes >= 8) {
        aggressionLevel = 2; // Normal
      }

      // Spawn a new opp - away from safe house
      let spawnPoint;
      let attempts = 0;
      const minDistFromStash = 300; // Must be at least 300px from safe house

      do {
        spawnPoint = this.spawnPoints[Math.floor(Math.random() * this.spawnPoints.length)];
        attempts++;
      } while (
        attempts < 20 &&
        this.safeHouse &&
        Math.sqrt(
          Math.pow(spawnPoint.x - this.safeHouse.getCenterX(), 2) +
          Math.pow(spawnPoint.y - this.safeHouse.getCenterY(), 2)
        ) < minDistFromStash
      );

      const opp = new Opp(this.game, spawnPoint.x, spawnPoint.y, aggressionLevel);

      // When beef is high (60%+), new opps immediately target safe house
      if (beefLevel >= 60) {
        opp.targetingSafeHouse = true;
      }

      this.opps.push(opp);

      // Reset timer for next spawn
      this.oppSpawnTimer = spawnInterval;
      this.oppSpawnInterval = spawnInterval;
    }
  }
  
  generateStreetLayout() {
    // Define traphouse colors (for gang territory)
    const colors = ['red', 'blue', 'green', 'yellow', 'purple', 'orange'];

    // Position traphouses around the map
    // Background is 1344x768 crossroads pattern, world is 1600x1040

    // Create grid of traphouses
    // Traphouses are 230x200, spaced to form a grid covering the play area
    const traphousePositions = [];

    // Generate grid positions
    const startX = 20;
    const startY = 20;
    const spacingX = 270; // Horizontal spacing between buildings
    const spacingY = 280; // Vertical spacing between buildings
    const cols = 5;       // Buildings per row
    const rows = 4;       // Number of rows

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        traphousePositions.push({
          x: startX + col * spacingX,
          y: startY + row * spacingY
        });
      }
    }

    // Shuffle colors for variety (20 traphouses = 5 cols x 4 rows)
    const shuffledColors = [...colors, ...colors, ...colors, ...colors];
    for (let i = shuffledColors.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffledColors[i], shuffledColors[j]] = [shuffledColors[j], shuffledColors[i]];
    }

    // Create traphouses at each position, but reserve first position for safe house
    // and last position for the Opp Block
    const lastIndex = traphousePositions.length - 1;

    traphousePositions.forEach((pos, index) => {
      // Skip first position - that's for the safe house
      if (index === 0) return;

      // Skip last position - that's for the Opp Block (handled separately)
      if (index === lastIndex) return;

      const color = shuffledColors[index % shuffledColors.length];

      // Create traphouse with reduced capacity
      const traphouse = new Traphouse(this.game, pos.x, pos.y, color, 2);
      this.traphouses.push(traphouse);

      // Only 30% of traphouses have loot
      if (Math.random() < 0.3) {
        // Add 1 loot item
        const item = new Loot(this.game, 0, 0, color);
        traphouse.addLoot(item);
        this.loot.push(item);
      }
    });

    // Create player's safe house at first grid position (top-left)
    const safeHousePos = traphousePositions[0];
    this.safeHouse = new SafeHouse(this.game, safeHousePos.x, safeHousePos.y);

    // Create the OPP BLOCK at the last position (bottom-right corner)
    const oppBlockPos = traphousePositions[lastIndex];
    this.oppBlock = new Traphouse(this.game, oppBlockPos.x, oppBlockPos.y, 'red', 10);
    this.oppBlock.isOppBlock = true; // Mark as special
    this.traphouses.push(this.oppBlock);

    // Fill Opp Block with lots of loot (6 items)
    const oppBlockColors = ['red', 'red', 'orange', 'orange', 'yellow', 'yellow'];
    for (const color of oppBlockColors) {
      const item = new Loot(this.game, 0, 0, color);
      this.oppBlock.addLoot(item);
      this.loot.push(item);
    }

    // Spawn 10 guard opps around the Opp Block
    this.spawnOppBlockGuards();

    // Scatter some loose loot on the roads
    this.scatterLooseLoot(8); // Spawn 8 loose loot items on roads

  }

  scatterLooseLoot(count) {
    const colors = ['red', 'blue', 'green', 'yellow', 'purple', 'orange'];

    // Road positions (gaps between buildings)
    // Buildings are at x: 20, 290, 560, 830, 1100 (width 230, spacing 270)
    // Buildings are at y: 20, 300, 580, 860 (height 200, spacing 280)

    for (let i = 0; i < count; i++) {
      let x, y;
      let validPosition = false;
      let attempts = 0;

      // Try to find a valid road position
      while (!validPosition && attempts < 50) {
        attempts++;

        // Randomly choose horizontal or vertical road
        if (Math.random() < 0.5) {
          // Horizontal road (between building rows)
          const roadY = [230, 510, 790, 1070][Math.floor(Math.random() * 4)];
          x = 50 + Math.random() * (this.worldWidth - 100);
          y = roadY + (Math.random() - 0.5) * 40; // Slight variation
        } else {
          // Vertical road (between building columns)
          const roadX = [260, 530, 800, 1070][Math.floor(Math.random() * 4)];
          x = roadX + (Math.random() - 0.5) * 30; // Slight variation
          y = 50 + Math.random() * (this.worldHeight - 100);
        }

        // Check if position is not inside any building
        validPosition = true;
        for (const traphouse of this.traphouses) {
          if (x > traphouse.x - 20 && x < traphouse.x + traphouse.width + 20 &&
              y > traphouse.y - 20 && y < traphouse.y + traphouse.height + 20) {
            validPosition = false;
            break;
          }
        }
        // Also check safe house
        if (this.safeHouse) {
          if (x > this.safeHouse.x - 20 && x < this.safeHouse.x + this.safeHouse.width + 20 &&
              y > this.safeHouse.y - 20 && y < this.safeHouse.y + this.safeHouse.height + 20) {
            validPosition = false;
          }
        }
      }

      if (validPosition) {
        const color = colors[Math.floor(Math.random() * colors.length)];
        const item = new Loot(this.game, x, y, color);
        // Don't mark as stashed - it's loose on the ground
        this.loot.push(item);
      }
    }
  }

  spawnOppBlockGuards() {
    if (!this.oppBlock) return;

    // Spawn 10 aggressive guards around the Opp Block
    const guardPositions = [
      // Top edge
      { x: this.oppBlock.x + 30, y: this.oppBlock.y - 50 },
      { x: this.oppBlock.x + 100, y: this.oppBlock.y - 50 },
      { x: this.oppBlock.x + 170, y: this.oppBlock.y - 50 },
      // Bottom edge
      { x: this.oppBlock.x + 30, y: this.oppBlock.y + this.oppBlock.height + 10 },
      { x: this.oppBlock.x + 100, y: this.oppBlock.y + this.oppBlock.height + 10 },
      { x: this.oppBlock.x + 170, y: this.oppBlock.y + this.oppBlock.height + 10 },
      // Left edge
      { x: this.oppBlock.x - 50, y: this.oppBlock.y + 50 },
      { x: this.oppBlock.x - 50, y: this.oppBlock.y + 120 },
      // Right edge
      { x: this.oppBlock.x + this.oppBlock.width + 10, y: this.oppBlock.y + 50 },
      { x: this.oppBlock.x + this.oppBlock.width + 10, y: this.oppBlock.y + 120 }
    ];

    for (let i = 0; i < 10; i++) {
      const pos = guardPositions[i];
      // All guards are aggressive (level 3)
      const guard = new Opp(this.game, pos.x, pos.y, 3);
      guard.isOppBlockGuard = true;
      guard.guardPatrolCenter = { x: pos.x, y: pos.y };
      guard.oppBlock = this.oppBlock;
      this.opps.push(guard);
      this.oppBlockGuards.push(guard);
    }
  }

  // Alert all Opp Block guards when one is attacked
  alertOppBlockGuards(attackerPosition) {
    for (const guard of this.oppBlockGuards) {
      if (guard && !guard.isDead) {
        guard.isAlerted = true;
        guard.alertTarget = attackerPosition;
        guard.state = 'chasing';
      }
    }
  }

  // Spawn Slew Dem allies to help defend the player
  spawnSlewDem(count) {
    if (!this.player) return;

    // Max 3 allies at a time
    const maxAllies = 3;
    const currentAliveAllies = this.allies.filter(a => !a.isDead).length;
    const slotsAvailable = maxAllies - currentAliveAllies;

    if (slotsAvailable <= 0) {
      // Already at max allies
      return;
    }

    const actualCount = Math.min(count, slotsAvailable);
    const playerX = this.player.getCenterX();
    const playerY = this.player.getCenterY();

    for (let i = 0; i < actualCount; i++) {
      // Spawn allies in a circle around the player with randomized angles
      const baseAngle = (i / actualCount) * Math.PI * 2;
      const angle = baseAngle + (Math.random() - 0.5) * 0.8; // Add randomness to angle
      const distance = 80 + Math.random() * 60;
      const spawnX = playerX + Math.cos(angle) * distance - 24;
      const spawnY = playerY + Math.sin(angle) * distance - 32;

      // Create ally as a special Opp that fights for the player
      const ally = new Opp(this.game, spawnX, spawnY, 3); // Level 3 aggression
      ally.isAlly = true; // Mark as ally
      ally.isChaser = true; // Allies always chase opps
      ally.state = 'hunting'; // Start hunting opps
      ally.health = 100; // Same health as player
      ally.maxHealth = 100;

      // Individualize each ally with different stats
      ally.shootCooldown = 0.7 + Math.random() * 0.4; // 0.7-1.1 seconds between shots
      ally.shootTimer = Math.random() * ally.shootCooldown; // Stagger initial shots
      ally.shootRange = 250 + Math.random() * 100; // 250-350 range
      ally.chaseSpeed = 80 + Math.random() * 40; // 80-120 speed (different from each other)
      ally.speed = ally.chaseSpeed;

      // Give each ally a unique patrol offset so they don't stack
      ally.allyIndex = currentAliveAllies + i;
      ally.patrolAngleOffset = (ally.allyIndex / maxAllies) * Math.PI * 2 + Math.random() * 0.5;
      ally.preferredDistance = 60 + Math.random() * 80; // How far they like to stay from player
      ally.targetSwitchTimer = Math.random() * 3; // Randomize when they switch targets

      // Make allies the same size as the player (48x64)
      ally.width = 48;
      ally.height = 64;
      // Update collision box to match new size
      ally.collisionBox = {
        offsetX: 8,
        offsetY: 16,
        width: 32,
        height: 48
      };

      // Initialize animation with slight offset so they don't animate in sync
      ally.animationTimer = Math.random() * 0.2;
      ally.animationFrame = Math.floor(Math.random() * 2);
      ally.isMoving = false;

      this.allies.push(ally);
    }

    // Reduce beef when calling allies (they calm things down)
    this.game.gameData.beefLevel = Math.max(0, this.game.gameData.beefLevel - 15);
  }

  // Spawn allies at a specific position (when opps die)
  spawnAlliesAtPosition(x, y, count) {
    // Max 3 allies at a time
    const maxAllies = 3;
    const currentAliveAllies = this.allies.filter(a => !a.isDead).length;
    const slotsAvailable = maxAllies - currentAliveAllies;

    if (slotsAvailable <= 0) return;

    const actualCount = Math.min(count, slotsAvailable);

    for (let i = 0; i < actualCount; i++) {
      // Spawn allies in a small circle around the position
      const angle = (i / actualCount) * Math.PI * 2 + Math.random() * 0.8;
      const distance = 30 + Math.random() * 40;
      const spawnX = x + Math.cos(angle) * distance;
      const spawnY = y + Math.sin(angle) * distance;

      // Create ally as a special Opp that fights for the player
      const ally = new Opp(this.game, spawnX, spawnY, 3); // Level 3 aggression
      ally.isAlly = true; // Mark as ally
      ally.isChaser = true; // Allies always chase opps
      ally.state = 'hunting'; // Start hunting opps
      ally.health = 100; // Same health as player
      ally.maxHealth = 100;

      // Individualize each ally
      ally.shootCooldown = 0.7 + Math.random() * 0.4;
      ally.shootTimer = Math.random() * ally.shootCooldown;
      ally.shootRange = 250 + Math.random() * 100;
      ally.chaseSpeed = 80 + Math.random() * 40;
      ally.speed = ally.chaseSpeed;

      ally.allyIndex = currentAliveAllies + i;
      ally.patrolAngleOffset = (ally.allyIndex / maxAllies) * Math.PI * 2 + Math.random() * 0.5;
      ally.preferredDistance = 60 + Math.random() * 80;
      ally.targetSwitchTimer = Math.random() * 3;

      // Make allies the same size as the player (48x64)
      ally.width = 48;
      ally.height = 64;
      ally.collisionBox = {
        offsetX: 8,
        offsetY: 16,
        width: 32,
        height: 48
      };

      // Initialize animation with offset
      ally.animationTimer = Math.random() * 0.2;
      ally.animationFrame = Math.floor(Math.random() * 2);
      ally.isMoving = false;

      this.allies.push(ally);
    }
  }

  // Update allies - they actively hunt opps and protect player/stash
  updateAllies(deltaTime) {
    for (const ally of this.allies) {
      if (ally.isDead) continue;

      // Initialize ally shooting range if not set
      if (!ally.shootRange) {
        ally.shootRange = 300;
      }

      // Find the nearest opp to attack (allies are ALWAYS aggressive!)
      let nearestOpp = null;
      let nearestDist = Infinity;

      for (const opp of this.opps) {
        if (opp.isDead || opp.isAlly) continue;

        const distToOpp = ally.getDistanceTo(opp);
        if (distToOpp < nearestDist) {
          nearestDist = distToOpp;
          nearestOpp = opp;
        }
      }

      // Update shoot timer
      ally.shootTimer -= deltaTime;

      // If there's an opp within range, attack it!
      if (nearestOpp && nearestDist < 400) {
        // Chase and attack the nearest opp
        const dx = nearestOpp.getCenterX() - ally.getCenterX();
        const dy = nearestOpp.getCenterY() - ally.getCenterY();
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist > 0) {
          ally.targetDirection = Math.atan2(dy, dx);
          ally.direction = ally.lerpAngle(ally.direction, ally.targetDirection, 5.0 * deltaTime);
          ally.vx = Math.cos(ally.direction) * ally.chaseSpeed;
          ally.vy = Math.sin(ally.direction) * ally.chaseSpeed;
        }

        // Shoot at opp if within shooting range
        if (ally.shootTimer <= 0 && dist < ally.shootRange) {
          ally.shootTimer = ally.shootCooldown;
          ally.shootAt(nearestOpp);
        }

        ally.isMoving = true;
        ally.x += ally.vx * deltaTime;
        ally.y += ally.vy * deltaTime;

        if (Math.abs(ally.vx) > 0.1) {
          ally.facing = ally.vx > 0 ? 'right' : 'left';
        }
      } else {
        // No opps nearby - follow player
        if (this.player) {
          const dx = this.player.getCenterX() - ally.getCenterX();
          const dy = this.player.getCenterY() - ally.getCenterY();
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist > 80) {
            // Follow player
            ally.targetDirection = Math.atan2(dy, dx);
            ally.direction = ally.lerpAngle(ally.direction, ally.targetDirection, 3.0 * deltaTime);
            ally.vx = Math.cos(ally.direction) * ally.speed * 0.6;
            ally.vy = Math.sin(ally.direction) * ally.speed * 0.6;
            ally.isMoving = true;
            ally.x += ally.vx * deltaTime;
            ally.y += ally.vy * deltaTime;
            if (Math.abs(ally.vx) > 0.1) {
              ally.facing = ally.vx > 0 ? 'right' : 'left';
            }
          } else {
            // Stay near player, but still look for opps to shoot at distance
            ally.vx = 0;
            ally.vy = 0;
            ally.isMoving = false;

            // Even when idle, shoot at opps within range!
            if (nearestOpp && nearestDist < ally.shootRange && ally.shootTimer <= 0) {
              ally.shootTimer = ally.shootCooldown;
              ally.shootAt(nearestOpp);
              // Face the target
              const tdx = nearestOpp.getCenterX() - ally.getCenterX();
              ally.facing = tdx > 0 ? 'right' : 'left';
            }
          }
        }
      }

      // Update animation
      if (ally.isMoving) {
        ally.animationTimer += deltaTime;
        if (ally.animationTimer >= 0.2) {
          ally.animationFrame = (ally.animationFrame + 1) % 2;
          ally.animationTimer = 0;
        }
      } else {
        ally.animationFrame = 0;
        ally.animationTimer = 0;
      }

      // Keep allies within world bounds
      if (this.worldWidth && this.worldHeight) {
        ally.x = Math.max(0, Math.min(this.worldWidth - ally.width, ally.x));
        ally.y = Math.max(0, Math.min(this.worldHeight - ally.height, ally.y));
      }
    }

    // Remove dead allies
    this.allies = this.allies.filter(a => !a.isDead);
  }

  isPlayerNearBuilding(building, distance) {
    if (!this.player) return false;

    // Check if player is within distance of any edge of the building
    const playerLeft = this.player.x;
    const playerRight = this.player.x + this.player.width;
    const playerTop = this.player.y;
    const playerBottom = this.player.y + this.player.height;

    const buildingLeft = building.x;
    const buildingRight = building.x + building.width;
    const buildingTop = building.y;
    const buildingBottom = building.y + building.height;

    // Expand building bounds by distance
    const expandedLeft = buildingLeft - distance;
    const expandedRight = buildingRight + distance;
    const expandedTop = buildingTop - distance;
    const expandedBottom = buildingBottom + distance;

    // Check if player overlaps with expanded bounds
    return !(playerLeft >= expandedRight ||
             playerRight <= expandedLeft ||
             playerTop >= expandedBottom ||
             playerBottom <= expandedTop);
  }
  
  checkLootPickup() {
    if (!this.player) return;

    // Don't auto-pickup during startup grace period
    if (this.startupGracePeriod > 0) return;

    // Don't pickup during cooldown
    if (this.pickupCooldown > 0) return;

    const pickupRadiusPixels = this.player.stats.pickupRadius * 32;

    // Check for loot in traphouses (player steals from traphouses)
    for (const traphouse of this.traphouses) {
      if (!traphouse.hasLoot()) continue;
      if (!this.isPlayerNearBuilding(traphouse, pickupRadiusPixels)) continue;

      // Player can steal loot from nearby traphouses
      const item = traphouse.removeRandomLoot();

      if (item && this.player.pickupLoot(item)) {
        item.pickup(this.player);

        // Track loot collection
        this.game.gameData.lootCollected++;

        // Increase heat when stealing (attracts attention!)
        this.game.gameData.beefLevel += 1.0;
        this.game.gameData.beefLevel = Math.min(this.game.gameData.maxBeef, this.game.gameData.beefLevel);

        // Award XP for stealing
        this.awardXP(5);

        // Play pickup sound
        this.playPickupSound();

        // Start pickup cooldown
        this.pickupCooldown = this.pickupCooldownTime;

        return; // Only steal one item at a time
      } else if (item) {
        // Couldn't pick up, put it back
        traphouse.addLoot(item);
      }
    }

    // Also check for loose loot on the ground
    const playerCenterX = this.player.getCenterX();
    const playerCenterY = this.player.getCenterY();

    for (const item of this.loot) {
      // Skip if loot is already held or stashed
      if (item.isHeld || item.isStashed) continue;

      // Check distance (center to center)
      const distance = Math.sqrt(
        Math.pow(item.getCenterX() - playerCenterX, 2) +
        Math.pow(item.getCenterY() - playerCenterY, 2)
      );

      // Also check bounding box overlap (for when player is standing on loot)
      const playerLeft = this.player.x;
      const playerRight = this.player.x + this.player.width;
      const playerTop = this.player.y;
      const playerBottom = this.player.y + this.player.height;
      const itemLeft = item.x;
      const itemRight = item.x + item.width;
      const itemTop = item.y;
      const itemBottom = item.y + item.height;

      const overlapping = !(playerLeft > itemRight || playerRight < itemLeft ||
                           playerTop > itemBottom || playerBottom < itemTop);

      if (distance <= pickupRadiusPixels || overlapping) {
        // Try to pick up the loot
        if (this.player.pickupLoot(item)) {
          item.pickup(this.player);

          // Track loot collection
          this.game.gameData.lootCollected++;

          // Small heat increase for picking up loose loot
          this.game.gameData.beefLevel += 0.25;
          this.game.gameData.beefLevel = Math.min(this.game.gameData.maxBeef, this.game.gameData.beefLevel);

          // Award XP
          this.awardXP(3);

          // Play pickup sound
          this.playPickupSound();

          // Start pickup cooldown
          this.pickupCooldown = this.pickupCooldownTime;

          return; // Only pick up one item at a time
        }
      }
    }
  }
  
  checkLootStashing() {
    if (!this.player || !this.player.carriedLoot || this.player.carriedLoot.length === 0) return;
    if (!this.safeHouse) return;

    const stashDistance = this.player.stats.returnRadius * 32;

    // Check if player is near safe house
    if (this.isPlayerNearBuilding(this.safeHouse, stashDistance) && this.safeHouse.hasEmptySlots()) {
      // Try to stash loot
      const item = this.player.stashLoot();
      if (item && this.safeHouse.addLoot(item)) {
        // Track loot stashing
        this.game.gameData.lootStashed++;

        // Reduce heat when stashing (loot is secured)
        this.game.gameData.beefLevel -= 2.0;
        this.game.gameData.beefLevel = Math.max(0, this.game.gameData.beefLevel);

        // Award XP for successful stash
        this.awardXP(10);

        // Play stash sound
        this.playShelfSound();

        // Trigger upgrade selection every 5 stashes
        if (this.game.gameData.lootStashed % 5 === 0) {
          this.game.stateManager.pushState('upgradeSelection', { isBeefSituation: false });
        }
      }
    }
  }
  
  awardXP(amount) {
    const gameData = this.game.gameData;
    
    // Apply XP multiplier and early game boost
    let xpMultiplier = this.player?.getXPMultiplier() || 1;
    
    // Early game XP boost for first 2 minutes
    if (gameData.elapsedTime < 120) { // 2 minutes
      xpMultiplier *= 1.5;
    }
    
    const multipliedAmount = Math.floor(amount * xpMultiplier);
    gameData.xp += multipliedAmount;
    
    // Create floating XP text
    if (this.player) {
      this.particles.push({
        type: 'xp',
        x: this.player.getCenterX(),
        y: this.player.y - 10,
        text: `+${multipliedAmount} XP`,
        vy: -50,
        lifetime: 1.5,
        age: 0
      });
    }
    
    // Check for level up (no upgrade screen - that's triggered by stashing)
    while (gameData.xp >= gameData.xpToNext) {
      gameData.xp -= gameData.xpToNext;
      gameData.playerLevel++;

      // Refill stamina as a level up bonus
      if (this.player) {
        this.player.stats.stamina = this.player.stats.maxStamina;
      }

      // Calculate next level XP requirement
      gameData.xpToNext = Math.floor(100 * Math.pow(1.45, gameData.playerLevel - 1));
    }
  }

  // Check if beef is high enough to trigger upgrade selection
  checkBeefThreshold() {
    const gameData = this.game.gameData;

    // Trigger at 60% beef if we haven't shown it yet for this threshold
    if (gameData.beefLevel >= 60 && !this.beefUpgradeShown) {
      this.beefUpgradeShown = true;

      // BEEF TRIGGERED! Major consequences:

      // 1. Switch to beef music
      this.switchToBeefMusic();

      // 2. Spawn the Top Boy if not already out
      this.spawnTopBoy();

      // 3. Queue 15 extra opps to spawn gradually from Opp Block
      this.queueBeefOpps(15);

      // 4. Multiply traphouse loot by 4x
      this.multiplyTraphouseLoot(4);

      // 5. Make all opps (including Opp Block guards) scatter and surround player
      this.scatterAllOpps();

      // Show upgrade selection
      this.game.stateManager.pushState('upgradeSelection', { isBeefSituation: true });
    }

    // Reset flag when beef drops below 40% (so it can trigger again)
    if (gameData.beefLevel < 40) {
      this.beefUpgradeShown = false;

      // Switch back to normal music when beef cools down
      if (this.isBeefMusicPlaying) {
        this.switchToNormalMusic();
      }
    }
  }

  // Switch to beef music
  switchToBeefMusic() {
    if (this.isBeefMusicPlaying) return;

    // Pause normal music
    if (this.bgMusic) {
      this.bgMusic.pause();
    }

    // Play beef music
    if (this.beefMusic) {
      this.beefMusic.currentTime = 0;
      this.beefMusic.play().catch(e => console.log('Beef music play failed:', e));
    }

    this.isBeefMusicPlaying = true;
  }

  // Switch back to normal music
  switchToNormalMusic() {
    if (!this.isBeefMusicPlaying) return;

    // Pause beef music
    if (this.beefMusic) {
      this.beefMusic.pause();
    }

    // Resume normal music
    if (this.bgMusic) {
      this.bgMusic.play().catch(e => console.log('Game music play failed:', e));
    }

    this.isBeefMusicPlaying = false;
  }

  // Spawn the Top Boy boss when beef triggers
  spawnTopBoy() {
    // Don't spawn if Top Boy is already alive
    if (this.topBoy && !this.topBoy.isDead) {
      return;
    }

    if (!this.oppBlock) return;

    // Spawn Top Boy from the Opp Block
    const spawnX = this.oppBlock.x + this.oppBlock.width / 2;
    const spawnY = this.oppBlock.y + this.oppBlock.height / 2;

    const topBoy = new Opp(this.game, spawnX, spawnY, 3);

    // Configure as Top Boy
    topBoy.isTopBoy = true;
    topBoy.spriteType = 2; // Use opp2 sprite (leather jacket guy)

    // Same size as player character
    topBoy.width = 48;
    topBoy.height = 64;

    // 5x health
    topBoy.health = 150;
    topBoy.maxHealth = 150;

    // Aggressive stats
    topBoy.shootCooldown = 1.0; // Slower cooldown but burst fire
    topBoy.shootTimer = 0; // Ready to shoot immediately
    topBoy.shootRange = 400;
    topBoy.chaseSpeed = 100;
    topBoy.speed = 100;
    topBoy.fleeSpeed = 150;

    // Start chasing
    topBoy.state = 'chasing';
    topBoy.isChaser = true;

    this.topBoy = topBoy;
    this.opps.push(topBoy);
    this.topBoySpawned = true;

    // Show alert
    this.showAlert('⚠️ THE TOP BOY IS AROUND ⚠️');
  }

  // Show an alert notification
  showAlert(text) {
    this.alertNotification = {
      active: true,
      text: text,
      timer: 0,
      duration: 3
    };
  }

  // Update alert notification
  updateAlertNotification(deltaTime) {
    if (!this.alertNotification.active) return;

    this.alertNotification.timer += deltaTime;
    if (this.alertNotification.timer >= this.alertNotification.duration) {
      this.alertNotification.active = false;
    }
  }

  // Check if Top Boy was defeated and trigger level progression
  checkTopBoyDefeated() {
    // Only check if Top Boy was spawned and not already defeated
    if (!this.topBoySpawned || this.topBoyDefeated) return;

    // Check if Top Boy is dead
    if (this.topBoy && this.topBoy.isDead) {
      this.topBoyDefeated = true;
      this.triggerLevelProgression();
    }
  }

  // Trigger level progression when Top Boy is defeated
  triggerLevelProgression() {
    this.currentLevel++;

    // Show level complete alert
    this.showAlert(`🏆 LEVEL ${this.currentLevel - 1} COMPLETE! 🏆`);

    // Expand the world after a short delay
    setTimeout(() => {
      this.expandWorld();
      this.showAlert(`📍 LEVEL ${this.currentLevel} - NEW TERRITORY 📍`);
    }, 2000);
  }

  // Expand the world to add new territory
  expandWorld() {
    const expansionWidth = 1344; // Same as original world width
    const oldWorldWidth = this.worldWidth;

    // Expand world bounds to the right
    this.worldWidth += expansionWidth;

    // CRITICAL: Update camera bounds to match new world size
    // Without this, camera stays locked to original bounds
    this.game.camera.setBounds(0, 0, this.worldWidth, this.worldHeight);

    // Generate new content in the expanded area
    this.generateNewLevelContent(oldWorldWidth, expansionWidth);

    // Reset Top Boy for new level
    this.topBoy = null;
    this.topBoySpawned = false;
    this.topBoyDefeated = false;

    // Reset beef for new level challenge
    this.game.gameData.beefLevel = Math.max(0, this.game.gameData.beefLevel - 30);
    this.beefUpgradeShown = false;

    console.log(`[LEVEL] World expanded to ${this.worldWidth}x${this.worldHeight}, camera bounds updated`);
  }

  // Generate new traphouses, Opp Block, and content in expanded area
  generateNewLevelContent(startX, width) {
    const centerX = startX + width / 2;
    const centerY = this.worldHeight / 2;

    // Create new traphouses in the expanded area
    const newTraphousePositions = [
      { x: startX + 100, y: 150 },
      { x: startX + width - 330, y: 150 },
      { x: startX + 100, y: this.worldHeight - 350 },
    ];

    const colors = ['red', 'blue', 'green', 'yellow', 'purple', 'orange'];

    for (const pos of newTraphousePositions) {
      const color = colors[Math.floor(Math.random() * colors.length)];
      const traphouse = new Traphouse(this.game, pos.x, pos.y, color, 6);
      this.traphouses.push(traphouse);

      // Add some initial loot to new traphouses
      for (let i = 0; i < 3; i++) {
        if (traphouse.hasEmptySlots()) {
          const lootColor = colors[Math.floor(Math.random() * colors.length)];
          const loot = new Loot(this.game, 0, 0, lootColor);
          traphouse.addLoot(loot);
          this.loot.push(loot);
        }
      }
    }

    // Create new Opp Block in the expanded area (bottom right of new area)
    const newOppBlock = new Traphouse(
      this.game,
      startX + width - 330,
      this.worldHeight - 350,
      'red',
      10
    );
    newOppBlock.isOppBlock = true;
    this.traphouses.push(newOppBlock);

    // Update the Opp Block reference to the new one
    this.oppBlock = newOppBlock;

    // Spawn new Opp Block guards
    this.spawnOppBlockGuards(newOppBlock, 4 + this.currentLevel); // More guards each level

    // Spawn some regular opps in the new area
    for (let i = 0; i < 5 + this.currentLevel * 2; i++) {
      const oppX = startX + 100 + Math.random() * (width - 200);
      const oppY = 100 + Math.random() * (this.worldHeight - 200);
      const aggression = Math.min(3, 1 + Math.floor(this.currentLevel / 2));
      const opp = new Opp(this.game, oppX, oppY, aggression);
      this.opps.push(opp);
    }

    // Scatter some loot on the ground in the new area
    for (let i = 0; i < 10; i++) {
      const lootX = startX + 100 + Math.random() * (width - 200);
      const lootY = 100 + Math.random() * (this.worldHeight - 200);
      const lootColor = colors[Math.floor(Math.random() * colors.length)];
      const loot = new Loot(this.game, lootX, lootY, lootColor);
      this.loot.push(loot);
    }
  }

  // Spawn guards for an Opp Block
  spawnOppBlockGuards(oppBlock, count) {
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const distance = 80 + Math.random() * 40;
      const guardX = oppBlock.x + oppBlock.width / 2 + Math.cos(angle) * distance;
      const guardY = oppBlock.y + oppBlock.height / 2 + Math.sin(angle) * distance;

      const guard = new Opp(this.game, guardX, guardY, 3);
      guard.isOppBlockGuard = true;
      guard.guardPatrolCenter = { x: guardX, y: guardY };
      guard.oppBlock = oppBlock;
      guard.health = 50; // Guards are tougher
      guard.maxHealth = 50;

      this.opps.push(guard);
    }
  }

  // Queue opps to spawn gradually from Opp Block
  queueBeefOpps(count) {
    this.beefOppSpawnQueue.count += count;
    this.beefOppSpawnQueue.timer = 0; // Start spawning immediately
  }

  // Update gradual opp spawning from Opp Block
  updateBeefOppSpawning(deltaTime) {
    if (this.beefOppSpawnQueue.count <= 0 || !this.oppBlock) return;

    this.beefOppSpawnQueue.timer -= deltaTime;

    if (this.beefOppSpawnQueue.timer <= 0) {
      // Spawn one opp from the Opp Block
      const angle = Math.random() * Math.PI * 2;
      const distance = 30 + Math.random() * 50;
      const spawnX = this.oppBlock.x + this.oppBlock.width / 2 + Math.cos(angle) * distance;
      const spawnY = this.oppBlock.y + this.oppBlock.height / 2 + Math.sin(angle) * distance;

      // Create aggressive opp that will surround the player
      const opp = new Opp(this.game, spawnX, spawnY, 3); // Level 3 aggression
      opp.isSurrounding = true; // Mark as surrounding opp
      opp.state = 'chasing'; // Start chasing immediately
      this.opps.push(opp);

      // Decrement count and reset timer
      this.beefOppSpawnQueue.count--;
      this.beefOppSpawnQueue.timer = this.beefOppSpawnQueue.interval;
    }
  }

  // Make all opps scatter and try to surround the player
  scatterAllOpps() {
    for (const opp of this.opps) {
      if (!opp.isAlly && !opp.isDead) {
        opp.isSurrounding = true; // Mark as surrounding mode
        opp.isOppBlockGuard = false; // Guards leave their post
        opp.guardPatrolCenter = null; // No more patrolling
        opp.state = 'chasing'; // Start chasing the player
      }
    }
  }

  // Multiply loot in all traphouses
  multiplyTraphouseLoot(multiplier) {
    const colors = ['red', 'blue', 'green', 'yellow', 'purple', 'orange'];

    for (const traphouse of this.traphouses) {
      // Count current loot in traphouse
      const currentCount = traphouse.loot.length;

      // Add (multiplier - 1) * currentCount new loot items
      const newLootCount = currentCount * (multiplier - 1);

      for (let i = 0; i < newLootCount; i++) {
        // Only add if traphouse has capacity
        if (traphouse.hasEmptySlots()) {
          const color = colors[Math.floor(Math.random() * colors.length)];
          const item = new Loot(this.game, 0, 0, color);
          traphouse.addLoot(item);
          this.loot.push(item);
        }
      }
    }
  }

  // Make all opps target the player's safe house
  setOppsSafeHouseTarget() {
    for (const opp of this.opps) {
      if (!opp.isAlly && !opp.isDead) {
        opp.targetingSafeHouse = true;
      }
    }
  }

  // Provoke all allies to attack (when player or ally is hit)
  provokeAllAllies() {
    for (const ally of this.allies) {
      if (ally.isDead) continue;
      ally.isProvoked = true;
      ally.provokedTimer = 10; // Stay aggressive for 10 seconds
    }
  }

  // Update Opp Block guard respawns (they multiply after 7 seconds)
  updateOppBlockRespawns(deltaTime) {
    if (!this.oppBlock) return;

    for (let i = this.oppBlockRespawnQueue.length - 1; i >= 0; i--) {
      const respawn = this.oppBlockRespawnQueue[i];
      respawn.timer -= deltaTime;

      if (respawn.timer <= 0) {
        // Spawn 2 new Opp Block guards at the Opp Block
        for (let j = 0; j < 2; j++) {
          // Random position around the Opp Block
          const spawnX = this.oppBlock.x + Math.random() * this.oppBlock.width;
          const spawnY = this.oppBlock.y + this.oppBlock.height + 10 + Math.random() * 50;

          const newOpp = new Opp(this.game, spawnX, spawnY, 3);
          newOpp.isOppBlockGuard = true;
          newOpp.guardPatrolCenter = { x: spawnX, y: spawnY };
          newOpp.oppBlock = this.oppBlock;
          this.opps.push(newOpp);
        }

        // Remove from queue
        this.oppBlockRespawnQueue.splice(i, 1);
      }
    }
  }
  
  updateParticles(deltaTime) {
    // Update and remove expired particles
    this.particles = this.particles.filter(particle => {
      particle.age += deltaTime;
      
      if (particle.type === 'xp') {
        particle.y += particle.vy * deltaTime;
        particle.vy += 100 * deltaTime; // Gravity
      }
      
      return particle.age < particle.lifetime;
    });
  }
  
  renderParticles(renderer) {
    renderer.addToLayer('ui', (ctx) => {
      ctx.save();

      for (const particle of this.particles) {
        if (particle.type === 'xp') {
          const alpha = 1 - (particle.age / particle.lifetime);
          ctx.globalAlpha = alpha;
          ctx.font = 'bold 18px Arial';
          ctx.fillStyle = '#ffff00';
          ctx.strokeStyle = '#000';
          ctx.lineWidth = 2;
          ctx.textAlign = 'center';
          ctx.strokeText(particle.text, particle.x, particle.y);
          ctx.fillText(particle.text, particle.x, particle.y);
        }
      }

      ctx.restore();
    });
  }

  updateProjectiles(deltaTime) {
    // Update projectiles and check for collisions
    for (const projectile of this.projectiles) {
      if (!projectile.active) continue;

      projectile.update(deltaTime);

      // Player projectiles hit opps
      if (projectile.owner === 'player') {
        for (const opp of this.opps) {
          if (opp.isDead) continue;

          if (projectile.collidesWith(opp)) {
            // Check if this hit will kill the opp
            const wasAlive = !opp.isDead;
            const willDie = opp.health - projectile.damage <= 0;

            // Damage the opp
            opp.takeDamage(projectile.damage);

            // If Chronik killed the opp, increase heat and track the body
            if (wasAlive && opp.isDead) {
              // Track the kill
              this.game.gameData.bodiesDropped++;

              if (opp.isOppBlockGuard) {
                // Killing an Opp Block guard = +70% heat
                this.game.gameData.beefLevel = Math.min(
                  this.game.gameData.maxBeef,
                  this.game.gameData.beefLevel + 70
                );
              } else {
                // Killing a normal opp = +10% heat
                this.game.gameData.beefLevel = Math.min(
                  this.game.gameData.maxBeef,
                  this.game.gameData.beefLevel + 10
                );
              }
            }

            // Apply knockback
            const dir = projectile.getDirectionVector();
            opp.knockback(dir.x, dir.y, 200);

            // Deactivate projectile
            projectile.hit();
            break;
          }
        }
      }

      // Ally projectiles hit opps (not allies, not player)
      if (projectile.owner === 'ally') {
        for (const opp of this.opps) {
          if (opp.isDead || opp.isAlly) continue; // Don't hit allies

          if (projectile.collidesWith(opp)) {
            // Track if opp was alive before damage
            const wasAlive = !opp.isDead;

            // Damage the opp
            opp.takeDamage(projectile.damage);

            // Track the kill if ally killed the opp
            if (wasAlive && opp.isDead) {
              this.game.gameData.bodiesDropped++;
            }

            // Apply knockback
            const dir = projectile.getDirectionVector();
            opp.knockback(dir.x, dir.y, 150);

            // Deactivate projectile
            projectile.hit();
            break;
          }
        }
      }

      // Opp projectiles hit player
      if (projectile.owner === 'opp' && this.player && !this.player.isDead) {
        if (projectile.collidesWith(this.player)) {
          // Damage the player
          this.player.takeDamage(projectile.damage);

          // Provoke all allies when player is hit!
          this.provokeAllAllies();

          // Deactivate projectile
          projectile.hit();

          // Check for player death
          if (this.player.isDead) {
            this.handlePlayerDeath();
          }
        }
      }

      // Opp projectiles also hit allies (Slew Dem crew)
      if (projectile.owner === 'opp' && projectile.active) {
        for (const ally of this.allies) {
          if (ally.isDead) continue;

          if (projectile.collidesWith(ally)) {
            // Damage the ally
            ally.takeDamage(projectile.damage);

            // Provoke this ally and others when hit!
            ally.isProvoked = true;
            ally.provokedTimer = 10;
            this.provokeAllAllies();

            // Apply knockback - but handle it manually since we don't call ally.update()
            ally.vx += projectile.getDirectionVector().x * 100;
            ally.vy += projectile.getDirectionVector().y * 100;

            // Deactivate projectile
            projectile.hit();
            break;
          }
        }
      }
    }

    // Remove inactive projectiles
    this.projectiles = this.projectiles.filter(p => p.active);

    // Create chalk outlines for dead opps
    for (const opp of this.opps) {
      if (opp.isDead && !opp.chalkOutlineCreated) {
        this.addChalkOutline(opp.x, opp.y, opp.facing);
        opp.chalkOutlineCreated = true;

        // Opp Block guards multiply after 7 seconds
        if (opp.isOppBlockGuard) {
          this.oppBlockRespawnQueue.push({
            x: opp.x,
            y: opp.y,
            timer: 7 // 7 seconds delay
          });
        }
      }
    }

    // Update Opp Block respawn queue
    this.updateOppBlockRespawns(deltaTime);

    // Remove dead opps
    this.opps = this.opps.filter(o => !o.isDead);
  }

  addProjectile(projectile) {
    this.projectiles.push(projectile);
  }

  addChalkOutline(x, y, facing) {
    this.chalkOutlines.push({
      x: x,
      y: y,
      facing: facing,
      opacity: 1.0,
      fadeTimer: 60 // Fade out over 60 seconds
    });
  }

  renderChalkOutlines(ctx) {
    for (const outline of this.chalkOutlines) {
      ctx.save();
      ctx.globalAlpha = outline.opacity * 0.8;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      const x = outline.x;
      const y = outline.y;
      const flip = outline.facing === 'right' ? -1 : 1;

      // Draw humanoid chalk outline (body shape)
      ctx.beginPath();

      // Head (circle)
      ctx.arc(x + 16, y + 8, 6, 0, Math.PI * 2);

      // Neck to body
      ctx.moveTo(x + 16, y + 14);
      ctx.lineTo(x + 16, y + 28);

      // Left arm (sprawled out)
      ctx.moveTo(x + 16, y + 18);
      ctx.lineTo(x + 4 * flip + 16, y + 12);
      ctx.lineTo(x + 8 * flip + 16, y + 6);

      // Right arm (sprawled out)
      ctx.moveTo(x + 16, y + 18);
      ctx.lineTo(x - 4 * flip + 16, y + 24);
      ctx.lineTo(x - 10 * flip + 16, y + 28);

      // Left leg
      ctx.moveTo(x + 16, y + 28);
      ctx.lineTo(x + 6, y + 38);
      ctx.lineTo(x + 4, y + 44);

      // Right leg
      ctx.moveTo(x + 16, y + 28);
      ctx.lineTo(x + 26, y + 36);
      ctx.lineTo(x + 30, y + 42);

      ctx.stroke();
      ctx.restore();
    }
  }

  updateChalkOutlines(deltaTime) {
    // Slowly fade out chalk outlines
    for (const outline of this.chalkOutlines) {
      outline.fadeTimer -= deltaTime;
      if (outline.fadeTimer < 10) {
        // Start fading in the last 10 seconds
        outline.opacity = outline.fadeTimer / 10;
      }
    }
    // Remove fully faded outlines
    this.chalkOutlines = this.chalkOutlines.filter(o => o.fadeTimer > 0);
  }

  handlePlayerDeath() {
    // Player was killed - game over
    this.game.stateManager.changeState('gameover', { won: false, reason: 'killed' });
  }

  renderProjectiles(renderer) {
    renderer.addToLayer('entities', (ctx) => {
      for (const projectile of this.projectiles) {
        if (projectile.active && projectile.visible) {
          projectile.render(ctx);
        }
      }
    });
  }

  validateLootStates() {
    const lootStates = {
      stashed: 0,
      held: 0,
      floor: 0,
      invalid: 0
    };

    for (const item of this.loot) {
      if (item.isStashed && item.isHeld) {
        console.error(`Loot ${item.id} is both stashed and held!`);
        lootStates.invalid++;
      } else if (item.isStashed) {
        lootStates.stashed++;
        // Verify loot is actually in a building
        let foundInBuilding = false;
        for (const traphouse of this.traphouses) {
          if (traphouse.loot.includes(item)) {
            foundInBuilding = true;
            break;
          }
        }
        if (this.safeHouse && this.safeHouse.loot.includes(item)) {
          foundInBuilding = true;
        }
        if (!foundInBuilding) {
          console.error(`Loot ${item.id} marked as stashed but not in any building!`);
        }
      } else if (item.isHeld) {
        lootStates.held++;
        if (!item.holder) {
          console.error(`Loot ${item.id} marked as held but has no holder!`);
        }
      } else {
        lootStates.floor++;
      }
    }

    // Log summary only if there are issues
    if (lootStates.invalid > 0) {
      console.log('Loot states:', lootStates, 'Total:', this.loot.length);
    }
  }
  
  checkLootSnatching() {
    if (!this.player || !this.player.carriedLoot || this.player.carriedLoot.length >= this.player.stats.carrySlots) return;

    // Use player's repel radius for snatching loot from opps
    const snatchRadius = this.player.repelRadius;
    const playerCenterX = this.player.getCenterX();
    const playerCenterY = this.player.getCenterY();

    for (const opp of this.opps) {
      // Check if opp is carrying loot
      if (!opp.carriedLoot) continue;

      // Check distance to opp
      const distance = Math.sqrt(
        Math.pow(opp.getCenterX() - playerCenterX, 2) +
        Math.pow(opp.getCenterY() - playerCenterY, 2)
      );

      if (distance <= snatchRadius) {
        // Snatch the loot from the opp
        const item = opp.carriedLoot;

        // Remove loot from opp
        opp.carriedLoot = null;
        opp.dropLootTimer = 0;

        // Give loot to player
        if (this.player.pickupLoot(item)) {
          item.pickup(this.player);

          // Track loot collection
          this.game.gameData.lootCollected++;

          // Opp flees after being robbed
          opp.state = 'fleeing';

          // Increase heat when snatching (aggressive action)
          this.game.gameData.beefLevel += 0.5;
          this.game.gameData.beefLevel = Math.min(this.game.gameData.maxBeef, this.game.gameData.beefLevel);

          // Award XP for snatching
          this.awardXP(7);

          // Play pickup sound
          this.playPickupSound();
        }
      }
    }
  }
  
  isInViewport(entity, viewX, viewY, viewWidth, viewHeight) {
    return !(entity.x + entity.width < viewX || 
             entity.x > viewX + viewWidth ||
             entity.y + entity.height < viewY || 
             entity.y > viewY + viewHeight);
  }
  
  playPickupSound() {
    // Find an available audio instance that's not currently playing
    for (const audio of this.pickupSounds) {
      if (audio.paused || audio.ended) {
        audio.currentTime = 0;
        audio.play().catch(e => console.log('Pickup sound play failed:', e));
        return;
      }
    }
    
    // If all are playing, use the first one anyway (will restart it)
    if (this.pickupSounds.length > 0) {
      this.pickupSounds[0].currentTime = 0;
      this.pickupSounds[0].play().catch(e => console.log('Pickup sound play failed:', e));
    }
  }
  
  playShelfSound() {
    if (this.shelfSound) {
      this.shelfSound.currentTime = 0;
      this.shelfSound.play().catch(e => console.log('Shelf sound play failed:', e));
    }
  }
}