import { SourcererOutput, makeSourcerer } from '@/providers/base';
import { getAnilistIdFromMedia } from '@/utils/anilist';
import { MovieScrapeContext, ShowScrapeContext } from '@/utils/context';

async function comboScraper(ctx: ShowScrapeContext | MovieScrapeContext): Promise<SourcererOutput> {
  let embedUrls: { embedId: string; url: string }[] = [];

  // Generate proper embed URLs based on content type
  if (ctx.media.type === 'movie') {
    // For movies, use TMDB-based embed URLs
    const baseEmbedUrl = `https://vidnest.fun/movie/${ctx.media.tmdbId}`;
    embedUrls = [
      { embedId: 'zunime-hd-2', url: baseEmbedUrl },
      { embedId: 'zunime-miko', url: baseEmbedUrl },
      { embedId: 'zunime-shiro', url: baseEmbedUrl },
      { embedId: 'zunime-zaza', url: baseEmbedUrl },
    ];
  } else if (ctx.media.type === 'show') {
    try {
      // Try to get Anilist ID for anime shows
      const anilistId = await getAnilistIdFromMedia(ctx, ctx.media);
      const baseEmbedUrl = `https://vidnest.fun/anime/${anilistId}/${ctx.media.episode.number}/dub`;
      embedUrls = [
        { embedId: 'zunime-hd-2', url: baseEmbedUrl },
        { embedId: 'zunime-miko', url: baseEmbedUrl },
        { embedId: 'zunime-shiro', url: baseEmbedUrl },
        { embedId: 'zunime-zaza', url: baseEmbedUrl },
      ];
    } catch {
      // Fallback to TMDB for regular TV shows
      const baseEmbedUrl = `https://vidnest.fun/tv/${ctx.media.tmdbId}/${ctx.media.season.number}/${ctx.media.episode.number}`;
      embedUrls = [
        { embedId: 'zunime-hd-2', url: baseEmbedUrl },
        { embedId: 'zunime-miko', url: baseEmbedUrl },
        { embedId: 'zunime-shiro', url: baseEmbedUrl },
        { embedId: 'zunime-zaza', url: baseEmbedUrl },
      ];
    }
  }

  return {
    embeds: embedUrls,
  };
}

export const zunimeScraper = makeSourcerer({
  id: 'zunime',
  name: 'Zunime',
  rank: 125,
  disabled: true, // Disabled due to API authentication issues
  flags: [],
  scrapeMovie: comboScraper,
  scrapeShow: comboScraper,
});
