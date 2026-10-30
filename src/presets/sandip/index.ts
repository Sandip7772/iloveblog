import type { BlogProfile } from '../../lib/types'
import template from './template.html?raw'
import css from './style.css?raw'

export const sandipProfile: BlogProfile = {
  siteName: 'Sandip Khadka Blog',
  siteUrl: 'https://blog.khadkasandip.com.np',
  author: 'Sandip Khadka',
  authorUrl: 'https://khadkasandip.com.np',
  ogImage: 'https://blog.khadkasandip.com.np/images/og-image.png',
  template,
  css,
}
