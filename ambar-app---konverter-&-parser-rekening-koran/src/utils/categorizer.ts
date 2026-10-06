export const CATEGORIES = [
  'Pemasukan Cash Omzet & Dokter',
  'THR Karyawan',
  'Gaji & Lembur Karyawan',
  'Tagihan Supplier & Operasional Apotek',
  'Transfer Masuk Pribadi',
  'Transfer Keluar',
  'Belanja Operasional',
  'Biaya Admin Bank',
  'Bunga Bank',
  'Lain-lain / Operasional Umum',
] as const;

export type TransactionCategory = (typeof CATEGORIES)[number];

export function autoCategorize(keterangan: string, tipe: 'DB' | 'CR'): string {
  const text = (keterangan || '').toUpperCase();

  // Prioritas 1: Jika Tipe=CR dan Keterangan mengandung CASH, OMZET, DOKTER, SHIFT, QRAPOTEK, MERCHANT -> "Pemasukan Cash Omzet & Dokter"
  if (
    tipe === 'CR' &&
    (text.includes('CASH') ||
      text.includes('OMZET') ||
      text.includes('DOKTER') ||
      text.includes('SHIFT') ||
      text.includes('SETORAN TUNAI') ||
      text.includes('SETOR TUNAI') ||
      text.includes('PASIEN') ||
      text.includes('MERCHANT') ||
      text.includes('QRAPOTEK') ||
      text.includes('APOTEK EMMA') ||
      text.includes('QRPAY') ||
      text.includes('CC MERCHANT'))
  ) {
    return 'Pemasukan Cash Omzet & Dokter';
  }

  // Prioritas 2: Jika mengandung THR -> "THR Karyawan"
  if (text.includes('THR')) {
    return 'THR Karyawan';
  }

  // Prioritas 3: Jika Tipe=DB dan mengandung GAJI, LEMBUR, BONUS atau nama DEWI, WIWIN, EVI, AGRIL (tanpa kata CASH) -> "Gaji & Lembur Karyawan"
  if (tipe === 'DB' && !text.includes('CASH')) {
    if (
      text.includes('GAJI') ||
      text.includes('LEMBUR') ||
      text.includes('BONUS') ||
      text.includes('INSENTIF') ||
      text.includes('DEWI') ||
      text.includes('WIWIN') ||
      text.includes('EVI') ||
      text.includes('AGRIL')
    ) {
      return 'Gaji & Lembur Karyawan';
    }
  }

  // Jika mengandung TAG EMMA, SWIPERX, PENTA, MILLENNIUM, COMBI, ALIDA, BINA SAN, dll -> "Tagihan Supplier & Operasional Apotek"
  const suppliers = [
    'TAG EMMA',
    'TAG ',
    'CIC TAG',
    'PELUNASAN',
    'SWIPERX',
    'PENTA',
    'MILLENNIUM',
    'MILLENIUM',
    'COMBI',
    'ALIDA',
    'BINA SAN',
    'BINASAN',
    'DISTRINDO',
    'KA DUA EMPAT',
    'SAPTA SARI',
    'TRI SAPTA',
    'SINGGASANA',
    'NUROSADI',
    'PLANET EXCELENCIA',
    'CARMELLA',
    'KUDA MAS',
    'TEGUH KARYA',
    'GRAZIA MAKMUR',
    'TIMUR TERANG',
    'MAHARDHIKA',
    'BINANGKIT',
    'DAYA MUDA',
    'JAYA BAKTI',
    'GLORY MAJESTY',
    'GEMA WIRA',
    'JAYA ABADI FARMA',
    'ANUGRAH',
    'MENJANGAN',
    'KIMIA FARMA',
    'TEMPO',
    'APOTEK',
    'SUPPLIER',
    'DISTRIBUTOR',
    'MEDIKA',
    'PHARMA',
    'FARMASI',
    'KALBE',
    'SANBE',
    'DEXA',
    'PARIT PADANG',
    'ENSEVAL',
    'DOS NI ROHA',
  ];
  if (suppliers.some(s => text.includes(s))) {
    return 'Tagihan Supplier & Operasional Apotek';
  }

  // Jika mengandung BI-FAST CR / TRANSFER DR -> "Transfer Masuk Pribadi"
  if (
    text.includes('BI-FAST CR') ||
    text.includes('TRANSFER DR') ||
    text.includes('TRSF DR') ||
    text.includes('TRSF E-BANKING CR') ||
    (tipe === 'CR' && (text.includes('BI-FAST') || text.includes('TRANSFER DARI')))
  ) {
    return 'Transfer Masuk Pribadi';
  }

  // Jika mengandung BI-FAST DB / TRANSFER KE -> "Transfer Keluar"
  if (
    text.includes('BI-FAST DB') ||
    text.includes('TRANSFER KE') ||
    text.includes('TRSF KE') ||
    text.includes('TRSF E-BANKING DB') ||
    text.includes('TRANSFER BI FAST') ||
    text.includes('KE BCA') ||
    (tipe === 'DB' && (text.includes('BI-FAST') || text.includes('TRANSFER')))
  ) {
    return 'Transfer Keluar';
  }

  // Jika KARTU DEBIT, INDOGROSIR, QR, TRAVELOKA, PLN, SHOPEE, BPJS -> "Belanja Operasional"
  if (
    text.includes('KARTU DEBIT') ||
    text.includes('INDOGROSIR') ||
    text.includes('QR') ||
    text.includes('QRIS') ||
    text.includes('ALFAMART') ||
    text.includes('ALFAMRT') ||
    text.includes('INDOMARET') ||
    text.includes('SUPERINDO') ||
    text.includes('BORMA') ||
    text.includes('TRAVELOKA') ||
    text.includes('SHOPEE') ||
    text.includes('SHOPEEPAY') ||
    text.includes('GOPAY') ||
    text.includes('DOMPET ANAK BANGSA') ||
    text.includes('BPJS') ||
    text.includes('TIKET') ||
    text.includes('BENSIN') ||
    text.includes('SPBU') ||
    text.includes('PLN') ||
    text.includes('LISTRIK') ||
    text.includes('TELKOM') ||
    text.includes('INDIH') ||
    text.includes('BIZNET') ||
    text.includes('WIFI') ||
    text.includes('INTERNET')
  ) {
    return 'Belanja Operasional';
  }

  // Jika BIAYA -> "Biaya Admin Bank"
  if (
    text.includes('BIAYA') ||
    text.includes('ADM') ||
    text.includes('ADMINISTRASI') ||
    text.includes('PAJAK BUNGA') ||
    text.includes('BIAYA KARTU') ||
    text.includes('BIAYA TRANSAKSI')
  ) {
    return 'Biaya Admin Bank';
  }

  // Bunga Bank
  if (tipe === 'CR' && (text.includes('BUNGA') || text.includes('BAGI HASIL'))) {
    return 'Bunga Bank';
  }

  return 'Lain-lain / Operasional Umum';
}

export function getCategoryBadgeColor(kategori: string): { bg: string; text: string; border: string; dot: string } {
  switch (kategori) {
    case 'Pemasukan Cash Omzet & Dokter':
      return { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', dot: 'bg-emerald-500' };
    case 'THR Karyawan':
      return { bg: 'bg-amber-50', text: 'text-amber-800', border: 'border-amber-200', dot: 'bg-amber-500' };
    case 'Gaji & Lembur Karyawan':
      return { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200', dot: 'bg-rose-500' };
    case 'Tagihan Supplier & Operasional Apotek':
      return { bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200', dot: 'bg-indigo-500' };
    case 'Transfer Masuk Pribadi':
      return { bg: 'bg-teal-50', text: 'text-teal-700', border: 'border-teal-200', dot: 'bg-teal-500' };
    case 'Transfer Keluar':
      return { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200', dot: 'bg-orange-500' };
    case 'Belanja Operasional':
      return { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200', dot: 'bg-purple-500' };
    case 'Biaya Admin Bank':
      return { bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-300', dot: 'bg-slate-500' };
    case 'Bunga Bank':
      return { bg: 'bg-cyan-50', text: 'text-cyan-700', border: 'border-cyan-200', dot: 'bg-cyan-500' };
    default:
      return { bg: 'bg-pink-50/60', text: 'text-pink-800', border: 'border-pink-200', dot: 'bg-pink-400' };
  }
}

// Rupiah currency formatter
export function formatRupiah(value: number): string {
  if (value === undefined || value === null || isNaN(value)) return 'Rp 0';
  return 'Rp ' + Math.round(value).toLocaleString('id-ID');
}

export function formatNumber(value: number): string {
  if (value === undefined || value === null || isNaN(value)) return '0,00';
  return value.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
