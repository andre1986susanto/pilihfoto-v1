import React, { useEffect, useState } from 'react';
import { RefreshCw, RotateCcw, X } from 'lucide-react';
import type {
  CustomerRecord,
  MarketingMember,
  ProductionItemStatus,
  ServiceCategory,
  StudioSettings,
} from '../types/studio';
import {
  generateUniqueCustomerCode,
  PRODUCTION_STATUS_LIST,
  toInputDateFormat,
} from '../utils/studioLogic';

interface CustomerFormModalProps {
  isOpen: boolean;
  editingCustomer: CustomerRecord | null;
  defaultCategory?: ServiceCategory;
  existingCodes: Set<string>;
  marketingList: MarketingMember[];
  settings: StudioSettings;
  onSave: (payload: Partial<CustomerRecord>) => Promise<void>;
  onClose: () => void;
}

export const CustomerFormModal: React.FC<CustomerFormModalProps> = ({
  isOpen,
  editingCustomer,
  defaultCategory = 'PREWEDING',
  existingCodes,
  marketingList,
  settings,
  onSave,
  onClose,
}) => {
  const todayStr = new Date().toISOString().slice(0, 10);

  const [jenisLayanan, setJenisLayanan] = useState<ServiceCategory>(defaultCategory);
  const [namaCustomer, setNamaCustomer] = useState('');
  const [namaKeluarga, setNamaKeluarga] = useState('');
  const [paket, setPaket] = useState('');
  const [email, setEmail] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [namaMarketing, setNamaMarketing] = useState('');
  const [tanggalPendaftaran, setTanggalPendaftaran] = useState(todayStr);
  const [tanggalPemotretan, setTanggalPemotretan] = useState(todayStr);
  const [tanggalPemilihan, setTanggalPemilihan] = useState('');
  const [kuotaAlbum, setKuotaAlbum] = useState(settings.default_kuota_album);
  const [kuotaKanvas, setKuotaKanvas] = useState(settings.default_kuota_kanvas);
  const [ukuranKanvas, setUkuranKanvas] = useState(settings.default_ukuran_kanvas);
  const [kuotaTambahan, setKuotaTambahan] = useState(settings.default_kuota_tambahan);
  const [catatanCustomer, setCatatanCustomer] = useState('');
  const [driveFolderUrl, setDriveFolderUrl] = useState('');
  const [driveFolderId, setDriveFolderId] = useState('');
  const [kodeUnik, setKodeUnik] = useState('');
  const [statusAlbum, setStatusAlbum] =
    useState<ProductionItemStatus>('DALAM ANTREAN');
  const [statusKanvas, setStatusKanvas] =
    useState<ProductionItemStatus>('DALAM ANTREAN');
  const [estimasiSelesai, setEstimasiSelesai] = useState('');
  const [izinkanDownload, setIzinkanDownload] = useState(true);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setError('');
    if (editingCustomer) {
      setJenisLayanan(editingCustomer.jenis_layanan);
      setNamaCustomer(editingCustomer.nama_customer);
      setNamaKeluarga(editingCustomer.nama_keluarga || '');
      setPaket(editingCustomer.paket);
      setEmail(editingCustomer.email);
      setWhatsapp(editingCustomer.whatsapp);
      setNamaMarketing(editingCustomer.nama_marketing);
      setTanggalPendaftaran(toInputDateFormat(editingCustomer.tanggal_pendaftaran) || todayStr);
      setTanggalPemotretan(toInputDateFormat(editingCustomer.tanggal_pemotretan) || todayStr);
      setTanggalPemilihan(toInputDateFormat(editingCustomer.tanggal_pemilihan));
      setKuotaAlbum(editingCustomer.kuota_album);
      setKuotaKanvas(editingCustomer.kuota_kanvas);
      setUkuranKanvas(editingCustomer.ukuran_kanvas || '60x90 cm');
      setKuotaTambahan(editingCustomer.kuota_tambahan);
      setCatatanCustomer(editingCustomer.catatan_customer || '');
      setDriveFolderUrl(editingCustomer.drive_folder_url || '');
      setDriveFolderId(editingCustomer.drive_folder_id || '');
      setKodeUnik(editingCustomer.kode_unik);
      setStatusAlbum(editingCustomer.status_album);
      setStatusKanvas(editingCustomer.status_kanvas);
      setEstimasiSelesai(toInputDateFormat(editingCustomer.estimasi_selesai));
      setIzinkanDownload(editingCustomer.izinkan_download !== false);
    } else {
      setJenisLayanan(defaultCategory);
      setNamaCustomer('');
      setNamaKeluarga('');
      setPaket(
        defaultCategory === 'KELUARGA'
          ? 'Family Heirloom Package'
          : defaultCategory === 'LIPUTAN'
          ? 'Wedding Day Coverage'
          : 'Signature Prewedding'
      );
      setEmail('');
      setWhatsapp('');
      setNamaMarketing(marketingList[0]?.nama || '');
      setTanggalPendaftaran(todayStr);
      setTanggalPemotretan(todayStr);
      setTanggalPemilihan('');
      setKuotaAlbum(settings.default_kuota_album);
      setKuotaKanvas(settings.default_kuota_kanvas);
      setUkuranKanvas(settings.default_ukuran_kanvas);
      setKuotaTambahan(settings.default_kuota_tambahan);
      setCatatanCustomer('');
      setDriveFolderUrl('');
      setDriveFolderId('');
      setKodeUnik(generateUniqueCustomerCode(existingCodes));
      setStatusAlbum('DALAM ANTREAN');
      setStatusKanvas('DALAM ANTREAN');
      setEstimasiSelesai('');
      setIzinkanDownload(true);
    }
  }, [isOpen, editingCustomer, defaultCategory, settings, marketingList]);

  if (!isOpen) return null;

  const handleResetDriveFolder = () => {
    setDriveFolderUrl('');
    setDriveFolderId('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!namaCustomer.trim()) {
      setError('Nama pengantin atau pelanggan wajib diisi.');
      return;
    }
    if (!kodeUnik.trim()) {
      setError('Kode unik customer wajib diisi.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await onSave({
        id_customer: editingCustomer?.id_customer,
        jenis_layanan: jenisLayanan,
        nama_customer: namaCustomer.trim(),
        nama_keluarga: namaKeluarga.trim(),
        paket: paket.trim() || 'Signature Package',
        email: email.trim(),
        whatsapp: whatsapp.trim(),
        nama_marketing: namaMarketing.trim(),
        tanggal_pendaftaran: tanggalPendaftaran,
        tanggal_pemotretan: tanggalPemotretan,
        tanggal_pemilihan: tanggalPemilihan,
        kuota_album: Number(kuotaAlbum),
        kuota_kanvas: Number(kuotaKanvas),
        ukuran_kanvas: ukuranKanvas.trim() || '60x90 cm',
        kuota_tambahan: Number(kuotaTambahan),
        catatan_customer: catatanCustomer.trim(),
        drive_folder_url: driveFolderUrl.trim(),
        drive_folder_id: driveFolderId.trim(),
        kode_unik: kodeUnik.trim().toUpperCase(),
        status_album: statusAlbum,
        status_kanvas: statusKanvas,
        estimasi_selesai: estimasiSelesai,
        izinkan_download: izinkanDownload,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menyimpan data customer.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-[#2A201B]/60 backdrop-blur-xs flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="customer-form-title"
    >
      <div className="bg-white border border-[#E6DDD0] rounded-2xl max-w-3xl w-full max-h-[92vh] flex flex-col overflow-hidden shadow-xl">
        <div className="px-6 py-4 bg-[#FAF7F2] border-b border-[#E6DDD0] flex items-center justify-between">
          <div>
            <h3
              id="customer-form-title"
              className="font-serif text-xl font-semibold text-[#2A201B]"
            >
              {editingCustomer
                ? `Edit Data Customer (${editingCustomer.kode_unik})`
                : 'Tambah Customer Baru & Buat Folder Otomatis'}
            </h3>
            <p className="text-xs text-[#5E534B]">
              Folder customer dan 5 subfolder (ALL FILE, RINGKASAN, LIHAT EDITAN, REVISI, VIDEO)
              akan dibuat otomatis.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup formulir customer"
            className="w-9 h-9 rounded-lg flex items-center justify-center text-[#5E534B] hover:bg-[#E6DDD0]/40 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-5">
          {error && (
            <div className="p-3.5 rounded-lg bg-[#FDF0F0] border border-[#9E2A2B]/30 text-xs text-[#9E2A2B] font-medium">
              {error}
            </div>
          )}

          {/* Row 1: Kategori Layanan, Kode Unik, Nama Customer */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label
                htmlFor="cf-layanan"
                className="block text-xs font-medium uppercase tracking-wider text-[#5E534B] mb-1"
              >
                Jenis Layanan *
              </label>
              <select
                id="cf-layanan"
                value={jenisLayanan}
                onChange={(e) => setJenisLayanan(e.target.value as ServiceCategory)}
                className="w-full px-3.5 py-2.5 rounded-lg border border-[#E6DDD0] bg-[#FAF7F2] text-sm text-[#2A201B]"
              >
                <option value="PREWEDING">PREWEDING</option>
                <option value="LIPUTAN">LIPUTAN</option>
                <option value="KELUARGA">KELUARGA</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="cf-kode"
                className="block text-xs font-medium uppercase tracking-wider text-[#5E534B] mb-1"
              >
                Kode Unik Customer *
              </label>
              <div className="flex gap-1.5">
                <input
                  id="cf-kode"
                  type="text"
                  required
                  value={kodeUnik}
                  onChange={(e) => setKodeUnik(e.target.value.toUpperCase())}
                  className="w-full px-3 py-2.5 rounded-lg border border-[#E6DDD0] bg-[#FAF7F2] font-mono text-sm uppercase text-[#2A201B]"
                />
                <button
                  type="button"
                  onClick={() => setKodeUnik(generateUniqueCustomerCode(existingCodes))}
                  title="Buat Kode Unik Otomatis"
                  aria-label="Buat Kode Unik Otomatis"
                  className="px-3 rounded-lg border border-[#E6DDD0] bg-white hover:bg-[#FAF7F2] text-[#8C6B30] cursor-pointer"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div>
              <label
                htmlFor="cf-paket"
                className="block text-xs font-medium uppercase tracking-wider text-[#5E534B] mb-1"
              >
                Paket Fotografi *
              </label>
              <input
                id="cf-paket"
                type="text"
                required
                value={paket}
                onChange={(e) => setPaket(e.target.value)}
                placeholder="Contoh: Signature Prewedding"
                className="w-full px-3.5 py-2.5 rounded-lg border border-[#E6DDD0] bg-white text-sm text-[#2A201B]"
              />
            </div>
          </div>

          {/* Row 2: Nama Pengantin / Pelanggan & Nama Keluarga */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="cf-nama"
                className="block text-xs font-medium uppercase tracking-wider text-[#5E534B] mb-1"
              >
                Nama Pengantin / Pelanggan *
              </label>
              <input
                id="cf-nama"
                type="text"
                required
                value={namaCustomer}
                onChange={(e) => setNamaCustomer(e.target.value)}
                placeholder="Contoh: Andi & Sinta"
                className="w-full px-3.5 py-2.5 rounded-lg border border-[#E6DDD0] bg-white text-sm text-[#2A201B]"
              />
            </div>

            <div>
              <label
                htmlFor="cf-keluarga"
                className="block text-xs font-medium uppercase tracking-wider text-[#5E534B] mb-1"
              >
                Nama Keluarga {jenisLayanan === 'KELUARGA' ? '(Wajib untuk Keluarga)' : '(Opsional)'}
              </label>
              <input
                id="cf-keluarga"
                type="text"
                value={namaKeluarga}
                onChange={(e) => setNamaKeluarga(e.target.value)}
                placeholder="Contoh: Keluarga Besar Bpk. Hendra"
                className="w-full px-3.5 py-2.5 rounded-lg border border-[#E6DDD0] bg-white text-sm text-[#2A201B]"
              />
            </div>
          </div>

          {/* Row 3: WhatsApp, Email, Marketing */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label
                htmlFor="cf-wa"
                className="block text-xs font-medium uppercase tracking-wider text-[#5E534B] mb-1"
              >
                Nomor WhatsApp
              </label>
              <input
                id="cf-wa"
                type="text"
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value)}
                placeholder="081234567890"
                className="w-full px-3.5 py-2.5 rounded-lg border border-[#E6DDD0] bg-white text-sm text-[#2A201B]"
              />
            </div>

            <div>
              <label
                htmlFor="cf-email"
                className="block text-xs font-medium uppercase tracking-wider text-[#5E534B] mb-1"
              >
                Email Customer
              </label>
              <input
                id="cf-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="customer@email.com"
                className="w-full px-3.5 py-2.5 rounded-lg border border-[#E6DDD0] bg-white text-sm text-[#2A201B]"
              />
            </div>

            <div>
              <label
                htmlFor="cf-marketing"
                className="block text-xs font-medium uppercase tracking-wider text-[#5E534B] mb-1"
              >
                Nama Marketing
              </label>
              <input
                id="cf-marketing"
                list="marketing-datalist"
                type="text"
                value={namaMarketing}
                onChange={(e) => setNamaMarketing(e.target.value)}
                placeholder="Pilih atau ketik nama marketing"
                className="w-full px-3.5 py-2.5 rounded-lg border border-[#E6DDD0] bg-white text-sm text-[#2A201B]"
              />
              <datalist id="marketing-datalist">
                {marketingList.map((m) => (
                  <option key={m.id_marketing} value={m.nama} />
                ))}
              </datalist>
            </div>
          </div>

          {/* Row 4: Dates (Tgl Pemotretan, Tgl Pemilihan Foto, Estimasi Selesai) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label
                htmlFor="cf-tgl-foto"
                className="block text-xs font-medium uppercase tracking-wider text-[#5E534B] mb-1"
              >
                Tgl Pemotretan
              </label>
              <input
                id="cf-tgl-foto"
                type="date"
                value={tanggalPemotretan}
                onChange={(e) => setTanggalPemotretan(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-[#E6DDD0] bg-white font-mono text-xs text-[#2A201B]"
              />
            </div>

            <div>
              <label
                htmlFor="cf-tgl-pilih"
                className="block text-xs font-medium uppercase tracking-wider text-[#5E534B] mb-1"
              >
                Tgl Pemilihan Foto
              </label>
              <input
                id="cf-tgl-pilih"
                type="date"
                value={tanggalPemilihan}
                onChange={(e) => setTanggalPemilihan(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-[#E6DDD0] bg-white font-mono text-xs text-[#2A201B]"
              />
            </div>

            <div>
              <label
                htmlFor="cf-estimasi"
                className="block text-xs font-medium uppercase tracking-wider text-[#5E534B] mb-1"
              >
                Estimasi Selesai
              </label>
              <input
                id="cf-estimasi"
                type="date"
                value={estimasiSelesai}
                onChange={(e) => setEstimasiSelesai(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-[#E6DDD0] bg-white font-mono text-xs text-[#2A201B]"
              />
            </div>
          </div>

          {/* Row 5: Quotas & Canvas Size */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <label
                htmlFor="cf-kuota-album"
                className="block text-xs font-medium uppercase tracking-wider text-[#5E534B] mb-1"
              >
                Jumlah Foto Album
              </label>
              <input
                id="cf-kuota-album"
                type="number"
                min={0}
                value={kuotaAlbum}
                onChange={(e) => setKuotaAlbum(Number(e.target.value))}
                className="w-full px-3.5 py-2 rounded-lg border border-[#E6DDD0] bg-white font-mono text-sm text-[#2A201B]"
              />
            </div>

            <div>
              <label
                htmlFor="cf-kuota-kanvas"
                className="block text-xs font-medium uppercase tracking-wider text-[#5E534B] mb-1"
              >
                Jumlah Foto Kanvas
              </label>
              <input
                id="cf-kuota-kanvas"
                type="number"
                min={0}
                value={kuotaKanvas}
                onChange={(e) => setKuotaKanvas(Number(e.target.value))}
                className="w-full px-3.5 py-2 rounded-lg border border-[#E6DDD0] bg-white font-mono text-sm text-[#2A201B]"
              />
            </div>

            <div>
              <label
                htmlFor="cf-ukuran-kanvas"
                className="block text-xs font-medium uppercase tracking-wider text-[#5E534B] mb-1"
              >
                Ukuran Kanvas
              </label>
              <input
                id="cf-ukuran-kanvas"
                type="text"
                value={ukuranKanvas}
                onChange={(e) => setUkuranKanvas(e.target.value)}
                placeholder="60x90 cm"
                className="w-full px-3.5 py-2 rounded-lg border border-[#E6DDD0] bg-white text-sm text-[#2A201B]"
              />
            </div>

            <div>
              <label
                htmlFor="cf-kuota-tambahan"
                className="block text-xs font-medium uppercase tracking-wider text-[#5E534B] mb-1"
              >
                Jumlah Foto Tambahan
              </label>
              <input
                id="cf-kuota-tambahan"
                type="number"
                min={0}
                value={kuotaTambahan}
                onChange={(e) => setKuotaTambahan(Number(e.target.value))}
                className="w-full px-3.5 py-2 rounded-lg border border-[#E6DDD0] bg-white font-mono text-sm text-[#2A201B]"
              />
            </div>
          </div>

          {/* Row 6: Production Statuses */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="cf-status-album"
                className="block text-xs font-medium uppercase tracking-wider text-[#5E534B] mb-1"
              >
                Status Pekerjaan Album
              </label>
              <select
                id="cf-status-album"
                value={statusAlbum}
                onChange={(e) =>
                  setStatusAlbum(e.target.value as ProductionItemStatus)
                }
                className="w-full px-3.5 py-2.5 rounded-lg border border-[#E6DDD0] bg-[#FAF7F2] text-sm text-[#2A201B]"
              >
                {PRODUCTION_STATUS_LIST.map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="cf-status-kanvas"
                className="block text-xs font-medium uppercase tracking-wider text-[#5E534B] mb-1"
              >
                Status Pekerjaan Kanvas
              </label>
              <select
                id="cf-status-kanvas"
                value={statusKanvas}
                onChange={(e) =>
                  setStatusKanvas(e.target.value as ProductionItemStatus)
                }
                className="w-full px-3.5 py-2.5 rounded-lg border border-[#E6DDD0] bg-[#FAF7F2] text-sm text-[#2A201B]"
              >
                {PRODUCTION_STATUS_LIST.map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Row 7: Google Drive Folder URL & Reset */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label
                htmlFor="cf-drive-url"
                className="block text-xs font-medium uppercase tracking-wider text-[#5E534B]"
              >
                Link Folder Google Drive Customer (Otomatis / Manual)
              </label>
              {driveFolderUrl && (
                <button
                  type="button"
                  onClick={handleResetDriveFolder}
                  className="inline-flex items-center gap-1 text-xs text-[#9E2A2B] hover:underline cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Reset Link Folder</span>
                </button>
              )}
            </div>
            <input
              id="cf-drive-url"
              type="url"
              value={driveFolderUrl}
              onChange={(e) => setDriveFolderUrl(e.target.value)}
              placeholder="Kosongkan agar dibuat otomatis di folder induk Google Drive"
              className="w-full px-3.5 py-2.5 rounded-lg border border-[#E6DDD0] bg-white text-sm text-[#2A201B]"
            />
          </div>

          {/* Row 8: Catatan Customer & Izinkan Download */}
          <div>
            <label
              htmlFor="cf-catatan"
              className="block text-xs font-medium uppercase tracking-wider text-[#5E534B] mb-1"
            >
              Catatan untuk Customer (Ditampilkan di Beranda Customer)
            </label>
            <textarea
              id="cf-catatan"
              rows={2}
              value={catatanCustomer}
              onChange={(e) => setCatatanCustomer(e.target.value)}
              placeholder="Catatan paket, jadwal fitting, atau instruksi khusus..."
              className="w-full px-3.5 py-2 rounded-lg border border-[#E6DDD0] bg-white text-sm text-[#2A201B]"
            />
          </div>

          <label className="flex items-center gap-2.5 text-xs sm:text-sm text-[#2A201B] cursor-pointer">
            <input
              type="checkbox"
              checked={izinkanDownload}
              onChange={(e) => setIzinkanDownload(e.target.checked)}
              className="w-4 h-4 accent-[#8C6B30]"
            />
            <span>Izinkan customer mengunduh foto dan arsip ZIP dari portal</span>
          </label>

          <div className="pt-3 border-t border-[#E6DDD0] flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-lg text-xs sm:text-sm font-medium text-[#5E534B] hover:bg-[#FAF7F2] cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={saving}
              className="min-h-[44px] px-6 py-2.5 rounded-lg bg-[#2A201B] text-[#FAF7F2] text-xs sm:text-sm font-medium hover:bg-[#3F312A] disabled:opacity-50 cursor-pointer"
            >
              {saving
                ? 'Menyimpan...'
                : editingCustomer
                ? 'Simpan Perubahan'
                : 'Simpan & Buat Folder'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
