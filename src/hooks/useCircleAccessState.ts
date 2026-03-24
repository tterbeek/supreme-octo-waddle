import { useEffect, useState } from "react";
import {
  CIRCLE_ACCESS_UPDATED_EVENT,
  fetchCircleConnectionState,
  hasCircleAccess,
} from "../services/circle.service";

type CircleAccessState = {
  circleEnabled: boolean;
  hasAcceptedCircleConnections: boolean;
};

export function useCircleAccessState(userId: string | null): CircleAccessState {
  const [circleEnabled, setCircleEnabled] = useState(false);
  const [hasAcceptedCircleConnections, setHasAcceptedCircleConnections] = useState(false);

  useEffect(() => {
    if (!userId) {
      setCircleEnabled(false);
      setHasAcceptedCircleConnections(false);
      return;
    }

    let cancelled = false;

    const loadCircleAccessState = async () => {
      const [circleAccessResult, connectionStateResult] = await Promise.allSettled([
        hasCircleAccess(userId),
        fetchCircleConnectionState(userId),
      ]);

      if (cancelled) return;

      setCircleEnabled(
        circleAccessResult.status === "fulfilled" ? circleAccessResult.value : false
      );
      setHasAcceptedCircleConnections(
        connectionStateResult.status === "fulfilled"
          ? connectionStateResult.value.acceptedCount > 0
          : false
      );
    };

    void loadCircleAccessState();

    const handleCircleAccessUpdate = () => {
      void loadCircleAccessState();
    };

    window.addEventListener(CIRCLE_ACCESS_UPDATED_EVENT, handleCircleAccessUpdate);
    return () => {
      cancelled = true;
      window.removeEventListener(CIRCLE_ACCESS_UPDATED_EVENT, handleCircleAccessUpdate);
    };
  }, [userId]);

  return {
    circleEnabled,
    hasAcceptedCircleConnections,
  };
}
