import type { Rows } from "./org-state";
import type { AnySubject, OrgConfig, Supplier } from "./types";

/** Explicit projection: free text, contacts and document identifiers never leave the server. */
export function publicRecords(rows: Rows, fallback: OrgConfig): Rows {
  const configs = rows.audit.flatMap((e) => {
    const config = (e as typeof e & { config?: OrgConfig }).config;
    return config ? [config] : [];
  });
  const config = configs.at(-1) ?? fallback;
  const suppliers = configs.length ? configs.flatMap((c) => c.suppliers) : fallback.suppliers;
  const names = new Map<string, string>();
  const publicName = (name: string) => {
    const existing = names.get(name);
    if (existing) return existing;
    const supplier = suppliers.find((s) => s.name === name);
    const personal =
      /^(CC|CE|DNI|CUIT)\b/i.test(supplier?.taxId ?? "") ||
      (!supplier &&
        !/\b(SAS|S\.A|LLC|Ltd|Inc|AWS|Linear|Microsoft|Google|Amazon|Cloud|Software)\b/i.test(
          name,
        ));
    const alias = personal ? `Proveedor anonimizado ${names.size + 1}` : name;
    names.set(name, alias);
    return alias;
  };
  const publicSupplier = (s: Supplier): Supplier => ({
    name: publicName(s.name),
    taxId: "Identificación oculta",
    bankAccount: "Cuenta oculta",
    country: s.country,
    currency: s.currency,
    contract: { ...s.contract },
    concept: "Servicio contratado",
  });
  const safeConfig: OrgConfig = {
    name: config.name,
    jurisdiction: config.jurisdiction,
    period: config.period,
    inbox: "Correo oculto",
    user: { name: "Usuario anonimizado", role: "Operador", initials: "UA" },
    fx: { ...config.fx },
    baselineUsedMinor: config.baselineUsedMinor,
    suppliers: suppliers.map(publicSupplier),
    agents: config.agents.map((a, i) => ({
      id: `agent-${i + 1}`,
      name: `Agente ${i + 1}`,
      purpose: "Agente de pagos simulados",
      status: a.status,
      categories: [...a.categories],
      spendingLimit: { ...a.spendingLimit },
      policyIds: [],
    })),
  };
  const subjects: AnySubject[] = rows.subjects.map((s, i) => {
    const legacy = (s as AnySubject & { payload?: { opcion_elegida?: { tienda_nombre?: string } } })
      .payload;
    const merchant = s.supplier ?? legacy?.opcion_elegida?.tienda_nombre ?? "Comercio no informado";
    const common = {
      id: `public-${i + 1}`,
      kind: s.kind,
      reference: `Registro ${i + 1}`,
      supplier: legacy?.opcion_elegida?.tienda_nombre ? merchant : publicName(merchant),
      amount: { ...s.amount },
      agentId: "agent-public",
      description: "Documento anonimizado",
      category: s.category ?? "Operaciones",
      missingFields: [...(s.missingFields ?? [])],
      receivedAt: s.receivedAt,
      channel: s.channel ?? "agent",
      ...(s.supplierTaxId ? { supplierTaxId: "Identificación oculta" } : {}),
      ...(s.bankAccount ? { bankAccount: "Cuenta oculta" } : {}),
    };
    return s.kind === "invoice"
      ? {
          ...common,
          kind: "invoice",
          issueDate: s.issueDate,
          dueDate: s.dueDate,
          extractionConfidence: s.extractionConfidence,
        }
      : {
          ...common,
          kind: "purchase",
          requestedAt: s.requestedAt ?? s.receivedAt,
          budgetLine: "Compra anonimizada",
        };
  });
  return {
    subjects,
    reviews: [],
    policies: rows.policies.map((p) => ({
      ...p,
      approvedSuppliers: p.approvedSuppliers.map(publicName),
    })),
    audit: [
      {
        id: "public-config",
        at: "2026-01-01T00:00:00Z",
        type: "system",
        actor: "Sistema",
        actorKind: "system",
        summary: "Datos reales anonimizados · acciones y pagos simulados",
        config: safeConfig,
      } as Rows["audit"][number],
    ],
  };
}
