export type CardData = {
  id: string;
  title: string;
  details: string;
};

export type ColumnData = {
  id: string;
  title: string;
  cards: CardData[];
};

export type BoardData = {
  columns: ColumnData[];
};

export const initialBoardData: BoardData = {
  columns: [
    {
      id: "col-1",
      title: "To Do",
      cards: [
        { id: "card-1", title: "Research next.js dnd", details: "Look for modern drag and drop libraries compatible with app router." },
        { id: "card-2", title: "Set up design system", details: "Define vanilla CSS variables for the color palette." }
      ]
    },
    {
      id: "col-2",
      title: "In Progress",
      cards: [
        { id: "card-3", title: "Implement Kanban Store", details: "Create state using useState or context." }
      ]
    },
    {
      id: "col-3",
      title: "In Review",
      cards: []
    },
    {
      id: "col-4",
      title: "Testing",
      cards: []
    },
    {
      id: "col-5",
      title: "Done",
      cards: [
        { id: "card-4", title: "Project Scaffolding", details: "Setup next.js workspace." }
      ]
    }
  ]
};
