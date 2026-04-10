// ─── Market Types ────────────────────────────────

export type MediaType = 'movie' | 'book' | 'game';
export type MarketCategory =
  | 'opening-weekend' | 'total-gross' | 'critical' | 'awards' | 'indie'   // Movies
  | 'book-to-movie' | 'bestseller' | 'book-award'                          // Books
  | 'game-to-movie' | 'game-award' | 'game-sales';                         // Games
export type MarketStatus = 'open' | 'closed' | 'resolving' | 'resolved' | 'cancelled';

export interface MarketOutcome {
  id: string;
  label: string;          // e.g. "$100-120M"
  totalStaked: number;     // DAH staked on this outcome
  impliedOdds: number;     // 0-1 (calculated from pool)
}

export interface Market {
  id: string;
  mediaType: MediaType;
  movieId: number;         // Generic item ID (movie/book/game)
  movieTitle: string;      // Generic item title
  posterPath: string | null;
  releaseDate: string;     // ISO date
  category: MarketCategory;
  question: string;
  outcomes: MarketOutcome[];
  totalPool: number;
  status: MarketStatus;
  closesAt: string;
  resolvesAt?: string;
  winningOutcome?: string;
  createdAt: string;
}

export interface UserPosition {
  marketId: string;
  outcomeId: string;
  amount: number;
  timestamp: string;
}

export interface UserProfile {
  publicKey: string;
  playerName: string;
  dahBalance: number;
  positions: UserPosition[];
  totalWins: number;
  totalProfit: number;
  rank?: number;
}

// ─── TMDB Types ──────────────────────────────────

export interface TMDBMovie {
  id: number;
  title: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  release_date: string;
  popularity: number;
  vote_average: number;
  vote_count: number;
  genre_ids: number[];
  original_language: string;
}

// ─── Book Types ──────────────────────────────────

export interface BookItem {
  id: string;
  title: string;
  authors: string[];
  description: string;
  imageUrl: string | null;
  publishedDate: string;
  categories: string[];
  averageRating: number;
  ratingsCount: number;
  pageCount: number;
}

// ─── Game Types ──────────────────────────────────

export interface GameItem {
  id: number;
  name: string;
  slug: string;
  background_image: string | null;
  released: string;
  rating: number;
  ratings_count: number;
  genres: { id: number; name: string }[];
  platforms: { platform: { id: number; name: string } }[];
  metacritic: number | null;
}

// ─── TMDB Genre Map ──────────────────────────────

export const GENRE_MAP: Record<number, string> = {
  28: 'Action', 12: 'Adventure', 16: 'Animation', 35: 'Comedy',
  80: 'Crime', 99: 'Documentary', 18: 'Drama', 10751: 'Family',
  14: 'Fantasy', 36: 'History', 27: 'Horror', 10402: 'Music',
  9648: 'Mystery', 10749: 'Romance', 878: 'Sci-Fi', 10770: 'TV Movie',
  53: 'Thriller', 10752: 'War', 37: 'Western',
};

// ─── Market Category Config ──────────────────────

export const MARKET_CATEGORIES: Record<MarketCategory, {
  icon: string;
  label: string;
  description: string;
  color: string;
}> = {
  'opening-weekend': {
    icon: '🎬',
    label: 'Opening Weekend',
    description: 'Predict domestic opening weekend gross',
    color: '#7C3AED',
  },
  'total-gross': {
    icon: '💰',
    label: 'Total Gross',
    description: 'Will it hit a box office milestone?',
    color: '#F59E0B',
  },
  'critical': {
    icon: '🍅',
    label: 'Critics & Audience',
    description: 'Rotten Tomatoes & audience scores',
    color: '#EF4444',
  },
  'awards': {
    icon: '🏆',
    label: 'Awards',
    description: 'Oscar and festival predictions',
    color: '#F59E0B',
  },
  'indie': {
    icon: '🎥',
    label: 'Indie & Festival',
    description: 'Independent film predictions',
    color: '#06B6D4',
  },
  'book-to-movie': {
    icon: '📚',
    label: 'Book → Movie',
    description: 'Will this book become a movie?',
    color: '#10B981',
  },
  'bestseller': {
    icon: '📖',
    label: 'Bestseller',
    description: 'NYT Bestseller predictions',
    color: '#8B5CF6',
  },
  'book-award': {
    icon: '✍️',
    label: 'Book Awards',
    description: 'Literary award predictions',
    color: '#EC4899',
  },
  'game-to-movie': {
    icon: '🎮',
    label: 'Game → Movie',
    description: 'Will this game become a movie?',
    color: '#3B82F6',
  },
  'game-award': {
    icon: '🕹️',
    label: 'Game Awards',
    description: 'Game of the Year predictions',
    color: '#6366F1',
  },
  'game-sales': {
    icon: '📊',
    label: 'Game Sales',
    description: 'Sales milestone predictions',
    color: '#14B8A6',
  },
};

// ─── Helpers ─────────────────────────────────────

export function calculatePayout(
  stakeAmount: number,
  outcomeStaked: number,
  totalPool: number,
  platformFee: number = 0.03
): number {
  if (outcomeStaked === 0) return 0;
  return (stakeAmount / outcomeStaked) * totalPool * (1 - platformFee);
}

export function calculateImpliedOdds(outcomeStaked: number, totalPool: number): number {
  if (totalPool === 0) return 0;
  return outcomeStaked / totalPool;
}

export function formatDAH(amount: number): string {
  if (amount >= 1000) return `${(amount / 1000).toFixed(1)}K`;
  return amount.toFixed(0);
}

export function getMultiplier(outcomeStaked: number, totalPool: number, fee: number = 0.03): string {
  if (outcomeStaked === 0) return '∞';
  const mult = (totalPool / outcomeStaked) * (1 - fee);
  return `${mult.toFixed(2)}x`;
}

