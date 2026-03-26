'use client';

import React, { useState, useEffect } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { v4 as uuidv4 } from 'uuid';
import { Plus, Trash2, X } from 'lucide-react';
import { BoardState, Card, Column } from '../app/types';

const initialData: BoardState = {
  cards: {
    'card-1': { id: 'card-1', title: 'Setup project', details: 'Initialize Next.js and Tailwind' },
    'card-2': { id: 'card-2', title: 'Design UI', details: 'Create a slick and professional Kanban design' },
    'card-3': { id: 'card-3', title: 'Implement DnD', details: 'Add drag and drop functionality between columns' },
    'card-4': { id: 'card-4', title: 'Testing', details: 'Write Playwright integration tests' },
    'card-5': { id: 'card-5', title: 'Refactor', details: 'Clean up code and optimize performance' },
  },
  columns: {
    'col-1': { id: 'col-1', name: 'Backlog', cardIds: ['card-1', 'card-2'] },
    'col-2': { id: 'col-2', name: 'To Do', cardIds: ['card-3'] },
    'col-3': { id: 'col-3', name: 'In Progress', cardIds: ['card-4'] },
    'col-4': { id: 'col-4', name: 'Review', cardIds: [] },
    'col-5': { id: 'col-5', name: 'Done', cardIds: ['card-5'] },
  },
  columnOrder: ['col-1', 'col-2', 'col-3', 'col-4', 'col-5'],
};

export default function KanbanBoard() {
  const [state, setState] = useState<BoardState | null>(null);
  const [mounted, setMounted] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeColumnId, setActiveColumnId] = useState<string | null>(null);
  const [newCard, setNewCard] = useState({ title: '', details: '' });

  useEffect(() => {
    setState(initialData);
    setMounted(true);
  }, []);

  if (!mounted || !state) return null;

  const onDragEnd = (result: DropResult) => {
    const { destination, source, draggableId } = result;

    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) return;

    const start = state.columns[source.droppableId];
    const finish = state.columns[destination.droppableId];

    if (start === finish) {
      const newCardIds = Array.from(start.cardIds);
      newCardIds.splice(source.index, 1);
      newCardIds.splice(destination.index, 0, draggableId);

      const newColumn = { ...start, cardIds: newCardIds };
      const newState = {
        ...state,
        columns: { ...state.columns, [newColumn.id]: newColumn },
      };

      setState(newState);
      return;
    }

    const startCardIds = Array.from(start.cardIds);
    startCardIds.splice(source.index, 1);
    const newStart = { ...start, cardIds: startCardIds };

    const finishCardIds = Array.from(finish.cardIds);
    finishCardIds.splice(destination.index, 0, draggableId);
    const newFinish = { ...finish, cardIds: finishCardIds };

    const newState = {
      ...state,
      columns: {
        ...state.columns,
        [newStart.id]: newStart,
        [newFinish.id]: newFinish,
      },
    };
    setState(newState);
  };

  const handleRenameColumn = (columnId: string, newName: string) => {
    if (!state) return;
    const newState = {
      ...state,
      columns: {
        ...state.columns,
        [columnId]: { ...state.columns[columnId], name: newName },
      },
    };
    setState(newState);
  };

  const openAddCardModal = (columnId: string) => {
    setActiveColumnId(columnId);
    setIsModalOpen(true);
  };

  const handleAddCard = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeColumnId || !state) return;

    const newId = uuidv4();
    const card: Card = { id: newId, title: newCard.title, details: newCard.details };

    const column = state.columns[activeColumnId];
    const newCardIds = [...column.cardIds, newId];

    const newState = {
      ...state,
      cards: { ...state.cards, [newId]: card },
      columns: {
        ...state.columns,
        [activeColumnId]: { ...column, cardIds: newCardIds },
      },
    };

    setState(newState);
    setNewCard({ title: '', details: '' });
    setIsModalOpen(false);
  };

  const handleDeleteCard = (cardId: string, columnId: string) => {
    if (!state) return;
    const column = state.columns[columnId];
    const newCardIds = column.cardIds.filter((id) => id !== cardId);

    const newCards = { ...state.cards };
    delete newCards[cardId];

    const newState = {
      ...state,
      cards: newCards,
      columns: {
        ...state.columns,
        [columnId]: { ...column, cardIds: newCardIds },
      },
    };
    setState(newState);
  };

  return (
    <div className="board-container">
      <header className="board-header">
        <h1 className="board-title">My Project Board</h1>
      </header>

      <DragDropContext onDragEnd={onDragEnd}>
        <div className="columns-wrapper">
          {state.columnOrder.map((columnId) => {
            const column = state.columns[columnId];
            const cards = column.cardIds.map((cardId) => state.cards[cardId]);

            return (
              <div key={column.id} className="column">
                <div className="column-header">
                  <input
                    className="column-title"
                    value={column.name}
                    onChange={(e) => handleRenameColumn(column.id, e.target.value)}
                  />
                </div>

                <Droppable droppableId={column.id}>
                  {(provided) => (
                    <div
                      className="cards-container"
                      {...provided.droppableProps}
                      ref={provided.innerRef}
                    >
                      {cards.map((card, index) => (
                        <Draggable key={card.id} draggableId={card.id} index={index}>
                          {(provided) => (
                            <div
                              className="card"
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                            >
                              <button
                                className="delete-card-btn"
                                onClick={() => handleDeleteCard(card.id, column.id)}
                              >
                                <Trash2 size={16} />
                              </button>
                              <h3 className="card-title">{card.title}</h3>
                              <p className="card-details">{card.details}</p>
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>

                <button
                  className="add-card-btn"
                  onClick={() => openAddCardModal(column.id)}
                >
                  <Plus size={16} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
                  Add Card
                </button>
              </div>
            );
          })}
        </div>
      </DragDropContext>

      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2 className="modal-title">Add New Card</h2>
            <form onSubmit={handleAddCard}>
              <div className="form-group">
                <label>Title</label>
                <input
                  required
                  value={newCard.title}
                  onChange={(e) => setNewCard({ ...newCard, title: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>Details</label>
                <textarea
                  required
                  rows={4}
                  value={newCard.details}
                  onChange={(e) => setNewCard({ ...newCard, details: e.target.value })}
                />
              </div>
              <div className="modal-actions">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setIsModalOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Create Card
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
