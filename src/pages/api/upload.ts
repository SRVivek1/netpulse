import type { APIRoute } from 'astro';

export const prerender = false;

/** Stream-discard upload endpoint for speed tests — never buffers the full body. */
export const POST: APIRoute = async ({ request }) => {
  if (!request.body) {
    return new Response(null, { status: 400 });
  }

  const reader = request.body.getReader();
  try {
    while (true) {
      const { done } = await reader.read();
      if (done) break;
    }
  } catch {
    return new Response(null, { status: 500 });
  }

  return new Response(null, {
    status: 204,
    headers: { 'Cache-Control': 'no-store' },
  });
};
