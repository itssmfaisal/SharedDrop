import { useState, useEffect, useRef, useCallback, DragEvent } from 'react';
import Head from 'next/head';
import dynamic from 'next/dynamic';

const ChatPanel = dynamic(() => import('../components/ChatPanel'), { ssr: false });

interface FileInfo {
  name: string;
  size: number;
  modified: string;
  ext: string;
  isDir: boolean;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) +
    ' ' + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

const IMAGE_EXTS = new Set(['jpg','jpeg','png','gif','webp','svg','bmp']);
const VIDEO_EXTS = new Set(['mp4','webm','ogg','mov','mkv']);
const AUDIO_EXTS = new Set(['mp3','wav','flac','ogg','aac','m4a']);

const CODE_EXTS = new Set(['js','jsx','ts','tsx','py','rb','java','go','rs','c','cpp','h','cs','php','sh','bash','ps1','css','html','json','xml','yaml','yml','swift','kt','kts','scala','lua','perl','pl','rs']);
const EXT_ICONS: Record<string, string> = {
  pdf:'📄',doc:'📝',docx:'📝',txt:'📃',md:'📃',
  jpg:'🖼️',jpeg:'🖼️',png:'🖼️',gif:'🖼️',webp:'🖼️',svg:'🖼️',
  mp4:'🎬',mov:'🎬',avi:'🎬',mkv:'🎬',webm:'🎬',
  mp3:'🎵',wav:'🎵',flac:'🎵',ogg:'🎵',
  zip:'🗜️',rar:'🗜️',gz:'🗜️',tar:'🗜️','7z':'🗜️',
  js:'💻',ts:'💻',py:'💻',json:'💻',html:'💻',css:'💻',
  jsx:'💻',tsx:'💻',go:'💻',rs:'💻',java:'💻',c:'💻',cpp:'💻',h:'💻',cs:'💻',php:'💻',rb:'💻',sh:'💻',bash:'💻',swift:'💻',kt:'💻',scala:'💻',lua:'💻',pl:'💻',xml:'💻',yaml:'💻',yml:'💻',
  xls:'📊',xlsx:'📊',csv:'📊',ppt:'📑',pptx:'📑',
};

function fileIcon(ext: string, isDir: boolean) {
  if (isDir) return '📁';
  return EXT_ICONS[ext.toLowerCase()] || '📎';
}

type SortKey = 'name'|'size'|'modified';

// ── PIN screen ──────────────────────────────────────────────────────────────
function PinScreen({ onUnlock }: { onUnlock: () => void }) {
  const [pin, setPin] = useState('');
  const [err, setErr] = useState('');
  const [checking, setChecking] = useState(false);

  const submit = async () => {
    setChecking(true); setErr('');
    const r = await fetch('/api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pin }) });
    setChecking(false);
    if (r.ok) { onUnlock(); }
    else { setErr('Wrong PIN. Try again.'); setPin(''); }
  };

  return (
    <div style={{ minHeight:'100vh', display:'grid', placeItems:'center', background:'var(--bg)' }}>
      <div style={{ background:'linear-gradient(145deg, rgba(28,46,88,0.6), rgba(12,20,40,0.5))', border:'1px solid var(--border)', borderRadius:20, padding:'40px 36px', width:340, textAlign:'center', boxShadow:'0 20px 60px rgba(2,6,20,0.5)', backdropFilter:'blur(14px)', WebkitBackdropFilter:'blur(14px)' }}>
        <div style={{ fontSize:'2.5rem', marginBottom:16 }}>🔐</div>
        <h2 style={{ fontWeight:800, marginBottom:6 }}>SharedDrop</h2>
        <p style={{ color:'var(--muted)', fontSize:'0.84rem', marginBottom:24 }}>Enter PIN to access shared files</p>
        <input
          type="password" value={pin} onChange={e => setPin(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && submit()}
          placeholder="Enter PIN…"
          style={{ width:'100%', padding:'12px 16px', background:'var(--surface2)', border:'1px solid var(--border)', borderRadius:10, color:'var(--text)', fontFamily:'JetBrains Mono, monospace', fontSize:'1.1rem', textAlign:'center', outline:'none', letterSpacing:4, marginBottom:12 }}
          autoFocus
        />
        {err && <p style={{ color:'var(--accent2)', fontSize:'0.82rem', marginBottom:12 }}>{err}</p>}
        <button onClick={submit} disabled={checking || !pin}
          style={{ width:'100%', background:'var(--accent)', color:'#fff', border:'none', borderRadius:10, padding:'12px', fontFamily:'Syne, sans-serif', fontWeight:700, fontSize:'0.95rem', cursor:'pointer', opacity: (!pin||checking)?0.5:1 }}>
          {checking ? 'Checking…' : 'Unlock →'}
        </button>
      </div>
    </div>
  );
}

// ── QR Modal ─────────────────────────────────────────────────────────────────
function QRModal({ url, onClose }: { url: string; onClose: () => void }) {
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(url)}&bgcolor=111118&color=e8e8f0&margin=10`;
  return (
    <div className="overlay" onClick={onClose}>
      <div className="dialog" onClick={e => e.stopPropagation()} style={{ textAlign:'center', maxWidth:320 }}>
        <h3 style={{ marginBottom:6 }}>📱 Scan to Connect</h3>
        <p style={{ marginBottom:20 }}>Scan this QR code from any device on your local network</p>
        <img src={qrUrl} alt="QR Code" style={{ borderRadius:12, width:220, height:220 }} />
        <div style={{ marginTop:16, padding:'10px 14px', background:'var(--surface2)', borderRadius:8, fontFamily:'JetBrains Mono, monospace', fontSize:'0.78rem', color:'var(--accent)', wordBreak:'break-all' }}>{url}</div>
        <div className="dialog-actions" style={{ marginTop:20, justifyContent:'center' }}>
          <button className="btn-cancel" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

// Video player with resume feature (top-level component)
function VideoWithResume({ src, fileKey }: { src: string; fileKey: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const saved = localStorage.getItem('videoTime:' + fileKey);
    if (saved) {
      const t = parseFloat(saved);
      if (!isNaN(t)) v.currentTime = t;
    }
  }, [fileKey]);

  const saveTime = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    localStorage.setItem('videoTime:' + fileKey, String(v.currentTime));
  }, [fileKey]);

  return (
    <video
      ref={videoRef}
      src={src}
      controls
      style={{ maxWidth: '80vw', maxHeight: '68vh', borderRadius: 8 }}
      onPause={saveTime}
      onTimeUpdate={saveTime}
    />
  );
}

// ── Preview Modal / Editor ───────────────────────────────────────────────────
function PreviewModal({ file, subfolder, onClose, onSaved }: { file: FileInfo; subfolder: string; onClose: () => void; onSaved?: () => void }) {
  const src = `/api/download?name=${encodeURIComponent(file.name)}${subfolder ? `&subfolder=${encodeURIComponent(subfolder)}` : ''}`;
  const ext = file.ext.toLowerCase();
  const isCodeFile = CODE_EXTS.has(ext);
  const isEditableText = ext === 'txt' || CODE_EXTS.has(ext);
  const [textContent, setTextContent] = useState<string | null>(null);
  const [initialText, setInitialText] = useState('');
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [copying, setCopying] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [highlightedLines, setHighlightedLines] = useState<string[] | null>(null);
  const lineRef = useRef<HTMLDivElement | null>(null);
  const codeLayerRef = useRef<HTMLPreElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (isEditableText) {
      fetch(src)
        .then(r => {
          if (!r.ok) throw new Error('Failed to load file');
          return r.text();
        })
        .then(t => {
          if (!cancelled) {
            setTextContent(t);
            setInitialText(t);
          }
        })
        .catch(() => {
          if (!cancelled) {
            setTextContent('');
            setInitialText('');
          }
        });
    } else {
      setTextContent(null);
      setInitialText('');
    }
    return () => { cancelled = true; };
  }, [src, isEditableText]);

  useEffect(() => {
    setEditMode(false);
  }, [file.name, subfolder]);

  useEffect(() => {
    if (!isEditableText || !isCodeFile || textContent === null) {
      setHighlightedLines(null);
      return;
    }

    try {
      const hljs = (window as any).hljs;
      if (!hljs) {
        setHighlightedLines(null);
        return;
      }

      const lang = hljs.getLanguage(ext) ? ext : undefined;
      const highlighted = lang
        ? hljs.highlight(textContent, { language: lang, ignoreIllegals: true }).value
        : hljs.highlightAuto(textContent).value;
      setHighlightedLines(highlighted.split(/\r?\n/));
    } catch {
      setHighlightedLines(null);
    }
  }, [isEditableText, isCodeFile, textContent, ext]);

  const lineCount = Math.max(1, (textContent || '').split(/\r?\n/).length);
  const hasChanges = isEditableText && textContent !== null && textContent !== initialText;

  const syncLineScroll = (scrollTop: number, scrollLeft = 0) => {
    if (lineRef.current) lineRef.current.scrollTop = scrollTop;
    if (codeLayerRef.current) {
      codeLayerRef.current.scrollTop = scrollTop;
      codeLayerRef.current.scrollLeft = scrollLeft;
    }
  };

  const saveFile = async () => {
    if (!isEditableText || textContent === null || !hasChanges) return;
    setSaving(true);
    setSaveMsg('');
    try {
      const r = await fetch('/api/update-file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: file.name,
          subfolder: subfolder || undefined,
          content: textContent,
        }),
      });
      if (!r.ok) throw new Error('Save failed');
      setInitialText(textContent);
      setSaveMsg('Saved');
      onSaved?.();
      setTimeout(() => setSaveMsg(''), 1500);
    } catch {
      setSaveMsg('Save failed');
      setTimeout(() => setSaveMsg(''), 1800);
    } finally {
      setSaving(false);
    }
  };

  const closeModal = () => {
    if (hasChanges) {
      const confirmClose = window.confirm('You have unsaved changes. Close without saving?');
      if (!confirmClose) return;
    }
    onClose();
  };

  const toggleEditMode = () => {
    if (!editMode) {
      setEditMode(true);
      return;
    }

    if (hasChanges) {
      const confirmExit = window.confirm('Discard unsaved changes and switch to read mode?');
      if (!confirmExit) return;
      setTextContent(initialText);
    }
    setEditMode(false);
  };

  const onEditorKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const el = e.currentTarget;
      const start = el.selectionStart;
      const end = el.selectionEnd;
      const current = textContent || '';
      const next = current.slice(0, start) + '  ' + current.slice(end);
      setTextContent(next);
      requestAnimationFrame(() => {
        el.selectionStart = el.selectionEnd = start + 2;
      });
      return;
    }

    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
      e.preventDefault();
      void saveFile();
    }
  };
  

  return (
    <div className="overlay" onClick={closeModal}>
      <div onClick={e => e.stopPropagation()} style={{ background:'linear-gradient(145deg, rgba(28,46,88,0.6), rgba(12,20,40,0.5))', border:'1px solid var(--border)', borderRadius:16, padding:24, maxWidth:'90vw', maxHeight:'90vh', display:'flex', flexDirection:'column', gap:16, boxShadow:'0 20px 60px rgba(2,6,20,0.5)', backdropFilter:'blur(14px)', WebkitBackdropFilter:'blur(14px)' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:24 }}>
          <div style={{ fontWeight:700, fontSize:'0.9rem' }}>{file.name}{isEditableText ? (editMode ? ' (Edit Mode)' : ' (Read Mode)') : ''}</div>
          <div style={{ display:'flex', gap:8, alignItems:'center' }}>
            {isEditableText && (
              <>
                {saveMsg && <span style={{ fontSize:'0.8rem', color: saveMsg === 'Saved' ? 'var(--green)' : 'var(--accent2)' }}>{saveMsg}</span>}
                <button className="btn-edit-toggle" onClick={e => { e.stopPropagation(); toggleEditMode(); }}>
                  {editMode ? 'Read' : 'Edit'}
                </button>
                {editMode && (
                <button
                  className="btn-save-editor"
                  disabled={!hasChanges || saving}
                  onClick={async (e) => { e.stopPropagation(); await saveFile(); }}
                  style={{ opacity: (!hasChanges || saving) ? 0.6 : 1, cursor: (!hasChanges || saving) ? 'default' : 'pointer' }}
                >
                  {saving ? 'Saving...' : 'Save'}
                </button>
                )}
              </>
            )}
            <button className="btn-del" onClick={closeModal} style={{ color:'var(--muted)' }}>✕</button>
          </div>
        </div>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'center', overflow:'auto', maxHeight:'70vh' }}>
          {IMAGE_EXTS.has(ext) && (
            <img src={src} alt={file.name} style={{ maxWidth:'80vw', maxHeight:'68vh', borderRadius:8, objectFit:'contain' }} />
          )}
          {VIDEO_EXTS.has(ext) && (
            <VideoWithResume src={src} fileKey={(subfolder ? subfolder + '/' : '') + file.name} />
          )}
          
          {ext === 'pdf' && (
            <iframe src={src} title={file.name} style={{ width:'80vw', height:'68vh', border:'none', borderRadius:8 }} />
          )}
          {isEditableText && (
            <div style={{ width:'80vw', height:'68vh', overflow:'hidden', background:'var(--surface2)', borderRadius:8, padding:12, display:'grid', gridTemplateRows:'auto 1fr', gap:8 }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:8 }}>
                <div style={{ fontSize:12, color:'var(--muted)', fontFamily:'JetBrains Mono, monospace' }}>{editMode ? 'Editing' : 'Reading'} {file.name} • {lineCount} line{lineCount === 1 ? '' : 's'}</div>
                <button className="btn-copy-editor" onClick={async (e) => { e.stopPropagation(); if (textContent === null) return; try { await navigator.clipboard.writeText(textContent); setCopying(true); setTimeout(() => setCopying(false), 1400); } catch (_) { setCopying(false); } }}>{copying ? 'COPIED' : 'COPY'}</button>
              </div>

              <div style={{ display:'grid', gridTemplateColumns: '56px 1fr', minHeight:0, border:'1px solid var(--border)', borderRadius:8, overflow:'hidden' }}>
                <div ref={lineRef} style={{ overflow:'hidden', background:'rgba(0,0,0,0.15)', borderRight:'1px solid var(--border)', textAlign:'right', color:'var(--muted)', fontFamily:'JetBrains Mono, monospace', fontSize:12, lineHeight:'1.5', padding:'10px 8px', userSelect:'none' }}>
                  {Array.from({ length: lineCount }).map((_, i) => (
                    <div key={i}>{i + 1}</div>
                  ))}
                </div>
                {editMode ? (
                  isCodeFile ? (
                    <div style={{ position:'relative', width:'100%', height:'100%' }}>
                      <pre
                        ref={codeLayerRef}
                        aria-hidden="true"
                        style={{
                          position:'absolute',
                          inset:0,
                          margin:0,
                          padding:10,
                          overflow:'auto',
                          pointerEvents:'none',
                          whiteSpace:'pre',
                          fontFamily:'JetBrains Mono, monospace',
                          fontSize:13,
                          lineHeight:'1.5',
                          background:'transparent'
                        }}
                      >
                        {highlightedLines ? (
                          highlightedLines.map((lineHtml, i) => (
                            <div key={i} style={{ minHeight:'1.5em' }} dangerouslySetInnerHTML={{ __html: lineHtml || '&nbsp;' }} />
                          ))
                        ) : (
                          <code style={{ color:'var(--text)' }}>{textContent ?? ''}</code>
                        )}
                      </pre>
                      <textarea
                        value={textContent ?? ''}
                        onChange={e => setTextContent(e.target.value)}
                        onKeyDown={onEditorKeyDown}
                        onScroll={e => syncLineScroll(e.currentTarget.scrollTop, e.currentTarget.scrollLeft)}
                        spellCheck={false}
                        style={{
                          position:'absolute',
                          inset:0,
                          width:'100%',
                          height:'100%',
                          resize:'none',
                          border:'none',
                          outline:'none',
                          background:'transparent',
                          color:'transparent',
                          caretColor:'var(--text)',
                          textShadow:'0 0 0 rgba(0,0,0,0)',
                          WebkitTextFillColor:'transparent',
                          fontFamily:'JetBrains Mono, monospace',
                          fontSize:13,
                          lineHeight:'1.5',
                          padding:10,
                          overflow:'auto'
                        }}
                      />
                    </div>
                  ) : (
                    <textarea
                      value={textContent ?? ''}
                      onChange={e => setTextContent(e.target.value)}
                      onKeyDown={onEditorKeyDown}
                      onScroll={e => syncLineScroll(e.currentTarget.scrollTop)}
                      spellCheck={false}
                      style={{ width:'100%', height:'100%', resize:'none', border:'none', outline:'none', background:'transparent', color:'var(--text)', fontFamily:'JetBrains Mono, monospace', fontSize:13, lineHeight:'1.5', padding:10, overflow:'auto' }}
                    />
                  )
                ) : (
                  <div onScroll={e => syncLineScroll((e.currentTarget as HTMLDivElement).scrollTop, (e.currentTarget as HTMLDivElement).scrollLeft)} style={{ width:'100%', height:'100%', overflow:'auto', padding:10 }}>
                    {isCodeFile && highlightedLines ? (
                      <pre style={{ margin:0, background:'transparent', fontFamily:'JetBrains Mono, monospace', fontSize:13, lineHeight:'1.5', whiteSpace:'pre' }}>
                        {highlightedLines.map((lineHtml, i) => (
                          <div key={i} style={{ minHeight:'1.5em' }} dangerouslySetInnerHTML={{ __html: lineHtml || '&nbsp;' }} />
                        ))}
                      </pre>
                    ) : (
                      <pre style={{ margin:0, background:'transparent', color:'var(--text)', fontFamily:'JetBrains Mono, monospace', fontSize:13, lineHeight:'1.5', whiteSpace:'pre' }}>{textContent ?? ''}</pre>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
          {AUDIO_EXTS.has(ext) && (
            <div style={{ padding:'40px 60px', display:'flex', flexDirection:'column', alignItems:'center', gap:16 }}>
              <div style={{ fontSize:'4rem' }}>🎵</div>
              <p style={{ color:'var(--muted)', fontSize:'0.85rem' }}>{file.name}</p>
              <audio src={src} controls style={{ width:320 }} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Rename Modal ──────────────────────────────────────────────────────────────
function RenameModal({ file, subfolder, onClose, onDone }: { file: FileInfo; subfolder: string; onClose: () => void; onDone: (newName: string) => void }) {
  const [name, setName] = useState(file.name);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!name.trim() || name === file.name) return;
    setBusy(true); setErr('');
    const r = await fetch('/api/rename', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: subfolder ? `${subfolder}/${file.name}` : file.name, to: subfolder ? `${subfolder}/${name.trim()}` : name.trim() }),
    });
    setBusy(false);
    if (r.ok) { onDone(name.trim()); }
    else { const d = await r.json(); setErr(d.error || 'Rename failed'); }
  };

  return (
    <div className="overlay" onClick={onClose}>
      <div className="dialog" onClick={e => e.stopPropagation()}>
        <h3>Rename</h3>
        <p style={{ marginBottom:16 }}>Rename <strong style={{ color:'var(--text)' }}>{file.name}</strong></p>
        <input
          value={name} onChange={e => setName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && submit()}
          style={{ width:'100%', padding:'10px 14px', background:'var(--surface2)', border:'1px solid var(--border)', borderRadius:8, color:'var(--text)', fontFamily:'Syne, sans-serif', fontSize:'0.9rem', outline:'none', marginBottom: err ? 8 : 20 }}
          autoFocus
        />
        {err && <p style={{ color:'var(--accent2)', fontSize:'0.82rem', marginBottom:16 }}>{err}</p>}
        <div className="dialog-actions">
          <button className="btn-cancel" onClick={onClose}>Cancel</button>
          <button onClick={submit} disabled={busy || !name.trim() || name === file.name}
            style={{ background:'var(--accent)', color:'#fff', border:'none', padding:'9px 18px', borderRadius:8, fontFamily:'Syne, sans-serif', fontWeight:700, cursor:'pointer', opacity: busy?0.6:1 }}>
            {busy ? 'Renaming…' : 'Rename'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── New Folder Modal ──────────────────────────────────────────────────────────
function NewFolderModal({ subfolder, onClose, onDone, sharedDir, sharedDirDisplay }: { subfolder: string; onClose: () => void; onDone: () => void; sharedDir: string; sharedDirDisplay: string }) {
  const [name, setName] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!name.trim()) return;
    setBusy(true); setErr('');
    const r = await fetch('/api/mkdir', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim(), subfolder: subfolder || undefined }),
    });
    setBusy(false);
    if (r.ok) { onDone(); }
    else { const d = await r.json(); setErr(d.error || 'Failed'); }
  };

  return (
    <div className="overlay" onClick={onClose}>
      <div className="dialog" onClick={e => e.stopPropagation()}>
        <h3>New Folder</h3>
        <p style={{ marginBottom:16 }}>Create a new folder inside <strong style={{ color:'var(--text)' }}>{subfolder ? (sharedDirDisplay || sharedDir || 'shared_files') + '/' + subfolder : (sharedDirDisplay || sharedDir || 'shared_files') + '/'}</strong></p>
        <input
          value={name} onChange={e => setName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && submit()}
          placeholder="Folder name…"
          style={{ width:'100%', padding:'10px 14px', background:'var(--surface2)', border:'1px solid var(--border)', borderRadius:8, color:'var(--text)', fontFamily:'Syne, sans-serif', fontSize:'0.9rem', outline:'none', marginBottom: err ? 8 : 20 }}
          autoFocus
        />
        {err && <p style={{ color:'var(--accent2)', fontSize:'0.82rem', marginBottom:16 }}>{err}</p>}
        <div className="dialog-actions">
          <button className="btn-cancel" onClick={onClose}>Cancel</button>
          <button onClick={submit} disabled={busy || !name.trim()}
            style={{ background:'var(--accent)', color:'#fff', border:'none', padding:'9px 18px', borderRadius:8, fontFamily:'Syne, sans-serif', fontWeight:700, cursor:'pointer', opacity: busy?0.6:1 }}>
            {busy ? 'Creating…' : 'Create Folder'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── New File Modal ───────────────────────────────────────────────────────────
function NewFileModal({
  subfolder,
  onClose,
  onDone,
  initialName = '',
  initialContent = '',
  title = 'New File',
  description,
  confirmLabel = 'Create File',
  showLineNumbers = false,
  modalSize = 'default',
}: {
  subfolder: string;
  onClose: () => void;
  onDone: () => void;
  initialName?: string;
  initialContent?: string;
  title?: string;
  description?: string;
  confirmLabel?: string;
  showLineNumbers?: boolean;
  modalSize?: 'default' | 'large';
}) {
  const [name, setName] = useState(initialName);
  const [content, setContent] = useState(initialContent);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const contentRef = useRef<HTMLTextAreaElement | null>(null);
  const lineRef = useRef<HTMLDivElement | null>(null);
  const isLargeModal = modalSize === 'large';

  useEffect(() => {
    setName(initialName);
    setContent(initialContent);
  }, [initialName, initialContent]);

  const submit = async () => {
    if (!name.trim()) return;
    setBusy(true); setErr('');
    const r = await fetch('/api/create-file', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim(), subfolder: subfolder || undefined, content }),
    });
    setBusy(false);
    if (r.ok) { onDone(); }
    else { const d = await r.json().catch(() => ({})); setErr(d.error || 'Failed'); }
  };

  return (
    <div className="overlay" onClick={onClose}>
      <div
        className="dialog"
        onClick={e => e.stopPropagation()}
        style={{
          ...(isLargeModal ? { maxWidth: 860, width: '92vw' } : {}),
          maxHeight: '88vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <h3>{title}</h3>
        <div style={{ paddingRight: 2, flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          {description && <p style={{ marginBottom:12 }}>{description}</p>}
          <input
            value={name} onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && submit()}
            placeholder="File name (e.g. notes.txt)…"
            style={{ width:'100%', padding:'10px 14px', background:'var(--surface2)', border:'1px solid var(--border)', borderRadius:8, color:'var(--text)', fontFamily:'Syne, sans-serif', fontSize:'0.9rem', outline:'none', marginBottom: 12 }}
            autoFocus
          />
          {showLineNumbers ? (
            <div style={{ display:'grid', gridTemplateColumns:'56px 1fr', gap: 0, border:'1px solid var(--border)', borderRadius:8, overflow:'hidden', marginBottom: err ? 8 : 16, background:'var(--surface2)', flex: 1, minHeight: 0 }}>
              <div ref={lineRef} style={{ userSelect:'none', textAlign:'right', color:'var(--muted)', fontFamily:'JetBrains Mono, monospace', fontSize:'0.8rem', lineHeight:'1.45', padding:'10px 8px', borderRight:'1px solid rgba(255,255,255,0.12)', overflow:'hidden', whiteSpace:'pre' }}>
                {Array.from({ length: Math.max(1, content.split(/\r?\n/).length) }, (_, i) => i + 1).join('\n')}
              </div>
              <textarea
                ref={contentRef}
                value={content}
                onChange={e => setContent(e.target.value)}
                onScroll={e => {
                  if (lineRef.current) lineRef.current.scrollTop = (e.currentTarget as HTMLTextAreaElement).scrollTop;
                }}
                placeholder="Initial content (optional)"
                spellCheck={false}
                style={{ width:'100%', height: '100%', minHeight: isLargeModal ? 260 : 180, padding:'10px 12px', border:'none', borderRadius:0, color:'var(--text)', fontFamily:'JetBrains Mono, monospace', fontSize:'0.85rem', lineHeight:'1.45', outline:'none', resize:'none', background:'transparent', overflowY: 'auto' }}
              />
            </div>
          ) : (
            <textarea value={content} onChange={e => setContent(e.target.value)} placeholder="Initial content (optional)" style={{ width:'100%', minHeight: isLargeModal ? 220 : 120, maxHeight: '48vh', padding:'10px 12px', background:'var(--surface2)', border:'1px solid var(--border)', borderRadius:8, color:'var(--text)', fontFamily:'JetBrains Mono, monospace', fontSize:'0.85rem', outline:'none', marginBottom: err ? 8 : 16, resize: 'vertical' }} />
          )}
        </div>
        {err && <p style={{ color:'var(--accent2)', fontSize:'0.82rem', marginBottom:16 }}>{err}</p>}
        <div className="dialog-actions" style={{ marginTop: 8, flexShrink: 0 }}>
          <button className="btn-cancel" onClick={onClose}>Cancel</button>
          <button onClick={submit} disabled={busy || !name.trim()}
            style={{ background:'var(--accent)', color:'#fff', border:'none', padding:'9px 18px', borderRadius:8, fontFamily:'Syne, sans-serif', fontWeight:700, cursor:'pointer', opacity: busy?0.6:1 }}>
            {busy ? 'Creating…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main App ──────────────────────────────────────────────────────────────────
export default function Home() {
  const [pinRequired, setPinRequired] = useState<boolean | null>(null);
  const [authed, setAuthed] = useState(false);

  const [files, setFiles] = useState<FileInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('modified');
  const [sortAsc, setSortAsc] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<{ msg: string; type: 'ok'|'err' } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [previewFile, setPreviewFile] = useState<FileInfo | null>(null);
  const [renameFile, setRenameFile] = useState<FileInfo | null>(null);
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [showNewFile, setShowNewFile] = useState(false);
  const [pastedTextDraft, setPastedTextDraft] = useState<{ name: string; content: string } | null>(null);
  const [showQR, setShowQR] = useState(false);
  const [serverUrl, setServerUrl] = useState('');
  const [sharedDir, setSharedDir] = useState<string>('');
  const [sharedDirDisplay, setSharedDirDisplay] = useState<string>('');
  const [subfolder, setSubfolder] = useState(''); // current path relative to SHARED_DIR
  const fileInput = useRef<HTMLInputElement>(null);
  const [pendingFiles, setPendingFiles] = useState<File[] | null>(null);
  const [pendingPreviews, setPendingPreviews] = useState<string[]>([]);

  const suggestNameFromText = useCallback((value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return `note-${Date.now()}.txt`;
    const firstLine = trimmed.split(/\r?\n/)[0] || 'note';
    const safe = firstLine
      .replace(/[<>:"/\\|?*\x00-\x1F]/g, ' ')
      .trim()
      .replace(/\s+/g, '-')
      .replace(/^-+|-+$/g, '')
      .toLowerCase()
      .slice(0, 48);
    return `${safe || 'note'}.txt`;
  }, []);

  useEffect(() => {
    // create object URLs for image previews and revoke previous ones
    if (!pendingFiles || pendingFiles.length === 0) {
      pendingPreviews.forEach(u => u && URL.revokeObjectURL(u));
      setPendingPreviews([]);
      return;
    }
    // revoke any existing previews first
    pendingPreviews.forEach(u => u && URL.revokeObjectURL(u));
    const urls = pendingFiles.map(f => f.type && f.type.startsWith('image/') ? URL.createObjectURL(f) : '');
    setPendingPreviews(urls);
    return () => { urls.forEach(u => u && URL.revokeObjectURL(u)); };
  }, [pendingFiles]);

  // Check PIN requirement on mount
  useEffect(() => {
    fetch('/api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pin: '' }) })
      .then(r => r.json())
      .then(d => {
        if (d.pinEnabled === false) { setPinRequired(false); setAuthed(true); }
        else { setPinRequired(true); }
      })
      .catch(() => { setPinRequired(false); setAuthed(true); });
  }, []);

  // Get server info for QR
  useEffect(() => {
    fetch('/api/serverinfo').then(r => r.json()).then(d => {
      setServerUrl(d.url);
      if (d.sharedDir) setSharedDir(d.sharedDir);
      // prefer server-provided display; fall back to absolute sharedDir
      if (d.sharedDirDisplay) setSharedDirDisplay(d.sharedDirDisplay);
      else if (d.sharedDir) setSharedDirDisplay(d.sharedDir);
    }).catch(() => {});
  }, []);

  // Paste handler: images open upload confirmation, text opens create-file modal.
  useEffect(() => {
    const isEditableElement = (el: HTMLElement | null) => {
      if (!el) return false;
      const tag = el.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return true;
      return !!el.closest('[contenteditable="true"]');
    };

    const onPaste = (e: Event) => {
      const ev = e as ClipboardEvent & { clipboardData?: DataTransfer };
      try {
        const tgt = (ev.target as HTMLElement | null);
        if (isEditableElement(tgt)) return;
        if (tgt && tgt.closest && tgt.closest('[data-chat-input]')) return; // ignore paste when chat input targeted
        const clipboard = (ev.clipboardData || (window as any).clipboardData) as DataTransfer | undefined;
        if (!clipboard) return;
        const files: File[] = [];
        for (let i = 0; i < clipboard.items.length; i++) {
          const item = clipboard.items[i];
          if (item.kind === 'file') {
            const f = item.getAsFile();
            if (f) files.push(f);
          } else if (item.type && item.type.startsWith('image/')) {
            const f = item.getAsFile && item.getAsFile();
            if (f) files.push(f);
          }
        }

        if (files.length > 0) {
          // Show confirmation modal (reuse choose-file preview flow)
          setPendingFiles(files);
          ev.preventDefault?.();
          return;
        }

        const pastedText = (clipboard.getData && clipboard.getData('text/plain')) || '';
        if (pastedText && pastedText.trim()) {
          setPastedTextDraft({
            name: suggestNameFromText(pastedText),
            content: pastedText,
          });
          ev.preventDefault?.();
        }
      } catch (err) {
        console.error('paste upload error', err);
      }
    };

    // Handle Ctrl/Cmd+V even when paste event may not fire on the window
    const onKeyDown = async (e: Event) => {
      const ev = e as KeyboardEvent;
      if (!((ev.ctrlKey || ev.metaKey) && (ev.key === 'v' || ev.key === 'V'))) return;
      const active = document.activeElement as HTMLElement | null;
      if (isEditableElement(active)) return;
      if (active && active.closest && active.closest('[data-chat-input]')) return; // ignore Ctrl/Cmd+V when chat input focused
      // Try the async Clipboard API first (may provide images)
      try {
        const nav = navigator as any;
        if (nav.clipboard && typeof nav.clipboard.read === 'function') {
          const items = await nav.clipboard.read();
          const files: File[] = [];
          for (const item of items) {
            for (const type of item.types || []) {
              if (type.startsWith('image/')) {
                const blob = await item.getType(type);
                const ext = type.split('/')[1] || 'png';
                const file = new File([blob], `pasted-${Date.now()}.${ext}`, { type: blob.type });
                files.push(file);
              }
            }
          }
          if (files.length > 0) {
            setPendingFiles(files);
            ev.preventDefault?.();
          }
        }
      } catch (err) {
        // ignore - clipboard.read may be unsupported or blocked
        // fallback to the normal paste event handler
      }
    };

    window.addEventListener('paste', onPaste as EventListener);
    window.addEventListener('keydown', onKeyDown as EventListener);
    return () => {
      window.removeEventListener('paste', onPaste as EventListener);
      window.removeEventListener('keydown', onKeyDown as EventListener);
    };
  }, [subfolder, suggestNameFromText]);

  const showToast = (msg: string, type: 'ok'|'err' = 'ok') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchFiles = useCallback(async () => {
    setLoading(true);
    try {
      const url = subfolder ? `/api/files?subfolder=${encodeURIComponent(subfolder)}` : '/api/files';
      const r = await fetch(url);
      const data = await r.json();
      setFiles(data.files || []);
    } catch { showToast('Failed to load files', 'err'); }
    finally { setLoading(false); }
  }, [subfolder]);

  useEffect(() => { if (authed) fetchFiles(); }, [fetchFiles, authed]);

  const uploadFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    setUploading(true); setUploadProgress(0);
    const formData = new FormData();
    for (let i = 0; i < fileList.length; i++) formData.append('file', fileList[i]);
    const xhr = new XMLHttpRequest();
    const url = subfolder ? `/api/upload?subfolder=${encodeURIComponent(subfolder)}` : '/api/upload';
    xhr.open('POST', url);
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) setUploadProgress(Math.round(e.loaded/e.total*100)); };
    xhr.onload = async () => {
      if (xhr.status === 200) { showToast(`Uploaded ${fileList.length} file(s)`); await fetchFiles(); }
      else showToast('Upload failed', 'err');
      setUploading(false); setUploadProgress(0);
    };
    xhr.onerror = () => { showToast('Upload error', 'err'); setUploading(false); };
    xhr.send(formData);
  };

  const deleteFile = async (name: string) => {
    const url = `/api/delete?name=${encodeURIComponent(name)}${subfolder ? `&subfolder=${encodeURIComponent(subfolder)}` : ''}`;
    const r = await fetch(url, { method: 'DELETE' });
    if (r.ok) { showToast(`Deleted "${name}"`); setSelected(s => { const n = new Set(s); n.delete(name); return n; }); await fetchFiles(); }
    else showToast('Delete failed', 'err');
    setConfirmDelete(null);
  };

  const deleteSelected = async () => { for (const n of selected) await deleteFile(n); setSelected(new Set()); };

  const onDrop = (e: DragEvent<HTMLDivElement>) => { e.preventDefault(); setDragOver(false); uploadFiles(e.dataTransfer.files); };

  const toggleSelect = (name: string) => setSelected(s => { const n = new Set(s); n.has(name) ? n.delete(name) : n.add(name); return n; });

  const navigateTo = (folder: string) => { setSubfolder(folder); setSearch(''); setSelected(new Set()); };

  const getDownloadUrl = (name: string) => `/api/download?name=${encodeURIComponent(name)}${subfolder ? `&subfolder=${encodeURIComponent(subfolder)}` : ''}`;

  const canPreview = (f: FileInfo) => IMAGE_EXTS.has(f.ext) || VIDEO_EXTS.has(f.ext) || AUDIO_EXTS.has(f.ext) || f.ext === 'txt' || f.ext === 'pdf' || CODE_EXTS.has(f.ext);

  const openRowItem = (f: FileInfo) => {
    if (f.isDir) {
      navigateTo(subfolder ? `${subfolder}/${f.name}` : f.name);
      return;
    }

    if (canPreview(f)) {
      setPreviewFile(f);
      return;
    }

    window.open(getDownloadUrl(f.name), '_blank', 'noopener,noreferrer');
  };

  const sortedFiles = [...files]
    .filter(f => f.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      let cmp = 0;
      if (sortKey === 'name') cmp = a.name.localeCompare(b.name);
      else if (sortKey === 'size') cmp = a.size - b.size;
      else cmp = new Date(a.modified).getTime() - new Date(b.modified).getTime();
      return sortAsc ? cmp : -cmp;
    });

  const handleSort = (key: SortKey) => { if (sortKey === key) setSortAsc(a => !a); else { setSortKey(key); setSortAsc(true); } };
  const totalSize = files.reduce((acc, f) => acc + (f.isDir ? 0 : f.size), 0);

  // Breadcrumb parts
  const crumbs = subfolder ? subfolder.split('/').filter(Boolean) : [];

  if (pinRequired === null) return null; // loading
  if (pinRequired && !authed) return (
    <>
      <Head><title>SharedDrop</title><link href="https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" /></Head>
      <style>{`:root{--bg:#050914;--surface:rgba(12,20,40,0.72);--surface2:rgba(10,18,36,0.64);--border:rgba(84,114,175,0.34);--accent:#5c82cf;--accent2:#3b5ea8;--green:#7ed8be;--text:#e7eefc;--muted:#95a8cf;}*{box-sizing:border-box;margin:0;padding:0;}body{background:radial-gradient(circle at 12% 10%,#1a2f63 0%,#122246 30%,#0b1631 58%,#050914 100%);color:var(--text);font-family:'Syne',sans-serif;}`}</style>
      <PinScreen onUnlock={() => setAuthed(true)} />
    </>
  );

  return (
    <>
      <Head>
        <title>SharedDrop — Local File Sharing</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link href="https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.8.0/styles/github-dark.min.css" />
        <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.8.0/highlight.min.js"></script>
      </Head>

      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        :root {
          --bg: #050914; --surface: rgba(12,20,40,0.72); --surface2: rgba(10,18,36,0.64); --border: rgba(84,114,175,0.34);
          --accent: #5c82cf; --accent2: #3b5ea8; --green: #7ed8be;
          --text: #e7eefc; --muted: #95a8cf; --radius: 14px;
        }
        body {
          background:
            radial-gradient(circle at 12% 10%, #1a2f63 0%, #122246 30%, rgba(11,22,49,0.95) 64%, #050914 100%);
          color: var(--text);
          font-family: 'Syne', sans-serif;
          min-height: 100vh;
          overflow-x: hidden;
        }
        .bg-grid {
          position: fixed; inset: 0; z-index: 0;
          background-image:
            radial-gradient(circle at 20% 22%, rgba(255,194,78,0.35), transparent 14%),
            radial-gradient(circle at 82% 28%, rgba(71,137,214,0.22), transparent 18%),
            linear-gradient(rgba(120,156,221,0.07) 1px, transparent 1px),
            linear-gradient(90deg, rgba(120,156,221,0.07) 1px, transparent 1px);
          background-size: auto, auto, 42px 42px, 42px 42px;
          pointer-events: none;
        }
        .app { position: relative; z-index: 1; max-width: 1000px; margin: 0 auto; padding: 32px 20px 80px; }
        .header { display: flex; align-items: center; gap: 16px; margin-bottom: 28px; background: linear-gradient(145deg, rgba(29,48,91,0.58), rgba(12,20,40,0.5)); border: 1px solid var(--border); border-radius: 16px; padding: 14px 16px; backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); box-shadow: 0 14px 40px rgba(2,6,20,0.45); }
        .logo-mark { width: 48px; height: 48px; border-radius: 14px; background: linear-gradient(135deg, var(--accent), var(--accent2)); display: grid; place-items: center; font-size: 22px; flex-shrink: 0; box-shadow: 0 0 30px rgba(108,99,255,0.4); }
        .header-text h1 { font-size: 1.7rem; font-weight: 800; letter-spacing: -0.5px; }
        .header-text p { font-size: 0.82rem; color: var(--muted); font-family: 'JetBrains Mono', monospace; margin-top: 2px; }
        .header-actions { margin-left: auto; display: flex; gap: 8px; align-items: center; }
        .header-stats { text-align: right; font-family: 'JetBrains Mono', monospace; font-size: 0.78rem; color: var(--muted); line-height: 1.6; }
        .header-stats span { color: var(--accent); font-weight: 500; }
        .btn-icon { background: linear-gradient(140deg, rgba(31,52,99,0.62), rgba(11,20,39,0.5)); border: 1px solid var(--border); color: var(--text); width: 38px; height: 38px; border-radius: 10px; cursor: pointer; font-size: 1.1rem; transition: all 0.15s; display: grid; place-items: center; backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); }
        .btn-icon:hover { border-color: rgba(230,245,255,0.8); color: #fff; transform: translateY(-1px); }

        /* Breadcrumb */
        .breadcrumb { display: flex; align-items: center; gap: 6px; margin-bottom: 18px; flex-wrap: wrap; font-size: 0.83rem; }
        .crumb { color: var(--muted); cursor: pointer; transition: color 0.15s; padding: 3px 6px; border-radius: 5px; }
        .crumb:hover { color: var(--text); background: rgba(255,255,255,0.16); }
        .crumb.active { color: var(--text); font-weight: 700; cursor: default; }
        .crumb.active:hover { background: none; }
        .crumb-sep { color: var(--border); }

        /* Dropzone */
        .dropzone { border: 2px dashed rgba(109,143,205,0.45); border-radius: var(--radius); padding: 28px 32px; text-align: center; cursor: pointer; transition: all 0.2s; background: linear-gradient(145deg, rgba(25,43,83,0.58), rgba(12,20,39,0.48)); margin-bottom: 20px; position: relative; overflow: hidden; backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px); box-shadow: 0 12px 36px rgba(2,6,20,0.4); }
        .dropzone::before { content: ''; position: absolute; inset: 0; background: linear-gradient(135deg, rgba(62,96,165,0.28), rgba(19,31,63,0.15)); opacity: 0; transition: opacity 0.2s; }
        .dropzone:hover::before, .dropzone.drag-over::before { opacity: 1; }
        .dropzone:hover, .dropzone.drag-over { border-color: rgba(157,193,255,0.72); box-shadow: 0 0 0 1px rgba(131,169,238,0.45), 0 0 46px rgba(48,79,145,0.32); }
        .dropzone-icon { font-size: 2rem; margin-bottom: 8px; }
        .dropzone h2 { font-size: 1rem; font-weight: 700; margin-bottom: 4px; }
        .dropzone p { font-size: 0.8rem; color: var(--muted); }
        .btn-upload { display: inline-block; margin-top: 12px; background: linear-gradient(135deg, var(--accent), var(--accent2)); color: #fff; border: 1px solid rgba(219,238,255,0.52); padding: 9px 22px; border-radius: 10px; font-family: 'Syne', sans-serif; font-weight: 700; font-size: 0.85rem; cursor: pointer; transition: all 0.15s; box-shadow: 0 10px 24px rgba(66,108,212,0.32); }
        .btn-upload:hover { filter: brightness(1.06); transform: translateY(-1px); }

        /* Progress */
        .progress-wrap { margin-bottom: 16px; background: linear-gradient(145deg, rgba(255,255,255,0.16), rgba(173,208,255,0.08)); border-radius: 10px; padding: 12px 16px; border: 1px solid var(--border); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); }
        .progress-label { font-size: 0.8rem; color: var(--muted); margin-bottom: 6px; font-family: 'JetBrains Mono', monospace; }
        .progress-bar-bg { height: 5px; background: rgba(255,255,255,0.16); border-radius: 99px; overflow: hidden; }
        .progress-bar-fill { height: 100%; border-radius: 99px; background: linear-gradient(90deg, var(--accent), var(--accent2)); transition: width 0.1s; }

        /* Toolbar */
        .toolbar { display: flex; gap: 8px; margin-bottom: 14px; align-items: center; flex-wrap: wrap; }
        .search-wrap { position: relative; flex: 1; min-width: 180px; }
        .search-wrap input { width: 100%; padding: 9px 12px 9px 34px; background: rgba(255,255,255,0.16); border: 1px solid var(--border); border-radius: 10px; color: var(--text); font-family: 'Syne', sans-serif; font-size: 0.85rem; outline: none; transition: border-color 0.15s; backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); }
        .search-wrap input:focus { border-color: rgba(229,245,255,0.78); }
        .search-icon { position: absolute; left: 10px; top: 50%; transform: translateY(-50%); color: var(--muted); font-size: 0.85rem; pointer-events: none; }
        .btn-new-folder { background: linear-gradient(140deg, rgba(31,52,99,0.62), rgba(11,20,39,0.5)); border: 1px solid var(--border); color: var(--text); padding: 9px 14px; border-radius: 10px; font-family: 'Syne', sans-serif; font-weight: 600; font-size: 0.82rem; cursor: pointer; transition: all 0.15s; white-space: nowrap; backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); }
        .btn-new-folder:hover { border-color: rgba(230,245,255,0.8); color: #fff; }
        .btn-danger { background: linear-gradient(135deg, rgba(255,119,141,0.26), rgba(150,176,255,0.18)); color: #ffe5ec; border: 1px solid rgba(255,196,208,0.45); padding: 9px 14px; border-radius: 10px; font-family: 'Syne', sans-serif; font-weight: 600; font-size: 0.82rem; cursor: pointer; transition: all 0.15s; white-space: nowrap; }
        .btn-danger:hover { filter: brightness(1.05); }

        /* Table */
        .file-table-wrap { background: linear-gradient(150deg, rgba(24,41,80,0.58), rgba(11,20,39,0.46)); border: 1px solid var(--border); border-radius: var(--radius); overflow: hidden; backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px); box-shadow: 0 16px 48px rgba(2,6,20,0.44); }
        .file-table { width: 100%; border-collapse: collapse; }
        .file-table thead th { padding: 11px 14px; text-align: left; font-size: 0.72rem; font-weight: 700; letter-spacing: 0.8px; text-transform: uppercase; color: var(--muted); border-bottom: 1px solid rgba(220,240,255,0.22); cursor: pointer; user-select: none; white-space: nowrap; }
        .file-table thead th:hover { color: var(--text); }
        .file-table thead th.sorted { color: var(--accent); }
        .th-check { width: 38px; cursor: default !important; }
        .th-actions { width: 140px; cursor: default !important; }
        .file-row { transition: background 0.12s; animation: rowIn 0.2s ease both; }
        @keyframes rowIn { from { opacity:0; transform:translateY(3px); } to { opacity:1; transform:none; } }
        .file-row:hover { background: rgba(255,255,255,0.11); }
        .file-row.selected { background: rgba(149,189,255,0.18); }
        .file-row td { padding: 11px 14px; border-bottom: 1px solid rgba(220,240,255,0.16); vertical-align: middle; }
        .file-row:last-child td { border-bottom: none; }
        .file-icon { font-size: 1.2rem; margin-right: 9px; }
        .file-name-cell { display: flex; align-items: center; }
        .file-name { font-weight: 600; font-size: 0.88rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 260px; }
        .file-name.is-dir { cursor: pointer; color: var(--accent); }
        .file-name.is-dir:hover { text-decoration: underline; }
        .file-ext { font-size: 0.7rem; color: var(--muted); font-family: 'JetBrains Mono', monospace; margin-top: 1px; }
        .file-size { font-family: 'JetBrains Mono', monospace; font-size: 0.8rem; color: var(--muted); white-space: nowrap; }
        .file-date { font-size: 0.78rem; color: var(--muted); white-space: nowrap; }
        .actions-cell { display: flex; align-items: center; gap: 4px; }
        .btn-dl { background: linear-gradient(135deg, rgba(128,174,255,0.28), rgba(106,139,237,0.2)); color: #f2f8ff; border: 1px solid rgba(215,236,255,0.44); padding: 5px 10px; border-radius: 8px; font-family: 'Syne', sans-serif; font-size: 0.75rem; font-weight: 700; cursor: pointer; transition: all 0.15s; text-decoration: none; display: inline-block; white-space: nowrap; }
        .btn-dl:hover { filter: brightness(1.08); }
        .btn-preview { background: linear-gradient(135deg, rgba(127,245,214,0.22), rgba(114,167,255,0.22)); color: #effff8; border: 1px solid rgba(206,248,235,0.44); padding: 5px 10px; border-radius: 8px; font-family: 'Syne', sans-serif; font-size: 0.75rem; font-weight: 700; cursor: pointer; transition: all 0.15s; }
        .btn-preview:hover { filter: brightness(1.08); }
        .btn-edit-toggle { background: linear-gradient(140deg, rgba(132,170,255,0.18), rgba(75,108,186,0.16)); color: #dce9ff; border: 1px solid rgba(193,215,255,0.42); padding: 6px 12px; border-radius: 8px; font-family: 'Syne', sans-serif; font-size: 0.75rem; font-weight: 700; cursor: pointer; transition: all 0.15s; }
        .btn-edit-toggle:hover { filter: brightness(1.08); }
        .btn-save-editor { background: linear-gradient(135deg, #18b575, #0f8e66); color: #f4fff9; border: 1px solid rgba(183,255,226,0.55); padding: 6px 13px; border-radius: 8px; font-family: 'Syne', sans-serif; font-size: 0.76rem; font-weight: 800; letter-spacing: 0.28px; text-transform: uppercase; cursor: pointer; transition: all 0.15s; box-shadow: 0 10px 24px rgba(11,95,71,0.35); }
        .btn-save-editor:hover { filter: brightness(1.08); transform: translateY(-1px); }
        .btn-copy-editor { background: transparent; color: #a9bddf; border: 1px dashed rgba(180,205,245,0.6); padding: 5px 10px; border-radius: 7px; font-family: 'JetBrains Mono', monospace; font-size: 0.7rem; font-weight: 700; letter-spacing: 0.8px; cursor: pointer; transition: all 0.15s; }
        .btn-copy-editor:hover { background: rgba(255,255,255,0.08); color: #e7f1ff; border-color: rgba(218,236,255,0.82); }
        .btn-action { background: none; color: var(--muted); border: none; width: 26px; height: 26px; border-radius: 5px; cursor: pointer; font-size: 0.9rem; transition: all 0.15s; display: grid; place-items: center; }
        .btn-action:hover { background: rgba(255,255,255,0.12); color: var(--text); }
        .btn-action.del:hover { background: rgba(255,101,132,0.15); color: var(--accent2); }
        .cb { width: 15px; height: 15px; accent-color: var(--accent); cursor: pointer; }
        .empty { text-align: center; padding: 56px 20px; color: var(--muted); }
        .empty-icon { font-size: 2.8rem; margin-bottom: 10px; }
        .empty h3 { font-size: 0.95rem; font-weight: 700; color: var(--text); margin-bottom: 5px; }
        .empty p { font-size: 0.82rem; }
        .toast { position: fixed; bottom: 26px; right: 26px; z-index: 999; padding: 11px 18px; border-radius: 10px; font-size: 0.86rem; font-weight: 600; animation: toastIn 0.2s ease; max-width: 300px; }
        @keyframes toastIn { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:none; } }
        .toast.ok { background: linear-gradient(140deg, rgba(127,245,214,0.22), rgba(119,169,255,0.2)); border: 1px solid rgba(209,250,239,0.42); color: #e9fff7; }
        .toast.err { background: linear-gradient(140deg, rgba(255,129,151,0.24), rgba(127,173,255,0.19)); border: 1px solid rgba(255,207,217,0.45); color: #fff1f5; }
        .overlay { position: fixed; inset: 0; z-index: 100; background: rgba(2,6,18,0.64); display: grid; place-items: center; backdrop-filter: blur(8px); }
        .dialog { background: linear-gradient(145deg, rgba(28,46,88,0.6), rgba(12,20,40,0.5)); border: 1px solid var(--border); border-radius: 16px; padding: 26px; max-width: 360px; width: 90%; box-shadow: 0 20px 60px rgba(2,6,20,0.5); animation: dlgIn 0.15s ease; backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px); }
        @keyframes dlgIn { from { opacity:0; transform:scale(0.96); } to { opacity:1; transform:none; } }
        .dialog h3 { font-size: 1.05rem; font-weight: 800; margin-bottom: 6px; }
        .dialog p { font-size: 0.83rem; color: var(--muted); margin-bottom: 18px; line-height: 1.5; }
        .dialog-actions { display: flex; gap: 10px; justify-content: flex-end; }
        .btn-cancel { background: linear-gradient(140deg, rgba(31,52,99,0.62), rgba(11,20,39,0.5)); border: 1px solid var(--border); color: var(--text); padding: 8px 16px; border-radius: 9px; font-family: 'Syne', sans-serif; font-weight: 600; cursor: pointer; font-size: 0.85rem; }
        .btn-confirm-del { background: linear-gradient(140deg, #ff7f96, #7398ff); color: #fff; border: 1px solid rgba(255,216,224,0.52); padding: 8px 16px; border-radius: 9px; font-family: 'Syne', sans-serif; font-weight: 700; cursor: pointer; font-size: 0.85rem; }
        /* Mobile: collapse table rows into a compact list-style layout */
        @media (max-width: 600px) {
          .header-stats { display: none; }
          .file-table { width: 100%; }
          .file-table thead { display: none; }

          /* Turn each row into a two-column grid: left = name/meta, right = actions */
          .file-table tbody tr {
            display: grid;
            grid-template-columns: minmax(0, 1fr) auto;
            gap: 12px;
            align-items: center;
            padding: 10px 12px;
            border-bottom: 1px solid var(--border); /* visible divider line */
            margin-bottom: 8px;
          }

          /* hide the original checkbox column to conserve space */
          .file-table tbody tr td:nth-child(1) { display: none; }

          /* Name column: allow wrapping and truncate long names to two lines */
          .file-table tbody tr td:nth-child(2) { display: flex; align-items: center; min-width: 0; }
          .file-icon { font-size: 1rem; margin-right: 8px; flex-shrink: 0; }
          .file-name { max-width: 100%; white-space: normal; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; word-break: break-word; overflow-wrap: anywhere; }

          /* Put size and modified under the name visually by styling their cells to flow inside the name area */
          .file-table tbody tr td:nth-child(3),
          .file-table tbody tr td:nth-child(4) {
            color: var(--muted);
            font-family: 'JetBrains Mono', monospace;
            font-size: 0.78rem;
            margin-left: 8px;
          }

          /* Actions column stays on the right and becomes compact */
          .file-table tbody tr td:nth-child(5) { display: flex; justify-content: flex-end; width: 96px; flex-shrink: 0; }
          .actions-cell { gap: 6px; flex-wrap: nowrap; flex-shrink: 0; }
          .btn-dl, .btn-preview { padding: 6px 8px; font-size: 0.72rem; white-space: nowrap; }

          /* Ensure metadata cells don't push into actions */
          .file-table tbody tr td:nth-child(3), .file-table tbody tr td:nth-child(4) { min-width: 0; }

          /* Reduce padding between cells for compactness; keep a divider on the row */
          .file-row td { padding: 6px 0; border-bottom: none; }
          .file-table tbody tr:last-child { border-bottom: none; margin-bottom: 0; }
        }
        /* Mobile: ensure upload button is visible and provide a FAB fallback */
        .fab-upload { display: none; position: fixed; right: 18px; bottom: 18px; z-index: 200; width: 56px; height: 56px; border-radius: 999px; background: linear-gradient(135deg, var(--accent), var(--accent2)); color: #fff; border: 1px solid rgba(213,236,255,0.48); box-shadow: 0 12px 34px rgba(66,108,212,0.35); cursor: pointer; align-items: center; justify-content: center; font-size: 20px; backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); }
        @media (max-width: 600px) {
          .dropzone { padding: 18px; min-height: 120px; }
          .btn-upload { width: 100%; padding: 10px 14px; font-size: 0.9rem; }
          .fab-upload { display: flex; }
        }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>

      <div className="bg-grid" />
      <div className="app">

        {/* Header */}
        <div className="header">
          <div className="logo-mark">📡</div>
          <div className="header-text">
            <h1>SharedDrop</h1>
            <p>local network file sharing</p>
            <p style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.78rem', color: 'var(--muted)', marginTop: 4 }}>{sharedDirDisplay || sharedDir || 'shared_files'}</p>
          </div>
          <div className="header-actions">
            <div className="header-stats">
              <div><span>{files.length}</span> items</div>
              <div><span>{formatBytes(totalSize)}</span></div>
            </div>
            {serverUrl && (
              <button className="btn-icon" title="Show QR code" onClick={() => setShowQR(true)}>📱</button>
            )}
          </div>
        </div>

        {/* Breadcrumb */}
        <div className="breadcrumb">
          <span className={`crumb${subfolder === '' ? ' active' : ''}`} onClick={() => navigateTo('')}>📁 {sharedDirDisplay || sharedDir || 'shared_files'}</span>
          {crumbs.map((c, i) => {
            const path = crumbs.slice(0, i+1).join('/');
            const isLast = i === crumbs.length - 1;
            return (
              <span key={path} style={{ display:'flex', alignItems:'center', gap:6 }}>
                <span className="crumb-sep">/</span>
                <span className={`crumb${isLast ? ' active' : ''}`} onClick={() => !isLast && navigateTo(path)}>{c}</span>
              </span>
            );
          })}
        </div>

        {/* Drop zone */}
        <div className={`dropzone${dragOver ? ' drag-over' : ''}`}
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          onClick={() => fileInput.current?.click()}
        >
          <div className="dropzone-icon">{dragOver ? '📂' : '☁️'}</div>
          <h2>{dragOver ? 'Drop files here' : 'Drag & drop files to share'}</h2>
          <p>Sharing to <code style={{ fontFamily:'JetBrains Mono', color:'var(--accent)' }}>{(sharedDirDisplay || sharedDir || 'shared_files') + (subfolder ? `/${subfolder}` : '')}</code></p>
          <button className="btn-upload" onClick={e => { e.stopPropagation(); fileInput.current?.click(); }}>Choose Files</button>
          <input
            ref={fileInput}
            type="file"
            multiple
            hidden
            onChange={e => {
              const files = e.target.files;
              if (!files) return;
              setPendingFiles(Array.from(files));
              // reset input so same file can be selected again later
              e.currentTarget.value = '';
            }}
          />
        </div>

        {uploading && (
          <div className="progress-wrap">
            <div className="progress-label">Uploading… {uploadProgress}%</div>
            <div className="progress-bar-bg"><div className="progress-bar-fill" style={{ width:`${uploadProgress}%` }} /></div>
          </div>
        )}

        {/* Toolbar */}
        <div className="toolbar">
          <div className="search-wrap">
            <span className="search-icon">🔍</span>
            <input type="text" placeholder="Search files…" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <button className="btn-new-folder" onClick={() => setShowNewFolder(true)}>📁 New Folder</button>
          <button className="btn-new-folder" onClick={() => setShowNewFile(true)} style={{ marginLeft: 6 }}>📄 New File</button>
          {selected.size > 0 && (
            <button className="btn-danger" onClick={deleteSelected}>🗑 Delete {selected.size}</button>
          )}
        </div>

        {/* File table */}
        <div className="file-table-wrap">
          {loading ? (
            <div className="empty"><div className="empty-icon" style={{ animation:'spin 1s linear infinite' }}>⏳</div><h3>Loading…</h3></div>
          ) : sortedFiles.length === 0 ? (
            <div className="empty">
              <div className="empty-icon">📭</div>
              <h3>{search ? 'No matches' : 'Empty folder'}</h3>
              <p>{search ? 'Try a different search' : 'Upload files or create a folder to get started'}</p>
            </div>
          ) : (
            <table className="file-table">
              <thead>
                <tr>
                  <th className="th-check">
                    <input type="checkbox" className="cb"
                      checked={selected.size === sortedFiles.length && sortedFiles.length > 0}
                      onClick={e => e.stopPropagation()}
                      onChange={e => setSelected(e.target.checked ? new Set(sortedFiles.map(f => f.name)) : new Set())}
                    />
                  </th>
                  <th className={sortKey==='name'?'sorted':''} onClick={() => handleSort('name')}>Name {sortKey==='name'?(sortAsc?'↑':'↓'):''}</th>
                  <th className={sortKey==='size'?'sorted':''} onClick={() => handleSort('size')}>Size {sortKey==='size'?(sortAsc?'↑':'↓'):''}</th>
                  <th className={sortKey==='modified'?'sorted':''} onClick={() => handleSort('modified')}>Modified {sortKey==='modified'?(sortAsc?'↑':'↓'):''}</th>
                  <th className="th-actions">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sortedFiles.map((f, i) => (
                  <tr key={f.name} className={`file-row${selected.has(f.name)?' selected':''}`} style={{ animationDelay:`${i*25}ms`, cursor: 'pointer' }} onClick={() => openRowItem(f)}>
                    <td><input type="checkbox" className="cb" checked={selected.has(f.name)} onClick={e => e.stopPropagation()} onChange={() => toggleSelect(f.name)} /></td>
                    <td>
                      <div className="file-name-cell">
                        <span className="file-icon">{fileIcon(f.ext, f.isDir)}</span>
                        <div>
                          <div
                            className={`file-name${f.isDir?' is-dir':''}`}
                            title={f.name}
                          >{f.name}</div>
                          {f.ext && <div className="file-ext">.{f.ext.toUpperCase()}</div>}
                        </div>
                      </div>
                    </td>
                    <td><span className="file-size">{f.isDir ? '—' : formatBytes(f.size)}</span></td>
                    <td><span className="file-date">{formatDate(f.modified)}</span></td>
                    <td>
                      <div className="actions-cell" onClick={e => e.stopPropagation()}>
                        {!f.isDir && (
                          <a className="btn-dl" href={getDownloadUrl(f.name)} download onClick={e => e.stopPropagation()}>↓</a>
                        )}
                        <button className="btn-action" title="Rename" onClick={e => { e.stopPropagation(); setRenameFile(f); }}>✏️</button>
                        <button className="btn-action del" title="Delete" onClick={e => { e.stopPropagation(); setConfirmDelete(f.name); }}>✕</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Floating upload button for mobile */}
      <button className="fab-upload" title="Upload files" onClick={() => fileInput.current?.click()}>⤴</button>

      {/* Modals */}
      {showQR && serverUrl && <QRModal url={serverUrl} onClose={() => setShowQR(false)} />}
      {previewFile && (
        <PreviewModal
          file={previewFile}
          subfolder={subfolder}
          onClose={() => setPreviewFile(null)}
          onSaved={async () => {
            showToast('File saved');
            await fetchFiles();
          }}
        />
      )}
      {renameFile && (
        <RenameModal file={renameFile} subfolder={subfolder} onClose={() => setRenameFile(null)}
          onDone={async () => { setRenameFile(null); showToast('Renamed successfully'); await fetchFiles(); }}
        />
      )}
      {showNewFolder && (
        <NewFolderModal subfolder={subfolder} onClose={() => setShowNewFolder(false)}
          sharedDir={sharedDir} sharedDirDisplay={sharedDirDisplay}
          onDone={async () => { setShowNewFolder(false); showToast('Folder created'); await fetchFiles(); }}
        />
      )}
      {showNewFile && (
        <NewFileModal subfolder={subfolder} onClose={() => setShowNewFile(false)}
          onDone={async () => { setShowNewFile(false); showToast('File created'); await fetchFiles(); }}
        />
      )}
      {pastedTextDraft && (
        <NewFileModal
          subfolder={subfolder}
          initialName={pastedTextDraft.name}
          initialContent={pastedTextDraft.content}
          title="Create File From Pasted Text"
          description="Review the pasted text and edit the file name before creating it."
          confirmLabel="Create From Paste"
          showLineNumbers
          modalSize="large"
          onClose={() => setPastedTextDraft(null)}
          onDone={async () => {
            setPastedTextDraft(null);
            showToast('File created from pasted text');
            await fetchFiles();
          }}
        />
      )}
      {pendingFiles && pendingFiles.length > 0 && (
        <div className="overlay" onClick={() => setPendingFiles(null)}>
          <div className="dialog" onClick={e => e.stopPropagation()} style={{ maxWidth:560 }}>
            <h3>Confirm Upload</h3>
            <p>You're about to upload <strong style={{ color:'var(--text)' }}>{pendingFiles.length}</strong> file(s) to <code style={{ fontFamily:'JetBrains Mono', color:'var(--accent)' }}>{(sharedDirDisplay || sharedDir || 'shared_files') + (subfolder ? `/${subfolder}` : '')}</code></p>
            <div style={{ maxHeight: '40vh', overflow: 'auto', marginBottom: 16, padding: 8, background: 'linear-gradient(145deg, rgba(255,255,255,0.16), rgba(166,201,255,0.08))', borderRadius: 8, border: '1px solid var(--border)', backdropFilter:'blur(10px)', WebkitBackdropFilter:'blur(10px)' }}>
              {pendingFiles.map((f, i) => (
                <div key={`${f.name}-${i}`} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding: '6px 8px', borderRadius:6 }}>
                  <div style={{ display:'flex', gap:12, alignItems:'center', minWidth: 0 }}>
                    {pendingPreviews[i] ? (
                      <img src={pendingPreviews[i]} alt={f.name} style={{ width:72, height:72, objectFit:'cover', borderRadius:8, flex:'0 0 auto' }} />
                    ) : (
                      <div style={{ width:72, height:72, display:'grid', placeItems:'center', background:'var(--surface2)', borderRadius:8, color:'var(--muted)' }}>📄</div>
                    )}
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontWeight:700, fontSize: '0.9rem', display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden', wordBreak:'break-word' }}>{f.name}</div>
                      <div style={{ fontSize:'0.78rem', color:'var(--muted)', fontFamily:'JetBrains Mono' }}>{formatBytes(f.size)}</div>
                    </div>
                  </div>
                  <div style={{ marginLeft:12 }}>
                    <button className="btn-cancel" onClick={() => setPendingFiles(p => p ? p.filter((_, idx) => idx !== i) : p)}>Remove</button>
                  </div>
                </div>
              ))}
            </div>
            <div className="dialog-actions">
              <button className="btn-cancel" onClick={() => setPendingFiles(null)}>Cancel</button>
              <button onClick={async () => {
                try {
                  const dt = new DataTransfer();
                  pendingFiles.forEach(f => dt.items.add(f));
                  setPendingFiles(null);
                  await uploadFiles(dt.files);
                } catch (err) { console.error(err); showToast('Upload failed', 'err'); }
              }} style={{ background:'var(--accent)', color:'#fff', border:'none', padding:'9px 18px', borderRadius:8, fontFamily:'Syne, sans-serif', fontWeight:700, cursor:'pointer' }}>Upload</button>
            </div>
          </div>
        </div>
      )}
      {confirmDelete && (
        <div className="overlay" onClick={() => setConfirmDelete(null)}>
          <div className="dialog" onClick={e => e.stopPropagation()}>
            <h3>Delete?</h3>
            <p>Are you sure you want to delete <strong style={{ color:'var(--text)' }}>{confirmDelete}</strong>? This cannot be undone.</p>
            <div className="dialog-actions">
              <button className="btn-cancel" onClick={() => setConfirmDelete(null)}>Cancel</button>
              <button className="btn-confirm-del" onClick={() => deleteFile(confirmDelete)}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}
      <ChatPanel />
    </>
  );
}
