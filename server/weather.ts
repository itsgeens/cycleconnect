interface WeatherData {
  temperature: number;
  humidity: number;
  windSpeed: number;
  windDirection: number;
  precipitation: number;
  visibility: number;
  conditions: string;
  icon: string;
  timestamp: string;
}

interface WeatherForecast {
  current: WeatherData;
  hourly: WeatherData[];
  daily: WeatherData[];
}

export class WeatherService {
  private static API_KEY = process.env.OPENWEATHER_API_KEY;
  private static BASE_URL = "https://api.openweathermap.org/data/2.5";

  static async getCurrentWeather(lat: number, lon: number): Promise<WeatherData> {
    // Always use mock data for now (no API key required)
    return await Promise.resolve(this.generateMockWeather(lat, lon));
    
    // Code below is for when API key is provided
    if (!this.API_KEY) {
      return await Promise.resolve(this.generateMockWeather(lat, lon));
    }

    try {
      const response = await fetch(
        `${this.BASE_URL}/weather?lat=${lat}&lon=${lon}&appid=${this.API_KEY}&units=metric`
      );

      if (!response.ok) {
        throw new Error(`Weather API error: ${response.status}`);
      }

      const data = await response.json();
      
      return {
        temperature: Math.round(data.main.temp),
        humidity: data.main.humidity,
        windSpeed: Math.round(data.wind.speed * 3.6), // Convert m/s to km/h
        windDirection: data.wind.deg,
        precipitation: data.rain?.['1h'] || 0,
        visibility: data.visibility / 1000, // Convert to km
        conditions: data.weather[0].description,
        icon: data.weather[0].icon,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error("Error fetching current weather:", error);
      // Fall back to mock data if API fails
      return await Promise.resolve(this.generateMockWeather(lat, lon));
    }
  }

  static async getWeatherForecast(lat: number, lon: number): Promise<WeatherForecast> {
    // Always use mock data for now (no API key required)
    return await Promise.resolve(this.generateMockForecast(lat, lon));
    
    // Code below is for when API key is provided
    if (!this.API_KEY) {
      return await Promise.resolve(this.generateMockForecast(lat, lon));
    }

    try {
      const response = await fetch(
        `${this.BASE_URL}/forecast?lat=${lat}&lon=${lon}&appid=${this.API_KEY}&units=metric`
      );

      if (!response.ok) {
        throw new Error(`Weather API error: ${response.status}`);
      }

      const data = await response.json();
      
      const current = await this.getCurrentWeather(lat, lon);
      
      const hourly = data.list.slice(0, 24).map((item: any) => ({
        temperature: Math.round(item.main.temp),
        humidity: item.main.humidity,
        windSpeed: Math.round(item.wind.speed * 3.6),
        windDirection: item.wind.deg,
        precipitation: item.rain?.['3h'] || 0,
        visibility: item.visibility / 1000,
        conditions: item.weather[0].description,
        icon: item.weather[0].icon,
        timestamp: new Date(item.dt * 1000).toISOString(),
      }));

      const daily = this.groupByDay(data.list).map((dayData: any) => ({
        temperature: Math.round(dayData.temp),
        humidity: dayData.humidity,
        windSpeed: Math.round(dayData.windSpeed * 3.6),
        windDirection: dayData.windDirection,
        precipitation: dayData.precipitation,
        visibility: dayData.visibility / 1000,
        conditions: dayData.conditions,
        icon: dayData.icon,
        timestamp: dayData.timestamp,
      }));

      return { current, hourly, daily };
    } catch (error) {
      console.error("Error fetching weather forecast:", error);
      // Fall back to mock data if API fails
      return await Promise.resolve(this.generateMockForecast(lat, lon));
    }
  }

  private static groupByDay(hourlyData: any[]): any[] {
    const days: { [key: string]: any[] } = {};
    
    hourlyData.forEach(item => {
      const date = new Date(item.dt * 1000).toDateString();
      if (!days[date]) {
        days[date] = [];
      }
      days[date].push(item);
    });

    return Object.keys(days).slice(0, 5).map(date => {
      const dayData = days[date];
      const temps = dayData.map(d => d.main.temp);
      const avgTemp = temps.reduce((a, b) => a + b, 0) / temps.length;
      
      return {
        temp: avgTemp,
        humidity: dayData[0].main.humidity,
        windSpeed: dayData[0].wind.speed,
        windDirection: dayData[0].wind.deg,
        precipitation: dayData.reduce((sum, d) => sum + (d.rain?.['3h'] || 0), 0),
        visibility: dayData[0].visibility,
        conditions: dayData[0].weather[0].description,
        icon: dayData[0].weather[0].icon,
        timestamp: new Date(dayData[0].dt * 1000).toISOString(),
      };
    });
  }

  // Mock weather generation methods for demonstration
  private static generateMockWeather(lat: number, lon: number): WeatherData {
    const now = new Date();
    const hour = now.getHours();
    const season = this.getSeason(now);
    
    // Generate realistic weather based on location and time
    const baseTemp = this.getBaseTemperature(lat, season);
    const temperature = baseTemp + Math.random() * 10 - 5; // ±5°C variation
    
    const conditions = this.getRandomCondition(season);
    const humidity = 40 + Math.random() * 40; // 40-80%
    const windSpeed = Math.random() * 25; // 0-25 km/h
    const precipitation = conditions.includes('rain') ? Math.random() * 5 : 0;
    
    return {
      temperature: Math.round(temperature),
      humidity: Math.round(humidity),
      windSpeed: Math.round(windSpeed),
      windDirection: Math.round(Math.random() * 360),
      precipitation: Math.round(precipitation * 10) / 10,
      visibility: 8 + Math.random() * 7, // 8-15 km
      conditions,
      icon: this.getIconForCondition(conditions),
      timestamp: now.toISOString(),
    };
  }

  private static generateMockForecast(lat: number, lon: number): WeatherForecast {
    const current = this.generateMockWeather(lat, lon);
    const hourly: WeatherData[] = [];
    const daily: WeatherData[] = [];
    
    const now = new Date();
    
    // Generate 24 hours of forecasts
    for (let i = 1; i <= 24; i++) {
      const forecastTime = new Date(now.getTime() + i * 60 * 60 * 1000);
      const season = this.getSeason(forecastTime);
      const baseTemp = this.getBaseTemperature(lat, season);
      const temperature = baseTemp + Math.random() * 12 - 6;
      const conditions = this.getRandomCondition(season);
      
      hourly.push({
        temperature: Math.round(temperature),
        humidity: 40 + Math.round(Math.random() * 40),
        windSpeed: Math.round(Math.random() * 25),
        windDirection: Math.round(Math.random() * 360),
        precipitation: conditions.includes('rain') ? Math.random() * 3 : 0,
        visibility: 8 + Math.random() * 7,
        conditions,
        icon: this.getIconForCondition(conditions),
        timestamp: forecastTime.toISOString(),
      });
    }
    
    // Generate 5 days of forecasts
    for (let i = 1; i <= 5; i++) {
      const forecastTime = new Date(now.getTime() + i * 24 * 60 * 60 * 1000);
      const season = this.getSeason(forecastTime);
      const baseTemp = this.getBaseTemperature(lat, season);
      const temperature = baseTemp + Math.random() * 8 - 4;
      const conditions = this.getRandomCondition(season);
      
      daily.push({
        temperature: Math.round(temperature),
        humidity: 45 + Math.round(Math.random() * 35),
        windSpeed: Math.round(Math.random() * 20),
        windDirection: Math.round(Math.random() * 360),
        precipitation: conditions.includes('rain') ? Math.random() * 8 : 0,
        visibility: 10 + Math.random() * 5,
        conditions,
        icon: this.getIconForCondition(conditions),
        timestamp: forecastTime.toISOString(),
      });
    }
    
    return { current, hourly, daily };
  }

  private static getSeason(date: Date): string {
    const month = date.getMonth();
    if (month >= 2 && month <= 4) return 'spring';
    if (month >= 5 && month <= 7) return 'summer';
    if (month >= 8 && month <= 10) return 'autumn';
    return 'winter';
  }

  private static getBaseTemperature(lat: number, season: string): number {
    // Simplified temperature model based on latitude and season
    const absLat = Math.abs(lat);
    
    let baseTemp = 25 - (absLat * 0.6); // Rough temperature gradient
    
    switch (season) {
      case 'winter': baseTemp -= 15; break;
      case 'spring': baseTemp -= 5; break;
      case 'summer': baseTemp += 5; break;
      case 'autumn': baseTemp -= 8; break;
    }
    
    return Math.max(-10, Math.min(40, baseTemp));
  }

  private static getRandomCondition(season: string): string {
    const conditions = {
      spring: ['clear sky', 'few clouds', 'scattered clouds', 'light rain', 'partly cloudy'],
      summer: ['clear sky', 'few clouds', 'partly cloudy', 'sunny'],
      autumn: ['overcast', 'light rain', 'cloudy', 'partly cloudy'],
      winter: ['overcast', 'light snow', 'cloudy', 'few clouds']
    };
    
    const seasonConditions = conditions[season as keyof typeof conditions] || conditions.spring;
    return seasonConditions[Math.floor(Math.random() * seasonConditions.length)];
  }

  private static getIconForCondition(condition: string): string {
    if (condition.includes('clear') || condition.includes('sunny')) return '01d';
    if (condition.includes('few clouds')) return '02d';
    if (condition.includes('scattered') || condition.includes('partly')) return '03d';
    if (condition.includes('overcast') || condition.includes('cloudy')) return '04d';
    if (condition.includes('rain')) return '10d';
    if (condition.includes('snow')) return '13d';
    return '01d';
  }

  static isGoodCyclingWeather(weather: WeatherData): {
    isGood: boolean;
    score: number;
    reasons: string[];
  } {
    let score = 100;
    const reasons: string[] = [];

    // Temperature scoring (ideal: 15-25°C)
    if (weather.temperature < 5) {
      score -= 30;
      reasons.push("Very cold temperature");
    } else if (weather.temperature < 10) {
      score -= 15;
      reasons.push("Cold temperature");
    } else if (weather.temperature > 35) {
      score -= 25;
      reasons.push("Very hot temperature");
    } else if (weather.temperature > 30) {
      score -= 10;
      reasons.push("Hot temperature");
    }

    // Precipitation scoring
    if (weather.precipitation > 5) {
      score -= 40;
      reasons.push("Heavy rain expected");
    } else if (weather.precipitation > 1) {
      score -= 20;
      reasons.push("Light rain expected");
    }

    // Wind scoring
    if (weather.windSpeed > 30) {
      score -= 25;
      reasons.push("Strong winds");
    } else if (weather.windSpeed > 20) {
      score -= 10;
      reasons.push("Moderate winds");
    }

    // Visibility scoring
    if (weather.visibility < 5) {
      score -= 15;
      reasons.push("Poor visibility");
    }

    // Conditions scoring
    const badConditions = ["thunderstorm", "snow", "mist", "fog"];
    if (badConditions.some(condition => weather.conditions.toLowerCase().includes(condition))) {
      score -= 20;
      reasons.push("Adverse weather conditions");
    }

    return {
      isGood: score >= 70,
      score: Math.max(0, score),
      reasons,
    };
  }
}