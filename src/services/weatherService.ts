export interface HourlyForecast {
  time: Date;
  temp: number;
  condition: string;
  precipProb: number;
}

export interface WeatherData {
  temp: number;
  condition: string;
  isDay: boolean;
  high: number;
  low: number;
  precipProb: number;
  locationName: string;
  updatedAt: Date;
  hourly: HourlyForecast[];
}

export const weatherService = {
  getWeatherCondition(code: number): string {
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
  },

  async fetchWeatherCoords(lat: number, lon: number, name: string): Promise<WeatherData> {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,is_day,weather_code&hourly=temperature_2m,weather_code,precipitation_probability&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=auto`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('Weather API error');
    const json = await res.json();
    
    const hourlyData: HourlyForecast[] = [];
    if (json.hourly && json.hourly.time) {
      const times = json.hourly.time;
      const nowMs = new Date().getTime();
      let startIndex = 0;
      for (let i = 0; i < times.length; i++) {
        if (new Date(times[i]).getTime() >= nowMs - 3600000) {
          startIndex = i;
          break;
        }
      }
      for (let i = startIndex; i < Math.min(startIndex + 48, times.length); i++) {
        hourlyData.push({
          time: new Date(times[i]),
          temp: Math.round(json.hourly.temperature_2m[i]),
          condition: this.getWeatherCondition(json.hourly.weather_code[i]),
          precipProb: json.hourly.precipitation_probability[i] || 0
        });
      }
    }

    return {
      temp: Math.round(json.current.temperature_2m),
      condition: this.getWeatherCondition(json.current.weather_code),
      isDay: json.current.is_day === 1,
      high: Math.round(json.daily.temperature_2m_max[0]),
      low: Math.round(json.daily.temperature_2m_min[0]),
      precipProb: json.daily.precipitation_probability_max[0] || 0,
      locationName: name,
      updatedAt: new Date(),
      hourly: hourlyData
    };
  },

  async fetchWeather(weatherLocation: string): Promise<WeatherData> {
    if (weatherLocation === 'auto') {
      return new Promise((resolve) => {
        if ('geolocation' in navigator) {
          navigator.geolocation.getCurrentPosition(
            (pos) => resolve(this.fetchWeatherCoords(pos.coords.latitude, pos.coords.longitude, 'Current Location')),
            () => resolve(this.fetchWeatherCoords(23.8103, 90.4125, 'Dhaka'))
          );
        } else {
          resolve(this.fetchWeatherCoords(23.8103, 90.4125, 'Dhaka'));
        }
      });
    } else {
      const parts = weatherLocation.split(',');
      if (parts.length >= 3) {
        const name = parts.slice(2).join(',');
        return this.fetchWeatherCoords(parseFloat(parts[0]), parseFloat(parts[1]), name);
      } else {
        return this.fetchWeatherCoords(23.8103, 90.4125, 'Dhaka');
      }
    }
  },

  generateSmartSuggestion(weatherData: WeatherData | null, classStartTimeMs: number, classDurationMinutes: number): string | null {
    if (!weatherData || !weatherData.hourly || weatherData.hourly.length === 0) return null;
    
    const classEndTimeMs = classStartTimeMs + classDurationMinutes * 60000;
    
    // Find forecast around class start (from 2h before to class start)
    const beforeClassForecasts = weatherData.hourly.filter(h => {
      const t = h.time.getTime();
      return t >= classStartTimeMs - 2 * 3600000 && t <= classStartTimeMs + 1800000;
    });

    // Find forecast around class end (from class end to 2h after)
    const afterClassForecasts = weatherData.hourly.filter(h => {
      const t = h.time.getTime();
      return t >= classEndTimeMs - 1800000 && t <= classEndTimeMs + 2 * 3600000;
    });

    const isRain = (h: HourlyForecast) => h.precipProb > 40 || h.condition.includes('Rain') || h.condition.includes('Showers') || h.condition.includes('Drizzle') || h.condition.includes('Thunderstorm');
    const isHeavyRain = (h: HourlyForecast) => h.precipProb > 70 || h.condition.includes('Thunderstorm');
    const isHot = (h: HourlyForecast) => h.temp > 33;
    const isCold = (h: HourlyForecast) => h.temp < 15;

    const rainBefore = beforeClassForecasts.find(isRain);
    const heavyRainBefore = beforeClassForecasts.find(isHeavyRain);
    const rainAfter = afterClassForecasts.find(isRain);
    
    if (heavyRainBefore) {
      return "🌧️ Heavy rain is expected around your class.\nConsider leaving a little earlier.";
    }
    
    if (rainBefore) {
      return "🌧️ Rain likely before your class.\nConsider taking an umbrella.";
    }
    
    if (rainAfter) {
      return "☔ Rain may be likely when your class ends.\nConsider bringing an umbrella.";
    }

    const hotBefore = beforeClassForecasts.find(isHot);
    if (hotBefore) {
      return "🥵 It's very hot around your class.\nBring water and consider light clothing.";
    }

    const coldBefore = beforeClassForecasts.find(isCold);
    if (coldBefore) {
      return "🥶 It's quite cold around your class.\nConsider wearing a warmer layer.";
    }

    return null;
  }
};
