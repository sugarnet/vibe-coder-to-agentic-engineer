"use client";

import React from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Trash2 } from "lucide-react";
import { CardData } from "../lib/mockData";
import styles from "./KanbanStyles.module.css";

interface CardProps {
  card: CardData;
  onDelete: (id: string) => void;
  onUpdate: (id: string, title: string, details: string) => void;
}

export const Card = ({ card, onDelete, onUpdate }: CardProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: card.id,
    data: {
      type: "Card",
      card,
    },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`${styles.card} ${isDragging ? styles.cardDragging : ""}`}
      {...attributes}
      {...listeners}
    >
      <div className={styles.cardHeader}>
        <input
          className={styles.cardTitleInput}
          value={card.title}
          onChange={(e) => onUpdate(card.id, e.target.value, card.details)}
          onPointerDownCapture={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
          placeholder="Task title"
        />
        <button
          className={styles.deleteButton}
          onClick={(e) => {
            e.stopPropagation();
            onDelete(card.id);
          }}
          onPointerDown={(e) => e.stopPropagation()} // Prevent drag start when clicking delete
          title="Delete Card"
        >
          <Trash2 size={16} />
        </button>
      </div>
      <textarea
        className={styles.cardDetailsInput}
        value={card.details}
        onChange={(e) => onUpdate(card.id, card.title, e.target.value)}
        onPointerDownCapture={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
        placeholder="Task details"
        rows={2}
      />
    </div>
  );
};
