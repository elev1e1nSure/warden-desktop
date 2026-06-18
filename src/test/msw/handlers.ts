import { HttpResponse, http } from "msw";

const BASE = "http://127.0.0.1:8765";

export const handlers = [
  http.get(`${BASE}/health`, () => new HttpResponse(null, { status: 200 })),

  http.get(`${BASE}/status`, () =>
    HttpResponse.json({
      model: "claude-sonnet-4-20250514",
      provider: "anthropic",
      connected: true,
      mode: "auto",
      cwd: "/home/user/projects",
      token_count: 1234,
      token_limit: 200000,
    }),
  ),

  http.post(`${BASE}/connect`, async ({ request }) => {
    const body = (await request.json()) as { api_key?: string };
    if (!body?.api_key) {
      return HttpResponse.json({ ok: false, error: "missing api_key" }, { status: 400 });
    }
    return HttpResponse.json({ ok: true });
  }),

  http.get(`${BASE}/models`, () =>
    HttpResponse.json({
      models: ["claude-sonnet-4-20250514", "gemini-2.5-pro"],
      current: "claude-sonnet-4-20250514",
      error: "",
    }),
  ),

  http.post(`${BASE}/model/set`, () => new HttpResponse(null, { status: 200 })),

  http.post(`${BASE}/mode`, () => new HttpResponse(null, { status: 200 })),

  http.post(`${BASE}/confirm`, () => new HttpResponse(null, { status: 200 })),

  http.post(`${BASE}/question`, () => new HttpResponse(null, { status: 200 })),

  http.post(`${BASE}/reset`, () => new HttpResponse(null, { status: 200 })),

  http.get(`${BASE}/chats`, () =>
    HttpResponse.json({
      chats: [
        {
          id: "chat-1",
          title: "Test Chat",
          title_source: "user",
          created_at: "2025-01-01T00:00:00Z",
          updated_at: "2025-01-01T00:00:00Z",
          timestamp: "2025-01-01T00:00:00Z",
        },
      ],
      active_chat_id: "chat-1",
    }),
  ),

  http.post(`${BASE}/chats/new`, () =>
    HttpResponse.json({
      chat: {
        id: "chat-new",
        title: "New Chat",
        title_source: "user",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        timestamp: new Date().toISOString(),
        blocks: [],
      },
    }),
  ),

  http.post(`${BASE}/chats/select`, () =>
    HttpResponse.json({
      chat: {
        id: "chat-1",
        title: "Test Chat",
        title_source: "user",
        created_at: "2025-01-01T00:00:00Z",
        updated_at: "2025-01-01T00:00:00Z",
        timestamp: "2025-01-01T00:00:00Z",
        blocks: [],
      },
    }),
  ),

  http.get(`${BASE}/chats/:id`, () =>
    HttpResponse.json({
      chat: {
        id: "chat-1",
        title: "Test Chat",
        title_source: "user",
        created_at: "2025-01-01T00:00:00Z",
        updated_at: "2025-01-01T00:00:00Z",
        timestamp: "2025-01-01T00:00:00Z",
        blocks: [],
      },
    }),
  ),

  http.post(`${BASE}/chats/blocks`, () => new HttpResponse(null, { status: 200 })),

  http.post(`${BASE}/chats/rename`, () => new HttpResponse(null, { status: 200 })),

  http.post(`${BASE}/chats/delete`, () => new HttpResponse(null, { status: 200 })),

  http.post(`${BASE}/compact`, () =>
    HttpResponse.json({
      summary: "Compacted conversation summary",
      tokens_before: 5000,
      tokens_after: 800,
    }),
  ),

  http.get(`${BASE}/skills`, () =>
    HttpResponse.json({
      skills: [
        {
          name: "test-skill",
          description: "A test skill",
          location: "user",
        },
      ],
    }),
  ),

  http.post(`${BASE}/skills/create`, async ({ request }) => {
    const body = (await request.json()) as { name: string; description: string; content: string };
    return HttpResponse.json({
      skill: {
        name: body.name,
        description: body.description,
        location: "user",
        content: body.content,
      },
    });
  }),

  http.post(`${BASE}/skills/update`, async ({ request }) => {
    const body = (await request.json()) as { name: string };
    return HttpResponse.json({
      skill: {
        name: body.name,
        description: "Updated skill",
        location: "user",
      },
    });
  }),

  http.post(`${BASE}/skills/delete`, () => HttpResponse.json({ ok: true })),

  http.get(`${BASE}/permissions`, () =>
    HttpResponse.json({
      files: "ask",
      shell: "ask",
      search: "allow",
      pc_control: "block",
      processes: "ask",
      system: "ask",
    }),
  ),

  http.post(`${BASE}/permissions`, () => new HttpResponse(null, { status: 200 })),

  http.get(`${BASE}/memory/state`, () =>
    HttpResponse.json({
      enabled: true,
      entries: 5,
      snapshots: 2,
      db_size: 1024,
    }),
  ),

  http.post(`${BASE}/memory/state`, () => new HttpResponse(null, { status: 200 })),

  http.post(`${BASE}/memory/clear`, () => HttpResponse.json({ cleared: 3 })),

  http.get(`${BASE}/memory/snapshot`, () =>
    HttpResponse.json({
      key1: "value1",
      key2: 42,
    }),
  ),

  http.get(`${BASE}/settings`, () =>
    HttpResponse.json({
      disable_system_prompt: false,
    }),
  ),

  http.post(`${BASE}/settings`, async ({ request }) => {
    const body = await request.json();
    return HttpResponse.json(body);
  }),

  http.post(`${BASE}/shutdown`, () => new HttpResponse(null, { status: 200 })),

  http.post(`${BASE}/upload`, () =>
    HttpResponse.json({
      files: [{ id: "file-uploaded-1" }],
    }),
  ),
];
