const { S3Client, GetObjectCommand, PutObjectCommand } = require('@aws-sdk/client-s3');
const { DynamoDBClient, UpdateItemCommand } = require('@aws-sdk/client-dynamodb');
const Jimp = require('jimp');

const s3 = new S3Client();
const dynamodb = new DynamoDBClient();

exports.handler = async (event) => {
    console.log("generate-thumbnail input:", JSON.stringify(event));
    
    let dataPayload = event.StoreMetadataResult ? event.StoreMetadataResult : event;
    const { bucket, key, userId } = dataPayload;

    try {
        // Read image from S3
        const getCommand = new GetObjectCommand({ Bucket: bucket, Key: key });
        const response = await s3.send(getCommand);
        
        const streamToBuffer = (stream) =>
            new Promise((resolve, reject) => {
                const chunks = [];
                stream.on("data", (chunk) => chunks.push(chunk));
                stream.on("error", reject);
                stream.on("end", () => resolve(Buffer.concat(chunks)));
            });

        const fileBuffer = await streamToBuffer(response.Body);
        
        // Resize with Jimp
        const image = await Jimp.read(fileBuffer);
        image.resize(256, Jimp.AUTO); // Resize width to 256, auto height
        const resizedBuffer = await image.getBufferAsync(Jimp.MIME_JPEG);

        // Upload back to S3
        // key format: private/{userid}/uploads/{filename}
        const filename = key.split('/').pop();
        const newKey = `private/${userId}/resized/${filename}`;

        const putCommand = new PutObjectCommand({
            Bucket: bucket,
            Key: newKey,
            Body: resizedBuffer,
            ContentType: 'image/jpeg'
        });

        await s3.send(putCommand);
        console.log("Thumbnail uploaded to", newKey);

        // Update DynamoDB with final status and thumbnail path
        const tableName = process.env.DYNAMODB_TABLE;
        const updateParams = {
            TableName: tableName,
            Key: {
                objectKey: { S: key }
            },
            UpdateExpression: "SET #st = :status, thumbnailKey = :thumbKey",
            ExpressionAttributeNames: {
                "#st": "status"
            },
            ExpressionAttributeValues: {
                ":status": { S: "COMPLETED" },
                ":thumbKey": { S: newKey }
            }
        };
        
        await dynamodb.send(new UpdateItemCommand(updateParams));

        return { thumbnailKey: newKey };
    } catch (e) {
        console.error("Error generating thumbnail", e);
        
        // Try to update DB to error status
        try {
            await dynamodb.send(new UpdateItemCommand({
                TableName: process.env.DYNAMODB_TABLE,
                Key: { objectKey: { S: key } },
                UpdateExpression: "SET #st = :status",
                ExpressionAttributeNames: { "#st": "status" },
                ExpressionAttributeValues: { ":status": { S: "ERROR" } }
            }));
        } catch(ignore) {}
        
        throw e;
    }
};
