/**
 * ChatbotWidget.jsx
 * ─────────────────
 * Global floating AI Chatbot Assistant:
 *  - Present across all portals (Admin, Faculty, Student)
 *  - Collapsible floating action button with live pulsating indicator
 *  - Real-time conversation with Campus AI tutor
 *  - Mode selector (Ask, Explain, Brainstorm, Quiz, Summarize)
 *  - Campus FAQ quick suggestion pills
 *  - Expandable source citation previews
 *  - Copy to clipboard & clear history
 */

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';

const MODES = [
  { id: 'ask',        label: 'Ask',        icon: '🔍' },
  { id: 'explain',    label: 'Explain',    icon: '💡' },
  { id: 'brainstorm', label: 'Brainstorm', icon: '🧠' },
  { id: 'quiz',       label: 'Quiz',       icon: '📝' },
  { id: 'summarize',  label: 'Summarize',  icon: '📋' },
];

export default function ChatbotWidget() {
  const { user } = useAuth();

  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    {
      id: 1,
      role: 'assistant',
      content: `👋 Hi ${user?.name?.split(' ')[0] || 'there'}! I'm your **Campus AI Assistant**. Ask me anything about university policies, course concepts, exam prep, or campus services!`,
      created_at: new Date().toISOString(),
    },
  ]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [mode, setMode] = useState('ask');
  const [sessionId, setSessionId] = useState(null);
  const [copiedId, setCopiedId] = useState(null);

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Initialize or fetch session when opened
  useEffect(() => {
    if (isOpen && !sessionId && user) {
      api.post('/ai/chat/session', { mode })
        .then(res => setSessionId(res.data.id))
        .catch(() => {});
    }
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, sending, isOpen]);

  // If no user is logged in, don't show the widget
  if (!user) return null;

  async function handleSend(textToSend = input) {
    const text = (textToSend || '').trim();
    if (!text || sending) return;

    // Optimistic user message
    const tempUserMsg = {
      id: Date.now(),
      role: 'user',
      content: text,
      created_at: new Date().toISOString(),
    };

    setMessages(prev => [...prev, tempUserMsg]);
    setInput('');
    setSending(true);

    try {
      let currentId = sessionId;
      if (!currentId) {
        const sessionRes = await api.post('/ai/chat/session', { mode });
        currentId = sessionRes.data.id;
        setSessionId(currentId);
      }

      const res = await api.post(`/ai/chat/sessions/${currentId}/message`, {
        content: text,
        mode,
      });

      const assistantMsg = {
        ...res.data.message,
        citations: res.data.citations,
      };

      setMessages(prev => [...prev, assistantMsg]);
    } catch (err) {
      setMessages(prev => [
        ...prev,
        {
          id: Date.now() + 1,
          role: 'assistant',
          content: '⚠️ ' + (err.response?.data?.detail || 'Could not connect to Campus AI. Please try again.'),
          created_at: new Date().toISOString(),
        },
      ]);
    } finally {
      setSending(false);
    }
  }

  function handleCopy(id, text) {
    navigator.clipboard?.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  function handleClearChat() {
    setMessages([
      {
        id: Date.now(),
        role: 'assistant',
        content: `Conversation reset. How can I help you right now?`,
        created_at: new Date().toISOString(),
      },
    ]);
    api.post('/ai/chat/session', { mode })
      .then(res => setSessionId(res.data.id))
      .catch(() => {});
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 select-none">
      {/* ── Floating Action Button (Collapsed) ────────────────────── */}
      {!isOpen && (
        <button
          id="open-ai-chatbot"
          onClick={() => setIsOpen(true)}
          className="group relative flex items-center gap-3 px-4 py-3 rounded-full
                     bg-gradient-to-r from-emerald-600 via-teal-600 to-sky-600
                     hover:from-emerald-500 hover:to-sky-500 text-white font-semibold text-sm
                     shadow-2xl shadow-emerald-950/80 hover:shadow-emerald-900
                     transition-all duration-300 transform hover:-translate-y-1 active:translate-y-0"
          title="Open Campus AI Assistant"
        >
          {/* Glowing pulse ring */}
          <span className="absolute -inset-0.5 rounded-full bg-emerald-400 opacity-30 group-hover:opacity-60 blur-sm transition animate-pulse" />

          <div className="relative flex items-center gap-2.5">
            <span className="text-xl">🤖</span>
            <span className="font-bold tracking-wide">Campus AI</span>
            <span className="w-2 h-2 rounded-full bg-emerald-300 animate-ping" />
          </div>
        </button>
      )}

      {/* ── Expandable Chat Window ─────────────────────────────────── */}
      {isOpen && (
        <div
          className="w-[360px] sm:w-[420px] h-[580px] max-h-[85vh] flex flex-col
                     bg-gray-900/95 backdrop-blur-xl border border-gray-750
                     rounded-3xl shadow-2xl shadow-black/80 overflow-hidden
                     transition-all duration-200 animate-in fade-in zoom-in-95"
        >
          {/* Header */}
          <div className="px-5 py-4 bg-gray-950/80 border-b border-gray-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-emerald-600 to-sky-600 flex items-center justify-center text-lg shadow-md flex-shrink-0">
                🤖
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-white text-sm font-bold leading-tight">Campus AI</h3>
                  <span className="text-[10px] font-mono font-semibold px-1.5 py-0.2 rounded bg-emerald-950 text-emerald-400 border border-emerald-800">
                    Online
                  </span>
                </div>
                <p className="text-gray-400 text-[11px]">University Intelligent Tutor</p>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={handleClearChat}
                className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 text-xs transition-colors"
                title="Clear Conversation"
              >
                🔄
              </button>
              <button
                id="close-ai-chatbot"
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 text-xs transition-colors"
                title="Minimize"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Mode Switcher Tabs */}
          <div className="px-4 py-2 bg-gray-950/40 border-b border-gray-800/80 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            {MODES.map(m => (
              <button
                key={m.id}
                onClick={() => setMode(m.id)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all whitespace-nowrap flex items-center gap-1
                  ${mode === m.id
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'bg-gray-800/80 text-gray-400 hover:bg-gray-800 hover:text-gray-200'
                  }`}
              >
                <span>{m.icon}</span>
                <span>{m.label}</span>
              </button>
            ))}
          </div>

          {/* Messages Stream */}
          <div className="flex-1 p-4 overflow-y-auto space-y-3 text-xs">
            {messages.map(msg => (
              <div
                key={msg.id}
                className={`flex gap-2.5 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {msg.role === 'assistant' && (
                  <div className="w-7 h-7 rounded-xl bg-emerald-950 border border-emerald-800 text-emerald-300 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
                    🤖
                  </div>
                )}

                <div
                  className={`group relative max-w-[85%] rounded-2xl px-3.5 py-2.5 leading-relaxed space-y-2
                    ${msg.role === 'user'
                      ? 'bg-emerald-600 text-white rounded-tr-none shadow-md shadow-emerald-950'
                      : 'bg-gray-800 border border-gray-700/80 text-gray-200 rounded-tl-none shadow'
                    }`}
                >
                  <div className="whitespace-pre-wrap">{msg.content}</div>

                  {/* Citation pills */}
                  {msg.citations && msg.citations.length > 0 && (
                    <div className="pt-2 border-t border-gray-700/60 flex flex-wrap gap-1">
                      {msg.citations.map(c => (
                        <span
                          key={c.index}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800 text-[10px] font-mono"
                          title={c.snippet}
                        >
                          📄 {c.docName} (p.{c.page})
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Hover copy button */}
                  <button
                    onClick={() => handleCopy(msg.id, msg.content)}
                    className="absolute -bottom-2 right-2 opacity-0 group-hover:opacity-100 bg-gray-900 border border-gray-700 text-gray-400 hover:text-white px-1.5 py-0.5 rounded text-[10px] transition-all"
                  >
                    {copiedId === msg.id ? '✓ Copied' : 'Copy'}
                  </button>
                </div>
              </div>
            ))}

            {sending && (
              <div className="flex gap-2.5 justify-start items-center">
                <div className="w-7 h-7 rounded-xl bg-emerald-950 border border-emerald-800 text-emerald-300 flex items-center justify-center text-xs">
                  🤖
                </div>
                <div className="p-2.5 rounded-2xl bg-gray-800 border border-gray-700 flex items-center gap-2 text-xs text-gray-400">
                  <span className="w-3 h-3 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                  <span>Thinking...</span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Quick Suggestion Chips */}
          <div className="px-3 py-1.5 bg-gray-950/40 border-t border-gray-800/80 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            {[
              'Library Hours',
              'Grading Scale',
              'Add/Drop Deadline',
              'Wi-Fi Help',
            ].map(chip => (
              <button
                key={chip}
                onClick={() => handleSend(chip)}
                className="px-2.5 py-1 rounded-full bg-gray-800/80 hover:bg-gray-800 text-gray-400 hover:text-emerald-300 text-[11px] whitespace-nowrap transition-colors border border-gray-750"
              >
                {chip}
              </button>
            ))}
          </div>

          {/* Input Footer */}
          <div className="p-3 bg-gray-950 border-t border-gray-800">
            <form
              onSubmit={e => {
                e.preventDefault();
                handleSend();
              }}
              className="flex items-center gap-2"
            >
              <input
                ref={inputRef}
                type="text"
                placeholder={`Ask Campus AI in ${mode} mode...`}
                value={input}
                onChange={e => setInput(e.target.value)}
                className="flex-1 px-3.5 py-2.5 rounded-xl bg-gray-800 border border-gray-700 text-white text-xs focus:outline-none focus:border-emerald-500 placeholder-gray-500"
              />
              <button
                type="submit"
                disabled={sending || !input.trim()}
                className="p-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all disabled:opacity-40 shadow-md shadow-emerald-950 flex-shrink-0"
              >
                ➤
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
