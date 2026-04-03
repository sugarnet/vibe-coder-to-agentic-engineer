"use client";

import React from "react";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { useDroppable } from "@dnd-kit/core";
import { Plus } from "lucide-react";
import { ColumnData, CardData } from "../lib/mockData";
import { Card } from "./Card";
import styles from "./KanbanStyles.module.css";

interface ColumnProps {
  column: ColumnData;
  onRename: (id: string, newTitle: string) => void;
  onAddCard: (columnId: string) => void;
  onDeleteCard: (cardId: string) => void;
  onUpdateCard: (cardId: string, title: string, details: string) => void;
}

export const Column = ({
  column,
  onRename,
  onAddCard,
  onDeleteCard,
  onUpdateCard,
}: ColumnProps) => {
  const { setNodeRef } = useDroppable({
    id: column.id,
    data: {
      type: "Column",
      column,
    },
  });

  const cardIds = column.cards.map((c) => c.id);

  return (
    <div className={styles.column}>
      <div className={styles.columnHeader}>
        <input
          className={styles.columnTitle}
          value={column.title}
          onChange={(e) => onRename(column.id, e.target.value)}
          onPointerDownCapture={(e) => e.stopPropagation()} // Prevent interfering with dnd context sometimes
        />
      </div>

      <div className={styles.cardList} ref={setNodeRef}>
        <SortableContext items={cardIds} strategy={verticalListSortingStrategy}>
          {column.cards.map((card) => (
            <Card key={card.id} card={card} onDelete={onDeleteCard} onUpdate={onUpdateCard} />
          ))}
        </SortableContext>
      </div>

      <button
        className={styles.addCardButton}
        onClick={() => onAddCard(column.id)}
      >
        <Plus size={18} /> Add Card
      </button>
    </div>
  );
};
