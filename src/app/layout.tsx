import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DahBox — Movie Prediction Market",
  description: "Predict box office results, earn DAH tokens. Opening weekends, total gross, critic scores — stake your prediction on the movies you love.",
  keywords: "movie predictions, box office, prediction market, DAH tokens, opening weekend, film betting",
  openGraph: {
    title: "DahBox — Movie Prediction Market",
    description: "Predict box office results, earn DAH tokens.",
    siteName: "DahBox",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
