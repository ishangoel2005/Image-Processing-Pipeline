import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link, Navigate } from 'react-router-dom';

import AlbumList from './AlbumList';
import PhotoGallery from './PhotoGallery';
import UploadPhoto from './UploadPhoto';
import './index.css';

function App() {
  return (
    <Router>
      <div className="app-container">
        <nav className="navbar">
          <div className="nav-brand">Serverless Image Repo</div>
          <div className="nav-links">
            <Link to="/">Albums</Link>
            <Link to="/upload">Upload</Link>
          </div>
        </nav>
        
        <main className="main-content">
          <h1>APP IS WORKING</h1>
          <Routes>
            <Route path="/" element={<AlbumList />} />
            <Route path="/album/:albumId" element={<PhotoGallery />} />
            <Route path="/upload" element={<UploadPhoto />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;