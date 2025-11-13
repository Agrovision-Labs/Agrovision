import React from 'react';
import { useNavigate } from 'react-router-dom';
import './HomePage.css'; // Assumes HomePage.css is in the same 'pages' folder
import { useAuth } from '../App'; // <-- FIXED: Imports from App.jsx in 'src'
import Button from '@mui/material/Button'; 

const HomePage = () => {
  const { user, openLoginModal } = useAuth(); 
  const navigate = useNavigate();

  const handleLaunchClick = () => {
    if (user) {
      navigate('/map'); 
    } else {
      openLoginModal(); 
    }
  };

  return (
    <div className="home-container">
      <div className="hero-section">
        <h1 className="hero-title">Welcome to the Crop Analysis Portal</h1>
        <p className="hero-subtitle">
          Leveraging Transformer models and satellite imagery to provide
          real-time crop classification.
        </p>
        
        <Button
          variant="contained"
          size="large"
          onClick={handleLaunchClick}
          className="hero-button" 
          sx={{
            padding: '12px 24px',
            fontSize: '1.1em',
            fontWeight: 600,
            backgroundColor: '#007bff',
            '&:hover': { backgroundColor: '#0056b3' }
          }}
        >
          Launch Analysis Map
        </Button>
      </div>
    </div>
  );
};

export default HomePage;