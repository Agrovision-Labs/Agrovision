import { useState, useEffect, useRef } from 'react';
import './MapPage.css';

// --- Map Imports ---
import { 
  MapContainer, TileLayer, Marker, Popup, useMapEvents, 
  GeoJSON, useMap, ZoomControl, LayersControl
} from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// --- Download Import ---
import html2canvas from 'html2canvas';

// --- Search Imports ---
import { GeoSearchControl, OpenStreetMapProvider } from 'leaflet-geosearch'; 
import 'leaflet-geosearch/dist/geosearch.css';

// --- Turf.js Imports ---
import booleanPointInPolygon from '@turf/boolean-point-in-polygon';
import { point as turfPoint } from '@turf/helpers';

// --- Chart Imports ---
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement,
  LineElement, Title, Tooltip, Legend, Filler
} from 'chart.js';

ChartJS.register(
  CategoryScale, LinearScale, PointElement, LineElement,
  Title, Tooltip, Legend, Filler
);

// --- MUI Imports ---
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Skeleton from '@mui/material/Skeleton';
import LinearProgress from '@mui/material/LinearProgress';
import DownloadIcon from '@mui/icons-material/Download';
import Paper from '@mui/material/Paper';
import TextField from '@mui/material/TextField';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import Divider from '@mui/material/Divider';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import Select from '@mui/material/Select';
import FormHelperText from '@mui/material/FormHelperText';
import { Backdrop } from '@mui/material'; 

// --- Fix for missing Leaflet marker icons ---
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';
let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

// --- Config ---
const API_ENDPOINT = 'http://127.0.0.1:5000/predict_live';
const INITIAL_CENTER = [17.8739, 79.2583];
const INITIAL_ZOOM = 7;
const MAP_BOUNDS = [
  [12.63, 76.78], // Southwest corner
  [19.96, 84.69]  // Northeast corner
];

// --- React Components ---

function MapClickHandler({ onLocationSelect }) {
  const map = useMap(); 
  const mapEvents = useMapEvents({
    click(e) {
      if (map.getBounds().contains(e.latlng)) {
        const { lat, lng } = e.latlng;
        onLocationSelect({ lat, lon: lng }); // Pass coordinates up
      }
    },
  });
  return null;
}

// Main trigger function (for both click and search)
function triggerAnalysis(map, lat, lng, setClickedPoint, setUiState, setApiResult, year) {
  map.flyTo([lat, lng], 12);
  setClickedPoint([lat, lng]);
  setUiState('loading');
  setApiResult(null);
  fetchPrediction(lat, lng, setApiResult, setUiState, year);
}

// UPDATED to send the 'year' in the API call
async function fetchPrediction(lat, lon, setApiResult, setUiState, year) {
  try {
    const response = await fetch(API_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        lat: lat, 
        lon: lon,
        year: year // e.g., "2020-2021"
      }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Server error.");
    setApiResult(data);
    setUiState('result');
  } catch (error) {
    console.error('Fetch error:', error);
    setApiResult({ error: error.message });
    setUiState('error');
  }
}

// --- Search Hub Component (Now includes location/coord search) ---
function SearchHub({ mapRef, onLocationSelect, geoJsonData, isDisabled }) {
  return (
    <Paper 
      elevation={4}
      className="search-hub-container"
      sx={{ 
        opacity: isDisabled ? 0.5 : 1,
        backgroundColor: 'rgba(255, 255, 255, 0.7)',
        backdropFilter: 'blur(10px)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
      }}
    >
      <LocationSearch 
        mapRef={mapRef} 
        geoJsonData={geoJsonData}
        isDisabled={isDisabled}
        onLocationSelect={onLocationSelect} // Pass function
      />
      <Divider />
      <CoordSearch 
        mapRef={mapRef} 
        geoJsonData={geoJsonData}
        isDisabled={isDisabled}
        onLocationSelect={onLocationSelect} // Pass function
      />
    </Paper>
  );
}

// --- Location Search (by name) ---
function LocationSearch({ mapRef, geoJsonData, isDisabled, onLocationSelect }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [provider] = useState(() => new OpenStreetMapProvider());

  // --- NEW: Debounce logic ---
  const debounceTimeout = useRef(null);
  const handleSearch = (e) => {
    const newQuery = e.target.value;
    setQuery(newQuery);

    // Clear the old timeout
    if (debounceTimeout.current) {
      clearTimeout(debounceTimeout.current);
    }
    
    if (newQuery.length > 3) {
      // Set a new timeout
      debounceTimeout.current = setTimeout(async () => {
        const searchResults = await provider.search({ query: newQuery });
        setResults(searchResults.slice(0, 5));
      }, 300); // 300ms delay
    } else {
      setResults([]);
    }
  };

  const onResultClick = (result) => {
    const { y: lat, x: lon } = result;
    setQuery(result.label);
    setResults([]);
    
    if (!geoJsonData) {
      alert("Boundary data is still loading. Please try again in a moment.");
      return;
    }
    
    const pt = turfPoint([lon, lat]);
    const checkPoint = booleanPointInPolygon.default || booleanPointInPolygon;
    const isInside = geoJsonData.features.some(feature => checkPoint(pt, feature.geometry));

    if (isInside) {
      if (mapRef.current) {
        // --- UPDATED FLOW ---
        mapRef.current.flyTo([lat, lon], 12); // Just fly
        // We *don't* trigger analysis here, user must click
        // To trigger the modal, uncomment the line below:
        // onLocationSelect({ lat, lon });
        // --- END OF UPDATE ---
      }
    } else {
      alert("This location is outside the analysis area of Telangana and Andhra Pradesh.");
    }
  };

  return (
    <Box className="search-section">
      <Typography variant="h6" component="h4" sx={{ mb: 1.5, fontWeight: 600 }}>
        Search by Location
      </Typography>
      <TextField
        label="e.g., Warangal, Hyderabad..."
        variant="outlined"
        size="small"
        className="location-search-input"
        value={query}
        onChange={handleSearch}
        disabled={isDisabled}
      />
      {results.length > 0 && (
        <Paper elevation={3} sx={{ mt: 1 }}>
          <List dense className="search-results">
            {results.map((result, index) => (
              <ListItem key={index} disablePadding>
                <ListItemButton className="search-results-item" onClick={() => onResultClick(result)}>
                  <ListItemText primary={result.label} />
                </ListItemButton>
              </ListItem>
            ))}
          </List>
        </Paper>
      )}
    </Box>
  );
}

// --- Coordinate Search ---
function CoordSearch({ mapRef, geoJsonData, isDisabled, onLocationSelect }) {
  const [latInput, setLatInput] = useState('');
  const [lonInput, setLonInput] = useState('');

  const handleSearch = () => {
    const lat = parseFloat(latInput);
    const lon = parseFloat(lonInput);
    if (isNaN(lat) || isNaN(lon)) {
      alert("Please enter valid latitude and longitude numbers.");
      return;
    }

    if (!geoJsonData) {
      alert("Boundary data is still loading. Please try again in a moment.");
      return;
    }
    
    const pt = turfPoint([lon, lat]);
    const checkPoint = booleanPointInPolygon.default || booleanPointInPolygon;
    const isInside = geoJsonData.features.some(feature => checkPoint(pt, feature.geometry));

    if (isInside) {
      if (mapRef.current) {
        // --- UPDATED FLOW ---
        // This is a specific search, so we DO open the modal
        onLocationSelect({ lat, lon }); // Pass coords up to open modal
        // --- END OF UPDATE ---
      }
    } else {
      alert("This location is outside the analysis area of Telangana and Andhra Pradesh.");
    }
  };

  return (
    <Box className="search-section">
      <Typography variant="h6" component="h4" sx={{ mb: 1.5, fontWeight: 600 }}>
        Search by Coordinates
      </Typography>
      <Box className="coord-search-inputs">
        <TextField 
          label="Latitude" 
          variant="outlined" 
          size="small" 
          value={latInput} 
          onChange={(e) => setLatInput(e.target.value)} 
          disabled={isDisabled} 
        />
        <TextField 
          label="Longitude" 
          variant="outlined" 
          size="small" 
          value={lonInput} 
          onChange={(e) => setLonInput(e.target.value)} 
          disabled={isDisabled} 
        />
        <Button variant="contained" onClick={handleSearch} disabled={isDisabled}>Go</Button>
      </Box>
    </Box>
  );
}

// --- Invisible Search Component ---
function MapSearchComponent({ onLocationSelect, geoJsonData }) {
  const map = useMap(); 
  useEffect(() => {
    const provider = new OpenStreetMapProvider();
    const searchControl = new GeoSearchControl({
      provider: provider, style: 'bar', showMarker: false, autoClose: true,
      resultFormat: ({ result }) => result.label, popupFormat: ({ result }) => result.label,
    });

    const onSearchResult = (e) => {
      const lat = e.location.y;
      const lon = e.location.x;
      
      if (!geoJsonData) {
        alert("Boundary data is still loading. Please try again in a moment.");
        return;
      }
      
      const pt = turfPoint([lon, lat]);
      const checkPoint = booleanPointInPolygon.default || booleanPointInPolygon;
      const isInside = geoJsonData.features.some(feature => checkPoint(pt, feature.geometry));

      if (isInside) {
        // --- UPDTED FLOW ---
        map.flyTo([lat, lon], 12); // Just fly
        // We don't open the modal here, user can click
        // onLocationSelect({ lat, lon });
        // --- END OF UPDATE ---
      } else {
        alert("This location is outside the analysis area.");
      }
    };
    
    map.on('geosearch/showlocation', onSearchResult);
    return () => {
      map.off('geosearch/showlocation', onSearchResult);
    };
  }, [map, onLocationSelect, geoJsonData]);
  return null; 
}


// --- Boundary Controller (Loads and displays both boundary and mask) ---
function BoundaryController({ geoJsonData, maskData }) {
  const map = useMap();
  
  useEffect(() => {
    if (geoJsonData) {
      const geoJsonLayer = L.geoJSON(geoJsonData);
      const bounds = geoJsonLayer.getBounds();

      if (bounds.isValid()) {
        // --- THIS IS THE "SNAP" FIX ---
        // We fit the bounds once, then set the minZoom and maxBounds
        map.fitBounds(bounds);
        const zoom = map.getZoom();
        map.setMinZoom(zoom);
        map.setMaxBounds(bounds.pad(0.2));
        // --- END OF "SNAP" FIX ---
      }
    }
  }, [geoJsonData, map]); 

  return (
    <>
      {/* Layer 1: The outline (Using your styles) */}
      {geoJsonData && (
        <GeoJSON 
          data={geoJsonData} 
          style={{
            color: "#04041aff", 
            weight: 0.7, 
            opacity: 0.9, 
            fillOpacity: 0.05,
            interactive: false 
          }} 
        />
      )}
      {/* Layer 2: The MASK (Using your styles) */}
      {maskData && (
        <GeoJSON 
          data={maskData} 
          style={{
            color: "#f9f9f9",
            weight: 0.2,
            fillOpacity: 0.7, // Semi-transparent "fog"
          }}
          eventHandlers={{
            click: (e) => {
              L.DomEvent.stopPropagation(e);
            }
          }}
        />
      )}
    </>
  );
}
// --- END OF BOUNDARY COMPONENT ---


// --- NEW: Year Selection Modal Component ---
function YearSelectModal({ open, onClose, location, onAnalyze }) {
  const [selectedYear, setSelectedYear] = useState("2020-2021"); // Default to base year

  const handleAnalyzeClick = () => {
    onAnalyze(selectedYear); // Pass the selected year back
    onClose(); // Close the modal
  };

  return (
    <Dialog 
      open={open} 
      onClose={onClose}
      // This makes the smooth frosted glass animation
      BackdropComponent={Backdrop}
      BackdropProps={{
        timeout: 500,
        sx: {
          backgroundColor: 'rgba(0,0,0,0.1)',
          backdropFilter: 'blur(4px)',
        }
      }}
      PaperProps={{
        elevation: 0,
        sx: {
          backgroundColor: 'rgba(255, 255, 255, 0.85)',
          backdropFilter: 'blur(10px)',
          borderRadius: '12px'
        }
      }}
    >
      <DialogTitle sx={{fontWeight: 600}}>Select Analysis Year</DialogTitle>
      <DialogContent>
        <DialogContentText sx={{mb: 2, color: '#222'}}>
          Please select the agricultural season you wish to analyze for the location:
          <br/>
          <strong>{location?.lat.toFixed(4)}, {location?.lon.toFixed(4)}</strong>
        </DialogContentText>
        
        <FormControl fullWidth size="small" sx={{mt: 1}}>
          <InputLabel id="year-select-label">Analysis Year</InputLabel>
          <Select
            labelId="year-select-label"
            id="year-select"
            value={selectedYear}
            label="Analysis Year"
            onChange={(e) => setSelectedYear(e.target.value)}
          >
            {/* These are the years we confirmed have data */}
            <MenuItem value="2023-2024">2023 - 2024</MenuItem>
            <MenuItem value="2022-2023">2022 - 2023</MenuItem>
            <MenuItem value="2021-2022">2021 - 2022</MenuItem>
            <MenuItem value="2020-2021">2020 - 2021</MenuItem>
            <MenuItem value="2019-2020">2019 - 2020</MenuItem>
            <MenuItem value="2018-2019">2018 - 2019</MenuItem>
          </Select>
          <FormHelperText>Model will analyze data from June 1st to May 31st.</FormHelperText>
        </FormControl>
        
      </DialogContent>
      <DialogActions sx={{padding: '0 24px 20px 24px'}}>
        <Button onClick={onClose} sx={{color: '#555'}}>Cancel</Button>
        <Button onClick={handleAnalyzeClick} variant="contained">Analyze</Button>
      </DialogActions>
    </Dialog>
  );
}


// --- Main Map Page Component ---
function MapPage() {
  const [uiState, setUiState] = useState('initial'); 
  const [clickedPoint, setClickedPoint] = useState(null);
  const [apiResult, setApiResult] = useState(null);
  const mapRef = useRef(null);
  
  const [geoJsonData, setGeoJsonData] = useState(null);
  const [maskData, setMaskData] = useState(null);
  const [mapIsReady, setMapIsReady] = useState(false);

  // --- NEW: State for the modal ---
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [locationToAnalyze, setLocationToAnalyze] = useState(null);

  // 1. Load BOTH GeoJSON files
  useEffect(() => {
    Promise.all([
      fetch('/StateBoundary.json').then(res => {
        if (!res.ok) throw new Error("Could not find StateBoundary.json");
        return res.json();
      }),
      fetch('/StateMask.geojson').then(res => {
        if (!res.ok) throw new Error("Could not find StateMask.geojson");
        return res.json();
      })
    ])
    .then(([boundary, mask]) => {
      setGeoJsonData(boundary);
      setMaskData(mask);
      setMapIsReady(true);
    })
    .catch(error => console.error("Error loading GeoJSON files:", error));
  }, []); 
  
  
  const handleClosePanel = () => {
    setUiState('initial');
    setClickedPoint(null);
    setApiResult(null);
  };

  // --- NEW: Function to open the modal ---
  const handleLocationSelect = (location) => {
    setLocationToAnalyze(location); // Save the {lat, lon}
    setIsModalOpen(true);         // Open the modal
  };

  // --- NEW: Function called by the modal on "Analyze" ---
  const handleStartAnalysis = (selectedYear) => {
    if (locationToAnalyze && mapRef.current) {
      triggerAnalysis(
        mapRef.current, 
        locationToAnalyze.lat, 
        locationToAnalyze.lon, 
        setClickedPoint, 
        setUiState, 
        setApiResult, 
        selectedYear
      );
    }
    setLocationToAnalyze(null); // Clear the temp location
  };

  return (
    <div className="map-page-container">
      
      <div className="map-container">
        
        {/* --- THIS IS THE "SNAP" FIX --- */}
        {/* We only render the MapContainer *after* we have the files */}
        {!mapIsReady ? (
          <div className="initial-state" style={{paddingTop: '100px'}}>
            <div className="spinner"></div>
            <h3>Loading Map Data...</h3>
          </div>
        ) : (
          <MapContainer 
            center={INITIAL_CENTER} // Start centered
            zoom={INITIAL_ZOOM} // Start at the correct zoom
            ref={mapRef}
            zoomControl={false}
            // These are set by the BoundaryController
            // minZoom={INITIAL_ZOOM}
            // maxBounds={MAP_BOUNDS}
            maxBoundsViscosity={1.0}
          >
            <LayersControl position="topright">
              <LayersControl.BaseLayer checked name="Minimal Map">
                <TileLayer
                  attribution='&copy; <a href="http://cartodb.com/attributions">CartoDB</a>'
                  url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png"
                />
              </LayersControl.BaseLayer>
              <LayersControl.BaseLayer name="Satellite View">
                <TileLayer
                  attribution='&copy; <a href="https.www.esri.com/en-us/home">Esri</a>'
                  url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                />
              </LayersControl.BaseLayer>
            </LayersControl>
            
            <ZoomControl position="bottomright" />
            
            <MapSearchComponent
              onLocationSelect={handleLocationSelect}
              geoJsonData={geoJsonData}
            />

            {clickedPoint && (
              <Marker position={clickedPoint}>
                <Popup>Lat: {clickedPoint[0].toFixed(4)}, Lon: {clickedPoint[1].toFixed(4)}</Popup>
              </Marker>
            )}
            <MapClickHandler
              onLocationSelect={handleLocationSelect}
            />
            
            <BoundaryController geoJsonData={geoJsonData} maskData={maskData} />
            
          </MapContainer>
        )}
      </div>

      {mapIsReady && (
        <SearchHub 
          mapRef={mapRef}
          onLocationSelect={handleLocationSelect}
          geoJsonData={geoJsonData}
          isDisabled={!geoJsonData}
        />
      )}

      {/* --- The Year Select Modal --- */}
      <YearSelectModal
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        location={locationToAnalyze}
        onAnalyze={handleStartAnalysis}
      />

      <aside className={`results-panel ${uiState === 'loading' || uiState === 'result' || uiState === 'error' ? 'open' : ''}`}>
        <div className="panel-content">
          
          <button className="close-panel-btn" onClick={handleClosePanel}>×</button>

          {uiState === 'loading' && (
            <div className="loading-state visible">
              <Typography variant="h5" component="h2" gutterBottom>
                Analyzing Coordinates...
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                This process fetches and analyzes 12 months of live satellite data. Please wait (15-30 seconds).
              </Typography>
              <LinearProgress sx={{ mb: 2 }} />
              <LoadingSkeletons />
            </div>
          )}

          {uiState === 'initial' && (
            <div className="initial-state">
              <h3>Click or Search</h3>
              <p>Click any point on the map or use the search tools to analyze a location.</p>
            </div>
          )}
          
          <div className={`results-state ${uiState === 'result' ? 'visible' : ''}`}>
            {uiState === 'result' && apiResult && <ResultsDisplay data={apiResult} />}
          </div>
          
          {uiState === 'error' && (
            <div className="error-state">
              <h1>Error</h1>
              <p>{apiResult?.error || "An unknown error."}</p>
              <p>Please check the backend server, then try again.</p>
            </div>
          )}

        </div>
      </aside>
    </div>
  );
}

// --- Skeleton Loader Component ---
function LoadingSkeletons() {
  return (
    <Box className="skeleton-container">
      <Skeleton variant="rectangular" width="60%" height={36} sx={{borderRadius: '4px'}} />
      <Skeleton variant="text" width="40%" sx={{mb: 1}} />
      <Skeleton variant="rounded" width="100%" height={70} />
      <Skeleton variant="text" width="50%" height={30} sx={{mt: 2}} />
      <Skeleton variant="rounded" width="100%" height={200} />
    </Box>
  );
}

// --- ResultsDisplay Component (with Download + Label + Chart Toggle Fix) ---
function ResultsDisplay({ data }) {
  const reportRef = useRef(null); 
  const { prediction_label, confidence, coordinates, chart_data, subclass_metrics, report_details } = data;

  const [activeChartKey, setActiveChartKey] = useState('NDVI'); 
  
  useEffect(() => {
    if (prediction_label === "CROP") {
      setActiveChartKey('NDVI');
    } else if (prediction_label.includes("Water")) {
      setActiveChartKey('NDWI');
    } else { 
      setActiveChartKey('BSI');
    }
  }, [prediction_label]);

  // --- Label Fix ---
  let mainLabel = "NON-CROP";
  let subLabel = "";
  let labelClass = "OTHER"; 

  if (prediction_label === "CROP") {
    mainLabel = "CROP";
    labelClass = "CROP";
  } else if (prediction_label.includes("Water")) {
    subLabel = "(Identified as Water)";
    labelClass = "WATER";
  } else if (prediction_label.includes("Barren")) {
    subLabel = "(Identified as Barren Soil)";
    labelClass = "BARREN";
  } else {
    subLabel = "(Identified as Built-up/Other)";
    labelClass = "NON-CROP";
  }

  // --- Chart Config ---
  const chartLabels = chart_data.months.map(dateStr => {
    const date = new Date(dateStr + '-01'); 
    return date.toLocaleString('default', { month: 'short' });
  });

  const chartConfigs = {
    NDVI: {
      title: 'NDVI (Greenness) Cycle',
      data: chart_data.ndvi_values,
      color: 'rgba(40, 167, 69, 1)',
    },
    NDWI: {
      title: 'NDWI (Water) Index',
      data: chart_data.ndwi_values,
      color: 'rgba(0, 123, 255, 1)',
    },
    BSI: {
      title: 'BSI (Bare Soil) Index',
      data: chart_data.bsi_values,
      color: 'rgba(139, 69, 19, 1)',
    }
  };
  
  const activeChartConfig = chartConfigs[activeChartKey];
  
  const chartJSData = {
    labels: chartLabels,
    datasets: [{
      label: activeChartConfig.title,
      data: activeChartConfig.data,
      backgroundColor: activeChartConfig.color.replace('1)', '0.1)'),
      borderColor: activeChartConfig.color,
      borderWidth: 2,
      tension: 0.1,
      fill: true,
      spanGaps: true
    }]
  };
  
  const chartOptions = {
    plugins: { legend: { display: false } },
    scales: { 
      y: { min: -1.0, max: 1.0 },
      x: { 
        ticks: { display: true },
        grid: { display: false }
      }
    },
    responsive: true,
    maintainAspectRatio: false
  };

  // --- Download Handler ---
  const handleDownload = () => {
    if (reportRef.current) {
      html2canvas(reportRef.current, { 
        backgroundColor: '#ffffff',
        onclone: (document) => {
          const canvas = document.querySelector('canvas');
          if (canvas) {
            canvas.style.animation = 'none';
          }
        }
      }).then(canvas => {
        const link = document.createElement('a');
        link.download = `crop_report_${coordinates.lat.toFixed(4)}_${coordinates.lon.toFixed(4)}.jpg`;
        link.href = canvas.toDataURL('image/jpeg', 0.9);
        link.click();
      });
    }
  };

  return (
    <div className="prediction-report">
      <div className="report-content-wrapper" ref={reportRef}>
        
        <div className="prediction-header">
          <h1 className={labelClass}>{mainLabel}</h1>
          {subLabel && (
            <h3 className="sub-label">{subLabel}</h3>
          )}
          
          
          
          <div className="coords-box">
            <p><strong>Coords:</strong> {coordinates.lat.toFixed(5)}, {coordinates.lon.toFixed(5)}</p>
            <p><strong>Analysis Year:</strong> {report_details.model_version}</p>
            <p>
              <strong>NDWI Avg:</strong> {subclass_metrics.ndwi_mean ? subclass_metrics.ndwi_mean.toFixed(3) : 'N/A'} | 
              <strong> BSI Avg:</strong> {subclass_metrics.bsi_mean ? subclass_metrics.bsi_mean.toFixed(3) : 'N/A'}
            </p>
          </div>
        </div>

        <div className="chart-area">
          
          <div className="chart-toggle-buttons">
            <button 
              className={activeChartKey === 'NDVI' ? 'active' : ''}
              onClick={() => setActiveChartKey('NDVI')}
            >
              NDVI
            </button>
            <button 
              className={activeChartKey === 'NDWI' ? 'active' : ''}
              onClick={() => setActiveChartKey('NDWI')}
            >
              NDWI
            </button>
            <button 
              className={activeChartKey === 'BSI' ? 'active' : ''}
              onClick={() => setActiveChartKey('BSI')}
            >
              BSI
            </button>
          </div>

          <h4 className="chart-title">{activeChartConfig.title}</h4>
          <div className="chart-wrapper">
            <Line data={chartJSData} options={chartOptions} />
          </div>
        </div>
      </div>
      
      <Button 
        variant="contained" 
        color="success" 
        onClick={handleDownload}
        startIcon={<DownloadIcon />}
        className="download-button-mui"
        fullWidth
      >
        Download Report
      </Button>
    </div>
  );
}

export default MapPage;