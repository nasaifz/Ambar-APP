import React from 'react';
import {
  FileSpreadsheet,
  Upload,
  Download,
  Activity,
  FileText,
  BarChart3,
  Sparkles,
  ShieldCheck,
} from 'lucide-react';
import { AccountInfo } from '../types';

interface HeaderProps {
  accountInfo: AccountInfo;
  activeTab: 'table' | 'charts' | 'ai' | 'admin';
  setActiveTab: (tab: 'table' | 'charts' | 'ai' | 'admin') => void;
  onOpenUpload: () => void;
  onExportExcel: () => void;
  onExportCsv: () => void;
  onOpenVaultModal: () => void;
  isProcessing: boolean;
  transactionsCount: number;
}

export const Header: React.FC<HeaderProps> = ({
  accountInfo,
  activeTab,
  setActiveTab,
  onOpenUpload,
  onExportExcel,
  onExportCsv,
  onOpenVaultModal,
  isProcessing,
  transactionsCount,
}) => {
  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-pink-100 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Top Header Row */}
        <div className="flex items-center justify-between h-16 sm:h-18 gap-4">
          {/* Brand Logo & Description */}
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-pink-500 via-rose-500 to-rose-400 flex items-center justify-center text-white shadow-sm shadow-rose-200 shrink-0">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-lg sm:text-xl font-black tracking-tight text-slate-900 truncate">
                  AMBAR <span className="text-rose-500 font-extrabold">APP</span>
                </h1>
                <span className="hidden md:inline text-slate-300">·</span>
                <span className="hidden md:inline text-xs text-slate-500 font-medium truncate">
                  Rekapitulasi Rekening Koran Presisi
                </span>
              </div>
              <p className="text-[11px] text-slate-400 truncate hidden sm:block">
                Parsing Mandiri, BCA, & BNI • 100% Pemrosesan Memori Lokal
              </p>
            </div>
          </div>

          {/* Right Actions */}
          <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
            {/* Security Status Button */}
            <button
              onClick={onOpenVaultModal}
              title="Status Enkripsi Web Crypto AES-256 GCM"
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 sm:px-3 sm:py-2 text-xs font-medium text-slate-600 hover:text-rose-600 bg-pink-50/50 hover:bg-pink-50 border border-pink-200/80 rounded-xl transition-colors cursor-pointer"
            >
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="hidden lg:inline text-slate-700 font-semibold">Keamanan Lokal</span>
              <span className="hidden sm:inline lg:hidden font-mono text-[11px]">AES-256</span>
            </button>

            {/* Export Buttons (when data loaded) */}
            {transactionsCount > 0 && (
              <div className="inline-flex items-center p-0.5 bg-slate-100 rounded-xl border border-slate-200/80">
                <button
                  onClick={onExportExcel}
                  title="Unduh file Microsoft Excel (.xlsx)"
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-white rounded-lg transition-all cursor-pointer"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span className="hidden sm:inline">Excel</span>
                  <span className="sm:hidden font-mono text-[11px]">XLSX</span>
                </button>
                <div className="w-px h-4 bg-slate-300 mx-0.5" />
                <button
                  onClick={onExportCsv}
                  title="Unduh file CSV"
                  className="inline-flex items-center gap-1 px-2 py-1.5 text-xs font-semibold text-slate-700 hover:bg-white rounded-lg transition-all cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                  <span className="hidden sm:inline">CSV</span>
                </button>
              </div>
            )}

            {/* Primary Action Button */}
            <button
              onClick={onOpenUpload}
              disabled={isProcessing}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 sm:px-4 sm:py-2 text-xs sm:text-sm font-bold text-white bg-rose-500 hover:bg-rose-600 active:scale-98 rounded-xl shadow-xs shadow-rose-200 transition-all disabled:opacity-50 cursor-pointer"
            >
              <Upload className="w-4 h-4 shrink-0" />
              <span>Unggah PDF</span>
            </button>
          </div>
        </div>

        {/* Tab Navigation Row with refined underline tabs */}
        <nav className="flex items-center gap-1 sm:gap-6 overflow-x-auto border-t border-pink-50 scrollbar-none -mb-px">
          <button
            onClick={() => setActiveTab('table')}
            className={`inline-flex items-center gap-2 py-3 px-1 text-xs sm:text-sm font-medium border-b-2 whitespace-nowrap transition-colors cursor-pointer ${
              activeTab === 'table'
                ? 'border-rose-600 text-rose-600 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
            }`}
          >
            <FileText className="w-4 h-4 shrink-0" />
            <span>Tabel Mutasi</span>
            {transactionsCount > 0 && (
              <span
                className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full ${
                  activeTab === 'table'
                    ? 'bg-rose-100 text-rose-700 font-bold'
                    : 'bg-slate-100 text-slate-600'
                }`}
              >
                {transactionsCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('charts')}
            className={`inline-flex items-center gap-2 py-3 px-1 text-xs sm:text-sm font-medium border-b-2 whitespace-nowrap transition-colors cursor-pointer ${
              activeTab === 'charts'
                ? 'border-rose-600 text-rose-600 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
            }`}
          >
            <BarChart3 className="w-4 h-4 shrink-0" />
            <span>Grafik & Analisis Kas</span>
          </button>

          <button
            onClick={() => setActiveTab('ai')}
            className={`inline-flex items-center gap-2 py-3 px-1 text-xs sm:text-sm font-medium border-b-2 whitespace-nowrap transition-colors cursor-pointer ${
              activeTab === 'ai'
                ? 'border-rose-600 text-rose-600 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
            }`}
          >
            <Sparkles className="w-4 h-4 shrink-0 text-amber-500" />
            <span>Audit Presisi AI</span>
          </button>

          <button
            onClick={() => setActiveTab('admin')}
            className={`inline-flex items-center gap-2 py-3 px-1 text-xs sm:text-sm font-medium border-b-2 whitespace-nowrap transition-colors cursor-pointer ${
              activeTab === 'admin'
                ? 'border-rose-600 text-rose-600 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
            }`}
          >
            <Activity className="w-4 h-4 shrink-0" />
            <span>Log Aktivitas</span>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
          </button>
        </nav>
      </div>
    </header>
  );
};
