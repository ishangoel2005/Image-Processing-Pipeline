import React, { useState, useEffect } from 'react';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { DynamoDBClient, GetItemCommand } from '@aws-sdk/client-dynamodb';

export default function UploadPhoto() {
  const [file, setFile] = useState(null);
  const [album, setAlbum] = useState('Default');
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState(null); // 'UPLOADING', 'PROCESSING', 'COMPLETED', 'ERROR'
  const [statusMessage, setStatusMessage] = useState('');
  const [objectKey, setObjectKey] = useState(null);
  const [region, setRegion] = useState('');

  useEffect(() => {
    setRegion(import.meta.env.VITE_REGION || 'us-east-1');
  }, []);

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file) return;

    setUploading(true);
    setStatus('UPLOADING');
    setStatusMessage('Uploading to S3...');

    try {
      const filename = `${Date.now()}-${file.name.replace(/\s+/g, '-')}`;
      const key = `private/default-user/uploads/${filename}`;

      const s3Client = new S3Client({
        region: import.meta.env.VITE_REGION,
        credentials: {
          accessKeyId: import.meta.env.VITE_AWS_ACCESS_KEY_ID,
          secretAccessKey: import.meta.env.VITE_AWS_SECRET_ACCESS_KEY,
        }
      });

      const arrayBuffer = await file.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);

      const command = new PutObjectCommand({
        Bucket: import.meta.env.VITE_S3_BUCKET,
        Key: key,
        Body: uint8Array,
        ContentType: file.type
      });

      await s3Client.send(command);
      setObjectKey(key);

      setStatus('PROCESSING');
      setStatusMessage('Processing serverless pipeline... (Extracting EXIF, Resizing, Tagging)');
      // Start polling DynamoDB
      pollStatus(key);

    } catch (err) {
      console.error('Error uploading file:', err);
      setStatus('ERROR');
      setStatusMessage('Upload failed. Check your AWS credentials.');
      setUploading(false);
    }
  };

  const pollStatus = async (key) => {
    try {
      const dbClient = new DynamoDBClient({
        region: import.meta.env.VITE_REGION,
        credentials: {
          accessKeyId: import.meta.env.VITE_AWS_ACCESS_KEY_ID,
          secretAccessKey: import.meta.env.VITE_AWS_SECRET_ACCESS_KEY,
        }
      });

      const tableName = import.meta.env.VITE_DYNAMODB_TABLE || 'ImageMetadata';

      const interval = setInterval(async () => {
        try {
          const result = await dbClient.send(new GetItemCommand({
            TableName: tableName,
            Key: {
              objectKey: { S: key }
            }
          }));

          if (result.Item && result.Item.status) {
            const currentStatus = result.Item.status.S;
            if (currentStatus === 'COMPLETED' || currentStatus === 'ERROR') {
              setStatus(currentStatus);
              setStatusMessage(currentStatus === 'COMPLETED' ? 'Processing Complete!' : 'Processing Error.');
              setUploading(false);
              clearInterval(interval);
            }
          }
        } catch (dbErr) {
          console.error("Polling error (might just be eventually consistent or not created yet):", dbErr);
        }
      }, 3000);

      setTimeout(() => {
        clearInterval(interval);
        if (status === 'PROCESSING') {
          setStatus('ERROR');
          setStatusMessage('Processing timed out.');
          setUploading(false);
        }
      }, 60000);

    } catch (e) {
      console.error("Could not setup DB client", e);
    }
  };

  return (
    <div className="upload-container">
      <h2>Upload Photo</h2>
      <form onSubmit={handleUpload}>
        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem' }}>Album Name</label>
          <input
            type="text"
            value={album}
            onChange={(e) => setAlbum(e.target.value)}
            style={{ width: '100%', padding: '0.75rem', borderRadius: '0.375rem', border: '1px solid #334155', background: '#0f172a', color: 'white' }}
            required
          />
        </div>

        <input
          type="file"
          accept="image/jpeg, image/png"
          onChange={handleFileChange}
          className="file-input"
          required
        />

        <button type="submit" className="btn-primary" disabled={uploading || !file}>
          {uploading ? 'Uploading...' : 'Upload & Process'}
        </button>
      </form>

      {status && (
        <div style={{ marginTop: '2rem', padding: '1rem', backgroundColor: '#334155', borderRadius: '0.5rem' }}>
          <h3>Status: <span className={`status-badge status-${status.toLowerCase()}`}>{status}</span></h3>
          <p>{statusMessage}</p>
          {status === 'PROCESSING' && (
            <p style={{ marginTop: '1rem', fontSize: '0.875rem' }}>
              <a
                href={`https://${region}.console.aws.amazon.com/states/home?region=${region}#/executions`}
                target="_blank"
                rel="noreferrer"
                style={{ color: '#6366f1' }}
              >
                View Step Functions Execution in AWS Console
              </a>
            </p>
          )}
        </div>
      )}
    </div>
  );
}