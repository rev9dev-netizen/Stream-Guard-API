import { SourcererOutput, makeSourcerer } from '@/providers/base';
import { MovieScrapeContext, ShowScrapeContext } from '@/utils/context';
import { NotFoundError } from '@/utils/errors';

async function comboScraper(ctx: ShowScrapeContext | MovieScrapeContext): Promise<SourcererOutput> {
  // First, search animetsu for the content using title
  const searchQuery = ctx.media.title;
  try {
    // Search animetsu's own database
    const searchRes = await ctx.proxiedFetcher('/api/search', {
      baseUrl: 'https://backend.animetsu.to',
      headers: {
        referer: 'https://animetsu.cc/',
        origin: 'https://animetsu.cc',
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      },
      query: {
        q: searchQuery,
        limit: '10',
      },
    });

    // eslint-disable-next-line no-console
    console.log('Animetsu Search Response:', JSON.stringify(searchRes, null, 2));

    // Find the best match from search results
    const results = searchRes?.results || searchRes?.data || [];
    if (!results || results.length === 0) {
      throw new NotFoundError('No results found in animetsu search');
    }

    // Get the first result (you could improve matching logic here)
    const firstResult = results[0];
    const animetsuId = firstResult?.id || firstResult?.animetsu_id;
    if (!animetsuId) {
      throw new NotFoundError('No animetsu ID found in search results');
    }

    const query: any = {
      type: ctx.media.type,
      title: ctx.media.title,
      animetsuId, // Use animetsu's internal ID instead of anilist
      ...(ctx.media.type === 'show' && {
        season: ctx.media.season.number,
        episode: ctx.media.episode.number,
      }),
      ...(ctx.media.type === 'movie' && { episode: 1 }),
      releaseYear: ctx.media.releaseYear,
    };

    return {
      embeds: [
        {
          embedId: 'animetsu-pahe',
          url: JSON.stringify(query),
        },
        {
          embedId: 'animetsu-zoro',
          url: JSON.stringify(query),
        },
        {
          embedId: 'animetsu-zaza',
          url: JSON.stringify(query),
        },
        {
          embedId: 'animetsu-meg',
          url: JSON.stringify(query),
        },
        {
          embedId: 'animetsu-bato',
          url: JSON.stringify(query),
        },
      ],
    };
  } catch (error) {
    throw new NotFoundError(`Animetsu search failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export const animetsuScraper = makeSourcerer({
  id: 'animetsu',
  name: 'Animetsu',
  rank: 112,
  disabled: true,
  flags: [],
  scrapeShow: comboScraper,
});
