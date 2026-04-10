// Server-side TMDB utility — used by movie pages and sitemap
const TMDB_TOKEN = process.env.TMDB_ACCESS_TOKEN || 'eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiI2MjAzNTBiYjAxNzNjZDgwYTZlMzFlZWIyYjYzMzkxYyIsIm5iZiI6MTY4NDE3MTA3OC4xMzc5OTk4LCJzdWIiOiI2NDYyNjk0NjBmMzY1NTAwZmNkZjU5ODYiLCJzY29wZXMiOlsiYXBpX3JlYWQiXSwidmVyc2lvbiI6MX0.UkyNe3YrTaLyWoBFyXeKfKRh2yj8GQTEezw3459ykGw';
const TMDB_BASE = 'https://api.themoviedb.org/3';
export const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p';

const TMDB_HEADERS = {
  Authorization: `Bearer ${TMDB_TOKEN}`,
  accept: 'application/json',
};

export interface TMDBMovieDetail {
  id: number;
  title: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  release_date: string;
  popularity: number;
  vote_average: number;
  vote_count: number;
  genre_ids?: number[];
  genres?: { id: number; name: string }[];
  runtime?: number;
  tagline?: string;
  original_language: string;
}

/**
 * Fetch a single movie by TMDB ID.
 */
export async function fetchTMDBMovie(id: number): Promise<TMDBMovieDetail | null> {
  try {
    const res = await fetch(`${TMDB_BASE}/movie/${id}`, {
      headers: TMDB_HEADERS,
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

/**
 * Fetch upcoming movies (next 60 days).
 */
export async function fetchUpcomingMovies(page = 1): Promise<TMDBMovieDetail[]> {
  try {
    const today = new Date();
    const future60 = new Date(today);
    future60.setDate(today.getDate() + 60);

    const gteDate = today.toISOString().split('T')[0];
    const lteDate = future60.toISOString().split('T')[0];

    const url =
      `${TMDB_BASE}/discover/movie?` +
      `primary_release_date.gte=${gteDate}&` +
      `primary_release_date.lte=${lteDate}&` +
      `sort_by=popularity.desc&` +
      `vote_count.gte=0&` +
      `page=${page}`;

    const res = await fetch(url, {
      headers: TMDB_HEADERS,
      next: { revalidate: 3600 },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.results || [];
  } catch {
    return [];
  }
}

/**
 * Create a URL-friendly slug from movie title + id.
 */
export function movieSlug(title: string, id: number): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return `${slug}-${id}`;
}

/**
 * Extract TMDB id from a slug like "michael-12345".
 */
export function idFromSlug(slug: string): number | null {
  const match = slug.match(/-(\d+)$/);
  return match ? parseInt(match[1], 10) : null;
}
