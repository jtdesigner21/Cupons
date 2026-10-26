import React, { useState, useEffect, useCallback } from 'react';
import {
  Printer,
  Settings as SettingsIcon,
  Sparkles,
  CheckCircle,
  AlertTriangle,
  ShieldCheck,
  Database,
  Clock,
} from 'lucide-react';
import { CampaignSettings, Coupon, Customer } from './types';
import {
  loadCustomers,
  saveCustomers,
  loadCoupons,
  saveCoupons,
  loadSettings,
  saveSettings,
  getNextCouponNumber,
  resetDatabase,
  markCouponsAsPrintedLocal,
  DEFAULT_SETTINGS,
} from './utils/storage';
import {
  syncWithServer,
  saveCustomerToServer,
  saveCouponsToServer,
  saveSettingsToServer,
  resetServerDatabase,
  fetchServerHealth,
  restoreServerBackup,
  markCouponsAsPrintedOnServer,
} from './services/api';
import { groupCouponsIntoBatches } from './utils/formatters';
import { PDVForm } from './components/PDVForm';
import { CouponHistory } from './components/CouponHistory';
import { CouponValidator } from './components/CouponValidator';
import { ThermalReceipt } from './components/ThermalReceipt';
import { PrintPreviewModal } from './components/PrintPreviewModal';
import { SettingsModal } from './components/SettingsModal';

export default function App() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [settings, setSettings] = useState<CampaignSettings>(loadSettings);
  const [activeTab, setActiveTab] = useState<'pdv' | 'history' | 'validator' | 'guide'>('pdv');

  // Modais
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewCoupons, setPreviewCoupons] = useState<Coupon[]>([]);
  const [previewTitle, setPreviewTitle] = useState<string>('');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Status de sincronização com o servidor
  const [isServerSynced, setIsServerSynced] = useState<boolean>(false);
  const [isSyncing, setIsSyncing] = useState<boolean>(true);

  // Cupons ativos para disparo de impressão (alimentam a div .print-only)
  const [printQueue, setPrintQueue] = useState<Coupon[]>([]);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Carrega dados na inicialização sincronizando com o servidor permanente
  useEffect(() => {
    // 1. Carrega dados locais de imediato para UI rápida
    const loadedCust = loadCustomers();
    const loadedCoup = loadCoupons();
    const loadedSettings = loadSettings();
    setCustomers(loadedCust);
    setCoupons(loadedCoup);
    setSettings(loadedSettings);

    // 2. Consulta o servidor e sincroniza base permanente
    (async () => {
      try {
        setIsSyncing(true);
        const serverData = await syncWithServer();
        if (serverData && serverData.serverOnline) {
          setIsServerSynced(true);
          setCustomers(serverData.customers);
          setCoupons(serverData.coupons);
          if (serverData.settings) {
            const step = serverData.settings.purchaseValueStep || 60;
            const minVal = serverData.settings.minPurchaseValue && serverData.settings.minPurchaseValue <= 60
              ? serverData.settings.minPurchaseValue
              : 60;
            setSettings({
              ...DEFAULT_SETTINGS,
              ...serverData.settings,
              purchaseValueStep: step,
              minPurchaseValue: minVal,
              maxPurchaseCoupons: serverData.settings.maxPurchaseCoupons ?? DEFAULT_SETTINGS.maxPurchaseCoupons,
            });
          }
        } else {
          setIsServerSynced(false);
        }
      } catch (err) {
        console.warn('Erro ao conectar ao servidor:', err);
        setIsServerSynced(false);
      } finally {
        setIsSyncing(false);
      }
    })();
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Reset completo do banco de dados no servidor e no sistema
  const handleResetDatabase = async () => {
    if (
      confirm(
        'Tem certeza que deseja zerar o banco de dados? Todos os clientes e cupons serão excluídos permanentemente do servidor e a numeração voltará ao início (#0001).'
      )
    ) {
      await resetServerDatabase();
      resetDatabase();
      setCustomers([]);
      setCoupons([]);
      showToast('✓ Banco de dados do servidor zerado com sucesso! Pronto para início oficial.');
    }
  };

  // Recarrega todos os dados do servidor
  const handleRefreshData = useCallback(async () => {
    setIsSyncing(true);
    const serverData = await syncWithServer();
    if (serverData && serverData.serverOnline) {
      setCustomers(serverData.customers);
      setCoupons(serverData.coupons);
      if (serverData.settings) setSettings(serverData.settings);
      setIsServerSynced(true);
    } else {
      setCustomers(loadCustomers());
      setCoupons(loadCoupons());
      setSettings(loadSettings());
    }
    setIsSyncing(false);
  }, []);

  // Salva ou atualiza cliente tanto no servidor quanto no sistema
  const handleSaveCustomer = useCallback((customer: Customer, notify: boolean = true) => {
    setCustomers((prev) => {
      const idx = prev.findIndex((c) => c.cpf === customer.cpf);
      let updated: Customer[];
      if (idx >= 0) {
        updated = [...prev];
        updated[idx] = customer;
      } else {
        updated = [customer, ...prev];
      }
      saveCustomers(updated);
      return updated;
    });

    // Envia gravação permanente para o servidor
    saveCustomerToServer(customer).then((ok) => {
      if (ok) setIsServerSynced(true);
    });

    if (notify) {
      showToast(`✓ Cadastro de ${customer.name} salvo com sucesso no servidor e no sistema!`);
    }
  }, []);

  // Valida e registra a impressão dos cupons no sistema e no servidor
  const handleMarkCouponsPrinted = useCallback((couponIds: string[]) => {
    if (!couponIds || couponIds.length === 0) return;
    const printTime = new Date().toISOString();

    // 1. Atualiza estado na memória do React
    setCoupons((prev) =>
      prev.map((c) =>
        couponIds.includes(c.id) ? { ...c, printedAt: c.printedAt || printTime } : c
      )
    );

    // 2. Atualiza armazenamento local
    markCouponsAsPrintedLocal(couponIds, printTime);

    // 3. Atualiza no servidor sem mexer/resetar registros
    markCouponsAsPrintedOnServer(couponIds, printTime);
  }, []);

  // Disparo da impressão via navegador para o driver da Elgin i9 com validação imediata
  const triggerBrowserPrint = (couponsToPrint: Coupon[]) => {
    if (!couponsToPrint || couponsToPrint.length === 0) return;

    // Valida imediatamente a impressão para todos os cupons impressos
    const ids = couponsToPrint.map((c) => c.id);
    handleMarkCouponsPrinted(ids);

    const printTime = new Date().toISOString();
    const primedCoupons = couponsToPrint.map((c) => ({
      ...c,
      printedAt: c.printedAt || printTime,
    }));

    setPrintQueue(primedCoupons);
    // Timeout para o React montar o DOM de impressão antes do window.print()
    setTimeout(() => {
      window.print();
    }, 150);
  };

  // Emissão e salvamento/impressão de cupons
  const handleGenerateCoupons = (
    newCoupons: Coupon[],
    customer: Customer,
    printImmediately: boolean = true
  ) => {
    // 1. Salva cliente
    handleSaveCustomer(customer, false);

    // 2. Se for para imprimir imediatamente, já valida a impressão de imediato
    const printTime = printImmediately ? new Date().toISOString() : undefined;
    const finalCoupons = newCoupons.map((c) => ({
      ...c,
      printedAt: printTime || c.printedAt,
    }));

    // 3. Salva cupons se houver
    if (finalCoupons.length > 0) {
      const updatedCoupons = [...finalCoupons, ...coupons];
      setCoupons(updatedCoupons);
      saveCoupons(updatedCoupons);

      // Persiste no arquivo de dados do servidor
      saveCouponsToServer(finalCoupons, customer).then((ok) => {
        if (ok) setIsServerSynced(true);
      });
    }

    // 4. Notifica e dispara impressão na Elgin i9 se solicitado
    if (printImmediately && finalCoupons.length > 0) {
      showToast(
        `✓ Sucesso! ${finalCoupons.length} cupom(ns) impressos e validados para ${customer.name}. Enviando para Elgin i9...`
      );
      triggerBrowserPrint(finalCoupons);
    } else if (finalCoupons.length > 0) {
      showToast(
        `✓ Sucesso! ${finalCoupons.length} cupom(ns) salvos (Pendentes de Impressão) para ${customer.name}!`
      );
    } else {
      showToast(`✓ Cadastro de ${customer.name} salvo com sucesso no servidor e no sistema!`);
    }
  };

  // Reimprimir um cupom específico
  const handleReprintCoupon = (coupon: Coupon) => {
    showToast(`Reimprimindo cupom ${coupon.formattedNumber} na Elgin i9...`);
    triggerBrowserPrint([coupon]);
  };

  // Reimprimir todos os cupons de um cliente
  const handleReprintCustomerBatch = (customerCpf: string) => {
    const clientCoupons = coupons.filter((c) => c.cpf === customerCpf);
    if (clientCoupons.length === 0) return;
    showToast(`Reimprimindo lote de ${clientCoupons.length} cupom(ns) na Elgin i9...`);
    triggerBrowserPrint(clientCoupons);
  };

  // Contagem de impressoras vendidas
  const totalPrintersSold = coupons
    .filter((c) => c.origin === 'printer')
    .reduce((sum, c) => sum + (c.printerCount || 1), 0);

  return (
    <div className="min-h-screen bg-neutral-100 text-neutral-900 flex flex-col font-sans">
      {/* ======================================================== */}
      {/* ÁREA EXCLUSIVA DE IMPRESSÃO (INVISÍVEL NA TELA, VISÍVEL NO PRINT) */}
      {/* ======================================================== */}
      <div className="print-only">
        <ThermalReceipt coupons={printQueue} settings={settings} />
      </div>

      {/* ======================================================== */}
      {/* CONTEÚDO NORMAL DA TELA (OCULTADO NO PRINT) */}
      {/* ======================================================== */}
      <div className="no-print flex-1 flex flex-col">
        {/* TOP BAR CONTRACT: Brand — Nav Links — Action */}
        <header className="flex items-center justify-between gap-8 px-6 py-4 bg-white border-b border-neutral-200 sticky top-0 z-30 shadow-2xs">
          {/* Zona 1: Brand Wordmark */}
          <div className="flex items-center gap-3 whitespace-nowrap shrink-0">
            <div className="w-9 h-9 rounded-lg bg-red-600 flex items-center justify-center text-white font-extrabold shadow-xs">
              SJ
            </div>
            <div>
              <span className="text-base font-extrabold tracking-tight text-neutral-900 block leading-tight">
                {settings.storeName}
              </span>
              <span className="text-[11px] font-semibold text-neutral-500 block leading-tight">
                {settings.subtitle} · Elgin i9
              </span>
            </div>
          </div>

          {/* Zona 2: Links / Abas do Sistema */}
          <nav className="hidden md:flex items-center gap-1 bg-neutral-100 p-1 rounded-lg text-xs font-semibold">
            <button
              onClick={() => setActiveTab('pdv')}
              className={`px-3.5 py-2 rounded-md transition-colors whitespace-nowrap shrink-0 ${
                activeTab === 'pdv'
                  ? 'bg-white text-neutral-900 shadow-xs'
                  : 'text-neutral-600 hover:text-neutral-900'
              }`}
            >
              Balcão (Emissão)
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`px-3.5 py-2 rounded-md transition-colors whitespace-nowrap shrink-0 ${
                activeTab === 'history'
                  ? 'bg-white text-neutral-900 shadow-xs'
                  : 'text-neutral-600 hover:text-neutral-900'
              }`}
            >
              Cadastrados & Cupons ({coupons.length})
            </button>
            <button
              onClick={() => setActiveTab('validator')}
              className={`px-3.5 py-2 rounded-md transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
                activeTab === 'validator'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-neutral-600 hover:text-neutral-900'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
              Checar Cupom
            </button>
            <button
              onClick={() => setActiveTab('guide')}
              className={`px-3.5 py-2 rounded-md transition-colors whitespace-nowrap shrink-0 ${
                activeTab === 'guide'
                  ? 'bg-white text-neutral-900 shadow-xs'
                  : 'text-neutral-600 hover:text-neutral-900'
              }`}
            >
              Guia Elgin i9
            </button>
          </nav>

          {/* Zona 3: Ação Primária & Configurações */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Indicador de Gravação no Servidor */}
            <div
              className={`hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[11px] font-bold ${
                isSyncing
                  ? 'bg-neutral-50 text-neutral-500 border-neutral-200'
                  : isServerSynced
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  : 'bg-amber-50 text-amber-800 border-amber-200'
              }`}
              title="Todos os dados são gravados permanentemente no servidor no arquivo coupons_db.json"
            >
              <Database className="w-3.5 h-3.5 shrink-0" />
              <span>
                {isSyncing
                  ? 'Sincronizando...'
                  : isServerSynced
                  ? 'Servidor: Salvo & Conectado'
                  : 'Modo Local'}
              </span>
            </div>

            <button
              onClick={() => setActiveTab('validator')}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 rounded-lg border border-emerald-200 transition-colors whitespace-nowrap shrink-0"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              Validar Cupom
            </button>

            <button
              onClick={() => setIsSettingsOpen(true)}
              className="p-2 text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 rounded-lg border border-neutral-200 transition-colors shrink-0"
              title="Configurações da Campanha"
            >
              <SettingsIcon className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* ESTATÍSTICAS E PLACAR DA CAMPANHA (Conforme documento do anexo) */}
        <section className="bg-white border-b border-neutral-200 px-6 py-4">
          <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-red-600 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                Promoção Oficial
              </div>
              <h1 className="text-xl md:text-2xl font-extrabold text-neutral-900 tracking-tight mt-0.5">
                {settings.prizeName}
              </h1>
              <p className="text-xs text-neutral-500">
                Direito a <strong>3 cupons grátis por CPF</strong> (2 visita + 1 Instagram) · <strong>Compras</strong>: mín. R$ {settings.minPurchaseValue ?? 60} (+1 cupom a cada R$ {settings.purchaseValueStep ?? 100}, máx. {settings.maxPurchaseCoupons ?? 10} cupons por compra) · +{settings.printerBonusCoupons} cupons por impressora 3D
              </p>
            </div>

            {/* Marcadores de Placar Tabulares */}
            <div className="flex items-center gap-4 bg-neutral-50 px-5 py-2.5 rounded-xl border border-neutral-200 text-center">
              <div>
                <span className="text-2xl md:text-3xl font-black font-mono text-neutral-900 tabular-nums block leading-none">
                  {customers.length}
                </span>
                <span className="text-[11px] font-bold text-neutral-500 uppercase tracking-wide">
                  CPFs
                </span>
              </div>

              <div className="w-px h-8 bg-neutral-200"></div>

              <div>
                <span className="text-2xl md:text-3xl font-black font-mono text-red-600 tabular-nums block leading-none">
                  {coupons.length}
                </span>
                <span className="text-[11px] font-bold text-neutral-500 uppercase tracking-wide">
                  Cupons
                </span>
              </div>

              <div className="w-px h-8 bg-neutral-200 hidden sm:block"></div>

              <div className="hidden sm:block">
                <span className="text-2xl md:text-3xl font-black font-mono text-purple-700 tabular-nums block leading-none">
                  {totalPrintersSold}
                </span>
                <span className="text-[11px] font-bold text-neutral-500 uppercase tracking-wide">
                  Impressoras
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* FEEDBACK TOAST / NOTIFICAÇÃO TEMPORÁRIA */}
        {toastMessage && (
          <div className="fixed bottom-6 right-6 z-50 bg-neutral-900 text-white px-5 py-3 rounded-xl shadow-xl flex items-center gap-3 border border-neutral-800 text-xs font-semibold animate-in fade-in slide-in-from-bottom-2">
            <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{toastMessage}</span>
          </div>
        )}

        {/* CORPO PRINCIPAL */}
        <main className="max-w-6xl w-full mx-auto p-4 md:p-6 flex-1 space-y-6">
          {activeTab === 'pdv' && (
            <div className="space-y-6">
              <PDVForm
                settings={settings}
                customers={customers}
                coupons={coupons}
                onSaveCustomer={handleSaveCustomer}
                onGenerateCoupons={handleGenerateCoupons}
                onOpenPreview={(prev) => {
                  setPreviewCoupons(prev);
                  setPreviewTitle('Pré-Visualização do Atendimento');
                  setIsPreviewOpen(true);
                }}
              />

              {/* Tabela de Últimas Compras / Atendimentos no Balcão */}
              <div className="bg-white border border-neutral-200 rounded-xl p-5 shadow-2xs">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-500">
                      Últimas Compras e Atendimentos
                    </h3>
                    <p className="text-[11px] text-neutral-400">
                      Clique em qualquer compra para abrir o PDF e imprimir na Elgin i9
                    </p>
                  </div>
                  <button
                    onClick={() => setActiveTab('history')}
                    className="text-xs font-semibold text-red-600 hover:text-red-700"
                  >
                    Ver todos os clientes e compras →
                  </button>
                </div>

                {coupons.length === 0 ? (
                  <p className="text-xs text-neutral-400 py-4 text-center">
                    Nenhuma compra registrada ainda. Utilize o formulário acima para o primeiro atendimento.
                  </p>
                ) : (
                  <div className="divide-y divide-neutral-100 text-xs">
                    {groupCouponsIntoBatches(coupons).slice(0, 4).map((b) => (
                      <div
                        key={b.batchId}
                        onClick={() => {
                          setPreviewCoupons(b.coupons);
                          setPreviewTitle(`Compra de ${b.customerName} · ${b.summary}`);
                          setIsPreviewOpen(true);
                        }}
                        className="py-3 flex items-center justify-between gap-4 hover:bg-neutral-50/70 p-2 rounded-lg cursor-pointer transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <span className="font-mono font-bold bg-neutral-100 text-neutral-800 border border-neutral-200 px-2 py-1 rounded text-xs shrink-0">
                            {b.totalCoupons} {b.totalCoupons === 1 ? 'cupom' : 'cupons'}
                          </span>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-neutral-900 uppercase">{b.customerName}</span>
                              {b.hasPendingPrint ? (
                                <span className="inline-flex items-center gap-1 font-bold bg-amber-50 text-amber-800 border border-amber-300 px-1.5 py-0.2 rounded text-[10px]">
                                  <Clock className="w-2.5 h-2.5 text-amber-600" />
                                  Precisa Imprimir
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 px-1.5 py-0.2 rounded text-[10px]">
                                  <CheckCircle className="w-2.5 h-2.5 text-emerald-600" />
                                  Impresso
                                </span>
                              )}
                            </div>
                            <span className="text-neutral-600 text-[11px] block font-medium">
                              {b.summary} · Faixa: {b.startNumber}
                              {b.totalCoupons > 1 ? ` a ${b.endNumber}` : ''}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 shrink-0">
                          <span className="font-mono text-[11px] text-neutral-400 hidden sm:inline">
                            {b.coupons[0]?.verificationCode}
                          </span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setPreviewCoupons(b.coupons);
                              setPreviewTitle(`Compra de ${b.customerName} · ${b.summary}`);
                              setIsPreviewOpen(true);
                            }}
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white rounded-lg shadow-2xs transition-colors ${
                              b.hasPendingPrint
                                ? 'bg-amber-600 hover:bg-amber-500'
                                : 'bg-neutral-900 hover:bg-red-600'
                            }`}
                          >
                            <Printer className="w-3.5 h-3.5" />
                            {b.hasPendingPrint ? 'Imprimir Agora' : 'Reimprimir / PDF'}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'history' && (
            <CouponHistory
              coupons={coupons}
              customers={customers}
              settings={settings}
              onOpenPurchasePDF={(batch) => {
                setPreviewCoupons(batch.coupons);
                setPreviewTitle(`Compra de ${batch.customerName} · ${batch.summary}`);
                setIsPreviewOpen(true);
              }}
              onReprintCoupon={handleReprintCoupon}
              onRefreshData={handleRefreshData}
              onResetDatabase={handleResetDatabase}
            />
          )}

          {activeTab === 'validator' && (
            <CouponValidator
              coupons={coupons}
              settings={settings}
              onReprintCoupon={handleReprintCoupon}
            />
          )}

          {activeTab === 'guide' && (
            <div className="bg-white border border-neutral-200 rounded-xl p-6 shadow-xs space-y-6">
              <div>
                <h2 className="text-lg font-bold text-neutral-900 flex items-center gap-2">
                  <Printer className="w-5 h-5 text-red-600" />
                  Guia de Configuração da Impressora Térmica Elgin i9
                </h2>
                <p className="text-xs text-neutral-500 mt-1">
                  Instruções para garantir que a impressão saia perfeita na bobina de 80mm com guilhotina e corte automático.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs text-neutral-700">
                <div className="p-4 bg-neutral-50 rounded-xl border border-neutral-200 space-y-3">
                  <h4 className="font-bold text-neutral-900 text-sm">
                    1. No Elgin Utility (Driver da Elgin)
                  </h4>
                  <ul className="list-disc pl-5 space-y-2 leading-relaxed">
                    <li>
                      Abra o software <strong>Elgin i9 Utility</strong> fornecido pela Elgin (ou Propriedades da Impressora no Windows).
                    </li>
                    <li>
                      Na aba <strong>Configurações de Papel</strong>, selecione a largura de <strong>80mm</strong> (área de 72mm).
                    </li>
                    <li>
                      Na seção <strong>Corte de Papel (Guilhotina)</strong>, selecione <strong>"Corte após cada página" (Cut after each page)</strong>.
                    </li>
                    <li>
                      Dessa forma, a máquina imprime a <strong>Via do Cliente</strong> e <strong>corta</strong>, depois imprime a <strong>Via da Urna</strong> e <strong>corta novamente</strong>, saindo já separadas de fábrica!
                    </li>
                  </ul>
                </div>

                <div className="p-4 bg-neutral-50 rounded-xl border border-neutral-200 space-y-3">
                  <h4 className="font-bold text-neutral-900 text-sm">
                    2. Na Janela de Impressão do Navegador (Ctrl+P)
                  </h4>
                  <ul className="list-disc pl-5 space-y-2 leading-relaxed">
                    <li>
                      <strong>Destino:</strong> Selecione a impressora <em>Elgin i9</em>.
                    </li>
                    <li>
                      <strong>Tamanho do Papel:</strong> Selecione <em>80(72) x 297mm</em> ou <em>Continuous / Recibo 80mm</em>.
                    </li>
                    <li>
                      <strong>Margens:</strong> Altere para <strong>Nenhuma</strong> (None).
                    </li>
                    <li>
                      <strong>Opções:</strong> Desmarque <em>"Cabeçalhos e rodapés"</em> para não imprimir data e URL do navegador.
                    </li>
                    <li>
                      <strong>Gráficos de segundo plano:</strong> Marque para garantir contraste das tarjas pretas.
                    </li>
                  </ul>
                </div>
              </div>

              <div className="p-4 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-900 flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <strong className="font-bold block">Como funcionam as 2 vias do cupom:</strong>
                  Ao emitir qualquer cupom, a Elgin i9 imprime a <strong>Via 1 (Cliente)</strong> com
                  as informações da promoção e número exclusivo para o cliente guardar, seguida da
                  linha de picote pontilhada, e logo abaixo a <strong>Via 2 (Urna)</strong> com os
                  dados completos e a linha para o cliente assinar na hora e depositar na urna física da loja.
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* ======================================================== */}
      {/* MODAIS INTERATIVOS */}
      {/* ======================================================== */}
      <PrintPreviewModal
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        coupons={previewCoupons}
        settings={settings}
        purchaseTitle={previewTitle}
        onConfirmPrint={() => {
          triggerBrowserPrint(previewCoupons);
        }}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onSave={(newSettings) => {
          setSettings(newSettings);
          saveSettingsToServer(newSettings).then((ok) => {
            if (ok) setIsServerSynced(true);
          });
          showToast('✓ Configurações da campanha salvas com sucesso no servidor e no sistema!');
        }}
      />
    </div>
  );
}
