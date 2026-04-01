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
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const textInputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState<string | null>(null);
  const [hoveredMsg, setHoveredMsg] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [confirmPos, setConfirmPos] = useState<{ top: number; left: number } | null>(null);
  const [pendingFiles, setPendingFiles] = useState<Array<{ id: string; file: File; preview?: string }>>([]);
  const [modalSrc, setModalSrc] = useState<string | null>(null);
  const [modalType, setModalType] = useState<'image' | 'video' | null>(null);

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

  useEffect(() => {
    if (!panelOpen) {
      setDropdownOpen(null);
      setConfirmDeleteId(null);
      setConfirmPos(null);
    }
  }, [panelOpen]);

  const sendText = async () => {
    if (!text.trim() && pendingFiles.length === 0) return;
    setSending(true);
    try {
      // If there are pending attachments, upload them first
      if (pendingFiles.length > 0) {
        const files = pendingFiles.map(p => p.file);
        await uploadFiles(files);
        // revoke object URLs
        pendingFiles.forEach(p => { if (p.preview) try { URL.revokeObjectURL(p.preview); } catch (e) {} });
        setPendingFiles([]);
      }

      // Send text message if any
      if (text.trim()) {
        await fetch('/api/messages', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ type: 'text', content: text.trim() }) });
        setText('');
      }

      await fetchMsgs();
    } catch (e) { console.error(e); }
    setSending(false);
  };

  // Immediate upload helper used for non-chat contexts (dropzone elsewhere)
  const uploadFiles = async (files: File[]) => {
    if (!files || files.length === 0) return [];
    setFileBusy(true);
    try {
      const fd = new FormData();
      for (const f of files) fd.append('file', f);
      const r = await fetch('/api/upload?subfolder=chatdata', { method: 'POST', body: fd });
      const j = await r.json();
      const uploaded: string[] = j.uploaded || [];
      // create a message per uploaded file
      for (const name of uploaded) {
        await fetch('/api/messages', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ type: 'file', file: name, content: name }) });
      }
      await fetchMsgs();
      return uploaded;
    } catch (e) { console.error(e); return []; }
    finally { setFileBusy(false); }
  };

  // Queue attachment for chat input preview (no immediate upload)
  const queueAttachment = (file: File) => {
    const id = String(Date.now()) + Math.random().toString(36).slice(2,8);
    const preview = file.type.startsWith('image/') || file.type.startsWith('video/') ? URL.createObjectURL(file) : undefined;
    setPendingFiles(p => [...p, { id, file, preview }]);
  };

  const openMedia = (src: string, type: 'image' | 'video') => {
    setModalSrc(src);
    setModalType(type);
    try { document.body.style.overflow = 'hidden'; } catch (e) {}
  };

  const closeMedia = () => {
    setModalSrc(null);
    setModalType(null);
    try { document.body.style.overflow = ''; } catch (e) {}
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && modalSrc) closeMedia(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [modalSrc]);

  const removePending = (id: string) => {
    setPendingFiles(p => {
      const found = p.find(x => x.id === id);
      if (found && found.preview) {
        try { URL.revokeObjectURL(found.preview); } catch (e) {}
      }
      return p.filter(x => x.id !== id);
    });
  };

  const onDrop = async (e: React.DragEvent) => { e.preventDefault(); if (e.dataTransfer.files && e.dataTransfer.files[0]) {
    // If drop happened while chat input focused, queue; otherwise upload to shared folder
    const active = document.activeElement as HTMLElement | null;
    const chatFocused = !!(active && active.closest && active.closest('[data-chat-input]'));
    const files = Array.from(e.dataTransfer.files as FileList);
    if (chatFocused) {
      for (const f of files) queueAttachment(f);
    } else {
      await uploadFiles(files);
    }
  } };

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
        (() => {
          const name = m.file || '';
          const lower = name.toLowerCase();
          const isImage = /\.(png|jpe?g|gif|webp|bmp|svg)$/.test(lower);
          const isVideo = /\.(mp4|webm|ogg|mov|mkv)$/.test(lower);
          const url = `/api/download?subfolder=chatdata&name=${encodeURIComponent(name)}`;
          if (isImage) {
            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <img onClick={() => openMedia(url, 'image')} src={url} alt="image" style={{ width: '100%', maxHeight: 320, objectFit: 'cover', borderRadius: 8, cursor: 'zoom-in' }} />
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <a style={{ color: 'var(--accent)', fontSize: 12 }} href={url} download>Download</a>
                </div>
              </div>
            );
          }
          if (isVideo) {
            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <video onClick={() => openMedia(url, 'video')} controls style={{ width: '100%', maxHeight: 420, borderRadius: 8, background: '#000', cursor: 'pointer' }}>
                  <source src={url} />
                  Your browser does not support the video tag.
                </video>
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <a style={{ color: 'var(--accent)', fontSize: 12 }} href={url} download>Download</a>
                </div>
              </div>
            );
          }
          // fallback for other file types: show icon + filename + download
          return (
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <div style={{ width: 56, height: 56, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, display: 'grid', placeItems: 'center' }}>📄</div>
              <div style={{ overflow: 'hidden' }}>
                <div style={{ fontWeight: 700 }}>{name}</div>
                <a style={{ color: 'var(--accent)', fontSize: 12 }} href={url} download>Download</a>
              </div>
            </div>
          );
        })()
      )}
      {m.type === 'link' && m.preview && (
        <div>
          <div style={{ fontWeight: 700 }}>{m.preview.title || m.content}</div>
          {m.preview.description && <div style={{ color: 'var(--muted)', fontSize: 12, marginTop: 6 }}>{m.preview.description}</div>}
                {m.preview.image && <img onClick={() => openMedia(m.preview!.image!, 'image')} src={m.preview.image} style={{ width: '100%', marginTop: 8, borderRadius: 8, maxHeight: 180, objectFit: 'cover', cursor: 'zoom-in' }} />}
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
    <div style={{ position: 'fixed', right: 18, top: 18, width: 360, bottom: 18, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, display: 'flex', flexDirection: 'column', overflow: 'visible', boxShadow: '0 20px 60px rgba(0,0,0,0.6)', zIndex: 40 }} onDragOver={e => e.preventDefault()} onDrop={onDrop}>
      <div style={{ padding: 12, borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ fontWeight: 800 }}>Me</div>
        <div style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--muted)', fontFamily: 'JetBrains Mono' }}>Personal chat</div>
      </div>
      <div ref={listRef} style={{ padding: 12, overflow: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>{messages.map(renderMsgBubble)}</div>
      <div style={{ padding: 10, borderTop: '1px solid var(--border)', display: 'flex', gap: 8, alignItems: 'center', flexDirection: 'column' }}>
        {pendingFiles.length > 0 && (
          <div style={{ display: 'flex', gap: 8, width: '100%', overflowX: 'auto', paddingBottom: 8 }}>
            {pendingFiles.map(pf => (
              <div key={pf.id} style={{ minWidth: 80, maxWidth: 220, border: '1px solid var(--border)', borderRadius: 8, padding: 6, background: 'var(--surface)', display: 'flex', gap: 8, alignItems: 'center' }}>
                {pf.preview ? <img onClick={() => openMedia(pf.preview!, 'image')} src={pf.preview} style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 6, cursor: 'zoom-in' }} /> : <div style={{ width: 56, height: 56, display: 'grid', placeItems: 'center' }}>📎</div>}
                <div style={{ flex: 1, overflow: 'hidden' }}>
                  <div style={{ fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>{pf.file.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--muted)' }}>{(pf.file.size/1024).toFixed(0)} KB</div>
                </div>
                <button onClick={() => removePending(pf.id)} className="btn-cancel" style={{ marginLeft: 6 }}>✕</button>
              </div>
            ))}
          </div>
        )}
        <div style={{ display: 'flex', width: '100%', gap: 8, alignItems: 'center' }}>
          <input ref={fileInputRef} type="file" style={{ display: 'none' }} onChange={e => e.target.files && queueAttachment(e.target.files[0])} />
          <button onClick={() => fileInputRef.current?.click()} className="btn-icon">📎</button>
          <input data-chat-input ref={textInputRef} value={text} onChange={e => setText(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendText()} placeholder="Message yourself…" style={{ flex: 1, padding: '8px 10px', borderRadius: 8, background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text)' }} />
          <button onClick={sendText} style={{ background: 'var(--accent)', color: '#fff', borderRadius: 8, padding: '8px 12px', border: 'none', cursor: 'pointer' }}>{sending ? '…' : 'Send'}</button>
        </div>
      </div>
    </div>
  );

  const mobilePanel = (
    <div style={{ position: 'fixed', left: 8, right: 8, bottom: 8, height: '72vh', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, display: 'flex', flexDirection: 'column', overflow: 'visible', zIndex: 40 }} onDragOver={e => e.preventDefault()} onDrop={onDrop}>
      <div style={{ padding: 12, borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ fontWeight: 800 }}>Me</div>
        <div style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--muted)', fontFamily: 'JetBrains Mono' }}>
          <button className="btn-cancel" onClick={() => setPanelOpen(false)}>Close</button>
        </div>
      </div>
      <div ref={listRef} style={{ padding: 12, overflow: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>{messages.map(renderMsgBubble)}</div>
      <div style={{ padding: 10, borderTop: '1px solid var(--border)', display: 'flex', gap: 8, alignItems: 'center', flexDirection: 'column' }}>
        {pendingFiles.length > 0 && (
          <div style={{ display: 'flex', gap: 8, width: '100%', overflowX: 'auto', paddingBottom: 8 }}>
            {pendingFiles.map(pf => (
              <div key={pf.id} style={{ minWidth: 80, maxWidth: 220, border: '1px solid var(--border)', borderRadius: 8, padding: 6, background: 'var(--surface)', display: 'flex', gap: 8, alignItems: 'center' }}>
                {pf.preview ? <img src={pf.preview} style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 6 }} /> : <div style={{ width: 56, height: 56, display: 'grid', placeItems: 'center' }}>📎</div>}
                <div style={{ flex: 1, overflow: 'hidden' }}>
                  <div style={{ fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>{pf.file.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--muted)' }}>{(pf.file.size/1024).toFixed(0)} KB</div>
                </div>
                <button onClick={() => removePending(pf.id)} className="btn-cancel" style={{ marginLeft: 6 }}>✕</button>
              </div>
            ))}
          </div>
        )}
        <div style={{ display: 'flex', width: '100%', gap: 8, alignItems: 'center' }}>
          <input ref={fileInputRef} type="file" style={{ display: 'none' }} onChange={e => e.target.files && queueAttachment(e.target.files[0])} />
          <button onClick={() => fileInputRef.current?.click()} className="btn-icon">📎</button>
          <input data-chat-input ref={textInputRef} value={text} onChange={e => setText(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendText()} placeholder="Message yourself…" style={{ flex: 1, padding: '8px 10px', borderRadius: 8, background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text)' }} />
          <button onClick={sendText} style={{ background: 'var(--accent)', color: '#fff', borderRadius: 8, padding: '8px 12px', border: 'none', cursor: 'pointer' }}>{sending ? '…' : 'Send'}</button>
        </div>
      </div>
    </div>
  );

  const mobileFab = (
    <button onClick={() => setPanelOpen(v => !v)} style={{ position: 'fixed', right: isMobile ? 84 : 18, bottom: 18, zIndex: 45, width: 56, height: 56, borderRadius: 999, background: panelOpen ? 'var(--surface2)' : 'var(--accent)', color: '#fff', border: panelOpen ? '1px solid var(--border)' : 'none', boxShadow: panelOpen ? '0 8px 30px rgba(0,0,0,0.28)' : '0 8px 30px rgba(108,99,255,0.35)', fontSize: 20 }} aria-label={panelOpen ? 'Close chat' : 'Open chat'}>{panelOpen ? '✕' : '💬'}</button>
  );

  const panelBackdrop = panelOpen ? (
    <div
      onClick={() => setPanelOpen(false)}
      style={{ position: 'fixed', inset: 0, zIndex: 35, background: 'rgba(0,0,0,0.12)' }}
      aria-hidden="true"
    />
  ) : null;

  const confirmPopup = confirmDeleteId && confirmPos ? (
    <div style={{ position: 'fixed', top: confirmPos.top, left: confirmPos.left, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: 10, boxShadow: '0 12px 30px rgba(0,0,0,0.3)', zIndex: 20000, minWidth: 220 }} data-dropdown-id={confirmDeleteId}>
      <div style={{ fontSize: 13, marginBottom: 8, color: 'var(--text)' }}>Delete this message? This cannot be undone.</div>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button onClick={() => { setConfirmDeleteId(null); setConfirmPos(null); }} className="btn-cancel" style={{ padding: '6px 10px' }}>Cancel</button>
        <button onClick={async () => { if (confirmDeleteId) { await deleteMsg(confirmDeleteId); setConfirmDeleteId(null); setConfirmPos(null); } }} style={{ background: 'var(--danger, #e85)', color: '#fff', border: 'none', padding: '6px 10px', borderRadius: 6 }}>Delete</button>
      </div>
    </div>
  ) : null;

  const mediaModal = modalSrc ? (
    <div onClick={closeMedia} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 30000 }}>
      <div onClick={e => e.stopPropagation()} style={{ maxWidth: '96%', maxHeight: '96%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {modalType === 'image' ? (
          <img src={modalSrc as string} alt="full" style={{ maxWidth: '100%', maxHeight: '100%', borderRadius: 8 }} />
        ) : (
          <video controls autoPlay src={modalSrc as string} style={{ maxWidth: '100%', maxHeight: '100%', borderRadius: 8, background: '#000' }} />
        )}
      </div>
      <button onClick={closeMedia} aria-label="Close" style={{ position: 'fixed', right: 16, top: 16, background: 'transparent', border: 'none', color: '#fff', fontSize: 28, cursor: 'pointer' }}>✕</button>
    </div>
  ) : null;

  // Paste handling: route clipboard data to chat input when focused, otherwise treat as file-drop
  useEffect(() => {
    const onPaste = async (ev: Event) => {
      try {
        const e = ev as ClipboardEvent & { clipboardData: DataTransfer };
        const active = document.activeElement;
        const target = (ev.target as HTMLElement) || null;
        const targetIsInChatInput = !!(target && (target.closest && target.closest('[data-chat-input]')));
        const isInputFocused = !!(textInputRef.current && (active === textInputRef.current || textInputRef.current.contains(active) || targetIsInChatInput));

        // If there are files in clipboard
        const items = e.clipboardData?.items || [];
        for (let i = 0; i < items.length; i++) {
          const it = items[i];
          if (it.kind === 'file') {
            const file = it.getAsFile();
            if (file) {
              // Only intercept when the chat input is focused/targeted.
              if (!isInputFocused) {
                // Let other handlers (drop/share window) handle the paste.
                return;
              }
              // prevent default and stop other listeners so we don't double-upload
              (ev as Event & { preventDefault?: () => void }).preventDefault?.();
              try { (ev as any).stopImmediatePropagation?.(); } catch (err) { /* ignore */ }
              (ev as Event & { stopPropagation?: () => void }).stopPropagation?.();
              // Queue file for chat preview
              queueAttachment(file);
              return;
            }
          }
        }

        // No files — if text and input focused, paste into input at cursor
        const textData = e.clipboardData?.getData('text');
        if (textData) {
          if (!isInputFocused) return; // let other handlers process
          if (isInputFocused && textInputRef.current) {
            (ev as Event & { preventDefault?: () => void }).preventDefault?.();
            try { (ev as any).stopImmediatePropagation?.(); } catch (err) { /* ignore */ }
            (ev as Event & { stopPropagation?: () => void }).stopPropagation?.();
            const inp = textInputRef.current as HTMLInputElement;
            const start = inp.selectionStart ?? text.length;
            const end = inp.selectionEnd ?? text.length;
            const newText = text.slice(0, start) + textData + text.slice(end);
            setText(newText);
            setTimeout(() => {
              try { inp.selectionStart = inp.selectionEnd = start + textData.length; inp.focus(); } catch (err) { /* ignore */ }
            }, 0);
          }
        }
      } catch (err) {
        // swallow
      }
    };
    document.addEventListener('paste', onPaste as EventListener, true);
    return () => document.removeEventListener('paste', onPaste as EventListener, true);
  }, [text]);

  return (
    <>
      {panelBackdrop}
      {panelOpen && !isMobile && desktopPanel}
      {panelOpen && isMobile && mobilePanel}
      {mobileFab}
      {confirmPopup}
      {mediaModal}
    </>
  );
}

