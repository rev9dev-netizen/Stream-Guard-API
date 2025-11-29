/* eslint-disable no-console */
import { flags } from '@/entrypoint/utils/targets';
import { makeSourcerer } from '@/providers/base';
import { HlsBasedStream } from '@/providers/streams';
import { MovieScrapeContext, ShowScrapeContext } from '@/utils/context';

const backendUrl = 'https://backend.vidnest.fun';
const PASSPHRASE = 'T8c8PQlSQVU4mBuW4CbE/g57VBbM5009QHd+ym93aZZ5pEeVpToY6OdpYPvRMVYp';

const servers = ['allmovies', 'hollymoviehd'];

async function decryptAesGcm(encryptedB64: string, passphraseB64: string) {
  const encryptedBytes = Buffer.from(encryptedB64, 'base64');
  const keyBytes = Buffer.from(passphraseB64, 'base64').subarray(0, 32);
  const iv = encryptedBytes.subarray(0, 12);
  const data = encryptedBytes.subarray(12);

  const key = await crypto.subtle.importKey('raw', keyBytes, { name: 'AES-GCM' }, false, ['decrypt']);

  const decrypted = await crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv,
    },
    key,
    data,
  );

  return new TextDecoder().decode(decrypted);
}

async function fetchAndDecrypt(ctx: any, url: string) {
  let data = await ctx.proxiedFetcher(url);
  if (data.encrypted && data.data) {
    const decrypted = await decryptAesGcm(data.data, PASSPHRASE);
    data = JSON.parse(decrypted);
  }
  return data;
}

async function scrape(ctx: MovieScrapeContext | ShowScrapeContext, type: 'movie' | 'tv') {
  const embeds = [];
  const streams = [];

  for (const server of servers) {
    let url = '';
    if (type === 'movie') {
      url = `${backendUrl}/${server}/movie/${ctx.media.tmdbId}`;
    } else if (ctx.media.type === 'show') {
      url = `${backendUrl}/${server}/tv/${ctx.media.tmdbId}/${ctx.media.season.number}/${ctx.media.episode.number}`;
    }

    // Add embed URL
    embeds.push({
      embedId: `vidnest-${server}`,
      url,
    });

    // Try to fetch streams directly
    try {
      const serverStreams = await fetchAndDecrypt(ctx, url);

      if (server === 'hollymoviehd' && serverStreams.success && serverStreams.sources) {
        for (const source of serverStreams.sources) {
          // Accept both flashstream.cc and pkaystream.cc domains
          if (source.file && (source.file.includes('flashstream.cc') || source.file.includes('pkaystream.cc'))) {
            streams.push({
              id: `hollymoviehd-${source.label || 'default'}`,
              type: 'hls',
              playlist: source.file,
              flags: [flags.CORS_ALLOWED],
              captions: [],
            } as HlsBasedStream);
          }
        }
      } else if (server === 'allmovies' && serverStreams.streams) {
        for (const stream of serverStreams.streams) {
          streams.push({
            id: `allmovies-${stream.language || 'default'}`,
            type: 'hls',
            playlist: stream.url,
            flags: [flags.CORS_ALLOWED],
            captions: [],
            preferredHeaders: stream.headers,
          } as HlsBasedStream);
        }
      }
    } catch (error) {
      // If fetching streams fails, we still have the embed URLs
      console.log(`Failed to fetch streams from ${server}:`, error);
    }
  }

  return {
    embeds,
    stream: streams,
  };
}

const vidnestScraper = makeSourcerer({
  id: 'vidnest',
  name: 'Vidnest',
  rank: 130,
  flags: [flags.CORS_ALLOWED],
  scrapeMovie: (ctx: MovieScrapeContext) => scrape(ctx, 'movie'),
  scrapeShow: (ctx: ShowScrapeContext) => scrape(ctx, 'tv'),
});

export default vidnestScraper;
