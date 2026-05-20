import { Component, ElementRef, Input, ViewChild, AfterViewInit, OnDestroy, HostListener, Inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';

@Component({
  selector: 'app-flow-field-background',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div #container class="neural-container">
      <canvas #canvas class="neural-canvas"></canvas>
    </div>
  `,
  styles: [`
    .neural-container {
      position: absolute;
      top: 0; left: 0;
      width: 100%; height: 100%;
      background: transparent;
      overflow: hidden;
      z-index: 0;
    }
    .neural-canvas {
      display: block;
      width: 100%;
      height: 100%;
    }
  `]
})
export class FlowFieldBackgroundComponent implements AfterViewInit, OnDestroy {
  @ViewChild('canvas') canvasRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('container') containerRef!: ElementRef<HTMLDivElement>;

  @Input() color: string = '#818cf8';
  @Input() bgColorRgb: string = '0, 0, 0';
  @Input() trailOpacity: number = 0.15;
  @Input() particleCount: number = 600;
  @Input() speed: number = 1;

  private animationFrameId: number = 0;
  private particles: any[] = [];
  private width: number = 0;
  private height: number = 0;
  private mouse = { x: -1000, y: -1000 };
  private ctx: CanvasRenderingContext2D | null = null;
  private isBrowser: boolean;

  constructor(@Inject(PLATFORM_ID) platformId: Object) {
    this.isBrowser = isPlatformBrowser(platformId);
  }

  ngAfterViewInit() {
    if (!this.isBrowser) return;
    
    this.ctx = this.canvasRef.nativeElement.getContext('2d');
    if (!this.ctx) return;

    this.init();
    this.animate();
  }

  ngOnDestroy() {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
    if (this.isBrowser && this.containerRef) {
      const container = this.containerRef.nativeElement;
      container.removeEventListener("mousemove", this.onMouseMove);
      container.removeEventListener("mouseleave", this.onMouseLeave);
    }
  }

  @HostListener('window:resize')
  onResize() {
    if (this.isBrowser && this.containerRef) {
      this.init();
    }
  }

  private onMouseMove = (e: MouseEvent) => {
    if (!this.canvasRef) return;
    const rect = this.canvasRef.nativeElement.getBoundingClientRect();
    this.mouse.x = e.clientX - rect.left;
    this.mouse.y = e.clientY - rect.top;
  }

  private onMouseLeave = () => {
    this.mouse.x = -1000;
    this.mouse.y = -1000;
  }

  private init() {
    const container = this.containerRef.nativeElement;
    const canvas = this.canvasRef.nativeElement;
    
    this.width = container.clientWidth;
    this.height = container.clientHeight;
    
    const dpr = window.devicePixelRatio || 1;
    canvas.width = this.width * dpr;
    canvas.height = this.height * dpr;
    if (this.ctx) {
      this.ctx.scale(dpr, dpr);
    }
    canvas.style.width = `${this.width}px`;
    canvas.style.height = `${this.height}px`;

    this.particles = [];
    for (let i = 0; i < this.particleCount; i++) {
      this.particles.push(this.createParticle());
    }

    container.addEventListener("mousemove", this.onMouseMove);
    container.addEventListener("mouseleave", this.onMouseLeave);
  }

  private createParticle() {
    return {
      x: Math.random() * this.width,
      y: Math.random() * this.height,
      vx: 0,
      vy: 0,
      age: 0,
      life: Math.random() * 200 + 100
    };
  }

  private updateParticle(p: any) {
    const angle = (Math.cos(p.x * 0.005) + Math.sin(p.y * 0.005)) * Math.PI;
    
    p.vx += Math.cos(angle) * 0.2 * this.speed;
    p.vy += Math.sin(angle) * 0.2 * this.speed;

    const dx = this.mouse.x - p.x;
    const dy = this.mouse.y - p.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const interactionRadius = 150;

    if (distance < interactionRadius) {
      const force = (interactionRadius - distance) / interactionRadius;
      p.vx -= dx * force * 0.05;
      p.vy -= dy * force * 0.05;
    }

    p.x += p.vx;
    p.y += p.vy;
    p.vx *= 0.95;
    p.vy *= 0.95;

    p.age++;
    if (p.age > p.life) {
      Object.assign(p, this.createParticle());
    }

    if (p.x < 0) p.x = this.width;
    if (p.x > this.width) p.x = 0;
    if (p.y < 0) p.y = this.height;
    if (p.y > this.height) p.y = 0;
  }

  private drawParticle(p: any, ctx: CanvasRenderingContext2D) {
    ctx.fillStyle = this.color;
    const alpha = 1 - Math.abs((p.age / p.life) - 0.5) * 2;
    ctx.globalAlpha = alpha;
    ctx.fillRect(p.x, p.y, 1.5, 1.5);
  }

  private animate = () => {
    if (!this.ctx) return;
    this.ctx.fillStyle = `rgba(${this.bgColorRgb}, ${this.trailOpacity})`; 
    this.ctx.fillRect(0, 0, this.width, this.height);

    this.particles.forEach((p) => {
      this.updateParticle(p);
      this.drawParticle(p, this.ctx!);
    });

    this.animationFrameId = requestAnimationFrame(this.animate);
  }
}
