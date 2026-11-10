import type {
  CustomerRecord,
  DriveMediaItem,
  DriveSubfolderCategory,
  PhotoSelectionItem,
  ProductionItemStatus,
  StudioSettings,
  WhatsAppTemplateKey,
} from '../types/studio';

export const PRODUCTION_STATUS_LIST: ProductionItemStatus[] = [
  'DALAM ANTREAN',
  'SEDANG DIPROSES',
  'LIHAT EDITAN',
  'PROSES CETAK',
  'CETAK',
  'SUDAH JADI',
  'TIDAK PAKAI',
];

export const DEFAULT_WHATSAPP_TEMPLATES: Record<WhatsAppTemplateKey, string> = {
  KIRIM_LINK:
    'Halo Kak {nama_customer} 👋\n\nTerima kasih telah mempercayakan momen spesial bersama LOUIS BRIDES.\nSilakan akses portal pemilihan foto melalui tautan berikut:\n🔗 {link_customer}\nKode Unik: {kode_unik}\n\nMohon segera mengunduh file asli dan menyelesaikan pilihan foto Album & Kanvas sebelum batas penyimpanan 30 hari berakhir.\n\nSalam hangat,\n{nama_marketing} — LOUIS BRIDES',
  PENGINGAT_PILIH:
    'Halo Kak {nama_customer} 👋\n\nMengingatkan kembali untuk pemilihan foto Album & Kanvas melalui tautan portal berikut:\n🔗 {link_customer}\nKode Unik: {kode_unik}\n\nAgar proses editing dan produksi berjalan sesuai jadwal, silakan kirimkan pilihan foto Kakak segera ya.\n\nSalam hangat,\n{nama_marketing} — LOUIS BRIDES',
  HASIL_EDITING:
    'Halo Kak {nama_customer} ✨\n\nHasil editing foto Kakak sudah tersedia di menu LIHAT EDITAN pada portal:\n🔗 {link_customer}\nKode Unik: {kode_unik}\n\nSilakan periksa setiap foto dan berikan persetujuan atau catatan revisi langsung dari portal.\n\nSalam hangat,\n{nama_marketing} — LOUIS BRIDES',
  MINTA_PERSETUJUAN:
    'Halo Kak {nama_customer} 👋\n\nHasil editing foto Kakak saat ini menunggu konfirmasi persetujuan sebelum masuk tahap cetak.\nSilakan buka menu LIHAT EDITAN di:\n🔗 {link_customer}\nKode Unik: {kode_unik}\n\nKlik "SUDAH OK / SIAP CETAK" jika seluruh hasil editan sudah sesuai.\n\nSalam hangat,\n{nama_marketing} — LOUIS BRIDES',
  PEMBERITAHUAN_REVISI:
    'Halo Kak {nama_customer} ✨\n\nHasil perbaikan/revisi foto sesuai catatan Kakak telah kami unggah ke menu REVISI.\nSilakan cek hasilnya melalui tautan:\n🔗 {link_customer}\nKode Unik: {kode_unik}\n\nSalam hangat,\n{nama_marketing} — LOUIS BRIDES',
  PEKERJAAN_SELESAI:
    'Halo Kak {nama_customer} 🎉\n\nKabar gembira! Seluruh pengerjaan Album & Kanvas LOUIS BRIDES Kakak telah SELESAI (Estimasi: {estimasi_selesai}).\nTim kami akan segera menghubungi untuk serah terima/pengiriman hasil cetak.\n\nCek status lengkap di: {link_customer}\nFolder Drive: {link_drive}\n\nSalam hangat,\n{nama_marketing} — LOUIS BRIDES',
};

export function createDefaultSettings(): StudioSettings {
  return {
    nama_studio: 'LOUIS BRIDES',
    logo_url: '',
    public_app_url: '',
    gas_webapp_url: '',
    spreadsheet_id: '',
    drive_root_folder_id: '1qsd1Ozk8hHC97HyTNCTvq57ZTCx18AGF',
    email_admin: 'andre.louisbrides@gmail.com',
    whatsapp_studio: '6281122334455',
    zona_waktu: 'Asia/Jakarta',
    default_kuota_album: 20,
    default_kuota_kanvas: 1,
    default_ukuran_kanvas: '60x90 cm',
    default_kuota_tambahan: 10,
    batas_revisi: 2,
    estimasi_pengerjaan_bulan: 2,
    izinkan_download_all_file: true,
    izinkan_download_ringkasan: true,
    izinkan_download_editan: true,
    izinkan_download_revisi: true,
    izinkan_download_video: true,
    whatsapp_templates: { ...DEFAULT_WHATSAPP_TEMPLATES },
  };
}

/**
 * Natural alphanumeric filename comparison so "001.jpg", "002.jpg", "010.jpg"
 * sort in human numerical order rather than lexicographical "001, 010, 002".
 */
export function compareNaturalFilenames(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
}

export function sortMediaNaturally<T extends { name: string }>(
  items: T[],
  direction: 'asc' | 'desc' = 'asc'
): T[] {
  const sorted = [...items].sort((a, b) => compareNaturalFilenames(a.name, b.name));
  return direction === 'desc' ? sorted.reverse() : sorted;
}

/**
 * Toggle photo selection flag while enforcing business rule:
 * If a photo is selected for PILIH ALBUM, it cannot simultaneously be selected for FOTO TAMBAHAN.
 * However, PILIH ALBUM + PILIH KANVAS is permitted.
 */
export function applyPhotoSelectionToggle(
  current: PhotoSelectionItem | undefined,
  file: { id: string; name: string },
  field: 'pilih_album' | 'pilih_kanvas' | 'pilih_tambahan'
): PhotoSelectionItem {
  const base: PhotoSelectionItem = current
    ? { ...current }
    : {
        file_id: file.id,
        file_name: file.name,
        pilih_album: false,
        pilih_kanvas: false,
        pilih_tambahan: false,
        catatan_edit: '',
      };

  const nextValue = !base[field];
  base[field] = nextValue;

  if (field === 'pilih_album' && nextValue) {
    base.pilih_tambahan = false;
  } else if (field === 'pilih_tambahan' && nextValue) {
    base.pilih_album = false;
  }

  return base;
}

export type QuotaIndicatorState = 'BELUM_TERPENUHI' | 'SUDAH_TERPENUHI' | 'MELEBIHI_KUOTA';

export interface SelectionQuotaSummary {
  albumSelected: number;
  albumQuota: number;
  albumState: QuotaIndicatorState;
  kanvasSelected: number;
  kanvasQuota: number;
  kanvasState: QuotaIndicatorState;
  tambahanSelected: number;
  totalNotes: number;
  canSubmit: boolean;
  hasUnderQuotaWarning: boolean;
  validationErrors: string[];
}

export function evaluateSelectionQuotas(
  items: PhotoSelectionItem[],
  kuotaAlbum: number,
  kuotaKanvas: number
): SelectionQuotaSummary {
  let albumSelected = 0;
  let kanvasSelected = 0;
  let tambahanSelected = 0;
  let totalNotes = 0;

  for (const item of items) {
    if (item.pilih_album) albumSelected += 1;
    if (item.pilih_kanvas) kanvasSelected += 1;
    if (item.pilih_tambahan) tambahanSelected += 1;
    if (item.catatan_edit && item.catatan_edit.trim().length > 0) totalNotes += 1;
  }

  const getQuotaState = (selected: number, quota: number): QuotaIndicatorState => {
    if (selected > quota) return 'MELEBIHI_KUOTA';
    if (selected === quota) return 'SUDAH_TERPENUHI';
    return 'BELUM_TERPENUHI';
  };

  const albumState = getQuotaState(albumSelected, kuotaAlbum);
  const kanvasState = getQuotaState(kanvasSelected, kuotaKanvas);

  const validationErrors: string[] = [];
  if (albumSelected > kuotaAlbum) {
    validationErrors.push(
      `Pilihan foto Album (${albumSelected}) melebihi kuota pesanan (${kuotaAlbum} foto).`
    );
  }
  if (kanvasSelected > kuotaKanvas) {
    validationErrors.push(
      `Pilihan foto Kanvas (${kanvasSelected}) melebihi kuota pesanan (${kuotaKanvas} foto).`
    );
  }
  if (albumSelected === 0 && kanvasSelected === 0 && tambahanSelected === 0) {
    validationErrors.push('Pilih minimal 1 foto sebelum mengirimkan pilihan.');
  }

  const hasUnderQuotaWarning =
    validationErrors.length === 0 &&
    (albumSelected < kuotaAlbum || kanvasSelected < kuotaKanvas);

  return {
    albumSelected,
    albumQuota: kuotaAlbum,
    albumState,
    kanvasSelected,
    kanvasQuota: kuotaKanvas,
    kanvasState,
    tambahanSelected,
    totalNotes,
    canSubmit: validationErrors.length === 0,
    hasUnderQuotaWarning,
    validationErrors,
  };
}

/**
 * Calculate automatic completion date N calendar months from submission date (YYYY-MM-DD),
 * clamping month-end rollover safely (e.g., Dec 31 + 2 months -> Feb 28/29).
 */
export function calculateEstimatedCompletionDate(
  submissionDateIso: string,
  monthsToAdd = 2
): string {
  const datePart = submissionDateIso.slice(0, 10);
  const parts = datePart.split('-').map(Number);
  if (parts.length !== 3 || parts.some(Number.isNaN)) {
    const now = new Date();
    return calculateEstimatedCompletionDate(now.toISOString().slice(0, 10), monthsToAdd);
  }
  const [year, month, day] = parts;
  const targetMonthZeroIndexed = month - 1 + monthsToAdd;
  const targetYear = year + Math.floor(targetMonthZeroIndexed / 12);
  const targetMonth = ((targetMonthZeroIndexed % 12) + 12) % 12;

  const daysInTargetMonth = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
  const clampedDay = Math.min(day, daysInTargetMonth);

  const mm = String(targetMonth + 1).padStart(2, '0');
  const dd = String(clampedDay).padStart(2, '0');
  return `${targetYear}-${mm}-${dd}`;
}

/**
 * Format any ISO date string or date-like value into strict DD-MM-YYYY format.
 * Returns '-' or fallback if empty or invalid.
 */
export function formatDateDDMMYYYY(dateStr?: string | null, fallback = '-'): string {
  if (!dateStr || !dateStr.trim()) return fallback;
  const clean = dateStr.trim();
  // If already DD-MM-YYYY (e.g. 15-08-2026)
  if (/^\d{2}-\d{2}-\d{4}$/.test(clean)) {
    return clean;
  }
  // If YYYY-MM-DD or ISO string (e.g. 2026-08-15 or 2026-08-15T09:00:00Z)
  const isoMatch = clean.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (isoMatch) {
    const [, yyyy, mm, dd] = isoMatch;
    return `${dd.padStart(2, '0')}-${mm.padStart(2, '0')}-${yyyy}`;
  }
  // Try Date parsing
  const parsed = new Date(clean);
  if (!Number.isNaN(parsed.getTime())) {
    const dd = String(parsed.getDate()).padStart(2, '0');
    const mm = String(parsed.getMonth() + 1).padStart(2, '0');
    const yyyy = String(parsed.getFullYear());
    return `${dd}-${mm}-${yyyy}`;
  }
  return clean;
}

/**
 * Normalize any date string (ISO, Date.toString(), or DD-MM-YYYY) into HTML5 date input format YYYY-MM-DD.
 */
export function toInputDateFormat(dateStr?: string | null): string {
  if (!dateStr || !dateStr.trim()) return '';
  const clean = dateStr.trim();
  // If already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) return clean;
  // If ISO string with timestamp (e.g. 2026-11-06T12:00:00...)
  if (/^\d{4}-\d{2}-\d{2}T/.test(clean)) {
    return clean.slice(0, 10);
  }
  // If DD-MM-YYYY (e.g. 05-11-2026)
  const ddmmyyyy = clean.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (ddmmyyyy) {
    const [, dd, mm, yyyy] = ddmmyyyy;
    return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
  }
  // If Date.toString() like 'Fri Nov 06 2026...'
  const MONTHS: Record<string, string> = {
    jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
    jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12'
  };
  const dateStrMatch = clean.match(/[A-Za-z]{3}\s+([A-Za-z]{3})\s+(\d{1,2})\s+(\d{4})/i);
  if (dateStrMatch) {
    const [, monStr, ddStr, yyyyStr] = dateStrMatch;
    const mm = MONTHS[monStr.toLowerCase()];
    if (mm) {
      return `${yyyyStr}-${mm}-${ddStr.padStart(2, '0')}`;
    }
  }
  // Try Date parse
  const parsed = new Date(clean);
  if (!Number.isNaN(parsed.getTime())) {
    const yyyy = String(parsed.getFullYear());
    const mm = String(parsed.getMonth() + 1).padStart(2, '0');
    const dd = String(parsed.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }
  return '';
}

/**
 * Calculate 30-day active retention countdown for customer ALL FILE gallery.
 */
export function calculateRetentionStatus(
  createdAtIso: string,
  referenceDate: Date = new Date()
): {
  daysElapsed: number;
  daysRemaining: number;
  isExpired: boolean;
  isUrgent: boolean;
  expiryDateStr: string;
} {
  const created = new Date(createdAtIso);
  const validCreated = Number.isNaN(created.getTime()) ? referenceDate : created;
  const msPerDay = 24 * 60 * 60 * 1000;
  const daysElapsed = Math.max(
    0,
    Math.floor((referenceDate.getTime() - validCreated.getTime()) / msPerDay)
  );
  const daysRemaining = Math.max(0, 30 - daysElapsed);
  const expiryDate = new Date(validCreated.getTime() + 30 * msPerDay);

  return {
    daysElapsed,
    daysRemaining,
    isExpired: daysRemaining === 0,
    isUrgent: daysRemaining <= 7,
    expiryDateStr: expiryDate.toISOString().slice(0, 10),
  };
}

const ID_MONTH_NAMES = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

export function formatDateIndonesian(dateInput: Date | string): string {
  const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  if (Number.isNaN(date.getTime())) return '-';
  const d = String(date.getDate()).padStart(2, '0');
  const m = ID_MONTH_NAMES[date.getMonth()];
  const y = date.getFullYear();
  return `${d} ${m} ${y}`;
}

export type VideoWarningStatus =
  | 'SAFE'
  | 'WARNING'
  | 'HIGH_WARNING'
  | 'CRITICAL'
  | 'EXPIRED'
  | 'UNKNOWN';

export interface VideoRetentionInfo {
  hasValidDate: boolean;
  uploadDateFormatted: string;
  deadlineFormatted: string;
  remainingDays: number;
  remainingHours: number;
  remainingText: string;
  status: VideoWarningStatus;
  statusText: string;
  isExpired: boolean;
  badgeColorClass: string;
  badgeBgClass: string;
  badgeBorderClass: string;
}

/**
 * Calculate automated 30-day calendar retention countdown for Google Drive video files.
 * Rule:
 * - Start date: file created/uploaded date
 * - Retention: 30 calendar days
 * - End date: start date + 30 days
 * - Remaining: end date - now
 *
 * Warning levels:
 * - > 7 days: Masa penyimpanan masih tersedia. (SAFE)
 * - <= 7 days: Peringatan, segera download video. (WARNING)
 * - <= 3 days: Peringatan penting, masa penyimpanan hampir habis. (HIGH_WARNING)
 * - <= 1 day: Peringatan mendesak. (CRITICAL)
 * - <= 0: Masa retensi telah berakhir. (EXPIRED)
 */
export function calculateVideoRetentionStatus(
  createdTimeStr?: string | null,
  now: Date = new Date()
): VideoRetentionInfo {
  if (!createdTimeStr || !createdTimeStr.trim()) {
    return {
      hasValidDate: false,
      uploadDateFormatted: 'Tanggal upload belum tersedia',
      deadlineFormatted: 'Tanggal upload belum tersedia',
      remainingDays: 0,
      remainingHours: 0,
      remainingText: 'Tanggal upload belum tersedia',
      status: 'UNKNOWN',
      statusText: 'Tanggal upload belum tersedia',
      isExpired: false,
      badgeColorClass: 'text-[#75655A]',
      badgeBgClass: 'bg-[#FAF7F2]',
      badgeBorderClass: 'border-[#E6DDD0]',
    };
  }

  const uploadDate = new Date(createdTimeStr.trim());
  if (Number.isNaN(uploadDate.getTime())) {
    return {
      hasValidDate: false,
      uploadDateFormatted: 'Tanggal upload belum tersedia',
      deadlineFormatted: 'Tanggal upload belum tersedia',
      remainingDays: 0,
      remainingHours: 0,
      remainingText: 'Tanggal upload belum tersedia',
      status: 'UNKNOWN',
      statusText: 'Tanggal upload belum tersedia',
      isExpired: false,
      badgeColorClass: 'text-[#75655A]',
      badgeBgClass: 'bg-[#FAF7F2]',
      badgeBorderClass: 'border-[#E6DDD0]',
    };
  }

  const deadlineMs = uploadDate.getTime() + 30 * 24 * 60 * 60 * 1000;
  const deadlineDate = new Date(deadlineMs);
  const diffMs = deadlineMs - now.getTime();

  const uploadDateFormatted = formatDateIndonesian(uploadDate);
  const deadlineFormatted = formatDateIndonesian(deadlineDate);

  if (diffMs <= 0) {
    return {
      hasValidDate: true,
      uploadDateFormatted,
      deadlineFormatted,
      remainingDays: 0,
      remainingHours: 0,
      remainingText: 'Masa retensi telah berakhir',
      status: 'EXPIRED',
      statusText: 'Masa retensi telah berakhir',
      isExpired: true,
      badgeColorClass: 'text-[#9E2A2B]',
      badgeBgClass: 'bg-[#FDF0F0]',
      badgeBorderClass: 'border-[#9E2A2B]/30',
    };
  }

  const totalHours = Math.floor(diffMs / (1000 * 60 * 60));
  const remainingDays = Math.floor(totalHours / 24);
  const remainingHours = totalHours % 24;

  let remainingText = '';
  if (remainingDays > 0) {
    remainingText = `${remainingDays} hari ${remainingHours} jam lagi`;
  } else {
    remainingText = `${remainingHours} jam lagi`;
  }

  if (remainingDays <= 1) {
    return {
      hasValidDate: true,
      uploadDateFormatted,
      deadlineFormatted,
      remainingDays,
      remainingHours,
      remainingText,
      status: 'CRITICAL',
      statusText: 'Peringatan mendesak',
      isExpired: false,
      badgeColorClass: 'text-[#9E2A2B]',
      badgeBgClass: 'bg-[#FDF0F0]',
      badgeBorderClass: 'border-[#9E2A2B]/40',
    };
  }

  if (remainingDays <= 3) {
    return {
      hasValidDate: true,
      uploadDateFormatted,
      deadlineFormatted,
      remainingDays,
      remainingHours,
      remainingText,
      status: 'HIGH_WARNING',
      statusText: 'Peringatan penting, masa penyimpanan hampir habis',
      isExpired: false,
      badgeColorClass: 'text-[#B43403]',
      badgeBgClass: 'bg-[#FEF3C7]',
      badgeBorderClass: 'border-[#F59E0B]/40',
    };
  }

  if (remainingDays <= 7) {
    return {
      hasValidDate: true,
      uploadDateFormatted,
      deadlineFormatted,
      remainingDays,
      remainingHours,
      remainingText,
      status: 'WARNING',
      statusText: 'Peringatan, segera download video',
      isExpired: false,
      badgeColorClass: 'text-[#9A5B13]',
      badgeBgClass: 'bg-[#FFFBEB]',
      badgeBorderClass: 'border-[#FDE68A]',
    };
  }

  return {
    hasValidDate: true,
    uploadDateFormatted,
    deadlineFormatted,
    remainingDays,
    remainingHours,
    remainingText,
    status: 'SAFE',
    statusText: 'Masa penyimpanan masih tersedia',
    isExpired: false,
    badgeColorClass: 'text-[#1F6E43]',
    badgeBgClass: 'bg-[#ECF7F0]',
    badgeBorderClass: 'border-[#1F6E43]/30',
  };
}

/**
 * Format Indonesian / international phone numbers to clean E.164 digits (without '+')
 * for WhatsApp links (e.g. "0812-3456-7890" -> "6281234567890").
 */
export function formatInternationalWhatsApp(rawPhone: string): string {
  const digits = rawPhone.replace(/[^\d]/g, '');
  if (!digits) return '';
  if (digits.startsWith('0')) {
    return `62${digits.slice(1)}`;
  }
  if (digits.startsWith('8')) {
    return `62${digits}`;
  }
  return digits;
}

export function buildCustomerPortalUrl(publicAppUrl: string, kodeUnik: string): string {
  const base = (publicAppUrl || '').trim().replace(/\/+$/, '');
  const cleanCode = encodeURIComponent(kodeUnik.trim().toUpperCase());
  return base ? `${base}/c/${cleanCode}` : `/c/${cleanCode}`;
}

export function interpolateWhatsAppMessage(
  template: string,
  customer: CustomerRecord,
  publicAppUrl: string
): string {
  const portalLink = buildCustomerPortalUrl(publicAppUrl || 'https://louisbrides.pages.dev', customer.kode_unik);
  const replacements: Record<string, string> = {
    '{nama_customer}': customer.nama_customer || '-',
    '{kode_unik}': customer.kode_unik || '-',
    '{link_customer}': portalLink,
    '{nama_marketing}': customer.nama_marketing || 'Tim LOUIS BRIDES',
    '{estimasi_selesai}': customer.estimasi_selesai || '2 bulan setelah pengiriman pilihan',
    '{link_drive}': customer.drive_folder_url || 'Tersedia di Portal Customer',
  };

  let output = template;
  for (const [token, value] of Object.entries(replacements)) {
    output = output.split(token).join(value);
  }
  return output;
}

/**
 * Generate a clean, unambiguous unique customer code like "LB-W3JL2".
 */
export function generateUniqueCustomerCode(existingCodes: Set<string>): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  for (let attempt = 0; attempt < 50; attempt++) {
    let suffix = '';
    for (let i = 0; i < 5; i++) {
      suffix += alphabet[Math.floor(Math.random() * alphabet.length)];
    }
    const candidate = `LB-${suffix}`;
    if (!existingCodes.has(candidate.toUpperCase())) {
      return candidate;
    }
  }
  return `LB-${Date.now().toString(36).toUpperCase().slice(-5)}`;
}

export function isCustomerJobOverdue(
  customer: CustomerRecord,
  todayIso: string = new Date().toISOString().slice(0, 10)
): boolean {
  if (!customer.estimasi_selesai) return false;
  if (customer.status_pekerjaan === 'SELESAI') return false;
  return customer.estimasi_selesai < todayIso;
}

export function isCustomerApproachingDeadline(
  customer: CustomerRecord,
  todayIso: string = new Date().toISOString().slice(0, 10),
  withinDays = 14
): boolean {
  if (!customer.estimasi_selesai) return false;
  if (customer.status_pekerjaan === 'SELESAI') return false;
  const today = new Date(`${todayIso}T00:00:00Z`).getTime();
  const due = new Date(`${customer.estimasi_selesai}T00:00:00Z`).getTime();
  if (Number.isNaN(today) || Number.isNaN(due)) return false;
  const diffDays = Math.ceil((due - today) / (24 * 60 * 60 * 1000));
  return diffDays >= 0 && diffDays <= withinDays;
}

export function isFolderDownloadAllowed(
  category: DriveSubfolderCategory,
  customer: CustomerRecord,
  studioSettings: {
    izinkan_download_all_file: boolean;
    izinkan_download_ringkasan: boolean;
    izinkan_download_editan: boolean;
    izinkan_download_revisi: boolean;
    izinkan_download_video: boolean;
  }
): boolean {
  if (!customer.izinkan_download) return false;
  switch (category) {
    case 'ALL FILE':
      return studioSettings.izinkan_download_all_file;
    case 'RINGKASAN':
      return studioSettings.izinkan_download_ringkasan;
    case 'LIHAT EDITAN':
      return studioSettings.izinkan_download_editan;
    case 'REVISI':
      return studioSettings.izinkan_download_revisi;
    case 'VIDEO':
      return studioSettings.izinkan_download_video;
    default:
      return false;
  }
}

export function filterMediaBySearchAndSelection(
  media: DriveMediaItem[],
  searchQuery: string,
  selectionFilter: 'ALL' | 'ALBUM' | 'KANVAS' | 'TAMBAHAN' | 'NOTES',
  selectionMap: Record<string, PhotoSelectionItem>
): DriveMediaItem[] {
  const q = searchQuery.trim().toLowerCase();
  return media.filter((item) => {
    if (q && !item.name.toLowerCase().includes(q)) {
      return false;
    }
    const sel = selectionMap[item.id];
    if (selectionFilter === 'ALBUM') return Boolean(sel?.pilih_album);
    if (selectionFilter === 'KANVAS') return Boolean(sel?.pilih_kanvas);
    if (selectionFilter === 'TAMBAHAN') return Boolean(sel?.pilih_tambahan);
    if (selectionFilter === 'NOTES') return Boolean(sel?.catatan_edit?.trim());
    return true;
  });
}

export function buildCustomersCsv(customers: CustomerRecord[]): string {
  const headers = [
    'ID Customer',
    'Kode Unik',
    'Nama Customer',
    'Nama Keluarga',
    'Jenis Layanan',
    'Paket',
    'Marketing',
    'WhatsApp',
    'Email',
    'Tanggal Pendaftaran',
    'Tanggal Pemotretan',
    'Tanggal Pemilihan',
    'Estimasi Selesai',
    'Kuota Album',
    'Kuota Kanvas',
    'Ukuran Kanvas',
    'Kuota Tambahan',
    'Status Pekerjaan',
    'Status Album',
    'Status Kanvas',
    'Jumlah Revisi',
    'Link Folder Drive',
  ];

  const escapeCell = (val: unknown): string => {
    const str = String(val ?? '');
    if (/[",\n\r]/.test(str)) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const rows = customers.map((c) =>
    [
      c.id_customer,
      c.kode_unik,
      c.nama_customer,
      c.nama_keluarga || '',
      c.jenis_layanan,
      c.paket,
      c.nama_marketing,
      c.whatsapp,
      c.email,
      c.tanggal_pendaftaran,
      c.tanggal_pemotretan,
      c.tanggal_pemilihan || '',
      c.estimasi_selesai || '',
      c.kuota_album,
      c.kuota_kanvas,
      c.ukuran_kanvas,
      c.kuota_tambahan,
      c.status_pekerjaan,
      c.status_album,
      c.status_kanvas,
      c.jumlah_revisi,
      c.drive_folder_url || '',
    ]
      .map(escapeCell)
      .join(',')
  );

  return '\uFEFF' + [headers.map(escapeCell).join(','), ...rows].join('\r\n');
}
