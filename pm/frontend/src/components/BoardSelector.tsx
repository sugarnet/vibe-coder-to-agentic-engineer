"use client";

import { useEffect, useRef, useState } from "react";
import * as api from "@/lib/api";

type Props = {
  currentBoardId: number | null;
  currentBoardTitle: string;
  onSelectBoard: (boardId: number) => void;
};

export const BoardSelector = ({ currentBoardId, currentBoardTitle, onSelectBoard }: Props) => {
  const [open, setOpen] = useState(false);
  const [boards, setBoards] = useState<api.BoardSummary[]>([]);
  const [newTitle, setNewTitle] = useState("");
  const [creating, setCreating] = useState(false);
  const [showInput, setShowInput] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    api.fetchBoards().then(setBoards).catch(() => setBoards([]));
  }, [open]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setShowInput(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleCreate = async () => {
    const title = newTitle.trim();
    if (!title) return;
    setCreating(true);
    try {
      const board = await api.createBoard({ title });
      setBoards((prev) => [...prev, board]);
      setNewTitle("");
      setShowInput(false);
      onSelectBoard(board.id);
      setOpen(false);
    } catch {
      // ignore
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (e: React.MouseEvent, boardId: number) => {
    e.stopPropagation();
    try {
      await api.deleteBoard(boardId);
      const updated = boards.filter((b) => b.id !== boardId);
      setBoards(updated);
      if (boardId === currentBoardId && updated.length > 0) {
        onSelectBoard(updated[0].id);
        setOpen(false);
      }
    } catch {
      // ignore - probably last board
    }
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 rounded-lg border border-[var(--stroke)] bg-white px-3 py-1.5 text-xs font-semibold text-[var(--navy-dark)] transition hover:border-[var(--primary-blue)] hover:text-[var(--primary-blue)]"
        title="Switch board"
      >
        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
        </svg>
        <span className="max-w-[120px] truncate">{currentBoardTitle || "Boards"}</span>
        <svg className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-56 rounded-xl border border-[var(--stroke)] bg-white shadow-lg">
          <div className="max-h-48 overflow-y-auto py-1">
            {boards.map((board) => (
              <div
                key={board.id}
                onClick={() => { onSelectBoard(board.id); setOpen(false); }}
                className={`group flex cursor-pointer items-center justify-between px-3 py-2 text-sm transition hover:bg-blue-50 ${board.id === currentBoardId ? "font-semibold text-[var(--primary-blue)]" : "text-[var(--navy-dark)]"}`}
              >
                <span className="truncate">{board.title}</span>
                {board.id === currentBoardId ? (
                  <svg className="h-3.5 w-3.5 shrink-0 text-[var(--primary-blue)]" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                ) : (
                  <button
                    onClick={(e) => handleDelete(e, board.id)}
                    className="invisible shrink-0 rounded p-0.5 text-red-400 hover:bg-red-50 hover:text-red-600 group-hover:visible"
                    title="Delete board"
                  >
                    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                )}
              </div>
            ))}
          </div>

          <div className="border-t border-[var(--stroke)] p-2">
            {showInput ? (
              <div className="flex gap-1">
                <input
                  autoFocus
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); if (e.key === "Escape") setShowInput(false); }}
                  placeholder="Board name"
                  className="min-w-0 flex-1 rounded border border-[var(--stroke)] px-2 py-1 text-xs outline-none focus:border-[var(--primary-blue)]"
                />
                <button
                  onClick={handleCreate}
                  disabled={creating || !newTitle.trim()}
                  className="rounded bg-[var(--primary-blue)] px-2 py-1 text-xs font-semibold text-white disabled:opacity-50"
                >
                  {creating ? "..." : "Add"}
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowInput(true)}
                className="flex w-full items-center gap-1.5 rounded px-2 py-1.5 text-xs text-[var(--gray-text)] transition hover:bg-blue-50 hover:text-[var(--primary-blue)]"
              >
                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                New board
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
