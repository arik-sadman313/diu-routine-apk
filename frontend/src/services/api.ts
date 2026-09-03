import type {
  VersionsResponse,
  RoutineVersion,
  OptionsResponse,
  ClassesResponse,
  SearchResponse,
  UploadResponse,
  OverrideRequest,
} from '../types/api';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api';

class ApiError extends Error {
  public status: number;
  public data?: any;
  constructor(status: number, message: string, data?: any) {
    super(message);
    this.status = status;
    this.data = data;
    this.name = 'ApiError';
  }
}

async function fetchApi<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE}${endpoint}`;
  const response = await fetch(url, options);

  if (!response.ok) {
    let errorDetail = response.statusText;
    try {
      const errorData = await response.json();
      errorDetail = errorData.detail || errorDetail;
    } catch {
      // Ignore JSON parse error
    }
    const message = typeof errorDetail === 'string' ? errorDetail : ((errorDetail as any)?.message || JSON.stringify(errorDetail));
    throw new ApiError(response.status, message, typeof errorDetail === 'object' ? errorDetail : undefined);
  }

  return response.json();
}

export const api = {
  async getHealth() {
    return fetchApi<any>('/health');
  },

  async getVersions(): Promise<VersionsResponse> {
    return fetchApi<VersionsResponse>('/versions');
  },

  async getVersion(id: number): Promise<RoutineVersion> {
    return fetchApi<RoutineVersion>(`/versions/${id}`);
  },

  async getOptions(versionId?: number): Promise<OptionsResponse> {
    const params = new URLSearchParams();
    if (versionId) params.append('version_id', versionId.toString());
    return fetchApi<OptionsResponse>(`/options?${params.toString()}`);
  },

  async getRoutine(batch: string, section: string, versionId?: number): Promise<ClassesResponse> {
    const params = new URLSearchParams();
    if (versionId) params.append('version_id', versionId.toString());
    const query = params.toString();
    return fetchApi<ClassesResponse>(`/routine/${encodeURIComponent(batch)}/${encodeURIComponent(section)}${query ? '?' + query : ''}`);
  },

  async search(query: string, versionId?: number): Promise<SearchResponse> {
    const params = new URLSearchParams();
    params.append('q', query);
    if (versionId) params.append('version_id', versionId.toString());
    return fetchApi<SearchResponse>(`/search?${params.toString()}`);
  },

  async uploadRoutine(file: File, name?: string): Promise<UploadResponse> {
    const formData = new FormData();
    formData.append('file', file);
    
    let url = '/upload';
    if (name) {
      url += `?name=${encodeURIComponent(name)}`;
    }

    return fetchApi<UploadResponse>(url, {
      method: 'POST',
      body: formData,
    });
  },

  async uploadConfirm(sessionId: string, filename: string, corrections: any[], name?: string): Promise<UploadResponse> {
    const formData = new FormData();
    formData.append('session_id', sessionId);
    formData.append('filename', filename);
    formData.append('corrections', JSON.stringify(corrections));
    if (name) formData.append('name', name);

    return fetchApi<UploadResponse>('/upload/confirm', {
      method: 'POST',
      body: formData,
    });
  },

  async saveOverride(versionId: number, payload: OverrideRequest): Promise<{ status: string }> {
    return fetchApi<{ status: string }>(`/routine/${versionId}/overrides`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
  },

  async deleteOverride(versionId: number, classId: number): Promise<{ status: string }> {
    return fetchApi<{ status: string }>(`/routine/${versionId}/classes/${classId}`, {
      method: 'DELETE',
    });
  },

  async importJson(jsonContent: any): Promise<UploadResponse> {
    return fetchApi<UploadResponse>('/import/json', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(jsonContent),
    });
  },

  async exportJson(versionId: number): Promise<any> {
    return fetchApi<any>(`/export/json/${versionId}`);
  }
};
