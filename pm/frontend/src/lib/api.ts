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
  created_at: string;
  updated_at: string;
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

export type BoardCreate = { title: string };

export type BoardUpdate = {
  columns: Array<{ id: number; title: string; position: number }>;
  cards: Array<{ id: number; column_id: number; position: number }>;
};

export type RegisterRequest = { username: string; password: string };

export type AuthResponse = {
  username: string;
  token: string;
  user_id: number;
};

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
  if (typeof window === "undefined") return null;
  try {
    const stored = localStorage.getItem("kanban_auth");
    if (!stored) return null;
    return (JSON.parse(stored) as { token: string }).token;
  } catch {
    return null;
  }
}

function buildHeaders(includeAuth: boolean): HeadersInit {
  const headers: HeadersInit = { "Content-Type": "application/json" };
  if (includeAuth) {
    const token = getAuthToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

function errorMessage(status: number, details: Record<string, unknown>): string {
  switch (status) {
    case 401:
      return "Unauthorized - please log in again";
    case 403:
      return "Access forbidden - missing or invalid authorization";
    case 409:
      return (details.detail as string) ?? "Conflict";
    default:
      return `API error: ${status}`;
  }
}

type RequestOptions = {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: unknown;
  auth?: boolean;
  expectJson?: boolean;
};

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, auth = true, expectJson = true } = options;
  const response = await fetch(path, {
    method,
    headers: buildHeaders(auth),
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    let details: Record<string, unknown> = {};
    try {
      details = await response.json();
    } catch {
      // non-JSON response
    }
    throw new APIError(response.status, errorMessage(response.status, details), details);
  }

  return expectJson ? ((await response.json()) as T) : (undefined as T);
}

export async function register(input: RegisterRequest): Promise<AuthResponse> {
  return request("/api/register", { method: "POST", body: input, auth: false });
}

export async function login(username: string, password: string): Promise<AuthResponse> {
  return request("/api/login", { method: "POST", body: { username, password }, auth: false });
}

export async function fetchBoards(): Promise<BoardSummary[]> {
  return request("/api/boards");
}

export async function createBoard(input: BoardCreate): Promise<Board> {
  return request("/api/boards", { method: "POST", body: input });
}

export async function fetchBoardById(boardId: number): Promise<Board> {
  return request(`/api/boards/${boardId}`);
}

export async function updateBoardTitle(boardId: number, title: string): Promise<BoardSummary> {
  return request(`/api/boards/${boardId}/title`, { method: "PUT", body: { title } });
}

export async function deleteBoard(boardId: number): Promise<void> {
  await request(`/api/boards/${boardId}`, { method: "DELETE", expectJson: false });
}

export async function fetchBoard(): Promise<Board> {
  return request("/api/user/board");
}

export async function updateBoardById(boardId: number, updates: BoardUpdate): Promise<{ success: boolean }> {
  return request(`/api/boards/${boardId}`, { method: "PUT", body: updates });
}

export async function updateBoard(updates: BoardUpdate): Promise<{ success: boolean }> {
  return request("/api/board", { method: "PUT", body: updates });
}

export async function addColumn(boardId: number, title: string): Promise<Column> {
  return request(`/api/boards/${boardId}/columns`, { method: "POST", body: { title } });
}

export async function deleteColumn(boardId: number, columnId: number): Promise<void> {
  await request(`/api/boards/${boardId}/columns/${columnId}`, { method: "DELETE", expectJson: false });
}

export async function createCard(input: CardCreate): Promise<Card> {
  return request("/api/cards", { method: "POST", body: input });
}

export async function updateCard(cardId: number, input: CardUpdate): Promise<Card> {
  return request(`/api/cards/${cardId}`, { method: "PUT", body: input });
}

export async function deleteCard(cardId: number): Promise<void> {
  await request(`/api/cards/${cardId}`, { method: "DELETE", expectJson: false });
}

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

  return request("/api/chat", {
    method: "POST",
    body: { message, board_state: backendBoardState, board_id: boardId } as ChatRequest,
  });
}

export async function fetchChatHistory(boardId?: number): Promise<ChatHistoryItem[]> {
  const path = boardId ? `/api/chat/history?board_id=${boardId}` : "/api/chat/history";
  return request(path);
}
