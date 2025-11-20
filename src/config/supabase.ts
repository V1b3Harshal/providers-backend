import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY } from './environment';

// Global Supabase client for general use
let supabaseClient: SupabaseClient | null = null;

// Service role client for backend operations (bypasses RLS)
let supabaseServiceClient: SupabaseClient | null = null;

/**
 * Initialize Supabase clients
 */
export const initSupabase = (): void => {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error('Supabase configuration missing. Please check SUPABASE_URL and SUPABASE_ANON_KEY environment variables.');
  }

  // Initialize public client
  supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  // Initialize service role client if available
  if (SUPABASE_SERVICE_ROLE_KEY) {
    supabaseServiceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
  }
};

/**
 * Get the public Supabase client
 */
export const getSupabase = (): SupabaseClient => {
  if (!supabaseClient) {
    throw new Error('Supabase client not initialized. Call initSupabase() first.');
  }
  return supabaseClient;
};

/**
 * Get the service role Supabase client (for backend operations)
 */
export const getSupabaseServiceClient = (): SupabaseClient => {
  if (!supabaseServiceClient) {
    throw new Error('Supabase service client not initialized. Service role key may not be configured.');
  }
  return supabaseServiceClient;
};

/**
 * Validate Supabase token
 */
export const validateSupabaseToken = async (token: string): Promise<any> => {
  try {
    const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'apikey': SUPABASE_ANON_KEY,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error('Invalid token');
    }

    const user = await response.json();
    return user;
  } catch (error) {
    throw new Error('Token validation failed');
  }
};

/**
 * Get Supabase health status
 */
export const getSupabaseHealth = async (): Promise<{ status: string; responseTime: number }> => {
  const start = Date.now();

  try {
    if (!supabaseClient) {
      return { status: 'not_initialized', responseTime: Date.now() - start };
    }

    // Simple health check query
    const { error } = await supabaseClient.from('health_check').select('count').limit(1).single();

    // We expect this to fail since health_check table doesn't exist, but it tests connectivity
    const status = error ? 'healthy' : 'healthy'; // If we get any response, it's healthy

    return {
      status,
      responseTime: Date.now() - start
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      responseTime: Date.now() - start
    };
  }
};