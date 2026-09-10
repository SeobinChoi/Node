import { describe, it, expect } from "vitest";
import {
  PUBLIC_DOCUMENT_EXAMPLES,
  examplesForTool,
  exampleById,
  isUnmodifiedExample,
  type PublicDocumentTool,
} from "./public-document-examples";

const TOOLS: PublicDocumentTool[] = [
  "adminDocument",
  "approvalDocument",
  "meetingSummary",
  "aarSummary",
  "weeklyReport",
  "securityScan",
];

// 실제형 군번/주민번호 패턴: 6자리-7자리 숫자 (주민등록번호 형식)
const RESIDENT_NUMBER_PATTERN = /\d{6}-\d{7}/;
// 정밀좌표 패턴: 위도/경도 소수점 표기 또는 MGRS 격자 좌표
const PRECISE_COORDINATE_PATTERN = /-?\d{1,3}\.\d{4,}\s*[°]?\s*[NSEW]|\b\d{2}[A-Z]{3}\s?\d{4,}\s?\d{4,}\b/;
// 실제형 군 부대번호 패턴: 제N사단/여단/연대/대대/중대/함대
const UNIT_NUMBER_PATTERN = /제\s?\d+\s?(사단|여단|연대|대대|중대|전투비행단|함대|전대)/;
const PHONE_PATTERN = /01[016789]-\d{3,4}-\d{4}/g;
const SAFE_DEMO_PHONES = new Set(["010-0000-0000", "010-1111-1111"]);

// 날짜: 2026-09-05 또는 9월 5일 형태
const DATE_PATTERN = /\d{4}-\d{2}-\d{2}|\d{1,2}월\s?\d{1,2}일/g;
// 역할 라벨: "OO과", "OO관", "OO반", "OO담당관" 등으로 끝나는 2자 이상 토큰
const ROLE_LABEL_PATTERN = /[가-힣]{2,}(과장|담당관|담당자|책임자|관리관|반장|팀장|계장)/g;
// 수치 사실: 숫자 뒤에 단위/명사가 붙는 형태
const NUMERIC_FACT_PATTERN = /\d+[가-힣%명건개원km㎞]/g;

describe("PUBLIC_DOCUMENT_EXAMPLES catalog", () => {
  it("has exactly 18 examples", () => {
    expect(PUBLIC_DOCUMENT_EXAMPLES).toHaveLength(18);
  });

  it("has exactly 3 examples per tool", () => {
    for (const tool of TOOLS) {
      const forTool = PUBLIC_DOCUMENT_EXAMPLES.filter((example) => example.tool === tool);
      expect(forTool, `tool ${tool}`).toHaveLength(3);
    }
  });

  it("has unique ids", () => {
    const ids = PUBLIC_DOCUMENT_EXAMPLES.map((example) => example.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("has no duplicate sourceText across examples", () => {
    const sources = PUBLIC_DOCUMENT_EXAMPLES.map((example) => example.sourceText);
    expect(new Set(sources).size).toBe(sources.length);
  });

  it("has no blank fields", () => {
    for (const example of PUBLIC_DOCUMENT_EXAMPLES) {
      expect(example.id.trim(), example.id).not.toBe("");
      expect(example.label.trim(), example.id).not.toBe("");
      expect(example.sourceText.trim(), example.id).not.toBe("");
      expect(example.baselineResult.title.trim(), example.id).not.toBe("");
      expect(example.baselineResult.summary.trim(), example.id).not.toBe("");
    }
  });

  it("has a complete baselineResult with sections and actions for every example", () => {
    for (const example of PUBLIC_DOCUMENT_EXAMPLES) {
      const { baselineResult } = example;
      expect(baselineResult.sections.length, example.id).toBeGreaterThan(0);
      for (const section of baselineResult.sections) {
        expect(section.label.trim(), example.id).not.toBe("");
        expect(section.body.trim(), example.id).not.toBe("");
      }
      expect(baselineResult.actions.length, example.id).toBeGreaterThan(0);
      for (const action of baselineResult.actions) {
        expect(action.title.trim(), example.id).not.toBe("");
        expect(action.owner.trim(), example.id).not.toBe("");
        expect(action.dueDate.trim(), example.id).not.toBe("");
        expect(["low", "medium", "high"], example.id).toContain(action.risk);
      }
    }
  });

  it("never contains resident-registration-number, precise-coordinate, or real unit-number patterns", () => {
    for (const example of PUBLIC_DOCUMENT_EXAMPLES) {
      const haystack = [
        example.sourceText,
        example.baselineResult.title,
        example.baselineResult.summary,
        ...example.baselineResult.sections.map((s) => s.body),
      ].join("\n");
      expect(haystack, example.id).not.toMatch(RESIDENT_NUMBER_PATTERN);
      expect(haystack, example.id).not.toMatch(PRECISE_COORDINATE_PATTERN);
      expect(haystack, example.id).not.toMatch(UNIT_NUMBER_PATTERN);
    }
  });

  it("uses only obvious demo phone numbers", () => {
    for (const example of PUBLIC_DOCUMENT_EXAMPLES) {
      const haystack = `${example.sourceText}\n${JSON.stringify(example.baselineResult)}`;
      for (const phone of haystack.match(PHONE_PATTERN) ?? []) {
        expect(SAFE_DEMO_PHONES.has(phone), `${example.id}: ${phone}`).toBe(true);
      }
    }
  });

  it("has at least 2 dates, 2 role labels, and 2 numeric facts in each sourceText", () => {
    for (const example of PUBLIC_DOCUMENT_EXAMPLES) {
      const dates = example.sourceText.match(DATE_PATTERN) ?? [];
      const roles = example.sourceText.match(ROLE_LABEL_PATTERN) ?? [];
      const numericFacts = example.sourceText.match(NUMERIC_FACT_PATTERN) ?? [];
      expect(dates.length, `${example.id} dates`).toBeGreaterThanOrEqual(2);
      expect(new Set(roles).size, `${example.id} role labels`).toBeGreaterThanOrEqual(2);
      expect(numericFacts.length, `${example.id} numeric facts`).toBeGreaterThanOrEqual(2);
    }
  });

  it("has a completed fact and an unresolved fact in each sourceText", () => {
    const completedPattern = /완료|종료|마감/;
    const unresolvedPattern = /미완료|미결|미정|예정|대기/;
    for (const example of PUBLIC_DOCUMENT_EXAMPLES) {
      expect(example.sourceText, example.id).toMatch(completedPattern);
      expect(example.sourceText, example.id).toMatch(unresolvedPattern);
    }
  });

  it("has a risk or approval-request signal in each sourceText", () => {
    const riskOrApprovalPattern = /위험|리스크|지연\s?우려|승인\s?요청|결재\s?요청/;
    for (const example of PUBLIC_DOCUMENT_EXAMPLES) {
      expect(example.sourceText, example.id).toMatch(riskOrApprovalPattern);
    }
  });
});

describe("examplesForTool", () => {
  it("returns only examples for the requested tool, in catalog order", () => {
    for (const tool of TOOLS) {
      const result = examplesForTool(tool);
      expect(result).toHaveLength(3);
      expect(result.every((example) => example.tool === tool)).toBe(true);
      const expectedOrder = PUBLIC_DOCUMENT_EXAMPLES.filter((example) => example.tool === tool);
      expect(result.map((e) => e.id)).toEqual(expectedOrder.map((e) => e.id));
    }
  });

  it("returns a stable first example usable as the tool's default", () => {
    const first = examplesForTool("adminDocument")[0];
    expect(first).toBeDefined();
    expect(first.tool).toBe("adminDocument");
  });
});

describe("exampleById", () => {
  it("returns the matching example", () => {
    const known = PUBLIC_DOCUMENT_EXAMPLES[0];
    expect(exampleById(known.id)).toEqual(known);
  });

  it("returns undefined for an unknown id", () => {
    expect(exampleById("does-not-exist")).toBeUndefined();
  });
});

describe("isUnmodifiedExample", () => {
  it("is true when sourceText exactly matches the stored example", () => {
    const known = PUBLIC_DOCUMENT_EXAMPLES[0];
    expect(isUnmodifiedExample(known.id, known.sourceText)).toBe(true);
  });

  it("is false when the sourceText has been edited, even trivially", () => {
    const known = PUBLIC_DOCUMENT_EXAMPLES[0];
    expect(isUnmodifiedExample(known.id, `${known.sourceText} `)).toBe(false);
    expect(isUnmodifiedExample(known.id, known.sourceText.slice(0, -1))).toBe(false);
  });

  it("is false for an unknown exampleId regardless of sourceText", () => {
    expect(isUnmodifiedExample("does-not-exist", "anything")).toBe(false);
  });
});
