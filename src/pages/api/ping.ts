import type { APIRoute } from 'astro';

export const prerender = false;

// Minimal endpoint for ping/jitter measurement — returns as fast as possible.
export const HEAD: APIRoute = () =>
  new Response(null, {
    status: 204,
    headers: { 'Cache-Control': 'no-store' },
  });

export const GET: APIRoute = () =>
  new Response(null, {
    status: 204,
    headers: { 'Cache-Control': 'no-store' },
  });
