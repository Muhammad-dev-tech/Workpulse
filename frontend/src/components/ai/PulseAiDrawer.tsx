import React, { useState, useRef, useEffect } from 'react';
import { PulseAiMessage, UserPersona } from '../../types';
import { api } from '../../services/api';
import {
  Bot,
  X,
  Send,
  Sparkles,
  ExternalLink,
  ShieldCheck,
  CheckCircle,
  HelpCircle,
  ArrowRight,
  Clock,
  Layers,
  ShieldAlert,
  AlertTriangle
} from 'lucide-react';

interface PulseAiDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserPersona | null;
  initialPrompt?: string;
  onSelectRequest: (id: string) => void;
}

export const PulseAiDrawer: React.FC<PulseAiDrawerProps> = ({
  isOpen,
  onClose,
  currentUser,
  initialPrompt,
  onSelectRequest
}) => {
  const [messages, setMessages] = useState<PulseAiMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: `Hello **${currentUser?.name?.split(' ')[0] || 'there'}**! I am **Pulse AI 🤖**, your operational visibility copilot.\n\nI can retrieve real-time status, diagnose bottlenecks, and check department pipelines according to your **${currentUser?.role}** permissions.`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);
  const [inputQuery, setInputQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const quickPrompts = [
    'How many IT requests are currently pending?',
    'Show me Finance confidential requests',
    'What does the IT department handle?',
    'What tasks are currently assigned to me?',
    'Why is request REQ-1042 stuck?'
  ];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
      if (initialPrompt) {
        handleSend(initialPrompt);
      }
    }
  }, [isOpen, initialPrompt]);

  const handleSend = async (queryToSend?: string) => {
    const q = (queryToSend || inputQuery).trim();
    if (!q || loading) return;

    const userMsg: PulseAiMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      content: q,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputQuery('');
    setLoading(true);

    try {
      const history = messages.map(m => ({ role: m.role, content: m.content }));
      const response = await api.queryPulseAi(q, history);

      const aiMsg: PulseAiMessage = {
        id: `ai-${Date.now()}`,
        role: 'assistant',
        content: response.answer,
        toolResults: response.toolResults,
        suggestedActions: response.suggestedActions,
        pendingAction: response.pendingAction,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      setMessages((prev) => [...prev, aiMsg]);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: 'assistant',
          content: `⚠️ ${err.message || 'Pulse AI error processing query.'}`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-indigo-500/20 bg-[#0b0f19]/95 shadow-2xl backdrop-blur-xl animate-in slide-in-from-right duration-300">
      {/* Drawer Header */}
      <div className="flex items-center justify-between border-b border-slate-800 p-4 bg-slate-900/60">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-600 to-cyan-500 text-white shadow-glow-indigo">
            <Bot className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h3 className="text-sm font-bold text-white">Pulse AI</h3>
              <span className="rounded-full bg-cyan-500/20 px-2 py-0.5 text-[9px] font-bold text-cyan-300 border border-cyan-500/30">
                AUTHORIZED COPILOT
              </span>
            </div>
            <p className="text-[10px] text-slate-400">Natural-Language Operational Interface</p>
          </div>
        </div>

        <button
          onClick={onClose}
          className="rounded-xl p-1 text-slate-400 hover:bg-slate-800 hover:text-white transition"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Security & RBAC Notice */}
      <div className="border-b border-slate-800/80 bg-indigo-950/20 px-4 py-2 text-[11px] text-indigo-300 flex items-center justify-between">
        <div className="flex items-center gap-2 truncate">
          <ShieldCheck className="h-3.5 w-3.5 text-cyan-400 shrink-0" />
          <span className="truncate">Caller: <strong>{currentUser?.name}</strong> ({currentUser?.role})</span>
        </div>
        <span className="text-[9px] bg-slate-800 px-1.5 py-0.5 rounded text-slate-400 shrink-0">
          Scope Enforced
        </span>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
        {messages.map((m) => {
          const isUser = m.role === 'user';
          const isDenied = m.content.includes('Access Denied') || m.content.includes('⛔');

          return (
            <div
              key={m.id}
              className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} space-y-1.5`}
            >
              <div
                className={`max-w-[90%] rounded-2xl p-3.5 leading-relaxed ${
                  isUser
                    ? 'bg-indigo-600 text-white shadow-md'
                    : isDenied
                    ? 'border border-rose-500/30 bg-rose-950/30 text-rose-200'
                    : 'glass-panel border border-slate-800 text-slate-200'
                }`}
              >
                {!isUser && (
                  <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-cyan-400 mb-2 pb-1 border-b border-white/5">
                    {isDenied ? (
                      <>
                        <ShieldAlert className="h-3 w-3 text-rose-400" />
                        <span className="text-rose-400">RBAC Scope Check Result</span>
                      </>
                    ) : (
                      <>
                        <Bot className="h-3 w-3" />
                        <span>Pulse AI Verification</span>
                      </>
                    )}
                  </div>
                )}

                <div className="whitespace-pre-wrap text-xs font-normal">
                  {m.content}
                </div>

                {/* Tool execution pills */}
                {m.toolResults && m.toolResults.length > 0 && (
                  <div className="mt-3 pt-2 border-t border-slate-800/80 flex flex-wrap gap-1.5">
                    {m.toolResults.map((t, idx) => (
                      <span
                        key={idx}
                        className={`font-mono text-[10px] px-2 py-0.5 rounded border ${
                          t.error
                            ? 'bg-rose-500/10 text-rose-300 border-rose-500/30'
                            : 'bg-indigo-500/10 text-indigo-300 border-indigo-500/20'
                        }`}
                      >
                        tool: {t.tool} {t.error ? `(${t.error})` : '✓'}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <span className="text-[10px] text-slate-500 px-1">{m.timestamp}</span>
            </div>
          );
        })}

        {loading && (
          <div className="flex items-center gap-2 text-xs text-indigo-400 p-2">
            <span className="h-2 w-2 rounded-full bg-cyan-400 animate-ping"></span>
            <span>Consulting WorkPulse authorization layer & source of truth...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggested Quick Prompts */}
      <div className="p-3 border-t border-slate-800/80 bg-slate-900/40">
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1.5">
          Suggested Operational Queries:
        </span>
        <div className="flex flex-wrap gap-1.5">
          {quickPrompts.map((qp, idx) => (
            <button
              key={idx}
              onClick={() => handleSend(qp)}
              disabled={loading}
              className="text-[11px] rounded-lg bg-slate-800/80 hover:bg-indigo-600/30 hover:text-indigo-200 border border-slate-700/60 px-2.5 py-1 text-slate-300 text-left transition disabled:opacity-50"
            >
              {qp}
            </button>
          ))}
        </div>
      </div>

      {/* Input Field */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSend();
        }}
        className="flex items-center gap-2 p-3 border-t border-slate-800 bg-[#0b0f19]"
      >
        <input
          type="text"
          value={inputQuery}
          onChange={(e) => setInputQuery(e.target.value)}
          placeholder="Ask Pulse AI about requests, departments, or tasks..."
          className="flex-1 rounded-xl border border-slate-800 bg-slate-900/90 px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
        />
        <button
          type="submit"
          disabled={loading || !inputQuery.trim()}
          className="rounded-xl bg-indigo-600 p-2.5 text-white hover:bg-indigo-500 disabled:opacity-50 transition"
        >
          <Send className="h-3.5 w-3.5" />
        </button>
      </form>
    </div>
  );
};
