"use client";

import React, { useState, useEffect } from "react";
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragOverEvent,
  DragEndEvent,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates, arrayMove } from "@dnd-kit/sortable";
import { initialBoardData, BoardData, CardData } from "../lib/mockData";
import { Column } from "./Column";
import { Card } from "./Card";
import styles from "./KanbanStyles.module.css";

export const Board = () => {
  const [isMounted, setIsMounted] = useState(false);
  const [board, setBoard] = useState<BoardData>(initialBoardData);
  const [activeCard, setActiveCard] = useState<CardData | null>(null);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const renameColumn = (colId: string, newTitle: string) => {
    setBoard((prev) => ({
      columns: prev.columns.map((col) =>
        col.id === colId ? { ...col, title: newTitle } : col
      ),
    }));
  };

  const addCard = (colId: string) => {
    const newCard: CardData = {
      id: `card-${Date.now()}`,
      title: "New Task",
      details: "Click to edit (or describe here)",
    };
    setBoard((prev) => ({
      columns: prev.columns.map((col) =>
        col.id === colId ? { ...col, cards: [...col.cards, newCard] } : col
      ),
    }));
  };

  const deleteCard = (cardId: string) => {
    setBoard((prev) => ({
      columns: prev.columns.map((col) => ({
        ...col,
        cards: col.cards.filter((c) => c.id !== cardId),
      })),
    }));
  };

  const updateCard = (cardId: string, title: string, details: string) => {
    setBoard((prev) => ({
      columns: prev.columns.map((col) => ({
        ...col,
        cards: col.cards.map((c) =>
          c.id === cardId ? { ...c, title, details } : c
        ),
      })),
    }));
  };

  const onDragStart = (event: DragStartEvent) => {
    if (event.active.data.current?.type === "Card") {
      setActiveCard(event.active.data.current.card);
    }
  };

  const onDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id;
    const overId = over.id;
    if (activeId === overId) return;

    const isActiveCard = active.data.current?.type === "Card";
    const isOverCard = over.data.current?.type === "Card";
    const isOverColumn = over.data.current?.type === "Column";

    if (!isActiveCard) return;

    setBoard((prev) => {
      const activeColumnIndex = prev.columns.findIndex((col) =>
        col.cards.some((c) => c.id === activeId)
      );

      let overColumnIndex = -1;
      if (isOverColumn) {
        overColumnIndex = prev.columns.findIndex((col) => col.id === overId);
      } else if (isOverCard) {
        overColumnIndex = prev.columns.findIndex((col) =>
          col.cards.some((c) => c.id === overId)
        );
      }

      if (activeColumnIndex === -1 || overColumnIndex === -1) return prev;

      // Moving to different list
      if (activeColumnIndex !== overColumnIndex) {
        const sourceCol = prev.columns[activeColumnIndex];
        const destCol = prev.columns[overColumnIndex];
        const activeCardIndex = sourceCol.cards.findIndex(
          (c) => c.id === activeId
        );

        let overCardIndex = destCol.cards.length;
        if (isOverCard) {
          overCardIndex = destCol.cards.findIndex((c) => c.id === overId);
          // if dragged slightly below center, could offset but for simplicity:
        }

        const newSourceCards = [...sourceCol.cards];
        const [movedCard] = newSourceCards.splice(activeCardIndex, 1);

        const newDestCards = [...destCol.cards];
        newDestCards.splice(overCardIndex, 0, movedCard);

        const newColumns = [...prev.columns];
        newColumns[activeColumnIndex] = { ...sourceCol, cards: newSourceCards };
        newColumns[overColumnIndex] = { ...destCol, cards: newDestCards };
        return { columns: newColumns };
      }

      return prev;
    });
  };

  const onDragEnd = (event: DragEndEvent) => {
    setActiveCard(null);
    const { active, over } = event;
    if (!over) return;

    setBoard((prev) => {
      const colIndex = prev.columns.findIndex((col) =>
        col.cards.some((c) => c.id === active.id)
      );
      if (colIndex === -1) return prev;

      const isOverCard = over.data.current?.type === "Card";
      if (isOverCard) {
        const overColIndex = prev.columns.findIndex((col) =>
          col.cards.some((c) => c.id === over.id)
        );
        // Only within SAME list
        if (colIndex === overColIndex) {
          const col = prev.columns[colIndex];
          const oldIndex = col.cards.findIndex((c) => c.id === active.id);
          const newIndex = col.cards.findIndex((c) => c.id === over.id);

          const newColumns = [...prev.columns];
          newColumns[colIndex] = {
            ...col,
            cards: arrayMove(col.cards, oldIndex, newIndex),
          };
          return { columns: newColumns };
        }
      }
      return prev;
    });
  };

  if (!isMounted) {
    // Evita el error de hidratación en SSR de dnd-kit (DndDescribedBy mismatch)
    return null;
  }

  return (
    <>
      <header className={styles.header}>
        <h1 className={styles.headerTitle}>
          Kanban <span className={styles.headerHighlight}>Pro</span>
        </h1>
      </header>
      <div className={styles.boardContainer}>
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={onDragStart}
          onDragOver={onDragOver}
          onDragEnd={onDragEnd}
        >
          {board.columns.map((col) => (
            <Column
              key={col.id}
              column={col}
              onRename={renameColumn}
              onAddCard={addCard}
              onDeleteCard={deleteCard}
              onUpdateCard={updateCard}
            />
          ))}

          <DragOverlay>
            {activeCard ? (
              <Card card={activeCard} onDelete={() => {}} onUpdate={() => {}} />
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>
    </>
  );
};
