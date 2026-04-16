import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { AnalyzedReview } from '../types';
import { MapPin, Loader2 } from 'lucide-react';

// Fix for default marker icon in react-leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

interface MapSectionProps {
  reviews: AnalyzedReview[];
}

interface LocationData {
  name: string;
  address: string;
  lat: number;
  lon: number;
  avgRating: number;
  reviewCount: number;
}

const MapBoundsUpdater = ({ locations }: { locations: LocationData[] }) => {
  const map = useMap();
  
  useEffect(() => {
    if (locations.length > 0) {
      const bounds = L.latLngBounds(locations.map(loc => [loc.lat, loc.lon]));
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [locations, map]);

  return null;
};

export const MapSection: React.FC<MapSectionProps> = ({ reviews }) => {
  const [locations, setLocations] = useState<LocationData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasAddresses, setHasAddresses] = useState(false);

  useEffect(() => {
    const fetchCoordinates = async () => {
      const firmStats: Record<string, { sum: number; count: number; address: string }> = {};
      let anyAddressFound = false;

      reviews.forEach(r => {
        if (!firmStats[r.Location]) {
          firmStats[r.Location] = { sum: 0, count: 0, address: r.Address || '' };
          if (r.Address) anyAddressFound = true;
        }
        firmStats[r.Location].sum += r.Stars;
        firmStats[r.Location].count += 1;
        // Update address if we find one later and didn't have one
        if (!firmStats[r.Location].address && r.Address) {
          firmStats[r.Location].address = r.Address;
          anyAddressFound = true;
        }
      });

      setHasAddresses(anyAddressFound);

      if (!anyAddressFound) {
        setIsLoading(false);
        return;
      }

      const geocodedLocations: LocationData[] = [];

      for (const [name, stats] of Object.entries(firmStats)) {
        if (!stats.address) continue;

        try {
          // Add a small delay to respect Nominatim usage policy
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(stats.address)}&limit=1`, {
            headers: {
              'User-Agent': 'CX-Analysis-App/1.0'
            }
          });
          const data = await response.json();

          if (data && data.length > 0) {
            geocodedLocations.push({
              name,
              address: stats.address,
              lat: parseFloat(data[0].lat),
              lon: parseFloat(data[0].lon),
              avgRating: stats.sum / stats.count,
              reviewCount: stats.count
            });
          }
        } catch (error) {
          console.error(`Failed to geocode address for ${name}:`, error);
        }
      }

      setLocations(geocodedLocations);
      setIsLoading(false);
    };

    fetchCoordinates();
  }, [reviews]);

  if (!hasAddresses) {
    return null;
  }

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 mb-8">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-indigo-50 rounded-lg">
          <MapPin className="w-5 h-5 text-indigo-600" />
        </div>
        <h3 className="text-xl font-bold text-slate-800">Location Overview</h3>
      </div>

      {isLoading ? (
        <div className="h-[400px] w-full flex flex-col items-center justify-center bg-slate-50 rounded-xl border border-slate-100">
          <Loader2 className="w-8 h-8 text-indigo-400 animate-spin mb-4" />
          <p className="text-slate-500 font-medium">Geocoding locations...</p>
          <p className="text-slate-400 text-sm mt-2">This might take a moment to respect API limits.</p>
        </div>
      ) : locations.length > 0 ? (
        <div className="h-[400px] w-full rounded-xl overflow-hidden border border-slate-200 relative z-0">
          <MapContainer center={[51.1657, 10.4515]} zoom={6} style={{ height: '100%', width: '100%' }}>
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <MapBoundsUpdater locations={locations} />
            {locations.map((loc, idx) => (
              <Marker key={idx} position={[loc.lat, loc.lon]}>
                <Popup>
                  <div className="font-sans">
                    <h4 className="font-bold text-slate-800 text-sm mb-1">{loc.name}</h4>
                    <p className="text-xs text-slate-500 mb-2">{loc.address}</p>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-indigo-600">{loc.avgRating.toFixed(2)} ★</span>
                      <span className="text-xs text-slate-400">({loc.reviewCount} reviews)</span>
                    </div>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>
      ) : (
        <div className="h-[400px] w-full flex items-center justify-center bg-slate-50 rounded-xl border border-slate-100">
          <p className="text-slate-500 font-medium">Could not find coordinates for the provided addresses.</p>
        </div>
      )}
    </div>
  );
};
