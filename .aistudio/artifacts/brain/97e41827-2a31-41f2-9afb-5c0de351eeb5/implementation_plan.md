# Sistema de Cadastro e Impressão de Cupons Térmicos Elgin i9

Sistema profissional de gestão, cadastro de clientes, emissão automatizada e impressão térmica em bobina de 80mm para a impressora Elgin i9, com geração simultânea de duas vias destacáveis (Guia do Cliente e Guia da Urna com assinatura), controle de cupons promocionais e regras estritas de segurança.

---

### Decisões e Regras Oficiais Integradas

> [!IMPORTANT]
> **Regras Oficiais da Campanha Loja SJ:**
> - **Autenticação e Validação de CPF**: O CPF deve ser matematicamente autêntico e válido (conforme algoritmo oficial da Receita Federal com validação de dígitos verificadores Módulo 11). CPFs inválidos são bloqueados para cadastro e emissão.
> - **Regra dos 3 Cupons Grátis por CPF**: A restrição de uso único por CPF aplica-se **estritamente e exclusivamente aos 3 cupons gratuitos** (2 por visita à loja + 1 por seguir no Instagram). Uma vez concedidos, o CPF não pode retirar cupons grátis novamente.
> - **Liberdade Total para Compras (Sem Limite)**: Clientes cadastrados têm liberdade total para comprar quantas vezes quiserem ao longo da campanha e receberão cupons a cada compra realizada, sem qualquer bloqueio!
> - **Rastreamento de Impressão (Pendentes vs Impressos)**: O sistema salva e identifica com clareza quais cupons estão "Pendentes de Impressão" (precisam ser impressos) e quais "Já foram impressos" com data e hora exata.
> - **Validação Automática ao Imprimir**: Ao clicar no botão de impressão (seja na emissão, pré-visualização ou histórico), o sistema valida e grava imediatamente o timestamp de impressão (`printedAt`), atualizando o status para "Impresso" no sistema e no servidor.
> - **Integridade do Banco de Dados**: Nenhuma operação destrutiva é realizada no banco de dados (`coupons_db.json`), preservando 100% dos dados já cadastrados.
> - **Regras de Cupons por Compra**:
>   - Compra mínima: **R$ 60,00**.
>   - Cálculo: **+1 cupom a cada R$ 60,00** em compras (ex: R$ 60 = 1 cupom, R$ 120 = 2 cupons, R$ 600 = 10 cupons).
>   - Limite máximo por compra: **10 cupons** (ex: compras de R$ 1.000 recebem o teto de 10 cupons).
>   - Atalhos do Caixa: Botão de **+R$ 60 (+1 cupom)** para somar progressivamente, **-R$ 60**, botão **Limite Máximo (10 cupons)** e **Zerar** (removidos atalhos desnecessários de R$ 100, R$ 200 e R$ 500).
> - **Compra de Impressora 3D**: **+10 cupons** por impressora adquirida (sem limite de compras).

---

## 1. Módulos e Fluxos do Sistema

1. **Balcão / Emissão (PDVForm)**:
   - Digitação do CPF com máscara e checagem instantânea de autenticidade (Módulo 11).
   - Bloqueio imediato se o CPF for inválido ou se já tiver participado da promoção.
   - Banner de alerta com atalho rápido para ver os cupons já emitidos caso o cliente já esteja na base.
   - Opção "Salvar no Sistema" (guarda como pendente de impressão) ou "Salvar e Imprimir na Elgin i9" (valida e imprime na hora).

2. **Histórico e Auditoria (CouponHistory)**:
   - Abas de visualização: *Por Cliente*, *Todas as Compras* e *Auditoria*.
   - Filtros rápidos por status de impressão: *Todos*, *⏳ Precisa Imprimir* (com contagem) e *✅ Já Impressos*.
   - Badges visuais em cada lote e cupom: "Precisa Imprimir" (âmbar) e "Já Impresso" (verde).
   - Botões de ação contextuais: "Imprimir Agora (Valida)" ou "Reimprimir".
   - Exportação para planilha CSV (com colunas de Status e Data de Impressão) e backup JSON.

3. **Validador de Autenticidade (CouponValidator)**:
   - Leitura do código antifraude (ex: `SJ-A1M-0001-XXXX`) ou número do cupom.
   - Exibição de autenticidade, dados do titular e confirmação se o cupom já foi impresso ou está pendente.

4. **Impressão Térmica Elgin i9 (ThermalReceipt)**:
   - Layout de 80mm com duas vias: Guia do Cliente e Guia da Urna com campo de assinatura.
   - Linha pontilhada de corte para guilhotina e marcação de autenticação da impressão.
