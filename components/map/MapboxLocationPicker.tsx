'use client';

import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

// Configura el token de acceso de Mapbox
mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || '';
console.log('Mapbox token:', process.env.NEXT_PUBLIC_MAPBOX_TOKEN ? 'Token exists' : 'Token is missing');

interface MapboxLocationPickerProps {
  initialLocation?: { lng: number; lat: number } | null;
  onLocationSelect: (location: { lng: number; lat: number } | null) => void;
  address?: string;
  geocodeVersion?: number; // optional trigger counter
}

export function MapboxLocationPicker({ 
  initialLocation = { lng: -64.1888, lat: -31.4201 },
  onLocationSelect,
  address = '',
  geocodeVersion,
}: MapboxLocationPickerProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const marker = useRef<mapboxgl.Marker | null>(null);
  const [loading, setLoading] = useState(true);
  const lastGeocodeVersion = useRef<number | null>(null);

  // Efecto para inicializar el mapa
  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    console.log('Initializing map...');
    console.log('Container dimensions:', {
      width: mapContainer.current.offsetWidth,
      height: mapContainer.current.offsetHeight
    });

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
        center: [initialLocation?.lng || -64.1888, initialLocation?.lat || -31.4201],
        zoom: 12
      });

      console.log('Map instance created:', !!map.current);

      // Agregar controles de navegación
      map.current.addControl(new mapboxgl.NavigationControl());
      console.log('Navigation control added');

      // Manejador de clics en el mapa
      const handleMapClick = (e: any) => {
        console.log('Map clicked:', e.lngLat);
        const { lng, lat } = e.lngLat;
        onLocationSelect({ lng, lat });
        
        if (marker.current) {
          marker.current.setLngLat([lng, lat]);
        } else if (map.current) {
          marker.current = new mapboxgl.Marker({ draggable: true })
            .setLngLat([lng, lat])
            .addTo(map.current);
          marker.current.on('dragend', () => {
            const pos = marker.current!.getLngLat();
            onLocationSelect({ lng: pos.lng, lat: pos.lat });
          });
        }
      };

      map.current.on('click', handleMapClick);

      // Manejar errores de carga del mapa
      map.current.on('load', () => {
        console.log('Map loaded successfully');
        setLoading(false);
      });

      map.current.on('error', (e: any) => {
        console.error('Map error:', e.error);
        setLoading(false);
      });

      // Limpieza
      return () => {
        if (map.current) {
          console.log('Cleaning up map...');
          map.current.off('click', handleMapClick);
          if (marker.current) {
            marker.current.remove();
            marker.current = null;
          }
          map.current.remove();
          map.current = null;
        }
      };
    } catch (error) {
      console.error('Error initializing map:', error);
      setLoading(false);
    }
  }, [initialLocation, onLocationSelect]);

  // Efecto para actualizar el mapa cuando cambia la dirección
  useEffect(() => {
    if (!map.current) return;

    // If a version trigger is provided, only geocode on version change
    if (typeof geocodeVersion === 'number') {
      if (geocodeVersion === lastGeocodeVersion.current) return;
      lastGeocodeVersion.current = geocodeVersion;
    }

    const trimmed = (address || '').trim();
    if (!trimmed || trimmed.length < 5) return;

    const geocodeAddress = async () => {
      try {
        const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(trimmed)}.json?country=ar&language=es&autocomplete=true&access_token=${mapboxgl.accessToken}`;
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.features?.length > 0) {
          const [lng, lat] = data.features[0].center;
          
          if (map.current) {
            map.current.flyTo({ 
              center: [lng, lat], 
              zoom: 15 
            });

            if (marker.current) {
              marker.current.setLngLat([lng, lat]);
            } else if (map.current) {
              marker.current = new mapboxgl.Marker({ draggable: true })
                .setLngLat([lng, lat])
                .addTo(map.current);
              marker.current.on('dragend', () => {
                const pos = marker.current!.getLngLat();
                onLocationSelect({ lng: pos.lng, lat: pos.lat });
              });
            }

            onLocationSelect({ lng, lat });
          }
        }
      } catch (error) {
        console.error('Error geocoding address:', error);
      }
    };

    const timeoutId = setTimeout(geocodeAddress, 1000);
    return () => clearTimeout(timeoutId);
  }, [address, onLocationSelect, geocodeVersion]);

  // Efecto para la ubicación inicial
  useEffect(() => {
    if (initialLocation && map.current) {
      map.current.flyTo({
        center: [initialLocation.lng, initialLocation.lat],
        zoom: 15
      });
      
      if (marker.current) {
        marker.current.setLngLat([initialLocation.lng, initialLocation.lat]);
      } else if (map.current) {
        marker.current = new mapboxgl.Marker({ draggable: true })
          .setLngLat([initialLocation.lng, initialLocation.lat])
          .addTo(map.current);
        marker.current.on('dragend', () => {
          const pos = marker.current!.getLngLat();
          onLocationSelect({ lng: pos.lng, lat: pos.lat });
        });
      }
    }
  }, [initialLocation]);

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
        Haz clic en el mapa para marcar la ubicación exacta
      </p>
    </div>
  );
}