import { useMemo, useRef, useState } from 'react'
import { ACCEPTED, clean, parseDocument } from './lib/parse'
import { buildZip, download, parsePostsJson } from './lib/export'
import { renderPreview } from './lib/render'
import type { BlogProfile, PostEntry, PostMeta } from './lib/types'
import { readTimeMinutes, slugify, today } from './lib/util'
import { sandipProfile } from './presets/sandip'

type Device = 'desktop' | 'tablet' | 'mobile'
const DEVICE_WIDTH: Record<Device, string> = { desktop: '100%', tablet: '768px', mobile: '390px' }

export default function App() {
  const [profile, setProfile] = useState<BlogProfile>(sandipProfile)
  const [content, setContent] = useState<string | null>(null)
  const [meta, setMeta] = useState<PostMeta>({
    title: '',
    slug: '',
    date: today(),
    tag: '',
    excerpt: '',
    readTime: 1,
  })
  const [slugTouched, setSlugTouched] = useState(false)
  const [existing, setExisting] = useState<PostEntry[]>([])
  const [warnings, setWarnings] = useState<string[]>([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [device, setDevice] = useState<Device>('desktop')
  const [showSettings, setShowSettings] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)

  const safeContent = useMemo(() => (content ? clean(content) : ''), [content])
  const previewDoc = useMemo(
    () => (content ? renderPreview(profile, meta, safeContent) : ''),
    [profile, meta, safeContent, content],
  )

  async function handleFile(file: File | undefined) {
    if (!file) return
    setError('')
    setBusy(true)
    try {
      const doc = await parseDocument(file)
      const text = doc.html
      setContent(text)
      setWarnings(doc.warnings)
      setSlugTouched(false)
      setMeta((m) => ({
        ...m,
        title: doc.title,
        slug: slugify(doc.title),
        excerpt: autoExcerpt(text),
        readTime: readTimeMinutes(text),
      }))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not read that file.')
    } finally {
      setBusy(false)
    }
  }

  function update<K extends keyof PostMeta>(key: K, value: PostMeta[K]) {
    setMeta((m) => {
      const next = { ...m, [key]: value }
      if (key === 'title' && !slugTouched) next.slug = slugify(String(value))
      return next
    })
  }

  function editContent(html: string) {
    setContent(html)
    setMeta((m) => ({ ...m, readTime: readTimeMinutes(html) }))
  }

  async function loadPostsJson(file: File | undefined) {
    if (!file) return
    try {
      setExisting(parsePostsJson(await file.text()))
      setError('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Invalid posts.json')
    }
  }

  async function exportZip() {
    if (!meta.title.trim() || !meta.slug.trim()) {
      setError('A title and a slug are required before exporting.')
      return
    }
    setError('')
    download(await buildZip(profile, meta, safeContent, existing), `${meta.slug}.zip`)
  }

  function reset() {
    setContent(null)
    setWarnings([])
    setError('')
  }

  return (
    <>
      <header className="topbar">
        <div className="brand">
          <span className="logo">i</span>
          <span>
            <b>iLove</b>Blog
          </span>
        </div>
        <button className="link" onClick={() => setShowSettings((s) => !s)}>
          Blog settings
        </button>
      </header>

      {showSettings && <Settings profile={profile} onChange={setProfile} />}

      {content === null ? (
        <main className="landing">
          <h1>Turn documents into blog posts</h1>
          <p className="lead">
            Upload a DOCX, PDF or Markdown file. Get a ready-to-publish post, <code>posts.json</code> and sitemap.
            Everything runs in your browser; your files are never uploaded.
          </p>

          <div
            className={`drop ${dragging ? 'over' : ''}`}
            onDragOver={(e) => {
              e.preventDefault()
              setDragging(true)
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault()
              setDragging(false)
              handleFile(e.dataTransfer.files[0])
            }}
          >
            <button className="primary big" onClick={() => fileInput.current?.click()} disabled={busy}>
              {busy ? 'Reading…' : 'Select document'}
            </button>
            <span>or drop a file here</span>
            <small>DOCX · PDF · MD · TXT</small>
            <input
              ref={fileInput}
              type="file"
              accept={ACCEPTED}
              hidden
              onChange={(e) => {
                handleFile(e.target.files?.[0])
                e.target.value = ''
              }}
            />
          </div>
          {error && <p className="error">{error}</p>}
        </main>
      ) : (
        <main className="workspace">
          <section className="editor">
            <div className="row between">
              <h2>Post details</h2>
              <button className="link" onClick={reset}>
                ← Start over
              </button>
            </div>

            {warnings.map((w) => (
              <p className="warn" key={w}>
                {w}
              </p>
            ))}
            {error && <p className="error">{error}</p>}

            <label>
              Title
              <input value={meta.title} onChange={(e) => update('title', e.target.value)} />
            </label>
            <label>
              Slug
              <input
                value={meta.slug}
                onChange={(e) => {
                  setSlugTouched(true)
                  update('slug', slugify(e.target.value))
                }}
              />
              <small>
                {profile.siteUrl}/posts/{meta.slug || '…'}.html
              </small>
            </label>
            <div className="row">
              <label>
                Date
                <input type="date" value={meta.date} onChange={(e) => update('date', e.target.value)} />
              </label>
              <label>
                Tag
                <input value={meta.tag} onChange={(e) => update('tag', e.target.value)} placeholder="e.g. KQL" />
              </label>
              <label className="narrow">
                Read time (min)
                <input
                  type="number"
                  min={1}
                  value={meta.readTime}
                  onChange={(e) => update('readTime', Math.max(1, Number(e.target.value) || 1))}
                />
              </label>
            </div>
            <label>
              Excerpt <small>(also the meta description)</small>
              <textarea rows={3} value={meta.excerpt} onChange={(e) => update('excerpt', e.target.value)} />
            </label>
            <label>
              Content <small>(HTML, sanitized on export)</small>
              <textarea className="code" rows={14} value={content} onChange={(e) => editContent(e.target.value)} />
            </label>

            <label>
              Existing <code>posts.json</code> <small>(optional, so the new post is added to your list)</small>
              <input type="file" accept=".json,application/json" onChange={(e) => loadPostsJson(e.target.files?.[0])} />
              {existing.length > 0 && <small>{existing.length} existing posts loaded</small>}
            </label>

            <button className="primary big" onClick={exportZip}>
              Download blog package (.zip)
            </button>
            <small>
              Contains <code>posts/{meta.slug || 'your-post'}.html</code>, <code>posts.json</code> and{' '}
              <code>sitemap.xml</code>. Copy them into your blog repo and push.
            </small>
          </section>

          <section className="preview">
            <div className="row between">
              <h2>Live preview</h2>
              <div className="seg">
                {(['desktop', 'tablet', 'mobile'] as Device[]).map((d) => (
                  <button key={d} className={device === d ? 'on' : ''} onClick={() => setDevice(d)}>
                    {d}
                  </button>
                ))}
              </div>
            </div>
            <div className="frame-wrap">
              <iframe
                title="Post preview"
                sandbox=""
                srcDoc={previewDoc}
                style={{ width: DEVICE_WIDTH[device] }}
              />
            </div>
          </section>
        </main>
      )}
    </>
  )
}

function autoExcerpt(html: string): string {
  const text = new DOMParser().parseFromString(html, 'text/html').body.textContent ?? ''
  const flat = text.replace(/\s+/g, ' ').trim()
  if (flat.length <= 160) return flat
  return flat.slice(0, 157).replace(/\s+\S*$/, '') + '…'
}

function Settings({ profile, onChange }: { profile: BlogProfile; onChange: (p: BlogProfile) => void }) {
  const set = (key: keyof BlogProfile) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    onChange({ ...profile, [key]: e.target.value })
  return (
    <section className="settings">
      <h2>Blog settings</h2>
      <p className="muted">
        These fill your template. The default is the preset for blog.khadkasandip.com.np; change them to match your own
        blog.
      </p>
      <div className="grid">
        <label>
          Blog name
          <input value={profile.siteName} onChange={set('siteName')} />
        </label>
        <label>
          Blog URL
          <input value={profile.siteUrl} onChange={set('siteUrl')} />
        </label>
        <label>
          Author
          <input value={profile.author} onChange={set('author')} />
        </label>
        <label>
          Author / portfolio URL
          <input value={profile.authorUrl} onChange={set('authorUrl')} />
        </label>
        <label>
          Social image URL
          <input value={profile.ogImage} onChange={set('ogImage')} />
        </label>
      </div>
      <label>
        Post template <small>(HTML with {'{{title}}'}, {'{{content}}'}, {'{{date}}'}, {'{{tag}}'}, {'{{readTime}}'}, …)</small>
        <textarea className="code" rows={8} value={profile.template} onChange={set('template')} />
      </label>
      <label>
        Blog CSS <small>(used for the preview only)</small>
        <textarea className="code" rows={5} value={profile.css} onChange={set('css')} />
      </label>
    </section>
  )
}
