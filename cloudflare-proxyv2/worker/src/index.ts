/**
 * Cloudflare Worker - Stream Guard Proxy
 * Decodes base64-encoded URLs and proxies requests to the API
 * 
 * LOCAL DEVELOPMENT MODE:
 * - Run with: wrangler dev --local --port 8787
 * - This allows the worker to access localhost:3000
 * - In production, this proxies to your deployed API
 */

// Simple base64 decode (URL-safe)
function decodeUrl(encodedBase64: string): string {
  try {
    // Convert URL-safe base64 to standard base64
    let base64 = encodedBase64
      .replace(/-/g, '+')
      .replace(/_/g, '/');
    
    // Add padding if needed
    while (base64.length % 4) {
      base64 += '=';
    }
    
    // Decode and return
    return atob(base64);
  } catch (error) {
    throw new Error(`Decoding failed: ${error}`);
  }
}

export default {
  async fetch(request: Request, env: any, ctx: any): Promise<Response> {
    const url = new URL(request.url);
    
    // CORS headers for all responses
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, HEAD, POST, OPTIONS',
      'Access-Control-Allow-Headers': '*',
      'Access-Control-Max-Age': '86400',
    };

    // Handle OPTIONS preflight requests
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: corsHeaders,
      });
    }

    // Health check
    if (url.pathname === '/' || url.pathname === '/health') {
      return new Response('Stream Guard Worker - OK (Local Dev Mode)', { 
        status: 200,
        headers: corsHeaders,
      });
    }

    try {
      // Extract encrypted path from URL
      // Format: /worker.dev/{encryptedPath}
      const encryptedPath = url.pathname.substring(1); // Remove leading /
      
      if (!encryptedPath) {
        return new Response('Missing encrypted path', { 
          status: 400,
          headers: corsHeaders,
        });
      }

      // Decode to get actual API URL
      const apiUrl = decodeUrl(encryptedPath);
      
      // Proxy request to API
      const apiResponse = await fetch(apiUrl, {
        method: request.method,
        headers: {
          'User-Agent': request.headers.get('User-Agent') || 'Stream-Guard-Worker/1.0',
          'X-Worker-Proxy': 'stream-guard',  // Identify worker requests
          'Referer': 'http://localhost:3000', // Add referer for domain validation
          'Origin': 'http://localhost:3000',  // Add origin for CORS
        },
      });

      // Get response body
      const body = await apiResponse.arrayBuffer();

      // Forward response with CORS headers
      const responseHeaders = new Headers(corsHeaders);
      responseHeaders.set('Content-Type', apiResponse.headers.get('Content-Type') || 'application/octet-stream');
      responseHeaders.set('Cache-Control', 'private, no-store, no-cache, must-revalidate');
      
      return new Response(body, {
        status: apiResponse.status,
        statusText: apiResponse.statusText,
        headers: responseHeaders,
      });
    } catch (error: any) {
      console.error('[WORKER ERROR]', error);
      return new Response(`Worker error: ${error.message}`, { 
        status: 500,
        headers: corsHeaders,
      });
    }
  },
};
