import { load } from 'cheerio';

import { flags } from '@/entrypoint/utils/targets';
import { makeEmbed } from '@/providers/base';

export const wecimaEmbedScraper = makeEmbed({
  id: 'wecima-embed',
  name: 'Wecima Embed',
  rank: 90,
  async scrape(ctx) {
    // Get the embed page
    const embedPage = await ctx.proxiedFetcher<string>(ctx.url);
    const $ = load(embedPage);

    // Look for the HLS master playlist URL in the JavaScript
    // Based on your analysis, it should be in the format:
    // https://fdewsdc.sbs/stream/TOKEN/ID/TIMESTAMP/FILEID/master.m3u8

    let hlsUrl: string | undefined;

    // Try to extract from the JavaScript setup
    const scriptTags = $('script');
    for (const script of scriptTags) {
      const scriptContent = $(script).html() || '';

      // Look for master.m3u8 URLs
      const hlsMatch = scriptContent.match(/https?:\/\/[^"']+\/master\.m3u8/);
      if (hlsMatch) {
        hlsUrl = hlsMatch[0];
        break;
      }

      // Also look for the stream URL pattern you found
      const streamMatch = scriptContent.match(/https?:\/\/fdewsdc\.sbs\/stream\/[^"']+\/master\.m3u8/);
      if (streamMatch) {
        hlsUrl = streamMatch[0];
        break;
      }
    }

    // If not found in scripts, try to find it in data attributes or other places
    if (!hlsUrl) {
      const videoElements = $('video, source, div[data-src], div[data-url]');
      for (const element of videoElements) {
        const src = $(element).attr('src') || $(element).attr('data-src') || $(element).attr('data-url');
        if (src && src.includes('master.m3u8')) {
          hlsUrl = src;
          break;
        }
      }
    }

    if (!hlsUrl) {
      throw new Error('No HLS stream URL found in wecima embed');
    }

    return {
      stream: [
        {
          id: 'primary',
          type: 'hls',
          flags: [flags.IP_LOCKED],
          captions: [],
          playlist: hlsUrl,
          headers: {
            Referer: ctx.url,
            Origin: new URL(ctx.url).origin,
          },
        },
      ],
    };
  },
});
