import React, { useState } from 'react';
import { X, Settings as SettingsIcon, Save, RotateCcw, Printer, HelpCircle } from 'lucide-react';
import { CampaignSettings } from '../types';
import { DEFAULT_SETTINGS, saveSettings } from '../utils/storage';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: CampaignSettings;
  onSave: (newSettings: CampaignSettings) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onSave,
}) => {
  const [form, setForm] = useState<CampaignSettings>(settings);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveSettings(form);
    onSave(form);
    onClose();
  };

  const handleResetDefaults = () => {
    if (confirm('Restaurar todas as configurações para o padrão da Loja SJ?')) {
      setForm(DEFAULT_SETTINGS);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl w-full max-w-xl text-neutral-900 overflow-hidden shadow-2xl relative my-8">
        {/* Topo */}
        <div className="p-5 border-b border-neutral-200 bg-neutral-50 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-red-100 text-red-600 rounded-lg">
              <SettingsIcon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-neutral-900">Configurações da Campanha</h3>
              <p className="text-xs text-neutral-500">
                Ajuste os textos do cupom e as regras de concessão
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-neutral-400 hover:text-neutral-700 rounded-lg hover:bg-neutral-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          {/* Identificação */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-neutral-700 mb-1">Nome da Loja</label>
              <input
                type="text"
                value={form.storeName}
                onChange={(e) => setForm({ ...form, storeName: e.target.value })}
                className="w-full px-3 py-2 text-sm rounded-lg border border-neutral-300 focus:border-red-500 outline-hidden font-medium"
                required
              />
            </div>
            <div>
              <label className="block font-bold text-neutral-700 mb-1">Prêmio da Campanha</label>
              <input
                type="text"
                value={form.prizeName}
                onChange={(e) => setForm({ ...form, prizeName: e.target.value })}
                className="w-full px-3 py-2 text-sm rounded-lg border border-neutral-300 focus:border-red-500 outline-hidden font-medium"
                required
              />
            </div>
          </div>

          <div>
            <label className="block font-bold text-neutral-700 mb-1">Subtítulo / Promoção</label>
            <input
              type="text"
              value={form.subtitle}
              onChange={(e) => setForm({ ...form, subtitle: e.target.value })}
              className="w-full px-3 py-2 text-sm rounded-lg border border-neutral-300 focus:border-red-500 outline-hidden"
              required
            />
          </div>

          {/* Regras de Bonificação */}
          <div className="pt-3 border-t border-neutral-200">
            <span className="font-bold text-neutral-900 uppercase tracking-wider block mb-3 text-[11px]">
              Regras de Cupons Automáticos
            </span>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-neutral-700 mb-1">
                  Compra Mínima para Cupom (R$)
                </label>
                <input
                  type="number"
                  min="1"
                  value={form.minPurchaseValue ?? 60}
                  onChange={(e) =>
                    setForm({ ...form, minPurchaseValue: parseInt(e.target.value, 10) || 60 })
                  }
                  className="w-full px-3 py-2 text-sm rounded-lg border border-neutral-300 focus:border-red-500 outline-hidden font-mono"
                  required
                />
                <span className="text-[10px] text-neutral-500 mt-0.5 block">
                  Padrão: R$ 60 (com R$ 60 já ganha 1 cupom)
                </span>
              </div>

              <div>
                <label className="block font-semibold text-neutral-700 mb-1">
                  Valor por Cupom em Compras (R$)
                </label>
                <input
                  type="number"
                  min="1"
                  value={form.purchaseValueStep ?? 60}
                  onChange={(e) =>
                    setForm({ ...form, purchaseValueStep: parseInt(e.target.value, 10) || 60 })
                  }
                  className="w-full px-3 py-2 text-sm rounded-lg border border-neutral-300 focus:border-red-500 outline-hidden font-mono"
                  required
                />
                <span className="text-[10px] text-neutral-500 mt-0.5 block">
                  Padrão: +1 cupom a cada R$ 60 gastos
                </span>
              </div>

              <div>
                <label className="block font-semibold text-neutral-700 mb-1">
                  Máximo de Cupons por Compra
                </label>
                <input
                  type="number"
                  min="1"
                  value={form.maxPurchaseCoupons ?? 10}
                  onChange={(e) =>
                    setForm({ ...form, maxPurchaseCoupons: parseInt(e.target.value, 10) || 10 })
                  }
                  className="w-full px-3 py-2 text-sm rounded-lg border border-neutral-300 focus:border-red-500 outline-hidden font-mono"
                  required
                />
                <span className="text-[10px] text-neutral-500 mt-0.5 block">
                  Padrão: 10 cupons no máximo por compra
                </span>
              </div>

              <div>
                <label className="block font-semibold text-neutral-700 mb-1">
                  Cupons na Compra de Impressora
                </label>
                <input
                  type="number"
                  min="1"
                  value={form.printerBonusCoupons}
                  onChange={(e) =>
                    setForm({ ...form, printerBonusCoupons: parseInt(e.target.value, 10) || 10 })
                  }
                  className="w-full px-3 py-2 text-sm rounded-lg border border-neutral-300 focus:border-red-500 outline-hidden font-mono"
                  required
                />
                <span className="text-[10px] text-neutral-500 mt-0.5 block">
                  Padrão: 10 cupons por impressora 3D
                </span>
              </div>

              <div>
                <label className="block font-semibold text-neutral-700 mb-1">
                  Cupons Grátis de 1ª Visita
                </label>
                <input
                  type="number"
                  min="0"
                  value={form.visitCouponCount}
                  onChange={(e) =>
                    setForm({ ...form, visitCouponCount: parseInt(e.target.value, 10) || 0 })
                  }
                  className="w-full px-3 py-2 text-sm rounded-lg border border-neutral-300 focus:border-red-500 outline-hidden font-mono"
                  required
                />
                <span className="text-[10px] text-neutral-500 mt-0.5 block">
                  Padrão: 2 cupons (limite 1x por CPF)
                </span>
              </div>

              <div>
                <label className="block font-semibold text-neutral-700 mb-1">
                  Cupons Grátis de Instagram
                </label>
                <input
                  type="number"
                  min="0"
                  value={form.instagramCouponCount}
                  onChange={(e) =>
                    setForm({ ...form, instagramCouponCount: parseInt(e.target.value, 10) || 0 })
                  }
                  className="w-full px-3 py-2 text-sm rounded-lg border border-neutral-300 focus:border-red-500 outline-hidden font-mono"
                  required
                />
                <span className="text-[10px] text-neutral-500 mt-0.5 block">
                  Padrão: 1 cupom (Total grátis: 3 por CPF)
                </span>
              </div>
            </div>
            <div className="mt-2 text-[10px] text-emerald-800 font-semibold bg-emerald-50 p-2.5 rounded-lg border border-emerald-200">
              ✓ <strong>Regras da Campanha:</strong> Compra mínima de R$ {form.minPurchaseValue ?? 60} para gerar cupom · Cada R$ {form.purchaseValueStep ?? 60} = 1 cupom (limite máximo de {form.maxPurchaseCoupons ?? 10} cupons por compra) · 3 cupons grátis por CPF (2 visita + 1 Instagram).
            </div>
          </div>

          {/* Dica da Impressora Elgin i9 */}
          <div className="p-3 bg-neutral-100 rounded-lg space-y-1 text-neutral-700">
            <div className="font-bold flex items-center gap-1 text-neutral-900">
              <Printer className="w-3.5 h-3.5" />
              Configuração no Elgin Utility / Windows:
            </div>
            <p className="text-[11px] leading-relaxed">
              • Formato de Papel: <strong>80(72) x 297 mm</strong> ou <strong>80mm Continuous Roll</strong>.
              <br />
              • No navegador ao imprimir: selecionar <strong>Margens: Nenhuma</strong> e desmarcar <strong>Cabeçalhos e rodapés</strong>.
            </p>
          </div>

          {/* Ações */}
          <div className="pt-4 border-t border-neutral-200 flex items-center justify-between">
            <button
              type="button"
              onClick={handleResetDefaults}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-neutral-600 hover:text-neutral-900 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Restaurar Padrões
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-neutral-600 hover:text-neutral-900"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-500 rounded-lg shadow-xs transition-colors"
              >
                <Save className="w-3.5 h-3.5" />
                Salvar Configurações
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
