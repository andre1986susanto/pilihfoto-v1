import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';
import express, { type NextFunction, type Request, type Response } from 'express';
import JSZip from 'jszip';
import sharp from 'sharp';
import { createServer as createViteServer } from 'vite';
import type {
  ActivityLogRecord,
  AdminFullDataPayload,
  ConnectionServiceCheck,
  ConnectionTestResult,
  CustomerRecord,
  DriveMediaItem,
  DriveSubfolderCategory,
  FeedbackRecord,
  MarketingMember,
  PhotoSelectionItem,
  PhotoSelectionSubmission,
  StudioSettings,
} from './src/types/studio';
import {
  calculateEstimatedCompletionDate,
  createDefaultSettings,
  generateUniqueCustomerCode,
  isFolderDownloadAllowed,
  sortMediaNaturally,
} from './src/utils/studioLogic';

dotenv.config();

const PORT = 3000;
const ROOT_DIR = process.cwd();
const DATA_DIR = path.join(ROOT_DIR, 'data');
const DB_FILE = path.join(DATA_DIR, 'studio-db.json');
const DRIVE_DIR = path.join(DATA_DIR, 'drive');
const THUMB_CACHE_DIR = path.join(DATA_DIR, 'thumb_cache');

const SUBFOLDER_NAMES: DriveSubfolderCategory[] = [
  'ALL FILE',
  'RINGKASAN',
  'LIHAT EDITAN',
  'REVISI',
  'VIDEO',
];

interface ServerDatabase extends AdminFullDataPayload {
  adminPinHash: string;
  draftSelectionsByCode: Record<
    string,
    { items: PhotoSelectionItem[]; overallNote: string; updatedAt: string }
  >;
}

function hashPin(pin: string): string {
  const salt = 'louis-brides-studio-salt-v1';
  return crypto.createHash('sha256').update(`${salt}:${pin.trim()}`).digest('hex');
}

function ensureStorageDirs() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DRIVE_DIR)) fs.mkdirSync(DRIVE_DIR, { recursive: true });
  if (!fs.existsSync(THUMB_CACHE_DIR)) fs.mkdirSync(THUMB_CACHE_DIR, { recursive: true });
}

function loadDatabase(): ServerDatabase {
  ensureStorageDirs();
  if (!fs.existsSync(DB_FILE)) {
    const defaultPin = (process.env.ADMIN_DEFAULT_PIN || '202601').trim();
    const initialSettings = createDefaultSettings();
    if (process.env.GAS_WEBAPP_URL) {
      initialSettings.gas_webapp_url = process.env.GAS_WEBAPP_URL.trim();
    }
    if (process.env.SPREADSHEET_ID) {
      initialSettings.spreadsheet_id = process.env.SPREADSHEET_ID.trim();
    }
    if (process.env.DRIVE_ROOT_FOLDER_ID) {
      initialSettings.drive_root_folder_id = process.env.DRIVE_ROOT_FOLDER_ID.trim();
    }

    const initialDb: ServerDatabase = {
      adminPinHash: hashPin(defaultPin),
      customers: [],
      selections: [],
      feedbacks: [],
      marketing: [],
      logs: [],
      settings: initialSettings,
      draftSelectionsByCode: {},
    };
    fs.writeFileSync(DB_FILE, JSON.stringify(initialDb, null, 2), 'utf-8');
    return initialDb;
  }

  const raw = fs.readFileSync(DB_FILE, 'utf-8');
  const parsed = JSON.parse(raw) as Partial<ServerDatabase>;
  const defaults = createDefaultSettings();
  return {
    adminPinHash:
      parsed.adminPinHash || hashPin((process.env.ADMIN_DEFAULT_PIN || '202601').trim()),
    customers: Array.isArray(parsed.customers) ? parsed.customers : [],
    selections: Array.isArray(parsed.selections) ? parsed.selections : [],
    feedbacks: Array.isArray(parsed.feedbacks) ? parsed.feedbacks : [],
    marketing: Array.isArray(parsed.marketing) ? parsed.marketing : [],
    logs: Array.isArray(parsed.logs) ? parsed.logs : [],
    settings: {
      ...defaults,
      ...(parsed.settings || {}),
      whatsapp_templates: {
        ...defaults.whatsapp_templates,
        ...(parsed.settings?.whatsapp_templates || {}),
      },
    },
    draftSelectionsByCode: parsed.draftSelectionsByCode || {},
  };
}

function saveDatabase(db: ServerDatabase) {
  ensureStorageDirs();
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf-8');
}

function getSessionSecret(db: ServerDatabase): string {
  return (
    process.env.SESSION_SECRET ||
    `lb-session-${db.adminPinHash.slice(0, 24)}`
  );
}

function signAuthToken(db: ServerDatabase): string {
  const exp = Date.now() + 24 * 60 * 60 * 1000;
  const payload = String(exp);
  const sig = crypto
    .createHmac('sha256', getSessionSecret(db))
    .update(payload)
    .digest('hex');
  return `${payload}.${sig}`;
}

function verifyAuthToken(token: string | undefined, db: ServerDatabase): boolean {
  if (!token || !token.includes('.')) return false;
  const [expStr, sigHex] = token.split('.');
  const exp = Number(expStr);
  if (Number.isNaN(exp) || Date.now() > exp) return false;
  const expectedSig = crypto
    .createHmac('sha256', getSessionSecret(db))
    .update(expStr)
    .digest('hex');
  try {
    return crypto.timingSafeEqual(
      Buffer.from(sigHex, 'hex'),
      Buffer.from(expectedSig, 'hex')
    );
  } catch {
    return false;
  }
}

function ensureLocalCustomerFolders(kodeUnik: string) {
  const safeCode = kodeUnik.replace(/[^A-Z0-9_-]/gi, '').toUpperCase();
  const clientDir = path.join(DRIVE_DIR, safeCode);
  if (!fs.existsSync(clientDir)) {
    fs.mkdirSync(clientDir, { recursive: true });
  }
  for (const sub of SUBFOLDER_NAMES) {
    const subDir = path.join(clientDir, sub);
    if (!fs.existsSync(subDir)) {
      fs.mkdirSync(subDir, { recursive: true });
    }
  }
  return clientDir;
}

function getMimeTypeForFilename(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  switch (ext) {
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.png':
      return 'image/png';
    case '.webp':
      return 'image/webp';
    case '.gif':
      return 'image/gif';
    case '.mp4':
      return 'video/mp4';
    case '.mov':
      return 'video/quicktime';
    case '.webm':
      return 'video/webm';
    default:
      return 'application/octet-stream';
  }
}

function readLocalCustomerMedia(kodeUnik: string): DriveMediaItem[] {
  const safeCode = kodeUnik.replace(/[^A-Z0-9_-]/gi, '').toUpperCase();
  const clientDir = path.join(DRIVE_DIR, safeCode);
  if (!fs.existsSync(clientDir)) return [];

  const items: DriveMediaItem[] = [];
  for (const category of SUBFOLDER_NAMES) {
    const subDir = path.join(clientDir, category);
    if (!fs.existsSync(subDir)) continue;
    const files = fs.readdirSync(subDir);
    for (const fileName of files) {
      if (fileName.startsWith('.')) continue;
      const fullPath = path.join(subDir, fileName);
      const stat = fs.statSync(fullPath);
      if (!stat.isFile()) continue;
      const mimeType = getMimeTypeForFilename(fileName);
      if (!mimeType.startsWith('image/') && !mimeType.startsWith('video/')) continue;
      const mediaUrl = `/api/local-media/${encodeURIComponent(safeCode)}/${encodeURIComponent(
        category
      )}/${encodeURIComponent(fileName)}`;
      items.push({
        id: `${safeCode}:${category}:${fileName}`,
        name: fileName,
        category,
        mimeType,
        sizeBytes: stat.size,
        createdTime: stat.birthtime.toISOString(),
        thumbnailUrl: mediaUrl,
        previewUrl: mediaUrl,
        downloadUrl: `${mediaUrl}?download=1`,
      });
    }
  }
  return sortMediaNaturally(items, 'asc');
}

function appendLog(
  db: ServerDatabase,
  aktor: ActivityLogRecord['aktor'],
  kodeUnik: string | undefined,
  namaCustomer: string | undefined,
  aksi: string,
  detail: string
) {
  db.logs.unshift({
    id_log: `LOG-${crypto.randomBytes(4).toString('hex').toUpperCase()}`,
    waktu: new Date().toISOString(),
    aktor,
    kode_unik: kodeUnik,
    nama_customer: namaCustomer,
    aksi,
    detail,
  });
  if (db.logs.length > 500) {
    db.logs = db.logs.slice(0, 500);
  }
}

async function callGasGet(gasUrl: string, params: Record<string, string>) {
  const url = new URL(gasUrl);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
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

function getEffectiveGasUrl(db: ServerDatabase): string {
  return (db.settings.gas_webapp_url || process.env.GAS_WEBAPP_URL || '').trim();
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '50mb' }));

  const requireAdmin = (_req: Request, _res: Response, next: NextFunction) => {
    // Admin login is removed per user request: open access
    next();
  };

  // 1. Public Studio Branding Config (never exposes secrets or customer lists)
  app.get('/api/public-config', (_req, res) => {
    const db = loadDatabase();
    const gasUrl = getEffectiveGasUrl(db);
    res.json({
      ok: true,
      studio: {
        nama_studio: db.settings.nama_studio,
        logo_url: db.settings.logo_url,
        whatsapp_studio: db.settings.whatsapp_studio,
        zona_waktu: db.settings.zona_waktu,
        is_gas_configured: Boolean(gasUrl),
      },
    });
  });

  // 2. Admin Authentication Endpoints
  app.post('/api/auth/login', (req, res) => {
    const db = loadDatabase();
    const pin = String(req.body?.pin || '').trim();
    if (!pin) {
      res.status(400).json({ ok: false, error: 'PIN atau password admin wajib diisi.' });
      return;
    }
    if (hashPin(pin) !== db.adminPinHash) {
      appendLog(db, 'SISTEM', undefined, undefined, 'LOGIN_GAGAL', 'Percobaan login admin dengan PIN salah.');
      saveDatabase(db);
      res.status(401).json({ ok: false, error: 'PIN atau password admin salah.' });
      return;
    }
    const token = signAuthToken(db);
    appendLog(db, 'ADMIN', undefined, undefined, 'LOGIN_BERHASIL', 'Admin masuk ke dashboard studio.');
    saveDatabase(db);
    res.json({ ok: true, token });
  });

  app.get('/api/auth/session', (_req, res) => {
    res.json({ ok: true, authenticated: true });
  });

  app.post('/api/auth/logout', (req, res) => {
    const db = loadDatabase();
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
    if (verifyAuthToken(token, db)) {
      appendLog(db, 'ADMIN', undefined, undefined, 'LOGOUT', 'Admin keluar dari dashboard studio.');
      saveDatabase(db);
    }
    res.json({ ok: true });
  });

  app.post('/api/auth/change-pin', requireAdmin, (req, res) => {
    const db = loadDatabase();
    const currentPin = String(req.body?.current_pin || '').trim();
    const newPin = String(req.body?.new_pin || '').trim();
    if (!currentPin || !newPin) {
      res.status(400).json({ ok: false, error: 'PIN lama dan PIN baru wajib diisi.' });
      return;
    }
    if (hashPin(currentPin) !== db.adminPinHash) {
      res.status(401).json({ ok: false, error: 'PIN lama tidak sesuai.' });
      return;
    }
    if (newPin.length < 4) {
      res.status(400).json({ ok: false, error: 'PIN baru minimal 4 karakter.' });
      return;
    }
    db.adminPinHash = hashPin(newPin);
    appendLog(db, 'ADMIN', undefined, undefined, 'UBAH_PIN_ADMIN', 'PIN keamanan admin diperbarui.');
    saveDatabase(db);
    const token = signAuthToken(db);
    res.json({ ok: true, token, message: 'PIN admin berhasil diperbarui.' });
  });

  // 3. System Connections Check (Honest real status — never fakes TERHUBUNG when unconfigured)
  app.get('/api/test-connections', requireAdmin, async (_req, res) => {
    const db = loadDatabase();
    const gasUrl = getEffectiveGasUrl(db);
    const now = new Date().toISOString();

    if (!gasUrl) {
      const checks: ConnectionServiceCheck[] = [
        {
          service: 'Backend Aplikasi',
          status: 'TERHUBUNG',
          message: 'Server API aplikasi berjalan aktif dan siap melayani permintaan.',
          checked_at: now,
        },
        {
          service: 'Google Apps Script',
          status: 'BELUM DIKONFIGURASI',
          message:
            'Google Apps Script Web App URL belum diisi pada menu Pengaturan. Saat ini menggunakan penyimpanan server lokal.',
          checked_at: now,
        },
        {
          service: 'Google Sheets',
          status: db.settings.spreadsheet_id ? 'BELUM DIKONFIGURASI' : 'BELUM DIKONFIGURASI',
          message:
            'Membutuhkan Google Apps Script Web App URL yang terhubung ke Google Sheets.',
          checked_at: now,
        },
        {
          service: 'Google Drive',
          status: 'BELUM DIKONFIGURASI',
          message: `Root Folder ID (${db.settings.drive_root_folder_id || '-'}) menunggu koneksi Google Apps Script.`,
          checked_at: now,
        },
      ];
      const result: ConnectionTestResult = {
        overall: 'BELUM DIKONFIGURASI',
        checks,
      };
      res.json({ ok: true, result });
      return;
    }

    try {
      const gasRes = (await callGasGet(gasUrl, {
        action: 'testSystemConnections',
        drive_root_folder_id: db.settings.drive_root_folder_id,
      })) as Record<string, string>;

      const checks: ConnectionServiceCheck[] = [
        {
          service: 'Backend Aplikasi',
          status: 'TERHUBUNG',
          message: 'Server API aplikasi berjalan aktif.',
          checked_at: now,
        },
        {
          service: 'Google Apps Script',
          status: (gasRes.gas_status as ConnectionServiceCheck['status']) || 'TERHUBUNG',
          message: 'Web App Google Apps Script merespons dengan baik.',
          checked_at: now,
        },
        {
          service: 'Google Sheets',
          status:
            (gasRes.sheets_status as ConnectionServiceCheck['status']) || 'GAGAL TERHUBUNG',
          message: gasRes.sheets_message || 'Tidak ada respons dari Spreadsheet.',
          checked_at: now,
        },
        {
          service: 'Google Drive',
          status:
            (gasRes.drive_status as ConnectionServiceCheck['status']) || 'GAGAL TERHUBUNG',
          message: gasRes.drive_message || 'Tidak ada respons dari Google Drive.',
          checked_at: now,
        },
      ];
      const allOk = checks.every((c) => c.status === 'TERHUBUNG');
      res.json({
        ok: true,
        result: {
          overall: allOk ? 'TERHUBUNG' : 'GAGAL TERHUBUNG',
          checks,
        },
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Koneksi ke Google Apps Script gagal.';
      const checks: ConnectionServiceCheck[] = [
        {
          service: 'Backend Aplikasi',
          status: 'TERHUBUNG',
          message: 'Server API aplikasi berjalan aktif.',
          checked_at: now,
        },
        {
          service: 'Google Apps Script',
          status: 'GAGAL TERHUBUNG',
          message: msg,
          checked_at: now,
        },
        {
          service: 'Google Sheets',
          status: 'GAGAL TERHUBUNG',
          message: 'Tidak dapat memverifikasi Google Sheets karena Apps Script gagal dihubungi.',
          checked_at: now,
        },
        {
          service: 'Google Drive',
          status: 'GAGAL TERHUBUNG',
          message: 'Tidak dapat memverifikasi Google Drive karena Apps Script gagal dihubungi.',
          checked_at: now,
        },
      ];
      res.json({
        ok: true,
        result: {
          overall: 'GAGAL TERHUBUNG',
          checks,
        },
      });
    }
  });

  // 4. Customer Portal Endpoints (Validated strictly by unique customer code)
  app.get('/api/customer', async (req, res) => {
    const code = String(req.query.code || '').trim().toUpperCase();
    if (!code) {
      res.status(400).json({ ok: false, error: 'Kode unik customer wajib diisi.' });
      return;
    }

    const db = loadDatabase();
    const gasUrl = getEffectiveGasUrl(db);
    const studioPublic = {
      nama_studio: db.settings.nama_studio,
      logo_url: db.settings.logo_url,
      whatsapp_studio: db.settings.whatsapp_studio,
      batas_revisi: db.settings.batas_revisi,
      izinkan_download_all_file: db.settings.izinkan_download_all_file,
      izinkan_download_ringkasan: db.settings.izinkan_download_ringkasan,
      izinkan_download_editan: db.settings.izinkan_download_editan,
      izinkan_download_revisi: db.settings.izinkan_download_revisi,
      izinkan_download_video: db.settings.izinkan_download_video,
    };

    if (gasUrl) {
      try {
        const custRes = (await callGasGet(gasUrl, {
          action: 'getCustomerByCode',
          code,
        })) as { ok: boolean; customer?: CustomerRecord; error?: string };
        if (!custRes.ok || !custRes.customer) {
          res.status(200).json({
            ok: false,
            notFound: true,
            error: custRes.error || 'Link customer tidak ditemukan atau kode unik tidak terdaftar.',
          });
          return;
        }
        const selRes = (await callGasGet(gasUrl, {
          action: 'getCustomerSelections',
          code,
        })) as {
          ok: boolean;
          selections?: PhotoSelectionItem[];
          submissions?: PhotoSelectionSubmission[];
          feedbacks?: FeedbackRecord[];
        };
        const draft = db.draftSelectionsByCode[code];
        res.json({
          ok: true,
          customer: custRes.customer,
          studio: studioPublic,
          draftSelections:
            draft && draft.items.length > 0 ? draft.items : selRes.selections || [],
          draftOverallNote: draft?.overallNote || '',
          submissions: selRes.submissions || [],
          feedbacks: selRes.feedbacks || [],
          logs: [],
        });
        return;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Gagal menghubungi Google Apps Script.';
        res.status(502).json({ ok: false, error: msg });
        return;
      }
    }

    const customer = db.customers.find(
      (c) => c.kode_unik.trim().toUpperCase() === code
    );
    if (!customer) {
      res.status(200).json({
        ok: false,
        notFound: true,
        error: 'Link customer tidak ditemukan atau kode unik tidak terdaftar.',
      });
      return;
    }

    const submissions = db.selections.filter(
      (s) => s.kode_unik.trim().toUpperCase() === code
    );
    const latestSubmission = submissions[submissions.length - 1];
    const draft = db.draftSelectionsByCode[code];
    const feedbacks = db.feedbacks.filter(
      (f) => f.kode_unik.trim().toUpperCase() === code
    );
    const logs = db.logs.filter(
      (l) => (l.kode_unik || '').trim().toUpperCase() === code
    );

    res.json({
      ok: true,
      customer,
      studio: studioPublic,
      draftSelections:
        draft && draft.items.length > 0
          ? draft.items
          : latestSubmission?.items || [],
      draftOverallNote:
        draft?.overallNote ?? latestSubmission?.catatan_keseluruhan ?? '',
      submissions,
      feedbacks,
      logs,
    });
  });

  app.get('/api/photos', async (req, res) => {
    const code = String(req.query.code || '').trim().toUpperCase();
    if (!code) {
      res.status(400).json({ ok: false, error: 'Kode unik wajib diisi.' });
      return;
    }
    const db = loadDatabase();
    const gasUrl = getEffectiveGasUrl(db);

    if (gasUrl) {
      try {
        const gasRes = (await callGasGet(gasUrl, {
          action: 'getCustomerFolderPhotos',
          code,
        })) as { ok: boolean; media?: DriveMediaItem[]; error?: string };
        if (!gasRes.ok) {
          res.status(200).json({
            ok: false,
            notFound: true,
            error: gasRes.error || 'Customer tidak ditemukan.',
          });
          return;
        }
        // Rewrite thumbnail/preview/download URLs via backend proxy so customer never needs Google login
        const proxiedMedia = sortMediaNaturally(gasRes.media || [], 'asc').map((m) => ({
          ...m,
          thumbnailUrl: `/api/media-proxy?fileId=${encodeURIComponent(m.id)}&code=${encodeURIComponent(code)}`,
          previewUrl: `/api/media-proxy?fileId=${encodeURIComponent(m.id)}&code=${encodeURIComponent(code)}`,
          downloadUrl: `/api/media-proxy?fileId=${encodeURIComponent(m.id)}&code=${encodeURIComponent(code)}&download=1`,
        }));
        res.json({ ok: true, kode_unik: code, media: proxiedMedia });
        return;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Gagal membaca folder Google Drive.';
        res.status(502).json({ ok: false, error: msg });
        return;
      }
    }

    const customer = db.customers.find(
      (c) => c.kode_unik.trim().toUpperCase() === code
    );
    if (!customer) {
      res.status(200).json({
        ok: false,
        notFound: true,
        error: 'Customer tidak ditemukan.',
      });
      return;
    }
    const media = readLocalCustomerMedia(code);
    res.json({ ok: true, kode_unik: code, media });
  });

  app.get('/api/media-proxy', async (req, res) => {
    const fileId = String(req.query.fileId || '').trim();
    const download = req.query.download === '1';
    if (!fileId) {
      res.status(400).json({ ok: false, error: 'fileId wajib diisi.' });
      return;
    }
    const db = loadDatabase();
    const gasUrl = getEffectiveGasUrl(db);
    if (!gasUrl) {
      res.status(400).json({ ok: false, error: 'Google Apps Script belum dikonfigurasi.' });
      return;
    }
    try {
      const gasRes = (await callGasGet(gasUrl, {
        action: 'getFileBase64',
        fileId,
      })) as { ok: boolean; name?: string; mimeType?: string; base64?: string; error?: string };
      if (!gasRes.ok || !gasRes.base64) {
        res.status(404).json({ ok: false, error: gasRes.error || 'File tidak ditemukan.' });
        return;
      }
      const buffer = Buffer.from(gasRes.base64, 'base64');
      res.setHeader('Content-Type', gasRes.mimeType || 'image/jpeg');
      res.setHeader('Cache-Control', 'public, max-age=3600');
      if (download && gasRes.name) {
        res.setHeader('Content-Disposition', `attachment; filename="${gasRes.name}"`);
      }
      res.send(buffer);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Gagal mengambil media dari Drive.';
      res.status(502).json({ ok: false, error: msg });
    }
  });

  app.get('/api/local-media/:code/:category/:filename', (req, res) => {
    const code = path.basename(req.params.code);
    const category = path.basename(req.params.category);
    const filename = path.basename(req.params.filename);
    const filePath = path.join(DRIVE_DIR, code, category, filename);
    if (!fs.existsSync(filePath)) {
      res.status(404).json({ ok: false, error: 'File media tidak ditemukan.' });
      return;
    }
    if (req.query.download === '1') {
      res.download(filePath, filename);
      return;
    }
    res.sendFile(filePath);
  });

  // Save draft selection safely across devices/tabs without overwriting final submission
  app.post('/api/selections/draft', (req, res) => {
    const code = String(req.body?.kode_unik || '').trim().toUpperCase();
    const items = Array.isArray(req.body?.items) ? (req.body.items as PhotoSelectionItem[]) : [];
    const overallNote = String(req.body?.catatan_keseluruhan || '');
    if (!code) {
      res.status(400).json({ ok: false, error: 'Kode unik wajib diisi.' });
      return;
    }
    const db = loadDatabase();
    db.draftSelectionsByCode[code] = {
      items,
      overallNote,
      updatedAt: new Date().toISOString(),
    };
    saveDatabase(db);
    res.json({ ok: true });
  });

  app.get('/api/selections', async (req, res) => {
    const code = String(req.query.code || '').trim().toUpperCase();
    if (!code) {
      res.status(400).json({ ok: false, error: 'Kode unik wajib diisi.' });
      return;
    }
    const db = loadDatabase();
    const gasUrl = getEffectiveGasUrl(db);
    if (gasUrl) {
      try {
        const gasRes = await callGasGet(gasUrl, { action: 'getCustomerSelections', code });
        res.json(gasRes);
        return;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Gagal mengambil data pilihan.';
        res.status(502).json({ ok: false, error: msg });
        return;
      }
    }
    const submissions = db.selections.filter(
      (s) => s.kode_unik.trim().toUpperCase() === code
    );
    const latest = submissions[submissions.length - 1];
    res.json({
      ok: true,
      selections: latest?.items || [],
      submissions,
    });
  });

  app.post('/api/selections', async (req, res) => {
    const code = String(req.body?.kode_unik || '').trim().toUpperCase();
    const items = Array.isArray(req.body?.items) ? (req.body.items as PhotoSelectionItem[]) : [];
    const overallNote = String(req.body?.catatan_keseluruhan || '');

    if (!code) {
      res.status(400).json({ ok: false, error: 'Kode unik customer tidak valid.' });
      return;
    }

    const db = loadDatabase();
    const gasUrl = getEffectiveGasUrl(db);

    if (gasUrl) {
      try {
        const gasRes = (await callGasPost(gasUrl, {
          action: 'handlePhotoSelectionSubmit',
          kode_unik: code,
          items,
          catatan_keseluruhan: overallNote,
        })) as Record<string, unknown>;
        if (gasRes.ok) {
          delete db.draftSelectionsByCode[code];
          saveDatabase(db);
        }
        res.status(gasRes.ok ? 200 : 400).json(gasRes);
        return;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Gagal mengirim pilihan ke Google Sheets.';
        res.status(502).json({ ok: false, error: msg });
        return;
      }
    }

    const customer = db.customers.find((c) => c.kode_unik.trim().toUpperCase() === code);
    if (!customer) {
      res.status(404).json({ ok: false, error: 'Customer tidak ditemukan.' });
      return;
    }

    const sanitizedItems = items.map((it) => ({
      ...it,
      pilih_tambahan: it.pilih_album ? false : Boolean(it.pilih_tambahan),
    }));

    const albumCount = sanitizedItems.filter((i) => i.pilih_album).length;
    const kanvasCount = sanitizedItems.filter((i) => i.pilih_kanvas).length;
    const tambahanCount = sanitizedItems.filter((i) => i.pilih_tambahan).length;

    if (albumCount > customer.kuota_album) {
      res.status(400).json({
        ok: false,
        error: `Pilihan album (${albumCount}) melebihi kuota (${customer.kuota_album}).`,
      });
      return;
    }
    if (kanvasCount > customer.kuota_kanvas) {
      res.status(400).json({
        ok: false,
        error: `Pilihan kanvas (${kanvasCount}) melebihi kuota (${customer.kuota_kanvas}).`,
      });
      return;
    }

    const nowIso = new Date().toISOString();
    const todayStr = nowIso.slice(0, 10);
    const estimasiSelesai = calculateEstimatedCompletionDate(
      todayStr,
      db.settings.estimasi_pengerjaan_bulan || 2
    );

    const submission: PhotoSelectionSubmission = {
      id_pilihan: `PIL-${crypto.randomBytes(4).toString('hex').toUpperCase()}`,
      id_customer: customer.id_customer,
      kode_unik: customer.kode_unik,
      nama_customer: customer.nama_customer,
      jumlah_album: albumCount,
      jumlah_kanvas: kanvasCount,
      jumlah_tambahan: tambahanCount,
      catatan_keseluruhan: overallNote,
      waktu_pengiriman: nowIso,
      estimasi_selesai: estimasiSelesai,
      items: sanitizedItems,
    };

    db.selections.push(submission);
    customer.tanggal_pemilihan = todayStr;
    customer.estimasi_selesai = estimasiSelesai;
    customer.status_pekerjaan = 'SUDAH_KIRIM_PILIHAN';
    if (albumCount > 0 && customer.status_album === 'DALAM ANTREAN') {
      customer.status_album = 'SEDANG DIPROSES';
    }
    if (kanvasCount > 0 && customer.status_kanvas === 'DALAM ANTREAN') {
      customer.status_kanvas = 'SEDANG DIPROSES';
    }
    delete db.draftSelectionsByCode[code];

    appendLog(
      db,
      'CUSTOMER',
      customer.kode_unik,
      customer.nama_customer,
      'KIRIM_PILIHAN_FOTO',
      `Mengirim ${albumCount} foto Album, ${kanvasCount} foto Kanvas, ${tambahanCount} foto Tambahan. Estimasi selesai: ${estimasiSelesai}.`
    );
    saveDatabase(db);

    res.json({
      ok: true,
      submission,
      estimasi_selesai: estimasiSelesai,
      waktu_pengiriman: nowIso,
    });
  });

  app.post('/api/feedback', async (req, res) => {
    const code = String(req.body?.kode_unik || '').trim().toUpperCase();
    const jenis = String(req.body?.jenis_feedback || 'CRITIC_SUGGESTION') as FeedbackRecord['jenis_feedback'];
    if (!code) {
      res.status(400).json({ ok: false, error: 'Kode unik wajib diisi.' });
      return;
    }

    const db = loadDatabase();
    const gasUrl = getEffectiveGasUrl(db);

    if (gasUrl) {
      try {
        const gasRes = (await callGasPost(gasUrl, {
          ...req.body,
          kode_unik: code,
          batas_revisi: db.settings.batas_revisi,
          action: 'handleFeedbackSubmit',
        })) as Record<string, unknown>;
        res.status(gasRes.ok ? 200 : 400).json(gasRes);
        return;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Gagal mengirim feedback ke Google Sheets.';
        res.status(502).json({ ok: false, error: msg });
        return;
      }
    }

    const customer = db.customers.find((c) => c.kode_unik.trim().toUpperCase() === code);
    if (!customer) {
      res.status(404).json({ ok: false, error: 'Customer tidak ditemukan.' });
      return;
    }

    let revisiKe: number | undefined;
    if (jenis === 'REVISION_REQUEST') {
      const maxRev = db.settings.batas_revisi || 2;
      if (customer.jumlah_revisi >= maxRev) {
        res.status(400).json({
          ok: false,
          error: `Batas maksimal pengajuan revisi (${maxRev} kali) sudah tercapai.`,
        });
        return;
      }
      revisiKe = customer.jumlah_revisi + 1;
      customer.jumlah_revisi = revisiKe;
      customer.status_pekerjaan = 'BUTUH_REVISI';
      if (customer.status_album !== 'TIDAK PAKAI') {
        customer.status_album = 'SEDANG DIPROSES';
      }
    } else if (jenis === 'EDIT_APPROVAL') {
      customer.status_pekerjaan = 'PROSES_CETAK';
      if (customer.status_album !== 'TIDAK PAKAI') {
        customer.status_album = 'PROSES CETAK';
      }
      if (customer.status_kanvas !== 'TIDAK PAKAI') {
        customer.status_kanvas = 'PROSES CETAK';
      }
    }

    const record: FeedbackRecord = {
      id_feedback: `FDB-${crypto.randomBytes(4).toString('hex').toUpperCase()}`,
      id_customer: customer.id_customer,
      kode_unik: customer.kode_unik,
      nama_customer: customer.nama_customer,
      jenis_feedback: jenis,
      rating: req.body?.rating ? Number(req.body.rating) : undefined,
      kategori_masukan: req.body?.kategori_masukan ? String(req.body.kategori_masukan) : undefined,
      catatan_umum: String(req.body?.catatan_umum || ''),
      revisi_ke: revisiKe,
      detail_revisi: Array.isArray(req.body?.detail_revisi) ? req.body.detail_revisi : undefined,
      waktu_kirim: new Date().toISOString(),
    };

    db.feedbacks.unshift(record);
    appendLog(
      db,
      'CUSTOMER',
      customer.kode_unik,
      customer.nama_customer,
      jenis,
      record.catatan_umum || 'Customer mengirimkan konfirmasi.'
    );
    saveDatabase(db);

    res.json({
      ok: true,
      feedback: record,
      revisi_ke: revisiKe,
    });
  });

  // One-click server ZIP download endpoint
  app.get('/api/download-zip', async (req, res) => {
    const code = String(req.query.code || '').trim().toUpperCase();
    const category = String(req.query.category || 'ALL FILE').trim().toUpperCase() as DriveSubfolderCategory;
    if (!code) {
      res.status(400).json({ ok: false, error: 'Kode unik wajib diisi.' });
      return;
    }

    const db = loadDatabase();
    const gasUrl = getEffectiveGasUrl(db);

    let customer: CustomerRecord | undefined;
    let media: DriveMediaItem[] = [];

    if (gasUrl) {
      try {
        const custRes = (await callGasGet(gasUrl, {
          action: 'getCustomerByCode',
          code,
        })) as { ok: boolean; customer?: CustomerRecord };
        customer = custRes.customer;
        const photosRes = (await callGasGet(gasUrl, {
          action: 'getCustomerFolderPhotos',
          code,
        })) as { ok: boolean; media?: DriveMediaItem[] };
        media = photosRes.media || [];
      } catch (err) {
        res.status(502).json({ ok: false, error: 'Gagal mengambil file dari Google Drive.' });
        return;
      }
    } else {
      customer = db.customers.find((c) => c.kode_unik.trim().toUpperCase() === code);
      media = readLocalCustomerMedia(code);
    }

    if (!customer) {
      res.status(404).json({ ok: false, error: 'Customer tidak ditemukan.' });
      return;
    }

    if (!isFolderDownloadAllowed(category, customer, db.settings)) {
      res.status(403).json({
        ok: false,
        error: `Unduhan untuk folder ${category} saat ini dinonaktifkan oleh admin studio.`,
      });
      return;
    }

    const filtered = media.filter((m) => m.category === category);
    if (filtered.length === 0) {
      res.status(404).json({
        ok: false,
        error: `Tidak ada file di dalam folder ${category}.`,
      });
      return;
    }

    const zip = new JSZip();
    for (const item of filtered) {
      if (gasUrl) {
        const fileRes = (await callGasGet(gasUrl, {
          action: 'getFileBase64',
          fileId: item.id,
        })) as { ok: boolean; base64?: string };
        if (fileRes.ok && fileRes.base64) {
          zip.file(item.name, Buffer.from(fileRes.base64, 'base64'));
        }
      } else {
        const filePath = path.join(DRIVE_DIR, code, category, item.name);
        if (fs.existsSync(filePath)) {
          zip.file(item.name, fs.readFileSync(filePath));
        }
      }
    }

    const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });
    const cleanFilename = `LOUIS-BRIDES-${code}-${category.replace(/\s+/g, '-')}.zip`;
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${cleanFilename}"`);
    res.send(zipBuffer);
  });

  // 5. Protected Admin Endpoints
  app.get('/api/customers', requireAdmin, async (_req, res) => {
    const db = loadDatabase();
    const gasUrl = getEffectiveGasUrl(db);
    if (gasUrl) {
      try {
        const gasRes = (await callGasGet(gasUrl, {
          action: 'getAdminFullData',
        })) as AdminFullDataPayload & { ok: boolean; error?: string };
        if (!gasRes.ok) {
          res.status(502).json(gasRes);
          return;
        }
        res.json({
          ok: true,
          customers: gasRes.customers || [],
          selections: gasRes.selections || [],
          feedbacks: gasRes.feedbacks || [],
          marketing: gasRes.marketing && gasRes.marketing.length > 0 ? gasRes.marketing : db.marketing,
          logs: gasRes.logs || [],
          settings: {
            ...db.settings,
            ...(gasRes.settings || {}),
          },
        });
        return;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Gagal mengambil data dari Google Sheets.';
        res.status(502).json({ ok: false, error: msg });
        return;
      }
    }

    res.json({
      ok: true,
      customers: db.customers,
      selections: db.selections,
      feedbacks: db.feedbacks,
      marketing: db.marketing,
      logs: db.logs,
      settings: db.settings,
    });
  });

  app.post('/api/customer', requireAdmin, async (req, res) => {
    const db = loadDatabase();
    const gasUrl = getEffectiveGasUrl(db);
    const body = req.body as Partial<CustomerRecord>;

    if (!body.nama_customer || !String(body.nama_customer).trim()) {
      res.status(400).json({ ok: false, error: 'Nama pengantin atau pelanggan wajib diisi.' });
      return;
    }

    if (gasUrl) {
      try {
        const gasRes = (await callGasPost(gasUrl, {
          ...body,
          drive_root_folder_id: db.settings.drive_root_folder_id,
          action: 'handleAddCustomer',
        })) as Record<string, unknown>;
        res.status(gasRes.ok ? 200 : 400).json(gasRes);
        return;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Gagal menyimpan customer ke Google Sheets.';
        res.status(502).json({ ok: false, error: msg });
        return;
      }
    }

    const existingCodes = new Set(db.customers.map((c) => c.kode_unik.toUpperCase()));
    const requestedCode = String(body.kode_unik || '').trim().toUpperCase();
    const existingIdx = body.id_customer
      ? db.customers.findIndex((c) => c.id_customer === body.id_customer)
      : requestedCode
      ? db.customers.findIndex((c) => c.kode_unik.toUpperCase() === requestedCode)
      : -1;

    const kodeUnik =
      requestedCode ||
      (existingIdx >= 0
        ? db.customers[existingIdx].kode_unik
        : generateUniqueCustomerCode(existingCodes));

    ensureLocalCustomerFolders(kodeUnik);

    const nowIso = new Date().toISOString();
    const todayStr = nowIso.slice(0, 10);
    const existingCustomer = existingIdx >= 0 ? db.customers[existingIdx] : undefined;

    const record: CustomerRecord = {
      id_customer:
        existingCustomer?.id_customer ||
        body.id_customer ||
        `CUST-${crypto.randomBytes(4).toString('hex').toUpperCase()}`,
      kode_unik: kodeUnik,
      nama_customer: String(body.nama_customer).trim(),
      nama_keluarga: String(body.nama_keluarga || '').trim(),
      paket: String(body.paket || 'Signature Package').trim(),
      jenis_layanan: (body.jenis_layanan || 'PREWEDING') as CustomerRecord['jenis_layanan'],
      email: String(body.email || '').trim(),
      whatsapp: String(body.whatsapp || '').trim(),
      nama_marketing: String(body.nama_marketing || '').trim(),
      tanggal_pendaftaran: body.tanggal_pendaftaran || existingCustomer?.tanggal_pendaftaran || todayStr,
      tanggal_pemotretan: body.tanggal_pemotretan || existingCustomer?.tanggal_pemotretan || todayStr,
      tanggal_pemilihan: body.tanggal_pemilihan ?? existingCustomer?.tanggal_pemilihan ?? '',
      tanggal_mulai_kerja: body.tanggal_mulai_kerja ?? existingCustomer?.tanggal_mulai_kerja ?? '',
      tanggal_cetak: body.tanggal_cetak ?? existingCustomer?.tanggal_cetak ?? '',
      estimasi_selesai: body.estimasi_selesai ?? existingCustomer?.estimasi_selesai ?? '',
      kuota_album: Number(body.kuota_album ?? db.settings.default_kuota_album ?? 20),
      kuota_kanvas: Number(body.kuota_kanvas ?? db.settings.default_kuota_kanvas ?? 1),
      ukuran_kanvas: String(body.ukuran_kanvas || db.settings.default_ukuran_kanvas || '60x90 cm'),
      kuota_tambahan: Number(body.kuota_tambahan ?? db.settings.default_kuota_tambahan ?? 10),
      catatan_customer: String(body.catatan_customer || ''),
      catatan_produksi: String(body.catatan_produksi || existingCustomer?.catatan_produksi || ''),
      drive_folder_id:
        body.drive_folder_id ||
        existingCustomer?.drive_folder_id ||
        `LOCAL-${kodeUnik}`,
      drive_folder_url:
        body.drive_folder_url ||
        existingCustomer?.drive_folder_url ||
        `https://drive.google.com/drive/folders/${db.settings.drive_root_folder_id}`,
      subfolder_ids: existingCustomer?.subfolder_ids || {
        'ALL FILE': { id: `${kodeUnik}:ALL FILE`, url: '' },
        RINGKASAN: { id: `${kodeUnik}:RINGKASAN`, url: '' },
        'LIHAT EDITAN': { id: `${kodeUnik}:LIHAT EDITAN`, url: '' },
        REVISI: { id: `${kodeUnik}:REVISI`, url: '' },
        VIDEO: { id: `${kodeUnik}:VIDEO`, url: '' },
      },
      status_pekerjaan:
        body.status_pekerjaan || existingCustomer?.status_pekerjaan || 'BELUM_MEMILIH',
      status_album: body.status_album || existingCustomer?.status_album || 'DALAM ANTREAN',
      status_kanvas: body.status_kanvas || existingCustomer?.status_kanvas || 'DALAM ANTREAN',
      jumlah_revisi: Number(body.jumlah_revisi ?? existingCustomer?.jumlah_revisi ?? 0),
      izinkan_download:
        body.izinkan_download !== undefined
          ? Boolean(body.izinkan_download)
          : existingCustomer?.izinkan_download ?? true,
      created_at: existingCustomer?.created_at || nowIso,
    };

    if (existingIdx >= 0) {
      db.customers[existingIdx] = record;
      appendLog(
        db,
        'ADMIN',
        record.kode_unik,
        record.nama_customer,
        'UPDATE_CUSTOMER',
        'Data customer diperbarui oleh admin.'
      );
    } else {
      db.customers.unshift(record);
      appendLog(
        db,
        'ADMIN',
        record.kode_unik,
        record.nama_customer,
        'TAMBAH_CUSTOMER',
        'Customer baru ditambahkan dan 5 subfolder (ALL FILE, RINGKASAN, LIHAT EDITAN, REVISI, VIDEO) disiapkan.'
      );
    }

    saveDatabase(db);
    res.json({ ok: true, customer: record });
  });

  app.delete('/api/customer', requireAdmin, async (req, res) => {
    const code = String(req.query.code || '').trim().toUpperCase();
    if (!code) {
      res.status(400).json({ ok: false, error: 'Kode unik wajib diisi.' });
      return;
    }

    const db = loadDatabase();
    const gasUrl = getEffectiveGasUrl(db);
    if (gasUrl) {
      try {
        const gasRes = (await callGasPost(gasUrl, {
          kode_unik: code,
          action: 'handleDeleteCustomer',
        })) as Record<string, unknown>;
        res.status(gasRes.ok ? 200 : 400).json(gasRes);
        return;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Gagal menghapus customer di Google Sheets.';
        res.status(502).json({ ok: false, error: msg });
        return;
      }
    }

    const idx = db.customers.findIndex((c) => c.kode_unik.toUpperCase() === code);
    if (idx === -1) {
      res.status(404).json({ ok: false, error: 'Customer tidak ditemukan.' });
      return;
    }
    const removed = db.customers[idx];
    db.customers.splice(idx, 1);
    appendLog(
      db,
      'ADMIN',
      removed.kode_unik,
      removed.nama_customer,
      'HAPUS_CUSTOMER',
      'Data customer dihapus (file asli di folder tetap aman).'
    );
    saveDatabase(db);
    res.json({ ok: true });
  });

  app.post('/api/customer/status', requireAdmin, async (req, res) => {
    const code = String(req.body?.kode_unik || '').trim().toUpperCase();
    if (!code) {
      res.status(400).json({ ok: false, error: 'Kode unik wajib diisi.' });
      return;
    }

    const db = loadDatabase();
    const gasUrl = getEffectiveGasUrl(db);
    if (gasUrl) {
      try {
        const gasRes = (await callGasPost(gasUrl, {
          ...req.body,
          kode_unik: code,
          action: 'handleUpdateCustomerStatus',
        })) as Record<string, unknown>;
        res.status(gasRes.ok ? 200 : 400).json(gasRes);
        return;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Gagal memperbarui status di Google Sheets.';
        res.status(502).json({ ok: false, error: msg });
        return;
      }
    }

    const customer = db.customers.find((c) => c.kode_unik.toUpperCase() === code);
    if (!customer) {
      res.status(404).json({ ok: false, error: 'Customer tidak ditemukan.' });
      return;
    }

    if (req.body.status_pekerjaan !== undefined) {
      customer.status_pekerjaan = req.body.status_pekerjaan;
    }
    if (req.body.status_album !== undefined) {
      customer.status_album = req.body.status_album;
    }
    if (req.body.status_kanvas !== undefined) {
      customer.status_kanvas = req.body.status_kanvas;
    }
    if (req.body.tanggal_mulai_kerja !== undefined) {
      customer.tanggal_mulai_kerja = req.body.tanggal_mulai_kerja;
    }
    if (req.body.tanggal_cetak !== undefined) {
      customer.tanggal_cetak = req.body.tanggal_cetak;
    }
    if (req.body.estimasi_selesai !== undefined) {
      customer.estimasi_selesai = req.body.estimasi_selesai;
    }
    if (req.body.catatan_produksi !== undefined) {
      customer.catatan_produksi = req.body.catatan_produksi;
    }
    if (req.body.izinkan_download !== undefined) {
      customer.izinkan_download = Boolean(req.body.izinkan_download);
    }

    // Automatically synchronize overall status when both Album and Kanvas are finished
    if (
      (customer.status_album === 'SUDAH JADI' || customer.status_album === 'TIDAK PAKAI') &&
      (customer.status_kanvas === 'SUDAH JADI' || customer.status_kanvas === 'TIDAK PAKAI') &&
      (customer.status_album === 'SUDAH JADI' || customer.status_kanvas === 'SUDAH JADI')
    ) {
      customer.status_pekerjaan = 'SELESAI';
    } else if (
      customer.status_album === 'LIHAT EDITAN' ||
      customer.status_kanvas === 'LIHAT EDITAN'
    ) {
      customer.status_pekerjaan = 'MENUNGGU_PERSETUJUAN';
    } else if (
      customer.status_album === 'PROSES CETAK' ||
      customer.status_album === 'CETAK' ||
      customer.status_kanvas === 'PROSES CETAK' ||
      customer.status_kanvas === 'CETAK'
    ) {
      customer.status_pekerjaan = 'PROSES_CETAK';
    }

    appendLog(
      db,
      'ADMIN',
      customer.kode_unik,
      customer.nama_customer,
      'UPDATE_STATUS_PRODUKSI',
      `Album: ${customer.status_album} · Kanvas: ${customer.status_kanvas}`
    );
    saveDatabase(db);
    res.json({ ok: true, customer });
  });

  // Upload photo/video into customer's local folder (when GAS is not yet connected)
  app.post('/api/photos/upload', requireAdmin, (req, res) => {
    const code = String(req.body?.kode_unik || '').trim().toUpperCase();
    const category = String(req.body?.category || 'ALL FILE').trim().toUpperCase() as DriveSubfolderCategory;
    const files = Array.isArray(req.body?.files)
      ? (req.body.files as Array<{ name: string; base64: string }>)
      : [];

    if (!code || !SUBFOLDER_NAMES.includes(category)) {
      res.status(400).json({ ok: false, error: 'Kode customer atau kategori folder tidak valid.' });
      return;
    }

    const db = loadDatabase();
    const customer = db.customers.find((c) => c.kode_unik.toUpperCase() === code);
    if (!customer) {
      res.status(404).json({ ok: false, error: 'Customer tidak ditemukan.' });
      return;
    }

    const clientDir = ensureLocalCustomerFolders(code);
    const targetDir = path.join(clientDir, category);
    let savedCount = 0;

    for (const file of files) {
      if (!file.name || !file.base64) continue;
      const safeName = path.basename(file.name);
      const rawBase64 = file.base64.includes(',') ? file.base64.split(',')[1] : file.base64;
      fs.writeFileSync(path.join(targetDir, safeName), Buffer.from(rawBase64, 'base64'));
      savedCount++;
    }

    appendLog(
      db,
      'ADMIN',
      customer.kode_unik,
      customer.nama_customer,
      'UPLOAD_MEDIA',
      `Mengunggah ${savedCount} file ke folder ${category}.`
    );
    saveDatabase(db);

    res.json({
      ok: true,
      savedCount,
      media: readLocalCustomerMedia(code),
    });
  });

  // Delete a file from local customer folder
  app.delete('/api/photos/file', requireAdmin, (req, res) => {
    const code = String(req.query.code || '').trim().toUpperCase();
    const category = String(req.query.category || '').trim().toUpperCase();
    const filename = path.basename(String(req.query.filename || ''));
    if (!code || !category || !filename) {
      res.status(400).json({ ok: false, error: 'Parameter tidak lengkap.' });
      return;
    }
    const target = path.join(DRIVE_DIR, code, category, filename);
    if (fs.existsSync(target)) {
      fs.unlinkSync(target);
    }
    res.json({ ok: true, media: readLocalCustomerMedia(code) });
  });

  // Copy studio sample portfolio images into a customer's folder (explicit admin helper for testing)
  app.post('/api/photos/seed-samples', requireAdmin, (req, res) => {
    const code = String(req.body?.kode_unik || '').trim().toUpperCase();
    const db = loadDatabase();
    const customer = db.customers.find((c) => c.kode_unik.toUpperCase() === code);
    if (!customer) {
      res.status(404).json({ ok: false, error: 'Customer tidak ditemukan.' });
      return;
    }
    const clientDir = ensureLocalCustomerFolders(code);
    const assetsDir = path.join(ROOT_DIR, 'src', 'assets', 'images');
    const availableAssets = fs.existsSync(assetsDir)
      ? fs.readdirSync(assetsDir).filter((f) => /\.(jpg|jpeg|png)$/i.test(f))
      : [];

    if (availableAssets.length === 0) {
      res.status(404).json({ ok: false, error: 'Aset studio tidak ditemukan.' });
      return;
    }

    const allFileDir = path.join(clientDir, 'ALL FILE');
    const editanDir = path.join(clientDir, 'LIHAT EDITAN');
    availableAssets.forEach((asset, idx) => {
      const num = String(idx + 1).padStart(3, '0');
      const srcPath = path.join(assetsDir, asset);
      fs.copyFileSync(srcPath, path.join(allFileDir, `LB_${num}.jpg`));
      if (idx < 2) {
        fs.copyFileSync(srcPath, path.join(editanDir, `EDIT_LB_${num}.jpg`));
      }
    });

    appendLog(
      db,
      'ADMIN',
      customer.kode_unik,
      customer.nama_customer,
      'ISI_SAMPLE_FOLDER',
      `Menambahkan ${availableAssets.length} foto uji ke folder ALL FILE & LIHAT EDITAN.`
    );
    saveDatabase(db);
    res.json({ ok: true, media: readLocalCustomerMedia(code) });
  });

  // Save Studio Settings
  app.post('/api/settings', requireAdmin, async (req, res) => {
    const db = loadDatabase();
    const incoming = req.body as Partial<StudioSettings>;
    db.settings = {
      ...db.settings,
      ...incoming,
      whatsapp_templates: {
        ...db.settings.whatsapp_templates,
        ...(incoming.whatsapp_templates || {}),
      },
    };
    appendLog(db, 'ADMIN', undefined, undefined, 'SIMPAN_PENGATURAN', 'Pengaturan studio diperbarui.');
    saveDatabase(db);

    const gasUrl = getEffectiveGasUrl(db);
    if (gasUrl) {
      try {
        await callGasPost(gasUrl, {
          ...db.settings,
          action: 'handleSaveSettings',
        });
      } catch {
        // Pengaturan lokal tetap tersimpan meski GAS gagal dihubungi saat menyimpan URL baru
      }
    }

    res.json({ ok: true, settings: db.settings });
  });

  // Manage Marketing Team
  app.post('/api/marketing', requireAdmin, (req, res) => {
    const db = loadDatabase();
    const actionType = String(req.body?.op || 'UPSERT');
    if (actionType === 'DELETE') {
      const id = String(req.body?.id_marketing || '');
      db.marketing = db.marketing.filter((m) => m.id_marketing !== id);
      appendLog(db, 'ADMIN', undefined, undefined, 'HAPUS_MARKETING', `Menghapus kontak marketing (${id}).`);
      saveDatabase(db);
      res.json({ ok: true, marketing: db.marketing });
      return;
    }

    const member: MarketingMember = {
      id_marketing:
        req.body?.id_marketing ||
        `MKT-${crypto.randomBytes(3).toString('hex').toUpperCase()}`,
      nama: String(req.body?.nama || '').trim(),
      whatsapp: String(req.body?.whatsapp || '').trim(),
      email: String(req.body?.email || '').trim(),
      status: req.body?.status === 'NONAKTIF' ? 'NONAKTIF' : 'AKTIF',
    };

    if (!member.nama) {
      res.status(400).json({ ok: false, error: 'Nama marketing wajib diisi.' });
      return;
    }

    const idx = db.marketing.findIndex((m) => m.id_marketing === member.id_marketing);
    if (idx >= 0) {
      db.marketing[idx] = member;
    } else {
      db.marketing.push(member);
    }
    appendLog(db, 'ADMIN', undefined, undefined, 'SIMPAN_MARKETING', `Menyimpan kontak marketing: ${member.nama}.`);
    saveDatabase(db);
    res.json({ ok: true, marketing: db.marketing });
  });

  // Return Google Apps Script source code for easy copy/download in Admin Settings
  app.get('/api/gas-source', requireAdmin, (_req, res) => {
    const gasPath = path.join(ROOT_DIR, 'gas', 'Code.gs');
    if (!fs.existsSync(gasPath)) {
      res.status(404).json({ ok: false, error: 'File gas/Code.gs tidak ditemukan.' });
      return;
    }
    res.json({ ok: true, code: fs.readFileSync(gasPath, 'utf-8') });
  });

  // Mount Vite or Static Production Build
  if (process.env.NODE_ENV === 'production') {
    const distDir = path.join(ROOT_DIR, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`LOUIS BRIDES PILIH FOTO V1 server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
