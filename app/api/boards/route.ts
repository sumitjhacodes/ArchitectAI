import {
  deleteDurableBoard,
  listDurableBoards,
  upsertDurableBoard,
} from "@/lib/db/boards";
import { clientKeyFromRequest, rateLimit } from "@/lib/rate-limit";

function userIdFromRequest(request: Request) {
  return `local:${clientKeyFromRequest(request)}`;
}

export async function GET(request: Request) {
  const userId = userIdFromRequest(request);
  const boards = await listDurableBoards(userId);
  return Response.json({ boards });
}

export async function POST(request: Request) {
  const limited = rateLimit(
    `boards:${clientKeyFromRequest(request)}`,
    60,
    60_000,
  );
  if (!limited.ok) {
    return Response.json({ error: "Rate limit exceeded" }, { status: 429 });
  }
  const userId = userIdFromRequest(request);
  const body = (await request.json()) as {
    id?: string;
    name?: string;
    blueprint?: unknown;
    payload?: unknown;
  };
  if (!body.id || !body.name) {
    return Response.json({ error: "id and name required" }, { status: 400 });
  }
  const board = await upsertDurableBoard({
    id: body.id,
    userId,
    name: body.name,
    blueprint: (body.blueprint as never) ?? null,
    payload: body.payload ?? null,
  });
  return Response.json({ board });
}

export async function DELETE(request: Request) {
  const userId = userIdFromRequest(request);
  const id = new URL(request.url).searchParams.get("id");
  if (!id) {
    return Response.json({ error: "id required" }, { status: 400 });
  }
  await deleteDurableBoard(userId, id);
  return Response.json({ ok: true });
}
