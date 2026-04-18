'use client';

import { useEffect, useState } from 'react';
import {
  TrendingUp, Trophy, Film, ChevronRight,
  Zap, BarChart3, Star, Calendar,
  Coins, X, Sparkles,
  Smartphone,
  BookOpen, Gamepad2, CheckCircle2, PlayCircle, Loader2,
} from 'lucide-react';
import {
  Market, TMDBMovie, BookItem, GameItem, GENRE_MAP, MARKET_CATEGORIES,
  formatDAH, getMultiplier, MarketCategory, MediaType,
} from './lib/types';
import { generateMarketsForMovie, generateMarketsForBook, generateMarketsForGame } from './lib/markets';
import { movieSlug } from './lib/tmdb';
import { useRouter } from 'next/navigation';

// --- Constants ---
const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p';

// ─── Overlay real pool data from DAHBOX_STAKES ───
// Called after markets are generated so all totalPool / totalStaked values
// reflect actual stakes instead of the 0-initialised defaults in markets.ts.
type PoolTotals = Record<string, {
  totalPool: number;
  outcomeTotals: Record<string, number>;
}>;

function overlayRealPoolData(markets: Market[], totals: PoolTotals): Market[] {
  return markets.map((m) => {
    const poolData = totals[m.id];
    if (!poolData) return m; // no stakes yet — keep zeros
    const totalPool = poolData.totalPool;
    const outcomes = m.outcomes.map((o) => {
      const staked = poolData.outcomeTotals[o.id] || 0;
      return {
        ...o,
        totalStaked: staked,
        impliedOdds: totalPool > 0 ? staked / totalPool : o.impliedOdds,
      };
    });
    return { ...m, totalPool, outcomes };
  });
}

async function fetchRealPoolTotals(marketIds: string[]): Promise<PoolTotals> {
  if (marketIds.length === 0) return {};
  try {
    const res = await fetch(`/api/stake/totals?marketIds=${encodeURIComponent(marketIds.join(','))}`);
    if (!res.ok) return {};
    const data = await res.json();
    return data.success ? data.totals : {};
  } catch {
    return {}; // degrade gracefully — UI shows 0 DAH pool which is honest
  }
}

// --- Get DAH Modal ---
function GetDAHModal({ onClose }: { onClose: () => void }) {
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
              <p className="text-xs text-slate-400">Two ways to earn DAH</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Methods */}
        <div className="space-y-3">
          {/* Method 1: Install / Bookmark / Add to Home Screen */}
          <div className="p-4 rounded-xl bg-gradient-to-r from-green-500/10 to-emerald-500/5 border border-green-500/20">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-green-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Smartphone className="w-4 h-4 text-green-400" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-semibold text-white">Install the App</h4>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-500/20 text-green-300 font-medium">EARN DAH</span>
                </div>
                <p className="text-xs text-slate-400 mt-1">Visit <span className="text-green-300 font-semibold">dah.mx</span> on your phone. Install the app, bookmark it, or add it to your Home Screen. You earn DAH every time you use it at a venue.</p>
              </div>
            </div>
          </div>

          {/* Method 2: Create & Share Games */}
          <div className="p-4 rounded-xl bg-gradient-to-r from-purple-500/10 to-violet-500/5 border border-purple-500/20">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Sparkles className="w-4 h-4 text-purple-400" />
              </div>
              <div className="flex-1">
                <h4 className="text-sm font-semibold text-white">Create &amp; Share Games</h4>
                <p className="text-xs text-slate-400 mt-1">Build trivia, Smarty, or Charades games in the <span className="text-purple-300 font-semibold">Dahling ecosystem</span>. Share them â€” DAH is rewarded each time your game is played at a venue.</p>
              </div>
            </div>
          </div>
        </div>

        {/* DAHLOR teaser */}
        <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-500/5 border border-amber-500/10">
          <Zap className="w-4 h-4 text-amber-400 flex-shrink-0" />
          <p className="text-xs text-slate-400">
            <span className="text-amber-300 font-medium">Remember:</span> Every DAH you earn today matures into DAHLOR (1 DAHLOR = 1 USD) when Mainnet launches in Oct 2026.
          </p>
        </div>

        <button onClick={onClose} className="stake-btn w-full py-3 text-center">Got It &mdash; Let&apos;s Predict</button>
      </div>
    </div>
  );
}

// â”€â”€â”€ Stake Modal â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function StakeModal({ market, onClose }: { market: Market; onClose: () => void }) {
  const [selectedOutcome, setSelectedOutcome] = useState<string | null>(null);
  const [amount, setAmount] = useState(10);
  const [staked, setStaked] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [stakeError, setStakeError] = useState<string | null>(null);

  // Memi owns all ledger writes AND stake recording.
  // STAKE_CONFIRMED is only sent after both the Rolledge debit AND
  // the DahBox /api/stake record have succeeded — show success directly.
  useEffect(() => {
    const handleMsg = (e: MessageEvent) => {
      if (e.data?.type === 'STAKE_CONFIRMED' && e.data?.transactionId) {
        setStaked(true);
        setIsProcessing(false);
      }
      if (e.data?.type === 'STAKE_REJECTED') {
        setIsProcessing(false);
        setStakeError(e.data?.error || 'Stake rejected. Check your DAH balance.');
      }
    };
    window.addEventListener('message', handleMsg);
    return () => window.removeEventListener('message', handleMsg);
  }, []);

  const outcome = market.outcomes.find(o => o.id === selectedOutcome);
  const potentialPayout = outcome
    ? ((amount / (outcome.totalStaked + amount)) * (market.totalPool + amount) * 0.97).toFixed(1)
    : '0';

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex flex-col items-center justify-center z-50 p-3" onClick={onClose}>
      <div className="glass-card max-w-md w-full p-4 space-y-3 shadow-xl" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-start gap-3">
          {market.posterPath && (
            <img
              src={`${TMDB_IMAGE_BASE}/w92${market.posterPath}`}
              alt={market.movieTitle}
              className="w-10 h-14 rounded-lg object-cover"
            />
          )}
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-bold text-white leading-tight truncate">{market.movieTitle}</h3>
            <p className="text-xs text-purple-300 mt-0.5 leading-snug">{market.question}</p>
            <p className="text-[10px] text-slate-400 mt-1">Pool: {formatDAH(market.totalPool)} DAH</p>
          </div>
        </div>

        {staked ? (
          /* Success State */
          <div className="text-center py-6 space-y-3">
            <div className="text-5xl">ðŸŽ¬</div>
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
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-slate-300">Select your prediction:</p>
              {market.outcomes.map(o => {
                const isSelected = selectedOutcome === o.id;
                const pct = market.totalPool > 0 ? (o.totalStaked / market.totalPool * 100).toFixed(0) : '0';
                return (
                  <button
                    key={o.id}
                    onClick={() => setSelectedOutcome(o.id)}
                    className={`w-full flex items-center justify-between py-2 px-3 rounded-lg border transition-all ${
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
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-slate-300">Stake amount (DAH):</p>
              <div className="flex gap-1.5">
                {[5, 10, 25, 50, 100].map(v => (
                  <button
                    key={v}
                    onClick={() => setAmount(v)}
                    className={`flex-1 py-1.5 rounded-md text-xs font-medium transition-all ${
                      amount === v
                        ? 'bg-purple-600 text-white shadow-inner'
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
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-2.5 flex justify-between items-center">
                <span className="text-xs text-amber-200">Potential payout</span>
                <span className="text-sm font-bold text-amber-400">{potentialPayout} DAH</span>
              </div>
            )}

            {/* Stake Error */}
            {stakeError && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-2.5 text-xs text-red-300">
                <span className="font-semibold mr-1">Error:</span>{stakeError}
              </div>
            )}

            {/* Stake Button */}
            <button
              onClick={() => {
                if (!selectedOutcome || !outcome) return;
                const urlParams = new URLSearchParams(window.location.search);
                const screenCode = urlParams.get('screenCode') || 'PHONE_MODE';
                setIsProcessing(true);
                setStakeError(null);
                // Send to Memi â€” Memi holds the ML-DSA signing key and calls
                // Rolledge /api/ledger/transfer with a real signature.
                // DahBox records the stake only after STAKE_CONFIRMED + transactionId.
                window.parent.postMessage({
                  type: 'STAKE_PLACED',
                  screenCode,
                  payload: {
                    amount,
                    marketId: market.id,
                    outcomeId: selectedOutcome,
                    outcomeLabel: outcome.label,
                    movieTitle: market.movieTitle,
                    totalPool: market.totalPool,
                    outcomeStaked: outcome.totalStaked || 0,
                  },
                }, '*');
              }}
              disabled={!selectedOutcome || isProcessing}
              className="stake-btn w-full py-2.5 text-sm font-bold text-center disabled:opacity-30 disabled:cursor-not-allowed flex justify-center items-center gap-2"
            >
              {isProcessing && <Loader2 size={16} className="animate-spin" />}
              {isProcessing ? 'Processing...' : (selectedOutcome ? `Stake ${amount} DAH` : 'Select a prediction')}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// â”€â”€â”€ Resolution state type â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
interface MarketResolutionState {
  winningOutcomeId: string;
  winningOutcomeLabel: string;
  realValue?: string;
  resolvedAt: string;
}

// â”€â”€â”€ Movie Card (groups all markets for one movie) â”€
function MovieCard({ markets, onStake, resolutions, onResolve }: {
  markets: Market[];
  onStake: (m: Market) => void;
  resolutions: Map<string, MarketResolutionState>;
  onResolve: (movieId: number, markets: Market[], mode: 'simulate' | 'real') => void;
}) {
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

  const resolution = resolutions.get(market.id);
  const isResolved = !!resolution;

  return (
    <div className={`glass-card overflow-hidden group ${isResolved ? 'ring-1 ring-green-500/30' : ''}`}>
      {/* Poster + Gradient overlay */}
      <div className="relative h-52 poster-shimmer">
        {market.posterPath ? (
          <img
            src={market.posterPath.startsWith('http') ? market.posterPath : `${TMDB_IMAGE_BASE}/w500${market.posterPath}`}
            alt={market.movieTitle}
            className="w-full h-full object-cover object-top"
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

        {/* Title overlay â€” links to SEO page for movies */}
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
            const isWinner = resolution?.winningOutcomeId === o.id;
            return (
              <div key={o.id} className={`space-y-1 ${isWinner ? 'bg-green-500/10 -mx-2 px-2 py-1 rounded-lg border border-green-500/20' : ''}`}>
                <div className="flex justify-between text-xs">
                  <span className={`flex items-center gap-1 ${isWinner ? 'text-green-300 font-semibold' : 'text-slate-300'}`}>
                    {isWinner && <CheckCircle2 className="w-3 h-3 text-green-400" />}
                    {o.label}
                  </span>
                  <span className={`font-medium ${isWinner ? 'text-green-400' : 'text-amber-400'}`}>{isWinner ? 'WINNER' : getMultiplier(o.totalStaked, market.totalPool)}</span>
                </div>
                <div className="odds-bar h-2">
                  <div className={isWinner ? 'h-full rounded-full bg-gradient-to-r from-green-500 to-emerald-400 transition-all' : 'odds-fill'} style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
          {market.outcomes.length > 3 && !isResolved && (
            <p className="text-xs text-slate-500">+{market.outcomes.length - 3} more options</p>
          )}
          {resolution?.realValue && (
            <p className="text-xs text-green-300/80 mt-1 italic">Result: {resolution.realValue}</p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-2 border-t border-white/5">
          <div className="flex items-center gap-1 text-xs text-slate-400">
            <BarChart3 className="w-3 h-3" />
            <span>{formatDAH(market.totalPool)} DAH pool</span>
          </div>
          <div className="flex items-center gap-2">
            {!isResolved && (
              <>
                <button
                  onClick={() => onResolve(market.movieId, markets, 'simulate')}
                  className="text-xs py-1.5 px-2.5 rounded-lg bg-orange-500/10 text-orange-300 hover:bg-orange-500/20 border border-orange-500/20 transition-all"
                  title="Simulate resolution with random winner"
                >
                  <PlayCircle className="w-3 h-3 inline mr-1" />Sim
                </button>
                {market.mediaType === 'movie' && (
                  <button
                    onClick={() => onResolve(market.movieId, markets, 'real')}
                    className="text-xs py-1.5 px-2.5 rounded-lg bg-blue-500/10 text-blue-300 hover:bg-blue-500/20 border border-blue-500/20 transition-all"
                    title="Resolve with real TMDB data"
                  >
                    <CheckCircle2 className="w-3 h-3 inline mr-1" />Real
                  </button>
                )}
              </>
            )}
            {isResolved ? (
              <span className="text-xs py-1.5 px-3 rounded-lg bg-green-500/10 text-green-300 border border-green-500/20">Resolved</span>
            ) : (
              <button
                onClick={() => onStake(market)}
                className="stake-btn text-xs py-2 px-4"
              >
                Predict
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// â”€â”€â”€ Main Page â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

// Languages with significant film industries
const LANGUAGES = [
  { code: '', label: 'ðŸŒ All Languages' },
  { code: 'en', label: 'ðŸ‡ºðŸ‡¸ English' },
  { code: 'ko', label: 'ðŸ‡°ðŸ‡· Korean' },
  { code: 'hi', label: 'ðŸ‡®ðŸ‡³ Hindi' },
  { code: 'ta', label: 'ðŸ‡®ðŸ‡³ Tamil' },
  { code: 'te', label: 'ðŸ‡®ðŸ‡³ Telugu' },
  { code: 'ja', label: 'ðŸ‡¯ðŸ‡µ Japanese' },
  { code: 'zh', label: 'ðŸ‡¨ðŸ‡³ Chinese' },
  { code: 'es', label: 'ðŸ‡ªðŸ‡¸ Spanish' },
  { code: 'fr', label: 'ðŸ‡«ðŸ‡· French' },
  { code: 'ar', label: 'ðŸ‡¸ðŸ‡¦ Arabic' },
  { code: 'tl', label: 'ðŸ‡µðŸ‡­ Filipino' },
  { code: 'th', label: 'ðŸ‡¹ðŸ‡­ Thai' },
  { code: 'id', label: 'ðŸ‡®ðŸ‡© Indonesian' },
  { code: 'tr', label: 'ðŸ‡¹ðŸ‡· Turkish' },
  { code: 'pt', label: 'ðŸ‡§ðŸ‡· Portuguese' },
  { code: 'de', label: 'ðŸ‡©ðŸ‡ª German' },
  { code: 'it', label: 'ðŸ‡®ðŸ‡¹ Italian' },
];

// TMDB genre IDs
const GENRES = [
  { id: '', label: 'ðŸŽ¬ All Genres' },
  { id: '28', label: 'ðŸ’¥ Action' },
  { id: '16', label: 'ðŸŽ¨ Animation' },
  { id: '35', label: 'ðŸ˜‚ Comedy' },
  { id: '80', label: 'ðŸ”ª Crime' },
  { id: '18', label: 'ðŸŽ­ Drama' },
  { id: '14', label: 'ðŸ§™ Fantasy' },
  { id: '27', label: 'ðŸ‘» Horror' },
  { id: '10402', label: 'ðŸŽµ Music' },
  { id: '9648', label: 'ðŸ•µï¸ Mystery' },
  { id: '10749', label: 'ðŸ’• Romance' },
  { id: '878', label: 'ðŸš€ Sci-Fi' },
  { id: '53', label: 'ðŸ˜° Thriller' },
  { id: '10752', label: 'âš”ï¸ War' },
  { id: '12', label: 'ðŸ—ºï¸ Adventure' },
  { id: '10751', label: 'ðŸ‘¨â€ðŸ‘©â€ðŸ‘§ Family' },
  { id: '36', label: 'ðŸ“œ History' },
  { id: '99', label: 'ðŸ“¹ Documentary' },
];

export default function DahBoxHome() {
  const router = useRouter();
  const [markets, setMarkets] = useState<Market[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<MarketCategory | 'all'>('all');
  const [selectedMarket, setSelectedMarket] = useState<Market | null>(null);
  const [showGetDAH, setShowGetDAH] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState('');
  const [selectedGenre, setSelectedGenre] = useState('');
  const [mediaTab, setMediaTab] = useState<MediaType>('movie');
  const [resolutions, setResolutions] = useState<Map<string, MarketResolutionState>>(new Map());
  const [resolveToast, setResolveToast] = useState<string | null>(null);
  const [isTvView, setIsTvView] = useState(false);
  const [isRemote, setIsRemote] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const p = new URLSearchParams(window.location.search);
      if (p.get("view") === "tv") setIsTvView(true);
      if (p.get("view") === "remote") setIsRemote(true);
      if (p.has("lang")) {
        setSelectedLanguage(p.get("lang") || '');
      }
    }
  }, []);

  const handleResolve = async (movieId: number, movieMarkets: Market[], mode: 'simulate' | 'real') => {
    try {
      const res = await fetch('/api/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ movieId, mode, markets: movieMarkets }),
      });
      const data = await res.json();

      if (data.success && data.resolutions) {
        const newMap = new Map(resolutions);
        for (const r of data.resolutions) {
          newMap.set(r.marketId, {
            winningOutcomeId: r.winningOutcomeId,
            winningOutcomeLabel: r.winningOutcomeLabel,
            realValue: r.realValue,
            resolvedAt: r.resolvedAt,
          });
        }
        setResolutions(newMap);
        setResolveToast(
          mode === 'real'
            ? `Resolved ${data.movieTitle} with real TMDB data!`
            : `Simulated resolution for ${data.movieTitle}`
        );
        setTimeout(() => setResolveToast(null), 4000);
      } else {
        setResolveToast(data.error || 'Resolution failed');
        setTimeout(() => setResolveToast(null), 5000);
      }
    } catch (err) {
      console.error('Resolution error:', err);
      setResolveToast('Network error during resolution');
      setTimeout(() => setResolveToast(null), 4000);
    }
  };

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
            const mIds = allMarkets.map(m => m.id);
            const totals = await fetchRealPoolTotals(mIds);
            setMarkets(overlayRealPoolData(allMarkets, totals));
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
            const mIds = allMarkets.map(m => m.id);
            const totals = await fetchRealPoolTotals(mIds);
            setMarkets(overlayRealPoolData(allMarkets, totals));
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
            const mIds = allMarkets.map(m => m.id);
            const totals = await fetchRealPoolTotals(mIds);
            setMarkets(overlayRealPoolData(allMarkets, totals));
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

  // Broadcast filter selections up to the controller application if in remote mode
  useEffect(() => {
    if (isRemote && typeof window !== 'undefined' && window.parent && window.parent !== window) {
      const urlParams = new URLSearchParams(window.location.search);
      const screenCode = urlParams.get('screenCode');
      window.parent.postMessage({
        type: 'DAHBOX_FILTER_CHANGED',
        screenCode: screenCode || 'PHONE_MODE',
        payload: { lang: selectedLanguage, genre: selectedGenre }
      }, "*");
    }
  }, [selectedLanguage, selectedGenre, isRemote]);

  // Listen for filter sync events (primarily for the TV view mirroring the remote phone)
  useEffect(() => {
    const handleSync = (e: MessageEvent) => {
      if (e.data?.type === 'SYNC_FILTERS') {
        if (e.data.lang !== undefined) setSelectedLanguage(e.data.lang);
        if (e.data.genre !== undefined) setSelectedGenre(e.data.genre);
      }
    };
    window.addEventListener('message', handleSync);
    return () => window.removeEventListener('message', handleSync);
  }, []);

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

      {/* â”€â”€â”€ Header â”€â”€â”€ */}
      {(!isTvView && !isRemote) && (
      <header className="sticky top-0 z-40 border-b border-white/5" style={{ background: 'rgba(10,10,26,0.85)', backdropFilter: 'blur(20px)' }}>
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl overflow-hidden shadow-lg flex items-center justify-center">
              <img src="/box-logo.png" alt="DahBox Logo" className="w-full h-full object-cover" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold text-white tracking-tight">DahBox</h1>
                <span className="px-1.5 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/30 text-[9px] font-bold text-amber-500 uppercase tracking-widest shadow-[0_0_8px_rgba(245,158,11,0.1)]">Beta</span>
              </div>
              <p className="text-[10px] text-slate-400 -mt-0.5">Movie Prediction Market</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* DAHLOR maturity teaser */}
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 maturity-badge">
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-xs text-amber-300 font-medium">Mainnet Oct '26</span>
            </div>

            {/* Get DAH CTA */}
            <button
              onClick={() => setShowGetDAH(true)}
              className="get-dah-btn flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold"
            >
              <Coins className="w-3.5 h-3.5" />
              Get DAH
            </button>
            
          
          </div>
        </div>
      </header>
      )}

      {/* â”€â”€â”€ Hero â”€â”€â”€ */}
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

      {/* â”€â”€â”€ Media Type Tabs â”€â”€â”€ */}
      {(!isTvView && !isRemote) && (
        <>
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

      {/* â”€â”€â”€ Category Tabs â”€â”€â”€ */}
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
        </>
      )}

      {/* â”€â”€â”€ Language & Genre Filters (Movies only) â”€â”€â”€ */}
      {!isTvView && mediaTab === 'movie' && (
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

      {/* â”€â”€â”€ Resolve Toast â”€â”€â”€ */}
      {resolveToast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-green-500/20 backdrop-blur-xl border border-green-500/30 rounded-2xl px-6 py-3 flex items-center gap-3 shadow-2xl animate-pulse">
          <CheckCircle2 className="w-5 h-5 text-green-400" />
          <p className="text-sm text-green-200 font-medium">{resolveToast}</p>
        </div>
      )}

      {/* â”€â”€â”€ Markets Grid â”€â”€â”€ */}
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
                <MovieCard markets={movieMarkets} onStake={setSelectedMarket} resolutions={resolutions} onResolve={handleResolve} />
              </div>
            ))}
          </div>
        )}
      </section>

      {/* â”€â”€â”€ How to Get DAH â”€â”€â”€ */}
      {(!isTvView && !isRemote) && (
        <>
      <section className="max-w-7xl mx-auto px-4 pb-8">
        <div className="glass-card p-6 md:p-8">
          <div className="flex items-center gap-2 mb-5">
            <Coins className="w-5 h-5 text-purple-400" />
            <h3 className="text-lg font-bold text-white">How to Get DAH</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Way 1: Install / Bookmark / Add to Home Screen */}
            <div className="p-4 rounded-xl bg-gradient-to-br from-green-500/10 to-emerald-500/5 border border-green-500/15 space-y-2">
              <div className="w-9 h-9 rounded-lg bg-green-500/20 flex items-center justify-center">
                <Smartphone className="w-4 h-4 text-green-400" />
              </div>
              <h4 className="text-sm font-semibold text-white">Install dah.mx</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Install <span className="text-green-300 font-semibold">dah.mx</span> on your phone and earn DAH every time you use it at a venue.
              </p>
            </div>
            {/* Way 2: Create & Share Games */}
            <div className="p-4 rounded-xl bg-gradient-to-br from-purple-500/10 to-violet-500/5 border border-purple-500/15 space-y-2">
              <div className="w-9 h-9 rounded-lg bg-purple-500/20 flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-purple-400" />
              </div>
              <h4 className="text-sm font-semibold text-white">Create &amp; Share Games</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Build games in the <span className="text-purple-300 font-semibold">Dahling ecosystem</span> and share them. Earn DAH every time your game is played at a venue.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* â”€â”€â”€ DAHLOR Banner â”€â”€â”€ */}
      <section className="max-w-7xl mx-auto px-4 pb-12">
        <div className="glass-card p-6 md:p-8 gold-glow flex flex-col md:flex-row items-center gap-6">
          <div className="flex-shrink-0 w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center">
            <span className="text-3xl font-black text-white">$</span>
          </div>
          <div className="flex-1 text-center md:text-left">
            <h3 className="text-xl font-bold text-white">DAH â†’ DAHLOR in Oct 2026</h3>
            <p className="text-slate-400 mt-1 text-sm">
              Your DAH tokens will mature into DAHLOR â€” a USD-pegged stablecoin. 
              Every DAH you earn or buy today becomes real value. Start predicting now to build your balance.
            </p>
          </div>
          <button className="stake-btn flex items-center gap-2 whitespace-nowrap">
            Learn More <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </section>

      {/* â”€â”€â”€ Footer â”€â”€â”€ */}
      <footer className="border-t border-white/5 py-6">
        <div className="max-w-7xl mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <div className="w-5 h-5 rounded bg-gradient-to-br from-purple-600 to-amber-500 flex items-center justify-center">
              <span className="text-[10px] font-black text-white">D</span>
            </div>
            <span>DahBox Â· box.dah.gg</span>
          </div>
          <div className="flex items-center gap-4 text-xs text-slate-500">
            <span>Resolution: Box Office Mojo</span>
            <span>Â·</span>
            <span>Platform Fee: 3%</span>
            <span>Â·</span>
            <a href="https://dah.gg" target="_blank" rel="noopener noreferrer" className="hover:text-amber-400 transition-colors">
              Powered by Dahling Ecosystem
            </a>
          </div>
        </div>
      </footer>
        </>
      )}

      {/* â”€â”€â”€ Floating Leaderboard Button â”€â”€â”€ */}
      <button 
        onClick={(e) => {
          e.preventDefault();
          if (typeof window !== 'undefined' && window.parent && window.parent !== window) {
            const urlParams = new URLSearchParams(window.location.search);
            const screenCode = urlParams.get('screenCode') || "PHONE_MODE";
            window.parent.postMessage({ type: "DAHBOX_NAVIGATE", screenCode, path: "/leaderboard" }, "*");
          }
          router.push("/leaderboard");
        }}
        className="fixed bottom-6 right-6 md:bottom-10 md:right-10 z-50 flex items-center justify-center w-14 h-14 bg-gradient-to-br from-blue-600 to-indigo-700 shadow-[0_0_20px_rgba(37,99,235,0.4)] rounded-full text-white hover:scale-105 transition-transform"
      >
        <Trophy className="w-6 h-6" />
      </button>

      {/* â”€â”€â”€ Stake Modal â”€â”€â”€ */}
      {selectedMarket && (
        <StakeModal market={selectedMarket} onClose={() => setSelectedMarket(null)} />
      )}

      {/* â”€â”€â”€ Get DAH Modal â”€â”€â”€ */}
      {showGetDAH && (
        <GetDAHModal
          onClose={() => setShowGetDAH(false)}
        />
      )}
    </div>
  );
}
