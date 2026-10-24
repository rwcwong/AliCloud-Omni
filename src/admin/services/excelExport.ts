export async function exportToExcel(
  filename: string,
  sheetName: string,
  headers: string[],
  rows: (string | number | boolean | null)[][],
): Promise<void> {
  const XLSX = await import('xlsx');
  const aoa: (string | number | boolean | null)[][] = [headers, ...rows];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, filename);
}
