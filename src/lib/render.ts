import type { BlogProfile, PostMeta } from './types'
import { escapeHtml, formatDate } from './util'

export function postUrl(slug: string): string {
  return `posts/${slug}.html`
}

function jsonLd(profile: BlogProfile, meta: PostMeta, canonical: string): string {
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: meta.title,
    description: meta.excerpt,
    datePublished: meta.date,
    dateModified: meta.date,
    author: { '@type': 'Person', name: profile.author, url: profile.authorUrl },
    image: profile.ogImage,
    mainEntityOfPage: { '@type': 'WebPage', '@id': canonical },
    publisher: { '@type': 'Person', name: profile.author },
  }).replace(/</g, '\\u003c')
}

/** Fill the profile's template with a post. `content` must already be sanitized HTML. */
export function renderPost(profile: BlogProfile, meta: PostMeta, content: string): string {
  const canonical = `${profile.siteUrl}/${postUrl(meta.slug)}`
  const values: Record<string, string> = {
    title: escapeHtml(meta.title),
    description: escapeHtml(meta.excerpt),
    date: meta.date,
    dateDisplay: formatDate(meta.date),
    year: meta.date.slice(0, 4),
    tag: escapeHtml(meta.tag),
    readTime: String(meta.readTime),
    canonical: escapeHtml(canonical),
    siteName: escapeHtml(profile.siteName),
    author: escapeHtml(profile.author),
    authorUrl: escapeHtml(profile.authorUrl),
    ogImage: escapeHtml(profile.ogImage),
    jsonld: jsonLd(profile, meta, canonical),
    content,
  }
  // Single pass so placeholder-like text inside the post body is never re-expanded.
  return profile.template.replace(/\{\{(\w+)\}\}/g, (m, key: string) => values[key] ?? m)
}

/**
 * Build the preview document: inline the blog's CSS and point relative assets at
 * files the preview can actually reach, since srcdoc has no base for ../style.css.
 */
export function renderPreview(profile: BlogProfile, meta: PostMeta, content: string): string {
  const logo = new URL(`${import.meta.env.BASE_URL}llogo.png`, window.location.href).href
  return renderPost(profile, meta, content)
    .replace(/<link[^>]+href="\.\.\/style\.css"[^>]*>/, `<style>${profile.css}</style>`)
    .replace(/(?:\.\.\/)?images\/llogo\.png/g, logo)
    .replace('<head>', '<head><base target="_blank">')
}
