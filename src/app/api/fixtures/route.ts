/**
 * GET /api/fixtures
 *
 * Returns upcoming football fixtures from top competitions via api-football-v1
 * (api-sports.io direct endpoint).
 *
 * Free-plan constraints:
 *   - Supports date= queries for ±1 day window only
 *   - No next= or last= pagination helpers
 *   - Seasons 2022–2024 only (current season data needs paid plan)
 *
 * Required env vars:
 *   FOOTBALL_API_KEY — API key from api-sports.io / api-football.com
 *
 * Returns:
 *   { success: true, fixtures: FootballFixture[] }
 */

import { NextResponse } from 'next/server';
import { FootballFixture } from '../../lib/markets';

const API_HOST = 'v3.football.api-sports.io';
const API_BASE = `https://${API_HOST}`;

// Top league IDs to include (filter from the full date response)
// These are the well-known competitions users will recognise.
const ALLOW_LEAGUES = new Set([
  1,   // FIFA World Cup
  2,   // UEFA Champions League
  3,   // UEFA Europa League
  39,  // Premier League
  140, // La Liga
  78,  // Bundesliga
  135, // Serie A
  61,  // Ligue 1
  88,  // Eredivisie
  94,  // Primeira Liga (Portugal)
  253, // MLS
  307, // Saudi Pro League
  203, // Süper Lig (Turkey)
  32,  // WC Qualification – CONCACAF
  33,  // WC Qualification – AFC
  34,  // WC Qualification – CAF
  35,  // WC Qualification – UEFA
  36,  // WC Qualification – CONMEBOL
  34,  // CAF Champions League
  17,  // Copa Libertadores
  13,  // CONMEBOL Copa América
]);

// Country / team flag emoji map
const COUNTRY_FLAG: Record<string, string> = {
  England:       '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
  Spain:         '🇪🇸',
  Germany:       '🇩🇪',
  Italy:         '🇮🇹',
  France:        '🇫🇷',
  Portugal:      '🇵🇹',
  Netherlands:   '🇳🇱',
  Belgium:       '🇧🇪',
  Brazil:        '🇧🇷',
  Argentina:     '🇦🇷',
  USA:           '🇺🇸',
  Mexico:        '🇲🇽',
  Japan:         '🇯🇵',
  'South Korea': '🇰🇷',
  Morocco:       '🇲🇦',
  Senegal:       '🇸🇳',
  Colombia:      '🇨🇴',
  Ecuador:       '🇪🇨',
  Peru:          '🇵🇪',
  Chile:         '🇨🇱',
  Uruguay:       '🇺🇾',
  Saudi:         '🇸🇦',
  Turkey:        '🇹🇷',
  Greece:        '🇬🇷',
  Croatia:       '🇭🇷',
  Serbia:        '🇷🇸',
  Denmark:       '🇩🇰',
  Sweden:        '🇸🇪',
  Norway:        '🇳🇴',
  Poland:        '🇵🇱',
  Switzerland:   '🇨🇭',
  Austria:       '🇦🇹',
  Hungary:       '🇭🇺',
  Romania:       '🇷🇴',
  Ukraine:       '🇺🇦',
  China:         '🇨🇳',
  Australia:     '🇦🇺',
  Nigeria:       '🇳🇬',
  Ghana:         '🇬🇭',
  Egypt:         '🇪🇬',
  Cameroon:      '🇨🇲',
  'Ivory Coast': '🇨🇮',
};

function teamFlag(name: string): string {
  for (const [country, flag] of Object.entries(COUNTRY_FLAG)) {
    if (name.includes(country)) return flag;
  }
  return '⚽';
}

interface ApiFixtureItem {
  fixture: {
    id: number;
    date: string;
    status: { short: string };
  };
  league: {
    id: number;
    name: string;
    round: string;
  };
  teams: {
    home: { name: string };
    away: { name: string };
  };
}

async function fetchFixturesForDate(date: string, apiKey: string): Promise<ApiFixtureItem[]> {
  const url = `${API_BASE}/fixtures?date=${date}&timezone=UTC`;
  const res = await fetch(url, {
    headers: { 'x-apisports-key': apiKey },
    // Cache for 5 minutes — fixtures don't change that fast
    next: { revalidate: 300 },
  });
  if (!res.ok) return [];
  const json = await res.json();
  if (json.errors && Object.keys(json.errors).length > 0) {
    console.warn('[fixtures] API error for date', date, json.errors);
    return [];
  }
  return Array.isArray(json.response) ? json.response : [];
}

export async function GET() {
  const apiKey = process.env.FOOTBALL_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { success: false, error: 'FOOTBALL_API_KEY is not configured.' },
      { status: 503 }
    );
  }

  try {
    // Query today and tomorrow in parallel (free plan allows ±1 day)
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const tomorrow = new Date(now);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    const [todayItems, tomorrowItems] = await Promise.all([
      fetchFixturesForDate(todayStr, apiKey),
      fetchFixturesForDate(tomorrowStr, apiKey),
    ]);

    const allItems = [...todayItems, ...tomorrowItems];

    const seen = new Set<number>();
    const fixtures: FootballFixture[] = [];

    for (const item of allItems) {
      const id = item.fixture?.id;
      if (!id || seen.has(id)) continue;
      seen.add(id);

      // Only include fixtures that haven't started yet
      const status = item.fixture?.status?.short;
      if (status !== 'NS' && status !== 'TBD') continue;

      // Only include recognised leagues
      if (!ALLOW_LEAGUES.has(item.league?.id)) continue;

      fixtures.push({
        fixtureId: id,
        homeTeam: item.teams.home.name,
        awayTeam: item.teams.away.name,
        kickoff: item.fixture.date,
        competition: item.league.name,
        round: item.league.round,
        homeFlag: teamFlag(item.teams.home.name),
        awayFlag: teamFlag(item.teams.away.name),
      });
    }

    // Sort by kick-off time ascending (soonest first)
    fixtures.sort((a, b) => new Date(a.kickoff).getTime() - new Date(b.kickoff).getTime());

    return NextResponse.json({ success: true, fixtures });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
