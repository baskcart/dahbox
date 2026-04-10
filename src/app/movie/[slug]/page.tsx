import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { fetchTMDBMovie, TMDB_IMAGE_BASE, idFromSlug } from '../../lib/tmdb';
import { generateMarketsForMovie } from '../../lib/markets';
import MoviePageClient from './MoviePageClient';

// -- Types for Next.js 16 dynamic routes --
type Props = {
  params: Promise<{ slug: string }>;
};

// -- Generate dynamic metadata for SEO --
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const id = idFromSlug(slug);
  if (!id) return {};

  const movie = await fetchTMDBMovie(id);
  if (!movie) return {};

  const posterUrl = movie.poster_path
    ? `${TMDB_IMAGE_BASE}/w500${movie.poster_path}`
    : undefined;

  const releaseDate = movie.release_date
    ? new Date(movie.release_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    : 'TBD';

  const title = `${movie.title} — Predict the Opening Weekend`;
  const description = `Predict the box office performance for ${movie.title} (${releaseDate}). Stake DAH tokens on opening weekend brackets, over/under, and more. ${movie.overview?.slice(0, 120) || ''}`;

  return {
    title,
    description,
    keywords: `${movie.title}, ${movie.title} box office, ${movie.title} opening weekend, movie predictions, DAH tokens, prediction market`,
    openGraph: {
      title,
      description,
      url: `https://box.dah.gg/movie/${slug}`,
      type: 'website',
      images: posterUrl
        ? [{ url: posterUrl, width: 500, height: 750, alt: `${movie.title} movie poster` }]
        : [],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${movie.title} Predictions | DahBox`,
      description: `Stake DAH on ${movie.title}'s box office. Will it open big?`,
      images: posterUrl ? [posterUrl] : [],
    },
    alternates: {
      canonical: `https://box.dah.gg/movie/${slug}`,
    },
  };
}

// -- Server Component: fetch data + render --
export default async function MoviePage({ params }: Props) {
  const { slug } = await params;
  const id = idFromSlug(slug);
  if (!id) notFound();

  const movie = await fetchTMDBMovie(id);
  if (!movie) notFound();

  // Generate markets for this movie
  const markets = generateMarketsForMovie({
    id: movie.id,
    title: movie.title,
    poster_path: movie.poster_path,
    release_date: movie.release_date,
    popularity: movie.popularity,
  });

  // JSON-LD structured data
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Movie',
    name: movie.title,
    description: movie.overview,
    datePublished: movie.release_date,
    image: movie.poster_path ? `${TMDB_IMAGE_BASE}/w500${movie.poster_path}` : undefined,
    url: `https://box.dah.gg/movie/${slug}`,
    aggregateRating: movie.vote_count > 0
      ? {
          '@type': 'AggregateRating',
          ratingValue: movie.vote_average,
          ratingCount: movie.vote_count,
          bestRating: 10,
        }
      : undefined,
    genre: movie.genres?.map(g => g.name),
    duration: movie.runtime ? `PT${movie.runtime}M` : undefined,
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <MoviePageClient movie={movie} markets={markets} slug={slug} />
    </>
  );
}
