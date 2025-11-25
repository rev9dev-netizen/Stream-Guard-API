import { load } from 'cheerio';

import { flags } from '@/entrypoint/utils/targets';
import { SourcererEmbed, makeSourcerer } from '@/providers/base';
import { compareMedia } from '@/utils/compare';
import { NotFoundError } from '@/utils/errors';

import { baseUrl, parseSearch } from './common';

export const tugaflixScraper = makeSourcerer({
  id: 'tugaflix',
  name: 'Tugaflix',
  rank: 70,
  disabled: true,
  flags: [flags.IP_LOCKED],
  scrapeMovie: async (ctx) => {
    const searchResults = parseSearch(
      await ctx.proxiedFetcher<string>('/filmes/', {
        baseUrl,
        query: {
          s: ctx.media.title,
        },
      }),
    );
    if (searchResults.length === 0) throw new NotFoundError('No watchable item found');

    const url = searchResults.find((x) => x && compareMedia(ctx.media, x.title, x.year))?.url;
    if (!url) throw new NotFoundError('No watchable item found');
    ctx.progress(50);

    // Get the movie page
    const moviePage = await ctx.proxiedFetcher<string>(url, {
      baseUrl,
    });
    const $ = load(moviePage);

    const embeds: SourcererEmbed[] = [];

    // Look for mixdrop embed links
    // Check for player buttons or iframe sources
    const playerElements = $('iframe[src*="mixdrop"], a[href*="mixdrop"], button[data-url*="mixdrop"]');

    for (const element of playerElements) {
      const embedUrl = $(element).attr('src') || $(element).attr('href') || $(element).attr('data-url');
      if (!embedUrl) continue;

      if (embedUrl.includes('mixdrop')) {
        embeds.push({
          embedId: 'mixdrop',
          url: embedUrl.startsWith('http') ? embedUrl : `https:${embedUrl}`,
        });
      }
    }

    // If no direct mixdrop links found, look for watch buttons that might lead to mixdrop
    if (embeds.length === 0) {
      const watchButtons = $('a:contains("Watch"), a:contains("Assistir"), .watch-btn, .play-btn');

      for (const button of watchButtons) {
        const buttonUrl = $(button).attr('href');
        if (!buttonUrl) continue;

        try {
          const buttonPage = await ctx.proxiedFetcher<string>(buttonUrl, {
            baseUrl,
          });
          const $button = load(buttonPage);

          // Look for mixdrop links in the button page
          const mixdropLinks = $button('iframe[src*="mixdrop"], a[href*="mixdrop"]');
          for (const link of mixdropLinks) {
            const embedUrl = $button(link).attr('src') || $button(link).attr('href');
            if (embedUrl && embedUrl.includes('mixdrop')) {
              embeds.push({
                embedId: 'mixdrop',
                url: embedUrl.startsWith('http') ? embedUrl : `https:${embedUrl}`,
              });
            }
          }
        } catch (error) {
          // Continue to next button if this one fails
          continue;
        }
      }
    }

    ctx.progress(90);

    return {
      embeds,
    };
  },
  scrapeShow: async (ctx) => {
    const searchResults = parseSearch(
      await ctx.proxiedFetcher<string>('/series/', {
        baseUrl,
        query: {
          s: ctx.media.title,
        },
      }),
    );
    if (searchResults.length === 0) throw new NotFoundError('No watchable item found');

    const url = searchResults.find((x) => x && compareMedia(ctx.media, x.title, x.year))?.url;
    if (!url) throw new NotFoundError('No watchable item found');
    ctx.progress(50);

    // Get the show page
    const showPage = await ctx.proxiedFetcher<string>(url, {
      baseUrl,
    });
    const $ = load(showPage);

    const embeds: SourcererEmbed[] = [];

    // Look for episode selection or season/episode links
    const s = ctx.media.season.number < 10 ? `0${ctx.media.season.number}` : ctx.media.season.number.toString();
    const e = ctx.media.episode.number < 10 ? `0${ctx.media.episode.number}` : ctx.media.episode.number.toString();

    // Try to find episode link or submit episode form
    const episodeLink = $(
      `a:contains("S${s}E${e}"), a:contains("${ctx.media.season.number}x${ctx.media.episode.number}")`,
    ).attr('href');

    let episodePage = showPage;
    if (episodeLink) {
      episodePage = await ctx.proxiedFetcher<string>(episodeLink, {
        baseUrl,
      });
    } else {
      // Try POST method with episode data
      try {
        episodePage = await ctx.proxiedFetcher<string>(url, {
          method: 'POST',
          body: new URLSearchParams({ [`S${s}E${e}`]: '' }),
          baseUrl,
        });
      } catch (error) {
        // If POST fails, continue with the original page
      }
    }

    const $episode = load(episodePage);

    // Look for mixdrop embed links
    const playerElements = $episode('iframe[src*="mixdrop"], a[href*="mixdrop"], button[data-url*="mixdrop"]');

    for (const element of playerElements) {
      const embedUrl =
        $episode(element).attr('src') || $episode(element).attr('href') || $episode(element).attr('data-url');
      if (!embedUrl) continue;

      if (embedUrl.includes('mixdrop')) {
        embeds.push({
          embedId: 'mixdrop',
          url: embedUrl.startsWith('http') ? embedUrl : `https:${embedUrl}`,
        });
      }
    }

    // If no direct mixdrop links found, look for player iframes or watch buttons
    if (embeds.length === 0) {
      const iframes = $episode('iframe[name="player"], iframe[src]');

      for (const iframe of iframes) {
        const iframeUrl = $episode(iframe).attr('src');
        if (!iframeUrl) continue;

        try {
          const iframePage = await ctx.proxiedFetcher<string>(
            iframeUrl.startsWith('http') ? iframeUrl : `https:${iframeUrl}`,
          );
          const $iframe = load(iframePage);

          // Look for mixdrop links in the iframe page
          const mixdropLinks = $iframe('iframe[src*="mixdrop"], a[href*="mixdrop"]');
          for (const link of mixdropLinks) {
            const embedUrl = $iframe(link).attr('src') || $iframe(link).attr('href');
            if (embedUrl && embedUrl.includes('mixdrop')) {
              embeds.push({
                embedId: 'mixdrop',
                url: embedUrl.startsWith('http') ? embedUrl : `https:${embedUrl}`,
              });
            }
          }
        } catch (error) {
          // Continue to next iframe if this one fails
          continue;
        }
      }
    }

    ctx.progress(90);

    return {
      embeds,
    };
  },
});
