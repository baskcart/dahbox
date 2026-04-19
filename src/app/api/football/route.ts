/**
 * GET /api/football?fixtureId=<id>
 *
 * Oracle route for football (soccer) pre-game market settlement.
 * Fetches match result from api-football (RapidAPI) once the fixture
 * has a final score.
 *
 * Required env vars:
 *   FOOTBALL_API_KEY   — RapidAPI key for api-football
 *
 * Returns:
 *   { fixtureId, homeTeam, awayTeam, homeScore, awayScore, status, winner }
 *   status: "NS" (not started) | "FT" (full time) | "AET" | "PEN" | ...
 *   winner: "home" | "away" | "draw" | null (if not finished)
 *
 * Used by /api/resolve when settling FIFA markets.
 */

import { NextRequest, NextResponse } from 'next/server';

const API_FOOTBALL_HOST = 'v3.football.api-sports.io';
const API_FOOTBALL_BASE = `https://${API_FOOTBALL_HOST}`;

export async function GET(req: NextRequest) {
  const apiKey = process.env.FOOTBALL_API_KEY;

  // Fail loudly — no API key = feature disabled
  if (!apiKey) {
    return NextResponse.json(
      {
        error: 'FOOTBALL_API_KEY is not configured. FIFA market settlement is disabled.',
        code: 'API_KEY_MISSING',
      },
      { status: 503 }
    );
  }

  const { searchParams } = new URL(req.url);
  const fixtureId = searchParams.get('fixtureId');

  if (!fixtureId || isNaN(Number(fixtureId))) {
    return NextResponse.json(
      { error: 'Missing or invalid fixtureId parameter.' },
      { status: 400 }
    );
  }

  try {
    const res = await fetch(
      `${API_FOOTBALL_BASE}/fixtures?id=${fixtureId}`,
      {
        headers: {
          'x-apisports-key': apiKey,
        },
        next: { revalidate: 60 },
      }
    );

    if (!res.ok) {
      return NextResponse.json(
        { error: `api-football returned ${res.status}` },
        { status: 502 }
      );
    }

    const json = await res.json();
    const fixture = json.response?.[0];

    if (!fixture) {
      return NextResponse.json(
        { error: `Fixture ${fixtureId} not found.` },
        { status: 404 }
      );
    }

    const status = fixture.fixture?.status?.short ?? 'NS';
    const homeScore = fixture.goals?.home ?? null;
    const awayScore = fixture.goals?.away ?? null;
    const homeTeam = fixture.teams?.home?.name ?? 'Home';
    const awayTeam = fixture.teams?.away?.name ?? 'Away';

    // Determine winner only when the match is fully complete
    const finishedStatuses = ['FT', 'AET', 'PEN'];
    let winner: 'home' | 'away' | 'draw' | null = null;
    if (finishedStatuses.includes(status) && homeScore !== null && awayScore !== null) {
      if (homeScore > awayScore) winner = 'home';
      else if (awayScore > homeScore) winner = 'away';
      else winner = 'draw';
    }

    return NextResponse.json({
      fixtureId: Number(fixtureId),
      homeTeam,
      awayTeam,
      homeScore,
      awayScore,
      status,
      winner,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: `Football oracle error: ${msg}` }, { status: 500 });
  }
}
