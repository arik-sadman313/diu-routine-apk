import { useState, useEffect } from 'react';

export interface WeatherData {
  temp: number;
  condition: string;
  isDay: boolean;
  high: number;
  low: number;
  precipProb: number;
  locationName: string;
  updatedAt: Date;
}

export function useWeather(weatherLocation: string) {
  const [data, setData] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    
    async function fetchWeather(lat: number, lon: number, name: string) {
      if (!mounted) return;
      setLoading(true);
      setError(null);
      
      try {
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,is_day,weather_code&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=auto`;
        const res = await fetch(url);
        if (!res.ok) throw new Error('Weather API error');
        const json = await res.json();
        
        if (mounted) {
          setData({
            temp: Math.round(json.current.temperature_2m),
            condition: getWeatherCondition(json.current.weather_code),
            isDay: json.current.is_day === 1,
            high: Math.round(json.daily.temperature_2m_max[0]),
            low: Math.round(json.daily.temperature_2m_min[0]),
            precipProb: json.daily.precipitation_probability_max[0] || 0,
            locationName: name,
            updatedAt: new Date()
          });
        }
      } catch (err: any) {
        if (mounted) setError(err.message);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    if (weatherLocation === 'auto') {
      if ('geolocation' in navigator) {
        navigator.geolocation.getCurrentPosition(
          (pos) => fetchWeather(pos.coords.latitude, pos.coords.longitude, 'Current Location'),
          () => fetchWeather(23.8103, 90.4125, 'Dhaka') // Fallback to Dhaka on permission denied
        );
      } else {
        fetchWeather(23.8103, 90.4125, 'Dhaka');
      }
    } else {
      const parts = weatherLocation.split(',');
      if (parts.length >= 3) {
        const name = parts.slice(2).join(',');
        fetchWeather(parseFloat(parts[0]), parseFloat(parts[1]), name);
      } else {
        fetchWeather(23.8103, 90.4125, 'Dhaka'); // Fallback
      }
    }
    
    return () => { mounted = false; };
  }, [weatherLocation]);

  return { data, loading, error };
}

function getWeatherCondition(code: number): string {
  // WMO Weather interpretation codes (https://open-meteo.com/en/docs)
  if (code === 0) return 'Clear';
  if (code === 1 || code === 2 || code === 3) return 'Partly Cloudy';
  if (code === 45 || code === 48) return 'Foggy';
  if (code >= 51 && code <= 55) return 'Drizzle';
  if (code >= 61 && code <= 65) return 'Rain';
  if (code >= 71 && code <= 77) return 'Snow';
  if (code >= 80 && code <= 82) return 'Showers';
  if (code >= 95) return 'Thunderstorm';
  return 'Cloudy';
}
