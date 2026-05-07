"use client";

import { useMemo, useState, useCallback } from "react";
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
import { useBoard } from "@/lib/useBoard";

type KanbanBoardProps = {
  onLogout?: () => void;
};

export const KanbanBoard = ({ onLogout }: KanbanBoardProps) => {
  const { board, isLoading, error, addCard, deleteCard, renameColumn, moveCard: moveBoardCard, retry, refetch } = useBoard();
  const [activeCardId, setActiveCardId] = useState<string | null>(null);
  const [delayedError, setDelayedError] = useState<string | null>(null);
  const [isChatOpen, setIsChatOpen] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    })
  );

  const cardsById = useMemo(() => board?.cards || {}, [board?.cards]);
  const displayedError = delayedError || error;

  const handleDragStart = (event: DragStartEvent) => {
    setActiveCardId(event.active.id as string);
  };

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      setActiveCardId(null);

      if (!over || active.id === over.id || !board) return;

      const cardId = active.id as string;
      const currentColumnId = board.columns.find((col) =>
        col.cardIds.includes(cardId)
      )?.id;
      const dropTarget = board.columns.find(
        (col) =>
          col.id === (over.id as string) ||
          col.cardIds.includes(over.id as string)
      );

      if (!currentColumnId || !dropTarget) return;

      moveBoardCard(cardId, currentColumnId, dropTarget.id).catch(() => {
        setDelayedError("Failed to move card");
        setTimeout(() => setDelayedError(null), 4000);
      });
    },
    [board, moveBoardCard]
  );

  const handleRenameColumn = useCallback(
    (columnId: string, title: string) => {
      renameColumn(columnId, title).catch(() => {
        setDelayedError("Failed to rename column");
        setTimeout(() => setDelayedError(null), 4000);
      });
    },
    [renameColumn]
  );

  const handleAddCard = useCallback(
    (columnId: string, title: string, details: string) => {
      addCard(columnId, title, details).catch(() => {
        setDelayedError("Failed to add card");
        setTimeout(() => setDelayedError(null), 4000);
      });
    },
    [addCard]
  );

  const handleDeleteCard = useCallback(
    (columnId: string, cardId: string) => {
      deleteCard(cardId).catch(() => {
        setDelayedError("Failed to delete card");
        setTimeout(() => setDelayedError(null), 4000);
      });
    },
    [deleteCard]
  );

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
        {/* Columns area */}
        <main className="min-w-0 flex-1 overflow-y-hidden overflow-x-auto p-5">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <div
              className="grid h-full gap-4"
              style={{ gridTemplateColumns: `repeat(${board.columns.length}, minmax(200px, 1fr))` }}
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
                />
              ))}
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

        {/* Sidebar panel — slides in by claiming width */}
        <div
          className={clsx(
            "shrink-0 overflow-hidden border-l border-[var(--stroke)] bg-white transition-all duration-300 ease-in-out",
            isChatOpen ? "w-96" : "w-0"
          )}
        >
          <AIChatSidebar
            boardData={board}
            onBoardUpdate={refetch}
            isOpen={isChatOpen}
            onToggle={() => setIsChatOpen(false)}
          />
        </div>
      </div>
    </div>
  );
};
