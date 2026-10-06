import React, { useState, useMemo } from 'react';
import {
  Search,
  Filter,
  ArrowUpDown,
  Edit2,
  Trash2,
  Plus,
  Check,
  X,
  FileSpreadsheet,
  Download,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';
import { Transaction } from '../types';
import {
  CATEGORIES,
  getCategoryBadgeColor,
  formatRupiah,
  formatNumber,
} from '../utils/categorizer';

interface TransactionTableProps {
  transactions: Transaction[];
  onUpdateTransaction: (updated: Transaction) => void;
  onDeleteTransaction: (id: string) => void;
  onAddTransaction: (newTx: Omit<Transaction, 'id'>) => void;
  onExportExcel: () => void;
  onExportCsv: () => void;
}

export const TransactionTable: React.FC<TransactionTableProps> = ({
  transactions,
  onUpdateTransaction,
  onDeleteTransaction,
  onAddTransaction,
  onExportExcel,
  onExportCsv,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedType, setSelectedType] = useState<'ALL' | 'DB' | 'CR'>('ALL');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<Transaction>>({});
  const [showAddModal, setShowAddModal] = useState(false);

  // New transaction form state
  const [newTanggal, setNewTanggal] = useState('01/05/2026');
  const [newKeterangan, setNewKeterangan] = useState('');
  const [newCabang, setNewCabang] = useState('');
  const [newTipe, setNewTipe] = useState<'DB' | 'CR'>('CR');
  const [newMutasi, setNewMutasi] = useState<number>(0);
  const [newKategori, setNewKategori] = useState<string>('Pemasukan Cash Omzet & Dokter');

  // Filtered transactions
  const filtered = useMemo(() => {
    return transactions.filter(t => {
      const matchSearch =
        t.keterangan.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.tanggal.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (t.cabang && t.cabang.toLowerCase().includes(searchTerm.toLowerCase())) ||
        t.mutasi.toString().includes(searchTerm) ||
        (t.debet && t.debet.toString().includes(searchTerm)) ||
        (t.kredit && t.kredit.toString().includes(searchTerm));

      const matchCat =
        selectedCategory === 'ALL' || t.kategori === selectedCategory;

      const matchType = selectedType === 'ALL' || t.tipe === selectedType;

      return matchSearch && matchCat && matchType;
    });
  }, [transactions, searchTerm, selectedCategory, selectedType]);

  // Totals for table footer
  const totalDebet = useMemo(() => {
    return filtered.reduce((acc, t) => acc + (t.debet || (t.tipe === 'CR' ? t.mutasi : 0)), 0);
  }, [filtered]);

  const totalKredit = useMemo(() => {
    return filtered.reduce((acc, t) => acc + (t.kredit || (t.tipe === 'DB' ? t.mutasi : 0)), 0);
  }, [filtered]);

  const lastSaldoAkhir = useMemo(() => {
    if (filtered.length === 0) return 0;
    return filtered[filtered.length - 1].saldo_akhir ?? filtered[filtered.length - 1].saldo ?? 0;
  }, [filtered]);

  const startEdit = (t: Transaction) => {
    setEditingId(t.id);
    setEditForm({ ...t });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({});
  };

  const saveEdit = (id: string) => {
    const original = transactions.find(t => t.id === id);
    if (!original) return;

    const mutasi = Number(editForm.mutasi ?? original.mutasi);
    const tipe = (editForm.tipe ?? original.tipe) as 'DB' | 'CR';
    const isCR = tipe === 'CR';
    // Sesuai instruksi: CR masuk debet, DB masuk kredit
    const debet = isCR ? mutasi : 0;
    const kredit = !isCR ? mutasi : 0;

    const updated: Transaction = {
      ...original,
      tanggal: editForm.tanggal || original.tanggal,
      keterangan: editForm.keterangan || original.keterangan,
      cabang: editForm.cabang !== undefined ? editForm.cabang : (original.cabang || ''),
      tipe,
      mutasi,
      debet,
      debit: debet,
      kredit,
      kategori: editForm.kategori || original.kategori,
      isCustomEdited: true,
    };

    onUpdateTransaction(updated);
    setEditingId(null);
    setEditForm({});
  };

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKeterangan || newMutasi <= 0) return;

    const isCR = newTipe === 'CR';
    const debet = isCR ? newMutasi : 0;
    const kredit = !isCR ? newMutasi : 0;

    onAddTransaction({
      tanggal: newTanggal,
      keterangan: newKeterangan,
      cabang: newCabang.trim(),
      tipe: newTipe,
      debet,
      debit: debet,
      kredit,
      mutasi: newMutasi,
      saldo_akhir: 0, // will be recalculated by balance engine
      saldo: 0,
      kategori: newKategori,
    });

    setShowAddModal(false);
    setNewKeterangan('');
    setNewCabang('');
    setNewMutasi(0);
  };

  return (
    <div className="bg-white rounded-2xl border border-pink-100 shadow-xs overflow-hidden">
      {/* Controls Bar */}
      <div className="p-4 sm:p-5 border-b border-pink-100/80 bg-white space-y-3">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Cari keterangan, tanggal (DD/MM), nominal..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-pink-50/40 border border-pink-200/80 rounded-xl text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-400 transition-all"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Filters & Actions */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Category Filter */}
            <select
              value={selectedCategory}
              onChange={e => setSelectedCategory(e.target.value)}
              className="px-3 py-2 bg-white border border-pink-200 rounded-xl text-xs font-medium text-slate-700 focus:outline-none focus:border-rose-400"
            >
              <option value="ALL">Semua Kategori ({transactions.length})</option>
              {CATEGORIES.map(cat => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>

            {/* Type Filter */}
            <select
              value={selectedType}
              onChange={e => setSelectedType(e.target.value as any)}
              className="px-3 py-2 bg-white border border-pink-200 rounded-xl text-xs font-medium text-slate-700 focus:outline-none focus:border-rose-400"
            >
              <option value="ALL">Semua Tipe (DB & CR)</option>
              <option value="CR">Kredit (CR) - Masuk</option>
              <option value="DB">Debit (DB) - Keluar</option>
            </select>

            {/* Add Row Button */}
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-rose-600 bg-pink-50 hover:bg-pink-100 rounded-xl border border-pink-200 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Tambah Baris</span>
            </button>

            {/* Export Buttons */}
            <button
              onClick={onExportExcel}
              className="flex items-center gap-1 px-3 py-2 text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 rounded-xl border border-emerald-200 transition-colors"
              title="Download Excel Spreadsheet"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              <span className="hidden sm:inline">Export Excel</span>
            </button>
          </div>
        </div>

        {/* Status result summary */}
        <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
          <span>
            Menampilkan <strong className="text-slate-800">{filtered.length}</strong> dari {transactions.length} mutasi transaksi
          </span>
          {(searchTerm || selectedCategory !== 'ALL' || selectedType !== 'ALL') && (
            <button
              onClick={() => {
                setSearchTerm('');
                setSelectedCategory('ALL');
                setSelectedType('ALL');
              }}
              className="text-rose-600 hover:text-rose-700 font-medium"
            >
              Reset Semua Filter
            </button>
          )}
        </div>
      </div>

      {/* Main Table */}
      <div className="overflow-x-auto scrollbar-thin">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-pink-50/70 border-b border-pink-100 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
              <th className="py-3 px-3 w-12 text-center">No</th>
              <th className="py-3 px-3 w-28">
                <div>tanggal</div>
                <div className="text-[9px] text-slate-400 font-normal lowercase">DD/MM/YYYY</div>
              </th>
              <th className="py-3 px-4 min-w-[280px]">
                <div>keterangan</div>
                <div className="text-[9px] text-slate-400 font-normal lowercase">BIF code + nama lengkap</div>
              </th>
              <th className="py-3 px-2 w-20 text-center">
                <div>cabang</div>
                <div className="text-[9px] text-slate-400 font-normal lowercase">kode cabang</div>
              </th>
              <th className="py-3 px-3 min-w-[170px]">kategori</th>
              <th className="py-3 px-2 w-16 text-center">tipe</th>
              <th className="py-3 px-3 text-right min-w-[125px]">
                <div className="text-emerald-700">debet</div>
                <div className="text-[9px] text-emerald-600/70 font-normal lowercase">mutasi CR</div>
              </th>
              <th className="py-3 px-3 text-right min-w-[125px]">
                <div className="text-rose-700">kredit</div>
                <div className="text-[9px] text-rose-600/70 font-normal lowercase">mutasi DB</div>
              </th>
              <th className="py-3 px-3 text-right min-w-[135px]">
                <div>saldo_akhir</div>
                <div className="text-[9px] text-slate-400 font-normal lowercase">running balance</div>
              </th>
              <th className="py-3 px-2 w-16 text-center">aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-pink-50/80 text-xs text-slate-700">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={10} className="py-12 text-center text-slate-400">
                  <AlertCircle className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                  Tidak ada transaksi yang sesuai dengan filter pencarian.
                </td>
              </tr>
            ) : (
              filtered.map((t, idx) => {
                const isEditing = editingId === t.id;
                const badge = getCategoryBadgeColor(t.kategori);

                if (isEditing) {
                  return (
                    <tr key={t.id} className="bg-amber-50/50">
                      <td className="py-2.5 px-3 text-center text-slate-400 font-mono">
                        {idx + 1}
                      </td>
                      <td className="py-2.5 px-3">
                        <input
                          type="text"
                          value={editForm.tanggal || ''}
                          onChange={e => setEditForm({ ...editForm, tanggal: e.target.value })}
                          placeholder="DD/MM/YYYY"
                          className="w-24 px-1.5 py-1 text-xs border border-amber-300 rounded bg-white font-mono"
                        />
                      </td>
                      <td className="py-2.5 px-4">
                        <textarea
                          rows={2}
                          value={editForm.keterangan || ''}
                          onChange={e => setEditForm({ ...editForm, keterangan: e.target.value })}
                          className="w-full px-2 py-1 text-xs border border-amber-300 rounded bg-white"
                        />
                      </td>
                      <td className="py-2.5 px-2">
                        <input
                          type="text"
                          value={editForm.cabang || ''}
                          onChange={e => setEditForm({ ...editForm, cabang: e.target.value })}
                          placeholder="Cabang"
                          className="w-16 px-1.5 py-1 text-xs text-center border border-amber-300 rounded bg-white font-mono"
                        />
                      </td>
                      <td className="py-2.5 px-3">
                        <select
                          value={editForm.kategori || t.kategori}
                          onChange={e => setEditForm({ ...editForm, kategori: e.target.value })}
                          className="w-full px-2 py-1 text-xs border border-amber-300 rounded bg-white"
                        >
                          {CATEGORIES.map(cat => (
                            <option key={cat} value={cat}>
                              {cat}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="py-2.5 px-2 text-center">
                        <select
                          value={editForm.tipe || t.tipe}
                          onChange={e => setEditForm({ ...editForm, tipe: e.target.value as any })}
                          className="px-1 py-1 text-xs border border-amber-300 rounded bg-white font-bold"
                        >
                          <option value="CR">CR</option>
                          <option value="DB">DB</option>
                        </select>
                      </td>
                      <td className="py-2.5 px-3 text-right" colSpan={2}>
                        <div className="flex items-center justify-end gap-1">
                          <span className="text-[10px] text-slate-400">Nominal:</span>
                          <input
                            type="number"
                            value={editForm.mutasi ?? t.mutasi}
                            onChange={e => setEditForm({ ...editForm, mutasi: parseFloat(e.target.value) || 0 })}
                            className="w-28 px-1.5 py-1 text-xs text-right border border-amber-300 rounded bg-white font-mono"
                          />
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-500">
                        {formatNumber(t.saldo_akhir ?? t.saldo)}
                      </td>
                      <td className="py-2.5 px-2 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => saveEdit(t.id)}
                            className="p-1 rounded bg-emerald-500 text-white hover:bg-emerald-600 shadow-2xs"
                            title="Simpan"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={cancelEdit}
                            className="p-1 rounded bg-slate-300 text-slate-700 hover:bg-slate-400"
                            title="Batal"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                }

                return (
                  <tr
                    key={t.id}
                    className="hover:bg-pink-50/40 transition-colors group"
                  >
                    {/* Index */}
                    <td className="py-3 px-3 text-center text-slate-400 font-mono text-[11px]">
                      {idx + 1}
                    </td>

                    {/* Tanggal - format DD/MM/YYYY */}
                    <td className="py-3 px-3 font-mono font-medium text-slate-800 whitespace-nowrap">
                      {t.tanggal}
                    </td>

                    {/* Keterangan - BIF code + nama lengkap */}
                    <td className="py-3 px-4 text-slate-800 font-normal leading-relaxed">
                      <div className="max-w-[380px] break-words">
                        {t.keterangan}
                        {t.isCustomEdited && (
                          <span className="ml-1.5 text-[10px] px-1 py-0.2 bg-amber-100 text-amber-800 rounded">
                            diedit
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Cabang - kode cabang (kosong jika tidak ada di koran) */}
                    <td className="py-3 px-2 text-center whitespace-nowrap">
                      {t.cabang ? (
                        <span className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                          {t.cabang}
                        </span>
                      ) : (
                        <span className="text-slate-300">-</span>
                      )}
                    </td>

                    {/* Kategori Badge & Quick Select */}
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold border ${badge.bg} ${badge.text} ${badge.border}`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${badge.dot}`} />
                          <span className="truncate max-w-[180px]">{t.kategori}</span>
                        </span>
                      </div>
                    </td>

                    {/* Tipe Badge */}
                    <td className="py-3 px-2 text-center">
                      <span
                        className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-extrabold font-mono ${
                          t.tipe === 'CR'
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                            : 'bg-rose-100 text-rose-800 border border-rose-300'
                        }`}
                      >
                        {t.tipe}
                      </span>
                    </td>

                    {/* Debet - numerik, terisi jika mutasi CR (CR masuk debet) */}
                    <td className="py-3 px-3 text-right font-mono font-semibold text-emerald-600 whitespace-nowrap">
                      {(t.debet > 0 || (t.tipe === 'CR' && t.mutasi > 0)) ? (
                        formatNumber(t.debet || t.mutasi)
                      ) : (
                        <span className="text-slate-300">-</span>
                      )}
                    </td>

                    {/* Kredit - numerik, terisi jika mutasi DB (DB masuk kredit) */}
                    <td className="py-3 px-3 text-right font-mono font-semibold text-rose-600 whitespace-nowrap">
                      {(t.kredit > 0 || (t.tipe === 'DB' && t.mutasi > 0)) ? (
                        formatNumber(t.kredit || t.mutasi)
                      ) : (
                        <span className="text-slate-300">-</span>
                      )}
                    </td>

                    {/* Saldo Akhir - numerik running balance, bisa dijumlahkan */}
                    <td className="py-3 px-3 text-right font-mono font-bold text-slate-900 whitespace-nowrap">
                      {formatNumber(t.saldo_akhir ?? t.saldo)}
                    </td>

                    {/* Aksi */}
                    <td className="py-3 px-2 text-center">
                      <div className="flex items-center justify-center gap-1 opacity-40 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => startEdit(t)}
                          className="p-1 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors"
                          title="Edit baris"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => onDeleteTransaction(t.id)}
                          className="p-1 text-slate-400 hover:text-rose-700 hover:bg-rose-50 rounded transition-colors"
                          title="Hapus baris"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
          {filtered.length > 0 && (
            <tfoot className="bg-pink-50/80 border-t-2 border-pink-200 text-xs font-bold text-slate-800">
              <tr>
                <td colSpan={6} className="py-3 px-4 text-slate-600 uppercase text-[11px] tracking-wide">
                  <div className="flex items-center justify-between">
                    <span>TOTAL & SALDO AKHIR MUTASI ({filtered.length} Transaksi)</span>
                    <span className="text-[10px] text-slate-400 font-normal hidden md:inline">
                      * Sesuai instruksi: CR masuk Debet, DB masuk Kredit, Saldo Akhir Running Balance
                    </span>
                  </div>
                </td>
                <td className="py-3 px-3 text-right font-mono font-bold text-emerald-700 whitespace-nowrap">
                  {formatNumber(totalDebet)}
                </td>
                <td className="py-3 px-3 text-right font-mono font-bold text-rose-700 whitespace-nowrap">
                  {formatNumber(totalKredit)}
                </td>
                <td className="py-3 px-3 text-right font-mono font-extrabold text-slate-900 whitespace-nowrap">
                  {formatNumber(lastSaldoAkhir)}
                </td>
                <td></td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* Add Transaction Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 border border-pink-100 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-pink-100 pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Plus className="w-5 h-5 text-rose-500" />
                Tambah Baris Mutasi Manual
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddSubmit} className="space-y-4 text-xs">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">
                    Tanggal (DD/MM/YYYY)
                  </label>
                  <input
                    type="text"
                    required
                    value={newTanggal}
                    onChange={e => setNewTanggal(e.target.value)}
                    placeholder="01/05/2026"
                    className="w-full px-3 py-2 border border-pink-200 rounded-xl font-mono focus:border-rose-400 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">
                    Cabang (Kode Cabang)
                  </label>
                  <input
                    type="text"
                    value={newCabang}
                    onChange={e => setNewCabang(e.target.value)}
                    placeholder="Opsional (kosongkan)"
                    className="w-full px-3 py-2 border border-pink-200 rounded-xl font-mono focus:border-rose-400 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">
                    Tipe Mutasi
                  </label>
                  <select
                    value={newTipe}
                    onChange={e => setNewTipe(e.target.value as 'DB' | 'CR')}
                    className="w-full px-3 py-2 border border-pink-200 rounded-xl font-bold focus:border-rose-400 focus:outline-none"
                  >
                    <option value="CR">CR (Masuk ke Debet)</option>
                    <option value="DB">DB (Masuk ke Kredit)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-600 font-semibold mb-1">
                  Keterangan (BIF Code + Nama Lengkap)
                </label>
                <textarea
                  required
                  rows={2}
                  value={newKeterangan}
                  onChange={e => setNewKeterangan(e.target.value)}
                  placeholder="Contoh: BIF CR 0123 / FALLENTY SETIA AMBARWATI"
                  className="w-full px-3 py-2 border border-pink-200 rounded-xl focus:border-rose-400 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">
                    Nominal Mutasi (Rp)
                  </label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={newMutasi || ''}
                    onChange={e => setNewMutasi(parseFloat(e.target.value) || 0)}
                    placeholder="4500000"
                    className="w-full px-3 py-2 border border-pink-200 rounded-xl font-mono focus:border-rose-400 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">
                    Kategori Pembukuan
                  </label>
                  <select
                    value={newKategori}
                    onChange={e => setNewKategori(e.target.value)}
                    className="w-full px-3 py-2 border border-pink-200 rounded-xl focus:border-rose-400 focus:outline-none"
                  >
                    {CATEGORIES.map(cat => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-pink-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-medium"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-rose-500 hover:bg-rose-600 text-white font-semibold rounded-xl shadow-xs"
                >
                  Tambahkan ke Tabel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
