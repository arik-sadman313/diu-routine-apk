import type {
  VersionsResponse,
  RoutineVersion,
  OptionsResponse,
  ClassesResponse,
  SearchResponse,
  UploadResponse,
  OverrideRequest,
} from '../types/api';

import { Capacitor } from '@capacitor/core';
import { localRepository } from './localRepository';

const API_BASE = import.meta.env.VITE_API_BASE_URL || `http://${window.location.hostname}:8000/api`;

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
    if (Capacitor.isNativePlatform()) return localRepository.getVersions();
    return fetchApi<VersionsResponse>('/versions');
  },

  async getVersion(id: number): Promise<RoutineVersion> {
    if (Capacitor.isNativePlatform()) return localRepository.getVersion(id);
    return fetchApi<RoutineVersion>(`/versions/${id}`);
  },

  async getOptions(versionId?: number): Promise<OptionsResponse> {
    if (Capacitor.isNativePlatform()) return localRepository.getOptions(versionId);
    const params = new URLSearchParams();
    if (versionId) params.append('version_id', versionId.toString());
    return fetchApi<OptionsResponse>(`/options?${params.toString()}`);
  },

  async getRoutine(batch: string, section: string, versionId?: number): Promise<ClassesResponse> {
    if (Capacitor.isNativePlatform()) return localRepository.getRoutine(batch, section, versionId);
    const params = new URLSearchParams();
    if (versionId) params.append('version_id', versionId.toString());
    const query = params.toString();
    return fetchApi<ClassesResponse>(`/routine/${encodeURIComponent(batch)}/${encodeURIComponent(section)}${query ? '?' + query : ''}`);
  },

  async search(query: string, versionId?: number): Promise<SearchResponse> {
    if (Capacitor.isNativePlatform()) return localRepository.search(query, versionId);
    const params = new URLSearchParams();
    params.append('q', query);
    if (versionId) params.append('version_id', versionId.toString());
    return fetchApi<SearchResponse>(`/search?${params.toString()}`);
  },

  async uploadRoutine(file: File, name?: string): Promise<UploadResponse> {
    // Native PDF parsing is not supported directly in the frontend, should throw error or fallback
    if (Capacitor.isNativePlatform()) throw new Error("PDF parsing is only supported via JSON import on mobile.");
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
    if (Capacitor.isNativePlatform()) throw new Error("Not supported on mobile.");
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
    if (Capacitor.isNativePlatform()) return localRepository.saveOverride(versionId, payload);
    return fetchApi<{ status: string }>(`/routine/${versionId}/overrides`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
  },

  async deleteOverride(versionId: number, classId: number): Promise<{ status: string }> {
    if (Capacitor.isNativePlatform()) return localRepository.deleteOverride(versionId, classId);
    return fetchApi<{ status: string }>(`/routine/${versionId}/classes/${classId}`, {
      method: 'DELETE',
    });
  },

  async deleteRoutine(versionId: number): Promise<{ status: string }> {
    if (Capacitor.isNativePlatform()) return localRepository.deleteRoutine(versionId);
    return fetchApi<{ status: string }>(`/routine/${versionId}`, {
      method: 'DELETE',
    });
  },

  async getCustomCourses(): Promise<{ courses: { course_code: string; course_name: string }[] }> {
    if (Capacitor.isNativePlatform()) return localRepository.getCustomCourses();
    return fetchApi<{ courses: { course_code: string; course_name: string }[] }>('/courses');
  },

  async addCustomCourse(payload: { course_code: string; course_name: string }): Promise<{ status: string }> {
    if (Capacitor.isNativePlatform()) return localRepository.addCustomCourse(payload);
    return fetchApi<{ status: string }>('/courses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
  },

  async deleteCustomCourse(courseCode: string): Promise<{ status: string }> {
    if (Capacitor.isNativePlatform()) return localRepository.deleteCustomCourse(courseCode);
    return fetchApi<{ status: string }>(`/courses/${encodeURIComponent(courseCode)}`, {
      method: 'DELETE',
    });
  },

  async importJson(jsonContent: any): Promise<UploadResponse> {
    if (Capacitor.isNativePlatform()) return localRepository.importJson(jsonContent);
    return fetchApi<UploadResponse>('/import/json', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(jsonContent),
    });
  },

  async exportJsonAndSave(versionId: number): Promise<void> {
    if (Capacitor.isNativePlatform()) {
      const data = await localRepository.exportJson(versionId);
      const { Filesystem, Directory, Encoding } = await import('@capacitor/filesystem');
      const filename = `diu_routine_v${versionId}_export.json`;
      const strData = JSON.stringify(data, null, 2);
      
      try {
        await Filesystem.writeFile({
          path: filename,
          data: strData,
          directory: Directory.Documents,
          encoding: Encoding.UTF8,
        });
        alert(`Exported to Documents folder as ${filename}`);
      } catch (e) {
        console.error("Failed to write file:", e);
        alert("Failed to save export file.");
      }
    } else {
      window.open(`${API_BASE}/export/json/${versionId}`, '_blank');
    }
  }
};
