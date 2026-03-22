import { supabase } from '@/lib/supabase';

export interface PropertyFilters {
  city?: string;
  state?: string;
  selo?: string;
  modalidade?: string;
  searchTerm?: string;
  hasEnrichment?: boolean;
}

export interface Property {
  id: number;
  created_at: string;
  title: string;
  description: string;
  price: number;
  area_size: number;
  bedrooms: number;
  bathrooms: number;
  city: string;
  state: string;
  status: string;
  main_image: string;
  selo_oportunidade: string;
  discount_percent: number;
  cep_id?: number;
  ceps_imovel?: {
    id: number;
    cep_status: string;
  };
}

export const propertyService = {
  async getProperties(limit = 10, offset = 0, filters: PropertyFilters = {}) {
    const selectStr = filters.hasEnrichment 
      ? '*, ceps_imovel!inner(id, cep_status)' 
      : '*, ceps_imovel(id, cep_status)';

    let query = supabase
      .from('properties')
      .select(selectStr, { count: 'exact' });

    // Apply filters
    if (filters.city) query = query.eq('city', filters.city);
    if (filters.state) query = query.eq('state', filters.state);
    if (filters.selo) query = query.eq('selo_oportunidade', filters.selo);
    if (filters.modalidade) query = query.eq('status', filters.modalidade);
    
    if (filters.searchTerm) {
      query = query.or(`title.ilike.%${filters.searchTerm}%,city.ilike.%${filters.searchTerm}%`);
    }

    if (filters.hasEnrichment) {
      query = query.eq('ceps_imovel.cep_status', 'enriquecido');
    }

    const { data, count, error } = await query
      .range(offset, offset + limit - 1)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return { data: data as Property[], count: count || 0 };
  }
};
