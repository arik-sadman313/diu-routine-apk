import { useState, useEffect } from 'react';
import { weatherService, type WeatherData } from '../services/weatherService';

export function useWeather(weatherLocation: string) {
  const [data, setData] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    
    async function loadWeather() {
      if (!mounted) return;
      setLoading(true);
      setError(null);
      
      try {
        const weatherData = await weatherService.fetchWeather(weatherLocation);
        if (mounted) {
          setData(weatherData);
        }
      } catch (err: any) {
        if (mounted) setError(err.message);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadWeather();
    
    return () => { mounted = false; };
  }, [weatherLocation]);

  return { data, loading, error };
}
