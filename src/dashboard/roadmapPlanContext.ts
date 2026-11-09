import { createContext, useContext } from 'react';
import type { CatalogId } from '../core/catalog';
import type { RoadmapPlan } from '../core/roadmapPlan';

export interface RoadmapPlanInfo {
  plans: Record<CatalogId, RoadmapPlan>;
  startDate: string;
}

/** The day-60 forecast of the Roadmap page; null outside it (lists then show no planned day). */
export const RoadmapPlanContext = createContext<RoadmapPlanInfo | null>(null);

export const useRoadmapPlan = (): RoadmapPlanInfo | null => useContext(RoadmapPlanContext);
