type ProviderStats = {
  status: 'operational' | 'degraded' | 'offline';
  responseTime: number; // in milliseconds
  uptime: number; // percentage
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  lastChecked: number; // timestamp
};

const stats: Record<string, ProviderStats> = {};

export function updateProviderStats(sourceId: string, success: boolean, responseTime: number) {
  if (!stats[sourceId]) {
    stats[sourceId] = {
      status: 'operational',
      responseTime: 0,
      uptime: 100,
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      lastChecked: Date.now(),
    };
  }

  const provider = stats[sourceId];
  provider.totalRequests++;
  provider.lastChecked = Date.now();

  if (success) {
    provider.successfulRequests++;
    // Update average response time
    provider.responseTime = Math.round(
      (provider.responseTime * (provider.successfulRequests - 1) + responseTime) / provider.successfulRequests,
    );
  } else {
    provider.failedRequests++;
  }

  // Calculate uptime percentage
  provider.uptime = Math.round((provider.successfulRequests / provider.totalRequests) * 100);

  // Determine status based on uptime
  if (provider.uptime >= 80) {
    provider.status = 'operational';
  } else if (provider.uptime >= 50) {
    provider.status = 'degraded';
  } else {
    provider.status = 'offline';
  }
}

export function getStats() {
  const result: Record<string, { status: string; responseTime: number; uptime: number }> = {};

  for (const [sourceId, data] of Object.entries(stats)) {
    result[sourceId] = {
      status: data.status,
      responseTime: data.responseTime,
      uptime: data.uptime,
    };
  }

  return result;
}
