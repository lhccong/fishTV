import { API_CONFIG } from './config';
import { ApiResponse } from './types';

const request = async <T>(endpoint: string, params: Record<string, any> = {}, baseURL?: string): Promise<ApiResponse<T>> => {
  const queryString = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      queryString.append(key, String(value));
    }
  });

  const url = `${baseURL || API_CONFIG.baseURL}${endpoint}?${queryString.toString()}`;
  try {
    const response = await fetch(url, {
      method: 'GET',
      credentials: 'same-origin',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      if (response.status === 401) window.dispatchEvent(new Event('fish-tv-auth-expired'));
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data as ApiResponse<T>;
  } catch (error) {
    console.error('API request failed:', error);
    throw error;
  }
};

export default request;
