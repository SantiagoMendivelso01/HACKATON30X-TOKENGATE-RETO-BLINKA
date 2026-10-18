// Persistence in Supabase. The secret key is read server-side only; the browser never talks to
// Supabase. Schema: supabase/migrations/20261017000000_persistencia.sql.
import { createServerFn } from "@tanstack/react-start";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { ORG } from "./org";
import { emptyRows, type Rows } from "./org-state";
import { defaultConfig } from "./org-state";
import { publicRecords } from "./public-records";

function db(): SupabaseClient | null {
  const url = process.env["TOKENGATE_DATABASE_URL"] ?? process.env["SUPABASE_URL"];
  const key = process.env["TOKENGATE_DATABASE_SECRET_KEY"] ?? process.env["SUPABASE_SERVICE_KEY"];
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const headers = new Headers(input instanceof Request ? input.headers : undefined);
        new Headers(init?.headers).forEach((value, name) => headers.set(name, value));
        if (key.startsWith("sb_") && headers.get("Authorization") === `Bearer ${key}`)
          headers.delete("Authorization");
        headers.set("apikey", key);
        return fetch(input, { ...init, headers });
      },
    },
  });
}

/** "supabase": every action is saved before it shows. "memory": no keys, nothing survives a reload. */
export type StorageMode = "supabase" | "memory" | "readonly";

export type LoadResult = { ok: true; mode: StorageMode; rows: Rows } | { ok: false; error: string };

const PAGE = 1000; // PostgREST returns at most 1000 rows per request.

async function selectAll<T>(sb: SupabaseClient, table: string, order: string): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await sb
      .from(table)
      .select("payload")
      .order(order)
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`${table}: ${error.message}`);
    out.push(...(data as { payload: T }[]).map((r) => r.payload));
    if (data.length < PAGE) return out;
  }
}

export const loadOrgState = createServerFn({ method: "GET" }).handler(
  async (): Promise<LoadResult> => {
    const sb = db();
    if (!sb) return { ok: true, mode: "memory", rows: emptyRows() };
    try {
      const [subjects, reviews, policies, audit] = await Promise.all([
        selectAll<Rows["subjects"][number]>(sb, "pagador_subjects", "received_at"),
        selectAll<Rows["reviews"][number]>(sb, "pagador_reviews", "at"),
        selectAll<Rows["policies"][number]>(sb, "pagador_policies", "seq"),
        selectAll<Rows["audit"][number]>(sb, "pagador_audit_events", "at"),
      ]);
      return {
        ok: true,
        mode: "readonly",
        rows: publicRecords({ subjects, reviews, policies, audit }, defaultConfig()),
      };
    } catch (e) {
      const missing = e instanceof Error && /does not exist|schema cache/i.test(e.message);
      return {
        ok: false,
        error: missing
          ? "Faltan las tablas necesarias en la base de datos."
          : "No se pudo leer la base de datos. Revisa la conexión privada.",
      };
    }
  },
);

// Shape checks only: the full objects come from the app's own reducer.
const Obj = <T extends z.ZodRawShape>(shape: T) => z.object(shape).passthrough();
const Iso = z.string().datetime({ offset: true });
const Writes = z.object({
  subjects: z
    .array(
      Obj({
        id: z.string().min(1).max(200),
        kind: z.enum(["invoice", "purchase"]),
        reference: z.string().min(1).max(200),
        receivedAt: Iso,
        amount: Obj({ amountMinor: z.number().int(), currency: z.string().length(3) }),
      }),
    )
    .max(50),
  reviews: z
    .array(
      Obj({
        id: z.string().min(1).max(200),
        subjectId: z.string().min(1).max(200),
        at: Iso,
        humanAction: z.enum(["approved", "rejected", "info_requested"]),
      }),
    )
    .max(50),
  policies: z.array(Obj({ version: z.string().min(1).max(20) })).max(10),
  audit: z
    .array(Obj({ id: z.string().min(1).max(200), type: z.string().min(1).max(40), at: Iso }))
    .max(50),
});

export const saveWrites = createServerFn({ method: "POST" })
  .validator((d: unknown) => Writes.parse(d))
  .handler(async ({ data }): Promise<{ ok: true } | { ok: false; error: string }> => {
    // Public anonymized projection must never grant writes to the source database.
    if (process.env["TOKENGATE_DATABASE_SECRET_KEY"])
      return {
        ok: false,
        error:
          "Los registros originales son de solo lectura; las acciones del panel son simuladas.",
      };
    const sb = db();
    if (!sb) return { ok: true };
    const { error } = await sb.rpc("pagador_save_writes", { p_org: ORG.id, p_writes: data });
    if (!error) return { ok: true };
    console.error("Supabase save error", error.code, error.message);
    return {
      ok: false,
      error:
        error.code === "23505"
          ? "Ese registro ya existe en la base de datos. Recarga la página."
          : "No se pudo guardar en la base de datos. No se aplicó ningún cambio.",
    };
  });
