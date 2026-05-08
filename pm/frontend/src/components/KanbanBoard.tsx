"use client";

import { useMemo, useState, useCallback, useRef } from "react";
import clsx from "clsx";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { KanbanColumn } from "@/components/KanbanColumn";
import { KanbanCardPreview } from "@/components/KanbanCardPreview";
import { AIChatSidebar } from "@/components/AIChatSidebar";
import { BoardSelector } from "@/components/BoardSelector";
import { useBoard } from "@/lib/useBoard";
import * as api from "@/lib/api";

type KanbanBoardProps = {
  onLogout?: () => void;
};

export const KanbanBoard = ({ onLogout }: KanbanBoardProps) => {
  const {
    board,
    boardId,
    boardTitle,
    isLoading,
    error,
    addCard,
    deleteCard,
    renameColumn,
    addColumn,
    deleteColumn,
    moveCard: moveBoardCard,
    retry,
    refetch,
    loadBoardById,
  } = useBoard();

  const [activeCardId, setActiveCardId] = useState<string | null>(null);
  const [delayedError, setDelayedError] = useState<string | null>(null);
  const [isChatOpen, setIsChatOpen] = useState(false);

  // Board title editing
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleInput, setTitleInput] = useState("");
  const titleInputRef = useRef<HTMLInputElement>(null);

  // Add column
  const [showAddColumn, setShowAddColumn] = useState(false);
  const [newColumnTitle, setNewColumnTitle] = useState("");

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  const cardsById = useMemo(() => board?.cards || {}, [board?.cards]);
  const displayedError = delayedError || error;

  const showError = useCallback((msg: string) => {
    setDelayedError(msg);
    setTimeout(() => setDelayedError(null), 4000);
  }, []);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveCardId(event.active.id as string);
  };

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      setActiveCardId(null);
      if (!over || active.id === over.id || !board) return;

      const cardId = active.id as string;
      const currentColumnId = board.columns.find((col) => col.cardIds.includes(cardId))?.id;
      const dropTarget = board.columns.find(
        (col) => col.id === (over.id as string) || col.cardIds.includes(over.id as string)
      );
      if (!currentColumnId || !dropTarget) return;

      moveBoardCard(cardId, currentColumnId, dropTarget.id).catch(() => showError("Failed to move card"));
    },
    [board, moveBoardCard, showError]
  );

  const handleRenameColumn = useCallback(
    (columnId: string, title: string) => {
      renameColumn(columnId, title).catch(() => showError("Failed to rename column"));
    },
    [renameColumn, showError]
  );

  const handleAddCard = useCallback(
    (columnId: string, title: string, details: string) => {
      addCard(columnId, title, details).catch(() => showError("Failed to add card"));
    },
    [addCard, showError]
  );

  const handleDeleteCard = useCallback(
    (_columnId: string, cardId: string) => {
      deleteCard(cardId).catch(() => showError("Failed to delete card"));
    },
    [deleteCard, showError]
  );

  const handleDeleteColumn = useCallback(
    (columnId: string) => {
      deleteColumn(columnId).catch(() => showError("Failed to delete column"));
    },
    [deleteColumn, showError]
  );

  const startEditTitle = () => {
    setTitleInput(boardTitle);
    setEditingTitle(true);
    setTimeout(() => titleInputRef.current?.select(), 0);
  };

  const commitTitleEdit = async () => {
    setEditingTitle(false);
    const trimmed = titleInput.trim();
    if (!trimmed || trimmed === boardTitle || !boardId) return;
    try {
      await api.updateBoardTitle(boardId, trimmed);
      await refetch();
    } catch {
      showError("Failed to rename board");
    }
  };

  const handleAddColumn = async () => {
    const title = newColumnTitle.trim();
    if (!title) return;
    try {
      await addColumn(title);
      setNewColumnTitle("");
      setShowAddColumn(false);
    } catch {
      showError("Failed to add column");
    }
  };

  const activeCard = activeCardId ? cardsById[activeCardId] : null;

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[var(--surface)]">
        <div className="text-center">
          <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-[var(--stroke)] border-t-[var(--primary-blue)]" />
          <p className="text-sm text-[var(--gray-text)]">Loading your board...</p>
        </div>
      </div>
    );
  }

  if (error && !board) {
    return (
      <div className="flex h-screen items-center justify-center bg-[var(--surface)]">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-8 text-center">
          <h2 className="text-lg font-semibold text-red-900">Failed to load board</h2>
          <p className="mt-2 text-sm text-red-700">{error}</p>
          <button
            onClick={retry}
            className="mt-4 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  if (!board) return null;

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[var(--surface)]">
      {/* Background blobs */}
      <div className="pointer-events-none fixed left-0 top-0 h-[420px] w-[420px] -translate-x-1/3 -translate-y-1/3 rounded-full bg-[radial-gradient(circle,_rgba(32,157,215,0.14)_0%,_transparent_70%)]" />
      <div className="pointer-events-none fixed bottom-0 right-0 h-[420px] w-[420px] translate-x-1/4 translate-y-1/4 rounded-full bg-[radial-gradient(circle,_rgba(117,57,145,0.12)_0%,_transparent_75%)]" />

      {/* Error toast */}
      {displayedError && (
        <div className="fixed right-4 top-4 z-50 flex items-center gap-3 rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-800 shadow">
          <svg className="h-5 w-5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          {displayedError}
        </div>
      )}

      {/* Top navigation bar */}
      <header className="relative z-10 shrink-0 border-b border-[var(--stroke)] bg-white/90 backdrop-blur-sm">
        <div className="flex items-center justify-between gap-4 px-6 py-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <div className="h-5 w-1 rounded-full bg-[var(--accent-yellow)]" />
              <div className="h-5 w-1 rounded-full bg-[var(--primary-blue)]" />
            </div>
            <span className="font-display text-base font-semibold text-[var(--navy-dark)]">
              Kanban Studio
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Board selector */}
            {boardId && (
              <BoardSelector
                currentBoardId={boardId}
                currentBoardTitle={boardTitle}
                onSelectBoard={(id) => loadBoardById(id)}
              />
            )}

            {/* Editable board title */}
            {editingTitle ? (
              <input
                ref={titleInputRef}
                value={titleInput}
                onChange={(e) => setTitleInput(e.target.value)}
                onBlur={commitTitleEdit}
                onKeyDown={(e) => { if (e.key === "Enter") commitTitleEdit(); if (e.key === "Escape") setEditingTitle(false); }}
                className="rounded-lg border border-[var(--primary-blue)] px-2 py-1 text-xs font-semibold text-[var(--navy-dark)] outline-none"
                style={{ width: Math.max(80, titleInput.length * 7) }}
              />
            ) : (
              <button
                onClick={startEditTitle}
                className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-semibold text-[var(--navy-dark)] transition hover:bg-[var(--stroke)]"
                title="Rename board"
              >
                <span>{boardTitle}</span>
                <svg className="h-3 w-3 text-[var(--gray-text)]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
              </button>
            )}

            <button
              onClick={() => setIsChatOpen(!isChatOpen)}
              className={clsx(
                "flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-semibold transition",
                isChatOpen
                  ? "border-[var(--primary-blue)] bg-[var(--primary-blue)] text-white"
                  : "border-[var(--stroke)] bg-white text-[var(--navy-dark)] hover:border-[var(--primary-blue)] hover:text-[var(--primary-blue)]"
              )}
              aria-label="Toggle AI assistant"
            >
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2z" />
              </svg>
              <span>AI Assistant</span>
            </button>

            {onLogout && (
              <button
                onClick={onLogout}
                className="flex items-center gap-2 rounded-lg border border-[var(--stroke)] bg-white px-3 py-1.5 text-xs font-semibold text-[var(--gray-text)] transition hover:text-[var(--navy-dark)]"
                aria-label="Sign out"
              >
                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                <span>Sign Out</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Board + sidebar */}
      <div className="relative flex min-h-0 flex-1">
        <main className="min-w-0 flex-1 overflow-y-hidden overflow-x-auto p-5">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <div
              className="flex h-full gap-4"
              style={{ minWidth: `${board.columns.length * 220 + 160}px` }}
            >
              {board.columns.map((column, index) => (
                <KanbanColumn
                  key={column.id}
                  column={column}
                  cards={column.cardIds.map((cardId) => board.cards[cardId])}
                  columnIndex={index}
                  onRename={handleRenameColumn}
                  onAddCard={handleAddCard}
                  onDeleteCard={handleDeleteCard}
                  onDeleteColumn={handleDeleteColumn}
                  canDelete={board.columns.length > 1}
                />
              ))}

              {/* Add column button */}
              <div className="flex shrink-0 flex-col" style={{ width: 200 }}>
                {showAddColumn ? (
                  <div className="rounded-xl border border-[var(--stroke)] bg-white p-3">
                    <input
                      autoFocus
                      type="text"
                      value={newColumnTitle}
                      onChange={(e) => setNewColumnTitle(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") handleAddColumn(); if (e.key === "Escape") setShowAddColumn(false); }}
                      placeholder="Column name"
                      className="w-full rounded-lg border border-[var(--stroke)] px-3 py-2 text-sm outline-none focus:border-[var(--primary-blue)]"
                    />
                    <div className="mt-2 flex gap-2">
                      <button
                        onClick={handleAddColumn}
                        disabled={!newColumnTitle.trim()}
                        className="flex-1 rounded-lg bg-[var(--primary-blue)] py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                      >
                        Add
                      </button>
                      <button
                        onClick={() => { setShowAddColumn(false); setNewColumnTitle(""); }}
                        className="flex-1 rounded-lg border border-[var(--stroke)] py-1.5 text-xs text-[var(--gray-text)]"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowAddColumn(true)}
                    className="flex h-full max-h-24 items-center justify-center gap-2 rounded-xl border-2 border-dashed border-[var(--stroke)] text-sm text-[var(--gray-text)] transition hover:border-[var(--primary-blue)] hover:text-[var(--primary-blue)]"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                    </svg>
                    Add column
                  </button>
                )}
              </div>
            </div>

            <DragOverlay>
              {activeCard ? (
                <div className="w-[220px]">
                  <KanbanCardPreview card={activeCard} />
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        </main>

        {/* AI Sidebar */}
        <div
          className={clsx(
            "shrink-0 overflow-hidden border-l border-[var(--stroke)] bg-white transition-all duration-300 ease-in-out",
            isChatOpen ? "w-96" : "w-0"
          )}
        >
          <AIChatSidebar
            boardData={board}
            boardId={boardId ?? undefined}
            onBoardUpdate={refetch}
            isOpen={isChatOpen}
            onToggle={() => setIsChatOpen(false)}
          />
        </div>
      </div>
    </div>
  );
};
