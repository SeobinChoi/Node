import assert from "node:assert/strict";
import {
    asRecord,
    parseJsonObject,
    scanMilitarySensitiveContent,
    type SecuritySeverity,
} from "../lib/ai/military-documents";

const flags = scanMilitarySensitiveContent([
    "담당자 연락처 010-1234-5678, 이메일 reviewer@example.mil",
    "위치 확인: GPS 37.12345, 127.12345 및 좌표 확인 필요",
    "상황실 CCTV와 암구호는 제출본에서 제거",
]);

const byId = new Map(flags.map((flag) => [flag.id, flag]));

function assertFlag(id: string, severity: SecuritySeverity) {
    const flag = byId.get(id);
    assert.ok(flag, `expected ${id} flag`);
    assert.equal(flag.severity, severity);
    assert.ok(flag.matchCount >= 1);
    assert.ok(flag.guidance.length > 20);
}

assertFlag("phone_number", "medium");
assertFlag("email_address", "medium");
assertFlag("precise_location", "high");
assertFlag("classified_or_operational_term", "high");

const parsed = parseJsonObject('{"title":"검토 요약","reviewChecklist":["사실 확인"]}');
assert.equal(parsed.title, "검토 요약");
assert.deepEqual(parsed.reviewChecklist, ["사실 확인"]);

const fenced = parseJsonObject('```json\n{"title":"코드블록 JSON","reviewChecklist":["보안 확인"]}\n```');
assert.equal(fenced.title, "코드블록 JSON");
assert.deepEqual(fenced.reviewChecklist, ["보안 확인"]);

const embedded = parseJsonObject('요약 결과:\n{"title":"본문 내 JSON","reviewChecklist":["출처 확인"]}\n검토 바랍니다.');
assert.equal(embedded.title, "본문 내 JSON");
assert.deepEqual(embedded.reviewChecklist, ["출처 확인"]);

const fallback = parseJsonObject("not-json");
assert.equal(fallback.title, "AI response parsing failed");
assert.ok(Array.isArray(fallback.reviewChecklist));

assert.deepEqual(asRecord({ ok: true }), { ok: true });
assert.deepEqual(asRecord(["not", "record"]), {});
assert.deepEqual(asRecord(null), {});

console.log(`PASS military documents helper smoke (${flags.length} flags)`);
