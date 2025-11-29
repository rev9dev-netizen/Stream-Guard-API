/* eslint-disable no-console */
import { flags } from '@/entrypoint/utils/targets';
import { makeEmbed } from '@/providers/base';
import { HlsBasedStream } from '@/providers/streams';
import { NotFoundError } from '@/utils/errors';
import { createM3U8ProxyUrl } from '@/utils/proxy';

const PASSPHRASE = 'T8c8PQlSQVU4mBuW4CbE/g57VBbM5009QHd+ym93aZZ5pEeVpToY6OdpYPvRMVYp';

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

export const vidnestHollymoviehdEmbed = makeEmbed({
  id: 'vidnest-hollymoviehd',
  name: 'HollyMovie',
  rank: 104,
  async scrape(ctx) {
    const serverStreams = await fetchAndDecrypt(ctx, ctx.url);
    console.log('HollyMovie Decrypted Data:', JSON.stringify(serverStreams, null, 2));
    if (!serverStreams.success || !serverStreams.sources) throw new NotFoundError('No streams found');

    const streams = [];
    for (const source of serverStreams.sources) {
      if (source.file.includes('pkaystream.cc/pl/')) {
        streams.push({
          id: `hollymoviehd-${source.label}`,
          type: 'hls',
          playlist: createM3U8ProxyUrl(source.file),
          flags: [flags.CORS_ALLOWED],
          captions: [],
        } as HlsBasedStream);
      }
    }

    return {
      stream: streams,
    };
  },
});

export const vidnestAllmoviesEmbed = makeEmbed({
  id: 'vidnest-allmovies',
  name: 'AllMovies (Hindi)',
  rank: 103,
  async scrape(ctx) {
    const serverStreams = await fetchAndDecrypt(ctx, ctx.url);
    if (!serverStreams.streams) throw new NotFoundError('No streams found');

    const streams = [];
    for (const stream of serverStreams.streams) {
      streams.push({
        id: `allmovies-${stream.language}`,
        type: 'hls',
        playlist: stream.url,
        flags: [flags.CORS_ALLOWED],
        captions: [],
        preferredHeaders: stream.headers,
      } as HlsBasedStream);
    }

    return {
      stream: streams,
    };
  },
});

export const vidnestFlixhqEmbed = makeEmbed({
  id: 'vidnest-flixhq',
  name: 'FlixHQ',
  rank: 102,
  disabled: true,
  async scrape() {
    throw new Error('Not implemented');
  },
});

export const vidnestOfficialEmbed = makeEmbed({
  id: 'vidnest-official',
  name: 'Official',
  rank: 101,
  disabled: true,
  async scrape() {
    throw new Error('Not implemented');
  },
});
