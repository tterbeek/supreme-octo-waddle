import type { ArchiveMonth,MemoryActivity } from '../services/memories.service';
import MemoryActivityPreview from './MemoryActivityPreview';

export default function MemoryMonthCard({ month, selected, urls, onOpenMonth, onOpenActivity, onShowAll }: {
  month: ArchiveMonth; selected: boolean; urls: Record<string,string>;
  onOpenMonth: () => void; onOpenActivity: (activity: MemoryActivity) => void; onShowAll: () => void;
}) {
  const previews=selected&&month.personal_count>0 ? month.moments||[] : [];
  const remaining=month.count-previews.length;
  return <section className="rounded-2xl overflow-hidden border border-movenotes-border bg-movenotes-surface">
    <button type="button" className="w-full text-left" onClick={onOpenMonth}>
      {month.thumbs?.length>0&&<div className="flex h-28 overflow-hidden">{month.thumbs.filter(Boolean).map((path,i)=>urls[path]?<img key={`${path}:${i}`} src={urls[path]} alt="" loading="lazy" className="min-w-0 flex-1 w-1/3 h-full object-cover" onError={e=>{e.currentTarget.style.display='none';}}/>:null)}</div>}
      <div className="p-5"><h3 className="text-lg font-semibold">{new Date(`${month.month}-01T12:00:00`).toLocaleDateString('en-GB',{month:'long',year:'numeric'})}</h3>
        <p className="text-sm text-movenotes-muted">{month.count} {month.count===1?'activity':'activities'}</p>
      </div>
    </button>
    {previews.length>0&&<div className="px-3 pb-3 space-y-2">{previews.map(activity=><MemoryActivityPreview key={activity.id} activity={activity} urls={urls} onOpen={()=>onOpenActivity(activity)}/>)}</div>}
    {selected&&remaining>0&&<button type="button" className="min-h-11 w-full px-5 pb-4 text-left text-sm underline text-movenotes-muted" onClick={onShowAll}>
      {previews.length?`Show ${remaining} more ${remaining===1?'activity':'activities'}`:`All ${month.count} ${month.count===1?'activity':'activities'}`}
    </button>}
  </section>;
}
