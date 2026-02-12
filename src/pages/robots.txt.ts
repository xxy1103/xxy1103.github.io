import { siteUrl } from '../config/site';

export const prerender = true;

function buildRobotsTxt() {
  const sitemapUrl = new URL('sitemap-index.xml', siteUrl).toString();

  return [
    'User-agent: *',
    'Allow: /',
    'Disallow: /search-index.json',
    '',
    `Sitemap: ${sitemapUrl}`,
    '',
  ].join('\n');
}

export function GET() {
  return new Response(buildRobotsTxt(), {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
    },
  });
}
