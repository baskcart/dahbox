import { Market, MarketOutcome, BookItem, GameItem } from './types';

// ─── Sample Opening Weekend Brackets ─────────────

function generateOWBrackets(baseEstimate: number): MarketOutcome[] {
  const step = baseEstimate < 50 ? 10 : baseEstimate < 150 ? 20 : 50;
  const low = Math.max(0, Math.floor(baseEstimate / step - 2) * step);
  
  const brackets: MarketOutcome[] = [];
  for (let i = 0; i < 5; i++) {
    const from = low + i * step;
    const to = from + step;
    const isCenter = i === 2;
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
  closeDate.setHours(18, 0, 0, 0);
  
  const resolveDate = new Date(releaseDate);
  resolveDate.setDate(resolveDate.getDate() + 3);

  const baseEstimate = Math.max(10, Math.min(300, Math.round(movie.popularity / 3)));
  
  const outcomes = generateOWBrackets(baseEstimate);
  const totalPool = outcomes.reduce((sum, o) => sum + o.totalStaked, 0);

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
    totalPool,
    status: 'open',
    closesAt: closeDate.toISOString(),
    resolvesAt: resolveDate.toISOString(),
    createdAt: new Date().toISOString(),
  });

  const overUnderLine = baseEstimate;
  const overStaked = Math.round(300 + Math.random() * 500);
  const underStaked = Math.round(300 + Math.random() * 500);
  const ouTotal = overStaked + underStaked;

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

// ─── Generate markets for a Book ─────────────────

export function generateMarketsForBook(book: BookItem): Market[] {
  const markets: Market[] = [];
  const closeDate = new Date();
  closeDate.setMonth(closeDate.getMonth() + 6); // 6-month prediction window

  // "Will this book become a movie?" market
  const yesStaked = Math.round(200 + Math.random() * 600);
  const noStaked = Math.round(200 + Math.random() * 600);
  const adaptTotal = yesStaked + noStaked;

  markets.push({
    id: `market-b2m-${book.id}`,
    mediaType: 'book',
    movieId: parseInt(book.id.replace(/\D/g, '').slice(0, 8)) || Math.round(Math.random() * 99999),
    movieTitle: book.title,
    posterPath: book.imageUrl,
    releaseDate: book.publishedDate || new Date().toISOString().split('T')[0],
    category: 'book-to-movie',
    question: `Will "${book.title}" get a movie/TV adaptation?`,
    outcomes: [
      { id: 'yes-movie', label: 'Yes — Movie', totalStaked: Math.round(yesStaked * 0.6), impliedOdds: 0.3 },
      { id: 'yes-tv', label: 'Yes — TV Series', totalStaked: Math.round(yesStaked * 0.4), impliedOdds: 0.2 },
      { id: 'no', label: 'No adaptation', totalStaked: noStaked, impliedOdds: 0.5 },
    ],
    totalPool: adaptTotal,
    status: 'open',
    closesAt: closeDate.toISOString(),
    createdAt: new Date().toISOString(),
  });

  // "Adaptation format" market — only for highly-rated books
  if (book.averageRating >= 4 || book.ratingsCount > 100) {
    const liveStaked = Math.round(200 + Math.random() * 400);
    const animStaked = Math.round(100 + Math.random() * 300);
    const miniStaked = Math.round(100 + Math.random() * 300);
    const formatTotal = liveStaked + animStaked + miniStaked;

    markets.push({
      id: `market-bf-${book.id}`,
      mediaType: 'book',
      movieId: parseInt(book.id.replace(/\D/g, '').slice(0, 8)) || Math.round(Math.random() * 99999),
      movieTitle: book.title,
      posterPath: book.imageUrl,
      releaseDate: book.publishedDate || new Date().toISOString().split('T')[0],
      category: 'book-to-movie',
      question: `Best format for "${book.title}" adaptation?`,
      outcomes: [
        { id: 'live-action', label: 'Live-Action Film', totalStaked: liveStaked, impliedOdds: liveStaked / formatTotal },
        { id: 'animated', label: 'Animated Film', totalStaked: animStaked, impliedOdds: animStaked / formatTotal },
        { id: 'miniseries', label: 'Limited Series', totalStaked: miniStaked, impliedOdds: miniStaked / formatTotal },
      ],
      totalPool: formatTotal,
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
  closeDate.setMonth(closeDate.getMonth() + 12); // 12-month prediction window

  // "Will this game become a movie?" market
  const yesStaked = Math.round(300 + Math.random() * 700);
  const noStaked = Math.round(200 + Math.random() * 500);
  const adaptTotal = yesStaked + noStaked;

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
      { id: 'yes-movie', label: 'Yes — Movie', totalStaked: Math.round(yesStaked * 0.55), impliedOdds: 0.3 },
      { id: 'yes-tv', label: 'Yes — TV Series', totalStaked: Math.round(yesStaked * 0.45), impliedOdds: 0.25 },
      { id: 'no', label: 'No adaptation', totalStaked: noStaked, impliedOdds: 0.45 },
    ],
    totalPool: adaptTotal,
    status: 'open',
    closesAt: closeDate.toISOString(),
    createdAt: new Date().toISOString(),
  });

  // "Live-action or animated?" market
  const liveStaked = Math.round(300 + Math.random() * 500);
  const animStaked = Math.round(200 + Math.random() * 400);
  const formatTotal = liveStaked + animStaked;

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
      { id: 'live-action', label: 'Live-Action', totalStaked: liveStaked, impliedOdds: liveStaked / formatTotal },
      { id: 'animated', label: 'Animated', totalStaked: animStaked, impliedOdds: animStaked / formatTotal },
    ],
    totalPool: formatTotal,
    status: 'open',
    closesAt: closeDate.toISOString(),
    createdAt: new Date().toISOString(),
  });

  return markets;
}

