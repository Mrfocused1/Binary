// MobileControls.js - Visual overlay for touch controls

export class MobileControls {
  constructor(inputManager, canvas) {
    this.input = inputManager;
    this.canvas = canvas;

    // Control positions (set based on canvas size)
    this.joystickBase = {
      x: 120,
      y: 0, // Set dynamically
      radius: 60
    };

    this.shootButton = {
      x: 0, // Set dynamically
      y: 0, // Set dynamically
      radius: 50
    };

    this.pauseButton = {
      x: 0, // Set dynamically
      y: 60,
      radius: 30
    };

    // Visual settings
    this.opacity = 0.4;
    this.activeOpacity = 0.7;
  }

  // Update positions based on canvas size
  updateLayout(width, height) {
    // Joystick in bottom-left
    this.joystickBase.x = 120;
    this.joystickBase.y = height - 120;

    // Shoot button in bottom-right
    this.shootButton.x = width - 100;
    this.shootButton.y = height - 120;

    // Pause button in top-right
    this.pauseButton.x = width - 50;
    this.pauseButton.y = 50;
  }

  render(ctx, width, height) {
    // Only render on mobile/touch devices
    if (!this.input.isMobile && !this.input.hasActiveTouch()) {
      return;
    }

    this.updateLayout(width, height);

    ctx.save();

    // Render joystick
    this.renderJoystick(ctx);

    // Render shoot button
    this.renderShootButton(ctx);

    // Render pause button
    this.renderPauseButton(ctx);

    ctx.restore();
  }

  renderJoystick(ctx) {
    const joystickState = this.input.getJoystickState();
    const base = this.joystickBase;

    // Draw outer ring (base)
    ctx.beginPath();
    ctx.arc(base.x, base.y, base.radius, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255, 255, 255, ${joystickState.active ? this.activeOpacity : this.opacity})`;
    ctx.fill();
    ctx.strokeStyle = `rgba(255, 255, 255, ${joystickState.active ? 0.9 : 0.6})`;
    ctx.lineWidth = 3;
    ctx.stroke();

    // Draw direction indicators
    ctx.fillStyle = `rgba(150, 150, 150, ${this.opacity})`;
    const indicatorSize = 10;

    // Up arrow
    ctx.beginPath();
    ctx.moveTo(base.x, base.y - base.radius + 15);
    ctx.lineTo(base.x - indicatorSize, base.y - base.radius + 25);
    ctx.lineTo(base.x + indicatorSize, base.y - base.radius + 25);
    ctx.closePath();
    ctx.fill();

    // Down arrow
    ctx.beginPath();
    ctx.moveTo(base.x, base.y + base.radius - 15);
    ctx.lineTo(base.x - indicatorSize, base.y + base.radius - 25);
    ctx.lineTo(base.x + indicatorSize, base.y + base.radius - 25);
    ctx.closePath();
    ctx.fill();

    // Left arrow
    ctx.beginPath();
    ctx.moveTo(base.x - base.radius + 15, base.y);
    ctx.lineTo(base.x - base.radius + 25, base.y - indicatorSize);
    ctx.lineTo(base.x - base.radius + 25, base.y + indicatorSize);
    ctx.closePath();
    ctx.fill();

    // Right arrow
    ctx.beginPath();
    ctx.moveTo(base.x + base.radius - 15, base.y);
    ctx.lineTo(base.x + base.radius - 25, base.y - indicatorSize);
    ctx.lineTo(base.x + base.radius - 25, base.y + indicatorSize);
    ctx.closePath();
    ctx.fill();

    // Draw inner stick
    let stickX = base.x;
    let stickY = base.y;

    if (joystickState.active) {
      // Calculate stick position based on touch
      const dx = joystickState.currentX - joystickState.centerX;
      const dy = joystickState.currentY - joystickState.centerY;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const maxDistance = base.radius - 15;

      if (distance > 0) {
        const clampedDistance = Math.min(distance, maxDistance);
        stickX = base.x + (dx / distance) * clampedDistance;
        stickY = base.y + (dy / distance) * clampedDistance;
      }
    }

    // Inner stick
    ctx.beginPath();
    ctx.arc(stickX, stickY, 25, 0, Math.PI * 2);
    ctx.fillStyle = joystickState.active ? 'rgba(0, 200, 255, 0.9)' : 'rgba(100, 100, 100, 0.8)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Label
    ctx.font = '12px Arial';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.textAlign = 'center';
    ctx.fillText('MOVE', base.x, base.y + base.radius + 20);
  }

  renderShootButton(ctx) {
    const btn = this.shootButton;
    const isActive = this.input.isShootButtonPressed();

    // Outer glow when active
    if (isActive) {
      ctx.beginPath();
      ctx.arc(btn.x, btn.y, btn.radius + 10, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 100, 100, 0.3)';
      ctx.fill();
    }

    // Button circle
    ctx.beginPath();
    ctx.arc(btn.x, btn.y, btn.radius, 0, Math.PI * 2);
    ctx.fillStyle = isActive ? 'rgba(255, 50, 50, 0.9)' : `rgba(255, 100, 100, ${this.opacity})`;
    ctx.fill();
    ctx.strokeStyle = isActive ? 'rgba(255, 255, 255, 1)' : 'rgba(255, 255, 255, 0.6)';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Crosshair icon
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.lineWidth = 2;

    // Horizontal line
    ctx.beginPath();
    ctx.moveTo(btn.x - 20, btn.y);
    ctx.lineTo(btn.x + 20, btn.y);
    ctx.stroke();

    // Vertical line
    ctx.beginPath();
    ctx.moveTo(btn.x, btn.y - 20);
    ctx.lineTo(btn.x, btn.y + 20);
    ctx.stroke();

    // Center dot
    ctx.beginPath();
    ctx.arc(btn.x, btn.y, 4, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.fill();

    // Label
    ctx.font = '12px Arial';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.textAlign = 'center';
    ctx.fillText('SHOOT', btn.x, btn.y + btn.radius + 20);
  }

  renderPauseButton(ctx) {
    const btn = this.pauseButton;
    const isActive = this.input.isPauseButtonPressed();

    // Button circle
    ctx.beginPath();
    ctx.arc(btn.x, btn.y, btn.radius, 0, Math.PI * 2);
    ctx.fillStyle = isActive ? 'rgba(255, 200, 50, 0.9)' : `rgba(255, 255, 255, ${this.opacity})`;
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Pause bars
    ctx.fillStyle = 'rgba(50, 50, 50, 0.9)';
    ctx.fillRect(btn.x - 10, btn.y - 10, 6, 20);
    ctx.fillRect(btn.x + 4, btn.y - 10, 6, 20);
  }
}
