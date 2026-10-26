import React, { useState, useEffect, useMemo } from 'react';
import {
  Sparkles,
  Printer,
  ShoppingBag,
  Instagram,
  Receipt,
  Eye,
  RotateCcw,
  Plus,
  Minus,
  CheckCircle2,
  Hash,
  Save,
  AlertTriangle,
  ShieldAlert,
  ShieldCheck,
  Clock,
  Lock,
  UserCheck,
} from 'lucide-react';
import { CampaignSettings, Coupon, Customer } from '../types';
import {
  cleanDigits,
  formatCPF,
  formatPhone,
  formatInstagram,
  isValidCPF,
  generateVerificationCode,
  formatCouponNumber,
} from '../utils/formatters';
import { incrementCouponNumberBy } from '../utils/storage';

interface PDVFormProps {
  settings: CampaignSettings;
  customers: Customer[];
  coupons: Coupon[];
  onSaveCustomer: (customer: Customer) => void;
  onGenerateCoupons: (newCoupons: Coupon[], customer: Customer, printImmediately?: boolean) => void;
  onOpenPreview: (previewCoupons: Coupon[]) => void;
}

export const PDVForm: React.FC<PDVFormProps> = ({
  settings,
  customers,
  coupons,
  onSaveCustomer,
  onGenerateCoupons,
  onOpenPreview,
}) => {
  // Dados do Cliente
  const [cpfInput, setCpfInput] = useState('');
  const [nameInput, setNameInput] = useState('');
  const [phoneInput, setPhoneInput] = useState('');
  const [instaInput, setInstaInput] = useState('');
  const [physicalPaperNumber, setPhysicalPaperNumber] = useState('');

  // Bonificações e Regras
  const [grantVisit, setGrantVisit] = useState(false);
  const [grantInstagram, setGrantInstagram] = useState(false);
  const [printerCount, setPrinterCount] = useState(0);
  const [purchaseAmount, setPurchaseAmount] = useState<number | ''>('');
  const [manualCount, setManualCount] = useState(0);

  // Status de busca do cliente
  const [existingCustomer, setExistingCustomer] = useState<Customer | null>(null);
  const [customerCouponsCount, setCustomerCouponsCount] = useState(0);

  const cleanCpf = cleanDigits(cpfInput);
  const isCpfComplete = cleanCpf.length === 11;
  const isCpfValid = isCpfComplete && isValidCPF(cleanCpf);

  // Cupons já emitidos anteriormente para este CPF no histórico geral
  const existingCpfCoupons = useMemo(() => {
    if (!cleanCpf) return [];
    return coupons.filter((c) => c.cpf === cleanCpf);
  }, [coupons, cleanCpf]);

  // REGRA OFICIAL DA CAMPANHA:
  // A limitação de 1 uso por CPF é EXCLUSIVA para os até 3 cupons gratuitos (2 visita + 1 Instagram).
  // Para compras em geral e impressoras 3D, o cliente tem liberdade total para comprar quantas vezes quiser e receber cupons a cada compra!
  const hasReceivedVisit = useMemo(() => {
    return Boolean(
      existingCustomer?.firstVisitGranted ||
      existingCpfCoupons.some((c) => c.origin === 'visit')
    );
  }, [existingCustomer, existingCpfCoupons]);

  const hasReceivedInstagram = useMemo(() => {
    return Boolean(
      existingCustomer?.instagramGranted ||
      existingCpfCoupons.some((c) => c.origin === 'instagram')
    );
  }, [existingCustomer, existingCpfCoupons]);

  const hasRedeemedAllFreeCoupons = hasReceivedVisit && hasReceivedInstagram;
  const isReturningCustomer = Boolean(existingCustomer || existingCpfCoupons.length > 0);

  // Efeito ao digitar o CPF
  useEffect(() => {
    if (isCpfComplete) {
      const found = customers.find((c) => c.cpf === cleanCpf);
      const priorCoupons = coupons.filter((c) => c.cpf === cleanCpf);
      const alreadyVisit = Boolean(found?.firstVisitGranted || priorCoupons.some((c) => c.origin === 'visit'));
      const alreadyInsta = Boolean(found?.instagramGranted || priorCoupons.some((c) => c.origin === 'instagram'));

      if (found) {
        setExistingCustomer(found);
        setNameInput(found.name || '');
        setPhoneInput(found.whatsapp ? formatPhone(found.whatsapp) : '');
        setInstaInput(found.instagram || '');

        // Visita gratuita: só pode marcar se ainda NÃO recebeu
        setGrantVisit(!alreadyVisit);
        // Instagram gratuito: só pode marcar se ainda NÃO recebeu e tiver @ preenchido
        setGrantInstagram(!alreadyInsta && Boolean(found.instagram));
        setCustomerCouponsCount(priorCoupons.length);
      } else {
        setExistingCustomer(null);
        setCustomerCouponsCount(priorCoupons.length);
        // Se já existem cupons anteriores para esse CPF, respeita as travas dos grátis
        setGrantVisit(!alreadyVisit);
        setGrantInstagram(!alreadyInsta && Boolean(instaInput));
      }
    } else {
      setExistingCustomer(null);
      setCustomerCouponsCount(0);
      setGrantVisit(false);
      setGrantInstagram(false);
    }
  }, [cleanCpf, isCpfComplete, customers, coupons]);

  // Atualiza grantInstagram se digitar o @
  const handleInstaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInstaInput(val);
    if (val.trim().length > 1 && !hasReceivedInstagram) {
      setGrantInstagram(true);
    } else if (!val.trim()) {
      setGrantInstagram(false);
    }
  };

  const purchaseStep = settings.purchaseValueStep || 60;
  // Na compra de R$ 60 já ganha 1 cupom! Não precisa ser mais do que R$ 60.
  const minPurchase = Math.min(settings.minPurchaseValue || 60, purchaseStep, 60);
  const maxCoupons = settings.maxPurchaseCoupons ?? 10;

  // Cálculo de cupons por compras: na compra de R$ 60 já ganha 1 cupom; a cada R$ 60 adicionais ganha +1 cupom (máx. 10 cupons)
  const rawPurchaseCoupons = useMemo(() => {
    if (typeof purchaseAmount !== 'number' || purchaseAmount <= 0) return 0;
    if (purchaseAmount < minPurchase) return 0;
    return Math.floor(purchaseAmount / purchaseStep);
  }, [purchaseAmount, minPurchase, purchaseStep]);

  const purchaseCoupons = useMemo(() => {
    return Math.min(rawPurchaseCoupons, maxCoupons);
  }, [rawPurchaseCoupons, maxCoupons]);

  const isPurchaseBelowMinimum =
    typeof purchaseAmount === 'number' && purchaseAmount > 0 && purchaseAmount < minPurchase;
  const isPurchaseCapped =
    rawPurchaseCoupons >= maxCoupons && typeof purchaseAmount === 'number' && purchaseAmount >= minPurchase;
  const amountToMinPurchase =
    isPurchaseBelowMinimum && typeof purchaseAmount === 'number' ? minPurchase - purchaseAmount : 0;
  const amountToNextPurchaseCoupon = useMemo(() => {
    if (typeof purchaseAmount !== 'number' || purchaseAmount < minPurchase || rawPurchaseCoupons >= maxCoupons) {
      return 0;
    }
    const nextTarget = (rawPurchaseCoupons + 1) * purchaseStep;
    return Math.max(0, nextTarget - purchaseAmount);
  }, [purchaseAmount, minPurchase, rawPurchaseCoupons, maxCoupons, purchaseStep]);

  // Total de cupons calculados
  // Regra: Os cupons gratuitos (visita + insta) só podem ser concedidos 1 única vez por CPF
  const visitCoupons = !hasReceivedVisit && grantVisit ? settings.visitCouponCount : 0;
  const instaCoupons = !hasReceivedInstagram && grantInstagram ? settings.instagramCouponCount : 0;

  const printerBonusCoupons = printerCount * (settings.printerBonusCoupons || 10);

  const totalCalculatedCoupons =
    visitCoupons + instaCoupons + printerBonusCoupons + purchaseCoupons + manualCount;

  // Limpar formulário para próximo atendimento
  const handleReset = () => {
    setCpfInput('');
    setNameInput('');
    setPhoneInput('');
    setInstaInput('');
    setPhysicalPaperNumber('');
    setGrantVisit(false);
    setGrantInstagram(false);
    setPrinterCount(0);
    setPurchaseAmount('');
    setManualCount(0);
    setExistingCustomer(null);
    setCustomerCouponsCount(0);
  };

  // Monta objetos de cupom temporários para prévia ou emissão
  const buildCoupons = (startNumber: number, batchId: string, printedAt?: string): Coupon[] => {
    const list: Coupon[] = [];
    let currentNum = startNumber;

    const customerData: Customer = {
      cpf: cleanCpf,
      name: nameInput.trim() || 'Participante',
      whatsapp: cleanDigits(phoneInput),
      instagram: formatInstagram(instaInput),
      firstVisitGranted: hasReceivedVisit || (visitCoupons > 0),
      instagramGranted: hasReceivedInstagram || (instaCoupons > 0),
      createdAt: existingCustomer?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // 1. Cupons de Visita
    for (let i = 0; i < visitCoupons; i++) {
      list.push({
        id: `c-${batchId}-${currentNum}`,
        number: currentNum,
        formattedNumber: formatCouponNumber(currentNum),
        batchId,
        cpf: cleanCpf,
        customerName: customerData.name,
        customerWhatsapp: customerData.whatsapp ? formatPhone(customerData.whatsapp) : '',
        customerInstagram: customerData.instagram,
        origin: 'visit',
        originLabel: `1ª Visita Loja (${i + 1}/${visitCoupons})`,
        physicalPaperNumber: physicalPaperNumber.trim() || undefined,
        verificationCode: generateVerificationCode(currentNum, cleanCpf),
        createdAt: new Date().toISOString(),
        printedAt,
      });
      currentNum++;
    }

    // 2. Cupons de Instagram
    for (let i = 0; i < instaCoupons; i++) {
      list.push({
        id: `c-${batchId}-${currentNum}`,
        number: currentNum,
        formattedNumber: formatCouponNumber(currentNum),
        batchId,
        cpf: cleanCpf,
        customerName: customerData.name,
        customerWhatsapp: customerData.whatsapp ? formatPhone(customerData.whatsapp) : '',
        customerInstagram: customerData.instagram,
        origin: 'instagram',
        originLabel: 'Seguiu no Instagram (@)',
        physicalPaperNumber: physicalPaperNumber.trim() || undefined,
        verificationCode: generateVerificationCode(currentNum, cleanCpf),
        createdAt: new Date().toISOString(),
        printedAt,
      });
      currentNum++;
    }

    // 3. Cupons de Compra de Impressora (NOVO)
    for (let i = 0; i < printerBonusCoupons; i++) {
      list.push({
        id: `c-${batchId}-${currentNum}`,
        number: currentNum,
        formattedNumber: formatCouponNumber(currentNum),
        batchId,
        cpf: cleanCpf,
        customerName: customerData.name,
        customerWhatsapp: customerData.whatsapp ? formatPhone(customerData.whatsapp) : '',
        customerInstagram: customerData.instagram,
        origin: 'printer',
        originLabel: `Compra de Impressora (${i + 1}/${printerBonusCoupons})`,
        printerCount,
        physicalPaperNumber: physicalPaperNumber.trim() || undefined,
        verificationCode: generateVerificationCode(currentNum, cleanCpf),
        createdAt: new Date().toISOString(),
        printedAt,
      });
      currentNum++;
    }

    // 4. Cupons por Valor de Compra
    for (let i = 0; i < purchaseCoupons; i++) {
      list.push({
        id: `c-${batchId}-${currentNum}`,
        number: currentNum,
        formattedNumber: formatCouponNumber(currentNum),
        batchId,
        cpf: cleanCpf,
        customerName: customerData.name,
        customerWhatsapp: customerData.whatsapp ? formatPhone(customerData.whatsapp) : '',
        customerInstagram: customerData.instagram,
        origin: 'purchase',
        originLabel: `Compra R$ ${typeof purchaseAmount === 'number' ? purchaseAmount.toFixed(0) : ''} (${i + 1}/${purchaseCoupons})`,
        purchaseAmount: typeof purchaseAmount === 'number' ? purchaseAmount : undefined,
        physicalPaperNumber: physicalPaperNumber.trim() || undefined,
        verificationCode: generateVerificationCode(currentNum, cleanCpf),
        createdAt: new Date().toISOString(),
        printedAt,
      });
      currentNum++;
    }

    // 5. Cupons Manuais / Extras
    for (let i = 0; i < manualCount; i++) {
      list.push({
        id: `c-${batchId}-${currentNum}`,
        number: currentNum,
        formattedNumber: formatCouponNumber(currentNum),
        batchId,
        cpf: cleanCpf,
        customerName: customerData.name,
        customerWhatsapp: customerData.whatsapp ? formatPhone(customerData.whatsapp) : '',
        customerInstagram: customerData.instagram,
        origin: 'manual',
        originLabel: `Cupom Extra (${i + 1}/${manualCount})`,
        physicalPaperNumber: physicalPaperNumber.trim() || undefined,
        verificationCode: generateVerificationCode(currentNum, cleanCpf),
        createdAt: new Date().toISOString(),
        printedAt,
      });
      currentNum++;
    }

    return list;
  };

  // Abrir Pré-visualização na tela antes de imprimir
  const handlePreview = () => {
    if (!nameInput.trim()) {
      alert('Por favor, informe o nome do cliente.');
      return;
    }
    if (!isCpfComplete) {
      alert('Por favor, digite os 11 dígitos do CPF.');
      return;
    }
    if (!isCpfValid) {
      alert('CPF inválido. Por favor, digite um CPF válido da Receita Federal.');
      return;
    }
    if (totalCalculatedCoupons <= 0) {
      if (hasRedeemedAllFreeCoupons) {
        alert(
          'Este cliente já resgatou os 3 cupons gratuitos promocionais (visita e Instagram). Para emitir novos cupons nesta visita, informe o valor da compra (a partir de R$ 60) ou impressora 3D.'
        );
      } else {
        alert('Nenhum cupom selecionado para gerar neste atendimento.');
      }
      return;
    }

    const mockCoupons = buildCoupons(1001, 'preview');
    onOpenPreview(mockCoupons);
  };

  // Salva apenas os dados cadastrais do cliente (sem cupons)
  const handleSaveCustomerOnly = () => {
    if (!nameInput.trim()) {
      alert('Por favor, informe o nome do participante antes de salvar.');
      return;
    }
    if (!isCpfComplete) {
      alert('Por favor, digite o CPF completo (11 números) antes de salvar.');
      return;
    }
    if (!isCpfValid) {
      alert('CPF inválido. Por favor, digite um CPF válido da Receita Federal antes de salvar.');
      return;
    }

    const updatedCustomer: Customer = {
      cpf: cleanCpf,
      name: nameInput.trim(),
      whatsapp: cleanDigits(phoneInput),
      instagram: formatInstagram(instaInput),
      firstVisitGranted: hasReceivedVisit,
      instagramGranted: hasReceivedInstagram,
      createdAt: existingCustomer?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    onSaveCustomer(updatedCustomer);
  };

  // Salva o cadastro e os cupons no sistema (sem imprimir na hora)
  const handleSaveOnly = () => {
    if (!nameInput.trim()) {
      alert('Por favor, informe o nome do participante antes de salvar.');
      return;
    }
    if (!isCpfComplete) {
      alert('Por favor, digite o CPF completo (11 números) antes de salvar.');
      return;
    }
    if (!isCpfValid) {
      alert('CPF inválido. Por favor, digite um CPF válido da Receita Federal antes de salvar.');
      return;
    }

    if (totalCalculatedCoupons > 0) {
      const startNum = incrementCouponNumberBy(totalCalculatedCoupons);
      const batchId = `b-${Date.now().toString(36)}`;
      const newCoupons = buildCoupons(startNum, batchId);

      const updatedCustomer: Customer = {
        cpf: cleanCpf,
        name: nameInput.trim(),
        whatsapp: cleanDigits(phoneInput),
        instagram: formatInstagram(instaInput),
        firstVisitGranted: hasReceivedVisit || (visitCoupons > 0),
        instagramGranted: hasReceivedInstagram || (instaCoupons > 0),
        createdAt: existingCustomer?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      onGenerateCoupons(newCoupons, updatedCustomer, false);
    } else {
      // Salva apenas os dados cadastrais do cliente
      const updatedCustomer: Customer = {
        cpf: cleanCpf,
        name: nameInput.trim(),
        whatsapp: cleanDigits(phoneInput),
        instagram: formatInstagram(instaInput),
        firstVisitGranted: hasReceivedVisit,
        instagramGranted: hasReceivedInstagram,
        createdAt: existingCustomer?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      onSaveCustomer(updatedCustomer);
    }

    handleReset();
  };

  // Emitir e Imprimir Cupons na Elgin i9
  const handleIssueAndPrint = () => {
    if (!nameInput.trim()) {
      alert('Por favor, informe o nome do cliente.');
      return;
    }
    if (!isCpfComplete) {
      alert('Por favor, digite o CPF completo (11 números).');
      return;
    }
    if (!isCpfValid) {
      alert('CPF inválido. Por favor, digite um CPF válido da Receita Federal.');
      return;
    }
    if (totalCalculatedCoupons <= 0) {
      if (hasRedeemedAllFreeCoupons) {
        alert(
          'Este cliente já resgatou os 3 cupons gratuitos. Para emitir cupons desta visita, insira o valor da compra (mínimo R$ 60) ou quantidade de impressoras 3D.'
        );
      } else {
        alert('Selecione ao menos 1 cupom para emitir.');
      }
      return;
    }

    const startNum = incrementCouponNumberBy(totalCalculatedCoupons);
    const batchId = `b-${Date.now().toString(36)}`;
    const printTime = new Date().toISOString();
    const newCoupons = buildCoupons(startNum, batchId, printTime);

    const updatedCustomer: Customer = {
      cpf: cleanCpf,
      name: nameInput.trim(),
      whatsapp: cleanDigits(phoneInput),
      instagram: formatInstagram(instaInput),
      firstVisitGranted: hasReceivedVisit || (visitCoupons > 0),
      instagramGranted: hasReceivedInstagram || (instaCoupons > 0),
      createdAt: existingCustomer?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    onGenerateCoupons(newCoupons, updatedCustomer, true);
    handleReset();
  };

  return (
    <div className="bg-white border border-neutral-200 rounded-xl shadow-xs overflow-hidden">
      {/* Barra de Título do Atendimento */}
      <div className="px-6 py-4 border-b border-neutral-200 bg-neutral-50/80 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-neutral-900 flex items-center gap-2">
            <Receipt className="w-5 h-5 text-red-600" />
            Lançamento Rápido no Balcão
          </h2>
          <p className="text-xs text-neutral-500 mt-0.5">
            Preencha os dados do participante, calcule os cupons e imprima as 2 vias na Elgin i9
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleReset}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-neutral-600 bg-white border border-neutral-200 rounded-lg hover:bg-neutral-100 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Limpar Campos
          </button>
        </div>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleIssueAndPrint();
        }}
        className="p-6 space-y-6"
      >
        {/* BLOCO 1: IDENTIFICAÇÃO DO CLIENTE */}
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-neutral-500">
              1. Identificação do Cliente
            </span>
            <div className="flex items-center gap-2">
              {isCpfComplete && isCpfValid && isReturningCustomer && (
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-md border border-emerald-300">
                  <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
                  Cliente Recorrente ({existingCpfCoupons.length} {existingCpfCoupons.length === 1 ? 'cupom acumulado' : 'cupons acumulados'})
                </span>
              )}
              {isCpfComplete && isCpfValid && !isReturningCustomer && (
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-md border border-blue-200">
                  <Sparkles className="w-3.5 h-3.5" />
                  Novo Cliente (Até 3 cupons grátis disponíveis)
                </span>
              )}
              <button
                type="button"
                onClick={handleSaveCustomerOnly}
                disabled={!nameInput.trim() || !isCpfValid}
                className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-bold text-neutral-800 bg-neutral-100 hover:bg-neutral-200 border border-neutral-300 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-2xs"
                title="Salvar apenas os dados cadastrais deste cliente no sistema"
              >
                <Save className="w-3.5 h-3.5 text-neutral-600" />
                Salvar Cadastro
              </button>
            </div>
          </div>

          {/* PAINEL DE CLIENTE RECORRENTE: REGRAS E LIBERDADE DE COMPRAS */}
          {isCpfComplete && isCpfValid && isReturningCustomer && (
            <div className="p-4 bg-emerald-50/70 border border-emerald-300 rounded-xl text-neutral-900 shadow-xs space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-start gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-emerald-100 border border-emerald-300 flex items-center justify-center shrink-0 mt-0.5 text-emerald-700">
                    <UserCheck className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="font-extrabold text-sm text-emerald-950 flex flex-wrap items-center gap-2">
                      <span>Cliente Recorrente: {nameInput || existingCustomer?.name}</span>
                      <span className="text-[10px] bg-emerald-200/80 text-emerald-900 px-2 py-0.5 rounded font-extrabold border border-emerald-300">
                        {existingCpfCoupons.length} {existingCpfCoupons.length === 1 ? 'CUPOM ANTERIOR' : 'CUPONS ANTERIORES'}
                      </span>
                    </h4>
                    <p className="text-xs text-neutral-700 mt-1">
                      CPF: <strong className="font-mono">{formatCPF(cleanCpf)}</strong>
                      {existingCpfCoupons.length > 0 && (
                        <span>
                          {' '}· Faixa já emitida: #{existingCpfCoupons[0]?.formattedNumber}
                          {existingCpfCoupons.length > 1
                            ? ` até #${existingCpfCoupons[existingCpfCoupons.length - 1]?.formattedNumber}`
                            : ''}
                        </span>
                      )}
                    </p>
                    <div className="flex flex-wrap items-center gap-2 mt-2 text-xs">
                      <span className="inline-flex items-center gap-1 font-semibold text-neutral-800 bg-white px-2 py-0.5 rounded border border-neutral-200">
                        {hasRedeemedAllFreeCoupons ? (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            3 Cupons Grátis Já Resgatados (Visita + Instagram)
                          </>
                        ) : hasReceivedVisit ? (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            Visita já resgatada (+2) · Instagram disponível (+1)
                          </>
                        ) : hasReceivedInstagram ? (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            Instagram já resgatado (+1) · Visita disponível (+2)
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                            Cupons gratuitos disponíveis para resgate
                          </>
                        )}
                      </span>
                      <span className="inline-flex items-center gap-1 font-bold text-emerald-800 bg-emerald-100/90 px-2.5 py-0.5 rounded border border-emerald-300">
                        <ShoppingBag className="w-3.5 h-3.5 text-emerald-700" />
                        Compras Liberadas Sem Limite!
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                  {existingCpfCoupons.length > 0 && (
                    <button
                      type="button"
                      onClick={() => onOpenPreview(existingCpfCoupons)}
                      className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-neutral-800 bg-white hover:bg-neutral-100 border border-neutral-300 rounded-lg shadow-2xs transition-colors"
                      title="Visualizar e reimprimir os cupons já gerados para este CPF"
                    >
                      <Eye className="w-3.5 h-3.5 text-neutral-600" />
                      Ver Cupons Anteriores ({existingCpfCoupons.length})
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleReset}
                    className="px-3 py-2 text-xs font-semibold text-neutral-700 bg-white hover:bg-neutral-100 rounded-lg border border-neutral-300 transition-colors"
                  >
                    Outro Atendimento
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ALERTA DE CPF MATEMATICAMENTE INVÁLIDO */}
          {isCpfComplete && !isCpfValid && (
            <div className="p-3 bg-red-50 border border-red-300 rounded-xl text-xs text-red-900 flex items-center gap-2.5">
              <ShieldAlert className="w-4 h-4 text-red-600 shrink-0" />
              <span>
                <strong>CPF Inválido:</strong> Os números digitados não conferem com o cálculo oficial de validação da Receita Federal. Por favor, confira o documento do cliente.
              </span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* CPF */}
            <div className="md:col-span-1">
              <label className="block text-xs font-bold text-neutral-800 mb-1">
                CPF do Cliente *
              </label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="000.000.000-00"
                  value={cpfInput}
                  onChange={(e) => setCpfInput(formatCPF(e.target.value))}
                  maxLength={14}
                  className={`w-full px-3 py-2 text-sm font-mono rounded-lg border transition-colors outline-hidden ${
                    isCpfComplete
                      ? isCpfValid
                        ? 'border-emerald-500 bg-emerald-50/20 text-neutral-900 focus:ring-2 focus:ring-emerald-200'
                        : 'border-red-500 bg-red-50/30 text-red-900 font-bold focus:ring-2 focus:ring-red-200'
                      : 'border-neutral-300 focus:border-red-500 focus:ring-2 focus:ring-red-100'
                  }`}
                  required
                />
              </div>
              <span className="text-[11px] mt-1 block">
                {isCpfComplete ? (
                  isCpfValid ? (
                    isReturningCustomer ? (
                      <span className="text-emerald-700 font-bold flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        ✓ CPF autêntico · Cliente recorrente ({existingCpfCoupons.length} cupons)
                      </span>
                    ) : (
                      <span className="text-emerald-700 font-bold flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        ✓ CPF autêntico e válido
                      </span>
                    )
                  ) : (
                    <span className="text-red-600 font-bold flex items-center gap-1">
                      <ShieldAlert className="w-3.5 h-3.5 text-red-600 shrink-0" />
                      CPF inválido (confira os dígitos pela Receita Federal)
                    </span>
                  )
                ) : cleanCpf.length > 0 ? (
                  <span className="text-neutral-500 font-mono">
                    Faltam {11 - cleanCpf.length} dígito(s)
                  </span>
                ) : (
                  <span className="text-neutral-500">Digite os 11 números</span>
                )}
              </span>
            </div>

            {/* Nome Completo */}
            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-neutral-800 mb-1">
                Nome do Participante *
              </label>
              <input
                type="text"
                placeholder="Ex: Carlos Eduardo de Oliveira"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-neutral-300 focus:border-red-500 focus:ring-2 focus:ring-red-100 outline-hidden uppercase font-medium"
                required
              />
              <span className="text-[11px] text-neutral-500 mt-1 block">
                Como sairá impresso no cupom e na urna
              </span>
            </div>

            {/* WhatsApp */}
            <div className="md:col-span-1">
              <label className="block text-xs font-bold text-neutral-800 mb-1">
                WhatsApp / Celular
              </label>
              <input
                type="text"
                placeholder="(00) 00000-0000"
                value={phoneInput}
                onChange={(e) => setPhoneInput(formatPhone(e.target.value))}
                maxLength={15}
                className="w-full px-3 py-2 text-sm font-mono rounded-lg border border-neutral-300 focus:border-red-500 focus:ring-2 focus:ring-red-100 outline-hidden"
              />
              <span className="text-[11px] text-neutral-500 mt-1 block">
                Para contato caso seja sorteado
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
            {/* Instagram */}
            <div>
              <label className="block text-xs font-bold text-neutral-800 mb-1 flex items-center gap-1.5">
                <Instagram className="w-3.5 h-3.5 text-pink-600" />
                Instagram do Participante (@)
              </label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="@seuperfil"
                  value={instaInput}
                  onChange={handleInstaChange}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-neutral-300 focus:border-red-500 focus:ring-2 focus:ring-red-100 outline-hidden"
                />
              </div>
              <span className="text-[11px] text-neutral-500 mt-1 block">
                {existingCustomer?.instagramGranted
                  ? '✓ Já recebeu o cupom de seguidor no Instagram'
                  : 'Concede +1 cupom ao seguir a loja'}
              </span>
            </div>

            {/* Número no Talão Físico (Opcional) */}
            <div>
              <label className="block text-xs font-bold text-neutral-800 mb-1 flex items-center gap-1.5">
                <Hash className="w-3.5 h-3.5 text-neutral-500" />
                Nº do Cupom no Papel / Talão Físico (Opcional)
              </label>
              <input
                type="text"
                placeholder="Ex: 0842 (se a loja usar pré-impressos)"
                value={physicalPaperNumber}
                onChange={(e) => setPhysicalPaperNumber(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono rounded-lg border border-neutral-300 focus:border-red-500 focus:ring-2 focus:ring-red-100 outline-hidden"
              />
              <span className="text-[11px] text-neutral-500 mt-1 block">
                Opcional para conciliação caso use talão físico paralelo
              </span>
            </div>
          </div>
        </div>

        {/* BLOCO 2: LANÇAR CUPONS E REGRAS PROMOCIONAIS */}
        <div className="space-y-5 pt-4 border-t border-neutral-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
            <span className="text-xs font-bold uppercase tracking-wider text-neutral-700">
              2. Regras Promocionais e Lançamento de Cupons
            </span>
            <span className="text-xs text-neutral-500 font-medium">
              3 grátis por CPF (Visita + Insta) · <strong className="text-emerald-700">Compras SEM LIMITE</strong>
            </span>
          </div>

          {/* ALERTA DE LIMITE DE GRATUITOS RESGATADOS */}
          {hasRedeemedAllFreeCoupons && (
            <div className="p-3 bg-neutral-100 border border-neutral-300 rounded-xl text-xs text-neutral-700 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span className="font-bold text-neutral-900">
                  Limite de 3 cupons grátis já resgatado por este CPF
                </span>
                <span className="text-neutral-500 hidden sm:inline">
                  (2 de visita + 1 de Instagram já entregues).
                </span>
              </div>
              <span className="text-emerald-700 font-bold bg-emerald-50 px-2.5 py-1 rounded border border-emerald-200 shrink-0">
                Compras liberadas sem limite de vezes!
              </span>
            </div>
          )}

          {/* SUB-SEÇÃO A: CUPONS GRATUITOS (MÁXIMO 3 POR CPF) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-500 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                Cupons Gratuitos (Direito a até 3 cupons por CPF)
              </span>
              <span className="text-[10px] font-bold text-neutral-500 bg-neutral-100 px-2 py-0.5 rounded">
                Limite: 1x por CPF
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* REGRA 1: 1ª Visita na Loja (+2 cupons) */}
              <div
                onClick={() => {
                  if (!hasReceivedVisit) {
                    setGrantVisit(!grantVisit);
                  }
                }}
                className={`p-3.5 rounded-xl border transition-all cursor-pointer relative ${
                  hasReceivedVisit
                    ? 'bg-neutral-50 border-neutral-200 opacity-60 cursor-not-allowed'
                    : grantVisit
                    ? 'bg-red-50/50 border-red-500 ring-1 ring-red-500'
                    : 'bg-white border-neutral-200 hover:border-neutral-300'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-500 block">
                      Visita à Loja (1ª Vez)
                    </span>
                    <p className="text-sm font-bold text-neutral-900 mt-0.5">
                      +{settings.visitCouponCount} Cupons Grátis
                    </p>
                  </div>
                  <div
                    className={`w-5 h-5 rounded-md flex items-center justify-center text-xs font-bold ${
                      hasReceivedVisit
                        ? 'bg-neutral-200 text-neutral-600'
                        : grantVisit
                        ? 'bg-red-600 text-white'
                        : 'border border-neutral-300 bg-white text-transparent'
                    }`}
                  >
                    {hasReceivedVisit ? <Lock className="w-3 h-3 text-neutral-500" /> : '✓'}
                  </div>
                </div>
                <p className="text-[11px] text-neutral-500 mt-2">
                  {hasReceivedVisit
                    ? '✓ 2 cupons de visita já resgatados (limite 1x atingido)'
                    : 'Concede 2 cupons gratuitos na primeira visita deste CPF'}
                </p>
              </div>

              {/* REGRA 2: Seguir no Instagram (+1 cupom) */}
              <div
                onClick={() => {
                  if (!hasReceivedInstagram) {
                    setGrantInstagram(!grantInstagram);
                  }
                }}
                className={`p-3.5 rounded-xl border transition-all cursor-pointer relative ${
                  hasReceivedInstagram
                    ? 'bg-neutral-50 border-neutral-200 opacity-60 cursor-not-allowed'
                    : grantInstagram
                    ? 'bg-pink-50/50 border-pink-500 ring-1 ring-pink-500'
                    : 'bg-white border-neutral-200 hover:border-neutral-300'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-pink-700 block">
                      Seguir no Instagram (@)
                    </span>
                    <p className="text-sm font-bold text-neutral-900 mt-0.5">
                      +{settings.instagramCouponCount} Cupom Grátis
                    </p>
                  </div>
                  <div
                    className={`w-5 h-5 rounded-md flex items-center justify-center text-xs font-bold ${
                      hasReceivedInstagram
                        ? 'bg-neutral-200 text-neutral-600'
                        : grantInstagram
                        ? 'bg-pink-600 text-white'
                        : 'border border-neutral-300 bg-white text-transparent'
                    }`}
                  >
                    {hasReceivedInstagram ? <Lock className="w-3 h-3 text-neutral-500" /> : '✓'}
                  </div>
                </div>
                <p className="text-[11px] text-neutral-500 mt-2">
                  {hasReceivedInstagram
                    ? '✓ 1 cupom de seguidor já resgatado (limite 1x atingido)'
                    : 'Concede 1 cupom ao seguir a loja no Instagram'}
                </p>
              </div>
            </div>
          </div>

          {/* SUB-SEÇÃO B: CUPONS POR COMPRAS (MÍNIMO R$ 60 · MÁXIMO 10 CUPONS) */}
          <div className="space-y-2 pt-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800 flex items-center gap-1.5">
                <ShoppingBag className="w-3.5 h-3.5 text-emerald-600" />
                Cupons por Compras (Na compra de R$ 60 já ganha 1 cupom · Máx. {maxCoupons} cupons por compra)
              </span>
              <span className="text-[10px] font-extrabold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
                R$ 60 = 1 CUPOM · MÁX. {maxCoupons} CUPONS
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* REGRA 3: Compra de Impressora (+10 cupons por impressora) */}
              <div className="p-3.5 rounded-xl border border-neutral-200 bg-white hover:border-purple-300 transition-all flex flex-col justify-between">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-purple-700 block flex items-center gap-1">
                      <Printer className="w-3 h-3" />
                      Compra de Impressora 3D
                    </span>
                    <p className="text-sm font-bold text-neutral-900 mt-0.5">
                      +{settings.printerBonusCoupons} Cupons por Impressora
                    </p>
                  </div>
                  {printerCount > 0 && (
                    <span className="text-xs font-bold text-purple-700 bg-purple-100 px-1.5 py-0.5 rounded">
                      +{printerBonusCoupons}
                    </span>
                  )}
                </div>

                <div className="flex items-center justify-between mt-3 pt-2 border-t border-neutral-100">
                  <span className="text-xs text-neutral-600 font-medium">Qtd de impressoras:</span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setPrinterCount(Math.max(0, printerCount - 1))}
                      disabled={printerCount <= 0}
                      className="w-7 h-7 flex items-center justify-center rounded-lg border border-neutral-200 hover:bg-neutral-100 disabled:opacity-30 disabled:pointer-events-none"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="w-6 text-center text-sm font-bold font-mono">
                      {printerCount}
                    </span>
                    <button
                      type="button"
                      onClick={() => setPrinterCount(printerCount + 1)}
                      className="w-7 h-7 flex items-center justify-center rounded-lg border border-neutral-200 bg-purple-50 text-purple-700 hover:bg-purple-100 font-bold"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>

              {/* REGRA 4: Valor Geral em Compras (A cada R$ 60 = 1 cupom, Máx 10 cupons) */}
              <div className="p-3.5 rounded-xl border border-neutral-200 bg-white hover:border-emerald-300 transition-all flex flex-col justify-between">
                <div>
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 block flex items-center gap-1">
                        <ShoppingBag className="w-3 h-3" />
                        Valor Geral em Compras
                      </span>
                      <p className="text-sm font-bold text-neutral-900 mt-0.5">
                        R$ 60,00 = 1 Cupom (Já ganha com R$ 60)
                      </p>
                    </div>
                    {purchaseCoupons > 0 && (
                      <span className="text-xs font-extrabold text-emerald-700 bg-emerald-100 px-2.5 py-1 rounded-md flex items-center gap-1 border border-emerald-300">
                        +{purchaseCoupons} {purchaseCoupons === 1 ? 'cupom' : 'cupons'}
                      </span>
                    )}
                  </div>

                  <p className="text-[11px] text-neutral-600 mt-1">
                    Na compra de <strong>R$ 60,00</strong> o cliente <strong>já ganha 1 cupom</strong> (não precisa ser mais que R$ 60). A cada R$ 60 ganha +1 cupom (Ex: R$ 60 = 1 · R$ 120 = 2 · R$ 180 = 3 · R$ 240 = 4 · Máx. 10 cupons).
                  </p>
                </div>

                <div className="mt-3 pt-2 border-t border-neutral-100 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-neutral-600">R$</span>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      placeholder="Ex: 60 (1 cupom), 120 (2 cupons), 180 (3 cupons), 240 (4 cupons)..."
                      value={purchaseAmount === '' ? '' : purchaseAmount}
                      onChange={(e) => {
                        const val = e.target.value === '' ? '' : Math.max(0, parseFloat(e.target.value));
                        setPurchaseAmount(val);
                      }}
                      className="w-full px-2.5 py-1.5 text-sm font-mono rounded border border-neutral-200 focus:border-red-500 outline-hidden font-bold"
                    />
                  </div>

                  {/* Atalhos Rápidos para o Operador do Caixa */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[10px] text-neutral-500 font-bold uppercase tracking-wider">
                      Atalhos:
                    </span>

                    {/* Atalho Direto R$ 60 (1 cupom) */}
                    <button
                      type="button"
                      onClick={() => setPurchaseAmount(60)}
                      className={`inline-flex items-center gap-1 text-xs font-extrabold px-3 py-1 rounded-lg transition-all shadow-2xs active:scale-95 ${
                        purchaseAmount === 60
                          ? 'bg-emerald-700 text-white ring-2 ring-emerald-300'
                          : 'bg-emerald-100 hover:bg-emerald-200 text-emerald-900 border border-emerald-300'
                      }`}
                      title="Define compra de exatamente R$ 60 (já ganha 1 cupom)"
                    >
                      <Sparkles className="w-3 h-3 text-emerald-700" />
                      R$ 60 (1 cupom)
                    </button>

                    {/* Atalho de +R$ 60 (+1 cupom) */}
                    <button
                      type="button"
                      onClick={() => {
                        const current = typeof purchaseAmount === 'number' ? purchaseAmount : 0;
                        setPurchaseAmount(current + 60);
                      }}
                      className="inline-flex items-center gap-1 text-xs font-extrabold px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-all shadow-2xs active:scale-95"
                      title="Adiciona +R$ 60 ao valor da compra e soma +1 cupom"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      +R$ 60 (+1 cupom)
                    </button>

                    {/* Atalho de -R$ 60 (-1 cupom) */}
                    <button
                      type="button"
                      onClick={() => {
                        const current = typeof purchaseAmount === 'number' ? purchaseAmount : 0;
                        const next = Math.max(0, current - 60);
                        setPurchaseAmount(next === 0 ? '' : next);
                      }}
                      disabled={typeof purchaseAmount !== 'number' || purchaseAmount <= 0}
                      className="inline-flex items-center gap-0.5 text-xs font-bold px-2 py-1 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 border border-neutral-300 rounded-lg transition-all disabled:opacity-30 disabled:pointer-events-none"
                      title="Diminui R$ 60 do valor da compra (-1 cupom)"
                    >
                      <Minus className="w-3 h-3" />
                      -R$ 60
                    </button>

                    {/* Atalho Limite Máximo (10 cupons = R$ 600) */}
                    <button
                      type="button"
                      onClick={() => {
                        setPurchaseAmount(600);
                      }}
                      className="inline-flex items-center gap-1 text-xs font-bold px-3 py-1 bg-purple-100 hover:bg-purple-200 text-purple-900 border border-purple-300 rounded-lg transition-all shadow-2xs active:scale-95"
                      title="Define imediatamente o teto máximo de 10 cupons (R$ 600)"
                    >
                      <Sparkles className="w-3 h-3 text-purple-700" />
                      Limite Máximo (10 cupons)
                    </button>

                    {/* Zerar */}
                    {purchaseAmount !== '' && (
                      <button
                        type="button"
                        onClick={() => setPurchaseAmount('')}
                        className="text-xs font-bold px-2 py-1 text-neutral-400 hover:text-red-600 transition-colors"
                        title="Zerar valor de compra"
                      >
                        ✕ Zerar
                      </button>
                    )}
                  </div>

                  {/* Feedback dinâmico da regra de R$ 60 e teto de 10 cupons */}
                  {isPurchaseBelowMinimum && (
                    <div className="p-2 bg-amber-50 border border-amber-300 rounded-lg text-[11px] text-amber-900 flex items-center justify-between">
                      <span className="font-semibold">
                        ⚠️ R$ {typeof purchaseAmount === 'number' ? purchaseAmount.toFixed(2) : '0,00'} (Abaixo de R$ 60,00)
                      </span>
                      <span className="font-bold text-amber-800">
                        Faltam R$ {amountToMinPurchase.toFixed(2)} para atingir R$ 60 e ganhar 1 cupom
                      </span>
                    </div>
                  )}

                  {isPurchaseCapped && (
                    <div className="p-2 bg-emerald-50 border border-emerald-300 rounded-lg text-[11px] text-emerald-900 flex items-center justify-between">
                      <span className="font-bold flex items-center gap-1">
                        🏆 Limite máximo de 10 cupons atingido!
                      </span>
                      {typeof purchaseAmount === 'number' && (
                        <span className="text-[10px] text-emerald-700 font-semibold">
                          (R$ {purchaseAmount.toFixed(2)} = 10 cupons concedidos)
                        </span>
                      )}
                    </div>
                  )}

                  {typeof purchaseAmount === 'number' && purchaseAmount >= 60 && !isPurchaseCapped && (
                    <div className="p-2 bg-blue-50 border border-blue-200 rounded-lg text-[11px] text-blue-900 flex items-center justify-between">
                      <span className="font-bold">
                        {purchaseAmount === 60 ? (
                          <>✓ Compra de R$ 60,00 = 1 Cupom garantido!</>
                        ) : (
                          <>✓ {purchaseCoupons} {purchaseCoupons === 1 ? 'cupom' : 'cupons'} (R$ {purchaseAmount.toFixed(0)} ÷ R$ 60 = {purchaseCoupons})</>
                        )}
                      </span>
                      {amountToNextPurchaseCoupon > 0 && (
                        <span className="text-[10px] text-blue-700 font-medium">
                          Mais R$ {amountToNextPurchaseCoupon.toFixed(2)} para o {purchaseCoupons + 1}º cupom
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Ajuste Manual Adicional de Cupons */}
          <div className="flex items-center justify-between p-3 bg-neutral-50 rounded-xl border border-neutral-200 text-xs">
            <div className="flex items-center gap-2">
              <span className="font-bold text-neutral-700">Ajuste Manual / Brinde Extra:</span>
              <span className="text-neutral-500">
                (Adicionar cupons avulsos concedidos pelo operador)
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setManualCount(Math.max(0, manualCount - 1))}
                disabled={manualCount <= 0}
                className="w-6 h-6 flex items-center justify-center rounded border border-neutral-300 bg-white disabled:opacity-30"
              >
                <Minus className="w-3 h-3" />
              </button>
              <span className="w-6 text-center font-bold font-mono">{manualCount}</span>
              <button
                type="button"
                onClick={() => setManualCount(manualCount + 1)}
                className="w-6 h-6 flex items-center justify-center rounded border border-neutral-300 bg-white hover:bg-neutral-100"
              >
                <Plus className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>

        {/* BLOCO 3: RESUMO E EMISSÃO NA ELGIN i9 */}
        <div className="p-4 bg-neutral-900 text-white rounded-xl flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="space-y-1 text-center md:text-left">
            <div className="flex items-center gap-2 justify-center md:justify-start">
              <span className="text-xs uppercase tracking-wider text-neutral-400 font-bold">
                Resumo da Emissão
              </span>
              <span className="text-[10px] bg-red-600 font-bold px-2 py-0.5 rounded text-white">
                Elgin i9 Térmica (80mm)
              </span>
            </div>

            <div className="flex items-baseline gap-2 justify-center md:justify-start">
              <span className="text-3xl font-extrabold text-white font-mono tabular-nums">
                {totalCalculatedCoupons}
              </span>
              <span className="text-sm text-neutral-300 font-medium">
                {totalCalculatedCoupons === 1 ? 'cupom a emitir' : 'cupons a emitir'}
              </span>
              <span className="text-xs text-neutral-400">
                ({totalCalculatedCoupons} vias cliente + {totalCalculatedCoupons} vias urna com assinatura)
              </span>
            </div>

            <div className="text-xs text-neutral-400 flex flex-wrap gap-2 pt-1 justify-center md:justify-start">
              {visitCoupons > 0 && <span>• Visita: +{visitCoupons}</span>}
              {instaCoupons > 0 && <span>• Instagram: +{instaCoupons}</span>}
              {printerBonusCoupons > 0 && (
                <span className="text-purple-300 font-semibold">• Impressora: +{printerBonusCoupons}</span>
              )}
              {purchaseCoupons > 0 && <span>• Compras: +{purchaseCoupons}</span>}
              {manualCount > 0 && <span>• Extra: +{manualCount}</span>}
              {totalCalculatedCoupons === 0 && (
                hasRedeemedAllFreeCoupons ? (
                  <span className="text-amber-300 font-semibold">
                    💡 Os 3 cupons grátis já foram resgatados. Adicione uma compra (mín. R$ {minPurchase}) ou impressora para emitir.
                  </span>
                ) : (
                  <span className="text-amber-400">Selecione ao menos uma opção acima</span>
                )
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
            {/* Botão Salvar no Sistema */}
            <button
              type="button"
              onClick={handleSaveOnly}
              disabled={!nameInput.trim() || !isCpfValid || totalCalculatedCoupons <= 0}
              className="flex-1 md:flex-initial inline-flex items-center justify-center gap-2 px-5 py-3 text-xs font-extrabold uppercase tracking-wider bg-emerald-700 hover:bg-emerald-600 text-white rounded-lg shadow-sm hover:shadow-md transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
              title={
                !isCpfValid
                  ? 'Digite um CPF válido da Receita Federal'
                  : totalCalculatedCoupons <= 0
                  ? 'Selecione ou insira cupons para salvar'
                  : 'Salva todo o cadastro do cliente e os cupons gerados no sistema sem disparar a impressão agora'
              }
            >
              <Save className="w-4 h-4" />
              Salvar no Sistema
            </button>

            {/* Botão Pré-Visualizar */}
            <button
              type="button"
              onClick={handlePreview}
              disabled={totalCalculatedCoupons <= 0 || !isCpfValid}
              className="flex-1 md:flex-initial inline-flex items-center justify-center gap-2 px-4 py-3 text-xs font-bold uppercase tracking-wider bg-neutral-800 hover:bg-neutral-700 text-white rounded-lg border border-neutral-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              title="Ver pré-visualização da bobina térmica de 80mm com as 2 vias e linha de corte"
            >
              <Eye className="w-4 h-4" />
              Pré-Visualizar
            </button>

            {/* Botão Salvar e Imprimir */}
            <button
              type="submit"
              disabled={totalCalculatedCoupons <= 0 || !nameInput.trim() || !isCpfValid}
              className="flex-1 md:flex-initial inline-flex items-center justify-center gap-2 px-6 py-3 text-xs font-extrabold uppercase tracking-wider bg-red-600 hover:bg-red-500 text-white rounded-lg shadow-md hover:shadow-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed active:scale-95"
              title={
                !isCpfValid
                  ? 'Digite um CPF autêntico e válido para emitir'
                  : totalCalculatedCoupons <= 0
                  ? 'Adicione cupons para emitir'
                  : 'Salva o cadastro e os cupons no sistema e imprime as 2 vias na Elgin i9'
              }
            >
              <Printer className="w-4 h-4" />
              Salvar e Imprimir na Elgin i9
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};
