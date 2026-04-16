# Frontend - Kanban Studio

## Architecture Overview

The frontend is a fully functional Kanban board demo built with modern React and Next.js. It demonstrates drag-and-drop card management with column renaming and card CRUD operations. Currently a standalone demo; will be integrated with the backend API.

## Tech Stack

- **Framework**: Next.js 16.1.6 with React 19.2.3 TypeScript
- **Styling**: Tailwind CSS 4 + CSS variables for theming
- **Drag & Drop**: @dnd-kit (6.3.1) for sortable/droppable interactions
- **Testing**: Vitest 3.2.4 (unit), Playwright 1.58.0 (e2e), React Testing Library
- **Build Tools**: ESLint, PostCSS

## Project Structure

```
frontend/
├── src/
│   ├── app/
│   │   ├── layout.tsx       # Root layout with fonts and metadata
│   │   ├── page.tsx         # Entry point, renders KanbanBoard
│   │   └── globals.css      # CSS variables and Tailwind setup
│   ├── components/
│   │   ├── KanbanBoard.tsx      # Main state & drag orchestration (client)
│   │   ├── KanbanBoard.test.tsx # Integration tests
│   │   ├── KanbanColumn.tsx     # Column with droppable zone
│   │   ├── KanbanCard.tsx       # Draggable card item
│   │   ├── KanbanCardPreview.tsx # Drag overlay preview
│   │   └── NewCardForm.tsx      # Add card form
│   └── lib/
│       ├── kanban.ts      # Core logic: moveCard, types, initialData
│       └── kanban.test.ts # Unit tests for logic
└── package.json

```

## Key Components

### KanbanBoard.tsx (Client Component)

- **Purpose**: Orchestrates entire Kanban experience
- **State**: `board` (BoardData), `activeCardId` (for drag preview)
- **DnD Setup**: Uses @dnd-kit with PointerSensor, closestCorners strategy
- **Handlers**:
  - `handleDragStart` / `handleDragEnd` → calls `moveCard` to update state
  - `handleRenameColumn` → updates column.title in place
  - `handleAddCard` → generates unique ID, adds to cards and column.cardIds
  - `handleDeleteCard` → removes from both cards dict and column.cardIds
- **Initial Data**: 5 columns (Backlog, Discovery, In Progress, Review, Done) with 8 demo cards
- **Composition**: Maps columns to `<KanbanColumn>` components; renders `<DragOverlay>` for feedback

### KanbanColumn.tsx

- **Purpose**: Droppable container for a single column
- **Features**:
  - Resizable input for column title editing
  - Visual feedback (ring highlight) when hovering with a card
  - Card count badge
  - `<SortableContext>` + `<NewCardForm>` at bottom
  - Empty state: "Drop a card here" message

### KanbanCard.tsx

- **Purpose**: Individual draggable card
- **Sortable**: Uses `useSortable` hook for drag interaction
- **Visual**: Shows title and details; "Remove" button for deletion
- **Feedback**: Opacity change during drag, shadow enhancement

### NewCardForm.tsx

- **Purpose**: Toggle-able form to add cards to a column
- **Validation**: Requires title; trims whitespace
- **UX**: Hides form after successful submission; maintains form state while open

### kanban.ts (Utilities)

- **Types**: `Card`, `Column`, `BoardData`
- **Initial Data**: 8 sample cards across 5 columns
- **Logic**:
  - `moveCard(columns, activeId, overId)`: Handles same-column reorder and cross-column moves
  - `findColumnId(columns, id)`: Resolves whether ID is column or card; finds parent column
  - `createId(prefix)`: Generates unique IDs using random + timestamp
  - Smart reordering: handles both card-to-card and card-to-column drops

## Current Test Coverage

### Unit Tests (kanban.test.ts)

- ✓ Reorder cards within same column
- ✓ Move cards to another column
- ✓ Drop cards to end of column

### Integration Tests (KanbanBoard.test.tsx)

- ✓ Renders 5 columns
- ✓ Rename column via input
- ✓ Add card (fill form, submit, verify)
- ✓ Delete card
- **Note**: Currently ~35% coverage; drag-and-drop interactions not tested due to @dnd-kit complexity

## Styling & Design

**CSS Variables** (globals.css):

- `--accent-yellow: #ecad0a`
- `--primary-blue: #209dd7`
- `--secondary-purple: #753991`
- `--navy-dark: #032147`
- `--gray-text: #888888`
- `--stroke`: Light border (rgba with 8% opacity)
- `--shadow`: Elevation shadow

**Component Styling**:

- Tailwind utility classes + CSS variable references
- Responsive: Flex layout, min-h/max-w constraints
- Accessible: Semantic HTML, aria-labels, focus states

## Current Limitations & Notes

1. **No Backend**: All state is in-memory; changes lost on page refresh
2. **No Auth**: No login/logout (feature for Part 4)
3. **No Persistence**: Data not saved to database (feature for Part 6)
4. **No AI**: No AI chat or structured updates (features for Parts 8-10)
5. **Drag Testing**: DnD Library makes e2e testing non-trivial; uses Playwright (not yet deeply tested)
6. **Font Imports**: Uses Google Fonts (Space_Grotesk display, Manrope body)

## Integration Points (Future)

- **Part 3**: Build static site for Docker deployment
- **Part 4**: Wrap with login page (redirect if not authenticated)
- **Part 6**: Replace `useState` with API calls to fetch/update board for user
- **Part 7**: Connect add/delete/rename/move operations to backend endpoints
- **Part 10**: Add sidebar with AI chat; handle structured outputs to update Kanban

## Development Commands

```bash
npm install              # Install dependencies
npm run dev              # Start dev server (http://localhost:3000)
npm run build            # Production build
npm run test:unit        # Run unit tests (Vitest)
npm run test:unit:watch  # Watch mode
npm run test:e2e         # Run Playwright tests
npm run test:all         # Run all tests
npm run lint             # ESLint
```

## Key Files for Review

- **Main Flow**: `page.tsx` → `KanbanBoard.tsx` → `KanbanColumn.tsx` + `KanbanCard.tsx`
- **Logic**: `lib/kanban.ts` (types, moveCard algorithm, initialData)
- **Tests**: `*.test.ts` and `*.test.tsx` files
- **Styles**: `globals.css` + Tailwind config in `tailwind.config.js` (if exists)
