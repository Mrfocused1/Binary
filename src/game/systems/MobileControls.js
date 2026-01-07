// MobileControls.js - Visual overlay for touch controls (swipe to move, tap to shoot)

export class MobileControls {
  constructor(inputManager, canvas) {
    this.input = inputManager;
    this.canvas = canvas;

    this.pauseButton = {
      x: 0, // Set dynamically
      y: 60,
      radius: 30
    };

    // Direction indicator (shows current auto-run direction)
    this.directionIndicator = {
      x: 100,
      y: 0, // Set dynamically
      radius: 40
    };

    // Visual settings
    this.opacity = 0.4;
    this.activeOpacity = 0.7;
  }

  // Update positions based on canvas size
  updateLayout(width, height) {
    // Direction indicator in bottom-left
    this.directionIndicator.x = 80;
    this.directionIndicator.y = height - 80;

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

    // Render pause button
    this.renderPauseButton(ctx);

    // Render control hints
    this.renderHints(ctx, width, height);

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
      ctx.lineWidth = 3;
      ctx.stroke();

      // Arrow head
      const angle = Math.atan2(swipeState.y, swipeState.x);
      const headSize = 10;
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
    } else {
      // Show icon when not moving
      ctx.font = 'bold 12px Arial';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('MOVE', ind.x, ind.y);
    }
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

  renderHints(ctx, width, height) {
    const swipeState = this.input.getSwipeState();

    ctx.font = '11px Arial';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.textAlign = 'center';

    // Bottom hints
    if (swipeState.active) {
      ctx.fillText('Double-tap to stop', width / 2, height - 15);
    } else {
      ctx.fillText('Swipe to move • Tap to shoot', width / 2, height - 15);
    }
  }
}
