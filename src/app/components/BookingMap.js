"use client";

import { useState, useRef, useCallback, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// แก้ปัญหา default icon ของ Leaflet ที่อาจไม่แสดงผลใน Next.js
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Component หมุดกลางจอ (เป็น UI overlay)
function CenterMarker() {
  return (
    <div style={{
      position: 'absolute', top: '50%', left: '50%',
      transform: 'translate(-50%, -100%)',
      width: '25px', height: '41px',
      backgroundImage: `url('https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png')`,
      backgroundSize: 'contain',
      pointerEvents: 'none',
      zIndex: 1000,
    }} />
  );
}

// Component สำหรับจัดการ Event และควบคุม Map จากภายใน
function MapController({ center, onLocationSelect }) {
  const map = useMap();
  const reverseGeocodeTimer = useRef(null);

  // สั่งให้แผนที่เคลื่อนที่ตาม state `center`
  useEffect(() => {
    map.setView(center, 16);
  }, [center, map]);

  // จัดการ event เมื่อผู้ใช้เลื่อนแผนที่เสร็จ
  useMapEvents({
    moveend: () => {
      clearTimeout(reverseGeocodeTimer.current);
      reverseGeocodeTimer.current = setTimeout(() => {
        const newCenter = map.getCenter();
        if (onLocationSelect) {
          onLocationSelect({ lat: newCenter.lat, lng: newCenter.lng });
        }
      }, 500); // หน่วงเวลาเล็กน้อยเพื่อไม่ให้ยิง API ถี่เกินไป
    },
  });

  return null;
}

// Component หลัก

export default function BookingMap({ onLocationSelect }) {
  const initialCenter = [13.7563, 100.5018]; // BKK
  const [mapCenter, setMapCenter] = useState(initialCenter);
  const [markerPosition, setMarkerPosition] = useState(initialCenter);
  const [address, setAddress] = useState("เลื่อนแผนที่เพื่อกำหนดจุดหมายปลายทาง");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);

  // ฟังก์ชันสำหรับค้นหาที่อยู่จากพิกัด (Reverse Geocoding)
  const handleLocationSelect = useCallback(async (locationData) => {
    const { lat, lng } = locationData;
    setMarkerPosition([lat, lng]); // อัปเดตตำแหน่งหมุดจริง

    const apiUrl = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`;
    try {
      const response = await fetch(apiUrl);
      const data = await response.json();
      const newAddress = data.display_name || "ไม่พบข้อมูลที่อยู่";
      setAddress(newAddress);
      // ส่งข้อมูลทั้งหมด (รวมที่อยู่) กลับไปให้ Parent component
      if (onLocationSelect) {
        onLocationSelect({ lat, lng, address: newAddress });
      }
    } catch (error) {
      console.error("Reverse geocode error:", error);
      setAddress("เกิดข้อผิดพลาดในการค้นหาที่อยู่");
    }
  }, [onLocationSelect]);

  // ฟังก์ชันค้นหาสถานที่
  const handleSearch = async (e) => {
    e.preventDefault();
    if (searchQuery.length < 3) return;
    const apiUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(searchQuery)}&format=json&countrycodes=th&limit=5`;
    const response = await fetch(apiUrl);
    const data = await response.json();
    setSearchResults(data);
  };

  // ฟังก์ชันเมื่อเลือกผลการค้นหา
  const selectSearchResult = (place) => {
    const lat = parseFloat(place.lat);
    const lon = parseFloat(place.lon);
    setMapCenter([lat, lon]); // สั่งให้แผนที่เลื่อนไป
    handleLocationSelect({ lat, lng: lon }); // อัปเดตหมุดและที่อยู่
    setSearchResults([]);
    setSearchQuery(place.display_name);
  };

  return (
    <div className="space-y-4">
      {/* Search UI */}
      <form onSubmit={handleSearch} className="flex space-x-2">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="ค้นหาสถานที่..."
          className="w-full px-3 py-2 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-slate-500"
        />
        <button type="submit" className="px-4 py-2 bg-primary text-white rounded-full hover:bg-slate-700">
          ค้นหา
        </button>
      </form>

      {/* Search Results */}
      {searchResults.length > 0 && (
        <div className="border rounded-lg max-h-40 overflow-y-auto bg-white">
          {searchResults.map(place => (
            <div
              key={place.place_id}
              onClick={() => selectSearchResult(place)}
              className="p-2 border-b cursor-pointer hover:bg-gray-100 text-sm"
            >
              {place.display_name}
            </div>
          ))}
        </div>
      )}

      {/* Map Container */}
      <div style={{ position: 'relative' }}>
        <MapContainer center={mapCenter}  zoom={13} style={{ height: '300px', width: '100%', borderRadius: '0.5rem' }}
        >
          <TileLayer attribution='&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          <MapController center={mapCenter} onLocationSelect={handleLocationSelect} />
          <Marker position={markerPosition}>
            <Popup>ตำแหน่งที่เลือก</Popup>
          </Marker>
        </MapContainer>
        <CenterMarker />
      </div>

      {/* Address Display */}
      <div className="p-3 bg-slate-100 rounded-lg text-sm text-center text-gray-800">
        {address}
      </div>
    </div>
  );
}