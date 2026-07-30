"use client";

import { useEffect, useRef } from "react";

interface ProceduralPortalProps {
  onComplete: () => void;
  style?: React.CSSProperties;
}

export default function ProceduralPortal({ onComplete, style }: ProceduralPortalProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    // Setup dimensions and resizing
    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener("resize", handleResize);

    // Timing and Animation Constants
    const duration = 1600; // Total portal animation duration in ms
    const startTime = Date.now();
    const focalLength = 300;
    const speed = 0.35; // Speed of movement through the tunnel
    const maxZ = 1200; // Deep Z-axis depth

    // 1. Concentric Hexagons Initialization (Reduced count to 8 for a bolder, less dense look)
    const hexCount = 8;
    const hexagons: { z: number; rotation: number }[] = [];
    for (let i = 0; i < hexCount; i++) {
      hexagons.push({
        z: (i * (maxZ / hexCount)) + 1,
        rotation: (i * Math.PI) / 18, // Twist rotation offset
      });
    }

    // Helper: Get hexagon vertices in 3D, rotated around Z-axis
    const getHexVertices = (radius: number, rotation: number, cx: number, cy: number) => {
      const vertices = [];
      for (let i = 0; i < 6; i++) {
        const angle = (i * Math.PI) / 3 + rotation;
        vertices.push({
          x: cx + Math.cos(angle) * radius,
          y: cy + Math.sin(angle) * radius,
        });
      }
      return vertices;
    };

    // Render loop variables
    let frame = 0;
    let glitchActive = false;
    let glitchType = 0; // 0: chromatic, 1: shake, 2: pixel-slice
    let glitchFrameCounter = 0;

    // Main Draw Function
    const render = () => {
      frame++;
      const elapsed = Date.now() - startTime;

      if (elapsed >= duration) {
        onComplete();
        return;
      }

      // Glitch State Manager
      if (!glitchActive && Math.random() < 0.08) {
        glitchActive = true;
        glitchType = Math.floor(Math.random() * 3);
        glitchFrameCounter = Math.floor(Math.random() * 3) + 2;
      } else if (glitchActive) {
        glitchFrameCounter--;
        if (glitchFrameCounter <= 0) {
          glitchActive = false;
        }
      }

      // Clear Screen (transparent to allow loader_bg.svg to show through)
      ctx.clearRect(0, 0, width, height);

      // Render Ambient Purple/Magenta space dust background (Image_24.png style)
      ctx.fillStyle = "rgba(18, 5, 28, 0.22)";
      ctx.fillRect(0, 0, width, height);

      // Apply screen shake glitch
      let cx = width / 2;
      let cy = height / 2;
      if (glitchActive && glitchType === 1) {
        cx += (Math.random() - 0.5) * 24;
        cy += (Math.random() - 0.5) * 24;
      }

      // Draw Scene helper (so we can draw twice for chromatic aberration shift)
      const drawScene = (offsetX: number, offsetY: number, colorOverride?: string) => {
        ctx.save();
        ctx.translate(offsetX, offsetY);

        // 2. Draw Background Web/Grid (cyan and magenta thin grids)
        const webColors = ["rgba(0, 229, 255, 0.06)", "rgba(255, 0, 127, 0.06)"];
        ctx.lineWidth = 1.0;
        
        // Draw diagonal web rays
        const corners = [
          { x: 0, y: 0 },
          { x: width, y: 0 },
          { x: width, y: height },
          { x: 0, y: height },
        ];
        
        ctx.strokeStyle = colorOverride || webColors[0];
        corners.forEach((c) => {
          ctx.beginPath();
          ctx.moveTo(cx, cy);
          ctx.lineTo(c.x, c.y);
          ctx.stroke();
        });

        // Draw web rings in corners
        ctx.strokeStyle = colorOverride || webColors[1];
        for (let r = 1; r <= 6; r++) {
          const radius = r * 110;
          ctx.beginPath();
          ctx.arc(cx, cy, radius, 0, Math.PI * 2);
          ctx.stroke();
        }

        // 3. Pre-calculate projected Hexagons vertices and thickness
        // We sort hexagons by depth Z descending (so we draw far to close)
        const sortedHexagons = [...hexagons].sort((a, b) => b.z - a.z);
        const projectedHexagons = sortedHexagons.map((hex) => {
          const z = hex.z;
          const radiusBase = 450;
          
          // Non-linear projection scale for tight central vortex
          const scale = Math.pow(focalLength / z, 1.75);
          const r = radiusBase * scale;

          // Increase thickness significantly (baseWidth = 55px, at least 3x the old width)
          const baseWidth = 55;
          const thickness = Math.max(1.5, baseWidth * scale);

          const vertices = getHexVertices(r, hex.rotation, cx, cy);

          return {
            z,
            r,
            thickness,
            vertices,
            rotation: hex.rotation,
          };
        });

        // 4. Draw 3D Wireframe Corner Grid Lines (Connects hexagon corners across depth)
        ctx.strokeStyle = colorOverride || "rgba(255, 106, 0, 0.12)";
        ctx.lineWidth = 0.8;
        for (let i = 0; i < projectedHexagons.length - 1; i++) {
          const hex1 = projectedHexagons[i];
          const hex2 = projectedHexagons[i + 1];

          if (hex1.r <= 5 || hex2.r <= 5) continue;

          for (let k = 0; k < 6; k++) {
            ctx.beginPath();
            ctx.moveTo(hex1.vertices[k].x, hex1.vertices[k].y);
            ctx.lineTo(hex2.vertices[k].x, hex2.vertices[k].y);
            ctx.stroke();
          }
        }

        // Helper to path a hexagon
        const pathHex = (pts: { x: number; y: number }[]) => {
          ctx.beginPath();
          ctx.moveTo(pts[0].x, pts[0].y);
          for (let i = 1; i < 6; i++) {
            ctx.lineTo(pts[i].x, pts[i].y);
          }
          ctx.closePath();
        };

        // 5. Draw Hexagonal Loops (Thick, glowing orange-red texture style)
        projectedHexagons.forEach((hex) => {
          if (hex.r <= 2) return;

          const thickness = hex.thickness;
          const r = hex.r;

          // Color palette matching image_24.png: glowing orange-red
          const baseColor = colorOverride || "#E62E00";  // Solid deep orange-red body
          const glowColor = colorOverride || "#FF4500";  // Bright neon red-orange glow
          const coreColor = colorOverride || "#FFE270";  // Bright yellow-gold center highlight

          // 5a. Broad glowing background glow
          ctx.save();
          ctx.lineWidth = thickness * 2.2;
          ctx.strokeStyle = glowColor;
          ctx.globalAlpha = 0.22;
          pathHex(hex.vertices);
          ctx.stroke();
          ctx.restore();

          // 5b. Solid band body (The main 50px thick structure)
          ctx.save();
          ctx.lineWidth = thickness;
          ctx.strokeStyle = baseColor;
          ctx.shadowColor = glowColor;
          ctx.shadowBlur = Math.min(25, thickness * 1.2);
          pathHex(hex.vertices);
          ctx.stroke();
          ctx.restore();

          // 5c. Core Highlight (Golden/yellow center stripe)
          ctx.save();
          ctx.lineWidth = thickness * 0.35;
          ctx.strokeStyle = coreColor;
          pathHex(hex.vertices);
          ctx.stroke();
          ctx.restore();

          // 5d. Internal Wireframe outline border (thin white/yellow lines on edges for structured detail)
          ctx.strokeStyle = colorOverride || "rgba(255, 255, 255, 0.25)";
          ctx.lineWidth = 0.8;
          
          // Outer border
          const outerVerts = getHexVertices(r + thickness / 2, hex.rotation, cx, cy);
          pathHex(outerVerts);
          ctx.stroke();

          // Inner border
          const innerVerts = getHexVertices(r - thickness / 2, hex.rotation, cx, cy);
          pathHex(innerVerts);
          ctx.stroke();
        });

        // 6. Draw Diagonal Speed Light Streaks (Fading yellow rays)
        const streakCount = 8;
        ctx.strokeStyle = colorOverride || "rgba(255, 226, 112, 0.4)";
        ctx.lineWidth = 2.0;

        for (let j = 0; j < streakCount; j++) {
          const angle = j * (Math.PI / 4) + Math.sin(frame * 0.04 + j) * 0.08;
          const lenInner = 80 + Math.sin(frame * 0.08 + j) * 20;
          const lenOuter = 450 + Math.sin(frame * 0.06 + j) * 120;

          const startX = cx + Math.cos(angle) * lenInner;
          const startY = cy + Math.sin(angle) * lenInner;
          const endX = cx + Math.cos(angle) * lenOuter;
          const endY = cy + Math.sin(angle) * lenOuter;

          // Draw neon speed line
          ctx.save();
          ctx.shadowColor = "#FFAE00";
          ctx.shadowBlur = 8;
          ctx.beginPath();
          ctx.moveTo(startX, startY);
          ctx.lineTo(endX, endY);
          ctx.stroke();
          ctx.restore();
        }

        ctx.restore();
      };

      // 7. Chromatic Aberration Drawing Pass
      if (glitchActive && glitchType === 0) {
        // Red Shift Pass
        ctx.globalCompositeOperation = "screen";
        drawScene(-6, 0, "#FF007F"); // Hot Magenta / Red offset

        // Blue / Cyan Shift Pass
        drawScene(6, 0, "#00F0FF"); // Cyan offset
        ctx.globalCompositeOperation = "source-over";
      } else {
        // Normal Drawing Pass
        drawScene(0, 0);
      }

      // 8. Horizontal Screen Slice Glitch (Pixel-shifting bands)
      if (glitchActive && glitchType === 2 && frame % 2 === 0) {
        const sliceCount = 6;
        for (let i = 0; i < sliceCount; i++) {
          const sliceY = Math.random() * height;
          const sliceH = 15 + Math.random() * 50;
          const shiftX = (Math.random() - 0.5) * 36;
          ctx.drawImage(
            canvas,
            0,
            sliceY,
            width,
            sliceH,
            shiftX,
            sliceY,
            width,
            sliceH
          );
        }

        // Draw random solid neon interference stripes
        ctx.fillStyle = Math.random() > 0.5 ? "rgba(0, 240, 255, 0.45)" : "rgba(255, 0, 127, 0.45)";
        ctx.fillRect(0, Math.random() * height, width, 4 + Math.random() * 8);
      }

      // Update positions for the next frame
      // Update Hexagons
      hexagons.forEach((hex) => {
        hex.z -= speed * 16.67; // animate based on 60fps delta
        hex.rotation += 0.003; // rotating warp effect
        if (hex.z <= 0) {
          hex.z = maxZ;
        }
      });

      animationId = requestAnimationFrame(render);
    };

    // Begin Animation Loop
    render();

    // Cleanups
    return () => {
      window.removeEventListener("resize", handleResize);
      cancelAnimationFrame(animationId);
    };
  }, [onComplete]);

  return (
    <div
      ref={containerRef}
      style={{
        position: "relative",
        backgroundColor: "#0A0A0A",
        overflow: "hidden",
        ...style,
      }}
    >
      {/* 9. Interactive Halftone Grid Screen CSS Overlay */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: "radial-gradient(circle, rgba(0, 0, 0, 0.28) 1.2px, transparent 1.3px)",
          backgroundSize: "4px 4px",
          pointerEvents: "none",
          zIndex: 15,
          opacity: 0.85,
        }}
      />
      <canvas
        ref={canvasRef}
        style={{
          display: "block",
          width: "100%",
          height: "100%",
        }}
      />
    </div>
  );
}
