/* eslint-disable no-console */
import { runActualScraping } from '../dev-cli/scraper.js';
import { processOptions } from '../dev-cli/validate.js';
import { getBuiltinEmbeds, getBuiltinExternalSources, getBuiltinSources } from '../index.js';
import { saveProviderHealth } from './redis.js';

// Configuration
const CHECK_INTERVAL = 30 * 60 * 1000; // 30 minutes
const PROVIDER_TIMEOUT = 15000; // 15 seconds per provider
const DELAY_BETWEEN_CHECKS = 3000; // 3 seconds between providers
const MAX_RETRIES = 2; // Retry failed checks

const TEST_MEDIA = {
  tmdbId: '550', // Fight Club - reliable test movie
  type: 'movie',
  title: 'Fight Club',
  year: '1999',
};

// Cache sources list
let allSources: any[] = [];

/**
 * Check a single provider with timeout and retry logic
 */
async function checkProviderWithTimeout(sourceId: string, retryCount = 0): Promise<void> {
  const startTime = Date.now();

  try {
    // Create timeout promise
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Timeout')), PROVIDER_TIMEOUT);
    });

    // Create scraping promise
    const scrapingPromise = (async () => {
      const options = {
        fetcher: 'native',
        sourceId,
        tmdbId: TEST_MEDIA.tmdbId,
        type: TEST_MEDIA.type,
        season: '0',
        episode: '0',
        url: '',
      };

      const {
        providerOptions,
        source: validatedSource,
        options: validatedOps,
      } = await processOptions(allSources, options);

      return (await runActualScraping(providerOptions, validatedSource, validatedOps)) as any;
    })();

    // Race between timeout and scraping
    const result = await Promise.race([scrapingPromise, timeoutPromise]);

    const success = !!result?.stream?.length;
    const latency = Date.now() - startTime;

    if (success) {
      await saveProviderHealth(sourceId, {
        status: 'operational',
        latency,
        lastChecked: Date.now(),
        error: null,
        successRate: 100,
      });

      console.log(`[HEALTH] ✅ ${sourceId}: OK (${latency}ms, ${result.stream.length} streams)`);
    } else {
      // No streams found - might be content issue, not provider issue
      await saveProviderHealth(sourceId, {
        status: 'degraded',
        latency,
        lastChecked: Date.now(),
        error: 'No streams found for test content',
        successRate: 50,
      });

      console.log(`[HEALTH] ⚠️  ${sourceId}: DEGRADED (${latency}ms) - No streams`);
    }
  } catch (error: any) {
    const latency = Date.now() - startTime;
    const isTimeout = error.message === 'Timeout';

    // Retry logic for timeouts and network errors
    if (retryCount < MAX_RETRIES && (isTimeout || error.message.includes('fetch failed'))) {
      console.log(`[HEALTH] 🔄 ${sourceId}: Retry ${retryCount + 1}/${MAX_RETRIES}...`);
      await new Promise<void>((resolve) => {
        setTimeout(resolve, 2000);
      }); // Wait 2s before retry
      return checkProviderWithTimeout(sourceId, retryCount + 1);
    }

    // Save failure after retries exhausted
    await saveProviderHealth(sourceId, {
      status: 'offline',
      latency,
      lastChecked: Date.now(),
      error: isTimeout ? 'Request timeout' : error.message,
      successRate: 0,
    });

    const emoji = isTimeout ? '⏱️' : '❌';
    console.error(`[HEALTH] ${emoji} ${sourceId}: OFFLINE (${latency}ms) - ${error.message}`);
  }
}

/**
 * Run health checks for all providers
 */
async function runHealthChecks(): Promise<void> {
  const sources = getBuiltinSources();
  const startTime = Date.now();

  console.log(`\n[HEALTH] 🔍 Starting health check for ${sources.length} providers...`);

  let operational = 0;
  let degraded = 0;
  let offline = 0;

  for (const source of sources) {
    try {
      await checkProviderWithTimeout(source.id);

      // Get status to count
      const status = await import('./redis.js').then((m) => m.getProviderHealth(source.id));
      if (status?.status === 'operational') operational++;
      else if (status?.status === 'degraded') degraded++;
      else offline++;
    } catch (error) {
      offline++;
      console.error(`[HEALTH] ❌ ${source.id}: Unexpected error -`, error);
    }

    // Delay between checks to avoid overwhelming the system
    if (sources.indexOf(source) < sources.length - 1) {
      await new Promise<void>((resolve) => {
        setTimeout(resolve, DELAY_BETWEEN_CHECKS);
      });
    }
  }

  const totalTime = Date.now() - startTime;
  const minutes = Math.floor(totalTime / 60000);
  const seconds = Math.floor((totalTime % 60000) / 1000);

  console.log(`\n[HEALTH] ✅ Check completed in ${minutes}m ${seconds}s`);
  console.log(`[HEALTH] 📊 Status: ${operational} operational, ${degraded} degraded, ${offline} offline\n`);
}

/**
 * Start the health check loop
 */
export function startHealthCheckLoop(): void {
  console.log('[HEALTH] 🚀 Initializing health check system...');

  // Cache sources list once
  const sourceScrapers = [...getBuiltinSources(), ...getBuiltinExternalSources()].sort((a, b) => b.rank - a.rank);
  const embedScrapers = getBuiltinEmbeds().sort((a, b) => b.rank - a.rank);
  allSources = [...sourceScrapers, ...embedScrapers];

  console.log(`[HEALTH] 📋 Monitoring ${getBuiltinSources().length} providers`);
  console.log(`[HEALTH] ⏰ Check interval: ${CHECK_INTERVAL / 60000} minutes`);
  console.log(`[HEALTH] ⏱️  Timeout per provider: ${PROVIDER_TIMEOUT / 1000}s`);
  console.log(`[HEALTH] 🔄 Max retries: ${MAX_RETRIES}\n`);

  // Run first check after 10 seconds (give server time to initialize)
  setTimeout(() => {
    runHealthChecks().catch((error) => {
      console.error('[HEALTH] ❌ Health check failed:', error);
    });
  }, 10000);

  // Schedule periodic checks
  setInterval(() => {
    runHealthChecks().catch((error) => {
      console.error('[HEALTH] ❌ Health check failed:', error);
    });
  }, CHECK_INTERVAL);
}
