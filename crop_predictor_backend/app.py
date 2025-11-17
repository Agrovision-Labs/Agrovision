import os
import joblib
import numpy as np
import pandas as pd
import tensorflow as tf
from tensorflow import keras
from flask import Flask, request, jsonify
import ee
import time
from flask_cors import CORS 

# --- NEW: Import Firebase Admin ---
import firebase_admin
from firebase_admin import credentials, firestore

# --- 1. GEE, Firebase, and App Initialization ---
try:
    ee.Initialize(project="agrovision-47e38")
    print("GEE Initialized.")
except Exception as e:
    print(f"GEE Initialization failed: {e}")

# --- NEW: Initialize Firestore ---
try:
    # We don't need a service account file if running in a Google Cloud env
    # For local testing, you might need:
    # cred = credentials.Certificate("path/to/serviceAccountKey.json")
    # firebase_admin.initialize_app(cred)
    firebase_admin.initialize_app()
    db = firestore.client()
    print("Firestore Initialized.")
except Exception as e:
    print(f"Firestore Initialization failed: {e}")
    db = None

app = Flask(__name__)
CORS(app) 

# --- 2. Load Model, Scaler, and Config ---
try:
    base_dir = os.path.dirname(os.path.abspath(__file__))
    MODEL_PATH = os.path.join(base_dir, 'models', 'crop_model_v2.1.keras')
    SCALER_PATH = os.path.join(base_dir, 'models', 'data_scaler_v2.1.pkl')
    
    model = keras.models.load_model(MODEL_PATH)
    scaler = joblib.load(SCALER_PATH)
    
    PREDICTION_THRESHOLD = 0.4
    
    print(f"Successfully loaded model from {MODEL_PATH}")
    print(f"Successfully loaded scaler from {SCALER_PATH}")
    print(f"Prediction threshold set to: {PREDICTION_THRESHOLD}")

except Exception as e:
    print(f"CRITICAL ERROR: Could not load model or scaler. {e}")
    model = None
    scaler = None

# --- 3. GEE HELPER FUNCTIONS ---
# (These functions are unchanged)
def maskS2clouds(image):
    qa = image.select('QA60'); cloudBitMask=1<<10; cirrusBitMask=1<<11
    mask = qa.bitwiseAnd(cloudBitMask).eq(0).And(qa.bitwiseAnd(cirrusBitMask).eq(0))
    scl = image.select('SCL'); good_quality = scl.eq(4).Or(scl.eq(5)).Or(scl.eq(6)).Or(scl.eq(7)).Or(scl.eq(11))
    required_bands = ['B2', 'B3', 'B4', 'B8', 'B11']
    return image.updateMask(mask).updateMask(good_quality).divide(10000) \
        .select(required_bands).copyProperties(image, ["system:time_start"])

def calculate_indices_and_bands(image):
    ndvi=image.normalizedDifference(['B8','B4']).rename('NDVI')
    ndwi=image.normalizedDifference(['B3','B11']).rename('NDWI')
    bsi_n=(image.select('B11').add(image.select('B4'))).subtract(image.select('B8').add(image.select('B2')))
    bsi_d=(image.select('B11').add(image.select('B4'))).add(image.select('B8').add(image.select('B2')))
    bsi=bsi_n.divide(bsi_d).rename('BSI').toFloat().unmask(None)
    return image.addBands(ndvi).addBands(ndwi).addBands(bsi).select(['B2','B3','B4','B8','B11','NDVI','NDWI','BSI'])

S2_BANDS_NEEDED = ['B2','B3','B4','B8','B11','NDVI','NDWI','BSI']
S1_BANDS = ['VV', 'VH']

def get_live_timeseries_v3_all_features(lon, lat, year_str):
    try:
      start_year = int(year_str.split('-')[0])
      end_year = start_year + 1
    except Exception as e:
      app.logger.warning(f"Invalid year format '{year_str}'. Defaulting to 2020-2021. Error: {e}")
      start_year = 2020
      end_year = 2021
      
    START_DATE = f'{start_year}-06-01'
    END_DATE = f'{end_year}-06-01'
    
    point=ee.Geometry.Point([lon, lat]); 
    dates_full=pd.date_range(start=START_DATE, end=END_DATE, freq='MS', inclusive='both')
    
    start_dates=dates_full[:-1]; end_dates=dates_full[1:]; time_steps=list(zip(start_dates, end_dates))
    chart_months=[d.strftime('%Y-%m') for d in start_dates]
    
    app.logger.info(f"Extracting 12-month time-series for {year_str} from GEE ({START_DATE} to {END_DATE})...")
    final_feature_vector=[]
    
    s2_masked=ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED').filterBounds(point).filterDate(START_DATE,END_DATE).map(maskS2clouds)
    s2_processed=s2_masked.map(calculate_indices_and_bands)
    s1_collection=ee.ImageCollection('COPERNICUS/S1_GRD').filterDate(START_DATE,END_DATE).filter(ee.Filter.listContains('transmitterReceiverPolarisation','VV')).filter(ee.Filter.listContains('transmitterReceiverPolarisation','VH')).filter(ee.Filter.eq('instrumentMode','IW')).filterBounds(point).select(S1_BANDS)
    
    for start, end in time_steps:
        date_start_str=start.strftime('%Y-%m-%d'); date_end_str=end.strftime('%Y-%m-%d')
        monthly_s2=s2_processed.filterDate(date_start_str,date_end_str); s2_count=monthly_s2.size().getInfo()
        monthly_s2_median=ee.Image(ee.Algorithms.If(s2_count>0, monthly_s2.median().rename(S2_BANDS_NEEDED),
                                                  ee.Image.constant([None]*len(S2_BANDS_NEEDED)).toFloat().rename(S2_BANDS_NEEDED)))
        monthly_s1=s1_collection.filterDate(date_start_str,date_end_str); s1_count=monthly_s1.size().getInfo()
        monthly_s1_median=ee.Image(ee.Algorithms.If(s1_count>0, monthly_s1.median().rename(S1_BANDS),
                                                  ee.Image.constant([None]*len(S1_BANDS)).toFloat().rename(S1_BANDS)))
        
        composite=monthly_s1_median.addBands(monthly_s2_median)
        
        try:
            data=composite.reduceRegion(reducer=ee.Reducer.firstNonNull(),geometry=point,scale=10).getInfo()
            final_feature_vector.append(data.get('VH', None)); final_feature_vector.append(data.get('VV', None))
            final_feature_vector.append(data.get('B2', None)); final_feature_vector.append(data.get('B3', None))
            final_feature_vector.append(data.get('B4', None)); final_feature_vector.append(data.get('B8', None))
            final_feature_vector.append(data.get('B11', None)); final_feature_vector.append(data.get('NDVI', None))
            final_feature_vector.append(data.get('NDWI', None)); final_feature_vector.append(data.get('BSI', None))
        except Exception as e: 
            app.logger.warning(f"  Warning: Error processing {start.strftime('%Y-%m')}: {e}. Appending Nones."); 
            final_feature_vector.extend([None]*10)
            
    app.logger.info("...GEE Extraction complete.")
    return final_feature_vector, chart_months

# --- 4. FLASK API ENDPOINTS ---

@app.route('/')
def home():
    return "Backend server for Transformer v2.1 is running! Use /predict_live and /save_user."

# --- NEW: /save_user Endpoint ---
@app.route('/save_user', methods=['POST'])
def save_user():
    if not db:
        return jsonify({"error": "Firestore is not initialized."}), 500
    
    try:
        data = request.get_json()
        uid = data.get('uid')
        if not uid:
            return jsonify({"error": "Missing 'uid' in request."}), 400
        
        # This is your application's unique ID
        app_id = "crop-predictor-app" 
        
        # We store user profiles in a public collection
        # Path: /artifacts/{app_id}/public/data/users/{user_uid}
        user_ref = db.collection(f"artifacts/{app_id}/public/data/users").document(uid)
        
        user_data = {
            'email': data.get('email'),
            'displayName': data.get('displayName'),
            'photoURL': data.get('photoURL'),
            'last_login': firestore.SERVER_TIMESTAMP
        }
        
        # set(..., merge=True) creates the doc if it doesn't exist
        # or updates it if it does.
        user_ref.set(user_data, merge=True)
        
        return jsonify({"status": "success", "uid": uid}), 201

    except Exception as e:
        app.logger.error(f"Error during /save_user: {e}")
        return jsonify({"error": f"An error occurred: {str(e)}"}), 500

# --- /predict_live Endpoint (Unchanged) ---
@app.route('/predict_live', methods=['POST'])
def predict_live():
    
    if not model or not scaler:
        return jsonify({"error": "Model or scaler not loaded. Check server logs."}), 500

    try:
        json_data = request.get_json()
        if not json_data or 'lat' not in json_data or 'lon' not in json_data:
            return jsonify({"error": "Missing 'lat' or 'lon' in JSON payload."}), 400
        
        lat = json_data['lat']
        lon = json_data['lon']
        year_str = json_data.get('year', '2020-2021')
        
        current_model = model
        current_scaler = scaler
        
        live_features, chart_months = get_live_timeseries_v3_all_features(lon, lat, year_str)
        
        if len(live_features)!=120: 
            app.logger.error(f"GEE extraction returned {len(live_features)} features, expected 120. Padding...")
            live_features.extend([None]*(120-len(live_features)))
            
        live_features_numeric = [np.nan if f is None else f for f in live_features]
        live_data_np = np.array(live_features_numeric, dtype=float).reshape(1, -1)
        
        nan_count_pre_scale = np.isnan(live_data_np).sum()
        imputed_value = 0.0
        if nan_count_pre_scale > 0:
            app.logger.warning(f"{nan_count_pre_scale} missing values. Imputing with {imputed_value}.")
            live_data_np = np.nan_to_num(live_data_np, nan=imputed_value)
            
        live_data_scaled = current_scaler.transform(live_data_np)
        if np.isnan(live_data_scaled).any():
            app.logger.warning("NaNs found after scaling. Replacing with 0.")
            live_data_scaled = np.nan_to_num(live_data_scaled, nan=0.0)
            
        live_data_reshaped = live_data_scaled.reshape((1, 12, 10))

        prediction_raw_prob = current_model.predict(live_data_reshaped)[0][0]
        prediction_label_name = "CROP" if prediction_raw_prob > PREDICTION_THRESHOLD else "NON-CROP"
        confidence = prediction_raw_prob if prediction_label_name == "CROP" else 1 - prediction_raw_prob

        ndvi_values = [live_features_numeric[i+7] for i in range(0,120,10)]
        ndwi_values = [live_features_numeric[i+8] for i in range(0,120,10)]
        bsi_values = [live_features_numeric[i+9] for i in range(0,120,10)]
        
        ndwi_mean = np.nanmean(ndwi_values)
        bsi_mean = np.nanmean(bsi_values)
        
        final_display_label = ""
        if prediction_label_name == "CROP":
            final_display_label = "CROP"
        else:
            if not np.isnan(ndwi_mean) and ndwi_mean > 0.1:
                final_display_label = "NON-CROP (Identified as Water)"
            elif not np.isnan(bsi_mean) and bsi_mean > 0.05:
                final_display_label = "NON-CROP (Identified as Barren Soil)"
            else:
                final_display_label = "NON-CROP (Identified as Built-up/Other)"

        return jsonify({
            "report_details": {
                "model_version": f"v2.1 (Data: {year_str})", 
                "prediction_threshold": PREDICTION_THRESHOLD
            },
            "coordinates": {"lat": lat, "lon": lon},
            "prediction_label": final_display_label,
            "raw_probability_crop": float(prediction_raw_prob),
            "confidence": f"{float(confidence)*100:.2f}%",
            "chart_data": {
                "months": chart_months,
                "ndvi_values": [None if np.isnan(v) else v for v in ndvi_values],
                "ndwi_values": [None if np.isnan(v) else v for v in ndwi_values],
                "bsi_values": [None if np.isnan(v) else v for v in bsi_values]
            },
            "subclass_metrics": {
                "ndwi_mean": None if np.isnan(ndwi_mean) else float(ndwi_mean),
                "bsi_mean": None if np.isnan(bsi_mean) else float(bsi_mean)
            }
        })

    except Exception as e:
        app.logger.error(f"Error during /predict_live: {e}")
        return jsonify({"error": f"An error occurred: {str(e)}"}), 500

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000, threaded=False, use_reloader=False)