import React, { useState } from 'react';
import {
  ShieldCheck,
  Lock,
  Key,
  Trash2,
  X,
  CheckCircle2,
  HardDrive,
  Cpu,
  RefreshCw,
} from 'lucide-react';
import { getOrCreateSessionPassphrase } from '../utils/security';

interface EncryptionVaultModalProps {
  isOpen: boolean;
  onClose: () => void;
  onClearMemory: () => void;
  onLogActivity: (type: any, severity: any, message: string, meta?: any) => void;
}

export const EncryptionVaultModal: React.FC<EncryptionVaultModalProps> = ({
  isOpen,
  onClose,
  onClearMemory,
  onLogActivity,
}) => {
  const [activeKey, setActiveKey] = useState<string>(getOrCreateSessionPassphrase());
  const [copySuccess, setCopySuccess] = useState(false);

  if (!isOpen) return null;

  const handleCopyKey = () => {
    navigator.clipboard.writeText(activeKey);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  };

  const handleRotateKey = () => {
    sessionStorage.removeItem('ambar_vault_session_key');
    const newKey = getOrCreateSessionPassphrase();
    setActiveKey(newKey);
    onLogActivity('VAULT_ENCRYPT', 'SECURE', 'Master Session Key berhasil dirotasi ke kunci baru');
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-7 border border-pink-100 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between border-b border-pink-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Keamanan Finansial & Enkripsi Data
              </h3>
              <p className="text-xs text-slate-500">
                Standar Enkripsi Perbankan (AES-GCM 256-Bit)
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Security pillars */}
        <div className="space-y-3">
          <div className="p-3.5 rounded-2xl bg-pink-50/50 border border-pink-100 flex items-start gap-3">
            <Cpu className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
            <div className="text-xs space-y-0.5">
              <h4 className="font-bold text-slate-900">
                Client-Side In-Memory Execution
              </h4>
              <p className="text-slate-600 leading-relaxed">
                File PDF rekening koran BCA diproses secara eksklusif dalam memori peramban (WebAssembly / JavaScript). Tidak ada pengunggahan dokumen mentah ke server eksternal.
              </p>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-emerald-50/50 border border-emerald-100 flex items-start gap-3">
            <Lock className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            <div className="text-xs space-y-0.5">
              <h4 className="font-bold text-slate-900">
                Enkripsi Sesi Penyimpanan (AES-GCM 256)
              </h4>
              <p className="text-slate-600 leading-relaxed">
                Seluruh data transaksi dan cache sesi lokal dienkripsi menggunakan Web Crypto API standar NIST perbankan sebelum disimpan di penyimpanan peramban.
              </p>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 flex items-start gap-3">
            <HardDrive className="w-5 h-5 text-slate-600 shrink-0 mt-0.5" />
            <div className="text-xs space-y-0.5">
              <h4 className="font-bold text-slate-900">
                Validasi Hash SHA-256
              </h4>
              <p className="text-slate-600 leading-relaxed">
                Setiap file e-Statement memiliki sidik jari kriptografi unik untuk audit trail dan mencegah manipulasi dokumen.
              </p>
            </div>
          </div>
        </div>

        {/* Master session key */}
        <div className="space-y-1.5 pt-1">
          <label className="text-xs font-semibold text-slate-700 flex items-center justify-between">
            <span>Kunci Master Sesi Aktif:</span>
            <button
              onClick={handleRotateKey}
              className="text-rose-600 hover:text-rose-700 text-[11px] font-medium flex items-center gap-1"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Rotasi Kunci</span>
            </button>
          </label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={activeKey}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-600 select-all"
            />
            <button
              onClick={handleCopyKey}
              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-medium shrink-0"
            >
              {copySuccess ? 'Tersalin' : 'Salin'}
            </button>
          </div>
        </div>

        {/* Actions */}
        <div className="pt-3 border-t border-pink-100 flex items-center justify-between">
          <button
            onClick={() => {
              if (confirm('Hapus seluruh memori sesi dan data transaksi yang tersimpan di browser?')) {
                onClearMemory();
                onClose();
              }
            }}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 rounded-xl transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Bersihkan Memori & Data Sesi</span>
          </button>

          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold rounded-xl"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
