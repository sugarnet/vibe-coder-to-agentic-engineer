/**
 * API client for Kanban backend
 * Handles all CRUD operations with authentication
 */

export type Card = {
  id: number;
  title: string;
  details: string;
  column_id: number;
  position: number;
};

export type Column = {
  id: number;
  board_id: number;
  title: string;
  position: number;
};

export type Board = {
  id: number;
  user_id: number;
  title: string;
  columns: Column[];
  cards: Card[];
};

export type CardCreate = {
  column_id: number;
  title: string;
  details?: string;
};

export type CardUpdate = {
  title?: string;
  details?: string;
};

export type ColumnUpdate = {
  title?: string;
};

export type BoardUpdate = {
  cards: Array<{
    id: number;
    column_id: number;
    position: number;
  }>;
};

export class APIError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "APIError";
  }
}

function getAuthToken(): string | null {
  try {
    // Ensure we're in browser environment
    if (typeof window === "undefined") {
      return null;
    }
    const stored = localStorage.getItem("kanban_auth");
    if (stored) {
      const parsed = JSON.parse(stored) as { token: string };
      console.debug(`Auth token found: ${parsed.token.slice(0, 10)}...`);
      return parsed.token;
    }
    console.debug("No auth token in localStorage");
  } catch (err) {
    console.error("Failed to get auth token:", err);
  }
  return null;
}

function getHeaders(includeAuth = true): HeadersInit {
  const headers: HeadersInit = {
    "Content-Type": "application/json",
  };

  if (includeAuth) {
    const token = getAuthToken();
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
  }

  return headers;
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let details: Record<string, unknown> = {};
    try {
      details = await response.json();
    } catch (err) {
      // Response body is not JSON
    }

    const message =
      response.status === 401
        ? "Unauthorized - please log in again"
        : response.status === 403
          ? "Access forbidden - missing or invalid authorization"
          : `API error: ${response.status}`;

    console.error(`API Error ${response.status}:`, details);

    throw new APIError(response.status, message, details);
  }

  return response.json() as Promise<T>;
}

/**
 * Fetch the user's board with all columns and cards
 */
export async function fetchBoard(): Promise<Board> {
  const response = await fetch("/api/user/board", {
    method: "GET",
    headers: getHeaders(true),
  });
  return handleResponse<Board>(response);
}

/**
 * Create a new card
 */
export async function createCard(input: CardCreate): Promise<Card> {
  const response = await fetch("/api/cards", {
    method: "POST",
    headers: getHeaders(true),
    body: JSON.stringify(input),
  });
  return handleResponse<Card>(response);
}

/**
 * Update a card's title and/or details
 */
export async function updateCard(
  cardId: number,
  input: CardUpdate,
): Promise<Card> {
  const response = await fetch(`/api/cards/${cardId}`, {
    method: "PUT",
    headers: getHeaders(true),
    body: JSON.stringify(input),
  });
  return handleResponse<Card>(response);
}

/**
 * Delete a card
 */
export async function deleteCard(cardId: number): Promise<void> {
  const response = await fetch(`/api/cards/${cardId}`, {
    method: "DELETE",
    headers: getHeaders(true),
  });
  if (!response.ok) {
    throw new APIError(response.status, `Failed to delete card ${cardId}`);
  }
}

/**
 * Update board state (bulk update for drag-drop)
 * Sends card positions for reordering
 */
export async function updateBoard(
  updates: BoardUpdate,
): Promise<{ success: boolean }> {
  const response = await fetch("/api/board", {
    method: "PUT",
    headers: getHeaders(true),
    body: JSON.stringify(updates),
  });
  return handleResponse<{ success: boolean }>(response);
}

/**
 * Update column title
 */
export async function updateColumn(
  columnId: number,
  input: ColumnUpdate,
): Promise<Column> {
  const response = await fetch(`/api/columns/${columnId}`, {
    method: "PUT",
    headers: getHeaders(true),
    body: JSON.stringify(input),
  });
  return handleResponse<Column>(response);
}
