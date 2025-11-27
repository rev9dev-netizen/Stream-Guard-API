/**
 * Playlist Encryption Utility
 * Uses XOR cipher to encrypt/decrypt HLS playlists
 * Makes playlists appear as garbage in DevTools while allowing client-side decryption
 */

import crypto from 'crypto';

/**
 * Generate encryption key based on a shared secret
 * In production, this could be rotated or made more complex
 */
function generateKey(secret: string): Buffer {
  return crypto.createHash('sha256').update(secret).digest();
}

/**
 * XOR encryption/decryption
 * Same function works for both encrypt and decrypt
 */
export function xorCipher(data: Buffer, key: Buffer): Buffer {
  const result = Buffer.alloc(data.length);
  for (let i = 0; i < data.length; i++) {
    result[i] = data[i] ^ key[i % key.length];
  }
  return result;
}

/**
 * Encrypt playlist content
 */
export function encryptPlaylist(content: string, secret: string = 'stream-guard-2024'): Buffer {
  const key = generateKey(secret);
  const data = Buffer.from(content, 'utf-8');
  return xorCipher(data, key);
}

/**
 * Decrypt playlist content
 */
export function decryptPlaylist(encrypted: Buffer, secret: string = 'stream-guard-2024'): string {
  const key = generateKey(secret);
  const decrypted = xorCipher(encrypted, key);
  return decrypted.toString('utf-8');
}

/**
 * Client-side decryption function (for frontend use)
 * Copy this to your frontend application
 */
export const CLIENT_DECRYPT_CODE = `
// Playlist decryption for client-side use
async function decryptPlaylist(encryptedArrayBuffer) {
  // Generate key from shared secret
  const secret = 'stream-guard-2024';
  const encoder = new TextEncoder();
  const secretBytes = encoder.encode(secret);
  
  // Create SHA-256 hash of secret
  const hashBuffer = await crypto.subtle.digest('SHA-256', secretBytes);
  const key = new Uint8Array(hashBuffer);
  
  // XOR decrypt
  const encrypted = new Uint8Array(encryptedArrayBuffer);
  const decrypted = new Uint8Array(encrypted.length);
  
  for (let i = 0; i < encrypted.length; i++) {
    decrypted[i] = encrypted[i] ^ key[i % key.length];
  }
  
  // Convert to string
  const decoder = new TextDecoder();
  return decoder.decode(decrypted);
}

// Usage example with video player
async function loadEncryptedPlaylist(playlistUrl, player) {
  // Fetch encrypted playlist
  const response = await fetch(playlistUrl);
  const encrypted = await response.arrayBuffer();
  
  // Decrypt
  const decryptedText = await decryptPlaylist(encrypted);
  
  // Create blob URL
  const blob = new Blob([decryptedText], { type: 'application/vnd.apple.mpegurl' });
  const blobUrl = URL.createObjectURL(blob);
  
  // Load into player
  if (player.loadSource) {
    // hls.js
    player.loadSource(blobUrl);
  } else if (player.src) {
    // video.js or native
    player.src({ src: blobUrl, type: 'application/x-mpegURL' });
  }
  
  return blobUrl;
}
`;
