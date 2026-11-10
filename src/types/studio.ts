export type ServiceCategory = 'PREWEDING' | 'LIPUTAN' | 'KELUARGA';

export type ProductionItemStatus =
  | 'DALAM ANTREAN'
  | 'SEDANG DIPROSES'
  | 'LIHAT EDITAN'
  | 'PROSES CETAK'
  | 'CETAK'
  | 'SUDAH JADI'
  | 'TIDAK PAKAI';

export type WorkflowStatus =
  | 'BELUM_MEMILIH'
  | 'SUDAH_KIRIM_PILIHAN'
  | 'SEDANG_EDITING'
  | 'MENUNGGU_PERSETUJUAN'
  | 'BUTUH_REVISI'
  | 'PROSES_CETAK'
  | 'SELESAI';

export type DriveSubfolderCategory =
  | 'ALL FILE'
  | 'RINGKASAN'
  | 'LIHAT EDITAN'
  | 'REVISI'
  | 'VIDEO';

export type WhatsAppTemplateKey =
  | 'KIRIM_LINK'
  | 'PENGINGAT_PILIH'
  | 'HASIL_EDITING'
  | 'MINTA_PERSETUJUAN'
  | 'PEMBERITAHUAN_REVISI'
  | 'PEKERJAAN_SELESAI';

export interface SubfolderMap {
  'ALL FILE'?: { id: string; url: string };
  RINGKASAN?: { id: string; url: string };
  'LIHAT EDITAN'?: { id: string; url: string };
  REVISI?: { id: string; url: string };
  VIDEO?: { id: string; url: string };
}

export interface CustomerRecord {
  id_customer: string;
  nama_customer: string;
  nama_keluarga?: string;
  paket: string;
  jenis_layanan: ServiceCategory;
  email: string;
  whatsapp: string;
  nama_marketing: string;
  tanggal_pendaftaran: string;
  tanggal_pemotretan: string;
  tanggal_pemilihan?: string;
  tanggal_mulai_kerja?: string;
  tanggal_cetak?: string;
  estimasi_selesai?: string;
  kuota_album: number;
  kuota_kanvas: number;
  ukuran_kanvas: string;
  kuota_tambahan: number;
  catatan_customer?: string;
  catatan_produksi?: string;
  drive_folder_id?: string;
  drive_folder_url?: string;
  subfolder_ids?: SubfolderMap;
  kode_unik: string;
  status_pekerjaan: WorkflowStatus;
  status_album: ProductionItemStatus;
  status_kanvas: ProductionItemStatus;
  jumlah_revisi: number;
  izinkan_download: boolean;
  created_at: string;
}

export interface DriveMediaItem {
  id: string;
  name: string;
  category: DriveSubfolderCategory;
  mimeType: string;
  sizeBytes: number;
  createdTime: string;
  thumbnailUrl: string;
  previewUrl: string;
  downloadUrl: string;
}

export interface PhotoSelectionItem {
  file_id: string;
  file_name: string;
  pilih_album: boolean;
  pilih_kanvas: boolean;
  pilih_tambahan: boolean;
  tebus_file?: string;
  catatan_edit: string;
}

export interface PhotoSelectionSubmission {
  id_pilihan: string;
  id_customer: string;
  kode_unik: string;
  nama_customer: string;
  jumlah_album: number;
  jumlah_kanvas: number;
  jumlah_tambahan: number;
  catatan_keseluruhan: string;
  waktu_pengiriman: string;
  estimasi_selesai: string;
  items: PhotoSelectionItem[];
}

export interface PhotoAnnotation {
  id: string;
  type: 'circle' | 'pin';
  x: number;
  y: number;
  rx?: number;
  ry?: number;
  pinNumber?: number;
  label?: string;
}

export interface PhotoRevisionDetail {
  file_id: string;
  file_name: string;
  catatan_revisi: string;
  annotations: PhotoAnnotation[];
}

export interface FeedbackRecord {
  id_feedback: string;
  id_customer: string;
  kode_unik: string;
  nama_customer: string;
  jenis_feedback: 'EDIT_APPROVAL' | 'REVISION_REQUEST' | 'CRITIC_SUGGESTION';
  rating?: number;
  kategori_masukan?: string;
  catatan_umum: string;
  revisi_ke?: number;
  detail_revisi?: PhotoRevisionDetail[];
  waktu_kirim: string;
}

export interface MarketingMember {
  id_marketing: string;
  nama: string;
  whatsapp: string;
  email: string;
  status: 'AKTIF' | 'NONAKTIF';
}

export interface ActivityLogRecord {
  id_log: string;
  waktu: string;
  aktor: 'ADMIN' | 'CUSTOMER' | 'SISTEM';
  kode_unik?: string;
  nama_customer?: string;
  aksi: string;
  detail: string;
}

export interface StudioSettings {
  nama_studio: string;
  logo_url: string;
  public_app_url: string;
  gas_webapp_url: string;
  spreadsheet_id: string;
  drive_root_folder_id: string;
  email_admin: string;
  whatsapp_studio: string;
  zona_waktu: string;
  default_kuota_album: number;
  default_kuota_kanvas: number;
  default_ukuran_kanvas: string;
  default_kuota_tambahan: number;
  batas_revisi: number;
  estimasi_pengerjaan_bulan: number;
  izinkan_download_all_file: boolean;
  izinkan_download_ringkasan: boolean;
  izinkan_download_editan: boolean;
  izinkan_download_revisi: boolean;
  izinkan_download_video: boolean;
  whatsapp_templates: Record<WhatsAppTemplateKey, string>;
}

export type ConnectionState = 'TERHUBUNG' | 'GAGAL TERHUBUNG' | 'BELUM DIKONFIGURASI';

export interface ConnectionServiceCheck {
  service: 'Backend Aplikasi' | 'Google Apps Script' | 'Google Sheets' | 'Google Drive';
  status: ConnectionState;
  message: string;
  checked_at: string;
}

export interface ConnectionTestResult {
  overall: ConnectionState;
  checks: ConnectionServiceCheck[];
}

export interface AdminFullDataPayload {
  customers: CustomerRecord[];
  selections: PhotoSelectionSubmission[];
  feedbacks: FeedbackRecord[];
  marketing: MarketingMember[];
  logs: ActivityLogRecord[];
  settings: StudioSettings;
}

export interface CustomerPortalPayload {
  customer: CustomerRecord;
  studio: {
    nama_studio: string;
    logo_url: string;
    whatsapp_studio: string;
    batas_revisi: number;
    izinkan_download_all_file: boolean;
    izinkan_download_ringkasan: boolean;
    izinkan_download_editan: boolean;
    izinkan_download_revisi: boolean;
    izinkan_download_video: boolean;
  };
  draftSelections: PhotoSelectionItem[];
  draftOverallNote: string;
  submissions: PhotoSelectionSubmission[];
  feedbacks: FeedbackRecord[];
  logs: ActivityLogRecord[];
}
