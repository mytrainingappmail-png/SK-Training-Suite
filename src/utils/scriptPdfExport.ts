import jsPDF from "jspdf";
// The "-pro" fork, not plain html2canvas: this app's Tailwind v4 stylesheet
// uses oklch() for its color palette, which plain html2canvas can't parse
// (throws "unsupported color function" and aborts capture) — the fork adds
// support for oklch/lab/color-mix, otherwise a drop-in-identical API.
import html2canvas from "html2canvas-pro";

// Renders a DOM node (the script reader's content area, watermark and
// all) to a canvas and slices it across as many A4 pages as needed —
// the standard html2canvas+jsPDF recipe. No prior PDF precedent existed
// in this codebase (everything else uses window.print() or isn't a real
// PDF at all — see the SVG-certificate export), so this is the first.
export async function exportElementAsPdf(element: HTMLElement, filename: string): Promise<void> {
  const canvas = await html2canvas(element, { scale: 2, useCORS: true, backgroundColor: "#ffffff" });

  const pdf = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();

  const imgWidth = pageWidth;
  const imgHeight = (canvas.height * imgWidth) / canvas.width;

  const imgData = canvas.toDataURL("image/png");

  let heightLeft = imgHeight;
  let position = 0;

  pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
  heightLeft -= pageHeight;

  while (heightLeft > 0) {
    position -= pageHeight;
    pdf.addPage();
    pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;
  }

  pdf.save(filename);
}
