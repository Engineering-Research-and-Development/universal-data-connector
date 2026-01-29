const nats = require('nats');
const logger = require('../utils/logger');
const EventEmitter = require('events');

class NatsTransport extends EventEmitter {
    constructor(config = {}) {
        super();
        this.config = config;
        this.servers = config.servers || process.env.NATS_SERVERS || 'nats://localhost:4222';
        this.options = config.options || {};
        this.nc = null;
        this.jc = null;
        this.reconnectInterval = config.reconnectInterval || 5000;
        this.connectionStats = {
            connected: false,
            reconnecting: false,
            lastError: null,
            messagesPublished: 0,
        };
    }

    async initialize() {
        this.jc = nats.JSONCodec();
    }

    async connect() {
        try {
            logger.info(`Connecting to NATS at ${this.servers}...`);
            this.nc = await nats.connect({
                servers: this.servers,
                ...this.options,
                name: 'universal-data-connector',
                reconnect: true,
                maxReconnectAttempts: -1, // Infinite
                waitOnFirstConnect: false // Don't crash if NATS is down on start
            });

            this.connectionStats.connected = true;
            this.connectionStats.reconnecting = false;
            this.emit('connected');
            logger.info('NATS Connected');

            this.monitorConnection();
        } catch (error) {
            logger.error('Failed to connect to NATS:', error);
            this.connectionStats.connected = false;
            this.connectionStats.lastError = error;
            this.emit('error', error);
            // If waitOnFirstConnect is true (default is false above), it might throw. 
            // But since we want to be resilient, we let the library handle reconnects or we retry manually if initial connection fails entirely.
        }
    }

    async monitorConnection() {
        if (!this.nc) return;
        try {
            for await (const s of this.nc.status()) {
                switch (s.type) {
                    case 'disconnect':
                        logger.warn('NATS disconnected');
                        this.connectionStats.connected = false;
                        this.emit('disconnected');
                        break;
                    case 'reconnect':
                        logger.info('NATS reconnected');
                        this.connectionStats.connected = true;
                        this.connectionStats.reconnecting = false;
                        this.emit('connected'); // Re-emit connected to trigger buffer flush
                        break;
                    case 'error':
                        logger.error('NATS status error:', s.data);
                        break;
                }
            }
        } catch (err) {
            // Monitor loop broke
            logger.error('NATS monitor error:', err);
        }
    }

    async publish(subject, data) {
        if (!this.isConnected()) {
            throw new Error('NATS not connected');
        }

        try {
            this.nc.publish(subject, this.jc.encode(data));
            this.connectionStats.messagesPublished++;
            return true;
        } catch (error) {
            logger.error(`Failed to publish to ${subject}:`, error);
            throw error;
        }
    }

    isConnected() {
        return this.connectionStats.connected && this.nc && !this.nc.isClosed();
    }

    async close() {
        if (this.nc) {
            await this.nc.drain();
            await this.nc.close();
            this.connectionStats.connected = false;
        }
    }
}

module.exports = NatsTransport;
