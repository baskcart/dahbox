'use client';

import { useEffect, useState } from 'react';
import {
  TrendingUp, Clock, Trophy, Film, ChevronRight,
  Wallet, Zap, BarChart3, Star, Calendar,
  Gift, Coins, CreditCard, X, ArrowRight, Sparkles,
  BookOpen, Gamepad2,
} from 'lucide-react';
import {
  Market, TMDBMovie, BookItem, GameItem, GENRE_MAP, MARKET_CATEGORIES,
  formatDAH, getMultiplier, MarketCategory, MediaType,
} from './lib/types';
import { generateMarketsForMovie, generateMarketsForBook, generateMarketsForGame } from './lib/markets';
import { movieSlug } from './lib/tmdb';

// ─── Constants ───────────────────────────────────
const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p';

// ─── Get DAH Modal ───────────────────────────────
function GetDAHModal({ onClose, onClaim }: { onClose: () => void; onClaim: () => void }) {
  const [claimed, setClaimed] = useState(false);

  const handleClaim = () => {
    setClaimed(true);
    onClaim();
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="glass-card max-w-lg w-full p-6 space-y-5" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-600 to-amber-500 flex items-center justify-center">
              <Coins className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Get DAH Tokens</h3>
              <p className="text-xs text-slate-400">Three ways to fill your wallet</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Methods */}
        <div className="space-y-3">
          {/* Method 1: Daily Bonus */}
          <div className="p-4 rounded-xl bg-gradient-to-r from-green-500/10 to-emerald-500/5 border border-green-500/20">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-green-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Gift className="w-4 h-4 text-green-400" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-semibold text-white">Daily Login Bonus</h4>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-500/20 text-green-300 font-medium">FREE</span>
                </div>
                <p className="text-xs text-slate-400 mt-1">Earn <span className="text-green-300 font-semibold">10 DAH</span> every day just for logging in. Streak bonuses multiply your rewards up to 5x.</p>
                {!claimed ? (
                  <button
                    onClick={handleClaim}
                    className="mt-2 text-xs font-semibold px-3 py-1.5 rounded-lg bg-green-500/20 text-green-300 hover:bg-green-500/30 transition-colors flex items-center gap-1"
                  >
                    <Sparkles className="w-3 h-3" /> Claim Today&apos;s 10 DAH
                  </button>
                ) : (
                  <p className="mt-2 text-xs font-semibold text-green-400">✓ 10 DAH claimed! Come back tomorrow for more.</p>
                )}
              </div>
            </div>
          </div>

          {/* Method 2: Win Predictions */}
          <div className="p-4 rounded-xl bg-gradient-to-r from-purple-500/10 to-violet-500/5 border border-purple-500/20">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Trophy className="w-4 h-4 text-purple-400" />
              </div>
              <div className="flex-1">
                <h4 className="text-sm font-semibold text-white">Win Predictions</h4>
                <p className="text-xs text-slate-400 mt-1">Stake DAH on correct outcomes and earn back <span className="text-purple-300 font-semibold">up to 10x</span> your stake. Better odds = bigger payouts when you&apos;re right.</p>
              </div>
            </div>
          </div>

          {/* Method 3: Purchase */}
          <div className="p-4 rounded-xl bg-gradient-to-r from-amber-500/10 to-orange-500/5 border border-amber-500/20">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                <CreditCard className="w-4 h-4 text-amber-400" />
              </div>
              <div className="flex-1">
                <h4 className="text-sm font-semibold text-white">Buy DAH</h4>
                <p className="text-xs text-slate-400 mt-1">Purchase DAH directly through the <span className="text-amber-300 font-semibold">Dahling ecosystem</span>. Accepted at any Dah.fi kiosk or online at dah.ym.</p>
              </div>
            </div>
          </div>
        </div>

        {/* DAHLOR teaser */}
        <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-500/5 border border-amber-500/10">
          <Zap className="w-4 h-4 text-amber-400 flex-shrink-0" />
          <p className="text-xs text-slate-400">
            <span className="text-amber-300 font-medium">Remember:</span> Every DAH you earn today matures into DAHLOR (1 DAHLOR = 1 USD) in 2027.
          </p>
        </div>

        <button onClick={onClose} className="stake-btn w-full py-3 text-center">Got It — Let&apos;s Predict</button>
      </div>
    </div>
  );
}

// ─── Stake Modal ─────────────────────────────────
function StakeModal({ market, onClose }: { market: Market; onClose: () => void }) {
  const [selectedOutcome, setSelectedOutcome] = useState<string | null>(null);
  const [amount, setAmount] = useState(10);
  const [staked, setStaked] = useState(false);

  const outcome = market.outcomes.find(o => o.id === selectedOutcome);
  const potentialPayout = outcome
    ? ((amount / (outcome.totalStaked + amount)) * (market.totalPool + amount) * 0.97).toFixed(1)
    : '0';

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="glass-card max-w-md w-full p-6 space-y-5" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-start gap-3">
          {market.posterPath && (
            <img
              src={`${TMDB_IMAGE_BASE}/w92${market.posterPath}`}
              alt={market.movieTitle}
              className="w-14 h-20 rounded-lg object-cover"
            />
          )}
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-bold text-white truncate">{market.movieTitle}</h3>
            <p className="text-sm text-purple-300 mt-0.5">{market.question}</p>
            <p className="text-xs text-slate-400 mt-1">Pool: {formatDAH(market.totalPool)} DAH</p>
          </div>
        </div>

        {staked ? (
          /* Success State */
          <div className="text-center py-6 space-y-3">
            <div className="text-5xl">🎬</div>
            <h4 className="text-xl font-bold text-white">Position Placed!</h4>
            <p className="text-purple-300">
              {amount} DAH on &ldquo;{outcome?.label}&rdquo;
            </p>
            <p className="text-sm text-slate-400">
              Potential payout: <span className="text-amber-400 font-semibold">{potentialPayout} DAH</span>
            </p>
            <button onClick={onClose} className="stake-btn mt-4 w-full">Done</button>
          </div>
        ) : (
          <>
            {/* Outcome Selection */}
            <div className="space-y-2">
              <p className="text-sm font-medium text-slate-300">Select your prediction:</p>
              {market.outcomes.map(o => {
                const isSelected = selectedOutcome === o.id;
                const pct = market.totalPool > 0 ? (o.totalStaked / market.totalPool * 100).toFixed(0) : '0';
                return (
                  <button
                    key={o.id}
                    onClick={() => setSelectedOutcome(o.id)}
                    className={`w-full flex items-center justify-between p-3 rounded-xl border transition-all ${
                      isSelected
                        ? 'border-purple-500 bg-purple-500/15'
                        : 'border-white/10 bg-white/5 hover:border-white/20'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                        isSelected ? 'border-purple-400' : 'border-slate-500'
                      }`}>
                        {isSelected && <div className="w-2 h-2 rounded-full bg-purple-400" />}
                      </div>
                      <span className="text-white font-medium text-sm">{o.label}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-xs text-slate-400">{pct}%</span>
                      <span className="text-xs text-amber-400 ml-2">{getMultiplier(o.totalStaked, market.totalPool)}</span>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Amount */}
            <div className="space-y-2">
              <p className="text-sm font-medium text-slate-300">Stake amount (DAH):</p>
              <div className="flex gap-2">
                {[5, 10, 25, 50, 100].map(v => (
                  <button
                    key={v}
                    onClick={() => setAmount(v)}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                      amount === v
                        ? 'bg-purple-600 text-white'
                        : 'bg-white/5 text-slate-300 hover:bg-white/10'
                    }`}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>

            {/* Potential Payout */}
            {selectedOutcome && (
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 flex justify-between items-center">
                <span className="text-sm text-amber-200">Potential payout</span>
                <span className="text-lg font-bold text-amber-400">{potentialPayout} DAH</span>
              </div>
            )}

            {/* Stake Button */}
            <button
              onClick={() => setStaked(true)}
              disabled={!selectedOutcome}
              className="stake-btn w-full py-3 text-center disabled:opacity-30 disabled:cursor-not-allowed"
            >
              {selectedOutcome ? `Stake ${amount} DAH` : 'Select a prediction'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Movie Card (groups all markets for one movie) ─
function MovieCard({ markets, onStake }: { markets: Market[]; onStake: (m: Market) => void }) {
  const [activeIdx, setActiveIdx] = useState(0);
  const market = markets[activeIdx];
  const daysLeft = Math.max(0, Math.ceil((new Date(market.closesAt).getTime() - Date.now()) / 86400000));
  const catConfig = MARKET_CATEGORIES[market.category];

  // Market type labels for tabs
  const tabLabels = markets.map(m => {
    if (m.question.includes('Over/Under')) return 'Over/Under';
    if (m.question.includes('Opening Weekend')) return 'OW Bracket';
    if (m.question.includes('Will') && m.question.includes('adaptation')) return 'Adaptation?';
    if (m.question.includes('Best format') || m.question.includes('Live-Action or')) return 'Format';
    return 'Market';
  });

  return (
    <div className="glass-card overflow-hidden group">
      {/* Poster + Gradient overlay */}
      <div className="relative h-44 poster-shimmer">
        {market.posterPath ? (
          <img
            src={market.posterPath.startsWith('http') ? market.posterPath : `${TMDB_IMAGE_BASE}/w500${market.posterPath}`}
            alt={market.movieTitle}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-purple-900/40 to-slate-900 flex items-center justify-center">
            <Film className="w-12 h-12 text-purple-400/40" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[#1A1A3E] via-[#1A1A3E]/60 to-transparent" />
        
        {/* Status badges */}
        <div className="absolute top-3 left-3 flex items-center gap-2">
          <span className="text-xs px-2 py-1 rounded-full bg-black/50 backdrop-blur-sm border border-white/10">
            {catConfig.icon} {catConfig.label}
          </span>
        </div>
        <div className="absolute top-3 right-3 flex items-center gap-1.5 text-xs px-2 py-1 rounded-full bg-black/50 backdrop-blur-sm border border-white/10">
          <div className="live-dot" />
          <span className="text-green-300">{daysLeft}d left</span>
        </div>

        {/* Title overlay — links to SEO page for movies */}
        {market.mediaType === 'movie' ? (
          <a href={`/movie/${movieSlug(market.movieTitle, market.movieId)}`} className="absolute bottom-3 left-3 right-3 group/title">
            <h3 className="text-white font-bold text-lg leading-tight truncate group-hover/title:text-purple-300 transition-colors">{market.movieTitle}</h3>
            <p className="text-slate-300 text-xs mt-0.5 flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {new Date(market.releaseDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </p>
          </a>
        ) : (
          <div className="absolute bottom-3 left-3 right-3">
            <h3 className="text-white font-bold text-lg leading-tight truncate">{market.movieTitle}</h3>
            <p className="text-slate-300 text-xs mt-0.5 flex items-center gap-1">
              {market.mediaType === 'book' ? <BookOpen className="w-3 h-3" /> : <Gamepad2 className="w-3 h-3" />}
              {market.mediaType === 'book' ? 'Novel' : 'Video Game'}
            </p>
          </div>
        )}
      </div>

      {/* Market type tabs */}
      {markets.length > 1 && (
        <div className="flex border-b border-white/5">
          {markets.map((m, idx) => (
            <button
              key={m.id}
              onClick={() => setActiveIdx(idx)}
              className={`flex-1 py-2 text-xs font-medium transition-all ${
                idx === activeIdx
                  ? 'text-purple-300 border-b-2 border-purple-500 bg-purple-500/5'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              {tabLabels[idx]}
            </button>
          ))}
        </div>
      )}

      {/* Market content */}
      <div className="p-4 space-y-3">
        <p className="text-sm text-purple-200 font-medium">{market.question}</p>

        {/* Top outcomes */}
        <div className="space-y-2">
          {market.outcomes.slice(0, 3).map(o => {
            const pct = market.totalPool > 0 ? (o.totalStaked / market.totalPool * 100) : 0;
            return (
              <div key={o.id} className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-300">{o.label}</span>
                  <span className="text-amber-400 font-medium">{getMultiplier(o.totalStaked, market.totalPool)}</span>
                </div>
                <div className="odds-bar h-2">
                  <div className="odds-fill" style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
          {market.outcomes.length > 3 && (
            <p className="text-xs text-slate-500">+{market.outcomes.length - 3} more options</p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-2 border-t border-white/5">
          <div className="flex items-center gap-1 text-xs text-slate-400">
            <BarChart3 className="w-3 h-3" />
            <span>{formatDAH(market.totalPool)} DAH pool</span>
          </div>
          <button
            onClick={() => onStake(market)}
            className="stake-btn text-xs py-2 px-4"
          >
            Predict
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────

// Languages with significant film industries
const LANGUAGES = [
  { code: '', label: '🌍 All Languages' },
  { code: 'en', label: '🇺🇸 English' },
  { code: 'ko', label: '🇰🇷 Korean' },
  { code: 'hi', label: '🇮🇳 Hindi' },
  { code: 'ta', label: '🇮🇳 Tamil' },
  { code: 'te', label: '🇮🇳 Telugu' },
  { code: 'ja', label: '🇯🇵 Japanese' },
  { code: 'zh', label: '🇨🇳 Chinese' },
  { code: 'es', label: '🇪🇸 Spanish' },
  { code: 'fr', label: '🇫🇷 French' },
  { code: 'ar', label: '🇸🇦 Arabic' },
  { code: 'tl', label: '🇵🇭 Filipino' },
  { code: 'th', label: '🇹🇭 Thai' },
  { code: 'id', label: '🇮🇩 Indonesian' },
  { code: 'tr', label: '🇹🇷 Turkish' },
  { code: 'pt', label: '🇧🇷 Portuguese' },
  { code: 'de', label: '🇩🇪 German' },
  { code: 'it', label: '🇮🇹 Italian' },
];

// TMDB genre IDs
const GENRES = [
  { id: '', label: '🎬 All Genres' },
  { id: '28', label: '💥 Action' },
  { id: '16', label: '🎨 Animation' },
  { id: '35', label: '😂 Comedy' },
  { id: '80', label: '🔪 Crime' },
  { id: '18', label: '🎭 Drama' },
  { id: '14', label: '🧙 Fantasy' },
  { id: '27', label: '👻 Horror' },
  { id: '10402', label: '🎵 Music' },
  { id: '9648', label: '🕵️ Mystery' },
  { id: '10749', label: '💕 Romance' },
  { id: '878', label: '🚀 Sci-Fi' },
  { id: '53', label: '😰 Thriller' },
  { id: '10752', label: '⚔️ War' },
  { id: '12', label: '🗺️ Adventure' },
  { id: '10751', label: '👨‍👩‍👧 Family' },
  { id: '36', label: '📜 History' },
  { id: '99', label: '📹 Documentary' },
];

export default function DahBoxHome() {
  const [markets, setMarkets] = useState<Market[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<MarketCategory | 'all'>('all');
  const [selectedMarket, setSelectedMarket] = useState<Market | null>(null);
  const [dahBalance, setDahBalance] = useState(250);
  const [showGetDAH, setShowGetDAH] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState('');
  const [selectedGenre, setSelectedGenre] = useState('');
  const [mediaTab, setMediaTab] = useState<MediaType>('movie');

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setActiveCategory('all');
      try {
        if (mediaTab === 'movie') {
          const params = new URLSearchParams({ category: 'upcoming' });
          if (selectedLanguage) params.set('language', selectedLanguage);
          if (selectedGenre) params.set('genre', selectedGenre);

          const res = await fetch(`/api/movies?${params.toString()}`);
          const data = await res.json();
          if (data.success && data.movies?.length > 0) {
            const allMarkets: Market[] = [];
            const topMovies = data.movies
              .filter((m: TMDBMovie) => m.poster_path)
              .slice(0, 12);
            for (const movie of topMovies) {
              allMarkets.push(...generateMarketsForMovie(movie));
            }
            setMarkets(allMarkets);
            return;
          }
          setMarkets([]);
        } else if (mediaTab === 'book') {
          const params = new URLSearchParams({ category: 'trending' });
          if (selectedGenre) params.set('genre', selectedGenre);

          const res = await fetch(`/api/books?${params.toString()}`);
          const data = await res.json();
          if (data.success && data.books?.length > 0) {
            const allMarkets: Market[] = [];
            const topBooks = data.books
              .filter((b: BookItem) => b.imageUrl)
              .slice(0, 12);
            for (const book of topBooks) {
              allMarkets.push(...generateMarketsForBook(book));
            }
            setMarkets(allMarkets);
            return;
          }
          setMarkets([]);
        } else if (mediaTab === 'game') {
          const params = new URLSearchParams({ category: 'popular' });
          if (selectedGenre) params.set('genre', selectedGenre);

          const res = await fetch(`/api/games?${params.toString()}`);
          const data = await res.json();
          if (data.success && data.games?.length > 0) {
            const allMarkets: Market[] = [];
            const topGames = data.games
              .filter((g: GameItem) => g.background_image || g.name)
              .slice(0, 12);
            for (const game of topGames) {
              allMarkets.push(...generateMarketsForGame(game));
            }
            setMarkets(allMarkets);
            return;
          }
          setMarkets([]);
        }
      } catch (err) {
        console.error(`Failed to load ${mediaTab}s:`, err);
        setMarkets([]);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [mediaTab, selectedLanguage, selectedGenre]);

  const filteredMarkets = activeCategory === 'all'
    ? markets
    : markets.filter(m => m.category === activeCategory);

  // Group markets by movie so each movie appears once
  const movieGroups = filteredMarkets.reduce<Record<number, Market[]>>((acc, m) => {
    if (!acc[m.movieId]) acc[m.movieId] = [];
    acc[m.movieId].push(m);
    return acc;
  }, {});
  const groupedMovies = Object.values(movieGroups);

  const categoriesForTab: Record<MediaType, MarketCategory[]> = {
    movie: ['opening-weekend', 'total-gross', 'critical', 'awards', 'indie'],
    book: ['book-to-movie', 'bestseller', 'book-award'],
    game: ['game-to-movie', 'game-award', 'game-sales'],
  };
  const categories = ['all', ...categoriesForTab[mediaTab]] as (MarketCategory | 'all')[];

  return (
    <div className="min-h-screen relative">
      <div className="cinema-glow" />

      {/* ─── Header ─── */}
      <header className="sticky top-0 z-40 border-b border-white/5" style={{ background: 'rgba(10,10,26,0.85)', backdropFilter: 'blur(20px)' }}>
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-purple-600 to-amber-500 flex items-center justify-center">
              <span className="text-lg font-black text-white">D</span>
            </div>
            <div>
              <h1 className="text-lg font-bold text-white tracking-tight">DahBox</h1>
              <p className="text-[10px] text-slate-400 -mt-0.5">Movie Prediction Market</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* DAHLOR maturity teaser */}
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 maturity-badge">
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-xs text-amber-300 font-medium">DAHLOR 2027</span>
            </div>

            {/* Get DAH CTA */}
            <button
              onClick={() => setShowGetDAH(true)}
              className="get-dah-btn flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold"
            >
              <Coins className="w-3.5 h-3.5" />
              Get DAH
            </button>
            
            {/* Balance */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10">
              <Wallet className="w-4 h-4 text-purple-400" />
              <span className="text-sm font-semibold text-white">{dahBalance}</span>
              <span className="text-xs text-slate-400">DAH</span>
            </div>
          </div>
        </div>
      </header>

      {/* ─── Hero ─── */}
      <section className="relative max-w-7xl mx-auto px-4 pt-10 pb-6">
        <div className="text-center space-y-3 fade-in-up">
          <h2 className="text-4xl md:text-5xl font-extrabold text-white">
            {mediaTab === 'movie' && <>Predict the <span className="bg-gradient-to-r from-purple-400 to-amber-400 bg-clip-text text-transparent">Box Office</span></>}
            {mediaTab === 'book' && <>Which Books Become <span className="bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">Movies</span>?</>}
            {mediaTab === 'game' && <>Which Games Become <span className="bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">Movies</span>?</>}
          </h2>
          <p className="text-lg text-slate-400 max-w-xl mx-auto">
            {mediaTab === 'movie' && 'Stake DAH on opening weekends, total gross, and critic scores. Win big when you call it right.'}
            {mediaTab === 'book' && 'Predict which bestselling novels will get a movie or TV adaptation. Stake DAH on your literary instincts.'}
            {mediaTab === 'game' && 'Predict which iconic video games will get Hollywood adaptations. Live-action or animated? You decide.'}
          </p>
          <p className="text-sm text-slate-500 max-w-md mx-auto">
            New here? <button onClick={() => setShowGetDAH(true)} className="text-purple-400 hover:text-purple-300 font-medium underline underline-offset-2 transition-colors">Learn how to get DAH tokens</button> to start predicting.
          </p>
          <div className="flex items-center justify-center gap-6 pt-2">
            <div className="flex items-center gap-2 text-sm text-slate-300">
              <TrendingUp className="w-4 h-4 text-green-400" />
              <span>{groupedMovies.length} {mediaTab === 'movie' ? 'Movies' : mediaTab === 'book' ? 'Books' : 'Games'}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-slate-300">
              <Trophy className="w-4 h-4 text-amber-400" />
              <span>{formatDAH(markets.reduce((s, m) => s + m.totalPool, 0))} DAH Staked</span>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Media Type Tabs ─── */}
      <section className="max-w-7xl mx-auto px-4 pb-3">
        <div className="flex gap-1 p-1 rounded-2xl bg-white/5 border border-white/10 w-fit">
          {[
            { id: 'movie' as MediaType, label: 'Movies', icon: <Film className="w-4 h-4" />, color: 'from-purple-500 to-amber-500' },
            { id: 'book' as MediaType, label: 'Books', icon: <BookOpen className="w-4 h-4" />, color: 'from-emerald-500 to-teal-500' },
            { id: 'game' as MediaType, label: 'Games', icon: <Gamepad2 className="w-4 h-4" />, color: 'from-blue-500 to-indigo-500' },
          ].map(tab => {
            const isActive = mediaTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => { setMediaTab(tab.id); setSelectedLanguage(''); setSelectedGenre(''); }}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                  isActive
                    ? `bg-gradient-to-r ${tab.color} text-white shadow-lg`
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            );
          })}
        </div>
      </section>

      {/* ─── Category Tabs ─── */}
      <section className="max-w-7xl mx-auto px-4 pb-2">
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          {categories.map(cat => {
            const isActive = activeCategory === cat;
            const config = cat === 'all' ? null : MARKET_CATEGORIES[cat];
            return (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium border whitespace-nowrap transition-all ${
                  isActive ? 'tab-active' : 'border-white/10 text-slate-400 hover:text-white hover:border-white/20'
                }`}
              >
                {cat === 'all' ? (
                  <>
                    <Star className="w-3.5 h-3.5" /> All
                  </>
                ) : (
                  <>
                    <span>{config?.icon}</span> {config?.label}
                  </>
                )}
              </button>
            );
          })}
        </div>
      </section>

      {/* ─── Language & Genre Filters (Movies only) ─── */}
      {mediaTab === 'movie' && (
      <section className="max-w-7xl mx-auto px-4 pb-4">
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={selectedLanguage}
            onChange={e => setSelectedLanguage(e.target.value)}
            className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-slate-300 
                       focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/25
                       appearance-none cursor-pointer hover:border-white/20 transition-all
                       bg-[url('data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2212%22%20height%3D%2212%22%20viewBox%3D%220%200%2012%2012%22%3E%3Cpath%20fill%3D%22%239ca3af%22%20d%3D%22M2%204l4%204%204-4%22%2F%3E%3C%2Fsvg%3E')]
                       bg-no-repeat bg-[center_right_0.75rem] pr-8"
          >
            {LANGUAGES.map(l => (
              <option key={l.code} value={l.code} className="bg-[#1A1A3E]">{l.label}</option>
            ))}
          </select>
          <select
            value={selectedGenre}
            onChange={e => setSelectedGenre(e.target.value)}
            className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-slate-300 
                       focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/25
                       appearance-none cursor-pointer hover:border-white/20 transition-all
                       bg-[url('data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2212%22%20height%3D%2212%22%20viewBox%3D%220%200%2012%2012%22%3E%3Cpath%20fill%3D%22%239ca3af%22%20d%3D%22M2%204l4%204%204-4%22%2F%3E%3C%2Fsvg%3E')]
                       bg-no-repeat bg-[center_right_0.75rem] pr-8"
          >
            {GENRES.map(g => (
              <option key={g.id} value={g.id} className="bg-[#1A1A3E]">{g.label}</option>
            ))}
          </select>
          {(selectedLanguage || selectedGenre) && (
            <button
              onClick={() => { setSelectedLanguage(''); setSelectedGenre(''); }}
              className="text-xs text-slate-500 hover:text-slate-300 underline underline-offset-2 transition-colors"
            >
              Clear filters
            </button>
          )}
        </div>
      </section>
      )}

      {/* ─── Markets Grid ─── */}
      <section className="max-w-7xl mx-auto px-4 pb-20">
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="glass-card h-96 animate-pulse">
                <div className="h-44 bg-white/5" />
                <div className="p-4 space-y-3">
                  <div className="h-4 bg-white/5 rounded w-3/4" />
                  <div className="h-3 bg-white/5 rounded w-1/2" />
                  <div className="h-2 bg-white/5 rounded" />
                  <div className="h-2 bg-white/5 rounded" />
                  <div className="h-2 bg-white/5 rounded w-2/3" />
                </div>
              </div>
            ))}
          </div>
        ) : groupedMovies.length === 0 ? (
          <div className="text-center py-20">
            <Film className="w-16 h-16 text-slate-600 mx-auto mb-4" />
            <p className="text-slate-400 text-lg">
              {(selectedLanguage || selectedGenre)
                ? `No upcoming movies found for this ${selectedLanguage ? 'language' : ''}${selectedLanguage && selectedGenre ? ' + ' : ''}${selectedGenre ? 'genre' : ''} combo`
                : 'No markets in this category yet'}
            </p>
            {(selectedLanguage || selectedGenre) && (
              <button
                onClick={() => { setSelectedLanguage(''); setSelectedGenre(''); }}
                className="mt-3 text-sm text-purple-400 hover:text-purple-300 underline underline-offset-2 transition-colors"
              >
                Clear filters to see all movies
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {groupedMovies.map((movieMarkets, i) => (
              <div key={movieMarkets[0].movieId} className={`fade-in-up fade-in-up-delay-${Math.min(i + 1, 4)}`}>
                <MovieCard markets={movieMarkets} onStake={setSelectedMarket} />
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ─── How to Get DAH ─── */}
      <section className="max-w-7xl mx-auto px-4 pb-8">
        <div className="glass-card p-6 md:p-8">
          <div className="flex items-center gap-2 mb-5">
            <Coins className="w-5 h-5 text-purple-400" />
            <h3 className="text-lg font-bold text-white">How to Get DAH</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Way 1 */}
            <div className="p-4 rounded-xl bg-gradient-to-br from-green-500/10 to-emerald-500/5 border border-green-500/15 space-y-2">
              <div className="w-9 h-9 rounded-lg bg-green-500/20 flex items-center justify-center">
                <Gift className="w-4.5 h-4.5 text-green-400" />
              </div>
              <h4 className="text-sm font-semibold text-white">Daily Login Bonus</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Earn <span className="text-green-300 font-semibold">10 DAH free</span> every day. Build a streak for up to 5x multiplier.
              </p>
              <button
                onClick={() => setShowGetDAH(true)}
                className="text-xs text-green-300 font-medium flex items-center gap-1 hover:text-green-200 transition-colors mt-1"
              >
                Claim Now <ArrowRight className="w-3 h-3" />
              </button>
            </div>
            {/* Way 2 */}
            <div className="p-4 rounded-xl bg-gradient-to-br from-purple-500/10 to-violet-500/5 border border-purple-500/15 space-y-2">
              <div className="w-9 h-9 rounded-lg bg-purple-500/20 flex items-center justify-center">
                <Trophy className="w-4.5 h-4.5 text-purple-400" />
              </div>
              <h4 className="text-sm font-semibold text-white">Win Predictions</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Correct predictions pay out <span className="text-purple-300 font-semibold">up to 10x</span> your stake. Higher risk = bigger reward.
              </p>
            </div>
            {/* Way 3 */}
            <div className="p-4 rounded-xl bg-gradient-to-br from-amber-500/10 to-orange-500/5 border border-amber-500/15 space-y-2">
              <div className="w-9 h-9 rounded-lg bg-amber-500/20 flex items-center justify-center">
                <CreditCard className="w-4.5 h-4.5 text-amber-400" />
              </div>
              <h4 className="text-sm font-semibold text-white">Buy DAH</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Purchase at any <span className="text-amber-300 font-semibold">Dah.fi kiosk</span> or online at dah.ym within the Dahling ecosystem.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ─── DAHLOR Banner ─── */}
      <section className="max-w-7xl mx-auto px-4 pb-12">
        <div className="glass-card p-6 md:p-8 gold-glow flex flex-col md:flex-row items-center gap-6">
          <div className="flex-shrink-0 w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center">
            <span className="text-3xl font-black text-white">$</span>
          </div>
          <div className="flex-1 text-center md:text-left">
            <h3 className="text-xl font-bold text-white">DAH → DAHLOR in 2027</h3>
            <p className="text-slate-400 mt-1 text-sm">
              Your DAH tokens will mature into DAHLOR — a USD-pegged stablecoin. 
              Every DAH you earn or buy today becomes real value. Start predicting now to build your balance.
            </p>
          </div>
          <button className="stake-btn flex items-center gap-2 whitespace-nowrap">
            Learn More <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </section>

      {/* ─── Footer ─── */}
      <footer className="border-t border-white/5 py-6">
        <div className="max-w-7xl mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <div className="w-5 h-5 rounded bg-gradient-to-br from-purple-600 to-amber-500 flex items-center justify-center">
              <span className="text-[10px] font-black text-white">D</span>
            </div>
            <span>DahBox · box.dah.gg</span>
          </div>
          <div className="flex items-center gap-4 text-xs text-slate-500">
            <span>Resolution: Box Office Mojo</span>
            <span>·</span>
            <span>Platform Fee: 3%</span>
            <span>·</span>
            <span>Powered by Dahling Ecosystem</span>
          </div>
        </div>
      </footer>

      {/* ─── Stake Modal ─── */}
      {selectedMarket && (
        <StakeModal market={selectedMarket} onClose={() => setSelectedMarket(null)} />
      )}

      {/* ─── Get DAH Modal ─── */}
      {showGetDAH && (
        <GetDAHModal
          onClose={() => setShowGetDAH(false)}
          onClaim={() => setDahBalance(prev => prev + 10)}
        />
      )}
    </div>
  );
}
