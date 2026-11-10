import React, { useEffect, useState } from 'react';
import { Check, Copy, ExternalLink, MessageCircle, X } from 'lucide-react';
import type { CustomerRecord, WhatsAppTemplateKey } from '../types/studio';
import {
  DEFAULT_WHATSAPP_TEMPLATES,
  formatInternationalWhatsApp,
  interpolateWhatsAppMessage,
} from '../utils/studioLogic';

interface WhatsAppModalProps {
  customer: CustomerRecord | null;
  templates: Record<WhatsAppTemplateKey, string>;
  publicAppUrl: string;
  initialTemplate?: WhatsAppTemplateKey;
  onClose: () => void;
}

const TEMPLATE_LABELS: Array<{ key: WhatsAppTemplateKey; label: string }> = [
  { key: 'KIRIM_LINK', label: '1. Pengiriman Link Pemilihan Foto' },
  { key: 'PENGINGAT_PILIH', label: '2. Pengingat Pemilihan Foto' },
  { key: 'HASIL_EDITING', label: '3. Pemberitahuan Hasil Editing' },
  { key: 'MINTA_PERSETUJUAN', label: '4. Permintaan Persetujuan Editing' },
  { key: 'PEMBERITAHUAN_REVISI', label: '5. Pemberitahuan Hasil Revisi' },
  { key: 'PEKERJAAN_SELESAI', label: '6. Pemberitahuan Pekerjaan Selesai' },
];

export const WhatsAppModal: React.FC<WhatsAppModalProps> = ({
  customer,
  templates,
  publicAppUrl,
  initialTemplate = 'KIRIM_LINK',
  onClose,
}) => {
  const [selectedKey, setSelectedKey] = useState<WhatsAppTemplateKey>(initialTemplate);
  const [messageText, setMessageText] = useState('');
  const [copied, setCopied] = useState(false);

  const effectiveBaseUrl =
    publicAppUrl || (typeof window !== 'undefined' ? window.location.origin : '');

  useEffect(() => {
    if (!customer) return;
    const rawTpl =
      templates[selectedKey] || DEFAULT_WHATSAPP_TEMPLATES[selectedKey];
    setMessageText(interpolateWhatsAppMessage(rawTpl, customer, effectiveBaseUrl));
  }, [customer, selectedKey, templates, effectiveBaseUrl]);

  if (!customer) return null;

  const formattedPhone = formatInternationalWhatsApp(customer.whatsapp);
  const waHref = formattedPhone
    ? `https://wa.me/${formattedPhone}?text=${encodeURIComponent(messageText)}`
    : `https://wa.me/?text=${encodeURIComponent(messageText)}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(messageText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback copy via textarea
      const el = document.createElement('textarea');
      el.value = messageText;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-[#2A201B]/60 backdrop-blur-xs flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="wa-modal-title"
    >
      <div className="bg-white border border-[#E6DDD0] rounded-xl max-w-2xl w-full overflow-hidden shadow-xl">
        <div className="px-6 py-4 bg-[#FAF7F2] border-b border-[#E6DDD0] flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <MessageCircle className="w-5 h-5 text-[#1F6E43]" />
            <div>
              <h3 id="wa-modal-title" className="font-serif text-xl font-semibold text-[#2A201B]">
                Generator Pesan WhatsApp Customer
              </h3>
              <p className="text-xs text-[#75655A]">
                {customer.nama_customer} · {customer.kode_unik} ·{' '}
                {formattedPhone ? `+${formattedPhone}` : 'Nomor WA belum diisi'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup modal WhatsApp"
            className="w-10 h-10 rounded-lg flex items-center justify-center text-[#5E534B] hover:bg-[#E6DDD0]/50 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label
              htmlFor="wa-template-select"
              className="block text-xs font-medium uppercase tracking-wider text-[#5E534B] mb-1.5"
            >
              Pilih Template Pesan
            </label>
            <select
              id="wa-template-select"
              value={selectedKey}
              onChange={(e) => setSelectedKey(e.target.value as WhatsAppTemplateKey)}
              className="w-full px-3.5 py-2.5 rounded-lg border border-[#E6DDD0] bg-[#FAF7F2] text-sm text-[#2A201B] focus:outline-none focus:border-[#8C6B30]"
            >
              {TEMPLATE_LABELS.map((item) => (
                <option key={item.key} value={item.key}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label
                htmlFor="wa-message-body"
                className="block text-xs font-medium uppercase tracking-wider text-[#5E534B]"
              >
                Pratinjau &amp; Edit Pesan
              </label>
              <span className="text-xs text-[#75655A] tabular-nums">
                {messageText.length} karakter
              </span>
            </div>
            <textarea
              id="wa-message-body"
              rows={9}
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-lg border border-[#E6DDD0] bg-white text-sm text-[#2A201B] leading-relaxed focus:outline-none focus:border-[#8C6B30]"
            />
          </div>

          <div className="pt-2 flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-[#E6DDD0] bg-[#FAF7F2] text-sm font-medium text-[#2A201B] hover:bg-[#F3ECE1] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 text-[#1F6E43]" />
                  <span>Pesan Tersalin</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 text-[#8C6B30]" />
                  <span>Salin Pesan</span>
                </>
              )}
            </button>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-lg text-sm font-medium text-[#5E534B] hover:bg-[#FAF7F2] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                Tutup
              </button>
              <a
                href={waHref}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#1F6E43] text-white text-sm font-medium hover:bg-[#175533] transition-colors whitespace-nowrap shrink-0"
              >
                <span>Buka WhatsApp</span>
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
