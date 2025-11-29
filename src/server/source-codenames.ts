export const SOURCE_CODENAMES: Record<string, string> = {
  Iron: 'cloudnestra',
  Alpha: 'lookmovie',
  Shadow: 'vidsrc',
  Phantom: 'vidsrcpro',
  Titan: 'vidsrc-cloudnestra',
  Echo: 'vidplay',
  Delta: 'filemoon',
  Omega: 'smashystream',
  Nebula: 'remotestream',
  Vortex: 'showbox',
  Cipher: 'zoechip',
  Flux: 'fmovies',
  Zenith: 'solarmovie',
  Nova: 'flixhq',
  Pulsar: 'goku',
  Quasor: 'kisskh',
  Helix: 'entrepeliculas',
  Aegis: 'dieh',
  Storm: 'rgshows',
  Crystal: 'vidnest',
  Blaze: 'hdrezka',
};

export const PROVIDER_TO_CODENAME: Record<string, string> = Object.entries(SOURCE_CODENAMES).reduce(
  (acc, [codename, realId]) => {
    acc[realId] = codename;
    return acc;
  },
  {} as Record<string, string>,
);

export function resolveSourceId(input: string | undefined, sources: any[]): string | null {
  if (!input) {
    // Auto-select: return highest ranked source
    return sources[0]?.id || null;
  }

  // Normalize input to handle case-insensitive lookups
  const normalizedInput = input.trim();

  // Check if it's a codename (case-insensitive)
  const codenameKey = Object.keys(SOURCE_CODENAMES).find((key) => key.toLowerCase() === normalizedInput.toLowerCase());

  if (codenameKey) {
    return SOURCE_CODENAMES[codenameKey];
  }

  // Check if it's a real ID (backward compatibility)
  if (sources.find((s: any) => s.id === normalizedInput)) {
    return normalizedInput;
  }

  return null;
}

export function anonymizeSourceId(realId: string): string {
  return PROVIDER_TO_CODENAME[realId] || 'unknown';
}
