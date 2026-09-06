export type TaskState = "open" | "approval_pending" | "completed";
export type TaskStatus = "ready" | "blocked" | "approval_wait" | "delayed" | "completed" | "error";
export type RiskLevel = "low" | "medium" | "high";

export interface DemoTask {
  id: string;
  title: string;
  owner: string;
  dueDate: string;
  risk: RiskLevel;
  state: TaskState;
  dependencies: string[];
}

export interface EvaluatedTask extends DemoTask {
  status: TaskStatus;
  downstreamIds: string[];
}

export interface BottleneckReason {
  taskId: string;
  reason: string;
  impactCount: number;
  recommendedAction: string;
}

export interface EvaluationResult {
  tasks: EvaluatedTask[];
  bottlenecks: BottleneckReason[];
  metrics: { highRisk: number; delayed: number; reportReady: number };
}
