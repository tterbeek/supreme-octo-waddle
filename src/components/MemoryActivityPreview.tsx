import { ACTIVITY_TYPES } from '../config/activityTypes';
import { getActivityPhotos } from '../lib/photos';
import type { MemoryActivity } from '../services/memories.service';

export default function MemoryActivityPreview({ activity, urls, onOpen }: {
  activity: MemoryActivity; urls: Record<string,string>; onOpen: () => void;
}) {
  const config=ACTIVITY_TYPES[activity.type]||ACTIVITY_TYPES.other;
  const photo=getActivityPhotos(activity)[0];
  const path=photo?.thumb_path||photo?.image_path;
  return <button type="button" className="w-full text-left rounded-2xl border border-movenotes-border bg-movenotes-surface p-4 flex gap-4" onClick={onOpen}>
    <div className="w-16 h-20 shrink-0 rounded-lg overflow-hidden bg-movenotes-bg flex items-center justify-center">
      {path&&urls[path]?<img src={urls[path]} alt="" className="w-full h-full object-cover" loading="lazy" onError={e=>{e.currentTarget.style.display='none';}}/>:<config.Icon size={28}/>}
    </div>
    <div className="min-w-0"><p className="text-xs text-movenotes-muted">{activity.date} · {config.label}</p>
      <h4 className="font-semibold break-words">{activity.title||config.label}</h4>
      {activity.notes&&<p className="text-sm line-clamp-2 whitespace-pre-wrap mt-1">{activity.notes}</p>}
    </div>
  </button>;
}
