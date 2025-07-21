declare module 'gpx-js' {
    export = GpxJs;

    class GpxJs {
      constructor(gpxContent: string);
      parse(gpxContent: string): void; // Or the actual return type if known

      // You can add more properties/methods from the library here as you use them,
      // based on the library's documentation or by inspecting the parsed object at runtime.
      // For example:
      tracks: Array<any>; // Use a more specific type if you know the structure of tracks
      // You might need to define interfaces for Track, Point, etc. if you want full type safety
    }
  }