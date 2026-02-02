const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();
const PORT = process.env.PORT || 4000;
const WEBHOOK_TOKEN = process.env.WEBHOOK_TOKEN || 'MyWebhookSecret123';
const ACCEPTED_EVENTS = new Set(['6', '21', '3']); // 6 = Itens recebidos, 21 = Pedido de troca aprovado, 3 = Reversa aprovada

// Armazenamento em memória para eventos recebidos (em produção, usar banco de dados)
const webhookEvents = [];

function getEventName(eventId) {
    const eventNames = {
        '1': 'Reversa criada',
        '2': 'Reversa aprovada',
        '3': 'Reversa aprovada',
        '4': 'Status alterado',
        '5': 'Pedido de troca criado',
        '6': 'Itens recebidos',
        '7': 'Pedido de troca confirmado',
        '8': 'Cupom gerado',
        '9': 'Pagamento realizado',
        '10': 'E-mail enviado',
        '11': 'Objeto postado',
        '12': 'Entrega realizada',
        '13': 'Reversa finalizada',
        '14': 'Reversa cancelada',
        '15': 'Pedido de troca cancelado',
        '16': 'Estorno realizado',
        '17': 'Reembolso parcial',
        '18': 'Reembolso total',
        '19': 'Item retido',
        '20': 'Item devolvido',
        '21': 'Pedido de troca aprovado',
        '22': 'Troca direta realizada',
        '23': 'Segunda solicitação',
        '24': 'Exceção identificada',
        '25': 'Pedido de troca por produto criado',
        '26': 'Pedido de troca por produto confirmado'
    };
    return eventNames[eventId] || `Evento ${eventId}`;
}

app.use(cors({ origin: true }));
app.use(express.json({ limit: '1mb' }));

app.get('/health', (_req, res) => {
    res.json({ status: 'ok', uptime: process.uptime() });
});

app.get('/', (_req, res) => {
    res.json({
        message: 'Troquecommerce webhook/proxy ativo',
        endpoints: {
            health: '/health',
            webhook: '/api/troquecommerce/webhook',
            orderListProxy: '/api/troquecommerce/order-list',
            orderDetailProxy: '/api/troquecommerce/order-detail',
            webhookEvents: '/api/troquecommerce/webhook-events'
        }
    });
});

app.post('/api/troquecommerce/order-list', async (req, res) => {
    const { baseUrl, token, status, start_date, end_date, unchecked_by_integration, page } = req.body || {};

    if (!baseUrl || !token) {
        return res.status(400).json({ message: 'baseUrl and token are required' });
    }

    let endpoint;
    try {
        const normalizedBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
        endpoint = new URL('order/list', normalizedBase);
    } catch (error) {
        return res.status(400).json({ message: 'Invalid baseUrl', details: error.message });
    }

    if (status) endpoint.searchParams.set('status', status);
    if (start_date) endpoint.searchParams.set('start_date', start_date);
    if (end_date) endpoint.searchParams.set('end_date', end_date);
    if (unchecked_by_integration !== undefined) endpoint.searchParams.set('unchecked_by_integration', unchecked_by_integration);
    if (page) endpoint.searchParams.set('page', page);

    try {
        const response = await fetch(endpoint.toString(), {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                token
            }
        });

        const text = await response.text();
        if (!response.ok) {
            return res.status(response.status).send(text || response.statusText);
        }

        res.type('application/json').send(text);
    } catch (error) {
        console.error('Erro ao consultar order/list da Troquecommerce:', error);
        res.status(500).json({ message: 'Erro ao consultar Troquecommerce', details: error.message });
    }
});

app.post('/api/troquecommerce/order-detail', async (req, res) => {
    const { baseUrl, token, id, ecommerce_number } = req.body || {};
    const orderId = ecommerce_number || id; // Prioriza ecommerce_number

    if (!baseUrl || !token || !orderId) {
        return res.status(400).json({ message: 'baseUrl, token and orderId (id or ecommerce_number) are required' });
    }

    let endpoint;
    try {
        const normalizedBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
        endpoint = new URL('order', normalizedBase);
    } catch (error) {
        return res.status(400).json({ message: 'Invalid baseUrl', details: error.message });
    }

    endpoint.searchParams.set('ecommerce_number', orderId);

    try {
        const response = await fetch(endpoint.toString(), {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                token
            }
        });

        const text = await response.text();
        if (!response.ok) {
            return res.status(response.status).send(text || response.statusText);
        }

        res.type('application/json').send(text);
    } catch (error) {
        console.error('Erro ao consultar order da Troquecommerce:', error);
        res.status(500).json({ message: 'Erro ao consultar Troquecommerce', details: error.message });
    }
});

function isAuthorized(req) {
    if (!WEBHOOK_TOKEN) return true;
    const incomingToken = req.headers['x-webhook-token'];
    return incomingToken && incomingToken === WEBHOOK_TOKEN;
}

async function handleReverseOrderEvent(payload) {
    console.log('[Troquecommerce] Processando evento:', {
        webhook_event_id: payload.webhook_event_id,
        reverse_id: payload.id,
        ecommerce_number: payload.ecommerce_number,
        status: payload.status,
        created_at: payload.created_at,
    });

    // Salvar evento na lista (com timestamp de recebimento)
    const eventoSalvo = {
        id: `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        eventId: payload.webhook_event_id,
        eventName: getEventName(payload.webhook_event_id),
        timestamp: new Date().toISOString(),
        receivedAt: new Date().toISOString(),
        payload: payload
    };
    
    webhookEvents.unshift(eventoSalvo); // Adicionar no início (mais recente primeiro)
    
    // Manter apenas os últimos 1000 eventos para não sobrecarregar memória
    if (webhookEvents.length > 1000) {
        webhookEvents.splice(1000);
    }

    // Buscar automaticamente a nota no Millennium sem adicionar à fila
    try {
        const millenniumBaseUrl = process.env.MILLENNIUM_BASE_URL || 'https://api.millennium.com.br';
        const vitrine = process.env.MILLENNIUM_VITRINE || '101';
        
        // Buscar pedido pelo número do e-commerce
        const pedidoUrl = `${millenniumBaseUrl}/api/millenium.PEDIDO_VENDA.Lista_Data?$format=json`;
        const pedidoBody = {
            SCRIPTFILIAL: null,
            DATAI: '1900-01-01T00:00:00.000Z',
            DATAF: '2100-12-31T23:59:59.999Z',
            TIPO: "AC",
            BLOQUEIOS: null,
            CIDADE: null,
            CLIENTE: null,
            CLIENTE_ENTREGA: null,
            CLI_GRUPO_LOJA: null,
            COD_PEDIDOV: "",
            COD_PEDIDO_MKT_PLACE: null,
            COLECAO_PEDIDO: null,
            COLECAO_PRODUTO: null,
            COMANDA: null,
            CONSIGNACAO: null,
            COR: null,
            EFETUADO: 2,
            ENDERECO_RETIRADA: null,
            ENTREGA_IMEDIATA: null,
            ESTADO: null,
            ESTAMPA: null,
            FILTROPRO: true,
            GRUPO_LOJA: null,
            GRUPO_PRODUTO: null,
            IGNORA_PARAM: false,
            LISTA_CASAMENTO: false,
            N_PEDIDO_CLIENTE: payload.ecommerce_number || "",
            OPCAO_DATA: 1,
            ORCAMENTO: null,
            ORDEM: 0,
            ORIGEM_PEDIDO: null,
            PEDIDOV: null,
            PONTO_RETIRADA: null,
            PRODUTO: null,
            PRODUTO_GRUPO: null,
            PRODUTO_SUBGRUPO: null,
            REGIAO: null,
            REPRESENTANTE: null,
            TABELA_PRECO: null,
            TIPO_PEDIDO: null,
            VENDEDOR: null,
            VITRINE: vitrine
        };

        const response = await fetch(pedidoUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(pedidoBody)
        });

        if (!response.ok) {
            console.error('[Troquecommerce] Erro ao buscar pedido no Millennium:', response.status, response.statusText);
            return;
        }

        const data = await response.json();
        const pedidos = data?.value || data || [];
        
        if (pedidos.length > 0) {
            const pedido = pedidos[0];
            const numeroNota = pedido.nf || pedido.NF || pedido.nota || pedido.NOTA || pedido.NumeroNota;
            
            if (numeroNota && numeroNota !== '0') {
                console.log(`[Troquecommerce] Nota ${numeroNota} encontrada para o pedido ${payload.ecommerce_number}`);
                
                // Opcional: buscar detalhes completos da nota
                const detalhesUrl = `${millenniumBaseUrl}/api/millenium_eco/pedido_venda/listafaturamentos?vitrine=${vitrine}&nota=${numeroNota}&$format=json`;
                const detalhesResponse = await fetch(detalhesUrl);
                
                if (detalhesResponse.ok) {
                    const detalhes = await detalhesResponse.json();
                    console.log(`[Troquecommerce] Detalhes da nota ${numeroNota}:`, {
                        cliente: detalhes[0]?.cliente?.nome || 'N/A',
                        valor: detalhes[0]?.valor_final || 'N/A',
                        produtos: detalhes[0]?.produtos?.length || 0
                    });
                }
            } else {
                console.log(`[Troquecommerce] Pedido ${payload.ecommerce_number} encontrado, mas sem nota fiscal emitida`);
            }
        } else {
            console.log(`[Troquecommerce] Pedido ${payload.ecommerce_number} não encontrado no Millennium`);
        }
        
    } catch (error) {
        console.error('[Troquecommerce] Erro ao processar evento automaticamente:', error);
    }
}

app.post('/api/troquecommerce/webhook', async (req, res) => {
    if (!isAuthorized(req)) {
        return res.status(401).json({ message: 'Unauthorized' });
    }

    const eventId = req.headers['event'] || req.body?.webhook_event_id;
    if (!eventId) {
        return res.status(400).json({ message: 'Missing webhook event id' });
    }

    if (!ACCEPTED_EVENTS.has(String(eventId))) {
        return res.status(202).json({ message: `Ignoring event ${eventId}` });
    }

    const payload = req.body;

    try {
        await handleReverseOrderEvent(payload);
        return res.status(200).json({ message: 'Webhook received and processed' });
    } catch (error) {
        console.error('[Troquecommerce] Erro ao processar webhook:', error);
        return res.status(500).json({ message: 'Internal server error', details: error.message });
    }
});

// Endpoint para listar eventos webhook
app.get('/api/troquecommerce/webhook-events', (_req, res) => {
    try {
        res.json({
            success: true,
            count: webhookEvents.length,
            events: webhookEvents
        });
    } catch (error) {
        console.error('[Troquecommerce] Erro ao listar eventos:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Erro ao listar eventos', 
            details: error.message 
        });
    }
});

app.use((err, _req, res, _next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ message: 'Internal server error' });
});

app.listen(PORT, () => {
    console.log(`Troquecommerce webhook server listening on http://localhost:${PORT}`);
});
