import type { MetadataRoute } from 'next';
import { fetchUpcomingMovies, movieSlug } from './lib/tmdb';

export const dynamic = 'force-dynamic';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const BASE_URL = 'https://box.dah.gg';

  // Static pages
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: BASE_URL,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1,
    },
  ];

  // Dynamic movie pages from TMDB
  try {
    const movies = await fetchUpcomingMovies(1);
    const moviePages: MetadataRoute.Sitemap = movies
      .filter(m => m.poster_path)
      .slice(0, 50) // Top 50 upcoming movies
      .map(movie => ({
        url: `${BASE_URL}/movie/${movieSlug(movie.title, movie.id)}`,
        lastModified: new Date(),
        changeFrequency: 'daily' as const,
        priority: 0.8,
        images: movie.poster_path
          ? [`https://image.tmdb.org/t/p/w500${movie.poster_path}`]
          : [],
      }));

    return [...staticPages, ...moviePages];
  } catch {
    return staticPages;
  }
}
