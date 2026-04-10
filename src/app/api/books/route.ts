import { NextRequest, NextResponse } from "next/server";

// Google Books API - free, no key needed for basic search
const BOOKS_BASE = 'https://www.googleapis.com/books/v1/volumes';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const category = searchParams.get('category') || 'trending';
    const genre = searchParams.get('genre') || '';
    const page = searchParams.get('page') || '0';

    let query = '';
    const startIndex = parseInt(page) * 20;

    switch (category) {
      case 'trending':
        query = 'subject:fiction&orderBy=relevance';
        break;
      case 'fantasy':
        query = 'subject:fantasy+fiction&orderBy=relevance';
        break;
      case 'scifi':
        query = 'subject:science+fiction&orderBy=relevance';
        break;
      case 'thriller':
        query = 'subject:thriller+fiction&orderBy=relevance';
        break;
      case 'ya':
        query = 'subject:young+adult+fiction&orderBy=relevance';
        break;
      case 'bestseller':
        query = 'subject:fiction+bestseller&orderBy=newest';
        break;
      default:
        query = 'subject:fiction&orderBy=relevance';
    }

    if (genre) {
      query = `subject:${genre}+fiction&orderBy=relevance`;
    }

    const url = `${BOOKS_BASE}?q=${query}&startIndex=${startIndex}&maxResults=20&printType=books&langRestrict=en`;

    const response = await fetch(url, { next: { revalidate: 3600 } });

    if (!response.ok) {
      throw new Error(`Google Books API error: ${response.status}`);
    }

    const data = await response.json();

    const books = (data.items || []).map((item: any) => ({
      id: item.id,
      title: item.volumeInfo?.title || 'Untitled',
      authors: item.volumeInfo?.authors || ['Unknown'],
      description: item.volumeInfo?.description || '',
      imageUrl: item.volumeInfo?.imageLinks?.thumbnail?.replace('http:', 'https:') || null,
      publishedDate: item.volumeInfo?.publishedDate || '',
      categories: item.volumeInfo?.categories || [],
      averageRating: item.volumeInfo?.averageRating || 0,
      ratingsCount: item.volumeInfo?.ratingsCount || 0,
      pageCount: item.volumeInfo?.pageCount || 0,
    }));

    return NextResponse.json({
      success: true,
      category,
      totalResults: data.totalItems || 0,
      books,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to fetch books';
    console.error('Google Books error:', message);
    // Fallback to curated list of adaptation-worthy novels
    return NextResponse.json({
      success: true,
      category: 'curated',
      totalResults: curatedBooks.length,
      books: curatedBooks,
    });
  }
}

// Curated list of popular novels - strong movie adaptation candidates
const curatedBooks = [
  { id: 'b001', title: 'Project Hail Mary', authors: ['Andy Weir'], description: 'An astronaut wakes up alone on a spaceship with no memory. He must solve an impossible mystery to save Earth.', imageUrl: 'https://books.google.com/books/content?id=INYEEAAAQBAJ&printsec=frontcover&img=1&zoom=1&source=gbs_api', publishedDate: '2021-05-04', categories: ['Science Fiction'], averageRating: 4.7, ratingsCount: 28000, pageCount: 496 },
  { id: 'b002', title: 'The Name of the Wind', authors: ['Patrick Rothfuss'], description: 'The riveting narrative of Kvothe, who grows to become the most renowned wizard his world has ever seen.', imageUrl: 'https://books.google.com/books/content?id=hRx-BAAAQBAJ&printsec=frontcover&img=1&zoom=1&source=gbs_api', publishedDate: '2007-03-27', categories: ['Fantasy'], averageRating: 4.5, ratingsCount: 45000, pageCount: 722 },
  { id: 'b003', title: 'Red Rising', authors: ['Pierce Brown'], description: 'Darrow is a Red, the lowest caste in the color-coded society of the future, working to make Mars livable.', imageUrl: 'https://books.google.com/books/content?id=V2S9AAAAQBAJ&printsec=frontcover&img=1&zoom=1&source=gbs_api', publishedDate: '2014-01-28', categories: ['Science Fiction'], averageRating: 4.3, ratingsCount: 32000, pageCount: 382 },
  { id: 'b004', title: 'The Way of Kings', authors: ['Brandon Sanderson'], description: 'Roshar is a world of stone and storms, where honor and pain weigh heavier than any physical burden.', imageUrl: 'https://books.google.com/books/content?id=QRB3DwAAQBAJ&printsec=frontcover&img=1&zoom=1&source=gbs_api', publishedDate: '2010-08-31', categories: ['Fantasy'], averageRating: 4.6, ratingsCount: 38000, pageCount: 1007 },
  { id: 'b005', title: 'Mistborn: The Final Empire', authors: ['Brandon Sanderson'], description: 'In a world where ash falls from the sky, an evil Lord Ruler holds absolute power over all living things.', imageUrl: 'https://books.google.com/books/content?id=t_ZYYXZq4RMC&printsec=frontcover&img=1&zoom=1&source=gbs_api', publishedDate: '2006-07-17', categories: ['Fantasy'], averageRating: 4.5, ratingsCount: 52000, pageCount: 541 },
  { id: 'b006', title: 'The Poppy War', authors: ['R.F. Kuang'], description: 'A war orphan aces the entrance exam to the most elite military school and discovers the power of shamanism.', imageUrl: 'https://books.google.com/books/content?id=fJctDwAAQBAJ&printsec=frontcover&img=1&zoom=1&source=gbs_api', publishedDate: '2018-05-01', categories: ['Fantasy'], averageRating: 4.1, ratingsCount: 18000, pageCount: 527 },
  { id: 'b007', title: 'Recursion', authors: ['Blake Crouch'], description: 'False Memory Syndrome sweeps the nation. Victims are flooded with vivid memories of a life they never lived.', imageUrl: 'https://books.google.com/books/content?id=K5RuDwAAQBAJ&printsec=frontcover&img=1&zoom=1&source=gbs_api', publishedDate: '2019-06-11', categories: ['Thriller'], averageRating: 4.2, ratingsCount: 21000, pageCount: 320 },
  { id: 'b008', title: 'The Blade Itself', authors: ['Joe Abercrombie'], description: 'Logen Ninefingers, infamous barbarian, has finally run out of luck. Caught in one feud too many.', imageUrl: 'https://books.google.com/books/content?id=63JD78pLGGsC&printsec=frontcover&img=1&zoom=1&source=gbs_api', publishedDate: '2006-05-04', categories: ['Fantasy'], averageRating: 4.2, ratingsCount: 24000, pageCount: 515 },
  { id: 'b009', title: 'The Three-Body Problem', authors: ['Liu Cixin'], description: 'A secret military project sends signals into space, making first contact with an alien civilization.', imageUrl: 'https://books.google.com/books/content?id=ZrNzAwAAQBAJ&printsec=frontcover&img=1&zoom=1&source=gbs_api', publishedDate: '2014-11-11', categories: ['Science Fiction'], averageRating: 4.0, ratingsCount: 41000, pageCount: 400 },
  { id: 'b010', title: 'Cradle: Unsouled', authors: ['Will Wight'], description: 'Lindon is born without the power that infuses all other sacred artists. His path to power begins with nothing.', imageUrl: 'https://books.google.com/books/content?id=GRqXDwAAQBAJ&printsec=frontcover&img=1&zoom=1&source=gbs_api', publishedDate: '2016-06-01', categories: ['Fantasy'], averageRating: 4.4, ratingsCount: 15000, pageCount: 294 },
  { id: 'b011', title: 'Dark Matter', authors: ['Blake Crouch'], description: 'Jason Dessen is kidnapped and wakes up in a world that is not quite his own. He must fight to get back.', imageUrl: 'https://books.google.com/books/content?id=MTctDAAAQBAJ&printsec=frontcover&img=1&zoom=1&source=gbs_api', publishedDate: '2016-07-26', categories: ['Thriller'], averageRating: 4.1, ratingsCount: 35000, pageCount: 342 },
  { id: 'b012', title: 'Circe', authors: ['Madeline Miller'], description: 'In the house of Helios, god of the sun, a daughter is born. Circe is a strange child, not powerful like her father.', imageUrl: 'https://books.google.com/books/content?id=MFZIEAAAQBAJ&printsec=frontcover&img=1&zoom=1&source=gbs_api', publishedDate: '2018-04-10', categories: ['Fantasy'], averageRating: 4.3, ratingsCount: 47000, pageCount: 393 },
];
