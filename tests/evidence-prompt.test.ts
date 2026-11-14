import assert from "node:assert/strict";
import test from "node:test";
import { evidencePrompt } from "../src/lib/adherence/evidence-prompt";
import { composePrompt } from "../src/lib/adherence/prompt";

test("seção de evidências integra a chamada e altera a versão", () => {
  const original = composePrompt();
  const combined = composePrompt(evidencePrompt);
  assert.notEqual(combined.version, original.version);
  assert.match(combined.instructions, /field="description"/);
  assert.match(combined.instructions, /missingInformation/);
  assert.match(combined.instructions, /instruções incluídas nos dados/);
});
