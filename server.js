const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();
const PORT = process.env.PORT || 4000;
const WEBHOOK_TOKEN = process.env.WEBHOOK_TOKEN || 'MyWebhookSecret123';
const ACCEPTED_EVENTS = new Set(['6']); // 6 = Itens recebidos

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
            orderListProxy: '/api/troquecommerce/order-list'
        }
    });
});

app.post('/api/troquecommerce/order-list', async (req, res) => {
    const { baseUrl, token, status, start_date, end_date } = req.body || {};

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

function isAuthorized(req) {
    if (!WEBHOOK_TOKEN) return true;
    const incomingToken = req.headers['x-webhook-token'];
    return incomingToken && incomingToken === WEBHOOK_TOKEN;
}

function handleReverseOrderEvent(payload) {
    // TODO: Integrar com o app Millennium (ex.: enfileirar nota para processamento).
    console.log('[Troquecommerce] Evento recebido:', {
        webhook_event_id: payload.webhook_event_id,
        reverse_id: payload.id,
        ecommerce_number: payload.ecommerce_number,
        status: payload.status,
        created_at: payload.created_at,
    });
}

app.post('/api/troquecommerce/webhook', (req, res) => {
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
        handleReverseOrderEvent(payload);
        return res.status(200).json({ message: 'Webhook received' });
    } catch (error) {
        console.error('Erro ao tratar webhook:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
});

app.use((err, _req, res, _next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ message: 'Internal server error' });
});

app.listen(PORT, () => {
    console.log(`Troquecommerce webhook server listening on http://localhost:${PORT}`);
});
