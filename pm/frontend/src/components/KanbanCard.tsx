import { useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import clsx from "clsx";
import type { Card } from "@/lib/kanban";
import * as api from "@/lib/api";

type KanbanCardProps = {
  card: Card;
  onDelete: (cardId: string) => void;
  onUpdate?: (cardId: string, updates: api.CardUpdate) => void;
};

const PRIORITY_STYLES: Record<string, { label: string; className: string }> = {
  high: { label: "High", className: "bg-red-100 text-red-700" },
  medium: { label: "Med", className: "bg-yellow-100 text-yellow-700" },
  low: { label: "Low", className: "bg-green-100 text-green-600" },
};

function formatDueDate(dateStr: string): { text: string; overdue: boolean } {
  const due = new Date(dateStr + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const overdue = due < today;
  const diff = Math.round((due.getTime() - today.getTime()) / 86400000);
  let text: string;
  if (diff === 0) text = "Today";
  else if (diff === 1) text = "Tomorrow";
  else if (diff === -1) text = "Yesterday";
  else if (diff > 0 && diff <= 7) text = `In ${diff}d`;
  else text = due.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  return { text, overdue };
}

export const KanbanCard = ({ card, onDelete, onUpdate }: KanbanCardProps) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: card.id });

  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(card.title);
  const [editDetails, setEditDetails] = useState(card.details || "");
  const [editPriority, setEditPriority] = useState<string>(card.priority || "");
  const [editDueDate, setEditDueDate] = useState(card.due_date || "");
  const [saving, setSaving] = useState(false);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const dueInfo = card.due_date ? formatDueDate(card.due_date) : null;
  const priority = card.priority ? PRIORITY_STYLES[card.priority] : null;

  const handleSave = async () => {
    if (!editTitle.trim() || !onUpdate) { setEditing(false); return; }
    setSaving(true);
    try {
      await onUpdate(card.id, {
        title: editTitle.trim(),
        details: editDetails.trim() || undefined,
        priority: (editPriority as "low" | "medium" | "high") || null,
        due_date: editDueDate || null,
      });
    } finally {
      setSaving(false);
      setEditing(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") { setEditing(false); resetEdit(); }
  };

  const resetEdit = () => {
    setEditTitle(card.title);
    setEditDetails(card.details || "");
    setEditPriority(card.priority || "");
    setEditDueDate(card.due_date || "");
  };

  if (editing) {
    return (
      <article
        className="rounded-xl border border-[var(--primary-blue)] bg-white px-3 py-3 shadow-[0_4px_12px_rgba(3,33,71,0.1)]"
        onKeyDown={handleKeyDown}
      >
        <input
          autoFocus
          value={editTitle}
          onChange={(e) => setEditTitle(e.target.value)}
          className="w-full bg-transparent font-display text-sm font-semibold text-[var(--navy-dark)] outline-none"
          placeholder="Card title"
        />
        <textarea
          value={editDetails}
          onChange={(e) => setEditDetails(e.target.value)}
          placeholder="Details (optional)"
          rows={2}
          className="mt-1.5 w-full resize-none bg-transparent text-xs text-[var(--gray-text)] outline-none"
        />
        <div className="mt-2 flex items-center gap-2">
          <select
            value={editPriority}
            onChange={(e) => setEditPriority(e.target.value)}
            className="flex-1 rounded-lg border border-[var(--stroke)] bg-white px-2 py-1 text-xs outline-none"
          >
            <option value="">No priority</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
          <input
            type="date"
            value={editDueDate}
            onChange={(e) => setEditDueDate(e.target.value)}
            className="flex-1 rounded-lg border border-[var(--stroke)] bg-white px-2 py-1 text-xs outline-none"
          />
        </div>
        <div className="mt-2.5 flex gap-2">
          <button
            onClick={handleSave}
            disabled={saving || !editTitle.trim()}
            className="flex-1 rounded-lg bg-[var(--primary-blue)] py-1.5 text-xs font-semibold text-white disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save"}
          </button>
          <button
            onClick={() => { setEditing(false); resetEdit(); }}
            className="flex-1 rounded-lg border border-[var(--stroke)] py-1.5 text-xs text-[var(--gray-text)]"
          >
            Cancel
          </button>
        </div>
      </article>
    );
  }

  return (
    <article
      ref={setNodeRef}
      style={style}
      className={clsx(
        "group relative rounded-xl border border-transparent bg-white px-4 py-3",
        "shadow-[0_4px_12px_rgba(3,33,71,0.06)] hover:shadow-[0_6px_20px_rgba(3,33,71,0.1)]",
        "transition-all duration-150",
        isDragging && "opacity-60 shadow-[0_18px_32px_rgba(3,33,71,0.16)]"
      )}
      {...attributes}
      {...listeners}
      data-testid={`card-${card.id}`}
    >
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <h4 className="font-display text-sm font-semibold leading-snug text-[var(--navy-dark)]">
            {card.title}
          </h4>
          {card.details && (
            <p className="mt-1.5 line-clamp-2 text-xs leading-5 text-[var(--gray-text)]">
              {card.details}
            </p>
          )}
          {/* Priority + due date row */}
          {(priority || dueInfo) && (
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {priority && (
                <span className={clsx("rounded px-1.5 py-0.5 text-[10px] font-semibold", priority.className)}>
                  {priority.label}
                </span>
              )}
              {dueInfo && (
                <span className={clsx("flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-semibold", dueInfo.overdue ? "bg-red-100 text-red-700" : "bg-blue-50 text-blue-600")}>
                  <svg className="h-2.5 w-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  {dueInfo.text}
                </span>
              )}
            </div>
          )}
        </div>
        <div className="flex shrink-0 flex-col gap-1">
          {onUpdate && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setEditing(true); }}
              className="rounded-md p-1 text-[var(--gray-text)] opacity-0 transition-all group-hover:opacity-100 hover:bg-blue-50 hover:text-blue-500"
              aria-label={`Edit ${card.title}`}
            >
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
            </button>
          )}
          <button
            type="button"
            onClick={() => onDelete(card.id)}
            className="rounded-md p-1 text-[var(--gray-text)] opacity-0 transition-all group-hover:opacity-100 hover:bg-red-50 hover:text-red-500"
            aria-label={`Delete ${card.title}`}
          >
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    </article>
  );
};
