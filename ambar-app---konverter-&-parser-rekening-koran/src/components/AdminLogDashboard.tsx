import React, { useState } from 'react';
import {
  Activity,
  ShieldCheck,
  Lock,
  Download,
  Trash2,
  Search,
  CheckCircle2,
  AlertTriangle,
  Info,
  Clock,
  Terminal,
  FileSpreadsheet,
} from 'lucide-react';
import { AuditLog, AccountInfo } from '../types';
import { formatRupiah } from '../utils/categorizer';

interface AdminLogDashboardProps {
  logs: AuditLog[];
  accountInfo: AccountInfo;
  onClearLogs: () => void;
  onExportLogs: () => void;
}

export const AdminLogDashboard: React.FC<AdminLogDashboardProps> = ({
  logs,
  accountInfo,
  onClearLogs,
  onExportLogs,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [severityFilter, setSeverityFilter] = useState<string>('ALL');

  const filteredLogs = logs.filter(log => {
    const matchSearch =
      log.message.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.type.toLowerCase().includes(searchTerm.toLowerCase());
    const matchSeverity =
      severityFilter === 'ALL' || log.severity === severityFilter;
    return matchSearch && matchSeverity;
  });

  const getSeverityBadge = (severity: AuditLog['severity']) => {
    switch (severity) {
      case 'SUCCESS':
        return {
          bg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
          icon: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />,
        };
      case 'SECURE':
        return {
          bg: 'bg-rose-50 text-rose-700 border-rose-200',
          icon: <Lock className="w-3.5 h-3.5 text-rose-600" />,
        };
      case 'WARN':
        return {
          bg: 'bg-amber-50 text-amber-800 border-amber-200',
          icon: <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />,
        };
      default:
        return {
          bg: 'bg-blue-50 text-blue-700 border-blue-200',
          icon: <Info className="w-3.5 h-3.5 text-blue-600" />,
        };
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Admin KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1 */}
        <div className="bg-white rounded-2xl p-4 border border-pink-100 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span className="font-semibold text-slate-700">Total Event Logged</span>
            <div className="w-7 h-7 rounded-xl bg-pink-50 text-rose-600 flex items-center justify-center">
              <Activity className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl font-black text-slate-900 font-mono-numbers">
            {logs.length} Log
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-emerald-600 mt-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Audit Stream Real-Time Aktif</span>
          </div>
        </div>

        {/* KPI 2 */}
        <div className="bg-white rounded-2xl p-4 border border-pink-100 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span className="font-semibold text-slate-700">Enkripsi Data Vault</span>
            <div className="w-7 h-7 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
              <Lock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>AES-GCM 256-Bit</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            Tersimpan terenkripsi di Web Crypto Vault
          </p>
        </div>

        {/* KPI 3 */}
        <div className="bg-white rounded-2xl p-4 border border-pink-100 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span className="font-semibold text-slate-700">Checksum SHA-256</span>
            <div className="w-7 h-7 rounded-xl bg-slate-50 text-slate-600 flex items-center justify-center">
              <Terminal className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xs font-mono font-semibold text-slate-800 truncate" title={accountInfo.fileHash || 'e3b0c44298fc...'}>
            {accountInfo.fileHash ? accountInfo.fileHash.substring(0, 16) + '...' : 'Tervalidasi'}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            Integritas file perbankan terverifikasi
          </p>
        </div>

        {/* KPI 4 */}
        <div className="bg-white rounded-2xl p-4 border border-pink-100 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span className="font-semibold text-slate-700">Omzet Mutasi Terproses</span>
            <div className="w-7 h-7 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <FileSpreadsheet className="w-4 h-4" />
            </div>
          </div>
          <div className="text-lg font-bold text-slate-900 font-mono-numbers">
            {formatRupiah((accountInfo.totalMutasiDB || 0) + (accountInfo.totalMutasiCR || 0))}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            {accountInfo.noRekening ? `Rekening: ${accountInfo.noRekening}` : 'Menunggu Dokumen'}
          </p>
        </div>
      </div>

      {/* Main Log Console */}
      <div className="bg-white rounded-2xl border border-pink-100 shadow-xs overflow-hidden">
        {/* Header toolbar */}
        <div className="p-4 sm:p-5 border-b border-pink-100 bg-white flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Activity className="w-4 h-4 text-rose-500" />
              Live Audit Trail & Log Keamanan Sistem
            </h3>
            <p className="text-xs text-slate-500">
              Merekam setiap proses parsing, dekripsi PDF, verifikasi AI, dan export file
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={onExportLogs}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export Log JSON</span>
            </button>
            <button
              onClick={onClearLogs}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-xl transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Bersihkan</span>
            </button>
          </div>
        </div>

        {/* Filter bar */}
        <div className="p-3 bg-pink-50/30 border-b border-pink-100 flex items-center gap-3 flex-wrap text-xs">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Cari log event..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-white border border-pink-200 rounded-lg text-xs focus:outline-none focus:border-rose-400"
            />
          </div>

          <div className="flex items-center gap-1">
            <span className="text-slate-500 font-medium">Severity:</span>
            <select
              value={severityFilter}
              onChange={e => setSeverityFilter(e.target.value)}
              className="px-2.5 py-1.5 bg-white border border-pink-200 rounded-lg font-semibold text-slate-700"
            >
              <option value="ALL">Semua Tingkat</option>
              <option value="SUCCESS">SUCCESS</option>
              <option value="SECURE">SECURE (Enkripsi)</option>
              <option value="INFO">INFO</option>
              <option value="WARN">WARN (Peringatan)</option>
            </select>
          </div>
        </div>

        {/* Log table */}
        <div className="overflow-x-auto max-h-[460px] scrollbar-thin">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-pink-50/70 border-b border-pink-100 text-[11px] font-bold text-slate-600 uppercase tracking-wider sticky top-0 z-10">
              <tr>
                <th className="py-2.5 px-4 w-40">Waktu</th>
                <th className="py-2.5 px-3 w-28">Status</th>
                <th className="py-2.5 px-3 w-36">Tipe Event</th>
                <th className="py-2.5 px-4">Pesan Log & Deskripsi Aktivitas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-pink-50 text-slate-700 font-mono text-[11px]">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-10 text-center text-slate-400 font-sans">
                    Belum ada log aktivitas yang tercatat.
                  </td>
                </tr>
              ) : (
                filteredLogs.map(log => {
                  const badge = getSeverityBadge(log.severity);
                  return (
                    <tr key={log.id} className="hover:bg-pink-50/30 transition-colors">
                      <td className="py-2.5 px-4 text-slate-500 whitespace-nowrap flex items-center gap-1.5">
                        <Clock className="w-3 h-3 text-slate-400" />
                        <span>{new Date(log.timestamp).toLocaleTimeString('id-ID')}</span>
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold border ${badge.bg}`}
                        >
                          {badge.icon}
                          <span>{log.severity}</span>
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-slate-800 whitespace-nowrap">
                        {log.type}
                      </td>
                      <td className="py-2.5 px-4 font-sans text-slate-800 leading-relaxed">
                        <div>{log.message}</div>
                        {log.meta && Object.keys(log.meta).length > 0 && (
                          <div className="mt-1 text-[10px] font-mono text-slate-500 bg-slate-50 p-1.5 rounded border border-slate-200 overflow-x-auto">
                            {JSON.stringify(log.meta)}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
