import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, UpdateCommand } from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

export const handler = async (event, context) => {

  try {

    const body = JSON.parse(event.body);
    console.log(body)

    let updateExpression = 'SET userHandle = :userValue';
    let updateValues = { ':userValue': body.name };

    if (body.transationLang) {
      updateExpression += ', translationLang = :langValue'
      updateValues[':langValue'] = body.transationLang;
    }

    console.log(updateExpression)
    console.log(updateValues)


    const command = new UpdateCommand({
      TableName: "Connections",
      Key: { connectionId: event.requestContext.connectionId },
      UpdateExpression: updateExpression,
      ExpressionAttributeValues: updateValues,
      ReturnValues: "NONE",
    });

    await docClient.send(command);
    return { statusCode: 200, };

  } catch (err) {
    return { statusCode: 500, };
  }
};
