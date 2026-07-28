"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

export default function MultiverseTransition() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playbackStarted, setPlaybackStarted] = useState(false);
  const redirectTriggered = useRef(false);

  // Prefetch the symposium landing page immediately on mount for instant loading
  useEffect(() => {
    router.prefetch("/symposium");
  }, [router]);

  // Main redirect trigger function
  const triggerRedirect = () => {
    if (redirectTriggered.current) return;
    redirectTriggered.current = true;
    router.push("/symposium");
  };

  // Set up timer and playback tracking once the video actually starts playing
  const handlePlay = () => {
    if (playbackStarted) return;
    setPlaybackStarted(true);

    // Fallback timer: 2.0 seconds after actual video playback starts
    const timer = setTimeout(() => {
      triggerRedirect();
    }, 2000);

    return () => clearTimeout(timer);
  };

  // Monitor playback currentTime for high-precision redirection at exactly 2.0s
  const handleTimeUpdate = () => {
    const video = videoRef.current;
    if (video && video.currentTime >= 2.0) {
      triggerRedirect();
    }
  };

  // Cleanup/Emergency redirect safety net in case playback is blocked or fails
  useEffect(() => {
    const safetyTimeout = setTimeout(() => {
      triggerRedirect();
    }, 3000);

    return () => clearTimeout(safetyTimeout);
  }, []);

  return (
    <main className="min-h-screen w-full bg-black flex items-center justify-center overflow-hidden select-none">
      {/* Full-screen high-fidelity video player */}
      <video
        ref={videoRef}
        src="/loader.mp4"
        autoPlay
        muted
        playsInline
        controls={false}
        onPlay={handlePlay}
        onPlaying={handlePlay}
        onTimeUpdate={handleTimeUpdate}
        className="w-full h-full object-cover"
        style={{
          width: "100vw",
          height: "100vh",
          backgroundColor: "#000000",
        }}
      />
    </main>
  );
}
