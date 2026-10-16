/**
 * AiStudyPage.jsx
 * ───────────────
 * Core AI Study Space (Phases 6 & 7):
 *  - Document library with PDF/DOCX/TXT ingest & chunk count
 *  - 5 Study Modes: Ask, Explain, Brainstorm, Quiz, Summarize
 *  - Course AI Policy enforcement (Allowed, Hints Only, Disabled)
 *  - Interactive Chat with expandable Source Citations [Source 1, p.X]
 *  - Campus FAQ quick suggestions
 *  - Chat session management
 */

import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../../api/axios';
import Modal from '../../components/Modal';
import { useToast } from '../../components/Toast';

const MODES = [
  { id: 'ask',        label: 'Ask',        icon: '🔍', desc: 'Direct answers with document citations' },
  { id: 'explain',    label: 'Explain',    icon: '💡', desc: 'Step-by-step analogies & simple breakdowns' },
  { id: 'brainstorm', label: 'Brainstorm', icon: '🧠', desc: 'Project ideas, exam topics & creative prompts' },
  { id: 'quiz',       label: 'Quiz Me',    icon: '📝', desc: 'Practice questions & instant self-tests' },
  { id: 'summarize',  label: 'Summarize',  icon: '📋', desc: 'Key takeaways & executive cheat sheets' },
];

export default function AiStudyPage() {
  const [searchParams] = useSearchParams();
  const toast = useToast();

  const [courses, setCourses] = useState([]);
  const [selectedOfferingId, setSelectedOfferingId] = useState(() => searchParams.get('offering_id') || '');

  // Documents
  const [documents, setDocuments] = useState([]);
  const [selectedDocId, setSelectedDocId] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  // Sessions & Messages
  const [sessions, setSessions] = useState([]);
  const [currentSessionId, setCurrentSessionId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [mode, setMode] = useState('ask');
  const [inputPrompt, setInputPrompt] = useState('');
  const [sending, setSending] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Citation inspection modal
  const [inspectedCitation, setInspectedCitation] = useState(null);

  // FAQs
  const [faqs, setFaqs] = useState([]);

  const messagesEndRef = useRef(null);

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    if (currentSessionId) {
      loadSessionMessages(currentSessionId);
    }
  }, [currentSessionId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, sending]);

  async function loadInitialData() {
    try {
      const [cRes, dRes, sRes, fRes] = await Promise.all([
        api.get('/student/courses'),
        api.get('/ai/documents'),
        api.get('/ai/chat/sessions'),
        api.get('/ai/faq'),
      ]);
      setCourses(cRes.data);
      setDocuments(dRes.data);
      setSessions(sRes.data);
      setFaqs(fRes.data);

      if (sRes.data.length > 0) {
        setCurrentSessionId(sRes.data[0].id);
        setMode(sRes.data[0].mode || 'ask');
      } else {
        createNewSession();
      }
    } catch {
      toast.error('Failed to initialize AI study environment.');
    }
  }

  async function loadSessionMessages(sessionId) {
    try {
      setLoadingHistory(true);
      const res = await api.get(`/ai/chat/sessions/${sessionId}`);
      setMessages(res.data.messages || []);
      if (res.data.session?.mode) {
        setMode(res.data.session.mode);
      }
    } catch {
      toast.error('Failed to load session messages.');
    } finally {
      setLoadingHistory(false);
    }
  }

  async function createNewSession(targetMode = mode) {
    try {
      const res = await api.post('/ai/chat/session', {
        document_id: selectedDocId ? parseInt(selectedDocId) : null,
        mode: targetMode,
      });
      setSessions(prev => [res.data, ...prev]);
      setCurrentSessionId(res.data.id);
      setMessages([]);
      toast.success('Started new study session!');
    } catch {
      toast.error('Failed to create new session.');
    }
  }

  async function handleDeleteSession(e, sessionId) {
    e.stopPropagation();
    if (!window.confirm('Delete this conversation history?')) return;
    try {
      await api.delete(`/ai/chat/sessions/${sessionId}`);
      setSessions(prev => prev.filter(s => s.id !== sessionId));
      if (currentSessionId === sessionId) {
        const remaining = sessions.filter(s => s.id !== sessionId);
        if (remaining.length > 0) {
          setCurrentSessionId(remaining[0].id);
        } else {
          createNewSession();
        }
      }
      toast.success('Session deleted.');
    } catch {
      toast.error('Failed to delete session.');
    }
  }

  async function handleFileUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);
    if (selectedOfferingId) {
      formData.append('offering_id', selectedOfferingId);
    }

    try {
      setUploading(true);
      const res = await api.post('/ai/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      toast.success(`"${file.name}" ingested into ${res.data.chunks_count} study chunks!`);
      // Refresh documents list
      const docsRes = await api.get('/ai/documents');
      setDocuments(docsRes.data);
      setSelectedDocId(res.data.id.toString());
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to upload document.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function handleDeleteDocument(e, docId) {
    e.stopPropagation();
    if (!window.confirm('Delete this document and its study chunks?')) return;
    try {
      await api.delete(`/ai/documents/${docId}`);
      setDocuments(prev => prev.filter(d => d.id !== docId));
      if (selectedDocId === docId.toString()) {
        setSelectedDocId('');
      }
      toast.success('Document deleted.');
    } catch {
      toast.error('Failed to delete document.');
    }
  }

  async function handleSendMessage(promptToSend = inputPrompt) {
    const text = (promptToSend || '').trim();
    if (!text || sending) return;

    if (!currentSessionId) {
      await createNewSession();
    }

    // Optimistically append user message
    const tempUserMsg = {
      id: Date.now(),
      role: 'user',
      content: text,
      created_at: new Date().toISOString(),
    };
    setMessages(prev => [...prev, tempUserMsg]);
    setInputPrompt('');
    setSending(true);

    try {
      const res = await api.post(`/ai/chat/sessions/${currentSessionId}/message`, {
        content: text,
        mode,
        offering_id: selectedOfferingId ? parseInt(selectedOfferingId) : null,
      });

      const assistantMsg = {
        ...res.data.message,
        citations: res.data.citations,
      };

      setMessages(prev => [...prev, assistantMsg]);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to generate AI response.');
      // remove optimistic message on failure
      setMessages(prev => prev.filter(m => m.id !== tempUserMsg.id));
    } finally {
      setSending(false);
    }
  }

  const selectedCourse = courses.find(c => c.offering_id.toString() === selectedOfferingId);

  return (
    <div className="h-[calc(100vh-140px)] flex flex-col md:flex-row gap-4">
      {/* ── Left Sidebar: Documents & History ──────────────────────── */}
      <aside className="w-full md:w-80 bg-gray-900 border border-gray-800 rounded-2xl p-4 flex flex-col justify-between overflow-hidden flex-shrink-0">
        <div className="space-y-4 flex-1 overflow-y-auto pr-1">
          {/* Course Context Picker */}
          <div>
            <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
              Course Context & Policy
            </label>
            <select
              value={selectedOfferingId}
              onChange={e => setSelectedOfferingId(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-xl bg-gray-800 border border-gray-700 text-white text-xs focus:outline-none focus:border-emerald-500"
            >
              <option value="">General University Assistant</option>
              {courses.map(c => (
                <option key={c.offering_id} value={c.offering_id}>
                  {c.code} — {c.title}
                </option>
              ))}
            </select>

            {selectedCourse && (
              <div className="mt-2 p-2 rounded-lg bg-gray-800/80 border border-gray-700/60 text-[11px] flex items-center justify-between">
                <span className="text-gray-300">Instructor Policy:</span>
                <span className={`font-semibold ${
                  selectedCourse.ai_policy === 'allowed'
                    ? 'text-emerald-400'
                    : selectedCourse.ai_policy === 'hints_only'
                    ? 'text-amber-400'
                    : 'text-red-400'
                }`}>
                  {selectedCourse.ai_policy === 'allowed' ? '🟢 Full AI' : selectedCourse.ai_policy === 'hints_only' ? '🟡 Hints Only' : '🔴 AI Off'}
                </span>
              </div>
            )}
          </div>

          {/* Document Ingestion & Library */}
          <div className="pt-2 border-t border-gray-800">
            <div className="flex items-center justify-between mb-2">
              <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                Study Documents ({documents.length})
              </label>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="text-xs text-emerald-400 hover:text-emerald-300 font-semibold"
              >
                {uploading ? 'Uploading...' : '+ Upload'}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.docx,.txt,.md"
                onChange={handleFileUpload}
                className="hidden"
              />
            </div>

            {/* Document Select / Filter */}
            <select
              value={selectedDocId}
              onChange={e => setSelectedDocId(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-xl bg-gray-800 border border-gray-700 text-white text-xs focus:outline-none focus:border-emerald-500 mb-2"
            >
              <option value="">All Documents in Library</option>
              {documents.map(d => (
                <option key={d.id} value={d.id}>
                  📄 {d.filename} ({d.chunk_count} chunks)
                </option>
              ))}
            </select>

            {/* Documents List */}
            <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
              {documents.length === 0 ? (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="p-4 rounded-xl border border-dashed border-gray-700 hover:border-emerald-500/60
                             text-center cursor-pointer transition-colors bg-gray-850/50"
                >
                  <span className="text-xl block mb-1">📁</span>
                  <div className="text-xs text-gray-300 font-medium">Click to upload lecture PDF</div>
                  <div className="text-[10px] text-gray-500">PDF, DOCX, TXT up to 20MB</div>
                </div>
              ) : (
                documents.map(d => (
                  <div
                    key={d.id}
                    onClick={() => setSelectedDocId(d.id.toString())}
                    className={`p-2 rounded-lg text-xs flex items-center justify-between cursor-pointer transition-all
                      ${selectedDocId === d.id.toString()
                        ? 'bg-emerald-950/80 border border-emerald-700 text-emerald-200'
                        : 'bg-gray-800/60 hover:bg-gray-800 text-gray-300 border border-gray-800'
                      }`}
                  >
                    <div className="truncate pr-2">
                      <div className="truncate font-medium">{d.filename}</div>
                      <div className="text-[10px] text-gray-500">{d.chunk_count} chunks</div>
                    </div>
                    <button
                      onClick={e => handleDeleteDocument(e, d.id)}
                      className="text-gray-500 hover:text-red-400 p-1"
                      title="Delete document"
                    >
                      ×
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Chat Sessions History */}
          <div className="pt-2 border-t border-gray-800">
            <div className="flex items-center justify-between mb-2">
              <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                Recent Chats
              </label>
              <button
                onClick={() => createNewSession()}
                className="text-xs text-emerald-400 hover:text-emerald-300 font-semibold"
              >
                + New
              </button>
            </div>

            <div className="space-y-1 max-h-36 overflow-y-auto pr-1">
              {sessions.map(s => (
                <div
                  key={s.id}
                  onClick={() => setCurrentSessionId(s.id)}
                  className={`p-2 rounded-lg text-xs flex items-center justify-between cursor-pointer transition-all
                    ${currentSessionId === s.id
                      ? 'bg-emerald-900/40 border border-emerald-700/80 text-white'
                      : 'hover:bg-gray-800/80 text-gray-400 border border-transparent'
                    }`}
                >
                  <div className="truncate pr-2">
                    <span className="capitalize font-medium text-emerald-400 mr-1.5">[{s.mode}]</span>
                    <span>{s.last_message ? s.last_message.slice(0, 24) + '...' : 'New Session'}</span>
                  </div>
                  <button
                    onClick={e => handleDeleteSession(e, s.id)}
                    className="text-gray-600 hover:text-red-400 text-xs px-1"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer info */}
        <div className="pt-3 border-t border-gray-800 text-[10px] text-gray-500 flex items-center justify-between">
          <span>Campus AI Assistant</span>
          <span className="text-emerald-500">Active</span>
        </div>
      </aside>

      {/* ── Main Chat Canvas ───────────────────────────────────────── */}
      <main className="flex-1 bg-gray-900 border border-gray-800 rounded-2xl flex flex-col justify-between overflow-hidden">
        {/* Top Control Bar: Mode Switcher */}
        <div className="px-6 py-3.5 border-b border-gray-800 flex items-center justify-between gap-4 overflow-x-auto bg-gray-950/40">
          <div className="flex items-center gap-1.5">
            {MODES.map(m => (
              <button
                key={m.id}
                onClick={() => {
                  setMode(m.id);
                  if (currentSessionId) {
                    api.post('/ai/chat/session', { mode: m.id }).then(res => {
                      setSessions(prev => [res.data, ...prev]);
                      setCurrentSessionId(res.data.id);
                      setMessages([]);
                    });
                  }
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all whitespace-nowrap
                  ${mode === m.id
                    ? 'bg-emerald-600 text-white shadow-md shadow-emerald-950'
                    : 'bg-gray-800 text-gray-400 hover:bg-gray-750 hover:text-gray-200'
                  }`}
                title={m.desc}
              >
                <span>{m.icon}</span>
                <span>{m.label}</span>
              </button>
            ))}
          </div>

          <span className="text-xs text-gray-500 hidden lg:inline">
            {MODES.find(m => m.id === mode)?.desc}
          </span>
        </div>

        {/* Messages Stream */}
        <div className="flex-1 p-6 overflow-y-auto space-y-5">
          {loadingHistory ? (
            <div className="flex items-center justify-center py-20 text-gray-500 gap-2">
              <span className="w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-xs">Loading conversation history...</span>
            </div>
          ) : messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center max-w-lg mx-auto py-8">
              <div className="w-16 h-16 rounded-3xl bg-emerald-950 border border-emerald-800 flex items-center justify-center text-3xl mb-4 shadow-xl">
                🤖
              </div>
              <h3 className="text-white font-bold text-lg mb-1">Welcome to your AI Study Space</h3>
              <p className="text-gray-400 text-xs mb-6">
                Ask anything about your courses, upload lecture slides for citations, or choose a mode above.
              </p>

              {/* Quick FAQ Suggestion Chips */}
              <div className="w-full space-y-2">
                <div className="text-[11px] text-gray-500 font-semibold uppercase tracking-wider text-left">
                  Popular Campus Inquiries
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-left">
                  {faqs.slice(0, 4).map(f => (
                    <button
                      key={f.question}
                      onClick={() => handleSendMessage(f.question)}
                      className="p-2.5 rounded-xl bg-gray-800/80 hover:bg-gray-800 border border-gray-700/80 hover:border-emerald-500/50 text-xs text-gray-300 transition-all text-left group"
                    >
                      <div className="text-[10px] text-emerald-400 font-semibold">{f.category}</div>
                      <div className="truncate group-hover:text-white transition-colors">{f.question}</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            messages.map(msg => (
              <div
                key={msg.id}
                className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {msg.role === 'assistant' && (
                  <div className="w-8 h-8 rounded-xl bg-emerald-950 border border-emerald-800 text-emerald-300 flex items-center justify-center text-sm font-bold flex-shrink-0">
                    🤖
                  </div>
                )}

                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-3 text-xs leading-relaxed space-y-3
                    ${msg.role === 'user'
                      ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-950/40 rounded-tr-none'
                      : 'bg-gray-800 border border-gray-700/80 text-gray-200 rounded-tl-none shadow'
                    }`}
                >
                  <div className="whitespace-pre-wrap">{msg.content}</div>

                  {/* Citation badges */}
                  {msg.citations && msg.citations.length > 0 && (
                    <div className="pt-2 border-t border-gray-700/60 space-y-1.5">
                      <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                        Verified Sources & Citations
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {msg.citations.map(c => (
                          <button
                            key={c.index}
                            onClick={() => setInspectedCitation(c)}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-800 text-emerald-300 text-[11px] font-mono transition-colors"
                          >
                            <span>📄</span>
                            <span>{c.docName} (p.{c.page})</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {msg.role === 'user' && (
                  <div className="w-8 h-8 rounded-xl bg-gray-800 border border-gray-700 text-gray-300 flex items-center justify-center text-xs font-bold flex-shrink-0">
                    👤
                  </div>
                )}
              </div>
            ))
          )}

          {sending && (
            <div className="flex gap-3 justify-start items-center">
              <div className="w-8 h-8 rounded-xl bg-emerald-950 border border-emerald-800 text-emerald-300 flex items-center justify-center text-sm">
                🤖
              </div>
              <div className="p-3 rounded-2xl bg-gray-800 border border-gray-700 flex items-center gap-2 text-xs text-gray-400">
                <span className="w-3.5 h-3.5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                <span>Synthesizing response from course materials & knowledge base...</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar */}
        <div className="p-4 border-t border-gray-800 bg-gray-950/60">
          <form
            onSubmit={e => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="flex items-center gap-2"
          >
            <input
              type="text"
              placeholder={`Ask in ${mode.toUpperCase()} mode... (e.g. explain with examples, quiz me, summarize)`}
              value={inputPrompt}
              onChange={e => setInputPrompt(e.target.value)}
              className="flex-1 px-4 py-3 rounded-xl bg-gray-800 border border-gray-700 text-white text-xs focus:outline-none focus:border-emerald-500 shadow-inner"
            />
            <button
              type="submit"
              disabled={sending || !inputPrompt.trim()}
              className="px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all disabled:opacity-40 shadow-lg shadow-emerald-950 flex items-center gap-1.5"
            >
              <span>Send</span>
              <span>→</span>
            </button>
          </form>
        </div>
      </main>

      {/* ── Modal: Inspect Citation ────────────────────────────────── */}
      <Modal
        isOpen={!!inspectedCitation}
        onClose={() => setInspectedCitation(null)}
        title={inspectedCitation ? `📄 Source Citation: ${inspectedCitation.docName}` : ''}
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs text-gray-400 pb-2 border-b border-gray-800">
            <span>Document: <strong className="text-white">{inspectedCitation?.docName}</strong></span>
            <span>Page: <strong className="text-emerald-400">{inspectedCitation?.page}</strong></span>
          </div>

          <div className="p-4 rounded-xl bg-gray-950 border border-gray-800 text-xs text-gray-300 font-mono whitespace-pre-wrap leading-relaxed max-h-80 overflow-y-auto">
            {inspectedCitation?.snippet}
          </div>

          <div className="flex justify-end pt-2 border-t border-gray-800">
            <button
              onClick={() => setInspectedCitation(null)}
              className="px-4 py-2 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-medium"
            >
              Close
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
