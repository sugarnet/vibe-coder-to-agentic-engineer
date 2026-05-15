import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import clsx from "clsx";
import { useEffect, useState } from "react";
import { KanbanCard } from "@/components/KanbanCard";
import { NewCardForm } from "@/components/NewCardForm";
import type * as api from "@/lib/api";
import type { Card, Column } from "@/lib/kanban";

const ACCENT_COLORS = ["#209dd7", "#ecad0a", "#753991", "#10b981", "#f97316"];

type KanbanColumnProps = {
  column: Column;
  cards: Card[];
  columnIndex: number;
  onRename: (columnId: string, title: string) => void;
  onAddCard: (columnId: string, title: string, details: string, priority?: string, dueDate?: string) => void;
  onDeleteCard: (columnId: string, cardId: string) => void;
  onUpdateCard?: (cardId: string, updates: api.CardUpdate) => void;
  onDeleteColumn?: (columnId: string) => void;
  canDelete?: boolean;
};

export const KanbanColumn = ({
  column,
  cards,
  columnIndex,
  onRename,
  onAddCard,
  onDeleteCard,
  onUpdateCard,
  onDeleteColumn,
  canDelete = true,
}: KanbanColumnProps) => {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });
  const [titleInput, setTitleInput] = useState(column.title);
  const [isFocused, setIsFocused] = useState(false);
  const accentColor = ACCENT_COLORS[columnIndex % ACCENT_COLORS.length];

  useEffect(() => {
    if (!isFocused) setTitleInput(column.title);
  }, [column.title, isFocused]);

  return (
    <section
      ref={setNodeRef}
      className={clsx(
        "group flex h-full flex-col rounded-2xl border border-[var(--stroke)] bg-[var(--surface-strong)] shadow-[var(--shadow)] transition",
        isOver && "ring-2 ring-[var(--accent-yellow)]",
      )}
      data-testid={`column-${column.id}`}
    >
      <div className="shrink-0 p-4 pb-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="h-1.5 w-8 rounded-full" style={{ backgroundColor: accentColor }} />
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--gray-text)]">
              {cards.length}
            </span>
          </div>
          {canDelete && onDeleteColumn && (
            <button
              onClick={() => onDeleteColumn(column.id)}
              className="rounded p-1 text-[var(--gray-text)] opacity-0 transition hover:bg-red-50 hover:text-red-500 group-hover:opacity-100"
              title="Delete column"
              aria-label="Delete column"
            >
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          )}
        </div>
        <input
          value={titleInput}
          onChange={(e) => setTitleInput(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => {
            setIsFocused(false);
            onRename(column.id, titleInput);
          }}
          className="mt-2 w-full bg-transparent font-display text-base font-semibold text-[var(--navy-dark)] outline-none"
          aria-label="Column title"
        />
      </div>

      <div className="flex-1 overflow-y-auto px-4">
        <SortableContext items={column.cardIds} strategy={verticalListSortingStrategy}>
          <div className="flex min-h-full flex-col gap-2 pb-2">
            {cards.map((card) => (
              <KanbanCard
                key={card.id}
                card={card}
                onDelete={(cardId) => onDeleteCard(column.id, cardId)}
                onUpdate={onUpdateCard}
              />
            ))}
            {cards.length === 0 && (
              <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-[var(--stroke)] text-center text-xs font-semibold uppercase tracking-[0.2em] text-[var(--gray-text)]">
                Drop here
              </div>
            )}
          </div>
        </SortableContext>
      </div>

      <div className="shrink-0 p-4 pt-2">
        <NewCardForm
          onAdd={(title, details, priority, dueDate) =>
            onAddCard(column.id, title, details, priority, dueDate)
          }
        />
      </div>
    </section>
  );
};
