import pino from 'pino';
import { config } from '../config/index.js';

const pretty = pino.transport({
  target: 'pino-pretty',
  options: { colorize: true, translateTime: 'SYS:HH:MM:ss.l', ignore: 'pid,hostname' },
});

export const logger = config.isProd
  ? pino({ level: config.logLevel, base: { service: 'ytback' } })
  : pino({ level: config.logLevel, base: { service: 'ytback' } }, pretty);

export default logger;
