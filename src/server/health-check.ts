/* eslint-disable no-console */
import { runActualScraping } from '../dev-cli/scraper.js';
import { processOptions } from '../dev-cli/validate.js';
import { getBuiltinEmbeds, getBuiltinExternalSources, getBuiltinSources } from '../index.js';
import { saveProviderHealth } from './redis.js';

const CHECK_INTERVAL = 30 * 60 * 1000; // 30 minutes
const TEST_MEDIA = {
  tmdbId: '19995', // Avatar
  type: 'movie',
  title: 'Avatar',
  year: '2009',
};

// Cache sources list
let allSources: any[] = [];

async function checkProvider(sourceId: string) {
  const startTime = Date.now();
  try {
    // Prepare options for scraper (same format as /cdn endpoint)
    const options = {
      fetcher: 'native',
      sourceId,
      tmdbId: TEST_MEDIA.tmdbId,
      type: TEST_MEDIA.type,
      season: '0',
      episode: '0',
      url: '',
    };

    // Process options to get proper structure
    const {
      providerOptions,
      source: validatedSource,
      options: validatedOps,
    } = await processOptions(allSources, options);

    const result = await runActualScraping(providerOptions, validatedSource, validatedOps);

    const success = !!result?.stream?.length;
    const latency = Date.now() - startTime;

    await saveProviderHealth(sourceId, {
      status: success ? 'operational' : 'offline',
      latency,
      lastChecked: Date.now(),
      error: success ? null : 'No streams found',
    });

    console.log(`[HEALTH] ${sourceId}: ${success ? 'OK' : 'FAIL'} (${latency}ms)`);
  } catch (error: any) {
    const latency = Date.now() - startTime;
    await saveProviderHealth(sourceId, {
      status: 'offline',
      latency,
      lastChecked: Date.now(),
      error: error.message,
    });
    console.error(`[HEALTH] ${sourceId}: ERROR (${latency}ms) - ${error.message}`);
  }
}

export function startHealthCheckLoop() {
  console.log('[HEALTH] Starting health check loop...');

  // Cache sources list once
  const sourceScrapers = [...getBuiltinSources(), ...getBuiltinExternalSources()].sort((a, b) => b.rank - a.rank);
  const embedScrapers = getBuiltinEmbeds().sort((a, b) => b.rank - a.rank);
  allSources = [...sourceScrapers, ...embedScrapers];

  const runChecks = async () => {
    const sources = getBuiltinSources();
    console.log(`[HEALTH] Checking ${sources.length} providers...`);

    for (const source of sources) {
      await checkProvider(source.id);
      // Wait 5 seconds between checks to avoid CPU spikes
      await new Promise((resolve) => {
        setTimeout(resolve, 5000);
      });
    }
    console.log('[HEALTH] All checks completed.');
  };

  // Run immediately on start
  runChecks();

  // Schedule loop
  setInterval(runChecks, CHECK_INTERVAL);
}
