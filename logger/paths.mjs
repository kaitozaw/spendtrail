import { homedir } from 'node:os';
import { join } from 'node:path';

export const HOST_NAME = 'com.spendtrail.logger';
export const LOG_DIR = join(homedir(), '.spendtrail');
export const LOG_FILE = join(LOG_DIR, 'agent.log');
