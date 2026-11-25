import { createServer } from "node:http";

const day = (offset: number) => new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);

const contract = {
  funder_name: { value: "Evergreen Foundation", evidence: "Evergreen Foundation", page: 1 },
  award_number: { value: "CW-NEW-1", evidence: "Award number CW-NEW-1", page: 1 },
  award_amount: { value: "151000.50", evidence: "$151,000.50", page: 1 },
  starts_on: { value: "2026-01-01", evidence: "begins on 1 January 2026", page: 2 },
  ends_on: { value: "2026-12-31", evidence: "ends on 31 December 2026", page: 2 },
  deadlines: [
    { title: "Site visit report", type: "report", due_on: day(12), evidence: "Site visit report is due", page: 2 },
    { title: "Unwanted deadline", type: "deliverable", due_on: day(14), evidence: "Unwanted", page: 2 },
  ],
};
const dates = { expires_on: { value: day(300), evidence: "This certificate expires on", page: 1 }, review_on: null };

createServer((request, response) => {
  let body = "";
  request.on("data", (chunk) => (body += chunk));
  request.on("end", () => {
    response.setHeader("content-type", "application/json");
    if (request.url?.includes("count_tokens")) return response.end(JSON.stringify({ input_tokens: 900 }));
    const unreadable = /"data":"([^"]+)"/.exec(body);
    if (unreadable?.[1] && Buffer.from(unreadable[1], "base64").includes("UNREADABLE")) {
      response.statusCode = 500;
      return response.end(JSON.stringify({ type: "error", error: { type: "api_error", message: "down" } }));
    }
    const value = body.includes("funder_name") ? contract : dates;
    return response.end(
      JSON.stringify({
        id: "msg_1",
        type: "message",
        role: "assistant",
        model: "claude-haiku-5-5",
        content: [{ type: "text", text: JSON.stringify(value) }],
        stop_reason: "end_turn",
        stop_sequence: null,
        usage: { input_tokens: 900, output_tokens: 90 },
      }),
    );
  });
}).listen(3999, "127.0.0.1");
