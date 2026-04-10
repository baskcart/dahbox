import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://box.dah.gg"),
  title: {
    default: "DahBox — Movie Prediction Market",
    template: "%s | DahBox",
  },
  description: "Predict box office results, earn DAH tokens. Stake on opening weekends, total gross, and critic scores for upcoming movies.",
  keywords: "movie predictions, box office, prediction market, DAH tokens, opening weekend, film betting, DAHLOR",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  openGraph: {
    title: "DahBox — Movie Prediction Market",
    description: "Predict box office results, earn DAH tokens. Stake your prediction on the movies you love.",
    siteName: "DahBox",
    type: "website",
    url: "https://box.dah.gg",
  },
  twitter: {
    card: "summary_large_image",
    title: "DahBox — Movie Prediction Market",
    description: "Predict box office results, earn DAH tokens.",
  },
  alternates: {
    canonical: "https://box.dah.gg",
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

