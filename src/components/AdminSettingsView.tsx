import React, { useEffect, useState } from 'react';
import {
  Activity,
  AlertCircle,
  Check,
  CheckCircle2,
  Code2,
  Copy,
  Download,
  Plus,
  RotateCcw,
  Save,
  Trash2,
  UserPlus,
  XCircle,
} from 'lucide-react';
import type {
  ConnectionServiceCheck,
  ConnectionTestResult,
  MarketingMember,
  StudioSettings,
  WhatsAppTemplateKey,
} from '../types/studio';
import {
  fetchGasSourceCode,
  manageMarketingMember,
  saveStudioSettings,
  testSystemConnections,
} from '../utils/apiClient';
import { DEFAULT_WHATSAPP_TEMPLATES } from '../utils/studioLogic';

interface AdminSettingsViewProps {
  settings: StudioSettings;
  marketing: MarketingMember[];
  onRefreshData: () => Promise<void>;
}

const TEMPLATE_META: Array<{ key: WhatsAppTemplateKey; title: string }> = [
  { key: 'KIRIM_LINK', title: '1. Pesan Pengiriman Link Pemilihan Foto' },
  { key: 'PENGINGAT_PILIH', title: '2. Pengingat Pemilihan Foto' },
  { key: 'HASIL_EDITING', title: '3. Pemberitahuan Hasil Editing' },
  { key: 'MINTA_PERSETUJUAN', title: '4. Permintaan Persetujuan Hasil Editing' },
  { key: 'PEMBERITAHUAN_REVISI', title: '5. Pemberitahuan Hasil Revisi' },
  { key: 'PEKERJAAN_SELESAI', title: '6. Pemberitahuan Pekerjaan Selesai' },
];

export const AdminSettingsView: React.FC<AdminSettingsViewProps> = ({
  settings,
  marketing,
  onRefreshData,
}) => {
  const [subTab, setSubTab] = useState<
    'INTEGRASI' | 'ATURAN' | 'MARKETING' | 'WHATSAPP' | 'KEAMANAN'
  >('INTEGRASI');

  const [form, setForm] = useState<StudioSettings>(settings);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [saveError, setSaveError] = useState('');

  // Connection test state
  const [testingConn, setTestingConn] = useState(false);
  const [connResult, setConnResult] = useState<ConnectionTestResult | null>(null);

  // Marketing form state
  const [mktName, setMktName] = useState('');
  const [mktWa, setMktWa] = useState('');
  const [mktEmail, setMktEmail] = useState('');
  const [mktStatus, setMktStatus] = useState<'AKTIF' | 'NONAKTIF'>('AKTIF');
  const [savingMkt, setSavingMkt] = useState(false);

  // GAS Source Code viewer
  const [gasCode, setGasCode] = useState('');
  const [copiedGas, setCopiedGas] = useState(false);

  useEffect(() => {
    setForm(settings);
  }, [settings]);

  useEffect(() => {
    if (subTab === 'KEAMANAN' && !gasCode) {
      fetchGasSourceCode()
        .then((res) => setGasCode(res.code))
        .catch(() => {});
    }
  }, [subTab, gasCode]);

  const handleSaveSettings = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSaving(true);
    setSaveMessage('');
    setSaveError('');
    try {
      await saveStudioSettings(form);
      await onRefreshData();
      setSaveMessage('Pengaturan studio berhasil disimpan.');
    } catch (err) {
      setSaveError(
        err instanceof Error ? err.message : 'Gagal menyimpan pengaturan.'
      );
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnections = async () => {
    setTestingConn(true);
    setSaveError('');
    try {
      // Save latest connection fields first so test checks current input
      await saveStudioSettings(form);
      const res = await testSystemConnections();
      setConnResult(res.result);
      await onRefreshData();
    } catch (err) {
      setSaveError(
        err instanceof Error ? err.message : 'Gagal menjalankan pengujian koneksi.'
      );
    } finally {
      setTestingConn(false);
    }
  };

  const handleLogoFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setForm((prev) => ({ ...prev, logo_url: String(reader.result || '') }));
    };
    reader.readAsDataURL(file);
  };

  const handleAddMarketing = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mktName.trim()) return;
    setSavingMkt(true);
    try {
      await manageMarketingMember({
        op: 'UPSERT',
        nama: mktName.trim(),
        whatsapp: mktWa.trim(),
        email: mktEmail.trim(),
        status: mktStatus,
      });
      setMktName('');
      setMktWa('');
      setMktEmail('');
      await onRefreshData();
    } finally {
      setSavingMkt(false);
    }
  };

  const handleToggleMarketingStatus = async (m: MarketingMember) => {
    await manageMarketingMember({
      op: 'UPSERT',
      ...m,
      status: m.status === 'AKTIF' ? 'NONAKTIF' : 'AKTIF',
    });
    await onRefreshData();
  };

  const handleDeleteMarketing = async (id: string) => {
    await manageMarketingMember({ op: 'DELETE', id_marketing: id });
    await onRefreshData();
  };

  const handleCopyGasCode = async () => {
    if (!gasCode) return;
    try {
      await navigator.clipboard.writeText(gasCode);
      setCopiedGas(true);
      setTimeout(() => setCopiedGas(false), 2000);
    } catch {}
  };

  const handleDownloadGasFile = () => {
    if (!gasCode) return;
    const blob = new Blob([gasCode], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'Code.gs';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const renderConnectionBadge = (status: ConnectionServiceCheck['status']) => {
    if (status === 'TERHUBUNG') {
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#1F6E43]">
          <CheckCircle2 className="w-4 h-4" />
          <span>TERHUBUNG</span>
        </span>
      );
    }
    if (status === 'GAGAL TERHUBUNG') {
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#9E2A2B]">
          <XCircle className="w-4 h-4" />
          <span>GAGAL TERHUBUNG</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#9A5B13]">
        <AlertCircle className="w-4 h-4" />
        <span>BELUM DIKONFIGURASI</span>
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Sub-navigation bar */}
      <div className="bg-white border border-[#E6DDD0] rounded-xl p-1.5 flex items-center gap-1 overflow-x-auto">
        {(
          [
            { key: 'INTEGRASI', label: 'Studio & Koneksi Google' },
            { key: 'ATURAN', label: 'Aturan Kuota & Download' },
            { key: 'MARKETING', label: 'Kontak Marketing' },
            { key: 'WHATSAPP', label: 'Template WhatsApp' },
            { key: 'KEAMANAN', label: 'Keamanan & Apps Script' },
          ] as const
        ).map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setSubTab(t.key)}
            className={`px-4 py-2.5 rounded-lg text-xs font-medium whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
              subTab === t.key
                ? 'bg-[#2A201B] text-[#FAF7F2]'
                : 'text-[#4A3B32] hover:bg-[#FAF7F2]'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {saveMessage && (
        <div className="p-4 rounded-xl bg-[#ECF7F0] border border-[#1F6E43]/30 text-xs sm:text-sm text-[#1F6E43] font-medium">
          {saveMessage}
        </div>
      )}
      {saveError && (
        <div className="p-4 rounded-xl bg-[#FDF0F0] border border-[#9E2A2B]/30 text-xs sm:text-sm text-[#9E2A2B] font-medium">
          {saveError}
        </div>
      )}

      {/* SUBTAB 1: STUDIO & INTEGRASI GOOGLE */}
      {subTab === 'INTEGRASI' && (
        <div className="space-y-6">
          {/* Connection Tester Card */}
          <section className="bg-white border border-[#E6DDD0] rounded-xl p-6 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E6DDD0] pb-4">
              <div>
                <h3 className="font-serif text-xl font-semibold text-[#2A201B]">
                  Status Koneksi Google Sheets, Drive &amp; Apps Script
                </h3>
                <p className="text-xs text-[#5E534B]">
                  Uji koneksi nyata ke Google Apps Script Web App, Google Sheets, Google Drive, dan
                  Backend Aplikasi.
                </p>
              </div>
              <button
                type="button"
                disabled={testingConn}
                onClick={handleTestConnections}
                className="min-h-[42px] px-5 py-2 rounded-lg bg-[#8C6B30] text-white text-xs sm:text-sm font-medium hover:bg-[#755824] disabled:opacity-50 inline-flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Activity className="w-4 h-4" />
                <span>{testingConn ? 'Menguji Koneksi...' : 'TEST KONEKSI'}</span>
              </button>
            </div>

            {connResult ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {connResult.checks.map((chk) => (
                  <div
                    key={chk.service}
                    className="p-4 rounded-xl bg-[#FAF7F2] border border-[#E6DDD0] space-y-2"
                  >
                    <p className="text-xs font-medium text-[#5E534B]">{chk.service}</p>
                    <div>{renderConnectionBadge(chk.status)}</div>
                    <p className="text-xs text-[#4A3B32] leading-relaxed">
                      {chk.message}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-[#5E534B]">
                Klik tombol <strong>TEST KONEKSI</strong> untuk memeriksa status aktual setiap
                layanan.
              </p>
            )}
          </section>

          {/* Studio & Google Config Form */}
          <form
            onSubmit={handleSaveSettings}
            className="bg-white border border-[#E6DDD0] rounded-xl p-6 space-y-6"
          >
            <h3 className="font-serif text-xl font-semibold text-[#2A201B] border-b border-[#E6DDD0] pb-3">
              Identitas Studio &amp; Konfigurasi Google Workspace
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="set-studio-name"
                  className="block text-xs font-medium uppercase tracking-wider text-[#5E534B] mb-1"
                >
                  Nama Studio
                </label>
                <input
                  id="set-studio-name"
                  type="text"
                  value={form.nama_studio}
                  onChange={(e) => setForm({ ...form, nama_studio: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-[#E6DDD0] bg-white text-sm text-[#2A201B]"
                />
              </div>

              <div>
                <label
                  htmlFor="set-timezone"
                  className="block text-xs font-medium uppercase tracking-wider text-[#5E534B] mb-1"
                >
                  Zona Waktu
                </label>
                <input
                  id="set-timezone"
                  type="text"
                  value={form.zona_waktu}
                  onChange={(e) => setForm({ ...form, zona_waktu: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-[#E6DDD0] bg-[#FAF7F2] font-mono text-sm text-[#2A201B]"
                />
              </div>
            </div>

            {/* Logo Studio Upload / URL */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
              <div>
                <label
                  htmlFor="set-logo-url"
                  className="block text-xs font-medium uppercase tracking-wider text-[#5E534B] mb-1"
                >
                  Logo Studio (URL Gambar / Unggah File)
                </label>
                <input
                  id="set-logo-url"
                  type="text"
                  value={form.logo_url}
                  onChange={(e) => setForm({ ...form, logo_url: e.target.value })}
                  placeholder="Kosongkan untuk monogram default LOUIS BRIDES"
                  className="w-full px-3.5 py-2.5 rounded-lg border border-[#E6DDD0] bg-white text-sm text-[#2A201B]"
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="px-4 py-2.5 rounded-lg border border-[#E6DDD0] bg-[#FAF7F2] text-xs font-medium text-[#2A201B] hover:bg-[#F3ECE1] cursor-pointer">
                  <span>Pilih File Logo</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleLogoFileUpload}
                    className="sr-only"
                  />
                </label>
                {form.logo_url && (
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, logo_url: '' })}
                    className="px-3 py-2.5 rounded-lg text-xs text-[#9E2A2B] hover:bg-[#FDF0F0] cursor-pointer"
                  >
                    Reset Logo
                  </button>
                )}
              </div>
            </div>

            {/* Public URL, Email, Studio WA */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label
                  htmlFor="set-public-url"
                  className="block text-xs font-medium uppercase tracking-wider text-[#5E534B] mb-1"
                >
                  URL Aplikasi Publik
                </label>
                <input
                  id="set-public-url"
                  type="url"
                  value={form.public_app_url}
                  onChange={(e) =>
                    setForm({ ...form, public_app_url: e.target.value })
                  }
                  placeholder="https://pilihfoto.louisbrides.com"
                  className="w-full px-3.5 py-2.5 rounded-lg border border-[#E6DDD0] bg-white text-sm text-[#2A201B]"
                />
              </div>

              <div>
                <label
                  htmlFor="set-admin-email"
                  className="block text-xs font-medium uppercase tracking-wider text-[#5E534B] mb-1"
                >
                  Email Admin Studio
                </label>
                <input
                  id="set-admin-email"
                  type="email"
                  value={form.email_admin}
                  onChange={(e) => setForm({ ...form, email_admin: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-[#E6DDD0] bg-white text-sm text-[#2A201B]"
                />
              </div>

              <div>
                <label
                  htmlFor="set-studio-wa"
                  className="block text-xs font-medium uppercase tracking-wider text-[#5E534B] mb-1"
                >
                  Nomor WhatsApp Studio
                </label>
                <input
                  id="set-studio-wa"
                  type="text"
                  value={form.whatsapp_studio}
                  onChange={(e) =>
                    setForm({ ...form, whatsapp_studio: e.target.value })
                  }
                  placeholder="6281122334455"
                  className="w-full px-3.5 py-2.5 rounded-lg border border-[#E6DDD0] bg-white font-mono text-sm text-[#2A201B]"
                />
              </div>
            </div>

            {/* GAS URL, Spreadsheet ID, Drive Root Folder ID */}
            <div className="space-y-4 pt-2 border-t border-[#E6DDD0]">
              <div>
                <label
                  htmlFor="set-gas-url"
                  className="block text-xs font-medium uppercase tracking-wider text-[#5E534B] mb-1"
                >
                  Google Apps Script Web App URL
                </label>
                <input
                  id="set-gas-url"
                  type="url"
                  value={form.gas_webapp_url}
                  onChange={(e) =>
                    setForm({ ...form, gas_webapp_url: e.target.value })
                  }
                  placeholder="https://script.google.com/macros/s/.../exec"
                  className="w-full px-3.5 py-2.5 rounded-lg border border-[#E6DDD0] bg-[#FAF7F2] font-mono text-xs sm:text-sm text-[#2A201B]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="set-ss-id"
                    className="block text-xs font-medium uppercase tracking-wider text-[#5E534B] mb-1"
                  >
                    Google Spreadsheet ID
                  </label>
                  <input
                    id="set-ss-id"
                    type="text"
                    value={form.spreadsheet_id}
                    onChange={(e) =>
                      setForm({ ...form, spreadsheet_id: e.target.value })
                    }
                    placeholder="Contoh: 1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms"
                    className="w-full px-3.5 py-2.5 rounded-lg border border-[#E6DDD0] bg-[#FAF7F2] font-mono text-xs sm:text-sm text-[#2A201B]"
                  />
                </div>

                <div>
                  <label
                    htmlFor="set-drive-root"
                    className="block text-xs font-medium uppercase tracking-wider text-[#5E534B] mb-1"
                  >
                    Google Drive Root Folder ID (LOUIS BRIDES CLIENT DATA)
                  </label>
                  <input
                    id="set-drive-root"
                    type="text"
                    value={form.drive_root_folder_id}
                    onChange={(e) =>
                      setForm({ ...form, drive_root_folder_id: e.target.value })
                    }
                    placeholder="1qsd1Ozk8hHC97HyTNCTvq57ZTCx18AGF"
                    className="w-full px-3.5 py-2.5 rounded-lg border border-[#E6DDD0] bg-[#FAF7F2] font-mono text-xs sm:text-sm text-[#2A201B]"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="min-h-[44px] px-6 py-2.5 rounded-lg bg-[#2A201B] text-[#FAF7F2] text-xs sm:text-sm font-medium hover:bg-[#3F312A] inline-flex items-center gap-2 cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>{saving ? 'Menyimpan...' : 'Simpan Pengaturan'}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* SUBTAB 2: ATURAN KUOTA, REVISI & DOWNLOAD */}
      {subTab === 'ATURAN' && (
        <form
          onSubmit={handleSaveSettings}
          className="bg-white border border-[#E6DDD0] rounded-xl p-6 space-y-6"
        >
          <h3 className="font-serif text-xl font-semibold text-[#2A201B] border-b border-[#E6DDD0] pb-3">
            Aturan Default Kuota Foto, Revisi, Estimasi &amp; Hak Akses Unduhan
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-medium uppercase tracking-wider text-[#5E534B] mb-1">
                Default Kuota Album
              </label>
              <input
                type="number"
                min={0}
                value={form.default_kuota_album}
                onChange={(e) =>
                  setForm({ ...form, default_kuota_album: Number(e.target.value) })
                }
                className="w-full px-3.5 py-2 rounded-lg border border-[#E6DDD0] font-mono text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-medium uppercase tracking-wider text-[#5E534B] mb-1">
                Default Kuota Kanvas
              </label>
              <input
                type="number"
                min={0}
                value={form.default_kuota_kanvas}
                onChange={(e) =>
                  setForm({ ...form, default_kuota_kanvas: Number(e.target.value) })
                }
                className="w-full px-3.5 py-2 rounded-lg border border-[#E6DDD0] font-mono text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-medium uppercase tracking-wider text-[#5E534B] mb-1">
                Default Ukuran Kanvas
              </label>
              <input
                type="text"
                value={form.default_ukuran_kanvas}
                onChange={(e) =>
                  setForm({ ...form, default_ukuran_kanvas: e.target.value })
                }
                className="w-full px-3.5 py-2 rounded-lg border border-[#E6DDD0] text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-medium uppercase tracking-wider text-[#5E534B] mb-1">
                Default Kuota Tambahan
              </label>
              <input
                type="number"
                min={0}
                value={form.default_kuota_tambahan}
                onChange={(e) =>
                  setForm({
                    ...form,
                    default_kuota_tambahan: Number(e.target.value),
                  })
                }
                className="w-full px-3.5 py-2 rounded-lg border border-[#E6DDD0] font-mono text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium uppercase tracking-wider text-[#5E534B] mb-1">
                Batas Maksimal Revisi
              </label>
              <input
                type="number"
                min={1}
                max={10}
                value={form.batas_revisi}
                onChange={(e) =>
                  setForm({ ...form, batas_revisi: Number(e.target.value) })
                }
                className="w-full px-3.5 py-2 rounded-lg border border-[#E6DDD0] font-mono text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-medium uppercase tracking-wider text-[#5E534B] mb-1">
                Lama Estimasi (Bulan Kalender)
              </label>
              <input
                type="number"
                min={1}
                max={12}
                value={form.estimasi_pengerjaan_bulan}
                onChange={(e) =>
                  setForm({
                    ...form,
                    estimasi_pengerjaan_bulan: Number(e.target.value),
                  })
                }
                className="w-full px-3.5 py-2 rounded-lg border border-[#E6DDD0] font-mono text-sm"
              />
            </div>
          </div>

          <div className="pt-3 border-t border-[#E6DDD0] space-y-3">
            <p className="text-xs font-medium uppercase tracking-wider text-[#5E534B]">
              Pengaturan Akses Download ZIP Customer per Folder
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
              {(
                [
                  { key: 'izinkan_download_all_file', label: 'Izinkan Download ALL FILE' },
                  { key: 'izinkan_download_ringkasan', label: 'Izinkan Download RINGKASAN' },
                  { key: 'izinkan_download_editan', label: 'Izinkan Download LIHAT EDITAN' },
                  { key: 'izinkan_download_revisi', label: 'Izinkan Download REVISI' },
                  { key: 'izinkan_download_video', label: 'Izinkan Download VIDEO' },
                ] as const
              ).map((item) => (
                <label
                  key={item.key}
                  className="flex items-center gap-2.5 p-3 rounded-lg border border-[#E6DDD0] bg-[#FAF7F2] cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={Boolean(form[item.key])}
                    onChange={(e) =>
                      setForm({ ...form, [item.key]: e.target.checked })
                    }
                    className="w-4 h-4 accent-[#8C6B30]"
                  />
                  <span className="text-xs font-medium text-[#2A201B]">
                    {item.label}
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="min-h-[44px] px-6 py-2.5 rounded-lg bg-[#2A201B] text-[#FAF7F2] text-xs sm:text-sm font-medium hover:bg-[#3F312A] inline-flex items-center gap-2 cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>{saving ? 'Menyimpan...' : 'Simpan Aturan'}</span>
            </button>
          </div>
        </form>
      )}

      {/* SUBTAB 3: KONTAK MARKETING */}
      {subTab === 'MARKETING' && (
        <div className="space-y-6">
          <form
            onSubmit={handleAddMarketing}
            className="bg-white border border-[#E6DDD0] rounded-xl p-6 space-y-4"
          >
            <div className="flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-[#8C6B30]" />
              <h3 className="font-serif text-xl font-semibold text-[#2A201B]">
                Tambah Kontak Tim Marketing
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <input
                type="text"
                required
                value={mktName}
                onChange={(e) => setMktName(e.target.value)}
                placeholder="Nama Marketing"
                className="px-3.5 py-2 rounded-lg border border-[#E6DDD0] text-sm"
              />
              <input
                type="text"
                value={mktWa}
                onChange={(e) => setMktWa(e.target.value)}
                placeholder="Nomor WhatsApp (0812...)"
                className="px-3.5 py-2 rounded-lg border border-[#E6DDD0] text-sm"
              />
              <input
                type="email"
                value={mktEmail}
                onChange={(e) => setMktEmail(e.target.value)}
                placeholder="Email Marketing"
                className="px-3.5 py-2 rounded-lg border border-[#E6DDD0] text-sm"
              />
              <div className="flex gap-2">
                <select
                  value={mktStatus}
                  onChange={(e) =>
                    setMktStatus(e.target.value as 'AKTIF' | 'NONAKTIF')
                  }
                  className="px-3 py-2 rounded-lg border border-[#E6DDD0] bg-[#FAF7F2] text-sm"
                >
                  <option value="AKTIF">AKTIF</option>
                  <option value="NONAKTIF">NONAKTIF</option>
                </select>
                <button
                  type="submit"
                  disabled={savingMkt}
                  className="px-4 py-2 rounded-lg bg-[#2A201B] text-[#FAF7F2] text-xs font-medium inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Tambah</span>
                </button>
              </div>
            </div>
          </form>

          <div className="bg-white border border-[#E6DDD0] rounded-xl overflow-hidden">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-[#FAF7F2] border-b border-[#E6DDD0] text-xs uppercase text-[#5E534B]">
                  <th className="py-3 px-4">Nama Marketing</th>
                  <th className="py-3 px-4">WhatsApp</th>
                  <th className="py-3 px-4">Email</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E6DDD0]">
                {marketing.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-xs text-[#5E534B]">
                      Belum ada daftar kontak marketing. Tambahkan di atas.
                    </td>
                  </tr>
                ) : (
                  marketing.map((m) => (
                    <tr key={m.id_marketing} className="hover:bg-[#FAF7F2]/60">
                      <td className="py-3 px-4 font-medium text-[#2A201B]">
                        {m.nama}
                      </td>
                      <td className="py-3 px-4 font-mono text-xs text-[#4A3B32]">
                        {m.whatsapp || '-'}
                      </td>
                      <td className="py-3 px-4 text-xs text-[#4A3B32]">
                        {m.email || '-'}
                      </td>
                      <td className="py-3 px-4">
                        <button
                          type="button"
                          onClick={() => handleToggleMarketingStatus(m)}
                          className={`text-xs font-semibold cursor-pointer ${
                            m.status === 'AKTIF'
                              ? 'text-[#1F6E43]'
                              : 'text-[#75655A]'
                          }`}
                        >
                          {m.status}
                        </button>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => handleDeleteMarketing(m.id_marketing)}
                          aria-label={`Hapus marketing ${m.nama}`}
                          className="p-1.5 text-[#9E2A2B] hover:bg-[#FDF0F0] rounded cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUBTAB 4: TEMPLATE WHATSAPP */}
      {subTab === 'WHATSAPP' && (
        <form
          onSubmit={handleSaveSettings}
          className="bg-white border border-[#E6DDD0] rounded-xl p-6 space-y-6"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E6DDD0] pb-4">
            <div>
              <h3 className="font-serif text-xl font-semibold text-[#2A201B]">
                Template Pesan WhatsApp Otomatis
              </h3>
              <p className="text-xs text-[#5E534B]">
                Variabel yang didukung: <code>{'{nama_customer}'}</code>,{' '}
                <code>{'{kode_unik}'}</code>, <code>{'{link_customer}'}</code>,{' '}
                <code>{'{nama_marketing}'}</code>, <code>{'{estimasi_selesai}'}</code>,{' '}
                <code>{'{link_drive}'}</code>
              </p>
            </div>
            <button
              type="button"
              onClick={() =>
                setForm({
                  ...form,
                  whatsapp_templates: { ...DEFAULT_WHATSAPP_TEMPLATES },
                })
              }
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-[#E6DDD0] bg-[#FAF7F2] text-xs font-medium text-[#2A201B] cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Template Default</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {TEMPLATE_META.map((tpl) => (
              <div key={tpl.key} className="space-y-1.5">
                <label className="block text-xs font-semibold text-[#2A201B]">
                  {tpl.title}
                </label>
                <textarea
                  rows={6}
                  value={form.whatsapp_templates[tpl.key] || ''}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      whatsapp_templates: {
                        ...form.whatsapp_templates,
                        [tpl.key]: e.target.value,
                      },
                    })
                  }
                  className="w-full px-3.5 py-2.5 rounded-lg border border-[#E6DDD0] bg-[#FAF7F2] text-xs text-[#2A201B] leading-relaxed"
                />
              </div>
            ))}
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="min-h-[44px] px-6 py-2.5 rounded-lg bg-[#2A201B] text-[#FAF7F2] text-xs sm:text-sm font-medium hover:bg-[#3F312A] inline-flex items-center gap-2 cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>{saving ? 'Menyimpan...' : 'Simpan Template Pesan'}</span>
            </button>
          </div>
        </form>
      )}

      {/* SUBTAB 5: KEAMANAN & KODE APPS SCRIPT */}
      {subTab === 'KEAMANAN' && (
        <div className="space-y-6">
          <div className="bg-white border border-[#E6DDD0] rounded-xl p-6 space-y-3 max-w-xl">
            <div className="flex items-center gap-2 text-[#1F6E43]">
              <CheckCircle2 className="w-5 h-5 shrink-0" />
              <h3 className="font-serif text-xl font-semibold text-[#2A201B]">
                Akses Admin Studio: Terbuka Langsung
              </h3>
            </div>
            <p className="text-xs sm:text-sm text-[#4A3B32] leading-relaxed">
              Login admin telah dinonaktifkan. Anda dan tim studio dapat langsung membuka dashboard admin
              kapan saja (baik di server lokal maupun setelah dideploy ke Cloudflare Pages) tanpa perlu
              memasukkan PIN atau password.
            </p>
            <div className="p-3 bg-[#FAF7F2] rounded-lg border border-[#E6DDD0] text-xs text-[#75655A]">
              Tautan langsung: <strong className="font-mono text-[#2A201B]">/admin</strong>
            </div>
          </div>

          {/* Google Apps Script Code Viewer & Downloader */}
          <section className="bg-white border border-[#E6DDD0] rounded-xl p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Code2 className="w-5 h-5 text-[#8C6B30]" />
                <div>
                  <h3 className="font-serif text-xl font-semibold text-[#2A201B]">
                    Kode Backend Google Apps Script (gas/Code.gs)
                  </h3>
                  <p className="text-xs text-[#5E534B]">
                    Salin kode ini ke Google Apps Script pada akun pemilik studio, jalankan{' '}
                    <code>initDatabase()</code>, lalu deploy sebagai Web App.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handleCopyGasCode}
                  className="px-3.5 py-2 rounded-lg border border-[#E6DDD0] bg-[#FAF7F2] text-xs font-medium text-[#2A201B] inline-flex items-center gap-1.5 cursor-pointer"
                >
                  {copiedGas ? (
                    <Check className="w-3.5 h-3.5 text-[#1F6E43]" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                  <span>{copiedGas ? 'Kode Tersalin' : 'Salin Code.gs'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleDownloadGasFile}
                  className="px-3.5 py-2 rounded-lg bg-[#8C6B30] text-white text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Unduh Code.gs</span>
                </button>
              </div>
            </div>

            <pre className="p-4 rounded-xl bg-[#1B1411] text-[#FAF7F2] font-mono text-xs overflow-x-auto max-h-80 leading-relaxed">
              {gasCode || 'Memuat kode Google Apps Script...'}
            </pre>
          </section>
        </div>
      )}
    </div>
  );
};
