import React from 'react';
import './AboutPage.css'; // This file just adds padding and scrollbar

// Import MUI components for styling
import Container from '@mui/material/Container';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';

const AboutPage = () => {
  return (
    <div className="about-container">
      <Container maxWidth="md">
        <Paper elevation={3} sx={{ 
          padding: { xs: 3, md: 5 }, // Responsive padding
          backgroundColor: 'rgba(255, 255, 255, 0.9)',
          backdropFilter: 'blur(10px)',
        }}>
          {/* --- Title --- */}
          <Typography variant="h3" component="h1" gutterBottom sx={{ fontWeight: 600 }}>
            About This Project: Mapping Agriculture with AI
          </Typography>
          
          {/* --- Mission --- */}
          <Typography variant="h5" component="h2" gutterBottom sx={{ mt: 4, color: 'primary.main' }}>
            Our Mission
          </Typography>
          <Typography variant="body1" sx={{ fontSize: '1.1rem', lineHeight: 1.7 }}>
            This project provides a real-time tool for identifying agricultural land use across Telangana and Andhra Pradesh. 
            Our goal is to transform complex satellite data into a simple, actionable answer to the question: 
            <strong>"Is this land being used for crops?"</strong>
          </Typography>
          <Typography variant="body1" sx={{ fontSize: '1.1rem', lineHeight: 1.7, mt: 2 }}>
            By providing a clear "Crop" vs. "Non-Crop" classification, we aim to offer a valuable resource for policymakers, 
            agricultural officers, and farmers to make more informed decisions about resource allocation, land management, and food security.
          </Typography>

          {/* --- How It Works --- */}
          <Typography variant="h5" component="h2" gutterBottom sx={{ mt: 4, color: 'primary.main' }}>
            How It Works: From Click to Classification
          </Typography>
          <Typography variant="body1" component="div" sx={{ fontSize: '1.1rem', lineHeight: 1.7 }}>
            When you click a point on the map, you set a powerful analytical engine in motion. Here’s a step-by-step look at what happens:
            <ol>
              <li><strong>You Click:</strong> Your browser sends the precise latitude and longitude of your selected point to our backend server.</li>
              <li><strong>Live Data Extraction:</strong> Our server instantly contacts Google Earth Engine (GEE). It requests the last 12 months of satellite imagery (both optical and radar) for that exact location.</li>
              <li><strong>Feature Engineering:</strong> The server doesn't just look at a single picture. It processes the 12 months of data to create a "time-series fingerprint" of that land, extracting 120 key data points (10 features for each of the 12 months).</li>
              <li><strong>AI Prediction:</strong> This 120-point "fingerprint" is fed into our trained Transformer-based Deep Learning model. The model analyzes the entire year-long pattern to find the probability of it being a crop.</li>
              <li><strong>The Result:</strong> The model's probability score is converted into a clear prediction: "CROP" (above 40% probability) or "NON-CROP" (below 40%).</li>
              <li><strong>Smart Sub-Classification:</strong> If the prediction is "Non-Crop," we perform a final analysis on the satellite indices (NDWI and BSI) to tell you *why*. The final result, along with the most relevant data chart, is sent back to your screen.</li>
            </ol>
          </Typography>

          {/* --- The Technology --- */}
          <Typography variant="h5" component="h2" gutterBottom sx={{ mt: 4, color: 'primary.main' }}>
            The Technology: What's Under the Hood?
          </Typography>
          
          <Box sx={{ mt: 2, pl: 2 }}>
            <Typography variant="h6" gutterBottom>
              Data Sources
            </Typography>
            <Typography variant="body1" component="div" paragraph sx={{ fontSize: '1.1rem', lineHeight: 1.7 }}>
              We use a combination of two powerful satellite constellations from the European Space Agency (ESA):
              <ul>
                <li><strong>Sentinel-2 🛰️ (Optical):</strong> This is like a very powerful camera in the sky. It provides 10-meter resolution images to measure plant health (greenness), water content, and bare soil.</li>
                <li><strong>Sentinel-1 📡 (Radar):</strong> This satellite uses radar, which has the powerful advantage of <strong>seeing right through clouds</strong>. This is critical for monitoring crop growth during the cloudy monsoon season when optical satellites are blind.</li>
              </ul>
            </Typography>

            <Typography variant="h6" gutterBottom>
              Why Use a Model? (AI vs. The Naked Eye)
            </Typography>
            <Typography variant="body1" component="div" paragraph sx={{ fontSize: '1.1rem', lineHeight: 1.7 }}>
              You can use the satellite toggle to see the ground, but a single image doesn't tell the whole story. Our AI model sees what the naked eye cannot:
              <ul>
                <li><strong>It Sees Through Time:</strong> A field might look "barren" in a May satellite photo, but the model knows it was green in September and will correctly classify it as a <strong>Crop</strong> (in a fallow period). A forest, on the other hand, is green all year, and the model knows the difference.</li>
                <li><strong>It Sees Through Clouds:</strong> During the monsoon, clouds block the satellite view. Our model uses radar data (Sentinel-1) to continue tracking the crop's growth, making it far more reliable than a human observer.</li>
              </ul>
            </Typography>

            <Typography variant="h6" gutterBottom>
              The AI Model
            </Typography>
            <Typography variant="body1" paragraph sx={{ fontSize: '1.1rem', lineHeight: 1.7 }}>
              The "brain" of this project is a **Transformer** neural network. This is the same type of AI technology behind models like ChatGPT, but it has been specifically trained to analyze data sequences. Instead of looking at one image, it analyzes the entire 12-month "fingerprint" of a location to understand its story. Our model (v2.1) was trained on 1,988 known locations across Telangana and Andhra Pradesh.
            </Typography>
          </Box>

          {/* --- Key Terms --- */}
          <Typography variant="h5" component="h2" gutterBottom sx={{ mt: 4, color: 'primary.main' }}>
            What Am I Looking At? (Key Terms)
          </Typography>
          <Typography variant="body1" paragraph sx={{ fontSize: '1.1rem', lineHeight: 1.7 }}>
            When you get a prediction, we show you the one chart that provides the best evidence for that result.
          </Typography>
          
          <Box sx={{ mt: 2, pl: 2 }}>
            <Typography variant="h6" gutterBottom>
            📈 NDVI (Normalized Difference Vegetation Index)
            </Typography>
            <Typography variant="body1" paragraph sx={{ fontSize: '1.1rem', lineHeight: 1.7 }}>
              <strong>What it is:</strong> The "Greenness Chart." It's the most common index for measuring plant health. A high value means healthy, leafy vegetation.
              <br/>
              <strong>Why you see it:</strong> We show this for <strong>CROP</strong> predictions. A classic crop signature is a "growth curve"—a low NDVI during planting, a high peak during mid-season, and a drop-off at harvest.
            </Typography>
          </Box>
          <Box sx={{ mt: 2, pl: 2 }}>
            <Typography variant="h6" gutterBottom>
            💧 NDWI (Normalized Difference Water Index)
            </Typography>
            <Typography variant="body1" paragraph sx={{ fontSize: '1.1rem', lineHeight: 1.7 }}>
              <strong>What it is:</strong> The "Water Chart." It excels at identifying open water bodies. High positive values mean water.
              <br/>
              <strong>Why you see it:</strong> We show this for <strong>NON-CROP (Water)</strong> predictions. A flat, high line on this chart is a clear sign of a river or lake, even in the dry season.
            </Typography>
          </Box>
          <Box sx={{ mt: 2, pl: 2 }}>
            <Typography variant="h6" gutterBottom>
            🧱 BSI (Bare Soil Index)
            </Typography>
            <Typography variant="body1" paragraph sx={{ fontSize: '1.1rem', lineHeight: 1.7 }}>
              <strong>What it is:</strong> The "Bare Soil Chart." It is designed to highlight areas of bare soil, sand, and man-made structures (like buildings and roads).
              <br/>
              <strong>Why you see it:</strong> We show this for <strong>NON-CROP (Barren Soil)</strong> or <strong>NON-CROP (Built-up/Other)</strong> predictions. A high BSI value indicates the land is not covered by vegetation or water.
            </Typography>
          </Box>

        </Paper>
      </Container>
    </div>
  );
};

export default AboutPage;