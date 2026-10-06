import React, { useState } from 'react';
import {
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Send,
  MessageSquare,
  Bot,
  User,
  ShieldCheck,
  RefreshCw,
  Sliders,
  HelpCircle,
} from 'lucide-react';
import { Transaction, AccountInfo, AiAuditResult } from '../types';
import { formatRupiah, getCategoryBadgeColor } from '../utils/categorizer';

interface AiAuditModalProps {
  transactions: Transaction[];
  accountInfo: AccountInfo;
  rawLines: string[];
  onApplyCategorySuggestion: (index: number, newCategory: string) => void;
  onApplyDescriptionCorrection: (index: number, newDesc: string) => void;
  onLogActivity: (type: any, severity: any, message: string, meta?: any) => void;
}

export const AiAuditModal: React.FC<AiAuditModalProps> = ({
  transactions,
  accountInfo,
  rawLines,
  onApplyCategorySuggestion,
  onApplyDescriptionCorrection,
  onLogActivity,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [auditResult, setAuditResult] = useState<AiAuditResult | null>(null);
  const [appliedIndices, setAppliedIndices] = useState<Set<number>>(new Set());
  const [errorMsg, setErrorMsg] = useState('');

  // AI Chat state
  const [chatQuery, setChatQuery] = useState('');
  const [chatMessages, setChatMessages] = useState<Array<{ sender: 'user' | 'ai'; text: string }>>([
    {
      sender: 'ai',
      text: 'Halo! Saya asisten akuntansi cerdas AMBAR AKUNTAN yang ditenagai Gemini AI. Anda bisa bertanya apa saja tentang pembukuan rekening koran ini, misalnya: "Berapa total yang sudah dibayar ke supplier bulan ini?", "Siapa saja karyawan yang menerima gaji?", atau "Apakah mutasi saldo sudah seimbang?".',
    },
  ]);
  const [isChatLoading, setIsChatLoading] = useState(false);

  const runAiAudit = async () => {
    setIsLoading(true);
    setErrorMsg('');

    try {
      const response = await fetch('/api/ai-precision-audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transactions,
          rawLines: rawLines.slice(0, 50),
          saldoAwal: accountInfo.saldoAwal,
          accountInfo,
        }),
      });

      const json = await response.json();
      if (!response.ok || !json.success) {
        throw new Error(json.error || 'Gagal menjalankan audit presisi AI.');
      }

      setAuditResult(json.data);
      onLogActivity('AI_AUDIT', 'SUCCESS', `Audit Presisi AI selesai: Skor ${json.data.auditScore}/100`, {
        score: json.data.auditScore,
        reconciled: json.data.isBalanceReconciled,
      });
    } catch (err: any) {
      console.error('AI audit error:', err);
      setErrorMsg(err.message || 'Gagal menghubungi service AI Gemini.');
      onLogActivity('AI_AUDIT', 'WARN', `Gagal audit AI: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleApplySingle = (suggestion: { index: number; recommendedCategory: string }) => {
    onApplyCategorySuggestion(suggestion.index, suggestion.recommendedCategory);
    setAppliedIndices(prev => new Set([...prev, suggestion.index]));
  };

  const handleApplyAll = () => {
    if (!auditResult?.categorySuggestions) return;
    for (const sug of auditResult.categorySuggestions) {
      onApplyCategorySuggestion(sug.index, sug.recommendedCategory);
    }
    const all = new Set(auditResult.categorySuggestions.map(s => s.index));
    setAppliedIndices(all);
    onLogActivity('AI_AUDIT', 'SUCCESS', `Menerapkan semua saran kategori AI (${auditResult.categorySuggestions.length} transaksi)`);
  };

  const handleSendChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatQuery.trim() || isChatLoading) return;

    const userText = chatQuery.trim();
    setChatMessages(prev => [...prev, { sender: 'user', text: userText }]);
    setChatQuery('');
    setIsChatLoading(true);

    try {
      const summaryData = {
        bank: accountInfo.bankName,
        noRekening: accountInfo.noRekening,
        totalTransaksi: transactions.length,
        saldoAwal: accountInfo.saldoAwal,
        saldoAkhir: accountInfo.saldoAkhir,
        totalDebit: accountInfo.totalMutasiDB,
        totalKredit: accountInfo.totalMutasiCR,
        kategoriBreakdown: transactions.reduce((acc: any, t) => {
          acc[t.kategori] = (acc[t.kategori] || 0) + t.mutasi;
          return acc;
        }, {}),
        sampleSample: transactions.slice(0, 20).map(t => ({
          tgl: t.tanggal,
          ket: t.keterangan,
          tipe: t.tipe,
          mutasi: t.mutasi,
          kat: t.kategori,
        })),
      };

      const res = await fetch('/api/ai-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: userText, summaryData }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Gagal mendapatkan tanggapan.');
      }

      setChatMessages(prev => [...prev, { sender: 'ai', text: json.answer }]);
    } catch (err: any) {
      setChatMessages(prev => [
        ...prev,
        {
          sender: 'ai',
          text: `Mohon maaf, terjadi kendala saat menganalisis: ${err.message}`,
        },
      ]);
    } finally {
      setIsChatLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-pink-50 via-rose-50/50 to-pink-100/60 rounded-3xl p-6 sm:p-8 border border-pink-200/80 shadow-xs relative overflow-hidden">
        <div className="max-w-2xl space-y-3 relative z-10">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-500 text-white shadow-2xs">
            <Sparkles className="w-3.5 h-3.5" />
            <span>AI Precision Table Engine • Gemini 3.8</span>
          </div>

          <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            Audit Rekonsiliasi & Presisi Tabel e-Statement
          </h2>

          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            Data tabel rekening koran yang kompleks seringkali mengalami baris terpotong, angka saldo terlewat, atau salah kategori. AI Engine memeriksa konsistensi running balance dan akurasi pengkategorian akuntansi secara otomatis.
          </p>

          <div className="pt-2 flex items-center gap-3 flex-wrap">
            <button
              onClick={runAiAudit}
              disabled={isLoading || transactions.length === 0}
              className="px-5 py-2.5 rounded-xl bg-rose-500 hover:bg-rose-600 text-white text-xs sm:text-sm font-bold shadow-md shadow-rose-200 transition-all flex items-center gap-2 active:scale-98 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              <span>{isLoading ? 'Menganalisis Tabel...' : 'Mulai Audit Presisi AI'}</span>
            </button>
            <span className="text-xs text-slate-500">
              {transactions.length} mutasi siap diverifikasi
            </span>
          </div>
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Audit Findings Result */}
      {auditResult && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Card 1: Score & Verification */}
          <div className="bg-white rounded-2xl p-5 border border-pink-100 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">Skor Presisi Tabel</h3>
              <span className="text-2xl font-black text-rose-600 font-mono-numbers">
                {auditResult.auditScore}%
              </span>
            </div>

            <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
              <div
                className="bg-gradient-to-r from-rose-500 to-emerald-500 h-full rounded-full transition-all duration-500"
                style={{ width: `${auditResult.auditScore}%` }}
              />
            </div>

            <div className="p-3 rounded-xl bg-pink-50/60 border border-pink-100 space-y-2 text-xs">
              <div className="flex items-center gap-2 text-slate-800 font-semibold">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>
                  Rekonsiliasi Matematika:{' '}
                  {auditResult.isBalanceReconciled ? (
                    <strong className="text-emerald-700 font-bold">LULUS (Konsisten)</strong>
                  ) : (
                    <strong className="text-amber-700 font-bold">Perlu Perhatian</strong>
                  )}
                </span>
              </div>
              <p className="text-slate-600 text-[11px] leading-relaxed">
                {auditResult.summaryNotes}
              </p>
            </div>

            {/* Financial Insights */}
            <div className="space-y-2 pt-2 border-t border-pink-50">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Catatan Akuntansi AI:
              </span>
              <ul className="space-y-1.5 text-xs text-slate-600">
                {auditResult.financialInsights.map((insight, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500 mt-1.5 shrink-0" />
                    <span>{insight}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Card 2: Category Suggestions & Corrections (2 cols) */}
          <div className="lg:col-span-2 bg-white rounded-2xl p-5 border border-pink-100 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-rose-500" />
                  Rekomendasi Presisi Kategori & Tabel ({auditResult.categorySuggestions?.length || 0})
                </h3>
                <p className="text-xs text-slate-500">
                  Koreksi cerdas berdasarkan standar rekening koran dan entitas bisnis
                </p>
              </div>

              {auditResult.categorySuggestions && auditResult.categorySuggestions.length > 0 && (
                <button
                  onClick={handleApplyAll}
                  className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-semibold rounded-xl shadow-2xs transition-colors"
                >
                  Terapkan Semua
                </button>
              )}
            </div>

            {auditResult.categorySuggestions && auditResult.categorySuggestions.length > 0 ? (
              <div className="space-y-2.5 max-h-[360px] overflow-y-auto pr-1 scrollbar-thin">
                {auditResult.categorySuggestions.map((sug, i) => {
                  const tx = transactions[sug.index];
                  const isApplied = appliedIndices.has(sug.index);
                  if (!tx) return null;

                  return (
                    <div
                      key={i}
                      className="p-3 rounded-xl border border-pink-100 bg-pink-50/20 hover:bg-pink-50/40 transition-colors flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs"
                    >
                      <div className="space-y-1 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded">
                            {tx.tanggal}
                          </span>
                          <span className="font-mono text-slate-500">
                            {formatRupiah(tx.mutasi)} ({tx.tipe})
                          </span>
                        </div>
                        <p className="text-slate-800 font-medium line-clamp-1">
                          {tx.keterangan}
                        </p>
                        <div className="flex items-center gap-2 text-[11px] text-slate-500">
                          <span className="line-through text-slate-400">{tx.kategori}</span>
                          <ArrowRight className="w-3 h-3 text-rose-500" />
                          <span className="font-bold text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200">
                            {sug.recommendedCategory}
                          </span>
                          <span className="text-slate-400 italic">({sug.reason})</span>
                        </div>
                      </div>

                      <button
                        onClick={() => handleApplySingle(sug)}
                        disabled={isApplied}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold shrink-0 transition-colors ${
                          isApplied
                            ? 'bg-slate-100 text-slate-400 cursor-default'
                            : 'bg-rose-500 hover:bg-rose-600 text-white shadow-2xs'
                        }`}
                      >
                        {isApplied ? 'Diterapkan' : 'Terapkan'}
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-8 text-center text-slate-400 space-y-2">
                <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
                <p className="text-xs font-medium text-slate-700">
                  Seluruh kategori dan struktur tabel sudah presisi dan optimal!
                </p>
                <p className="text-[11px] text-slate-400">
                  Tidak ditemukan anomali atau kesalahan pengkategorian mayor.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* AI Q&A Assistant Section */}
      <div className="bg-white rounded-2xl p-5 sm:p-6 border border-pink-100 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-pink-50 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
              <Bot className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Tanya Jawab Finansial Cerdas (AI Q&A)
              </h3>
              <p className="text-xs text-slate-500">
                Ajukan pertanyaan analisis terkait mutasi, omzet, supplier, atau gaji
              </p>
            </div>
          </div>
        </div>

        {/* Chat message history */}
        <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1 scrollbar-thin">
          {chatMessages.map((msg, i) => (
            <div
              key={i}
              className={`flex gap-2.5 text-xs ${
                msg.sender === 'user' ? 'justify-end' : 'justify-start'
              }`}
            >
              {msg.sender === 'ai' && (
                <div className="w-6 h-6 rounded-full bg-rose-500 text-white flex items-center justify-center shrink-0 mt-0.5">
                  <Bot className="w-3.5 h-3.5" />
                </div>
              )}
              <div
                className={`max-w-lg p-3 rounded-2xl leading-relaxed ${
                  msg.sender === 'user'
                    ? 'bg-rose-500 text-white rounded-tr-none'
                    : 'bg-pink-50/60 border border-pink-100 text-slate-800 rounded-tl-none'
                }`}
              >
                {msg.text}
              </div>
              {msg.sender === 'user' && (
                <div className="w-6 h-6 rounded-full bg-slate-800 text-white flex items-center justify-center shrink-0 mt-0.5">
                  <User className="w-3.5 h-3.5" />
                </div>
              )}
            </div>
          ))}

          {isChatLoading && (
            <div className="flex gap-2.5 text-xs">
              <div className="w-6 h-6 rounded-full bg-rose-500 text-white flex items-center justify-center shrink-0">
                <Bot className="w-3.5 h-3.5" />
              </div>
              <div className="p-3 rounded-2xl bg-pink-50/60 border border-pink-100 text-slate-500 flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-rose-400 animate-bounce" />
                <div className="w-2 h-2 rounded-full bg-rose-400 animate-bounce delay-100" />
                <div className="w-2 h-2 rounded-full bg-rose-400 animate-bounce delay-200" />
                <span className="ml-1 text-[11px]">Sedang menghitung data perbankan...</span>
              </div>
            </div>
          )}
        </div>

        {/* Input box */}
        <form onSubmit={handleSendChat} className="flex gap-2 pt-2">
          <input
            type="text"
            value={chatQuery}
            onChange={e => setChatQuery(e.target.value)}
            placeholder="Tanyakan sesuatu... (cth: Berapa total yang dibayarkan ke supplier Emma dan Penta?)"
            className="flex-1 px-4 py-2.5 bg-pink-50/30 border border-pink-200 rounded-xl text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-400"
          />
          <button
            type="submit"
            disabled={!chatQuery.trim() || isChatLoading}
            className="px-4 py-2.5 bg-rose-500 hover:bg-rose-600 text-white rounded-xl font-semibold shadow-xs disabled:opacity-50 transition-colors flex items-center gap-1.5"
          >
            <Send className="w-4 h-4" />
            <span className="hidden sm:inline text-xs">Kirim</span>
          </button>
        </form>
      </div>
    </div>
  );
};
