import "mapbox-gl/dist/mapbox-gl.css"; // CSS Mapbox
import "./globals.css";

import type { Metadata } from "next";
import React from "react";

export const metadata: Metadata = {
  title: "Mobilit",
  description: "Mobilit — Simplifier les trajets du quotidien",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
