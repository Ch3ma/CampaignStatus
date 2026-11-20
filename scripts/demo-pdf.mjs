import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

export async function demoPdf() {
  const document = await PDFDocument.create({ updateMetadata: false });
  const regular = await document.embedFont(StandardFonts.Helvetica);
  const bold = await document.embedFont(StandardFonts.HelveticaBold);
  const green = rgb(0.17, 0.3, 0.21);
  const ink = rgb(0.1, 0.13, 0.11);
  const sheets = [
    ['Registro de recepción', ['La estación de prueba recibió tres pulsos.', 'La señal registrada pertenece a una operación ficticia.']],
    ['Verificación de respuesta', ['El segundo turno repitió la medición.', 'La lectura de control confirmó los tres pulsos.']],
  ];

  sheets.forEach(([title, lines], index) => {
    const page = document.addPage([480, 320]);
    page.drawRectangle({ x: 0, y: 0, width: 480, height: 320, color: rgb(0.95, 0.93, 0.86) });
    page.drawText('CELL A / DOCUMENTO DE DEMOSTRACIÓN', { x: 35, y: 266, size: 11, font: bold, color: green });
    page.drawLine({ start: { x: 35, y: 248 }, end: { x: 445, y: 248 }, thickness: 1, color: green });
    page.drawText(title, { x: 35, y: 212, size: 22, font: bold, color: ink });
    lines.forEach((line, row) => page.drawText(line, { x: 35, y: 173 - row * 22, size: 13, font: regular, color: ink }));
    page.drawText(`${index + 1} / ${sheets.length}`, { x: 414, y: 32, size: 10, font: regular, color: green });
  });

  return document.save();
}
