"use client";

import { useEffect, useRef } from "react";

interface SpiderWebTunnelProps {
  style?: React.CSSProperties;
}

export default function SpiderWebTunnel({ style }: SpiderWebTunnelProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationId: number;

    // Cap devicePixelRatio to Math.min(dpr, 2) to optimize fill rate on high-DPI screens
    const getDpr = () => Math.min(window.devicePixelRatio || 1, 2);

    let dpr = getDpr();
    let width = window.innerWidth;
    let height = window.innerHeight;

    // Set canvas dimensions
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    // Resize Handler
    const handleResize = () => {
      if (!canvas) return;
      dpr = getDpr();
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.scale(dpr, dpr);
    };
    window.addEventListener("resize", handleResize);

    // Animation variables
    const focalLength = 300;
    const speed = 0.08; // Smooth, steady expansion speed
    const maxZ = 1000;
    const webCount = 7; // Number of concentric spider-web loops

    // Concentric spider-web loops state
    const webLoops: { z: number; rotation: number }[] = [];
    for (let i = 0; i < webCount; i++) {
      webLoops.push({
        z: (i * (maxZ / webCount)) + 1,
        rotation: (i * Math.PI) / 36, // Slight twist rotation offset per loop
      });
    }

    // 1. Path Cache: Pre-render Unit Web Ring Path (Octagonal sagging segments at radius 1.0)
    // This avoids running Math.cos/sin and quadraticCurveTo calculations on every frame.
    const unitWebRing = new Path2D();
    const segments = 8;
    const sagFactor = 0.91;

    unitWebRing.moveTo(Math.cos(0), Math.sin(0));
    for (let k = 0; k < segments; k++) {
      const theta1 = k * (Math.PI / 4);
      const theta2 = (k + 1) * (Math.PI / 4);
      const p2X = Math.cos(theta2);
      const p2Y = Math.sin(theta2);

      // Control point in the middle, sagging inwards
      const midAngle = (theta1 + theta2) / 2;
      const cpX = Math.cos(midAngle) * sagFactor;
      const cpY = Math.sin(midAngle) * sagFactor;

      unitWebRing.quadraticCurveTo(cpX, cpY, p2X, p2Y);
    }

    // Helper: Draw the web ring using the cached Path2D
    const drawWebRing = (
      cx: number,
      cy: number,
      r: number,
      rotation: number,
      color: string,
      lineWidth: number
    ) => {
      ctx.save();
      ctx.strokeStyle = color;
      ctx.translate(cx, cy);
      ctx.rotate(rotation);
      ctx.scale(r, r);
      // Scale lineWidth inversely to scale factors to maintain target line size in canvas space
      ctx.lineWidth = lineWidth / r;
      ctx.stroke(unitWebRing);
      ctx.restore();
    };

    let frame = 0;
    let glitchActive = false;
    let glitchFrameCounter = 0;

    // Render loop
    const render = () => {
      frame++;

      // Periodic glitch triggers for chromatic aberration
      if (!glitchActive && Math.random() < 0.04) {
        glitchActive = true;
        glitchFrameCounter = Math.floor(Math.random() * 3) + 2; // Glitch for 2-4 frames
      } else if (glitchActive) {
        glitchFrameCounter--;
        if (glitchFrameCounter <= 0) {
          glitchActive = false;
        }
      }

      // Clear Screen (using logical bounds scaled by context dpr)
      ctx.fillStyle = "#070708";
      ctx.fillRect(0, 0, width, height);

      // Subtle ambient violet gradient overlay
      const gradient = ctx.createRadialGradient(
        width / 2,
        height / 2,
        10,
        width / 2,
        height / 2,
        width * 0.8
      );
      gradient.addColorStop(0, "rgba(22, 6, 36, 0.45)");
      gradient.addColorStop(1, "rgba(0, 0, 0, 0.85)");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);

      const cx = width / 2;
      const cy = height / 2;

      // Draw Scene function (to render chromatic shift splits)
      const drawScene = (offsetX: number, offsetY: number, colorOverride?: string) => {
        ctx.save();
        ctx.translate(offsetX, offsetY);

        // 2. Draw static 8 radial web rays
        const rayCount = 8;
        ctx.lineWidth = 0.8;
        ctx.strokeStyle = colorOverride || "rgba(255, 255, 255, 0.12)";
        
        const maxRadius = Math.max(width, height);
        for (let k = 0; k < rayCount; k++) {
          const angle = k * (Math.PI / 4);
          ctx.beginPath();
          ctx.moveTo(cx, cy);
          ctx.lineTo(cx + Math.cos(angle) * maxRadius, cy + Math.sin(angle) * maxRadius);
          ctx.stroke();
        }

        // 3. Draw Concentric Sagging Web Loops using cached Path2D
        webLoops.forEach((loop) => {
          const z = loop.z;
          const radiusBase = 480;

          // Non-linear projection scale for deep perspective
          const scale = Math.pow(focalLength / z, 1.45);
          const r = radiusBase * scale;

          if (r <= 2) return;

          const strokeColor = colorOverride || `rgba(255, 255, 255, ${Math.min(0.5, 0.65 * scale)})`;
          const thickness = Math.max(0.6, 1.4 * scale);

          drawWebRing(cx, cy, r, loop.rotation, strokeColor, thickness);
        });

        ctx.restore();
      };

      // Render with Chromatic Aberration Glitches
      if (glitchActive && frame % 2 === 0) {
        ctx.globalCompositeOperation = "screen";
        drawScene(-3, 0, "rgba(255, 0, 127, 0.6)"); // Magenta Shift
        drawScene(3, 0, "rgba(0, 240, 255, 0.6)"); // Cyan Shift
        ctx.globalCompositeOperation = "source-over";
      } else {
        drawScene(0, 0);
      }

      // Update positions
      webLoops.forEach((loop) => {
        loop.z -= speed * 16.67; // Move forward in Z depth
        loop.rotation += 0.0006; // Very slow rotation twist
        if (loop.z <= 0) {
          loop.z = maxZ; // Loop back
        }
      });

      animationId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener("resize", handleResize);
      cancelAnimationFrame(animationId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        display: "block",
        width: "100%",
        height: "100%",
        willChange: "transform, opacity",
        transform: "translateZ(0)",
        backfaceVisibility: "hidden",
        ...style,
      }}
    />
  );
}
