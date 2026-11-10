import React from 'react';
import {
  CheckSquare,
  CircleDot,
  Download,
  Eye,
  FileCheck2,
  Hand,
  Heart,
  Layers,
  MessageSquarePlus,
  RotateCcw,
  Send,
  ZoomIn,
} from 'lucide-react';

interface PanduanViewProps {
  onNavigateTab?: (tab: 'PILIH_FOTO' | 'LIHAT_EDITAN' | 'REVISI') => void;
}

export const PanduanView: React.FC<PanduanViewProps> = ({ onNavigateTab }) => {
  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header Editorial Card */}
      <div className="bg-white border border-[#E6DDD0] rounded-xl p-6 sm:p-8">
        <p className="text-xs font-medium tracking-[0.18em] uppercase text-[#8C6B30] mb-2">
          Panduan Resmi Pelanggan
        </p>
        <h2 className="font-serif text-2xl sm:text-3xl font-semibold text-[#2A201B] text-balance mb-3">
          PANDUAN PEMILIHAN FOTO &amp; REVISI — LOUIS BRIDES
        </h2>
        <div className="space-y-2 text-sm sm:text-[15px] text-[#4A3B32] leading-relaxed">
          <p className="font-medium text-[#2A201B]">Halo Kak! 👋</p>
          <p>Selamat datang di halaman pemilihan foto LOUIS BRIDES.</p>
          <p>
            Melalui halaman ini, Kakak bisa memilih foto untuk Album dan Kanvas, memberikan
            catatan khusus untuk foto, melihat hasil editan, serta mengajukan revisi jika masih
            ada bagian yang ingin diperbaiki.
          </p>
          <p className="text-[#8C6B30] font-medium">
            Yuk, ikuti panduan berikut agar prosesnya lebih mudah.
          </p>
        </div>

        {onNavigateTab && (
          <div className="mt-6 pt-5 border-t border-[#E6DDD0] flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => onNavigateTab('PILIH_FOTO')}
              className="px-4 py-2.5 rounded-lg bg-[#2A201B] text-[#FAF7F2] text-xs font-medium tracking-wide hover:bg-[#3F312A] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Mulai Pilih Foto
            </button>
            <button
              type="button"
              onClick={() => onNavigateTab('LIHAT_EDITAN')}
              className="px-4 py-2.5 rounded-lg border border-[#C6A464] text-[#8C6B30] text-xs font-medium tracking-wide hover:bg-[#FAF7F2] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Lihat Hasil Editan
            </button>
            <button
              type="button"
              onClick={() => onNavigateTab('REVISI')}
              className="px-4 py-2.5 rounded-lg border border-[#E6DDD0] text-[#4A3B32] text-xs font-medium tracking-wide hover:bg-[#FAF7F2] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Lihat Hasil Revisi
            </button>
          </div>
        )}
      </div>

      {/* Bagian 1: Pemilihan Foto */}
      <section className="space-y-4">
        <div className="px-1">
          <h3 className="font-serif text-xl sm:text-2xl font-semibold text-[#2A201B]">
            Bagian I — Panduan Memilih Foto Album &amp; Kanvas
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Step 1 */}
          <div className="bg-white border border-[#E6DDD0] rounded-xl p-6 space-y-3">
            <div className="flex items-center gap-2.5 text-[#8C6B30]">
              <CheckSquare className="w-5 h-5 shrink-0" />
              <h4 className="font-serif text-lg font-semibold text-[#2A201B]">
                1. MEMILIH FOTO UNTUK ALBUM &amp; KANVAS
              </h4>
            </div>
            <ol className="list-decimal list-inside space-y-1.5 text-sm text-[#4A3B32]">
              <li>Buka menu <strong>PILIH FOTO</strong>.</li>
              <li>Semua foto akan ditampilkan dalam bentuk galeri.</li>
              <li>Perhatikan foto satu per satu, lalu pilih foto yang disukai.</li>
            </ol>
            <div className="pt-2 border-t border-[#E6DDD0] space-y-1.5 text-sm text-[#4A3B32]">
              <p className="font-medium text-[#2A201B]">Pada setiap foto terdapat pilihan:</p>
              <ul className="space-y-1">
                <li>
                  <strong>ALBUM</strong> – Centang jika foto ingin dimasukkan ke dalam album.
                </li>
                <li>
                  <strong>KANVAS</strong> – Centang jika foto ingin dicetak menjadi kanvas.
                </li>
                <li>
                  <strong>ALBUM + KANVAS</strong> – Centang keduanya jika foto ingin digunakan
                  untuk album sekaligus kanvas.
                </li>
                <li>
                  <strong>FOTO TAMBAHAN</strong> – Pilih jika ingin menambah foto di luar kuota
                  album (foto yang sudah dipilih untuk Album tidak dapat dipilih sebagai Foto
                  Tambahan).
                </li>
              </ul>
              <p className="text-xs text-[#8C6B30] pt-1">
                Penting: Perhatikan jumlah kuota album dan kanvas agar pilihan foto tidak melebihi
                jumlah yang tersedia.
              </p>
            </div>
          </div>

          {/* Step 2 */}
          <div className="bg-white border border-[#E6DDD0] rounded-xl p-6 space-y-3">
            <div className="flex items-center gap-2.5 text-[#8C6B30]">
              <MessageSquarePlus className="w-5 h-5 shrink-0" />
              <h4 className="font-serif text-lg font-semibold text-[#2A201B]">
                2. MEMBERIKAN CATATAN KHUSUS PADA FOTO
              </h4>
            </div>
            <p className="text-sm text-[#4A3B32]">
              Jika ada foto yang ingin diberikan arahan khusus kepada editor:
            </p>
            <ol className="list-decimal list-inside space-y-1.5 text-sm text-[#4A3B32]">
              <li>Cari foto yang ingin diberikan catatan.</li>
              <li>Klik <strong>+ Tambah Catatan Edit</strong>.</li>
              <li>Tuliskan bagian yang ingin diperbaiki.</li>
              <li>Catatan tersebut akan tersimpan bersama pilihan foto saat dikirimkan.</li>
            </ol>
            <div className="pt-2 border-t border-[#E6DDD0] text-sm text-[#4A3B32]">
              <p className="font-medium text-[#2A201B] mb-1">Contoh catatan:</p>
              <ul className="list-disc list-inside space-y-1 text-xs sm:text-sm text-[#5E534B]">
                <li>Tolong cerahkan wajah sedikit.</li>
                <li>Hilangkan orang yang ada di belakang.</li>
                <li>Rapikan rambut yang menutupi wajah.</li>
                <li>Tolong kecilkan bagian perut sedikit.</li>
                <li>Warna kulit dibuat lebih natural.</li>
                <li>Hilangkan benda yang mengganggu di sekitar foto.</li>
              </ul>
            </div>
          </div>

          {/* Step 3 */}
          <div className="bg-white border border-[#E6DDD0] rounded-xl p-6 space-y-3">
            <div className="flex items-center gap-2.5 text-[#8C6B30]">
              <ZoomIn className="w-5 h-5 shrink-0" />
              <h4 className="font-serif text-lg font-semibold text-[#2A201B]">
                3. MEMPERBESAR FOTO (ZOOM)
              </h4>
            </div>
            <p className="text-sm text-[#4A3B32]">
              Jika ingin melihat foto lebih jelas sebelum memilih:
            </p>
            <ol className="list-decimal list-inside space-y-1.5 text-sm text-[#4A3B32]">
              <li>Klik langsung pada foto atau ikon kaca pembesar.</li>
              <li>Foto akan terbuka dalam tampilan lebih besar.</li>
              <li>Gunakan tombol <strong>+</strong> untuk memperbesar &amp; <strong>-</strong> untuk memperkecil.</li>
              <li>Geser pengaturan <strong>MIN–MAX</strong> untuk mengatur ukuran foto.</li>
              <li>Jika foto terlalu besar, geser foto untuk melihat bagian lainnya.</li>
              <li>Gunakan tombol panah kiri dan kanan untuk berpindah foto.</li>
              <li>Klik tombol <strong>X</strong> atau tekan <strong>Escape</strong> untuk menutup.</li>
            </ol>
            <p className="text-xs text-[#8C6B30]">
              Tenang, pilihan foto yang sudah dicentang sebelumnya tidak akan hilang hanya karena
              Kakak memperbesar atau melihat foto lainnya.
            </p>
          </div>

          {/* Step 4 & 5 */}
          <div className="bg-white border border-[#E6DDD0] rounded-xl p-6 space-y-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2.5 text-[#8C6B30]">
                <Layers className="w-5 h-5 shrink-0" />
                <h4 className="font-serif text-lg font-semibold text-[#2A201B]">
                  4. MEMBERIKAN CATATAN EDITING (OPSIONAL)
                </h4>
              </div>
              <ul className="list-disc list-inside space-y-1 text-sm text-[#4A3B32]">
                <li>
                  Kakak dapat menuliskan catatan khusus pada setiap foto pilihan (contoh: <em>"Tolong rapikan rambut"</em> atau <em>"Cerahkan wajah sedikit"</em>).
                </li>
                <li>
                  Tersedia juga kolom catatan keseluruhan untuk arahan umum yang berlaku ke seluruh foto.
                </li>
              </ul>
            </div>

            <div className="pt-3 border-t border-[#E6DDD0] space-y-2">
              <div className="flex items-center gap-2.5 text-[#8C6B30]">
                <Send className="w-5 h-5 shrink-0" />
                <h4 className="font-serif text-lg font-semibold text-[#2A201B]">
                  5. MEMERIKSA &amp; MENGIRIM PILIHAN FOTO
                </h4>
              </div>
              <ol className="list-decimal list-inside space-y-1 text-sm text-[#4A3B32]">
                <li>Buka tab <strong>2. RINGKASAN</strong> untuk memeriksa foto yang sudah dipilih.</li>
                <li>Pastikan jumlah foto album dan kanvas sudah sesuai kuota.</li>
                <li>Periksa catatan editing khusus pada setiap foto yang dipilih.</li>
                <li>Tuliskan arahan tambahan pada bagian <strong>Catatan Edit Untuk Semua Foto</strong> jika ada.</li>
                <li>Klik <strong>KIRIM PILIHAN FOTO</strong> lalu setujui konfirmasi pengiriman.</li>
              </ol>
            </div>
          </div>
        </div>
      </section>

      {/* Bagian 2: Hasil Editan & Revisi */}
      <section className="space-y-4">
        <div className="px-1">
          <h3 className="font-serif text-xl sm:text-2xl font-semibold text-[#2A201B]">
            Bagian II — Panduan Melihat Hasil Editan &amp; Mengajukan Revisi
          </h3>
          <p className="text-sm text-[#5E534B]">
            Setelah tim editor selesai mengerjakan foto, Kakak bisa melihat hasilnya langsung melalui
            link customer yang sama.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Step 6 */}
          <div className="bg-white border border-[#E6DDD0] rounded-xl p-6 space-y-3">
            <div className="flex items-center gap-2.5 text-[#8C6B30]">
              <Eye className="w-5 h-5 shrink-0" />
              <h4 className="font-serif text-lg font-semibold text-[#2A201B]">
                6. MELIHAT HASIL EDITAN FOTO
              </h4>
            </div>
            <ol className="list-decimal list-inside space-y-1.5 text-sm text-[#4A3B32]">
              <li>Buka kembali link customer dari LOUIS BRIDES.</li>
              <li>Pilih menu <strong>LIHAT EDITAN</strong>.</li>
              <li>Semua foto hasil editan yang sudah diunggah oleh tim editor akan tampil.</li>
              <li>Klik foto untuk melihatnya dalam ukuran lebih besar.</li>
              <li>Periksa wajah, warna, pencahayaan, kerapian rambut/baju, dan objek sekitar.</li>
            </ol>
            <p className="text-xs text-[#4A3B32] bg-[#FAF7F2] p-3 rounded-lg border border-[#E6DDD0]">
              Jika seluruh hasil editan sudah sesuai harapan, klik tombol{' '}
              <strong>SUDAH OK / SIAP CETAK</strong>. Jika masih ada bagian yang perlu diperbaiki,
              ajukan revisi langsung dari halaman ini.
            </p>
          </div>

          {/* Step 7 */}
          <div className="bg-white border border-[#E6DDD0] rounded-xl p-6 space-y-3">
            <div className="flex items-center gap-2.5 text-[#8C6B30]">
              <CircleDot className="w-5 h-5 shrink-0" />
              <h4 className="font-serif text-lg font-semibold text-[#2A201B]">
                7. CARA MEMBERIKAN TANDA PADA BAGIAN REVISI
              </h4>
            </div>
            <p className="text-sm text-[#4A3B32]">
              Pada menu <strong>LIHAT EDITAN</strong>, klik foto yang ingin direvisi untuk membuka
              tampilan <strong>Zoom &amp; Tandai Revisi</strong>:
            </p>
            <ul className="space-y-1.5 text-sm text-[#4A3B32]">
              <li>
                <strong>LINGKARI BAGIAN</strong> – Tekan pada bagian foto, tahan, lalu geser untuk
                melingkari area wajah, tangan, baju, atau objek yang ingin diperbaiki.
              </li>
              <li>
                <strong>TITIK PIN</strong> – Klik satu titik kecil yang perlu diperhatikan untuk
                menampilkan tanda pin bernomor.
              </li>
              <li>
                <strong>GESER / PAN</strong> – Menggeser posisi foto saat sedang diperbesar.
              </li>
              <li>
                <strong>UNDO / HAPUS SEMUA TANDA</strong> – Membatalkan tanda terakhir atau
                membersihkan semua tanda pada foto tersebut.
              </li>
            </ul>
          </div>

          {/* Step 8 & 9 */}
          <div className="bg-white border border-[#E6DDD0] rounded-xl p-6 space-y-3">
            <div className="flex items-center gap-2.5 text-[#8C6B30]">
              <FileCheck2 className="w-5 h-5 shrink-0" />
              <h4 className="font-serif text-lg font-semibold text-[#2A201B]">
                8 &amp; 9. CATATAN REVISI &amp; PENGIRIMAN PERMINTAAN
              </h4>
            </div>
            <ol className="list-decimal list-inside space-y-1.5 text-sm text-[#4A3B32]">
              <li>Tuliskan penjelasan revisi yang spesifik pada kolom catatan foto.</li>
              <li>Klik tombol simpan tanda &amp; catatan pada foto tersebut.</li>
              <li>Tutup tampilan foto, lalu klik tombol <strong>MASIH PERLU REVISI</strong>.</li>
              <li>
                Periksa daftar foto yang direvisi, tambahkan <strong>Catatan Keseluruhan</strong>{' '}
                jika ada, lalu klik <strong>KIRIMKAN SEKARANG</strong>.
              </li>
              <li>
                Kakak juga dapat langsung mengirimkan konfirmasi revisi melalui WhatsApp Marketing.
              </li>
            </ol>
          </div>

          {/* Step 10 */}
          <div className="bg-white border border-[#E6DDD0] rounded-xl p-6 space-y-3">
            <div className="flex items-center gap-2.5 text-[#8C6B30]">
              <Download className="w-5 h-5 shrink-0" />
              <h4 className="font-serif text-lg font-semibold text-[#2A201B]">
                10. MELIHAT HASIL FOTO SETELAH DIREVISI
              </h4>
            </div>
            <ol className="list-decimal list-inside space-y-1.5 text-sm text-[#4A3B32]">
              <li>Buka kembali link customer setelah tim editor selesai memperbaiki foto.</li>
              <li>Pilih menu <strong>REVISI</strong>.</li>
              <li>Foto hasil perbaikan akan muncul setelah diunggah oleh tim LOUIS BRIDES.</li>
              <li>Klik foto untuk memperbesar dan memeriksa hasilnya.</li>
              <li>
                Gunakan tombol <strong>Download Semua Revisi</strong> untuk mengunduh seluruh file
                revisi dalam satu file ZIP.
              </li>
            </ol>
          </div>
        </div>
      </section>

      {/* Tips & Salam Hangat */}
      <div className="bg-[#F3ECE1] border border-[#E6DDD0] rounded-xl p-6 sm:p-8 space-y-4">
        <div className="flex items-center gap-2.5 text-[#8C6B30]">
          <RotateCcw className="w-5 h-5 shrink-0" />
          <h4 className="font-serif text-xl font-semibold text-[#2A201B]">
            TIPS AGAR PROSES PEMILIHAN &amp; REVISI LEBIH MUDAH
          </h4>
        </div>
        <ol className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-sm text-[#4A3B32] list-decimal list-inside">
          <li>Luangkan waktu untuk memeriksa foto satu per satu.</li>
          <li>Jangan terburu-buru saat menentukan foto untuk album dan kanvas.</li>
          <li>Gunakan fitur zoom agar bisa melihat detail foto dengan lebih jelas.</li>
          <li>Jika meminta perbaikan, usahakan memberikan tanda dan catatan yang spesifik.</li>
          <li>Gunakan bahasa yang jelas agar editor tidak salah memahami permintaan.</li>
          <li>Periksa kembali semua pilihan sebelum mengirimkannya.</li>
          <li>
            Simpan link customer agar mudah dibuka kembali saat ingin melihat hasil editan atau
            revisi.
          </li>
        </ol>

        <div className="pt-4 border-t border-[#E6DDD0] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="text-sm text-[#4A3B32]">
            <p>
              Terima kasih sudah mempercayakan momen spesial Kakak kepada{' '}
              <strong>LOUIS BRIDES</strong>. Semoga hasil foto yang dikerjakan menjadi kenangan
              indah yang bisa dikenang sepanjang masa. ❤️
            </p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-xs uppercase tracking-[0.16em] text-[#8C6B30] font-semibold">
              SALAM HANGAT, LOUIS BRIDES
            </p>
            <p className="font-serif italic text-base text-[#2A201B]">
              Your Beautiful Moments, Our Timeless Memories.
            </p>
          </div>
        </div>
      </div>

      {/* Unused icons safeguard */}
      <span className="hidden" aria-hidden="true">
        <Hand className="w-4 h-4" />
        <Heart className="w-4 h-4" />
      </span>
    </div>
  );
};
