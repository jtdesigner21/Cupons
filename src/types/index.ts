export type CouponOrigin = 'visit' | 'instagram' | 'printer' | 'purchase' | 'manual';

export interface Customer {
  cpf: string; // 11 digits unformatted
  name: string;
  whatsapp: string;
  instagram: string;
  firstVisitGranted: boolean;
  instagramGranted: boolean;
  createdAt: string;
  updatedAt?: string;
  notes?: string;
}

export interface Coupon {
  id: string;
  number: number; // sequential number: 1, 2, 3...
  formattedNumber: string; // "#0001", "#0042"
  batchId: string;
  cpf: string;
  customerName: string;
  customerWhatsapp: string;
  customerInstagram: string;
  origin: CouponOrigin;
  originLabel: string;
  purchaseAmount?: number;
  printerCount?: number;
  physicalPaperNumber?: string;
  verificationCode: string;
  createdAt: string;
  printedAt?: string;
}

export interface CampaignSettings {
  campaignName: string;
  storeName: string;
  prizeName: string;
  subtitle: string;
  visitCouponCount: number;
  instagramCouponCount: number;
  purchaseValueStep: number; // e.g. 100 for +1 cupom a cada R$ 100
  minPurchaseValue: number; // e.g. 60 for Compra mínima de R$ 60 para ganhar cupom
  maxPurchaseCoupons: number; // e.g. 10 for Máximo 10 cupons por compra
  printerBonusCoupons: number; // e.g. 10 for each 3D printer
  drawDateNotice: string;
  socialHandle: string;
  autoCutPaper: boolean;
}

export interface PurchaseBatch {
  batchId: string;
  cpf: string;
  customerName: string;
  customerWhatsapp: string;
  customerInstagram: string;
  createdAt: string;
  coupons: Coupon[];
  summary: string;
  totalCoupons: number;
  totalAmount?: number;
  printerCount?: number;
  startNumber: string;
  endNumber: string;
  printedCount: number;
  isFullyPrinted: boolean;
  hasPendingPrint: boolean;
}

export interface BatchGenerationSummary {
  visitCoupons: number;
  instagramCoupons: number;
  printerCoupons: number;
  purchaseCoupons: number;
  manualCoupons: number;
  totalCoupons: number;
}
