"use client";

import { useMemo, useState } from "react";
import {
    AlertTriangle,
    ClipboardCheck,
    ClipboardList,
    Copy,
    FileText,
    Loader2,
    RotateCcw,
    Save,
    ShieldCheck,
    Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
    firstText,
    generatedToMarkdown,
    type MilitaryConsoleSecurityFlag,
    visibleEntries,
} from "@/lib/ai/military-console-format";
import {
    buildMilitaryAIRequestBody,
    DEFAULT_FIELD_VALUES,
    type ToolId,
} from "@/lib/ai/military-console-request";

interface MilitaryAIConsoleProps {
    projectId: string;
}

interface ToolConfig {
    id: ToolId;
    label: string;
    endpoint: string;
    sourceLabel: string;
    sourcePlaceholder: string;
    icon: typeof FileText;
}

interface MilitaryAIResponse {
    generated?: Record<string, unknown>;
    securityFlags?: MilitaryConsoleSecurityFlag[];
    localFlags?: MilitaryConsoleSecurityFlag[];
    model?: string;
    error?: string;
}

const TOOL_CONFIGS: ToolConfig[] = [
    {
        id: "adminDocument",
        label: "Admin document",
        endpoint: "/api/ai/admin-document",
        sourceLabel: "Source notes",
        sourcePlaceholder: "회의 결과, 요청 배경, 필요한 조치, 결재 대상...",
        icon: FileText,
    },
    {
        id: "meetingSummary",
        label: "Meeting minutes",
        endpoint: "/api/ai/meeting-summary",
        sourceLabel: "Meeting notes",
        sourcePlaceholder: "참석자 발언, 결정사항, 미결 과제, 후속 일정...",
        icon: ClipboardList,
    },
    {
        id: "aarSummary",
        label: "AAR summary",
        endpoint: "/api/ai/aar-summary",
        sourceLabel: "Training notes",
        sourcePlaceholder: "훈련 목표, 관찰 내용, 유지할 점, 개선할 점...",
        icon: ClipboardCheck,
    },
    {
        id: "weeklyReport",
        label: "Weekly report",
        endpoint: "/api/ai/weekly-report",
        sourceLabel: "Weekly updates",
        sourcePlaceholder: "완료 사항, 진행 중 이슈, 위험 요소, 차주 계획...",
        icon: Sparkles,
    },
    {
        id: "securityScan",
        label: "Security scan",
        endpoint: "/api/ai/security-scan",
        sourceLabel: "Text to review",
        sourcePlaceholder: "제출 전 점검할 문장이나 보고서 초안...",
        icon: ShieldCheck,
    },
];

function KeyValue({ label, value }: { label: string; value: string }) {
    return (
        <div className="space-y-1">
            <Label htmlFor={label} className="text-xs text-muted-foreground">
                {label}
            </Label>
            <Input id={label} value={value} readOnly className="h-8 bg-muted/40 text-xs" />
        </div>
    );
}

function JsonValue({ value }: { value: unknown }) {
    if (Array.isArray(value)) {
        return (
            <div className="space-y-2">
                {value.map((item, index) => (
                    <div key={index} className="rounded-md border bg-background p-3 text-sm">
                        {typeof item === "object" && item !== null ? (
                            <div className="space-y-2">
                                {visibleEntries(item as Record<string, unknown>).map(([key, nestedValue]) => (
                                    <div key={key}>
                                        <div className="mb-1 text-xs font-medium text-muted-foreground">{key}</div>
                                        <JsonValue value={nestedValue} />
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p>{String(item)}</p>
                        )}
                    </div>
                ))}
            </div>
        );
    }

    if (typeof value === "object" && value !== null) {
        return (
            <div className="space-y-2">
                {visibleEntries(value as Record<string, unknown>).map(([key, nestedValue]) => (
                    <div key={key}>
                        <div className="mb-1 text-xs font-medium text-muted-foreground">{key}</div>
                        <JsonValue value={nestedValue} />
                    </div>
                ))}
            </div>
        );
    }

    return <p className="whitespace-pre-wrap text-sm leading-6">{String(value)}</p>;
}

function FieldInputs({
    toolId,
    fields,
    setField,
}: {
    toolId: ToolId;
    fields: Record<string, string>;
    setField: (key: string, value: string) => void;
}) {
    if (toolId === "adminDocument") {
        return (
            <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-1.5">
                    <Label>Document type</Label>
                    <Select value={fields.documentType} onValueChange={(value) => setField("documentType", value)}>
                        <SelectTrigger className="w-full">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="official_memo">Official memo</SelectItem>
                            <SelectItem value="request">Request</SelectItem>
                            <SelectItem value="training_plan">Training plan</SelectItem>
                            <SelectItem value="operation_support">Operation support</SelectItem>
                            <SelectItem value="after_action_note">After action note</SelectItem>
                            <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <div className="space-y-1.5">
                    <Label>Audience</Label>
                    <Input value={fields.audience} onChange={(e) => setField("audience", e.target.value)} />
                </div>
                <div className="space-y-1.5">
                    <Label>Tone</Label>
                    <Select value={fields.tone} onValueChange={(value) => setField("tone", value)}>
                        <SelectTrigger className="w-full">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="formal">Formal</SelectItem>
                            <SelectItem value="concise">Concise</SelectItem>
                            <SelectItem value="commander_brief">Commander brief</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>
        );
    }

    if (toolId === "meetingSummary") {
        return (
            <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-1.5 sm:col-span-2">
                    <Label>Meeting title</Label>
                    <Input value={fields.meetingTitle} onChange={(e) => setField("meetingTitle", e.target.value)} />
                </div>
                <div className="space-y-1.5">
                    <Label>Style</Label>
                    <Select value={fields.summaryStyle} onValueChange={(value) => setField("summaryStyle", value)}>
                        <SelectTrigger className="w-full">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="minutes">Minutes</SelectItem>
                            <SelectItem value="commander_brief">Commander brief</SelectItem>
                            <SelectItem value="action_tracker">Action tracker</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>
        );
    }

    if (toolId === "aarSummary") {
        return (
            <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-1.5 sm:col-span-2">
                    <Label>Training name</Label>
                    <Input value={fields.trainingName} onChange={(e) => setField("trainingName", e.target.value)} />
                </div>
                <div className="space-y-1.5">
                    <Label>Risk review</Label>
                    <Select value={fields.includeRiskReview} onValueChange={(value) => setField("includeRiskReview", value)}>
                        <SelectTrigger className="w-full">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="true">Include</SelectItem>
                            <SelectItem value="false">Skip</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>
        );
    }

    if (toolId === "weeklyReport") {
        return (
            <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                    <Label>Week</Label>
                    <Input value={fields.weekOf} onChange={(e) => setField("weekOf", e.target.value)} />
                </div>
                <div className="space-y-1.5">
                    <Label>Unit label</Label>
                    <Input value={fields.unitLabel} onChange={(e) => setField("unitLabel", e.target.value)} />
                </div>
            </div>
        );
    }

    return (
        <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
                <Label>Context</Label>
                <Select value={fields.contextType} onValueChange={(value) => setField("contextType", value)}>
                    <SelectTrigger className="w-full">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="admin_document">Admin document</SelectItem>
                        <SelectItem value="meeting_minutes">Meeting minutes</SelectItem>
                        <SelectItem value="aar">AAR</SelectItem>
                        <SelectItem value="weekly_report">Weekly report</SelectItem>
                        <SelectItem value="screenshot_note">Screenshot note</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                </Select>
            </div>
            <div className="space-y-1.5">
                <Label>Review mode</Label>
                <Select value={fields.reviewMode} onValueChange={(value) => setField("reviewMode", value)}>
                    <SelectTrigger className="w-full">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="submission">Submission</SelectItem>
                        <SelectItem value="quick">Quick</SelectItem>
                    </SelectContent>
                </Select>
            </div>
        </div>
    );
}

export function MilitaryAIConsole({ projectId }: MilitaryAIConsoleProps) {
    const [activeTool, setActiveTool] = useState<ToolId>("adminDocument");
    const [sourceText, setSourceText] = useState("");
    const [fields, setFields] = useState<Record<string, string>>(DEFAULT_FIELD_VALUES);
    const [result, setResult] = useState<MilitaryAIResponse | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isSavingNode, setIsSavingNode] = useState(false);
    const [savedNodeId, setSavedNodeId] = useState<string | null>(null);

    const activeConfig = useMemo(
        () => TOOL_CONFIGS.find((tool) => tool.id === activeTool) ?? TOOL_CONFIGS[0],
        [activeTool]
    );
    const ActiveIcon = activeConfig.icon;
    const flags = [...(result?.securityFlags ?? []), ...(result?.localFlags ?? [])];

    const setField = (key: string, value: string) => {
        setFields((current) => ({ ...current, [key]: value }));
    };

    const handleGenerate = async () => {
        const trimmedSource = sourceText.trim();
        if (!trimmedSource) {
            toast.error("Source text is required");
            return;
        }

        setIsLoading(true);
        try {
            const res = await fetch(activeConfig.endpoint, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(buildMilitaryAIRequestBody(activeTool, projectId, trimmedSource, fields)),
            });
            const data = (await res.json()) as MilitaryAIResponse;
            if (!res.ok) {
                throw new Error(data.error || "Generation failed");
            }
            setResult(data);
            setSavedNodeId(null);
            toast.success("AI output generated");
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Failed to generate");
        } finally {
            setIsLoading(false);
        }
    };

    const handleCopy = async () => {
        if (!result) return;
        await navigator.clipboard.writeText(JSON.stringify(result, null, 2));
        toast.success("Copied");
    };

    const handleSaveAsNode = async () => {
        if (!result?.generated) {
            toast.error("Generate output before saving");
            return;
        }

        const title = (firstText(result.generated, ["title", "summary"]) || activeConfig.label).slice(0, 180);
        const description = firstText(result.generated, ["summary", "safeRewrite", "draft"]).slice(0, 1000);
        const contentMarkdown = generatedToMarkdown(activeConfig.label, result.generated, flags);

        setIsSavingNode(true);
        try {
            const createRes = await fetch(`/api/projects/${projectId}/nodes`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    title,
                    description,
                    type: "TASK",
                    manualStatus: "TODO",
                    priority: flags.some((flag) => flag.severity === "high") ? 2 : 3,
                    phase: "Military AI",
                }),
            });
            const created = await createRes.json();
            if (!createRes.ok) {
                throw new Error(created.message || created.error || "Failed to create node");
            }

            const nodeId = String(created.id || "");
            if (!nodeId) {
                throw new Error("Node was created without an id");
            }

            const pageRes = await fetch(`/api/nodes/${nodeId}/page`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ contentMarkdown }),
            });
            if (!pageRes.ok) {
                const pageError = await pageRes.json();
                throw new Error(pageError.error || "Node created, but page save failed");
            }

            setSavedNodeId(nodeId);
            toast.success("Saved as project node");
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Failed to save node");
        } finally {
            setIsSavingNode(false);
        }
    };

    const handleReset = () => {
        setSourceText("");
        setResult(null);
        setSavedNodeId(null);
        setFields(DEFAULT_FIELD_VALUES);
    };

    return (
        <div className="mx-auto flex max-w-7xl flex-col gap-4 p-4 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg border bg-background">
                        <ActiveIcon className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div>
                        <h2 className="text-xl font-semibold tracking-normal">Military AI</h2>
                        <div className="mt-1 flex flex-wrap gap-2">
                            <Badge variant="secondary">Project scoped</Badge>
                            <Badge variant={flags.length > 0 ? "destructive" : "success"}>
                                {flags.length > 0 ? `${flags.length} flag(s)` : "No local flags"}
                            </Badge>
                        </div>
                    </div>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={handleReset} disabled={isLoading}>
                        <RotateCcw className="h-4 w-4" />
                        Reset
                    </Button>
                    <Button variant="outline" onClick={handleSaveAsNode} disabled={!result?.generated || isSavingNode}>
                        {isSavingNode ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                        Save as node
                    </Button>
                    <Button onClick={handleGenerate} disabled={isLoading}>
                        {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                        Generate
                    </Button>
                </div>
            </div>

            <div className="grid gap-4 xl:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
                <Card className="rounded-lg">
                    <CardHeader>
                        <CardTitle className="text-base">Input</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-1.5">
                            <Label>Mode</Label>
                            <Select value={activeTool} onValueChange={(value) => setActiveTool(value as ToolId)}>
                                <SelectTrigger className="w-full">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {TOOL_CONFIGS.map((tool) => (
                                        <SelectItem key={tool.id} value={tool.id}>
                                            {tool.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <FieldInputs toolId={activeTool} fields={fields} setField={setField} />

                        {(activeTool === "adminDocument" || activeTool === "meetingSummary") && (
                            <div className="space-y-1.5">
                                <Label>{activeTool === "adminDocument" ? "Constraints" : "Attendees"}</Label>
                                <Input
                                    value={activeTool === "adminDocument" ? fields.constraints : fields.attendees}
                                    onChange={(e) =>
                                        setField(activeTool === "adminDocument" ? "constraints" : "attendees", e.target.value)
                                    }
                                />
                            </div>
                        )}

                        {(activeTool === "aarSummary" || activeTool === "weeklyReport") && (
                            <div className="space-y-1.5">
                                <Label>{activeTool === "aarSummary" ? "Focus areas" : "Commander focus"}</Label>
                                <Input
                                    value={activeTool === "aarSummary" ? fields.focusAreas : fields.commanderFocus}
                                    onChange={(e) =>
                                        setField(activeTool === "aarSummary" ? "focusAreas" : "commanderFocus", e.target.value)
                                    }
                                />
                            </div>
                        )}

                        <div className="space-y-1.5">
                            <Label>{activeConfig.sourceLabel}</Label>
                            <Textarea
                                value={sourceText}
                                onChange={(e) => setSourceText(e.target.value)}
                                placeholder={activeConfig.sourcePlaceholder}
                                rows={14}
                                className="min-h-[20rem] resize-y"
                            />
                        </div>
                    </CardContent>
                </Card>

                <Card className="rounded-lg">
                    <CardHeader>
                        <div className="flex items-center justify-between gap-3">
                            <CardTitle className="text-base">Output</CardTitle>
                            <Button variant="outline" size="sm" onClick={handleCopy} disabled={!result}>
                                <Copy className="h-4 w-4" />
                                Copy JSON
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {result?.model && <KeyValue label="model" value={result.model} />}

                        {savedNodeId && (
                            <div className="rounded-lg border bg-muted/40 p-3 text-sm">
                                Saved as node <span className="font-mono">{savedNodeId}</span>
                            </div>
                        )}

                        {flags.length > 0 && (
                            <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-950">
                                <div className="flex items-center gap-2 text-sm font-medium">
                                    <AlertTriangle className="h-4 w-4" />
                                    Review flags
                                </div>
                                <div className="space-y-2">
                                    {flags.map((flag) => (
                                        <div key={`${flag.id}-${flag.label}`} className="rounded-md bg-white/70 p-2 text-sm">
                                            <div className="font-medium">
                                                {flag.label} ({flag.matchCount})
                                            </div>
                                            <p className="mt-1 text-xs leading-5">{flag.guidance}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {result?.generated ? (
                            <div className="space-y-4">
                                {visibleEntries(result.generated).map(([key, value]) => (
                                    <div key={key} className="space-y-2">
                                        <h3 className="text-sm font-semibold capitalize">{key}</h3>
                                        <JsonValue value={value} />
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="flex min-h-[28rem] items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
                                No output
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
