import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  Cloud, 
  CloudRain, 
  Sun, 
  CloudSnow, 
  Wind, 
  Thermometer, 
  Droplets, 
  Eye,
  AlertTriangle,
  CheckCircle,
  XCircle
} from "lucide-react";

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
  cyclingAssessment?: {
    isGood: boolean;
    score: number;
    reasons: string[];
  };
}

interface WeatherWidgetProps {
  lat: number;
  lon: number;
  showForecast?: boolean;
  compact?: boolean;
}

const getWeatherIcon = (iconCode: string) => {
  if (iconCode.includes('01')) return <Sun className="w-6 h-6" />;
  if (iconCode.includes('02') || iconCode.includes('03') || iconCode.includes('04')) return <Cloud className="w-6 h-6" />;
  if (iconCode.includes('09') || iconCode.includes('10')) return <CloudRain className="w-6 h-6" />;
  if (iconCode.includes('13')) return <CloudSnow className="w-6 h-6" />;
  return <Cloud className="w-6 h-6" />;
};

const getCyclingScoreColor = (score: number) => {
  if (score >= 80) return "bg-green-500";
  if (score >= 60) return "bg-yellow-500";
  if (score >= 40) return "bg-orange-500";
  return "bg-red-500";
};

const getCyclingScoreIcon = (isGood: boolean) => {
  if (isGood) return <CheckCircle className="w-4 h-4 text-green-600" />;
  return <XCircle className="w-4 h-4 text-red-600" />;
};

export default function WeatherWidget({ lat, lon, showForecast = false, compact = false }: WeatherWidgetProps) {
  const [selectedHour, setSelectedHour] = useState(0);

  const { data: currentWeather, isLoading } = useQuery({
    queryKey: ["/api/weather/current", lat, lon],
    queryFn: async () => {
      const response = await fetch(`/api/weather/current?lat=${lat}&lon=${lon}`);
      if (!response.ok) throw new Error("Failed to fetch current weather");
      return response.json();
    },
    enabled: !!lat && !!lon,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const { data: forecast } = useQuery({
    queryKey: ["/api/weather/forecast", lat, lon],
    queryFn: async () => {
      const response = await fetch(`/api/weather/forecast?lat=${lat}&lon=${lon}`);
      if (!response.ok) throw new Error("Failed to fetch weather forecast");
      return response.json();
    },
    enabled: showForecast && !!lat && !!lon,
    staleTime: 30 * 60 * 1000, // 30 minutes
  });

  if (isLoading) {
    return (
      <Card className={compact ? "w-full" : "w-full max-w-md"}>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Cloud className="w-5 h-5" />
            Weather Loading...
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-2">
            <div className="h-8 bg-gray-200 rounded w-3/4"></div>
            <div className="h-6 bg-gray-200 rounded w-1/2"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!currentWeather) {
    return (
      <Card className={compact ? "w-full" : "w-full max-w-md"}>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-yellow-500" />
            Weather Unavailable
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-600">
            Unable to fetch weather data. Please check your location settings or try again later.
          </p>
        </CardContent>
      </Card>
    );
  }

  const weather = currentWeather.weather;
  const assessment = currentWeather.cyclingAssessment;

  return (
    <Card className={compact ? "w-full" : "w-full max-w-md"}>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          {getWeatherIcon(weather.icon)}
          Current Weather
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Current Weather */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-3xl font-bold">{weather.temperature}°C</div>
              <div className="text-sm text-gray-600 capitalize">{weather.conditions}</div>
            </div>
            <div className="text-right">
              <div className="text-sm text-gray-500">
                {new Date(weather.timestamp).toLocaleTimeString([], { 
                  hour: '2-digit', 
                  minute: '2-digit' 
                })}
              </div>
            </div>
          </div>

          {/* Cycling Assessment */}
          {assessment && (
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Cycling Conditions</span>
                <div className="flex items-center gap-2">
                  {getCyclingScoreIcon(assessment.isGood)}
                  <Badge 
                    variant="secondary" 
                    className={`${getCyclingScoreColor(assessment.score)} text-white`}
                  >
                    {assessment.score}%
                  </Badge>
                </div>
              </div>
              {assessment.reasons.length > 0 && (
                <div className="text-xs text-gray-600">
                  {assessment.reasons.join(", ")}
                </div>
              )}
            </div>
          )}

          {!compact && (
            <>
              <Separator />
              
              {/* Weather Details */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <Wind className="w-4 h-4 text-gray-500" />
                  <span>{weather.windSpeed} km/h</span>
                </div>
                <div className="flex items-center gap-2">
                  <Droplets className="w-4 h-4 text-gray-500" />
                  <span>{weather.humidity}%</span>
                </div>
                <div className="flex items-center gap-2">
                  <CloudRain className="w-4 h-4 text-gray-500" />
                  <span>{weather.precipitation}mm</span>
                </div>
                <div className="flex items-center gap-2">
                  <Eye className="w-4 h-4 text-gray-500" />
                  <span>{weather.visibility}km</span>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Hourly Forecast */}
        {showForecast && forecast && (
          <>
            <Separator />
            <div className="space-y-3">
              <h4 className="font-medium text-sm">24-Hour Forecast</h4>
              <div className="grid grid-cols-6 gap-2">
                {forecast.hourly.slice(0, 6).map((hour: WeatherData, index: number) => (
                  <div 
                    key={index}
                    className={`text-center p-2 rounded-lg cursor-pointer transition-colors ${
                      selectedHour === index ? 'bg-blue-100' : 'hover:bg-gray-50'
                    }`}
                    onClick={() => setSelectedHour(index)}
                  >
                    <div className="text-xs text-gray-500">
                      {new Date(hour.timestamp).toLocaleTimeString([], { 
                        hour: '2-digit' 
                      })}
                    </div>
                    <div className="my-1 flex justify-center">
                      {getWeatherIcon(hour.icon)}
                    </div>
                    <div className="text-sm font-medium">{hour.temperature}°</div>
                    {hour.cyclingAssessment && (
                      <div className="mt-1">
                        <div className={`w-3 h-3 rounded-full mx-auto ${getCyclingScoreColor(hour.cyclingAssessment.score)}`}></div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              
              {/* Selected Hour Details */}
              {forecast.hourly[selectedHour] && (
                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="text-sm font-medium mb-2">
                    {new Date(forecast.hourly[selectedHour].timestamp).toLocaleTimeString([], { 
                      hour: '2-digit', 
                      minute: '2-digit' 
                    })} Conditions
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>Wind: {forecast.hourly[selectedHour].windSpeed} km/h</div>
                    <div>Humidity: {forecast.hourly[selectedHour].humidity}%</div>
                    <div>Rain: {forecast.hourly[selectedHour].precipitation}mm</div>
                    <div>Visibility: {forecast.hourly[selectedHour].visibility}km</div>
                  </div>
                  {forecast.hourly[selectedHour].cyclingAssessment && (
                    <div className="mt-2 text-xs text-gray-600">
                      Score: {forecast.hourly[selectedHour].cyclingAssessment.score}%
                      {forecast.hourly[selectedHour].cyclingAssessment.reasons.length > 0 && (
                        <div className="mt-1">
                          {forecast.hourly[selectedHour].cyclingAssessment.reasons.join(", ")}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}