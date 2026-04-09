import { Market, MarketOutcome } from './types';

// ─── Sample Opening Weekend Brackets ─────────────

function generateOWBrackets(baseEstimate: number): MarketOutcome[] {
  // Create 5 brackets around the base estimate
  const step = baseEstimate < 50 ? 10 : baseEstimate < 150 ? 20 : 50;
  const low = Math.max(0, Math.floor(baseEstimate / step - 2) * step);
  
  const brackets: MarketOutcome[] = [];
  for (let i = 0; i < 5; i++) {
    const from = low + i * step;
    const to = from + step;
    const isCenter = i === 2;
    // Simulate crowd — center bracket gets more stakes
    const weight = isCenter ? 0.35 : i === 1 || i === 3 ? 0.22 : 0.105;
    const pool = Math.round(800 + Math.random() * 400);
    const staked = Math.round(pool * weight);
    
    brackets.push({
      id: `ow-${from}-${to}`,
      label: i === 4 ? `$${from}M+` : `$${from}-${to}M`,
      totalStaked: staked,
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
  closeDate.setHours(18, 0, 0, 0); // Close at 6 PM ET on release day
  
  const resolveDate = new Date(releaseDate);
  resolveDate.setDate(resolveDate.getDate() + 3); // Monday actuals

  // Estimate box office based on TMDB popularity (rough heuristic)
  const baseEstimate = Math.max(10, Math.min(300, Math.round(movie.popularity / 3)));
  
  const outcomes = generateOWBrackets(baseEstimate);
  const totalPool = outcomes.reduce((sum, o) => sum + o.totalStaked, 0);

  // Opening Weekend market
  markets.push({
    id: `market-ow-${movie.id}`,
    movieId: movie.id,
    movieTitle: movie.title,
    posterPath: movie.poster_path,
    releaseDate: movie.release_date,
    category: 'opening-weekend',
    question: `${movie.title} — Opening Weekend Domestic Gross?`,
    outcomes,
    totalPool,
    status: 'open',
    closesAt: closeDate.toISOString(),
    resolvesAt: resolveDate.toISOString(),
    createdAt: new Date().toISOString(),
  });

  // Over/Under market
  const overUnderLine = baseEstimate;
  const overStaked = Math.round(300 + Math.random() * 500);
  const underStaked = Math.round(300 + Math.random() * 500);
  const ouTotal = overStaked + underStaked;

  markets.push({
    id: `market-ou-${movie.id}`,
    movieId: movie.id,
    movieTitle: movie.title,
    posterPath: movie.poster_path,
    releaseDate: movie.release_date,
    category: 'opening-weekend',
    question: `${movie.title} — Over/Under $${overUnderLine}M Opening Weekend?`,
    outcomes: [
      { id: 'over', label: `Over $${overUnderLine}M`, totalStaked: overStaked, impliedOdds: overStaked / ouTotal },
      { id: 'under', label: `Under $${overUnderLine}M`, totalStaked: underStaked, impliedOdds: underStaked / ouTotal },
    ],
    totalPool: ouTotal,
    status: 'open',
    closesAt: closeDate.toISOString(),
    createdAt: new Date().toISOString(),
  });

  return markets;
}
