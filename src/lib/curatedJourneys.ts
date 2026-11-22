import catalog from '../data/curated-journeys.json';
import type { JourneyTemplate } from '../../supabase/functions/_shared/journeyGeometry';
export { journeyGeometry,journeyPosition } from '../../supabase/functions/_shared/journeyGeometry';
export type { JourneyTemplate,JourneyWaypoint } from '../../supabase/functions/_shared/journeyGeometry';
export const curatedJourneys=catalog as unknown as JourneyTemplate[];
export const curatedJourney=(slug:string,version=1)=>curatedJourneys.find(t=>t.slug===slug&&t.version===version);
