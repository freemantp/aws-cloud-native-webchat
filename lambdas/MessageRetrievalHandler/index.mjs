import { ApiGatewayManagementApiClient, PostToConnectionCommand } from "@aws-sdk/client-apigatewaymanagementapi";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand } from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({});
const dynamo = DynamoDBDocumentClient.from(client);

export const handler = async (event, context) => {

  try {

    const apiGwClient = new ApiGatewayManagementApiClient({
      apiVersion: '2018-11-29',
      endpoint: `https://${event.requestContext.domainName}/${event.requestContext.stage}`
    });

    const msgCommand = new ScanCommand({
      TableName: process.env.messagesTable,
      ProjectionExpression: "userHandle, message",
      ScanIndexForward: false
    });

    const messages = await dynamo.send(msgCommand);

    const postCommand = new PostToConnectionCommand({
      ConnectionId: event.requestContext.connectionId,
      Data: JSON.stringify({ messages: messages.Items })
    });

    await apiGwClient.send(postCommand);

    return { statusCode: 200, };

  } catch (err) {
    console.error(err);
    return { statusCode: 500, };
  }
};