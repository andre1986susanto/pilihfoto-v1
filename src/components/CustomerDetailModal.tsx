import React, { useEffect, useState } from 'react';
import {
  Check,
  Copy,
  ExternalLink,
  FolderOpen,
  ImagePlus,
  MessageCircle,
  Sparkles,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import type {
  CustomerRecord,
  DriveMediaItem,
  DriveSubfolderCategory,
  FeedbackRecord,
  PhotoSelectionSubmission,
} from '../types/studio';
import {
  deleteCustomerFolderFile,
  fetchCustomerPhotos,
  seedCustomerSamplePhotos,
  uploadCustomerFolderFiles,
} from '../utils/apiClient';
import { buildCustomerPortalUrl, formatDateDDMMYYYY } from '../utils/studioLogic';

interface CustomerDetailModalProps {
  customer: CustomerRecord | null;
  selections: PhotoSelectionSubmission[];
  feedbacks: FeedbackRecord[];
  publicAppUrl: string;
  isGasConfigured: boolean;
  onOpenWhatsApp: (customer: CustomerRecord) => void;
  onClose: () => void;
}

const SUBFOLDERS: DriveSubfolderCategory[] = [
  'ALL FILE',
  'RINGKASAN',
  'LIHAT EDITAN',
  'REVISI',
  'VIDEO',
];

export const CustomerDetailModal: React.FC<CustomerDetailModalProps> = ({
  customer,
  selections,
  feedbacks,
  publicAppUrl,
  isGasConfigured,
  onOpenWhatsApp,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'FOLDER' | 'PILIHAN' | 'REVISI'>('FOLDER');
  const [selectedFolder, setSelectedFolder] =
    useState<DriveSubfolderCategory>('ALL FILE');
  const [mediaList, setMediaList] = useState<DriveMediaItem[]>([]);
  const [loadingMedia, setLoadingMedia] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [statusNote, setStatusNote] = useState('');

  useEffect(() => {
    if (!customer) return;
    setLoadingMedia(true);
    setStatusNote('');
    fetchCustomerPhotos(customer.kode_unik)
      .then((res) => setMediaList(res.media || []))
      .catch(() => setMediaList([]))
      .finally(() => setLoadingMedia(false));
  }, [customer]);

  if (!customer) return null;

  const baseOrigin =
    publicAppUrl || (typeof window !== 'undefined' ? window.location.origin : '');
  const customerPortalLink = buildCustomerPortalUrl(baseOrigin, customer.kode_unik);

  const customerSubmissions = selections.filter(
    (s) => s.kode_unik.toUpperCase() === customer.kode_unik.toUpperCase()
  );
  const latestSubmission = customerSubmissions[customerSubmissions.length - 1];

  const customerRevisions = feedbacks.filter(
    (f) =>
      f.kode_unik.toUpperCase() === customer.kode_unik.toUpperCase() &&
      (f.jenis_feedback === 'REVISION_REQUEST' || f.jenis_feedback === 'EDIT_APPROVAL')
  );

  const folderMedia = mediaList.filter((m) => m.category === selectedFolder);

  const handleCopyPortalLink = async () => {
    try {
      await navigator.clipboard.writeText(customerPortalLink);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } catch {}
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;
    setUploading(true);
    setStatusNote('');
    try {
      const encodedFiles: Array<{ name: string; base64: string }> = [];
      for (let i = 0; i < fileList.length; i++) {
        const file = fileList[i];
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result || ''));
          reader.onerror = () => reject(new Error(`Gagal membaca ${file.name}`));
          reader.readAsDataURL(file);
        });
        encodedFiles.push({ name: file.name, base64 });
      }
      const res = await uploadCustomerFolderFiles(
        customer.kode_unik,
        selectedFolder,
        encodedFiles
      );
      setMediaList(res.media || []);
      setStatusNote(
        `Berhasil mengunggah ${res.savedCount} file ke folder ${selectedFolder}.`
      );
    } catch (err) {
      setStatusNote(
        err instanceof Error ? err.message : 'Gagal mengunggah file.'
      );
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleSeedSamples = async () => {
    setUploading(true);
    setStatusNote('');
    try {
      const res = await seedCustomerSamplePhotos(customer.kode_unik);
      setMediaList(res.media || []);
      setStatusNote(
        'Foto sampel studio berhasil ditambahkan ke folder ALL FILE & LIHAT EDITAN untuk pengujian.'
      );
    } catch (err) {
      setStatusNote(
        err instanceof Error ? err.message : 'Gagal memuat foto sampel.'
      );
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteFile = async (filename: string) => {
    try {
      const res = await deleteCustomerFolderFile(
        customer.kode_unik,
        selectedFolder,
        filename
      );
      setMediaList(res.media || []);
    } catch {}
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-[#2A201B]/60 backdrop-blur-xs flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="detail-modal-title"
    >
      <div className="bg-white border border-[#E6DDD0] rounded-2xl max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden shadow-xl">
        {/* Header */}
        <div className="px-6 py-4 bg-[#FAF7F2] border-b border-[#E6DDD0] flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <h3
                id="detail-modal-title"
                className="font-serif text-2xl font-semibold text-[#2A201B]"
              >
                {customer.nama_customer}
              </h3>
              <span className="font-mono text-xs font-semibold text-[#8C6B30] bg-white border border-[#E6DDD0] px-2.5 py-0.5 rounded">
                {customer.kode_unik}
              </span>
            </div>
            <p className="text-xs text-[#5E534B] mt-0.5">
              {customer.jenis_layanan} · {customer.paket} · Marketing:{' '}
              {customer.nama_marketing || '-'} · WA: {customer.whatsapp || '-'}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onOpenWhatsApp(customer)}
              className="px-3.5 py-2 rounded-lg bg-[#1F6E43] text-white text-xs font-medium inline-flex items-center gap-1.5 hover:bg-[#175533] cursor-pointer"
            >
              <MessageCircle className="w-3.5 h-3.5" />
              <span>WhatsApp</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Tutup detail customer"
              className="w-9 h-9 rounded-lg flex items-center justify-center text-[#5E534B] hover:bg-[#E6DDD0]/50 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Link & Folder Bar */}
        <div className="px-6 py-3 bg-[#F3ECE1]/60 border-b border-[#E6DDD0] flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-[#5E534B] shrink-0">Link Customer:</span>
            <code className="font-mono text-[#2A201B] bg-white px-2.5 py-1 rounded border border-[#E6DDD0] truncate max-w-xs sm:max-w-md">
              {customerPortalLink}
            </code>
            <button
              type="button"
              onClick={handleCopyPortalLink}
              className="px-2.5 py-1 rounded border border-[#E6DDD0] bg-white text-[#8C6B30] hover:bg-[#FAF7F2] inline-flex items-center gap-1 cursor-pointer"
            >
              {copiedLink ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedLink ? 'Tersalin' : 'Salin'}</span>
            </button>
            <a
              href={`/c/${encodeURIComponent(customer.kode_unik)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-2.5 py-1 rounded border border-[#E6DDD0] bg-white text-[#2A201B] hover:bg-[#FAF7F2] inline-flex items-center gap-1"
            >
              <span>Buka Portal</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>

          {customer.drive_folder_url && (
            <a
              href={customer.drive_folder_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 font-medium text-[#8C6B30] hover:underline"
            >
              <FolderOpen className="w-4 h-4" />
              <span>Buka Folder Google Drive</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>

        {/* Milestone Dates & Quota Card (Auto from Sheets, DD-MM-YYYY format, Tanpa Tgl Pendaftaran) */}
        <div className="px-6 py-3.5 bg-[#FAF7F2] border-b border-[#E6DDD0] grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="bg-white p-2.5 rounded-lg border border-[#E6DDD0]">
            <span className="block text-[10px] uppercase font-semibold text-[#75655A] tracking-wider mb-0.5">
              Tgl Pemotretan
            </span>
            <span className="font-mono font-semibold text-[#2A201B] text-xs sm:text-sm">
              {formatDateDDMMYYYY(customer.tanggal_pemotretan)}
            </span>
          </div>

          <div className="bg-white p-2.5 rounded-lg border border-[#E6DDD0]">
            <span className="block text-[10px] uppercase font-semibold text-[#75655A] tracking-wider mb-0.5">
              Tgl Pemilihan Foto
            </span>
            <span className="font-mono font-semibold text-[#2A201B] text-xs sm:text-sm">
              {formatDateDDMMYYYY(customer.tanggal_pemilihan)}
            </span>
          </div>

          <div className="bg-white p-2.5 rounded-lg border border-[#E6DDD0]">
            <span className="block text-[10px] uppercase font-semibold text-[#75655A] tracking-wider mb-0.5">
              Estimasi Selesai
            </span>
            <span className="font-mono font-bold text-[#8C6B30] text-xs sm:text-sm">
              {formatDateDDMMYYYY(customer.estimasi_selesai)}
            </span>
          </div>

          <div className="bg-white p-2.5 rounded-lg border border-[#E6DDD0]">
            <span className="block text-[10px] uppercase font-semibold text-[#75655A] tracking-wider mb-0.5">
              Pesanan / Kuota
            </span>
            <span className="font-mono text-[#2A201B] text-xs">
              Alb: <strong>{customer.kuota_album}</strong> · Kanvas:{' '}
              <strong>{customer.kuota_kanvas}</strong> ({customer.ukuran_kanvas || '60x90'})
            </span>
          </div>
        </div>

        {/* Sub-Navigation Tabs */}
        <div className="px-6 border-b border-[#E6DDD0] flex items-center gap-2 bg-white">
          <button
            type="button"
            onClick={() => setActiveTab('FOLDER')}
            className={`px-4 py-3 text-xs font-medium border-b-2 cursor-pointer ${
              activeTab === 'FOLDER'
                ? 'border-[#8C6B30] text-[#8C6B30]'
                : 'border-transparent text-[#5E534B]'
            }`}
          >
            Folder &amp; File Foto ({mediaList.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('PILIHAN')}
            className={`px-4 py-3 text-xs font-medium border-b-2 cursor-pointer ${
              activeTab === 'PILIHAN'
                ? 'border-[#8C6B30] text-[#8C6B30]'
                : 'border-transparent text-[#5E534B]'
            }`}
          >
            Pilihan Foto Customer ({latestSubmission?.items.length || 0})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('REVISI')}
            className={`px-4 py-3 text-xs font-medium border-b-2 cursor-pointer ${
              activeTab === 'REVISI'
                ? 'border-[#8C6B30] text-[#8C6B30]'
                : 'border-transparent text-[#5E534B]'
            }`}
          >
            Anotasi &amp; Revisi ({customerRevisions.length})
          </button>
        </div>

        {/* Body Content */}
        <div className="p-6 overflow-y-auto flex-1 space-y-5">
          {activeTab === 'FOLDER' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-1.5">
                  {SUBFOLDERS.map((sub) => {
                    const cnt = mediaList.filter((m) => m.category === sub).length;
                    return (
                      <button
                        key={sub}
                        type="button"
                        onClick={() => setSelectedFolder(sub)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer tabular-nums ${
                          selectedFolder === sub
                            ? 'bg-[#2A201B] text-[#FAF7F2]'
                            : 'bg-[#FAF7F2] text-[#4A3B32] border border-[#E6DDD0]'
                        }`}
                      >
                        {sub} ({cnt})
                      </button>
                    );
                  })}
                </div>

                {!isGasConfigured && (
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#8C6B30] text-white text-xs font-medium hover:bg-[#755824] cursor-pointer">
                      <Upload className="w-3.5 h-3.5" />
                      <span>
                        {uploading ? 'Mengunggah...' : `Upload ke ${selectedFolder}`}
                      </span>
                      <input
                        type="file"
                        multiple
                        accept="image/*,video/*"
                        onChange={handleFileUpload}
                        className="sr-only"
                      />
                    </label>

                    <button
                      type="button"
                      disabled={uploading}
                      onClick={handleSeedSamples}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[#E6DDD0] bg-[#FAF7F2] text-xs font-medium text-[#2A201B] hover:bg-[#F3ECE1] cursor-pointer"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-[#8C6B30]" />
                      <span>Muat Foto Sampel Uji</span>
                    </button>
                  </div>
                )}
              </div>

              {statusNote && (
                <p className="text-xs font-medium text-[#1F6E43] bg-[#ECF7F0] px-3.5 py-2 rounded-lg">
                  {statusNote}
                </p>
              )}

              {loadingMedia ? (
                <p className="text-xs text-[#5E534B]">Membaca isi folder...</p>
              ) : folderMedia.length === 0 ? (
                <div className="p-8 rounded-xl border border-dashed border-[#E6DDD0] text-center space-y-2">
                  <ImagePlus className="w-7 h-7 text-[#8C6B30] mx-auto" />
                  <p className="text-sm font-medium text-[#2A201B]">
                    Folder {selectedFolder} masih kosong
                  </p>
                  <p className="text-xs text-[#5E534B]">
                    {isGasConfigured
                      ? 'Unggah foto langsung ke subfolder ini di Google Drive Anda.'
                      : 'Unggah foto dari komputer Anda ke folder ini atau klik "Muat Foto Sampel Uji" untuk mengisi folder pengujian.'}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {folderMedia.map((item) => (
                    <div
                      key={item.id}
                      className="border border-[#E6DDD0] rounded-lg overflow-hidden bg-[#FAF7F2]"
                    >
                      <div className="aspect-4/3 bg-[#F3ECE1]">
                        {item.mimeType.startsWith('video/') ? (
                          <video src={item.previewUrl} className="w-full h-full object-cover" />
                        ) : (
                          <img
                            src={item.thumbnailUrl}
                            alt={item.name}
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover"
                          />
                        )}
                      </div>
                      <div className="p-2 flex items-center justify-between gap-1">
                        <span className="font-mono text-[11px] text-[#2A201B] truncate">
                          {item.name}
                        </span>
                        {!isGasConfigured && (
                          <button
                            type="button"
                            onClick={() => handleDeleteFile(item.name)}
                            aria-label={`Hapus ${item.name}`}
                            className="p-1 text-[#9E2A2B] hover:bg-[#FDF0F0] rounded cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'PILIHAN' && (
            <div className="space-y-4">
              {!latestSubmission ? (
                <p className="text-sm text-[#5E534B]">
                  Customer belum mengirimkan pilihan foto final.
                </p>
              ) : (
                <>
                  <div className="p-4 rounded-xl bg-[#FAF7F2] border border-[#E6DDD0] flex flex-wrap items-center justify-between gap-3 text-xs">
                    <div>
                      <span className="text-[#5E534B]">Waktu Pengiriman: </span>
                      <strong className="font-mono">
                        {latestSubmission.waktu_pengiriman.slice(0, 16).replace('T', ' ')}
                      </strong>
                    </div>
                    <div>
                      <span className="text-[#5E534B]">Album: </span>
                      <strong>{latestSubmission.jumlah_album}</strong> ·{' '}
                      <span className="text-[#5E534B]">Kanvas: </span>
                      <strong>{latestSubmission.jumlah_kanvas}</strong> ·{' '}
                      <span className="text-[#5E534B]">Tambahan: </span>
                      <strong>{latestSubmission.jumlah_tambahan}</strong>
                    </div>
                  </div>

                  {latestSubmission.catatan_keseluruhan && (
                    <div className="p-3.5 rounded-lg bg-[#FDF5E6] border border-[#C6A464]/40 text-xs text-[#2A201B]">
                      <strong>Catatan Keseluruhan:</strong>{' '}
                      {latestSubmission.catatan_keseluruhan}
                    </div>
                  )}

                  <div className="border border-[#E6DDD0] rounded-xl divide-y divide-[#E6DDD0]">
                    {latestSubmission.items.map((item) => (
                      <div
                        key={item.file_id}
                        className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                      >
                        <div>
                          <p className="font-mono font-semibold text-[#2A201B]">
                            {item.file_name}
                          </p>
                          {item.catatan_edit && (
                            <p className="text-[#4A3B32] mt-0.5">
                              Catatan Edit: {item.catatan_edit}
                            </p>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-2 font-medium text-[#8C6B30]">
                          {item.pilih_album && <span>ALBUM</span>}
                          {item.pilih_kanvas && <span>KANVAS</span>}
                          {item.pilih_tambahan && <span>FOTO TAMBAHAN</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {activeTab === 'REVISI' && (
            <div className="space-y-4">
              {customerRevisions.length === 0 ? (
                <p className="text-sm text-[#5E534B]">
                  Belum ada catatan revisi atau konfirmasi persetujuan dari customer.
                </p>
              ) : (
                customerRevisions.map((fb) => (
                  <div
                    key={fb.id_feedback}
                    className="border border-[#E6DDD0] rounded-xl p-4 space-y-3 bg-[#FAF7F2]"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-[#2A201B]">
                        {fb.jenis_feedback === 'EDIT_APPROVAL'
                          ? 'Persetujuan Siap Cetak (SUDAH OK)'
                          : `Permintaan Revisi ke-${fb.revisi_ke || 1}`}
                      </span>
                      <span className="font-mono text-[#75655A]">
                        {fb.waktu_kirim.slice(0, 16).replace('T', ' ')}
                      </span>
                    </div>
                    {fb.catatan_umum && (
                      <p className="text-xs text-[#2A201B]">{fb.catatan_umum}</p>
                    )}
                    {fb.detail_revisi && fb.detail_revisi.length > 0 && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                        {fb.detail_revisi.map((det) => {
                          const matchedMedia = mediaList.find(
                            (m) => m.id === det.file_id || m.name === det.file_name
                          );
                          return (
                            <div
                              key={det.file_id}
                              className="bg-white border border-[#E6DDD0] rounded-lg p-3 space-y-2"
                            >
                              {matchedMedia && (
                                <div className="relative aspect-4/3 bg-[#F3ECE1] rounded overflow-hidden">
                                  <img
                                    src={matchedMedia.thumbnailUrl}
                                    alt={det.file_name}
                                    referrerPolicy="no-referrer"
                                    className="w-full h-full object-cover"
                                  />
                                  <svg
                                    viewBox="0 0 100 100"
                                    preserveAspectRatio="none"
                                    className="absolute inset-0 w-full h-full pointer-events-none"
                                  >
                                    {det.annotations.map((ann) =>
                                      ann.type === 'circle' ? (
                                        <ellipse
                                          key={ann.id}
                                          cx={ann.x}
                                          cy={ann.y}
                                          rx={ann.rx || 8}
                                          ry={ann.ry || 8}
                                          fill="rgba(225, 29, 72, 0.16)"
                                          stroke="#F43F5E"
                                          strokeWidth="1.3"
                                        />
                                      ) : (
                                        <circle
                                          key={ann.id}
                                          cx={ann.x}
                                          cy={ann.y}
                                          r="3.5"
                                          fill="#E11D48"
                                          stroke="#FFFFFF"
                                          strokeWidth="1"
                                        />
                                      )
                                    )}
                                  </svg>
                                </div>
                              )}
                              <p className="font-mono text-xs font-semibold text-[#2A201B]">
                                {det.file_name} ({det.annotations.length} tanda)
                              </p>
                              <p className="text-xs text-[#4A3B32]">
                                {det.catatan_revisi || 'Tidak ada catatan teks'}
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
