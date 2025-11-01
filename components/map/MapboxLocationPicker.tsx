'use client';

import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { MapPin, ExternalLink } from 'lucide-react';

// Configura el token de acceso de Mapbox
mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || '';

interface MapboxLocationPickerProps{
  initialLocation?: { lng: number; lat: number } | null;
  onLocationSelect: (location: { lng: number; lat: number } | null) => void;
  address?: string;
  geocodeVersion?: number; // optional trigger counter
  preferredCity?: string; // Ciudad/departamento esperado (e.g., Guaymallén)
  preferredPostcode?: string; // Código postal esperado (e.g., 5521 o M5521)
  preferredRegion?: string; // Región/provincia esperada (e.g., Mendoza)
  disableAutoGeocode?: boolean; // Disable automatic geocoding completely
}

export function MapboxLocationPicker({ 
  initialLocation = { lng: -68.845, lat: -32.889 },
  onLocationSelect,
  address = '',
  geocodeVersion,
  preferredCity,
  preferredPostcode,
  preferredRegion,
  disableAutoGeocode = false,
}: MapboxLocationPickerProps) {
  const coerceLngLat = (loc?: { lng: any; lat: any } | null) => {
    if (!loc) return null;
    const lng = Number(loc.lng);
    const lat = Number(loc.lat);
    if (Number.isFinite(lng) && Number.isFinite(lat)) return { lng, lat };
    return null;
  };
  const safeInitial = coerceLngLat(initialLocation);
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const marker = useRef<mapboxgl.Marker | null>(null);
  const [loading, setLoading] = useState(true);
  const [geocodeFailed, setGeocodeFailed] = useState(false);
  const [failedAddress, setFailedAddress] = useState('');
  const [manualCoords, setManualCoords] = useState('');
  const lastGeocodeVersion = useRef<number | null>(null);
  const lastLoadedLocation = useRef<string | null>(null); // Track last loaded location
  const userHasManuallyPlaced = useRef(false); // Track if user manually placed marker

  // Efecto para inicializar el mapa
  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    // Verificar si el token está configurado
    if (!mapboxgl.accessToken) {
      console.error('Mapbox token is not configured');
      setLoading(false);
      return;
    }

    try {
      // Inicializar el mapa
      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: 'mapbox://styles/mapbox/streets-v11',
        center: [safeInitial?.lng ?? -68.845, safeInitial?.lat ?? -32.889],
        zoom: 12
      });

      // Agregar controles de navegación
      map.current.addControl(new mapboxgl.NavigationControl());

      // Manejador de clics en el mapa
      const handleMapClick = (e: any) => {
        const { lng, lat } = e.lngLat;
        userHasManuallyPlaced.current = true;
        onLocationSelect({ lng, lat });
        
        if (marker.current) {
          marker.current.setLngLat([lng, lat]);
        } else {
          marker.current = new mapboxgl.Marker({ draggable: true })
            .setLngLat([lng, lat])
            .addTo(map.current!);
          marker.current.on('dragend', () => {
            const pos = marker.current!.getLngLat();
            userHasManuallyPlaced.current = true;
            onLocationSelect({ lng: pos.lng, lat: pos.lat });
          });
        }
      };

      map.current.on('click', handleMapClick);

      // Manejar errores de carga del mapa
      map.current.on('load', () => {
        setLoading(false);
      });

      map.current.on('error', (e: any) => {
        console.error('Mapbox error:', e.error);
        setLoading(false);
      });

      // Limpieza
      return () => {
        if (map.current) {
          map.current.off('click', handleMapClick);
        }
        if (marker.current) {
          marker.current.remove();
          marker.current = null;
        }
        if (map.current) {
          map.current.remove();
          map.current = null;
        }
        // Reset location tracking so it can be loaded again on remount
        lastLoadedLocation.current = null;
        userHasManuallyPlaced.current = false;
      };
    } catch (error) {
      console.error('Error initializing map:', error);
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Solo inicializar una vez al montar

  // Efecto para actualizar el mapa cuando cambia la dirección
  useEffect(() => {
    if (!map.current) return;

    const trimmed = (address || '').trim();
    if (!trimmed || trimmed.length < 5) return;
    if (disableAutoGeocode) return;
    if (userHasManuallyPlaced.current) return;

    // If a version trigger is provided, only geocode on version change
    if (typeof geocodeVersion === 'number') {
      if (geocodeVersion === lastGeocodeVersion.current) return;
      lastGeocodeVersion.current = geocodeVersion;
    }

    const geocodeAddress = async () => {
      const q = trimmed;
      try {
        const qLower = q.toLowerCase();
        
        // Extrae CP numérico (prioriza el proporcionado por prop si existe)
        const propCpNumMatch = (preferredPostcode || '').toLowerCase().match(/\b(?:[a-z])?(\d{4})\b/i);
        const propCpNum = propCpNumMatch ? propCpNumMatch[1] : undefined;
        const cpMatch = qLower.match(/\b(?:[a-z])?(\d{4})\b/i);
        const cpNum = propCpNum || (cpMatch ? cpMatch[1] : undefined);
        // Ciudad y región preferidas normalizadas
        const norm = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
        const prefCityNorm = preferredCity ? norm(preferredCity) : '';
        const prefRegionNorm = preferredRegion ? norm(preferredRegion) : undefined;

        // Always use v5 text-based geocoding - works better for street addresses
        const center = map.current?.getCenter();
        const params = new URLSearchParams({
          country: 'ar',
          language: 'es',
          autocomplete: 'false',
          types: 'address',
          limit: '10',
          access_token: mapboxgl.accessToken as string,
        });
        if (center) params.set('proximity', `${center.lng},${center.lat}`);
        
        const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(q)}.json?${params.toString()}`;
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`Geocoding failed: ${response.status}`);
        }
        const data = await response.json();
        
        if (data?.features && Array.isArray(data.features) && data.features.length > 0) {
          type Ctx = { id?: string; text?: string; short_code?: string };
          type GeoFeature = {
            center: [number, number];
            place_name?: string;
            text?: string;
            context?: Ctx[];
            place_type?: string[];
          };
          const features = data.features as GeoFeature[];

          // Extraer nombre de calle y número de la dirección original
          const addressParts = q.split(',')[0].trim();
          const streetMatch = addressParts.match(/^([a-záéíóúñ\s]+)\s*(\d+)?/i);
          const streetName = streetMatch ? norm(streetMatch[1].trim()) : '';
          const streetNumber = streetMatch && streetMatch[2] ? streetMatch[2] : '';

          const rows = features.map((f) => {
            const fullName = f.place_name || f.text || '';
            const name = norm(fullName);
            const featureText = norm(f.text || '');
            
            const ctx = (f.context || []).reduce(
              (acc, c) => {
                const id = c.id || '';
                const t = norm(c.text || '');
                if (id.startsWith('place.')) acc.place = t;
                else if (id.startsWith('locality.')) acc.locality = t;
                else if (id.startsWith('district.')) acc.district = t;
                else if (id.startsWith('region.')) acc.region = t;
                else if (id.startsWith('postcode.')) acc.postcode = t;
                return acc;
              },
              { place: '', locality: '', district: '', region: '', postcode: '' } as { place: string; locality: string; district: string; region: string; postcode: string }
            );

            // Verificar coincidencias exactas
            // Para CP: quitar la M de ambos lados antes de comparar (formato argentino M5521)
            const ctxPostcodeNum = ctx.postcode.replace(/^m/, '');
            const matchesCpExact = cpNum ? (ctxPostcodeNum === cpNum) : true;
            
            // Para ciudad: verificar coincidencia bidireccional SOLO si ambos strings no están vacíos
            const matchesCityExact = prefCityNorm
              ? (
                  (ctx.place && (ctx.place.includes(prefCityNorm) || prefCityNorm.includes(ctx.place))) ||
                  (ctx.locality && (ctx.locality.includes(prefCityNorm) || prefCityNorm.includes(ctx.locality))) ||
                  (ctx.district && (ctx.district.includes(prefCityNorm) || prefCityNorm.includes(ctx.district)))
                )
              : true;
            
            const matchesStreet = streetName ? featureText.includes(streetName) : true;
            const matchesNumber = streetNumber ? name.includes(streetNumber) : true;

            return { 
              raw: f, 
              name: fullName, 
              featureText, 
              ...ctx, 
              matchesCpExact,
              matchesCityExact,
              matchesStreet,
              matchesNumber
            };
          });

          // Intentar filtrado ESTRICTO primero: CP + Ciudad + Calle
          let filtered = rows.filter(r => {
            return r.matchesCpExact && r.matchesCityExact && r.matchesStreet;
          });
          
          // Si no hay resultados con CP exacto, intentar solo con Ciudad + Calle
          if (filtered.length === 0 && prefCityNorm && streetName) {
            filtered = rows.filter(r => r.matchesCityExact && r.matchesStreet);
          }
          
          // IMPORTANTE: Si se especificó una ciudad preferida y no hay resultados,
          // NO buscar en otras ciudades - mostrar error para usar Google Maps
          if (filtered.length === 0 && prefCityNorm) {
            // Intentar centrar el mapa en la ciudad/región al menos
            const cityResult = features.find(f => {
              const ctx = (f.context || []).reduce(
                (acc, c) => {
                  const id = c.id || '';
                  const t = norm(c.text || '');
                  if (id.startsWith('place.')) acc.place = t;
                  else if (id.startsWith('locality.')) acc.locality = t;
                  else if (id.startsWith('district.')) acc.district = t;
                  return acc;
                },
                { place: '', locality: '', district: '' } as { place: string; locality: string; district: string }
              );
              return prefCityNorm && (ctx.place.includes(prefCityNorm) || ctx.locality.includes(prefCityNorm) || ctx.district.includes(prefCityNorm));
            });
            
            if (cityResult && map.current) {
              const [lng, lat] = cityResult.center;
              map.current.flyTo({ center: [lng, lat], zoom: 14 });
            }
            
            // Mostrar opciones para buscar en Google Maps
            setGeocodeFailed(true);
            setFailedAddress(q);
            return;
          }
          
          // Solo si NO se especificó ciudad preferida, intentar buscar solo con Calle
          if (filtered.length === 0 && streetName && !prefCityNorm) {
            filtered = rows.filter(r => r.matchesStreet);
          }
          
          if (filtered.length === 0) {
            // Intentar centrar el mapa en la ciudad/región al menos
            const cityResult = features.find(f => {
              const ctx = (f.context || []).reduce(
                (acc, c) => {
                  const id = c.id || '';
                  const t = norm(c.text || '');
                  if (id.startsWith('place.')) acc.place = t;
                  else if (id.startsWith('locality.')) acc.locality = t;
                  else if (id.startsWith('district.')) acc.district = t;
                  return acc;
                },
                { place: '', locality: '', district: '' } as { place: string; locality: string; district: string }
              );
              return prefCityNorm && (ctx.place.includes(prefCityNorm) || ctx.locality.includes(prefCityNorm) || ctx.district.includes(prefCityNorm));
            });
            
            if (cityResult && map.current) {
              const [lng, lat] = cityResult.center;
              map.current.flyTo({ center: [lng, lat], zoom: 14 });
            }
            
            // Mostrar opciones para buscar en Google Maps
            setGeocodeFailed(true);
            setFailedAddress(q);
            return;
          }

          // Si hay múltiples resultados válidos, preferir el que tenga número
          let best = filtered[0];
          if (streetNumber && filtered.length > 1) {
            const withNumber = filtered.find(r => r.matchesNumber);
            if (withNumber) {
              best = withNumber;
            }
          }
          const [lng, lat] = best.raw.center;
          
          // Limpiar estado de error si se encontró resultado
          setGeocodeFailed(false);
          setFailedAddress('');
          
          if (map.current) {
            map.current.flyTo({ 
              center: [lng, lat], 
              zoom: 17
            });

            if (marker.current) {
              marker.current.setLngLat([lng, lat]);
            } else {
              marker.current = new mapboxgl.Marker({ draggable: true })
                .setLngLat([lng, lat])
                .addTo(map.current);
              marker.current.on('dragend', () => {
                const pos = marker.current!.getLngLat();
                userHasManuallyPlaced.current = true;
                onLocationSelect({ lng: pos.lng, lat: pos.lat });
              });
            }

            onLocationSelect({ lng, lat });
          }
        } else {
          setGeocodeFailed(true);
          setFailedAddress(q);
        }
      } catch (error) {
        console.error('Error en geocodificación:', error);
        setGeocodeFailed(true);
        setFailedAddress(q);
      }
    };

    const timeoutId = setTimeout(geocodeAddress, 1000);
    return () => clearTimeout(timeoutId);
  }, [address, onLocationSelect, geocodeVersion]);

  // Efecto para la ubicación inicial
  useEffect(() => {
    const coerced = coerceLngLat(initialLocation);
    
    if (!coerced) return;
    if (!map.current) return;
    
    // Check if this location was already loaded
    const locationKey = `${coerced.lng},${coerced.lat}`;
    if (lastLoadedLocation.current === locationKey) return;
    
    lastLoadedLocation.current = locationKey;
    // Reset manual placement flag when loading a new initial location
    userHasManuallyPlaced.current = false;
    
    map.current.flyTo({
      center: [coerced.lng, coerced.lat],
      zoom: 15
    });
    
    if (marker.current) {
      marker.current.setLngLat([coerced.lng, coerced.lat]);
    } else if (map.current) {
      marker.current = new mapboxgl.Marker({ draggable: true })
        .setLngLat([coerced.lng, coerced.lat])
        .addTo(map.current);
      
      marker.current.on('dragend', () => {
        const pos = marker.current!.getLngLat();
        userHasManuallyPlaced.current = true;
        onLocationSelect({ lng: pos.lng, lat: pos.lat });
      });
    }
  }, [initialLocation, map.current]);

  const handleOpenGoogleMaps = () => {
    const encodedAddress = encodeURIComponent(failedAddress);
    const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodedAddress}`;
    window.open(googleMapsUrl, '_blank');
  };

  const handleManualCoords = () => {
    const coordsPattern = /^\s*(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)\s*$/;
    const match = manualCoords.trim().match(coordsPattern);
    
    if (!match) {
      alert('Formato inválido. Usa el formato: latitud, longitud (ejemplo: -32.889, -68.845)');
      return;
    }
    
    const lat = parseFloat(match[1]);
    const lng = parseFloat(match[2]);
    
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      alert('Coordenadas inválidas');
      return;
    }
    
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      alert('Coordenadas fuera de rango válido');
      return;
    }
    
    if (map.current) {
      map.current.flyTo({ 
        center: [lng, lat], 
        zoom: 17
      });
      
      if (marker.current) {
        marker.current.setLngLat([lng, lat]);
      } else {
        marker.current = new mapboxgl.Marker({ draggable: true })
          .setLngLat([lng, lat])
          .addTo(map.current);
        marker.current.on('dragend', () => {
          const pos = marker.current!.getLngLat();
          userHasManuallyPlaced.current = true;
          onLocationSelect({ lng: pos.lng, lat: pos.lat });
        });
      }
      
      userHasManuallyPlaced.current = true;
      onLocationSelect({ lng, lat });
      setGeocodeFailed(false);
      setManualCoords('');
    }
  };

  return (
    <div className="mt-2">
      {geocodeFailed && (
        <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <div className="flex items-start gap-2">
            <MapPin className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-yellow-800 mb-2">
                No se encontró la dirección en Mapbox
              </p>
              <p className="text-sm text-yellow-700 mb-3">
                Puedes buscar en Google Maps y copiar las coordenadas:
              </p>
              
              <button
                onClick={handleOpenGoogleMaps}
                className="inline-flex items-center gap-2 px-3 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors mb-3"
              >
                <ExternalLink className="w-4 h-4" />
                Abrir en Google Maps
              </button>
              
              <div className="mt-3">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  O ingresa las coordenadas manualmente:
                </label>
                <p className="text-xs text-gray-500 mb-2">
                  Formato: latitud, longitud (ejemplo: -32.889, -68.845)
                </p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={manualCoords}
                    onChange={(e) => setManualCoords(e.target.value)}
                    placeholder="-32.889, -68.845"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleManualCoords();
                      }
                    }}
                  />
                  <button
                    onClick={handleManualCoords}
                    className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-md hover:bg-green-700 transition-colors"
                  >
                    Aplicar
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      
      <div 
        ref={mapContainer} 
        className="relative h-96 w-full rounded-lg border border-gray-300"
        style={{ 
          minHeight: '400px'
        }}
      >
        {loading && (
          <div className="absolute inset-0 bg-gray-200 animate-pulse rounded-lg pointer-events-none" />
        )}
      </div>
      <p className="mt-2 text-sm text-gray-500">
        Haz clic en el mapa para marcar la ubicación exacta o arrastra el marcador para ajustar
      </p>
    </div>
  );
}