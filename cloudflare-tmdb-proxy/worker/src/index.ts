export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    
    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, HEAD, POST, OPTIONS',
      'Access-Control-Allow-Headers': '*',
      'Access-Control-Max-Age': '86400',
    };

    // Handle OPTIONS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: corsHeaders,
      });
    }

    try {
      // Extract path from worker URL
      // Format: /worker.dev/movie/550 -> /movie/550
      const tmdbPath = url.pathname.substring(1); // Remove leading /
      
      if (!tmdbPath) {
        return new Response('Missing TMDB path', { 
          status: 400,
          headers: corsHeaders,
        });
      }

      // Build TMDB API URL
      const tmdbUrl = `https://api.themoviedb.org/3/${tmdbPath}${url.search}`;
      
      // Forward request to TMDB
      const tmdbResponse = await fetch(tmdbUrl, {
        method: request.method,
        headers: {
          'Authorization': request.headers.get('Authorization') || '',
          'Content-Type': 'application/json',
        },
      });

      // Get response body
      const body = await tmdbResponse.text();
      
      // Return TMDB response with CORS headers
      return new Response(body, {
        status: tmdbResponse.status,
        headers: {
          ...corsHeaders,
          'Content-Type': tmdbResponse.headers.get('Content-Type') || 'application/json',
        },
      });
    } catch (error: any) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      });
    }
  },
};
