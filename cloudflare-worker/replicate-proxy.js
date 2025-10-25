/**
 * Cloudflare Worker - Replicate API Proxy
 *
 * Purpose: Bypass Cloudflare blocking of Render.com IPs when accessing Replicate API
 *
 * Deployment:
 * 1. Create new Cloudflare Worker at https://dash.cloudflare.com/
 * 2. Copy this code to the worker
 * 3. Set environment variable: PROXY_SECRET_KEY
 * 4. Deploy and copy the worker URL
 * 5. Add to Render.com:
 *    - REPLICATE_PROXY_URL=https://your-worker.workers.dev
 *    - REPLICATE_PROXY_AUTH=<same-secret-key>
 */

addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})

async function handleRequest(request) {
  // CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Proxy-Auth, X-Requested-With',
        'Access-Control-Max-Age': '86400',
      }
    })
  }

  try {
    // 1. Verify authentication
    const authHeader = request.headers.get('X-Proxy-Auth')
    const expectedAuth = PROXY_SECRET_KEY // Set this in Cloudflare Worker environment

    if (!authHeader || authHeader !== expectedAuth) {
      return new Response(JSON.stringify({
        error: 'Unauthorized',
        message: 'Invalid or missing X-Proxy-Auth header'
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // 2. Extract target URL from query parameter
    const url = new URL(request.url)
    const targetUrl = url.searchParams.get('target')

    if (!targetUrl) {
      return new Response(JSON.stringify({
        error: 'Bad Request',
        message: 'Missing target URL parameter'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // 3. Validate target is Replicate API
    if (!targetUrl.startsWith('https://api.replicate.com/')) {
      return new Response(JSON.stringify({
        error: 'Forbidden',
        message: 'Target URL must be api.replicate.com'
      }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // 4. Forward request to Replicate API
    const proxyHeaders = new Headers(request.headers)
    proxyHeaders.delete('X-Proxy-Auth') // Remove proxy auth
    proxyHeaders.set('User-Agent', 'MultifulBot-CloudflareProxy/1.0')

    const proxyRequest = new Request(targetUrl, {
      method: request.method,
      headers: proxyHeaders,
      body: request.method !== 'GET' && request.method !== 'HEAD' ? request.body : null,
    })

    console.log(`Proxying ${request.method} ${targetUrl}`)

    const response = await fetch(proxyRequest)

    // 5. Return response with CORS headers
    const responseHeaders = new Headers(response.headers)
    responseHeaders.set('Access-Control-Allow-Origin', '*')
    responseHeaders.set('X-Proxy-Status', 'success')

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders
    })

  } catch (error) {
    console.error('Proxy error:', error)
    return new Response(JSON.stringify({
      error: 'Internal Server Error',
      message: error.message
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    })
  }
}
