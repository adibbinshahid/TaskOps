export const APP_NAME = 'TaskOps';

export const CONFIDENCE_THRESHOLD = parseInt(
  process.env.CONFIDENCE_THRESHOLD ?? '50',
  10
);

export const TIMEZONE = process.env.TIMEZONE ?? 'Asia/Dhaka';
