import React, { useState } from 'react';
import { ArrowLeft, Eye, EyeOff, Lock, ShieldCheck } from 'lucide-react';
import { loginAdmin } from '../utils/apiClient';
import { BrandMark } from './BrandMark';

interface AdminLoginProps {
  studioName: string;
  logoUrl?: string;
  onSuccess: () => void;
  onBackToPublic: () => void;
}

export const AdminLogin: React.FC<AdminLoginProps> = ({
  studioName,
  logoUrl,
  onSuccess,
  onBackToPublic,
}) => {
  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pin.trim()) {
      setError('Masukkan PIN atau password admin terlebih dahulu.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await loginAdmin(pin.trim());
      onSuccess();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Autentikasi gagal. Periksa kembali PIN Anda.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF7F2] text-[#2A201B] flex flex-col justify-center items-center px-4 py-10">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <div className="flex justify-center">
            <BrandMark studioName={studioName} logoUrl={logoUrl} size="lg" />
          </div>
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-[#8C6B30]">
            Portal Manajemen Internal Studio
          </p>
        </div>

        <div className="bg-white border border-[#E6DDD0] rounded-2xl p-6 sm:p-8 shadow-sm space-y-6">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-[#8C6B30]">
              <ShieldCheck className="w-5 h-5" />
              <h1 className="font-serif text-2xl font-semibold text-[#2A201B]">
                Login Admin Studio
              </h1>
            </div>
            <p className="text-xs text-[#5E534B]">
              Autentikasi divalidasi langsung oleh server backend sebelum membuka data pelanggan
              dan produksi.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="admin-pin-input"
                className="block text-xs font-medium uppercase tracking-wider text-[#5E534B] mb-1.5"
              >
                PIN / Password Admin
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-[#8C6B30] absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  id="admin-pin-input"
                  type={showPin ? 'text' : 'password'}
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  placeholder="Masukkan PIN Admin"
                  autoComplete="current-password"
                  className="w-full min-h-[46px] pl-10 pr-11 py-2.5 rounded-lg border border-[#E6DDD0] bg-[#FAF7F2] text-sm text-[#2A201B] focus:outline-none focus:border-[#8C6B30]"
                />
                <button
                  type="button"
                  onClick={() => setShowPin((v) => !v)}
                  aria-label={showPin ? 'Sembunyikan PIN' : 'Tampilkan PIN'}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded flex items-center justify-center text-[#5E534B] hover:text-[#2A201B] cursor-pointer"
                >
                  {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div
                role="alert"
                className="p-3 rounded-lg bg-[#FDF0F0] border border-[#9E2A2B]/30 text-xs font-medium text-[#9E2A2B]"
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full min-h-[46px] px-5 py-2.5 rounded-lg bg-[#2A201B] text-[#FAF7F2] text-sm font-medium hover:bg-[#3F312A] disabled:opacity-60 transition-colors cursor-pointer"
            >
              {loading ? 'Memverifikasi...' : 'Masuk ke Dashboard Admin'}
            </button>
          </form>

          <div className="pt-4 border-t border-[#E6DDD0] flex items-center justify-between text-xs text-[#75655A]">
            <button
              type="button"
              onClick={onBackToPublic}
              className="inline-flex items-center gap-1.5 text-[#8C6B30] hover:text-[#2A201B] font-medium cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Kembali ke Portal Customer</span>
            </button>
            <span>Akses Khusus Admin Studio</span>
          </div>
        </div>
      </div>
    </div>
  );
};
