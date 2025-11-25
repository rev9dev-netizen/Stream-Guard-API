/* eslint-disable no-console */
import type { ShowMedia } from '@/entrypoint/utils/media';
import { SourcererOutput, makeSourcerer } from '@/providers/base';
import { MovieScrapeContext, ShowScrapeContext } from '@/utils/context';
import { NotFoundError } from '@/utils/errors';

import { decode, mirza } from './decrypt';
import { evaluateOnCurrentPage, fetchWithPuppeteer } from './puppeteer-fetcher';

// Default player configuration
const o = {
  y: 'xx??x?=xx?xx?=',
  u: '#1RyJzl3JYmljm0mkJWOGYWNyI6MfwVNGYXmj9uQj5tQkeYIWoxLCJXNkawOGF5QZ9sQj1YIWowLCJXO20VbVJ1OZ11QGiSlni0QG9uIn19',
};

async function vidsrcScrape(ctx: MovieScrapeContext | ShowScrapeContext): Promise<SourcererOutput> {
  const imdbId = ctx.media.imdbId;
  if (!imdbId) throw new NotFoundError('IMDb ID not found');

  const isShow = ctx.media.type === 'show';
  let season: number | undefined;
  let episode: number | undefined;

  if (isShow) {
    const show = ctx.media as ShowMedia;
    season = show.season?.number;
    episode = show.episode?.number;
  }

  const embedUrl = isShow
    ? `https://vidsrc-embed.ru/embed/tv?imdb=${imdbId}&season=${season}&episode=${episode}`
    : `https://vidsrc-embed.ru/embed/${imdbId}`;

  ctx.progress(10);

  const embedHtml = await ctx.proxiedFetcher<string>(embedUrl, {
    headers: {
      Referer: 'https://vidsrc-embed.ru/',
      'User-Agent': 'Mozilla/5.0',
    },
  });

  ctx.progress(30);

  // Extract the iframe source using regex
  const iframeMatch = embedHtml.match(/<iframe[^>]*id="player_iframe"[^>]*src="([^"]*)"[^>]*>/);
  if (!iframeMatch) throw new NotFoundError('Initial iframe not found');

  const rcpUrl = iframeMatch[1].startsWith('//') ? `https:${iframeMatch[1]}` : iframeMatch[1];

  ctx.progress(50);

  // Use Puppeteer to bypass Cloudflare Turnstile challenge
  const rcpHtml = await fetchWithPuppeteer(rcpUrl, embedUrl);

  // Find the /prorcp/ URL from the JavaScript function (it's inside loadIframe function)
  // Pattern matches: src: '/prorcp/...' (note the space after colon and single quotes)
  const scriptMatch = rcpHtml.match(/src:\s+'(\/prorcp\/[^']+)'/);

  if (!scriptMatch) {
    throw new NotFoundError('Could not find prorcp URL - Cloudflare challenge may have failed');
  }

  let streamUrl = '';

  if (scriptMatch) {
    // Found prorcp URL, fetch it to get the final player page
    const prorcpUrl = `https://cloudnestra.com${scriptMatch[1]}`;

    ctx.progress(70);

    const finalHtml = await fetchWithPuppeteer(prorcpUrl, rcpUrl);

    // Find script containing Playerjs
    const scripts = finalHtml.split('<script');
    let scriptWithPlayer = '';

    for (const script of scripts) {
      if (script.includes('Playerjs')) {
        scriptWithPlayer = script;
        break;
      }
    }

    if (!scriptWithPlayer) {
      throw new NotFoundError('No Playerjs config found');
    }

    // Try to find file: "url" pattern first (old format)
    const m3u8Match = scriptWithPlayer.match(/file\s*:\s*['"]([^'"]+)['"]/);

    if (!m3u8Match) {
      // New format: file: variableName (references a hidden div)
      const fileVarMatch = scriptWithPlayer.match(/file\s*:\s*([a-zA-Z0-9_]+)\s*[,}]/);

      if (fileVarMatch) {
        const varName = fileVarMatch[1];

        // Find the div with this ID that contains the encoded data
        const divMatch = finalHtml.match(new RegExp(`<div id="${varName}"[^>]*>\\s*([^<]+)\\s*</div>`, 's'));

        if (divMatch) {
          // The page decodes this automatically and puts it in window[varName]
          // We can extract it using Puppeteer

          // Wait a bit for the decoding script to run
          await new Promise<void>((resolve) => {
            setTimeout(() => {
              resolve();
            }, 2000);
          });

          try {
            // Extract the variable value from the window object
            const decodedUrl = await evaluateOnCurrentPage<unknown>((name: string) => {
              return (window as any)[name];
            }, varName);

            if (decodedUrl && typeof decodedUrl === 'string') {
              const urlStr = decodedUrl as string;
              streamUrl = urlStr;
            } else {
              throw new NotFoundError('Failed to extract decoded URL from page');
            }
          } catch (err) {
            throw new NotFoundError('Error executing extraction script');
          }
        } else {
          throw new NotFoundError('No file data found in referenced div');
        }
      } else {
        throw new NotFoundError('No file field in Playerjs');
      }
    } else {
      streamUrl = m3u8Match[1];
    }
  } else {
    // Fallback: try to extract m3u8 URL directly from the rcp page
    ctx.progress(70);

    const directM3u8Match = rcpHtml.match(/file\s*:\s*['"]([^'"]*\.m3u8[^'"]*)['"]/);
    if (!directM3u8Match) {
      throw new NotFoundError('Could not find prorcp iframe or direct m3u8 URL');
    }

    streamUrl = directM3u8Match[1];
  }

  if (!streamUrl.includes('.m3u8') && !streamUrl.startsWith('http')) {
    // Check if we need to decode the URL
    const v = JSON.parse(decode(o.u));
    streamUrl = mirza(streamUrl, v);
  }

  // Post-processing for specific placeholders
  // The streamUrl might contain multiple URLs separated by " or "
  const rawUrls = streamUrl.split(' or ');
  const streams: any[] = [];

  // Try to find domain values in the page
  const domainMap = await evaluateOnCurrentPage<Record<string, string>>(() => {
    // Check for common variable names or patterns
    const vars: Record<string, string> = {};
    if ((window as any).v1) vars.v1 = (window as any).v1;
    if ((window as any).v2) vars.v2 = (window as any).v2;
    if ((window as any).v3) vars.v3 = (window as any).v3;
    if ((window as any).v4) vars.v4 = (window as any).v4;

    return vars;
  }).catch(() => ({}) as Record<string, string>);

  // Hardcoded fallback for v1 if not found (based on previous success)
  if (!domainMap.v1) domainMap.v1 = 'shadowlandschronicles.com';

  const headers = {
    referer: 'https://cloudnestra.com/',
    origin: 'https://cloudnestra.com',
  };

  for (let url of rawUrls) {
    url = url.trim();

    // Replace placeholders
    for (const [key, value] of Object.entries(domainMap)) {
      if (url.includes(`{${key}}`)) {
        url = url.replace(new RegExp(`{${key}}`, 'g'), value);
      }
    }

    // Fix subdomain if needed (tmstr5 -> tmstr2)
    if (url.includes('tmstr5')) {
      url = url.replace(/tmstr5/g, 'tmstr2');
    }

    // If URL still has placeholders, skip it
    if (url.match(/{v\d+}/)) {
      continue;
    }

    streams.push({
      id: `vidsrc-cloudnestra-${streams.length}`,
      type: 'hls',
      playlist: url,
      headers,
      proxyDepth: 2,
      flags: [],
      captions: [],
    });
  }

  ctx.progress(90);

  return {
    stream: streams,
    embeds: [],
  };
}

export const vidsrcScraper = makeSourcerer({
  id: 'cloudnestra',
  name: 'Cloudnestra',
  rank: 180,
  flags: [],
  scrapeMovie: vidsrcScrape,
  scrapeShow: vidsrcScrape,
});

// thanks Mirzya for this scraper fixed by @rev9
