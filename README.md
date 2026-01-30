# Sistema de Troca/Devolução - Millennium

Sistema local para gerenciar trocas e devoluções de notas fiscais do Millennium com fila de processamento automático.

## 📋 Arquivos

- **`troca-devolucao-app.html`** - Aplicativo principal completo
- **`test-listafaturamentos.html`** - Ferramenta de teste da API listafaturamentos

## 🚀 Como Usar

### 1. Abrir o Aplicativo

Abra o arquivo `troca-devolucao-app.html` no seu navegador (Chrome, Edge, Firefox, etc.)

### 2. Configurar Credenciais

O aplicativo já vem pré-configurado com as credenciais do Millennium:
- **URL Base**: `http://179.124.195.107:6017`
- **Usuário**: `integracao`
- **Senha**: `@5z5u2hmc4u`

Você pode alterar esses valores na seção "Configuração" se necessário.

### 3. Configurar Parâmetros da Troca

Ajuste os parâmetros conforme necessário:
- **Vitrine**: 101 (padrão)
- **Faturar**: A - Automático
- **Autorizar NF-e**: T - Sim
- **Tipo Autorização Troca**: 3
- **Tipo Pgto Crédito**: 120
- **Troca Valor Bruto**: T - Sim

### 4. Buscar Nota Fiscal

1. Digite o número da nota fiscal no campo "Número da Nota Fiscal"
2. Clique em "Buscar Nota" ou pressione Enter
3. O sistema buscará todos os dados da nota no Millennium

### 5. Selecionar Produtos

1. Marque os checkboxes dos produtos que deseja trocar/devolver
2. Ajuste a quantidade de cada produto (se necessário)
3. Clique em "Adicionar à Fila"

### 6. Processar Fila

1. Adicione quantas notas/trocas desejar à fila
2. Clique em "Processar Fila" para disparar todas as requisições
3. Acompanhe o status em tempo real:
   - ⏳ **Pendente** - Aguardando processamento
   - ⚙️ **Processando** - Sendo enviado para o Millennium
   - ✅ **Sucesso** - Troca/devolução criada com sucesso
   - ❌ **Erro** - Falha no processamento

## 📊 Funcionalidades

### Busca de Nota
- Busca automática no endpoint `listafaturamentos`
- Exibe todos os dados da nota (cliente, endereço, produtos, valores)
- Validação de nota fiscal autorizada

### Seleção de Produtos
- Lista completa de produtos da nota
- Seleção múltipla com checkboxes
- Controle de quantidade (respeitando o máximo disponível)
- Exibição de código de barras, preço, tamanho e cor

### Sistema de Fila
- Adicione múltiplas trocas/devoluções
- Visualize o body completo de cada requisição
- Estatísticas em tempo real
- Processamento sequencial com intervalo de 1 segundo

### Processamento Automático
- Disparo automático de todas as requisições na fila
- Tratamento de erros individual por item
- Exibição de response ou erro de cada processamento
- Histórico completo de todas as operações

## 🔧 APIs Utilizadas

### 1. Busca de Faturamento
```
GET /api/millenium_eco/pedido_venda/listafaturamentos
```
**Parâmetros:**
- `vitrine`: Código da vitrine/loja
- `nota`: Número da nota fiscal
- `$format`: json

**Retorna:**
- Dados completos da nota fiscal
- Informações do cliente
- Lista de produtos faturados
- Endereço de entrega
- Formas de pagamento

### 2. Inclusão de Troca/Devolução
```
POST /api/millenium_eco/troca_devolucao/inclui
```
**Body:**
```json
{
  "vitrine": 101,
  "faturar": "A",
  "autorizar_nfe": "T",
  "tipo_autorizacao_troca": 3,
  "produtos": [
    {
      "quantidade": 1.00,
      "preco": 129.90,
      "barra": "07300230816192"
    }
  ],
  "nota": 71,
  "saida": 20577,
  "cod_endereco": 24002,
  "tipo_pgto_credito": 120,
  "troca_pelo_valor_bruto": "T"
}
```

## 📝 Campos Importantes

### Dados Extraídos da Nota
- **`saida`** - Código da saída/pedido original (PEDIDOV)
- **`nota`** - Número da nota fiscal
- **`cod_endereco`** - Código do endereço do cliente
- **`produtos[].barra`** - Código de barras do produto
- **`produtos[].preco`** - Preço unitário do produto
- **`pagamentos[].tipo_pgto`** - Tipo de pagamento original

### Parâmetros da Troca
- **`vitrine`** - Código da loja/vitrine
- **`faturar`** - A (Automático) ou M (Manual)
- **`autorizar_nfe`** - T (Sim) ou F (Não)
- **`tipo_autorizacao_troca`** - Código do tipo de autorização
- **`tipo_pgto_credito`** - Tipo de pagamento para crédito
- **`troca_pelo_valor_bruto`** - T (Sim) ou F (Não)

## 🎨 Interface

- Design moderno com gradiente roxo
- Layout responsivo em 2 colunas
- Feedback visual em tempo real
- Alertas de sucesso/erro
- Scroll customizado nas listas
- Estatísticas em tempo real

## ⚠️ Observações

1. **Intervalo entre Requisições**: O sistema aguarda 1 segundo entre cada requisição para evitar sobrecarga no servidor
2. **Validação de Quantidade**: Não é possível trocar/devolver mais produtos do que foi faturado
3. **Status da Nota**: Apenas notas fiscais autorizadas podem ser processadas
4. **Histórico**: Todos os itens processados permanecem na fila com seu status e response

## 🧪 Teste da API

Use o arquivo `test-listafaturamentos.html` para testar a API de listafaturamentos de forma isolada:
1. Abra o arquivo no navegador
2. Preencha as credenciais
3. Informe vitrine e nota
4. Clique em "Testar API"
5. Visualize a estrutura completa do response

## 📞 Suporte

Para dúvidas ou problemas:
1. Verifique o console do navegador (F12) para logs detalhados
2. Confirme que as credenciais estão corretas
3. Valide que o servidor Millennium está acessível
4. Verifique se a nota fiscal existe e está autorizada
