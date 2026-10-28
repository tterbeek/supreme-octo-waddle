import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../supabaseClient';
import { routeMapUrl } from '../lib/mapbox';
import { IMPORT_SYNC_EVENT, importsAreSyncing, type ImportingActivity } from '../services/activityImport.service';

/** Realtime gives immediate discovery; polling covers missed/disconnected events. */
export function useActivityImports(userId: string | null, onCompleted: () => unknown, waitForMap = true) {
  const [snapshot, setSnapshot] = useState<{ userId: string; rows: ImportingActivity[] } | null>(null);
  const [loadedMaps, setLoadedMaps] = useState<Set<string>>(new Set());
  const completed = useRef(onCompleted);
  useEffect(() => { completed.current = onCompleted; }, [onCompleted]);
  useEffect(() => {
    if (!userId) return;
    let stopped = false, loading = false, reloadRequested = false;
    let timer: ReturnType<typeof setTimeout>;
    const since = new Date(Date.now() - 5 * 60_000).toISOString();
    let signature = '';
    let previous = new Map<string, string>();
    const load = async () => {
      if (stopped) return;
      if (loading) { reloadRequested = true; return; }
      clearTimeout(timer);
      loading = true;
      let pending = false;
      try {
        const all: ImportingActivity[] = [];
        for (let offset = 0; ; offset += 500) {
          const { data, error } = await supabase.from('activities')
            .select('id,external_source,import_status,import_updated_at,imported_at,route_polyline')
            .eq('user_id', userId).in('external_source', ['polar', 'strava'])
            .or(`import_status.neq.ready,import_updated_at.gte.${since}`)
            .order('imported_at', { ascending: false }).order('id').range(offset, offset + 499);
          if (error) throw error;
          all.push(...data as ImportingActivity[]);
          if (data.length < 500) break;
        }
        if (stopped) return;
        pending = all.some(row => row.import_status === 'processing');
        const nextSignature = JSON.stringify(all);
        if (signature !== nextSignature) {
          const changed = all.some(row => row.import_status === 'ready' && previous.get(row.id) !== 'ready');
          previous = new Map(all.map(row => [row.id, row.import_status]));
          signature = nextSignature;
          setSnapshot({ userId, rows: all });
          if (changed) void completed.current();
        }
      } catch {
        // Keep known templates locked during a temporary connection failure.
      } finally {
        loading = false;
        if (!stopped) {
          timer = setTimeout(() => { void load(); }, reloadRequested ? 0 : document.visibilityState === 'visible' && (pending || importsAreSyncing()) ? 1000 : 15_000);
          reloadRequested = false;
        }
      }
    };
    const channel = supabase.channel(`activity-imports:${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'activities', filter: `user_id=eq.${userId}` }, () => { void load(); })
      .subscribe();
    const wake = () => { void load(); };
    window.addEventListener(IMPORT_SYNC_EVENT, wake);
    window.addEventListener('focus', wake);
    document.addEventListener('visibilitychange', wake);
    void load();
    return () => {
      stopped = true; clearTimeout(timer);
      void supabase.removeChannel(channel);
      window.removeEventListener(IMPORT_SYNC_EVENT, wake);
      window.removeEventListener('focus', wake);
      document.removeEventListener('visibilitychange', wake);
    };
  }, [userId]);
  const mapLoaded = useCallback((url: string) => {
    setLoadedMaps(previous => new Set(previous).add(url));
    void completed.current();
  }, []);
  const pending = (snapshot?.userId === userId ? snapshot.rows : []).filter(row => row.import_status !== 'ready' || (
    waitForMap && routeMapUrl(row.route_polyline) && !loadedMaps.has(routeMapUrl(row.route_polyline)!)
  ));
  return { pending, blockedIds: new Set(pending.map(row => row.id)), mapLoaded };
}
