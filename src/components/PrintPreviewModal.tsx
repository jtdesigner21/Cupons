import React from 'react';
import { X, Printer, FileDown, Info } from 'lucide-react';
import { CampaignSettings, Coupon } from '../types';
import { ThermalReceipt } from './ThermalReceipt';
import { formatDateTime, maskCPF } from '../utils/formatters';

interface PrintPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  coupons: Coupon[];
  settings: CampaignSettings;
  onConfirmPrint: () => void;
  purchaseTitle?: string;
}

export const PrintPreviewModal: React.FC<PrintPreviewModalProps> = ({
  isOpen,
  onClose,
  coupons,
  settings,
  onConfirmPrint,
  purchaseTitle,
}) => {
  if (!isOpen || coupons.length === 0) return null;

  const first = coupons[0];
  const last = coupons[coupons.length - 1];

  const handleSaveAsPDF = () => {
    // No navegador Chrome/Edge, window.print() com destino 'Salvar como PDF'
    onConfirmPrint();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-2xl text-white overflow-hidden shadow-2xl relative my-8 max-h-[92vh] flex flex-col">
        {/* Topo do Modal */}
        <div className="p-4 px-6 border-b border-neutral-800 bg-neutral-950 flex items-center justify-between shrink-0">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Printer className="w-5 h-5 text-red-500" />
              Comprovante / PDF de Impressão · Elgin i9
            </h3>
            <p className="text-xs text-neutral-400 mt-0.5">
              {purchaseTitle || `Compra de ${first.customerName}`} · {coupons.length}{' '}
              {coupons.length === 1 ? 'cupom' : 'cupons'} ({first.formattedNumber}
              {coupons.length > 1 ? ` até ${last.formattedNumber}` : ''})
            </p>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Resumo do Atendimento / Compra */}
        <div className="bg-neutral-950/70 border-b border-neutral-800 px-6 py-3 flex flex-wrap items-center justify-between gap-3 text-xs shrink-0">
          <div>
            <span className="text-neutral-400 block text-[11px]">Participante:</span>
            <strong className="text-white uppercase font-bold">{first.customerName}</strong>
          </div>
          <div>
            <span className="text-neutral-400 block text-[11px]">CPF:</span>
            <span className="font-mono text-neutral-200">{maskCPF(first.cpf)}</span>
          </div>
          <div>
            <span className="text-neutral-400 block text-[11px]">Data da Compra:</span>
            <span className="font-mono text-neutral-200">{formatDateTime(first.createdAt)}</span>
          </div>
          <div>
            <span className="text-neutral-400 block text-[11px]">Status:</span>
            {first.printedAt ? (
              <span className="text-emerald-400 font-bold font-mono">
                ✓ Impresso ({formatDateTime(first.printedAt)})
              </span>
            ) : (
              <span className="text-amber-400 font-bold font-mono">
                ⏳ Pendente (Valida ao imprimir)
              </span>
            )}
          </div>
          <div>
            <span className="text-neutral-400 block text-[11px]">Vias a Imprimir:</span>
            <span className="text-red-400 font-bold font-mono">
              {coupons.length * 2} vias (Cliente + Urna)
            </span>
          </div>
        </div>

        {/* Dica da Impressora Elgin i9 */}
        <div className="bg-neutral-800/80 px-6 py-2.5 text-xs text-neutral-300 flex items-center gap-2 border-b border-neutral-700/60 shrink-0">
          <Info className="w-4 h-4 text-amber-400 shrink-0" />
          <span>
            <strong>Separação Automática Elgin i9:</strong> A máquina corta automaticamente a{' '}
            <strong>Via do Cliente</strong> e em seguida corta a <strong>Via da Urna</strong>,
            saindo ambas já cortadas e separadas da máquina!
          </span>
        </div>

        {/* Visualização da Bobina Térmica */}
        <div className="p-6 overflow-y-auto bg-neutral-950/50 flex-1 flex justify-center">
          <div className="w-[82mm] bg-white rounded-md shadow-2xl p-2 text-black">
            <ThermalReceipt coupons={coupons} settings={settings} isPrintPreview={true} />
          </div>
        </div>

        {/* Rodapé com Ações */}
        <div className="p-4 px-6 border-t border-neutral-800 bg-neutral-950 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-neutral-400 hover:text-white transition-colors"
          >
            Fechar
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                handleSaveAsPDF();
                onClose();
              }}
              title="Abre a janela para salvar em arquivo PDF 80mm"
              className="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-lg border border-neutral-700 transition-colors"
            >
              <FileDown className="w-4 h-4 text-neutral-300" />
              Salvar como PDF
            </button>

            <button
              onClick={() => {
                onConfirmPrint();
                onClose();
              }}
              className="inline-flex items-center gap-2 px-6 py-2.5 text-xs font-extrabold uppercase tracking-wider bg-red-600 hover:bg-red-500 text-white rounded-lg shadow-md transition-all active:scale-95"
            >
              <Printer className="w-4 h-4" />
              {first.printedAt ? 'Reimprimir na Elgin i9' : 'Imprimir e Validar na Elgin i9'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
