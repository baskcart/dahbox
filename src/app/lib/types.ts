// ─── Market Types ────────────────────────────────

export type MarketCategory = 'opening-weekend' | 'total-gross' | 'critical' | 'awards' | 'indie';
export type MarketStatus = 'open' | 'closed' | 'resolving' | 'resolved' | 'cancelled';

export interface MarketOutcome {
  id: string;
  label: string;          // e.g. "$100-120M"
  totalStaked: number;     // DAH staked on this outcome
  impliedOdds: number;     // 0-1 (calculated from pool)
}

export interface Market {
  id: string;
  movieId: number;         // TMDB movie ID
  movieTitle: string;
  posterPath: string | null;
  releaseDate: string;     // ISO date
  category: MarketCategory;
  question: string;        // e.g. "Opening weekend domestic gross?"
  outcomes: MarketOutcome[];
  totalPool: number;       // Total DAH in pool
  status: MarketStatus;
  closesAt: string;        // ISO datetime - when staking closes
  resolvesAt?: string;     // ISO datetime - when result is posted
  winningOutcome?: string; // ID of winning outcome after resolution
  createdAt: string;
}

export interface UserPosition {
  marketId: string;
  outcomeId: string;
  amount: number;          // DAH staked
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
