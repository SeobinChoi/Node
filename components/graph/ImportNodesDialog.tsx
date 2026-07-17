"use client";

import { useRef, useState } from "react";
import { FileSpreadsheet, Upload, Download, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  parseImportFile,
  downloadImportTemplate,
  type ImportRow,
} from "@/lib/utils/node-xlsx";

interface ImportNodesDialogProps {
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported: () => void;
}

export function ImportNodesDialog({
  projectId,
  open,
  onOpenChange,
  onImported,
}: ImportNodesDialogProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [skipped, setSkipped] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ createdCount: number; unmatchedOwners: string[] } | null>(null);

  const reset = () => {
    setFileName(null);
    setRows([]);
    setSkipped(0);
    setError(null);
    setDone(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleFile = async (file: File) => {
    setError(null);
    setDone(null);
    try {
      const parsed = await parseImportFile(file);
      if (parsed.rows.length === 0) {
        setError("업무명이 있는 행을 찾지 못했습니다. 양식을 확인해 주세요.");
        return;
      }
      if (parsed.rows.length > 200) {
        setError(`한 번에 200건까지 등록할 수 있습니다. (현재 ${parsed.rows.length}건)`);
        return;
      }
      setFileName(file.name);
      setRows(parsed.rows);
      setSkipped(parsed.skipped);
    } catch {
      setError("파일을 읽지 못했습니다. .xlsx 또는 .csv 파일인지 확인해 주세요.");
    }
  };

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/nodes/bulk`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "등록에 실패했습니다");
      setDone({ createdCount: body.createdCount, unmatchedOwners: body.unmatchedOwners ?? [] });
      onImported();
    } catch (e) {
      setError(e instanceof Error ? e.message : "등록에 실패했습니다");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) reset();
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-4 w-4 text-brand" />
            엑셀로 업무 가져오기
          </DialogTitle>
          <DialogDescription>
            업무명·구분·담당자·기한·상태 컬럼이 있는 .xlsx 또는 .csv 파일을 올리면 한 번에
            등록됩니다.
          </DialogDescription>
        </DialogHeader>

        {done ? (
          <div className="rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm">
            <p className="font-medium text-foreground">{done.createdCount}건 등록 완료</p>
            {done.unmatchedOwners.length > 0 && (
              <p className="mt-1 text-xs text-muted-foreground">
                프로젝트 멤버와 이름이 일치하지 않아 담당자가 비워진 이름:{" "}
                {done.unmatchedOwners.join(", ")}
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
              }}
            />
            <button
              onClick={() => fileRef.current?.click()}
              className="flex w-full flex-col items-center gap-2 rounded-lg border border-dashed border-border px-4 py-6 text-sm text-muted-foreground transition-colors hover:border-brand hover:text-brand"
            >
              <Upload className="h-5 w-5" />
              {fileName ? (
                <span className="font-medium text-foreground">{fileName}</span>
              ) : (
                <span>클릭해서 파일 선택</span>
              )}
            </button>

            {rows.length > 0 && (
              <div className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                <span className="font-medium text-foreground">{rows.length}건</span> 등록 예정
                {skipped > 0 && <> · 업무명 없는 {skipped}행 제외</>}
                <span className="mt-1 block truncate">
                  {rows.slice(0, 3).map((r) => r.title).join(", ")}
                  {rows.length > 3 && " …"}
                </span>
              </div>
            )}

            {error && <p className="text-xs text-red-600">{error}</p>}

            <button
              onClick={downloadImportTemplate}
              className="inline-flex items-center gap-1 text-xs text-muted-foreground underline-offset-2 hover:text-brand hover:underline"
            >
              <Download className="h-3 w-3" />
              양식 내려받기
            </button>
          </div>
        )}

        <DialogFooter>
          {done ? (
            <Button onClick={() => onOpenChange(false)} className="bg-brand text-brand-foreground hover:bg-brand/90">
              닫기
            </Button>
          ) : (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                취소
              </Button>
              <Button
                onClick={submit}
                disabled={rows.length === 0 || busy}
                className="bg-brand text-brand-foreground hover:bg-brand/90"
              >
                {busy && <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />}
                {rows.length > 0 ? `${rows.length}건 등록` : "등록"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
