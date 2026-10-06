export interface Transaction {
  id: string;
  tanggal: string; // Format DD/MM/YYYY (contoh: 01/05/2026)
  keterangan: string; // BIF code + nama lengkap
  cabang: string; // kode cabang (kosong jika tidak ada di koran)
  tipe: 'DB' | 'CR';
  debet: number; // numerik, terisi jika mutasi CR (CR masuk debet)
  debit: number; // alias kompatibilitas
  kredit: number; // numerik, terisi jika mutasi DB (DB masuk kredit)
  mutasi: number;
  saldo_akhir: number; // numerik running balance, bisa dijumlahkan
  saldo: number; // alias kompatibilitas
  kategori: string;
  isReconciled?: boolean;
  pageNumber?: number;
  rawRightText?: string;
  isCustomEdited?: boolean;
}

export interface AccountInfo {
  bankName: string;
  noRekening: string;
  namaNasabah: string;
  periode: string;
  mataUang: string;
  saldoAwal: number;
  saldoAkhir: number;
  totalMutasiDB: number;
  totalMutasiCR: number;
  fileName?: string;
  fileHash?: string;
  fileSize?: number;
  totalPages?: number;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  type: 'FILE_LOAD' | 'PASSWORD_DECRYPT' | 'PARSE_SUCCESS' | 'AI_AUDIT' | 'VAULT_ENCRYPT' | 'EXPORT_DATA' | 'MANUAL_EDIT' | 'SECURITY_ALERT';
  severity: 'INFO' | 'SUCCESS' | 'WARN' | 'SECURE';
  message: string;
  meta?: Record<string, any>;
}

export interface AiAuditResult {
  auditScore: number;
  isBalanceReconciled: boolean;
  summaryNotes: string;
  discrepancies: string[];
  categorySuggestions: Array<{
    index: number;
    recommendedCategory: string;
    reason: string;
  }>;
  corrections: Array<{
    index: number;
    field: string;
    suggestedValue: any;
  }>;
  financialInsights: string[];
}
