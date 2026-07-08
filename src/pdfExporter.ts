import jsPDF from 'jspdf';
import { Shift, ChecklistItem } from './types';
import { SECTORS } from './utils';
import { LOGO_JP_BASE64, LOGO_UPA_BASE64 } from './components/logo_base64';

// Helper function to calculate exact height needed for a sector block
function getSectorHeight(items: ChecklistItem[]): number {
  let height = 3.5; // Top/bottom padding offset
  items.forEach((item) => {
    height += 6.5; // Base height per employee
    
    // Check if there is observation text
    let obsText = '';
    if (item.status !== 'PRESENTE') {
      if (item.status === 'TROCA') {
        obsText = 'TROCA' + (item.notes ? ` ${item.notes.toUpperCase()}` : '');
      } else if (item.status === 'FAST_TRACK') {
        obsText = 'FAST TRACK' + (item.notes ? ` - ${item.notes.toUpperCase()}` : '');
      } else {
        obsText = item.status + (item.notes ? ` - ${item.notes.toUpperCase()}` : '');
      }
    } else if (item.notes) {
      obsText = item.notes.toUpperCase();
    }
    
    if (obsText) {
      height += 3.5; // Extra height for observations row
    }
  });
  return Math.max(10, height);
}

export function exportShiftPDF(shift: Shift, items: ChecklistItem[]) {
  const pdf = new jsPDF('p', 'mm', 'a4');
  
  pdf.setProperties({
    title: `Checklist Plantão - ${shift.date}`,
    subject: 'Checklist Administrativo UPA Bancários',
    author: 'UPA 24h Bancários'
  });

  const drawHeader = (pdfInstance: jsPDF) => {
    // Outer boundaries & Lines
    pdfInstance.setDrawColor(0, 0, 0);
    pdfInstance.setLineWidth(0.3);

    // Left box: Prefeitura (Centered red logo)
    pdfInstance.rect(15, 15, 42, 18);
    pdfInstance.addImage(LOGO_JP_BASE64, 'PNG', 15.5, 15.5, 41, 17);

    // Center: Title block
    pdfInstance.setFont('helvetica', 'bold');
    pdfInstance.setFontSize(13);
    pdfInstance.setTextColor(0, 0, 0);
    pdfInstance.text('CHECKLIST ADMINISTRATIVO', 105, 20, { align: 'center' });
    pdfInstance.setFont('helvetica', 'normal');
    pdfInstance.setFontSize(7.5);
    pdfInstance.text('Unidade de Pronto Atendimento Dr. Luiz Lindbergh Farias', 105, 24, { align: 'center' });
    pdfInstance.setFont('helvetica', 'bold');
    pdfInstance.setFontSize(7.5);
    pdfInstance.text('UPA 24 HORAS BANCÁRIOS', 105, 28, { align: 'center' });

    // Right box: UPA 24h (Centered square logo)
    pdfInstance.rect(153, 15, 42, 18);
    pdfInstance.addImage(LOGO_UPA_BASE64, 'PNG', 153.5, 15.5, 41, 17);

    // Divider banner background
    pdfInstance.setFillColor(245, 247, 250);
    pdfInstance.rect(15, 36, 180, 8.5, 'F');

    // Header strip lines
    pdfInstance.setLineWidth(0.5);
    pdfInstance.line(15, 36, 195, 36);
    pdfInstance.line(15, 44.5, 195, 44.5);

    // Date / Shift Info (Centered)
    pdfInstance.setFont('helvetica', 'bold');
    pdfInstance.setFontSize(8.5);
    pdfInstance.setTextColor(30, 41, 59);
    const dateFormatted = shift.date.split('-').reverse().join('/');
    pdfInstance.text(`DATA ${dateFormatted} - ${shift.period.toUpperCase()} - ${shift.weekday.toUpperCase()}`, 105, 41.5, { align: 'center' });
  };

  let y = 50;
  drawHeader(pdf);

  // Group checklist items by sectors
  const grouped: Record<string, ChecklistItem[]> = {};
  SECTORS.forEach((sec) => {
    grouped[sec] = items.filter((item) => item.sector === sec);
  });

  SECTORS.forEach((sector) => {
    const secItems = grouped[sector] || [];
    if (secItems.length === 0) return;

    const sectorHeight = getSectorHeight(secItems);

    // Estimate if block will fit on page (including safety margin)
    if (y + sectorHeight + 5 > 275) {
      pdf.addPage();
      y = 15; // Start at y=15 on subsequent pages since there is no header
    }

    // Draw Unified Sector + Employee Box
    pdf.setDrawColor(0, 0, 0);
    pdf.setLineWidth(0.2);
    pdf.setFillColor(255, 255, 255);
    pdf.rect(15, y, 180, sectorHeight, 'FD'); // Draws the full outer boundary box
    
    // Draw vertical column separator line
    pdf.line(57, y, 57, y + sectorHeight);

    // Draw Left Sector Text
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(7.5);
    pdf.setTextColor(0, 0, 0);
    const sectorLines = pdf.splitTextToSize(sector, 38);
    const lineSpacing = 3.5;
    const textHeight = sectorLines.length * lineSpacing;
    const textY = y + (sectorHeight - textHeight) / 2 + 3.2;
    pdf.text(sectorLines, 36, textY, { align: 'center' });

    // Draw Right Employee Rows
    let rowY = y + 4.5;
    secItems.forEach((item, index) => {
      // 1. Index number
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(8);
      pdf.setTextColor(0, 0, 0);
      pdf.text(`${index + 1}.`, 62, rowY);

      // 2. Role / Function
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(0, 0, 0);
      pdf.text(item.employeeRole, 66, rowY);

      // 3. Employee Name (aligned to x=105 to prevent overlap with long roles)
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(0, 0, 0);
      pdf.text(item.employeeName.toUpperCase(), 105, rowY);

      // 4. Observation text (status + notes)
      let obsText = '';
      if (item.status !== 'PRESENTE') {
        if (item.status === 'TROCA') {
          obsText = 'TROCA' + (item.notes ? ` ${item.notes.toUpperCase()}` : '');
        } else if (item.status === 'FAST_TRACK') {
          obsText = 'FAST TRACK' + (item.notes ? ` - ${item.notes.toUpperCase()}` : '');
        } else {
          obsText = item.status + (item.notes ? ` - ${item.notes.toUpperCase()}` : '');
        }
      } else if (item.notes) {
        obsText = item.notes.toUpperCase();
      }

      if (obsText) {
        rowY += 3.5;
        pdf.setFont('helvetica', 'italic');
        pdf.setFontSize(7.5);
        pdf.setTextColor(80, 80, 80); // Dark grey for observations
        pdf.text(`Obs: ${obsText}`, 66, rowY);
      }

      // Draw light horizontal separator line between employees in the same block
      if (index < secItems.length - 1) {
        const dividerY = rowY + 3.0;
        pdf.setDrawColor(220, 220, 220);
        pdf.setLineWidth(0.15);
        pdf.line(57, dividerY, 195, dividerY);
        
        pdf.setDrawColor(0, 0, 0); // reset draw color
        pdf.setLineWidth(0.2); // reset line width
        rowY += 6.5;
      }
    });

    y = y + sectorHeight + 4.0;
  });

  // Signature & Notes Blocks at the bottom of Page
  if (y + 30 > 275) {
    pdf.addPage();
    y = 15;
  }

  y += 3;
  pdf.setDrawColor(0, 0, 0);
  pdf.setLineWidth(0.2);

  // Signature box (Left)
  pdf.rect(15, y, 85, 20);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(8);
  pdf.setTextColor(0, 0, 0);
  pdf.text(`${shift.coordinatorsName.toUpperCase()} - ${shift.coordinatorsRegistration}`, 57.5, y + 10, { align: 'center' });
  
  // Clean signature line inside the box
  pdf.setDrawColor(180, 180, 180);
  pdf.setLineWidth(0.25);
  pdf.line(25, y + 14, 90, y + 14);
  
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(6.5);
  pdf.setTextColor(100, 100, 100);
  pdf.text('Assinatura do Profissional / Matrícula', 57.5, y + 24, { align: 'center' });

  // Observations box (Right)
  pdf.rect(105, y, 90, 20);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(7.5);
  pdf.setTextColor(0, 0, 0);
  const notes = shift.generalNotes || 'SEM OBSERVAÇÕES ADICIONAIS.';
  const notesLines = pdf.splitTextToSize(notes, 82);
  let noteY = y + 6;
  if (notesLines.length === 1) {
    noteY = y + 10;
  } else if (notesLines.length === 2) {
    noteY = y + 8;
  }
  notesLines.forEach(line => {
    pdf.text(line.toUpperCase(), 150, noteY, { align: 'center' });
    noteY += 4.5;
  });
  
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(6.5);
  pdf.setTextColor(100, 100, 100);
  pdf.text('Observações', 150, y + 24, { align: 'center' });

  // Draw footer ONLY on the last page with pagination and separator line
  const totalPages = pdf.getNumberOfPages();
  pdf.setPage(totalPages);
  
  // Horizontal separator line for footer
  pdf.setDrawColor(200, 200, 200);
  pdf.setLineWidth(0.2);
  pdf.line(15, 282, 195, 282);
  
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(7.5);
  pdf.setTextColor(100, 100, 100);
  
  const dateFormatted = shift.date.split('-').reverse().join('/');
  const footerText = `DATA: ${dateFormatted} - ${shift.period.toUpperCase()} - ${shift.weekday.toUpperCase()}`;
  pdf.text(footerText, 15, 287);
  
  const pageNumText = `PÁGINA ${totalPages} DE ${totalPages}`;
  pdf.text(pageNumText, 195, 287, { align: 'right' });

  const filename = `checklist_plantao_${shift.date}_${shift.period.toLowerCase()}.pdf`;
  pdf.save(filename);
}
