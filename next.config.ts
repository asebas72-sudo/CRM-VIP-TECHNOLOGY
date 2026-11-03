import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Todas las pantallas dependen de la sesión y la empresa del usuario,
  // así que se renderizan por solicitud (sin Cache Components).
  experimental: {
    serverActions: {
      // XML + PDF de una factura de compra
      bodySizeLimit: "8mb",
    },
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
