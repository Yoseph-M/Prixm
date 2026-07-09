import React, { useEffect, useRef } from 'react';

interface FlowFieldBackgroundProps {
  color?: string;
  bgColorRgb?: string;
  trailOpacity?: number;
  particleCount?: number;
  speed?: number;
  className?: string;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  life: number;
}

export const FlowFieldBackground: React.FC<FlowFieldBackgroundProps> = ({
  color = '#818cf8',
  bgColorRgb = '0, 0, 0',
  trailOpacity = 0.15,
  particleCount = 600,
  speed = 1,
  className = '',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameIdRef = useRef<number>(0);
  const mouseRef = useRef({ x: -1000, y: -1000 });
  const particlesRef = useRef<Particle[]>([]);
  const dimensionsRef = useRef({ width: 0, height: 0 });

  const createParticle = (width: number, height: number): Particle => {
    return {
      x: Math.random() * width,
      y: Math.random() * height,
      vx: 0,
      vy: 0,
      age: 0,
      life: Math.random() * 200 + 100,
    };
  };

  const updateParticle = (p: Particle, width: number, height: number) => {
    const angle = (Math.cos(p.x * 0.005) + Math.sin(p.y * 0.005)) * Math.PI;

    p.vx += Math.cos(angle) * 0.2 * speed;
    p.vy += Math.sin(angle) * 0.2 * speed;

    const dx = mouseRef.current.x - p.x;
    const dy = mouseRef.current.y - p.y;
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
      Object.assign(p, createParticle(width, height));
    }

    if (p.x < 0) p.x = width;
    if (p.x > width) p.x = 0;
    if (p.y < 0) p.y = height;
    if (p.y > height) p.y = 0;
  };

  const drawParticle = (p: Particle, ctx: CanvasRenderingContext2D) => {
    ctx.fillStyle = color;
    const alpha = 1 - Math.abs((p.age / p.life) - 0.5) * 2;
    ctx.globalAlpha = alpha;
    ctx.fillRect(p.x, p.y, 1.5, 1.5);
  };

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const init = () => {
      const width = container.clientWidth;
      const height = container.clientHeight;
      dimensionsRef.current = { width, height };

      const dpr = window.devicePixelRatio || 1;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.scale(dpr, dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      const list: Particle[] = [];
      for (let i = 0; i < particleCount; i++) {
        list.push(createParticle(width, height));
      }
      particlesRef.current = list;
    };

    const animate = () => {
      const { width, height } = dimensionsRef.current;
      ctx.fillStyle = `rgba(${bgColorRgb}, ${trailOpacity})`;
      ctx.globalAlpha = 1;
      ctx.fillRect(0, 0, width, height);

      particlesRef.current.forEach((p) => {
        updateParticle(p, width, height);
        drawParticle(p, ctx);
      });

      animationFrameIdRef.current = requestAnimationFrame(animate);
    };

    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouseRef.current.x = e.clientX - rect.left;
      mouseRef.current.y = e.clientY - rect.top;
    };

    const handleMouseLeave = () => {
      mouseRef.current.x = -1000;
      mouseRef.current.y = -1000;
    };

    const handleResize = () => {
      init();
    };

    init();
    animate();

    container.addEventListener('mousemove', handleMouseMove);
    container.addEventListener('mouseleave', handleMouseLeave);
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animationFrameIdRef.current);
      container.removeEventListener('mousemove', handleMouseMove);
      container.removeEventListener('mouseleave', handleMouseLeave);
      window.removeEventListener('resize', handleResize);
    };
  }, [color, bgColorRgb, trailOpacity, particleCount, speed]);

  return (
    <div
      ref={containerRef}
      className={`neural-container ${className}`}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        background: 'transparent',
        overflow: 'hidden',
        zIndex: 0,
      }}
    >
      <canvas
        ref={canvasRef}
        className="neural-canvas"
        style={{
          display: 'block',
          width: '100%',
          height: '100%',
        }}
      />
    </div>
  );
};
