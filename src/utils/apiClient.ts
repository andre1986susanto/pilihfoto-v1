import JSZip from 'jszip';
import type {
  AdminFullDataPayload,
  ConnectionTestResult,
  CustomerPortalPayload,
  CustomerRecord,
  DriveMediaItem,
  DriveSubfolderCategory,
  FeedbackRecord,
  MarketingMember,
  PhotoSelectionItem,
  PhotoSelectionSubmission,
  StudioSettings,
} from '../types/studio';

const ADMIN_TOKEN_KEY = 'lb_admin_session_token';
const API_BASE = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/+$/, '');

export function getStoredAdminToken(): string | null {
  try {
    return sessionStorage.getItem(ADMIN_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setStoredAdminToken(token: string | null) {
  try {
    if (token) {
      sessionStorage.setItem(ADMIN_TOKEN_KEY, token);
    } else {
      sessionStorage.removeItem(ADMIN_TOKEN_KEY);
    }
  } catch {
    // Ignore storage errors in restricted environments
  }
}

async function requestJson<T>(url: string, options: RequestInit = {}): Promise<T> {
  const token = getStoredAdminToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) || {}),
  };
  if (token && !headers.Authorization) {
    headers.Authorization = `Bearer ${token}`;
  }

  const targetUrl = url.startsWith('http')
    ? url
    : API_BASE
    ? `${API_BASE}${url}`
    : url;

  const resp = await fetch(targetUrl, {
    ...options,
    headers,
  });

  const data = (await resp.json().catch(() => ({}))) as T & {
    ok?: boolean;
    notFound?: boolean;
    error?: string;
  };

  if (!resp.ok || data.ok === false) {
    const err = new Error(data.error || `Permintaan gagal (HTTP ${resp.status}).`);
    if (data.notFound || resp.status === 404) {
      err.name = 'NotFoundError';
    }
    throw err;
  }
  return data;
}

export async function fetchPublicConfig() {
  return requestJson<{
    ok: true;
    studio: {
      nama_studio: string;
      logo_url: string;
      whatsapp_studio: string;
      zona_waktu: string;
      is_gas_configured: boolean;
    };
  }>('/api/public-config');
}

export async function loginAdmin(_pin?: string) {
  // Admin login removed: always succeed
  setStoredAdminToken('open-access-token');
  return { ok: true as const, token: 'open-access-token' };
}

export async function checkAdminSession(): Promise<boolean> {
  // Admin login removed: open access
  return true;
}

export async function logoutAdmin() {
  setStoredAdminToken(null);
}

export async function changeAdminPin(currentPin: string, newPin: string) {
  const res = await requestJson<{ ok: true; token: string; message: string }>(
    '/api/auth/change-pin',
    {
      method: 'POST',
      body: JSON.stringify({ current_pin: currentPin, new_pin: newPin }),
    }
  );
  setStoredAdminToken(res.token);
  return res;
}

export async function fetchCustomerPortal(code: string) {
  return requestJson<{ ok: true } & CustomerPortalPayload>(
    `/api/customer?code=${encodeURIComponent(code.trim().toUpperCase())}`
  );
}

export async function fetchCustomerPhotos(code: string) {
  return requestJson<{ ok: true; kode_unik: string; media: DriveMediaItem[] }>(
    `/api/photos?code=${encodeURIComponent(code.trim().toUpperCase())}`
  );
}

export async function saveCustomerDraftSelections(
  kodeUnik: string,
  items: PhotoSelectionItem[],
  catatanKeseluruhan: string
) {
  return requestJson<{ ok: true }>('/api/selections/draft', {
    method: 'POST',
    body: JSON.stringify({
      kode_unik: kodeUnik,
      items,
      catatan_keseluruhan: catatanKeseluruhan,
    }),
  });
}

export async function submitCustomerSelections(
  kodeUnik: string,
  items: PhotoSelectionItem[],
  catatanKeseluruhan: string
) {
  return requestJson<{
    ok: true;
    submission?: PhotoSelectionSubmission;
    estimasi_selesai: string;
    waktu_pengiriman: string;
  }>('/api/selections', {
    method: 'POST',
    body: JSON.stringify({
      kode_unik: kodeUnik,
      items,
      catatan_keseluruhan: catatanKeseluruhan,
    }),
  });
}

export async function submitCustomerFeedback(payload: {
  kode_unik: string;
  jenis_feedback: FeedbackRecord['jenis_feedback'];
  rating?: number;
  kategori_masukan?: string;
  catatan_umum: string;
  detail_revisi?: FeedbackRecord['detail_revisi'];
}) {
  return requestJson<{
    ok: true;
    feedback?: FeedbackRecord;
    revisi_ke?: number;
  }>('/api/feedback', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function fetchAdminFullData() {
  return requestJson<{ ok: true } & AdminFullDataPayload>('/api/customers');
}

export async function saveCustomerRecord(customer: Partial<CustomerRecord>) {
  return requestJson<{ ok: true; customer: CustomerRecord }>('/api/customer', {
    method: 'POST',
    body: JSON.stringify(customer),
  });
}

export async function deleteCustomerRecord(kodeUnik: string) {
  return requestJson<{ ok: true }>(
    `/api/customer?code=${encodeURIComponent(kodeUnik)}`,
    { method: 'DELETE' }
  );
}

export async function updateCustomerProductionStatus(
  payload: Partial<CustomerRecord> & { kode_unik: string }
) {
  return requestJson<{ ok: true; customer?: CustomerRecord }>(
    '/api/customer/status',
    {
      method: 'POST',
      body: JSON.stringify(payload),
    }
  );
}

export async function uploadCustomerFolderFiles(
  kodeUnik: string,
  category: DriveSubfolderCategory,
  files: Array<{ name: string; base64: string }>
) {
  return requestJson<{ ok: true; savedCount: number; media: DriveMediaItem[] }>(
    '/api/photos/upload',
    {
      method: 'POST',
      body: JSON.stringify({ kode_unik: kodeUnik, category, files }),
    }
  );
}

export async function deleteCustomerFolderFile(
  kodeUnik: string,
  category: DriveSubfolderCategory,
  filename: string
) {
  return requestJson<{ ok: true; media: DriveMediaItem[] }>(
    `/api/photos/file?code=${encodeURIComponent(kodeUnik)}&category=${encodeURIComponent(
      category
    )}&filename=${encodeURIComponent(filename)}`,
    { method: 'DELETE' }
  );
}

export async function seedCustomerSamplePhotos(kodeUnik: string) {
  return requestJson<{ ok: true; media: DriveMediaItem[] }>(
    '/api/photos/seed-samples',
    {
      method: 'POST',
      body: JSON.stringify({ kode_unik: kodeUnik }),
    }
  );
}

export async function saveStudioSettings(settings: Partial<StudioSettings>) {
  return requestJson<{ ok: true; settings: StudioSettings }>('/api/settings', {
    method: 'POST',
    body: JSON.stringify(settings),
  });
}

export async function manageMarketingMember(
  payload: Partial<MarketingMember> & { op: 'UPSERT' | 'DELETE' }
) {
  return requestJson<{ ok: true; marketing: MarketingMember[] }>(
    '/api/marketing',
    {
      method: 'POST',
      body: JSON.stringify(payload),
    }
  );
}

export async function testSystemConnections() {
  return requestJson<{ ok: true; result: ConnectionTestResult }>(
    '/api/test-connections'
  );
}

export async function fetchGasSourceCode() {
  return requestJson<{ ok: true; code: string }>('/api/gas-source');
}

/**
 * Download multiple customer photos in a single ZIP archive with live progress reporting.
 */
export async function downloadPhotosAsZip(
  kodeUnik: string,
  categoryLabel: string,
  items: DriveMediaItem[],
  onProgress: (state: {
    percent: number;
    processed: number;
    total: number;
    statusText: string;
  }) => void
): Promise<void> {
  if (items.length === 0) {
    throw new Error('Tidak ada file foto yang tersedia untuk diunduh.');
  }

  const zip = new JSZip();
  let successCount = 0;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    onProgress({
      percent: Math.round((i / items.length) * 75),
      processed: i,
      total: items.length,
      statusText: `Mengambil file ${item.name} (${i + 1}/${items.length})...`,
    });

    const resp = await fetch(item.downloadUrl || item.previewUrl);
    if (!resp.ok) {
      throw new Error(`Gagal mengunduh file ${item.name} (HTTP ${resp.status}).`);
    }
    const blob = await resp.blob();
    zip.file(item.name, blob);
    successCount++;
  }

  if (successCount === 0) {
    throw new Error('Tidak ada file yang berhasil diunduh ke dalam arsip ZIP.');
  }

  onProgress({
    percent: 85,
    processed: items.length,
    total: items.length,
    statusText: 'Mengemas arsip ZIP...',
  });

  const zipBlob = await zip.generateAsync(
    { type: 'blob' },
    (meta) => {
      onProgress({
        percent: Math.min(99, 85 + Math.round(meta.percent * 0.14)),
        processed: items.length,
        total: items.length,
        statusText: 'Menyiapkan unduhan ZIP...',
      });
    }
  );

  const objectUrl = URL.createObjectURL(zipBlob);
  const anchor = document.createElement('a');
  const safeCat = categoryLabel.replace(/[^A-Z0-9_-]/gi, '-').toUpperCase();
  anchor.href = objectUrl;
  anchor.download = `LOUIS-BRIDES-${kodeUnik.toUpperCase()}-${safeCat}.zip`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  setTimeout(() => URL.revokeObjectURL(objectUrl), 5000);

  onProgress({
    percent: 100,
    processed: items.length,
    total: items.length,
    statusText: `Selesai mengunduh ${items.length} file dalam arsip ZIP.`,
  });
}
