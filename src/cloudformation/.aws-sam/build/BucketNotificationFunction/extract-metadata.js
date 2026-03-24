const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
const exifr = require('exifr');

const s3 = new S3Client();

exports.handler = async (event) => {
    console.log("extract-metadata input:", JSON.stringify(event));
    const { bucket, key, userId } = event;

    const getObjectParams = { Bucket: bucket, Key: key };
    let format = 'unknown';
    let size = 0;
    let exifData = null;
    let location = null;
    let timestamp = new Date().toISOString();

    try {
        const command = new GetObjectCommand(getObjectParams);
        const response = await s3.send(command);
        
        format = response.ContentType || 'unknown';
        size = response.ContentLength || 0;
        
        // Convert ReadableStream to buffer
        const streamToBuffer = (stream) =>
            new Promise((resolve, reject) => {
                const chunks = [];
                stream.on("data", (chunk) => chunks.push(chunk));
                stream.on("error", reject);
                stream.on("end", () => resolve(Buffer.concat(chunks)));
            });

        const fileBuffer = await streamToBuffer(response.Body);
        
        // Try to extract EXIF
        try {
            const parsedExif = await exifr.parse(fileBuffer, { gps: true, tiff: true, ifd0: true, exif: true });
            if (parsedExif) {
                exifData = {
                    Make: parsedExif.Make || undefined,
                    Model: parsedExif.Model || undefined,
                    Software: parsedExif.Software || undefined,
                    DateTimeOriginal: parsedExif.DateTimeOriginal || undefined,
                };
                if (parsedExif.latitude && parsedExif.longitude) {
                    location = {
                        Latitude: parsedExif.latitude,
                        Longitude: parsedExif.longitude
                    };
                }
            }
        } catch (e) {
            console.log("Failed to parse EXIF, but continuing:", e);
        }

    } catch (error) {
        console.error("Error reading object from S3", error);
        throw error;
    }

    return {
        bucket,
        key,
        userId,
        metadata: {
            format,
            size,
            exifData,
            location,
            timestamp
        }
    };
};
