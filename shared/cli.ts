import { layoutDocument, defaults } from "./layout.ts";
import { parseTokens } from "./equations.ts";
let input = "";
for await (const chunk of process.stdin) input += chunk;
const payload = JSON.parse(input);
const result =
  payload.action === "parse"
    ? parseTokens(payload.source_text, payload.equation_mode)
    : layoutDocument(payload.source_text, { ...defaults, ...payload });
process.stdout.write(JSON.stringify(result));
