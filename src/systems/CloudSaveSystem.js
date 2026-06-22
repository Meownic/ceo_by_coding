/**
 * @fileoverview CloudSaveSystem — Handles Supabase Auth/Database saves and Upstash Redis backups.
 * If credentials are missing, falls back gracefully to offline local storage.
 */
import { createClient } from '@supabase/supabase-js';
import { Redis } from '@upstash/redis';

export default class CloudSaveSystem {
  constructor() {
    this.supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
    this.supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
    this.redisUrl = import.meta.env.VITE_UPSTASH_REDIS_REST_URL || '';
    this.redisToken = import.meta.env.VITE_UPSTASH_REDIS_REST_TOKEN || '';

    this.supabase = null;
    this.redis = null;

    this.initClients();
  }

  /** Check environment variables and initialize clients */
  initClients() {
    if (this.supabaseUrl && this.supabaseAnonKey) {
      try {
        this.supabase = createClient(this.supabaseUrl, this.supabaseAnonKey);
        console.log('☁️ Supabase client initialized.');
      } catch (err) {
        console.error('Supabase initialization failed:', err);
      }
    } else {
      console.warn('⚠️ Supabase URL or Anon Key missing. Cloud Save/Auth will be disabled.');
    }

    if (this.redisUrl && this.redisToken) {
      try {
        this.redis = new Redis({
          url: this.redisUrl,
          token: this.redisToken,
        });
        console.log('🚀 Upstash Redis client initialized.');
      } catch (err) {
        console.error('Redis initialization failed:', err);
      }
    } else {
      console.warn('⚠️ Upstash Redis REST URL or Token missing. Redis caching will be disabled.');
    }
  }

  /** Whether cloud backup features are configured */
  isConfigured() {
    return this.supabase !== null;
  }

  /* ================================================================
   *  AUTHENTICATION
   * ================================================================ */

  /** Listen for authorization state changes */
  onAuthStateChange(callback) {
    if (!this.supabase) return;
    this.supabase.auth.onAuthStateChange((event, session) => {
      callback(event, session);
    });
  }

  /** Get the current logged-in user */
  async getCurrentUser() {
    if (!this.supabase) return null;
    const { data: { user }, error } = await this.supabase.auth.getUser();
    if (error) return null;
    return user;
  }

  /** Sign up using username or email and password */
  async signUp(identifier, password) {
    if (!this.supabase) throw new Error('Cloud Save is not configured.');
    
    // Support username-only login by mapping to placeholder domain email
    const email = identifier.includes('@') ? identifier : `${identifier}@droneharvest.com`;
    const { data, error } = await this.supabase.auth.signUp({
      email,
      password,
    });

    if (error) throw error;
    return data;
  }

  /** Sign in using username or email and password */
  async signIn(identifier, password) {
    if (!this.supabase) throw new Error('Cloud Save is not configured.');

    const email = identifier.includes('@') ? identifier : `${identifier}@droneharvest.com`;
    const { data, error } = await this.supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw error;
    return data;
  }

  /** Trigger Supabase Google OAuth sign in */
  async signInWithGoogle() {
    if (!this.supabase) throw new Error('Cloud Save is not configured.');

    const { data, error } = await this.supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin + '/',
      }
    });

    if (error) throw error;
    return data;
  }

  /** Sign out */
  async signOut() {
    if (!this.supabase) return;
    const { error } = await this.supabase.auth.signOut();
    if (error) throw error;
  }

  /* ================================================================
   *  SAVE & LOAD SYNC
   * ================================================================ */

  /** Backup profile and scripts to Supabase and cache in Redis */
  async backupSave(profileData, scriptsData) {
    if (!this.supabase) throw new Error('Supabase is not configured.');

    const user = await this.getCurrentUser();
    if (!user) throw new Error('User is not logged in.');

    const payload = {
      user_id: user.id,
      profile_data: profileData,
      scripts_data: scriptsData,
      updated_at: new Date().toISOString(),
    };

    // 1. Save to Supabase public.user_saves (Primary SQL DB)
    const { error } = await this.supabase
      .from('user_saves')
      .upsert(payload);

    if (error) throw error;

    // 2. Cache to Upstash Redis (High-speed Key-Value Cache backup)
    if (this.redis) {
      try {
        await this.redis.set(`user:saves:${user.id}`, payload);
      } catch (redisErr) {
        console.warn('Upstash Redis sync failed (caching fallback to Supabase only):', redisErr);
      }
    }

    return true;
  }

  /** Restore profile and scripts from Upstash Redis or Supabase */
  async restoreSave() {
    if (!this.supabase) throw new Error('Supabase is not configured.');

    const user = await this.getCurrentUser();
    if (!user) throw new Error('User is not logged in.');

    let save = null;

    // 1. Attempt Upstash Redis lookup first for faster retrieval
    if (this.redis) {
      try {
        save = await this.redis.get(`user:saves:${user.id}`);
      } catch (redisErr) {
        console.warn('Upstash Redis load failed, falling back to Supabase:', redisErr);
      }
    }

    // 2. Fallback to Supabase Database query
    if (!save) {
      const { data, error } = await this.supabase
        .from('user_saves')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;
      if (data) save = data;
    }

    return save;
  }
}
