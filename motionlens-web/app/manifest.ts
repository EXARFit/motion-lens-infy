import type { MetadataRoute } from "next";

// Web app manifest — makes the site installable, so Chrome / Edge show
// the install icon in the address bar. Served at /manifest.webmanifest.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "MotionLens — AI-Powered Motion Analysis",
    short_name: "MotionLens",
    description:
      "Markerless gait, joint and rehab analysis from any camera.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#0B0E14",
    theme_color: "#0B0E14",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
