# DahBox + Studio: Unified Content Pipeline Strategy

## Current Architecture

### DahBox (`box.dah.gg`) - DATA SOURCES
| Source | API | Content |
|--------|-----|---------|
| **TMDB** | Movies: upcoming, popular, filterable by language/genre | Title, poster, overview, release date, cast, genres |
| **Google Books** | Books: trending fiction, filterable by genre | Title, cover, description, authors, categories, ratings |
| **RAWG** | Games: popular, classic, upcoming | Name, image, description, genres, platforms, metacritic |

### Studio Pipeline - GAME GENERATORS
| Game Type | Format | Current Source |
|-----------|--------|---------------|
| `trivia` | Multiple choice Q&A | Gemini + Google Search (news-based weekly) |
| `charades` | Act-out clues with MCQ | Manual seed data |
| `aicebreak` | Discussion topics | Manual seed data |
| `syllbus` | Riddles | Manual seed data |
| `fundoo` | Action cards | Manual seed data |
| `rythmbell` | Name that tune | Manual seed data + YouTube |
| `langturn` | Word chains | Manual seed data |
| `lyricnudge` | Complete the lyrics | Manual seed data |

## Proposed: Unified Content Registry

Instead of Studio pulling from **news** and DahBox pulling from **TMDB/Books/RAWG** separately, create a **shared content service** that both consume:

```
TMDB API ──┐
Google Books ──┤── Content Registry ──┬── DahBox (Prediction Markets)
RAWG API ──┤                        ├── Studio (Quiz/Charade Generation)
News API ──┘                        └── Future: Partyho, Dahling, etc.
```

### How Each Game Type Benefits

#### From MOVIES (TMDB)
| Game Type | Content Generated |
|-----------|------------------|
| **trivia** | "Who directed [Movie]?" / "What year was [Movie] released?" / "Which actor stars in [Movie]?" |
| **charades** | Movie plot descriptions as clues, with MCQ options from similar-genre films |
| **aicebreak** | "If [Movie] had a sequel, what would the plot be?" / "Cast yourself in [Movie] - what role?" |
| **fundoo** | "Act out the most iconic scene from [Movie]" / "Pitch [Movie] in 10 seconds" |
| **langturn** | Category: "Movies starting with..." |

#### From BOOKS (Google Books)
| Game Type | Content Generated |
|-----------|------------------|
| **trivia** | "Who wrote [Book]?" / "Which genre is [Book]?" / "How many pages is [Book]?" |
| **charades** | Book plot summaries as clues |
| **aicebreak** | "Which book would you live in?" / "Debate: [Book A] vs [Book B] as a movie?" |
| **syllbus** | Literary riddles from book themes |

#### From GAMES (RAWG)
| Game Type | Content Generated |
|-----------|------------------|
| **trivia** | "What platform is [Game] on?" / "Who developed [Game]?" / "What's the Metacritic score?" |
| **charades** | Game premise descriptions as clues |
| **fundoo** | "Do [Game] character's signature move" / "Narrate [Game] as a movie trailer" |
| **aicebreak** | "Which game world would you live in?" / "Best [Game] adaptation director?" |

## Implementation Plan

### Phase 1: Shared Content Fetcher (Studio side)
Create `studio/lib/content-sources/` with:
- `tmdb.ts` - Reuse DahBox's TMDB fetch logic
- `books.ts` - Reuse DahBox's Google Books fetch
- `games.ts` - Reuse DahBox's RAWG fetch
- `index.ts` - Unified `ContentItem` interface

### Phase 2: Game Content Generators 
Create `studio/lib/generators/` with:
- `trivia-from-movies.ts` - Generate trivia questions from TMDB data
- `trivia-from-books.ts` - Generate trivia from book data
- `charades-from-movies.ts` - Generate charade clues from plots
- `charades-from-games.ts` - Generate charade clues from game descriptions
- Each generator takes a `ContentItem[]` and outputs the game-specific format

### Phase 3: Pipeline Integration
Update `news/src/index.js` weekly pipeline to:
1. Fetch from ALL content sources (not just news)
2. Generate ALL game types for ALL content categories
3. Upload to DynamoDB (TZERS table) with proper language codes
4. This replaces the current news-only approach

### Phase 4: Cross-Pollination
- DahBox prediction results feed back into trivia ("Opening weekend was $X - was that above or below predictions?")
- Studio quizzes drive engagement back to DahBox ("Think you know movies? Bet on it!")

## Key Decision Points

> [!IMPORTANT]
> 1. **Should we use Gemini to generate quiz questions from TMDB/Books data, or use template-based generation?**
>    - Gemini: Higher quality, more natural, but costs API calls
>    - Templates: Free, deterministic, but more formulaic
>    - **Recommendation**: Hybrid. Use templates for factual trivia, Gemini for creative games (charades, icebreakers)
>
> 2. **How often should content refresh?**
>    - Movies: Weekly (new releases change)
>    - Books: Monthly (bestseller lists update)
>    - Games: Weekly (new releases, metacritic changes)
>
> 3. **Should the shared content module live in a separate package or be duplicated?**
>    - **Option A**: npm workspace/shared package
>    - **Option B**: DahBox exposes API, Studio calls it
>    - **Option C**: Copy fetch logic to both (current approach, simplest)
>    - **Recommendation**: Option B - DahBox as content API, Studio as consumer

## Architecture Diagram

```mermaid
graph TD
    subgraph "Content Sources"
        TMDB[TMDB API<br>Movies]
        GBOOKS[Google Books<br>Novels]
        RAWG[RAWG API<br>Video Games]
        NEWS[Gemini + Search<br>Weekly News]
    end

    subgraph "DahBox - box.dah.gg"
        DB_API["/api/movies<br>/api/books<br>/api/games"]
        DB_MARKETS[Prediction Markets<br>Staking Engine]
        DB_SEO[SEO Pages<br>/movie/[slug]"]
    end

    subgraph "Studio Pipeline"
        FETCH[Content Fetcher]
        GEN[Game Generators]
        DYNAMO[(DynamoDB<br>TZERS Table)]
    end

    subgraph "Consumer Apps"
        DAHLING[Dahling<br>Party Games]
        MEMI[Memi<br>Companion App]
        PARTYHO[Partyho<br>dah.gg]
    end

    TMDB --> DB_API
    GBOOKS --> DB_API
    RAWG --> DB_API
    
    DB_API --> DB_MARKETS
    DB_API --> DB_SEO
    DB_API --> FETCH
    NEWS --> FETCH
    
    FETCH --> GEN
    GEN --> DYNAMO
    
    DYNAMO --> DAHLING
    DYNAMO --> MEMI
    DYNAMO --> PARTYHO
```
