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
      this.touches.set(touch.identifier, {
        x: touch.clientX,
        y: touch.clientY,
        startX: touch.clientX,
        startY: touch.clientY
      });
    }
  }
  
  handleTouchEnd(event) {
    event.preventDefault();
    for (const touch of event.changedTouches) {
      this.touches.delete(touch.identifier);
    }
  }
  
  handleTouchMove(event) {
    event.preventDefault();
    for (const touch of event.changedTouches) {
      if (this.touches.has(touch.identifier)) {
        const touchData = this.touches.get(touch.identifier);
        touchData.x = touch.clientX;
        touchData.y = touch.clientY;
      }
    }
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
}