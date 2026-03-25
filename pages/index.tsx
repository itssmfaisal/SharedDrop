import { useState, useEffect, useRef, useCallback, DragEvent } from 'react';
import Head from 'next/head';

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
const VIDEO_EXTS = new Set(['mp4','webm','ogg','mov']);
const AUDIO_EXTS = new Set(['mp3','wav','flac','ogg','aac','m4a']);

const EXT_ICONS: Record<string, string> = {
  pdf:'📄',doc:'📝',docx:'📝',txt:'📃',md:'📃',
  jpg:'🖼️',jpeg:'🖼️',png:'🖼️',gif:'🖼️',webp:'🖼️',svg:'🖼️',
  mp4:'🎬',mov:'🎬',avi:'🎬',mkv:'🎬',webm:'🎬',
  mp3:'🎵',wav:'🎵',flac:'🎵',ogg:'🎵',
  zip:'🗜️',rar:'🗜️',gz:'🗜️',tar:'🗜️','7z':'🗜️',
  js:'💻',ts:'💻',py:'💻',json:'💻',html:'💻',css:'💻',
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
      <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:20, padding:'40px 36px', width:340, textAlign:'center', boxShadow:'0 20px 60px rgba(0,0,0,0.5)' }}>
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

// ── Preview Modal ─────────────────────────────────────────────────────────────
function PreviewModal({ file, subfolder, onClose }: { file: FileInfo; subfolder: string; onClose: () => void }) {
  const src = `/api/download?name=${encodeURIComponent(file.name)}${subfolder ? `&subfolder=${encodeURIComponent(subfolder)}` : ''}`;
  const ext = file.ext.toLowerCase();
  return (
    <div className="overlay" onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:16, padding:24, maxWidth:'90vw', maxHeight:'90vh', display:'flex', flexDirection:'column', gap:16, boxShadow:'0 20px 60px rgba(0,0,0,0.6)' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:24 }}>
          <div style={{ fontWeight:700, fontSize:'0.9rem' }}>{file.name}</div>
          <button className="btn-del" onClick={onClose} style={{ color:'var(--muted)' }}>✕</button>
        </div>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'center', overflow:'auto', maxHeight:'70vh' }}>
          {IMAGE_EXTS.has(ext) && (
            <img src={src} alt={file.name} style={{ maxWidth:'80vw', maxHeight:'68vh', borderRadius:8, objectFit:'contain' }} />
          )}
          {VIDEO_EXTS.has(ext) && (
            <video src={src} controls style={{ maxWidth:'80vw', maxHeight:'68vh', borderRadius:8 }} />
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
function NewFolderModal({ subfolder, onClose, onDone }: { subfolder: string; onClose: () => void; onDone: () => void }) {
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
        <p style={{ marginBottom:16 }}>Create a new folder inside <strong style={{ color:'var(--text)' }}>{subfolder || 'shared_files/'}</strong></p>
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
  const [showQR, setShowQR] = useState(false);
  const [serverUrl, setServerUrl] = useState('');
  const [subfolder, setSubfolder] = useState(''); // current path relative to SHARED_DIR
  const fileInput = useRef<HTMLInputElement>(null);

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
    fetch('/api/serverinfo').then(r => r.json()).then(d => setServerUrl(d.url)).catch(() => {});
  }, []);

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

  const canPreview = (f: FileInfo) => IMAGE_EXTS.has(f.ext) || VIDEO_EXTS.has(f.ext) || AUDIO_EXTS.has(f.ext);

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
      <style>{`:root{--bg:#0a0a0f;--surface:#111118;--surface2:#18181f;--border:#2a2a35;--accent:#6c63ff;--accent2:#ff6584;--green:#00d68f;--text:#e8e8f0;--muted:#6b6b80;}*{box-sizing:border-box;margin:0;padding:0;}body{background:var(--bg);color:var(--text);font-family:'Syne',sans-serif;}`}</style>
      <PinScreen onUnlock={() => setAuthed(true)} />
    </>
  );

  return (
    <>
      <Head>
        <title>SharedDrop — Local File Sharing</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link href="https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />
      </Head>

      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        :root {
          --bg: #0a0a0f; --surface: #111118; --surface2: #18181f; --border: #2a2a35;
          --accent: #6c63ff; --accent2: #ff6584; --green: #00d68f;
          --text: #e8e8f0; --muted: #6b6b80; --radius: 12px;
        }
        body { background: var(--bg); color: var(--text); font-family: 'Syne', sans-serif; min-height: 100vh; overflow-x: hidden; }
        .bg-grid {
          position: fixed; inset: 0; z-index: 0;
          background-image: linear-gradient(rgba(108,99,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(108,99,255,0.04) 1px, transparent 1px);
          background-size: 40px 40px; pointer-events: none;
        }
        .app { position: relative; z-index: 1; max-width: 1000px; margin: 0 auto; padding: 32px 20px 80px; }
        .header { display: flex; align-items: center; gap: 16px; margin-bottom: 28px; }
        .logo-mark { width: 48px; height: 48px; border-radius: 14px; background: linear-gradient(135deg, var(--accent), var(--accent2)); display: grid; place-items: center; font-size: 22px; flex-shrink: 0; box-shadow: 0 0 30px rgba(108,99,255,0.4); }
        .header-text h1 { font-size: 1.7rem; font-weight: 800; letter-spacing: -0.5px; }
        .header-text p { font-size: 0.82rem; color: var(--muted); font-family: 'JetBrains Mono', monospace; margin-top: 2px; }
        .header-actions { margin-left: auto; display: flex; gap: 8px; align-items: center; }
        .header-stats { text-align: right; font-family: 'JetBrains Mono', monospace; font-size: 0.78rem; color: var(--muted); line-height: 1.6; }
        .header-stats span { color: var(--accent); font-weight: 500; }
        .btn-icon { background: var(--surface); border: 1px solid var(--border); color: var(--text); width: 38px; height: 38px; border-radius: 9px; cursor: pointer; font-size: 1.1rem; transition: all 0.15s; display: grid; place-items: center; }
        .btn-icon:hover { border-color: var(--accent); color: var(--accent); }

        /* Breadcrumb */
        .breadcrumb { display: flex; align-items: center; gap: 6px; margin-bottom: 18px; flex-wrap: wrap; font-size: 0.83rem; }
        .crumb { color: var(--muted); cursor: pointer; transition: color 0.15s; padding: 3px 6px; border-radius: 5px; }
        .crumb:hover { color: var(--text); background: var(--surface2); }
        .crumb.active { color: var(--text); font-weight: 700; cursor: default; }
        .crumb.active:hover { background: none; }
        .crumb-sep { color: var(--border); }

        /* Dropzone */
        .dropzone { border: 2px dashed var(--border); border-radius: var(--radius); padding: 28px 32px; text-align: center; cursor: pointer; transition: all 0.2s; background: var(--surface); margin-bottom: 20px; position: relative; overflow: hidden; }
        .dropzone::before { content: ''; position: absolute; inset: 0; background: linear-gradient(135deg, rgba(108,99,255,0.08), rgba(255,101,132,0.05)); opacity: 0; transition: opacity 0.2s; }
        .dropzone:hover::before, .dropzone.drag-over::before { opacity: 1; }
        .dropzone:hover, .dropzone.drag-over { border-color: var(--accent); box-shadow: 0 0 0 1px var(--accent), 0 0 40px rgba(108,99,255,0.15); }
        .dropzone-icon { font-size: 2rem; margin-bottom: 8px; }
        .dropzone h2 { font-size: 1rem; font-weight: 700; margin-bottom: 4px; }
        .dropzone p { font-size: 0.8rem; color: var(--muted); }
        .btn-upload { display: inline-block; margin-top: 12px; background: var(--accent); color: #fff; border: none; padding: 9px 22px; border-radius: 8px; font-family: 'Syne', sans-serif; font-weight: 700; font-size: 0.85rem; cursor: pointer; transition: all 0.15s; box-shadow: 0 4px 20px rgba(108,99,255,0.35); }
        .btn-upload:hover { background: #7d75ff; transform: translateY(-1px); }

        /* Progress */
        .progress-wrap { margin-bottom: 16px; background: var(--surface); border-radius: 8px; padding: 12px 16px; border: 1px solid var(--border); }
        .progress-label { font-size: 0.8rem; color: var(--muted); margin-bottom: 6px; font-family: 'JetBrains Mono', monospace; }
        .progress-bar-bg { height: 5px; background: var(--surface2); border-radius: 99px; overflow: hidden; }
        .progress-bar-fill { height: 100%; border-radius: 99px; background: linear-gradient(90deg, var(--accent), var(--accent2)); transition: width 0.1s; }

        /* Toolbar */
        .toolbar { display: flex; gap: 8px; margin-bottom: 14px; align-items: center; flex-wrap: wrap; }
        .search-wrap { position: relative; flex: 1; min-width: 180px; }
        .search-wrap input { width: 100%; padding: 9px 12px 9px 34px; background: var(--surface); border: 1px solid var(--border); border-radius: 8px; color: var(--text); font-family: 'Syne', sans-serif; font-size: 0.85rem; outline: none; transition: border-color 0.15s; }
        .search-wrap input:focus { border-color: var(--accent); }
        .search-icon { position: absolute; left: 10px; top: 50%; transform: translateY(-50%); color: var(--muted); font-size: 0.85rem; pointer-events: none; }
        .btn-new-folder { background: var(--surface); border: 1px solid var(--border); color: var(--text); padding: 9px 14px; border-radius: 8px; font-family: 'Syne', sans-serif; font-weight: 600; font-size: 0.82rem; cursor: pointer; transition: all 0.15s; white-space: nowrap; }
        .btn-new-folder:hover { border-color: var(--accent); color: var(--accent); }
        .btn-danger { background: rgba(255,101,132,0.12); color: var(--accent2); border: 1px solid rgba(255,101,132,0.3); padding: 9px 14px; border-radius: 8px; font-family: 'Syne', sans-serif; font-weight: 600; font-size: 0.82rem; cursor: pointer; transition: all 0.15s; white-space: nowrap; }
        .btn-danger:hover { background: rgba(255,101,132,0.22); }

        /* Table */
        .file-table-wrap { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); overflow: hidden; }
        .file-table { width: 100%; border-collapse: collapse; }
        .file-table thead th { padding: 11px 14px; text-align: left; font-size: 0.72rem; font-weight: 700; letter-spacing: 0.8px; text-transform: uppercase; color: var(--muted); border-bottom: 1px solid var(--border); cursor: pointer; user-select: none; white-space: nowrap; }
        .file-table thead th:hover { color: var(--text); }
        .file-table thead th.sorted { color: var(--accent); }
        .th-check { width: 38px; cursor: default !important; }
        .th-actions { width: 140px; cursor: default !important; }
        .file-row { transition: background 0.12s; animation: rowIn 0.2s ease both; }
        @keyframes rowIn { from { opacity:0; transform:translateY(3px); } to { opacity:1; transform:none; } }
        .file-row:hover { background: var(--surface2); }
        .file-row.selected { background: rgba(108,99,255,0.08); }
        .file-row td { padding: 11px 14px; border-bottom: 1px solid var(--border); vertical-align: middle; }
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
        .btn-dl { background: rgba(108,99,255,0.12); color: var(--accent); border: 1px solid rgba(108,99,255,0.25); padding: 5px 10px; border-radius: 6px; font-family: 'Syne', sans-serif; font-size: 0.75rem; font-weight: 700; cursor: pointer; transition: all 0.15s; text-decoration: none; display: inline-block; white-space: nowrap; }
        .btn-dl:hover { background: rgba(108,99,255,0.22); }
        .btn-preview { background: rgba(0,214,143,0.1); color: var(--green); border: 1px solid rgba(0,214,143,0.25); padding: 5px 10px; border-radius: 6px; font-family: 'Syne', sans-serif; font-size: 0.75rem; font-weight: 700; cursor: pointer; transition: all 0.15s; }
        .btn-preview:hover { background: rgba(0,214,143,0.2); }
        .btn-action { background: none; color: var(--muted); border: none; width: 26px; height: 26px; border-radius: 5px; cursor: pointer; font-size: 0.9rem; transition: all 0.15s; display: grid; place-items: center; }
        .btn-action:hover { background: var(--surface2); color: var(--text); }
        .btn-action.del:hover { background: rgba(255,101,132,0.15); color: var(--accent2); }
        .cb { width: 15px; height: 15px; accent-color: var(--accent); cursor: pointer; }
        .empty { text-align: center; padding: 56px 20px; color: var(--muted); }
        .empty-icon { font-size: 2.8rem; margin-bottom: 10px; }
        .empty h3 { font-size: 0.95rem; font-weight: 700; color: var(--text); margin-bottom: 5px; }
        .empty p { font-size: 0.82rem; }
        .toast { position: fixed; bottom: 26px; right: 26px; z-index: 999; padding: 11px 18px; border-radius: 10px; font-size: 0.86rem; font-weight: 600; animation: toastIn 0.2s ease; max-width: 300px; }
        @keyframes toastIn { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:none; } }
        .toast.ok { background: rgba(0,214,143,0.15); border: 1px solid rgba(0,214,143,0.4); color: var(--green); }
        .toast.err { background: rgba(255,101,132,0.15); border: 1px solid rgba(255,101,132,0.4); color: var(--accent2); }
        .overlay { position: fixed; inset: 0; z-index: 100; background: rgba(0,0,0,0.65); display: grid; place-items: center; backdrop-filter: blur(6px); }
        .dialog { background: var(--surface); border: 1px solid var(--border); border-radius: 16px; padding: 26px; max-width: 360px; width: 90%; box-shadow: 0 20px 60px rgba(0,0,0,0.5); animation: dlgIn 0.15s ease; }
        @keyframes dlgIn { from { opacity:0; transform:scale(0.96); } to { opacity:1; transform:none; } }
        .dialog h3 { font-size: 1.05rem; font-weight: 800; margin-bottom: 6px; }
        .dialog p { font-size: 0.83rem; color: var(--muted); margin-bottom: 18px; line-height: 1.5; }
        .dialog-actions { display: flex; gap: 10px; justify-content: flex-end; }
        .btn-cancel { background: var(--surface2); border: 1px solid var(--border); color: var(--text); padding: 8px 16px; border-radius: 8px; font-family: 'Syne', sans-serif; font-weight: 600; cursor: pointer; font-size: 0.85rem; }
        .btn-confirm-del { background: var(--accent2); color: #fff; border: none; padding: 8px 16px; border-radius: 8px; font-family: 'Syne', sans-serif; font-weight: 700; cursor: pointer; font-size: 0.85rem; }
        @media (max-width: 600px) { .file-date { display: none; } .file-name { max-width: 140px; } .header-stats { display: none; } }
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
          <span className={`crumb${subfolder === '' ? ' active' : ''}`} onClick={() => navigateTo('')}>📁 shared_files</span>
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
          <p>Sharing to <code style={{ fontFamily:'JetBrains Mono', color:'var(--accent)' }}>shared_files/{subfolder}</code></p>
          <button className="btn-upload" onClick={e => { e.stopPropagation(); fileInput.current?.click(); }}>Choose Files</button>
          <input ref={fileInput} type="file" multiple hidden onChange={e => uploadFiles(e.target.files)} />
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
                  <tr key={f.name} className={`file-row${selected.has(f.name)?' selected':''}`} style={{ animationDelay:`${i*25}ms` }}>
                    <td><input type="checkbox" className="cb" checked={selected.has(f.name)} onChange={() => toggleSelect(f.name)} /></td>
                    <td>
                      <div className="file-name-cell">
                        <span className="file-icon">{fileIcon(f.ext, f.isDir)}</span>
                        <div>
                          <div
                            className={`file-name${f.isDir?' is-dir':''}`}
                            title={f.name}
                            onClick={() => f.isDir && navigateTo(subfolder ? `${subfolder}/${f.name}` : f.name)}
                          >{f.name}</div>
                          {f.ext && <div className="file-ext">.{f.ext.toUpperCase()}</div>}
                        </div>
                      </div>
                    </td>
                    <td><span className="file-size">{f.isDir ? '—' : formatBytes(f.size)}</span></td>
                    <td><span className="file-date">{formatDate(f.modified)}</span></td>
                    <td>
                      <div className="actions-cell">
                        {canPreview(f) && (
                          <button className="btn-preview" onClick={() => setPreviewFile(f)}>👁 Preview</button>
                        )}
                        {!f.isDir && (
                          <a className="btn-dl" href={`/api/download?name=${encodeURIComponent(f.name)}${subfolder?`&subfolder=${encodeURIComponent(subfolder)}`:''}`} download>↓</a>
                        )}
                        <button className="btn-action" title="Rename" onClick={() => setRenameFile(f)}>✏️</button>
                        <button className="btn-action del" title="Delete" onClick={() => setConfirmDelete(f.name)}>✕</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Modals */}
      {showQR && serverUrl && <QRModal url={serverUrl} onClose={() => setShowQR(false)} />}
      {previewFile && <PreviewModal file={previewFile} subfolder={subfolder} onClose={() => setPreviewFile(null)} />}
      {renameFile && (
        <RenameModal file={renameFile} subfolder={subfolder} onClose={() => setRenameFile(null)}
          onDone={async () => { setRenameFile(null); showToast('Renamed successfully'); await fetchFiles(); }}
        />
      )}
      {showNewFolder && (
        <NewFolderModal subfolder={subfolder} onClose={() => setShowNewFolder(false)}
          onDone={async () => { setShowNewFolder(false); showToast('Folder created'); await fetchFiles(); }}
        />
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
    </>
  );
}
