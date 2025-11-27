/**
 * URL Encoding for Cloudflare Worker
 * Simple base64 encoding for API URLs
 */

/**
 * Encode URL using URL-safe base64
 */
export function encryptUrl(url: string): string {
  // Convert to base64
  const base64 = Buffer.from(url, 'utf-8').toString('base64');

  // Make URL-safe
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

/**
 * Decode URL (for testing/verification)
 */
export function decryptUrl(encodedBase64: string): string {
  // Restore standard base64
  let base64 = encodedBase64.replace(/-/g, '+').replace(/_/g, '/');

  // Add padding
  while (base64.length % 4) {
    base64 += '=';
  }

  return Buffer.from(base64, 'base64').toString('utf-8');
}
