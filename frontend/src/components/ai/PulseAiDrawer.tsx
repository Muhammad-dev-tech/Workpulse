import React, { useState, useRef, useEffect } from 'react';
import { PulseAiMessage, UserPersona } from '../../types';
import { api } from '../../services/api';
import { getTerminology } from '../../terminology';
import {
  Bot,
  X,
  Send,
  ExternalLink,
  ShieldAlert
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
  const terms = getTerminology(currentUser?.organizationType, currentUser?.organizationName, currentUser);

  const getWelcomeMessage = () => {
    const isExecutive = currentUser?.role === 'SUPER_ADMIN' || currentUser?.role === 'ORG_ADMIN' || currentUser?.role === 'DEAN';
    const isManager = currentUser?.role === 'MANAGER';
    
    if (isExecutive) {
      return `Pulse AI active. I can query operational status, pending approvals, bottlenecks, and cross-department pipelines across the organization.`;
    }
    if (isManager) {
      return `Pulse AI active. I can report on your ${terms.unit.toLowerCase()}'s active workload, staff tasks, and pending approvals.`;
    }
    return `Pulse AI active. I can check status of your requests and pending tasks.`;
  };

  const [messages, setMessages] = useState<PulseAiMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: getWelcomeMessage(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);
  const [inputQuery, setInputQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMessages([
      {
        id: `welcome-${currentUser?.id || Date.now()}`,
        role: 'assistant',
        content: getWelcomeMessage(),
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }
    ]);
  }, [currentUser?.id]);

  const getRoleQuickPrompts = () => {
    const role = currentUser?.role;
    if (role === 'SUPER_ADMIN' || role === 'ORG_ADMIN') {
      return [
        `Summarize pending approvals and bottlenecks`,
        `Which ${terms.units.toLowerCase()} have overdue items?`,
        `Show overall operational throughput`
      ];
    }
    if (role === 'DEAN') {
      return [
        `Show requests awaiting endorsement`,
        `Which ${terms.units.toLowerCase()} have pending blockers?`
      ];
    }
    if (role === 'MANAGER') {
      return [
        `What requests are waiting for my review?`,
        `Which tasks in my ${terms.unit.toLowerCase()} are in progress?`,
        `Are any requests blocked?`
      ];
    }
    return [
      `What tasks are assigned to me?`,
      `What is the status of my requests?`
    ];
  };

  const quickPrompts = getRoleQuickPrompts();

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
          content: `${err.message || 'Error processing query.'}`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs transition-opacity animate-in fade-in"
        onClick={onClose}
        aria-label="Close assistant"
      />

      <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0b0f19] shadow-xl animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 p-3.5 bg-slate-50 dark:bg-slate-900/60">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-600 text-white">
              <Bot className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-slate-900 dark:text-white">Pulse AI</h3>
              <span className="text-[10px] text-slate-500">Operational Assistant</span>
            </div>
          </div>

          <button
            onClick={onClose}
            className="rounded-md p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 text-xs">
          {messages.map((m) => {
            const isUser = m.role === 'user';
            const isDenied = m.content.includes('Access Denied') || m.content.includes('⛔');

            return (
              <div
                key={m.id}
                className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} space-y-1`}
              >
                <div
                  className={`max-w-[88%] rounded-lg p-3 leading-relaxed ${
                    isUser
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : isDenied
                      ? 'border border-rose-200 dark:border-rose-900/50 bg-rose-50 dark:bg-rose-950/20 text-rose-800 dark:text-rose-200'
                      : 'bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200'
                  }`}
                >
                  {!isUser && isDenied && (
                    <div className="flex items-center gap-1 text-[10px] font-semibold text-rose-600 mb-1">
                      <ShieldAlert className="h-3 w-3" />
                      <span>Permission Notice</span>
                    </div>
                  )}

                  <div className="whitespace-pre-wrap">{m.content}</div>

                  {/* Tool citations */}
                  {m.toolResults && m.toolResults.length > 0 && (
                    <div className="mt-2.5 pt-2 border-t border-slate-200 dark:border-slate-800 space-y-1">
                      <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block">
                        Referenced Records
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {m.toolResults.map((tr: any, idx: number) => {
                          const data = tr.data;
                          const reqId = data?.requestId || data?.id;
                          if (!reqId) return null;
                          return (
                            <button
                              key={idx}
                              onClick={() => onSelectRequest(reqId)}
                              className="inline-flex items-center gap-1 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-1.5 py-0.5 text-[10px] font-mono font-medium text-emerald-700 dark:text-emerald-400 hover:border-emerald-500 transition"
                            >
                              <span>{reqId}</span>
                              <ExternalLink className="h-2.5 w-2.5" />
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                <span className="text-[9px] text-slate-400 px-1">
                  {m.timestamp}
                </span>
              </div>
            );
          })}

          {loading && (
            <div className="flex items-center gap-2 text-xs text-slate-400 p-2">
              <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
              <span>Querying system...</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Quick Suggestion Chips */}
        <div className="p-3 border-t border-slate-100 dark:border-slate-800/80 bg-slate-50/60 dark:bg-slate-900/40 space-y-1.5">
          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
            Suggested
          </span>
          <div className="flex flex-wrap gap-1">
            {quickPrompts.map((p, idx) => (
              <button
                key={idx}
                onClick={() => handleSend(p)}
                disabled={loading}
                className="rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1 text-[11px] text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:border-slate-300 transition text-left"
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        {/* Input */}
        <form onSubmit={(e) => { e.preventDefault(); handleSend(); }} className="p-3 border-t border-slate-200 dark:border-slate-800 flex items-center gap-2">
          <input
            type="text"
            value={inputQuery}
            onChange={(e) => setInputQuery(e.target.value)}
            placeholder="Ask a question..."
            disabled={loading}
            className="flex-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-1.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-emerald-600"
          />
          <button
            type="submit"
            disabled={loading || !inputQuery.trim()}
            className="rounded-lg bg-emerald-600 hover:bg-emerald-700 p-2 text-white disabled:opacity-50 transition"
          >
            <Send className="h-3.5 w-3.5" />
          </button>
        </form>
      </div>
    </>
  );
};
