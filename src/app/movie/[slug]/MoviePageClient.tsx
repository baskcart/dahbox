'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  ArrowLeft, Calendar, BarChart3,
  Film, Trophy, Star, Loader2,
} from 'lucide-react';
import { Market, formatDAH, getMultiplier } from '../../lib/types';
import type { TMDBMovieDetail } from '../../lib/tmdb';

const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p';

// ─── Stake Modal ──────────────────────────────────
// Staking is owned by Memi. This modal sends STAKE_PLACED to the Memi parent,
// waits for STAKE_CONFIRMED + transactionId, then records via DahBox /api/stake.
function StakeModal({ market, onClose }: { market: Market; onClose: () => void }) {
  const [selectedOutcome, setSelectedOutcome] = useState<string | null>(null);
  const [amount, setAmount] = useState(10);
  const [staked, setStaked] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [stakeError, setStakeError] = useState<string | null>(null);

  useEffect(() => {
    const handleMsg = (e: MessageEvent) => {
      // Memi records the stake before sending STAKE_CONFIRMED — just show success.
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
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="glass-card max-w-md w-full p-6 space-y-5" onClick={e => e.stopPropagation()}>
        <div className="flex items-start gap-3">
          {market.posterPath && (
            <img src={`${TMDB_IMAGE_BASE}/w92${market.posterPath}`} alt={market.movieTitle} className="w-14 h-20 rounded-lg object-cover" />
          )}
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-bold text-white truncate">{market.movieTitle}</h3>
            <p className="text-sm text-purple-300 mt-0.5">{market.question}</p>
            <p className="text-xs text-slate-400 mt-1">Pool: {formatDAH(market.totalPool)} DAH</p>
          </div>
        </div>

        {staked ? (
          <div className="text-center py-6 space-y-3">
            <div className="text-5xl">🎬</div>
            <h4 className="text-xl font-bold text-white">Position Placed!</h4>
            <p className="text-purple-300">{amount} DAH on &ldquo;{outcome?.label}&rdquo;</p>
            <p className="text-sm text-slate-400">Potential payout: <span className="text-amber-400 font-semibold">{potentialPayout} DAH</span></p>
            <button onClick={onClose} className="stake-btn mt-4 w-full">Done</button>
          </div>
        ) : (
          <>
            <div className="space-y-2">
              <p className="text-sm font-medium text-slate-300">Select your prediction:</p>
              {market.outcomes.map(o => {
                const isSelected = selectedOutcome === o.id;
                const pct = market.totalPool > 0 ? (o.totalStaked / market.totalPool * 100).toFixed(0) : '0';
                return (
                  <button key={o.id} onClick={() => setSelectedOutcome(o.id)}
                    className={`w-full flex items-center justify-between p-3 rounded-xl border transition-all ${
                      isSelected ? 'border-purple-500 bg-purple-500/15' : 'border-white/10 bg-white/5 hover:border-white/20'
                    }`}>
                    <div className="flex items-center gap-3">
                      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${isSelected ? 'border-purple-400' : 'border-slate-500'}`}>
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
            <div className="space-y-2">
              <p className="text-sm font-medium text-slate-300">Stake amount (DAH):</p>
              <div className="flex gap-2">
                {[5, 10, 25, 50, 100].map(v => (
                  <button key={v} onClick={() => setAmount(v)}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                      amount === v ? 'bg-purple-600 text-white' : 'bg-white/5 text-slate-300 hover:bg-white/10'
                    }`}>{v}</button>
                ))}
              </div>
            </div>
            {selectedOutcome && (
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 flex justify-between items-center">
                <span className="text-sm text-amber-200">Potential payout</span>
                <span className="text-lg font-bold text-amber-400">{potentialPayout} DAH</span>
              </div>
            )}
            {stakeError && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-xs text-red-300">
                ⚠️ {stakeError}
              </div>
            )}
            <button
              onClick={() => {
                if (!selectedOutcome || !outcome) return;
                const urlParams = new URLSearchParams(window.location.search);
                const screenCode = urlParams.get('screenCode') || 'PHONE_MODE';
                setIsProcessing(true);
                setStakeError(null);
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
              className="stake-btn w-full py-3 text-center disabled:opacity-30 disabled:cursor-not-allowed flex justify-center items-center gap-2"
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

// ─── Movie Page Client ───────────────────────────
export default function MoviePageClient({
  movie,
  markets,
  slug,
}: {
  movie: TMDBMovieDetail;
  markets: Market[];
  slug: string;
}) {
  const [selectedMarket, setSelectedMarket] = useState<Market | null>(null);

  const releaseDate = movie.release_date
    ? new Date(movie.release_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    : 'TBD';

  return (
    <div className="min-h-screen relative">
      <div className="cinema-glow" />

      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-white/5" style={{ background: 'rgba(10,10,26,0.85)', backdropFilter: 'blur(20px)' }}>
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors">
            <ArrowLeft className="w-4 h-4" />
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-purple-600 to-amber-500 flex items-center justify-center">
                <span className="text-xs font-black text-white">D</span>
              </div>
              <span className="text-sm font-semibold">DahBox</span>
            </div>
          </Link>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10">
            <span className="text-xs text-slate-400">Open in Memi App to stake</span>
          </div>
        </div>
      </header>

      {/* Hero: Movie Details */}
      <section className="relative max-w-5xl mx-auto px-4 pt-8 pb-6">
        <div className="flex flex-col md:flex-row gap-6">
          {/* Poster */}
          <div className="flex-shrink-0">
            {movie.poster_path ? (
              <img
                src={`${TMDB_IMAGE_BASE}/w500${movie.poster_path}`}
                alt={`${movie.title} poster`}
                className="w-48 md:w-56 rounded-2xl shadow-2xl shadow-purple-900/30"
              />
            ) : (
              <div className="w-48 md:w-56 h-72 md:h-84 rounded-2xl bg-gradient-to-br from-purple-900/40 to-slate-900 flex items-center justify-center">
                <Film className="w-16 h-16 text-purple-400/40" />
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex-1 space-y-4">
            <div>
              <h1 className="text-3xl md:text-4xl font-extrabold text-white">{movie.title}</h1>
              {movie.tagline && <p className="text-purple-300 mt-1 italic">&ldquo;{movie.tagline}&rdquo;</p>}
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1.5 text-sm text-slate-300">
                <Calendar className="w-4 h-4 text-purple-400" />
                <span>{releaseDate}</span>
              </div>
              {movie.runtime && movie.runtime > 0 && (
                <span className="text-sm text-slate-400">{Math.floor(movie.runtime / 60)}h {movie.runtime % 60}m</span>
              )}
              {movie.vote_count > 0 && (
                <div className="flex items-center gap-1 text-sm text-amber-400">
                  <Star className="w-4 h-4 fill-amber-400" />
                  <span>{movie.vote_average.toFixed(1)}</span>
                  <span className="text-slate-500">({movie.vote_count})</span>
                </div>
              )}
            </div>

            {movie.genres && movie.genres.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {movie.genres.map(g => (
                  <span key={g.id} className="text-xs px-2.5 py-1 rounded-full bg-purple-500/15 border border-purple-500/20 text-purple-300">
                    {g.name}
                  </span>
                ))}
              </div>
            )}

            <p className="text-slate-400 text-sm leading-relaxed max-w-2xl">{movie.overview}</p>

            {/* Quick stats */}
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5 text-sm text-slate-300">
                <BarChart3 className="w-4 h-4 text-green-400" />
                <span>{markets.length} Markets</span>
              </div>
              <div className="flex items-center gap-1.5 text-sm text-slate-300">
                <Trophy className="w-4 h-4 text-amber-400" />
                <span>{formatDAH(markets.reduce((s, m) => s + m.totalPool, 0))} DAH Staked</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Prediction Markets */}
      <section className="max-w-5xl mx-auto px-4 pb-16">
        <h2 className="text-xl font-bold text-white mb-4">Prediction Markets</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {markets.map(market => (
            <div key={market.id} className="glass-card p-5 space-y-4">
              <div>
                <p className="text-sm text-purple-200 font-semibold">{market.question}</p>
                <p className="text-xs text-slate-400 mt-1">Pool: {formatDAH(market.totalPool)} DAH</p>
              </div>

              <div className="space-y-2">
                {market.outcomes.map(o => {
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
              </div>

              <button onClick={() => setSelectedMarket(market)} className="stake-btn w-full py-2.5 text-center text-sm">
                Predict Now
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/5 py-6">
        <div className="max-w-5xl mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-3">
          <Link href="/" className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-300 transition-colors">
            <div className="w-5 h-5 rounded bg-gradient-to-br from-purple-600 to-amber-500 flex items-center justify-center">
              <span className="text-[10px] font-black text-white">D</span>
            </div>
            <span>DahBox · box.dah.gg</span>
          </Link>
          <div className="flex items-center gap-4 text-xs text-slate-500">
            <span>Resolution: Box Office Mojo</span>
            <span>·</span>
            <span>Platform Fee: 3%</span>
            <span>·</span>
            <span>Powered by Dahling Ecosystem</span>
          </div>
        </div>
      </footer>

      {/* Stake Modal */}
      {selectedMarket && <StakeModal market={selectedMarket} onClose={() => setSelectedMarket(null)} />}
    </div>
  );
}
