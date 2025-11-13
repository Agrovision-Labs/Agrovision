import geopandas as gpd
from shapely.geometry import Polygon

print("Reading StateBoundary.json...")
# Step 1: Read the state boundaries file
states_gdf = gpd.read_file("StateBoundary.json")

# Step 2: Filter invalid geometries
states_gdf = states_gdf[states_gdf.is_valid]

# Step 3: Create world polygon
world_polygon = Polygon([
    (-180, -90),
    (-180, 90),
    (180, 90),
    (180, -90),
    (-180, -90)
])

# ✅ Correct GeoDataFrame creation — note dict for data, not list
world_gdf = gpd.GeoDataFrame(
    {"id": ["world"]},  # must be a dict with string or serializable value
    geometry=[world_polygon],
    crs=states_gdf.crs or "EPSG:4326"
)

# Step 4: Ensure CRS match
if world_gdf.crs != states_gdf.crs:
    print(f"Reprojecting states from {states_gdf.crs} to {world_gdf.crs}...")
    states_gdf = states_gdf.to_crs(world_gdf.crs)

# Step 5: Create mask
print("Creating mask (this may take a moment)...")
mask_gdf = gpd.overlay(world_gdf, states_gdf, how="difference")

# Step 6: Save output
output_file = "StateMask.geojson"
mask_gdf.to_file(output_file, driver="GeoJSON")

print(f"✅ Successfully created {output_file}!")
