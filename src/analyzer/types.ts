import { z } from "zod";

export const InconsistencySeverity = z.enum(["error", "warning", "info"]);
export type InconsistencySeverity = z.infer<typeof InconsistencySeverity>;

export const Inconsistency = z.object({
  id: z.string(),
  rule: z.string(),
  severity: InconsistencySeverity,
  message: z.string(),
  path: z.string().optional(),
  targetId: z.string().optional(),
});
export type Inconsistency = z.infer<typeof Inconsistency>;
