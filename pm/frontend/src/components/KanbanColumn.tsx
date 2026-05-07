import clsx from "clsx";
import { useState, useEffect } from "react";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import type { Card, Column } from "@/lib/kanban";
import { KanbanCard } from "@/components/KanbanCard";
import { NewCardForm } from "@/components/NewCardForm";

const ACCENT_COLORS = ["#209dd7", "#ecad0a", "#753991", "#10b981", "#f97316"];

type KanbanColumnProps = {
  column: Column;
  cards: Card[];
  columnIndex: number;
  onRename: (columnId: string, title: string) => void;
  onAddCard: (columnId: string, title: string, details: string) => void;
  onDeleteCard: (columnId: string, cardId: string) => void;
};

export const KanbanColumn = ({
  column,
  cards,
  columnIndex,
  onRename,
  onAddCard,
  onDeleteCard,
}: KanbanColumnProps) => {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });
  const [titleInput, setTitleInput] = useState(column.title);
  const [isFocused, setIsFocused] = useState(false);
  const accentColor = ACCENT_COLORS[columnIndex % ACCENT_COLORS.length];

  useEffect(() => {
    if (!isFocused) {
      setTitleInput(column.title);
    }
  }, [column.title, isFocused]);

  return (
    <section
      ref={setNodeRef}
      className={clsx(
        "flex h-full flex-col rounded-2xl border border-[var(--stroke)] bg-[var(--surface-strong)] shadow-[var(--shadow)] transition",
        isOver && "ring-2 ring-[var(--accent-yellow)]"
      )}
      data-testid={`column-${column.id}`}
    >
      {/* Column header */}
      <div className="shrink-0 p-4 pb-3">
        <div className="flex items-center gap-2">
          <div className="h-1.5 w-8 rounded-full" style={{ backgroundColor: accentColor }} />
          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--gray-text)]">
            {cards.length}
          </span>
        </div>
        <input
          value={titleInput}
          onChange={(event) => setTitleInput(event.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => {
            setIsFocused(false);
            onRename(column.id, titleInput);
          }}
          className="mt-2 w-full bg-transparent font-display text-base font-semibold text-[var(--navy-dark)] outline-none"
          aria-label="Column title"
        />
      </div>

      {/* Cards — scrollable */}
      <div className="flex-1 overflow-y-auto px-4">
        <SortableContext items={column.cardIds} strategy={verticalListSortingStrategy}>
          <div className="flex min-h-full flex-col gap-2 pb-2">
            {cards.map((card) => (
              <KanbanCard
                key={card.id}
                card={card}
                onDelete={(cardId) => onDeleteCard(column.id, cardId)}
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

      {/* New card form */}
      <div className="shrink-0 p-4 pt-2">
        <NewCardForm onAdd={(title, details) => onAddCard(column.id, title, details)} />
      </div>
    </section>
  );
};
