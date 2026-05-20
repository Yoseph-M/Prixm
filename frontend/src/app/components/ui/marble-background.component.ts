import { Component, ViewEncapsulation } from '@angular/core';
import { CommonModule, Location } from '@angular/common';

@Component({
  selector: 'app-marble-background',
  standalone: true,
  imports: [CommonModule],
  encapsulation: ViewEncapsulation.None,
  template: `
    <div class="marble-host-container">
      <div class="marble-bg-image"></div>
      
      <!-- Organic SVG Blob -->
      <svg class="marble-blob" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
        <path fill="#ffffff" d="M38.1,-60.6C47.4,-50.2,51.6,-35.1,57.1,-20.3C62.6,-5.5,69.5,9.1,66.8,21.7C64.1,34.4,51.8,45.2,38.1,51.8C24.4,58.4,9.2,60.8,-5.5,65.3C-20.2,69.7,-34.5,76.3,-45.3,69.7C-56.1,63.1,-63.4,43.3,-67.2,25.4C-71,7.5,-71.4,-8.5,-65.4,-21C-59.4,-33.5,-47.1,-42.6,-34.8,-51.7C-22.6,-60.8,-11.3,-70,2.6,-73.6C16.5,-77.1,33,-75.1,38.1,-60.6Z" transform="translate(100 100) scale(1.2)" />
      </svg>

      <!-- Back Button inside the Blob -->
      <button class="marble-back-btn" (click)="goBack()">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="19" y1="12" x2="5" y2="12"></line>
          <polyline points="12 19 5 12 12 5"></polyline>
        </svg>
      </button>
    </div>
  `,
  styles: [`
    app-marble-background {
      display: block;
      width: 100%;
      height: 100%;
      position: relative;
      overflow: hidden;
    }
    .marble-host-container {
      position: relative;
      width: 100%;
      height: 100%;
      overflow: hidden;
    }
    .marble-bg-image {
      position: absolute;
      inset: 0;
      background-image: url('https://images.unsplash.com/photo-1558865869-c93f6f8482af?q=80&w=2000&auto=format&fit=crop'); /* Marble texture */
      background-size: cover;
      background-position: center;
      z-index: 1;
    }
    .marble-blob {
      position: absolute;
      top: -30%;
      left: -30%;
      width: 120%;
      height: 120%;
      z-index: 2;
      pointer-events: none;
    }
    .marble-back-btn {
      position: absolute;
      top: 32px;
      left: 32px;
      width: 48px;
      height: 48px;
      border-radius: 50%;
      background: #ffffff;
      border: none;
      box-shadow: 0 4px 12px rgba(0,0,0,0.08);
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      z-index: 3;
      transition: all 0.2s ease;
    }
    .marble-back-btn:hover {
      transform: scale(1.05);
      box-shadow: 0 6px 16px rgba(0,0,0,0.12);
    }
  `]
})
export class MarbleBackgroundComponent {
  constructor(private location: Location) {}

  goBack() {
    this.location.back();
  }
}
