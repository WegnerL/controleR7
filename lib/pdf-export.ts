import jsPDF from "jspdf";
import html2canvas from "html2canvas";

export async function exportTableToPDF(
  tableElement: HTMLElement,
  fileName: string = "cookit-antigo.pdf"
) {
  try {
    // Capture the table as an image
    const canvas = await html2canvas(tableElement, {
      scale: 2,
      useCORS: true,
      backgroundColor: "#ffffff",
    });

    const imgData = canvas.toDataURL("image/png");
    const imgWidth = 210; // A4 width in mm
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    const pdf = new jsPDF("p", "mm", "a4");
    let heightLeft = imgHeight;
    let position = 0;

    // Add title
    pdf.setFontSize(16);
    pdf.text("Relatório Cookit Antigo", 15, 15);
    pdf.setFontSize(10);
    pdf.text(`Data de Geração: ${new Date().toLocaleDateString("pt-BR")}`, 15, 22);

    position = 30;

    // Add image to PDF
    pdf.addImage(imgData, "PNG", 5, position, imgWidth - 10, imgHeight);
    heightLeft -= imgHeight;

    while (heightLeft > 0) {
      position = heightLeft - imgHeight;
      pdf.addPage();
      pdf.addImage(imgData, "PNG", 5, position, imgWidth - 10, imgHeight);
      heightLeft -= 280; // A4 height in mm
    }

    pdf.save(fileName);
  } catch (error) {
    console.error("Erro ao exportar PDF:", error);
    throw new Error("Falha ao gerar PDF");
  }
}

export async function exportCookitAntiqoToPDF(
  data: any[],
  fileName: string = "cookit-antigo.pdf"
) {
  const pdf = new jsPDF("l", "mm", "a4"); // landscape
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();

  let yPosition = 15;
  const lineHeight = 7;
  const columnWidth = 15;
  const startX = 10;

  // Title
  pdf.setFontSize(16);
  pdf.text("Relatório Cookit Antigo", startX, yPosition);
  yPosition += 10;

  // Date
  pdf.setFontSize(10);
  pdf.text(`Data de Geração: ${new Date().toLocaleDateString("pt-BR")}`, startX, yPosition);
  yPosition += 8;

  // Summary
  const totalVL10E = data.reduce((sum, item) => sum + (item.vl10eTotal || 0), 0);
  pdf.setFontSize(11);
  pdf.text(`Total VL10E: R$ ${totalVL10E.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`, startX, yPosition);
  yPosition += 8;
  pdf.text(`Total de Filiais: ${data.length}`, startX, yPosition);
  yPosition += 10;

  // Table headers
  pdf.setFontSize(9);
  pdf.setFont("", "bold");

  const headers = ["Cód.", "Gerente", "VL10E", "2018", "2019", "2020", "2021", "2022", "2023", "2024"];
  let xPosition = startX;

  headers.forEach((header) => {
    pdf.text(header, xPosition, yPosition);
    xPosition += columnWidth;
  });

  yPosition += lineHeight + 2;
  pdf.setFont("", "normal");

  // Table rows
  pdf.setFontSize(8);
  data.forEach((item) => {
    if (yPosition > pageHeight - 15) {
      pdf.addPage();
      yPosition = 15;
    }

    xPosition = startX;
    const rowData = [
      item.codigo?.toString() || "",
      item.gerente || "",
      `R$ ${(item.vl10eTotal || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
      `R$ ${(item.ano2018 || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
      `R$ ${(item.ano2019 || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
      `R$ ${(item.ano2020 || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
      `R$ ${(item.ano2021 || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
      `R$ ${(item.ano2022 || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
      `R$ ${(item.ano2023 || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
      `R$ ${(item.ano2024 || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
    ];

    rowData.forEach((cell, index) => {
      const cellStr = String(cell || "");
      const text = cellStr.length > 12 ? cellStr.substring(0, 12) + "..." : cellStr;
      pdf.text(text, xPosition, yPosition);
      xPosition += columnWidth;
    });

    yPosition += lineHeight;
  });

  pdf.save(fileName);
}
