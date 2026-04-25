"use client";

import { useState, useRef, useEffect, useCallback } from "react";
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
  onBoardUpdate: () => void;
  isOpen: boolean;
  onToggle: () => void;
};

export const AIChatSidebar = ({
  boardData,
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
      const history = await api.fetchChatHistory();
      const historyList = Array.isArray(history) ? history : [];
      setMessages(
        historyList.map((message) => ({
          id: `chat-${message.id}`,
          type: message.role as "user" | "assistant",
          content: message.content,
          timestamp: new Date(message.created_at),
        }))
      );
    } catch (error) {
      console.error("Failed to load chat history:", error);
    }
  }, []);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    // Only scroll in browser environment
    if (typeof window !== "undefined" && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  // Focus input when sidebar opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isLoading) return;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      type: "user",
      content: inputValue.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue("");
    setIsLoading(true);

    try {
      const response = await api.sendChatMessage(inputValue.trim(), boardData);

      const boardUpdates: string[] = [];
      if (response.board_updates?.length) {
        response.board_updates.forEach((action) => {
          switch (action.action) {
            case "create_card":
              boardUpdates.push(`Created: "${action.title}"`);
              break;
            case "move_card":
              boardUpdates.push(`Moved card to different column`);
              break;
            case "delete_card":
              boardUpdates.push(`Deleted a card`);
              break;
          }
        });
      }

      const assistantMessage: Message = {
        id: `assistant-${Date.now()}`,
        type: "assistant",
        content: response.response,
        timestamp: new Date(),
        boardUpdates: boardUpdates.length > 0 ? boardUpdates : undefined,
      };

      setMessages((prev) => [...prev, assistantMessage]);

      // Trigger board refresh if there were updates
      if (response.board_updates?.length) {
        await onBoardUpdate();
      }
    } catch (error) {
      console.error("Chat error:", error);
      const errorMessage: Message = {
        id: `error-${Date.now()}`,
        type: "assistant",
        content: "Sorry, I encountered an error. Please try again.",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
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

  if (!isOpen) {
    return (
      <button
        onClick={onToggle}
        className="fixed bottom-6 right-6 z-50 inline-flex h-14 w-14 items-center justify-center rounded-full border border-[var(--stroke)] bg-white/95 text-[var(--navy-dark)] shadow-lg transition duration-200 hover:bg-white"
        aria-label="Open AI assistant"
      >
        <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2z" />
        </svg>
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-end p-4 lg:items-end lg:justify-end" onClick={onToggle}>

      <div className="relative z-10 w-full max-w-md max-h-[85vh] overflow-hidden rounded-[32px] border border-[var(--stroke)] bg-white/95 shadow-[var(--shadow)] backdrop-blur" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--stroke)] p-4">
          <h2 className="font-display text-lg font-semibold text-[var(--navy-dark)]">
            AI Assistant
          </h2>
          <button
            onClick={onToggle}
            className="rounded-lg p-2 text-[var(--gray-text)] hover:bg-[var(--surface)] hover:text-[var(--navy-dark)]"
            aria-label="Close chat"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="space-y-4">
            {messages.length === 0 && (
              <div className="text-center text-[var(--gray-text)]">
                <p className="text-sm">
                  Hi! I'm your AI assistant. I can help you manage your kanban board by creating, moving, or deleting cards.
                </p>
                <p className="mt-2 text-xs">
                  Try: "Create a task for reviewing the quarterly report"
                </p>
              </div>
            )}

            {messages.map((message) => (
              <div key={message.id} className="space-y-2">
                <div
                  className={`flex ${
                    message.type === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm ${
                      message.type === "user"
                        ? "bg-[var(--primary-blue)] text-white"
                        : "bg-[var(--surface)] text-[var(--navy-dark)]"
                    }`}
                  >
                    {message.content}
                  </div>
                </div>

                {message.boardUpdates && message.boardUpdates.length > 0 && (
                  <div className="ml-4 space-y-1">
                    {message.boardUpdates.map((update, index) => (
                      <div
                        key={index}
                        className="flex items-center gap-2 rounded-lg bg-[var(--accent-yellow)]/10 px-3 py-2 text-xs text-[var(--navy-dark)]"
                      >
                        <svg className="h-4 w-4 text-[var(--accent-yellow)]" fill="currentColor" viewBox="0 0 20 20">
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
                    <div className="h-2 w-2 animate-bounce rounded-full bg-[var(--primary-blue)]"></div>
                    <div className="h-2 w-2 animate-bounce rounded-full bg-[var(--primary-blue)] animation-delay-100"></div>
                    <div className="h-2 w-2 animate-bounce rounded-full bg-[var(--primary-blue)] animation-delay-200"></div>
                  </div>
                  <span className="text-xs text-[var(--gray-text)]">AI is thinking...</span>
                </div>
              </div>
            )}
          </div>
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="border-t border-[var(--stroke)] p-4">
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
              className="rounded-lg bg-[var(--primary-purple)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--primary-purple)]/90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};