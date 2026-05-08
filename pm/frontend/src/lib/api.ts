/**
 * API client for Kanban backend
 */

import type { BoardData } from "@/lib/kanban";

export type Card = {
  id: number;
  title: string;
  details: string | null;
  column_id: number;
  position: number;
  priority?: "low" | "medium" | "high" | null;
  due_date?: string | null;
  color?: string | null;
};

export type Column = {
  id: number;
  board_id?: number;
  title: string;
  position: number;
  cards?: Card[];
};

export type Board = {
  id: number;
  user_id: number;
  title: string;
  columns: Column[];
  cards: Card[];
  created_at?: string;
  updated_at?: string;
};

export type BoardSummary = {
  id: number;
  user_id: number;
  title: string;
  created_at: string;
  updated_at: string;
};

export type CardCreate = {
  column_id: number;
  title: string;
  details?: string;
  priority?: "low" | "medium" | "high";
  due_date?: string;
  color?: string;
};

export type CardUpdate = {
  title?: string;
  details?: string;
  priority?: "low" | "medium" | "high" | null;
  due_date?: string | null;
  color?: string | null;
};

export type BoardCreate = {
  title: string;
};

export type BoardUpdate = {
  columns: Array<{
    id: number;
    title: string;
    position: number;
  }>;
  cards: Array<{
    id: number;
    column_id: number;
    position: number;
  }>;
};

export type RegisterRequest = {
  username: string;
  password: string;
};

export type AuthResponse = {
  username: string;
  token: string;
  user_id: number;
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
    if (typeof window === "undefined") return null;
    const stored = localStorage.getItem("kanban_auth");
    if (stored) {
      const parsed = JSON.parse(stored) as { token: string };
      return parsed.token;
    }
  } catch {
    // ignore
  }
  return null;
}

function getHeaders(includeAuth = true): HeadersInit {
  const headers: HeadersInit = { "Content-Type": "application/json" };
  if (includeAuth) {
    const token = getAuthToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let details: Record<string, unknown> = {};
    try {
      details = await response.json();
    } catch {
      // non-JSON response
    }
    const message =
      response.status === 401
        ? "Unauthorized - please log in again"
        : response.status === 403
          ? "Access forbidden - missing or invalid authorization"
          : response.status === 409
            ? ((details.detail as string) ?? "Conflict")
            : `API error: ${response.status}`;
    throw new APIError(response.status, message, details);
  }
  return response.json() as Promise<T>;
}

// ====== Auth ======

export async function register(input: RegisterRequest): Promise<AuthResponse> {
  const response = await fetch("/api/register", {
    method: "POST",
    headers: getHeaders(false),
    body: JSON.stringify(input),
  });
  return handleResponse<AuthResponse>(response);
}

export async function login(username: string, password: string): Promise<AuthResponse> {
  const response = await fetch("/api/login", {
    method: "POST",
    headers: getHeaders(false),
    body: JSON.stringify({ username, password }),
  });
  return handleResponse<AuthResponse>(response);
}

// ====== Boards ======

export async function fetchBoards(): Promise<BoardSummary[]> {
  const response = await fetch("/api/boards", { headers: getHeaders(true) });
  return handleResponse<BoardSummary[]>(response);
}

export async function createBoard(input: BoardCreate): Promise<Board> {
  const response = await fetch("/api/boards", {
    method: "POST",
    headers: getHeaders(true),
    body: JSON.stringify(input),
  });
  return handleResponse<Board>(response);
}

export async function fetchBoardById(boardId: number): Promise<Board> {
  const response = await fetch(`/api/boards/${boardId}`, { headers: getHeaders(true) });
  return handleResponse<Board>(response);
}

export async function updateBoardTitle(boardId: number, title: string): Promise<BoardSummary> {
  const response = await fetch(`/api/boards/${boardId}/title`, {
    method: "PUT",
    headers: getHeaders(true),
    body: JSON.stringify({ title }),
  });
  return handleResponse<BoardSummary>(response);
}

export async function deleteBoard(boardId: number): Promise<void> {
  const response = await fetch(`/api/boards/${boardId}`, {
    method: "DELETE",
    headers: getHeaders(true),
  });
  if (!response.ok) throw new APIError(response.status, `Failed to delete board ${boardId}`);
}

export async function fetchBoard(): Promise<Board> {
  const response = await fetch("/api/user/board", { headers: getHeaders(true) });
  return handleResponse<Board>(response);
}

export async function updateBoardById(boardId: number, updates: BoardUpdate): Promise<{ success: boolean }> {
  const response = await fetch(`/api/boards/${boardId}`, {
    method: "PUT",
    headers: getHeaders(true),
    body: JSON.stringify(updates),
  });
  return handleResponse<{ success: boolean }>(response);
}

export async function updateBoard(updates: BoardUpdate): Promise<{ success: boolean }> {
  const response = await fetch("/api/board", {
    method: "PUT",
    headers: getHeaders(true),
    body: JSON.stringify(updates),
  });
  return handleResponse<{ success: boolean }>(response);
}

// ====== Columns ======

export async function addColumn(boardId: number, title: string): Promise<Column> {
  const response = await fetch(`/api/boards/${boardId}/columns`, {
    method: "POST",
    headers: getHeaders(true),
    body: JSON.stringify({ title }),
  });
  return handleResponse<Column>(response);
}

export async function deleteColumn(boardId: number, columnId: number): Promise<void> {
  const response = await fetch(`/api/boards/${boardId}/columns/${columnId}`, {
    method: "DELETE",
    headers: getHeaders(true),
  });
  if (!response.ok) throw new APIError(response.status, `Failed to delete column ${columnId}`);
}

// ====== Cards ======

export async function createCard(input: CardCreate): Promise<Card> {
  const response = await fetch("/api/cards", {
    method: "POST",
    headers: getHeaders(true),
    body: JSON.stringify(input),
  });
  return handleResponse<Card>(response);
}

export async function updateCard(cardId: number, input: CardUpdate): Promise<Card> {
  const response = await fetch(`/api/cards/${cardId}`, {
    method: "PUT",
    headers: getHeaders(true),
    body: JSON.stringify(input),
  });
  return handleResponse<Card>(response);
}

export async function deleteCard(cardId: number): Promise<void> {
  const response = await fetch(`/api/cards/${cardId}`, {
    method: "DELETE",
    headers: getHeaders(true),
  });
  if (!response.ok) throw new APIError(response.status, `Failed to delete card ${cardId}`);
}

// ====== Chat ======

export type ChatHistoryItem = {
  id: number;
  role: string;
  content: string;
  created_at: string;
};

export type ChatRequest = {
  message: string;
  board_state?: Record<string, unknown>;
  board_id?: number;
};

export type ChatResponse = {
  response: string;
  board_updates?: Array<{
    action: "create_card" | "move_card" | "delete_card";
    card_id?: number;
    column_id?: number;
    title?: string;
    details?: string;
    target_column_id?: number;
  }>;
};

export async function sendChatMessage(
  message: string,
  boardState: BoardData,
  boardId?: number,
): Promise<ChatResponse> {
  const backendBoardState = {
    columns: boardState.columns.map((col, index) => ({
      id: parseInt(col.id),
      title: col.title,
      position: index,
      cards: col.cardIds.map((cardId, cardIndex) => {
        const card = boardState.cards[cardId];
        return {
          id: parseInt(card.id),
          title: card.title,
          details: card.details || "",
          position: cardIndex,
        };
      }),
    })),
  };

  const response = await fetch("/api/chat", {
    method: "POST",
    headers: getHeaders(true),
    body: JSON.stringify({
      message,
      board_state: backendBoardState,
      board_id: boardId,
    } as ChatRequest),
  });
  return handleResponse<ChatResponse>(response);
}

export async function fetchChatHistory(boardId?: number): Promise<ChatHistoryItem[]> {
  const url = boardId ? `/api/chat/history?board_id=${boardId}` : "/api/chat/history";
  const response = await fetch(url, { headers: getHeaders(true) });
  return handleResponse<ChatHistoryItem[]>(response);
}
