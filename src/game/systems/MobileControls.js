// MobileControls.js - Visual overlay for touch controls (swipe-based movement)

export class MobileControls {
  constructor(inputManager, canvas) {
    this.input = inputManager;
    this.canvas = canvas;

    // Shoot button position (set based on canvas size)
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

    // Direction indicator (shows current auto-run direction)
    this.directionIndicator = {
      x: 120,
      y: 0, // Set dynamically
      radius: 50
    };

    // Visual settings
    this.opacity = 0.4;
    this.activeOpacity = 0.7;
  }

  // Update positions based on canvas size
  updateLayout(width, height) {
    // Direction indicator in bottom-left
    this.directionIndicator.x = 100;
    this.directionIndicator.y = height - 100;

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

    // Render direction indicator
    this.renderDirectionIndicator(ctx);

    // Render shoot button
    this.renderShootButton(ctx);

    // Render pause button
    this.renderPauseButton(ctx);

    // Render swipe hint if not moving
    this.renderSwipeHint(ctx, width, height);

    ctx.restore();
  }

  renderDirectionIndicator(ctx) {
    const swipeState = this.input.getSwipeState();
    const ind = this.directionIndicator;

    // Draw outer circle
    ctx.beginPath();
    ctx.arc(ind.x, ind.y, ind.radius, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255, 255, 255, ${swipeState.active ? this.activeOpacity : this.opacity * 0.5})`;
    ctx.fill();
    ctx.strokeStyle = `rgba(255, 255, 255, ${swipeState.active ? 0.9 : 0.4})`;
    ctx.lineWidth = 2;
    ctx.stroke();

    if (swipeState.active) {
      // Draw direction arrow
      const arrowLength = ind.radius * 0.7;
      const arrowX = ind.x + swipeState.x * arrowLength;
      const arrowY = ind.y + swipeState.y * arrowLength;

      // Arrow line
      ctx.beginPath();
      ctx.moveTo(ind.x, ind.y);
      ctx.lineTo(arrowX, arrowY);
      ctx.strokeStyle = 'rgba(0, 255, 100, 0.9)';
      ctx.lineWidth = 4;
      ctx.stroke();

      // Arrow head
      const angle = Math.atan2(swipeState.y, swipeState.x);
      const headSize = 12;
      ctx.beginPath();
      ctx.moveTo(arrowX, arrowY);
      ctx.lineTo(
        arrowX - headSize * Math.cos(angle - Math.PI / 6),
        arrowY - headSize * Math.sin(angle - Math.PI / 6)
      );
      ctx.lineTo(
        arrowX - headSize * Math.cos(angle + Math.PI / 6),
        arrowY - headSize * Math.sin(angle + Math.PI / 6)
      );
      ctx.closePath();
      ctx.fillStyle = 'rgba(0, 255, 100, 0.9)';
      ctx.fill();

      // "RUNNING" label
      ctx.font = 'bold 10px Arial';
      ctx.fillStyle = 'rgba(0, 255, 100, 0.9)';
      ctx.textAlign = 'center';
      ctx.fillText('RUNNING', ind.x, ind.y + ind.radius + 15);
    } else {
      // Show "SWIPE" text when not moving
      ctx.font = 'bold 14px Arial';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('SWIPE', ind.x, ind.y);

      // Label below
      ctx.font = '10px Arial';
      ctx.fillText('to move', ind.x, ind.y + ind.radius + 15);
    }
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

  renderSwipeHint(ctx, width, height) {
    const swipeState = this.input.getSwipeState();

    // Only show hint when not moving
    if (swipeState.active) return;

    // Show "Double-tap to stop" hint at bottom center
    ctx.font = '12px Arial';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.textAlign = 'center';
    ctx.fillText('Double-tap to stop', width / 2, height - 20);
  }
}
