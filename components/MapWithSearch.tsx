"use client";

import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";

mapboxgl.accessToken =
  process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN ?? "";

if (!mapboxgl.accessToken) {
  console.warn("Mapbox access token is missing! Vérifie ton .env.local");
}

type Suggestion = {
  id: string;
  place_name: string;
  center: [number, number];
};

export default function MapWithSearch() {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);

  const searchMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const userMarkerRef = useRef<mapboxgl.Marker | null>(null);

  const [query, setQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [isFocused, setIsFocused] = useState(false);
  const [isLocating, setIsLocating] = useState(false);

  // Initialisation de la carte
  useEffect(() => {
    if (mapRef.current || !mapContainerRef.current) return;

    mapRef.current = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center: [4.3601, 43.8367], // Nîmes
      zoom: 12,
    });

    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  // 🔎 Autocomplete : suggestions pendant la saisie
  useEffect(() => {
    if (!mapboxgl.accessToken) return;

    if (!query.trim() || query.trim().length < 3) {
      setSuggestions([]);
      return;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(async () => {
      try {
        const encodedQuery = encodeURIComponent(query.trim());
        const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodedQuery}.json?access_token=${mapboxgl.accessToken}&autocomplete=true&limit=5&language=fr`;

        const res = await fetch(url, { signal: controller.signal });
        const data = await res.json();

        if (!data.features) {
          setSuggestions([]);
          return;
        }

        const mapped: Suggestion[] = data.features.map((f: any) => ({
          id: f.id,
          place_name: f.place_name as string,
          center: f.center as [number, number],
        }));

        setSuggestions(mapped);
      } catch (err) {
        if ((err as any).name === "AbortError") return;
        console.error("Erreur suggestions géocodage:", err);
      }
    }, 250);

    return () => {
      controller.abort();
      clearTimeout(timeoutId);
    };
  }, [query]);

  const flyToLocation = (lng: number, lat: number) => {
    if (!mapRef.current) return;

    mapRef.current.flyTo({
      center: [lng, lat],
      zoom: 17.5,
      speed: 1.1,
      curve: 1.4,
      bearing: 0,
      pitch: 0, // on remet à plat pour que tu voies bien le marker
      essential: true,
    });
  };

  const setSearchMarker = (lng: number, lat: number) => {
    if (!mapRef.current) return;

    if (searchMarkerRef.current) {
      searchMarkerRef.current.setLngLat([lng, lat]);
    } else {
      searchMarkerRef.current = new mapboxgl.Marker({
        color: "#0ea5e9", // bleu vif pour les résultats de recherche
      })
        .setLngLat([lng, lat])
        .addTo(mapRef.current);
    }
  };

  const setUserMarker = (lng: number, lat: number) => {
    if (!mapRef.current) return;

    if (userMarkerRef.current) {
      userMarkerRef.current.setLngLat([lng, lat]);
    } else {
      userMarkerRef.current = new mapboxgl.Marker({
        color: "#22c55e", // vert pour "moi"
      })
        .setLngLat([lng, lat])
        .addTo(mapRef.current);
    }
  };

  const handleSearchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim() || !mapboxgl.accessToken) return;

    // Si on a des suggestions, on prend la première
    if (suggestions.length > 0) {
      const first = suggestions[0];
      const [lng, lat] = first.center;
      flyToLocation(lng, lat);
      setSearchMarker(lng, lat);
      setQuery(first.place_name);
      setSuggestions([]);
      return;
    }

    try {
      setIsSearching(true);

      const encodedQuery = encodeURIComponent(query.trim());
      const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodedQuery}.json?access_token=${mapboxgl.accessToken}&limit=1&language=fr`;

      const res = await fetch(url);
      const data = await res.json();

      if (!data.features || data.features.length === 0) {
        alert("Aucune adresse trouvée pour cette recherche.");
        return;
      }

      const feature = data.features[0];
      const [lng, lat] = feature.center as [number, number];

      flyToLocation(lng, lat);
      setSearchMarker(lng, lat);
    } catch (error) {
      console.error("Erreur de géocodage Mapbox:", error);
      alert("Erreur lors de la recherche de l'adresse.");
    } finally {
      setIsSearching(false);
    }
  };

  const handleSuggestionClick = (s: Suggestion) => {
    const [lng, lat] = s.center;
    flyToLocation(lng, lat);
    setSearchMarker(lng, lat);
    setQuery(s.place_name);
    setSuggestions([]);
  };

  const handleZoomIn = () => {
    if (!mapRef.current) return;
    mapRef.current.zoomIn();
  };

  const handleZoomOut = () => {
    if (!mapRef.current) return;
    mapRef.current.zoomOut();
  };

  const handleLocateMe = () => {
    if (!navigator.geolocation) {
      alert("La géolocalisation n'est pas supportée par ton navigateur.");
      return;
    }

    if (!mapRef.current) return;

    setIsLocating(true);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { longitude, latitude } = pos.coords;
        flyToLocation(longitude, latitude);
        setUserMarker(longitude, latitude);
        setIsLocating(false);
      },
      (err) => {
        console.error("Erreur géoloc:", err);
        alert("Impossible de récupérer ta position.");
        setIsLocating(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
      }
    );
  };

  return (
    <div className="flex flex-col h-screen">
      {/* Barre de recherche */}
      <header className="z-20 w-full bg-white/90 border-b border-slate-200 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto flex items-center gap-3 px-4 py-3">
          <div className="font-semibold text-slate-800 text-lg">
            Mobilit
          </div>

          {/* Conteneur relative pour la dropdown */}
          <div className="flex-1 relative">
            <form
              onSubmit={handleSearchSubmit}
              className="flex items-center gap-2"
            >
              <input
                type="text"
                placeholder="Saisis une adresse, un arrêt, un lieu..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onFocus={() => setIsFocused(true)}
                onBlur={() => {
                  setTimeout(() => setIsFocused(false), 250);
                }}
                className="w-full rounded-full border border-slate-300 px-4 py-2 text-sm 
                           focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500
                           text-slate-900 placeholder:text-slate-400 bg-white"
              />
              <button
                type="submit"
                disabled={isSearching}
                className="rounded-full px-4 py-2 text-sm font-medium bg-sky-600 text-white hover:bg-sky-700 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isSearching ? "Recherche..." : "OK"}
              </button>
            </form>

            {/* Dropdown suggestions */}
            {isFocused && suggestions.length > 0 && (
              <div className="absolute left-0 right-0 mt-1 rounded-xl border border-slate-200 bg-white shadow-lg max-h-64 overflow-auto z-30">
                {suggestions.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => handleSuggestionClick(s)}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-slate-100 text-slate-900"
                  >
                    {s.place_name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Carte + contrôles flottants */}
      <div className="flex-1 relative">
        <div ref={mapContainerRef} className="w-full h-full" />

        {/* Boutons zoom + / - */}
        <div className="absolute right-3 bottom-3 flex flex-col gap-2 z-30">
          <button
            type="button"
            onClick={handleZoomIn}
            className="w-10 h-10 rounded-full bg-white shadow-md border border-slate-200 flex items-center justify-center text-xl leading-none hover:bg-slate-50"
          >
            +
          </button>
          <button
            type="button"
            onClick={handleZoomOut}
            className="w-10 h-10 rounded-full bg-white shadow-md border border-slate-200 flex items-center justify-center text-xl leading-none hover:bg-slate-50"
          >
            −
          </button>
        </div>

        {/* Bouton géolocalisation */}
        <button
          type="button"
          onClick={handleLocateMe}
          disabled={isLocating}
          className="absolute left-3 bottom-3 z-30 w-11 h-11 rounded-full bg-slate-900/90 text-white shadow-md border border-slate-700 flex items-center justify-center hover:bg-slate-800 disabled:opacity-60"
          title="Me localiser"
        >
          {/* Icône cible type crosshair */}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="w-5 h-5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="12" cy="12" r="3" />
            <path d="M12 2v3" />
            <path d="M12 19v3" />
            <path d="M2 12h3" />
            <path d="M19 12h3" />
          </svg>
        </button>
      </div>
    </div>
  );
}
