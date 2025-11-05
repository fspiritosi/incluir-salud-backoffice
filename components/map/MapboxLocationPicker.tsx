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

    // If a version trigger is provided, only geocode on version change
    if (typeof geocodeVersion === 'number') {
      if (geocodeVersion === lastGeocodeVersion.current) return;
      lastGeocodeVersion.current = geocodeVersion;
    }

    // Reset manual placement when address changes so geocoding can run
    userHasManuallyPlaced.current = false;

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
        let prefCityNorm = preferredCity ? norm(preferredCity) : '';
        // Evitar tratar como ciudad válida valores genéricos como "ciudad"
        if (prefCityNorm === 'ciudad' || prefCityNorm === 'city') {
          prefCityNorm = '';
        }
        const prefRegionNorm = preferredRegion ? norm(preferredRegion) : undefined;

        // Always use v5 text-based geocoding - works better for street addresses
        const center = map.current?.getCenter();
        const params = new URLSearchParams({
          country: 'ar',
          language: 'es',
          autocomplete: 'false',
          types: 'address,locality,place',
          limit: '10',
          access_token: mapboxgl.accessToken as string,
        });
        if (center) params.set('proximity', `${center.lng},${center.lat}`);
        else params.set('proximity', `-68.845,-32.889`); // Mendoza centro como hint
        // Quitar CP del query para no degradar el matching, pero seguir filtrando por CP exacto aparte
        const searchQ = q
          .replace(/\b(?:[a-z])?\d{4}\b/gi, '') // quitar CP
          .replace(/\s+,/g, ',')                  // espacios antes de coma
          .replace(/,+/g, ',')                     // colapsar comas repetidas
          .replace(/^,|,$/g, '')                   // comas al inicio/fin
          .replace(/\s{2,}/g, ' ')                // espacios dobles
          .trim();
        const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(searchQ || q)}.json?${params.toString()}`;
        console.log('[Geocode] Fetching:', url, { cpNum, prefCityNorm });
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`Geocoding failed: ${response.status}`);
        }
        const data = await response.json();
        console.log('[Geocode] features:', Array.isArray(data?.features) ? data.features.length : 0);
        
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
            // Para CP: extraer los 4 dígitos (soporta formatos M5521 o extendidos tipo 5500ABC)
            const ctxPostcodeNum = ctx.postcode.toLowerCase().replace(/^m/, '');
            const ctxCpDigits = (ctxPostcodeNum.match(/\d{4}/) || [""])[0];
            const matchesCpExact = cpNum ? (ctxCpDigits === cpNum) : true;
            
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
              matchesNumber,
              cpDigits: ctxCpDigits
            };
          });
          
          console.log('[Geocode] candidates (cp, city):', rows.map(r => ({
            cp: r.cpDigits || null,
            city: r.place || r.locality || r.district || null,
            name: r.name
          })));

          // Filtrado:
          // - Si el feature trae CP (cpDigits presente): exigir CP exacto
          // - Si el feature NO trae CP: permitir por ciudad (si provista) y/o calle
          const filtered = rows.filter((r) => {
            const hasCpInFeature = !!(r.cpDigits && r.cpDigits.length === 4);
            if (hasCpInFeature) return r.matchesCpExact;
            // Sin CP en el feature: aceptar si al menos coincide ciudad; si no hay ciudad provista, aceptar por calle
            return (prefCityNorm ? r.matchesCityExact : true) && (r.matchesStreet || !streetName);
          });
          const noCpCount = rows.filter(r => !(r.cpDigits && r.cpDigits.length === 4)).length;
          console.log('[Geocode] filtered count:', filtered.length, 'rows without CP:', noCpCount);

          if (filtered.length === 0) {
            // Intento B: reintentar geocodificación incluyendo explícitamente el CP en el query
            if (cpNum) {
              try {
                const params2 = new URLSearchParams(params);
                const withCp = `${searchQ || q}, ${cpNum}`.replace(/\s+,/g, ',').replace(/,+/g, ',').replace(/^,|,$/g, '').trim();
                const url2 = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(withCp)}.json?${params2.toString()}`;
                console.log('[Geocode] Retrying with CP in query:', url2);
                const resp2 = await fetch(url2);
                if (resp2.ok) {
                  const data2 = await resp2.json();
                  console.log('[Geocode] features (retry):', Array.isArray(data2?.features) ? data2.features.length : 0);
                  if (data2?.features && Array.isArray(data2.features) && data2.features.length > 0) {
                    const features2 = data2.features as GeoFeature[];
                    const rows2 = features2.map((f) => {
                      const fullName = f.place_name || f.text || '';
                      const name2 = norm(fullName);
                      const featureText2 = norm(f.text || '');
                      const ctx2 = (f.context || []).reduce(
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
                      const ctxPostcodeNum2 = ctx2.postcode.toLowerCase().replace(/^m/, '');
                      const ctxCpDigits2 = (ctxPostcodeNum2.match(/\d{4}/) || [""])[0];
                      const matchesCpExact2 = cpNum ? (ctxCpDigits2 === cpNum) : true;
                      const matchesCityExact2 = prefCityNorm
                        ? (
                            (ctx2.place && (ctx2.place.includes(prefCityNorm) || prefCityNorm.includes(ctx2.place))) ||
                            (ctx2.locality && (ctx2.locality.includes(prefCityNorm) || prefCityNorm.includes(ctx2.locality))) ||
                            (ctx2.district && (ctx2.district.includes(prefCityNorm) || prefCityNorm.includes(ctx2.district)))
                          )
                        : true;
                      const matchesStreet2 = streetName ? featureText2.includes(streetName) : true;
                      const matchesNumber2 = streetNumber ? name2.includes(streetNumber) : true;
                      return {
                        raw: f,
                        name: fullName,
                        featureText: featureText2,
                        ...ctx2,
                        matchesCpExact: matchesCpExact2,
                        matchesCityExact: matchesCityExact2,
                        matchesStreet: matchesStreet2,
                        matchesNumber: matchesNumber2,
                        cpDigits: ctxCpDigits2,
                      };
                    });
                    const filtered2 = rows2.filter(r => r.matchesCpExact);
                    console.log('[Geocode] filtered (retry) count:', filtered2.length);
                    if (filtered2.length > 0) {
                      let best2 = filtered2[0];
                      if (streetNumber && filtered2.length > 1) {
                        const withNumber2 = filtered2.find(r => r.matchesNumber);
                        if (withNumber2) best2 = withNumber2;
                      }
                      const [lng2, lat2] = best2.raw.center;
                      // Selección automática porque ya cumple CP exacto
                      setGeocodeFailed(false);
                      setFailedAddress('');
                      if (map.current) {
                        map.current.flyTo({ center: [lng2, lat2], zoom: 17 });
                        if (marker.current) {
                          marker.current.setLngLat([lng2, lat2]);
                        } else {
                          marker.current = new mapboxgl.Marker({ draggable: true })
                            .setLngLat([lng2, lat2])
                            .addTo(map.current);
                          marker.current.on('dragend', () => {
                            const pos = marker.current!.getLngLat();
                            userHasManuallyPlaced.current = true;
                            onLocationSelect({ lng: pos.lng, lat: pos.lat });
                          });
                        }
                        onLocationSelect({ lng: lng2, lat: lat2 });
                      }
                      return; // Listo tras el reintento
                    }
                  }
                }
              } catch (e) {
                console.warn('[Geocode] Retry with CP failed:', e);
              }
            }

            // Opción A: centrar en el mejor candidato por ciudad/calle SIN colocar marcador
            const best = rows.find(r => r.matchesCityExact && r.matchesStreet) 
                      || rows.find(r => r.matchesCityExact) 
                      || rows.find(r => r.matchesStreet) 
                      || (features[0] ? { raw: features[0] } as any : null);
            if (best && map.current) {
              const [lngB, latB] = (best.raw as any).center;
              map.current.flyTo({ center: [lngB, latB], zoom: 14 });
            }
            // No auto-seleccionar ubicación; el usuario puede validar con Google Maps o clickear el mapa
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
  const query = (address && address.trim().length > 0)
    ? address.trim()
    : (failedAddress || '').trim();
  const encodedAddress = encodeURIComponent(query);
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

    {/* Sección siempre visible para verificar en Google Maps y cargar coordenadas manuales */}
    <div className="mt-3 p-3 border rounded-md bg-gray-50">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="text-sm text-gray-700">
          También puedes verificar la dirección en Google Maps o ingresar las coordenadas manualmente.
        </p>
        <button
          onClick={handleOpenGoogleMaps}
          className="inline-flex items-center gap-2 px-3 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors"
        >
          <ExternalLink className="w-4 h-4" />
          Abrir en Google Maps
        </button>
      </div>
      <div className="mt-2 flex gap-2">
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
);
}