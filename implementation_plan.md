# Spider-Verse Symposium Website — Implementation Plan

Building a jaw-dropping Spider-Verse themed symposium website with a dimensional portal loading screen and 3D parallax hero section.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js (App Router, TypeScript) |
| Styling | Tailwind CSS v4 + custom CSS for effects |
| Animation | GSAP + ScrollTrigger |
| Smooth Scroll | Lenis |
| 3D Centerpiece | Three.js (rotating spider emblem) |
| Effects | CSS `clip-path`, `mix-blend-mode`, SVG filters |
| Fonts | Google Fonts: Bangers (primary display/hero title), Anton (secondary display/section headers), Space Grotesk (body) |

---

## Proposed Changes

### 1. Project Foundation & Design System

#### [MODIFY] [tailwind.config.ts](file:///c:/Users/MELDAN ROY/Desktop/xplore'26/spider-verse-symposium/tailwind.config.ts)
- Extend theme with Spider-Verse color palette (Spider Red, Web Blue, Ink Black, Paper White, Glitch Cyan)
- Add custom font families and roles:
  - `font-display` → Bangers (hero title, big comic-energy moments)
  - `font-heading` → Anton (section headers, nav, smaller condensed headings)
  - `font-body` → Space Grotesk (paragraph text, event/sponsor descriptions — stays calm and readable)
  - `font-accent` (optional) → Bangers reused, or Rubik Mono One for small comic-style tag/label stickers ("REGISTER NOW", "EVENT")
- Add custom animation keyframes for glitch effects

#### [MODIFY] [globals.css](file:///c:/Users/MELDAN ROY/Desktop/xplore'26/spider-verse-symposium/src/app/globals.css)
- CSS custom properties for the color system
- Halftone dot texture patterns (SVG-based CSS backgrounds)
- Chromatic aberration filter definitions
- Glitch keyframe animations
- Comic panel border utilities
- Noise texture overlay

#### [MODIFY] [layout.tsx](file:///c:/Users/MELDAN ROY/Desktop/xplore'26/spider-verse-symposium/src/app/layout.tsx)
- Import Google Fonts (Bangers, Anton, Space Grotesk) via `next/font/google`
- Set up Lenis smooth scrolling provider
- Dark theme meta tags and SEO
- Add `prefers-reduced-motion` media query handling at the root level — disable/shorten GSAP timelines and parallax transforms for users with reduced-motion preference set

---

### 2. Loading Screen — "Dimensional Portal Rip"

#### [NEW] [LoadingScreen.tsx](file:///c:/Users/MELDAN ROY/Desktop/xplore'26/spider-verse-symposium/src/components/LoadingScreen.tsx)
- Fixed-position overlay covering entire viewport
- GSAP timeline (~1.5s fixed duration):
  1. Black screen with noise texture (300ms)
  2. Horizontal crack with RGB channel split via CSS filter
  3. Jagged `clip-path` tear animation (snapping between 2-3 polygon states)
  4. Hero scene visible through widening tear
  5. Halftone-dot fringe on tear edges
  6. 2-3 rapid glitch-flicker frames then resolve
  7. Spider-web crack SVG radiating from center
- Remove from DOM after completion
- No dependency on network — purely timed
- **Skip on repeat visits**: check a `localStorage` flag (e.g. `hasSeenIntro`) — play the full portal-rip sequence once per session/first visit, skip straight to hero on subsequent loads within the same session so it doesn't annoy repeat visitors or symposium-day reviewers reloading the page
- **Click-to-skip**: allow a click/tap anywhere during the sequence to fast-forward to the hero
- **Respect `prefers-reduced-motion`**: if set, skip the glitch/tear animation entirely and fade directly to the hero

---

### 3. Hero Section — "3D Parallax City"

#### [NEW] [HeroSection.tsx](file:///c:/Users/MELDAN ROY/Desktop/xplore'26/spider-verse-symposium/src/components/HeroSection.tsx)
- Container for all parallax layers
- Mouse-move event handler → GSAP parallax transforms (15-30px range per layer)
- Mobile: disable mousemove, use gentle auto-parallax loop
- Manages GSAP ScrollTrigger for scroll-based reveals
- `prefers-reduced-motion`: disable mousemove parallax and auto-loop entirely, show static layered layout

#### [NEW] [CityParallax.tsx](file:///c:/Users/MELDAN ROY/Desktop/xplore'26/spider-verse-symposium/src/components/CityParallax.tsx)
- **Background layer**: NYC skyline silhouette SVG, Web Blue → Ink Black gradient sky
- **Mid layer**: Closer building silhouettes with halftone dot texture on shadowed sides
- **Foreground layer**: Spider silhouette on web-line (CSS animation loop)
- **Ambient particles**: Slow-drifting halftone dots (low opacity, far background)
- All layers as inline SVGs for crisp scaling + easy animation targeting

#### [NEW] [SpiderEmblem3D.tsx](file:///c:/Users/MELDAN ROY/Desktop/xplore'26/spider-verse-symposium/src/components/SpiderEmblem3D.tsx)
- Three.js canvas (via `@react-three/fiber`) with the hero's 3D centerpiece
- Default geometry: an icosahedron core with a web-line wireframe overlay (wireframe mesh slightly larger than the solid core, offset rotation speed for a layered depth effect) — gives a "spider-verse emblem" read without needing a modeled asset
- Slow continuous auto-rotation on the wireframe layer; core rotates slower/opposite direction for parallax-within-3D feel
- Subtle mouse-follow response (tilt toward cursor, small range)
- Emissive Spider Red material on the core with subtle glow (bloom-lite via emissive intensity, avoid full post-processing bloom pass unless performance allows)
- Responsive sizing, and disabled/replaced with a static image on very low-end devices if frame rate drops (basic perf check)
- If a real Spline scene or downloaded 3D model becomes available later, this component's geometry can be swapped for an imported glTF/Spline embed without changing its position/rotation/mouse-follow logic

#### [NEW] [HeroTitle.tsx](file:///c:/Users/MELDAN ROY/Desktop/xplore'26/spider-verse-symposium/src/components/HeroTitle.tsx)
- "SPIDER-VERSE SYMPOSIUM" in Anton font, bold condensed
- Idle: subtle chromatic-aberration breathing pulse (red/blue channel offset CSS animation)
- Entrance: glitch-type-in effect via GSAP
- Responsive font sizing

#### [NEW] [CTAButton.tsx](file:///c:/Users/MELDAN ROY/Desktop/xplore'26/spider-verse-symposium/src/components/CTAButton.tsx)
- Comic-panel styling: thick black border, offset drop-shadow
- Halftone dot fill pattern
- Hover: color inversion with glitch transition
- Spider Red accent

#### [NEW] [ScrollCue.tsx](file:///c:/Users/MELDAN ROY/Desktop/xplore'26/spider-verse-symposium/src/components/ScrollCue.tsx)
- Animated "thwip" arrow/web-line at bottom of hero
- Bouncing animation with web-line aesthetic
- Fades out on scroll

---

### 4. SVG Assets

> **Note:** These components will initially ship with placeholder/procedurally-drawn silhouettes so the site is functional and demoable immediately. They are built to accept a `src`/children override so real downloaded or commissioned SVG assets (per the Assets Checklist below) can be dropped in later without touching the animation/parallax logic. Do not expect the placeholder shapes to look premium — swap in real assets before final delivery.

#### [NEW] [skyline-bg.tsx](file:///c:/Users/MELDAN ROY/Desktop/xplore'26/spider-verse-symposium/src/components/svg/SkylineBg.tsx)
- NYC-inspired skyline silhouette (background layer)

#### [NEW] [buildings-mid.tsx](file:///c:/Users/MELDAN ROY/Desktop/xplore'26/spider-verse-symposium/src/components/svg/BuildingsMid.tsx)
- Closer building silhouettes with halftone texture regions

#### [NEW] [spider-swing.tsx](file:///c:/Users/MELDAN ROY/Desktop/xplore'26/spider-verse-symposium/src/components/svg/SpiderSwing.tsx)
- Spider silhouette on web-line (foreground)

---

### 4a. Assets Checklist (to source separately, see design spec)

| Asset | Format | Source | Feeds into |
|---|---|---|---|
| Skyline background silhouette | SVG | Vecteezy/Freepik, recolored to Ink Black/Web Blue | `SkylineBg.tsx` |
| Mid-layer buildings silhouette | SVG | Same as above | `BuildingsMid.tsx` |
| Spider swing silhouette | SVG | Vecteezy/Flaticon, recolored to Ink Black | `SpiderSwing.tsx` |
| Fonts | Google Fonts embed | fonts.google.com — Bangers, Anton, Space Grotesk | `layout.tsx` |
| 3D emblem geometry/material reference (optional) | Spline embed or written shape description | spline.design or plain description to Claude Code | `SpiderEmblem3D.tsx` |

---

### 5. Page Assembly

#### [MODIFY] [page.tsx](file:///c:/Users/MELDAN ROY/Desktop/xplore'26/spider-verse-symposium/src/app/page.tsx)
- Render LoadingScreen → HeroSection
- Placeholder sections for Events / Sponsors (coming in next spec)
- Lenis scroll initialization

---

### 6. Dependencies

Install via npm:
- `gsap` (with ScrollTrigger plugin)
- `@studio-freight/lenis` (smooth scrolling)
- `three` + `@types/three` (3D emblem)
- `@react-three/fiber` + `@react-three/drei` (React Three.js bindings)

---

## Key Design Decisions

1. **Fixed-duration loading screen**: The portal rip runs for ~1.5s regardless of load time. Assets preload in background. This ensures the animation never stutters.

2. **2.5D parallax approach**: SVG/CSS layers with GSAP transforms for the city scene — lightweight, performant, still feels dimensional.

3. **Single Three.js element**: Only the spider emblem uses WebGL. Everything else is SVG/CSS to keep load times fast.

4. **Glitch Cyan reserved for transitions**: Per spec, `#00E5FF` only appears during loading screen tear and hover-triggered effects, never in resting UI.

5. **Mobile adaptation**: Mousemove parallax disabled on touch devices, replaced with auto-parallax loop.

---

## Verification Plan

### Manual Verification
- Run `npm run dev` and visually verify:
  - Loading screen plays the full portal rip sequence smoothly
  - Hero section parallax responds to mouse movement
  - 3D spider emblem rotates and responds to interaction
  - Title has chromatic aberration breathing effect
  - CTA button hover states work correctly
  - Scroll cue animates at bottom
  - Mobile responsive behavior (via browser dev tools)
- Check no layout shifts, no jank, no console errors
- Verify Glitch Cyan only appears during transitions

### Build Verification
- `npm run build` completes without errors
