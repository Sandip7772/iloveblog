export interface PostMeta {
  title: string
  slug: string
  date: string // YYYY-MM-DD
  tag: string
  excerpt: string
  readTime: number
}

export interface BlogProfile {
  siteName: string
  siteUrl: string // no trailing slash
  author: string
  authorUrl: string
  ogImage: string
  /** HTML template with {{placeholders}} */
  template: string
  /** CSS inlined into the preview iframe */
  css: string
}

export interface PostEntry {
  title: string
  url: string
  date: string
  tag?: string
  excerpt?: string
}
