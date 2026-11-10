import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowUpDown,
  BarChart3,
  Check,
  ClipboardList,
  Copy,
  Download,
  Edit3,
  ExternalLink,
  Eye,
  FileSpreadsheet,
  FolderOpen,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageCircle,
  Plus,
  Printer,
  Search,
  Settings,
  Trash2,
  Users,
  UsersRound,
  X,
} from 'lucide-react';
import type {
  AdminFullDataPayload,
  CustomerRecord,
  ProductionItemStatus,
  ServiceCategory,
} from '../types/studio';
import {
  deleteCustomerRecord,
  fetchAdminFullData,
  logoutAdmin,
  saveCustomerRecord,
  updateCustomerProductionStatus,
} from '../utils/apiClient';
import {
  buildCustomersCsv,
  buildCustomerPortalUrl,
  formatDateDDMMYYYY,
  isCustomerApproachingDeadline,
  isCustomerJobOverdue,
  PRODUCTION_STATUS_LIST,
} from '../utils/studioLogic';
import { AdminSettingsView } from './AdminSettingsView';
import { BrandMark } from './BrandMark';
import { CustomerDetailModal } from './CustomerDetailModal';
import { CustomerFormModal } from './CustomerFormModal';
import { WhatsAppModal } from './WhatsAppModal';

type AdminNavTab =
  | 'DASHBOARD'
  | 'PENGANTIN'
  | 'KELUARGA'
  | 'MONITORING'
  | 'PEKERJAAN_CETAK'
  | 'LAPORAN'
  | 'PENGATURAN';

type DashboardDrillFilter =
  | 'ALL'
  | 'PENGANTIN'
  | 'KELUARGA'
  | 'BELUM_MEMILIH'
  | 'SUDAH_KIRIM_PILIHAN'
  | 'MENUNGGU_PERSETUJUAN'
  | 'BUTUH_REVISI'
  | 'ALBUM_PROSES'
  | 'KANVAS_PROSES'
  | 'CETAK'
  | 'TERLAMBAT'
  | 'SELESAI';

interface AdminDashboardProps {
  onLogout: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ onLogout }) => {
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [data, setData] = useState<AdminFullDataPayload | null>(null);

  const [activeTab, setActiveTab] = useState<AdminNavTab>('DASHBOARD');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Dashboard & Table Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [serviceFilter, setServiceFilter] = useState<'ALL' | ServiceCategory>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [dateFilter, setDateFilter] = useState('');
  const [drillFilter, setDrillFilter] = useState<DashboardDrillFilter>('ALL');
  const [sortField, setSortField] = useState<'nama' | 'pemotretan' | 'estimasi'>('pemotretan');
  const [sortAsc, setSortAsc] = useState(false);

  // Print Production Sub-tab & Filter
  const [printCategoryTab, setPrintCategoryTab] = useState<
    'ALBUM_PREWEDDING' | 'ALBUM_LIPUTAN' | 'KANVAS' | 'TAMBAHAN'
  >('ALBUM_PREWEDDING');
  const [printStatusFilter, setPrintStatusFilter] = useState<string>('ALL');

  // Report Period Filter
  const [reportPeriod, setReportPeriod] = useState<
    'HARIAN' | 'MINGGUAN' | 'BULANAN' | 'TAHUNAN' | 'RENTANG'
  >('BULANAN');
  const [reportStartDate, setReportStartDate] = useState('');
  const [reportEndDate, setReportEndDate] = useState('');

  // Modals
  const [formModalOpen, setFormModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<CustomerRecord | null>(null);
  const [formDefaultCat, setFormDefaultCat] = useState<ServiceCategory>('PREWEDING');
  const [detailCustomerCode, setDetailCustomerCode] = useState<string | null>(null);
  const [waCustomer, setWaCustomer] = useState<CustomerRecord | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CustomerRecord | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const res = await fetchAdminFullData();
      setData({
        customers: res.customers || [],
        selections: res.selections || [],
        feedbacks: res.feedbacks || [],
        marketing: res.marketing || [],
        logs: res.logs || [],
        settings: res.settings,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Gagal memuat data admin.';
      setErrorMsg(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const customers = data?.customers || [];
  const selections = data?.selections || [];
  const feedbacks = data?.feedbacks || [];
  const marketing = data?.marketing || [];
  const logs = data?.logs || [];
  const settings = data?.settings;

  const existingCodes = useMemo(
    () => new Set(customers.map((c) => c.kode_unik.toUpperCase())),
    [customers]
  );

  const todayIso = new Date().toISOString().slice(0, 10);

  // 11 Dashboard Summary Statistics (Section 4)
  const kpiStats = useMemo(() => {
    const pengantin = customers.filter(
      (c) => c.jenis_layanan === 'PREWEDING' || c.jenis_layanan === 'LIPUTAN'
    );
    const keluarga = customers.filter((c) => c.jenis_layanan === 'KELUARGA');
    const belumMemilih = customers.filter(
      (c) => c.status_pekerjaan === 'BELUM_MEMILIH'
    );
    const sudahKirimPilihan = customers.filter(
      (c) => c.status_pekerjaan === 'SUDAH_KIRIM_PILIHAN'
    );
    const menungguPersetujuan = customers.filter(
      (c) =>
        c.status_pekerjaan === 'MENUNGGU_PERSETUJUAN' ||
        c.status_album === 'LIHAT EDITAN'
    );
    const butuhRevisi = customers.filter(
      (c) => c.status_pekerjaan === 'BUTUH_REVISI'
    );
    const albumDikerjakan = customers.filter(
      (c) =>
        c.status_album === 'SEDANG DIPROSES' ||
        c.status_album === 'LIHAT EDITAN'
    );
    const kanvasDikerjakan = customers.filter(
      (c) =>
        c.status_kanvas === 'SEDANG DIPROSES' ||
        c.status_kanvas === 'LIHAT EDITAN'
    );
    const pekerjaanCetak = customers.filter(
      (c) =>
        c.status_album === 'PROSES CETAK' ||
        c.status_album === 'CETAK' ||
        c.status_kanvas === 'PROSES CETAK' ||
        c.status_kanvas === 'CETAK'
    );
    const terlambat = customers.filter((c) => isCustomerJobOverdue(c, todayIso));
    const selesai = customers.filter((c) => c.status_pekerjaan === 'SELESAI');

    return {
      pengantin: pengantin.length,
      keluarga: keluarga.length,
      belumMemilih: belumMemilih.length,
      sudahKirimPilihan: sudahKirimPilihan.length,
      menungguPersetujuan: menungguPersetujuan.length,
      butuhRevisi: butuhRevisi.length,
      albumDikerjakan: albumDikerjakan.length,
      kanvasDikerjakan: kanvasDikerjakan.length,
      pekerjaanCetak: pekerjaanCetak.length,
      terlambat: terlambat.length,
      selesai: selesai.length,
    };
  }, [customers, todayIso]);

  const matchesDrillFilter = useCallback(
    (c: CustomerRecord, filter: DashboardDrillFilter): boolean => {
      switch (filter) {
        case 'PENGANTIN':
          return c.jenis_layanan === 'PREWEDING' || c.jenis_layanan === 'LIPUTAN';
        case 'KELUARGA':
          return c.jenis_layanan === 'KELUARGA';
        case 'BELUM_MEMILIH':
          return c.status_pekerjaan === 'BELUM_MEMILIH';
        case 'SUDAH_KIRIM_PILIHAN':
          return c.status_pekerjaan === 'SUDAH_KIRIM_PILIHAN';
        case 'MENUNGGU_PERSETUJUAN':
          return (
            c.status_pekerjaan === 'MENUNGGU_PERSETUJUAN' ||
            c.status_album === 'LIHAT EDITAN'
          );
        case 'BUTUH_REVISI':
          return c.status_pekerjaan === 'BUTUH_REVISI';
        case 'ALBUM_PROSES':
          return (
            c.status_album === 'SEDANG DIPROSES' ||
            c.status_album === 'LIHAT EDITAN'
          );
        case 'KANVAS_PROSES':
          return (
            c.status_kanvas === 'SEDANG DIPROSES' ||
            c.status_kanvas === 'LIHAT EDITAN'
          );
        case 'CETAK':
          return (
            c.status_album === 'PROSES CETAK' ||
            c.status_album === 'CETAK' ||
            c.status_kanvas === 'PROSES CETAK' ||
            c.status_kanvas === 'CETAK'
          );
        case 'TERLAMBAT':
          return isCustomerJobOverdue(c, todayIso);
        case 'SELESAI':
          return c.status_pekerjaan === 'SELESAI';
        default:
          return true;
      }
    },
    [todayIso]
  );

  // Filtered & sorted customer list for Dashboard drilldown, Pengantin, and Keluarga
  const filteredCustomers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = customers.filter((c) => {
      if (activeTab === 'PENGANTIN' && c.jenis_layanan === 'KELUARGA') {
        return false;
      }
      if (activeTab === 'KELUARGA' && c.jenis_layanan !== 'KELUARGA') {
        return false;
      }
      if (activeTab === 'DASHBOARD' && !matchesDrillFilter(c, drillFilter)) {
        return false;
      }
      if (serviceFilter !== 'ALL' && c.jenis_layanan !== serviceFilter) {
        return false;
      }
      if (statusFilter !== 'ALL' && c.status_pekerjaan !== statusFilter) {
        return false;
      }
      if (
        dateFilter &&
        c.tanggal_pemotretan !== dateFilter &&
        c.tanggal_pendaftaran !== dateFilter &&
        c.estimasi_selesai !== dateFilter
      ) {
        return false;
      }
      if (q) {
        const hay = [
          c.nama_customer,
          c.nama_keluarga,
          c.kode_unik,
          c.paket,
          c.nama_marketing,
          c.whatsapp,
          c.email,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    return [...list].sort((a, b) => {
      let cmp = 0;
      if (sortField === 'nama') {
        cmp = a.nama_customer.localeCompare(b.nama_customer);
      } else if (sortField === 'estimasi') {
        cmp = (a.estimasi_selesai || '9999-12-31').localeCompare(
          b.estimasi_selesai || '9999-12-31'
        );
      } else {
        cmp = (a.tanggal_pemotretan || '').localeCompare(
          b.tanggal_pemotretan || ''
        );
      }
      return sortAsc ? cmp : -cmp;
    });
  }, [
    customers,
    activeTab,
    drillFilter,
    matchesDrillFilter,
    serviceFilter,
    statusFilter,
    dateFilter,
    searchQuery,
    sortField,
    sortAsc,
  ]);

  const approachingDeadlines = useMemo(
    () =>
      customers.filter(
        (c) =>
          isCustomerJobOverdue(c, todayIso) ||
          isCustomerApproachingDeadline(c, todayIso, 14)
      ),
    [customers, todayIso]
  );

  // Print Production Jobs derived from customers & selections (Section 13)
  const printJobs = useMemo(() => {
    const jobs: Array<{
      customer: CustomerRecord;
      jobName: string;
      productType: string;
      qty: number;
      size: string;
      entryDate: string;
      status: ProductionItemStatus;
      categoryKey: 'ALBUM_PREWEDDING' | 'ALBUM_LIPUTAN' | 'KANVAS' | 'TAMBAHAN';
    }> = [];

    for (const c of customers) {
      const sub = selections.find(
        (s) => s.kode_unik.toUpperCase() === c.kode_unik.toUpperCase()
      );
      if (c.status_album !== 'TIDAK PAKAI' && c.kuota_album > 0) {
        const cat =
          c.jenis_layanan === 'LIPUTAN' ? 'ALBUM_LIPUTAN' : 'ALBUM_PREWEDDING';
        jobs.push({
          customer: c,
          jobName: `Album ${c.paket} — ${c.nama_customer}`,
          productType:
            c.jenis_layanan === 'LIPUTAN' ? 'Album Liputan' : 'Album Prewedding',
          qty: sub ? sub.jumlah_album : c.kuota_album,
          size: 'Standard Studio Album',
          entryDate: c.tanggal_pemilihan || c.tanggal_pendaftaran,
          status: c.status_album,
          categoryKey: cat,
        });
      }
      if (c.status_kanvas !== 'TIDAK PAKAI' && c.kuota_kanvas > 0) {
        jobs.push({
          customer: c,
          jobName: `Kanvas ${c.ukuran_kanvas} — ${c.nama_customer}`,
          productType: 'Kanvas',
          qty: sub ? sub.jumlah_kanvas : c.kuota_kanvas,
          size: c.ukuran_kanvas || '60x90 cm',
          entryDate: c.tanggal_pemilihan || c.tanggal_pendaftaran,
          status: c.status_kanvas,
          categoryKey: 'KANVAS',
        });
      }
      if ((sub && sub.jumlah_tambahan > 0) || c.kuota_tambahan > 0) {
        const addCount = sub ? sub.jumlah_tambahan : 0;
        if (addCount > 0) {
          jobs.push({
            customer: c,
            jobName: `Produk / Foto Tambahan — ${c.nama_customer}`,
            productType: 'Produk Tambahan',
            qty: addCount,
            size: 'Custom',
            entryDate: c.tanggal_pemilihan || c.tanggal_pendaftaran,
            status: c.status_album,
            categoryKey: 'TAMBAHAN',
          });
        }
      }
    }

    return jobs.filter((j) => {
      if (j.categoryKey !== printCategoryTab) return false;
      if (printStatusFilter === 'BELUM_SELESAI') {
        return j.status !== 'SUDAH JADI' && j.status !== 'TIDAK PAKAI';
      }
      if (printStatusFilter !== 'ALL' && j.status !== printStatusFilter) {
        return false;
      }
      return true;
    });
  }, [customers, selections, printCategoryTab, printStatusFilter]);

  // Report Period Filtering (Section 18)
  const reportCustomers = useMemo(() => {
    const now = new Date();
    return customers.filter((c) => {
      const refDateStr = c.tanggal_pendaftaran || c.created_at.slice(0, 10);
      if (!refDateStr) return true;
      if (reportPeriod === 'RENTANG') {
        if (reportStartDate && refDateStr < reportStartDate) return false;
        if (reportEndDate && refDateStr > reportEndDate) return false;
        return true;
      }
      const dt = new Date(`${refDateStr}T00:00:00Z`);
      if (Number.isNaN(dt.getTime())) return true;
      const diffDays = Math.floor(
        (now.getTime() - dt.getTime()) / (24 * 60 * 60 * 1000)
      );
      if (reportPeriod === 'HARIAN') return diffDays <= 1;
      if (reportPeriod === 'MINGGUAN') return diffDays <= 7;
      if (reportPeriod === 'BULANAN') return diffDays <= 31;
      if (reportPeriod === 'TAHUNAN') return diffDays <= 366;
      return true;
    });
  }, [customers, reportPeriod, reportStartDate, reportEndDate]);

  const reportSummary = useMemo(() => {
    const prewedding = reportCustomers.filter(
      (c) => c.jenis_layanan === 'PREWEDING'
    ).length;
    const liputan = reportCustomers.filter(
      (c) => c.jenis_layanan === 'LIPUTAN'
    ).length;
    const keluarga = reportCustomers.filter(
      (c) => c.jenis_layanan === 'KELUARGA'
    ).length;
    const totalAlbum = reportCustomers.reduce(
      (acc, c) => acc + (c.kuota_album || 0),
      0
    );
    const totalKanvas = reportCustomers.reduce(
      (acc, c) => acc + (c.kuota_kanvas || 0),
      0
    );
    const selesai = reportCustomers.filter(
      (c) => c.status_pekerjaan === 'SELESAI'
    ).length;
    const tertunda = reportCustomers.filter(
      (c) => c.status_pekerjaan !== 'SELESAI'
    ).length;
    const terlambat = reportCustomers.filter((c) =>
      isCustomerJobOverdue(c, todayIso)
    ).length;
    const totalRevisi = reportCustomers.reduce(
      (acc, c) => acc + (c.jumlah_revisi || 0),
      0
    );
    const ratedFeedbacks = feedbacks.filter(
      (f) => f.jenis_feedback === 'CRITIC_SUGGESTION' && f.rating
    );
    const avgRating =
      ratedFeedbacks.length > 0
        ? (
            ratedFeedbacks.reduce((acc, f) => acc + (f.rating || 0), 0) /
            ratedFeedbacks.length
          ).toFixed(1)
        : '-';

    return {
      prewedding,
      liputan,
      keluarga,
      totalOrders: reportCustomers.length,
      totalAlbum,
      totalKanvas,
      selesai,
      tertunda,
      terlambat,
      totalRevisi,
      avgRating,
    };
  }, [reportCustomers, feedbacks, todayIso]);

  const handleSaveCustomer = async (payload: Partial<CustomerRecord>) => {
    await saveCustomerRecord(payload);
    await loadData();
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteCustomerRecord(deleteTarget.kode_unik);
      setDeleteTarget(null);
      await loadData();
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Gagal menghapus data customer.'
      );
    } finally {
      setDeleting(false);
    }
  };

  const handleQuickStatusUpdate = async (
    kodeUnik: string,
    updates: Partial<CustomerRecord>
  ) => {
    try {
      await updateCustomerProductionStatus({ kode_unik: kodeUnik, ...updates });
      await loadData();
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Gagal memperbarui status.'
      );
    }
  };

  const handleCopyLink = async (kodeUnik: string) => {
    const base =
      settings?.public_app_url ||
      (typeof window !== 'undefined' ? window.location.origin : '');
    const url = buildCustomerPortalUrl(base, kodeUnik);
    try {
      await navigator.clipboard.writeText(url);
      setCopiedCode(kodeUnik);
      setTimeout(() => setCopiedCode(null), 1800);
    } catch {}
  };

  const handleExportCsv = () => {
    const csv = buildCustomersCsv(reportCustomers);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `LAPORAN-LOUIS-BRIDES-${todayIso}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleExportExcel = () => {
    const rowsHtml = reportCustomers
      .map(
        (c) =>
          `<tr><td>${c.id_customer}</td><td>${c.kode_unik}</td><td>${c.nama_customer}</td><td>${
            c.nama_keluarga || ''
          }</td><td>${c.jenis_layanan}</td><td>${c.paket}</td><td>${
            c.nama_marketing
          }</td><td>${c.kuota_album}</td><td>${c.kuota_kanvas}</td><td>${
            c.ukuran_kanvas
          }</td><td>${c.status_pekerjaan}</td><td>${c.status_album}</td><td>${
            c.status_kanvas
          }</td><td>${c.estimasi_selesai || ''}</td></tr>`
      )
      .join('');
    const html = `<?xml version="1.0"?><?mso-application progid="Excel.Sheet"?><html xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="UTF-8"/></head><body><table border="1"><thead><tr><th>ID</th><th>Kode Unik</th><th>Nama Customer</th><th>Nama Keluarga</th><th>Layanan</th><th>Paket</th><th>Marketing</th><th>Kuota Album</th><th>Kuota Kanvas</th><th>Ukuran Kanvas</th><th>Status Pekerjaan</th><th>Status Album</th><th>Status Kanvas</th><th>Estimasi Selesai</th></tr></thead><tbody>${rowsHtml}</tbody></table></body></html>`;
    const blob = new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `LAPORAN-LOUIS-BRIDES-${todayIso}.xls`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleLogoutClick = async () => {
    await logoutAdmin();
    onLogout();
  };

  const detailCustomer = useMemo(
    () =>
      detailCustomerCode
        ? customers.find(
            (c) => c.kode_unik.toUpperCase() === detailCustomerCode.toUpperCase()
          ) || null
        : null,
    [customers, detailCustomerCode]
  );

  const navItems: Array<{
    key: AdminNavTab;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
  }> = [
    { key: 'DASHBOARD', label: 'DASHBOARD', icon: LayoutDashboard },
    { key: 'PENGANTIN', label: 'PENGANTIN', icon: Users },
    { key: 'KELUARGA', label: 'KELUARGA', icon: UsersRound },
    { key: 'MONITORING', label: 'MONITORING', icon: ClipboardList },
    { key: 'PEKERJAAN_CETAK', label: 'PEKERJAAN CETAK', icon: Printer },
    { key: 'LAPORAN', label: 'LAPORAN', icon: BarChart3 },
    { key: 'PENGATURAN', label: 'PENGATURAN', icon: Settings },
  ];

  // Chart calculations for Dashboard
  const customerChartBars = [
    {
      label: 'PREWEDING',
      count: customers.filter((c) => c.jenis_layanan === 'PREWEDING').length,
      color: '#8C6B30',
    },
    {
      label: 'LIPUTAN',
      count: customers.filter((c) => c.jenis_layanan === 'LIPUTAN').length,
      color: '#2A201B',
    },
    {
      label: 'KELUARGA',
      count: customers.filter((c) => c.jenis_layanan === 'KELUARGA').length,
      color: '#C6A464',
    },
  ];
  const maxCustBar = Math.max(1, ...customerChartBars.map((b) => b.count));

  const statusChartBars = [
    { label: 'Belum Pilih', count: kpiStats.belumMemilih, color: '#9A5B13' },
    { label: 'Kirim Pilihan', count: kpiStats.sudahKirimPilihan, color: '#8C6B30' },
    { label: 'Tunggu ACC', count: kpiStats.menungguPersetujuan, color: '#6D4C2F' },
    { label: 'Revisi', count: kpiStats.butuhRevisi, color: '#9E2A2B' },
    { label: 'Cetak', count: kpiStats.pekerjaanCetak, color: '#2A201B' },
    { label: 'Selesai', count: kpiStats.selesai, color: '#1F6E43' },
  ];
  const maxStatusBar = Math.max(1, ...statusChartBars.map((b) => b.count));

  return (
    <div className="min-h-screen bg-[#FAF7F2] text-[#2A201B] flex overflow-x-clip">
      {/* Desktop Sidebar (260px) */}
      <aside className="hidden lg:flex lg:w-64 lg:flex-col bg-white border-r border-[#E6DDD0] shrink-0">
        <div className="h-16 px-6 border-b border-[#E6DDD0] flex items-center">
          <BrandMark
            studioName={settings?.nama_studio || 'LOUIS BRIDES'}
            logoUrl={settings?.logo_url}
            size="sm"
          />
        </div>

        <nav
          aria-label="Navigasi Admin Studio"
          className="flex-1 p-4 space-y-1 overflow-y-auto"
        >
          {navItems.map((item) => {
            const IconComp = item.icon;
            const active = activeTab === item.key;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => {
                  setActiveTab(item.key);
                  if (item.key !== 'DASHBOARD') setDrillFilter('ALL');
                }}
                className={`w-full min-h-[44px] px-3.5 py-2.5 rounded-lg text-xs font-medium tracking-wider flex items-center gap-3 transition-colors whitespace-nowrap cursor-pointer ${
                  active
                    ? 'bg-[#2A201B] text-[#FAF7F2]'
                    : 'text-[#4A3B32] hover:bg-[#FAF7F2]'
                }`}
              >
                <IconComp
                  className={`w-4 h-4 shrink-0 ${
                    active ? 'text-[#E3C78D]' : 'text-[#8C6B30]'
                  }`}
                />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-[#E6DDD0] space-y-2">
          <a
            href="/"
            className="w-full min-h-[40px] px-3.5 py-2 rounded-lg border border-[#E6DDD0] text-xs font-medium text-[#4A3B32] hover:bg-[#FAF7F2] flex items-center justify-center gap-2"
          >
            <span>Portal Publik</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
          <button
            type="button"
            onClick={handleLogoutClick}
            className="w-full min-h-[40px] px-3.5 py-2 rounded-lg bg-[#FAF7F2] text-xs font-medium text-[#4A3B32] hover:bg-[#F3ECE1] flex items-center justify-center gap-2 cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5 text-[#8C6B30]" />
            <span>Ke Beranda Utama</span>
          </button>
        </div>
      </aside>

      {/* Mobile Sidebar Drawer */}
      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-50 bg-[#2A201B]/60 flex">
          <aside className="w-72 bg-white h-full flex flex-col border-r border-[#E6DDD0]">
            <div className="h-16 px-5 border-b border-[#E6DDD0] flex items-center justify-between">
              <BrandMark
                studioName={settings?.nama_studio || 'LOUIS BRIDES'}
                logoUrl={settings?.logo_url}
                size="sm"
              />
              <button
                type="button"
                onClick={() => setSidebarOpen(false)}
                aria-label="Tutup menu admin"
                className="w-9 h-9 rounded-lg flex items-center justify-center text-[#5E534B]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
              {navItems.map((item) => {
                const IconComp = item.icon;
                const active = activeTab === item.key;
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => {
                      setActiveTab(item.key);
                      setSidebarOpen(false);
                    }}
                    className={`w-full min-h-[44px] px-3.5 py-2.5 rounded-lg text-xs font-medium tracking-wider flex items-center gap-3 ${
                      active
                        ? 'bg-[#2A201B] text-[#FAF7F2]'
                        : 'text-[#4A3B32] hover:bg-[#FAF7F2]'
                    }`}
                  >
                    <IconComp className="w-4 h-4 shrink-0" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>
            <div className="p-4 border-t border-[#E6DDD0]">
              <button
                type="button"
                onClick={handleLogoutClick}
                className="w-full min-h-[44px] px-4 py-2 rounded-lg bg-[#FAF7F2] text-xs font-medium text-[#4A3B32] hover:bg-[#F3ECE1] flex items-center justify-center gap-2"
              >
                <LogOut className="w-4 h-4 text-[#8C6B30]" />
                <span>Ke Beranda Utama</span>
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar Contract */}
        <header className="h-16 bg-white border-b border-[#E6DDD0] px-4 sm:px-6 flex items-center justify-between gap-4 sticky top-0 z-20">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              aria-label="Buka menu navigasi"
              className="lg:hidden w-10 h-10 rounded-lg border border-[#E6DDD0] flex items-center justify-center text-[#2A201B]"
            >
              <Menu className="w-5 h-5" />
            </button>
            <h1 className="font-serif text-xl sm:text-2xl font-semibold text-[#2A201B] truncate">
              {navItems.find((n) => n.key === activeTab)?.label || 'DASHBOARD'}
            </h1>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => {
                setEditingCustomer(null);
                setFormDefaultCat(
                  activeTab === 'KELUARGA' ? 'KELUARGA' : 'PREWEDING'
                );
                setFormModalOpen(true);
              }}
              className="min-h-[40px] px-4 py-2 rounded-lg bg-[#8C6B30] text-white text-xs font-medium hover:bg-[#755824] inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Tambah Customer</span>
            </button>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 max-w-7xl w-full mx-auto space-y-6">
          {errorMsg && (
            <div
              role="alert"
              className="p-4 rounded-xl bg-[#FDF0F0] border border-[#9E2A2B]/30 text-xs sm:text-sm text-[#9E2A2B] flex items-center justify-between gap-3"
            >
              <span>{errorMsg}</span>
              <button
                type="button"
                onClick={() => setErrorMsg('')}
                className="p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {loading && !data ? (
            <div className="bg-white border border-[#E6DDD0] rounded-xl p-10 text-center text-sm text-[#5E534B]">
              Memuat data studio...
            </div>
          ) : (
            <>
              {/* VIEW 1: DASHBOARD */}
              {activeTab === 'DASHBOARD' && (
                <div className="space-y-6">
                  {/* 11 Clickable Summary KPI Cards (Section 4) */}
                  <section aria-label="Ringkasan Statistik Studio">
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
                      {(
                        [
                          {
                            key: 'PENGANTIN',
                            label: 'Total Customer Pengantin',
                            val: kpiStats.pengantin,
                          },
                          {
                            key: 'KELUARGA',
                            label: 'Total Customer Keluarga',
                            val: kpiStats.keluarga,
                          },
                          {
                            key: 'BELUM_MEMILIH',
                            label: 'Belum Memilih Foto',
                            val: kpiStats.belumMemilih,
                          },
                          {
                            key: 'SUDAH_KIRIM_PILIHAN',
                            label: 'Sudah Kirim Pilihan',
                            val: kpiStats.sudahKirimPilihan,
                          },
                          {
                            key: 'MENUNGGU_PERSETUJUAN',
                            label: 'Menunggu Persetujuan Edit',
                            val: kpiStats.menungguPersetujuan,
                          },
                          {
                            key: 'BUTUH_REVISI',
                            label: 'Membutuhkan Revisi',
                            val: kpiStats.butuhRevisi,
                          },
                          {
                            key: 'ALBUM_PROSES',
                            label: 'Album Sedang Dikerjakan',
                            val: kpiStats.albumDikerjakan,
                          },
                          {
                            key: 'KANVAS_PROSES',
                            label: 'Kanvas Sedang Dikerjakan',
                            val: kpiStats.kanvasDikerjakan,
                          },
                          {
                            key: 'CETAK',
                            label: 'Pekerjaan Cetak',
                            val: kpiStats.pekerjaanCetak,
                          },
                          {
                            key: 'TERLAMBAT',
                            label: 'Pekerjaan Terlambat',
                            val: kpiStats.terlambat,
                          },
                          {
                            key: 'SELESAI',
                            label: 'Pekerjaan Selesai',
                            val: kpiStats.selesai,
                          },
                        ] as Array<{
                          key: DashboardDrillFilter;
                          label: string;
                          val: number;
                        }>
                      ).map((kpi) => {
                        const isSelected = drillFilter === kpi.key;
                        return (
                          <button
                            key={kpi.key}
                            type="button"
                            onClick={() =>
                              setDrillFilter((prev) =>
                                prev === kpi.key ? 'ALL' : kpi.key
                              )
                            }
                            className={`text-left p-4 rounded-xl border transition-colors cursor-pointer ${
                              isSelected
                                ? 'bg-[#2A201B] text-[#FAF7F2] border-[#2A201B]'
                                : 'bg-white text-[#2A201B] border-[#E6DDD0] hover:border-[#8C6B30]'
                            }`}
                          >
                            <p
                              className={`text-xs leading-snug ${
                                isSelected ? 'text-[#E3C78D]' : 'text-[#5E534B]'
                              }`}
                            >
                              {kpi.label}
                            </p>
                            <p className="font-mono text-2xl font-semibold mt-1.5 tabular-nums">
                              {kpi.val}
                            </p>
                          </button>
                        );
                      })}
                    </div>
                  </section>

                  {/* Charts Row: Grafik Jumlah Customer & Grafik Pekerjaan Berdasarkan Status */}
                  <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Chart 1: Grafik Jumlah Customer */}
                    <div className="bg-white border border-[#E6DDD0] rounded-xl p-6 space-y-4">
                      <div className="flex items-center justify-between">
                        <h2 className="font-serif text-xl font-semibold text-[#2A201B]">
                          Grafik Jumlah Customer per Layanan
                        </h2>
                        <span className="font-mono text-xs text-[#75655A] tabular-nums">
                          Total: {customers.length}
                        </span>
                      </div>

                      <div className="space-y-3 pt-1">
                        {customerChartBars.map((bar) => {
                          const pct = Math.round((bar.count / maxCustBar) * 100);
                          return (
                            <div key={bar.label} className="space-y-1">
                              <div className="flex items-center justify-between text-xs">
                                <span className="font-medium text-[#2A201B]">
                                  {bar.label}
                                </span>
                                <span className="font-mono font-semibold text-[#2A201B] tabular-nums">
                                  {bar.count} customer
                                </span>
                              </div>
                              <div className="w-full h-3 rounded-full bg-[#FAF7F2] border border-[#E6DDD0] overflow-hidden">
                                <div
                                  className="h-full rounded-full transition-all duration-300"
                                  style={{
                                    width: `${pct}%`,
                                    backgroundColor: bar.color,
                                  }}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Chart 2: Grafik Pekerjaan Berdasarkan Status */}
                    <div className="bg-white border border-[#E6DDD0] rounded-xl p-6 space-y-4">
                      <div className="flex items-center justify-between">
                        <h2 className="font-serif text-xl font-semibold text-[#2A201B]">
                          Grafik Pekerjaan Berdasarkan Status
                        </h2>
                        <span className="font-mono text-xs text-[#75655A] tabular-nums">
                          Aktif &amp; Selesai
                        </span>
                      </div>

                      <div className="grid grid-cols-6 gap-2 items-end h-36 pt-2">
                        {statusChartBars.map((bar) => {
                          const heightPct = Math.max(
                            8,
                            Math.round((bar.count / maxStatusBar) * 100)
                          );
                          return (
                            <div
                              key={bar.label}
                              className="flex flex-col items-center justify-end h-full gap-1.5"
                            >
                              <span className="font-mono text-xs font-semibold text-[#2A201B] tabular-nums">
                                {bar.count}
                              </span>
                              <div className="w-full max-w-[36px] flex-1 flex items-end bg-[#FAF7F2] rounded-t-md overflow-hidden">
                                <div
                                  className="w-full rounded-t-md transition-all duration-300"
                                  style={{
                                    height: `${heightPct}%`,
                                    backgroundColor: bar.color,
                                  }}
                                />
                              </div>
                              <span className="text-[11px] text-[#5E534B] text-center leading-tight truncate w-full">
                                {bar.label}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </section>

                  {/* Search & Filter Bar + Daftar Pekerjaan Terbaru & Mendekati Tenggat */}
                  <section className="bg-white border border-[#E6DDD0] rounded-xl p-6 space-y-5">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                      <div>
                        <h2 className="font-serif text-xl font-semibold text-[#2A201B]">
                          Daftar Pekerjaan Customer{' '}
                          {drillFilter !== 'ALL' ? `(Filter: ${drillFilter})` : ''}
                        </h2>
                        <p className="text-xs text-[#5E534B]">
                          Klik statistik di atas atau gunakan pencarian dan filter di bawah.
                        </p>
                      </div>

                      {drillFilter !== 'ALL' && (
                        <button
                          type="button"
                          onClick={() => setDrillFilter('ALL')}
                          className="px-3 py-1.5 rounded-lg bg-[#FAF7F2] border border-[#E6DDD0] text-xs font-medium text-[#8C6B30] cursor-pointer"
                        >
                          Reset Filter Statistik
                        </button>
                      )}
                    </div>

                    {/* Search, Service Filter, Date Filter, Status Filter */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                      <div className="relative">
                        <Search className="w-4 h-4 text-[#75655A] absolute left-3.5 top-1/2 -translate-y-1/2" />
                        <input
                          type="search"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          placeholder="Cari nama / kode / paket..."
                          className="w-full pl-10 pr-3.5 py-2 rounded-lg border border-[#E6DDD0] bg-[#FAF7F2] text-xs sm:text-sm"
                        />
                      </div>

                      <select
                        aria-label="Filter jenis layanan"
                        value={serviceFilter}
                        onChange={(e) =>
                          setServiceFilter(
                            e.target.value as 'ALL' | ServiceCategory
                          )
                        }
                        className="px-3.5 py-2 rounded-lg border border-[#E6DDD0] bg-[#FAF7F2] text-xs sm:text-sm"
                      >
                        <option value="ALL">Semua Layanan</option>
                        <option value="PREWEDING">PREWEDING</option>
                        <option value="LIPUTAN">LIPUTAN</option>
                        <option value="KELUARGA">KELUARGA</option>
                      </select>

                      <select
                        aria-label="Filter status pekerjaan"
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="px-3.5 py-2 rounded-lg border border-[#E6DDD0] bg-[#FAF7F2] text-xs sm:text-sm"
                      >
                        <option value="ALL">Semua Status Pekerjaan</option>
                        <option value="BELUM_MEMILIH">BELUM MEMILIH</option>
                        <option value="SUDAH_KIRIM_PILIHAN">SUDAH KIRIM PILIHAN</option>
                        <option value="SEDANG_EDITING">SEDANG EDITING</option>
                        <option value="MENUNGGU_PERSETUJUAN">
                          MENUNGGU PERSETUJUAN
                        </option>
                        <option value="BUTUH_REVISI">BUTUH REVISI</option>
                        <option value="PROSES_CETAK">PROSES CETAK</option>
                        <option value="SELESAI">SELESAI</option>
                      </select>

                      <input
                        type="date"
                        aria-label="Filter berdasarkan tanggal"
                        value={dateFilter}
                        onChange={(e) => setDateFilter(e.target.value)}
                        className="px-3.5 py-2 rounded-lg border border-[#E6DDD0] bg-[#FAF7F2] font-mono text-xs"
                      />
                    </div>

                    {/* Customer Table */}
                    <div className="overflow-x-auto border border-[#E6DDD0] rounded-xl">
                      <table className="w-full text-left border-collapse text-xs sm:text-sm">
                        <thead>
                          <tr className="bg-[#FAF7F2] border-b border-[#E6DDD0] text-xs uppercase text-[#5E534B]">
                            <th className="py-3 px-4">Kode</th>
                            <th className="py-3 px-4">Nama Customer</th>
                            <th className="py-3 px-4">Layanan &amp; Paket</th>
                            <th className="py-3 px-4">Album / Kanvas</th>
                            <th className="py-3 px-4">Estimasi Selesai</th>
                            <th className="py-3 px-4 text-right">Aksi</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#E6DDD0]">
                          {filteredCustomers.length === 0 ? (
                            <tr>
                              <td
                                colSpan={6}
                                className="py-8 text-center text-xs text-[#5E534B]"
                              >
                                {customers.length === 0
                                  ? 'Belum ada data customer di database. Klik "Tambah Customer" untuk memulai atau hubungkan Google Apps Script di menu Pengaturan.'
                                  : 'Tidak ada data customer yang sesuai dengan filter saat ini.'}
                              </td>
                            </tr>
                          ) : (
                            filteredCustomers.map((c) => {
                              const overdue = isCustomerJobOverdue(c, todayIso);
                              return (
                                <tr
                                  key={c.id_customer}
                                  className="hover:bg-[#FAF7F2]/70"
                                >
                                  <td className="py-3 px-4 font-mono text-xs font-semibold text-[#8C6B30] whitespace-nowrap">
                                    {c.kode_unik}
                                  </td>
                                  <td className="py-3 px-4">
                                    <p className="font-medium text-[#2A201B]">
                                      {c.nama_customer}
                                    </p>
                                    {c.nama_keluarga && (
                                      <p className="text-xs text-[#75655A]">
                                        {c.nama_keluarga}
                                      </p>
                                    )}
                                  </td>
                                  <td className="py-3 px-4 text-xs text-[#4A3B32]">
                                    <span className="font-medium">
                                      {c.jenis_layanan}
                                    </span>{' '}
                                    · {c.paket}
                                  </td>
                                  <td className="py-3 px-4 text-xs text-[#4A3B32]">
                                    <p>Album: {c.status_album}</p>
                                    <p className="text-[#75655A]">
                                      Kanvas: {c.status_kanvas}
                                    </p>
                                  </td>
                                  <td className="py-3 px-4 font-mono text-xs tabular-nums">
                                    <span
                                      className={
                                        overdue
                                          ? 'text-[#9E2A2B] font-semibold'
                                          : 'text-[#2A201B]'
                                      }
                                    >
                                      {formatDateDDMMYYYY(c.estimasi_selesai)}
                                      {overdue ? ' (Terlambat)' : ''}
                                    </span>
                                  </td>
                                  <td className="py-3 px-4 text-right whitespace-nowrap">
                                    <div className="inline-flex items-center gap-1.5 justify-end">
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setDetailCustomerCode(c.kode_unik)
                                        }
                                        aria-label={`Detail ${c.nama_customer}`}
                                        title="Lihat Detail Customer"
                                        className="flex flex-col items-center justify-center p-1.5 min-w-[46px] rounded-lg border border-[#E6DDD0] bg-white text-[#2A201B] hover:border-[#8C6B30] hover:bg-[#FAF7F2] transition cursor-pointer"
                                      >
                                        <Eye className="w-3.5 h-3.5 text-[#2A201B]" />
                                        <span className="text-[10px] font-medium mt-0.5 leading-tight text-[#5E534B]">Detail</span>
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setWaCustomer(c)}
                                        aria-label={`WhatsApp ${c.nama_customer}`}
                                        title="Kirim Pesan WhatsApp"
                                        className="flex flex-col items-center justify-center p-1.5 min-w-[48px] rounded-lg bg-[#ECF7F0] border border-[#1F6E43]/20 text-[#1F6E43] hover:bg-[#DDF2E4] transition cursor-pointer"
                                      >
                                        <MessageCircle className="w-3.5 h-3.5" />
                                        <span className="text-[10px] font-medium mt-0.5 leading-tight">WhatsApp</span>
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  </section>

                  {/* Daftar Pekerjaan yang Mendekati Tenggat */}
                  <section className="bg-white border border-[#E6DDD0] rounded-xl p-6 space-y-4">
                    <div className="flex items-center gap-2 text-[#9A5B13]">
                      <AlertTriangle className="w-5 h-5" />
                      <h2 className="font-serif text-xl font-semibold text-[#2A201B]">
                        Daftar Pekerjaan Mendekati Tenggat &amp; Terlambat (
                        {approachingDeadlines.length})
                      </h2>
                    </div>

                    {approachingDeadlines.length === 0 ? (
                      <p className="text-xs text-[#5E534B]">
                        Tidak ada pekerjaan yang mendekati tenggat dalam 14 hari ke depan.
                      </p>
                    ) : (
                      <div className="divide-y divide-[#E6DDD0]">
                        {approachingDeadlines.map((c) => {
                          const overdue = isCustomerJobOverdue(c, todayIso);
                          return (
                            <div
                              key={c.id_customer}
                              className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs sm:text-sm"
                            >
                              <div>
                                <span className="font-mono font-semibold text-[#8C6B30] mr-2">
                                  {c.kode_unik}
                                </span>
                                <strong className="text-[#2A201B]">
                                  {c.nama_customer}
                                </strong>
                                <span className="text-[#5E534B]">
                                  {' '}
                                  · {c.paket} ({c.status_album})
                                </span>
                              </div>
                              <div className="flex items-center gap-3">
                                <span
                                  className={`font-mono text-xs font-semibold tabular-nums ${
                                    overdue ? 'text-[#9E2A2B]' : 'text-[#9A5B13]'
                                  }`}
                                >
                                  Tenggat: {formatDateDDMMYYYY(c.estimasi_selesai)}{' '}
                                  {overdue ? '(TERLAMBAT)' : '(Segera)'}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => setDetailCustomerCode(c.kode_unik)}
                                  className="text-xs font-medium text-[#8C6B30] hover:underline cursor-pointer"
                                >
                                  Buka Detail
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </section>
                </div>
              )}

              {/* VIEW 2 & 3: PENGANTIN & KELUARGA (Section 5) */}
              {(activeTab === 'PENGANTIN' || activeTab === 'KELUARGA') && (
                <div className="space-y-5">
                  <div className="bg-white border border-[#E6DDD0] rounded-xl p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div className="flex flex-wrap items-center gap-3 flex-1">
                      <div className="relative flex-1 min-w-[220px] max-w-sm">
                        <Search className="w-4 h-4 text-[#75655A] absolute left-3.5 top-1/2 -translate-y-1/2" />
                        <input
                          type="search"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          placeholder="Cari nama, kode unik, marketing..."
                          className="w-full pl-10 pr-4 py-2 rounded-lg border border-[#E6DDD0] bg-[#FAF7F2] text-sm"
                        />
                      </div>

                      {activeTab === 'PENGANTIN' && (
                        <select
                          aria-label="Filter kategori pengantin"
                          value={serviceFilter}
                          onChange={(e) =>
                            setServiceFilter(
                              e.target.value as 'ALL' | ServiceCategory
                            )
                          }
                          className="px-3.5 py-2 rounded-lg border border-[#E6DDD0] bg-[#FAF7F2] text-xs sm:text-sm"
                        >
                          <option value="ALL">PREWEDING &amp; LIPUTAN</option>
                          <option value="PREWEDING">PREWEDING</option>
                          <option value="LIPUTAN">LIPUTAN</option>
                        </select>
                      )}

                      <button
                        type="button"
                        onClick={() => setSortAsc((a) => !a)}
                        className="px-3.5 py-2 rounded-lg border border-[#E6DDD0] bg-[#FAF7F2] text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer"
                      >
                        <ArrowUpDown className="w-3.5 h-3.5 text-[#8C6B30]" />
                        <span>Urutkan ({sortAsc ? 'A-Z' : 'Terbaru'})</span>
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setEditingCustomer(null);
                        setFormDefaultCat(
                          activeTab === 'KELUARGA' ? 'KELUARGA' : 'PREWEDING'
                        );
                        setFormModalOpen(true);
                      }}
                      className="min-h-[42px] px-5 py-2 rounded-lg bg-[#2A201B] text-[#FAF7F2] text-xs sm:text-sm font-medium inline-flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                      <span>
                        Tambah Customer{' '}
                        {activeTab === 'KELUARGA' ? 'Keluarga' : 'Pengantin'}
                      </span>
                    </button>
                  </div>

                  {/* Customer Management Table */}
                  <div className="bg-white border border-[#E6DDD0] rounded-xl overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse text-xs sm:text-sm">
                        <thead>
                          <tr className="bg-[#FAF7F2] border-b border-[#E6DDD0] text-xs uppercase text-[#5E534B]">
                            <th className="py-3.5 px-4">Kode Unik</th>
                            <th className="py-3.5 px-4">
                              {activeTab === 'KELUARGA'
                                ? 'Nama Pelanggan & Keluarga'
                                : 'Nama Pengantin'}
                            </th>
                            <th className="py-3.5 px-4">Layanan &amp; Paket</th>
                            <th className="py-3.5 px-4">Kuota</th>
                            <th className="py-3.5 px-4">Marketing</th>
                            <th className="py-3.5 px-4">Estimasi Selesai</th>
                            <th className="py-3.5 px-4 text-right">Aksi</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#E6DDD0]">
                          {filteredCustomers.length === 0 ? (
                            <tr>
                              <td
                                colSpan={7}
                                className="py-10 text-center text-xs text-[#5E534B]"
                              >
                                Belum ada customer pada kategori {activeTab}.
                              </td>
                            </tr>
                          ) : (
                            filteredCustomers.map((c) => (
                              <tr
                                key={c.id_customer}
                                className="hover:bg-[#FAF7F2]/70"
                              >
                                <td className="py-3.5 px-4 font-mono text-xs font-semibold text-[#8C6B30] whitespace-nowrap">
                                  {c.kode_unik}
                                </td>
                                <td className="py-3.5 px-4">
                                  <p className="font-semibold text-[#2A201B]">
                                    {c.nama_customer}
                                  </p>
                                  {c.nama_keluarga && (
                                    <p className="text-xs text-[#5E534B]">
                                      Keluarga: {c.nama_keluarga}
                                    </p>
                                  )}
                                  <p className="text-xs text-[#75655A]">
                                    {c.whatsapp || c.email || '-'}
                                  </p>
                                </td>
                                <td className="py-3.5 px-4 text-xs">
                                  <p className="font-medium text-[#2A201B]">
                                    {c.jenis_layanan}
                                  </p>
                                  <p className="text-[#5E534B]">{c.paket}</p>
                                </td>
                                <td className="py-3.5 px-4 font-mono text-xs tabular-nums">
                                  <p>Album: {c.kuota_album}</p>
                                  <p className="text-[#5E534B]">
                                    Kanvas: {c.kuota_kanvas} ({c.ukuran_kanvas})
                                  </p>
                                </td>
                                <td className="py-3.5 px-4 text-xs text-[#4A3B32]">
                                  {c.nama_marketing || '-'}
                                </td>
                                <td className="py-3.5 px-4 font-mono text-xs tabular-nums">
                                  {formatDateDDMMYYYY(c.estimasi_selesai)}
                                </td>
                                <td className="py-3.5 px-4 text-right whitespace-nowrap">
                                  <div className="inline-flex items-center gap-1.5 justify-end">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setDetailCustomerCode(c.kode_unik)
                                      }
                                      title="Lihat Detail & Folder"
                                      aria-label={`Detail ${c.nama_customer}`}
                                      className="flex flex-col items-center justify-center p-1.5 min-w-[46px] rounded-lg border border-[#E6DDD0] bg-white text-[#2A201B] hover:border-[#8C6B30] hover:bg-[#FAF7F2] transition cursor-pointer"
                                    >
                                      <Eye className="w-3.5 h-3.5 text-[#2A201B]" />
                                      <span className="text-[10px] font-medium mt-0.5 leading-tight text-[#5E534B]">Detail</span>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleCopyLink(c.kode_unik)}
                                      title="Salin Link Customer"
                                      aria-label={`Salin link ${c.nama_customer}`}
                                      className="flex flex-col items-center justify-center p-1.5 min-w-[54px] rounded-lg border border-[#E6DDD0] bg-white text-[#8C6B30] hover:bg-[#FAF7F2] transition cursor-pointer"
                                    >
                                      {copiedCode === c.kode_unik ? (
                                        <Check className="w-3.5 h-3.5 text-[#1F6E43]" />
                                      ) : (
                                        <Copy className="w-3.5 h-3.5" />
                                      )}
                                      <span className="text-[10px] font-medium mt-0.5 leading-tight text-[#8C6B30]">
                                        {copiedCode === c.kode_unik ? 'Tersalin' : 'Salin Link'}
                                      </span>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setWaCustomer(c)}
                                      title="Kirim WhatsApp"
                                      aria-label={`WhatsApp ${c.nama_customer}`}
                                      className="flex flex-col items-center justify-center p-1.5 min-w-[48px] rounded-lg bg-[#ECF7F0] border border-[#1F6E43]/20 text-[#1F6E43] hover:bg-[#DDF2E4] transition cursor-pointer"
                                    >
                                      <MessageCircle className="w-3.5 h-3.5" />
                                      <span className="text-[10px] font-medium mt-0.5 leading-tight">WhatsApp</span>
                                    </button>
                                    {c.drive_folder_url && (
                                      <a
                                        href={c.drive_folder_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        title="Buka Folder Google Drive"
                                        aria-label={`Google Drive ${c.nama_customer}`}
                                        className="flex flex-col items-center justify-center p-1.5 min-w-[44px] rounded-lg border border-[#E6DDD0] bg-white text-[#4A3B32] hover:bg-[#FAF7F2] transition"
                                      >
                                        <FolderOpen className="w-3.5 h-3.5 text-[#8C6B30]" />
                                        <span className="text-[10px] font-medium mt-0.5 leading-tight text-[#5E534B]">Drive</span>
                                      </a>
                                    )}
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setEditingCustomer(c);
                                        setFormModalOpen(true);
                                      }}
                                      title="Edit Customer"
                                      aria-label={`Edit ${c.nama_customer}`}
                                      className="flex flex-col items-center justify-center p-1.5 min-w-[42px] rounded-lg border border-[#E6DDD0] bg-white text-[#2A201B] hover:border-[#8C6B30] hover:bg-[#FAF7F2] transition cursor-pointer"
                                    >
                                      <Edit3 className="w-3.5 h-3.5 text-[#2A201B]" />
                                      <span className="text-[10px] font-medium mt-0.5 leading-tight text-[#5E534B]">Edit</span>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setDeleteTarget(c)}
                                      title="Hapus Customer"
                                      aria-label={`Hapus ${c.nama_customer}`}
                                      className="flex flex-col items-center justify-center p-1.5 min-w-[44px] rounded-lg bg-[#FDF0F0] border border-[#9E2A2B]/20 text-[#9E2A2B] hover:bg-[#FBE3E3] transition cursor-pointer"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                      <span className="text-[10px] font-medium mt-0.5 leading-tight">Hapus</span>
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* VIEW 4: MONITORING PRODUKSI (Section 12) */}
              {activeTab === 'MONITORING' && (
                <div className="space-y-6">
                  <div className="bg-white border border-[#E6DDD0] rounded-xl overflow-hidden">
                    <div className="p-5 border-b border-[#E6DDD0] flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h2 className="font-serif text-xl font-semibold text-[#2A201B]">
                          Monitoring Status Pekerjaan Album &amp; Kanvas
                        </h2>
                        <p className="text-xs text-[#5E534B]">
                          Ubah status pekerjaan Album dan Kanvas secara terpisah. Perubahan
                          otomatis tersinkronisasi ke portal customer.
                        </p>
                      </div>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse text-xs sm:text-sm">
                        <thead>
                          <tr className="bg-[#FAF7F2] border-b border-[#E6DDD0] text-xs uppercase text-[#5E534B]">
                            <th className="py-3.5 px-4">Customer</th>
                            <th className="py-3.5 px-4">Status Album</th>
                            <th className="py-3.5 px-4">Status Kanvas</th>
                            <th className="py-3.5 px-4">Kirim Pilihan</th>
                            <th className="py-3.5 px-4">Estimasi Selesai</th>
                            <th className="py-3.5 px-4">Revisi</th>
                            <th className="py-3.5 px-4 text-right">Detail</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#E6DDD0]">
                          {customers.length === 0 ? (
                            <tr>
                              <td
                                colSpan={7}
                                className="py-8 text-center text-xs text-[#5E534B]"
                              >
                                Belum ada pekerjaan untuk dimonitor.
                              </td>
                            </tr>
                          ) : (
                            customers.map((c) => (
                              <tr
                                key={c.id_customer}
                                className="hover:bg-[#FAF7F2]/60"
                              >
                                <td className="py-3.5 px-4">
                                  <p className="font-semibold text-[#2A201B]">
                                    {c.nama_customer}
                                  </p>
                                  <p className="font-mono text-xs text-[#8C6B30]">
                                    {c.kode_unik} · {c.jenis_layanan}
                                  </p>
                                </td>
                                <td className="py-3.5 px-4">
                                  <select
                                    aria-label={`Status Album ${c.nama_customer}`}
                                    value={c.status_album}
                                    onChange={(e) =>
                                      handleQuickStatusUpdate(c.kode_unik, {
                                        status_album: e.target
                                          .value as ProductionItemStatus,
                                      })
                                    }
                                    className="px-2.5 py-1.5 rounded-lg border border-[#E6DDD0] bg-[#FAF7F2] text-xs font-medium text-[#2A201B]"
                                  >
                                    {PRODUCTION_STATUS_LIST.map((st) => (
                                      <option key={st} value={st}>
                                        {st}
                                      </option>
                                    ))}
                                  </select>
                                </td>
                                <td className="py-3.5 px-4">
                                  <select
                                    aria-label={`Status Kanvas ${c.nama_customer}`}
                                    value={c.status_kanvas}
                                    onChange={(e) =>
                                      handleQuickStatusUpdate(c.kode_unik, {
                                        status_kanvas: e.target
                                          .value as ProductionItemStatus,
                                      })
                                    }
                                    className="px-2.5 py-1.5 rounded-lg border border-[#E6DDD0] bg-[#FAF7F2] text-xs font-medium text-[#2A201B]"
                                  >
                                    {PRODUCTION_STATUS_LIST.map((st) => (
                                      <option key={st} value={st}>
                                        {st}
                                      </option>
                                    ))}
                                  </select>
                                </td>
                                <td className="py-3.5 px-4 font-mono text-xs tabular-nums">
                                  {formatDateDDMMYYYY(c.tanggal_pemilihan)}
                                </td>
                                <td className="py-3.5 px-4 font-mono text-xs tabular-nums">
                                  {formatDateDDMMYYYY(c.estimasi_selesai)}
                                </td>
                                <td className="py-3.5 px-4 font-mono text-xs tabular-nums">
                                  {c.jumlah_revisi}x
                                </td>
                                <td className="py-3.5 px-4 text-right">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setDetailCustomerCode(c.kode_unik)
                                    }
                                    className="px-3 py-1.5 rounded border border-[#E6DDD0] bg-white text-xs font-medium text-[#2A201B] cursor-pointer"
                                  >
                                    Lihat Anotasi
                                  </button>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Riwayat Perubahan Status (LOG_AKTIVITAS) */}
                  <div className="bg-white border border-[#E6DDD0] rounded-xl p-6 space-y-4">
                    <h3 className="font-serif text-xl font-semibold text-[#2A201B]">
                      Riwayat Perubahan Status &amp; Log Aktivitas
                    </h3>
                    {logs.length === 0 ? (
                      <p className="text-xs text-[#5E534B]">
                        Belum ada catatan log aktivitas.
                      </p>
                    ) : (
                      <div className="divide-y divide-[#E6DDD0] max-h-72 overflow-y-auto">
                        {logs.slice(0, 40).map((log) => (
                          <div
                            key={log.id_log}
                            className="py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs"
                          >
                            <div>
                              <span className="font-mono font-semibold text-[#8C6B30] mr-2">
                                [{log.aktor}]
                              </span>
                              <strong className="text-[#2A201B]">{log.aksi}</strong>
                              {log.nama_customer && (
                                <span className="text-[#4A3B32]">
                                  {' '}
                                  · {log.nama_customer} ({log.kode_unik})
                                </span>
                              )}
                              <span className="text-[#5E534B]">
                                {' '}
                                — {log.detail}
                              </span>
                            </div>
                            <span className="font-mono text-[#75655A] tabular-nums shrink-0">
                              {log.waktu.slice(0, 16).replace('T', ' ')}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* VIEW 5: PEKERJAAN CETAK (Section 13) */}
              {activeTab === 'PEKERJAAN_CETAK' && (
                <div className="space-y-5">
                  <div className="bg-white border border-[#E6DDD0] rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-1.5 overflow-x-auto">
                      {(
                        [
                          { key: 'ALBUM_PREWEDDING', label: 'Album Prewedding' },
                          { key: 'ALBUM_LIPUTAN', label: 'Album Liputan' },
                          { key: 'KANVAS', label: 'Kanvas' },
                          { key: 'TAMBAHAN', label: 'Produk Tambahan' },
                        ] as const
                      ).map((tab) => (
                        <button
                          key={tab.key}
                          type="button"
                          onClick={() => setPrintCategoryTab(tab.key)}
                          className={`px-4 py-2 rounded-lg text-xs font-medium whitespace-nowrap shrink-0 cursor-pointer ${
                            printCategoryTab === tab.key
                              ? 'bg-[#2A201B] text-[#FAF7F2]'
                              : 'bg-[#FAF7F2] text-[#4A3B32] border border-[#E6DDD0]'
                          }`}
                        >
                          {tab.label}
                        </button>
                      ))}
                    </div>

                    <select
                      aria-label="Filter status pekerjaan cetak"
                      value={printStatusFilter}
                      onChange={(e) => setPrintStatusFilter(e.target.value)}
                      className="px-3.5 py-2 rounded-lg border border-[#E6DDD0] bg-[#FAF7F2] text-xs sm:text-sm"
                    >
                      <option value="ALL">Semua Status</option>
                      <option value="BELUM_SELESAI">Belum Selesai</option>
                      {PRODUCTION_STATUS_LIST.map((st) => (
                        <option key={st} value={st}>
                          {st}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="bg-white border border-[#E6DDD0] rounded-xl overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse text-xs sm:text-sm">
                        <thead>
                          <tr className="bg-[#FAF7F2] border-b border-[#E6DDD0] text-xs uppercase text-[#5E534B]">
                            <th className="py-3.5 px-4">Customer</th>
                            <th className="py-3.5 px-4">Nama Pekerjaan</th>
                            <th className="py-3.5 px-4">Jumlah &amp; Ukuran</th>
                            <th className="py-3.5 px-4">Tgl Masuk</th>
                            <th className="py-3.5 px-4">Status Cetak</th>
                            <th className="py-3.5 px-4">Tgl Cetak / Selesai</th>
                            <th className="py-3.5 px-4">Catatan Produksi</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#E6DDD0]">
                          {printJobs.length === 0 ? (
                            <tr>
                              <td
                                colSpan={7}
                                className="py-8 text-center text-xs text-[#5E534B]"
                              >
                                Tidak ada daftar pekerjaan cetak pada kategori ini.
                              </td>
                            </tr>
                          ) : (
                            printJobs.map((job, idx) => {
                              const isCanvas = job.categoryKey === 'KANVAS';
                              return (
                                <tr
                                  key={`${job.customer.id_customer}-${job.categoryKey}-${idx}`}
                                  className="hover:bg-[#FAF7F2]/60"
                                >
                                  <td className="py-3.5 px-4">
                                    <p className="font-semibold text-[#2A201B]">
                                      {job.customer.nama_customer}
                                    </p>
                                    <p className="font-mono text-xs text-[#8C6B30]">
                                      {job.customer.kode_unik}
                                    </p>
                                  </td>
                                  <td className="py-3.5 px-4 text-xs text-[#2A201B]">
                                    <p className="font-medium">{job.jobName}</p>
                                    <p className="text-[#75655A]">{job.productType}</p>
                                  </td>
                                  <td className="py-3.5 px-4 font-mono text-xs tabular-nums">
                                    {job.qty} · {job.size}
                                  </td>
                                  <td className="py-3.5 px-4 font-mono text-xs tabular-nums">
                                    {job.entryDate || '-'}
                                  </td>
                                  <td className="py-3.5 px-4">
                                    <select
                                      aria-label={`Status cetak ${job.jobName}`}
                                      value={job.status}
                                      onChange={(e) => {
                                        const val = e.target
                                          .value as ProductionItemStatus;
                                        handleQuickStatusUpdate(
                                          job.customer.kode_unik,
                                          isCanvas
                                            ? { status_kanvas: val }
                                            : { status_album: val }
                                        );
                                      }}
                                      className="px-2.5 py-1.5 rounded-lg border border-[#E6DDD0] bg-[#FAF7F2] text-xs font-medium"
                                    >
                                      {PRODUCTION_STATUS_LIST.map((st) => (
                                        <option key={st} value={st}>
                                          {st}
                                        </option>
                                      ))}
                                    </select>
                                  </td>
                                  <td className="py-3.5 px-4">
                                    <input
                                      type="date"
                                      aria-label={`Tanggal cetak ${job.jobName}`}
                                      value={job.customer.tanggal_cetak || ''}
                                      onChange={(e) =>
                                        handleQuickStatusUpdate(
                                          job.customer.kode_unik,
                                          { tanggal_cetak: e.target.value }
                                        )
                                      }
                                      className="px-2.5 py-1 rounded border border-[#E6DDD0] font-mono text-xs"
                                    />
                                  </td>
                                  <td className="py-3.5 px-4">
                                    <input
                                      type="text"
                                      defaultValue={
                                        job.customer.catatan_produksi || ''
                                      }
                                      onBlur={(e) =>
                                        handleQuickStatusUpdate(
                                          job.customer.kode_unik,
                                          { catatan_produksi: e.target.value }
                                        )
                                      }
                                      placeholder="Tambah catatan cetak..."
                                      className="w-44 px-2.5 py-1 rounded border border-[#E6DDD0] text-xs"
                                    />
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* VIEW 6: LAPORAN (Section 18) */}
              {activeTab === 'LAPORAN' && (
                <div className="space-y-6">
                  <div className="bg-white border border-[#E6DDD0] rounded-xl p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div className="flex flex-wrap items-center gap-2">
                      {(
                        [
                          { key: 'HARIAN', label: 'Harian' },
                          { key: 'MINGGUAN', label: 'Mingguan' },
                          { key: 'BULANAN', label: 'Bulanan' },
                          { key: 'TAHUNAN', label: 'Tahunan' },
                          { key: 'RENTANG', label: 'Rentang Tanggal' },
                        ] as const
                      ).map((p) => (
                        <button
                          key={p.key}
                          type="button"
                          onClick={() => setReportPeriod(p.key)}
                          className={`px-3.5 py-2 rounded-lg text-xs font-medium cursor-pointer ${
                            reportPeriod === p.key
                              ? 'bg-[#2A201B] text-[#FAF7F2]'
                              : 'bg-[#FAF7F2] text-[#4A3B32] border border-[#E6DDD0]'
                          }`}
                        >
                          {p.label}
                        </button>
                      ))}

                      {reportPeriod === 'RENTANG' && (
                        <div className="flex items-center gap-2 ml-2">
                          <input
                            type="date"
                            value={reportStartDate}
                            onChange={(e) => setReportStartDate(e.target.value)}
                            className="px-2.5 py-1.5 rounded border border-[#E6DDD0] font-mono text-xs"
                          />
                          <span className="text-xs text-[#5E534B]">s/d</span>
                          <input
                            type="date"
                            value={reportEndDate}
                            onChange={(e) => setReportEndDate(e.target.value)}
                            className="px-2.5 py-1.5 rounded border border-[#E6DDD0] font-mono text-xs"
                          />
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2.5 shrink-0">
                      <button
                        type="button"
                        onClick={handleExportCsv}
                        className="min-h-[42px] px-4 py-2 rounded-lg border border-[#E6DDD0] bg-[#FAF7F2] text-xs font-medium text-[#2A201B] hover:bg-[#F3ECE1] inline-flex items-center gap-1.5 cursor-pointer"
                      >
                        <Download className="w-4 h-4 text-[#8C6B30]" />
                        <span>Export CSV</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleExportExcel}
                        className="min-h-[42px] px-4 py-2 rounded-lg bg-[#1F6E43] text-white text-xs font-medium hover:bg-[#175533] inline-flex items-center gap-1.5 cursor-pointer"
                      >
                        <FileSpreadsheet className="w-4 h-4" />
                        <span>Export Excel</span>
                      </button>
                    </div>
                  </div>

                  {/* Report Metrics Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div className="bg-white border border-[#E6DDD0] rounded-xl p-5">
                      <p className="text-xs text-[#5E534B]">Total Pesanan</p>
                      <p className="font-mono text-2xl font-semibold text-[#2A201B] mt-1 tabular-nums">
                        {reportSummary.totalOrders}
                      </p>
                      <p className="text-xs text-[#75655A] mt-1">
                        Prewed: {reportSummary.prewedding} · Liputan:{' '}
                        {reportSummary.liputan} · Keluarga: {reportSummary.keluarga}
                      </p>
                    </div>

                    <div className="bg-white border border-[#E6DDD0] rounded-xl p-5">
                      <p className="text-xs text-[#5E534B]">
                        Total Kuota Album &amp; Kanvas
                      </p>
                      <p className="font-mono text-2xl font-semibold text-[#2A201B] mt-1 tabular-nums">
                        {reportSummary.totalAlbum} / {reportSummary.totalKanvas}
                      </p>
                      <p className="text-xs text-[#75655A] mt-1">
                        {reportSummary.totalAlbum} Foto Album ·{' '}
                        {reportSummary.totalKanvas} Unit Kanvas
                      </p>
                    </div>

                    <div className="bg-white border border-[#E6DDD0] rounded-xl p-5">
                      <p className="text-xs text-[#5E534B]">
                        Selesai / Tertunda / Terlambat
                      </p>
                      <p className="font-mono text-2xl font-semibold text-[#2A201B] mt-1 tabular-nums">
                        {reportSummary.selesai} / {reportSummary.tertunda} /{' '}
                        {reportSummary.terlambat}
                      </p>
                      <p className="text-xs text-[#75655A] mt-1">
                        Total Revisi: {reportSummary.totalRevisi} kali
                      </p>
                    </div>

                    <div className="bg-white border border-[#E6DDD0] rounded-xl p-5">
                      <p className="text-xs text-[#5E534B]">
                        Rata-rata Kepuasan Customer
                      </p>
                      <p className="font-mono text-2xl font-semibold text-[#8C6B30] mt-1 tabular-nums">
                        {reportSummary.avgRating} / 5.0
                      </p>
                      <p className="text-xs text-[#75655A] mt-1">
                        Berdasarkan ulasan di Kritik &amp; Saran
                      </p>
                    </div>
                  </div>

                  {/* Kritik & Saran Customer List inside Reports */}
                  <div className="bg-white border border-[#E6DDD0] rounded-xl p-6 space-y-4">
                    <h3 className="font-serif text-xl font-semibold text-[#2A201B]">
                      Daftar Kritik &amp; Saran Pelanggan
                    </h3>
                    {feedbacks.filter((f) => f.jenis_feedback === 'CRITIC_SUGGESTION')
                      .length === 0 ? (
                      <p className="text-xs text-[#5E534B]">
                        Belum ada kritik dan saran dari pelanggan.
                      </p>
                    ) : (
                      <div className="divide-y divide-[#E6DDD0]">
                        {feedbacks
                          .filter((f) => f.jenis_feedback === 'CRITIC_SUGGESTION')
                          .map((fb) => (
                            <div key={fb.id_feedback} className="py-3 space-y-1 text-xs">
                              <div className="flex items-center justify-between">
                                <span className="font-semibold text-[#2A201B]">
                                  {fb.nama_customer} ({fb.kode_unik}) — Rating:{' '}
                                  {fb.rating}/5 · {fb.kategori_masukan}
                                </span>
                                <span className="font-mono text-[#75655A]">
                                  {fb.waktu_kirim.slice(0, 10)}
                                </span>
                              </div>
                              <p className="text-[#4A3B32]">{fb.catatan_umum}</p>
                            </div>
                          ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* VIEW 7: PENGATURAN (Section 19) */}
              {activeTab === 'PENGATURAN' && settings && (
                <AdminSettingsView
                  settings={settings}
                  marketing={marketing}
                  onRefreshData={loadData}
                />
              )}
            </>
          )}
        </main>
      </div>

      {/* Add / Edit Customer Modal */}
      {settings && (
        <CustomerFormModal
          isOpen={formModalOpen}
          editingCustomer={editingCustomer}
          defaultCategory={formDefaultCat}
          existingCodes={existingCodes}
          marketingList={marketing}
          settings={settings}
          onSave={handleSaveCustomer}
          onClose={() => {
            setFormModalOpen(false);
            setEditingCustomer(null);
          }}
        />
      )}

      {/* Customer Detail & Folder Manager Modal */}
      <CustomerDetailModal
        customer={detailCustomer}
        selections={selections}
        feedbacks={feedbacks}
        publicAppUrl={settings?.public_app_url || ''}
        isGasConfigured={Boolean(settings?.gas_webapp_url)}
        onOpenWhatsApp={(cust) => setWaCustomer(cust)}
        onClose={() => setDetailCustomerCode(null)}
      />

      {/* WhatsApp Message Generator Modal */}
      {settings && (
        <WhatsAppModal
          customer={waCustomer}
          templates={settings.whatsapp_templates}
          publicAppUrl={settings.public_app_url}
          onClose={() => setWaCustomer(null)}
        />
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div
          className="fixed inset-0 z-50 bg-[#2A201B]/60 backdrop-blur-xs flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white border border-[#E6DDD0] rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl">
            <h3 className="font-serif text-xl font-semibold text-[#2A201B]">
              Konfirmasi Penghapusan Customer
            </h3>
            <p className="text-sm text-[#4A3B32] leading-relaxed">
              Apakah Anda yakin ingin menghapus data customer{' '}
              <strong>{deleteTarget.nama_customer}</strong> (
              <span className="font-mono">{deleteTarget.kode_unik}</span>)? File foto asli di
              Google Drive tidak akan dihapus secara otomatis.
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 rounded-lg text-xs font-medium text-[#5E534B] cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={handleConfirmDelete}
                className="px-5 py-2.5 rounded-lg bg-[#9E2A2B] text-white text-xs sm:text-sm font-medium hover:bg-[#822122] disabled:opacity-50 cursor-pointer"
              >
                {deleting ? 'Menghapus...' : 'Ya, Hapus Customer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
