import React, { useEffect, useState, useRef } from 'react';

type Msg = {
  id: string;
  type: 'text' | 'file' | 'link';
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
  const [dropdownOpen, setDropdownOpen] = useState<string | null>(null);
  const [hoveredMsg, setHoveredMsg] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [confirmPos, setConfirmPos] = useState<{ top: number; left: number } | null>(null);

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

  const deleteMsg = async (id: string) => {
    try {
      await fetch('/api/messages', { method: 'DELETE', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ id }) });
      await fetchMsgs();
    } catch (e) { console.error(e); }
    setDropdownOpen(null);
  };

  const startEdit = (m: Msg) => { setEditingId(m.id); setEditText(m.content); setDropdownOpen(null); };
  const saveEdit = async (id: string) => { try { await fetch('/api/messages', { method: 'PUT', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ id, content: editText }) }); await fetchMsgs(); } catch (e) { console.error(e); } setEditingId(null); setEditText(''); };
  const cancelEdit = () => { setEditingId(null); setEditText(''); };

  // Close dropdown and confirm popup when clicking outside
  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      const closest = target.closest('[data-dropdown-id]');
      if (!closest) { setDropdownOpen(null); setConfirmDeleteId(null); setConfirmPos(null); }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const renderMsgBubble = (m: Msg) => (
    <div key={m.id} data-msg-id={m.id} style={{ alignSelf: 'flex-start', maxWidth: isMobile ? '100%' : '88%', background: m.type === 'file' ? (isMobile ? 'linear-gradient(90deg,#222232,#16161b)' : 'linear-gradient(90deg,#232346,#18182b)') : (isMobile ? 'var(--surface2)' : 'var(--bubble-bg, #232346)'), borderRadius: 10, padding: 10, paddingRight: isMobile ? 32 : 40, overflow: 'visible', color: 'var(--text)', fontSize: 13, position: 'relative', boxShadow: isMobile ? undefined : '0 2px 8px rgba(0,0,0,0.08)', marginBottom: 2 }} onMouseEnter={() => setHoveredMsg(m.id)} onMouseLeave={() => setHoveredMsg(null)}>
      <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 6 }}>{new Date(m.createdAt).toLocaleString()}</div>
      {(m.type === 'text' || m.type === 'link') && (
        <div style={{ position: 'absolute', top: 8, right: 8, zIndex: 2 }} data-dropdown-id={m.id}>
          <button style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 18, opacity: hoveredMsg === m.id || dropdownOpen === m.id ? 1 : 0, transition: 'opacity 0.2s', padding: 2 }} data-dropdown-id={m.id} aria-label="Show options" onClick={e => { e.stopPropagation(); setDropdownOpen(dropdownOpen === m.id ? null : m.id); }} tabIndex={0}>⋮</button>
          {dropdownOpen === m.id && (
            <div style={{ position: 'absolute', top: 24, right: 0, background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, boxShadow: '0 8px 20px rgba(0,0,0,0.18)', minWidth: 110, zIndex: 1000, display: 'flex', flexDirection: 'column', padding: 4, overflow: 'visible' }} onClick={e => e.stopPropagation()} data-dropdown-id={m.id}>
              <button className="btn-action" style={{ display: 'block', width: '100%', fontSize: 14, background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', padding: '8px 10px', textAlign: 'left', boxSizing: 'border-box' }} onClick={e => {
                e.stopPropagation();
                const msgEl = (e.currentTarget as HTMLElement).closest('[data-msg-id]') as HTMLElement | null;
                if (msgEl) {
                  const rect = msgEl.getBoundingClientRect();
                  const popupW = 220; const popupH = 88;
                  const spaceAbove = rect.top;
                  const spaceBelow = window.innerHeight - rect.bottom;
                  let top: number;
                  if (spaceAbove >= popupH + 16) {
                    // enough room above
                    top = rect.top - popupH - 8;
                  } else if (spaceBelow >= popupH + 16) {
                    // enough room below
                    top = rect.bottom + 8;
                  } else {
                    // clamp into viewport so popup is always visible
                    top = Math.max(8, Math.min(rect.bottom + 8, window.innerHeight - popupH - 8));
                  }
                  // center horizontally over the message when possible, clamp to viewport
                  let left = rect.left + (rect.width - popupW) / 2;
                  left = Math.max(8, Math.min(left, window.innerWidth - popupW - 8));
                  setConfirmPos({ top, left });
                }
                setConfirmDeleteId(m.id);
              }} title="Delete" aria-label="Delete message">🗑️ Delete</button>
              <button className="btn-action" style={{ display: 'block', width: '100%', fontSize: 14, background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', padding: '8px 10px', textAlign: 'left', boxSizing: 'border-box' }} onClick={() => startEdit(m)} title="Edit" aria-label="Edit message">✏️ Edit</button>
            </div>
          )}
        </div>
      )}
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
      {m.type === 'text' && (editingId === m.id ? (
        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
          <input value={editText} onChange={e => setEditText(e.target.value)} style={{ flex: 1, padding: 8, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)' }} />
          <button onClick={() => saveEdit(m.id)} style={{ background: 'var(--accent)', color: '#fff', borderRadius: 8, padding: '8px 10px' }}>Save</button>
          <button onClick={cancelEdit} className="btn-cancel">Cancel</button>
        </div>
      ) : (
        <div style={{ whiteSpace: 'pre-wrap' }}>{m.content}</div>
      ))}
    </div>
  );

  const desktopPanel = (
    <div style={{ position: 'fixed', right: 18, top: 18, width: 360, bottom: 18, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, display: 'flex', flexDirection: 'column', overflow: 'visible', boxShadow: '0 20px 60px rgba(0,0,0,0.6)' }} onDragOver={e => e.preventDefault()} onDrop={onDrop}>
      <div style={{ padding: 12, borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ fontWeight: 800 }}>Me</div>
        <div style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--muted)', fontFamily: 'JetBrains Mono' }}>Personal chat</div>
      </div>
      <div ref={listRef} style={{ padding: 12, overflow: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>{messages.map(renderMsgBubble)}</div>
      <div style={{ padding: 10, borderTop: '1px solid var(--border)', display: 'flex', gap: 8, alignItems: 'center' }}>
        <input ref={inputRef} type="file" style={{ display: 'none' }} onChange={e => e.target.files && onAttach(e.target.files[0])} />
        <button onClick={() => inputRef.current?.click()} className="btn-icon">📎</button>
        <input value={text} onChange={e => setText(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendText()} placeholder="Message yourself…" style={{ flex: 1, padding: '8px 10px', borderRadius: 8, background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text)' }} />
        <button onClick={sendText} style={{ background: 'var(--accent)', color: '#fff', borderRadius: 8, padding: '8px 12px', border: 'none', cursor: 'pointer' }}>{sending ? '…' : 'Send'}</button>
      </div>
    </div>
  );

  const mobilePanel = (
    <div style={{ position: 'fixed', left: 8, right: 8, bottom: 8, height: '72vh', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, display: 'flex', flexDirection: 'column', overflow: 'visible', zIndex: 9999 }} onDragOver={e => e.preventDefault()} onDrop={onDrop}>
      <div style={{ padding: 12, borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ fontWeight: 800 }}>Me</div>
        <div style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--muted)', fontFamily: 'JetBrains Mono' }}>
          <button className="btn-cancel" onClick={() => setMobileOpen(false)}>Close</button>
        </div>
      </div>
      <div ref={listRef} style={{ padding: 12, overflow: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>{messages.map(renderMsgBubble)}</div>
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

  const confirmPopup = confirmDeleteId && confirmPos ? (
    <div style={{ position: 'fixed', top: confirmPos.top, left: confirmPos.left, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: 10, boxShadow: '0 12px 30px rgba(0,0,0,0.3)', zIndex: 20000, minWidth: 220 }} data-dropdown-id={confirmDeleteId}>
      <div style={{ fontSize: 13, marginBottom: 8, color: 'var(--text)' }}>Delete this message? This cannot be undone.</div>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button onClick={() => { setConfirmDeleteId(null); setConfirmPos(null); }} className="btn-cancel" style={{ padding: '6px 10px' }}>Cancel</button>
        <button onClick={async () => { if (confirmDeleteId) { await deleteMsg(confirmDeleteId); setConfirmDeleteId(null); setConfirmPos(null); } }} style={{ background: 'var(--danger, #e85)', color: '#fff', border: 'none', padding: '6px 10px', borderRadius: 6 }}>Delete</button>
      </div>
    </div>
  ) : null;

  return (
    <>
      {!isMobile && desktopPanel}
      {isMobile && !mobileOpen && mobileFab}
      {isMobile && mobileOpen && mobilePanel}
      {confirmPopup}
    </>
  );
}

