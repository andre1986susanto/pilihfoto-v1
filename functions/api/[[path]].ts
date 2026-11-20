// Cloudflare Pages Functions API Proxy for LOUIS BRIDES PILIH FOTO V1
// Uses Web Standard APIs only (no Node.js runtime dependencies required).

import type {
  AdminFullDataPayload,
  CustomerRecord,
  DriveMediaItem,
  StudioSettings,
} from '../../src/types/studio';
import { createDefaultSettings, sortMediaNaturally } from '../../src/utils/studioLogic';

interface Env {
  GAS_WEBAPP_URL?: string;
  SPREADSHEET_ID?: string;
  DRIVE_ROOT_FOLDER_ID?: string;
  ADMIN_DEFAULT_PIN?: string;
  SESSION_SECRET?: string;
  APP_URL?: string;
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...CORS_HEADERS,
    },
  });
}

async function callGasGet(gasUrl: string, params: Record<string, string>) {
  const url = new URL(gasUrl);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') {
      url.searchParams.set(k, String(v));
    }
  }
  const resp = await fetch(url.toString(), { method: 'GET', redirect: 'follow' });
  if (!resp.ok) {
    throw new Error(`Google Apps Script merespons HTTP ${resp.status}`);
  }
  return resp.json();
}

async function callGasPost(gasUrl: string, body: Record<string, unknown>) {
  const resp = await fetch(gasUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    redirect: 'follow',
  });
  if (!resp.ok) {
    throw new Error(`Google Apps Script merespons HTTP ${resp.status}`);
  }
  return resp.json();
}

async function sha256Hex(value: string): Promise<string> {
  const enc = new TextEncoder();
  const digest = await crypto.subtle.digest(
    'SHA-256',
    enc.encode(`louis-brides-studio-salt-v1:${value.trim()}`)
  );
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function signToken(secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const exp = Date.now() + 24 * 60 * 60 * 1000;
  const payload = `${exp}`;
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(payload));
  const hex = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return `${payload}.${hex}`;
}

async function verifyToken(token: string | null, secret: string): Promise<boolean> {
  if (!token || !token.includes('.')) return false;
  const [expStr, sigHex] = token.split('.');
  const exp = Number(expStr);
  if (Number.isNaN(exp) || Date.now() > exp) return false;
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify']
  );
  const sigBytes = new Uint8Array(
    (sigHex.match(/.{1,2}/g) || []).map((byte) => parseInt(byte, 16))
  );
  if (sigBytes.length === 0) return false;
  return crypto.subtle.verify('HMAC', key, sigBytes, enc.encode(expStr));
}

function mergeStudioSettings(
  rawSettings: Partial<StudioSettings> | undefined,
  env: Env
): StudioSettings {
  const defaults = createDefaultSettings();
  return {
    ...defaults,
    ...(rawSettings || {}),
    spreadsheet_id: rawSettings?.spreadsheet_id || env.SPREADSHEET_ID || defaults.spreadsheet_id,
    drive_root_folder_id:
      rawSettings?.drive_root_folder_id ||
      env.DRIVE_ROOT_FOLDER_ID ||
      defaults.drive_root_folder_id,
    public_app_url: rawSettings?.public_app_url || env.APP_URL || defaults.public_app_url,
    whatsapp_templates: {
      ...defaults.whatsapp_templates,
      ...(rawSettings?.whatsapp_templates || {}),
    },
  };
}

function extractPublicStudio(settings: StudioSettings) {
  return {
    nama_studio: settings.nama_studio,
    logo_url: settings.logo_url,
    whatsapp_studio: settings.whatsapp_studio,
    batas_revisi: settings.batas_revisi,
    izinkan_download_all_file: settings.izinkan_download_all_file,
    izinkan_download_ringkasan: settings.izinkan_download_ringkasan,
    izinkan_download_editan: settings.izinkan_download_editan,
    izinkan_download_revisi: settings.izinkan_download_revisi,
    izinkan_download_video: settings.izinkan_download_video,
  };
}

async function fetchPublicStudioFromGas(gasUrl: string, env: Env) {
  const defaults = mergeStudioSettings(undefined, env);
  if (!gasUrl) return defaults;
  try {
    const res = (await callGasGet(gasUrl, {
      action: 'getPublicConfig',
      spreadsheet_id: env.SPREADSHEET_ID || '',
    })) as { ok?: boolean; studio?: Partial<StudioSettings> };
    if (res.ok && res.studio) {
      return mergeStudioSettings(res.studio, env);
    }
  } catch {
    // Fallback cleanly to defaults when GAS endpoint does not implement getPublicConfig yet
  }
  return defaults;
}

async function verifyAdminPin(pin: string, gasUrl: string, env: Env): Promise<boolean> {
  const trimmedPin = pin.trim();
  if (!trimmedPin) return false;

  if (gasUrl) {
    try {
      const hashRes = (await callGasGet(gasUrl, {
        action: 'getAdminPinHash',
        spreadsheet_id: env.SPREADSHEET_ID || '',
      })) as { ok?: boolean; admin_pin_hash?: string };
      if (hashRes.ok && hashRes.admin_pin_hash) {
        const candidateHash = await sha256Hex(trimmedPin);
        if (candidateHash === hashRes.admin_pin_hash) {
          return true;
        }
        return false;
      }
    } catch {
      // Fallback to ADMIN_DEFAULT_PIN env variable
    }
  }

  const expectedPin = (env.ADMIN_DEFAULT_PIN || '202601').trim();
  return trimmedPin === expectedPin;
}

export const onRequest = async (context: { request: Request; env: Env }): Promise<Response> => {
  const { request, env } = context;
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  const url = new URL(request.url);
  const route = url.pathname.replace(/^\/api\/?/, '').replace(/\/+$/, '');
  const gasUrl = (env.GAS_WEBAPP_URL || '').trim();
  const expectedPin = (env.ADMIN_DEFAULT_PIN || '202601').trim();
  const secret = (env.SESSION_SECRET || `lb-session-${expectedPin}`).trim();

  const authHeader = request.headers.get('Authorization');
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  try {
    // 1. Public Studio Branding Config (no secrets exposed)
    if (route === 'public-config' && request.method === 'GET') {
      const studioSettings = await fetchPublicStudioFromGas(gasUrl, env);
      return json({
        ok: true,
        studio: {
          nama_studio: studioSettings.nama_studio,
          logo_url: studioSettings.logo_url,
          whatsapp_studio: studioSettings.whatsapp_studio,
          zona_waktu: studioSettings.zona_waktu,
          is_gas_configured: Boolean(gasUrl),
        },
      });
    }

    // 2. Admin Authentication Endpoints
    if (route === 'auth/login' && request.method === 'POST') {
      const body = (await request.json().catch(() => ({}))) as { pin?: string };
      const pin = String(body.pin || '').trim();
      if (!pin) {
        return json({ ok: false, error: 'PIN atau password admin wajib diisi.' }, 400);
      }
      const validPin = await verifyAdminPin(pin, gasUrl, env);
      if (!validPin) {
        return json({ ok: false, error: 'PIN atau password admin salah.' }, 401);
      }
      const token = await signToken(secret);
      return json({ ok: true, token });
    }

    if (route === 'auth/session' && request.method === 'GET') {
      const valid = await verifyToken(bearerToken, secret);
      return json({ ok: true, authenticated: valid });
    }

    if (route === 'auth/logout' && request.method === 'POST') {
      return json({ ok: true });
    }

    if (route === 'auth/change-pin' && request.method === 'POST') {
      const isAdmin = await verifyToken(bearerToken, secret);
      if (!isAdmin) {
        return json({ ok: false, error: 'Sesi admin tidak valid. Silakan login kembali.' }, 401);
      }
      const body = (await request.json().catch(() => ({}))) as {
        current_pin?: string;
        new_pin?: string;
      };
      const currentPin = String(body.current_pin || '').trim();
      const newPin = String(body.new_pin || '').trim();
      if (!currentPin || !newPin) {
        return json({ ok: false, error: 'PIN lama dan PIN baru wajib diisi.' }, 400);
      }
      if (newPin.length < 4) {
        return json({ ok: false, error: 'PIN baru minimal 4 karakter.' }, 400);
      }
      const validOld = await verifyAdminPin(currentPin, gasUrl, env);
      if (!validOld) {
        return json({ ok: false, error: 'PIN lama tidak sesuai.' }, 401);
      }
      if (!gasUrl) {
        return json(
          {
            ok: false,
            error:
              'Hubungkan GAS_WEBAPP_URL terlebih dahulu atau ubah ADMIN_DEFAULT_PIN di Environment Variables Cloudflare Pages.',
          },
          400
        );
      }
      const nextHash = await sha256Hex(newPin);
      const saveRes = (await callGasPost(gasUrl, {
        action: 'handleSaveAdminPinHash',
        admin_pin_hash: nextHash,
      })) as { ok?: boolean; error?: string };
      if (!saveRes.ok) {
        return json({ ok: false, error: saveRes.error || 'Gagal menyimpan PIN baru.' }, 500);
      }
      const token = await signToken(secret);
      return json({ ok: true, token, message: 'PIN admin berhasil diperbarui.' });
    }

    // 3. Protected System Connection Tester
    if (route === 'test-connections' && request.method === 'GET') {
      const isAdmin = await verifyToken(bearerToken, secret);
      if (!isAdmin) {
        return json({ ok: false, error: 'Akses ditolak. Silakan login sebagai Admin Studio.' }, 401);
      }
      const now = new Date().toISOString();
      if (!gasUrl) {
        return json({
          ok: true,
          result: {
            overall: 'BELUM DIKONFIGURASI',
            checks: [
              {
                service: 'Backend Aplikasi',
                status: 'TERHUBUNG',
                message: 'Cloudflare Pages Functions API aktif.',
                checked_at: now,
              },
              {
                service: 'Google Apps Script',
                status: 'BELUM DIKONFIGURASI',
                message: 'Environment variable GAS_WEBAPP_URL belum diatur di Cloudflare Pages.',
                checked_at: now,
              },
              {
                service: 'Google Sheets',
                status: 'BELUM DIKONFIGURASI',
                message: 'Menunggu koneksi Google Apps Script.',
                checked_at: now,
              },
              {
                service: 'Google Drive',
                status: 'BELUM DIKONFIGURASI',
                message: 'Menunggu koneksi Google Apps Script.',
                checked_at: now,
              },
            ],
          },
        });
      }

      const gasRes = (await callGasGet(gasUrl, {
        action: 'testSystemConnections',
        spreadsheet_id: env.SPREADSHEET_ID || '',
        drive_root_folder_id: env.DRIVE_ROOT_FOLDER_ID || '1qsd1Ozk8hHC97HyTNCTvq57ZTCx18AGF',
      })) as Record<string, string>;

      const checks = [
        {
          service: 'Backend Aplikasi',
          status: 'TERHUBUNG',
          message: 'Cloudflare Pages Functions API aktif.',
          checked_at: now,
        },
        {
          service: 'Google Apps Script',
          status: gasRes.gas_status || 'TERHUBUNG',
          message: 'Google Apps Script Web App merespons normal.',
          checked_at: now,
        },
        {
          service: 'Google Sheets',
          status: gasRes.sheets_status || 'GAGAL TERHUBUNG',
          message: gasRes.sheets_message || '',
          checked_at: now,
        },
        {
          service: 'Google Drive',
          status: gasRes.drive_status || 'GAGAL TERHUBUNG',
          message: gasRes.drive_message || '',
          checked_at: now,
        },
      ];
      const allConnected = checks.every((c) => c.status === 'TERHUBUNG');
      return json({
        ok: true,
        result: {
          overall: allConnected ? 'TERHUBUNG' : 'GAGAL TERHUBUNG',
          checks,
        },
      });
    }

    if (!gasUrl) {
      return json(
        {
          ok: false,
          error:
            'Koneksi backend Google Apps Script belum dikonfigurasi pada environment variable Cloudflare Pages (GAS_WEBAPP_URL).',
        },
        503
      );
    }

    // 4. Public Customer Endpoints (validated strictly by unique customer code)
    if (route === 'customer' && request.method === 'GET') {
      const code = (url.searchParams.get('code') || '').trim().toUpperCase();
      if (!code) return json({ ok: false, error: 'Kode unik wajib diisi.' }, 400);

      const [custRes, selRes, studioSettings] = await Promise.all([
        callGasGet(gasUrl, { action: 'getCustomerByCode', code }) as Promise<{
          ok?: boolean;
          customer?: CustomerRecord;
          error?: string;
        }>,
        callGasGet(gasUrl, { action: 'getCustomerSelections', code }) as Promise<{
          ok?: boolean;
          selections?: unknown[];
          draftSelections?: unknown[];
          draftOverallNote?: string;
          submissions?: unknown[];
          feedbacks?: unknown[];
        }>,
        fetchPublicStudioFromGas(gasUrl, env),
      ]);

      if (!custRes.ok || !custRes.customer) {
        return json(
          {
            ok: false,
            notFound: true,
            error: custRes.error || 'Link customer tidak ditemukan atau kode unik tidak terdaftar.',
          },
          404
        );
      }

      const draftItems =
        Array.isArray(selRes.draftSelections) && selRes.draftSelections.length > 0
          ? selRes.draftSelections
          : selRes.selections || [];

      return json({
        ok: true,
        customer: custRes.customer,
        studio: extractPublicStudio(studioSettings),
        draftSelections: draftItems,
        draftOverallNote: selRes.draftOverallNote || '',
        submissions: selRes.submissions || [],
        feedbacks: selRes.feedbacks || [],
        logs: [],
      });
    }

    if (route === 'photos' && request.method === 'GET') {
      const code = (url.searchParams.get('code') || '').trim().toUpperCase();
      if (!code) return json({ ok: false, error: 'Kode unik wajib diisi.' }, 400);

      const gasRes = (await callGasGet(gasUrl, {
        action: 'getCustomerFolderPhotos',
        code,
      })) as { ok?: boolean; media?: DriveMediaItem[]; error?: string };

      if (!gasRes.ok) {
        return json(
          {
            ok: false,
            notFound: true,
            error: gasRes.error || 'Customer tidak ditemukan.',
          },
          404
        );
      }

      const proxiedMedia = sortMediaNaturally(gasRes.media || [], 'asc').map((m) => ({
        ...m,
        thumbnailUrl: `/api/media-proxy?fileId=${encodeURIComponent(m.id)}&code=${encodeURIComponent(code)}`,
        previewUrl: `/api/media-proxy?fileId=${encodeURIComponent(m.id)}&code=${encodeURIComponent(code)}`,
        downloadUrl: `/api/media-proxy?fileId=${encodeURIComponent(m.id)}&code=${encodeURIComponent(code)}&download=1`,
      }));

      return json({ ok: true, kode_unik: code, media: proxiedMedia });
    }

    if (route === 'media-proxy' && request.method === 'GET') {
      const fileId = url.searchParams.get('fileId') || '';
      const download = url.searchParams.get('download') === '1';
      if (!fileId) return json({ ok: false, error: 'fileId wajib diisi.' }, 400);

      const res = (await callGasGet(gasUrl, { action: 'getFileBase64', fileId })) as {
        ok: boolean;
        name?: string;
        mimeType?: string;
        base64?: string;
        error?: string;
      };
      if (!res.ok || !res.base64) {
        return json({ ok: false, error: res.error || 'Gagal membaca file.' }, 404);
      }
      const binaryStr = atob(res.base64);
      const bytes = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
      }

      const headers: Record<string, string> = {
        'Content-Type': res.mimeType || 'image/jpeg',
        'Cache-Control': 'public, max-age=3600',
        ...CORS_HEADERS,
      };
      if (download && res.name) {
        headers['Content-Disposition'] = `attachment; filename="${res.name}"`;
      }
      return new Response(bytes, { status: 200, headers });
    }

    if (route === 'selections/draft' && request.method === 'POST') {
      const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
      try {
        const res = await callGasPost(gasUrl, {
          ...body,
          action: 'handleSaveDraftSelection',
        });
        return json(res);
      } catch {
        return json({ ok: true });
      }
    }

    if (route === 'selections' && request.method === 'GET') {
      const code = (url.searchParams.get('code') || '').trim().toUpperCase();
      if (!code) return json({ ok: false, error: 'Kode unik wajib diisi.' }, 400);
      const res = await callGasGet(gasUrl, { action: 'getCustomerSelections', code });
      return json(res);
    }

    if (route === 'selections' && request.method === 'POST') {
      const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
      const res = (await callGasPost(gasUrl, {
        ...body,
        action: 'handlePhotoSelectionSubmit',
      })) as { ok?: boolean };
      return json(res, res.ok === false ? 400 : 200);
    }

    if (route === 'feedback' && request.method === 'POST') {
      const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
      const studioSettings = await fetchPublicStudioFromGas(gasUrl, env);
      const res = (await callGasPost(gasUrl, {
        ...body,
        batas_revisi: studioSettings.batas_revisi,
        action: 'handleFeedbackSubmit',
      })) as { ok?: boolean };
      return json(res, res.ok === false ? 400 : 200);
    }

    // 5. Protected Admin Endpoints
    const isAdmin = await verifyToken(bearerToken, secret);
    if (!isAdmin) {
      return json({ ok: false, error: 'Akses ditolak. Silakan login sebagai Admin Studio.' }, 401);
    }

    if (route === 'customers' && request.method === 'GET') {
      const gasRes = (await callGasGet(gasUrl, {
        action: 'getAdminFullData',
      })) as Partial<AdminFullDataPayload> & { ok?: boolean; error?: string };
      if (!gasRes.ok) {
        return json({ ok: false, error: gasRes.error || 'Gagal memuat data Google Sheets.' }, 502);
      }
      return json({
        ok: true,
        customers: gasRes.customers || [],
        selections: gasRes.selections || [],
        feedbacks: gasRes.feedbacks || [],
        marketing: gasRes.marketing || [],
        logs: gasRes.logs || [],
        settings: mergeStudioSettings(gasRes.settings, env),
      });
    }

    if (route === 'customer' && request.method === 'POST') {
      const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
      const res = (await callGasPost(gasUrl, {
        ...body,
        drive_root_folder_id: body.drive_root_folder_id || env.DRIVE_ROOT_FOLDER_ID,
        action: 'handleAddCustomer',
      })) as { ok?: boolean };
      return json(res, res.ok === false ? 400 : 200);
    }

    if (route === 'customer' && request.method === 'DELETE') {
      const code = url.searchParams.get('code') || '';
      const res = (await callGasPost(gasUrl, {
        kode_unik: code,
        action: 'handleDeleteCustomer',
      })) as { ok?: boolean };
      return json(res, res.ok === false ? 400 : 200);
    }

    if (route === 'customer/status' && request.method === 'POST') {
      const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
      const res = (await callGasPost(gasUrl, {
        ...body,
        action: 'handleUpdateCustomerStatus',
      })) as { ok?: boolean };
      return json(res, res.ok === false ? 400 : 200);
    }

    if (route === 'settings' && request.method === 'POST') {
      const body = (await request.json().catch(() => ({}))) as Partial<StudioSettings>;
      const merged = mergeStudioSettings(body, env);
      const res = (await callGasPost(gasUrl, {
        ...merged,
        action: 'handleSaveSettings',
      })) as { ok?: boolean; error?: string };
      if (!res.ok) {
        return json({ ok: false, error: res.error || 'Gagal menyimpan pengaturan.' }, 500);
      }
      return json({ ok: true, settings: merged });
    }

    if (route === 'marketing' && request.method === 'POST') {
      const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
      const res = (await callGasPost(gasUrl, {
        ...body,
        action: 'handleManageMarketing',
      })) as { ok?: boolean };
      return json(res, res.ok === false ? 400 : 200);
    }

    return json({ ok: false, error: `Endpoint tidak ditemukan: /api/${route}` }, 404);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Terjadi kesalahan server.';
    return json({ ok: false, error: message }, 500);
  }
};
