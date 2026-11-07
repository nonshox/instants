import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Mono",
    short_name: "Mono",
    description: "A private, simple way to share everyday photos.",
    lang: "en",
    dir: "ltr",
    start_url: "/",
    scope: "/",
    display: "standalone",
    display_override: ["standalone", "minimal-ui"],
    orientation: "any",
    theme_color: "#ffffff",
    background_color: "#ffffff",
    categories: ["social", "photo"],
    icons: [
      {
        src: "/logotype/favicon-48x48.png",
        sizes: "48x48",
        type: "image/png",
      },
      {
        src: "/logotype/favicon-16x16.png",
        sizes: "16x16",
        type: "image/png",
      },
      {
        src: "/logotype/favicon-32x32.png",
        sizes: "32x32",
        type: "image/png",
      },
      {
        src: "/logotype/android-chrome-192x192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/logotype/android-chrome-512x512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/logotype/android-chrome-192x192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/logotype/android-chrome-512x512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    prefer_related_applications: false,
  };
}
