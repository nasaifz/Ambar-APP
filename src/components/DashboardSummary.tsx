import React from 'react';
import {
  TrendingUp,
  TrendingDown,
  Building2,
  Users,
  Wallet,
  ArrowDownLeft,
  ArrowUpRight,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { Transaction, AccountInfo } from '../types';
import { formatRupiah } from '../utils/categorizer';

interface DashboardSummaryProps {
  transactions: Transaction[];
  accountInfo: AccountInfo;
}

export const DashboardSummary: React.FC<DashboardSummaryProps> = ({
  transactions,
  accountInfo,
}) => {
  // 1. Total Pemasukan Cash (Omzet & Dokter) - mutasi CR masuk debet
  const totalCashOmzet = transactions
    .filter(t => t.kategori === 'Pemasukan Cash Omzet & Dokter')
    .reduce((sum, t) => sum + (t.debet || (t.tipe === 'CR' ? t.mutasi : 0)), 0);

  // 2. Total Tagihan Supplier & Operasional Apotek - mutasi DB masuk kredit
  const totalSupplier = transactions
    .filter(t => t.kategori === 'Tagihan Supplier & Operasional Apotek')
    .reduce((sum, t) => sum + (t.kredit || (t.tipe === 'DB' ? t.mutasi : 0)), 0);

  // 3. Total Gaji + THR Karyawan - mutasi DB masuk kredit
  const totalGajiTHR = transactions
    .filter(t => t.kategori === 'Gaji & Lembur Karyawan' || t.kategori === 'THR Karyawan')
    .reduce((sum, t) => sum + (t.kredit || (t.tipe === 'DB' ? t.mutasi : 0)), 0);

  // 4. Total Transfer Masuk - mutasi CR masuk debet
  const totalTransferMasuk = transactions
    .filter(t => t.kategori === 'Transfer Masuk Pribadi' || (t.tipe === 'CR' && t.kategori !== 'Pemasukan Cash Omzet & Dokter' && t.kategori !== 'Bunga Bank'))
    .reduce((sum, t) => sum + (t.debet || (t.tipe === 'CR' ? t.mutasi : 0)), 0);

  // Saldo Akhir & Running Balance verification
  // Sesuai instruksi: CR masuk debet (penerimaan), DB masuk kredit (pengeluaran)
  const totalDebet = transactions.reduce((sum, t) => sum + (t.debet || (t.tipe === 'CR' ? t.mutasi : 0)), 0);
  const totalKredit = transactions.reduce((sum, t) => sum + (t.kredit || (t.tipe === 'DB' ? t.mutasi : 0)), 0);
  const saldoAwal = accountInfo.saldoAwal || 0;
  const saldoAkhir = transactions.length > 0 ? (transactions[transactions.length - 1].saldo_akhir ?? transactions[transactions.length - 1].saldo) : accountInfo.saldoAkhir || 0;
  const calculatedSaldoAkhir = saldoAwal + totalDebet - totalKredit;
  const isReconciled = Math.abs(saldoAkhir - calculatedSaldoAkhir) < 2;

  return (
    <div className="space-y-4">
      {/* 5 Core Metrics required by user */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
        {/* Metric 1: Total Pemasukan Cash Omzet & Dokter */}
        <div className="bg-white rounded-2xl p-4 border border-pink-100 shadow-xs hover:border-pink-300 transition-all">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1.5">
            <span className="font-semibold text-emerald-700">Pemasukan Cash Omzet</span>
            <div className="w-7 h-7 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-lg sm:text-xl font-bold text-slate-900 font-mono-numbers">
            {formatRupiah(totalCashOmzet)}
          </div>
          <p className="text-[11px] text-emerald-600 mt-1 flex items-center gap-1">
            <ArrowDownLeft className="w-3 h-3" />
            Cash, Omzet, Dokter & Pasien
          </p>
        </div>

        {/* Metric 2: Total Tagihan Supplier & Operasional Apotek */}
        <div className="bg-white rounded-2xl p-4 border border-pink-100 shadow-xs hover:border-pink-300 transition-all">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1.5">
            <span className="font-semibold text-indigo-700">Tagihan Supplier & Obat</span>
            <div className="w-7 h-7 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Building2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-lg sm:text-xl font-bold text-slate-900 font-mono-numbers">
            {formatRupiah(totalSupplier)}
          </div>
          <p className="text-[11px] text-indigo-600 mt-1 flex items-center gap-1">
            <ArrowUpRight className="w-3 h-3" />
            Emma, Swiperx, Penta, dll
          </p>
        </div>

        {/* Metric 3: Total Gaji + THR Karyawan */}
        <div className="bg-white rounded-2xl p-4 border border-pink-100 shadow-xs hover:border-pink-300 transition-all">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1.5">
            <span className="font-semibold text-rose-700">Gaji & THR Karyawan</span>
            <div className="w-7 h-7 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="text-lg sm:text-xl font-bold text-slate-900 font-mono-numbers">
            {formatRupiah(totalGajiTHR)}
          </div>
          <p className="text-[11px] text-rose-600 mt-1 flex items-center gap-1">
            <ArrowUpRight className="w-3 h-3" />
            Gaji, Lembur, Bonus, THR
          </p>
        </div>

        {/* Metric 4: Total Transfer Masuk */}
        <div className="bg-white rounded-2xl p-4 border border-pink-100 shadow-xs hover:border-pink-300 transition-all">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1.5">
            <span className="font-semibold text-teal-700">Transfer Masuk Pribadi</span>
            <div className="w-7 h-7 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center">
              <ArrowDownLeft className="w-4 h-4" />
            </div>
          </div>
          <div className="text-lg sm:text-xl font-bold text-slate-900 font-mono-numbers">
            {formatRupiah(totalTransferMasuk)}
          </div>
          <p className="text-[11px] text-teal-600 mt-1 flex items-center gap-1">
            <TrendingUp className="w-3 h-3" />
            BI-FAST CR & Titipan
          </p>
        </div>

        {/* Metric 5: Saldo Akhir */}
        <div className="bg-gradient-to-br from-rose-500 to-pink-600 rounded-2xl p-4 text-white shadow-sm shadow-pink-200">
          <div className="flex items-center justify-between text-xs text-pink-100 mb-1.5">
            <span className="font-semibold">Saldo Akhir Rekening</span>
            <div className="w-7 h-7 rounded-xl bg-white/20 text-white flex items-center justify-center">
              <Wallet className="w-4 h-4" />
            </div>
          </div>
          <div className="text-lg sm:text-xl font-black font-mono-numbers tracking-tight">
            {formatRupiah(saldoAkhir)}
          </div>
          <div className="flex items-center gap-1 mt-1 text-[11px] text-pink-100">
            {isReconciled ? (
              <span className="flex items-center gap-1 bg-white/20 px-2 py-0.5 rounded-full text-[10px]">
                <CheckCircle2 className="w-3 h-3 text-emerald-200" />
                Matematika Presisi Match
              </span>
            ) : (
              <span className="flex items-center gap-1 bg-amber-400 text-amber-950 px-2 py-0.5 rounded-full text-[10px] font-semibold">
                <AlertTriangle className="w-3 h-3" />
                Cek Selisih Running Balance
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Sub-bar: Saldo Awal, Total Masuk (Debet / CR), Total Keluar (Kredit / DB), Net Cashflow */}
      <div className="bg-white/80 backdrop-blur-xs rounded-xl p-3 border border-pink-100 text-xs flex flex-wrap items-center justify-between gap-3 text-slate-600">
        <div className="flex items-center gap-4 flex-wrap">
          <div>
            <span className="text-slate-400">Saldo Awal:</span>{' '}
            <span className="font-semibold text-slate-800 font-mono-numbers">{formatRupiah(saldoAwal)}</span>
          </div>
          <div>
            <span className="text-slate-400">Total Debet (Masuk / CR):</span>{' '}
            <span className="font-semibold text-emerald-600 font-mono-numbers">+{formatRupiah(totalDebet)}</span>
          </div>
          <div>
            <span className="text-slate-400">Total Kredit (Keluar / DB):</span>{' '}
            <span className="font-semibold text-rose-600 font-mono-numbers">-{formatRupiah(totalKredit)}</span>
          </div>
          <div>
            <span className="text-slate-400">Net Arus Kas:</span>{' '}
            <span
              className={`font-semibold font-mono-numbers ${
                totalDebet - totalKredit >= 0 ? 'text-emerald-700' : 'text-rose-700'
              }`}
            >
              {totalDebet - totalKredit >= 0 ? '+' : ''}
              {formatRupiah(totalDebet - totalKredit)}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 text-[11px] text-slate-500">
          <span className="inline-block w-2 h-2 rounded-full bg-rose-500"></span>
          <span>Rekonsiliasi Mutasi e-Statement (BNI, BCA & Mandiri)</span>
        </div>
      </div>
    </div>
  );
};
