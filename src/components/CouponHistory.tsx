import React, { useState, useMemo } from 'react';
import {
  Search,
  Printer,
  User,
  Instagram,
  Phone,
  FileSpreadsheet,
  CheckCircle,
  Copy,
  ChevronDown,
  ChevronRight,
  Database,
  Upload,
  ShoppingBag,
  Clock,
  Trash2,
} from 'lucide-react';
import { Coupon, Customer, CampaignSettings, PurchaseBatch } from '../types';
import {
  formatCPF,
  formatDateTime,
  formatPhone,
  maskCPF,
  groupCouponsIntoBatches,
} from '../utils/formatters';
import { exportCouponsToCSV, exportBackupJSON, importBackupJSON } from '../utils/storage';
import { restoreServerBackup } from '../services/api';

interface CouponHistoryProps {
  coupons: Coupon[];
  customers: Customer[];
  settings: CampaignSettings;
  onOpenPurchasePDF: (batch: PurchaseBatch) => void;
  onReprintCoupon: (coupon: Coupon) => void;
  onRefreshData: () => void;
  onResetDatabase: () => void;
}

export const CouponHistory: React.FC<CouponHistoryProps> = ({
  coupons,
  customers,
  settings,
  onOpenPurchasePDF,
  onReprintCoupon,
  onRefreshData,
  onResetDatabase,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'customers' | 'allPurchases' | 'singleCoupons'>('customers');
  const [printFilter, setPrintFilter] = useState<'all' | 'pending' | 'printed'>('all');
  const [expandedCustomerCpf, setExpandedCustomerCpf] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Contagens de impressão
  const totalPendingCoupons = useMemo(() => coupons.filter((c) => !c.printedAt).length, [coupons]);
  const totalPrintedCoupons = useMemo(() => coupons.filter((c) => Boolean(c.printedAt)).length, [coupons]);

  // Agrupa todos os cupons em Compras / Lotes de Atendimento
  const allBatches = useMemo(() => {
    return groupCouponsIntoBatches(coupons);
  }, [coupons]);

  // Mapa de compras por CPF
  const batchesByCpf = useMemo(() => {
    const map = new Map<string, PurchaseBatch[]>();
    allBatches.forEach((b) => {
      if (!map.has(b.cpf)) {
        map.set(b.cpf, []);
      }
      map.get(b.cpf)!.push(b);
    });
    return map;
  }, [allBatches]);

  // Filtragem dos clientes
  const filteredCustomers = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    const cleanTerm = term.replace(/\D/g, '');

    return customers.filter((c) => {
      const clientBatches = batchesByCpf.get(c.cpf) || [];

      // Filtro de impressão
      if (printFilter === 'pending' && !clientBatches.some((b) => b.hasPendingPrint)) {
        return false;
      }
      if (printFilter === 'printed' && !clientBatches.some((b) => b.printedCount > 0)) {
        return false;
      }

      if (!term) return true;
      const matchName = c.name.toLowerCase().includes(term);
      const matchCpf = cleanTerm ? c.cpf.includes(cleanTerm) : false;
      const matchPhone = c.whatsapp ? c.whatsapp.includes(cleanTerm || term) : false;
      const matchInsta = c.instagram ? c.instagram.toLowerCase().includes(term) : false;

      // Também busca se alguma compra desse cliente contém o termo
      const matchBatch = clientBatches.some(
        (b) =>
          b.summary.toLowerCase().includes(term) ||
          b.coupons.some((cp) => cp.formattedNumber.toLowerCase().includes(term))
      );

      return matchName || matchCpf || matchPhone || matchInsta || matchBatch;
    });
  }, [customers, searchTerm, batchesByCpf, printFilter]);

  // Filtragem de todas as compras
  const filteredBatches = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    const cleanTerm = term.replace(/\D/g, '');

    return allBatches.filter((b) => {
      if (printFilter === 'pending' && !b.hasPendingPrint) return false;
      if (printFilter === 'printed' && !b.isFullyPrinted) return false;

      if (!term) return true;
      return (
        b.customerName.toLowerCase().includes(term) ||
        (cleanTerm && b.cpf.includes(cleanTerm)) ||
        (b.customerWhatsapp && b.customerWhatsapp.includes(cleanTerm || term)) ||
        (b.customerInstagram && b.customerInstagram.toLowerCase().includes(term)) ||
        b.summary.toLowerCase().includes(term) ||
        b.coupons.some(
          (cp) =>
            cp.formattedNumber.toLowerCase().includes(term) ||
            cp.verificationCode.toLowerCase().includes(term)
        )
      );
    });
  }, [allBatches, searchTerm, printFilter]);

  // Filtragem de cupons individuais para auditoria
  const filteredSingleCoupons = useMemo(() => {
    let list = coupons;
    if (printFilter === 'pending') {
      list = list.filter((c) => !c.printedAt);
    } else if (printFilter === 'printed') {
      list = list.filter((c) => Boolean(c.printedAt));
    }
    if (!searchTerm.trim()) return list;
    const term = searchTerm.toLowerCase().trim();
    const cleanTerm = term.replace(/\D/g, '');
    return list.filter((c) =>
      c.customerName.toLowerCase().includes(term) ||
      (cleanTerm && c.cpf.includes(cleanTerm)) ||
      c.formattedNumber.toLowerCase().includes(term) ||
      c.verificationCode.toLowerCase().includes(term) ||
      c.originLabel.toLowerCase().includes(term)
    );
  }, [coupons, searchTerm, printFilter]);

  // Cópia de código
  const handleCopy = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  // Upload de backup com persistência no servidor
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      const content = event.target?.result as string;
      if (content) {
        const success = importBackupJSON(content);
        if (success) {
          try {
            const data = JSON.parse(content);
            await restoreServerBackup(data);
          } catch (err) {
            console.error('Erro ao sincronizar backup com servidor:', err);
          }
          alert('✓ Backup restaurado com sucesso no servidor e no sistema!');
          onRefreshData();
        } else {
          alert('Erro ao processar o arquivo de backup.');
        }
      }
    };
    reader.readAsText(file);
  };

  // Alterna expansão de um cliente
  const toggleCustomer = (cpf: string) => {
    setExpandedCustomerCpf((prev) => (prev === cpf ? null : cpf));
  };

  return (
    <div className="bg-white border border-neutral-200 rounded-xl shadow-xs overflow-hidden">
      {/* Topo com Título e Ações */}
      <div className="p-5 border-b border-neutral-200 bg-neutral-50/70 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-bold text-neutral-900 flex items-center gap-2">
            <User className="w-5 h-5 text-neutral-700" />
            Clientes e Compras Realizadas
          </h3>
          <p className="text-xs text-neutral-500 mt-0.5">
            Clique no cliente e selecione a compra daquela hora para abrir o PDF e imprimir na Elgin i9
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Seletor de Modo de Exibição */}
          <div className="flex items-center p-1 bg-neutral-200/70 rounded-lg text-xs font-semibold">
            <button
              onClick={() => setViewMode('customers')}
              className={`px-3 py-1.5 rounded-md transition-colors ${
                viewMode === 'customers'
                  ? 'bg-white text-neutral-900 shadow-xs'
                  : 'text-neutral-600 hover:text-neutral-900'
              }`}
            >
              Por Cliente ({customers.length})
            </button>
            <button
              onClick={() => setViewMode('allPurchases')}
              className={`px-3 py-1.5 rounded-md transition-colors ${
                viewMode === 'allPurchases'
                  ? 'bg-white text-neutral-900 shadow-xs'
                  : 'text-neutral-600 hover:text-neutral-900'
              }`}
            >
              Todas as Compras ({allBatches.length})
            </button>
            <button
              onClick={() => setViewMode('singleCoupons')}
              className={`px-3 py-1.5 rounded-md transition-colors ${
                viewMode === 'singleCoupons'
                  ? 'bg-white text-neutral-900 shadow-xs'
                  : 'text-neutral-600 hover:text-neutral-900'
              }`}
            >
              Auditoria ({coupons.length})
            </button>
          </div>

          {/* Exportar CSV */}
          <button
            onClick={() => exportCouponsToCSV(coupons)}
            disabled={coupons.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition-colors disabled:opacity-40"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
            Exportar CSV
          </button>

          {/* Backup */}
          <button
            onClick={exportBackupJSON}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-neutral-700 bg-white border border-neutral-300 rounded-lg hover:bg-neutral-100 transition-colors"
          >
            <Database className="w-3.5 h-3.5 text-neutral-500" />
            Backup
          </button>

          <label className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-neutral-700 bg-white border border-neutral-300 rounded-lg hover:bg-neutral-100 transition-colors cursor-pointer">
            <Upload className="w-3.5 h-3.5 text-neutral-500" />
            Restaurar
            <input type="file" accept=".json" onChange={handleFileUpload} className="hidden" />
          </label>

          {/* Resetar Banco */}
          <button
            onClick={onResetDatabase}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-red-700 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors"
            title="Apaga todos os registros para início oficial"
          >
            <Trash2 className="w-3.5 h-3.5 text-red-600" />
            Resetar Banco
          </button>
        </div>
      </div>

      {/* Barra de Pesquisa e Filtro de Impressão */}
      <div className="p-4 border-b border-neutral-200 bg-white space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
            <input
              type="text"
              placeholder="Buscar cliente por nome, CPF, WhatsApp, nº de cupom ou @instagram..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm rounded-lg border border-neutral-200 focus:border-red-500 focus:ring-2 focus:ring-red-100 outline-hidden"
            />
          </div>

          {/* Filtro Rápido de Status de Impressão */}
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider">
              Impressão:
            </span>
            <div className="flex items-center p-0.5 bg-neutral-100 rounded-lg text-xs font-semibold border border-neutral-200">
              <button
                onClick={() => setPrintFilter('all')}
                className={`px-2.5 py-1 rounded-md transition-colors ${
                  printFilter === 'all'
                    ? 'bg-white text-neutral-900 shadow-2xs'
                    : 'text-neutral-600 hover:text-neutral-900'
                }`}
              >
                Todos ({coupons.length})
              </button>
              <button
                onClick={() => setPrintFilter('pending')}
                className={`px-2.5 py-1 rounded-md transition-colors flex items-center gap-1 ${
                  printFilter === 'pending'
                    ? 'bg-amber-600 text-white shadow-2xs font-bold'
                    : 'text-amber-800 hover:bg-amber-100/60 font-semibold'
                }`}
              >
                <Clock className="w-3 h-3" />
                Precisa Imprimir ({totalPendingCoupons})
              </button>
              <button
                onClick={() => setPrintFilter('printed')}
                className={`px-2.5 py-1 rounded-md transition-colors flex items-center gap-1 ${
                  printFilter === 'printed'
                    ? 'bg-emerald-600 text-white shadow-2xs font-bold'
                    : 'text-emerald-800 hover:bg-emerald-100/60 font-semibold'
                }`}
              >
                <CheckCircle className="w-3 h-3" />
                Já Impressos ({totalPrintedCoupons})
              </button>
            </div>
          </div>
        </div>

        {/* Notificação de Cupons Aguardando Impressão */}
        {totalPendingCoupons > 0 && printFilter !== 'pending' && (
          <div className="p-2.5 px-3.5 bg-amber-50 border border-amber-300 rounded-lg text-xs text-amber-950 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-600 shrink-0" />
              <span>
                <strong>{totalPendingCoupons} cupom(ns) aguardando impressão física na Elgin i9.</strong> Ao clicar para imprimir, o sistema valida a impressão automaticamente.
              </span>
            </div>
            <button
              onClick={() => setPrintFilter('pending')}
              className="text-xs font-bold text-amber-900 underline hover:text-amber-950 shrink-0"
            >
              Filtrar apenas pendentes de impressão →
            </button>
          </div>
        )}
      </div>

      {/* CONTEÚDO PRINCIPAL 1: MODO CLIENTES COM SUAS COMPRAS AGRUPADAS */}
      {viewMode === 'customers' && (
        <div className="divide-y divide-neutral-200">
          {filteredCustomers.length === 0 ? (
            <div className="p-12 text-center text-neutral-400">
              <p className="text-sm font-medium">Nenhum cliente encontrado.</p>
              <p className="text-xs text-neutral-400 mt-1">
                Cadastre um cliente no balcão para emitir e imprimir cupons.
              </p>
            </div>
          ) : (
            filteredCustomers.map((cust) => {
              const clientBatches = batchesByCpf.get(cust.cpf) || [];
              const totalCustomerCoupons = clientBatches.reduce((acc, b) => acc + b.totalCoupons, 0);
              const isExpanded = expandedCustomerCpf === cust.cpf;

              return (
                <div key={cust.cpf} className="transition-colors">
                  {/* Linha do Cliente (Clicável) */}
                  <div
                    onClick={() => toggleCustomer(cust.cpf)}
                    className="p-4 px-6 hover:bg-neutral-50/80 cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-3 select-none"
                  >
                    <div className="flex items-center gap-3">
                      <div className="text-neutral-400">
                        {isExpanded ? (
                          <ChevronDown className="w-5 h-5 text-neutral-700" />
                        ) : (
                          <ChevronRight className="w-5 h-5" />
                        )}
                      </div>

                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-bold text-neutral-900 uppercase">
                            {cust.name}
                          </h4>
                          <span className="text-xs font-mono text-neutral-500">
                            {maskCPF(cust.cpf)}
                          </span>
                        </div>

                        <div className="flex items-center gap-3 text-xs text-neutral-500 mt-0.5">
                          {cust.whatsapp && (
                            <span className="flex items-center gap-1 font-mono">
                              <Phone className="w-3 h-3 text-emerald-600" />
                              {formatPhone(cust.whatsapp)}
                            </span>
                          )}
                          {cust.instagram && (
                            <span className="flex items-center gap-1 text-pink-600 font-medium">
                              <Instagram className="w-3 h-3" />
                              {cust.instagram}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Resumo de Compras / Cupons do Cliente */}
                    <div className="flex items-center justify-between md:justify-end gap-3 pl-8 md:pl-0">
                      <div className="text-right">
                        <span className="text-xs font-semibold text-neutral-800 block">
                          {clientBatches.length}{' '}
                          {clientBatches.length === 1 ? 'compra/atendimento' : 'compras/atendimentos'}
                        </span>
                        <span className="text-[11px] text-neutral-500 block">
                          Total acumulado: <strong className="text-neutral-900">{totalCustomerCoupons} cupons</strong>
                        </span>
                      </div>

                      {clientBatches.length === 1 && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpenPurchasePDF(clientBatches[0]);
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-neutral-900 hover:bg-red-600 rounded-lg shadow-2xs transition-colors shrink-0"
                          title="Abrir diretamente o PDF desta compra para imprimir na Elgin i9"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          Abrir PDF da Compra
                        </button>
                      )}

                      <span className="text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg border border-red-200 transition-colors shrink-0">
                        {isExpanded ? 'Ocultar Compras' : clientBatches.length > 1 ? 'Ver Compras' : 'Detalhes'}
                      </span>
                    </div>
                  </div>

                  {/* Detalhes das Compras (Quando o cliente é clicado) */}
                  {isExpanded && (
                    <div className="bg-neutral-50/70 p-4 px-6 border-t border-neutral-100 space-y-3">
                      <div className="text-xs font-bold text-neutral-600 uppercase tracking-wider flex items-center gap-1.5">
                        <ShoppingBag className="w-3.5 h-3.5 text-neutral-500" />
                        Compras e Atendimentos de {cust.name.split(' ')[0]}
                      </div>

                      {clientBatches.length === 0 ? (
                        <p className="text-xs text-neutral-400 py-2">
                          Nenhuma compra registrada para este participante.
                        </p>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {clientBatches.map((batch) => (
                            <div
                              key={batch.batchId}
                              onClick={() => onOpenPurchasePDF(batch)}
                              className="bg-white border border-neutral-200 hover:border-red-400 rounded-xl p-4 shadow-2xs hover:shadow-xs transition-all cursor-pointer group flex flex-col justify-between"
                            >
                              <div>
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex items-center gap-1.5 text-xs text-neutral-500 font-medium">
                                    <Clock className="w-3.5 h-3.5 text-neutral-400" />
                                    <span>{formatDateTime(batch.createdAt)}</span>
                                  </div>
                                  <div className="flex items-center gap-1.5 flex-wrap justify-end">
                                    {batch.hasPendingPrint ? (
                                      <span className="text-[11px] font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-300 flex items-center gap-1">
                                        <Clock className="w-3 h-3 text-amber-600" />
                                        Precisa Imprimir ({batch.totalCoupons - batch.printedCount})
                                      </span>
                                    ) : (
                                      <span className="text-[11px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 flex items-center gap-1">
                                        <CheckCircle className="w-3 h-3 text-emerald-600" />
                                        Já Impresso
                                      </span>
                                    )}
                                    <span className="text-xs font-bold font-mono text-neutral-800 bg-neutral-100 px-2 py-0.5 rounded border border-neutral-200">
                                      {batch.totalCoupons} {batch.totalCoupons === 1 ? 'cupom' : 'cupons'}
                                    </span>
                                  </div>
                                </div>

                                <h5 className="text-sm font-bold text-neutral-900 mt-2 group-hover:text-red-600 transition-colors">
                                  {batch.summary}
                                </h5>

                                <p className="text-xs text-neutral-500 mt-1 font-mono">
                                  Faixa: <strong>{batch.startNumber}</strong>
                                  {batch.totalCoupons > 1 ? ` até ${batch.endNumber}` : ''}
                                </p>
                              </div>

                              <div className="mt-4 pt-3 border-t border-neutral-100 flex items-center justify-between">
                                <span className="text-[11px] text-neutral-400 font-medium">
                                  {batch.totalCoupons * 2} vias (Cliente + Urna)
                                </span>

                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onOpenPurchasePDF(batch);
                                  }}
                                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-extrabold uppercase tracking-wide rounded-lg transition-colors shadow-2xs ${
                                    batch.hasPendingPrint
                                      ? 'bg-amber-600 hover:bg-amber-500 text-white'
                                      : 'bg-neutral-900 group-hover:bg-red-600 text-white'
                                  }`}
                                >
                                  <Printer className="w-3.5 h-3.5" />
                                  {batch.hasPendingPrint ? 'Imprimir Agora (Valida)' : 'Abrir PDF / Reimprimir'}
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* CONTEÚDO 2: MODO TODAS AS COMPRAS (ORDEM CRONOLÓGICA) */}
      {viewMode === 'allPurchases' && (
        <div className="divide-y divide-neutral-100">
          {filteredBatches.length === 0 ? (
            <div className="p-12 text-center text-neutral-400">
              <p className="text-sm font-medium">Nenhuma compra encontrada.</p>
            </div>
          ) : (
            filteredBatches.map((batch) => (
              <div
                key={batch.batchId}
                onClick={() => onOpenPurchasePDF(batch)}
                className="p-4 px-6 hover:bg-neutral-50/80 cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-4 transition-colors"
              >
                <div className="flex items-start gap-4">
                  <div className="p-2.5 rounded-xl bg-neutral-100 text-neutral-700 mt-0.5 shrink-0">
                    <ShoppingBag className="w-5 h-5 text-red-600" />
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-neutral-900 uppercase">
                        {batch.customerName}
                      </span>
                      <span className="text-xs font-mono text-neutral-500">
                        {maskCPF(batch.cpf)}
                      </span>
                    </div>

                    <p className="text-xs font-semibold text-neutral-700 mt-0.5">
                      {batch.summary}
                    </p>

                    <div className="flex items-center gap-3 text-xs text-neutral-400 mt-1 font-mono">
                      <span>{formatDateTime(batch.createdAt)}</span>
                      <span>•</span>
                      <span>
                        Cupons: <strong>{batch.startNumber}</strong>
                        {batch.totalCoupons > 1 ? ` a ${batch.endNumber}` : ''}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between md:justify-end gap-3 pl-14 md:pl-0">
                  <div className="text-right">
                    <div className="flex items-center gap-1.5 justify-end">
                      {batch.hasPendingPrint ? (
                        <span className="text-[11px] font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-300 flex items-center gap-1">
                          <Clock className="w-3 h-3 text-amber-600" />
                          Precisa Imprimir ({batch.totalCoupons - batch.printedCount})
                        </span>
                      ) : (
                        <span className="text-[11px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 flex items-center gap-1">
                          <CheckCircle className="w-3 h-3 text-emerald-600" />
                          Já Impresso
                        </span>
                      )}
                    </div>
                    <span className="text-sm font-extrabold text-neutral-900 font-mono block mt-0.5">
                      {batch.totalCoupons} {batch.totalCoupons === 1 ? 'cupom' : 'cupons'}
                    </span>
                    <span className="text-[11px] text-neutral-500 block">
                      ({batch.totalCoupons * 2} vias térmicas)
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenPurchasePDF(batch);
                    }}
                    className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white rounded-lg shadow-xs transition-colors shrink-0 ${
                      batch.hasPendingPrint
                        ? 'bg-amber-600 hover:bg-amber-500'
                        : 'bg-red-600 hover:bg-red-500'
                    }`}
                  >
                    <Printer className="w-3.5 h-3.5" />
                    {batch.hasPendingPrint ? 'Imprimir Agora (Valida)' : 'Abrir PDF / Reimprimir'}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* CONTEÚDO 3: MODO AUDITORIA DE CUPONS INDIVIDUAIS */}
      {viewMode === 'singleCoupons' && (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-neutral-200 bg-neutral-50/50 text-neutral-500 font-semibold uppercase tracking-wider text-[11px]">
                <th className="py-3 px-4">Nº Cupom</th>
                <th className="py-3 px-4">Participante</th>
                <th className="py-3 px-4">CPF / Contato</th>
                <th className="py-3 px-4">Origem</th>
                <th className="py-3 px-4">Cód. Autenticidade</th>
                <th className="py-3 px-4">Status Impressão</th>
                <th className="py-3 px-4">Data/Hora</th>
                <th className="py-3 px-4 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {filteredSingleCoupons.map((coupon) => (
                <tr key={coupon.id} className="hover:bg-neutral-50/70 transition-colors">
                  <td className="py-3 px-4 font-mono font-bold text-neutral-900 text-sm tabular-nums">
                    <span className="bg-neutral-100 px-2 py-0.5 rounded border border-neutral-200">
                      {coupon.formattedNumber}
                    </span>
                  </td>
                  <td className="py-3 px-4 font-bold text-neutral-900 uppercase">
                    {coupon.customerName}
                  </td>
                  <td className="py-3 px-4 font-mono text-neutral-700">
                    {maskCPF(coupon.cpf)}
                  </td>
                  <td className="py-3 px-4 text-neutral-700">
                    {coupon.originLabel}
                  </td>
                  <td className="py-3 px-4 font-mono text-[11px] text-neutral-600">
                    {coupon.verificationCode}
                  </td>
                  <td className="py-3 px-4">
                    {coupon.printedAt ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200">
                        <CheckCircle className="w-3 h-3 text-emerald-600" />
                        Impresso ({formatDateTime(coupon.printedAt)})
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-bold text-amber-800 bg-amber-50 border border-amber-300">
                        <Clock className="w-3 h-3 text-amber-600" />
                        Precisa ser impresso
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4 font-mono text-neutral-500 text-[11px]">
                    {formatDateTime(coupon.createdAt)}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <button
                      onClick={() => onReprintCoupon(coupon)}
                      className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded shadow-2xs transition-colors ${
                        !coupon.printedAt
                          ? 'bg-amber-600 hover:bg-amber-500 text-white'
                          : 'bg-white hover:bg-neutral-100 text-neutral-700 border border-neutral-300'
                      }`}
                      title={coupon.printedAt ? 'Reimprimir este cupom na Elgin i9' : 'Imprimir agora e validar no sistema'}
                    >
                      <Printer className="w-3 h-3" />
                      {!coupon.printedAt ? 'Imprimir Agora' : 'Reimprimir'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
