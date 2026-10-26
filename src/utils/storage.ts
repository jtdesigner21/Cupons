import { CampaignSettings, Coupon, Customer } from '../types';
import { formatCouponNumber, generateVerificationCode } from './formatters';

const STORAGE_KEYS = {
  CUSTOMERS: 'sj_cupons_customers_v1',
  COUPONS: 'sj_cupons_items_v1',
  SETTINGS: 'sj_cupons_settings_v1',
  NEXT_NUMBER: 'sj_cupons_next_seq_v1',
};

export const DEFAULT_SETTINGS: CampaignSettings = {
  campaignName: 'Sorteio Bambu Lab A1 Mini',
  storeName: 'Loja SJ',
  prizeName: 'Impressora 3D Bambu Lab A1 Mini',
  subtitle: 'Black Friday Loja SJ',
  visitCouponCount: 2,
  instagramCouponCount: 1,
  purchaseValueStep: 60, // R$ 60 por cupom (+1 cupom a cada R$ 60)
  minPurchaseValue: 60, // Compra mínima R$ 60
  maxPurchaseCoupons: 10, // Máximo 10 cupons por compra
  printerBonusCoupons: 10, // 10 cupons ao comprar qualquer impressora
  drawDateNotice: 'Apuração oficial na urna física ao final da Black Friday',
  socialHandle: '@lojasj',
  autoCutPaper: true,
};

// Dados semente iniciais limpos para produção oficial da loja
const INITIAL_CUSTOMERS: Customer[] = [];
const INITIAL_COUPONS: Coupon[] = [];

// Reseta o banco de dados completamente (0 clientes, 0 cupons, numeração volta ao 1)
export function resetDatabase(): void {
  try {
    localStorage.setItem(STORAGE_KEYS.CUSTOMERS, JSON.stringify([]));
    localStorage.setItem(STORAGE_KEYS.COUPONS, JSON.stringify([]));
    localStorage.setItem(STORAGE_KEYS.NEXT_NUMBER, '1');
  } catch (err) {
    console.error('Erro ao resetar banco de dados:', err);
  }
}

export function loadSettings(): CampaignSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SETTINGS);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw);
    const purchaseStep = parsed.purchaseValueStep === 60 ? 60 : (parsed.purchaseValueStep || DEFAULT_SETTINGS.purchaseValueStep);
    // Regra da campanha: na compra de R$ 60 já ganha 1 cupom! Não pode ser maior que R$ 60
    const minPurchase = parsed.minPurchaseValue && parsed.minPurchaseValue <= 60 
      ? parsed.minPurchaseValue 
      : 60;

    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      purchaseValueStep: purchaseStep,
      minPurchaseValue: minPurchase,
      maxPurchaseCoupons: parsed.maxPurchaseCoupons ?? DEFAULT_SETTINGS.maxPurchaseCoupons,
    };
  } catch (err) {
    console.error('Erro ao carregar configurações:', err);
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(settings: CampaignSettings): void {
  try {
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
  } catch (err) {
    console.error('Erro ao salvar configurações:', err);
  }
}

export function loadCustomers(): Customer[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.CUSTOMERS);
    if (!raw) {
      // Salva inicial
      saveCustomers(INITIAL_CUSTOMERS);
      return INITIAL_CUSTOMERS;
    }
    return JSON.parse(raw);
  } catch (err) {
    console.error('Erro ao carregar clientes:', err);
    return [];
  }
}

export function saveCustomers(customers: Customer[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.CUSTOMERS, JSON.stringify(customers));
  } catch (err) {
    console.error('Erro ao salvar clientes:', err);
  }
}

export function loadCoupons(): Coupon[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.COUPONS);
    if (!raw) {
      saveCoupons(INITIAL_COUPONS);
      return INITIAL_COUPONS;
    }
    return JSON.parse(raw);
  } catch (err) {
    console.error('Erro ao carregar cupons:', err);
    return [];
  }
}

export function saveCoupons(coupons: Coupon[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.COUPONS, JSON.stringify(coupons));
  } catch (err) {
    console.error('Erro ao salvar cupons:', err);
  }
}

export function getNextCouponNumber(): number {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.NEXT_NUMBER);
    if (!raw) {
      const coupons = loadCoupons();
      const maxNum = coupons.reduce((max, c) => Math.max(max, c.number || 0), 0);
      const next = maxNum + 1;
      localStorage.setItem(STORAGE_KEYS.NEXT_NUMBER, next.toString());
      return next;
    }
    return parseInt(raw, 10) || 1;
  } catch (err) {
    console.error('Erro ao ler próximo número:', err);
    return 1;
  }
}

export function incrementCouponNumberBy(amount: number): number {
  const current = getNextCouponNumber();
  const next = current + amount;
  localStorage.setItem(STORAGE_KEYS.NEXT_NUMBER, next.toString());
  return current; // Retorna o número inicial do bloco
}

// Marca cupons como impressos localmente atualizando printedAt
export function markCouponsAsPrintedLocal(couponIds: string[], timestamp?: string): Coupon[] {
  try {
    const printTime = timestamp || new Date().toISOString();
    const coupons = loadCoupons();
    const updated = coupons.map((c) => {
      if (couponIds.includes(c.id)) {
        return {
          ...c,
          printedAt: c.printedAt || printTime,
        };
      }
      return c;
    });
    saveCoupons(updated);
    return updated;
  } catch (err) {
    console.error('Erro ao marcar cupons como impressos localmente:', err);
    return [];
  }
}

// Exporta dados para planilha CSV formatada com UTF-8 BOM para compatibilidade com Microsoft Excel e Google Sheets
export function exportCouponsToCSV(coupons: Coupon[]): void {
  const headers = [
    'Número',
    'Nome do Participante',
    'CPF',
    'WhatsApp',
    'Instagram',
    'Origem do Cupom',
    'Valor da Compra (R$)',
    'Nº no Talão Físico',
    'Código de Verificação',
    'Data de Emissão',
    'Status Impressão',
    'Data Impressão',
  ];

  const rows = coupons.map((c) => [
    `"${c.formattedNumber}"`,
    `"${c.customerName.replace(/"/g, '""')}"`,
    `"${c.cpf}"`,
    `"${c.customerWhatsapp || ''}"`,
    `"${c.customerInstagram || ''}"`,
    `"${c.originLabel}"`,
    c.purchaseAmount ? `"${c.purchaseAmount.toFixed(2)}"` : '""',
    `"${c.physicalPaperNumber || ''}"`,
    `"${c.verificationCode}"`,
    `"${new Date(c.createdAt).toLocaleString('pt-BR')}"`,
    `"${c.printedAt ? 'Impresso' : 'Pendente de Impressão'}"`,
    `"${c.printedAt ? new Date(c.printedAt).toLocaleString('pt-BR') : '-'}"`,
  ]);

  const csvContent = '\uFEFF' + [headers.join(';'), ...rows.map((r) => r.join(';'))].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `cupons_sorteio_bambu_lab_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// Backup completo de dados em formato JSON
export function exportBackupJSON(): void {
  const data = {
    app: 'Cadastro de Cupons SJ - Elgin i9',
    exportedAt: new Date().toISOString(),
    settings: loadSettings(),
    customers: loadCustomers(),
    coupons: loadCoupons(),
    nextNumber: getNextCouponNumber(),
  };

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `backup_cupons_lojasj_${Date.now()}.json`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// Restauração de backup JSON
export function importBackupJSON(jsonString: string): boolean {
  try {
    const data = JSON.parse(jsonString);
    if (!data.customers || !data.coupons) {
      throw new Error('Arquivo de backup inválido.');
    }
    if (data.settings) saveSettings(data.settings);
    if (data.customers) saveCustomers(data.customers);
    if (data.coupons) saveCoupons(data.coupons);
    if (data.nextNumber) localStorage.setItem(STORAGE_KEYS.NEXT_NUMBER, data.nextNumber.toString());
    return true;
  } catch (err) {
    console.error('Falha ao restaurar backup:', err);
    return false;
  }
}
