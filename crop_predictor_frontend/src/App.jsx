import React, { useState, useEffect, createContext, useContext } from 'react';
import { Routes, Route, Link, useNavigate, Navigate, Outlet, useLocation } from 'react-router-dom';

// --- IMPORTS ---
import HomePage from './pages/HomePage';
import MapPage from './pages/MapPage';
import AboutPage from './pages/AboutPage';
import './App.css';
// UPDATED firebase import
import { auth, googleLogin, emailSignUp, emailLogin, logout, onAuthStateChanged } from './firebase'; 

// --- MUI Imports ---
import AppBar from '@mui/material/AppBar';
import Box from '@mui/material/Box';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Avatar from '@mui/material/Avatar';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import Logout from '@mui/icons-material/Logout';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import { Backdrop, TextField, Alert, Divider, ButtonBase } from '@mui/material';

// --- 1. Create Auth Context ---
const AuthContext = createContext();
export const useAuth = () => useContext(AuthContext);

// --- 2. Create Auth Provider (as the main App component) ---
function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const openLoginModal = () => setIsLoginModalOpen(true);
  const closeLoginModal = () => setIsLoginModalOpen(false);

  const handleLogout = async () => {
    await logout();
  };

  const authContextValue = {
    user,
    loading,
    isLoginModalOpen,
    openLoginModal,
    closeLoginModal,
    handleLogout
  };

  return (
    <AuthContext.Provider value={authContextValue}>
      <AppLayout />
    </AuthContext.Provider>
  );
}

// --- 3. App Layout Component (STYLES FIXED) ---
function AppLayout() {
  const { loading, user, isLoginModalOpen, closeLoginModal, openLoginModal } = useAuth();
  useModalFromLocation(); 

  return (
    <>
      <AppBar position="static" sx={{ 
        backgroundColor: 'rgba(255, 255, 255, 0.95)', 
        borderBottom: '1px solid #e0e0e0', 
        color: '#222', 
        boxShadow: 'none' 
      }}>
        <Toolbar>
          <Typography
            variant="h6"
            component={Link}
            to="/"
            sx={{ flexGrow: 1, fontWeight: 700, textDecoration: 'none', color: 'inherit' }}
          >
            AGROVISION
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <Button component={Link} to="/" color="inherit" sx={{ fontWeight: 500 }}>
              Home
            </Button>
            <Button component={Link} to="/map" color="inherit" sx={{ fontWeight: 500 }}>
              Analysis Map
            </Button>
            <Button component={Link} to="/about" color="inherit" sx={{ fontWeight: 500 }}>
              About
            </Button>
            <Box sx={{ ml: 2 }}>
              {loading && <CircularProgress size={24} sx={{ color: '#222' }} />}
              {!loading && !user && (
                <Button 
                  variant="contained" 
                  onClick={openLoginModal} 
                  sx={{ 
                    backgroundColor: '#007bff', 
                    '&:hover': { backgroundColor: '#0056b3' } 
                  }}
                >
                  Login
                </Button>
              )}
              {!loading && user && <UserProfileDropdown />}
            </Box> {/* <-- THIS IS THE FIX (was </Bottom>) */}
          </Box>
        </Toolbar>
      </AppBar>

      <div className="page-content">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route element={<ProtectedRoute />}>
            <Route path="/map" element={<MapPage />} />
            <Route path="/about" element={<AboutPage />} />
          </Route>
        </Routes>
      </div>

      <LoginModal
        open={isLoginModalOpen}
        onClose={closeLoginModal}
      />
    </>
  );
}

// --- 4. User Profile Dropdown Component (STYLES FIXED) ---
function UserProfileDropdown() {
  const { user, handleLogout } = useAuth();
  const [anchorEl, setAnchorEl] = useState(null);
  const open = Boolean(anchorEl);
  const navigate = useNavigate();

  const handleClick = (event) => setAnchorEl(event.currentTarget);
  const handleClose = () => setAnchorEl(null);

  const onLogout = () => {
    handleClose();
    handleLogout();
    navigate('/');
  };

  return (
    <>
      <Button onClick={handleClick} sx={{ p: 0, minWidth: 'auto', borderRadius: '50%' }}>
        <Avatar 
          alt={user.displayName || 'User'} 
          src={user.photoURL} 
          sx={{ width: 40, height: 40 }} 
        />
      </Button>
      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        PaperProps={{
          elevation: 0,
          sx: {
            overflow: 'visible',
            filter: 'drop-shadow(0px 2px 8px rgba(0,0,0,0.32))',
            mt: 1.5,
            '& .MuiAvatar-root': { width: 32, height: 32, ml: -0.5, mr: 1, },
          },
        }}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
      >
        <MenuItem disabled sx={{ fontWeight: 500, color: '#000 !important' }}>
          {user.displayName || user.email}
        </MenuItem>
        <MenuItem onClick={onLogout}>
          <ListItemIcon>
            <Logout fontSize="small" />
          </ListItemIcon>
          Logout
        </MenuItem>
      </Menu>
    </>
  );
}


// --- 5. Login Modal Component (No errors here, but included for completeness) ---
function LoginModal({ open, onClose }) {
  const [mode, setMode] = useState('login'); // 'login' or 'signup'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  // Clear form when closing
  const handleClose = () => {
    onClose();
    setError('');
    setEmail('');
    setPassword('');
    setMode('login');
  };

  const handleGoogle = async () => {
    const result = await googleLogin();
    if (result?.error) {
      setError(result.error.message);
    } else {
      handleClose(); // Success
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    if (mode === 'login') {
      const result = await emailLogin(email, password);
      if (result?.error) {
        setError(result.error.message);
      } else {
        handleClose(); // Success
      }
    } else { // Signup mode
      const result = await emailSignUp(email, password);
      if (result?.error) {
        setError(result.error.message);
      } else {
        handleClose(); // Success
      }
    }
  };

  const toggleMode = () => {
    setMode(mode === 'login' ? 'signup' : 'login');
    setError('');
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose} // Use our custom close handler
      BackdropComponent={Backdrop}
      BackdropProps={{
        timeout: 500,
        sx: { backgroundColor: 'rgba(0,0,0,0.1)', backdropFilter: 'blur(4px)' }
      }}
      PaperProps={{
        elevation: 0,
        sx: {
          backgroundColor: 'rgba(255, 255, 255, 0.9)',
          backdropFilter: 'blur(10px)',
          borderRadius: '12px',
          width: '400px',
        }
      }}
    >
      <DialogTitle sx={{ fontWeight: 600, textAlign: 'center', pb: 1 }}>
        {mode === 'login' ? 'Welcome Back' : 'Create Account'}
      </DialogTitle>
      
      <DialogContent sx={{ textAlign: 'center', p: 3, pt: 0 }}>
        
        {/* --- Email/Password Form --- */}
        <Box component="form" onSubmit={handleSubmit}>
          <TextField
            label="Email Address"
            type="email"
            variant="outlined"
            size="small"
            fullWidth
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            sx={{ mb: 1.5 }}
          />
          <TextField
            label="Password"
            type="password"
            variant="outlined"
            size="small"
            fullWidth
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            sx={{ mb: 1.5 }}
          />
          
          {error && (
            <Alert severity="error" sx={{ mb: 1.5, textAlign: 'left' }}>
              {error}
            </Alert>
          )}

          <Button
            type="submit"
            variant="contained"
            fullWidth
            sx={{ mb: 2, padding: '10px', fontWeight: 600 }}
          >
            {mode === 'login' ? 'Login' : 'Sign Up'}
          </Button>
        </Box>

        {/* --- "OR" Divider --- */}
        <Divider sx={{ mb: 2, fontSize: '0.9em', color: '#555' }}>OR</Divider>

        {/* --- Google Button --- */}
        <button className="google-login-button" onClick={handleGoogle}>
          <img src="/google.png" alt="Google icon" />
          Sign in with Google
        </button>

        {/* --- Toggle Button --- */}
        <Box sx={{ mt: 2.5 }}>
          <ButtonBase onClick={toggleMode} sx={{ fontSize: '0.9em', color: '#333' }}>
            {mode === 'login'
              ? "Don't have an account? Sign Up"
              : 'Already have an account? Login'}
          </ButtonBase>
        </Box>

      </DialogContent>
    </Dialog>
  );
}


// --- 6. Protected Route Component (Unchanged) ---
function ProtectedRoute() {
  const { user, loading } = useAuth();
  const location = useLocation(); 

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!user) {
    return <Navigate to="/" state={{ from: location, openLogin: true }} replace />;
  }

  return <Outlet />;
}

// --- 7. Side-effect hook (Unchanged) ---
function useModalFromLocation() {
  const { state } = useLocation();
  const { openLoginModal } = useAuth();
  
  useEffect(() => {
    if (state?.openLogin) {
      openLoginModal();
    }
  }, [state, openLoginModal]);
}

export default App;