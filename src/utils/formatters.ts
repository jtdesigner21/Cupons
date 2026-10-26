/**
 * Utilitários de Formatação e Validação
 */

// Limpa caracteres não numéricos
export function cleanDigits(value: string): string {
  return value.replace(/\D/g, '');
}

// Formata CPF: 000.000.000-00
export function formatCPF(value: string): string {
  const digits = cleanDigits(value).slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9, 11)}`;
}

// Mascara CPF para exibição pública e privacidade (ex: 123.***.***-45)
export function maskCPF(value: string): string {
  const digits = cleanDigits(value);
  if (digits.length !== 11) return formatCPF(value);
  return `${digits.slice(0, 3)}.***.***-${digits.slice(9, 11)}`;
}

// Validação oficial de dígitos verificadores de CPF
export function isValidCPF(cpf: string): boolean {
  const digits = cleanDigits(cpf);
  if (digits.length !== 11) return false;

  // Rejeita sequências conhecidas de dígitos iguais
  if (/^(\d)\1{10}$/.test(digits)) return false;

  // Primeiro dígito verificador
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(digits.charAt(i), 10) * (10 - i);
  }
  let rev = 11 - (sum % 11);
  if (rev === 10 || rev === 11) rev = 0;
  if (rev !== parseInt(digits.charAt(9), 10)) return false;

  // Segundo dígito verificador
  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(digits.charAt(i), 10) * (11 - i);
  }
  rev = 11 - (sum % 11);
  if (rev === 10 || rev === 11) rev = 0;
  if (rev !== parseInt(digits.charAt(10), 10)) return false;

  return true;
}

// Formata Telefone / WhatsApp: (11) 99999-9999
export function formatPhone(value: string): string {
  const digits = cleanDigits(value).slice(0, 11);
  if (digits.length <= 2) return digits.length ? `(${digits}` : '';
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
}

// Formata Perfil do Instagram (@perfil)
export function formatInstagram(value: string): string {
  const clean = value.replace(/[@\s]/g, '').trim().toLowerCase();
  return clean ? `@${clean}` : '';
}

// Formata Moeda em Reais
export function formatBRL(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

// Formata número do cupom sequencial (#0001)
export function formatCouponNumber(num: number, padding = 4): string {
  return `#${num.toString().padStart(padding, '0')}`;
}

// Formata Data e Hora no padrão brasileiro
export function formatDateTime(isoString: string): string {
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return isoString;
  return d.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// Gera código verificador antifraude exclusivo para o cupom
export function generateVerificationCode(couponNumber: number, cpf: string): string {
  const cleanCpf = cleanDigits(cpf);
  const base = `${couponNumber}-${cleanCpf.slice(-4)}-${Date.now().toString(36).slice(-3)}`;
  // Hash simples determinístico de 4 caracteres hexadecimais
  let hash = 0;
  for (let i = 0; i < base.length; i++) {
    hash = ((hash << 5) - hash + base.charCodeAt(i)) | 0;
  }
  const hex = Math.abs(hash).toString(16).toUpperCase().padStart(4, '0').slice(0, 4);
  const numPad = couponNumber.toString().padStart(4, '0');
  return `SJ-A1M-${numPad}-${hex}`;
}

// Agrupa cupons por Compra / Atendimento (Batch)
import type { Coupon, PurchaseBatch } from '../types';

export function groupCouponsIntoBatches(coupons: Coupon[]): PurchaseBatch[] {
  const map = new Map<string, Coupon[]>();

  coupons.forEach((coupon) => {
    // Agrupa pelo ID do lote ou pelo CPF + minuto aproximado
    const key = coupon.batchId || `${coupon.cpf}_${coupon.createdAt.slice(0, 16)}`;
    if (!map.has(key)) {
      map.set(key, []);
    }
    map.get(key)!.push(coupon);
  });

  const batches: PurchaseBatch[] = [];

  map.forEach((items, key) => {
    if (items.length === 0) return;
    items.sort((a, b) => a.number - b.number);
    const first = items[0];
    const last = items[items.length - 1];

    let totalPurchAmount = 0;
    let printers = 0;

    items.forEach((c) => {
      if (c.purchaseAmount) totalPurchAmount = Math.max(totalPurchAmount, c.purchaseAmount);
      if (c.printerCount) printers = Math.max(printers, c.printerCount);
    });

    const summaryParts: string[] = [];
    if (printers > 0) {
      summaryParts.push(`${printers}x Impressora`);
    }
    if (totalPurchAmount > 0) {
      summaryParts.push(`Compra R$ ${totalPurchAmount.toFixed(2)}`);
    }

    const otherOrigins: string[] = [];
    if (items.some((c) => c.origin === 'visit')) otherOrigins.push('1ª Visita');
    if (items.some((c) => c.origin === 'instagram')) otherOrigins.push('Instagram');
    if (items.some((c) => c.origin === 'manual')) otherOrigins.push('Extra');

    const summary =
      [...summaryParts, ...otherOrigins].join(' + ') || 'Emissão no Balcão';

    const printedCount = items.filter((c) => Boolean(c.printedAt)).length;
    const isFullyPrinted = printedCount === items.length;
    const hasPendingPrint = printedCount < items.length;

    batches.push({
      batchId: key,
      cpf: first.cpf,
      customerName: first.customerName,
      customerWhatsapp: first.customerWhatsapp,
      customerInstagram: first.customerInstagram,
      createdAt: first.createdAt,
      coupons: items,
      summary,
      totalCoupons: items.length,
      totalAmount: totalPurchAmount || undefined,
      printerCount: printers || undefined,
      startNumber: first.formattedNumber,
      endNumber: last.formattedNumber,
      printedCount,
      isFullyPrinted,
      hasPendingPrint,
    });
  });

  // Ordena por data mais recente primeiro
  batches.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return batches;
}
