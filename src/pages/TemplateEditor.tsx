import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { toast } from 'sonner'
import { ArrowLeft, Save, Eye, ChevronDown } from 'lucide-react'

const MERGE_TAGS = [
  { tag: '{{first_name}}', label: 'First name' },
  { tag: '{{last_name}}', label: 'Last name' },
  { tag: '{{email}}', label: 'Email' },
  { tag: '{{unsubscribe_url}}', label: 'Unsubscribe URL' },
]

export default function TemplateEditor() {
  const { id } = useParams<{ id: string }>()
  const nav = useNavigate()
  const containerRef = useRef<HTMLDivElement>(null)
  const editorRef = useRef<any>(null)
  const [name, setName] = useState('')
  const [subject, setSubject] = useState('')
  const [loaded, setLoaded] = useState(false)
  const [preview, setPreview] = useState(false)
  const [previewHtml, setPreviewHtml] = useState('')
  const [showTags, setShowTags] = useState(false)

  useEffect(() => {
    let mounted = true
    ;(async () => {
      const { data, error } = await supabase.from('templates').select('*').eq('id', id!).single()
      if (error || !data) { toast.error('Template not found'); nav('/templates'); return }
      if (!mounted) return
      setName(data.name)
      setSubject(data.subject || '')

      const grapesjs = (await import('grapesjs')).default
      const newsletterPreset = (await import('grapesjs-preset-newsletter')).default
      await import('grapesjs/dist/css/grapes.min.css')

      if (!containerRef.current || !mounted) return

      const editor = grapesjs.init({
        container: containerRef.current,
        height: '100%',
        width: 'auto',
        storageManager: false,
        plugins: [newsletterPreset],
        pluginsOpts: { [newsletterPreset as any]: {} },
        components: data.html || '<p>Start designing...</p>',
      })
      editorRef.current = editor
      setLoaded(true)
    })()
    return () => {
      mounted = false
      editorRef.current?.destroy?.()
    }
  }, [id])

  const save = async () => {
    const editor = editorRef.current
    if (!editor) return
    const html = editor.runCommand('gjs-get-inlined-html') as string
    const design = editor.getProjectData()
    const { error } = await supabase.from('templates').update({ name, subject, html, design }).eq('id', id!)
    if (error) toast.error(error.message)
    else toast.success('Saved!')
  }

  const showPreview = () => {
    const editor = editorRef.current
    if (!editor) return
    let html = editor.runCommand('gjs-get-inlined-html') as string
    html = html.replace(/\{\{first_name\}\}/g, 'John').replace(/\{\{last_name\}\}/g, 'Doe').replace(/\{\{email\}\}/g, 'john@example.com').replace(/\{\{unsubscribe_url\}\}/g, '#')
    setPreviewHtml(html)
    setPreview(true)
  }

  const insertTag = (tag: string) => {
    const editor = editorRef.current
    if (!editor) return
    const sel = editor.getSelected()
    if (sel) sel.append(tag)
    else editor.addComponents(tag)
    setShowTags(false)
  }

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>
      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderBottom: '1px solid var(--border)', background: 'var(--surface)', flexShrink: 0, flexWrap: 'wrap' }}>
        <button className="btn-ghost" style={{ display: 'flex', alignItems: 'center', gap: 6 }} onClick={() => nav('/templates')}>
          <ArrowLeft size={16} /> Back
        </button>
        <input value={name} onChange={e => setName(e.target.value)} placeholder="Template name" style={{ width: 200 }} />
        <input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Subject line" style={{ width: 300 }} />
        <div style={{ position: 'relative' }}>
          <button className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: 6 }} onClick={() => setShowTags(!showTags)}>
            Merge tags <ChevronDown size={14} />
          </button>
          {showTags && (
            <div style={{ position: 'absolute', top: '100%', left: 0, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, zIndex: 100, minWidth: 200, marginTop: 4 }}>
              {MERGE_TAGS.map(m => (
                <button key={m.tag} onClick={() => insertTag(m.tag)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 12px', width: '100%', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text)', textAlign: 'left' }}>
                  <code style={{ fontSize: 11, color: 'var(--primary)', fontFamily: 'DM Mono, monospace' }}>{m.tag}</code>
                  <span style={{ fontSize: 13 }}>{m.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <button className="btn-secondary" onClick={showPreview} disabled={!loaded} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Eye size={14} /> Preview
          </button>
          <button className="btn-primary" onClick={save} disabled={!loaded} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Save size={14} /> Save
          </button>
        </div>
      </div>

      {/* Editor */}
      <div ref={containerRef} style={{ flex: 1, overflow: 'hidden' }} />

      {!loaded && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
          <div style={{ textAlign: 'center', color: 'var(--text2)' }}>
            <div className="spinner" style={{ margin: '0 auto 16px' }} />
            <div>Loading editor...</div>
          </div>
        </div>
      )}

      {/* Preview modal */}
      {preview && (
        <div className="modal-overlay" onClick={() => setPreview(false)}>
          <div className="modal" style={{ maxWidth: 700 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div className="modal-title" style={{ margin: 0 }}>Preview (with sample data)</div>
              <button className="btn-ghost" onClick={() => setPreview(false)}>✕</button>
            </div>
            <div style={{ border: '1px solid var(--border)', borderRadius: 8, height: 500, overflow: 'auto', background: 'white' }}>
              <iframe srcDoc={previewHtml} style={{ width: '100%', height: '100%', border: 'none' }} title="preview" />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
