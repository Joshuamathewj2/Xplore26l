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

/* The campus every event runs on. Kept as one constant because the address
   is repeated in each event's "Venue & Timing" block — a room number on its
   own tells an inter-college participant nothing about where to turn up.

   Split into its two halves because the countdown's venue plate sets the
   college name and the locality on separate lines, at different weights. */
export const CAMPUS_NAME =
  "Loyola-ICAM College of Engineering and Technology";
export const CAMPUS_LOCALITY =
  "Loyola College Campus, Nungambakkam, Chennai – 600034";
export const CAMPUS_ADDRESS = `${CAMPUS_NAME}, ${CAMPUS_LOCALITY}`;

/** Room + campus, for the venue line of an event's details. */
const venue = (room: string) => `${room} — ${CAMPUS_ADDRESS}`;

/**
 * Fallback rules shown in the details dialog for any event without its own
 * entry in `EVENT_DETAILS_BY_TITLE` below (currently just the workshop).
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

/**
 * Real per-event/workshop rules, keyed by `EventItem.title`. Sourced from the
 * official "All Events Rules and Regulations" document (and the workshop
 * brief) — headings follow each entry's own doc rather than being forced
 * into one shared shape. Look up via `getEventDetails`, which falls back to
 * `EVENT_DETAILS` for anything not listed here.
 */
export const EVENT_DETAILS_BY_TITLE: Record<string, DetailSection[]> = {
  "ACROSS THE SPIDERVERSE": [
    {
      heading: "Quest Format",
      points: [
        "Follow the clue chain to find hidden treasures",
        "Some challenges may be coding or puzzle-based",
        "Navigate through challenging environments",
      ],
    },
    {
      heading: "Winning Criteria",
      points: ["First to complete the quest", "Least penalties from wrong clues"],
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
    {
      heading: "Venue & Timing",
      points: [venue("I22 & I23"), "9:30 AM – 12:30 PM"],
    },
    {
      heading: "Student Coordinators",
      points: [
        "Preethish — III CSE B — 70944 45555",
        "Jefrin MSA — III CSE A — 72002 35885",
      ],
    },
  ],
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
        "No on-spot registration",
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
        "Presentation: 5 minutes + 2 minutes Q&A",
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
    {
      heading: "Venue & Timing",
      points: [venue("I21"), "9:00 AM – 12:00 PM"],
    },
    {
      heading: "Student Coordinators",
      points: [
        "Goldwin R Jaffee — III CSE A — 94888 91723",
        "Rimy John — 74189 79645",
      ],
    },
  ],
  "MULTIVERSE BREACH": [
    {
      heading: "Building Rules",
      points: [
        "Teams of 1–3 participants",
        "Register before the event begins",
        "Use only your own laptop and internet connection unless stated otherwise",
        "Internet resources, documentation and open-source tools are permitted",
        "Collaboration between teams is strictly prohibited",
        "Attacking the event infrastructure instead of solving challenges means immediate disqualification",
      ],
    },
    {
      heading: "Winning Criteria",
      points: [
        "Points are earned by submitting correct flags",
        "Easy challenge: 100 points · Medium: 150 points · Hard: 200 points",
        "50-point bonus for clearing the Easy section within 15 minutes, the Medium section within 25 minutes, or the Hard section within 30 minutes of the start",
        "The bonus can be claimed only once per team",
        "Highest score at the end of the event wins",
        "Ties go to whichever team reached the final score first",
        "Organizers' decisions on scoring and rankings are final",
      ],
    },
    {
      heading: "General Rules",
      points: [
        "Flag format: SPIDER{...}",
        "Flags are case-sensitive with no spaces",
        "Every challenge can be solved independently",
        "Do not share flags or solutions with other participants",
        "Respect all participants and event volunteers",
      ],
    },
    {
      heading: "Event Specific",
      points: [
        "Difficulty levels: Easy, Medium and Hard",
        "Allowed tools: CyberChef, Wireshark, Hashcat, John the Ripper, ExifTool, Steghide, Volatility, Linux Terminal and browser-based tools",
        "Brute forcing outside the intended challenge scope is prohibited",
        "Exploiting the event platform or scoreboard is forbidden",
      ],
    },
    {
      heading: "Code of Conduct",
      points: [
        "Maintain professionalism throughout the competition",
        "Respect fellow participants and organizers",
        "No offensive language or disruptive behavior",
        "Cheating, plagiarism or sabotage means immediate disqualification",
      ],
    },
    {
      heading: "Important Notes",
      points: [
        "Read each challenge carefully before attempting it",
        "Participants are responsible for following all event rules while using the laboratory systems",
        "Organizer decisions are final and cannot be challenged",
      ],
    },
    {
      heading: "Venue & Timing",
      points: [venue("H22 (Lab)"), "12:00 PM – 2:00 PM"],
    },
    {
      heading: "Student Coordinators",
      points: [
        "Maria Sherlin — IV CSE B — 86678 02943",
        "Mohammed Aasim T.A — III CSE B — 78455 37575",
      ],
    },
  ],
  "SPIDER SENSE": [
    {
      heading: "Building Rules",
      points: [
        "Teams of 2–3 members, fixed as per registration",
        "Substitutions on event day require the in-charge's approval",
      ],
    },
    {
      heading: "Winning Criteria",
      points: [
        "The quiz runs across 3 rounds — shortlisted teams advance, others are eliminated",
        "The top-scoring team(s) after Round 3 (Multiverse Abilities) are declared winners",
      ],
    },
    {
      heading: "General Rules",
      points: [
        "The quiz runs entirely on the official quiz website — log in with your team's assigned token",
        "Own devices are required for every round",
        "All timers are server-controlled and final; no answer in the window scores zero",
      ],
    },
    {
      heading: "Event Specific",
      points: [
        "Round 1 — Final Universe: three mini-games — Image Replication (AI image tools allowed), Connections, and a Spider-Verse Memory Game",
        "Round 2 — Universe 1: Warm-up MCQs, 16 seconds per question (6s read + 10s select)",
        "Round 3 — Universe 2: Multiverse Abilities, same timing with a live leaderboard and a Comeback Meter bonus for teams stuck at the bottom",
      ],
    },
    {
      heading: "Code of Conduct",
      points: [
        "AI tools, search engines and outside help are banned except in Round 1's Image Replication game",
        "No help from spectators, other teams or unauthorized devices",
        "The in-charges' decision on scoring and disputes is final",
      ],
    },
    {
      heading: "Important Notes",
      points: [
        "Timing, scoring or format may change before the event — watch the Rules Screen for updates",
        "Participation implies acceptance of all rules stated above",
      ],
    },
    {
      heading: "Venue & Timing",
      points: [venue("I11"), "12:30 PM – 2:00 PM"],
    },
    {
      heading: "Student Coordinators",
      points: [
        "Anish Joseph Leo — III CSE A — 93603 90775",
        "Pranathi — III CSE B — 70104 34599",
      ],
    },
  ],
  "SPIDER SPRINT": [
    {
      heading: "Building Rules",
      points: [
        "Carry your college ID card at all times inside the venue",
        "Entry is restricted to registered participants, volunteers, judges and faculty coordinators",
        "No food or beverages inside the venue — water bottles are permitted",
        "Sit at your allotted system; swapping seats without permission isn't allowed",
        "Maintain silence during Rounds 1 and 2",
      ],
    },
    {
      heading: "Winning Criteria",
      points: [
        "Correctness of output is the primary criterion every round",
        "Submission time is the tiebreaker when scores are equal",
        "Rounds 2 and 3 use points-per-problem scoring with a time penalty for incorrect submissions",
        "Code efficiency counts as bonus points in the final round",
        "Highest cumulative score after Round 3 wins",
      ],
    },
    {
      heading: "General Rules",
      points: [
        "Open to all registered students — solo or team of 2",
        "One entry per person, across teams",
        "Report to the venue at least 15 minutes before the start",
        "Round cutoffs are announced before each round begins",
        "The event may run 2 rounds instead of 3 if registrations are low",
      ],
    },
    {
      heading: "Event Specific",
      points: [
        "Round 1 — Screening: MCQ only, 20–25 minutes; top 40–50% advance",
        "Round 2 — Core Coding: 45 minutes, 3 problems of increasing difficulty; top 5–8 advance",
        "Round 3 — Finale: live, on-stage, with a projected leaderboard and a possible live debugging challenge",
        "Languages allowed: C, C++, Java, Python",
      ],
    },
    {
      heading: "Code of Conduct",
      points: [
        "No internet access during coding rounds except official documentation, if specified",
        "No AI coding tools of any kind, at any point",
        "No code sharing or plagiarism — finalists undergo manual review",
        "Any malpractice means instant disqualification, with no prior warning",
      ],
    },
    {
      heading: "Venue & Timing",
      points: [venue("I11"), "9:30 AM – 12:00 PM"],
    },
    {
      heading: "Student Coordinators",
      points: [
        "Abhijeet V.S — III CSE A — 89395 42265",
        "Lathika Valli M — III CSE B — 99444 01328",
      ],
    },
  ],
  "WEB FORGE": [
    {
      heading: "Building Rules",
      points: [
        "Build a static website prototype using Google AI Studio only",
        "Must include a Home Page, Navigation Bar, Hero Section and Contact Section respective to your challenge card",
        "Refine your prompts throughout the round — aim for a working MVP, not a production build",
        "Once the hidden challenges are revealed, incorporate them into your existing site within the remaining time",
      ],
    },
    {
      heading: "Winning Criteria",
      points: [
        "Prompt Engineering — 25",
        "Creativity & Innovation — 20",
        "Website Functionality & UI — 20",
        "Problem Solving & Hidden Challenge Integration — 15",
        "Presentation & Pitch — 20",
      ],
    },
    {
      heading: "General Rules",
      points: [
        "Teams of 2 participants",
        "Every participant brings their own laptop and an active Google account",
        "Report to the venue at least 15 minutes before the event begins",
        "Submit before the allotted time ends — late submissions aren't accepted",
        "The judges' decision is final and binding",
      ],
    },
    {
      heading: "Event Specific",
      points: [
        "Round 1 — AI Image Recreation: recreate a shared reference image in the fewest prompts; top 15 teams qualify",
        "Round 2 — Website Prototype: build to a randomly drawn challenge card (one swap allowed), react to a Hidden Challenge and a Crisis Card revealed at specific intervals, then pitch for 2–3 minutes with judge Q&A",
      ],
    },
    {
      heading: "Code of Conduct",
      points: [
        "Only Google AI Studio is allowed — no other AI tools",
        "No copying prompts, generated content or designs from other teams",
        "No sharing challenge cards or prompts with other participants",
        "No offensive, inappropriate or copyrighted content",
      ],
    },
    {
      heading: "Venue & Timing",
      points: [venue("I23"), "12:00 PM – 2:00 PM"],
    },
    {
      heading: "Student Coordinators",
      points: [
        "Shreya Angelina — III CSE B — 96294 38143",
        "Kevin Bosco — II CSE A — 63851 17773",
      ],
    },
  ],
  "Full Stack Spider-Verse Workshop": [
    {
      // The timetable lists Rehaan as the student event coordinator and he is
      // also the one running the session, so this is one section, not two.
      heading: "Student Coordinator / Conducted By",
      points: ["Rehaan Rafael John — III CSE B"],
    },
    {
      heading: "Venue & Timing",
      points: [venue("A12"), "9:30 AM – 12:00 PM"],
    },
    {
      heading: "Workshop Info",
      points: ["Target audience: beginner to intermediate students"],
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

/** Per-event rules if we have them, else the generic fallback. */
export function getEventDetails(title: string): DetailSection[] {
  return EVENT_DETAILS_BY_TITLE[title] ?? EVENT_DETAILS;
}

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
      "Paper Presentation provides a platform for students to present their research, innovative ideas, and technical solutions. Participants will have the opportunity to showcase their work before a panel of experts, demonstrate their knowledge, and compete with fellow innovators.",
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
      "Three rounds across the multiverse — outwit AI image challenges, picture puzzles and rapid-fire trivia. Only the sharpest minds survive to the final round.",
    palette: P_INDIGO,
    image: charMiles,
    framing: { position: "50% 22%" },
    registerUrl: "https://forms.gle/EEFm2Pmg1SAynyHFA",
  },
  {
    title: "SPIDER SPRINT",
    subtitle: "DIMENSION 05",
    description:
      "Race the clock across three rounds — from MCQ screening to a live on-stage coding finale. Swing through algorithms at lightning pace.",
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
      "Prompt, build and pitch a website with Google AI Studio — race an image-recreation challenge, then design under a live client curveball. Creativity, functionality and pitch all count.",
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
