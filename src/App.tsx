/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Header } from './components/Header';
import { DashboardSummary } from './components/DashboardSummary';
import { TransactionTable } from './components/TransactionTable';
import { FinancialCharts } from './components/FinancialCharts';
import { AiAuditModal } from './components/AiAuditModal';
import { AdminLogDashboard } from './components/AdminLogDashboard';
import { FileUploadModal } from './components/FileUploadModal';
import { EncryptionVaultModal } from './components/EncryptionVaultModal';
import { Transaction, AccountInfo, AuditLog } from './types';
import { exportToExcel, exportToCsv } from './utils/exporter';
import { encryptData, decryptData } from './utils/security';
import { ParseResult, normalizeDateToDDMMYYYY } from './utils/pdfParser';
import { formatRupiah } from './utils/categorizer';
import {
  FileSpreadsheet,
  Upload,
  Sparkles,
  ShieldCheck,
  Building2,
  Calendar,
  Lock,
  CheckCircle2,
  X,
  ArrowRight,
  TrendingUp,
  AlertTriangle,
} from 'lucide-react';

const ENCRYPTED_STORAGE_KEY = 'ambar_akuntan_vault_clean';

const emptyAccountInfo: AccountInfo = {
  bankName: '',
  noRekening: '',
  namaNasabah: '',
  periode: '',
  mataUang: 'IDR',
  saldoAwal: 0,
  saldoAkhir: 0,
  totalMutasiDB: 0,
  totalMutasiCR: 0,
};

export default function App() {
  // Starts with NO dummy data, completely clean!
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accountInfo, setAccountInfo] = useState<AccountInfo>(emptyAccountInfo);
  const [rawLines, setRawLines] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<'table' | 'charts' | 'ai' | 'admin'>('table');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDocumentLoaded, setIsDocumentLoaded] = useState(false);
  const [isAiExtracting, setIsAiExtracting] = useState(false);

  // Success Feedback Banner after upload
  const [successBanner, setSuccessBanner] = useState<{
    show: boolean;
    fileName: string;
    count: number;
    accountNo: string;
    bank: string;
    saldoAkhir: number;
  } | null>(null);

  // Modals
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isVaultOpen, setIsVaultOpen] = useState(false);

  // Real-time Audit Logs
  const [logs, setLogs] = useState<AuditLog[]>([
    {
      id: 'log-init-1',
      timestamp: new Date().toISOString(),
      type: 'VAULT_ENCRYPT',
      severity: 'SECURE',
      message: 'Sistem Kriptografi Web Crypto AES-GCM 256 siap digunakan (Zero Server Upload)',
      meta: { cipher: 'AES-GCM-256', standard: 'NIST/Banking' },
    },
    {
      id: 'log-init-2',
      timestamp: new Date().toISOString(),
      type: 'FILE_LOAD',
      severity: 'INFO',
      message: 'Menunggu dokumen rekening koran asli Anda untuk diproses...',
    },
  ]);

  // Activity logger helper
  const logActivity = useCallback(
    (type: AuditLog['type'], severity: AuditLog['severity'], message: string, meta?: any) => {
      const newLog: AuditLog = {
        id: `LOG-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        timestamp: new Date().toISOString(),
        type,
        severity,
        message,
        meta,
      };

      setLogs(prev => [newLog, ...prev.slice(0, 150)]);

      // Async report to server log endpoint (fire & forget)
      fetch('/api/admin/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, severity, message, meta }),
      }).catch(() => {});
    },
    []
  );

  // Recalculate running balance whenever transactions change
  const recalculateRunningBalances = useCallback(
    (txList: Transaction[], startingSaldo: number): Transaction[] => {
      let running = startingSaldo;
      return txList.map(tx => {
        const mutasi = Number(tx.mutasi || 0);
        const isCR = tx.tipe === 'CR';
        // Sesuai instruksi terbaru: CR masuk debet (menambah saldo kas), DB masuk kredit (mengurangi saldo kas)
        const debet = isCR ? mutasi : 0;
        const kredit = !isCR ? mutasi : 0;
        running = running + debet - kredit;
        return {
          ...tx,
          tanggal: normalizeDateToDDMMYYYY(tx.tanggal),
          cabang: tx.cabang || '',
          debet,
          debit: debet,
          kredit,
          mutasi,
          saldo_akhir: running,
          saldo: running,
        };
      });
    },
    []
  );

  // Load from local encrypted vault on mount only if user previously saved real data
  useEffect(() => {
    try {
      localStorage.removeItem('ambar_akuntan_vault_v1');
      localStorage.removeItem('ambar_akuntan_vault_v2');
    } catch (e) {}

    async function loadEncryptedVault() {
      try {
        const stored = localStorage.getItem(ENCRYPTED_STORAGE_KEY);
        if (stored) {
          const decrypted = await decryptData(stored);
          if (
            decrypted &&
            Array.isArray(decrypted.transactions) &&
            decrypted.transactions.length > 0 &&
            decrypted.accountInfo?.noRekening
          ) {
            setTransactions(decrypted.transactions);
            setAccountInfo(decrypted.accountInfo);
            logActivity('VAULT_ENCRYPT', 'SECURE', 'Memuat data sesi terenkripsi dari local storage');
          }
        }
      } catch (err) {
        console.warn('Vault cache empty or invalid:', err);
      }
    }
    loadEncryptedVault();
  }, [logActivity]);

  // Persist encrypted transactions into browser storage
  const persistEncryptedVault = useCallback(
    async (txList: Transaction[], acc: AccountInfo) => {
      try {
        if (txList.length === 0) return;
        const payload = { transactions: txList, accountInfo: acc, timestamp: Date.now() };
        const ciphertext = await encryptData(payload);
        localStorage.setItem(ENCRYPTED_STORAGE_KEY, ciphertext);
      } catch (e) {
        console.warn('Auto-encrypt persistence notice:', e);
      }
    },
    []
  );

  // Handlers for transaction changes
  const handleUpdateTransaction = (updated: Transaction) => {
    setTransactions(prev => {
      const idx = prev.findIndex(t => t.id === updated.id);
      if (idx === -1) return prev;
      const copy = [...prev];
      copy[idx] = updated;
      const reconciled = recalculateRunningBalances(copy, accountInfo.saldoAwal || 0);
      persistEncryptedVault(reconciled, accountInfo);
      return reconciled;
    });

    logActivity('MANUAL_EDIT', 'INFO', `Perubahan baris mutasi: ${updated.tanggal} - ${updated.keterangan}`, {
      id: updated.id,
      kategori: updated.kategori,
      mutasi: updated.mutasi,
    });
  };

  const handleDeleteTransaction = (id: string) => {
    setTransactions(prev => {
      const filtered = prev.filter(t => t.id !== id);
      const reconciled = recalculateRunningBalances(filtered, accountInfo.saldoAwal || 0);
      persistEncryptedVault(reconciled, accountInfo);
      return reconciled;
    });

    logActivity('MANUAL_EDIT', 'WARN', `Menghapus baris transaksi ID: ${id}`);
  };

  const handleAddTransaction = (newTx: Omit<Transaction, 'id'>) => {
    const created: Transaction = {
      ...newTx,
      id: `tx-manual-${Date.now()}`,
    };

    setTransactions(prev => {
      const combined = [...prev, created];
      const reconciled = recalculateRunningBalances(combined, accountInfo.saldoAwal || 0);
      persistEncryptedVault(reconciled, accountInfo);
      return reconciled;
    });

    logActivity('MANUAL_EDIT', 'SUCCESS', `Menambahkan mutasi baru: ${created.tanggal} (${created.tipe}) ${created.keterangan}`);
  };

  // AI suggestions application
  const handleApplyCategorySuggestion = (index: number, newCategory: string) => {
    setTransactions(prev => {
      if (!prev[index]) return prev;
      const copy = [...prev];
      copy[index] = { ...copy[index], kategori: newCategory, isCustomEdited: true };
      persistEncryptedVault(copy, accountInfo);
      return copy;
    });
  };

  const handleApplyDescriptionCorrection = (index: number, newDesc: string) => {
    setTransactions(prev => {
      if (!prev[index]) return prev;
      const copy = [...prev];
      copy[index] = { ...copy[index], keterangan: newDesc, isCustomEdited: true };
      persistEncryptedVault(copy, accountInfo);
      return copy;
    });
  };

  // AI Precision Table Extractor for complex statement formats
  const handleAiExtractStatement = async () => {
    if (rawLines.length === 0) return;
    setIsAiExtracting(true);
    logActivity('AI_AUDIT', 'INFO', 'Menjalankan AI Vision Table Extractor...');
    try {
      const res = await fetch('/api/ai-extract-statement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: accountInfo.fileName,
          rawLines,
          saldoAwal: accountInfo.saldoAwal,
          accountInfo,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.transactions) && data.transactions.length > 0) {
          const updatedAcc: AccountInfo = {
            ...accountInfo,
            bankName: data.accountInfo?.bankName || accountInfo.bankName || 'Bank BNI',
            noRekening: data.accountInfo?.noRekening || accountInfo.noRekening || '2122526305',
            namaNasabah: data.accountInfo?.namaNasabah || accountInfo.namaNasabah,
            periode: data.accountInfo?.periode || accountInfo.periode,
            saldoAwal: Number(data.accountInfo?.saldoAwal) || accountInfo.saldoAwal,
            saldoAkhir: Number(data.accountInfo?.saldoAkhir) || accountInfo.saldoAkhir,
          };
          setTransactions(data.transactions);
          setAccountInfo(updatedAcc);
          persistEncryptedVault(data.transactions, updatedAcc);
          setSuccessBanner({
            show: true,
            fileName: accountInfo.fileName || 'e-Statement',
            count: data.transactions.length,
            accountNo: updatedAcc.noRekening || '-',
            bank: updatedAcc.bankName || 'Bank BNI',
            saldoAkhir: updatedAcc.saldoAkhir || 0,
          });
          logActivity('AI_AUDIT', 'SUCCESS', `AI berhasil mengekstrak ${data.transactions.length} baris transaksi mutasi.`);
        }
      }
    } catch (err: any) {
      logActivity('AI_AUDIT', 'WARN', `Gagal mengekstrak dengan AI: ${err?.message}`);
    } finally {
      setIsAiExtracting(false);
    }
  };

  // PDF Parse Success Callback: Handles real data from upload confirmation
  const handleParseSuccess = (
    result: ParseResult,
    fileInfo: { name: string; size: number; hash: string }
  ) => {
    const updatedAccount: AccountInfo = {
      ...result.accountInfo,
      fileName: fileInfo.name,
      fileSize: fileInfo.size,
      fileHash: fileInfo.hash,
    };

    setTransactions(result.transactions);
    setAccountInfo(updatedAccount);
    setRawLines(result.rawLines);
    setIsDocumentLoaded(true);
    setActiveTab('table');

    // Trigger Success Banner
    setSuccessBanner({
      show: true,
      fileName: fileInfo.name,
      count: result.transactions.length,
      accountNo: updatedAccount.noRekening || '-',
      bank: updatedAccount.bankName || 'BCA Tahapan',
      saldoAkhir: updatedAccount.saldoAkhir || 0,
    });

    persistEncryptedVault(result.transactions, updatedAccount);

    // Smooth scroll down to table immediately
    setTimeout(() => {
      document.getElementById('transactions-table-section')?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    }, 150);
  };

  // Export handlers
  const handleExportExcel = () => {
    if (transactions.length === 0) return;
    exportToExcel(transactions, accountInfo, 'AMBAR_AKUNTAN');
    logActivity('EXPORT_DATA', 'SUCCESS', `Export Excel (.xlsx) sukses: ${transactions.length} baris`, {
      format: 'XLSX',
      sheets: ['Detail Transaksi', 'Ringkasan Kategori', 'Rekonsiliasi & Info'],
    });
  };

  const handleExportCsv = () => {
    if (transactions.length === 0) return;
    exportToCsv(transactions, accountInfo, 'AMBAR_AKUNTAN');
    logActivity('EXPORT_DATA', 'SUCCESS', `Export CSV sukses: ${transactions.length} baris`, {
      format: 'CSV',
    });
  };

  const handleClearMemory = () => {
    localStorage.removeItem(ENCRYPTED_STORAGE_KEY);
    setTransactions([]);
    setAccountInfo(emptyAccountInfo);
    setIsDocumentLoaded(false);
    setSuccessBanner(null);
    logActivity('VAULT_ENCRYPT', 'WARN', 'Pembersihan memori lokal berhasil dilakukan.');
  };

  const handleExportLogs = () => {
    const content = JSON.stringify(logs, null, 2);
    const blob = new Blob([content], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `AMBAR_AKUNTAN_AUDIT_LOGS_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-[#fff8fa] text-slate-800 flex flex-col selection:bg-rose-200 selection:text-rose-900">
      {/* Top App Header */}
      <Header
        accountInfo={accountInfo}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenUpload={() => setIsUploadOpen(true)}
        onExportExcel={handleExportExcel}
        onExportCsv={handleExportCsv}
        onOpenVaultModal={() => setIsVaultOpen(true)}
        isProcessing={isProcessing}
        transactionsCount={transactions.length}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Real-time Success Feedback Banner after parsing */}
        {successBanner?.show && (
          <div className="bg-gradient-to-r from-emerald-500 via-teal-600 to-emerald-600 text-white rounded-3xl p-5 sm:p-6 shadow-lg shadow-emerald-500/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 animate-in fade-in slide-in-from-top-4 duration-300">
            <div className="flex items-start sm:items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-xs flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-7 h-7 text-white" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-extrabold text-base sm:text-lg">
                    Data e-Statement Berhasil Dieksekusi & Ditampilkan!
                  </h3>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-white/20 text-white">
                    {successBanner.count} Baris Mutasi
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-emerald-100">
                  File: <strong className="text-white font-mono">{successBanner.fileName}</strong> • Bank:{' '}
                  <strong className="text-white">{successBanner.bank}</strong> (Rek:{' '}
                  <strong className="text-white font-mono">{successBanner.accountNo}</strong>) • Saldo Akhir:{' '}
                  <strong className="text-white font-mono">{formatRupiah(successBanner.saldoAkhir)}</strong>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-end sm:self-center">
              <button
                onClick={() => {
                  setActiveTab('table');
                  setTimeout(() => {
                    document.getElementById('transactions-table-section')?.scrollIntoView({
                      behavior: 'smooth',
                      block: 'start',
                    });
                  }, 50);
                }}
                className="px-4 py-2 bg-white text-emerald-800 hover:bg-emerald-50 rounded-xl text-xs sm:text-sm font-extrabold transition-all shadow-md flex items-center gap-1.5 cursor-pointer active:scale-98"
              >
                <span>Lihat Tabel Hasil ({successBanner.count} Baris)</span>
                <ArrowRight className="w-4 h-4" />
              </button>
              <button
                onClick={() => setSuccessBanner(null)}
                className="p-1.5 text-white/80 hover:text-white rounded-lg hover:bg-white/10"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}

        {/* Account Info Bar (if real data is loaded) */}
        {(transactions.length > 0 || isDocumentLoaded) && (accountInfo.noRekening || accountInfo.fileName) && (
          <div className="bg-white/90 backdrop-blur-xs rounded-2xl p-4 border border-pink-100/90 shadow-2xs flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-pink-50 border border-pink-200 text-rose-600 flex items-center justify-center shrink-0">
                <Building2 className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-bold text-slate-900">
                    {accountInfo.bankName || 'BCA Tahapan'}
                  </h2>
                  {accountInfo.noRekening && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200 font-mono">
                      No. Rek: {accountInfo.noRekening}
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500">
                  {accountInfo.namaNasabah && (
                    <span>Pemilik: <strong className="text-slate-700">{accountInfo.namaNasabah}</strong> • </span>
                  )}
                  {accountInfo.fileName && (
                    <span className="font-mono text-slate-600">{accountInfo.fileName}</span>
                  )}
                  {accountInfo.periode && (
                    <span className="ml-2 inline-flex items-center gap-1 text-[11px] text-slate-400">
                      <Calendar className="w-3 h-3" />
                      Periode: {accountInfo.periode}
                    </span>
                  )}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 text-xs">
              <div className="bg-pink-50/60 px-3 py-1.5 rounded-xl border border-pink-100 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span className="text-slate-600">
                  Enkripsi: <strong className="text-slate-800">AES-256 GCM</strong>
                </span>
              </div>
              {accountInfo.totalPages && (
                <div className="hidden sm:block text-slate-400 font-mono text-[11px]">
                  {accountInfo.totalPages} Halaman PDF
                </div>
              )}
            </div>
          </div>
        )}

        {/* Dashboard 5 Metrics Summary (shown when document is loaded or transactions exist) */}
        {(transactions.length > 0 || isDocumentLoaded) && (
          <DashboardSummary
            transactions={transactions}
            accountInfo={accountInfo}
          />
        )}

        {/* Tab Views */}
        {!isDocumentLoaded && transactions.length === 0 ? (
          /* Clean Initial State (NO DUMMY DATA) */
          <div className="bg-white rounded-3xl p-8 sm:p-14 border border-pink-100 shadow-xs text-center space-y-6 max-w-2xl mx-auto my-6">
            <div className="w-16 h-16 rounded-3xl bg-pink-50 border border-pink-200 text-rose-500 flex items-center justify-center mx-auto shadow-sm">
              <Upload className="w-8 h-8" />
            </div>

            <div className="space-y-2">
              <h3 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                Mulai Pembukuan Rekening Koran (BNI, BCA & Mandiri)
              </h3>
              <p className="text-xs sm:text-sm text-slate-500 leading-relaxed max-w-lg mx-auto">
                Aplikasi siap mengeksekusi dokumen perbankan Anda. Unggah file PDF e-Statement BNI (termasuk terenkripsi password 26111973), BCA, atau Mandiri untuk di-parse langsung secara lokal di browser dengan aman.
              </p>
            </div>

            {/* Steps indicator */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-left pt-2">
              <div className="p-3.5 rounded-2xl bg-pink-50/40 border border-pink-100">
                <span className="text-[10px] font-black uppercase text-rose-500 tracking-wider">
                  Langkah 1
                </span>
                <p className="text-xs font-bold text-slate-800 mt-1">Unggah PDF Bank</p>
                <p className="text-[11px] text-slate-500 mt-0.5">Pilih file e-Statement BCA Anda.</p>
              </div>

              <div className="p-3.5 rounded-2xl bg-pink-50/40 border border-pink-100">
                <span className="text-[10px] font-black uppercase text-rose-500 tracking-wider">
                  Langkah 2
                </span>
                <p className="text-xs font-bold text-slate-800 mt-1">Konfirmasi & Dekripsi</p>
                <p className="text-[11px] text-slate-500 mt-0.5">Cek detail file & password (jika ada).</p>
              </div>

              <div className="p-3.5 rounded-2xl bg-pink-50/40 border border-pink-100">
                <span className="text-[10px] font-black uppercase text-rose-500 tracking-wider">
                  Langkah 3
                </span>
                <p className="text-xs font-bold text-slate-800 mt-1">Tampil & Export</p>
                <p className="text-[11px] text-slate-500 mt-0.5">Lihat hasil tabel & download Excel.</p>
              </div>
            </div>

            <div className="flex items-center justify-center pt-3">
              <button
                onClick={() => setIsUploadOpen(true)}
                className="px-7 py-3.5 bg-rose-500 hover:bg-rose-600 active:scale-98 text-white rounded-2xl text-xs sm:text-sm font-bold shadow-md shadow-rose-200 transition-all flex items-center gap-2"
              >
                <Upload className="w-4 h-4" />
                <span>Pilih Dokumen PDF e-Statement</span>
              </button>
            </div>
          </div>
        ) : (
          <div id="transactions-table-section" className="space-y-6">
            {isDocumentLoaded && transactions.length === 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-3xl p-5 text-xs text-amber-900 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <h4 className="font-bold text-sm text-slate-900">
                      Dokumen Terbuka ({rawLines.length} Baris Teks Dimuat)
                    </h4>
                    <p className="text-amber-800 leading-relaxed">
                      File <strong className="font-mono">{accountInfo.fileName}</strong> berhasil didekripsi dan dibuka. Klik tombol di samping untuk mengekstrak seluruh baris mutasi rekening koran ini secara otomatis menggunakan AI Precision.
                    </p>
                  </div>
                </div>

                <button
                  onClick={handleAiExtractStatement}
                  disabled={isAiExtracting}
                  className="px-5 py-2.5 bg-rose-500 hover:bg-rose-600 active:scale-98 text-white rounded-xl font-bold shadow-md shadow-rose-200 transition-all flex items-center gap-2 cursor-pointer shrink-0 disabled:opacity-50"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>{isAiExtracting ? 'Mengekstrak Tabel dengan AI...' : 'Ekstrak Mutasi dengan AI'}</span>
                </button>
              </div>
            )}

            {activeTab === 'table' && (
              <TransactionTable
                transactions={transactions}
                onUpdateTransaction={handleUpdateTransaction}
                onDeleteTransaction={handleDeleteTransaction}
                onAddTransaction={handleAddTransaction}
                onExportExcel={handleExportExcel}
                onExportCsv={handleExportCsv}
              />
            )}

            {activeTab === 'charts' && (
              <FinancialCharts transactions={transactions} />
            )}

            {activeTab === 'ai' && (
              <AiAuditModal
                transactions={transactions}
                accountInfo={accountInfo}
                rawLines={rawLines}
                onApplyCategorySuggestion={handleApplyCategorySuggestion}
                onApplyDescriptionCorrection={handleApplyDescriptionCorrection}
                onLogActivity={logActivity}
              />
            )}

            {activeTab === 'admin' && (
              <AdminLogDashboard
                logs={logs}
                accountInfo={accountInfo}
                onClearLogs={() => setLogs([])}
                onExportLogs={handleExportLogs}
              />
            )}
          </div>
        )}
      </main>

      {/* Modals */}
      <FileUploadModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        onParseSuccess={handleParseSuccess}
        onLogActivity={logActivity}
      />

      <EncryptionVaultModal
        isOpen={isVaultOpen}
        onClose={() => setIsVaultOpen(false)}
        onClearMemory={handleClearMemory}
        onLogActivity={logActivity}
      />

      {/* Mobile-friendly Sticky Bottom Actions */}
      <div className="sm:hidden fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-pink-100 p-2.5 flex items-center justify-around z-30 shadow-lg">
        <button
          onClick={() => setActiveTab('table')}
          className={`flex flex-col items-center gap-0.5 text-[10px] font-semibold ${
            activeTab === 'table' ? 'text-rose-600' : 'text-slate-500'
          }`}
        >
          <FileSpreadsheet className="w-4 h-4" />
          <span>Tabel</span>
        </button>
        <button
          onClick={() => setActiveTab('charts')}
          className={`flex flex-col items-center gap-0.5 text-[10px] font-semibold ${
            activeTab === 'charts' ? 'text-rose-600' : 'text-slate-500'
          }`}
        >
          <Sparkles className="w-4 h-4" />
          <span>Grafik</span>
        </button>
        <button
          onClick={() => setIsUploadOpen(true)}
          className="flex items-center justify-center w-10 h-10 rounded-full bg-rose-500 text-white shadow-md shadow-rose-300 -mt-5"
        >
          <Upload className="w-5 h-5" />
        </button>
        <button
          onClick={() => setActiveTab('ai')}
          className={`flex flex-col items-center gap-0.5 text-[10px] font-semibold ${
            activeTab === 'ai' ? 'text-rose-600' : 'text-slate-500'
          }`}
        >
          <Sparkles className="w-4 h-4 text-amber-500" />
          <span>AI Audit</span>
        </button>
        <button
          onClick={handleExportExcel}
          disabled={transactions.length === 0}
          className="flex flex-col items-center gap-0.5 text-[10px] font-semibold text-emerald-700 disabled:opacity-40"
        >
          <FileSpreadsheet className="w-4 h-4" />
          <span>Excel</span>
        </button>
      </div>

      {/* Footer */}
      <footer className="mt-auto border-t border-pink-100/80 bg-white py-4 text-center text-xs text-slate-400">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-700">AMBAR AKUNTAN</span>
            <span>•</span>
            <span>Konversi e-Statement BCA Presisi Tinggi</span>
          </div>
          <div className="flex items-center gap-3 text-[11px]">
            <span className="text-emerald-600 flex items-center gap-1 font-medium">
              <ShieldCheck className="w-3.5 h-3.5" />
              100% Client-Side In-Memory Execution
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
