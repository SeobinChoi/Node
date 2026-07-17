import * as XLSX from "xlsx";
import { NodeDTO, NodeType, ManualStatus } from "@/types";
import { STATUS_VISUALS } from "@/lib/ui/node-visuals";
import { getOverdueDays, startOfToday } from "@/lib/utils/overdue";

// 엑셀 <-> 노드 변환. 행정 실무자가 쓰는 한국어 컬럼명을 기준으로 한다.
// 컬럼: 업무명(필수) · 구분 · 담당자 · 기한 · 상태 · 비고

const TYPE_FROM_KO: Record<string, NodeType> = {
  "업무": "TASK",
  "task": "TASK",
  "의사결정": "DECISION",
  "결정": "DECISION",
  "decision": "DECISION",
  "장애": "BLOCKER",
  "blocker": "BLOCKER",
  "자료요청": "INFOREQ",
  "자료 요청": "INFOREQ",
  "정보요청": "INFOREQ",
  "info": "INFOREQ",
};

const STATUS_FROM_KO: Record<string, ManualStatus> = {
  "예정": "TODO",
  "todo": "TODO",
  "진행": "DOING",
  "진행중": "DOING",
  "doing": "DOING",
  "완료": "DONE",
  "done": "DONE",
};

const TYPE_TO_KO: Record<NodeType, string> = {
  TASK: "업무",
  DECISION: "의사결정",
  BLOCKER: "장애",
  INFOREQ: "자료요청",
};

export interface ImportRow {
  title: string;
  type: NodeType;
  manualStatus: ManualStatus;
  ownerName: string | null;
  dueAt: string | null;
  description: string | null;
}

export interface ParseResult {
  rows: ImportRow[];
  skipped: number; // 업무명이 없어 건너뛴 행 수
}

function cellString(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v).trim();
}

/** 첫 시트를 읽어 ImportRow[]로 변환. 헤더는 한국어/영문 모두 허용. */
export async function parseImportFile(file: File): Promise<ParseResult> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { cellDates: true });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  if (!sheet) return { rows: [], skipped: 0 };

  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });

  const pick = (row: Record<string, unknown>, keys: string[]): string => {
    for (const k of Object.keys(row)) {
      if (keys.includes(k.trim().toLowerCase())) return cellString(row[k]);
    }
    return "";
  };

  const rows: ImportRow[] = [];
  let skipped = 0;
  for (const r of raw) {
    const title = pick(r, ["업무명", "제목", "title", "task"]);
    if (!title) {
      skipped++;
      continue;
    }
    const typeRaw = pick(r, ["구분", "종류", "type"]).toLowerCase();
    const statusRaw = pick(r, ["상태", "status"]).toLowerCase();
    rows.push({
      title,
      type: TYPE_FROM_KO[typeRaw] ?? "TASK",
      manualStatus: STATUS_FROM_KO[statusRaw] ?? "TODO",
      ownerName: pick(r, ["담당자", "담당", "owner"]) || null,
      dueAt: pick(r, ["기한", "마감", "마감일", "due", "dueat"]) || null,
      description: pick(r, ["비고", "설명", "note", "description"]) || null,
    });
  }
  return { rows, skipped };
}

/** 현재 노드 목록을 보고서형 xlsx로 내려받는다. */
export function exportNodesToXlsx(nodes: NodeDTO[], projectName: string) {
  const todayMs = startOfToday();
  const data = nodes.map((n) => {
    const overdue = getOverdueDays(n, todayMs);
    return {
      업무명: n.title,
      구분: TYPE_TO_KO[n.type] ?? n.type,
      담당자: n.owners?.map((o) => o.name).join(", ") || n.ownerName || "-",
      기한: n.dueAt ? n.dueAt.slice(0, 10) : "-",
      상태: STATUS_VISUALS[n.computedStatus]?.label ?? n.computedStatus,
      비고: overdue !== null ? `지연 ${overdue}일` : "",
    };
  });

  const ws = XLSX.utils.json_to_sheet(data);
  ws["!cols"] = [{ wch: 40 }, { wch: 10 }, { wch: 14 }, { wch: 12 }, { wch: 8 }, { wch: 16 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "사업 진척 현황");
  const date = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `${projectName}_진척현황_${date}.xlsx`);
}

/** 가져오기 양식(빈 템플릿) 다운로드 */
export function downloadImportTemplate() {
  const ws = XLSX.utils.json_to_sheet([
    { 업무명: "예: 학과별 실적 자료 취합", 구분: "업무", 담당자: "", 기한: "2026-08-31", 상태: "예정", 비고: "" },
  ]);
  ws["!cols"] = [{ wch: 40 }, { wch: 10 }, { wch: 14 }, { wch: 12 }, { wch: 8 }, { wch: 16 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "업무 목록");
  XLSX.writeFile(wb, "업무_가져오기_양식.xlsx");
}
