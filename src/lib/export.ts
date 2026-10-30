import JSZip from 'jszip'
import { postUrl, renderPost } from './render'
import type { BlogProfile, PostEntry, PostMeta } from './types'

/** Add (or replace, by url) the new post and sort newest first. */
export function mergePosts(existing: PostEntry[], meta: PostMeta): PostEntry[] {
  const url = postUrl(meta.slug)
  const entry: PostEntry = { title: meta.title, url, date: meta.date, tag: meta.tag, excerpt: meta.excerpt }
  return [entry, ...existing.filter((p) => p.url !== url)].sort((a, b) => b.date.localeCompare(a.date))
}

export function buildSitemap(profile: BlogProfile, posts: PostEntry[]): string {
  const latest = posts[0]?.date ?? ''
  const urls = [
    `  <url>\n    <loc>${profile.siteUrl}/</loc>\n    <lastmod>${latest}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>1.0</priority>\n  </url>`,
    ...posts.map(
      (p) =>
        `  <url>\n    <loc>${profile.siteUrl}/${p.url}</loc>\n    <lastmod>${p.date}</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>0.8</priority>\n  </url>`,
    ),
  ]
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`
}

export function parsePostsJson(text: string): PostEntry[] {
  const data: unknown = JSON.parse(text)
  if (!Array.isArray(data)) throw new Error('posts.json must be a JSON array.')
  return data as PostEntry[]
}

export async function buildZip(
  profile: BlogProfile,
  meta: PostMeta,
  content: string,
  existing: PostEntry[],
): Promise<Blob> {
  const posts = mergePosts(existing, meta)
  const zip = new JSZip()
  zip.file(postUrl(meta.slug), renderPost(profile, meta, content))
  zip.file('posts.json', JSON.stringify(posts, null, 2) + '\n')
  zip.file('sitemap.xml', buildSitemap(profile, posts))
  return zip.generateAsync({ type: 'blob' })
}

export function download(blob: Blob, filename: string): void {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  a.click()
  URL.revokeObjectURL(a.href)
}
