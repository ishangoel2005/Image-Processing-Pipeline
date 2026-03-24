const { SFNClient, StartExecutionCommand } = require('@aws-sdk/client-sfn');
const sfn = new SFNClient();

exports.handler = async (event) => {
    console.log("Event:", JSON.stringify(event));

    for (const record of event.Records) {
        const bucket = record.s3.bucket.name;
        const key = decodeURIComponent(record.s3.object.key.replace(/\+/g, ' '));

        // Only process uploads, ignore resized thumbnails to prevent infinite loops
        if (!key.includes('/uploads/')) {
            console.log(`Skipping key ${key} as it is not in an uploads directory.`);
            continue;
        }

        const stateMachineArn = process.env.STATE_MACHINE_ARN;
        const input = {
            bucket: bucket,
            key: key,
            userId: key.split('/')[1] // private/{userid}/uploads/...
        };

        const params = {
            stateMachineArn: stateMachineArn,
            name: `Execution-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
            input: JSON.stringify(input)
        };

        console.log("Starting execution:", params);
        await sfn.send(new StartExecutionCommand(params));
    }

    return { statusCode: 200, body: 'Trigger processed.' };
};
