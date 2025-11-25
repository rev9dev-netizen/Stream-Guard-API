import { load } from 'cheerio';

import { flags } from '@/entrypoint/utils/targets';
import { SourcererEmbed, makeSourcerer } from '@/providers/base';
import { compareMedia } from '@/utils/compare';
import { NotFoundError } from '@/utils/errors';

const baseUrl = 'https://mycima.pics/';

export const wecimaScraper = makeSourcerer({
  id: 'wecima',
  name: 'Wecima (Arabic)',
  rank: 55,
  disabled: true,
  flags: [flags.IP_LOCKED],
  scrapeMovie: async (ctx) => {
    // Search for the movie
    const searchResults = await ctx.proxiedFetcher<string>(`/search/${encodeURIComponent(ctx.media.title)}/`, {
      baseUrl,
    });

    const search$ = load(searchResults);
    const movieLinks = search$('.Grid--WecimaPosts .GridItem a');

    let movieUrl: string | undefined;
    for (const element of movieLinks) {
      const title = search$(element).find('.title').text().trim();
      const year = search$(element).find('.year').text().trim();

      if (compareMedia(ctx.media, title, year ? parseInt(year, 10) : undefined)) {
        movieUrl = search$(element).attr('href');
        break;
      }
    }

    if (!movieUrl) throw new NotFoundError('Movie not found');
    ctx.progress(40);

    // Get movie page
    const moviePage = await ctx.proxiedFetcher<string>(movieUrl, { baseUrl });
    const movie$ = load(moviePage);

    const embeds: SourcererEmbed[] = [];

    // Look for server buttons or embed links
    const serverButtons = movie$('.servers-list a, .server-item a, button[data-server]');

    for (const button of serverButtons) {
      const embedUrl =
        movie$(button).attr('href') || movie$(button).attr('data-url') || movie$(button).attr('data-server');
      if (!embedUrl) continue;

      // Check if it's an fdewsdc.sbs embed (the host you found)
      if (embedUrl.includes('fdewsdc.sbs') || embedUrl.includes('/embed/')) {
        embeds.push({
          embedId: 'wecima-embed',
          url: embedUrl.startsWith('http') ? embedUrl : `https:${embedUrl}`,
        });
      }
    }

    // Also check for any embed iframes
    const iframes = movie$('iframe[src*="/embed/"], iframe[src*="fdewsdc"], iframe[src*="player"]');
    for (const iframe of iframes) {
      const iframeSrc = movie$(iframe).attr('src');
      if (iframeSrc) {
        embeds.push({
          embedId: 'wecima-embed',
          url: iframeSrc.startsWith('http') ? iframeSrc : `https:${iframeSrc}`,
        });
      }
    }

    ctx.progress(90);
    return { embeds };
  },

  scrapeShow: async (ctx) => {
    // Search for the show
    const searchResults = await ctx.proxiedFetcher<string>(`/search/${encodeURIComponent(ctx.media.title)}/`, {
      baseUrl,
    });

    const search$ = load(searchResults);
    const showLinks = search$('.Grid--WecimaPosts .GridItem a');

    let showUrl: string | undefined;
    for (const element of showLinks) {
      const title = search$(element).find('.title').text().trim();
      const year = search$(element).find('.year').text().trim();

      if (compareMedia(ctx.media, title, year ? parseInt(year, 10) : undefined)) {
        showUrl = search$(element).attr('href');
        break;
      }
    }

    if (!showUrl) throw new NotFoundError('Show not found');
    ctx.progress(30);

    // Get show page and find season
    const showPage = await ctx.proxiedFetcher<string>(showUrl, { baseUrl });
    const show$ = load(showPage);

    // Look for season links
    const seasonLinks = show$('.List--Seasons--Episodes a, .season-link');
    let seasonUrl: string | undefined;

    for (const element of seasonLinks) {
      const text = show$(element).text().trim();
      if (text.includes(`موسم ${ctx.media.season.number}`) || text.includes(`Season ${ctx.media.season.number}`)) {
        seasonUrl = show$(element).attr('href');
        break;
      }
    }

    if (!seasonUrl) throw new NotFoundError(`Season ${ctx.media.season.number} not found`);
    ctx.progress(50);

    // Get season page and find episode
    const seasonPage = await ctx.proxiedFetcher<string>(seasonUrl, { baseUrl });
    const season$ = load(seasonPage);

    const episodeLinks = season$('.Episodes--Seasons--Episodes a, .episode-link');
    let episodeUrl: string | undefined;

    for (const element of episodeLinks) {
      const text = season$(element).text().trim();
      if (text.includes(`الحلقة ${ctx.media.episode.number}`) || text.includes(`Episode ${ctx.media.episode.number}`)) {
        episodeUrl = season$(element).attr('href');
        break;
      }
    }

    if (!episodeUrl) throw new NotFoundError(`Episode ${ctx.media.episode.number} not found`);
    ctx.progress(70);

    // Get episode page
    const episodePage = await ctx.proxiedFetcher<string>(episodeUrl, { baseUrl });
    const episode$ = load(episodePage);

    const embeds: SourcererEmbed[] = [];

    // Look for server buttons or embed links
    const serverButtons = episode$('.servers-list a, .server-item a, button[data-server]');

    for (const button of serverButtons) {
      const embedUrl =
        episode$(button).attr('href') || episode$(button).attr('data-url') || episode$(button).attr('data-server');
      if (!embedUrl) continue;

      if (embedUrl.includes('fdewsdc.sbs') || embedUrl.includes('/embed/')) {
        embeds.push({
          embedId: 'wecima-embed',
          url: embedUrl.startsWith('http') ? embedUrl : `https:${embedUrl}`,
        });
      }
    }

    // Also check for any embed iframes
    const iframes = episode$('iframe[src*="/embed/"], iframe[src*="fdewsdc"], iframe[src*="player"]');
    for (const iframe of iframes) {
      const iframeSrc = episode$(iframe).attr('src');
      if (iframeSrc) {
        embeds.push({
          embedId: 'wecima-embed',
          url: iframeSrc.startsWith('http') ? iframeSrc : `https:${iframeSrc}`,
        });
      }
    }

    ctx.progress(90);
    return { embeds };
  },
});
