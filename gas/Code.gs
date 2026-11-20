/**
 * LOUIS BRIDES PILIH FOTO V1 — GOOGLE APPS SCRIPT BACKEND
 * Deploy sebagai Web App:
 * - Execute as: Me (Pemilik Studio / andre.louisbrides@gmail.com)
 * - Who has access: Anyone (akses divalidasi oleh kode unik customer & token admin di backend)
 */

var DEFAULT_ROOT_FOLDER_ID = '1qsd1Ozk8hHC97HyTNCTvq57ZTCx18AGF';
var SUBFOLDER_NAMES = ['ALL FILE', 'RINGKASAN', 'LIHAT EDITAN', 'REVISI', 'VIDEO'];

var SHEET_HEADERS = {
  PENGANTIN: [
    'id_customer',
    'kode_unik',
    'nama_customer',
    'nama_keluarga',
    'paket',
    'jenis_layanan',
    'email',
    'whatsapp',
    'nama_marketing',
    'tanggal_pendaftaran',
    'tanggal_pemotretan',
    'tanggal_pemilihan',
    'tanggal_mulai_kerja',
    'tanggal_cetak',
    'estimasi_selesai',
    'kuota_album',
    'kuota_kanvas',
    'ukuran_kanvas',
    'kuota_tambahan',
    'catatan_customer',
    'catatan_produksi',
    'drive_folder_id',
    'drive_folder_url',
    'subfolder_ids_json',
    'status_pekerjaan',
    'status_album',
    'status_kanvas',
    'jumlah_revisi',
    'izinkan_download',
    'created_at',
  ],
  KELUARGA: [
    'id_customer',
    'kode_unik',
    'nama_customer',
    'nama_keluarga',
    'paket',
    'jenis_layanan',
    'email',
    'whatsapp',
    'nama_marketing',
    'tanggal_pendaftaran',
    'tanggal_pemotretan',
    'tanggal_pemilihan',
    'tanggal_mulai_kerja',
    'tanggal_cetak',
    'estimasi_selesai',
    'kuota_album',
    'kuota_kanvas',
    'ukuran_kanvas',
    'kuota_tambahan',
    'catatan_customer',
    'catatan_produksi',
    'drive_folder_id',
    'drive_folder_url',
    'subfolder_ids_json',
    'status_pekerjaan',
    'status_album',
    'status_kanvas',
    'jumlah_revisi',
    'izinkan_download',
    'created_at',
  ],
  PILIHAN_FOTO: [
    'id_pilihan',
    'id_customer',
    'kode_unik',
    'nama_customer',
    'jumlah_album',
    'jumlah_kanvas',
    'jumlah_tambahan',
    'catatan_keseluruhan',
    'waktu_pengiriman',
    'estimasi_selesai',
    'status_pilihan',
  ],
  DETAIL_PILIHAN: [
    'id_detail',
    'id_pilihan',
    'id_customer',
    'kode_unik',
    'file_id',
    'file_name',
    'pilih_album',
    'pilih_kanvas',
    'pilih_tambahan',
    'tebus_file',
    'catatan_edit',
    'waktu_update',
  ],
  FEEDBACK: [
    'id_feedback',
    'id_customer',
    'kode_unik',
    'nama_customer',
    'jenis_feedback',
    'rating',
    'kategori_masukan',
    'catatan_umum',
    'revisi_ke',
    'detail_revisi_json',
    'waktu_kirim',
  ],
  PENGATURAN: ['key', 'value', 'updated_at'],
  MARKETING: ['id_marketing', 'nama', 'whatsapp', 'email', 'status'],
  LOG_AKTIVITAS: ['id_log', 'waktu', 'aktor', 'kode_unik', 'nama_customer', 'aksi', 'detail'],
};

function getSpreadsheet_(optionalSpreadsheetId) {
  var props = PropertiesService.getScriptProperties();
  var ssId = props.getProperty('SPREADSHEET_ID') || optionalSpreadsheetId;
  if (ssId) {
    if (!props.getProperty('SPREADSHEET_ID')) {
      props.setProperty('SPREADSHEET_ID', String(ssId).trim());
    }
    return SpreadsheetApp.openById(String(ssId).trim());
  }
  var active = SpreadsheetApp.getActiveSpreadsheet();
  if (active) {
    props.setProperty('SPREADSHEET_ID', active.getId());
    return active;
  }
  throw new Error('SPREADSHEET_ID belum dikonfigurasi pada Script Properties.');
}

function jsonResponse_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON
  );
}

/**
 * Aman dijalankan berulang kali tanpa menghapus atau menimpa data yang sudah ada.
 */
function initDatabase() {
  var ss = getSpreadsheet_();
  var sheetNames = Object.keys(SHEET_HEADERS);

  for (var i = 0; i < sheetNames.length; i++) {
    var name = sheetNames[i];
    var headers = SHEET_HEADERS[name];
    var sheet = ss.getSheetByName(name);
    if (!sheet) {
      sheet = ss.insertSheet(name);
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      sheet.setFrozenRows(1);
    } else if (sheet.getLastRow() === 0) {
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      sheet.setFrozenRows(1);
    }
  }

  return {
    ok: true,
    message: 'Database Google Sheets berhasil diinisialisasi tanpa menghapus data yang ada.',
    spreadsheet_id: ss.getId(),
    sheets: sheetNames,
  };
}

function sheetToObjects_(sheet) {
  if (!sheet || sheet.getLastRow() < 2) return [];
  var values = sheet.getDataRange().getValues();
  var headers = values[0];
  var rows = [];
  for (var r = 1; r < values.length; r++) {
    var row = values[r];
    if (!row[0] && !row[1]) continue;
    var obj = {};
    for (var c = 0; c < headers.length; c++) {
      obj[String(headers[c])] = row[c];
    }
    rows.push(obj);
  }
  return rows;
}

function appendObjectRow_(sheet, headers, obj) {
  var row = [];
  for (var i = 0; i < headers.length; i++) {
    var key = headers[i];
    row.push(obj[key] !== undefined && obj[key] !== null ? obj[key] : '');
  }
  sheet.appendRow(row);
}

function updateObjectRowByKey_(sheet, headers, keyCol, keyVal, updates) {
  var values = sheet.getDataRange().getValues();
  var keyIdx = headers.indexOf(keyCol);
  if (keyIdx === -1) return false;

  for (var r = 1; r < values.length; r++) {
    if (String(values[r][keyIdx]).trim() === String(keyVal).trim()) {
      for (var k in updates) {
        var colIdx = headers.indexOf(k);
        if (colIdx !== -1 && updates[k] !== undefined) {
          sheet.getRange(r + 1, colIdx + 1).setValue(updates[k]);
        }
      }
      return true;
    }
  }
  return false;
}

function deleteRowByKey_(sheet, headers, keyCol, keyVal) {
  var values = sheet.getDataRange().getValues();
  var keyIdx = headers.indexOf(keyCol);
  if (keyIdx === -1) return false;

  for (var r = values.length - 1; r >= 1; r--) {
    if (String(values[r][keyIdx]).trim() === String(keyVal).trim()) {
      sheet.deleteRow(r + 1);
      return true;
    }
  }
  return false;
}

function logActivity_(ss, aktor, kodeUnik, namaCustomer, aksi, detail) {
  var sheet = ss.getSheetByName('LOG_AKTIVITAS');
  if (!sheet) return;
  appendObjectRow_(sheet, SHEET_HEADERS.LOG_AKTIVITAS, {
    id_log: 'LOG-' + Utilities.getUuid().slice(0, 8).toUpperCase(),
    waktu: new Date().toISOString(),
    aktor: aktor,
    kode_unik: kodeUnik || '',
    nama_customer: namaCustomer || '',
    aksi: aksi,
    detail: detail,
  });
}

function normalizeCustomerRow_(raw) {
  var subfolders = {};
  try {
    if (raw.subfolder_ids_json) {
      subfolders = JSON.parse(raw.subfolder_ids_json);
    }
  } catch (e) {
    subfolders = {};
  }
  return {
    id_customer: String(raw.id_customer || ''),
    kode_unik: String(raw.kode_unik || '').trim().toUpperCase(),
    nama_customer: String(raw.nama_customer || ''),
    nama_keluarga: String(raw.nama_keluarga || ''),
    paket: String(raw.paket || ''),
    jenis_layanan: String(raw.jenis_layanan || 'PREWEDING'),
    email: String(raw.email || ''),
    whatsapp: String(raw.whatsapp || ''),
    nama_marketing: String(raw.nama_marketing || ''),
    tanggal_pendaftaran: String(raw.tanggal_pendaftaran || ''),
    tanggal_pemotretan: String(raw.tanggal_pemotretan || ''),
    tanggal_pemilihan: String(raw.tanggal_pemilihan || ''),
    tanggal_mulai_kerja: String(raw.tanggal_mulai_kerja || ''),
    tanggal_cetak: String(raw.tanggal_cetak || ''),
    estimasi_selesai: String(raw.estimasi_selesai || ''),
    kuota_album: Number(raw.kuota_album || 0),
    kuota_kanvas: Number(raw.kuota_kanvas || 0),
    ukuran_kanvas: String(raw.ukuran_kanvas || '60x90 cm'),
    kuota_tambahan: Number(raw.kuota_tambahan || 0),
    catatan_customer: String(raw.catatan_customer || ''),
    catatan_produksi: String(raw.catatan_produksi || ''),
    drive_folder_id: String(raw.drive_folder_id || ''),
    drive_folder_url: String(raw.drive_folder_url || ''),
    subfolder_ids: subfolders,
    status_pekerjaan: String(raw.status_pekerjaan || 'BELUM_MEMILIH'),
    status_album: String(raw.status_album || 'DALAM ANTREAN'),
    status_kanvas: String(raw.status_kanvas || 'DALAM ANTREAN'),
    jumlah_revisi: Number(raw.jumlah_revisi || 0),
    izinkan_download: raw.izinkan_download === false || raw.izinkan_download === 'FALSE' ? false : true,
    created_at: String(raw.created_at || new Date().toISOString()),
  };
}

function findCustomerByCodeInternal_(ss, code) {
  var target = String(code || '').trim().toUpperCase();
  if (!target) return null;

  var tabs = ['PENGANTIN', 'KELUARGA'];
  for (var t = 0; t < tabs.length; t++) {
    var sheet = ss.getSheetByName(tabs[t]);
    var rows = sheetToObjects_(sheet);
    for (var i = 0; i < rows.length; i++) {
      if (String(rows[i].kode_unik || '').trim().toUpperCase() === target) {
        return {
          tab: tabs[t],
          customer: normalizeCustomerRow_(rows[i]),
        };
      }
    }
  }
  return null;
}

function getCustomerByCode(code) {
  var ss = getSpreadsheet_();
  var found = findCustomerByCodeInternal_(ss, code);
  if (!found) {
    return { ok: false, error: 'Kode unik customer tidak ditemukan.' };
  }
  return { ok: true, customer: found.customer };
}

function getOrCreateChildFolder_(parentFolder, folderName) {
  var existing = parentFolder.getFoldersByName(folderName);
  if (existing.hasNext()) {
    return existing.next();
  }
  return parentFolder.createFolder(folderName);
}

function ensureCustomerDriveFolders_(rootFolderId, customerName) {
  var folderId = rootFolderId || DEFAULT_ROOT_FOLDER_ID;
  var rootFolder = DriveApp.getFolderById(folderId);
  var clientFolder = getOrCreateChildFolder_(rootFolder, customerName);

  // Pastikan folder dapat diakses oleh link portal tanpa login Google
  try {
    clientFolder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  } catch (err) {
    // Abaikan jika kebijakan domain membatasi setSharing
  }

  var subfolderMap = {};
  for (var i = 0; i < SUBFOLDER_NAMES.length; i++) {
    var subName = SUBFOLDER_NAMES[i];
    var sub = getOrCreateChildFolder_(clientFolder, subName);
    try {
      sub.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    } catch (err2) {}
    subfolderMap[subName] = {
      id: sub.getId(),
      url: sub.getUrl(),
    };
  }

  return {
    drive_folder_id: clientFolder.getId(),
    drive_folder_url: clientFolder.getUrl(),
    subfolder_ids: subfolderMap,
  };
}

function getCustomerFolderPhotos(code) {
  var ss = getSpreadsheet_();
  var found = findCustomerByCodeInternal_(ss, code);
  if (!found) {
    return { ok: false, error: 'Customer tidak ditemukan.' };
  }
  var customer = found.customer;
  var subfolderIds = customer.subfolder_ids || {};

  // Jika subfolder_ids belum lengkap tetapi drive_folder_id tersedia, baca langsung dari Drive
  if (customer.drive_folder_id && Object.keys(subfolderIds).length === 0) {
    try {
      var parent = DriveApp.getFolderById(customer.drive_folder_id);
      var subs = parent.getFolders();
      while (subs.hasNext()) {
        var f = subs.next();
        var upperName = f.getName().trim().toUpperCase();
        if (SUBFOLDER_NAMES.indexOf(upperName) !== -1) {
          subfolderIds[upperName] = { id: f.getId(), url: f.getUrl() };
        }
      }
    } catch (e) {}
  }

  var allMedia = [];
  for (var i = 0; i < SUBFOLDER_NAMES.length; i++) {
    var category = SUBFOLDER_NAMES[i];
    var subInfo = subfolderIds[category];
    if (!subInfo || !subInfo.id) continue;

    try {
      var folder = DriveApp.getFolderById(subInfo.id);
      var files = folder.getFiles();
      while (files.hasNext()) {
        var file = files.next();
        var mime = file.getMimeType() || '';
        if (
          mime.indexOf('image/') !== 0 &&
          mime.indexOf('video/') !== 0
        ) {
          continue;
        }
        var fileId = file.getId();
        allMedia.push({
          id: fileId,
          name: file.getName(),
          category: category,
          mimeType: mime,
          sizeBytes: file.getSize(),
          createdTime: file.getDateCreated().toISOString(),
          thumbnailUrl: 'https://drive.google.com/thumbnail?id=' + fileId + '&sz=w800',
          previewUrl: 'https://drive.google.com/thumbnail?id=' + fileId + '&sz=w1600',
          downloadUrl: 'https://drive.google.com/uc?export=download&id=' + fileId,
        });
      }
    } catch (err) {
      // Lanjutkan kategori lain jika satu subfolder gagal dibaca
    }
  }

  allMedia.sort(function (a, b) {
    return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
  });

  return {
    ok: true,
    kode_unik: customer.kode_unik,
    media: allMedia,
  };
}

function getCustomerSelections(code) {
  var ss = getSpreadsheet_();
  var found = findCustomerByCodeInternal_(ss, code);
  if (!found) {
    return { ok: false, error: 'Customer tidak ditemukan.' };
  }
  var targetCode = found.customer.kode_unik;

  var submissionsRaw = sheetToObjects_(ss.getSheetByName('PILIHAN_FOTO'));
  var detailsRaw = sheetToObjects_(ss.getSheetByName('DETAIL_PILIHAN'));
  var feedbacksRaw = sheetToObjects_(ss.getSheetByName('FEEDBACK'));

  var customerDetails = detailsRaw
    .filter(function (d) {
      return String(d.kode_unik || '').trim().toUpperCase() === targetCode;
    })
    .map(function (d) {
      return {
        file_id: String(d.file_id || ''),
        file_name: String(d.file_name || ''),
        pilih_album: d.pilih_album === true || d.pilih_album === 'TRUE',
        pilih_kanvas: d.pilih_kanvas === true || d.pilih_kanvas === 'TRUE',
        pilih_tambahan: d.pilih_tambahan === true || d.pilih_tambahan === 'TRUE',
        tebus_file: String(d.tebus_file || 'TIDAK_TEBUS'),
        catatan_edit: String(d.catatan_edit || ''),
      };
    });

  var customerSubmissions = submissionsRaw
    .filter(function (s) {
      return String(s.kode_unik || '').trim().toUpperCase() === targetCode;
    })
    .map(function (s) {
      return {
        id_pilihan: String(s.id_pilihan || ''),
        id_customer: String(s.id_customer || ''),
        kode_unik: targetCode,
        nama_customer: String(s.nama_customer || ''),
        jumlah_album: Number(s.jumlah_album || 0),
        jumlah_kanvas: Number(s.jumlah_kanvas || 0),
        jumlah_tambahan: Number(s.jumlah_tambahan || 0),
        catatan_keseluruhan: String(s.catatan_keseluruhan || ''),
        waktu_pengiriman: String(s.waktu_pengiriman || ''),
        estimasi_selesai: String(s.estimasi_selesai || ''),
        items: customerDetails,
      };
    });

  var customerFeedbacks = feedbacksRaw
    .filter(function (f) {
      return String(f.kode_unik || '').trim().toUpperCase() === targetCode;
    })
    .map(function (f) {
      var parsedDetail = [];
      try {
        if (f.detail_revisi_json) parsedDetail = JSON.parse(f.detail_revisi_json);
      } catch (e) {}
      return {
        id_feedback: String(f.id_feedback || ''),
        id_customer: String(f.id_customer || ''),
        kode_unik: targetCode,
        nama_customer: String(f.nama_customer || ''),
        jenis_feedback: String(f.jenis_feedback || 'CRITIC_SUGGESTION'),
        rating: f.rating ? Number(f.rating) : undefined,
        kategori_masukan: String(f.kategori_masukan || ''),
        catatan_umum: String(f.catatan_umum || ''),
        revisi_ke: f.revisi_ke ? Number(f.revisi_ke) : undefined,
        detail_revisi: parsedDetail,
        waktu_kirim: String(f.waktu_kirim || ''),
      };
    });

  return {
    ok: true,
    selections: customerDetails,
    submissions: customerSubmissions,
    feedbacks: customerFeedbacks,
  };
}

function addCalendarMonthsIso_(isoDateStr, months) {
  var parts = String(isoDateStr || '').slice(0, 10).split('-');
  var y = parseInt(parts[0], 10) || new Date().getFullYear();
  var m = (parseInt(parts[1], 10) || new Date().getMonth() + 1) - 1 + months;
  var d = parseInt(parts[2], 10) || new Date().getDate();
  var targetY = y + Math.floor(m / 12);
  var targetM = ((m % 12) + 12) % 12;
  var maxDay = new Date(Date.UTC(targetY, targetM + 1, 0)).getUTCDate();
  var clampedD = Math.min(d, maxDay);
  return (
    targetY +
    '-' +
    ('0' + (targetM + 1)).slice(-2) +
    '-' +
    ('0' + clampedD).slice(-2)
  );
}

function handlePhotoSelectionSubmit(payload) {
  var ss = getSpreadsheet_();
  initDatabase();
  var found = findCustomerByCodeInternal_(ss, payload.kode_unik);
  if (!found) {
    return { ok: false, error: 'Kode customer tidak valid.' };
  }
  var customer = found.customer;
  var items = payload.items || [];

  var albumCount = 0;
  var kanvasCount = 0;
  var tambahanCount = 0;
  for (var i = 0; i < items.length; i++) {
    if (items[i].pilih_album && items[i].pilih_tambahan) {
      items[i].pilih_tambahan = false;
    }
    if (items[i].pilih_album) albumCount++;
    if (items[i].pilih_kanvas) kanvasCount++;
    if (items[i].pilih_tambahan) tambahanCount++;
  }

  if (albumCount > customer.kuota_album) {
    return {
      ok: false,
      error: 'Jumlah foto Album (' + albumCount + ') melebihi kuota (' + customer.kuota_album + ').',
    };
  }
  if (kanvasCount > customer.kuota_kanvas) {
    return {
      ok: false,
      error: 'Jumlah foto Kanvas (' + kanvasCount + ') melebihi kuota (' + customer.kuota_kanvas + ').',
    };
  }

  var nowIso = new Date().toISOString();
  var todayStr = nowIso.slice(0, 10);
  var estimasiSelesai = addCalendarMonthsIso_(todayStr, 2);
  var idPilihan = 'PIL-' + Utilities.getUuid().slice(0, 8).toUpperCase();

  var pilihanSheet = ss.getSheetByName('PILIHAN_FOTO');
  appendObjectRow_(pilihanSheet, SHEET_HEADERS.PILIHAN_FOTO, {
    id_pilihan: idPilihan,
    id_customer: customer.id_customer,
    kode_unik: customer.kode_unik,
    nama_customer: customer.nama_customer,
    jumlah_album: albumCount,
    jumlah_kanvas: kanvasCount,
    jumlah_tambahan: tambahanCount,
    catatan_keseluruhan: payload.catatan_keseluruhan || '',
    waktu_pengiriman: nowIso,
    estimasi_selesai: estimasiSelesai,
    status_pilihan: 'TERKIRIM',
  });

  // Ganti detail pilihan lama milik customer ini agar tidak duplikat
  var detailSheet = ss.getSheetByName('DETAIL_PILIHAN');
  var existingDetails = detailSheet.getDataRange().getValues();
  var codeColIdx = SHEET_HEADERS.DETAIL_PILIHAN.indexOf('kode_unik');
  for (var r = existingDetails.length - 1; r >= 1; r--) {
    if (String(existingDetails[r][codeColIdx]).trim().toUpperCase() === customer.kode_unik) {
      detailSheet.deleteRow(r + 1);
    }
  }

  for (var j = 0; j < items.length; j++) {
    var it = items[j];
    if (!it.pilih_album && !it.pilih_kanvas && !it.pilih_tambahan && !it.catatan_edit) continue;
    appendObjectRow_(detailSheet, SHEET_HEADERS.DETAIL_PILIHAN, {
      id_detail: 'DTL-' + Utilities.getUuid().slice(0, 8).toUpperCase(),
      id_pilihan: idPilihan,
      id_customer: customer.id_customer,
      kode_unik: customer.kode_unik,
      file_id: it.file_id,
      file_name: it.file_name,
      pilih_album: Boolean(it.pilih_album),
      pilih_kanvas: Boolean(it.pilih_kanvas),
      pilih_tambahan: Boolean(it.pilih_tambahan),
      tebus_file: it.tebus_file || 'TIDAK_TEBUS',
      catatan_edit: it.catatan_edit || '',
      waktu_update: nowIso,
    });
  }

  var custSheet = ss.getSheetByName(found.tab);
  updateObjectRowByKey_(custSheet, SHEET_HEADERS[found.tab], 'kode_unik', customer.kode_unik, {
    tanggal_pemilihan: todayStr,
    estimasi_selesai: estimasiSelesai,
    status_pekerjaan: 'SUDAH_KIRIM_PILIHAN',
    status_album: albumCount > 0 ? 'SEDANG DIPROSES' : customer.status_album,
    status_kanvas: kanvasCount > 0 ? 'SEDANG DIPROSES' : customer.status_kanvas,
  });

  logActivity_(
    ss,
    'CUSTOMER',
    customer.kode_unik,
    customer.nama_customer,
    'KIRIM_PILIHAN_FOTO',
    'Album: ' + albumCount + ', Kanvas: ' + kanvasCount + ', Tambahan: ' + tambahanCount + ', Estimasi: ' + estimasiSelesai
  );

  return {
    ok: true,
    id_pilihan: idPilihan,
    estimasi_selesai: estimasiSelesai,
    waktu_pengiriman: nowIso,
  };
}

function handleFeedbackSubmit(payload) {
  var ss = getSpreadsheet_();
  initDatabase();
  var found = findCustomerByCodeInternal_(ss, payload.kode_unik);
  if (!found) {
    return { ok: false, error: 'Customer tidak ditemukan.' };
  }
  var customer = found.customer;
  var jenis = payload.jenis_feedback || 'CRITIC_SUGGESTION';
  var nowIso = new Date().toISOString();
  var custSheet = ss.getSheetByName(found.tab);

  var revisiKe = customer.jumlah_revisi;
  if (jenis === 'REVISION_REQUEST') {
    var maxRev = Number(payload.batas_revisi || 2);
    if (customer.jumlah_revisi >= maxRev) {
      return {
        ok: false,
        error: 'Batas maksimal pengajuan revisi (' + maxRev + ' kali) telah tercapai.',
      };
    }
    revisiKe = customer.jumlah_revisi + 1;
    updateObjectRowByKey_(custSheet, SHEET_HEADERS[found.tab], 'kode_unik', customer.kode_unik, {
      jumlah_revisi: revisiKe,
      status_pekerjaan: 'BUTUH_REVISI',
      status_album: customer.status_album !== 'TIDAK PAKAI' ? 'SEDANG DIPROSES' : 'TIDAK PAKAI',
    });
  } else if (jenis === 'EDIT_APPROVAL') {
    updateObjectRowByKey_(custSheet, SHEET_HEADERS[found.tab], 'kode_unik', customer.kode_unik, {
      status_pekerjaan: 'PROSES_CETAK',
      status_album: customer.status_album !== 'TIDAK PAKAI' ? 'PROSES CETAK' : 'TIDAK PAKAI',
      status_kanvas: customer.status_kanvas !== 'TIDAK PAKAI' ? 'PROSES CETAK' : 'TIDAK PAKAI',
    });
  }

  var idFeedback = 'FDB-' + Utilities.getUuid().slice(0, 8).toUpperCase();
  var fbSheet = ss.getSheetByName('FEEDBACK');
  appendObjectRow_(fbSheet, SHEET_HEADERS.FEEDBACK, {
    id_feedback: idFeedback,
    id_customer: customer.id_customer,
    kode_unik: customer.kode_unik,
    nama_customer: customer.nama_customer,
    jenis_feedback: jenis,
    rating: payload.rating || '',
    kategori_masukan: payload.kategori_masukan || '',
    catatan_umum: payload.catatan_umum || '',
    revisi_ke: jenis === 'REVISION_REQUEST' ? revisiKe : '',
    detail_revisi_json: payload.detail_revisi ? JSON.stringify(payload.detail_revisi) : '',
    waktu_kirim: nowIso,
  });

  logActivity_(
    ss,
    'CUSTOMER',
    customer.kode_unik,
    customer.nama_customer,
    jenis,
    payload.catatan_umum || 'Customer mengirimkan konfirmasi.'
  );

  return {
    ok: true,
    id_feedback: idFeedback,
    revisi_ke: revisiKe,
    waktu_kirim: nowIso,
  };
}

function handleAddCustomer(payload) {
  var ss = getSpreadsheet_();
  initDatabase();
  var layanan = String(payload.jenis_layanan || 'PREWEDING').toUpperCase();
  var targetTab = layanan === 'KELUARGA' ? 'KELUARGA' : 'PENGANTIN';
  var sheet = ss.getSheetByName(targetTab);

  var kodeUnik = String(payload.kode_unik || '').trim().toUpperCase();
  if (!kodeUnik) {
    kodeUnik = 'LB-' + Utilities.getUuid().replace(/-/g, '').slice(0, 5).toUpperCase();
  }

  var existing = findCustomerByCodeInternal_(ss, kodeUnik);
  var folderInfo = {
    drive_folder_id: payload.drive_folder_id || '',
    drive_folder_url: payload.drive_folder_url || '',
    subfolder_ids: payload.subfolder_ids || {},
  };

  if (!folderInfo.drive_folder_id && payload.nama_customer) {
    try {
      folderInfo = ensureCustomerDriveFolders_(
        payload.drive_root_folder_id || DEFAULT_ROOT_FOLDER_ID,
        String(payload.nama_customer).trim()
      );
    } catch (driveErr) {
      // Tetap lanjut menyimpan customer meski folder Drive belum dapat diakses
    }
  }

  var record = {
    id_customer: payload.id_customer || 'CUST-' + Utilities.getUuid().slice(0, 8).toUpperCase(),
    kode_unik: kodeUnik,
    nama_customer: payload.nama_customer || '',
    nama_keluarga: payload.nama_keluarga || '',
    paket: payload.paket || '',
    jenis_layanan: layanan,
    email: payload.email || '',
    whatsapp: payload.whatsapp || '',
    nama_marketing: payload.nama_marketing || '',
    tanggal_pendaftaran: payload.tanggal_pendaftaran || new Date().toISOString().slice(0, 10),
    tanggal_pemotretan: payload.tanggal_pemotretan || '',
    tanggal_pemilihan: payload.tanggal_pemilihan || '',
    tanggal_mulai_kerja: payload.tanggal_mulai_kerja || '',
    tanggal_cetak: payload.tanggal_cetak || '',
    estimasi_selesai: payload.estimasi_selesai || '',
    kuota_album: Number(payload.kuota_album || 20),
    kuota_kanvas: Number(payload.kuota_kanvas || 1),
    ukuran_kanvas: payload.ukuran_kanvas || '60x90 cm',
    kuota_tambahan: Number(payload.kuota_tambahan || 0),
    catatan_customer: payload.catatan_customer || '',
    catatan_produksi: payload.catatan_produksi || '',
    drive_folder_id: folderInfo.drive_folder_id,
    drive_folder_url: folderInfo.drive_folder_url,
    subfolder_ids_json: JSON.stringify(folderInfo.subfolder_ids || {}),
    status_pekerjaan: payload.status_pekerjaan || 'BELUM_MEMILIH',
    status_album: payload.status_album || 'DALAM ANTREAN',
    status_kanvas: payload.status_kanvas || 'DALAM ANTREAN',
    jumlah_revisi: Number(payload.jumlah_revisi || 0),
    izinkan_download: payload.izinkan_download === false ? false : true,
    created_at: payload.created_at || new Date().toISOString(),
  };

  if (existing) {
    if (existing.tab !== targetTab) {
      deleteRowByKey_(ss.getSheetByName(existing.tab), SHEET_HEADERS[existing.tab], 'kode_unik', kodeUnik);
      appendObjectRow_(sheet, SHEET_HEADERS[targetTab], record);
    } else {
      updateObjectRowByKey_(sheet, SHEET_HEADERS[targetTab], 'kode_unik', kodeUnik, record);
    }
    logActivity_(ss, 'ADMIN', kodeUnik, record.nama_customer, 'UPDATE_CUSTOMER', 'Data customer diperbarui.');
  } else {
    appendObjectRow_(sheet, SHEET_HEADERS[targetTab], record);
    logActivity_(ss, 'ADMIN', kodeUnik, record.nama_customer, 'TAMBAH_CUSTOMER', 'Customer baru ditambahkan & folder Drive dibuat.');
  }

  return {
    ok: true,
    customer: normalizeCustomerRow_(record),
  };
}

function handleDeleteCustomer(payload) {
  var ss = getSpreadsheet_();
  var found = findCustomerByCodeInternal_(ss, payload.kode_unik);
  if (!found) {
    return { ok: false, error: 'Customer tidak ditemukan.' };
  }
  var sheet = ss.getSheetByName(found.tab);
  deleteRowByKey_(sheet, SHEET_HEADERS[found.tab], 'kode_unik', found.customer.kode_unik);
  logActivity_(
    ss,
    'ADMIN',
    found.customer.kode_unik,
    found.customer.nama_customer,
    'HAPUS_CUSTOMER',
    'Data customer dihapus dari Sheets (file asli di Drive tetap aman).'
  );
  return { ok: true };
}

function handleUpdateCustomerStatus(payload) {
  var ss = getSpreadsheet_();
  var found = findCustomerByCodeInternal_(ss, payload.kode_unik);
  if (!found) {
    return { ok: false, error: 'Customer tidak ditemukan.' };
  }
  var updates = {};
  var fields = [
    'status_pekerjaan',
    'status_album',
    'status_kanvas',
    'tanggal_mulai_kerja',
    'tanggal_cetak',
    'estimasi_selesai',
    'catatan_produksi',
    'izinkan_download',
  ];
  for (var i = 0; i < fields.length; i++) {
    var f = fields[i];
    if (payload[f] !== undefined) updates[f] = payload[f];
  }

  var nextAlbum = updates.status_album || found.customer.status_album;
  var nextKanvas = updates.status_kanvas || found.customer.status_kanvas;
  if (
    (nextAlbum === 'SUDAH JADI' || nextAlbum === 'TIDAK PAKAI') &&
    (nextKanvas === 'SUDAH JADI' || nextKanvas === 'TIDAK PAKAI') &&
    (nextAlbum === 'SUDAH JADI' || nextKanvas === 'SUDAH JADI')
  ) {
    updates.status_pekerjaan = 'SELESAI';
  } else if (nextAlbum === 'LIHAT EDITAN' || nextKanvas === 'LIHAT EDITAN') {
    updates.status_pekerjaan = 'MENUNGGU_PERSETUJUAN';
  } else if (
    nextAlbum === 'PROSES CETAK' ||
    nextAlbum === 'CETAK' ||
    nextKanvas === 'PROSES CETAK' ||
    nextKanvas === 'CETAK'
  ) {
    updates.status_pekerjaan = 'PROSES_CETAK';
  }

  var sheet = ss.getSheetByName(found.tab);
  updateObjectRowByKey_(sheet, SHEET_HEADERS[found.tab], 'kode_unik', found.customer.kode_unik, updates);
  logActivity_(
    ss,
    'ADMIN',
    found.customer.kode_unik,
    found.customer.nama_customer,
    'UPDATE_STATUS_PRODUKSI',
    'Album: ' + nextAlbum + ', Kanvas: ' + nextKanvas
  );
  return { ok: true };
}

function getStudioSettingsInternal_(ss) {
  var settingsRows = sheetToObjects_(ss.getSheetByName('PENGATURAN'));
  var settings = {};
  for (var i = 0; i < settingsRows.length; i++) {
    if (settingsRows[i].key === 'STUDIO_CONFIG_JSON' && settingsRows[i].value) {
      try {
        settings = JSON.parse(settingsRows[i].value);
      } catch (e) {}
    }
  }
  return settings;
}

function getPublicConfig(params) {
  var ss = getSpreadsheet_(params && params.spreadsheet_id);
  initDatabase();
  var s = getStudioSettingsInternal_(ss);
  return {
    ok: true,
    studio: {
      nama_studio: s.nama_studio || 'LOUIS BRIDES',
      logo_url: s.logo_url || '',
      whatsapp_studio: s.whatsapp_studio || '6281122334455',
      zona_waktu: s.zona_waktu || 'Asia/Jakarta',
      batas_revisi: s.batas_revisi !== undefined ? Number(s.batas_revisi) : 2,
      izinkan_download_all_file: s.izinkan_download_all_file !== false,
      izinkan_download_ringkasan: s.izinkan_download_ringkasan !== false,
      izinkan_download_editan: s.izinkan_download_editan !== false,
      izinkan_download_revisi: s.izinkan_download_revisi !== false,
      izinkan_download_video: s.izinkan_download_video !== false,
    },
  };
}

function handleSaveDraftSelection(payload) {
  var code = String(payload.kode_unik || '').trim().toUpperCase();
  if (!code) return { ok: false, error: 'Kode unik wajib diisi.' };
  try {
    var cache = CacheService.getScriptCache();
    cache.put(
      'DRAFT_' + code,
      JSON.stringify({
        items: payload.items || [],
        overallNote: payload.catatan_keseluruhan || '',
        updatedAt: new Date().toISOString(),
      }),
      21600
    );
  } catch (e) {}
  return { ok: true };
}

function handleManageMarketing(payload) {
  var ss = getSpreadsheet_();
  initDatabase();
  var sheet = ss.getSheetByName('MARKETING');
  var op = String(payload.op || 'UPSERT').toUpperCase();

  if (op === 'DELETE') {
    var delId = String(payload.id_marketing || '').trim();
    if (delId) {
      deleteRowByKey_(sheet, SHEET_HEADERS.MARKETING, 'id_marketing', delId);
      logActivity_(ss, 'ADMIN', '', '', 'HAPUS_MARKETING', 'Menghapus kontak marketing (' + delId + ').');
    }
    return { ok: true, marketing: sheetToObjects_(sheet) };
  }

  var id = String(payload.id_marketing || '').trim() || 'MKT-' + Utilities.getUuid().slice(0, 6).toUpperCase();
  var record = {
    id_marketing: id,
    nama: String(payload.nama || '').trim(),
    whatsapp: String(payload.whatsapp || '').trim(),
    email: String(payload.email || '').trim(),
    status: String(payload.status || 'AKTIF') === 'NONAKTIF' ? 'NONAKTIF' : 'AKTIF',
  };
  if (!record.nama) {
    return { ok: false, error: 'Nama marketing wajib diisi.' };
  }

  var updated = updateObjectRowByKey_(sheet, SHEET_HEADERS.MARKETING, 'id_marketing', id, record);
  if (!updated) {
    appendObjectRow_(sheet, SHEET_HEADERS.MARKETING, record);
  }
  logActivity_(ss, 'ADMIN', '', '', 'SIMPAN_MARKETING', 'Menyimpan kontak marketing: ' + record.nama);
  return { ok: true, marketing: sheetToObjects_(sheet) };
}

function getAdminPinHashInternal_(ss) {
  var rows = sheetToObjects_(ss.getSheetByName('PENGATURAN'));
  for (var i = 0; i < rows.length; i++) {
    if (rows[i].key === 'ADMIN_PIN_HASH' && rows[i].value) {
      return String(rows[i].value).trim();
    }
  }
  return '';
}

function handleSaveAdminPinHash(payload) {
  var ss = getSpreadsheet_();
  initDatabase();
  var sheet = ss.getSheetByName('PENGATURAN');
  var hash = String(payload.admin_pin_hash || '').trim();
  if (!hash) return { ok: false, error: 'Hash PIN tidak valid.' };

  var nowIso = new Date().toISOString();
  var updated = updateObjectRowByKey_(sheet, SHEET_HEADERS.PENGATURAN, 'key', 'ADMIN_PIN_HASH', {
    value: hash,
    updated_at: nowIso,
  });
  if (!updated) {
    appendObjectRow_(sheet, SHEET_HEADERS.PENGATURAN, {
      key: 'ADMIN_PIN_HASH',
      value: hash,
      updated_at: nowIso,
    });
  }
  logActivity_(ss, 'ADMIN', '', '', 'UBAH_PIN_ADMIN', 'PIN keamanan admin diperbarui.');
  return { ok: true };
}

function handleSaveSettings(payload) {
  var ss = getSpreadsheet_();
  initDatabase();
  var sheet = ss.getSheetByName('PENGATURAN');
  var nowIso = new Date().toISOString();

  var props = PropertiesService.getScriptProperties();
  if (payload.spreadsheet_id) props.setProperty('SPREADSHEET_ID', payload.spreadsheet_id);
  if (payload.drive_root_folder_id) props.setProperty('DRIVE_ROOT_FOLDER_ID', payload.drive_root_folder_id);

  var jsonStr = JSON.stringify(payload);
  var existing = sheetToObjects_(sheet);
  var updated = false;
  for (var i = 0; i < existing.length; i++) {
    if (existing[i].key === 'STUDIO_CONFIG_JSON') {
      updateObjectRowByKey_(sheet, SHEET_HEADERS.PENGATURAN, 'key', 'STUDIO_CONFIG_JSON', {
        value: jsonStr,
        updated_at: nowIso,
      });
      updated = true;
      break;
    }
  }
  if (!updated) {
    appendObjectRow_(sheet, SHEET_HEADERS.PENGATURAN, {
      key: 'STUDIO_CONFIG_JSON',
      value: jsonStr,
      updated_at: nowIso,
    });
  }
  logActivity_(ss, 'ADMIN', '', '', 'SIMPAN_PENGATURAN', 'Konfigurasi studio disimpan.');
  return { ok: true };
}

function getAdminFullData() {
  var ss = getSpreadsheet_();
  initDatabase();

  var pengantin = sheetToObjects_(ss.getSheetByName('PENGANTIN')).map(normalizeCustomerRow_);
  var keluarga = sheetToObjects_(ss.getSheetByName('KELUARGA')).map(normalizeCustomerRow_);
  var customers = pengantin.concat(keluarga);

  var submissionsRaw = sheetToObjects_(ss.getSheetByName('PILIHAN_FOTO'));
  var detailsRaw = sheetToObjects_(ss.getSheetByName('DETAIL_PILIHAN'));
  var selections = submissionsRaw.map(function (s) {
    var code = String(s.kode_unik || '').trim().toUpperCase();
    var items = detailsRaw
      .filter(function (d) {
        return String(d.kode_unik || '').trim().toUpperCase() === code;
      })
      .map(function (d) {
        return {
          file_id: String(d.file_id || ''),
          file_name: String(d.file_name || ''),
          pilih_album: d.pilih_album === true || d.pilih_album === 'TRUE',
          pilih_kanvas: d.pilih_kanvas === true || d.pilih_kanvas === 'TRUE',
          pilih_tambahan: d.pilih_tambahan === true || d.pilih_tambahan === 'TRUE',
          tebus_file: String(d.tebus_file || 'TIDAK_TEBUS'),
          catatan_edit: String(d.catatan_edit || ''),
        };
      });
    return {
      id_pilihan: String(s.id_pilihan || ''),
      id_customer: String(s.id_customer || ''),
      kode_unik: code,
      nama_customer: String(s.nama_customer || ''),
      jumlah_album: Number(s.jumlah_album || 0),
      jumlah_kanvas: Number(s.jumlah_kanvas || 0),
      jumlah_tambahan: Number(s.jumlah_tambahan || 0),
      catatan_keseluruhan: String(s.catatan_keseluruhan || ''),
      waktu_pengiriman: String(s.waktu_pengiriman || ''),
      estimasi_selesai: String(s.estimasi_selesai || ''),
      items: items,
    };
  });

  var feedbacks = sheetToObjects_(ss.getSheetByName('FEEDBACK')).map(function (f) {
    var detailRev = [];
    try {
      if (f.detail_revisi_json) detailRev = JSON.parse(f.detail_revisi_json);
    } catch (e) {}
    return {
      id_feedback: String(f.id_feedback || ''),
      id_customer: String(f.id_customer || ''),
      kode_unik: String(f.kode_unik || ''),
      nama_customer: String(f.nama_customer || ''),
      jenis_feedback: String(f.jenis_feedback || 'CRITIC_SUGGESTION'),
      rating: f.rating ? Number(f.rating) : undefined,
      kategori_masukan: String(f.kategori_masukan || ''),
      catatan_umum: String(f.catatan_umum || ''),
      revisi_ke: f.revisi_ke ? Number(f.revisi_ke) : undefined,
      detail_revisi: detailRev,
      waktu_kirim: String(f.waktu_kirim || ''),
    };
  });

  var marketing = sheetToObjects_(ss.getSheetByName('MARKETING'));
  var logs = sheetToObjects_(ss.getSheetByName('LOG_AKTIVITAS')).reverse().slice(0, 200);
  var settings = getStudioSettingsInternal_(ss);

  return {
    ok: true,
    customers: customers,
    selections: selections,
    feedbacks: feedbacks,
    marketing: marketing,
    logs: logs,
    settings: settings,
  };
}

function testSystemConnections(params) {
  var result = {
    ok: true,
    gas_status: 'TERHUBUNG',
    sheets_status: 'BELUM DIKONFIGURASI',
    sheets_message: '',
    drive_status: 'BELUM DIKONFIGURASI',
    drive_message: '',
  };

  try {
    var ss = getSpreadsheet_(params && params.spreadsheet_id);
    result.sheets_status = 'TERHUBUNG';
    result.sheets_message = 'Spreadsheet "' + ss.getName() + '" siap (' + ss.getId() + ').';
  } catch (e) {
    result.sheets_status = 'GAGAL TERHUBUNG';
    result.sheets_message = e.message;
  }

  var rootId = (params && params.drive_root_folder_id) || DEFAULT_ROOT_FOLDER_ID;
  if (!rootId) {
    result.drive_status = 'BELUM DIKONFIGURASI';
    result.drive_message = 'Drive Root Folder ID belum diisi.';
  } else {
    try {
      var folder = DriveApp.getFolderById(rootId);
      result.drive_status = 'TERHUBUNG';
      result.drive_message = 'Folder induk "' + folder.getName() + '" terhubung.';
    } catch (e2) {
      result.drive_status = 'GAGAL TERHUBUNG';
      result.drive_message = 'Gagal mengakses folder ID ' + rootId + ': ' + e2.message;
    }
  }

  return result;
}

function doGet(e) {
  try {
    var params = (e && e.parameter) || {};
    var action = params.action || 'ping';

    if (action === 'initDatabase') return jsonResponse_(initDatabase());
    if (action === 'testSystemConnections') return jsonResponse_(testSystemConnections(params));
    if (action === 'getPublicConfig') return jsonResponse_(getPublicConfig(params));
    if (action === 'getAdminPinHash') {
      var ss = getSpreadsheet_(params.spreadsheet_id);
      return jsonResponse_({ ok: true, admin_pin_hash: getAdminPinHashInternal_(ss) });
    }
    if (action === 'getCustomerByCode') return jsonResponse_(getCustomerByCode(params.code));
    if (action === 'getCustomerFolderPhotos') return jsonResponse_(getCustomerFolderPhotos(params.code));
    if (action === 'getCustomerSelections') {
      var selRes = getCustomerSelections(params.code);
      if (selRes.ok) {
        try {
          var cachedRaw = CacheService.getScriptCache().get('DRAFT_' + String(params.code || '').trim().toUpperCase());
          if (cachedRaw) {
            var parsedDraft = JSON.parse(cachedRaw);
            selRes.draftSelections = parsedDraft.items || [];
            selRes.draftOverallNote = parsedDraft.overallNote || '';
          }
        } catch (ce) {}
      }
      return jsonResponse_(selRes);
    }
    if (action === 'getAdminFullData') return jsonResponse_(getAdminFullData());

    if (action === 'getFileBase64' && params.fileId) {
      var file = DriveApp.getFileById(params.fileId);
      var blob = file.getBlob();
      return jsonResponse_({
        ok: true,
        name: file.getName(),
        mimeType: blob.getContentType(),
        base64: Utilities.base64Encode(blob.getBytes()),
      });
    }

    return jsonResponse_({ ok: true, service: 'LOUIS BRIDES GAS API' });
  } catch (err) {
    return jsonResponse_({ ok: false, error: err.message });
  }
}

function doPost(e) {
  try {
    var raw = e && e.postData && e.postData.contents ? e.postData.contents : '{}';
    var payload = JSON.parse(raw);
    var action = payload.action || '';

    if (action === 'initDatabase') return jsonResponse_(initDatabase());
    if (action === 'handlePhotoSelectionSubmit') {
      var submitRes = handlePhotoSelectionSubmit(payload);
      if (submitRes.ok && payload.kode_unik) {
        try {
          CacheService.getScriptCache().remove('DRAFT_' + String(payload.kode_unik).trim().toUpperCase());
        } catch (ce) {}
      }
      return jsonResponse_(submitRes);
    }
    if (action === 'handleSaveDraftSelection') return jsonResponse_(handleSaveDraftSelection(payload));
    if (action === 'handleFeedbackSubmit') return jsonResponse_(handleFeedbackSubmit(payload));
    if (action === 'handleAddCustomer') return jsonResponse_(handleAddCustomer(payload));
    if (action === 'handleDeleteCustomer') return jsonResponse_(handleDeleteCustomer(payload));
    if (action === 'handleUpdateCustomerStatus') return jsonResponse_(handleUpdateCustomerStatus(payload));
    if (action === 'handleSaveSettings') return jsonResponse_(handleSaveSettings(payload));
    if (action === 'handleManageMarketing') return jsonResponse_(handleManageMarketing(payload));
    if (action === 'handleSaveAdminPinHash') return jsonResponse_(handleSaveAdminPinHash(payload));

    return jsonResponse_({ ok: false, error: 'Aksi POST tidak dikenali: ' + action });
  } catch (err) {
    return jsonResponse_({ ok: false, error: err.message });
  }
}
