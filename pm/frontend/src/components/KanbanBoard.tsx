"use client";

import { useMemo, useState, useCallback } from "react";
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
import type { BoardData } from "@/lib/kanban";

type KanbanBoardProps = {
  onLogout?: () => void;
};

export const KanbanBoard = ({ onLogout }: KanbanBoardProps) => {
  const { board, isLoading, error, addCard, updateCard, deleteCard, renameColumn, moveCard: moveBoardCard, retry, refetch } = useBoard();
  const [activeCardId, setActiveCardId] = useState<string | null>(null);
  const [delayedError, setDelayedError] = useState<string | null>(null);
  const [isChatOpen, setIsChatOpen] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    })
  );

  const cardsById = useMemo(() => board?.cards || {}, [board?.cards]);

  // Show error in a dismissible way
  const displayedError = delayedError || error;

  const handleDragStart = (event: DragStartEvent) => {
    setActiveCardId(event.active.id as string);
  };

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      setActiveCardId(null);

      if (!over || active.id === over.id || !board) {
        return;
      }

      // Find which column the card is being dropped into
      const cardId = active.id as string;
      const currentColumnId = board.columns.find((col) =>
        col.cardIds.includes(cardId)
      )?.id;
      const targetColumnId = over.id as string;
      const targetColumn = board.columns.find((col) => col.id === targetColumnId);

      // Determine if we're dropping on a card or a column
      const dropTarget = board.columns.find(
        (col) => col.id === targetColumnId || col.cardIds.includes(targetColumnId as string)
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
      addCard(columnId, title, details || "No details yet.").catch(() => {
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

  // Show loading state
  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[var(--surface)] to-white">
        <div className="text-center">
          <div className="mb-4 h-12 w-12 animate-spin rounded-full border-4 border-[var(--stroke)] border-t-[var(--primary-blue)]"></div>
          <p className="text-[var(--gray-text)]">Loading your board...</p>
        </div>
      </div>
    );
  }

  // Show error state
  if (error && !board) {
    return (
      <div className="relative overflow-hidden">
        <main className="relative mx-auto flex min-h-screen max-w-[1500px] flex-col items-center justify-center gap-4 px-6">
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
        </main>
      </div>
    );
  }

  if (!board) {
    return null;
  }

  return (
    <div className="relative overflow-hidden">
      <div className="pointer-events-none absolute left-0 top-0 h-[420px] w-[420px] -translate-x-1/3 -translate-y-1/3 rounded-full bg-[radial-gradient(circle,_rgba(32,157,215,0.25)_0%,_rgba(32,157,215,0.05)_55%,_transparent_70%)]" />
      <div className="pointer-events-none absolute bottom-0 right-0 h-[520px] w-[520px] translate-x-1/4 translate-y-1/4 rounded-full bg-[radial-gradient(circle,_rgba(117,57,145,0.18)_0%,_rgba(117,57,145,0.05)_55%,_transparent_75%)]" />

      {displayedError && (
        <div className="fixed top-4 right-4 z-50 flex items-center gap-3 rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-800">
          <svg className="h-5 w-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          {displayedError}
        </div>
      )}

      <div className="flex h-screen">
        {/* Main content */}
        <main className="flex-1 transition-all duration-300 ease-in-out">
          <div className="mx-auto flex min-h-screen max-w-[1500px] flex-col gap-10 px-6 pb-16 pt-12">
            <header className="flex flex-col gap-8 rounded-[32px] border border-[var(--stroke)] bg-white/80 p-8 shadow-[var(--shadow)] backdrop-blur transition-all duration-300 ease-in-out">
              <div className="flex flex-wrap items-start justify-between gap-6">
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-[0.35em] text-[var(--gray-text)]">
                    Single Board Kanban
                  </p>
                  <h1 className="mt-3 max-w-3xl break-words font-display text-4xl font-semibold text-[var(--navy-dark)]">
                    Kanban Studio
                  </h1>
                  <p className="mt-3 max-w-xl text-sm leading-6 text-[var(--gray-text)]">
                    Keep momentum visible. Rename columns, drag cards between stages,
                    and capture quick notes without getting buried in settings.
                  </p>
                </div>
                <div className="flex flex-col items-stretch gap-4 sm:flex-row sm:items-center">
                  <div className="rounded-2xl border border-[var(--stroke)] bg-[var(--surface)] px-5 py-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[var(--gray-text)]">
                      Focus
                    </p>
                    <p className="mt-2 text-lg font-semibold text-[var(--primary-blue)]">
                      One board. Five columns. Zero clutter.
                    </p>
                  </div>
                  {onLogout && (
                    <button
                      onClick={onLogout}
                      className="rounded-lg border border-[var(--stroke)] bg-white px-4 py-2 text-xs font-semibold uppercase tracking-wide text-[var(--gray-text)] transition hover:border-[var(--accent-yellow)] hover:text-[var(--navy-dark)]"
                      aria-label="Sign out"
                    >
                      Sign Out
                    </button>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-4">
                {board.columns.map((column) => (
                  <div
                    key={column.id}
                    className="flex items-center gap-2 rounded-full border border-[var(--stroke)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--navy-dark)]"
                  >
                    <span className="h-2 w-2 rounded-full bg-[var(--accent-yellow)]" />
                    {column.title}
                  </div>
                ))}
              </div>
            </header>

            <DndContext
              sensors={sensors}
              collisionDetection={closestCorners}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            >
              <section className="grid gap-6 lg:grid-cols-5">
                {board.columns.map((column) => (
                  <KanbanColumn
                    key={column.id}
                    column={column}
                    cards={column.cardIds.map((cardId) => board.cards[cardId])}
                    onRename={handleRenameColumn}
                    onAddCard={handleAddCard}
                    onDeleteCard={handleDeleteCard}
                  />
                ))}
              </section>
              <DragOverlay>
                {activeCard ? (
                  <div className="w-[260px]">
                    <KanbanCardPreview card={activeCard} />
                  </div>
                ) : null}
              </DragOverlay>
            </DndContext>
          </div>
        </main>

        {/* Chat Sidebar */}
        <AIChatSidebar
          boardData={board}
          onBoardUpdate={refetch}
          isOpen={isChatOpen}
          onToggle={() => setIsChatOpen(!isChatOpen)}
        />
      </div>
    </div>
  );
};
