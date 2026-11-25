const escape = (text: string) => text.replace(/[\\()]/g, (character) => `\\${character}`);

function assemble(objects: string[]): Buffer {
  let body = "%PDF-1.4\n";
  const offsets = objects.map((object, index) => {
    const offset = Buffer.byteLength(body, "latin1");
    body += `${index + 1} 0 obj\n${object}\nendobj\n`;
    return offset;
  });
  const start = Buffer.byteLength(body, "latin1");
  const table = offsets.map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join("");
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${table}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${start}\n%%EOF\n`;
  return Buffer.from(body, "latin1");
}

export function makePdf(title: string, pages: string[][]): Buffer {
  const first = 4;
  const kids = pages.map((_, index) => `${first + index * 2} 0 R`).join(" ");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    `<< /Type /Pages /Kids [${kids}] /Count ${pages.length} >>`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  pages.forEach((lines, index) => {
    const text = [title, "Demonstration content - not a real document", "", ...lines];
    const stream = text.map((line, row) => `BT /F1 ${row === 0 ? 18 : 11} Tf 64 ${770 - row * 22} Td (${escape(line)}) Tj ET`).join("\n");
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 842] /Resources << /Font << /F1 3 0 R >> >> /Contents ${first + index * 2 + 1} 0 R >>`);
    objects.push(`<< /Length ${Buffer.byteLength(stream, "latin1")} >>\nstream\n${stream}\nendstream`);
  });
  return assemble(objects);
}
