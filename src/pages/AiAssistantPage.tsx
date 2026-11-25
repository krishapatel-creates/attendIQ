import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, RotateCcw, Send, Sparkles } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { useAcademic } from '../context/AcademicContext';
import { buildAcademicSnapshot } from '../utils/academicSnapshot';

interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: string;
}

const STARTER_PROMPTS = [
  'What is my lowest attendance subject?',
  'How can I reach 75% in all subjects?',
  'Create a study plan for tomorrow',
  'How am I performing academically?',
] as const;

function formatInlineBold(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, idx) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return (
        <strong key={idx} className="font-semibold text-[#0A0A0A]">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return <React.Fragment key={idx}>{part}</React.Fragment>;
  });
}

function FormattedReply({ text }: { text: string }) {
  const lines = text.split('\n');
  return (
    <div className="space-y-1.5 text-sm text-[#1C1C1C] leading-relaxed">
      {lines.map((rawLine, idx) => {
        const line = rawLine.trim();
        if (!line) {
          return <div key={idx} className="h-1" />;
        }
        if (/^[-*•]\s+/.test(line)) {
          const content = line.replace(/^[-*•]\s+/, '');
          return (
            <div key={idx} className="flex items-start gap-2 pl-1">
              <span className="mt-2 w-1 h-1 rounded-full bg-[#2F466F] shrink-0" aria-hidden="true" />
              <span>{formatInlineBold(content)}</span>
            </div>
          );
        }
        if (/^\d+\.\s+/.test(line)) {
          const match = line.match(/^(\d+\.)\s+(.*)$/);
          return (
            <div key={idx} className="flex items-start gap-2 pl-1">
              <span className="font-mono-tabular text-xs font-semibold text-[#0F223A] mt-0.5 shrink-0">
                {match?.[1]}
              </span>
              <span>{formatInlineBold(match?.[2] ?? line)}</span>
            </div>
          );
        }
        return <p key={idx}>{formatInlineBold(line)}</p>;
      })}
    </div>
  );
}

export function AiAssistantPage() {
  const { student, overallStats, subjects, exams, marks, studyTasks, weeklyTimetable } =
    useAcademic();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const scrollEndRef = useRef<HTMLDivElement | null>(null);

  const snapshot = useMemo(
    () =>
      buildAcademicSnapshot({
        student,
        overallStats,
        subjects,
        exams,
        marks,
        studyTasks,
        weeklyTimetable,
      }),
    [student, overallStats, subjects, exams, marks, studyTasks, weeklyTimetable],
  );

  useEffect(() => {
    scrollEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isSending]);

  const pendingCount = useMemo(
    () => studyTasks.filter((t) => !t.completed).length,
    [studyTasks],
  );

  const sendMessage = async (promptText: string) => {
    const trimmed = promptText.trim();
    if (!trimmed || isSending) return;

    setErrorMsg(null);
    const nowLabel = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const userMsg: ChatMessage = {
      id: `usr_${Date.now()}`,
      role: 'user',
      text: trimmed,
      timestamp: nowLabel,
    };

    const nextHistory = messages.map((m) => ({ role: m.role, text: m.text }));
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsSending(true);

    try {
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: trimmed,
          history: nextHistory,
          snapshot,
        }),
      });

      const payload = (await response.json()) as { reply?: string; error?: string };
      if (!response.ok || !payload.reply) {
        throw new Error(payload.error || 'Unable to reach AttendIQ AI right now.');
      }

      const assistantMsg: ChatMessage = {
        id: `ai_${Date.now()}`,
        role: 'model',
        text: payload.reply,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to get AI response.');
    } finally {
      setIsSending(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void sendMessage(input);
  };

  const handleClear = () => {
    setMessages([]);
    setErrorMsg(null);
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="AI Assistant"
        subtitle="Grounded academic advisor citing only your live saved attendance, exam, and mark records"
        action={
          messages.length > 0 ? (
            <button
              type="button"
              onClick={handleClear}
              className="min-h-[44px] px-3.5 py-2 rounded-lg border border-[#D3D1CE] bg-white text-xs font-medium text-[#1C1C1C] hover:border-[#2F466F] transition-colors inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
              <span>New Session</span>
            </button>
          ) : undefined
        }
      />

      {/* Grounded Record Context Strip */}
      <div className="luxury-card rounded-xl px-4 py-3 flex flex-wrap items-center justify-between gap-2 text-xs text-[#262E36]">
        <div className="flex items-center gap-2">
          <Sparkles className="w-3.5 h-3.5 text-[#0F223A] shrink-0" aria-hidden="true" />
          <span className="font-medium text-[#0A0A0A]">Live Snapshot Grounding Active</span>
        </div>
        <div className="font-mono-tabular text-[#536878]">
          {subjects.length} subjects · {overallStats.percentage.toFixed(1)}% overall · {exams.length}{' '}
          exams · {marks.length} marks · {pendingCount} pending tasks
        </div>
      </div>

      {/* Chat Workspace */}
      <section
        aria-label="AttendIQ AI Chat"
        className="luxury-card rounded-xl flex flex-col overflow-hidden min-h-[380px] lg:min-h-[480px] max-h-[calc(100dvh-250px)] lg:max-h-[68vh]"
      >
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 bg-[#EDEAE6]/35">
          {messages.length === 0 ? (
            <div className="py-6 sm:py-10 max-w-[640px] mx-auto text-center space-y-5">
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-[#536878]">
                  AttendIQ Intelligence
                </p>
                <h2 className="mt-1 font-display text-lg sm:text-xl font-semibold text-[#0A0A0A]">
                  Ask anything about your semester ledger
                </h2>
                <p className="mt-1.5 text-sm text-[#262E36] leading-relaxed">
                  Every answer cites your exact saved A/T class counts, {student.targetAttendance}% benchmark recovery targets, exam countdowns, and recorded marks.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-left">
                {STARTER_PROMPTS.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    disabled={isSending}
                    onClick={() => void sendMessage(prompt)}
                    className="min-h-[48px] px-4 py-3 rounded-xl bg-white border border-[#D3D1CE] text-xs sm:text-sm font-medium text-[#0F223A] hover:border-[#2F466F] hover:bg-[#FFFFFF] transition-colors text-left cursor-pointer disabled:opacity-50"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              {messages.map((msg) =>
                msg.role === 'user' ? (
                  <div key={msg.id} className="flex justify-end">
                    <div className="max-w-[85%] sm:max-w-[72%] rounded-xl rounded-tr-xs bg-[#0F223A] text-white px-4 py-3">
                      <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                      <p className="mt-1.5 text-[10px] font-mono-tabular text-[#D3D1CE] text-right">
                        {msg.timestamp}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div key={msg.id} className="flex justify-start">
                    <article className="max-w-[92%] sm:max-w-[82%] rounded-xl rounded-tl-xs bg-white border border-[#D3D1CE] px-4 sm:px-5 py-3.5">
                      <div className="flex items-center justify-between gap-3 pb-2 mb-2 border-b border-[#EDEAE6]">
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-[#2F466F]">
                          AttendIQ Intelligence
                        </span>
                        <span className="text-[10px] font-mono-tabular text-[#536878]">
                          {msg.timestamp}
                        </span>
                      </div>
                      <FormattedReply text={msg.text} />
                    </article>
                  </div>
                ),
              )}

              {isSending && (
                <div className="flex justify-start">
                  <div className="rounded-xl rounded-tl-xs bg-white border border-[#D3D1CE] px-4 py-3">
                    <p className="text-xs font-medium text-[#536878]">
                      Analyzing your saved records...
                    </p>
                  </div>
                </div>
              )}

              <div ref={scrollEndRef} />
            </>
          )}
        </div>

        {/* Starter Prompt Chips Strip (visible during active conversation too) */}
        {messages.length > 0 && (
          <div className="px-4 py-2.5 bg-white border-t border-[#EDEAE6] flex items-center gap-2 overflow-x-auto">
            {STARTER_PROMPTS.map((prompt) => (
              <button
                key={prompt}
                type="button"
                disabled={isSending}
                onClick={() => void sendMessage(prompt)}
                className="min-h-[44px] sm:min-h-[36px] px-3 py-1 rounded-lg border border-[#D3D1CE] bg-[#EDEAE6]/45 text-xs font-medium text-[#1C1C1C] hover:border-[#2F466F] hover:bg-white transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
              >
                {prompt}
              </button>
            ))}
          </div>
        )}

        {/* Inline Error Banner */}
        {errorMsg && (
          <div
            role="alert"
            className="px-4 py-2.5 bg-[#FDF2F2] border-t border-[#8B2626]/20 flex items-center justify-between gap-3 text-xs text-[#8B2626]"
          >
            <div className="flex items-center gap-2 min-w-0">
              <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span className="truncate">{errorMsg}</span>
            </div>
            <button
              type="button"
              onClick={() => setErrorMsg(null)}
              className="min-h-[44px] px-2 inline-flex items-center font-semibold underline shrink-0 cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Composer */}
        <form
          onSubmit={handleSubmit}
          className="p-3 sm:p-4 bg-white border-t border-[#D3D1CE] flex items-center gap-2.5"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about your attendance recovery, marks, or tomorrow's study plan..."
            aria-label="Ask AttendIQ AI Assistant"
            disabled={isSending}
            className="flex-1 min-h-[44px] px-3.5 py-2 rounded-lg border border-[#D3D1CE] bg-white text-sm text-[#0A0A0A] placeholder:text-[#536878] focus:outline-none focus:border-[#2F466F] disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={isSending || !input.trim()}
            className="min-h-[44px] px-4 sm:px-5 rounded-lg bg-[#0F223A] text-white text-xs sm:text-sm font-medium hover:bg-[#2F466F] disabled:opacity-50 transition-colors inline-flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer"
          >
            <Send className="w-4 h-4" aria-hidden="true" />
            <span>{isSending ? 'Thinking...' : 'Send'}</span>
          </button>
        </form>
      </section>
    </div>
  );
}
