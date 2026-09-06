import type { EvaluationResult } from "@/lib/demo/ops-radar-types";

export function OpsRadarMetrics({ result, baseline }: { result?: EvaluationResult; baseline?: EvaluationResult }) {
  const metrics = result?.metrics ?? { highRisk: 0, delayed: 0, reportReady: 0 };
  const cards = [
    { label: "고위험", value: metrics.highRisk, tone: "border-red-200 bg-red-50 text-red-800", key: "highRisk" as const },
    { label: "지연", value: metrics.delayed, tone: "border-amber-200 bg-amber-50 text-amber-900", key: "delayed" as const },
    { label: "보고 가능", value: metrics.reportReady, tone: "border-emerald-200 bg-emerald-50 text-emerald-900", key: "reportReady" as const },
  ];
  return <section aria-label="업무 평가 지표" className="grid grid-cols-3 gap-2 sm:gap-3">
    {cards.map((card) => {
      const change = baseline && result ? metrics[card.key] - baseline.metrics[card.key] : 0;
      return <div key={card.label} data-testid={`ops-metric-${card.key}`} className={`min-w-0 rounded-lg border p-3 ${card.tone}`}>
        <p className="text-xs font-medium">{card.label}</p>
        <p className="mt-1 text-2xl font-bold tabular-nums">{result ? card.value : "-"}</p>
        {baseline && result && change !== 0 ? <p className="mt-1 text-xs">평가 전 대비 {change > 0 ? "+" : ""}{change}</p> : <p className="mt-1 text-xs">{result ? "규칙 기반 산출" : "평가 실행 후 표시"}</p>}
      </div>;
    })}
  </section>;
}
