import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const db = createServerClient();
  const { searchParams } = request.nextUrl;

  const action = searchParams.get('action');
  const taskId = searchParams.get('task_id');
  const startDate = searchParams.get('start_date');
  const endDate = searchParams.get('end_date');
  const limit = parseInt(searchParams.get('limit') ?? '50', 10);

  let query = db
    .from('activity_log')
    .select('*, tasks(id, refined_entry, original_entry)')
    .order('created_at', { ascending: false })
    .limit(Math.min(limit, 200));

  if (action) query = query.eq('action', action);
  if (taskId) query = query.eq('task_id', taskId);
  if (startDate) query = query.gte('created_at', startDate);
  if (endDate) query = query.lte('created_at', endDate + 'T23:59:59Z');

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data ?? []);
}
