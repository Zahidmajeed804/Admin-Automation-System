import PDFDocument from "pdfkit";

/**
 * Builds a simple tabular PDF (title + optional meta lines + a header row
 * and data rows, paginating when a page fills up) and resolves to the
 * complete Buffer. Shared by every report's PDF export so the layout stays
 * consistent across the Reports module; columns are evenly split across the
 * page width.
 */
export function rowsToPdf({ title, meta = [], columns, rows }) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 40 });
    const chunks = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.fontSize(16).font("Helvetica-Bold").text(title);
    doc.moveDown(0.5);
    doc.fontSize(9).font("Helvetica").fillColor("#555555");
    for (const line of meta) doc.text(line);
    doc.fillColor("#000000");
    doc.moveDown(1);

    const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const colWidth = pageWidth / columns.length;
    const bottomLimit = doc.page.height - doc.page.margins.bottom;

    const drawRow = (values, font) => {
      doc.font(font).fontSize(10);
      const rowY = doc.y;
      let x = doc.page.margins.left;
      for (let i = 0; i < columns.length; i++) {
        doc.text(String(values[i] ?? ""), x, rowY, { width: colWidth });
        x += colWidth;
      }
      doc.moveDown(0.6);
    };

    drawRow(columns.map((c) => c.header), "Helvetica-Bold");

    for (const row of rows) {
      if (doc.y > bottomLimit - 20) doc.addPage();
      drawRow(columns.map((c) => row[c.key]), "Helvetica");
    }

    doc.end();
  });
}
