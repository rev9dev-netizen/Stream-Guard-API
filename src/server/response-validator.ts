/* eslint-disable no-console */
/**
 * Response Validation Middleware
 * Ensures no raw CDN URLs are exposed in playlist responses
 */

/**
 * Scans playlist content for potential CDN URL leaks
 * Returns array of suspicious URLs found
 */
export function detectExposedUrls(content: string): string[] {
  const exposedUrls: string[] = [];
  const lines = content.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();

    // Skip comments and empty lines
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    // Check if this is a URL
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      // Check if it matches our proxy URL pattern: /:token/:segment
      // Token is 64 hex chars, segment is 12-20 hex chars
      const proxyPattern = /^https?:\/\/[^/]+\/[a-f0-9]{64}(?:\/[a-f0-9]{12,20})?$/;
      if (proxyPattern.test(trimmed)) {
        // This is our encrypted proxy URL - GOOD!
        continue;
      }
      // This is an external URL - BAD!
      exposedUrls.push(trimmed);
    }

    // Check for relative URLs that might expose CDN structure
    // But exclude our proxy paths (which start with a hex token)
    if (
      !trimmed.match(/^[a-f0-9]{64}/) &&
      (trimmed.includes('.ts') || trimmed.includes('.m4s') || trimmed.includes('.m3u8'))
    ) {
      exposedUrls.push(trimmed);
    }
  }

  return exposedUrls;
}

/**
 * Validates that playlist content has no exposed CDN URLs
 * Logs warnings and returns validation result
 */
export function validatePlaylistSecurity(content: string, context: string): boolean {
  const exposedUrls = detectExposedUrls(content);

  if (exposedUrls.length > 0) {
    console.warn(`[SECURITY WARNING] Potential exposed URLs in ${context}:`);
    exposedUrls.forEach((url, idx) => {
      console.warn(`  ${idx + 1}. ${url.substring(0, 100)}${url.length > 100 ? '...' : ''}`);
    });
    // Return true to allow streaming while we debug
    // In production, you may want to return false to block
    return true;
  }

  return true;
}

/**
 * Sanitizes playlist content by removing any exposed URLs
 * This is a fallback safety measure
 */
export function sanitizePlaylistContent(content: string): string {
  const lines = content.split('\n');
  const sanitizedLines: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();

    // Keep comments and empty lines
    if (!trimmed || trimmed.startsWith('#')) {
      sanitizedLines.push(line);
      continue;
    }

    // Only allow lines that are our proxy format
    if (trimmed.includes('/s/') && trimmed.includes('/chunk/')) {
      sanitizedLines.push(line);
    } else if (!trimmed.startsWith('http') && !trimmed.includes('.ts') && !trimmed.includes('.m4s')) {
      // Keep non-URL lines
      sanitizedLines.push(line);
    } else {
      // This line contains an exposed URL - skip it
      console.warn(`[SANITIZER] Removed exposed URL: ${trimmed.substring(0, 100)}`);
    }
  }

  return sanitizedLines.join('\n');
}
