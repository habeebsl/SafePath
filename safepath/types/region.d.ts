declare module '@/config/region.json' {
  export interface Region {
    id: string;
    name: string;
    displayName: string;
    version: string;
    mapVersion: string;
    center: {
      latitude: number;
      longitude: number;
    };
    defaultZoom: {
      latitudeDelta: number;
      longitudeDelta: number;
    };
    countries: Array<{
      name: string;
      displayName: string;
      priority: string;
      center: {
        latitude: number;
        longitude: number;
      };
    }>;
    packageName: string;
    bundleId: string;
    primaryColor: string;
  }

  const region: Region;
  export default region;
}
