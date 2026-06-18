import type { APIRoute } from 'astro';
import { getPublicConfig } from '../../lib/config';

export const prerender = false;

export const GET: APIRoute = () => {
  const config = getPublicConfig();

  return new Response(JSON.stringify(config), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=60, s-maxage=300',
    },
  });
};
