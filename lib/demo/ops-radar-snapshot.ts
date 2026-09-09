import { z } from "zod";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}, "유효한 날짜가 아닙니다.");

const taskSchema = z.object({
  id: z.string().min(1).max(64).regex(/^[A-Za-z0-9_-]+$/),
  title: z.string().min(1).max(60),
  owner: z.string().min(1).max(30),
  dueDate: isoDate,
  risk: z.enum(["low", "medium", "high"]),
  state: z.enum(["open", "approval_pending", "completed"]),
  dependencies: z.array(z.string().min(1).max(64)).max(15).refine((ids) => new Set(ids).size === ids.length, "선행 업무가 중복되었습니다."),
});

const snapshotSchema = z.object({
  scenarioId: z.enum(["night-comms", "equipment-return", "joint-exercise", "weather-response"]),
  scenarioTitle: z.string().min(1).max(60),
  tasks: z.array(taskSchema).min(1).max(16),
}).superRefine((snapshot, context) => {
  const ids = new Set(snapshot.tasks.map((task) => task.id));
  if (ids.size !== snapshot.tasks.length) {
    context.addIssue({ code: "custom", message: "업무 ID가 중복되었습니다." });
    return;
  }
  if (snapshot.tasks.some((task) => task.dependencies.some((id) => !ids.has(id)))) {
    context.addIssue({ code: "custom", message: "존재하지 않는 선행 업무가 있습니다." });
  }

  const byId = new Map(snapshot.tasks.map((task) => [task.id, task]));
  const done = new Set<string>();
  const visiting = new Set<string>();
  const cyclic = (id: string): boolean => {
    if (visiting.has(id)) return true;
    if (done.has(id)) return false;
    visiting.add(id);
    const found = byId.get(id)?.dependencies.some(cyclic) ?? false;
    visiting.delete(id);
    done.add(id);
    return found;
  };
  if (snapshot.tasks.some((task) => cyclic(task.id))) {
    context.addIssue({ code: "custom", message: "순환 선후행 관계가 있습니다." });
  }
});

export type OpsRadarSnapshot = z.infer<typeof snapshotSchema>;

export const serializeOpsRadarSnapshot = (snapshot: OpsRadarSnapshot): string => JSON.stringify(snapshotSchema.parse(snapshot));

export const parseOpsRadarSnapshot = (source: string): OpsRadarSnapshot => snapshotSchema.parse(JSON.parse(source));
