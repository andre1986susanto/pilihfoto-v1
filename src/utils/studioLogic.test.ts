import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyPhotoSelectionToggle,
  buildCustomersCsv,
  calculateEstimatedCompletionDate,
  calculateRetentionStatus,
  calculateVideoRetentionStatus,
  evaluateSelectionQuotas,
  formatDateDDMMYYYY,
  formatDateIndonesian,
  formatInternationalWhatsApp,
  generateUniqueCustomerCode,
  interpolateWhatsAppMessage,
  isCustomerApproachingDeadline,
  isCustomerJobOverdue,
  isFolderDownloadAllowed,
  sortMediaNaturally,
  toInputDateFormat,
} from './studioLogic';
import type { CustomerRecord, PhotoSelectionItem } from '../types/studio';

test('natural filename sorting orders 001, 002, 010, 100 naturally', () => {
  const input = [
    { name: 'IMG_010.jpg' },
    { name: 'IMG_002.jpg' },
    { name: 'IMG_100.jpg' },
    { name: 'IMG_001.jpg' },
  ];
  const asc = sortMediaNaturally(input, 'asc').map((x) => x.name);
  assert.deepEqual(asc, ['IMG_001.jpg', 'IMG_002.jpg', 'IMG_010.jpg', 'IMG_100.jpg']);

  const desc = sortMediaNaturally(input, 'desc').map((x) => x.name);
  assert.deepEqual(desc, ['IMG_100.jpg', 'IMG_010.jpg', 'IMG_002.jpg', 'IMG_001.jpg']);
});

test('selection toggle enforces mutual exclusivity between PILIH ALBUM and FOTO TAMBAHAN while allowing ALBUM + KANVAS', () => {
  const file = { id: 'f1', name: '001.jpg' };

  // Select Album
  let sel = applyPhotoSelectionToggle(undefined, file, 'pilih_album');
  assert.equal(sel.pilih_album, true);
  assert.equal(sel.pilih_tambahan, false);

  // Also select Kanvas -> both Album and Kanvas should remain true
  sel = applyPhotoSelectionToggle(sel, file, 'pilih_kanvas');
  assert.equal(sel.pilih_album, true);
  assert.equal(sel.pilih_kanvas, true);
  assert.equal(sel.pilih_tambahan, false);

  // Switch to Foto Tambahan -> Album must automatically turn off while Kanvas stays
  sel = applyPhotoSelectionToggle(sel, file, 'pilih_tambahan');
  assert.equal(sel.pilih_album, false);
  assert.equal(sel.pilih_tambahan, true);
  assert.equal(sel.pilih_kanvas, true);

  // Switch back to Album -> Tambahan must turn off
  sel = applyPhotoSelectionToggle(sel, file, 'pilih_album');
  assert.equal(sel.pilih_album, true);
  assert.equal(sel.pilih_tambahan, false);
});

test('quota evaluation detects under-quota warning, exact match, and over-quota block', () => {
  const items: PhotoSelectionItem[] = [
    {
      file_id: '1',
      file_name: '001.jpg',
      pilih_album: true,
      pilih_kanvas: true,
      pilih_tambahan: false,
      catatan_edit: 'Cerahkan wajah',
    },
    {
      file_id: '2',
      file_name: '002.jpg',
      pilih_album: true,
      pilih_kanvas: false,
      pilih_tambahan: false,
      catatan_edit: '',
    },
  ];

  // Exact match (2/2 album, 1/1 kanvas)
  const exact = evaluateSelectionQuotas(items, 2, 1);
  assert.equal(exact.albumState, 'SUDAH_TERPENUHI');
  assert.equal(exact.kanvasState, 'SUDAH_TERPENUHI');
  assert.equal(exact.canSubmit, true);
  assert.equal(exact.hasUnderQuotaWarning, false);
  assert.equal(exact.totalNotes, 1);

  // Under quota (2/5 album, 1/1 kanvas) -> allowed with warning
  const under = evaluateSelectionQuotas(items, 5, 1);
  assert.equal(under.albumState, 'BELUM_TERPENUHI');
  assert.equal(under.canSubmit, true);
  assert.equal(under.hasUnderQuotaWarning, true);

  // Over quota (2/1 album) -> blocked
  const over = evaluateSelectionQuotas(items, 1, 1);
  assert.equal(over.albumState, 'MELEBIHI_KUOTA');
  assert.equal(over.canSubmit, false);
  assert.equal(over.validationErrors.length, 1);
});

test('2-calendar-month completion date calculation handles standard and month-end dates accurately', () => {
  assert.equal(calculateEstimatedCompletionDate('2026-03-15', 2), '2026-05-15');
  assert.equal(calculateEstimatedCompletionDate('2026-12-31', 2), '2027-02-28');
  assert.equal(calculateEstimatedCompletionDate('2027-12-31', 2), '2028-02-29'); // leap year 2028
});

test('formatDateDDMMYYYY formats dates accurately to DD-MM-YYYY format', () => {
  assert.equal(formatDateDDMMYYYY('2026-11-06'), '06-11-2026');
  assert.equal(formatDateDDMMYYYY('2027-01-15T10:30:00Z'), '15-01-2027');
  assert.equal(formatDateDDMMYYYY('15-08-2026'), '15-08-2026');
  assert.equal(formatDateDDMMYYYY('', '-'), '-');
  assert.equal(formatDateDDMMYYYY(null, '-'), '-');
});

test('30-day retention calculation computes remaining days and urgent state accurately', () => {
  const created = '2026-10-12T00:00:00.000Z';
  const ref = new Date('2026-11-06T00:00:00.000Z'); // 25 days later -> 5 days remaining
  const status = calculateRetentionStatus(created, ref);
  assert.equal(status.daysElapsed, 25);
  assert.equal(status.daysRemaining, 5);
  assert.equal(status.isUrgent, true);
  assert.equal(status.isExpired, false);
});

test('WhatsApp formatting and template interpolation work for Indonesian numbers', () => {
  assert.equal(formatInternationalWhatsApp('0812-3456-7890'), '6281234567890');
  assert.equal(formatInternationalWhatsApp('+62 811 9988 7766'), '6281199887766');

  const sampleCustomer: CustomerRecord = {
    id_customer: 'CUST-1',
    nama_customer: 'Andi & Sinta',
    paket: 'Signature Prewedding',
    jenis_layanan: 'PREWEDING',
    email: 'andi@example.com',
    whatsapp: '08123456789',
    nama_marketing: 'Rina',
    tanggal_pendaftaran: '2026-11-01',
    tanggal_pemotretan: '2026-11-05',
    estimasi_selesai: '2027-01-06',
    kuota_album: 20,
    kuota_kanvas: 1,
    ukuran_kanvas: '60x90 cm',
    kuota_tambahan: 5,
    drive_folder_url: 'https://drive.google.com/drive/folders/abc',
    kode_unik: 'LB-W3JL2',
    status_pekerjaan: 'BELUM_MEMILIH',
    status_album: 'DALAM ANTREAN',
    status_kanvas: 'DALAM ANTREAN',
    jumlah_revisi: 0,
    izinkan_download: true,
    created_at: '2026-11-01T00:00:00.000Z',
  };

  const msg = interpolateWhatsAppMessage(
    'Halo {nama_customer}, buka {link_customer} (Kode: {kode_unik}) oleh {nama_marketing}',
    sampleCustomer,
    'https://louisbrides.pages.dev'
  );
  assert.equal(
    msg,
    'Halo Andi & Sinta, buka https://louisbrides.pages.dev/c/LB-W3JL2 (Kode: LB-W3JL2) oleh Rina'
  );

  assert.equal(isCustomerJobOverdue(sampleCustomer, '2027-01-10'), true);
  assert.equal(isCustomerJobOverdue(sampleCustomer, '2027-01-05'), false);
  assert.equal(isCustomerApproachingDeadline(sampleCustomer, '2027-01-01', 14), true);

  const csv = buildCustomersCsv([sampleCustomer]);
  assert.ok(csv.includes('LB-W3JL2'));
  assert.ok(csv.includes('Andi & Sinta'));
});

test('unique code generator avoids collisions and folder download permissions respect admin settings', () => {
  const existing = new Set(['LB-AAAAA', 'LB-BBBBB']);
  const code = generateUniqueCustomerCode(existing);
  assert.ok(code.startsWith('LB-'));
  assert.equal(code.length, 8);
  assert.equal(existing.has(code), false);

  const cust = { izinkan_download: true } as CustomerRecord;
  const settings = {
    izinkan_download_all_file: true,
    izinkan_download_ringkasan: true,
    izinkan_download_editan: false,
    izinkan_download_revisi: true,
    izinkan_download_video: false,
  };
  assert.equal(isFolderDownloadAllowed('ALL FILE', cust, settings), true);
  assert.equal(isFolderDownloadAllowed('LIHAT EDITAN', cust, settings), false);
  assert.equal(isFolderDownloadAllowed('VIDEO', cust, settings), false);
});

test('toInputDateFormat converts various date representations to HTML5 YYYY-MM-DD', () => {
  assert.equal(toInputDateFormat('2026-11-05'), '2026-11-05');
  assert.equal(toInputDateFormat('05-11-2026'), '2026-11-05');
  assert.equal(toInputDateFormat('Fri Nov 06 2026 00:00:00 GMT+0700'), '2026-11-06');
  assert.equal(toInputDateFormat('2027-01-06T00:00:00.000Z'), '2027-01-06');
  assert.equal(toInputDateFormat(''), '');
  assert.equal(toInputDateFormat(null), '');
});

test('calculateVideoRetentionStatus evaluates retention and warnings accurately', () => {
  const ref = new Date('2026-11-06T12:00:00Z');

  // Test 1: SAFE (> 7 days remaining, e.g. uploaded today)
  const safe = calculateVideoRetentionStatus('2026-11-06T12:00:00Z', ref);
  assert.equal(safe.hasValidDate, true);
  assert.equal(safe.status, 'SAFE');
  assert.equal(safe.statusText, 'Masa penyimpanan masih tersedia');
  assert.equal(safe.remainingDays, 30);
  assert.equal(safe.isExpired, false);

  // Test 2: WARNING (<= 7 days remaining, e.g. uploaded 25 days ago)
  const upload25DaysAgo = new Date(ref.getTime() - 25 * 24 * 60 * 60 * 1000).toISOString();
  const warning = calculateVideoRetentionStatus(upload25DaysAgo, ref);
  assert.equal(warning.status, 'WARNING');
  assert.equal(warning.statusText, 'Peringatan, segera download video');
  assert.equal(warning.remainingDays, 5);

  // Test 3: HIGH_WARNING (<= 3 days remaining, e.g. uploaded 28 days ago)
  const upload28DaysAgo = new Date(ref.getTime() - 28 * 24 * 60 * 60 * 1000).toISOString();
  const highWarning = calculateVideoRetentionStatus(upload28DaysAgo, ref);
  assert.equal(highWarning.status, 'HIGH_WARNING');
  assert.equal(highWarning.statusText, 'Peringatan penting, masa penyimpanan hampir habis');
  assert.equal(highWarning.remainingDays, 2);

  // Test 4: CRITICAL (<= 1 day remaining, e.g. uploaded 29.5 days ago)
  const upload29AndHalfDaysAgo = new Date(ref.getTime() - 29.5 * 24 * 60 * 60 * 1000).toISOString();
  const critical = calculateVideoRetentionStatus(upload29AndHalfDaysAgo, ref);
  assert.equal(critical.status, 'CRITICAL');
  assert.equal(critical.statusText, 'Peringatan mendesak');
  assert.equal(critical.remainingDays, 0);
  assert.equal(critical.remainingHours, 12);

  // Test 5: EXPIRED (> 30 days)
  const upload32DaysAgo = new Date(ref.getTime() - 32 * 24 * 60 * 60 * 1000).toISOString();
  const expired = calculateVideoRetentionStatus(upload32DaysAgo, ref);
  assert.equal(expired.status, 'EXPIRED');
  assert.equal(expired.statusText, 'Masa retensi telah berakhir');
  assert.equal(expired.isExpired, true);

  // Test 6: UNKNOWN (empty or invalid)
  const unknown = calculateVideoRetentionStatus('', ref);
  assert.equal(unknown.hasValidDate, false);
  assert.equal(unknown.status, 'UNKNOWN');
  assert.equal(unknown.statusText, 'Tanggal upload belum tersedia');
});


