import type { StaticImageData } from "next/image";

/* Character art. Each file is trimmed to its content bounds and re-encoded —
   the raw exports carry large transparent margins (and, for the comic covers,
   mastheads and printed borders) that otherwise shrink the figure inside the
   card. tools/prepare-event-art.js does the trimming; add new art there rather
   than dropping a raw export in here. */
/* event-1.webp (Spider-Man 2099) is kept OUT of the six event cards: he is
   the hero of the persistent 3D rig that flies through these sections, and
   three cards were re-using his still as filler. He fronts the single
   WORKSHOP card instead — that one is never on screen at the same time as
   the event deck (they are separate tabs), so there is no doubling up, and
   the workshop is the one thing the festival's own headliner should host. */
import charVenom from "../../events/event-2.webp";
import charGwen from "../../events/event-3.webp";
import charMiles from "../../events/event-4.webp";
import charSpidey from "../../events/event-1.webp";
import charNoir from "../../events/event-noir.webp";
import charPunk from "../../events/event-punk.webp";
import charPavitr from "../../events/event-pavitr.webp";

/**
 * Colours pulled from the character art so the card and the figure read as
 * one piece rather than a cutout dropped on a panel.
 *  - `accent` drives borders, the header strip and the primary button
 *  - `glow`   is the secondary/glitch hue, used for offsets and highlights
 *  - `base`   is the card background: near-black, tinted toward the artwork
 *  - `key`    is the rim light thrown behind the figure
 */
export type EventPalette = {
  accent: string;
  glow: string;
  base: string;
  key: string;
};

/** How a given piece of art should sit inside the card's art cell. */
export type EventFraming = {
  /** CSS object-position for the cover crop. */
  position: string;
  /** Flip horizontally — used when the pose reaches the wrong way. */
  mirror?: boolean;
};

export type EventItem = {
  title: string;
  subtitle: string;
  description: string;
  palette: EventPalette;
  image: StaticImageData;
  framing: EventFraming;
  /** Google Form URL the Register button opens. */
  registerUrl: string;
  /** Poster shown in the details dialog. Falls back to `image` until real
   *  brochure artwork is supplied per event. */
  brochure?: StaticImageData;
};

/* Palettes, each sampled off its character.

   `accent` is a background for PAPER-white text (header strip, Register
   button), so it has to stay dark enough to carry white — that rules out the
   literal highlight colour of the lighter characters. `glow` is the title's
   offset shadow and sits on the near-white caption box, so it wants the
   opposite: saturated and mid-dark. Picking both off the same swatch is what
   made the venom card's label need a text-shadow. */
const P_NOIR: EventPalette = {
  // Spider-Man Noir is pure greyscale, so the card borrows the genre's own
  // trick: monochrome everything, one spot of dried blood on the title.
  accent: "#556575",
  glow: "#9B1C1C",
  base: "#0E1116", // lifted off true black — the figure is a black silhouette
  key: "#C2CBD3",
};
const P_VENOM: EventPalette = {
  // Miles' venom strike — molten gold against the crimson suit.
  accent: "#F2A007",
  glow: "#E20B17",
  base: "#150B02",
  key: "#FFB524",
};
const P_GWEN: EventPalette = {
  // Spider-Gwen — hot pink hood over cyan-lit white.
  accent: "#FF2E88",
  glow: "#20D5F0",
  base: "#120618",
  key: "#FF4E9C",
};
const P_INDIGO: EventPalette = {
  // Into-the-Spider-Verse Miles — crimson over deep indigo.
  accent: "#E31B3D",
  glow: "#4361FF",
  base: "#04061C",
  key: "#5570FF",
};
const P_PUNK: EventPalette = {
  // Spider-Punk — the cover's violet rim light over the black leather, with
  // the masthead's acid yellow kept for the title.
  accent: "#8B2FD6",
  glow: "#FFD400",
  base: "#120A1C",
  key: "#B95CFF",
};
const P_2099: EventPalette = {
  // Spider-Man 2099 — the rig's own colours: circuit red over Nueva York blue.
  accent: "#C4172B",
  glow: "#00E5FF",
  base: "#0A0714",
  key: "#FF2D3F",
};
const P_PAVITR: EventPalette = {
  // Spider-Man India — the suit's turquoise panels against its marigold cuffs.
  accent: "#0C8F91",
  glow: "#FF7A18",
  base: "#04161A",
  key: "#22D3CE",
};

/* ── LABEL COLOUR ON AN ACCENT ──
   The header strip and the Register button are text ON `accent`, and `accent`
   ranges from near-black gunmetal to bright marigold. Painting all of them
   paper-white put "DIMENSION 02" and "REGISTER" at roughly 2:1 on the venom
   gold and the Pavitr teal — legible only if you already knew what they said,
   which is what the old `textShadow` was papering over.

   So pick per palette instead of per taste: WCAG relative luminance, then
   whichever of ink/paper actually contrasts. Palettes can change freely and
   the labels stay readable without anyone remembering to check. */
const INK = "#03071E";
const PAPER = "#F2EFE9";

/** WCAG 2.1 relative luminance of a #rrggbb colour. */
function luminance(hex: string): number {
  const v = parseInt(hex.slice(1), 16);
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return (
    0.2126 * lin((v >> 16) & 255) +
    0.7152 * lin((v >> 8) & 255) +
    0.0722 * lin(v & 255)
  );
}

const contrast = (a: number, b: number) =>
  (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);

/** Ink or paper — whichever reads better on `accent`. */
export function labelOn(accent: string): string {
  const l = luminance(accent);
  return contrast(l, luminance(PAPER)) >= contrast(l, luminance(INK))
    ? PAPER
    : INK;
}

export type DetailSection = {
  heading: string;
  points: string[];
};

/**
 * Shared rules shown in the details dialog. Every event currently uses this
 * same set — swap in per-event overrides via `EVENT_DETAILS_BY_TITLE` once
 * the real copy lands.
 */
export const EVENT_DETAILS: DetailSection[] = [
  {
    heading: "Building Rules",
    points: [
      "Solo or team participation allowed",
      "Theme for the build announced at event start",
      "Limited build time; must be done in survival or creative (as specified)",
    ],
  },
  {
    heading: "Winning Criteria",
    points: [
      "Creativity and originality",
      "Attention to detail",
      "Overall aesthetic appeal",
    ],
  },
  {
    heading: "General Rules",
    points: [
      "All participants must register before the event",
      "Valid student ID is mandatory for participation",
      "Follow all safety guidelines and instructions",
      "Respect other participants and organizers",
    ],
  },
  {
    heading: "Event Specific",
    points: [
      "Arrive 15 minutes before the event starts",
      "Bring necessary equipment if required",
      "No external assistance during competitions",
      "Decisions of judges are final",
    ],
  },
  {
    heading: "Code of Conduct",
    points: [
      "Maintain professional behavior throughout",
      "No use of unfair means or cheating",
      "Report any issues to event coordinators",
      "Help maintain a clean event environment",
    ],
  },
  {
    heading: "Important Notes",
    points: [
      "Winners will be announced at the closing ceremony",
      "Certificates will be provided to all participants",
      "Photos and videos may be taken during events",
      "Contact organizers for any special requirements",
    ],
  },
];

export const EVENTS: EventItem[] = [
  {
    title: "ACROSS THE SPIDERVERSE",
    subtitle: "DIMENSION 01",
    description:
      "Navigate through cryptic clues across dimensions. Only the most resourceful spider will unravel every puzzle and claim the ultimate prize.",
    palette: P_NOIR,
    image: charNoir,
    // Portrait art in a near-square cell, so ~80% of it survives the cover
    // crop; the bias just favours the hat and the drawn revolver over the boots.
    framing: { position: "50% 38%" },
    registerUrl: "https://forms.gle/jQU3VMCiNX9T3rVZ8",
  },
  {
    title: "BEYOND THE WEB",
    subtitle: "DIMENSION 02",
    description:
      "Present your research across the multiverse of knowledge. Showcase groundbreaking ideas to a panel of experts.",
    palette: P_VENOM,
    image: charVenom,
    framing: { position: "58% 34%" },
    registerUrl: "https://forms.gle/8dWFdApCnpdZmUsJ6",
  },
  {
    title: "MULTIVERSE BREACH",
    subtitle: "DIMENSION 03",
    description:
      "Capture the Flag — breach defences, decode secrets and exploit vulnerabilities before anyone else. A cyber-warfare arena for elite hackers.",
    // SPIDER-PUNK fronts the CTF: Hobie is the one character in the set whose
    // whole deal is breaking into systems he wasn't invited to. The violet/
    // acid-yellow palette also reads closest to a terminal, which is what the
    // card is selling.
    palette: P_PUNK,
    image: charPunk,
    framing: { position: "50% 35%" },
    registerUrl: "https://forms.gle/wCxZjR21HEmJbyXL9",
  },
  {
    title: "SPIDER SENSE",
    subtitle: "DIMENSION 04",
    description:
      "Test your web of knowledge across technology, science, and innovation. Only the sharpest minds survive.",
    palette: P_INDIGO,
    image: charMiles,
    framing: { position: "50% 22%" },
    registerUrl: "https://forms.gle/EEFm2Pmg1SAynyHFA",
  },
  {
    title: "SPIDER SPRINT",
    subtitle: "DIMENSION 05",
    description:
      "Race against time in this high-speed competitive programming challenge. Swing through algorithms at lightning pace.",
    // SPIDER-GWEN fronts the speed round: she is the fastest and most
    // acrobatic spider in the set, and the pink/cyan reads as motion rather
    // than menace — which is the difference between a race and a break-in.
    palette: P_GWEN,
    image: charGwen,
    framing: { position: "70% 22%" },
    registerUrl: "https://forms.gle/RhafMBdAfTJo5dcZ9",
  },
  {
    title: "WEB FORGE",
    subtitle: "DIMENSION 06",
    description:
      "Design and build a stunning website from scratch under the clock. Creativity, code quality and speed all count.",
    palette: P_PAVITR,
    image: charPavitr,
    framing: { position: "50% 40%" },
    registerUrl: "https://forms.gle/dtxLJA34KF5RGT5K7",
  },
];

/* ── WORKSHOPS ──
   Same shape as an event so it renders through the exact same EventCard and
   details modal — a workshop is an event with a different label, and giving
   it its own type would mean maintaining two copies of every card change.

   Deliberately an ARRAY holding one entry rather than a bare object: there
   is one workshop this year, and the tab in FeaturedEventsSection already
   maps over it, so adding a second is a data edit and nothing else. */
export const WORKSHOPS: EventItem[] = [
  {
    title: "Full Stack Spider-Verse Workshop",
    subtitle: "WORKSHOP 01",
    description:
      "Build a Campus Event Registration Portal from scratch while learning modern full-stack development. Explore Next.js 15, React, Tailwind CSS, Clerk Authentication, Supabase, FastAPI, Gemini AI, and Vercel Deployment through a hands-on project. Perfect for beginner to intermediate students looking to understand real-world full-stack workflows and AI integration.",
    palette: P_2099,
    image: charSpidey,
    framing: { position: "50% 30%" },
    registerUrl:
      "https://docs.google.com/forms/d/e/1FAIpQLSfDGcZIDifZCxAXELaK_WpnfrDAmB4E4SeblBNp_OA9MnAN9w/viewform?usp=publish-editor",
  },
];

/* ── PER-EVENT DETAIL OVERRIDES ──
   Keyed by title rather than array index so a reorder in EVENTS/WORKSHOPS
   can never silently pair the wrong rules with the wrong card. Falls back
   to the shared EVENT_DETAILS above for anything not listed here — every
   competition event still uses those generic rules; only the workshop
   (a taught session, not a judged competition) needs its own set. */
export const EVENT_DETAILS_BY_TITLE: Record<string, DetailSection[]> = {
  "BEYOND THE WEB": [
    {
      heading: "Building Rules",
      points: [
        "Maximum 3 participants per team",
        "Inter-college teams are allowed",
        "One participant can join only one team",
        "Categories: Research Paper, Project, Prototype, or Poster",
      ],
    },
    {
      heading: "Winning Criteria",
      points: [
        "Technical Innovation",
        "Problem & Solution",
        "Methodology",
        "Results",
        "Presentation Skills",
        "Q&A Performance",
      ],
    },
    {
      heading: "General Rules",
      points: [
        "Carry your College ID Card",
        "Shortlisted teams will present on 8th August",
        "Teams with prototypes must arrange their own demonstration setup",
        "Abstract should not exceed 250 words",
      ],
    },
    {
      heading: "Event Specific",
      points: [
        "Research Paper: IEEE format preferred, 6–15 pages with one-page abstract",
        "Project/Prototype: Report of 3–10 pages with one-page abstract",
        "Poster: A1/A2 size (digital copy in PDF to be submitted) with a one-page abstract",
        "Presentation: 7 minutes + 3 minutes Q&A",
      ],
    },
    {
      heading: "Code of Conduct",
      points: [
        "Maintain professional and respectful behavior",
        "Submit original work only",
        "Adhere to the general guidelines",
        "Any misconduct may lead to disqualification",
      ],
    },
    {
      heading: "Important Notes",
      points: [
        "Only shortlisted teams will present",
        "Top 2 teams from each department qualify for the finals",
        "Top 3 teams overall will receive prizes and certificates",
        "The judges' decision is final",
      ],
    },
  ],
  "Full Stack Spider-Verse Workshop": [
    {
      heading: "Conducted By",
      points: ["Rehaan Rafael John — III CSE B"],
    },
    {
      heading: "Workshop Info",
      points: [
        "Duration: 4 hours",
        "Target audience: beginner to intermediate students",
        "Venue: A12",
      ],
    },
    {
      heading: "Prerequisites",
      points: [
        "Basic programming knowledge (variables, loops, functions)",
        "No prior web development experience required",
      ],
    },
    {
      heading: "To Bring",
      points: ["Laptop and charger"],
    },
    {
      heading: "Learning Objectives",
      points: [
        "What Full Stack actually means",
        "How the frontend talks to the backend",
        "REST APIs",
        "Authentication",
        "Databases",
        "AI integration",
        "Deployment",
        "Real developer workflow",
      ],
    },
    {
      heading: "Project: Campus Event Registration Portal",
      points: [
        "Login",
        "View events",
        "Register for events",
        "See your registrations",
        "Ask an AI assistant about events",
      ],
    },
    {
      heading: "Tech Stack",
      points: [
        "Frontend — Next.js 15, React, Tailwind CSS, TypeScript",
        "Authentication — Clerk",
        "Database — Supabase",
        "AI backend — FastAPI",
        "AI — Gemini API",
        "Hosting — Vercel",
      ],
    },
  ],
};

/** Detail sections for a given event/workshop title, falling back to the
 *  shared competition rules when there's no title-specific override. */
export function detailsFor(title: string): DetailSection[] {
  return EVENT_DETAILS_BY_TITLE[title] ?? EVENT_DETAILS;
}
