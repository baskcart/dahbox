import { NextRequest, NextResponse } from "next/server";

const TMDB_TOKEN = process.env.TMDB_ACCESS_TOKEN || 'eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiI2MjAzNTBiYjAxNzNjZDgwYTZlMzFlZWIyYjYzMzkxYyIsIm5iZiI6MTY4NDE3MTA3OC4xMzc5OTk4LCJzdWIiOiI2NDYyNjk0NjBmMzY1NTAwZmNkZjU5ODYiLCJzY29wZXMiOlsiYXBpX3JlYWQiXSwidmVyc2lvbiI6MX0.UkyNe3YrTaLyWoBFyXeKfKRh2yj8GQTEezw3459ykGw';
const TMDB_BASE = 'https://api.themoviedb.org/3';

interface TMDBMovieDetail {
  id: number;
  title: string;
  revenue: number;       // Worldwide gross in USD
  budget: number;
  vote_average: number;  // 0-10
  vote_count: number;
  release_date: string;
  status: string;        // "Released", "Post Production", etc.
}

interface ResolutionResult {
  movieId: number;
  movieTitle: string;
  mode: 'simulate' | 'real';
  markets: MarketResolution[];
}

interface MarketResolution {
  marketId: string;
  question: string;
  winningOutcomeId: string;
  winningOutcomeLabel: string;
  realValue?: string;         // The actual value (e.g. "$142M")
  resolvedAt: string;
}

/**
 * POST /api/resolve
 * 
 * Body: { movieId: number, mode: 'simulate' | 'real', markets: Market[] }
 * 
 * - simulate: randomly picks a winning outcome weighted by implied odds
 * - real: fetches TMDB data and determines the actual winner
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { movieId, mode = 'simulate', markets } = body;

    if (!movieId || !markets || !Array.isArray(markets)) {
      return NextResponse.json(
        { success: false, error: 'movieId and markets[] required' },
        { status: 400 }
      );
    }

    if (mode === 'real') {
      return handleRealResolution(movieId, markets);
    } else {
      return handleSimulatedResolution(movieId, markets);
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Resolution failed';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

/**
 * SIMULATE mode: randomly pick winners weighted by pool distribution
 */
function handleSimulatedResolution(movieId: number, markets: any[]) {
  const resolutions: MarketResolution[] = [];

  for (const market of markets) {
    const outcomes = market.outcomes || [];
    if (outcomes.length === 0) continue;

    // Weighted random selection based on staked amounts (higher staked = more likely)
    const totalStaked = outcomes.reduce((s: number, o: any) => s + o.totalStaked, 0);
    let roll = Math.random() * totalStaked;
    let winner = outcomes[0];

    for (const outcome of outcomes) {
      roll -= outcome.totalStaked;
      if (roll <= 0) {
        winner = outcome;
        break;
      }
    }

    // Simulate a realistic value based on the winning bracket
    let realValue: string | undefined;
    if (winner.label.includes('$') && winner.label.includes('M')) {
      // Parse bracket like "$100-120M" and pick a random value in range
      const match = winner.label.match(/\$(\d+)/);
      if (match) {
        const base = parseInt(match[1]);
        const simulated = base + Math.floor(Math.random() * 20);
        realValue = `$${simulated}M (simulated)`;
      }
    } else if (winner.label.includes('Over') || winner.label.includes('Under')) {
      const numMatch = winner.label.match(/\$(\d+)M/);
      if (numMatch) {
        const line = parseInt(numMatch[1]);
        const isOver = winner.label.includes('Over');
        const simulated = isOver ? line + Math.floor(Math.random() * 50) + 5 : line - Math.floor(Math.random() * 30) - 5;
        realValue = `$${Math.max(1, simulated)}M (simulated)`;
      }
    } else {
      realValue = `${winner.label} (simulated)`;
    }

    resolutions.push({
      marketId: market.id,
      question: market.question,
      winningOutcomeId: winner.id,
      winningOutcomeLabel: winner.label,
      realValue,
      resolvedAt: new Date().toISOString(),
    });
  }

  return NextResponse.json({
    success: true,
    mode: 'simulate',
    movieId,
    movieTitle: markets[0]?.movieTitle || 'Unknown',
    resolutions,
  });
}

/**
 * REAL mode: fetch TMDB data and determine actual winners
 */
async function handleRealResolution(movieId: number, markets: any[]) {
  // Fetch movie details from TMDB
  const res = await fetch(`${TMDB_BASE}/movie/${movieId}`, {
    headers: {
      Authorization: `Bearer ${TMDB_TOKEN}`,
      accept: 'application/json',
    },
  });

  if (!res.ok) {
    return NextResponse.json(
      { success: false, error: `TMDB API error: ${res.status}` },
      { status: 500 }
    );
  }

  const movie: TMDBMovieDetail = await res.json();

  // Check if movie has been released
  const releaseDate = new Date(movie.release_date);
  const now = new Date();

  if (now < releaseDate) {
    return NextResponse.json({
      success: false,
      error: `Movie "${movie.title}" has not been released yet (releases ${movie.release_date}). Check back after release.`,
      movieStatus: movie.status,
      releaseDate: movie.release_date,
    });
  }

  // Calculate estimated opening weekend (typically 30-40% of total domestic)
  // TMDB revenue is worldwide, domestic is roughly 40% of worldwide for US films
  const worldwideGross = movie.revenue || 0;
  const estimatedDomestic = Math.round(worldwideGross * 0.4);
  const estimatedOW = Math.round(estimatedDomestic * 0.35); // Opening weekend ~35% of domestic
  const owMillions = Math.round(estimatedOW / 1_000_000);

  const resolutions: MarketResolution[] = [];

  for (const market of markets) {
    const outcomes = market.outcomes || [];
    if (outcomes.length === 0) continue;

    let winnerId = '';
    let winnerLabel = '';
    let realValue = '';

    if (market.category === 'opening-weekend' && market.question.includes('Over/Under')) {
      // Over/Under resolution
      const lineMatch = market.question.match(/\$(\d+)M/);
      if (lineMatch) {
        const line = parseInt(lineMatch[1]);
        const isOver = owMillions >= line;
        const winner = outcomes.find((o: any) => 
          isOver ? o.label.includes('Over') : o.label.includes('Under')
        );
        if (winner) {
          winnerId = winner.id;
          winnerLabel = winner.label;
          realValue = worldwideGross > 0 
            ? `$${owMillions}M estimated OW (from $${Math.round(worldwideGross / 1_000_000)}M worldwide)`
            : 'Revenue data not yet available on TMDB';
        }
      }
    } else if (market.category === 'opening-weekend') {
      // Bracket resolution
      let winner = null;
      for (const outcome of outcomes) {
        const rangeMatch = outcome.label.match(/\$(\d+)-(\d+)M/);
        const plusMatch = outcome.label.match(/\$(\d+)M\+/);

        if (rangeMatch) {
          const low = parseInt(rangeMatch[1]);
          const high = parseInt(rangeMatch[2]);
          if (owMillions >= low && owMillions < high) {
            winner = outcome;
            break;
          }
        } else if (plusMatch) {
          const threshold = parseInt(plusMatch[1]);
          if (owMillions >= threshold) {
            winner = outcome;
            break;
          }
        }
      }

      if (!winner) {
        // Default to closest bracket
        winner = outcomes[0];
      }

      winnerId = winner.id;
      winnerLabel = winner.label;
      realValue = worldwideGross > 0
        ? `$${owMillions}M estimated OW (from $${Math.round(worldwideGross / 1_000_000)}M worldwide)`
        : 'Revenue data not yet available on TMDB';
    } else if (market.category === 'book-to-movie' || market.category === 'game-to-movie') {
      // These are long-term markets - can't auto-resolve yet
      realValue = 'Long-term market - awaiting real-world outcome';
      continue;
    }

    if (winnerId) {
      resolutions.push({
        marketId: market.id,
        question: market.question,
        winningOutcomeId: winnerId,
        winningOutcomeLabel: winnerLabel,
        realValue,
        resolvedAt: new Date().toISOString(),
      });
    }
  }

  return NextResponse.json({
    success: true,
    mode: 'real',
    movieId: movie.id,
    movieTitle: movie.title,
    tmdbData: {
      revenue: movie.revenue,
      budget: movie.budget,
      voteAverage: movie.vote_average,
      voteCount: movie.vote_count,
      status: movie.status,
      releaseDate: movie.release_date,
      estimatedOW: `$${owMillions}M`,
      estimatedDomestic: `$${Math.round(estimatedDomestic / 1_000_000)}M`,
    },
    resolutions,
  });
}
