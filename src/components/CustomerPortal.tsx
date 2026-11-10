import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowDownAZ,
  ArrowUpZA,
  BookOpen,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  Download,
  ExternalLink,
  Eye,
  Film,
  FolderOpen,
  Home,
  Image as ImageIcon,
  Layers,
  Menu,
  MessageCircle,
  MessageSquareHeart,
  MessageSquarePlus,
  PenTool,
  Search,
  Send,
  Star,
  X,
  ZoomIn,
} from 'lucide-react';
import { LazyImage } from './LazyImage';
import type {
  CustomerPortalPayload,
  DriveMediaItem,
  DriveSubfolderCategory,
  PhotoRevisionDetail,
  PhotoSelectionItem,
  ProductionItemStatus,
} from '../types/studio';
import {
  downloadPhotosAsZip,
  fetchCustomerPhotos,
  fetchCustomerPortal,
  saveCustomerDraftSelections,
  submitCustomerFeedback,
  submitCustomerSelections,
} from '../utils/apiClient';
import {
  applyPhotoSelectionToggle,
  calculateRetentionStatus,
  calculateVideoRetentionStatus,
  evaluateSelectionQuotas,
  filterMediaBySearchAndSelection,
  formatDateDDMMYYYY,
  formatDateIndonesian,
  formatInternationalWhatsApp,
  isFolderDownloadAllowed,
  sortMediaNaturally,
} from '../utils/studioLogic';
import { BrandMark } from './BrandMark';
import { PanduanView } from './PanduanView';
import { PhotoLightboxModal } from './PhotoLightboxModal';

type CustomerMainTab =
  | 'BERANDA'
  | 'PILIH_FOTO'
  | 'LIHAT_EDITAN'
  | 'REVISI'
  | 'VIDEO'
  | 'STATUS_PEKERJAAN'
  | 'PANDUAN'
  | 'KRITIK_SARAN';

interface CustomerPortalProps {
  kodeUnik: string;
  onNotFound: (code: string) => void;
}

const FOLDER_SUBTABS: Array<{ key: DriveSubfolderCategory; label: string }> = [
  { key: 'ALL FILE', label: '1. PILIHAN FOTO (ALL FILE)' },
  { key: 'RINGKASAN', label: '2. RINGKASAN' },
  { key: 'LIHAT EDITAN', label: '3. LIHAT EDITAN' },
  { key: 'REVISI', label: '4. REVISI' },
  { key: 'VIDEO', label: '5. VIDEO' },
];

const ALBUM_PIPELINE_STEPS = [
  'Pilihan foto diterima',
  'Editing',
  'Lihat editan',
  'Persetujuan',
  'Cetak',
  'Selesai',
];

const KANVAS_PIPELINE_STEPS = [
  'Pilihan foto diterima',
  'Editing',
  'Persetujuan',
  'Cetak',
  'Selesai',
];

function getAlbumStepIndex(
  statusAlbum: ProductionItemStatus,
  workflowStatus: string
): number {
  if (statusAlbum === 'TIDAK PAKAI') return -1;
  if (statusAlbum === 'SUDAH JADI' || workflowStatus === 'SELESAI') return 5;
  if (statusAlbum === 'PROSES CETAK' || statusAlbum === 'CETAK') return 4;
  if (workflowStatus === 'PROSES_CETAK') return 3;
  if (
    statusAlbum === 'LIHAT EDITAN' ||
    workflowStatus === 'MENUNGGU_PERSETUJUAN' ||
    workflowStatus === 'BUTUH_REVISI'
  ) {
    return 2;
  }
  if (statusAlbum === 'SEDANG DIPROSES' || workflowStatus === 'SEDANG_EDITING') {
    return 1;
  }
  if (workflowStatus === 'SUDAH_KIRIM_PILIHAN') return 0;
  return -1;
}

function getKanvasStepIndex(
  statusKanvas: ProductionItemStatus,
  workflowStatus: string
): number {
  if (statusKanvas === 'TIDAK PAKAI') return -1;
  if (statusKanvas === 'SUDAH JADI' || workflowStatus === 'SELESAI') return 4;
  if (statusKanvas === 'PROSES CETAK' || statusKanvas === 'CETAK') return 3;
  if (workflowStatus === 'PROSES_CETAK') return 2;
  if (
    statusKanvas === 'SEDANG DIPROSES' ||
    statusKanvas === 'LIHAT EDITAN' ||
    workflowStatus === 'SEDANG_EDITING' ||
    workflowStatus === 'MENUNGGU_PERSETUJUAN'
  ) {
    return 1;
  }
  if (workflowStatus === 'SUDAH_KIRIM_PILIHAN') return 0;
  return -1;
}

export const CustomerPortal: React.FC<CustomerPortalProps> = ({
  kodeUnik,
  onNotFound,
}) => {
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [portalData, setPortalData] = useState<CustomerPortalPayload | null>(null);
  const [mediaList, setMediaList] = useState<DriveMediaItem[]>([]);

  // Navigation state
  const [activeTab, setActiveTab] = useState<CustomerMainTab>('BERANDA');
  const [activeFolderTab, setActiveFolderTab] =
    useState<DriveSubfolderCategory>('ALL FILE');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Unified Selection State (never lost when switching categories, searching, or opening lightbox)
  const [selectionMap, setSelectionMap] = useState<Record<string, PhotoSelectionItem>>({});
  const [overallEditNote, setOverallEditNote] = useState('');
  const [openNoteFileIds, setOpenNoteFileIds] = useState<Record<string, boolean>>({});

  // Gallery Filter & Sort State
  const [searchQuery, setSearchQuery] = useState('');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [selectionFilter, setSelectionFilter] = useState<
    'ALL' | 'ALBUM' | 'KANVAS' | 'TAMBAHAN' | 'NOTES'
  >('ALL');

  // Lightbox State
  const [lightboxState, setLightboxState] = useState<{
    mode: 'selection' | 'revision';
    items: DriveMediaItem[];
    index: number;
  } | null>(null);

  // Submission Confirmation Modal State
  const [confirmSubmitOpen, setConfirmSubmitOpen] = useState(false);
  const [confirmChecked, setConfirmChecked] = useState(false);
  const [submittingSelections, setSubmittingSelections] = useState(false);
  const [submitSuccessInfo, setSubmitSuccessInfo] = useState<{
    estimasi_selesai: string;
    waktu_pengiriman: string;
  } | null>(null);

  // Revision & Edit Approval State
  const [revisionMap, setRevisionMap] = useState<Record<string, PhotoRevisionDetail>>({});
  const [revisionModalOpen, setRevisionModalOpen] = useState(false);
  const [revisionOverallNote, setRevisionOverallNote] = useState('');
  const [approvalModalOpen, setApprovalModalOpen] = useState(false);
  const [submittingRevision, setSubmittingRevision] = useState(false);
  const [revisionSuccessMsg, setRevisionSuccessMsg] = useState('');

  // ZIP Download Progress State
  const [zipProgress, setZipProgress] = useState<{
    active: boolean;
    percent: number;
    processed: number;
    total: number;
    statusText: string;
    error?: string;
  } | null>(null);

  // Kritik & Saran State
  const [feedbackRating, setFeedbackRating] = useState(5);
  const [feedbackCategory, setFeedbackCategory] = useState('Pelayanan Studio & Fotografer');
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const [submittingFeedback, setSubmittingFeedback] = useState(false);
  const [feedbackSuccess, setFeedbackSuccess] = useState(false);

  // Periodic time state for dynamic retention countdown
  const [currentTime, setCurrentTime] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 30000);
    return () => clearInterval(timer);
  }, []);

  const draftSyncTimerRef = useRef<number | null>(null);
  const localDraftKey = `lb_draft_${kodeUnik.toUpperCase()}`;

  const loadPortalData = useCallback(async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const portalRes = await fetchCustomerPortal(kodeUnik);
      const photosRes = await fetchCustomerPhotos(kodeUnik);

      setPortalData({
        customer: portalRes.customer,
        studio: portalRes.studio,
        draftSelections: portalRes.draftSelections,
        draftOverallNote: portalRes.draftOverallNote,
        submissions: portalRes.submissions,
        feedbacks: portalRes.feedbacks,
        logs: portalRes.logs,
      });
      setMediaList(photosRes.media || []);

      // Reconcile server draft/submission with sessionStorage backup
      const nextMap: Record<string, PhotoSelectionItem> = {};
      for (const item of portalRes.draftSelections || []) {
        nextMap[item.file_id] = item;
      }
      let nextNote = portalRes.draftOverallNote || '';

      try {
        const cachedRaw = sessionStorage.getItem(localDraftKey);
        if (cachedRaw && Object.keys(nextMap).length === 0) {
          const cached = JSON.parse(cachedRaw) as {
            map?: Record<string, PhotoSelectionItem>;
            note?: string;
          };
          if (cached.map) {
            Object.assign(nextMap, cached.map);
          }
          if (cached.note && !nextNote) {
            nextNote = cached.note;
          }
        }
      } catch {
        // Ignore sessionStorage read errors
      }

      setSelectionMap(nextMap);
      setOverallEditNote(nextNote);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Gagal memuat data customer.';
      const errName = err instanceof Error ? err.name : '';
      if (
        errName === 'NotFoundError' ||
        msg.toLowerCase().includes('tidak ditemukan') ||
        msg.includes('404')
      ) {
        onNotFound(kodeUnik);
        return;
      }
      setErrorMsg(msg);
    } finally {
      setLoading(false);
    }
  }, [kodeUnik, localDraftKey, onNotFound]);

  useEffect(() => {
    loadPortalData();
  }, [loadPortalData]);

  // Persist draft selections safely in sessionStorage and sync to backend
  const persistDraftState = useCallback(
    (nextMap: Record<string, PhotoSelectionItem>, nextNote: string) => {
      try {
        sessionStorage.setItem(
          localDraftKey,
          JSON.stringify({ map: nextMap, note: nextNote })
        );
      } catch {
        // Ignore storage quota errors
      }

      if (draftSyncTimerRef.current) {
        window.clearTimeout(draftSyncTimerRef.current);
      }
      draftSyncTimerRef.current = window.setTimeout(() => {
        const activeItems = Object.values(nextMap).filter(
          (i) =>
            i.pilih_album ||
            i.pilih_kanvas ||
            i.pilih_tambahan ||
            i.catatan_edit.trim().length > 0
        );
        saveCustomerDraftSelections(kodeUnik, activeItems, nextNote).catch(() => {});
      }, 600);
    },
    [kodeUnik, localDraftKey]
  );

  const handleToggleSelection = (
    file: DriveMediaItem,
    field: 'pilih_album' | 'pilih_kanvas' | 'pilih_tambahan'
  ) => {
    setSelectionMap((prev) => {
      const updatedItem = applyPhotoSelectionToggle(prev[file.id], file, field);
      const next = { ...prev, [file.id]: updatedItem };
      persistDraftState(next, overallEditNote);
      return next;
    });
  };

  const handleUpdateSelectionNote = (file: DriveMediaItem, note: string) => {
    setSelectionMap((prev) => {
      const existing: PhotoSelectionItem = prev[file.id] || {
        file_id: file.id,
        file_name: file.name,
        pilih_album: false,
        pilih_kanvas: false,
        pilih_tambahan: false,
        catatan_edit: '',
      };
      const next = {
        ...prev,
        [file.id]: { ...existing, catatan_edit: note },
      };
      persistDraftState(next, overallEditNote);
      return next;
    });
  };

  const handleOverallNoteChange = (val: string) => {
    setOverallEditNote(val);
    persistDraftState(selectionMap, val);
  };

  const selectionItemsArray = useMemo(
    () => Object.values(selectionMap),
    [selectionMap]
  );

  const quotaSummary = useMemo(() => {
    if (!portalData) {
      return evaluateSelectionQuotas([], 0, 0);
    }
    return evaluateSelectionQuotas(
      selectionItemsArray,
      portalData.customer.kuota_album,
      portalData.customer.kuota_kanvas
    );
  }, [selectionItemsArray, portalData]);

  // Filtered & naturally sorted media for active folder sub-tab
  const activeFolderMedia = useMemo(() => {
    const byFolder = mediaList.filter((m) => m.category === activeFolderTab);
    const filtered = filterMediaBySearchAndSelection(
      byFolder,
      searchQuery,
      selectionFilter,
      selectionMap
    );
    return sortMediaNaturally(filtered, sortDirection);
  }, [mediaList, activeFolderTab, searchQuery, selectionFilter, selectionMap, sortDirection]);

  const editanMedia = useMemo(
    () =>
      sortMediaNaturally(
        mediaList.filter((m) => m.category === 'LIHAT EDITAN'),
        'asc'
      ),
    [mediaList]
  );

  const revisiMedia = useMemo(
    () =>
      sortMediaNaturally(
        mediaList.filter((m) => m.category === 'REVISI'),
        'asc'
      ),
    [mediaList]
  );

  const videoMedia = useMemo(
    () =>
      sortMediaNaturally(
        mediaList.filter((m) => m.category === 'VIDEO'),
        'asc'
      ),
    [mediaList]
  );

  const selectedSummaryItems = useMemo(
    () =>
      selectionItemsArray.filter(
        (i) =>
          i.pilih_album ||
          i.pilih_kanvas ||
          i.pilih_tambahan ||
          i.tebus_file !== 'TIDAK_TEBUS' ||
          i.catatan_edit.trim().length > 0
      ),
    [selectionItemsArray]
  );

  const handleConfirmSubmitSelections = async () => {
    if (!portalData || !confirmChecked || !quotaSummary.canSubmit) return;
    setSubmittingSelections(true);
    setErrorMsg('');
    try {
      const res = await submitCustomerSelections(
        portalData.customer.kode_unik,
        selectedSummaryItems,
        overallEditNote
      );
      try {
        sessionStorage.removeItem(localDraftKey);
      } catch {}
      setConfirmSubmitOpen(false);
      setConfirmChecked(false);
      setSubmitSuccessInfo({
        estimasi_selesai: res.estimasi_selesai,
        waktu_pengiriman: res.waktu_pengiriman,
      });
      await loadPortalData();
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Gagal mengirimkan pilihan foto.'
      );
    } finally {
      setSubmittingSelections(false);
    }
  };

  const handleDownloadFolderZip = async (category: DriveSubfolderCategory) => {
    if (!portalData) return;
    const allowed = isFolderDownloadAllowed(
      category,
      portalData.customer,
      portalData.studio
    );
    if (!allowed) {
      setZipProgress({
        active: false,
        percent: 0,
        processed: 0,
        total: 0,
        statusText: '',
        error: `Akses unduhan untuk folder ${category} belum diizinkan oleh admin studio.`,
      });
      return;
    }

    const itemsToZip = mediaList.filter((m) => m.category === category);
    if (itemsToZip.length === 0) {
      setZipProgress({
        active: false,
        percent: 0,
        processed: 0,
        total: 0,
        statusText: '',
        error: `Belum ada file di folder ${category} untuk diunduh.`,
      });
      return;
    }

    setZipProgress({
      active: true,
      percent: 5,
      processed: 0,
      total: itemsToZip.length,
      statusText: `Menyiapkan ${itemsToZip.length} file dari ${category}...`,
    });

    try {
      await downloadPhotosAsZip(
        portalData.customer.kode_unik,
        category,
        itemsToZip,
        (state) => {
          setZipProgress({
            active: state.percent < 100,
            ...state,
          });
        }
      );
    } catch (err) {
      setZipProgress({
        active: false,
        percent: 0,
        processed: 0,
        total: itemsToZip.length,
        statusText: '',
        error:
          err instanceof Error
            ? err.message
            : 'Terjadi kegagalan saat mengemas file ZIP.',
      });
    }
  };

  const handleSaveRevisionDetail = (detail: PhotoRevisionDetail) => {
    setRevisionMap((prev) => ({
      ...prev,
      [detail.file_id]: detail,
    }));
  };

  const activeRevisionDetails = useMemo(
    () =>
      Object.values(revisionMap).filter(
        (r) => r.annotations.length > 0 || r.catatan_revisi.trim().length > 0
      ),
    [revisionMap]
  );

  const handleApproveEdits = async () => {
    if (!portalData) return;
    setSubmittingRevision(true);
    setErrorMsg('');
    try {
      await submitCustomerFeedback({
        kode_unik: portalData.customer.kode_unik,
        jenis_feedback: 'EDIT_APPROVAL',
        catatan_umum: 'Customer menyetujui hasil editan (SUDAH OK / SIAP CETAK).',
      });
      setApprovalModalOpen(false);
      setRevisionSuccessMsg(
        'Terima kasih! Persetujuan hasil editan Anda telah diterima dan pekerjaan diteruskan ke proses cetak.'
      );
      await loadPortalData();
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Gagal mengirim persetujuan editan.'
      );
    } finally {
      setSubmittingRevision(false);
    }
  };

  const handleSubmitRevisionRequest = async () => {
    if (!portalData) return;
    setSubmittingRevision(true);
    setErrorMsg('');
    try {
      const res = await submitCustomerFeedback({
        kode_unik: portalData.customer.kode_unik,
        jenis_feedback: 'REVISION_REQUEST',
        catatan_umum: revisionOverallNote,
        detail_revisi: activeRevisionDetails,
      });
      setRevisionModalOpen(false);
      setRevisionSuccessMsg(
        `Permintaan revisi ke-${res.revisi_ke || portalData.customer.jumlah_revisi + 1} berhasil dikirimkan ke tim editor LOUIS BRIDES.`
      );
      await loadPortalData();
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Gagal mengirim permintaan revisi.'
      );
    } finally {
      setSubmittingRevision(false);
    }
  };

  const handleSubmitCriticFeedback = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!portalData || !feedbackMessage.trim()) return;
    setSubmittingFeedback(true);
    setErrorMsg('');
    try {
      await submitCustomerFeedback({
        kode_unik: portalData.customer.kode_unik,
        jenis_feedback: 'CRITIC_SUGGESTION',
        rating: feedbackRating,
        kategori_masukan: feedbackCategory,
        catatan_umum: feedbackMessage.trim(),
      });
      setFeedbackSuccess(true);
      setFeedbackMessage('');
      await loadPortalData();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Gagal mengirim kritik dan saran.');
    } finally {
      setSubmittingFeedback(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAF7F2] flex flex-col items-center justify-center p-6 text-center space-y-3">
        <BrandMark size="lg" />
        <p className="text-sm text-[#5E534B]">
          Memuat galeri dan data pesanan Anda...
        </p>
      </div>
    );
  }

  if (!portalData) {
    return (
      <div className="min-h-screen bg-[#FAF7F2] flex flex-col items-center justify-center p-6 text-center space-y-4">
        <BrandMark size="lg" />
        <p className="text-sm text-[#9E2A2B]">{errorMsg || 'Data customer tidak tersedia.'}</p>
        <button
          type="button"
          onClick={loadPortalData}
          className="px-5 py-2.5 rounded-lg bg-[#2A201B] text-[#FAF7F2] text-sm font-medium cursor-pointer"
        >
          Coba Muat Ulang
        </button>
      </div>
    );
  }

  const { customer, studio, submissions, feedbacks, logs } = portalData;
  const retention = calculateRetentionStatus(customer.created_at);
  const albumStepIdx = getAlbumStepIndex(
    customer.status_album,
    customer.status_pekerjaan
  );
  const kanvasStepIdx = getKanvasStepIndex(
    customer.status_kanvas,
    customer.status_pekerjaan
  );

  const studioWaDigits = formatInternationalWhatsApp(studio.whatsapp_studio);
  const managementWaHref = studioWaDigits
    ? `https://wa.me/${studioWaDigits}?text=${encodeURIComponent(
        `Halo Manajemen ${studio.nama_studio}, saya ${customer.nama_customer} (${customer.kode_unik}) ingin menyampaikan masukan:\n\nRating: ${feedbackRating}/5 Bintang\nKategori: ${feedbackCategory}\nPesan: ${feedbackMessage}`
      )}`
    : '#';

  const revisionWaHref = studioWaDigits
    ? `https://wa.me/${studioWaDigits}?text=${encodeURIComponent(
        `Halo Tim Editor ${studio.nama_studio} (${customer.nama_marketing}), saya ${customer.nama_customer} (Kode: ${customer.kode_unik}) baru saja mengirimkan permintaan revisi foto melalui portal. Mohon dicek ya, terima kasih!`
      )}`
    : '#';

  const renderQuotaStateLabel = (state: 'BELUM_TERPENUHI' | 'SUDAH_TERPENUHI' | 'MELEBIHI_KUOTA') => {
    if (state === 'SUDAH_TERPENUHI') {
      return (
        <span className="text-xs font-medium text-[#1F6E43] whitespace-nowrap shrink-0">
          Sudah Terpenuhi
        </span>
      );
    }
    if (state === 'MELEBIHI_KUOTA') {
      return (
        <span className="text-xs font-medium text-[#9E2A2B] whitespace-nowrap shrink-0">
          Melebihi Kuota
        </span>
      );
    }
    return (
      <span className="text-xs font-medium text-[#9A5B13] whitespace-nowrap shrink-0">
        Belum Terpenuhi
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-[#FAF7F2] text-[#2A201B] pb-20 md:pb-10 flex flex-col overflow-x-clip">
      {/* Customer Header */}
      <header className="bg-white border-b border-[#E6DDD0]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center justify-between gap-4">
            <BrandMark
              studioName={studio.nama_studio}
              logoUrl={studio.logo_url}
              size="sm"
            />
            <span className="sm:hidden font-mono text-xs font-semibold text-[#8C6B30] bg-[#FAF7F2] border border-[#E6DDD0] px-2.5 py-1 rounded">
              {customer.kode_unik}
            </span>
          </div>

          <div className="sm:text-right space-y-0.5">
            <div className="flex flex-wrap sm:justify-end items-center gap-x-2.5 gap-y-1">
              <h1 className="font-serif text-xl sm:text-2xl font-semibold text-[#2A201B]">
                {customer.nama_customer}
              </h1>
              {customer.nama_keluarga && (
                <span className="text-xs text-[#5E534B]">
                  ({customer.nama_keluarga})
                </span>
              )}
              <span className="hidden sm:inline-block font-mono text-xs font-semibold text-[#8C6B30] bg-[#FAF7F2] border border-[#E6DDD0] px-2.5 py-0.5 rounded">
                {customer.kode_unik}
              </span>
            </div>
            <p className="text-xs text-[#5E534B] tabular-nums">
              {customer.paket} · {customer.jenis_layanan} · Kuota: {customer.kuota_album} Album ·{' '}
              {customer.kuota_kanvas} Kanvas ({customer.ukuran_kanvas})
            </p>
          </div>
        </div>

        {/* Desktop Single-Row Tab Bar */}
        <nav
          aria-label="Navigasi Portal Customer"
          className="hidden md:block border-t border-[#E6DDD0] bg-[#FAF7F2]"
        >
          <div className="max-w-6xl mx-auto px-4 sm:px-6 flex items-center gap-1 overflow-x-auto">
            {(
              [
                { key: 'BERANDA', label: 'BERANDA' },
                { key: 'PILIH_FOTO', label: 'PILIH FOTO' },
                { key: 'LIHAT_EDITAN', label: 'LIHAT EDITAN' },
                { key: 'REVISI', label: 'REVISI' },
                { key: 'VIDEO', label: 'VIDEO' },
                { key: 'STATUS_PEKERJAAN', label: 'STATUS PEKERJAAN' },
                { key: 'PANDUAN', label: 'PANDUAN' },
                { key: 'KRITIK_SARAN', label: 'KRITIK & SARAN' },
              ] as Array<{ key: CustomerMainTab; label: string }>
            ).map((tab) => {
              const active = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
                  className={`px-4 py-3 text-xs font-medium tracking-wider border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    active
                      ? 'border-[#8C6B30] text-[#8C6B30] bg-white'
                      : 'border-transparent text-[#5E534B] hover:text-[#2A201B]'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </nav>
      </header>

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Global Error Banner */}
        {errorMsg && (
          <div
            role="alert"
            className="bg-[#FDF0F0] border border-[#9E2A2B]/30 rounded-xl p-4 flex items-start justify-between gap-3 text-xs sm:text-sm text-[#9E2A2B]"
          >
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
            <button
              type="button"
              onClick={() => setErrorMsg('')}
              aria-label="Tutup pesan error"
              className="p-1 hover:bg-[#9E2A2B]/10 rounded cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* 1-Month (30-Day) Retention Banner (Section 9) */}
        {(activeTab === 'BERANDA' || activeTab === 'PILIH_FOTO') && (
          <section
            aria-label="Pemberitahuan Retensi 1 Bulan"
            className="bg-[#FDF5E6] border border-[#C6A464]/50 rounded-xl p-4 sm:p-5 space-y-1.5"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-[#8C6B30]">
                <Clock className="w-4 h-4 shrink-0" />
                <h2 className="text-xs sm:text-sm font-semibold uppercase tracking-wide text-[#2A201B]">
                  Pemberitahuan Retensi: Segera Download &amp; Selesaikan Pilihan Foto
                </h2>
              </div>
              <span className="font-mono text-xs font-semibold text-[#8C6B30] tabular-nums">
                {retention.isExpired
                  ? 'Masa retensi 30 hari berakhir'
                  : `Sisa ${retention.daysRemaining} hari (batas: ${retention.expiryDateStr})`}
              </span>
            </div>
            <p className="text-xs sm:text-sm text-[#4A3B32] leading-relaxed">
              Seluruh file foto pada tab &apos;1. PILIHAN FOTO (ALL FILE)&apos; memiliki batas
              penyimpanan aktif selama 1 bulan (30 hari) sejak tanggal dibuat. Harap segera unduh
              (download) seluruh foto ke perangkat pribadi dan selesaikan pemilihan foto album &amp;
              kanvas sebelum file di Google Drive dihapus permanen oleh tim studio.
            </p>
          </section>
        )}

        {/* ZIP Download Progress Banner */}
        {zipProgress && (
          <section className="bg-white border border-[#E6DDD0] rounded-xl p-4 space-y-2">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm font-medium text-[#2A201B]">
                <Download className="w-4 h-4 text-[#8C6B30]" />
                <span>
                  {zipProgress.error
                    ? 'Unduhan ZIP Gagal'
                    : zipProgress.statusText || 'Mengunduh Arsip ZIP'}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-mono text-xs text-[#5E534B] tabular-nums">
                  {zipProgress.processed}/{zipProgress.total} file ({zipProgress.percent}%)
                </span>
                {!zipProgress.active && (
                  <button
                    type="button"
                    onClick={() => setZipProgress(null)}
                    aria-label="Tutup status unduhan"
                    className="p-1 text-[#5E534B] hover:text-[#2A201B] cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
            {zipProgress.error ? (
              <p className="text-xs text-[#9E2A2B]">{zipProgress.error}</p>
            ) : (
              <div className="w-full h-2 rounded-full bg-[#F3ECE1] overflow-hidden">
                <div
                  className="h-full bg-[#8C6B30] transition-all duration-150"
                  style={{ width: `${zipProgress.percent}%` }}
                />
              </div>
            )}
          </section>
        )}

        {/* TAB 1: BERANDA */}
        {activeTab === 'BERANDA' && (
          <div className="space-y-6">
            {/* Greeting & Order Summary Card */}
            <section className="bg-white border border-[#E6DDD0] rounded-xl p-6 sm:p-8 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[#E6DDD0] pb-5">
                <div className="space-y-1">
                  <p className="text-xs font-medium uppercase tracking-[0.18em] text-[#8C6B30]">
                    Selamat Datang di Portal Pelanggan
                  </p>
                  <h2 className="font-serif text-2xl sm:text-3xl font-semibold text-[#2A201B]">
                    Halo, Kak {customer.nama_customer} 👋
                  </h2>
                  <p className="text-sm text-[#5E534B]">
                    Paket: <strong>{customer.paket}</strong> · Layanan:{' '}
                    <strong>{customer.jenis_layanan}</strong> · Marketing:{' '}
                    <strong>{customer.nama_marketing || '-'}</strong>
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('PILIH_FOTO');
                    setActiveFolderTab('ALL FILE');
                  }}
                  className="min-h-[46px] px-6 py-2.5 rounded-lg bg-[#2A201B] text-[#FAF7F2] text-sm font-medium hover:bg-[#3F312A] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Mulai Pilih Foto
                </button>
              </div>

              {/* Key Order & Status Metrics Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-4 rounded-xl bg-[#FAF7F2] border border-[#E6DDD0] space-y-1">
                  <p className="text-xs text-[#75655A]">Kuota &amp; Pilihan Album</p>
                  <p className="font-mono text-xl font-semibold text-[#2A201B] tabular-nums">
                    {quotaSummary.albumSelected} / {customer.kuota_album} foto
                  </p>
                  <p className="text-xs text-[#5E534B]">
                    Status: <strong>{customer.status_album}</strong>
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-[#FAF7F2] border border-[#E6DDD0] space-y-1">
                  <p className="text-xs text-[#75655A]">
                    Kuota &amp; Pilihan Kanvas ({customer.ukuran_kanvas})
                  </p>
                  <p className="font-mono text-xl font-semibold text-[#2A201B] tabular-nums">
                    {quotaSummary.kanvasSelected} / {customer.kuota_kanvas} foto
                  </p>
                  <p className="text-xs text-[#5E534B]">
                    Status: <strong>{customer.status_kanvas}</strong>
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-[#FAF7F2] border border-[#E6DDD0] space-y-1">
                  <p className="text-xs text-[#75655A]">Estimasi Penyelesaian</p>
                  <p className="font-mono text-lg font-semibold text-[#2A201B] tabular-nums">
                    {customer.estimasi_selesai
                      ? formatDateDDMMYYYY(customer.estimasi_selesai)
                      : 'Menunggu Kirim Pilihan'}
                  </p>
                  <p className="text-xs text-[#5E534B]">
                    2 bulan kalender sejak kirim pilihan
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-[#FAF7F2] border border-[#E6DDD0] space-y-1">
                  <p className="text-xs text-[#75655A]">Total File Tersedia</p>
                  <p className="font-mono text-xl font-semibold text-[#2A201B] tabular-nums">
                    {mediaList.length} file
                  </p>
                  <p className="text-xs text-[#5E534B]">
                    Revisi digunakan: {customer.jumlah_revisi}/{studio.batas_revisi}
                  </p>
                </div>
              </div>

              {/* Admin Notes / Info */}
              {customer.catatan_customer && (
                <div className="p-4 rounded-xl bg-[#F3ECE1] border border-[#E6DDD0] space-y-1">
                  <p className="text-xs font-semibold uppercase tracking-wider text-[#8C6B30]">
                    Informasi dari Studio
                  </p>
                  <p className="text-sm text-[#2A201B] leading-relaxed">
                    {customer.catatan_customer}
                  </p>
                </div>
              )}
            </section>

            {/* Quick Navigation Cards */}
            <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <button
                type="button"
                onClick={() => {
                  setActiveTab('PILIH_FOTO');
                  setActiveFolderTab('ALL FILE');
                }}
                className="text-left bg-white border border-[#E6DDD0] hover:border-[#8C6B30] rounded-xl p-5 space-y-2 transition-colors cursor-pointer"
              >
                <ImageIcon className="w-5 h-5 text-[#8C6B30]" />
                <h3 className="font-serif text-lg font-semibold text-[#2A201B]">
                  1. Pilih Foto &amp; Catatan
                </h3>
                <p className="text-xs text-[#5E534B]">
                  Buka galeri foto asli, perbesar detail, dan pilih foto Album serta Kanvas.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('LIHAT_EDITAN')}
                className="text-left bg-white border border-[#E6DDD0] hover:border-[#8C6B30] rounded-xl p-5 space-y-2 transition-colors cursor-pointer"
              >
                <Eye className="w-5 h-5 text-[#8C6B30]" />
                <h3 className="font-serif text-lg font-semibold text-[#2A201B]">
                  2. Lihat Editan &amp; Revisi
                </h3>
                <p className="text-xs text-[#5E534B]">
                  Periksa hasil editan, tandai bagian revisi, atau setujui untuk cetak.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('STATUS_PEKERJAAN')}
                className="text-left bg-white border border-[#E6DDD0] hover:border-[#8C6B30] rounded-xl p-5 space-y-2 transition-colors cursor-pointer"
              >
                <Layers className="w-5 h-5 text-[#8C6B30]" />
                <h3 className="font-serif text-lg font-semibold text-[#2A201B]">
                  3. Status Produksi
                </h3>
                <p className="text-xs text-[#5E534B]">
                  Pantau tahapan pengerjaan Album dan Kanvas secara real-time.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('PANDUAN')}
                className="text-left bg-white border border-[#E6DDD0] hover:border-[#8C6B30] rounded-xl p-5 space-y-2 transition-colors cursor-pointer"
              >
                <BookOpen className="w-5 h-5 text-[#8C6B30]" />
                <h3 className="font-serif text-lg font-semibold text-[#2A201B]">
                  4. Panduan Lengkap
                </h3>
                <p className="text-xs text-[#5E534B]">
                  Pelajari cara memilih foto, memberi tanda lingkaran/pin, dan unduh ZIP.
                </p>
              </button>
            </section>
          </div>
        )}

        {/* TAB 2: PILIH FOTO */}
        {activeTab === 'PILIH_FOTO' && (
          <div className="space-y-6">
            {/* Submission Success Banner */}
            {submitSuccessInfo && (
              <div className="bg-[#ECF7F0] border border-[#1F6E43]/30 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-[#1F6E43] shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <h3 className="font-serif text-lg font-semibold text-[#2A201B]">
                      Pilihan Foto Berhasil Dikirimkan!
                    </h3>
                    <p className="text-xs sm:text-sm text-[#4A3B32]">
                      Pilihan Anda telah tersimpan ke database studio. Estimasi penyelesaian
                      otomatis (2 bulan kalender):{' '}
                      <strong className="font-mono">
                        {submitSuccessInfo.estimasi_selesai}
                      </strong>
                      .
                    </p>
                  </div>
                </div>
                {studioWaDigits && (
                  <a
                    href={`https://wa.me/${studioWaDigits}?text=${encodeURIComponent(
                      `Halo Tim ${studio.nama_studio} (${customer.nama_marketing}), saya ${customer.nama_customer} (Kode: ${customer.kode_unik}) telah mengirimkan pilihan foto di portal. Estimasi selesai: ${submitSuccessInfo.estimasi_selesai}.`
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#1F6E43] text-white text-xs font-medium hover:bg-[#175533] whitespace-nowrap shrink-0"
                  >
                    <MessageCircle className="w-4 h-4" />
                    <span>Konfirmasi via WhatsApp</span>
                  </a>
                )}
              </div>
            )}

            {/* Sub-folder Category Tabs */}
            <div className="bg-white border border-[#E6DDD0] rounded-xl p-2 flex items-center gap-1.5 overflow-x-auto">
              {FOLDER_SUBTABS.map((sub) => {
                const count = mediaList.filter((m) => m.category === sub.key).length;
                const active = activeFolderTab === sub.key;
                return (
                  <button
                    key={sub.key}
                    type="button"
                    onClick={() => setActiveFolderTab(sub.key)}
                    className={`px-3.5 py-2.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer tabular-nums ${
                      active
                        ? 'bg-[#2A201B] text-[#FAF7F2]'
                        : 'text-[#4A3B32] hover:bg-[#FAF7F2]'
                    }`}
                  >
                    {sub.label} ({count})
                  </button>
                );
              })}
            </div>

            {/* Live Selection Quota Bar */}
            <section
              aria-label="Penghitung Kuota Pilihan Foto"
              className="bg-white border border-[#E6DDD0] rounded-xl p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4"
            >
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 flex-1">
                <div className="p-3 rounded-lg bg-[#FAF7F2] border border-[#E6DDD0]">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-[#5E534B]">Album</span>
                    {renderQuotaStateLabel(quotaSummary.albumState)}
                  </div>
                  <p className="font-mono text-lg font-semibold text-[#2A201B] mt-0.5 tabular-nums">
                    {quotaSummary.albumSelected} / {quotaSummary.albumQuota} foto
                  </p>
                </div>

                <div className="p-3 rounded-lg bg-[#FAF7F2] border border-[#E6DDD0]">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-[#5E534B]">
                      Kanvas ({customer.ukuran_kanvas})
                    </span>
                    {renderQuotaStateLabel(quotaSummary.kanvasState)}
                  </div>
                  <p className="font-mono text-lg font-semibold text-[#2A201B] mt-0.5 tabular-nums">
                    {quotaSummary.kanvasSelected} / {quotaSummary.kanvasQuota} foto
                  </p>
                </div>

                <div className="p-3 rounded-lg bg-[#FAF7F2] border border-[#E6DDD0]">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-[#5E534B]">Foto Tambahan</span>
                    <span className="text-xs text-[#75655A] tabular-nums">
                      Maks {customer.kuota_tambahan}
                    </span>
                  </div>
                  <p className="font-mono text-lg font-semibold text-[#2A201B] mt-0.5 tabular-nums">
                    {quotaSummary.tambahanSelected} foto
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => handleDownloadFolderZip(activeFolderTab)}
                  className="min-h-[44px] px-4 py-2.5 rounded-lg border border-[#E6DDD0] bg-[#FAF7F2] text-xs font-medium text-[#2A201B] hover:bg-[#F3ECE1] inline-flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Download className="w-4 h-4 text-[#8C6B30]" />
                  <span>Download ZIP ({activeFolderTab})</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setConfirmChecked(false);
                    setConfirmSubmitOpen(true);
                  }}
                  className="min-h-[44px] px-5 py-2.5 rounded-lg bg-[#8C6B30] text-white text-xs sm:text-sm font-medium hover:bg-[#755824] inline-flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Send className="w-4 h-4" />
                  <span>KIRIM PILIHAN FOTO</span>
                </button>
              </div>
            </section>

            {/* Search, Natural Sort & Filter Bar */}
            <div className="bg-white border border-[#E6DDD0] rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 text-[#75655A] absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cari nama file foto (contoh: 001, 015)..."
                  aria-label="Cari nama file foto"
                  className="w-full min-h-[42px] pl-10 pr-4 py-2 rounded-lg border border-[#E6DDD0] bg-[#FAF7F2] text-sm text-[#2A201B] focus:outline-none focus:border-[#8C6B30]"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2 min-w-0">
                <div className="flex flex-wrap items-center gap-1 p-1 bg-[#FAF7F2] border border-[#E6DDD0] rounded-lg max-w-full">
                  {(
                    [
                      { key: 'ALL', label: 'Semua' },
                      { key: 'ALBUM', label: 'Album' },
                      { key: 'KANVAS', label: 'Kanvas' },
                      { key: 'TAMBAHAN', label: 'Tambahan' },
                      { key: 'NOTES', label: 'Ada Catatan' },
                    ] as const
                  ).map((flt) => (
                    <button
                      key={flt.key}
                      type="button"
                      onClick={() => setSelectionFilter(flt.key)}
                      className={`px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                        selectionFilter === flt.key
                          ? 'bg-white text-[#2A201B] shadow-xs border border-[#E6DDD0]'
                          : 'text-[#5E534B] hover:text-[#2A201B]'
                      }`}
                    >
                      {flt.label}
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'))
                  }
                  className="min-h-[40px] px-3.5 py-2 rounded-lg border border-[#E6DDD0] bg-[#FAF7F2] text-xs font-medium text-[#2A201B] hover:bg-[#F3ECE1] inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  {sortDirection === 'asc' ? (
                    <>
                      <ArrowDownAZ className="w-4 h-4 text-[#8C6B30]" />
                      <span>Urutan 001 → 999</span>
                    </>
                  ) : (
                    <>
                      <ArrowUpZA className="w-4 h-4 text-[#8C6B30]" />
                      <span>Urutan 999 → 001</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Special Ringkasan View if Tab 2. RINGKASAN is active */}
            {activeFolderTab === 'RINGKASAN' && (
              <section className="bg-white border border-[#E6DDD0] rounded-xl p-6 space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-[#E6DDD0] pb-4">
                  <div>
                    <h3 className="font-serif text-xl font-semibold text-[#2A201B]">
                      Ringkasan Pilihan Foto Sementara &amp; Catatan Keseluruhan
                    </h3>
                    <p className="text-xs text-[#5E534B]">
                      Periksa kembali seluruh foto yang sudah dipilih sebelum menekan KIRIM PILIHAN
                      FOTO.
                    </p>
                  </div>
                  <span className="font-mono text-xs font-semibold text-[#8C6B30] tabular-nums">
                    {selectedSummaryItems.length} foto ditandai
                  </span>
                </div>

                {selectedSummaryItems.length === 0 ? (
                  <p className="text-sm text-[#5E534B] py-4">
                    Belum ada foto yang dipilih. Silakan buka tab{' '}
                    <strong>1. PILIHAN FOTO (ALL FILE)</strong> untuk mulai memilih foto.
                  </p>
                ) : (
                  <div className="divide-y divide-[#E6DDD0]">
                    {selectedSummaryItems.map((item) => {
                      const tags: string[] = [];
                      if (item.pilih_album) tags.push('ALBUM');
                      if (item.pilih_kanvas) tags.push('KANVAS');
                      if (item.pilih_tambahan) tags.push('FOTO TAMBAHAN');
                      return (
                        <div
                          key={item.file_id}
                          className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-sm"
                        >
                          <div>
                            <p className="font-mono font-medium text-[#2A201B]">
                              {item.file_name}
                            </p>
                            {item.catatan_edit && (
                              <p className="text-xs text-[#5E534B] mt-0.5">
                                Catatan: {item.catatan_edit}
                              </p>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-2 text-xs">
                            <span className="font-medium text-[#8C6B30]">
                              {tags.join(' + ') || 'Catatan Saja'}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                <div>
                  <label
                    htmlFor="overall-edit-note"
                    className="block text-xs font-medium uppercase tracking-wider text-[#5E534B] mb-1.5"
                  >
                    Catatan Edit Untuk Semua Foto
                  </label>
                  <textarea
                    id="overall-edit-note"
                    rows={3}
                    value={overallEditNote}
                    onChange={(e) => handleOverallNoteChange(e.target.value)}
                    placeholder="Tuliskan arahan warna, tone, atau catatan umum untuk tim editor..."
                    className="w-full px-3.5 py-2.5 rounded-lg border border-[#E6DDD0] bg-[#FAF7F2] text-sm text-[#2A201B] focus:outline-none focus:border-[#8C6B30]"
                  />
                </div>
              </section>
            )}

            {/* Photo / Video Gallery Grid */}
            {activeFolderMedia.length === 0 ? (
              <div className="bg-white border border-[#E6DDD0] rounded-xl p-10 text-center space-y-2">
                <FolderOpen className="w-8 h-8 text-[#8C6B30] mx-auto" />
                <h3 className="font-serif text-xl font-semibold text-[#2A201B]">
                  Belum Ada File di Folder {activeFolderTab}
                </h3>
                <p className="text-xs sm:text-sm text-[#5E534B] max-w-md mx-auto">
                  {searchQuery || selectionFilter !== 'ALL'
                    ? 'Tidak ada foto yang cocok dengan filter pencarian Anda.'
                    : `Tim studio belum mengunggah file ke folder ${activeFolderTab} atau folder Google Drive sedang disinkronkan.`}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {activeFolderMedia.map((file, idx) => {
                  const sel = selectionMap[file.id];
                  const isVideo = file.mimeType?.startsWith('video/');
                  const noteOpen = Boolean(
                    openNoteFileIds[file.id] || sel?.catatan_edit
                  );

                  return (
                    <article
                      key={file.id}
                      className={`bg-white border rounded-xl overflow-hidden flex flex-col transition-colors ${
                        sel?.pilih_album || sel?.pilih_kanvas || sel?.pilih_tambahan
                          ? 'border-[#8C6B30]'
                          : 'border-[#E6DDD0]'
                      }`}
                    >
                      {/* Thumbnail Container */}
                      <div className="relative aspect-4/3 bg-[#F3ECE1] overflow-hidden group">
                        {isVideo ? (
                          <video
                            src={file.previewUrl}
                            className="w-full h-full object-cover"
                            preload="metadata"
                          />
                        ) : (
                          <LazyImage
                            src={file.thumbnailUrl}
                            alt={file.name}
                            onClick={() =>
                              setLightboxState({
                                mode: 'selection',
                                items: activeFolderMedia,
                                index: idx,
                              })
                            }
                            className="group-hover:scale-[1.02] transition-transform duration-200"
                          />
                        )}

                        <button
                          type="button"
                          onClick={() =>
                            setLightboxState({
                              mode: 'selection',
                              items: activeFolderMedia,
                              index: idx,
                            })
                          }
                          aria-label={`Perbesar ${file.name}`}
                          className="absolute top-2.5 right-2.5 w-10 h-10 rounded-full bg-[#2A201B]/80 text-[#FAF7F2] flex items-center justify-center hover:bg-[#8C6B30] transition-colors cursor-pointer"
                        >
                          <ZoomIn className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Card Body */}
                      <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                        <div>
                          <div className="flex items-center justify-between gap-2">
                            <h3 className="font-mono text-xs font-semibold text-[#2A201B] truncate">
                              {file.name}
                            </h3>
                            <span className="text-[11px] text-[#75655A] tabular-nums shrink-0">
                              {file.createdTime?.slice(0, 10) || ''}
                            </span>
                          </div>
                          {(sel?.pilih_album ||
                            sel?.pilih_kanvas ||
                            sel?.pilih_tambahan) && (
                            <p className="text-xs font-medium text-[#8C6B30] mt-1">
                              {[
                                sel.pilih_album ? 'Album' : null,
                                sel.pilih_kanvas ? 'Kanvas' : null,
                                sel.pilih_tambahan ? 'Foto Tambahan' : null,
                              ]
                                .filter(Boolean)
                                .join(' · ')}
                            </p>
                          )}
                        </div>

                        {/* Selection Toggles: PILIH ALBUM, PILIH KANVAS, FOTO TAMBAHAN */}
                        {!isVideo && (
                          <div className="space-y-2">
                            <div className="grid grid-cols-2 gap-1.5">
                              <button
                                type="button"
                                onClick={() =>
                                  handleToggleSelection(file, 'pilih_album')
                                }
                                className={`min-h-[40px] px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-colors cursor-pointer ${
                                  sel?.pilih_album
                                    ? 'bg-[#2A201B] text-[#FAF7F2] border-[#2A201B]'
                                    : 'bg-[#FAF7F2] text-[#2A201B] border-[#E6DDD0] hover:border-[#8C6B30]'
                                }`}
                              >
                                {sel?.pilih_album ? '✓ ALBUM' : 'PILIH ALBUM'}
                              </button>

                              <button
                                type="button"
                                onClick={() =>
                                  handleToggleSelection(file, 'pilih_kanvas')
                                }
                                className={`min-h-[40px] px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-colors cursor-pointer ${
                                  sel?.pilih_kanvas
                                    ? 'bg-[#8C6B30] text-white border-[#8C6B30]'
                                    : 'bg-[#FAF7F2] text-[#2A201B] border-[#E6DDD0] hover:border-[#8C6B30]'
                                }`}
                              >
                                {sel?.pilih_kanvas ? '✓ KANVAS' : 'PILIH KANVAS'}
                              </button>
                            </div>

                            <button
                              type="button"
                              disabled={Boolean(sel?.pilih_album)}
                              onClick={() =>
                                handleToggleSelection(file, 'pilih_tambahan')
                              }
                              title={
                                sel?.pilih_album
                                  ? 'Foto yang sudah dipilih untuk Album tidak dapat dipilih sebagai Foto Tambahan'
                                  : 'Pilih sebagai Foto Tambahan'
                              }
                              className={`w-full min-h-[38px] px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                                sel?.pilih_album
                                  ? 'bg-[#F3ECE1] text-[#75655A] border-[#E6DDD0] opacity-55 cursor-not-allowed'
                                  : sel?.pilih_tambahan
                                  ? 'bg-[#4A3B32] text-white border-[#4A3B32] cursor-pointer'
                                  : 'bg-white text-[#4A3B32] border-[#E6DDD0] hover:border-[#8C6B30] cursor-pointer'
                              }`}
                            >
                              {sel?.pilih_tambahan
                                ? '✓ FOTO TAMBAHAN'
                                : 'FOTO TAMBAHAN'}
                            </button>

                            {/* + Tambah Catatan Edit */}
                            {!noteOpen ? (
                              <button
                                type="button"
                                onClick={() =>
                                  setOpenNoteFileIds((p) => ({
                                    ...p,
                                    [file.id]: true,
                                  }))
                                }
                                className="w-full py-1.5 text-xs font-medium text-[#8C6B30] hover:text-[#2A201B] inline-flex items-center justify-center gap-1.5 cursor-pointer"
                              >
                                <MessageSquarePlus className="w-3.5 h-3.5" />
                                <span>+ Tambah Catatan Edit</span>
                              </button>
                            ) : (
                              <div>
                                <input
                                  type="text"
                                  value={sel?.catatan_edit || ''}
                                  onChange={(e) =>
                                    handleUpdateSelectionNote(file, e.target.value)
                                  }
                                  placeholder="Tulis catatan edit foto ini..."
                                  aria-label={`Catatan edit untuk ${file.name}`}
                                  className="w-full px-2.5 py-1.5 rounded-lg border border-[#C6A464] bg-[#FAF7F2] text-xs text-[#2A201B] focus:outline-none"
                                />
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            )}

            {/* Tombol Aksi Bawah: DOWNLOAD ZIP & KIRIM PILIHAN FOTO */}
            <div className="bg-white border border-[#E6DDD0] rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
              <div className="space-y-1">
                <p className="text-xs font-semibold uppercase tracking-wider text-[#8C6B30]">
                  Selesai Memilih Foto?
                </p>
                <p className="text-xs sm:text-sm text-[#5E534B]">
                  Periksa kuota pilihan Anda ({quotaSummary.albumSelected} Album, {quotaSummary.kanvasSelected} Kanvas, {quotaSummary.tambahanSelected} Tambahan) lalu kirimkan ke studio, atau unduh arsip file foto dalam bentuk ZIP.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => handleDownloadFolderZip(activeFolderTab)}
                  className="min-h-[44px] px-5 py-2.5 rounded-lg border border-[#E6DDD0] bg-[#FAF7F2] text-xs sm:text-sm font-medium text-[#2A201B] hover:bg-[#F3ECE1] inline-flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer transition-colors shadow-xs"
                >
                  <Download className="w-4 h-4 text-[#8C6B30]" />
                  <span>DOWNLOAD ZIP</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setConfirmChecked(false);
                    setConfirmSubmitOpen(true);
                  }}
                  className="min-h-[44px] px-6 py-2.5 rounded-lg bg-[#8C6B30] text-white text-xs sm:text-sm font-medium hover:bg-[#755824] inline-flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer transition-colors shadow-xs"
                >
                  <Send className="w-4 h-4" />
                  <span>KIRIM PILIHAN FOTO</span>
                </button>
              </div>
            </div>

            {/* Riwayat Pengiriman Pilihan */}
            {submissions.length > 0 && (
              <section className="bg-white border border-[#E6DDD0] rounded-xl p-6 space-y-4">
                <h3 className="font-serif text-xl font-semibold text-[#2A201B]">
                  Riwayat Pengiriman Pilihan Foto
                </h3>
                <div className="divide-y divide-[#E6DDD0]">
                  {submissions.map((sub) => (
                    <div
                      key={sub.id_pilihan}
                      className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs sm:text-sm"
                    >
                      <div className="space-y-0.5">
                        <p className="font-mono font-semibold text-[#2A201B]">
                          {sub.id_pilihan} · Terkirim{' '}
                          {sub.waktu_pengiriman.slice(0, 16).replace('T', ' ')}
                        </p>
                        <p className="text-[#5E534B]">
                          Album: <strong>{sub.jumlah_album}</strong> · Kanvas:{' '}
                          <strong>{sub.jumlah_kanvas}</strong> · Tambahan:{' '}
                          <strong>{sub.jumlah_tambahan}</strong>
                          {sub.catatan_keseluruhan
                            ? ` · Catatan: "${sub.catatan_keseluruhan}"`
                            : ''}
                        </p>
                      </div>
                      <span className="font-mono text-xs text-[#1F6E43] font-medium tabular-nums">
                        Estimasi Selesai: {formatDateDDMMYYYY(sub.estimasi_selesai)}
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}

        {/* TAB 3: LIHAT EDITAN & ANOTASI REVISI (Section 11) */}
        {activeTab === 'LIHAT_EDITAN' && (
          <div className="space-y-6">
            {revisionSuccessMsg && (
              <div className="bg-[#ECF7F0] border border-[#1F6E43]/30 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-[#1F6E43] shrink-0 mt-0.5" />
                  <p className="text-sm text-[#2A201B]">{revisionSuccessMsg}</p>
                </div>
                {studioWaDigits && (
                  <a
                    href={revisionWaHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#1F6E43] text-white text-xs font-medium hover:bg-[#175533] whitespace-nowrap shrink-0"
                  >
                    <MessageCircle className="w-4 h-4" />
                    <span>Konfirmasi Revisi via WhatsApp</span>
                  </a>
                )}
              </div>
            )}

            <section className="bg-white border border-[#E6DDD0] rounded-xl p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="space-y-1">
                <p className="text-xs font-medium uppercase tracking-[0.16em] text-[#8C6B30]">
                  Review Hasil Editing Studio
                </p>
                <h2 className="font-serif text-2xl font-semibold text-[#2A201B]">
                  Galeri Hasil Editan ({editanMedia.length} Foto)
                </h2>
                <p className="text-xs sm:text-sm text-[#5E534B]">
                  Klik foto untuk memperbesar dan memberi tanda lingkaran atau titik pin jika masih
                  ada bagian yang perlu diperbaiki. Kuota revisi:{' '}
                  <strong className="font-mono tabular-nums">
                    {customer.jumlah_revisi} / {studio.batas_revisi}
                  </strong>{' '}
                  kali.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => handleDownloadFolderZip('LIHAT EDITAN')}
                  className="min-h-[44px] px-4 py-2.5 rounded-lg border border-[#E6DDD0] bg-[#FAF7F2] text-xs font-medium text-[#2A201B] hover:bg-[#F3ECE1] inline-flex items-center gap-2 cursor-pointer"
                >
                  <Download className="w-4 h-4 text-[#8C6B30]" />
                  <span>Download Editan (ZIP)</span>
                </button>

                <button
                  type="button"
                  disabled={customer.jumlah_revisi >= studio.batas_revisi}
                  onClick={() => setRevisionModalOpen(true)}
                  className="min-h-[44px] px-4 py-2.5 rounded-lg border border-[#9E2A2B] text-[#9E2A2B] bg-[#FDF0F0] hover:bg-[#FBE2E2] disabled:opacity-50 text-xs sm:text-sm font-medium inline-flex items-center gap-2 cursor-pointer"
                >
                  <PenTool className="w-4 h-4" />
                  <span>MASIH PERLU REVISI</span>
                </button>

                <button
                  type="button"
                  onClick={() => setApprovalModalOpen(true)}
                  className="min-h-[44px] px-5 py-2.5 rounded-lg bg-[#1F6E43] text-white hover:bg-[#175533] text-xs sm:text-sm font-medium inline-flex items-center gap-2 cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>SUDAH OK / SIAP CETAK</span>
                </button>
              </div>
            </section>

            {editanMedia.length === 0 ? (
              <div className="bg-white border border-[#E6DDD0] rounded-xl p-10 text-center space-y-2">
                <Eye className="w-8 h-8 text-[#8C6B30] mx-auto" />
                <h3 className="font-serif text-xl font-semibold text-[#2A201B]">
                  Hasil Editan Belum Diunggah
                </h3>
                <p className="text-sm text-[#5E534B] max-w-md mx-auto">
                  Tim editor LOUIS BRIDES sedang memproses foto pilihan Anda. Hasil editan akan
                  tampil di halaman ini segera setelah selesai.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {editanMedia.map((file, idx) => {
                  const rev = revisionMap[file.id];
                  const markCount = rev?.annotations?.length || 0;
                  return (
                    <article
                      key={file.id}
                      className="bg-white border border-[#E6DDD0] rounded-xl overflow-hidden flex flex-col"
                    >
                      <div className="relative aspect-4/3 bg-[#F3ECE1] overflow-hidden cursor-pointer group">
                        <LazyImage
                          src={file.thumbnailUrl}
                          alt={file.name}
                          onClick={() =>
                            setLightboxState({
                              mode: 'revision',
                              items: editanMedia,
                              index: idx,
                            })
                          }
                          className="group-hover:scale-[1.02] transition-transform"
                        />
                        {/* Mini Preview of Circle & Pin Annotations */}
                        {rev && rev.annotations.length > 0 && (
                          <svg
                            viewBox="0 0 100 100"
                            preserveAspectRatio="none"
                            className="absolute inset-0 w-full h-full pointer-events-none"
                          >
                            {rev.annotations.map((ann) =>
                              ann.type === 'circle' ? (
                                <ellipse
                                  key={ann.id}
                                  cx={ann.x}
                                  cy={ann.y}
                                  rx={ann.rx || 8}
                                  ry={ann.ry || 8}
                                  fill="rgba(225, 29, 72, 0.16)"
                                  stroke="#F43F5E"
                                  strokeWidth="1.2"
                                />
                              ) : (
                                <circle
                                  key={ann.id}
                                  cx={ann.x}
                                  cy={ann.y}
                                  r="3"
                                  fill="#E11D48"
                                  stroke="#FFFFFF"
                                  strokeWidth="1"
                                />
                              )
                            )}
                          </svg>
                        )}
                      </div>

                      <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                        <div>
                          <div className="flex items-center justify-between gap-2">
                            <h3 className="font-mono text-xs font-semibold text-[#2A201B]">
                              {file.name}
                            </h3>
                            {markCount > 0 && (
                              <span className="text-xs font-medium text-[#9E2A2B] tabular-nums">
                                {markCount} tanda revisi
                              </span>
                            )}
                          </div>
                          {rev?.catatan_revisi && (
                            <p className="text-xs text-[#4A3B32] mt-1 line-clamp-2">
                              Catatan: {rev.catatan_revisi}
                            </p>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={() =>
                            setLightboxState({
                              mode: 'revision',
                              items: editanMedia,
                              index: idx,
                            })
                          }
                          className="w-full min-h-[42px] px-4 py-2 rounded-lg border border-[#C6A464] text-[#8C6B30] hover:bg-[#FAF7F2] text-xs font-medium inline-flex items-center justify-center gap-2 cursor-pointer"
                        >
                          <PenTool className="w-3.5 h-3.5" />
                          <span>Zoom &amp; Tandai Revisi</span>
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}

            {/* Tombol Aksi Bawah: DOWNLOAD ZIP, MASIH PERLU REVISI, SUDAH OK / SIAP CETAK */}
            <div className="bg-white border border-[#E6DDD0] rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
              <div className="space-y-1">
                <p className="text-xs font-semibold uppercase tracking-wider text-[#8C6B30]">
                  Konfirmasi Hasil Editing
                </p>
                <p className="text-xs sm:text-sm text-[#5E534B]">
                  Pilih &quot;SUDAH OK / SIAP CETAK&quot; jika editan sudah sesuai, atau &quot;MASIH PERLU REVISI&quot; jika masih membutuhkan penyempurnaan dari editor.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => handleDownloadFolderZip('LIHAT EDITAN')}
                  className="min-h-[44px] px-4 py-2.5 rounded-lg border border-[#E6DDD0] bg-[#FAF7F2] text-xs sm:text-sm font-medium text-[#2A201B] hover:bg-[#F3ECE1] inline-flex items-center gap-2 cursor-pointer transition-colors"
                >
                  <Download className="w-4 h-4 text-[#8C6B30]" />
                  <span>DOWNLOAD ZIP</span>
                </button>

                <button
                  type="button"
                  disabled={customer.jumlah_revisi >= studio.batas_revisi}
                  onClick={() => setRevisionModalOpen(true)}
                  className="min-h-[44px] px-4 py-2.5 rounded-lg border border-[#9E2A2B] text-[#9E2A2B] bg-[#FDF0F0] hover:bg-[#FBE2E2] disabled:opacity-50 text-xs sm:text-sm font-medium inline-flex items-center gap-2 cursor-pointer transition-colors"
                >
                  <PenTool className="w-4 h-4" />
                  <span>MASIH PERLU REVISI</span>
                </button>

                <button
                  type="button"
                  onClick={() => setApprovalModalOpen(true)}
                  className="min-h-[44px] px-5 py-2.5 rounded-lg bg-[#1F6E43] text-white hover:bg-[#175533] text-xs sm:text-sm font-medium inline-flex items-center gap-2 cursor-pointer transition-colors shadow-xs"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>SUDAH OK / SIAP CETAK</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: REVISI (Section 15.10) */}
        {activeTab === 'REVISI' && (
          <div className="space-y-6">
            <section className="bg-white border border-[#E6DDD0] rounded-xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.16em] text-[#8C6B30]">
                  Hasil Penyempurnaan Editor
                </p>
                <h2 className="font-serif text-2xl font-semibold text-[#2A201B]">
                  Hasil Foto Setelah Direvisi ({revisiMedia.length} File)
                </h2>
              </div>

              <div className="flex flex-wrap items-center gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => handleDownloadFolderZip('REVISI')}
                  className="min-h-[44px] px-4 py-2.5 rounded-lg border border-[#E6DDD0] bg-[#FAF7F2] text-xs sm:text-sm font-medium text-[#2A201B] hover:bg-[#F3ECE1] inline-flex items-center gap-2 whitespace-nowrap cursor-pointer transition-colors"
                >
                  <Download className="w-4 h-4 text-[#8C6B30]" />
                  <span>DOWNLOAD ZIP</span>
                </button>

                <button
                  type="button"
                  disabled={customer.jumlah_revisi >= studio.batas_revisi}
                  onClick={() => setRevisionModalOpen(true)}
                  className="min-h-[44px] px-4 py-2.5 rounded-lg border border-[#9E2A2B] text-[#9E2A2B] bg-[#FDF0F0] hover:bg-[#FBE2E2] disabled:opacity-50 text-xs sm:text-sm font-medium inline-flex items-center gap-2 cursor-pointer transition-colors"
                >
                  <PenTool className="w-4 h-4" />
                  <span>MASIH PERLU REVISI</span>
                </button>

                <button
                  type="button"
                  onClick={() => setApprovalModalOpen(true)}
                  className="min-h-[44px] px-5 py-2.5 rounded-lg bg-[#1F6E43] text-white hover:bg-[#175533] text-xs sm:text-sm font-medium inline-flex items-center gap-2 cursor-pointer transition-colors shadow-xs"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>SUDAH OK / SIAP CETAK</span>
                </button>
              </div>
            </section>

            {revisiMedia.length === 0 ? (
              <div className="bg-white border border-[#E6DDD0] rounded-xl p-10 text-center space-y-2">
                <FolderOpen className="w-8 h-8 text-[#8C6B30] mx-auto" />
                <h3 className="font-serif text-xl font-semibold text-[#2A201B]">
                  Belum Ada File di Folder REVISI
                </h3>
                <p className="text-sm text-[#5E534B]">
                  Hasil perbaikan setelah pengajuan revisi akan tampil di halaman ini.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {revisiMedia.map((file, idx) => (
                  <article
                    key={file.id}
                    className="bg-white border border-[#E6DDD0] rounded-xl overflow-hidden"
                  >
                    <LazyImage
                      src={file.thumbnailUrl}
                      alt={file.name}
                      onClick={() =>
                        setLightboxState({
                          mode: 'selection',
                          items: revisiMedia,
                          index: idx,
                        })
                      }
                      className="cursor-pointer"
                    />
                    <div className="p-4 flex items-center justify-between gap-2">
                      <span className="font-mono text-xs font-semibold text-[#2A201B]">
                        {file.name}
                      </span>
                      <a
                        href={file.downloadUrl}
                        download={file.name}
                        className="text-xs font-medium text-[#8C6B30] hover:underline"
                      >
                        Unduh
                      </a>
                    </div>
                  </article>
                ))}
              </div>
            )}

            {/* Tombol Aksi Bawah: DOWNLOAD ZIP, MASIH PERLU REVISI, SUDAH OK / SIAP CETAK */}
            <div className="bg-white border border-[#E6DDD0] rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
              <div className="space-y-1">
                <p className="text-xs font-semibold uppercase tracking-wider text-[#8C6B30]">
                  Konfirmasi Hasil Revisi
                </p>
                <p className="text-xs sm:text-sm text-[#5E534B]">
                  Pilih &quot;SUDAH OK / SIAP CETAK&quot; jika hasil revisi sudah sesuai, atau &quot;MASIH PERLU REVISI&quot; jika masih membutuhkan catatan perbaikan lebih lanjut.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => handleDownloadFolderZip('REVISI')}
                  className="min-h-[44px] px-4 py-2.5 rounded-lg border border-[#E6DDD0] bg-[#FAF7F2] text-xs sm:text-sm font-medium text-[#2A201B] hover:bg-[#F3ECE1] inline-flex items-center gap-2 whitespace-nowrap cursor-pointer transition-colors"
                >
                  <Download className="w-4 h-4 text-[#8C6B30]" />
                  <span>DOWNLOAD ZIP</span>
                </button>

                <button
                  type="button"
                  disabled={customer.jumlah_revisi >= studio.batas_revisi}
                  onClick={() => setRevisionModalOpen(true)}
                  className="min-h-[44px] px-4 py-2.5 rounded-lg border border-[#9E2A2B] text-[#9E2A2B] bg-[#FDF0F0] hover:bg-[#FBE2E2] disabled:opacity-50 text-xs sm:text-sm font-medium inline-flex items-center gap-2 cursor-pointer transition-colors"
                >
                  <PenTool className="w-4 h-4" />
                  <span>MASIH PERLU REVISI</span>
                </button>

                <button
                  type="button"
                  onClick={() => setApprovalModalOpen(true)}
                  className="min-h-[44px] px-5 py-2.5 rounded-lg bg-[#1F6E43] text-white hover:bg-[#175533] text-xs sm:text-sm font-medium inline-flex items-center gap-2 cursor-pointer transition-colors shadow-xs"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>SUDAH OK / SIAP CETAK</span>
                </button>
              </div>
            </div>

            {/* Riwayat Permintaan Revisi & Persetujuan */}
            {feedbacks.filter(
              (f) =>
                f.jenis_feedback === 'REVISION_REQUEST' ||
                f.jenis_feedback === 'EDIT_APPROVAL'
            ).length > 0 && (
              <section className="bg-white border border-[#E6DDD0] rounded-xl p-6 space-y-4">
                <h3 className="font-serif text-xl font-semibold text-[#2A201B]">
                  Riwayat Revisi &amp; Persetujuan Editing
                </h3>
                <div className="divide-y divide-[#E6DDD0]">
                  {feedbacks
                    .filter(
                      (f) =>
                        f.jenis_feedback === 'REVISION_REQUEST' ||
                        f.jenis_feedback === 'EDIT_APPROVAL'
                    )
                    .map((fb) => (
                      <div key={fb.id_feedback} className="py-3.5 space-y-1.5 text-sm">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="font-semibold text-[#2A201B]">
                            {fb.jenis_feedback === 'EDIT_APPROVAL'
                              ? 'Persetujuan Siap Cetak'
                              : `Permintaan Revisi ke-${fb.revisi_ke || 1}`}
                          </span>
                          <span className="font-mono text-xs text-[#75655A] tabular-nums">
                            {fb.waktu_kirim.slice(0, 16).replace('T', ' ')}
                          </span>
                        </div>
                        {fb.catatan_umum && (
                          <p className="text-xs text-[#4A3B32]">{fb.catatan_umum}</p>
                        )}
                        {fb.detail_revisi && fb.detail_revisi.length > 0 && (
                          <ul className="text-xs text-[#5E534B] space-y-1 pt-1">
                            {fb.detail_revisi.map((d) => (
                              <li key={d.file_id}>
                                • <strong className="font-mono">{d.file_name}</strong>:{' '}
                                {d.catatan_revisi || 'Ditandai pada gambar'} (
                                {d.annotations.length} tanda)
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    ))}
                </div>
              </section>
            )}
          </div>
        )}

        {/* TAB 5: VIDEO */}
        {activeTab === 'VIDEO' && (
          <div className="space-y-6">
            <section className="bg-white border border-[#E6DDD0] rounded-xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.16em] text-[#8C6B30]">
                  Galeri Video Dokumentasi
                </p>
                <h2 className="font-serif text-2xl font-semibold text-[#2A201B]">
                  Koleksi Video ({videoMedia.length} File)
                </h2>
                <p className="text-xs sm:text-sm text-[#5E534B] mt-0.5">
                  Tonton dan unduh video teaser &amp; liputan resmi pernikahan/prewedding Anda.
                </p>
              </div>

              {videoMedia.length > 0 && isFolderDownloadAllowed('VIDEO', customer, studio) && (
                <button
                  type="button"
                  onClick={() => handleDownloadFolderZip('VIDEO')}
                  className="min-h-[44px] px-5 py-2.5 rounded-lg border border-[#E6DDD0] bg-[#FAF7F2] text-xs sm:text-sm font-medium text-[#2A201B] hover:bg-[#F3ECE1] inline-flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer transition-colors shadow-xs"
                >
                  <Download className="w-4 h-4 text-[#8C6B30]" />
                  <span>Download Semua Video (ZIP)</span>
                </button>
              )}
            </section>

            {/* Kotak Pemberitahuan Retensi Video (Wajib Muncul & Jelas) */}
            <div className="bg-[#FAF7F2] border-2 border-[#C6A464]/60 rounded-xl p-5 sm:p-6 space-y-3 shadow-xs">
              <div className="flex items-start gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-[#8C6B30]/15 flex items-center justify-center shrink-0 text-[#8C6B30]">
                  <Clock className="w-5 h-5" />
                </div>
                <div className="space-y-2">
                  <h3 className="font-serif text-lg sm:text-xl font-bold tracking-wide text-[#2A201B]">
                    PEMBERITAHUAN RETENSI: SEGERA DOWNLOAD VIDEO
                  </h3>
                  <div className="text-xs sm:text-sm text-[#4A3B32] space-y-1.5 leading-relaxed">
                    <p>
                      Seluruh file video pada tab 5. VIDEO memiliki batas penyimpanan aktif selama 1 bulan (30 hari) sejak tanggal file dibuat atau diunggah.
                    </p>
                    <p>
                      Harap segera download dan simpan seluruh video ke perangkat pribadi Anda.
                    </p>
                    <p>
                      Mohon selesaikan juga pemilihan foto untuk album dan kanvas sebelum masa penyimpanan berakhir.
                    </p>
                    <p className="font-medium text-[#8C6B30] pt-0.5">
                      Setelah melewati batas waktu 30 hari, file video dapat dihapus secara permanen oleh tim studio dari Google Drive. Pastikan seluruh file penting sudah tersimpan di perangkat pribadi Anda.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {videoMedia.length === 0 ? (
              <div className="bg-white border border-[#E6DDD0] rounded-xl p-10 text-center space-y-2">
                <Film className="w-8 h-8 text-[#8C6B30] mx-auto" />
                <h3 className="font-serif text-xl font-semibold text-[#2A201B]">
                  Belum Ada File Video
                </h3>
                <p className="text-sm text-[#5E534B]">
                  Video liputan atau teaser prewedding akan muncul di sini apabila telah diunggah oleh studio.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {videoMedia.map((vid) => {
                  const retention = calculateVideoRetentionStatus(vid.createdTime, currentTime);
                  return (
                    <article
                      key={vid.id}
                      className="bg-white border border-[#E6DDD0] rounded-xl overflow-hidden flex flex-col shadow-xs"
                    >
                      <div className="relative aspect-video bg-black">
                        <video
                          src={vid.previewUrl}
                          controls
                          className="w-full h-full object-contain"
                        />
                      </div>

                      <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between space-y-4">
                        <div className="space-y-2">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div>
                              <h4
                                className="font-mono text-xs sm:text-sm font-semibold text-[#2A201B] line-clamp-1"
                                title={vid.name}
                              >
                                {vid.name}
                              </h4>
                              <p className="text-[11px] text-[#75655A] mt-0.5">
                                {vid.sizeBytes
                                  ? `${(vid.sizeBytes / (1024 * 1024)).toFixed(1)} MB`
                                  : 'Video Dokumentasi'}
                              </p>
                            </div>

                            <span
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold border ${retention.badgeBgClass} ${retention.badgeColorClass} ${retention.badgeBorderClass}`}
                            >
                              <Clock className="w-3 h-3" />
                              <span>{retention.statusText}</span>
                            </span>
                          </div>

                          {/* Info Retensi: Tanggal Upload, Batas Penyimpanan, Sisa Waktu */}
                          <div className="p-3 rounded-lg bg-[#FAF7F2] border border-[#E6DDD0] grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                            <div>
                              <span className="block text-[10px] uppercase font-semibold text-[#75655A] tracking-wider mb-0.5">
                                Tanggal Upload
                              </span>
                              <span className="font-medium text-[#2A201B] block">
                                {retention.uploadDateFormatted}
                              </span>
                            </div>

                            <div>
                              <span className="block text-[10px] uppercase font-semibold text-[#75655A] tracking-wider mb-0.5">
                                Batas Penyimpanan
                              </span>
                              <span className="font-medium text-[#2A201B] block">
                                {retention.deadlineFormatted}
                              </span>
                            </div>

                            <div>
                              <span className="block text-[10px] uppercase font-semibold text-[#75655A] tracking-wider mb-0.5">
                                Sisa Waktu
                              </span>
                              <span className={`font-mono font-bold block ${retention.badgeColorClass}`}>
                                {retention.remainingText}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Unduh Video Button */}
                        <div className="pt-2 border-t border-[#E6DDD0] flex flex-wrap items-center justify-between gap-2">
                          <p className="text-[11px] text-[#5E534B]">
                            {retention.isExpired
                              ? 'Masa retensi telah berakhir. Hubungi studio jika memerlukan bantuan.'
                              : 'Klik unduh untuk menyimpan file video ke perangkat pribadi Anda.'}
                          </p>

                          {isFolderDownloadAllowed('VIDEO', customer, studio) && (
                            <a
                              href={vid.downloadUrl}
                              download={vid.name}
                              className="min-h-[40px] px-4 py-2 rounded-lg bg-[#2A201B] text-[#FAF7F2] text-xs font-medium hover:bg-[#3F312A] inline-flex items-center gap-2 whitespace-nowrap cursor-pointer transition-colors shadow-xs ml-auto"
                            >
                              <Download className="w-3.5 h-3.5 text-[#E3C78D]" />
                              <span>Unduh Video</span>
                            </a>
                          )}
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 6: STATUS PEKERJAAN (Section 12) */}
        {activeTab === 'STATUS_PEKERJAAN' && (
          <div className="space-y-6">
            <section className="bg-white border border-[#E6DDD0] rounded-xl p-6 sm:p-8 space-y-6">
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.16em] text-[#8C6B30]">
                  Monitoring Progres Produksi
                </p>
                <h2 className="font-serif text-2xl font-semibold text-[#2A201B]">
                  Status Pengerjaan Album &amp; Kanvas
                </h2>
              </div>

              {/* ALBUM Pipeline */}
              <div className="p-5 rounded-xl bg-[#FAF7F2] border border-[#E6DDD0] space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-serif text-xl font-semibold text-[#2A201B]">
                    ALBUM ({customer.kuota_album} Foto)
                  </h3>
                  <span className="font-mono text-xs font-semibold text-[#8C6B30]">
                    Status: {customer.status_album}
                  </span>
                </div>

                {customer.status_album === 'TIDAK PAKAI' ? (
                  <p className="text-xs text-[#5E534B]">
                    Paket ini tidak menggunakan produk Album.
                  </p>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
                    {ALBUM_PIPELINE_STEPS.map((step, idx) => {
                      const reached = idx <= albumStepIdx;
                      const current = idx === albumStepIdx;
                      return (
                        <div
                          key={step}
                          className={`p-3 rounded-lg border text-xs space-y-1 ${
                            current
                              ? 'bg-[#2A201B] text-[#FAF7F2] border-[#2A201B]'
                              : reached
                              ? 'bg-[#ECF7F0] text-[#1F6E43] border-[#1F6E43]/30'
                              : 'bg-white text-[#75655A] border-[#E6DDD0]'
                          }`}
                        >
                          <p className="font-mono text-[11px] opacity-75">
                            0{idx + 1}
                          </p>
                          <p className="font-medium leading-snug">{step}</p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* KANVAS Pipeline */}
              <div className="p-5 rounded-xl bg-[#FAF7F2] border border-[#E6DDD0] space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-serif text-xl font-semibold text-[#2A201B]">
                    KANVAS ({customer.kuota_kanvas} Unit · {customer.ukuran_kanvas})
                  </h3>
                  <span className="font-mono text-xs font-semibold text-[#8C6B30]">
                    Status: {customer.status_kanvas}
                  </span>
                </div>

                {customer.status_kanvas === 'TIDAK PAKAI' ? (
                  <p className="text-xs text-[#5E534B]">
                    Paket ini tidak menggunakan produk Kanvas.
                  </p>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                    {KANVAS_PIPELINE_STEPS.map((step, idx) => {
                      const reached = idx <= kanvasStepIdx;
                      const current = idx === kanvasStepIdx;
                      return (
                        <div
                          key={step}
                          className={`p-3 rounded-lg border text-xs space-y-1 ${
                            current
                              ? 'bg-[#8C6B30] text-white border-[#8C6B30]'
                              : reached
                              ? 'bg-[#ECF7F0] text-[#1F6E43] border-[#1F6E43]/30'
                              : 'bg-white text-[#75655A] border-[#E6DDD0]'
                          }`}
                        >
                          <p className="font-mono text-[11px] opacity-75">
                            0{idx + 1}
                          </p>
                          <p className="font-medium leading-snug">{step}</p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Key Dates Metadata Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2">
                <div className="p-3.5 rounded-lg border border-[#E6DDD0]">
                  <p className="text-xs text-[#75655A]">Tanggal Pemotretan</p>
                  <p className="font-mono text-sm font-medium text-[#2A201B] mt-0.5 tabular-nums">
                    {formatDateDDMMYYYY(customer.tanggal_pemotretan)}
                  </p>
                </div>
                <div className="p-3.5 rounded-lg border border-[#E6DDD0]">
                  <p className="text-xs text-[#75655A]">Pengiriman Pilihan</p>
                  <p className="font-mono text-sm font-medium text-[#2A201B] mt-0.5 tabular-nums">
                    {formatDateDDMMYYYY(customer.tanggal_pemilihan)}
                  </p>
                </div>
                <div className="p-3.5 rounded-lg border border-[#E6DDD0]">
                  <p className="text-xs text-[#75655A]">Estimasi Selesai</p>
                  <p className="font-mono text-sm font-medium text-[#2A201B] mt-0.5 tabular-nums">
                    {formatDateDDMMYYYY(customer.estimasi_selesai)}
                  </p>
                </div>
                <div className="p-3.5 rounded-lg border border-[#E6DDD0]">
                  <p className="text-xs text-[#75655A]">Tanggal Cetak</p>
                  <p className="font-mono text-sm font-medium text-[#2A201B] mt-0.5 tabular-nums">
                    {formatDateDDMMYYYY(customer.tanggal_cetak)}
                  </p>
                </div>
              </div>
            </section>

            {/* Activity / Status History */}
            {logs.length > 0 && (
              <section className="bg-white border border-[#E6DDD0] rounded-xl p-6 space-y-4">
                <h3 className="font-serif text-xl font-semibold text-[#2A201B]">
                  Riwayat Perubahan Status &amp; Aktivitas
                </h3>
                <div className="divide-y divide-[#E6DDD0]">
                  {logs.map((log) => (
                    <div
                      key={log.id_log}
                      className="py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs"
                    >
                      <div>
                        <span className="font-semibold text-[#2A201B]">
                          {log.aksi}
                        </span>{' '}
                        <span className="text-[#5E534B]">— {log.detail}</span>
                      </div>
                      <span className="font-mono text-[#75655A] tabular-nums">
                        {log.waktu.slice(0, 16).replace('T', ' ')}
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}

        {/* TAB 7: PANDUAN */}
        {activeTab === 'PANDUAN' && (
          <PanduanView
            onNavigateTab={(target) => {
              setActiveTab(target);
              if (target === 'PILIH_FOTO') setActiveFolderTab('ALL FILE');
            }}
          />
        )}

        {/* TAB 8: KRITIK & SARAN (Section 16) */}
        {activeTab === 'KRITIK_SARAN' && (
          <div className="max-w-2xl mx-auto space-y-6">
            <section className="bg-white border border-[#E6DDD0] rounded-xl p-6 sm:p-8 space-y-6">
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.16em] text-[#8C6B30]">
                  Masukan Pelanggan
                </p>
                <h2 className="font-serif text-2xl sm:text-3xl font-semibold text-[#2A201B]">
                  Kritik &amp; Saran untuk {studio.nama_studio}
                </h2>
                <p className="text-sm text-[#5E534B] mt-1">
                  Penilaian dan saran Anda membantu kami menjaga kualitas layanan terbaik.
                </p>
              </div>

              {feedbackSuccess && (
                <div className="p-4 rounded-xl bg-[#ECF7F0] border border-[#1F6E43]/30 text-sm text-[#1F6E43]">
                  Terima kasih! Kritik dan saran Anda telah tersimpan ke database studio.
                </div>
              )}

              <form onSubmit={handleSubmitCriticFeedback} className="space-y-5">
                {/* Auto Customer Name & Code */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium uppercase tracking-wider text-[#5E534B] mb-1">
                      Nama Customer
                    </label>
                    <input
                      type="text"
                      readOnly
                      value={customer.nama_customer}
                      className="w-full px-3.5 py-2 rounded-lg border border-[#E6DDD0] bg-[#FAF7F2] text-sm text-[#5E534B]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium uppercase tracking-wider text-[#5E534B] mb-1">
                      Kode Customer
                    </label>
                    <input
                      type="text"
                      readOnly
                      value={customer.kode_unik}
                      className="w-full px-3.5 py-2 rounded-lg border border-[#E6DDD0] bg-[#FAF7F2] font-mono text-sm text-[#5E534B]"
                    />
                  </div>
                </div>

                {/* 1-5 Star Rating */}
                <div>
                  <span className="block text-xs font-medium uppercase tracking-wider text-[#5E534B] mb-2">
                    Rating Kepuasan (1 – 5 Bintang)
                  </span>
                  <div className="flex items-center gap-2">
                    {[1, 2, 3, 4, 5].map((starVal) => (
                      <button
                        key={starVal}
                        type="button"
                        onClick={() => setFeedbackRating(starVal)}
                        aria-label={`Beri rating ${starVal} bintang`}
                        className="w-11 h-11 rounded-lg border border-[#E6DDD0] bg-[#FAF7F2] flex items-center justify-center hover:border-[#8C6B30] transition-colors cursor-pointer"
                      >
                        <Star
                          className={`w-5 h-5 ${
                            starVal <= feedbackRating
                              ? 'fill-[#C6A464] text-[#8C6B30]'
                              : 'text-[#C7B9AC]'
                          }`}
                        />
                      </button>
                    ))}
                    <span className="ml-2 font-mono text-sm font-medium text-[#2A201B] tabular-nums">
                      {feedbackRating} / 5
                    </span>
                  </div>
                </div>

                {/* Feedback Category */}
                <div>
                  <label
                    htmlFor="feedback-category"
                    className="block text-xs font-medium uppercase tracking-wider text-[#5E534B] mb-1.5"
                  >
                    Kategori Masukan
                  </label>
                  <select
                    id="feedback-category"
                    value={feedbackCategory}
                    onChange={(e) => setFeedbackCategory(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-lg border border-[#E6DDD0] bg-[#FAF7F2] text-sm text-[#2A201B] focus:outline-none focus:border-[#8C6B30]"
                  >
                    <option value="Pelayanan Studio & Fotografer">
                      Pelayanan Studio &amp; Fotografer
                    </option>
                    <option value="Hasil Editing & Warna">
                      Hasil Editing &amp; Warna
                    </option>
                    <option value="Kualitas Album & Kanvas">
                      Kualitas Album &amp; Kanvas
                    </option>
                    <option value="Kemudahan Portal Pemilihan Foto">
                      Kemudahan Portal Pemilihan Foto
                    </option>
                    <option value="Lainnya">Lainnya</option>
                  </select>
                </div>

                {/* Message */}
                <div>
                  <label
                    htmlFor="feedback-message"
                    className="block text-xs font-medium uppercase tracking-wider text-[#5E534B] mb-1.5"
                  >
                    Pesan atau Saran
                  </label>
                  <textarea
                    id="feedback-message"
                    rows={4}
                    required
                    value={feedbackMessage}
                    onChange={(e) => setFeedbackMessage(e.target.value)}
                    placeholder="Tuliskan pengalaman, kritik, atau saran Kakak untuk tim LOUIS BRIDES..."
                    className="w-full px-3.5 py-2.5 rounded-lg border border-[#E6DDD0] bg-white text-sm text-[#2A201B] focus:outline-none focus:border-[#8C6B30]"
                  />
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                  {studioWaDigits && (
                    <a
                      href={managementWaHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-[#1F6E43] text-[#1F6E43] text-xs sm:text-sm font-medium hover:bg-[#ECF7F0] transition-colors"
                    >
                      <MessageCircle className="w-4 h-4" />
                      <span>Teruskan ke WhatsApp Manajemen</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}

                  <button
                    type="submit"
                    disabled={submittingFeedback || !feedbackMessage.trim()}
                    className="min-h-[44px] px-6 py-2.5 rounded-lg bg-[#2A201B] text-[#FAF7F2] text-sm font-medium hover:bg-[#3F312A] disabled:opacity-50 transition-colors cursor-pointer"
                  >
                    {submittingFeedback ? 'Mengirim...' : 'Kirim Kritik & Saran'}
                  </button>
                </div>
              </form>
            </section>
          </div>
        )}
      </main>

      {/* Mobile Bottom Navigation Bar (<= 15% sticky cap, >= 44px tap targets) */}
      <nav
        aria-label="Navigasi Bawah HP"
        className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-white border-t border-[#E6DDD0] h-16 grid grid-cols-5"
      >
        <button
          type="button"
          onClick={() => setActiveTab('BERANDA')}
          className={`flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium ${
            activeTab === 'BERANDA' ? 'text-[#8C6B30]' : 'text-[#5E534B]'
          }`}
        >
          <Home className="w-4 h-4" />
          <span>Beranda</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('PILIH_FOTO')}
          className={`flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium ${
            activeTab === 'PILIH_FOTO' ? 'text-[#8C6B30]' : 'text-[#5E534B]'
          }`}
        >
          <ImageIcon className="w-4 h-4" />
          <span>Pilih Foto</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('LIHAT_EDITAN')}
          className={`flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium ${
            activeTab === 'LIHAT_EDITAN' ? 'text-[#8C6B30]' : 'text-[#5E534B]'
          }`}
        >
          <Eye className="w-4 h-4" />
          <span>Editan</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('STATUS_PEKERJAAN')}
          className={`flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium ${
            activeTab === 'STATUS_PEKERJAAN' ? 'text-[#8C6B30]' : 'text-[#5E534B]'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Status</span>
        </button>

        <button
          type="button"
          onClick={() => setMobileMenuOpen((o) => !o)}
          className="flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium text-[#5E534B]"
        >
          <Menu className="w-4 h-4" />
          <span>Menu</span>
        </button>
      </nav>

      {/* Mobile Secondary Menu Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-40 bg-[#2A201B]/50 flex items-end">
          <div className="bg-white w-full rounded-t-2xl p-5 space-y-2 border-t border-[#E6DDD0]">
            <div className="flex items-center justify-between pb-2 border-b border-[#E6DDD0]">
              <span className="font-serif text-lg font-semibold text-[#2A201B]">
                Menu Portal Lainnya
              </span>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="w-9 h-9 rounded-lg flex items-center justify-center text-[#5E534B]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            {(
              [
                { key: 'REVISI', label: 'Hasil Revisi', icon: Check },
                { key: 'VIDEO', label: 'Galeri Video', icon: Film },
                { key: 'PANDUAN', label: 'Panduan Pemilihan & Revisi', icon: BookOpen },
                {
                  key: 'KRITIK_SARAN',
                  label: 'Kritik & Saran',
                  icon: MessageSquareHeart,
                },
              ] as const
            ).map((item) => {
              const IconComp = item.icon;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => {
                    setActiveTab(item.key);
                    setMobileMenuOpen(false);
                  }}
                  className="w-full min-h-[46px] px-4 py-2.5 rounded-xl bg-[#FAF7F2] text-left text-sm font-medium text-[#2A201B] flex items-center gap-3"
                >
                  <IconComp className="w-4 h-4 text-[#8C6B30]" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Modal Konfirmasi Pengiriman Pilihan Foto (Section 10) */}
      {confirmSubmitOpen && (
        <div
          className="fixed inset-0 z-50 bg-[#2A201B]/60 backdrop-blur-xs flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-submit-title"
        >
          <div className="bg-white border border-[#E6DDD0] rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden shadow-xl">
            <div className="px-6 py-4 bg-[#FAF7F2] border-b border-[#E6DDD0] flex items-center justify-between">
              <div>
                <h3
                  id="confirm-submit-title"
                  className="font-serif text-xl font-semibold text-[#2A201B]"
                >
                  Konfirmasi Pengiriman Pilihan Foto
                </h3>
                <p className="text-xs text-[#5E534B]">
                  {customer.nama_customer} · {customer.kode_unik} · Tanggal:{' '}
                  {new Date().toISOString().slice(0, 10)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setConfirmSubmitOpen(false)}
                aria-label="Tutup konfirmasi pengiriman"
                className="w-9 h-9 rounded-lg flex items-center justify-center text-[#5E534B] hover:bg-[#E6DDD0]/50 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4">
              {/* Validation Errors (Over Quota) */}
              {quotaSummary.validationErrors.length > 0 && (
                <div className="p-4 rounded-xl bg-[#FDF0F0] border border-[#9E2A2B]/30 space-y-1 text-xs text-[#9E2A2B]">
                  {quotaSummary.validationErrors.map((err) => (
                    <p key={err} className="font-medium">
                      • {err}
                    </p>
                  ))}
                </div>
              )}

              {/* Under Quota Warning */}
              {quotaSummary.hasUnderQuotaWarning && (
                <div className="p-4 rounded-xl bg-[#FDF5E6] border border-[#C6A464] text-xs text-[#9A5B13]">
                  Peringatan: Kuota pilihan foto Album ({quotaSummary.albumSelected}/
                  {quotaSummary.albumQuota}) atau Kanvas ({quotaSummary.kanvasSelected}/
                  {quotaSummary.kanvasQuota}) belum terpenuhi sepenuhnya. Anda tetap dapat mengirim
                  jika memang sudah sesuai.
                </div>
              )}

              {/* Summary Counters */}
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="p-3 rounded-lg bg-[#FAF7F2] border border-[#E6DDD0]">
                  <p className="text-xs text-[#5E534B]">Pilihan Album</p>
                  <p className="font-mono text-base font-semibold text-[#2A201B] tabular-nums">
                    {quotaSummary.albumSelected} / {quotaSummary.albumQuota}
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-[#FAF7F2] border border-[#E6DDD0]">
                  <p className="text-xs text-[#5E534B]">Pilihan Kanvas</p>
                  <p className="font-mono text-base font-semibold text-[#2A201B] tabular-nums">
                    {quotaSummary.kanvasSelected} / {quotaSummary.kanvasQuota}
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-[#FAF7F2] border border-[#E6DDD0]">
                  <p className="text-xs text-[#5E534B]">Foto Tambahan</p>
                  <p className="font-mono text-base font-semibold text-[#2A201B] tabular-nums">
                    {quotaSummary.tambahanSelected} foto
                  </p>
                </div>
              </div>

              {/* Selected Photos List */}
              <div className="border border-[#E6DDD0] rounded-xl divide-y divide-[#E6DDD0] max-h-60 overflow-y-auto">
                {selectedSummaryItems.length === 0 ? (
                  <p className="p-4 text-xs text-[#5E534B]">
                    Belum ada foto yang dipilih.
                  </p>
                ) : (
                  selectedSummaryItems.map((it) => (
                    <div key={it.file_id} className="p-3 text-xs space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono font-semibold text-[#2A201B]">
                          {it.file_name}
                        </span>
                        <span className="text-[#8C6B30] font-medium">
                          {[
                            it.pilih_album ? 'ALBUM' : null,
                            it.pilih_kanvas ? 'KANVAS' : null,
                            it.pilih_tambahan ? 'TAMBAHAN' : null,
                          ]
                            .filter(Boolean)
                            .join(' + ')}
                        </span>
                      </div>
                      {it.catatan_edit && (
                        <p className="text-[#5E534B]">Catatan: {it.catatan_edit}</p>
                      )}
                    </div>
                  ))
                )}
              </div>

              {/* Overall Note Input */}
              <div>
                <label
                  htmlFor="confirm-overall-note"
                  className="block text-xs font-medium uppercase tracking-wider text-[#5E534B] mb-1"
                >
                  Catatan Edit Untuk Semua Foto
                </label>
                <textarea
                  id="confirm-overall-note"
                  rows={2}
                  value={overallEditNote}
                  onChange={(e) => handleOverallNoteChange(e.target.value)}
                  placeholder="Catatan tambahan untuk keseluruhan foto..."
                  className="w-full px-3 py-2 rounded-lg border border-[#E6DDD0] bg-[#FAF7F2] text-xs text-[#2A201B]"
                />
              </div>

              {/* Agreement Checkbox */}
              <label className="flex items-start gap-2.5 text-xs text-[#2A201B] cursor-pointer">
                <input
                  type="checkbox"
                  checked={confirmChecked}
                  onChange={(e) => setConfirmChecked(e.target.checked)}
                  className="mt-0.5 accent-[#8C6B30] w-4 h-4"
                />
                <span>
                  Saya telah memeriksa daftar foto pilihan dan catatan dengan benar serta menyetujui
                  pengiriman ke tim {studio.nama_studio}.
                </span>
              </label>
            </div>

            <div className="px-6 py-4 bg-[#FAF7F2] border-t border-[#E6DDD0] flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setConfirmSubmitOpen(false)}
                className="px-4 py-2 rounded-lg text-xs font-medium text-[#5E534B] hover:bg-[#E6DDD0]/40 cursor-pointer"
              >
                Periksa Kembali
              </button>
              <button
                type="button"
                disabled={
                  !quotaSummary.canSubmit || !confirmChecked || submittingSelections
                }
                onClick={handleConfirmSubmitSelections}
                className="min-h-[42px] px-5 py-2 rounded-lg bg-[#2A201B] text-[#FAF7F2] text-xs sm:text-sm font-medium hover:bg-[#3F312A] disabled:opacity-45 cursor-pointer"
              >
                {submittingSelections ? 'Mengirim Pilihan...' : 'Kirim Pilihan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Persetujuan Editan (SUDAH OK / SIAP CETAK) */}
      {approvalModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-[#2A201B]/60 backdrop-blur-xs flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white border border-[#E6DDD0] rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl">
            <h3 className="font-serif text-xl font-semibold text-[#2A201B]">
              Konfirmasi Persetujuan Hasil Editing
            </h3>
            <p className="text-sm text-[#4A3B32] leading-relaxed">
              Apakah Anda yakin seluruh hasil editan sudah sesuai (<strong>SUDAH OK / SIAP CETAK</strong>)?
              Setelah disetujui, pekerjaan akan langsung diteruskan ke tahap produksi cetak.
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setApprovalModalOpen(false)}
                className="px-4 py-2 rounded-lg text-xs font-medium text-[#5E534B] hover:bg-[#FAF7F2] cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={submittingRevision}
                onClick={handleApproveEdits}
                className="px-5 py-2.5 rounded-lg bg-[#1F6E43] text-white text-xs sm:text-sm font-medium hover:bg-[#175533] disabled:opacity-50 cursor-pointer"
              >
                {submittingRevision ? 'Memproses...' : 'Ya, Sudah OK / Siap Cetak'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Pengajuan Revisi (MASIH PERLU REVISI) */}
      {revisionModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-[#2A201B]/60 backdrop-blur-xs flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white border border-[#E6DDD0] rounded-2xl max-w-xl w-full max-h-[88vh] flex flex-col overflow-hidden shadow-xl">
            <div className="px-6 py-4 bg-[#FAF7F2] border-b border-[#E6DDD0] flex items-center justify-between">
              <div>
                <h3 className="font-serif text-xl font-semibold text-[#2A201B]">
                  Kirimkan Permintaan Revisi
                </h3>
                <p className="text-xs text-[#5E534B] tabular-nums">
                  Pengajuan revisi ke-{customer.jumlah_revisi + 1} dari maksimal{' '}
                  {studio.batas_revisi} kali
                </p>
              </div>
              <button
                type="button"
                onClick={() => setRevisionModalOpen(false)}
                className="w-9 h-9 rounded-lg flex items-center justify-center text-[#5E534B] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4">
              <div>
                <label
                  htmlFor="revision-overall-note"
                  className="block text-xs font-medium uppercase tracking-wider text-[#5E534B] mb-1.5"
                >
                  Catatan Keseluruhan (Opsional)
                </label>
                <textarea
                  id="revision-overall-note"
                  rows={3}
                  value={revisionOverallNote}
                  onChange={(e) => setRevisionOverallNote(e.target.value)}
                  placeholder="Tuliskan pesan umum untuk seluruh hasil editan..."
                  className="w-full px-3.5 py-2.5 rounded-lg border border-[#E6DDD0] bg-[#FAF7F2] text-sm text-[#2A201B]"
                />
              </div>

              <div className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-wider text-[#5E534B]">
                  Daftar Foto yang Ditandai Revisi ({activeRevisionDetails.length})
                </p>
                {activeRevisionDetails.length === 0 ? (
                  <p className="text-xs text-[#75655A] bg-[#FAF7F2] p-3 rounded-lg border border-[#E6DDD0]">
                    Belum ada foto yang diberi tanda lingkaran/pin. Anda dapat menandai foto di
                    galeri atau langsung mengirim catatan keseluruhan di atas.
                  </p>
                ) : (
                  <div className="border border-[#E6DDD0] rounded-xl divide-y divide-[#E6DDD0]">
                    {activeRevisionDetails.map((rev) => (
                      <div key={rev.file_id} className="p-3 text-xs space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-mono font-semibold text-[#2A201B]">
                            {rev.file_name}
                          </span>
                          <span className="text-[#9E2A2B] font-medium tabular-nums">
                            {rev.annotations.length} tanda lingkaran/pin
                          </span>
                        </div>
                        {rev.catatan_revisi && (
                          <p className="text-[#4A3B32]">{rev.catatan_revisi}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="px-6 py-4 bg-[#FAF7F2] border-t border-[#E6DDD0] flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setRevisionModalOpen(false)}
                className="px-4 py-2 rounded-lg text-xs font-medium text-[#5E534B] cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={
                  submittingRevision ||
                  (activeRevisionDetails.length === 0 && !revisionOverallNote.trim())
                }
                onClick={handleSubmitRevisionRequest}
                className="min-h-[42px] px-5 py-2 rounded-lg bg-[#9E2A2B] text-white text-xs sm:text-sm font-medium hover:bg-[#822122] disabled:opacity-45 cursor-pointer"
              >
                {submittingRevision ? 'Mengirim Revisi...' : 'KIRIMKAN SEKARANG'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lightbox Modal (Selection Mode or Revision Annotation Mode) */}
      {lightboxState && (
        <PhotoLightboxModal
          mode={lightboxState.mode}
          mediaList={lightboxState.items}
          currentIndex={lightboxState.index}
          onChangeIndex={(nextIdx) =>
            setLightboxState((prev) => (prev ? { ...prev, index: nextIdx } : null))
          }
          onClose={() => setLightboxState(null)}
          selectionMap={selectionMap}
          onToggleSelection={handleToggleSelection}
          onUpdateSelectionNote={handleUpdateSelectionNote}
          revisionMap={revisionMap}
          onSaveRevisionDetail={handleSaveRevisionDetail}
        />
      )}

      {/* Unused icon safeguard */}
      <span className="hidden" aria-hidden="true">
        <Calendar className="w-4 h-4" />
      </span>
    </div>
  );
};
