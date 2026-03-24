const { RekognitionClient, DetectLabelsCommand } = require('@aws-sdk/client-rekognition');
const { DynamoDBClient, UpdateItemCommand } = require('@aws-sdk/client-dynamodb');

const rekognition = new RekognitionClient();
const dynamodb = new DynamoDBClient();

exports.handler = async (event) => {
    console.log("rekognition-tag input:", JSON.stringify(event));
    
    // Handle Step Functions ResultPath which nests the original event inside ExtractMetadataResult/ValidateFormatResult/StoreMetadataResult
    // Since we used ResultPath replacing the state with previous state recursively, it is just `event`.
    // Wait, in state machine we said `ResultPath: "$.StoreMetadataResult"`, which puts result inside original object.
    // Our store-metadata just returns event.
    // So the top level has `bucket`, `key`.
    let dataPayload = event.StoreMetadataResult ? event.StoreMetadataResult : event;

    const { bucket, key } = dataPayload;
    
    const rekParams = {
        Image: {
            S3Object: {
                Bucket: bucket,
                Name: key
            }
        },
        MaxLabels: 10,
        MinConfidence: 70
    };

    let tags = [];
    try {
        const rekResult = await rekognition.send(new DetectLabelsCommand(rekParams));
        tags = rekResult.Labels.map(l => l.Name);
        console.log("Rekognition labels:", tags);
        
        // Update DynamoDB
        const tableName = process.env.DYNAMODB_TABLE;
        const updateParams = {
            TableName: tableName,
            Key: {
                objectKey: { S: key }
            },
            UpdateExpression: "SET tags = :tags",
            ExpressionAttributeValues: {
                ":tags": { L: tags.map(t => ({ S: t })) }
            }
        };
        
        await dynamodb.send(new UpdateItemCommand(updateParams));
        
    } catch (e) {
        console.error("Error in rekognition-tag", e);
        throw e;
    }
    
    return { tags };
};
