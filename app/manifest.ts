import type { MetadataRoute } from "next"

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Sistema de Voto Asamblea",
    short_name: "Voto Asamblea",
    description: "Sistema de voto electrónico para asambleas.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#f4f6f1",
    theme_color: "#001533",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  }
}
