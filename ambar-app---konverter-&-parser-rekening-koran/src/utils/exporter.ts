import * as XLSX from 'xlsx';
import { Transaction, AccountInfo } from '../types';

export function exportToExcel(
  transactions: Transaction[],
  accountInfo: AccountInfo,
  fileNamePrefix: string = 'AMBAR_REKAP_MUTASI'
) {
  const wb = XLSX.utils.book_new();

  // 1. Detail Sheet - Sesuai Permintaan Spesifik:
  // tanggal | keterangan | cabang | debet | kredit | saldo_akhir | kategori | tipe
  const rows = transactions.map((t, idx) => ({
    'No': idx + 1,
    'tanggal': t.tanggal, // Format DD/MM/YYYY (contoh: 01/05/2026)
    'keterangan': t.keterangan, // BIF code + nama lengkap
    'cabang': t.cabang || '', // kode cabang (kosong jika tidak ada di koran)
    'debet': Number(t.debet || (t.tipe === 'CR' ? t.mutasi : 0)), // numerik, terisi jika mutasi CR (CR masuk debet)
    'kredit': Number(t.kredit || (t.tipe === 'DB' ? t.mutasi : 0)), // numerik, terisi jika mutasi DB (DB masuk kredit)
    'saldo_akhir': Number(t.saldo_akhir ?? t.saldo ?? 0), // numerik running balance, bisa dijumlahkan
    'kategori': t.kategori,
    'tipe': t.tipe,
  }));

  const wsDetail = XLSX.utils.json_to_sheet(rows);

  // Set column widths for optimal reading
  wsDetail['!cols'] = [
    { wch: 6 },   // No
    { wch: 14 },  // tanggal
    { wch: 50 },  // keterangan
    { wch: 12 },  // cabang
    { wch: 18 },  // debet
    { wch: 18 },  // kredit
    { wch: 20 },  // saldo_akhir
    { wch: 32 },  // kategori
    { wch: 8 },   // tipe
  ];

  XLSX.utils.book_append_sheet(wb, wsDetail, 'Rekap Mutasi Koran');

  // 2. Summary Sheet by Category
  const categoryMap = new Map<string, { total: number; count: number; tipe: string }>();
  for (const t of transactions) {
    const existing = categoryMap.get(t.kategori) || { total: 0, count: 0, tipe: t.tipe };
    existing.total += t.mutasi;
    existing.count += 1;
    categoryMap.set(t.kategori, existing);
  }

  const categoryRows = Array.from(categoryMap.entries()).map(([kat, data]) => ({
    'Kategori Pembukuan': kat,
    'Tipe': data.tipe,
    'Jumlah Transaksi': data.count,
    'Total Nominal (IDR)': data.total,
  }));

  const wsSummary = XLSX.utils.json_to_sheet(categoryRows);
  wsSummary['!cols'] = [{ wch: 36 }, { wch: 10 }, { wch: 18 }, { wch: 22 }];
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Ringkasan Kategori');

  // 3. Rekonsiliasi & Profil Rekening Sheet
  // Debet = CR (uang masuk), Kredit = DB (uang keluar)
  const totalDebet = transactions.reduce((acc, t) => acc + (t.debet || (t.tipe === 'CR' ? t.mutasi : 0)), 0);
  const totalKredit = transactions.reduce((acc, t) => acc + (t.kredit || (t.tipe === 'DB' ? t.mutasi : 0)), 0);
  const calcSaldoAkhir = (accountInfo.saldoAwal || 0) + totalDebet - totalKredit;

  const infoRows = [
    { 'Parameter': 'Nama Aplikasi', 'Nilai': 'AMBAR AKUNTAN' },
    { 'Parameter': 'Bank', 'Nilai': accountInfo.bankName || 'Rekening Koran' },
    { 'Parameter': 'Nomor Rekening', 'Nilai': accountInfo.noRekening || '-' },
    { 'Parameter': 'Nama Pemilik', 'Nilai': accountInfo.namaNasabah || 'AMBAR' },
    { 'Parameter': 'Periode Mutasi', 'Nilai': accountInfo.periode || '-' },
    { 'Parameter': 'Tanggal Export', 'Nilai': new Date().toLocaleString('id-ID') },
    { 'Parameter': 'Saldo Awal (IDR)', 'Nilai': accountInfo.saldoAwal || 0 },
    { 'Parameter': 'Total Debet (Uang Masuk / CR) (IDR)', 'Nilai': totalDebet },
    { 'Parameter': 'Total Kredit (Uang Keluar / DB) (IDR)', 'Nilai': totalKredit },
    { 'Parameter': 'Saldo Akhir Rekening (IDR)', 'Nilai': accountInfo.saldoAkhir || 0 },
    { 'Parameter': 'Saldo Akhir Hasil Hitung (IDR)', 'Nilai': calcSaldoAkhir },
    {
      'Parameter': 'Status Rekonsiliasi',
      'Nilai': Math.abs((accountInfo.saldoAkhir || 0) - calcSaldoAkhir) < 2 ? 'BALANCE MATCH (SEIMBANG)' : 'TERDAPAT SELISIH',
    },
    { 'Parameter': 'Aturan Kolom Mutasi', 'Nilai': 'CR masuk Debet, DB masuk Kredit, Saldo Akhir Running Balance' },
    { 'Parameter': 'Total Halaman PDF', 'Nilai': accountInfo.totalPages || 1 },
    { 'Parameter': 'Checksum Dokumen (SHA-256)', 'Nilai': accountInfo.fileHash || '-' },
  ];

  const wsInfo = XLSX.utils.json_to_sheet(infoRows);
  wsInfo['!cols'] = [{ wch: 38 }, { wch: 45 }];
  XLSX.utils.book_append_sheet(wb, wsInfo, 'Rekonsiliasi & Info');

  // Trigger download
  const dateStr = new Date().toISOString().slice(0, 10);
  const safeAcc = (accountInfo.noRekening || 'MUTASI').replace(/\s+/g, '_');
  XLSX.writeFile(wb, `${fileNamePrefix}_${safeAcc}_${dateStr}.xlsx`);
}

export function exportToCsv(
  transactions: Transaction[],
  accountInfo: AccountInfo,
  fileNamePrefix: string = 'AMBAR_REKAP_MUTASI'
) {
  // Exact column arrangement as requested:
  // tanggal, keterangan, cabang, debet, kredit, saldo_akhir, kategori, tipe
  const headers = ['No', 'tanggal', 'keterangan', 'cabang', 'debet', 'kredit', 'saldo_akhir', 'kategori', 'tipe'];

  const rows = transactions.map((t, idx) => [
    idx + 1,
    `"${t.tanggal}"`,
    `"${(t.keterangan || '').replace(/"/g, '""')}"`,
    `"${(t.cabang || '').replace(/"/g, '""')}"`,
    Number(t.debet || (t.tipe === 'CR' ? t.mutasi : 0)),
    Number(t.kredit || (t.tipe === 'DB' ? t.mutasi : 0)),
    Number(t.saldo_akhir ?? t.saldo ?? 0),
    `"${(t.kategori || '').replace(/"/g, '""')}"`,
    t.tipe,
  ]);

  const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const dateStr = new Date().toISOString().slice(0, 10);
  const safeAcc = (accountInfo.noRekening || 'MUTASI').replace(/\s+/g, '_');
  link.setAttribute('href', url);
  link.setAttribute('download', `${fileNamePrefix}_${safeAcc}_${dateStr}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
