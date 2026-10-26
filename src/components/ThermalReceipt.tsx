import React from 'react';
import { CampaignSettings, Coupon } from '../types';
import { formatCPF, formatDateTime, maskCPF } from '../utils/formatters';

interface ThermalReceiptProps {
  coupons: Coupon[];
  settings: CampaignSettings;
  isPrintPreview?: boolean;
}

export const ThermalReceipt: React.FC<ThermalReceiptProps> = ({
  coupons,
  settings,
  isPrintPreview = false,
}) => {
  if (!coupons || coupons.length === 0) {
    return null;
  }

  return (
    <div
      className={`font-mono text-black leading-tight select-none ${
        isPrintPreview
          ? 'w-[78mm] max-w-full mx-auto space-y-6 text-xs'
          : 'thermal-receipt-container text-[11px]'
      }`}
    >
      {coupons.map((coupon, idx) => (
        <React.Fragment key={coupon.id || idx}>
          {/* ======================================================== */}
          {/* TICKET 1: VIA DO CLIENTE (A MÁQUINA CORTA AQUI DEPOIS) */}
          {/* ======================================================== */}
          <div
            className={`thermal-ticket-page ${
              isPrintPreview
                ? 'bg-white p-4 shadow-md border-2 border-dashed border-neutral-400 rounded-sm'
                : 'bg-white'
            }`}
          >
            {/* Cabeçalho */}
            <div className="text-center border-b border-black pb-1 mb-2">
              <p className="font-extrabold text-[13px] tracking-wide uppercase">{settings.storeName}</p>
              <p className="font-bold text-[11px] uppercase tracking-wider">{settings.subtitle}</p>
              <p className="font-semibold text-[10px] text-neutral-800 uppercase mt-0.5">
                PROMOÇÃO: {settings.prizeName}
              </p>
            </div>

            {/* Tarja de Identificação da Via */}
            <div className="bg-black text-white text-center py-1 px-1 my-1">
              <span className="text-[10px] uppercase font-bold tracking-wider">
                VIA DO CLIENTE · GUARDE SEU CUPOM
              </span>
            </div>

            {/* Destaque do Número do Cupom */}
            <div className="text-center my-2 p-1 border-2 border-black">
              <span className="text-[10px] block font-bold text-neutral-700">NÚMERO DO SEU CUPOM</span>
              <span className="font-extrabold text-[24px] tracking-widest block tabular-nums">
                {coupon.formattedNumber}
              </span>
            </div>

            {/* Dados do Cliente */}
            <div className="text-[10px] space-y-0.5 border-b border-dashed border-neutral-400 pb-2 mb-2">
              <div className="flex justify-between">
                <span className="font-bold">PARTICIPANTE:</span>
                <span className="text-right font-medium truncate max-w-[170px] uppercase">
                  {coupon.customerName}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="font-bold">CPF:</span>
                <span className="tabular-nums">{maskCPF(coupon.cpf)}</span>
              </div>
              {coupon.customerWhatsapp && (
                <div className="flex justify-between">
                  <span className="font-bold">WHATSAPP:</span>
                  <span className="tabular-nums">{coupon.customerWhatsapp}</span>
                </div>
              )}
              {coupon.customerInstagram && (
                <div className="flex justify-between">
                  <span className="font-bold">INSTAGRAM:</span>
                  <span>{coupon.customerInstagram}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="font-bold">ORIGEM:</span>
                <span className="font-semibold">{coupon.originLabel}</span>
              </div>
              {coupon.physicalPaperNumber && (
                <div className="flex justify-between">
                  <span className="font-bold">TALÃO FÍSICO:</span>
                  <span className="font-bold">{coupon.physicalPaperNumber}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="font-bold">EMISSÃO:</span>
                <span className="tabular-nums">{formatDateTime(coupon.createdAt)}</span>
              </div>
              {coupon.printedAt && (
                <div className="flex justify-between text-[9px] text-neutral-800">
                  <span className="font-bold">IMPRESSO EM:</span>
                  <span className="tabular-nums font-semibold">{formatDateTime(coupon.printedAt)}</span>
                </div>
              )}
              <div className="flex justify-between text-[9px] text-neutral-700 pt-0.5">
                <span>CÓD. VERIFICAÇÃO:</span>
                <span className="font-bold">{coupon.verificationCode}</span>
              </div>
            </div>

            {/* Código de Barras Decorativo */}
            <div className="my-1 text-center">
              <div className="flex justify-center items-center h-6 gap-[2px] overflow-hidden px-2 opacity-90">
                {Array.from({ length: 42 }).map((_, barIdx) => (
                  <div
                    key={barIdx}
                    className="bg-black h-full"
                    style={{
                      width: barIdx % 3 === 0 ? '3px' : barIdx % 5 === 0 ? '4px' : '1.5px',
                      opacity: barIdx % 7 === 0 ? 0.3 : 1,
                    }}
                  />
                ))}
              </div>
              <span className="text-[9px] tracking-widest block text-neutral-800 font-bold mt-0.5">
                *{coupon.verificationCode}*
              </span>
            </div>

            <p className="text-[8.5px] text-center text-neutral-800 mt-1 leading-tight italic">
              Guarde esta via do cliente. Apresentação obrigatória no ato da apuração.
            </p>

            {/* Linha impressa para a guilhotina da Elgin i9 cortar exatamente aqui */}
            <div className="border-t border-b border-dashed border-black py-1 my-1.5 text-center text-[9px] font-bold tracking-widest uppercase">
              ✂ - - CORTE AQUI · SEPARAÇÃO DA GUILHOTINA - - ✂
            </div>

            {/* Espaço de avanço para a lâmina da guilhotina Elgin i9 cortar sem cortar o texto */}
            <div className="h-6 print-only" style={{ height: '14mm' }}></div>
          </div>

          {/* INDICADOR VISUAL NA TELA DE QUE A IMPRESSORA VAI CORTAR AQUI */}
          {isPrintPreview && (
            <div className="text-center py-2 px-3 bg-red-50 border border-red-300 rounded-lg text-red-700 font-sans text-[11px] font-bold flex items-center justify-center gap-2">
              <span>✂ - - - - CORTE DA GUILHOTINA ELGIN i9 (SEPARAÇÃO) - - - - ✂</span>
            </div>
          )}

          {/* ======================================================== */}
          {/* TICKET 2: VIA DA URNA (A MÁQUINA CORTA SEPARADAMENTE) */}
          {/* ======================================================== */}
          <div
            className={`thermal-ticket-page ${
              isPrintPreview
                ? 'bg-neutral-50 p-4 shadow-md border-2 border-dashed border-neutral-400 rounded-sm'
                : 'bg-white'
            }`}
          >
            <div className="text-center border-b border-black pb-1 mb-1.5">
              <p className="font-bold text-[12px] uppercase tracking-wider">{settings.storeName}</p>
              <p className="font-bold text-[10px] uppercase text-black bg-neutral-200 py-0.5 px-1 mt-0.5">
                VIA 2 · DEPOSITAR NA URNA FÍSICA
              </p>
            </div>

            <div className="flex justify-between items-center my-1 px-1 bg-white border border-black">
              <span className="text-[10px] font-bold">CUPOM Nº:</span>
              <span className="font-extrabold text-[20px] tracking-wider tabular-nums">
                {coupon.formattedNumber}
              </span>
            </div>

            <div className="text-[10px] space-y-0.5 mb-2">
              <div>
                <span className="font-bold">PARTICIPANTE: </span>
                <span className="uppercase font-semibold">{coupon.customerName}</span>
              </div>
              <div className="flex justify-between">
                <span>
                  <strong className="font-bold">CPF: </strong>
                  <span className="tabular-nums">{formatCPF(coupon.cpf)}</span>
                </span>
                {coupon.customerWhatsapp && (
                  <span>
                    <strong className="font-bold">TEL: </strong>
                    <span className="tabular-nums">{coupon.customerWhatsapp}</span>
                  </span>
                )}
              </div>
              {coupon.customerInstagram && (
                <div>
                  <span className="font-bold">INSTA: </span>
                  <span>{coupon.customerInstagram}</span>
                </div>
              )}
              <div className="flex justify-between text-[9px] text-neutral-700 pt-0.5">
                <span>MOTIVO: {coupon.originLabel}</span>
                <span>{coupon.verificationCode}</span>
              </div>
            </div>

            {/* Campo Oficial de Assinatura */}
            <div className="mt-3 pt-2 text-center border-t border-neutral-300">
              <div className="border-b-2 border-black w-full mb-1"></div>
              <span className="text-[9.5px] font-bold block uppercase tracking-wide">
                ASSINATURA DO PARTICIPANTE
              </span>
            </div>

            <div className="mt-2 text-[8.5px] text-center text-neutral-700 font-semibold border-t border-dotted border-neutral-400 pt-1">
              [ ] Conferido no balcão e depositado na urna oficial
            </div>

            {/* Linha impressa para corte de separação da guilhotina */}
            <div className="border-t border-b border-dashed border-black py-1 my-1.5 text-center text-[9px] font-bold tracking-widest uppercase">
              ✂ - - FIM DO CUPOM · CORTE DA GUILHOTINA - - ✂
            </div>

            {/* Espaço de avanço para a lâmina da guilhotina cortar após a urna */}
            <div className="h-6 print-only" style={{ height: '14mm' }}></div>
          </div>

          {/* Separador entre cupons diferentes se for mais de um na visualização */}
          {isPrintPreview && idx < coupons.length - 1 && (
            <div className="border-b-2 border-neutral-300 my-4"></div>
          )}
        </React.Fragment>
      ))}
    </div>
  );
};
