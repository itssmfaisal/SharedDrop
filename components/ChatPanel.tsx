import React, { useEffect, useState, useRef } from 'react';

type Msg = {
  id: string;
  type: 'text'|'file'|'link';
  content: string;
  file?: string;
  preview?: { title?: string; description?: string; image?: string } | null;
  createdAt: string;
};

export default function ChatPanel() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [fileBusy, setFileBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const fetchMsgs = async () => {
    try {
      const r = await fetch('/api/messages');
      if (!r.ok) return;
      const d = await r.json();
      setMessages(d.messages || []);
    } catch (e) { /* ignore */ }
  };

  useEffect(() => { fetchMsgs(); const t = setInterval(fetchMsgs, 2000); return () => clearInterval(t); }, []);

  useEffect(() => {
    const check = () => setIsMobile(typeof window !== 'undefined' ? window.innerWidth <= 640 : false);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  useEffect(() => { if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight; }, [messages]);

  const sendText = async () => {
    if (!text.trim()) return;
    setSending(true);
    try {
      await fetch('/api/messages', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ type: 'text', content: text.trim() }) });
      setText(''); await fetchMsgs();
    } catch (e) { console.error(e); }
    setSending(false);
  };

  const onAttach = async (f?: File) => {
    const file = f || (inputRef.current?.files ? inputRef.current.files[0] : null);
    if (!file) return;
    setFileBusy(true);
    try {
      const fd = new FormData(); fd.append('file', file);
      const r = await fetch('/api/upload', { method: 'POST', body: fd });
      const j = await r.json();
      const uploaded = j.uploaded && j.uploaded[0];
      if (uploaded) {
        await fetch('/api/messages', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ type: 'file', file: uploaded, content: uploaded }) });
        await fetchMsgs();
      }
    } catch (e) { console.error(e); }
    setFileBusy(false);
  };

  const onDrop = async (e: React.DragEvent) => { e.preventDefault(); if (e.dataTransfer.files && e.dataTransfer.files[0]) await onAttach(e.dataTransfer.files[0]); };
  // Choose desktop or mobile layout
  const desktopPanel = (
    <div
      style={{ position: 'fixed', right: 18, top: 18, width: 360, bottom: 18, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.6)' }}
      onDragOver={e => e.preventDefault()}
      onDrop={onDrop}
    >
      <div style={{ padding: 12, borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ fontWeight: 800 }}>Me</div>
        <div style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--muted)', fontFamily: 'JetBrains Mono' }}>Personal chat</div>
      </div>

      <div ref={listRef} style={{ padding: 12, overflow: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {messages.map(m => (
          <div key={m.id} style={{ alignSelf: 'flex-start', maxWidth: '88%', background: m.type === 'file' ? 'linear-gradient(90deg,#222232,#16161b)' : 'var(--surface2)', borderRadius: 10, padding: 10, color: 'var(--text)', fontSize: 13 }}>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 6 }}>{new Date(m.createdAt).toLocaleString()}</div>
            {m.type === 'file' && m.file && (
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <div style={{ width: 56, height: 56, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, display: 'grid', placeItems: 'center' }}>📄</div>
                <div style={{ overflow: 'hidden' }}>
                  <div style={{ fontWeight: 700 }}>{m.file}</div>
                  <a style={{ color: 'var(--accent)', fontSize: 12 }} href={`/api/download?name=${encodeURIComponent(m.file)}`} download>Download</a>
                </div>
              </div>
            )}
            {m.type === 'link' && m.preview && (
              <div>
                <div style={{ fontWeight: 700 }}>{m.preview.title || m.content}</div>
                {m.preview.description && <div style={{ color: 'var(--muted)', fontSize: 12, marginTop: 6 }}>{m.preview.description}</div>}
                {m.preview.image && <img src={m.preview.image} style={{ width: '100%', marginTop: 8, borderRadius: 8 }} />}
                <div style={{ marginTop: 8 }}><a href={m.content} target="_blank" rel="noreferrer" style={{ color: 'var(--accent)' }}>{m.content}</a></div>
              </div>
            )}
            {m.type === 'text' && <div style={{ whiteSpace: 'pre-wrap' }}>{m.content}</div>}
          </div>
        ))}
      </div>

      <div style={{ padding: 10, borderTop: '1px solid var(--border)', display: 'flex', gap: 8, alignItems: 'center' }}>
        <input ref={inputRef} type="file" style={{ display: 'none' }} onChange={e => e.target.files && onAttach(e.target.files[0])} />
        <button onClick={() => inputRef.current?.click()} className="btn-icon">📎</button>
        <input value={text} onChange={e => setText(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendText()} placeholder="Message yourself…" style={{ flex: 1, padding: '8px 10px', borderRadius: 8, background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text)' }} />
        <button onClick={sendText} style={{ background: 'var(--accent)', color: '#fff', borderRadius: 8, padding: '8px 12px', border: 'none', cursor: 'pointer' }}>{sending ? '…' : 'Send'}</button>
      </div>
    </div>
  );

  const mobilePanel = (
    <div style={{ position: 'fixed', left: 8, right: 8, bottom: 8, height: '72vh', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, display: 'flex', flexDirection: 'column', overflow: 'hidden', zIndex: 9999 }} onDragOver={e => e.preventDefault()} onDrop={onDrop}>
      <div style={{ padding: 12, borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ fontWeight: 800 }}>Me</div>
        <div style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--muted)', fontFamily: 'JetBrains Mono' }}>
          <button className="btn-cancel" onClick={() => setMobileOpen(false)}>Close</button>
        </div>
      </div>
      <div ref={listRef} style={{ padding: 12, overflow: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {messages.map(m => (
          <div key={m.id} style={{ alignSelf: 'flex-start', maxWidth: '100%', background: m.type === 'file' ? 'linear-gradient(90deg,#222232,#16161b)' : 'var(--surface2)', borderRadius: 10, padding: 10, color: 'var(--text)', fontSize: 13 }}>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 6 }}>{new Date(m.createdAt).toLocaleString()}</div>
            {m.type === 'file' && m.file && (
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <div style={{ width: 56, height: 56, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, display: 'grid', placeItems: 'center' }}>📄</div>
                <div style={{ overflow: 'hidden' }}>
                  <div style={{ fontWeight: 700 }}>{m.file}</div>
                  <a style={{ color: 'var(--accent)', fontSize: 12 }} href={`/api/download?name=${encodeURIComponent(m.file)}`} download>Download</a>
                </div>
              </div>
            )}
            {m.type === 'link' && m.preview && (
              <div>
                <div style={{ fontWeight: 700 }}>{m.preview.title || m.content}</div>
                {m.preview.description && <div style={{ color: 'var(--muted)', fontSize: 12, marginTop: 6 }}>{m.preview.description}</div>}
                {m.preview.image && <img src={m.preview.image} style={{ width: '100%', marginTop: 8, borderRadius: 8, maxHeight: 180, objectFit: 'cover' }} />}
                <div style={{ marginTop: 8 }}><a href={m.content} target="_blank" rel="noreferrer" style={{ color: 'var(--accent)' }}>{m.content}</a></div>
              </div>
            )}
            {m.type === 'text' && <div style={{ whiteSpace: 'pre-wrap' }}>{m.content}</div>}
          </div>
        ))}
      </div>
      <div style={{ padding: 10, borderTop: '1px solid var(--border)', display: 'flex', gap: 8, alignItems: 'center' }}>
        <input ref={inputRef} type="file" style={{ display: 'none' }} onChange={e => e.target.files && onAttach(e.target.files[0])} />
        <button onClick={() => inputRef.current?.click()} className="btn-icon">📎</button>
        <input value={text} onChange={e => setText(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendText()} placeholder="Message yourself…" style={{ flex: 1, padding: '8px 10px', borderRadius: 8, background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text)' }} />
        <button onClick={sendText} style={{ background: 'var(--accent)', color: '#fff', borderRadius: 8, padding: '8px 12px', border: 'none', cursor: 'pointer' }}>{sending ? '…' : 'Send'}</button>
      </div>
    </div>
  );

  const mobileFab = (
    <button onClick={() => setMobileOpen(true)} style={{ position: 'fixed', right: 18, bottom: 18, zIndex: 9999, width: 56, height: 56, borderRadius: 999, background: 'var(--accent)', color: '#fff', border: 'none', boxShadow: '0 8px 30px rgba(108,99,255,0.35)', fontSize: 20 }} aria-label="Open chat">💬</button>
  );

  return (
    <>
      {!isMobile && desktopPanel}
      {isMobile && !mobileOpen && mobileFab}
      {isMobile && mobileOpen && mobilePanel}
    </>
  );
}
