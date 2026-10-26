import { CampaignSettings, Coupon, Customer } from '../types';
import {
  loadCustomers as loadLocalCustomers,
  saveCustomers as saveLocalCustomers,
  loadCoupons as loadLocalCoupons,
  saveCoupons as saveLocalCoupons,
  loadSettings as loadLocalSettings,
  saveSettings as saveLocalSettings,
  resetDatabase as resetLocalDatabase,
} from '../utils/storage';

export interface ServerSyncResult {
  customers: Customer[];
  coupons: Coupon[];
  settings: CampaignSettings | null;
  nextNumber: number;
  serverOnline: boolean;
}

export interface HealthInfo {
  status: string;
  totalCustomers: number;
  totalCoupons: number;
  nextNumber: number;
  storageFile?: string;
  lastUpdated?: string;
}

/**
 * Carrega todos os dados do servidor com mesclagem segura bidirecional.
 * NUNCA apaga dados locais com lista vazia do servidor.
 * Se o navegador tiver registros e o servidor estiver vazio, sincroniza para o servidor.
 */
export async function syncWithServer(): Promise<ServerSyncResult | null> {
  try {
    const res = await fetch('/api/data', { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    if (data.success) {
      const localCust = loadLocalCustomers();
      const localCoup = loadLocalCoupons();

      // Mesclagem segura de clientes (CPF único, nunca perde dados)
      const custMap = new Map<string, Customer>();
      localCust.forEach((c) => custMap.set(c.cpf, c));
      if (Array.isArray(data.customers)) {
        data.customers.forEach((c: Customer) => {
          if (!custMap.has(c.cpf)) {
            custMap.set(c.cpf, c);
          } else {
            const prev = custMap.get(c.cpf)!;
            custMap.set(c.cpf, {
              ...prev,
              ...c,
              firstVisitGranted: prev.firstVisitGranted || c.firstVisitGranted,
              instagramGranted: prev.instagramGranted || c.instagramGranted,
            });
          }
        });
      }
      const finalCustomers = Array.from(custMap.values());

      // Mesclagem segura de cupons (ID único)
      const coupMap = new Map<string, Coupon>();
      localCoup.forEach((c) => coupMap.set(c.id, c));
      if (Array.isArray(data.coupons)) {
        data.coupons.forEach((c: Coupon) => {
          if (!coupMap.has(c.id)) {
            coupMap.set(c.id, c);
          } else {
            const prev = coupMap.get(c.id)!;
            coupMap.set(c.id, {
              ...prev,
              printedAt: prev.printedAt || c.printedAt,
            });
          }
        });
      }
      const finalCoupons = Array.from(coupMap.values());

      // Persiste localmente a base completa mesclada
      saveLocalCustomers(finalCustomers);
      saveLocalCoupons(finalCoupons);

      if (data.settings) {
        saveLocalSettings(data.settings);
      }

      const calculatedNext = Math.max(
        typeof data.nextNumber === 'number' ? data.nextNumber : 1,
        ...finalCoupons.map((c) => Number(c.number) + 1),
        1
      );
      localStorage.setItem('sj_cupons_next_seq_v1', calculatedNext.toString());

      // Se havia dados no navegador que o servidor não tinha, sobe imediatamente
      const serverCustCount = Array.isArray(data.customers) ? data.customers.length : 0;
      const serverCoupCount = Array.isArray(data.coupons) ? data.coupons.length : 0;
      if (finalCustomers.length > serverCustCount || finalCoupons.length > serverCoupCount) {
        restoreServerBackup({
          customers: finalCustomers,
          coupons: finalCoupons,
          settings: data.settings || loadLocalSettings(),
          nextNumber: calculatedNext,
        }).catch((err) => console.warn('Erro ao sincronizar dados locais para o servidor:', err));
      }

      return {
        customers: finalCustomers,
        coupons: finalCoupons,
        settings: data.settings,
        nextNumber: calculatedNext,
        serverOnline: true,
      };
    }
    return null;
  } catch (err) {
    console.warn('[Sync] Servidor indisponível ou em inicialização, usando dados locais:', err);
    return null;
  }
}

/**
 * Salva o cliente no servidor de forma persistente e no cache local
 */
export async function saveCustomerToServer(customer: Customer): Promise<boolean> {
  try {
    const res = await fetch('/api/customers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customer }),
    });
    return res.ok;
  } catch (err) {
    console.error('[API] Falha ao salvar cliente no servidor:', err);
    return false;
  }
}

/**
 * Salva novo lote de cupons e cliente associado no servidor
 */
export async function saveCouponsToServer(
  newCoupons: Coupon[],
  customer?: Customer
): Promise<boolean> {
  try {
    const res = await fetch('/api/coupons', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ newCoupons, customer }),
    });
    return res.ok;
  } catch (err) {
    console.error('[API] Falha ao salvar cupons no servidor:', err);
    return false;
  }
}

/**
 * Marca lista de cupons como impressos no servidor
 */
export async function markCouponsAsPrintedOnServer(
  couponIds: string[],
  timestamp?: string
): Promise<boolean> {
  try {
    const res = await fetch('/api/coupons/mark-printed', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ couponIds, timestamp }),
    });
    return res.ok;
  } catch (err) {
    console.error('[API] Falha ao marcar cupons impressos no servidor:', err);
    return false;
  }
}

/**
 * Salva configurações da campanha no servidor
 */
export async function saveSettingsToServer(settings: CampaignSettings): Promise<boolean> {
  try {
    const res = await fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ settings }),
    });
    return res.ok;
  } catch (err) {
    console.error('[API] Falha ao salvar configurações no servidor:', err);
    return false;
  }
}

/**
 * Zera o banco de dados no servidor e localmente
 */
export async function resetServerDatabase(): Promise<boolean> {
  try {
    resetLocalDatabase();
    const res = await fetch('/api/reset', { method: 'POST' });
    return res.ok;
  } catch (err) {
    console.error('[API] Falha ao resetar banco no servidor:', err);
    return false;
  }
}

/**
 * Restaura backup completo no servidor
 */
export async function restoreServerBackup(data: {
  customers: Customer[];
  coupons: Coupon[];
  settings?: CampaignSettings;
  nextNumber?: number;
}): Promise<boolean> {
  try {
    const res = await fetch('/api/backup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return res.ok;
  } catch (err) {
    console.error('[API] Falha ao restaurar backup no servidor:', err);
    return false;
  }
}

/**
 * Consulta a saúde e os totais salvos no servidor
 */
export async function fetchServerHealth(): Promise<HealthInfo | null> {
  try {
    const res = await fetch('/api/health');
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}
