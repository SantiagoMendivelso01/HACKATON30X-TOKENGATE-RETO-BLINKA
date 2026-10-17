// Simulated demo organizations. No record here represents a real payment or transfer.
import type { OrgId, OrgSeed } from "./types";
import { andes } from "./orgs/andes";
import { acme } from "./orgs/acme";

export const ORGS: Record<OrgId, OrgSeed> = { andes, acme };
export const ORG_IDS: OrgId[] = ["andes", "acme"];
export const DEFAULT_ORG: OrgId = "andes";
