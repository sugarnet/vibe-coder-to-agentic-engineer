"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import * as api from "@/lib/api";
import type { BoardData } from "@/lib/kanban";

type Message = {
  id: string;
  type: "user" | "assistant";
  content: string;
  timestamp: Date;
  boardUpdates?: string[];
};

type AIChatSidebarProps = {
  boardData: BoardData;
  boardId?: number;
  onBoardUpdate: () => void;
  isOpen: boolean;
  onToggle: () => void;
};

type BoardAction = NonNullable<api.ChatResponse["board_updates"]>[number];

function describeAction(action: BoardAction): string {
  switch (action.action) {
    case "create_card":
      return `Created: "${action.title}"`;
    case "move_card":
      return "Moved card to different column";
    case "delete_card":
      return "Deleted a card";
  }
}

export const AIChatSidebar = ({
  boardData,
  boardId,
  onBoardUpdate,
  isOpen,
  onToggle,
}: AIChatSidebarProps) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const loadHistory = useCallback(async () => {
    try {
      const history = await api.fetchChatHistory(boardId);
      const items = Array.isArray(history) ? history : [];
      setMessages(items.map((message) => ({
        id: `chat-${message.id}`,
        type: message.role as "user" | "assistant",
        content: message.content,
        timestamp: new Date(message.created_at),
      })));
    } catch {
      // ignore
    }
  }, [boardId]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  useEffect(() => {
    if (typeof window !== "undefined" && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  useEffect(() => {
    if (isOpen) inputRef.current?.focus();
  }, [isOpen]);

  const handleSendMessage = async () => {
    const trimmed = inputValue.trim();
    if (!trimmed || isLoading) return;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      type: "user",
      content: trimmed,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setInputValue("");
    setIsLoading(true);

    try {
      const response = await api.sendChatMessage(trimmed, boardData, boardId);
      const boardUpdates = response.board_updates?.map(describeAction) ?? [];

      setMessages((prev) => [...prev, {
        id: `assistant-${Date.now()}`,
        type: "assistant",
        content: response.response,
        timestamp: new Date(),
        boardUpdates: boardUpdates.length > 0 ? boardUpdates : undefined,
      }]);

      if (response.board_updates?.length) {
        await onBoardUpdate();
      }
    } catch (error) {
      console.error("Chat error:", error);
      setMessages((prev) => [...prev, {
        id: `error-${Date.now()}`,
        type: "assistant",
        content: "Sorry, I encountered an error. Please try again.",
        timestamp: new Date(),
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="flex h-full w-96 flex-col">
      <div className="shrink-0 flex items-center justify-between border-b border-[var(--stroke)] px-4 py-3">
        <div className="flex items-center gap-2">
          <svg className="h-4 w-4 text-[var(--primary-blue)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2z" />
          </svg>
          <h2 className="font-display text-sm font-semibold text-[var(--navy-dark)]">AI Assistant</h2>
        </div>
        <button
          onClick={onToggle}
          className="rounded-md p-1.5 text-[var(--gray-text)] transition hover:bg-[var(--surface)] hover:text-[var(--navy-dark)]"
          aria-label="Close AI assistant"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <div className="space-y-4">
          {messages.length === 0 && (
            <div className="rounded-xl bg-[var(--surface)] p-4 text-center">
              <p className="text-sm text-[var(--gray-text)]">
                I can help you manage your board — create, move, or delete cards.
              </p>
              <p className="mt-2 text-xs text-[var(--gray-text)]">
                Try: &ldquo;Create a task for reviewing the quarterly report&rdquo;
              </p>
            </div>
          )}

          {messages.map((message) => (
            <div key={message.id} className="space-y-2">
              <div className={`flex ${message.type === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                    message.type === "user"
                      ? "bg-[var(--primary-blue)] text-white"
                      : "bg-[var(--surface)] text-[var(--navy-dark)]"
                  }`}
                >
                  {message.content}
                </div>
              </div>

              {message.boardUpdates && message.boardUpdates.length > 0 && (
                <div className="ml-2 space-y-1">
                  {message.boardUpdates.map((update, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-2 rounded-lg bg-[var(--accent-yellow)]/10 px-3 py-1.5 text-xs text-[var(--navy-dark)]"
                    >
                      <svg className="h-3.5 w-3.5 shrink-0 text-[var(--accent-yellow)]" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      {update}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}

          {isLoading && (
            <div className="flex justify-start">
              <div className="flex items-center gap-2 rounded-2xl bg-[var(--surface)] px-4 py-3">
                <div className="flex space-x-1">
                  <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--primary-blue)]" />
                  <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--primary-blue)] [animation-delay:100ms]" />
                  <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--primary-blue)] [animation-delay:200ms]" />
                </div>
                <span className="text-xs text-[var(--gray-text)]">Thinking...</span>
              </div>
            </div>
          )}
        </div>
        <div ref={messagesEndRef} />
      </div>

      <div className="shrink-0 border-t border-[var(--stroke)] p-4">
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Ask me to manage your board..."
            className="flex-1 rounded-lg border border-[var(--stroke)] bg-[var(--surface)] px-3 py-2 text-sm placeholder-[var(--gray-text)] focus:border-[var(--primary-blue)] focus:outline-none"
            disabled={isLoading}
          />
          <button
            onClick={handleSendMessage}
            disabled={!inputValue.trim() || isLoading}
            aria-label="Send message"
            className="rounded-lg bg-[var(--secondary-purple)] px-3 py-2 text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
};
