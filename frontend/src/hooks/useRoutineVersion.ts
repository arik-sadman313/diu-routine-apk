import { useState, useEffect } from 'react';
import { api } from '../services/api';
import type { RoutineVersion } from '../types/api';

export function useRoutineVersion() {
  const [versionId, setVersionId] = useState<number | undefined>(undefined);
  const [versions, setVersions] = useState<RoutineVersion[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchVersions() {
      try {
        const data = await api.getVersions();
        setVersions(data.versions);
        // Default to the latest version (first in the list since API orders by id DESC)
        if (data.versions.length > 0) {
          setVersionId((prev) => prev !== undefined ? prev : data.versions[0].id);
        }
      } catch (error) {
        console.error("Failed to fetch versions:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchVersions();
  }, []);

  return { versionId, setVersionId, versions, loading };
}
