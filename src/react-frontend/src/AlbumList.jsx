import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { S3Client, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { Folder } from 'lucide-react';

export default function AlbumList() {
  const [albums, setAlbums] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newAlbumName, setNewAlbumName] = useState('');
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchAlbums();
  }, []);

  async function fetchAlbums() {
    try {
      setLoading(true);
      const s3Client = new S3Client({
        region: import.meta.env.VITE_REGION,
        credentials: {
          accessKeyId: import.meta.env.VITE_AWS_ACCESS_KEY_ID,
          secretAccessKey: import.meta.env.VITE_AWS_SECRET_ACCESS_KEY,
        }
      });

      const command = new ListObjectsV2Command({
        Bucket: import.meta.env.VITE_S3_BUCKET,
        Prefix: 'public/uploads/'
      });

      const result = await s3Client.send(command);

      const albumSet = new Set();
      if (result.Contents) {
          result.Contents.forEach(item => {
            const parts = item.Key.replace('public/uploads/', '').split('/');
            if (parts.length > 1) {
              albumSet.add(parts[0]);
            }
          });
      }
      
      setAlbums(Array.from(albumSet));
    } catch (err) {
      console.error('Error fetching albums:', err);
      setError('Could not load albums. Check your AWS credentials.');
    } finally {
      setLoading(false);
    }
  }

  function handleCreateAlbum(e) {
    e.preventDefault();
    if (!newAlbumName.trim()) return;
    
    if (!albums.includes(newAlbumName.trim())) {
      setAlbums([...albums, newAlbumName.trim()]);
    }
    setNewAlbumName('');
  }

  if (loading) return <div className="card-content">Loading albums...</div>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h2>My Albums</h2>
        <form onSubmit={handleCreateAlbum} style={{ display: 'flex', gap: '0.5rem' }}>
          <input 
            type="text" 
            placeholder="New Album Name" 
            value={newAlbumName}
            onChange={(e) => setNewAlbumName(e.target.value)}
            style={{ padding: '0.5rem', borderRadius: '0.25rem', border: '1px solid #334155', background: '#0f172a', color: 'white' }}
          />
          <button type="submit" className="btn-primary" style={{ width: 'auto' }}>Create</button>
        </form>
      </div>

      {error && <p style={{ color: '#ef4444' }}>{error}</p>}

      <div className="grid-container">
        {albums.length === 0 ? (
          <p>No albums found. Create one above!</p>
        ) : (
          albums.map(album => (
            <Link to={`/album/${encodeURIComponent(album)}`} key={album} style={{ textDecoration: 'none' }}>
              <div className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '150px', flexDirection: 'column' }}>
                <Folder size={48} color="#6366f1" />
                <h3 style={{ marginTop: '1rem', color: '#f8fafc' }}>{album}</h3>
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}