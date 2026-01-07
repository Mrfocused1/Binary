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

    // Virtual joystick state
    this.virtualJoystick = {
      active: false,
      touchId: null,
      centerX: 0,
      centerY: 0,
      currentX: 0,
      currentY: 0,
      radius: 60 // Max distance from center
    };

    // Virtual buttons
    this.virtualButtons = {
      shoot: { active: false, touchId: null, x: 0, y: 0, radius: 50 },
      pause: { active: false, touchId: null, x: 0, y: 0, radius: 30 }
    };

    // Touch zones (will be set based on canvas size)
    this.touchZones = {
      joystick: { x: 0, y: 0, width: 0, height: 0 },
      shoot: { x: 0, y: 0, radius: 50 },
      pause: { x: 0, y: 0, radius: 30 }
    };

    // Input mappings
    this.actionMappings = new Map([
      ['moveUp', ['w', 'W', 'ArrowUp']],
      ['moveDown', ['s', 'S', 'ArrowDown']],
      ['moveLeft', ['a', 'A', 'ArrowLeft']],
      ['moveRight', ['d', 'D', 'ArrowRight']],
      ['shoot', ['Shift']],
      ['pause', ['p', 'P', 'Escape']],
      ['interact', [' ', 'e', 'E']]
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

      // Check if touch is in joystick zone (left half of screen)
      if (pos.x < this.canvas.width / 2 && !this.virtualJoystick.active) {
        this.virtualJoystick.active = true;
        this.virtualJoystick.touchId = touch.identifier;
        this.virtualJoystick.centerX = pos.x;
        this.virtualJoystick.centerY = pos.y;
        this.virtualJoystick.currentX = pos.x;
        this.virtualJoystick.currentY = pos.y;
      }
      // Check if touch is in shoot button zone (right side, lower)
      else if (pos.x > this.canvas.width * 0.7 && pos.y > this.canvas.height * 0.5) {
        this.virtualButtons.shoot.active = true;
        this.virtualButtons.shoot.touchId = touch.identifier;
        this.virtualButtons.shoot.x = pos.x;
        this.virtualButtons.shoot.y = pos.y;
      }
      // Check if touch is in pause zone (top right)
      else if (pos.x > this.canvas.width * 0.85 && pos.y < this.canvas.height * 0.15) {
        this.virtualButtons.pause.active = true;
        this.virtualButtons.pause.touchId = touch.identifier;
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
    for (const touch of event.changedTouches) {
      // Release joystick if this was the joystick touch
      if (this.virtualJoystick.touchId === touch.identifier) {
        this.virtualJoystick.active = false;
        this.virtualJoystick.touchId = null;
      }

      // Release shoot button
      if (this.virtualButtons.shoot.touchId === touch.identifier) {
        this.virtualButtons.shoot.active = false;
        this.virtualButtons.shoot.touchId = null;
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

        // Update joystick position
        if (this.virtualJoystick.touchId === touch.identifier) {
          this.virtualJoystick.currentX = pos.x;
          this.virtualJoystick.currentY = pos.y;
        }
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

  // Get virtual joystick movement vector (returns {x, y} normalized)
  getVirtualJoystickVector() {
    if (!this.virtualJoystick.active) {
      return { x: 0, y: 0 };
    }

    const dx = this.virtualJoystick.currentX - this.virtualJoystick.centerX;
    const dy = this.virtualJoystick.currentY - this.virtualJoystick.centerY;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance < 10) { // Dead zone
      return { x: 0, y: 0 };
    }

    // Normalize and clamp
    const maxDistance = this.virtualJoystick.radius;
    const clampedDistance = Math.min(distance, maxDistance);
    const normalizedDistance = clampedDistance / maxDistance;

    return {
      x: (dx / distance) * normalizedDistance,
      y: (dy / distance) * normalizedDistance
    };
  }

  // Check if shoot button is pressed
  isShootButtonPressed() {
    return this.virtualButtons.shoot.active;
  }

  // Check if pause button was pressed
  isPauseButtonPressed() {
    return this.virtualButtons.pause.active;
  }

  // Get combined movement vector (keyboard + touch)
  getMovementVector() {
    let x = 0;
    let y = 0;

    // Keyboard input
    if (this.isActionDown('moveLeft')) x -= 1;
    if (this.isActionDown('moveRight')) x += 1;
    if (this.isActionDown('moveUp')) y -= 1;
    if (this.isActionDown('moveDown')) y += 1;

    // Touch input (virtual joystick)
    const joystick = this.getVirtualJoystickVector();
    if (joystick.x !== 0 || joystick.y !== 0) {
      x = joystick.x;
      y = joystick.y;
    }

    // Normalize diagonal movement (only for keyboard, joystick is already normalized)
    if (x !== 0 && y !== 0 && !this.virtualJoystick.active) {
      const length = Math.sqrt(x * x + y * y);
      x /= length;
      y /= length;
    }

    return { x, y };
  }

  // Check if shooting (keyboard Shift OR touch button)
  isShootingActive() {
    return this.isActionDown('shoot') || this.isShootButtonPressed();
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

  // Get joystick state for rendering
  getJoystickState() {
    return {
      active: this.virtualJoystick.active,
      centerX: this.virtualJoystick.centerX,
      centerY: this.virtualJoystick.centerY,
      currentX: this.virtualJoystick.currentX,
      currentY: this.virtualJoystick.currentY,
      radius: this.virtualJoystick.radius
    };
  }

  // Get button states for rendering
  getButtonStates() {
    return {
      shoot: this.virtualButtons.shoot.active,
      pause: this.virtualButtons.pause.active
    };
  }
}