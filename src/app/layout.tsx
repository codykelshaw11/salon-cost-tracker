import type { Metadata } from "next";
import Providers from "./providers";

export const metadata: Metadata = {
  title: "Salon Cost Tracker",
  description: "Track product usage cost per appointment",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}