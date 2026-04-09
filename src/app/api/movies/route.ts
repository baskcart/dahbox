import { NextRequest, NextResponse } from "next/server";

const TMDB_TOKEN = process.env.TMDB_ACCESS_TOKEN || '';

const TMDB_HEADERS = {
  'Authorization': `Bearer ${TMDB_TOKEN}`,
  'accept': 'application/json',
};

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const category = searchParams.get('category') || 'upcoming';
    const region = searchParams.get('region') || ''; // empty = worldwide
    const page = searchParams.get('page') || '1';

    const today = new Date();
    let gteDate: string;
    let lteDate: string;
    let sortBy: string;
    let extraParams = '';

    switch (category) {
      case 'upcoming': {
        // Movies releasing in next 60 days — primary market creation window
        const future60 = new Date(today);
        future60.setDate(today.getDate() + 60);
        gteDate = formatDate(today);
        lteDate = formatDate(future60);
        sortBy = 'popularity.desc';
        extraParams = '&vote_count.gte=0'; // Include unreleased films with no votes yet
        break;
      }
      case 'this-weekend': {
        // Movies releasing this week (for imminent OW markets)
        const nextWeek = new Date(today);
        nextWeek.setDate(today.getDate() + 7);
        gteDate = formatDate(today);
        lteDate = formatDate(nextWeek);
        sortBy = 'primary_release_date.asc';
        break;
      }
      case 'now-playing': {
        // Currently in theaters
        const monthAgo = new Date(today);
        monthAgo.setDate(today.getDate() - 30);
        gteDate = formatDate(monthAgo);
        lteDate = formatDate(today);
        sortBy = 'popularity.desc';
        extraParams = '&vote_count.gte=20';
        break;
      }
      default: {
        const future60 = new Date(today);
        future60.setDate(today.getDate() + 60);
        gteDate = formatDate(today);
        lteDate = formatDate(future60);
        sortBy = 'popularity.desc';
      }
    }

    // Add region filter if specified (e.g. US, IN, KR, JP)
    const regionParam = region ? `&region=${region}` : '';

    const url = `https://api.themoviedb.org/3/discover/movie?` +
      `primary_release_date.gte=${gteDate}&` +
      `primary_release_date.lte=${lteDate}&` +
      `sort_by=${sortBy}&` +
      `page=${page}` +
      extraParams +
      regionParam;

    const response = await fetch(url, { headers: TMDB_HEADERS, next: { revalidate: 3600 } });

    if (!response.ok) {
      throw new Error(`TMDB API error: ${response.status}`);
    }

    const data = await response.json();

    return NextResponse.json({
      success: true,
      category,
      region: region || 'worldwide',
      dateRange: { from: gteDate, to: lteDate },
      totalResults: data.total_results,
      movies: data.results || [],
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to fetch movies';
    console.error('TMDB discover error:', err);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
