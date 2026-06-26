import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const db = createServerClient();
  const { searchParams } = request.nextUrl;

  const status = searchParams.get('status');
  const groupId = searchParams.get('group_id');
  const date = searchParams.get('date');
  const startDate = searchParams.get('start_date');
  const endDate = searchParams.get('end_date');
  const q = searchParams.get('q');

  let query = db
    .from('tasks')
    .select('*, groups(id, name)')
    .neq('status', 'deleted')
    .order('assigned_date', { ascending: true })
    .order('created_at', { ascending: false });

  if (status) query = query.eq('status', status);
  if (groupId) query = query.eq('group_id', groupId);
  if (date) query = query.eq('assigned_date', date);
  if (startDate) query = query.gte('assigned_date', startDate);
  if (endDate) query = query.lte('assigned_date', endDate);
  if (q) {
    query = query.or(
      `original_entry.ilike.%${q}%,refined_entry.ilike.%${q}%`
    );
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data ?? []);
}
