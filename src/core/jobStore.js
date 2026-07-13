import { randomUUID } from 'node:crypto';
import { config } from '../config/index.js';
import logger from '../utils/logger.js';

export const JobStatus = Object.freeze({
    QUEUED: 'queued',
    DOWNLOADING: 'downloading',
    PROCESSING: 'processing',
    COMPLETED: 'completed',
    FAILED: 'failed',
    EXPIRED: 'expired',
});

function ttlMs() {
    return config.autoDeleteMinutes * 60 * 1000;
}

class JobStore {
    constructor() {
        this.jobs = new Map();
    }

    create({ type, url, ...rest }) {
        const now = Date.now();
        const id = randomUUID();
        const job = {
            id,
            type,
            url,
            status: JobStatus.QUEUED,
            progress: 0,
            speed: null,
            eta: null,
            downloaded: 0,
            total: 0,
            filename: null,
            filepath: null,
            size: 0,
            downloadUrl: null,
            error: null,
            createdAt: now,
            startedAt: null,
            completedAt: null,
            expiresAt: now + ttlMs(),
            ...rest,
        };
        this.jobs.set(id, job);
        return job;
    }

    get(id) {
        return this.jobs.get(id);
    }

    update(id, patch) {
        const job = this.jobs.get(id);
        if (!job) return null;
        Object.assign(job, patch);
        return job;
    }

    list() {
        return Array.from(this.jobs.values());
    }

    remove(id) {
        return this.jobs.delete(id);
    }

    /** Mark expired jobs and return their filepaths for cleanup. */
    collectExpired() {
        const now = Date.now();
        const expired = [];
        for (const job of this.jobs.values()) {
            if (job.expiresAt && job.expiresAt < now) {
                if (job.status !== JobStatus.EXPIRED) {
                    job.status = JobStatus.EXPIRED;
                }
                expired.push(job);
            }
        }
        return expired;
    }

    purgeExpired() {
        const expired = this.collectExpired();
        for (const job of expired) {
            this.jobs.delete(job.id);
            logger.debug({ jobId: job.id }, 'purged expired job');
        }
        return expired;
    }
}

export const jobStore = new JobStore();
export default jobStore;
