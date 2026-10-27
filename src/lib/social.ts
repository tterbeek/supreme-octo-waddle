import { ACTIVITY_TYPES } from '../config/activityTypes';
import type { SocialAudience } from '../services/social.service';
export const ruleLabel=(a:SocialAudience)=>a.mode==='all'?'All new activities':a.mode==='manual'?'Manual':a.types.map(t=>ACTIVITY_TYPES[t]?.label||t).join(', ');
