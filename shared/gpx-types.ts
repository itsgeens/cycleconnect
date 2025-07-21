export interface GPXStats {
    distance: number;
    elevationGain: number;
    coordinates: [number, number][];
    startCoords?: { lat: number; lng: number };
    endCoords?: { lat: number; lng: number };
  }

  // You can add other GPX-related types here if needed later