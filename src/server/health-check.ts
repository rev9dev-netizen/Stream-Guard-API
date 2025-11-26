/* eslint-disable no-console */
import { getBuiltinSources } from '../index.js';
import { runActualScraping } from '../dev-cli/scraper.js';
import { saveProviderHealth } from './redis.js';

const CHECK_INTERVAL = 30 * 60 * 1000; // 30 minutes
const TEST_MEDIA = {
  tmdbId: '19995', // Avatar
  type: 'movie',
  title: 'Avatar',
  year: '2009',
};

async function checkProvider(sourceId: string) {
  const startTime = Date.now();
  try {
    const result = await runActualScraping(
      {
        source: sourceId,
        fetcher: 'node',
        quiet: true,
      },
      {
        id: sourceId,
        name: sourceId,
        rank: 0,
        type: 'source',
        flags: [],
      },
      {
        tmdbId: TEST_MEDIA.tmdbId,
        type: TEST_MEDIA.type,
        fetcher: 'node',
        url: '',
      } as any,
    );

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
  
  const runChecks = async () => {
    const sources = getBuiltinSources();
    console.log(`[HEALTH] Checking ${sources.length} providers...`);
    
    for (const source of sources) {
      await checkProvider(source.id);
      // Wait 5 seconds between checks to avoid CPU spikes
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
    console.log('[HEALTH] All checks completed.');
  };

  // Run immediately on start
  runChecks();

  // Schedule loop
  setInterval(runChecks, CHECK_INTERVAL);
}
