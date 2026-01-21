import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class SupabaseService implements OnModuleInit {
  private readonly logger = new Logger(SupabaseService.name);
  private client: SupabaseClient;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    const supabaseUrl = this.configService.get<string>('supabase.url');
    const supabaseKey = this.configService.get<string>('supabase.serviceKey');

    if (!supabaseUrl || !supabaseKey) {
      this.logger.warn(
        'Supabase credentials not configured. Database features will be unavailable.',
      );
      return;
    }

    this.client = createClient(supabaseUrl, supabaseKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    this.logger.log('Supabase client initialized');
  }

  getClient(): SupabaseClient {
    if (!this.client) {
      throw new Error('Supabase client not initialized');
    }
    return this.client;
  }

  async findMany<T>(
    table: string,
    options?: {
      select?: string;
      filter?: Record<string, unknown>;
      orderBy?: { column: string; ascending?: boolean };
      limit?: number;
    },
  ): Promise<T[]> {
    let query = this.getClient().from(table).select(options?.select || '*');

    if (options?.filter) {
      Object.entries(options.filter).forEach(([key, value]) => {
        query = query.eq(key, value);
      });
    }

    if (options?.orderBy) {
      query = query.order(options.orderBy.column, {
        ascending: options.orderBy.ascending ?? true,
      });
    }

    if (options?.limit) {
      query = query.limit(options.limit);
    }

    const { data, error } = await query;

    if (error) {
      this.logger.error(`Database query error: ${error.message}`);
      throw error;
    }

    return data as T[];
  }

  async findById<T>(table: string, id: string, select?: string): Promise<T | null> {
    const { data, error } = await this.getClient()
      .from(table)
      .select(select || '*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      this.logger.error(`Database query error: ${error.message}`);
      throw error;
    }

    return data as T;
  }

  async insert<T>(table: string, data: Partial<T>): Promise<T> {
    const { data: inserted, error } = await this.getClient()
      .from(table)
      .insert(data)
      .select()
      .single();

    if (error) {
      this.logger.error(`Database insert error: ${error.message}`);
      throw error;
    }

    return inserted as T;
  }

  async update<T>(table: string, id: string, data: Partial<T>): Promise<T> {
    const { data: updated, error } = await this.getClient()
      .from(table)
      .update(data)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      this.logger.error(`Database update error: ${error.message}`);
      throw error;
    }

    return updated as T;
  }
}
