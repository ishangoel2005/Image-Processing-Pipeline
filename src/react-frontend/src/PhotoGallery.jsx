import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { S3Client, ListObjectsV2Command, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { DynamoDBClient, GetItemCommand } from '@aws-sdk/client-dynamodb';
import { ArrowLeft } from 'lucide-react';

export default function PhotoGallery() {
  const { albumId } = useParams();
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPhotos();
  }, [albumId]);

  async function fetchPhotos() {
    try {
      setLoading(true);

      const awsConfig = {
        region: import.meta.env.VITE_REGION,
        credentials: {
          accessKeyId: import.meta.env.VITE_AWS_ACCESS_KEY_ID,
          secretAccessKey: import.meta.env.VITE_AWS_SECRET_ACCESS_KEY,
        }
      };

      const s3Client = new S3Client(awsConfig);

      // 1. List S3 objects for the album
      const listCommand = new ListObjectsV2Command({
        Bucket: import.meta.env.VITE_S3_BUCKET,
        Prefix: `public/uploads/${albumId}/`
      });
      const listResult = await s3Client.send(listCommand);

      const items = listResult.Contents || [];
      if (items.length === 0) {
        setPhotos([]);
        setLoading(false);
        return;
      }

      // 2. Fetch metadata from DynamoDB for each item
      const dbClient = new DynamoDBClient(awsConfig);
      const tableName = import.meta.env.VITE_DYNAMODB_TABLE || 'ImageMetadata';

      const photoDetails = await Promise.all(items.map(async (item) => {
        const fullKey = item.Key; // from S3 list it already includes public/uploads/...
        
        try {
          const dbResult = await dbClient.send(new GetItemCommand({
            TableName: tableName,
            Key: { objectKey: { S: fullKey } }
          }));

          const dbItem = dbResult.Item || {};
          
          let presignedUrl = null;
          let thumbnailUrl = null;
          
          if (dbItem.status && dbItem.status.S === 'COMPLETED') {
            // Get full image url
            const getObjCommand = new GetObjectCommand({
              Bucket: import.meta.env.VITE_S3_BUCKET,
              Key: item.Key
            });
            presignedUrl = await getSignedUrl(s3Client, getObjCommand, { expiresIn: 3600 });
            
            // Get thumbnail url
            if (dbItem.thumbnailKey) {
              const getThumbCommand = new GetObjectCommand({
                Bucket: import.meta.env.VITE_S3_BUCKET,
                Key: dbItem.thumbnailKey.S
              });
              thumbnailUrl = await getSignedUrl(s3Client, getThumbCommand, { expiresIn: 3600 });
            }
          }

          return {
            key: item.Key,
            filename: item.Key.split('/').pop(),
            fullUrl: presignedUrl,
            thumbnailUrl: thumbnailUrl || presignedUrl,
            status: dbItem.status ? dbItem.status.S : 'UNKNOWN',
            format: dbItem.format ? dbItem.format.S : 'N/A',
            size: dbItem.size ? Math.round(parseInt(dbItem.size.N) / 1024) + ' KB' : 'N/A',
            tags: dbItem.tags ? dbItem.tags.L.map(t => t.S) : [],
            exif: dbItem.exifData ? JSON.parse(dbItem.exifData.S) : null
          };
        } catch (e) {
          console.error("Failed to load metadata for", fullKey, e);
          return null;
        }
      }));

      setPhotos(photoDetails.filter(Boolean));
    } catch (err) {
      console.error('Error fetching photos:', err);
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <div className="card-content">Loading photos in {albumId}...</div>;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '2rem', gap: '1rem' }}>
        <Link to="/" style={{ color: '#94a3b8' }}><ArrowLeft /></Link>
        <h2>Album: {albumId}</h2>
      </div>

      <div className="grid-container">
        {photos.length === 0 ? (
          <p>No photos in this album yet.</p>
        ) : (
          photos.map(photo => (
            <div key={photo.key} className="card">
              {photo.status === 'COMPLETED' ? (
                <a href={photo.fullUrl} target="_blank" rel="noreferrer">
                  <img src={photo.thumbnailUrl} alt={photo.filename} loading="lazy" />
                </a>
              ) : (
                <div style={{ height: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#334155' }}>
                  Processing...
                </div>
              )}
              
              <div className="card-content">
                <h4 style={{ margin: '0 0 0.5rem 0', wordBreak: 'break-all' }}>{photo.filename}</h4>
                <div style={{ fontSize: '0.875rem', color: '#94a3b8' }}>
                  {photo.format} &bull; {photo.size}
                </div>
                
                {photo.status === 'COMPLETED' && photo.tags.length > 0 && (
                  <div className="tags">
                    {photo.tags.map(tag => (
                      <span key={tag} className="tag">{tag}</span>
                    ))}
                  </div>
                )}

                {photo.exif && Object.keys(photo.exif).length > 0 && (
                  <div style={{ marginTop: '0.75rem', fontSize: '0.75rem', color: '#64748b' }}>
                    {photo.exif.Make} {photo.exif.Model} 
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}