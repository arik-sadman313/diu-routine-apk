import { useState, useEffect } from 'react';

export function usePreferences() {
  const [batch, setBatch] = useState<string>(() => localStorage.getItem('diu_routine_batch') || '');
  const [section, setSection] = useState<string>(() => localStorage.getItem('diu_routine_section') || '');
  const [weatherLocation, setWeatherLocation] = useState<string>(() => localStorage.getItem('diu_weather_location') || 'Dhaka'); // Format: Lat,Lon or 'Dhaka'

  useEffect(() => {
    if (batch) localStorage.setItem('diu_routine_batch', batch);
    else localStorage.removeItem('diu_routine_batch');
  }, [batch]);

  useEffect(() => {
    if (section) localStorage.setItem('diu_routine_section', section);
    else localStorage.removeItem('diu_routine_section');
  }, [section]);

  useEffect(() => {
    if (weatherLocation) localStorage.setItem('diu_weather_location', weatherLocation);
    else localStorage.removeItem('diu_weather_location');
  }, [weatherLocation]);

  const clearPreferences = () => {
    setBatch('');
    setSection('');
    setWeatherLocation('Dhaka');
    localStorage.removeItem('diu_routine_batch');
    localStorage.removeItem('diu_routine_section');
    localStorage.removeItem('diu_weather_location');
  };

  return { batch, section, weatherLocation, setBatch, setSection, setWeatherLocation, clearPreferences };
}
