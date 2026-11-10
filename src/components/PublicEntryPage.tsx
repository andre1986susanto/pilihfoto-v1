import React, { useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  BookOpen,
  Camera,
  CheckCircle2,
  KeyRound,
  LayoutDashboard,
  Sparkles,
} from 'lucide-react';
import heroImage from '../assets/images/luxury_wedding_hero_1793975924579.jpg';
import preweddingSample from '../assets/images/prewedding_editorial_sample_1793975925105.jpg';
import familySample from '../assets/images/family_portrait_sample_1793975924633.jpg';
import { BrandMark } from './BrandMark';
import { PanduanView } from './PanduanView';

interface PublicEntryPageProps {
  studioName: string;
  logoUrl?: string;
  notFoundCode?: string;
  onOpenCustomerCode: (code: string) => void;
  onOpenAdminLogin: () => void;
}

export const PublicEntryPage: React.FC<PublicEntryPageProps> = ({
  studioName,
  logoUrl,
  notFoundCode,
  onOpenCustomerCode,
  onOpenAdminLogin,
}) => {
  const [codeInput, setCodeInput] = useState(notFoundCode || '');
  const [inputError, setInputError] = useState('');
  const [activeSection, setActiveSection] = useState<'portal' | 'panduan'>('portal');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = codeInput.trim().toUpperCase();
    if (!cleaned) {
      setInputError('Silakan masukkan kode unik customer Anda (contoh: LB-W3JL2).');
      return;
    }
    setInputError('');
    onOpenCustomerCode(cleaned);
  };

  return (
    <div className="min-h-screen bg-[#FAF7F2] text-[#2A201B] flex flex-col">
      {/* Strict 3-Zone Top Bar Contract */}
      <header className="sticky top-0 z-30 bg-[#FAF7F2]/95 backdrop-blur-xs border-b border-[#E6DDD0]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-8">
          <a
            href="/"
            onClick={(e) => {
              e.preventDefault();
              setActiveSection('portal');
              if (notFoundCode) {
                window.history.pushState({}, '', '/');
                window.dispatchEvent(new PopStateEvent('popstate'));
              }
            }}
            className="whitespace-nowrap shrink-0"
          >
            <BrandMark studioName={studioName} logoUrl={logoUrl} size="sm" />
          </a>

          <nav
            aria-label="Navigasi utama"
            className="hidden md:flex items-center gap-7 text-sm font-medium text-[#4A3B32]"
          >
            <button
              type="button"
              onClick={() => setActiveSection('portal')}
              className={`hover:text-[#8C6B30] transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeSection === 'portal' ? 'text-[#8C6B30] underline underline-offset-8' : ''
              }`}
            >
              Beranda
            </button>
            <button
              type="button"
              onClick={() => setActiveSection('panduan')}
              className={`hover:text-[#8C6B30] transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeSection === 'panduan' ? 'text-[#8C6B30] underline underline-offset-8' : ''
              }`}
            >
              Panduan
            </button>
            <a
              href="#cek-kode-portal"
              onClick={() => setActiveSection('portal')}
              className="hover:text-[#8C6B30] transition-colors whitespace-nowrap shrink-0"
            >
              Cek Kode
            </a>
            <button
              type="button"
              onClick={onOpenAdminLogin}
              className="hover:text-[#8C6B30] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Admin Studio
            </button>
          </nav>

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={onOpenAdminLogin}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#2A201B] text-[#FAF7F2] text-xs font-medium tracking-wide hover:bg-[#3F312A] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <LayoutDashboard className="w-3.5 h-3.5 text-[#E3C78D]" />
              <span>Admin Studio</span>
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* Link Tidak Ditemukan Banner when accessing an unregistered /c/CODE */}
        {notFoundCode && (
          <section className="max-w-3xl mx-auto px-4 sm:px-6 pt-8">
            <div className="bg-white border border-[#9E2A2B]/30 rounded-xl p-6 sm:p-8 space-y-3">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-6 h-6 text-[#9E2A2B] shrink-0 mt-0.5" />
                <div className="space-y-1.5">
                  <h1 className="font-serif text-2xl font-semibold text-[#2A201B]">
                    Link Customer Tidak Ditemukan
                  </h1>
                  <p className="text-sm text-[#4A3B32] leading-relaxed">
                    Maaf, kode unik <strong className="font-mono">{notFoundCode}</strong> tidak
                    terdaftar atau tautan pemilihan foto tidak valid. Pastikan Anda membuka tautan
                    resmi yang dikirimkan oleh tim marketing {studioName}.
                  </p>
                </div>
              </div>
            </div>
          </section>
        )}

        {activeSection === 'panduan' ? (
          <section className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
            <PanduanView />
          </section>
        ) : (
          <>
            {/* Split-Screen Editorial Hero */}
            <section
              id="cek-kode-portal"
              className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12"
            >
              <div className="bg-white border border-[#E6DDD0] rounded-2xl overflow-hidden grid grid-cols-1 lg:grid-cols-12 items-stretch">
                {/* Left Column: Customer Unique Code Entry */}
                <div className="lg:col-span-6 p-6 sm:p-10 lg:p-12 flex flex-col justify-center space-y-6">
                  <div className="space-y-3">
                    <p className="text-xs font-medium uppercase tracking-[0.2em] text-[#8C6B30]">
                      LOUIS BRIDES PILIH FOTO V1
                    </p>
                    <h1 className="font-serif text-3xl sm:text-4xl lg:text-[42px] font-semibold text-[#2A201B] leading-[1.15] text-balance">
                      Abadikan Setiap Momen, Pilih Kenangan Terbaik Anda
                    </h1>
                    <p className="text-sm sm:text-[15px] text-[#4A3B32] leading-relaxed max-w-xl">
                      Portal resmi pelanggan {studioName} Wedding &amp; Prewedding Photography
                      untuk memilih foto Album &amp; Kanvas, memberikan catatan editing, menandai
                      revisi, serta memantau progres produksi secara langsung.
                    </p>
                  </div>

                  {/* Customer Access Code Form */}
                  <form onSubmit={handleSubmit} className="space-y-3 pt-2">
                    <label
                      htmlFor="customer-code-input"
                      className="block text-xs font-medium uppercase tracking-wider text-[#5E534B]"
                    >
                      Masukkan Kode Unik Customer
                    </label>
                    <div className="flex flex-col sm:flex-row gap-3">
                      <div className="relative flex-1">
                        <KeyRound className="w-4 h-4 text-[#8C6B30] absolute left-3.5 top-1/2 -translate-y-1/2" />
                        <input
                          id="customer-code-input"
                          type="text"
                          value={codeInput}
                          onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
                          placeholder="Contoh: LB-W3JL2"
                          className="w-full min-h-[46px] pl-10 pr-4 py-2.5 rounded-lg border border-[#E6DDD0] bg-[#FAF7F2] font-mono text-sm uppercase tracking-wider text-[#2A201B] placeholder:text-[#75655A]/60 focus:outline-none focus:border-[#8C6B30]"
                        />
                      </div>
                      <button
                        type="submit"
                        className="min-h-[46px] px-6 py-2.5 rounded-lg bg-[#8C6B30] text-white text-sm font-medium inline-flex items-center justify-center gap-2 hover:bg-[#755824] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        <span>Buka Galeri Saya</span>
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    </div>
                    {inputError && (
                      <p className="text-xs font-medium text-[#9E2A2B]">{inputError}</p>
                    )}
                    <p className="text-xs text-[#75655A]">
                      Tidak perlu login akun Google. Gunakan kode unik atau tautan pribadi dari
                      WhatsApp marketing kami.
                    </p>
                  </form>

                  <div className="pt-3 border-t border-[#E6DDD0] flex flex-wrap items-center gap-4">
                    <button
                      type="button"
                      onClick={() => setActiveSection('panduan')}
                      className="inline-flex items-center gap-2 text-xs font-medium text-[#8C6B30] hover:text-[#2A201B] transition-colors cursor-pointer"
                    >
                      <BookOpen className="w-4 h-4" />
                      <span>Baca Panduan Pemilihan Foto &amp; Revisi</span>
                    </button>
                  </div>
                </div>

                {/* Right Column: Full-height editorial photography */}
                <div className="lg:col-span-6 min-h-[280px] sm:min-h-[360px] lg:min-h-[480px] relative bg-[#F3ECE1]">
                  <img
                    src={heroImage}
                    alt="LOUIS BRIDES Wedding Photography"
                    referrerPolicy="no-referrer"
                    className="w-full h-full lg:h-full object-cover"
                  />
                  <div className="absolute inset-x-0 bottom-0 p-6 bg-gradient-to-t from-[#1B1411]/80 via-[#1B1411]/35 to-transparent text-[#FAF7F2]">
                    <p className="font-serif italic text-lg">
                      Your Beautiful Moments, Our Timeless Memories.
                    </p>
                  </div>
                </div>
              </div>
            </section>

            {/* Full-Width 4-Column Workflow Strip Below Split Hero */}
            <section className="max-w-6xl mx-auto px-4 sm:px-6 pb-10">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white border border-[#E6DDD0] rounded-xl p-5 space-y-2">
                  <p className="font-mono text-xs text-[#8C6B30] font-semibold">01</p>
                  <h2 className="font-serif text-lg font-semibold text-[#2A201B]">
                    Pilih Foto Album &amp; Kanvas
                  </h2>
                  <p className="text-xs text-[#5E534B] leading-relaxed">
                    Pilih foto langsung dari galeri dengan penghitung kuota otomatis dan catatan
                    edit per foto.
                  </p>
                </div>

                <div className="bg-white border border-[#E6DDD0] rounded-xl p-5 space-y-2">
                  <p className="font-mono text-xs text-[#8C6B30] font-semibold">02</p>
                  <h2 className="font-serif text-lg font-semibold text-[#2A201B]">
                    Zoom Detail Resolusi Tinggi
                  </h2>
                  <p className="text-xs text-[#5E534B] leading-relaxed">
                    Perbesar foto hingga 300% untuk memeriksa ekspresi, pencahayaan, dan detail
                    sebelum memilih.
                  </p>
                </div>

                <div className="bg-white border border-[#E6DDD0] rounded-xl p-5 space-y-2">
                  <p className="font-mono text-xs text-[#8C6B30] font-semibold">03</p>
                  <h2 className="font-serif text-lg font-semibold text-[#2A201B]">
                    Tandai Bagian Revisi
                  </h2>
                  <p className="text-xs text-[#5E534B] leading-relaxed">
                    Lingkari area atau letakkan titik pin bernomor pada hasil editan agar editor
                    memahami arahan dengan tepat.
                  </p>
                </div>

                <div className="bg-white border border-[#E6DDD0] rounded-xl p-5 space-y-2">
                  <p className="font-mono text-xs text-[#8C6B30] font-semibold">04</p>
                  <h2 className="font-serif text-lg font-semibold text-[#2A201B]">
                    Pantau Progres &amp; Unduh ZIP
                  </h2>
                  <p className="text-xs text-[#5E534B] leading-relaxed">
                    Pantau tahapan pengerjaan Album dan Kanvas serta unduh seluruh foto dalam satu
                    file ZIP.
                  </p>
                </div>
              </div>
            </section>

            {/* Curated Service Showcase (Prewedding & Family) */}
            <section className="max-w-6xl mx-auto px-4 sm:px-6 pb-14">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white border border-[#E6DDD0] rounded-xl overflow-hidden flex flex-col">
                  <div className="aspect-4/3 bg-[#F3ECE1] overflow-hidden">
                    <img
                      src={preweddingSample}
                      alt="Layanan Wedding dan Prewedding LOUIS BRIDES"
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="p-6 space-y-2">
                    <div className="flex items-center gap-2 text-xs text-[#8C6B30]">
                      <Camera className="w-4 h-4" />
                      <span>PREWEDDING &amp; LIPUTAN WEDDING</span>
                    </div>
                    <h3 className="font-serif text-2xl font-semibold text-[#2A201B]">
                      Koleksi Pengantin &amp; Momen Sakral
                    </h3>
                    <p className="text-sm text-[#4A3B32] leading-relaxed">
                      Kurasi foto prewedding dan hari pernikahan Anda ke dalam album eksklusif dan
                      cetakan kanvas berkualitas museum.
                    </p>
                  </div>
                </div>

                <div className="bg-white border border-[#E6DDD0] rounded-xl overflow-hidden flex flex-col">
                  <div className="aspect-4/3 bg-[#F3ECE1] overflow-hidden">
                    <img
                      src={familySample}
                      alt="Layanan Potret Keluarga LOUIS BRIDES"
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="p-6 space-y-2">
                    <div className="flex items-center gap-2 text-xs text-[#8C6B30]">
                      <Sparkles className="w-4 h-4" />
                      <span>POTRET KELUARGA</span>
                    </div>
                    <h3 className="font-serif text-2xl font-semibold text-[#2A201B]">
                      Kenangan Hangat Lintas Generasi
                    </h3>
                    <p className="text-sm text-[#4A3B32] leading-relaxed">
                      Bagikan link unik kepada anggota keluarga untuk memilih foto favorit bersama
                      dengan mudah dari ponsel maupun komputer.
                    </p>
                  </div>
                </div>
              </div>
            </section>
          </>
        )}
      </main>

      {/* Quiet Editorial Footer */}
      <footer className="border-t border-[#E6DDD0] bg-[#F3ECE1]/60 py-6">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[#5E534B]">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-3.5 h-3.5 text-[#8C6B30]" />
            <span>{studioName} Photography Studio · Sistem Pemilihan Foto &amp; Produksi</span>
          </div>
          <div className="flex items-center gap-5">
            <button
              type="button"
              onClick={() => setActiveSection('panduan')}
              className="hover:text-[#2A201B] underline-offset-4 hover:underline cursor-pointer"
            >
              Panduan Pelanggan
            </button>
            <button
              type="button"
              onClick={onOpenAdminLogin}
              className="hover:text-[#2A201B] underline-offset-4 hover:underline cursor-pointer"
            >
              Portal Admin Studio
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
};
