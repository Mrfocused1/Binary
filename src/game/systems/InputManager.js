export class InputManager {
  constructor(canvas) {
    this.canvas = canvas;
    
    // Keyboard state
    this.keys = new Map();
    this.previousKeys = new Map();
    
    // Key press events that happened this frame
    this.frameKeyPresses = new Set();
    this.frameKeyReleases = new Set();
    
    // Mouse state
    this.mouse = {
      x: 0,
      y: 0,
      buttons: new Map(),
      previousButtons: new Map(),
      wheel: 0
    };
    
    // Touch state (for mobile support)
    this.touches = new Map();
    this.isMobile = this.detectMobile();

    // Swipe-based movement state (auto-run in swiped direction)
    this.swipeMovement = {
      x: 0,           // Current movement direction (-1 to 1)
      y: 0,
      active: false,  // Whether auto-run is active
      touchId: null,  // Touch ID for swipe tracking
      startX: 0,      // Swipe start position
      startY: 0,
      startTime: 0,   // For velocity calculation
      lastTapTime: 0  // For double-tap to stop
    };

    // Tap to shoot state
    this.tapShoot = {
      active: false,  // Whether shoot is triggered this frame
      tapTime: 0      // When the tap happened
    };

    // Menu tap state (for UI interactions)
    this.menuTap = {
      active: false,  // Whether a menu tap happened this frame
      x: 0,           // Tap position
      y: 0
    };

    // Minimum swipe distance to trigger auto-run (in pixels)
    this.swipeThreshold = 30;
    // Double-tap timeout (ms)
    this.doubleTapTimeout = 300;

    // Virtual buttons (only pause now, tap anywhere to shoot)
    this.virtualButtons = {
      pause: { active: false, touchId: null, x: 0, y: 0, radius: 30 }
    };

    // Input mappings
    this.actionMappings = new Map([
      ['moveUp', ['w', 'W', 'ArrowUp']],
      ['moveDown', ['s', 'S', 'ArrowDown']],
      ['moveLeft', ['a', 'A', 'ArrowLeft']],
      ['moveRight', ['d', 'D', 'ArrowRight']],
      ['shoot', [' ']],
      ['pause', ['p', 'P', 'Escape']],
      ['interact', ['e', 'E']]
    ]);
    
    // Make canvas focusable
    this.canvas.tabIndex = 1;
    
    this.setupEventListeners();
  }
  
  setupEventListeners() {
    console.log('Setting up input event listeners...');
    
    // Focus canvas
    this.canvas.focus();
    
    // Keyboard events
    window.addEventListener('keydown', (e) => this.handleKeyDown(e));
    window.addEventListener('keyup', (e) => this.handleKeyUp(e));
    
    // Mouse events
    this.canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
    this.canvas.addEventListener('mouseup', (e) => this.handleMouseUp(e));
    this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
    this.canvas.addEventListener('wheel', (e) => this.handleMouseWheel(e));
    
    // Prevent context menu on right click
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    
    // Touch events (basic support)
    this.canvas.addEventListener('touchstart', (e) => this.handleTouchStart(e));
    this.canvas.addEventListener('touchend', (e) => this.handleTouchEnd(e));
    this.canvas.addEventListener('touchmove', (e) => this.handleTouchMove(e));
    
    // Handle focus loss - be less aggressive about clearing inputs
    let windowHasFocus = true;
    window.addEventListener('blur', (e) => {
      // Only clear held keys to prevent stuck keys, but keep other state
      if (document.hasFocus() === false) {
        console.log('Window lost focus, clearing held keys');
        windowHasFocus = false;
        // Only clear currently held keys, not all input state
        this.keys.clear();
        this.mouse.buttons.clear();
        // Don't clear frameKeyPresses/frameKeyReleases as they'll be cleared next frame anyway
      }
    });
    
    window.addEventListener('focus', () => {
      console.log('Window regained focus');
      windowHasFocus = true;
      // Refocus canvas when window regains focus
      this.canvas.focus();
    });
    
    // Also handle canvas blur/focus
    this.canvas.addEventListener('blur', () => {
      console.log('Canvas lost focus');
    });
    
    this.canvas.addEventListener('focus', () => {
      console.log('Canvas gained focus');
    });
  }
  
  handleKeyDown(event) {
    // Prevent default for game keys
    if (this.isGameKey(event.key)) {
      event.preventDefault();
    }
    
    // If this key wasn't already down, it's a new press
    if (!this.keys.has(event.key)) {
      this.frameKeyPresses.add(event.key);
      console.log('New key press:', event.key);
    }
    
    this.keys.set(event.key, true);
  }
  
  handleKeyUp(event) {
    if (this.keys.has(event.key)) {
      this.frameKeyReleases.add(event.key);
    }
    this.keys.delete(event.key);
  }
  
  handleMouseDown(event) {
    this.mouse.buttons.set(event.button, true);
    this.updateMousePosition(event);
  }
  
  handleMouseUp(event) {
    this.mouse.buttons.delete(event.button);
  }
  
  handleMouseMove(event) {
    this.updateMousePosition(event);
  }
  
  handleMouseWheel(event) {
    event.preventDefault();
    this.mouse.wheel = event.deltaY;
  }
  
  handleTouchStart(event) {
    event.preventDefault();
    const now = Date.now();

    for (const touch of event.changedTouches) {
      const pos = this.getTouchCanvasPosition(touch);

      this.touches.set(touch.identifier, {
        x: pos.x,
        y: pos.y,
        startX: pos.x,
        startY: pos.y,
        clientX: touch.clientX,
        clientY: touch.clientY
      });

      // Check if touch is in pause zone (top right)
      if (pos.x > this.canvas.width * 0.85 && pos.y < this.canvas.height * 0.15) {
        this.virtualButtons.pause.active = true;
        this.virtualButtons.pause.touchId = touch.identifier;
      }
      // All other touches - track for swipe/tap detection
      else {
        // Check for double-tap to stop
        if (now - this.swipeMovement.lastTapTime < this.doubleTapTimeout) {
          // Double-tap detected - stop movement
          this.swipeMovement.active = false;
          this.swipeMovement.x = 0;
          this.swipeMovement.y = 0;
          this.swipeMovement.lastTapTime = 0; // Reset to prevent triple-tap issues
        } else {
          // Start tracking this touch for potential swipe or tap
          this.swipeMovement.touchId = touch.identifier;
          this.swipeMovement.startX = pos.x;
          this.swipeMovement.startY = pos.y;
          this.swipeMovement.startTime = now;
        }
      }
    }

    // Simulate mouse position for menu compatibility
    if (event.touches.length > 0) {
      const pos = this.getTouchCanvasPosition(event.touches[0]);
      this.mouse.x = pos.x;
      this.mouse.y = pos.y;
    }
  }

  handleTouchEnd(event) {
    event.preventDefault();
    const now = Date.now();

    for (const touch of event.changedTouches) {
      const pos = this.getTouchCanvasPosition(touch);

      // Check if this was a swipe/tap touch
      if (this.swipeMovement.touchId === touch.identifier) {
        const dx = pos.x - this.swipeMovement.startX;
        const dy = pos.y - this.swipeMovement.startY;
        const distance = Math.sqrt(dx * dx + dy * dy);

        // If swipe distance exceeds threshold, set auto-run direction
        if (distance >= this.swipeThreshold) {
          // Normalize the direction
          let normX = dx / distance;
          let normY = dy / distance;

          // Snap to 8 directions (cardinal + diagonal)
          // Calculate angle and snap to nearest 45-degree increment
          const angle = Math.atan2(normY, normX);
          const snappedAngle = Math.round(angle / (Math.PI / 4)) * (Math.PI / 4);

          this.swipeMovement.x = Math.cos(snappedAngle);
          this.swipeMovement.y = Math.sin(snappedAngle);

          // Clean up tiny floating point errors for cardinal directions
          if (Math.abs(this.swipeMovement.x) < 0.01) this.swipeMovement.x = 0;
          if (Math.abs(this.swipeMovement.y) < 0.01) this.swipeMovement.y = 0;

          this.swipeMovement.active = true;
        } else {
          // Short tap - SHOOT and record for double-tap detection
          this.tapShoot.active = true;
          this.tapShoot.tapTime = now;
          this.swipeMovement.lastTapTime = now;

          // Also set menu tap for UI interactions
          this.menuTap.active = true;
          this.menuTap.x = pos.x;
          this.menuTap.y = pos.y;
        }

        this.swipeMovement.touchId = null;
      }

      // Release pause button
      if (this.virtualButtons.pause.touchId === touch.identifier) {
        this.virtualButtons.pause.active = false;
        this.virtualButtons.pause.touchId = null;
      }

      this.touches.delete(touch.identifier);
    }

    // Simulate mouse click for menu compatibility
    if (event.changedTouches.length > 0) {
      const pos = this.getTouchCanvasPosition(event.changedTouches[0]);
      this.mouse.x = pos.x;
      this.mouse.y = pos.y;
      this.mouse.buttons.set(0, true);
      setTimeout(() => this.mouse.buttons.delete(0), 100);
    }
  }

  handleTouchMove(event) {
    event.preventDefault();
    for (const touch of event.changedTouches) {
      if (this.touches.has(touch.identifier)) {
        const pos = this.getTouchCanvasPosition(touch);
        const touchData = this.touches.get(touch.identifier);
        touchData.x = pos.x;
        touchData.y = pos.y;
        touchData.clientX = touch.clientX;
        touchData.clientY = touch.clientY;
      }
    }

    // Update mouse position for menu compatibility
    if (event.touches.length > 0) {
      const pos = this.getTouchCanvasPosition(event.touches[0]);
      this.mouse.x = pos.x;
      this.mouse.y = pos.y;
    }
  }

  // Convert touch client coordinates to canvas coordinates
  getTouchCanvasPosition(touch) {
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.canvas.width / rect.width;
    const scaleY = this.canvas.height / rect.height;

    return {
      x: (touch.clientX - rect.left) * scaleX,
      y: (touch.clientY - rect.top) * scaleY
    };
  }
  
  updateMousePosition(event) {
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.canvas.width / rect.width;
    const scaleY = this.canvas.height / rect.height;
    
    this.mouse.x = (event.clientX - rect.left) * scaleX;
    this.mouse.y = (event.clientY - rect.top) * scaleY;
  }
  
  update() {
    // Store previous frame's input state
    this.previousKeys = new Map(this.keys);
    this.mouse.previousButtons = new Map(this.mouse.buttons);

    // Clear frame events after they've been processed
    // This happens AFTER the game has had a chance to check them
    this.frameKeyPresses.clear();
    this.frameKeyReleases.clear();

    // Clear tap shoot after it's been processed
    this.tapShoot.active = false;

    // Clear menu tap after it's been processed
    this.menuTap.active = false;

    // Reset wheel delta
    this.mouse.wheel = 0;
  }
  
  // Key state queries
  isKeyDown(key) {
    return this.keys.has(key);
  }
  
  isKeyPressed(key) {
    // Check if this key was pressed this frame
    const pressed = this.frameKeyPresses.has(key);
    
    if (pressed && (key === 'ArrowUp' || key === 'ArrowDown' || key === 'Enter')) {
      console.log(`isKeyPressed(${key}): PRESSED!`);
    }
    
    return pressed;
  }
  
  isKeyReleased(key) {
    return !this.isKeyDown(key) && this.previousKeys.has(key);
  }
  
  // Action queries (support multiple key mappings)
  isActionDown(action) {
    const keys = this.actionMappings.get(action);
    return keys ? keys.some(key => this.isKeyDown(key)) : false;
  }
  
  isActionPressed(action) {
    const keys = this.actionMappings.get(action);
    return keys ? keys.some(key => this.isKeyPressed(key)) : false;
  }
  
  // Mouse queries
  isMouseButtonDown(button) {
    return this.mouse.buttons.has(button);
  }
  
  isMouseButtonPressed(button) {
    return this.isMouseButtonDown(button) && !this.mouse.previousButtons.has(button);
  }
  
  getMousePosition() {
    return { x: this.mouse.x, y: this.mouse.y };
  }
  
  getMouseWheel() {
    return this.mouse.wheel;
  }

  // Get menu tap (for mobile UI interactions)
  getMenuTap() {
    if (this.menuTap.active) {
      return { x: this.menuTap.x, y: this.menuTap.y };
    }
    return null;
  }

  // Movement vector (for player control)
  getMovementVector() {
    let x = 0;
    let y = 0;
    
    if (this.isActionDown('moveLeft')) x -= 1;
    if (this.isActionDown('moveRight')) x += 1;
    if (this.isActionDown('moveUp')) y -= 1;
    if (this.isActionDown('moveDown')) y += 1;
    
    // Normalize diagonal movement
    if (x !== 0 && y !== 0) {
      const length = Math.sqrt(x * x + y * y);
      x /= length;
      y /= length;
    }
    
    return { x, y };
  }
  
  // Utility methods
  isGameKey(key) {
    const gameKeys = ['w', 'a', 's', 'd', 'W', 'A', 'S', 'D', 
                     'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
                     ' ', 'Shift', 'p', 'P', 'Escape'];
    return gameKeys.includes(key);
  }
  
  clearAllInputs() {
    this.keys.clear();
    this.previousKeys.clear();
    this.frameKeyPresses.clear();
    this.frameKeyReleases.clear();
    this.mouse.buttons.clear();
    this.touches.clear();
  }
  
  // Safely clear just the frame events (for state transitions)
  clearFrameEvents() {
    this.frameKeyPresses.clear();
    this.frameKeyReleases.clear();
  }
  
  // Ensure canvas has focus
  ensureFocus() {
    if (document.activeElement !== this.canvas) {
      console.log('Refocusing canvas');
      this.canvas.focus();
    }
  }

  // Detect if running on mobile device
  detectMobile() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
           ('ontouchstart' in window) ||
           (navigator.maxTouchPoints > 0);
  }

  // Get swipe-based auto-run direction
  getSwipeMovementVector() {
    if (!this.swipeMovement.active) {
      return { x: 0, y: 0 };
    }
    return {
      x: this.swipeMovement.x,
      y: this.swipeMovement.y
    };
  }

  // Check if tap-to-shoot is active
  isTapShootActive() {
    return this.tapShoot.active;
  }

  // Check if pause button was pressed
  isPauseButtonPressed() {
    return this.virtualButtons.pause.active;
  }

  // Get combined movement vector (keyboard + swipe auto-run)
  getMovementVector() {
    let x = 0;
    let y = 0;

    // Keyboard input
    if (this.isActionDown('moveLeft')) x -= 1;
    if (this.isActionDown('moveRight')) x += 1;
    if (this.isActionDown('moveUp')) y -= 1;
    if (this.isActionDown('moveDown')) y += 1;

    // If keyboard is being used, it overrides swipe movement
    if (x !== 0 || y !== 0) {
      // Normalize diagonal movement for keyboard
      if (x !== 0 && y !== 0) {
        const length = Math.sqrt(x * x + y * y);
        x /= length;
        y /= length;
      }
      return { x, y };
    }

    // Touch input (swipe-based auto-run)
    const swipe = this.getSwipeMovementVector();
    if (swipe.x !== 0 || swipe.y !== 0) {
      return swipe;
    }

    return { x: 0, y: 0 };
  }

  // Check if shooting (keyboard Shift OR tap on mobile)
  isShootingActive() {
    return this.isActionDown('shoot') || this.isTapShootActive();
  }

  // Get touch for UI interactions (first active touch)
  getTouch() {
    if (this.touches.size > 0) {
      const firstTouch = this.touches.values().next().value;
      return { x: firstTouch.x, y: firstTouch.y };
    }
    return null;
  }

  // Check if there's an active touch
  hasActiveTouch() {
    return this.touches.size > 0;
  }

  // Get swipe movement state for rendering
  getSwipeState() {
    return {
      active: this.swipeMovement.active,
      x: this.swipeMovement.x,
      y: this.swipeMovement.y
    };
  }

  // Get button states for rendering
  getButtonStates() {
    return {
      shoot: this.virtualButtons.shoot.active,
      pause: this.virtualButtons.pause.active
    };
  }

  // Stop swipe movement (can be called externally)
  stopSwipeMovement() {
    this.swipeMovement.active = false;
    this.swipeMovement.x = 0;
    this.swipeMovement.y = 0;
  }
}