const TMDB_API_KEY = process.env.MOVIE_WEB_TMDB_API_KEY || process.env.TMDB_READ_API_KEY;
const TMDB_PROXY_URL = process.env.TMDB_PROXY_URL || 'http://localhost:8788';

export interface TmdbMetadata {
  title: string;
  tmdbId: string;
  imdbId?: string;
  posterPath?: string;
  backdropPath?: string;
  releaseDate?: string;
  runtime?: number;
  genres?: string[];
  type: 'movie' | 'show';
  season?: number;
  episode?: number;
}

async function makeTmdbRequest(path: string, params: Record<string, string> = {}): Promise<any> {
  if (!TMDB_API_KEY) {
    console.warn('TMDB API key not found (MOVIE_WEB_TMDB_API_KEY or TMDB_READ_API_KEY)');
    return null;
  }

  // Use worker proxy URL instead of direct TMDB
  const url = new URL(`${TMDB_PROXY_URL}${path}`);

  // Handle Bearer token vs Query param
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (TMDB_API_KEY.startsWith('ey')) {
    headers.Authorization = `Bearer ${TMDB_API_KEY}`;
  } else {
    url.searchParams.append('api_key', TMDB_API_KEY);
  }

  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.append(key, value);
  });

  try {
    const response = await fetch(url.toString(), { headers });
    if (!response.ok) {
      console.warn(`TMDB request failed: ${response.status} ${response.statusText}`);
      return null;
    }
    return await response.json();
  } catch (error) {
    console.error('TMDB request error:', error);
    return null;
  }
}

export async function getMediaMetadata(
  tmdbId: string,
  type: 'movie' | 'show',
  season?: string,
  episode?: string,
): Promise<TmdbMetadata | null> {
  try {
    if (type === 'movie') {
      const data = await makeTmdbRequest(`/movie/${tmdbId}`, { append_to_response: 'external_ids' });
      if (!data) return null;

      return {
        title: data.title,
        tmdbId: String(data.id),
        imdbId: data.external_ids?.imdb_id || data.imdb_id,
        posterPath: data.poster_path,
        backdropPath: data.backdrop_path,
        releaseDate: data.release_date,
        runtime: data.runtime,
        genres: data.genres?.map((g: any) => g.name),
        type: 'movie',
      };
    }
    // For shows, we might want show info OR specific episode info
    // If season/episode provided, fetch episode details
    if (season && episode) {
      const showData = await makeTmdbRequest(`/tv/${tmdbId}`, { append_to_response: 'external_ids' });
      const epData = await makeTmdbRequest(`/tv/${tmdbId}/season/${season}/episode/${episode}`);

      if (!showData) return null;

      return {
        title: showData.name, // Show name
        tmdbId: String(showData.id),
        imdbId: showData.external_ids?.imdb_id,
        posterPath: epData?.still_path || showData.poster_path, // Episode still or show poster
        backdropPath: showData.backdrop_path,
        releaseDate: epData?.air_date || showData.first_air_date,
        runtime: epData?.runtime || showData.episode_run_time?.[0],
        genres: showData.genres?.map((g: any) => g.name),
        type: 'show',
        season: Number(season),
        episode: Number(episode),
      };
    }
    // Just show info
    const data = await makeTmdbRequest(`/tv/${tmdbId}`, { append_to_response: 'external_ids' });
    if (!data) return null;

    return {
      title: data.name,
      tmdbId: String(data.id),
      imdbId: data.external_ids?.imdb_id,
      posterPath: data.poster_path,
      backdropPath: data.backdrop_path,
      releaseDate: data.first_air_date,
      genres: data.genres?.map((g: any) => g.name),
      type: 'show',
    };
  } catch (error) {
    console.error('Error fetching metadata:', error);
    return null;
  }
}
