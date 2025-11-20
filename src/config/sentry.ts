// Sentry error tracking configuration
import * as Sentry from '@sentry/node';

const logger = {
  info: console.log,
  error: console.error,
  warn: console.warn
};

export const initSentry = () => {
  if (!process.env.SENTRY_DSN) {
    logger.warn('SENTRY_DSN not configured, skipping Sentry initialization');
    return;
  }

  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    
    // Performance monitoring
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
    
    // Error sampling
    sampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
    
    // Additional configuration
    beforeSend(event: any) {
      // Filter out common errors
      if (event.exception) {
        const error = event.exception.values?.[0];
        if (error && error.value?.includes('Socket closed')) {
          return null; // Ignore socket closed errors
        }
      }
      return event;
    },
    
    // Environment variables to send
    initialScope: {
      tags: {
        service: 'providers-backend',
        environment: process.env.NODE_ENV || 'development'
      }
    }
  });

  logger.info('Sentry initialized successfully');
};

export { Sentry };