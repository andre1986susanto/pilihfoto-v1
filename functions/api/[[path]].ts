// Cloudflare Pages Functions API Proxy for LOUIS BRIDES PILIH FOTO V1
// Synchronized with server.ts and apiClient.ts

interface Env {
  GAS_WEBAPP_URL?: string;
  SPREADSHEET_ID?: string;
  DRIVE_ROOT_FOLDER_ID?: string;
  ADMIN_DEFAULT_PIN?: string;
  SESSION_SECRET?: string;
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, PUT, OPTIONS',
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
    if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
  }
  const resp = await fetch(url.toString(), { method: 'GET', redirect: 'follow' });
  if (!resp.ok) {
    throw new Error(`Google Apps Script HTTP ${resp.status}`);
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
    throw new Error(`Google Apps Script HTTP ${resp.status}`);
  }
  return resp.json();
}

async function signToken(pin: string, secret: string): Promise<string> {
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
  return crypto.subtle.verify('HMAC', key, sigBytes, enc.encode(expStr));
}

export const onRequest = async (context: { request: Request; env: Env }): Promise<Response> => {
  const { request, env } = context;
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  const url = new URL(request.url);
  const route = url.pathname.replace(/^\/api\/?/, '').replace(/\/+$/, '');
  const gasUrl = (env.GAS_WEBAPP_URL || '').trim();
  const secret = env.SESSION_SECRET || env.ADMIN_DEFAULT_PIN || 'louis-brides-session-key-v1';
  const expectedPin = env.ADMIN_DEFAULT_PIN || '202601';

  const authHeader = request.headers.get('Authorization');
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  try {
    // 1. Public Studio Config Endpoint (Called on App init)
    if (route === 'public-config' && request.method === 'GET') {
      const studioInfo = {
        nama_studio: 'LOUIS BRIDES',
        logo_url: '',
        whatsapp_studio: '6281122334455',
        zona_waktu: 'Asia/Jakarta',
        is_gas_configured: Boolean(gasUrl),
      };
      if (gasUrl) {
        try {
          const fullData = (await callGasGet(gasUrl, { action: 'getAdminFullData' })) as {
            ok?: boolean;
            settings?: Record<string, unknown>;
          };
          if (fullData?.settings) {
            studioInfo.nama_studio = String(fullData.settings.nama_studio || studioInfo.nama_studio);
            studioInfo.logo_url = String(fullData.settings.logo_url || '');
            studioInfo.whatsapp_studio = String(fullData.settings.whatsapp_studio || studioInfo.whatsapp_studio);
            studioInfo.zona_waktu = String(fullData.settings.zona_waktu || studioInfo.zona_waktu);
          }
        } catch {
          // Fallback to defaults
        }
      }
      return json({ ok: true, studio: studioInfo });
    }

    // 2. Auth: Login
    if (route === 'auth/login' && request.method === 'POST') {
      const body = (await request.json().catch(() => ({}))) as { pin?: string };
      const pin = String(body.pin || '').trim();
      if (!pin) {
        return json({ ok: false, error: 'PIN atau password admin wajib diisi.' }, 400);
      }
      let valid = false;
      if (gasUrl) {
        try {
          const gasRes = (await callGasPost(gasUrl, { action: 'verifyAdminPin', pin })) as {
            ok?: boolean;
            valid?: boolean;
          };
          if (gasRes?.ok && gasRes?.valid) {
            valid = true;
          }
        } catch {}
      }
      if (!valid && pin === expectedPin) {
        valid = true;
      }
      if (!valid) {
        return json({ ok: false, error: 'PIN atau password admin salah.' }, 401);
      }
      const token = await signToken(pin, secret);
      return json({ ok: true, token });
    }

    // 3. Auth: Session Check
    if (route === 'auth/session' && request.method === 'GET') {
      const valid = await verifyToken(bearerToken, secret);
      return json({ ok: true, authenticated: valid });
    }

    // 4. Auth: Logout
    if (route === 'auth/logout' && request.method === 'POST') {
      return json({ ok: true });
    }

    // 5. Auth: Change PIN
    if (route === 'auth/change-pin' && request.method === 'POST') {
      const isAdmin = await verifyToken(bearerToken, secret);
      if (!isAdmin) {
        return json({ ok: false, error: 'Akses ditolak. Silakan login sebagai Admin Studio.' }, 401);
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
      if (gasUrl) {
        try {
          const gasRes = (await callGasPost(gasUrl, {
            action: 'changeAdminPin',
            current_pin: currentPin,
            new_pin: newPin,
          })) as { ok?: boolean; error?: string };
          if (gasRes && gasRes.ok === false) {
            return json(
              { ok: false, error: gasRes.error || 'PIN lama tidak sesuai di database Google Apps Script.' },
              400
            );
          }
        } catch (err) {
          return json({ ok: false, error: 'Gagal memperbarui PIN di Google Apps Script.' }, 502);
        }
      }
      const newToken = await signToken(newPin, secret);
      return json({ ok: true, token: newToken, message: 'PIN admin berhasil diperbarui.' });
    }

    // 6. Connection Test Endpoint
    if (route === 'test-connections' && request.method === 'GET') {
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
                message: 'Environment variable GAS_WEBAPP_URL belum diatur.',
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
            'Google Apps Script Web App URL belum dikonfigurasi pada Cloudflare Pages environment variable (GAS_WEBAPP_URL).',
        },
        503
      );
    }

    // 7. Customer Portal: Get Customer by Unique Code
    if (route === 'customer' && request.method === 'GET') {
      const code = (url.searchParams.get('code') || '').trim().toUpperCase();
      if (!code) return json({ ok: false, error: 'Kode unik wajib diisi.' }, 400);

      const custRes = (await callGasGet(gasUrl, { action: 'getCustomerByCode', code })) as Record<
        string,
        unknown
      >;
      if (!custRes || !custRes.ok || !custRes.customer) {
        return json(
          {
            ok: false,
            notFound: true,
            error:
              (custRes?.error as string) ||
              `Link customer tidak ditemukan atau kode unik ${code} tidak terdaftar.`,
          },
          200
        );
      }

      const selRes = (await callGasGet(gasUrl, { action: 'getCustomerSelections', code })) as Record<
        string,
        unknown
      >;

      let studioInfo = {
        nama_studio: 'LOUIS BRIDES',
        logo_url: '',
        whatsapp_studio: '6281122334455',
        batas_revisi: 2,
        izinkan_download_all_file: true,
        izinkan_download_ringkasan: true,
        izinkan_download_editan: true,
        izinkan_download_revisi: true,
        izinkan_download_video: true,
      };

      try {
        const fullData = (await callGasGet(gasUrl, { action: 'getAdminFullData' })) as {
          settings?: Record<string, unknown>;
        };
        if (fullData?.settings) {
          Object.assign(studioInfo, {
            nama_studio: String(fullData.settings.nama_studio || studioInfo.nama_studio),
            logo_url: String(fullData.settings.logo_url || ''),
            whatsapp_studio: String(fullData.settings.whatsapp_studio || studioInfo.whatsapp_studio),
            batas_revisi: Number(fullData.settings.batas_revisi || 2),
            izinkan_download_all_file: fullData.settings.izinkan_download_all_file ?? true,
            izinkan_download_ringkasan: fullData.settings.izinkan_download_ringkasan ?? true,
            izinkan_download_editan: fullData.settings.izinkan_download_editan ?? true,
            izinkan_download_revisi: fullData.settings.izinkan_download_revisi ?? true,
            izinkan_download_video: fullData.settings.izinkan_download_video ?? true,
          });
        }
      } catch {}

      return json({
        ok: true,
        customer: custRes.customer,
        studio: studioInfo,
        draftSelections: selRes.selections || [],
        draftOverallNote: '',
        submissions: selRes.submissions || [],
        feedbacks: selRes.feedbacks || [],
        logs: [],
      });
    }

    // 8. Photos List for Customer
    if (route === 'photos' && request.method === 'GET') {
      const code = (url.searchParams.get('code') || '').trim().toUpperCase();
      if (!code) return json({ ok: false, error: 'Kode unik wajib diisi.' }, 400);
      const res = await callGasGet(gasUrl, { action: 'getCustomerFolderPhotos', code });
      return json(res);
    }

    // 9. Selections Draft
    if (route === 'selections/draft' && request.method === 'POST') {
      const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
      try {
        await callGasPost(gasUrl, { ...body, action: 'saveDraftSelections' });
      } catch {}
      return json({ ok: true });
    }

    // 10. Selections Get & Submit
    if (route === 'selections' && request.method === 'GET') {
      const code = (url.searchParams.get('code') || '').trim().toUpperCase();
      if (!code) return json({ ok: false, error: 'Kode unik wajib diisi.' }, 400);
      const res = await callGasGet(gasUrl, { action: 'getCustomerSelections', code });
      return json(res);
    }

    if (route === 'selections' && request.method === 'POST') {
      const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
      const res = await callGasPost(gasUrl, {
        ...body,
        action: 'handlePhotoSelectionSubmit',
      });
      return json(res);
    }

    // 11. Customer Feedback & Revision Submissions
    if (route === 'feedback' && request.method === 'POST') {
      const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
      const res = await callGasPost(gasUrl, {
        ...body,
        action: 'handleFeedbackSubmit',
      });
      return json(res);
    }

    // 12. Media Proxy (Drive image streaming without requiring Google login)
    if (route === 'media-proxy' && request.method === 'GET') {
      const fileId = url.searchParams.get('fileId') || '';
      if (!fileId) return json({ ok: false, error: 'fileId wajib diisi.' }, 400);
      const res = (await callGasGet(gasUrl, { action: 'getFileBase64', fileId })) as {
        ok: boolean;
        mimeType?: string;
        base64?: string;
        name?: string;
        error?: string;
      };
      if (!res.ok || !res.base64) {
        return json({ ok: false, error: res.error || 'Gagal membaca file dari Drive.' }, 404);
      }
      const binaryStr = atob(res.base64);
      const bytes = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
      }
      const headers: Record<string, string> = {
        'Content-Type': res.mimeType || 'image/jpeg',
        'Cache-Control': 'public, max-age=86400, immutable',
        ...CORS_HEADERS,
      };
      if (url.searchParams.get('download') === '1' && res.name) {
        headers['Content-Disposition'] = `attachment; filename="${res.name}"`;
      }
      return new Response(bytes, {
        status: 200,
        headers,
      });
    }

    // PROTECTED ADMIN ENDPOINTS
    const isAdmin = await verifyToken(bearerToken, secret);
    if (!isAdmin) {
      return json({ ok: false, error: 'Akses ditolak. Silakan login sebagai Admin Studio.' }, 401);
    }

    // 13. Admin Dashboard Full Data
    if (route === 'customers' && request.method === 'GET') {
      const res = await callGasGet(gasUrl, { action: 'getAdminFullData' });
      return json(res);
    }

    // 14. Customer Record CRUD
    if (route === 'customer' && request.method === 'POST') {
      const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
      const res = await callGasPost(gasUrl, {
        ...body,
        drive_root_folder_id: body.drive_root_folder_id || env.DRIVE_ROOT_FOLDER_ID,
        action: 'handleAddCustomer',
      });
      return json(res);
    }

    if (route === 'customer' && request.method === 'DELETE') {
      const code = url.searchParams.get('code') || '';
      const res = await callGasPost(gasUrl, {
        kode_unik: code,
        action: 'handleDeleteCustomer',
      });
      return json(res);
    }

    if (route === 'customer/status' && request.method === 'POST') {
      const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
      const res = await callGasPost(gasUrl, {
        ...body,
        action: 'handleUpdateCustomerStatus',
      });
      return json(res);
    }

    // 15. Studio Settings Save
    if (route === 'settings' && request.method === 'POST') {
      const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
      const res = await callGasPost(gasUrl, {
        ...body,
        action: 'handleSaveSettings',
      });
      return json(res);
    }

    // 16. Marketing Member Management
    if (route === 'marketing' && request.method === 'POST') {
      const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
      const res = await callGasPost(gasUrl, {
        ...body,
        action: 'manageMarketingMember',
      });
      return json(res);
    }

    // 17. Photos Upload & Delete in Customer Folder
    if (route === 'photos/upload' && request.method === 'POST') {
      const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
      const res = await callGasPost(gasUrl, {
        ...body,
        action: 'uploadCustomerFolderFiles',
      });
      return json(res);
    }

    if (route === 'photos/file' && request.method === 'DELETE') {
      const code = url.searchParams.get('code') || '';
      const category = url.searchParams.get('category') || '';
      const filename = url.searchParams.get('filename') || '';
      const res = await callGasPost(gasUrl, {
        kode_unik: code,
        category,
        filename,
        action: 'deleteCustomerFolderFile',
      });
      return json(res);
    }

    if (route === 'photos/seed-samples' && request.method === 'POST') {
      const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
      const res = await callGasPost(gasUrl, {
        ...body,
        action: 'seedCustomerSamplePhotos',
      });
      return json(res);
    }

    // 18. GAS Source Code Viewer
    if (route === 'gas-source' && request.method === 'GET') {
      return json({
        ok: true,
        message: 'Kode Apps Script tersedia di file gas/Code.gs repository.',
      });
    }

    return json({ ok: false, error: `Endpoint tidak ditemukan: /api/${route}` }, 404);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Terjadi kesalahan server.';
    return json({ ok: false, error: message }, 500);
  }
};
