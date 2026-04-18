import { Market, MarketOutcome, BookItem, GameItem } from './types';

// ─── Opening Weekend Brackets ─────────────────────
// Brackets are derived deterministically from the movie's popularity estimate.
// Pool sizes are initialised to 0 — real values are overlaid after fetching
// from DAHBOX_STAKES via /api/stake/totals.

function generateOWBrackets(baseEstimate: number): MarketOutcome[] {
  const step = baseEstimate < 50 ? 10 : baseEstimate < 150 ? 20 : 50;
  const low = Math.max(0, Math.floor(baseEstimate / step - 2) * step);

  const brackets: MarketOutcome[] = [];
  for (let i = 0; i < 5; i++) {
    const from = low + i * step;
    const to = from + step;
    const isCenter = i === 2;
    // impliedOdds is a display hint based on bracket position — updated when
    // real stakes arrive (see overlayRealPoolData in page.tsx).
    const weight = isCenter ? 0.35 : i === 1 || i === 3 ? 0.22 : 0.105;

    brackets.push({
      id: `ow-${from}-${to}`,
      label: i === 4 ? `$${from}M+` : `$${from}-${to}M`,
      totalStaked: 0,   // real value overlaid after /api/stake/totals
      impliedOdds: weight,
    });
  }
  return brackets;
}

// ─── Generate markets for a TMDB movie ───────────

export function generateMarketsForMovie(movie: {
  id: number;
  title: string;
  poster_path: string | null;
  release_date: string;
  popularity: number;
}): Market[] {
  const markets: Market[] = [];
  const releaseDate = new Date(movie.release_date);
  const closeDate = new Date(releaseDate);
  closeDate.setHours(18, 0, 0, 0);

  const resolveDate = new Date(releaseDate);
  resolveDate.setDate(resolveDate.getDate() + 3);

  const baseEstimate = Math.max(10, Math.min(300, Math.round(movie.popularity / 3)));
  const outcomes = generateOWBrackets(baseEstimate);

  markets.push({
    id: `market-ow-${movie.id}`,
    mediaType: 'movie',
    movieId: movie.id,
    movieTitle: movie.title,
    posterPath: movie.poster_path,
    releaseDate: movie.release_date,
    category: 'opening-weekend',
    question: `${movie.title} — Opening Weekend Domestic Gross?`,
    outcomes,
    totalPool: 0,   // overlaid after /api/stake/totals
    status: 'open',
    closesAt: closeDate.toISOString(),
    resolvesAt: resolveDate.toISOString(),
    createdAt: new Date().toISOString(),
  });

  const overUnderLine = baseEstimate;
  markets.push({
    id: `market-ou-${movie.id}`,
    mediaType: 'movie',
    movieId: movie.id,
    movieTitle: movie.title,
    posterPath: movie.poster_path,
    releaseDate: movie.release_date,
    category: 'opening-weekend',
    question: `${movie.title} — Over/Under $${overUnderLine}M Opening Weekend?`,
    outcomes: [
      { id: 'over', label: `Over $${overUnderLine}M`, totalStaked: 0, impliedOdds: 0.5 },
      { id: 'under', label: `Under $${overUnderLine}M`, totalStaked: 0, impliedOdds: 0.5 },
    ],
    totalPool: 0,
    status: 'open',
    closesAt: closeDate.toISOString(),
    createdAt: new Date().toISOString(),
  });

  return markets;
}

// ─── Generate markets for a Book ─────────────────

export function generateMarketsForBook(book: BookItem): Market[] {
  const markets: Market[] = [];
  const closeDate = new Date();
  closeDate.setMonth(closeDate.getMonth() + 6);

  markets.push({
    id: `market-b2m-${book.id}`,
    mediaType: 'book',
    movieId: parseInt(book.id.replace(/\D/g, '').slice(0, 8)) || 0,
    movieTitle: book.title,
    posterPath: book.imageUrl,
    releaseDate: book.publishedDate || new Date().toISOString().split('T')[0],
    category: 'book-to-movie',
    question: `Will "${book.title}" get a movie/TV adaptation?`,
    outcomes: [
      { id: 'yes-movie', label: 'Yes — Movie',      totalStaked: 0, impliedOdds: 0.3 },
      { id: 'yes-tv',    label: 'Yes — TV Series',  totalStaked: 0, impliedOdds: 0.2 },
      { id: 'no',        label: 'No adaptation',     totalStaked: 0, impliedOdds: 0.5 },
    ],
    totalPool: 0,
    status: 'open',
    closesAt: closeDate.toISOString(),
    createdAt: new Date().toISOString(),
  });

  if (book.averageRating >= 4 || book.ratingsCount > 100) {
    markets.push({
      id: `market-bf-${book.id}`,
      mediaType: 'book',
      movieId: parseInt(book.id.replace(/\D/g, '').slice(0, 8)) || 0,
      movieTitle: book.title,
      posterPath: book.imageUrl,
      releaseDate: book.publishedDate || new Date().toISOString().split('T')[0],
      category: 'book-to-movie',
      question: `Best format for "${book.title}" adaptation?`,
      outcomes: [
        { id: 'live-action', label: 'Live-Action Film', totalStaked: 0, impliedOdds: 0.5 },
        { id: 'animated',    label: 'Animated Film',    totalStaked: 0, impliedOdds: 0.25 },
        { id: 'miniseries',  label: 'Limited Series',   totalStaked: 0, impliedOdds: 0.25 },
      ],
      totalPool: 0,
      status: 'open',
      closesAt: closeDate.toISOString(),
      createdAt: new Date().toISOString(),
    });
  }

  return markets;
}

// ─── Generate markets for a Game ─────────────────

export function generateMarketsForGame(game: GameItem): Market[] {
  const markets: Market[] = [];
  const closeDate = new Date();
  closeDate.setMonth(closeDate.getMonth() + 12);

  markets.push({
    id: `market-g2m-${game.id}`,
    mediaType: 'game',
    movieId: game.id,
    movieTitle: game.name,
    posterPath: game.background_image,
    releaseDate: game.released || new Date().toISOString().split('T')[0],
    category: 'game-to-movie',
    question: `Will "${game.name}" get a movie/TV adaptation?`,
    outcomes: [
      { id: 'yes-movie', label: 'Yes — Movie',      totalStaked: 0, impliedOdds: 0.3 },
      { id: 'yes-tv',    label: 'Yes — TV Series',  totalStaked: 0, impliedOdds: 0.25 },
      { id: 'no',        label: 'No adaptation',     totalStaked: 0, impliedOdds: 0.45 },
    ],
    totalPool: 0,
    status: 'open',
    closesAt: closeDate.toISOString(),
    createdAt: new Date().toISOString(),
  });

  markets.push({
    id: `market-gf-${game.id}`,
    mediaType: 'game',
    movieId: game.id,
    movieTitle: game.name,
    posterPath: game.background_image,
    releaseDate: game.released || new Date().toISOString().split('T')[0],
    category: 'game-to-movie',
    question: `"${game.name}" adaptation — Live-Action or Animated?`,
    outcomes: [
      { id: 'live-action', label: 'Live-Action', totalStaked: 0, impliedOdds: 0.6 },
      { id: 'animated',    label: 'Animated',    totalStaked: 0, impliedOdds: 0.4 },
    ],
    totalPool: 0,
    status: 'open',
    closesAt: closeDate.toISOString(),
    createdAt: new Date().toISOString(),
  });

  return markets;
}
