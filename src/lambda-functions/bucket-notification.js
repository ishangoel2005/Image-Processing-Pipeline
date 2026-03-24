const { S3Client, PutBucketNotificationConfigurationCommand } = require("@aws-sdk/client-s3");
const s3 = new S3Client({});

exports.handler = async (event, context) => {
  console.log("Received event:", JSON.stringify(event, null, 2));

  const { RequestType, ResourceProperties } = event;
  const { BucketName, FunctionArn, Prefix } = ResourceProperties;

  let responseStatus = "SUCCESS";
  let responseData = {};

  try {
    if (RequestType === "Create" || RequestType === "Update") {
      const command = new PutBucketNotificationConfigurationCommand({
        Bucket: BucketName,
        NotificationConfiguration: {
          LambdaFunctionConfigurations: [
            {
              Id: "S3TriggerNotification",
              LambdaFunctionArn: FunctionArn,
              Events: ["s3:ObjectCreated:*"],
              Filter: {
                Key: {
                  FilterRules: [
                    {
                      Name: "prefix",
                      Value: Prefix || ""
                    }
                  ]
                }
              }
            }
          ]
        }
      });
      await s3.send(command);
    } else if (RequestType === "Delete") {
      // Clear out the notification configuration on delete
      const command = new PutBucketNotificationConfigurationCommand({
        Bucket: BucketName,
        NotificationConfiguration: {}
      });
      await s3.send(command);
    }
  } catch (error) {
    console.error("Error modifying bucket notification:", error);
    responseStatus = "FAILED";
    responseData = { Error: error.message };
  }

  await sendResponse(event, context, responseStatus, responseData);
};

const sendResponse = async (event, context, responseStatus, responseData) => {
  const responseBody = JSON.stringify({
    Status: responseStatus,
    Reason: `See the details in CloudWatch Log Stream: ${context.logStreamName}`,
    PhysicalResourceId: event.PhysicalResourceId || event.LogicalResourceId || "StaticPhysicalId",
    StackId: event.StackId,
    RequestId: event.RequestId,
    LogicalResourceId: event.LogicalResourceId,
    Data: responseData,
  });

  console.log("Sending response:", responseBody);

  try {
    const response = await fetch(event.ResponseURL, {
      method: "PUT",
      headers: {
        "content-type": "",
        "content-length": Buffer.byteLength(responseBody).toString()
      },
      body: responseBody
    });
    console.log("Response status:", response.status);
  } catch (error) {
    console.error("Error sending response:", error);
  }
};