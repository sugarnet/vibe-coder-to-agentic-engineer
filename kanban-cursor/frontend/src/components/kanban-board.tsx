"use client";

import {
  closestCorners,
  DndContext,
  DragOverlay,
  PointerSensor,
  type DragEndEvent,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { useMemo, useState, type FormEvent } from "react";
import {
  BOARD_TITLE,
  addCardToColumn,
  createInitialColumns,
  deleteCardFromColumn,
  editCardInColumn,
  moveCardBetweenColumns,
  renameColumn,
} from "@/lib/kanban";
import { type Card, type Column } from "@/types/kanban";

type AddCardFormState = {
  title: string;
  details: string;
};

const EmptyForm: AddCardFormState = { title: "", details: "" };

function DraggableCard({
  card,
  columnId,
  onDelete,
  onEdit,
}: {
  card: Card;
  columnId: string;
  onDelete: (columnId: string, cardId: string) => void;
  onEdit: (columnId: string, cardId: string, title: string, details: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: card.id,
      data: { type: "card", columnId },
    });
  const [isEditing, setIsEditing] = useState(false);
  const [draftTitle, setDraftTitle] = useState(card.title);
  const [draftDetails, setDraftDetails] = useState(card.details);

  const style = {
    transform: CSS.Translate.toString(transform),
    transition: isDragging ? "none" : "transform 140ms ease",
  };

  return (
    <article
      ref={setNodeRef}
      style={style}
      className="rounded-xl border border-[#ecad0a]/30 bg-white p-4 shadow-sm transition hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="grow">
          {isEditing ? (
            <div className="space-y-2">
              <input
                value={draftTitle}
                onChange={(event) => setDraftTitle(event.target.value)}
                className="w-full rounded-md border border-[#209dd7]/30 px-2 py-1 text-sm text-[#032147] outline-none focus:border-[#ecad0a]"
              />
              <textarea
                value={draftDetails}
                onChange={(event) => setDraftDetails(event.target.value)}
                className="h-20 w-full resize-none rounded-md border border-[#209dd7]/30 px-2 py-1 text-sm text-[#032147] outline-none focus:border-[#ecad0a]"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  className="rounded-md bg-[#753991] px-2 py-1 text-xs font-medium text-white"
                  onClick={() => {
                    const title = draftTitle.trim();
                    const details = draftDetails.trim();
                    if (!title || !details) {
                      return;
                    }
                    onEdit(columnId, card.id, title, details);
                    setIsEditing(false);
                  }}
                >
                  Guardar
                </button>
                <button
                  type="button"
                  className="rounded-md border border-[#888888]/40 px-2 py-1 text-xs font-medium text-[#888888]"
                  onClick={() => {
                    setDraftTitle(card.title);
                    setDraftDetails(card.details);
                    setIsEditing(false);
                  }}
                >
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <>
              <h3 className="text-sm font-semibold text-[#032147]">{card.title}</h3>
              <p className="mt-1 text-sm text-[#888888]">{card.details}</p>
            </>
          )}
        </div>
        <div className="flex flex-col gap-1">
          <button
            type="button"
            className={`rounded-md border border-[#209dd7]/30 px-2 py-1 text-xs font-medium text-[#209dd7] ${isDragging ? "cursor-grabbing" : "cursor-grab"}`}
            {...listeners}
            {...attributes}
            aria-label={`Mover tarjeta ${card.title}`}
          >
            Mover
          </button>
          {!isEditing && (
            <button
              type="button"
              onClick={() => {
                setDraftTitle(card.title);
                setDraftDetails(card.details);
                setIsEditing(true);
              }}
              className="rounded-md border border-[#032147]/20 px-2 py-1 text-xs font-medium text-[#032147] hover:bg-[#032147] hover:text-white"
              aria-label={`Editar tarjeta ${card.title}`}
            >
              Editar
            </button>
          )}
          <button
            type="button"
            onClick={() => onDelete(columnId, card.id)}
            className="rounded-md border border-[#753991]/30 px-2 py-1 text-xs font-medium text-[#753991] hover:bg-[#753991] hover:text-white"
            aria-label={`Eliminar tarjeta ${card.title}`}
          >
            Eliminar
          </button>
        </div>
      </div>
    </article>
  );
}

function ColumnCard({
  column,
  formState,
  onDeleteCard,
  onRename,
  onFormStateChange,
  onAddCard,
  onEditCard,
}: {
  column: Column;
  formState: AddCardFormState;
  onDeleteCard: (columnId: string, cardId: string) => void;
  onRename: (columnId: string, value: string) => void;
  onFormStateChange: (columnId: string, value: AddCardFormState) => void;
  onAddCard: (columnId: string) => void;
  onEditCard: (columnId: string, cardId: string, title: string, details: string) => void;
}) {
  const { isOver, setNodeRef } = useDroppable({
    id: column.id,
    data: { type: "column" },
  });

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onAddCard(column.id);
  };

  return (
    <section
      ref={setNodeRef}
      className={`flex min-h-[450px] min-w-[280px] flex-col rounded-2xl border p-4 ${
        isOver ? "border-[#209dd7] bg-[#209dd7]/10" : "border-[#209dd7]/20 bg-white/80"
      }`}
    >
      <input
        value={column.name}
        onChange={(event) => onRename(column.id, event.target.value)}
        className="rounded-md border border-transparent bg-transparent px-1 py-1 text-lg font-semibold text-[#032147] outline-none focus:border-[#ecad0a]"
        aria-label={`Nombre de columna ${column.name}`}
      />

      <div className="mt-3 flex grow flex-col gap-3">
        {column.cards.map((card) => (
          <DraggableCard
            key={card.id}
            card={card}
            columnId={column.id}
            onDelete={onDeleteCard}
            onEdit={onEditCard}
          />
        ))}
      </div>

      <form className="mt-4 space-y-2" onSubmit={handleSubmit}>
        <input
          value={formState.title}
          onChange={(event) =>
            onFormStateChange(column.id, { ...formState, title: event.target.value })
          }
          placeholder="Titulo"
          data-testid={`add-title-${column.id}`}
          className="w-full rounded-md border border-[#209dd7]/30 bg-white px-3 py-2 text-sm text-[#032147] outline-none focus:border-[#ecad0a]"
        />
        <textarea
          value={formState.details}
          onChange={(event) =>
            onFormStateChange(column.id, { ...formState, details: event.target.value })
          }
          placeholder="Detalle"
          data-testid={`add-details-${column.id}`}
          className="h-20 w-full resize-none rounded-md border border-[#209dd7]/30 bg-white px-3 py-2 text-sm text-[#032147] outline-none focus:border-[#ecad0a]"
        />
        <button
          type="submit"
          data-testid={`add-button-${column.id}`}
          className="w-full rounded-md bg-[#753991] px-3 py-2 text-sm font-medium text-white transition hover:brightness-110"
        >
          Agregar tarjeta
        </button>
      </form>
    </section>
  );
}

export function KanbanBoard() {
  const [columns, setColumns] = useState<Column[]>(createInitialColumns);
  const [formsByColumn, setFormsByColumn] = useState<Record<string, AddCardFormState>>({});
  const [activeCard, setActiveCard] = useState<Card | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
  );

  const forms = useMemo(() => {
    const initial: Record<string, AddCardFormState> = {};
    for (const column of columns) {
      initial[column.id] = formsByColumn[column.id] ?? EmptyForm;
    }
    return initial;
  }, [columns, formsByColumn]);

  const onDragEnd = (event: DragEndEvent) => {
    setActiveCard(null);
    const sourceCardId = String(event.active.id);
    const targetColumnId = event.over ? String(event.over.id) : null;
    if (!targetColumnId) {
      return;
    }
    setColumns((current) => moveCardBetweenColumns(current, sourceCardId, targetColumnId));
  };

  const handleDeleteCard = (columnId: string, cardId: string) => {
    setColumns((current) => deleteCardFromColumn(current, columnId, cardId));
  };

  const handleColumnRename = (columnId: string, value: string) => {
    setColumns((current) => renameColumn(current, columnId, value));
  };

  const handleFormChange = (columnId: string, value: AddCardFormState) => {
    setFormsByColumn((current) => ({ ...current, [columnId]: value }));
  };

  const handleAddCard = (columnId: string) => {
    const value = forms[columnId];
    const title = value.title.trim();
    const details = value.details.trim();
    if (!title || !details) {
      return;
    }

    setColumns((current) => addCardToColumn(current, columnId, title, details));
    setFormsByColumn((current) => ({ ...current, [columnId]: EmptyForm }));
  };

  const handleEditCard = (
    columnId: string,
    cardId: string,
    title: string,
    details: string,
  ) => {
    setColumns((current) =>
      editCardInColumn(current, columnId, cardId, title, details),
    );
  };

  return (
    <main className="mx-auto w-full max-w-[1600px] px-4 py-8 sm:px-8">
      <header className="mb-6 rounded-2xl border border-white/60 bg-white/90 px-4 py-4 shadow-sm backdrop-blur">
        <h1 className="text-3xl font-bold text-[#0b1325]">{BOARD_TITLE}</h1>
        <p className="mt-1 text-sm text-[#888888]">
          MVP de Kanban con una sola pizarra y flujo simple.
        </p>
      </header>

      <DndContext
        id="kanban-board-dnd"
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={(event) => {
          const sourceCardId = String(event.active.id);
          for (const column of columns) {
            const card = column.cards.find((item) => item.id === sourceCardId);
            if (card) {
              setActiveCard(card);
              break;
            }
          }
        }}
        onDragEnd={onDragEnd}
        onDragCancel={() => setActiveCard(null)}
      >
        <div className="grid gap-4 lg:grid-cols-5">
          {columns.map((column) => (
            <ColumnCard
              key={column.id}
              column={column}
              formState={forms[column.id]}
              onDeleteCard={handleDeleteCard}
              onRename={handleColumnRename}
              onFormStateChange={handleFormChange}
              onAddCard={handleAddCard}
              onEditCard={handleEditCard}
            />
          ))}
        </div>
        <DragOverlay>
          {activeCard ? (
            <article className="w-[260px] rounded-xl border border-[#ecad0a]/40 bg-white p-4 shadow-xl">
              <h3 className="text-sm font-semibold text-[#032147]">{activeCard.title}</h3>
              <p className="mt-1 text-sm text-[#888888]">{activeCard.details}</p>
            </article>
          ) : null}
        </DragOverlay>
      </DndContext>
    </main>
  );
}
