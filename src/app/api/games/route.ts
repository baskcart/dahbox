import { NextRequest, NextResponse } from "next/server";

// RAWG API — free tier: 20,000 requests/month
// Get a free API key at https://rawg.io/apidocs
const RAWG_KEY = process.env.RAWG_API_KEY || '';
const RAWG_BASE = 'https://api.rawg.io/api';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const category = searchParams.get('category') || 'popular';
    const genre = searchParams.get('genre') || '';
    const page = searchParams.get('page') || '1';

    let ordering = '-rating';
    let extraParams = '';
    const today = new Date();
    const yearAgo = new Date(today);
    yearAgo.setFullYear(today.getFullYear() - 2);

    switch (category) {
      case 'popular':
        // Highest-rated recent games — prime movie adaptation candidates
        ordering = '-metacritic';
        extraParams = `&dates=${yearAgo.toISOString().split('T')[0]},${today.toISOString().split('T')[0]}&metacritic=70,100`;
        break;
      case 'classic':
        // All-time greats not yet adapted
        ordering = '-rating';
        extraParams = '&metacritic=85,100';
        break;
      case 'upcoming':
        // Upcoming games
        const future = new Date(today);
        future.setMonth(today.getMonth() + 6);
        ordering = '-added';
        extraParams = `&dates=${today.toISOString().split('T')[0]},${future.toISOString().split('T')[0]}`;
        break;
      case 'indie':
        ordering = '-rating';
        extraParams = '&tags=indie&metacritic=75,100';
        break;
      default:
        ordering = '-metacritic';
    }

    if (genre) {
      extraParams += `&genres=${genre}`;
    }

    // If no RAWG API key, return curated fallback data
    if (!RAWG_KEY) {
      return NextResponse.json({
        success: true,
        category,
        totalResults: curatedGames.length,
        games: curatedGames,
      });
    }

    const url = `${RAWG_BASE}/games?key=${RAWG_KEY}&ordering=${ordering}&page_size=20&page=${page}${extraParams}`;

    const response = await fetch(url, { next: { revalidate: 3600 } });

    if (!response.ok) {
      throw new Error(`RAWG API error: ${response.status}`);
    }

    const data = await response.json();

    return NextResponse.json({
      success: true,
      category,
      totalResults: data.count || 0,
      games: data.results || [],
    });
  } catch (err: unknown) {
    console.error('RAWG error:', err);
    // Fallback to curated list
    return NextResponse.json({
      success: true,
      category: 'curated',
      totalResults: curatedGames.length,
      games: curatedGames,
    });
  }
}

// Curated list of iconic games perfect for movie adaptation predictions
const curatedGames = [
  { id: 1001, name: 'The Legend of Zelda: Tears of the Kingdom', slug: 'zelda-totk', background_image: null, released: '2023-05-12', rating: 4.7, ratings_count: 3200, genres: [{ id: 4, name: 'Action' }, { id: 3, name: 'Adventure' }], platforms: [{ platform: { id: 7, name: 'Nintendo Switch' } }], metacritic: 96 },
  { id: 1002, name: 'God of War Ragnarök', slug: 'god-of-war-ragnarok', background_image: null, released: '2022-11-09', rating: 4.6, ratings_count: 5100, genres: [{ id: 4, name: 'Action' }, { id: 5, name: 'RPG' }], platforms: [{ platform: { id: 18, name: 'PlayStation 5' } }], metacritic: 94 },
  { id: 1003, name: 'Elden Ring', slug: 'elden-ring', background_image: null, released: '2022-02-25', rating: 4.5, ratings_count: 8900, genres: [{ id: 4, name: 'Action' }, { id: 5, name: 'RPG' }], platforms: [{ platform: { id: 4, name: 'PC' } }], metacritic: 96 },
  { id: 1004, name: 'Red Dead Redemption 2', slug: 'rdr2', background_image: null, released: '2018-10-26', rating: 4.7, ratings_count: 12000, genres: [{ id: 4, name: 'Action' }, { id: 3, name: 'Adventure' }], platforms: [{ platform: { id: 4, name: 'PC' } }], metacritic: 97 },
  { id: 1005, name: 'Mass Effect Legendary Edition', slug: 'mass-effect', background_image: null, released: '2021-05-14', rating: 4.5, ratings_count: 3800, genres: [{ id: 5, name: 'RPG' }, { id: 4, name: 'Action' }], platforms: [{ platform: { id: 4, name: 'PC' } }], metacritic: 86 },
  { id: 1006, name: 'BioShock: The Collection', slug: 'bioshock', background_image: null, released: '2016-09-13', rating: 4.4, ratings_count: 4200, genres: [{ id: 2, name: 'Shooter' }, { id: 5, name: 'RPG' }], platforms: [{ platform: { id: 4, name: 'PC' } }], metacritic: 84 },
  { id: 1007, name: 'Ghost of Tsushima', slug: 'ghost-of-tsushima', background_image: null, released: '2020-07-17', rating: 4.6, ratings_count: 6100, genres: [{ id: 4, name: 'Action' }, { id: 3, name: 'Adventure' }], platforms: [{ platform: { id: 18, name: 'PlayStation 5' } }], metacritic: 83 },
  { id: 1008, name: 'Horizon Zero Dawn', slug: 'horizon-zero-dawn', background_image: null, released: '2017-02-28', rating: 4.4, ratings_count: 7500, genres: [{ id: 4, name: 'Action' }, { id: 5, name: 'RPG' }], platforms: [{ platform: { id: 4, name: 'PC' } }], metacritic: 89 },
  { id: 1009, name: 'Hollow Knight', slug: 'hollow-knight', background_image: null, released: '2017-02-24', rating: 4.4, ratings_count: 5600, genres: [{ id: 4, name: 'Action' }, { id: 51, name: 'Indie' }], platforms: [{ platform: { id: 4, name: 'PC' } }], metacritic: 87 },
  { id: 1010, name: 'Hades', slug: 'hades', background_image: null, released: '2020-09-17', rating: 4.5, ratings_count: 4300, genres: [{ id: 4, name: 'Action' }, { id: 51, name: 'Indie' }], platforms: [{ platform: { id: 4, name: 'PC' } }], metacritic: 93 },
  { id: 1011, name: 'Metal Gear Solid V', slug: 'mgs-v', background_image: null, released: '2015-09-01', rating: 4.3, ratings_count: 9800, genres: [{ id: 4, name: 'Action' }, { id: 2, name: 'Shooter' }], platforms: [{ platform: { id: 4, name: 'PC' } }], metacritic: 95 },
  { id: 1012, name: 'Half-Life: Alyx', slug: 'half-life-alyx', background_image: null, released: '2020-03-23', rating: 4.6, ratings_count: 2100, genres: [{ id: 2, name: 'Shooter' }, { id: 4, name: 'Action' }], platforms: [{ platform: { id: 4, name: 'PC' } }], metacritic: 93 },
];
