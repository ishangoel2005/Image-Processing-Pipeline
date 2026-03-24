const { DynamoDBClient, PutItemCommand } = require('@aws-sdk/client-dynamodb');
const client = new DynamoDBClient();

exports.handler = async (event) => {
    console.log("store-metadata input:", JSON.stringify(event));
    
    const tableName = process.env.DYNAMODB_TABLE;
    const { key, userId, metadata } = event;

    // Convert metadata to DynamoDB format
    const item = {
        objectKey: { S: key },
        userId: { S: userId },
        format: { S: metadata.format },
        size: { N: metadata.size.toString() },
        timestamp: { S: metadata.timestamp },
        status: { S: "PROCESSING" }
    };

    if (metadata.exifData) {
        item.exifData = { S: JSON.stringify(metadata.exifData) };
    }
    
    if (metadata.location) {
        item.location = {
            M: {
                Latitude: { N: metadata.location.Latitude.toString() },
                Longitude: { N: metadata.location.Longitude.toString() }
            }
        };
    }

    const command = new PutItemCommand({
        TableName: tableName,
        Item: item
    });

    try {
        await client.send(command);
        console.log("Successfully stored metadata in DynamoDB");
    } catch (e) {
        console.error("Error storing metadata", e);
        throw e;
    }

    return event;
};
