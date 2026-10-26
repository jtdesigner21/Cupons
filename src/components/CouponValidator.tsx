import React, { useState } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  Search,
  CheckCircle2,
  XCircle,
  Eye,
  EyeOff,
  Printer,
  RotateCcw,
  User,
  Clock,
  Sparkles,
  ShoppingBag,
  Ticket,
} from 'lucide-react';
import { CampaignSettings, Coupon, PurchaseBatch } from '../types';
import { formatCPF, formatDateTime, formatPhone, maskCPF, cleanDigits } from '../utils/formatters';

interface CouponValidatorProps {
  coupons: Coupon[];
  settings: CampaignSettings;
  onOpenPurchasePDF?: (batch: PurchaseBatch) => void;
  onReprintCoupon?: (coupon: Coupon) => void;
}

export const CouponValidator: React.FC<CouponValidatorProps> = ({
  coupons,
  settings,
  onOpenPurchasePDF,
  onReprintCoupon,
}) => {
  const [codeInput, setCodeInput] = useState('');
  const [searched, setSearched] = useState(false);
  const [matchedCoupon, setMatchedCoupon] = useState<Coupon | null>(null);
  const [revealCpf, setRevealCpf] = useState(false);
  const [checkedHistory, setCheckedHistory] = useState<
    { coupon: Coupon; status: 'valid' | 'invalid'; timestamp: string }[]
  >([]);

  const handleValidate = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const query = codeInput.trim().toUpperCase().replace(/[*]/g, '');

    if (!query) return;

    setSearched(true);
    setRevealCpf(false);

    // Limpa pontuações para busca flexível
    const cleanQuery = query.replace(/[^A-Z0-9]/g, '');

    // Busca por código exato, código sem traços, número do cupom (#0001 ou 1) ou talão físico
    const found = coupons.find((c) => {
      const codeUpper = c.verificationCode.toUpperCase();
      const codeClean = codeUpper.replace(/[^A-Z0-9]/g, '');
      const numStr = c.number.toString();
      const formattedNum = c.formattedNumber.toUpperCase();

      // 1. Bate com código completo ou sem traços
      if (codeUpper === query || codeClean === cleanQuery) return true;

      // 2. Bate com o número (#0001 ou 1) caso a busca seja pelo número
      if (formattedNum === query || numStr === query) return true;

      // 3. Bate com a parte final do hash do código (ex: A48F)
      const parts = codeUpper.split('-');
      const lastPart = parts[parts.length - 1];
      if (lastPart && query === lastPart) return true;

      // 4. Talão físico se houver
      if (c.physicalPaperNumber && c.physicalPaperNumber.toUpperCase() === query) return true;

      return false;
    });

    if (found) {
      setMatchedCoupon(found);
      setCheckedHistory((prev) => [
        { coupon: found, status: 'valid', timestamp: new Date().toLocaleTimeString('pt-BR') },
        ...prev.slice(0, 9),
      ]);
    } else {
      setMatchedCoupon(null);
    }
  };

  const handleClear = () => {
    setCodeInput('');
    setSearched(false);
    setMatchedCoupon(null);
    setRevealCpf(false);
  };

  return (
    <div className="space-y-6">
      {/* CARD PRINCIPAL DO VALIDADOR */}
      <div className="bg-white border border-neutral-200 rounded-xl shadow-xs overflow-hidden">
        {/* Cabeçalho */}
        <div className="p-6 border-b border-neutral-200 bg-neutral-50/70 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="p-2.5 bg-emerald-100 text-emerald-700 rounded-xl mt-0.5">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-neutral-900">
                Checagem e Auditoria de Autenticidade do Cupom
              </h2>
              <p className="text-xs text-neutral-500 mt-0.5">
                Valide se o canhoto retirado da urna física realmente foi emitido por este sistema
              </p>
            </div>
          </div>

          <div className="text-xs text-neutral-500 bg-white px-3 py-1.5 rounded-lg border border-neutral-200 shrink-0">
            Base oficial: <strong className="text-neutral-900">{coupons.length}</strong> cupons emitidos
          </div>
        </div>

        {/* Formulário de Busca e Scanner */}
        <div className="p-6 space-y-6">
          <form onSubmit={handleValidate} className="space-y-3">
            <label className="block text-xs font-bold uppercase tracking-wider text-neutral-700">
              Digite o Código de Autenticidade ou Número do Cupom:
            </label>

            <div className="flex flex-col sm:flex-row items-center gap-3">
              <div className="relative flex-1 w-full">
                <input
                  type="text"
                  autoFocus
                  placeholder="Ex: SJ-A1M-0001-A48F ou digite o número #0001"
                  value={codeInput}
                  onChange={(e) => setCodeInput(e.target.value)}
                  className="w-full px-4 py-3.5 text-base font-mono font-bold rounded-xl border border-neutral-300 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 outline-hidden tracking-wider uppercase placeholder:normal-case placeholder:font-normal placeholder:text-sm"
                />
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button
                  type="submit"
                  disabled={!codeInput.trim()}
                  className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-6 py-3.5 text-sm font-extrabold uppercase tracking-wider bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl shadow-xs hover:shadow-md transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Search className="w-4 h-4" />
                  Verificar Cupom
                </button>

                {searched && (
                  <button
                    type="button"
                    onClick={handleClear}
                    className="p-3.5 text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 rounded-xl border border-neutral-200 transition-colors"
                    title="Limpar busca"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            <p className="text-[11px] text-neutral-400">
              Dica: Você também pode usar um leitor de código de barras USB/Bluetooth apontando para o cupom.
            </p>
          </form>

          {/* RESULTADO DA CHECAGEM */}
          {searched && (
            <div className="pt-2 animate-in fade-in slide-in-from-top-2">
              {matchedCoupon ? (
                /* CUPOM VÁLIDO E CONFIRMADO */
                <div className="border-2 border-emerald-500 bg-emerald-50/40 rounded-2xl p-6 shadow-sm space-y-6">
                  {/* Status Banner */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-emerald-200">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0">
                        <CheckCircle2 className="w-6 h-6" />
                      </div>
                      <div>
                        <h3 className="text-base font-extrabold text-emerald-950 uppercase tracking-tight">
                          Cupom 100% Autêntico e Confirmado no Sistema
                        </h3>
                        <p className="text-xs text-emerald-800">
                          Este cupom foi gerado oficialmente neste terminal para o sorteio{' '}
                          <strong>{settings.prizeName}</strong>.
                        </p>
                      </div>
                    </div>

                    <span className="text-xs font-mono font-bold bg-emerald-200/80 text-emerald-900 px-3 py-1 rounded-full uppercase tracking-wider shrink-0 self-start sm:self-auto">
                      Autenticidade Verificada
                    </span>
                  </div>

                  {/* Destaque do Cupom */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-white p-4 rounded-xl border border-emerald-200 text-center">
                      <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider block">
                        Número Oficial
                      </span>
                      <span className="text-3xl font-extrabold font-mono text-neutral-900 tabular-nums mt-1 block">
                        {matchedCoupon.formattedNumber}
                      </span>
                    </div>

                    <div className="bg-white p-4 rounded-xl border border-emerald-200 text-center">
                      <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider block">
                        Código de Verificação
                      </span>
                      <span className="text-sm font-bold font-mono text-emerald-800 mt-2 block break-all">
                        {matchedCoupon.verificationCode}
                      </span>
                    </div>

                    <div className="bg-white p-4 rounded-xl border border-emerald-200 text-center">
                      <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider block">
                        Data/Hora da Emissão
                      </span>
                      <span className="text-sm font-bold font-mono text-neutral-800 mt-2 block">
                        {formatDateTime(matchedCoupon.createdAt)}
                      </span>
                    </div>

                    <div className="bg-white p-4 rounded-xl border border-emerald-200 text-center">
                      <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider block">
                        Status de Impressão
                      </span>
                      <span className="text-xs font-bold font-mono mt-2 block">
                        {matchedCoupon.printedAt ? (
                          <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 inline-block">
                            ✓ Impresso em {formatDateTime(matchedCoupon.printedAt)}
                          </span>
                        ) : (
                          <span className="text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-300 inline-block">
                            ⏳ Pendente de Impressão
                          </span>
                        )}
                      </span>
                    </div>
                  </div>

                  {/* Dados Completos do Participante para Conferência */}
                  <div className="bg-white p-5 rounded-xl border border-emerald-200 space-y-3">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-600 border-b border-neutral-100 pb-2">
                      Dados Cadastrados do Participante (Conferir com Documento):
                    </h4>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                      <div>
                        <span className="text-neutral-500 block text-[11px]">Nome Completo:</span>
                        <strong className="text-sm font-extrabold text-neutral-900 uppercase block mt-0.5">
                          {matchedCoupon.customerName}
                        </strong>
                      </div>

                      <div>
                        <span className="text-neutral-500 block text-[11px]">CPF do Titular:</span>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-sm font-mono font-bold text-neutral-900">
                            {revealCpf ? formatCPF(matchedCoupon.cpf) : maskCPF(matchedCoupon.cpf)}
                          </span>
                          <button
                            type="button"
                            onClick={() => setRevealCpf(!revealCpf)}
                            title={revealCpf ? 'Ocultar CPF' : 'Revelar CPF completo para conferência'}
                            className="text-neutral-400 hover:text-neutral-700"
                          >
                            {revealCpf ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </div>

                      <div>
                        <span className="text-neutral-500 block text-[11px]">WhatsApp / Contato:</span>
                        <span className="text-sm font-mono font-semibold text-neutral-900 block mt-0.5">
                          {matchedCoupon.customerWhatsapp ? formatPhone(matchedCoupon.customerWhatsapp) : 'Não informado'}
                        </span>
                      </div>

                      <div>
                        <span className="text-neutral-500 block text-[11px]">Instagram:</span>
                        <span className="text-sm font-semibold text-pink-600 block mt-0.5">
                          {matchedCoupon.customerInstagram || 'Não informado'}
                        </span>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-neutral-100 flex flex-wrap items-center justify-between gap-3 text-xs">
                      <div>
                        <span className="text-neutral-500">Motivo / Origem do Cupom: </span>
                        <strong className="text-neutral-800">{matchedCoupon.originLabel}</strong>
                        {matchedCoupon.physicalPaperNumber && (
                          <span className="ml-2 text-neutral-500 font-mono">
                            (Nº no Talão Físico: {matchedCoupon.physicalPaperNumber})
                          </span>
                        )}
                      </div>

                      {onReprintCoupon && (
                        <button
                          type="button"
                          onClick={() => onReprintCoupon(matchedCoupon)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-neutral-700 bg-neutral-100 hover:bg-neutral-200 rounded-lg transition-colors"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          Reimprimir Este Cupom na Elgin
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                /* CUPOM NÃO ENCONTRADO / ALERTA DE FRAUDE */
                <div className="border-2 border-red-500 bg-red-50/50 rounded-2xl p-6 shadow-sm space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-red-600 text-white flex items-center justify-center shrink-0 mt-0.5">
                      <XCircle className="w-6 h-6" />
                    </div>
                    <div className="space-y-1">
                      <h3 className="text-base font-extrabold text-red-950 uppercase tracking-tight">
                        CUPOM NÃO ENCONTRADO OU CÓDIGO INVÁLIDO ⚠️
                      </h3>
                      <p className="text-xs text-red-900 leading-relaxed">
                        O código ou número <strong>"{codeInput.toUpperCase()}"</strong>{' '}
                        <strong>NÃO CONSTA</strong> no banco de dados oficial deste sistema.
                      </p>
                      <p className="text-xs text-red-700">
                        Motivos possíveis: o cupom pode ter sido rasurado, o número digitado está
                        incorreto ou este cupom não foi gerado neste terminal.
                      </p>
                    </div>
                  </div>

                  <div className="p-3 bg-white rounded-xl border border-red-200 text-xs text-neutral-600">
                    <strong>Orientação para a Apuração:</strong> Caso o participante apresente um cupom
                    não reconhecido, solicite o comprovante oficial do cliente (Via 1) ou verifique o
                    CPF do participante na aba <strong>Cadastrados & Compras</strong>.
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* HISTÓRICO DE VALIDAÇÕES DA SESSÃO */}
      {checkedHistory.length > 0 && (
        <div className="bg-white border border-neutral-200 rounded-xl p-5 shadow-xs">
          <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-500 mb-3">
            Cupons Verificados Recentemente Nesta Sessão
          </h4>
          <div className="divide-y divide-neutral-100 text-xs">
            {checkedHistory.map((item, idx) => (
              <div key={idx} className="py-2.5 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <span className="font-mono font-bold bg-neutral-100 px-2 py-0.5 rounded text-neutral-900">
                    {item.coupon.formattedNumber}
                  </span>
                  <div>
                    <span className="font-bold text-neutral-900 uppercase">
                      {item.coupon.customerName}
                    </span>
                    <span className="text-neutral-500 text-[11px] block font-mono">
                      Cód: {item.coupon.verificationCode}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 text-[11px]">
                    ✓ Válido às {item.timestamp}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
