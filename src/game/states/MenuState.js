import { State } from './State.js';
import { PlayingState } from './PlayingState.js';

export class MenuState extends State {
  constructor(game) {
    super(game);
    this.menuItems = [
      { text: 'Start Game', action: () => this.startGame() },
      { text: 'Instructions', action: () => this.showInstructions() }
    ];
    this.selectedIndex = 0;
    this.showingInstructions = false;

    // Video background
    this.video = null;
    this.video2 = null;
    this.videoLoaded = false;
    this.video2Loaded = false;
    this.currentVideo = 1; // 1 or 2

    // Fade state: 'none', 'fade-out', 'black', 'fade-in'
    this.fadeState = 'none';
    this.fadeAlpha = 0; // 0 = fully visible, 1 = fully black
    this.fadeDuration = 1000; // 1 second fade
    this.fadeTimer = 0;
    this.blackDuration = 300; // 0.3 seconds of black

    // Background music
    this.bgMusic = null;
    this.musicLoaded = false;
    this.musicStarted = false; // Track if music has been started by user interaction
    this.clickListenerAdded = false; // Track if click listener was added

    // Menu selection sound
    this.selectSound = null;
  }
  
  enter() {
    this.selectedIndex = 0;
    this.showingInstructions = false;

    // Create and setup video 1 if not already created
    if (!this.video) {
      this.video = document.createElement('video');
      this.video.src = '/intro%20video.mp4';
      this.video.loop = false; // No loop - we handle sequencing manually
      this.video.muted = true;
      this.video.autoplay = true;
      this.video.playsInline = true; // Required for iOS autoplay
      this.video.setAttribute('playsinline', ''); // Also set as attribute for compatibility
      this.video.setAttribute('webkit-playsinline', ''); // Older iOS
      this.video.preload = 'auto'; // Ensure full buffering

      // Handle various video events for better reliability
      this.video.addEventListener('canplaythrough', () => {
        this.videoLoaded = true;
        if (this.currentVideo === 1 && this.fadeState === 'none') {
          this.video.play().catch(e => console.log('Video play failed:', e));
        }
      });

      // Also try playing on loadedmetadata
      this.video.addEventListener('loadedmetadata', () => {
        if (this.currentVideo === 1 && this.fadeState === 'none') {
          this.video.play().catch(e => console.log('Video play on metadata failed:', e));
        }
      });

      // When video 1 ends, play video 2
      this.video.addEventListener('ended', () => {
        this.video2.currentTime = 0;
        this.video2Loaded = true; // Force ready state
        // Start video 2 but don't switch display until it's actually playing
        this.video2.play().then(() => {
          this.currentVideo = 2;
        }).catch(e => {
          console.log('Video 2 play failed:', e);
          this.currentVideo = 2; // Switch anyway as fallback
        });
      });

      // Handle errors
      this.video.addEventListener('error', (e) => {
        console.error('Video loading error:', e);
        this.videoLoaded = false;
      });

      // Force load the video
      this.video.load();
    } else {
      // Resume playing if returning to menu
      this.videoLoaded = true;
      this.currentVideo = 1;
      this.fadeState = 'none';
      this.fadeAlpha = 0;
      this.video.currentTime = 0;
      this.video.play().catch(e => console.log('Video play failed:', e));
    }

    // Create and setup video 2 if not already created
    if (!this.video2) {
      this.video2 = document.createElement('video');
      this.video2.src = '/intro%20video%202.mp4';
      this.video2.loop = false;
      this.video2.muted = true;
      this.video2.playsInline = true; // Required for iOS autoplay
      this.video2.setAttribute('playsinline', '');
      this.video2.setAttribute('webkit-playsinline', '');
      this.video2.preload = 'auto'; // Ensure full buffering

      // Mark as loaded when ready - use multiple events for reliability
      const markVideo2Ready = () => {
        if (!this.video2Loaded) {
          this.video2Loaded = true;
          this.video2.currentTime = 0;
        }
      };
      this.video2.addEventListener('canplay', markVideo2Ready);
      this.video2.addEventListener('canplaythrough', markVideo2Ready);
      this.video2.addEventListener('loadeddata', markVideo2Ready);

      // When video 2 ends, start fade to black then loop back to video 1
      this.video2.addEventListener('ended', () => {
        this.fadeState = 'fade-out';
        this.fadeTimer = 0;
      });

      this.video2.addEventListener('error', (e) => {
        console.error('Video 2 loading error:', e);
        this.video2Loaded = false;
      });

      this.video2.load();
    } else {
      // Ensure video 2 is ready for next transition
      this.video2.currentTime = 0;
    }
    
    // Create and setup background music if not already created
    if (!this.bgMusic) {
      this.bgMusic = new Audio('/intro_music.mp3');
      this.bgMusic.loop = true;
      this.bgMusic.volume = 0.5; // Set to 50% volume

      // Mark as loaded when ready (don't auto-play due to browser restrictions)
      this.bgMusic.addEventListener('loadeddata', () => {
        this.musicLoaded = true;
      });

      // Load the music
      this.bgMusic.load();
    } else if (this.musicStarted) {
      // Resume playing if returning to menu and music was already started
      this.bgMusic.play().catch(e => console.log('Music play failed:', e));
    }
    
    // Create menu selection sound if not already created
    if (!this.selectSound) {
      this.selectSound = new Audio('/menu_select.mp3');
      this.selectSound.volume = 0.7; // Slightly louder than music
    }

    // Add one-time listener to start music AND video on ANY interaction (browser autoplay policy workaround)
    if (!this.clickListenerAdded) {
      this.clickListenerAdded = true;
      const startMediaOnInteraction = () => {
        this.tryStartMusic();
        this.tryStartVideo();
        // Remove all listeners after first interaction
        document.removeEventListener('click', startMediaOnInteraction);
        document.removeEventListener('keydown', startMediaOnInteraction);
        document.removeEventListener('mousedown', startMediaOnInteraction);
        document.removeEventListener('touchstart', startMediaOnInteraction);
      };
      // Listen on document level to catch ANY interaction (including touch)
      document.addEventListener('click', startMediaOnInteraction);
      document.addEventListener('keydown', startMediaOnInteraction);
      document.addEventListener('mousedown', startMediaOnInteraction);
      document.addEventListener('touchstart', startMediaOnInteraction);
    }
  }
  
  exit() {
    // Pause videos when leaving menu
    if (this.video) {
      this.video.pause();
    }
    if (this.video2) {
      this.video2.pause();
    }

    // Pause music when leaving menu
    if (this.bgMusic) {
      this.bgMusic.pause();
    }
  }
  
  update(deltaTime) {
    const input = this.game.inputManager;

    // Try to start music on any user interaction (key press or mouse click)
    if (!this.musicStarted) {
      if (input.isKeyPressed('ArrowUp') || input.isKeyPressed('ArrowDown') ||
          input.isKeyPressed('w') || input.isKeyPressed('s') ||
          input.isKeyPressed('Enter') || input.isKeyPressed(' ') ||
          input.isKeyPressed('Escape') ||
          input.isMouseButtonPressed(0)) {
        this.tryStartMusic();
      }
    }

    // Handle fade transitions
    if (this.fadeState !== 'none') {
      this.fadeTimer += deltaTime * 1000; // Convert to milliseconds

      if (this.fadeState === 'fade-out') {
        // Fading to black
        this.fadeAlpha = Math.min(1, this.fadeTimer / this.fadeDuration);
        if (this.fadeAlpha >= 1) {
          this.fadeState = 'black';
          this.fadeTimer = 0;
        }
      } else if (this.fadeState === 'black') {
        // Hold on black, then switch to video 1 and fade in
        if (this.fadeTimer >= this.blackDuration) {
          this.fadeState = 'fade-in';
          this.fadeTimer = 0;
          this.currentVideo = 1;
          this.video.currentTime = 0;
          this.video.play().catch(e => console.log('Video 1 restart failed:', e));
        }
      } else if (this.fadeState === 'fade-in') {
        // Fading from black to video 1
        this.fadeAlpha = Math.max(0, 1 - (this.fadeTimer / this.fadeDuration));
        if (this.fadeAlpha <= 0) {
          this.fadeState = 'none';
          this.fadeAlpha = 0;
        }
      }
    }

    if (this.showingInstructions) {
      // Dismiss instructions with keyboard, mouse click, or touch
      if (input.isKeyPressed('Escape') || input.isKeyPressed('Enter') ||
          input.isMouseButtonPressed(0)) {
        this.showingInstructions = false;
      }
      return;
    }
    
    // Menu navigation
    if (input.isKeyPressed('ArrowUp') || input.isKeyPressed('w')) {
      this.selectedIndex = (this.selectedIndex - 1 + this.menuItems.length) % this.menuItems.length;
      this.playSelectSound();
    }
    
    if (input.isKeyPressed('ArrowDown') || input.isKeyPressed('s')) {
      this.selectedIndex = (this.selectedIndex + 1) % this.menuItems.length;
      this.playSelectSound();
    }
    
    if (input.isKeyPressed('Enter') || input.isKeyPressed(' ')) {
      this.menuItems[this.selectedIndex].action();
    }
    
    // Mouse support
    const mousePos = input.getMousePosition();
    if (mousePos && !this.showingInstructions) {
      const { width, height } = this.game;
      const menuStartY = height * 0.7; // Menu starts at 70% down
      
      // Check each menu item
      for (let i = 0; i < this.menuItems.length; i++) {
        const y = menuStartY + i * 60;
        const itemTop = y - 25;
        const itemBottom = y + 25;
        const itemLeft = width / 2 - 200;
        const itemRight = width / 2 + 200;
        
        if (mousePos.x >= itemLeft && mousePos.x <= itemRight &&
            mousePos.y >= itemTop && mousePos.y <= itemBottom) {
          // Mouse is over this item
          if (this.selectedIndex !== i) {
            this.selectedIndex = i;
            this.playSelectSound();
          }
          
          // Check for click
          if (input.isMouseButtonPressed(0)) { // 0 = left mouse button
            this.menuItems[this.selectedIndex].action();
          }
          break;
        }
      }
    }
  }
  
  render(renderer, interpolation) {
    const ctx = renderer.ctx;
    const { width, height } = this.game;
    
    // Determine which video to draw
    const activeVideo = this.currentVideo === 1 ? this.video : this.video2;
    const isVideoReady = this.currentVideo === 1
      ? (this.video && this.videoLoaded)
      : (this.video2 && this.video2Loaded);

    // Draw video background if loaded (draw even if briefly paused during transition)
    if (isVideoReady && activeVideo && activeVideo.readyState >= 2) {
      try {
        // Scale video to cover the entire canvas
        const videoAspect = activeVideo.videoWidth / activeVideo.videoHeight;
        const canvasAspect = width / height;

        let drawWidth, drawHeight, drawX, drawY;

        if (videoAspect > canvasAspect) {
          // Video is wider - fit height, crop width
          drawHeight = height;
          drawWidth = height * videoAspect;
          drawX = (width - drawWidth) / 2;
          drawY = 0;
        } else {
          // Video is taller - fit width, crop height
          drawWidth = width;
          drawHeight = width / videoAspect;
          drawX = 0;
          drawY = (height - drawHeight) / 2;
        }

        ctx.drawImage(activeVideo, drawX, drawY, drawWidth, drawHeight);
      } catch (e) {
        // Fallback to solid color if video fails
        ctx.fillStyle = '#f5e6d3';
        ctx.fillRect(0, 0, width, height);
      }
    } else {
      // Fallback background color
      ctx.fillStyle = '#f5e6d3';
      ctx.fillRect(0, 0, width, height);
    }

    // Draw fade overlay
    if (this.fadeAlpha > 0) {
      ctx.fillStyle = `rgba(0, 0, 0, ${this.fadeAlpha})`;
      ctx.fillRect(0, 0, width, height);
    }
    
    
    if (this.showingInstructions) {
      this.renderInstructions(ctx);
      return;
    }

    ctx.save();

    // Menu items - positioned in bottom third
    ctx.font = '36px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    const menuStartY = height * 0.7; // Start at 70% down the screen
    
    this.menuItems.forEach((item, index) => {
      const y = menuStartY + index * 60;
      
      if (index === this.selectedIndex) {
        // Highlight selected item with semi-transparent background
        ctx.fillStyle = 'rgba(139, 69, 19, 0.8)';
        ctx.fillRect(width / 2 - 200, y - 25, 400, 50);
        
        // Selected text
        ctx.fillStyle = '#ffffff';
        ctx.fillText(item.text, width / 2, y);
      } else {
        // Non-selected items with shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        ctx.fillText(item.text, width / 2 + 2, y + 2);
        ctx.fillStyle = '#ffffff';
        ctx.fillText(item.text, width / 2, y);
      }
    });
    
    ctx.restore();
  }
  
  renderInstructions(ctx) {
    const { width, height } = this.game;
    
    ctx.save();
    
    // Draw light brown background box with rounded corners
    const boxWidth = 700;
    const boxHeight = 580; // Increased height to fit all text
    const boxX = (width - boxWidth) / 2;
    const boxY = height * 0.08;
    const borderRadius = 20;
    
    // Helper function to draw rounded rectangle
    const drawRoundedRect = (x, y, width, height, radius) => {
      ctx.beginPath();
      ctx.moveTo(x + radius, y);
      ctx.lineTo(x + width - radius, y);
      ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
      ctx.lineTo(x + width, y + height - radius);
      ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
      ctx.lineTo(x + radius, y + height);
      ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
      ctx.lineTo(x, y + radius);
      ctx.quadraticCurveTo(x, y, x + radius, y);
      ctx.closePath();
    };
    
    // Box shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    drawRoundedRect(boxX + 5, boxY + 5, boxWidth, boxHeight, borderRadius);
    ctx.fill();
    
    // Main box with transparency
    ctx.fillStyle = 'rgba(245, 230, 211, 0.95)'; // Light brown with 95% opacity
    drawRoundedRect(boxX, boxY, boxWidth, boxHeight, borderRadius);
    ctx.fill();
    
    // Box border
    ctx.strokeStyle = '#8B4513';
    ctx.lineWidth = 3;
    drawRoundedRect(boxX, boxY, boxWidth, boxHeight, borderRadius);
    ctx.stroke();
    
    // Title
    ctx.fillStyle = '#3d2914';
    ctx.font = 'bold 42px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('HOW TO PLAY', width / 2, boxY + 50);
    
    ctx.font = '20px Arial'; // Reduced from 24px
    const instructions = [
      'Survive 30 minutes on the streets!',
      '',
      'CONTROLS:',
      'WASD/Arrow Keys - Move',
      'Shift - Shoot',
      'P/Escape - Pause',
      '',
      'MOBILE: Swipe to move, tap to shoot',
      '',
      'GAMEPLAY:',
      '• Steal loot from traphouses',
      '• Stash your loot at your safe house',
      '• Opps will protect traphouses and raid your stash!',
      '• Keep Beef below 100% or you lose',
      '',
      'Tap anywhere or press Enter to return'
    ];
    
    const lineHeight = 28; // Spacing between lines
    const startY = boxY + 100; // Start text below title
    
    instructions.forEach((line, index) => {
      ctx.fillText(line, width / 2, startY + index * lineHeight);
    });
    
    ctx.restore();
  }
  
  startGame() {
    // Create a fresh PlayingState instance to ensure clean state
    const freshPlayingState = new PlayingState(this.game);
    this.game.stateManager.registerState('playing', freshPlayingState);
    
    this.game.stateManager.changeState('playing');
  }
  
  showInstructions() {
    this.showingInstructions = true;
  }
  
  playSelectSound() {
    if (this.selectSound) {
      // Reset the sound to play from beginning
      this.selectSound.currentTime = 0;
      this.selectSound.play().catch(e => console.log('Select sound play failed:', e));
    }
  }

  // Start music on first user interaction (required by browser autoplay policy)
  tryStartMusic() {
    if (!this.musicStarted && this.bgMusic) {
      this.bgMusic.play().then(() => {
        this.musicStarted = true;
      }).catch(e => console.log('Music play failed:', e));
    }
  }

  // Start video on first user interaction (required by mobile browsers)
  tryStartVideo() {
    if (this.video && this.videoLoaded) {
      this.video.play().catch(e => console.log('Video play on interaction failed:', e));
    }
  }
}