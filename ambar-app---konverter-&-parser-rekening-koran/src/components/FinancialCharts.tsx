import React, { useState } from 'react';
import { Transaction } from '../types';
import { formatRupiah, getCategoryBadgeColor } from '../utils/categorizer';
import { BarChart3, PieChart, ArrowUpRight, ArrowDownLeft } from 'lucide-react';

interface FinancialChartsProps {
  transactions: Transaction[];
}

export const FinancialCharts: React.FC<FinancialChartsProps> = ({ transactions }) => {
  const [viewMode, setViewMode] = useState<'daily' | 'category'>('daily');

  // Aggregate by Date (DD/MM)
  const dailyMap = new Map<string, { date: string; income: number; expense: number }>();
  for (const t of transactions) {
    const d = t.tanggal || 'Lainnya';
    const entry = dailyMap.get(d) || { date: d, income: 0, expense: 0 };
    if (t.tipe === 'CR') {
      entry.income += (t.debet || t.mutasi);
    } else {
      entry.expense += (t.kredit || t.mutasi);
    }
    dailyMap.set(d, entry);
  }

  const dailyData = Array.from(dailyMap.values());
  const maxDailyValue = Math.max(
    ...dailyData.map(d => Math.max(d.income, d.expense)),
    1000000
  );

  // Aggregate by Category
  const categoryMap = new Map<string, { category: string; total: number; count: number; type: 'DB' | 'CR' }>();
  for (const t of transactions) {
    const c = t.kategori || 'Lain-lain';
    const entry = categoryMap.get(c) || { category: c, total: 0, count: 0, type: t.tipe };
    entry.total += t.mutasi;
    entry.count += 1;
    categoryMap.set(c, entry);
  }

  const categoryData = Array.from(categoryMap.values()).sort((a, b) => b.total - a.total);
  const totalExpenditure = transactions.reduce((acc, t) => acc + (t.kredit || (t.tipe === 'DB' ? t.mutasi : 0)), 0);
  const totalIncome = transactions.reduce((acc, t) => acc + (t.debet || (t.tipe === 'CR' ? t.mutasi : 0)), 0);

  return (
    <div className="bg-white rounded-2xl p-5 border border-pink-100 shadow-xs space-y-6">
      {/* Chart Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-4 border-b border-pink-50">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-rose-500" />
            Visualisasi Arus Kas & Analisis Mutasi
          </h2>
          <p className="text-xs text-slate-500">
            Perbandingan harian Pemasukan vs Pengeluaran rekening koran
          </p>
        </div>

        {/* View mode toggle */}
        <div className="flex items-center gap-1 bg-pink-50/80 p-1 rounded-xl border border-pink-100">
          <button
            onClick={() => setViewMode('daily')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              viewMode === 'daily'
                ? 'bg-rose-500 text-white shadow-2xs'
                : 'text-slate-600 hover:text-rose-600'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span>Grafik Batang Harian</span>
          </button>
          <button
            onClick={() => setViewMode('category')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              viewMode === 'category'
                ? 'bg-rose-500 text-white shadow-2xs'
                : 'text-slate-600 hover:text-rose-600'
            }`}
          >
            <PieChart className="w-3.5 h-3.5" />
            <span>Distribusi Kategori</span>
          </button>
        </div>
      </div>

      {viewMode === 'daily' ? (
        <div className="space-y-4">
          {/* Legend */}
          <div className="flex items-center justify-between flex-wrap gap-2 text-xs">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-md bg-emerald-500 inline-block shadow-2xs" />
                <span className="font-medium text-slate-700">Pemasukan (Kredit / CR)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-md bg-rose-500 inline-block shadow-2xs" />
                <span className="font-medium text-slate-700">Pengeluaran (Debit / DB)</span>
              </div>
            </div>
            <div className="text-[11px] text-slate-400">
              Menampilkan {dailyData.length} tanggal transaksi aktif
            </div>
          </div>

          {/* Interactive Bar Chart */}
          <div className="relative pt-6 pb-2 overflow-x-auto scrollbar-thin">
            <div className="min-w-[640px] flex items-end justify-between gap-3 h-64 border-b border-slate-200 px-2">
              {dailyData.map((d, idx) => {
                const incomeHeight = Math.max((d.income / maxDailyValue) * 100, d.income > 0 ? 5 : 0);
                const expenseHeight = Math.max((d.expense / maxDailyValue) * 100, d.expense > 0 ? 5 : 0);

                return (
                  <div
                    key={idx}
                    className="flex-1 flex flex-col items-center justify-end h-full group relative"
                  >
                    {/* Tooltip on hover */}
                    <div className="absolute -top-16 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20 bg-slate-900 text-white text-[10px] p-2 rounded-lg shadow-lg whitespace-nowrap">
                      <div className="font-bold border-b border-slate-700 pb-0.5 mb-1">
                        Tanggal: {d.date}
                      </div>
                      <div className="text-emerald-400 flex items-center justify-between gap-2">
                        <span>Masuk:</span> <span>{formatRupiah(d.income)}</span>
                      </div>
                      <div className="text-rose-400 flex items-center justify-between gap-2">
                        <span>Keluar:</span> <span>{formatRupiah(d.expense)}</span>
                      </div>
                    </div>

                    {/* Bars pair */}
                    <div className="w-full flex items-end justify-center gap-1">
                      {/* Income Bar */}
                      <div
                        style={{ height: `${incomeHeight}%` }}
                        className="w-full max-w-[16px] bg-gradient-to-t from-emerald-500 to-emerald-400 rounded-t-md group-hover:from-emerald-600 group-hover:to-emerald-500 transition-all cursor-pointer shadow-2xs"
                        title={`Masuk: ${formatRupiah(d.income)}`}
                      />

                      {/* Expense Bar */}
                      <div
                        style={{ height: `${expenseHeight}%` }}
                        className="w-full max-w-[16px] bg-gradient-to-t from-rose-500 to-rose-400 rounded-t-md group-hover:from-rose-600 group-hover:to-rose-500 transition-all cursor-pointer shadow-2xs"
                        title={`Keluar: ${formatRupiah(d.expense)}`}
                      />
                    </div>

                    {/* Date label */}
                    <span className="text-[10px] font-mono text-slate-500 mt-2 transform group-hover:text-slate-900 font-medium">
                      {d.date}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        /* Category Breakdown View */
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Expense Breakdown */}
            <div className="border border-rose-100 bg-rose-50/20 rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-bold text-rose-800 uppercase tracking-wider flex items-center gap-1.5">
                  <ArrowUpRight className="w-4 h-4 text-rose-600" />
                  Alokasi Pengeluaran (Debit)
                </h3>
                <span className="text-xs font-bold text-rose-700 font-mono-numbers">
                  {formatRupiah(totalExpenditure)}
                </span>
              </div>

              <div className="space-y-2.5">
                {categoryData
                  .filter(c => c.type === 'DB')
                  .map((item, idx) => {
                    const pct = totalExpenditure > 0 ? (item.total / totalExpenditure) * 100 : 0;
                    const badge = getCategoryBadgeColor(item.category);
                    return (
                      <div key={idx} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-medium text-slate-800 truncate pr-2">
                            {item.category}
                          </span>
                          <span className="font-mono text-slate-700 whitespace-nowrap">
                            {formatRupiah(item.total)}{' '}
                            <span className="text-[10px] text-slate-400">({pct.toFixed(1)}%)</span>
                          </span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                          <div
                            className={`h-full ${badge.dot}`}
                            style={{ width: `${Math.min(pct, 100)}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>

            {/* Income Breakdown */}
            <div className="border border-emerald-100 bg-emerald-50/20 rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-bold text-emerald-800 uppercase tracking-wider flex items-center gap-1.5">
                  <ArrowDownLeft className="w-4 h-4 text-emerald-600" />
                  Sumber Pemasukan (Kredit)
                </h3>
                <span className="text-xs font-bold text-emerald-700 font-mono-numbers">
                  {formatRupiah(totalIncome)}
                </span>
              </div>

              <div className="space-y-2.5">
                {categoryData
                  .filter(c => c.type === 'CR')
                  .map((item, idx) => {
                    const pct = totalIncome > 0 ? (item.total / totalIncome) * 100 : 0;
                    const badge = getCategoryBadgeColor(item.category);
                    return (
                      <div key={idx} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-medium text-slate-800 truncate pr-2">
                            {item.category}
                          </span>
                          <span className="font-mono text-slate-700 whitespace-nowrap">
                            {formatRupiah(item.total)}{' '}
                            <span className="text-[10px] text-slate-400">({pct.toFixed(1)}%)</span>
                          </span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                          <div
                            className={`h-full ${badge.dot}`}
                            style={{ width: `${Math.min(pct, 100)}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
