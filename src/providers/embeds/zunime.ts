import { NotFoundError } from '@/utils/errors';

import { EmbedOutput, makeEmbed } from '../base';

const ZUNIME_SERVERS = ['hd-2', 'miko', 'shiro', 'zaza'];

const baseUrl = 'https://vidnest.fun'; // Try direct vidnest API
const headers = {
  referer: 'https://vidnest.fun/',
  origin: 'https://vidnest.fun',
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
};

export function makeZunimeEmbed(id: string, rank: number = 100) {
  return makeEmbed({
    id: `zunime-${id}`,
    name: `${id.charAt(0).toUpperCase() + id.slice(1)}`,
    rank,
    async scrape(ctx): Promise<EmbedOutput> {
      const serverName = id as (typeof ZUNIME_SERVERS)[number];
      const embedUrl = ctx.url;

      // Parse the embed URL to determine content type and parameters
      let apiPath = '';
      let apiQuery: any = {};

      if (embedUrl.includes('/movie/')) {
        // Movie format: https://vidnest.fun/movie/550
        const tmdbId = embedUrl.split('/movie/')[1];
        apiPath = '/api/movie'; // Try API prefix
        apiQuery = {
          tmdb: tmdbId,
          server: serverName,
        };
      } else if (embedUrl.includes('/tv/')) {
        // TV format: https://vidnest.fun/tv/1396/1/1
        const pathParts = embedUrl.split('/tv/')[1].split('/');
        const tmdbId = pathParts[0];
        const season = pathParts[1] || '1';
        const episode = pathParts[2] || '1';

        apiPath = '/api/tv'; // Try API prefix
        apiQuery = {
          tmdb: tmdbId,
          season,
          episode,
          server: serverName,
        };
      } else if (embedUrl.includes('/anime/')) {
        // Anime format: https://vidnest.fun/anime/16498/1/dub
        const pathParts = embedUrl.split('/anime/')[1].split('/');
        const anilistId = pathParts[0];
        const episode = pathParts[1] || '1';
        const type = pathParts[2] || 'dub';

        apiPath = '/api/anime'; // Try API prefix
        apiQuery = {
          anilist: anilistId,
          episode,
          server: serverName,
          type,
        };
      } else {
        throw new NotFoundError('Invalid embed URL format');
      }

      // Call the backend API
      const res = await ctx.proxiedFetcher(apiPath, {
        baseUrl,
        headers,
        query: apiQuery,
      });

      // eslint-disable-next-line no-console
      console.log('API Response:', res);

      const resAny: any = res as any;

      // Check for different possible response structures
      let streamUrl: string | null = null;
      let streamHeaders: Record<string, string> = headers;

      if (resAny?.success && resAny?.sources?.url) {
        // Standard response structure
        streamUrl = resAny.sources.url;
        streamHeaders = resAny?.sources?.headers || headers;
      } else if (resAny?.url) {
        // Direct URL response
        streamUrl = resAny.url;
      } else if (resAny?.stream?.url) {
        // Alternative response structure
        streamUrl = resAny.stream.url;
        streamHeaders = resAny?.stream?.headers || headers;
      } else if (typeof resAny === 'string' && resAny.startsWith('http')) {
        // Direct string URL response
        streamUrl = resAny;
      }

      if (!streamUrl) {
        throw new NotFoundError('No stream URL found in response');
      }

      // If the URL is already proxied through vidnest.fun, use it directly
      // Otherwise, wrap it with the old proxy
      let finalStreamUrl = streamUrl;
      if (!streamUrl.includes('proxy.vidnest.fun') && !streamUrl.includes('proxy-2.madaraverse.online')) {
        finalStreamUrl = `https://proxy-2.madaraverse.online/proxy?url=${encodeURIComponent(streamUrl)}`;
      }

      ctx.progress(100);

      return {
        stream: [
          {
            id: 'primary',
            type: 'hls',
            playlist: finalStreamUrl,
            headers: streamHeaders,
            flags: [],
            captions: [],
          },
        ],
      };
    },
  });
}

export const zunimeEmbeds = ZUNIME_SERVERS.map((server, i) => makeZunimeEmbed(server, 260 - i));
